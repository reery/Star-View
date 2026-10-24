"""Scientific regressions for Izar geometry, identity and source preservation."""
import importlib.util
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("author_companions", ROOT / "scripts/author-stellar-companions.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)


class IzarReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        payload, cls.audit = author.build()
        cls.stars = {s["id"]: s for s in payload["stars"]}
        cls.members = [cls.stars[i] for i in ("bright-izar", "msc-14450+2704-b", "msc-14450+2704-d")]

    def test_close_pair_and_wide_candidate_keep_their_measured_sky_separations(self):
        a, b, d = self.members
        position = lambda s: [s[k] for k in ("x_pc", "y_pc", "z_pc")]
        for s in self.members:
            self.assertAlmostEqual(math.hypot(*position(s)), 1000 / 16.1, places=7)
        self.assertTrue(170 < math.dist(position(a), position(b)) * 206264.806 < 190)
        self.assertTrue(4800 < math.dist(position(a), position(d)) * 206264.806 < 5000)
        self.assertEqual([a[k] for k in ("vx_kms", "vy_kms", "vz_kms")],
                         [b[k] for k in ("vx_kms", "vy_kms", "vz_kms")])

    def test_resolved_hot_companion_does_not_inherit_cool_primary_atmosphere(self):
        a, b, _ = self.members
        self.assertEqual(b["temperature_k"], 9009)
        self.assertEqual(b["spectral_type"], "A0V")
        self.assertEqual(b["mass_solar"], 2.27)
        self.assertIsNone(b["metallicity_dex"])
        self.assertEqual(a["temperature_k"], 4341)
        for s in (a, b):
            # Independent source rounding allows a small SB discrepancy.
            self.assertAlmostEqual(s["luminosity_solar"] /
                (s["radius_solar"] ** 2 * (s["temperature_k"] / 5772) ** 4), 1, delta=.02)

    def test_candidate_is_exactly_identified_without_inventing_spectrum_or_velocity(self):
        d = self.members[2]
        self.assertEqual(d["type"], "brown_dwarf")
        self.assertIn("Gaia DR3 1279752168030730496", d["designations"])
        self.assertIn("candidate brown dwarf", d["notes"])
        for field in ("temperature_k", "mass_solar", "radius_solar", "luminosity_solar",
                      "spectral_type", "absolute_mag", "apparent_mag", "vx_kms", "vy_kms", "vz_kms"):
            self.assertIsNone(d[field])
        self.assertIsNone(d["raw_astrometry"]["radial_velocity_kms"])
        native = self.audit["componentRecords"][d["id"]]["izarReview"]["nativeGaia"]
        self.assertEqual(float(native["parallax_error"]), .60769314)

    def test_superseded_measurements_and_all_previous_provenance_survive(self):
        review = author.read_json(ROOT / "catalog-work/star-systems/izar-review.json")
        for star in self.members:
            old = review["objects"][star["id"]]["retainedPreviousEffective"]
            sources = star["catalog_sources"]
            self.assertIn({k: v for k, v in old.items() if k != "catalog_sources"},
                          [s["record"] for s in sources])
            for source in old.get("catalog_sources", []):
                self.assertIn(source, sources)


if __name__ == "__main__":
    unittest.main()
