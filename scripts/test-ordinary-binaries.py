"""Focused source-scope regressions for the ordinary-binary import."""
import unittest
from pathlib import Path
from catalog_sources.ordinary_binaries import orbit_pairs, matching_members


LINES = (Path(__file__).resolve().parents[1] / 'catalog-work/star-systems/orb6-20261009.txt').read_text().splitlines()


class OrdinaryBinaryScopes(unittest.TestCase):
    def source_pair(self, wds, designation, identity):
        line = next(line for line in LINES if line[19:29] == wds and line[30:44].strip() == designation)
        return orbit_pairs({}, {identity: {'example'}}, [line])[0]

    def test_compound_source_scope_is_not_truncated_or_authored_as_two_stars(self):
        pair = self.source_pair('07346+3153', 'STF1110AB,C', 'WDS J07346+3153AB')
        self.assertEqual(pair['labels'], ['AB', 'C'])
        self.assertEqual(pair['decision'], 'withheld-compound-scope')

    def test_astrometric_fit_does_not_establish_a_detected_stellar_pair(self):
        pair = self.source_pair('11538+5342', 'gam UMa', 'WDS J11538+5342A')
        self.assertEqual(pair['grade'], '9')
        self.assertEqual(pair['decision'], 'withheld-astrometric-or-nonvisual')

    def test_only_the_matching_theta_tauri_branch_receives_an_orbit(self):
        pair = self.source_pair('04287+1552', 'MKT  13Aa,Ab', 'WDS J04287+1552A')
        pair['catalogIds'] = ['theta1', 'theta2']
        stars = {'theta1': {'designations': ['WDS J04287+1552B']},
                 'theta2': {'designations': ['WDS J04287+1552A']}}
        self.assertEqual(matching_members(pair, stars), {'Aa': ['theta2']})

    def test_an_orbit_of_bc_does_not_attach_unconnected_a(self):
        pair = self.source_pair('03019-1633', 'RST2292BC', 'WDS J03019-1633A')
        self.assertEqual(matching_members(pair, {'example': {'designations': ['WDS J03019-1633A']}}), {})

    def test_exact_hip_can_link_a_detected_pair_when_wds_aliases_differ(self):
        pair = self.source_pair('06377+1624', 'OCC9011Aa,Ab', 'HIP 31681')
        self.assertEqual(pair['decision'], 'detected-visual-pair')
        self.assertEqual(matching_members(pair, {'example': {'designations': ['HIP 31681']}}), {'Aa': ['example']})


if __name__ == '__main__':
    unittest.main()
