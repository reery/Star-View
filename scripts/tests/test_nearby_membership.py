"""Exact-identity membership decisions and historical source preservation."""
import csv
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("nearest1000_membership", ROOT / "scripts/author-nearest1000.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class NearbyMembershipTests(unittest.TestCase):
    def test_retained_snapshots_match_frozen_sources_including_photometry_and_errors(self):
        review = json.loads(builder.MEMBERSHIP_EXCLUSIONS.read_text())["objects"][0]
        sources = review["sourceSnapshots"]
        self.assertEqual(sources["cns5"]["rawLine"], next(
            line for line in (ROOT / sources["cns5"]["path"]).read_text().splitlines()
            if line[:4].strip() == review["cns5Id"]))
        for source, key, identity in [("gaia", "source_id", review["gaiaDr3Id"]),
                                      ("simbad", "main_id", review["simbadId"])]:
            with (ROOT / sources[source]["path"]).open() as handle:
                row = next(row for row in csv.DictReader(handle) if row[key] == identity)
            self.assertEqual(sources[source]["record"], row)
        self.assertEqual(review["previousProvenance"]["gaiaDr3Id"], review["gaiaDr3Id"])
        self.assertEqual(sources["nearest100Candidate"]["Gmag"], "20.435377")
        self.assertIsNone(sources["nearest100Candidate"]["SpType"])

    def test_identity_drift_cannot_exclude_an_unreviewed_source(self):
        for field in ["gaiaDr3Id", "simbadId", "id", "cns5Id"]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                review = json.loads(builder.MEMBERSHIP_EXCLUSIONS.read_text())
                review["objects"][0][field] = "wrong-identity"
                path = Path(directory) / "review.json"
                path.write_text(json.dumps(review))
                with patch.object(builder, "MEMBERSHIP_EXCLUSIONS", path):
                    with self.assertRaisesRegex(ValueError, "exclusion.*(identity drifted|not all applied)"):
                        builder.build_package()


if __name__ == "__main__":
    unittest.main()
