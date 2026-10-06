import copy
import csv
import math
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from catalog_sources.component_enrichment import enrich_component


class ComponentEnrichmentTests(unittest.TestCase):
    def setUp(self):
        with (ROOT / "src/data/catalogs/nearest-1000/stars.csv").open() as handle:
            self.rows = {row["id"]: row for row in csv.DictReader(handle)}

    def test_keeps_curated_values_and_accepts_negative_visual_magnitude(self):
        row = copy.deepcopy(self.rows["cns5-0317"])
        row["absolute_mag"] = ""
        review = {"expectedName": row["name"], "note": "resolved test observation", "fields": {
            "mass_solar": {"value": 999, "status": "measured", "reference": "test"},
            "absolute_mag": {"value": -1.2, "status": "measured", "reference": "test"},
        }}
        provenance = {"fieldStatus": {"absolute_mag": "withheld-combined-record"}}
        with patch("catalog_sources.component_enrichment.component_plan", return_value={"objects": {row["id"]: review}}):
            enrich_component(row, provenance)
        self.assertEqual(row["mass_solar"], self.rows[row["id"]]["mass_solar"])
        self.assertEqual(float(row["absolute_mag"]), -1.2)
        self.assertEqual(provenance["reviewedComponentEnrichment"]["supersededFieldStatus"], {"absolute_mag": "withheld-combined-record"})

    def test_rejects_a_changed_exact_component_identity(self):
        row = copy.deepcopy(self.rows["cns5-1324"])
        with self.assertRaisesRegex(ValueError, "Gaia identity drifted"):
            enrich_component(row, {"gaiaDr3Id": "different-source"})

    def test_systemic_motion_is_explicit_and_does_not_invent_an_error(self):
        row = copy.deepcopy(self.rows["mu-cassiopeiae-b"])
        for field in ["vx_kms", "vy_kms", "vz_kms", "radial_velocity_kms", "radial_velocity_error_kms"]:
            row[field] = ""
        provenance = {"fieldStatus": {}}
        enrich_component(row, provenance)
        self.assertEqual(float(row["radial_velocity_kms"]), -97)
        self.assertEqual(row["radial_velocity_error_kms"], "")
        self.assertTrue(all(math.isfinite(float(row[field])) for field in ["vx_kms", "vy_kms", "vz_kms"]))
        self.assertEqual(provenance["radialVelocity"]["status"], "systemic-approximation")
        self.assertIn("without individual orbital velocity", provenance["astrometryScope"])

    def test_unreviewed_component_cannot_receive_parent_physical_fields(self):
        row = copy.deepcopy(self.rows["hd-50281-bb"])
        before = dict(row)
        enrich_component(row, {})
        self.assertEqual(row, before)

    def test_explicit_correction_checks_old_value_and_preserves_its_source(self):
        row = copy.deepcopy(self.rows["cns5-0238"])
        row.update(metallicity_dex="-0.1798", metallicity_kind="[Fe/H]", temperature_k="5921")
        prior = {"value": -0.1798, "reference": "old-source"}
        provenance = {"gaiaDr3Id": "425040000962497792", "fieldStatus": {},
                      "sharedPhysicalEnrichment": {"metallicity_dex": prior}}
        enrich_component(row, provenance)
        self.assertEqual(float(row["metallicity_dex"]), -0.305)
        self.assertEqual(row["metallicity_kind"], "[Fe/H]")
        self.assertEqual(row["temperature_k"], "4011")
        self.assertEqual(provenance["reviewedComponentEnrichment"]["replaced"]["metallicity_dex"]["observation"], prior)
        self.assertNotIn("metallicity_dex", provenance["sharedPhysicalEnrichment"])

    def test_correction_refuses_changed_values_or_abundance_quantities(self):
        for value, kind in [("-0.5", "[M/H]"), ("-0.972", "[Fe/H]")]:
            row = copy.deepcopy(self.rows["cns5-0239"])
            row.update(metallicity_dex=value, metallicity_kind=kind)
            with self.assertRaisesRegex(ValueError, "replacement .* drifted"):
                enrich_component(row, {"gaiaDr3Id": "425040000962559616"})


if __name__ == "__main__":
    unittest.main()
