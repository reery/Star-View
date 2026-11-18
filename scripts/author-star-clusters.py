#!/usr/bin/env python3
"""Author the star-cluster overlay: the open clusters Hyades, Pleiades, Beehive Cluster, Double Cluster, M67 and
NGC 3532, and the globular clusters Omega Centauri, 47 Tucanae, M4, M13, M22, M15 and Terzan 5.

Open clusters: centers, member counts, masses, radii, proper motions and radial velocities come from the frozen
Hunt & Reffert (2024) Gaia DR3 rows, metallicities from the frozen Netopil et al. (2016) rows, both
in catalog-work/star-clusters. A cluster may name a stronger reviewed distance, metallicity or radial
velocity instead. Each cluster's age is the most accurate one reviewed for it: lithium-depletion-boundary
ages for the Hyades and the Pleiades, dedicated studies for the others. Positions and space velocities
are derived with the same IAU rotation the app uses. Notable members are reviewed SIMBAD members that a
bundled catalog holds.

Globular clusters: centers, distances, masses, core, half-light and tidal radii, proper motions and radial velocities
come from the frozen rows of Baumgardt's globular cluster database (Baumgardt & Vasiliev 2021 distances, Vasiliev &
Baumgardt 2021 proper motions), metallicities from the frozen Carretta et al. (2009) rows and ages from the frozen
VandenBerg et al. (2013) rows, all in catalog-work/star-clusters. Omega Centauri and Terzan 5, which hold stars of
several ages, name dedicated studies instead.

Usage: author-star-clusters.py --write | --check
"""

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'src/data/overlays/star-clusters'
WORK = ROOT / 'catalog-work/star-clusters'

# IAU ICRS-to-Galactic rotation, as ICRS_TO_GALACTIC_ROWS in src/catalog-model.ts.
ICRS_TO_GALACTIC = (
    (-0.0548755604, -0.8734370902, -0.4838350155),
    (0.4941094279, -0.4448296300, 0.7469822445),
    (-0.8676661490, -0.1980763734, 0.4559837762),
)
# km/s per (mas/yr × kpc).
KM_S_PER_MAS_YR_KPC = 4.740470446


def source(label: str, url: str) -> dict:
    return {'label': label, 'url': url}


HUNT_REFFERT_2023 = source('Hunt & Reffert (2023), Gaia DR3 cluster census', 'https://doi.org/10.1051/0004-6361/202346285')
HUNT_REFFERT_2024 = source('Hunt & Reffert (2024), Gaia DR3 cluster masses and radii', 'https://doi.org/10.1051/0004-6361/202348662')
NETOPIL_2016 = source('Netopil et al. (2016), high-quality spectroscopic sample', 'https://doi.org/10.1051/0004-6361/201526370')
CURRIE_2010 = source('Currie et al. (2010)', 'https://doi.org/10.1088/0067-0049/186/2/191')
DALESSANDRO_2021 = source('Dalessandro et al. (2021), HARPS-N velocities of the cluster stars', 'https://doi.org/10.3847/1538-4357/abda43')
FANELLI_2022 = source('Fanelli et al. (2022), 27 red supergiants of the Perseus complex', 'https://doi.org/10.1051/0004-6361/202142492')
# Mean velocity of the stars within 16.5–25′ of both cluster centers; the error is their dispersion.
DOUBLE_CLUSTER_VELOCITY = (-47.4, 2.9, DALESSANDRO_2021)
# Mean of 27 red supergiants across the complex around both clusters; the error is their dispersion.
DOUBLE_CLUSTER_METALLICITY = (-0.30, 0.03, FANELLI_2022)
WESTERN = 'western-constellation-stars'
NAKED_EYE = 'naked-eye-stars'

