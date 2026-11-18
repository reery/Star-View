#!/usr/bin/env python3
"""Author the galaxy overlay: the Milky Way, the four major Local Group galaxies near it, Andromeda's
four bright satellites and the nine classical dwarf spheroidal satellites of the Milky Way.

Every value below is a reviewed published measurement. Positions are derived from the J2000
center and the adopted distance with the same IAU rotation the app uses, so the map, the cards
and the drawn models agree. Diameters other than the Milky Way's are the isophotal apparent
size at the adopted distance. The dwarf galaxies take their centers, distances, structure,
velocities and masses from frozen Local Volume Database rows, each with its cited paper.

Usage: author-galaxies.py --write | --check
"""

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'src/data/overlays/galaxies'
LVDB = ROOT / 'catalog-work/local-volume-database/lvdb-v1.1.2-galaxies.csv'

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
        'designations': ['The Galaxy', 'Galactic Center'],
        'constellation': 'Sagittarius',
        'notes': 'The home galaxy of the Sun. Its map position is the Galactic Center, marked by the black hole Sagittarius A*; the drawn model is the Reid et al. (2019) spiral-arm fit centered 8.15 kpc away. The center distance follows the GRAVITY Collaboration (2022) four-star orbit fit, 8277 ± 9 (stat) ± 30 (sys) pc; it supersedes their S2-only 2019 value of 8178 ± 13 (stat) ± 22 (sys) pc, which predates the 2021 correction of the instrument\'s optical aberrations (https://doi.org/10.1051/0004-6361/201935656).',
        'morphology': 'SB(rs)bc',
        'classification': 'Barred spiral galaxy',
        # Sagittarius A*, SIMBAD ICRS position (Petrov et al. 2011 VLBA), shared with its compact-remnant record.
        'ra_deg': 266.416816625, 'dec_deg': -29.007824972,
        # Statistical and systematic errors (9 and 30 pc) combined.
        'distance_pc': 8277, 'distance_error_pc': 31,
        'distance_method': 'Orbits of the stars S2, S29, S38 and S55 around Sagittarius A* (GRAVITY interferometry)',
        'distance_source': source('GRAVITY Collaboration (2022)', 'https://doi.org/10.1051/0004-6361/202142465'),
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

LVDB_SOURCE = source('Pace (2025), Local Volume Database v1.1.2', 'https://doi.org/10.33232/001c.144859')
# Papers behind the adopted Local Volume Database values, by ADS bibcode.
REFERENCES = {
    'McConnachie2012AJ....144....4M': source('McConnachie (2012)', 'https://doi.org/10.1088/0004-6256/144/1/4'),
    'Oakes2022ApJ...929..116O': source('Oakes et al. (2022)', 'https://doi.org/10.3847/1538-4357/ac5b07'),
    'MartinezVazquez2015MNRAS.454.1509M': source('Martínez-Vázquez et al. (2015)', 'https://doi.org/10.1093/mnras/stv2014'),
    'Bhardwaj2024AJ....167..247B': source('Bhardwaj et al. (2024)', 'https://doi.org/10.3847/1538-3881/ad38b6'),
    'Garofalo2025A&A...695A..88G': source('Garofalo et al. (2025)', 'https://doi.org/10.1051/0004-6361/202452619'),
    'Karczmarek2015AJ....150...90K': source('Karczmarek et al. (2015)', 'https://doi.org/10.1088/0004-6256/150/3/90'),
    'Lee2009ApJ...703..692L': source('Lee et al. (2009)', 'https://doi.org/10.1088/0004-637X/703/1/692'),
    'Stetson2014PASP..126..616S': source('Stetson et al. (2014)', 'https://doi.org/10.1086/677352'),
    'Monelli2025A&A...700A.201M': source('Monelli et al. (2025)', 'https://doi.org/10.1051/0004-6361/202453567'),
    'Savino2022ApJ...938..101S': source('Savino et al. (2022)', 'https://doi.org/10.3847/1538-4357/ac91cb'),
    'Wang2019ApJ...881..118W': source('Wang et al. (2019)', 'https://doi.org/10.3847/1538-4357/ab31a9'),
    'Munoz2018ApJ...860...66M': source('Muñoz et al. (2018)', 'https://doi.org/10.3847/1538-4357/aac16b'),
    'Sato2026arXiv260916476S': source('Sato et al. (2026)', 'https://doi.org/10.48550/arXiv.2609.16476'),
    'Cicuendez2018A&A...609A..53C': source('Cicuéndez et al. (2018)', 'https://doi.org/10.1051/0004-6361/201731450'),
    'Crnojevic2014MNRAS.445.3862C': source('Crnojević et al. (2014)', 'https://doi.org/10.1093/mnras/stu2003'),
    'Walker2009AJ....137.3100W': source('Walker et al. (2009)', 'https://doi.org/10.1088/0004-6256/137/2/3100'),
    'Geha2026ApJ...999..140G': source('Geha et al. (2026)', 'https://doi.org/10.3847/1538-4357/ae290d'),
}
DISTANCE_METHODS = {
    'Oakes2022ApJ...929..116O': 'Average of the red giant branch tip, RR Lyrae stars and the horizontal branch',
    'MartinezVazquez2015MNRAS.454.1509M': 'RR Lyrae period–Wesenheit relations',
    'Bhardwaj2024AJ....167..247B': 'Near-infrared RR Lyrae period–luminosity relations',
    'Garofalo2025A&A...695A..88G': 'RR Lyrae stars (Gaia DR3)',
    'Karczmarek2015AJ....150...90K': 'Near-infrared RR Lyrae period–luminosity relations',
    'Lee2009ApJ...703..692L': 'Synthetic color–magnitude diagram fit',
    'Stetson2014PASP..126..616S': 'RR Lyrae stars',
    'Monelli2025A&A...700A.201M': 'RR Lyrae stars',
    'Savino2022ApJ...938..101S': 'RR Lyrae stars (HST)',
}
# The database adopts McConnachie's (2012) compiled Sagittarius distance, measured by Monaco et al. (2004).
MONACO_2004 = source('Monaco et al. (2004)', 'https://arxiv.org/abs/astro-ph/0406350')
# Old, dust-free stellar populations.
DWARF_PALETTE = {'real': '#fff0e0', 'exaggerated': '#ffd49e'}

