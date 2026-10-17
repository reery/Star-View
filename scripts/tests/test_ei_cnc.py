"""Keep EI Cnc component estimates scoped, reproducible and non-destructive."""

import csv
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class EiCncTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = json.loads((ROOT / "catalog-work/shared-enrichment/ei-cnc-review.json").read_text())
        cls.overrides = {r["starViewId"]: r for r in json.loads(
            (ROOT / "catalog-work/nearest-100/physical-overrides.json").read_text())["records"]}
        cls.pool = {r["id"]: r for r in json.loads((ROOT / "src/data/stellar-companions.json").read_text())["stars"]}

    def test_nearby_catalogs_retain_component_measurements_and_uncertainties(self):
        for catalog, previous in self.review["previousCatalogs"].items():
            folder = ROOT / "src/data/catalogs" / catalog
            with (folder / "stars.csv").open() as handle:
                rows = {r["id"]: r for r in csv.DictReader(handle)}
            provenance = {r["id"]: r for r in json.loads((folder / "provenance.json").read_text())["objects"]}
            for identifier, adopted in self.review["adopted"].items():
                with self.subTest(catalog=catalog, component=identifier):
                    row = rows[identifier]
                    self.assertEqual(row["name"], adopted["expectedName"])
                    source_provenance = provenance[identifier]
                    if catalog == "nearest-1000":
                        self.assertEqual(source_provenance["status"], "higher-curation nearest-100 override")
                        primary = json.loads((ROOT / "src/data/catalogs/nearest-100/provenance.json").read_text())
                        source_provenance = next(r for r in primary["objects"] if r["id"] == identifier)
                    observations = source_provenance["reviewedPhysical"]["observations"]
                    for observation in adopted["physical"]:
                        field = observation["field"]
                        self.assertEqual(float(row[field]), observation["value"])
                        actual = next(item for item in observations if item["field"] == field)
                        self.assertEqual(actual["uncertainty"], observation["uncertainty"])
                        self.assertEqual(actual["status"], "estimated")
                    self.assertAlmostEqual(float(row["luminosity_solar"]),
                                           float(row["radius_solar"]) ** 2 * (2680 / 5772) ** 4, places=12)
                    self.assertEqual(source_provenance["fields"]["luminosity_solar"]["status"], "derived")
                    for field, value in previous[identifier]["record"].items():
                        if field not in {"mass_solar", "radius_solar", "luminosity_solar", "notes"}:
                            self.assertEqual(row[field], value, field)
                    for field, value in previous[identifier]["provenance"].get("fields", {}).items():
                        if field not in {"mass_solar", "radius_solar", "luminosity_solar"}:
                            self.assertEqual(provenance[identifier]["fields"][field], value, field)

    def test_effective_components_keep_photometry_motion_and_other_physical_data(self):
        for identifier, previous in self.review["previousEffectiveComponents"].items():
            star = self.pool[identifier]
            for field, value in previous.items():
                if field not in {"mass_solar", "radius_solar", "luminosity_solar", "notes"}:
                    self.assertEqual(star[field], value, field)
            for observation in self.review["adopted"][identifier]["physical"]:
                self.assertEqual(star[observation["field"]], observation["value"])
            self.assertAlmostEqual(star["luminosity_solar"], star["radius_solar"] ** 2 * (2680 / 5772) ** 4, places=12)
            self.assertIn("generic M7 class temperature", star["notes"])

    def test_exact_identity_and_superseded_sources_remain_in_review(self):
        for identifier, adopted in self.review["adopted"].items():
            override = self.overrides[identifier]
            self.assertEqual(override["gaiaDr3Id"], adopted["gaiaDr3Id"])
            self.assertEqual(override["expectedName"], adopted["expectedName"])
            self.assertEqual(override["physical"], adopted["physical"])
        self.assertEqual(self.review["previousEffectiveComponents"]["10pc-0114"]["mass_solar"], 0.1112)
        self.assertEqual(len(self.review["retainedCifuentesAlternatives"]), 2)


if __name__ == "__main__":
    unittest.main()
