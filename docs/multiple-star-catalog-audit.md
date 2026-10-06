# Multiple-star catalog audit

Audited 2026-10-05 using the current CSV catalogs, nearest-100 provenance,
the frozen 2023 10pc census, nearest-1000 provenance, and corrected CNS5.
This is a data review. No application tests, build, or validation checks were run.

This is a **historical baseline snapshot** before the five initial associations
and the subsequent catalog expansion. The original candidate tables remain as
review history. Use the [current 25 pc expansion](companion-expansion-25pc.md)
for implemented systems, added individual companions and remaining source flags.

## Existing records

| Catalog | Non-Sun records | Systems recognized by current names | Source-linked groups with at least two records |
| --- | ---: | ---: | ---: |
| nearest-neighbors | 21 | 5 | 5 |
| nearest-100 | 100 | 15 | 20 |
| nearest-1000 | 1000 | 26 | 112 |

Counts describe the active base catalog alone, without optional overlays.
Source-linked groups are candidates for component cards, not a claim that every
physical companion is separately cataloged or that the frozen membership is complete.

## Nearest neighbors

All five source-linked systems already have cards: Alpha Centauri (A/B/C),
Luhman 16, Sirius, Luyten 726-8, and EZ Aquarii. No additional source-linked
pair of existing records was found in this 21-object sample.

## Five immediate additions in nearest-100

| Proposed system | Existing records | Source identity |
| --- | --- | --- |
| GJ 725 | HD 173739 (A), HD 173740 (B) | 10pc system 17; CNS5 GJ 725 |
| GJ 15 | GX And (A), GQ And (B) | 10pc system 18; CNS5 GJ 15 |
| Kruger 60 | Kruger 60 A, DO Cep (B) | 10pc system 28; CNS5 GJ 860 |
| GJ 412 | BD+44 2051 A, WX UMa (B) | 10pc system 50; CNS5 GJ 412 |
| Keid / 40 Eridani | Keid (A), GJ 166 B, DY Eri (C) | 10pc system 54; CNS5 GJ 166 |

All five also occur in nearest-1000. They require component association metadata,
not new stars or new physical measurements. The two GJ 725 labels should retain
their HD aliases; the displayed system name can be chosen independently.

## Nearest-1000 candidates

The source grouping produces 112 candidate groups, compared with 26 recognized
by the current display-name convention. This is 86 additional groups, plus
extensions to three existing cards: 36 Oph (V2215 Oph), VV Lyn (Ross 989), and
Capella (the unresolved central AB record). The central Capella record needs
separate handling before it can be treated as individual A and B stars.

The list below contains every source group that differs from the current card
grouping. Labels and source membership need review before adoption; group keys
come from exact provenance identities, not proximity or apparent sky alignment.

| Source group | Existing records to associate |
| --- | --- |
| gj:725, census:17 | HD 173739; HD 173740 |
| gj:15, census:18 | GX And; GQ And |
| gj:860, census:28 | Kruger 60 A; DO Cep |
| gj:412, census:50 | BD+44 2051 A; WX UMa |
| gj:166, census:54 | Keid; GJ 166 B; DY Eri |
| census:75, gj:229 | GJ 229 A; HD 42581B |
| gj:570 | GJ 570 D; HD 131977 |
| gj:752 | HD 180617; VB 10 |
| gj:34 | Eta Cas B; Achird |
| gj:663 | 36 Oph A; 36 Oph B; V2215 Oph |
| gj:644 | HD 152751C; HD 152751; VB 8 |
| gj:896 | BD+19 5116A; BD+19 5116B |
| gj:338 | HD 79210; HD 79211 |
| gj:105 | HD 16160; BX Cet |
| gj:257 | CD-44 3045B; CD-44 3045A |
| gj:185 | HD 32450B; HD 32450A |
| gj:618 | CD-37 10765B; CD-37 10765 |
| gj:423 | Alula Australis; Xi UMa C |
| gj:666 | 41 Ara B; 41 Ara |
| gj:745 | Ross 730; HD 349726 |
| gj:10949 | L 32-9; L 32-8 |
| gj:867 | FL Aqr; FK Aqr |
| gj:10944 | SCR J0630-7643A; SCR J0630-7643B |
| gj:216 | AK Lep; Gamma Lep |
| gj:283 | LP 783-2; LAWD 25 |
| gj:12050 | ULAS J141623.94+134836.3; 2MASS J14162408+1348263 |
| gj:442 | HD 102365; HD 102365B |
| gj:432 | 20 Crt; 20 Crt B |
| gj:680 | CD-48 11837B; CD-48 11837 |
| gj:49 | BD+61 195; Wolf 47 |
| gj:1230 | G 184-19; G 184-19B |
| gj:569 | BD+16 2708B; BD+16 2708 |
| gj:11123 | COCONUTS-2A; COCONUTS-2b |
| gj:231 | Alpha Men B; Alpha Men |
| gj:653 | HD 154363; HD 154363B |
| gj:754.1 | L 923-22; LAWD 74 |
| gj:766 | LSPM J1945+2707NW; LSPM J1945+2707SE |
| gj:669 | Ross 867; Ross 868 |
| gj:86 | HD 13445; HD 13445B |
| gj:617 | HD 147379; HD 147379B |
| gj:9492 | G 239-25; G 239-25B |
| gj:505 | HD 115404; HD 115404B |
| gj:2036 | CD-56 1032B; CD-56 1032A |
| gj:27 | 54 Psc B; 54 Psc |
| gj:107 | Theta Per B; Theta Per |
| gj:537 | BD+47 2112A; BD+47 2112B |
| gj:356 | 11 LMi; 11 LMi B |
| gj:12887 | PM J19515-3510A; PM J19515-3510B |
| gj:4048 | G 204-57; G 204-58 |
| gj:208 | V2689 Ori; PM J05366+1117 |
| gj:568 | Ross 52A; Ross 52B |
| gj:3417 | G 250-31B; G 250-31A |
| gj:494 | BD+13 2618C; BD+13 2618 |
| gj:4 | HD 38B; HD 38A |
| gj:325 | HD 75632A; HD 75632B |
| gj:189 | Zeta Dor; CD-57 1079 |
| gj:572 | BD+45 2247; BD+45 2247B |
| gj:810 | LP 756-18; LP 756-19 |
| gj:4288 | L 645-74; L 645-73 |
| gj:360 | G 236-1; G 236-2 |
| gj:1179 | EGGR 438; LP 380-6 |
| gj:414 | HD 97101B; HD 97101 |
| gj:13264 | PM J22403-4931A; PM J22403-4931B |
| gj:277 | Ross 989; VV Lyn B; VV Lyn A |
| gj:11774 | G 148-47; G 148-48 |
| gj:1001 | L 362-29 BC; L 362-29 |
| gj:211 | HD 37394; HD 233153 |
| gj:737 | HD 175224B; HD 175224A |
| gj:1263 | Wolf 940 B; Wolf 940 |
| gj:324 | Copernicus; Rho1 Cnc B |
| gj:3708 | L 758-108; L 758-107 |
| gj:774 | L 115-22; L 115-21 |
| gj:11217 | L 186-67; L 186-66 |
| gj:620.1 | CD-38 10980; HD 147513 |
| gj:395 | 36 UMa B; 36 UMa |
| gj:3304 | G 39-29B; G 39-29A |
| gj:425 | HD 98712B; HD 98712A |
| gj:194 | Capella; Capella H; Capella L |
| gj:512 | Ross 486A; Ross 486B |
| gj:3148 | CD-31 908; CD-31 909 |
| gj:3371 | G 192-11; G 192-12 |
| gj:61 | Titawin; Upsilon And B |
| gj:528 | HD 120476B; HD 120476A |
| gj:507 | BD+35 2436; G 164-65 |
| gj:130.1 | Ross 370A; Ross 370B |
| gj:771 | Alshain; Beta Aql B |
| gj:3997 | BD+19 3268B; BD+19 3268A |
| gj:184 | BD+52 911B; BD+52 911 |
| gj:767 | HD 331161A; HD 331161B |

