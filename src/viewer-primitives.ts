import { Camera, Matrix4, Vector3, Vector4 } from 'three'
import type { ObjectType, Star } from './catalog-model'
import { visibilityTier } from './astronomy'
import type { LabelRect, LayoutViewport } from './label-layout'

export const STAR_DIAMETER_PX = 10

export function mapLabelBudget(coarsePointer: boolean): number {
  return coarsePointer ? 60 : 120
}

export const ORDINARY_LABEL_LAYOUT_INTERVAL_MS = 1000 / 30

export function shouldRunOrdinaryLabelLayout(
  timeMs: number,
  lastLayoutTimeMs: number,
  motionActive: boolean,
  layoutDirty: boolean,
): boolean {
  if (layoutDirty || !motionActive) return true
  if (!Number.isFinite(timeMs) || !Number.isFinite(lastLayoutTimeMs) || timeMs < lastLayoutTimeMs) return true
  return timeMs - lastLayoutTimeMs >= ORDINARY_LABEL_LAYOUT_INTERVAL_MS
}

export function budgetVisibleLabelIndices(
  groups: readonly { indices: readonly number[] }[],
  projections: readonly { visible: boolean; depth: number }[],
  budget: number,
): number[] {
  if (budget <= 0) return []
  const selected: number[] = []
  for (const group of groups) {
    const visible = group.indices.filter((index) => projections[index]?.visible)
      .sort((first, second) => projections[first]!.depth - projections[second]!.depth || first - second)
    for (const index of visible) {
      selected.push(index)
      if (selected.length >= budget) return selected
    }
  }
  return selected
}

export function starBlocksLabels(tier: ReturnType<typeof visibilityTier>): boolean {
  return tier !== 'background'
}

export function isObjectMapVisible(
  star: Pick<Star, 'id' | 'type'>,
  selectedTypes: ReadonlySet<ObjectType>,
  selectedId: string | null,
  observerId: string,
  distanceLy = 0,
  distanceLimitLy = Infinity,
): boolean {
  return star.id === selectedId || star.id === observerId ||
    selectedTypes.has(star.type) && distanceLy <= distanceLimitLy
}

export function focusProgress(elapsedMs: number): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / 300))
  return progress * progress * (3 - 2 * progress)
}

export function starHaloStrength(absoluteMagnitude: number | null, selected = false): number {
  const strength = absoluteMagnitude !== null && Number.isFinite(absoluteMagnitude)
    ? Math.max(0.08, Math.min(1.4, 0.65 * 10 ** Math.max(-2, Math.min(1, -0.1 * (absoluteMagnitude - 4.83)))))
    : 0.65
  return Math.min(1.8, strength * (selected ? 1.3 : 1))
}

export function starHaloDiameter(absoluteMagnitude: number | null): number {
  if (absoluteMagnitude === null || !Number.isFinite(absoluteMagnitude)) return 30
  return Math.max(20, Math.min(80, 68 - 4.25 * absoluteMagnitude))
}

export function starHaloOpacity(absoluteMagnitude: number | null, selected = false): number {
  return 0.9 * (1 - Math.exp(-1.4 * starHaloStrength(absoluteMagnitude, selected)))
}

export function motionArrowLength(speedKms: number): number {
  if (!Number.isFinite(speedKms) || speedKms <= 0) return 0
  return Math.max(12, Math.min(40, speedKms / 10))
}

export const MOTION_ARROW_TAIL_OFFSET_PX = STAR_DIAMETER_PX / 2
// Sizes keep the original 16 CSS px Lucide ArrowRight styling (24-unit icon at 16/24 scale).
export const MOTION_ARROW_STROKE_PX = 1.7 * 16 / 24
export const MOTION_ARROW_HEAD_PX = 7 * 16 / 24
export const MOTION_ARROW_DASH_PX = 3 * 16 / 24
export const MOTION_ARROW_GAP_PX = 2 * 16 / 24

