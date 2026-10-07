import {
  BackSide, Box3, BoxGeometry, BufferGeometry, CanvasTexture, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedBufferGeometry, Line, LineBasicMaterial, LineDashedMaterial,
  LinearFilter, LineSegments, Matrix4, Mesh, Object3D, PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial,
  Quaternion, RepeatWrapping, Sphere, SRGBColorSpace, TextureLoader, Vector2, Vector3, Vector4, WebGLRenderer, type Texture,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import milkyWayImageUrl from './assets/milky-way.jpg'
import type { Star } from './catalog-model'
import { createStarAppearance } from './star-appearance'
import { apparentVisualMagnitude, displayMotionForStar, formatDistance, galacticToWorld, gridScaleForViewDistance, isMapVisibilityBase, LIGHT_YEARS_PER_PARSEC, starDisplayColor, type DistanceUnit, type GridScale, type MotionFrame, type MotionMode, type StarColorMode } from './astronomy'
import { EARTH_AXIS_DISPLAY_HALF_LENGTH_PC, EARTH_ORBIT_DISPLAY_RADIUS_PC, EARTH_ORBIT_MAX_VIEW_DISTANCE_PC, earthOrbitMarker, earthOrbitPoints } from './earth-orbit'
import { advanceFrameDeadline, effectiveDampingFactor, estimateRefreshRate, renderPixelRatio, targetRenderFps } from './render-scheduling'
import { centeredForegroundLabelBounds, chooseOrdinaryLabelPlacement, ordinaryLabelCandidates, overlaps, type LabelRect, type OrdinaryLabelPlacement } from './label-layout'
import { createNebulaLayer } from './nebula-layer'
import { createMolecularCloudLayer } from './molecular-cloud-layer'
import { createBubbleLayer } from './bubble-layer'
import { FILTER_KEYS, isFilterKey, type FilterKey } from './object-filter'
import { coincidentComponentGroups } from './star-systems'
import {
  GUIDE_DASH_PX, GUIDE_GAP_PX, MOTION_ARROW_DASH_PX, MOTION_ARROW_GAP_PX, MOTION_ARROW_HEAD_PX, MOTION_ARROW_STROKE_PX,
  MOTION_ARROW_TAIL_OFFSET_PX,
  STAR_DIAMETER_PX, ScreenSpaceGrid, TapGesture, budgetVisibleLabelIndices,
  compareMapLabelCandidates, focusProgress,
  guideDashScale, isObjectMapVisible, motionArrowGeometryInto, motionTravelDistancePc, pickProjectedStarAtScreenPoint,
  projectMotionDirectionInto, projectSelectedAnchor, projectWorldPointInto,
  retainBrightestCoincidentComponents, shouldRunOrdinaryLabelLayout, starBlocksLabels, starCoreWhiteStrength, starHaloDiameter, starHaloEmphasis, starHaloOpacity,
  type MotionArrowGeometry, type ProjectedPickable,
} from './viewer-primitives'

export interface StarViewer {
  getViewState(): ViewerViewState
  select(id: string | null, focus?: boolean): void
  setReference(referenceId: string): void
  setObserverView(enabled: boolean, anchorId?: string, rollRadians?: number): boolean
  rollObserverView(direction: 'counterclockwise' | 'center' | 'clockwise'): void
  reset(): void
  setCameraView(view: 'top' | 'side' | 'front'): void
  setGridVisible(visible: boolean): void
  setViewState(state: ViewerViewState): void
  setObjectDistanceLimit(distanceLy: number): void
  setObjectFilter(keys: readonly FilterKey[]): void
  setLabelLimit(limit: number): void
  setMotionArrowsVisible(visible: boolean): void
  setEarthOrbitDate(date: Date | null): void
  setMilkyWayVisible(visible: boolean): void
  setMotionFrame(frame: MotionFrame): void
  setMotionYears(years: MotionYears): void
  setFollowSelection(enabled: boolean): void
  setSimulationPlaying(playing: boolean): void
  setSimulationYears(years: number): void
  setPowerSavingMode(enabled: boolean): void
  setStarColorMode(mode: StarColorMode): void
  setVisibility(observerId: string, limit: number): void
  setDistanceUnit(unit: DistanceUnit): void
  dispose(): void
}

export const MOTION_YEAR_OPTIONS = [1_000, 5_000, 10_000, 25_000, 50_000] as const
export type MotionYears = typeof MOTION_YEAR_OPTIONS[number]
export const SIMULATION_YEAR_LIMIT = 500_000

export interface ViewerViewState {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  home: boolean
  observerRollRadians: number
}

interface ViewerOptions {
  onInteraction(): void
  onSelect(id: string | null): void
  onSelectedDistance?(distancePc: number | null): void
  onViewerDistance?(distancePc: number): void
  onGridScale?(scale: GridScale): void
  onStatus(message: string | null): void
  colorMode: StarColorMode
  earthOrbitDate?: Date | null
  milkyWayVisible?: boolean
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
    ? new LineDashedMaterial({ color, dashSize: GUIDE_DASH_PX, gapSize: GUIDE_GAP_PX, depthWrite: false })
    : new LineBasicMaterial({ color, depthWrite: false })
  const line = new Line(geometry, material)
  if (dashed) {
    line.computeLineDistances()
    line.userData.dashWorldLength = points.slice(1).reduce(
      (length, point, index) => length + point.distanceTo(points[index]!),
      0,
    )
  }
  line.frustumCulled = false
  return line
}

function updateLinePoints(line: Line, points: readonly Vector3[]): void {
  const positions = line.geometry.getAttribute('position')
  if (!positions || positions.count !== points.length) return
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!
    positions.setXYZ(index, point.x, point.y, point.z)
  }
  positions.needsUpdate = true
  if (!(line.material instanceof LineDashedMaterial)) return
  const distances = line.geometry.getAttribute('lineDistance')
  if (!distances || distances.count !== points.length) return
  let length = 0
  distances.setX(0, 0)
  for (let index = 1; index < points.length; index++) {
    length += points[index]!.distanceTo(points[index - 1]!)
    distances.setX(index, length)
  }
  distances.needsUpdate = true
  line.userData.dashWorldLength = length
}

function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden
}

function expandBoxByBubbleBounds(box: Box3, star: Pick<Star, 'bubble'>): void {
  if (!star.bubble) return
  const { x, y, z } = star.bubble.reported_bounds_pc
  for (const xPc of x) for (const yPc of y) for (const zPc of z) box.expandByPoint(new Vector3(xPc, zPc, -yPc))
}

function expandBoxByMolecularCloudBounds(box: Box3, star: Pick<Star, 'molecular_cloud'>): void {
  if (!star.molecular_cloud) return
  const { x, y, z } = star.molecular_cloud.bounds_pc
  for (const xPc of x) for (const yPc of y) for (const zPc of z) box.expandByPoint(new Vector3(xPc, zPc, -yPc))
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

function gridOpacityForDisplay(devicePixelRatio: number): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(0.9, 0.46 + Math.max(0, ratio - 1) * 0.22)
}

