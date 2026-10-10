"""Scientific scope, source priority, and motion checks for the 2MASS review."""

import csv
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources.enrichment import FIELDS, ROOT, enrich_from_frozen
from catalog_sources.ultracool_motion import enrich_reviewed_motion


def empty_row(identifier="cns5-4566", **values):
    return {"id": identifier, "type": "brown_dwarf", "spectral_type": "T6", "notes": "",
            "x_pc": "1", "y_pc": "0", "z_pc": "0", **dict.fromkeys(FIELDS, ""), **values}


class UltracoolEnrichmentTests(unittest.TestCase):
    def test_named_example_has_sourced_parameters_without_invented_age_or_velocity(self):
        row = empty_row()
        adopted = enrich_from_frozen(row, "2MASS J18283572-4849046")
        self.assertEqual(set(adopted), {"temperature_k", "mass_solar", "radius_solar", "luminosity_solar"})
        self.assertEqual(float(row["temperature_k"]), 985)
        self.assertAlmostEqual(float(row["mass_solar"]), 21.67 * 1.2668653e17 / 1.3271244e20)
        self.assertAlmostEqual(float(row["radius_solar"]), 1.07 * 71492 / 695700)
        self.assertAlmostEqual(float(row["luminosity_solar"]), 10 ** -5.01)
        self.assertEqual(adopted["temperature_k"]["uncertainty"], 79)
        self.assertEqual(adopted["mass_solar"]["status"], "model-derived")
        self.assertEqual(adopted["luminosity_solar"]["status"], "derived")
        self.assertEqual(adopted["mass_solar"]["inputs"]["ageCategory"], "Field")
        self.assertEqual(row["age_gyr"], "")
        self.assertEqual(row["metallicity_dex"], "")
        self.assertIsNone(enrich_reviewed_motion(row, "2MASS J18283572-4849046"))

    def test_only_documented_class_estimates_are_superseded(self):
        for note in ("Estimated temperature from Pecaut-Mamajek 2022.04.16 T6 mean dwarf sequence (interpolation where needed); not an object-specific measurement.",
                     "Estimated: Pecaut-Mamajek 2022.04.16 T6V mean dwarf class, not a measured temperature."):
            row = empty_row(temperature_k="950", notes=note)
            adopted = enrich_from_frozen(row, "2MASS J18283572-4849046")
            self.assertEqual(row["temperature_k"], "985")
            self.assertEqual(adopted["temperature_k"]["superseded"]["value"], 950)
            self.assertNotIn("Pecaut-Mamajek", row["notes"])
        row = empty_row(temperature_k="1000", mass_solar="0.04", radius_solar="0.11", luminosity_solar="0.00001")
        before = dict(row)
        self.assertEqual(enrich_from_frozen(row, "2MASS J18283572-4849046"), {})
        self.assertEqual(row, before)

    def test_binary_and_bad_fit_records_have_no_physical_review(self):
        review = json.loads((ROOT / "catalog-work/shared-enrichment/reviewed-ultracool.json").read_text())
        for name in ("2MASS J09393548-2448279", "2MASS J12255432-2739466", "2MASS J05591914-1404488", "2MASS J18212815+1414010"):
            self.assertNotIn(name, review["objects"])
        self.assertEqual(len(review["audit"]), 90)

    def test_wrong_identity_or_object_type_cannot_receive_parameters(self):
        with self.assertRaisesRegex(ValueError, "identity/type drifted"):
            enrich_from_frozen(empty_row(identifier="unmatched"), "2MASS J18283572-4849046")
        with self.assertRaisesRegex(ValueError, "identity/type drifted"):
            enrich_from_frozen(empty_row(type="star"), "2MASS J18283572-4849046")
        row = empty_row(identifier="unmatched", spectral_type="")
        self.assertEqual(enrich_from_frozen(row, "2MASS J18283572-4849046 B"), {})

    def test_older_source_fallback_is_explicit_and_keeps_its_inputs(self):
        row = empty_row(identifier="10pc-0120")
        adopted = enrich_from_frozen(row, "2MASS J08173001-6155158")
        self.assertEqual(adopted["temperature_k"]["reference"], "2015ApJ...810..158F")
        self.assertEqual(adopted["temperature_k"]["value"], 1004)
        self.assertEqual(adopted["radius_solar"]["inputs"]["sourceTemperatureK"], 1004)

    def test_velocity_preserves_position_and_recovers_radial_and_tangential_motion(self):
        import astropy.units as units
        from astropy.coordinates import CartesianDifferential, Galactic, SkyCoord
        with (ROOT / "src/data/catalogs/nearest-1000/stars.csv").open() as handle:
            rows = list(csv.DictReader(handle))
        row = dict(next(row for row in rows if row["id"] == "cns5-1604"))
        row.update(radial_velocity_kms="", radial_velocity_error_kms="", radial_velocity_ref="", vx_kms="", vy_kms="", vz_kms="")
        before = dict(row)
        adopted = enrich_reviewed_motion(row, "2MASS J06272007-1114241")
        self.assertEqual(row["radial_velocity_kms"], "1.2")
        self.assertEqual(row["radial_velocity_error_kms"], "1.0")
        self.assertEqual(adopted["reference"], "2021ApJS..257...45H")
        for field in ("x_pc", "y_pc", "z_pc", "ra_deg", "dec_deg", "parallax_mas", "pm_ra_cosdec_masyr", "pm_dec_masyr"):
            self.assertEqual(row[field], before[field])
        position = SkyCoord(ra=float(row["ra_deg"]) * units.deg, dec=float(row["dec_deg"]) * units.deg,
                            distance=1000 / float(row["parallax_mas"]) * units.pc).galactic.cartesian
        motion = CartesianDifferential([float(row[k]) for k in ("vx_kms", "vy_kms", "vz_kms")] * units.km / units.s)
        recovered = SkyCoord(Galactic(position.with_differentials(motion))).icrs
        self.assertAlmostEqual(recovered.radial_velocity.to_value(units.km / units.s), 1.2, places=5)
        self.assertAlmostEqual(recovered.pm_ra_cosdec.to_value(units.mas / units.yr), float(row["pm_ra_cosdec_masyr"]), places=4)
        self.assertAlmostEqual(recovered.pm_dec.to_value(units.mas / units.yr), float(row["pm_dec_masyr"]), places=4)
        self.assertIsNone(enrich_reviewed_motion(row, "2MASS J06272007-1114241"))
        self.assertEqual(adopted["uncertainty"], 1)
        preserved = dict(before, vx_kms="42")
        self.assertIsNone(enrich_reviewed_motion(preserved, "2MASS J06272007-1114241"))
        self.assertEqual(preserved["vx_kms"], "42")


if __name__ == "__main__":
    unittest.main()
