import type { Star } from './catalog-model'
import { LIGHT_YEARS_PER_PARSEC, starDisplayColor, type DistanceUnit, type StarColorMode } from './astronomy'
import { constellationStarObjects, objectSkyPosition, projectConstellationPosition, type ConstellationChart } from './constellations'
import { constellationStarDiameter, disposeConstellationStars, renderConstellationStars, type ConstellationMarker } from './constellation-star-appearance'
import { renderConstellationVisibility } from './constellation-visibility-card'
import { constellationGrid } from './constellation-grid'
import { constellationInfoAvailable, constellationInfoLinks, loadConstellationInfo } from './constellation-info'
import { createLoadError } from './load-recovery'
import { streamWhenLoaded } from './content-stream'
import { renderObjectInfoContent } from './object-info-content'
import { MISSING_VALUE, quantity } from './format'
import { starComponentIdentity } from './star-systems'
import { svgNode as svg } from './spectral-chart'
import { hideTouchTooltip, registerTouchTooltip, showTouchTooltip, touchTooltipOpen, usingTouchTooltips } from './touch-tooltips'

type Point = { x: number; y: number }
type Box = { left: number; top: number; right: number; bottom: number }
const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
interface CardOptions { objects: readonly Star[]; colorMode: StarColorMode; distanceUnit: DistanceUnit; magnified: boolean; equatorialGrid: boolean; onSelect: (object: Star) => void }
const MAGNIFICATION = 3
interface CardState {
  object: Star | null; chart: ConstellationChart; options: CardOptions; observer: ResizeObserver; width: number; height: number
  info: boolean; infoFor?: readonly [ConstellationChart, readonly Star[]]
}
const cards = new Map<HTMLElement, CardState>()

function part<T extends HTMLElement = HTMLElement>(root: HTMLElement, name: string): T {
  return root.querySelector<T>(`[data-constellation-part="constellation-${name}"]`)!
}

function placeLabels(diagram: SVGSVGElement, width: number, height: number): void {
  const markers = [...diagram.querySelectorAll<SVGGElement>('.constellation-star')]
  const obstacles: Box[] = markers.map((marker) => {
    const x = Number(marker.dataset.x), y = Number(marker.dataset.y)
    const r = marker.classList.contains('is-selected') ? 12 : 8
    return { left: x - r, top: y - r, right: x + r, bottom: y + r }
  })
  for (const text of diagram.querySelectorAll<SVGTextElement>('.constellation-neighbor, .constellation-grid-label')) {
    const box = text.getBBox()
    obstacles.push({ left: box.x - 3, top: box.y - 3, right: box.x + box.width + 3, bottom: box.y + box.height + 3 })
  }
  // Reserve the selected name first, then fit the Greek designations around it.
  markers.sort((a, b) => Number(b.classList.contains('is-selected')) - Number(a.classList.contains('is-selected')))
  for (const marker of markers) {
    const labels = [...marker.querySelectorAll<SVGTextElement>('.constellation-star-name, .constellation-bayer')]
      .sort((a, b) => Number(b.classList.contains('constellation-star-name')) - Number(a.classList.contains('constellation-star-name')))
    for (const label of labels) {
      const x = Number(marker.dataset.x), y = Number(marker.dataset.y)
      const selected = marker.classList.contains('is-selected')
      const gap = selected ? 18 : 12
      const measured = label.getBBox()
      const labelWidth = measured.width, baselineOffset = measured.y - Number(label.getAttribute('y'))
      const candidates = [
        { x: x + gap, y: y + 4, anchor: 'start' }, { x: x - gap, y: y + 4, anchor: 'end' },
        { x, y: y - gap, anchor: 'middle' }, { x, y: y + gap + 11, anchor: 'middle' },
        { x: x + gap, y: y - gap, anchor: 'start' }, { x: x - gap, y: y - gap, anchor: 'end' },
        { x: x + gap, y: y + gap + 11, anchor: 'start' }, { x: x - gap, y: y + gap + 11, anchor: 'end' },
      ]
      // Longer offsets provide a leader-line fallback for tightly packed stars.
      for (const offset of [26, 42, 62, 82]) {
        for (const vertical of [0, -26, 26, -42, 42]) {
          candidates.push({ x: x + offset, y: y + 4 + vertical, anchor: 'start' },
            { x: x - offset, y: y + 4 + vertical, anchor: 'end' })
        }
        candidates.push({ x, y: y - offset, anchor: 'middle' }, { x, y: y + offset, anchor: 'middle' })
      }
      const ranked = candidates.map((candidate, index) => {
        const left = candidate.x - (candidate.anchor === 'end' ? labelWidth : candidate.anchor === 'middle' ? labelWidth / 2 : 0)
        const box = { left: left - 3, right: left + labelWidth + 3,
          top: candidate.y + baselineOffset - 3, bottom: candidate.y + baselineOffset + measured.height + 3 }
        const outside = box.left < 12 || box.right > width - 12 || box.top < 14 || box.bottom > height - 14
        const collisions = obstacles.filter((obstacle) => intersects(box, obstacle)).length
        return { ...candidate, box, index, score: (outside ? 1000000 : 0) + collisions * 10000 + index }
      })
      const best = ranked.reduce((a, b) => a.score <= b.score ? a : b)
      label.setAttribute('x', String(best.x))
      label.setAttribute('y', String(best.y))
      label.setAttribute('text-anchor', best.anchor)
      obstacles.push(best.box)
      if (best.index >= 8) {
        const endX = Math.max(best.box.left + 3, Math.min(best.box.right - 3, x))
        const endY = best.y - 4
        const length = Math.hypot(endX - x, endY - y)
        const r = selected ? 13 : 7
        marker.insertBefore(svg('line', { x1: x + (endX - x) * r / length, y1: y + (endY - y) * r / length,
          x2: endX, y2: endY, class: 'constellation-label-leader' }), label)
      }
    }
  }
}

