import { Color, SRGBColorSpace } from 'three'
import type { Star } from './catalog-model'
import { formatNumber } from './format'
import { radialVelocityKms } from './spec-values'

/** Overrides for one object's 3D-view appearance; magnitude drives core size and halo like an apparent magnitude. */
export interface StarPaint {
  color?: Color
  magnitude?: number | null
}

export type StarPainter = (star: Star) => StarPaint

type PaintBounds = readonly [string, string]

interface PaintScale {
  bounds: PaintBounds
  /** Refines the paint of earlier enabled settings, so settings can be combined. */
  paint(star: Star, paint: StarPaint, level: number): StarPaint
}

interface PaintSetting {
  id: string
  label: string
  /** Bounds shown until the setting is fitted to visible objects. */
  legend: { bounds: PaintBounds; note?: string }
  /** CSS gradient for the legend bar at a midpoint level between 0 and 1. */
  gradient(level: number): string
  /** Fits the scale to the objects the map shows; a linear scale keeps the fixed legend range instead. */
  fit(stars: readonly Star[], linear: boolean): PaintScale
}

export const DEFAULT_PAINT_LEVEL = 0.5
export const PAINT_LEVEL_RANGE = [0, 1] as const

const ABSOLUTE_MAGNITUDE_FAINT = 16
const ABSOLUTE_MAGNITUDE_BRIGHT = -8
const GRAY_FLOOR = 0.2
/** Fixed logarithmic linear scales: 0.01–100 M☉ and 10⁻⁵–10⁶ L☉. */
const MASS_POWERS = [-2, 2] as const
const LUMINOSITY_POWERS = [-5, 6] as const
/** Fixed linear radial-velocity scale in km/s, from approaching to receding. */
const RADIAL_VELOCITY_RANGE = [-150, 150] as const
const WHITE = [1, 1, 1] as const
const APPROACHING = [0.25, 0.45, 1] as const
const RECEDING = [1, 0.25, 0.2] as const

/** Bends linear progress with an exponent that grows exponentially with the level: linear at the midpoint,
 * up to 4× softer at the left end and 64× harsher at the right, where only the brightest objects stay bright. */
function curved(progress: number, level: number): number {
  return progress ** ((level < 0.5 ? 4 : 64) ** (2 * level - 1))
}

function gray(strength: number): number {
  return GRAY_FLOOR + (1 - GRAY_FLOOR) * strength
}

/** Grays a tint and sizes by strength; the display magnitudes span from halo-less 3 px cores to the largest cores and halos. */
function painted(paint: StarPaint, strength: number, tint: readonly number[] = WHITE): StarPaint {
  const value = gray(strength)
  return { ...paint, color: new Color().setRGB(value * tint[0]!, value * tint[1]!, value * tint[2]!, SRGBColorSpace), magnitude: 10 - 12 * strength }
}

/** Blends from white at rest to full blue when approaching or red when receding, by a signed progress between −1 and 1. */
function radialTint(signed: number): number[] {
  const hue = signed < 0 ? APPROACHING : RECEDING
  return hue.map((channel) => 1 + (channel - 1) * Math.abs(signed))
}

/** Brightens both extremes at the midpoint level; toward either end the other side fades out and the near side sharpens
 * like the other settings' bright end, so only its fastest objects stay bright. */
function radialStrength(signed: number, level: number): number {
  const emphasis = 2 * level - 1
  return signed * emphasis >= 0 ? curved(Math.abs(signed), 0.5 + Math.abs(emphasis) / 2) : Math.abs(signed) * (1 - Math.abs(emphasis))
}

