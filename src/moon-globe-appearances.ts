import type { GlobeAppearance } from './planet-globe'
import moonMap from './assets/moons/moon-surface-map.jpg'
import ioMap from './assets/moons/io-map.jpg'
import europaMap from './assets/moons/europa-map.jpg'
import ganymedeMap from './assets/moons/ganymede-map.jpg'
import callistoMap from './assets/moons/callisto-map.jpg'
import mimasMap from './assets/moons/mimas-map.jpg'
import enceladusMap from './assets/moons/enceladus-map.jpg'
import dioneMap from './assets/moons/dione-map.jpg'
import rheaMap from './assets/moons/rhea-map.jpg'
import titanMap from './assets/moons/titan-map.jpg'
import iapetusMap from './assets/moons/iapetus-map.jpg'
import phobosMap from './assets/moons/phobos-atlas.jpg'
import deimosMap from './assets/moons/deimos-atlas.jpg'
import phobosModel from './assets/moons/phobos-shape.glb?url'
import deimosModel from './assets/moons/deimos-shape.glb?url'

export const moonGlobeAppearances: Readonly<Record<string, GlobeAppearance>> = {
  moon: {
    name: 'Moon', map: moonMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Lunar maria and cratered highlands from Lunar Reconnaissance Orbiter imagery.',
    credit: 'NASA’s Scientific Visualization Studio / Ernie Wright / LROC · 2025 CGI Moon Kit color composite. Color adjusted for visualization; polar gaps filled from laser-altimeter albedo. No surface relief is inferred. Lighting and orientation are illustrative.',
  },
  mimas: {
    name: 'Mimas', map: mimasMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Cratered surface and the large Herschel crater from Cassini’s June 2017 global mosaic.',
    credit: 'NASA / JPL-Caltech / Space Science Institute · Cassini global mosaic, June 2017 (PIA17214). Grayscale, with varying image resolution and illumination; no surface relief is inferred. Spherical approximation; lighting and orientation are illustrative.',
  },
  enceladus: {
    name: 'Enceladus', map: enceladusMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Cratered ice, fractured plains and southern tiger stripes from Cassini’s global mosaic.',
    credit: 'NASA / JPL / Space Science Institute · Cassini global mosaic, February 2010 (PIA12564), with Voyager 2 north-polar coverage. Grayscale, with varying image resolution and illumination; no surface relief is inferred. Spherical approximation; lighting and orientation are illustrative.',
  },
  dione: {
    name: 'Dione', map: dioneMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Cratered ice and bright fractured cliffs from Cassini’s October 2010 global mosaic.',
    credit: 'NASA / JPL / Space Science Institute · Cassini global mosaic, October 2010 (PIA12814), with Voyager gap coverage. Grayscale, with varying image resolution and illumination; no surface relief is inferred. Spherical approximation; lighting and orientation are illustrative.',
  },
  rhea: {
    name: 'Rhea', map: rheaMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Heavily cratered ice and bright wispy fractures from Cassini’s March 2012 global mosaic.',
    credit: 'NASA / JPL-Caltech / Space Science Institute · Cassini global mosaic, March 2012 (PIA14928), with Voyager north-polar coverage. Grayscale, with varying image resolution and illumination; no surface relief is inferred. Spherical approximation; lighting and orientation are illustrative.',
  },
  ...Object.fromEntries(([
    ['io', 'Io', ioMap, 'Sulfur-colored terrain and dark volcanic centers.'],
    ['europa', 'Europa', europaMap, 'Pale cream ice crossed by subtle reddish-brown fractures.'],
    ['ganymede', 'Ganymede', ganymedeMap, 'Brown-gray cratered regions and paler grooved ice.'],
    ['callisto', 'Callisto', callistoMap, 'Brown-gray terrain covered in bright impact craters.'],
    ['iapetus', 'Iapetus', iapetusMap, 'A dark brown hemisphere contrasting with bright cratered ice.'],
  ] as const).map(([id, name, map, description]) => [id, {
    name, map, description, roughness: 1, mapBlend: 1, tint: '#ffffff',
    credit: 'NASA / Visualization Technology Applications and Development (VTAD) · base-color texture from NASA’s 3D model, with approximate natural colors. Processed mosaic with varying resolution and illumination; not a calibrated global true-color measurement. No surface relief is inferred. Spherical approximation; lighting and orientation are illustrative.',
  } satisfies GlobeAppearance])),
  ...Object.fromEntries(([
    ['phobos', 'Phobos', phobosMap, phobosModel, 'Irregular shape, grooves and the large Stickney crater.'],
    ['deimos', 'Deimos', deimosMap, deimosModel, 'Irregular shape with a smoother, cratered surface.'],
  ] as const).map(([id, name, map, model, description]) => [id, {
    name, map, model, description, roughness: 1, mapBlend: 1, tint: '#ffffff',
    credit: 'NASA / JPL-Caltech · geometry and image atlas from NASA’s 3D model. The source’s irregular shape and texture coordinates are retained. Approximate natural color, with varying image resolution and illumination; not a calibrated color measurement. Lighting and orientation are illustrative.',
  } satisfies GlobeAppearance])),
  titan: {
    name: 'Titan', map: titanMap, roughness: 1, mapBlend: 1, tint: '#d5b487',
    description: 'Layered golden atmospheric haze, with a soft edge and a faint blue upper layer hiding Titan’s surface.',
    credit: 'NASA / JPL-Caltech / David Seal · fictional haze map with color guided by Voyager images. Muted gold coloring, smooth haze variation and soft atmospheric layers are illustrative, guided by Cassini natural-color views (PIA21625); not an observed global map or a view through the atmosphere. Lighting and orientation are illustrative.',
  },
}
