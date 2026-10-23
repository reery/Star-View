import {
  AdditiveBlending, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Mesh, ShaderMaterial,
  IcosahedronGeometry, SphereGeometry, Uint32BufferAttribute, Vector3,
} from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { BubbleDetails, Star } from './catalog-model'
import type { StarColorMode } from './astronomy'

const LONGITUDE_SEGMENTS = 48
const LATITUDE_SEGMENTS = 24
// The published grid is far denser and noisier than the shell needs to read well.
// An evenly tessellated icosphere avoids pole slivers, and neighbor smoothing turns
// single-cell radius jumps into continuous lobes. Smoothing a high power of the
// radius favors the outer wall, so narrow extensions such as the chimney survive.
const GRID_SURFACE_DETAIL = 15
const GRID_SMOOTHING_PASSES = 4
const GRID_SMOOTHING_POWER = 8

function smoothGridRadii(radii: Float32Array, indices: ArrayLike<number>): void {
  const neighbors = Array.from({ length: radii.length }, () => new Set<number>())
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]!, b = indices[index + 1]!, c = indices[index + 2]!
    neighbors[a]!.add(b).add(c)
    neighbors[b]!.add(a).add(c)
    neighbors[c]!.add(a).add(b)
  }
  for (let vertex = 0; vertex < radii.length; vertex++) radii[vertex] = radii[vertex]! ** GRID_SMOOTHING_POWER
  const next = new Float32Array(radii.length)
  for (let pass = 0; pass < GRID_SMOOTHING_PASSES; pass++) {
    for (let vertex = 0; vertex < radii.length; vertex++) {
      let total = radii[vertex]!
      for (const neighbor of neighbors[vertex]!) total += radii[neighbor]!
      next[vertex] = total / (neighbors[vertex]!.size + 1)
    }
    radii.set(next)
  }
  for (let vertex = 0; vertex < radii.length; vertex++) radii[vertex] = radii[vertex]! ** (1 / GRID_SMOOTHING_POWER)
}

function galacticDirection(longitudeDeg: number, latitudeDeg: number): Vector3 {
  const longitude = longitudeDeg * Math.PI / 180
  const latitude = latitudeDeg * Math.PI / 180
  const cosLatitude = Math.cos(latitude)
  return new Vector3(cosLatitude * Math.cos(longitude), cosLatitude * Math.sin(longitude), Math.sin(latitude))
}

function smoothRoughness(direction: Vector3, seed: number): number {
  const phase = seed * 0.017453292519943295
  return (
    Math.sin(3.1 * direction.x + 4.7 * direction.y - 2.3 * direction.z + phase)
    + 0.5 * Math.sin(-5.3 * direction.x + 3.7 * direction.y + 6.1 * direction.z + phase * 1.7)
    + 0.25 * Math.sin(8.9 * direction.x - 7.1 * direction.y + 4.3 * direction.z - phase * 0.8)
  ) / 1.75
}

function directionalGridRadius(details: BubbleDetails, direction: Vector3): number {
  if (details.shape.kind !== 'directional_grid') throw new Error('Expected a directional-grid bubble shape.')
  const { longitude_segments: longitudeSegments, latitude_segments: latitudeSegments, radii_pc: radii } = details.shape.surface_grid
  const longitude = (Math.atan2(direction.y, direction.x) + Math.PI * 2) % (Math.PI * 2)
  const latitude = Math.asin(Math.max(-1, Math.min(1, direction.z)))
  const longitudePosition = longitude / (Math.PI * 2) * longitudeSegments
  const latitudePosition = (latitude + Math.PI / 2) / Math.PI * latitudeSegments
  const longitude0 = Math.floor(longitudePosition) % longitudeSegments
  const longitude1 = (longitude0 + 1) % longitudeSegments
  const latitude0 = Math.min(latitudeSegments, Math.floor(latitudePosition))
  const latitude1 = Math.min(latitudeSegments, latitude0 + 1)
  const longitudeMix = longitudePosition - Math.floor(longitudePosition)
  const latitudeMix = latitudePosition - Math.floor(latitudePosition)
  const row0 = latitude0 * longitudeSegments
  const row1 = latitude1 * longitudeSegments
  const lower = radii[row0 + longitude0]! * (1 - longitudeMix) + radii[row0 + longitude1]! * longitudeMix
  const upper = radii[row1 + longitude0]! * (1 - longitudeMix) + radii[row1 + longitude1]! * longitudeMix
  return lower * (1 - latitudeMix) + upper * latitudeMix
}

