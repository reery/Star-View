import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3, type Camera } from 'three'
import { chooseOrdinaryLabelPlacement, ordinaryLabelCandidates } from './label-layout'
import {
  MOTION_ARROW_HEAD_PX, MOTION_ARROW_STROKE_PX, MOTION_ARROW_TAIL_OFFSET_PX,
  ScreenSpaceGrid, TapGesture, budgetVisibleLabelIndices, focusProgress, isObjectMapVisible,
  mapLabelBudget, motionArrowGeometryInto, motionTravelDistancePc, pickProjectedStarAtScreenPoint,
  projectMotionDirection, projectSelectedAnchor, projectWorldPoint, starBlocksLabels,
  shouldRunOrdinaryLabelLayout, starHaloDiameter, starHaloOpacity, starHaloStrength, type MotionArrowGeometry,
  type PointerPosition, type ProjectedPickable, type Viewport,
} from './viewer-primitives'

const viewport = { left: 110, top: 90, width: 400, height: 300 }

it('budgets ordinary map names by pointer density', () => {
  expect(mapLabelBudget(false)).toBe(120)
  expect(mapLabelBudget(true)).toBe(60)
})

describe('ordinary label layout cadence', () => {
  it('runs immediately for dirty, inactive, or invalid frame state', () => {
    expect(shouldRunOrdinaryLabelLayout(10, 10, true, true)).toBe(true)
    expect(shouldRunOrdinaryLabelLayout(10, 10, false, false)).toBe(true)
    expect(shouldRunOrdinaryLabelLayout(10, -Infinity, true, false)).toBe(true)
    expect(shouldRunOrdinaryLabelLayout(10, 20, true, false)).toBe(true)
  })

  it('uses a time interval instead of a frame count during motion', () => {
    expect(shouldRunOrdinaryLabelLayout(10 + 1000 / 60, 10, true, false)).toBe(false)
    expect(shouldRunOrdinaryLabelLayout(10 + 1000 / 30, 10, true, false)).toBe(true)
    expect(shouldRunOrdinaryLabelLayout(10 + 1000 / 120, 10, true, false)).toBe(false)
  })
})

it('spends the map name budget only on camera-visible stars', () => {
  const groups = [{ indices: [0] }, { indices: [1, 2, 3] }, { indices: [4] }]
  const projections = [
    { visible: false, depth: 1 },
    { visible: true, depth: 8 },
    { visible: false, depth: 1 },
    { visible: true, depth: 2 },
    { visible: true, depth: 4 },
  ]
  expect(budgetVisibleLabelIndices(groups, projections, 3)).toEqual([3, 1, 4])
  expect(budgetVisibleLabelIndices(groups, projections, 2)).toEqual([3, 1])
  expect(budgetVisibleLabelIndices(groups, projections, 0)).toEqual([])
})

describe('ordinary label placement', () => {
  const candidates = ordinaryLabelCandidates({ x: 100, y: 80 }, 40, 16)

  it('offers deterministic positions on every side of the star', () => {
    expect(candidates).toEqual([
      { placement: 'right', left: 122, top: 72, right: 162, bottom: 88 },
      { placement: 'left', left: 38, top: 72, right: 78, bottom: 88 },
      { placement: 'below', left: 80, top: 102, right: 120, bottom: 118 },
      { placement: 'above', left: 80, top: 42, right: 120, bottom: 58 },
    ])
  })

  it('uses a clear alternate when the right side is blocked', () => {
    expect(chooseOrdinaryLabelPlacement(candidates, undefined, (candidate) => candidate.placement === 'right')?.placement).toBe('left')
  })

  it('keeps a previous placement with a smaller exit gap', () => {
    const gaps: number[] = []
    const placement = chooseOrdinaryLabelPlacement(candidates, 'above', (candidate, gap) => {
      gaps.push(gap)
      return candidate.placement === 'right'
    })
    expect(placement?.placement).toBe('above')
    expect(gaps).toEqual([2])
  })
})

