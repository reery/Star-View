# Stellar data preservation and subtype review

Reviewed 2026-10-13 across all six bundled catalogs and the shared pool of 842 components in 341 reviewed systems.

Catalog-to-component replacement previously hid known values in **164 component records**. This included 33 masses, 104 luminosities, 106 radii, 71 temperatures, 57 metallicities, 10 ages, 61 absolute/apparent magnitudes and 156 velocity vectors. These counts overlap. Furud's original Western catalog source retained luminosity 1609.358708 L☉, radius 5.76435 R☉ and absolute V −2.133963, while its component record withheld them. Its source mass was already unavailable.

Original measurements now survive in explicitly scoped `catalog_sources` snapshots, including astrometry, uncertainties and notes. There are 302 retained snapshots on 246 components, covering replaced values as well as fields unavailable for the individual component. Records whose measurements already survive are not duplicated. Incoming source records with additional measurements are also preserved during runtime completion. Exact component identities remain distinct; secondary members do not inherit the primary's source values.

The existing Specs rows display individual component values first and retained source values where individual measurements are unavailable. Values contain only measurements and units, with no source annotations. There is no additional source-measurements section. Tooltips and the existing Coordinates & source notes identify unresolved source scope. Retained source quantities never feed individual physical derivations, comparison charts or observer rendering.

Furud retains **Johnson V=2.99 ±0.01** for the unresolved Aa+Ab source in `unresolved_photometry`, from the [reviewed observation](../catalog-work/star-systems/reviewed-unresolved-photometry.json) and [SIMBAD](https://simbad.u-strasbg.fr/simbad/sim-id?Ident=ZET+CMA&bibdisplay=none&protocol=html), citing Tycho-2 (2000A&A...355L..27H), quality D. Its formal error does not quantify companion flux or variability. Individual Aa/Ab fluxes remain unavailable. Other restored source observations retain unknown errors unless reviewed evidence supplies one.

Component generation also derives supported subtype labels from each component's own final spectrum, restoring coverage on **250 previously unclassified component records**. The parser handles bright-giant class II, peculiar notation, temperature ranges with an unambiguous luminosity class and within-class ranges such as III–IIIb. Tentative classifications retain `candidate`. Unknown, composite and mixed evolutionary classes such as IV–V do not acquire an invented stage. It never transfers aggregate variability or planet labels to newly split members. Bright giant and Subdwarf explanations cite the [STScI spectral classification tables](https://archive.stsci.edu/spec_class/spec_class_tables.html).

Four previous single-stage labels inferred incorrectly from mixed spectra are explicitly corrected in [reviewed-data-retirements.json](../catalog-work/reviewed-data-retirements.json). Their spectra and other supported labels remain. The preservation guard accepts only the exact documented previous/current values for these corrections.

Data loss is checked at three boundaries:

- Companion regeneration refuses to write a pool that removes a record or makes an existing measurement, error or retained source value unavailable.
- Catalog validation verifies that every known original measurement survives effective component replacement, either as the adopted individual value or in its exact source snapshot.
- `npm run catalog:preservation` compares all bundled CSVs and components with `HEAD`, including nested uncertainties and subtype labels. Use `npm run catalog:preservation -- --base <revision>` for a different baseline. Production builds run this check automatically.

The [component audit](../catalog-work/star-systems/catalog-companions-audit.json) records `sourcePreservation`, individual property coverage, subtype/photometry gaps and frozen-input checksums. Regeneration remains offline:

```sh
python3 scripts/author-object-stats.py
python3 scripts/author-stellar-companions.py --write
npm run catalog:generate
npm run catalog:preservation
```

Focused validation covers classification/preservation guards, companion/statistics/consistency checks and Furud/subtype desktop/mobile card behavior. The final card screenshots were visually inspected. No full test suite was run.
