import { Color, Group, Vector3, type Camera, type ColorRepresentation } from 'three'
import { galacticToWorld, type StarColorMode } from './astronomy'
import { ICRS_TO_GALACTIC_ROWS, type GalaxyDetails, type Star } from './catalog-model'
import { createPuffLayer, gaussian, puffSource, seededRandom, type NebulaLayer, type PuffInstances, type PuffSource } from './nebula-layer'
import { GALAXY_BANDS, type WavelengthBandId } from './wavelength-vision'

// The Galaxy seen from outside, generated from a handful of published parameters:
// glowing puffs for starlight and absorbing puffs for dust, two instanced draws.
// Reid et al. 2019 (ApJ 885, 131): R0 = 8.15 kpc and the Sun 5.5 pc above the plane.
const R0_PC = 8150
const SUN_HEIGHT_PC = 5.5
const DEG = Math.PI / 180

interface Arm {
  name: string
  /** Azimuth range covered by maser parallaxes, deg. */
  measured: readonly [number, number]
  kink: number
  /** Radius at the kink, kpc. */
  radius: number
  /** Pitch angles below and above the kink, deg. */
  pitch: readonly [number, number]
  /** Azimuth range drawn, including the extrapolated far side, deg. */
  drawn: readonly [number, number]
  /** Pitch beyond the measured range, deg. */
  extrapolated?: number
  strength: number
}

// Reid et al. 2019, Table 2: log-spiral segments ln(R / R_kink) = -(β - β_kink) tan ψ,
// with Galactocentric azimuth β = 0 toward the Sun, increasing with Galactic rotation.
// Outside the measured range each arm continues at a typical pitch across the
// unmapped far side. Scutum–Centaurus and Perseus are the major stellar arms.
const EXTRAPOLATED_PITCH = 12
export const ARMS: readonly Arm[] = [
  // Near 3-kpc arm, and the far one mirrored through the centre (Dame & Thaddeus 2008).
  { name: 'Near 3-kpc', measured: [15, 18], kink: 15, radius: 3.52, pitch: [-4.2, -4.2], drawn: [-25, 60], strength: 0.3 },
  { name: 'Far 3-kpc', measured: [195, 198], kink: 195, radius: 3.52, pitch: [-4.2, -4.2], drawn: [155, 240], strength: 0.3 },
  // Norma–Outer is one arm: continuing Norma at the Outer segment's pitch meets
  // that segment's measured end (β = 71° = -289°) across the far side.
  { name: 'Norma', measured: [5, 54], kink: 18, radius: 4.46, pitch: [-1, 19.5], drawn: [-289, 54], extrapolated: 9.5, strength: 0.45 },
  { name: 'Scutum–Centaurus', measured: [0, 104], kink: 23, radius: 4.91, pitch: [14.1, 12.1], drawn: [-260, 104], strength: 1 },
  { name: 'Sagittarius–Carina', measured: [2, 97], kink: 24, radius: 6.04, pitch: [17.1, 1], drawn: [-150, 150], strength: 0.5 },
  // The Local Arm (Orion Spur) passes just outside the Sun.
  { name: 'Local', measured: [-8, 34], kink: 9, radius: 8.26, pitch: [11.4, 11.4], drawn: [-35, 55], strength: 0.75 },
  { name: 'Perseus', measured: [-23, 115], kink: 40, radius: 8.87, pitch: [10.3, 8.7], drawn: [-140, 210], strength: 1 },
  { name: 'Outer', measured: [-16, 71], kink: 18, radius: 12.24, pitch: [3, 9.4], drawn: [-60, 71], strength: 0.45 },
]

/** Arm radius in kpc at Galactocentric azimuth β in degrees. */
export function armRadius(arm: Arm, beta: number): number {
  const turn = (from: number, to: number, pitch: number) => (to - from) * DEG * Math.tan(pitch * DEG)
  const inside = Math.min(arm.measured[1], Math.max(arm.measured[0], beta))
  const measured = turn(arm.kink, inside, inside < arm.kink ? arm.pitch[0] : arm.pitch[1])
  return arm.radius * Math.exp(-measured - turn(inside, beta, arm.extrapolated ?? EXTRAPOLATED_PITCH))
}

/** World position (pc) of a point at Galactocentric radius R (pc), azimuth β (deg) and height z (pc). */
export function galactocentricToWorld(radiusPc: number, beta: number, heightPc: number): [number, number, number] {
  return [R0_PC - radiusPc * Math.cos(beta * DEG), heightPc - SUN_HEIGHT_PC, -radiusPc * Math.sin(beta * DEG)]
}