export interface MotionArrowGeometry extends LabelRect {
  tailX: number
  tailY: number
  tipX: number
  tipY: number
}

export function motionArrowGeometryInto(
  x: number,
  y: number,
  motionX: number,
  motionY: number,
  length: number,
  target: MotionArrowGeometry,
): MotionArrowGeometry {
  target.tailX = x + motionX * MOTION_ARROW_TAIL_OFFSET_PX
  target.tailY = y + motionY * MOTION_ARROW_TAIL_OFFSET_PX
  target.tipX = target.tailX + motionX * length
  target.tipY = target.tailY + motionY * length
  const centerX = (target.tailX + target.tipX) / 2
  const centerY = (target.tailY + target.tipY) / 2
  const strokeRadius = MOTION_ARROW_STROKE_PX / 2
  const halfWidth = length / 2 * Math.abs(motionX) + MOTION_ARROW_HEAD_PX * Math.abs(motionY) + strokeRadius
  const halfHeight = length / 2 * Math.abs(motionY) + MOTION_ARROW_HEAD_PX * Math.abs(motionX) + strokeRadius
  target.left = centerX - halfWidth
  target.right = centerX + halfWidth
  target.top = centerY - halfHeight
  target.bottom = centerY + halfHeight
  return target
}

export function motionForeshortening(
  positionFromCamera: Pick<Vector3, 'x' | 'y' | 'z'>,
  velocityInCameraSpace: Pick<Vector3, 'x' | 'y' | 'z'>,
): number {
  const positionLength = Math.hypot(positionFromCamera.x, positionFromCamera.y, positionFromCamera.z)
  const velocityLength = Math.hypot(velocityInCameraSpace.x, velocityInCameraSpace.y, velocityInCameraSpace.z)
  if (!Number.isFinite(positionLength) || !Number.isFinite(velocityLength) || positionLength === 0 || velocityLength === 0) return 0
  const alignment = (
    positionFromCamera.x * velocityInCameraSpace.x +
    positionFromCamera.y * velocityInCameraSpace.y +
    positionFromCamera.z * velocityInCameraSpace.z
  ) / (positionLength * velocityLength)
  if (!Number.isFinite(alignment)) return 0
  return Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(alignment)) ** 2))
}

export interface Viewport extends LayoutViewport {}

export interface ProjectedPickable {
  id: string
  x: number
  y: number
  depth: number
}

export interface PointerPosition {
  clientX: number
  clientY: number
}

export class ScreenSpaceGrid<T> {
  // Cell coordinates are packed into a 32-bit key (16 bits per axis), which is
  // collision-free for coordinates in [-32768, 32767] per axis — about
  // ±1,048,576 px at the default 32 px cell size, far beyond any viewport.
  private readonly buckets = new Map<number, T[]>()
  private readonly cellSize: number

  constructor(cellSize = 32) {
    this.cellSize = cellSize
  }

  clear(): void {
    this.buckets.clear()
  }

  private cellKey(column: number, row: number): number {
    return ((column & 0xffff) << 16) | (row & 0xffff)
  }

