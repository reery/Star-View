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

export function centeredForegroundLabelBounds(
  anchor: { x: number; y: number },
  width: number,
  height: number,
  viewport: LayoutViewport,
): LabelRect {
  const viewportRight = viewport.left + viewport.width
  const viewportBottom = viewport.top + viewport.height
  const left = Math.max(viewport.left + 12, Math.min(anchor.x - width / 2, viewportRight - width - 12))
  const top = Math.max(viewport.top + 12, Math.min(anchor.y - height / 2, viewportBottom - height - 12))
  return { left, top, right: left + width, bottom: top + height }
}
