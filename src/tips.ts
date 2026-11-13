import type { Step, TutorialHost } from './tutorial'

export type TipLevel = 'novice' | 'intermediate' | 'pro'

export interface Tip {
  id: string
  /** The feature the tip introduces; once the visitor has used it, the tip is no longer needed. */
  feature: string
  level: TipLevel
  /** The tip fits only while this holds, such as while an object is selected. */
  when?(): boolean
  /** An object Show me selects before it points. */
  select?: string
  /**
   * What the tip says. `{selected}` or `{object-id}` shows that object's swatch and name,
   * `[Feature]` names a control in bold orange and `*term*` an astronomy term in bold blue.
   */
  text: string | (() => string)
  /** Show me points at the feature and explains it one step further. */
  step?: Step
}

/**
 * A feature counts as seen once the visitor uses one of its controls; one without a selector is noted by the app.
 * Features with a card go in depth: a pro has used at least two of them in most cards.
 */
interface Feature {
  id: string
  selector?: string
  card?: string
  /** Tells choices within one control apart, such as which paint setting, so each counts on its own. */
  key?(control: Element): string | null | undefined
  /** Counts only while the Sun is selected, or only while another object is. */
  sun?: boolean
  /** Features the visitor evidently knows once they use this one; a card's own feature is implied by its in-depth ones. */
  implies?: readonly string[]
}

const open = (id: string, selector?: string, extra?: Pick<Feature, 'sun' | 'implies'>): Feature => ({ id, selector, ...extra })
const deep = (card: string, id: string, selector?: string, extra?: Pick<Feature, 'key' | 'sun' | 'implies'>): Feature => ({ id, selector, card, ...extra })
/** Opening any Explore tool shows the visitor knows where Explore is. */
const exploreTool = { implies: ['explore'] }
const byLabel = { key: (control: Element) => control.textContent }

