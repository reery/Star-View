# Nebula Info images

Retrieved and reviewed on 2026-11-04; the Vela Supernova Remnant and Crab Nebula images were added on 2026-11-13, the images of the eight historical supernova remnants on 2026-11-15, those of Barnard’s Loop and eight dark nebulae and molecular clouds on 2026-11-17, and those of the nine far nebulae of batch 8 the same day. 109 images for the articles in `src/data/nebula-info.json` and `src/data/dark-cloud-info.json`, 3.6 MB in total (mean 33 KB). They load only when a visitor opens that object’s Info, so they add nothing to startup.

## Delivery

AVIF, at most 600 px wide: the photo slot is 290 CSS px wide on every screen (`.selected-object` is a fixed 292 px), so 600 px covers a 2x display. Quality starts at 62 and steps down until the file is at most 45 KB. Portrait images are cropped to at most 5:4 so that they do not push the text off the card. Colors are unchanged, except that survey frames marked below are stretched.

Credits, captions and licenses are stored with each article in `nebula-info.json` and shown on the card.

## Choosing an image

Visible light comes first. Three images use other wavelengths because the nebula is hidden or far more striking there: W40 (Spitzer infrared), IC 348 (Webb near-infrared) and NGC 2071 (Euclid near-infrared). The Tarantula Nebula’s Hubble mosaic adds the near-infrared I band to ground-based [O III] and hydrogen-alpha images. Four supernova remnants that are faint or invisible in visible light are shown in X-rays, alone or in false-color composites: SN 1006, RX J1713.7-3946, Tycho’s and Kepler’s remnants. Narrowband filter images are labeled in their captions. Where no published image exists, the image is a cutout from the Digitized Sky Survey.

## Published images (83)

