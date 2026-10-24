import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from catalog_sources.companion_properties import apply_literature, complete_properties, property_coverage, reconcile_component_notes
from catalog_sources.enrichment import FIELDS


class CompanionPropertiesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source.dat"
        self.source.write_text("Frozen resolved component table\n")
        self.path = self.root / "review.json"
        self.star = {"id": "pair-b", "name": "Pair B", "type": "star",
                     "spectral_type": None, "notes": "", "apparent_mag": None,
                     "absolute_mag": None, "x_pc": 10, "y_pc": 0, "z_pc": 0,
                     **dict.fromkeys(FIELDS)}
        self.systems = [{"id": "pair", "components": [{"starId": "pair-b", "label": "B"}]}]
        self.review = {"expectedName": "Pair B", "systemId": "pair", "component": "B",
                       "note": "Individual B solution", "fields": {}}
        self.plan = {"inputSha256": {"source.dat": hashlib.sha256(self.source.read_bytes()).hexdigest()},
                     "objects": {"pair-b": self.review}}
        self.audit = {"componentRecords": {}}

    def observation(self, value, **extra):
        return {"value": value, "status": "measured", "reference": "resolved-paper",
                "sourceUrl": "https://example.org/paper", "section": "Table 2", **extra}

    def apply(self):
        self.path.write_text(json.dumps(self.plan))
        return apply_literature(self.root, self.path, self.systems, {"pair-b": self.star}, self.audit)

    def test_rejects_wrong_hierarchical_member_and_changed_source(self):
        self.review["component"] = "Ba"
        with self.assertRaisesRegex(ValueError, "identity drifted"):
            self.apply()
        self.review["component"] = "B"
        self.source.write_text("Changed source\n")
        with self.assertRaisesRegex(ValueError, "source drifted"):
            self.apply()

    def test_keeps_curated_mass_and_derives_radius_from_new_individual_inputs(self):
        self.star["mass_solar"] = 1.2
        self.review["fields"] = {"mass_solar": self.observation(2),
                                 "temperature_k": self.observation(5772),
                                 "luminosity_solar": self.observation(4)}
        self.apply()
        self.assertEqual(self.star["mass_solar"], 1.2)
        self.assertEqual(self.star["radius_solar"], 2)
        record = self.audit["componentRecords"]["pair-b"]
        self.assertEqual(record["radius_solar"]["inputs"], {"temperature_k": 5772, "luminosity_solar": 4})
        self.assertEqual(record["reviewedLiterature"]["retained"]["mass_solar"]["value"], 1.2)

    def test_zero_magnitude_and_negative_abundance_keep_quantity_and_source(self):
        self.review["fields"] = {"apparent_mag": self.observation(0),
                                 "metallicity_dex": self.observation(-.2, quantity="[Fe/H]")}
        self.apply()
        self.assertEqual(self.star["absolute_mag"], 0)
        self.assertEqual(self.star["metallicity_dex"], -.2)
        self.assertEqual(self.star["metallicity_kind"], "[Fe/H]")
        record = self.audit["componentRecords"]["pair-b"]["reviewedLiterature"]["adopted"]
        self.assertEqual(record["metallicity_dex"]["reference"], "resolved-paper")
        self.assertEqual(record["absolute_mag"]["inputs"]["distance_pc"], 10)

    def test_spectral_ranges_do_not_invent_scalar_temperatures(self):
        self.review["fields"] = {"spectral_type": self.observation("B1-3V")}
        self.apply()
        self.assertIsNone(self.star["temperature_k"])
        self.assertIsNone(self.star["radius_solar"])
        self.assertIn("temperature_k", property_coverage({"pair-b": self.star})["missingByComponent"]["pair-b"])

    def test_explicit_photometry_pair_replaces_blended_flux_coherently(self):
        self.star.update(apparent_mag=2, absolute_mag=2)
        self.review['fields'] = {
            'absolute_mag': self.observation(3,replaces={'value':2}),
            'apparent_mag': self.observation(3,replaces={'value':2}),
        }
        self.apply()
        self.assertEqual(self.star['apparent_mag'],3)
        self.assertEqual(self.star['absolute_mag'],3)

    def test_withholding_blended_abundance_retains_original_value_and_quantity(self):
        self.star.update(metallicity_dex=-1.4,metallicity_kind='[M/H]')
        self.review.update(retainPreviousRecord=True,withheldFields={
            'metallicity_dex':{'expectedPrevious':-1.4,'reason':'Unresolved Gaia atmosphere.'}})
        self.apply()
        self.assertIsNone(self.star['metallicity_dex'])
        self.assertIsNone(self.star['metallicity_kind'])
        original=self.star['catalog_sources'][0]['record']
        self.assertEqual(original['metallicity_dex'],-1.4)
        self.assertEqual(original['metallicity_kind'],'[M/H]')
        self.assertIn('Unresolved Gaia',self.audit['componentRecords']['pair-b']
            ['reviewedLiterature']['withheld']['metallicity_dex']['reason'])

    def test_withheld_derivation_has_no_value_or_misleading_note(self):
        self.star.update(spectral_type="G2V", notes="Withheld individual fields: temperature_k.")
        complete_properties(self.star, {})
        self.assertIsNone(self.star["temperature_k"])
        self.assertNotIn("Estimated temperature", self.star["notes"])
        self.star.update(temperature_k=5772, radius_solar=2,
                         notes="Withheld individual fields: luminosity_solar.")
        complete_properties(self.star, {})
        self.assertIsNone(self.star["luminosity_solar"])
        self.assertNotIn("derived by", self.star["notes"])

    def test_refuses_missing_provenance_or_unspecified_abundance_quantity(self):
        self.review["fields"] = {"mass_solar": {"value": 2}}
        with self.assertRaisesRegex(ValueError, "provenance"):
            self.apply()
        self.review["fields"] = {"metallicity_dex": self.observation(-.2)}
        with self.assertRaisesRegex(ValueError, "abundance quantity"):
            self.apply()

    def test_gaia_identity_must_identify_only_the_reviewed_leaf(self):
        self.review['gaiaDr3Id'] = '123'
        self.star['designations'] = ['Gaia DR3 999']
        with self.assertRaisesRegex(ValueError, 'unique component'):
            self.apply()
        self.star['designations'] = ['Gaia DR3 123']
        self.review['fields'] = {'mass_solar': self.observation(.2)}
        self.apply()
        self.assertEqual(self.star['mass_solar'], .2)
        other = {**self.star, 'id': 'pair-a'}
        self.path.write_text(json.dumps(self.plan))
        with self.assertRaisesRegex(ValueError, 'unique component'):
            apply_literature(self.root, self.path, self.systems,
                             {'pair-b': self.star, 'pair-a': other}, self.audit)

    def test_classification_correction_checks_and_retains_previous_value(self):
        self.star['spectral_type'] = 'M3'
        self.review['fields'] = {'spectral_type': self.observation('M3V', replaces={'value': 'M3'})}
        self.apply()
        self.assertEqual(self.star['spectral_type'], 'M3V')
        self.assertEqual(self.audit['componentRecords']['pair-b']['reviewedLiterature']['replaced']
                         ['spectral_type']['value'], 'M3')
        self.star['spectral_type'] = 'M4'
        with self.assertRaisesRegex(ValueError, 'replacement input drifted'):
            self.apply()

    def test_notes_are_superseded_only_when_individual_values_exist(self):
        statement = 'Component-resolved Johnson V not independently established; multi-star system V withheld.'
        self.star['notes'] = statement + ' Withheld individual fields: mass_solar, absolute_mag.'
        evidence = {}
        reconcile_component_notes(self.star, evidence)
        self.assertIn(statement, self.star['notes'])
        self.assertEqual(evidence, {})
        self.star['absolute_mag'] = 12
        reconcile_component_notes(self.star, evidence)
        self.assertNotIn(statement, self.star['notes'])
        self.assertIn('Withheld individual fields: mass_solar.', self.star['notes'])
        self.assertIsNone(self.star['mass_solar'])
        self.assertEqual(evidence['supersededNotes'][0]['text'], statement)

    def test_newer_adoption_retains_the_previous_measurement_and_its_uncertainty(self):
        self.review['fields'] = {'mass_solar': self.observation(1.2, uncertainty=.1)}
        self.apply()
        previous = self.audit['componentRecords']['pair-b']['reviewedLiterature'].copy()
        self.review['fields'] = {'mass_solar': self.observation(1.3, uncertainty=.02, replaces={'value': 1.2})}
        self.apply()
        evidence = self.audit['componentRecords']['pair-b']['reviewedLiterature']
        self.assertEqual(evidence['previousReview'], previous)
        self.assertEqual(evidence['replaced']['mass_solar']['value'], 1.2)
        self.assertEqual(evidence['replaced']['mass_solar']['sourceEvidence']['uncertainty'], .1)
        self.assertEqual(evidence['adopted']['mass_solar']['uncertainty'], .02)


if __name__ == "__main__":
    unittest.main()
