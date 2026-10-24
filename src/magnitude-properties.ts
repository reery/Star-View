import { Binoculars, Building2, Eye, Telescope, type IconNode } from 'lucide'
import type { Star } from './catalog-model'

export const NAKED_EYE_MAGNITUDE = 6
// Representative stellar limits, rather than averages across unlike instruments.
// Bortle's original scale: class 9 inner city +4 or less; class 8 city +4.5 at best.
// https://skyandtelescope.org/astronomy-resources/light-pollution-and-astronomy-the-bortle-dark-sky-scale/
// Celestron's visual limits span sky conditions and apertures; ESO's FORS V-band
// direct-imaging table reaches about +27 with a large telescope and long exposure.
export const MAGNITUDE_VISIBILITY_GUIDES = [
  { id: 'city', name: 'City sky', limit: 4.5, fadeStart: 4, detail: 'Naked eye: inner-city limit +4 or less (Bortle 9); city limit +4.5 at best (Bortle 8).', icon: Building2 },
  { id: 'eye', name: 'Naked eye', limit: NAKED_EYE_MAGNITUDE, fadeStart: 4, detail: 'Dark skies and dark-adapted eyesight.', icon: Eye },
  { id: 'binoculars', name: 'Binoculars', limit: 10, fadeStart: 8, detail: 'Typical 40–50 mm binoculars; sky conditions matter.', icon: Binoculars },
  { id: 'telescope', name: 'Telescope', limit: 13, fadeStart: 11, detail: 'Typical 100–150 mm amateur telescope under good skies.', icon: Telescope },
  { id: 'observatory', name: 'Observatory', limit: 27, fadeStart: 25, detail: 'Long-exposure camera imaging with a large professional telescope.', icon: [
    ['path', { d: 'M4 12a8 8 0 0 1 16 0M3 12h18v8H3zM2 20h20M12 4v8M15 4.6V12' }],
    ['path', { d: 'M10 20v-4h4v4' }],
  ] as IconNode },
] as const

const finiteMagnitude = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

export function magnitudeCardAvailable(star: Star): boolean {
  return finiteMagnitude(star.absolute_mag) || finiteMagnitude(star.apparent_mag)
}

