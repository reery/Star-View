#!/usr/bin/env python3
"""Author Wavelength vision photometry: measured brightness outside visible light.

Every value is joined by exact identity: Gaia DR3 source IDs, catalog designations as SIMBAD lists them, 4FGL
names, UltracoolSheet names and aliases, and reviewed remnant names. Nothing is matched by position except the
compact objects' eRASS1 counterparts, which are few and listed for review. Automatic flags keep suspicious values out of the shipped files and list them
in review.json instead.

--refresh downloads the sources (or reuses catalog-work/downloads/wavelength-photometry) and freezes the matched rows
in catalog-work/wavelength-photometry; without it the frozen rows are rebuilt into src/data/wavelength/<band>.json.
--check compares the shipped files without writing them.

Usage: author-wavelength-photometry.py [--refresh --retrieved YYYY-MM-DD] [--check]
"""

import argparse
import csv
import hashlib
import io
import json
import math
import re
import statistics
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from catalog_sources.filesystem import write_managed_files

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'catalog-work/wavelength-photometry'
DOWNLOADS = ROOT / 'catalog-work/downloads/wavelength-photometry'
OUTPUT = ROOT / 'src/data/wavelength'
GENERATED = ROOT / 'src/data/generated'

# The CDS servers are down (2026-11); the IDIA VizieR mirror and the CfA SIMBAD mirror serve the same catalogs.
VIZIER = 'https://vizier.idia.ac.za/viz-bin/asu-tsv'
GAIA_TAP = 'https://gea.esac.esa.int/tap-server/tap/sync'
SIMBAD_TAP = 'https://simbad.cfa.harvard.edu/simbad/sim-tap/sync'
FERMI_4FGL = 'https://fermi.gsfc.nasa.gov/ssc/data/access/lat/14yr_catalog/gll_psc_v35.fit'
TWO_MASS_BIBCODE = '2003yCat.2246....0C'
ULTRACOOLSHEET = 'https://zenodo.org/records/15802304'
ULTRACOOLSHEET_FILE = 'https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20{}.csv/content'

STELLAR_TYPES = {'star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'}
# Counterpart probability above which a single counterpart is adopted (Freund et al. 2022, 2024).
MATCH_PROBABILITY = 0.5
# Compact objects' eRASS1 counterparts: search radius in arcsec around their catalogued positions.
COMPACT_RADIUS_ARCSEC = 15
# Plausible V − K for stars and brown dwarfs (late T dwarfs reach about 13); outside it a K value is a likely mismatch.
V_MINUS_K_RANGE = (-1.5, 15)
# An UltracoolSheet K further than this from a 2MASS quality-A Ks is likely saturated (VISTA and UKIRT saturate near
# K 10–11.5) or a misidentification; MKO K and 2MASS Ks agree within about 0.15 mag for ultracool dwarfs.
ULTRACOOL_TWO_MASS_TOLERANCE = 0.25
# Wendker detections near 5 GHz, the most common frequency in the compilation (MHz).
RADIO_STAR_FREQUENCIES_MHZ = (4000, 6000)

# Reviewed exact identities of our remnants in Green's catalog and in 4FGL-DR4. The Vela entry is Vela X, the
# remnant's pulsar wind nebula; the Crab's is its inverse-Compton and synchrotron components.
GREEN_REMNANTS = {
    'cassiopeia-a': 'G111.7-02.1', 'crab-nebula': 'G184.6-05.8', 'vela-supernova-remnant': 'G263.9-03.3',
    'tychos-supernova-remnant': 'G120.1+01.4', 'keplers-supernova-remnant': 'G004.5+06.8', 'sn-1006': 'G327.6+14.6',
    'rcw-86': 'G315.4-02.3', 'rx-j1713-3946': 'G347.3-00.5', 'hoinga': 'G249.5+24.5', 'veil-nebula': 'G074.0-08.5',
    'simeis-147': 'G180.0-01.7', 'ic-443': 'G189.1+03.0', 'puppis-a': 'G260.4-03.4', 'w44': 'G034.7-00.4', 'g1-9p0-3': 'G001.9+00.3',
    'w50': 'G039.7-02.0', '3c-58': 'G130.7+03.1',
}
FERMI_REMNANTS = {
    'cassiopeia-a': ['4FGL J2323.4+5849'], 'crab-nebula': ['4FGL J0534.5+2201i', '4FGL J0534.5+2201s'],
    'vela-supernova-remnant': ['4FGL J0834.3-4542e'], 'tychos-supernova-remnant': ['4FGL J0025.3+6408'],
    'keplers-supernova-remnant': ['4FGL J1730.4-2131'], 'rx-j1713-3946': ['4FGL J1713.5-3945e'], 'rcw-86': ['4FGL J1443.0-6227e'],
    'veil-nebula': ['4FGL J2051.0+3049e'], 'ic-443': ['4FGL J0617.2+2234e'], 'w44': ['4FGL J1855.9+0121e'], 'puppis-a': ['4FGL J0822.1-4253e'],
    '3c-58': ['4FGL J0205.6+6449e'],
}
REMNANT_SCOPES = {
    'vela-supernova-remnant': 'Vela X, the pulsar wind nebula inside the remnant',
    'crab-nebula': 'The nebula’s inverse-Compton and synchrotron components, without the pulsar',
    '3c-58': 'The pulsar wind nebula, without PSR J0205+6449',
}

