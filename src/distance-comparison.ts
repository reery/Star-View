import { BufferGeometry, Float32BufferAttribute, OrthographicCamera, Points, Scene, WebGLRenderer } from 'three'
import {
  displayMotionForStar, galacticToWorld, LIGHT_YEARS_PER_PARSEC, starDisplayColor,
  type DistanceUnit, type MotionFrame, type StarColorMode,
} from './astronomy'
import type { Star } from './catalog-model'
import { createStarAppearance } from './star-appearance'
import { motionTravelDistancePc, STAR_DIAMETER_PX, starCoreWhiteStrength, starHaloDiameter, starHaloEmphasis, starHaloOpacity } from './viewer-primitives'

const WIDTH = 560
const HEIGHT = 232
const RADIUS = 82
const CENTER_Y = 116

export function distanceGeometry(selected: Star, reference: Star, years = 0, frame: MotionFrame = 'galactic') {
  const position = (star: Star) => {
    const result = galacticToWorld(star)
    const motion = displayMotionForStar(star, frame)
    if (motion && years !== 0) result.addScaledVector(motion.velocity, motionTravelDistancePc(1, years))
    return result
  }
  const offset = position(selected).sub(position(reference))
  return {
    distancePc: offset.length(),
    // Top: forward (Galactic +Y / world -Z) is up; Galactic center (+X) is right.
    topX: offset.x, topY: offset.z,
    // Side: look toward Galactic +X, with Galactic north up.
    sideX: offset.z, sideY: -offset.y,
    heightPc: offset.y,
  }
}

function number(value: number): string {
  return value.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

function units(pc: number): [string, string] {
  return [`${number(pc * LIGHT_YEARS_PER_PARSEC)} ly`, `${number(pc)} pc`]
}

// A single offscreen renderer is reused, created only when this card is opened.
// Its point materials are the exact ones used by the main 3D map.
function createPointRenderer() {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setClearColor(0, 1)
  const scene = new Scene()
  const camera = new OrthographicCamera(0, WIDTH, 0, -HEIGHT, 0.1, 1000)
  camera.position.z = 100
  // These are close-up illustrations, independent of the pair's separation.
  const previewDistance = { value: 1 }
  const appearance = createStarAppearance(previewDistance, previewDistance)
  const geometry = new BufferGeometry()
  for (const [name, size] of Object.entries({
    position: 3, color: 3, coreDiameter: 1, coreFocus: 1, coreEmphasis: 1, coreWhiteStrength: 1,
    haloDiameter: 1, haloOpacity: 1, haloEmphasis: 1,
  })) geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(4 * size), size))
  const cores = new Points(geometry, appearance.starMaterial)
  const halos = new Points(geometry, appearance.haloMaterial)
  cores.frustumCulled = halos.frustumCulled = false
  cores.renderOrder = 2
  halos.renderOrder = 3
  scene.add(cores, halos)
  return { renderer, scene, camera, geometry, appearance }
}
let pointRenderer: ReturnType<typeof createPointRenderer> | undefined

export function disposeDistanceComparison(): void {
  if (!pointRenderer) return
  const { renderer, geometry, appearance } = pointRenderer
  geometry.dispose()
  appearance.dotTexture.dispose()
  appearance.haloTexture.dispose()
  appearance.starMaterial.dispose()
  appearance.haloMaterial.dispose()
  renderer.dispose()
  pointRenderer = undefined
}

