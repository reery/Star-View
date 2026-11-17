import {
  AddEquation, Color, CustomBlending, DataTexture, Float32BufferAttribute, HalfFloatType, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, Mesh, MinEquation, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, PlaneGeometry, RedFormat, RepeatWrapping, Scene,
  ShaderMaterial, UnsignedByteType, Vector2, Vector3, WebGLRenderTarget, ZeroFactor,
  type Camera, type Texture, type WebGLRenderer,
} from 'three'
import type { NebulaDetails, Star } from './catalog-model'
import { galacticToWorld, type StarColorMode } from './astronomy'
import { decodeNebulaMask } from './nebula-overlay-model'
import {
  MOLECULAR_CLOUD_BANDS, nebulaBandSurfaceBrightness, remnantBandShape, wavelengthBandColor, type RemnantBandShape, type WavelengthBandId,
} from './wavelength-vision'

// Each puff is one camera-facing quad: all nebulae share a single instanced draw call.
export const NEBULA_MAX_SCREEN_FRACTION = 0.2
// Wider overlapping kernels join the emitting gas into a continuous veil.
// Compensate their larger area so smoothing alone does not add light.
const PUFF_OVERLAP = 36
const PUFF_ALPHA = 0.22 * 9 / PUFF_OVERLAP
const MIN_PUFF_PIXELS = 1.5
// Kernel radius of mask-shaped nebulae in mask pixels.
const MASK_PUFF_PIXELS = 2
// Every nebula shares one slightly long exposure: puff opacity follows surface brightness, the Orion
// Nebula's 6-arcmin peak (20.3 R mag/arcsec²) at full weight, with a gentle stretch like a processed
// photograph. A floor keeps the faintest nebulae just visible. Each lift step stretches harder and raises
// the floor, brightening fainter nebulae while the Orion Nebula stays at full weight.
const EXPOSURE_REFERENCE_MAG = 20.3
const EXPOSURE_STRETCH = 0.7
const EXPOSURE_FLOOR = 0.05

export function nebulaExposure(surfaceBrightnessMag: number, lift = 0): number {
  const stretch = EXPOSURE_STRETCH - 0.1 * lift
  const floor = EXPOSURE_FLOOR + 0.01 * lift
  return Math.max(floor, Math.min(1, 10 ** (-0.4 * stretch * (surfaceBrightnessMag - EXPOSURE_REFERENCE_MAG))))
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(random: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}

export interface NebulaBasis {
  lineOfSight: Vector3
  major: Vector3
  minor: Vector3
}

export function nebulaBasis(center: Vector3, observer: Vector3, positionAngleDeg: number): NebulaBasis {
  const lineOfSight = center.clone().sub(observer).normalize()
  // World axes are Galactic (x, z, -y); build local longitude/latitude directions at the target.
  const longitude = Math.atan2(-lineOfSight.z, lineOfSight.x)
  const latitude = Math.asin(Math.max(-1, Math.min(1, lineOfSight.y)))
  const east = new Vector3(-Math.sin(longitude), 0, -Math.cos(longitude))
  const north = new Vector3(-Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude))
  const angle = positionAngleDeg * Math.PI / 180
  const major = north.clone().multiplyScalar(Math.cos(angle)).addScaledVector(east, Math.sin(angle))
  const minor = north.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(east, Math.cos(angle))
  return { lineOfSight, major, minor }
}

export interface NebulaPuffs {
  count: number
  // Per puff: line-of-sight, major and minor offsets from the center in pc.
  local: Float32Array
  centers: Float32Array
  // Per puff: radius pc, alpha, coherent noise scale and nebula-wide offset.
  shapes: Float32Array
  realColors: Float32Array
  vividColors: Float32Array
}

/** The instance data every puff layer draws; `local` is only needed to build nebula shapes. */
export type PuffInstances = Omit<NebulaPuffs, 'local'>

function paletteColor(palette: readonly string[], t: number, target: Color, scratch: Color): Color {
  const scaled = Math.max(0, Math.min(1, t)) * (palette.length - 1)
  const index = Math.min(palette.length - 2, Math.floor(scaled))
  return target.set(palette[index]!).lerp(scratch.set(palette[index + 1]!), scaled - index)
}

type Sample = { d: number; u: number; v: number; t: number; size: number; alpha: number }

interface MaskPixels { values: Uint8Array; lit: number[]; peak: number }

// Every lit pixel gets puffs in turn; a seeded shuffle keeps any prefix an unbiased level-of-detail subset.
function maskPixels(mask: { values: string }, random: () => number): MaskPixels {
  const values = decodeNebulaMask(mask)
  const lit: number[] = []
  values.forEach((value, index) => { if (value > 0) lit.push(index) })
  for (let index = lit.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[lit[index], lit[swap]] = [lit[swap]!, lit[index]!]
  }
  return { values, lit, peak: values.reduce((peak, value) => Math.max(peak, value), 0) }
}

// Opacity follows the observed brightness pixel by pixel, which avoids the speckle of random placement.
function maskSampler(details: NebulaDetails, { values, lit, peak }: MaskPixels, random: () => number): () => Sample {
  const { kind, semi_axes_pc: [depth, major, minor], mask } = details.shape
  const [columns, rows] = mask!.size
  let next = 0
  return () => {
    const pixel = lit[next++ % lit.length]!
    const v = ((pixel % columns) + random()) / columns * 2 - 1
    const u = (Math.floor(pixel / columns) + random()) / rows * 2 - 1
    // Sky offsets set the depth range of a sphere (filled) or its surface (shell).
    const cap = Math.sqrt(Math.max(0, 1 - u * u - v * v))
    const d = kind === 'shell' ? (random() < 0.5 ? -cap : cap) : (random() * 2 - 1) * Math.max(0.2, cap)
    const brightness = values[pixel]! / peak
    return { d: d * depth, u: u * major, v: v * minor, t: 1 - brightness, size: 1, alpha: brightness }
  }
}

// Supernova-remnant shocks: thin wavy arcs on the shell surface. Arcs seen edge-on crowd into
// the limb. Each hydrogen-alpha thread (red, t ≤ 0.5) carries an [O III] sheath
// (teal, t = 1) slightly outside it, where the faster, fresher shock lies.
const FILAMENT_ARCS = 110
const FILAMENT_WIDTH = 0.3
const OXYGEN_SHARE = 0.32
// Successive puffs of a thread step along it by the golden ratio, so every prefix
// (a level of detail) spreads evenly instead of beading into random clumps and gaps.
const GOLDEN = (Math.sqrt(5) - 1) / 2