# Shipped sources: label, reference, catalog URL and what the value covers.
SOURCES = {
    'erass1': ('eRASS1 coronal counterparts', 'Freund et al. 2024, A&A 684, A121', f'{VIZIER}?-source=J/A+A/684/A121/like_ctp',
               '0.2–2.3 keV flux, SRG/eROSITA 2019–2020; unresolved within about 15″'),
    '2rxs': ('2RXS stellar counterparts', 'Freund et al. 2022, A&A 664, A105', f'{VIZIER}?-source=J/A+A/664/A105/main',
             '0.1–2.4 keV flux, ROSAT 1990–1991; unresolved within about 30″'),
    '1rxs': ('ROSAT All-Sky Survey (1RXS)', 'Voges et al. 1999, 2000; flux from count rate and HR1 after Schmitt et al. 1995',
             f'{VIZIER}?-source=IX/10A', '0.1–2.4 keV flux, ROSAT 1990–1991; SIMBAD’s 1RXS identification of the star or its system'),
    'erass1-main': ('eRASS1 main catalog', 'Merloni et al. 2024, A&A 682, A34', f'{VIZIER}?-source=J/A+A/682/A34',
                    '0.2–2.3 keV flux for a power-law spectrum; nearest source within 15″ of the catalogued position'),
    '2mass': ('2MASS Point Source Catalog', 'Skrutskie et al. 2006, AJ 131, 1163', f'{GAIA_TAP} (gaiadr1.tmass_original_valid)',
              'Ks magnitude; quality A–C, or saturated (D–E) with its larger error'),
    'ultracoolsheet-mko': ('UltracoolSheet v2.1.0, MKO K', 'Best, Dupuy, Liu, Sanghi, Siverd & Zhang 2025, Zenodo 10.5281/zenodo.15802304',
                           ULTRACOOLSHEET, 'K magnitude on the MKO system, compiled from the measurement cited last; synthetic photometry excluded'),
    'ultracoolsheet-ks': ('UltracoolSheet v2.1.0, 2MASS-system Ks', 'Best, Dupuy, Liu, Sanghi, Siverd & Zhang 2025, Zenodo 10.5281/zenodo.15802304',
                          ULTRACOOLSHEET, 'Ks magnitude on the 2MASS system, compiled from the measurement cited last; synthetic photometry excluded'),
    'dirbe': ('COBE DIRBE Point Source Catalog', 'Smith et al. 2004, ApJS 154, 673', f'{VIZIER}?-source=J/ApJS/154/673',
              '2.2 µm flux density as a K magnitude with the 2MASS Ks zero point (666.7 Jy); 0.7° beam'),
    'iras-60': ('IRAS Point Source Catalog, 60 µm', 'Beichman et al. 1988 (IRAS PSC v2.1)', f'{VIZIER}?-source=II/125',
                '60 µm flux density as a magnitude with the IRAS zero point (1.19 Jy)'),
    'iras-100': ('IRAS Point Source Catalog, 100 µm', 'Beichman et al. 1988 (IRAS PSC v2.1)', f'{VIZIER}?-source=II/125',
                 '100 µm flux density as a magnitude with the IRAS zero point (0.43 Jy)'),
    'wendker': ('Radio continuum emission from stars', 'Wendker 1995, A&AS 109, 177', f'{VIZIER}?-source=II/199A',
                'Median of the detections at 4–6 GHz in mJy; observations from the 1960s to 1994'),
    'green': ('A Catalogue of Galactic Supernova Remnants', 'Green 2025', f'{VIZIER}?-source=VII/297', '1 GHz flux density in mJy'),
    '4fgl': ('Fermi LAT 14-year Source Catalog (4FGL-DR4)', 'Ballet et al. 2023, arXiv:2307.12546', FERMI_4FGL,
             'Energy flux 100 MeV–100 GeV'),
}
BAND_UNITS = {
    'x-ray': 'erg cm-2 s-1', 'near-infrared': 'mag', 'far-infrared': 'mag', 'radio': 'mJy', 'gamma': 'erg cm-2 s-1',
}


