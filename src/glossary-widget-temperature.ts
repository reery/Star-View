import { drawing, number, readouts, slider, svgNode, text, note, type WidgetMount } from './glossary-widget'
import { temperatureColor } from './spectral-chart'
import { relativeSpectralEmission, spectrumRegion, SOLAR_TEMPERATURE_K, temperatureAppearance, WIEN_NM_K } from './temperature-properties'

const CLASSES: readonly (readonly [below: number, letter: string])[] = [[3700, 'M'], [5200, 'K'], [6000, 'G'], [7500, 'F'], [10000, 'A'], [30000, 'B'], [Infinity, 'O']]
const LOW = 90, HIGH = 3500, LEFT = 14, RIGHT = 346, BASE = 136, TOP = 22
const x = (nm: number) => LEFT + (RIGHT - LEFT) * Math.log(nm / LOW) / Math.log(HIGH / LOW)

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 166, 'A star’s glow and the curve of light it gives off at each wavelength')
  const band = svgNode('rect', { x: x(380), y: TOP - 8, width: x(780) - x(380), height: BASE - TOP + 8, class: 'gw-band' })
  const curve = svgNode('polyline', { class: 'gw-curve' })
  const peak = svgNode('line', { y1: BASE, class: 'gw-guide' })
  const star = svgNode('circle', { cx: RIGHT - 24, cy: 40, r: 24 })
  svg.append(band, peak, curve, svgNode('line', { x1: LEFT, x2: RIGHT, y1: BASE, y2: BASE, class: 'gw-axis' }),
    text('Ultraviolet', x(190), 156, 'middle'), text('Visible', x(550), 156, 'middle'), text('Infrared', x(1800), 156, 'middle'), star)
  const [spectral, wavelength, look] = readouts(host, ['Spectral class', 'Brightest at', 'Looks'])
  const render = (kelvin: number) => {
    const points: string[] = []
    for (let i = 0; i <= 120; i++) {
      const nm = LOW * (HIGH / LOW) ** (i / 120)
      points.push(`${x(nm).toFixed(1)},${(BASE - (BASE - TOP) * relativeSpectralEmission(nm, kelvin)).toFixed(1)}`)
    }
    curve.setAttribute('points', points.join(' '))
    const peakNm = WIEN_NM_K / kelvin
    const peakX = Math.min(RIGHT, Math.max(LEFT, x(peakNm)))
    peak.setAttribute('x1', String(peakX))
    peak.setAttribute('x2', String(peakX))
    peak.setAttribute('y2', String(TOP))
    star.setAttribute('fill', temperatureColor(kelvin))
    spectral!(CLASSES.find(([below]) => kelvin < below)![1])
    wavelength!(`${number(peakNm)} nm · ${spectrumRegion(peakNm)}`)
    look!(temperatureAppearance(kelvin).replace(' appearance', ''))
  }
  slider(host, { label: 'Surface temperature', min: 2400, max: 40000, log: true, value: SOLAR_TEMPERATURE_K, format: (kelvin) => `${number(kelvin)} K`, signal, onInput: render })
  note(host, 'The Sun sits at the starting point, 5,772 K. Each curve is scaled to the same height: hotter stars actually give off far more light at every wavelength. Spectral class boundaries are approximate.')
  render(SOLAR_TEMPERATURE_K)
}
