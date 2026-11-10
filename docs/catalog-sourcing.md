# Offline Catalog Sourcing

## Shared supplements: ages, interferometric radii, RVS metallicity and Gaia V (2026-11-10)

Two frozen snapshots extend the shared enrichment for every stellar catalog. Both select rows by identities already frozen elsewhere, never by position. `catalog-work/shared-enrichment/gaia-supplement` holds Gaia DR3 photometry, blending indicators and GSP-Spec parameters for the 13,423 exact Gaia DR3 sources of the landmark, naked-eye, nearest-1000 and nearest-5000 snapshots (`refresh-catalog-sources.py gaia-supplement`). `catalog-work/shared-enrichment/vizier-supplement` holds Casagrande et al. (2011), David & Hillenbrand (2015) and JMDC rows for exact HIP and SIMBAD identifiers (`refresh-catalog-sources.py vizier-supplement --vizier-url <mirror>`; frozen from the IDIA mirror while Strasbourg is down). Each rule was checked against the frozen measurements before adoption:

- **Radius**: JMDC limb-darkened angular diameters from direct techniques, with the catalog's adopted distance. Only measurements precise to 5 percent are kept, with no binarity or doubt note. Keck Interferometer Nuller values (2014ApJ...797..119M) are excluded: they are exozodi-survey by-products, and Gamma Lep's 1.87 mas compares with about 1.25 mas. The most precise value within 10 percent of the star's median is adopted, provided a strict majority agrees. It ranks after reviewed linear diameters and before every model radius. Unresolved systems are skipped.
- **Metallicity**: Gaia DR3 GSP-Spec [M/H] with the Recio-Blanco et al. (2023) field-star log g calibration, and only when all first 13 flags are zero and the GSP-Spec temperature is 4,000-7,000 K. Against SIMBAD spectroscopic [Fe/H], these values scatter by 0.08 dex (robust), with a -0.07 dex median offset expected for [M/H] against [Fe/H]. Medium-quality flags miss by more than 0.3 dex for half of the stars, so they are not used. GSP-Spec ranks after the spectroscopic [Fe/H] consensus and before GSP-Phot.
- **Age**: Casagrande et al. (2011) BaSTI ages (not for blended multi-component photometry) and David & Hillenbrand (2015) ages with a complete 68 percent interval, when the interval's half-width is within 30 percent of the median. The tightest qualifying age wins and ranks ahead of Gaia FLAME. Hunt & Reffert (2023) cluster ages were evaluated and left out, because only 21 of 189 qualifying members had ages within 0.2 dex.
- **Johnson V** (nearest-1000 and nearest-5000 stars without a compiled V): the exact Gaia DR3 source's G and BP-RP, using the Riello et al. (2021) Table C.2 cubic (constant term first). It is used only for BP-RP between -0.5 and 3.0, a corrected flux excess |C*| below 0.05 and non-duplicated sources. Against 3,458 SIMBAD V values the robust scatter is 0.028 mag. Redder M dwarfs come out 0.07-0.27 mag too bright, and white dwarfs and substellar objects are outside the fitted sample, so all of these stay blank.

In the naked-eye catalog, McDonald et al. (2012) fits are no longer used for O and B stars. Of 130 such fits beyond 20 percent of their spectral class, 129 were too cool, and half of the others with spectra missed them by more than 20 percent.

## Gaia flags and long-baseline proper motions (2026-11-07)

`scripts/author-gaia-flags-review.py` reads three downloads in `catalog-work/downloads/`,
which is not committed: Gaia DR3 flags and non-single-star orbits for our exact source
IDs, the Hipparcos-Gaia catalog (Brandt 2021) and Kervella et al. (2022). Their hashes
are recorded in the outputs, `src/data/long-baseline-motion.json` and
`catalog-work/star-systems/gaia-flags-review.json`.

- **Proper motion:** a Gaia fit or a catalog value can be shifted by an unseen orbit.
  The long-baseline value replaces it when the same Gaia source shows significant
  acceleration (χ² > 11.8), the shift exceeds 1 mas/yr, the value lies closer to the
  independent Hipparcos proper motion than the catalog value does, the row's parallax
  is within 30% of Gaia, and the star does not become implausibly fast. The velocity
  changes only by the proper-motion term. The old value stays in the notes. Single
  stars change through `supplementLongBaselineMotion`, system members through the
  companion pool. Members with reviewed common motion keep it.
- **Held:** `held` in the motion file gives each star's reason. Reviewed cluster members
  keep their frozen astrometry. Very long orbits are corrected less well.
- **Merged identities, fixed:** identity keys compared single-letter Bayer and Lacaille
  names without case, so 36 pairs such as `E Pup` and `e Pup` shared one record with both
  stars' HIP and Gaia numbers. The keys in `author-object-designations.py` and
  `author-naked-eye-stars.py` now keep case for those names only. This restored six
  naked-eye stars that had been treated as duplicates (Q Car, D01 Car, i Car, y Vel,
  Q Vel and a Cen) and removed 32 Wikipedia links that pointed to the lowercase twin.
  SIMBAD itself lists both cases for some stars, such as `* G Her` and `* g Her` for 30 Her;
  those aliases stay.
- **Gaia orbits:** plain `OrbitalTargetedSearch` solutions are not adopted, because only
  6 of 12 agreed with known periods. An orbit attaches only when the two components
  share one Gaia source or sit close enough for it to describe them. Otherwise it
  usually marks a hidden inner pair, as for CM Dra and BY Dra. `heldOrbits` lists these.
- **Double-lined Gaia orbits:** `gaia-double-lined-review.json` adds a stellar companion
  to an otherwise single star through the SB9 authoring path. A star is held when it
  lists several Gaia sources or SB9 orbits, SB9 gives a different period, it is already
  a component of a wider pair, tides should have circularized its orbit, or its velocities
  imply a total mass its spectral class cannot have. Where SB9 also has the orbit, the
  periods agree (GX Peg, HD 112014, Iota TrA), except 72 Psc, which is held.
- **Review lists:** `singleStarOrbits` sorts single stars with a Gaia orbit, and
  `distancesForGaiaDr4` lists Hipparcos and Gaia parallax conflicts for Gaia DR4.
  Neither changes any catalog value.

## Naked-eye double-lined SB9 systems (2026-11-07)

`nakedEyeParents` also admits every double-lined SB9 system whose exact identity
matches one otherwise single naked-eye row, when the SB9 entry is the whole star or
its A component. Of 233 candidates, 192 are authored; 25 have several SB9 entries or
identities, 14 are entries for a B or sub-component, one matches two catalog rows,
and HD 27483 is held in `nakedEyeHeld` because its composite spectrum would make the
primary a white dwarf. Existing ORB6 and composite-spectrum rules author 69 of the
192 systems; the rest use the SB9 path.

- **Motion:** admitted parents keep their motion. All components share the parent's
  proper motion with the orbit's fitted systemic velocity, or the parent's own radial
  velocity when SB9 held the velocity fixed or gives none.
- **Orbits:** every SB9 system now gets orbital elements unless a better solution
  exists. `best_orbit` picks the highest SB9 grade, then the smallest fractional
  period error. SB9 gives no inclination, node or size, so no orbit is drawn.
- **Map:** an unresolved parent shows its blended V on the map through
  `mapAbsoluteMagnitude`. Before this, such parents, including Rasalhague A and
  Porrima A, were drawn as faint background points. The blended light is display-only.
- **Spectral class differs from the parent, for hand review:** HD 18894, 31 Men,
  17 Lep, 19 Lyn, b Gem, S Ant, Zeta Sct and HD 70442.

A component without its own mass opens the Mass card with the retained source value
that Specs shows, greyed, with the same tooltip. 49 Lib Aa keeps its model mass and no card.

Run `npm run catalog:regenerate` after changing reviewed companion data. It repeats
the dependent authoring steps until their outputs stop changing, then generates and
validates the catalogs.

## 49 Lib binary review (2026-11-06)

49 Lib was a single naked-eye row although SB9 lists it as system 3221. It is now
the reviewed system `sb9-3221`, with components 49 Lib Aa (`hip-78400`) and the
unseen white dwarf 49 Lib Ab (`sb9-3221-ab`). `nakedEyeParents` in
`catalog-work/star-systems/spectroscopic-binaries-review.json` admits this one
naked-eye row to the companion pool. Other naked-eye rows stay out. Source values
are frozen in `literature-components/49-lib-20261106-selected.json`.