function puffBuffer(count: number, noiseScale = 1 / 1500, noiseOffset = 0.37) {
  const puffs: PuffInstances = {
    count,
    centers: new Float32Array(count * 3),
    shapes: new Float32Array(count * 4),
    realColors: new Float32Array(count * 3),
    vividColors: new Float32Array(count * 3),
  }
  let index = 0
  const real = new Color()
  const vivid = new Color()
  return {
    puffs,
    add(position: readonly [number, number, number], radius: number, alpha: number, realColor: ColorRepresentation, vividColor: ColorRepresentation) {
      puffs.centers.set(position, index * 3)
      // Noise features shared by all puffs; about 1.5 kpc across in the Milky Way.
      puffs.shapes.set([radius, alpha, noiseScale, noiseOffset], index * 4)
      puffs.realColors.set(real.set(realColor).toArray(), index * 3)
      puffs.vividColors.set(vivid.set(vividColor).toArray(), index * 3)
      index++
    },
  }
}

const ARM_PUFFS = 8000
const KNOT_PUFFS = 180
const DISK_PUFFS = 3000
const BULGE_PUFFS = 560
const BAR_PUFFS = 220
const ARM_DUST_PUFFS = 1500
const DISK_DUST_PUFFS = 900
// Fraction of red, green and blue light each dust puff absorbs: reddening dims blue most.
const DUST_ABSORPTION = '#a0b4cc'
// The long bar's near end points into the first quadrant (Wegg et al. 2015).
const BAR_ANGLE = 27

export interface GalaxyPuffs { emission: PuffInstances; dust: PuffInstances }

export function generateGalaxyPuffs(): GalaxyPuffs {
  const random = seededRandom(0x6a1a)
  const emission = puffBuffer(ARM_PUFFS + KNOT_PUFFS + DISK_PUFFS + BULGE_PUFFS + BAR_PUFFS)
  const dust = puffBuffer(ARM_DUST_PUFFS + DISK_DUST_PUFFS)
  const lengths = ARMS.map((arm) => {
    let length = 0
    for (let beta = arm.drawn[0]; beta < arm.drawn[1]; beta++) length += armRadius(arm, beta + 0.5) * DEG
    return length
  })
  const maxRadii = ARMS.map((arm) => Math.max(armRadius(arm, arm.drawn[0]), armRadius(arm, arm.drawn[1]), arm.radius))
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  // Uniform along all arms' length, so faint arms stay as smooth as bright ones.
  const armPoint = () => {
    let pick = random() * totalLength
    let index = 0
    while (pick > lengths[index]! && index < ARMS.length - 1) pick -= lengths[index++]!
    const arm = ARMS[index]!
    for (;;) {
      const beta = arm.drawn[0] + random() * (arm.drawn[1] - arm.drawn[0])
      const radius = armRadius(arm, beta)
      if (random() * maxRadii[index]! > radius) continue
      // Brightness tapers over the last 25° of each end.
      const taper = Math.min(1, (beta - arm.drawn[0]) / 25, (arm.drawn[1] - beta) / 25)
      // Arm width grows outward (Reid et al. 2019: 336 pc at the Sun, +36 pc per kpc).
      const width = Math.max(200, 336 + 36 * (radius - R0_PC / 1000))
      return { beta, radius: radius * 1000, width, weight: arm.strength * taper * taper * (3 - 2 * taper) }
    }
  }
  // Exponential disk: brighter inward, scale length 3.2 kpc.
  const surface = (radiusPc: number) => Math.exp((R0_PC - radiusPc) / 3200)

  for (let i = 0; i < ARM_PUFFS; i++) {
    const { beta, radius, width, weight } = armPoint()
    const r = radius + gaussian(random) * width
    const height = gaussian(random) * (110 + 12 * Math.max(0, r / 1000 - 8))
    emission.add(galactocentricToWorld(r, beta, height), 220 + 120 * random(),
      0.06 * weight * Math.min(3, surface(r)) * (0.4 + 0.6 * random()), '#d4dfff', '#9fb8ff')
  }
  // Star-forming knots: bright bluish clusters, H-alpha pink when exaggerated.
  for (let i = 0; i < KNOT_PUFFS; i++) {
    const { beta, radius, width, weight } = armPoint()
    const r = radius + gaussian(random) * width * 0.4
    emission.add(galactocentricToWorld(r, beta, gaussian(random) * 50), 70 + 60 * random(),
      0.1 * weight * Math.min(2, surface(r)) * (0.5 + 0.5 * random()), '#e6edff', '#ff7aa2')
  }
  // Old disk starlight: evenly spread puffs whose brightness follows the
  // exponential profile, so faint outskirts stay smooth instead of sparse.
  for (let i = 0; i < DISK_PUFFS; i++) {
    const r = 16_000 * Math.sqrt(random())
    emission.add(galactocentricToWorld(r, random() * 360, gaussian(random) * 300), 650 + 250 * random(),
      0.028 * Math.min(5, surface(r)) * (0.8 + 0.2 * random()), '#fff0dc', '#ffe2b8')
  }
  // Boxy bulge and the thinner long bar, both along the bar axis.
  const barPoint = (along: number, across: number, height: number) => {
    const angle = BAR_ANGLE * DEG
    const x = R0_PC - along * Math.cos(angle) - across * Math.sin(angle)
    const y = along * Math.sin(angle) - across * Math.cos(angle)
    return [x, height - SUN_HEIGHT_PC, -y] as [number, number, number]
  }
  for (let i = 0; i < BULGE_PUFFS; i++) {
    const core = i < BULGE_PUFFS / 4
    const scale = core ? 0.35 : 1
    emission.add(barPoint(gaussian(random) * 1500 * scale, gaussian(random) * 650 * scale, gaussian(random) * 620 * scale),
      core ? 280 : 480 + 200 * random(), (core ? 0.16 : 0.1) * (0.6 + 0.4 * random()),
      core ? '#fff1d6' : '#ffdcae', core ? '#ffe7b0' : '#ffc36b')
  }
  for (let i = 0; i < BAR_PUFFS; i++) {
    const along = (random() * 2 - 1) * 4600
    emission.add(barPoint(along, gaussian(random) * 320, gaussian(random) * 160), 380,
      0.07 * (1 - 0.6 * Math.abs(along) / 4600), '#ffe2b8', '#ffcd85')
  }

  // Dust lanes run along the inner, concave edge of the trailing arms. The arms'
  // inner ends converge around the bar, where little dust is left to block it.
  for (let i = 0; i < ARM_DUST_PUFFS; i++) {
    const { beta, radius, width, weight } = armPoint()
    const r = radius - width * (0.7 - 0.45 * gaussian(random))
    const inner = Math.min(1, Math.max(0, (r - 4000) / 1500))
    dust.add(galactocentricToWorld(r, beta, gaussian(random) * 55), 220 + 120 * random(),
      0.05 * Math.sqrt(weight) * inner * inner * (0.5 + 0.5 * random()), DUST_ABSORPTION, DUST_ABSORPTION)
  }
  // A thin diffuse dust disk barely dims the face-on view, but its column is
  // about thirty times deeper edge-on, where it draws the dark mid-plane lane.
  for (let i = 0; i < DISK_DUST_PUFFS; i++) {
    const r = 3500 + 9500 * Math.sqrt(random())
    dust.add(galactocentricToWorld(r, random() * 360, gaussian(random) * 40), 300 + 150 * random(),
      0.05 * (0.5 + 0.5 * random()), DUST_ABSORPTION, DUST_ABSORPTION)
  }
  return { emission: emission.puffs, dust: dust.puffs }
}


