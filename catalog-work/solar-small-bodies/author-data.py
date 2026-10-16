"""Build additive small-body coverage from frozen measurements and reviewed literature.

The original JPL responses retain all parameters, uncertainties and references,
including unresolved photometry and older measurements not adopted in the UI.
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ORDER = 'ceres vesta pallas hygiea pluto eris haumea makemake gonggong quaoar orcus sedna salacia mani aya varda chiminigagua achlys'.split()
NAMES = {'mani': 'Máni'}
COLORS = {'ceres': '#aaa59e', 'vesta': '#b5a28c', 'pallas': '#aaaeb1', 'hygiea': '#8b8580', 'pluto': '#c6ad95', 'eris': '#e0ded7', 'haumea': '#d7d3c8', 'makemake': '#bba28b', 'gonggong': '#ad816f', 'quaoar': '#b49a84', 'orcus': '#b9bbb8', 'sedna': '#b97867'}
PLUTO = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html'
COOL = 'https://arxiv.org/abs/1204.0697'
GRUNDY = 'https://www2.lowell.edu/users/grundy/abstracts/preprints/2019.TNB_orbits.pdf'

# Diameter, uncertainty, exact scope/method, primary publication.
SIZES = {
    'pluto': (2376.6, '±3.2 km', 'Twice the New Horizons volumetric mean radius, 1188.3 ± 1.6 km.', 'https://doi.org/10.1016/j.icarus.2016.06.027'),
    'eris': (2326, '±12 km', 'Stellar-occultation diameter of Eris alone.', 'https://doi.org/10.1038/nature10550'),
    'haumea': (1595, None, 'Volume-equivalent diameter calculated from the model axes 2322 × 1704 × 1026 km. Haumea is strongly elongated; this is not its longest dimension.', 'https://doi.org/10.1038/nature24051'),
    'makemake': (1430, '±9 km', 'Occultation equivalent diameter; spherical interpretation of the projected limb.', 'https://doi.org/10.1038/nature11597'),
    'gonggong': (1230, '±50 km', 'Thermal-model diameter of the primary, accounting for its satellite.', 'https://doi.org/10.1016/j.icarus.2019.03.013'),
    'quaoar': (1094.4, '±4.6 km', 'Volumetric equivalent diameter from the 2026 joint analysis of 37 stellar occultations. Supersedes the earlier projected 1110 km estimate.', 'https://arxiv.org/abs/2607.06450'),
    'orcus': (910, '+50 / −40 km', 'ALMA radiometric diameter resolved separately from Vanth.', 'https://doi.org/10.3847/1538-3881/aad9f2'),
    'sedna': (995, '±80 km', 'Herschel thermal-model diameter; model dependent, not a resolved surface.', 'https://doi.org/10.1051/0004-6361/201219935'),
    'salacia': (846, '±21 km', 'Primary diameter inferred by splitting combined thermal area with the measured brightness difference, assuming equal albedos.', GRUNDY),
    'mani': (796, '±24 km', 'Projected area-equivalent diameter from the 8 August 2020 stellar occultation; not a volumetric diameter.', 'https://arxiv.org/abs/2308.08062'),
    'aya': (768, '±38 km', 'Herschel thermal-model diameter of 2002 AW197; model dependent.', COOL),
    'varda': (740, '±14 km', 'Projected area-equivalent diameter from the 2018 occultation. Not a volumetric radius or the unresolved Varda–Ilmarë diameter; 2026 work still cannot fully constrain the three-dimensional shape.', 'https://arxiv.org/abs/2008.04818'),
    'chiminigagua': (740, '+85 / −90 km', 'Primary diameter after removing the satellite’s light, assuming equal albedos. The combined system diameter of 765 km is not assigned to the primary.', 'https://arxiv.org/abs/1809.02184'),
    # The occultation result depends on an ellipsoid model and rotational phase.
    'achlys': (2*(470*383*245)**(1/3), None, 'Volume-equivalent diameter calculated from the 2017 Jacobi ellipsoid model with semi-axes 470 × 383 × 245 km. Model dependent; published axis uncertainties are ±20, ±10 and ±8 km and have not been propagated.', 'https://arxiv.org/abs/1705.10895'),
}

def measurement(value, source, detail, uncertainty=None):
    return dict(value=value, uncertainty=uncertainty, source=source, detail=detail)

MOONS = {}
def moon(host, id, name, radius=None, a=None, period=None, source=None, note='', mass=None, gravity=None):
    entry = dict(id=id, name=name, source=source or GRUNDY, sourceLabel='Reviewed published satellite measurements',
        meanRadiusKm=radius, massKg=mass, surfaceGravityMs2=gravity, semiMajorAxisKm=a,
        siderealOrbitDays=period, phaseCycleDays=None)
    if note:
        for field in ['meanRadiusDetail', 'massDetail', 'surfaceGravityDetail', 'semiMajorAxisDetail', 'siderealOrbitDetail']:
            entry[field] = note
    entry['phaseCycleDetail'] = 'No adopted phase-cycle measurement. It is not inferred from an unknown orbital direction or unresolved orbit.'
    if host=='pluto' and id!='charon': entry['orbitReference']='barycenter'
    MOONS.setdefault(host, []).append(entry)

moon('pluto', 'charon', 'Charon', 606, 19596, 6.3872, PLUTO, mass=1.586e21, gravity=0.29)
for id, name, dimensions, a, period in [
    ('styx', 'Styx', [10.5]*3, 42413, 20.16),
    ('nix', 'Nix', [48.4,33.8,31.4], 48690, 24.85),
    ('kerberos', 'Kerberos', [19,10,9], 57750, 32.17),
    ('hydra', 'Hydra', [62,36.5,29.3], 64721, 38.20),
]:
    moon('pluto',id,name,round(math.prod(dimensions)**(1/3)/2,2),a,period,PLUTO,
        'Orbital elements are relative to the Pluto–Charon barycenter, not Pluto’s center. Radius is the volume-equivalent radius from the NASA reference dimensions; the body is irregular.')
moon('eris', 'dysnomia', 'Dysnomia', None, 37273, 15.785899, 'https://ntrs.nasa.gov/citations/20210012932', 'Moon size and mass are not assigned from the total Eris–Dysnomia system. Orbital semi-major axis and period: Holler et al. (2021).')
moon('haumea', 'namaka', 'Namaka', None, 25657, 18.2783, 'https://doi.org/10.1088/0004-6256/137/6/4766', 'Orbital solution: Ragozzine & Brown (2009). Individual size and mass are model dependent and not adopted here.')
moon('haumea', 'hiiaka', 'Hiʻiaka', None, 49880, 49.462, 'https://doi.org/10.1088/0004-6256/137/6/4766', 'Orbital solution: Ragozzine & Brown (2009). Individual size and mass are model dependent and not adopted here.')
moon('makemake', 'mk2', 'S/2015 (136472) 1', None, None, None, 'https://arxiv.org/abs/2509.05880', 'Also called MK2. A preliminary 2025 orbit has multiple possible solutions; no unique orbital size or period is adopted.')
moon('gonggong', 'xiangliu', 'Xiangliu', None, 24021, 25.22073, 'https://doi.org/10.1016/j.icarus.2019.03.013', 'Published mutual-orbit solution. Individual moon size and mass remain model dependent.')
moon('quaoar', 'weywot', 'Weywot', None, 13289, 12.438, 'https://doi.org/10.1016/j.icarus.2012.11.018', 'Mutual-orbit solution, Fraser et al. (2013). Moon size is not assigned from unresolved system photometry.')
moon('quaoar', 'quaoar-candidate', 'Possible moon / arc', None, None, None, 'https://doi.org/10.3847/2041-8213/ae4751', 'An opaque feature detected by a June 2025 occultation. A small satellite and a dense ring arc remain alternative interpretations; no confirmed second moon or unique orbital elements are asserted.')
moon('orcus', 'vanth', 'Vanth', 237.5, 8980, 9.5393, 'https://doi.org/10.3847/1538-3881/aad9f2', 'Resolved ALMA thermal diameter 475 ± 75 km gives radius 237.5 ± 37.5 km. Orbit: Brown et al. (2010), https://doi.org/10.1088/0004-6256/139/6/2700 .')
moon('salacia', 'actaea', 'Actaea', 142, 5619, 5.49380, GRUNDY, 'Radius 142 ± 5 km assumes the same albedo as Salacia; it is not directly resolved. Mutual orbit: Grundy et al. (2019).')
moon('varda', 'ilmare', 'Ilmarë', None, 4809, 5.75058, 'https://doi.org/10.1016/j.icarus.2015.03.036', 'Grundy et al. (2015) mutual orbit. No individual size or mass is adopted from the combined thermal measurement.')
moon('chiminigagua', 'chiminigagua-companion', 'Unnamed companion', 95, None, None, 'https://arxiv.org/abs/1809.02184', 'Diameter about 190 km assumes equal albedos. Detected by Hubble in 2018; no unique mutual-orbit solution adopted. No official satellite name is assigned here.')
moon('achlys', 'achlys-companion', 'Reported companion', None, None, None, 'https://arxiv.org/abs/1705.10895', 'Faint companion reported in 2005, with uncertain recovery and orbit. Treat as a reported satellite rather than a securely characterized moon; physical values are unavailable.')
moon('mani', 'mani-candidate', 'Possible companion', None, None, None, 'https://arxiv.org/abs/2605.22296', 'A 2026 thermal-versus-occultation analysis suggests an unresolved companion. This is indirect evidence, not a directly detected or confirmed moon; no physical values or orbital solution are adopted.')

objects = []
for id in ORDER:
    raw = json.loads((HERE / f'{id}-sbdb.json').read_text())
    number = int(raw['object']['des'])
    source = f'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr={number}'
    physical = {p['name']: p for p in raw['phys_par']}
    elements = {p['name']: p for p in raw['orbit']['elements']}
    epoch = f"JD {raw['orbit']['epoch']} TDB, J2000 ecliptic"
    metrics = {}
    def adopt(key, parameter, factor=1, detail=''):
        metrics[key] = measurement(float(parameter['value'])*factor, source,
            f"{detail} JPL reference: {parameter.get('ref') or 'orbital solution '+raw['orbit']['orbit_id']}. {parameter.get('notes') or ''}".strip(),
            parameter.get('sigma'))
    for key,p,factor,detail in [
        ('semi-major-axis','a',1,'Osculating heliocentric orbital semi-major axis, not an instantaneous distance.'),
        ('orbital-period','per',1/365.25,'Osculating Keplerian period expressed in Julian years.'),
        ('eccentricity','e',1,'Orbital eccentricity.'),
        ('inclination','i',1,'Inclination to the J2000 ecliptic.'),
        ('perihelion','q',1,'Perihelion distance for this osculating solution.'),
        ('aphelion','ad',1,'Aphelion distance for this osculating solution.'),
    ]:
        adopt(key,elements[p],factor,detail+f' Epoch: {epoch}.')
        if factor != 1 and metrics[key]['uncertainty']:
            metrics[key]['uncertainty'] = f"±{float(elements[p]['sigma'])*factor:.4g} yr (converted from days)"
    if id not in MOONS:
        adopt('absolute-magnitude',physical['H'],detail='Absolute visual magnitude H: 1 AU from both Sun and observer, at zero phase.')
    if id in SIZES:
        d,err,note,url = SIZES[id]
        metrics['mean-diameter'] = measurement(d,url,note,err)
    elif 'diameter' in physical:
        adopt('mean-diameter',physical['diameter'],detail=physical['diameter']['desc'])
    if 'mean-diameter' in metrics:
        d=metrics['mean-diameter']
        metrics['mean-radius'] = measurement(d['value']/2,d['source'],'Half the adopted diameter. '+d['detail'], 'Half the diameter uncertainty: '+str(d['uncertainty']) if d['uncertainty'] else None)
    if id in ORDER[:4]:
        for key,p,detail in [('mean-density','density','Bulk density in g/cm³.'),('geometric-albedo','albedo','Geometric visible albedo; not Bond albedo.'),('sidereal-rotation-period','rot_per','Sidereal rotation in hours, relative to the stars; not the solar day.')]:
            if p in physical: adopt(key,physical[p],detail=detail)
        if 'GM' in physical:
            adopt('mass',physical['GM'],1e9/6.67430e-11,'Individual-body mass derived from the measured GM using G = 6.67430 × 10⁻¹¹ m³ kg⁻¹ s⁻².')
            metrics['mass']['uncertainty'] = ('Original GM uncertainty: '+str(physical['GM']['sigma'])+' km³/s²; uncertainty in G is not propagated.')
    elif id in ['pluto','haumea','sedna']:
        adopt('sidereal-rotation-period',physical['rot_per'],detail='Sidereal rotation in hours; positive duration.'+(' Pluto rotates retrograde.' if id=='pluto' else ''))
    if id=='eris':
        metrics['sidereal-rotation-period']=measurement(15.78590*24,'https://arxiv.org/abs/2303.13445','Synchronous rotation with Dysnomia; replaces the older 25.9-hour value retained in the raw JPL record.','±0.0012 h')
    if id=='pluto':
        metrics['mass']=measurement(1.303e22,PLUTO,'Individual Pluto mass; excludes Charon and the other moons.')
        metrics['mean-density']=measurement(1.854,PLUTO,'Individual Pluto bulk density.')
        metrics['surface-gravity']=measurement(0.62,PLUTO,'NASA mean surface gravity.')
    obj = dict(kind='small-body',id=id,name=NAMES.get(id,raw['discovery'].get('name') or id.title()),hostStarId='sun',
        group='asteroid-belt' if id in ORDER[:4] else 'dwarf-planets',number=number,
        designation=raw['object']['fullname'],color=COLORS.get(id,'#b7afa4'),moonCount=len(MOONS.get(id,[])),
        semiMajorAxisAu=float(elements['a']['value']),orbitEpoch=epoch,metrics=metrics)
    objects.append(obj)

output = dict(reviewed='2026-10-14',sourcePolicy='Exact numbered JPL identities. Individual measurements only; unadopted and system-scoped measurements remain in frozen source records. Missing values are unknown.',objects=objects,moons=MOONS)
(ROOT/'src/data/solar-small-bodies.json').write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n')
print(f'Authored {len(objects)} objects and {sum(map(len,MOONS.values()))} satellites; existing catalogs untouched.')
