// Rendering sweep: loads the app across pairwise combinations of display settings, filter, wavelength band and
// camera distance, and checks invariants that must hold in every combination, rather than comparing against
// reference images that every intended visual change would break:
// - no WebGL errors and no uncaught page errors;
// - molecular-cloud dust darkens only what lies behind it, never the whole sky;
// - switching to another wavelength band and back restores the visible-light sky;
// - a scene shader restyles the sky but never blanks it.
// Pairwise: every pair of setting values occurs in at least one case, which catches most interaction bugs
// in a few dozen page loads instead of every combination.
// Usage: npm run render:sweep -- [--url http://localhost:5173] [--browsers webkit,chromium] [--limit 4]
//   [--case shader=exposure,camera=far]   runs one case; settings it leaves out take their first value
// Needs a running app (npm run dev, or npm run preview with --url). Failures are saved to render-sweep-results/.
import { chromium, webkit, type Browser, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { DEFAULT_FILTER_CATEGORIES, DEFAULT_FILTER_SUBTYPES } from '../src/object-filter.ts'

const args = process.argv.slice(2)
const option = (name: string): string | undefined => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1] }
const url = (option('url') ?? 'http://localhost:5173').replace(/\/$/, '')
const browserNames = (option('browsers') ?? 'webkit,chromium').split(',')
const limit = Number(option('limit') ?? Infinity)
const resultDir = 'render-sweep-results'

const DIMENSIONS: Record<string, readonly string[]> = {
  'star-view-star-style': ['exaggerated', 'realistic'],
  'star-view-color-mode': ['exaggerated', 'real'],
  'star-view-shader': ['none', 'concept', 'exposure', 'atlas'],
  'star-view-star-brightness': ['normal', 'high'],
  'star-view-faint-stars': ['normal', 'lifted'],
  catalog: ['nearest-100', 'nearest-5000'],
  band: ['visible', 'ultraviolet', 'radio'],
  camera: ['near', 'far'],
}
type Case = Record<string, string>
const shortName = (key: string) => key.replace(/^star-view-/, '')
const describe = (entry: Case) => Object.keys(DIMENSIONS).map((key) => `${shortName(key)}=${entry[key]}`).join(' ')

/** One case from `shader=exposure,camera=far`; settings it leaves out take their first value. */
function parseCase(text: string): Case {
  const given = new Map(text.split(',').map((part) => part.split('=') as [string, string]))
  return Object.fromEntries(Object.entries(DIMENSIONS).map(([key, values]) => {
    const value = given.get(shortName(key)) ?? values[0]!
    if (!values.includes(value)) throw new Error(`${shortName(key)} must be one of ${values.join(', ')}`)
    return [key, value]
  }))
}

/** Greedy pairwise cover: each case starts from an uncovered pair and fills the rest to cover as many more as possible. */
function pairwiseCases(dimensions: Record<string, readonly string[]>): Case[] {
  const keys = Object.keys(dimensions)
  const pair = (a: string, va: string, b: string, vb: string) => keys.indexOf(a) < keys.indexOf(b) ? `${a}=${va}|${b}=${vb}` : `${b}=${vb}|${a}=${va}`
  const uncovered = new Set<string>()
  keys.forEach((a, index) => keys.slice(index + 1).forEach((b) => dimensions[a]!.forEach((va) => dimensions[b]!.forEach((vb) => uncovered.add(pair(a, va, b, vb))))))
  const cases: Case[] = []
  while (uncovered.size > 0) {
    const [first] = uncovered
    const entry: Case = Object.fromEntries(first!.split('|').map((part) => part.split('=') as [string, string]))
    for (const key of keys) {
      if (key in entry) continue
      const covered = (value: string) => Object.entries(entry).filter(([other, otherValue]) => uncovered.has(pair(key, value, other, otherValue))).length
      entry[key] = dimensions[key]!.reduce((best, value) => covered(value) > covered(best) ? value : best)
    }
    Object.entries(entry).forEach(([a, va], index, all) => all.slice(index + 1).forEach(([b, vb]) => uncovered.delete(pair(a, va, b, vb))))
    cases.push(entry)
  }
  return cases
}

