import { Vector3 } from 'three'
import { eclipticVectorToWorld } from './earth-orbit'
import { skyGridDirection } from './sky-grid'

const RAD = Math.PI / 180
const KM_PER_AU = 149_597_870.7
const EARTH_RADIUS_KM = 6378.137
export const MOON_RADIUS_KM = 1737.4
const SUN_RADIUS_KM = 695_700
// Ephemerides run on terrestrial time, about 69 s ahead of UTC; the Moon moves half an arcsecond a second.
const TT_MINUS_UTC_SECONDS = 69
// Saturn's ring-plane pole (IAU WGCCRE, J2000), for the ring opening that brightens it.
const SATURN_POLE = skyGridDirection('equatorial', 40.589, 83.537)

type Elements = readonly [a: number, e: number, inclination: number, meanLongitude: number, perihelionLongitude: number, nodeLongitude: number]

interface PlanetDefinition {
  /** The planet's ID in the Solar System card. */
  id: string
  elements: Elements
  ratesPerCentury: Elements
  /** V(1, α): the magnitude at 1 au from Sun and Earth, at phase angle α in degrees. */
  absoluteMagnitude(phaseDeg: number, ringOpening: number): number
}

// JPL Solar System Dynamics, "Approximate Positions of the Planets", Table 1 (1800–2050), J2000 ecliptic.
// Magnitudes: Mallama & Hilton (2018), Astronomy and Computing 25, 10–24.
const EARTH_MOON_BARYCENTER = {
  elements: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
  ratesPerCentury: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
} as const satisfies Pick<PlanetDefinition, 'elements' | 'ratesPerCentury'>

const PLANETS: readonly PlanetDefinition[] = [
  {
    id: 'mercury',
    elements: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    ratesPerCentury: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    absoluteMagnitude: (a) => -0.613 + 6.328e-2 * a - 1.6336e-3 * a ** 2 + 3.3644e-5 * a ** 3 - 3.4265e-7 * a ** 4 + 1.6893e-9 * a ** 5 - 3.0334e-12 * a ** 6,
  },
  {
    id: 'venus',
    elements: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    ratesPerCentury: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    absoluteMagnitude: (a) => a < 163.7
      ? -4.384 - 1.044e-3 * a + 3.687e-4 * a ** 2 - 2.814e-6 * a ** 3 + 8.938e-9 * a ** 4
      : 236.05828 - 2.81914 * a + 8.39034e-3 * a ** 2,
  },
  {
    id: 'mars',
    elements: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    ratesPerCentury: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    absoluteMagnitude: (a) => -1.601 + 2.267e-2 * a - 1.302e-4 * a ** 2,
  },
  {
    id: 'jupiter',
    elements: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    ratesPerCentury: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    absoluteMagnitude: (a) => -9.395 - 3.7e-4 * a + 6.16e-4 * a ** 2,
  },
  {
    id: 'saturn',
    elements: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    ratesPerCentury: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    absoluteMagnitude: (a, ringOpening) => -8.914 - 1.825 * Math.sin(ringOpening) + 0.026 * a - 0.378 * Math.sin(ringOpening) * Math.exp(-2.25 * a),
  },
  {
    id: 'uranus',
    elements: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    ratesPerCentury: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    absoluteMagnitude: (a) => -7.110 + 6.587e-3 * a + 1.045e-4 * a ** 2,
  },
  {
    id: 'neptune',
    elements: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    ratesPerCentury: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.01262724],
    absoluteMagnitude: () => -7.00,
  },
]

// Meeus, Astronomical Algorithms (2nd ed.), Tables 47.A and 47.B, terms above 0.002°: multiples of D, M, M′, F,
// then longitude (1e-6°) and distance (m), or latitude (1e-6°). Together with the additive terms, better than 1′.
const MOON_LONGITUDE_DISTANCE = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
] as const
const MOON_LATITUDE = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
] as const

export interface SkyPlanet {
  id: string
  /** Unit world direction from the observer. */
  direction: Vector3
  magnitude: number
}

