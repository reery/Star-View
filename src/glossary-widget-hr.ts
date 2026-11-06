import { choices, drawing, note, svgNode, text, type WidgetMount } from './glossary-widget'
import { temperatureColor } from './spectral-chart'

const x = (kelvin: number) => 42 + 306 * Math.log(40000 / kelvin) / Math.log(40000 / 2400)
const y = (luminosity: number) => 14 + 190 * (6 - Math.log10(luminosity)) / 10
const line = (points: readonly (readonly [number, number])[]) => points.map(([kelvin, luminosity]) => `${x(kelvin).toFixed(1)},${y(luminosity).toFixed(1)}`).join(' ')

const REGIONS = {
  main: { title: 'Main sequence', term: 'subtype-main-sequence', width: 17, points: [[38000, 200000], [20000, 8000], [10000, 40], [7000, 5], [5772, 1], [4400, 0.2], [3400, 0.02], [2600, 0.0005]],
    text: 'About nine in ten stars sit here, quietly fusing hydrogen. Position depends on mass: heavy stars are hot and bright at the upper left, light ones cool and faint at the lower right.' },
  giants: { title: 'Giants', term: 'subtype-giant', width: 30, points: [[5400, 40], [4400, 100], [3500, 700]],
    text: 'Aging stars that have run out of hydrogen in their cores and swollen. They are cool but huge, so a large surface makes them bright.' },
  supergiants: { title: 'Supergiants', term: 'subtype-supergiant', width: 22, points: [[28000, 300000], [12000, 120000], [6000, 60000], [3600, 100000]],
    text: 'Rare, massive stars running along the top of the diagram. They live for only millions of years and many end as supernovae.' },
  dwarfs: { title: 'White dwarfs', term: 'white_dwarf', width: 18, points: [[30000, 0.1], [15000, 0.01], [8000, 0.001], [5000, 0.0002]],
    text: 'The dense, dying embers of stars like the Sun. They are hot but tiny, so they sit low on the diagram and slide toward the lower right as they cool.' },
} as const
type Region = keyof typeof REGIONS

const STARS: readonly (readonly [string, number, number, 'start' | 'end'])[] = [
  ['Sun', 5772, 1, 'start'], ['Sirius A', 9845, 24.7, 'start'], ['Betelgeuse', 3600, 100000, 'end'], ['Rigel', 12100, 120000, 'start'], ['Proxima', 3042, 0.0016, 'end'], ['Sirius B', 25000, 0.056, 'start'],
]

export const mount: WidgetMount = (host, signal, variant) => {
  const svg = drawing(host, 232, 'A Hertzsprung–Russell diagram: star luminosity against temperature, with hot stars on the left')
  const shapes = new Map<Region, SVGPolylineElement>()
  svg.append(svgNode('line', { x1: 42, x2: 42, y1: 10, y2: 206, class: 'gw-axis' }), svgNode('line', { x1: 42, x2: 348, y1: 206, y2: 206, class: 'gw-axis' }))
  for (const [luminosity, label] of [[1e4, '10k'], [100, '100'], [1, '1'], [0.01, '0.01'], [1e-4, '0.0001']] as const) svg.append(text(label, 38, y(luminosity) + 4, 'end', 'gw-text gw-small'))
  for (const kelvin of [30000, 10000, 5000, 3000]) svg.append(text(`${kelvin.toLocaleString('en-US')} K`, x(kelvin), 222, 'middle', 'gw-text gw-small'))
  for (const [id, region] of Object.entries(REGIONS) as [Region, typeof REGIONS[Region]][]) {
    const shape = svgNode('polyline', { points: line(region.points), 'stroke-width': region.width, class: 'gw-region' })
    shapes.set(id, shape)
    svg.append(shape)
  }
  for (const [name, kelvin, luminosity, anchor] of STARS) {
    svg.append(svgNode('circle', { cx: x(kelvin), cy: y(luminosity), r: 4, fill: temperatureColor(kelvin), class: 'gw-point' }),
      text(name, x(kelvin) + (anchor === 'start' ? 7 : -7), y(luminosity) + 4, anchor, 'gw-text gw-small gw-strong'))
  }
  const detail = Object.assign(document.createElement('p'), { className: 'glossary-widget-detail' })
  const select = (id: Region) => {
    for (const [name, shape] of shapes) shape.classList.toggle('is-active', name === id)
    const link = Object.assign(document.createElement('button'), { type: 'button', className: 'constellation-info-link', textContent: `Read about ${REGIONS[id].title.toLowerCase()}` })
    link.dataset.glossaryLink = REGIONS[id].term
    detail.replaceChildren(`${REGIONS[id].text} `, link)
  }
  const initial: Region = variant && variant in REGIONS ? variant as Region : 'main'
  choices(host, 'Regions of the diagram', (Object.keys(REGIONS) as Region[]).map((id) => [id, REGIONS[id].title]), initial, signal, select)
  host.append(detail)
  note(host, 'Left to right runs hot to cool; bottom to top runs faint to bright, with the Sun at 1. Bands are simplified; the named stars show approximate published values.')
  select(initial)
}
