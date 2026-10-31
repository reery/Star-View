import { ArrowLeftRight, CalendarClock, Ruler } from 'lucide'
import { BufferGeometry, Float32BufferAttribute, OrthographicCamera, Points, Scene, Uint16BufferAttribute, Vector2, Vector3, WebGLRenderer } from 'three'
import {
  displayMotionForStar, galacticToWorld, galacticVelocityToWorld, LIGHT_YEARS_PER_PARSEC, rawAstrometryVelocityToWorld, starDisplayColor, sunRelativeMetrics,
  type DistanceUnit, type MotionFrame, type StarColorMode,
} from './astronomy'
import { equatorialToGalacticPc, type RawAstrometry, type Star } from './catalog-model'
import { renderFact, type Fact } from './comparison-tiles'
import { MISSING_VALUE } from './format'
import { spaceMotionForStar } from './space-motion'
import { radialVelocityKms, radialVelocitySource } from './spec-values'
import { createStarAppearance } from './star-appearance'
import { DEFAULT_PAINT_CONTROLS, DEFAULT_PAINT_LEVEL, radialGradient } from './star-paint'
import { SIMULATION_YEAR_LIMIT } from './viewer'
import { motionTravelDistancePc, STAR_DIAMETER_PX, starCoreWhiteStrength, starHaloDiameter, starHaloEmphasis, starHaloOpacity } from './viewer-primitives'

const WIDTH = 560
const HEIGHT = 232
const RADIUS = 82
const CENTER_Y = 116
/** About 80% of the catalog's radial velocities lie within this many km/s of rest. */
const RADIAL_VELOCITY_LIMIT = 40

