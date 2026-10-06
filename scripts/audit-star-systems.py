"""Author a source-coverage report; no application execution or tests.

Search the full corrected CNS5 source for members of systems represented in
three base catalogs, within the approved 25 pc vicinity. Do not infer membership
from sky proximity or claim that a spectroscopic flag identifies another star.
"""
import collections
import csv
import hashlib
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'catalog-work/star-systems/companion-coverage.json'
CATALOGS = {
    'nearest-neighbors': ROOT / 'src/data/stars.csv',
    'nearest-100': ROOT / 'src/data/catalogs/nearest-100/stars.csv',
    'nearest-1000': ROOT / 'src/data/catalogs/nearest-1000/stars.csv',
}
def rows(path):
    with path.open(newline='') as handle:
        return list(csv.DictReader(handle))
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def source_key(row):
    if not row['total'].isdigit() or int(row['total']) < 2:
        return None
    return (row['primaryGj'] or row['gj']).rstrip('.') or None

def main():
    definition_path = ROOT / 'src/data/star-systems.json'
    definitions = json.loads(definition_path.read_text())
    reviewed = {c['starId']: (s['name'], c['label']) for s in definitions['systems'] for c in s['components']}
    cns5_path = ROOT / 'catalog-work/nearest-1000/cns5.dat'
    source = {}
    for line in cns5_path.read_text().splitlines():
        parallax = line[129:148].strip()
        source[line[:4].strip()] = {
            'gj': line[5:11].strip(), 'label': line[12:16].strip(),
            'total': line[17:18].strip(), 'primary': line[19:20].strip(),
            'primaryGj': line[21:26].strip(),
            'distancePc': 1000 / float(parallax) if parallax and parallax != '-' else None,
        }
    simbad_path = ROOT / 'catalog-work/nearest-1000/simbad.csv'
    simbad = {r['query_id'].removeprefix('CNS5 '): r for r in rows(simbad_path)}
    provenance_path = ROOT / 'src/data/catalogs/nearest-1000/provenance.json'
    provenance = json.loads(provenance_path.read_text())
    identities = collections.defaultdict(set)
    for entry in provenance['audit']:
        for sid in entry.get('starViewIds', []):
            identities[sid].add(entry['cns5Id'])
    for item in provenance['objects']:
        if item.get('cns5Id'):
            identities[item['id']].add(item['cns5Id'])
    census = json.loads((ROOT / 'src/data/catalogs/nearest-100/provenance.json').read_text())
    curated = {o['id']: o for o in census['objects']}
    census_input_path = ROOT / 'catalog-work/nearest-100/source-input.json'
    census_counts = json.loads(census_input_path.read_text())['fullCensusSystemMemberCounts']
    individual_reviews = {o['id']: o['individualComponentReview'] for o in provenance['objects'] if o.get('individualComponentReview')}
    component_research_path = ROOT / 'catalog-work/star-systems/component-research-37.json'
    component_research = json.loads(component_research_path.read_text()) if component_research_path.exists() else {'records': []}
    researched = {r['starId']: r for r in component_research['records'] if r.get('researchStatus') == 'reviewed'}
    result = {}
    for catalog, path in CATALOGS.items():
        stars = rows(path)
        groups = collections.defaultdict(dict)
        for star in stars:
            match = re.fullmatch(r'(.+) ([A-Z][a-z]?)', star['name'])
            association = reviewed.get(star['id'])
            if association:
                name, label = association
            elif star['id'] == 'proxima-centauri':
                name, label = 'Alpha Centauri', 'C'
            elif match:
                name, label = match.groups()
            else:
                continue
            if name != 'Theta1 Orionis':
                groups[name][label] = star['id']
        groups = {name: labels for name, labels in groups.items() if len(labels) > 1}
        grouped = {sid: name for name, labels in groups.items() for sid in labels.values()}
        flagged, b_records = [], []
        current_ids = {star['id'] for star in stars}
        represented_cns5 = {cid for sid in current_ids for cid in identities[sid]}
        represented_keys = {source_key(source[cid]) for cid in represented_cns5} - {None}
        missing_source_members = []
        for cid, raw in source.items():
            if source_key(raw) not in represented_keys or cid in represented_cns5 or raw['distancePc'] is None or raw['distancePc'] > 25:
                continue
            missing_source_members.append({'cns5Id': cid, 'source': raw,
                'simbadId': simbad.get(cid, {}).get('main_id'),
                'simbadType': simbad.get(cid, {}).get('otype'),
                'status': 'tentative-classification' if simbad.get(cid, {}).get('otype') == 'BD?' else 'unrepresented-source-record'})
        for star in stars:
            if star['id'] == 'sun':
                continue
            distance = math.sqrt(sum(float(star[key]) ** 2 for key in ('x_pc', 'y_pc', 'z_pc')))
            if distance > 25:
                continue
            raw = [dict(cns5Id=cid, **source[cid],
                simbadId=simbad.get(cid, {}).get('main_id'),
                simbadType=simbad.get(cid, {}).get('otype')) for cid in sorted(identities[star['id']])]
            component = reviewed.get(star['id'], (None, None))[1]
            name_match = re.search(r'(?:\s|\d)(B[a-z]?)$', star['name'])
            is_b = bool((component and component.startswith('B')) or name_match or any(r['label'].startswith('B') for r in raw))
            info = {'starId': star['id'], 'name': star['name'], 'distancePc': distance,
                'cardSystem': grouped.get(star['id']), 'componentLabel': component,
                'sourceRecords': raw}
            census_record = curated.get(star['id'], {})
            census_members = census_counts.get(census_record.get('systemId'), 1)
            if census_record:
                info['censusSystemId'] = census_record['systemId']
                info['censusNonPlanetMemberCount'] = census_members
            if is_b:
                info['status'] = 'associated' if info['cardSystem'] else 'planet-system-presentation-deferred' if star['id'] == 'cns5-1929' else 'component-review-required'
                b_records.append(info)
            if any(source_key(r) or r['simbadType'] in ('SB*', '**') or re.fullmatch('[A-Z]{2,}', r['label']) for r in raw) or census_members > 1:
                info = dict(info)
                info['status'] = 'associated-catalog-members' if info['cardSystem'] else 'unresolved-membership-or-identity'
                if star['id'] in individual_reviews:
                    info['individualComponentReview'] = individual_reviews[star['id']]
                if star['id'] in researched:
                    research = researched[star['id']]
                    info['componentResearch'] = {key: research[key] for key in
                        ('researchStatus', 'decision', 'outcome', 'sources', 'unresolvedComponents', 'implementationStatus')}
                if info['cardSystem'] and census_record and len(groups[info['cardSystem']]) >= census_members:
                    info['sourceFlagResolution'] = 'Individual non-planet census members already represented in this card.'
                if star['id'] == 'cns5-4137':
                    info['sourceFlagResolution'] = 'VB 8 is the single wide Gliese 644 C member in the reviewed five-member hierarchy; CNS5 CD is a legacy labeling scope.'
                if star['id'] in ('10pc-0091', 'cns5-1920', 'cns5-1929'):
                    info['status'] = 'planet-system-presentation-deferred'
                flagged.append(info)
        result[catalog] = {'nonSunObjects': len(stars)-1, 'cardSystemCount': len(groups),
            'cardSystems': groups, 'bRelatedRecordCount': len(b_records),
            'unassociatedBRelatedRecords': [r for r in b_records if r['status'] != 'associated'],
            'bRelatedRecords': b_records, 'multiplicityFlaggedRecords': flagged,
            'remainingComponentReviewRecords': [r for r in flagged if r['status'] == 'unresolved-membership-or-identity' or
                (r['cardSystem'] and not r.get('individualComponentReview') and not r.get('sourceFlagResolution') and any(s['simbadType'] == 'SB*' or re.fullmatch('[A-Z]{2,}', s['label']) for s in r['sourceRecords']))],
            'unrepresentedSourceMembersWithinVicinity': missing_source_members}
        remaining = result[catalog]['remainingComponentReviewRecords']
        result[catalog]['unresearchedComponentReviewRecords'] = [r for r in remaining if not r.get('componentResearch')]
        result[catalog]['researchedComponentRecordsAwaitingAuthoring'] = [r for r in remaining if r.get('componentResearch')]
    output = {'schemaVersion': 1, 'reviewDate': '2026-10-06', 'maximumCompanionDistancePc': 25,
        'scope': 'Companions of systems represented in the three base catalogs. Search all corrected CNS5 rows within 25 pc using explicit source membership; inspect available frozen SIMBAD flags and reviewed literature. This is not a complete 25 pc stellar census.',
        'limitations': ['CNS5 component count/labels can describe unresolved subsystems or use legacy naming scopes.',
            'The frozen 10pc source-input file contains 160 buffered candidates, not every member of the full 10pc census.',
            'SB* and ** flags alone do not establish the identities, stellar classes or number of additional individual companions.',
            'Literature research and catalog authoring are separate: reviewed proposals remain in the component queue until authored.',
            'Card counts reflect cataloged members; unresolved inner pairs can remain within a catalog component.'],
        'sourceRowsSearched': len(source),
        'inputSha256': {str(path.relative_to(ROOT)): digest(path) for path in [*CATALOGS.values(), definition_path, provenance_path, cns5_path, simbad_path, census_input_path]},
        'catalogs': result}
    if component_research_path.exists():
        output['inputSha256'][str(component_research_path.relative_to(ROOT))] = digest(component_research_path)
        output['componentResearchSummary'] = component_research.get('summary')
    OUTPUT.write_text(json.dumps(output, indent=2)+'\n')
    print(json.dumps({key: {'objects': r['nonSunObjects'], 'cardSystems': r['cardSystemCount'], 'bRelatedRecords': r['bRelatedRecordCount'], 'unassociatedB': len(r['unassociatedBRelatedRecords']), 'unrepresentedCns5Partners': len(r['unrepresentedSourceMembersWithinVicinity'])} for key,r in result.items()},indent=2))

if __name__ == '__main__':
    main()
