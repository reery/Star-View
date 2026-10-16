# Stellar orbit coverage audit

Reviewed 2026-10-10 after the EZ Aquarii identity fix. Scope: all six stellar
catalog layers, the shared companion pool, all reviewed systems, and every
multi-component group inferred by the UI from an established common name.
This checks the frozen ORB6 2026-10-09 and MSC 2026-06-19 inputs; it is not an
exhaustive search of the astronomical literature.

The audit expanded the explicit registry from 270 to 284 systems. Orbit coverage
increased from 223 solutions in 170 systems to **242 solutions in 182 systems**.
There are now **zero unaudited fallback name groups**. Fourteen formerly
name-only systems were registered, including four for which these inputs do not
provide a safely scoped orbit. Epsilon Indi's existing MSC system was reconciled
with its original census Ba/Bb records; its generated IDs remain aliases.

## Newly available systems

| System | Adopted pairs | Cause |
| --- | --- | --- |
| Luhman 16 | A–B | Missing reviewed identity |
| Luyten 726-8 | A–B | Missing reviewed identity |
| V577 Mon / Ross 614 | A–B | Missing reviewed identity |
| FL Vir / Wolf 424 | A–B | Missing reviewed identity |
| GJ 1245 | A–C, AC–B | Missing reviewed identity and flat/hierarchical naming |
| EI Cancri | A–B | Missing reviewed identity |
| Stein 2051 | A–B | Missing reviewed identity; unrelated A photocenter solution stays rejected |
| Xi Bootis | A–B | Missing reviewed identity |
| p Eridani | A–B | Missing reviewed identity |
| L 601-78 | A–B | Missing reviewed identity |
| Theta1 Orionis A subsystem | Aa1–Aa2 | Spectroscopic source labels refer to a different hierarchy level |
| Matar | A–B | Published Aa/Ab names versus the app's flat labels |

Some solutions are partial, preliminary, or describe a photocenter, so source
coverage does not guarantee a drawable path. Luhman 16's Julian-year epoch flag
is now preserved explicitly.

## Corrected scopes and recovered hierarchy nodes

GJ 105's 76-year solution is [A–C](https://arxiv.org/abs/2505.08042), not A–B;
the incorrect duplicate scope was removed. GJ 22 uses its
[A–C inner pair](https://arxiv.org/abs/astro-ph/0305330) and AC–B outer orbit.
GJ 570 uses the published [B–C pair](https://arxiv.org/abs/astro-ph/9909342) and
A–BC outer orbit. GJ 667's outer AC source label denotes AB–C.

The old parser read `AB,C` as `B,C`, dropping A. Complete compound sides now
preserve the centers of mass of all their members, including Castor and Ashlesha.
Algol's source Aa1/2 pair maps to the app's Aa/Ab, while the published Aa/Ab
outer pair maps to A–B. Tau Tauri's visual Aa/Ab names denote the app's Aab–Ac
orbit; its short-period Aa–Ab solution is separate. The frozen MSC hierarchy and
publication/discoverer references establish these mappings.

Explicit Aa1/Aa2 children now resolve the Aa center of mass, and explicit Aa/Ab
children resolve Aab. This restores supported outer orbits for Epsilon Persei,
Lambda Tauri, Mintaka, Nu Geminorum, Shaula and Alfirk. Implicit ORB6 pairs are
accepted only through a unique MSC cross-reference matching WDS, publication,
designation and period; existing source precedence and photocenter limits remain.

## Rejections retained

Wolf 1561's BEU 22 orbit is the
[GJ 852 BC close pair](https://astro.gsu.edu/~vrijmoet/Vri22/Vrijmoet_2022_Fulltables.pdf),
not the displayed outer A–B pair. GJ 810's source solution is an unresolved
inner pair in A. The old GJ 835 photocenter solution cannot safely be matched to
the reviewed close companion. These do not receive invented component matches.

Gamma Cephei's 902.9-day Aa/Ab orbit is planetary, so it is not imported as a
stellar pair. Theta2 Tau's Aa/Ab orbit is not Theta1 Tau's Ba/Bb pair even though
they share a WDS field. Ambiguous Trapezium WDS identities remain rejected.
SCR J1845-6357, L 43-72 and VB 24 have no safely matched solved orbit in these
frozen inputs. The 102 unavailable systems are not claimed to lack published
orbits elsewhere.

## Reproduction

Regenerate with `python3 scripts/author-stellar-companions.py --write`, then
`python3 scripts/author-stellar-orbits.py`. The current coverage audit records
input hashes, reconciliations, rejections, identity ambiguities and any remaining
UI name groups. The reviewed baseline, decisions, evidence and exact changes are
in `catalog-work/star-systems/orbit-coverage-review.json`.
