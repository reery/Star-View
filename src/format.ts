import { scientificPlanetValue } from './planet-value'

export const MISSING_VALUE = '—'

/** Fixed decimals, falling back to significant digits so tiny nonzero values never display as 0. */
export function formatNumber(value: number, maximumFractionDigits = 3): string {
  const rounded = value.toLocaleString('en-US', { maximumFractionDigits })
  return value !== 0 && Number(rounded.replace(/,/g, '')) === 0
    ? value.toLocaleString('en-US', { maximumSignificantDigits: 3 })
    : rounded
}

export function quantity(value: number | null, unit = '', maximumFractionDigits = 3): string {
  if (value === null) return MISSING_VALUE
  return `${formatNumber(value, maximumFractionDigits)}${unit ? ` ${unit}` : ''}`
}

export function measurement(value: number | null, error: number | null, unit: string, maximumFractionDigits = 3): string {
  if (value === null) return MISSING_VALUE
  const uncertainty = error === null ? '' : ` ± ${formatNumber(error, maximumFractionDigits)}`
  return `${formatNumber(value, maximumFractionDigits)}${uncertainty} ${unit}`
}

export function preciseMeasurement(value: number | null, unit: string): string {
  if (value === null) return MISSING_VALUE
  const absolute = Math.abs(value)
  const formatted = absolute > 0 && (absolute < 1e-6 || absolute >= 1e9)
    ? scientificPlanetValue(value, 8)
    : value.toLocaleString('en-US', { maximumSignificantDigits: 8 })
  return `${formatted} ${unit}`
}

export function scientificQuantity(value: number | null, unit: string): string {
  if (value === null) return MISSING_VALUE
  return `${scientificPlanetValue(value)} ${unit}`
}
