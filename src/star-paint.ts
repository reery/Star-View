import { Color, SRGBColorSpace } from 'three'
import { temperatureSpectrumColor } from './astronomy'
import type { Star } from './catalog-model'
import { formatNumber } from './format'
import { scientificPlanetValue } from './planet-value'
import { radialVelocityKms } from './spec-values'

/** Overrides for one object's 3D-view appearance; magnitude drives core size and halo like an apparent magnitude. */
export interface StarPaint {
  color?: Color
  magnitude?: number | null
}

export type StarPainter = (star: Star) => StarPaint

type PaintBounds = readonly [string, string]

/** What a setting paints: an object's color, or its core size and halo. */
export type PaintChannel = 'color' | 'size'
export const PAINT_CHANNELS: readonly PaintChannel[] = ['color', 'size']
export const PAINT_HISTOGRAM_BINS = 32

/** The visible objects a fitted setting summarizes below its legend. */
export interface PaintLegend {
  bounds: PaintBounds
  /** Visible objects in equal bins between the bounds; objects outside them count in the end bins. */
  histogram: readonly number[]
  /** Visible objects without the painted quantity. */
  missing: number
}

/** Values between 0 and 1 of the extra sliders a setting offers below its legend. */
export type PaintControls = Readonly<Record<'dimness' | 'width', number>>

interface PaintControl {
  name: keyof PaintControls
  label: string
  /** Readout of the slider value at the setting's level. */
  text(value: number, level: number): string
}

interface PaintScale extends PaintLegend {
  paint(star: Star, level: number, controls: PaintControls): StarPaint
}

/** A wheel showing directions the main bar does not, with angles growing counterclockwise from the right. */
interface PaintWheel {
  /** CSS background of the wheel at a level between 0 and 1. */
  gradient(level: number, controls: PaintControls): string
  /** Labels to the right, top, left and bottom of the wheel. */
  labels: readonly [string, string, string, string]
}

interface PaintSetting {
  id: string
  label: string
  /** Bounds shown until the setting is fitted to visible objects; missing completes "objects without …". */
  legend: { bounds: PaintBounds; missing: string; note?: string; wheel?: PaintWheel }
  /** CSS gradient for the legend bar at a level between 0 and 1. */
  gradient(level: number, controls: PaintControls): string
  controls?: readonly PaintControl[]
  /** Keeps the fixed scale, without a choice between ranking and linear. */
  fixed?: true
  /** Fits the scale to the objects the map shows; a linear scale keeps the fixed legend range instead. */
  fit(stars: readonly Star[], linear: boolean): PaintScale
}

export const DEFAULT_PAINT_LEVEL = 0.5
export const PAINT_LEVEL_RANGE = [0, 1] as const
export const DEFAULT_PAINT_CONTROLS: PaintControls = { dimness: 0, width: 0.5 }
/** Magnitudes full dimness takes off the weakest painted objects; the strongest keep their paint. */
const PAINT_DIMNESS_MAGNITUDES = 5

const ABSOLUTE_MAGNITUDE_FAINT = 16
const ABSOLUTE_MAGNITUDE_BRIGHT = -8
const GRAY_FLOOR = 0.2
/** Fixed logarithmic linear scales: 0.01–100 M☉ and 10⁻⁵–10⁶ L☉. */
const MASS_POWERS = [-2, 2] as const
const LUMINOSITY_POWERS = [-5, 6] as const
/** Fixed linear radial-velocity scale in km/s, from approaching to receding. */
const RADIAL_VELOCITY_RANGE = [-100, 100] as const
const WHITE = [1, 1, 1] as const
const APPROACHING = [0.25, 0.45, 1] as const
const RECEDING = [1, 0.25, 0.2] as const
/** Fixed logarithmic temperature scale, from the coldest brown dwarfs to the hottest stars. */
const TEMPERATURE_POWERS = [Math.log10(250), Math.log10(40000)] as const
/** Fixed linear metallicity scale in dex. */
const METALLICITY_RANGE = [-2, 0.5] as const
/** Fixed logarithmic linear scale: 0.01–1,000 R☉. */
const RADIUS_POWERS = [-2, 3] as const
/** Fixed logarithmic linear scale in g/cm³, from red supergiants to white dwarfs. */
const DENSITY_POWERS = [-8, 7] as const
const SOLAR_DENSITY_G_CM3 = 1.408
/** Fixed linear scale of speed in the Galactic plane in km/s. */
const PLANAR_SPEED_RANGE = [0, 100] as const
/** Planet counts span the bright half of the fixed scale logarithmically, up to TRAPPIST-1's seven. */
const PLANET_COUNT_SCALE = 7
/** Catalog properties an object may lack; radial velocity is read separately. */
const KNOWN_FIELDS = ['spectral_type', 'temperature_k', 'mass_solar', 'radius_solar', 'luminosity_solar', 'metallicity_dex', 'age_gyr', 'absolute_mag'] as const
const KNOWN_PROPERTY_COUNT = KNOWN_FIELDS.length + 1