# Curated fields; everything else comes from the Local Volume Database row `lvdb`. `size_arcmin` is the
# Wikipedia apparent size in visible light of Andromeda's bright satellites. Dwarf spheroidals are fainter than
# the isophotes such sizes trace, so theirs is the half-light ellipse, twice the half-light radius. Dynamical masses ship only for the classical dwarf spheroidals,
# where the half-light estimator applies: Sagittarius is being torn apart, and Andromeda's dwarf ellipticals
# rotate, so their estimates fall below their stellar masses.
DWARFS = [
    {'id': 'sagittarius-dwarf-galaxy', 'lvdb': 'sagittarius_1', 'name': 'Sagittarius Dwarf Galaxy',
     'designations': ['Sagittarius Dwarf Spheroidal Galaxy', 'Sgr dSph', 'Sag DEG', 'PGC 4689212'], 'constellation': 'Sagittarius',
     'notes': 'The nearest known satellite galaxy, beyond the Galactic Center and being torn apart by the Milky Way.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': False,
     'distance_method': 'Tip of the red giant branch', 'distance_source': MONACO_2004},
    {'id': 'fornax-dwarf-galaxy', 'lvdb': 'fornax_1', 'name': 'Fornax Dwarf Galaxy',
     'designations': ['Fornax Dwarf Spheroidal', 'ESO 356-4', 'PGC 10074'], 'constellation': 'Fornax',
     'notes': 'A dwarf spheroidal satellite of the Milky Way with six globular clusters.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'sculptor-dwarf-galaxy', 'lvdb': 'sculptor_1', 'name': 'Sculptor Dwarf Galaxy',
     'designations': ['Sculptor Dwarf Spheroidal', 'ESO 351-30', 'PGC 3589'], 'constellation': 'Sculptor',
     'notes': 'A dwarf spheroidal satellite of the Milky Way, home to the most metal-poor star known outside it.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'draco-dwarf-galaxy', 'lvdb': 'draco_1', 'name': 'Draco Dwarf Galaxy',
     'designations': ['Draco Dwarf', 'Draco dSph', 'UGC 10822', 'DDO 208', 'PGC 60095'], 'constellation': 'Draco',
     'notes': 'A faint dwarf spheroidal satellite of the Milky Way, dominated by dark matter.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'ursa-minor-dwarf-galaxy', 'lvdb': 'ursa_minor_1', 'name': 'Ursa Minor Dwarf Galaxy',
     'designations': ['Ursa Minor Dwarf', 'UMi dSph', 'UGC 9749', 'DDO 199', 'PGC 54074'], 'constellation': 'Ursa Minor',
     'notes': 'A dwarf spheroidal satellite of the Milky Way whose stars formed in a single early burst.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'carina-dwarf-galaxy', 'lvdb': 'carina_1', 'name': 'Carina Dwarf Galaxy',
     'designations': ['Carina Dwarf Spheroidal Galaxy', 'ESO 206-220', 'PGC 19441'], 'constellation': 'Carina',
     'notes': 'A dim dwarf spheroidal satellite of the Milky Way, discovered in 1977.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'sextans-dwarf-galaxy', 'lvdb': 'sextans_1', 'name': 'Sextans Dwarf Galaxy',
     'designations': ['Sextans Dwarf Spheroidal', 'Sextans I', 'PGC 88608'], 'constellation': 'Sextans',
     'notes': 'A very diffuse dwarf spheroidal satellite of the Milky Way, discovered in 1990.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'leo-i-dwarf-galaxy', 'lvdb': 'leo_1', 'name': 'Leo I Dwarf Galaxy',
     'designations': ['Leo I', 'Regulus Dwarf', 'UGC 5470', 'DDO 74', 'PGC 29488'], 'constellation': 'Leo',
     'notes': 'One of the most distant satellites of the Milky Way, 12 arcminutes from Regulus.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'leo-ii-dwarf-galaxy', 'lvdb': 'leo_2', 'name': 'Leo II Dwarf Galaxy',
     'designations': ['Leo II', 'Leo B', 'UGC 6253', 'DDO 93', 'PGC 34176'], 'constellation': 'Leo',
     'notes': 'A distant dwarf spheroidal satellite of the Milky Way.',
     'morphology': 'dSph', 'classification': 'Dwarf spheroidal galaxy', 'mass': True},
    {'id': 'messier-32', 'lvdb': 'm_032', 'name': 'Messier 32', 'wikipedia': 'Messier_32',
     'designations': ['M32', 'NGC 221', 'UGC 452', 'PGC 2555', 'Arp 168'], 'constellation': 'Andromeda',
     'notes': 'A compact elliptical satellite of the Andromeda Galaxy, seen against its disk.',
     'morphology': 'cE2', 'classification': 'Compact elliptical galaxy', 'size_arcmin': [8.7, 6.5], 'mass': False},
    {'id': 'messier-110', 'lvdb': 'ngc_0205', 'name': 'Messier 110', 'wikipedia': 'Messier_110',
     'designations': ['M110', 'NGC 205', 'UGC 426', 'PGC 2429'], 'constellation': 'Andromeda',
     'notes': 'A dwarf elliptical satellite of the Andromeda Galaxy and the last entry of the Messier catalog.',
     'morphology': 'dE5 pec', 'classification': 'Dwarf elliptical galaxy', 'size_arcmin': [21.9, 11.0], 'mass': False},
    {'id': 'ngc-185', 'lvdb': 'ngc_0185', 'name': 'NGC 185', 'wikipedia': 'NGC_185',
     'designations': ['Caldwell 18', 'UGC 396', 'PGC 2329'], 'constellation': 'Cassiopeia',
     'notes': 'A dwarf elliptical satellite of the Andromeda Galaxy with young star clusters and an active nucleus.',
     'morphology': 'dE3', 'classification': 'Dwarf elliptical galaxy', 'size_arcmin': [11.7, 10.0], 'mass': False},
    {'id': 'ngc-147', 'lvdb': 'ngc_0147', 'name': 'NGC 147', 'wikipedia': 'NGC_147',
     'designations': ['Caldwell 17', 'UGC 326', 'DDO 3', 'PGC 2004'], 'constellation': 'Cassiopeia',
     'notes': 'A dwarf elliptical satellite of the Andromeda Galaxy, paired with NGC 185.',
     'morphology': 'dE5', 'classification': 'Dwarf elliptical galaxy', 'size_arcmin': [13.2, 7.8], 'mass': False},
]


