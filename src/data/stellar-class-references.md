# Stellar class references

`stellar-class-references.json` contains the 87 O3V–M9.5V rows from Eric Mamajek’s **A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence**, version **2024.05.15**. Only spectral type, mass in solar units, radius in solar units, and log10 luminosity in solar units are retained. Values are copied exactly from the published table; these are reference values, not statistics computed from Star View catalogs.

- Author’s table: <https://github.com/emamajek/SpectralType/blob/master/EEM_dwarf_UBVIJHK_colors_Teff.txt>
- Requested citation: Pecaut & Mamajek (2013), ApJS 208, 9, <https://arxiv.org/abs/1307.2657>. The updated online table includes mass, radius and luminosity estimates beyond the paper’s original Table 5.
- Downloaded 2026-10-07. SHA-256 of the source text: `ecd2a61725bc360d62a69b798cba10394682523c8d0bcad948a7581b083e0fee`.

The source explicitly describes its adopted masses as tentative. The app uses an exact subtype row where available. Fractional subtypes between rows interpolate mass and radius linearly, and log10 luminosity linearly. Beyond a family's coverage, the closest published subtype is used and identified; no values are extrapolated.

Each displayed class range is the minimum and maximum across that spectral family’s published subtype reference values. These are sequence envelopes, **not** population percentiles, measurement errors, or predicted scatter at one subtype. Derived gravity, escape speed, density and luminosity per mass are evaluated for each row’s paired mass, radius and luminosity before taking the envelope, preserving the reference sequence’s relationships.

## White dwarf references

`white-dwarf-references.json` retains every physical model point from the **Montréal white dwarf cooling sequences**, Bédard et al. (2020), ApJ 901, 93. The source offers 23 masses (0.20–1.30 M☉ in steps of 0.05 M☉) for each of two hydrogen-envelope thicknesses, giving 46 tracks and 10,656 model points. Only effective temperature (K), radius (cm), and photon luminosity (erg/s) are retained; source values are not rounded.

- Source and acknowledgement: <https://www.astro.umontreal.ca/~bergeron/CoolingModels/>.
- Paper: <https://www.astro.umontreal.ca/~bergeron/CoolingModels/Bedard2020.pdf>.
- Grid update: 2020-08-18; downloaded 2026-10-07.
- Archive: <https://www.astro.umontreal.ca/~bergeron/CoolingModels/CoolingModels/AllSequences.tar.gz>.
- Archive SHA-256: `24aac73615f4ca1431b013af9ed6b64242c91c940a0a4bdeea2a60360d61bb0a`; each track's source filename and SHA-256 are also preserved in the JSON.
- Reproduce the snapshot with `python3 scripts/extract-white-dwarf-references.py /path/to/AllSequences.tar.gz`.

The reference mass is the conventional **0.6 M☉** benchmark used in white dwarf cooling work, including Salaris et al. (2002), <https://arxiv.org/abs/astro-ph/0209045>. It is not a measured population median. The app samples that mass's track at the object's catalog effective temperature. DA types use the thick hydrogen envelope (`qH = 10⁻⁴`); DB/DO use the thin hydrogen envelope (`qH = 10⁻¹⁰`). DQ/DZ use the thin-envelope track as an explicitly documented helium-envelope proxy, not a carbon/metal atmosphere fit. Mixed or unknown atmospheres use both envelopes for the range, with no single surface reference value.

Between neighboring temperatures, radius interpolates linearly and luminosity interpolates in log space. No track is extrapolated. Radius converts from cm to R☉ using 6.957 × 10¹⁰ cm; luminosity converts from erg/s to L☉ using the nominal IAU luminosity 3.828 × 10³³ erg/s. Surface gravity, escape speed, mean density and luminosity per mass are derived with the same formulas and nominal solar mass conversion as the selected object.

The mass range is the grid's full 0.2–1.3 M☉ coverage. For surface metrics, the range is the envelope of all covered mass tracks at the catalog temperature, using the same envelope selection as the reference. If temperature is unavailable, the range spans all temperatures of the selected envelope(s), with no single surface reference. If a temperature falls outside all tracks, surface comparisons are unavailable; if it falls outside only the 0.6 M☉ track, a model range can remain without a reference marker.

These are **model-grid envelopes, not typical population intervals, percentiles, error bars or white dwarf mass limits**. The models assume carbon/oxygen cores; helium-core and oxygen/neon-core remnants can differ. A selected object's missing mass or radius is never filled from these comparison models.

Additional mass-only guides:

- Neutron stars and pulsars: 1.4 M☉, the standard neutron-star mass discussed by NASA NICER, <https://www.nasa.gov/universe/nasas-nicer-probes-the-squeezability-of-neutron-stars/>. No Newtonian surface comparisons are introduced.
- Brown dwarf: approximately 13–80 Jupiter masses, NASA/JPL, <https://www.jpl.nasa.gov/images/pia23685-what-is-a-brown-dwarf/>. This is a broad classification guide, not a statistical interval. No midpoint is assigned as a typical mass. Conversion uses the IAU 2015 B3 nominal GM ratio, `1.2668653e17 / 1.3271244e20`, <https://arxiv.org/abs/1510.07674>.

## Catalog fallback

Published dwarf and white dwarf references remain preferred. Evolved stars and subdwarfs use catalog averages when no published calibration is assigned. `npm run catalog:generate` also refreshes the checked-in `src/data/catalog-class-references.json` snapshot from **every bundled stellar catalog**, including catalogs not currently displayed. Each exact normalized spectral class has a separate sample: all A0V stars are grouped together, rather than pooling every A-type star.

Stars repeated across catalogs count once, using the same ID, reviewed component, name and astrometry rules as the map. Resolved companions remain separate. Measurements take deterministic precedence: nearest-1000, nearest-100, nearest-neighbors, bright-stars, western-constellation-stars, famous-cluster-stars, then any new catalogs sorted by ID. Missing accepted fields can be supplemented from another catalog; explicitly withheld component measurements remain missing. The selected object is included if it is a member of the sample.

Every metric retains its number of measurements, arithmetic mean, observed minimum and observed maximum. Missing values are omitted separately for each metric. Gravity, escape speed, density and luminosity per mass are computed from each star's paired measurements before averaging. This preserves physical pairs instead of computing from independently averaged mass and radius. One measured star yields equal mean and bounds; the bar reserves space around that point.

Chemical and rotation annotations such as A0Vn and A0VpSi normalize to their basic spectral class. Luminosity subclasses are retained where stated. Transition spectra use the first stated subtype and stage, so B2IV-V becomes B2IV. Explicit d/sd prefixes identify dwarfs/subdwarfs; uncertain spectra with no luminosity stage are excluded from the measured exact-class samples. Composite spectra remain unassigned.

If the exact class lacks a metric, the app selects the nearest subtype with measurements in the same spectral family and luminosity stage, then the same stage in another family, then another available class. It identifies the class used, including per-metric differences. If no catalog fallback exists, a closest published dwarf proxy is explicitly identified. Catalog bounds describe the bundled sample, not scientific population limits, percentiles or intrinsic scatter. These references stay independent of the current catalog, filters and origin.

No generic mass reference is assigned to black holes, sub-brown dwarfs or blended spectra. Missing measurements for the selected object are never filled from a comparison reference.