/** Bends linear progress with an exponent that grows exponentially with the level: linear at the midpoint,
 * up to 4× softer at the left end and 64× harsher at the right, where only the brightest objects stay bright. */
function curved(progress: number, level: number): number {
  return progress ** ((level < 0.5 ? 4 : 64) ** (2 * level - 1))
}

function gray(strength: number): number {
  return GRAY_FLOOR + (1 - GRAY_FLOOR) * strength
}

/** Magnitudes dimmed in proportion to the missing strength, so small differences among the strongest objects stand out. */
const dimming = (strength: number, dimness: number) => PAINT_DIMNESS_MAGNITUDES * dimness * (1 - strength)

function brightness(strength: number, dimness: number): number {
  return gray(strength) * 10 ** (-0.4 * dimming(strength, dimness))
}

/** Grays a tint and sizes by strength; the display magnitudes span from halo-less 3 px cores to the largest cores and halos. */
function painted(strength: number, tint: readonly number[] = WHITE, dimness = 0): StarPaint {
  const value = brightness(strength, dimness)
  return {
    color: new Color().setRGB(value * tint[0]!, value * tint[1]!, value * tint[2]!, SRGBColorSpace),
    magnitude: 10 - 12 * strength + dimming(strength, dimness),
  }
}

/** Blends from white toward a pure hue by a progress between 0 and 1. */
const saturated = (hue: readonly number[], progress: number) => hue.map((channel) => 1 + (channel - 1) * progress)

/** Blends from white at rest to full blue when approaching or red when receding, by a signed progress between −1 and 1. */
const radialTint = (signed: number) => saturated(signed < 0 ? APPROACHING : RECEDING, Math.abs(signed))

/** Brightens both extremes at the midpoint level; toward either end the other side fades out and the near side sharpens
 * like the other settings' bright end, so only its fastest objects stay bright. */
function radialStrength(signed: number, level: number): number {
  const emphasis = 2 * level - 1
  return signed * emphasis >= 0 ? curved(Math.abs(signed), 0.5 + Math.abs(emphasis) / 2) : Math.abs(signed) * (1 - Math.abs(emphasis))
}

function extended(star: Star): boolean {
  return Boolean(star.nebula || star.molecular_cloud || star.bubble)
}

/** The keys of the visible objects a setting paints, and how many of those objects lack one. */
function visibleKeys(stars: readonly Star[], value: (star: Star) => number | null) {
  const painted = stars.filter((star) => !extended(star))
  const keys = painted.map(value).filter((entry) => entry !== null)
  return { keys, missing: painted.length - keys.length }
}

function histogram(keys: readonly number[], [low, high]: readonly [number, number]): number[] {
  const counts = new Array<number>(PAINT_HISTOGRAM_BINS).fill(0)
  for (const key of keys) counts[high > low ? Math.min(PAINT_HISTOGRAM_BINS - 1, Math.floor(clamp((key - low) / (high - low)) * PAINT_HISTOGRAM_BINS)) : PAINT_HISTOGRAM_BINS >> 1]!++
  return counts
}

/** Counts the ascending values below the given one, or at or below it when inclusive. */
function countBelow(sorted: readonly number[], value: number, inclusive: boolean): number {
  let low = 0, high = sorted.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (sorted[middle]! < value || (inclusive && sorted[middle] === value)) low = middle + 1
    else high = middle
  }
  return low
}

