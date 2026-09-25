import { describe, expect, it } from 'vitest'
import { advanceFrameDeadline, effectiveDampingFactor, estimateRefreshRate, renderPixelRatio, targetRenderFps } from './render-scheduling'

describe('renderer quality policy', () => {
  it.each([
    [2, false, 1],
    [2, true, 0.5],
    [0.75, false, 0.75],
    [0.4, true, 0.4],
    [NaN, false, 1],
    [NaN, true, 0.5],
  ])('maps DPR %s with power saving %s to %s', (ratio, powerSaving, expected) => {
    expect(renderPixelRatio(ratio, powerSaving)).toBe(expected)
  })

  it.each([
    [false, null, 60],
    [false, 99.9, 60],
    [false, 100, 120],
    [false, 144, 120],
    [true, 144, 30],
  ] as const)('selects %s / %s Hz as %s FPS', (powerSaving, refreshRate, expected) => {
    expect(targetRenderFps(powerSaving, refreshRate)).toBe(expected)
  })
})

describe('refresh estimation', () => {
  it.each([
    [Array(12).fill(1000 / 60), 60],
    [Array(12).fill(1000 / 120), 120],
    [[8.1, 8.4, 8.2, 40, 8.5, 8.3, 8.4, 8.2, 8.3], 120.48],
  ])('uses the median of valid RAF deltas', (deltas, expected) => {
    expect(estimateRefreshRate(deltas)).toBeCloseTo(expected, 1)
  })

  it('requires enough valid samples and rejects stalls', () => {
    expect(estimateRefreshRate([16, 16, 16, 16])).toBeNull()
    expect(estimateRefreshRate([0, 1, 60, 100, Infinity, NaN, 16, 16, 16, 16, 16, 16])).toBeNull()
  })
})

describe('frame cadence', () => {
  it('allows an immediate first frame and waits for the next deadline', () => {
    expect(advanceFrameDeadline(10, 0, 30)).toEqual({ due: true, next: 10 + 1000 / 30 })
    expect(advanceFrameDeadline(20, 10 + 1000 / 30, 30)).toEqual({ due: false, next: 10 + 1000 / 30 })
    expect(advanceFrameDeadline(20, 100, 30, true)).toEqual({ due: true, next: 20 + 1000 / 30 })
  })

  it('preserves phase after a late callback without catch-up frames', () => {
    expect(advanceFrameDeadline(79, 50, 60).next).toBeCloseTo(250 / 3)
  })
})

describe('time-normalized damping', () => {
  it.each([
    [1000 / 30, 0.36],
    [1000 / 60, 0.2],
    [1000 / 120, 1 - Math.sqrt(0.8)],
  ])('maps %s ms to %s', (elapsedMs, expected) => {
    expect(effectiveDampingFactor(0.2, elapsedMs)).toBeCloseTo(expected, 8)
  })

  it('bounds invalid and long intervals', () => {
    expect(effectiveDampingFactor(0.2, NaN)).toBeCloseTo(0.2)
    expect(effectiveDampingFactor(0.2, 1000)).toBeCloseTo(1 - 0.8 ** 6)
    expect(effectiveDampingFactor(0, 16)).toBe(0)
    expect(effectiveDampingFactor(1, 16)).toBe(1)
  })
})