export function bubbleRadiusPc(details: BubbleDetails, galacticUnitDirection: Vector3): number {
  const direction = galacticUnitDirection.clone().normalize()
  if (details.shape.kind === 'directional_grid') return directionalGridRadius(details, direction)
  const shape = details.shape
  const [scaleX, scaleY, scaleZ] = shape.axis_scale
  let radius = shape.base_radius_pc / Math.sqrt(
    (direction.x / scaleX) ** 2 + (direction.y / scaleY) ** 2 + (direction.z / scaleZ) ** 2,
  )
  for (const feature of shape.features) {
    const center = galacticDirection(feature.longitude_deg, feature.latitude_deg)
    const angle = Math.acos(Math.max(-1, Math.min(1, direction.dot(center))))
    const width = feature.width_deg * Math.PI / 180
    radius += feature.amplitude_pc * Math.exp(-0.5 * (angle / width) ** 2)
  }
  radius += shape.roughness_pc * smoothRoughness(direction, shape.seed)
  const [minimum, reportedMaximum] = details.surface_distance_range_pc
  const maximum = reportedMaximum * (details.surface_distance_max_open ? 1.08 : 1)
  return Math.max(minimum, Math.min(maximum, radius))
}

export interface BubbleSurface {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
  bounds: { min: Vector3; max: Vector3 }
}

export function generateBubbleSurface(bubble: Star): BubbleSurface {
  if (!bubble.bubble) throw new Error(`Not a bubble: ${bubble.id}`)
  const shape = bubble.bubble.shape
  const grid = shape.kind === 'directional_grid'
  let source: BufferGeometry
  if (!grid) source = new SphereGeometry(1, LONGITUDE_SEGMENTS, LATITUDE_SEGMENTS)
  else {
    const icosphere = new IcosahedronGeometry(1, GRID_SURFACE_DETAIL)
    icosphere.deleteAttribute('normal')
    icosphere.deleteAttribute('uv')
    source = mergeVertices(icosphere)
    icosphere.dispose()
  }
  const positions = source.getAttribute('position')
  const radii = new Float32Array(positions.count)
  const origin = new Vector3(
    shape.origin_pc[0],
    shape.origin_pc[2],
    -shape.origin_pc[1],
  )
  const worldDirection = new Vector3()
  const galacticDirectionScratch = new Vector3()
  const bounds = {
    min: new Vector3(Infinity, Infinity, Infinity),
    max: new Vector3(-Infinity, -Infinity, -Infinity),
  }
  for (let index = 0; index < positions.count; index++) {
    worldDirection.fromBufferAttribute(positions, index).normalize()
    galacticDirectionScratch.set(worldDirection.x, -worldDirection.z, worldDirection.y)
    radii[index] = bubbleRadiusPc(bubble.bubble, galacticDirectionScratch)
  }
  if (grid) smoothGridRadii(radii, source.getIndex()!.array)
  for (let index = 0; index < positions.count; index++) {
    worldDirection.fromBufferAttribute(positions, index).normalize().multiplyScalar(radii[index]!).add(origin)
    positions.setXYZ(index, worldDirection.x, worldDirection.y, worldDirection.z)
    bounds.min.min(worldDirection)
    bounds.max.max(worldDirection)
  }
  positions.needsUpdate = true
  source.computeVertexNormals()
  const normals = source.getAttribute('normal')
  const sourceIndices = source.getIndex()!
  const surface = {
    positions: Float32Array.from(positions.array),
    normals: Float32Array.from(normals.array),
    indices: Uint32Array.from(sourceIndices.array),
    bounds,
  }
  source.dispose()
  return surface
}

export interface BubbleLayer {
  mesh: Mesh
  setVisible(visible: readonly boolean[]): void
  setSelected(id: string | null): void
  setColorMode(mode: StarColorMode): void
  triangleCount(): number
  dispose(): void
}