// The Local Group galaxies near the Milky Way, each generated from its published geometry: the disk's tilt
// and orientation on the sky, scale lengths, and its best-known features at their measured sky offsets.
// Puffs are produced in a sky frame centered on the galaxy, in pc: east, north and depth away from the Sun.

type Vec3 = [number, number, number]
type Random = () => number

/** A disk seen at inclination `inclination` (0 = face-on) with its line of nodes at position angle `nodes`. */
export function tiltedDisk(inclinationDeg: number, nodesDeg: number, farSideDeg: number) {
  const cosI = Math.cos(inclinationDeg * DEG)
  const sinI = Math.sin(inclinationDeg * DEG)
  // Position angles run from north through east.
  const major: Vec3 = [Math.sin(nodesDeg * DEG), Math.cos(nodesDeg * DEG), 0]
  const far: Vec3 = [Math.sin(farSideDeg * DEG), Math.cos(farSideDeg * DEG), 0]
  // In the disk plane, toward the far side: foreshortened on the sky and receding.
  const inPlane: Vec3 = [far[0] * cosI, far[1] * cosI, sinI]
  const normal: Vec3 = [
    major[1] * inPlane[2] - major[2] * inPlane[1],
    major[2] * inPlane[0] - major[0] * inPlane[2],
    major[0] * inPlane[1] - major[1] * inPlane[0],
  ]
  return {
    /** Sky-frame point of disk coordinates: u along the line of nodes, v in the plane, w along the normal. */
    toSky(u: number, v: number, w: number): Vec3 {
      return [0, 1, 2].map((axis) => u * major[axis]! + v * inPlane[axis]! + w * normal[axis]!) as Vec3
    },
    /** Disk coordinates of the disk point seen at a sky offset (east, north). */
    fromSky(east: number, north: number): [number, number] {
      return [east * major[0] + north * major[1], (east * far[0] + north * far[1]) / cosI]
    },
  }
}

/** A radius drawn from an exponential disk of scale length `scale`, as a surface density. */
function exponentialRadius(random: Random, scale: number, limit: number): number {
  for (;;) {
    const radius = -scale * Math.log((1 - random()) * (1 - random()))
    if (radius <= limit) return radius
  }
}

