import { Color, SRGBColorSpace } from 'three'
import type { Star } from './catalog-model'
import { formatNumber } from './format'

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

/** Bends linear progress with an exponent that grows exponentially with the level: linear at the midpoint,
 * up to 4× softer at the left end and 64× harsher at the right, where only the brightest objects stay bright. */
function curved(progress: number, level: number): number {
  return progress ** ((level < 0.5 ? 4 : 64) ** (2 * level - 1))
}

function gray(strength: number): number {
  return GRAY_FLOOR + (1 - GRAY_FLOOR) * strength
}

/** Grays and sizes by strength; the display magnitudes span from halo-less 3 px cores to the largest cores and halos. */
function painted(paint: StarPaint, strength: number): StarPaint {
  const value = gray(strength)
  return { ...paint, color: new Color().setRGB(value, value, value, SRGBColorSpace), magnitude: 10 - 12 * strength }
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

function signedMagnitude(magnitude: number): string {
  return `${magnitude > 0 ? '+' : ''}${formatNumber(magnitude, 2).replace('-', '−')}`
}

const logPositive = (value: number | null) => value !== null && value > 0 && Number.isFinite(value) ? Math.log10(value) : null
const solar = (unit: string) => (power: number) => `${(10 ** power).toLocaleString('en-US', { maximumSignificantDigits: 3 })} ${unit}`

function gradient(level: number): string {
  const stops = Array.from({ length: 21 }, (_, index) => {
    const value = Math.round(gray(curved(index / 20, level)) * 255)
    return `rgb(${value} ${value} ${value}) ${index * 5}%`
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
          if (linear) return painted(paint, curved(Math.max(0, Math.min(1, ((entry ?? range[0]) - range[0]) / (range[1] - range[0]))), level))
          const below = entry === null ? 0 : countBelow(sorted, entry, false)
          const above = entry === null ? sorted.length : sorted.length - countBelow(sorted, entry, true)
          // Equal values share their mean rank; objects outside the fitted set clamp to its ends.
          const rank = below + (sorted.length - below - above - 1) / 2
          const progress = sorted.length < 2 ? Number(entry !== null) : Math.max(0, Math.min(1, rank / (sorted.length - 1)))
          return painted(paint, curved(progress, level))
        },
      }
    },
  } satisfies PaintSetting
}

export const PAINT_SETTINGS = [
  keyedSetting('absolute-magnitude', 'Absolute magnitude',
    'Rank spreads the visible objects evenly from faintest to brightest; Linear uses the fixed magnitude scale. Objects without an absolute magnitude are painted darkest.',
    [-ABSOLUTE_MAGNITUDE_FAINT, -ABSOLUTE_MAGNITUDE_BRIGHT], (key) => signedMagnitude(-key),
    (star) => star.absolute_mag !== null && Number.isFinite(star.absolute_mag) ? -star.absolute_mag : null),
  keyedSetting('mass', 'Mass',
    'Rank spreads the visible objects evenly from lightest to heaviest; Linear uses the fixed logarithmic mass scale. Objects without a mass are painted darkest.',
    MASS_POWERS, solar('M☉'), (star) => logPositive(star.mass_solar)),
  keyedSetting('bolometric-luminosity', 'Bolometric luminosity',
    'Rank spreads the visible objects evenly from faintest to most luminous; Linear uses the fixed logarithmic luminosity scale. Objects without a bolometric luminosity are painted darkest.',
    LUMINOSITY_POWERS, solar('L☉'), (star) => logPositive(star.luminosity_solar)),
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
