"""Focused checks for adopted shared details and component isolation."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources.shared_objects import adopt_shared_object


class SharedObjectTests(unittest.TestCase):
    def test_altair_adopts_full_class_and_object_parameters_preserving_identity(self):
        row = {"id": "10pc-0117", "name": "Altair", "spectral_type": "A7", "temperature_k": "7760", "notes": "source"}
        provenance = {"fields": {"spectral_type": {"status": "compiled", "sourceRefs": ["census"]}}}
        adopt_shared_object(row, provenance)
        self.assertEqual(row["spectral_type"], "A7Vn")
        self.assertEqual(row["temperature_k"], "7586")
        self.assertEqual(row["name"], "Altair")
        self.assertEqual(provenance["sourceFieldProvenance"]["spectral_type"]["sourceRefs"], ["census"])
        before = dict(row)
        adopt_shared_object(row, provenance)
        self.assertEqual(row, before)

    def test_procyon_primary_aliases_never_change_the_white_dwarf(self):
        for identifier in ("10pc-0031", "hip-37279", "bright-procyon"):
            row = {"id": identifier, "spectral_type": "F5IV-V+DQZ", "notes": "source"}
            adopt_shared_object(row)
            self.assertEqual(row["spectral_type"], "F5IV-V")
        companion = {"id": "10pc-0032", "spectral_type": "DQZ", "notes": "source"}
        before = dict(companion)
        adopt_shared_object(companion)
        self.assertEqual(companion["spectral_type"], "DQZ")
        self.assertEqual(companion, before)

    def test_display_name_does_not_authorize_an_identity_match(self):
        row = {"id": "unreviewed", "name": "Altair", "spectral_type": "", "notes": "source"}
        before = dict(row)
        adopt_shared_object(row)
        self.assertEqual(row, before)