export interface SkyMoon {
  direction: Vector3
  angularRadius: number
  /** Apparent V magnitude for its phase and distance, outside eclipses (Allen's Astrophysical Quantities). */
  magnitude: number
  /** Unit world direction from the Moon to the Sun, which lights its phase. */
  sunDirection: Vector3
  /** Ecliptic north in world axes, close to the Moon's own north. */
  north: Vector3
  /** The Moon's center from Earth's, in world axes and km, for Earth's shadow. */
  fromEarthKm: Vector3
  /** Unit world direction from the Sun through Earth: the axis of Earth's shadow. */
  shadowAxis: Vector3
  sunDistanceKm: number
}

export interface SolarSystemSky {
  planets: SkyPlanet[]
  moon: SkyMoon
}

/**
 * Radii in km of Earth's umbra and penumbra at a distance behind Earth along the shadow axis, from the
 * Sun's and Earth's sizes; both are enlarged by 2% for Earth's atmosphere, as in eclipse predictions.
 */
export function earthShadowRadii(distanceKm: number, sunDistanceKm: number): { umbra: number; penumbra: number } {
  return {
    umbra: 1.02 * (EARTH_RADIUS_KM - distanceKm * (SUN_RADIUS_KM - EARTH_RADIUS_KM) / sunDistanceKm),
    penumbra: 1.02 * (EARTH_RADIUS_KM + distanceKm * (SUN_RADIUS_KM + EARTH_RADIUS_KM) / sunDistanceKm),
  }
}

function centuriesSinceJ2000(date: Date): number {
  return (date.getTime() / 86_400_000 + 2440587.5 + TT_MINUS_UTC_SECONDS / 86_400 - 2451545) / 36525
}