CLUSTERS = [
    {
        'id': 'hyades',
        'name': 'Hyades',
        'designations': ['Melotte 25', 'Collinder 50', 'Caldwell 41', 'Taurus Moving Cluster'],
        'constellation': 'Taurus',
        'row': 'Melotte_25',
        'metallicity_row': 'Melotte 25',
        'notes': 'The nearest open cluster. Aldebaran lies in front of it, at less than half its distance, and is not a member. Hunt & Reffert (2023) also list the group CWNU 1242 on the same sightline, 290 pc away; it is unrelated.',
        # Hunt & Reffert (2023) median member distance; its 16th–84th percentile half-width is the error.
        'distance': ('hunt-reffert', 'Gaia DR3 parallaxes of 334 members', HUNT_REFFERT_2023),
        'age_myr': 650, 'age_error_myr': 70,
        'age_method': 'Lithium depletion boundary: the faintest brown dwarfs that still hold lithium',
        'age_source': source('Martín et al. (2018)', 'https://doi.org/10.3847/1538-4357/aaaeb8'),
        'notable_members': [
            (WESTERN, 'hip-20894', 'Chamukuy'), (WESTERN, 'hip-20889', 'Ain'), (WESTERN, 'hip-20205', 'Prima Hyadum'),
            (WESTERN, 'hip-20455', 'Secunda Hyadum'), (WESTERN, 'hip-20885', 'Theta1 Tau'), (WESTERN, 'hip-20635', 'Kappa1 Tau'),
            (WESTERN, 'hip-21589', 'c Tau'), (WESTERN, 'hip-20711', 'Upsilon Tau'),
        ],
        'palette': {'real': '#fff0dc', 'exaggerated': '#ffd9a6'},
    },
    {
        'id': 'pleiades',
        'name': 'Pleiades',
        'designations': ['Messier 45', 'M45', 'Melotte 22', 'Collinder 42', 'Seven Sisters', 'Subaru'],
        'constellation': 'Taurus',
        'row': 'Melotte_22',
        'metallicity_row': 'Melotte 22',
        'notes': 'The blue reflection nebulosity around its brightest stars is an unrelated dust cloud the cluster is passing through; it is the separate Pleiades Nebula record. Gaia DR3 astrometry of Alcyone, Merope and Taygeta is too poor for Hunt & Reffert (2023) to list them; SIMBAD lists them as members. A Bayesian lithium-age model gives 124.5 (+3.3, −2.7) Myr (Chronos 2026 preprint, https://arxiv.org/abs/2605.25957).',
        # The distance of the Pleiades Nebula record, so the cluster and its nebulosity coincide.
        'distance': (135.74, 0.10, 'Gaia DR3 parallaxes of the members',
                     source('Alfonso & García-Varela (2023)', 'https://doi.org/10.1051/0004-6361/202346569')),
        'age_myr': 125, 'age_error_myr': 8,
        'age_method': 'Lithium depletion boundary: the faintest stars that still hold lithium',
        'age_source': source('Stauffer, Schultz & Kirkpatrick (1998)', 'https://doi.org/10.1086/311379'),
        'notable_members': [
            (WESTERN, 'hip-17702', 'Alcyone'), (WESTERN, 'hip-17847', 'Atlas'), (WESTERN, 'hip-17499', 'Electra'),
            (WESTERN, 'hip-17573', 'Maia'), (WESTERN, 'hip-17608', 'Merope'), (WESTERN, 'hip-17531', 'Taygeta'),
            (WESTERN, 'hip-17851', 'Pleione'), (WESTERN, 'hip-17489', 'Celaeno'), (WESTERN, 'hip-17579', 'Asterope'),
        ],
        'palette': {'real': '#d6e2ff', 'exaggerated': '#a9c4ff'},
    },
    {
        'id': 'beehive-cluster',
        'name': 'Beehive Cluster',
        'designations': ['Praesepe', 'Messier 44', 'M44', 'NGC 2632', 'Melotte 88', 'Collinder 189'],
        'constellation': 'Cancer',
        'row': 'NGC_2632',
        'metallicity_row': 'NGC 2632',
        'notes': 'Asellus Borealis and Asellus Australis, the two donkeys of the myth that flank the cluster, lie far in front of it and are not members.',
        'distance': ('hunt-reffert', 'Gaia DR3 parallaxes of 728 members', HUNT_REFFERT_2023),
        'age_myr': 670, 'age_error_myr': 67,
        'age_method': 'Median and spread of eleven isochrone ages from the literature',
        'age_source': source('Douglas et al. (2019)', 'https://doi.org/10.3847/1538-4357/ab2468'),
        'notable_members': [
            (WESTERN, 'hip-42556', 'Meleph'), (WESTERN, 'hip-42549', 'HD 73710'), (WESTERN, 'hip-42516', '39 Cnc'),
            (WESTERN, 'hip-42133', '35 Cnc'), (WESTERN, 'hip-42497', 'HD 73598'),
        ],
        'palette': {'real': '#fff3e2', 'exaggerated': '#ffe0b0'},
    },
    {
        'id': 'ngc-869',
        'name': 'NGC 869',
        'designations': ['h Persei', 'Double Cluster', 'Caldwell 14', 'Melotte 13', 'Collinder 24'],
        'constellation': 'Perseus',
        'row': 'NGC_869',
        'metallicity': DOUBLE_CLUSTER_METALLICITY,
        'radial_velocity': DOUBLE_CLUSTER_VELOCITY,
        'notes': 'The western half of the Double Cluster; NGC 884 lies 0.4° to the east at nearly the same distance. Both are the core of the Perseus OB1 association. Gaia DR3 measured the radial velocities of too few bright members, so the velocity is the mean of HARPS-N spectra of stars in both clusters (Dalessandro et al. 2021). [Fe/H] is the mean of 27 red supergiants across the surrounding Perseus complex (Fanelli et al. 2022).',
        'distance': ('hunt-reffert', 'Gaia DR3 parallaxes of 402 members', HUNT_REFFERT_2023),
        'age_myr': 14, 'age_error_myr': 2,
        'age_method': 'Main-sequence turnoff, red supergiants and pre-main-sequence stars all give the same age',
        'age_source': CURRIE_2010,
        'notable_members': [],
        'palette': {'real': '#dce6ff', 'exaggerated': '#b4c8ff'},
    },
    {
        'id': 'ngc-884',
        'name': 'NGC 884',
        'designations': ['Chi Persei Cluster', 'Double Cluster', 'Caldwell 14', 'Melotte 14', 'Collinder 25'],
        'constellation': 'Perseus',
        'row': 'NGC_884',
        'metallicity': DOUBLE_CLUSTER_METALLICITY,
        'radial_velocity': DOUBLE_CLUSTER_VELOCITY,
        'notes': 'The eastern half of the Double Cluster; NGC 869 lies 0.4° to the west at nearly the same distance. Both are the core of the Perseus OB1 association. Gaia DR3 measured the radial velocities of too few bright members, so the velocity is the mean of HARPS-N spectra of stars in both clusters (Dalessandro et al. 2021). [Fe/H] is the mean of 27 red supergiants across the surrounding Perseus complex (Fanelli et al. 2022).',
        'distance': ('hunt-reffert', 'Gaia DR3 parallaxes of 287 members', HUNT_REFFERT_2023),
        'age_myr': 14, 'age_error_myr': 2,
        'age_method': 'Main-sequence turnoff, red supergiants and pre-main-sequence stars all give the same age',
        'age_source': CURRIE_2010,
        'notable_members': [(NAKED_EYE, 'hip-11020', 'HD 14433')],
        'palette': {'real': '#dce6ff', 'exaggerated': '#b4c8ff'},
    },
    {
        'id': 'messier-67',
        'name': 'Messier 67',
        'designations': ['M67', 'NGC 2682', 'King Cobra Cluster', 'Golden Eye Cluster', 'Melotte 94', 'Collinder 204'],
        'constellation': 'Cancer',
        'row': 'NGC_2682',
        'metallicity_row': 'NGC 2682',
        'notes': '60 Cancri, a SIMBAD candidate member in front of the cluster, lies at a third of its distance and is not a member.',
        'distance': ('hunt-reffert', 'Gaia DR3 parallaxes of 797 members', HUNT_REFFERT_2023),
        'age_myr': 3950, 'age_error_myr': 350,
        'age_method': 'Asteroseismology: the oscillations of its subgiants and red giants',
        'age_source': source('Reyes et al. (2025)', 'https://doi.org/10.1093/mnras/staf353'),
        'notable_members': [],
        'palette': {'real': '#fff0d6', 'exaggerated': '#ffd79a'},
    },
    {
        'id': 'ngc-3532',
        'name': 'NGC 3532',
        'designations': ['Wishing Well Cluster', 'Football Cluster', 'Caldwell 91', 'Melotte 103', 'Collinder 238'],
        'constellation': 'Carina',
        'row': 'NGC_3532',
        'metallicity_row': 'NGC 3532',
        'notes': 'HD 96544, a K giant near the center, is the brightest member that a bundled catalog holds; x Carinae, 0.5° away, lies far behind the cluster and is not a member.',
        'distance': ('hunt-reffert', 'Gaia DR3 parallaxes of 1,706 members', HUNT_REFFERT_2023),
        'age_myr': 300, 'age_error_myr': 50,
        'age_method': 'Isochrone fit to the spectroscopically confirmed members',
        'age_source': source('Fritzewski et al. (2019)', 'https://doi.org/10.1051/0004-6361/201833587'),
        'notable_members': [(NAKED_EYE, 'hip-54294', 'HD 96544')],
        'palette': {'real': '#f2f0ff', 'exaggerated': '#d2d0ff'},
    },
]

