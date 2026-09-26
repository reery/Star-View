import {
  AdditiveBlending, Box3, BufferGeometry, CanvasTexture, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute,
  GridHelper, Group, InstancedBufferAttribute, InstancedBufferGeometry, LessDepth, Line, LineBasicMaterial, LineDashedMaterial,
  LineSegments, Matrix4, Mesh, NoBlending, Object3D, PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial, Sphere,
  SRGBColorSpace, Vector2, Vector3, Vector4, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OBJECT_TYPES, type ObjectType, type Star } from './catalog-model'
import { apparentVisualMagnitude, displayMotionForStar, formatDistance, galacticToWorld, gridSpacingPc, LIGHT_YEARS_PER_PARSEC, starDisplayColor, sunRelativeMetrics, type DistanceUnit, type MotionFrame, type MotionMode } from './astronomy'
import { advanceFrameDeadline, effectiveDampingFactor, estimateRefreshRate, renderPixelRatio, targetRenderFps } from './render-scheduling'
import { centeredForegroundLabelBounds, chooseOrdinaryLabelPlacement, ordinaryLabelCandidates, overlaps, type LabelRect, type OrdinaryLabelPlacement } from './label-layout'
import {
  MOTION_ARROW_DASH_PX, MOTION_ARROW_GAP_PX, MOTION_ARROW_HEAD_PX, MOTION_ARROW_STROKE_PX, MOTION_ARROW_TAIL_OFFSET_PX,
  STAR_DIAMETER_PX, ScreenSpaceGrid, TapGesture, budgetVisibleLabelIndices, focusProgress,
  isObjectMapVisible, mapLabelBudget, motionArrowGeometryInto, motionTravelDistancePc, pickProjectedStarAtScreenPoint,
  projectMotionDirectionInto, projectSelectedAnchor, projectWorldPoint, projectWorldPointInto,
  shouldRunOrdinaryLabelLayout, starBlocksLabels, starHaloDiameter, starHaloOpacity, type MotionArrowGeometry, type ProjectedPickable,
} from './viewer-primitives'

export interface StarViewer {
  getViewState(): ViewerViewState
  select(id: string | null, focus?: boolean): void
  reset(): void
  setGridVisible(visible: boolean): void
  setViewState(state: ViewerViewState): void
  setObjectDistanceLimit(distanceLy: number): void
  setObjectTypeFilter(types: readonly ObjectType[]): void
  setMotionFrame(frame: MotionFrame): void
  setMotionYears(years: MotionYears): void
  setPowerSavingMode(enabled: boolean): void
  setVisibility(observerId: string, limit: number): void
  setDistanceUnit(unit: DistanceUnit): void
  zoom(direction: 'in' | 'out'): void
  dispose(): void
}

export const MOTION_YEAR_OPTIONS = [1_000, 5_000, 10_000, 25_000, 50_000] as const
export type MotionYears = typeof MOTION_YEAR_OPTIONS[number]

export interface ViewerViewState {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  home: boolean
}

interface ViewerOptions {
  onSelect(id: string | null): void
  onStatus(message: string | null): void
  gridHalfSizePc?: number
}

// Last drawn motion arrow in client CSS px, returned by the label layer's motionArrowSnapshot() test hook.
export interface MotionArrowSnapshot {
  id: string
  mode: MotionMode
  selected: boolean
  opacity: number
  color: string
  projectedDistance: number
  length: number
  x: number
  y: number
  tailX: number
  tailY: number
  tipX: number
  tipY: number
  bounds: LabelRect
}

interface MapLabel {
  anchor: HTMLDivElement
  text: HTMLDivElement
  position: Vector3
  width: number
  height: number
  index?: number
  starId?: string
  measurement?: { distancePc: number; suffix: string }
  placement?: OrdinaryLabelPlacement
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

function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden
}

function setTransform(element: HTMLElement, transform: string): void {
  if (element.style.transform !== transform) element.style.transform = transform
}

function setData(element: HTMLElement, key: string, value: string): void {
  if (element.dataset[key] !== value) element.dataset[key] = value
}

