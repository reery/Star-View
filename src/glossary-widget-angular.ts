import { choices, drawing, note, number, readouts, slider, svgNode, text, type WidgetMount } from './glossary-widget'

const OBJECTS = {
  moon: { title: 'Moon', size: 3474, distance: 384400 },
  sun: { title: 'Sun', size: 1392700, distance: 149600000 },
  jupiter: { title: 'Jupiter', size: 139820, distance: 629000000 },
} as const
type ObjectId = keyof typeof OBJECTS

const MOON_DEGREES = 2 * Math.atan(3474 / 2 / 384400) * 180 / Math.PI

function angleText(degrees: number): string {
  if (degrees >= 1) return `${number(degrees)}°`
  if (degrees * 60 >= 1) return `${number(degrees * 60)} arcminutes`
  return `${number(degrees * 3600)} arcseconds`
}

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 132, 'A disc shown next to the full Moon at the same scale')
  const disc = svgNode('circle', { cx: 240, cy: 62, class: 'gw-sun' })
  const moonRadius = 30
  svg.append(svgNode('circle', { cx: 86, cy: 62, r: moonRadius, class: 'gw-hollow' }), disc, text('Full Moon from Earth', 86, 122, 'middle', 'gw-text gw-small'))
  const label = text('', 240, 122, 'middle', 'gw-text gw-small gw-strong')
  svg.append(label)
  const [angle, compared] = readouts(host, ['Apparent size', 'Compared with the full Moon'])
  let object: ObjectId = 'moon', factor = 1
  const render = () => {
    const { title, size, distance } = OBJECTS[object]
    const degrees = 2 * Math.atan(size / 2 / (distance * factor)) * 180 / Math.PI
    const ratio = degrees / MOON_DEGREES
    disc.setAttribute('r', String(Math.min(52, Math.max(0.8, moonRadius * ratio))))
    label.textContent = factor === 1 ? title : `${title} at ${number(factor, 2)} × its distance`
    angle!(angleText(degrees))
    compared!(ratio >= 1 ? `${number(ratio, 2)} × as wide` : `1/${number(1 / ratio, 2)} as wide`)
  }
  const distance = slider(host, { label: 'Move it closer or farther', min: 0.25, max: 8, log: true, value: 1, format: (value) => `${number(value, 2)} × its distance`, signal, onInput: (value) => { factor = value; render() } })
  choices(host, 'Object', (Object.keys(OBJECTS) as ObjectId[]).map((id) => [id, OBJECTS[id].title]), object, signal, (id) => { object = id; factor = 1; distance.set(1); render() })
  note(host, 'The Sun is about 400 times wider than the Moon and about 400 times farther away, so they look almost the same size. Jupiter is shown near its closest approach to Earth.')
  render()
}
