import { BufferGeometry, Float32BufferAttribute, OrthographicCamera, Points, Scene, WebGLRenderer } from 'three'
import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { createStarAppearance, displayMagnitude, type StarBrightness, type StarStyle } from './star-appearance'
import { STAR_DIAMETER_PX, starApparentDiameter, starCoreWhiteStrength, starHaloDiameter, starHaloEmphasis, starHaloOpacity } from './viewer-primitives'

export interface StarLook { style: StarStyle; brightness: StarBrightness }
const ICON_LOOK: StarLook = { style: 'exaggerated', brightness: 'normal' }
// Charts are small diagrams of naked-eye stars, so realistic stars get a longer exposure:
// with the normal brightness boost, 2.5 magnitudes in all.
const CHART_EXPOSURE = 10 ** (0.4 * 1.5)

export interface ConstellationMarker { object: Star; x: number; y: number; magnitude: number | null }

export { starApparentDiameter as constellationStarDiameter } from './viewer-primitives'

function createRenderer() {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setClearColor(0, 1)
  // Keep every star at the same full-strength virtual distance. The selected
  // object's position and distance never attenuate these diagram sprites.
  const distance = { value: 1 }
  const appearance = createStarAppearance(distance)
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
  return { renderer, appearance, scene, camera, geometry, halos }
}
let points: ReturnType<typeof createRenderer> | undefined

export function renderConstellationStars(canvas: HTMLCanvasElement, marks: readonly ConstellationMarker[], width: number, height: number, colorMode: StarColorMode, transparentBackground = false, look = ICON_LOOK): void {
  const state = points ??= createRenderer()
  const ratio = Math.min(3, window.devicePixelRatio || 1)
  state.renderer.setPixelRatio(ratio)
  state.renderer.setSize(width, height, false)
  state.camera.right = width
  state.camera.bottom = -height
  state.camera.updateProjectionMatrix()
  // The renderer is shared with icons, so every call sets its own look.
  const realistic = look.style === 'realistic'
  state.appearance.setStyle(look.style)
  state.appearance.pixelRatio.value = ratio
  state.halos.visible = !realistic
  const positions: number[] = [], colors: number[] = []
  const attributes: Record<string, number[]> = { starFlux: [], coreDiameter: [], coreEmphasis: [], coreWhiteStrength: [], haloDiameter: [], haloOpacity: [] }
  // Realistic stars cover what they are drawn over, so the faintest go first.
  const faintness = (mark: ConstellationMarker) => mark.magnitude ?? Infinity
  const ordered = realistic ? [...marks].sort((first, second) => faintness(second) - faintness(first) || 0) : marks
  for (const { object, x, y, magnitude: sourceMagnitude } of ordered) {
    const magnitude = displayMagnitude(sourceMagnitude, object, look.brightness)
    const color = starDisplayColor(object, colorMode)
    positions.push(x, -y, 0)
    colors.push(color.r, color.g, color.b)
    const emphasis = starHaloEmphasis(magnitude)
    const diameter = starApparentDiameter(magnitude)
    attributes.starFlux!.push(magnitude === null ? 0 : CHART_EXPOSURE * 10 ** (-0.4 * magnitude))
    attributes.coreDiameter!.push(diameter)
    attributes.coreEmphasis!.push(emphasis)
    attributes.coreWhiteStrength!.push(starCoreWhiteStrength(object))
    attributes.haloDiameter!.push(starHaloDiameter(magnitude) * Math.sqrt(diameter / STAR_DIAMETER_PX))
    attributes.haloOpacity!.push(starHaloOpacity(magnitude))
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
  if (transparentBackground) {
    // Give small card icons real transparency, so a CSS blending failure cannot
    // expose the opaque render target. Preserve the light's premultiplied color.
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const data = pixels.data
    for (let index = 0; index < data.length; index += 4) {
      const intensity = Math.max(data[index]!, data[index + 1]!, data[index + 2]!)
      data[index + 3] = data[index + 3]! * intensity / 255
      if (intensity === 0) continue
      for (let channel = 0; channel < 3; channel++) data[index + channel] = data[index + channel]! * 255 / intensity
    }
    context.putImageData(pixels, 0, 0)
  }
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
