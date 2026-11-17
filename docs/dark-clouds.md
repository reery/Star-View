# Clouds and dark nebulae within 1000 ly

How the molecular-cloud overlay (`src/data/overlays/molecular-clouds/`) was extended beyond the 65 Cahlon et al. (2024) features, and how to rebuild it. Read this before changing the dust data.

## Status (2026-11-16)

| Part | Rows | Source |
|---|---:|---|
| Cahlon et al. (2024) clouds | 65 | Leike et al. (2020) map, unchanged |
| Added clouds within 1000 ly | 50 | Edenhofer et al. (2024) map |
| Corona Australis | 1 | Zucker et al. (2021) cutout of the Leike map |
| Dark nebulae within 1000 ly | 607 | Lynds (1962), Feitzinger & Stüwe (1984), Barnard (1927) |

433 dark nebulae are drawn with a cloud's dust; 174 carry their own map voxels. Display samples grew from 19,606 to 26,781.

## Clouds

- The Edenhofer et al. (2024) mean map (`mean_and_std_healpix.fits`, Zenodo 8187943, 3.2 GB, md5 `10c823a5fcf81b47b6e15530bcdf54dc`) is resampled to a one-parsec grid within 360 pc. Densities use A_V = 2.8 E(ZGR23) and N_H/A_V = 2.21 × 10²¹ cm⁻², about 2005 cm⁻³ per E/pc. Integrated over the Taurus, Perseus and Corona Australis cutouts, the Leike densities Cahlon used give 1650–2450 times E, so the boundary means the same in both maps.
- Segmentation follows Cahlon et al.: 6-connected voxels above n_H = 25 cm⁻³, at least 150 voxels. Their 500 M☉ floor is not applied; it drops clouds such as Lupus 1, Pegasus and Hercules. Only structures centred within 1000 ly are added.
- Voxels within 6 pc of a Cahlon cloud are already drawn. A remaining structure covering half its sky (Nside 16 cells) with a drawn cloud at a distance within 50% is that cloud displaced between the maps and is skipped (15 cases).
- Corona Australis: Edenhofer places most of its dust at about 224 pc, while Zucker et al. (2020) and the Gaia distances of its young stars put it at about 150 pc. Its geometry comes from the Leike cutout of Zucker et al. (2021, Dataverse file 4327240), which is already in n_H: the cloud body and the head around R CrA, the two pieces above 25 cm⁻³ with at least 100 voxels.
- Names: a cloud without a published complex takes one only from evidence. A Zucker et al. (2020) sightline through its voxels at the measured distance names its complex; otherwise the largest dark nebula it holds names it ("LDN 590 Cloud"); MBM 12 is the one curated name. Cahlon's style applies: "Pegasus Molecular Cloud" for a lone member, "Coalsack - Cloud 30" otherwise; Aquila Rift features are always named as parts. Published `complex_name` values are never changed; the association is a separate field.

## Dark nebulae

- Sources: Lynds (VizieR VII/7A; 7 rows without an LDN number are skipped), Feitzinger & Stüwe (VII/68A, Galactic longitude 240–360°, merged into a Lynds record whose outline holds its centre) and the Barnard objects no Lynds row lists (VII/220A).
- Distance: the nearest dust layer, along the nebula's outline, where it holds more dust than a ring around it, with at least half the column of the strongest such layer and a contrast column of at least 100 cm⁻³ pc (A_V ≈ 0.14 mag). A nebula without contrast at the map's 14′ resolution, such as Barnard 68, is placed by a single layer holding at least 80% of the layered dust, only at |b| ≥ 3°, where the map's 1.25 kpc hold nearly all the dust along the sightline.
- A Zucker et al. (2020) distance measured inside the nebula replaces the map distance when they agree within 25%. When it disagrees, the nebula is kept only where a drawn cloud fills its outline at the measured distance (Corona Australis); otherwise it is left out and listed under `conflictingDistances` (16 nebulae, mostly toward M8, M16, M20 and IC 1396, where Zucker measured a distant cloud).
- Against the Zucker distances, the map layers have a median offset of +0.8% and a median absolute difference of 5%.
- Anchoring: the cloud with the most voxels inside the outline (at least 0.3°) within max(15 pc, 15%) of the layer. Where the layer is an Edenhofer copy of a drawn Leike cloud, the nebula takes the Leike voxel distance. A nebula no cloud holds keeps its own map voxels above half the layer's peak density; their opacity is scaled down below the 25 cm⁻³ boundary.

## Left out

- The local interstellar clouds around the Sun (Redfield & Linsky 2008): only sky footprints and velocities are measured, not their 3D extent, and at A_V ≈ 10⁻⁴ mag they are invisible in every band.
- Hartley et al. (1986) southern dark clouds: not on the reachable VizieR mirrors with their original sizes. South of the Lynds limit the Feitzinger & Stüwe longitudes 240–360° are covered; Corona Australis and the other far-southern clouds appear as clouds only.

## Rebuild

1. Collect the inputs in one directory: `mean_and_std_healpix.fits`, `Galactic_Positions_For_All_Filtered_Clouds_Table1_Cahlon2023.fits` (Dataverse 7280031), `coraus_3D_density.fits` (Dataverse 4327240) and the VizieR tables `VII_7A.tsv`, `VII_220A.tsv`, `VII_68.tsv` and `J_A_A_633_A51.tsv` (asu-tsv, `-out.all=1`, `-out.max=unlimited`). Zenodo blocked automated downloads in November 2026; a browser download worked.
2. `python3 scripts/author-dark-clouds.py --measure <directory>` freezes `catalog-work/molecular-clouds/additions.json` (numpy and astropy; about 25 s).
3. `node scripts/author-molecular-clouds.mjs build <Table1.fits> <positions.fits>` merges it into the overlay.
4. Identities, stats and links follow the nebula procedure in [nebula-census.md](nebula-census.md): SIMBAD rows for new designations in `catalog-work/object-designations/extended.csv` (dark nebulae resolve only to cloud records; LDN 1535 resolves to a protostar), `author-object-designations.py`, `author-object-stats.py`, `author-object-links.py --extend`, then the checksum followers.
5. `npm run catalog:generate`, `npx vitest run src/molecular-cloud.test.ts src/designations.test.ts`.
