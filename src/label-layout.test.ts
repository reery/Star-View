import { describe, expect, it } from 'vitest'
import { chooseDistanceLabelPlacement, overlaps } from './label-layout'

const viewport = { left: 0, top: 0, width: 500, height: 320 }

function placement(start = { x: 100, y: 160 }, end = { x: 400, y: 160 }) {
  return chooseDistanceLabelPlacement({
    anchor: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    start,
    end,
    startDiameter: 60,
    endDiameter: 40,
    width: 80,
    height: 20,
    viewport,
    previousNormal: { x: 0, y: -1 },
    previousSide: 1,
  })
}

describe('distance label placement', () => {
  it('centers the label on the projected line midpoint when it clears both endpoint halos', () => {
    const result = placement()!
    expect(result.bounds).toEqual({ left: 210, top: 150, right: 290, bottom: 170 })
    expect(result.side).toBe(1)
    expect(overlaps(result.bounds, { left: 64, right: 136, top: 124, bottom: 196 }, 0)).toBe(false)
    expect(overlaps(result.bounds, { left: 374, right: 426, top: 134, bottom: 186 }, 0)).toBe(false)
  })

  it('follows the midpoint of a diagonal line', () => {
    const result = placement({ x: 100, y: 60 }, { x: 400, y: 260 })!
    expect((result.bounds.left + result.bounds.right) / 2).toBe(250)
    expect((result.bounds.top + result.bounds.bottom) / 2).toBe(160)
  })

  it('moves beside the line when a centered label would cover an endpoint halo', () => {
    const result = placement({ x: 200, y: 160 }, { x: 300, y: 160 })!
    expect(result.side).toBe(1)
    expect(result.normal).toEqual({ x: 0, y: -1 })
    expect(result.bounds.bottom).toBeLessThanOrEqual(124)
  })

  it('keeps clearance when the projected endpoints nearly coincide', () => {
    const result = placement({ x: 245, y: 160 }, { x: 255, y: 160 })!
    expect(result.bounds.bottom).toBeLessThanOrEqual(124)
  })

  it('uses the opposite side when viewport clamping blocks the current side', () => {
    const result = placement({ x: 245, y: 25 }, { x: 255, y: 25 })!
    expect(result.side).toBe(-1)
    expect(result.bounds.top).toBeGreaterThan(25)
  })

  it('returns no placement when the viewport cannot clear either endpoint', () => {
    expect(chooseDistanceLabelPlacement({
      anchor: { x: 20, y: 20 },
      start: { x: 15, y: 20 },
      end: { x: 25, y: 20 },
      startDiameter: 60,
      endDiameter: 60,
      width: 36,
      height: 20,
      viewport: { left: 0, top: 0, width: 40, height: 40 },
      previousNormal: { x: 0, y: -1 },
      previousSide: 1,
    })).toBeNull()
  })
})
