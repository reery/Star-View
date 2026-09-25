# Data Reference

## Coordinate Convention

Positions use a **right-handed, Sun-centered, Galactic-aligned Cartesian frame**:

| Catalog axis | Positive direction |
| --- | --- |
| `x_pc` | Galactic longitude 0 degrees, latitude 0 degrees, toward the Galactic center |
| `y_pc` | Galactic longitude 90 degrees, latitude 0 degrees |
| `z_pc` | North Galactic pole |

The reference plane is `z_pc = 0`, passing through the Sun. It is not a claim about the physical Galactic midplane or the Sun's offset from it. This is not a Galactocentric frame.

The renderer maps `(x_pc, y_pc, z_pc)` to Three.js Y-up coordinates `(x_pc, z_pc, -y_pc)`. One scene unit equals one parsec on every axis, with no height exaggeration. A parsec is approximately 3.26156 light-years. Grid spacing follows the visibility-distance band: 0.5 pc through 100 ly, then 1, 2, 5, 10, and 20 pc at 150, 200, 300, 500, and 1000 ly.

A selected object has a direct Sun-to-object line and, when off the plane, a dashed perpendicular height line to a square projection marker. The faint dashed in-plane line completes the spatial triangle. The square is a measurement marker, not another object. Selecting the Sun removes the zero-length guides.

Only the Sun-distance text is shown on the map; the height text (such as “0.40 pc below”) is omitted. The distance label stays in the foreground centered on the direct line's midpoint, with its dark backing interrupting the line. It remains on the line even when the projected endpoints are close, clamps only at the scene edge, and reserves its bounds so ordinary object names yield to it.

## CSV Data

The default data stays in [src/data/stars.csv](../src/data/stars.csv). Other packages have sibling `catalog.json` and `stars.csv` files under `src/data/catalogs/<id>/`. `npm run catalog:generate` validates those tracked sources and creates ignored runtime JSON under `src/data/generated/`; development and production builds run it automatically. This version has no browser-upload UI. For repeatable multi-source research, frozen inputs, native authoring, provenance and validation commands, see the [catalog sourcing guide](catalog-sourcing.md).

All original 16 headers must occur exactly once; `constellation` is optional for legacy/custom files. Enriched files may append the complete raw-astrometry group below. A partial raw group and unknown/duplicate headers are rejected.

```csv
type,id,name,spectral_type,x_pc,y_pc,z_pc,vx_kms,vy_kms,vz_kms,temperature_k,mass_solar,luminosity_solar,absolute_mag,epoch,notes,constellation
```

```csv
ra_deg,dec_deg,astrometry_epoch,parallax_mas,parallax_error_mas,pm_ra_cosdec_masyr,pm_ra_error_masyr,pm_dec_masyr,pm_dec_error_masyr,radial_velocity_kms,radial_velocity_error_kms,astrometry_ref,radial_velocity_ref
```

Optional physical-property columns may also be appended independently:

```csv
radius_solar,metallicity_dex,age_gyr
```

Raw astrometry is source-epoch ICRS data. `pm_ra_cosdec_masyr` includes `cos(dec)`. Parallax must be positive; uncertainties are nonnegative. Radial velocity and its source may be blank, but are never replaced by zero. The common Cartesian `epoch` remains the static J2000 map snapshot and is distinct from `astrometry_epoch`.

| Field | Meaning |
| --- | --- |
| `type` | Required object class: `star`, `white_dwarf`, `brown_dwarf`, or `sub_brown_dwarf` |
| `id` | Required, unique string; `sun` is reserved for the reference Sun |
| `name` | Required display name |
| `spectral_type` | Optional spectral classification |
| `x_pc`, `y_pc`, `z_pc` | Required finite coordinates in parsecs |
| `vx_kms`, `vy_kms`, `vz_kms` | Optional Cartesian velocities, relative to the Sun, along the same axes in km/s |
| `temperature_k` | Optional, positive effective temperature in kelvin; estimates distinguished in source notes |
| `mass_solar` | Optional, positive mass relative to the Sun |
| `luminosity_solar` | Optional, positive bolometric luminosity relative to the Sun |
| `radius_solar` | Optional, positive radius relative to the Sun |
| `metallicity_dex` | Optional stellar metallicity in dex; bundled Gaia values are GSP-Phot `[M/H]` model estimates |
| `age_gyr` | Optional, positive age in billions of years |
| `absolute_mag` | Optional Johnson V absolute magnitude, not bolometric magnitude |
| `epoch` | Required decimal Julian year of the coordinate snapshot; initially `2000.0` |
| `notes` | Optional source and object notes; quote cells containing commas or newlines |
| `constellation` | Optional full canonical IAU name; blank for Sun |

The Sun must be present at `(0, 0, 0)`, with velocities zero or blank. All rows must share an epoch. Blank optional values mean **unknown**, never zero. Values must use finite decimal numbers, optionally with an exponent. Signed coordinates, velocities, and magnitudes are valid. Invalid catalogs produce a record/field error instead of silently omitting objects. CSV text is rendered as text, not HTML.

