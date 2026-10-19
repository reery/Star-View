# GJ 412, GJ 687 and Lacaille 8760

Reviewed 2026-10-18. The shared exact-identity adoption supplies the same values
to both nearby catalogs and the effective GJ 412 component records. Original
records, physical sources, photometry, astrometry, uncertainties and provenance
are frozen in `catalog-work/shared-enrichment/nearby-gaps-review.json`.

- GJ 412 A (BD+44 2051 A) and B (WX UMa): individual Johnson V 8.77 and
  14.44 from the [RECONS individual rows](https://chara.gsu.edu/~thenry/RECONS/TOP100.posted.htm).
  Absolute V is calculated at each adopted catalog distance. The blanket binary
  V withholding was too broad for this resolved pair. No photometric epoch or
  uncertainty is invented; old RECONS parallaxes and masses are not adopted.
- GJ 687: Johnson V 9.15 and empirical mass 0.413 ± 0.041 solar from
  [Burt et al. 2014, Table 1 and section 2](https://arxiv.org/pdf/1405.2929).
  The paper attributes V to Rojas-Ayala et al. and mass to Boyajian et al.
  Absolute V uses the current catalog distance. Existing temperature, radius,
  luminosity and abundance estimates retain their independent sources.
- Lacaille 8760 (GJ 825 / AX Mic / HIP 105090): empirical mass 0.627 solar,
  radius 0.593 solar and object-specific SME temperature 3795 K from
  [Lindgren & Heiter 2017, Tables 3 and 5](https://arxiv.org/pdf/1705.08785).
  The mass uses the Benedict et al. Ks calibration and the radius uses Mann
  et al. Eq. 4, at the publication's parallax. They are not dynamical or
  interferometric measurements. The source Ks error is large (0.230 mag),
  and no individual mass/radius errors are tabulated. The paper's 100 K
  abundance-sensitivity step is not treated as a measured temperature error.
  Luminosity is derived here as R²(T/5772 K)⁴ and explicitly carries these
  empirical/model assumptions; it is not a published bolometric-flux measurement.
  Existing V, iron abundance and astrometry are preserved. No age is inferred.

The shared review retains the old spectral-class temperature as source evidence
when adopting Lacaille 8760's object-specific temperature. No other known
numeric property is replaced and no catalog membership is changed.
