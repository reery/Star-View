import { Color, SRGBColorSpace } from 'three'
import type { Star } from './catalog-model'

/** Overrides for one object's 3D-view appearance; magnitude drives core size and halo like an apparent magnitude. */
export interface StarPaint {
  color?: Color
  magnitude?: number | null
}

export type StarPainter = (star: Star) => StarPaint

interface PaintSetting {
  id: string
  label: string
  legend: { bounds: readonly [string, string]; note?: string }
  /** CSS gradient for the legend bar at a midpoint level between 0 and 1. */
  gradient(level: number): string
  /** Refines the paint of earlier enabled settings, so settings can be combined. */
  paint(star: Star, paint: StarPaint, level: number): StarPaint
}

export const DEFAULT_PAINT_LEVEL = 0.5
export const PAINT_LEVEL_RANGE = [0, 1] as const

const ABSOLUTE_MAGNITUDE_FAINT = 16
const ABSOLUTE_MAGNITUDE_BRIGHT = -8
const GRAY_FLOOR = 0.2

/** Bends linear progress with an exponent that grows exponentially with the level: linear at the midpoint,
 * up to 4× softer at the left end and 64× harsher at the right, where only the brightest objects stay bright. */
function curved(progress: number, level: number): number {
  return progress ** ((level < 0.5 ? 4 : 64) ** (2 * level - 1))
}

function gray(strength: number): number {
  return GRAY_FLOOR + (1 - GRAY_FLOOR) * strength
}

function extended(star: Star): boolean {
  return Boolean(star.nebula || star.molecular_cloud || star.bubble)
}

export const PAINT_SETTINGS = [
  {
    id: 'absolute-magnitude',
    label: 'Absolute magnitude',
    legend: { bounds: [`+${ABSOLUTE_MAGNITUDE_FAINT}`, `−${-ABSOLUTE_MAGNITUDE_BRIGHT}`], note: 'Objects without an absolute magnitude are painted darkest.' },
    gradient(level) {
      const stops = Array.from({ length: 21 }, (_, index) => {
        const value = Math.round(gray(curved(index / 20, level)) * 255)
        return `rgb(${value} ${value} ${value}) ${index * 5}%`
      })
      return `linear-gradient(90deg, ${stops.join(', ')})`
    },
    paint(star, paint, level) {
      if (extended(star)) return paint
      const magnitude = star.absolute_mag !== null && Number.isFinite(star.absolute_mag) ? star.absolute_mag : ABSOLUTE_MAGNITUDE_FAINT
      const progress = Math.max(0, Math.min(1, (ABSOLUTE_MAGNITUDE_FAINT - magnitude) / (ABSOLUTE_MAGNITUDE_FAINT - ABSOLUTE_MAGNITUDE_BRIGHT)))
      const strength = curved(progress, level)
      const value = gray(strength)
      // Compress the intrinsic range onto the map's apparent-magnitude display range.
      return { ...paint, color: new Color().setRGB(value, value, value, SRGBColorSpace), magnitude: 8 - 10 * strength }
    },
  },
] as const satisfies readonly PaintSetting[]

export type PaintSettingId = typeof PAINT_SETTINGS[number]['id']

export function isPaintSettingId(value: unknown): value is PaintSettingId {
  return PAINT_SETTINGS.some((setting) => setting.id === value)
}

/** Combines the enabled settings, keyed to their midpoint levels, in display order; null when nothing is painted. */
export function starPainter(enabled: ReadonlyMap<PaintSettingId, number>): StarPainter | null {
  const settings = PAINT_SETTINGS.filter((setting) => enabled.has(setting.id))
  if (!settings.length) return null
  return (star) => settings.reduce<StarPaint>((paint, setting) => setting.paint(star, paint, enabled.get(setting.id)!), {})
}
