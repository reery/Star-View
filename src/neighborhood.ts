import { Globe, type IconNode } from 'lucide'

export const NEIGHBORHOOD_RADIUS_LY = { min: 1, max: 100, initial: 10 } as const
export const FIRST_BIRTH_YEAR = 1900
/** Half-width of the birth-year shell. */
export const BIRTH_YEAR_SHELL_LY = 1

// The equatorial-grid globe with its equator opened around a four-point star.
export const NeighborhoodIcon: IconNode = [
  ...Globe.filter(([, attributes]) => attributes.d !== 'M2 12h20'),
  ['path', { d: 'M2 12h6M16 12h6' }],
  ['path', { d: 'M12 8.6 12.95 11.05 15.4 12 12.95 12.95 12 15.4 11.05 12.95 8.6 12 11.05 11.05Z', fill: 'currentColor', stroke: 'none' }],
]

/**
 * Distance bounds from the center in light-years. A birth year replaces the sphere with a shell
 * at the distance light has traveled since then, so its light now arriving set out that year.
 */
export function neighborhoodBounds(radiusLy: number, birthYear: number | null, year: number): { innerLy: number; outerLy: number; sphereLy: number } {
  if (birthYear === null) return { innerLy: 0, outerLy: radiusLy, sphereLy: radiusLy }
  const sphereLy = Math.max(0, year - birthYear)
  return { innerLy: Math.max(0, sphereLy - BIRTH_YEAR_SHELL_LY), outerLy: sphereLy + BIRTH_YEAR_SHELL_LY, sphereLy }
}
