const MIN_REFRESH_SAMPLES = 8

export function renderPixelRatio(devicePixelRatio: number, powerSavingMode: boolean): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(ratio, powerSavingMode ? 0.5 : 1)
}

export function estimateRefreshRate(frameDeltasMs: readonly number[]): number | null {
  const valid = frameDeltasMs
    .filter((delta) => Number.isFinite(delta) && delta >= 4 && delta <= 50)
    .sort((first, second) => first - second)
  if (valid.length < MIN_REFRESH_SAMPLES) return null
  const middle = Math.floor(valid.length / 2)
  const median = valid.length % 2 === 0
    ? (valid[middle - 1]! + valid[middle]!) / 2
    : valid[middle]!
  return 1000 / median
}

export function targetRenderFps(powerSavingMode: boolean, measuredRefreshRate: number | null): 30 | 60 | 120 {
  if (powerSavingMode) return 30
  return measuredRefreshRate !== null && measuredRefreshRate >= 100 ? 120 : 60
}

export interface FrameDeadline {
  due: boolean
  next: number
}

export function advanceFrameDeadline(now: number, next: number, fps: number, force = false): FrameDeadline {
  const interval = 1000 / fps
  if (!Number.isFinite(now) || !Number.isFinite(next) || next <= 0 || force) {
    return { due: true, next: now + interval }
  }
  if (now + 0.5 < next) return { due: false, next }
  const elapsedIntervals = Math.max(1, Math.floor((now - next) / interval) + 1)
  return { due: true, next: next + elapsedIntervals * interval }
}

export function effectiveDampingFactor(baseFactor: number, elapsedMs: number, baselineFps = 60): number {
  if (!Number.isFinite(baseFactor) || baseFactor <= 0) return 0
  if (baseFactor >= 1) return 1
  const safeElapsedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.min(elapsedMs, 100) : 1000 / baselineFps
  return 1 - (1 - baseFactor) ** (baselineFps * safeElapsedMs / 1000)
}