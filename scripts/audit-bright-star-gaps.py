"""Audit every effective bright landmark/component against the frozen pre-review fields."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'catalog-work/bright-stars/gap-coverage-audit.json'
FIELDS = ('temperature_k', 'mass_solar', 'luminosity_solar', 'radius_solar', 'radial_velocity_kms')


def render():
    baseline = json.loads((ROOT / 'catalog-work/bright-stars/gap-baseline.json').read_text())['records']
    stars = json.loads((ROOT / 'src/data/generated/catalogs/bright-stars.json').read_text())['stars']
    systems = json.loads((ROOT / 'src/data/stellar-companions.json').read_text())['systems']
    aliases = {identifier:member['starId'] for system in systems for member in system['components']
               for identifier in [member['starId'],*member.get('alternateStarIds',[])]}
    records = {aliases.get(star['id'],star['id']):star for star in stars if star['id'] != 'sun'}
    if records.keys() != baseline.keys():
        raise ValueError('Bright review membership drifted')
    audit = []
    coverage = {field:{'before':0,'after':0,'filled':0} for field in FIELDS}
    for identifier, star in records.items():
        current = {field:(star.get('raw_astrometry') or {}).get(field) if field == 'radial_velocity_kms'
                   else star.get(field) for field in FIELDS}
        before = baseline[identifier]['values']
        for field in FIELDS:
            if before[field] is not None and current[field] != before[field]:
                raise ValueError(f'Existing effective value changed: {identifier}:{field}')
            coverage[field]['before'] += before[field] is not None
            coverage[field]['after'] += current[field] is not None
            coverage[field]['filled'] += before[field] is None and current[field] is not None
        missing = [field for field in FIELDS if current[field] is None]
        if identifier == 'bright-spica':
            reason = 'Aab is itself a retained unresolved pair. Published Aa/Ab quantities or sums are not individual Aab-star measurements; Ac stays separate.'
        elif identifier == 'bright-antares' and 'mass_solar' in missing:
            reason = 'Photospheric parameters adopted. Published 15 +/-5 solar track mass is INITIAL; current mass is a model-dependent range, so no point mass is fabricated.'
        elif star.get('catalog_sources'):
            reason = 'Retained catalog/system measurements are not a unique resolved-component observation. No additional exact-component value justified by the reviewed source set; blended flux, subsystem sums and MSC estimated masses remain source evidence.'
        else:
            reason = 'No additional adopted value justified by the exact-object frozen sources and literature reviewed here. No spectral-type mass or generic mass-luminosity calibration substituted.'
        audit.append({'id':identifier,'name':star['name'],
                      'filled':{f:current[f] for f in FIELDS if before[f] is None and current[f] is not None},
                      'missing':missing, **({'remainingGapReason':reason} if missing else {}),
                      'radialVelocityReference':(star.get('raw_astrometry') or {}).get('radial_velocity_ref')})
    return {'schemaVersion':1,'reviewedOn':'2026-10-18','nonSolarObjects':len(records),
            'scope':'Effective generated bright catalog, including all confirmed companions loaded at runtime; Sun excluded because its heliocentric radial velocity is not applicable.',
            'researchBoundary':'Audit of every missing field against frozen exact-identity sources, plus the cited 2025/2026 surveys and dedicated component papers. Remaining gaps mean no adoption justified in this review, not proof that no publication exists.',
            'coverage':coverage,'records':sorted(audit,key=lambda row:row['id'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write',action='store_true')
    args = parser.parse_args()
    result = render()
    text = json.dumps(result,indent=2)+'\n'
    if args.write:
        OUTPUT.write_text(text)
    elif not OUTPUT.exists() or OUTPUT.read_text() != text:
        raise SystemExit('Bright gap audit is stale: run scripts/audit-bright-star-gaps.py --write')
    print(json.dumps({'objects':result['nonSolarObjects'],'coverage':result['coverage']}))
