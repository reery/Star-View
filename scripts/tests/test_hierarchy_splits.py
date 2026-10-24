import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from catalog_sources.hierarchy_splits import apply_hierarchy_splits, FIELDS
from catalog_sources.preservation import pool_losses


class HierarchySplitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / "catalog-work/star-systems/reviewed-constellation-hierarchies.json"
        self.path.parent.mkdir(parents=True)
        self.source = self.root / "paper.json"
        self.source.write_text('{"binary": true}')
        self.parent = {**dict.fromkeys(FIELDS), "id": "c", "name": "System C", "type": "star",
            "temperature_k": 4000, "radius_solar": 1, "luminosity_solar": .2,
            "spectral_type": "M1V", "apparent_mag": 9, "absolute_mag": 8,
            "x_pc": 10, "y_pc": 0, "z_pc": 0, "epoch": 2000, "subtypes": ["Main-sequence"],
            "designations": ["Gaia DR3 123"], "notes": "Unresolved source.",
            "raw_astrometry": {"parallax_mas": 100, "parallax_error_mas": .1},
            "catalog_sources": [{"catalog_id": "original", "scope": "Old source",
                                 "record": {"id": "c", "temperature_k": 4100}}]}
        self.systems = [{"id": "system", "components": [{"starId": "c", "label": "C"}]}]
        self.pool = {"c": copy.deepcopy(self.parent)}
        self.audit = {"componentRecords": {"c": {"radius_solar": {"uncertainty": .02}}}}
        self.review = {"systemId": "system", "expectedComponents": {"c": "C"},
            "parentStarId": "c", "expectedParentName": "System C", "sourceScope": "Ca+Cb unresolved",
            "sourceUrl": "https://example.org/paper", "note": "Confirmed eclipsing pair.",
            "components": [
                {"starId": "c", "label": "Ca", "name": "System Ca", "designations": ["Ca"], "note": "Primary."},
                {"starId": "cb", "label": "Cb", "name": "System Cb", "designations": ["Cb"], "note": "Secondary."}]}

    def apply(self):
        self.path.write_text(json.dumps({"systems": [self.review], "inputSha256": {
            "paper.json": hashlib.sha256(b'{"binary": true}').hexdigest()}}))
        return apply_hierarchy_splits(self.root, self.systems, self.pool, self.audit)

    def test_preserves_aggregate_and_errors_without_assigning_them_to_either_child(self):
        self.apply()
        self.assertEqual([c["label"] for c in self.systems[0]["components"]], ["Ca", "Cb"])
        for star in self.pool.values():
            for field in FIELDS:
                self.assertIsNone(star[field])
            self.assertEqual(star["raw_astrometry"], self.parent["raw_astrometry"])
            self.assertEqual(star["unresolved_photometry"]["magnitude_v"], 9)
            self.assertIn("unresolved", star["unresolved_photometry"]["scope"])
            self.assertEqual(star["catalog_sources"][0], self.parent["catalog_sources"][0])
            self.assertEqual(star["catalog_sources"][1]["record"]["radius_solar"], 1)
            self.assertEqual(self.audit["componentRecords"][star["id"]]["retainedUnresolvedParent"]
                             ["evidence"]["radius_solar"]["uncertainty"], .02)
        self.assertEqual(pool_losses({"stars": [self.parent]}, {"stars": list(self.pool.values())}, []), [])
        self.assertNotIn("Gaia DR3 123", self.pool["cb"]["designations"])

    def test_refuses_membership_name_or_document_drift(self):
        self.review["expectedComponents"] = {"c": "Ca"}
        with self.assertRaisesRegex(ValueError, "membership drifted"):
            self.apply()
        self.review["expectedComponents"] = {"c": "C"}
        self.review["expectedParentName"] = "Another system"
        with self.assertRaisesRegex(ValueError, "parent drifted"):
            self.apply()
        self.review["expectedParentName"] = "System C"
        self.source.write_text('changed')
        with self.assertRaisesRegex(ValueError, "source drifted"):
            self.apply()


if __name__ == "__main__":
    unittest.main()
