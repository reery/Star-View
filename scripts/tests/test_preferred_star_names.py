"""Preferred names must retain the exact published component scope."""

import runpy
import unittest
from pathlib import Path

preferred = runpy.run_path(str(Path(__file__).resolve().parents[1] / "author-object-designations.py"))["preferred_stellar_designation"]


class PreferredStarNamesTests(unittest.TestCase):
    def test_readable_names_keep_component_labels(self):
        for source, aliases, expected in (
            ("BD+44 2051 A", ["GJ 412 A"], "GJ 412 A"),
            ("HD 173740", ["GJ 725 B"], "GJ 725 B"),
            ("HD 38B", ["GJ 4 A", "GJ 4 B"], "GJ 4 B"),
            ("eps Ind Ba", ["GJ 845 B", "GJ 845 C"], "Epsilon Indi Ba"),
            ("tau Cet", ["GJ 71"], "Tau Ceti"),
            ("HD 5133", ["GJ 42", "GJ 42.0"], "GJ 42"),
        ):
            with self.subTest(source=source):
                self.assertEqual(preferred(source, aliases), expected)

    def test_familiar_and_ambiguous_names_are_preserved(self):
        for source, aliases in (
            ("WX UMa", ["GJ 412 B"]),
            ("Sirius A", ["GJ 244 A"]),
            ("Luyten 726-8 A", ["GJ 65 A"]),
            ("HD 123 Ba", ["GJ 123 B"]),
            ("HD 123 Aa1", ["GJ 123 A"]),
            ("HD 123 AB", ["GJ 123 A", "GJ 123 B"]),
            ("HD 123", ["GJ 123 A", "GJ 123 B"]),
            ("HD 123", ["GJ 123", "GJ 456"]),
        ):
            with self.subTest(source=source):
                self.assertEqual(preferred(source, aliases), source)


if __name__ == "__main__":
    unittest.main()
