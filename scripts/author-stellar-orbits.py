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
        if system.get('wdsId'):
            wds_index[system['wdsId']].add(sid)
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
        if re.fullmatch(r'[A-Z][a-z]?', label):
            children = [identifier for key, identifier in labels.items() if key.startswith(label)]
            return children if len(children) >= 2 else []
        # Explicit sibling subgroups such as Aa/Ab form the catalog node Aab.
        grouped = re.fullmatch(r'([A-Z])([a-z]{2,})', label)
        if grouped:
            children = [members(sid, grouped[1] + suffix) for suffix in grouped[2]]
            return list(dict.fromkeys(identifier for group in children for identifier in group)) if all(children) else []
        if label.isupper():
            children = [members(sid, letter) for letter in label]
            return list(dict.fromkeys(identifier for group in children for identifier in group)) if all(children) else []
        return []

    def parallax(sid, primary):
        for identifier in primary + list(identities[sid].values()):
            star = stars.get(identifier, {})
            raw = star.get('raw_astrometry') or {}
            value = number(raw.get('parallax_mas', star.get('parallax_mas')))
            if value and value > 0:
                return value, identifier
        shared = systems[sid].get('adoptedDistance', {})
        value = number(shared.get('parallaxMas'))
        if value and value > 0:
            return value, shared['sourceStarId']
        return None, None

    results = collections.defaultdict(dict)
    rejected = []
    reconciled = []
    identity_ambiguities = []
    msc_orbits = collections.defaultdict(list)
    for line in msc['tables']['orb.tsv']:
        row = [s.strip() for s in line.split('|')]
        msc_orbits[row[0]].append(row)

    # Flat app labels differ from the WDS hierarchy in these reviewed systems.
    # Source membership and scope evidence are recorded in the system manifest
    # and the coverage review. Never apply Aa/Ab -> A/B to an arbitrary binary.
    orb6_scopes = {
        'ez-aquarii': {'Aa,Ab': ('A', 'C'), 'AB': ('AC', 'B')},
        'gj-1245': {'Aa,Ab': ('A', 'C'), 'AB': ('AC', 'B')},
        'gj-22': {'Aa,Ab': ('A', 'C'), 'AB': ('AC', 'B')},
        'gj-105': {'Aa,Ab': ('A', 'C'), 'AB': ('A', 'C')},
        'gj-570': {'Ba,Bb': ('B', 'C'), 'AB': ('A', 'BC')},
        'gj-667': {'AC': ('AB', 'C')},
        'msc-00084+2905': {'Aa,Ab': ('A', 'B')},
        'msc-02449+1007': {'Aa,Ab': ('A', 'B')},
        'msc-03082+4057': {'Aa1,2': ('Aa', 'Ab'), 'Aa,Ab': ('A', 'B')},
        'msc-04422+2257': {'Aa,Ab': ('Aab', 'Ac')},
        'spectroscopic-hip-112158': {'Aa,Ab': ('A', 'B')},
    }

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
        if data['axisDerivation'] and systems[sid].get('adoptedDistance') and not stars.get(plx_id, {}).get('raw_astrometry'):
            data['axisDerivation']['distanceScope'] = systems[sid]['adoptedDistance']['scope']
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
        designation = line[30:44].strip()
        explicit_pair = re.search(r'([A-Z][a-z]?,[A-Z][a-z]?|[A-Z]{2})$', designation)
        if len(candidates) > 1 and explicit_pair:
            labels = explicit_pair[1].split(',') if ',' in explicit_pair[1] else list(explicit_pair[1])
            scoped = {sid for sid in candidates if all(label in identities[sid] for label in labels)}
            if len(scoped) == 1:
                candidates = scoped
        if len(candidates) != 1:
            if candidates:
                identity_ambiguities.append({'catalog': 'ORB6', 'wdsId': wds,
                                             'designation': line[30:44].strip(), 'systemIds': sorted(candidates)})
            continue
        sid = next(iter(candidates))
        designation = line[30:44].strip()
        period = number(line[81:92])
        factor = {'m': 1 / 525960, 'h': 1 / 8766, 'd': 1 / 365.25, 'y': 1, 'c': 100}.get(line[92:93])
        reference = line[237:245].strip()
        if not period or period <= 0 or not factor:
            continue
        pair_match = re.search(r'((?:[A-Z]{2,}|[A-Z][a-z]{0,2}\d?),(?:[A-Z]{2,}|[A-Z][a-z]{0,2}\d?|\d)|[A-Z]{2,})$', designation)
        pair = pair_match.group(1) if pair_match else line[37:44].strip()
        # An unlabelled ORB6 designation may still have an exact scoped MSC
        # cross-reference. Require the same WDS, reference, designation and
        # period (allow only source rounding); no default pair in a hierarchy.
        if not pair or re.fullmatch('[A-Z]', pair):
            scoped = set()
            for row in msc_orbits[wds]:
                source_period = number(row[2])
                source_factor = {'d': 1 / 365.25, 'y': 1}.get(row[13])
                compact = lambda value: re.sub(r'[_\s]', '', value)
                if (source_period and source_factor and ',' in row[1]
                        and re.search(r'\bVB6_' + re.escape(reference) + r'\b', row[14])
                        and compact(designation) in compact(row[14])
                        and math.isclose(period * factor, source_period * source_factor, rel_tol=0.005)):
                    scoped.add(row[1])
            if len(scoped) == 1:
                original = pair
                pair = next(iter(scoped))
                reconciled.append({'systemId': sid, 'catalog': 'ORB6', 'sourcePair': original,
                                   'adoptedPair': pair, 'reference': reference,
                                   'evidence': 'Exact WDS/reference/designation/period cross-reference in frozen MSC orb.tsv'})
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
        if pair in orb6_scopes.get(sid, {}):
            first, second = orb6_scopes[sid][pair]
            reconciled.append({'systemId': sid, 'catalog': 'ORB6', 'sourcePair': pair,
                               'adoptedPair': f'{first},{second}', 'reference': reference,
                               'evidence': 'Reviewed component naming reconciliation; see orbit-coverage-review.json'})
        # These reviewed individual A/B stars use Aa/Ab in WDS (rather than
        # the flat labels in their component-resolved literature/catalog cards).
        if sid in ['mu-cassiopeiae', 'chi-draconis', 'iota-pegasi', 'spectroscopic-hip-14328'] and pair == 'Aa,Ab':
            first, second = 'A', 'B'
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
            'periastronEpoch': epoch, 'epochKind': {'y': 'Besselian year', 'j': 'Julian year', 'd': 'JD − 2400000', 'm': 'MJD'}.get(epoch_unit),
            'angularAxisArcsec': angular * axis_factor if angular and axis_factor and grade != 9 else None,
            'grade': grade, 'reference': line[237:245].strip(), 'catalog': 'ORB6',
            'sourceUrl': 'https://www.astro.gsu.edu/wds/orb6/orb6orbits.html',
            'nodeAmbiguous': line[151:152] != '*', 'argumentComponent': second,
        }, (0, grade or 99))

    # Existing reviewed non-MSC hierarchies use their own labels. Only identical
    # scopes are accepted; these documented renamings reconcile published labels.
    renamings = {'capella': {'A': 'Aa', 'B': 'Ab', 'C': 'H', 'D': 'L'},
                 'gj-105': {'B': 'C', 'C': 'B'},
                 'gj-570': {'B': 'BC', 'Ba': 'B', 'Bb': 'C', 'G': 'D'}}
    for line in msc['tables']['orb.tsv']:
        row = [s.strip() for s in line.split('|')]
        candidates = wds_index[row[0]]
        if len(candidates) > 1 and ',' in row[1]:
            scoped = {sid for sid in candidates if all(label in identities[sid] for label in row[1].split(','))}
            if len(scoped) == 1:
                candidates = scoped
        if len(candidates) != 1:
            if candidates:
                identity_ambiguities.append({'catalog': 'MSC', 'wdsId': row[0],
                                             'designation': row[1], 'systemIds': sorted(candidates)})
            continue
        sid = next(iter(candidates))
        if ',' not in row[1]:
            rejected.append({'systemId': sid, 'pair': row[1], 'reason': 'MSC does not identify both components'})
            continue
        first, second = row[1].split(',')
        # This SB9 row retains older Aa/Ab labels for the 65-day eclipsing
        # pair. MSC sys.tsv explicitly identifies it as Aa1/Aa2, not the
        # roughly 200-year Aa–Ab visual pair in the same physical system.
        if sid == 'msc-05353-0524' and row[1] == 'Aa,Ab' and row[14].startswith('SB9_340 '):
            first, second = 'Aa1', 'Aa2'
            reconciled.append({'systemId': sid, 'catalog': 'MSC', 'sourcePair': row[1],
                               'adoptedPair': 'Aa1,Aa2', 'reference': row[14],
                               'evidence': 'MSC sys.tsv identifies SB9_340 as Aa1/Aa2 with the same 65.432-day period'})
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
    # Audit the UI's fallback name groups too: these were previously invisible
    # to the source-coverage report and caused the EZ Aquarii omission.
    reviewed_ids = {identifier for system in systems.values() for component in system['components']
                    for identifier in [component['starId'], *component.get('alternateStarIds', [])]}
    name_groups = collections.defaultdict(dict)
    for identifier, star in stars.items():
        match = re.fullmatch(r'(.+) ([A-Z][a-z]?)', star['name'])
        if (star['type'] in ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf']
                and identifier not in reviewed_ids and match and match[1] != 'Theta1 Orionis'):
            name_groups[match[1]][match[2]] = identifier
    audit = {'schemaVersion': 1, 'sources': [
        {'url': 'https://www.astro.gsu.edu/wds/orb6/orb6orbits.txt', 'frozenInput': 'catalog-work/star-systems/orb6-20261009.txt',
         'sha256': hashlib.sha256((WORK / 'orb6-20261009.txt').read_bytes()).hexdigest(), 'retrievedOn': '2026-10-09'},
        {'url': msc['url'], 'sha256': msc['archiveSha256'], 'frozenInput': 'catalog-work/star-systems/catalog-companions-msc.json'}],
        'policy': 'Exact reviewed WDS/HIP identities only; explicit pair scopes; no positional matches, estimated wide periods or photocenter axes. Angular relative axes converted to AU with the identified catalog parallax. Unknown MSC zeros stay null.',
        'identityInputs': [{'frozenInput': path, 'sha256': hashlib.sha256((ROOT / path).read_bytes()).hexdigest()}
                           for path in ['src/data/star-systems.json', 'src/data/stellar-companions.json', 'src/data/object-designations.json']],
        'systemsReviewed': len(output), 'systemsWithSolutions': sum(bool(s['orbits']) for s in output),
        'orbitCount': sum(len(s['orbits']) for s in output), 'reconciled': reconciled, 'rejected': rejected,
        'unreviewedNameGroups': [{'name': name, 'components': components} for name, components in name_groups.items() if len(components) > 1],
        'identityAmbiguities': identity_ambiguities,
        'unavailable': [{'systemId': s['systemId'], 'name': s['name']} for s in output if not s['orbits']]}
    (WORK / 'stellar-orbits-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(f"{audit['systemsWithSolutions']}/{len(output)} systems; {audit['orbitCount']} orbital solutions")


if __name__ == '__main__':
    main()
