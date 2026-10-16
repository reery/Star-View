import moons from './data/generated/planet-moons.json'
import definitions from './data/generated/planet-details.json'
import type { PlanetMoon, PlanetSpec } from './planet-properties'
import { scientificPlanetValue } from './planet-value'

const earth = definitions.earth

export function planetMoonsForId(id: string): readonly PlanetMoon[] {
  return (moons as Readonly<Record<string, readonly PlanetMoon[]>>)[id] ?? []
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