| File | Credit | Pixels (source → delivered) | Bytes | Source | License |
| --- | --- | --- | ---: | --- | --- |
| `pleiades-nebula.avif` | NASA, ESA, AURA/Caltech, Palomar Observatory | 1280 × 923 → 600 × 433 | 26,998 | [Wikimedia Commons: Pleiades large](https://commons.wikimedia.org/wiki/File:Pleiades_large.jpg) | public domain (NASA) |
| `orion-nebula.avif` | NASA, ESA, M. Robberto (STScI/ESA) and the Hubble Orion Treasury Project Team | 1280 × 1280 → 600 × 600 | 28,313 | [ESA/Hubble: Hubble’s sharpest view of the Orion Nebula](https://esahubble.org/images/heic0601a/) | CC BY 4.0 |
| `ic-4592.avif` | Giuseppe Donatiello | 1280 × 1309 → 600 × 614 | 44,188 | [Wikimedia Commons: IC 4592 Blue Horsehead Nebula](https://commons.wikimedia.org/wiki/File:IC_4592_Blue_Horsehead_Nebula.jpg) | CC0 1.0 |
| `ic-4601.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 1000 × 653 → 600 × 392 | 24,787 | [Wikimedia Commons: IC 4601](https://commons.wikimedia.org/wiki/File:Ic4601s.jpg) | CC BY-SA 3.0 US |
| `ic-4603.avif` | Hwy37 | 1280 × 879 → 600 × 412 | 29,623 | [Wikimedia Commons: Rho Ophiuchi core region with IC 4603](https://commons.wikimedia.org/wiki/File:Rho_Ophiuchi_Core_Region_with_IC_4603.jpg) | CC BY-SA 4.0 |
| `ic-4604.avif` | Ivan Bok | 1280 × 949 → 600 × 445 | 34,786 | [Wikimedia Commons: VdB 105 and 106](https://commons.wikimedia.org/wiki/File:VdB_105_and_106.jpg) | CC BY 4.0 |
| `ic-4605.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 949 × 950 → 600 × 601 | 38,176 | [Wikimedia Commons: IC 4605](https://commons.wikimedia.org/wiki/File:Ic4605s.jpg) | CC BY-SA 3.0 US |
| `ic-4606.avif` | Adam Block/Steward Observatory/University of Arizona | 750 × 750 → 600 × 600 | 37,593 | [Wikimedia Commons: Antares nebulosity](https://commons.wikimedia.org/wiki/File:Antares_nebulosity.jpg) | CC BY-SA 3.0 |
| `hinds-variable-nebula.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 1200 × 801 → 600 × 400 | 14,952 | [Wikimedia Commons: NGC 1555](https://commons.wikimedia.org/wiki/File:N1555s.jpg) | CC BY-SA 3.0 US |
| `vdb-129.avif` | M. Amari | 1200 × 799 → 600 × 400 | 42,902 | [Wikimedia Commons: vdB 129](https://commons.wikimedia.org/wiki/File:Vdb129-ultima1200jpg.jpg) | CC BY-SA 3.0 |
| `sh-2-27.avif` | Tk833 | 1280 × 851 → 600 × 399 | 37,686 | [Wikimedia Commons: SH2-27 in H-alpha and continuum](https://commons.wikimedia.org/wiki/File:SH2-27_in_H-alpha_and_continuum.jpg) | CC BY-SA 4.0 |
| `abell-35.avif` | Jerry Macon | 1280 × 905 → 600 × 424 | 8,865 | [Wikimedia Commons: Abell 35](https://commons.wikimedia.org/wiki/File:Abell_35_Planetary_Nebula_-_Sh2-313.png) | CC BY 4.0 |
| `sh-2-216.avif` | Manuel Peitsch | 1280 × 891 → 600 × 418 | 38,589 | [Wikimedia Commons: Sh2-216](https://commons.wikimedia.org/wiki/File:Sh2-216-BY-scaled.jpg) | CC BY 4.0 |
| `lambda-orionis-nebula.avif` | Rogelio Bernal Andreo; crop by Lithopsian | 1280 × 932 → 600 × 437 | 44,109 | [Wikimedia Commons: Lambda Orionis](https://commons.wikimedia.org/wiki/File:Lambda_Orionis.jpg) | CC BY-SA 4.0 |
| `sh-2-277.avif` | Gianni Lacroce | 1280 × 872 → 600 × 409 | 18,845 | [Wikimedia Commons: Horsehead Nebula and Flame Nebula](https://commons.wikimedia.org/wiki/File:Horsehead_Nebula_and_Flame_Nebula.jpg) | CC BY-SA 4.0 |
| `california-nebula.avif` | Taavi Niittee/Tõrva Astronomy Club | 1280 × 641 → 600 × 300 | 31,773 | [Wikimedia Commons: California nebula from Estonia](https://commons.wikimedia.org/wiki/File:California_nebula_from_Estonia.jpg) | CC BY 4.0 |
| `flaming-star-nebula.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 1280 × 1272 → 600 × 596 | 44,270 | [Wikimedia Commons: IC 405](https://commons.wikimedia.org/wiki/File:Ic405s.jpg) | CC BY-SA 3.0 US |
| `sh-2-9.avif` | Adam Block/Steward Observatory/University of Arizona | 835 × 829 → 600 × 596 | 43,284 | [Wikimedia Commons: Sh 2-9](https://commons.wikimedia.org/wiki/File:Sh_2-9_(Adam_Block).jpg) | CC BY-SA 3.0 |
| `ic-63.avif` | ESA/Hubble, NASA | 1280 × 1299 → 600 × 609 | 31,414 | [ESA/Hubble: The Ghost Nebula](https://esahubble.org/images/heic1818a/) | CC BY 4.0 |
| `running-man-nebula.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 900 × 898 → 600 × 599 | 33,716 | [Wikimedia Commons: NGC 1977 Running Man Nebula](https://commons.wikimedia.org/wiki/File:NGC1977_Running_Man_Nebula_from_the_Mount_Lemmon_SkyCenter_Schulman_Telescope_courtesy_Adam_Block.jpg) | CC BY-SA 4.0 |
| `messier-78.avif` | ESO/Igor Chekalin | 1280 × 1240 → 600 × 581 | 32,948 | [ESO: Messier 78, a reflection nebula in Orion](https://www.eso.org/public/images/eso1105a/) | CC BY 4.0 |
| `ngc-2071.avif` | ESA/Euclid/Euclid Consortium/NASA/ERO2024 & Melina Thévenot | 1280 × 827 → 600 × 388 | 20,869 | [Wikimedia Commons: NGC 2071 Euclid](https://commons.wikimedia.org/wiki/File:NGC_2071_Euclid.jpg) | CC BY-SA 4.0 |
| `ngc-2023.avif` | KPNO/NOIRLab/NSF/AURA/Adam Block | 1280 × 863 → 600 × 405 | 8,614 | [NOIRLab: NGC 2023](https://noirlab.edu/public/images/noao-n2023block/) | CC BY 4.0 |
| `witch-head-nebula.avif` | Zdeněk Bardon/ESO | 1280 × 862 → 600 × 404 | 38,514 | [ESO: Witch Head Nebula](https://www.eso.org/public/images/witchhead-ch17-bardon-cc/) | CC BY 4.0 |
| `ngc-1333.avif` | KPNO/NOIRLab/NSF/AURA/Jay Lavine and Ali Huang/Adam Block | 1280 × 860 → 600 × 403 | 14,088 | [NOIRLab: NGC 1333](https://noirlab.edu/public/images/noao-n1333lavine/) | CC BY 4.0 |
| `ic-348.avif` | NASA, ESA, CSA, STScI, K. Luhman (Penn State University) and C. Alves de Oliveira (ESA) | 1280 × 1716 → 600 × 603 | 41,536 | [Wikimedia Commons: Star Cluster IC 348 (NIRCam image)](https://commons.wikimedia.org/wiki/File:Star_Cluster_IC_348_(NIRCam_image)_(weic2331a).jpg) | CC BY 4.0 |
| `ic-59.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 700 × 1042 → 600 × 750 | 40,497 | [Wikimedia Commons: IC 59](https://commons.wikimedia.org/wiki/File:Ic59s.jpg) | CC BY-SA 3.0 US |
| `iris-nebula.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1176 → 600 × 551 | 34,600 | [NOIRLab: Iris Nebula NGC 7023](https://noirlab.edu/public/images/noao-ngc7023/) | CC BY 4.0 |
| `helix-nebula.avif` | ESO | 1280 × 1185 → 600 × 555 | 23,936 | [ESO: The Helix Nebula](https://www.eso.org/public/images/eso0907a/) | CC BY 4.0 |
| `dumbbell-nebula.avif` | REU program/NOIRLab/NSF/AURA | 1280 × 1097 → 600 × 514 | 38,862 | [NOIRLab: M27, Dumbbell Nebula](https://noirlab.edu/public/images/noao-m27/) | CC BY 4.0 |
| `ngc-1360.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 1119 × 1200 → 600 × 643 | 14,591 | [Wikimedia Commons: NGC 1360](https://commons.wikimedia.org/wiki/File:NGC1360_Planetary_Nebula_from_the_Mount_Lemmon_SkyCenter_Schulman_Telescope_courtesy_Adam_Block.jpg) | CC BY-SA 4.0 |
| `medusa-nebula.avif` | ESO | 1280 × 1333 → 600 × 625 | 35,700 | [ESO: The VLT images the Medusa Nebula](https://www.eso.org/public/images/eso1520a/) | CC BY 4.0 |
| `abell-31.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1319 → 600 × 618 | 35,396 | [NOIRLab: Planetary Nebula Sh2-290](https://noirlab.edu/public/images/noao-sh2-290/) | CC BY 4.0 |
| `abell-7.avif` | Jerry Macon | 1280 × 855 → 600 × 401 | 9,970 | [Wikimedia Commons: Abell 7](https://commons.wikimedia.org/wiki/File:Abell_7_Planetary_Nebula.jpg) | CC BY 4.0 |
| `abell-36.avif` | ESO | 1280 × 1393 → 600 × 653 | 33,371 | [ESO: A fleeting moment in time](https://www.eso.org/public/images/eso1902a/) | CC BY 4.0 |
| `puwe-1.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1164 → 600 × 546 | 39,789 | [NOIRLab: Planetary Nebula PuWe 1](https://noirlab.edu/public/images/noao-puwe1/) | CC BY 4.0 |
| `vdb-1.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 902 × 675 → 600 × 449 | 27,204 | [Wikimedia Commons: VdB1 Nebula](https://commons.wikimedia.org/wiki/File:VdB1_Nebula_from_the_Mount_Lemmon_SkyCenter_Schulman_Telescope_courtesy_Adam_Block_(cropped).jpg) | CC BY-SA 4.0 |
| `vdb-4.avif` | Adam Block/Mount Lemmon SkyCenter/University of Arizona | 1280 × 849 → 600 × 398 | 29,023 | [Wikimedia Commons: VdB4 Nebula](https://commons.wikimedia.org/wiki/File:VdB4_Nebula_from_the_Mount_Lemmon_SkyCenter_Schulman_Telescope_courtesy_Adam_Block.jpg) | CC BY-SA 4.0 |
| `vdb-24.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1029 → 600 × 482 | 32,207 | [NOIRLab: vdB 24, Star XY Per](https://noirlab.edu/public/images/noao-vdb24/) | CC BY 4.0 |
| `vdb-31.avif` | Nico Carver (Nebula Photos) | 1280 × 1115 → 600 × 523 | 38,561 | [Wikimedia Commons: VdB 31 with 10 refractors](https://commons.wikimedia.org/wiki/File:VdB_31_with_10_refractors_(Nico_Carver).jpg) | CC BY-SA 2.0 |
| `vdb-38.avif` | KPNO/NOIRLab/NSF/AURA/T.A. Rector (University of Alaska Anchorage/NOIRLab) | 1280 × 1288 → 600 × 604 | 33,771 | [NOIRLab: Nebular Harvest](https://noirlab.edu/public/images/iotw2316a/) | CC BY 4.0 |
| `vdb-42.avif` | ESO/Digitized Sky Survey 2; crop on Wikimedia Commons | 528 × 704 → 528 × 660 | 42,224 | [Wikimedia Commons: VdB 42 - DSS2](https://commons.wikimedia.org/wiki/File:VdB_42_-_DSS2.png) | CC BY 4.0 |
| `vdb-141.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 640 → 600 × 300 | 20,004 | [NOIRLab: Ghost Nebula, vdB 141](https://noirlab.edu/public/images/noao-vdb141/) | CC BY 4.0 |
| `vdb-152.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1659 → 600 × 584 | 42,210 | [NOIRLab: vdB 152, Barnard 175](https://noirlab.edu/public/images/noao-vdb152/) | CC BY 4.0 |
| `sh-2-68.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 965 → 600 × 452 | 44,357 | [NOIRLab: Planetary Nebula Sh2-68](https://noirlab.edu/public/images/noao-sh2-68/) | CC BY 4.0 |
| `ic-426.avif` | T.A. Rector/University of Alaska Anchorage, H. Schweiker/WIYN and NOIRLab/NSF/AURA | 8295 × 3000 → 600 × 603 | 27,717 | [NOIRLab: Reflection Nebula IC426](https://noirlab.edu/public/images/noao-ic426/) | CC BY 4.0 |
| `lbn-472.avif` | Alpha Zhang | 1280 × 853 → 600 × 400 | 31,972 | [Wikimedia Commons: LBN 472](https://commons.wikimedia.org/wiki/File:LBN_472_blue_echo_in_cosmic_smoke_Alpha_Zhang.jpg) | CC BY-SA 4.0 |
| `ngc-6726.avif` | ESO | 1280 × 1248 → 600 × 585 | 42,022 | [ESO: The R Coronae Australis region](https://www.eso.org/public/images/eso1027a/) | CC BY 4.0 |
| `ic-4812.avif` | ESO | 8795 × 8573 → 600 × 565 | 40,244 | [ESO: The R Coronae Australis region](https://www.eso.org/public/images/eso1027a/) | CC BY 4.0 |
| `toby-jug-nebula.avif` | ESO | 1280 × 1280 → 600 × 600 | 18,157 | [ESO: The Toby Jug Nebula](https://www.eso.org/public/images/eso1343a/) | CC BY 4.0 |
| `sh-2-64.avif` | NASA/JPL-Caltech | 1280 × 835 → 600 × 391 | 38,717 | [Wikimedia Commons: The Spitzer view of W40](https://commons.wikimedia.org/wiki/File:The_Spitzer_Space_Telescope's_view_of_W40.jpg) | public domain (NASA) |
| `sh-2-126.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1275 → 600 × 598 | 39,449 | [NOIRLab: Sh2-126, the Star Funnel](https://noirlab.edu/public/images/noao-sh2-126/) | CC BY 4.0 |
| `sh-2-174.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1488 → 600 × 698 | 43,783 | [NOIRLab: Planetary Nebula Sh2-174](https://noirlab.edu/public/images/noao1301a/) | CC BY 4.0 |
| `lotr-5.avif` | Hunter Outten | 1280 × 838 → 600 × 393 | 5,682 | [Wikimedia Commons: LoTr 5](https://commons.wikimedia.org/wiki/File:LoTr_5_Planetary_Nebula.png) | CC BY-SA 4.0 |
| `mwp-1.avif` | T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/NSF/AURA) | 1280 × 1018 → 600 × 477 | 44,118 | [NOIRLab: Planetary Nebula MWP1](https://noirlab.edu/public/images/noao-mwp1/) | CC BY 4.0 |
| `vela-supernova-remnant.avif` | CTIO/NOIRLab/DOE/NSF/AURA; T.A. Rector (University of Alaska Anchorage/NSF’s NOIRLab), M. Zamani & D. de Martin (NSF’s NOIRLab) | 1280 × 1283 → 598 × 600 | 45,422 | [Wikimedia Commons: Vela Supernova Remnant (noirlab2406a)](https://commons.wikimedia.org/wiki/File:Vela_Supernova_Remnant_-_Noirlab2406a.jpg) | CC BY 4.0 |
| `crab-nebula.avif` | NASA, ESA and Allison Loll/Jeff Hester (Arizona State University); acknowledgement: Davide De Martin (ESA/Hubble) | 1280 × 1280 → 600 × 600 | 42,434 | [ESA/Hubble: Most detailed image of the Crab Nebula](https://esahubble.org/images/heic0515a/) | CC BY 4.0 |
| `rcw-86.avif` | CTIO/NOIRLab/DOE/NSF/AURA; T.A. Rector, J. Miller, M. Zamani & D. de Martin (NSF’s NOIRLab) | 1280 × 1006 → 600 × 471 | 44,626 | [Wikimedia Commons: RCW 86 (noirlab2307a)](https://commons.wikimedia.org/wiki/File:RCW_86_-_Noirlab2307a.jpg) | CC BY 4.0 |
| `rx-j1713-3946.avif` | Chandra: NASA/CXC/SAO/P. Slane et al.; XMM-Newton: ESA/RIKEN/J. Hiraga et al. | 576 × 633 → 576 × 633 | 16,462 | [Wikimedia Commons: Chandra & XMM-Newton X-ray images of G347.3-0.5](https://commons.wikimedia.org/wiki/File:Chandra_%26_XMM-Newton_X-ray_Images_of_G347_3-0_5_(2007-2snr-more-2_-_g347).jpg) | public domain (NASA) |
| `sn-1006.avif` | NASA/CXC/Rutgers/G. Cassam-Chenaï, J. Hughes et al.; NRAO/AUI/NSF/GBT/VLA/Dyer, Maddalena & Cornwell; Middlebury College/F. Winkler, NOAO/AURA/NSF/CTIO Schmidt & DSS | 1280 × 1280 → 600 × 600 | 44,088 | [Wikimedia Commons: Supernova Remnant SN 1006](https://commons.wikimedia.org/wiki/File:Supernova_Remnant_SN_1006.jpg) | CC BY 4.0 |
| `pa-30.avif` | International Gemini Observatory/NOIRLab/NSF/AURA; PI T. Cunningham; J. Miller, M. Rodriguez, T.A. Rector, D. de Martin & M. Zamani | 1280 × 1358 → 600 × 636 | 41,686 | [Wikimedia Commons: Supernova remnant Pa 30 (noirlab2624a)](https://commons.wikimedia.org/wiki/File:Supernova_remnant_Pa_30_(noirlab2624a).jpg) | CC BY 4.0 |
| `tychos-supernova-remnant.avif` | NASA/CXC/Rutgers/J. Warren & J. Hughes et al. | 1280 × 1280 → 600 × 600 | 35,424 | [Wikimedia Commons: Tycho-supernova-xray.jpg](https://commons.wikimedia.org/wiki/File:Tycho-supernova-xray.jpg) | public domain (NASA) |
| `keplers-supernova-remnant.avif` | NASA/ESA/JHU/R. Sankrit & W. Blair | 750 × 750 → 600 × 600 | 13,152 | [Wikimedia Commons: Keplers supernova.jpg](https://commons.wikimedia.org/wiki/File:Keplers_supernova.jpg) | public domain (NASA) |
| `cassiopeia-a.avif` | NASA, ESA and the Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration; acknowledgement: R. A. Fesen & J. Long | 1280 × 1280 → 600 × 600 | 38,923 | [Wikimedia Commons: Hubble’s view of Cassiopeia A (weic2311c)](https://commons.wikimedia.org/wiki/File:Hubble%E2%80%99s_view_of_Cassiopeia_A_(weic2311c).jpg) | CC BY 4.0 |
| `sn-1987a.avif` | ESA/Hubble & NASA | 850 × 850 → 600 × 600 | 20,854 | [Wikimedia Commons: SN 1987A HST.jpg](https://commons.wikimedia.org/wiki/File:SN_1987A_HST.jpg) | CC BY 4.0 |
| `barnards-loop.avif` | Giuseppe Donatiello | 4500 × 2874 → 600 × 383 | 41,029 | [Wikimedia Commons: Barnard Loop 5RGB 1Ha](https://commons.wikimedia.org/wiki/File:Barnard_Loop_5RGB_1Ha_2002-2010_rwk_(21223105453).jpg) | CC0 1.0 |
| `ldn-57.avif` | ESO | 4193 × 4193 → 600 × 600 | 44,712 | [ESO: How to become a star](https://www.eso.org/public/images/eso0102a/) | CC BY 4.0 |
| `cahlon-cloud-30.avif` | ESO/Digitized Sky Survey 2; acknowledgment: Davide De Martin | 4000 × 2995 → 600 × 449 | 42,247 | [ESO: Wide-field view of part of the Coalsack Nebula](https://www.eso.org/public/images/eso1539c/) | CC BY 4.0 |
| `cahlon-cloud-22.avif` | Keesscherer | 3858 × 2984 → 600 × 464 | 42,995 | [Wikimedia Commons: Taurus Molecular Cloud 1 and IC 2087](https://commons.wikimedia.org/wiki/File:Taurus_moleculair_Cloud_1_IC2087.jpg) | CC BY-SA 4.0 |
| `ldn-66.avif` | Friendlystar | 3600 × 3600 → 600 × 600 | 38,966 | [Wikimedia Commons: Snake Nebula](https://commons.wikimedia.org/wiki/File:Snake_Nebula.jpg) | CC BY 3.0 |
| `ldn-1746.avif` | ESO | 1280 × 1197 → 600 × 561 | 41,445 | [ESO: The mouthpiece of the Pipe Nebula](https://www.eso.org/public/images/eso1233a/) | CC BY 4.0 |
| `ldn-42.avif` | ESO/Yuri Beletsky | 3000 × 1983 → 600 × 396 | 40,132 | [Wikimedia Commons: The Pipe Nebula](https://commons.wikimedia.org/wiki/File:The_Pipe_Nebula.jpg) | CC BY 4.0 |
| `ldn-1551.avif` | ESA/Hubble and NASA; acknowledgement: Judy Schmidt | 4135 × 4009 → 600 × 581 | 6,560 | [ESA/Hubble: Jets, bubbles and bursts of light in Taurus](https://esahubble.org/images/heic1424a/) | CC BY 4.0 |
| `cahlon-cloud-20.avif` | CTIO/NOIRLab/DOE/NSF/AURA; T.A. Rector (University of Alaska Anchorage/NSF NOIRLab), M. Zamani & D. de Martin (NSF NOIRLab) | 19507 × 17582 → 600 × 540 | 40,706 | [NOIRLab: The Ominous Chamaeleon I Dark Cloud](https://noirlab.edu/public/images/noirlab2519a/) | CC BY 4.0 |
| `lagoon-nebula.avif` | ESO/VPHAS+ team | 1280 × 875 → 600 × 410 | 42,023 | [ESO: VST images the Lagoon Nebula](https://www.eso.org/public/images/eso1403a/) | CC BY 4.0 |
| `trifid-nebula.avif` | Todd Boroson/NOIRLab/NSF/AURA | 1280 × 1280 → 600 × 600 | 43,245 | [NOIRLab: Trifid, M20, NGC 6514](https://noirlab.edu/public/images/noao-m20/) | CC BY 4.0 |
| `eagle-nebula.avif` | NASA, ESA/Hubble and the Hubble Heritage Team | 1280 × 1335 → 600 × 625 | 25,515 | [ESA/Hubble: New view of the Pillars of Creation — visible](https://esahubble.org/images/heic1501a/) | CC BY 4.0 |
| `omega-nebula.avif` | ESO | 1280 × 1280 → 600 × 600 | 28,333 | [ESO: The Omega Nebula](https://www.eso.org/public/images/eso0925a/) | CC BY 4.0 |
| `rosette-nebula.avif` | KPNO/NOIRLab/NSF/AURA/N. A. Sharp | 1280 × 1280 → 600 × 600 | 44,747 | [NOIRLab: Rosette Nebula, NGC 2237](https://noirlab.edu/public/images/noao-rosette/) | CC BY 4.0 |
| `carina-nebula.avif` | NASA, ESA, N. Smith (University of California, Berkeley) and The Hubble Heritage Team (STScI/AURA) | 1280 × 620 → 600 × 290 | 24,784 | [ESA/Hubble: Star birth in the extreme](https://esahubble.org/images/heic0707a/) | CC BY 4.0 |
| `north-america-nebula.avif` | KPNO/NOIRLab/NSF/AURA/Adam Block | 1280 × 877 → 600 × 411 | 40,900 | [NOIRLab: NGC 7000, the North America and Pelican nebulae](https://noirlab.edu/public/images/noao-n7000mosblock/) | CC BY 4.0 |
| `veil-nebula.avif` | NASA, ESA and the Hubble Heritage Team | 1280 × 853 → 600 × 400 | 42,166 | [ESA/Hubble: Revisiting the Veil Nebula](https://esahubble.org/images/heic1520a/) | CC BY 4.0 |
| `tarantula-nebula.avif` | NASA, ESA, ESO, D. Lennon and E. Sabbi (ESA/STScI) et al. | 1280 × 1024 → 600 × 480 | 38,344 | [ESA/Hubble: Hubble’s panoramic view of a star-forming region](https://esahubble.org/images/heic1206a/) | CC BY 4.0 |

Source pixels are the rendition downloaded, usually the publisher’s web size. `ic-4812.avif` and `ic-426.avif` are crops of the full `eso1027a` and `noao-ic426` frames. `ngc-6726.avif` and `ic-4812.avif` show the same ESO field. Pixels marked as crops in the article credits were trimmed to the 5:4 limit. The dark-cloud images were converted with macOS `sips`; Barnard 68 and the Snake Nebula, dense star fields, needed quality 26 and 30 to stay within 45 KB.

## Digitized Sky Survey cutouts (26)

Made from the [DSS colored HiPS survey](https://skies.esac.esa.int/DSSColor/) (ESA mirror of the CDS survey): DSS2 red and blue plates, colored by CDS. Each frame is a gnomonic projection centered on the catalog position, north up and east left, and at least 14 arcminutes wide or 1.7 times the catalog size. The projection was checked against the known positions of seven Pleiades stars. Sh 2-1 is centered off the star to avoid a plate seam.

**Rights:** the plate scans are copyright of Caltech, the Anglo-Australian Observatory and AURA and are “distributed by agreement” ([STScI copyright notice](https://archive.stsci.edu/dss/copyright.html)). No open license is published. ESO and ESA/Hubble release their own DSS2 frames under CC BY 4.0, and the survey is widely reused with this acknowledgement, but these cutouts have no explicit grant.

Acknowledgement: The Digitized Sky Surveys were produced at the Space Telescope Science Institute under U.S. Government grant NAG W-2166. The images are based on photographic data obtained using the Oschin Schmidt Telescope on Palomar Mountain and the UK Schmidt Telescope. The plates were processed into the present compressed digital form with the permission of these institutions.

| File | Delivered | Bytes | Arcsinh stretch gain |
| --- | --- | ---: | ---: |
| `vdb-101.avif` | 600 × 600 | 24,142 | none |
| `vdb-111.avif` | 600 × 600 | 34,589 | none |
| `vdb-25.avif` | 600 × 600 | 38,971 | 14 |
| `vdb-26.avif` | 600 × 600 | 14,965 | none |
| `vdb-27.avif` | 600 × 600 | 19,361 | none |
| `vdb-7.avif` | 600 × 600 | 37,620 | 14 |
| `sh-2-1.avif` | 600 × 600 | 36,064 | 10 |
| `vdb-9.avif` | 600 × 600 | 42,556 | 14 |
| `vdb-16.avif` | 600 × 600 | 19,147 | none |
| `vdb-18.avif` | 600 × 600 | 39,723 | 20 |
| `vdb-29.avif` | 600 × 600 | 40,395 | 20 |
| `vdb-37.avif` | 600 × 600 | 26,918 | none |
| `ic-420.avif` | 600 × 600 | 24,573 | none |
| `vdb-49.avif` | 600 × 600 | 37,494 | none |
| `vdb-50.avif` | 600 × 600 | 28,896 | none |
| `ic-432.avif` | 600 × 600 | 27,430 | none |
| `ic-435.avif` | 600 × 600 | 22,354 | none |
| `ic-1287.avif` | 600 × 600 | 44,876 | 10 |
| `vdb-134.avif` | 600 × 600 | 39,113 | 12 |
| `vdb-149.avif` | 600 × 600 | 18,174 | none |
| `vdb-150.avif` | 600 × 600 | 21,470 | none |
| `vdb-138.avif` | 600 × 600 | 38,902 | 20 |
| `vdbh-7.avif` | 600 × 600 | 35,388 | none |
| `ced-184.avif` | 600 × 600 | 43,656 | 20 |
| `ic-4591.avif` | 600 × 600 | 44,031 | none |
| `wede-1.avif` | 600 × 600 | 41,827 | 40 |

## No image (10)

vdB 109, vdB 156, Sh 2-7, vdB 127, PFP 1, vdB 151, IsWe 1, TK 1. Neither the published archives nor the survey show these nebulae: the frames contain only stars, plate seams or grain, even after stretching. As with the star articles, an uninformative field is left out rather than shown.

The Monogem Ring and Hoinga (2026-11-13) are seen mainly in X-rays, and no freely licensed image of either was found. The CC BY 4.0 preprint of Fesen et al. (2026, arXiv:2608.26666) contains [O III] and hydrogen-alpha images of the Monogem Ring; its figures are a candidate once they can be extracted.
