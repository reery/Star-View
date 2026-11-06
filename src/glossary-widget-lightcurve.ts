import { drawing, note, number, player, slider, svgNode, text, type WidgetMount } from './glossary-widget'

const TAU = 2 * Math.PI
const STAGE_Y = 62, PLOT_TOP = 124, PLOT_BOTTOM = 190, LEFT = 12, RIGHT = 348, SAMPLES = 180

/** Area where two circles overlap. */
function overlap(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
  return a + b - 0.5 * Math.sqrt((r1 + r2 - d) * (r1 - r2 + d) * (-r1 + r2 + d) * (r1 + r2 + d))
}

type Scene = { flux(phase: number): number; build(stage: SVGGElement): (phase: number) => void; label: string; caption: string }

const R1 = 34, R2 = 20, SEPARATION = 96
const stretchedWidth = (phase: number) => Math.sqrt((40 * Math.sin(phase * TAU)) ** 2 + (30 * Math.cos(phase * TAU)) ** 2)
const scenes: Record<string, Scene> = {
  eclipse: {
    label: 'Two stars orbit edge-on, and their combined light dips whenever one passes in front of the other',
    caption: 'The deep dip comes when the fainter star covers the brighter one. A shallower dip follows half an orbit later, when the fainter star is hidden behind it.',
    flux(phase) {
      const angle = phase * TAU
      const d = Math.abs(SEPARATION * Math.sin(angle))
      const covered = overlap(R1, R2, d)
      const smallInFront = Math.cos(angle) > 0
      const total = Math.PI * R1 * R1 + 0.45 * Math.PI * R2 * R2
      return (total - (smallInFront ? covered : 0.45 * covered)) / total
    },
    build(svg) {
      const big = svgNode('circle', { cy: STAGE_Y, r: R1, class: 'gw-sun', cx: 180 })
      const small = svgNode('circle', { cy: STAGE_Y, r: R2, class: 'gw-companion' })
      svg.append(big, small)
      return (phase) => {
        const angle = phase * TAU
        small.setAttribute('cx', String(180 + SEPARATION * Math.sin(angle)))
        if (Math.cos(angle) > 0) svg.append(small)
        else svg.insertBefore(small, big)
      }
    },
  },
  ellipsoidal: {
    label: 'A star stretched into an egg shape by its companion shows a changing area as the pair orbits',
    caption: 'No eclipse is needed. The stretched star is widest when its companion is off to the side and narrowest when the two line up with us, so the light rises and falls twice for every orbit.',
    // The bulge points at the companion, so the star looks widest when the companion is off to the side.
    flux: (phase) => stretchedWidth(phase) / 40,
    build(svg) {
      const star = svgNode('ellipse', { cx: 180, cy: STAGE_Y, ry: 30, class: 'gw-sun' })
      const companion = svgNode('circle', { cy: STAGE_Y, r: 7, class: 'gw-companion' })
      svg.append(star, companion)
      return (phase) => {
        const angle = phase * TAU
        star.setAttribute('rx', String(stretchedWidth(phase)))
        // A tilted orbit: the companion passes above and below the star, so it never eclipses it.
        companion.setAttribute('cx', String(180 + 92 * Math.sin(angle)))
        companion.setAttribute('cy', String(STAGE_Y + 44 * Math.cos(angle)))
        if (Math.cos(angle) > 0) svg.append(companion)
        else svg.insertBefore(companion, star)
      }
    },
  },
  rotation: {
    label: 'A dark starspot crosses the face of a rotating star, dimming it while it is in view',
    caption: 'Spots look narrower near the edge of the star, so the dip deepens as the spot reaches the middle. The curve repeats once per rotation, which reveals how fast the star spins.',
    flux(phase) {
      const facing = Math.cos(phase * TAU - Math.PI)
      return facing > 0 ? 1 - 0.3 * facing : 1
    },
    build(svg) {
      const star = svgNode('circle', { cx: 180, cy: STAGE_Y, r: 42, class: 'gw-sun' })
      const spot = svgNode('ellipse', { cy: STAGE_Y - 8, ry: 12, class: 'gw-spot' })
      svg.append(star, spot)
      return (phase) => {
        const angle = phase * TAU - Math.PI
        const facing = Math.cos(angle)
        spot.toggleAttribute('hidden', facing <= 0)
        spot.setAttribute('cx', String(180 + 36 * Math.sin(angle)))
        spot.setAttribute('rx', String(Math.max(1, 12 * facing)))
      }
    },
  },
  pulsation: {
    label: 'A star swells and shrinks while its light rises and falls',
    caption: 'In a typical pulsating star the light peaks while the star is still growing, because temperature matters more than size. Shading shows temperature: paler is hotter.',
    flux: (phase) => 0.5 + 0.5 * Math.cos(phase * TAU),
    build(svg) {
      const star = svgNode('circle', { cx: 180, cy: STAGE_Y, class: 'gw-sun' })
      svg.append(star)
      return (phase) => {
        star.setAttribute('r', String(36 + 12 * Math.sin(phase * TAU)))
        star.style.fill = `color-mix(in srgb, #fff3d3 ${Math.round((0.5 + 0.5 * Math.cos(phase * TAU)) * 100)}%, #ee7a42)`
      }
    },
  },
}

/** Variants: eclipse, ellipsoidal, rotation, pulsation. */
export const mount: WidgetMount = (host, signal, variant = 'eclipse') => {
  const scene = scenes[variant] ?? scenes.eclipse!
  const svg = drawing(host, 208, scene.label)
  const values = Array.from({ length: SAMPLES + 1 }, (_, index) => scene.flux(index / SAMPLES))
  const low = Math.min(...values), high = Math.max(...values)
  const y = (flux: number) => PLOT_BOTTOM - (PLOT_BOTTOM - PLOT_TOP) * (flux - low) / (high - low)
  const x = (phase: number) => LEFT + (RIGHT - LEFT) * phase
  svg.append(
    svgNode('line', { x1: LEFT, x2: RIGHT, y1: PLOT_BOTTOM + 3, y2: PLOT_BOTTOM + 3, class: 'gw-axis' }),
    svgNode('polyline', { class: 'gw-curve', points: values.map((flux, index) => `${x(index / SAMPLES).toFixed(1)},${y(flux).toFixed(1)}`).join(' ') }),
    text('Brightness', LEFT, PLOT_TOP - 8, 'start', 'gw-text gw-small'), text('One full cycle →', RIGHT, 205, 'end', 'gw-text gw-small'),
  )
  const stage = svgNode('g')
  const drawScene = scene.build(stage)
  svg.append(stage)
  const marker = svgNode('circle', { r: 5, class: 'gw-marker-solid' })
  svg.append(marker)
  let phase = 0
  const render = () => {
    drawScene(phase)
    marker.setAttribute('cx', String(x(phase)))
    marker.setAttribute('cy', String(y(scene.flux(phase))))
  }
  const cycle = slider(host, { label: 'Time', min: 0, max: 1, value: 0, format: (value) => `${number(value * 100, 2)}% of the cycle`, signal, onInput: (value) => { phase = value; render() } })
  player(host, signal, (elapsedMs) => {
    phase = (phase + elapsedMs / 6000) % 1
    cycle.set(phase)
    render()
  })
  note(host, `${scene.caption} A simplified drawing, not a measured star.`)
  render()
}