/** Stored state for a case: the default object types plus interstellar matter out to the last distance step, so molecular clouds are drawn. */
function storage(entry: Case, overrides: { dust?: boolean; shader?: string } = {}): Record<string, string> {
  const filterSubtypes = overrides.dust === false ? DEFAULT_FILTER_SUBTYPES.filter((key) => key !== 'molecular_cloud') : DEFAULT_FILTER_SUBTYPES
  const filter = {
    version: 1, catalogId: entry.catalog, showAlwaysBright: false, showWesternConstellationStars: true, showNakedEyeStars: true,
    showNotableDistantStars: true, filterCategories: [...DEFAULT_FILTER_CATEGORIES, 'interstellar_medium'], filterSubtypes,
    magnitudeLimit: 30, hideFainterObjects: false, objectDistanceLimitLy: 20000,
  }
  const preferences = Object.fromEntries(Object.entries(entry).filter(([key]) => key.startsWith('star-view-')))
  return {
    'star-view-welcome-answered': 'true', 'star-view-tips': 'off', 'star-view-ui-hidden': 'true',
    ...preferences, ...(overrides.shader ? { 'star-view-shader': overrides.shader } : {}), 'star-view-saved-filter': JSON.stringify(filter),
  }
}

/** Median luminance of the frame: the sky background, which sparse stars and labels barely move. */
function skyMedian(png: Buffer): number {
  const { data, width, height } = PNG.sync.read(png)
  const histogram = new Uint32Array(256)
  for (let index = 0; index < data.length; index += 4) histogram[Math.round(0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!)]!++
  let seen = 0
  for (let value = 0; value < 256; value++) if ((seen += histogram[value]!) * 2 >= width * height) return value
  return 255
}

// WebKit and Chromium both report WebGL errors to the console; performance notes are not errors.
const WEBGL_ERROR = /WebGL: (INVALID|OUT_OF|CONTEXT)|GL_INVALID|GL_OUT_OF_MEMORY|CONTEXT_LOST/

type Load = { page: Page; errors: string[]; close(): Promise<void> }
async function load(browser: Browser, state: Record<string, string>, camera: string): Promise<Load> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })
  await context.addInitScript((entries) => { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value) }, state)
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
  page.on('console', (message) => { if (WEBGL_ERROR.test(message.text())) errors.push(message.text()) })
  try {
    await page.goto(`${url}/objects/sun`)
    await page.waitForFunction(() => {
      const data = document.querySelector<HTMLElement>('[data-milky-way-visible]')?.dataset
      return data?.ready === 'true' && data.milkyWayReady === 'true'
    }, undefined, { timeout: 60_000 })
  } catch (error) {
    await context.close()
    throw error
  }
  // The start distance follows the filter's objects, so both cameras first zoom in to the orbit limit; far then zooms
  // out past the Galaxy transition, which loads the galaxy models mid-session as a visitor's zoom does.
  await page.mouse.move(640, 360)
  for (const direction of camera === 'far' ? [-1, 1] : [-1]) {
    for (let step = 0; step < 30; step++) { await page.mouse.wheel(0, 600 * direction); await page.waitForTimeout(40) }
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1500)
  return { page, errors, close: () => context.close() }
}

async function setBand(page: Page, band: string): Promise<void> {
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`.wavelength-band[data-band="${id}"]`)!.click(), band)
  await page.waitForTimeout(1500)
}