export const TIP_FEATURES: readonly Feature[] = [
  open('select'),
  open('object-menu'),
  open('object-specs', '#object-specs-toggle, #object-card-toggle'),
  open('object-info', '#object-info-toggle'),
  deep('object', 'value-card', '#object-specs .object-type-toggle', { key: (control) => control.id }),
  deep('object', 'glossary-term', '[data-glossary-term]', { implies: ['glossary'] }),
  deep('object', 'compare', '#object-compare-toggle, #scene-context-compare'),
  deep('object', 'links', '.object-link'),
  open('solar-system', '#object-system-toggle, #known-planets', { sun: true }),
  deep('solar-system', 'solar-planet', '.planet-row button', { sun: true, key: (control) => control.closest<HTMLElement>('[data-planet-id]')?.dataset.planetId }),
  deep('solar-system', 'solar-planet-details', '.planet-section-button, #planet-stats-toggle, #planet-add-earth', { sun: true }),
  open('star-systems', '#object-system-toggle, #known-planets', { sun: false }),
  open('star-systems', '#star-components button'),
  deep('star-systems', 'star-component', '#star-components button'),
  deep('star-systems', 'exoplanet', '.planet-row button', { sun: false, key: (control) => control.closest<HTMLElement>('[data-planet-id]')?.dataset.planetId }),
  deep('star-systems', 'exoplanet-details', '.planet-section-button, #planet-stats-toggle, #planet-add-earth', { sun: false }),
  open('camera-views', '#top-view, #side-view, #front-view'),
  open('rotation', '#rotation-toggle, #rotation-active'),
  deep('rotation', 'rotation-active'),
  deep('rotation', 'rotation-speed', '#rotation-faster, #rotation-slower'),
  deep('rotation', 'rotation-reset', '#rotation-reset'),
  open('hide-ui', '#hide-ui'),
  open('grid', '#toggle-grid'),
  open('sky-grid', '#toggle-equatorial-grid, #toggle-galactic-grid'),
  open('saved-views', '#views-toggle'),
  deep('saved-views', 'save-view', '#save-view-form'),
  deep('saved-views', 'load-view', '#saved-views-list tr, #saved-view-context-load'),
  open('copy-link', '#copy-view-link, #saved-view-context-copy'),
  open('selection-history', '#selection-back, #selection-forward'),
  open('set-origin', '#set-origin, #set-sun-origin, #go-to-origin, #scene-context-origin'),
  open('observer', '#observer-view, #observer-view-origin, #observer-active'),
  deep('observer', 'observer-telescope', '#observer-telescope'),
  deep('observer', 'observer-roll', '#observer-roll-counterclockwise, #observer-roll-reset, #observer-roll-clockwise'),
  deep('observer', 'observer-latitude', '#observer-latitude, #observer-axial-tilt'),
  deep('observer', 'observer-planets', '#observer-planets'),
  deep('observer', 'observer-cone', '#observer-cone, #observer-cone-time'),
  deep('observer', 'observer-naked-eye', '#observer-naked-eye'),
  open('filter', '#filter-toggle'),
  deep('filter', 'catalog', '#catalog-range'),
  deep('filter', 'western-constellation-stars', '#show-western-constellation-stars'),
  deep('filter', 'naked-eye-stars', '#show-naked-eye-stars'),
  deep('filter', 'notable-distant-stars', '#show-notable-distant-stars'),
  deep('filter', 'object-categories', '#object-categories'),
  deep('filter', 'object-types', '#object-type-options'),
  deep('filter', 'distance-limit', '#object-distance-limit'),
  deep('filter', 'magnitude-limit', '#magnitude-limit, #hide-fainter-objects'),
  deep('filter', 'save-filter', '#filter-save'),
  open('objects', '#objects-toggle'),
  deep('objects', 'object-search', '#object-search'),
  deep('objects', 'objects-table', '#objects-expand'),
  deep('objects', 'objects-column-filter', '.object-column-filter-button'),
  open('glossary', '#glossary-toggle'),
  deep('glossary', 'glossary-search', '#glossary-search'),
  deep('glossary', 'glossary-article', '#glossary-terms .glossary-term', byLabel),
  deep('glossary', 'glossary-widget', '#glossary-panel .glossary-widget-choices button'),
  open('preferences', '#preferences-toggle'),
  deep('preferences', 'distance-units', '#distance-units'),
  deep('preferences', 'star-colors', '#star-colors, #color-blind-palette'),
  deep('preferences', 'star-style', '#star-style, #star-brightness, #faint-stars'),
  deep('preferences', 'label-limit', '#label-limit'),
  deep('preferences', 'power-saving', '#power-saving-mode'),
  deep('preferences', 'earth-orbit', '#earth-orbit-mode'),
  deep('preferences', 'visibility-cone', '#visibility-cone-mode'),
  deep('preferences', 'milky-way', '#milky-way-visible, #oort-cloud-visible'),
  deep('preferences', 'motion-arrows', '#motion-arrows-visible, #motion-years, #motion-frame'),
  deep('preferences', 'browser-data', '#export-browser-data, #import-browser-data'),
  open('info', '#info-toggle'),
  open('tutorial', '#tutorial-toggle, #welcome-yes'),
  // Taking the tour shows these features with a step of their own.
  open('tour', '#welcome-yes', { implies: ['tutorial', 'set-origin', 'object-menu', 'rotation', 'sky-grid', 'saved-views', 'filter', 'observer', 'explore', 'objects', 'objects-table', 'glossary'] }),
  open('explore', '#discover-toggle, #discover-options button'),
  open('top-lists', '#top-lists-toggle', exploreTool),
  deep('top-lists', 'top-list', '#top-lists-terms .glossary-term', byLabel),
  deep('top-lists', 'top-list-entry', '#top-lists-panel tbody button'),
  open('constellations', '#constellations-toggle', exploreTool),
  deep('constellations', 'constellation', '#constellations-terms .glossary-term', byLabel),
  deep('constellations', 'constellation-search', '#constellations-search'),
  deep('constellations', 'constellation-info', '#discover-constellation-info-toggle, #constellation-info-toggle'),
  deep('constellations', 'constellation-chart', '#discover-constellation-grid, #discover-constellation-magnify, #constellation-grid, #constellation-magnify'),
  open('neighborhood', '#neighborhood-toggle, #neighborhood-active', exploreTool),
  deep('neighborhood', 'neighborhood-radius', '#neighborhood-radius'),
  deep('neighborhood', 'neighborhood-catalog', '#neighborhood-catalog'),
  deep('neighborhood', 'neighborhood-birth', '#neighborhood-birth-toggle, #neighborhood-birth-year'),
  deep('neighborhood', 'neighborhood-recenter', '#neighborhood-recenter'),
  open('motion', '#motion-toggle, #motion-active', exploreTool),
  deep('motion', 'time-play', '#time-play'),
  deep('motion', 'time-slider', '#time-slider'),
  deep('motion', 'time-follow', '#time-follow'),
  deep('motion', 'time-speed', '#time-slower, #time-faster'),
  open('paint', '#paint-toggle, #paint-active', exploreTool),
  deep('paint', 'paint-setting', '.paint-setting-toggle', { key: (control) => control.closest<HTMLElement>('[data-paint-setting]')?.dataset.paintSetting }),
  deep('paint', 'paint-channel', '[data-paint-channel]'),
  deep('paint', 'paint-scale', '[data-paint-scale]'),
  deep('paint', 'paint-control', '[data-paint-control]'),
  deep('paint', 'paint-keep-size', '#paint-keep-size'),
  open('graphs', '#graphs-toggle, #graph-filter-active', exploreTool),
  deep('graphs', 'graph', '#graphs-terms .glossary-term', byLabel),
  deep('graphs', 'graph-filter-active'),
  deep('graphs', 'graphs-width', '#graphs-width'),
  open('spaceship', '#spaceship-toggle, #spaceship-active', exploreTool),
  deep('spaceship', 'spaceship-active'),
  deep('spaceship', 'spaceship-speed', '#spaceship-speed-level'),
  deep('spaceship', 'spaceship-labels', '#spaceship-labels'),
  deep('spaceship', 'spaceship-view', '[id^="spaceship-visibility"], [id^="spaceship-brightness"]'),
  deep('spaceship', 'spaceship-help', '#spaceship-help'),
]

