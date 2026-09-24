import { expect, type Page } from '@playwright/test'
import type { PNG } from 'pngjs'
import type { MotionArrowSnapshot } from '../src/viewer'
import { MOTION_ARROW_HEAD_PX, MOTION_ARROW_STROKE_PX, MOTION_ARROW_TAIL_OFFSET_PX } from '../src/viewer-primitives'

export type { MotionArrowSnapshot }

type Point = { x: number; y: number }
type Segment = readonly [number, number, number, number]

export async function motionArrows(page: Page): Promise<MotionArrowSnapshot[]> {
  // Arrow instances are rebuilt with each rendered frame.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return page.locator('.projected-labels').evaluate((layer) =>
    (layer as HTMLElement & { motionArrowSnapshot(): MotionArrowSnapshot[] }).motionArrowSnapshot())
}

function segmentDistance(x: number, y: number, [startX, startY, endX, endY]: Segment): number {
  const segmentX = endX - startX
  const segmentY = endY - startY
  const lengthSquared = segmentX ** 2 + segmentY ** 2
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - startX) * segmentX + (y - startY) * segmentY) / lengthSquared))
  return Math.hypot(x - startX - segmentX * along, y - startY - segmentY * along)
}

// Shaft, then both arrowhead strokes, relative to origin (for example the canvas box).
function arrowSegments(arrow: MotionArrowSnapshot, origin: Point): Segment[] {
  const directionX = (arrow.tailX - arrow.x) / MOTION_ARROW_TAIL_OFFSET_PX
  const directionY = (arrow.tailY - arrow.y) / MOTION_ARROW_TAIL_OFFSET_PX
  const tipX = arrow.tipX - origin.x
  const tipY = arrow.tipY - origin.y
  const backX = tipX - directionX * MOTION_ARROW_HEAD_PX
  const backY = tipY - directionY * MOTION_ARROW_HEAD_PX
  const sideX = -directionY * MOTION_ARROW_HEAD_PX
  const sideY = directionX * MOTION_ARROW_HEAD_PX
  return [
    [arrow.tailX - origin.x, arrow.tailY - origin.y, tipX, tipY],
    [tipX, tipY, backX + sideX, backY + sideY],
    [tipX, tipY, backX - sideX, backY - sideY],
  ]
}

// True for points (CSS px relative to origin) that an arrow stroke or its antialiasing may touch.
export function arrowPixelMask(arrows: readonly MotionArrowSnapshot[], origin: Point, margin = 1.5) {
  const reach = MOTION_ARROW_STROKE_PX / 2 + margin
  const segments = arrows.flatMap((arrow) => arrowSegments(arrow, origin))
  return (x: number, y: number) => segments.some((segment) => segmentDistance(x, y, segment) <= reach)
}

function segmentsDistance(first: Segment, second: Segment): number {
  const [ax, ay, bx, by] = first
  const [cx, cy, dx, dy] = second
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px)
  if (side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 && side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0) return 0
  return Math.min(segmentDistance(ax, ay, second), segmentDistance(bx, by, second), segmentDistance(cx, cy, first), segmentDistance(dx, dy, first))
}

// Arrows whose shafts keep `gap` CSS px from other arrows, other dots and the canvas edges.
export function isolatedArrows(arrows: readonly MotionArrowSnapshot[], canvas: Point & { width: number; height: number }, gap = 4.5) {
  const origin = { x: 0, y: 0 }
  return arrows.filter((arrow) => {
    const [shaft] = arrowSegments(arrow, origin)
    return arrow.bounds.left > canvas.x + 8 && arrow.bounds.right < canvas.x + canvas.width - 8 &&
      arrow.bounds.top > canvas.y + 8 && arrow.bounds.bottom < canvas.y + canvas.height - 8 &&
      arrows.every((other) => other === arrow || (
        segmentDistance(other.x, other.y, shaft!) > MOTION_ARROW_TAIL_OFFSET_PX + gap &&
        arrowSegments(other, origin).every((segment) => segmentsDistance(segment, shaft!) > gap)))
  })
}

