// Standardized performance check: cold load, CPU and GPU cost of the production build in Chromium.
// Usage: npm run perf -- [--runs 3] [--seconds 5] [--states default,medium,full] [--scales 1,2] [--no-build] [--headed] [--throttle] [--label name] [--compare file.json]
// --throttle loads over an emulated 20 Mbit/s, 40 ms connection instead of localhost speed.
// --report (npm run perf:report) only opens scripts/perf-report.html with every saved result.
// Each state loads in a fresh browser (cold cache) in a 1440×900 window at 1× and 2× pixel density, then idles,
// auto-rotates and plays stellar motion. At 2× the app renders at full density without MSAA; at 1× it uses MSAA.
// Results are saved to perf-results/ and compared
// with the previous result file. Close heavy apps while measuring: CPU and GPU numbers share the machine.
import { chromium, type Browser, type CDPSession, type Page } from '@playwright/test'
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_FILTER_CATEGORIES, DEFAULT_FILTER_SUBTYPES, FILTER_CATEGORY_IDS, FILTER_KEYS } from '../src/object-filter.ts'

const args = process.argv.slice(2)
const option = (name: string): string | undefined => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1] }
const runs = Number(option('runs') ?? 3)
const seconds = Number(option('seconds') ?? 5)
const label = option('label')
const throttle = args.includes('--throttle')
const port = 4179
const baseURL = `http://127.0.0.1:${port}`
const resultDir = 'perf-results'

type Metrics = Record<string, number | null>
type Result = { meta: Record<string, unknown>; runs: Metrics[]; median: Metrics }

// The states load straight from a saved filter (src/saved-filter.ts) and stored display preferences.
// Medium and full lift the distance limit to its last step (20,000 ly) so the constellation stars are not filtered out.
const largestFilter = { version: 1, catalogId: 'nearest-5000', showAlwaysBright: false, magnitudeLimit: 7, hideFainterObjects: false, objectDistanceLimitLy: 20000 }
const STATES: Record<string, { storage: Record<string, string>; motionArrows?: boolean }> = {
  default: { storage: {} },
  medium: { storage: { 'star-view-saved-filter': JSON.stringify({ ...largestFilter, showWesternConstellationStars: true, filterCategories: DEFAULT_FILTER_CATEGORIES, filterSubtypes: DEFAULT_FILTER_SUBTYPES }) } },
  full: {
    storage: {
      'star-view-saved-filter': JSON.stringify({ ...largestFilter, magnitudeLimit: 30, showWesternConstellationStars: true, showNakedEyeStars: true, showNotableDistantStars: true, filterCategories: FILTER_CATEGORY_IDS, filterSubtypes: FILTER_KEYS }),
      'star-view-label-limit': '140',
      'star-view-sky-grid-mode': 'equatorial',
    },
    motionArrows: true,
  },
}
const states = option('states')?.split(',') ?? Object.keys(STATES)
const scales = (option('scales') ?? '1,2').split(',').map(Number)
for (const state of states) if (!STATES[state]) throw new Error(`Unknown state ${state}; use ${Object.keys(STATES).join(', ')}`)