export function renderDistanceComparison(
  canvas: HTMLCanvasElement, selected: Star, reference: Star, colorMode: StarColorMode, unit: DistanceUnit = 'ly',
  years = 0, frame: MotionFrame = 'galactic',
): void {
  const geometry = distanceGeometry(selected, reference, years, frame)
  const { distancePc, heightPc } = geometry
  const scale = distancePc > 0 ? RADIUS / distancePc : 0
  const left = { x: WIDTH / 4, y: CENTER_Y }
  const right = { x: WIDTH * 3 / 4, y: CENTER_Y }
  const topStar = { x: left.x + geometry.topX * scale, y: left.y + geometry.topY * scale }
  const sideStar = { x: right.x + geometry.sideX * scale, y: right.y + geometry.sideY * scale }
  const context = canvas.getContext('2d')
  if (!context) return
  const ratio = Math.min(3, window.devicePixelRatio || 1)
  // Keep text and point sizes consistent at every card width.
  const displayScale = (canvas.getBoundingClientRect().width || WIDTH) / WIDTH
  canvas.width = Math.round(WIDTH * displayScale * ratio)
  canvas.height = Math.round(HEIGHT * displayScale * ratio)
  context.scale(canvas.width / WIDTH, canvas.height / HEIGHT)
  context.fillStyle = '#090b10'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  const line = (x1: number, y1: number, x2: number, y2: number, color = '#47515f', dashed = false) => {
    context.strokeStyle = color
    context.lineWidth = 1
    context.setLineDash(dashed ? [2, 4] : [])
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
    context.setLineDash([])
  }
  const label = (value: string, x: number, y: number, color = '#7e8999', size = 11) => {
    context.fillStyle = color
    context.font = `${size}px system-ui`
    context.textAlign = 'center'
    context.fillText(value, x, y)
  }
  line(WIDTH / 2, 0, WIDTH / 2, HEIGHT, '#262c36')
  // The horizontal arrow points toward Galactic +X, on the right of this view.
  label('Galactic center →', WIDTH / 2 - 77, 24, '#8a98ac', 10)
  for (const radius of [RADIUS / 3, RADIUS * 2 / 3, RADIUS]) {
    context.strokeStyle = '#27313e'
    context.beginPath()
    context.arc(left.x, left.y, radius, 0, 2 * Math.PI)
    context.stroke()
  }
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    line(left.x, left.y, left.x + Math.cos(angle) * RADIUS, left.y + Math.sin(angle) * RADIUS, '#1d2632')
  }
  line(left.x, left.y, topStar.x, topStar.y, '#de995f')
  // The height guide retains the map's relative world-Y separation.
  context.fillStyle = '#283b551d'
  context.fillRect(WIDTH / 2 + 18, right.y - 5, WIDTH / 2 - 36, 10)
  line(WIDTH / 2 + 18, right.y, WIDTH - 18, right.y, '#536579')
  line(right.x, right.y, sideStar.x, sideStar.y, '#de995f')
  line(sideStar.x, sideStar.y, sideStar.x, right.y, '#94b7da', true)
  if (Math.abs(heightPc) > 1e-9) {
    line(sideStar.x - 3, right.y, sideStar.x + 3, right.y, '#94b7da')
  }
  const [ly, pc] = units(distancePc)
  const [heightLy, heightPcLabel] = units(Math.abs(heightPc))
  const distanceLabel = unit === 'ly' ? ly : pc
  const heightLabel = unit === 'ly' ? heightLy : heightPcLabel
  const secondaryValues = [unit === 'ly' ? pc : ly, unit === 'ly' ? heightPcLabel : heightLy]
  context.font = '12px system-ui'
  context.fillStyle = '#9ba4b1'
  context.textAlign = 'right'
  for (const [pane, value] of secondaryValues.entries()) {
    context.fillText(value, (pane + 1) * WIDTH / 2 - 12, HEIGHT - 12)
  }
  const points = pointRenderer ??= createPointRenderer()
  points.renderer.setPixelRatio(ratio)
  points.renderer.setSize(WIDTH * displayScale, HEIGHT * displayScale, false)
  const marks = [
    { star: reference, point: left }, { star: selected, point: topStar },
    { star: reference, point: right }, { star: selected, point: sideStar },
  ]
  for (const [index, { star, point }] of marks.entries()) {
    const color = starDisplayColor(star, colorMode)
    const isSelected = index % 2 === 1
    const magnitude = star.absolute_mag
    const emphasis = starHaloEmphasis(magnitude)
    points.geometry.getAttribute('position').setXYZ(index, point.x, -point.y, 0)
    points.geometry.getAttribute('color').setXYZ(index, color.r, color.g, color.b)
    const attributes = {
      coreDiameter: STAR_DIAMETER_PX * displayScale, coreFocus: 1, coreEmphasis: emphasis,
      coreWhiteStrength: starCoreWhiteStrength(star), haloDiameter: Math.max(36, starHaloDiameter(magnitude)) * displayScale,
      haloOpacity: Math.max(0.5, starHaloOpacity(magnitude, isSelected)), haloEmphasis: emphasis,
    }
    for (const [name, value] of Object.entries(attributes)) points.geometry.getAttribute(name).setX(index, value)
  }
  // Keep coincident projections honest: don't move either star to invent a gap.
  const visible = marks.flatMap(({ point }, index) => index % 2 === 1
    && Math.hypot(point.x - marks[index - 1]!.point.x, point.y - marks[index - 1]!.point.y) < 0.01 ? [] : [index])
  points.geometry.setIndex(visible)
  for (const attribute of Object.values(points.geometry.attributes)) attribute.needsUpdate = true
  points.renderer.render(points.scene, points.camera)
  // Composite light over the guides. An opaque black render target avoids
  // premultiplied-alpha artifacts from the map's additive halo materials.
  context.save()
  context.globalCompositeOperation = 'screen'
  context.drawImage(points.renderer.domElement, 0, 0, WIDTH, HEIGHT)
  context.restore()
  // Place annotation text above the glow, keeping names and measurements clear.
  type Bounds = { left: number; top: number; right: number; bottom: number }
  const occupied: Bounds[] = marks.map(({ point }) => ({ left: point.x - 8, right: point.x + 8, top: point.y - 8, bottom: point.y + 8 }))
  context.font = '12px system-ui'
  for (const [pane, value] of secondaryValues.entries()) {
    const right = (pane + 1) * WIDTH / 2 - 12
    occupied.push({ left: right - context.measureText(value).width, right, top: HEIGHT - 24, bottom: HEIGHT - 9 })
  }
  const overlaps = (a: Bounds, b: Bounds) => a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom + 3 && a.bottom > b.top - 3
  const annotate = (value: string, candidates: { x: number; y: number }[], pane: number, color: string, size = 11) => {
    context.font = `${size}px system-ui`
    // Long catalog names stay legible without crossing the pane divider.
    const maxWidth = WIDTH / 2 - 32
    let displayed = value
    while (context.measureText(displayed).width > maxWidth && displayed.length > 1) displayed = displayed.slice(0, -1)
    if (displayed !== value) displayed = `${displayed.slice(0, -1)}…`
    const width = context.measureText(displayed).width
    const placements = candidates.map(({ x, y }) => {
      const left = Math.max(pane + 12, Math.min(pane + WIDTH / 2 - 12 - width, x))
      const top = Math.max(34, Math.min(HEIGHT - 12 - size, y - size))
      return { left, top, right: left + width, bottom: top + size + 3 }
    })
    const bounds = placements.find((candidate) => !occupied.some((other) => overlaps(candidate, other)))
      ?? placements.reduce((best, candidate) => occupied.filter((other) => overlaps(candidate, other)).length < occupied.filter((other) => overlaps(best, other)).length ? candidate : best)
    context.textAlign = 'left'
    context.lineWidth = 4
    context.lineJoin = 'round'
    context.strokeStyle = '#090b10'
    context.strokeText(displayed, bounds.left, bounds.top + size)
    context.fillStyle = color
    context.fillText(displayed, bounds.left, bounds.top + size)
    occupied.push(bounds)
  }
  context.font = '12px system-ui'
  const distanceWidth = context.measureText(distanceLabel).width
  const dx = topStar.x - left.x
  const dy = topStar.y - left.y
  const projectedLength = Math.hypot(dx, dy)
  const nx = projectedLength > 0 ? -dy / projectedLength : 0
  const ny = projectedLength > 0 ? dx / projectedLength : -1
  const midX = (left.x + topStar.x) / 2
  const midY = (left.y + topStar.y) / 2
  annotate(distanceLabel, [1, -1].map((side) => ({ x: midX + nx * 17 * side - distanceWidth / 2, y: midY + ny * 17 * side + 4 })), 0, '#e9d4c1', 12)
  context.font = '12px system-ui'
  const heightWidth = context.measureText(heightLabel).width
  annotate(heightLabel, [
    { x: sideStar.x + 12, y: (sideStar.y + right.y) / 2 + 4 },
    { x: sideStar.x - heightWidth - 12, y: (sideStar.y + right.y) / 2 + 4 },
  ], WIDTH / 2, '#94b7da', 12)
  for (const [index, { star, point }] of marks.entries()) {
    if (index % 2 === 1 && star.id === reference.id) continue
    context.font = '11px system-ui'
    const width = context.measureText(star.name).width
    const coincident = index % 2 === 1 && Math.hypot(point.x - marks[index - 1]!.point.x, point.y - marks[index - 1]!.point.y) < 8
    const preferredY = point.y + (coincident ? 22 : -13)
    annotate(star.name, [
      { x: point.x + 12, y: preferredY }, { x: point.x - width - 12, y: preferredY },
      { x: point.x + 12, y: point.y + 24 }, { x: point.x - width - 12, y: point.y + 24 },
      { x: point.x - width / 2, y: point.y - 22 }, { x: point.x - width / 2, y: point.y + 32 },
    ], index < 2 ? 0 : WIDTH / 2, starDisplayColor(star, colorMode).getStyle())
  }
  const heightSign = heightPc < 0 ? '−' : heightPc > 0 ? '+' : ''
  canvas.setAttribute('aria-label', `${selected.name} from ${reference.name}: ${ly}, ${pc}. Top view: Galactic center right. Side view: ${heightSign}${heightLy}, ${heightSign}${heightPcLabel} vertical separation. Measurements use ${unit}.`)
}