describe('screen-space grid cell keys', () => {
  it('round-trips points at negative coordinates', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: -40, right: -40, top: -40, bottom: -40 }, 1)
    expect(grid.query({ left: -50, right: -30, top: -50, bottom: -30 })).toEqual([1])
    expect(grid.query({ left: -20, right: 0, top: -20, bottom: 0 })).toEqual([])
  })

  it('does not leak negative-cell entries into positive cells', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: -32, right: -32, top: 0, bottom: 0 }, 1)
    expect(grid.query({ left: 0, right: 32, top: 0, bottom: 32 })).toEqual([])
    expect(grid.query({ left: -64, right: 0, top: -32, bottom: 32 })).toEqual([1])
  })

  it('matches multi-cell bounds spanning the negative/positive boundary', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: -48, right: 48, top: -16, bottom: 16 }, 1)
    expect(grid.query({ left: 20, right: 40, top: 0, bottom: 10 })).toEqual([1])
    expect(grid.query({ left: -40, right: -20, top: -10, bottom: 0 })).toEqual([1])
    expect(grid.query({ left: 64, right: 80, top: 0, bottom: 10 })).toEqual([])
  })

  it('deduplicates values inserted into overlapping cells', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: -40, right: 40, top: -40, bottom: 40 }, 1)
    expect(grid.query({ left: -40, right: 40, top: -40, bottom: 40 })).toEqual([1])
  })
})

describe('screen-space grid queryAny', () => {
  it('reports matches and respects the predicate', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: 40, right: 40, top: 40, bottom: 40 }, 1)
    expect(grid.queryAny({ left: 30, right: 50, top: 30, bottom: 50 }, (value) => value === 1)).toBe(true)
    expect(grid.queryAny({ left: 30, right: 50, top: 30, bottom: 50 }, (value) => value === 2)).toBe(false)
    expect(grid.queryAny({ left: 100, right: 120, top: 100, bottom: 120 }, () => true)).toBe(false)
  })

  it('works at negative coordinates', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: -40, right: -40, top: -40, bottom: -40 }, 1)
    expect(grid.queryAny({ left: -50, right: -30, top: -50, bottom: -30 }, (value) => value === 1)).toBe(true)
    expect(grid.queryAny({ left: -20, right: 0, top: -20, bottom: 0 }, () => true)).toBe(false)
  })

  it('short-circuits on the first matching value', () => {
    const grid = new ScreenSpaceGrid<number>()
    grid.insert({ left: 40, right: 40, top: 40, bottom: 40 }, 1)
    grid.insert({ left: 100, right: 100, top: 100, bottom: 100 }, 2)
    let calls = 0
    expect(grid.queryAny({ left: 0, right: 128, top: 0, bottom: 128 }, () => { calls += 1; return true })).toBe(true)
    expect(calls).toBe(1)
  })
})

it('ignores magnitude-filtered background dots as label obstacles', () => {
  expect(starBlocksLabels('background')).toBe(false)
  expect(starBlocksLabels('eligible')).toBe(true)
  expect(starBlocksLabels('base')).toBe(true)
})

describe('camera focus easing', () => {
  it.each([[-10, 0], [0, 0], [75, 0.15625], [150, 0.5], [225, 0.84375], [300, 1], [1000, 1]])('eases %s ms to %s', (elapsed, expected) => {
    expect(focusProgress(elapsed)).toBe(expected)
  })
})

describe('object map filtering', () => {
  const star = { id: 'target', type: 'white_dwarf' as const }

  it('uses canonical object types for ordinary visibility', () => {
    expect(isObjectMapVisible(star, new Set(['white_dwarf']), null, 'sun')).toBe(true)
    expect(isObjectMapVisible(star, new Set(['star']), null, 'sun')).toBe(false)
  })

  it('limits ordinary objects by their distance from the Sun', () => {
    expect(isObjectMapVisible(star, new Set(['white_dwarf']), null, 'sun', 8, 5)).toBe(false)
    expect(isObjectMapVisible(star, new Set(['white_dwarf']), null, 'sun', 8, 100)).toBe(true)
  })

  it('keeps the selected object and visibility base visible as exceptions', () => {
    expect(isObjectMapVisible(star, new Set(), 'target', 'sun', 101, 5)).toBe(true)
    expect(isObjectMapVisible(star, new Set(), null, 'target', 101, 5)).toBe(true)
  })
})

