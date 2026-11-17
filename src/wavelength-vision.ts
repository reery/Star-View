import { Color } from 'three'
import { Bone, Eye, Radiation, Rainbow, SatelliteDish, Sun, ThermometerSnowflake, ThermometerSun, type IconNode } from 'lucide'
import { appearanceKelvin, mapAbsoluteMagnitude } from './astronomy'
import type { NebulaObjectType, Star } from './catalog-model'

export const WavelengthVisionIcon = Rainbow

/** A section of the spectrum the map can show, ordered from the shortest wavelength to the longest. */
export interface WavelengthBand {
  id: string
  label: string
  range: string
  /** Shortest and longest wavelength in m, which size the band on the logarithmic spectrum bar; the open ends stop at 0.01 pm (about 120 MeV) and 1 m (300 MHz). */
  wavelengthsM: readonly [number, number]
  icon: IconNode
  /**
   * False colors the band is drawn in, from its short-wavelength end to its long one; visible light keeps its own colors.
   * They follow NASA's multiwavelength composites, which order colors by wavelength (chromatic ordering): the 2017 Crab
   * Nebula composite shows X-rays purple, ultraviolet blue, infrared yellow and radio red. Gamma rays continue past
   * purple to magenta, and the far infrared sits between the near infrared's yellow and the radio's red.
   */
  colors: readonly string[]
  description: string
  /** Objects whose Info image was taken in this light, linked below the description. */
  infoImages?: readonly { id: string; name: string; catalog: string }[]
}

export const WAVELENGTH_BANDS = [
  {
    id: 'gamma', label: 'Gamma rays', range: '< 0.01 nm', wavelengthsM: [1e-14, 1e-11], icon: Radiation, colors: ['#ff4fb8', '#e04cf0'],
    description: 'The most energetic light, from particles sped up near pulsars, black holes and in the shock waves of supernova remnants. Cosmic rays striking interstellar gas make the whole Milky Way plane glow.',
  },
  {
    id: 'x-ray', label: 'X-rays', range: '0.01–10 nm', wavelengthsM: [1e-11, 1e-8], icon: Bone, colors: ['#b24cf0', '#8f5cf6'],
    description: 'Gas at millions of degrees: supernova remnants, the coronae of young, active stars and matter falling onto neutron stars and black holes. Ordinary stars fade, and the hot gas of the Local Bubble around the Sun glows faintly.',
    infoImages: [
      { id: 'tychos-supernova-remnant', name: 'Tycho’s Supernova Remnant', catalog: 'nebulae' },
      { id: 'keplers-supernova-remnant', name: 'Kepler’s Supernova Remnant', catalog: 'nebulae' },
      { id: 'sn-1006', name: 'SN 1006', catalog: 'nebulae' },
      { id: 'rx-j1713-3946', name: 'RX J1713.7-3946', catalog: 'nebulae' },
    ],
  },
  {
    id: 'ultraviolet', label: 'Ultraviolet', range: '10–400 nm', wavelengthsM: [1e-8, 4e-7], icon: Sun, colors: ['#5b6cf8', '#3b9af6'],
    description: 'Light of the hottest stars: young blue O and B stars and white dwarfs outshine everything else, while cool red stars almost vanish. Dust blocks ultraviolet even more strongly than visible light.',
    infoImages: [{ id: 'sun', name: 'Sun', catalog: 'nearest-100' }],
  },
  {
    id: 'visible', label: 'Visible light', range: '400–700 nm', wavelengthsM: [4e-7, 7e-7], icon: Eye, colors: ['#8f3dff', '#2f6bff', '#22c55e', '#facc15', '#f97316', '#e62e2e'],
    description: 'The light our eyes see. Stars shine in the colors their temperatures give them, glowing hydrogen turns emission nebulae red, and dust clouds block the light behind them.',
  },
  {
    id: 'near-infrared', label: 'Near infrared', range: '0.7–5 µm', wavelengthsM: [7e-7, 5e-6], icon: ThermometerSun, colors: ['#fde047', '#fbc531'],
    description: 'Dust becomes nearly transparent, so dark clouds fade and the stars behind them appear. Cool red giants, red dwarfs and brown dwarfs stand out, while hot blue stars lose their lead.',
    infoImages: [
      { id: 'ic-348', name: 'IC 348', catalog: 'nebulae' },
      { id: 'ngc-2071', name: 'NGC 2071', catalog: 'nebulae' },
      { id: 'wise-0855-0714', name: 'WISE 0855-0714', catalog: 'nearest-100' },
    ],
  },
  {
    id: 'far-infrared', label: 'Far infrared', range: '25 µm–1 mm', wavelengthsM: [2.5e-5, 1e-3], icon: ThermometerSnowflake, colors: ['#fdab3d', '#f97a28'],
    description: 'Cold dust glows: the dark clouds that block visible light turn bright, and star-forming regions light up. Most stars disappear.',
  },
  {
    id: 'radio', label: 'Radio', range: '> 1 mm', wavelengthsM: [1e-3, 1], icon: SatelliteDish, colors: ['#f0543c', '#d42a2a'],
    description: 'Pulsars, the shock waves of supernova remnants and ionized gas in star-forming regions shine. Cold molecular clouds glow in the light of carbon monoxide, and electrons spiraling in the Galaxy’s magnetic field make the Milky Way a bright band. Almost all stars vanish.',
    infoImages: [{ id: 'sn-1006', name: 'SN 1006', catalog: 'nebulae' }],
  },
] as const satisfies readonly WavelengthBand[]