/** Heliocentric J2000 ecliptic position in au from Keplerian elements. */
function heliocentric({ elements, ratesPerCentury }: Pick<PlanetDefinition, 'elements' | 'ratesPerCentury'>, centuries: number): Vector3 {
  const [a, e, inclination, meanLongitude, perihelion, node] = elements.map((value, index) => value + ratesPerCentury[index]! * centuries) as unknown as Elements
  const meanAnomaly = (((meanLongitude - perihelion) % 360 + 540) % 360 - 180) * RAD
  let eccentric = meanAnomaly + e * Math.sin(meanAnomaly)
  for (let step = 0; step < 6; step++) eccentric -= (eccentric - e * Math.sin(eccentric) - meanAnomaly) / (1 - e * Math.cos(eccentric))
  const x = a * (Math.cos(eccentric) - e)
  const y = a * Math.sqrt(1 - e * e) * Math.sin(eccentric)
  const argument = (perihelion - node) * RAD
  const cw = Math.cos(argument), sw = Math.sin(argument)
  const cn = Math.cos(node * RAD), sn = Math.sin(node * RAD)
  const ci = Math.cos(inclination * RAD), si = Math.sin(inclination * RAD)
  return new Vector3(
    (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y,
    (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y,
    sw * si * x + cw * si * y,
  )
}

/** Geocentric J2000 ecliptic position of the Moon in km. */
function moonGeocentric(centuries: number): Vector3 {
  const t = centuries
  const meanLongitude = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t
  const elongation = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t
  const sunAnomaly = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t
  const moonAnomaly = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t
  const latitudeArgument = 93.2720950 + 483202.0175233 * t - 0.0036539 * t * t
  // Earth's shrinking eccentricity weakens terms with the Sun's anomaly.
  const eccentricity = 1 - 0.002516 * t - 0.0000074 * t * t
  const term = (d: number, m: number, mp: number, f: number) => ({
    angle: (d * elongation + m * sunAnomaly + mp * moonAnomaly + f * latitudeArgument) * RAD,
    scale: eccentricity ** Math.abs(m),
  })
  let longitude = 0, distance = 0, latitude = 0
  for (const [d, m, mp, f, l, r] of MOON_LONGITUDE_DISTANCE) {
    const { angle, scale } = term(d, m, mp, f)
    longitude += l * scale * Math.sin(angle)
    distance += r * scale * Math.cos(angle)
  }
  for (const [d, m, mp, f, b] of MOON_LATITUDE) {
    const { angle, scale } = term(d, m, mp, f)
    latitude += b * scale * Math.sin(angle)
  }
  const a1 = (119.75 + 131.849 * t) * RAD
  const a2 = (53.09 + 479264.290 * t) * RAD
  const a3 = (313.45 + 481266.484 * t) * RAD
  const lp = meanLongitude * RAD, mp = moonAnomaly * RAD, f = latitudeArgument * RAD
  longitude += 3958 * Math.sin(a1) + 1962 * Math.sin(lp - f) + 318 * Math.sin(a2)
  latitude += -2235 * Math.sin(lp) + 382 * Math.sin(a3) + 175 * Math.sin(a1 - f) + 175 * Math.sin(a1 + f) + 127 * Math.sin(lp - mp) - 115 * Math.sin(lp + mp)
  // From the mean equinox of date back to J2000 (general precession in longitude).
  const lambda = (meanLongitude + longitude / 1e6 - 1.396971 * t - 0.0003086 * t * t) * RAD
  const beta = latitude / 1e6 * RAD
  const km = 385000.56 + distance / 1000
  return new Vector3(Math.cos(beta) * Math.cos(lambda), Math.cos(beta) * Math.sin(lambda), Math.sin(beta)).multiplyScalar(km)
}

/**
 * The seven other major planets and the Moon as seen from Earth's center, or from its surface below
 * a zenith, which matters for the Moon (up to 1° of parallax). Light time and aberration are left out,
 * as they are for the catalog's stars.
 */
export function solarSystemSky(date: Date, zenith: Vector3 | null = null): SolarSystemSky {
  const centuries = centuriesSinceJ2000(date)
  const earth = heliocentric(EARTH_MOON_BARYCENTER, centuries)
  const earthKm = eclipticVectorToWorld(earth.clone().multiplyScalar(KM_PER_AU))
  const surfaceKm = zenith ? zenith.clone().multiplyScalar(EARTH_RADIUS_KM) : new Vector3()
  const observerKm = earthKm.clone().add(surfaceKm)
  const sunDistance = earth.length()
  const planets = PLANETS.map((planet) => {
    const position = heliocentric(planet, centuries)
    const fromObserver = eclipticVectorToWorld(position.clone().multiplyScalar(KM_PER_AU)).sub(observerKm)
    const distance = fromObserver.length() / KM_PER_AU
    const sunDistancePlanet = position.length()
    const phase = Math.acos(Math.max(-1, Math.min(1, (sunDistancePlanet ** 2 + distance ** 2 - sunDistance ** 2) / (2 * sunDistancePlanet * distance)))) / RAD
    const direction = fromObserver.normalize()
    const ringOpening = Math.asin(Math.abs(SATURN_POLE.dot(direction)))
    return {
      id: planet.id,
      direction,
      magnitude: 5 * Math.log10(sunDistancePlanet * distance) + planet.absoluteMagnitude(phase, ringOpening),
    }
  })
  const moonGeo = eclipticVectorToWorld(moonGeocentric(centuries))
  const moonFromObserver = moonGeo.clone().sub(surfaceKm)
  // The Sun sits at the origin, Earth's center at earthKm.
  const sunFromMoon = earthKm.clone().add(moonGeo).negate()
  const moonPhase = sunFromMoon.angleTo(moonFromObserver.clone().negate()) / RAD
  return {
    planets,
    moon: {
      direction: moonFromObserver.clone().normalize(),
      angularRadius: Math.asin(MOON_RADIUS_KM / moonFromObserver.length()),
      magnitude: 0.21 + 5 * Math.log10(sunFromMoon.length() * moonFromObserver.length() / KM_PER_AU ** 2) + 0.026 * moonPhase + 4e-9 * moonPhase ** 4,
      sunDirection: sunFromMoon.clone().normalize(),
      north: eclipticVectorToWorld(new Vector3(0, 0, 1)),
      fromEarthKm: moonGeo,
      shadowAxis: earthKm.clone().normalize(),
      sunDistanceKm: earthKm.length(),
    },
  }
}