describe('star halo strength', () => {
  it.each([null, NaN, Infinity, -Infinity])('uses a neutral fallback for %s', (magnitude) => {
    expect(starHaloStrength(magnitude)).toBe(0.65)
    expect(starHaloStrength(magnitude, true)).toBeCloseTo(0.845)
  })

  it('makes Sirius clearly brighter than Barnard while retaining faint locators', () => {
    expect(starHaloStrength(4.83)).toBe(0.65)
    expect(starHaloStrength(1.42)).toBe(1.4)
    expect(starHaloStrength(13.22)).toBeCloseTo(0.094, 3)
    expect(starHaloStrength(1.42)).toBeGreaterThan(starHaloStrength(13.22, true) * 10)
    expect(starHaloStrength(Number.MAX_VALUE)).toBe(0.08)
    expect(starHaloStrength(-Number.MAX_VALUE)).toBe(1.4)
    const strengths = [-1, 0, 4.83, 10, 15, 20].map((magnitude) => starHaloStrength(magnitude))
    expect(strengths).toEqual([...strengths].sort((first, second) => second - first))
  })

  it('boosts selection without exceeding the display gain limit', () => {
    expect(starHaloStrength(13.22, true)).toBeGreaterThan(starHaloStrength(13.22))
    expect(starHaloStrength(-Number.MAX_VALUE, true)).toBe(1.8)
  })
})

describe('bounded halo opacity', () => {
  it('makes the glow fuller while preserving temperature headroom', () => {
    for (const magnitude of [null, 1.42, 4.83, 13.22]) {
      expect(starHaloOpacity(magnitude)).toBeGreaterThan(1 - Math.exp(-starHaloStrength(magnitude)))
    }
    expect(starHaloOpacity(null)).toBeGreaterThan(0.53)
    expect(starHaloOpacity(13.22)).toBeGreaterThan(0.11)
  })

  it.each([null, -100, 1.42, 4.83, 13.22, 100])('preserves headroom for temperature color at magnitude %s', (magnitude) => {
    const opacity = starHaloOpacity(magnitude)
    const selected = starHaloOpacity(magnitude, true)
    expect(opacity).toBeGreaterThan(0)
    expect(selected).toBeGreaterThan(opacity)
    expect(selected).toBeLessThan(0.84)
  })

  it('retains intensity contrast without clipping coincident Sirius halos to white', () => {
    expect(starHaloOpacity(1.42)).toBeGreaterThan(starHaloOpacity(13.22) * 5)
    expect(starHaloOpacity(1.42, true) + starHaloOpacity(11.34)).toBeLessThan(1)
  })
})

describe('magnitude-sized halos', () => {
  it.each([null, NaN, Infinity, -Infinity])('retains the neutral diameter for %s', (magnitude) => {
    expect(starHaloDiameter(magnitude)).toBe(30)
  })

  it('gives Sirius a substantially larger glow than Barnard', () => {
    expect(starHaloDiameter(1.42)).toBeCloseTo(61.965)
    expect(starHaloDiameter(13.22)).toBe(20)
    expect(starHaloDiameter(1.42)).toBeGreaterThan(starHaloDiameter(13.22) * 3)
  })

  it('bounds sizes and supports zero and negative magnitudes', () => {
    expect(starHaloDiameter(0)).toBe(68)
    expect(starHaloDiameter(-1)).toBe(72.25)
    expect(starHaloDiameter(-Number.MAX_VALUE)).toBe(80)
    expect(starHaloDiameter(Number.MAX_VALUE)).toBe(20)
    const sizes = [-2, 0, 5, 10, 15, 20].map(starHaloDiameter)
    expect(sizes).toEqual([...sizes].sort((first, second) => second - first))
  })
})

