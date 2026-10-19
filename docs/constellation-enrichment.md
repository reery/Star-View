# Adopted constellation component literature — 2026-10-19

This follow-up adopts reviewed measurements and model results for four systems:
Castor, Spica, Nunki and Menkalinan (beta Aurigae). Ten existing component records
change and two new individual records are added. These changes reach all six
effective catalogs through the shared companion pool, including unloaded
constellation selections. They are an adopted literature pass, not a claim that
every field for every constellation star has been independently verified against
every recent publication.

## Component changes

| System | Adopted change | Scope |
| --- | --- | --- |
| Castor | Split YY Gem into Ca/Cb; individual masses 0.60597 / 0.60633 solar masses and radii 0.614 / 0.612 solar radii | [Kochukhov & Shulyak 2019](https://arxiv.org/html/1902.04157): true masses use the adopted eclipsing inclination; radii are volume-equivalent tomographic model results. |
| Spica | Separate close-binary Aa/Ab records; masses 11.43 / 7.21, radii 7.47 / 3.74, temperatures 25,300 / 20,900 K and bolometric luminosities | [Tkachenko et al. 2016, Table 7](https://arxiv.org/html/1601.08069); formal errors, asymmetric luminosity errors and shared 12.5 +/- 1 Myr model age retained. |
| Nunki | Individual model masses 6.5 / 6.3 solar masses and radii 4.1 / 3.9 solar radii | Approximate isochrone results explicitly retained in [Waisberg & Katz 2026](https://arxiv.org/html/2603.17011), sections 3.1 and 4.1; no fabricated formal errors. |
| Menkalinan | Replace the older component mass/radius solution with 2.359 / 2.293 solar masses and 2.752 / 2.622 solar radii | [Jonak et al. 2026](https://arxiv.org/html/2609.03886v1), Table 8 and profile-likelihood errors; older measurements and errors preserved. |

Castor's existing C selection ID now identifies Ca; Cb has its own ID. The
former combined C record remains explicitly retained. The tentative timing
companion Cc is not admitted. The preferred 290 Myr Castor model age is shared
with the confirmed members, with the Aa/Ba radius discrepancy documented.
YY Gem's 3800 K atmosphere parameter is explicitly an adopted common model
input, not two independent new measurements. Its derived component luminosities
retain that assumption.

Spica's source hierarchy contains uncertain intermediate occultation branches.
The review maps the confirmed 4.014-day spectroscopic primary/secondary (MSC
Aa1/Aa2) to the literature Aa/Ab labels, retaining the former primary selection
ID and the separate Ac record. The newer [Frost et al. interferometric
study](https://arxiv.org/html/2505.02300) was checked; approximate flux-based
mass ratios do not replace the resolved binary dynamical masses. This is the
published two-star physical solution, not a new refit including tertiary light.

Nunki's total dynamical mass is retained with the orbit and its two-sigma
uncertainty convention. It is not copied to either component. The approximately
18,500 K combined-spectrum estimate does not establish two individual measured
temperatures. Luminosities remain withheld rather than mixing its new model
radii with an incompatible generic temperature estimate.

For Menkalinan, the primary's absolute temperature still comes from the earlier
9350 +/- 200 K calibration. The secondary follows the newer temperature ratio,
rounded to 9327 K, retaining the approximately 200 K calibration uncertainty.
Bolometric luminosities are recomputed from the adopted temperature/radius
pairs. The much smaller formal error on the temperature ratio does not imply
a sub-kelvin absolute temperature measurement. Existing catalog astrometry is
unchanged; the new orbital solution retains its own published distance.

## Orbits and Info

Reviewed orbit records now cover Nunki Aa/Ab, Spica Aa/Ab, YY Gem Ca/Cb and the
newer Menkalinan solution. Nunki's relative orientation reproduces the signed
published separation vectors. Menkalinan's periastron is **HJD 2453827.2048**:
the paper's tabulated 53827.2048 is reduced HJD, not MJD. A regression checks
the signed Table 3 offsets and detects the half-day mistake that confusing
these conventions would introduce.

Spica lacks a reviewed astrometric node in the adopted 2016 solution; its
three-dimensional sky projection remains unavailable. YY Gem's circular
eclipse epoch is not relabeled as a periastron time. The earlier compiled
orbital solutions remain in the orbit audit's superseded-source records.

The four systems' existing compact Info articles now cite primary research
and explain the newly adopted data. Both added components share their correct
system article.

## Evidence and preservation

- `reviewed-constellation-hierarchies.json` fixes exact identity mappings;
  `reviewed-constellation-literature.json` records per-field adoptions;
  `reviewed-constellation-orbits.json` records orbital values and conventions.
- `literature-components/constellation-20261019-selected.json` freezes selected
  source tables, assumptions, source URLs, retrieval date and document hashes.
  Authoring verifies input checksums and exact component identities.
- Original aggregate records, older literature values, uncertainty metadata and
  complete prior reviews are retained. Existing component positions, proper
  motions, parallaxes, their errors, radial velocities and bulk vectors are
  unchanged. New close companions share explicitly approximate parent astrometry.
- A comparison with the working-tree snapshot before this pass confirms all six
  source CSVs and five source provenance files are unchanged, with no unexpected
  edits to other components. `enrichment-summary.json` records the before/after
  field changes and coverage.

The effective constellation overlay now contains 1,016 non-Sun records, of
which 522 belong to reviewed multiple systems. Component availability is now
239 temperatures, 153 masses, 139 radii, 135 luminosities and 62 ages. Some
aggregate metallicity/photometry values are now correctly retained as source
observations instead of counted as individual quantities. Availability is not
a count of independent measurements.

Many other systems still need dedicated component research, including the
initial audit's Porrima, Ashlesha and Nu Gem priorities. Unsupported or
unresolved values remain null. The full gap queue remains available in
`catalog-work/constellation-audit/coverage.json`.

## Validation

Production build, catalog preservation and cross-catalog consistency checks
passed. The preservation audit compared 2,887 baseline catalog/component records;
the effective consistency check covered 338 shared objects across six catalogs.
All 88 chart snapshots reproduce and the updated coverage report reproduces
byte for byte. Seventeen focused Python tests, 66 focused constellation,
component and orbital tests, and one desktop browser check passed. The browser
check selects the added companions, verifies the new masses and opens the
primary-source Info links for all four systems. The full test suite was not run.

Two old nearby-binary mass expectations in the existing component tests already
disagreed with the pre-change catalog snapshot; those expectations were aligned
with the existing adopted values, without changing those stars' data.