function sameIndexSet(first: ReadonlySet<number>, second: ReadonlySet<number>): boolean {
  if (first.size !== second.size) return false
  for (const index of first) if (!second.has(index)) return false
  return true
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
  const coarsePointer = matchMedia('(pointer: coarse)')
  controls.enableDamping = !reducedMotion.matches
  controls.dampingFactor = 0.2
  controls.minPolarAngle = 0.08
  controls.maxPolarAngle = Math.PI - 0.08
  controls.rotateSpeed = 0.65
  controls.screenSpacePanning = true

  const pickable = stars.map((star) => ({ id: star.id, position: galacticToWorld(star) }))
  let motions = stars.map((star) => displayMotionForStar(star))
  const sunDistancesLy = stars.map((star) => sunRelativeMetrics(star, sun).distanceLy)
  const starsById = new Map(stars.map((star, index) => [star.id, { star, index }]))
  const starColors = stars.map(starDisplayColor)
  const starColorStyles = starColors.map((color) => color.getStyle())
  const starBounds = new Box3().setFromPoints(pickable.map((star) => star.position))
  const catalogSphere = starBounds.getBoundingSphere(new Sphere())
  catalogSphere.radius = Math.max(catalogSphere.radius, 0.75)
  const homeDirection = new Vector3(-4.8, 3.8, -6.2).normalize()
  controls.minDistance = 0.08
  controls.maxDistance = Math.max(30, catalogSphere.radius * 24)
  camera.far = controls.maxDistance * 5

  const textureCanvas = document.createElement('canvas')
  textureCanvas.width = textureCanvas.height = 64
  const context = textureCanvas.getContext('2d')!
  const coreGradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  coreGradient.addColorStop(0, '#ffffffff')
  coreGradient.addColorStop(0.30, '#ffffffff')
  coreGradient.addColorStop(0.52, '#fffffff2')
  coreGradient.addColorStop(0.72, '#ffffff66')
  coreGradient.addColorStop(0.90, '#ffffff00')
  context.fillStyle = coreGradient
  context.fillRect(0, 0, 64, 64)
  const dotTexture = new CanvasTexture(textureCanvas)
  dotTexture.colorSpace = SRGBColorSpace
  const starGeometry = new BufferGeometry()
  starGeometry.setAttribute('position', new Float32BufferAttribute(pickable.flatMap((star) => star.position.toArray()), 3))
  starGeometry.setAttribute('color', new Float32BufferAttribute(starColors.flatMap((color) => color.toArray()), 3))
  starGeometry.setIndex(stars.map((_, index) => index))
  const coreIndices = starGeometry.getIndex()!
  const coreDiameters = new Float32BufferAttribute(stars.map(() => STAR_DIAMETER_PX), 1)
  starGeometry.setAttribute('coreDiameter', coreDiameters)
  const starMaterial = new PointsMaterial({
    size: 1, sizeAttenuation: false, map: dotTexture,
    vertexColors: true, alphaTest: 0.2, depthTest: true, depthWrite: true, toneMapped: false,
    transparent: true, blending: NoBlending,
  })
  starMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float coreDiameter;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', 'gl_PointSize = size * coreDiameter;')
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_particle_fragment>',
      `#include <map_particle_fragment>
      float coreRadius = length(gl_PointCoord - vec2(0.5)) * 2.0;
      diffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, smoothstep(0.16, 0.68, coreRadius));`,
    )
  }
  const starPoints = new Points(starGeometry, starMaterial)
  starPoints.renderOrder = 2
  scene.add(starPoints)

  const haloCanvas = document.createElement('canvas')
  haloCanvas.width = haloCanvas.height = 128
  const haloContext = haloCanvas.getContext('2d')!
  const haloGradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64)
  haloGradient.addColorStop(0, '#ffffffff')
  haloGradient.addColorStop(0.12, '#fffffff2')
  haloGradient.addColorStop(0.28, '#ffffffa3')
  haloGradient.addColorStop(0.48, '#ffffff4d')
  haloGradient.addColorStop(0.72, '#ffffff24')
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

  // Screen-space motion arrows: one instanced quad per arrow, positioned in canvas CSS px each frame.
  const arrowCapacity = Math.max(1, motions.filter(Boolean).length)
  const arrowGeometry = new InstancedBufferGeometry()
  arrowGeometry.setAttribute('position', new Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3))
  arrowGeometry.setIndex([0, 1, 2, 0, 2, 3])
  const arrowPlacements = new InstancedBufferAttribute(new Float32Array(arrowCapacity * 4), 4).setUsage(DynamicDrawUsage)
  const arrowShapes = new InstancedBufferAttribute(new Float32Array(arrowCapacity * 2), 2).setUsage(DynamicDrawUsage)
  const arrowColors = new InstancedBufferAttribute(new Float32Array(arrowCapacity * 4), 4).setUsage(DynamicDrawUsage)
  arrowGeometry.setAttribute('arrowPlacement', arrowPlacements)
  arrowGeometry.setAttribute('arrowShape', arrowShapes)
  arrowGeometry.setAttribute('arrowColor', arrowColors)
  arrowGeometry.instanceCount = 0
  const arrowUniforms = {
    viewportSize: { value: new Vector2(1, 1) },
    pixelRatio: { value: 1 },
    strokeRadius: { value: MOTION_ARROW_STROKE_PX / 2 },
    headSize: { value: MOTION_ARROW_HEAD_PX },
    dashLength: { value: MOTION_ARROW_DASH_PX },
    gapLength: { value: MOTION_ARROW_GAP_PX },
  }
  const arrowMaterial = new ShaderMaterial({
    uniforms: arrowUniforms,
    // The CSS-to-clip-space y flip reverses the quad winding.
    side: DoubleSide,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute vec4 arrowPlacement;
      attribute vec2 arrowShape;
      attribute vec4 arrowColor;
      uniform vec2 viewportSize;
      uniform float pixelRatio;
      uniform float strokeRadius;
      uniform float headSize;
      varying vec2 arrowPoint;
      varying float arrowLength;
      varying float arrowDashed;
      varying vec4 arrowRgba;
      void main() {
        float pad = strokeRadius + 1.0 / pixelRatio;
        arrowLength = arrowShape.x;
        arrowDashed = arrowShape.y;
        arrowRgba = arrowColor;
        // x runs from the tail (0) to the tip (arrowLength); y spans the arrowhead.
        float start = min(0.0, arrowLength - headSize) - pad;
        arrowPoint = vec2(mix(start, arrowLength + pad, position.x), position.y * (headSize + pad));
        vec2 along = arrowPlacement.zw;
        vec2 across = vec2(-along.y, along.x);
        vec2 screenPoint = arrowPlacement.xy + along * arrowPoint.x + across * arrowPoint.y;
        gl_Position = vec4(screenPoint.x / viewportSize.x * 2.0 - 1.0, 1.0 - screenPoint.y / viewportSize.y * 2.0, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float pixelRatio;
      uniform float strokeRadius;
      uniform float headSize;
      uniform float dashLength;
      uniform float gapLength;
      varying vec2 arrowPoint;
      varying float arrowLength;
      varying float arrowDashed;
      varying vec4 arrowRgba;
      float segmentDistance(vec2 point, vec2 start, vec2 end) {
        vec2 segment = end - start;
        float along = clamp(dot(point - start, segment) / max(dot(segment, segment), 1e-6), 0.0, 1.0);
        return length(point - start - segment * along);
      }
      float strokeCoverage(float offset) {
        return clamp((strokeRadius - offset) * pixelRatio + 0.5, 0.0, 1.0);
      }
      void main() {
        vec2 tip = vec2(arrowLength, 0.0);
        float coverage = strokeCoverage(min(
          segmentDistance(arrowPoint, tip, tip + vec2(-headSize, headSize)),
          segmentDistance(arrowPoint, tip, tip + vec2(-headSize, -headSize))));
        float shaft = strokeCoverage(segmentDistance(arrowPoint, vec2(0.0), tip));
        if (arrowDashed > 0.5 && arrowPoint.x > 0.0 && arrowPoint.x < arrowLength) {
          // Butt-capped dashes; the first dash keeps the round tail cap.
          float period = dashLength + gapLength;
          float phase = mod(arrowPoint.x, period);
          float inside = phase <= dashLength
            ? min(arrowPoint.x < dashLength ? dashLength : phase, dashLength - phase)
            : -min(phase - dashLength, period - phase);
          shaft *= clamp(inside * pixelRatio + 0.5, 0.0, 1.0);
        }
        coverage = max(coverage, shaft);
        if (coverage <= 0.0) discard;
        gl_FragColor = vec4(arrowRgba.rgb, arrowRgba.a * coverage);
        #include <colorspace_fragment>
      }
    `,
  })
  const arrows = new Mesh(arrowGeometry, arrowMaterial)
  arrows.frustumCulled = false
  arrows.renderOrder = 4
  arrows.visible = false
  scene.add(arrows)

  const baseGridHalfSize = options.gridHalfSizePc ?? Math.max(3, Math.ceil(Math.max(...pickable.map((star) => star.position.length())) + 1))
  function gridHalfSizeForDistance(distanceLy: number): number {
    return distanceLy <= 100 ? baseGridHalfSize : Math.max(baseGridHalfSize, Math.ceil(distanceLy / LIGHT_YEARS_PER_PARSEC))
  }
  function makeGridGeometry(spacingPc: number, halfSizePc: number): BufferGeometry {
    const helper = new GridHelper(halfSizePc * 2, Math.max(2, Math.round(halfSizePc * 2 / spacingPc)), 0x65615c, 0x393939)
    helper.material.dispose()
    return helper.geometry
  }
  let gridSpacing = gridSpacingPc(100)
  let gridHalfSize = gridHalfSizeForDistance(100)
  const gridOpacity = { value: 0.4 }
  const gridRadius = { value: gridHalfSize }
  const grid = new LineSegments(makeGridGeometry(gridSpacing, gridHalfSize), new ShaderMaterial({
    uniforms: { radius: gridRadius, opacity: gridOpacity },
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
  scene.add(grid)
  container.dataset.gridSpacingPc = String(gridSpacing)
  container.dataset.gridHalfSizePc = String(gridHalfSize)
  const origin = galacticToWorld(sun)
  const axisLength = Math.max(1.2, catalogSphere.radius)
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
  // Name sizes survive pool rebinding; 0 means not measured yet.
  const starLabelWidths = new Float32Array(stars.length)
  const starLabelHeights = new Float32Array(stars.length)
  const labelsToMeasure: MapLabel[] = []
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
  let motionFrame: MotionFrame = 'galactic'
  let motionYears: MotionYears = 1_000
  let distanceUnit: DistanceUnit = 'pc'
  const tiers = new Map<string, 'base' | 'eligible' | 'background'>()
  const mapVisibility = new Map<string, boolean>()
  const apparentMagnitudes = new Float64Array(stars.length)
  let rankedBaseId = ''
  let rankedSelection: string | null | undefined
  let rankedCandidates: Array<{ index: number; priority: number; magnitude: number }> = []
  let rankedNameGroups: Array<{ priority: number; magnitude: number; indices: number[] }> = []
  // Frame-scoped label layout containers, reused by updateLabels() so camera
  // motion frames don't churn garbage. The group pool mirrors rankedNameGroups
  // and is rebuilt only when that list's identity changes.
  let ordinaryGroupSource: typeof rankedNameGroups | null = null
  const ordinaryGroupPool: Array<{ indices: number[] }> = []
  const ordinaryGroups: Array<{ indices: number[] }> = []
  const budgetedNameIndices = new Set<number>()
  const ordinaryNameIndices = new Set<number>()
  const committedOrdinaryNameIndices = new Set<number>()
  const budgetedNames = new Set<string>()
  const starLabels: MapLabel[] = []
  const measurementPlacements = new Map<MapLabel, LabelRect | null>()
  const selectedLabelObstacles: LabelRect[] = []
  let yearlyMotionDistances = motions.map((motion) => motion ? motionTravelDistancePc(motion.velocity.length(), 1) : 0)
  const arrowScratch: MotionArrowGeometry = { tailX: 0, tailY: 0, tipX: 0, tipY: 0, left: 0, top: 0, right: 0, bottom: 0 }
  const arrowObstacleScratch: MotionArrowGeometry = { ...arrowScratch }
  const arrowStarIndices = new Int32Array(arrowCapacity)
  const arrowBounds = Array.from({ length: arrowCapacity }, () => ({ left: 0, top: 0, right: 0, bottom: 0 }))
  const arrowObstacles = Array.from({ length: arrowCapacity }, () => ({ depth: 0, bounds: { left: 0, top: 0, right: 0, bottom: 0 } }))
  let arrowCount = 0
  const arrowOrigin = { left: 0, top: 0 }
  let disposed = false
  let contextLost = false
  let pendingFrame: number | null = null
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
  let ordinaryLayoutDirty = true
  let lastOrdinaryLayoutTime = -Infinity
  let ordinaryLayoutPasses = 0
  const sceneObstacleElements = [...container.parentElement!.querySelectorAll<HTMLElement>('[data-scene-obstacle]')]
  let obstacleBounds: Array<{ element: HTMLElement; bounds: DOMRect }> = []
  let obstacleBoundsDirty = true
  interface CachedProjection extends ProjectedPickable {
    index: number
    visible: boolean
    motionX: number
    motionY: number
    motionVisible: boolean
    motionScale: number
    motionDepthScale: number
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
    motionDepthScale: 0,
  }))
  const projectedPickables: CachedProjection[] = []
  const projectionGrid = new ScreenSpaceGrid<CachedProjection>()
  // Label avoidance grids, cleared and refilled in place once per frame by updateLabels().
  const blocked = new ScreenSpaceGrid<LabelRect>()
  const starObstacles = new ScreenSpaceGrid<{ depth: number; bounds: LabelRect }>()
  const viewProjection = new Matrix4()
  const clipPoint = new Vector4()
  const clipTangent = new Vector4()
  const viewPoint = new Vector4()
  const viewVelocity = new Vector4()
  let projectionViewport: DOMRect | null = null
  let projectionDirty = true
  let viewportDirty = true

  function invalidateProjection(): void {
    projectionDirty = true
  }

  function invalidateViewport(): void {
    viewportDirty = true
    obstacleBoundsDirty = true
    ordinaryLayoutDirty = true
    invalidateProjection()
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

  function bindStarLabel(label: MapLabel, index: number): void {
    const star = stars[index]!
    label.position = pickable[index]!.position
    label.starId = star.id
    label.text.textContent = star.name
    label.placement = undefined
    label.anchor.dataset.starId = star.id
    label.anchor.dataset.visibility = tiers.get(star.id)
    label.anchor.dataset.mapVisible = String(mapVisibility.get(star.id))
    label.anchor.classList.remove('is-clipped')
    label.anchor.classList.toggle('is-selected', star.id === selectedId)
    label.anchor.style.setProperty('--star-color', starColorStyles[index]!)
    label.index = index
    label.width = starLabelWidths[index]!
    label.height = starLabelHeights[index]!
    labelLayer.append(label.anchor)
  }

  function syncStarLabels(nameIndices: ReadonlySet<number>, out: MapLabel[]): boolean {
    let changed = false
    for (const [index, label] of activeStarLabels) {
      if (nameIndices.has(index)) continue
      activeStarLabels.delete(index)
      label.anchor.remove()
      freeStarLabels.push(label)
      changed = true
    }
    for (const index of nameIndices) {
      let label = activeStarLabels.get(index)
      if (!label) {
        label = freeStarLabels.pop() ?? createPooledStarLabel()
        activeStarLabels.set(index, label)
        bindStarLabel(label, index)
        changed = true
      } else {
        const star = stars[index]!
        setData(label.anchor, 'visibility', tiers.get(star.id)!)
        setData(label.anchor, 'mapVisible', String(mapVisibility.get(star.id)))
        label.anchor.classList.toggle('is-selected', star.id === selectedId)
      }
    }
    out.length = 0
    for (const label of activeStarLabels.values()) out.push(label)
    return changed
  }

  function invalidateLabelSizes(): void {
    labelSizesDirty = true
    ordinaryLayoutDirty = true
    requestRender()
  }

  function invalidateStarLabelSize(index: number): void {
    starLabelWidths[index] = 0
    starLabelHeights[index] = 0
    const label = activeStarLabels.get(index)
    if (!label) return
    label.width = 0
    label.height = 0
  }

  // The catalog is static. Coalesce changes into a single frame, and only keep
  // scheduling frames while focus animation or OrbitControls damping is active.
  function requestRender(force = true): void {
    if (disposed || contextLost || document.hidden) return
    if (force) {
      sceneDirty = true
      if (lastRenderTime === 0) forceNextFrame = true
    }
    if (pendingFrame !== null) return
    pendingFrame = requestAnimationFrame(render)
  }

  function cancelRender(): void {
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame)
    pendingFrame = null
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
    ordinaryLayoutDirty = true
    const baseChanged = rankedBaseId !== visibilityBase.id
    const rankingChanged = baseChanged || rankedSelection !== selectedId
    if (baseChanged) {
      stars.forEach((star, index) => {
        const distancePc = Math.hypot(
          star.x_pc - visibilityBase.x_pc,
          star.y_pc - visibilityBase.y_pc,
          star.z_pc - visibilityBase.z_pc,
        )
        apparentMagnitudes[index] = apparentVisualMagnitude(star.absolute_mag, distancePc) ?? Infinity
      })
    }
    if (rankingChanged) {
      rankedCandidates = stars.map((star, index) => ({
        index,
        priority: star.id === selectedId ? 0 : star.id === visibilityBase.id ? 1 : 2,
        magnitude: apparentMagnitudes[index]!,
      })).sort((first, second) => first.priority - second.priority || first.magnitude - second.magnitude || first.index - second.index)
      rankedBaseId = visibilityBase.id
      rankedSelection = selectedId
    }
    let coreCount = 0
    let haloCount = 0
    stars.forEach((star, index) => {
      const magnitude = apparentMagnitudes[index]!
      const tier = star.id === visibilityBase.id ? 'base' : magnitude <= magnitudeLimit ? 'eligible' : 'background'
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
    rankedNameGroups = []
    for (const candidate of rankedCandidates) {
      if (!mapVisibility.get(stars[candidate.index]!.id) || tiers.get(stars[candidate.index]!.id) === 'background') continue
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
    label.anchor.style.zIndex = '3'
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
    if (viewportDirty || !projectionViewport) {
      projectionViewport = canvas.getBoundingClientRect()
      viewportDirty = false
    }
    const viewport = projectionViewport
    projectionGrid.clear()
    projectedPickables.length = 0
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    for (const projected of projections) {
      projected.visible = false
      projected.motionVisible = false
      projected.motionScale = 0
      projected.motionDepthScale = 0
      const star = stars[projected.index]!
      if (!mapVisibility.get(star.id)) continue
      const position = pickable[projected.index]!.position
      if (!projectWorldPointInto(position, viewProjection, viewport, clipPoint, projected)) continue
      projected.visible = true
      projectedPickables.push(projected)
      projectionGrid.insert({ left: projected.x, right: projected.x, top: projected.y, bottom: projected.y }, projected)
      const motion = motions[projected.index]
      if (!motion || tiers.get(star.id) === 'background') continue
      projectMotionDirectionInto(position, motion.velocity, camera, viewport, clipPoint, viewPoint, viewVelocity, clipTangent, projected)
    }
    projectionDirty = false
  }

  function updateMotionArrows(): void {
    if (projectionDirty) refreshProjectionCache()
    const viewport = projectionViewport!
    const selectedIndex = selectedId ? starsById.get(selectedId)!.index : -1
    const placements = arrowPlacements.array as Float32Array
    const shapes = arrowShapes.array as Float32Array
    const colors = arrowColors.array as Float32Array
    arrowCount = 0
    for (const projected of projectedPickables) {
      if (!projected.motionVisible) continue
      const index = projected.index
      const projectedDistance = yearlyMotionDistances[index]! * motionYears * projected.motionScale
      const length = projectedDistance - MOTION_ARROW_TAIL_OFFSET_PX
      if (length <= 0) continue
      const arrow = motionArrowGeometryInto(projected.x, projected.y, projected.motionX, projected.motionY, length, arrowScratch)
      const slot = arrowCount++
      placements[slot * 4] = arrow.tailX - viewport.left
      placements[slot * 4 + 1] = arrow.tailY - viewport.top
      placements[slot * 4 + 2] = projected.motionX
      placements[slot * 4 + 3] = projected.motionY
      shapes[slot * 2] = length
      shapes[slot * 2 + 1] = motions[index]!.mode === 'transverse' ? 1 : 0
      const color = starColors[index]!
      colors[slot * 4] = color.r
      colors[slot * 4 + 1] = color.g
      colors[slot * 4 + 2] = color.b
      colors[slot * 4 + 3] = index === selectedIndex ? 1 : 0.5
      arrowStarIndices[slot] = index
      const renderedBounds = arrowBounds[slot]!
      renderedBounds.left = arrow.left
      renderedBounds.top = arrow.top
      renderedBounds.right = arrow.right
      renderedBounds.bottom = arrow.bottom
      // Long physical vectors may cross most of the map. Preserve the former
      // speed-scaled and foreshortened label-clearance reach so their bounding
      // boxes do not hide names far from the star or flood the spatial grid.
      const oldScreenLength = Math.max(12, Math.min(40, motions[index]!.velocity.length() / 10)) * projected.motionDepthScale
      const obstacleArrow = length <= oldScreenLength ? arrow : motionArrowGeometryInto(
        projected.x, projected.y, projected.motionX, projected.motionY, oldScreenLength, arrowObstacleScratch,
      )
      const obstacle = arrowObstacles[slot]!
      obstacle.depth = projected.depth
      obstacle.bounds.left = obstacleArrow.left
      obstacle.bounds.top = obstacleArrow.top
      obstacle.bounds.right = obstacleArrow.right
      obstacle.bounds.bottom = obstacleArrow.bottom
    }
    arrowOrigin.left = viewport.left
    arrowOrigin.top = viewport.top
    arrowGeometry.instanceCount = arrowCount
    arrowPlacements.needsUpdate = true
    arrowShapes.needsUpdate = true
    arrowColors.needsUpdate = true
    arrowUniforms.viewportSize.value.set(viewport.width, viewport.height)
    arrows.visible = arrowCount > 0
  }

  Object.defineProperty(labelLayer, 'motionArrowSnapshot', {
    configurable: true,
    value: (): MotionArrowSnapshot[] => {
      const placements = arrowPlacements.array
      const shapes = arrowShapes.array
      const colors = arrowColors.array
      return Array.from({ length: arrowCount }, (_, slot) => {
        const index = arrowStarIndices[slot]!
        const tailX = placements[slot * 4]! + arrowOrigin.left
        const tailY = placements[slot * 4 + 1]! + arrowOrigin.top
        const directionX = placements[slot * 4 + 2]!
        const directionY = placements[slot * 4 + 3]!
        const length = shapes[slot * 2]!
        return {
          id: stars[index]!.id,
          mode: motions[index]!.mode,
          selected: index === (selectedId ? starsById.get(selectedId)!.index : -1),
          opacity: colors[slot * 4 + 3]!,
          color: starColorStyles[index]!,
          projectedDistance: length + MOTION_ARROW_TAIL_OFFSET_PX,
          length,
          x: tailX - directionX * STAR_DIAMETER_PX / 2,
          y: tailY - directionY * STAR_DIAMETER_PX / 2,
          tailX,
          tailY,
          tipX: tailX + directionX * length,
          tipY: tailY + directionY * length,
          bounds: { ...arrowBounds[slot]! },
        }
      })
    },
  })

  function updateLabels(time: number): void {
    if (projectionDirty) refreshProjectionCache()
    const viewport = projectionViewport!
    const ordinaryBudget = mapLabelBudget(coarsePointer.matches || viewport.width <= 720)
    const selectedIndex = selectedId ? starsById.get(selectedId)!.index : -1
    const observerIndex = starsById.get(visibilityBase.id)!.index
    if (ordinaryGroupSource !== rankedNameGroups) {
      ordinaryGroupSource = rankedNameGroups
      ordinaryGroupPool.length = 0
      for (let i = 0; i < rankedNameGroups.length; i++) ordinaryGroupPool.push({ indices: [] })
    }
    ordinaryGroups.length = 0
    for (let groupIndex = 0; groupIndex < rankedNameGroups.length; groupIndex++) {
      const entry = ordinaryGroupPool[groupIndex]!
      const indices = entry.indices
      indices.length = 0
      for (const index of rankedNameGroups[groupIndex]!.indices) {
        if (index !== selectedIndex && index !== observerIndex) indices.push(index)
      }
      if (indices.length > 0) ordinaryGroups.push(entry)
    }
    budgetedNameIndices.clear()
    ordinaryNameIndices.clear()
    for (const index of budgetVisibleLabelIndices(ordinaryGroups, projections, ordinaryBudget)) {
      ordinaryNameIndices.add(index)
      budgetedNameIndices.add(index)
    }
    if (selectedIndex >= 0) budgetedNameIndices.add(selectedIndex)
    budgetedNameIndices.add(observerIndex)
    budgetedNames.clear()
    for (const index of budgetedNameIndices) budgetedNames.add(stars[index]!.id)
    const labelsChanged = syncStarLabels(budgetedNameIndices, starLabels)
    setData(labelLayer, 'nameBudget', String(ordinaryBudget))
    let labelSizesChanged = false
    if (labelSizesDirty) {
      for (const label of [...axisLabels, ...starLabelPool, ...measurementLabels]) {
        label.width = 0
        label.height = 0
      }
      starLabelWidths.fill(0)
      starLabelHeights.fill(0)
      labelSizesDirty = false
      labelSizesChanged = true
    }
    labelsToMeasure.length = 0
    for (const label of axisLabels) if (label.width === 0 || label.height === 0) labelsToMeasure.push(label)
    for (const label of measurementLabels) if (label.width === 0 || label.height === 0) labelsToMeasure.push(label)
    for (const label of starLabels) {
      if (budgetedNames.has(label.starId!) && (label.width === 0 || label.height === 0)) labelsToMeasure.push(label)
    }
    if (labelsToMeasure.length > 0) {
      for (const label of labelsToMeasure) {
        setHidden(label.anchor, false)
        setHidden(label.text, false)
      }
      for (const label of labelsToMeasure) {
        label.width = label.text.offsetWidth
        label.height = label.text.offsetHeight
        if (label.index === undefined) continue
        starLabelWidths[label.index] = label.width
        starLabelHeights[label.index] = label.height
      }
      labelSizesChanged = true
    }
    const obstacleBoundsChanged = obstacleBoundsDirty
    if (obstacleBoundsDirty) {
      obstacleBounds = sceneObstacleElements
        .filter((element) => !element.hidden)
        .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
      obstacleBoundsDirty = false
    }
    const obstacles = obstacleBounds
    const layoutOrdinaryLabels = shouldRunOrdinaryLabelLayout(
      time,
      lastOrdinaryLayoutTime,
      controlsInteracting || controlsSettling || focusTransition !== null,
      ordinaryLayoutDirty || labelsChanged || labelSizesChanged || obstacleBoundsChanged ||
        !sameIndexSet(ordinaryNameIndices, committedOrdinaryNameIndices),
    )
    blocked.clear()
    for (const obstacle of obstacles) blocked.insert(obstacle.bounds, obstacle.bounds)
    measurementPlacements.clear()
    for (const label of measurementLabels) {
      const start = projections[starsById.get(sun!.id)!.index]!
      const end = selectedId ? projections[starsById.get(selectedId)!.index]! : undefined
      if (!start.visible || !end?.visible) {
        measurementPlacements.set(label, null)
        continue
      }
      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + end.y) / 2
      measurementPlacements.set(label, centeredForegroundLabelBounds(
        { x: centerX, y: centerY }, label.width, label.height, viewport,
      ))
    }
    selectedLabelObstacles.length = 0
    for (const obstacle of obstacles) {
      if (obstacle.element.matches('.selected-object, .scene-toolbar, .control-dock, .scene-legend, .visibility-observer')) {
        selectedLabelObstacles.push(obstacle.bounds)
      }
    }
    for (const placement of measurementPlacements.values()) {
      if (placement !== null) selectedLabelObstacles.push(placement)
    }
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
        blocked.queryAny(rectangle, (obstacle) => overlaps(rectangle, obstacle)))
    }
    starObstacles.clear()
    for (const projected of projectedPickables) {
      if (!starBlocksLabels(tiers.get(projected.id)!)) continue
      const radius = STAR_DIAMETER_PX / 2
      const obstacle = { depth: projected.depth, bounds: { left: projected.x - radius, right: projected.x + radius, top: projected.y - radius, bottom: projected.y + radius } }
      starObstacles.insert(obstacle.bounds, obstacle)
    }
    for (let slot = 0; slot < arrowCount; slot++) starObstacles.insert(arrowObstacles[slot]!.bounds, arrowObstacles[slot]!)
    const selectedLabels = starLabels.filter((label) => label.starId === selectedId)
    const projectedSelectedLabels = selectedLabels.filter((label) => projections[starsById.get(label.starId!)!.index]!.visible)
    const clippedSelectedLabels = selectedLabels.filter((label) => !projections[starsById.get(label.starId!)!.index]!.visible)
    const otherStarLabels = starLabels.filter((label) => label.starId !== selectedId)
      .sort((first, second) => projections[starsById.get(first.starId!)!.index]!.depth -
        projections[starsById.get(second.starId!)!.index]!.depth)
    for (const [index, label] of [...selectedLabels, ...otherStarLabels].entries()) {
      const zIndex = label.starId === selectedId ? '1' : `${-index - 1}`
      if (label.anchor.style.zIndex !== zIndex) label.anchor.style.zIndex = zIndex
    }
    for (const label of [...projectedSelectedLabels, ...measurementLabels, ...otherStarLabels, ...clippedSelectedLabels]) {
      if (label.starId && !mapVisibility.get(label.starId)) {
        setHidden(label.anchor, true)
        continue
      }
      if (label.measurement) {
        const start = projections[starsById.get(sun!.id)!.index]!
        const end = selectedId ? projections[starsById.get(selectedId)!.index]! : undefined
        const placement = measurementPlacements.get(label) ?? null
        setHidden(label.anchor, !placement)
        if (!start.visible || !end?.visible || !placement) continue
        const centerX = (start.x + end.x) / 2
        const centerY = (start.y + end.y) / 2
        setTransform(label.anchor, `translate(${centerX - viewport.left}px, ${centerY - viewport.top}px)`)
        setTransform(label.text, `translate(${placement.left - centerX}px, ${placement.top - centerY}px)`)
        setHidden(label.text, false)
        blocked.insert(placement, placement)
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
      if (!layoutOrdinaryLabels && !foreground) continue
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
          (!clippedForeground || !blocked.queryAny(candidate, (obstacle) => overlaps(candidate, obstacle)))) ?? candidates[0]!
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
          blocked.queryAny(rectangle, (obstacle) => overlaps(rectangle, obstacle, gap)) ||
          starObstacles.queryAny(rectangle, (obstacle) =>
            (!label.starId || obstacle.depth <= projected!.depth) && overlaps(rectangle, obstacle.bounds, gap)),
      )
      if (placement) {
        label.placement = placement.placement
        setTransform(label.text, `translate(${placement.left - anchor.x}px, ${placement.top - anchor.y}px)`)
        blocked.insert(placement, placement)
      }
      setHidden(label.text, !placement)
    }
    if (layoutOrdinaryLabels) {
      lastOrdinaryLayoutTime = time
      ordinaryLayoutDirty = false
      committedOrdinaryNameIndices.clear()
      for (const index of ordinaryNameIndices) committedOrdinaryNameIndices.add(index)
      ordinaryLayoutPasses++
      labelLayer.dataset.ordinaryLayoutPasses = String(ordinaryLayoutPasses)
    }
  }

  function select(id: string | null, focus = true): void {
    const star = id === null ? undefined : starsById.get(id)?.star
    if (id !== null && !star) return
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    const previousSelectedId = selectedId
    selectedId = id
    obstacleBoundsDirty = true
    if (star) visibilityBase = star
    updatePresentation()
    disposeGeometry(guides)
    guides.clear()
    measurementLabels.forEach((label) => label.anchor.remove())
    measurementLabels = []
    // Only the selected name's heavier style changes a label size.
    for (const changedId of [previousSelectedId, id]) {
      if (changedId !== null) invalidateStarLabelSize(starsById.get(changedId)!.index)
    }
    requestRender()
    if (!star) return
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
    if (home && !focus) fitHome()
    else resize()
  }

  const homeBounds = new Box3()
  const homeSphere = new Sphere()
  function fitHome(): void {
    homeBounds.makeEmpty()
    stars.forEach((star, index) => {
      if (mapVisibility.get(star.id)) homeBounds.expandByPoint(pickable[index]!.position)
    })
    if (homeBounds.isEmpty()) homeBounds.expandByPoint(origin)
    homeBounds.getBoundingSphere(homeSphere)
    homeSphere.radius = Math.max(homeSphere.radius, 0.75)
    const verticalAngle = camera.fov * Math.PI / 360
    const fitAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * camera.aspect))
    const distance = Math.min(controls.maxDistance, homeSphere.radius / Math.sin(fitAngle) * 1.6)
    controls.target.copy(homeSphere.center)
    camera.position.copy(homeSphere.center).addScaledVector(homeDirection, distance)
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
    arrowUniforms.pixelRatio.value = pixelRatio
    if (!sizeChanged) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    invalidateViewport()
    if (home) fitHome()
    requestRender()
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
  coarsePointer.addEventListener('change', () => requestRender(), { signal: events.signal })

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
    updateMotionArrows()
    renderer.render(scene, camera)
    updateLabels(time)
    if (continueRendering || refreshSamplesRemaining > 0) requestRender(false)
    else {
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
    invalidateViewport()
    resize()
    requestRender()
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
  const obstacleObserver = new ResizeObserver(() => {
    obstacleBoundsDirty = true
    ordinaryLayoutDirty = true
    requestRender()
  })
  sceneObstacleElements.forEach((element) => obstacleObserver.observe(element))
  updatePresentation()
  resize()
  requestRender()
  container.dataset.ready = 'true'

  return {
    getViewState() {
      return {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        home,
      }
    },
    select,
    reset,
    setObjectDistanceLimit(distanceLy) {
      if (!Number.isFinite(distanceLy) || distanceLy < 5 || distanceLy > 2000) return
      if (distanceLy === objectDistanceLimitLy) return
      objectDistanceLimitLy = distanceLy
      const nextGridSpacing = gridSpacingPc(distanceLy)
      const nextGridHalfSize = gridHalfSizeForDistance(distanceLy)
      if (nextGridSpacing !== gridSpacing || nextGridHalfSize !== gridHalfSize) {
        const previousGeometry = grid.geometry
        grid.geometry = makeGridGeometry(nextGridSpacing, nextGridHalfSize)
        previousGeometry.dispose()
        gridSpacing = nextGridSpacing
        gridHalfSize = nextGridHalfSize
        gridRadius.value = gridHalfSize
        container.dataset.gridSpacingPc = String(gridSpacing)
        container.dataset.gridHalfSizePc = String(gridHalfSize)
      }
      updatePresentation()
      if (home) fitHome()
      requestRender()
    },
    setObjectTypeFilter(types) {
      const nextTypes = new Set(types.filter((type) => OBJECT_TYPES.includes(type)))
      if (nextTypes.size === selectedTypes.size && [...nextTypes].every((type) => selectedTypes.has(type))) return
      selectedTypes = nextTypes
      updatePresentation()
      requestRender()
    },
    setMotionFrame(frame) {
      if ((frame !== 'galactic' && frame !== 'solar') || frame === motionFrame) return
      motionFrame = frame
      motions = stars.map((star) => displayMotionForStar(star, frame))
      yearlyMotionDistances = motions.map((motion) => motion ? motionTravelDistancePc(motion.velocity.length(), 1) : 0)
      invalidateProjection()
      ordinaryLayoutDirty = true
      requestRender()
    },
    setMotionYears(years) {
      if (!MOTION_YEAR_OPTIONS.includes(years) || years === motionYears) return
      motionYears = years
      ordinaryLayoutDirty = true
      requestRender()
    },
    setPowerSavingMode(enabled) {
      if (enabled === powerSavingMode) return
      powerSavingMode = enabled
      resetCadenceSamples()
      resize()
      requestRender()
    },
    setVisibility(observerId, limit) {
      const base = starsById.get(observerId)?.star
      if (!base || !Number.isFinite(limit) || limit < 0 || limit > 25) return
      if (base === visibilityBase && limit === magnitudeLimit) return
      visibilityBase = base
      magnitudeLimit = limit
      updatePresentation()
      requestRender()
    },
    setDistanceUnit(unit) {
      if (unit === distanceUnit) return
      distanceUnit = unit
      obstacleBoundsDirty = true
      measurementLabels.forEach((label) => {
        const { distancePc, suffix } = label.measurement!
        label.text.textContent = `${formatDistance(distancePc, unit)}${suffix}`
        label.width = 0
        label.height = 0
      })
      ordinaryLayoutDirty = true
      requestRender()
    },
    setGridVisible(visible) {
      if (visible === grid.visible) return
      grid.visible = visible
      axisLines.visible = visible
      requestRender()
    },
    setViewState(state) {
      const values = [...state.position, ...state.target]
      if (values.some((value) => !Number.isFinite(value))) return
      focusTransition = null
      controlsInteracting = false
      controlsSettling = false
      camera.position.fromArray(state.position)
      controls.target.fromArray(state.target)
      const distance = camera.position.distanceTo(controls.target)
      controls.maxDistance = Math.max(controls.maxDistance, distance * 1.05)
      camera.far = Math.max(camera.far, controls.maxDistance * 5)
      camera.updateProjectionMatrix()
      camera.lookAt(controls.target)
      controls.update()
      home = state.home
      invalidateProjection()
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
      arrowGeometry.dispose()
      arrowMaterial.dispose()
      dotTexture.dispose()
      haloTexture.dispose()
      renderer.dispose()
      canvas.remove()
      axisLayer.remove()
      labelLayer.remove()
      delete container.dataset.ready
      delete container.dataset.gridSpacingPc
      delete container.dataset.gridHalfSizePc
    },
  }
}