SOURCES = [
    {'name': 'Hunt & Reffert (2023); Gaia DR3 cluster centers, members, distances, proper motions and radial velocities', 'url': HUNT_REFFERT_2023['url']},
    {'name': 'Hunt & Reffert (2024); Gaia DR3 cluster masses, tidal radii and member counts', 'url': HUNT_REFFERT_2024['url']},
    {'name': 'Netopil et al. (2016); spectroscopic cluster metallicities', 'url': NETOPIL_2016['url']},
    {'name': 'Alfonso & García-Varela (2023); Gaia DR3 distance to the Pleiades', 'url': 'https://doi.org/10.1051/0004-6361/202346569'},
    {'name': 'Stauffer, Schultz & Kirkpatrick (1998); lithium-depletion-boundary age of the Pleiades', 'url': 'https://doi.org/10.1086/311379'},
    {'name': 'Martín et al. (2018); lithium-depletion-boundary age of the Hyades', 'url': 'https://doi.org/10.3847/1538-4357/aaaeb8'},
    {'name': 'Douglas et al. (2019); compiled isochrone age of the Beehive Cluster', 'url': 'https://doi.org/10.3847/1538-4357/ab2468'},
    {'name': 'Currie et al. (2010); age of the Double Cluster', 'url': CURRIE_2010['url']},
    {'name': 'Dalessandro et al. (2021); radial velocity of the Double Cluster', 'url': DALESSANDRO_2021['url']},
    {'name': 'Fanelli et al. (2022); metallicity of the red supergiants around the Double Cluster', 'url': FANELLI_2022['url']},
    {'name': 'Reyes et al. (2025); asteroseismic age of Messier 67', 'url': 'https://doi.org/10.1093/mnras/staf353'},
    {'name': 'Fritzewski et al. (2019); isochrone age of NGC 3532', 'url': 'https://doi.org/10.1051/0004-6361/201833587'},
    {'name': 'Baumgardt et al.; globular cluster masses, core, half-light and tidal radii and radial velocities', 'url': 'https://people.smp.uq.edu.au/HolgerBaumgardt/globular/'},
    {'name': 'Baumgardt & Vasiliev (2021); globular cluster distances', 'url': 'https://doi.org/10.1093/mnras/stab1474'},
    {'name': 'Vasiliev & Baumgardt (2021); Gaia EDR3 globular cluster proper motions', 'url': 'https://doi.org/10.1093/mnras/stab1475'},
    {'name': 'Carretta et al. (2009); globular cluster metallicities', 'url': 'https://doi.org/10.1051/0004-6361/200913003'},
    {'name': 'VandenBerg et al. (2013); globular cluster ages', 'url': 'https://doi.org/10.1088/0004-637X/775/2/134'},
    {'name': 'Clontz et al. (2024); ages of Omega Centauri subgiants', 'url': 'https://arxiv.org/abs/2409.13855'},
    {'name': 'Origlia et al. (2011); metallicity of the two populations of Terzan 5', 'url': 'https://doi.org/10.1088/2041-8205/726/2/L20'},
    {'name': 'Zullo et al. (2026); ages of the populations of Terzan 5 from Webb and Hubble', 'url': 'https://doi.org/10.1051/0004-6361/202659349'},
    {'name': 'Ferraro et al. (2016); first ages of the two populations of Terzan 5', 'url': 'https://doi.org/10.3847/0004-637X/828/2/75'},
]


