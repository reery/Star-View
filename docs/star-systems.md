# Multiple-star cards

The selected-object card uses the shared system name for separately cataloged
stellar components. The small distance sits beside the name, and component
buttons directly below that line select the actual component
record, including its physical properties, source notes, coordinates, and motion.
Selecting a system from the scene or Object Browser opens A, or Aa where the
primary is itself resolved. This resets on each new selection, independently of
the previously selected system's component. Explicit component buttons, selection
history and saved views retain individual component identities. Switching buttons
preserves the card's expanded state.

The header's bottom border contains icons for Specs (list), Info (book), and
System (orbit), with accessible names, hover labels, and the lock buttons'
orange selected color and subtle hover tint. This row stays below the identity
when the content expands beneath it. Specs expands the existing
properties, designations, coordinates, and source notes. Clicking the active
control collapses the card. Info and System are disabled when no content is
available. System shows the adopted planets and resolved stellar pairs; see the
[stellar orbit data and visualization policy](stellar-orbits.md).

`src/star-systems.ts` indexes resolved component names with matching prefixes and
letter suffixes, including hierarchical labels such as Ba and Bb. Proxima
Centauri is explicitly linked as Alpha Centauri C, following
[ESO's system membership determination](https://www.eso.org/public/announcements/ann16089/).
Theta1 Orionis A–D are excluded: the famous-cluster source notes describe them
as four separate Trapezium systems.

`src/data/star-systems.json` explicitly links the five approved nearby systems by stable
catalog IDs: GJ 725, GJ 15, Kruger 60, GJ 412, and Keid (40 Eridani). Each
association records the frozen 10pc census system ID, source rows, and original
component names. GJ 725's A/B labels also reference the corrected CNS5 component
records. These associations apply to nearest-100 and nearest-1000, which share
the curated IDs. Common names such as DO Cep and DY Eri remain on the underlying
records and in the Object Browser. Their component buttons select B and C directly.

The manifest also associates Fomalhaut A (`cns5-5665`), B (`cns5-5660`), and
C (`cns5-5623`) in
nearest-1000, using the published
[Fomalhaut system membership](https://arxiv.org/abs/1310.0764) and corrected CNS5
component labels. The explicit IDs handle A's unsuffixed display name and the
source's reciprocal primary pointers. Selecting Fomalhaut B or C opens that
component through its button. C's individual membership is a reviewed generator exception
in `catalog-work/nearest-1000/individual-object-overrides.json`; its measurements
come from its own exact CNS5/Gaia identity and existing physical supplements.
Reviewed companions are additive to the nearest-1000 baseline. The wider
[25 pc review](companion-expansion-25pc.md) retains every original baseline entry
and adds 36 confirmed individual components, giving 1036 non-Sun objects plus Sun.
The catalog includes hierarchical pairs such as GJ 229 Ba/Bb and Capella Aa/Ab,
and companions through C/D where supported. Source decisions and deliberately
withheld blended measurements are frozen in reviewed authoring inputs.

Only components present in the active catalog and enabled catalog overlays are
offered. The pictogram draws those records using their individual colors and
illustrative sizes. Its arrangement is decorative; it does not depict an orbit
or separation. Unresolved system rows and missing companions are not assigned
invented component properties. Original baseline membership is retained. New
close companions can share a documented approximate source-system position; no individual orbit is invented.
Selecting a new component opens its own reviewed record and nullable specs.

The [overlay expansion](overlay-companion-expansion.md) makes six reviewed systems
available through Bright stars and fourteen through Western constellation stars,
including Rigel A/Ba/Bb/C. Explicit alternate catalog IDs associate the original
HIP landmarks with the reviewed component identity. Merge logic uses that identity
to collapse repeated records of the same star while preserving distinct companions
even when their approximate positions coincide. Capella and other reviewed split
primaries use individual records and keep their original landmark names as aliases.
