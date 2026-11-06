import { drawing, note, number, readouts, slider, svgNode, text, type WidgetMount } from './glossary-widget'

const SUN = { x: 180, y: 182 }, ORBIT = 34, STRIP = 22
const starY = (parsecs: number) => 118 - 70 * Math.log10(parsecs) / 2

export const mount: WidgetMount = (host, signal) => {
  const svg = drawing(host, 244, 'Earth orbits the Sun while a nearby star appears to shift against far-away background stars')
  const sight = svgNode('line', { class: 'gw-guide' })
  const apparent = svgNode('circle', { r: 7, class: 'gw-marker' })
  const earth = svgNode('circle', { r: 6, class: 'gw-earth' })
  const star = svgNode('circle', { cx: SUN.x, r: 6, class: 'gw-star' })
  svg.append(svgNode('line', { x1: 16, x2: 344, y1: STRIP, y2: STRIP, class: 'gw-axis' }))
  for (const [cx, cy] of [[34, 15], [78, 28], [125, 14], [160, 30], [216, 15], [252, 29], [298, 14], [332, 27]]) svg.append(svgNode('circle', { cx: cx!, cy: cy!, r: 1.7, class: 'gw-faint' }))
  svg.append(svgNode('circle', { cx: SUN.x, cy: SUN.y, r: ORBIT, class: 'gw-orbit' }), svgNode('circle', { cx: SUN.x, cy: SUN.y, r: 7, class: 'gw-sun' }), sight, apparent, star, earth,
    text('Sun', SUN.x, SUN.y + 22, 'middle', 'gw-text gw-small'), text('Far-away stars', 16, 48))
  const starLabel = text('Nearby star', SUN.x + 12, 0)
  const earthLabel = text('Earth', 0, 0, 'middle', 'gw-text gw-small')
  svg.append(starLabel, earthLabel)
  const [angle, light] = readouts(host, ['Parallax angle', 'Distance'])
  let months = 0, parsecs = 2
  const render = () => {
    const phase = months / 12 * 2 * Math.PI
    const ex = SUN.x + ORBIT * Math.cos(phase), ey = SUN.y - ORBIT * Math.sin(phase)
    const sy = starY(parsecs)
    const stripX = SUN.x + (SUN.x - ex) * (sy - STRIP) / (ey - sy)
    earth.setAttribute('cx', String(ex))
    earth.setAttribute('cy', String(ey))
    earthLabel.setAttribute('x', String(SUN.x + (ORBIT + 20) * Math.cos(phase)))
    earthLabel.setAttribute('y', String(SUN.y - (ORBIT + 20) * Math.sin(phase) + 4))
    star.setAttribute('cy', String(sy))
    starLabel.setAttribute('y', String(sy + 5))
    apparent.setAttribute('cx', String(stripX))
    apparent.setAttribute('cy', String(STRIP))
    sight.setAttribute('x1', String(ex))
    sight.setAttribute('y1', String(ey))
    sight.setAttribute('x2', String(stripX))
    sight.setAttribute('y2', String(STRIP))
    angle!(`${number(1 / parsecs)}″ (${number(1000 / parsecs)} mas)`)
    light!(`${number(parsecs)} pc · ${number(parsecs * 3.2616)} ly`)
  }
  slider(host, { label: 'Time of year', min: 0, max: 12, value: 0, format: (value) => `${number(value, 2)} months later`, signal, onInput: (value) => { months = value; render() } })
  slider(host, { label: 'Star’s distance', min: 1, max: 100, log: true, value: parsecs, format: (value) => `${number(value)} pc`, signal, onInput: (value) => { parsecs = value; render() } })
  note(host, 'The drawing is not to scale: real shifts are thousands of times smaller, under one arcsecond even for the nearest star. Slide the time of year to see the star move, then move it farther away and see the shift shrink.')
  render()
}
