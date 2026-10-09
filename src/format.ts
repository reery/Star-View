const NOT_AVAILABLE = 'Not available'

/** Fixed decimals, falling back to significant digits so tiny nonzero values never display as 0. */
export function formatNumber(value: number, maximumFractionDigits = 3): string {
  const rounded = value.toLocaleString('en-US', { maximumFractionDigits })
  return value !== 0 && Number(rounded.replace(/,/g, '')) === 0
    ? value.toLocaleString('en-US', { maximumSignificantDigits: 3 })
    : rounded
}

export function quantity(value: number | null, unit = '', maximumFractionDigits = 3): string {
  if (value === null) return NOT_AVAILABLE
  return `${formatNumber(value, maximumFractionDigits)}${unit ? ` ${unit}` : ''}`
}

export function measurement(value: number | null, error: number | null, unit: string, maximumFractionDigits = 3): string {
  if (value === null) return NOT_AVAILABLE
  const uncertainty = error === null ? '' : ` ± ${formatNumber(error, maximumFractionDigits)}`
  return `${formatNumber(value, maximumFractionDigits)}${uncertainty} ${unit}`
}

function significant(value: number, digits: number): string {
  const absolute = Math.abs(value)
  return absolute > 0 && (absolute < 1e-6 || absolute >= 1e9)
    ? value.toExponential(digits - 1).replace('e+', 'e')
    : value.toLocaleString('en-US', { maximumSignificantDigits: digits })
}

export function preciseMeasurement(value: number | null, error: number | null, unit: string): string {
  if (value === null) return NOT_AVAILABLE
  const uncertainty = error === null ? '' : ` ± ${significant(error, 3)}`
  return `${significant(value, 8)}${uncertainty} ${unit}`
}

export function scientificQuantity(value: number | null, unit: string): string {
  if (value === null) return NOT_AVAILABLE
  return `${value.toExponential(3).replace('e+', 'e')} ${unit}`
}