export type WavelengthBandId = typeof WAVELENGTH_BANDS[number]['id']
export const DEFAULT_WAVELENGTH_BAND: WavelengthBandId = 'visible'

export const wavelengthBand = (id: WavelengthBandId): WavelengthBand => WAVELENGTH_BANDS.find((band) => band.id === id)!

export const isWavelengthBandId = (value: unknown): value is WavelengthBandId => WAVELENGTH_BANDS.some((band) => band.id === value)

/** CSS background of a band's section in the spectrum bar. */
export const wavelengthBandGradient = ({ colors }: WavelengthBand): string => `linear-gradient(90deg, ${colors.join(', ')})`

/** The band's false color at t, from its short-wavelength end (0) to its long one (1). */
export function wavelengthBandColor(id: WavelengthBandId, t: number, target = new Color()): Color {
  const { colors } = wavelengthBand(id)
  const scaled = Math.max(0, Math.min(1, t)) * (colors.length - 1)
  const index = Math.min(colors.length - 2, Math.floor(scaled))
  return target.set(colors[index]!).lerp(new Color(colors[index + 1]!), scaled - index)
}

// Measured brightness outside visible light (scripts/author-wavelength-photometry.py), one file per band, which
// `src/wavelength-data.ts` loads the first time its band is shown. Values are K or IRAS magnitudes, X-ray and
// gamma-ray energy fluxes (erg cm⁻² s⁻¹) or radio flux densities (mJy), as the file's unit says.
export type MeasuredEntry = readonly [value: number, error: number | null, source: string, identifier?: string, scope?: string]
export interface WavelengthBandData {
  unit: string
  sources: Readonly<Record<string, { label: string; reference: string; url: string; note: string }>>
  objects: Readonly<Record<string, MeasuredEntry>>
}
const bandData = new Map<WavelengthBandId, WavelengthBandData>()

export const hasWavelengthBandData = (band: WavelengthBandId) => bandData.has(band)

/** Makes a band's measured values available to the band rules. */
export function registerWavelengthBandData(band: WavelengthBandId, data: WavelengthBandData): void {
  bandData.set(band, data)
}

/** A band's measured values with their unit and sources, once loaded. */
export const wavelengthBandData = (band: WavelengthBandId): WavelengthBandData | undefined => bandData.get(band)

export const measuredInBand = (id: string, band: WavelengthBandId): MeasuredEntry | undefined => bandData.get(band)?.objects[id]

