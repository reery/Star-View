import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("consolidation", Path(__file__).resolve().parents[1] / "audit-landmark-consolidation.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ConsolidationPreservationTests(unittest.TestCase):
    def test_changed_measurements_and_missing_uncertainties_are_rejected(self):
        old = {"mass_solar": 2, "raw_astrometry": {"parallax_error_mas": .2}}
        for new in [{"mass_solar": 3, "raw_astrometry": {"parallax_error_mas": .2}},
                    {"mass_solar": 2, "raw_astrometry": {"parallax_error_mas": None}}]:
            with self.assertRaises(AssertionError):
                audit.assert_preserved(old, new, "star")

    def test_source_notes_and_source_records_may_be_enriched(self):
        old = {"catalog_sources": [{"catalog_id": "cluster", "record": {"notes": "original", "mass_solar": 2}}]}
        new = {"catalog_sources": [{"catalog_id": "cluster", "record": {"notes": "original plus context", "mass_solar": 2}}, {"catalog_id": "extra"}]}
        audit.assert_preserved(old, new, "star")
        new["catalog_sources"][0]["record"]["mass_solar"] = 3
        with self.assertRaises(AssertionError):
            audit.assert_preserved(old, new, "star")


if __name__ == "__main__":
    unittest.main()