function drawChart(root: HTMLElement, object: Star | null, chart: ConstellationChart, options: CardOptions): void {
  const container = part(root, 'chart')
  const focused = root.contains(document.activeElement) ? document.activeElement?.closest<SVGGElement>('.constellation-star')?.dataset.hip : undefined
  const width = Math.max(250, container.clientWidth || 380)
  const preferredHeight = Math.max(340, Math.round(width * 0.94))
  const headingHeight = part(root, 'heading').closest<HTMLElement>('.panel-heading')!.offsetHeight
  // Discover's full overview fits below its heading, including on short screens.
  // Convert available CSS pixels to the SVG's coordinate scale on narrow cards.
  const availableHeight = (root.clientHeight - headingHeight - 1) * width / Math.max(1, container.clientWidth)
  const height = !object && root.clientHeight ? Math.max(96, Math.min(preferredHeight, Math.floor(availableHeight))) : preferredHeight
  cards.get(root)!.width = container.clientWidth
  cards.get(root)!.height = root.clientHeight
  const position = object ? objectSkyPosition(object) : chart.center
  const selectedPoint = object && position && projectConstellationPosition(position, chart.center)
  const magnified = Boolean(options.magnified && (!object || selectedPoint))
  const magnifyButton = part<HTMLButtonElement>(root, 'magnify')
  if (magnifyButton) {
    magnifyButton.disabled = Boolean(object && !selectedPoint)
    magnifyButton.setAttribute('aria-pressed', String(magnified))
    magnifyButton.title = magnified ? 'Reset constellation view' : object ? 'Magnify selected star' : 'Magnify constellation'
  }
  const gridButton = part<HTMLButtonElement>(root, 'grid')
  gridButton.setAttribute('aria-pressed', String(options.equatorialGrid))
  gridButton.title = options.equatorialGrid ? 'Hide equatorial grid' : 'Show equatorial grid'
  const points = chart.stars.map((star) => ({ star, point: projectConstellationPosition(star, chart.center)! }))
  const borders = chart.boundaries.map((boundary) => ({ ...boundary, projected: boundary.points.map((point) => projectConstellationPosition(point, chart.center)!) }))
  // Favor a large figure, with just enough room to keep the IAU outline visible.
  const all = [...points.map(({ point }) => point), ...(selectedPoint ? [selectedPoint] : [])]
  const left = Math.min(...all.map((p) => p.x)), right = Math.max(...all.map((p) => p.x))
  const top = Math.min(...all.map((p) => p.y)), bottom = Math.max(...all.map((p) => p.y))
  const outline = [...all, ...borders.flatMap((border) => border.projected)]
  const outlineLeft = Math.min(...outline.map((p) => p.x)), outlineRight = Math.max(...outline.map((p) => p.x))
  const outlineTop = Math.min(...outline.map((p) => p.y)), outlineBottom = Math.max(...outline.map((p) => p.y))
  let scale = Math.min((width - 56) / Math.max(right - left, 0.01), (height - 72) / Math.max(bottom - top, 0.01),
    (width - 28) / Math.max(outlineRight - outlineLeft, 0.01), (height - 28) / Math.max(outlineBottom - outlineTop, 0.01))
  const halfWidth = (width / 2 - 14) / scale, halfHeight = (height / 2 - 14) / scale
  let centerX = Math.max(outlineRight - halfWidth, Math.min(outlineLeft + halfWidth, (left + right) / 2))
  let centerY = Math.max(outlineBottom - halfHeight, Math.min(outlineTop + halfHeight, (top + bottom) / 2))
  if (magnified) {
    scale *= object ? MAGNIFICATION : 1.75
    centerX = selectedPoint ? selectedPoint.x : (left + right) / 2
    centerY = selectedPoint ? selectedPoint.y : (top + bottom) / 2
  }
  const screen = (p: Point): Point => ({ x: width / 2 + (p.x - centerX) * scale, y: height / 2 + (p.y - centerY) * scale })
  const id = (suffix: string) => `${container.id}-${suffix}`
  const diagram = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': object ? `${chart.name}: ${object.name}` : chart.name, 'aria-describedby': id('description') })
  diagram.append(svg('desc', { id: id('description') }, `Catalogue sky view from Earth, north up and east left. ${magnified ? object ? `Magnified around ${object.name}. ` : 'Magnified constellation overview. ' : ''}${object ? selectedPoint ? `${object.name} is circled in orange.` : `A sky position is unavailable for ${object.name}.` : ''} Figure stars: ${chart.stars.map((star) => star.name).join(', ')}. Solid lines show the Western figure; spaced dashed lines show IAU boundaries. Neighboring constellations: ${[...new Set(borders.map((border) => border.neighbor))].join(', ')}. Stars can be selected; focus or hover reveals their distance from the Sun and apparent magnitude.`))
  const lineMask = svg('mask', { id: id('line-mask'), maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height })
  lineMask.append(svg('rect', { x: 0, y: 0, width, height, fill: 'white' }))
  const definitions = svg('defs')
  definitions.append(lineMask)
  const lines = svg('g', { mask: `url(#${id('line-mask')})` })
  diagram.append(definitions, lines)
  if (options.equatorialGrid) {
    const grid = constellationGrid({ center: chart.center, centerX, centerY, scale, width, height })
    const layer = svg('g', { class: 'constellation-grid', 'data-ra-step': grid.raStep, 'data-dec-step': grid.decStep, 'aria-hidden': 'true' })
    const labels: Box[] = []
    for (const line of grid.lines) {
      layer.append(svg('path', { d: line.path, class: 'constellation-grid-line', 'data-axis': line.axis, 'data-coordinate': line.value }))
      if (!line.edge) continue
      const x = Math.max(6, Math.min(width - 6, line.edge.x))
      const y = Math.max(13, Math.min(height - 6, line.edge.y))
      const anchor = x < 40 ? 'start' : x > width - 40 ? 'end' : 'middle'
      const labelWidth = line.label.length * 7
      const left = x - (anchor === 'end' ? labelWidth : anchor === 'middle' ? labelWidth / 2 : 0)
      const box = { left: left - 4, right: left + labelWidth + 4, top: y - 14, bottom: y + 5 }
      if (labels.some((other) => intersects(box, other))) continue
      labels.push(box)
      layer.append(svg('text', { x, y, 'text-anchor': anchor, class: 'constellation-grid-label' }, line.label))
    }
    // Grid strokes stay behind boundaries, figure strokes, and selectable stars.
    diagram.insertBefore(layer, lines)
    diagram.querySelector('desc')!.textContent += ` Equatorial grid: right ascension every ${grid.raStep / 15} hours and declination every ${grid.decStep} degrees.`
  }
  const neighborEdges = new Map<string, typeof borders[number]>()
  for (const boundary of borders) {
    const path = boundary.projected.map((point, i) => { const p = screen(point); return `${i ? 'L' : 'M'}${p.x},${p.y}` }).join(' ')
    lines.append(svg('path', { d: path, class: 'constellation-boundary', 'data-neighbor': boundary.neighbor }))
    const previous = neighborEdges.get(boundary.neighbor)
    if (!previous || boundary.projected.length > previous.projected.length) neighborEdges.set(boundary.neighbor, boundary)
  }
  const neighbors = (magnified ? [] : [...neighborEdges]).map(([name, edge]) => ({ name, point: screen(edge.projected[Math.floor(edge.projected.length / 2)]!) }))
    .sort((a, b) => a.point.x - b.point.x)
  const split = Math.ceil(neighbors.length / 2)
  for (const [side, group] of [neighbors.slice(0, split), neighbors.slice(split)].entries()) {
    group.sort((a, b) => a.point.y - b.point.y)
    for (const [index, neighbor] of group.entries()) {
      diagram.append(svg('text', { x: side === 0 ? 12 : width - 12,
        y: group.length === 1 ? height / 2 : 18 + index * (height - 32) / (group.length - 1),
        'text-anchor': side === 0 ? 'start' : 'end', class: 'constellation-neighbor' }, neighbor.name))
    }
  }
  const byHip = new Map(points.map(({ star, point }) => [star.hip, screen(point)]))
  for (const [a, b] of chart.lines) {
    const start = byHip.get(a)!, end = byHip.get(b)!
    lines.append(svg('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'constellation-line' }))
  }
  const canonicalId = object ? starComponentIdentity(object.id)?.canonicalStarId ?? object.id : null
  const figureObjects = constellationStarObjects(chart, options.objects)
  const marks: ConstellationMarker[] = []
  const tooltips: HTMLElement[] = []
  const attachTooltip = (marker: SVGGElement, physical: Star, p: Point, id: string, apparentMagnitude = physical.apparent_mag ?? null) => {
    const tooltip = document.createElement('span')
    tooltip.id = id
    tooltip.className = 'tooltip mass-metric-tooltip constellation-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    marker.setAttribute('aria-describedby', id)
    const heading = document.createElement('span'), icon = document.createElement('span'), name = document.createElement('strong')
    heading.className = 'constellation-tooltip-object'
    icon.className = 'star-swatch'
    icon.style.backgroundColor = starDisplayColor(physical, options.colorMode).getStyle()
    icon.setAttribute('aria-hidden', 'true')
    name.textContent = physical.name
    heading.append(icon, name)
    tooltip.append(heading)
    const distancePc = Math.hypot(physical.x_pc, physical.y_pc, physical.z_pc)
    const distance = distancePc * (options.distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1)
    const metrics = [
      ['Distance from Sun', distancePc * LIGHT_YEARS_PER_PARSEC < 50
        ? `${distance.toFixed(1)} ${options.distanceUnit}` : quantity(Math.round(distance), options.distanceUnit, 0)],
      ['Apparent magnitude', apparentMagnitude === null ? MISSING_VALUE : apparentMagnitude.toFixed(1)],
    ]
    for (const [term, value] of metrics) {
      const row = document.createElement('span'), label = document.createElement('span'), measurement = document.createElement('strong')
      row.className = 'constellation-tooltip-metric'
      label.textContent = term!
      measurement.textContent = value!
      row.append(label, measurement)
      tooltip.append(row)
    }
    const showTooltip = () => {
      for (const current of tooltips) current.classList.remove('is-visible')
      const tipWidth = Math.min(190, width - 24)
      const x = Math.max(12, Math.min(width - tipWidth - 12, p.x - tipWidth / 2))
      tooltip.style.left = `${x}px`
      tooltip.style.width = `${tipWidth}px`
      tooltip.style.setProperty('--constellation-tooltip-arrow', `${Math.max(12, Math.min(tipWidth - 20, p.x - x))}px`)
      tooltip.classList.add('is-visible')
      tooltip.style.top = `${Math.max(tooltip.offsetHeight + 12, p.y - 20)}px`
    }
    const hideTooltip = () => tooltip.classList.remove('is-visible')
    // Revealing content on touch makes mobile Safari swallow the click, so touch previews open on click.
    marker.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch') showTooltip() })
    marker.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch' && document.activeElement !== marker) hideTooltip() })
    marker.addEventListener('focus', showTooltip)
    marker.addEventListener('blur', hideTooltip)
    registerTouchTooltip(marker, {
      show: () => { marker.classList.add('is-previewed'); showTooltip() },
      hide: () => { marker.classList.remove('is-previewed'); hideTooltip() },
    })
    // The first tap previews a star; only a second tap on it changes the selection.
    marker.addEventListener('click', () => {
      if (usingTouchTooltips() && !touchTooltipOpen(marker)) { showTouchTooltip(marker, tooltip); return }
      hideTouchTooltip()
      hideTooltip()
      options.onSelect(physical)
    })
    marker.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hideTooltip(); options.onSelect(physical) }
    })
    tooltips.push(tooltip)
  }
  for (const { star, point } of points) {
    // Identity, not proximity: Sirius B must retain its own name and marker.
    const figureId = starComponentIdentity(`hip-${star.hip}`)?.canonicalStarId ?? `hip-${star.hip}`
    const knownObject = figureObjects.get(star.hip)!
    const selected = canonicalId === figureId || knownObject.id === object?.id
    const physical = selected && object ? object : knownObject
    const p = screen(selected && selectedPoint ? selectedPoint : point)
    // Cropped stars must not leave invisible buttons or labels in the zoomed view.
    if (magnified && (p.x < 12 || p.x > width - 12 || p.y < 12 || p.y > height - 12)) continue
    const magnitude = physical.apparent_mag ?? star.magnitude_v
    marks.push({ object: physical, x: p.x, y: p.y, magnitude })
    const marker = svg('g', { class: `constellation-star${selected ? ' is-selected' : ''}`, 'data-hip': star.hip, 'data-x': p.x, 'data-y': p.y,
      role: 'button', tabindex: 0, 'aria-label': `Select ${physical.name}`, 'aria-pressed': String(selected) })
    marker.append(svg('circle', { cx: p.x, cy: p.y, r: 12, class: 'constellation-star-hit' }))
    const color = starDisplayColor(physical, options.colorMode).getStyle()
    marker.style.setProperty('--constellation-star-color', color)
    if (star.bayer) marker.append(svg('text', { x: p.x - 16, y: p.y + 4, 'text-anchor': 'end', class: 'constellation-bayer' }, star.bayer))
    if (selected) marker.append(svg('circle', { cx: p.x, cy: p.y, r: 11, class: 'constellation-selected-ring' }))
    if (selected) marker.append(svg('text', { x: p.x, y: p.y, class: 'constellation-star-name' }, physical.name))
    attachTooltip(marker, physical, p, id(`tooltip-${star.hip}`), magnitude)
    diagram.append(marker)
  }
  if (object && selectedPoint && !diagram.querySelector('.is-selected')) {
    const p = screen(selectedPoint)
    marks.push({ object, x: p.x, y: p.y, magnitude: object.apparent_mag ?? null })
    const marker = svg('g', { class: 'constellation-star is-selected', 'data-object-id': object.id, 'data-object-type': object.type, 'data-x': p.x, 'data-y': p.y,
      role: 'button', tabindex: 0, 'aria-label': `Select ${object.name}`, 'aria-pressed': 'true' })
    marker.append(svg('circle', { cx: p.x, cy: p.y, r: 12, class: 'constellation-star-hit' }), svg('circle', { cx: p.x, cy: p.y, r: 11, class: 'constellation-selected-ring' }),
      svg('text', { x: p.x, y: p.y, class: 'constellation-star-name' }, object.name))
    attachTooltip(marker, object, p, id(`tooltip-${object.id}`))
    diagram.append(marker)
  }
  const canvas = document.createElement('canvas')
  canvas.className = 'constellation-star-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  // Hide strokes only beneath the star itself; lines remain visible through its glow.
  for (const { x, y, magnitude } of marks) {
    lineMask.append(svg('circle', { cx: x, cy: y, r: constellationStarDiameter(magnitude) / 2, fill: 'black' }))
  }
  container.replaceChildren(canvas, diagram, ...tooltips)
  renderConstellationStars(canvas, marks, width, height, options.colorMode)
  placeLabels(diagram, width, height)
  if (focused) diagram.querySelector<SVGGElement>(`[data-hip="${focused}"]`)?.focus({ preventScroll: true })
  const note = part(root, 'missing')
  note.hidden = !object || Boolean(selectedPoint)
  note.textContent = !object || selectedPoint ? '' : `Sky position unavailable for ${object.name}.`
  renderConstellationVisibility(part(root, 'visibility'), position, object?.name ?? chart.name)
}

