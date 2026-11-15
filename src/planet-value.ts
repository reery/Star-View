/** Digits and the minus sign as superscript characters. */
export const superscript = (value: number) => String(value).replace(/[-\d]/g, (character) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(character)]!)

export function scientificPlanetValue(value: number, significantDigits = 4): string {
  const [mantissa, exponent] = value.toExponential(significantDigits - 1).split('e')
  const formatted = Number(mantissa).toLocaleString('en-US', { maximumFractionDigits: significantDigits - 1 })
  return `${formatted} × 10${superscript(Number(exponent))}`
}
