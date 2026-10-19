import type { Star } from './catalog-model'

const finiteMagnitude = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

export function magnitudeCardAvailable(star: Star): boolean {
  return finiteMagnitude(star.absolute_mag) || finiteMagnitude(star.apparent_mag)
}