// Samples a CSS-scale canvas screenshot along an arrow's shaft body, against the local background beside it.
export function measureArrowShaft(image: PNG, arrow: MotionArrowSnapshot, origin: Point) {
  const [shaft, ...arms] = arrowSegments(arrow, origin)
  const [tailX, tailY] = shaft!
  const directionX = (arrow.tailX - arrow.x) / MOTION_ARROW_TAIL_OFFSET_PX
  const directionY = (arrow.tailY - arrow.y) / MOTION_ARROW_TAIL_OFFSET_PX
  // Beyond this point the arrowhead strokes approach the centerline.
  const end = arrow.length - 2.2
  const centerline: { along: number; value: number }[] = []
  const body: { along: number; value: number }[] = []
  const background: { along: number; value: number }[] = []
  for (let pixelY = Math.floor(arrow.bounds.top - origin.y - 4); pixelY <= Math.ceil(arrow.bounds.bottom - origin.y + 4); pixelY++) {
    for (let pixelX = Math.floor(arrow.bounds.left - origin.x - 4); pixelX <= Math.ceil(arrow.bounds.right - origin.x + 4); pixelX++) {
      if (pixelX < 0 || pixelY < 0 || pixelX >= image.width || pixelY >= image.height) continue
      const offsetX = pixelX + 0.5 - tailX
      const offsetY = pixelY + 0.5 - tailY
      const along = offsetX * directionX + offsetY * directionY
      const across = Math.abs(offsetY * directionX - offsetX * directionY)
      if (along < 2 || along > end) continue
      const offset = (pixelY * image.width + pixelX) * 4
      const sample = { along, value: image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]! }
      if (across <= 0.4) centerline.push(sample)
      if (across <= 2.2) body.push(sample)
      else if (across >= 2.6 && across <= 3.6 && arms.every((arm) => segmentDistance(pixelX + 0.5, pixelY + 0.5, arm) > 1.6)) background.push(sample)
    }
  }
  const contrast = ({ along, value }: { along: number; value: number }) => {
    const near = background.filter((sample) => Math.abs(sample.along - along) <= 1.5)
    return near.length === 0 ? NaN : value - near.reduce((sum, sample) => sum + sample.value, 0) / near.length
  }
  const centerContrast = centerline.map(contrast).filter(Number.isFinite)
  const peak = Math.max(...centerContrast)
  // Occluded or unresolved shafts carry no stroke information.
  if (!(peak > 60)) return { samples: 0, gaps: 0, strokeWidth: NaN }
  return {
    samples: centerContrast.length,
    gaps: centerContrast.filter((value) => value < peak / 2).length,
    strokeWidth: body.map(contrast).filter(Number.isFinite)
      .reduce((sum, value) => sum + Math.max(0, Math.min(1, value / peak)), 0) / (end - 2),
  }
}

export async function starPoint(page: Page, id: string) {
  const anchor = page.locator(`.map-anchor[data-star-id="${id}"]`)
  await expect(anchor).toBeVisible()
  // Camera changes render on the next frame; sample the updated anchor before
  // using its coordinates for screenshots or pointer input.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return anchor.evaluate((element) => {
    const rectangle = element.getBoundingClientRect()
    return { x: rectangle.left, y: rectangle.top }
  })
}

export async function openViewer(page: Page) {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await page.evaluate(() => document.fonts.ready)
  await starPoint(page, 'sirius-a')
}

export async function openPreferences(page: Page) {
  const preferences = page.locator('details.preferences')
  if (await preferences.getAttribute('open') === null) await preferences.locator('summary').click()
}

export async function openFilter(page: Page) {
  const filter = page.locator('details.filter-section')
  if (await filter.getAttribute('open') === null) await filter.locator(':scope > summary').click()
}