const KNOWN_FEATURES = new Set(TIP_FEATURES.map(({ id }) => id))
/** Most features opened makes an intermediate; using at least two in-depth features in almost every card makes a pro. */
const INTERMEDIATE_SHARE = 2 / 3
const PRO_SHARE = 0.8
const PRO_DEPTH = 2
/** Levels are worked out but not applied yet, so every visitor gets the novice tips first. */
const APPLY_LEVEL = false

const DEPTH_CARDS = new Set(TIP_FEATURES.flatMap(({ card }) => card ? [card] : []))

/** The cards explored in depth; a keyed use such as `paint-setting:mass` counts once per choice. */
export function exploredCards(seen: ReadonlySet<string>): Set<string> {
  const uses = new Map<string, number>()
  for (const use of seen) {
    const card = TIP_FEATURES.find(({ id, card }) => card && (use === id || use.startsWith(`${id}:`)))?.card
    if (card) uses.set(card, (uses.get(card) ?? 0) + 1)
  }
  return new Set([...uses].flatMap(([card, count]) => count >= PRO_DEPTH ? [card] : []))
}

/** The visitor's level from the features they have used. */
export function tipLevel(seen: ReadonlySet<string>): TipLevel {
  const opened = new Set(TIP_FEATURES.filter(({ card }) => !card).map(({ id }) => id))
  if ([...opened].filter((id) => seen.has(id)).length < opened.size * INTERMEDIATE_SHARE) return 'novice'
  return exploredCards(seen).size >= DEPTH_CARDS.size * PRO_SHARE ? 'pro' : 'intermediate'
}

