import definitions from './data/planet-details.json'
import { extrasolarPhysicalSpecs, extrasolarPlanets, type ExtrasolarPlanet } from './exoplanet-properties'
import { scientificPlanetValue } from './planet-value'
import { isSmallBody, smallBodies, smallBodyMoons, smallBodyPhysicalSpecs, type SmallBodyDescription } from './small-body-properties'
export { isSmallBody } from './small-body-properties'
export { scientificPlanetValue } from './planet-value'

export type SolarPlanetDescription = typeof definitions.planets[number]
export type PlanetDescription = SolarPlanetDescription | ExtrasolarPlanet | SmallBodyDescription
export function isExtrasolarPlanet(planet: PlanetDescription): planet is ExtrasolarPlanet {
  return 'kind' in planet && planet.kind === 'extrasolar'
}
export interface PlanetMoon {
  readonly id: string
  readonly name: string
  readonly source: string
  readonly sourceLabel: string
  readonly meanRadiusKm: number | null
  readonly meanRadiusDetail?: string
  readonly massKg: number | null
  readonly massEstimated?: boolean
  readonly massDetail?: string
  readonly surfaceGravityMs2: number | null
  readonly surfaceGravityDetail?: string
  readonly semiMajorAxisKm: number | null
  readonly semiMajorAxisDetail?: string
  readonly orbitReference?: 'barycenter'
  readonly siderealOrbitDays: number | null
  readonly siderealOrbitDetail?: string
  readonly phaseCycleDays: number | null
  readonly phaseCycleDetail?: string
}
export interface PlanetSpec {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly comparison: string
  readonly earthRatios?: readonly number[]
  readonly apparentMagnitudeV?: number
  readonly detail: string
  readonly sourceUrl?: string
  readonly temperatureK?: readonly number[]
  readonly pressurePa?: number
  readonly pressureUpperLimit?: boolean
  readonly pressureSignificantDigits?: number
}

const earth = definitions.earth
const descriptions = new Map<string, PlanetDescription>([...definitions.planets, ...extrasolarPlanets, ...smallBodies].map((planet) => [planet.id, planet]))

export function planetApparentMagnitudeRange() {
  const planets = definitions.planets.flatMap((planet) => planet.brightestApparentMagnitudeV === null ? []
    : [{ name: planet.name, magnitude: planet.brightestApparentMagnitudeV }])
    .sort((a, b) => a.magnitude - b.magnitude)
  return { brightest: planets[0]!, faintest: planets[planets.length - 1]! }
}

export function planetDescriptionForId(id: string): PlanetDescription | undefined {
  return descriptions.get(id)
}

export function solarPlanetDescriptionForId(id: string): SolarPlanetDescription | undefined {
  const planet = descriptions.get(id)
  return planet && !isExtrasolarPlanet(planet) && !isSmallBody(planet) ? planet : undefined
}

export function planetMoonsForId(id: string): readonly PlanetMoon[] {
  const moons: Readonly<Record<string, readonly PlanetMoon[]>> = definitions.moons
  return moons[id] ?? smallBodyMoons[id] ?? []
}

