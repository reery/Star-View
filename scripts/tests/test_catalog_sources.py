import csv
import tempfile
import unittest
from pathlib import Path

from scripts.catalog_sources.adapters import _text, read_gaia_tap, read_simbad_tap
from scripts.catalog_sources.acquisition import gaia_query, simbad_query
from scripts.catalog_sources.identity import positional_candidate, resolve_identity
from scripts.catalog_sources.models import IdentityRecord, NormalizedSourceRecord, PhysicalObservation
from scripts.catalog_sources.resolution import resolve_physical_field
from scripts.catalog_sources.snapshots import canonical_json, sha256, verify_sha256


class CatalogSourceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.folder = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def write_csv(self, name, rows):
        path = self.folder / name
        with path.open("w", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=rows[0])
            writer.writeheader()
            writer.writerows(rows)
        return path

    def test_gaia_identifier_remains_a_string_and_missing_rv_stays_missing(self):
        self.assertIsNone(_text("-"))
        path = self.write_csv("gaia.csv", [{"source_id": "6305165514134625024", "ra": "10", "dec": "-20", "ref_epoch": "2016", "parallax": "100", "pmra": "3", "pmdec": "4", "radial_velocity": "", "mass_flame": "0.2"}])
        record = read_gaia_tap(path)[0]
        self.assertEqual(record.identity.gaia_dr3_id, "6305165514134625024")
        self.assertIsNone(record.astrometry.radial_velocity_kms)
        self.assertEqual(record.physical[0].field, "mass_solar")

    def test_gaia_identity_survives_a_jointly_missing_motion_solution(self):
        path = self.write_csv("gaia-identity.csv", [{"source_id": "1234567890123456789", "ra": "10", "dec": "-20", "ref_epoch": "2016", "parallax": "", "pmra": "", "pmdec": "", "teff_gspphot": "3100"}])
        record = read_gaia_tap(path)[0]
        self.assertIsNone(record.astrometry)
        self.assertEqual(record.physical[0].value, 3100)
        broken = self.write_csv("gaia-broken.csv", [{"source_id": "2", "ra": "10", "dec": "-20", "parallax": "100", "pmra": "", "pmdec": "4"}])
        with self.assertRaisesRegex(ValueError, "incomplete astrometry group"):
            read_gaia_tap(broken)

    def test_gaia_physical_bounds_and_flame_flags_are_retained(self):
        path = self.write_csv("gaia-physical.csv", [{"source_id": "1", "ra": "10", "dec": "-20", "parallax": "100", "pmra": "3", "pmdec": "4", "mass_flame": "0.8", "mass_flame_lower": "0.7", "mass_flame_upper": "0.95", "flags_flame": "10"}])
        mass = read_gaia_tap(path)[0].physical[0]
        self.assertAlmostEqual(mass.uncertainty, 0.15)
        self.assertEqual(mass.quality_flags, ("10",))

    def test_exact_identifier_wins_and_ambiguous_alias_is_rejected(self):
        exact = NormalizedSourceRecord(IdentityRecord("gaia-dr3", "1", gaia_dr3_id="1"))
        target = IdentityRecord("cns5", "7", gaia_dr3_id="1")
        self.assertIs(resolve_identity(target, [exact]).accepted, exact)
        simbad_path = self.write_csv("simbad.csv", [{"main_id": "A", "ids": "GJ 1|Gaia DR3 1"}, {"main_id": "B", "ids": "GJ 1"}])
        aliases = read_simbad_tap(simbad_path)
        result = resolve_identity(IdentityRecord("cns5", "8"), aliases, {("8", "GJ 1")})
        self.assertIsNone(result.accepted)
        self.assertTrue(all(not candidate.accepted for candidate in result.candidates))

    def test_positional_matches_are_review_only(self):
        record = NormalizedSourceRecord(IdentityRecord("gaia-dr3", "1", gaia_dr3_id="1"))
        candidate = positional_candidate(record, 0.2)
        self.assertFalse(candidate.accepted)
        self.assertEqual(candidate.method, "position-candidate")

    def test_field_conflicts_and_source_priority_are_explicit(self):
        primary = PhysicalObservation("primary-paper", "a", "mass_solar", 0.28, 0.01, "measured", "paper")
        gaia = PhysicalObservation("gaia-dr3", "1", "mass_solar", 0.31, None, "model-derived", "Gaia DR3")
        selected, decision = resolve_physical_field("mass_solar", [gaia, primary])
        self.assertIs(selected, primary)
        self.assertEqual(decision.selected_source_id, "primary-paper")
        conflict, conflict_decision = resolve_physical_field("mass_solar", [primary, PhysicalObservation("primary-paper", "b", "mass_solar", 0.29, 0.01, "measured", "other")])
        self.assertIsNone(conflict)
        self.assertEqual(conflict_decision.status, "conflicting")

    def test_checksum_drift_and_canonical_output(self):
        path = self.folder / "source.dat"
        path.write_text("first")
        digest = sha256(path)
        verify_sha256(path, digest)
        path.write_text("second")
        with self.assertRaisesRegex(ValueError, "Checksum drift"):
            verify_sha256(path, digest)
        self.assertEqual(canonical_json({"b": 1, "a": 2}), '{\n  "a": 2,\n  "b": 1\n}\n')

    def test_queries_use_exact_string_identifiers(self):
        self.assertIn("ident.id IN ('CNS5 7','CNS5 8')", simbad_query(["7", "8"]))
        self.assertIn("source_id IN (6305165514134625024)", gaia_query(["6305165514134625024"]))
        with self.assertRaisesRegex(ValueError, "only digits"):
            gaia_query(["6e18"])


if __name__ == "__main__":
    unittest.main()