def dwarf(spec: dict, row: dict) -> dict:
    """A dwarf galaxy from its curated fields and Local Volume Database row."""
    value = lambda key: float(row[key])
    error = lambda key: (value(f'{key}_em') + value(f'{key}_ep')) / 2
    modulus = value('distance_modulus')
    distance = 10 ** (modulus / 5 + 1)
    # Half-light radius along the long axis at the adopted distance.
    half_light = distance * math.tan(math.radians(value('rhalf') / 60))
    if 'size_arcmin' in spec:
        major, minor = spec['size_arcmin']
        size_source = source(f'Wikipedia: {spec["name"]} (apparent size in visible light)', WIKIPEDIA + spec['wikipedia'])
    else:
        major, minor = 2 * value('rhalf'), 2 * value('rhalf') * (1 - value('ellipticity'))
        size_source = source(f'{REFERENCES[row["ref_structure"]]["label"]}, twice the half-light radius', REFERENCES[row['ref_structure']]['url'])
    diameter = 2 * distance * math.tan(math.radians(major / 60) / 2)
    galaxy = {
        **{key: spec[key] for key in ('id', 'name', 'designations', 'constellation', 'notes', 'morphology', 'classification')},
        'ra_deg': value('ra'), 'dec_deg': value('dec'),
        'center_label': 'Local Volume Database J2000 center',
        'distance_pc': round(distance), 'distance_error_pc': round(distance * math.log(10) / 5 * error('distance_modulus')),
        'distance_method': spec.get('distance_method') or DISTANCE_METHODS[row['ref_distance']],
        'distance_source': spec.get('distance_source') or REFERENCES[row['ref_distance']],
        'angular_size_deg': [round(major / 60, 4), round(minor / 60, 4)],
        'size_source': size_source,
        'star_count': None, 'star_count_source': None,
        'radial_velocity_kms': value('vlos_systemic'), 'radial_velocity_error_kms': error('vlos_systemic'),
        'radial_velocity_source': REFERENCES[row['ref_vlos']],
        # The drawn spheroid reaches three half-light radii, or the isophotal size where that is larger.
        'model_radius_pc': round(max(3 * half_light, diameter / 2), -1),
        'palette': DWARF_PALETTE,
        'spheroid': {
            'half_light_radius_pc': round(half_light, 1), 'ellipticity': value('ellipticity'),
            'position_angle_deg': value('position_angle') % 180, 'surface_brightness_v': value('surface_brightness_rhalf'),
            'source': REFERENCES[row['ref_structure']],
        },
        'model_note': f'A smooth spheroid of old stars, {round(half_light):,} pc in half-light radius along its long axis at position angle '
                      f'{value("position_angle") % 180:g}°, with a {1 - value("ellipticity"):.2f} axis ratio.',
    }
    if spec['mass']:
        log_mass = value('mass_dynamical_wolf')
        galaxy['total_mass'] = {
            'value_solar': float(f'{10 ** log_mass:.3g}'),
            'lower_error_solar': float(f'{10 ** log_mass - 10 ** (log_mass - value("mass_dynamical_wolf_em")):.2g}'),
            'upper_error_solar': float(f'{10 ** (log_mass + value("mass_dynamical_wolf_ep")) - 10 ** log_mass:.2g}'),
            'scope': f'Mass within the half-light radius, dark matter included, from the stars’ velocity spread measured by {REFERENCES[row["ref_vlos"]]["label"]}',
            'source': LVDB_SOURCE,
        }
    return galaxy