## Cases needing additional research or data

- **GJ 229:** nearest-100 includes A, while B is outside that frozen cutoff.
  Nearest-1000 includes B as `cns5-1529`, displayed as HD 42581B. The 2024
  paper [The cool brown dwarf Gliese 229 B is a close binary](https://arxiv.org/abs/2410.11953)
  resolves B into Ba and Bb. An up-to-date three-component card needs reviewed
  component records; the existing unresolved B temperature must not be assigned
  independently to both brown dwarfs. Any nearest-100 membership change needs
  an explicit cutoff decision.
- **Capella, Alula Australis, and GJ 644:** CNS5 component labels contain AB,
  ABCD, or CD. A row with a compound label represents several components.
  It must retain its combined nature until individually sourced records exist.
- **Fomalhaut:** existing A and B records have reciprocal primary-system
  pointers in the frozen CNS5 table. This audit leaves them outside the 112
  groups rather than silently choosing a primary. The wider system and labels
  should be reviewed separately.
- **Single or unresolved records:** 19 nearest-1000 records are explicitly
  marked multiple in CNS5 but do not join another record under the audit's
  conservative primary-system key. Some are combined systems; others have
  a companion outside the catalog or a source-pointer issue. They are not
  automatically eligible for additional component buttons.

## Implementation path

1. Add explicit system identity, display name, component label, and source
   reference to generated component records or a dedicated system manifest.
2. Adopt the five nearest-100 associations and propagate them to nearest-1000.
3. Review the larger candidate list, retaining hierarchical labels and compound
   records. Preserve direct selection of the component the user clicked.
4. Enrich missing individual companions separately, retaining nullable values
   and reviewed provenance. Keep original catalog cutoffs until a membership
   change is explicitly chosen.

## Source evidence and limitations

- `src/star-systems.ts`: current suffix-based card grouping and Proxima alias.
- `src/data/catalogs/nearest-100/provenance.json`: object-level systemId/sourceRow.
- `catalog-work/nearest-100/source-input.json`: Sys, ObjName, and frozen census
  membership. [Source table](https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J%2FA%2BA%2F650%2FA201).
- `src/data/catalogs/nearest-1000/provenance.json`: CNS5-to-runtime-ID mapping,
  including curated component replacements for aggregate CNS5 rows.
- `catalog-work/nearest-1000/cns5.dat` and `cns5.ReadMe`: Comp, NComp, GJ,
  and GJp. [CNS5 schema](https://dc.zah.uni-heidelberg.de/__system__/dc_tables/show/tableinfo/cns5update.main)
  explicitly allows compound component labels.

The audit groups mapped records sharing a nonempty CNS5 primary GJ key, or
a curated 10pc systemId; overlapping exact-source groups are combined. It
does not perform position-based matching. The CNS5 trailing decimal point in
integer GJp values is normalized to the corresponding integer GJ identifier.
Records without enough source identifiers remain ungrouped. Counts are
conservative candidates from the bundled snapshot, not a current census.
