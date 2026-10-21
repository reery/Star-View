# Frozen 151-target review (2026-10-21)

See [the human-readable report](../../docs/bright-western-enrichment-20261021.md) for scope, limitations, validation, and the complete target table.

- `baseline-scope.json`: original deduplicated bright/Western scope, including eligible non-targets.
- `targets.json`: immutable 151-target selection and per-catalog baseline values/display scopes.
- `target-identities.json`: exact frozen source IDs, object types, and spectra.
- `literature/`: original CDS documentation and only target-matched raw data rows (including rejected alternatives); selected factual paper tables and primary records.
- `source-crossmatches.json`: lossless parsed matched rows, not adoptions.
- `source-manifest.json`: source URLs, references, and frozen input digests.
- `physical-review.json`: accepted per-field source values, units, model/phase/component scope, uncertainties, methods, and exact identity guards. `catalogObjects` feeds existing shared enrichment; `objects` feeds the shared component author. Existing values always win.
- `review-decisions.json`: a decision and accepted fields for every target, including unchanged targets.
- `results.json`: audited applied values, remaining gaps, and preservation counts.

No network calls are made during catalog authoring or validation. These are reviewed/frozen authoring inputs. Edit them only after reviewing the exact source/component; update all affected source digests together. A source-matched row alone does not authorize its adoption.

Regenerate using the project's catalog-authoring Python dependencies. Order matters: overlay provenance records the nearest-1000 source checksum.

```sh
python3 scripts/author-nearest100.py default --write
python3 scripts/author-nearest100.py build --force
python3 scripts/author-nearest1000.py build --force
python3 scripts/author-bright-stars.py --write
python3 scripts/author-landmark-stars.py --write
python3 scripts/author-stellar-companions.py --write
python3 scripts/author-constellations.py --write
npm run catalog:generate
npm run catalog:preservation
python3 scripts/audit-bright-western-enrichment.py
```

The focused audit verifies every adoption, unit-conversion pitfalls, exact primary membership, frozen source checksums, all original raw/component values and provenance, and the unchanged secondary records against the recorded baseline commit. Its optional `--baseline-effective PATH` additionally compares a saved pre-regeneration hydrated snapshot across all catalogs; `--write` exports its report. The saved result includes that full effective-record comparison from this review.

The full test suite requires explicit user authorization after inspection, per AGENTS.md.
