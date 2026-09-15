import {
  AdditiveBlending, Box3, BufferGeometry, Camera, CanvasTexture, Color, Float32BufferAttribute,
  GridHelper, Group, LessDepth, Line, LineBasicMaterial, LineDashedMaterial, LineSegments, NoBlending, Object3D,
  PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial, Sphere, SRGBColorSpace,
  Vector3, Vector4, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ArrowRight, createElement } from 'lucide'
import type { Star } from './catalog'
import { formatDistance, galacticToWorld, galactocentricVelocityToWorld, sunRelativeMetrics, temperatureToColor, visibilityTier, type DistanceUnit } from './astronomy'

export const STAR_DIAMETER_PX = 10

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

export interface StarViewer {
  select(id: string | null, focus?: boolean): void
  reset(): void
  setGridVisible(visible: boolean): void
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
  motion?: { element: HTMLSpanElement; velocity: Vector3; length: number }
}

interface LabelRect {
  left: number
  top: number
  right: number
  bottom: number
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const canvas = renderer.domElement
  canvas.setAttribute('aria-label', 'Sun-centered 3D nearby-object map')
  canvas.setAttribute('role', 'img')
  container.append(canvas)

  const scene = new Scene()
  const camera = new PerspectiveCamera(44, 1, 0.01, 1000)
  const controls = new OrbitControls(camera, canvas)
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  controls.enableDamping = !reducedMotion.matches
  controls.dampingFactor = 0.1
  controls.minPolarAngle = 0.08
  controls.maxPolarAngle = Math.PI - 0.08
  controls.rotateSpeed = 0.65
  controls.screenSpacePanning = true