export function distanceGeometry(selected: Star, reference: Star, years = 0, frame: MotionFrame = 'galactic') {
  const position = (star: Star) => {
    const result = galacticToWorld(star)
    const motion = displayMotionForStar(star, frame)
    // The travel helper only measures forward distances; the sign moves the star into the past.
    if (motion && years !== 0) result.addScaledVector(motion.velocity, Math.sign(years) * motionTravelDistancePc(1, Math.abs(years)))
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

// Rounding step for an uncertainty: its leading digit, or two digits when that digit is 1.
function precision(error: number): number {
  const power = 10 ** Math.floor(Math.log10(error))
  return error / power < 2 ? power / 10 : power
}

// Rounds to the coarser of the uncertainty's step and three significant digits.
function coarseStep(value: number, error: number): number {
  return Math.max(precision(error), 10 ** (Math.floor(Math.log10(Math.abs(value))) - 2))
}

function rounded(value: number, step: number): string {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))
  return (Math.round(value / step) * step).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** The parallax distance and its 1σ error; `adopted` when the catalog distance lies within that error. */
export function parallaxDistance(star: Star, distancePc: number) {
  const raw = star.raw_astrometry
  if (!raw?.parallax_error_mas || !(raw.parallax_mas > 0)) return null
  const parallaxPc = 1000 / raw.parallax_mas
  const errorPc = parallaxPc * raw.parallax_error_mas / raw.parallax_mas
  return { parallaxPc, errorPc, adopted: Math.abs(distancePc - parallaxPc) <= Math.max(errorPc, distancePc * 1e-4) }
}

const PC_PER_KMS_YEAR = motionTravelDistancePc(1, 1)
const APPROACH_TERMS = [
  ['parallax_mas', 'parallax_error_mas'], ['pm_ra_cosdec_masyr', 'pm_ra_error_masyr'],
  ['pm_dec_masyr', 'pm_dec_error_masyr'], ['radial_velocity_kms', 'radial_velocity_error_kms'],
] as const

function approach(position: Vector3, velocity: Vector3) {
  const years = -position.dot(velocity) / velocity.lengthSq() / PC_PER_KMS_YEAR
  return { years, distancePc: position.clone().addScaledVector(velocity, years * PC_PER_KMS_YEAR).length() }
}

/**
 * Straight-line closest approach to the Sun, as the map moves the star. Returned only inside the
 * timeline, and only when the 1σ astrometric errors shift its time and distance by under 10%.
 */
export function closestApproach(star: Star) {
  const raw = star.raw_astrometry
  const velocity = galacticVelocityToWorld(star)
  if (!raw || !velocity || raw.radial_velocity_kms === null) return null
  const position = galacticToWorld(star)
  if (!parallaxDistance(star, position.length())?.adopted) return null
  const nominal = approach(position, velocity)
  if (!(Math.abs(nominal.years) <= SIMULATION_YEAR_LIMIT)) return null
  // Each error's effect is applied to the catalog state, which may use a systemic velocity.
  const state = (source: RawAstrometry) => ({
    position: galacticToWorld(equatorialToGalacticPc(source.ra_deg, source.dec_deg, 1000 / source.parallax_mas)),
    velocity: rawAstrometryVelocityToWorld(source),
  })
  const base = state(raw)
  let yearsVariance = 0
  let distanceVariance = 0
  for (const [term, errorTerm] of APPROACH_TERMS) {
    const error = raw[errorTerm]
    if (error === null) return null
    const [high, low] = [error, -error].map((shift) => {
      const shifted = state({ ...raw, [term]: raw[term]! + shift })
      return shifted.velocity && approach(position.clone().add(shifted.position).sub(base.position), velocity.clone().add(shifted.velocity).sub(base.velocity!))
    })
    if (!high || !low) return null
    yearsVariance += ((high.years - low.years) / 2) ** 2
    distanceVariance += ((high.distancePc - low.distancePc) / 2) ** 2
  }
  const yearsError = Math.sqrt(yearsVariance)
  const distanceErrorPc = Math.sqrt(distanceVariance)
  return yearsError <= 0.1 * Math.abs(nominal.years) && distanceErrorPc <= 0.1 * nominal.distancePc ? { ...nominal, yearsError, distanceErrorPc } : null
}

function distanceFact(star: Star, distancePc: number, errorPc: number | null, unit: DistanceUnit): Fact {
  const scale = unit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
  const parallax = parallaxDistance(star, distancePc)
  const step = errorPc ? precision(errorPc * scale) : 0
  const parallaxStep = parallax ? precision(parallax.errorPc * scale) : 0
  return {
    title: 'Distance from Sun today', icon: Ruler, unit,
    value: step ? rounded(distancePc * scale, step) : number(distancePc * scale),
    notes: [errorPc ? `± ${rounded(errorPc * scale, step)} ${unit}`
      : parallax ? `Parallax alone: ${rounded(parallax.parallaxPc * scale, parallaxStep)} ± ${rounded(parallax.errorPc * scale, parallaxStep)} ${unit}`
        : star.compact?.distance_method ?? 'Uncertainty unavailable'],
  }
}

function lightFact(distancePc: number, errorPc: number | null): Fact {
  const years = distancePc * LIGHT_YEARS_PER_PARSEC
  const step = Math.max(1, errorPc ? precision(errorPc * LIGHT_YEARS_PER_PARSEC) : 10 ** (Math.floor(Math.log10(years)) - 2))
  const now = new Date()
  const start = new Date(now.getFullYear(), 0)
  const end = new Date(now.getFullYear() + 1, 0)
  const departure = now.getFullYear() + (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) - years
  const year = step === 1 ? Math.floor(departure) : Math.round(departure / step) * step
  // Exact years count BCE from 1 (no year 0); rounded ones stay round.
  const [value, unit] = year >= 1000 ? [String(year), ''] : year > 0 ? [String(year), 'CE']
    : [Math.max(1, step === 1 ? 1 - year : -year).toLocaleString('en-US'), 'BCE']
  return { title: 'Light we see left in', icon: CalendarClock, value: `${step > 1 ? '~' : ''}${value}`, unit, notes: [`${number(years)} years in transit`] }
}

function radialFact(star: Star, unit: DistanceUnit, comparing: boolean): Fact {
  const velocity = galacticVelocityToWorld(star)
  const observed = star.radial_velocity_observation
  const raw = star.raw_astrometry
  const source = radialVelocitySource(star)?.record.raw_astrometry
  const speed = radialVelocityKms(star)
  const fact = { title: 'Radial velocity', icon: ArrowLeftRight }
  if (speed === null) {
    return { ...fact, value: MISSING_VALUE, unit: '', notes: [raw ? 'Radial velocity unavailable; only motion across the sky is measured.' : 'Motion data unavailable.'] }
  }
  const error = velocity ? raw?.radial_velocity_error_kms ?? source?.radial_velocity_error_kms : observed ? observed.error_kms : source?.radial_velocity_error_kms
  const scope = velocity ? spaceMotionForStar(star).systemicMotion ? 'System bulk motion' : '' : observed ? 'Includes orbital motion' : 'System velocity'
  const closest = closestApproach(star)
  const scale = unit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
  const when = closest && rounded(Math.abs(closest.years), coarseStep(closest.years, closest.yearsError))
  const where = closest && `${rounded(closest.distancePc * scale, coarseStep(closest.distancePc * scale, closest.distanceErrorPc * scale))} ${unit}`
  return {
    ...fact, value: number(Math.abs(speed)), unit: `km/s ${speed < 0 ? 'approaching' : 'receding'}`,
    bar: {
      gradient: radialGradient(DEFAULT_PAINT_LEVEL, DEFAULT_PAINT_CONTROLS),
      marker: 50 + 50 * Math.max(-1, Math.min(1, speed / RADIAL_VELOCITY_LIMIT)),
    },
    notes: [
      ...(error ? [`± ${number(error)} km/s`] : []), scope,
      ...(closest ? [closest.years >= 0 ? `Closest approach in ${when} years at ${where}` : `Closest approach was ${when} years ago at ${where}`] : []),
      // Paired cells are too narrow for a conversion.
      ...(comparing ? [] : [`${number(motionTravelDistancePc(Math.abs(speed), 1000) * scale)} ${unit} ${speed < 0 ? 'closer' : 'farther'} every 1,000 years`]),
    ],
  }
}

/** Sun-relative measurements for the selected object and any comparison object; the Sun itself is omitted. */
export function renderDistanceFacts(card: HTMLElement, selected: Star, sun: Star, colorMode: StarColorMode, unit: DistanceUnit, other?: Star): void {
  const shown = [selected, ...(other ? [other] : [])].filter((star) => star.id !== sun.id)
  const comparing = shown.length > 1
  card.classList.toggle('has-comparison', comparing)
  const facts = shown.map((star) => {
    const { distancePc } = sunRelativeMetrics(star, sun)
    const parallax = parallaxDistance(star, distancePc)
    const errorPc = parallax?.adopted ? parallax.errorPc : star.nebula?.distance_error_pc ?? null
    return [distanceFact(star, distancePc, errorPc, unit), lightFact(distancePc, errorPc), radialFact(star, unit, comparing)]
  })
  const container = card.querySelector<HTMLElement>('#distance-facts')!
  container.hidden = shown.length === 0
  container.replaceChildren(...(facts[0] ?? []).map((_, row) => renderFact(facts.map((entry) => entry[row]!), shown, colorMode, row === 0)))
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
  const appearance = createStarAppearance(previewDistance)
  const geometry = new BufferGeometry()
  for (const [name, size] of Object.entries({
    position: 3, color: 3, coreDiameter: 1, coreEmphasis: 1, coreWhiteStrength: 1,
    haloDiameter: 1, haloOpacity: 1,
  })) geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(6 * size), size))
  geometry.setIndex(new Uint16BufferAttribute(new Uint16Array(6), 1))
  const cores = new Points(geometry, appearance.starMaterial)
  const halos = new Points(geometry, appearance.haloMaterial)
  cores.frustumCulled = halos.frustumCulled = false
  cores.renderOrder = 2
  halos.renderOrder = 3
  scene.add(cores, halos)
  return { renderer, scene, camera, geometry, appearance }
}
let pointRenderer: ReturnType<typeof createPointRenderer> | undefined
let portraitSource: HTMLCanvasElement | undefined
const renderSize = new Vector2()

