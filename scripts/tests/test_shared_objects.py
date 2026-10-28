"""Focused checks for adopted shared details and component isolation."""
import csv
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources.shared_objects import adopt_shared_object


class SharedObjectTests(unittest.TestCase):
    def test_delta_pav_catalogs_follow_published_iron_quantity_and_error_columns(self):
        root = Path(__file__).resolve().parents[2]
        work = root / "catalog-work/shared-enrichment"
        published = next(line.split() for line in (work / "delta-pav-2025-table1.txt").read_text().splitlines()
                         if line.split() and line.split()[0] == "99240")
        review = json.loads((work / "delta-pav-review.json").read_text())
        fields = review["adoptedFields"]
        # The machine-readable paper defines lower then upper age errors.
        # Swapping these reproduces the Wikipedia transcription error.
        self.assertEqual(fields["age_gyr"]["uncertainty"],
                         {"lower": float(published[11]), "upper": float(published[12])})
        for catalog, identifier in [("nearest-1000", "cns5-4994"),
                                    ("western-constellation-stars", "hip-99240")]:
            with self.subTest(catalog=catalog):
                path = root / "src/data/catalogs" / catalog / "stars.csv"
                with path.open() as handle:
                    row = next(row for row in csv.DictReader(handle) if row["id"] == identifier)
                self.assertEqual(row["metallicity_kind"], "[Fe/H]")
                for field, column in [("mass_solar", 7), ("metallicity_dex", 5), ("age_gyr", 10)]:
                    self.assertEqual(float(row[field]), float(published[column]))
                before = review["previousCatalogRecords"][f"{catalog}:{identifier}"]["row"]
                for field, value in before.items():
                    if field not in {*fields, "metallicity_kind", "notes"}:
                        self.assertEqual(row[field], value, field)

    def test_hot_star_corrections_replace_bad_models_and_preserve_other_fields(self):
        review = json.loads((Path(__file__).resolve().parents[2] / "catalog-work/shared-enrichment/hot-star-temperature-review.json").read_text())
        self.assertEqual(len(review["objects"]), 71)
        for key, record in review["objects"].items():
            for identifier in record["starIds"]:
                with self.subTest(identity=key, identifier=identifier):
                    row = {"id": identifier, "name": "catalog display name", "spectral_type": record["spectralType"],
                           "mass_solar": "19.61", "metallicity_dex": "-0.2", "notes": "old model",
                           **record["previousValues"][identifier]}
                    provenance = {"physicalObservations": [{"field": "temperature_k", "value": float(row["temperature_k"])}]}
                    adopt_shared_object(row, provenance)
                    for field, decision in record["adoptedFields"].items():
                        if decision["status"] == "withheld":
                            self.assertEqual(row[field], "")
                        else:
                            self.assertEqual(float(row[field]), decision["value"])
                    self.assertEqual(row["name"], "catalog display name")
                    self.assertEqual(row["spectral_type"], record["spectralType"])
                    self.assertEqual(row["mass_solar"], "19.61")
                    self.assertEqual(row["metallicity_dex"], "-0.2")
                    self.assertEqual(provenance["physicalObservations"][0]["value"], float(record["previousValues"][identifier]["temperature_k"]))
                    self.assertEqual(provenance["sharedObjectAdoption"]["sourceSelections"]["physicalTemperatureReview"]["recordId"], key)
                    before = dict(row)
                    adopt_shared_object(row, provenance)
                    self.assertEqual(row, before)

    def test_literature_conflicts_adopt_verified_values_and_withhold_the_rest(self):
        review = json.loads((Path(__file__).resolve().parents[2] / "catalog-work/shared-enrichment/literature-conflict-review.json").read_text())
        self.assertEqual(len(review["objects"]), 13)
        for key, record in review["objects"].items():
            for identifier in record["starIds"]:
                with self.subTest(identity=key, identifier=identifier):
                    row = {"id": identifier, "name": "catalog display name", "notes": "old", **record["previousValues"][identifier]}
                    adopt_shared_object(row)
                    for field, decision in record["adoptedFields"].items():
                        if decision["status"] == "withheld":
                            self.assertEqual(row[field], "")
                        else:
                            self.assertEqual(float(row[field]), decision["value"])
                    self.assertEqual(row["name"], "catalog display name")

    def test_contradicted_spectral_type_is_withheld_without_a_replacement(self):
        row = {"id": "cns5-2243", "name": "UPM J0901-6526", "spectral_type": "K5", "temperature_k": "3043", "notes": "source"}
        adopt_shared_object(row)
        self.assertEqual(row["spectral_type"], "")
        self.assertEqual(row["temperature_k"], "3043")

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