// Display magnitudes of measured fluxes: 1e-10 erg cm⁻² s⁻¹ in X-rays, 1 Jy in radio and 1e-8 erg cm⁻² s⁻¹ in gamma rays
// show like magnitude 0, so the brightest coronal stars, Vela's radio pulsar and Vela's gamma-ray pulsar lead their skies.
const FLUX_ZERO_POINTS: Partial<Record<WavelengthBandId, number>> = { 'x-ray': 1e-10, radio: 1000, gamma: 1e-8 }

function measuredApparentMagnitude(value: number, band: WavelengthBandId): number {
  const zeroPoint = FLUX_ZERO_POINTS[band]
  return zeroPoint === undefined ? value : -2.5 * Math.log10(value / zeroPoint)
}

// Everything below is a display model built from the shipped catalog values. It ranks and shades objects within a
// band where nothing is measured; none of it is a measurement, and none of it is shown as a number.

const STELLAR_TYPES = new Set<Star['type']>(['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'])
const COMPACT_TYPES = new Set<Star['type']>(['pulsar', 'neutron_star', 'black_hole'])

// Effective wavelengths in µm: GALEX NUV and Johnson V.
const NUV_WAVELENGTH_UM = 0.23
const V_WAVELENGTH_UM = 0.55
const SECOND_RADIATION_CONSTANT_UM_K = 14_388
const VEGA_KELVIN = 9600
const SUN_KELVIN = 5772
const SUN_ABSOLUTE_V = 4.83
const SUN_BOLOMETRIC = 4.74

// Teff, V − Ks, Mbol − M_Ks and M_Ks of the mean dwarf sequence, version 2022.04.16 (Pecaut & Mamajek), sparse anchors;
// null where the table has none. Blackbody colors miss the molecular bands of cool dwarfs by many magnitudes
// (V − K of a 600 K blackbody is 33), so the near infrared uses these measured colors instead.
// https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt
const DWARF_K_SEQUENCE = [
  [33300, -1.0, -4.11, -3.2], [26000, -0.87, -3.45, -2.13], [20600, -0.6, -2.63, -1.2], [15700, -0.38, -1.81, -0.38],
  [12300, -0.25, -0.98, 0.25], [9700, 0.04, -0.17, 0.95], [8100, 0.4, 0.4, 1.61], [7220, 0.73, 0.74, 1.84],
  [6550, 1.08, 1.06, 2.29], [5770, 1.56, 1.48, 3.24], [5270, 1.95, 1.76, 3.83], [4440, 2.88, 2.25, 4.4],
  [3850, 3.65, 2.5, 5.15], [3560, 4.23, 2.61, 5.98], [3210, 5.25, 2.74, 7.36], [2810, 7.1, 2.97, 9.22],
  [2570, 8.7, 3.03, 9.92], [2380, 9.0, 3.14, 10.4], [2270, 9.4, 3.2, 10.55], [2060, 9.9, 3.28, 11.0],
  [1870, 10.5, 3.27, 11.5], [1710, 11.1, 3.36, 11.87], [1550, null, 3.5, 12.2], [1420, null, 3.38, 12.74],
  [1255, null, 3.27, 13.12], [1160, null, 2.22, 14.9], [1040, null, 2.24, 15.1], [950, null, 2.24, 15.3],
  [825, null, 2.37, 15.8], [750, null, 2.09, 16.5], [680, null, 2.12, 16.9], [600, null, 1.27, 18.3],
  [560, null, 1.52, 18.6], [450, null, 0.04, 21.0], [360, null, null, 22.2],
] as const

/** A column of the dwarf K sequence interpolated linearly in Teff, held at the hottest row; null below its coolest row. */
function dwarfK(kelvin: number, column: 1 | 2 | 3): number | null {
  const rows = DWARF_K_SEQUENCE.filter((row) => row[column] !== null)
  const index = rows.findIndex((row) => row[0] <= kelvin)
  if (index <= 0) return index < 0 ? null : rows[0]![column]
  const [hot, cool] = [rows[index - 1]!, rows[index]!]
  return cool[column]! + (hot[column]! - cool[column]!) * (kelvin - cool[0]) / (hot[0] - cool[0])
}