/** A point on a logarithmic spiral arm from `inner` to `outer` radius, starting at angle `phase`. */
function spiralPoint(random: Random, inner: number, outer: number, pitchDeg: number, phase: number): [number, number] {
  // Uniform along the arm's length, which grows with radius.
  const radius = Math.sqrt(inner * inner + random() * (outer * outer - inner * inner))
  const angle = phase + Math.log(radius / inner) / Math.tan(pitchDeg * DEG)
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}

/** A point along a sky-frame polyline (east, north), uniform in length. */
function polylinePoint(random: Random, points: readonly (readonly [number, number])[]): [number, number] {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index]![0], point[1] - points[index]![1]))
  let pick = random() * lengths.reduce((sum, length) => sum + length, 0)
  let index = 0
  while (pick > lengths[index]! && index < lengths.length - 1) pick -= lengths[index++]!
  const t = Math.min(1, pick / lengths[index]!)
  const [from, to] = [points[index]!, points[index + 1]!]
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

interface PuffSample { at: Vec3; radius: number; alpha: number; real: Color; vivid: Color }
interface GalaxyModel {
  emission: number
  dust: number
  /** Noise features about this many pc across. */
  featurePc: number
  sampleEmission(random: Random): PuffSample
  sampleDust(random: Random): PuffSample
}

const color = (hex: string) => new Color(hex)
const DUST = color(DUST_ABSORPTION)
const HII_REAL = color('#ffc9d6')
const HII_VIVID = color('#ff7aa2')
/** A tint between two colors, clamped: the warm inner disk to the young, blue outskirts. */
const tint = (from: Color, to: Color, t: number) => from.clone().lerp(to, Math.min(1, Math.max(0, t)))

/** Picks a component by its weight, so every prefix of the puffs is an unbiased mix. */
function pick<T>(random: Random, components: readonly (readonly [number, T])[]): T {
  let value = random() * components.reduce((sum, [weight]) => sum + weight, 0)
  for (const [weight, component] of components) if ((value -= weight) <= 0) return component
  return components.at(-1)![1]
}

/** Places fixed for every prefix, such as star-forming complexes: H II regions cluster in them as in photographs. */
function fixedPlaces<T>(seed: number, count: number, place: (random: Random) => T): T[] {
  const random = seededRandom(seed)
  return Array.from({ length: count }, () => place(random))
}

const sample = (at: Vec3, radius: number, alpha: number, real: Color, vivid: Color): PuffSample =>
  ({ at, radius, alpha, real, vivid })

// Andromeda: i = 77°, long axis at PA 38°, nearer on the northwest side (the far side lies at PA 128°).
// Exponential disk of 5.3 kpc, a large bulge and the star-forming ring at 10 kpc (32,000 ly).
function andromedaModel(): GalaxyModel {
  const disk = tiltedDisk(77, 38, 128)
  const [bulgeReal, bulgeVivid, coreReal, coreVivid] = ['#ffe6c6', '#ffc87c', '#fff4e2', '#ffe2a6'].map(color)
  const [innerReal, innerVivid, outerReal, outerVivid] = ['#f1ebe4', '#ffe9cc', '#d6e0ff', '#a6bfff'].map(color)
  const arm = (random: Random) => spiralPoint(random, 4000, 21_000, 8, random() < 0.5 ? 0 : Math.PI)
  const ring = (random: Random): [number, number] => {
    const angle = random() * 2 * Math.PI
    const radius = 10_000 + gaussian(random) * 700
    return [radius * Math.cos(angle), radius * Math.sin(angle)]
  }
  const regions = fixedPlaces(0x3131, 34, (random) => random() < 0.65 ? ring(random) : arm(random))
  const point = ([u, v]: [number, number], width: number, height: number, random: Random) =>
    disk.toSky(u + gaussian(random) * width, v + gaussian(random) * width, gaussian(random) * height)
  return {
    emission: 18_000, dust: 6000, featurePc: 2500,
    sampleEmission: (random) => pick(random, [
      [0.03, () => sample(disk.toSky(gaussian(random) * 260, gaussian(random) * 260, gaussian(random) * 220), 170, 0.16, coreReal!, coreVivid!)],
      [0.13, () => sample(disk.toSky(gaussian(random) * 1100, gaussian(random) * 1100, gaussian(random) * 850), 460, 0.085, bulgeReal!, bulgeVivid!)],
      [0.42, () => {
        const radius = exponentialRadius(random, 5300, 20_000)
        const angle = random() * 2 * Math.PI
        const t = (radius - 2500) / 8000
        return sample(disk.toSky(radius * Math.cos(angle), radius * Math.sin(angle), gaussian(random) * 300), 420 + 160 * random(), 0.034,
          tint(innerReal!, outerReal!, t), tint(innerVivid!, outerVivid!, t))
      }],
      [0.18, () => sample(point(ring(random), 250, 110, random), 260, 0.05, outerReal!, outerVivid!)],
      [0.19, () => sample(point(arm(random), 550, 140, random), 280, 0.042, outerReal!, outerVivid!)],
      [0.05, () => sample(point(regions[Math.floor(random() * regions.length)]!, 180, 50, random), 110, 0.12, HII_REAL, HII_VIVID)],
    ])(),
    sampleDust: (random) => pick(random, [
      [0.45, () => sample(point(ring(random), 400, 60, random), 280, 0.06 * (0.5 + 0.5 * random()), DUST, DUST)],
      [0.4, () => {
        const [u, v] = arm(random)
        const radius = Math.hypot(u, v)
        // Dust lanes follow the inner edge of each arm.
        return sample(point([u * (1 - 500 / radius), v * (1 - 500 / radius)], 280, 50, random), 260, 0.05 * (0.5 + 0.5 * random()), DUST, DUST)
      }],
      [0.15, () => {
        const radius = 2000 + 5000 * Math.sqrt(random())
        const angle = random() * 2 * Math.PI
        return sample(disk.toSky(radius * Math.cos(angle), radius * Math.sin(angle), gaussian(random) * 60), 320, 0.035, DUST, DUST)
      }],
    ])(),
  }
}

