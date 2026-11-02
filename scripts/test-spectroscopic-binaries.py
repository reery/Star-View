"""Focused identity and scope regressions for the SB9 spectroscopic-binary import."""
import unittest
from pathlib import Path
from catalog_sources.spectroscopic_binaries import sb9_systems


SB9 = Path(__file__).resolve().parents[1] / 'catalog-work/star-systems/sb9-20240621'


class SpectroscopicBinaryScopes(unittest.TestCase):
    def systems(self, identity_ids, identities=None):
        return {system['sb9']: system for system in sb9_systems(SB9, identity_ids, identities or {})}

    def test_double_lined_orbit_is_matched_by_exact_hip(self):
        alphecca = self.systems({'HIP 76267': {'alphecca'}})['850']
        self.assertTrue(alphecca['doubleLined'])
        self.assertEqual(alphecca['spectra'], ['B9.5IV', 'G'])
        self.assertEqual(alphecca['catalogIds'], ['alphecca'])

    def test_single_lined_orbit_keeps_its_visual_component_scope(self):
        epsilon = self.systems({'HD 153751': {'eps-umi'}})['940']
        self.assertFalse(epsilon['doubleLined'])
        self.assertEqual(epsilon['component'], 'A')

    def test_misc_gliese_alias_matches_the_gj_designation(self):
        self.assertIn('3808', self.systems({'GJ 220': {'ross-59'}}))

    def test_one_object_in_two_sb9_scopes_is_ambiguous(self):
        systems = self.systems({'HIP 76267': {'shared'}, 'HD 153751': {'shared'}})
        self.assertFalse(systems['850']['uniqueIdentity'])
        self.assertFalse(systems['940']['uniqueIdentity'])

    def test_different_simbad_objects_are_ambiguous(self):
        system = self.systems({'HIP 76267': {'a'}, 'HD 139006': {'b'}},
                              {'a': {'simbadId': '* alf CrB'}, 'b': {'simbadId': '* alf CrB B'}})['850']
        self.assertFalse(system['uniqueIdentity'])

    def test_sky_position_alone_never_matches(self):
        self.assertEqual(self.systems({}), {})


if __name__ == '__main__':
    unittest.main()
