# Nebula census to 2000 ly: status and batch procedure

Working notes for extending the nebula overlay (`src/data/overlays/nebulae/`) from the original 500-ly census to 2000 ly in reviewed batches. Read this before adding a batch; `docs/catalog-sourcing.md` documents the sourcing rules in prose.

## Status (2026-11-04)

89 nebulae in the overlay: 59 reflection nebulae, 14 H II regions, 16 planetary nebulae, 11,972 puffs, 21.2 KB brotli payload.

| Part | Rows | Where they come from |
|---|---|---|
| Hand-authored 500-ly census + Orion Nebula | 22 | `src/data/overlays/nebulae/objects.json`, never regenerated |
| Batch 1 (2026-11-03) | 24 | `catalog-work/nebulae/additions.json`, entries 1–24 |
| Batch 2 (2026-11-04) | 25 | `catalog-work/nebulae/additions.json`, entries 25–49 |
| Batch 3 (2026-11-04) | 18 | `catalog-work/nebulae/additions.json`, entries 50–67 |

Batch 1 covered the large and famous objects: Lambda Orionis, Flame + IC 434 (Sh 2-277), California, Flaming Star, Sh 2-1, Sh 2-9, IC 63, Running Man, M78, NGC 2071, NGC 2023, Witch Head, NGC 1333, IC 348, IC 59, Iris, Helix, Dumbbell, NGC 1360, Medusa, Abell 31, Abell 7, Abell 36 and PuWe 1. Batch 2 added 23 van den Bergh reflection nebulae (vdB 1, 4, 9, 16, 18, 24, 29, 31, 37, 38, 42, IC 420, 49, 50, IC 432, IC 435, IC 1287, 127, 134, 141, 149, 150, 152) plus Sh 2-68 and PFP 1. Batch 3 added the queued vdB 138 and vdB 151; Ced 184, IC 4591, IC 426 and LBN 472; the southern NGC 6726/6727, IC 4812, Toby Jug Nebula (IC 2220) and vdBH 7; W40 (Sh 2-64), Sh 2-126 and Sh 2-174; and the planetary nebulae IsWe 1, LoTr 5, MWP 1, TK 1 and WeDe 1.

Seven H II regions are shaped by H-alpha masks: `lambda-orionis-nebula`, `sh-2-277`, `california-nebula`, `flaming-star-nebula`, `sh-2-1`, `sh-2-9` and `sh-2-126`.

The original estimate of 110–150 objects for the complete census was too high. Batch 3 was planned as 25 objects, but only 18 passed the rules after systematic surveys of Magakian (2003), Cederblad, van den Bergh & Herbst (1975), Chornay & Walton (2021) and the SIMBAD distances of Sharpless regions. Few qualifying objects are likely to remain.

## What is missing

Both van den Bergh catalogues are now exhausted: every nebula at least 5 arcmin across within 2000 ly in van den Bergh (1966) and van den Bergh & Herbst (1975) is in the overlay or excluded below. The other surveys in the batch 3 summary above are finished too.

Still open:
1. **Sharpless regions with no distance in SIMBAD**: about 35 of the 313 have no `mesDistance` row. Check them through their ionizing stars.
2. **Southern sizes for Chamaeleon I**: Ced 110 and Ced 111 have a good star parallax (about 180 pc) but no catalogued size. A measured size from a modern reference would qualify them.
3. **Planetary nebulae with no size**: HaWe 5, TK 2, HDW 1, KPD 0311+4801, PN G134.3+02.5 and PN G093.1+05.3 have good parallaxes, but neither SIMBAD nor Chornay & Walton lists a diameter. HASH itself needs a registered login.

Decisions for the user, not yet taken:
- **Barnard's Loop (Sh 2-276)**: published distances disagree (about 170 pc against about 440 pc). Deferred until one is adopted.
- **Gum Nebula and Vela supernova remnant**: not in NGC/IC, vdB, Sharpless or HASH, and supernova remnants are not a nebula type yet. Both need a policy change.