/** Injected before the app: times every animation-frame callback on the CPU and, with a timer query, on the GPU. */
function instrument(): void {
  type Perf = { marks: Record<string, number>; longTasks: [number, number][]; firstFrame: number | null; lastFrame: number; recording: boolean; frames: Map<number, { cpu: number; gpu: number; pending: number }>; collect(): void }
  const perf: Perf = { marks: {}, longTasks: [], firstFrame: null, lastFrame: 0, recording: false, frames: new Map(), collect }
  ;(window as unknown as { __perf: Perf }).__perf = perf
  new PerformanceObserver((list) => { for (const entry of list.getEntries()) perf.longTasks.push([entry.startTime, entry.duration]) }).observe({ type: 'longtask', buffered: true })
  new MutationObserver((records) => {
    for (const record of records) perf.marks[`${record.attributeName}=${(record.target as Element).getAttribute(record.attributeName!)}`] ??= performance.now()
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-ready', 'data-milky-way-ready'] })

  const contexts: WebGL2RenderingContext[] = []
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const context = (getContext as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest)
    if (type === 'webgl2' && context && !contexts.includes(context as WebGL2RenderingContext)) contexts.push(context as WebGL2RenderingContext)
    return context
  } as typeof getContext
  const pending: { gl: WebGL2RenderingContext; query: WebGLQuery; frame: { gpu: number; pending: number } }[] = []
  const timerExtension = new WeakMap<WebGL2RenderingContext, { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null>()
  const timer = (gl: WebGL2RenderingContext) => {
    if (!timerExtension.has(gl)) timerExtension.set(gl, gl.getExtension('EXT_disjoint_timer_query_webgl2'))
    return timerExtension.get(gl)!
  }
  function collect(): void {
    for (let index = pending.length - 1; index >= 0; index--) {
      const { gl, query, frame } = pending[index]!
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue
      if (!gl.getParameter(timer(gl)!.GPU_DISJOINT_EXT)) frame.gpu += gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6
      frame.pending--
      gl.deleteQuery(query)
      pending.splice(index, 1)
    }
  }
  const requestFrame = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) => requestFrame((time) => {
    collect()
    const gl = contexts.find((context) => context.canvas instanceof HTMLCanvasElement && context.canvas.closest('#scene'))
    const extension = gl && timer(gl)
    const query = extension ? gl.createQuery() : null
    if (query) gl!.beginQuery(extension!.TIME_ELAPSED_EXT, query)
    const start = performance.now()
    try { callback(time) } finally {
      const cpu = performance.now() - start
      if (query) gl!.endQuery(extension!.TIME_ELAPSED_EXT)
      perf.firstFrame ??= start
      perf.lastFrame = start
      let frame = perf.frames.get(time)
      if (perf.recording && !frame) perf.frames.set(time, frame = { cpu: 0, gpu: 0, pending: 0 })
      if (frame) frame.cpu += cpu
      if (query && frame) { frame.pending++; pending.push({ gl: gl!, query, frame }) } else if (query) gl!.deleteQuery(query)
    }
  })
}

const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = sorted.length >> 1; return sorted.length === 0 ? null : sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2 }
const percentile = (values: number[], p: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! }

async function processCpu(cdp: CDPSession): Promise<Map<number, { type: string; cpu: number }>> {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo' as never) as { processInfo: { type: string; id: number; cpuTime: number }[] }
  return new Map(processInfo.map((process) => [process.id, { type: process.type, cpu: process.cpuTime * 1000 }]))
}

/** CPU milliseconds each process type used between two snapshots. */
function cpuDelta(before: Map<number, { type: string; cpu: number }>, after: Map<number, { type: string; cpu: number }>): Record<string, number> {
  const totals: Record<string, number> = { renderer: 0, gpuProcess: 0, browser: 0, total: 0 }
  for (const [id, { type, cpu }] of after) {
    const used = cpu - (before.get(id)?.cpu ?? 0)
    const key = type === 'GPU' ? 'gpuProcess' : type === 'renderer' || type === 'browser' ? type : null
    if (key) totals[key]! += used
    totals.total! += used
  }
  return totals
}

