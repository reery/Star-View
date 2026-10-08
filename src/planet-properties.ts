import definitions from './data/planet-details.json'

export type PlanetDescription = typeof definitions.planets[number]
export type PlanetMoon = typeof definitions.moons.earth[number]
export interface PlanetSpec {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly comparison: string
  readonly detail: string
  readonly temperatureK?: readonly number[]
  readonly pressurePa?: number
  readonly pressureUpperLimit?: boolean
  readonly pressureSignificantDigits?: number
}

const earth = definitions.earth
const descriptions = new Map(definitions.planets.map((planet) => [planet.id, planet]))

export function planetDescriptionForId(id: string): PlanetDescription | undefined {
  return descriptions.get(id)
}

export function planetMoonsForId(id: string): readonly PlanetMoon[] {
  const moons: Readonly<Record<string, readonly PlanetMoon[]>> = definitions.moons
  return moons[id] ?? []
}

function number(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

const superscripts: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

export function scientificPlanetValue(value: number, significantDigits = 4): string {
  const [mantissa, exponent] = value.toExponential(significantDigits - 1).split('e')
  return `${number(Number(mantissa), significantDigits - 1)} × 10${String(Number(exponent)).split('').map((digit) => superscripts[digit]).join('')}`
}

function ratioNumber(value: number, reference: number): string {
  return (value / reference).toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

function earthRatio(value: number, reference: number): string {
  return `${ratioNumber(value, reference)}×Earth`
}

export function planetPhysicalSpecs(planet: PlanetDescription): PlanetSpec[] {
  const isEarth = planet.id === 'earth'
  const source = isEarth ? 'NASA Earth fact sheet.' : `NASA ${planet.name} and Earth fact sheets.`
  const spec = (id: string, label: string, value: string, comparison: string, detail = ''): PlanetSpec =>
    ({ id, label, value, comparison: isEarth ? '' : comparison, detail: `${detail}${detail ? ' ' : ''}${source}` })
  const surfaceArea = 4 * Math.PI * planet.meanRadiusKm ** 2
  const earthArea = 4 * Math.PI * earth.meanRadiusKm ** 2
  const magnitudeDifference = planet.absoluteMagnitudeV - earth.absoluteMagnitudeV
  const surfaceTemperature: PlanetSpec = planet.meanSurfaceTemperatureK !== undefined
    ? { ...spec('surface-temperature', 'Mean surface temperature', `${number(planet.meanSurfaceTemperatureK, 0)} K`, earthRatio(planet.meanSurfaceTemperatureK, earth.meanSurfaceTemperatureK), planet.notes.surfaceTemperatures), temperatureK: [planet.meanSurfaceTemperatureK] }
    : { ...spec('surface-temperature', 'Surface temperature (min/max)', `${planet.surfaceTemperatureMinK} / ${planet.surfaceTemperatureMaxK} K`, `${ratioNumber(planet.surfaceTemperatureMinK!, earth.meanSurfaceTemperatureK)} / ${earthRatio(planet.surfaceTemperatureMaxK!, earth.meanSurfaceTemperatureK)}`, planet.notes.surfaceTemperatures), temperatureK: [planet.surfaceTemperatureMinK!, planet.surfaceTemperatureMaxK!] }
  return [
    spec('mean-diameter', 'Mean diameter', `${number(planet.meanRadiusKm * 2, 1)} km`, earthRatio(planet.meanRadiusKm, earth.meanRadiusKm)),
    spec('mean-radius', 'Mean radius', `${number(planet.meanRadiusKm, 1)} km`, earthRatio(planet.meanRadiusKm, earth.meanRadiusKm)),
    spec('flattening', 'Flattening', number(planet.flattening, isEarth ? 6 : 4), earthRatio(planet.flattening, earth.flattening), `Equatorial-to-polar flattening; dimensionless.${planet.flattening === 0 ? ' Rounded to zero in the source; this does not establish a perfectly spherical body.' : ''}`),
    spec('surface-area', 'Surface area', `${scientificPlanetValue(surfaceArea, 3)} km²`, earthRatio(surfaceArea, earthArea), planet.notes.surfaceArea),
    spec('volume', 'Volume', `${scientificPlanetValue(planet.volumeKm3)} km³`, earthRatio(planet.volumeKm3, earth.volumeKm3)),
    spec('mass', 'Mass', `${scientificPlanetValue(planet.massKg)} kg`, earthRatio(planet.massKg, earth.massKg)),
    spec('mean-density', 'Mean density', `${number(planet.meanDensityKgM3 / 1000)} g/cm³`, earthRatio(planet.meanDensityKgM3, earth.meanDensityKgM3)),
    spec('surface-gravity', 'Surface gravity', `${number(planet.surfaceGravityMs2, 2)} m/s²`, earthRatio(planet.surfaceGravityMs2, earth.surfaceGravityMs2), 'Mean surface gravity. Earth reference: 9.82 m/s².'),
    spec('escape-velocity', 'Escape velocity', `${number(planet.escapeVelocityKmS, 2)} km/s`, earthRatio(planet.escapeVelocityKmS, earth.escapeVelocityKmS)),
    spec('synodic-rotation-period', 'Synodic rotation period', `${number(planet.solarDayHours / 24, 2)} d`, earthRatio(planet.solarDayHours, earth.solarDayHours), 'Solar day: one full day-night cycle. This is neither the sidereal rotation period nor the Earth-relative orbital synodic period.'),
    spec('albedo', 'Albedo', number(planet.bondAlbedo), earthRatio(planet.bondAlbedo, earth.bondAlbedo), 'Bond albedo: fraction of total incident solar radiation reflected. Earth reference: 0.294.'),
    { ...spec('temperature', 'Temperature', `${number(planet.blackBodyTemperatureK, 1)} K`, earthRatio(planet.blackBodyTemperatureK, earth.blackBodyTemperatureK), 'Equivalent black-body equilibrium temperature, not a measured global surface average. Earth reference: 254 K.'), temperatureK: [planet.blackBodyTemperatureK] },
    surfaceTemperature,
    spec('absolute-magnitude', 'Absolute magnitude', `${number(planet.absoluteMagnitudeV)} mag`, `${magnitudeDifference >= 0 ? '+' : '−'}${number(Math.abs(magnitudeDifference), 2)} mag vs Earth`, planet.notes.absoluteMagnitude),
    spec('apparent-magnitude', 'Apparent magnitude', planet.brightestApparentMagnitudeV === null ? 'N/A from Earth' : `${number(planet.brightestApparentMagnitudeV, 2)} mag`, 'brightest', planet.notes.apparentMagnitude),
  ]
}

export function planetAtmosphereSpecs(planet: PlanetDescription): PlanetSpec[] {
  const upperLimit = planet.surfacePressureUpperPa !== undefined
  const pressure = planet.surfacePressurePa ?? planet.surfacePressureUpperPa!
  const significantDigits = upperLimit ? 1 : planet.id === 'earth' ? 4 : 2
  return [{
    id: 'surface-pressure', label: 'Surface pressure',
    value: `${upperLimit ? '≲' : ''}${scientificPlanetValue(pressure, significantDigits)} Pa`,
    comparison: planet.id === 'earth' ? '' : `${upperLimit ? '≲' : ''}${upperLimit ? scientificPlanetValue(pressure / earth.surfacePressurePa, 3) + '×Earth' : earthRatio(pressure, earth.surfacePressurePa)}`,
    detail: planet.id === 'earth' ? `${planet.notes.atmosphere} NASA Earth fact sheet.` : `${planet.notes.atmosphere} Earth reference: 101,400 Pa. NASA ${planet.name} and Earth fact sheets.`,
    pressurePa: pressure,
    pressureUpperLimit: upperLimit,
    pressureSignificantDigits: significantDigits,
  }]
}
