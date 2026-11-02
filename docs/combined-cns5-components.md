# Combined CNS5 components — 2026-11-02

Thirteen corrected CNS5 records carried a combined label such as `AB` or `BC`.
They were never split because the automatic MSC, ORB6 and SB9 passes skip
systems already defined by CNS5 (`covered-reviewed-system`), and the orbit
pass rejected their pairs as an unresolved component scope.

## Split

`reviewed-component-splits.json` splits ten systems with the existing reviewed
hierarchy mechanism (`apply_hierarchy_splits`). The former record keeps its ID
as the first member; the new member gets `<system id>-<label>`. The blended
parent stays a scoped `reviewed-unresolved-parent` source. Aliases naming the
second member (HR 5728, HD 130948C, GJ 337 B) move to it, both in the
companion pool and in generated payloads. The new members share the
parent's position and bulk motion.

| System | Former record | Components | Individual values adopted |
| --- | --- | --- | --- |
| Iota Leo | AB | A, B | V (MSC); A keeps class, Teff and [Fe/H] of SIMBAD `* iot Leo` (A aliases only) |
| Eta CrB | AB | A, B | V (MSC); dynamical masses 1.243/1.100 (Muterspaugh et al. 2010) |
| 26 Dra | AB | A, B | V (MSC); A class G0V, Teff and [Fe/H] of SIMBAD `* 26 Dra` |
| Pi1 Cnc | AB, CD | A, B, C, D | A/B V and G9V (MSC); C/D none |
| HD 25893 (50 Per) | AB | A, B | V (MSC); A G9V, Teff, [Fe/H], FLAME luminosity of its own SIMBAD/Gaia identity; B is unresolved Ba+Bb |
| GJ 2060 | AB | A, B | V (MSC); M1V/M3V, Teff, luminosity (Rodet et al. 2018) |
| HD 200525 | AB | A, B | V (MSC); combined-orbit masses 1.15/0.74 (Tokovinin 2023) |
| Gl 417 | BC | B, C | L4.5/L6, Teff, luminosity, model masses, age (Dupuy & Liu 2017) |
| HD 130948 | BC | B, C | L4/L4, Teff, luminosity, model masses, age (Dupuy & Liu 2017) |
| HD 23189 | BC | B, C | none |

Values of blended identities remain retained sources, not component values:
the composite classes, temperatures and [Fe/H] of Eta CrB, Pi1 Cnc, GJ 2060
and HD 200525, and the total dynamical masses. Missing fields stay empty when
the sources conflict: Eta CrB (G2V+G2V versus MSC G0V/G3V), HD 200525 (F9.5V
versus MSC G3IV), Pi1 Cnc C/D (no component mapping for L8.5+L7.5), and
HD 23189 B/C (inconsistent MSC magnitudes, unordered M2V+K6V). The same
applies to uncertain classes such as 26 Dra B (`K5?`). Teff from a spectral
type uses the existing dwarf-sequence estimate.

With both components present, ORB6 orbits now attach to all ten systems
(Iota Leo STF 1536AB, 189.6 years).

## Not split

- HD 17382 (GJ 113): its Ab is an unseen single-lined companion with only a
  minimum mass.
- Rho Gem (GJ 274): B is a faint companion without a spectrum, physical only
  by hypothetical parallax.
- CU Cnc / CV Cnc (GJ 2069): the legacy labels AE, BC and D do not match the
  published Aa1/Aa2/Ab/Ba/Bb hierarchy; relabeling needs a separate review.

## Orbit period fix

The ORB6 period field covers bytes 81–92. The parser read from byte 82, so
periods that fill byte 81 lost their first digit. This affected Eta CrB
(15204.9 d) and eight existing orbits: BD+19 5116, HD 130948 A–BC, HD 53705,
Beta LMi, Alfirk Aa–Ab, Alkaphrah, Gamma CrB and HD 182488. The full
regeneration also refreshed Beta Phe's axis from the current catalog parallax
(17.93 mas; the committed file used 0.12 mas).

## Reproduce

Run `python3 scripts/author-stellar-companions.py --write`, then
`python3 scripts/author-stellar-orbits.py`, `python3 scripts/author-surface-gravity.py`
and `node scripts/catalogs.ts generate`. `npm run catalog:validate` passed;
no tests were run.