/** Absolute K from V and the dwarf color, else from luminosity and the K bolometric correction, else a brown dwarf's sequence M_Ks. */
function absoluteK(star: Star, kelvin: number): number | null {
  const visual = mapAbsoluteMagnitude(star)
  const color = dwarfK(kelvin, 1)
  if (visual !== null && color !== null) return visual - color
  const correction = dwarfK(kelvin, 2)
  if (star.luminosity_solar && star.luminosity_solar > 0 && correction !== null) return SUN_BOLOMETRIC - 2.5 * Math.log10(star.luminosity_solar) - correction
  return star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf' ? dwarfK(kelvin, 3) : null
}

/** Blackbody spectral radiance at a wavelength, up to a constant factor. */
const planck = (um: number, kelvin: number) => um ** -5 / Math.expm1(SECOND_RADIATION_CONSTANT_UM_K / (um * kelvin))

/** Blackbody color index band − V in magnitudes, zero for a Vega-like 9,600 K star; negative where the band is relatively brighter. */
export function blackbodyColorIndex(kelvin: number, um: number): number {
  const ratio = (temperature: number) => planck(um, temperature) / planck(V_WAVELENGTH_UM, temperature)
  return -2.5 * Math.log10(ratio(kelvin) / ratio(VEGA_KELVIN))
}

/** The map's absolute V, or one from luminosity and temperature with a blackbody correction when V is missing. */
function absoluteVisual(star: Star, kelvin: number | null): number | null {
  const visual = mapAbsoluteMagnitude(star)
  if (visual !== null || kelvin === null || !star.luminosity_solar || star.luminosity_solar <= 0) return visual
  const shareOfV = (temperature: number) => planck(V_WAVELENGTH_UM, temperature) / temperature ** 4
  return SUN_ABSOLUTE_V - 2.5 * Math.log10(star.luminosity_solar * shareOfV(kelvin) / shareOfV(SUN_KELVIN))
}

// Radio: 1 Jy at 1.4 GHz shows like magnitude 0, so Vela (about 1 Jy) is among the brightest dots.
// A luminosity L (mJy kpc²) at d pc gives m = −2.5 log(L / d_kpc² / 1000), so M = −2.5 log L − 2.5.
const RADIO_MAGNITUDE_OFFSET = -2.5
// Without fluxes in the catalog, gamma-ray pulsars and X-ray-emitting remnants share one luminosity each,
// so only distance ranks them: Vela's pulsar shows near magnitude 1 in gamma rays.
const GAMMA_PULSAR_ABSOLUTE = -6.3
const X_RAY_REMNANT_ABSOLUTE = -9

const emitsGamma = (star: Star) => star.compact?.associations.some((association) => association.startsWith('Gamma-ray source')) ?? false
const emitsXRays = (star: Star) => !!star.compact && (/X-ray/.test(star.compact.detection_method)
  || star.compact.associations.some((association) => association.startsWith('X-ray source')))

/** Whether a point-like object (a star or compact remnant) gives off light in the band. */
export function shownInBand(star: Star, band: WavelengthBandId): boolean {
  if (band === 'visible' || (band === 'ultraviolet' || band === 'near-infrared') && (STELLAR_TYPES.has(star.type) || COMPACT_TYPES.has(star.type))) return true
  if (star.nebula) return nebulaBandSurfaceBrightness(star, band) !== null
  if (measuredInBand(star.id, band)) return true
  // Dark nebulae are cloud dust, so they appear in the bands where their clouds do.
  if (star.molecular_cloud || star.dark_nebula) {
    const { absorption, glow } = MOLECULAR_CLOUD_BANDS[band]
    return glow > 0 || absorption >= 0.3
  }
  if (star.bubble || star.galaxy) return true
  if (band === 'radio') return star.compact?.radio_luminosity_1400_mjy_kpc2 != null
  if (band === 'gamma') return emitsGamma(star)
  if (band === 'x-ray') return emitsXRays(star)
  return false
}

