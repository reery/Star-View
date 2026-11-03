import { Color, Group } from 'three'
import type { StarColorMode } from './astronomy'
import { createPuffLayer, gaussian, seededRandom, type PuffInstances } from './nebula-layer'

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

function puffBuffer(count: number) {
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
    add(position: readonly [number, number, number], radius: number, alpha: number, realColor: string, vividColor: string) {
      puffs.centers.set(position, index * 3)
      // Noise features about 1.5 kpc across, shared by all puffs.
      puffs.shapes.set([radius, alpha, 1 / 1500, 0.37], index * 4)
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

export interface GalaxyLayer {
  group: Group
  setOpacity(opacity: number): void
  setColorMode(mode: StarColorMode): void
  setViewportHeight(pixels: number): void
  dispose(): void
}

export function createGalaxyLayer(mode: StarColorMode): GalaxyLayer {
  const { emission, dust } = generateGalaxyPuffs()
  const layers = [
    createPuffLayer([emission], mode, { maxScreenFraction: 0.25 }),
    createPuffLayer([dust], mode, { absorb: true, maxScreenFraction: 0.25 }),
  ]
  const group = new Group()
  layers.forEach((layer, index) => {
    layer.setVisible([true])
    // Above the panorama and below the sky grid, star marks and labels.
    layer.mesh.renderOrder = -0.8 + 0.1 * index
    group.add(layer.mesh)
  })
  return {
    group,
    setOpacity(opacity) {
      group.visible = opacity > 0
      for (const layer of layers) layer.setOpacity(opacity)
    },
    setColorMode(next) {
      for (const layer of layers) layer.setColorMode(next)
    },
    setViewportHeight(pixels) {
      for (const layer of layers) layer.setViewportHeight(pixels)
    },
    dispose() {
      for (const layer of layers) layer.dispose()
    },
  }
}