// With a mask, threads are kept where the observed shell is bright: the outline is measured, the threads illustrative.
// The mask spans more than the shell, so the threads lie on a sphere of the catalogued size inside it.
function filamentSampler(details: NebulaDetails, random: () => number, pixels: MaskPixels | null): () => Sample {
  const [axisMajor, axisMinor] = details.angular_size_arcmin
  const sphere = pixels
    ? details.distance_pc * Math.tan(Math.sqrt(axisMajor * axisMinor) / 120 * Math.PI / 180) / details.shape.semi_axes_pc[1]
    : 1
  const [depth, major, minor] = details.shape.semi_axes_pc.map((axis) => axis * sphere) as [number, number, number]
  const [columns, rows] = details.shape.mask?.size ?? [1, 1]
  const observed = (u: number, v: number) => pixels!.values[
    Math.min(rows - 1, Math.floor((u + 1) / 2 * rows)) * columns + Math.min(columns - 1, Math.floor((v + 1) / 2 * columns))
  ]! / pixels!.peak
  const unit = () => {
    const z = random() * 2 - 1
    const phi = 2 * Math.PI * random()
    const s = Math.sqrt(1 - z * z)
    return new Vector3(s * Math.cos(phi), s * Math.sin(phi), z)
  }
  const arcs = Array.from({ length: FILAMENT_ARCS }, () => {
    const pole = unit()
    const e1 = new Vector3(1, 0, 0).cross(pole)
    if (e1.lengthSq() < 0.01) e1.set(0, 1, 0).cross(pole)
    e1.normalize()
    const angle = 0.3 + 0.9 * random()
    const length = 0.25 + 0.85 * random()
    return {
      pole, e1, e2: pole.clone().cross(e1), angle, length, start: 2 * Math.PI * random(),
      wiggle: 0.015 + 0.045 * random(), frequency: 3 + 5 * random(), phase: 2 * Math.PI * random(),
      radius: 0.94 + 0.06 * random(), weight: length * Math.sin(angle), brightness: 0.35 + 0.65 * random(),
      steps: [random(), random()],
    }
  })
  const total = arcs.reduce((sum, arc) => sum + arc.weight, 0)
  const point = new Vector3()
  return () => {
    for (;;) {
      let pick = random() * total
      const arc = arcs.find((candidate) => (pick -= candidate.weight) <= 0) ?? arcs.at(-1)!
      const oxygen = random() < OXYGEN_SHARE
      const step = oxygen ? 1 : 0
      const along = arc.steps[step] = (arc.steps[step]! + GOLDEN) % 1
      const theta = arc.start + along * arc.length
      const angle = arc.angle + arc.wiggle * Math.sin(arc.frequency * theta + arc.phase)
      point.copy(arc.pole).multiplyScalar(Math.cos(angle))
        .addScaledVector(arc.e1, Math.sin(angle) * Math.cos(theta)).addScaledVector(arc.e2, Math.sin(angle) * Math.sin(theta))
      // Threads fade out toward their ends instead of stopping abruptly.
      const taper = Math.sin(Math.PI * along)
      const radius = arc.radius + (oxygen ? 0.02 : 0) + gaussian(random) * 0.004
      if (pixels && random() > observed(point.y * radius * sphere, point.z * radius * sphere)) continue
      return {
        d: point.x * radius * depth, u: point.y * radius * major, v: point.z * radius * minor,
        t: oxygen ? 1 : 0.5 * random(), size: FILAMENT_WIDTH,
        alpha: (oxygen ? 3 : 2.6) * arc.brightness * taper,
      }
    }
  }
}

// Measured 3D emission: thin puffs at reconstructed positions (palette t ≤ 1/3, brighter toward
// the first stop), interleaved with a smooth body of wide, faint puffs (t ≥ 2/3) so every prefix
// keeps both. Sizes are in pc.
const POINT_ALPHA = 6
const BODY_OVERLAP = 8
const BODY_ALPHA = 0.9
const BODY_EXTENT = 0.85

function pointSampler(details: NebulaDetails, random: () => number): () => Sample {
  const { semi_axes_pc: [depth, major, minor], points } = details.shape
  const values = decodeNebulaMask(points!)
  const measured = values.length / 4
  const bodyShare = (details.puff_count - measured) / details.puff_count
  const bodyRadius = Math.sqrt(BODY_OVERLAP * major * minor / Math.max(1, details.puff_count - measured))
  const offset = (byte: number) => byte / 127.5 - 1
  let index = 0
  let next = 0
  return () => {
    const body = Math.floor((index + 1) * bodyShare) > Math.floor(index * bodyShare)
    index++
    if (body || next >= measured) {
      for (;;) {
        const d = random() * 2 - 1
        const u = random() * 2 - 1
        const v = random() * 2 - 1
        const radius = Math.hypot(d, u, v)
        if (radius > 1) continue
        return {
          d: d * depth * BODY_EXTENT, u: u * major * BODY_EXTENT, v: v * minor * BODY_EXTENT,
          t: 2 / 3 + radius / 3, size: bodyRadius, alpha: BODY_ALPHA * (1 - radius * radius),
        }
      }
    }
    const at = 4 * next++
    const brightness = values[at + 3]! / 255
    return {
      d: offset(values[at]!) * depth, u: offset(values[at + 1]!) * major, v: offset(values[at + 2]!) * minor,
      t: (1 - brightness) / 3, size: points!.radius_pc, alpha: POINT_ALPHA * brightness,
    }
  }
}

