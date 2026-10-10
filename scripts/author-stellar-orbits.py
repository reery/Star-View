"""Match frozen ORB6/MSC solutions to reviewed component identities, never positions."""
import collections
import csv
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'catalog-work/star-systems'


def read(path):
    return json.loads((ROOT / path).read_text())


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def main():
    systems = {s['id']: s for file in ['src/data/star-systems.json', 'src/data/stellar-companions.json']
               for s in read(file)['systems']}
    stars = {}
    for path in sorted((ROOT / 'src/data/catalogs').glob('*/stars.csv')):
        for row in csv.DictReader(path.open()):
            stars.setdefault(row['id'], row)
    stars.update({s['id']: s for s in read('src/data/stellar-companions.json')['stars']})
    wds_index, hip_index = collections.defaultdict(set), collections.defaultdict(set)
    identities = {}
    for sid, system in systems.items():
        labels = {}
        for comp in system['components']:
            values = []
            for identifier in [comp['starId'], *comp.get('alternateStarIds', [])]:
                star = stars.get(identifier, {})
                designations = star.get('designations', [])
                if isinstance(designations, str):
                    designations = [designations]
                values += [identifier.replace('hip-', 'HIP '), *designations]
            for value in values:
                for wds in re.findall(r'WDS J(\d{5}[+-]\d{4})', value):
                    wds_index[wds].add(sid)
                for hip in re.findall(r'\bHIP (\d+)\b', value):
                    hip_index[int(hip)].add(sid)
            labels[comp['label']] = comp['starId']
        if sid.startswith('msc-'):
            wds_index[sid[4:]].add(sid)
        identities[sid] = labels

    msc = read('catalog-work/star-systems/catalog-companions-msc.json')
    # MSC's WDS index sometimes differs from SIMBAD's. Its exact HIP column
    # establishes the cross-reference without an angular/position match.
    for line in msc['tables']['comp.tsv']:
        row = [s.strip() for s in line.split('|')]
        wds_index[row[0]].update(hip_index.get(number(row[11]), set()))

    def members(sid, label):
        labels = identities[sid]
        if label in labels:
            return [labels[label]]
        # A node can denote the center of mass of its explicitly cataloged children.
        if len(label) == 1:
            return [identifier for key, identifier in labels.items() if key.startswith(label)]
        if label.isupper():
            return list(dict.fromkeys(identifier for letter in label for identifier in members(sid, letter)))
        return []

    def parallax(sid, primary):
        for identifier in primary + list(identities[sid].values()):
            star = stars.get(identifier, {})
            raw = star.get('raw_astrometry') or {}
            value = number(raw.get('parallax_mas', star.get('parallax_mas')))
            if value and value > 0:
                return value, identifier
        return None, None

    results = collections.defaultdict(dict)
    rejected = []

    def add(sid, first, second, data, priority):
        primary, secondary = members(sid, first), members(sid, second)
        if not primary or not secondary or set(primary) & set(secondary):
            rejected.append({'systemId': sid, 'pair': f'{first},{second}', 'reason': 'Unresolved or overlapping component scope', 'reference': data['reference']})
            return
        data.update(primaryIds=primary, secondaryIds=secondary, primary=first, secondary=second)
        plx, plx_id = parallax(sid, primary)
        angular = data.pop('angularAxisArcsec', None)
        data['semiMajorAxisAu'] = round(angular * 1000 / plx, 8) if angular and plx else None
        data['axisDerivation'] = {'angularAxisArcsec': angular, 'parallaxMas': plx, 'parallaxStarId': plx_id} if angular else None
        key = '|'.join(sorted([','.join(sorted(primary)), ','.join(sorted(secondary))]))
        current = results[sid].get(key)
        if current is None or priority < current[0]:
            results[sid][key] = (priority, data)

    # Fixed-width fields follow the published ORB6 format, including unit flags.
    for line in (WORK / 'orb6-20261009.txt').read_text().splitlines():
        wds = line[19:29]
        if not re.fullmatch(r'\d{5}[+-]\d{4}', wds):
            continue
        candidates = wds_index[wds] | hip_index.get(number(line[58:64]), set())
        if len(candidates) != 1:
            continue
        sid = next(iter(candidates))
        designation = line[30:44].strip()
        pair_match = re.search(r'([A-Z][a-z]?\d?,(?:[A-Z][a-z]?\d?|\d)|[A-Z]{2,})$', designation)
        pair = pair_match.group(1) if pair_match else line[37:44].strip()
        if ',' in pair:
            first, second = pair.split(',')
            if second.isdigit() and first[-1:].isdigit():
                second = first[:-1] + second
        elif re.fullmatch('[A-Z]{2}', pair):
            first, second = pair
        elif not pair and set(identities[sid]) == {'A', 'B'}:
            first, second = 'A', 'B'
        else:
            rejected.append({'systemId': sid, 'pair': pair, 'reason': 'Ambiguous ORB6 pair label'})
            continue
        grade = number(line[233:234])
        # ORB6 AC for Proxima is the orbit around the AB center of mass (Kervella 2017).
        if sid == 'alpha-centauri' and pair == 'AC':
            first = 'AB'
        # These reviewed individual A/B stars use Aa/Ab in WDS (rather than
        # the flat labels in their component-resolved literature/catalog cards).
        if sid in ['mu-cassiopeiae', 'chi-draconis', 'iota-pegasi', 'spectroscopic-hip-14328'] and pair == 'Aa,Ab':
            first, second = 'A', 'B'
        period = number(line[81:92])
        factor = {'m': 1 / 525960, 'h': 1 / 8766, 'd': 1 / 365.25, 'y': 1, 'c': 100}.get(line[92:93])
        epoch = number(line[162:174])
        epoch_unit = line[174:175]
        if epoch is not None and epoch_unit == 'c':
            epoch *= 100
            epoch_unit = 'y'
        angular = number(line[105:114])
        axis_factor = {'a': 1, 'm': 0.001, 'M': 60, 'u': 0.000001}.get(line[114:115])
        if not period or period <= 0 or not factor:
            continue
        add(sid, first, second, {
            'periodYears': period * factor, 'eccentricity': number(line[187:195]),
            'inclinationDeg': number(line[125:133]), 'nodeDeg': number(line[143:151]),
            'argumentDeg': number(line[205:213]),
            'periastronEpoch': epoch, 'epochKind': {'y': 'Besselian year', 'd': 'JD − 2400000', 'm': 'MJD'}.get(epoch_unit),
            'angularAxisArcsec': angular * axis_factor if angular and axis_factor and grade != 9 else None,
            'grade': grade, 'reference': line[237:245].strip(), 'catalog': 'ORB6',
            'sourceUrl': 'https://www.astro.gsu.edu/wds/orb6/orb6orbits.html',
            'nodeAmbiguous': line[151:152] != '*', 'argumentComponent': second,
        }, (0, grade or 99))

    # Existing reviewed non-MSC hierarchies use their own labels. Only identical
    # scopes are accepted; these documented renamings reconcile published labels.
    renamings = {'capella': {'A': 'Aa', 'B': 'Ab', 'C': 'H', 'D': 'L'},
                 'gj-105': {'B': 'C', 'C': 'B'}}
    for line in msc['tables']['orb.tsv']:
        row = [s.strip() for s in line.split('|')]
        candidates = wds_index[row[0]]
        if len(candidates) != 1:
            continue
        sid = next(iter(candidates))
        if ',' not in row[1]:
            rejected.append({'systemId': sid, 'pair': row[1], 'reason': 'MSC does not identify both components'})
            continue
        first, second = row[1].split(',')
        mapping = renamings.get(sid, {})
        first, second = mapping.get(first, first), mapping.get(second, second)
        period, epoch, eccentricity, angular, node, argument, inclination = map(number, row[2:9])
        if not period or period <= 0 or eccentricity is not None and not 0 <= eccentricity < 1 or row[13] not in ['d', 'y']:
            rejected.append({'systemId': sid, 'pair': row[1], 'reason': 'Not a valid bound orbit solution', 'reference': row[14]})
            continue
        # MSC encodes unknown numbers as zero. Keep those fields unavailable.
        add(sid, first, second, {
            'periodYears': period / 365.25 if row[13] == 'd' else period,
            'eccentricity': eccentricity or None, 'inclinationDeg': inclination or None,
            'nodeDeg': node or None, 'argumentDeg': argument or None,
            'periastronEpoch': epoch or None, 'epochKind': 'JD − 2400000' if row[13] == 'd' or epoch and epoch > 10000 else 'Julian year',
            'angularAxisArcsec': angular if angular and angular > 0 else None, 'grade': None,
            'reference': row[14], 'catalog': 'MSC', 'sourceUrl': msc['url'],
            'nodeAmbiguous': True, 'argumentComponent': first if row[12] == 'A' else second if row[12] == 'B' else None,
        }, (1 if angular else 2, 0))

    output = []
    for sid, system in systems.items():
        orbits = [data for _, data in results[sid].values()]
        for index, orbit in enumerate(orbits):
            orbit['id'] = f'{sid}-{index}'
        output.append({'systemId': sid, 'name': system['name'], 'orbits': orbits})
    payload = {'schemaVersion': 1, 'retrievedOn': '2026-10-09', 'systems': output}
    (ROOT / 'src/data/stellar-orbits.json').write_text(json.dumps(payload, indent=2) + '\n')
    audit = {'schemaVersion': 1, 'sources': [
        {'url': 'https://www.astro.gsu.edu/wds/orb6/orb6orbits.txt', 'frozenInput': 'catalog-work/star-systems/orb6-20261009.txt',
         'sha256': hashlib.sha256((WORK / 'orb6-20261009.txt').read_bytes()).hexdigest(), 'retrievedOn': '2026-10-09'},
        {'url': msc['url'], 'sha256': msc['archiveSha256'], 'frozenInput': 'catalog-work/star-systems/catalog-companions-msc.json'}],
        'policy': 'Exact reviewed WDS/HIP identities only; explicit pair scopes; no positional matches, estimated wide periods or photocenter axes. Angular relative axes converted to AU with the identified catalog parallax. Unknown MSC zeros stay null.',
        'systemsReviewed': len(output), 'systemsWithSolutions': sum(bool(s['orbits']) for s in output),
        'orbitCount': sum(len(s['orbits']) for s in output), 'rejected': rejected,
        'unavailable': [{'systemId': s['systemId'], 'name': s['name']} for s in output if not s['orbits']]}
    (WORK / 'stellar-orbits-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(f"{audit['systemsWithSolutions']}/{len(output)} systems; {audit['orbitCount']} orbital solutions")


if __name__ == '__main__':
    main()
