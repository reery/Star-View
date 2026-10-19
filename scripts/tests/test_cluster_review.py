"""Scientific guards for the reviewed cluster identities and distance choice."""
import copy
import importlib.util
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from catalog_sources.cluster_astrometry import apply_cluster_astrometry

spec = importlib.util.spec_from_file_location("author_companions", ROOT / "scripts/author-stellar-companions.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)


class ClusterReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload, cls.audit = author.build()
        cls.stars = {s["id"]: s for s in cls.payload["stars"]}

    def test_wide_c_distance_replaces_spurious_depth_without_collapsing_sky_separation(self):
        a, b, c = (self.stars[i] for i in ("hip-61394", "msc-12349+2238-b", "msc-12349+2238-c"))
        position = lambda star: [star[k] for k in ("x_pc", "y_pc", "z_pc")]
        self.assertLess(math.dist(position(a), position(b)), 1e-6)
        self.assertAlmostEqual(math.hypot(*position(a)), 1000 / 10.531158793728094, places=7)
        self.assertTrue(.07 < math.dist(position(a), position(c)) < .09)
        self.assertEqual(c["raw_astrometry"]["epoch"], 2016)
        self.assertEqual(c["raw_astrometry"]["parallax_error_mas"], .018495932)
        self.assertEqual(c["raw_astrometry"]["pm_ra_error_masyr"], .019742882)
        self.assertEqual([a[k] for k in ("vx_kms", "vy_kms", "vz_kms")], [c[k] for k in ("vx_kms", "vy_kms", "vz_kms")])
        self.assertEqual(a["apparent_mag"], 4.96)
        self.assertAlmostEqual(a["absolute_mag"], 4.96 - 5 * math.log10(math.hypot(*position(a)) / 10), places=8)

    def test_unresolved_ab_fit_and_old_astrometry_survive_with_explicit_scope(self):
        a = self.stars["hip-61394"]
        self.assertIsNone(a["mass_solar"])
        self.assertIsNone(a["temperature_k"])
        sources = a["catalog_sources"]
        self.assertTrue(any(s["record"].get("mass_solar") == 3.001303 for s in sources))
        self.assertTrue(any((s["record"].get("raw_astrometry") or {}).get("parallax_mas") == 9.1148 for s in sources))
        self.assertTrue(any(s["record"].get("apparent_mag") == 4.773 for s in sources))
        self.assertIn("unresolved AB", a["notes"])

    def test_fixed_compositions_fractional_ages_and_minimum_masses_are_not_measurements(self):
        c = self.stars["msc-12349+2238-c"]
        self.assertEqual(c["temperature_k"], 4505.958)
        self.assertAlmostEqual(c["luminosity_solar"], .15436009)
        self.assertIsNone(c["mass_solar"])
        self.assertIsNone(c["age_gyr"])
        self.assertIsNone(self.stars["msc-03492+2403-aa2"]["metallicity_dex"])
        self.assertIsNone(self.stars["hip-17851"]["age_gyr"])
        self.assertIsNone(self.stars["hip-52419"]["age_gyr"])
        self.assertIsNone(self.stars["msc-10429-6423-aa2"]["mass_solar"])

    def test_atlas_uses_the_joint_orbital_distance_and_not_old_hipparcos(self):
        for identifier in ("hip-17847", "msc-03492+2403-aa2"):
            star = self.stars[identifier]
            self.assertAlmostEqual(math.hypot(*(star[k] for k in ("x_pc", "y_pc", "z_pc"))), 136.2, places=7)
            self.assertEqual(star["raw_astrometry"]["parallax_mas"], 7.34)
            self.assertEqual(star["raw_astrometry"]["radial_velocity_kms"], 8.41)
            self.assertEqual(star["raw_astrometry"]["pm_ra_error_masyr"], .44)

    def test_hd_74560_c_uses_its_bc_parent_and_keeps_its_rv_unknown(self):
        a, b, c = (self.stars[i] for i in ("hip-42726", "hip-42715", "msc-08424-5307-c"))
        self.assertEqual([c[k] for k in ("x_pc", "y_pc", "z_pc")], [b[k] for k in ("x_pc", "y_pc", "z_pc")])
        self.assertNotEqual(c["y_pc"], a["y_pc"])
        self.assertIsNone(c["raw_astrometry"]["radial_velocity_kms"])
        self.assertIsNone(c["vx_kms"])
        self.assertTrue(any((s["record"].get("raw_astrometry") or {}).get("ra_deg") == 130.605778 for s in c["catalog_sources"]))

    def test_systemic_orbits_are_scoped_to_inner_pairs_and_do_not_overwrite_wide_stars(self):
        a, ab = (self.stars[i] for i in ("hip-42504", "msc-08400-5303-ab"))
        self.assertEqual(a["raw_astrometry"]["radial_velocity_kms"], 14.5)
        self.assertEqual(ab["raw_astrometry"]["radial_velocity_kms"], 14.5)
        self.assertIn("published-subsystem-proxy", a["raw_astrometry"]["radial_velocity_ref"])
        self.assertEqual([a[k] for k in ("vx_kms", "vy_kms", "vz_kms")], [ab[k] for k in ("vx_kms", "vy_kms", "vz_kms")])
        self.assertEqual(self.stars["msc-08400-5303-b"]["raw_astrometry"]["radial_velocity_kms"], 15.824231)
        self.assertIn("individual wide B", self.stars["msc-08400-5303-b"]["raw_astrometry"]["radial_velocity_ref"])
        self.assertEqual(self.stars["hip-42715"]["raw_astrometry"]["radial_velocity_kms"], 14.365)
        self.assertIsNone(self.stars["msc-08424-5307-c"]["raw_astrometry"]["radial_velocity_kms"])

    def test_astrometry_rejects_drifted_component_measurements(self):
        review = json.loads((ROOT / "catalog-work/famous-cluster-stars/astrometry-review.json").read_text())
        baseline = json.loads((ROOT / "catalog-work/famous-cluster-stars/gap-baseline.json").read_text())["records"]
        pool = {i: copy.deepcopy(baseline[i]) for i in review["expectedInputs"]}
        pool["hip-61394"]["raw_astrometry"]["parallax_mas"] = 99
        with self.assertRaisesRegex(ValueError, "input drifted"):
            apply_cluster_astrometry(ROOT, self.payload["systems"], pool, {"componentRecords": {}})


if __name__ == "__main__":
    unittest.main()