def read_tsv(name: str, key: str) -> dict[str, dict[str, str]]:
    with (WORK / name).open(newline='') as file:
        return {row[key].strip(): row for row in csv.DictReader(file, delimiter='\t')}


def rotate(vector: tuple[float, float, float]) -> list[float]:
    return [sum(row[i] * vector[i] for i in range(3)) for row in ICRS_TO_GALACTIC]


def galactic(ra_deg: float, dec_deg: float, distance_pc: float, pm_ra: float, pm_dec: float, rv: float) -> tuple[list[float], list[float]]:
    """Heliocentric Galactic position (pc) and space velocity (km/s)."""
    alpha, delta = math.radians(ra_deg), math.radians(dec_deg)
    toward = (math.cos(delta) * math.cos(alpha), math.cos(delta) * math.sin(alpha), math.sin(delta))
    east = (-math.sin(alpha), math.cos(alpha), 0.0)
    north = (-math.sin(delta) * math.cos(alpha), -math.sin(delta) * math.sin(alpha), math.cos(delta))
    scale = KM_S_PER_MAS_YR_KPC * distance_pc / 1000
    velocity = tuple(rv * toward[i] + scale * (pm_ra * east[i] + pm_dec * north[i]) for i in range(3))
    return [round(value, 6) for value in rotate(tuple(distance_pc * axis for axis in toward))], [round(value, 3) for value in rotate(velocity)]