def read_json(path: Path):
    return json.loads(path.read_text())


def load_objects() -> tuple[dict, dict, dict]:
    """Stellar records with all their designations, compact objects and nebulae, by ID."""
    designations: dict[str, list[str]] = {}
    for path in sorted((GENERATED / 'catalog-designations').glob('designations-*.json')):
        designations.update(read_json(path))
    stellar: dict[str, dict] = {}
    for path in sorted((GENERATED / 'catalog-records').glob('*.json')):
        for star in read_json(path)['stars']:
            if star['type'] in STELLAR_TYPES and star['id'] != 'sun' and star['id'] not in stellar:
                star = dict(star, all_designations=(star.get('designations') or []) + designations.get(star.get('catalog_detail_key'), []))
                stellar[star['id']] = star
    compact = {star['id']: star for star in read_json(ROOT / 'src/data/overlays/compact-remnants/objects.json')['objects']}
    nebulae = {star['id']: star for star in read_json(ROOT / 'src/data/overlays/nebulae/objects.json')['objects']}
    return stellar, compact, nebulae


def designation(star: dict, pattern: str) -> str | None:
    return next((name for name in star['all_designations'] if re.match(pattern, name)), None)


def normalized(name: str) -> str:
    return re.sub(r'\s+', ' ', name.strip()).upper()


# Network sources, cached so a refresh can resume and the raw tables stay inspectable.

def cached(name: str, fetch) -> bytes:
    path = DOWNLOADS / name
    if not path.exists():
        DOWNLOADS.mkdir(parents=True, exist_ok=True)
        path.write_bytes(fetch())
    return path.read_bytes()


def request(url: str, data: bytes | None = None, headers: dict | None = None) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers or {}), timeout=900) as response:
        return response.read()


def vizier(name: str, source: str, columns: list[str], **constraints: str) -> list[dict]:
    query = {'-source': source, '-out': ','.join(columns), '-out.max': 'unlimited', **constraints}
    text = cached(name, lambda: request(f'{VIZIER}?{urllib.parse.urlencode(query)}')).decode()
    lines = [line for line in text.split('\n') if line and not line.startswith('#')]
    if not lines:
        return []
    header = [column.strip() for column in lines[0].split('\t')]
    return [dict(zip(header, (value.strip() for value in line.split('\t')))) for line in lines[3:]]


