const superscripts: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

export function scientificPlanetValue(value: number, significantDigits = 4): string {
  const [mantissa, exponent] = value.toExponential(significantDigits - 1).split('e')
  const formatted = Number(mantissa).toLocaleString('en-US', { maximumFractionDigits: significantDigits - 1 })
  return `${formatted} × 10${String(Number(exponent)).split('').map((digit) => superscripts[digit]).join('')}`
}