function shapeSampler(details: NebulaDetails, random: () => number, pixels: MaskPixels | null = null): () => Sample {
  const { kind, semi_axes_pc: [depth, major, minor], layer_offsets_pc: offsets } = details.shape
  const clumps = Array.from({ length: 7 }, () => ({ u: (random() * 2 - 1) * 0.7, v: (random() * 2 - 1) * 0.7, d: (random() * 2 - 1) * 0.5, weight: 0.5 + random() }))
  const density = (d: number, u: number, v: number) => 0.3 + clumps.reduce((sum, clump) =>
    sum + clump.weight * Math.exp(-((u - clump.u) ** 2 + (v - clump.v) ** 2 + (d - clump.d) ** 2) / 0.08), 0)
  const maxDensity = 0.3 + clumps.reduce((sum, clump) => sum + clump.weight, 0)
  const accept = (d: number, u: number, v: number) => random() * maxDensity < density(d, u, v)

  if (kind === 'blister') {
    // Bowl open toward the observer: the bright back wall lies behind the ionizing star.
    const rimCos = Math.cos(100 * Math.PI / 180)
    const rimAngle = Math.acos(rimCos)
    return () => {
      if (random() < 0.24) {
        const d = 0.2 + gaussian(random) * 0.08
        const u = gaussian(random) * 0.14
        const v = gaussian(random) * 0.14
        return { d: d * depth, u: u * major, v: v * minor, t: Math.min(0.3, Math.hypot(u, v)), size: 1, alpha: 0.85 }
      }
      for (;;) {
        const cosTheta = rimCos + (1 - rimCos) * random()
        const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
        const phi = 2 * Math.PI * random()
        const radius = 0.72 + 0.28 * random()
        const d = radius * cosTheta
        const u = radius * sinTheta * Math.cos(phi)
        const v = radius * sinTheta * Math.sin(phi)
        const t = 0.15 + 0.85 * Math.acos(cosTheta) / rimAngle
        // Thin the wall toward the rim so the bowl does not read as a limb-brightened ring.
        if (random() > 1.1 - t || !accept(d, u, v)) continue
        return { d: d * depth, u: u * major, v: v * minor, t, size: 1, alpha: 1.5 * (1 - 0.55 * t) }
      }
    }
  }
  if (kind === 'shell') {
    return () => {
      for (;;) {
        const cosTheta = random() * 2 - 1
        const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
        const phi = 2 * Math.PI * random()
        const radius = 0.8 + 0.2 * random()
        const d = radius * cosTheta
        const u = radius * sinTheta * Math.cos(phi)
        const v = radius * sinTheta * Math.sin(phi)
        if (!accept(d, u, v)) continue
        return { d: d * depth, u: u * major, v: v * minor, t: (radius - 0.8) / 0.2, size: 1, alpha: 0.5 + 2.5 * (radius - 0.8) }
      }
    }
  }
  if (kind === 'filaments') return filamentSampler(details, random, pixels)
  if (kind === 'points') return pointSampler(details, random)
  if (kind === 'layers') {
    return () => {
      for (;;) {
        const layer = Math.floor(random() * offsets.length)
        const radius = Math.sqrt(random())
        const phi = 2 * Math.PI * random()
        const u = radius * Math.cos(phi)
        const v = radius * Math.sin(phi)
        if (!accept(0, u, v)) continue
        // The front sheet forward-scatters more starlight toward the observer.
        const front = offsets[layer] === Math.min(...offsets)
        return { d: offsets[layer]! + gaussian(random) * depth, u: u * major, v: v * minor, t: radius, size: 1, alpha: (front ? 1 : 0.6) * (1 - 0.45 * radius * radius) }
      }
    }
  }
  return () => {
    for (;;) {
      const d = random() * 2 - 1
      const u = random() * 2 - 1
      const v = random() * 2 - 1
      const radius = Math.hypot(d, u, v)
      if (radius > 1 || !accept(d, u, v)) continue
      return { d: d * depth, u: u * major, v: v * minor, t: radius, size: 1, alpha: 1 - 0.5 * radius * radius }
    }
  }
}

// Measured pillars (NebulaShape.pillars): columns along their axis points, lit by the stars at `light_pc`. Their light
// comes from the skin that faces the stars, brighter toward the tips, with a faint photo-evaporating haze lifted off
// it; dust fills them. Where dust glows (far infrared, radio), the columns themselves shine instead.
const PILLAR_SKIN = 0.45
const PILLAR_HAZE = 0.25
const PILLAR_GAIN = 8
// Optical depth across a pillar's dust, and across the darkest lane of a traced dust grid.
const PILLAR_DUST_DEPTH = 2.5
const GRID_DUST_DEPTH = 2.5
// Coherent noise about a third of a parsec across textures the pillars.
const PILLAR_NOISE = 3
// Smallest skin and dust puffs (pc), so thin columns are still covered by overlapping puffs rather than beads.
const PILLAR_MIN_SKIN = 0.03
const PILLAR_MIN_DUST = 0.045
// Columns that end narrower than this (pc) end in a rounded, lit head; the broad base they rise from does not.
const PILLAR_HEAD = 0.2
// A tinted column absorbs each channel in proportion to one minus half its tint, the colour its dust lets through.
const PILLAR_TINT = 0.5
type Pillars = NonNullable<NebulaDetails['shape']['pillars']>

interface PillarSample { d: number; u: number; v: number; brightness: number; radius: number; absorption: Color }

/** Puffs on a pillar's lit skin, or inside its volume, in local (line of sight, north, east) coordinates. */
function pillarSampler(pillars: Pillars, volume: boolean, random: () => number): { area: number; next: () => PillarSample } {
  const local = ([north, east, depth]: readonly number[]) => new Vector3(depth, north, east)
  const light = local(pillars.light_pc)
  const neutral = new Color(1, 1, 1)
  const segments = pillars.columns.flatMap(({ points, opacity = 1, lit = true, tint, fade = false }) => {
    const absorption = tint ? new Color(1, 1, 1).sub(new Color(tint).multiplyScalar(PILLAR_TINT)) : neutral
    const lengths = points.slice(1).map((point, index) => local(point).distanceTo(local(points[index]!)))
    const total = lengths.reduce((sum, length) => sum + length, 0)
    let along = 0
    return lengths.map((length, index) => {
      const a = local(points[index]!)
      const dir = local(points[index + 1]!).sub(a).normalize()
      const n1 = new Vector3(1, 0, 0).cross(dir)
      if (n1.lengthSq() < 0.01) n1.set(0, 1, 0).cross(dir)
      n1.normalize()
      const r0 = points[index]![3]!
      const r1 = points[index + 1]![3]!
      const segment = { a, dir, n1, n2: dir.clone().cross(n1), length, r0, r1, opacity, lit, absorption, fade, t0: along / total, t1: (along + length) / total, last: index === lengths.length - 1 }
      along += length
      return segment
    })
  })
  // Puffs are spread evenly over each column's projected area, scaled by its opacity: thin, fainter base clouds get
  // proportionally fewer. Unlit columns, such as the base the pillars rise from, have no glowing skin.
  const weight = (segment: typeof segments[number]) => segment.length * (segment.r0 + segment.r1) * segment.opacity * (volume || segment.lit ? 1 : 0)
  const area = segments.reduce((sum, segment) => sum + weight(segment), 0)
  const axis = new Vector3()
  const normal = new Vector3()
  const point = new Vector3()
  return {
    area,
    next() {
      for (;;) {
        let pick = random() * area
        const segment = segments.find((candidate) => (pick -= weight(candidate)) <= 0) ?? segments.at(-1)!
        const s = random()
        const radius = segment.r0 + (segment.r1 - segment.r0) * s
        const tip = segment.t0 + (segment.t1 - segment.t0) * s
        // A fading column rises out of the glow: its dust and skin grow from nothing at its first point.
        const emerge = segment.fade ? Math.min(1, tip / 0.6) ** 2 : 1
        axis.copy(segment.a).addScaledVector(segment.dir, segment.length * s)
        const angle = 2 * Math.PI * random()
        normal.copy(segment.n1).multiplyScalar(Math.cos(angle)).addScaledVector(segment.n2, Math.sin(angle))
        if (volume) {
          const rho = Math.sqrt(random())
          point.copy(axis).addScaledVector(normal, 0.85 * radius * rho)
          return {
            d: point.x, u: point.y, v: point.z, brightness: (1 - 0.5 * rho * rho) * emerge,
            radius: Math.max(PILLAR_MIN_DUST, 0.6 * radius), absorption: segment.absorption,
          }
        }
        // The rounded head of each pillar.
        if (segment.last && segment.r1 < PILLAR_HEAD && s > 0.8 && random() < 0.5) {
          const z = random()
          normal.multiplyScalar(Math.sqrt(1 - z * z)).addScaledVector(segment.dir, z)
        }
        const haze = random() < PILLAR_HAZE
        point.copy(axis).addScaledVector(normal, radius * (1 + (haze ? 0.3 + 0.8 * random() : 0)))
        const lit = Math.max(0, normal.dot(axis.copy(light).sub(point).normalize()))
        const brightness = lit ** 1.5 * (0.3 + 0.7 * tip * tip) * (haze ? 0.4 : 1) * segment.opacity * emerge
        // Most puffs go where the skin is lit.
        if (brightness < 0.02 && random() > 0.15) continue
        return { d: point.x, u: point.y, v: point.z, brightness, radius: Math.max(PILLAR_MIN_SKIN, radius * (haze ? 0.8 : PILLAR_SKIN)), absorption: segment.absorption }
      }
    },
  }
}

