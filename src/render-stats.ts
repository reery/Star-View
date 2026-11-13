export interface RenderStats {
  /** Frames drawn per second; 0 while the map is idle, since it draws only on change. */
  framesPerSecond: number
  /** Mean main-thread time per drawn frame; the last value stays while idle. */
  mainThreadMs: number | null
  /** Mean GPU time per drawn frame; null until measured or without timer queries. */
  gpuMs: number | null
  /** Whether the browser offers GPU timer queries; Safari does not. */
  gpuTimer: boolean
}

/** How the map draws and how much, sampled by the viewer with each report. */
export interface RenderSetup {
  /** Frame rate the map aims for while it moves. */
  targetFps: number
  /** Display refresh rate measured from animation frames; null until measured. */
  refreshRate: number | null
  /** Drawing-buffer size in device pixels. */
  width: number
  height: number
  pixelRatio: number
  multisampling: boolean
  powerSaving: boolean
  /** Work in the last drawn frame, across every pass. */
  drawCalls: number
  points: number
  lines: number
  triangles: number
  /** GPU resources the renderer holds. */
  programs: number
  geometries: number
  textures: number
}

export const RENDER_STATS_INTERVAL_MS = 500

type TimerQueryExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }

/** Times drawn frames on the main thread and, with EXT_disjoint_timer_query_webgl2, on the GPU. */
export function createRenderStats(gl: WebGL2RenderingContext, report: (stats: RenderStats) => void) {
  let stats: RenderStats = { framesPerSecond: 0, mainThreadMs: null, gpuMs: null, gpuTimer: false }
  let frames = 0
  let mainThreadMs = 0
  let gpuFrames = 0
  let gpuMs = 0
  let frameStart = 0
  let lastReport = performance.now()
  let query: WebGLQuery | null = null
  // GPU results arrive a few frames late, in the order they were issued.
  const pending: WebGLQuery[] = []
  const timer = () => gl.isContextLost() ? null : gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExtension | null

  function collect(extension: TimerQueryExtension): void {
    // Reading the flag clears it; a disjoint period invalidates every result still pending.
    const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT) as boolean
    while (pending.length > 0) {
      const next = pending[0]!
      // Queries from before a lost context are no longer valid.
      if (gl.isQuery(next)) {
        if (!gl.getQueryParameter(next, gl.QUERY_RESULT_AVAILABLE)) break
        if (!disjoint) {
          gpuMs += gl.getQueryParameter(next, gl.QUERY_RESULT) / 1e6
          gpuFrames++
        }
        gl.deleteQuery(next)
      }
      pending.shift()
    }
  }

  const interval = setInterval(() => {
    const extension = timer()
    if (extension) collect(extension)
    const now = performance.now()
    stats = {
      framesPerSecond: frames * 1000 / (now - lastReport),
      mainThreadMs: frames > 0 ? mainThreadMs / frames : stats.mainThreadMs,
      gpuMs: gpuFrames > 0 ? gpuMs / gpuFrames : stats.gpuMs,
      gpuTimer: extension !== null,
    }
    frames = mainThreadMs = gpuFrames = gpuMs = 0
    lastReport = now
    report(stats)
  }, RENDER_STATS_INTERVAL_MS)

  return {
    /** Call when a frame starts drawing. */
    begin(): void {
      frameStart = performance.now()
      const extension = timer()
      if (!extension) return
      query = gl.createQuery()
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query)
    },
    /** Call once the frame's draw calls are issued. */
    end(): void {
      mainThreadMs += performance.now() - frameStart
      frames++
      const extension = timer()
      if (query && extension) {
        gl.endQuery(extension.TIME_ELAPSED_EXT)
        pending.push(query)
      }
      query = null
    },
    dispose(): void {
      clearInterval(interval)
      if (!gl.isContextLost()) pending.forEach((entry) => gl.deleteQuery(entry))
      pending.length = 0
    },
  }
}
