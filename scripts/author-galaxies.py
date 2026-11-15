#!/usr/bin/env python3
"""Author the galaxy overlay: the Milky Way and the four major Local Group galaxies near it.

Every value below is a reviewed published measurement. Positions are derived from the J2000
center and the adopted distance with the same IAU rotation the app uses, so the map, the cards
and the drawn models agree. Diameters other than the Milky Way's are the isophotal apparent
size at the adopted distance.

Usage: author-galaxies.py --write | --check
"""

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'src/data/overlays/galaxies'

# IAU ICRS-to-Galactic rotation, as ICRS_TO_GALACTIC_ROWS in src/catalog-model.ts.
ICRS_TO_GALACTIC = (
    (-0.0548755604, -0.8734370902, -0.4838350155),
    (0.4941094279, -0.4448296300, 0.7469822445),
    (-0.8676661490, -0.1980763734, 0.4559837762),
)

NED = 'NASA/IPAC Extragalactic Database (NED)'
WIKIPEDIA = 'https://en.wikipedia.org/wiki/'


def source(label: str, url: str) -> dict:
    return {'label': label, 'url': url}


GALAXIES = [
    {
        'id': 'milky-way',
        'name': 'Milky Way',
        'designations': ['The Galaxy', 'Galactic Center', 'Sagittarius A*'],
        'constellation': 'Sagittarius',
        'notes': 'The home galaxy of the Sun. Its map position is the Galactic Center, marked by the black hole Sagittarius A*; the drawn model is the Reid et al. (2019) spiral-arm fit centered 8.15 kpc away.',
        'morphology': 'SB(rs)bc',
        'classification': 'Barred spiral galaxy',
        # Sagittarius A*, Petrov et al. (2011) VLBI position.
        'ra_deg': 266.4168338, 'dec_deg': -29.0078250,
        'distance_pc': 8178, 'distance_error_pc': 26,
        'distance_method': 'Orbit of the star S2 around Sagittarius A* (GRAVITY interferometry)',
        'distance_source': source('GRAVITY Collaboration (2019)', 'https://doi.org/10.1051/0004-6361/201935656'),
        'diameter_pc': 26800, 'angular_size_deg': None,
        'size_source': source('Goodwin, Gribbin & Hendry (1998), D25 isophote', 'https://ui.adsabs.harvard.edu/abs/1998Obs...118..201G'),
        'star_count': [1e11, 4e11], 'star_count_source': source('Wikipedia: Milky Way', WIKIPEDIA + 'Milky_Way'),
        'total_mass': {
            'value_solar': 1.28e12, 'lower_error_solar': 0.48e12, 'upper_error_solar': 0.97e12,
            'scope': 'Virial mass, including dark matter, implied by Gaia DR2 motions of 34 halo globular clusters',
            'source': source('Watkins et al. (2019)', 'https://doi.org/10.3847/1538-4357/ab089f'),
        },
        'radial_velocity_kms': None, 'radial_velocity_error_kms': None, 'radial_velocity_source': None,
        'model_radius_pc': 15000,
        'palette': {'real': '#ffe2b8', 'exaggerated': '#ffcd85'},
        'model_note': 'Generated from published spiral-arm fits (Reid et al. 2019) with a bar, bulge and dust lanes; the Sun sits on the inner edge of the Local Arm.',
    },
    {
        'id': 'large-magellanic-cloud',
        'name': 'Large Magellanic Cloud',
        'designations': ['LMC', 'Nubecula Major', 'ESO 56-115', 'PGC 17223'],
        'constellation': 'Dorado',
        'notes': 'The largest satellite galaxy of the Milky Way, straddling Dorado and Mensa.',
        'morphology': 'SB(s)m',
        'classification': 'Barred Magellanic spiral galaxy',
        'ra_deg': 80.89416667, 'dec_deg': -69.75611111,
        'distance_pc': 49590, 'distance_error_pc': 547,
        'distance_method': 'Detached late-type eclipsing binaries',
        'distance_source': source('Pietrzyński et al. (2019)', 'https://doi.org/10.1038/s41586-019-0999-4'),
        'angular_size_deg': [10.75, 9.17],
        'size_source': source('Wikipedia: Large Magellanic Cloud (RC3 isophotal size)', WIKIPEDIA + 'Large_Magellanic_Cloud'),
        'star_count': [2e10, 2e10], 'star_count_source': source('Wikipedia: Large Magellanic Cloud', WIKIPEDIA + 'Large_Magellanic_Cloud'),
        'total_mass': {
            'value_solar': 1.38e11, 'lower_error_solar': 0.24e11, 'upper_error_solar': 0.27e11,
            'scope': 'Total mass, including dark matter, needed to bend the Orphan stream',
            'source': source('Erkal et al. (2019)', 'https://doi.org/10.1093/mnras/stz1371'),
        },
        'radial_velocity_kms': 278.0, 'radial_velocity_error_kms': 2.0, 'radial_velocity_source': source(NED, 'https://ned.ipac.caltech.edu/byname?objname=LMC'),
        'model_radius_pc': 4700,
        'palette': {'real': '#dfe5ff', 'exaggerated': '#a9c0ff'},
        'model_note': 'An inclined disk with the off-center bar, one dominant spiral arm and the Tarantula Nebula; the northeast side is nearer.',
    },
    {
        'id': 'small-magellanic-cloud',
        'name': 'Small Magellanic Cloud',
        'designations': ['SMC', 'Nubecula Minor', 'NGC 292', 'PGC 3085'],
        'constellation': 'Tucana',
        'notes': 'A dwarf galaxy and satellite of the Milky Way, across Tucana and part of Hydrus.',
        'morphology': 'SB(s)m pec',
        'classification': 'Barred dwarf irregular galaxy',
        'ra_deg': 13.18666667, 'dec_deg': -72.82861111,
        'distance_pc': 62440, 'distance_error_pc': 935,
        'distance_method': 'Detached late-type eclipsing binaries',
        'distance_source': source('Graczyk et al. (2020)', 'https://doi.org/10.3847/1538-4357/abbb2b'),
        'angular_size_deg': [5.333, 3.083],
        'size_source': source('Wikipedia: Small Magellanic Cloud (RC3 isophotal size)', WIKIPEDIA + 'Small_Magellanic_Cloud'),
        'star_count': [3e9, 3e9], 'star_count_source': source('Wikipedia: Small Magellanic Cloud', WIKIPEDIA + 'Small_Magellanic_Cloud'),
        'radial_velocity_kms': 145.6, 'radial_velocity_error_kms': 0.6, 'radial_velocity_source': source(NED, 'https://ned.ipac.caltech.edu/byname?objname=SMC'),
        'model_radius_pc': 2900,
        'palette': {'real': '#e2e7ff', 'exaggerated': '#b4c8ff'},
        'model_note': 'An elongated body stretched along the line of sight, nearer in the northeast, with a bar of young stars and the Wing toward the Large Magellanic Cloud.',
    },
    {
        'id': 'andromeda-galaxy',
        'name': 'Andromeda Galaxy',
        'designations': ['M31', 'Messier 31', 'NGC 224', 'UGC 454', 'PGC 2557'],
        'constellation': 'Andromeda',
        'notes': 'The nearest large spiral galaxy and the largest member of the Local Group.',
        'morphology': 'SA(s)b',
        'classification': 'Spiral galaxy',
        'ra_deg': 10.68479292, 'dec_deg': 41.269065,
        'distance_pc': 761000, 'distance_error_pc': 11000,
        'distance_method': 'Near-infrared Cepheid period–luminosity relations (HST)',
        'distance_source': source('Li et al. (2021)', 'https://doi.org/10.3847/1538-4357/ac1597'),
        'angular_size_deg': [3.167, 1.0],
        'size_source': source('Wikipedia: Andromeda Galaxy (isophotal size)', WIKIPEDIA + 'Andromeda_Galaxy'),
        'star_count': [1e12, 1e12], 'star_count_source': source('Wikipedia: Andromeda Galaxy', WIKIPEDIA + 'Andromeda_Galaxy'),
        'radial_velocity_kms': -297.1, 'radial_velocity_error_kms': 0.9, 'radial_velocity_source': source(NED, 'https://ned.ipac.caltech.edu/byname?objname=M31'),
        'model_radius_pc': 21000,
        'palette': {'real': '#fff0dc', 'exaggerated': '#ffd59a'},
        'model_note': 'A disk tilted 77° to face-on, with its long axis at position angle 38°, a large bulge, the star-forming ring and dust lanes on the nearer northwest side.',
    },
    {
        'id': 'triangulum-galaxy',
        'name': 'Triangulum Galaxy',
        'designations': ['M33', 'Messier 33', 'NGC 598', 'UGC 1117', 'PGC 5818'],
        'constellation': 'Triangulum',
        'notes': 'The third-largest member of the Local Group, after the Andromeda Galaxy and the Milky Way.',
        'morphology': 'SA(s)cd',
        'classification': 'Spiral galaxy',
        'ra_deg': 23.46204167, 'dec_deg': 30.66022222,
        'distance_pc': 840000, 'distance_error_pc': 11000,
        'distance_method': 'Cepheid period–luminosity relation (HST)',
        'distance_source': source('Breuval et al. (2023)', 'https://doi.org/10.3847/1538-4357/acd3f4'),
        'angular_size_deg': [1.18, 0.695],
        'size_source': source('Wikipedia: Triangulum Galaxy (SIMBAD isophotal size)', WIKIPEDIA + 'Triangulum_Galaxy'),
        'star_count': [3e10, 4e10], 'star_count_source': source('Wikipedia: Triangulum Galaxy', WIKIPEDIA + 'Triangulum_Galaxy'),
        'radial_velocity_kms': -179.2, 'radial_velocity_error_kms': 0.8, 'radial_velocity_source': source(NED, 'https://ned.ipac.caltech.edu/byname?objname=M33'),
        'model_radius_pc': 8700,
        'palette': {'real': '#e6ebff', 'exaggerated': '#b8caff'},
        'model_note': 'A loosely wound, patchy spiral tilted 54° to face-on, with its long axis at position angle 22°, a small nucleus and NGC 604.',
    },
]