// Triangulum: i = 54°, long axis at PA 22°; a loosely wound, patchy spiral of 1.6 kpc scale length
// without a bulge. NGC 604 lies 553″ east and 444″ north of the nucleus, 4.07 pc per arcsecond at 840 kpc.
function triangulumModel(): GalaxyModel {
  const disk = tiltedDisk(54, 22, 112)
  const [innerReal, innerVivid, outerReal, outerVivid, nucleusReal, nucleusVivid] = ['#f1ece6', '#ffeacc', '#d8e2ff', '#9fb8ff', '#fff4e4', '#ffe6b8'].map(color)
  // Fragments of arms beside the two main ones give the flocculent look.
  const fragments = fixedPlaces(0x3333, 9, (random) => ({ inner: 1500 + 5000 * random(), phase: random() * 2 * Math.PI }))
  const armPoint = (random: Random): [number, number] => {
    if (random() < 0.62) return spiralPoint(random, 600, 8500, 28, random() < 0.5 ? 0 : Math.PI)
    const fragment = fragments[Math.floor(random() * fragments.length)]!
    return spiralPoint(random, fragment.inner, fragment.inner * 1.7, 30, fragment.phase)
  }
  const regions = fixedPlaces(0x3334, 40, armPoint)
  const ngc604 = disk.fromSky(553 * 4.07, 444 * 4.07)
  const point = ([u, v]: [number, number], width: number, height: number, random: Random) =>
    disk.toSky(u + gaussian(random) * width, v + gaussian(random) * width, gaussian(random) * height)
  return {
    emission: 11_000, dust: 2500, featurePc: 1000,
    sampleEmission: (random) => pick(random, [
      [0.03, () => sample(disk.toSky(gaussian(random) * 120, gaussian(random) * 120, gaussian(random) * 100), 90, 0.2, nucleusReal!, nucleusVivid!)],
      [0.42, () => {
        const radius = exponentialRadius(random, 1600, 9000)
        const angle = random() * 2 * Math.PI
        const t = (radius - 800) / 3500
        return sample(disk.toSky(radius * Math.cos(angle), radius * Math.sin(angle), gaussian(random) * 180), 300 + 100 * random(), 0.034,
          tint(innerReal!, outerReal!, t), tint(innerVivid!, outerVivid!, t))
      }],
      [0.43, () => sample(point(armPoint(random), 330, 80, random), 180, 0.045, outerReal!, outerVivid!)],
      [0.11, () => sample(point(regions[Math.floor(random() * regions.length)]!, 110, 40, random), 80, 0.13, HII_REAL, HII_VIVID)],
      [0.01, () => sample(point(ngc604, 110, 50, random), 90, 0.22, HII_REAL, HII_VIVID)],
    ])(),
    sampleDust: (random) => {
      const [u, v] = armPoint(random)
      const radius = Math.max(1, Math.hypot(u, v))
      return sample(point([u * (1 - 250 / radius), v * (1 - 250 / radius)], 220, 50, random), 200, 0.03 * (0.5 + 0.5 * random()), DUST, DUST)
    },
  }
}