export function createStarViewer(container: HTMLElement, stars: readonly Star[], options: ViewerOptions): StarViewer {
  const sun = stars.find((star) => star.id === 'sun')
  if (!sun) throw new Error('A Sun reference is required.')
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
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
  controls.minPolarAngle = 0
  controls.maxPolarAngle = Math.PI - 0.08
  controls.rotateSpeed = 0.65
  controls.screenSpacePanning = true

  // OrbitControls captures camera.up only once, although Observer view can roll
  // the camera later. Keep its spherical frame aligned with the visible screen
  // up so mouse and touch drags remain screen-relative after a roll.
  const orbitFrame = controls as unknown as { _quat: Quaternion; _quatInverse: Quaternion }
  const worldUp = new Vector3(0, 1, 0)
  function setOrbitUp(up: Vector3): void {
    camera.up.copy(up).normalize()
    orbitFrame._quat.setFromUnitVectors(camera.up, worldUp)
    orbitFrame._quatInverse.copy(orbitFrame._quat).invert()
  }

  const pickable = stars.map((star) => ({ id: star.id, position: galacticToWorld(star) }))
  const basePositions = pickable.map(({ position }) => position.clone())
  let motions = stars.map((star) => displayMotionForStar(star))
  const starsById = new Map(stars.map((star, index) => [star.id, { star, index }]))
  const sunIndex = starsById.get(sun.id)!.index
  let referenceIndex = sunIndex
  const referenceDistancesLy = new Float64Array(stars.length)
  for (let index = 0; index < stars.length; index++) {
    referenceDistancesLy[index] = basePositions[index]!.distanceTo(basePositions[referenceIndex]!) * LIGHT_YEARS_PER_PARSEC
  }
  let starColorMode = options.colorMode
  const starColors = stars.map((star) => starDisplayColor(star, starColorMode))
  const starColorStyles = starColors.map((color) => color.getStyle())
  const starBounds = new Box3().setFromPoints(pickable.map((star) => star.position))
  stars.forEach((star) => {
    expandBoxByMolecularCloudBounds(starBounds, star)
    expandBoxByBubbleBounds(starBounds, star)
  })
  const catalogSphere = starBounds.getBoundingSphere(new Sphere())
  catalogSphere.radius = Math.max(catalogSphere.radius, 0.75)
  const homeDirection = new Vector3(-4.8, 3.8, -6.2).normalize()
  controls.minDistance = 0.08
  controls.maxDistance = Math.max(30, catalogSphere.radius * 24)
  camera.far = controls.maxDistance * 5

  // Sample the equirectangular panorama directly rather than asking Three.js
  // to expand it into six equally large cube faces. Besides saving GPU memory,
  // this preserves its exact Galactic orientation: the centre points toward
  // Galactic x, north is +world y, and increasing longitude points toward
  // -world z, matching galacticToWorld().
  const milkyWayUniforms = {
    map: { value: null as Texture | null },
    texelSize: { value: new Vector2() },
    intensity: { value: 0.12 },
    saturation: { value: starColorMode === 'exaggerated' ? 1.3 : 1 },
  }
  const milkyWayGeometry = new BoxGeometry(1, 1, 1)
  const milkyWayMaterial = new ShaderMaterial({
    uniforms: milkyWayUniforms,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 worldDirection;
      #include <common>
      void main() {
        worldDirection = transformDirection(position, modelMatrix);
        #include <begin_vertex>
        #include <project_vertex>
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec2 texelSize;
      uniform float intensity;
      uniform float saturation;
      varying vec3 worldDirection;
      #include <common>
      void main() {
        vec2 uv = equirectUv(normalize(worldDirection));
        vec3 panorama = texture2D(map, uv).rgb;
        // Reduce tiny star peaks without blurring the broad dust lanes.
        vec3 nearby = 0.25 * (
          texture2D(map, uv + vec2(texelSize.x, 0.0)).rgb +
          texture2D(map, uv - vec2(texelSize.x, 0.0)).rgb +
          texture2D(map, uv + vec2(0.0, texelSize.y)).rgb +
          texture2D(map, uv - vec2(0.0, texelSize.y)).rgb
        );
        panorama -= 0.25 * max(panorama - nearby, vec3(0.0));
        float luminance = dot(panorama, vec3(0.2126, 0.7152, 0.0722));
        vec3 skyColor = max(mix(vec3(luminance), panorama, saturation), vec3(0.0)) * intensity;
        // Keep empty sky transparent so the DOM axis captions behind the
        // canvas remain visible, while preserving the same color over black.
        float skyAlpha = max(max(skyColor.r, skyColor.g), skyColor.b);
        gl_FragColor = vec4(skyColor, skyAlpha);
        #include <colorspace_fragment>
      }
    `,
  })
  const milkyWaySky = new Mesh(milkyWayGeometry, milkyWayMaterial)
  milkyWaySky.frustumCulled = false
  milkyWaySky.renderOrder = -1
  milkyWaySky.visible = false
  milkyWaySky.onBeforeRender = (_renderer, _scene, activeCamera) => {
    milkyWaySky.matrixWorld.copyPosition(activeCamera.matrixWorld)
  }
  scene.add(milkyWaySky)
  let milkyWayVisible = options.milkyWayVisible ?? true
  let milkyWayLoading = false
  let milkyWayTexture: Texture | null = null

  const starViewDistance = { value: camera.position.distanceTo(controls.target) }
  const { dotTexture, haloTexture, starMaterial, haloMaterial } = createStarAppearance(starViewDistance)

  const initialEarthOrbitDate = options.earthOrbitDate === undefined ? new Date() : options.earthOrbitDate
  const initialEarthMarker = earthOrbitMarker(initialEarthOrbitDate ?? new Date())
  const earthOrbitGroup = new Group()
  earthOrbitGroup.name = 'earth-orbit-reference'
  earthOrbitGroup.position.copy(galacticToWorld(sun))
  const earthOrbitLine = new Line(
    new BufferGeometry().setFromPoints(earthOrbitPoints()),
    new LineBasicMaterial({ color: 0x5dbfea, transparent: true, opacity: 0.82, depthTest: false, depthWrite: false, toneMapped: false }),
  )
  earthOrbitLine.name = 'earth-orbit-line'
  earthOrbitLine.frustumCulled = false
  earthOrbitLine.renderOrder = 1

  const earthCanvas = document.createElement('canvas')
  earthCanvas.width = earthCanvas.height = 64
  const earthContext = earthCanvas.getContext('2d')!
  const earthGlow = earthContext.createRadialGradient(29, 26, 3, 32, 32, 31)
  earthGlow.addColorStop(0, '#d8fbffff')
  earthGlow.addColorStop(0.28, '#51c8ffff')
  earthGlow.addColorStop(0.62, '#176bbfff')
  earthGlow.addColorStop(0.78, '#0b376fcc')
  earthGlow.addColorStop(1, '#061c3a00')
  earthContext.fillStyle = earthGlow
  earthContext.fillRect(0, 0, 64, 64)
  earthContext.fillStyle = '#88b77dcc'
  earthContext.beginPath()
  earthContext.ellipse(25, 28, 5, 2.5, -0.35, 0, Math.PI * 2)
  earthContext.ellipse(37, 36, 4, 2, 0.55, 0, Math.PI * 2)
  earthContext.fill()
  const earthTexture = new CanvasTexture(earthCanvas)
  earthTexture.colorSpace = SRGBColorSpace
  const earthPointGeometry = new BufferGeometry().setFromPoints([initialEarthMarker.earthPosition])
  const earthPoint = new Points(
    earthPointGeometry,
    new PointsMaterial({
      color: 0xffffff, size: 11, sizeAttenuation: false, map: earthTexture, alphaTest: 0.05,
      transparent: true, depthTest: true, depthWrite: true, toneMapped: false,
    }),
  )
  earthPoint.name = 'earth-date-marker'
  earthPoint.frustumCulled = false
  earthPoint.renderOrder = 5
  const earthAxisGeometry = new BufferGeometry().setFromPoints([
    initialEarthMarker.earthPosition.clone().addScaledVector(initialEarthMarker.axisDirection, -EARTH_AXIS_DISPLAY_HALF_LENGTH_PC),
    initialEarthMarker.earthPosition.clone().addScaledVector(initialEarthMarker.axisDirection, EARTH_AXIS_DISPLAY_HALF_LENGTH_PC),
  ])
  const earthAxisLine = new Line(
    earthAxisGeometry,
    new LineBasicMaterial({ color: 0xe2f8ff, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false, toneMapped: false }),
  )
  earthAxisLine.name = 'earth-axis-line'
  earthAxisLine.frustumCulled = false
  earthAxisLine.renderOrder = 6
  earthOrbitGroup.add(earthOrbitLine, earthAxisLine, earthPoint)
  let earthOrbitEnabled = initialEarthOrbitDate !== null
  scene.add(earthOrbitGroup)
  const earthAxisStart = new Vector3()
  const earthAxisEnd = new Vector3()

  function updateEarthOrbitVisibility(): void {
    earthOrbitGroup.visible = earthOrbitEnabled
      && camera.position.distanceTo(earthOrbitGroup.position) <= EARTH_ORBIT_MAX_VIEW_DISTANCE_PC
    setData(container, 'earthOrbitVisible', String(earthOrbitGroup.visible))
  }

  function positionEarthMarker(date: Date, marker = earthOrbitMarker(date)): void {
    const pointPositions = earthPointGeometry.getAttribute('position')
    pointPositions.setXYZ(0, marker.earthPosition.x, marker.earthPosition.y, marker.earthPosition.z)
    pointPositions.needsUpdate = true
    const axisPositions = earthAxisGeometry.getAttribute('position')
    earthAxisStart.copy(marker.earthPosition).addScaledVector(marker.axisDirection, -EARTH_AXIS_DISPLAY_HALF_LENGTH_PC)
    earthAxisEnd.copy(marker.earthPosition).addScaledVector(marker.axisDirection, EARTH_AXIS_DISPLAY_HALF_LENGTH_PC)
    axisPositions.setXYZ(0, earthAxisStart.x, earthAxisStart.y, earthAxisStart.z)
    axisPositions.setXYZ(1, earthAxisEnd.x, earthAxisEnd.y, earthAxisEnd.z)
    axisPositions.needsUpdate = true
    container.dataset.earthOrbitDate = date.toISOString().slice(0, 10)
    container.dataset.earthEclipticLongitudeDeg = marker.eclipticLongitudeDeg.toFixed(2)
  }

  const starGeometry = new BufferGeometry()
  const starPositionAttribute = new Float32BufferAttribute(pickable.flatMap((star) => star.position.toArray()), 3).setUsage(DynamicDrawUsage)
  starGeometry.setAttribute('position', starPositionAttribute)
  const starColorAttribute = new Float32BufferAttribute(starColors.flatMap((color) => color.toArray()), 3)
  starGeometry.setAttribute('color', starColorAttribute)
  starGeometry.setIndex(stars.map((_, index) => index))
  const coreIndices = starGeometry.getIndex()!
  const coreDiameters = new Float32BufferAttribute(stars.map(() => STAR_DIAMETER_PX), 1)
  const coreFocuses = new Float32BufferAttribute(stars.map(() => 0), 1)
  const coreEmphases = new Float32BufferAttribute(stars.map(() => 0), 1)
  starGeometry.setAttribute('coreDiameter', coreDiameters)
  starGeometry.setAttribute('coreFocus', coreFocuses)
  starGeometry.setAttribute('coreEmphasis', coreEmphases)
  starGeometry.setAttribute('coreWhiteStrength', new Float32BufferAttribute(stars.map(starCoreWhiteStrength), 1))
  const starPoints = new Points(starGeometry, starMaterial)
  starPoints.frustumCulled = false
  starPoints.renderOrder = 2
  scene.add(starPoints)

  const haloGeometry = new BufferGeometry()
  // Shared with the cores so positions/colors occupy a single GPU buffer each.
  haloGeometry.setAttribute('position', starGeometry.getAttribute('position'))
  haloGeometry.setAttribute('color', starColorAttribute)
  // Reuse a fixed-capacity index buffer; zero-opacity halos should never reach
  // the rasterizer. The visible subset only changes with selection/settings.
  haloGeometry.setIndex(stars.map((_, index) => index))
  const haloIndices = haloGeometry.getIndex()!
  const coincidentGroups = coincidentComponentGroups(stars)
  const coreEnabled = new Uint8Array(stars.length)
  const nextCoreEnabled = new Uint8Array(stars.length)
  const haloEnabled = new Uint8Array(stars.length)
  const nextHaloEnabled = new Uint8Array(stars.length)
  const pointPositions = pickable.map(({ position }) => position)
  let pointVisibilityInitialized = false
  const haloOpacities = new Float32BufferAttribute(stars.map(() => 0), 1)
  const haloDiameters = new Float32BufferAttribute(stars.map(() => 30), 1)
  const haloEmphases = new Float32BufferAttribute(stars.map(() => 0), 1)
  haloGeometry.setAttribute('haloOpacity', haloOpacities)
  haloGeometry.setAttribute('haloDiameter', haloDiameters)
  haloGeometry.setAttribute('haloEmphasis', haloEmphases)
  const halos = new Points(haloGeometry, haloMaterial)
  halos.frustumCulled = false
  halos.renderOrder = 3
  scene.add(halos)

  const nebulaIndices = stars.flatMap((star, index) => star.nebula ? [index] : [])
  const isNebula = new Uint8Array(stars.length)
  for (const index of nebulaIndices) isNebula[index] = 1
  const nebulaLayer = nebulaIndices.length > 0
    ? createNebulaLayer(nebulaIndices.map((index) => stars[index]!), galacticToWorld(sun), starColorMode)
    : null
  if (nebulaLayer) scene.add(nebulaLayer.mesh)
  // Sky-plane picking radius in pc; the volume center alone is too small a target.
  const nebulaPickRadii = nebulaIndices.map((index) => {
    const [, major, minor] = stars[index]!.nebula!.shape.semi_axes_pc
    return 0.6 * Math.max(major, minor)
  })
  const molecularCloudIndices = stars.flatMap((star, index) => star.molecular_cloud ? [index] : [])
  const isMolecularCloud = new Uint8Array(stars.length)
  for (const index of molecularCloudIndices) isMolecularCloud[index] = 1
  const molecularCloudLayer = molecularCloudIndices.length > 0
    ? createMolecularCloudLayer(molecularCloudIndices.map((index) => stars[index]!), starColorMode)
    : null
  if (molecularCloudLayer) scene.add(molecularCloudLayer.root)
  const molecularCloudPickRadii = molecularCloudIndices.map((index) => stars[index]!.molecular_cloud!.equivalent_radius_pc)
  const bubbleIndices = stars.flatMap((star, index) => star.bubble ? [index] : [])
  const isBubble = new Uint8Array(stars.length)
  for (const index of bubbleIndices) isBubble[index] = 1
  const bubbleLayer = bubbleIndices.length > 0
    ? createBubbleLayer(bubbleIndices.map((index) => stars[index]!), starColorMode)
    : null
  if (bubbleLayer) scene.add(bubbleLayer.mesh)

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

  function makeGridGeometry(spacingPc: number, halfSizePc: number): BufferGeometry {
    const limit = Math.floor(halfSizePc / spacingPc + 1e-9)
    const positions: number[] = []
    const colors: number[] = []
    const center = new Color(0x756d65)
    const ordinary = new Color(0x4a4642)
    for (let index = -limit; index <= limit; index++) {
      const offset = index * spacingPc
      positions.push(-halfSizePc, 0, offset, halfSizePc, 0, offset)
      positions.push(offset, 0, -halfSizePc, offset, 0, halfSizePc)
      const color = index === 0 ? center : ordinary
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return geometry
  }
  let gridScale = gridScaleForViewDistance(0, 'pc')
  let gridSpacing = gridScale.spacingPc
  let gridHalfSize = gridScale.halfSizePc
  const gridOpacity = { value: gridOpacityForDisplay(window.devicePixelRatio) }
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
  const origin = basePositions[referenceIndex]!.clone()
  grid.position.copy(origin)
  scene.add(grid)
  container.dataset.gridSpacingPc = String(gridSpacing)
  container.dataset.gridHalfSizePc = String(gridHalfSize)
  options.onGridScale?.(gridScale)
  container.dataset.referenceId = sun.id
  const axisLength = Math.max(1.2, catalogSphere.radius)
  const axes = [
    { offset: new Vector3(axisLength, 0, 0), position: origin.clone().add(new Vector3(axisLength, 0, 0)), text: '+X', color: 0x8d786f },
    { offset: new Vector3(0, 0, -axisLength), position: origin.clone().add(new Vector3(0, 0, -axisLength)), text: '+Y', color: 0x9c8976 },
    { offset: new Vector3(0, axisLength, 0), position: origin.clone().add(new Vector3(0, axisLength, 0)), text: '+Z north', color: 0x899ca3 },
  ]
  const axisGeometry = new BufferGeometry().setFromPoints(axes.flatMap((axis) => [new Vector3(), axis.offset]))
  axisGeometry.setAttribute('color', new Float32BufferAttribute(axes.flatMap((axis) => {
    const color = new Color(axis.color).toArray()
    return [...color, ...color]
  }), 3))
  const axisMaterial = new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false,
  })
  const axisLines = new LineSegments(axisGeometry, axisMaterial)
  axisLines.position.copy(origin)
  scene.add(axisLines)

  const axisLayer = document.createElement('div')
  axisLayer.className = 'projected-axes'
  axisLayer.setAttribute('aria-hidden', 'true')
  container.append(axisLayer)
  const labelLayer = document.createElement('div')
  labelLayer.className = 'projected-labels'
  labelLayer.setAttribute('aria-hidden', 'true')
  if (bubbleLayer) labelLayer.dataset.bubbleTriangleCount = String(bubbleLayer.triangleCount())
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
  const guideDashStart = new Vector3()
  const guideDashEnd = new Vector3()

  function updateGuideDashScales(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const viewportDiagonal = Math.hypot(width, height)
    for (const object of guides.children) {
      if (!(object instanceof Line) || !(object.material instanceof LineDashedMaterial)) continue
      const positions = object.geometry.getAttribute('position')
      if (!positions || positions.count < 2) continue
      guideDashStart.fromBufferAttribute(positions, 0).project(camera)
      guideDashEnd.fromBufferAttribute(positions, positions.count - 1).project(camera)
      const projectedLength = Math.hypot(
        (guideDashEnd.x - guideDashStart.x) * width / 2,
        (guideDashEnd.y - guideDashStart.y) * height / 2,
      )
      object.material.scale = guideDashScale(
        object.userData.dashWorldLength as number,
        projectedLength,
        viewportDiagonal,
      )
    }
  }
  let measurementLabels: MapLabel[] = []
  let selectionDistanceLine: Line | null = null
  let selectionPlaneLine: Line | null = null
  let selectionHeightLine: Line | null = null
  let selectionFootMarker: Line | null = null
  let selectionDistanceLabel: MapLabel | null = null
  const selectionDistancePoints = [new Vector3(), new Vector3()]
  const selectionPlanePoints = [new Vector3(), new Vector3()]
  const selectionHeightPoints = [new Vector3(), new Vector3()]
  const selectionMarkerPoints = Array.from({ length: 5 }, () => new Vector3())
  const selectionMidpoint = new Vector3()
  let lastSelectionDistanceUpdate = -Infinity
  let selectedId: string | null = null
  let visibilityBase = sun
  let magnitudeLimit = 7
  let objectDistanceLimitLy = 100
  let visibleKeys = new Set<FilterKey>(FILTER_KEYS)
  let labelLimit = 40
  let motionArrowsVisible = true
  let motionFrame: MotionFrame = 'galactic'
  let motionYears: MotionYears = 1_000
  let simulationYears = 0
  let simulationPlaying = false
  let followSelection = false
  let observerViewEnabled = false
  let observerViewAnchorIndex: number | null = null
  let followTarget: 'star' | 'distance' = 'distance'
  const followAnchor = new Vector3()
  const followCurrent = new Vector3()
  const followDelta = new Vector3()
  const observerDirection = new Vector3()
  const observerDelta = new Vector3()
  const observerScreenUp = new Vector3()
  const observerZeroRollUp = new Vector3()
  const observerViewBackward = new Vector3()
  const OBSERVER_ORBIT_RADIUS_PC = 1e-6
  const OBSERVER_ROLL_STEP = Math.PI / 12
  let observerRollRadians = 0
  let savedOrbitSettings: {
    enablePan: boolean
    enableZoom: boolean
    minDistance: number
    maxDistance: number
    minPolarAngle: number
    maxPolarAngle: number
  } | null = null
  let distanceUnit: DistanceUnit = 'pc'
  const tiers: Array<'base' | 'eligible' | 'background'> = stars.map(() => 'background')
  const mapVisible = new Uint8Array(stars.length)
  const apparentMagnitudes = new Float64Array(stars.length)
  let rankedBaseId = ''
  let rankedSelection: string | null | undefined
  let rankedCandidates: Array<{ index: number; priority: number; magnitude: number }> = []
  let rankedNameGroups: Array<{ priority: number; magnitude: number; indices: number[] }> = []
  // Frame-scoped label layout containers, reused by updateLabels() so camera
  // motion frames don't churn garbage. ordinaryGroups is derived from
  // rankedNameGroups (which is replaced whenever selection changes).
  let ordinaryGroupSource: typeof rankedNameGroups | null = null
  const ordinaryGroups: Array<{ indices: number[] }> = []
  const budgetedNameIndices = new Set<number>()
  const ordinaryNameIndices = new Set<number>()
  const committedOrdinaryNameIndices = new Set<number>()
  const starLabels: MapLabel[] = []
  const otherStarLabels: MapLabel[] = []
  const orderedLabels: MapLabel[] = []
  const measurementPlacements = new Map<MapLabel, LabelRect | null>()
  const selectedLabelObstacles: LabelRect[] = []
  let yearlyMotionDistances = motions.map((motion) => motion ? motionTravelDistancePc(motion.velocity.length(), 1) : 0)
  const parsecsPerKmsYear = motionTravelDistancePc(1, 1)
  let yearlyMotionVectors = motions.map((motion) => motion ? motion.velocity.clone().multiplyScalar(parsecsPerKmsYear) : null)
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
  let lastViewerDistanceReport = 0
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
  let obstacleBounds: Array<{ bounds: DOMRect; blocksSelected: boolean }> = []
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
  // Built lazily on pointer picks rather than on every projected frame.
  const projectionGrid = new ScreenSpaceGrid<CachedProjection>()
  let projectionGridDirty = true
  const pickRect: LabelRect = { left: 0, top: 0, right: 0, bottom: 0 }
  // Label avoidance grids, cleared and refilled in place by updateLabels().
  const blocked = new ScreenSpaceGrid<LabelRect>()
  const starObstacles = new ScreenSpaceGrid<{ depth: number; bounds: LabelRect }>()
  const starObstacleEntries = stars.map(() => ({ depth: 0, bounds: { left: 0, top: 0, right: 0, bottom: 0 } }))
  const axisProjection = { x: 0, y: 0, depth: 0 }
  const axisClip = new Vector4()
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

  function positionReferenceFrame(): void {
    const reference = stars[referenceIndex]!
    origin.copy(basePositions[referenceIndex]!)
    grid.position.copy(origin)
    axisLines.position.copy(origin)
    for (const axis of axes) axis.position.copy(origin).add(axis.offset)
    container.dataset.referenceId = reference.id
    canvas.setAttribute('aria-label', `${reference.name}-centered 3D nearby-object map`)
    obstacleBoundsDirty = true
    ordinaryLayoutDirty = true
    invalidateProjection()
  }

  function updateGridScale(distancePc: number): void {
    const next = gridScaleForViewDistance(distancePc, distanceUnit)
    if (next.spacingPc === gridSpacing && next.halfSizePc === gridHalfSize) return
    const previousGeometry = grid.geometry
    grid.geometry = makeGridGeometry(next.spacingPc, next.halfSizePc)
    previousGeometry.dispose()
    gridScale = next
    gridSpacing = next.spacingPc
    gridHalfSize = next.halfSizePc
    gridRadius.value = gridHalfSize
    container.dataset.gridSpacingPc = String(gridSpacing)
    container.dataset.gridHalfSizePc = String(gridHalfSize)
    options.onGridScale?.(gridScale)
  }

  function configureObserverControls(enabled: boolean): void {
    if (enabled) {
      savedOrbitSettings = {
        enablePan: controls.enablePan,
        enableZoom: controls.enableZoom,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
      }
      controls.enablePan = false
      controls.enableZoom = false
      controls.minDistance = OBSERVER_ORBIT_RADIUS_PC
      controls.maxDistance = OBSERVER_ORBIT_RADIUS_PC
      controls.minPolarAngle = 0
      controls.maxPolarAngle = Math.PI
      return
    }
    if (!savedOrbitSettings) return
    controls.enablePan = savedOrbitSettings.enablePan
    controls.enableZoom = savedOrbitSettings.enableZoom
    controls.minDistance = savedOrbitSettings.minDistance
    controls.maxDistance = savedOrbitSettings.maxDistance
    controls.minPolarAngle = savedOrbitSettings.minPolarAngle
    controls.maxPolarAngle = savedOrbitSettings.maxPolarAngle
    savedOrbitSettings = null
  }

  function applyObserverRollFrame(): void {
    if (!observerViewEnabled || observerViewAnchorIndex === null) return
    observerViewBackward.subVectors(camera.position, controls.target).normalize()
    observerZeroRollUp.copy(worldUp).addScaledVector(observerViewBackward, -worldUp.dot(observerViewBackward))
    if (observerZeroRollUp.lengthSq() < 1e-12) {
      observerZeroRollUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
        .applyAxisAngle(observerViewBackward, -observerRollRadians)
    }
    observerZeroRollUp.normalize()
    observerScreenUp.copy(observerZeroRollUp).applyAxisAngle(observerViewBackward, observerRollRadians)
    setOrbitUp(observerScreenUp)
    camera.lookAt(controls.target)
    container.dataset.observerRollDegrees = String(Math.round(observerRollRadians * 180 / Math.PI))
    container.dataset.observerViewDirection = `${-observerViewBackward.x},${-observerViewBackward.y},${-observerViewBackward.z}`
    container.dataset.observerScreenUp = `${observerScreenUp.x},${observerScreenUp.y},${observerScreenUp.z}`
  }

  function applyObserverDirection(direction: Vector3): void {
    if (observerViewAnchorIndex === null) return
    const position = pickable[observerViewAnchorIndex]!.position
    controls.target.copy(position)
    camera.position.copy(position).addScaledVector(direction, -OBSERVER_ORBIT_RADIUS_PC)
    camera.lookAt(position)
    controls.update()
    home = false
    invalidateProjection()
  }

  function placeObserverCamera(index: number): void {
    observerDirection.subVectors(controls.target, camera.position)
    if (observerDirection.lengthSq() < 1e-18) observerDirection.copy(homeDirection).multiplyScalar(-1)
    else observerDirection.normalize()
    observerViewAnchorIndex = index
    applyObserverDirection(observerDirection)
  }

  function syncObserverCamera(): void {
    if (!observerViewEnabled || observerViewAnchorIndex === null) return
    const position = pickable[observerViewAnchorIndex]!.position
    observerDelta.subVectors(position, controls.target)
    camera.position.add(observerDelta)
    controls.target.copy(position)
    camera.lookAt(position)
    controls.update()
    invalidateProjection()
  }

  function setSelectionGuidePoints(referencePosition: Vector3, selectedPosition: Vector3): void {
    const footX = selectedPosition.x
    const footY = referencePosition.y
    const footZ = selectedPosition.z
    selectionDistancePoints[0]!.copy(referencePosition)
    selectionDistancePoints[1]!.copy(selectedPosition)
    selectionPlanePoints[0]!.copy(referencePosition)
    selectionPlanePoints[1]!.set(footX, footY, footZ)
    selectionHeightPoints[0]!.set(footX, footY, footZ)
    selectionHeightPoints[1]!.copy(selectedPosition)
    const markerSize = 0.05
    selectionMarkerPoints[0]!.set(footX - markerSize, footY, footZ - markerSize)
    selectionMarkerPoints[1]!.set(footX + markerSize, footY, footZ - markerSize)
    selectionMarkerPoints[2]!.set(footX + markerSize, footY, footZ + markerSize)
    selectionMarkerPoints[3]!.set(footX - markerSize, footY, footZ + markerSize)
    selectionMarkerPoints[4]!.copy(selectionMarkerPoints[0]!)
  }

  function captureFollowTarget(preferred?: 'star' | 'distance'): void {
    if (observerViewEnabled || !followSelection || selectedId === null) {
      delete container.dataset.followTarget
      return
    }
    const selectedIndex = starsById.get(selectedId)!.index
    const referencePosition = pickable[referenceIndex]!.position
    const selectedPosition = pickable[selectedIndex]!.position
    followCurrent.addVectors(referencePosition, selectedPosition).multiplyScalar(0.5)
    followTarget = selectedIndex === referenceIndex ? 'star' : preferred ?? (
      controls.target.distanceToSquared(selectedPosition) <= controls.target.distanceToSquared(followCurrent)
        ? 'star'
        : 'distance'
    )
    followAnchor.copy(followTarget === 'star' ? selectedPosition : followCurrent)
    container.dataset.followTarget = followTarget
  }

  function applySelectionFollow(): void {
    if (observerViewEnabled || !followSelection || selectedId === null) return
    const selectedIndex = starsById.get(selectedId)!.index
    const selectedPosition = pickable[selectedIndex]!.position
    if (followTarget === 'star') followCurrent.copy(selectedPosition)
    else followCurrent.addVectors(pickable[referenceIndex]!.position, selectedPosition).multiplyScalar(0.5)
    followDelta.subVectors(followCurrent, followAnchor)
    camera.position.add(followDelta)
    controls.target.add(followDelta)
    followAnchor.copy(followCurrent)
    home = false
  }

  function updateSelectionGuides(updateDistanceText = false): void {
    if (selectedId === null) {
      if (updateDistanceText) options.onSelectedDistance?.(null)
      return
    }
    const selectedIndex = starsById.get(selectedId)!.index
    if (selectedIndex === referenceIndex) {
      if (updateDistanceText) options.onSelectedDistance?.(0)
      return
    }
    const referencePosition = pickable[referenceIndex]!.position
    const selectedPosition = pickable[selectedIndex]!.position
    setSelectionGuidePoints(referencePosition, selectedPosition)
    const distance = referencePosition.distanceTo(selectedPosition)
    const planeDistance = Math.hypot(selectedPosition.x - referencePosition.x, selectedPosition.z - referencePosition.z)
    const height = Math.abs(selectedPosition.y - referencePosition.y)
    if (selectionDistanceLine === null) {
      if (updateDistanceText) options.onSelectedDistance?.(distance)
      return
    }
    updateLinePoints(selectionDistanceLine, selectionDistancePoints)
    updateLinePoints(selectionPlaneLine!, selectionPlanePoints)
    updateLinePoints(selectionHeightLine!, selectionHeightPoints)
    updateLinePoints(selectionFootMarker!, selectionMarkerPoints)
    selectionDistanceLine.visible = distance > 1e-9
    selectionPlaneLine!.visible = planeDistance > 1e-9
    selectionHeightLine!.visible = height > 1e-9
    selectionFootMarker!.visible = height > 1e-9
    if (selectionDistanceLabel === null) return
    selectionDistanceLabel.position.copy(referencePosition).lerp(selectedPosition, 0.5)
    if (!updateDistanceText) return
    selectionDistanceLabel.measurement!.distancePc = distance
    selectionDistanceLabel.text.textContent = formatDistance(distance, distanceUnit)
    selectionDistanceLabel.width = 0
    selectionDistanceLabel.height = 0
    options.onSelectedDistance?.(distance)
    ordinaryLayoutDirty = true
  }

  function applySimulationYears(): void {
    for (let index = 0; index < pickable.length; index++) {
      const position = pickable[index]!.position.copy(basePositions[index]!)
      const yearlyMotion = yearlyMotionVectors[index]
      if (yearlyMotion) position.addScaledVector(yearlyMotion, simulationYears)
      starPositionAttribute.setXYZ(index, position.x, position.y, position.z)
    }
    starPositionAttribute.needsUpdate = true
    updatePointVisibility()
    earthOrbitGroup.position.copy(pickable[sunIndex]!.position)
    container.dataset.simulationYears = String(simulationYears)
    syncObserverCamera()
    applySelectionFollow()
    const time = performance.now()
    const updateDistanceText = !simulationPlaying || time - lastSelectionDistanceUpdate >= 250
    updateSelectionGuides(updateDistanceText)
    if (updateDistanceText) lastSelectionDistanceUpdate = time
    guides.visible = !observerViewEnabled && selectedId !== null && mapVisible[starsById.get(selectedId)!.index] === 1
    if (!simulationPlaying) ordinaryLayoutDirty = true
    invalidateProjection()
    requestRender()
  }

  // Blurred text shadows repaint every moving label; restore them on the settled frame.
  let labelsMoving = false
  function setLabelsMoving(moving: boolean): void {
    if (moving === labelsMoving) return
    labelsMoving = moving
    labelLayer.classList.toggle('is-moving', moving)
    axisLayer.classList.toggle('is-moving', moving)
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
    label.anchor.dataset.visibility = tiers[index]
    label.anchor.dataset.haloVisible = String(haloEnabled[index] === 1)
    label.anchor.dataset.coreVisible = String(coreEnabled[index] === 1)
    label.anchor.dataset.mapVisible = String(mapVisible[index] === 1)
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
        setData(label.anchor, 'visibility', tiers[index]!)
        setData(label.anchor, 'mapVisible', String(mapVisible[index] === 1))
        setData(label.anchor, 'haloVisible', String(haloEnabled[index] === 1))
        setData(label.anchor, 'coreVisible', String(coreEnabled[index] === 1))
        label.anchor.classList.toggle('is-selected', stars[index]!.id === selectedId)
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

  function loadMilkyWay(): void {
    if (milkyWayTexture || milkyWayLoading || disposed) return
    milkyWayLoading = true
    new TextureLoader().load(milkyWayImageUrl, (texture) => {
      milkyWayLoading = false
      if (disposed) {
        texture.dispose()
        return
      }
      texture.colorSpace = SRGBColorSpace
      texture.wrapS = RepeatWrapping
      texture.generateMipmaps = false
      texture.minFilter = LinearFilter
      texture.magFilter = LinearFilter
      milkyWayTexture = texture
      milkyWayUniforms.map.value = texture
      const textureWidth = Math.min(texture.image.width, renderer.capabilities.maxTextureSize)
      const textureHeight = texture.image.height * textureWidth / texture.image.width
      milkyWayUniforms.texelSize.value.set(1 / textureWidth, 1 / textureHeight)
      milkyWaySky.visible = milkyWayVisible
      container.dataset.milkyWayReady = 'true'
      requestRender()
    }, undefined, () => {
      milkyWayLoading = false
      if (!disposed) container.dataset.milkyWayReady = 'error'
    })
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
        // A shared-position component has no usable viewing distance. Its
        // intrinsic display magnitude also keeps its name in the label budget.
        apparentMagnitudes[index] = (distancePc === 0
          ? star.absolute_mag
          : apparentVisualMagnitude(star.absolute_mag, distancePc)) ?? Infinity
      })
    }
    if (rankingChanged) {
      rankedCandidates = stars.map((star, index) => ({
        index,
        priority: star.id === selectedId ? 0 : isNebula[index] || isMolecularCloud[index] || isBubble[index] ? 1 : 2,
        magnitude: apparentMagnitudes[index]!,
      })).sort(compareMapLabelCandidates)
      rankedBaseId = visibilityBase.id
      rankedSelection = selectedId
    }
    const observerIndex = observerViewEnabled ? observerViewAnchorIndex ?? -1 : -1
    stars.forEach((star, index) => {
      const magnitude = apparentMagnitudes[index]!
      // Extended nebulae have no point magnitude; their names stay eligible.
      const tier = isMapVisibilityBase(star, visibilityBase) ? 'base' : isNebula[index] || isMolecularCloud[index] || isBubble[index] || magnitude <= magnitudeLimit ? 'eligible' : 'background'
      const visible = isObjectMapVisible(
        star,
        visibleKeys,
        selectedId,
        visibilityBase.id,
        referenceDistancesLy[index]!,
        objectDistanceLimitLy,
      )
      tiers[index] = tier
      mapVisible[index] = visible ? 1 : 0
      const haloMagnitude = tier === 'base' ? star.absolute_mag : magnitude
      const haloEmphasis = starHaloEmphasis(haloMagnitude)
      coreDiameters.setX(index, tier === 'background' ? 3 : STAR_DIAMETER_PX)
      coreFocuses.setX(index, star.id === visibilityBase.id || star.id === selectedId ? 1 : 0)
      coreEmphases.setX(index, haloEmphasis)
      haloOpacities.setX(index, tier === 'background' ? 0 : starHaloOpacity(haloMagnitude, star.id === selectedId))
      haloDiameters.setX(index, starHaloDiameter(haloMagnitude))
      haloEmphases.setX(index, haloEmphasis)
    })
    if (nebulaLayer) {
      nebulaLayer.setVisible(nebulaIndices.map((index) => mapVisible[index] === 1 && index !== observerIndex))
      labelLayer.dataset.nebulaPuffCount = String(nebulaLayer.instanceCount())
    }
    if (molecularCloudLayer) {
      molecularCloudLayer.setVisible(molecularCloudIndices.map((index) => mapVisible[index] === 1 && index !== observerIndex))
      labelLayer.dataset.molecularCloudPuffCount = String(molecularCloudLayer.instanceCount())
    }
    if (bubbleLayer) {
      const bubbleVisibility = bubbleIndices.map((index) => mapVisible[index] === 1 && index !== observerIndex)
      bubbleLayer.setVisible(bubbleVisibility)
      labelLayer.dataset.bubbleVisibleCount = String(bubbleVisibility.filter(Boolean).length)
    }
    coreDiameters.needsUpdate = true
    coreFocuses.needsUpdate = true
    coreEmphases.needsUpdate = true
    haloOpacities.needsUpdate = true
    haloDiameters.needsUpdate = true
    haloEmphases.needsUpdate = true
    updatePointVisibility()
    guides.visible = !observerViewEnabled && selectedId !== null && mapVisible[starsById.get(selectedId)!.index] === 1
    rankedNameGroups = []
    for (const candidate of rankedCandidates) {
      if (candidate.index === observerIndex || !mapVisible[candidate.index] || tiers[candidate.index] === 'background') continue
      const group = rankedNameGroups.at(-1)
      if (!group || candidate.priority !== group.priority || candidate.magnitude !== group.magnitude) {
        rankedNameGroups.push({ priority: candidate.priority, magnitude: candidate.magnitude, indices: [candidate.index] })
      } else group.indices.push(candidate.index)
    }
    invalidateProjection()
  }

  function updatePointVisibility(): void {
    const observerIndex = observerViewEnabled ? observerViewAnchorIndex ?? -1 : -1
    for (let index = 0; index < stars.length; index++) {
      nextCoreEnabled[index] = mapVisible[index] && index !== observerIndex
        && !isNebula[index] && !isMolecularCloud[index] && !isBubble[index] ? 1 : 0
    }
    retainBrightestCoincidentComponents(coincidentGroups, pointPositions, nextCoreEnabled)
    for (let index = 0; index < stars.length; index++) {
      nextHaloEnabled[index] = nextCoreEnabled[index] && tiers[index] !== 'background' ? 1 : 0
    }
    // Keep the index buffers on the GPU until drawable membership changes.
    if (!pointVisibilityInitialized || nextCoreEnabled.some((enabled, index) => enabled !== coreEnabled[index])) {
      coreEnabled.set(nextCoreEnabled)
      let count = 0
      for (let index = 0; index < stars.length; index++) {
        if (coreEnabled[index]) coreIndices.setX(count++, index)
      }
      coreIndices.needsUpdate = true
      starGeometry.setDrawRange(0, count)
      setData(labelLayer, 'coreCount', String(count))
    }
    if (!pointVisibilityInitialized || nextHaloEnabled.some((enabled, index) => enabled !== haloEnabled[index])) {
      haloEnabled.set(nextHaloEnabled)
      let count = 0
      for (let index = 0; index < stars.length; index++) {
        if (haloEnabled[index]) haloIndices.setX(count++, index)
      }
      haloIndices.needsUpdate = true
      haloGeometry.setDrawRange(0, count)
      setData(labelLayer, 'haloCount', String(count))
    }
    pointVisibilityInitialized = true
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
    projectedPickables.length = 0
    projectionGridDirty = true
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const observerIndex = observerViewEnabled ? observerViewAnchorIndex ?? -1 : -1
    for (const projected of projections) {
      projected.visible = false
      projected.motionVisible = false
      projected.motionScale = 0
      projected.motionDepthScale = 0
      const index = projected.index
      if (index === observerIndex || !mapVisible[index]) continue
      const position = pickable[index]!.position
      if (!projectWorldPointInto(position, viewProjection, viewport, clipPoint, projected)) continue
      projected.visible = true
      // Unresolved companions remain available through their card and list,
      // while the shared scene point belongs to the brightest component.
      if (coreEnabled[index] || isNebula[index] || isMolecularCloud[index] || isBubble[index]) projectedPickables.push(projected)
      if (!motionArrowsVisible) continue
      const motion = motions[index]
      if (!motion || tiers[index] === 'background') continue
      projectMotionDirectionInto(position, motion.velocity, camera, viewport, clipPoint, viewPoint, viewVelocity, clipTangent, projected)
    }
    projectionDirty = false
  }

  function updateMotionArrows(): void {
    if (!motionArrowsVisible) {
      arrowCount = 0
      arrowGeometry.instanceCount = 0
      arrows.visible = false
      return
    }
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
    if (arrowCount > 0) {
      // Upload only the live instances instead of the full catalog-sized buffers.
      for (const [attribute, size] of [[arrowPlacements, 4], [arrowShapes, 2], [arrowColors, 4]] as const) {
        attribute.clearUpdateRanges()
        attribute.addUpdateRange(0, arrowCount * size)
        attribute.needsUpdate = true
      }
    }
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
    const selectedIndex = selectedId ? starsById.get(selectedId)!.index : -1
    const selectedLabelVisible = selectedIndex >= 0 && (!observerViewEnabled || selectedIndex !== observerViewAnchorIndex)
    const ordinaryBudget = Math.max(0, labelLimit - (selectedLabelVisible && labelLimit > 0 ? 1 : 0))
    if (ordinaryGroupSource !== rankedNameGroups) {
      ordinaryGroupSource = rankedNameGroups
      ordinaryGroups.length = 0
      for (const group of rankedNameGroups) {
        const indices = group.indices.filter((index) => index !== selectedIndex)
        if (indices.length > 0) ordinaryGroups.push({ indices })
      }
    }
    budgetedNameIndices.clear()
    ordinaryNameIndices.clear()
    for (const index of budgetVisibleLabelIndices(ordinaryGroups, projections, ordinaryBudget)) {
      ordinaryNameIndices.add(index)
      budgetedNameIndices.add(index)
    }
    if (selectedLabelVisible) budgetedNameIndices.add(selectedIndex)
    const labelsChanged = syncStarLabels(budgetedNameIndices, starLabels)
    setData(labelLayer, 'nameBudget', String(labelLimit))
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
    // Every active star label is budgeted; a zero limit keeps only a visible selected anchor.
    if (labelLimit > 0) {
      for (const label of starLabels) if (label.width === 0 || label.height === 0) labelsToMeasure.push(label)
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
        .map((element) => ({
          bounds: element.getBoundingClientRect(),
          blocksSelected: element.matches('.selected-object, .scene-toolbar, .time-controls, .control-dock, .scene-legend, .visibility-observer'),
        }))
      obstacleBoundsDirty = false
    }
    const obstacles = obstacleBounds
    const layoutOrdinaryLabels = shouldRunOrdinaryLabelLayout(
      time,
      lastOrdinaryLayoutTime,
      controlsInteracting || controlsSettling || focusTransition !== null || simulationPlaying,
      ordinaryLayoutDirty || labelsChanged || labelSizesChanged || obstacleBoundsChanged ||
        !sameIndexSet(ordinaryNameIndices, committedOrdinaryNameIndices),
    )
    blocked.clear()
    for (const obstacle of obstacles) blocked.insert(obstacle.bounds, obstacle.bounds)
    measurementPlacements.clear()
    const measurementStart = projections[referenceIndex]!
    const measurementEnd = selectedIndex >= 0 ? projections[selectedIndex]! : undefined
    const measurementVisible = measurementStart.visible && measurementEnd?.visible === true
    const measurementCenterX = measurementVisible ? (measurementStart.x + measurementEnd!.x) / 2 : 0
    const measurementCenterY = measurementVisible ? (measurementStart.y + measurementEnd!.y) / 2 : 0
    for (const label of measurementLabels) {
      measurementPlacements.set(label, measurementVisible ? centeredForegroundLabelBounds(
        { x: measurementCenterX, y: measurementCenterY }, label.width, label.height, viewport,
      ) : null)
    }
    selectedLabelObstacles.length = 0
    for (const obstacle of obstacles) {
      if (obstacle.blocksSelected) selectedLabelObstacles.push(obstacle.bounds)
    }
    for (const placement of measurementPlacements.values()) {
      if (placement !== null) selectedLabelObstacles.push(placement)
    }
    for (const label of axisLabels) {
      const visible = grid.visible && projectWorldPointInto(label.position, viewProjection, viewport, axisClip, axisProjection)
      setHidden(label.anchor, !visible)
      if (!visible) continue
      const projected = axisProjection
      setTransform(label.anchor, `translate(${projected.x - viewport.left}px, ${projected.y - viewport.top}px)`)
      const { width, height } = label
      setTransform(label.text, `translate(18px, ${-height / 2}px)`)
      const rectangle = { left: projected.x + 18, right: projected.x + 18 + width, top: projected.y - height / 2, bottom: projected.y + height / 2 }
      setHidden(label.text, rectangle.left < viewport.left + 12 || rectangle.right > viewport.right - 12 ||
        rectangle.top < viewport.top + 12 || rectangle.bottom > viewport.bottom - 12 ||
        blocked.queryAny(rectangle, (obstacle) => overlaps(rectangle, obstacle)))
    }
    // Star/arrow obstacles only constrain ordinary names, so skip them on throttled frames.
    if (layoutOrdinaryLabels) {
      starObstacles.clear()
      const radius = STAR_DIAMETER_PX / 2
      for (const projected of projectedPickables) {
        if (isNebula[projected.index] || isMolecularCloud[projected.index] || isBubble[projected.index] || !starBlocksLabels(tiers[projected.index]!)) continue
        const obstacle = starObstacleEntries[projected.index]!
        obstacle.depth = projected.depth
        obstacle.bounds.left = projected.x - radius
        obstacle.bounds.right = projected.x + radius
        obstacle.bounds.top = projected.y - radius
        obstacle.bounds.bottom = projected.y + radius
        starObstacles.insert(obstacle.bounds, obstacle)
      }
      for (let slot = 0; slot < arrowCount; slot++) starObstacles.insert(arrowObstacles[slot]!.bounds, arrowObstacles[slot]!)
    }
    const selectedLabel = selectedIndex >= 0 ? activeStarLabels.get(selectedIndex) : undefined
    const selectedLabelProjected = selectedLabel !== undefined && projections[selectedIndex]!.visible
    otherStarLabels.length = 0
    for (const label of starLabels) if (label !== selectedLabel) otherStarLabels.push(label)
    otherStarLabels.sort((first, second) => projections[first.index!]!.depth - projections[second.index!]!.depth)
    if (selectedLabel && selectedLabel.anchor.style.zIndex !== '1') selectedLabel.anchor.style.zIndex = '1'
    const zOffset = selectedLabel ? 2 : 1
    for (let order = 0; order < otherStarLabels.length; order++) {
      const anchor = otherStarLabels[order]!.anchor
      const zIndex = `${-order - zOffset}`
      if (anchor.style.zIndex !== zIndex) anchor.style.zIndex = zIndex
    }
    orderedLabels.length = 0
    if (selectedLabel && selectedLabelProjected) orderedLabels.push(selectedLabel)
    for (const label of measurementLabels) orderedLabels.push(label)
    for (const label of otherStarLabels) orderedLabels.push(label)
    if (selectedLabel && !selectedLabelProjected) orderedLabels.push(selectedLabel)
    for (const label of orderedLabels) {
      if (label.index !== undefined && !mapVisible[label.index]) {
        setHidden(label.anchor, true)
        continue
      }
      if (label.measurement) {
        const placement = measurementPlacements.get(label) ?? null
        setHidden(label.anchor, !placement)
        if (!placement) continue
        setTransform(label.anchor, `translate(${measurementCenterX - viewport.left}px, ${measurementCenterY - viewport.top}px)`)
        setTransform(label.text, `translate(${placement.left - measurementCenterX}px, ${placement.top - measurementCenterY}px)`)
        setHidden(label.text, false)
        blocked.insert(placement, placement)
        continue
      }
      const cached = projections[label.index!]!
      const projected = cached.visible ? cached : null
      const foreground = label === selectedLabel
      const clippedForeground = foreground && !projected
      const anchor = projected ?? (foreground ? projectSelectedAnchor(label.position, camera, viewport) : null)
      setHidden(label.anchor, !anchor)
      if (label.anchor.classList.contains('is-clipped') !== !projected) label.anchor.classList.toggle('is-clipped', !projected)
      if (!anchor) continue
      setTransform(label.anchor, `translate(${anchor.x - viewport.left}px, ${anchor.y - viewport.top}px)`)
      if (labelLimit === 0 || tiers[label.index!] === 'background') {
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
            obstacle.depth <= projected!.depth && overlaps(rectangle, obstacle.bounds, gap)),
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
    molecularCloudLayer?.setSelected(id)
    bubbleLayer?.setSelected(id)
    obstacleBoundsDirty = true
    if (star && !observerViewEnabled) visibilityBase = star
    updatePresentation()
    disposeGeometry(guides)
    guides.clear()
    measurementLabels.forEach((label) => label.anchor.remove())
    measurementLabels = []
    selectionDistanceLine = null
    selectionPlaneLine = null
    selectionHeightLine = null
    selectionFootMarker = null
    selectionDistanceLabel = null
    // Only the selected name's heavier style changes a label size.
    for (const changedId of [previousSelectedId, id]) {
      if (changedId !== null) invalidateStarLabelSize(starsById.get(changedId)!.index)
    }
    requestRender()
    if (!star) {
      options.onSelectedDistance?.(null)
      captureFollowTarget()
      return
    }
    const selectedIndex = starsById.get(star.id)!.index
    if (selectedIndex !== referenceIndex) {
      const referencePosition = pickable[referenceIndex]!.position
      const selectedPosition = pickable[selectedIndex]!.position
      setSelectionGuidePoints(referencePosition, selectedPosition)
      const distance = referencePosition.distanceTo(selectedPosition)
      if (!observerViewEnabled) {
        selectionDistanceLine = lineBetween(selectionDistancePoints, 0xe7a05b)
        selectionPlaneLine = lineBetween(selectionPlanePoints, 0x79634d, true)
        selectionHeightLine = lineBetween(selectionHeightPoints, 0xe7a05b, true)
        selectionFootMarker = lineBetween(selectionMarkerPoints, 0xe7a05b)
        guides.add(selectionDistanceLine, selectionPlaneLine, selectionHeightLine, selectionFootMarker)
        selectionDistanceLabel = makeMeasurement(
          selectionMidpoint.copy(referencePosition).lerp(selectedPosition, 0.5),
          distance,
          'dimension-label distance-label',
        )
        measurementLabels.push(selectionDistanceLabel)
      }
      updateSelectionGuides(true)
      lastSelectionDistanceUpdate = performance.now()
    } else options.onSelectedDistance?.(0)
    if (observerViewEnabled) {
      resize()
      captureFollowTarget()
      return
    }
    if (focus) {
      const position = camera.position.clone()
      const from = controls.target.clone()
      const to = pickable[starsById.get(star.id)!.index]!.position.clone()
      applyFocusTarget(from, position)
      if (reducedMotion.matches) applyFocusTarget(to, position)
      else focusTransition = { from, to, position, started: performance.now() }
      home = false
    }
    if (home && !focus) fitHome()
    else resize()
    captureFollowTarget(focus ? 'star' : undefined)
  }

  const homeBounds = new Box3()
  const homeSphere = new Sphere()
  function fitHome(): void {
    homeBounds.makeEmpty()
    pickable.forEach(({ position }, index) => {
      if (!mapVisible[index]) return
      homeBounds.expandByPoint(position)
      expandBoxByMolecularCloudBounds(homeBounds, stars[index]!)
      expandBoxByBubbleBounds(homeBounds, stars[index]!)
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

  function fitResetView(): void {
    homeBounds.makeEmpty()
    homeBounds.expandByPoint(pickable[referenceIndex]!.position)
    const selected = selectedId === null ? undefined : starsById.get(selectedId)
    if (selected && selected.index !== referenceIndex) {
      homeBounds.expandByPoint(pickable[selected.index]!.position)
      expandBoxByMolecularCloudBounds(homeBounds, selected.star)
      expandBoxByBubbleBounds(homeBounds, selected.star)
    }
    homeBounds.getBoundingSphere(homeSphere)
    let distance = 50 / LIGHT_YEARS_PER_PARSEC
    if (selected && selected.index !== referenceIndex) {
      const verticalAngle = camera.fov * Math.PI / 360
      const fitAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * camera.aspect))
      distance = Math.min(controls.maxDistance, Math.max(homeSphere.radius, 0.75) / Math.sin(fitAngle) * 1.6)
    }
    controls.target.copy(homeSphere.center)
    camera.position.copy(homeSphere.center).addScaledVector(homeDirection, distance)
    camera.lookAt(controls.target)
    controls.update()
    home = false
    captureFollowTarget('distance')
    invalidateProjection()
  }

  function setObserverView(enabled: boolean, anchorId = selectedId ?? undefined, rollRadians = 0): boolean {
    if (enabled === observerViewEnabled) return observerViewEnabled
    const anchor = enabled && anchorId ? starsById.get(anchorId) : undefined
    if (enabled && !anchor) return false
    observerRollRadians = 0
    observerViewEnabled = enabled
    observerViewAnchorIndex = anchor?.index ?? null
    setOrbitUp(worldUp)
    configureObserverControls(enabled)
    container.dataset.observerView = String(enabled)
    canvas.classList.toggle('is-observer-view', enabled)
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    if (anchor) visibilityBase = anchor.star
    select(selectedId, false)
    if (anchor) {
      placeObserverCamera(anchor.index)
      if (Number.isFinite(rollRadians)) observerRollRadians = Math.atan2(Math.sin(rollRadians), Math.cos(rollRadians))
      applyObserverRollFrame()
    }
    else reset()
    if (!enabled) {
      container.dataset.observerRollDegrees = '0'
      delete container.dataset.observerViewDirection
      delete container.dataset.observerScreenUp
    }
    requestRender()
    return observerViewEnabled
  }

  function rollObserverView(direction: 'counterclockwise' | 'center' | 'clockwise'): void {
    if (!observerViewEnabled || observerViewAnchorIndex === null) return
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    if (direction === 'center') observerRollRadians = 0
    else {
      observerRollRadians += direction === 'clockwise' ? -OBSERVER_ROLL_STEP : OBSERVER_ROLL_STEP
      observerRollRadians = Math.atan2(Math.sin(observerRollRadians), Math.cos(observerRollRadians))
    }
    applyObserverRollFrame()
    invalidateProjection()
    obstacleBoundsDirty = true
    ordinaryLayoutDirty = true
    requestRender()
  }

  function reset(): void {
    if (observerViewEnabled) return
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    controls.reset()
    fitResetView()
    resize()
    requestRender()
  }

  function setCameraView(view: 'top' | 'side' | 'front'): void {
    if (observerViewEnabled) return
    const target = controls.target.clone()
    const distance = camera.position.distanceTo(target)
    const direction = view === 'top' ? new Vector3(0, 1, 0)
      : view === 'side' ? new Vector3(1, 0, 0)
        : new Vector3(0, 0, 1)
    focusTransition = null
    controlsInteracting = false
    controlsSettling = false
    home = false
    // Clear any remaining orbit/pan damping before applying the new direction.
    applyFocusTarget(target, camera.position.clone())
    applyFocusTarget(target, target.clone().addScaledVector(direction, distance))
    captureFollowTarget()
    requestRender()
  }

  let renderWidth = 0
  let renderHeight = 0
  let displayPixelRatio = 0
  function resize(): void {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    const nextDisplayPixelRatio = window.devicePixelRatio || 1
    const pixelRatio = renderPixelRatio(nextDisplayPixelRatio, powerSavingMode)
    const sizeChanged = width !== renderWidth || height !== renderHeight
    const displayPixelRatioChanged = displayPixelRatio !== nextDisplayPixelRatio
    if (!sizeChanged && renderer.getPixelRatio() === pixelRatio && !displayPixelRatioChanged) return
    renderWidth = width
    renderHeight = height
    displayPixelRatio = nextDisplayPixelRatio
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height)
    nebulaLayer?.setViewportHeight(height * pixelRatio)
    molecularCloudLayer?.setViewportHeight(height * pixelRatio)
    gridOpacity.value = gridOpacityForDisplay(displayPixelRatio)
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
    if (projectionGridDirty) {
      projectionGrid.clear()
      for (const projected of projectedPickables) {
        pickRect.left = pickRect.right = projected.x
        pickRect.top = pickRect.bottom = projected.y
        projectionGrid.insert(pickRect, projected)
      }
      projectionGridDirty = false
    }
    return pickProjectedStarAtScreenPoint(projectionGrid, projectionViewport, event, event.pointerType === 'touch' ? 24 : 16)
      ?? pickExtendedVolume(event, projectionViewport)
  }
  function pickExtendedVolume(event: PointerEvent, viewport: DOMRect): string | null {
    let picked: string | null = null
    let nearestDepth = Infinity
    const projectionScale = camera.projectionMatrix.elements[5]! * 0.5 * viewport.height
    for (const [indices, radii] of [[nebulaIndices, nebulaPickRadii], [molecularCloudIndices, molecularCloudPickRadii]] as const) {
      for (let order = 0; order < indices.length; order++) {
        const projected = projections[indices[order]!]!
        if (!projected.visible || projected.depth >= nearestDepth) continue
        const radius = radii[order]! * projectionScale / projected.depth
        if (Math.hypot(event.clientX - projected.x, event.clientY - projected.y) > radius) continue
        picked = projected.id
        nearestDepth = projected.depth
      }
    }
    return picked
  }
  let hoverFrame: number | null = null
  let hoverEvent: PointerEvent | null = null
  canvas.addEventListener('pointerdown', (event) => {
    options.onInteraction()
    gesture.begin(event)
  }, { signal: events.signal })
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
    options.onInteraction()
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
    captureFollowTarget()
    requestRender()
  }
  controls.addEventListener('start', onControlsStart)
  controls.addEventListener('end', onControlsEnd)
  function onControlsChange(): void {
    applyObserverRollFrame()
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
        captureFollowTarget('star')
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
    if (earthOrbitEnabled) updateEarthOrbitVisibility()
    starViewDistance.value = camera.position.distanceTo(controls.target)
    const visibilityBaseIndex = starsById.get(visibilityBase.id)!.index
    const viewerDistance = camera.position.distanceTo(pickable[visibilityBaseIndex]!.position)
    updateGridScale(viewerDistance)
    if ((!continueRendering && !simulationPlaying) || time - lastViewerDistanceReport >= 250) {
      options.onViewerDistance?.(viewerDistance)
      lastViewerDistanceReport = time
    }
    updateGuideDashScales()
    updateMotionArrows()
    renderer.render(scene, camera)
    setData(labelLayer, 'drawCalls', String(renderer.info.render.calls))
    setLabelsMoving(continueRendering || simulationPlaying)
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
  updateEarthOrbitVisibility()
  if (initialEarthOrbitDate) positionEarthMarker(initialEarthOrbitDate, initialEarthMarker)
  container.dataset.earthOrbitRadiusPc = String(EARTH_ORBIT_DISPLAY_RADIUS_PC)
  container.dataset.milkyWayVisible = String(milkyWayVisible)
  container.dataset.simulationYears = '0'
  if (milkyWayVisible) loadMilkyWay()
  resize()
  requestRender()
  container.dataset.ready = 'true'

  return {
    getViewState() {
      return {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        home,
        observerRollRadians,
      }
    },
    select,
    setReference(id) {
      const reference = starsById.get(id)
      if (!reference || reference.index === referenceIndex) return
      referenceIndex = reference.index
      for (let index = 0; index < stars.length; index++) {
        referenceDistancesLy[index] = basePositions[index]!.distanceTo(basePositions[referenceIndex]!) * LIGHT_YEARS_PER_PARSEC
      }
      positionReferenceFrame()
      select(selectedId, false)
      requestRender()
    },
    setObserverView,
    rollObserverView,
    reset,
    setCameraView,
    setObjectDistanceLimit(distanceLy) {
      if (!Number.isFinite(distanceLy) || distanceLy < 5 || distanceLy > 40000) return
      if (distanceLy === objectDistanceLimitLy) return
      objectDistanceLimitLy = distanceLy
      updatePresentation()
      if (home) fitHome()
      requestRender()
    },
    setObjectFilter(keys) {
      const nextKeys = new Set(keys.filter(isFilterKey))
      if (nextKeys.size === visibleKeys.size && [...nextKeys].every((key) => visibleKeys.has(key))) return
      visibleKeys = nextKeys
      updatePresentation()
      if (home) fitHome()
      requestRender()
    },
    setLabelLimit(limit) {
      if (!Number.isFinite(limit) || limit < 0 || limit > 140 || limit % 20 !== 0 || limit === labelLimit) return
      labelLimit = limit
      ordinaryLayoutDirty = true
      requestRender()
    },
    setMotionArrowsVisible(visible) {
      if (visible === motionArrowsVisible) return
      motionArrowsVisible = visible
      invalidateProjection()
      ordinaryLayoutDirty = true
      requestRender()
    },
    setEarthOrbitDate(date) {
      if (date !== null && !Number.isFinite(date.getTime())) return
      earthOrbitEnabled = date !== null
      updateEarthOrbitVisibility()
      if (date) positionEarthMarker(date)
      else {
        delete container.dataset.earthOrbitDate
        delete container.dataset.earthEclipticLongitudeDeg
      }
      requestRender()
    },
    setMilkyWayVisible(visible) {
      if (visible === milkyWayVisible) return
      milkyWayVisible = visible
      container.dataset.milkyWayVisible = String(visible)
      if (visible && !milkyWayTexture) loadMilkyWay()
      milkyWaySky.visible = visible && milkyWayTexture !== null
      requestRender()
    },
    setMotionFrame(frame) {
      if ((frame !== 'galactic' && frame !== 'solar') || frame === motionFrame) return
      motionFrame = frame
      motions = stars.map((star) => displayMotionForStar(star, frame))
      yearlyMotionDistances = motions.map((motion) => motion ? motionTravelDistancePc(motion.velocity.length(), 1) : 0)
      yearlyMotionVectors = motions.map((motion) => motion ? motion.velocity.clone().multiplyScalar(parsecsPerKmsYear) : null)
      applySimulationYears()
      ordinaryLayoutDirty = true
    },
    setMotionYears(years) {
      if (!MOTION_YEAR_OPTIONS.includes(years) || years === motionYears) return
      motionYears = years
      ordinaryLayoutDirty = true
      requestRender()
    },
    setFollowSelection(enabled) {
      if (enabled === followSelection) return
      followSelection = enabled
      captureFollowTarget()
      requestRender()
    },
    setSimulationPlaying(playing) {
      if (playing === simulationPlaying) return
      simulationPlaying = playing
      if (!playing) {
        updateSelectionGuides(true)
        lastSelectionDistanceUpdate = performance.now()
        ordinaryLayoutDirty = true
      }
      requestRender()
    },
    setSimulationYears(years) {
      if (!Number.isFinite(years) || Math.abs(years) > SIMULATION_YEAR_LIMIT || years === simulationYears) return
      simulationYears = years
      applySimulationYears()
    },
    setPowerSavingMode(enabled) {
      if (enabled === powerSavingMode) return
      powerSavingMode = enabled
      nebulaLayer?.setLevelOfDetail(enabled ? 0.5 : 1)
      if (nebulaLayer) labelLayer.dataset.nebulaPuffCount = String(nebulaLayer.instanceCount())
      molecularCloudLayer?.setLevelOfDetail(enabled ? 0.4 : 1)
      if (molecularCloudLayer) labelLayer.dataset.molecularCloudPuffCount = String(molecularCloudLayer.instanceCount())
      resetCadenceSamples()
      resize()
      requestRender()
    },
    setStarColorMode(mode) {
      if ((mode !== 'real' && mode !== 'exaggerated') || mode === starColorMode) return
      starColorMode = mode
      milkyWayUniforms.saturation.value = mode === 'exaggerated' ? 1.3 : 1
      stars.forEach((star, index) => {
        const color = starDisplayColor(star, mode)
        starColors[index] = color
        starColorStyles[index] = color.getStyle()
        starColorAttribute.setXYZ(index, color.r, color.g, color.b)
      })
      starColorAttribute.needsUpdate = true
      nebulaLayer?.setColorMode(mode)
      molecularCloudLayer?.setColorMode(mode)
      bubbleLayer?.setColorMode(mode)
      for (const [index, label] of activeStarLabels) label.anchor.style.setProperty('--star-color', starColorStyles[index]!)
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
      const visibilityBaseIndex = starsById.get(visibilityBase.id)!.index
      updateGridScale(camera.position.distanceTo(pickable[visibilityBaseIndex]!.position))
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
      if (observerViewEnabled) return
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
      captureFollowTarget()
      invalidateProjection()
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
      nebulaLayer?.dispose()
      molecularCloudLayer?.dispose()
      bubbleLayer?.dispose()
      dotTexture.dispose()
      earthTexture.dispose()
      haloTexture.dispose()
      milkyWayTexture?.dispose()
      milkyWayGeometry.dispose()
      milkyWayMaterial.dispose()
      renderer.dispose()
      canvas.remove()
      axisLayer.remove()
      labelLayer.remove()
      delete container.dataset.ready
      delete container.dataset.gridSpacingPc
      delete container.dataset.gridHalfSizePc
      delete container.dataset.earthOrbitVisible
      delete container.dataset.earthOrbitDate
      delete container.dataset.earthEclipticLongitudeDeg
      delete container.dataset.earthOrbitRadiusPc
      delete container.dataset.referenceId
      delete container.dataset.observerView
      delete container.dataset.milkyWayReady
      delete container.dataset.milkyWayVisible
      delete container.dataset.simulationYears
      delete container.dataset.followTarget
      delete labelLayer.dataset.bubbleTriangleCount
      delete labelLayer.dataset.molecularCloudPuffCount
    },
  }
}
