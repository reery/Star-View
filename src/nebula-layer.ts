import {
  AddEquation, Color, CustomBlending, DataTexture, Float32BufferAttribute, HalfFloatType, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, Mesh, MinEquation, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, PlaneGeometry, RedFormat, RepeatWrapping, Scene,
  ShaderMaterial, UnsignedByteType, Vector2, Vector3, WebGLRenderTarget, ZeroFactor,
  type Camera, type Texture, type WebGLRenderer,
} from 'three'
import type { NebulaDetails, Star } from './catalog-model'
import { galacticToWorld, type StarColorMode } from './astronomy'
import { decodeNebulaMask } from './nebula-overlay-model'

// Each puff is one camera-facing quad: all nebulae share a single instanced draw call.
export const NEBULA_MAX_SCREEN_FRACTION = 0.2
// Wider overlapping kernels join the emitting gas into a continuous veil.
// Compensate their larger area so smoothing alone does not add light.
const PUFF_OVERLAP = 36
const PUFF_ALPHA = 0.22 * 9 / PUFF_OVERLAP
const MIN_PUFF_PIXELS = 1.5
// Kernel radius of mask-shaped nebulae in mask pixels.
const MASK_PUFF_PIXELS = 2

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

function filamentSampler(details: NebulaDetails, random: () => number): () => Sample {
  const [depth, major, minor] = details.shape.semi_axes_pc
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
    return {
      d: point.x * radius * depth, u: point.y * radius * major, v: point.z * radius * minor,
      t: oxygen ? 1 : 0.5 * random(), size: FILAMENT_WIDTH,
      alpha: (oxygen ? 3 : 2.6) * arc.brightness * taper,
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

function shapeSampler(details: NebulaDetails, random: () => number): () => Sample {
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
  if (kind === 'filaments') return filamentSampler(details, random)
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

export function generateNebulaPuffs(star: Star, observer: Vector3): NebulaPuffs {
  const details = star.nebula
  if (!details) throw new Error(`Not a nebula: ${star.id}`)
  const count = details.puff_count
  const random = seededRandom(details.seed)
  const mask = details.shape.mask
  const pixels = mask ? maskPixels(mask, random) : null
  const sample = pixels ? maskSampler(details, pixels, random) : shapeSampler(details, random)
  const center = galacticToWorld(star)
  const basis = nebulaBasis(center, observer, details.shape.position_angle_deg)
  const [, major, minor] = details.shape.semi_axes_pc
  // Point samples give their puff sizes in pc.
  let baseRadius = details.shape.points ? 1 : Math.sqrt(PUFF_OVERLAP * major * minor / count)
  let alphaScale = 1
  if (mask && pixels) {
    // Kernels of a few map pixels blend neighbours smoothly; the brightest pixel
    // then reaches the same optical depth as the core of a uniform nebula.
    const [columns, rows] = mask.size
    baseRadius = MASK_PUFF_PIXELS * Math.max(2 * major / rows, 2 * minor / columns)
    alphaScale = PUFF_OVERLAP * pixels.lit.length / (count * Math.PI * MASK_PUFF_PIXELS ** 2)
  }
  const noiseScale = 0.35 / Math.sqrt(major * minor)
  const noiseOffset = (details.seed % 997) / 997
  const puffs: NebulaPuffs = {
    count,
    local: new Float32Array(count * 3),
    centers: new Float32Array(count * 3),
    shapes: new Float32Array(count * 4),
    realColors: new Float32Array(count * 3),
    vividColors: new Float32Array(count * 3),
  }
  const color = new Color()
  const scratch = new Color()
  const position = new Vector3()
  // Puffs are independent draws, so any prefix is an unbiased level-of-detail subset.
  for (let index = 0; index < count; index++) {
    const { d, u, v, t, size, alpha } = sample()
    puffs.local.set([d, u, v], index * 3)
    position.copy(center).addScaledVector(basis.lineOfSight, d).addScaledVector(basis.major, u).addScaledVector(basis.minor, v)
    puffs.centers.set([position.x, position.y, position.z], index * 3)
    puffs.shapes.set([
      baseRadius * size * (0.9 + 0.2 * random()),
      details.brightness * alpha * alphaScale * PUFF_ALPHA * (0.45 + 0.55 * random()),
      noiseScale,
      noiseOffset,
    ], index * 4)
    puffs.realColors.set(paletteColor(details.palette.real, t, color, scratch).toArray(), index * 3)
    puffs.vividColors.set(paletteColor(details.palette.exaggerated, t, color, scratch).toArray(), index * 3)
  }
  return puffs
}

// Copies each visible nebula's first LOD fraction of puffs into the front of the target buffers.
export function packNebulaInstances(
  sources: readonly PuffInstances[],
  visible: readonly boolean[],
  fraction: number,
  target: { centers: Float32Array; shapes: Float32Array; realColors: Float32Array; vividColors: Float32Array },
): number {
  let offset = 0
  sources.forEach((puffs, index) => {
    if (!visible[index]) return
    const count = Math.max(1, Math.min(puffs.count, Math.ceil(puffs.count * fraction)))
    target.centers.set(puffs.centers.subarray(0, count * 3), offset * 3)
    target.shapes.set(puffs.shapes.subarray(0, count * 4), offset * 4)
    target.realColors.set(puffs.realColors.subarray(0, count * 3), offset * 3)
    target.vividColors.set(puffs.vividColors.subarray(0, count * 3), offset * 3)
    offset += count
  })
  return offset
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
  setViewportHeight(pixels: number): void
  /** Scales every puff's opacity, e.g. to fade the whole layer in. */
  setOpacity(opacity: number): void
  /** Draws the puffs of a half-resolution layer for the coming frame; a no-op otherwise. */
  renderOffscreen(renderer: WebGLRenderer, camera: Camera): void
  instanceCount(): number
  dispose(): void
}

export function createNebulaLayer(nebulae: readonly Star[], observer: Vector3, mode: StarColorMode): NebulaLayer {
  return createPuffLayer(nebulae.map((nebula) => generateNebulaPuffs(nebula, observer)), mode, { halfResolution: true })
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

export function createPuffLayer(
  sources: readonly PuffInstances[],
  mode: StarColorMode,
  { absorb = false, maxScreenFraction = NEBULA_MAX_SCREEN_FRACTION, halfResolution = false }: PuffLayerOptions = {},
): NebulaLayer {
  const capacity = sources.reduce((sum, puffs) => sum + puffs.count, 0)
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
  const noise = noiseTexture(0x5eed)
  const uniforms = {
    noiseMap: { value: noise },
    colorMix: { value: mode === 'exaggerated' ? 1 : 0 },
    gain: { value: mode === 'exaggerated' ? 2.6 : 2.3 },
    alphaScale: { value: 1 },
    viewportHeight: { value: 1 },
    maxScreenFraction: { value: maxScreenFraction },
    minPixels: { value: MIN_PUFF_PIXELS },
  }
  const material = new ShaderMaterial({
    uniforms,
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
        #ifdef HALF_RESOLUTION_TARGET
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
  })
  const puffs = new Mesh(geometry, material)
  puffs.frustumCulled = false
  const target = halfResolution ? new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false }) : null
  const offscreen = target ? new Scene().add(puffs) : null
  const mesh = target ? createHalfResolutionComposite(target.texture) : puffs
  // After opaque-like star cores (2), before additive stellar halos (3).
  mesh.renderOrder = 2.5
  mesh.visible = false
  const drawingSize = new Vector2()
  const clearColor = new Color()
  let visibility: boolean[] = sources.map(() => false)
  let fraction = 1
  let opacity = 1
  let packedKey = ''

  function repack(): void {
    const key = `${fraction}:${visibility.map(Number).join('')}`
    if (key === packedKey) return
    packedKey = key
    const count = packNebulaInstances(sources, visibility, fraction, buffers)
    geometry.instanceCount = count
    mesh.visible = count > 0
    uniforms.alphaScale.value = opacity / fraction
    if (count === 0) return
    for (const [, attribute] of attributes) {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, count * attribute.itemSize)
      attribute.needsUpdate = true
    }
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
    setColorMode(next) {
      uniforms.colorMix.value = next === 'exaggerated' ? 1 : 0
      uniforms.gain.value = next === 'exaggerated' ? 2.6 : 2.3
    },
    setViewportHeight(pixels) {
      if (pixels > 0) uniforms.viewportHeight.value = pixels
    },
    setOpacity(next) {
      opacity = next
      uniforms.alphaScale.value = opacity / fraction
    },
    renderOffscreen(renderer, camera) {
      if (!target || !offscreen || !mesh.visible) return
      const previousTarget = renderer.getRenderTarget()
      if (previousTarget) drawingSize.set(previousTarget.width, previousTarget.height)
      else renderer.getDrawingBufferSize(drawingSize)
      target.setSize(Math.max(1, Math.ceil(drawingSize.x / 2)), Math.max(1, Math.ceil(drawingSize.y / 2)))
      // Puff sizes, screen caps and the minimum kernel follow the pixels actually drawn.
      uniforms.viewportHeight.value = target.height
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
    instanceCount: () => geometry.instanceCount,
    dispose() {
      geometry.dispose()
      material.dispose()
      noise.dispose()
      if (target) {
        target.dispose()
        mesh.geometry.dispose()
        ;(mesh.material as ShaderMaterial).dispose()
      }
    },
  }
}
