# Bright-star data gaps: review of 18 October 2026

The review covers **199 non-solar objects actually shipped to the browser**:
bright landmarks and all confirmed companions added when the catalog loads.
The source CSV has only 125 non-solar rows, so auditing that file alone misses
many of the individual-component gaps. Catalog membership and selection IDs
are unchanged.

| Effective field | Available before | Available after | Filled |
| --- | ---: | ---: | ---: |
| Mass | 71 | 98 | 27 |
| Bolometric luminosity | 95 | 107 | 12 |
| Radius | 96 | 109 | 13 |
| Radial velocity | 85 | 199 | 114 |
| Effective temperature | 138 | 140 | 2 |

Every previously adopted non-null value in these fields is preserved. The
[complete per-object audit](../catalog-work/bright-stars/gap-coverage-audit.json)
lists the additions, remaining blanks and reasons. Remaining gaps mean no
adoption was justified by this review, **not** that no relevant publication
exists. This is a literature review and frozen-source crossmatch, not a claim
that all stellar parameters have a new 2026 measurement.

## Physical sources and scope

- [Rudrasingam et al. 2026, Table 1](https://academic.oup.com/mnras/article/547/4/stag413/8502134):
  seismic scaling masses for Aldebaran, Eltanin, Kochab, Schedar, Izar, Dubhe,
  Ankaa and Aljanah. The quoted errors are formal; scaling-relation and source
  systematics remain. In particular the authors urge confirmation of Schedar's
  high mass. Source radii/temperatures are retained with each mass, even when
  the catalog independently adopts different values.
- [Baines et al. 2025, Table 7](https://arxiv.org/html/2506.02912):
  interferometric radius for Muphrid. Its added luminosity
  use the same publication's radius and temperature through Stefan–Boltzmann,
  with both input errors retained. They are derived values, not additional
  bolometric-flux measurements. The table's compiled catalog luminosities
  were not substituted. Muphrid's adopted spectroscopic temperature remains
  independent of these luminosity inputs.
- [Arroyo-Torres et al. 2014, Table 5](https://arxiv.org/html/1404.7384):
  Scheat's Rosseland radius 109 +/-7 solar and published log bolometric luminosity
  3.40 +/-0.15 dex. Molecular-shell size and model-dependent initial mass ranges
  are not substituted for photospheric radius or present-day mass.
- [Stock et al. 2018](https://cdsarc.cds.unistra.fr/ftp/J/A+A/616/A33/):
  present-day evolutionary posterior mass modes for Arcturus, Alphard, Enif
  and Hassaleh. Exact HIP identities, dominant-stage probabilities, original
  flags and asymmetric confidence bounds are frozen. These are model masses.
- [Torres et al. 2022](https://arxiv.org/html/2210.16322):
  dynamical masses of Castor Aa/Ab/Ba/Bb and CHARA radii of Aa/Ba; no subsystem
  sum is assigned to one star. Ba's possible interferometric systematic error
  remains explicit.
- [Evans et al. 2024](https://arxiv.org/html/2407.09641):
  preferred replicated-solution masses for Polaris Aa/Ab and the Cepheid's
  mean interferometric radius. Pulsation phase is not inferred.
- [Kolbas et al. 2015, Table 5](https://arxiv.org/abs/1506.01254):
  individual Algol A/B/C map to MSC **Aa/Ab/B**. Component luminosities derive
  from that paper's own radius/temperature pairs. Earlier adopted temperatures
  are preserved as separate measurements.
- [Ohnaka et al. 2013](https://arxiv.org/abs/1304.4800):
  Antares A photospheric temperature, radius and luminosity. The published
  15 ± 5 solar evolutionary-track mass is an **initial** mass; current mass
  is a model-dependent range. Neither is silently made a measured current
  point mass. No formal uncertainty was invented for the rounded radius.
- [Zhao et al. 2009](https://arxiv.org/html/0906.2241):
  Alderamin's gravity-darkened rotating-star mass and true luminosity; its
  scalar radius is explicitly a Stefan–Boltzmann equivalent. Polar/equatorial
  radii remain in the source inputs. A spherical-disk fit is not substituted.
- Dedicated analyses add Canopus's spectroscopic present-day mass
  ([Domiciano de Souza et al. 2021](https://arxiv.org/html/2109.07153)),
  Deneb's spectroscopic mass with the full article's ±4-solar uncertainty
  ([Schiller & Przybilla](https://arxiv.org/abs/0712.0040)),
  Mimosa's seismic mass ([Cotton et al. 2022](https://arxiv.org/abs/2205.11679)),
  Mirzam's revised mass ([Shull et al. 2025](https://arxiv.org/html/2508.03800)),
  Adhara A's gravitational mass ([Shull et al.](https://arxiv.org/html/2412.06919)),
  and Caph's rotating-star mass as retained by
  [Zwintz et al. 2020](https://arxiv.org/html/2009.04784).
- [Bale et al. 2025, Table A.1](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/703/A128):
  Muphrid's primary-dominated subgiant mass, 1.40 ± 0.41 solar, in both source
  spectra. This supersedes blanket binary withholding; the unseen companion
  receives no parameters. The prior shared review is retained intact.

Spica's current Aab record itself represents an unresolved inner pair. Its
published individual Aa/Ab values must not be attached to Aab or the separate
Ac component. Similar scope restrictions remain for poorly resolved hierarchies,
MSC estimated masses and integrated catalog fluxes. No generic spectral-type
mass or mass–luminosity relation was used to erase these gaps.

## Shared radial velocities

The frozen motion review names **42 exact systems and 113 target components**;
Muphrid adds one exact-object compiled RV proxy across its containing catalogs.
No automatic name, sky-position or future-membership inheritance is introduced.

Ten of the newly filled component RVs use identified systemic solutions:
Castor's AB solution, Polaris's preferred Aa/Ab solution, Capella's existing
Aa/Ab gamma, and Sirius's gravitational-redshift-corrected systemic RV from
[Bond et al. 2017, section V.1](https://arxiv.org/html/1703.10625).
Applying an inner-system gamma to a wider bound member is still approximate.
The other **104 new RVs** use explicitly labelled compiled parent/member
proxies, including Muphrid. They may contain orbital motion, pulsation, winds
or gravitational shifts. A source measurement error does not bound these effects;
missing uncertainties remain missing.

MSC orbital V0 candidates are retained separately with their subsystem labels.
Different nested-system gammas are not silently merged into a measured velocity
of the whole hierarchy. Newer explicitly reviewed solutions take precedence.

Native component astrometry, epochs, errors, positions and existing velocity
vectors are preserved. Where a component lacked a vector, its adopted bulk
vector uses the review's complete donor astrometry and chosen RV. This vector
is separately scoped; native component proper motion need not reconstruct it.
For Sirius B, its existing shared vector remains, while the newly populated RV
uses Bond's corrected systemic value. No individual orbital trajectory is added.
The motion tooltip distinguishes compiled proxies from identified systemic RVs.

## Reproduction and validation

Reviewed inputs are `gap-physical-review.json`, `gap-motion-review.json`, the
existing component literature plan, and frozen numeric tables under
`catalog-work/bright-stars/literature/`. Inputs are checked by SHA-256. Catalog
builds remain offline.

Regenerate the default, nearest-100, nearest-1000, bright and landmark catalogs,
then `python3 scripts/author-stellar-companions.py --write` and
`npm run catalog:generate`. Run `python3 scripts/audit-bright-star-gaps.py --write`
to update the effective coverage report, or omit `--write` to verify it.

Validation uses the pre-turn catalog/component snapshot as well as the required
`npm run catalog:preservation` against HEAD. Focused Python checks independently
compare the Galactic velocity transform with Astropy and verify membership guards
and preservation. Focused TypeScript checks cover all 199 prior effective records,
Algol component mapping, proxy wording, all six catalogs' retained measurements,
and the changed bright/system behavior. The full suite is not authorized.

A broader initial component-file run also exposed two pre-existing Wolf 424
expectations (0.124 solar versus 0.1379 already present before this work), one
per nearby catalog. Those unrelated expectations and the existing data were
left untouched; subsequent runs target the bright-star changes.
