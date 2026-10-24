"""Exact-object motion, asymmetric source errors, and conditional physical data."""
import copy
import csv
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from catalog_sources.ultracool_motion import enrich_reviewed_motion


class ColdBrownDwarfTests(unittest.TestCase):
    def setUp(self):
        with (ROOT / 'src/data/catalogs/nearest-100/stars.csv').open() as handle:
            self.rows = {row['id']: row for row in csv.DictReader(handle)}
        self.review = json.loads((ROOT / 'catalog-work/shared-enrichment/cold-brown-dwarfs-review.json').read_text())

    def test_2023_velocity_round_trip_preserves_all_other_astrometry(self):
        import astropy.units as u
        from astropy.coordinates import CartesianDifferential, Galactic, SkyCoord
        before = self.review['before']['nearest-100']['10pc-0068']
        row = copy.deepcopy(before)
        adopted = enrich_reviewed_motion(row)
        self.assertEqual(row['radial_velocity_ref'], '2023ApJ...953..170H')
        self.assertEqual(adopted['publishedUncertainty'], {'lower': 0.15, 'upper': 0.16})
        self.assertEqual(float(row['radial_velocity_error_kms']), 0.16)
        self.assertEqual(adopted['alternativeMeasurements'][0]['value'], 46.9)
        self.assertEqual(adopted['alternativeMeasurements'][0]['status'], 'not-adopted')
        position = SkyCoord(ra=float(row['ra_deg'])*u.deg, dec=float(row['dec_deg'])*u.deg,
                            distance=1000/float(row['parallax_mas'])*u.pc).galactic.cartesian
        motion = CartesianDifferential([float(row[k]) for k in ('vx_kms','vy_kms','vz_kms')]*u.km/u.s)
        recovered = SkyCoord(Galactic(position.with_differentials(motion))).icrs
        self.assertAlmostEqual(recovered.radial_velocity.to_value(u.km/u.s), 35.8, places=5)
        self.assertAlmostEqual(recovered.pm_ra_cosdec.to_value(u.mas/u.yr), float(before['pm_ra_cosdec_masyr']), places=3)
        self.assertAlmostEqual(recovered.pm_dec.to_value(u.mas/u.yr), float(before['pm_dec_masyr']), places=3)
        changed = {'notes','vx_kms','vy_kms','vz_kms','radial_velocity_kms','radial_velocity_error_kms','radial_velocity_ref'}
        self.assertEqual({k:v for k,v in row.items() if k not in changed}, {k:v for k,v in before.items() if k not in changed})
        with self.assertRaisesRegex(ValueError, 'identity drifted'):
            enrich_reviewed_motion(dict(before, name='Wrong brown dwarf'))

    def test_ranges_and_age_priors_never_become_scalar_measurements(self):
        ugps, wise = self.rows['10pc-0068'], self.rows['10pc-0084']
        for field in ('temperature_k', 'mass_solar', 'radius_solar', 'age_gyr', 'metallicity_dex', 'absolute_mag'):
            self.assertEqual(ugps[field], '', field)
        self.assertAlmostEqual(float(ugps['luminosity_solar']), 10**-6.20, places=12)
        self.assertEqual(wise['temperature_k'], '361')
        self.assertAlmostEqual(float(wise['mass_solar']), 13*1.2668653e17/1.3271244e20, places=9)
        self.assertAlmostEqual(float(wise['luminosity_solar']), 10**-6.82, places=12)
        self.assertAlmostEqual(float(wise['radius_solar']), (10**-6.82)**.5*(5772/361)**2, places=9)
        for field in ('age_gyr', 'metallicity_dex', 'absolute_mag', 'radial_velocity_kms','vx_kms','vy_kms','vz_kms'):
            self.assertEqual(wise[field], '', field)
        for identifier in ('10pc-0068', '10pc-0084'):
            old = self.review['before']['nearest-100'][identifier]
            for field in ('parallax_mas','parallax_error_mas','ra_deg','dec_deg','astrometry_epoch','pm_ra_cosdec_masyr','pm_dec_masyr','pm_ra_error_masyr','pm_dec_error_masyr','astrometry_ref','x_pc','y_pc','z_pc'):
                self.assertEqual(self.rows[identifier][field], old[field], (identifier,field))


if __name__ == '__main__':
    unittest.main()
