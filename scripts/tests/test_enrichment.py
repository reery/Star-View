"""Focused checks for cross-catalog physical enrichment."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources.enrichment import FIELDS, derive_physical, enrich_from_frozen, estimate_temperature, select_spectroscopy


def empty_row(**values):
    return {"id": "unmatched", "type": "star", "spectral_type": "", "notes": "",
            "x_pc": "1", "y_pc": "0", "z_pc": "0", **dict.fromkeys(FIELDS, ""), **values}


class EnrichmentTests(unittest.TestCase):
    def test_rho_per_fills_missing_fields_with_source_inputs_and_preserves_spectroscopy(self):
        row = empty_row(id="hip-14354", spectral_type="M4+IIIa", temperature_k="3619", metallicity_dex="-0.4384")
        adopted = enrich_from_frozen(row, "* rho Per", ["HIP 14354", "HD 19058"])
        self.assertEqual(set(adopted), {"mass_solar", "luminosity_solar", "radius_solar"})
        self.assertEqual(row["temperature_k"], "3619")
        self.assertEqual(row["metallicity_dex"], "-0.4384")
        self.assertEqual(row["age_gyr"], "")
        self.assertEqual(float(row["mass_solar"]), 1.9)
        self.assertEqual(adopted["mass_solar"]["uncertainty"], .7)
        self.assertEqual(adopted["mass_solar"]["status"], "derived")
        self.assertAlmostEqual(float(row["luminosity_solar"]), 10 ** 3.43, places=6)
        error = adopted["luminosity_solar"]["uncertainty"]
        self.assertAlmostEqual(error["lower"], 10 ** 3.43 - 10 ** 3.40, places=5)
        self.assertAlmostEqual(error["upper"], 10 ** 3.46 - 10 ** 3.43, places=5)
        self.assertEqual(float(row["radius_solar"]), 143)
        self.assertEqual(adopted["radius_solar"]["inputs"]["temperature_k"], 3479)
        self.assertIn("Rho Persei (Gorgonea Tertia)", row["notes"])
        self.assertNotIn("Mu Cas", row["notes"])
        self.assertEqual(enrich_from_frozen(row, "* rho Per"), {})

    def test_mu_cas_uses_reviewed_primary_parameters_and_retains_caveats(self):
        row = empty_row(id="cns5-0317", spectral_type="G5Vb")
        adopted = enrich_from_frozen(row, "* mu. Cas")
        self.assertEqual(set(adopted), set(FIELDS))
        self.assertEqual(float(row["mass_solar"]), .7440)
        self.assertEqual(adopted["mass_solar"]["component"], "A")
        self.assertEqual(adopted["mass_solar"]["uncertainty"], .0122)
        self.assertEqual(adopted["age_gyr"]["status"], "model-derived")
        self.assertIn("angular diameter", row["notes"])
        # An exact companion ID never inherits the system/primary override.
        companion = empty_row()
        self.assertEqual(enrich_from_frozen(companion, "* mu. Cas B"), {})

    def test_spectroscopic_conflicts_and_sentinels_are_withheld(self):
        def observation(value, year):
            return {"fe_h": str(value), "bibcode": f"{year}A&A...123..456A", "mespos": "1"}
        self.assertIsNone(select_spectroscopy([observation(-9.99, 2024)], "fe_h"))
        self.assertIsNone(select_spectroscopy([observation(-1, 2020), observation(0, 2024)], "fe_h"))
        values = [observation(-.1, 2010), observation(-.12, 2015), observation(-.09, 2020), observation(1, 2025)]
        self.assertEqual(select_spectroscopy(values, "fe_h")["bibcode"][:4], "2020")

    def test_unknown_identity_does_not_match_a_nearby_star(self):
        row = empty_row(name="Procyon", ra_deg="114.825497908", dec_deg="5.224987557")
        self.assertEqual(enrich_from_frozen(row), {})
        self.assertFalse(any(row[field] for field in FIELDS))

    def test_unresolved_procyon_does_not_receive_single_star_model_mass(self):
        row = empty_row()
        adopted = enrich_from_frozen(row, "* alf CMi")
        self.assertEqual(row["mass_solar"], "")
        self.assertEqual(row["radius_solar"], "")
        self.assertEqual(adopted["metallicity_dex"]["reference"], "2002ApJ...567..544A")

    def test_existing_component_fields_are_preserved(self):
        row = empty_row(id="10pc-0031", temperature_k="6591", mass_solar="1.478", radius_solar="2.019", luminosity_solar="6.9")
        before = dict(row)
        enrich_from_frozen(row)
        for field in ("temperature_k", "mass_solar", "radius_solar", "luminosity_solar"):
            self.assertEqual(row[field], before[field])

    def test_published_diameter_precedes_evolutionary_model_radius(self):
        row = empty_row(temperature_k="7760")
        adopted = enrich_from_frozen(row, "* alf Aql")
        self.assertAlmostEqual(float(row["radius_solar"]), 2530000 / 1391400)
        self.assertEqual(adopted["radius_solar"]["reference"], "2018AJ....155...30B")

    def test_derived_luminosity_retains_small_nonzero_values_and_inputs(self):
        row = empty_row(type="white_dwarf", temperature_k="7740", radius_solar="0.01232")
        adopted = derive_physical(row)["luminosity_solar"]
        self.assertGreater(float(row["luminosity_solar"]), 0)
        self.assertEqual(adopted["status"], "derived")
        self.assertEqual(adopted["inputs"], {"temperature_k": 7740, "radius_solar": .01232})
        self.assertEqual(derive_physical(row), {})

    def test_class_temperatures_require_an_unambiguous_dwarf_subtype(self):
        for spectrum in ("F5IV-V", "M3III", "M?", "sdM3", "L5pec", "T9:", "G2V+M3V"):
            row = empty_row(spectral_type=spectrum)
            self.assertEqual(estimate_temperature(row), {})
        row = empty_row(spectral_type="M3.2V")
        adopted = estimate_temperature(row)["temperature_k"]
        self.assertEqual(row["temperature_k"], "3366")
        self.assertEqual(adopted["status"], "estimated")
        self.assertIn("not an object-specific measurement", row["notes"])

    def test_brown_dwarf_estimates_are_not_applied_to_white_dwarfs(self):
        brown = empty_row(type="brown_dwarf", spectral_type="T8")
        self.assertEqual(estimate_temperature(brown)["temperature_k"]["value"], 680)
        white = empty_row(type="white_dwarf", spectral_type="DA2")
        self.assertEqual(estimate_temperature(white), {})


if __name__ == "__main__":
    unittest.main()