/** Absorbing puffs of a nebula's traced dust lanes and pillars; their alpha is optical depth. */
export function generateNebulaDust(star: Star, observer: Vector3, limit?: number): NebulaPuffs {
  const details = star.nebula!
  const { dust, pillars, semi_axes_pc: [depth, major, minor] } = details.shape
  const count = (dust?.puffs ?? 0) + (pillars?.dust_puffs ?? 0)
  const generated = Math.min(count, limit ?? count)
  const random = seededRandom(details.seed + 1)
  const pillarShare = (pillars?.dust_puffs ?? 0) / count
  const columns = pillars ? pillarSampler(pillars, true, random) : null
  // Lanes lie at the front of the nebula, where they are seen against its glow.
  const lanes = dust ? maskPixels(dust, random) : null
  const [cells] = dust?.size ?? [1]
  const laneRadius = MASK_PUFF_PIXELS * 2 * major / cells
  const laneOverlap = dust && lanes ? dust.puffs * Math.PI * MASK_PUFF_PIXELS ** 2 / lanes.lit.length : 1
  const center = galacticToWorld(star)
  const basis = nebulaBasis(center, observer, details.shape.position_angle_deg)
  const puffs: NebulaPuffs = {
    count: generated,
    local: new Float32Array(generated * 3),
    centers: new Float32Array(generated * 3),
    shapes: new Float32Array(generated * 4),
    realColors: new Float32Array(generated * 3),
    vividColors: new Float32Array(generated * 3),
  }
  const position = new Vector3()
  const neutral = [1, 1, 1]
  let lane = 0
  for (let index = 0; index < generated; index++) {
    let d: number, u: number, v: number, radius: number, alpha: number
    let absorption = neutral
    if (columns && Math.floor((index + 1) * pillarShare) > Math.floor(index * pillarShare)) {
      const sample = columns.next()
      ;({ d, u, v } = sample)
      radius = sample.radius
      absorption = sample.absorption.toArray()
      // Puffs this size overlapping at a point, for the same optical depth through every column.
      alpha = PILLAR_DUST_DEPTH * sample.brightness * columns.area / (pillars!.dust_puffs * Math.PI * sample.radius ** 2)
    } else {
      const pixel = lanes!.lit[lane++ % lanes!.lit.length]!
      u = ((Math.floor(pixel / cells) + random()) / cells * 2 - 1)
      v = ((pixel % cells + random()) / cells * 2 - 1)
      d = -(0.6 + 0.4 * random()) * Math.sqrt(Math.max(0, 1 - u * u - v * v)) * depth
      u *= major
      v *= minor
      radius = laneRadius
      alpha = GRID_DUST_DEPTH * lanes!.values[pixel]! / lanes!.peak / laneOverlap
    }
    puffs.local.set([d, u, v], index * 3)
    position.copy(center).addScaledVector(basis.lineOfSight, d).addScaledVector(basis.major, u).addScaledVector(basis.minor, v)
    puffs.centers.set([position.x, position.y, position.z], index * 3)
    puffs.shapes.set([radius * (0.9 + 0.2 * random()), alpha * (0.7 + 0.6 * random()), PILLAR_NOISE, (details.seed % 997) / 997], index * 4)
    puffs.realColors.set(absorption, index * 3)
    puffs.vividColors.set(absorption, index * 3)
  }
  return puffs
}

// A band shape replaces the observed mask or measured points, scaled about the same center.
function withBandShape(details: NebulaDetails, { kind, scale }: RemnantBandShape): NebulaDetails {
  const { position_angle_deg, layer_offsets_pc, semi_axes_pc } = details.shape
  return { ...details, shape: { kind, position_angle_deg, layer_offsets_pc, semi_axes_pc: semi_axes_pc.map((axis) => axis * scale) as [number, number, number] } }
}