export function createBubbleLayer(bubbles: readonly Star[], mode: StarColorMode): BubbleLayer {
  const surfaces = bubbles.map(generateBubbleSurface)
  const vertexCount = surfaces.reduce((sum, surface) => sum + surface.positions.length / 3, 0)
  const indexCount = surfaces.reduce((sum, surface) => sum + surface.indices.length, 0)
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const realColors = new Float32Array(vertexCount * 3)
  const vividColors = new Float32Array(vertexCount * 3)
  const opacities = new Float32Array(vertexCount)
  const indices = new Uint32Array(indexCount)
  const ranges: Array<{ id: string; start: number; count: number }> = []
  let vertexOffset = 0
  let indexOffset = 0
  surfaces.forEach((surface, bubbleIndex) => {
    const bubble = bubbles[bubbleIndex]!
    const details = bubble.bubble!
    const count = surface.positions.length / 3
    positions.set(surface.positions, vertexOffset * 3)
    normals.set(surface.normals, vertexOffset * 3)
    const real = new Color(details.palette.real)
    const vivid = new Color(details.palette.exaggerated)
    for (let vertex = 0; vertex < count; vertex++) {
      realColors.set(real.toArray(), (vertexOffset + vertex) * 3)
      vividColors.set(vivid.toArray(), (vertexOffset + vertex) * 3)
      opacities[vertexOffset + vertex] = details.opacity
    }
    for (let index = 0; index < surface.indices.length; index++) indices[indexOffset + index] = surface.indices[index]! + vertexOffset
    ranges.push({ id: bubble.id, start: vertexOffset, count })
    vertexOffset += count
    indexOffset += surface.indices.length
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('bubbleRealColor', new Float32BufferAttribute(realColors, 3))
  geometry.setAttribute('bubbleVividColor', new Float32BufferAttribute(vividColors, 3))
  geometry.setAttribute('bubbleOpacity', new Float32BufferAttribute(opacities, 1))
  const visibleAttribute = new Float32BufferAttribute(vertexCount, 1).setUsage(DynamicDrawUsage)
  const selectedAttribute = new Float32BufferAttribute(vertexCount, 1).setUsage(DynamicDrawUsage)
  geometry.setAttribute('bubbleVisible', visibleAttribute)
  geometry.setAttribute('bubbleSelected', selectedAttribute)
  geometry.setIndex(new Uint32BufferAttribute(indices, 1))
  geometry.computeBoundingSphere()

  const uniforms = { colorMix: { value: mode === 'exaggerated' ? 1 : 0 } }
  const material = new ShaderMaterial({
    uniforms,
    side: DoubleSide,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      attribute vec3 bubbleRealColor;
      attribute vec3 bubbleVividColor;
      attribute float bubbleOpacity;
      attribute float bubbleVisible;
      attribute float bubbleSelected;
      uniform float colorMix;
      varying vec3 vColor;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying float vOpacity;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = mix(bubbleRealColor, bubbleVividColor, colorMix);
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vOpacity = bubbleOpacity * bubbleVisible * mix(1.0, 1.7, bubbleSelected);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying float vOpacity;
      void main() {
        if (vOpacity < 0.0001) discard;
        float facing = abs(dot(normalize(vViewNormal), normalize(-vViewPosition)));
        float grazing = pow(1.0 - facing, 1.7);
        float broadStructure = 0.78 + 0.22 * sin(
          vWorldPosition.x * 0.031 + sin(vWorldPosition.y * 0.023) + vWorldPosition.z * 0.019
        );
        float alpha = vOpacity * (0.82 + 2.15 * grazing) * broadStructure;
        gl_FragColor = vec4(vColor, alpha);
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = 'bubble-shells'
  mesh.frustumCulled = false
  // Behind star cores and nebula light, but above the Milky Way panorama.
  mesh.renderOrder = 1.5
  mesh.visible = false

  function updateAttribute(attribute: Float32BufferAttribute): void {
    attribute.clearUpdateRanges()
    attribute.addUpdateRange(0, attribute.count)
    attribute.needsUpdate = true
  }

  return {
    mesh,
    setVisible(next) {
      const visibility = visibleAttribute.array as Float32Array
      ranges.forEach((range, index) => visibility.fill(next[index] === true ? 1 : 0, range.start, range.start + range.count))
      mesh.visible = next.some(Boolean)
      updateAttribute(visibleAttribute)
    },
    setSelected(id) {
      const selection = selectedAttribute.array as Float32Array
      for (const range of ranges) selection.fill(range.id === id ? 1 : 0, range.start, range.start + range.count)
      updateAttribute(selectedAttribute)
    },
    setColorMode(next) {
      uniforms.colorMix.value = next === 'exaggerated' ? 1 : 0
    },
    triangleCount: () => indexCount / 3,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
