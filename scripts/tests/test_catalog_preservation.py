import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources import preservation


class CatalogPreservationTests(unittest.TestCase):
    def test_reports_lost_values_including_zero_and_negative_values(self):
        old = {"mass_solar": 7.7, "absolute_mag": -2.13, "metallicity_dex": 0,
               "radius_solar": None}
        self.assertEqual(preservation.lost_fields(old, {}),
                         ["mass_solar", "absolute_mag", "metallicity_dex"])

    def test_retained_source_scope_prevents_loss_without_assigning_to_component(self):
        source = {"luminosity_solar": 1609.358708, "radius_solar": 5.76435}
        component = {"luminosity_solar": None, "radius_solar": None}
        self.assertEqual(preservation.lost_fields(source, component, [source]), [])
        self.assertIsNone(component["luminosity_solar"])

    def test_checks_nested_uncertainties_and_classification_labels(self):
        old = {"raw_astrometry": {"parallax_mas": 9, "parallax_error_mas": 0.13},
               "subtypes": ["Variable star", "Main-sequence"]}
        new = {"raw_astrometry": {"parallax_mas": 9, "parallax_error_mas": None},
               "subtypes": ["Main-sequence"]}
        self.assertEqual(preservation.lost_fields(old, new),
                         ["raw_astrometry.parallax_error_mas", "subtypes"])
        self.assertEqual(preservation.lost_fields(old, new, [old]), [])

    def test_blocks_regeneration_that_drops_records_or_individual_fields(self):
        old = {"stars": [{"id": "a", "mass_solar": 7.7}, {"id": "b", "mass_solar": 1.1}]}
        new = {"stars": [{"id": "a", "mass_solar": None}]}
        self.assertEqual(preservation.pool_losses(old, new, []),
                         ["a: mass_solar", "b: missing component record"])

    def test_previous_source_errors_cannot_disappear_during_regeneration(self):
        star = {"id": "a", "catalog_sources": [{"catalog_id": "western", "record": {
            "id": "a", "raw_astrometry": {"parallax_mas": 9, "parallax_error_mas": 0.13}}}]}
        new = {"id": "a", "catalog_sources": [{"catalog_id": "western", "record": {
            "id": "a", "raw_astrometry": {"parallax_mas": 9, "parallax_error_mas": None}}}]}
        self.assertEqual(preservation.pool_losses({"stars": [star]}, {"stars": [new]}, []),
                         ["a: catalog_sources.western.raw_astrometry.parallax_error_mas"])


if __name__ == "__main__":
    unittest.main()
