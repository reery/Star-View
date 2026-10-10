import type { SkyPosition } from './constellations'
import { eveningVisibilityMonths, latitudeLabel, visibleLatitudeRange, visibilityMonthLabel, VISIBILITY_MONTHS } from './constellation-visibility'
import land from './data/world-land.json'
import { MISSING_VALUE } from './format'
import { svgNode as svg } from './spectral-chart'

const states = new WeakMap<HTMLElement, { position: SkyPosition | null; name: string }>()
const explanation = 'Approximate season at 10 pm local solar time on the 15th of each month. The object is above a level horizon and the Sun is at least 18° below it. Civil clock time, terrain, weather, and brightness limits are not included.'

function drawVisibility(root: HTMLElement): void {
  const { position, name } = states.get(root)!
  const latitude = Number(root.querySelector<HTMLSelectElement>('#constellation-latitude')!.value)
  const range = position && visibleLatitudeRange(position.dec_deg)
  const map = root.querySelector<HTMLElement>('#constellation-visibility-map')!
  const width = Math.max(100, map.clientWidth), left = 2, top = 5, mapWidth = width - left - 2
  const mapHeight = mapWidth * 0.6, height = mapHeight + top * 2
  const y = (lat: number) => top + (90 - lat) / 180 * mapHeight
  const latitudeRange = range ? `${latitudeLabel(range.south, range.south === -90 ? 0 : 1)}–${latitudeLabel(range.north, range.north === 90 ? 0 : 1)}` : MISSING_VALUE
  const diagram = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `${name}: ${range ? `visible above the horizon from ${latitudeRange}. Black land marks these latitudes; the orange line marks ${latitudeLabel(latitude)}.` : 'Sky position unavailable.'}` })
  const definitions = svg('defs'), clip = svg('clipPath', { id: 'constellation-visible-latitudes' })
  if (range) clip.append(svg('rect', { x: left, y: y(range.north), width: mapWidth, height: y(range.south) - y(range.north) }))
  definitions.append(clip)
  diagram.append(definitions, svg('rect', { x: left, y: top, width: mapWidth, height: mapHeight, class: 'constellation-map-ocean' }))
  if (range) diagram.append(svg('rect', { x: left, y: y(range.north), width: mapWidth, height: y(range.south) - y(range.north), class: 'constellation-map-visible-band' }))
  const transform = `translate(${left} ${top}) scale(${mapWidth / 360} ${mapHeight / 180})`
  const continents = svg('g', { transform, class: 'constellation-map-land' })
  for (const path of land.paths) continents.append(svg('path', { d: path }))
  diagram.append(continents)
  const visibleLand = svg('g', { 'clip-path': 'url(#constellation-visible-latitudes)', class: 'constellation-map-visible-land' })
  const shapes = continents.cloneNode(true) as SVGGElement
  shapes.removeAttribute('class')
  visibleLand.append(shapes)
  diagram.append(visibleLand)
  for (let lat = -80; lat <= 80; lat += 20) {
    const line = svg('line', { x1: left, x2: left + mapWidth, y1: y(lat), y2: y(lat), class: 'constellation-map-latitude', 'data-latitude': lat })
    line.append(svg('title', {}, latitudeLabel(lat)))
    diagram.append(line)
  }
  diagram.append(svg('line', { x1: left, x2: left + mapWidth, y1: y(latitude), y2: y(latitude), class: 'constellation-map-observer' }))
  map.replaceChildren(diagram)
  root.querySelector<HTMLElement>('#constellation-visible-latitudes-value')!.textContent = latitudeRange
  const months = position ? eveningVisibilityMonths(position, latitude) : VISIBILITY_MONTHS.map(() => false)
  const monthLabel = position ? visibilityMonthLabel(months) : MISSING_VALUE
  const bar = root.querySelector<HTMLElement>('#constellation-visibility-months')!
  bar.setAttribute('aria-label', `${name} at ${latitudeLabel(latitude)}, around 10 pm: ${monthLabel}. ${explanation}`)
  bar.replaceChildren(...VISIBILITY_MONTHS.map((month, index) => {
    const segment = document.createElement('span')
    segment.className = `constellation-visibility-month${months[index] ? ' is-visible' : ''}`
    segment.dataset.month = month
    segment.title = `${month}: ${position ? months[index] ? 'above the horizon at 10 pm in darkness' : 'below the horizon or no astronomical darkness at 10 pm' : 'sky position unavailable'}`
    const track = document.createElement('i'), label = document.createElement('span')
    track.setAttribute('aria-hidden', 'true')
    label.textContent = month[0]!
    segment.append(track, label)
    return segment
  }))
  root.querySelector<HTMLElement>('#constellation-visible-months-value')!.textContent = monthLabel
}

export function renderConstellationVisibility(root: HTMLElement, position: SkyPosition | null, name: string): void {
  if (!states.has(root)) {
    root.querySelector<HTMLSelectElement>('#constellation-latitude')!.addEventListener('change', () => drawVisibility(root))
    root.querySelector<HTMLElement>('#constellation-visibility-time')!.title = explanation
  }
  states.set(root, { position, name })
  root.querySelector<HTMLSelectElement>('#constellation-latitude')!.disabled = !position
  drawVisibility(root)
}
