"""Check geometric white-dwarf motion and retain the original measurements."""

import copy
import csv
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("nearest100", ROOT / "scripts/author-nearest100.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)


class VanMaanenTests(unittest.TestCase):
    def setUp(self):
        self.review = author.reviewed_physical_records()["10pc-0073"]
        self.source = next(row for row in json.loads((ROOT / "catalog-work/nearest-100/source-input.json").read_text())["candidates"] if row["Seq"] == "73")
        with (ROOT / "src/data/catalogs/nearest-100/stars.csv").open() as handle:
            self.row = next(row for row in csv.DictReader(handle) if row["id"] == "10pc-0073")
        for field in ("radial_velocity_kms", "vx_kms", "vy_kms", "vz_kms"):
            self.row[field] = ""

    def test_motion_round_trip_and_unchanged_astrometry_photometry(self):
        from astropy.coordinates import CartesianDifferential, Galactic, SkyCoord
        import astropy.units as u
        before = dict(self.row)
        source_before = copy.deepcopy(self.source)
        adopted = author.adopt_reviewed_astrometric_velocity(self.row, self.source, self.review)
        xyz = [float(self.row[key]) for key in ("vx_kms", "vy_kms", "vz_kms")]
        coordinate = SkyCoord(ra=float(self.row["ra_deg"]) * u.deg, dec=float(self.row["dec_deg"]) * u.deg,
                              distance=1000 / float(self.row["parallax_mas"]) * u.pc)
        galactic = coordinate.galactic.cartesian.with_differentials(CartesianDifferential(xyz * u.km / u.s))
        recovered = SkyCoord(Galactic(galactic)).icrs
        self.assertAlmostEqual(recovered.radial_velocity.to_value(u.km / u.s), -11.74, places=5)
        self.assertAlmostEqual(recovered.pm_ra_cosdec.to_value(u.mas / u.yr), float(before["pm_ra_cosdec_masyr"]), places=3)
        self.assertAlmostEqual(recovered.pm_dec.to_value(u.mas / u.yr), float(before["pm_dec_masyr"]), places=3)
        self.assertEqual(self.row["radial_velocity_error_kms"], "7.11")
        for field in before.keys() - {"vx_kms", "vy_kms", "vz_kms", "radial_velocity_kms", "radial_velocity_error_kms", "radial_velocity_ref", "notes"}:
            self.assertEqual(self.row[field], before[field], field)
        self.assertEqual(self.source, source_before)
        self.assertEqual(adopted["method"], "perspective-acceleration")

    def test_rejects_wrong_gaia_spectral_method_or_existing_motion(self):
        source = {**self.source, "GaiaEDR3": "different-star"}
        with self.assertRaisesRegex(ValueError, "identity/method drifted"):
            author.adopt_reviewed_astrometric_velocity(self.row, source, self.review)
        reviewed = copy.deepcopy(self.review)
        reviewed.raw["astrometricVelocity"]["method"] = "spectroscopic"
        with self.assertRaisesRegex(ValueError, "identity/method drifted"):
            author.adopt_reviewed_astrometric_velocity(self.row, self.source, reviewed)
        self.row["radial_velocity_kms"] = "263"
        with self.assertRaisesRegex(ValueError, "replace existing motion"):
            author.adopt_reviewed_astrometric_velocity(self.row, self.source, self.review)


if __name__ == "__main__":
    unittest.main()
