import { drawing, note, number, readouts, slider, svgNode, text, clamp, type WidgetMount } from './glossary-widget'
import { MAGNITUDE_VISIBILITY_GUIDES } from './magnitude-properties'

// A Sun-like star's absolute visual magnitude, with luminosity scaled from it.
const SUN_ABSOLUTE = 4.83
const LOW = -8, HIGH = 20, LEFT = 14, RIGHT = 346
const x = (magnitude: number) => LEFT + (RIGHT - LEFT) * (clamp(magnitude, LOW, HIGH) - LOW) / (HIGH - LOW)
const signed = (value: number) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(1)}`
const REFERENCES: readonly (readonly [number, string])[] = [[-1.46, 'Sirius'], [6, 'Eye limit'], [10, 'Binoculars'], [13, 'Telescope']]

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 112, 'A brightness scale with brighter values to the left, marking the star’s apparent and absolute magnitude')
  svg.append(svgNode('line', { x1: LEFT, x2: RIGHT, y1: 62, y2: 62, class: 'gw-axis' }), text('← Brighter', LEFT, 16), text('Fainter →', RIGHT, 16, 'end'))
  // Neighboring labels take turns on two rows so they never overlap.
  REFERENCES.forEach(([magnitude, name], index) => {
    svg.append(svgNode('line', { x1: x(magnitude), x2: x(magnitude), y1: 56, y2: 68, class: 'gw-axis' }), text(`${name} ${signed(magnitude).replace('.0', '')}`, x(magnitude), index % 2 ? 104 : 86, 'middle', 'gw-text gw-small'))
  })
  const apparentMark = svgNode('circle', { cy: 62, r: 8, class: 'gw-star' })
  const absoluteMark = svgNode('circle', { cy: 62, r: 7, class: 'gw-hollow' })
  const apparentLabel = text('Apparent', 0, 42, 'middle', 'gw-text gw-strong')
  svg.append(absoluteMark, apparentMark, apparentLabel)
  const [apparent, absolute, seen] = readouts(host, ['Apparent (filled)', 'Absolute (ring)', 'Visible with'])
  let luminosity = 1, lightYears = 32.6
  const render = () => {
    const M = SUN_ABSOLUTE - 2.5 * Math.log10(luminosity)
    const m = M + 5 * Math.log10(lightYears / 3.2616 / 10)
    apparentMark.setAttribute('cx', String(x(m)))
    apparentLabel.setAttribute('x', String(clamp(x(m), 34, 326)))
    absoluteMark.setAttribute('cx', String(x(M)))
    apparent!(signed(m))
    absolute!(signed(M))
    const guide = MAGNITUDE_VISIBILITY_GUIDES.find(({ limit }) => m <= limit)
    seen!(guide ? guide.id === 'city' ? 'Naked eye, even in a city' : guide.name : 'Beyond large telescopes')
  }
  slider(host, { label: 'True power', min: 1e-4, max: 1e5, log: true, value: luminosity, format: (value) => `${number(value, 2)} × the Sun`, signal, onInput: (value) => { luminosity = value; render() } })
  slider(host, { label: 'Distance', min: 1, max: 10000, log: true, value: lightYears, format: (value) => `${number(value)} ly`, signal, onInput: (value) => { lightYears = value; render() } })
  note(host, 'It starts as the Sun placed 32.6 light-years (10 parsecs) away, where apparent and absolute magnitude match. Moving the star changes only the apparent value. Assumes a star with the Sun’s color and no dust in the way.')
  render()
}