def dwarfs() -> list[dict]:
    with LVDB.open(newline='') as file:
        rows = {row['key']: row for row in csv.DictReader(file)}
    return [dwarf(spec, rows[spec['lvdb']]) for spec in DWARFS]


SOURCES = [
    {'name': 'GRAVITY Collaboration (2022); geometric distance to Sagittarius A*', 'url': 'https://doi.org/10.1051/0004-6361/202142465'},
    {'name': 'Pietrzyński et al. (2019); eclipsing-binary distance to the Large Magellanic Cloud', 'url': 'https://doi.org/10.1038/s41586-019-0999-4'},
    {'name': 'Graczyk et al. (2020); eclipsing-binary distance to the Small Magellanic Cloud', 'url': 'https://doi.org/10.3847/1538-4357/abbb2b'},
    {'name': 'Li et al. (2021); HST Cepheid distance to M31', 'url': 'https://doi.org/10.3847/1538-4357/ac1597'},
    {'name': 'Breuval et al. (2023); HST Cepheid distance to M33', 'url': 'https://doi.org/10.3847/1538-4357/acd3f4'},
    {'name': 'Reid et al. (2019); spiral-arm fits of the Milky Way', 'url': 'https://doi.org/10.3847/1538-4357/ab4a11'},
    {'name': 'NASA/IPAC Extragalactic Database; centers and heliocentric velocities', 'url': 'https://ned.ipac.caltech.edu/'},
    {'name': 'Pace (2025), Local Volume Database v1.1.2; dwarf galaxy centers, distances, structure, velocities and masses', 'url': 'https://doi.org/10.33232/001c.144859'},
    {'name': 'Monaco et al. (2004); red giant branch tip distance to the Sagittarius Dwarf Galaxy', 'url': 'https://arxiv.org/abs/astro-ph/0406350'},
]


