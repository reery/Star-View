import { drawing, note, number, readouts, slider, svgNode, text, type WidgetMount } from './glossary-widget'
import { habitableZoneForStar } from './habitable-zone'
import { temperatureColor } from './spectral-chart'

const LEFT = 42, RIGHT = 350, LOW = 0.01, HIGH = 10
const x = (au: number) => LEFT + (RIGHT - LEFT) * Math.log(au / LOW) / Math.log(HIGH / LOW)
const PLANETS: readonly (readonly [string, number, number])[] = [['Mercury', 0.387, 96], ['Venus', 0.723, 76], ['Earth', 1, 96], ['Mars', 1.524, 76], ['Jupiter', 5.2, 96]]
// Rough luminosity of a main-sequence star at this temperature.
const luminosityAt = (kelvin: number) => (kelvin / 5772) ** 7.5

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 120, 'A distance line from a star, with the habitable zone shaded and the Solar System’s planets marked')
  const star = svgNode('circle', { cx: 18, cy: 48, r: 14 })
  const zone = svgNode('rect', { y: 24, height: 48, class: 'gw-zone' })
  svg.append(zone, svgNode('line', { x1: LEFT, x2: RIGHT, y1: 48, y2: 48, class: 'gw-axis' }), star)
  for (const [name, au, labelY] of PLANETS) svg.append(svgNode('circle', { cx: x(au), cy: 48, r: 3.5, class: name === 'Earth' ? 'gw-earth' : 'gw-point' }), text(name, x(au), labelY, 'middle', 'gw-text gw-small'))
  svg.append(text('Distance on a log scale · planets at their real distances', RIGHT, 114, 'end', 'gw-text gw-small'))
  const [inner, outer, power] = readouts(host, ['Inner edge', 'Outer edge', 'Star’s power'])
  const render = (kelvin: number) => {
    const luminosity = luminosityAt(kelvin)
    const hz = habitableZoneForStar({ luminosity_solar: luminosity, temperature_k: kelvin })!
    star.setAttribute('fill', temperatureColor(kelvin))
    zone.setAttribute('x', String(x(hz.innerAu)))
    zone.setAttribute('width', String(x(hz.outerAu) - x(hz.innerAu)))
    inner!(`${number(hz.innerAu)} au`)
    outer!(`${number(hz.outerAu)} au`)
    power!(`${number(luminosity, 2)} × the Sun`)
  }
  slider(host, { label: 'Star’s surface temperature', min: 2600, max: 7200, value: 5772, format: (kelvin) => `${number(kelvin)} K`, signal, onInput: render })
  note(host, 'Limits follow Kopparapu et al. (2014) for an Earth-mass planet, with the star’s power estimated roughly from its temperature. Being in the zone does not make a planet habitable.')
  render(5772)
}
