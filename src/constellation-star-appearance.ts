import { BufferGeometry, Float32BufferAttribute, OrthographicCamera, Points, Scene, WebGLRenderer } from 'three'
import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { createStarAppearance } from './star-appearance'
import { STAR_DIAMETER_PX, starCoreWhiteStrength, starHaloDiameter, starHaloEmphasis, starHaloOpacity } from './viewer-primitives'

export interface ConstellationMarker { object: Star; x: number; y: number; magnitude: number | null }

/** A bounded, illustrative size scale for Earth-view apparent magnitude. */
export function constellationStarDiameter(magnitude: number | null): number {
  if (magnitude === null || !Number.isFinite(magnitude)) return STAR_DIAMETER_PX
  return Math.max(3, Math.min(14, STAR_DIAMETER_PX * 10 ** (-0.1 * magnitude)))
}

function createRenderer() {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setClearColor(0, 1)
  // Keep every star at the same full-strength virtual distance. The selected
  // object's position and distance never attenuate these diagram sprites.
  const distance = { value: 1 }
  const appearance = createStarAppearance(distance, distance)
  const scene = new Scene()
  const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 100)
  camera.position.z = 10
  const geometry = new BufferGeometry()
  const cores = new Points(geometry, appearance.starMaterial)
  const halos = new Points(geometry, appearance.haloMaterial)
  cores.frustumCulled = halos.frustumCulled = false
  cores.renderOrder = 1
  halos.renderOrder = 2
  scene.add(cores, halos)
  return { renderer, appearance, scene, camera, geometry }
}
let points: ReturnType<typeof createRenderer> | undefined

export function renderConstellationStars(canvas: HTMLCanvasElement, marks: readonly ConstellationMarker[], width: number, height: number, colorMode: StarColorMode): void {
  const state = points ??= createRenderer()
  const ratio = Math.min(3, window.devicePixelRatio || 1)
  state.renderer.setPixelRatio(ratio)
  state.renderer.setSize(width, height, false)
  state.camera.right = width
  state.camera.bottom = -height
  state.camera.updateProjectionMatrix()
  const positions: number[] = [], colors: number[] = []
  const attributes: Record<string, number[]> = { coreDiameter: [], coreFocus: [], coreEmphasis: [], coreWhiteStrength: [], haloDiameter: [], haloOpacity: [], haloEmphasis: [] }
  for (const { object, x, y, magnitude } of marks) {
    const color = starDisplayColor(object, colorMode)
    positions.push(x, -y, 0)
    colors.push(color.r, color.g, color.b)
    const emphasis = starHaloEmphasis(magnitude)
    const diameter = constellationStarDiameter(magnitude)
    attributes.coreDiameter!.push(diameter)
    attributes.coreFocus!.push(1)
    attributes.coreEmphasis!.push(emphasis)
    attributes.coreWhiteStrength!.push(starCoreWhiteStrength(object))
    attributes.haloDiameter!.push(starHaloDiameter(magnitude) * Math.sqrt(diameter / STAR_DIAMETER_PX))
    attributes.haloOpacity!.push(starHaloOpacity(magnitude))
    attributes.haloEmphasis!.push(emphasis)
  }
  if (state.geometry.getAttribute('position')?.count !== marks.length) state.geometry.dispose()
  const update = (name: string, values: number[], size: number) => {
    const attribute = state.geometry.getAttribute(name)
    if (attribute?.count === marks.length) {
      attribute.array.set(values)
      attribute.needsUpdate = true
    } else state.geometry.setAttribute(name, new Float32BufferAttribute(values, size))
  }
  update('position', positions, 3)
  update('color', colors, 3)
  for (const [name, values] of Object.entries(attributes)) update(name, values, 1)
  state.geometry.setDrawRange(0, marks.length)
  state.renderer.render(state.scene, state.camera)
  // Screen compositing matches the Distance card's shared-material preview,
  // avoiding premultiplied-alpha artifacts in additive halos.
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  const context = canvas.getContext('2d')!
  context.globalCompositeOperation = 'screen'
  context.drawImage(state.renderer.domElement, 0, 0)
}

export function disposeConstellationStars(): void {
  if (!points) return
  points.geometry.dispose()
  points.appearance.dotTexture.dispose()
  points.appearance.haloTexture.dispose()
  points.appearance.starMaterial.dispose()
  points.appearance.haloMaterial.dispose()
  points.renderer.dispose()
  points.renderer.forceContextLoss()
  points = undefined
}
