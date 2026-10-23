import nearby from './data/generated/exoplanet-source.json'
import earthDefinitions from './data/generated/planet-details.json'
import type { PlanetSpec } from './planet-properties'
import { scientificPlanetValue } from './planet-value'

interface ArchiveMeasurement {
  readonly value: number
  readonly errorPlus: number | null
  readonly errorMinus: number | null
  readonly limit: number
  readonly estimated: boolean
  readonly source: { readonly label: string; readonly url: string | null }
}

export interface ExtrasolarPlanet {
  readonly kind: 'extrasolar'
  readonly id: string
  readonly name: string
  readonly hostStarId: string
  readonly hostName: string
  readonly color: string
  readonly massProvenance: string
  readonly controversial: boolean
  readonly discoveryMethod: string
  readonly discoveryYear: number
  readonly discoveryFacility: string
  readonly discoverySource: { readonly label: string; readonly url: string | null }
  readonly metrics: Readonly<Record<string, ArchiveMeasurement | undefined>>
}

const earth = earthDefinitions.earth
const format = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 4 })
// Overrides the shared title tooltip where this label means something specific.
const define = (specs: PlanetSpec[], definition: string | undefined) => specs.map((spec) => ({ ...spec, definition }))

function measurementSpec(planet: ExtrasolarPlanet, field: string, id: string, label: string, unit: string, detail: string, multiplier = 1, earthReference?: number): PlanetSpec[] {
  const measurement = planet.metrics[field]
  if (!measurement) return []
  const prefix = measurement.limit === 1 ? '< ' : measurement.limit === -1 ? '> ' : ''
  const qualifier = measurement.estimated ? ' · estimated' : ''
  const value = measurement.value * multiplier
  const errors = measurement.errorPlus !== null || measurement.errorMinus !== null
    ? ` Published uncertainties: +${measurement.errorPlus === null ? 'unavailable' : format(Math.abs(measurement.errorPlus))} / −${measurement.errorMinus === null ? 'unavailable' : format(Math.abs(measurement.errorMinus))} in archive units.` : ''
  return [{
    id, label, value: `${prefix}${unit === 'kg' ? scientificPlanetValue(value) : format(value)}${unit ? ` ${unit}` : ''}${qualifier}`,
    comparison: earthReference === undefined ? '' : `${prefix}${(value / earthReference).toLocaleString('en-US', { maximumSignificantDigits: 3 })}×Earth`,
    detail: `${detail}${measurement.estimated ? ' Calculated estimate in the archive, not a measured value.' : ''}${errors} ${measurement.source.label || 'NASA Exoplanet Archive'}; snapshot ${nearby.retrieved}.`,
    sourceUrl: measurement.source.url ?? undefined,
    ...(field === 'pl_eqt' ? { temperatureK: [value] } : {}),
  }]
}

export function extrasolarPhysicalSpecs(planet: ExtrasolarPlanet): PlanetSpec[] {
  const minimumMass = planet.massProvenance === 'Msini' || planet.massProvenance === 'M*sin(i)'
  const massLabel = minimumMass ? 'Minimum mass (m sin i)' : planet.massProvenance === 'Msin(i)/sin(i)' ? 'Inclination-corrected mass' : 'Mass'
  const imaging = planet.discoveryMethod === 'Imaging'
  return [
    ...measurementSpec(planet, 'pl_rade', 'radius', 'Radius', 'km', 'Archive radius in Earth radii; converted with the archive Earth equatorial radius reference of 6,378.1 km.', 6378.1, 6378.1),
    ...define(measurementSpec(planet, 'pl_bmasse', 'mass', massLabel, 'kg', `Mass provenance: ${planet.massProvenance}. ${minimumMass ? 'Radial-velocity minimum mass, not the true mass.' : ''} Converted from Earth masses with the adopted Earth reference.`, earth.massKg, earth.massKg),
      minimumMass ? 'The lowest possible mass. The star’s wobble only gives the true mass if the tilt of the orbit is known, so the real mass can be higher.' : massLabel === 'Mass' ? undefined : 'The true mass, worked out from the minimum mass once the tilt of the orbit was measured.'),
    ...measurementSpec(planet, 'pl_dens', 'mean-density', 'Mean density', 'g/cm³', 'Archive bulk density; composite parameters may come from different studies.', 1, earth.meanDensityKgM3 / 1000),
    ...define(measurementSpec(planet, 'pl_eqt', 'temperature', imaging ? 'Effective temperature' : 'Equilibrium temperature', 'K', `${imaging ? 'Black-body effective temperature for an imaged planet.' : 'Modeled black-body equilibrium temperature; assumptions about albedo and heat redistribution vary by source.'} Not a measured surface temperature. Earth black-body reference: 254 K.`, 1, earth.blackBodyTemperatureK),
      imaging ? 'The temperature that matches the heat the planet glows with. Young giant planets are still warm from their formation.' : undefined),
    ...measurementSpec(planet, 'pl_insol', 'insolation', 'Incident flux', 'Earth flux', 'Stellar irradiation relative to Earth’s incident solar flux.'),
  ]
}

