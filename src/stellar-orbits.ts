import { starComponentIdentity, type StarSystem } from './star-systems'

export interface StellarOrbit {
  id: string
  primary: string
  secondary: string
  primaryIds: string[]
  secondaryIds: string[]
  periodYears: number
  semiMajorAxisAu: number | null
  eccentricity: number | null
  inclinationDeg: number | null
  nodeDeg: number | null
  argumentDeg: number | null
  argumentComponent: string | null
  periastronEpoch: number | null
  epochKind: string | null
  grade: number | null
  nodeAmbiguous: boolean
  catalog: string
  reference: string
  sourceUrl: string
  axisDerivation: { angularAxisArcsec: number; parallaxMas: number | null; parallaxStarId: string | null } | null
}

const solutions = new Map<string, readonly StellarOrbit[]>()
let pending: Promise<void> | undefined

export function loadStellarOrbits(): Promise<void> {
  return pending ??= import('./data/stellar-orbits.json').then(({ default: data }) => {
    for (const system of data.systems) solutions.set(system.systemId, system.orbits)
  }).catch((error: unknown) => { pending = undefined; throw error })
}

export function stellarOrbitsForSystem(system: StarSystem): readonly StellarOrbit[] {
  const ids = new Set(system.components.map(({ star }) => starComponentIdentity(star.id)?.canonicalStarId ?? star.id))
  return (solutions.get(system.id) ?? []).filter((orbit) => [...orbit.primaryIds, ...orbit.secondaryIds].every((id) => ids.has(id)))
}

export function orbitHasGeometry(orbit: StellarOrbit): boolean {
  return orbit.semiMajorAxisAu !== null && orbit.semiMajorAxisAu > 0
    && orbit.eccentricity !== null && orbit.eccentricity >= 0 && orbit.eccentricity < 1
    && orbit.inclinationDeg !== null && orbit.nodeDeg !== null && orbit.argumentDeg !== null
    // A primary-only spectroscopic argument is not a secondary relative orbit.
    && (orbit.catalog === 'ORB6' || orbit.argumentComponent !== null)
}

/** Relative orbit projected onto the sky, north up and east left; unit axis. */
export function projectedOrbitPoint(orbit: StellarOrbit, eccentricAnomaly: number): { x: number; y: number } {
  const radians = Math.PI / 180
  const omega = (orbit.argumentDeg! + (orbit.argumentComponent === orbit.primary ? 180 : 0)) * radians
  const node = orbit.nodeDeg! * radians
  const inclination = orbit.inclinationDeg! * radians
  const plane = orbitalPlanePoint(orbit, eccentricAnomaly)
  const x = plane.x, y = -plane.y
  const north = (Math.cos(node) * Math.cos(omega) - Math.sin(node) * Math.sin(omega) * Math.cos(inclination)) * x
    + (-Math.cos(node) * Math.sin(omega) - Math.sin(node) * Math.cos(omega) * Math.cos(inclination)) * y
  const east = (Math.sin(node) * Math.cos(omega) + Math.cos(node) * Math.sin(omega) * Math.cos(inclination)) * x
    + (-Math.sin(node) * Math.sin(omega) + Math.cos(node) * Math.cos(omega) * Math.cos(inclination)) * y
  return { x: -east, y: -north }
}

/** Face-on orbital plane, with periastron to the right; unit axis. */
export function orbitalPlanePoint(orbit: StellarOrbit, eccentricAnomaly: number): { x: number; y: number } {
  return { x: Math.cos(eccentricAnomaly) - orbit.eccentricity!,
    y: -Math.sqrt(1 - orbit.eccentricity! ** 2) * Math.sin(eccentricAnomaly) }
}

export function orbitMassFraction(system: StarSystem, orbit: StellarOrbit): number | null {
  const mass = (ids: readonly string[]) => {
    let total = 0
    for (const id of ids) {
      const star = system.components.find(({ star }) => (starComponentIdentity(star.id)?.canonicalStarId ?? star.id) === id)?.star
      if (!star?.mass_solar || star.mass_solar <= 0) return null
      total += star.mass_solar
    }
    return total
  }
  const primary = mass(orbit.primaryIds), secondary = mass(orbit.secondaryIds)
  return primary !== null && secondary !== null ? secondary / (primary + secondary) : null
}

/** Conservative: known masses, resolved primary radius, and offset >2 radii even at periastron. */
export function orbitBarycenterVisible(system: StarSystem, orbit: StellarOrbit): boolean {
  const fraction = orbitMassFraction(system, orbit)
  if (fraction === null || orbit.semiMajorAxisAu === null || orbit.eccentricity === null) return false
  if (orbit.primaryIds.length > 1) return true
  const primary = system.components.find(({ star }) => (starComponentIdentity(star.id)?.canonicalStarId ?? star.id) === orbit.primaryIds[0])?.star
  return primary?.radius_solar !== null && primary?.radius_solar !== undefined && primary.radius_solar > 0
    && orbit.semiMajorAxisAu * (1 - orbit.eccentricity) * fraction > 2 * primary.radius_solar * 0.00465046726
}