/** Generates the first `limit` puffs in a band, the same prefix every larger limit yields. */
export function generateNebulaPuffs(star: Star, observer: Vector3, limit?: number, band: WavelengthBandId = 'visible'): NebulaPuffs {
  if (!star.nebula) throw new Error(`Not a nebula: ${star.id}`)
  const bandShape = remnantBandShape(star.id, band)
  const details = bandShape ? withBandShape(star.nebula, bandShape) : star.nebula
  const count = details.puff_count
  const generated = Math.min(count, limit ?? count)
  const random = seededRandom(details.seed)
  const mask = details.shape.mask
  const pixels = mask ? maskPixels(mask, random) : null
  // A filament shell keeps its threads; its mask only says where they are.
  const maskShaped = pixels !== null && details.shape.kind !== 'filaments'
  const sample = maskShaped ? maskSampler(details, pixels, random) : shapeSampler(details, random, pixels)
  // Pillar puffs are interleaved with the nebula's, so every prefix keeps both.
  const pillars = details.shape.pillars
  const pillarShare = pillars ? pillars.rim_puffs / count : 0
  const bodyCount = count - (pillars?.rim_puffs ?? 0)
  const columns = pillars ? pillarSampler(pillars, MOLECULAR_CLOUD_BANDS[band].glow > 0, random) : null
  const center = galacticToWorld(star)
  const basis = nebulaBasis(center, observer, details.shape.position_angle_deg)
  const [, major, minor] = details.shape.semi_axes_pc
  // Point samples give their puff sizes in pc.
  let baseRadius = details.shape.points ? 1 : Math.sqrt(PUFF_OVERLAP * major * minor / bodyCount)
  let alphaScale = 1
  if (mask && maskShaped) {
    // Kernels of a few map pixels blend neighbours smoothly; the brightest pixel
    // then reaches the same optical depth as the core of a uniform nebula.
    const [columns, rows] = mask.size
    // A mask with more lit pixels than puffs widens its kernels to keep the same overlap.
    const kernel = MASK_PUFF_PIXELS * Math.sqrt(Math.max(1, pixels.lit.length / bodyCount))
    baseRadius = kernel * Math.max(2 * major / rows, 2 * minor / columns)
    alphaScale = PUFF_OVERLAP * pixels.lit.length / (bodyCount * Math.PI * kernel ** 2)
  }
  const noiseScale = 0.35 / Math.sqrt(major * minor)
  const noiseOffset = (details.seed % 997) / 997
  const puffs: NebulaPuffs = {
    count: generated,
    local: new Float32Array(generated * 3),
    centers: new Float32Array(generated * 3),
    shapes: new Float32Array(generated * 4),
    realColors: new Float32Array(generated * 3),
    vividColors: new Float32Array(generated * 3),
  }
  const color = new Color()
  const scratch = new Color()
  const position = new Vector3()
  // Puffs are independent draws, so any prefix is an unbiased level-of-detail subset.
  for (let index = 0; index < generated; index++) {
    if (columns && Math.floor((index + 1) * pillarShare) > Math.floor(index * pillarShare)) {
      const { d, u, v, brightness, radius } = columns.next()
      puffs.local.set([d, u, v], index * 3)
      position.copy(center).addScaledVector(basis.lineOfSight, d).addScaledVector(basis.major, u).addScaledVector(basis.minor, v)
      puffs.centers.set([position.x, position.y, position.z], index * 3)
      puffs.shapes.set([radius * (0.9 + 0.2 * random()), brightness * PILLAR_GAIN * PUFF_ALPHA * (0.8 + 0.2 * random()), PILLAR_NOISE, noiseOffset], index * 4)
      puffs.realColors.set(paletteColor(details.palette.real, 1 - brightness, color, scratch).toArray(), index * 3)
      puffs.vividColors.set(paletteColor(details.palette.exaggerated, 1 - brightness, color, scratch).toArray(), index * 3)
      continue
    }
    const { d, u, v, t, size, alpha } = sample()
    puffs.local.set([d, u, v], index * 3)
    position.copy(center).addScaledVector(basis.lineOfSight, d).addScaledVector(basis.major, u).addScaledVector(basis.minor, v)
    puffs.centers.set([position.x, position.y, position.z], index * 3)
    puffs.shapes.set([
      baseRadius * size * (0.9 + 0.2 * random()),
      alpha * alphaScale * PUFF_ALPHA * (0.45 + 0.55 * random()),
      noiseScale,
      noiseOffset,
    ], index * 4)
    puffs.realColors.set(paletteColor(details.palette.real, t, color, scratch).toArray(), index * 3)
    puffs.vividColors.set(paletteColor(details.palette.exaggerated, t, color, scratch).toArray(), index * 3)
  }
  return puffs
}

// Copies each drawn source's first `count` puffs into the front of the target buffers. A thinned
// source widens its puffs by `radiusScale`, so fewer puffs cover the same area with the same light;
// `alphaScale` applies the source's exposure.
export function packNebulaInstances(
  drawn: readonly { puffs: PuffInstances; count: number; radiusScale: number; alphaScale: number }[],
  target: { centers: Float32Array; shapes: Float32Array; realColors: Float32Array; vividColors: Float32Array },
): number {
  let offset = 0
  for (const { puffs, count, radiusScale, alphaScale } of drawn) {
    target.centers.set(puffs.centers.subarray(0, count * 3), offset * 3)
    target.shapes.set(puffs.shapes.subarray(0, count * 4), offset * 4)
    if (radiusScale !== 1 || alphaScale !== 1) {
      for (let index = offset; index < offset + count; index++) {
        target.shapes[index * 4]! *= radiusScale
        target.shapes[index * 4 + 1]! *= alphaScale
      }
    }
    target.realColors.set(puffs.realColors.subarray(0, count * 3), offset * 3)
    target.vividColors.set(puffs.vividColors.subarray(0, count * 3), offset * 3)
    offset += count
  }
  return offset
}

/**
 * Puffs one source draws. `instances(limit)` returns at least its first `limit` puffs; any prefix is
 * an unbiased level-of-detail subset. With an `extent`, the puffs drawn follow the source's size on screen.
 */
export interface PuffSource {
  count: number
  /** In a band, a source may draw a different shape with the same number of puffs. */
  instances(limit: number, band?: WavelengthBandId): PuffInstances
  /** World center and the two largest semi-axes in pc. */
  extent?: { center: Vector3; semiAxes: readonly [number, number] }
  /** Opacity scale at an exposure lift in a wavelength band; 1 without one, 0 where the source is dark. */
  exposure?(lift: number, band: WavelengthBandId): number
  /**
   * Dust that absorbs the light of a half-resolution layer drawn before it, thinned with the source; its exposure is
   * the band's absorption.
   */
  dust?: PuffSource
}

export function puffSource(instances: PuffInstances): PuffSource {
  return { count: instances.count, instances: () => instances }
}

// The coarsest level of detail: a nebula only a few pixels across draws just this prefix.
const MIN_DETAIL_PUFFS = 16

// Generates a nebula's puffs only as far as the view has needed them.
function nebulaPuffSource(star: Star, observer: Vector3): PuffSource {
  const { puff_count: count, shape } = star.nebula!
  const [first, second] = [...shape.semi_axes_pc].sort((a, b) => b - a)
  let puffs: NebulaPuffs | null = null
  let puffShape: RemnantBandShape | undefined
  let puffGlow = false
  let dustPuffs: NebulaPuffs | null = null
  return {
    count,
    extent: { center: galacticToWorld(star), semiAxes: [first!, second!] },
    dust: (shape.dust || shape.pillars) && {
      count: (shape.dust?.puffs ?? 0) + (shape.pillars?.dust_puffs ?? 0),
      exposure: (_lift, band) => MOLECULAR_CLOUD_BANDS[band].absorption,
      instances(limit) {
        if (!dustPuffs || dustPuffs.count < limit) dustPuffs = generateNebulaDust(star, observer, limit)
        return dustPuffs
      },
    },
    exposure: (lift, band) => {
      const surfaceBrightness = nebulaBandSurfaceBrightness(star, band)
      return surfaceBrightness === null ? 0 : nebulaExposure(surfaceBrightness, lift)
    },
    instances(limit, band = 'visible') {
      const bandShape = remnantBandShape(star.id, band)
      // Pillars draw their dust as light where dust glows.
      const glow = !!shape.pillars && MOLECULAR_CLOUD_BANDS[band].glow > 0
      if (!puffs || puffs.count < limit || bandShape !== puffShape || glow !== puffGlow) puffs = generateNebulaPuffs(star, observer, limit, band)
      puffShape = bandShape
      puffGlow = glow
      return puffs
    },
  }
}