SOURCES = [
    {'name': 'GRAVITY Collaboration (2019); geometric distance to Sagittarius A*', 'url': 'https://doi.org/10.1051/0004-6361/201935656'},
    {'name': 'Pietrzyński et al. (2019); eclipsing-binary distance to the Large Magellanic Cloud', 'url': 'https://doi.org/10.1038/s41586-019-0999-4'},
    {'name': 'Graczyk et al. (2020); eclipsing-binary distance to the Small Magellanic Cloud', 'url': 'https://doi.org/10.3847/1538-4357/abbb2b'},
    {'name': 'Li et al. (2021); HST Cepheid distance to M31', 'url': 'https://doi.org/10.3847/1538-4357/ac1597'},
    {'name': 'Breuval et al. (2023); HST Cepheid distance to M33', 'url': 'https://doi.org/10.3847/1538-4357/acd3f4'},
    {'name': 'Reid et al. (2019); spiral-arm fits of the Milky Way', 'url': 'https://doi.org/10.3847/1538-4357/ab4a11'},
    {'name': 'NASA/IPAC Extragalactic Database; centers and heliocentric velocities', 'url': 'https://ned.ipac.caltech.edu/'},
]


def galactic_pc(ra_deg: float, dec_deg: float, distance_pc: float) -> list[float]:
    alpha, delta = math.radians(ra_deg), math.radians(dec_deg)
    equatorial = (math.cos(delta) * math.cos(alpha), math.cos(delta) * math.sin(alpha), math.sin(delta))
    return [round(distance_pc * sum(row[i] * equatorial[i] for i in range(3)), 1) for row in ICRS_TO_GALACTIC]