/** Absolute magnitude a point-like object shows with in the band; null when unknown, like a missing V. */
export function wavelengthAbsoluteMagnitude(star: Star, band: WavelengthBandId): number | null {
  if (band === 'visible') return mapAbsoluteMagnitude(star)
  if (!shownInBand(star, band) || !(STELLAR_TYPES.has(star.type) || COMPACT_TYPES.has(star.type))) return null
  const measured = measuredInBand(star.id, band)
  if (measured) {
    const distancePc = Math.hypot(star.x_pc, star.y_pc, star.z_pc)
    return distancePc > 0 ? measuredApparentMagnitude(measured[0], band) - 5 * Math.log10(distancePc / 10) : null
  }
  if (band === 'radio') return -2.5 * Math.log10(star.compact!.radio_luminosity_1400_mjy_kpc2!) + RADIO_MAGNITUDE_OFFSET
  if (band === 'gamma') return GAMMA_PULSAR_ABSOLUTE
  if (band === 'x-ray') return X_RAY_REMNANT_ABSOLUTE
  const kelvin = STELLAR_TYPES.has(star.type) ? appearanceKelvin(star) : null
  // Without a temperature the band color is unknown, so the object keeps its visible brightness.
  if (kelvin === null) return mapAbsoluteMagnitude(star)
  if (band === 'near-infrared') return absoluteK(star, kelvin) ?? mapAbsoluteMagnitude(star)
  const visual = absoluteVisual(star, kelvin)
  return visual === null ? null : visual + blackbodyColorIndex(kelvin, NUV_WAVELENGTH_UM)
}

/** Shade within the band's colors: hot stars toward the short-wavelength end, cool ones toward the long one. */
export function wavelengthStarColor(star: Star, band: WavelengthBandId, target = new Color()): Color {
  const kelvin = STELLAR_TYPES.has(star.type) ? appearanceKelvin(star) : null
  const t = kelvin === null ? 0.5 : (Math.log10(30_000) - Math.log10(kelvin)) / (Math.log10(30_000) - Math.log10(2_000))
  return wavelengthBandColor(band, t, target)
}

// Nebula surface brightness in a band, as an offset (mag/arcsec²) from the visible-light value that sets
// their exposure. Missing bands are dark. Offsets follow what each kind of nebula emits: reflection
// nebulae scatter blue light and their dust glows in the far infrared; H II regions are bright in free–free
// radio and warm-dust infrared emission; planetary nebulae glow in molecular hydrogen in the near infrared.
const NEBULA_BAND_OFFSETS: Record<NebulaObjectType, Partial<Record<WavelengthBandId, number>>> = {
  reflection_nebula: { ultraviolet: -0.5, visible: 0, 'near-infrared': 1.5, 'far-infrared': -1 },
  hii_region: { 'x-ray': 4, ultraviolet: 1.5, visible: 0, 'near-infrared': 0.5, 'far-infrared': -1.5, radio: -1 },
  planetary_nebula: { 'x-ray': 4, ultraviolet: 0, visible: 0, 'near-infrared': 1, 'far-infrared': 1.5, radio: 1 },
  supernova_remnant: { ultraviolet: 1, visible: 0, 'near-infrared': 2.5, 'far-infrared': 2.5 },
}

