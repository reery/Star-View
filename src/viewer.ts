import {
  AdditiveBlending, Box3, BufferGeometry, Camera, CanvasTexture, Color, Float32BufferAttribute,
  GridHelper, Group, LessDepth, Line, LineBasicMaterial, LineDashedMaterial, LineSegments, Matrix4, NoBlending, Object3D,
  PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial, Sphere, SRGBColorSpace,
  Vector3, Vector4, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ArrowRight, createElement } from 'lucide'
import { OBJECT_TYPES, type ObjectType, type Star } from './catalog-model'
import { apparentVisualMagnitude, displayMotionForStar, formatDistance, galacticToWorld, sunRelativeMetrics, temperatureToColor, visibilityTier, type DistanceUnit, type MotionMode } from './astronomy'
import { advanceFrameDeadline, effectiveDampingFactor, estimateRefreshRate, renderPixelRatio, targetRenderFps } from './render-scheduling'

export { renderPixelRatio } from './render-scheduling'

export const STAR_DIAMETER_PX = 10

export type OrdinaryLabelPlacement = 'right' | 'left' | 'below' | 'above'

export interface OrdinaryLabelCandidate extends LabelRect {
  placement: OrdinaryLabelPlacement
}

export function ordinaryLabelCandidates(anchor: { x: number; y: number }, width: number, height: number): OrdinaryLabelCandidate[] {
  return [
    { placement: 'right', left: anchor.x + 22, top: anchor.y - height / 2, right: anchor.x + 22 + width, bottom: anchor.y + height / 2 },
    { placement: 'left', left: anchor.x - width - 22, top: anchor.y - height / 2, right: anchor.x - 22, bottom: anchor.y + height / 2 },
    { placement: 'below', left: anchor.x - width / 2, top: anchor.y + 22, right: anchor.x + width / 2, bottom: anchor.y + 22 + height },
    { placement: 'above', left: anchor.x - width / 2, top: anchor.y - height - 22, right: anchor.x + width / 2, bottom: anchor.y - 22 },
  ]
}

export function chooseOrdinaryLabelPlacement(
  candidates: readonly OrdinaryLabelCandidate[],
  previous: OrdinaryLabelPlacement | undefined,
  blocked: (candidate: OrdinaryLabelCandidate, gap: number) => boolean,
): OrdinaryLabelCandidate | null {
  const ordered = previous
    ? [...candidates.filter((candidate) => candidate.placement === previous), ...candidates.filter((candidate) => candidate.placement !== previous)]
    : candidates
  return ordered.find((candidate) => !blocked(candidate, candidate.placement === previous ? 2 : 6)) ?? null
}

export function mapLabelBudget(coarsePointer: boolean): number {
  return coarsePointer ? 60 : 120
}

export function budgetVisibleLabelIndices(
  groups: readonly { indices: readonly number[] }[],
  projections: readonly { visible: boolean; depth: number }[],
  budget: number,
): number[] {
  if (budget <= 0) return []
  const selected: number[] = []
  for (const group of groups) {
    const visible = group.indices.filter((index) => projections[index]?.visible)
      .sort((first, second) => projections[first]!.depth - projections[second]!.depth || first - second)
    for (const index of visible) {
      selected.push(index)
      if (selected.length >= budget) return selected
    }
  }
  return selected
}

export function starBlocksLabels(tier: ReturnType<typeof visibilityTier>): boolean {
  return tier !== 'background'
}

export function isObjectMapVisible(
  star: Pick<Star, 'id' | 'type'>,
  selectedTypes: ReadonlySet<ObjectType>,
  selectedId: string | null,
  observerId: string,
  distanceLy = 0,
  distanceLimitLy = Infinity,
): boolean {
  return star.id === selectedId || star.id === observerId ||
    selectedTypes.has(star.type) && distanceLy <= distanceLimitLy
}

export function focusProgress(elapsedMs: number): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / 300))
  return progress * progress * (3 - 2 * progress)
}

export function starHaloStrength(absoluteMagnitude: number | null, selected = false): number {
  const strength = absoluteMagnitude !== null && Number.isFinite(absoluteMagnitude)
    ? Math.max(0.08, Math.min(1.4, 0.65 * 10 ** Math.max(-2, Math.min(1, -0.1 * (absoluteMagnitude - 4.83)))))
    : 0.65
  return Math.min(1.8, strength * (selected ? 1.3 : 1))
}

export function starHaloDiameter(absoluteMagnitude: number | null): number {
  if (absoluteMagnitude === null || !Number.isFinite(absoluteMagnitude)) return 26
  return Math.max(18, Math.min(64, 60 - 3 * absoluteMagnitude))
}

export function starHaloOpacity(absoluteMagnitude: number | null, selected = false): number {
  return 0.9 * (1 - Math.exp(-1.4 * starHaloStrength(absoluteMagnitude, selected)))
}

export function motionArrowLength(speedKms: number): number {
  if (!Number.isFinite(speedKms) || speedKms <= 0) return 0
  return Math.max(12, Math.min(40, speedKms / 10))
}

export function motionForeshortening(
  positionFromCamera: Pick<Vector3, 'x' | 'y' | 'z'>,
  velocityInCameraSpace: Pick<Vector3, 'x' | 'y' | 'z'>,
): number {
  const positionLength = Math.hypot(positionFromCamera.x, positionFromCamera.y, positionFromCamera.z)
  const velocityLength = Math.hypot(velocityInCameraSpace.x, velocityInCameraSpace.y, velocityInCameraSpace.z)
  if (!Number.isFinite(positionLength) || !Number.isFinite(velocityLength) || positionLength === 0 || velocityLength === 0) return 0
  const alignment = (
    positionFromCamera.x * velocityInCameraSpace.x +
    positionFromCamera.y * velocityInCameraSpace.y +
    positionFromCamera.z * velocityInCameraSpace.z
  ) / (positionLength * velocityLength)
  if (!Number.isFinite(alignment)) return 0
  return Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(alignment)) ** 2))
}

export interface StarViewer {
  select(id: string | null, focus?: boolean): void
  reset(): void
  setGridVisible(visible: boolean): void
  setObjectDistanceLimit(distanceLy: number): void
  setObjectTypeFilter(types: readonly ObjectType[]): void
  setPowerSavingMode(enabled: boolean): void
  setVisibility(observerId: string, limit: number): void
  setDistanceUnit(unit: DistanceUnit): void
  zoom(direction: 'in' | 'out'): void
  dispose(): void
}

interface ViewerOptions {
  onSelect(id: string | null): void
  onStatus(message: string | null): void
}

interface MapLabel {
  anchor: HTMLDivElement
  text: HTMLDivElement
  position: Vector3
  width: number
  height: number
  starId?: string
  measurement?: { distancePc: number; suffix: string }
  motion?: { element: HTMLSpanElement; icon: SVGElement; shaft: SVGPathElement; head: SVGPathElement; velocity: Vector3; length: number; mode: MotionMode }
  placement?: OrdinaryLabelPlacement
}

interface LabelRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ProjectedPickable {
  id: string
  x: number
  y: number
  depth: number
}

export class ScreenSpaceGrid<T> {
  private readonly buckets = new Map<string, T[]>()
  private readonly cellSize: number

  constructor(cellSize = 32) {
    this.cellSize = cellSize
  }

  clear(): void {
    this.buckets.clear()
  }

