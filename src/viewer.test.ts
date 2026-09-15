import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { focusProgress, motionArrowLength, pickStarAtScreenPoint, projectMotionDirection, projectSelectedAnchor, projectWorldPoint, starHaloDiameter, starHaloOpacity, starHaloStrength, TapGesture } from './viewer'

const viewport = { left: 110, top: 90, width: 400, height: 300 }

describe('camera focus easing', () => {
  it.each([[-10, 0], [0, 0], [75, 0.15625], [150, 0.5], [225, 0.84375], [300, 1], [1000, 1]])('eases %s ms to %s', (elapsed, expected) => {
    expect(focusProgress(elapsed)).toBe(expected)
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
    expect(starHaloDiameter(magnitude)).toBe(26)
  })

  it('gives Sirius a substantially larger glow than Barnard', () => {
    expect(starHaloDiameter(1.42)).toBeCloseTo(55.74)
    expect(starHaloDiameter(13.22)).toBeCloseTo(20.34)
    expect(starHaloDiameter(1.42)).toBeGreaterThan(starHaloDiameter(13.22) * 2.5)
  })

  it('bounds sizes and supports zero and negative magnitudes', () => {
    expect(starHaloDiameter(0)).toBe(60)
    expect(starHaloDiameter(-1)).toBe(63)
    expect(starHaloDiameter(-Number.MAX_VALUE)).toBe(64)
    expect(starHaloDiameter(Number.MAX_VALUE)).toBe(18)
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

describe('motion arrow speed scale', () => {
  it.each([[1, 12], [120, 12], [180, 18], [250, 25], [300, 30], [400, 40], [1000, 40]])('maps %s km/s to a %s CSS pixel shaft', (speed, length) => {
    expect(motionArrowLength(speed)).toBe(length)
  })

  it.each([0, -1, NaN, Infinity])('does not give undefined motion %s a length', (speed) => {
    expect(motionArrowLength(speed)).toBe(0)
  })
})

describe('projected motion direction', () => {
  it.each([1e-12, 1, 1000])('keeps a fixed direction for velocity scale %s', (scale) => {
    expect(projectMotionDirection(new Vector3(), new Vector3(scale, 0, 0), makeCamera(), viewport)).toEqual({ x: 1, y: -0 })
    expect(projectMotionDirection(new Vector3(), new Vector3(0, scale, 0), makeCamera(), viewport)).toEqual({ x: 0, y: -1 })
    expect(projectMotionDirection(new Vector3(), new Vector3(-scale, 0, 0), makeCamera(), viewport)).toEqual({ x: -1, y: -0 })
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