// Nebulae whose light in a band is unlike their kind's offsets and has no measured flux: display surface brightness
// (mag/arcsec² equivalents) ranked by their observed brightness — the Crab and the young Tycho and Kepler remnants
// are the brightest X-ray remnants. Measured radio (Green's catalog) and gamma-ray (4FGL) fluxes take precedence.
// The Cygnus Loop is one of the brightest soft X-ray sources in the sky (ROSAT, Levenson et al. 1997) and glows
// across its whole shell in GALEX far-ultraviolet images. Hot gas from the winds of massive stars fills the H II
// regions of the most massive clusters: 30 Doradus (Townsley et al. 2006), M17 and the Rosette (Townsley et al.
// 2003) and the Carina Nebula (Townsley et al. 2011).
const NEBULA_BANDS: Record<string, Partial<Record<WavelengthBandId, number>>> = {
  'cassiopeia-a': { 'x-ray': 21.5 },
  'crab-nebula': { 'x-ray': 20.5, 'near-infrared': 22, 'far-infrared': 23 },
  'vela-supernova-remnant': { 'x-ray': 23.5 },
  'sn-1006': { gamma: 27, 'x-ray': 24 },
  'rx-j1713-3946': { 'x-ray': 24.5 },
  'tychos-supernova-remnant': { 'x-ray': 22.5 },
  'keplers-supernova-remnant': { 'x-ray': 22.5 },
  'rcw-86': { 'x-ray': 24 },
  hoinga: { 'x-ray': 26 },
  'monogem-ring': { 'x-ray': 27 },
  'pa-30': { 'x-ray': 26 },
  'sn-1987a': { 'x-ray': 22, radio: 22 },
  'veil-nebula': { 'x-ray': 22.5, ultraviolet: 23 },
  'tarantula-nebula': { 'x-ray': 21.5 },
  'omega-nebula': { 'x-ray': 22.5 },
  'carina-nebula': { 'x-ray': 23 },
  'rosette-nebula': { 'x-ray': 24 },
}

// Surface brightness of a measured remnant flux spread over its catalogued ellipse, on the same display scale:
// the zero points keep Cas A in radio and the Crab in gamma rays at the brightness their ranked values had.
const REMNANT_SURFACE_ZERO_POINTS: Partial<Record<WavelengthBandId, number>> = { radio: 24.28, gamma: -13.75 }

function measuredSurfaceBrightness(star: Star, band: WavelengthBandId): number | null {
  const measured = measuredInBand(star.id, band)
  const zeroPoint = REMNANT_SURFACE_ZERO_POINTS[band]
  if (!measured || zeroPoint === undefined) return null
  const [major, minor] = star.nebula!.angular_size_arcmin
  const areaArcsec2 = Math.PI / 4 * major * minor * 3600
  return zeroPoint - 2.5 * Math.log10(measured[0] / areaArcsec2)
}

/** Display surface brightness (mag/arcsec²) of a nebula in the band; null where it is dark. */
export function nebulaBandSurfaceBrightness(star: Star, band: WavelengthBandId): number | null {
  const details = star.nebula
  if (!details) return null
  const fixed = measuredSurfaceBrightness(star, band) ?? NEBULA_BANDS[star.id]?.[band]
  if (fixed !== undefined) return fixed
  const offset = NEBULA_BAND_OFFSETS[star.type as NebulaObjectType]?.[band]
  return offset === undefined ? null : details.surface_brightness_mag_arcsec2 + offset
}

/** A nebula's shape in a band where it looks unlike its visible-light model: the kind drawn, its size relative to the catalogued shape, and a remnant card's “Drawn as”. */
export interface RemnantBandShape { kind: 'ellipsoid' | 'shell'; scale: number; drawnAs: string }

