"""Focused validation of reviewed bulk RVs and component/source preservation."""
import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

import astropy.units as u
from astropy.coordinates import SkyCoord

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from catalog_sources.bright_system_motion import PLAN, apply_bright_system_motion, bulk_vector


class BrightSystemMotionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.raw = dict(ra_deg=113.65, dec_deg=31.8886, parallax_mas=66.356,
                        pm_ra_cosdec_masyr=-175.88, pm_dec_masyr=-99.28,
                        parallax_error_mas=.041, radial_velocity_kms=None,
                        radial_velocity_error_kms=None, epoch=2000,
                        astrometry_ref='native astrometry')
        self.systems = [dict(id='pair', name='Pair', components=[
            dict(starId='a', label='A'), dict(starId='b', label='B')])]
        self.pool = {id: dict(id=id, name='Pair '+id, raw_astrometry=copy.deepcopy(self.raw),
                             notes='Original source.', x_pc=3, y_pc=4, z_pc=5,
                             vx_kms=None, vy_kms=None, vz_kms=None)
                     for id in ('a', 'b')}
        self.review = dict(systemId='pair', expectedName='Pair', expectedComponents={'a':'A','b':'B'},
                           donorStarId='a', targetIds=['b'], valueKms=2.057, uncertaintyKms=.084,
                           reference='published gamma', status='published-systemic',
                           scope='No individual orbital velocity.', motionInputs=self.raw)
        self.audit = {'componentRecords':{}}

    def apply(self, hierarchy_reviews=()):
        path = self.root / PLAN
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'systems':[self.review]}))
        manifest = self.root / 'catalog-work/shared-enrichment/source-manifest.json'
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(json.dumps({'checksumsSha256':{PLAN:hashlib.sha256(path.read_bytes()).hexdigest()}}))
        apply_bright_system_motion(self.root, self.systems, self.pool, self.audit, hierarchy_reviews)

    def test_vector_agrees_with_independent_astropy_coordinate_transform(self):
        for rv in (-16.1024, 0, 2.057):
            sky = SkyCoord(ra=self.raw['ra_deg']*u.deg, dec=self.raw['dec_deg']*u.deg,
                           distance=1000/self.raw['parallax_mas']*u.pc,
                           pm_ra_cosdec=self.raw['pm_ra_cosdec_masyr']*u.mas/u.yr,
                           pm_dec=self.raw['pm_dec_masyr']*u.mas/u.yr,
                           radial_velocity=rv*u.km/u.s)
            for actual, expected in zip(bulk_vector(self.raw,rv), sky.galactic.velocity.d_xyz.to_value(u.km/u.s)):
                self.assertAlmostEqual(actual, expected, places=4)

    def test_fills_missing_motion_and_retains_native_astrometry_and_source(self):
        before = copy.deepcopy(self.pool)
        self.apply()
        self.assertEqual(self.pool['a'],before['a'])
        b = self.pool['b']
        self.assertEqual(b['raw_astrometry']['radial_velocity_kms'],2.057)
        self.assertEqual(b['raw_astrometry']['radial_velocity_error_kms'],.084)
        for field,value in self.raw.items():
            if field not in {'radial_velocity_kms','radial_velocity_error_kms'}:
                self.assertEqual(b['raw_astrometry'][field],value)
        for field in ('x_pc','y_pc','z_pc'):
            self.assertEqual(b[field],before['b'][field])
        retained=self.audit['componentRecords']['b']['brightSystemMotion']['retainedOriginal']
        self.assertEqual(retained['raw_astrometry'],self.raw)

    def test_preserves_individual_velocity_and_existing_bulk_vector(self):
        self.pool['b'].update(vx_kms=1,vy_kms=2,vz_kms=3)
        self.apply()
        self.assertEqual([self.pool['b'][f] for f in ('vx_kms','vy_kms','vz_kms')],[1,2,3])
        self.pool['b']['raw_astrometry']['radial_velocity_kms']=19
        before=copy.deepcopy(self.pool['b'])
        self.apply()
        self.assertEqual(self.pool['b'],before)

    def test_rejects_membership_drift_and_incomplete_motion_basis(self):
        self.systems[0]['components'][1]['label']='Ba'
        with self.assertRaisesRegex(ValueError,'membership drifted'):
            self.apply()
        with self.assertRaisesRegex(ValueError,'Incomplete'):
            bulk_vector({**self.raw,'pm_dec_masyr':None},2)

    def test_explicit_split_extends_bulk_motion_without_rewriting_frozen_membership(self):
        before = copy.deepcopy(self.review)
        self.systems[0]['components'] = [dict(starId='a', label='A'),
            dict(starId='b', label='Ba'), dict(starId='bb', label='Bb')]
        self.pool['bb'] = {**copy.deepcopy(self.pool['b']), 'id': 'bb'}
        split = dict(systemId='pair', expectedComponents={'a': 'A', 'b': 'B'}, parentStarId='b',
                     components=[dict(starId='b', label='Ba'), dict(starId='bb', label='Bb')])
        self.apply([split])
        self.assertEqual(self.review, before)
        for identifier in ('b', 'bb'):
            self.assertEqual(self.pool[identifier]['raw_astrometry']['radial_velocity_kms'], 2.057)
            self.assertEqual(self.audit['componentRecords'][identifier]['brightSystemMotion']
                             ['review']['hierarchyMapping'], split)


if __name__ == '__main__':
    unittest.main()
