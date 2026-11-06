import { drawing, note, number, player, readouts, slider, svgNode, text, type WidgetMount } from './glossary-widget'

const CENTER = { x: 180, y: 104 }

function eccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let E = eccentricity < 0.8 ? meanAnomaly : Math.PI
  for (let i = 0; i < 12; i++) E -= (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E))
  return E
}

/** Variants: `shape` for size and eccentricity, `tilt` for how the same orbit looks when inclined. */
export const mount: WidgetMount = (host, signal, variant = 'shape') => {
  const tiltView = variant === 'tilt'
  const svg = drawing(host, 208, tiltView ? 'An orbit seen tilted from Earth, flattening as inclination grows' : 'A planet on an elliptical orbit around a star, with Earth’s circular orbit for comparison')
  const earthOrbit = svgNode('ellipse', { class: 'gw-reference' })
  const path = svgNode('ellipse', { class: 'gw-orbit-path' })
  const star = svgNode('circle', { r: 8, class: 'gw-sun' })
  const line = svgNode('line', { class: 'gw-guide' })
  const body = svgNode('circle', { r: 6, class: 'gw-earth' })
  svg.append(earthOrbit, path, line, star, body, text(tiltView ? '0° is face-on, 90° is edge-on' : 'Dashed: Earth’s orbit', 8, 200, 'start', 'gw-text gw-small'))
  let a = 1, e = tiltView ? 0.3 : 0.4, inclination = tiltView ? 40 : 0, phase = 0.12
  const [first, second, third] = readouts(host, tiltView ? ['Looks flattened to', 'Seen', 'Orbit itself'] : ['One orbit takes', 'Closest to star', 'Farthest from star'])
  const render = () => {
    const scale = 92 / Math.max(a, 1)
    const squash = Math.cos(inclination * Math.PI / 180)
    const b = a * Math.sqrt(1 - e * e)
    const cx = CENTER.x - a * e * scale
    path.setAttribute('cx', String(cx))
    path.setAttribute('cy', String(CENTER.y))
    path.setAttribute('rx', String(a * scale))
    path.setAttribute('ry', String(Math.max(0.6, b * scale * squash)))
    star.setAttribute('cx', String(CENTER.x))
    star.setAttribute('cy', String(CENTER.y))
    earthOrbit.setAttribute('cx', String(CENTER.x))
    earthOrbit.setAttribute('cy', String(CENTER.y))
    earthOrbit.setAttribute('rx', String(scale))
    earthOrbit.setAttribute('ry', String(Math.max(0.6, scale * squash)))
    earthOrbit.toggleAttribute('hidden', tiltView)
    const E = eccentricAnomaly(phase * 2 * Math.PI, e)
    const px = CENTER.x + scale * a * (Math.cos(E) - e)
    const py = CENTER.y - scale * b * Math.sin(E) * squash
    body.setAttribute('cx', String(px))
    body.setAttribute('cy', String(py))
    line.setAttribute('x1', String(CENTER.x))
    line.setAttribute('y1', String(CENTER.y))
    line.setAttribute('x2', String(px))
    line.setAttribute('y2', String(py))
    if (tiltView) {
      first!(`${number(squash * 100, 2)}% of its height`)
      second!(inclination < 15 ? 'Nearly face-on' : inclination > 75 ? 'Nearly edge-on' : 'At an angle')
      third!('Unchanged')
      return
    }
    const years = a ** 1.5
    first!(years < 1 ? `${number(years * 365.25)} days` : `${number(years, 2)} ${number(years, 2) === '1' ? 'year' : 'years'}`)
    second!(`${number(a * (1 - e))} au`)
    third!(`${number(a * (1 + e))} au`)
  }
  const position = slider(host, { label: 'Position along the orbit', min: 0, max: 1, value: phase, format: (value) => `${number(value * 100, 2)}% of the period`, signal, onInput: (value) => { phase = value; render() } })
  if (tiltView) slider(host, { label: 'Inclination', min: 0, max: 90, step: 1, value: inclination, format: (value) => `${Math.round(value)}°`, signal, onInput: (value) => { inclination = value; render() } })
  else {
    slider(host, { label: 'Eccentricity', min: 0, max: 0.9, value: e, format: (value) => value.toFixed(2), signal, onInput: (value) => { e = value; render() } })
    slider(host, { label: 'Semi-major axis', min: 0.3, max: 30, log: true, value: a, format: (value) => `${number(value)} au`, signal, onInput: (value) => { a = value; render() } })
  }
  player(host, signal, (elapsedMs) => {
    phase = (phase + elapsedMs / 8000) % 1
    position.set(phase)
    render()
  })
  note(host, tiltView ? 'The same orbit looks flatter as it tilts toward edge-on. Transits and direct images can reveal this tilt, which turns a minimum mass into a true one.' : 'Press play and watch the planet speed up near the star and slow down far from it. Periods assume a star of one solar mass.')
  render()
}