function signed(value: number, digits: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value, digits).replace('-', '−')}`
}

/** The mean rank of a value among ascending values; equal values share it and values outside reach below 0 or past the last index. */
function meanRank(sorted: readonly number[], value: number | null): number {
  const below = value === null ? 0 : countBelow(sorted, value, false)
  const above = value === null ? sorted.length : sorted.length - countBelow(sorted, value, true)
  return below + (sorted.length - below - above - 1) / 2
}

const clamp = (value: number, min = 0) => Math.max(min, Math.min(1, value))

const logPositive = (value: number | null) => value !== null && value > 0 && Number.isFinite(value) ? Math.log10(value) : null
const decimal = (power: number) => (10 ** power).toLocaleString('en-US', { maximumSignificantDigits: 3 })
const solar = (unit: string) => (power: number) => `${decimal(power)} ${unit}`

const dimnessControl: PaintControl = {
  name: 'dimness', label: 'Dimness', text: (dimness) => dimness ? `${formatNumber(PAINT_DIMNESS_MAGNITUDES * dimness, 1)} mag` : 'Off',
}

/** The sRGB channels of a color. */
const channels = (color: Color) => { const { r, g, b } = color.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace); return [r, g, b] }

function gradient(level: number): string {
  const stops = Array.from({ length: 21 }, (_, index) => {
    const value = Math.round(gray(curved(index / 20, level)) * 255)
    return `rgb(${value} ${value} ${value}) ${index * 5}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