/**
 * Puffs a source needs at `pixelsPerPc` (target pixels), from full detail down in steps of four.
 * Thinned puffs widen by √(full / drawn) but stay below the minimum kernel, and about
 * PUFF_OVERLAP of them still overlap per kernel, so the nebula looks the same.
 */
export function detailPuffCount(source: PuffSource, puffRadiusPc: number, pixelsPerPc: number): number {
  const [major, minor] = source.extent!.semiAxes
  const needed = Math.max(PUFF_OVERLAP * major * minor, source.count * puffRadiusPc ** 2) * (pixelsPerPc / MIN_PUFF_PIXELS) ** 2
  let level = source.count
  while (level > MIN_DETAIL_PUFFS && level / 4 >= needed) level /= 4
  return Math.max(Math.min(source.count, MIN_DETAIL_PUFFS), Math.ceil(level))
}

function noiseTexture(seed: number): DataTexture {
  const size = 64
  const random = seededRandom(seed)
  const octaves = [{ cells: 4, weight: 0.55 }, { cells: 8, weight: 0.3 }, { cells: 16, weight: 0.15 }]
    .map((octave) => ({ ...octave, lattice: Float32Array.from({ length: octave.cells * octave.cells }, random) }))
  const smooth = (value: number) => value * value * (3 - 2 * value)
  const data = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0
      for (const { cells, weight, lattice } of octaves) {
        const fx = x / size * cells
        const fy = y / size * cells
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const sx = smooth(fx - x0)
        const sy = smooth(fy - y0)
        const at = (column: number, row: number) => lattice[(row % cells) * cells + (column % cells)]!
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
        value += weight * (top + (bottom - top) * sy)
      }
      data[y * size + x] = Math.round(value * 255)
    }
  }
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.magFilter = texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export interface NebulaLayer {
  mesh: Mesh
  setVisible(visible: readonly boolean[]): void
  setLevelOfDetail(fraction: number): void
  setColorMode(mode: StarColorMode): void
  /** Lifts fainter puffs, in steps of a longer exposure. */
  setExposureLift(lift: number): void
  /** The lowest exposure of any source shown, e.g. to make faint sources visible in a wavelength band; 0 by default. */
  setMinimumExposure(minimum: number): void
  setViewportHeight(pixels: number): void
  /** Scales every puff's opacity, e.g. to fade the whole layer in. */
  setOpacity(opacity: number): void
  /**
   * Shows the layer in a wavelength band: each source's exposure follows the band, the whole layer's opacity scales
   * by weight, and outside visible light emitting puffs take the band's false colors.
   */
  setBand(band: WavelengthBandId, weight?: number): void
  /**
   * Draws the puffs of a half-resolution layer for the coming frame, each source with the detail
   * its size on screen needs; a no-op otherwise.
   */
  renderOffscreen(renderer: WebGLRenderer, camera: Camera): void
  /**
   * Gives each source with an extent the detail its size on screen needs, before the frame renders.
   * Half-resolution layers do this in renderOffscreen.
   */
  updateDetail(camera: Camera): void
  /** Puffs of the visible sources at full detail, after the power-saving fraction. */
  puffCount(): number
  /** Puffs drawn. */
  instanceCount(): number
  dispose(): void
}

export function createNebulaLayer(nebulae: readonly Star[], observer: Vector3, mode: StarColorMode): NebulaLayer {
  return createPuffLayer(nebulae.map((nebula) => nebulaPuffSource(nebula, observer)), mode, { halfResolution: true })
}

export interface PuffLayerOptions {
  /** Dim what lies behind instead of emitting light; the puff color is the absorbed fraction. */
  absorb?: boolean
  maxScreenFraction?: number
  /**
   * Render emitting puffs at half resolution, a quarter of the fill cost, and composite them
   * in the scene with the nearest puff depth so opaque objects and cloud absorption still sort.
   */
  halfResolution?: boolean
}

// View depth (pc) stored as a fraction of this range in the half-resolution alpha channel.
const OFFSCREEN_DEPTH_RANGE = 4096