  const pickable = stars.map((star) => ({ id: star.id, position: galacticToWorld(star) }))
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
  const grid = new LineSegments(gridHelper.geometry, new ShaderMaterial({
    uniforms: { radius: { value: gridHalfSize } },
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
      varying vec2 gridPosition;
      varying vec3 gridColor;
      void main() {
        float fade = 1.0 - smoothstep(radius * 0.55, radius, length(gridPosition));
        gl_FragColor = vec4(gridColor, 0.4 * fade);
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
  const axisLines = new LineSegments(axisGeometry, new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false,
  }))
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

  const starLabels = stars.map((star, index) => {
    const label = makeLabel(pickable[index]!.position, star.name, 'star-label', star.id)
    label.anchor.style.setProperty('--star-color', temperatureToColor(star.temperature_k).getStyle())
    const velocity = galactocentricVelocityToWorld(star)
    if (velocity) {
      const length = motionArrowLength(velocity.length())
      const width = length + 2 * 5 * 16 / 24
      const arrow = document.createElement('span')
      arrow.className = 'motion-arrow'
      arrow.hidden = true
      arrow.style.color = temperatureToColor(star.temperature_k).getStyle()
      arrow.style.width = `${width}px`
      arrow.style.height = '16px'
      arrow.style.left = `${-width / 2}px`
      arrow.style.top = '-8px'
      const icon = createElement(ArrowRight, { width, height: 16, viewBox: `0 0 ${width * 24 / 16} 24`, 'stroke-width': 1.7 })
      const [shaft, head] = icon.querySelectorAll('path')
      const tip = 5 + length * 24 / 16
      shaft!.setAttribute('d', `M5 12H${tip}`)
      head!.setAttribute('transform', `translate(${tip - 19} 0)`)
      arrow.append(icon)
      label.anchor.append(arrow)
      label.motion = { element: arrow, velocity, length }
    }
    return label
  })
  const axisLabels = axes.map((axis) => makeLabel(axis.position, axis.text, 'axis-label'))
  axisLabels.forEach((label) => axisLayer.append(label.anchor))
  const guides = new Group()
  scene.add(guides)
  let measurementLabels: MapLabel[] = []
  let selectedId: string | null = null
  let visibilityBase = sun
  let magnitudeLimit = 7
  let distanceUnit: DistanceUnit = 'pc'
  const tiers = new Map<string, ReturnType<typeof visibilityTier>>()
  let disposed = false
  let contextLost = false
  let pendingFrame: number | null = null
  let home = true
  let focusTransition: { from: Vector3; to: Vector3; position: Vector3; started: number } | null = null
  const focusTarget = new Vector3()
  let labelSizesDirty = true
  let distanceNormal = { x: 0, y: -1 }
  let distanceSide = 1

  function invalidateLabelSizes(): void {
    labelSizesDirty = true
    requestRender()
  }

  // The catalog is static. Coalesce changes into a single frame, and only keep
  // scheduling frames while focus animation or OrbitControls damping is active.
  function requestRender(): void {
    if (disposed || contextLost || document.hidden || pendingFrame !== null) return
    pendingFrame = requestAnimationFrame(render)
  }

  function cancelRender(): void {
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  function updatePresentation(): void {
    let haloCount = 0
    stars.forEach((star, index) => {
      const tier = visibilityTier(star, visibilityBase, magnitudeLimit)
      tiers.set(star.id, tier)
      coreDiameters.setX(index, tier === 'background' ? 3 : STAR_DIAMETER_PX)
      haloOpacities.setX(index, tier === 'background' ? 0 : starHaloOpacity(star.absolute_mag, star.id === selectedId))
      if (tier !== 'background') haloIndices.setX(haloCount++, index)
      starLabels[index]!.anchor.dataset.visibility = tier
    })
    coreDiameters.needsUpdate = true
    haloOpacities.needsUpdate = true
    haloIndices.needsUpdate = true
    haloGeometry.setDrawRange(0, haloCount)
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
    controls.update()
    controls.target.copy(target)
    camera.position.copy(position)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    controls.enableDamping = !reducedMotion.matches
  }

  function updateLabels(): void {
    if (labelSizesDirty) {
      const labels = [...axisLabels, ...starLabels, ...measurementLabels]
      // Hidden labels have zero dimensions. Reveal them together, read all
      // sizes in one layout pass, then place/hide them below before painting.
      for (const label of labels) {
        setHidden(label.anchor, false)
        setHidden(label.text, false)
      }
      for (const label of labels) {
        label.width = label.text.offsetWidth
        label.height = label.text.offsetHeight
      }
      labelSizesDirty = false
    }
    const viewport = canvas.getBoundingClientRect()
    const projections = new Map(pickable.map((star) => [star.id, projectWorldPoint(star.position, camera, viewport)]))
    const blocked: LabelRect[] = [...container.parentElement!.querySelectorAll<HTMLElement>('[data-scene-obstacle]')]
      .filter((element) => !element.hidden)
      .map((element) => element.getBoundingClientRect())
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
        blocked.some((obstacle) => overlaps(rectangle, obstacle)))
    }
    const starObstacles = pickable.flatMap((star) => {
      const projected = projections.get(star.id)
      if (!projected) return []
      const radius = (tiers.get(star.id) === 'background' ? 3 : STAR_DIAMETER_PX) / 2
      return [{ depth: projected.depth, bounds: { left: projected.x - radius, right: projected.x + radius, top: projected.y - radius, bottom: projected.y + radius } }]
    })
    const selectedLabels = starLabels.filter((label) => label.starId === selectedId)
    const otherStarLabels = starLabels.filter((label) => label.starId !== selectedId)
      .sort((first, second) => (projections.get(first.starId!)?.depth ?? Infinity) -
        (projections.get(second.starId!)?.depth ?? Infinity))
    for (const [index, label] of [...selectedLabels, ...otherStarLabels].entries()) {
      const zIndex = label.starId === selectedId ? '1' : `${-index - 1}`
      if (label.anchor.style.zIndex !== zIndex) label.anchor.style.zIndex = zIndex
      if (!label.motion) continue
      const { element, velocity, length } = label.motion
      const projected = projections.get(label.starId!)
      const direction = projected && tiers.get(label.starId!) !== 'background'
        ? projectMotionDirection(label.position, velocity, camera, viewport) : null
      setHidden(element, !direction)
      if (!projected || !direction) continue
      const offsetX = direction.x * (STAR_DIAMETER_PX / 2 + length / 2)
      const offsetY = direction.y * (STAR_DIAMETER_PX / 2 + length / 2)
      const headHalfHeight = 7 * 16 / 24
      const strokeRadius = 1.7 / 2 * 16 / 24
      const halfWidth = length / 2 * Math.abs(direction.x) + headHalfHeight * Math.abs(direction.y) + strokeRadius
      const halfHeight = length / 2 * Math.abs(direction.y) + headHalfHeight * Math.abs(direction.x) + strokeRadius
      const centerX = projected.x + offsetX
      const centerY = projected.y + offsetY
      const bounds = { left: centerX - halfWidth, right: centerX + halfWidth, top: centerY - halfHeight, bottom: centerY + halfHeight }
      setTransform(element, `translate(${offsetX}px, ${offsetY}px) rotate(${Math.atan2(direction.y, direction.x)}rad)`)
      starObstacles.push({ depth: projected.depth, bounds })
    }
    for (const label of [...selectedLabels, ...measurementLabels, ...otherStarLabels]) {
      const projected = label.starId ? projections.get(label.starId) : projectWorldPoint(label.position, camera, viewport)
      const selected = label.starId === selectedId
      const foreground = selected || Boolean(label.measurement)
      const anchor = projected ?? (foreground ? projectSelectedAnchor(label.position, camera, viewport) : null)
      setHidden(label.anchor, !anchor)
      if (label.anchor.classList.contains('is-clipped') !== !projected) label.anchor.classList.toggle('is-clipped', !projected)
      if (!anchor) continue
      setTransform(label.anchor, `translate(${anchor.x - viewport.left}px, ${anchor.y - viewport.top}px)`)
      if (label.starId && tiers.get(label.starId) === 'background') {
        setHidden(label.text, true)
        continue
      }
      const { width, height } = label
      if (label.measurement) {
        const start = projections.get(sun!.id)
        const end = projections.get(selectedId!)
        if (start && end) {
          const dx = end.x - start.x
          const dy = end.y - start.y
          const length = Math.hypot(dx, dy)
          if (length > 1) distanceNormal = { x: dy / length, y: -dx / length }
        }
        const radius = Math.max(starHaloDiameter(sun!.absolute_mag), starHaloDiameter(visibilityBase.absolute_mag)) / 2 + 6
        const endpoints = [start, end].filter((point) => point != null)
          .map((point) => ({ left: point.x - radius, right: point.x + radius, top: point.y - radius, bottom: point.y + radius }))
        // Offset perpendicular to the line far enough that the whole label
        // clears both endpoint halos, even when the line is foreshortened.
        const offset = Math.abs(distanceNormal.x) * (width / 2 + radius) + Math.abs(distanceNormal.y) * (height / 2 + radius)
        const clamp = (left: number, top: number) => {
          left = Math.max(viewport.left + 12, Math.min(left, viewport.right - width - 12))
          top = Math.max(viewport.top + 12, Math.min(top, viewport.bottom - height - 12))
          return { left, top, right: left + width, bottom: top + height }
        }
        const candidates = [distanceSide, -distanceSide].map((side) => ({
          ...clamp(anchor.x + distanceNormal.x * offset * side - width / 2, anchor.y + distanceNormal.y * offset * side - height / 2), side,
        }))
        let placement = candidates.find((candidate) => endpoints.every((endpoint) => !overlaps(candidate, endpoint, 0)))
        if (placement) distanceSide = placement.side
        else {
          // At the viewport edge, use the closest clear corner instead of
          // clamping the label back on top of a star.
          const corners = [viewport.left + 12, viewport.right - width - 12].flatMap((left) =>
            [viewport.top + 12, viewport.bottom - height - 12].map((top) => ({ ...clamp(left, top), side: distanceSide })))
          placement = corners.filter((candidate) => endpoints.every((endpoint) => !overlaps(candidate, endpoint, 0)))
            .sort((a, b) => Math.hypot(a.left + width / 2 - anchor.x, a.top + height / 2 - anchor.y) -
              Math.hypot(b.left + width / 2 - anchor.x, b.top + height / 2 - anchor.y))[0]
        }
        setHidden(label.text, !placement)
        if (placement) {
          setTransform(label.text, `translate(${placement.left - anchor.x}px, ${placement.top - anchor.y}px)`)
          blocked.push(placement)
        }
        continue
      }
      if (foreground) {
        const left = Math.max(viewport.left + 12, Math.min(anchor.x + 22, viewport.left + viewport.width - width - 12))
        const top = Math.max(viewport.top + 12, Math.min(anchor.y - height / 2, viewport.top + viewport.height - height - 12))
        setTransform(label.text, `translate(${left - anchor.x}px, ${top - anchor.y}px)`)
        setHidden(label.text, false)
        blocked.push({ left, top, right: left + width, bottom: top + height })
        continue
      }
      const offsets = [[22, -height / 2]]
      let placed = false
      for (const [offsetX, offsetY] of offsets) {
        const rectangle = { left: anchor.x + offsetX!, top: anchor.y + offsetY!, right: anchor.x + offsetX! + width, bottom: anchor.y + offsetY! + height }
        if (rectangle.left < viewport.left + 12 || rectangle.right > viewport.right - 12 || rectangle.top < viewport.top + 12 || rectangle.bottom > viewport.bottom - 12) continue
        if (blocked.some((obstacle) => overlaps(rectangle, obstacle))) continue
        if (starObstacles.some((obstacle) => (!label.starId || obstacle.depth <= projected!.depth) && overlaps(rectangle, obstacle.bounds))) continue
        setTransform(label.text, `translate(${offsetX}px, ${offsetY}px)`)
        blocked.push(rectangle)
        placed = true
        break
      }
      setHidden(label.text, !placed)
    }
  }

  function select(id: string | null, focus = true): void {
    const star = stars.find((candidate) => candidate.id === id)
    if (id !== null && !star) return
    focusTransition = null
    selectedId = id
    distanceSide = 1
    distanceNormal = { x: 0, y: -1 }
    if (star) visibilityBase = star
    updatePresentation()
    starLabels.forEach((label) => label.anchor.classList.toggle('is-selected', label.starId === id))
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
  }

  function reset(): void {
    focusTransition = null
    controls.reset()
    fitHome()
    requestRender()
  }

  let renderWidth = 0
  let renderHeight = 0
  function resize(): void {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    if (width === renderWidth && height === renderHeight && renderer.getPixelRatio() === pixelRatio) return
    renderWidth = width
    renderHeight = height
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    if (home) fitHome()
    invalidateLabelSizes()
  }

  const events = new AbortController()
  const gesture = new TapGesture()
  function pick(event: PointerEvent): string | null {
    camera.updateMatrixWorld()
    return pickStarAtScreenPoint(pickable, camera, canvas.getBoundingClientRect(), event, event.pointerType === 'touch' ? 24 : 16)
  }
  canvas.addEventListener('pointerdown', (event) => gesture.begin(event), { signal: events.signal })
  canvas.addEventListener('pointermove', (event) => {
    gesture.move(event)
    if (event.buttons === 0 && event.pointerType !== 'touch') canvas.style.cursor = pick(event) ? 'pointer' : 'grab'
  }, { signal: events.signal })
  canvas.addEventListener('pointerup', (event) => {
    if (!gesture.end(event)) return
    const bounds = canvas.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
    options.onSelect(pick(event))
  }, { signal: events.signal })
  canvas.addEventListener('pointercancel', (event) => gesture.cancel(event.pointerId), { signal: events.signal })
  canvas.addEventListener('lostpointercapture', (event) => gesture.cancel(event.pointerId), { signal: events.signal })
  controls.addEventListener('start', () => {
    focusTransition = null
    home = false
  })
  controls.addEventListener('change', requestRender)
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && focusTransition) {
      applyFocusTarget(focusTransition.to, focusTransition.position)
      focusTransition = null
    }
    controls.enableDamping = !reducedMotion.matches
    requestRender()
  }, { signal: events.signal })

  function render(time: number): void {
    pendingFrame = null
    if (disposed || contextLost || document.hidden) return
    if (focusTransition) {
      const progress = focusProgress(time - focusTransition.started)
      focusTarget.lerpVectors(focusTransition.from, focusTransition.to, progress)
      applyFocusTarget(focusTarget, focusTransition.position)
      if (progress === 1) focusTransition = null
      else requestRender()
    } else controls.update()
    camera.updateMatrixWorld()
    renderer.render(scene, camera)
    updateLabels()
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
    resize()
    requestRender()
  }, { signal: events.signal })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelRender()
    else {
      resize()
      requestRender()
    }
  }, { signal: events.signal })
  window.addEventListener('resize', () => {
    resize()
    invalidateLabelSizes()
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
    resize()
  }
  watchPixelRatio()
  document.fonts.ready.then(invalidateLabelSizes)
  document.fonts.addEventListener('loadingdone', invalidateLabelSizes, { signal: events.signal })

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  // Font loading, unit changes, and hiding the grid legend can change the
  // rectangles that labels must avoid, even when the canvas size stays fixed.
  const obstacleObserver = new ResizeObserver(requestRender)
  container.parentElement!.querySelectorAll<HTMLElement>('[data-scene-obstacle]')
    .forEach((element) => obstacleObserver.observe(element))
  updatePresentation()
  resize()
  requestRender()
  container.dataset.ready = 'true'

  return {
    select,
    reset,
    setVisibility(observerId, limit) {
      const base = stars.find((star) => star.id === observerId)
      if (!base || !Number.isFinite(limit) || limit < 0 || limit > 12) return
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
      home = false
      if (direction === 'in') controls.dollyIn(1 / 1.3)
      else controls.dollyOut(1 / 1.3)
      controls.update()
      requestRender()
    },
    dispose() {
      disposed = true
      focusTransition = null
      cancelRender()
      events.abort()
      observer.disconnect()
      obstacleObserver.disconnect()
      controls.removeEventListener('change', requestRender)
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
    .applyMatrix4(camera.projectionMatrix)
  const tangent = new Vector4(velocity.x / speed, velocity.y / speed, velocity.z / speed, 0)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix)
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
  if (
    pointer.clientX < viewport.left || pointer.clientX > viewport.left + viewport.width ||
    pointer.clientY < viewport.top || pointer.clientY > viewport.top + viewport.height
  ) return null
  let selected: string | null = null
  let nearestDistance = radius
  let nearestDepth = Infinity
  for (const star of stars) {
    const projected = projectWorldPoint(star.position, camera, viewport)
    if (!projected) continue
    const distance = Math.hypot(pointer.clientX - projected.x, pointer.clientY - projected.y)
    if (distance > radius) continue
    if (distance < nearestDistance - 1e-6 || (Math.abs(distance - nearestDistance) < 1e-6 && projected.depth < nearestDepth)) {
      selected = star.id
      nearestDistance = distance
      nearestDepth = projected.depth
    }
  }
  return selected
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
