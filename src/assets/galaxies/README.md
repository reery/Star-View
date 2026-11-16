# Galaxy Info images

Retrieved and reviewed on 2026-11-15; the thirteen dwarf galaxy images were added on 2026-11-16. Eighteen images for the articles in `src/data/galaxy-info.json`, 626 KB in total. They load only when a visitor opens that galaxy’s Info, so they add nothing to startup.

## Delivery

As for the nebula images (`src/assets/nebulae/README.md`): AVIF, 600 px wide, Lanczos-3 resize, quality 48 (44 for the Small Magellanic Cloud, to stay at most 45 KB). Colors are unchanged. Credits, captions and licenses are stored with each article and shown on the card.

The dwarf galaxy images were resized and encoded with macOS `sips`, quality stepping down from 62 until the file is at most 45 KB. The two Hubble star fields of NGC 185 and NGC 147 are 480 px wide: their resolved stars do not compress to 45 KB at 600 px without visible blocks.

| File | Credit | Pixels (source → delivered) | Bytes | Source | License |
| --- | --- | --- | ---: | --- | --- |
| `milky-way.avif` | ESO/S. Brunier | 5120 × 2560 (`src/assets/milky-way.jpg`, the central 120° × 60°) → 600 × 300 | 12,073 | [ESO: The Milky Way panorama](https://www.eso.org/public/images/eso0932a/) | CC BY 4.0 |
| `large-magellanic-cloud.avif` | CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever (Montana State University); image processing T. Rector, M. Zamani & D. de Martin | 1920 × 1863 Commons rendition, top 60% → 600 × 349 | 21,400 | [NOIRLab: noirlab2030a](https://noirlab.edu/public/images/noirlab2030a/) via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Deepest,_widest_view_of_the_Large_Magellanic_Cloud_from_SMASH.jpg) | CC BY 4.0 |
| `small-magellanic-cloud.avif` | CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever (Montana State University); image processing T. Rector, M. Zamani & D. de Martin | 1920 × 1600 Commons rendition → 600 × 500 | 42,955 | [NOIRLab: noirlab2030b](https://noirlab.edu/public/images/noirlab2030b/) via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:SMC_-_Noirlab2030b.jpg) | CC BY 4.0 |
| `andromeda-galaxy.avif` | Adam Evans | 1920 × 1261 Commons rendition → 600 × 394 | 34,512 | [Wikimedia Commons: Andromeda Galaxy (with h-alpha)](https://commons.wikimedia.org/wiki/File:Andromeda_Galaxy_(with_h-alpha).jpg) | CC BY 2.0 |
| `triangulum-galaxy.avif` | T. A. Rector (NRAO/AUI/NSF and NOIRLab/NSF/AURA) and M. Hanna (NOIRLab/NSF/AURA) | 1920 × 1959 Commons rendition → 600 × 612 | 26,203 | [Wikimedia Commons: M33, NGC 598](https://commons.wikimedia.org/wiki/File:M33,_NGC_598_(noao-m33_opt).jpg) | CC BY 4.0 |
| `sagittarius-dwarf-galaxy.avif` | ESA/Gaia/DPAC | 4300 × 2708 Commons original, crop 1760 × 1100 below the Galactic Center → 600 × 375 | 9,370 | [Wikimedia Commons: The Sagittarius dwarf galaxy in Gaia’s all-sky view](https://commons.wikimedia.org/wiki/File:The_Sagittarius_dwarf_galaxy_in_Gaia%27s_all-sky_view_ESA399651.jpg) | CC BY-SA 3.0 IGO |
| `fornax-dwarf-galaxy.avif` | ESO/Digitized Sky Survey 2 | 1280 × 1280 → 600 × 600 | 41,745 | [ESO: eso1007a](https://www.eso.org/public/images/eso1007a/) | CC BY 4.0 |
| `sculptor-dwarf-galaxy.avif` | ESO | 1280 × 1171 → 600 × 549 | 44,981 | [ESO: eso1536a](https://www.eso.org/public/images/eso1536a/) | CC BY 4.0 |
| `draco-dwarf-galaxy.avif` | NASA, ESA, Digitized Sky Survey, R. van der Marel (STScI) | 5174 × 3513, wide-field panel 3500 × 3500 → 600 × 600 | 43,543 | [ESA/Hubble: opo2417a](https://esahubble.org/images/opo2417a/) | CC BY 4.0 |
| `ursa-minor-dwarf-galaxy.avif` | Giuseppe Donatiello | 1280 × 1280 → 600 × 600 | 42,545 | [Wikimedia Commons: Ursa Minor Dwarf](https://commons.wikimedia.org/wiki/File:Ursa_Minor_Dwarf_-_Giuseppe_Donatiello.jpg) | CC0 1.0 |
| `carina-dwarf-galaxy.avif` | ESO/G. Bono & CTIO | 1280 × 1068 → 600 × 500 | 40,718 | [ESO: potw1126a](https://www.eso.org/public/images/potw1126a/) | CC BY 4.0 |
| `sextans-dwarf-galaxy.avif` | Giuseppe Donatiello | 1280 × 1280, crop 1180 × 1180 without the label → 600 × 600 | 40,728 | [Wikimedia Commons: LG Sextans I](https://commons.wikimedia.org/wiki/File:LG_Sextans_I_(26422726155).jpg) | CC0 1.0 |
| `leo-i-dwarf-galaxy.avif` | Giuseppe Donatiello | 1280 × 1353, crop 1000 × 800 → 600 × 480 | 14,000 | [Wikimedia Commons: Regulus and Leo I dwarf](https://commons.wikimedia.org/wiki/File:Regulus_and_Leo_I_dwarf_(Giuseppe_Donatiello).jpg) | CC0 1.0 |
| `leo-ii-dwarf-galaxy.avif` | Giuseppe Donatiello | 1280 × 1280, crop 1180 × 1180 without the label → 600 × 600 | 37,260 | [Wikimedia Commons: LG Leo II](https://commons.wikimedia.org/wiki/File:LG_Leo_II_(26422781005).jpg) | CC0 1.0 |
| `messier-32.avif` | NASA, ESA, B. Williams, Z. Chen, L. C. Johnson; processing J. DePasquale (STScI) | 1280 × 1366 Commons rendition → 600 × 640 | 44,468 | [Wikimedia Commons: M32 crop of Hubble’s panoramic view of the Andromeda Galaxy](https://commons.wikimedia.org/wiki/File:M32_crop_of_Hubble%E2%80%99s_panoramic_view_of_the_Andromeda_Galaxy_(heic2501a).jpg) | public domain (NASA) |
| `messier-110.avif` | ESA/Hubble & NASA, L. Ferrarese et al. | 1280 × 960 → 600 × 450 | 41,459 | [ESA/Hubble: potw1937a](https://esahubble.org/images/potw1937a/) | CC BY 4.0 |
| `ngc-185.avif` | NASA, ESA, A. Ferguson (University of Edinburgh); processing G. Kober (NASA/CUA) | 1280 × 1283 Commons rendition → 480 × 481 | 43,294 | [Wikimedia Commons: Caldwell 18](https://commons.wikimedia.org/wiki/File:Caldwell_18_(50289818793).jpg) | CC BY 2.0 |
| `ngc-147.avif` | NASA, ESA, A. Ferguson (University of Edinburgh); processing G. Kober (NASA/CUA) | 1280 × 1183 Commons rendition → 480 × 443 | 44,591 | [Wikimedia Commons: Caldwell 17](https://commons.wikimedia.org/wiki/File:Caldwell_17_(50290241446).jpg) | CC BY 2.0 |
