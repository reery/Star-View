import mirandaPhoto from './assets/moons/miranda-photo.jpg'
import { smallBodyMoonPhotographs } from './small-body-moon-photographs'
import arielPhoto from './assets/moons/ariel-photo.jpg'
import umbrielPhoto from './assets/moons/umbriel-photo.jpg'
import titaniaPhoto from './assets/moons/titania-photo.jpg'
import oberonPhoto from './assets/moons/oberon-photo.jpg'
import tritonPhoto from './assets/moons/triton-photo.jpg'
import proteusPhoto from './assets/moons/proteus-photo.jpg'
import nereidPhoto from './assets/moons/nereid-photo.jpg'
import metisPhoto from './assets/moons/metis-photo.jpg'
import adrasteaPhoto from './assets/moons/adrastea-photo.jpg'
import amaltheaPhoto from './assets/moons/amalthea-photo.jpg'
import thebePhoto from './assets/moons/thebe-photo.jpg'
import hyperionPhoto from './assets/moons/hyperion-photo.jpg'
import naiadPhoto from './assets/moons/naiad-photo.jpg'
import innerNeptunianPhoto from './assets/moons/inner-neptunian-moons-photo.jpg'
import despinaPhoto from './assets/moons/despina-photo.jpg'
import galateaPhoto from './assets/moons/galatea-photo.jpg'
import larissaPhoto from './assets/moons/larissa-photo.jpg'
import hippocampPhoto from './assets/moons/hippocamp-photo.jpg'

interface MoonPhotograph {
  readonly image: string
  readonly description: string
  readonly credit: string
}