// The Crab's X-rays and gamma rays come from the pulsar wind nebula's core, about a third of the optical nebula across,
// while its synchrotron radio and warm dust fill the whole nebula. ROSAT shows Vela and the Monogem Ring as filled
// glows of hot gas, and RCW 86 and the Cygnus Loop as complete shells. In the H II regions above, the hot gas fills
// the cavity the cluster has cleared, inside the glowing hydrogen.
const CRAB_CORE: RemnantBandShape = { kind: 'ellipsoid', scale: 0.4, drawnAs: 'Pulsar wind nebula core in false color' }
const CRAB_FILLED: RemnantBandShape = { kind: 'ellipsoid', scale: 1, drawnAs: 'Synchrotron nebula in false color' }
const HOT_GAS: RemnantBandShape = { kind: 'ellipsoid', scale: 1, drawnAs: 'Hot-gas glow in false color' }
const SHOCK_SHELL: RemnantBandShape = { kind: 'shell', scale: 1, drawnAs: 'Shock shell in false color' }
const NEBULA_BAND_SHAPES: Record<string, Partial<Record<WavelengthBandId, RemnantBandShape>>> = {
  'crab-nebula': { gamma: CRAB_CORE, 'x-ray': CRAB_CORE, 'far-infrared': { ...CRAB_FILLED, drawnAs: 'Synchrotron nebula and warm dust in false color' }, radio: CRAB_FILLED },
  'vela-supernova-remnant': { 'x-ray': HOT_GAS },
  'monogem-ring': { 'x-ray': HOT_GAS },
  'rcw-86': { gamma: SHOCK_SHELL, 'x-ray': SHOCK_SHELL },
  // The traced field spans 1.25 times the Cygnus Loop's catalogued size; its shell is drawn at that size.
  'veil-nebula': { 'x-ray': { ...SHOCK_SHELL, scale: 0.67 } },
  'tarantula-nebula': { 'x-ray': { ...HOT_GAS, scale: 0.8 } },
  'omega-nebula': { 'x-ray': { ...HOT_GAS, scale: 0.6 } },
  'carina-nebula': { 'x-ray': { ...HOT_GAS, scale: 0.5 } },
  'rosette-nebula': { 'x-ray': { ...HOT_GAS, scale: 0.4 } },
}

export const remnantBandShape = (id: string, band: WavelengthBandId): RemnantBandShape | undefined => NEBULA_BAND_SHAPES[id]?.[band]

/**
 * Molecular clouds: absorption scales their visible-light extinction (near-infrared extinction is about a tenth of
 * visible, ultraviolet about twice); glow draws their cold dust (far infrared) or carbon monoxide (radio) as light.
 */
export const MOLECULAR_CLOUD_BANDS: Record<WavelengthBandId, { absorption: number; glow: number }> = {
  gamma: { absorption: 0, glow: 0 },
  'x-ray': { absorption: 0.8, glow: 0 },
  ultraviolet: { absorption: 1.8, glow: 0 },
  visible: { absorption: 1, glow: 0 },
  'near-infrared': { absorption: 0.12, glow: 0 },
  'far-infrared': { absorption: 0, glow: 1 },
  radio: { absorption: 0, glow: 0.6 },
}

/** The galaxy models' starlight and dust: dust absorbs less toward the infrared and glows in its own light there. */
export const GALAXY_BANDS: Record<WavelengthBandId, { emission: number; dust: number }> = {
  gamma: { emission: 0.35, dust: 0 },
  'x-ray': { emission: 0.25, dust: 0.6 },
  ultraviolet: { emission: 0.5, dust: 1.6 },
  visible: { emission: 1, dust: 1 },
  'near-infrared': { emission: 1.2, dust: 0.15 },
  'far-infrared': { emission: 0.8, dust: 0 },
  radio: { emission: 0.6, dust: 0 },
}

// Hot gas fills the Local Bubble, Loop I and the Orion–Eridanus superbubble, so their shells glow brighter in X-rays.
const X_RAY_BUBBLES = new Set(['local-bubble', 'loop-i-superbubble', 'orion-eridanus-superbubble'])
export const bubbleBandWeight = (id: string, band: WavelengthBandId) => band === 'x-ray' && X_RAY_BUBBLES.has(id) ? 1.8 : 1

/** Collapsed clouds of distant red and brown dwarfs: brighter in the near infrared, gone where such stars are dark. */
export const FAINT_CLOUD_BANDS: Record<WavelengthBandId, number> = {
  gamma: 0, 'x-ray': 0, ultraviolet: 0, visible: 1, 'near-infrared': 1.5, 'far-infrared': 0, radio: 0,
}