def galactic_pc(ra_deg: float, dec_deg: float, distance_pc: float) -> list[float]:
    alpha, delta = math.radians(ra_deg), math.radians(dec_deg)
    equatorial = (math.cos(delta) * math.cos(alpha), math.cos(delta) * math.sin(alpha), math.sin(delta))
    return [round(distance_pc * sum(row[i] * equatorial[i] for i in range(3)), 1) for row in ICRS_TO_GALACTIC]


def sagittarius_a_star_pc() -> list[float]:
    """The black hole's plotted position, so the Milky Way's center and Sagittarius A* coincide when drawn up close."""
    objects = json.loads((ROOT / 'src/data/overlays/compact-remnants/objects.json').read_text())['objects']
    star = next(item for item in objects if item['id'] == 'sgr-a-star')
    return [star['x_pc'], star['y_pc'], star['z_pc']]


def galactic_lb(position: list[float]) -> tuple[float, float]:
    x, y, z = position
    return (math.degrees(math.atan2(y, x)) % 360, math.degrees(math.asin(z / math.hypot(x, y, z))))


def record(galaxy: dict) -> dict:
    details = {key: galaxy[key] for key in (
        'morphology', 'classification', 'ra_deg', 'dec_deg', 'distance_pc', 'distance_error_pc', 'distance_method',
        'distance_source', 'diameter_pc', 'angular_size_deg', 'size_source', 'star_count', 'star_count_source', 'total_mass',
        'radial_velocity_kms', 'radial_velocity_error_kms', 'radial_velocity_source', 'model_radius_pc', 'palette',
        'spheroid', 'model_note') if key in galaxy}
    if galaxy['angular_size_deg'] is not None:
        # Isophotal major axis at the adopted distance.
        details['diameter_pc'] = round(2 * galaxy['distance_pc'] * math.tan(math.radians(galaxy['angular_size_deg'][0]) / 2), -1)
    details = {key: details[key] for key in [
        'morphology', 'classification', 'ra_deg', 'dec_deg', 'distance_pc', 'distance_error_pc', 'distance_method',
        'distance_source', 'diameter_pc', 'angular_size_deg', 'size_source', 'star_count', 'star_count_source',
        *(['total_mass'] if 'total_mass' in galaxy else []),
        'radial_velocity_kms', 'radial_velocity_error_kms', 'radial_velocity_source', 'model_radius_pc', 'palette',
        *(['spheroid'] if 'spheroid' in galaxy else [])]}
    x, y, z = sagittarius_a_star_pc() if galaxy['id'] == 'milky-way' else galactic_pc(galaxy['ra_deg'], galaxy['dec_deg'], galaxy['distance_pc'])
    longitude, latitude = galactic_lb([x, y, z])
    details['position_source'] = f'{galaxy.get("center_label", "NED J2000 center")} (l = {longitude:.2f}°, b = {latitude:.2f}°) at the {details["distance_source"]["label"]} distance' \
        if galaxy['id'] != 'milky-way' else f'Sagittarius A* (l = {longitude:.3f}°, b = {latitude:.3f}°) at the GRAVITY Collaboration (2022) distance'
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
    objects = [record(galaxy) for galaxy in [*GALAXIES, *dwarfs()]]
    manifest = {
        'schemaVersion': 1,
        'id': 'galaxies',
        'label': 'Galaxies',
        'description': 'The Milky Way, the four major Local Group galaxies near it and thirteen of their dwarf satellites, shown while Galaxies is on in Preferences. Their visuals are drawn from published structure, generated on first need.',
        'epoch': 2000,
        'objectCount': len(objects),
        'counts': {'galaxy': len(objects)},
        'sources': SOURCES,
        'cutoffPolicy': 'The Local Group galaxies visible to the naked eye (the Milky Way, both Magellanic Clouds, the Andromeda Galaxy and the Triangulum Galaxy), the four bright satellites of the Andromeda Galaxy and the nine classical dwarf spheroidal satellites of the Milky Way.',
        'snapshot': 'J2000 Galactic frame; values reviewed 2026-11-16.',
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
        print(f'Wrote {len(GALAXIES) + len(DWARFS)} galaxies to {DIRECTORY.relative_to(ROOT)}.')
        return 0
    stale = [name for name, content in expected.items() if not (DIRECTORY / name).exists() or (DIRECTORY / name).read_text() != content]
    if stale:
        print(f'Galaxy overlay is out of date: {", ".join(stale)}. Run scripts/author-galaxies.py --write.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