// Spacecraft did not provide suitable continuous maps for these moons. Keep
// the photographed view instead of stretching a partial map around a sphere.
// Photos fit the largest 209 × 172 CSS-pixel frame at 2× density, without upscaling.
export const moonPhotographs: Readonly<Record<string, MoonPhotograph>> = {
  ...smallBodyMoonPhotographs,
  naiad: {
    image: naiadPhoto,
    description: 'Voyager 2 grayscale photograph of Naiad; motion smear makes the moon appear more elongated than its actual shape.',
    credit: 'NASA / JPL · Voyager 2, 1989; published by NASA Science. Low-resolution, motion-smeared photograph; no added color or surface detail.',
  },
  thalassa: {
    image: innerNeptunianPhoto,
    description: 'Voyager 2 discovery photograph of Thalassa, circled and labelled 1989 N5, with Despina (1989 N3) and Naiad (1989 N6).',
    credit: 'NASA / JPL · Voyager 2, 1989, from 5.9 million km. Thalassa is the faint detection circled as 1989 N5. Motion creates streaks; the moon’s surface is unresolved. Complete published discovery image and labels retained at card resolution.',
  },
  despina: {
    image: despinaPhoto,
    description: 'Voyager 2 grayscale photograph of Despina; horizontal motion smear distorts its apparent outline.',
    credit: 'NASA / JPL / Calvin J. Hamilton · Voyager 2, 1989; archived NASA portrait via Wikimedia Commons (Despina.jpg, public domain). Low-resolution, motion-smeared photograph retained unchanged; no added color or surface detail.',
  },
  galatea: {
    image: galateaPhoto,
    description: 'Voyager 2 grayscale photograph of Galatea; motion smear makes the moon appear more elongated than its actual shape.',
    credit: 'NASA / JPL · Voyager 2, 1989; archived NASA portrait via Wikimedia Commons (Galatea moon.jpg, public domain). Published enlargement of a low-resolution, motion-smeared photograph; no added color or surface detail.',
  },
  larissa: {
    image: larissaPhoto,
    description: 'Two Voyager 2 grayscale photographs of Larissa’s irregular, cratered outline.',
    credit: 'NASA / JPL · Voyager 2, 1989; published by NASA Science. Both photographed views of Larissa retained at card resolution; limited resolution and coverage, with no added color or surface detail.',
  },
  hippocamp: {
    image: hippocampPhoto,
    description: 'Hubble discovery image of Hippocamp, circled and labelled S/2004 N 1, among Neptune’s inner moons and rings.',
    credit: 'NASA / ESA / M. Showalter (SETI Institute) · Hubble WFC3, 2009; published February 20, 2019. Hippocamp is the faint detection circled as S/2004 N 1; its shape and surface are unresolved. Published annotations and separate color inset of Neptune retained unchanged.',
  },
  hyperion: {
    image: hyperionPhoto,
    description: 'Cassini natural-color mosaic of Hyperion’s irregular outline and sponge-like, deeply cratered surface.',
    credit: 'NASA / JPL / Space Science Institute · Cassini, 2005; six-image composition by Gordan Ugarkovic, featured by NASA APOD May 14, 2018 as “Saturn’s Hyperion in Natural Color”. CC BY-NC-SA 2.0 (https://creativecommons.org/licenses/by-nc-sa/2.0/). Complete published composition retained at card resolution; approximate natural color, with only the photographed terrain shown.',
  },
  metis: {
    image: metisPhoto,
    description: 'Galileo grayscale photograph of Metis’s small, irregular outline.',
    credit: 'NASA / JPL / Cornell University · Galileo (PIA02531), January 4, 2000. Photographed Metis panel; features about 3 km across are resolved. Grayscale retained; no added surface detail.',
  },
  adrastea: {
    image: adrasteaPhoto,
    description: 'Galileo grayscale photograph of Adrastea’s barely resolved outline; fine surface features are not visible.',
    credit: 'NASA / JPL / Cornell University · Galileo (PIA01624), published September 15, 1998. Adrastea’s observed photograph from the upper row, excluding the reconstructed shape model below. Low resolution; no added color or surface detail.',
  },
  amalthea: {
    image: amaltheaPhoto,
    description: 'Galileo grayscale photograph of Amalthea’s irregular, cratered surface and bright patch near its south pole.',
    credit: 'NASA / JPL / Cornell University · Galileo (PIA02531), January 4, 2000. Photographed Amalthea panel; features about 2.4 km across are resolved. The bright material in crater Gaea is overexposed in the published image. Grayscale retained.',
  },
  thebe: {
    image: thebePhoto,
    description: 'Galileo grayscale photograph of Thebe’s irregular shape and large crater Zethus.',
    credit: 'NASA / JPL / Cornell University · Galileo (PIA02531), January 4, 2000. Photographed Thebe panel; features about 2 km across are resolved. Chosen for finer detail than Juno’s May 2026 view at about 3 km per pixel. Grayscale retained.',
  },
  miranda: {
    image: mirandaPhoto,
    description: 'Voyager 2 photograph of Miranda’s patchwork of cratered terrain, ridges and cliffs.',
    credit: 'NASA / JPL · Voyager 2 (PIA00141), January 24, 1986. Grayscale spacecraft photograph; only the observed hemisphere is shown.',
  },
  ariel: {
    image: arielPhoto,
    description: 'Voyager 2 color photograph of Ariel’s southern hemisphere, with craters and deep valleys.',
    credit: 'NASA / JPL · Voyager 2 (PIA00041), January 24, 1986. Published visible-filter color composite; approximate color rather than a calibrated true-color measurement. Only the photographed terrain is shown.',
  },
  umbriel: {
    image: umbrielPhoto,
    description: 'Voyager 2 photograph of Umbriel’s dark cratered surface and bright ring near its edge.',
    credit: 'NASA / JPL · Voyager 2 (PIA00040), January 24, 1986. Grayscale spacecraft photograph; only the observed hemisphere is shown.',
  },
  titania: {
    image: titaniaPhoto,
    description: 'Voyager 2 color photograph of Titania’s neutral gray cratered surface and long valleys.',
    credit: 'NASA / JPL · Voyager 2 (PIA00036), January 24, 1986. Published violet/clear-filter color composite; approximate color rather than a calibrated true-color measurement. Only the photographed hemisphere is shown.',
  },
  oberon: {
    image: oberonPhoto,
    description: 'Voyager 2 color photograph of Oberon’s cratered surface, bright rays and dark crater floors.',
    credit: 'NASA / JPL · Voyager 2 (PIA00034), January 24, 1986. Published visible-filter color reconstruction; approximate color rather than a calibrated true-color measurement. Only the photographed hemisphere is shown.',
  },
  triton: {
    image: tritonPhoto,
    description: 'Voyager 2 color mosaic of Triton’s observed hemisphere, showing its bright south polar cap, dark streaks and textured icy terrain.',
    credit: 'NASA / JPL / USGS · Voyager 2 global color mosaic (PIA00317), 1989. Synthesized color from orange, violet and ultraviolet filters, not a calibrated true-color view. The entire published mosaic is shown; unobserved terrain is not filled in.',
  },
  proteus: {
    image: proteusPhoto,
    description: 'Voyager 2 photograph of Proteus’s irregular, heavily cratered outline.',
    credit: 'NASA / JPL · Voyager 2, 1989. Grayscale spacecraft photograph at about 8 km per pixel; no artificial color or additional surface detail is added.',
  },
  nereid: {
    image: nereidPhoto,
    description: 'Voyager 2’s distant photograph of Nereid, a small, barely resolved bright disk.',
    credit: 'NASA / JPL · Voyager 2, 1989. Low-resolution grayscale spacecraft photograph; fine surface detail is not resolved.',
  },
}
