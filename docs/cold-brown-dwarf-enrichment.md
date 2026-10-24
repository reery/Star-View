# UGPS J0722 and WISE J1639 enrichment

Reviewed 2026-10-17. Exact stable identities are `10pc-0068` (UGPS
J072227.51-054031.2 / SIMBAD WISE J072227.27-054029.9 / CNS5 1828) and
`10pc-0084` (WISE J163940.83-684738.6 / WISEA J163940.84-684739.4 / CNS5
4091). Both occur in nearest-100 and nearest-1000; neither has a separate
record in the effective companion pool.

## UGPS J072227.51-054031.2

[Dupuy & Kraus (2013), Table S5](https://arxiv.org/pdf/1309.1422) gives
log10(L/Lsun) = -6.20 ± 0.03, converted to 6.309573445e-7 solar luminosities.
The review retains asymmetric linear errors from the logarithmic uncertainty.
This is a bolometric SED estimate including a correction for missing flux,
retained at the paper's distance.

The same table provides two evolutionary scenarios, rather than a measured age:

| Assumed age | Temperature | Mass (Jupiter) | Radius (Jupiter) |
| --- | --- | --- | --- |
| 1 Gyr | 502 ± 10 K | 10.7 ± 0.2 | 1.0192 ± 0.0005 |
| 5 Gyr | 539 ± 12 K | 25.8 ± 0.9 | 0.886 ± 0.005 |

The Specs rows show the spans of these scenarios, labeled as models. Their
individual errors remain in the source metadata; the spans are not confidence
intervals. Scalar temperature, mass, radius and age stay unavailable, so no
midpoints enter rendering, surface gravity, size comparisons or temperature
charts. The existing disabled-control and keyboard-focus tooltip patterns are
reused for ranges.

[Hood et al. (2023), preferred FIRE retrieval, Figure 22 and section
4.2](https://arxiv.org/pdf/2303.04885) supplies the adopted radial velocity
35.80 -0.15/+0.16 km/s. The symmetric astrometry schema uses the larger error,
0.16 km/s; both published errors remain in the review and article. These are
formal posterior errors and exclude systematic effects. Galactic velocity is
computed with the retained source astrometry, preserving the frozen J2000
position, membership and distance.

The same paper explicitly calls its fitted radius of about 0.50 Jupiter radii
unphysical. Its dependent temperature/mass fit is recorded as rejected context,
not adopted as reliable physical data. Its metallicity fit is not substituted
for a measured stellar iron abundance.

[Bochanski et al. (2011)](https://arxiv.org/abs/1109.2897) remains in the Info
Sources entry and Specs notes: 46.9 ± 2.5 km/s, explicitly not adopted. Both
analyses use the same FIRE spectrum, so the disagreement does not establish
acceleration or an orbital companion.

## WISE J163940.83-684738.6

[Fontanive et al. (2023), Table 3 and section
3.2](https://arxiv.org/abs/2309.09923) supplies temperature 361 ± 14 K, mass
13 ± 4 Jupiter masses, and log10(L/Lsun) = -6.82 ± 0.05. All are conditional
ATMO 2020 evolutionary estimates using infrared photometry and an assumed
population age distribution of 5 ± 3 Gyr. The adopted values must not imply
that the object's age was measured. Model inputs use the source parallax
211.1 ± 0.6 mas; the existing catalog astrometry (219.6 ± 2.3 mas) remains
untouched. The source model is not silently rescaled to a different distance.

Mass conversion uses the IAU nominal GM_Jup / GM_sun ratio,
1.2668653e17 / 1.3271244e20. Radius uses the same model temperature and
luminosity via sqrt(L/Lsun) * (5772/Teff)^2, approximately 0.09946 solar radii.
It is not an independent observed radius; no uncertainty is invented from the
correlated model parameters. Age, metallicity, Johnson V and RV remain absent.

## Passband-specific photometry

[Albert et al. (2025), Table 2](https://arxiv.org/abs/2501.14100) supplies the
measured Vega F480M snapshots displayed in Specs:

| Object | Instrument | Date (UTC) | F480M |
| --- | --- | --- | --- |
| UGPS J0722 | JWST/NIRISS | 2023-04-17 | 12.016 ± 0.011 |
| WISE J1639 | JWST/NIRCam | 2023-06-28 | 13.487 ± 0.005 |

The WISE J1639 identity is checked against Table 4: RA 249.9258850 deg,
Dec -68.8055121 deg, MJD 60123.90787. Table 1 contains a contradictory full
name pointing to +18 degrees; its unrelated identity/temperature are not
adopted. Table 2's WISE-1639 photometry is associated with the -68-degree
astrometric record by the shared short name and observation time.
The same measured exposure gives F150W = 21.316 ± 0.014. HST F127M =
20.00 ± 0.02 on 2019-03-11 is retained from Fontanive's Tables 2–3.
UGPS's F150W entry is synthetic from older spectroscopy, not measured by
JWST in that exposure; this distinction is explicit in its source scope.
No infrared magnitude fills Johnson V or drives visual-brightness rendering.

## Authoritative inputs and preservation

Physical scalars are authored in `catalog-work/nearest-100/physical-overrides.json`.
`catalog-work/shared-enrichment/cold-brown-dwarfs-review.json` retains complete
pre-enrichment rows and provenance from both catalogs, the two RV analyses,
asymmetric errors and rejected-fit rationale. `src/data/stellar-observations.json`
contains identity-guarded range and infrared display metadata. All are checked
by the shared source manifest. The generated nearest-1000 inherits curated
nearest-100 records; the source CSVs and source measurements are not edited.

Validation: production build and TypeScript passed, including cross-catalog
consistency for 336 shared objects and catalog preservation for 2887 records.
A separate comparison against the pre-change worktree snapshot confirmed that
only these two rows changed in each nearby catalog, all original source
measurements and unrelated per-object provenance survived (apart from refreshed
review hashes), and all 844 effective companion records remained byte-identical.
Both nearby packages reproduced from their inputs. Eight focused Python checks,
16 observation/Info unit checks and two focused desktop/mobile browser checks
passed. Browser checks cover both catalogs, model-only disabled controls,
keyboard-accessible tooltips, switching between objects, infrared-versus-V scope,
the adopted radial velocity and the linked older source. Desktop and mobile
screenshots were inspected; the initial clipped range tooltip was corrected to
open below the value and checked again. No full test suite was run.