/** The first tip after 90 seconds of use, later ones every 3 to 5 minutes, counting only time the page is visible. */
const FIRST_TIP_MS = 90_000
const TIP_INTERVAL_MS = [180_000, 300_000] as const
/** A tip waits until the visitor has paused this long, so it never interrupts. */
const QUIET_MS = 10_000
/** How long a tip waits while a tour, the welcome, a loading scene or an open card leaves no room for it. */
const BLOCKED_RETRY_MS = 30_000
/** An unanswered tip leaves after this long and may come back later. */
const UNANSWERED_MS = 45_000

const seen = new Set<string>()
let seenChanged = false
/** Show me selecting an object is not the visitor's own use. */
let demonstrating = false

const FEATURES_BY_ID = new Map(TIP_FEATURES.map((feature) => [feature.id, feature]))

/** Adds a use and the features it implies. */
function remember(use: string): void {
  if (seen.has(use)) return
  seen.add(use)
  seenChanged = true
  const feature = FEATURES_BY_ID.get(use.split(':')[0]!)
  for (const implied of [feature?.card, ...feature?.implies ?? []]) if (implied && KNOWN_FEATURES.has(implied)) remember(implied)
}

/** Whether the visitor has used a feature, with any of its choices. */
const used = (feature: string) => seen.has(feature) || [...seen].some((use) => use.startsWith(`${feature}:`))

/** Settings the app stored only when the visitor changed them, so they show use from before tips noted anything. */
const PAST_USE: Readonly<Record<string, string>> = {
  'saved-views': 'save-view', 'saved-filter': 'save-filter', 'ui-hidden': 'hide-ui',
  'objects-expanded': 'objects-table', 'objects-height': 'objects-table', 'glossary-sidebar-collapsed': 'glossary',
  'graph-sections-collapsed': 'graphs', 'graphs-sidebar-collapsed': 'graphs', 'graphs-compact': 'graphs-width',
  'constellations-maximized': 'constellations', 'constellations-sidebar-collapsed': 'constellations', 'constellation-latitude': 'constellations',
  'top-lists-sidebar-collapsed': 'top-lists', 'magnitude-city': 'value-card:magnitude-toggle',
  'distance-unit': 'distance-units', 'color-mode': 'star-colors', 'color-blind-palette': 'star-colors',
  'star-style': 'star-style', 'star-brightness': 'star-style', 'faint-stars': 'star-style', 'label-limit': 'label-limit', 'render-stats': 'preferences',
  'observer-latitude': 'observer-latitude', 'observer-axial-tilt': 'observer-latitude', 'observer-cone': 'observer-cone', 'observer-cone-mode': 'observer-cone', 'observer-planets': 'observer-planets',
}

/** Records the visitor's own use of a feature; the tour's and Show me's own clicks do not count. */
export function noteTipFeature(use: string): void {
  if (seen.has(use) || demonstrating || !KNOWN_FEATURES.has(use.split(':')[0]!) || document.querySelector('.tutorial-tile')) return
  remember(use)
}

export interface TipsHost {
  tutorial: TutorialHost
  store(key: string, value: string): void
  stored(key: string): string | null
  selectedId(): string | null
  select(id: string): void
  /** An object's name and display color, as its swatch shows it elsewhere. */
  describe(id: string | null): { name: string; color: string } | null
}

/**
 * Notes which features the visitor uses and, after a quiet minute or two, suggests one they have not, picked at random.
 * One timeout runs at a time; it stops while the page is hidden, so it adds no work to the scene.
 */