def catalog_ids(catalog: str) -> set[str]:
    overlay = ROOT / f'src/data/overlays/{catalog}/objects.json'
    if overlay.exists():
        return {row['id'] for row in json.loads(overlay.read_text())['objects']}
    with (ROOT / f'src/data/catalogs/{catalog}/stars.csv').open(newline='') as file:
        return {row['id'] for row in csv.DictReader(file)}


def record(cluster: dict, rows: dict, metallicities: dict, members_available: dict[str, set[str]]) -> dict:
    row = rows[cluster['row']]
    number = lambda key: float(row[key])
    ra, dec = number('RA_ICRS'), number('DE_ICRS')
    distance = cluster['distance']
    if distance[0] == 'hunt-reffert':
        distance_pc = round(number('dist50'), 3)
        distance_error = round(max(number('dist84') - number('dist50'), number('dist50') - number('dist16')), 3)
        distance_method, distance_source = distance[1], distance[2]
    else:
        distance_pc, distance_error, distance_method, distance_source = distance
    radial_velocity = cluster.get('radial_velocity') or (round(number('RV'), 2), round(number('e_RV'), 2), HUNT_REFFERT_2023)
    motion_velocity = radial_velocity[0] if 'radial_velocity' in cluster else number('RV')
    position, velocity = galactic(ra, dec, distance_pc, number('pmRA'), number('pmDE'), motion_velocity)
    if 'metallicity' in cluster:
        metallicity = cluster['metallicity']
    else:
        row_metallicity = metallicities[cluster['metallicity_row']]
        metallicity = (float(row_metallicity['[Fe/H]HQS']), float(row_metallicity['e_[Fe/H]HQS']), NETOPIL_2016)
    missing = [f'{catalog}/{member}' for catalog, member, _ in cluster['notable_members'] if member not in members_available[catalog]]
    if missing:
        raise SystemExit(f'{cluster["id"]}: notable members missing from their catalogs: {", ".join(missing)}')
    longitude = math.degrees(math.atan2(position[1], position[0])) % 360
    latitude = math.degrees(math.asin(position[2] / math.hypot(*position)))
    details = {
        'ra_deg': ra, 'dec_deg': dec,
        'distance_pc': distance_pc, 'distance_error_pc': distance_error,
        'distance_method': distance_method, 'distance_source': distance_source,
        'age_myr': cluster['age_myr'], 'age_error_myr': cluster['age_error_myr'],
        'age_method': cluster['age_method'], 'age_source': cluster['age_source'],
        'metallicity_fe_h': metallicity[0], 'metallicity_error_dex': metallicity[1],
        'metallicity_source': metallicity[2],
        'members_within_tidal_radius': int(row['NJ']), 'members_total': int(row['N']),
        'members_source': HUNT_REFFERT_2024,
        'mass_solar': round(number('MassJ')), 'mass_error_solar': round(number('e_MassJ')),
        'half_member_radius_pc': round(number('r50Jpc'), 2), 'core_radius_pc': None, 'tidal_radius_pc': round(number('rJpc'), 2),
        'structure_source': HUNT_REFFERT_2024,
        'radial_velocity_kms': radial_velocity[0], 'radial_velocity_error_kms': radial_velocity[1],
        'radial_velocity_source': radial_velocity[2],
        'notable_members': [{'catalog': catalog, 'id': member, 'name': name} for catalog, member, name in cluster['notable_members']],
        'palette': cluster['palette'],
        'position_source': f'Hunt & Reffert (2023) Gaia DR3 member center (l = {longitude:.2f}°, b = {latitude:.2f}°) at the {distance_source["label"]} distance',
        'model_note': 'The glow stands in for the faint members that the catalogs do not hold: a Plummer sphere with the published half-member radius, cut at the tidal radius. It fades as the camera comes close enough to see the member stars. Its colors are illustrative.',
    }
    return {
        'type': 'open_cluster', 'id': cluster['id'], 'name': cluster['name'], 'designations': cluster['designations'],
        'spectral_type': None, 'constellation': cluster['constellation'],
        'x_pc': position[0], 'y_pc': position[1], 'z_pc': position[2],
        'vx_kms': velocity[0], 'vy_kms': velocity[1], 'vz_kms': velocity[2],
        'temperature_k': None, 'mass_solar': None, 'luminosity_solar': None, 'radius_solar': None,
        'metallicity_dex': None, 'age_gyr': None, 'absolute_mag': None, 'epoch': 2000,
        'notes': cluster['notes'] + (' Space velocity from the mean Gaia DR3 proper motion and radial velocity of the members (Hunt & Reffert 2023).'
                                     if 'radial_velocity' not in cluster else ' Space velocity from the mean Gaia DR3 proper motion of the members (Hunt & Reffert 2023) and this radial velocity.'),
        'raw_astrometry': None,
        'cluster': details,
    }