export function planetMoonSpecs(moon: PlanetMoon, planetName: string): PlanetSpec[] {
  const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 4 })
  const earthMoon = planetMoonsForId('earth').find((candidate) => candidate.id === 'moon')!
  const radiusRatio = moon.meanRadiusKm === null ? null : moon.meanRadiusKm / earthMoon.meanRadiusKm!
  const comparisonNumber = (value: number, maximumSignificantDigits = 3) => value.toLocaleString('en-US', { maximumSignificantDigits })
  const radiusComparison = moon.id === earthMoon.id || radiusRatio === null ? '' : radiusRatio < 1
    ? ` About ${comparisonNumber(radiusRatio * 100, 2)}% of the radius of Earth’s Moon.`
    : ` About ${comparisonNumber(radiusRatio)} times the radius of Earth’s Moon.`
  const massRatio = moon.massKg === null ? null : moon.massKg / earthMoon.massKg!
  const massComparison = moon.id === earthMoon.id || massRatio === null ? '' : massRatio < 0.01
    ? ` About 1/${comparisonNumber(1 / massRatio, 2)} of the mass of Earth’s Moon.`
    : massRatio < 1
    ? ` About ${comparisonNumber(massRatio * 100, 2)}% of the mass of Earth’s Moon.`
    : ` About ${comparisonNumber(massRatio)} times the mass of Earth’s Moon.`
  const gravityDivisor = moon.surfaceGravityMs2 === null ? null : earth.surfaceGravityMs2 / moon.surfaceGravityMs2
  // Simple fractions stay readable while retaining a close approximation.
  const gravityFraction = gravityDivisor === null ? null : (gravityDivisor < 10 ? Math.round(gravityDivisor * 2) / 2 : gravityDivisor)
    .toLocaleString('en-US', { maximumSignificantDigits: 2 })
  const estimate = moon.massEstimated ? '≈' : ''
  const specs: [string, string, string, string][] = [
    ['mean-radius', 'Mean radius', moon.meanRadiusKm === null ? '—' : `${format(moon.meanRadiusKm)} km`,
      `A measure of the moon’s size from its center to its surface. For an uneven shape, it is the radius of a sphere with the same volume.${radiusComparison}`],
    ['mass', 'Mass', moon.massKg === null ? '—' : `${estimate}${scientificPlanetValue(moon.massKg)} kg`,
      `The amount of matter in the moon, measured in kilograms. Unlike weight, mass does not change when gravity changes.${massComparison}`],
    ['surface-gravity', 'Surface gravity', moon.surfaceGravityMs2 === null ? '—' : `${estimate}${format(moon.surfaceGravityMs2)} m/s²`,
      `How strongly ${moon.name} pulls objects toward its surface.${gravityFraction === null ? '' : ` About 1/${gravityFraction} of Earth’s gravity, so you would weigh about that fraction of your Earth weight.`}`],
    ['semi-major-axis', moon.orbitReference === 'barycenter' ? 'Barycentric semi-major axis' : 'Orbital semi-major axis', moon.semiMajorAxisKm === null ? '—' : `${format(moon.semiMajorAxisKm)} km`,
      moon.orbitReference === 'barycenter' ? 'Orbital semi-major axis relative to the Pluto–Charon barycenter, not Pluto’s center. This is an orbital size, not a current distance.' : `The size of the moon’s orbit: halfway between its closest and farthest distances from ${planetName}, measured between their centers. It is not a current distance.${moon.id === 'nereid' ? ' This orbit is very stretched out, so the distance changes a lot.' : ''}`],
    ['sidereal-orbit', 'Sidereal orbital period', moon.siderealOrbitDays === null ? '—' : `${format(moon.siderealOrbitDays)} d${moon.id === 'triton' ? ' · retrograde' : ''}`,
      `Time for ${moon.name} to go once all the way around ${planetName}. A day here means 24 hours.${moon.id === 'triton' ? ' Triton travels in the opposite direction to Neptune’s spin.' : ''}`],
    ['phase-cycle', 'Phase cycle', moon.phaseCycleDays === null ? '—' : `${format(moon.phaseCycleDays)} d`,
      `Approximate time for the visible sunlit part of the moon to repeat its cycle, such as one full moon to the next, as seen from ${planetName}. This differs from one orbit because ${planetName} also moves around the Sun.`],
  ]
  const notes: Readonly<Record<string, string | undefined>> = {
    'mean-radius': moon.meanRadiusDetail, mass: moon.massDetail,
    'surface-gravity': moon.surfaceGravityDetail,
    'semi-major-axis': moon.semiMajorAxisDetail,
    'sidereal-orbit': moon.siderealOrbitDetail,
    'phase-cycle': moon.phaseCycleDetail,
  }
  return specs.map(([id, label, value, detail]) => ({
    id: `moon-${moon.id}-${id}`, label, value, comparison: '',
    detail: `${detail}${notes[id] ? ` ${notes[id]}` : ''} ${moon.sourceLabel}.`,
    sourceUrl: moon.source,
  }))
}