export function initializeTips(host: TipsHost, signal: AbortSignal): void {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
  const storedList = (key: string): string[] => {
    try {
      const value: unknown = JSON.parse(host.stored(key) ?? '[]')
      return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
    } catch { return [] }
  }
  for (const use of storedList('tips-features')) remember(use)
  for (const [key, use] of Object.entries(PAST_USE)) if (host.stored(key) !== null) remember(use)
  const shown = new Set(storedList('tips-shown'))
  const saveSeen = () => {
    if (!seenChanged) return
    seenChanged = false
    host.store('tips-features', JSON.stringify([...seen]))
  }

  const noteControl = (event: Event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return
    for (const feature of TIP_FEATURES) {
      const control = feature.selector ? event.target.closest(feature.selector) : null
      if (!control || (feature.sun !== undefined && (host.selectedId() === 'sun') !== feature.sun)) continue
      const key = feature.key?.(control)?.trim()
      noteTipFeature(key ? `${feature.id}:${key}` : feature.id)
    }
  }
  for (const type of ['click', 'change', 'submit']) document.addEventListener(type, noteControl, { capture: true, passive: true, signal })
  let lastInput = -Infinity
  const noteInput = () => { lastInput = performance.now() }
  for (const type of ['pointerdown', 'keydown', 'wheel']) addEventListener(type, noteInput, { capture: true, passive: true, signal })

  const tile = element('tip-tile')
  const text = element('tip-text')
  const showMe = element<HTMLButtonElement>('tip-show')
  const toggle = element<HTMLButtonElement>('tips-toggle')
  let enabled = host.stored('tips') !== 'off'
  let tips: readonly Tip[] | undefined
  let current: Tip | undefined
  let timer = 0
  let remaining = 0
  let startedAt = 0
  let leaveTimer = 0

  const level = (): TipLevel => APPLY_LEVEL ? tipLevel(seen) : 'novice'
  const interval = () => TIP_INTERVAL_MS[0] + Math.random() * (TIP_INTERVAL_MS[1] - TIP_INTERVAL_MS[0])

  const uiHidden = () => document.documentElement.hasAttribute('data-ui-hidden')

  /** Counts only time the page is visible with its controls shown. */
  function schedule(ms: number): void {
    clearTimeout(timer)
    timer = 0
    remaining = ms
    resume()
  }
  function resume(): void {
    if (!enabled || timer || current || document.hidden || uiHidden()) return
    startedAt = performance.now()
    timer = window.setTimeout(fire, remaining)
  }
  function pause(): void {
    if (!timer) return
    clearTimeout(timer)
    timer = 0
    remaining = Math.max(0, remaining - (performance.now() - startedAt))
  }

  const blocked = () => !!document.querySelector('.tutorial-tile') || !element('welcome-tile').hidden || element('scene-status').hidden === false

  function fire(): void {
    timer = 0
    const quiet = QUIET_MS - (performance.now() - lastInput)
    if (quiet > 0) schedule(quiet)
    else if (blocked()) schedule(BLOCKED_RETRY_MS)
    else void present()
  }

  /** The tip waits rather than cover a card the visitor has open. */
  function coversCard(): boolean {
    const bounds = tile.getBoundingClientRect()
    return [...document.querySelectorAll<HTMLElement>('#selected-object-card, #inspector .dock-card')].some((card) => {
      if (!card.checkVisibility()) return false
      const other = card.getBoundingClientRect()
      return other.left < bounds.right && other.right > bounds.left && other.top < bounds.bottom && other.bottom > bounds.top
    })
  }

  /** Text with its objects, features and terms marked up, as `Tip.text` describes; null when an object is missing. */
  function markUp(source: string): Node[] | null {
    const nodes: Node[] = []
    let end = 0
    for (const match of source.matchAll(/\{([\w-]+)\}|\[([^\]]+)\]|\*([^*]+)\*/g)) {
      if (match.index > end) nodes.push(document.createTextNode(source.slice(end, match.index)))
      end = match.index + match[0].length
      const [, objectId, feature, term] = match
      if (!objectId) {
        nodes.push(Object.assign(document.createElement('strong'), { className: feature ? 'tip-feature' : 'tip-term', textContent: feature ?? term }))
        continue
      }
      const object = host.describe(objectId === 'selected' ? host.selectedId() : objectId)
      if (!object) return null
      const swatch = Object.assign(document.createElement('span'), { className: 'star-swatch' })
      swatch.style.background = object.color
      const chip = Object.assign(document.createElement('span'), { className: 'tip-object' })
      chip.append(swatch, Object.assign(document.createElement('strong'), { textContent: object.name }))
      nodes.push(chip)
    }
    if (end < source.length) nodes.push(document.createTextNode(source.slice(end)))
    return nodes
  }

  async function present(): Promise<void> {
    tips ??= await import('./tip-list').then((module) => module.TIPS, () => undefined)
    if (!enabled || current) return
    const left = tips?.filter((candidate) => candidate.level === level() && !shown.has(candidate.id) && !used(candidate.feature))
    // With every tip shown or its feature used, the timer stops for good; a list that failed to load is tried again later.
    if (left?.length === 0) return
    const fitting = (left ?? []).flatMap((candidate) => {
      if (!(candidate.when?.() ?? true)) return []
      const nodes = markUp(typeof candidate.text === 'function' ? candidate.text() : candidate.text)
      return nodes ? [{ tip: candidate, nodes }] : []
    })
    const choice = fitting[Math.floor(Math.random() * fitting.length)]
    // Tips left for another moment, such as one about the selected star, wait for the next interval.
    if (!choice) {
      schedule(interval())
      return
    }
    const { tip, nodes } = choice
    text.replaceChildren(...nodes)
    showMe.hidden = !(tip.step?.target || tip.step?.panel || tip.step?.flyout)
    tile.hidden = false
    if (coversCard()) {
      tile.hidden = true
      schedule(BLOCKED_RETRY_MS)
      return
    }
    current = tip
    leaveTimer = window.setTimeout(leave, UNANSWERED_MS)
  }

  function hide(): void {
    clearTimeout(leaveTimer)
    tile.hidden = true
    current = undefined
  }
  /** An unanswered tip leaves unless the visitor is reading it, and may come back later. */
  function leave(): void {
    if (tile.matches(':hover, :focus-within')) {
      leaveTimer = window.setTimeout(leave, QUIET_MS)
      return
    }
    hide()
    schedule(interval())
  }
  function answer(): Tip | undefined {
    const tip = current
    if (!tip) return
    shown.add(tip.id)
    host.store('tips-shown', JSON.stringify([...shown]))
    hide()
    schedule(interval())
    return tip
  }

  function setEnabled(on: boolean): void {
    enabled = on
    host.store('tips', on ? 'on' : 'off')
    renderToggle()
    if (on) void present()
    else {
      hide()
      clearTimeout(timer)
      timer = 0
    }
  }
  function renderToggle(): void {
    toggle.setAttribute('aria-pressed', String(enabled))
    toggle.querySelector('.tooltip')!.textContent = enabled ? 'Turn tips off' : 'Turn tips on'
  }

  element('tip-close').addEventListener('click', answer, { signal })
  element('tips-off').addEventListener('click', () => setEnabled(false), { signal })
  toggle.addEventListener('click', () => setEnabled(!enabled), { signal })
  showMe.addEventListener('click', () => {
    const tip = answer()
    const step = tip?.step
    if (!step) return
    void import('./tutorial').then(({ runTutorial }) => {
      if (signal.aborted) return
      demonstrating = true
      if (tip.select) host.select(tip.select)
      demonstrating = false
      runTutorial(host.tutorial, signal, step, (text) => markUp(text) ?? [text])
    }, () => {})
  }, { signal })
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resume()
    else {
      pause()
      saveSeen()
    }
  }, { signal })
  addEventListener('pagehide', saveSeen, { signal })
  // Hide UI pauses the timer like a hidden page does, and showing the controls again resumes it.
  const hideUiObserver = new MutationObserver(() => uiHidden() ? pause() : resume())
  hideUiObserver.observe(document.documentElement, { attributeFilter: ['data-ui-hidden'] })
  signal.addEventListener('abort', () => {
    hideUiObserver.disconnect()
    clearTimeout(timer)
    clearTimeout(leaveTimer)
  }, { once: true })

  renderToggle()
  schedule(FIRST_TIP_MS)
}