BAUMGARDT_DATABASE = source('Baumgardt et al., Fundamental parameters of Galactic globular clusters (N-body fits)', 'https://people.smp.uq.edu.au/HolgerBaumgardt/globular/parameter.html')
BAUMGARDT_VASILIEV_2021 = source('Baumgardt & Vasiliev (2021), accurate distances to Galactic globular clusters', 'https://doi.org/10.1093/mnras/stab1474')
VASILIEV_BAUMGARDT_2021 = source('Vasiliev & Baumgardt (2021), Gaia EDR3 view on Galactic globular clusters', 'https://doi.org/10.1093/mnras/stab1475')
CARRETTA_2009 = source('Carretta et al. (2009), a new metallicity scale for globular clusters', 'https://doi.org/10.1051/0004-6361/200913003')
VANDENBERG_2013 = source('VandenBerg et al. (2013), ages of 55 globular clusters', 'https://doi.org/10.1088/0004-637X/775/2/134')
VANDENBERG_METHODS = {
    'V': 'Isochrone fit to the turnoff and subgiant branch (vertical method)',
    'H': 'Isochrone fit to the turnoff color (horizontal method)',
    'A': 'Mean of two isochrone fits to the turnoff and subgiant branch',
}
COMPACT = 'compact-remnants'
GLOBULAR_PALETTE = {'real': '#fff0d8', 'exaggerated': '#ffd69a'}
METAL_RICH_GLOBULAR_PALETTE = {'real': '#ffe6c2', 'exaggerated': '#ffc77a'}

GLOBULARS = [
    {
        'id': 'omega-centauri', 'name': 'Omega Centauri', 'row': 'NGC 5139', 'metallicity_row': 'NGC5139',
        'designations': ['NGC 5139', 'ω Centauri', 'ω Cen', 'Caldwell 80'], 'constellation': 'Centaurus',
        'notes': 'The most massive globular cluster of the Milky Way. Its stars formed over more than a billion years and differ widely in iron, so it is thought to be the core of a dwarf galaxy the Milky Way swallowed. [Fe/H] is the Harris (1996) value on the Carretta et al. (2009) scale, a mean over its populations.',
        'age_myr': 12080, 'age_error_myr': 750,
        'age_method': 'Mean age of about 8,100 subgiants fitted one by one; the ± is the spread of their ages',
        'age_source': source('Clontz et al. (2024), oMEGACat IV', 'https://arxiv.org/abs/2409.13855'),
        'notable_members': [], 'palette': GLOBULAR_PALETTE,
    },
    {
        'id': '47-tucanae', 'name': '47 Tucanae', 'row': 'NGC 104', 'metallicity_row': 'NGC104', 'age_row': '104',
        'designations': ['NGC 104', '47 Tuc', 'Caldwell 106'], 'constellation': 'Tucana',
        'notes': 'The second brightest globular cluster in the sky, after Omega Centauri. It appears beside the Small Magellanic Cloud, a separate galaxy more than ten times farther away.',
        'notable_members': [], 'palette': METAL_RICH_GLOBULAR_PALETTE,
    },
    {
        'id': 'messier-4', 'name': 'Messier 4', 'row': 'NGC 6121', 'metallicity_row': 'NGC6121', 'age_row': '6121',
        'designations': ['M4', 'NGC 6121', 'Spider Globular Cluster'], 'constellation': 'Scorpius',
        'notes': 'The nearest globular cluster, 1.3° west of Antares. The pulsar PSR B1620-26, orbited by a white dwarf and a planet, lies just outside its core.',
        'notable_members': [(COMPACT, 'psr-j1623m2631', 'PSR B1620-26')], 'palette': GLOBULAR_PALETTE,
    },
    {
        'id': 'messier-13', 'name': 'Messier 13', 'row': 'NGC 6205', 'metallicity_row': 'NGC6205', 'age_row': '6205',
        'designations': ['M13', 'NGC 6205', 'Hercules Globular Cluster', 'Great Globular Cluster in Hercules'], 'constellation': 'Hercules',
        'notes': 'The brightest globular cluster of the northern sky, in the Keystone of Hercules. The Arecibo message of 1974 was beamed toward it.',
        'notable_members': [], 'palette': GLOBULAR_PALETTE,
    },
    {
        'id': 'messier-22', 'name': 'Messier 22', 'row': 'NGC 6656', 'metallicity_row': 'NGC6656', 'age_row': '6656',
        'designations': ['M22', 'NGC 6656', 'Great Sagittarius Cluster'], 'constellation': 'Sagittarius',
        'notes': 'One of the nearest globular clusters, in front of the Galactic bulge near the Teapot of Sagittarius.',
        'notable_members': [], 'palette': GLOBULAR_PALETTE,
    },
    {
        'id': 'messier-15', 'name': 'Messier 15', 'row': 'NGC 7078', 'metallicity_row': 'NGC7078', 'age_row': '7078',
        'designations': ['M15', 'NGC 7078', 'Great Pegasus Cluster'], 'constellation': 'Pegasus',
        'notes': 'One of the densest globular clusters: its core has collapsed. It holds Pease 1, the first planetary nebula found in a globular cluster, too small to draw here.',
        'notable_members': [], 'palette': GLOBULAR_PALETTE,
    },
    {
        'id': 'terzan-5', 'name': 'Terzan 5', 'row': 'Ter 5',
        'designations': ['Ter 5', 'Terzan 11'], 'constellation': 'Sagittarius',
        'notes': 'Hidden behind thick dust near the Galactic center and seen mostly in infrared light. It holds the most millisecond pulsars of any cluster. Long classed as a globular cluster, it formed stars in several bursts and is now thought to be a fossil fragment of the young Galactic bulge. [Fe/H] and the age are those of the dominant old population; the main younger population, 4.7 ± 0.5 billion years old (Zullo et al. 2026), is richer in iron than the Sun, [Fe/H] = +0.27 (Origlia et al. 2011). The Carretta et al. (2009) value, +0.16 from the Harris (1996) catalog, blends both and is not adopted; Ferraro et al. (2016) gave 12 ± 1 billion years for the old population.',
        'metallicity': (-0.25, 0.07, source('Origlia et al. (2011), the metal-poor population of Terzan 5; ± is the star-to-star spread', 'https://doi.org/10.1088/2041-8205/726/2/L20')),
        'age_myr': 12500, 'age_error_myr': 500,
        'age_method': 'Isochrone fit to the older of two main-sequence turnoffs in Webb and Hubble photometry',
        'age_source': source('Zullo et al. (2026)', 'https://doi.org/10.1051/0004-6361/202659349'),
        'notable_members': [(COMPACT, 'psr-j1748m2446ad', 'PSR J1748-2446ad')], 'palette': METAL_RICH_GLOBULAR_PALETTE,
    },
]