  insert(bounds: LabelRect, value: T): void {
    const minColumn = Math.floor(bounds.left / this.cellSize)
    const maxColumn = Math.floor(bounds.right / this.cellSize)
    const minRow = Math.floor(bounds.top / this.cellSize)
    const maxRow = Math.floor(bounds.bottom / this.cellSize)
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        const key = `${column}:${row}`
        const bucket = this.buckets.get(key)
        if (bucket) bucket.push(value)
        else this.buckets.set(key, [value])
      }
    }
  }

  query(bounds: LabelRect): T[] {
    const matches = new Set<T>()
    const minColumn = Math.floor(bounds.left / this.cellSize)
    const maxColumn = Math.floor(bounds.right / this.cellSize)
    const minRow = Math.floor(bounds.top / this.cellSize)
    const maxRow = Math.floor(bounds.bottom / this.cellSize)
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        for (const value of this.buckets.get(`${column}:${row}`) ?? []) matches.add(value)
      }
    }
    return [...matches]
  }
}

export function pickProjectedStarAtScreenPoint(
  grid: ScreenSpaceGrid<ProjectedPickable>, viewport: Viewport, pointer: PointerPosition, radius: number,
): string | null {
  if (
    pointer.clientX < viewport.left || pointer.clientX > viewport.left + viewport.width ||
    pointer.clientY < viewport.top || pointer.clientY > viewport.top + viewport.height
  ) return null
  let selected: string | null = null
  let nearestDistance = radius
  let nearestDepth = Infinity
  const query = {
    left: pointer.clientX - radius,
    right: pointer.clientX + radius,
    top: pointer.clientY - radius,
    bottom: pointer.clientY + radius,
  }
  for (const star of grid.query(query)) {
    const distance = Math.hypot(pointer.clientX - star.x, pointer.clientY - star.y)
    if (distance > radius) continue
    if (distance < nearestDistance - 1e-6 || (Math.abs(distance - nearestDistance) < 1e-6 && star.depth < nearestDepth)) {
      selected = star.id
      nearestDistance = distance
      nearestDepth = star.depth
    }
  }
  return selected
}

function disposeGeometry(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Points || object instanceof Line) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    }
  })
}

function lineBetween(points: Vector3[], color: number, dashed = false): Line {
  const geometry = new BufferGeometry().setFromPoints(points)
  const material = dashed
    ? new LineDashedMaterial({ color, dashSize: 0.065, gapSize: 0.045, depthWrite: false })
    : new LineBasicMaterial({ color, depthWrite: false })
  const line = new Line(geometry, material)
  if (dashed) line.computeLineDistances()
  return line
}

function overlaps(first: LabelRect, second: LabelRect, gap = 6): boolean {
  return first.left < second.right + gap && first.right + gap > second.left &&
    first.top < second.bottom + gap && first.bottom + gap > second.top
}

function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden
}

function setTransform(element: HTMLElement, transform: string): void {
  if (element.style.transform !== transform) element.style.transform = transform
}

