import { projectConstellationPosition, type SkyPosition } from './constellations'

type Point = { x: number; y: number }
export interface ConstellationGridView {
  center: SkyPosition
  centerX: number
  centerY: number
  scale: number
  width: number
  height: number
}
interface GridLine { axis: 'ra' | 'dec'; value: number; label: string; path: string; edge: Point | null }
const radians = Math.PI / 180

/** Clip before serializing so horizon singularities never produce giant SVG paths. */
function clip(a: Point, b: Point, width: number, height: number): [Point, Point] | null {
  const dx = b.x - a.x, dy = b.y - a.y
  let start = 0, end = 1
  for (const [p, q] of [[-dx, a.x], [dx, width - a.x], [-dy, a.y], [dy, height - a.y]] as const) {
    if (p === 0) { if (q < 0) return null; continue }
    const t = q / p
    if (p < 0) start = Math.max(start, t)
    else end = Math.min(end, t)
    if (start > end) return null
  }
  return [{ x: a.x + start * dx, y: a.y + start * dy }, { x: a.x + end * dx, y: a.y + end * dy }]
}

export function constellationGrid(view: ConstellationGridView): { raStep: number; decStep: number; lines: GridLine[] } {
  const { center, centerX, centerY, scale, width, height } = view
  // Invert the gnomonic projection at the view center to space RA meridians
  // according to their convergence at this declination, including polar charts.
  const dec0 = center.dec_deg * radians
  const radius = Math.hypot(centerX, centerY)
  const dec = Math.asin((Math.sin(dec0) - centerY * Math.cos(dec0)) / Math.sqrt(1 + radius ** 2))
  const degreesPerInterval = 72 / (scale * Math.sqrt(1 + radius ** 2)) / radians
  const step = (target: number, choices: number[]) => choices.find((value) => value >= target) ?? choices.at(-1)!
  const decStep = step(degreesPerInterval, [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 45])
  const raStep = step(degreesPerInterval / Math.max(0.15, Math.cos(dec)), [0.25, 0.5, 0.75, 1.25, 2.5, 3.75, 5, 7.5, 15, 30, 45, 60, 90])
  const lines: GridLine[] = []
  const trace = (axis: GridLine['axis'], value: number, label: string, positions: SkyPosition[]) => {
    let previous: Point | null = null
    let last: Point | null = null
    let edge: Point | null = null
    const paths: string[] = []
    for (const position of positions) {
      const projected = projectConstellationPosition(position, center)
      const point = projected ? { x: width / 2 + (projected.x - centerX) * scale, y: height / 2 + (projected.y - centerY) * scale } : null
      const segment = previous && point ? clip(previous, point, width, height) : null
      if (segment) {
        const [a, b] = segment
        if (!last || Math.hypot(a.x - last.x, a.y - last.y) > 0.01) paths.push(`M${a.x.toFixed(2)},${a.y.toFixed(2)}`)
        paths.push(`L${b.x.toFixed(2)},${b.y.toFixed(2)}`)
        last = b
        for (const p of segment) {
          if (!edge && (p.x < 0.01 || p.x > width - 0.01 || p.y < 0.01 || p.y > height - 0.01)) edge = p
        }
      } else last = null
      previous = point
    }
    if (paths.length) lines.push({ axis, value, label, path: paths.join(' '), edge })
  }
  for (let ra = 0; ra < 360; ra += raStep) {
    const minutes = Math.round(ra * 4)
    const label = `${Math.floor(minutes / 60)}h${minutes % 60 ? `${String(minutes % 60).padStart(2, '0')}m` : ''}`
    trace('ra', ra, label, Array.from({ length: 361 }, (_, i) => ({ ra_deg: ra, dec_deg: -90 + i / 2 })))
  }
  for (let dec = -Math.floor(89.999 / decStep) * decStep; dec < 90; dec += decStep) {
    trace('dec', dec, `${dec > 0 ? '+' : dec < 0 ? '−' : ''}${Math.abs(dec)}°`,
      Array.from({ length: 721 }, (_, i) => ({ ra_deg: i / 2, dec_deg: dec })))
  }
  return { raStep, decStep, lines }
}
