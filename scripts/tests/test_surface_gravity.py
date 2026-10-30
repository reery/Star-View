import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("author_surface_gravity", ROOT / "scripts/author-surface-gravity.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)


class SurfaceGravityTests(unittest.TestCase):
    def test_bounds_follow_luminosity_class_and_dwarf_letter(self):
        self.assertEqual(author.bounds({"type": "star", "spectral_type": "K1.5III"}), (-.5, 3.9))
        self.assertEqual(author.bounds({"type": "star", "spectral_type": "G2V"}), (3.5, 5.6))
        self.assertEqual(author.bounds({"type": "star", "spectral_type": "M4.0V"}), (4.4, 5.6))
        # Without a class, a star fainter than the Sun is held to the dwarf range.
        self.assertEqual(author.bounds({"type": "star", "spectral_type": "M3", "luminosity_solar": "0.01"}), (4.4, 5.6))
        self.assertEqual(author.bounds({"type": "star", "spectral_type": "K0", "luminosity_solar": "60"}), (-1, 6.5))
        self.assertEqual(author.bounds({"type": "white_dwarf", "spectral_type": "DA2"}), (6, 10))
        # Late-M objects typed as brown dwarfs keep the M floor unless flagged as low gravity.
        self.assertEqual(author.bounds({"type": "brown_dwarf", "spectral_type": "M6V"}), (4.4, 6))
        self.assertEqual(author.bounds({"type": "brown_dwarf", "spectral_type": "L2beta"}), (2.5, 6))

    def test_assumed_constants_are_not_measurements(self):
        assumed = [{"bibcode": "1990ApJ...351..467B", "log_g": "4.5"} for _ in range(15)]
        measured = [{"bibcode": "2020A&A...640A...1X", "log_g": str(4 + index / 10)} for index in range(15)]
        self.assertEqual(author.assumed_sources({"a": assumed, "b": measured}), {"1990ApJ...351..467B"})

    def test_shipped_values_keep_components_apart_and_duplicates_together(self):
        objects = json.loads(author.OUTPUT.read_text())["objects"]
        # Arcturus is one star in two catalogs; Epsilon Indi Ba and Bb share one SIMBAD record.
        self.assertEqual(objects["cns5-3517"], objects["hip-69673"])
        self.assertNotIn("10pc-0042", objects)
        self.assertNotIn("10pc-0043", objects)
        self.assertTrue(all(-1 <= entry["log_g"] <= 10 and entry["measurements"] >= 1 for entry in objects.values()))


if __name__ == "__main__":
    unittest.main()
