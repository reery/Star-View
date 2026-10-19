"""Regress platform-math noise in the Python checks used by production builds."""

import math
import copy
import runpy
import sys
import unittest
from contextlib import ExitStack, contextmanager
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from catalog_sources.precision import calculated_float
from catalog_sources.preservation import retain_frozen_source


@contextmanager
def adjacent_math_results(direction):
    """Model libm implementations returning adjacent representable results."""
    with ExitStack() as stack:
        for name in ("log10", "hypot", "sqrt", "sin", "cos", "atan2", "asin"):
            original = getattr(math, name)
            stack.enter_context(patch.object(
                math, name,
                lambda *args, _fn=original: math.nextafter(_fn(*args), direction),
            ))
        yield


class CalculatedPrecisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.companions = runpy.run_path(str(ROOT / "scripts/author-stellar-companions.py"))
        cls.charts = runpy.run_path(str(ROOT / "scripts/author-constellations.py"))

    def test_storage_precision_and_finite_values(self):
        self.assertEqual(calculated_float(1.234567890123), 1.23456789)
        self.assertEqual(str(calculated_float(-1e-12)), "0.0")
        for value in (math.nan, math.inf, -math.inf):
            with self.subTest(value=value), self.assertRaises(ValueError):
                calculated_float(value)

    def test_frozen_sources_retain_original_precision_without_duplicates(self):
        frozen = {"catalog_id": "original", "scope": "Original component", "record": {
            "id": "a", "absolute_mag": 0.9113072540243858,
            "raw_astrometry": {"parallax_mas": 9.123456789123, "parallax_error_mas": .013}}}
        rounded = copy.deepcopy(frozen)
        rounded["record"]["absolute_mag"] = calculated_float(frozen["record"]["absolute_mag"])
        sources = [rounded]
        retain_frozen_source(sources, frozen)
        self.assertEqual(sources, [frozen])
        self.assertIsNot(sources[0], frozen)
        # Different actual observations or meaningful magnitude changes must
        # remain separate snapshots, rather than being silently discarded.
        for field, value in (("absolute_mag", .911308), ("raw_astrometry", {"parallax_mas": 9.123456789124})):
            different = copy.deepcopy(frozen)
            different["record"][field] = value
            sources = [different]
            retain_frozen_source(sources, frozen)
            self.assertEqual(sources, [different, frozen])

    def test_companions_and_audit_survive_adjacent_math_results(self):
        expected = self.companions["build"]()
        for direction in (math.inf, -math.inf):
            with self.subTest(direction=direction), adjacent_math_results(direction):
                self.assertEqual(self.companions["build"](), expected)

    def test_all_chart_bytes_survive_adjacent_math_results(self):
        names = [figure["iau"] for figure in self.charts["figure_inputs"]()[1]["constellations"]]
        self.assertEqual(len(names), 88)
        expected = {name: self.charts["author"](name) for name in names}
        for direction in (math.inf, -math.inf):
            with adjacent_math_results(direction):
                # Recalculate boundary ordering too, rather than reusing the
                # unperturbed cached trigonometry from the baseline.
                self.charts["boundary_inputs"].cache_clear()
                for name in names:
                    with self.subTest(direction=direction, constellation=name):
                        self.assertEqual(self.charts["author"](name), expected[name])
            self.charts["boundary_inputs"].cache_clear()

    def test_replacement_guards_still_reject_material_drift(self):
        original = math.log10
        with patch.object(math, "log10", lambda value: original(value) + 1e-4):
            with self.assertRaisesRegex(ValueError, "replacement input drifted"):
                self.companions["build"]()


if __name__ == "__main__":
    unittest.main()
