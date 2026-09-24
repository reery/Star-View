export interface LabelRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface LayoutViewport {
  left: number
  top: number
  width: number
  height: number
}

export type OrdinaryLabelPlacement = 'right' | 'left' | 'below' | 'above'

export interface OrdinaryLabelCandidate extends LabelRect {
  placement: OrdinaryLabelPlacement
}

export function overlaps(first: LabelRect, second: LabelRect, gap = 6): boolean {
  return first.left < second.right + gap && first.right + gap > second.left &&
    first.top < second.bottom + gap && first.bottom + gap > second.top
}

export function ordinaryLabelCandidates(anchor: { x: number; y: number }, width: number, height: number): OrdinaryLabelCandidate[] {
  return [
    { placement: 'right', left: anchor.x + 22, top: anchor.y - height / 2, right: anchor.x + 22 + width, bottom: anchor.y + height / 2 },
    { placement: 'left', left: anchor.x - width - 22, top: anchor.y - height / 2, right: anchor.x - 22, bottom: anchor.y + height / 2 },
    { placement: 'below', left: anchor.x - width / 2, top: anchor.y + 22, right: anchor.x + width / 2, bottom: anchor.y + 22 + height },
    { placement: 'above', left: anchor.x - width / 2, top: anchor.y - height - 22, right: anchor.x + width / 2, bottom: anchor.y - 22 },
  ]
}

export function chooseOrdinaryLabelPlacement(
  candidates: readonly OrdinaryLabelCandidate[],
  previous: OrdinaryLabelPlacement | undefined,
  blocked: (candidate: OrdinaryLabelCandidate, gap: number) => boolean,
): OrdinaryLabelCandidate | null {
  const ordered = previous
    ? [...candidates.filter((candidate) => candidate.placement === previous), ...candidates.filter((candidate) => candidate.placement !== previous)]
    : candidates
  return ordered.find((candidate) => !blocked(candidate, candidate.placement === previous ? 2 : 6)) ?? null
}

export interface DistanceLabelPlacement {
  bounds: LabelRect
  normal: { x: number; y: number }
  side: number
}

interface DistanceLabelOptions {
  anchor: { x: number; y: number }
  start: { x: number; y: number }
  end: { x: number; y: number }
  startDiameter: number
  endDiameter: number
  width: number
  height: number
  viewport: LayoutViewport
  previousNormal: { x: number; y: number }
  previousSide: number
}

export function chooseDistanceLabelPlacement(options: DistanceLabelOptions): DistanceLabelPlacement | null {
  const { anchor, start, end, startDiameter, endDiameter, width, height, viewport, previousNormal, previousSide } = options
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  const normal = length > 1 ? { x: dy / length, y: -dx / length } : previousNormal
  const startRadius = startDiameter / 2 + 6
  const endRadius = endDiameter / 2 + 6
  const maximumRadius = Math.max(startRadius, endRadius)
  const endpoints = [
    { left: start.x - startRadius, right: start.x + startRadius, top: start.y - startRadius, bottom: start.y + startRadius },
    { left: end.x - endRadius, right: end.x + endRadius, top: end.y - endRadius, bottom: end.y + endRadius },
  ]
  const viewportRight = viewport.left + viewport.width
  const viewportBottom = viewport.top + viewport.height
  const clamp = (left: number, top: number): LabelRect => {
    left = Math.max(viewport.left + 12, Math.min(left, viewportRight - width - 12))
    top = Math.max(viewport.top + 12, Math.min(top, viewportBottom - height - 12))
    return { left, top, right: left + width, bottom: top + height }
  }
  const clearsEndpoints = (bounds: LabelRect) => endpoints.every((endpoint) => !overlaps(bounds, endpoint, 0))
  const centered = clamp(anchor.x - width / 2, anchor.y - height / 2)
  if (clearsEndpoints(centered)) return { bounds: centered, normal, side: previousSide }

  const offset = Math.abs(normal.x) * (width / 2 + maximumRadius) +
    Math.abs(normal.y) * (height / 2 + maximumRadius)
  const candidates = [previousSide, -previousSide].map((side) => ({
    bounds: clamp(anchor.x + normal.x * offset * side - width / 2, anchor.y + normal.y * offset * side - height / 2),
    normal,
    side,
  }))
  const besideLine = candidates.find((candidate) => clearsEndpoints(candidate.bounds))
  if (besideLine) return besideLine

  const corners = [viewport.left + 12, viewportRight - width - 12].flatMap((left) =>
    [viewport.top + 12, viewportBottom - height - 12].map((top) => ({
      bounds: clamp(left, top),
      normal,
      side: previousSide,
    })))
  return corners
    .filter((candidate) => clearsEndpoints(candidate.bounds))
    .sort((first, second) =>
      Math.hypot(first.bounds.left + width / 2 - anchor.x, first.bounds.top + height / 2 - anchor.y) -
      Math.hypot(second.bounds.left + width / 2 - anchor.x, second.bounds.top + height / 2 - anchor.y))[0] ?? null
}
