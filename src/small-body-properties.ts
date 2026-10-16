import definitions from './data/generated/small-body-details.json'
import type { PlanetSpec } from './planet-properties'
import { scientificPlanetValue } from './planet-value'

export interface SmallBodyMeasurement {
  readonly value: number
  readonly uncertainty?: string | null
  readonly source: string
  readonly detail: string
}

export interface SmallBodyDescription {
  readonly kind: 'small-body'
  readonly id: string
  readonly name: string
  readonly hostStarId: 'sun'
  readonly group: 'asteroid-belt' | 'dwarf-planets'
  readonly number: number
  readonly designation: string
  readonly color: string
  readonly moonCount: number
  readonly semiMajorAxisAu: number
  readonly orbitEpoch: string
  readonly metrics: Readonly<Record<string, SmallBodyMeasurement | undefined>>
}

export const smallBodies = definitions.objects as readonly SmallBodyDescription[]

export function isSmallBody(planet: { readonly id: string; readonly kind?: string }): planet is SmallBodyDescription {
  return planet.kind === 'small-body'
}

const format = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 4 })

export function smallBodyPhysicalSpecs(body: SmallBodyDescription): PlanetSpec[] {
  const metric = (key: string, label: string, unit: string, earthReference?: number): PlanetSpec => {
    const measurement = body.metrics[key]
    const value = measurement?.value
    return {
      id: key, label, value: value === undefined ? '—' : `${key === 'mass' ? scientificPlanetValue(value) : format(value)}${unit ? ` ${unit}` : ''}`,
      comparison: '', earthRatios: value !== undefined && earthReference ? [value / earthReference] : undefined,
      detail: measurement ? `${measurement.detail}${measurement.uncertainty ? ` Published uncertainty: ${measurement.uncertainty}.` : ''}` : 'No adopted measurement for this object. Unresolved system measurements are not assigned to an individual body.',
      sourceUrl: measurement?.source,
    }
  }
  return [
    metric('mean-diameter', 'Diameter', 'km', 12742),
    metric('mean-radius', 'Radius', 'km', 6371),
    metric('mass', 'Mass', 'kg', 5.9722e24),
    metric('mean-density', 'Density', 'g/cm³', 5.513),
    metric('surface-gravity', 'Surface gravity', 'm/s²', 9.82),
    metric('sidereal-rotation-period', 'Rotation period (sidereal)', 'h'),
    metric('geometric-albedo', 'Geometric albedo', ''),
    metric('absolute-magnitude', 'Absolute magnitude', 'mag'),
    metric('semi-major-axis', 'Orbital semi-major axis', 'AU'),
    metric('orbital-period', 'Orbital period', 'yr'),
    metric('eccentricity', 'Eccentricity', ''),
    metric('inclination', 'Inclination', '°'),
    metric('perihelion', 'Perihelion', 'AU'),
    metric('aphelion', 'Aphelion', 'AU'),
  ]
}