export function extrasolarOrbitalSpecs(planet: ExtrasolarPlanet): PlanetSpec[] {
  const imaging = planet.discoveryMethod === 'Imaging'
  const specs: PlanetSpec[] = [
    { id: 'host', label: 'Host', value: planet.hostName, comparison: '', detail: 'Exact reviewed catalog host identity.' },
    ...define(measurementSpec(planet, 'pl_orbsmax', 'semi-major-axis', imaging ? 'Projected separation' : 'Orbital semi-major axis', 'AU', imaging ? 'Sky-projected separation adopted by the archive for an imaging discovery; not necessarily the orbital semi-major axis.' : 'Approximate orbital size, not an instantaneous host distance.', 1, 1.00000261),
      imaging ? 'How far apart the planet and its star appear on the sky. The real distance can be larger because we may see the orbit at an angle.' : 'The average size of the orbit: halfway between the planet’s closest and farthest distances from its star.'),
    ...measurementSpec(planet, 'pl_orbper', 'orbital-period', 'Orbital period', 'd', 'One orbit around the host; Earth sidereal orbital period reference: 365.256 days.', 1, 365.256),
    ...measurementSpec(planet, 'pl_orbeccen', 'eccentricity', 'Eccentricity', '', 'Orbital eccentricity; zero may be an assumed circular orbit in the source.'),
    ...define(measurementSpec(planet, 'pl_orbincl', 'inclination', 'Inclination', '°', 'Orbital inclination to the sky plane; 90° is edge-on.'),
      'The tilt of the orbit as seen from Earth. 90° means we see it edge-on, so the planet can pass in front of its star.'),
    ...measurementSpec(planet, 'pl_rvamp', 'rv-amplitude', 'RV semi-amplitude', 'm/s', 'Host-star radial-velocity semi-amplitude induced by this planet.'),
    ...measurementSpec(planet, 'pl_trandep', 'transit-depth', 'Transit depth', '%', 'Relative host-star flux decrement during a transit.'),
    ...measurementSpec(planet, 'pl_trandur', 'transit-duration', 'Transit duration', 'h', 'First to last contact across the stellar limb.'),
    ...measurementSpec(planet, 'pl_imppar', 'impact-parameter', 'Impact parameter', '', 'Projected planet-center distance from stellar center at conjunction in stellar radii.'),
    ...measurementSpec(planet, 'pl_ratror', 'radius-ratio', 'Planet / host radius', '', 'Planet radius divided by host-star radius.'),
    ...measurementSpec(planet, 'pl_ratdor', 'orbit-radius-ratio', 'Orbit / host radius', '', 'Archive orbital distance normalized by stellar radius; see the source convention.'),
    ...measurementSpec(planet, 'pl_occdep', 'occultation-depth', 'Occultation depth', '%', 'Secondary eclipse depth.'),
    ...measurementSpec(planet, 'pl_projobliq', 'projected-obliquity', 'Projected obliquity', '°', 'Sky-projected angle between stellar spin and orbital angular momentum.'),
    ...measurementSpec(planet, 'pl_trueobliq', 'true-obliquity', 'True obliquity', '°', 'Three-dimensional angle between stellar spin and orbital angular momentum.'),
    { id: 'discovery', label: 'Discovery', value: `${planet.discoveryYear} · ${planet.discoveryMethod}`, comparison: '', detail: planet.discoverySource.label, sourceUrl: planet.discoverySource.url ?? undefined },
    { id: 'facility', label: 'Facility', value: planet.discoveryFacility, comparison: '', detail: 'Discovery facility recorded in the NASA Exoplanet Archive.' },
    { id: 'source', label: 'Source', value: 'NASA Exoplanet Archive', comparison: '', detail: `Composite published parameters, retrieved ${nearby.retrieved}. Values may come from different studies.`, sourceUrl: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(planet.name)}` },
  ]
  if (planet.controversial) specs.push({ id: 'status', label: 'Status', value: 'Confirmation questioned', comparison: '', detail: 'Archive controversial flag: confirmation has been questioned in published literature.' })
  return specs
}