Excluded after review (do not re-add): M43 (inside the Orion Nebula footprint); NGC 1788 and NGC 246 (under 5 arcmin); vdB 5, 34, 36, 99 and 104 (reflection light of nebulae already drawn); vdB 88, 95 and 154 (parallax errors comparable to the parallax); vdB 93 (Gaia puts HD 53367 at 129 pc, but it belongs to CMa R1 at about 1 kpc); vdB 48 (716 ± 112 pc on a poor parallax); Abell 24 and ARO 121 (about 720 and 940 pc); K 2-2 (830 pc); FP J1824-0319 and FP J1912-0331 (possible PNe only); NGC 6729 (2.5 arcmin); NGC 1579, NGC 1999 and IC 2087 (Lynds 3, 2 and 4 arcmin); Abell 28 (4.47 arcmin); HDW 4 and K 1-6 (about 3 arcmin); Abell 74 (distance minus error 620 pc); NGC 1990 and Sh 2-129 (poor parallaxes); NGC 2626 (926 pc); vdBH 81; Cederblad nebulae whose named star is foreground (IC 1318, IC 5068, IC 5070, NGC 7000, Ced 45, IC 430, Ced 47, IC 4706); Cederblad-only entries that Magakian dropped (Ced 106, 122, 145, 214); reflection light of b Sco, 2 Sco and HD 147702 inside Sh 2-1 and Sh 2-9; and the unnamed LBN patches near mu Tau and HD 75649. The `deferred` block of `additions.json` records the same reasons.

## Inclusion rules

- Type: reflection nebula, H II region or planetary nebula listed in NGC/IC, van den Bergh, van den Bergh & Herbst, Sharpless or HASH, or in Lynds with a Cederblad or Dorschner & Gürtler identification; dark nebulae and molecular clouds belong to other overlays. Follow Frew & Parker (2010) for planetary-nebula mimics: Abell 35 and Sh 2-174 are typed as H II regions.
- Size at least 5 arcmin; adopted distance minus its 1-sigma error at most 613.2 pc (2000 ly).
- **Distance**: SIMBAD-adopted parallax of the illuminating or central star (`2020yCat.1350....0G` is Gaia EDR3, `2007A&A...474..653V` Hipparcos 2007). If that parallax is unreliable or the star is embedded, use a Gaia DR2 cluster parallax (Cantat-Gaudin & Anders 2020 or Cantat-Gaudin et al. 2020) or VLBA parallaxes (Dzib et al. 2026 for Orion). Reject parallaxes that contradict well-established membership, such as vdB 93, and stars that are foreground to the nebula, such as Deneb for NGC 7000. Before adopting a Cederblad star, check that Magakian (2003) also links it to the nebula.
- **Size**: Lynds (LBN) for named NGC/IC nebulae, Sharpless for H II regions, the SIMBAD-adopted angular diameter for PNe (HASH radius from Chornay & Walton 2021 when SIMBAD has none or an obvious non-nebular value, as for LoTr 5), twice the van den Bergh maximum radius in the north, and the van den Bergh & Herbst blue-plate diameter or ESO/Uppsala (VizieR VII/34) south of the Lynds limit. A catalogued major axis of at least 5 arcmin qualifies. Without a measured orientation, draw an equal-area circle.
- **Position**: the SIMBAD nebula position when the nebula has its own record; otherwise the illuminating star. Use the star when the SIMBAD position is rounded to 0.1 degree. Check SIMBAD against the catalogue position for large regions: SIMBAD has Sh 2-126 2 degrees from Sharpless, so that row uses the precessed Sharpless position.
- **Palette**: van den Bergh's observed nebula colour (`vB`/`mB`/`B` → `hot_star_dust`, `I` → `neutral_dust`, `mR`/`R`/`vR` → `warm_star_dust`); otherwise the illuminating star's class. Use `ionized_gas` for H II regions and `planetary_shell` for PNe.
- **Brightness**: the vdB surface-brightness class (`vBr`/`vB` 0.85, `Br`/`B`/`M` 0.7, `F` 0.55, `vF` 0.4). Masked H II regions derive brightness from the peak H-alpha excess automatically. For Lynds-sized nebulae use the LBN class (1: 0.85, 2–3: 0.7, 4–5: 0.55, 6: 0.4). Use 0.55 when no class exists, and 0.35 for faint PNe and PN mimics.
- **Notes** follow the style of existing cards: one or two plain sentences. Verify any directional claim against coordinates; batch 2 caught a wrong "south-east". vdB type II nebulae get the standard sentence that the star lies outside the nebulosity.

## Batch procedure

Network: the CDS main sites were unavailable during batches 1–3. Use the SIMBAD mirror `https://simbad.cfa.harvard.edu/simbad/sim-tap/sync`. Query `ident.id IN (...)` rather than `basic.main_id IN (...)`, which times out there; retry on HTTP 504. For VizieR, `http://vizier.nao.ac.jp/viz-bin/asu-tsv` (plain HTTP) returns whole tables, but its database connection comes and goes, so retry when the response contains `Error=`. Pass `-out.all=1`, because an empty `-out.all` drops columns. The van den Bergh & Herbst table is only in the ADS scan: `https://articles.adsabs.harvard.edu/pdf/1975AJ.....80..208V`.

