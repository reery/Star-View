# Offline Catalog Sourcing

## This Release

The project now ships four snapshots. **Nearest 1000 objects** contains 1000 non-Sun individuals plus Sun. Corrected CNS5 (13-Dec-2023) defines its membership backbone; exact CNS5 identifiers enrich through a frozen SIMBAD TAP export and exact Gaia DR3 identifiers enrich through a frozen Gaia TAP export. All 101 nearest-100 rows are retained field-for-field as higher-curation overrides.

**Bright stars** contains 114 qualifying stars within 3000 light-years, plus Sun as the map origin. Membership includes every stellar entry in the frozen SIMBAD snapshots with compiled apparent Johnson V below 2.70. A SIMBAD stellar-hierarchy join excludes NGC 1980: its integrated V=2.50 qualifies numerically, but it is an open cluster rather than a star. The aggregate Alpha Centauri system row is omitted in favor of its separately qualifying A and B components, while Acrux uses the Bright Star Catalogue combined V=0.76 because SIMBAD does not supply the required combined V row. The 1000-2000 light-year shell contains Alnilam, Aludra, Deneb, Naos, Regor, Sadr and Wezen; Arneb is the sole qualifying 2000-3000 light-year row. System-level names remain system-level where SIMBAD identifies an unresolved or spectroscopic system. Excluding Sun, current physical coverage is 113 temperatures, 45 masses, 99 luminosities, 98 radii, 23 metallicities and one age. No age is adopted without a source that resolves the represented component or system and publishes a compatible estimate.

**Compact remnants** is a separate opt-in overlay, not a fifth stellar catalog. Its frozen ATNF v2.8.1 subset contains 266 non-candidate, non-interim pulsars with positive ATNF adopted distance no greater than 0.9198041814 kpc (3000 ly). Coverage is 263 rotation periods, 167 1400 MHz radio luminosities, and 220 characteristic ages/surface magnetic fields; 54 rows have the parallax-plus-proper-motion group required for a transverse map arrow. ATNF adopted distance can come from an independent estimate, significant parallax or a dispersion-measure model, and the per-row method/reference is retained. Companion-mass limits are deliberately not represented as pulsar masses.

The curated non-pulsar portion contains confirmed dormant systems Gaia BH1 and Gaia BH3 plus the Gaia NS1 neutron-star candidate. It records compact-object mass, uncertainty, orbital period, visible companion, detection method and a primary-paper link. Gaia NS1 is not promoted to confirmed: its source paper favors a neutron star but does not fully exclude a close double-white-dwarf alternative. BlackCAT's Galactic black-hole transient table was also reviewed; its nearest listed system, A0620-00 at 1.06 kpc, lies beyond the boundary. This is a reproducible source-defined catalog, not a claim that every compact remnant physically present inside 3000 ly has been discovered.

**Nebulae** is a second opt-in overlay with two hand-curated showcase objects, not a census. The Orion Nebula (M42, H II region) uses the SIMBAD M42 center, the 388 ± 5 pc VLBA distance of Kounkel et al. (2017), the 65 × 60 arcmin revised-NGC apparent size and the blister geometry of O'Dell (2001): emission mainly from the back surface of a cavity open toward us, ionized by theta1 Orionis C. The Pleiades reflection nebulosity uses the Gaia DR3 cluster center, the 135.74 ± 0.10 pc distance of Alfonso & García-Varela (2023), an approximate 90 × 70 arcmin visual extent and the two dust layers along the line of sight described by Gibson & Nordsieck (2003); the dust is an unrelated cloud the cluster is passing through. Sky extents follow the apparent sizes at the adopted distances; bowl depth, sheet offsets, thicknesses, orientations and palettes are illustrative and documented in each row's `model_note`. There is no frozen survey input or Python recipe: the tracked `src/data/overlays/nebulae/` manifest and objects are the source of truth, and validation recomputes each Cartesian position from RA, Dec and distance with the shared ICRS-to-Galactic rotation.