def tap(name: str, url: str, rows: list[tuple[str, str]], query: str) -> list[dict]:
    """Synchronous TAP query with an uploaded two-column table `ids` (star_id, ident)."""
    def fetch() -> bytes:
        escape = lambda text: text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        table = ''.join(f'<TR><TD>{escape(a)}</TD><TD>{escape(b)}</TD></TR>' for a, b in rows)
        votable = ('<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE><TABLE>'
                   '<FIELD name="star_id" datatype="char" arraysize="*"/><FIELD name="ident" datatype="char" arraysize="*"/>'
                   f'<DATA><TABLEDATA>{table}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>')
        boundary = uuid.uuid4().hex
        fields = {'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'UPLOAD': 'ids,param:ids', 'QUERY': query}
        body = b''.join(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode() for key, value in fields.items())
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="ids"; filename="ids.xml"\r\nContent-Type: text/xml\r\n\r\n'.encode()
        body += votable.encode() + f'\r\n--{boundary}--\r\n'.encode()
        return request(url, body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
    return list(csv.DictReader(io.StringIO(cached(name, fetch).decode())))


def number(value: str | None) -> float | None:
    try:
        result = float(value) if value not in (None, '') else None
    except ValueError:
        return None
    return result if result is not None and math.isfinite(result) else None


def refresh(retrieved: str) -> None:
    stellar, compact, nebulae = load_objects()
    by_gaia = {name[9:]: star['id'] for star in stellar.values() if (name := designation(star, r'^Gaia DR3 \d+$'))}
    frozen: dict[str, object] = {}

    # X-rays: the reliable tables only (2RXS high quality, eRASS1 likely coronal), one counterpart per source.
    xray_2rxs = {}
    for row in vizier('freund2022-main.tsv', 'J/A+A/664/A105/main', ['2RXS', 'Match', 'pij', 'pstellar', 'FX', 'HR']):
        star = by_gaia.get(row['Match'])
        if star and (number(row['pij']) or 0) > MATCH_PROBABILITY:
            xray_2rxs[star] = {'source': row['2RXS'], 'p': number(row['pij']), 'flux': number(row['FX'])}
    xray_erass1 = {}
    for row in vizier('freund2024-like.tsv', 'J/A+A/684/A121/like_ctp', ['ERO', 'MJD', 'CtpId', 'p-ij', 'p-coronal', 'FX']):
        star = by_gaia.get(row['CtpId'])
        if star and (number(row['p-ij']) or 0) > MATCH_PROBABILITY:
            xray_erass1[star] = {'source': row['ERO'], 'mjd': number(row['MJD']), 'p': number(row['p-ij']), 'flux': number(row['FX'])}
    frozen['xray-freund2022.json'] = xray_2rxs
    frozen['xray-freund2024.json'] = xray_erass1

    # 1RXS for stars without a Gaia-based match, by SIMBAD's 1RXS identifier.
    wanted = {name[5:]: star['id'] for star in stellar.values() if star['id'] not in xray_2rxs and star['id'] not in xray_erass1
              and (name := designation(star, r'^1RXS J'))}
    xray_1rxs = {}
    for name, source in (('1rxs-bright.tsv', 'IX/10A/1rxs'), ('1rxs-faint.tsv', 'IX/29/rass_fsc')):
        for row in vizier(name, source, ['1RXS', 'Count', 'e_Count', 'HR1']):
            key = row['1RXS'].removeprefix('1RXS ').removeprefix('J').strip()
            star = wanted.get(f'J{key}')
            if star:
                xray_1rxs[star] = {'source': f'1RXS J{key}', 'count': number(row['Count']), 'countError': number(row['e_Count']), 'hr1': number(row['HR1'])}
    frozen['xray-1rxs.json'] = xray_1rxs

    # Compact objects with X-ray evidence: nearest eRASS1 source near their catalogued position.
    xray_compact = {}
    for star in compact.values():
        details = star['compact']
        if not (re.search('X-ray', details['detection_method']) or any(a.startswith('X-ray source') for a in details['associations'])):
            continue
        rows = vizier(f'erass1-compact-{star["id"]}.tsv', 'J/A+A/682/A34/erass1-m', ['_r', 'IAUName', 'MLFlux1', 's_MLFlux1'],
                      **{'-c': f'{details["ra_deg"]} {details["dec_deg"]}', '-c.rs': str(COMPACT_RADIUS_ARCSEC), '-sort': '_r'})
        if rows:
            xray_compact[star['id']] = {'source': rows[0]['IAUName'], 'separation': number(rows[0]['_r']), 'flux': number(rows[0]['MLFlux1']),
                                        'error': number(rows[0].get('s_MLFlux1')), 'within': len(rows)}
    frozen['xray-erass1-compact.json'] = xray_compact

    # Near infrared: 2MASS by designation through the Gaia archive, SIMBAD's adopted K, DIRBE by SIMBAD name.
    tmass_ids = [(star['id'], name[7:]) for star in stellar.values() if (name := designation(star, r'^2MASS J\d{8}[+-]\d{7}$'))]
    tmass = tap('2mass.csv', GAIA_TAP, tmass_ids,
                'SELECT u.star_id, t.designation, t.ks_m, t.ks_msigcom, t.ph_qual FROM tap_upload.ids AS u '
                'JOIN gaiadr1.tmass_original_valid AS t ON t.designation = u.ident')
    frozen['nir-2mass.json'] = {row['star_id']: {'source': f'2MASS J{row["designation"]}', 'k': number(row['ks_m']),
                                                  'error': number(row['ks_msigcom']), 'quality': row['ph_qual'][2]} for row in tmass}
    simbad_ids = []
    for star in stellar.values():
        ident = next((name for pattern in (r'^HIP \d+$', r'^HD \d+$', r'^Gaia DR3 \d+$', r'^2MASS J', r'^GJ ')
                      if (name := designation(star, pattern))), None)
        if ident:
            simbad_ids.append((star['id'], ident))
    simbad = tap('simbad-k.csv', SIMBAD_TAP, simbad_ids,
                 "SELECT u.star_id, f.flux, f.flux_err, f.bibcode FROM TAP_UPLOAD.ids AS u JOIN ident AS i ON i.id = u.ident "
                 "JOIN flux AS f ON f.oidref = i.oidref WHERE f.filter = 'K'")
    frozen['nir-simbad.json'] = {row['star_id']: {'k': number(row['flux']), 'error': number(row['flux_err']), 'bibcode': row['bibcode']}
                                 for row in simbad if row['bibcode'] != TWO_MASS_BIBCODE}
    names = {normalized(name): star['id'] for star in stellar.values() for name in star['all_designations'] + [star['name']]}
    dirbe = {}
    for row in vizier('dirbe.tsv', 'J/ApJS/154/673/DIRBE', ['DIRBE', 'F2.2', 'SName']):
        star = names.get(normalized(row['SName'])) if row['SName'] else None
        if star and number(row['F2.2']):
            dirbe[star] = {'source': f'DIRBE {row["DIRBE"]}', 'flux': number(row['F2.2'])}
    frozen['nir-dirbe.json'] = dirbe

    # Ultracool dwarfs: the UltracoolSheet's measured MKO K and 2MASS-system Ks, by exact name or SIMBAD alias.
    references = {row['code_ref']: row for row in csv.DictReader(io.StringIO(
        cached('ultracoolsheet-references.csv', lambda: request(ULTRACOOLSHEET_FILE.format('References'))).decode()))}
    def citation(codes: str) -> str | None:
        rows = [references.get(code) for code in codes.split(';')]
        if None in rows or any('synthetic' in row['title_ref'].lower() for row in rows):
            return None
        return '; '.join(row['title_ref'] if row['ADSkey_ref'].startswith('noADS') else f'{row["citetext_ref"]}, {row["ADSkey_ref"].strip()}' for row in rows)
    owners: dict[str, set[str]] = {}
    for star in stellar.values():
        for name in star['all_designations'] + [star['name']]:
            owners.setdefault(normalized(name), set()).add(star['id'])
    ultracool: dict[str, list] = {}
    for row in csv.DictReader(io.StringIO(cached('ultracoolsheet-main.csv', lambda: request(ULTRACOOLSHEET_FILE.format('Main'))).decode())):
        measured = {}
        for system, value, error, reference in (('mko', 'K_MKO', 'Kerr_MKO', 'ref_K_MKO'), ('ks', 'Ks_2MASS', 'Kserr_2MASS', 'ref_Ks_2MASS')):
            # A value without an error is an upper limit.
            if number(row[value]) is not None and number(row[error]) is not None and (cited := citation(row[reference])):
                measured[system] = {'k': number(row[value]), 'error': number(row[error]), 'reference': cited}
        if not measured:
            continue
        aliases = {row[field] for field in ('name', 'name_simbadable', 'name_simbad', 'designation_2mass', 'designation_MKO', 'designation_WISE')}
        found = set().union(*(owners.get(normalized(alias), set()) for alias in aliases | set(row['identifiers_simbad'].split('|')) if alias))
        for star in found:
            ultracool.setdefault(star, []).append({'source': row['name'], 'twoMass': row['designation_2mass'], **measured})
    frozen['nir-ultracoolsheet.json'] = ultracool

    # Far infrared: IRAS by designation.
    iras_ids = {name[5:].strip(): star['id'] for star in stellar.values() if (name := designation(star, r'^IRAS \d'))}
    frozen['fir-iras.json'] = {iras_ids[row['IRAS']]: {'source': f'IRAS {row["IRAS"]}', **{f'f{band}': number(row[f'Fnu_{band}']) for band in ('60', '100')},
                                                        **{f'q{band}': row[f'q_Fnu_{band}'] for band in ('60', '100')}}
                               for row in vizier('iras-psc.tsv', 'II/125/main', ['IRAS', 'Fnu_60', 'q_Fnu_60', 'Fnu_100', 'q_Fnu_100'])
                               if row['IRAS'] in iras_ids}

    # Radio: Wendker detections of our stars by designation; Green's remnants by reviewed name.
    wendker_stars = vizier('wendker-stars.tsv', 'II/199A/stars', ['Seq', 'Name', 'Alias', 'Det'])
    references = {row['Ref']: row['Bibcode'] for row in vizier('wendker-refs.tsv', 'II/199A/refs', ['Ref', 'Bibcode'])}
    sequence = {}
    for row in wendker_stars:
        star = next((names[normalized(n)] for n in (row['Name'], row['Alias']) if n and normalized(n) in names), None)
        if star:
            sequence[row['Seq']] = star
    radio_stars: dict[str, list] = {}
    for row in vizier('wendker-radio.tsv', 'II/199A/radio', ['Seq', 'Freq', 'l_Smax', 'Smax', 'l_Smin', 'Smin', 'r_Smax']):
        star = sequence.get(row['Seq'])
        if star and not row['l_Smax'] and number(row['Smax']) is not None:
            radio_stars.setdefault(star, []).append({'frequency': number(row['Freq']), 'max': number(row['Smax']),
                                                     'min': number(row['Smin']) if not row['l_Smin'] else None,
                                                     'bibcode': references.get(row['r_Smax'], '')})
    frozen['radio-wendker.json'] = radio_stars
    green = {row['SNR']: row for row in vizier('green.tsv', 'VII/297', ['SNR', 'S(1GHz)', 'u_S(1GHz)', 'Names'])}
    missing = [snr for snr in GREEN_REMNANTS.values() if snr not in green]
    if missing:
        raise SystemExit(f'Green remnants not found: {missing}')
    frozen['radio-green.json'] = {nebula: {'source': snr, 'flux': number(green[snr]['S(1GHz)']), 'uncertain': green[snr]['u_S(1GHz)'] == '?',
                                           'names': green[snr]['Names']} for nebula, snr in GREEN_REMNANTS.items()}

    # Gamma rays: 4FGL-DR4 by name.
    from astropy.io import fits
    cached('gll_psc_v35.fit', lambda: request(FERMI_4FGL))
    with fits.open(DOWNLOADS / 'gll_psc_v35.fit') as catalog:
        table = catalog['LAT_Point_Source_Catalog'].data
        fermi = {name.strip(): (number(str(flux)), number(str(error))) for name, flux, error in zip(table['Source_Name'], table['Energy_Flux100'], table['Unc_Energy_Flux100'])}
    gamma = {}
    for star in compact.values():
        found = [name for association in star['compact']['associations'] for name in re.findall(r'4FGL J\d{4}\.\d[+-]\d{4}[a-z]?', association) if name in fermi]
        if found:
            gamma[star['id']] = {'sources': found[:1], 'flux': fermi[found[0]][0], 'error': fermi[found[0]][1]}
    for nebula, sources in FERMI_REMNANTS.items():
        missing = [name for name in sources if name not in fermi]
        if missing:
            raise SystemExit(f'4FGL sources not found: {missing}')
        errors = [fermi[name][1] for name in sources]
        gamma[nebula] = {'sources': sources, 'flux': sum(fermi[name][0] for name in sources),
                         'error': math.sqrt(sum(error ** 2 for error in errors)) if None not in errors else None}
    frozen['gamma-4fgl.json'] = gamma

    files = {name: json.dumps(content, indent=1, sort_keys=True, ensure_ascii=False) + '\n' for name, content in frozen.items()}
    files['source-manifest.json'] = json.dumps({
        'retrieved': retrieved,
        'services': {'vizier': VIZIER, 'gaiaTap': GAIA_TAP, 'simbadTap': SIMBAD_TAP, 'fermi': FERMI_4FGL, 'ultracoolSheet': ULTRACOOLSHEET},
        'checksumsSha256': {name: hashlib.sha256(content.encode()).hexdigest() for name, content in sorted(files.items())},
    }, indent=1) + '\n'
    write_managed_files(WORK, files, force=True)


def magnitude(flux: float, zero_point: float) -> float:
    return -2.5 * math.log10(flux / zero_point)


def build() -> tuple[dict[str, dict], dict]:
    stellar, compact, nebulae = load_objects()
    manifest = read_json(WORK / 'source-manifest.json')
    for name, checksum in manifest['checksumsSha256'].items():
        if name != 'source-manifest.json' and hashlib.sha256((WORK / name).read_bytes()).hexdigest() != checksum:
            raise SystemExit(f'Frozen source changed: {name}; refresh with --refresh after reviewing it.')
    frozen = {path.name: read_json(path) for path in WORK.glob('*.json') if path.name not in ('source-manifest.json', 'review.json')}
    bands: dict[str, dict] = {band: {} for band in BAND_UNITS}
    review: dict[str, list] = {}
    flag = lambda reason, object_id, detail: review.setdefault(reason, []).append({'id': object_id, 'name': (stellar.get(object_id) or compact.get(object_id) or {}).get('name', object_id), **detail})

    # X-rays of X-ray binaries come from the compact object, not from the companion's corona.
    binaries = {component['starId'] for system in read_json(ROOT / 'src/data/compact-system-identities.json')['systems']
                for component in system['components'] if component['starId'] not in compact}
    xray = bands['x-ray']
    for star in sorted(stellar):
        erass1, rosat, rxs1 = (frozen[name].get(star) for name in ('xray-freund2024.json', 'xray-freund2022.json', 'xray-1rxs.json'))
        if not (erass1 or rosat or rxs1):
            continue
        if star in binaries:
            flag('X-ray binary companion', star, {'source': (erass1 or rosat or rxs1)['source']})
            continue
        # eRASS1 is deeper and locates its sources better than ROSAT, so its flux wins where both exist.
        if erass1:
            xray[star] = [erass1['flux'], None, 'erass1', erass1['source']]
        elif rosat:
            xray[star] = [rosat['flux'], None, '2rxs', rosat['source']]
        elif rxs1['count'] and rxs1['hr1'] is not None:
            conversion = (5.30 * rxs1['hr1'] + 8.31) * 1e-12
            error = rxs1['countError'] * conversion if rxs1['countError'] else None
            xray[star] = [rxs1['count'] * conversion, error, '1rxs', rxs1['source']]
        else:
            flag('1RXS source without count rate or HR1', star, {'source': rxs1['source']})
    for object_id, match in sorted(frozen['xray-erass1-compact.json'].items()):
        if match['within'] > 1:
            flag('Several eRASS1 sources near a compact object', object_id, {'source': match['source'], 'within': match['within']})
        elif match['flux']:
            xray[object_id] = [match['flux'], match['error'], 'erass1-main', match['source']]

    # Near infrared: the value with the smallest stated error; DIRBE and SIMBAD values without one count as 0.1 and 0.05 mag.
    nir = bands['near-infrared']
    # Rows and measurements used for several objects: a companion's row can carry its primary's unresolved 2MASS
    # designation, and separate component rows can repeat one unresolved measurement under one 2MASS designation.
    ultracool_users: dict[str, list[str]] = {}
    measurement_users: dict[tuple, list[str]] = {}
    for star, rows in frozen['nir-ultracoolsheet.json'].items():
        for row in rows:
            ultracool_users.setdefault(row['source'], []).append(star)
            for system in ('mko', 'ks'):
                if measured := row.get(system):
                    measurement_users.setdefault((system, row['twoMass'], measured['k'], measured['reference']), []).append(star)
    for star in sorted(stellar):
        candidates = []
        tmass = frozen['nir-2mass.json'].get(star)
        if tmass and tmass['k'] is not None and tmass['quality'] and tmass['quality'] in 'ABCDE':
            candidates.append((tmass['error'] or (0.05 if tmass['quality'] in 'ABC' else 0.3), tmass['k'], tmass['error'], '2mass', tmass['source']))
        ultracool = frozen['nir-ultracoolsheet.json'].get(star, [])
        if len(ultracool) > 1:
            flag('Several UltracoolSheet rows match one object', star, {'sources': [row['source'] for row in ultracool]})
        elif ultracool and len(shared := ultracool_users[ultracool[0]['source']]) > 1:
            flag('UltracoolSheet row shared by several objects', star, {'source': ultracool[0]['source'], 'shared': shared})
        elif ultracool:
            for system in ('mko', 'ks'):
                if not (row := ultracool[0].get(system)):
                    continue
                if len(shared := measurement_users[(system, ultracool[0]['twoMass'], row['k'], row['reference'])]) > 1:
                    flag('UltracoolSheet measurement shared by several objects', star, {'source': ultracool[0]['source'], 'system': system, 'shared': shared})
                    continue
                if tmass and tmass['quality'] == 'A' and tmass['k'] is not None and abs(row['k'] - tmass['k']) > ULTRACOOL_TWO_MASS_TOLERANCE:
                    flag('UltracoolSheet K far from 2MASS quality A', star, {'source': ultracool[0]['source'], 'system': system, 'k': row['k'],
                                                                             'twoMass': tmass['k'], 'reference': row['reference']})
                    continue
                candidates.append((row['error'], row['k'], row['error'], f'ultracoolsheet-{system}', ultracool[0]['source'], f'Measured by {row["reference"]}'))
        if (row := frozen['nir-simbad.json'].get(star)) and row['k'] is not None:
            candidates.append((row['error'] or 0.05, row['k'], row['error'], f'simbad:{row["bibcode"]}', None))
        if (row := frozen['nir-dirbe.json'].get(star)) and row['flux'] > 0:
            candidates.append((0.1, magnitude(row['flux'], 666.7), None, 'dirbe', row['source']))
        if not candidates:
            continue
        _, k, error, source, identifier, *scope = min(candidates, key=lambda candidate: candidate[0])
        visual = stellar[star].get('apparent_mag')
        if visual is not None and not V_MINUS_K_RANGE[0] <= visual - k <= V_MINUS_K_RANGE[1]:
            flag('Implausible V − K', star, {'v': visual, 'k': round(k, 3), 'source': source})
            continue
        nir[star] = [round(k, 3), error, source] + ([identifier] if identifier else []) + scope

    # Far infrared: 60 µm detections; 100 µm alone is often Galactic cirrus rather than the star.
    fir = bands['far-infrared']
    for star, row in sorted(frozen['fir-iras.json'].items()):
        if row['q60'] in ('2', '3') and row['f60']:
            fir[star] = [round(magnitude(row['f60'], 1.19), 3), None, 'iras-60', row['source']]
        elif row['q100'] in ('2', '3') and row['f100']:
            flag('IRAS 100 µm detection without 60 µm (possible cirrus)', star, {'source': row['source'], 'f100': row['f100']})

    # Radio: stars near 5 GHz, pulsars from the ATNF luminosity at their distance, remnants from Green's catalog.
    radio = bands['radio']
    low, high = RADIO_STAR_FREQUENCIES_MHZ
    for star, detections in sorted(frozen['radio-wendker.json'].items()):
        fluxes = [value for row in detections if low <= row['frequency'] <= high for value in (row['max'], row['min']) if value is not None and value > 0]
        if fluxes:
            radio[star] = [statistics.median(fluxes), None, 'wendker']
    for nebula, row in sorted(frozen['radio-green.json'].items()):
        if row['flux']:
            radio[nebula] = [row['flux'] * 1000, None, 'green', row['source']]

    gamma = bands['gamma']
    for object_id, row in sorted(frozen['gamma-4fgl.json'].items()):
        gamma[object_id] = [row['flux'], row['error'], '4fgl', ' + '.join(row['sources'])] + ([REMNANT_SCOPES[object_id]] if object_id in REMNANT_SCOPES else [])

    # One unresolved source measured for several of our objects (a close pair, or a component and its system) cannot
    # be adopted for any one of them.
    for band, objects in bands.items():
        users: dict[str, list[str]] = {}
        for object_id, entry in objects.items():
            if len(entry) > 3:
                users.setdefault(entry[3], []).append(object_id)
        for identifier, object_ids in users.items():
            if len(object_ids) > 1:
                for object_id in object_ids:
                    flag(f'{band} source shared by several objects', object_id, {'source': identifier, 'shared': object_ids})
                    del objects[object_id]
        # The 2MASS designation is already among the object's own designations, so it is not repeated.
        for object_id, entry in objects.items():
            if entry[2] == '2mass':
                objects[object_id] = entry[:3]

    outputs = {}
    for band, objects in bands.items():
        used = sorted({entry[2].split(':')[0] for entry in objects.values()})
        sources = {key: dict(zip(('label', 'reference', 'url', 'note'), SOURCES[key])) for key in used if key in SOURCES}
        if 'simbad' in used:
            sources['simbad'] = {'label': 'SIMBAD adopted K', 'reference': 'Wenger et al. 2000',
                                 'url': SIMBAD_TAP, 'note': 'K magnitude from the source cited last'}
        outputs[band] = {'schemaVersion': 1, 'band': band, 'retrieved': manifest['retrieved'], 'unit': BAND_UNITS[band],
                         'entry': ['value', 'error', 'source', 'identifier', 'scope'], 'sources': sources, 'objects': objects}
    return outputs, review


def serialize(payload: dict) -> str:
    # One object per line keeps the shipped file compact and its diffs readable.
    head = {key: value for key, value in payload.items() if key != 'objects'}
    lines = [f'{json.dumps(key)}:{json.dumps(value, ensure_ascii=False, separators=(",", ":"))}' for key, value in head.items()]
    objects = ',\n'.join(f'{json.dumps(key)}:{json.dumps(value, ensure_ascii=False, separators=(",", ":"))}' for key, value in payload['objects'].items())
    return '{\n' + ',\n'.join(lines + ['"objects":{\n' + objects + '\n}']) + '\n}\n'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Download (or reuse cached) sources and freeze the matched rows')
    parser.add_argument('--retrieved', help='ISO date recorded with --refresh')
    parser.add_argument('--check', action='store_true', help='Compare the shipped files without writing them')
    args = parser.parse_args()
    if args.refresh:
        if not args.retrieved:
            parser.error('--refresh requires --retrieved')
        refresh(args.retrieved)
    outputs, review = build()
    files = {f'{band}.json': serialize(payload) for band, payload in outputs.items()}
    if args.check:
        stale = [name for name, content in files.items() if not (OUTPUT / name).exists() or (OUTPUT / name).read_text() != content]
        if stale:
            raise SystemExit(f'Wavelength photometry differs ({", ".join(stale)}); regenerate with scripts/author-wavelength-photometry.py.')
    else:
        write_managed_files(OUTPUT, files, force=True)
        write_managed_files(WORK, {'review.json': json.dumps(review, indent=1, ensure_ascii=False) + '\n'}, force=True)
    for band, payload in outputs.items():
        counts = {}
        for entry in payload['objects'].values():
            counts[entry[2].split(':')[0]] = counts.get(entry[2].split(':')[0], 0) + 1
        print(f'{band}: {len(payload["objects"])} objects ({", ".join(f"{count} {source}" for source, count in sorted(counts.items()))})')
    print('flagged for review: ' + (', '.join(f'{len(items)} {reason}' for reason, items in review.items()) or 'none'))


if __name__ == '__main__':
    main()