- **Physical values:** temperature, [Fe/H], V and the 12 ± 1 Gyr age come from
  [Fuhrmann & Chini (2017), Table 1](https://iopscience.iop.org/article/10.3847/1538-4357/834/2/114);
  errors are 2σ. The earlier 6321 K and [Fe/H] +0.1 (Soubiran et al. 2022) stay in
  the retained naked-eye source.
- **Luminosity and radius:** 4.48 L☉ and 1.84 R☉ are rescaled to the adopted Gaia
  DR3 distance. The paper's M_bol of 2.64 and radius of 2.24 ± 0.13 R☉ imply
  35.3 pc, the Hipparcos scale.
- **Masses:** both ship as greyed `mass_model` values and `mass_solar` stays null.
  Aa's 1.55 +0.07/−0.13 M☉ is a track mass on the same Hipparcos scale. Ab's
  0.50 +0.03/−0.04 M☉ follows from the mass function and scales with that primary
  mass; Willmarth et al. (2016) obtain 0.45 M☉ for 1.4 M☉.
- **Orbit:** [Willmarth et al. (2016), Tables 2–3](https://doi.org/10.3847/0004-6256/152/2/46)
  give the spectroscopic elements and the Hipparcos inclination and node. The total
  axis of 2.72 AU is from Fuhrmann & Chini.
- **Motion:** the systemic velocity is −20.111 ± 0.036 km/s (Willmarth). Proper
  motion is the Hipparcos–Gaia long-baseline value from Brandt (2021), −630.554,
  −394.931 mas/yr, which agrees with Tycho-2. Gaia DR3's −667.446, −378.224 is a
  short-baseline fit shifted by the orbit and stays in the retained source.
- **Distance is unresolved:** Hipparcos (28.40 ± 1.23 mas), Gaia DR2 (34.23 ± 0.19)
  and Gaia DR3 (35.27 ± 0.60, RUWE 4.33) are all single-star fits to an astrometric
  binary. The photocentric orbit implies about 31.8 ± 2.2 pc. The Gaia DR3 distance
  stays until a solution that models the orbit is available.
- **Not a member:** WDS ENG 55 B shares no proper motion with 49 Lib.

`scripts/author-stellar-orbits.py` now skips the naked-eye catalog, as the companion
pool does, and counts compact systems as reviewed. A full run otherwise reports 44
naked-eye name pairs and V404 Cygni as unreviewed. Those 44 pairs have no system yet.

## WISE 0855-0714 physical review (2026-11-06)

Reviewed values live in `catalog-work/nearest-100/physical-overrides.json`, which
also corrects the position.

- **Luminosity:** log(L/L☉) = −7.22 ± 0.02 from [Leggett (2026), Table 1](https://arxiv.org/abs/2603.24740),
  integrated over JWST NIRSpec and MIRI spectra plus a Rayleigh–Jeans tail (16% of
  the total). It replaces −8.57 ± 0.06 from Zapatero Osorio et al. (2016), a
  model scaled to the W2 band, which stays in the notes as superseded.
- **Temperature:** 276 ± 9 K from the same table, based on luminosity and evolutionary
  models. It replaces the assigned 250 K. The inspector labels it
  “Temperature (model)”, because published estimates span about 250–297 K.
- **Radius:** 0.1074 R☉ (1.045 R♃) by Stefan-Boltzmann scaling from those inputs,
  labelled “Radius (model)”. The previous 0.0277 R☉ is retired as wrong.
- **Position:** Kirkpatrick et al. (2021) astrometry propagated to J2000. Earlier
  rows used coordinates from about epoch 2010.5, 86″ away.

## WISE 0855-0714 scoped observations (2026-10-15)

The reviewed supplement in `src/data/stellar-observations.json` is applied after
exact object identities during browser-payload generation. All three nearby
catalogs receive the same observations, and cross-catalog consistency checks
include this metadata. Existing CSV measurements and effective components are
preserved.

- **Mass:** 3–10 Jupiter masses from [Luhman (2014), Section 3.2](https://arxiv.org/pdf/1404.6501),
  conditional on an assumed age of 1–10 Gyr; this is a model range, not a
  dynamical measurement or confidence interval. The inspector labels it
  “Mass (model)”; scalar mass, measured age and mass-derived physics stay
  unavailable. The earlier Zapatero Osorio (2016) context remains preserved.
- **Magnitude:** WISE W2 (4.6 μm, Vega) apparent magnitude **13.89 ± 0.05**,
  from Luhman (2014), Table 1. This is the moving object's photometry after
  correction for the two stationary background sources, not the blended
  All-Sky W2 value of 13.63. Its observing dates, uncertainty and correction
  scope remain attached. A separate W2 row preserves the Johnson V fields and
  visible-light comparisons as unavailable.
- **Radial velocity:** [Rowland et al. (2024), Appendix B, Figure 7](https://arxiv.org/html/2411.14541v2)
  reports discrepant retrieval velocities attributed to wavelength calibration.
  These fits are not adopted as bulk radial velocity. The reason is retained
  in the inspector tooltip and source notes; the existing proper motion,
  astrometric uncertainties and transverse-only motion remain intact.

## Shared enrichment policy (2026-10-05)

Every stellar catalog builder now consults the same frozen physical-source pool
in `scripts/catalog_sources/enrichment.py`. Exact SIMBAD identities and unique
Hipparcos/Gaia DR3 identifiers share eligible measurements and model results
across catalog selections. Curated rows retain their existing values while blank
fields remain eligible for enrichment. There are no name or sky-position guesses
in this source-sharing step. Generic single-star evolutionary masses and radii
remain ineligible for unresolved binary entries; component-resolved papers can
supply those properties explicitly.

The pool combines the existing SIMBAD physical measurements, Allende Prieto &
Lambert (1999) evolutionary models, McDonald et al. (2012) SEDs, and quality-filtered
Gaia DR3 parameters. SED luminosities are rescaled to each row's adopted distance.
Missing radius/luminosity is completed by Stefan-Boltzmann scaling when the other
two inputs exist, with input values and inherited assumptions recorded. Remaining
unambiguous luminosity-class V spectra and normal L/T/Y brown-dwarf subtypes can
receive a **temperature estimate**, using the frozen Pecaut-Mamajek 2022.04.16
sequence with interpolation and no extrapolation. Giants, subgiants, white dwarfs,
peculiar/uncertain/composite spectra do not receive that generic estimate. No
generic age, metallicity, mass, or Johnson V is invented.

### Union-wide literature expansion (2026-10-05)

`scripts/refresh-shared-physical.py --retrieved YYYY-MM-DD` explicitly acquires a
separate, immutable literature snapshot for the union of all four frozen SIMBAD
identity exports. The 2026-10-05 snapshot queries 1,791 exact SIMBAD identities and
1,062 HIP identifiers, yielding 18,812 `mesFe_h` spectroscopy records, 433
Allende Prieto & Lambert model rows and 552 McDonald SED rows. Queries, raw values,
bibliography and hashes live in `catalog-work/shared-enrichment/literature/`.
Every stellar builder reads this same pool; no overlay needs to be enabled for
its measurements to be available in a base catalog.

Existing curated values and previously reviewed spectroscopy choices retain
priority. The automatic spectroscopy fallback excludes missing/nonfinite values,
temperature outside 1,000–100,000 K and iron abundance outside −5 to +1.5 dex,
including common sentinel values. For an F–M dwarf (luminosity class V or none),
a solution whose temperature lies more than 20 percent from the Pecaut-Mamajek
dwarf sequence for its spectral type is excluded together with its [Fe/H]. Survey
pipelines such as RAVE, LAMOST and APOGEE Net otherwise return grid-edge or G-star
solutions for M dwarfs, or describe a blended brighter neighbour. If three distinct
papers agree on the contradicting temperature, they are kept, since the spectral
type is then the likelier error. Giants, O–A stars and ultracool dwarfs are not
checked. A contradicted spectral type is withheld only by an explicit shared
review: UPM J0901-6526's sole K5 label (Riaz et al. 2006, SIMBAD quality D)
conflicts with its Gaia colour, absolute magnitudes, mass and temperature, all of
which indicate a mid-M dwarf. No replacement type is inferred. Among multiple
observations, a strict majority
must lie within 10 percent of the median temperature or 0.3 dex of the median
metallicity; select the newest publication in that group. This is a conservative
selection heuristic, not a guarantee that the newest paper is the best. No new
mean measurement or invented uncertainty is exported. The entire measurement
pool remains available for later review; selected references and record IDs are
retained per field. Spectroscopic iron abundance is explicitly **photospheric
[Fe/H]**, distinct from Gaia's model-derived [M/H]. Unresolved spectra may describe
the primary-dominated light, and no single-star model mass is adopted for a binary.

Mu Cas previously had no Gaia physical parameters, no applicable frozen
Hipparcos-literature subset, and a `G5Vb` spectrum ineligible for the mean-dwarf
temperature fallback. `reviewed-physical.json` now adopts Bond et al. (2020) primary
**Mu Cas A** properties: 5,346 ± 70 K, 0.7440 ± 0.0122 solar masses,
0.458 ± 0.014 solar luminosities, 0.789 ± 0.008 solar radii, photospheric
[Fe/H] = −0.81 ± 0.03 and a **model age** of 12.7 ± 2.7 Gyr. Temperature and
luminosity follow the preferred §9.1 discussion rather than the earlier Table 9
temperature/luminosity pair; radius remains the Table 9 interferometric value.
The paper suspects a systematic overestimate in angular diameter and calls its
age conclusions suggestive. Scope, sections, formal errors and those caveats stay
in provenance and row notes. The existing system marker, position and motion are
retained; the displayed mass is not the binary's total mass.

This expansion adds 698 previously blank physical fields across the shipped
snapshots (each shared object counts once per catalog): default 3, nearest-100 25,
nearest-1000 295, bright 45, constellation 318 and cluster 12. Most gains are
metallicity. Published object-specific temperatures replace some previously
generated automatic fallbacks; existing curated properties remain authoritative.
New metallicities also exclude the older solar-composition evolutionary masses
for Vega and Fomalhaut in nearest-1000; these masses stay unavailable pending a
better applicable source.

Nearest-1000 non-Sun coverage after this expansion is temperature 858, mass 550,
bolometric luminosity 597, radius 610, metallicity 617 and age 83. Equal source
access does not imply equal completeness: binaries, faint substellar objects and
white dwarfs still have different applicable measurements. Unsupported fields
remain null.

**Gorgonea Tertia review (2026-10-06).**

Rho Persei (HIP 14354 / HD 19058) gains mass **1.9 ± 0.7 M☉**, bolometric
luminosity **2,692 +192/−180 L☉**, and radius **143 ± 12 R☉** from
[Kallinger et al. (2019), Tables 2–3, row E](https://arxiv.org/html/1902.07531).
The radius uses that paper's 3,479 K temperature; existing spectroscopy remains
unchanged. These are derived/SED properties. Age stays unavailable. Inputs,
uncertainties and caveats are frozen in `reviewed-physical.json` and provenance.

Reviewed additions include Procyon A/B (Bond 2015, Chiavassa 2012, Allende Prieto
2002, and resolved visual photometry), LAWD 37 (McGill 2023), Stein 2051 B (Sahu
2017), and Epsilon Indi Ba/Bb (Chen 2022; King 2010). Procyon B's displayed age is
the preferred **total binary age**, not its white-dwarf cooling age. The age's
strong model dependence and alternative Procyon A tracks remain in the notes.
Ordinary stellar [Fe/H] is not assigned to polluted white-dwarf atmospheres.

The earlier shared-source pass filled 411 previously blank fields across the shipped snapshots (shared
objects count once per catalog). The nearest-1000 physical coverage, excluding
Sun, changes as follows:

| Field | Before | After |
| --- | ---: | ---: |
| Temperature | 559 | 823 |
| Mass | 530 | 547 |
| Bolometric luminosity | 526 | 575 |
| Radius | 585 | 605 |
| Metallicity | 385 | 390 |
| Age | 78 | 82 |
| Absolute Johnson V | 544 | 546 |

The shared input manifest is `catalog-work/shared-enrichment/source-manifest.json`;
its checksums are verified during authoring and its digest is retained in each
package's provenance. Per-object records distinguish measured, model-derived,
estimated and derived fields. Remaining blanks indicate a missing eligible source,
an ambiguous component match, or an inapplicable parameter, and stay eligible for
future reviewed supplements.

## This Release

The project now ships four snapshots. **Nearest 1000 objects** contains 1000 non-Sun individuals plus Sun. Corrected CNS5 (13-Dec-2023) defines its membership backbone; exact CNS5 identifiers enrich through a frozen SIMBAD TAP export and exact Gaia DR3 identifiers enrich through a frozen Gaia TAP export. All 101 enriched nearest-100 rows are retained field-for-field as higher-curation overrides.

**Bright stars** was consolidated into Western constellation stars on 23 October 2026 ([consolidation note](bright-catalog-consolidation.md)); its package is archived under `catalog-work/bright-stars/retired-catalog/` and remains the authoring source described here. It retains its 114 original qualifying landmarks within 3000 light-years and adds 11 reviewed individual companions, for 125 non-Sun records plus Sun. The [overlay companion review](overlay-companion-expansion.md) describes the six implemented systems, including Rigel A/Ba/Bb/C. Companion records are exempt from the landmark brightness cutoff. Membership includes every stellar entry in the frozen SIMBAD snapshots with compiled apparent Johnson V below 2.70. A SIMBAD stellar-hierarchy join excludes NGC 1980: its integrated V=2.50 qualifies numerically, but it is an open cluster rather than a star. The aggregate Alpha Centauri system row is omitted in favor of its separately qualifying A and B components, while Acrux uses the Bright Star Catalogue combined V=0.76 because SIMBAD does not supply the required combined V row. The 1000-2000 light-year shell contains Alnilam, Aludra, Deneb, Naos, Regor, Sadr and Wezen; Arneb is the sole qualifying 2000-3000 light-year row. System-level names remain system-level where SIMBAD identifies an unresolved or spectroscopic system. Excluding Sun, current physical coverage is 121 temperatures, 55 masses, 110 luminosities, 111 radii, 76 metallicities and 11 ages. Reviewed individual component rows replace formerly blended primaries; the original source identity and selection remain in provenance. No age is adopted without a source that resolves the represented component or system and publishes a compatible estimate.

**Compact remnants** is a separate opt-in overlay, not a fifth stellar catalog. Its frozen ATNF v2.9.0 subset contains 420 non-candidate, non-interim pulsars: every pulsar within 0.9198041814 kpc (3000 ly), plus those out to 3.0660139380 kpc (10,000 ly) whose distance is independent of the dispersion-measure model. Model distances beyond 3000 ly are too uncertain to place an object, which leaves out 948 further ATNF pulsars. ATNF adopted distance can come from an independent estimate, significant parallax or a dispersion-measure model, and the per-row method/reference is retained. Companion-mass limits are deliberately not represented as pulsar masses.

`catalog-work/compact-remnants/pulsar-binaries.json` holds three reviewed lists. `adoptedDistances` replaces an ATNF distance only where newer work supersedes it, or supplies one ATNF lacks; the ATNF value stays in the record's notes. PSR J2322-2650 uses 0.80 kpc from Shamohammadi et al. 2024, not the 2.0 kpc ATNF adopts or the 230 pc of Spiewak et al. 2018. J1022+1001 keeps ATNF's 0.725 kpc because that value rests on a VLBI parallax more precise than the newer timing parallax. `pulsarMasses` and `neutronStarCompanions` hold individually measured masses. `modelledMasses`, like a curated row's `mass_model`, holds published model values: they stay out of `mass_solar` and appear greyed as “Mass (model)” with a tooltip saying they are not measured.

Their visible stars live in the Notable distant stars catalog as component B of each system (`catalog-work/notable-distant-stars/binary-companions.json`), with empty values where no individual measurement was verified. That covers the curated X-ray and gamma-ray binaries, Gaia BH2, V404 Cygni's outer star as component C, and pulsars whose companion has an ATNF optical counterpart or main-sequence class, except PSR J2322-2650, whose companion is planet-mass with only a tentative optical match. J0348+0432's and the Black Widow's companions are included from their papers. The curated portion in `curated.json` contains 11 black holes and 10 neutron stars. Each records compact-object mass, uncertainty, orbital period, visible companion, detection method and primary-paper links, and states its system class in `subtypes` because SIMBAD's types often describe the visible companion. Gaia NS1 is not promoted to confirmed: its source paper favors a neutron star but does not fully exclude a close double-white-dwarf alternative. Published mass ranges and asymmetric intervals are stored as a midpoint or the larger side, as each row's notes state.

Reviewed and left out on 2026-11-05: GRS 1716-249, revised to 6.9 kpc; GRS 1124-683, whose listed 1.7 ± 1.4 kpc is too uncertain to place it; 2A 1822-371, about 7 kpc from its Gaia parallax; Calvera, for which no distance was verified; the candidates Gaia18ajz, Gaia18cbf and MACHO-96-BLG-5; and RBS 1223 and RBS 1774, nearby members of the Magnificent Seven with no defensible single distance. RX J1605.3+3249 is a neutron star here, not a pulsar, because its spin is unconfirmed and ATNF's 6.88 s candidate did not hold up. The live BlackCAT page was unreachable, so its catalogue paper and newer primary literature were reviewed instead. This is a reproducible source-defined catalog, not a claim that every compact remnant physically present inside 10,000 ly has been discovered.

**Nebulae** is a second opt-in overlay: a census of the catalogued nebulae within about 2000 ly, added in reviewed batches on top of the hand-curated 500-ly census and the Orion Nebula showcase. The 500-ly census rules follow; the 2000-ly batches are described after them. A nebula is included when it is a reflection nebula, H II region or planetary nebula listed in NGC/IC, van den Bergh (1966), Sharpless (1959) or HASH, spans at least 5 arcmin, and its adopted distance minus its 1σ error is at most 153.3 pc (500 ly). Distances use the SIMBAD-adopted parallax of the illuminating or central star (Gaia EDR3, else Hipparcos 2007); nebulae lit by several stars use their inverse-variance mean parallax. Apparent sizes come from the Lynds Bright Nebula catalog for named NGC/IC nebulae, the Sharpless diameter for H II regions, the HASH radius (via Chornay & Walton 2021) for Sh 2-216, and twice van den Bergh's maximum radius for vdB-only nebulae. Rendering brightness follows the LBN, vdB or Sharpless surface-brightness class. The census was assembled from all 158 vdB illuminating stars, the southern entries of Magakian's (2003) merged reflection catalog, SIMBAD planetary nebulae and H II regions with qualifying parallaxes, and the nearby Sharpless regions. Van den Bergh type II nebulae (star outside the nebulosity) adopt the star's distance as an approximation; Antares (IC 4606) qualifies only through its large Hipparcos error, so its center lies at about 554 ly. Abell 35 is typed as an H II region because Frew & Parker (2010) identify it as a planetary-nebula mimic. Excluded near misses of the 500-ly census: the Corona Australis nebulae NGC 6726/6727 and IC 4812 (illuminating stars at about 155 pc), the possible planetary nebula FP J1912-0331 (not confirmed in HASH), the Helix Nebula (200 pc, now in the 2000-ly batches), sub-5-arcmin young-star nebulae, dark nebulae and molecular clouds, and H-alpha-only ionized regions such as Spica's. The Orion Nebula (M42, H II region) uses the SIMBAD M42 center, the 388 ± 5 pc VLBA distance of Kounkel et al. (2017), the 65 × 60 arcmin revised-NGC apparent size and the blister geometry of O'Dell (2001): emission mainly from the back surface of a cavity open toward us, ionized by theta1 Orionis C. The Pleiades reflection nebulosity uses the Gaia DR3 cluster center, the 135.74 ± 0.10 pc distance of Alfonso & García-Varela (2023), an approximate 90 × 70 arcmin visual extent and the two dust layers along the line of sight described by Gibson & Nordsieck (2003); the dust is an unrelated cloud the cluster is passing through. Sky extents follow the apparent sizes at the adopted distances; depths, sheet offsets, thicknesses, orientations and palettes are illustrative and documented in each row's `model_note`. The hand-authored rows have no frozen survey input or Python recipe; validation recomputes each Cartesian position from RA, Dec and distance with the shared ICRS-to-Galactic rotation. The 2000-ly batches extend the same rules to an adopted distance minus its error of at most 613.2 pc. Their reviewed inputs live in `catalog-work/nebulae/additions.json` and `scripts/author-nebulae.py` (checked by `npm run catalog:check-authored`) appends them to the overlay without touching the hand-authored rows. Where a star's own parallax is unreliable or the ionizing star is embedded, Gaia DR2 cluster parallaxes (Cantat-Gaudin & Anders 2020; Cantat-Gaudin et al. 2020) or VLBA parallaxes of cluster members (Dzib et al. 2026) are used instead, and planetary-nebula sizes are the SIMBAD-adopted angular diameters. H II regions larger than about 1 degree take their sky shape and relative brightness from a frozen 8-bit mask of the Finkbeiner (2003) H-alpha composite (`catalog-work/nebulae/halpha-masks.json`, rebuilt from the LAMBDA HEALPix map with `--masks`). The mask is a gnomonic grid spanning 1.25 catalogued diameters with the median diffuse background between 1 and 1.5 field radii subtracted and an asinh stretch. The viewer places one puff per lit pixel, weighted by its brightness, and derives the nebula's overall brightness from the peak H-alpha excess. South of the Lynds limit, sizes come from the van den Bergh & Herbst (1975) blue-plate diameters or the ESO/Uppsala Survey (Lauberts 1982), which also brought in the Corona Australis nebulae. Lynds nebulae with a Cederblad or Dorschner & Gürtler identification also qualify, and planetary nebulae without a usable SIMBAD diameter use HASH radii via Chornay & Walton (2021). W40 adopts the 502 ± 4 pc mean Gaia EDR3 parallax of its members (Comerón et al. 2022) rather than the 436 ± 9 pc VLBA value (Ortiz-León et al. 2017), and Sh 2-174 is typed as an H II region for the same reason as Abell 35. Deferred so far: Barnard's Loop, whose published distances (about 170 pc against about 440 pc) disagree. Batch status, open candidates and the step-by-step batch procedure are kept in `docs/nebula-census.md`.

**Molecular clouds** are a separate opt-in overlay built from [Cahlon et al. (2024)](https://doi.org/10.3847/1538-4357/ad0cf8) and its [Harvard Dataverse tables](https://doi.org/10.7910/DVN/BFYDG8). All 65 filtered 3D features in Table 1 are retained; their centers span 116–440 pc (about 378–1435 ly), so every catalog row is within 2000 ly. This is the complete published feature table, not a complete volume-limited cloud census: the underlying Leike et al. (2020) map is effectively limited to about 400 pc, and the paper excludes the incomplete outer 440–613 pc shell from its population analysis. Source mass, equivalent radius, mean and peak hydrogen density, surface area, segmented volume, centers and all 78,326 one-parsec voxel coordinates are retained. Runtime geometry uses a deterministic quarter-sample of 19,606 source voxels, chosen by stable coordinate hash separately within each cloud. Larger, noise-shaped body and rim puffs visually join those sparse samples; those colors, opacity and puff radii are illustrative. The checked-in source manifest pins the two FITS files by Dataverse file ID, byte size and SHA-256, and the native authoring script reproduces the overlay without external packages.

**Interstellar bubbles** are a third opt-in overlay. This release includes only the Local Bubble, using the mean shell distance, radial range, coordinate spans, typical thickness and geometric center reported by [O'Neill et al. (2024)](https://doi.org/10.3847/1538-4357/ad61de). Its geometry is frozen from the authors' published [interactive Figure 3](https://theo-oneill.github.io/localbubble/plots/distance_interactive.html) at source commit `52aa44614f3036b90fab8fd1beed996d285a7995`. The 786,392-sightline peak-extinction point cloud is reduced to a 128 by 64 Galactic longitude-latitude radius grid using the 95th-percentile published radius in each angular cell. This retains the compact main cavity, narrow Local Chimney, tunnels and nearly the full published coordinate envelope without letting a single parsec-scale source pixel create a long mesh spike. Duplicated pole vertices use the mean of their source samples so the runtime mesh remains watertight. The frozen grid is a faithful low-resolution derivative, not the original parsec-resolution reconstruction.

Bright-star temperatures and metallicities come from frozen `mesFe_h` ranked bibliographic measurements. Linear diameter measurements from `mesDiameter` become radii using the IAU nominal solar-radius scale. The reviewed physical-property subsets refreshed on 2026-10-01 contain 54 exact-Hipparcos rows from the 17,219-star evolutionary-model catalog of Allende Prieto & Lambert (1999), 77 rows from the 107,619-star McDonald et al. (2012) SED catalog, and ten unambiguous Hohle et al. (2010) massive-star rows. Eligible single-star masses, radii and temperatures use the former; its masses are withheld for unresolved systems and for stars whose adopted metallicity falls outside ±0.3 dex. The latter supplies fallback temperatures and luminosities, with Stefan–Boltzmann radii derived when no stronger radius exists. Reviewed source rows add interferometric and spectroscopic parameters for Menkar, high-quality exact-Hipparcos 2017 SED parameters for Beta Gruis and Gacrux, Antares A's mass and age-range midpoint, and Shaula A's component mass. Fields without a reviewed frozen source remain blank; Mizar A remains unfilled because the available system/component matches are ambiguous. The row notes and provenance retain the contributing bibcodes.

The policy-aware rank-1000 object is **WISE J105553.59-165216.3** (`cns5-2673`) at **13.947001394700 pc**; the next eligible object is `cns5-0851` at **13.948647963283 pc**. Their linearized parallax-only one-sigma intervals overlap, so nominal ranking is retained without claiming statistically secure membership. The original audited 1100-row buffer excluded 47 aggregate SIMBAD `**` records and nine tentative `BD?` records before selecting 1000 individuals. Nine individually reviewed component exceptions now admit source rows carrying broad `**` classifications; 38 unreviewed aggregate rows and nine tentative `BD?` rows remain excluded.

On 2026-10-20, **Gaia DR3 6305165514134625024 / CNS5 3707** (`cns5-3707`) was excluded from confirmed nearby membership. [Reyle et al. (2023)](https://arxiv.org/abs/2302.02810) identified a likely red background object blended with a blue source. [Kirkpatrick et al. (2024), Tables 3 and A2](https://arxiv.org/pdf/2312.03639), list it as a background object following Palomar/DBSP spectroscopy on 2022-05-24. Its Gaia/CNS5 parallax must not imply a reliable nearby distance or inferred stellar properties. The exact-identity [membership review](../catalog-work/nearest-1000/reviewed-membership-exclusions.json) retains the previous catalog row, full provenance, original CNS5 line (including photometry), Gaia and SIMBAD records, and the nearest-100 candidate record as historical observations. Nearest-100 already excludes this candidate. Nearest-1000 refills its place with the next ranked eligible object, WISE J105553.59-165216.3, keeping 1036 non-Sun objects plus Sun. All surviving catalog rows and effective component records are unchanged.

After the 2026-10-06 [companion property review](companion-property-enrichment.md), nearest-1000 non-Sun coverage is: 1036 constellations and source astrometric snapshots (including explicitly shared component approximations), 976 spectra, 552 absolute Johnson V magnitudes, 872 temperatures, 601 masses, 610 bolometric luminosities, 631 radii, 611 metallicities, 90 ages and 684 raw radial velocities. These counts include reviewed shared physical enrichment and explicitly labeled estimates; they are not counts of independent measurements. Radial-velocity precedence is existing nearest-100 curated data, then a reviewed literature override, CNS5, and finally an exact-identifier Gaia DR3 fallback; existing curated values retain precedence. Individual-component reviews can explicitly withhold a former blended or orbit-contaminated velocity, with the source alternative retained in provenance. After splitting, a component-specific property supplement may restore reviewed physical observations and explicitly shared systemic RVs for approximate bulk motion; individual orbital velocities remain unmodeled. The literature override supplies Tabit's missing motion from Maldonado et al. (2010). Gaia fallback uncertainties and source quality flags remain in provenance for review, and new white-dwarf spectroscopic velocities remain withheld because gravitational redshift may contaminate space motion. Gaia physical parameters are model-derived, while Gaia radial velocities are spectroscopic measurements. GSP-Phot temperature and `[M/H]` metallicity plus FLAME percentile bounds are retained in provenance. FLAME mass and age are adopted only when the first `flags_flame` digit is `0` and Gaia's own GSP-Phot `[M/H]` lies within 0.3 dex of solar, because they assume solar-metallicity tracks ([literature-conflict review](literature-conflict-review.md)); luminosity and radius may remain valid when mass/age is unavailable (`A=2`), and use the accepted distance/parallax flag policy. Brown dwarfs and white dwarfs do not receive generic Gaia stellar-model properties.

Display names prefer a frozen SIMBAD `NAME` alias when one exists, so machine identifiers such as `* alf Boo` become `Arcturus`. Remaining SIMBAD object-class prefixes are removed, repeated whitespace is collapsed, and Bayer abbreviations are expanded (`* bet Hyi` becomes `Beta Hyi`). Stable Star View IDs do not change, and the original SIMBAD `main_id` remains in provenance.

On 2026-10-05, Fomalhaut C (LP 876-10, CNS5 5623, Gaia DR3
6623351805412369024) was admitted as a reviewed individual-component exception
to the SIMBAD `**` exclusion. [Mamajek et al. 2013](https://arxiv.org/abs/1310.0764)
supports its wide-system membership and does not confirm the reported close
companion. The review is frozen in
`catalog-work/nearest-1000/individual-object-overrides.json`, hashed in generated
provenance, and applied by the authoring recipe. C keeps its own exact astrometry,
Gaia radial velocity, Mann mass/radius supplements, and individually matched
physical enrichment. No hypothetical Ca/Cb records are created. Reviewed
companions are additive: the 1000-object baseline is retained, so the package
now contains 1036 non-Sun objects plus Sun after the broader
[25 pc companion review](companion-expansion-25pc.md). Baseline cutoffs and overall
ranks are recorded separately; selection flags use actual selected IDs. Reviewed
close companions have their own records, with component measurements adopted
only when individually sourced. Shared source positions/proper motions are
explicitly approximate, and individual radial velocities and blended physical
estimates are withheld. The review inputs and their hashes are retained in
provenance; the smaller catalogs keep their frozen membership snapshots.

The Nearest 100 objects package contains exactly **100 individual non-Sun objects plus Sun**, ranked by adopted nominal J2000 distance. It is a frozen source-based catalog, not a complete or continuously current 2026 census. Stars, white dwarfs, brown dwarfs and sub-brown dwarfs are eligible; planet rows, aggregate system rows and tentative source `ObjType` endings `?` are excluded. The only explicitly approved exceptions are the vetted default members **EZ Aquarii B/C (Seq 27/28)**, whose raw `LM?` classifications remain recorded unchanged. Preserving these two existing rows is not a new classification measurement.

The release contains 78 stars, 6 white dwarfs, 15 brown dwarfs and 1 sub-brown dwarf, excluding Sun. Including Sun, all 101 rows have spectral types, 97 have temperatures, 50 have absolute Johnson V magnitudes, 66 have masses, 68 have bolometric luminosities, 67 have radii and 70 have complete velocity triplets. These counts include preserved neighbor data, [M-dwarf supplements](#m-dwarf-physical-supplements) and explicitly estimated class temperatures, not just individually measured values. All 100 non-Sun rows have a constellation; Sun deliberately does not.

The default catalog retains its 22 objects, IDs, positions, and curated physical properties. It now includes raw astrometry and constellations; unreviewed legacy radial velocities are withheld rather than silently promoted into full motion. All 22 rows are retained as curated overrides in both larger packages, including the corrected Sirius systemic velocity and the Akeson et al. (2021) Alpha Centauri AB barycentric motion shared by A and B. Their original source notes remain authoritative; source-table alternatives are recorded for audit, not silently substituted.

## Files and Sources

- Runtime packages: [nearest-100](../src/data/catalogs/nearest-100/), and [nearest-1000](../src/data/catalogs/nearest-1000/).
- Per-object field statuses, raw classifications/measurement references/errors, epoch assumptions, complete 160-candidate buffer audit, 155 eligible ranks, five explicit exclusions, two approved default exceptions and CNS5 crossmatches: [provenance.json](../src/data/catalogs/nearest-100/provenance.json). This is authoring metadata, not browser geometry input.
- Frozen adopted source subset, default-row overrides and extracted temperature calibration: [source-input.json](../catalog-work/nearest-100/source-input.json), checked by [source-input.sha256](../catalog-work/nearest-100/source-input.sha256).
- Executable authoring recipe: [author-nearest100.py](../scripts/author-nearest100.py); environment: the project's [requirements.txt](../requirements.txt).
- Nearest-1000 frozen CNS5/SIMBAD/Gaia inputs, ADQL, manifest, and checksums: [catalog-work/nearest-1000](../catalog-work/nearest-1000/); executable recipe: [author-nearest1000.py](../scripts/author-nearest1000.py).
- Bright-stars frozen SIMBAD snapshot and selection query: [catalog-work/bright-stars](../catalog-work/bright-stars/); executable recipe: [author-bright-stars.py](../scripts/author-bright-stars.py).
- Compact-remnant frozen ATNF v2.9.0 records and glitches, reviewed binary masses, dormant systems, manifest and checksums: [catalog-work/compact-remnants](../catalog-work/compact-remnants/); executable recipe: [author-compact-remnants.py](../scripts/author-compact-remnants.py) (`--freeze <psrcat.db> <glitch.db>` reselects from a new ATNF package); runtime provenance: [provenance.json](../src/data/overlays/compact-remnants/provenance.json).
- Naked-eye stars (SIMBAD V <= 6.5 within 20,000 ly): frozen SIMBAD, hierarchy-parent, Gaia DR3, Bailer-Jones and mesFe_h snapshot in [catalog-work/naked-eye-stars](../catalog-work/naked-eye-stars/), refreshed with `python3 scripts/refresh-catalog-sources.py naked-eye-stars --simbad-url <mirror>`; exact-HIP Allende Prieto & Lambert (1999) and McDonald et al. (2012) rows are added with `python3 scripts/refresh-catalog-sources.py hipparcos-models --output catalog-work/naked-eye-stars --retrieved <date> --vizier-url <mirror>`, which reads the complete VizieR tables over ASU (served by official mirrors such as vizier.idia.ac.za while TAPVizieR is unavailable) and keeps rows whose HIP equals a unique SIMBAD HIP alias; executable recipe: [author-naked-eye-stars.py](../scripts/author-naked-eye-stars.py).
- Notable distant stars (measured pulsar companions): [catalog-work/notable-distant-stars](../catalog-work/notable-distant-stars/); executable recipe: [author-notable-distant-stars.py](../scripts/author-notable-distant-stars.py).
- Pulsar planets: separately frozen [pulsar-planets.csv](../catalog-work/nearby-planets/pulsar-planets.csv) NASA Exoplanet Archive query; refresh only it with `python3 scripts/author-nearby-planets.py --refresh --pulsars --retrieved <date>`.
- Hand-curated nebula overlay: [manifest.json](../src/data/overlays/nebulae/manifest.json) and [objects.json](../src/data/overlays/nebulae/objects.json); per-row sources and model notes are inline.
- Cahlon molecular-cloud overlay: frozen [source manifest](../catalog-work/molecular-clouds/source-manifest.json), generated [manifest](../src/data/overlays/molecular-clouds/manifest.json) and [objects](../src/data/overlays/molecular-clouds/objects.json); reproduce from the two pinned FITS downloads with `node scripts/author-molecular-clouds.mjs check <Table1.fits> <positions.fits>`.
- Interstellar-bubble overlay: [manifest.json](../src/data/overlays/bubbles/manifest.json), [objects.json](../src/data/overlays/bubbles/objects.json) and the frozen [directional surface grid](../src/data/overlays/bubbles/local-bubble-surface.json). Reproduce the grid from the authors' `distance_interactive.html` with `node scripts/author-local-bubble-surface.mjs <path> --check`.
- M-dwarf supplement inputs (Cifuentes et al. 2020 table, exact-identifier crossmatch, 2MASS PSC export and query, checksums): [catalog-work/physical-supplements](../catalog-work/physical-supplements/); shared logic: [mdwarf.py](../scripts/catalog_sources/mdwarf.py).

| Source | Frozen Version | Use |
| --- | --- | --- |
| [Reyle et al., 10pc census](https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/ReadMe), 2021A&A...650A.201R | tablea1, 25-Aug-2023; 562 actual records | Primary individual membership, astrometry, spectral types, compiled V |
| [Golovin et al., CNS5](https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe), 2023A&A...670A..19G | Corrected 13-Dec-2023; 5,909 actual records | Independent membership, identity and parallax audit |
| [Pecaut & Mamajek](https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt), 2013ApJS..208....9P | Online dwarf sequence 2022.04.16 | Mean class temperature estimates only |
| [NASA Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) | 9-May-2024 | Solar absolute visual magnitude +4.83, not bolometric magnitude |
| [SIMBAD](https://simbad.cds.unistra.fr/simbad/) and [Bright Star Catalogue V/50](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50) | TAP baseline 25-Sep-2026 and V=2.42-2.69 expansion 30-Sep-2026; BSC5 combined V for Acrux | Bright-star identities, astrometry, spectra, Johnson V and radial velocities |
| [Allende Prieto & Lambert](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/352/555), [McDonald et al.](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/427/343), and [Hohle et al.](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AN/331/349) | Exact-Hipparcos subsets frozen 1-Oct-2026; 54, 77 and 10 rows | Bright-star model masses, temperatures and radii; SED luminosities; massive-star model masses |
| [McDonald et al. (2017)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/471/770) and [Wittkowski et al. (2006)](https://doi.org/10.1051/0004-6361:20066032) | Reviewed exact-Hipparcos rows and Menkar interferometry frozen 1-Oct-2026 | Temperature, luminosity and radius for Beta Gruis/Gacrux; temperature, mass, luminosity and radius for Menkar |
| [Astropy get_constellation](https://docs.astropy.org/en/stable/api/astropy.coordinates.get_constellation.html) | Astropy 8.0.2; Roman 1987 [VI/42](https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/42) | Offline IAU boundary assignment |
| [Cifuentes et al.](https://cdsarc.cds.unistra.fr/ftp/J/A+A/642/A115/ReadMe), 2020A&A...642A.115C | CDS 20-Jul-2020, 2479 records; frozen 2026-09-29 | M-dwarf SED luminosity, temperature, radius and mass |
| [Mann et al. 2019](https://ui.adsabs.harvard.edu/abs/2019ApJ...871...63M/abstract) and [2015](https://ui.adsabs.harvard.edu/abs/2015ApJ...804...64M/abstract) | 2019 Table 6 (n=5, no [Fe/H]); 2015 Table 1 Eq. 4 | Masses and radii from absolute 2MASS Ks |
| [2MASS PSC](https://cdsarc.cds.unistra.fr/viz-bin/cat/II/246), 2006AJ....131.1163S | VizieR TAP II/246/out, 937 exact designations; frozen 2026-09-29 | Ks photometry and quality flags for Mann relations |

The nearest-1000 CNS5/SIMBAD/Gaia snapshot was refreshed on 2026-09-25; the nearest-100 frozen inputs were acquired on 2026-09-15. SHA-256 hashes of the original ReadMe files, decompressed CDS tables and complete temperature reference are retained inside the frozen inputs. Counts are verified against downloaded records, not the older paper abstracts. The original full survey downloads are temporary authoring inputs and are **not** checked into the browser source tree. Cite the source catalogs, individual bibliography in their records, CDS/VizieR and the temperature-table author when reusing these data; review their current redistribution terms for republication. No new upstream license is asserted here.

## Membership and Cutoff Audit

The complete 562-row 10pc table was scanned: 85 Planet rows were excluded, leaving 477 non-planet source-listed entries, not all release-eligible. All 160 non-planet records with source parallax at least 150 mas were frozen, extending to 6.6667 pc before epoch normalization. No magnitude, temperature or RV requirement was used to choose membership. Every candidate has the required position, parallax, epoch and both proper-motion components.

Policy revision `confirmed-membership-v2` keeps those same raw source snapshots and all candidate records. Seven buffer records have tentative types: Seq 27, 28, 146, 161, 198, 199 (`LM?`) and 1001 (`BD?`). Exclude **146 (GJ 570 C), 161 (GJ 661 B), 198 (GJ 644 Ba), 199 (GJ 644 Bb), and 1001 (Gaia EDR3 6305165514134625024)**. Preserve only Seq 27/28 under the explicitly approved default-membership exception, including their existing type, measurements, unknowns and source notes. This yields 155 eligible candidates. No raw `ObjType` is rewritten or stripped of `?`. The frozen input records exclusion/exception lists; provenance records raw types, reasons and per-object overrides. CNS5 crossmatching accounts for an object but does not by itself confirm its classification.

All 141 CNS5 rows with parallax at least 150 mas were audited. Exact Gaia-ID matching covers 112; the other 29 have explicit reviewed direction/identity matches, including one-to-many mappings for unresolved systems. No CNS5 aggregate row is added as another star. Raw epoch separations are retained as a crossmatch check, not mistaken for common-epoch precision astrometry. No matching CNS5 object inside this buffer remains unaccounted for. Curated 10pc astrometry remains primary: for example, GJ 1005 A/B uses 166.6 +/-0.3 mas from Benedict et al. (2016AJ....152..141B), rather than CNS5's less accurate Hipparcos 200.53 mas. This matters because the latter would move it inside the cutoff.

Eligible non-Sun objects are sorted by **unrounded adopted J2000 distance, then ASCII stable ID for exact distance ties**. Exactly 100 are retained, then Sun is added. Existing object IDs take precedence; other IDs use the frozen 10pc object sequence, not its system number. Gaia IDs are strings throughout. Existing Cartesian vectors stay at their original precision; their adopted distances are the unrounded vector norms. New rank keys and constellation assignments use full-precision normalized directions, independently of the nine-decimal Cartesian export. In provenance, `bufferRank` covers all 160 candidates; `rank` covers only the 155 eligible objects and is null for excluded rows. Exclusions always have `selected: false`, regardless of distance or uncertainty.

Nominal rank 100 is **GJ 229 A**, ID `10pc-0138`, Seq 138/system 75, at **5.7611540773387215 pc**, in **Lepus**. Its source classification is confirmed `LM`, with M1 spectrum (2002AJ....123.2002H). The adopted 10pc Gaia EDR3 solution (2020yCat.1350....0G) has J2016.0 RA 92.643579082 deg, Dec -21.867823113 deg, parallax 173.574 +/-0.017 mas, and proper motion -135.691607948/-719.178133955 mas/yr (RA includes cos Dec); RV is 4.734 km/s (2018A&A...616A...7S). Full space motion is propagated to J2000. CNS5 1528/GJ 229 A matches Gaia ID `2940856402123426176` exactly and records parallax 173.59297083190438 +/-0.019386925 mas with the same J2016 position/proper motion to source precision. The curated 10pc solution remains primary. Its 3660 K temperature is a class estimate; component V, mass and luminosity remain unadopted.

Rank 101 is **Alsafi**, 5.763454098527352 pc; rank 102 is **GJ 229 B**, 5.774005427565103 pc. There is no exact cutoff tie or split cutoff-tied system, although A is selected and B is outside the nominal cutoff under their separately adopted parallaxes. GJ 229 A has linearized parallax-only distance sigma 0.000564260407 pc; Alsafi's 0.002485038826 pc and GJ 229 B's 0.037339835319 pc intervals both overlap it. CNS5 1529 records an alternate GJ 229 B parallax of 173.6999969482422 +/-0.05 mas (2018A&A...616A...1G), which could move B inside the cutoff; the curated dedicated 10pc value 173.19 +/-1.12 mas (2012ApJ...752...56F) is retained. This is an explicit solution-choice and cutoff uncertainty, not statistically secure membership or a posterior rank probability.

The removed Gaia candidate remains at buffer position 100, 5.746290912879668 pc, with raw `BD?`, CNS5 3707/GJ 12151 crossmatch, and parallax 174.0253 +/-1.9006 mas (linearized distance sigma 0.062757544501 pc). Its uncertainty cannot restore eligibility. Nominal-cutoff and one-sigma-interval overlap flags are retained for all 160 buffer records as diagnostics only. No confirmed spectrum, V, temperature or velocity is invented for it.

Possible companions mentioned only in source comments are not invented as extra rows. In particular, the frozen 2023 interpretation of 2MASS J09393548-2448279 is one catalog entry with a possible unresolved companion. Later discoveries or resolved multiplicity require a new audited source release. GJ 229 B and its potential multiplicity are outside this nominal cutoff. Neither this catalog nor the finite buffer establishes undiscovered-object completeness, nor does the buffer cover every remote low-significance distance tail.

## Astrometry and Unknown Values

Enriched runtime rows retain source ICRS right ascension, declination, source epoch, parallax, `mu_alpha cos(delta)`, declination proper motion, uncertainties, compact references, and nullable radial velocity. These measurements are distinct from the adopted Cartesian J2000 snapshot. A full Cartesian triplet remains authoritative when already curated. Otherwise raw astrometry with RV can produce full motion; raw proper motion without RV produces only a Sun-relative transverse vector. Missing RV is never stored or computed as zero.

Luhman 16 A/B use resolved Johnson V snapshots of `23.25 +/- 0.10` and `24.07 +/- 0.10` from [Boffin et al. (2014), Table 2](https://arxiv.org/pdf/1312.1303), observed on 2013-06-16. Absolute V is derived with the retained catalog distance, giving approximately `26.75` and `27.57`. The frozen primary overrides also retain the [Ishikawa et al. (2025), Table 2](https://arxiv.org/html/2503.19322v1#S4.T2) component RVs, `16.7 +/- 0.3` and `20.4 +/- 0.4 km/s`, from 2018-04-21 through 2018-06-29. Those uncertainties are weighted scatter across spectral orders, not formal standard errors. The shared component pool exposes these as independent `radial_velocity_observation` records with their dates and scope; the inspector displays them without treating them as systemic velocities or combining them with different-epoch proper motions into a constant bulk vector. Original astrometry, physical properties, and nullable Cartesian velocities remain preserved across the default, nearest-100 and nearest-1000 catalogs.

Targeted landmark overrides are stored in `catalog-work/landmark-stars/radial-velocity-overrides.csv` instead of altering the frozen SIMBAD exports. Tabit adopts `24.11 +/- 0.08 km/s` from Maldonado et al. (2010). Tau Scorpii adopts `3.15 +/- 0.70 km/s`, the mean of Cazorla et al.'s two same-epoch HEROS measurements while retaining their individual uncertainty, in place of the frozen `-650.47 km/s` survey outlier. Theta Carinae is an SB1, so it adopts Hubrig et al.'s orbital systemic velocity `20.18 +/- 0.04 km/s` rather than the frozen `+459.7 km/s` survey value. The rejected values, adopted measurements, references, and rationale remain together in provenance.

Solid arrows show complete motion after the existing approximate Galactic-rest display offset, including a solar-motion arrow for the Sun. Dashed shafts show incomplete Sun-relative transverse motion and receive no solar offset. The arrowhead remains solid so its projected direction is legible. The inspector states `Full space motion` or `Transverse only; radial velocity unavailable` in addition to the line style.

Positions are Galactic Cartesian **Sun-relative** parsecs: x toward Galactic center, y toward longitude 90 degrees, z toward the north Galactic pole. They are not Three.js world coordinates and have no solar Galactic-center position offset. The axes are the standard Astropy ICRS/Galactic frame transformation. Small Solar-System barycentric/heliocentric offsets are neglected at this map's precision.

The source coordinate frame is ICRS, while its separate Epoch column is the position epoch. The helper uses Astropy `SkyCoord.apply_space_motion` to normalize to J2000.0 and then transforms to Galactic coordinates. Source decimal years are treated consistently as Julian years TT; their published precision (including 0.1-year epoch rounding) is not improved by the transformation. Full propagation uses available proper motion and an adopted RV. If RV is missing or withheld, propagation is transverse-only using Astropy's implicit zero-RV approximation. This is an assumption for the position calculation, **not a measured zero velocity**. All output velocity fields remain blank in that case.

New white-dwarf spectroscopic RVs are withheld because gravitational redshift may contaminate them. Sirius A/B preserve the true systemic RV correction from Bond et al. (2017), not Sirius B's gravitationally redshifted spectrum. Alpha Centauri A/B share the Akeson et al. (2021) barycenter proper motion and systemic RV, rather than their orbit-contaminated component motions. Other complete motions follow the source proper motion and spectroscopic RV; no binary orbit solution or solar Galactic velocity offset is added. The map is static, not an orbit integrator. Individual binary components can share rounded system positions: no fabricated AU separation is introduced, and distinct coincident objects cannot yield meaningful observer-relative companion brightness.

Only the source **Vmag** column is considered for new absolute Johnson V. For new members in a system with multiple non-planet census entries, even an apparently plausible V is conservatively withheld unless separately vetted; combined flux is never assigned to each component. System member counts use the full census, not just the selected 100. For accepted single-source V, `M_V = V - 5 log10(distance_pc / 10)`, with negligible local extinction assumed. The compilation does not give individual V uncertainties, photometric epochs or passband measurement bibliography: these remain explicitly unavailable. Variability and observer-to-target extinction are not modeled. Gaia G, estimated GCode 10/20 values, infrared magnitudes and class mean Mv are never substituted for V.

Suitable dwarf spectral classes get **estimated**, not measured, temperatures from Pecaut-Mamajek. Intermediate subtypes interpolate between bracketing entries of the same family; no extrapolation is made. Unknown/limited/peculiar/subdwarf types, new white dwarfs and the subgiant Procyon A receive no generic dwarf temperature. Mean-sequence masses and luminosities are never substituted; blank masses, luminosities and radii may be filled only by the [M-dwarf supplements](#m-dwarf-physical-supplements). The pre-existing measured/adopted/estimated neighbor fields remain unchanged. Empty cells always mean unknown/not adopted, never zero; zero and negative magnitudes are valid measurements.

## M-Dwarf Physical Supplements

Two frozen sources fill physical properties of K5–M9.5 dwarfs across the default, nearest-100 and nearest-1000 catalogs:

- **Cifuentes et al. (2020)**: VOSA SED-integrated bolometric luminosity (`measured`), BT-Settl effective temperature (`model-derived`, ±50 K or ±25 K at or below 2400 K), Stefan–Boltzmann radius (`derived`) and Schweitzer et al. (2019) radius–mass relation mass (`empirical-relation`).
- **Mann et al. (2019)** mass, $\log_{10} M = \sum_{i=0}^{5} a_i (M_{K_S} - 7.5)^i$ (Table 6, n=5, no [Fe/H], 2.0% scatter, valid $4 \le M_{K_S} \le 11$), and **Mann et al. (2015)** radius, $R = 1.9515 - 0.3520\,M_{K_S} + 0.01680\,M_{K_S}^2$ (Table 1, 2.89% scatter, valid $4.6 \le M_{K_S} \le 9.8$ and K7–M7). Both are `empirical-relation` values from 2MASS Ks and the row's adopted distance: $M_{K_S} = K_S - 5 \log_{10}(d/10)$. Uncertainties combine the published scatter with Ks and parallax errors.

**Identity** uses exact identifiers only. The frozen `crossmatch.csv` maps each Star View ID to the 2MASS, CARMENES Karmn and Gaia DR2 aliases in its exact SIMBAD CNS5 record; nearest-100 components that share a CNS5 system record, or have none, use only their 10pc Gaia DR2 identifier. Cifuentes rows match by Karmn or Gaia DR2 primary identifier. An identifier or catalog row claimed by several objects, or a SIMBAD record listing several 2MASS designations, adopts nothing. No positional matching is used.

**Eligibility** requires type `star` or `brown_dwarf` and a parsed K5–M9.5 dwarf spectral type: subdwarfs, giants/subgiants, composite, peculiar-abundance and unparsed types are excluded, as are white dwarfs and L/T/Y objects. `LM*` rows typed as brown dwarfs are eligible on their M spectral type; their type is unchanged. Cifuentes values are withheld for close multiples (`Multiple`), Gaia DR2 RUWE>1.41 (`RUWE`) or when the Cifuentes distance differs from the adopted distance by more than 5%; `Young` withholds only the mass. Mann relations are withheld when the 2MASS Ks quality is not A/B, the blend flag is not 1 or the contamination flag is not 0; when another CNS5 object lies within 5 arcsec after linear propagation to J2016.0; or when Cifuentes flags the star as multiple, RUWE or young. Metallicity is not used as a gate because nearest-1000 metallicities are GSP-Phot estimates.

**Precedence** per field is: existing curated value (never overwritten, including class-estimated temperatures) > mass: Mann 2019 > Cifuentes > Gaia FLAME; radius: Cifuentes > Mann 2015 > Gaia FLAME; temperature and luminosity: Cifuentes > Gaia DR3. In nearest-1000 non-override rows, supplements therefore replace Gaia DR3 values; the replaced Gaia observation stays in `physicalObservations`. Each supplemented row appends a source sentence to its notes, and provenance records the identity, per-source audit, withholding reasons and adopted source per field under `physicalSupplements`.

On the overlap, Mann masses run a median 7% below Cifuentes masses (248 stars), Cifuentes and Mann radii agree to 1.5% (236), and Cifuentes radii are a median 10% below Gaia FLAME radii (141). Ages and metallicities are not supplemented.

## Constellations

Constellation means the object's **Earth-view IAU sky region at the adopted snapshot**, independent of brightness, the selected visibility observer, camera direction or distance units. It does not imply membership in a physical stellar group or a visible stick figure. Brown dwarfs and objects without V photometry still have sky coordinates and receive assignments.

The helper calls Astropy `get_constellation(..., short_name=False, constellation_list='iau')` on the high-precision normalized direction before Cartesian rounding. Astropy transforms the coordinates to the B1875 boundary frame and applies Roman's Delporte-boundary table. It does **not** propagate physical stellar motion to 1875. The original default positions are inverted from Galactic to ICRS instead of being overwritten.

Astropy's full-name table (checked with 8.0.2) uses the spellings `Chamaleon`, `Ophiucus` and `Pisces Austrinus`; the helper normalizes these to canonical **Chamaeleon**, **Ophiuchus** and **Piscis Austrinus**, normalizes Bootes to ASCII, and trims name-table whitespace (including trailing whitespace after Crux). All **88 normalized names** were compared with the parent parser's canonical vocabulary, with no parser changes. This does not change boundary calculations. Every shipped assignment is checked again from its exported vector and at eight offsets one arcsecond away. Known landmarks include Sirius A/B in Canis Major, Proxima in Centaurus, Barnard's Star in Ophiuchus and GJ 229 A in Lepus. A synthetic two-arcsecond pair straddling the Cepheus/Ursa Minor boundary is also frozen in provenance and tested during reproduction. The Sun has no fixed constellation in this static origin-centered model; its cell stays blank. Custom unknown non-Sun values are distinct from this Sun exception.

## Reproduce Offline

Normal application builds, tests and browsing use **Node/TypeScript and checked-in data only**. No Python, live catalog query or network request is needed to use the package. Python is optional authoring tooling. This recipe was executed with Python 3.11.9 on macOS; use Python 3.11 or newer compatible with the pinned packages. No sudo or application package changes are required.

The recipes use the project environment from `requirements.txt`. With it installed, these commands are offline and make no changes:

```sh
python3 scripts/author-nearest100.py default
python3 scripts/author-nearest100.py build --check
python3 -m unittest scripts.tests.test_catalog_sources
python3 scripts/author-nearest1000.py build --check
```

To generate the same three package files into a fresh authoring directory:

```sh
python3 scripts/author-nearest100.py build --output /tmp/star-view-rebuilt-catalog
```

The build verifies the input checksum and policy revision, all 160 candidates' required astrometry, 155 eligible/five excluded records, two approved tentative-default exceptions, duplicate IDs/names, exact equality of all 22 frozen default rows plus M-dwarf supplements with the current default catalog, all constellation assignments, the boundary fixture and exact count/cutoff. It refuses to overwrite existing output without `--force`. The `--check` mode compares all three files, including provenance, byte for byte. IERS auto-download is disabled. The default helper's `--write` mode only appends missing constellation and physical columns and fills blank physical fields from the frozen M-dwarf supplements, after asserting that all existing field values are unchanged (notes may only gain a source sentence); the source-reviewed NASA Sun edit is not a generic runtime fallback.

For this policy-only correction, the five original raw-download SHA-256 values were verified unchanged before regenerating decisions/checksum with the updated helper. All 160 raw candidate records, 141 CNS5 audit rows/matches, 22 default rows, calibration values and source metadata were then compared unchanged. With those same already-downloaded snapshots, the intentional regeneration commands are:

```sh
python3 scripts/author-nearest100.py freeze /tmp/star-view-nearest100-sources --force
python3 scripts/author-nearest100.py build --force
python3 scripts/author-nearest100.py build --check
```

This revises input decisions and therefore the input checksum, not the upstream releases or raw classifications. Do not use newly downloaded or changed snapshots as a policy-only correction.

Application-parser sanity, using the project's Node 24 setup:

```sh
node --input-type=module -e 'import {readFileSync} from "node:fs"; import {parseStarCatalog} from "./src/catalog.ts"; const stars=parseStarCatalog(readFileSync("src/data/catalogs/nearest-100/stars.csv","utf8")); if(stars.length!==101 || stars.filter(star=>star.constellation).length!==100) throw Error("Catalog coverage"); console.log("101 objects; 100 constellations");'
npm run test -- src/catalog.test.ts src/astronomy.test.ts
```

## Refresh the Sources

The reusable adapters under `scripts/catalog_sources/` normalize CNS5, Gaia DR3 TAP, SIMBAD TAP, the Cifuentes CDS fixed-width table, 2MASS VizieR TAP exports, and reviewed primary-paper overrides. Identifiers remain strings. Identity resolution prefers Star View ID, Gaia DR3 ID, SIMBAD ID, then reviewed aliases; positional candidates are emitted for review and never auto-adopted. Per-field resolution retains competing observations and distinguishes measured, model-derived, estimated, inherited, withheld, conflicting, and unknown values.

Nearest-1000 source refresh is explicit and network-backed; normal builds remain offline:

```sh
python3 scripts/refresh-catalog-sources.py nearest-1000 \
  --output /tmp/star-view-nearest1000-refresh --retrieved YYYY-MM-DD
```

The command writes corrected CNS5, exact SIMBAD/Gaia TAP exports, ordered ADQL text, source releases, retrieval date, and SHA-256 checksums. It refuses existing output unless `--force` is supplied. Review cardinality, classifications, component/system identities, physical-property flags, and the cutoff before replacing `catalog-work/nearest-1000`; then run `author-nearest1000.py build --force` and `build --check`.

The M-dwarf supplements refresh separately. It downloads the Cifuentes ReadMe and table, rebuilds `crossmatch.csv` from the frozen nearest-1000 SIMBAD export and nearest-100 identities, and queries 2MASS by exact designation in chunks of 200:

```sh
python3 scripts/refresh-catalog-sources.py physical-supplements \
  --output /tmp/star-view-supplements-refresh --retrieved YYYY-MM-DD
```

After review, replace `catalog-work/physical-supplements`, then run in order: `author-nearest100.py default --write`, `author-nearest100.py build --force`, `author-nearest1000.py build --force`, and both `build --check` commands. Refresh the supplements after any nearest-1000 SIMBAD refresh, because the crossmatch derives from it.

Source refresh is a separate, explicit research step, not part of normal builds. Download the complete files into a temporary directory outside src; the 10pc data endpoint is compressed, while CNS5 is uncompressed:

```sh
mkdir -p /tmp/star-view-nearest100-sources
curl --fail --location 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/ReadMe' -o /tmp/star-view-nearest100-sources/10pc.ReadMe
curl --fail --location 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/tablea1.dat.gz' -o /tmp/star-view-nearest100-sources/tablea1.dat.gz
gzip -dk /tmp/star-view-nearest100-sources/tablea1.dat.gz
curl --fail --location 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe' -o /tmp/star-view-nearest100-sources/cns5.ReadMe
curl --fail --location 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/cns5.dat' -o /tmp/star-view-nearest100-sources/cns5.dat
curl --fail --location 'https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt' -o /tmp/star-view-nearest100-sources/mamajek.txt
python3 scripts/author-nearest100.py inspect /tmp/star-view-nearest100-sources
```

Compare checksums and source versions before changing the frozen input. Review the full source, rank buffer, uncertain classifications, parallax outliers, system/component identities and V passbands. Modify the explicit source decisions only when the supporting evidence justifies it. Then an intentional `freeze /tmp/star-view-nearest100-sources --force` regenerates the adopted subset/checksum, and `build --force` regenerates the package. New releases with changed counts/schema require adapting and revalidating the helper, not disabling its guards. Raw downloads can be removed after the frozen source subset, checksums and decisions are verified; no automated tests depend on them.

## Add Another Package

The project-native format is a folder under `src/data/catalogs/<your-id>/` containing sibling files named `stars.csv` and `catalog.json`; they are project assets discovered at build time, not browser uploads or remote URLs. No raw survey download belongs in that folder. The Node CLI builds already-vetted native candidate data; the Python helper specifically reproduces this audited release. Neither is a generic live-data scraper.

Use this base CSV header for legacy authored data:

```csv
type,id,name,spectral_type,x_pc,y_pc,z_pc,vx_kms,vy_kms,vz_kms,temperature_k,mass_solar,luminosity_solar,absolute_mag,epoch,notes,constellation
```

The original 16 headers are required exactly once; constellation is optional for legacy/custom data. Enriched data may append the complete raw-astrometry group:

```csv
ra_deg,dec_deg,astrometry_epoch,parallax_mas,parallax_error_mas,pm_ra_cosdec_masyr,pm_ra_error_masyr,pm_dec_masyr,pm_dec_error_masyr,radial_velocity_kms,radial_velocity_error_kms,astrometry_ref,radial_velocity_ref
```

Optional `designations` may be appended as a pipe-separated list of alternate names. The bundled catalogs and overlays use the separately reproducible [object identity supplement](object-designations.md), applied when generating browser payloads. Stable IDs and scientific source rows are preserved.

Optional physical columns may be appended independently:

```csv
radius_solar,metallicity_dex,age_gyr
```

No other columns or partial raw groups are accepted. Every row must use one common Cartesian epoch and finite coordinates. Include exactly one `sun` at zero position, with zero or blank velocity and blank constellation. Use unique stable object IDs and names, reuse existing IDs for shared objects, and use one of `star`, `white_dwarf`, `brown_dwarf`, `sub_brown_dwarf`. Put only full canonical IAU names in constellation. Supply positive finite temperatures/masses/luminosities when known; leave unknown optional values empty. Each Cartesian velocity component may be independently blank. Complete raw proper motion and positive parallax can produce a dashed transverse arrow without radial velocity; adding a finite radial velocity produces full motion. Quote CSV cells containing commas with standard CSV quoting. A native subset of the supplied data plus Sun is supported; do not invent missing measurements to improve coverage.

Radius and age must be positive; metallicity may be negative, zero or positive. In the bundled nearest-1000 package, `metallicity_dex` stores Gaia GSP-Phot `[M/H]`, a model-derived metallicity estimate rather than a high-resolution spectroscopic `[Fe/H]` measurement.

The manifest has this shape; set its count to the actual total including Sun:

```json
{
  "schemaVersion": 1,
  "id": "my-catalog",
  "label": "My catalog",
  "description": "A documented individual-object sample.",
  "epoch": 2000,
  "objectCount": 101,
  "sources": [{"name": "Source release", "url": "https://example.org/source"}],
  "cutoffPolicy": "Describe membership, exclusions and tie breaking.",
  "snapshot": "Describe coordinate epoch and frozen source version."
}
```

Keep the manifest ID unique, including against reserved `nearest-neighbors`. Include per-field provenance for researched packages, especially inherited component astrometry, estimated temperatures, unknown values and passband decisions. Derive constellations offline from authoritative sky directions before rounding; do not infer them from names. Rebuild after adding project files and validate the native CSV with `parseStarCatalog` before using it. The finite loaded catalog is not the entire sky from every selected observer: an object absent from that package remains absent even if it would be visible from that location.

### Native Build And Validation

For another sample, first repeat the source audit and coordinate normalization steps above. Keep the adopted candidate CSV and a recipe in `catalog-work/<your-id>/`, outside browser discovery. The candidate CSV includes Sun and the vetted individual-object buffer at one epoch, using the header above. It must already exclude planets, uncertain candidates and aggregate systems according to your documented policy. The generic builder does not research or certify those choices, propagate epochs, assign constellations, merge aliases or infer missing values.

The recipe is a JSON object with three keys:

```json
{
  "manifest": {
    "schemaVersion": 1,
    "id": "my-catalog",
    "label": "My catalog",
    "description": "My audited stellar and substellar sample.",
    "epoch": 2000,
    "objectCount": 101,
    "sources": [{"name": "Pinned source release", "url": "https://example.org/source"}],
    "cutoffPolicy": "100 vetted individuals, nominal distance then stable ID; Sun added.",
    "snapshot": "J2000; name the frozen source releases here."
  },
  "candidatesCsv": "candidates.csv",
  "provenance": {
    "sun": {"source": "NASA Sun Fact Sheet; record adopted reference values"},
    "your-object-id": {"sources": ["catalog/table/component IDs and bibliography"], "fields": {"temperature_k": {"status": "unknown"}}}
  }
}
```

This is a schema example, not a ready dataset: replace the placeholder source, include a nonempty provenance record for **every** candidate ID, and supply at least `objectCount` rows. `candidatesCsv` resolves relative to the recipe. `objectCount` includes Sun. Use stable shared IDs from the bundled catalogs. A native subset is supported; unknown optional data stays unknown.

```sh
npm run catalog:build -- catalog-work/my-catalog/adopted.json src/data/catalogs/my-catalog
npm run catalog:validate -- src/data/catalogs/my-catalog
npm run catalog:validate
npm run catalog:generate
npm run build
```

The builder emits deterministic `stars.csv`, `catalog.json` and `provenance.json`. It validates the entire candidate table, sorts non-Sun rows by the unrounded norm of the supplied parsec vector then lexical stable ID, takes exactly `objectCount - 1`, and prepends Sun. It retains all candidate ranks and provenance, including the unselected buffer. This native rank uses supplied precision; use the source-specific high-precision Python recipe to reproduce the audited nearest-100 release exactly. No clocks or network queries affect output.

Existing output directories are refused. An intentional regeneration requires `--force` as the final argument; only the three generated sibling files are replaced. Recipe candidate paths must remain beneath the recipe directory. Catalog tools reject symlinked output roots and managed files, and publish generated files through atomic sibling replacements. Keep authored originals and adopted inputs separate. Do not run the builder over the preserved default catalog. Validation reports per-catalog counts and non-Sun coverage; production builds validate all packages and require full constellation coverage in the four shipped catalogs. Legacy custom packages may omit constellations. No hand-maintained registry edit is required: after rebuilding, the new package appears as a Catalog slider stop, ordered by object count (the `bright-stars` package is reserved for the additive bright-star toggle).

`catalog:generate` converts every validated CSV package into deterministic browser JSON. Those derived files are ignored and regenerated before `npm run dev` or `npm run build`; CSV, manifests and provenance remain the tracked source of truth. Runtime catalog payloads are emitted as separate content-hashed assets and loaded once on first selection.

Network-backed refreshes use a 60-second per-operation timeout by default. Override it with `--timeout SECONDS` when necessary; the value must be positive. Downloads and generated metadata are staged and atomically replaced so an interrupted request does not publish a partial managed file.