Bright-star temperatures and metallicities come from frozen `mesFe_h` ranked bibliographic measurements. Linear diameter measurements from `mesDiameter` become radii using the IAU nominal solar-radius scale. The reviewed physical-property subsets refreshed on 2026-10-01 contain 54 exact-Hipparcos rows from the 17,219-star evolutionary-model catalog of Allende Prieto & Lambert (1999), 77 rows from the 107,619-star McDonald et al. (2012) SED catalog, and ten unambiguous Hohle et al. (2010) massive-star rows. Eligible single-star masses, radii and temperatures use the former; its masses are withheld for unresolved systems and for stars whose adopted metallicity falls outside ±0.3 dex. The latter supplies fallback temperatures and luminosities, with Stefan–Boltzmann radii derived when no stronger radius exists. Reviewed source rows add interferometric and spectroscopic parameters for Menkar, high-quality exact-Hipparcos 2017 SED parameters for Beta Gruis and Gacrux, Antares A's mass and age-range midpoint, and Shaula A's component mass. Fields without a reviewed frozen source remain blank; Mizar A remains unfilled because the available system/component matches are ambiguous. The row notes and provenance retain the contributing bibcodes.

The policy-aware rank-1000 object is **WISE J032337.53-602554.5** (`cns5-0864`) at **13.947001394700 pc**; the next eligible object, WISE J105553.59-165216.3, has the same nominal distance and sorts after it by stable ID. Their linearized parallax-only one-sigma intervals overlap, so nominal ranking is retained without claiming statistically secure membership. The audited 1100-row buffer excludes 47 aggregate SIMBAD `**` records and nine tentative `BD?` records before selecting 1000 individuals.

Nearest-1000 non-Sun coverage is: 1000 raw astrometry records and constellations, 957 spectra, 544 absolute Johnson V magnitudes, 558 temperatures, 526 masses, 505 bolometric luminosities, 568 radii, 350 metallicities, 68 ages, 326 raw radial velocities, and 674 transverse-only motions. Gaia values are model-derived, not direct measurements. GSP-Phot temperature and `[M/H]` metallicity plus FLAME percentile bounds are retained in provenance. FLAME mass and age are adopted only when the first `flags_flame` digit is `0`; luminosity and radius may remain valid when mass/age is unavailable (`A=2`), and use the accepted distance/parallax flag policy. Brown dwarfs and white dwarfs do not receive generic Gaia stellar-model properties.

Display names prefer a frozen SIMBAD `NAME` alias when one exists, so machine identifiers such as `* alf Boo` become `Arcturus`. Remaining SIMBAD object-class prefixes are removed, repeated whitespace is collapsed, and Bayer abbreviations are expanded (`* bet Hyi` becomes `Beta Hyi`). Stable Star View IDs do not change, and the original SIMBAD `main_id` remains in provenance.

The Nearest 100 objects package contains exactly **100 individual non-Sun objects plus Sun**, ranked by adopted nominal J2000 distance. It is a frozen source-based catalog, not a complete or continuously current 2026 census. Stars, white dwarfs, brown dwarfs and sub-brown dwarfs are eligible; planet rows, aggregate system rows and tentative source `ObjType` endings `?` are excluded. The only explicitly approved exceptions are the vetted default members **EZ Aquarii B/C (Seq 27/28)**, whose raw `LM?` classifications remain recorded unchanged. Preserving these two existing rows is not a new classification measurement.