// Large Magellanic Cloud: i = 34.7°, line of nodes at PA 122.5°, the northeast side nearer (van der Marel &
// Cioni 2001). One degree is 865 pc at 49.6 kpc. The off-center bar, the northern arm and the Tarantula
// Nebula (30 Doradus, 1.33° east and 0.66° north of the center) are placed on the sky.
function largeMagellanicModel(): GalaxyModel {
  const disk = tiltedDisk(34.7, 122.5, 212.5)
  const [barReal, barVivid, diskReal, diskVivid] = ['#f2eee8', '#fff2da', '#e3e9ff', '#b2c6ff'].map(color)
  const BAR_PA = 110 * DEG
  const tarantula: [number, number] = [1152, 569]
  // From the Tarantula Nebula, north and west, then down to the western end of the bar.
  const arm = [tarantula, [800, 1300], [0, 1700], [-900, 1600], [-1600, 1000], [-1900, 200]] as const
  const diskSky = (random: Random): [number, number] => {
    const radius = exponentialRadius(random, 1500, 5500)
    const angle = random() * 2 * Math.PI
    return [radius * Math.cos(angle), 500 + radius * Math.sin(angle)]
  }
  const regions = fixedPlaces(0x1111, 18, (random) => random() < 0.6 ? polylinePoint(random, arm) : diskSky(random))
  const onDisk = ([east, north]: readonly [number, number], height: number, random: Random): Vec3 => {
    const [u, v] = disk.fromSky(east, north)
    return disk.toSky(u, v, gaussian(random) * height)
  }
  const near = ([east, north]: readonly [number, number], width: number, random: Random): [number, number] =>
    [east + gaussian(random) * width, north + gaussian(random) * width]
  return {
    emission: 14_000, dust: 900, featurePc: 900,
    sampleEmission: (random) => pick(random, [
      [0.26, () => {
        // A smooth, flat-topped profile along the bar, fading out by its ends 1.7 kpc from the middle.
        const along = 1700 * Math.tanh(gaussian(random) * 0.75) * (0.85 + 0.15 * random())
        const across = gaussian(random) * 300 * (1 - 0.4 * (along / 1700) ** 2)
        return sample(onDisk([along * Math.sin(BAR_PA) + across * Math.cos(BAR_PA), along * Math.cos(BAR_PA) - across * Math.sin(BAR_PA)], 150, random),
          160, 0.045, barReal!, barVivid!)
      }],
      [0.42, () => sample(onDisk(diskSky(random), 250, random), 260, 0.03, diskReal!, diskVivid!)],
      [0.24, () => sample(onDisk(near(polylinePoint(random, arm), 300, random), 120, random), 140, 0.045, diskReal!, diskVivid!)],
      [0.05, () => sample(onDisk(near(regions[Math.floor(random() * regions.length)]!, 90, random), 50, random), 70, 0.12, HII_REAL, HII_VIVID)],
      [0.03, () => sample(onDisk(near(tarantula, 130, random), 80, random), 90, 0.22, HII_REAL, HII_VIVID)],
    ])(),
    // The Cloud holds little dust: faint lanes along the arm and around the Tarantula Nebula.
    sampleDust: (random) => pick(random, [
      [0.7, () => sample(onDisk(near(polylinePoint(random, arm), 280, random), 60, random), 180, 0.014, DUST, DUST)],
      [0.3, () => sample(onDisk(near(tarantula, 350, random), 60, random), 160, 0.018, DUST, DUST)],
    ])(),
  }
}

// Small Magellanic Cloud: an elongated body along PA 45°, stretched along the line of sight and nearer in the
// northeast (Graczyk et al. 2020: 10 kpc between the nearest and farthest eclipsing binaries). The Wing points
// east toward the Large Cloud; NGC 346 lies 0.47° east and 0.65° north. One degree is 1,090 pc at 62.4 kpc.
function smallMagellanicModel(): GalaxyModel {
  const [bodyReal, bodyVivid, barReal, barVivid] = ['#e6ebff', '#b8caff', '#eef1ff', '#c8d6ff'].map(color)
  const AXIS = 45 * DEG
  // Northeast is nearer: depth falls along the long axis.
  const elongated = (along: number, across: number, depth: number): Vec3 =>
    [along * Math.sin(AXIS) + across * Math.cos(AXIS), along * Math.cos(AXIS) - across * Math.sin(AXIS), depth - 1.2 * along]
  const wing = (random: Random): Vec3 => [1300 + gaussian(random) * 380, -250 + gaussian(random) * 260, gaussian(random) * 600 - 600]
  const bar = (random: Random, width: number): Vec3 => elongated((random() * 2 - 1) * 1100, gaussian(random) * width, gaussian(random) * 900)
  const regions = fixedPlaces(0x2222, 14, (random) => random() < 0.7 ? bar(random, 160) : wing(random))
  const around = ([east, north, depth]: Vec3, width: number, random: Random): Vec3 =>
    [east + gaussian(random) * width, north + gaussian(random) * width, depth + gaussian(random) * width]
  return {
    emission: 8000, dust: 400, featurePc: 700,
    sampleEmission: (random) => pick(random, [
      [0.56, () => sample(elongated(gaussian(random) * 900, gaussian(random) * 450, gaussian(random) * 1800), 220, 0.032, bodyReal!, bodyVivid!)],
      [0.24, () => sample(bar(random, 220), 140, 0.05, barReal!, barVivid!)],
      [0.12, () => sample(wing(random), 130, 0.04, bodyReal!, bodyVivid!)],
      [0.065, () => sample(around(regions[Math.floor(random() * regions.length)]!, 80, random), 70, 0.12, HII_REAL, HII_VIVID)],
      [0.015, () => sample(around([510, 710, -1.2 * 863], 70, random), 70, 0.24, HII_REAL, HII_VIVID)],
    ])(),
    sampleDust: (random) => sample(bar(random, 200), 180, 0.012, DUST, DUST),
  }
}

