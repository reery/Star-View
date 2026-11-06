import { drawing, note, readouts, slider, svgNode, text, type WidgetMount } from './glossary-widget'

const R = 92, CX = 180, CY = 104, TILT = 22 * Math.PI / 180, TURN = -35 * Math.PI / 180
const OBLIQUITY = 23.44 * Math.PI / 180

/** Sky coordinates in radians to a point on the drawn globe; `front` means on the near side. */
function project(ra: number, dec: number) {
  const px = Math.cos(dec) * Math.cos(ra + TURN), py = Math.cos(dec) * Math.sin(ra + TURN), pz = Math.sin(dec)
  return { x: CX + R * py, y: CY - R * (pz * Math.cos(TILT) - px * Math.sin(TILT)), front: px * Math.cos(TILT) + pz * Math.sin(TILT) >= 0 }
}

function arc(points: readonly { x: number; y: number; front: boolean }[]): [front: string, back: string] {
  const front: string[] = [], back: string[] = []
  points.forEach((point, index) => {
    const target = point.front ? front : back
    const previous = points[index - 1]
    target.push(`${previous && previous.front === point.front ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
  })
  return [front.join(''), back.join('')]
}

const hours = (ra: number) => {
  const total = Math.round(ra * 60)
  return `${Math.floor(total / 60) % 24}h ${String(total % 60).padStart(2, '0')}m`
}

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 208, 'The celestial sphere with its equator, a line of right ascension, a circle of declination and the ecliptic')
  svg.append(svgNode('circle', { cx: CX, cy: CY, r: R, class: 'gw-sphere' }))
  const addCurve = (className: string, points: () => { x: number; y: number; front: boolean }[]) => {
    const front = svgNode('path', { class: className }), back = svgNode('path', { class: `${className} gw-back` })
    svg.append(back, front)
    return () => {
      const [frontPath, backPath] = arc(points())
      front.setAttribute('d', frontPath)
      back.setAttribute('d', backPath)
    }
  }
  const circle = (fn: (t: number) => { x: number; y: number; front: boolean }) => Array.from({ length: 121 }, (_, index) => fn(index / 120 * 2 * Math.PI))
  let raHours = 5.9, decDegrees = 7.4
  const equator = addCurve('gw-equator', () => circle((t) => project(t, 0)))
  const ecliptic = addCurve('gw-ecliptic', () => circle((t) => project(Math.atan2(Math.sin(t) * Math.cos(OBLIQUITY), Math.cos(t)), Math.asin(Math.sin(t) * Math.sin(OBLIQUITY)))))
  const meridian = addCurve('gw-guide-curve', () => circle((t) => project(raHours / 12 * Math.PI, t / 2 - Math.PI / 2)))
  const parallel = addCurve('gw-guide-curve', () => circle((t) => project(t, decDegrees * Math.PI / 180)))
  const point = svgNode('circle', { r: 6, class: 'gw-star' })
  const pole = project(0, Math.PI / 2)
  svg.append(point, text('North pole', pole.x, pole.y - 8, 'middle', 'gw-text gw-small'), text('Equator', 12, 22, 'start', 'gw-text gw-small gw-equator-key'), text('Ecliptic (the Sun’s path)', 12, 40, 'start', 'gw-text gw-small gw-ecliptic-key'))
  const [ra, dec, side] = readouts(host, ['Right ascension', 'Declination', 'Seen from'])
  const render = () => {
    equator(); ecliptic(); meridian(); parallel()
    const place = project(raHours / 12 * Math.PI, decDegrees * Math.PI / 180)
    point.setAttribute('cx', String(place.x))
    point.setAttribute('cy', String(place.y))
    point.classList.toggle('gw-back', !place.front)
    ra!(hours(raHours))
    dec!(`${decDegrees < 0 ? '−' : '+'}${Math.abs(Math.round(decDegrees))}°`)
    side!(decDegrees > 60 ? 'Mostly the north' : decDegrees < -60 ? 'Mostly the south' : 'Both hemispheres')
  }
  slider(host, { label: 'Right ascension', min: 0, max: 24, value: raHours, format: hours, signal, onInput: (value) => { raHours = value; render() } })
  slider(host, { label: 'Declination', min: -90, max: 90, step: 1, value: decDegrees, format: (value) => `${value < 0 ? '−' : '+'}${Math.abs(Math.round(value))}°`, signal, onInput: (value) => { decDegrees = value; render() } })
  note(host, 'It starts at Betelgeuse. Declination works like latitude and right ascension like longitude, but these coordinates stay fixed to the stars while Earth turns underneath them.')
  render()
}