The epoch describes the astrometric snapshot, not the observation date of every physical parameter. Positions are static; neither proper motion nor binary orbits are propagated to the current date. A radial velocity is not interchangeable with a Cartesian velocity component.

Constellations are the Earth-view IAU regions at the adopted snapshot, assigned offline from sky directions using the IAU Roman/Delporte boundaries. They do not change with visibility observer, units or camera orientation. Every non-Sun object in all four bundled catalogs has one, even without V photometry. Sun displays Not applicable; a legacy/custom unknown displays Not available. Boundary-frame transformation is not physical motion propagation to 1875.

## Catalog Policy And Provenance

The default sample ranks individual stellar and substellar objects beyond the Sun, rather than systems. It includes hydrogen-fusing stars, Sirius B, the Luhman 16 brown dwarfs, and WISE 0855-0714. The nominal rank-20 boundary cuts through the co-distant EZ Aquarii triple, so all three components are retained: 21 objects beyond the Sun, 22 rows total. Its historical row order is preserved. Nearest-100 keeps those rows as curated overrides over an audited 10pc census with CNS5 crosschecks. Nearest-1000 uses CNS5 membership with exact SIMBAD and Gaia DR3 enrichment and keeps all nearest-100 rows as higher-curation overrides. Bright stars is a representative landmark set rather than a complete census: it retains familiar named stars within 1000 light-years at approximately absolute Johnson V +2 or brighter, with Altair (+2.21) as a deliberate boundary exception. Cutoffs, exclusions, uncertainties, and frozen source versions are recorded in the [sourcing guide](catalog-sourcing.md).