export function renderConstellationCard(root: HTMLElement, object: Star | null, chart: ConstellationChart, options: CardOptions): void {
  let state = cards.get(root)
  if (!state) {
    const observer = new ResizeObserver(() => {
      const current = cards.get(root)
      if (!current || part(root, 'chart').closest('[hidden]')) return
      if (part(root, 'chart').clientWidth !== current.width || (!current.object && root.clientHeight !== current.height)) {
        drawChart(root, current.object, current.chart, current.options)
      }
    })
    state = { object, chart, options, observer, width: 0, height: 0, info: false }
    cards.set(root, state)
    observer.observe(part(root, 'chart'))
    if (!object) observer.observe(root)
  }
  // Info is not remembered: another constellation opens on its chart.
  if (state.chart !== chart) state.info = false
  Object.assign(state, { object, chart, options })
  part(root, 'heading').textContent = chart.name
  root.dataset.constellation = chart.abbreviation
  const links = part(root, 'source-links')
  links.replaceChildren(...chart.sources.map((source) => {
    const link = document.createElement('a')
    link.href = source.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = source.label
    return link
  }))
  syncInfo(root)
}

/** The Info toggle swaps the sky chart for the article while the card stays on this constellation. */
function syncInfo(root: HTMLElement): void {
  const state = cards.get(root)!
  const available = constellationInfoAvailable(state.chart.name)
  const showing = state.info && available
  const toggle = part<HTMLButtonElement>(root, 'info-toggle')
  toggle.disabled = !available
  toggle.title = available ? 'Info' : 'Info · No data yet'
  toggle.setAttribute('aria-label', toggle.title)
  toggle.setAttribute('aria-pressed', String(showing))
  toggle.onclick = () => {
    state.info = !showing
    syncInfo(root)
    root.querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  }
  part(root, 'sky').hidden = showing
  part(root, 'info').hidden = !showing
  // The chart controls do not apply to the article; drawChart restores the magnifier's own state.
  part<HTMLButtonElement>(root, 'grid').disabled = showing
  part<HTMLButtonElement>(root, 'magnify').disabled = showing
  if (showing) void renderInfo(root, state)
  else drawChart(root, state.object, state.chart, state.options)
}