def galactic_lb(position: list[float]) -> tuple[float, float]:
    x, y, z = position
    return (math.degrees(math.atan2(y, x)) % 360, math.degrees(math.asin(z / math.hypot(x, y, z))))


def record(galaxy: dict) -> dict:
    details = {key: galaxy[key] for key in (
        'morphology', 'classification', 'ra_deg', 'dec_deg', 'distance_pc', 'distance_error_pc', 'distance_method',
        'distance_source', 'diameter_pc', 'angular_size_deg', 'size_source', 'star_count', 'star_count_source', 'total_mass',
        'radial_velocity_kms', 'radial_velocity_error_kms', 'radial_velocity_source', 'model_radius_pc', 'palette',
        'model_note') if key in galaxy}
    if galaxy['angular_size_deg'] is not None:
        # Isophotal major axis at the adopted distance.
        details['diameter_pc'] = round(2 * galaxy['distance_pc'] * math.tan(math.radians(galaxy['angular_size_deg'][0]) / 2), -1)
    details = {key: details[key] for key in [
        'morphology', 'classification', 'ra_deg', 'dec_deg', 'distance_pc', 'distance_error_pc', 'distance_method',
        'distance_source', 'diameter_pc', 'angular_size_deg', 'size_source', 'star_count', 'star_count_source',
        *(['total_mass'] if 'total_mass' in galaxy else []),
        'radial_velocity_kms', 'radial_velocity_error_kms', 'radial_velocity_source', 'model_radius_pc', 'palette']}
    x, y, z = galactic_pc(galaxy['ra_deg'], galaxy['dec_deg'], galaxy['distance_pc'])
    longitude, latitude = galactic_lb([x, y, z])
    details['position_source'] = f'NED J2000 center (l = {longitude:.2f}°, b = {latitude:.2f}°) at the {details["distance_source"]["label"]} distance' \
        if galaxy['id'] != 'milky-way' else f'Sagittarius A* (l = {longitude:.3f}°, b = {latitude:.3f}°) at the GRAVITY Collaboration (2019) distance'
    details['model_note'] = galaxy['model_note']
    return {
        'type': 'galaxy', 'id': galaxy['id'], 'name': galaxy['name'], 'designations': galaxy['designations'],
        'spectral_type': None, 'constellation': galaxy['constellation'],
        'x_pc': x, 'y_pc': y, 'z_pc': z,
        'vx_kms': None, 'vy_kms': None, 'vz_kms': None,
        'temperature_k': None, 'mass_solar': None, 'luminosity_solar': None, 'radius_solar': None,
        'metallicity_dex': None, 'age_gyr': None, 'absolute_mag': None, 'epoch': 2000,
        'notes': galaxy['notes'], 'raw_astrometry': None,
        'galaxy': details,
    }