// The outer ring snaps to a 1–2–5 distance and eases between them, so radial motion stays visible.
const ZOOM_MS = 450
const zoom = { ringPc: 0, unit: 'ly' as DistanceUnit, fromPc: 0, start: 0, frame: 0 }

function ringFor(distancePc: number, unit: DistanceUnit): number {
  const unitScale = unit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
  const value = distancePc * unitScale
  const power = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 5, 10].find((step) => step * power >= value * (1 - 1e-9))! * power / unitScale
}

/** The displayed outer-ring distance; zooms when the farthest star leaves 40–100% of the ring. */
function zoomRing(distancePc: number, unit: DistanceUnit, redraw: () => void): number {
  const now = performance.now()
  const current = () => {
    const progress = Math.min(1, (now - zoom.start) / ZOOM_MS)
    return progress >= 1 ? zoom.ringPc : zoom.fromPc * (zoom.ringPc / zoom.fromPc) ** (1 - (1 - progress) ** 3)
  }
  if (distancePc > 0 && (unit !== zoom.unit || !(distancePc <= zoom.ringPc * (1 + 1e-9) && distancePc >= zoom.ringPc * 0.4))) {
    const target = ringFor(distancePc, unit)
    const animate = zoom.ringPc > 0 && unit === zoom.unit && !matchMedia('(prefers-reduced-motion: reduce)').matches
    zoom.fromPc = animate ? current() : target
    zoom.start = animate ? now : 0
    zoom.ringPc = target
    zoom.unit = unit
  }
  const shown = current()
  cancelAnimationFrame(zoom.frame)
  zoom.frame = shown === zoom.ringPc ? 0 : requestAnimationFrame(redraw)
  return shown
}

