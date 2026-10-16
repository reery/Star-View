"""Find detected ORB6 pairs by exact WDS/HIP identity, including ordinary binaries."""
import collections
import re


def orbit_pairs(stars, identity_ids, lines):
    wds_index = collections.defaultdict(set)
    for designation, identifiers in identity_ids.items():
        if match := re.fullmatch(r"WDS J(\d{5}[+-]\d{4})([A-Z]+[a-z]?)?", designation):
            wds_index[match[1]].update(identifiers)
    results = []
    for line in lines:
        wds = line[19:29]
        if not re.fullmatch(r"\d{5}[+-]\d{4}", wds):
            continue
        hip = line[58:64].strip()
        matched = wds_index[wds] | (identity_ids.get(f"HIP {int(hip)}", set()) if hip.isdigit() else set())
        if not matched:
            continue
        designation, grade = line[30:44].strip(), line[233:234]
        pair = re.search(r"((?:[A-Z]+|[A-Z][a-z]\d?),(?:[A-Z]+|[A-Z][a-z]\d?|\d)|[A-Z]{2,})$", designation)
        labels = pair[1].split(',') if pair and ',' in pair[1] else list(pair[1]) if pair else ['A', 'B']
        if labels[1].isdigit() and labels[0][-1:].isdigit():
            labels[1] = labels[0][:-1] + labels[1]
        decision = "detected-visual-pair" if grade in "123458" and grade else "withheld-astrometric-or-nonvisual"
        if decision == 'detected-visual-pair' and not all(re.fullmatch(r'[A-Z][a-z]?\d?', label) for label in labels):
            decision = 'withheld-compound-scope'
        results.append({"wds": wds, "designation": designation, "grade": grade,
            "labels": labels, "implicitPair": pair is None, "catalogIds": sorted(matched),
            "reference": line[237:245].strip(), "sourceLine": line,
            "decision": decision})
    return results


def matching_members(pair, stars):
    """Associate a branch only when its exact component or catalog HIP is present."""
    first, second = pair['labels']
    groups = collections.defaultdict(list)
    for identifier in pair['catalogIds']:
        star = stars[identifier]
        labels = {match[1] for name in star['designations']
                  if (match := re.fullmatch(r'WDS J' + re.escape(pair['wds']) + r'([A-Z]+[a-z]?)', name))}
        if not labels:
            # The ORB6 HIP column identifies its cataloged binary/subsystem.
            # No sky-coordinate fallback or membership of unrelated WDS branches.
            hip = pair['sourceLine'][58:64].strip()
            if hip.isdigit() and f'HIP {int(hip)}' in star['designations']:
                groups[first].append(identifier)
        elif first in labels:
            groups[first].append(identifier)
        elif second in labels:
            groups[second].append(identifier)
        elif any(first.startswith(label) and second.startswith(label) for label in labels):
            groups[first].append(identifier)
        elif first + second in labels:
            groups[first].append(identifier)
    return {label: sorted(set(ids), key=lambda identifier: (identifier.startswith('hip-'), identifier))
            for label, ids in groups.items()}
