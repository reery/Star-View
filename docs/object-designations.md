# Object names and designations

The selected-object card shows alternate designations immediately after absolute visual magnitude, in a scrollable list. The same names are searchable in Objects, including aliases from merged catalog layers. Search accepts both spaced and compact catalog notation, such as `HD 48915` / `HD48915` and `PSR J0633+1746` / `PSRJ0633+1746`, and Greek Bayer notation such as `α Centauri C`. Positive and negative coordinate signs remain distinct.

`src/data/object-designations.json` supplies display names and alternate identifiers for all 2,188 unique IDs in the six bundled stellar catalogs and four overlays. It contains over 60,000 alternate designations. Published common names replace catalog-number and formal Bayer display names where available; familiar authored names such as Sirius A and Alpha Centauri A retain their component labels. Examples include Geminga, Vela Pulsar, Monogem Pulsar, Morla, Lich, Guitar Pulsar, Larawag and Tiaki. Original display names remain searchable.

Sources are the frozen SIMBAD identifier exports for nearby stars, western constellation figures and cluster stars; a supplemental exact-identifier SIMBAD snapshot retrieved on 2026-10-05; the [IAU star-name table](https://iauarchive.eso.org/public/themes/naming_stars/); the frozen [ATNF pulsar names](https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html); native nebula and bubble designations; molecular-cloud feature indices; and reviewed literature choices. Morla is adopted from [Marelli et al.](https://arxiv.org/abs/1212.6664). Each identity records its input sources, and the supplement records their SHA-256 checksums. Supplemental query text, exact returned records, name decisions, the extracted IAU table and acquisition checksums live in `catalog-work/object-designations/`.

Identity uses exact published identifiers, never proximity. Shared system records are not copied onto separate binary components. In particular, Luhman 16 A/B retain their component-specific Gaia DR2 identifiers instead of the Gaia DR3 identifier for the unresolved system. Some SIMBAD VdB records identify illuminating stars; those stellar identifiers are withheld from nebulae. Ambiguous Abell numbers resolving to galaxy clusters are also withheld. Pulsar aliases omit associated supernova-remnant and nebula names. Gaia BH1/BH3/NS1 aliases refer to their plotted unresolved system, as documented by the overlay's source notes. Molecular-cloud indices identify individual Cahlon segmented features, without treating each feature as an entire named cloud complex.

Some objects have only one documented designation in the adopted sources. Their alternate-name list is empty and the card hides the Designations row. This is a catalog snapshot, not a claim to contain every designation ever published.

Rebuild or compare the supplement offline with standard Python, then regenerate browser payloads:

```sh
python3 scripts/author-object-designations.py
python3 scripts/author-object-designations.py --check
npm run catalog:generate
```

Normal application builds remain offline and need no Python. `scripts/catalogs.ts` applies the supplement to every catalog and overlay before writing the browser payloads. The scientific CSVs, JSON source overlays, memberships, positions and physical values retain their original authoring recipes. Custom catalogs can supply the optional native `designations` CSV column (pipe-separated) or a `designations` string array in JSON. The generic catalog builder preserves these aliases. Legacy files may omit the field.
