import definitions from './data/generated/planet-details.json'
import { extrasolarPhysicalSpecs, type ExtrasolarPlanet } from './exoplanet-properties'
import { extrasolarPlanetForId } from './planetary-systems'
import { scientificPlanetValue } from './planet-value'
import { isSmallBody, smallBodies, smallBodyPhysicalSpecs, type SmallBodyDescription } from './small-body-properties'
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
  /** Plain-language meaning of the label; falls back to specDefinitions by id. */
  readonly definition?: string
  readonly sourceUrl?: string
  readonly temperatureK?: readonly number[]
  readonly pressurePa?: number
  readonly pressureUpperLimit?: boolean
  readonly pressureSignificantDigits?: number
}

const earth = definitions.earth

const radiusDefinition = 'The distance from the center to the surface. For a squashed or irregular shape, it is the radius of a ball with the same volume.'
const oneBar = 'Gas giants have no solid surface, so this is measured at the height where the gas pressure equals Earth’s sea-level air pressure (1 bar).'

// Shared title tooltips: what each term means, written for hobby astronomers.
export const specDefinitions: Readonly<Record<string, string>> = {
  'mean-diameter': 'The distance straight through the center, from one side to the other.',
  'mean-radius': radiusDefinition,
  radius: radiusDefinition,
  flattening: 'How much spinning squashes the shape. 0 is a perfect sphere; larger values mean the equator bulges more compared with the poles.',
  'surface-area': 'The total area of the outer surface.',
  volume: 'How much space the object takes up.',
  mass: 'The amount of matter in the object. Unlike weight, mass stays the same wherever you are.',
  'mean-density': 'Mass divided by volume, which hints at what the object is made of. Water is 1 g/cm³, rock about 3 and iron about 8.',
  'surface-gravity': 'How strongly the object pulls things toward its surface. Your weight there scales with this value.',
  'escape-velocity': 'The launch speed needed to leave the object for good without any further push, ignoring air resistance.',
  'synodic-rotation-period': 'The length of a day: the time from one noon to the next.',
  'sidereal-rotation-period': 'The time for one full spin, measured against the distant stars.',
  'orbit-inclination': 'How much the orbit is tilted compared with Earth’s orbit around the Sun.',
  inclination: 'How much the orbit is tilted compared with Earth’s orbit around the Sun.',
  'axial-inclination': 'How far the spin axis leans compared with the orbit. This tilt causes seasons; above 90° the object spins backwards.',
  albedo: 'The share of all incoming sunlight reflected back into space. 0 reflects nothing; 1 reflects everything.',
  'geometric-albedo': 'How reflective the surface is when fully lit, compared with a perfectly white disk of the same size. Higher values mean a brighter surface.',
  temperature: 'The temperature the object would have from absorbed starlight alone, without an atmosphere trapping heat. Real surfaces can be much warmer or colder.',
  'surface-temperature': 'The typical temperature at the ground.',
  'absolute-magnitude': 'A standard brightness that removes the effect of distance: how bright the object would be, fully lit, 1 AU from both the Sun and the observer. Lower numbers are brighter.',
  'apparent-magnitude': 'How bright the object looks in Earth’s sky at its brightest. Lower numbers are brighter; the faintest stars visible to the naked eye are about magnitude 6.',
  'surface-pressure': 'How hard the atmosphere presses down on the ground. Earth’s air at sea level presses with about 1 bar.',
  composition: 'The main gases in the atmosphere, or in the extremely thin layer of atoms around a world with almost no air.',
  'semi-major-axis': 'The average size of the orbit: halfway between the closest and farthest distances.',
  'orbital-period': 'The time to complete one full orbit.',
  eccentricity: 'How stretched the orbit is. 0 is a perfect circle; values close to 1 are long, narrow ellipses.',
  perihelion: 'The closest the object comes to the Sun.',
  aphelion: 'The farthest the object gets from the Sun.',
  insolation: 'How much starlight reaches the planet compared with the sunlight reaching Earth. 1 means the same as Earth.',
  host: 'The star this planet orbits.',
  'rv-amplitude': 'How fast the planet’s pull makes its star wobble toward and away from us. Heavier, closer planets cause larger wobbles.',
  'transit-depth': 'How much the star dims when the planet passes in front of it. Larger planets block more light.',
  'transit-duration': 'How long the planet takes to cross the face of its star.',
  'impact-parameter': 'How close to the middle of the star’s disk the planet crosses. 0 is straight through the center; values near 1 graze the edge.',
  'radius-ratio': 'The planet’s size compared with its star’s size.',
  'orbit-radius-ratio': 'The planet’s distance from its star, measured in star radii.',
  'occultation-depth': 'How much the total light drops when the planet hides behind its star, showing how much light the planet itself reflects or gives off.',
  'projected-obliquity': 'The angle between the star’s spin and the planet’s orbit, as seen from Earth. 0° means the planet orbits in the direction the star spins.',
  'true-obliquity': 'The real three-dimensional angle between the star’s spin and the planet’s orbit. 0° means the planet orbits in the direction the star spins.',
  discovery: 'The year the planet was announced and the technique used to find it.',
  facility: 'The telescope, mission or observatory that discovered the planet.',
  source: 'The catalog these values come from.',
  status: 'Whether the planet is firmly confirmed. Some reported planets are later questioned or turn out to be false signals.',
}
const descriptions = new Map<string, PlanetDescription>([...definitions.planets, ...smallBodies].map((planet) => [planet.id, planet]))