def files() -> dict[str, str]:
    objects = [record(galaxy) for galaxy in GALAXIES]
    manifest = {
        'schemaVersion': 1,
        'id': 'galaxies',
        'label': 'Galaxies',
        'description': 'The Milky Way and the four major Local Group galaxies near it, shown while Galaxies is on in Preferences. Their visuals are drawn from published structure, generated on first need.',
        'epoch': 2000,
        'objectCount': len(objects),
        'counts': {'galaxy': len(objects)},
        'sources': SOURCES,
        'cutoffPolicy': 'The Milky Way, both Magellanic Clouds, the Andromeda Galaxy and the Triangulum Galaxy: the Local Group galaxies visible to the naked eye.',
        'snapshot': 'J2000 Galactic frame; values reviewed 2026-11-15.',
    }
    dump = lambda value: json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    return {
        'manifest.json': dump(manifest),
        'objects.json': dump({'schemaVersion': 1, 'overlayId': 'galaxies', 'objects': objects}),
    }


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ('--write', '--check'):
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    expected = files()
    if sys.argv[1] == '--write':
        DIRECTORY.mkdir(parents=True, exist_ok=True)
        for name, content in expected.items():
            (DIRECTORY / name).write_text(content)
        print(f'Wrote {len(GALAXIES)} galaxies to {DIRECTORY.relative_to(ROOT)}.')
        return 0
    stale = [name for name, content in expected.items() if not (DIRECTORY / name).exists() or (DIRECTORY / name).read_text() != content]
    if stale:
        print(f'Galaxy overlay is out of date: {", ".join(stale)}. Run scripts/author-galaxies.py --write.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