function makeCamera(distance = 5) {
  const camera = new PerspectiveCamera(45, viewport.width / viewport.height, 0.1, 100)
  camera.position.set(0, 0, distance)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

function pickStarAtScreenPoint(
  stars: readonly { id: string; position: Vector3 }[],
  camera: Camera,
  view: Viewport,
  pointer: PointerPosition,
  radius: number,
): string | null {
  const grid = new ScreenSpaceGrid<ProjectedPickable>()
  for (const star of stars) {
    const point = projectWorldPoint(star.position, camera, view)
    if (!point) continue
    const projected = { id: star.id, ...point }
    grid.insert({ left: projected.x, right: projected.x, top: projected.y, bottom: projected.y }, projected)
  }
  return pickProjectedStarAtScreenPoint(grid, view, pointer, radius)
}

describe('projected star picking', () => {
  it('uses the actual canvas offset and CSS dimensions', () => {
    expect(projectWorldPoint(new Vector3(), makeCamera(), viewport)).toEqual({ x: 310, y: 240, depth: 5 })
  })

  it.each([5, 50])('keeps the touch target at 24 CSS pixels at distance %s', (distance) => {
    const stars = [{ id: 'sun', position: new Vector3() }]
    expect(pickStarAtScreenPoint(stars, makeCamera(distance), viewport, { clientX: 333, clientY: 240 }, 24)).toBe('sun')
    expect(pickStarAtScreenPoint(stars, makeCamera(distance), viewport, { clientX: 335, clientY: 240 }, 24)).toBeNull()
  })

  it.each([
    [0, 0, 6], [0, 0, 4.95], [0, 0, -100], [100, 0, 0], [0, 100, 0],
  ])('rejects clipped or behind-camera point %j', (worldX, worldY, worldZ) => {
    expect(projectWorldPoint(new Vector3(worldX, worldY, worldZ), makeCamera(), viewport)).toBeNull()
  })

  it('does not select from outside the canvas or a zero-sized view', () => {
    const star = { id: 'sun', position: new Vector3() }
    expect(pickStarAtScreenPoint([star], makeCamera(), viewport, { clientX: 10, clientY: 20 }, 500)).toBeNull()
    expect(projectWorldPoint(star.position, makeCamera(), { ...viewport, width: 0 })).toBeNull()
  })

  it('chooses the closer star when projected points overlap', () => {
    const stars = [
      { id: 'far', position: new Vector3(0, 0, -1) },
      { id: 'near', position: new Vector3(0, 0, 1) },
    ]
    expect(pickStarAtScreenPoint(stars, makeCamera(), viewport, { clientX: 310, clientY: 240 }, 16)).toBe('near')
  })

  it('queries nearby grid cells while preserving distance and depth ordering', () => {
    const stars: ProjectedPickable[] = [
      { id: 'far-away', x: 480, y: 360, depth: 1 },
      { id: 'far-depth', x: 310, y: 240, depth: 8 },
      { id: 'near-depth', x: 310, y: 240, depth: 4 },
      { id: 'closer-screen', x: 307, y: 240, depth: 20 },
    ]
    const grid = new ScreenSpaceGrid<ProjectedPickable>(32)
    for (const star of stars) grid.insert({ left: star.x, right: star.x, top: star.y, bottom: star.y }, star)
    expect(pickProjectedStarAtScreenPoint(grid, viewport, { clientX: 310, clientY: 240 }, 16)).toBe('near-depth')
    expect(pickProjectedStarAtScreenPoint(grid, viewport, { clientX: 306, clientY: 240 }, 16)).toBe('closer-screen')
    expect(pickProjectedStarAtScreenPoint(grid, viewport, { clientX: 100, clientY: 240 }, 500)).toBeNull()
  })
})

describe('selected offscreen labels', () => {
  it.each([[100, 0, 0], [-100, 0, 0], [0, 100, 0], [0, -100, 0], [0, 0, 6], [1, 1, 6]])('keeps a finite anchor inside the scene for %j', (worldX, worldY, worldZ) => {
    const anchor = projectSelectedAnchor(new Vector3(worldX, worldY, worldZ), makeCamera(), viewport)!
    expect(anchor.x).toBeGreaterThanOrEqual(viewport.left)
    expect(anchor.x).toBeLessThanOrEqual(viewport.left + viewport.width)
    expect(anchor.y).toBeGreaterThanOrEqual(viewport.top)
    expect(anchor.y).toBeLessThanOrEqual(viewport.top + viewport.height)
  })

  it('rejects invalid coordinates and zero-sized viewports', () => {
    expect(projectSelectedAnchor(new Vector3(NaN, 0, 0), makeCamera(), viewport)).toBeNull()
    expect(projectSelectedAnchor(new Vector3(), makeCamera(), { ...viewport, width: 0 })).toBeNull()
  })
})

describe('motion travel distance', () => {
  it('converts speed and Julian years to parsecs', () => {
    expect(motionTravelDistancePc(20, 100_000)).toBeCloseTo(2.04542433)
    expect(motionTravelDistancePc(20, 1_000_000)).toBeCloseTo(20.4542433)
  })

  it.each([[0, 100_000], [-1, 100_000], [NaN, 100_000], [20, 0], [20, Infinity]])('rejects invalid travel inputs %j', (speed, years) => {
    expect(motionTravelDistancePc(speed, years)).toBe(0)
  })
})

describe('motion arrow geometry', () => {
  const geometry = (motionX: number, motionY: number, length: number) =>
    motionArrowGeometryInto(100, 50, motionX, motionY, length, {} as MotionArrowGeometry)

  it('keeps the original 16 CSS px icon proportions', () => {
    expect(MOTION_ARROW_TAIL_OFFSET_PX).toBe(5)
    expect(MOTION_ARROW_STROKE_PX).toBeCloseTo(1.7 * 16 / 24)
    expect(MOTION_ARROW_HEAD_PX).toBeCloseTo(7 * 16 / 24)
  })

  it('attaches the tail to the dot edge and extends the shaft by the projected length', () => {
    const arrow = geometry(0.6, -0.8, 25)
    expect(arrow.tailX).toBeCloseTo(103)
    expect(arrow.tailY).toBeCloseTo(46)
    expect(Math.hypot(arrow.tipX - arrow.tailX, arrow.tipY - arrow.tailY)).toBeCloseTo(25)
    expect(arrow.tipX).toBeCloseTo(118)
    expect(arrow.tipY).toBeCloseTo(26)
  })

  it('bounds the shaft, arrowhead and stroke radius', () => {
    const radius = MOTION_ARROW_STROKE_PX / 2
    const horizontal = geometry(1, 0, 20)
    expect(horizontal.left).toBeCloseTo(105 - radius)
    expect(horizontal.right).toBeCloseTo(125 + radius)
    expect(horizontal.top).toBeCloseTo(50 - MOTION_ARROW_HEAD_PX - radius)
    expect(horizontal.bottom).toBeCloseTo(50 + MOTION_ARROW_HEAD_PX + radius)
    const diagonal = geometry(Math.SQRT1_2, Math.SQRT1_2, 20)
    for (const [x, y] of [[diagonal.tailX, diagonal.tailY], [diagonal.tipX, diagonal.tipY]]) {
      expect(x).toBeGreaterThan(diagonal.left)
      expect(x).toBeLessThan(diagonal.right)
      expect(y).toBeGreaterThan(diagonal.top)
      expect(y).toBeLessThan(diagonal.bottom)
    }
    expect(diagonal.right - diagonal.left).toBeCloseTo(diagonal.bottom - diagonal.top)
  })

  it('collapses a fully foreshortened shaft onto the tail', () => {
    const arrow = geometry(0, 1, 0)
    expect(arrow.tipX).toBe(arrow.tailX)
    expect(arrow.tipY).toBe(arrow.tailY)
    expect(arrow.right - arrow.left).toBeCloseTo(2 * (MOTION_ARROW_HEAD_PX + MOTION_ARROW_STROKE_PX / 2))
  })
})

describe('projected motion direction', () => {
  it.each([1e-12, 1, 1000])('keeps a fixed direction for velocity scale %s', (scale) => {
    expect(projectMotionDirection(new Vector3(), new Vector3(scale, 0, 0), makeCamera(), viewport)).toMatchObject({ x: 1, y: -0 })
    expect(projectMotionDirection(new Vector3(), new Vector3(0, scale, 0), makeCamera(), viewport)).toMatchObject({ x: 0, y: -1 })
    expect(projectMotionDirection(new Vector3(), new Vector3(-scale, 0, 0), makeCamera(), viewport)).toMatchObject({ x: -1, y: -0 })
  })

  it.each([0, 0.5, 1.5])('matches a small world displacement with camera rotation %s', (angle) => {
    const camera = makeCamera()
    camera.position.set(Math.sin(angle) * 5, 2, Math.cos(angle) * 5)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const position = new Vector3(0.4, 0.3, -0.2)
    const velocity = new Vector3(-3, 1, 4)
    const start = projectWorldPoint(position, camera, viewport)!
    const end = projectWorldPoint(position.clone().addScaledVector(velocity, 1e-5), camera, viewport)!
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    const heading = projectMotionDirection(position, velocity, camera, viewport)!
    expect(heading.x).toBeCloseTo((end.x - start.x) / length, 6)
    expect(heading.y).toBeCloseTo((end.y - start.y) / length, 6)
    expect(heading.pixelsPerPc).toBeCloseTo(length / (velocity.length() * 1e-5), 3)
    expect(projectMotionDirection(position, velocity, camera, { ...viewport, left: 0, top: 0 })).toEqual(heading)
  })

  it('includes off-axis perspective and ignores far endpoint clipping', () => {
    expect(projectMotionDirection(new Vector3(1, 0, 0), new Vector3(0, 0, 10), makeCamera(), viewport)?.x).toBe(1)
    expect(projectMotionDirection(new Vector3(1, 0, 0), new Vector3(-1, 0, 5), makeCamera(), viewport)).toBeNull()
  })

  it('suppresses undefined, camera-aligned and clipped directions', () => {
    for (const velocity of [new Vector3(), new Vector3(0, 0, 1), new Vector3(1e-9, 0, 1), new Vector3(NaN, 0, 0)]) {
      expect(projectMotionDirection(new Vector3(), velocity, makeCamera(), viewport)).toBeNull()
    }
    for (const position of [new Vector3(0, 0, 6), new Vector3(0, 0, 4.95), new Vector3(0, 0, -100), new Vector3(100, 0, 0)]) {
      expect(projectMotionDirection(position, new Vector3(1, 0, 0), makeCamera(), viewport)).toBeNull()
    }
    expect(projectMotionDirection(new Vector3(), new Vector3(1, 0, 0), makeCamera(), { ...viewport, width: 0 })).toBeNull()
  })
})

const pointer = { pointerId: 1, button: 0, clientX: 100, clientY: 100 }

describe('tap gesture', () => {
  it('accepts a single click or slightly moving tap', () => {
    const gesture = new TapGesture()
    gesture.begin(pointer)
    expect(gesture.end({ ...pointer, clientX: 103 })).toBe(true)
  })

  it('rejects a drag, including a drag back to its starting point', () => {
    const gesture = new TapGesture()
    gesture.begin(pointer)
    gesture.move({ ...pointer, clientX: 120 })
    expect(gesture.end(pointer)).toBe(false)
    gesture.begin(pointer)
    expect(gesture.end({ ...pointer, clientX: 120 })).toBe(false)
  })

  it('rejects the entire multi-touch sequence and accepts the next independent tap', () => {
    const gesture = new TapGesture()
    const second = { ...pointer, pointerId: 2 }
    gesture.begin(pointer)
    gesture.begin(second)
    expect(gesture.end(second)).toBe(false)
    expect(gesture.end(pointer)).toBe(false)
    gesture.begin(pointer)
    expect(gesture.end(pointer)).toBe(true)
  })

  it('rejects cancellation and non-primary mouse buttons', () => {
    const gesture = new TapGesture()
    gesture.begin(pointer)
    gesture.cancel(pointer.pointerId)
    expect(gesture.end(pointer)).toBe(false)
    const rightButton = { ...pointer, button: 2 }
    gesture.begin(rightButton)
    expect(gesture.end(rightButton)).toBe(false)
  })
})
