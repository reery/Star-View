import { drawing, note, number, readouts, slider, svgNode, text, type WidgetMount } from './glossary-widget'

const OBSERVER = { x: 58, y: 66 }, STAR = { x: 232, y: 66 }, SCALE = 0.3
const SPEED_OF_LIGHT = 299792.458, H_ALPHA = 656.28, LINES = [486.13, 589.3, 656.28]
const LEFT = 16, RIGHT = 344, BLUE = 420, RED = 700
const x = (nm: number) => LEFT + (RIGHT - LEFT) * (nm - BLUE) / (RED - BLUE)

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 206, 'A star moving through space, its motion split into a part along our line of sight and a part across the sky, with its spectral lines shifted')
  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: 'glossary-spectrum' })
  for (const [offset, color] of [[0, '#5a4fd0'], [0.2, '#3f8fe0'], [0.42, '#4cc36a'], [0.6, '#e8dc50'], [0.78, '#ee8a35'], [1, '#d83a35']] as const) gradient.append(svgNode('stop', { offset, 'stop-color': color }))
  defs.append(gradient)
  const radial = svgNode('line', { class: 'gw-vector gw-vector-radial' })
  const across = svgNode('line', { class: 'gw-vector gw-vector-across' })
  const total = svgNode('line', { class: 'gw-vector' })
  svg.append(defs, svgNode('line', { x1: OBSERVER.x, x2: 344, y1: OBSERVER.y, y2: OBSERVER.y, class: 'gw-guide' }), radial, across, total,
    svgNode('circle', { cx: OBSERVER.x, cy: OBSERVER.y, r: 6, class: 'gw-earth' }), text('You', OBSERVER.x, OBSERVER.y + 24, 'middle'),
    svgNode('circle', { cx: STAR.x, cy: STAR.y, r: 8, class: 'gw-sun' }),
    svgNode('rect', { x: LEFT, y: 136, width: RIGHT - LEFT, height: 28, rx: 3, fill: 'url(#glossary-spectrum)' }))
  const marks = LINES.map((nm) => {
    const rest = svgNode('line', { x1: x(nm), x2: x(nm), y1: 130, y2: 136, class: 'gw-axis' })
    const shifted = svgNode('line', { y1: 136, y2: 164, class: 'gw-line' })
    svg.append(rest, shifted)
    return { nm, shifted }
  })
  svg.append(text('Lines in the star’s light · ticks show where they would sit at rest', LEFT, 184, 'start', 'gw-text gw-small'), text('Blue', LEFT, 200, 'start', 'gw-text gw-small'), text('Red', RIGHT, 200, 'end', 'gw-text gw-small'))
  const [toward, sideways, shift] = readouts(host, ['Radial velocity', 'Across the sky', 'Hydrogen line moves'])
  let speed = 60, direction = 40
  const render = () => {
    const angle = direction * Math.PI / 180
    const vr = speed * Math.cos(angle), vt = speed * Math.sin(angle)
    const endX = STAR.x + vr * SCALE, endY = STAR.y - vt * SCALE
    for (const [line, x2, y2] of [[radial, endX, STAR.y], [across, STAR.x, endY], [total, endX, endY]] as const) {
      line.setAttribute('x1', String(STAR.x))
      line.setAttribute('y1', String(STAR.y))
      line.setAttribute('x2', String(x2))
      line.setAttribute('y2', String(y2))
    }
    // Exaggerated about 200 times so the shift can be seen.
    for (const { nm, shifted } of marks) {
      const position = String(x(nm * (1 + 200 * vr / SPEED_OF_LIGHT)))
      shifted.setAttribute('x1', position)
      shifted.setAttribute('x2', position)
    }
    toward!(`${vr >= 0 ? '+' : '−'}${number(Math.abs(vr))} km/s${Math.abs(vr) < 1 ? '' : vr > 0 ? ' · moving away' : ' · approaching'}`)
    sideways!(`${number(Math.abs(vt))} km/s`)
    shift!(`${vr >= 0 ? '+' : '−'}${number(Math.abs(H_ALPHA * vr / SPEED_OF_LIGHT), 2)} nm`)
  }
  slider(host, { label: 'Speed through space', min: 0, max: 200, step: 1, value: speed, format: (value) => `${Math.round(value)} km/s`, signal, onInput: (value) => { speed = value; render() } })
  slider(host, { label: 'Direction', min: 0, max: 180, step: 1, value: direction, format: (value) => value < 5 ? 'Straight away' : value > 175 ? 'Straight toward you' : Math.abs(value - 90) < 5 ? 'Across the sky' : value < 90 ? 'Mostly away' : 'Mostly toward you', signal, onInput: (value) => { direction = value; render() } })
  note(host, 'Only motion along your line of sight shifts the lines; a star crossing the sky leaves them almost in place. The line shift is drawn about 200 times larger than real.')
  render()
}
