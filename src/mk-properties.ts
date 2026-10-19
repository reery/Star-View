import type { Star } from './catalog-model'

export const spectralClasses = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const
export const luminosityRows = [
  ['Ia+', 'Hypergiants'], ['Ia', 'Luminous supergiants'], ['Ib', 'Supergiants'],
  ['II', 'Bright giants'], ['III', 'Giants'], ['IV', 'Subgiants'],
  ['V', 'Main sequence'], ['VI', 'Subdwarfs'],
] as const
const classPositions: Record<string, number> = { 'IA+': 0, IA: 1, IAB: 1.5, IB: 2, I: 1.5, II: 3, III: 4, IV: 5, V: 6, VI: 7 }
export interface MkPoint { spectralClass: string; subtype: number; luminosityClass: string; x: number; y: number }

// MK is a classification from spectra, not a conversion from H–R coordinates.
// Morgan, Abt & Tapscott (1978), terminology and autonomous standard grid:
// https://ned.ipac.caltech.edu/level5/March02/Morgan/Morgan1.html
export function mkPoint(star: Pick<Star, 'type' | 'spectral_type'>): MkPoint | null {
  if (star.type !== 'star') return null
  if (/[+/-]\s*[OBAFGKM]\d/i.test(star.spectral_type ?? '')) return null
  const luminosity = '(Iab|Ia\\+?|Ib|III|II|IV|VI|V|I)'
  // Am notation (e.g. A0mA1Va): place the star by its metallic-line type, as for Sirius A's usual A1V.
  const spectralType = star.spectral_type?.trim()
    .replace(/^k[OBAFGKM]\d(?:\.\d+)?h([OBAFGKM]\d(?:\.\d+)?)(?:m[OBAFGKM]\d(?:\.\d+)?)?/i, '$1')
    .replace(/^[OBAFGKM]\d(?:\.\d+)?m([OBAFGKM]\d(?:\.\d+)?)/i, '$1')
  const spectral = spectralType?.replace(/^([OBAFGKM]\d(?:\.\d+)?)m(?=[IV])/i, '$1').match(new RegExp(`^([OBAFGKM])(\\d(?:\\.\\d+)?)[?:\\s-]*\\(?\\s*${luminosity}(?:[-/]${luminosity})?(?=$|[^IV])`, 'i'))
  if (!spectral) return null
  const spectralClass = spectral[1]!.toUpperCase()
  const subtype = Number(spectral[2])
  if (!Number.isFinite(subtype) || subtype < 0 || subtype >= 10) return null
  const canonicalClass = (value: string) => value.toUpperCase().replace('IAB', 'Iab').replace('IA', 'Ia').replace('IB', 'Ib')
  const firstClass = canonicalClass(spectral[3]!)
  const secondClass = spectral[4] ? canonicalClass(spectral[4]) : null
  const row = classPositions[firstClass.toUpperCase()]!
  const lastRow = secondClass ? classPositions[secondClass.toUpperCase()]! : row
  return {
    spectralClass, subtype, luminosityClass: secondClass ? `${firstClass}–${secondClass}` : firstClass,
    x: (spectralClasses.indexOf(spectralClass as typeof spectralClasses[number]) + subtype / 10) / spectralClasses.length,
    y: ((row + lastRow) / 2 + 0.5) / luminosityRows.length,
  }
}