/** Waits until the app has not drawn a frame for half a second. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => performance.now() - (window as unknown as { __perf: { lastFrame: number } }).__perf.lastFrame > 500, null, { timeout: 30_000, polling: 100 })
}

async function measure(page: Page, cdp: CDPSession, name: string, metrics: Metrics): Promise<void> {
  await page.evaluate(() => { const perf = (window as unknown as { __perf: { recording: boolean; frames: Map<number, unknown> } }).__perf; perf.frames.clear(); perf.recording = true })
  const before = await processCpu(cdp)
  const start = Date.now()
  await page.waitForTimeout(seconds * 1000)
  const cpu = cpuDelta(before, await processCpu(cdp))
  const elapsed = Date.now() - start
  // Let the last timer queries resolve before reading them.
  const frames = await page.evaluate(async () => {
    const perf = (window as unknown as { __perf: { recording: boolean; frames: Map<number, { cpu: number; gpu: number; pending: number }>; collect(): void } }).__perf
    perf.recording = false
    for (let tries = 0; tries < 20 && [...perf.frames.values()].some((frame) => frame.pending > 0); tries++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      perf.collect()
    }
    return [...perf.frames.entries()].map(([time, frame]) => ({ time, ...frame }))
  })
  const intervals = frames.slice(1).map((frame, index) => frame.time - frames[index]!.time)
  const gpu = frames.filter((frame) => frame.pending === 0).map((frame) => frame.gpu)
  Object.assign(metrics, {
    [`${name}.fps`]: frames.length / (elapsed / 1000),
    [`${name}.frameIntervalP95Ms`]: percentile(intervals, 0.95),
    [`${name}.frameCpuMedianMs`]: median(frames.map((frame) => frame.cpu)),
    [`${name}.frameCpuP95Ms`]: percentile(frames.map((frame) => frame.cpu), 0.95),
    [`${name}.frameGpuMedianMs`]: median(gpu),
    [`${name}.frameGpuP95Ms`]: percentile(gpu, 0.95),
    [`${name}.gpuBusyPct`]: gpu.reduce((sum, value) => sum + value, 0) / elapsed * 100,
    [`${name}.cpuRendererPct`]: cpu.renderer! / elapsed * 100,
    [`${name}.cpuGpuProcessPct`]: cpu.gpuProcess! / elapsed * 100,
    [`${name}.cpuBrowserPct`]: cpu.browser! / elapsed * 100,
    [`${name}.cpuTotalPct`]: cpu.total! / elapsed * 100,
  })
}

async function run(browser: Browser, state: string, scale: number): Promise<Metrics> {
  const prefix = `${state}@${scale}x`
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale,
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'star-view-welcome-answered', value: 'true' }, ...Object.entries(STATES[state]!.storage).map(([name, value]) => ({ name, value }))] }] },
  })
  await context.addInitScript(instrument)
  const page = await context.newPage()
  const cdp = await browser.newBrowserCDPSession()
  const pageCdp = await context.newCDPSession(page)
  if (throttle) {
    await pageCdp.send('Network.enable')
    await pageCdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 20e6 / 8, uploadThroughput: 5e6 / 8 })
  }
  const metrics: Metrics = {}

  const before = await processCpu(cdp)
  await page.goto(baseURL)
  await page.locator('#scene[data-ready="true"]').waitFor({ state: 'attached', timeout: 60_000 })
  const loadCpu = cpuDelta(before, await processCpu(cdp))
  await page.waitForLoadState('networkidle')
  await settle(page)
  const load = await page.evaluate(() => {
    const perf = (window as unknown as { __perf: { marks: Record<string, number>; longTasks: [number, number][]; firstFrame: number | null; lastFrame: number } }).__perf
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const ready = perf.marks['data-ready=true']!
    const tasks = perf.longTasks.filter(([start]) => start < ready)
    return {
      ttfbMs: navigation.responseStart,
      fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      sceneReadyMs: ready,
      firstFrameMs: perf.firstFrame,
      milkyWayReadyMs: perf.marks['data-milky-way-ready=true'] ?? null,
      // The last frame before the app went idle: every startup catalog and layer is in.
      settledMs: perf.lastFrame,
      totalBlockingTimeMs: tasks.reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0),
      longestTaskMs: Math.max(0, ...tasks.map(([, duration]) => duration)),
      requests: resources.length + 1,
      transferKB: (navigation.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0)) / 1024,
      decodedKB: (navigation.decodedBodySize + resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0)) / 1024,
    }
  })
  for (const [key, value] of Object.entries(load)) metrics[`${prefix}.load.${key}`] = value
  for (const [key, value] of Object.entries(loadCpu)) metrics[`${prefix}.load.cpu${key[0]!.toUpperCase()}${key.slice(1)}Ms`] = value
  const { usedSize } = await pageCdp.send('Runtime.getHeapUsage')
  metrics[`${prefix}.memory.jsHeapMB`] = usedSize / 1024 / 1024

  // The app ignores a saved filter it does not accept, which would quietly measure the default state instead.
  if (STATES[state]!.storage['star-view-saved-filter'] && !await page.locator('#show-western-constellation-stars').isChecked()) throw new Error(`The ${state} saved filter was rejected; update STATES in scripts/perf.ts`)
  if (STATES[state]!.motionArrows) {
    // Motion arrows are not stored between visits; the switch sits in a closed panel.
    await page.locator('#motion-arrows-visible').evaluate((input: HTMLInputElement) => { input.checked = true; input.dispatchEvent(new Event('change')) })
    await settle(page)
  }
  await measure(page, cdp, `${prefix}.idle`, metrics)

  // The toggle sits in a hover flyout; a dispatched click avoids moving the pointer over the scene.
  await page.locator('#rotation-toggle:enabled').dispatchEvent('click')
  await page.locator('#rotation-left').click()
  await page.waitForTimeout(500)
  await measure(page, cdp, `${prefix}.rotate`, metrics)
  await page.locator('#rotation-left').click()
  await page.locator('#rotation-reset').click()
  await page.locator('#rotation-close').click()
  await settle(page)

  await page.locator('#discover-toggle').click()
  await page.locator('#motion-toggle').click()
  await page.locator('#time-play').click()
  await page.waitForTimeout(500)
  await measure(page, cdp, `${prefix}.motion`, metrics)
  await page.locator('#time-play').click()

  await context.close()
  return metrics
}

function git(...command: string[]): string {
  try { return execFileSync('git', command, { encoding: 'utf8' }).trim() } catch { return '' }
}

function format(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2)
}

function report(result: Result, previous: Result | null, previousName: string | null): void {
  const rows: string[][] = [['metric', 'median', 'spread', previous ? 'previous' : '', previous ? 'change' : '']]
  for (const [key, value] of Object.entries(result.median)) {
    if (rows.length > 1 && key.split('.')[0] !== rows.at(-1)![0]!.split('.')[0]) rows.push(['', '', '', '', ''])
    const values = result.runs.map((metrics) => metrics[key]).filter((entry): entry is number => typeof entry === 'number')
    const spreadPercent = value && values.length > 1 ? (Math.max(...values) - Math.min(...values)) / 2 / Math.abs(value) * 100 : 0
    const spread = spreadPercent ? `±${spreadPercent.toFixed(0)}%` : ''
    const old = previous?.median[key]
    let change = ''
    if (typeof old === 'number' && typeof value === 'number' && old !== 0) {
      const percent = (value - old) / Math.abs(old) * 100
      const worse = key.endsWith('.fps') ? percent < 0 : percent > 0
      change = `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%${Math.abs(percent) >= Math.max(10, 2 * spreadPercent) ? (worse ? '  ▲ worse' : '  ▼ better') : ''}`
    }
    rows.push([key, format(value), spread, previous ? format(old) : '', change])
  }
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => row[column]!.length)))
  for (const row of rows) console.log(row.map((cell, column) => column === 0 || column === 4 ? cell.padEnd(widths[column]!) : cell.padStart(widths[column]!)).join('  '))
  const settings = ['seconds', 'throttle', 'viewport', 'gpu'].filter((key) => previous && previous.meta[key] !== result.meta[key])
  if (settings.length) console.warn(`\nWarning: settings differ from the previous result (${settings.join(', ')}); the comparison is not like for like.`)
  if (previousName) console.log(`\nCompared with ${previousName} (${(previous!.meta.commit as string) || '?'}${previous!.meta.dirty ? ', uncommitted changes' : ''}).`)
  console.log('Spread is half the range across runs. Changes are flagged above 10% and twice the spread.')
}

/** Bundles every result for scripts/perf-report.html, which cannot list a folder when opened from disk. */
function writeReport(): string {
  mkdirSync(resultDir, { recursive: true })
  const results = readdirSync(resultDir).filter((name) => name.endsWith('.json')).sort().map((name) => ({ name, ...JSON.parse(readFileSync(join(resultDir, name), 'utf8')) }))
  writeFileSync(join(resultDir, 'results.js'), `window.PERF_RESULTS = ${JSON.stringify(results)}\n`)
  return 'scripts/perf-report.html'
}