async function sweep(browserName: string, cases: Case[]): Promise<string[]> {
  // The full Chromium build in new headless mode renders on the GPU; the default headless shell falls back to software GL.
  const browser = await (browserName === 'webkit' ? webkit.launch() : chromium.launch({ channel: 'chromium' }))
  const failures: string[] = []
  try {
    for (const [index, entry] of cases.entries()) {
      const label = `${browserName} #${index + 1}`
      const reproduce = `reproduce: npm run render:sweep -- --browsers ${browserName} --case ${describe(entry).replaceAll(' ', ',')}`
      const fail = async (page: Page, check: string, detail: string) => {
        const file = `${resultDir}/${browserName}-${index + 1}-${check}.png`
        await page.screenshot({ path: file })
        failures.push(`${label} ${check}: ${detail}\n    ${reproduce}\n    screenshot ${file}`)
      }
      const runs: Load[] = []
      const open = async (state: Record<string, string>) => { const run = await load(browser, state, entry.camera!); runs.push(run); return run }
      let summary = ''
      try {
        summary = await checkCase(entry, open, fail)
        for (const run of runs) if (run.errors.length) await fail(run.page, 'errors', [...new Set(run.errors)].join(' | '))
      } catch (error) {
        // A load that never becomes ready is a finding too; the sweep goes on with the next case.
        failures.push(`${label} crashed: ${(error as Error).message.split('\n')[0]}\n    ${reproduce}`)
      } finally {
        await Promise.all(runs.map((run) => run.close()))
      }
      console.log(`${label} ${failures.some((failure) => failure.startsWith(`${label} `)) ? 'FAIL' : 'ok  '} ${describe(entry)}  ${summary}`)
    }
  } finally {
    await browser.close()
  }
  return failures
}

type Fail = (page: Page, check: string, detail: string) => Promise<void>
async function checkCase(entry: Case, open: (state: Record<string, string>) => Promise<Load>, fail: Fail): Promise<string> {
  // With dust: the visible sky, the case's band, then visible light again.
  const dusty = await open(storage(entry))
  const visible = skyMedian(await dusty.page.screenshot())
  await setBand(dusty.page, entry.band!)
  const band = skyMedian(await dusty.page.screenshot())
  if (entry.band !== 'visible') {
    await setBand(dusty.page, 'visible')
    const back = skyMedian(await dusty.page.screenshot())
    if (Math.abs(back - visible) > Math.max(2, visible * 0.1)) await fail(dusty.page, 'band-round-trip', `visible sky ${visible} became ${back} after ${entry.band} and back`)
    await setBand(dusty.page, entry.band!)
  }
  // Without dust, the same camera must not see a much brighter sky.
  const clear = await open(storage(entry, { dust: false }))
  const clearVisible = skyMedian(await clear.page.screenshot())
  await setBand(clear.page, entry.band!)
  const clearBand = skyMedian(await clear.page.screenshot())
  if (visible < clearVisible * 0.75 - 1) await fail(dusty.page, 'dust-darkens-sky', `visible sky ${visible} with dust, ${clearVisible} without`)
  if (entry.band !== 'visible' && band < clearBand * 0.75 - 1) await fail(dusty.page, 'dust-darkens-band', `${entry.band} sky ${band} with dust, ${clearBand} without`)
  // A scene shader restyles the sky; with the sky gone it would be close to black.
  if (entry['star-view-shader'] !== 'none') {
    const plain = await open(storage(entry, { shader: 'none' }))
    const unshaded = skyMedian(await plain.page.screenshot())
    if (visible < unshaded * 0.5 - 1) await fail(dusty.page, 'shader-blanks-sky', `visible sky ${visible} with ${entry['star-view-shader']}, ${unshaded} without a shader`)
  }
  return `sky ${visible}, without dust ${clearVisible}`
}

try { await fetch(url) } catch { console.error(`No app at ${url}. Start it with npm run dev, or pass --url.`); process.exit(1) }
mkdirSync(resultDir, { recursive: true })
const single = option('case')
const cases = single ? [parseCase(single)] : pairwiseCases(DIMENSIONS).slice(0, limit)
console.log(`${cases.length} cases × ${browserNames.join(', ')} against ${url}`)
const failures = (await Promise.all(browserNames.map((name) => sweep(name, cases)))).flat()
writeFileSync(`${resultDir}/failures.txt`, failures.join('\n'))
console.log(failures.length ? `\n${failures.length} failures:\n${failures.join('\n')}` : '\nAll invariants hold.')
process.exit(failures.length ? 1 : 0)