Positions combine J2000 Galactic directions from [SIMBAD](https://simbad.cds.unistra.fr/simbad/) with selected parallaxes. Gaia EDR3/CNS5 values are used where suitable; dedicated measurements are retained for systems Gaia does not resolve cleanly or objects it does not measure well. Those sources include Akeson et al. (2021) for Alpha Centauri AB, Bedin et al. (2024) for Luhman 16, Kirkpatrick et al. (2021) for WISE 0855-0714, [Bond et al. (2017)](https://arxiv.org/html/1703.10625) for Sirius, the GRAVITY Collaboration (2024) for Luyten 726-8, and Torres et al. (2010) for EZ Aquarii. Each CSV row names its adopted source.

Temperatures use directly published values where available and spectral-class estimates otherwise. The Sun uses [NASA Sun facts](https://science.nasa.gov/sun/facts/) and the nominal effective temperature associated with [IAU 2015 Resolution B3](https://arxiv.org/abs/1510.07674). Main-sequence class estimates follow the [Pecaut-Mamajek dwarf sequence](https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt). Nearest-1000 radii, metallicities and ages use Gaia DR3 model outputs when they pass the documented source policy. Bright-stars physical values use frozen SIMBAD bibliographic measurements, the Allende Prieto–Lambert Hipparcos model catalog, McDonald et al. Hipparcos SED models, and two component-specific primary papers. Blank optional fields mean the source set did not justify a value.

Coordinates are derived as `d = 1 / parallax`, `x = d cos(b) cos(l)`, `y = d cos(b) sin(l)`, and `z = d sin(b)`. Close components share a system position when their physical separation is below this catalog's spatial precision; separation is not exaggerated for display. The app derives all distance and height readouts from the loaded coordinates. Positions are a curated static snapshot, source uncertainties are not modeled, and the catalog is not a precision ephemeris.

## Motion Sources And Conversion

The default catalog velocities cover nine individually measured stars and both Sirius components. The following adopted inputs were verified through [SIMBAD TAP](https://simbad.cds.unistra.fr/simbad/sim-tap), using `basic.ra`, `dec`, `pmra`, `pmdec`, `rvz_radvel`, `pm_bibcode`, and `rvz_bibcode`, joined to `ident` by `basic.oid = ident.oidref`. Coordinates are ICRS directions in degrees; proper motions are in mas/year, with RA motion already including cos(dec). Radial velocity is positive away from the Sun, in km/s. Distances are the norms of the existing bundled positions, not a newly adopted parallax set. Additional catalog motions and propagation assumptions are documented separately in the sourcing guide.

| Object / SIMBAD identifier | RA | Dec | RA motion | Dec motion | Adopted RV | RV reference |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Proxima Centauri / GJ 551 | 217.42894222 | -62.67949019 | -3781.741 | 769.465 | -20.578199 | J20 |
| Barnard's Star / GJ 699 | 269.45207696 | 4.69336497 | -801.551 | 10362.394 | -110.11 | F18 |
| Wolf 359 / GJ 406 | 164.12050363 | 7.01472313 | -3866.338 | -2699.215 | 19.57 | F18 |
| Lalande 21185 / GJ 411 | 165.83414508 | 35.96988227 | -580.057 | -4776.589 | -84.64 | F18 |
| Sirius A and B / HIP 32349 | 101.28715533 | -16.71611586 | -546.01 | -1223.07 | -8.47 | B17 |
| Ross 154 / GJ 729 | 282.45568240 | -23.83623538 | 639.368 | -193.958 | -10.494 | S18 |
| Ross 248 / GJ 905 | 355.47931792 | 44.17744970 | 112.527 | -1591.65 | -77.51 | F18 |
| Epsilon Eridani / GJ 144 | 53.23268538 | -9.45826097 | -974.758 | 20.876 | 16.376 | S18 |
| Lacaille 9352 / GJ 887 | 346.46681577 | -35.85307088 | 6765.995 | 1330.285 | 8.82 | S18 |
| Ross 128 / GJ 447 | 176.93498862 | 0.80455565 | 607.299 | -1223.028 | -30.66 | F18 |

Proper motions use [Gaia EDR3 (2020yCat.1350....0G)](https://ui.adsabs.harvard.edu/abs/2020yCat.1350....0G/abstract), except Sirius, which uses [van Leeuwen 2007 Hipparcos (2007A&A...474..653V)](https://ui.adsabs.harvard.edu/abs/2007A%26A...474..653V/abstract). Radial-velocity references are [J20 (2020AJ....160..120J)](https://ui.adsabs.harvard.edu/abs/2020AJ....160..120J/abstract), [F18 (2018MNRAS.475.1960F)](https://ui.adsabs.harvard.edu/abs/2018MNRAS.475.1960F/abstract), and [S18 (2018A&A...616A...7S)](https://ui.adsabs.harvard.edu/abs/2018A%26A...616A...7S/abstract).

B17 is [Bond et al. (2017), section V.1](https://arxiv.org/html/1703.10625#S5.SS1), which uses the Hipparcos proper motion and gives the true Sirius systemic radial space-motion component as -8.47 km/s after correcting the spectroscopic -7.70 km/s for Sirius A's gravitational redshift. This replaces the SIMBAD basic RV for Sirius. Both components explicitly inherit this same system vector; neither component's orbital velocity nor Sirius B's gravitational redshift is used.

For RA `alpha`, declination `delta`, distance `distancePc`, proper motions `pmra`, `pmdec`, and radial velocity `rv`, the offline conversion is:

```text
radial = (cos(delta) cos(alpha), cos(delta) sin(alpha), sin(delta))
east   = (-sin(alpha), cos(alpha), 0)
north  = (-sin(delta) cos(alpha), -sin(delta) sin(alpha), cos(delta))
equatorialVelocity = rv * radial + 4.74047 * distancePc / 1000 * (pmra * east + pmdec * north)
galacticVelocity = rotation * equatorialVelocity
rotation = [ -0.0548755604  -0.8734370902  -0.4838350155
              0.4941094279  -0.4448296300   0.7469822445
             -0.8676661490  -0.1980763734   0.4559837762 ]
```

This is the conventional ICRS-to-Galactic rotation. No local-standard-of-rest or solar Galactic-orbit correction is added to the CSV values. Components are rounded to 0.001 km/s for storage, not as an uncertainty claim. Apart from the explicit Sirius correction, published spectroscopic radial velocities are used as space-motion estimates; source epochs and spectroscopic systematics are not homogenized. These are illustrative headings for the static snapshot, not precision epoch-propagated velocities. The unit tests invert the rotation and recover each adopted proper motion and RV within storage-rounding tolerance.

Alpha Centauri AB, Luyten 726-8 AB, and EZ Aquarii ABC retain no adopted full Cartesian velocity because this source set has no consistently paired systemic astrometric/RV solution for them. Luhman 16 and WISE 0855-0714 lack radial velocities in the queried system records, so their raw proper motions produce dashed transverse arrows. This is not a claim that no measurements exist elsewhere. Unverified component values are not substituted or averaged; the Sun retains its zero reference vector.

## Arrow Reference Frame

Only the arrow rendering converts the stored Sun-relative velocities to approximate Galactic rest-frame velocities: `arrowVelocity = catalogVelocity + solarVelocity`, before the `(x, y, z) -> (x, z, -y)` renderer mapping. Every known vector receives the same offset, preserving relative velocities. The Sun's arrow uses `solarVelocity` directly, including when its reference velocity fields are blank. Unknown velocities of other objects are not replaced by solar motion.

The adopted solar vector is `(12.9, 245.6, 7.78) km/s`, from the documented [Astropy v4.0 Galactocentric defaults](https://docs.astropy.org/en/stable/api/astropy.coordinates.galactocentric_frame_defaults.html). It includes Galactic rotation, not just the Sun's peculiar velocity relative to nearby stars. For this illustrative nearby-star display, its axes are treated as aligned with the catalog's Galactic axes; the small Galactocentric-axis tilt due to the Sun's height above the Galactic plane is neglected. This is a local direction approximation, not a full Astropy coordinate transformation or a modeled Galactic orbit. Astropy is a parameter source, not a runtime dependency.

Positions, Sun-to-star distances, CSV velocity fields, and inspector velocity readouts remain Sun-relative. Consequently the Sun retains zero catalog velocity while having a nonzero Galactic-motion arrow. No positions, epochs, or binary orbits are propagated.
