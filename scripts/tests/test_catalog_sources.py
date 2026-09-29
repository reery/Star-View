import csv
import io
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.catalog_sources.adapters import _text, read_cifuentes, read_gaia_tap, read_simbad_tap, read_twomass_psc
from scripts.catalog_sources.acquisition import _download, _tap_query, gaia_query, simbad_query, twomass_query
from scripts.catalog_sources.filesystem import atomic_write_text, safe_output_directory, write_managed_files
from scripts.catalog_sources.identity import positional_candidate, resolve_identity
from scripts.catalog_sources.mdwarf import RowContext, Supplements, build_crossmatch, dwarf_subclass, mann2015_radius, mann2019_mass, resolve_supplemented_fields, supplement_observations
from scripts.catalog_sources.models import IdentityRecord, NormalizedSourceRecord, PhysicalObservation
from scripts.catalog_sources.resolution import resolve_physical_field
from scripts.catalog_sources.snapshots import canonical_json, sha256, verify_sha256

ROOT = Path(__file__).resolve().parents[2]


def cifuentes_line(karmn, dist, lbol, teff, radius, mass, dr2="", multiple="false", young="false", ruwe="false"):
    line = [" "] * 767
    for start, text in ((1, karmn), (129, dist), (158, lbol), (172, "1.0E-4"), (186, teff), (195, radius), (202, "0.0060"), (209, mass), (216, "0.0100"), (705, dr2), (745, multiple), (751, young), (757, ruwe), (763, "false")):
        line[start - 1:start - 1 + len(text)] = text
    return "".join(line)


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
        path = self.write_csv("gaia-physical.csv", [{"source_id": "1", "ra": "10", "dec": "-20", "parallax": "100", "pmra": "3", "pmdec": "4", "mh_gspphot": "-0.25", "mass_flame": "0.8", "mass_flame_lower": "0.7", "mass_flame_upper": "0.95", "radius_flame": "0.9", "age_flame": "4.2", "flags_flame": "10"}])
        physical = {item.field: item for item in read_gaia_tap(path)[0].physical}
        mass = physical["mass_solar"]
        self.assertAlmostEqual(mass.uncertainty, 0.15)
        self.assertEqual(mass.quality_flags, ("10",))
        self.assertEqual(physical["metallicity_dex"].value, -0.25)
        self.assertEqual(physical["radius_solar"].value, 0.9)
        self.assertEqual(physical["age_gyr"].value, 4.2)

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
        self.assertIn("ap.radius_flame", gaia_query(["6305165514134625024"]))
        self.assertIn("ap.mh_gspphot", gaia_query(["6305165514134625024"]))
        self.assertIn("ap.age_flame", gaia_query(["6305165514134625024"]))
        with self.assertRaisesRegex(ValueError, "only digits"):
            gaia_query(["6e18"])

    def test_network_acquisition_passes_explicit_timeouts(self):
        responses = [io.BytesIO(b"catalog"), io.BytesIO(b"value\n")]
        with patch("scripts.catalog_sources.acquisition.urllib.request.urlopen", side_effect=responses) as urlopen:
            _download("https://example.test/catalog", self.folder / "catalog.dat", timeout=12.5)
            _tap_query("https://example.test/tap", "SELECT 1", self.folder / "tap.csv", timeout=7.25)
        self.assertEqual(urlopen.call_args_list[0].kwargs["timeout"], 12.5)
        self.assertEqual(urlopen.call_args_list[1].kwargs["timeout"], 7.25)
        self.assertEqual((self.folder / "catalog.dat").read_bytes(), b"catalog")
        self.assertEqual((self.folder / "tap.csv").read_bytes(), b"value\n")

    def test_atomic_outputs_reject_symlinks(self):
        target = self.folder / "snapshot.json"
        target.write_text("previous")
        atomic_write_text(target, "replacement")
        self.assertEqual(target.read_text(), "replacement")
        linked_file = self.folder / "linked.json"
        linked_file.symlink_to(target)
        with self.assertRaisesRegex(ValueError, "symbolic link"):
            atomic_write_text(linked_file, "blocked")
        linked_folder = self.folder / "linked-folder"
        linked_folder.symlink_to(self.folder / "real-folder")
        with self.assertRaisesRegex(ValueError, "symbolic link"):
            safe_output_directory(linked_folder)

    def test_failed_download_preserves_existing_output(self):
        class FailingResponse(io.BytesIO):
            def read(self, size=-1):
                if self.tell() > 0:
                    raise TimeoutError("stalled")
                return super().read(3 if size < 0 else min(size, 3))

        target = self.folder / "catalog.dat"
        target.write_bytes(b"previous")
        with patch("scripts.catalog_sources.acquisition.urllib.request.urlopen", return_value=FailingResponse(b"partial-data")):
            with self.assertRaises(TimeoutError):
                _download("https://example.test/catalog", target, timeout=1)
        self.assertEqual(target.read_bytes(), b"previous")

    def test_failed_package_publish_restores_every_original(self):
        first = self.folder / "first.txt"
        second = self.folder / "second.txt"
        first.write_text("old first")
        second.write_text("old second")
        real_replace = __import__("os").replace
        resolved_second = second.resolve()

        def fail_second_backup(source, destination):
            source = Path(source)
            if source.resolve() == resolved_second:
                raise OSError("injected publish failure")
            return real_replace(source, destination)

        with patch("scripts.catalog_sources.filesystem.os.replace", side_effect=fail_second_backup):
            with self.assertRaisesRegex(OSError, "injected publish failure"):
                write_managed_files(self.folder, {"first.txt": "new first", "second.txt": "new second"}, True)
        self.assertEqual(first.read_text(), "old first")
        self.assertEqual(second.read_text(), "old second")

    def supplements(self, lines, twomass_rows, crossmatch, blended=()):
        (self.folder / "cif.dat").write_text("\n".join(lines) + "\n")
        cifuentes = read_cifuentes(self.folder / "cif.dat")
        twomass = read_twomass_psc(self.write_csv("2mass.csv", twomass_rows))
        by_dr2 = {record.raw["gaiaDr2Primary"]: record for record in cifuentes if record.raw["gaiaDr2Primary"]}
        supplements = Supplements(crossmatch, {record.identity.source_record_id: record for record in cifuentes}, by_dr2, twomass, set(blended), "0" * 64, {}, {})
        for entry in crossmatch.values():
            for karmn in supplements.cifuentes_candidates(entry):
                supplements.cifuentes_claims[karmn] = supplements.cifuentes_claims.get(karmn, 0) + 1
            if entry["twomass"]:
                supplements.twomass_claims[entry["twomass"]] = supplements.twomass_claims.get(entry["twomass"], 0) + 1
        return supplements

    @staticmethod
    def entry(identifier, cns5="1", twomass="17574849+0441405", karmn="J17578+046", dr2=""):
        return {"star_view_id": identifier, "cns5_id": cns5, "simbad_id": "x", "twomass": twomass, "karmn": karmn, "gaia_dr2": dr2, "identity_method": "test"}

    def test_cifuentes_fixed_width_and_twomass_readers(self):
        (self.folder / "cif.dat").write_text(cifuentes_line("J17578+046", "1.826649", "3.5225088E-3", "3200", "0.1931", "0.1797", dr2="4472832130942575872", young="true") + "\n")
        record = read_cifuentes(self.folder / "cif.dat")[0]
        physical = {item.field: item for item in record.physical}
        self.assertEqual(record.identity.source_record_id, "J17578+046")
        self.assertEqual(record.raw["gaiaDr2Primary"], "4472832130942575872")
        self.assertTrue(record.raw["young"])
        self.assertEqual(physical["luminosity_solar"].value, 0.0035225088)
        self.assertEqual(physical["temperature_k"].uncertainty, 50.0)
        self.assertEqual((physical["radius_solar"].status, physical["mass_solar"].status), ("derived", "empirical-relation"))
        (self.folder / "short.dat").write_text("J00000+000\n")
        with self.assertRaisesRegex(ValueError, "expected 767"):
            read_cifuentes(self.folder / "short.dat")
        twomass = read_twomass_psc(self.write_csv("2mass.csv", [{"2MASS": "17574849+0441405 ", "Kmag": "4.524", "e_Kmag": "0.02", "Qflg": "AAA", "Bflg": "111", "Cflg": "000"}]))
        self.assertEqual(twomass["17574849+0441405"]["ks_mag"], 4.524)
        self.assertIn("\"2MASS\" IN ('17574849+0441405')", twomass_query(["17574849+0441405"]))
        with self.assertRaisesRegex(ValueError, "designations"):
            twomass_query(["J17574849+0441405"])

    def test_mann_relations_reproduce_published_examples(self):
        # Mann et al. 2019 code README: Trappist-1 0.0898 and GJ 1214 0.1803 solar masses.
        trappist, _ = mann2019_mass(10.296 - 5 * math.log10(12.23989539 / 10))
        gj1214, error = mann2019_mass(8.782 - 5 * math.log10(14.55 / 10), 0.03)
        self.assertAlmostEqual(trappist, 0.0898, delta=0.0898 * 0.03)
        self.assertAlmostEqual(gj1214, 0.1803, delta=0.1803 * 0.03)
        self.assertGreater(error / gj1214, 0.020)
        self.assertAlmostEqual(mann2019_mass(7.5)[0], 10 ** -0.642)
        radius, radius_error = mann2015_radius(6.6)
        self.assertAlmostEqual(radius, 1.9515 - 0.3520 * 6.6 + 0.01680 * 6.6 ** 2)
        self.assertAlmostEqual(radius_error, 0.0289 * radius)

    def test_dwarf_subclass_rejects_giants_subdwarfs_and_composites(self):
        for text, expected in (("M4.5V", 4.5), ("dM4", 4.0), ("K7V", -3.0), ("M5.5Ve", 5.5), ("M3/4V", 3.0), ("K2+V", -8.0), ("M4.0Vk:", 4.0)):
            self.assertEqual(dwarf_subclass(text), expected, text)
        for text in ("sdM1", "M4+T8", "K3IV", "K0IIIb", "M?", "K1V_Fe-0.5", "L5", "", None):
            self.assertIsNone(dwarf_subclass(text), text)

    def test_supplements_apply_eligibility_and_field_priority(self):
        twomass = [{"2MASS": "17574849+0441405", "Kmag": "4.524", "e_Kmag": "0.02", "Qflg": "AAA", "Bflg": "111", "Cflg": "000"}]
        line = cifuentes_line("J17578+046", "1.826649", "3.5225088E-3", "3200", "0.1931", "0.1797")
        context = RowContext("barnard", "star", "M4.0Ve", 1.8266, 0.0001)
        supplements = self.supplements([line], twomass, {"barnard": self.entry("barnard")})
        observations, audit = supplement_observations(context, supplements)
        self.assertEqual(audit["cifuentes2020"]["status"], "adopted")
        self.assertEqual(sorted(audit["mann"]["fields"]), ["mass_solar", "radius_solar"])
        row = {"temperature_k": "3210", "mass_solar": "", "luminosity_solar": "", "radius_solar": "", "notes": "Curated."}
        adopted = resolve_supplemented_fields(row, observations)
        self.assertEqual(row["temperature_k"], "3210")
        self.assertEqual(adopted["mass_solar"].source_id, "mann-2019")
        self.assertEqual(adopted["radius_solar"].source_id, "cifuentes-2020")
        self.assertEqual(row["luminosity_solar"], "0.0035225088")
        self.assertTrue(row["notes"].startswith("Curated. Supplementary mass from Mann et al. 2019"))
        gaia = PhysicalObservation("gaia-dr3", "1", "radius_solar", 0.25, None, "model-derived", "Gaia DR3")
        replaced = {"radius_solar": "0.25", "notes": ""}
        resolve_supplemented_fields(replaced, observations, {"radius_solar": gaia})
        self.assertEqual(replaced["radius_solar"], "0.1931")

        blended, audit = supplement_observations(context, self.supplements([line], twomass, {"barnard": self.entry("barnard")}, blended={"1"}))
        self.assertEqual(audit["mann"]["status"], "withheld")
        self.assertFalse(any(item.source_id.startswith("mann") for item in blended))
        dirty = [dict(twomass[0], Qflg="AAE")]
        self.assertEqual(supplement_observations(context, self.supplements([line], dirty, {"barnard": self.entry("barnard")}))[1]["mann"]["status"], "withheld")
        far, audit = supplement_observations(RowContext("barnard", "star", "M4.0Ve", 1.95, None), supplements)
        self.assertEqual(audit["cifuentes2020"]["status"], "withheld")
        self.assertFalse(any(item.source_id == "cifuentes-2020" for item in far))
        young = cifuentes_line("J17578+046", "1.826649", "3.5225088E-3", "3200", "0.1931", "0.1797", young="true")
        observations, audit = supplement_observations(context, self.supplements([young], twomass, {"barnard": self.entry("barnard")}))
        self.assertNotIn("mass_solar", [item.field for item in observations])
        self.assertEqual(audit["mann"]["status"], "withheld")
        shared = self.supplements([line], twomass, {"a": self.entry("a"), "b": self.entry("b", cns5="2")})
        self.assertEqual(supplement_observations(RowContext("a", "star", "M4.0Ve", 1.8266, None), shared)[0], [])
        brown, audit = supplement_observations(RowContext("barnard", "brown_dwarf", "L5", 1.8266, None), supplements)
        self.assertEqual(brown, [])
        self.assertIn("eligibility", audit)

    def test_frozen_crossmatch_regenerates_from_frozen_identities(self):
        self.assertEqual(build_crossmatch(ROOT), (ROOT / "catalog-work/physical-supplements/crossmatch.csv").read_text())


if __name__ == "__main__":
    unittest.main()