export function disposeDistanceComparison(): void {
  cancelAnimationFrame(zoom.frame)
  Object.assign(zoom, { ringPc: 0, fromPc: 0, start: 0, frame: 0 })
  if (!pointRenderer) return
  const { renderer, geometry, appearance } = pointRenderer
  geometry.dispose()
  appearance.dotTexture.dispose()
  appearance.haloTexture.dispose()
  appearance.starMaterial.dispose()
  appearance.haloMaterial.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  pointRenderer = undefined
  portraitSource = undefined
}

export function renderDistanceComparison(
  canvas: HTMLCanvasElement, selected: Star, reference: Star, colorMode: StarColorMode, unit: DistanceUnit = 'ly',
  years = 0, frame: MotionFrame = 'galactic', other?: Star,
): void {
  const comparisons = [selected, ...(other ? [other] : [])].map((star) => ({ star, geometry: distanceGeometry(star, reference, years, frame) }))
  const { distancePc, heightPc } = comparisons[0]!.geometry
  const maximumDistance = Math.max(...comparisons.map(({ geometry }) => geometry.distancePc))
  const ringPc = zoomRing(maximumDistance, unit, () => renderDistanceComparison(canvas, selected, reference, colorMode, unit, years, frame, other))
  const scale = ringPc > 0 ? RADIUS / ringPc : 0
  const ringLabel = zoom.ringPc > 0 ? `${number(zoom.ringPc * (unit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1))} ${unit}` : null
  const left = { x: WIDTH / 4, y: CENTER_Y }
  const right = { x: WIDTH * 3 / 4, y: CENTER_Y }
  const projections = comparisons.map(({ star, geometry }, index) => ({
    star, geometry, color: index === 0 ? '#de995f' : '#94b7da',
    top: { x: left.x + geometry.topX * scale, y: left.y + geometry.topY * scale },
    side: { x: right.x + geometry.sideX * scale, y: right.y + geometry.sideY * scale },
  }))
  const portrait = window.matchMedia('(max-width: 720px) and (orientation: portrait)').matches
  // Draw both projections at their usual scale, then stack the panes for phones.
  const source = portrait ? portraitSource ??= document.createElement('canvas') : canvas
  const context = source.getContext('2d')
  if (!context) return
  const ratio = Math.min(3, window.devicePixelRatio || 1)
  // Keep text and point sizes consistent at every card width.
  const displayWidth = portrait ? WIDTH / 2 : WIDTH
  const displayScale = (canvas.getBoundingClientRect().width || displayWidth) / displayWidth
  source.width = portrait ? 2 * Math.round(WIDTH / 2 * displayScale * ratio) : Math.round(WIDTH * displayScale * ratio)
  source.height = Math.round(HEIGHT * displayScale * ratio)
  context.scale(source.width / WIDTH, source.height / HEIGHT)
  context.fillStyle = '#090b10'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  const fontFamily = getComputedStyle(canvas).fontFamily
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
    context.font = `${size}px ${fontFamily}`
    context.textAlign = 'center'
    context.fillText(value, x, y)
  }
  if (!portrait) line(WIDTH / 2, 0, WIDTH / 2, HEIGHT, '#262c36')
  // The horizontal arrow points toward Galactic +X, on the right of this view.
  label('Galactic center →', WIDTH / 2 - 77, 24, '#8a98ac', 10)
  // Rings sit at fixed 1–2–5 distances, so they sweep in or out while the view zooms.
  // They fade in away from the center and fade out past the outer ring; outer rings carry their distance.
  const ringLabelY = left.y - RADIUS - 5
  const unitScale = unit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
  const pixelsPerUnit = scale / unitScale
  const rings = pixelsPerUnit > 0 ? [] : [{ radius: RADIUS, alpha: 1, distance: 0 }]
  for (let power = 10 ** Math.floor(Math.log10(12 / pixelsPerUnit)); pixelsPerUnit > 0 && power * pixelsPerUnit <= RADIUS * 1.25; power *= 10) {
    for (const step of [1, 2, 5]) {
      const radius = step * power * pixelsPerUnit
      const alpha = Math.min(1, (radius - 12) / 12, 1 - (radius - RADIUS) / (RADIUS * 0.25))
      if (alpha > 0) rings.push({ radius, alpha, distance: step * power })
    }
  }
  context.strokeStyle = '#27313e'
  for (const { radius, alpha, distance } of rings) {
    context.globalAlpha = alpha
    context.beginPath()
    context.arc(left.x, left.y, radius, 0, 2 * Math.PI)
    context.stroke()
    if (distance && radius >= RADIUS * 0.6) label(`${number(distance)} ${unit}`, left.x, left.y - radius - 5, '#7e8999', 10)
  }
  context.globalAlpha = 1
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    line(left.x, left.y, left.x + Math.cos(angle) * RADIUS, left.y + Math.sin(angle) * RADIUS, '#1d2632')
  }
  for (const { top, color } of projections) line(left.x, left.y, top.x, top.y, color)
  // The height guide retains the map's relative world-Y separation.
  context.fillStyle = '#283b551d'
  context.fillRect(WIDTH / 2 + 18, right.y - 5, WIDTH / 2 - 36, 10)
  line(WIDTH / 2 + 18, right.y, WIDTH - 18, right.y, '#536579')
  for (const { side, geometry, color } of projections) {
    line(right.x, right.y, side.x, side.y, color)
    line(side.x, side.y, side.x, right.y, color, true)
    if (Math.abs(geometry.heightPc) > 1e-9) line(side.x - 3, right.y, side.x + 3, right.y, color)
  }
  const [ly, pc] = units(distancePc)
  const [heightLy, heightPcLabel] = units(Math.abs(heightPc))
  const points = pointRenderer ??= createPointRenderer()
  const renderWidth = WIDTH * displayScale
  const renderHeight = HEIGHT * displayScale
  const currentSize = points.renderer.getSize(renderSize)
  if (points.renderer.getPixelRatio() !== ratio) points.renderer.setPixelRatio(ratio)
  if (currentSize.x !== renderWidth || currentSize.y !== renderHeight) points.renderer.setSize(renderWidth, renderHeight, false)
  const marks = [0, 1].flatMap((pane) => [
    { star: reference, point: pane === 0 ? left : right, pane, reference: true },
    ...projections.map(({ star, top, side }) => ({ star, point: pane === 0 ? top : side, pane, reference: false })),
  ])
  for (const [index, { star, point }] of marks.entries()) {
    const color = starDisplayColor(star, colorMode)
    const isSelected = star.id === selected.id
    const magnitude = star.absolute_mag
    const emphasis = starHaloEmphasis(magnitude)
    points.geometry.getAttribute('position').setXYZ(index, point.x, -point.y, 0)
    points.geometry.getAttribute('color').setXYZ(index, color.r, color.g, color.b)
    const attributes = {
      coreDiameter: STAR_DIAMETER_PX * displayScale, coreEmphasis: emphasis,
      coreWhiteStrength: starCoreWhiteStrength(star), haloDiameter: Math.max(36, starHaloDiameter(magnitude)) * displayScale,
      haloOpacity: Math.max(0.5, starHaloOpacity(magnitude, isSelected)),
    }
    for (const [name, value] of Object.entries(attributes)) points.geometry.getAttribute(name).setX(index, value)
  }
  // Keep coincident projections honest: don't move either star to invent a gap.
  const index = points.geometry.index!
  let visibleCount = 0
  for (const [markIndex, { point, pane }] of marks.entries()) {
    if (marks.slice(0, markIndex).some((previous) => previous.pane === pane && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < 0.01)) continue
    index.setX(visibleCount++, markIndex)
  }
  index.needsUpdate = true
  points.geometry.setDrawRange(0, visibleCount)
  for (const attribute of Object.values(points.geometry.attributes)) attribute.needsUpdate = true
  points.renderer.render(points.scene, points.camera)
  // Composite light over the guides. An opaque black render target avoids
  // premultiplied-alpha artifacts from the map's additive halo materials.
  context.save()
  context.globalCompositeOperation = 'screen'
  context.drawImage(points.renderer.domElement, 0, 0, WIDTH, HEIGHT)
  context.restore()
  // Place each measurement directly below its star name, using one shared color.
  type Bounds = { left: number; top: number; right: number; bottom: number }
  const occupied: Bounds[] = marks.map(({ point }) => ({ left: point.x - 8, right: point.x + 8, top: point.y - 8, bottom: point.y + 8 }))
  if (ringLabel) {
    context.font = `10px ${fontFamily}`
    const halfWidth = context.measureText(ringLabel).width / 2
    occupied.push({ left: left.x - halfWidth, right: left.x + halfWidth, top: ringLabelY - 9, bottom: ringLabelY + 2 })
  }
  const fitName = (name: string, maxWidth: number) => {
    let displayed = name
    while (context.measureText(displayed).width > maxWidth && displayed.length > 1) displayed = displayed.slice(0, -1)
    return displayed === name ? name : `${displayed.slice(0, -1)}…`
  }
  context.font = `11px ${fontFamily}`
  for (const pane of [0, 1]) {
    const rows = comparisons.map(({ star, geometry }) => ({
      star,
      value: units(pane === 0 ? geometry.distancePc : Math.abs(geometry.heightPc))[unit === 'ly' ? 1 : 0],
    }))
    const valueWidth = Math.max(...rows.map(({ value }) => context.measureText(value).width))
    const right = (pane + 1) * WIDTH / 2 - 12
    for (const [index, { star, value }] of rows.entries()) {
      const y = HEIGHT - 12 - (rows.length - 1 - index) * 17
      const nameRight = right - valueWidth - 8
      const name = fitName(star.name, WIDTH / 2 - 32 - valueWidth)
      context.fillStyle = starDisplayColor(star, colorMode).getStyle()
      context.textAlign = 'right'
      context.fillText(name, nameRight, y)
      context.fillText(value, right, y)
      occupied.push({ left: nameRight - context.measureText(name).width, right, top: y - 12, bottom: y + 3 })
    }
  }
  const overlaps = (a: Bounds, b: Bounds) => a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom + 3 && a.bottom > b.top - 3
  const annotate = (lines: string[], candidates: { x: number; y: number }[], pane: number, color: string) => {
    const maxWidth = WIDTH / 2 - 32
    context.font = `11px ${fontFamily}`
    const displayed = [fitName(lines[0]!, maxWidth), ...lines.slice(1)]
    const width = Math.max(...displayed.map((value, index) => {
      context.font = `${index === 0 ? 11 : 12}px ${fontFamily}`
      return context.measureText(value).width
    }))
    const height = displayed.length === 1 ? 14 : 30
    const placements = candidates.map(({ x, y }) => {
      const left = Math.max(pane + 12, Math.min(pane + WIDTH / 2 - 12 - width, x))
      const top = Math.max(34, Math.min(HEIGHT - 12 - height, y - 11))
      return { left, top, right: left + width, bottom: top + height }
    })
    const bounds = placements.find((candidate) => !occupied.some((other) => overlaps(candidate, other)))
      ?? placements.reduce((best, candidate) => occupied.filter((other) => overlaps(candidate, other)).length < occupied.filter((other) => overlaps(best, other)).length ? candidate : best)
    context.textAlign = 'left'
    context.lineWidth = 4
    context.lineJoin = 'round'
    context.strokeStyle = '#090b10'
    context.fillStyle = color
    for (const [index, value] of displayed.entries()) {
      context.font = `${index === 0 ? 11 : 12}px ${fontFamily}`
      const baseline = bounds.top + 11 + index * 16
      context.strokeText(value, bounds.left, baseline)
      context.fillText(value, bounds.left, baseline)
    }
    occupied.push(bounds)
  }
  for (const { star, point, pane, reference: isReference } of marks) {
    if (!isReference && star.id === reference.id) continue
    const comparison = comparisons.find((candidate) => candidate.star.id === star.id)
    const metric = comparison ? pane === 0 ? comparison.geometry.distancePc : Math.abs(comparison.geometry.heightPc) : null
    const lines = [star.name, ...(metric === null ? [] : [units(metric)[unit === 'ly' ? 0 : 1]])]
    context.font = `11px ${fontFamily}`
    const width = Math.max(...lines.map((value) => context.measureText(value).width))
    const center = pane === 0 ? left : right
    const coincident = !isReference && Math.hypot(point.x - center.x, point.y - center.y) < 8
    const preferredY = point.y + (coincident ? 22 : -13)
    annotate(lines, [
      { x: point.x + 12, y: preferredY }, { x: point.x - width - 12, y: preferredY },
      { x: point.x + 12, y: point.y + 24 }, { x: point.x - width - 12, y: point.y + 24 },
      { x: point.x - width / 2, y: point.y - 34 }, { x: point.x - width / 2, y: point.y + 32 },
    ], pane * WIDTH / 2, starDisplayColor(star, colorMode).getStyle())
  }
  const heightSign = heightPc < 0 ? '−' : heightPc > 0 ? '+' : ''
  if (portrait) {
    const output = canvas.getContext('2d')
    if (!output) return
    const paneWidth = source.width / 2
    const paneHeight = source.height
    canvas.width = paneWidth
    canvas.height = paneHeight * 2
    output.drawImage(source, 0, 0, paneWidth, paneHeight, 0, 0, paneWidth, paneHeight)
    output.drawImage(source, paneWidth, 0, paneWidth, paneHeight, 0, paneHeight, paneWidth, paneHeight)
    output.fillStyle = '#262c36'
    output.fillRect(0, paneHeight, paneWidth, displayScale * ratio)
  }
  const otherDescription = other ? ` ${other.name} from ${reference.name}: ${units(comparisons[1]!.geometry.distancePc).join(', ')}. Shared distance scale for both stars.` : ''
  canvas.setAttribute('aria-label', `${selected.name} from ${reference.name}: ${ly}, ${pc}.${otherDescription} Top view: Galactic center right${ringLabel ? `, outer ring ${ringLabel}` : ''}. Side view: ${heightSign}${heightLy}, ${heightSign}${heightPcLabel} vertical separation. Measurements use ${unit}.`)
}