function number(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

function ratioNumber(value: number, reference: number): string {
  return (value / reference).toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

function earthRatio(value: number, reference: number): string {
  return `${ratioNumber(value, reference)}×Earth`
}

export function planetPhysicalSpecs(planet: PlanetDescription): PlanetSpec[] {
  if (isExtrasolarPlanet(planet)) return extrasolarPhysicalSpecs(planet)
  if (isSmallBody(planet)) return smallBodyPhysicalSpecs(planet)
  const isEarth = planet.id === 'earth'
  const source = isEarth ? 'NASA Earth fact sheet.' : `NASA ${planet.name} and Earth fact sheets.`
  const spec = (id: string, label: string, value: string, comparison: string, detail = '', earthRatios?: readonly number[]): PlanetSpec =>
    ({ id, label, value, comparison: isEarth ? '' : comparison, earthRatios, detail: `${detail}${detail ? ' ' : ''}${source}` })
  const surfaceArea = 4 * Math.PI * planet.meanRadiusKm ** 2
  const earthArea = 4 * Math.PI * earth.meanRadiusKm ** 2
  const magnitudeDifference = planet.absoluteMagnitudeV - earth.absoluteMagnitudeV
  const surfaceTemperature: PlanetSpec = planet.temperatureAtOneBarK !== undefined
    ? { ...spec('surface-temperature', 'Temperature at 1 bar', `${number(planet.temperatureAtOneBarK, 0)} K`, earthRatio(planet.temperatureAtOneBarK, earth.meanSurfaceTemperatureK), planet.notes.surfaceTemperatures, [planet.temperatureAtOneBarK / earth.meanSurfaceTemperatureK]), temperatureK: [planet.temperatureAtOneBarK] }
    : planet.meanSurfaceTemperatureK !== undefined
    ? { ...spec('surface-temperature', 'Mean surface temperature', `${number(planet.meanSurfaceTemperatureK, 0)} K`, earthRatio(planet.meanSurfaceTemperatureK, earth.meanSurfaceTemperatureK), planet.notes.surfaceTemperatures, [planet.meanSurfaceTemperatureK / earth.meanSurfaceTemperatureK]), temperatureK: [planet.meanSurfaceTemperatureK] }
    : { ...spec('surface-temperature', 'Surface temperature', `${planet.surfaceTemperatureMinK} – ${planet.surfaceTemperatureMaxK} K`, `${ratioNumber(planet.surfaceTemperatureMinK!, earth.meanSurfaceTemperatureK)} – ${earthRatio(planet.surfaceTemperatureMaxK!, earth.meanSurfaceTemperatureK)}`, planet.notes.surfaceTemperatures, [planet.surfaceTemperatureMinK! / earth.meanSurfaceTemperatureK, planet.surfaceTemperatureMaxK! / earth.meanSurfaceTemperatureK]), temperatureK: [planet.surfaceTemperatureMinK!, planet.surfaceTemperatureMaxK!] }
  return [
    spec('mean-diameter', 'Diameter', `${number(planet.meanRadiusKm * 2, 1)} km`, earthRatio(planet.meanRadiusKm, earth.meanRadiusKm), 'Twice the volumetric mean radius.', [planet.meanRadiusKm / earth.meanRadiusKm]),
    spec('mean-radius', 'Radius', `${number(planet.meanRadiusKm, 1)} km`, earthRatio(planet.meanRadiusKm, earth.meanRadiusKm), 'Volumetric mean radius: the radius of a sphere with the same volume.', [planet.meanRadiusKm / earth.meanRadiusKm]),
    spec('flattening', 'Flattening', number(planet.flattening, isEarth ? 6 : 4), earthRatio(planet.flattening, earth.flattening), `Equatorial-to-polar flattening; dimensionless.${planet.flattening === 0 ? ' Rounded to zero in the source; this does not establish a perfectly spherical body.' : ''}`, [planet.flattening / earth.flattening]),
    spec('surface-area', 'Surface area', `${scientificPlanetValue(surfaceArea, 3)} km²`, earthRatio(surfaceArea, earthArea), planet.notes.surfaceArea, [surfaceArea / earthArea]),
    spec('volume', 'Volume', `${scientificPlanetValue(planet.volumeKm3)} km³`, earthRatio(planet.volumeKm3, earth.volumeKm3), 'The space occupied by the planet, measured in cubic kilometers.', [planet.volumeKm3 / earth.volumeKm3]),
    spec('mass', 'Mass', `${scientificPlanetValue(planet.massKg)} kg`, earthRatio(planet.massKg, earth.massKg), 'The amount of matter in the planet. Unlike weight, mass does not change with gravity.', [planet.massKg / earth.massKg]),
    spec('mean-density', 'Density', `${number(planet.meanDensityKgM3 / 1000)} g/cm³`, earthRatio(planet.meanDensityKgM3, earth.meanDensityKgM3), 'Mass divided by volume: the average amount of matter per cubic centimeter across the whole planet.', [planet.meanDensityKgM3 / earth.meanDensityKgM3]),
    spec('surface-gravity', planet.temperatureAtOneBarK !== undefined ? 'Gravity at 1 bar' : 'Surface gravity', `${number(planet.surfaceGravityMs2, 2)} m/s²`, earthRatio(planet.surfaceGravityMs2, earth.surfaceGravityMs2), planet.temperatureAtOneBarK !== undefined ? 'Mean gravity at the 1-bar atmospheric reference level. Earth reference: 9.82 m/s².' : 'Mean surface gravity. Earth reference: 9.82 m/s².', [planet.surfaceGravityMs2 / earth.surfaceGravityMs2]),
    spec('escape-velocity', 'Escape velocity', `${number(planet.escapeVelocityKmS, 2)} km/s`, earthRatio(planet.escapeVelocityKmS, earth.escapeVelocityKmS), 'The speed needed to escape the planet’s gravity from its reference surface without further propulsion, ignoring air resistance.', [planet.escapeVelocityKmS / earth.escapeVelocityKmS]),
    spec('synodic-rotation-period', 'Rotation period (synodic)', planet.solarDayHours < 24 ? `${number(planet.solarDayHours, 2)} h` : `${number(planet.solarDayHours / 24, 2)} days`, earthRatio(planet.solarDayHours, earth.solarDayHours), 'Solar day: one full day-night cycle. This is neither the sidereal rotation period nor the Earth-relative orbital synodic period.', [planet.solarDayHours / earth.solarDayHours]),
    spec('albedo', 'Albedo', number(planet.bondAlbedo), earthRatio(planet.bondAlbedo, earth.bondAlbedo), 'Bond albedo: fraction of total incident solar radiation reflected. Earth reference: 0.294.', [planet.bondAlbedo / earth.bondAlbedo]),
    { ...spec('temperature', 'Equilibrium temperature', `${number(planet.blackBodyTemperatureK, 1)} K`, earthRatio(planet.blackBodyTemperatureK, earth.blackBodyTemperatureK), 'Equivalent black-body equilibrium temperature, not a measured global surface average. Earth reference: 254 K.', [planet.blackBodyTemperatureK / earth.blackBodyTemperatureK]), temperatureK: [planet.blackBodyTemperatureK] },
    surfaceTemperature,
    spec('absolute-magnitude', 'Absolute magnitude', `${number(planet.absoluteMagnitudeV)} mag`, `${magnitudeDifference >= 0 ? '+' : '−'}${number(Math.abs(magnitudeDifference), 2)} mag vs Earth`, planet.notes.absoluteMagnitude),
    { ...spec('apparent-magnitude', 'Apparent magnitude', planet.brightestApparentMagnitudeV === null ? 'N/A from Earth' : `${number(planet.brightestApparentMagnitudeV, 2)} mag`, '', `Brightness as seen from Earth; lower magnitudes are brighter. ${planet.notes.apparentMagnitude}`),
      apparentMagnitudeV: planet.brightestApparentMagnitudeV ?? undefined },
  ]
}

export function planetAtmosphereSpecs(planet: SolarPlanetDescription): PlanetSpec[] {
  if (planet.surfacePressurePa === null) return [{
    id: 'surface-pressure', label: 'Surface pressure', value: 'No solid surface', comparison: '',
    detail: `${planet.notes.atmosphere} NASA ${planet.name} fact sheet.`,
  }]
  const upperLimit = planet.surfacePressureUpperPa !== undefined
  const pressure = planet.surfacePressurePa ?? planet.surfacePressureUpperPa!
  const significantDigits = upperLimit ? 1 : planet.id === 'earth' ? 4 : planet.id === 'mars' ? 3 : 2
  return [{
    id: 'surface-pressure', label: 'Surface pressure',
    value: `${upperLimit ? '≲' : ''}${scientificPlanetValue(pressure, significantDigits)} Pa`,
    comparison: planet.id === 'earth' ? '' : `${upperLimit ? '≲' : ''}${upperLimit ? scientificPlanetValue(pressure / earth.surfacePressurePa, 3) + '×Earth' : earthRatio(pressure, earth.surfacePressurePa)}`,
    detail: planet.id === 'earth' ? `${planet.notes.atmosphere} NASA Earth fact sheet.` : `${planet.notes.atmosphere} Earth reference: 101,400 Pa. NASA ${planet.name} and Earth fact sheets.`,
    pressurePa: pressure,
    pressureUpperLimit: upperLimit,
    pressureSignificantDigits: significantDigits,
    earthRatios: [pressure / earth.surfacePressurePa],
  }]
}