function extended(star: Star): boolean {
  return Boolean(star.nebula || star.molecular_cloud || star.bubble)
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
const solar = (unit: string) => (power: number) => `${(10 ** power).toLocaleString('en-US', { maximumSignificantDigits: 3 })} ${unit}`

function gradient(level: number): string {
  const stops = Array.from({ length: 21 }, (_, index) => {
    const value = Math.round(gray(curved(index / 20, level)) * 255)
    return `rgb(${value} ${value} ${value}) ${index * 5}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

function radialGradient(level: number): string {
  const stops = Array.from({ length: 21 }, (_, index) => {
    const progress = index / 10 - 1
    const value = gray(radialStrength(progress, level))
    const [red, green, blue] = radialTint(progress).map((channel) => Math.round(value * channel * 255))
    return `rgb(${red} ${green} ${blue}) ${index * 5}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** Paints from darkest to brightest by a key that grows toward the bright end; objects without a key are painted darkest.
 * The linear scale spans the fixed key range, given from the dark end. */
function keyedSetting<const Id extends string>(id: Id, label: string, note: string, range: readonly [number, number], format: (key: number) => string, value: (star: Star) => number | null) {
  const key = (star: Star) => extended(star) ? null : value(star)
  const bounds: PaintBounds = [format(range[0]), format(range[1])]
  return {
    id, label, gradient, legend: { bounds, note },
    fit(stars: readonly Star[], linear: boolean): PaintScale {
      // Ranking spreads even closely spaced values of the visible objects over the whole scale.
      const sorted = linear ? [] : stars.map(key).filter((entry) => entry !== null).sort((first, second) => first - second)
      return {
        bounds: sorted.length ? [format(sorted[0]!), format(sorted.at(-1)!)] : bounds,
        paint(star, paint, level) {
          if (extended(star)) return paint
          const entry = key(star)
          if (linear) return painted(paint, curved(clamp(((entry ?? range[0]) - range[0]) / (range[1] - range[0])), level))
          // Objects outside the fitted set clamp to its ends.
          const progress = sorted.length < 2 ? Number(entry !== null) : clamp(meanRank(sorted, entry) / (sorted.length - 1))
          return painted(paint, curved(progress, level))
        },
      }
    },
  } satisfies PaintSetting
}

const kms = (velocity: number) => `${signed(velocity, 1)} km/s`

/** Paints approaching objects blue and receding ones red, deeper with speed; objects without a radial velocity are painted darkest.
 * Ranking spreads each side separately, so objects at rest stay white. */
const radialVelocitySetting = {
  id: 'radial-velocity' as const, label: 'Radial velocity', gradient: radialGradient,
  legend: {
    bounds: [kms(RADIAL_VELOCITY_RANGE[0]), kms(RADIAL_VELOCITY_RANGE[1])],
    note: 'Blue objects approach the Sun and red objects recede. Rank spreads the visible objects evenly from slowest to fastest on each side; Linear uses the fixed velocity scale. Objects without a radial velocity are painted darkest.',
  },
  fit(stars: readonly Star[], linear: boolean): PaintScale {
    const key = (star: Star) => extended(star) ? null : radialVelocityKms(star)
    const velocities = linear ? [] : stars.map(key).filter((entry) => entry !== null)
    const speeds = (sign: number) => velocities.filter((entry) => entry * sign > 0).map(Math.abs).sort((first, second) => first - second)
    const sides = [speeds(-1), speeds(1)] as const
    return {
      bounds: velocities.length ? [kms(sides[0].length ? -sides[0].at(-1)! : 0), kms(sides[1].at(-1) ?? 0)] : radialVelocitySetting.legend.bounds,
      paint(star, paint, level) {
        if (extended(star)) return paint
        const entry = key(star)
        if (entry === null) return painted(paint, 0)
        const side = entry > 0 ? sides[1] : sides[0]
        // Even the slowest ranked object keeps a trace of its side's color.
        const progress = linear ? clamp(entry / RADIAL_VELOCITY_RANGE[1], -1)
          : Math.sign(entry) * (side.length ? clamp((meanRank(side, Math.abs(entry)) + 1) / side.length) : 1)
        return painted(paint, radialStrength(progress, level), radialTint(progress))
      },
    }
  },
} satisfies PaintSetting

export const PAINT_SETTINGS = [
  keyedSetting('absolute-magnitude', 'Absolute magnitude',
    'Rank spreads the visible objects evenly from faintest to brightest; Linear uses the fixed magnitude scale. Objects without an absolute magnitude are painted darkest.',
    [-ABSOLUTE_MAGNITUDE_FAINT, -ABSOLUTE_MAGNITUDE_BRIGHT], (key) => signed(-key, 2),
    (star) => star.absolute_mag !== null && Number.isFinite(star.absolute_mag) ? -star.absolute_mag : null),
  keyedSetting('mass', 'Mass',
    'Rank spreads the visible objects evenly from lightest to heaviest; Linear uses the fixed logarithmic mass scale. Objects without a mass are painted darkest.',
    MASS_POWERS, solar('M☉'), (star) => logPositive(star.mass_solar)),
  keyedSetting('bolometric-luminosity', 'Bolometric luminosity',
    'Rank spreads the visible objects evenly from faintest to most luminous; Linear uses the fixed logarithmic luminosity scale. Objects without a bolometric luminosity are painted darkest.',
    LUMINOSITY_POWERS, solar('L☉'), (star) => logPositive(star.luminosity_solar)),
  radialVelocitySetting,
] as const

export type PaintSettingId = typeof PAINT_SETTINGS[number]['id']

export function isPaintSettingId(value: unknown): value is PaintSettingId {
  return PAINT_SETTINGS.some((setting) => setting.id === value)
}

export interface FittedPaint {
  painter: StarPainter
  bounds: ReadonlyMap<PaintSettingId, PaintBounds>
}

/** Combines the enabled settings, keyed to their midpoint levels and fitted to the visible objects unless linear, in display order; null when nothing is painted. */
export function starPainter(enabled: ReadonlyMap<PaintSettingId, number>, visible: readonly Star[], linear: ReadonlySet<PaintSettingId> = new Set()): FittedPaint | null {
  const settings = PAINT_SETTINGS.filter((setting) => enabled.has(setting.id)).map((setting) => ({ id: setting.id, scale: setting.fit(visible, linear.has(setting.id)) }))
  if (!settings.length) return null
  return {
    painter: (star) => settings.reduce<StarPaint>((paint, { id, scale }) => scale.paint(star, paint, enabled.get(id)!), {}),
    bounds: new Map(settings.map(({ id, scale }) => [id, scale.bounds])),
  }
}