const LOCAL_GROUP_MODELS: Record<string, () => GalaxyModel> = {
  'large-magellanic-cloud': largeMagellanicModel,
  'small-magellanic-cloud': smallMagellanicModel,
  'andromeda-galaxy': andromedaModel,
  'triangulum-galaxy': triangulumModel,
}

// Dwarf spheroidal and dwarf elliptical galaxies: a dust-free Plummer spheroid of old stars, whose projected
// half-light radius is the published one, flattened and turned on the sky as measured. The unmeasured depth
// is the geometric mean of the two sky axes. Lower surface brightness dims the puffs, 0.16 dex per magnitude
// instead of 0.4, so the 11 magnitudes from Messier 32 to the Sextans Dwarf all stay visible.
const SPHEROID_PUFFS = 2000
type GalaxyModelSource = Pick<Star, 'id'> & { galaxy: Pick<GalaxyDetails, 'ra_deg' | 'dec_deg' | 'model_radius_pc' | 'palette' | 'spheroid'> }

function spheroidModel({ galaxy: { spheroid, model_radius_pc: limit, palette } }: GalaxyModelSource): GalaxyModel {
  const { half_light_radius_pc: scale, ellipticity, position_angle_deg: angle, surface_brightness_v: brightness } = spheroid!
  const real = color(palette.real)
  const vivid = color(palette.exaggerated)
  const [sin, cos] = [Math.sin(angle * DEG), Math.cos(angle * DEG)]
  const ratio = 1 - ellipticity
  const alpha = Math.min(0.06, 0.025 * 10 ** (-0.16 * (brightness - 21)))
  return {
    emission: SPHEROID_PUFFS, dust: 0, featurePc: 2 * scale,
    sampleEmission(random) {
      for (;;) {
        const radius = scale / Math.sqrt(random() ** (-2 / 3) - 1)
        if (!(radius <= limit)) continue
        const z = 2 * random() - 1
        const phi = 2 * Math.PI * random()
        const along = radius * Math.sqrt(1 - z * z) * Math.cos(phi)
        const across = radius * Math.sqrt(1 - z * z) * Math.sin(phi) * ratio
        // Larger puffs outward keep the faint outskirts smooth.
        return sample([along * sin + across * cos, along * cos - across * sin, radius * z * Math.sqrt(ratio)],
          scale * (0.2 + 0.25 * Math.min(1, radius / scale)), alpha * (0.7 + 0.3 * random()), real, vivid)
      }
    },
    sampleDust: () => { throw new Error('A spheroid model has no dust.') },
  }
}

function galaxyModel(galaxy: GalaxyModelSource): GalaxyModel | undefined {
  return galaxy.galaxy.spheroid ? spheroidModel(galaxy) : LOCAL_GROUP_MODELS[galaxy.id]?.()
}

/** World directions of east, north and away from the Sun at a galaxy's center. */
function skyFrame(details: Pick<GalaxyDetails, 'ra_deg' | 'dec_deg'>): [Vector3, Vector3, Vector3] {
  const toWorld = (equatorial: Vec3) => {
    const [x, y, z] = ICRS_TO_GALACTIC_ROWS.map((row) => row[0] * equatorial[0] + row[1] * equatorial[1] + row[2] * equatorial[2])
    return galacticToWorld({ x_pc: x!, y_pc: y!, z_pc: z! })
  }
  const alpha = details.ra_deg * DEG
  const delta = details.dec_deg * DEG
  return [
    toWorld([-Math.sin(alpha), Math.cos(alpha), 0]),
    toWorld([-Math.sin(delta) * Math.cos(alpha), -Math.sin(delta) * Math.sin(alpha), Math.cos(delta)]),
    toWorld([Math.cos(delta) * Math.cos(alpha), Math.cos(delta) * Math.sin(alpha), Math.sin(delta)]),
  ]
}

/** The first `limit` puffs of one galaxy, relative to its center in world axes; every larger limit yields the same prefix. */
export function generateLocalGalaxyPuffs(galaxy: GalaxyModelSource, kind: 'emission' | 'dust', limit?: number): PuffInstances {
  const model = galaxyModel(galaxy)
  if (!model) throw new Error(`No galaxy model: ${galaxy.id}`)
  const count = Math.min(model[kind], limit ?? model[kind])
  const random = seededRandom([...galaxy.id].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), kind === 'dust' ? 0x9e37 : 0x811c))
  const [east, north, away] = skyFrame(galaxy.galaxy)
  const buffer = puffBuffer(count, 1 / model.featurePc, 0.37)
  const position = new Vector3()
  for (let index = 0; index < count; index++) {
    const { at, radius, alpha, real, vivid } = kind === 'dust' ? model.sampleDust(random) : model.sampleEmission(random)
    position.copy(east).multiplyScalar(at[0]).addScaledVector(north, at[1]).addScaledVector(away, at[2])
    buffer.add([position.x, position.y, position.z], radius, alpha, real, vivid)
  }
  return buffer.puffs
}