export function createStarViewer(container: HTMLElement, stars: readonly Star[], options: ViewerOptions): StarViewer {
  const sun = stars.find((star) => star.id === 'sun')
  if (!sun) throw new Error('A Sun reference is required.')
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(renderPixelRatio(window.devicePixelRatio || 1, false))
  const canvas = renderer.domElement
  canvas.setAttribute('aria-label', 'Sun-centered 3D nearby-object map')
  canvas.setAttribute('role', 'img')
  container.append(canvas)

  const scene = new Scene()
  const camera = new PerspectiveCamera(44, 1, 0.01, 1000)
  const controls = new OrbitControls(camera, canvas)
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  controls.enableDamping = !reducedMotion.matches
  controls.dampingFactor = 0.2
  controls.minPolarAngle = 0.08
  controls.maxPolarAngle = Math.PI - 0.08
  controls.rotateSpeed = 0.65
  controls.screenSpacePanning = true

  const pickable = stars.map((star) => ({ id: star.id, position: galacticToWorld(star) }))
  const motions = stars.map(displayMotionForStar)
  const sunDistancesLy = stars.map((star) => sunRelativeMetrics(star, sun).distanceLy)
  const starsById = new Map(stars.map((star, index) => [star.id, { star, index }]))
  const starBounds = new Box3().setFromPoints(pickable.map((star) => star.position))
  const sphere = starBounds.getBoundingSphere(new Sphere())
  sphere.radius = Math.max(sphere.radius, 0.75)
  const homeDirection = new Vector3(-4.8, 3.8, -6.2).normalize()
  controls.minDistance = 0.08
  controls.maxDistance = Math.max(30, sphere.radius * 24)
  camera.far = controls.maxDistance * 5

  const textureCanvas = document.createElement('canvas')
  textureCanvas.width = textureCanvas.height = 64
  const context = textureCanvas.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.arc(32, 32, 29, 0, Math.PI * 2)
  context.fill()
  const dotTexture = new CanvasTexture(textureCanvas)
  dotTexture.colorSpace = SRGBColorSpace
  const starGeometry = new BufferGeometry()
  starGeometry.setAttribute('position', new Float32BufferAttribute(pickable.flatMap((star) => star.position.toArray()), 3))
  starGeometry.setAttribute('color', new Float32BufferAttribute(stars.flatMap((star) => temperatureToColor(star.temperature_k).toArray()), 3))
  starGeometry.setIndex(stars.map((_, index) => index))
  const coreIndices = starGeometry.getIndex()!
  const coreDiameters = new Float32BufferAttribute(stars.map(() => STAR_DIAMETER_PX), 1)
  starGeometry.setAttribute('coreDiameter', coreDiameters)
  const starMaterial = new PointsMaterial({
    size: 1, sizeAttenuation: false, map: dotTexture,
    vertexColors: true, alphaTest: 0.5, depthTest: true, depthWrite: true, toneMapped: false,
    transparent: true, blending: NoBlending,
  })
  starMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float coreDiameter;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', 'gl_PointSize = size * coreDiameter;')
  }
  const starPoints = new Points(starGeometry, starMaterial)
  starPoints.renderOrder = 2
  scene.add(starPoints)

  const haloCanvas = document.createElement('canvas')
  haloCanvas.width = haloCanvas.height = 128
  const haloContext = haloCanvas.getContext('2d')!
  const haloGradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64)
  haloGradient.addColorStop(0, '#ffffffff')
  haloGradient.addColorStop(0.35, '#ffffffe6')
  haloGradient.addColorStop(0.40, '#ffffffb3')
  haloGradient.addColorStop(0.55, '#ffffff4d')
  haloGradient.addColorStop(0.78, '#ffffff0f')
  haloGradient.addColorStop(1, '#ffffff00')
  haloContext.fillStyle = haloGradient
  haloContext.fillRect(0, 0, 128, 128)
  const haloTexture = new CanvasTexture(haloCanvas)
  haloTexture.colorSpace = SRGBColorSpace
  const haloGeometry = new BufferGeometry()
  haloGeometry.setAttribute('position', starGeometry.getAttribute('position').clone())
  haloGeometry.setAttribute('color', starGeometry.getAttribute('color').clone())
  // Reuse a fixed-capacity index buffer; zero-opacity halos should never reach
  // the rasterizer. The visible subset only changes with selection/settings.
  haloGeometry.setIndex(stars.map((_, index) => index))
  const haloIndices = haloGeometry.getIndex()!
  const haloOpacities = new Float32BufferAttribute(stars.map((star) => starHaloOpacity(star.absolute_mag)), 1)
  haloGeometry.setAttribute('haloOpacity', haloOpacities)
  haloGeometry.setAttribute('haloDiameter', new Float32BufferAttribute(stars.map((star) => starHaloDiameter(star.absolute_mag)), 1))
  const haloMaterial = new PointsMaterial({
    size: 1, sizeAttenuation: false, map: haloTexture, vertexColors: true,
    blending: AdditiveBlending, transparent: true, depthTest: true, depthFunc: LessDepth, depthWrite: false, toneMapped: false,
  })
  haloMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float haloDiameter;\nattribute float haloOpacity;\nvarying float vHaloOpacity;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', 'gl_PointSize = size * haloDiameter;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHaloOpacity = haloOpacity;')
    shader.fragmentShader = `varying float vHaloOpacity;\n${shader.fragmentShader}`
      .replace('#include <map_particle_fragment>', '#include <map_particle_fragment>\ndiffuseColor.a *= vHaloOpacity;')
  }
  const halos = new Points(haloGeometry, haloMaterial)
  halos.renderOrder = 3
  scene.add(halos)

  const gridHalfSize = Math.max(3, Math.ceil(Math.max(...pickable.map((star) => star.position.length())) + 1))
  const gridHelper = new GridHelper(gridHalfSize * 2, gridHalfSize * 4, 0x65615c, 0x393939)
  const gridOpacity = { value: 0.4 }
  const grid = new LineSegments(gridHelper.geometry, new ShaderMaterial({
    uniforms: { radius: { value: gridHalfSize }, opacity: gridOpacity },
    vertexColors: true, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 gridPosition;
      varying vec3 gridColor;
      void main() {
        gridPosition = position.xz;
        gridColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float radius;
      uniform float opacity;
      varying vec2 gridPosition;
      varying vec3 gridColor;
      void main() {
        float fade = 1.0 - smoothstep(radius * 0.55, radius, length(gridPosition));
        gl_FragColor = vec4(gridColor, opacity * fade);
        #include <colorspace_fragment>
      }
    `,
  }))
  gridHelper.material.dispose()
  scene.add(grid)
  const origin = galacticToWorld(sun)
  const axisLength = Math.max(1.2, sphere.radius)
  const axes = [
    { position: new Vector3(axisLength, 0, 0), text: '+X', color: 0x8d786f },
    { position: new Vector3(0, 0, -axisLength), text: '+Y', color: 0x9c8976 },
    { position: new Vector3(0, axisLength, 0), text: '+Z north', color: 0x899ca3 },
  ]
  const axisGeometry = new BufferGeometry().setFromPoints(axes.flatMap((axis) => [origin, axis.position]))
  axisGeometry.setAttribute('color', new Float32BufferAttribute(axes.flatMap((axis) => {
    const color = new Color(axis.color).toArray()
    return [...color, ...color]
  }), 3))
  const axisMaterial = new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false,
  })
  const axisLines = new LineSegments(axisGeometry, axisMaterial)
  scene.add(axisLines)

  const axisLayer = document.createElement('div')
  axisLayer.className = 'projected-axes'
  axisLayer.setAttribute('aria-hidden', 'true')
  container.append(axisLayer)
  const labelLayer = document.createElement('div')
  labelLayer.className = 'projected-labels'
  labelLayer.setAttribute('aria-hidden', 'true')
  container.append(labelLayer)

  function makeLabel(position: Vector3, content: string, className: string, starId?: string): MapLabel {
    const anchor = document.createElement('div')
    anchor.className = 'map-anchor'
    const text = document.createElement('div')
    text.className = `map-label ${className}`
    text.textContent = content
    if (starId) {
      anchor.dataset.starId = starId
      const ring = document.createElement('span')
      ring.className = 'selection-ring'
      anchor.append(ring)
    }
    anchor.append(text)
    labelLayer.append(anchor)
    return { anchor, text, position, starId, width: 0, height: 0 }
  }

  const starLabelPool: MapLabel[] = []
  const freeStarLabels: MapLabel[] = []
  const activeStarLabels = new Map<number, MapLabel>()
  const axisLabels = axes.map((axis) => makeLabel(axis.position, axis.text, 'axis-label'))
  axisLabels.forEach((label) => axisLayer.append(label.anchor))
  const guides = new Group()
  scene.add(guides)
  let measurementLabels: MapLabel[] = []
  let selectedId: string | null = null
  let visibilityBase = sun
  let magnitudeLimit = 7
  let objectDistanceLimitLy = 100
  let selectedTypes = new Set<ObjectType>(OBJECT_TYPES)
  let distanceUnit: DistanceUnit = 'pc'
  const tiers = new Map<string, ReturnType<typeof visibilityTier>>()
  const mapVisibility = new Map<string, boolean>()
  let rankedNameGroups: Array<{ priority: number; magnitude: number; indices: number[] }> = []
  let disposed = false
  let contextLost = false
  let pendingFrame: number | null = null
  let renderLoopActive = false
  let sceneDirty = false
  let forceNextFrame = false
  let nextRenderDeadline = 0
  let lastRenderTime = 0
  let previousRafTime = 0
  let refreshSamples: number[] = []
  let refreshSamplesRemaining = 20
  let measuredRefreshRate: number | null = null
  let updatingControls = false
  let home = true
  let focusTransition: { from: Vector3; to: Vector3; position: Vector3; started: number } | null = null
  let powerSavingMode = false
  let controlsInteracting = false
  let controlsSettling = false
  const focusTarget = new Vector3()
  let labelSizesDirty = true
  interface CachedProjection extends ProjectedPickable {
    index: number
    visible: boolean
    motionX: number
    motionY: number
    motionVisible: boolean
    motionScale: number
  }
  const projections = stars.map((star, index): CachedProjection => ({
    id: star.id,
    index,
    x: 0,
    y: 0,
    depth: Infinity,
    visible: false,
    motionX: 0,
    motionY: 0,
    motionVisible: false,
    motionScale: 0,
  }))
  const projectedPickables: CachedProjection[] = []
  const projectionGrid = new ScreenSpaceGrid<CachedProjection>()
  const viewProjection = new Matrix4()
  const clipPoint = new Vector4()
  const clipTangent = new Vector4()
  const viewPoint = new Vector4()
  const viewVelocity = new Vector4()
  let projectionViewport: DOMRect | null = null
  let projectionDirty = true

  function invalidateProjection(): void {
    projectionDirty = true
  }

  function createPooledStarLabel(): MapLabel {
    const label = makeLabel(new Vector3(), '', 'star-label')
    const ring = document.createElement('span')
    ring.className = 'selection-ring'
    label.anchor.prepend(ring)
    label.anchor.remove()
    starLabelPool.push(label)
    return label
  }

  function bindStarLabel(label: MapLabel, index: number, arrowEligible: boolean): void {
    const star = stars[index]!
    const motion = motions[index]
    label.position = pickable[index]!.position
    label.starId = star.id
    label.text.textContent = star.name
    label.placement = undefined
    label.anchor.dataset.starId = star.id
    label.anchor.dataset.visibility = tiers.get(star.id)
    label.anchor.dataset.mapVisible = String(mapVisibility.get(star.id))
    label.anchor.classList.remove('is-clipped')
    label.anchor.classList.toggle('is-selected', star.id === selectedId)
    label.anchor.style.setProperty('--star-color', temperatureToColor(star.temperature_k).getStyle())
    label.width = 0
    label.height = 0
    label.motion?.element.remove()
    delete label.motion
    if (motion && arrowEligible) {
      const length = motionArrowLength(motion.velocity.length())
      const width = length + 2 * 5 * 16 / 24
      const arrow = document.createElement('span')
      arrow.className = 'motion-arrow'
      arrow.dataset.motionMode = motion.mode
      arrow.dataset.maxLength = String(length)
      arrow.style.color = temperatureToColor(star.temperature_k).getStyle()
      arrow.style.width = `${width}px`
      arrow.style.height = '16px'
      arrow.style.left = `${-width / 2}px`
      arrow.style.top = '-8px'
      const icon = createElement(ArrowRight, { width, height: 16, viewBox: `0 0 ${width * 24 / 16} 24`, 'stroke-width': 1.7 })
      icon.classList.add('motion-arrow-icon')
      const [shaft, head] = icon.querySelectorAll('path')
      const tip = 5 + length * 24 / 16
      shaft!.setAttribute('d', `M5 12H${tip}`)
      shaft!.classList.add('motion-arrow-shaft')
      head!.setAttribute('transform', `translate(${tip - 19} 0)`)
      arrow.append(icon)
      label.anchor.append(arrow)
      label.motion = { element: arrow, icon, shaft: shaft!, head: head!, velocity: motion.velocity, length, mode: motion.mode }
    }
    labelLayer.append(label.anchor)
  }

  function syncStarLabels(nameIndices: ReadonlySet<number>, arrowIndices: ReadonlySet<number>): MapLabel[] {
    const needed = new Set([...nameIndices, ...arrowIndices])
    for (const [index, label] of activeStarLabels) {
      if (needed.has(index)) continue
      activeStarLabels.delete(index)
      label.anchor.remove()
      freeStarLabels.push(label)
    }
    for (const index of needed) {
      const arrowEligible = arrowIndices.has(index)
      let label = activeStarLabels.get(index)
      if (!label) {
        label = freeStarLabels.pop() ?? createPooledStarLabel()
        activeStarLabels.set(index, label)
        bindStarLabel(label, index, arrowEligible)
      } else if ((label.motion !== undefined) !== arrowEligible) {
        bindStarLabel(label, index, arrowEligible)
      } else {
        const star = stars[index]!
        label.anchor.dataset.visibility = tiers.get(star.id)
        label.anchor.dataset.mapVisible = String(mapVisibility.get(star.id))
        label.anchor.classList.toggle('is-selected', star.id === selectedId)
      }
    }
    return [...activeStarLabels.values()]
  }

  function invalidateLabelSizes(): void {
    labelSizesDirty = true
    requestRender()
  }

  // The catalog is static. Coalesce changes into a single frame, and only keep
  // scheduling frames while focus animation or OrbitControls damping is active.
  function requestRender(force = true): void {
    if (disposed || contextLost || document.hidden) return
    if (force) {
      sceneDirty = true
      if (lastRenderTime === 0) forceNextFrame = true
    }
    if (!renderLoopActive) {
      renderLoopActive = true
    }
    if (pendingFrame !== null) return
    pendingFrame = requestAnimationFrame(render)
  }

  function cancelRender(): void {
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame)
    pendingFrame = null
    renderLoopActive = false
    sceneDirty = false
    forceNextFrame = false
    nextRenderDeadline = 0
    lastRenderTime = 0
    previousRafTime = 0
  }

  function resetCadenceSamples(): void {
    refreshSamples = []
    refreshSamplesRemaining = 20
    measuredRefreshRate = null
    previousRafTime = 0
    nextRenderDeadline = 0
  }

  function updatePresentation(): void {
    let coreCount = 0
    let haloCount = 0
    stars.forEach((star, index) => {
      const tier = visibilityTier(star, visibilityBase, magnitudeLimit)
      const mapVisible = isObjectMapVisible(
        star,
        selectedTypes,
        selectedId,
        visibilityBase.id,
        sunDistancesLy[index]!,
        objectDistanceLimitLy,
      )
      tiers.set(star.id, tier)
      mapVisibility.set(star.id, mapVisible)
      coreDiameters.setX(index, tier === 'background' ? 3 : STAR_DIAMETER_PX)
      haloOpacities.setX(index, tier === 'background' ? 0 : starHaloOpacity(star.absolute_mag, star.id === selectedId))
      if (mapVisible) coreIndices.setX(coreCount++, index)
      if (mapVisible && tier !== 'background') haloIndices.setX(haloCount++, index)
    })
    coreIndices.needsUpdate = true
    coreDiameters.needsUpdate = true
    haloOpacities.needsUpdate = true
    haloIndices.needsUpdate = true
    starGeometry.setDrawRange(0, coreCount)
    haloGeometry.setDrawRange(0, haloCount)
    labelLayer.dataset.coreCount = String(coreCount)
    labelLayer.dataset.haloCount = String(haloCount)
    const ranked = stars.map((star, index) => ({
      index,
      priority: star.id === selectedId ? 0 : star.id === visibilityBase.id ? 1 : 2,
      magnitude: apparentVisualMagnitude(star.absolute_mag, sunRelativeMetrics(star, visibilityBase).distancePc) ?? Infinity,
    })).filter(({ index }) => mapVisibility.get(stars[index]!.id) && tiers.get(stars[index]!.id) !== 'background')
      .sort((first, second) => first.priority - second.priority || first.magnitude - second.magnitude || first.index - second.index)
    rankedNameGroups = []
    for (const candidate of ranked) {
      const group = rankedNameGroups.at(-1)
      if (!group || candidate.priority !== group.priority || candidate.magnitude !== group.magnitude) {
        rankedNameGroups.push({ priority: candidate.priority, magnitude: candidate.magnitude, indices: [candidate.index] })
      } else group.indices.push(candidate.index)
    }
    invalidateProjection()
  }

  function makeMeasurement(position: Vector3, distancePc: number, className: string, suffix = ''): MapLabel {
    const label = makeLabel(position, `${formatDistance(distancePc, distanceUnit)}${suffix}`, className)
    label.measurement = { distancePc, suffix }
    label.anchor.style.zIndex = '2'
    return label
  }

  function applyFocusTarget(target: Vector3, position: Vector3): void {
    controls.enableDamping = false
    controls.target.copy(target)
    camera.position.copy(position)
    updatingControls = true
    try {
      controls.update()
    } finally {
      updatingControls = false
    }
    controls.target.copy(target)
    camera.position.copy(position)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    controls.enableDamping = !reducedMotion.matches
    invalidateProjection()
  }

  function refreshProjectionCache(): void {
    camera.updateMatrixWorld()
    const viewport = canvas.getBoundingClientRect()
    projectionViewport = viewport
    projectionGrid.clear()
    projectedPickables.length = 0
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    for (const projected of projections) {
      projected.visible = false
      projected.motionVisible = false
      projected.motionScale = 0
      const star = stars[projected.index]!
      if (!mapVisibility.get(star.id)) continue
      const position = pickable[projected.index]!.position
      clipPoint.set(position.x, position.y, position.z, 1).applyMatrix4(viewProjection)
      if (clipPoint.w <= 0) continue
      const normalizedX = clipPoint.x / clipPoint.w
      const normalizedY = clipPoint.y / clipPoint.w
      const normalizedZ = clipPoint.z / clipPoint.w
      if (![normalizedX, normalizedY, normalizedZ].every(Number.isFinite) ||
        Math.abs(normalizedX) > 1 || Math.abs(normalizedY) > 1 || Math.abs(normalizedZ) > 1) continue
      projected.x = viewport.left + (normalizedX + 1) * viewport.width / 2
      projected.y = viewport.top + (1 - normalizedY) * viewport.height / 2
      projected.depth = clipPoint.w
      projected.visible = true
      projectedPickables.push(projected)
      projectionGrid.insert({ left: projected.x, right: projected.x, top: projected.y, bottom: projected.y }, projected)
      const motion = motions[projected.index]
      if (!motion || tiers.get(star.id) === 'background') continue
      const speed = motion.velocity.length()
      if (!Number.isFinite(speed) || speed === 0) continue
      viewPoint.set(position.x, position.y, position.z, 1).applyMatrix4(camera.matrixWorldInverse)
      viewVelocity.set(motion.velocity.x / speed, motion.velocity.y / speed, motion.velocity.z / speed, 0)
        .applyMatrix4(camera.matrixWorldInverse)
      projected.motionScale = motionForeshortening(viewPoint, viewVelocity)
      if (projected.motionScale < 1e-6) continue
      clipTangent.copy(viewVelocity).applyMatrix4(camera.projectionMatrix)
      const horizontal = clipTangent.x - normalizedX * clipTangent.w
      const vertical = clipTangent.y - normalizedY * clipTangent.w
      if (Math.hypot(horizontal, vertical) < 1e-6 * clipTangent.length()) continue
      const screenX = horizontal * viewport.width
      const screenY = -vertical * viewport.height
      const length = Math.hypot(screenX, screenY)
      if (!Number.isFinite(length) || length === 0) continue
      projected.motionX = screenX / length
      projected.motionY = screenY / length
      projected.motionVisible = true
    }
    projectionDirty = false
  }

  function updateLabels(): void {
    if (projectionDirty) refreshProjectionCache()
    const viewport = projectionViewport!
    const ordinaryBudget = mapLabelBudget(matchMedia('(pointer: coarse)').matches || viewport.width <= 720)
    const selectedIndex = selectedId ? starsById.get(selectedId)!.index : -1
    const observerIndex = starsById.get(visibilityBase.id)!.index
    const ordinaryGroups = rankedNameGroups.map((group) => ({
      indices: group.indices.filter((index) => index !== selectedIndex && index !== observerIndex),
    })).filter((group) => group.indices.length > 0)
    const budgetedNameIndices = new Set(budgetVisibleLabelIndices(ordinaryGroups, projections, ordinaryBudget))
    if (selectedIndex >= 0) budgetedNameIndices.add(selectedIndex)
    budgetedNameIndices.add(observerIndex)
    const budgetedNames = new Set([...budgetedNameIndices].map((index) => stars[index]!.id))
    const arrowIndices = new Set(projectedPickables
      .filter((projected) => projected.motionVisible)
      .map((projected) => projected.index))
    const starLabels = syncStarLabels(budgetedNameIndices, arrowIndices)
    labelLayer.dataset.nameBudget = String(ordinaryBudget)
    if (labelSizesDirty) {
      for (const label of [...axisLabels, ...starLabelPool, ...measurementLabels]) {
        label.width = 0
        label.height = 0
      }
      labelSizesDirty = false
    }
    const labelsToMeasure = [...axisLabels, ...measurementLabels, ...starLabels.filter((label) => budgetedNames.has(label.starId!))]
    if (labelsToMeasure.some((label) => label.width === 0 || label.height === 0)) {
      for (const label of labelsToMeasure) {
        setHidden(label.anchor, false)
        setHidden(label.text, false)
      }
      for (const label of labelsToMeasure) {
        label.width = label.text.offsetWidth
        label.height = label.text.offsetHeight
      }
    }
    const obstacles = [...container.parentElement!.querySelectorAll<HTMLElement>('[data-scene-obstacle]')]
      .filter((element) => !element.hidden)
      .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
    const blocked = new ScreenSpaceGrid<LabelRect>()
    for (const obstacle of obstacles) blocked.insert(obstacle.bounds, obstacle.bounds)
    const measurementObstacles = measurementLabels.flatMap((label) => {
      const start = projections[starsById.get(sun!.id)!.index]!
      const end = selectedId ? projections[starsById.get(selectedId)!.index]! : undefined
      if (!start.visible || !end?.visible) return []
      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + end.y) / 2
      return [{
        left: centerX - label.width / 2,
        top: centerY - label.height / 2,
        right: centerX + label.width / 2,
        bottom: centerY + label.height / 2,
      }]
    })
    const selectedLabelObstacles: LabelRect[] = [
      ...obstacles
        .filter(({ element }) => element.matches('.scene-brand, .scene-toolbar, .scene-legend, .plane-key, .visibility-observer'))
        .map((obstacle) => obstacle.bounds),
      ...measurementObstacles,
    ]
    for (const label of axisLabels) {
      const projected = grid.visible ? projectWorldPoint(label.position, camera, viewport) : null
      setHidden(label.anchor, !projected)
      if (!projected) continue
      setTransform(label.anchor, `translate(${projected.x - viewport.left}px, ${projected.y - viewport.top}px)`)
      const { width, height } = label
      setTransform(label.text, `translate(18px, ${-height / 2}px)`)
      const rectangle = { left: projected.x + 18, right: projected.x + 18 + width, top: projected.y - height / 2, bottom: projected.y + height / 2 }
      setHidden(label.text, rectangle.left < viewport.left + 12 || rectangle.right > viewport.right - 12 ||
        rectangle.top < viewport.top + 12 || rectangle.bottom > viewport.bottom - 12 ||
        blocked.query(rectangle).some((obstacle) => overlaps(rectangle, obstacle)))
    }
    const starObstacles = new ScreenSpaceGrid<{ depth: number; bounds: LabelRect }>()
    for (const projected of projectedPickables) {
      if (!starBlocksLabels(tiers.get(projected.id)!)) continue
      const radius = STAR_DIAMETER_PX / 2
      const obstacle = { depth: projected.depth, bounds: { left: projected.x - radius, right: projected.x + radius, top: projected.y - radius, bottom: projected.y + radius } }
      starObstacles.insert(obstacle.bounds, obstacle)
    }
    const selectedLabels = starLabels.filter((label) => label.starId === selectedId)
    const projectedSelectedLabels = selectedLabels.filter((label) => projections[starsById.get(label.starId!)!.index]!.visible)
    const clippedSelectedLabels = selectedLabels.filter((label) => !projections[starsById.get(label.starId!)!.index]!.visible)
    const otherStarLabels = starLabels.filter((label) => label.starId !== selectedId)
      .sort((first, second) => projections[starsById.get(first.starId!)!.index]!.depth -
        projections[starsById.get(second.starId!)!.index]!.depth)
    for (const [index, label] of [...selectedLabels, ...otherStarLabels].entries()) {
      const zIndex = label.starId === selectedId ? '1' : `${-index - 1}`
      if (label.anchor.style.zIndex !== zIndex) label.anchor.style.zIndex = zIndex
      if (!label.motion) continue
      const { element, icon, shaft, head, length } = label.motion
      if (!mapVisibility.get(label.starId!)) {
        setHidden(element, true)
        continue
      }
      const projected = projections[starsById.get(label.starId!)!.index]!
      setHidden(element, !projected.motionVisible)
      if (!projected.motionVisible) continue
      const projectedLength = length * projected.motionScale
      const width = projectedLength + 2 * 5 * 16 / 24
      const tip = 5 + projectedLength * 24 / 16
      element.style.width = `${width}px`
      element.style.left = `${-width / 2}px`
      icon.setAttribute('width', `${width}`)
      icon.setAttribute('viewBox', `0 0 ${width * 24 / 16} 24`)
      shaft.setAttribute('d', `M5 12H${tip}`)
      head.setAttribute('transform', `translate(${tip - 19} 0)`)
      const offsetX = projected.motionX * (STAR_DIAMETER_PX / 2 + projectedLength / 2)
      const offsetY = projected.motionY * (STAR_DIAMETER_PX / 2 + projectedLength / 2)
      const headHalfHeight = 7 * 16 / 24
      const strokeRadius = 1.7 / 2 * 16 / 24
      const halfWidth = projectedLength / 2 * Math.abs(projected.motionX) + headHalfHeight * Math.abs(projected.motionY) + strokeRadius
      const halfHeight = projectedLength / 2 * Math.abs(projected.motionY) + headHalfHeight * Math.abs(projected.motionX) + strokeRadius
      const centerX = projected.x + offsetX
      const centerY = projected.y + offsetY
      const bounds = { left: centerX - halfWidth, right: centerX + halfWidth, top: centerY - halfHeight, bottom: centerY + halfHeight }
      setTransform(element, `translate(${offsetX}px, ${offsetY}px) rotate(${Math.atan2(projected.motionY, projected.motionX)}rad)`)
      starObstacles.insert(bounds, { depth: projected.depth, bounds })
    }
    for (const label of [...projectedSelectedLabels, ...measurementLabels, ...otherStarLabels, ...clippedSelectedLabels]) {
      if (label.starId && !mapVisibility.get(label.starId)) {
        setHidden(label.anchor, true)
        continue
      }
      if (label.measurement) {
        const start = projections[starsById.get(sun!.id)!.index]!
        const end = selectedId ? projections[starsById.get(selectedId)!.index]! : undefined
        setHidden(label.anchor, !start.visible || !end?.visible)
        if (!start.visible || !end?.visible) continue
        const centerX = (start.x + end.x) / 2
        const centerY = (start.y + end.y) / 2
        const { width, height } = label
        const rectangle = {
          left: centerX - width / 2,
          top: centerY - height / 2,
          right: centerX + width / 2,
          bottom: centerY + height / 2,
        }
        setTransform(label.anchor, `translate(${centerX - viewport.left}px, ${centerY - viewport.top}px)`)
        setTransform(label.text, `translate(${-width / 2}px, ${-height / 2}px)`)
        setHidden(label.text, false)
        blocked.insert(rectangle, rectangle)
        continue
      }
      const cached = label.starId ? projections[starsById.get(label.starId)!.index]! : null
      const projected = cached?.visible ? cached : label.starId ? null : projectWorldPoint(label.position, camera, viewport)
      const selected = label.starId === selectedId
      const foreground = selected
      const clippedForeground = foreground && !projected
      const anchor = projected ?? (foreground ? projectSelectedAnchor(label.position, camera, viewport) : null)
      setHidden(label.anchor, !anchor)
      if (label.anchor.classList.contains('is-clipped') !== !projected) label.anchor.classList.toggle('is-clipped', !projected)
      if (!anchor) continue
      setTransform(label.anchor, `translate(${anchor.x - viewport.left}px, ${anchor.y - viewport.top}px)`)
      if (label.starId && !budgetedNames.has(label.starId)) {
        setHidden(label.text, true)
        continue
      }
      if (label.starId && tiers.get(label.starId) === 'background') {
        setHidden(label.text, true)
        continue
      }
      const { width, height } = label
      if (foreground) {
        const clamp = (left: number, top: number): LabelRect => {
          left = Math.max(viewport.left + 12, Math.min(left, viewport.right - width - 12))
          top = Math.max(viewport.top + 12, Math.min(top, viewport.bottom - height - 12))
          return { left, top, right: left + width, bottom: top + height }
        }
        const candidates = [
          clamp(anchor.x + 22, anchor.y - height / 2),
          clamp(anchor.x - width - 22, anchor.y - height / 2),
          clamp(anchor.x - width / 2, anchor.y + 22),
          clamp(anchor.x - width / 2, anchor.y - height - 22),
        ]
        const placement = candidates.find((candidate) =>
          selectedLabelObstacles.every((obstacle) => !overlaps(candidate, obstacle)) &&
          (!clippedForeground || !blocked.query(candidate).some((obstacle) => overlaps(candidate, obstacle)))) ?? candidates[0]!
        setTransform(label.text, `translate(${placement.left - anchor.x}px, ${placement.top - anchor.y}px)`)
        setHidden(label.text, false)
        if (!clippedForeground) blocked.insert(placement, placement)
        continue
      }
      const placement = chooseOrdinaryLabelPlacement(
        ordinaryLabelCandidates(anchor, width, height),
        label.placement,
        (rectangle, gap) =>
          rectangle.left < viewport.left + 12 || rectangle.right > viewport.right - 12 ||
          rectangle.top < viewport.top + 12 || rectangle.bottom > viewport.bottom - 12 ||
          blocked.query(rectangle).some((obstacle) => overlaps(rectangle, obstacle, gap)) ||
          starObstacles.query(rectangle).some((obstacle) =>
            (!label.starId || obstacle.depth <= projected!.depth) && overlaps(rectangle, obstacle.bounds, gap)),
      )
      if (placement) {
        label.placement = placement.placement
        setTransform(label.text, `translate(${placement.left - anchor.x}px, ${placement.top - anchor.y}px)`)
        blocked.insert(placement, placement)
      }
      setHidden(label.text, !placement)
    }
  }

  function select(id: string | null, focus = true): void {
    const star = stars.find((candidate) => candidate.id === id)
    if (id !== null && !star) return
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    selectedId = id
    if (star) visibilityBase = star
    updatePresentation()
    disposeGeometry(guides)
    guides.clear()
    measurementLabels.forEach((label) => label.anchor.remove())
    measurementLabels = []
    invalidateLabelSizes()
    if (!star) {
      requestRender()
      return
    }
    const metrics = sunRelativeMetrics(star, sun!)
    if (metrics.distancePc > 1e-9) {
      const position = galacticToWorld(star)
      const foot = new Vector3(position.x, 0, position.z)
      guides.add(lineBetween([origin, position], 0xe7a05b))
      if (metrics.planeDistancePc > 1e-9) guides.add(lineBetween([origin, foot], 0x79634d, true))
      if (metrics.side !== 'on') {
        guides.add(lineBetween([foot, position], 0xe7a05b, true))
        const markerSize = 0.05
        guides.add(lineBetween([
          foot.clone().add(new Vector3(-markerSize, 0, -markerSize)),
          foot.clone().add(new Vector3(markerSize, 0, -markerSize)),
          foot.clone().add(new Vector3(markerSize, 0, markerSize)),
          foot.clone().add(new Vector3(-markerSize, 0, markerSize)),
          foot.clone().add(new Vector3(-markerSize, 0, -markerSize)),
        ], 0xe7a05b))
      }
      measurementLabels.push(makeMeasurement(origin.clone().lerp(position, 0.5), metrics.distancePc, 'dimension-label distance-label'))
    }
    if (focus) {
      const position = camera.position.clone()
      const from = controls.target.clone()
      const to = galacticToWorld(star)
      applyFocusTarget(from, position)
      if (reducedMotion.matches) applyFocusTarget(to, position)
      else focusTransition = { from, to, position, started: performance.now() }
      home = false
    }
    resize()
    requestRender()
  }

  function fitHome(): void {
    const verticalAngle = camera.fov * Math.PI / 360
    const fitAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * camera.aspect))
    const distance = Math.min(controls.maxDistance, sphere.radius / Math.sin(fitAngle) * 1.6)
    controls.target.copy(sphere.center)
    camera.position.copy(sphere.center).addScaledVector(homeDirection, distance)
    camera.lookAt(controls.target)
    controls.update()
    controls.saveState()
    home = true
    invalidateProjection()
  }

  function reset(): void {
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    controls.reset()
    fitHome()
    resize()
    requestRender()
  }

  let renderWidth = 0
  let renderHeight = 0
  function resize(): void {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    const pixelRatio = renderPixelRatio(window.devicePixelRatio || 1, powerSavingMode)
    const sizeChanged = width !== renderWidth || height !== renderHeight
    if (!sizeChanged && renderer.getPixelRatio() === pixelRatio) return
    renderWidth = width
    renderHeight = height
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height)
    gridOpacity.value = Math.min(1, 0.4 * pixelRatio)
    axisMaterial.opacity = Math.min(1, 0.55 * pixelRatio)
    if (!sizeChanged) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    invalidateProjection()
    if (home) fitHome()
    invalidateLabelSizes()
  }

  const events = new AbortController()
  const gesture = new TapGesture()
  function pick(event: PointerEvent, refreshStale: boolean): string | null {
    if (refreshStale && projectionDirty) refreshProjectionCache()
    if (!projectionViewport || projectionDirty) return null
    return pickProjectedStarAtScreenPoint(projectionGrid, projectionViewport, event, event.pointerType === 'touch' ? 24 : 16)
  }
  let hoverFrame: number | null = null
  let hoverEvent: PointerEvent | null = null
  canvas.addEventListener('pointerdown', (event) => gesture.begin(event), { signal: events.signal })
  canvas.addEventListener('pointermove', (event) => {
    gesture.move(event)
    if (event.buttons !== 0 || event.pointerType === 'touch') return
    hoverEvent = event
    if (hoverFrame !== null) return
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = null
      if (hoverEvent) canvas.style.cursor = pick(hoverEvent, false) ? 'pointer' : 'grab'
      hoverEvent = null
    })
  }, { signal: events.signal })
  canvas.addEventListener('pointerup', (event) => {
    if (!gesture.end(event)) return
    const bounds = canvas.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
    options.onSelect(pick(event, true))
  }, { signal: events.signal })
  canvas.addEventListener('pointercancel', (event) => gesture.cancel(event.pointerId), { signal: events.signal })
  canvas.addEventListener('lostpointercapture', (event) => gesture.cancel(event.pointerId), { signal: events.signal })
  function onControlsStart(): void {
    focusTransition = null
    home = false
    controlsInteracting = true
    controlsSettling = true
    invalidateProjection()
    resize()
    requestRender()
  }
  function onControlsEnd(): void {
    controlsInteracting = false
    controlsSettling = true
    requestRender()
  }
  controls.addEventListener('start', onControlsStart)
  controls.addEventListener('end', onControlsEnd)
  function onControlsChange(): void {
    invalidateProjection()
    requestRender(!updatingControls)
  }
  controls.addEventListener('change', onControlsChange)
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && focusTransition) {
      applyFocusTarget(focusTransition.to, focusTransition.position)
      focusTransition = null
    }
    controls.enableDamping = !reducedMotion.matches
    if (reducedMotion.matches) {
      controlsInteracting = false
      controlsSettling = false
    }
    resize()
    requestRender()
  }, { signal: events.signal })

  function render(time: number): void {
    pendingFrame = null
    if (disposed || contextLost || document.hidden) return
    if (previousRafTime > 0 && refreshSamplesRemaining > 0) {
      refreshSamples.push(time - previousRafTime)
      if (refreshSamples.length > 30) refreshSamples.shift()
      refreshSamplesRemaining--
      const estimate = estimateRefreshRate(refreshSamples)
      if (estimate !== null && targetRenderFps(false, measuredRefreshRate) !== targetRenderFps(false, estimate)) {
        nextRenderDeadline = 0
      }
      measuredRefreshRate = estimate
    }
    previousRafTime = time
    const sceneNeedsFrame = sceneDirty || focusTransition !== null || controlsInteracting || controlsSettling
    if (!sceneNeedsFrame) {
      if (refreshSamplesRemaining > 0) requestRender(false)
      else {
        renderLoopActive = false
        previousRafTime = 0
        lastRenderTime = 0
      }
      return
    }
    const fps = targetRenderFps(powerSavingMode, measuredRefreshRate)
    const deadline = advanceFrameDeadline(time, nextRenderDeadline, fps, forceNextFrame)
    nextRenderDeadline = deadline.next
    if (!deadline.due) {
      requestRender(false)
      return
    }
    forceNextFrame = false
    sceneDirty = false
    const elapsedMs = lastRenderTime > 0 ? time - lastRenderTime : 1000 / 60
    lastRenderTime = time
    let continueRendering = false
    if (focusTransition) {
      const progress = focusProgress(time - focusTransition.started)
      focusTarget.lerpVectors(focusTransition.from, focusTransition.to, progress)
      applyFocusTarget(focusTarget, focusTransition.position)
      if (progress === 1) {
        focusTransition = null
        resize()
      }
      else continueRendering = true
    } else {
      const dampingFactor = controls.dampingFactor
      if (controls.enableDamping) controls.dampingFactor = effectiveDampingFactor(dampingFactor, elapsedMs)
      updatingControls = true
      let changed: boolean
      try {
        changed = controls.update()
      } finally {
        updatingControls = false
        controls.dampingFactor = dampingFactor
      }
      if (controlsInteracting || changed) {
        controlsSettling = true
        continueRendering = true
      } else if (controlsSettling) {
        controlsSettling = false
        resize()
      }
    }
    camera.updateMatrixWorld()
    renderer.render(scene, camera)
    updateLabels()
    if (continueRendering || refreshSamplesRemaining > 0) requestRender(false)
    else {
      renderLoopActive = false
      previousRafTime = 0
      lastRenderTime = 0
    }
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    focusTransition = null
    contextLost = true
    cancelRender()
    options.onStatus('The 3D view lost its graphics context. Star details are still available.')
  }, { signal: events.signal })
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false
    options.onStatus(null)
    resetCadenceSamples()
    resize()
    requestRender()
  }, { signal: events.signal })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelRender()
    else {
      resetCadenceSamples()
      resize()
      requestRender()
    }
  }, { signal: events.signal })
  window.addEventListener('resize', () => {
    resetCadenceSamples()
    resize()
    invalidateLabelSizes()
  }, { signal: events.signal })
  window.addEventListener('focus', () => {
    resetCadenceSamples()
    requestRender()
  }, { signal: events.signal })
  // Moving between displays or changing browser zoom can change DPR without
  // changing the scene's CSS dimensions. Watch it without polling every frame.
  let pixelRatioQuery: MediaQueryList
  function watchPixelRatio(): void {
    pixelRatioQuery?.removeEventListener('change', onPixelRatioChange)
    pixelRatioQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
    pixelRatioQuery.addEventListener('change', onPixelRatioChange, { signal: events.signal })
  }
  function onPixelRatioChange(): void {
    watchPixelRatio()
    resetCadenceSamples()
    resize()
    requestRender()
  }
  watchPixelRatio()
  document.fonts.ready.then(invalidateLabelSizes)
  document.fonts.addEventListener('loadingdone', invalidateLabelSizes, { signal: events.signal })

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  // Font loading, unit changes, and hiding the grid legend can change the
  // rectangles that labels must avoid, even when the canvas size stays fixed.
  const obstacleObserver = new ResizeObserver(() => requestRender())
  container.parentElement!.querySelectorAll<HTMLElement>('[data-scene-obstacle]')
    .forEach((element) => obstacleObserver.observe(element))
  updatePresentation()
  resize()
  requestRender()
  container.dataset.ready = 'true'

  return {
    select,
    reset,
    setObjectDistanceLimit(distanceLy) {
      if (!Number.isFinite(distanceLy) || distanceLy < 5 || distanceLy > 100) return
      objectDistanceLimitLy = distanceLy
      updatePresentation()
      requestRender()
    },
    setObjectTypeFilter(types) {
      selectedTypes = new Set(types.filter((type) => OBJECT_TYPES.includes(type)))
      updatePresentation()
      requestRender()
    },
    setPowerSavingMode(enabled) {
      powerSavingMode = enabled
      resetCadenceSamples()
      resize()
      requestRender()
    },
    setVisibility(observerId, limit) {
      const base = stars.find((star) => star.id === observerId)
      if (!base || !Number.isFinite(limit) || limit < 0 || limit > 25) return
      visibilityBase = base
      magnitudeLimit = limit
      updatePresentation()
      requestRender()
    },
    setDistanceUnit(unit) {
      distanceUnit = unit
      measurementLabels.forEach((label) => {
        const { distancePc, suffix } = label.measurement!
        label.text.textContent = `${formatDistance(distancePc, unit)}${suffix}`
      })
      invalidateLabelSizes()
    },
    setGridVisible(visible) {
      grid.visible = visible
      axisLines.visible = visible
      requestRender()
    },
    zoom(direction) {
      focusTransition = null
      controlsInteracting = false
      controlsSettling = false
      home = false
      if (direction === 'in') controls.dollyIn(1 / 1.3)
      else controls.dollyOut(1 / 1.3)
      controls.update()
      resize()
      requestRender()
    },
    dispose() {
      disposed = true
      focusTransition = null
      cancelRender()
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame)
      events.abort()
      observer.disconnect()
      obstacleObserver.disconnect()
      controls.removeEventListener('start', onControlsStart)
      controls.removeEventListener('end', onControlsEnd)
      controls.removeEventListener('change', onControlsChange)
      controls.dispose()
      disposeGeometry(scene)
      dotTexture.dispose()
      haloTexture.dispose()
      renderer.dispose()
      canvas.remove()
      axisLayer.remove()
      labelLayer.remove()
      delete container.dataset.ready
    },
  }
}

export interface Viewport {
  left: number
  top: number
  width: number
  height: number
}

export interface PickableStar {
  id: string
  position: Vector3
}

export interface PointerPosition {
  clientX: number
  clientY: number
}

type GesturePointer = PointerPosition & { pointerId: number; button: number }

export function projectWorldPoint(position: Vector3, camera: Camera, viewport: Viewport) {
  if (viewport.width <= 0 || viewport.height <= 0) return null
  const clip = new Vector4(position.x, position.y, position.z, 1)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix)
  if (clip.w <= 0) return null
  const normalized = clip.clone().divideScalar(clip.w)
  if ([normalized.x, normalized.y, normalized.z].some((value) => !Number.isFinite(value) || Math.abs(value) > 1)) return null
  return {
    x: viewport.left + (normalized.x + 1) * viewport.width / 2,
    y: viewport.top + (1 - normalized.y) * viewport.height / 2,
    depth: clip.w,
  }
}

export function projectSelectedAnchor(position: Vector3, camera: Camera, viewport: Viewport) {
  if (viewport.width <= 0 || viewport.height <= 0) return null
  const clip = new Vector4(position.x, position.y, position.z, 1)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix)
  let horizontal = clip.x / Math.max(Math.abs(clip.w), 1e-9)
  let vertical = clip.y / Math.max(Math.abs(clip.w), 1e-9)
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) return null
  if (clip.w <= 0) {
    const extent = Math.max(Math.abs(horizontal), Math.abs(vertical))
    if (extent > 1e-9) {
      horizontal /= extent
      vertical /= extent
    } else vertical = -1
  }
  return {
    x: viewport.left + (Math.max(-1, Math.min(1, horizontal)) + 1) * viewport.width / 2,
    y: viewport.top + (1 - Math.max(-1, Math.min(1, vertical))) * viewport.height / 2,
  }
}

export function projectMotionDirection(position: Vector3, velocity: Vector3, camera: Camera, viewport: Viewport) {
  if (!projectWorldPoint(position, camera, viewport)) return null
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
  if (!Number.isFinite(speed) || speed === 0) return null
  const clip = new Vector4(position.x, position.y, position.z, 1)
    .applyMatrix4(camera.matrixWorldInverse)
  const viewVelocity = new Vector4(velocity.x / speed, velocity.y / speed, velocity.z / speed, 0)
    .applyMatrix4(camera.matrixWorldInverse)
  if (motionForeshortening(clip, viewVelocity) < 1e-6) return null
  clip.applyMatrix4(camera.projectionMatrix)
  const tangent = viewVelocity.applyMatrix4(camera.projectionMatrix)
  const horizontal = tangent.x - clip.x / clip.w * tangent.w
  const vertical = tangent.y - clip.y / clip.w * tangent.w
  if (Math.hypot(horizontal, vertical) < 1e-6 * Math.hypot(tangent.x, tangent.y, tangent.z, tangent.w)) return null
  const screenX = horizontal * viewport.width
  const screenY = -vertical * viewport.height
  const length = Math.hypot(screenX, screenY)
  if (!Number.isFinite(length) || length === 0) return null
  return { x: screenX / length, y: screenY / length }
}

export function pickStarAtScreenPoint(
  stars: readonly PickableStar[], camera: Camera, viewport: Viewport, pointer: PointerPosition, radius: number,
): string | null {
  const projected: ProjectedPickable[] = []
  const grid = new ScreenSpaceGrid<ProjectedPickable>()
  for (const star of stars) {
    const point = projectWorldPoint(star.position, camera, viewport)
    if (!point) continue
    const entry = { id: star.id, ...point }
    projected.push(entry)
    grid.insert({ left: entry.x, right: entry.x, top: entry.y, bottom: entry.y }, entry)
  }
  return pickProjectedStarAtScreenPoint(grid, viewport, pointer, radius)
}

export class TapGesture {
  private active = new Set<number>()
  private origin: GesturePointer | null = null
  private blocked = false

  begin(pointer: GesturePointer): void {
    if (this.active.size === 0) {
      this.origin = pointer
      this.blocked = pointer.button !== 0
    }
    this.active.add(pointer.pointerId)
    if (this.active.size > 1) this.blocked = true
  }

  move(pointer: GesturePointer): void {
    if (this.origin?.pointerId === pointer.pointerId) {
      const distance = Math.hypot(pointer.clientX - this.origin.clientX, pointer.clientY - this.origin.clientY)
      if (distance > 6) this.blocked = true
    }
  }

  end(pointer: GesturePointer): boolean {
    if (!this.active.has(pointer.pointerId)) return false
    this.move(pointer)
    const tapped = !this.blocked && this.active.size === 1 && this.origin?.pointerId === pointer.pointerId && pointer.button === 0
    this.active.delete(pointer.pointerId)
    if (this.active.size === 0) this.origin = null
    return tapped
  }

  cancel(pointerId: number): void {
    this.active.delete(pointerId)
    this.blocked = true
    if (this.active.size === 0) this.origin = null
  }
}
