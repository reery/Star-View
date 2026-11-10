import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderStats, RENDER_STATS_INTERVAL_MS, type RenderStats } from './render-stats'

// A WebGL2 context whose timer queries resolve at once with the next queued GPU time.
function fakeContext(timerQueries: boolean, gpuNs: number[] = []) {
  const extension = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
  const results = new Map<object, number>()
  return {
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    isContextLost: () => false,
    getExtension: () => timerQueries ? extension : null,
    getParameter: () => false,
    createQuery: () => ({}),
    beginQuery: () => {},
    endQuery: () => {},
    isQuery: () => true,
    deleteQuery: () => {},
    getQueryParameter(query: object, name: number) {
      if (!results.has(query)) results.set(query, gpuNs.shift()!)
      return name === 3 ? true : results.get(query)
    },
  } as unknown as WebGL2RenderingContext
}

function drawFrame(stats: ReturnType<typeof createRenderStats>, mainThreadMs: number): void {
  stats.begin()
  vi.advanceTimersByTime(mainThreadMs)
  stats.end()
}

describe('render stats', () => {
  afterEach(() => vi.useRealTimers())

  it('averages main-thread and GPU time per drawn frame', () => {
    vi.useFakeTimers()
    const reports: RenderStats[] = []
    const stats = createRenderStats(fakeContext(true, [1e6, 3e6]), (report) => reports.push(report))
    drawFrame(stats, 2)
    drawFrame(stats, 4)
    vi.advanceTimersByTime(RENDER_STATS_INTERVAL_MS - 6)
    expect(reports).toEqual([{ framesPerSecond: 4, mainThreadMs: 3, gpuMs: 2, gpuTimer: true }])
    stats.dispose()
  })

  it('keeps the last frame times while idle and reports no GPU time without timer queries', () => {
    vi.useFakeTimers()
    const reports: RenderStats[] = []
    const stats = createRenderStats(fakeContext(false), (report) => reports.push(report))
    drawFrame(stats, 5)
    vi.advanceTimersByTime(2 * RENDER_STATS_INTERVAL_MS)
    expect(reports.at(-1)).toEqual({ framesPerSecond: 0, mainThreadMs: 5, gpuMs: null, gpuTimer: false })
    stats.dispose()
    vi.advanceTimersByTime(RENDER_STATS_INTERVAL_MS)
    expect(reports).toHaveLength(2)
  })
})