  insert(bounds: LabelRect, value: T): void {
    const minColumn = Math.floor(bounds.left / this.cellSize)
    const maxColumn = Math.floor(bounds.right / this.cellSize)
    const minRow = Math.floor(bounds.top / this.cellSize)
    const maxRow = Math.floor(bounds.bottom / this.cellSize)
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        const key = this.cellKey(column, row)
        const bucket = this.buckets.get(key)
        if (bucket) bucket.push(value)
        else this.buckets.set(key, [value])
      }
    }
  }

  query(bounds: LabelRect): T[] {
    const matches = new Set<T>()
    const minColumn = Math.floor(bounds.left / this.cellSize)
    const maxColumn = Math.floor(bounds.right / this.cellSize)
    const minRow = Math.floor(bounds.top / this.cellSize)
    const maxRow = Math.floor(bounds.bottom / this.cellSize)
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        const bucket = this.buckets.get(this.cellKey(column, row))
        if (!bucket) continue
        for (const value of bucket) matches.add(value)
      }
    }
    return [...matches]
  }

  // Allocation-free short-circuit for "is any candidate blocked?" checks. The
  // predicate may run more than once for a value occupying several queried
  // cells, so it must be pure; callers needing every match use query().
  queryAny(bounds: LabelRect, predicate: (value: T) => boolean): boolean {
    const minColumn = Math.floor(bounds.left / this.cellSize)
    const maxColumn = Math.floor(bounds.right / this.cellSize)
    const minRow = Math.floor(bounds.top / this.cellSize)
    const maxRow = Math.floor(bounds.bottom / this.cellSize)
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        const bucket = this.buckets.get(this.cellKey(column, row))
        if (!bucket) continue
        for (const value of bucket) if (predicate(value)) return true
      }
    }
    return false
  }
}

export function pickProjectedStarAtScreenPoint(
  grid: ScreenSpaceGrid<ProjectedPickable>, viewport: Viewport, pointer: PointerPosition, radius: number,
): string | null {
  if (
    pointer.clientX < viewport.left || pointer.clientX > viewport.left + viewport.width ||
    pointer.clientY < viewport.top || pointer.clientY > viewport.top + viewport.height
  ) return null
  let selected: string | null = null
  let nearestDistance = radius
  let nearestDepth = Infinity
  const query = {
    left: pointer.clientX - radius,
    right: pointer.clientX + radius,
    top: pointer.clientY - radius,
    bottom: pointer.clientY + radius,
  }
  for (const star of grid.query(query)) {
    const distance = Math.hypot(pointer.clientX - star.x, pointer.clientY - star.y)
    if (distance > radius) continue
    if (distance < nearestDistance - 1e-6 || (Math.abs(distance - nearestDistance) < 1e-6 && star.depth < nearestDepth)) {
      selected = star.id
      nearestDistance = distance
      nearestDepth = star.depth
    }
  }
  return selected
}

interface ProjectedPointTarget {
  x: number
  y: number
  depth: number
}

export function projectWorldPointInto(
  position: Vector3,
  viewProjection: Matrix4,
  viewport: Viewport,
  clip: Vector4,
  target: ProjectedPointTarget,
): boolean {
  if (viewport.width <= 0 || viewport.height <= 0) return false
  clip.set(position.x, position.y, position.z, 1).applyMatrix4(viewProjection)
  if (clip.w <= 0) return false
  const normalizedX = clip.x / clip.w
  const normalizedY = clip.y / clip.w
  const normalizedZ = clip.z / clip.w
  if (![normalizedX, normalizedY, normalizedZ].every(Number.isFinite) ||
    Math.abs(normalizedX) > 1 || Math.abs(normalizedY) > 1 || Math.abs(normalizedZ) > 1) return false
  target.x = viewport.left + (normalizedX + 1) * viewport.width / 2
  target.y = viewport.top + (1 - normalizedY) * viewport.height / 2
  target.depth = clip.w
  return true
}

export function projectWorldPoint(position: Vector3, camera: Camera, viewport: Viewport) {
  const target = { x: 0, y: 0, depth: 0 }
  const viewProjection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  return projectWorldPointInto(position, viewProjection, viewport, new Vector4(), target) ? target : null
}

export function projectSelectedAnchor(position: Vector3, camera: Camera, viewport: Viewport) {
  if (viewport.width <= 0 || viewport.height <= 0) return null
  const clip = new Vector4(position.x, position.y, position.z, 1)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix)
  let horizontal = clip.x / Math.max(Math.abs(clip.w), 1e-9)
  let vertical = clip.y / Math.max(Math.abs(clip.w), 1e-9)
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) return null
  if (clip.w <= 0) {
    const extent = Math.max(Math.abs(horizontal), Math.abs(vertical))
    if (extent > 1e-9) {
      horizontal /= extent
      vertical /= extent
    } else vertical = -1
  }
  return {
    x: viewport.left + (Math.max(-1, Math.min(1, horizontal)) + 1) * viewport.width / 2,
    y: viewport.top + (1 - Math.max(-1, Math.min(1, vertical))) * viewport.height / 2,
  }
}