function radialGradient(level: number, { dimness }: PaintControls): string {
  const stops = Array.from({ length: 21 }, (_, index) => {
    const progress = index / 10 - 1
    const value = brightness(radialStrength(progress, level), dimness)
    const [red, green, blue] = radialTint(progress).map((channel) => Math.round(value * channel * 255))
    return `rgb(${red} ${green} ${blue}) ${index * 5}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** Paints from darkest to brightest by a key that grows toward the bright end, in white unless tinted; objects without a key are painted darkest.
 * The linear scale spans the fixed key range, given from the dark end. */
function keyedSetting<const Id extends string>(
  id: Id, label: string, missing: string, note: string, range: readonly [number, number], format: (key: number) => string, value: (star: Star) => number | null,
  tint?: (star: Star, strength: number) => readonly number[],
) {
  const bounds: PaintBounds = [format(range[0]), format(range[1])]
  return {
    id, label, gradient, legend: { bounds, missing, note },
    fit(stars: readonly Star[], linear: boolean): PaintScale {
      const visible = visibleKeys(stars, value)
      // Ranking spreads even closely spaced values of the visible objects over the whole scale.
      const sorted = linear ? [] : visible.keys.sort((first, second) => first - second)
      const extent = sorted.length ? [sorted[0]!, sorted.at(-1)!] as const : range
      return {
        bounds: [format(extent[0]), format(extent[1])], histogram: histogram(visible.keys, extent), missing: visible.missing,
        paint(star, level, { dimness }) {
          if (extended(star)) return {}
          const entry = value(star)
          // Objects outside the fitted set clamp to its ends.
          const progress = linear ? clamp(((entry ?? range[0]) - range[0]) / (range[1] - range[0]))
            : sorted.length < 2 ? Number(entry !== null) : clamp(meanRank(sorted, entry) / (sorted.length - 1))
          const strength = curved(progress, level)
          return painted(strength, tint?.(star, strength), dimness)
        },
      }
    },
  } satisfies PaintSetting
}

const kms = (velocity: number) => `${signed(velocity, 1)} km/s`
const speedText = (speed: number) => `${formatNumber(speed, 1)} km/s`

/** Paints approaching objects blue and receding ones red, deeper with speed; objects without a radial velocity are painted darkest.
 * Ranking spreads each side separately, so objects at rest stay white. */
const radialVelocitySetting = {
  id: 'radial-velocity' as const, label: 'Radial velocity', gradient: radialGradient, controls: [dimnessControl],
  legend: {
    bounds: [kms(RADIAL_VELOCITY_RANGE[0]), kms(RADIAL_VELOCITY_RANGE[1])],
    missing: 'a radial velocity',
    note: 'Blue objects approach the Sun and red objects recede. Rank spreads the visible objects evenly from slowest to fastest on each side; Linear uses the fixed velocity scale. Objects without a radial velocity are painted darkest.',
  },
  fit(stars: readonly Star[], linear: boolean): PaintScale {
    const { keys: velocities, missing } = visibleKeys(stars, radialVelocityKms)
    const speeds = (sign: number) => velocities.filter((entry) => entry * sign > 0).map(Math.abs).sort((first, second) => first - second)
    const sides = [speeds(-1), speeds(1)] as const
    const extent = linear || !velocities.length ? RADIAL_VELOCITY_RANGE : [sides[0].length ? -sides[0].at(-1)! : 0, sides[1].at(-1) ?? 0] as const
    return {
      bounds: [kms(extent[0]), kms(extent[1])], histogram: histogram(velocities, extent), missing,
      paint(star, level, { dimness }) {
        if (extended(star)) return {}
        const entry = radialVelocityKms(star)
        if (entry === null) return painted(0, WHITE, dimness)
        const side = entry > 0 ? sides[1] : sides[0]
        // Even the slowest ranked object keeps a trace of its side's color.
        const progress = linear ? clamp(entry / RADIAL_VELOCITY_RANGE[1], -1)
          : Math.sign(entry) * (side.length ? clamp((meanRank(side, Math.abs(entry)) + 1) / side.length) : 1)
        return painted(radialStrength(progress, level), radialTint(progress), dimness)
      },
    }
  },
} satisfies PaintSetting

/** Heliocentric velocity components in the Galactic plane, toward the Galactic center and along Galactic rotation. */
function planarVelocity({ vx_kms, vy_kms }: Star): readonly [number, number] | null {
  return vx_kms !== null && vy_kms !== null && Number.isFinite(vx_kms) && Number.isFinite(vy_kms) ? [vx_kms, vy_kms] : null
}

/** The pure sRGB hue of a direction in the Galactic plane, turning from red toward the Galactic center in the sense of Galactic longitude. */
const directionHue = (angle: number) => channels(new Color().setHSL((angle / (2 * Math.PI) % 1 + 1) % 1, 1, 0.5, SRGBColorSpace))

/** The Galactic plane seen from the north, +X toward the Galactic center to the right and +Y along rotation up: each direction in its hue,
 * blending from the slowest object's paint at the center to the fastest's at the rim, as the objects are painted. */
function directionWheel(level: number, { dimness }: PaintControls): string {
  const rings = Array.from({ length: 21 }, (_, index) => ({ at: index * 5, strength: curved(index / 20, level) }))
  const radial = (color: (strength: number) => string) => `radial-gradient(circle closest-side, ${rings.map(({ at, strength }) => `${color(strength)} ${at}%`).join(', ')})`
  // Darkening over whitening over the hues composes brightness × (white blended toward the hue), like painted().
  return [
    radial((strength) => `rgb(0 0 0 / ${(1 - brightness(strength, dimness)).toFixed(3)})`),
    radial((strength) => `rgb(255 255 255 / ${(1 - strength).toFixed(3)})`),
    // Conic angles run clockwise from the top, where Galactic directions point 90° counterclockwise from the right.
    `conic-gradient(${Array.from({ length: 13 }, (_, index) => `hsl(${(450 - index * 30) % 360} 100% 50%) ${index * 30}deg`).join(', ')})`,
  ].join(', ')
}

const motionDirection = keyedSetting('motion-direction', 'Motion direction', 'a full space velocity',
  'The wheel shows the Galactic plane from the north: each object takes the hue of its direction of motion relative to the Sun, Inward toward the Galactic center along the map\'s +X axis and Forward along the Galaxy\'s rotation, +Y. Faster objects lie farther out, more saturated and larger, so objects of one color move together. Rank spreads the visible objects evenly from slowest to fastest; Linear uses the fixed speed scale. Objects without a full space velocity are painted darkest.',
  PLANAR_SPEED_RANGE, speedText, (star) => { const velocity = planarVelocity(star); return velocity && Math.hypot(...velocity) },
  (star, strength) => { const velocity = planarVelocity(star); return velocity ? saturated(directionHue(Math.atan2(velocity[1], velocity[0])), strength) : WHITE })

/** Paints objects in the hue of their direction of motion in the Galactic plane, saturated and sized by their speed in it. */
const motionDirectionSetting = {
  ...motionDirection, controls: [dimnessControl],
  legend: { ...motionDirection.legend, wheel: { gradient: directionWheel, labels: ['Inward\n+X', 'Forward\n+Y', 'Outward\n−X', 'Backward\n−Y'] } },
} satisfies PaintSetting

const bandCenter = (level: number) => TEMPERATURE_POWERS[0] + level * (TEMPERATURE_POWERS[1] - TEMPERATURE_POWERS[0])
/** Half the band width in decades, from ±2% to ±10× around its center. */
const bandHalfWidth = (width: number) => 0.01 * 100 ** width
/** Full inside the band, fading out over one more half width on either side. */
const bandStrength = (power: number, level: number, width: number) => clamp(2 - Math.abs(power - bandCenter(level)) / bandHalfWidth(width))

function temperatureGradient(level: number, { width, dimness }: PaintControls): string {
  const stops = Array.from({ length: 21 }, (_, index) => {
    const power = TEMPERATURE_POWERS[0] + index / 20 * (TEMPERATURE_POWERS[1] - TEMPERATURE_POWERS[0])
    const value = brightness(bandStrength(power, level, width), dimness)
    const [red, green, blue] = channels(temperatureSpectrumColor(10 ** power)).map((channel) => Math.round(value * channel * 255))
    return `rgb(${red} ${green} ${blue}) ${index * 5}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** Paints objects in their temperature's color, brightest within a band on the fixed logarithmic scale; objects without a temperature are painted darkest. */
const temperatureSetting = {
  id: 'temperature' as const, label: 'Temperature', gradient: temperatureGradient, fixed: true as const,
  legend: {
    bounds: [solar('K')(TEMPERATURE_POWERS[0]), solar('K')(TEMPERATURE_POWERS[1])],
    missing: 'a temperature',
    note: 'The slider places the band; objects within it are brightest and fade over one more half width outside it. Width spreads the band. Objects without a temperature are painted darkest.',
  },
  controls: [{
    name: 'width', label: 'Width',
    text: (width, level) => {
      const [low, high] = [-1, 1].map((side) => Math.max(TEMPERATURE_POWERS[0], Math.min(TEMPERATURE_POWERS[1], bandCenter(level) + side * bandHalfWidth(width))))
      return `${decimal(low!)}–${solar('K')(high!)}`
    },
  }, dimnessControl],
  fit(stars: readonly Star[]): PaintScale {
    const { keys, missing } = visibleKeys(stars, (star) => logPositive(star.temperature_k))
    return {
      bounds: temperatureSetting.legend.bounds, histogram: histogram(keys, TEMPERATURE_POWERS), missing,
      paint(star, level, { width, dimness }) {
        if (extended(star)) return {}
        const power = logPositive(star.temperature_k)
        if (power === null) return painted(0, WHITE, dimness)
        return painted(bandStrength(power, level, width), channels(temperatureSpectrumColor(10 ** power)), dimness)
      },
    }
  },
} satisfies PaintSetting

export const PAINT_SETTINGS = [
  keyedSetting('absolute-magnitude', 'Absolute magnitude', 'an absolute magnitude',
    'Rank spreads the visible objects evenly from faintest to brightest; Linear uses the fixed magnitude scale. Objects without an absolute magnitude are painted darkest.',
    [-ABSOLUTE_MAGNITUDE_FAINT, -ABSOLUTE_MAGNITUDE_BRIGHT], (key) => signed(-key, 2),
    (star) => star.absolute_mag !== null && Number.isFinite(star.absolute_mag) ? -star.absolute_mag : null),
  keyedSetting('mass', 'Mass', 'a mass',
    'Rank spreads the visible objects evenly from lightest to heaviest; Linear uses the fixed logarithmic mass scale. Objects without a mass are painted darkest.',
    MASS_POWERS, solar('M☉'), (star) => logPositive(star.mass_solar)),
  keyedSetting('bolometric-luminosity', 'Bolometric luminosity', 'a bolometric luminosity',
    'Rank spreads the visible objects evenly from faintest to most luminous; Linear uses the fixed logarithmic luminosity scale. Objects without a bolometric luminosity are painted darkest.',
    LUMINOSITY_POWERS, solar('L☉'), (star) => logPositive(star.luminosity_solar)),
  radialVelocitySetting,
  motionDirectionSetting,
  keyedSetting('metallicity', 'Metallicity', 'a metallicity',
    'Rank spreads the visible objects evenly from most metal-poor to most metal-rich; Linear uses the fixed [Fe/H] scale. Objects without a metallicity are painted darkest.',
    METALLICITY_RANGE, (key) => `${signed(key, 2)} dex`,
    (star) => star.metallicity_dex !== null && Number.isFinite(star.metallicity_dex) ? star.metallicity_dex : null),
  {
    ...keyedSetting('planet-hosts', 'Planet hosts', 'planet archive coverage',
      'Known planet hosts are brighter and larger, more so with more planets; objects without planets or without archive coverage are painted darkest. Paint metallicity as Color and planet hosts as Size to compare them.',
      [0, 2], (key) => key < 1 ? 'No planets' : `${formatNumber(PLANET_COUNT_SCALE ** (key - 1), 0)} planets`,
      ({ known_planets: planets }) => planets == null ? null : planets && 1 + Math.log(planets) / Math.log(PLANET_COUNT_SCALE)),
    fixed: true as const,
  },
  keyedSetting('radius', 'Radius', 'a radius',
    'Rank spreads the visible objects evenly from smallest to largest; Linear uses the fixed logarithmic radius scale. Objects without a radius are painted darkest.',
    RADIUS_POWERS, solar('R☉'), (star) => logPositive(star.radius_solar)),
  keyedSetting('density', 'Density', 'a mass and radius',
    'Mean density from mass and radius. Rank spreads the visible objects evenly from most tenuous to densest; Linear uses the fixed logarithmic density scale. Objects without a mass or radius are painted darkest.',
    DENSITY_POWERS, (power) => `${Math.abs(power) < 4 ? decimal(power) : scientificPlanetValue(10 ** power, 3)} g/cm³`,
    ({ mass_solar: mass, radius_solar: radius }) => mass === null || radius === null ? null : logPositive(SOLAR_DENSITY_G_CM3 * mass / radius ** 3)),
  temperatureSetting,
  keyedSetting('data-gaps', 'Data gaps', 'catalog data',
    `Objects lacking more of ${KNOWN_PROPERTY_COUNT} catalog properties are brighter: spectral type, temperature, mass, radius, luminosity, metallicity, age, absolute magnitude and radial velocity. Rank spreads the visible objects evenly from best to least known; Linear uses the fixed count.`,
    [0, KNOWN_PROPERTY_COUNT], (key) => `${formatNumber(key, 1)} of ${KNOWN_PROPERTY_COUNT} unknown`,
    (star) => KNOWN_FIELDS.filter((field) => star[field] === null).length + Number(radialVelocityKms(star) === null)),
] as const

export type PaintSettingId = typeof PAINT_SETTINGS[number]['id']

export function isPaintSettingId(value: unknown): value is PaintSettingId {
  return PAINT_SETTINGS.some((setting) => setting.id === value)
}

export interface FittedPaint {
  painter: StarPainter
  legends: ReadonlyMap<PaintSettingId, PaintLegend>
}

function fit(setting: typeof PAINT_SETTINGS[number], visible: readonly Star[], linear: boolean): PaintScale {
  return setting.fit(visible, 'fixed' in setting || linear)
}

/** Fits a setting's legend to the visible objects as painting would, for a setting shown without painting. */
export function paintLegend(id: PaintSettingId, visible: readonly Star[], linear: boolean): PaintLegend {
  return fit(PAINT_SETTINGS.find((setting) => setting.id === id)!, visible, linear)
}

/** Combines the enabled settings, keyed to their levels and slider controls and fitted to the visible objects unless linear; null when nothing is painted.
 * Each channel takes the paint of the last setting in display order that claims it; settings claim both channels unless given. */
export function starPainter(
  enabled: ReadonlyMap<PaintSettingId, number>, visible: readonly Star[], linear: ReadonlySet<PaintSettingId> = new Set(), controls: ReadonlyMap<PaintSettingId, PaintControls> = new Map(),
  channels: ReadonlyMap<PaintSettingId, readonly PaintChannel[]> = new Map(),
): FittedPaint | null {
  const settings = PAINT_SETTINGS.filter((setting) => enabled.has(setting.id)).map((setting) => ({
    id: setting.id, channels: channels.get(setting.id) ?? PAINT_CHANNELS, scale: fit(setting, visible, linear.has(setting.id)),
  }))
  if (!settings.length) return null
  const [colored, sized] = PAINT_CHANNELS.map((channel) => settings.findLast((setting) => setting.channels.includes(channel)))
  const paint = (star: Star, setting = colored) => setting?.scale.paint(star, enabled.get(setting.id)!, controls.get(setting.id) ?? DEFAULT_PAINT_CONTROLS)
  return {
    painter: (star) => {
      const color = paint(star)
      return { color: color?.color, magnitude: (sized === colored ? color : paint(star, sized))?.magnitude }
    },
    legends: new Map(settings.map(({ id, scale }) => [id, scale])),
  }
}