async function renderInfo(root: HTMLElement, state: CardState): Promise<void> {
  const { chart, options } = state
  if (state.infoFor?.[0] === chart && state.infoFor[1] === options.objects) return
  const container = part(root, 'info')
  // Links resolve against the loaded objects, so a catalog or layer change re-renders the article.
  if (state.infoFor?.[0] !== chart) container.replaceChildren()
  const request = state.infoFor = [chart, options.objects] as const
  const current = () => cards.get(root) === state && state.infoFor === request
  container.setAttribute('aria-busy', 'true')
  try {
    await streamWhenLoaded(container, (async () => {
      const info = await loadConstellationInfo(chart.name)
      if (!current()) return
      renderObjectInfoContent(container, info, constellationInfoLinks(chart, options.objects, options.onSelect))
      // The hero image streams in with the article instead of appearing afterwards.
      await container.querySelector('img')?.decode().catch(() => undefined)
    })())
  } catch (error) {
    if (!current()) return
    state.infoFor = undefined
    container.replaceChildren(createLoadError(`${chart.name} Info`, () => syncInfo(root)))
    console.error('Could not load constellation Info.', error)
  }
  container.removeAttribute('aria-busy')
}

/** Closing a card forgets Info, so it reopens on the chart. */
export function resetConstellationInfo(root: HTMLElement): void {
  const state = cards.get(root)
  if (state) state.info = false
}

export function disposeConstellationCard(root?: HTMLElement): void {
  for (const [card, state] of cards) {
    if (root && card !== root) continue
    state.observer.disconnect()
    cards.delete(card)
  }
  if (!cards.size) disposeConstellationStars()
}
