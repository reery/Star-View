import type { Star } from './catalog-model'
import { LIGHT_YEARS_PER_PARSEC, starDisplayColor, type DistanceUnit, type StarColorMode } from './astronomy'
import { constellationStarObjects, objectSkyPosition, projectConstellationPosition, type ConstellationChart } from './constellations'
import { constellationStarDiameter, disposeConstellationStars, renderConstellationStars, type ConstellationMarker } from './constellation-star-appearance'
import { renderConstellationVisibility } from './constellation-visibility-card'
import { MISSING_VALUE, quantity } from './format'
import { starComponentIdentity } from './star-systems'
import { svgNode as svg } from './spectral-chart'

type Point = { x: number; y: number }
type Box = { left: number; top: number; right: number; bottom: number }
const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
interface CardOptions { objects: readonly Star[]; colorMode: StarColorMode; distanceUnit: DistanceUnit; onSelect: (object: Star) => void }
let active: { root: HTMLElement; object: Star; chart: ConstellationChart; options: CardOptions } | undefined
let observer: ResizeObserver | undefined
let lastWidth = 0

function placeLabels(diagram: SVGSVGElement, width: number, height: number): void {
  const markers = [...diagram.querySelectorAll<SVGGElement>('.constellation-star')]
  const obstacles: Box[] = markers.map((marker) => {
    const x = Number(marker.dataset.x), y = Number(marker.dataset.y)
    const r = marker.classList.contains('is-selected') ? 12 : 8
    return { left: x - r, top: y - r, right: x + r, bottom: y + r }
  })
  for (const text of diagram.querySelectorAll<SVGTextElement>('.constellation-neighbor')) {
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

function drawChart(root: HTMLElement, object: Star, chart: ConstellationChart, options: CardOptions): void {
  const container = root.querySelector<HTMLElement>('#constellation-chart')!
  const focused = document.activeElement?.closest<SVGGElement>('.constellation-star')?.dataset.hip
  const width = Math.max(250, container.clientWidth || 380), height = Math.max(340, Math.round(width * 0.94))
  lastWidth = container.clientWidth
  const position = objectSkyPosition(object)
  const selectedPoint = position && projectConstellationPosition(position, chart.center)
  const points = chart.stars.map((star) => ({ star, point: projectConstellationPosition(star, chart.center)! }))
  const borders = chart.boundaries.map((boundary) => ({ ...boundary, projected: boundary.points.map((point) => projectConstellationPosition(point, chart.center)!) }))
  // Favor a large figure, with just enough room to keep the IAU outline visible.
  const all = [...points.map(({ point }) => point), ...(selectedPoint ? [selectedPoint] : [])]
  const left = Math.min(...all.map((p) => p.x)), right = Math.max(...all.map((p) => p.x))
  const top = Math.min(...all.map((p) => p.y)), bottom = Math.max(...all.map((p) => p.y))
  const outline = [...all, ...borders.flatMap((border) => border.projected)]
  const outlineLeft = Math.min(...outline.map((p) => p.x)), outlineRight = Math.max(...outline.map((p) => p.x))
  const outlineTop = Math.min(...outline.map((p) => p.y)), outlineBottom = Math.max(...outline.map((p) => p.y))
  const scale = Math.min((width - 56) / Math.max(right - left, 0.01), (height - 72) / Math.max(bottom - top, 0.01),
    (width - 28) / Math.max(outlineRight - outlineLeft, 0.01), (height - 28) / Math.max(outlineBottom - outlineTop, 0.01))
  const halfWidth = (width / 2 - 14) / scale, halfHeight = (height / 2 - 14) / scale
  const centerX = Math.max(outlineRight - halfWidth, Math.min(outlineLeft + halfWidth, (left + right) / 2))
  const centerY = Math.max(outlineBottom - halfHeight, Math.min(outlineTop + halfHeight, (top + bottom) / 2))
  const screen = (p: Point): Point => ({ x: width / 2 + (p.x - centerX) * scale, y: height / 2 + (p.y - centerY) * scale })
  const diagram = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': `${chart.name}: ${object.name}`, 'aria-describedby': 'constellation-chart-description' })
  diagram.append(svg('desc', { id: 'constellation-chart-description' }, `Catalogue sky view from Earth, north up and east left. ${selectedPoint ? `${object.name} is circled in orange.` : `A sky position is unavailable for ${object.name}.`} Figure stars: ${chart.stars.map((star) => star.name).join(', ')}. Solid lines show the Western figure; spaced dashed lines show IAU boundaries. Neighboring constellations: ${[...new Set(borders.map((border) => border.neighbor))].join(', ')}. Stars can be selected; focus or hover reveals their distance from the Sun and apparent magnitude.`))
  const lineMask = svg('mask', { id: 'constellation-line-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height })
  lineMask.append(svg('rect', { x: 0, y: 0, width, height, fill: 'white' }))
  const definitions = svg('defs')
  definitions.append(lineMask)
  const lines = svg('g', { mask: 'url(#constellation-line-mask)' })
  diagram.append(definitions, lines)
  const neighborEdges = new Map<string, typeof borders[number]>()
  for (const boundary of borders) {
    const path = boundary.projected.map((point, i) => { const p = screen(point); return `${i ? 'L' : 'M'}${p.x},${p.y}` }).join(' ')
    lines.append(svg('path', { d: path, class: 'constellation-boundary', 'data-neighbor': boundary.neighbor }))
    const previous = neighborEdges.get(boundary.neighbor)
    if (!previous || boundary.projected.length > previous.projected.length) neighborEdges.set(boundary.neighbor, boundary)
  }
  const neighbors = [...neighborEdges].map(([name, edge]) => ({ name, point: screen(edge.projected[Math.floor(edge.projected.length / 2)]!) }))
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
  const canonicalId = starComponentIdentity(object.id)?.canonicalStarId ?? object.id
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
    marker.addEventListener('pointerenter', showTooltip)
    marker.addEventListener('pointerleave', () => { if (document.activeElement !== marker) hideTooltip() })
    marker.addEventListener('focus', showTooltip)
    marker.addEventListener('blur', hideTooltip)
    marker.addEventListener('click', () => { hideTooltip(); options.onSelect(physical) })
    marker.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hideTooltip(); options.onSelect(physical) }
    })
    tooltips.push(tooltip)
  }
  for (const { star, point } of points) {
    // Identity, not proximity: Sirius B must retain its own name and marker.
    const figureId = starComponentIdentity(`hip-${star.hip}`)?.canonicalStarId ?? `hip-${star.hip}`
    const knownObject = figureObjects.get(star.hip)!
    const selected = canonicalId === figureId || knownObject.id === object.id
    const physical = selected ? object : knownObject
    const p = screen(selected && selectedPoint ? selectedPoint : point)
    const magnitude = physical.apparent_mag ?? star.magnitude_v
    marks.push({ object: physical, x: p.x, y: p.y, magnitude })
    const marker = svg('g', { class: `constellation-star${selected ? ' is-selected' : ''}`, 'data-hip': star.hip, 'data-x': p.x, 'data-y': p.y,
      role: 'button', tabindex: 0, 'aria-label': `Select ${physical.name}`, 'aria-pressed': String(selected) })
    marker.append(svg('circle', { cx: p.x, cy: p.y, r: 12, class: 'constellation-star-hit' }))
    const color = starDisplayColor(physical, options.colorMode).getStyle()
    marker.style.setProperty('--constellation-star-color', color)
    if (star.bayer) marker.append(svg('text', { x: p.x - 16, y: p.y + 4, 'text-anchor': 'end', class: 'constellation-bayer' }, star.bayer))
    if (selected) marker.append(svg('circle', { cx: p.x, cy: p.y, r: 11, class: 'constellation-selected-ring' }))
    if (selected) marker.append(svg('text', { x: p.x, y: p.y, class: 'constellation-star-name' }, object.name))
    attachTooltip(marker, physical, p, `constellation-tooltip-${star.hip}`, magnitude)
    diagram.append(marker)
  }
  if (selectedPoint && !diagram.querySelector('.is-selected')) {
    const p = screen(selectedPoint)
    marks.push({ object, x: p.x, y: p.y, magnitude: object.apparent_mag ?? null })
    const marker = svg('g', { class: 'constellation-star is-selected', 'data-object-id': object.id, 'data-object-type': object.type, 'data-x': p.x, 'data-y': p.y,
      role: 'button', tabindex: 0, 'aria-label': `Select ${object.name}`, 'aria-pressed': 'true' })
    marker.append(svg('circle', { cx: p.x, cy: p.y, r: 12, class: 'constellation-star-hit' }), svg('circle', { cx: p.x, cy: p.y, r: 11, class: 'constellation-selected-ring' }),
      svg('text', { x: p.x, y: p.y, class: 'constellation-star-name' }, object.name))
    attachTooltip(marker, object, p, `constellation-tooltip-${object.id}`)
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
  const note = root.querySelector<HTMLElement>('#constellation-missing')!
  note.hidden = Boolean(selectedPoint)
  note.textContent = selectedPoint ? '' : `Sky position unavailable for ${object.name}.`
  renderConstellationVisibility(root.querySelector<HTMLElement>('#constellation-visibility')!, position, object.name)
}

export function renderConstellationCard(root: HTMLElement, object: Star, chart: ConstellationChart, options: CardOptions): void {
  active = { root, object, chart, options }
  root.querySelector<HTMLElement>('#constellation-heading')!.textContent = `Constellation: ${chart.name}`
  root.dataset.constellation = chart.abbreviation
  const links = root.querySelector<HTMLElement>('#constellation-source-links')!
  links.replaceChildren(...chart.sources.map((source) => {
    const link = document.createElement('a')
    link.href = source.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = source.label
    return link
  }))
  drawChart(root, object, chart, options)
  observer ??= new ResizeObserver(() => {
    if (!active || active.root.hidden) return
    const container = active.root.querySelector<HTMLElement>('#constellation-chart')!
    if (container.clientWidth !== lastWidth) drawChart(active.root, active.object, active.chart, active.options)
  })
  observer.observe(root.querySelector('#constellation-chart')!)
}

export function disposeConstellationCard(): void {
  observer?.disconnect()
  observer = undefined
  active = undefined
  disposeConstellationStars()
}
