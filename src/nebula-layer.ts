import {
  AdditiveBlending, Color, DataTexture, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, Mesh, RedFormat, RepeatWrapping, ShaderMaterial, UnsignedByteType, Vector3,
} from 'three'
import type { NebulaDetails, Star } from './catalog-model'
import { galacticToWorld, type StarColorMode } from './astronomy'

// Each puff is one camera-facing quad: all nebulae share a single instanced draw call.
export const NEBULA_MAX_SCREEN_FRACTION = 0.2
const PUFF_OVERLAP = 9
const PUFF_ALPHA = 0.22
const MIN_PUFF_PIXELS = 1.5

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

function gaussian(random: () => number): number {
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
  // Per puff: radius pc, alpha, noise rotation, noise offset.
  shapes: Float32Array
  realColors: Float32Array
  vividColors: Float32Array
}

function paletteColor(palette: readonly string[], t: number, target: Color, scratch: Color): Color {
  const scaled = Math.max(0, Math.min(1, t)) * (palette.length - 1)
  const index = Math.min(palette.length - 2, Math.floor(scaled))
  return target.set(palette[index]!).lerp(scratch.set(palette[index + 1]!), scaled - index)
}

type Sample = { d: number; u: number; v: number; t: number; size: number; alpha: number }

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
      if (random() < 0.18) {
        const d = 0.2 + gaussian(random) * 0.08
        const u = gaussian(random) * 0.14
        const v = gaussian(random) * 0.14
        return { d: d * depth, u: u * major, v: v * minor, t: Math.min(0.3, Math.hypot(u, v)), size: 0.7, alpha: 0.6 }
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
        return { d: d * depth, u: u * major, v: v * minor, t, size: 1, alpha: 1 - 0.55 * t }
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
  const sample = shapeSampler(details, random)
  const center = galacticToWorld(star)
  const basis = nebulaBasis(center, observer, details.shape.position_angle_deg)
  const [, major, minor] = details.shape.semi_axes_pc
  const baseRadius = Math.sqrt(PUFF_OVERLAP * major * minor / count)
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
      baseRadius * size * (0.6 + 0.9 * random()),
      details.brightness * alpha * PUFF_ALPHA * (0.45 + 0.55 * random()),
      random() * Math.PI * 2,
      random(),
    ], index * 4)
    puffs.realColors.set(paletteColor(details.palette.real, t, color, scratch).toArray(), index * 3)
    puffs.vividColors.set(paletteColor(details.palette.exaggerated, t, color, scratch).toArray(), index * 3)
  }
  return puffs
}

// Copies each visible nebula's first LOD fraction of puffs into the front of the target buffers.
export function packNebulaInstances(
  sources: readonly NebulaPuffs[],
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
  instanceCount(): number
  dispose(): void
}

export function createNebulaLayer(nebulae: readonly Star[], observer: Vector3, mode: StarColorMode): NebulaLayer {
  const sources = nebulae.map((nebula) => generateNebulaPuffs(nebula, observer))
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
    gain: { value: mode === 'exaggerated' ? 1 : 0.75 },
    alphaScale: { value: 1 },
    viewportHeight: { value: 1 },
    maxScreenFraction: { value: NEBULA_MAX_SCREEN_FRACTION },
    minPixels: { value: MIN_PUFF_PIXELS },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
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
      varying vec2 vNoiseUv;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 viewCenter = modelViewMatrix * vec4(puffCenter, 1.0);
        float depth = -viewCenter.z;
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
        float c = cos(puffShape.z);
        float s = sin(puffShape.z);
        vNoiseUv = mat2(c, s, -s, c) * position.xy * 0.45 + 0.5 + puffShape.w;
        gl_Position = projectionMatrix * (viewCenter + vec4(position.xy * radius * scale * grow, 0.0, 0.0));
      }
    `,
    fragmentShader: `
      uniform sampler2D noiseMap;
      uniform float gain;
      varying vec2 vUv;
      varying vec2 vNoiseUv;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float r2 = dot(vUv, vUv);
        if (r2 >= 1.0) discard;
        float falloff = (exp(-3.5 * r2) - 0.0302) / 0.9698;
        float noise = texture2D(noiseMap, vNoiseUv).r;
        gl_FragColor = vec4(vColor * gain, vAlpha * falloff * (0.15 + 1.2 * noise));
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  // After opaque-like star cores (2), before additive halos (3).
  mesh.renderOrder = 2.5
  mesh.visible = false
  let visibility: boolean[] = nebulae.map(() => false)
  let fraction = 1
  let packedKey = ''

  function repack(): void {
    const key = `${fraction}:${visibility.map(Number).join('')}`
    if (key === packedKey) return
    packedKey = key
    const count = packNebulaInstances(sources, visibility, fraction, buffers)
    geometry.instanceCount = count
    mesh.visible = count > 0
    uniforms.alphaScale.value = 1 / fraction
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
      visibility = nebulae.map((_, index) => next[index] === true)
      repack()
    },
    setLevelOfDetail(next) {
      if (!(next > 0 && next <= 1)) return
      fraction = next
      repack()
    },
    setColorMode(next) {
      uniforms.colorMix.value = next === 'exaggerated' ? 1 : 0
      uniforms.gain.value = next === 'exaggerated' ? 1 : 0.75
    },
    setViewportHeight(pixels) {
      if (pixels > 0) uniforms.viewportHeight.value = pixels
    },
    instanceCount: () => geometry.instanceCount,
    dispose() {
      geometry.dispose()
      material.dispose()
      noise.dispose()
    },
  }
}
