import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { renderSelectedStarPreview } from './selected-star-preview'

export function spectralReference(origin: Star, sun: Star): Star {
  return STELLAR_OBJECT_TYPES.some((type) => type === origin.type) ? origin : sun
}

const SVG_NS = 'http://www.w3.org/2000/svg'
export function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, content?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
  if (content !== undefined) node.textContent = content
  return node
}

const icons = new WeakMap<Star, string>()
export function starIcon(star: Star): string {
  const cached = icons.get(star)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  renderSelectedStarPreview(canvas, star, 'real')
  const icon = canvas.toDataURL()
  icons.set(star, icon)
  return icon
}

export function spectralMarker(star: Star, x: number, y: number, selected: boolean, prefix: 'hr' | 'mk', description: string): SVGGElement {
  const group = svgNode('g', { class: `${prefix}-${selected ? 'selected' : 'reference'}-marker`, 'data-x': x, 'data-y': y })
  const size = selected ? 48 : 42
  group.append(svgNode('title', {}, `${star.name}: ${description}`),
    svgNode('image', { href: starIcon(star), x: x - size / 2, y: y - size / 2, width: size, height: size }),
    svgNode('circle', { cx: x, cy: y, r: selected ? 13 : 11, fill: 'none', stroke: selected ? 'var(--accent-vibrant)' : 'var(--ink)', 'stroke-width': selected ? 2 : 1.5, ...(selected ? {} : { 'stroke-dasharray': '3 3' }) }))
  return group
}

export function placeSpectralMarkerLabels(svg: SVGSVGElement, bounds: { left: number; top: number; right: number; bottom: number }): void {
  type Box = { left: number; top: number; right: number; bottom: number }
  const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  const obstacles: Box[] = []
  const rootMatrix = svg.getCTM()
  if (!rootMatrix) return
  for (const text of svg.querySelectorAll<SVGTextElement>('.hr-region-text, .mk-region-text')) {
    const box = text.getBBox(), matrix = text.getCTM()
    if (!matrix) continue
    const transform = rootMatrix.inverse().multiply(matrix)
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(transform))
    obstacles.push({ left: Math.min(...corners.map((p) => p.x)) - 3, right: Math.max(...corners.map((p) => p.x)) + 3,
      top: Math.min(...corners.map((p) => p.y)) - 3, bottom: Math.max(...corners.map((p) => p.y)) + 3 })
  }
  for (const marker of svg.querySelectorAll<SVGGElement>('g[data-x][data-y]')) {
    const x = Number(marker.dataset.x), y = Number(marker.dataset.y)
    const radius = Math.max(14, Number(marker.querySelector('circle')!.getAttribute('r'))) + 2
    obstacles.push({ left: x - radius, right: x + radius, top: y - radius, bottom: y + radius })
  }
  // Keep point coordinates fixed. Only names move to avoid other names,
  // region labels and the enlarged stellar glyphs.
  for (const marker of svg.querySelectorAll<SVGGElement>('g[data-x][data-y]')) {
    const text = marker.querySelector<SVGTextElement>('.hr-marker-text')!
    const x = Number(marker.dataset.x), y = Number(marker.dataset.y)
    const width = text.getComputedTextLength(), height = text.getBBox().height
    const selected = marker.classList.contains('hr-selected-marker') || marker.classList.contains('mk-selected-marker')
    const candidates = [
      { x: Number(text.getAttribute('x')), y: Number(text.getAttribute('y')), end: text.getAttribute('text-anchor') === 'end' },
      ...[selected ? -21 : 27, selected ? 27 : -21, 5, -38, 43].flatMap((offset) => [
        { x: x + 24, y: y + offset, end: false }, { x: x - 24, y: y + offset, end: true },
      ]),
    ].map((candidate) => {
      const box = { left: candidate.end ? candidate.x - width : candidate.x, right: candidate.end ? candidate.x : candidate.x + width,
        top: candidate.y - height, bottom: candidate.y + 8 }
      const outside = box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom
      return { ...candidate, box, score: (outside ? 100 : 0) + obstacles.filter((obstacle) => intersects(box, obstacle)).length }
    })
    const placement = candidates.find((candidate) => candidate.score === 0) ?? candidates.reduce((best, candidate) => candidate.score < best.score ? candidate : best)
    text.setAttribute('x', String(placement.x))
    text.setAttribute('y', String(placement.y))
    text.setAttribute('text-anchor', placement.end ? 'end' : 'start')
    obstacles.push(placement.box)
    const underlineY = placement.y + 5
    const underlineLeft = placement.box.left, underlineRight = placement.box.right
    const endX = Math.max(underlineLeft, Math.min(underlineRight, x))
    const dx = endX - x, dy = underlineY - y, distance = Math.hypot(dx, dy)
    const radius = Number(marker.querySelector('circle')!.getAttribute('r')) + 1
    const connector = svgNode('line', {
      x1: x + dx / distance * radius, y1: y + dy / distance * radius,
      x2: endX, y2: underlineY, class: 'spectral-marker-link',
    })
    const underline = svgNode('line', {
      x1: underlineLeft, x2: underlineRight, y1: underlineY, y2: underlineY,
      class: 'spectral-marker-underline',
    })
    marker.prepend(connector, underline)
  }
}
