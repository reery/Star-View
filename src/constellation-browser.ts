import type { DistanceUnit, StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { appendConstellationContent } from './constellation-card-content'
import { disposeConstellationCard, renderConstellationCard } from './constellation-card'
import { loadConstellationByName, type ConstellationChart } from './constellations'
import { constellationCharts } from './data/constellations'
import { clearLoadRecovery, loadWithRecovery } from './load-recovery'

interface BrowserOptions {
  objects: readonly Star[]
  colorMode: StarColorMode
  distanceUnit: DistanceUnit
  onSelect(object: Star): void
}

export function initializeConstellationBrowser(signal: AbortSignal, options: () => BrowserOptions, initialName?: string) {
  const panel = document.getElementById('constellations-panel')!
  const search = document.getElementById('constellations-search') as HTMLInputElement
  const terms = document.getElementById('constellations-terms')!
  const detail = document.getElementById('constellations-detail')!
  const empty = document.getElementById('constellations-empty')!
  const names = [...constellationCharts.keys()].sort((a, b) => a.localeCompare(b))
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  let selected = names.includes(initialName ?? '') ? initialName! : names[0]!
  let chart: ConstellationChart | null = null
  let request = 0
  let magnified = false
  let equatorialGrid = false
  appendConstellationContent(detail, 'discover-')
  // These measurements describe the constellation's chart center in the browser.
  detail.querySelector('.constellation-sources p:last-of-type')!.textContent = 'Visibility uses the constellation center, a level horizon, and astronomical darkness at 10 pm local solar time on each month’s 15th. Black land marks latitudes where the center rises. Weather, terrain, and brightness limits are not modeled.'

  const refresh = () => {
    if (!panel.hidden && !detail.hidden && chart?.name === selected) {
      renderConstellationCard(detail, null, chart, { ...options(), magnified, equatorialGrid })
    }
  }
  const show = async (name: string) => {
    selected = name
    for (const button of terms.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-current', String(button.dataset.constellation === name))
    }
    const current = ++request
    if (chart?.name === name) { clearLoadRecovery(detail); refresh(); return }
    detail.querySelector<HTMLElement>('[data-constellation-part="constellation-heading"]')!.textContent = name
    const result = await loadWithRecovery(detail, () => loadConstellationByName(name), {
      label: name, retry: () => { void show(name) },
      isCurrent: () => !signal.aborted && !panel.hidden && current === request,
      focusTarget: document.getElementById('constellations-close')!,
    })
    if (!result?.value) return
    chart = result.value
    refresh()
    detail.scrollTop = 0
  }
  const renderTerms = () => {
    const query = normalize(search.value)
    const matches = names.filter((name) => normalize(name).includes(query))
    terms.replaceChildren(...matches.map((name) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'glossary-term'
      button.textContent = name
      button.dataset.constellation = name
      button.setAttribute('aria-controls', detail.id)
      return button
    }))
    detail.hidden = !matches.length
    empty.hidden = Boolean(matches.length)
    if (matches.length) void show(matches.includes(selected) ? selected : matches[0]!)
    else { request++; clearLoadRecovery(detail) }
  }
  search.addEventListener('input', renderTerms, { signal })
  document.getElementById('discover-constellation-magnify')!.addEventListener('click', () => {
    magnified = !magnified
    refresh()
  }, { signal })
  document.getElementById('discover-constellation-grid')!.addEventListener('click', () => {
    equatorialGrid = !equatorialGrid
    refresh()
  }, { signal })
  terms.addEventListener('click', (event) => {
    const name = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button')?.dataset.constellation : undefined
    if (name) void show(name)
  }, { signal })
  signal.addEventListener('abort', () => disposeConstellationCard(detail), { once: true })
  return {
    open: renderTerms,
    close: () => { request++; clearLoadRecovery(detail) },
    refresh,
  }
}
