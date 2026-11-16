# Local Volume Database rows

`lvdb-v1.1.2-galaxies.csv` holds the rows of the Local Volume Database (Pace 2025, [The Open Journal of Astrophysics 8, 142](https://doi.org/10.33232/001c.144859)) for the dwarf galaxies in the galaxy overlay, with the columns `scripts/author-galaxies.py` reads. It was cut from `comb_all.csv` of [release v1.1.2](https://github.com/apace7/local_volume_database/releases/tag/v1.1.2) (2026-11-04), retrieved 2026-11-16. The database is CC0 1.0.

Every value keeps its database reference (`ref_*`, ADS bibcodes). `mass_dynamical_wolf` is the database’s mass within the 3D half-light radius from `vlos_sigma` and `rhalf` (Wolf et al. 2010 estimator), as log₁₀ M☉; `surface_brightness_rhalf` is the mean V-band surface brightness within the half-light radius, mag/arcsec².

To add galaxies, append their rows from a newer release and their curated fields in `scripts/author-galaxies.py`.