1. **Inputs.** Append the reviewed objects to `catalog-work/nebulae/additions.json` in the same compact style. Record exclusions and their reasons in `deferred`. If you take parallaxes from a positional cross-match, confirm each one belongs to the named star: batch 2 first picked XY Per B instead of XY Per.
2. **Masks** (only for new `"mask"` entries): download `lambda_halpha_fwhm06_0512.fits` from LAMBDA (sha256 is in the script) to the scratchpad, then run `python3 scripts/author-nebulae.py --masks <fits>`. Render the masks to an image and look at them before continuing.
3. **Overlay.** `python3 scripts/author-nebulae.py` regenerates `objects.json` and the manifest counts; `--check` runs inside `npm run catalog:check-authored`. Update `cutoffPolicy`, `sources` and `snapshot` in `manifest.json` by hand when the rules or sources change.
4. **Identities (append-only).**
   - Query the new designations with the `extended.adql` statement shape and append the rows to `catalog-work/object-designations/extended.csv`.
   - Append the statement to `extended.adql` and update the checksums plus an `extensions` entry in `source-manifest.json`.
   - Drop rows whose `main_id` is a star. SIMBAD attaches `VDB n`, `VdBH n` and some `LBN` and `DG` numbers (LBN 472, DG 174) to the illuminating star, and `Sh 2-9` resolves to sigma Sco. Otherwise existing star records change.
   - Add the SIMBAD form of a PN name to `designations` where it differs (`PN IsWe 1`, `PN LoTr 5`). Names whose main ID has no recognised prefix (`TK 1`, `MWP 1`, `PFP 1`) get no `simbadId` from `author-object-designations.py`.
   - Run `python3 scripts/author-object-designations.py`. Compare `object-designations.json` with HEAD: only new IDs may appear. Add a `preferred-names.json` entry when SIMBAD offers an obscure name (as with IC 348's "Gingrich 1").
5. **Object stats (append-only).**
   - Query the classifications of the new `simbadId`s with the same statement shape and append them to `catalog-work/object-stats/simbad.csv`/`.adql`, updating checksums and an `extensions` entry.
   - `src/data/object-stats.json` was already stale at HEAD on 2026-11-03: a full `author-object-stats.py` run adds about 7,800 unrelated entries. Run it, copy only the new nebula entries into the previous file, and update the `simbad.csv`/`simbad.adql` checksums.
6. **Links.** `python3 scripts/author-object-links.py --extend --retrieved <date>` fetches Wikidata and Wikipedia records only for new identifiers.
7. **Checksum followers.** `python3 scripts/author-surface-gravity.py` and `python3 scripts/author-stellar-companions.py --write`. These record checksums of the identity and stat files, so only those checksum lines may change.
8. **Verify.**
   - `npm run catalog:generate` and `npm run catalog:validate:generated` (includes the preservation audit).
   - Update the counts in `src/nebula.test.ts`.
   - `npx vitest run src/nebula.test.ts`, `npm run build` and `npx playwright test e2e/nebulae.spec.ts`.
   - Screenshot a few new objects in the preview build. Do not run the full suite without the user's authorization.

Failures already present at HEAD, unrelated to nebulae:
- `e2e/molecular-cloud-rendering.spec.ts` fixture: the bundle splits into chunks the route does not serve.
- `e2e/preference-state.spec.ts:70`: the `Labels` locator is ambiguous.
- 10 tests in `src/catalog.test.ts` and `src/catalogs.test.ts`.
- `author-object-stats.py --check`.

## Rendering notes

- Nebulae render through the half-resolution pass in `src/nebula-layer.ts` (`halfResolution` option, `renderOffscreen` called from `viewer.ts` before the main render). RGB holds display-encoded screen-blended light; alpha holds the nearest puff view depth through MIN blending. A full-screen composite in the scene writes `gl_FragDepth`, so planets occlude nebulae and molecular-cloud absorption still sorts correctly.
- Masked nebulae place one puff per lit mask pixel in seeded-shuffled order, so LOD prefixes stay unbiased. Opacity is proportional to the pixel value, the kernel is 2 mask pixels, and the depth profile is a filled sphere (or a shell surface for `kind: "shell"`). The mask must use position angle 0, with rows toward Galactic north and columns toward increasing longitude.
