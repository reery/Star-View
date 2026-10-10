# Moon imagery and shape models

Downloaded October 10, 2026. All assets are served locally. Continuous maps provide color on a shaded sphere; Phobos and Deimos use NASA's irregular meshes. Moons without suitable continuous coverage use spacecraft photographs fitted inside the same frame. The app does not synthesize missing surface detail or infer terrain from image brightness. There are no live ephemerides. Rotation and lighting are illustrative. Natural-color approximations are preferred over enhanced/false-color imagery; grayscale remains grayscale. Published asset colors are retained, without extra image hue edits; Titan's illustrative atmospheric rendering is described below.

## moon-surface-map.jpg

- **Source:** [NASA Scientific Visualization Studio: CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), the updated 2025 color map.
- **Download:** [lroc_color_2k.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg), 2048 × 1024, about 447 KB.
- **Credit:** NASA's Scientific Visualization Studio / Ernie Wright / LROC team.
- **Representation:** Global composite from Lunar Reconnaissance Orbiter wide-angle-camera observations, adjusted for human-visible color and aesthetics. Polar gaps use lower-resolution laser-altimeter albedo; it is not a uniformly observed RGB map. Only color is used, without surface relief or additional image edits.
- **Reuse:** Informational visualization under [NASA's media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), with attribution retained in the globe tooltip and here.

## JPL illustrative Titan map

Published by the [NASA/JPL Solar System Simulator](https://space.jpl.nasa.gov/tmaps/). Globe tooltips retain mission, creator and coverage limitations. The Titan map is 720 × 360. Moons are sized for legibility rather than for comparison with their parent planet.

| Local file | Published JPEG | Source page | Representation / credit |
| --- | --- | --- | --- |
| titan-map.jpg | [sat6fss1.jpg](https://space.jpl.nasa.gov/tmaps/pix/sat6fss1.jpg) | [Saturn](https://space.jpl.nasa.gov/tmaps/saturn.html) | Fictional concept with Voyager-guided color, David Seal / JPL-Caltech; renderer retains the map's smooth, broad variations in a muted gold palette, softens grazing-angle markings and adds a transparent layered atmospheric rim. Not an observed surface/global map |

The Titan haze is illustrative, not a calibrated natural-color measurement. Reuse follows [JPL's image-use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/) and NASA's media guidelines, retaining source and creator attribution. No logos or endorsement are used.

## Cassini replacements

The old Voyager maps had extensive white fill in unmapped regions. These replacements improve observed coverage across those gaps. All four are unannotated grayscale, simple-cylindrical mosaics, served at 2048 × 1024 using NASA's resized downloads. The source images contain differing illumination and resolution; the globe does not reconstruct terrain from those markings.

- **mimas-map.jpg:** [Mimas Global Map – June 2017, PIA17214](https://science.nasa.gov/photojournal/mimas-global-map-june-2017/), NASA / JPL-Caltech / Space Science Institute. Includes late-mission Cassini flybys of November 2016 and February 2017. [NASA resized JPEG](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia17/pia17214/PIA17214.jpg?fit=clip&w=2048&h=1024), about 421 KB.
- **enceladus-map.jpg:** [Map of Enceladus – February 2010, PIA12564](https://science.nasa.gov/photojournal/map-of-enceladus-february-2010/), NASA / JPL / Space Science Institute. Cassini coverage with one Voyager 2 image filling the north-polar region. [NASA resized JPEG](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia12/pia12564/PIA12564.jpg?fit=clip&w=2048&h=1024), about 526 KB.
- **dione-map.jpg:** [Map of Dione – October 2010, PIA12814](https://science.nasa.gov/photojournal/map-of-dione-october-2010/), NASA / JPL / Space Science Institute. Cassini mosaic with Voyager gap coverage. [NASA resized JPEG](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia12/pia12814/PIA12814.jpg?fit=clip&w=2048&h=1024).
- **rhea-map.jpg:** [Map of Rhea – March 2012, PIA14928](https://science.nasa.gov/photojournal/map-of-rhea-march-2012/), NASA / JPL-Caltech / Space Science Institute. Mostly Cassini, with six Voyager images providing north-polar coverage. [NASA resized JPEG](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia14/pia14928/PIA14928.jpg?fit=clip&w=2048&h=1024).

## NASA model textures: Galilean moons and Iapetus

The base-color images are extracted from official NASA VTAD GLB models, without model shading, grid lines or annotations. These replace the older Voyager maps. Io retains pale sulfur tones and volcanic markings; Europa retains pale cream ice and reddish-brown linework; Ganymede and Callisto retain brown-gray cratered terrain; Iapetus retains its real dark/bright hemisphere contrast. They are visualization mosaics with approximate natural colors and uneven resolution, not calibrated global true-color observations. Ganymede's map improves the large blurred patches of the older Voyager texture.

| Local file | Source model | Original download | Embedded base-color image |
| --- | --- | --- | --- |
| io-map.jpg | [Io 3D model](https://science.nasa.gov/resource/io-3d-model/) | [Io_1_3643.glb](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/Io_1_3643.glb) | color_2016_04_28.jpg, PNG, 4096 × 2048 |
| europa-map.jpg | [Europa 3D model](https://science.nasa.gov/resource/europa-3d-model/) | [Europa_1_3138.glb](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Europa_1_3138.glb) | color_2016_03_10.jpg, PNG, 4096 × 2048 |
| ganymede-map.jpg | [Ganymede 3D model](https://science.nasa.gov/resource/ganymede-3d-model/) | [Ganymede_1_5268.glb](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/g/Ganymede_1_5268.glb) | color_2016_03_10.jpg, PNG, 2048 × 1024 |
| callisto-map.jpg | [Callisto 3D model](https://science.nasa.gov/resource/callisto-3d-model/) | [Callisto_1_4821.glb](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Callisto_1_4821.glb) | color_2016_03_10.jpg, PNG, 2048 × 1024 |
| iapetus-map.jpg | [Iapetus 3D model](https://science.nasa.gov/resource/iapetus-3d-model/) | [Iapetus_1_1471.glb](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/Iapetus_1_1471.glb) | color_2016_07_13.jpg, PNG, 4096 × 2048 |

Preparation: read the GLB JSON chunk, locate the material's `baseColorTexture` image buffer view and extract its bytes. Convert the unchanged PNG to JPEG at quality 88; downsample Io, Europa and Iapetus to 2048 × 1024 with `sips -Z 2048`. No tint, saturation adjustment or terrain synthesis is applied. Credit: NASA / Visualization Technology Applications and Development (VTAD).

## Phobos and Deimos irregular 3D views

| Local files | NASA source | Original GLB |
| --- | --- | --- |
| phobos-shape.glb, phobos-atlas.jpg | [Phobos – Mars Moon, 3D Model](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/) | [24878_Phobos_1_1000.glb](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24878_Phobos_1_1000.glb) |
| deimos-shape.glb, deimos-atlas.jpg | [Deimos – Mars Moon, 3D Model](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/) | [24879_Deimos_1_1000.glb](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24879_Deimos_1_1000.glb) |

Credit: NASA / JPL-Caltech. Both source GLBs contain one mesh with positions, normals, atlas UVs and indexed triangles. The local GLBs retain these exact geometry bytes, omitting only the embedded image and material so the shared renderer can apply its established lighting. The original PNG image atlases are extracted and converted to JPEG at quality 88 (Phobos 2048 × 2048; Deimos 1024 × 1024). The loader retains the original UV convention (`flipY = false`). Geometry is centered and uniformly scaled for the box without changing its proportions; there is no spherical approximation or invented displacement. The source atlas contains differing image resolution and illumination. Approximate natural color is retained; it is not a calibrated color measurement.

## Spacecraft photographs for incomplete coverage

Uranian moons and Triton have limited mapped terrain; Proteus and Nereid lack suitable continuous textures for this view. The following published photographs and mosaics replace partial-map spheres. CSS uses `object-fit: contain` in the same fixed-height frame; Triton's mosaic has an 8 px inset so its complete outline stays inside the box. Files are unchanged downloads, with no added color or new detail; the source's color processing is identified below. All credit NASA / JPL and Voyager 2; Triton's mosaic also credits USGS. Observed geometry and lighting are retained.

| Local file | Primary source | Download | Representation |
| --- | --- | --- | --- |
| miranda-photo.jpg | [Miranda](https://science.nasa.gov/uranus/moons/miranda/) | [PIA00141.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/PIA00141.jpg) | Grayscale close-up of photographed terrain, January 24, 1986 |
| ariel-photo.jpg | [Ariel – Highest Resolution Color Picture](https://science.nasa.gov/photojournal/ariel-highest-resolution-color-picture/) | [PIA00041.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/PIA00041.jpg) | Green/blue/violet-filter visible-color composite, January 24, 1986; approximate color |
| umbriel-photo.jpg | [Umbriel](https://science.nasa.gov/uranus/moons/umbriel/) | [PIA00040_umbriel.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/PIA00040_umbriel.jpg) | Grayscale observed hemisphere, January 24, 1986 |
| titania-photo.jpg | [Titania High-Resolution Color Composite](https://science.nasa.gov/photojournal/titania-high-resolution-color-composite/) | [PIA00036.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/PIA00036.jpg) | Violet/clear-filter composite of neutral gray terrain, January 24, 1986; approximate color |
| oberon-photo.jpg | [Oberon at Voyager Closest Approach](https://science.nasa.gov/photojournal/oberon-at-voyager-closest-approach/) | [Oberon_732.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/Oberon_732.jpg) | Violet/clear/green-filter visible-color reconstruction, January 24, 1986; approximate color |
| triton-photo.jpg | [Global Color Mosaic of Triton](https://science.nasa.gov/photojournal/global-color-mosaic-of-triton/) | [PIA00317.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia00/pia00317/PIA00317.jpg?fit=clip&w=1600&h=1600) | NASA / JPL / USGS Voyager 2 mosaic, 1989, served at 1600 × 1244. Synthesized orange/violet/ultraviolet-filter color, not calibrated true color. Replaces the PIA02213 limb close-up with the entire published view of the observed hemisphere; no unobserved terrain is filled in |
| proteus-photo.jpg | [Proteus](https://science.nasa.gov/neptune/moons/proteus/) | [Proteus732X520.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/Proteus732X520.jpg) | Grayscale photographed outline and craters; about 8 km/pixel |
| nereid-photo.jpg | [Nereid](https://science.nasa.gov/neptune/moons/nereid/) | [Nereid-browse-732X520.jpg](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/07/Nereid-browse-732X520.jpg) | Barely resolved grayscale disk; fine surface detail unavailable |

Reuse follows NASA's media guidelines and JPL's image-use policy linked above, with attribution and limitations retained in the visual's tooltip. No logos or endorsement are used.

## Titan atmospheric rendering

[Highlighting Titan’s Hazes, PIA21625](https://science.nasa.gov/resource/highlighting-titans-hazes/) is the Cassini natural-color reference for the golden lower haze and faint blue upper layer. The existing illustrative map supplies broad variations, with subtle spherical procedural haze breakup. A transparent shader integrates an exponential golden lower haze and a faint higher blue layer along each viewing ray to produce a soft silhouette. Layer widths, contrast, opacity, haze patterns and lighting are visualization choices, not measured atmospheric profiles or current weather. The reference photograph is not used as a globe texture. Credits and these limits remain in the globe tooltip.