function createHalfResolutionComposite(texture: Texture): Mesh {
  const material = new ShaderMaterial({
    uniforms: { nebulaMap: { value: texture } },
    transparent: true,
    // The same screen compositing as full-resolution puffs; screening is order independent.
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcColorFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vDepthProjection;
      void main() {
        vUv = uv;
        vDepthProjection = vec2(projectionMatrix[2][2], projectionMatrix[3][2]);
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D nebulaMap;
      varying vec2 vUv;
      varying vec2 vDepthProjection;
      void main() {
        vec3 color = texture2D(nebulaMap, vUv).rgb;
        float coverage = max(color.r, max(color.g, color.b));
        if (coverage < 0.0005) discard;
        // Nearest-texel depth: filtering would blend gas depth with the empty-sky sentinel.
        ivec2 size = textureSize(nebulaMap, 0);
        float viewDepth = texelFetch(nebulaMap, min(ivec2(vUv * vec2(size)), size - 1), 0).a * ${OFFSCREEN_DEPTH_RANGE}.0;
        gl_FragDepth = clamp((vDepthProjection.y / viewDepth - vDepthProjection.x) * 0.5 + 0.5, 0.0, 1.0);
        // Already display-encoded and premultiplied; coverage is the least opacity that keeps it valid.
        gl_FragColor = vec4(color, coverage);
      }
    `,
  })
  const mesh = new Mesh(new PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  return mesh
}

/** Instanced quads with per-puff attributes; `update` uploads the first `count` puffs packed into `buffers`. */
function puffInstances(capacity: number) {
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const buffers = {
    centers: new Float32Array(capacity * 3),
    shapes: new Float32Array(capacity * 4),
    realColors: new Float32Array(capacity * 3),
    vividColors: new Float32Array(capacity * 3),
  }
  const attributes = [
    ['puffCenter', new InstancedBufferAttribute(buffers.centers, 3)],
    ['puffShape', new InstancedBufferAttribute(buffers.shapes, 4)],
    ['puffRealColor', new InstancedBufferAttribute(buffers.realColors, 3)],
    ['puffVividColor', new InstancedBufferAttribute(buffers.vividColors, 3)],
  ] as const
  for (const [name, attribute] of attributes) geometry.setAttribute(name, attribute)
  geometry.instanceCount = 0
  return {
    geometry,
    buffers,
    update(count: number): number {
      geometry.instanceCount = count
      if (count === 0) return count
      for (const [, attribute] of attributes) {
        attribute.clearUpdateRanges()
        attribute.addUpdateRange(0, count * attribute.itemSize)
        attribute.needsUpdate = true
      }
      return count
    },
  }
}

export function createPuffLayer(
  sources: readonly PuffSource[],
  mode: StarColorMode,
  { absorb = false, maxScreenFraction = NEBULA_MAX_SCREEN_FRACTION, halfResolution = false }: PuffLayerOptions = {},
): NebulaLayer {
  const gas = puffInstances(sources.reduce((sum, source) => sum + source.count, 0))
  // Absorbing dust only darkens the light of a half-resolution target; elsewhere the layer has none.
  const dustCapacity = halfResolution ? sources.reduce((sum, source) => sum + (source.dust?.count ?? 0), 0) : 0
  const dust = dustCapacity > 0 ? puffInstances(dustCapacity) : null
  const noise = noiseTexture(0x5eed)
  const uniforms = {
    noiseMap: { value: noise },
    colorMix: { value: mode === 'exaggerated' ? 1 : 0 },
    gain: { value: mode === 'exaggerated' ? 2.6 : 2.3 },
    alphaScale: { value: 1 },
    viewportHeight: { value: 1 },
    maxScreenFraction: { value: maxScreenFraction },
    minPixels: { value: MIN_PUFF_PIXELS },
    bandMix: { value: 0 },
    bandShort: { value: new Color() },
    bandLong: { value: new Color() },
  }
  const shaders = {
    vertexShader: `
      attribute vec3 puffCenter;
      attribute vec4 puffShape;
      attribute vec3 puffRealColor;
      attribute vec3 puffVividColor;
      uniform float colorMix;
      uniform float alphaScale;
      uniform float viewportHeight;
      uniform float maxScreenFraction;
      uniform float minPixels;
      uniform float bandMix;
      uniform vec3 bandShort;
      uniform vec3 bandLong;
      varying vec2 vUv;
      varying vec3 vNoisePosition;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vViewDepth;
      void main() {
        vec4 viewCenter = modelViewMatrix * vec4(puffCenter, 1.0);
        float depth = -viewCenter.z;
        vViewDepth = depth;
        float radius = puffShape.x;
        // Fade puffs the camera is inside or about to enter; bounds overdraw when flying through.
        float nearFade = smoothstep(radius, radius * 4.0, depth);
        float pixelRadius = radius * projectionMatrix[1][1] * 0.5 * viewportHeight / max(depth, 1e-6);
        float scale = min(1.0, viewportHeight * maxScreenFraction / max(pixelRadius, 1e-6));
        // Subpixel puffs grow to a stable minimum size with energy-preserving alpha.
        float grow = max(1.0, minPixels / max(pixelRadius, 1e-6));
        vAlpha = puffShape.y * alphaScale * nearFade / (grow * grow);
        if (vAlpha < 0.001) {
          gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
          return;
        }
        vColor = mix(puffRealColor, puffVividColor, colorMix);
        // Outside visible light, the brightest gas takes the band's short-wavelength color.
        float brightness = smoothstep(0.02, 0.35, dot(vColor, vec3(0.2126, 0.7152, 0.0722)));
        #ifndef DUST
        vColor = mix(vColor, mix(bandLong, bandShort, brightness), bandMix);
        #endif
        vUv = position.xy;
        vec2 offset = position.xy * radius * scale * grow;
        // Sample one continuous field across overlapping puffs. Billboard
        // offsets use the camera's world-space right/up directions so the
        // texture stays attached to the gas as the camera turns.
        vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 worldPosition = (modelMatrix * vec4(puffCenter, 1.0)).xyz + cameraRight * offset.x + cameraUp * offset.y;
        vNoisePosition = worldPosition * puffShape.z + puffShape.w;
        gl_Position = projectionMatrix * (viewCenter + vec4(offset, 0.0, 0.0));
      }
    `,
    fragmentShader: `
      uniform sampler2D noiseMap;
      uniform float gain;
      varying vec2 vUv;
      varying vec3 vNoisePosition;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vViewDepth;
      void main() {
        float r2 = dot(vUv, vUv);
        if (r2 >= 1.0) discard;
        // A soft outer wing reveals faint gas like a stretched long exposure,
        // while the smooth cutoff avoids individual circular sprite outlines.
        float falloff = (0.82 * exp(-4.0 * r2) + 0.18 * exp(-1.4 * r2)) * (1.0 - smoothstep(0.55, 1.0, r2));
        vec3 p = vNoisePosition;
        float broad = texture2D(noiseMap, p.xy * 0.55 + p.z * vec2(0.21, -0.17)).r;
        float detail = texture2D(noiseMap, p.yz + p.x * vec2(-0.31, 0.23)).r;
        float wisps = smoothstep(0.38, 0.7, detail);
        float emission = 0.72 + 0.42 * broad + 0.18 * wisps;
        float alpha = 1.0 - exp(-vAlpha * falloff * emission * gain);
        #ifdef DUST
          // The puff color is the fraction of each channel the dust absorbs.
          gl_FragColor = vec4(vColor * alpha, alpha);
        #elif defined(HALF_RESOLUTION_TARGET)
          // Render targets stay linear, so encode for display as the canvas would.
          gl_FragColor = vec4(sRGBTransferOETF(vec4(vColor, 1.0)).rgb * alpha,
            alpha > 0.002 ? vViewDepth / ${OFFSCREEN_DEPTH_RANGE}.0 : 1.0);
        #else
          gl_FragColor = vec4(vColor, alpha);
          #include <colorspace_fragment>
          gl_FragColor.rgb *= gl_FragColor.a;
        #endif
      }
    `,
  }
  const material = new ShaderMaterial({
    uniforms,
    ...shaders,
    defines: halfResolution ? { HALF_RESOLUTION_TARGET: '' } : {},
    transparent: true,
    // Screen compositing gives overlapping emission a gentle highlight rolloff
    // instead of clipping large areas to white and overwhelming stellar marks.
    // Absorbing puffs instead multiply what lies behind by one minus their color.
    // Half-resolution targets keep the nearest puff depth in alpha instead of coverage.
    blending: CustomBlending,
    blendSrc: absorb ? ZeroFactor : OneFactor,
    blendDst: OneMinusSrcColorFactor,
    blendSrcAlpha: absorb ? ZeroFactor : OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    blendEquationAlpha: halfResolution ? MinEquation : AddEquation,
    premultipliedAlpha: true,
    depthTest: !halfResolution,
    depthWrite: false,
    toneMapped: false,
  })
  // Dust drawn after the light multiplies each channel by its transmission and leaves the depth in alpha untouched.
  const dustMaterial = dust && new ShaderMaterial({
    uniforms,
    ...shaders,
    defines: { HALF_RESOLUTION_TARGET: '', DUST: '' },
    transparent: true,
    blending: CustomBlending,
    blendSrc: ZeroFactor,
    blendDst: OneMinusSrcColorFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const puffs = new Mesh(gas.geometry, material)
  puffs.frustumCulled = false
  const target = halfResolution ? new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false }) : null
  const offscreen = target ? new Scene().add(puffs) : null
  if (offscreen && dust && dustMaterial) {
    const dustMesh = new Mesh(dust.geometry, dustMaterial)
    dustMesh.frustumCulled = false
    dustMesh.renderOrder = 1
    offscreen.add(dustMesh)
  }
  const mesh = target ? createHalfResolutionComposite(target.texture) : puffs
  // After opaque-like star cores (2), before additive stellar halos (3).
  mesh.renderOrder = 2.5
  mesh.visible = false
  const drawingSize = new Vector2()
  const clearColor = new Color()
  const cameraPosition = new Vector3()
  let visibility: boolean[] = sources.map(() => false)
  // Puffs each source needs on screen; sources without an extent always draw all of theirs.
  const screenCounts = sources.map((source) => source.extent ? Math.min(source.count, MIN_DETAIL_PUFFS) : source.count)
  // Largest radius among each source's coarsest puffs, measured once they exist.
  const puffRadii = sources.map(() => 0)
  let fraction = 1
  let opacity = 1
  let exposureLift = 0
  let minimumExposure = 0
  let band: WavelengthBandId = 'visible'
  let bandWeight = 1
  let packedKey = ''

  function repack(): void {
    const key = `${band}:${exposureLift}:${minimumExposure}:${fraction}:${visibility.map((shown, index) => shown ? screenCounts[index] : 0).join()}`
    if (key === packedKey) return
    packedKey = key
    const drawnDust: Parameters<typeof packNebulaInstances>[0][number][] = []
    const drawn = sources.flatMap((source, index) => {
      if (!visibility[index]) return []
      const exposure = source.exposure?.(exposureLift, band) ?? 1
      // Sources dark in the band cost nothing.
      if (exposure === 0) return []
      const alphaScale = Math.max(exposure, minimumExposure)
      const screenCount = screenCounts[index]!
      const count = Math.max(1, Math.ceil(screenCount * fraction))
      const absorption = dust && source.dust ? source.dust.exposure?.(exposureLift, band) ?? 1 : 0
      if (absorption > 0) {
        // Dust thins with its source, so it stays matched to the light it absorbs.
        const dustCount = Math.max(1, Math.ceil(source.dust!.count * count / source.count))
        drawnDust.push({ puffs: source.dust!.instances(dustCount, band), count: dustCount, radiusScale: Math.sqrt(source.count / screenCount), alphaScale: absorption })
      }
      return [{ puffs: source.instances(count, band), count, radiusScale: Math.sqrt(source.count / screenCount), alphaScale }]
    })
    const count = gas.update(packNebulaInstances(drawn, gas.buffers))
    dust?.update(packNebulaInstances(drawnDust, dust.buffers))
    mesh.visible = count > 0 && bandWeight > 0
    uniforms.alphaScale.value = opacity * bandWeight / fraction
  }

  function updateDetail(camera: Camera, height: number): void {
    cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    const pixelsPerPcAtUnitDistance = camera.projectionMatrix.elements[5]! * 0.5 * height
    sources.forEach((source, index) => {
      if (!source.extent || !visibility[index]) return
      if (puffRadii[index] === 0) {
        const floor = Math.min(source.count, MIN_DETAIL_PUFFS)
        const { shapes } = source.instances(floor, band)
        for (let puff = 0; puff < floor; puff++) puffRadii[index] = Math.max(puffRadii[index]!, shapes[puff * 4]!)
      }
      // The nearest point of the nebula sets its detail; from inside it, everything is drawn.
      const distance = cameraPosition.distanceTo(source.extent.center) - source.extent.semiAxes[0]
      screenCounts[index] = distance > 0 ? detailPuffCount(source, puffRadii[index]!, pixelsPerPcAtUnitDistance / distance) : source.count
    })
    repack()
  }

  return {
    mesh,
    setVisible(next) {
      visibility = sources.map((_, index) => next[index] === true)
      repack()
    },
    setLevelOfDetail(next) {
      if (!(next > 0 && next <= 1)) return
      fraction = next
      repack()
    },
    setExposureLift(next) {
      exposureLift = next
      repack()
    },
    setMinimumExposure(next) {
      minimumExposure = next
      repack()
    },
    setColorMode(next) {
      uniforms.colorMix.value = next === 'exaggerated' ? 1 : 0
      uniforms.gain.value = next === 'exaggerated' ? 2.6 : 2.3
    },
    setViewportHeight(pixels) {
      if (pixels > 0) uniforms.viewportHeight.value = pixels
    },
    setOpacity(next) {
      opacity = next
      uniforms.alphaScale.value = opacity * bandWeight / fraction
    },
    setBand(next, weight = 1) {
      band = next
      bandWeight = weight
      // A band shape may change puff sizes, which set each source's detail.
      puffRadii.fill(0)
      uniforms.bandMix.value = next === 'visible' || absorb ? 0 : 1
      wavelengthBandColor(next, 0, uniforms.bandShort.value)
      wavelengthBandColor(next, 1, uniforms.bandLong.value)
      packedKey = ''
      repack()
    },
    renderOffscreen(renderer, camera) {
      if (!target || !offscreen || !mesh.visible) return
      const previousTarget = renderer.getRenderTarget()
      if (previousTarget) drawingSize.set(previousTarget.width, previousTarget.height)
      else renderer.getDrawingBufferSize(drawingSize)
      target.setSize(Math.max(1, Math.ceil(drawingSize.x / 2)), Math.max(1, Math.ceil(drawingSize.y / 2)))
      // Puff sizes, screen caps and the minimum kernel follow the pixels actually drawn.
      uniforms.viewportHeight.value = target.height
      updateDetail(camera, target.height)
      renderer.getClearColor(clearColor)
      const clearAlpha = renderer.getClearAlpha()
      try {
        renderer.setRenderTarget(target)
        // Alpha 1 is the empty-sky depth sentinel.
        renderer.setClearColor(0x000000, 1)
        renderer.render(offscreen, camera)
      } finally {
        renderer.setClearColor(clearColor, clearAlpha)
        renderer.setRenderTarget(previousTarget)
      }
    },
    updateDetail(camera) {
      updateDetail(camera, uniforms.viewportHeight.value)
    },
    puffCount: () => sources.reduce((sum, source, index) => sum + (visibility[index] ? Math.max(1, Math.ceil(source.count * fraction)) : 0), 0),
    instanceCount: () => gas.geometry.instanceCount,
    dispose() {
      gas.geometry.dispose()
      material.dispose()
      dust?.geometry.dispose()
      dustMaterial?.dispose()
      noise.dispose()
      if (target) {
        target.dispose()
        mesh.geometry.dispose()
        ;(mesh.material as ShaderMaterial).dispose()
      }
    },
  }
}
