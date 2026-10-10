import mirandaPhoto from './assets/moons/miranda-photo.jpg'
import arielPhoto from './assets/moons/ariel-photo.jpg'
import umbrielPhoto from './assets/moons/umbriel-photo.jpg'
import titaniaPhoto from './assets/moons/titania-photo.jpg'
import oberonPhoto from './assets/moons/oberon-photo.jpg'
import tritonPhoto from './assets/moons/triton-photo.jpg'
import proteusPhoto from './assets/moons/proteus-photo.jpg'
import nereidPhoto from './assets/moons/nereid-photo.jpg'

interface MoonPhotograph {
  readonly image: string
  readonly description: string
  readonly credit: string
}

// Voyager did not provide continuous surface coverage for these moons. Keep
// the photographed view instead of stretching a partial map around a sphere.
export const moonPhotographs: Readonly<Record<string, MoonPhotograph>> = {
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