def globular_record(cluster: dict, rows: dict, metallicities: dict, ages: dict, members_available: dict[str, set[str]]) -> dict:
    row = rows[cluster['row']]
    number = lambda key: float(row[key])
    ra, dec = number('RA_ICRS'), number('DE_ICRS')
    distance_pc, distance_error = round(number('Rsun_kpc') * 1000), round(number('e_Rsun_kpc') * 1000)
    position, velocity = galactic(ra, dec, distance_pc, number('pmRA'), number('pmDE'), number('RV'))
    if 'metallicity' in cluster:
        metallicity = cluster['metallicity']
    else:
        row_metallicity = metallicities[cluster['metallicity_row']]
        metallicity = (float(row_metallicity['[Fe/H]']), float(row_metallicity['e_[Fe/H]']), CARRETTA_2009)
    if 'age_row' in cluster:
        age = ages[cluster['age_row']]
        age_myr, age_error, age_method, age_source = round(float(age['Age_Gyr']) * 1000), round(float(age['e_Age_Gyr']) * 1000), VANDENBERG_METHODS[age['Method']], VANDENBERG_2013
    else:
        age_myr, age_error, age_method, age_source = cluster['age_myr'], cluster['age_error_myr'], cluster['age_method'], cluster['age_source']
    missing = [f'{catalog}/{member}' for catalog, member, _ in cluster['notable_members'] if member not in members_available[catalog]]
    if missing:
        raise SystemExit(f'{cluster["id"]}: notable members missing from their catalogs: {", ".join(missing)}')
    details = {
        'ra_deg': ra, 'dec_deg': dec,
        'distance_pc': distance_pc, 'distance_error_pc': distance_error,
        'distance_method': 'Gaia EDR3 parallaxes combined with kinematic, photometric and earlier distances',
        'distance_source': BAUMGARDT_VASILIEV_2021,
        'age_myr': age_myr, 'age_error_myr': age_error, 'age_method': age_method, 'age_source': age_source,
        'metallicity_fe_h': metallicity[0], 'metallicity_error_dex': metallicity[1], 'metallicity_source': metallicity[2],
        'members_within_tidal_radius': None, 'members_total': None, 'members_source': None,
        'mass_solar': round(number('Mass')), 'mass_error_solar': round(number('e_Mass')),
        'half_member_radius_pc': number('rhl_pc'), 'core_radius_pc': number('rc_pc'), 'tidal_radius_pc': number('rt_pc'),
        'structure_source': BAUMGARDT_DATABASE,
        'radial_velocity_kms': number('RV'), 'radial_velocity_error_kms': number('e_RV'), 'radial_velocity_source': BAUMGARDT_DATABASE,
        'notable_members': [{'catalog': catalog, 'id': member, 'name': name} for catalog, member, name in cluster['notable_members']],
        'palette': cluster['palette'],
        'position_source': f'Cluster center {"of Lanzoni et al. (2010)" if cluster["row"] == "Ter 5" else "of Goldsbury et al. (2010)"} at the Baumgardt & Vasiliev (2021) distance',
        'model_note': 'The glow stands in for the cluster’s stars: an Elson–Fall–Freeman profile fitted to the published core and half-light radii, cut at the tidal radius. Its brightest giants are drawn as stars that resolve as the camera comes close; their number, places and colors are illustrative.',
    }
    return {
        'type': 'globular_cluster', 'id': cluster['id'], 'name': cluster['name'], 'designations': cluster['designations'],
        'spectral_type': None, 'constellation': cluster['constellation'],
        'x_pc': position[0], 'y_pc': position[1], 'z_pc': position[2],
        'vx_kms': velocity[0], 'vy_kms': velocity[1], 'vz_kms': velocity[2],
        'temperature_k': None, 'mass_solar': None, 'luminosity_solar': None, 'radius_solar': None,
        'metallicity_dex': None, 'age_gyr': None, 'absolute_mag': None, 'epoch': 2000,
        'notes': cluster['notes'] + ' Space velocity from the Gaia EDR3 proper motion (Vasiliev & Baumgardt 2021) and the mean radial velocity of the members.',
        'raw_astrometry': None,
        'cluster': details,
    }