if (args.includes('--report')) {
  const page = writeReport()
  if (process.platform === 'darwin') execFileSync('open', [page])
  else console.log(`Open ${page} in a browser.`)
  process.exit(0)
}

if (!args.includes('--no-build')) {
  console.log('Building…')
  try { execFileSync('npm', ['run', 'build'], { stdio: 'pipe' }) } catch (error) { console.error(String((error as { stdout?: Buffer }).stdout ?? ''), String((error as { stderr?: Buffer }).stderr ?? '')); process.exit(1) }
}

const server = spawn('node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
process.on('exit', () => server.kill())
for (let tries = 0; ; tries++) {
  try { if ((await fetch(baseURL)).ok) break } catch { if (tries > 100) throw new Error('Preview server did not start') }
  await new Promise((resolve) => setTimeout(resolve, 100))
}

const results: Metrics[] = []
let meta: Record<string, unknown> = {}
const launch = () => chromium.launch({ channel: 'chromium', headless: !args.includes('--headed'), args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'] })
for (let index = 0; index < runs; index++) {
  if (index === 0) {
    const browser = await launch()
    const page = await browser.newPage()
    const renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2')!; const info = gl.getExtension('WEBGL_debug_renderer_info'); return { gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) as string : 'unknown', timerQuery: !!gl.getExtension('EXT_disjoint_timer_query_webgl2') } })
    await page.close()
    meta = { date: new Date().toISOString(), commit: git('rev-parse', '--short', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), dirty: git('status', '--porcelain', '--', 'src', 'index.html', 'public').length > 0, label, version: JSON.parse(readFileSync('package.json', 'utf8')).version, browser: browser.version(), ...renderer, runs, states, scales, seconds, throttle, viewport: '1440x900' }
    console.log(`${renderer.gpu}${renderer.timerQuery ? '' : ' (no GPU timer queries: GPU frame times unavailable)'}`)
    if (/SwiftShader/i.test(renderer.gpu)) console.warn('Warning: software rendering; GPU numbers do not reflect hardware.')
    await browser.close()
  }
  process.stdout.write(`Run ${index + 1}/${runs}:`)
  const metrics: Metrics = {}
  for (const state of states) for (const scale of scales) {
    process.stdout.write(` ${state}@${scale}x`)
    // A new browser per state: cold HTTP, shader and GPU caches. New headless Chromium uses the hardware GPU.
    const browser = await launch()
    try { Object.assign(metrics, await run(browser, state, scale)) } finally { await browser.close() }
  }
  results.push(metrics)
  console.log('')
}
server.kill()

const keys = Object.keys(results[0]!)
const result: Result = { meta, runs: results, median: Object.fromEntries(keys.map((key) => [key, median(results.map((metrics) => metrics[key]).filter((value): value is number => typeof value === 'number'))])) }

mkdirSync(resultDir, { recursive: true })
const previousName = option('compare') ?? readdirSync(resultDir).filter((name) => name.endsWith('.json')).sort().at(-1)
const previousPath = previousName && (previousName.includes('/') ? previousName : join(resultDir, previousName))
const previous = previousPath ? JSON.parse(readFileSync(previousPath, 'utf8')) as Result : null
const fileName = `${(meta.date as string).replace(/[:.]/g, '-').slice(0, 19)}_${meta.commit}${meta.dirty ? '-dirty' : ''}${label ? `_${label.replace(/[^\w-]/g, '-')}` : ''}.json`
writeFileSync(join(resultDir, fileName), `${JSON.stringify(result, null, 2)}\n`)
console.log('')
report(result, previous, previousPath || null)
console.log(`Saved ${join(resultDir, fileName)}; see all results with npm run perf:report (${writeReport()}).`)