The release contains 78 stars, 6 white dwarfs, 15 brown dwarfs and 1 sub-brown dwarf, excluding Sun. Including Sun, all 101 rows have spectral types, 92 have temperatures, 48 have absolute Johnson V magnitudes, 55 have masses, 39 have bolometric luminosities, 40 have radii and 70 have complete velocity triplets. These counts include preserved neighbor data, [M-dwarf supplements](#m-dwarf-physical-supplements) and explicitly estimated class temperatures, not just individually measured values. All 100 non-Sun rows have a constellation; Sun deliberately does not.

The default catalog retains its 22 objects, IDs, positions, and curated physical properties. It now includes raw astrometry and constellations; unreviewed legacy radial velocities are withheld rather than silently promoted into full motion. All 22 rows are retained as curated overrides in both larger packages, including the corrected Sirius systemic velocity. Their original source notes remain authoritative; source-table alternatives are recorded for audit, not silently substituted.

## Files and Sources

- Runtime packages: [bright-stars](../src/data/catalogs/bright-stars/), [nearest-100](../src/data/catalogs/nearest-100/), and [nearest-1000](../src/data/catalogs/nearest-1000/).
- Per-object field statuses, raw classifications/measurement references/errors, epoch assumptions, complete 160-candidate buffer audit, 155 eligible ranks, five explicit exclusions, two approved default exceptions and CNS5 crossmatches: [provenance.json](../src/data/catalogs/nearest-100/provenance.json). This is authoring metadata, not browser geometry input.
- Frozen adopted source subset, default-row overrides and extracted temperature calibration: [source-input.json](../catalog-work/nearest-100/source-input.json), checked by [source-input.sha256](../catalog-work/nearest-100/source-input.sha256).
- Executable authoring recipe: [author-nearest100.py](../scripts/author-nearest100.py); optional pinned environment: [catalog-requirements.txt](../scripts/catalog-requirements.txt).
- Nearest-1000 frozen CNS5/SIMBAD/Gaia inputs, ADQL, manifest, and checksums: [catalog-work/nearest-1000](../catalog-work/nearest-1000/); executable recipe: [author-nearest1000.py](../scripts/author-nearest1000.py).
- Bright-stars frozen SIMBAD snapshot and selection query: [catalog-work/bright-stars](../catalog-work/bright-stars/); executable recipe: [author-bright-stars.py](../scripts/author-bright-stars.py).
- Compact-remnant frozen ATNF subset, reviewed dormant systems, manifest and checksums: [catalog-work/compact-remnants](../catalog-work/compact-remnants/); executable recipe: [author-compact-remnants.py](../scripts/author-compact-remnants.py); runtime provenance: [provenance.json](../src/data/overlays/compact-remnants/provenance.json).
- Hand-curated nebula overlay: [manifest.json](../src/data/overlays/nebulae/manifest.json) and [objects.json](../src/data/overlays/nebulae/objects.json); per-row sources and model notes are inline.
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
| [Astropy get_constellation](https://docs.astropy.org/en/stable/api/astropy.coordinates.get_constellation.html) | Astropy 7.1.1; Roman 1987 [VI/42](https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/42) | Offline IAU boundary assignment |
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

Solid arrows show complete motion after the existing approximate Galactic-rest display offset, including a solar-motion arrow for the Sun. Dashed shafts show incomplete Sun-relative transverse motion and receive no solar offset. The arrowhead remains solid so its projected direction is legible. The inspector states `Full space motion` or `Transverse only; radial velocity unavailable` in addition to the line style.

Positions are Galactic Cartesian **Sun-relative** parsecs: x toward Galactic center, y toward longitude 90 degrees, z toward the north Galactic pole. They are not Three.js world coordinates and have no solar Galactic-center position offset. The axes are the standard Astropy ICRS/Galactic frame transformation. Small Solar-System barycentric/heliocentric offsets are neglected at this map's precision.

The source coordinate frame is ICRS, while its separate Epoch column is the position epoch. The helper uses Astropy `SkyCoord.apply_space_motion` to normalize to J2000.0 and then transforms to Galactic coordinates. Source decimal years are treated consistently as Julian years TT; their published precision (including 0.1-year epoch rounding) is not improved by the transformation. Full propagation uses available proper motion and an adopted RV. If RV is missing or withheld, propagation is transverse-only using Astropy's implicit zero-RV approximation. This is an assumption for the position calculation, **not a measured zero velocity**. All output velocity fields remain blank in that case.

New white-dwarf spectroscopic RVs are withheld because gravitational redshift may contaminate them. Sirius A/B instead preserve the existing true systemic RV correction from Bond et al. (2017), not Sirius B's gravitationally redshifted spectrum. Other complete motions follow the source proper motion and spectroscopic RV; no binary orbit solution or solar Galactic velocity offset is added. The map is static, not an orbit integrator. Individual binary components can share rounded system positions: no fabricated AU separation is introduced, and distinct coincident objects cannot yield meaningful observer-relative companion brightness.

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

Astropy 7.1.1's full-name table uses the spellings `Chamaleon`, `Ophiucus` and `Pisces Austrinus`; the helper normalizes these to canonical **Chamaeleon**, **Ophiuchus** and **Piscis Austrinus**, normalizes Bootes to ASCII, and trims name-table whitespace (including trailing whitespace after Crux). All **88 normalized names** were compared with the parent parser's canonical vocabulary, with no parser changes. This does not change boundary calculations. Every shipped assignment is checked again from its exported vector and at eight offsets one arcsecond away. Known landmarks include Sirius A/B in Canis Major, Proxima in Centaurus, Barnard's Star in Ophiuchus and GJ 229 A in Lepus. A synthetic two-arcsecond pair straddling the Cepheus/Ursa Minor boundary is also frozen in provenance and tested during reproduction. The Sun has no fixed constellation in this static origin-centered model; its cell stays blank. Custom unknown non-Sun values are distinct from this Sun exception.

## Reproduce Offline

Normal application builds, tests and browsing use **Node/TypeScript and checked-in data only**. No Python, live catalog query or network request is needed to use the package. Python is optional authoring tooling. This recipe was executed with Python 3.11.9 on macOS; use Python 3.11 or newer compatible with the pinned packages. No sudo or application package changes are required.

From the project root, install the optional isolated environment once:

```sh
python3 -m venv /tmp/star-view-catalog-venv
/tmp/star-view-catalog-venv/bin/python -m pip install -r scripts/catalog-requirements.txt
```

With dependencies already installed, these commands are offline and make no changes:

```sh
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py default
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py build --check
/tmp/star-view-catalog-venv/bin/python -m unittest scripts.tests.test_catalog_sources
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest1000.py build --check
python3 scripts/author-bright-stars.py
```

To generate the same three package files into a fresh authoring directory:

```sh
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py build --output /tmp/star-view-rebuilt-catalog
```

The build verifies the input checksum and policy revision, all 160 candidates' required astrometry, 155 eligible/five excluded records, two approved tentative-default exceptions, duplicate IDs/names, exact equality of all 22 frozen default rows plus M-dwarf supplements with the current default catalog, all constellation assignments, the boundary fixture and exact count/cutoff. It refuses to overwrite existing output without `--force`. The `--check` mode compares all three files, including provenance, byte for byte. IERS auto-download is disabled. The default helper's `--write` mode only appends missing constellation and physical columns and fills blank physical fields from the frozen M-dwarf supplements, after asserting that all existing field values are unchanged (notes may only gain a source sentence); the source-reviewed NASA Sun edit is not a generic runtime fallback.

For this policy-only correction, the five original raw-download SHA-256 values were verified unchanged before regenerating decisions/checksum with the updated helper. All 160 raw candidate records, 141 CNS5 audit rows/matches, 22 default rows, calibration values and source metadata were then compared unchanged. With those same already-downloaded snapshots, the intentional regeneration commands are:

```sh
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py freeze /tmp/star-view-nearest100-sources --force
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py build --force
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py build --check
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
/tmp/star-view-catalog-venv/bin/python scripts/refresh-catalog-sources.py nearest-1000 \
  --output /tmp/star-view-nearest1000-refresh --retrieved YYYY-MM-DD
```

The command writes corrected CNS5, exact SIMBAD/Gaia TAP exports, ordered ADQL text, source releases, retrieval date, and SHA-256 checksums. It refuses existing output unless `--force` is supplied. Review cardinality, classifications, component/system identities, physical-property flags, and the cutoff before replacing `catalog-work/nearest-1000`; then run `author-nearest1000.py build --force` and `build --check`.

The M-dwarf supplements refresh separately. It downloads the Cifuentes ReadMe and table, rebuilds `crossmatch.csv` from the frozen nearest-1000 SIMBAD export and nearest-100 identities, and queries 2MASS by exact designation in chunks of 200:

```sh
/tmp/star-view-catalog-venv/bin/python scripts/refresh-catalog-sources.py physical-supplements \
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
/tmp/star-view-catalog-venv/bin/python scripts/author-nearest100.py inspect /tmp/star-view-nearest100-sources
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