def files() -> dict[str, str]:
    rows = read_tsv('hunt-reffert-2024.tsv', 'Name')
    metallicities = read_tsv('netopil-2016.tsv', 'Cluster')
    members_available = {catalog: catalog_ids(catalog) for catalog in {member[0] for cluster in CLUSTERS + GLOBULARS for member in cluster['notable_members']}}
    globular_rows = read_tsv('baumgardt-globular-clusters.tsv', 'Cluster')
    globular_metallicities = read_tsv('carretta-2009.tsv', 'Cluster')
    ages = read_tsv('vandenberg-2013.tsv', 'NGC')
    objects = [record(cluster, rows, metallicities, members_available) for cluster in CLUSTERS] + [
        globular_record(cluster, globular_rows, globular_metallicities, ages, members_available) for cluster in GLOBULARS]
    manifest = {
        'schemaVersion': 1,
        'id': 'star-clusters',
        'label': 'Star clusters',
        'description': 'Landmark open clusters, from the nearby Hyades and Pleiades to the Double Cluster in the Perseus Arm, and landmark globular clusters, from the nearby Messier 4 to Omega Centauri and Terzan 5. Each is drawn as a soft glow for its faint members; the bright members of the nearby open clusters are the stars of the bundled catalogs, and the brightest giants of a globular cluster resolve as the camera approaches.',
        'epoch': 2000,
        'objectCount': len(objects),
        'counts': {kind: sum(row['type'] == kind for row in objects) for kind in ('open_cluster', 'globular_cluster')},
        'sources': SOURCES,
        'cutoffPolicy': 'Reviewed landmark open clusters: the Hyades, the Pleiades, the Beehive Cluster, the two halves of the Double Cluster, Messier 67 and NGC 3532; further open clusters follow from the Hunt & Reffert (2024) census. Reviewed landmark globular clusters: Omega Centauri, 47 Tucanae, Messier 4, Messier 13, Messier 22, Messier 15 and Terzan 5; further globular clusters follow from Baumgardt’s database.',
        'snapshot': 'J2000 Galactic frame; values reviewed 2026-11-18.',
    }
    dump = lambda value: json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    return {
        'manifest.json': dump(manifest),
        'objects.json': dump({'schemaVersion': 1, 'overlayId': 'star-clusters', 'objects': objects}),
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
        print(f'Wrote {len(CLUSTERS) + len(GLOBULARS)} star clusters to {DIRECTORY.relative_to(ROOT)}.')
        return 0
    stale = [name for name, content in expected.items() if not (DIRECTORY / name).exists() or (DIRECTORY / name).read_text() != content]
    if stale:
        print(f'Star-cluster overlay is out of date: {", ".join(stale)}. Run scripts/author-star-clusters.py --write.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
