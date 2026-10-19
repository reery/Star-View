"""Shared propagation must not erase native component observations."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from catalog_sources.constellation_motion import PLAN, apply_constellation_motion, motion_input
from catalog_sources.bright_system_motion import bulk_vector


class ConstellationMotionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.raw = dict(ra_deg=113.65, dec_deg=31.8886, parallax_mas=66.356,
            pm_ra_cosdec_masyr=-175.88, pm_dec_masyr=-99.28, epoch=2000,
            parallax_error_mas=.041, pm_ra_error_masyr=.2, pm_dec_error_masyr=.3,
            radial_velocity_kms=2, radial_velocity_error_kms=.1,
            astrometry_ref='native source', radial_velocity_ref='native RV')
        self.pool = {id: dict(id=id, name='Pair '+id, raw_astrometry=copy.deepcopy(self.raw),
            notes='Original observation.', x_pc=3, y_pc=4, z_pc=5,
            vx_kms=1, vy_kms=2, vz_kms=3) for id in ['a','b','c']}
        self.pool['b']['raw_astrometry'].update(pm_ra_cosdec_masyr=12, radial_velocity_kms=30)
        self.pool['b'].update(vx_kms=9, vy_kms=8, vz_kms=7)
        self.systems = [dict(id='pair', name='Pair', components=[dict(starId=id,label=id.upper()) for id in self.pool])]
        self.review = dict(systemId='pair', expectedName='Pair', primaryStarId='a',
            expectedComponents={id:id.upper() for id in self.pool},
            expectedInputs={id:motion_input(star) for id,star in self.pool.items() if id!='c'},
            excludedComponents={'c':'Wide independently measured motion retained.'},
            motionInputs=self.raw, radialVelocity=dict(valueKms=2.057,uncertaintyKms=.084,
                uncertaintyKind='1-sigma',status='published-systemic',reference='Published gamma',
                sourceUrl='https://example.org/paper',scope='System barycentric measurement.'),
            scope='Approximate common motion; no individual orbital velocities.')
        self.plan = dict(inputSha256={},systems=[self.review],policy='Explicit membership only')
        self.audit = {'componentRecords':{}}

    def apply(self):
        path=self.root/PLAN
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(self.plan))
        apply_constellation_motion(self.root,self.systems,self.pool,self.audit)

    def test_uses_common_cartesian_vector_despite_different_native_proper_motions(self):
        before=copy.deepcopy(self.pool)
        self.apply()
        for id in ['a','b']:
            star=self.pool[id]
            self.assertEqual([star[k] for k in ['vx_kms','vy_kms','vz_kms']],bulk_vector(self.raw,2.057))
            for field in ['x_pc','y_pc','z_pc']:
                self.assertEqual(star[field],before[id][field])
            for key,value in before[id]['raw_astrometry'].items():
                if not key.startswith('radial_velocity'):
                    self.assertEqual(star['raw_astrometry'][key],value)
            self.assertEqual(star['catalog_sources'][0]['record'],before[id])
        self.assertEqual(self.pool['c'],before['c'])

    def test_retains_numerical_interval_without_inventing_a_one_sigma_error(self):
        rv=self.review['radialVelocity']
        rv.update(uncertaintyKms=None,uncertaintyKind='95-percent-HDPI',lowerKms=1.8,upperKms=2.3)
        self.apply()
        self.assertIsNone(self.pool['b']['raw_astrometry']['radial_velocity_error_kms'])
        self.assertEqual(self.audit['componentRecords']['b']['constellationSystemMotion']['radialVelocity'],rv)

    def test_restores_missing_astrometry_only_from_explicit_approximate_basis(self):
        self.pool['b']['raw_astrometry']=None
        self.review['expectedInputs']['b']=motion_input(self.pool['b'])
        self.apply()
        self.assertIn('shared primary astrometry approximation',self.pool['b']['raw_astrometry']['astrometry_ref'])
        self.assertIsNone(self.pool['b']['catalog_sources'][0]['record']['raw_astrometry'])

    def test_rejects_new_members_and_changed_component_observations(self):
        self.systems[0]['components'][1]['label']='Ba'
        with self.assertRaisesRegex(ValueError,'membership drifted'):self.apply()
        self.systems[0]['components'][1]['label']='B'
        self.pool['a']['raw_astrometry']['pm_ra_cosdec_masyr']=3
        with self.assertRaisesRegex(ValueError,'input drifted'):self.apply()

    def test_rejects_confidence_interval_mislabeled_as_scalar_error(self):
        self.review['radialVelocity']['uncertaintyKind']='95-percent-HDPI'
        with self.assertRaisesRegex(ValueError,'uncertainty'):self.apply()


if __name__=='__main__':unittest.main()