export function planetApparentMagnitudeRange() {
  const planets = definitions.planets.flatMap((planet) => planet.brightestApparentMagnitudeV === null ? []
    : [{ name: planet.name, magnitude: planet.brightestApparentMagnitudeV }])
    .sort((a, b) => a.magnitude - b.magnitude)
  return { brightest: planets[0]!, faintest: planets[planets.length - 1]! }
}

export function planetDescriptionForId(id: string): PlanetDescription | undefined {
  return descriptions.get(id) ?? extrasolarPlanetForId(id)
}

export function solarPlanetDescriptionForId(id: string): SolarPlanetDescription | undefined {
  const planet = descriptions.get(id)
  return planet && !isExtrasolarPlanet(planet) && !isSmallBody(planet) ? planet : undefined
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
    ? { ...spec('surface-temperature', 'Temperature at 1 bar', `${number(planet.temperatureAtOneBarK, 0)} K`, earthRatio(planet.temperatureAtOneBarK, earth.meanSurfaceTemperatureK), planet.notes.surfaceTemperatures, [planet.temperatureAtOneBarK / earth.meanSurfaceTemperatureK]), temperatureK: [planet.temperatureAtOneBarK], definition: oneBar }
    : planet.meanSurfaceTemperatureK !== undefined
    ? { ...spec('surface-temperature', 'Mean surface temperature', `${number(planet.meanSurfaceTemperatureK, 0)} K`, earthRatio(planet.meanSurfaceTemperatureK, earth.meanSurfaceTemperatureK), planet.notes.surfaceTemperatures, [planet.meanSurfaceTemperatureK / earth.meanSurfaceTemperatureK]), temperatureK: [planet.meanSurfaceTemperatureK] }
    : { ...spec('surface-temperature', 'Surface temperature', `${planet.surfaceTemperatureMinK} – ${planet.surfaceTemperatureMaxK} K`, `${ratioNumber(planet.surfaceTemperatureMinK!, earth.meanSurfaceTemperatureK)} – ${earthRatio(planet.surfaceTemperatureMaxK!, earth.meanSurfaceTemperatureK)}`, planet.notes.surfaceTemperatures, [planet.surfaceTemperatureMinK! / earth.meanSurfaceTemperatureK, planet.surfaceTemperatureMaxK! / earth.meanSurfaceTemperatureK]), temperatureK: [planet.surfaceTemperatureMinK!, planet.surfaceTemperatureMaxK!], definition: 'The range from the coldest to the hottest temperatures at the ground.' }
  return [
    spec('mean-diameter', 'Diameter', `${number(planet.meanRadiusKm * 2, 1)} km`, earthRatio(planet.meanRadiusKm, earth.meanRadiusKm), 'Twice the volumetric mean radius.', [planet.meanRadiusKm / earth.meanRadiusKm]),
    spec('mean-radius', 'Radius', `${number(planet.meanRadiusKm, 1)} km`, earthRatio(planet.meanRadiusKm, earth.meanRadiusKm), 'Volumetric mean radius: the radius of a sphere with the same volume.', [planet.meanRadiusKm / earth.meanRadiusKm]),
    spec('flattening', 'Flattening', number(planet.flattening, isEarth ? 6 : 4), earthRatio(planet.flattening, earth.flattening), `Equatorial-to-polar flattening; dimensionless.${planet.flattening === 0 ? ' Rounded to zero in the source; this does not establish a perfectly spherical body.' : ''}`, [planet.flattening / earth.flattening]),
    spec('surface-area', 'Surface area', `${scientificPlanetValue(surfaceArea, 3)} km²`, earthRatio(surfaceArea, earthArea), planet.notes.surfaceArea, [surfaceArea / earthArea]),
    spec('volume', 'Volume', `${scientificPlanetValue(planet.volumeKm3)} km³`, earthRatio(planet.volumeKm3, earth.volumeKm3), 'The space occupied by the planet, measured in cubic kilometers.', [planet.volumeKm3 / earth.volumeKm3]),
    spec('mass', 'Mass', `${scientificPlanetValue(planet.massKg)} kg`, earthRatio(planet.massKg, earth.massKg), 'The amount of matter in the planet. Unlike weight, mass does not change with gravity.', [planet.massKg / earth.massKg]),
    spec('mean-density', 'Density', `${number(planet.meanDensityKgM3 / 1000)} g/cm³`, earthRatio(planet.meanDensityKgM3, earth.meanDensityKgM3), 'Mass divided by volume: the average amount of matter per cubic centimeter across the whole planet.', [planet.meanDensityKgM3 / earth.meanDensityKgM3]),
    { ...spec('surface-gravity', planet.temperatureAtOneBarK !== undefined ? 'Gravity at 1 bar' : 'Surface gravity', `${number(planet.surfaceGravityMs2, 2)} m/s²`, earthRatio(planet.surfaceGravityMs2, earth.surfaceGravityMs2), planet.temperatureAtOneBarK !== undefined ? 'Mean gravity at the 1-bar atmospheric reference level. Earth reference: 9.82 m/s².' : 'Mean surface gravity. Earth reference: 9.82 m/s².', [planet.surfaceGravityMs2 / earth.surfaceGravityMs2]),
      definition: planet.temperatureAtOneBarK !== undefined ? `How strongly the planet pulls things down. ${oneBar}` : undefined },
    spec('escape-velocity', 'Escape velocity', `${number(planet.escapeVelocityKmS, 2)} km/s`, earthRatio(planet.escapeVelocityKmS, earth.escapeVelocityKmS), 'The speed needed to escape the planet’s gravity from its reference surface without further propulsion, ignoring air resistance.', [planet.escapeVelocityKmS / earth.escapeVelocityKmS]),
    spec('synodic-rotation-period', 'Rotation period (synodic)', planet.solarDayHours < 24 ? `${number(planet.solarDayHours, 2)} h` : `${number(planet.solarDayHours / 24, 2)} days`, earthRatio(planet.solarDayHours, earth.solarDayHours), 'Solar day: one full day-night cycle. This is neither the sidereal rotation period nor the Earth-relative orbital synodic period.', [planet.solarDayHours / earth.solarDayHours]),
    { ...spec('orbit-inclination', 'Orbit inclination', `${number(planet.orbitInclinationDeg)}°`, '', 'Angle between the orbital plane and the ecliptic (Earth’s orbital plane). Earth defines 0°; this is not the inclination to the sky plane used for exoplanets.'), sourceUrl: `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${planet.id}fact.html` },
    { ...spec('axial-inclination', 'Axial tilt', `${number(planet.axialTiltDeg)}°`, '', 'Axial tilt (obliquity): angle between the spin axis and the normal to the orbital plane. Values above 90° indicate retrograde rotation.'), sourceUrl: `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${planet.id}fact.html` },
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