function localGalaxySource(galaxy: Star & { galaxy: GalaxyDetails }, kind: 'emission' | 'dust', count: number): PuffSource {
  const radius = galaxy.galaxy.model_radius_pc
  let puffs: PuffInstances | null = null
  return {
    count,
    extent: { center: galacticToWorld(galaxy), semiAxes: [radius, radius] },
    instances(limit) {
      // Generated only as far as the view has needed it.
      if (!puffs || puffs.count < limit) puffs = generateLocalGalaxyPuffs(galaxy, kind, limit)
      return puffs
    },
  }
}

export interface GalaxyLayer {
  group: Group
  /** The Milky Way model and the other galaxies fade on their own schedules. */
  setOpacity(milkyWay: number, others: number): void
  setColorMode(mode: StarColorMode): void
  /** Weighs each galaxy's starlight and dust for the band. */
  setBand(band: WavelengthBandId): void
  setViewportHeight(pixels: number): void
  /** Picks each galaxy's detail for the camera and draws the farther galaxies first, so nearer dust dims them. */
  update(camera: Camera): void
  dispose(): void
}

// The Galactic Center in world pc, where the Milky Way model is centered.
const GALACTIC_CENTER = new Vector3(...galactocentricToWorld(0, 0, 0))

export function createGalaxyLayer(mode: StarColorMode, galaxies: readonly Star[]): GalaxyLayer {
  const { emission, dust } = generateGalaxyPuffs()
  const milkyWay = {
    center: GALACTIC_CENTER,
    layers: [
      createPuffLayer([puffSource(emission)], mode, { maxScreenFraction: 0.25 }),
      createPuffLayer([puffSource(dust)], mode, { absorb: true, maxScreenFraction: 0.25 }),
    ],
  }
  const others = galaxies.flatMap((galaxy) => {
    const model = galaxy.galaxy && galaxyModel(galaxy as Star & { galaxy: GalaxyDetails })
    if (!model) return []
    const center = galacticToWorld(galaxy)
    // Dust-free models draw starlight only.
    const layers = (['emission', 'dust'] as const).filter((kind) => model[kind] > 0).map((kind) => {
      const layer = createPuffLayer([localGalaxySource(galaxy as Star & { galaxy: GalaxyDetails }, kind, model[kind])], mode, { absorb: kind === 'dust', maxScreenFraction: 0.25 })
      // Puffs are stored relative to the center, which keeps them precise millions of light-years out.
      layer.mesh.position.copy(center)
      return layer
    })
    return [{ center, layers }]
  })
  const all = [milkyWay, ...others]
  const renderOrderStep = 0.8 / all.length
  const group = new Group()
  for (const { layers } of all) {
    for (const layer of layers) {
      layer.setVisible([true])
      group.add(layer.mesh)
    }
  }
  const eachLayer = (action: (layer: NebulaLayer) => void) => all.forEach(({ layers }) => layers.forEach(action))
  const cameraPosition = new Vector3()
  return {
    group,
    setOpacity(milkyWayOpacity, otherOpacity) {
      group.visible = milkyWayOpacity > 0 || (others.length > 0 && otherOpacity > 0)
      for (const layer of milkyWay.layers) layer.setOpacity(milkyWayOpacity)
      for (const { layers } of others) for (const layer of layers) layer.setOpacity(otherOpacity)
    },
    setColorMode(next) {
      eachLayer((layer) => layer.setColorMode(next))
    },
    setBand(band) {
      // Each galaxy's layers are its starlight, then its dust.
      const { emission, dust } = GALAXY_BANDS[band]
      for (const { layers } of all) layers.forEach((layer, index) => layer.setBand(band, index === 0 ? emission : dust))
    },
    setViewportHeight(pixels) {
      eachLayer((layer) => layer.setViewportHeight(pixels))
    },
    update(camera) {
      if (!group.visible) return
      cameraPosition.setFromMatrixPosition(camera.matrixWorld)
      // Above the panorama (-1) and below the sky grid, star marks and labels (1 and up); each galaxy's dust right after its light.
      ;[...all].sort((first, second) => second.center.distanceToSquared(cameraPosition) - first.center.distanceToSquared(cameraPosition))
        .forEach(({ layers }, rank) => layers.forEach((layer, index) => { layer.mesh.renderOrder = -0.9 + renderOrderStep * (rank + 0.5 * index) }))
      for (const { layers } of others) for (const layer of layers) layer.updateDetail(camera)
    },
    dispose() {
      eachLayer((layer) => layer.dispose())
    },
  }
}