export interface MotionProjectionTarget {
  motionX: number
  motionY: number
  motionScale: number
  motionVisible: boolean
}

export function projectMotionDirectionInto(
  position: Vector3,
  velocity: Vector3,
  camera: Camera,
  viewport: Viewport,
  clipPoint: Vector4,
  viewPoint: Vector4,
  viewVelocity: Vector4,
  clipTangent: Vector4,
  target: MotionProjectionTarget,
): void {
  target.motionVisible = false
  target.motionScale = 0
  const speed = velocity.length()
  if (!Number.isFinite(speed) || speed === 0 || clipPoint.w <= 0) return
  viewPoint.set(position.x, position.y, position.z, 1).applyMatrix4(camera.matrixWorldInverse)
  viewVelocity.set(velocity.x / speed, velocity.y / speed, velocity.z / speed, 0)
    .applyMatrix4(camera.matrixWorldInverse)
  target.motionScale = motionForeshortening(viewPoint, viewVelocity)
  if (target.motionScale < 1e-6) return
  clipTangent.copy(viewVelocity).applyMatrix4(camera.projectionMatrix)
  const horizontal = clipTangent.x - clipPoint.x / clipPoint.w * clipTangent.w
  const vertical = clipTangent.y - clipPoint.y / clipPoint.w * clipTangent.w
  if (Math.hypot(horizontal, vertical) < 1e-6 * clipTangent.length()) return
  const screenX = horizontal * viewport.width
  const screenY = -vertical * viewport.height
  const length = Math.hypot(screenX, screenY)
  if (!Number.isFinite(length) || length === 0) return
  target.motionX = screenX / length
  target.motionY = screenY / length
  target.motionVisible = true
}

export function projectMotionDirection(position: Vector3, velocity: Vector3, camera: Camera, viewport: Viewport) {
  const clipPoint = new Vector4()
  const projected = { x: 0, y: 0, depth: 0, motionX: 0, motionY: 0, motionScale: 0, motionVisible: false }
  const viewProjection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  if (!projectWorldPointInto(position, viewProjection, viewport, clipPoint, projected)) return null
  projectMotionDirectionInto(position, velocity, camera, viewport, clipPoint, new Vector4(), new Vector4(), new Vector4(), projected)
  return projected.motionVisible ? { x: projected.motionX, y: projected.motionY } : null
}

type GesturePointer = PointerPosition & { pointerId: number; button: number }

export class TapGesture {
  private active = new Set<number>()
  private origin: GesturePointer | null = null
  private blocked = false

  begin(pointer: GesturePointer): void {
    if (this.active.size === 0) {
      this.origin = pointer
      this.blocked = pointer.button !== 0
    }
    this.active.add(pointer.pointerId)
    if (this.active.size > 1) this.blocked = true
  }

  move(pointer: GesturePointer): void {
    if (this.origin?.pointerId === pointer.pointerId) {
      const distance = Math.hypot(pointer.clientX - this.origin.clientX, pointer.clientY - this.origin.clientY)
      if (distance > 6) this.blocked = true
    }
  }

  end(pointer: GesturePointer): boolean {
    if (!this.active.has(pointer.pointerId)) return false
    this.move(pointer)
    const tapped = !this.blocked && this.active.size === 1 && this.origin?.pointerId === pointer.pointerId && pointer.button === 0
    this.active.delete(pointer.pointerId)
    if (this.active.size === 0) this.origin = null
    return tapped
  }

  cancel(pointerId: number): void {
    this.active.delete(pointerId)
    this.blocked = true
    if (this.active.size === 0) this.origin = null
  }
}
