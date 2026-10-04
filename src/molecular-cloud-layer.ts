import {
  AdditiveBlending, CanvasTexture, Color, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, Mesh, NormalBlending, ShaderMaterial,
} from 'three'
import type { Star } from './catalog-model'
import type { StarColorMode } from './astronomy'

export const MOLECULAR_CLOUD_MAX_SCREEN_FRACTION = 0.16
const MIN_PUFF_PIXELS = 1.6

export interface MolecularCloudPuffs {
  count: number
  centers: Float32Array
  shapes: Float32Array
  realBodyColors: Float32Array
  realRimColors: Float32Array
  vividBodyColors: Float32Array
  vividRimColors: Float32Array
  cloudIndices: Float32Array
}

function hash32(value: number): number {
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad)
  value = Math.imul(value ^ value >>> 15, 0x735a2d97)
  return (value ^ value >>> 15) >>> 0
}

function hashUnit(seed: number, index: number): number {
  return hash32(seed ^ Math.imul(index + 1, 0x9e3779b1)) / 0x100000000
}

function colorVariation(target: Color, amount: number): Color {
  return target.offsetHSL(amount * 0.025, amount * 0.035, amount * 0.035)
}

export function generateMolecularCloudPuffs(star: Star, cloudIndex: number): MolecularCloudPuffs {
  const cloud = star.molecular_cloud
  if (!cloud) throw new Error(`Not a molecular cloud: ${star.id}`)
  const points = cloud.sample_points_pc
  const count = points.length / 3
  const centers = new Float32Array(count * 3)
  const shapes = new Float32Array(count * 4)
  const realBodyColors = new Float32Array(count * 3)
  const realRimColors = new Float32Array(count * 3)
  const vividBodyColors = new Float32Array(count * 3)
  const vividRimColors = new Float32Array(count * 3)
  const cloudIndices = new Float32Array(count)
  const palettes = {
    realBody: new Color(cloud.palette.real.body),
    realRim: new Color(cloud.palette.real.rim),
    vividBody: new Color(cloud.palette.exaggerated.body),
    vividRim: new Color(cloud.palette.exaggerated.rim),
  }
  const densityContrast = Math.min(1, Math.log10(cloud.peak_density_cm3 / cloud.mean_density_cm3 + 1) / 1.5)
  for (let index = 0; index < count; index++) {
    const pointOffset = index * 3
    // Galactic (x, y, z) maps to Three.js world (x, z, -y).
    centers[pointOffset] = points[pointOffset]!
    centers[pointOffset + 1] = points[pointOffset + 2]!
    centers[pointOffset + 2] = -points[pointOffset + 1]!
    const random = hashUnit(cloud.catalog_id + 0x51f15e, index)
    const shapeOffset = index * 4
    shapes[shapeOffset] = 1.65 + 1.25 * random + 0.45 * densityContrast
    shapes[shapeOffset + 1] = cloud.opacity * (0.52 + 0.48 * hashUnit(cloud.catalog_id + 0xb5297a4d, index))
    shapes[shapeOffset + 2] = Math.PI * 2 * hashUnit(cloud.catalog_id + 0x68e31da4, index)
    shapes[shapeOffset + 3] = hashUnit(cloud.catalog_id + 0x1b56c4e9, index)
    const variation = hashUnit(cloud.catalog_id + 0x7f4a7c15, index) - 0.5
    colorVariation(palettes.realBody.clone(), variation).toArray(realBodyColors, pointOffset)
    colorVariation(palettes.realRim.clone(), variation).toArray(realRimColors, pointOffset)
    colorVariation(palettes.vividBody.clone(), variation).toArray(vividBodyColors, pointOffset)
    colorVariation(palettes.vividRim.clone(), variation).toArray(vividRimColors, pointOffset)
    cloudIndices[index] = cloudIndex
  }
  return { count, centers, shapes, realBodyColors, realRimColors, vividBodyColors, vividRimColors, cloudIndices }
}

interface CloudBuffers {
  centers: Float32Array
  shapes: Float32Array
  realBodyColors: Float32Array
  realRimColors: Float32Array
  vividBodyColors: Float32Array
  vividRimColors: Float32Array
  cloudIndices: Float32Array
}

export function packMolecularCloudInstances(
  sources: readonly MolecularCloudPuffs[],
  visible: readonly boolean[],
  fraction: number,
  target: CloudBuffers,
): number {
  let targetIndex = 0
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    if (!visible[sourceIndex]) continue
    const source = sources[sourceIndex]!
    const count = Math.max(1, Math.ceil(source.count * fraction))
    for (const [sourceValues, targetValues, itemSize] of [
      [source.centers, target.centers, 3],
      [source.shapes, target.shapes, 4],
      [source.realBodyColors, target.realBodyColors, 3],
      [source.realRimColors, target.realRimColors, 3],
      [source.vividBodyColors, target.vividBodyColors, 3],
      [source.vividRimColors, target.vividRimColors, 3],
    ] as const) targetValues.set(sourceValues.subarray(0, count * itemSize), targetIndex * itemSize)
    target.cloudIndices.set(source.cloudIndices.subarray(0, count), targetIndex)
    targetIndex += count
  }
  return targetIndex
}

function noiseTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 96
  const context = canvas.getContext('2d')!
  const image = context.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const first = hashUnit(0x6d2b79f5 + y, x)
      const second = hashUnit(0x1b873593 + Math.floor(y / 3), Math.floor(x / 3))
      const value = Math.round(255 * (0.58 * first + 0.42 * second))
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = value
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

export interface MolecularCloudLayer {
  root: Group
  setVisible(visible: readonly boolean[]): void
  setLevelOfDetail(fraction: number): void
  setColorMode(mode: StarColorMode): void
  setViewportHeight(pixels: number): void
  setSelected(id: string | null): void
  instanceCount(): number
  dispose(): void
}

export function createMolecularCloudLayer(clouds: readonly Star[], mode: StarColorMode): MolecularCloudLayer {
  const sources = clouds.map((cloud, index) => generateMolecularCloudPuffs(cloud, index))
  const capacity = sources.reduce((sum, source) => sum + source.count, 0)
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const buffers: CloudBuffers = {
    centers: new Float32Array(capacity * 3),
    shapes: new Float32Array(capacity * 4),
    realBodyColors: new Float32Array(capacity * 3),
    realRimColors: new Float32Array(capacity * 3),
    vividBodyColors: new Float32Array(capacity * 3),
    vividRimColors: new Float32Array(capacity * 3),
    cloudIndices: new Float32Array(capacity),
  }
  const attributes = [
    ['puffCenter', new InstancedBufferAttribute(buffers.centers, 3)],
    ['puffShape', new InstancedBufferAttribute(buffers.shapes, 4)],
    ['puffRealBody', new InstancedBufferAttribute(buffers.realBodyColors, 3)],
    ['puffRealRim', new InstancedBufferAttribute(buffers.realRimColors, 3)],
    ['puffVividBody', new InstancedBufferAttribute(buffers.vividBodyColors, 3)],
    ['puffVividRim', new InstancedBufferAttribute(buffers.vividRimColors, 3)],
    ['puffCloudIndex', new InstancedBufferAttribute(buffers.cloudIndices, 1)],
  ] as const
  for (const [name, attribute] of attributes) geometry.setAttribute(name, attribute)
  geometry.instanceCount = 0
  const noise = noiseTexture()
  const uniforms = {
    noiseMap: { value: noise },
    colorMix: { value: mode === 'exaggerated' ? 1 : 0 },
    bodyGain: { value: mode === 'exaggerated' ? 1.12 : 0.82 },
    rimGain: { value: mode === 'exaggerated' ? 0.34 : 0.18 },
    alphaScale: { value: 1 },
    viewportHeight: { value: 1 },
    maxScreenFraction: { value: MOLECULAR_CLOUD_MAX_SCREEN_FRACTION },
    minPixels: { value: MIN_PUFF_PIXELS },
    selectedCloudIndex: { value: -1 },
  }
  const vertexShader = `
    attribute vec3 puffCenter;
    attribute vec4 puffShape;
    attribute vec3 puffRealBody;
    attribute vec3 puffRealRim;
    attribute vec3 puffVividBody;
    attribute vec3 puffVividRim;
    attribute float puffCloudIndex;
    uniform float colorMix;
    uniform float alphaScale;
    uniform float viewportHeight;
    uniform float maxScreenFraction;
    uniform float minPixels;
    uniform float selectedCloudIndex;
    varying vec2 vUv;
    varying vec2 vNoiseUv;
    varying vec3 vBodyColor;
    varying vec3 vRimColor;
    varying float vAlpha;
    varying float vSelected;
    void main() {
      vec4 viewCenter = modelViewMatrix * vec4(puffCenter, 1.0);
      float depth = -viewCenter.z;
      float radius = puffShape.x;
      float nearFade = smoothstep(radius * 0.7, radius * 3.2, depth);
      float pixelRadius = radius * projectionMatrix[1][1] * 0.5 * viewportHeight / max(depth, 1e-6);
      float screenScale = min(1.0, viewportHeight * maxScreenFraction / max(pixelRadius, 1e-6));
      float grow = max(1.0, minPixels / max(pixelRadius, 1e-6));
      vAlpha = puffShape.y * alphaScale * nearFade / (grow * grow);
      if (vAlpha < 0.0005) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
      }
      vSelected = 1.0 - step(0.25, abs(puffCloudIndex - selectedCloudIndex));
      vBodyColor = mix(puffRealBody, puffVividBody, colorMix);
      vRimColor = mix(puffRealRim, puffVividRim, colorMix);
      vUv = position.xy;
      float c = cos(puffShape.z);
      float s = sin(puffShape.z);
      vNoiseUv = mat2(c, s, -s, c) * position.xy * 0.38 + 0.5 + puffShape.w;
      gl_Position = projectionMatrix * (viewCenter + vec4(position.xy * radius * screenScale * grow, 0.0, 0.0));
    }
  `
  const bodyMaterial = new ShaderMaterial({
    uniforms,
    transparent: true,
    blending: NormalBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader,
    fragmentShader: `
      uniform sampler2D noiseMap;
      uniform float bodyGain;
      varying vec2 vUv;
      varying vec2 vNoiseUv;
      varying vec3 vBodyColor;
      varying float vAlpha;
      varying float vSelected;
      void main() {
        float r2 = dot(vUv, vUv);
        if (r2 >= 1.0) discard;
        float falloff = pow(1.0 - r2, 1.65);
        float noise = texture2D(noiseMap, vNoiseUv).r;
        float filaments = smoothstep(0.18, 0.92, noise + 0.16 * sin((vUv.x - vUv.y) * 8.0));
        float alpha = vAlpha * falloff * (0.18 + 0.92 * filaments) * mix(1.0, 1.85, vSelected);
        vec3 color = vBodyColor * bodyGain * mix(0.72, 1.2, noise) + vSelected * vec3(0.07, 0.045, 0.025);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  })
  const rimMaterial = new ShaderMaterial({
    uniforms,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader,
    fragmentShader: `
      uniform sampler2D noiseMap;
      uniform float rimGain;
      varying vec2 vUv;
      varying vec2 vNoiseUv;
      varying vec3 vRimColor;
      varying float vAlpha;
      varying float vSelected;
      void main() {
        float r2 = dot(vUv, vUv);
        if (r2 >= 1.0) discard;
        float noise = texture2D(noiseMap, vNoiseUv * 1.7 + 0.13).r;
        float veil = pow(1.0 - r2, 2.4) * smoothstep(0.48, 0.92, noise + 0.1 * sin(vUv.x * 11.0));
        float edge = smoothstep(0.18, 0.68, r2) * (1.0 - smoothstep(0.68, 1.0, r2));
        float alpha = vAlpha * rimGain * (0.5 * veil + edge * noise) * mix(1.0, 2.6, vSelected);
        gl_FragColor = vec4(vRimColor, alpha);
        #include <colorspace_fragment>
      }
    `,
  })
  const body = new Mesh(geometry, bodyMaterial)
  body.frustumCulled = false
  body.renderOrder = 2.2
  const rim = new Mesh(geometry, rimMaterial)
  rim.frustumCulled = false
  rim.renderOrder = 2.35
  const root = new Group()
  root.add(body, rim)
  root.visible = false
  const cloudIndexById = new Map(clouds.map((cloud, index) => [cloud.id, index]))
  let visibility: boolean[] = clouds.map(() => false)
  let fraction = 1
  let packedKey = ''

  function repack(): void {
    const key = `${fraction}:${visibility.map(Number).join('')}`
    if (key === packedKey) return
    packedKey = key
    const count = packMolecularCloudInstances(sources, visibility, fraction, buffers)
    geometry.instanceCount = count
    root.visible = count > 0
    uniforms.alphaScale.value = Math.min(2.2, 1 / Math.sqrt(fraction))
    if (count === 0) return
    for (const [, attribute] of attributes) {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, count * attribute.itemSize)
      attribute.needsUpdate = true
    }
  }

  return {
    root,
    setVisible(next) {
      visibility = clouds.map((_, index) => next[index] === true)
      repack()
    },
    setLevelOfDetail(next) {
      if (!(next > 0 && next <= 1)) return
      fraction = next
      repack()
    },
    setColorMode(next) {
      uniforms.colorMix.value = next === 'exaggerated' ? 1 : 0
      uniforms.bodyGain.value = next === 'exaggerated' ? 1.12 : 0.82
      uniforms.rimGain.value = next === 'exaggerated' ? 0.34 : 0.18
    },
    setViewportHeight(pixels) {
      if (pixels > 0) uniforms.viewportHeight.value = pixels
    },
    setSelected(id) {
      uniforms.selectedCloudIndex.value = id === null ? -1 : cloudIndexById.get(id) ?? -1
    },
    instanceCount: () => geometry.instanceCount,
    dispose() {
      geometry.dispose()
      bodyMaterial.dispose()
      rimMaterial.dispose()
      noise.dispose()
    },
  }
}
