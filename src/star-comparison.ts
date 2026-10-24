import type { DistanceUnit, StarColorMode } from './astronomy'
import { describeObject, STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { MISSING_VALUE } from './format'
import { loadStarDetails } from './selected-star-details'
import { objectDesignations } from './designations'
import { objectSubtypeDescription } from './object-subtype-info'
import { renderSelectedStarPreview } from './selected-star-preview'
import { specValues } from './spec-values'
import type { StarSystem } from './star-systems'

/** Spec values whose comparison column opens the same detail card as the selected column. */
export const COMPARISON_DETAIL_TOGGLES: Readonly<Record<string, string>> = {
  'distance-toggle': 'distance-toggle', 'object-type': 'object-type-toggle', constellation: 'constellation-toggle',
  'spectral-type': 'spectral-toggle', temperature: 'temperature-toggle', luminosity: 'luminosity-toggle',
  mass: 'mass-toggle', radius: 'radius-toggle', metallicity: 'metallicity-toggle', 'absolute-mag': 'magnitude-toggle',
}

const eligible = (star: Star | undefined) => star !== undefined && STELLAR_OBJECT_TYPES.some((type) => type === star.type)

interface ComparisonContext {
  selectedId: string | null
  unit: DistanceUnit
  colorMode: StarColorMode
}

export function initializeStarComparison(options: {
  context(): ComparisonContext
  star(id: string | null | undefined): Star | undefined
  system(id: string): StarSystem | undefined
  /** Re-renders the selection with the current comparison and syncs the card layout. */
  update(showSpecs: boolean): void
  select(id: string): void
  openDetail(metric: string): void
  detailAvailable(metric: string): boolean
  detailTarget(metric: 'object-type' | 'constellation'): string | undefined
}, signal: AbortSignal) {
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T
  const button = get<HTMLButtonElement>('object-compare-toggle')
  const card = get('selected-object-card')
  const specs = get('object-specs')
  const heading = get('star-comparison-heading')
  const hint = get('star-comparison-hint')
  const picker = get('star-comparison-members')
  let baseId: string | null = null
  let otherId: string | null = null
  let waiting = false
  let hoveredId: string | null = null
  let pickerStarId: string | null = null
  let pickerAnchor: { x: number; y: number } | null = null
  let dismissedPointerId: number | undefined
  const coarsePointer = window.matchMedia('(pointer: coarse)')
  let touch = coarsePointer.matches
  let pointerInput = false
  let pointer: { x: number; y: number } | null = null
  let scenePointerUp: PointerEvent | undefined
  let consumedSceneTap: { x: number; y: number; time: number } | undefined

  const subtypesRow = get('object-subtypes-row')
  const selectedStar = () => options.star(options.context().selectedId)

  function comparisonStar(): Star | undefined {
    return otherId !== null && options.context().selectedId === baseId ? options.star(otherId) : undefined
  }

  function syncDetails(): void {
    const selected = selectedStar()
    const other = comparisonStar()
    for (const main of specs.querySelectorAll<HTMLButtonElement>('.object-type-toggle[aria-controls$="-card"]')) {
      const row = main.closest<HTMLElement>('.properties > div')!
      const metric = row.querySelector<HTMLElement>('[data-comparison-value]')?.dataset.comparisonValue
      const right = row.querySelector<HTMLButtonElement>('.comparison-spec-toggle')
      const controls = main.getAttribute('aria-controls')!
      const open = !get(controls).hidden
      const split = metric === 'object-type' || metric === 'constellation'
      const same = Boolean(selected && other && split && (metric === 'object-type'
        ? describeObject(selected) === describeObject(other)
        : selected.constellation && selected.constellation === other.constellation))
      const target = split ? options.detailTarget(metric) : undefined
      const mainOpen = open && (!other || !split || same || target === selected?.id)
      if (main.getAttribute('aria-expanded') !== String(mainOpen)) main.setAttribute('aria-expanded', String(mainOpen))
      if (other && right) {
        row.dataset.comparisonActive = open ? !split || same ? 'both' : target === other.id ? 'right' : 'left' : ''
        row.toggleAttribute('data-comparison-same', same)
        right.setAttribute('aria-controls', controls)
        const rightOpen = String(open && (!split || same || target === other.id))
        if (right.getAttribute('aria-expanded') !== rightOpen) right.setAttribute('aria-expanded', rightOpen)
      } else {
        delete row.dataset.comparisonActive
        row.removeAttribute('data-comparison-same')
      }
    }
    // Drop the attribute records caused by this sync, so the observer only reacts to card toggles.
    detailObserver.takeRecords()
  }
  const detailObserver = new MutationObserver((records) => {
    if (records.some(({ target }) => (target as Element).matches('.object-type-toggle'))) syncDetails()
  })
  detailObserver.observe(specs, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
  signal.addEventListener('abort', () => detailObserver.disconnect(), { once: true })

  function clearColumns(): void {
    specs.querySelectorAll('[data-comparison-value], [data-comparison-placeholder]').forEach((value) => value.remove())
    specs.querySelectorAll<HTMLElement>('[data-comparison-revealed]').forEach((row) => {
      row.hidden = true
      row.removeAttribute('data-comparison-revealed')
    })
    specs.querySelectorAll<HTMLElement>('[data-comparison-label]').forEach((label) => {
      label.textContent = label.dataset.comparisonLabel!
      label.removeAttribute('data-comparison-label')
    })
    specs.querySelectorAll<HTMLElement>('[data-comparison-content]').forEach((content) => content.remove())
  }

  function positionHint(): void {
    const popup = picker.hidden ? hint : picker
    if (popup.hidden) return
    const width = popup.offsetWidth
    const height = popup.offsetHeight
    const anchor = pickerAnchor ?? (!touch ? pointer : null)
    let x: number, y: number
    if (anchor) {
      x = anchor.x + 18
      y = anchor.y + 22
      if (y + height > window.innerHeight - 12) y = anchor.y - height - 12
    } else {
      const bounds = card.getBoundingClientRect()
      x = bounds.right + 8
      y = bounds.top
      if (x + width > window.innerWidth - 12) {
        x = bounds.left
        y = get('object-card-details').querySelector('summary')!.getBoundingClientRect().bottom + 8
      }
    }
    popup.style.left = `${Math.max(12, Math.min(x, window.innerWidth - width - 12))}px`
    popup.style.top = `${Math.max(12, Math.min(y, window.innerHeight - height - 12))}px`
  }

  function closePicker(): void {
    if (picker.contains(document.activeElement)) {
      if (pointerInput && document.activeElement instanceof HTMLElement) document.activeElement.blur()
      else button.focus({ preventScroll: true })
    }
    picker.hidden = true
    pickerStarId = null
    pickerAnchor = null
    hoveredId = null
  }

  function renderHint(): void {
    hint.hidden = !waiting || !picker.hidden
    get('comparison-escape').hidden = touch
    const selected = selectedStar()
    if (!waiting || !selected) return
    const { colorMode } = options.context()
    const candidate = options.star(hoveredId)
    get('comparison-hint-name').textContent = selected.name
    renderSelectedStarPreview(get<HTMLCanvasElement>('comparison-hint-icon'), selected, colorMode)
    get('comparison-candidate-name').textContent = candidate?.name ?? 'a star'
    const icon = get<HTMLCanvasElement>('comparison-candidate-icon')
    icon.hidden = !candidate
    if (candidate) renderSelectedStarPreview(icon, candidate, colorMode)
    positionHint()
  }

  function hover(id: string | null): void {
    if (!waiting || !picker.hidden) return
    const candidate = options.star(id)
    const nextId = candidate && eligible(candidate) && (id !== options.context().selectedId || options.system(candidate.id)) ? id : null
    if (hoveredId === nextId) return
    hoveredId = nextId
    renderHint()
  }

  function showPicker(star: Star, system: StarSystem): void {
    const { selectedId, colorMode } = options.context()
    pickerStarId = star.id
    pickerAnchor = { x: scenePointerUp!.clientX, y: scenePointerUp!.clientY }
    get('comparison-system-name').textContent = system.name
    get('comparison-system-members').replaceChildren(...system.components.map(({ star }) => {
      const member = document.createElement('button')
      member.type = 'button'
      member.className = 'comparison-member'
      member.dataset.comparisonStar = star.id
      member.disabled = star.id === selectedId || !eligible(star)
      member.setAttribute('aria-label', `Compare ${star.name}`)
      if (star.id === selectedId) member.title = `${star.name} is already selected`
      const icon = document.createElement('canvas')
      icon.className = 'star-component-icon'
      icon.setAttribute('aria-hidden', 'true')
      renderSelectedStarPreview(icon, star, colorMode)
      const name = document.createElement('span')
      name.textContent = star.name
      member.append(icon, name)
      member.addEventListener('click', () => completeComparison(star))
      return member
    }))
    picker.hidden = false
    renderHint()
    picker.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }

  function completeComparison(other: Star): void {
    const selected = selectedStar()!
    closePicker()
    otherId = other.id
    waiting = false
    options.update(true)
    get('selection-announcement').textContent = `${selected.name} compared with ${other.name}. ${selected.name} remains selected.`
    void loadStarDetails(other).then(() => {
      if (!signal.aborted && comparisonStar()?.id === other.id) options.update(false)
    }).catch((error: unknown) => {
      // Keep the map values visible; source hydration can be retried by comparing again.
      console.error('Could not load comparison source details.', error)
    })
  }

  /** Renders the comparison column into Specs; renderSelection clears the previous column first. */
  function render(): void {
    const { unit, colorMode } = options.context()
    const selected = selectedStar()
    let other = options.star(otherId)
    if (selected?.id !== baseId || !eligible(selected) || otherId !== null && !other) {
      baseId = otherId = null
      waiting = false
      other = undefined
    }
    const active = waiting || otherId !== null
    button.disabled = !eligible(selected)
    button.setAttribute('aria-pressed', String(active))
    button.title = waiting ? 'Cancel comparison' : active ? 'Clear comparison' : 'Compare with another star'
    button.setAttribute('aria-label', button.title)
    card.classList.toggle('is-comparing', otherId !== null)
    heading.hidden = otherId === null
    if (!waiting || pickerStarId && !options.star(pickerStarId)) closePicker()
    if (!picker.hidden) {
      for (const member of picker.querySelectorAll<HTMLButtonElement>('[data-comparison-star]')) {
        const star = options.star(member.dataset.comparisonStar)
        if (star) renderSelectedStarPreview(member.querySelector('canvas')!, star, colorMode)
      }
    }
    renderHint()
    if (!other || !selected) { syncDetails(); return }
    get('comparison-other-select').setAttribute('aria-label', `Select ${other.name}`)
    for (const [prefix, star] of [['main', selected], ['other', other]] as const) {
      get(`comparison-${prefix}-name`).textContent = star.name
      get(`comparison-${prefix}-name`).title = star.name
      renderSelectedStarPreview(get<HTMLCanvasElement>(`comparison-${prefix}-icon`), star, colorMode)
    }
    const subtypes = other.subtypes ?? []
    if (selected.subtypes?.length || subtypes.length) {
      subtypesRow.hidden = false
      get('object-subtypes-empty-row').hidden = true
      if (!selected.subtypes?.length) {
        get('object-subtypes-count').textContent = MISSING_VALUE
        get('object-subtypes-count').classList.add('missing-value')
      }
      const subtypeCount = document.createElement('span')
      subtypeCount.dataset.comparisonValue = 'subtypes'
      subtypeCount.className = subtypes.length ? 'comparison-value' : 'comparison-value missing-value'
      subtypeCount.textContent = subtypes.length ? String(subtypes.length) : MISSING_VALUE
      subtypeCount.title = subtypes.join(', ')
      subtypesRow.querySelector('summary')!.append(subtypeCount)
    }
    for (const [id, items] of [['object-subtypes', subtypes], ['object-designations', objectDesignations(other).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))]] as const) {
      const list = document.createElement('ul')
      list.className = id === 'object-subtypes' ? 'subtype-list' : 'designation-list'
      list.dataset.comparisonContent = ''
      list.setAttribute('aria-label', other.name)
      for (const value of items.length ? items : [MISSING_VALUE]) {
        const item = document.createElement('li')
        if (id === 'object-subtypes' && value !== MISSING_VALUE) {
          const label = document.createElement('strong')
          label.textContent = value
          const description = document.createElement('p')
          description.textContent = objectSubtypeDescription(value)
          item.append(label, description)
        } else {
          item.textContent = value
          item.classList.toggle('missing-value', value === MISSING_VALUE)
        }
        list.append(item)
      }
      const mainList = get(id)
      mainList.setAttribute('aria-label', selected.name)
      mainList.parentElement!.append(list)
      if (!mainList.children.length && !items.length) mainList.closest('details')!.open = false
      if (!mainList.children.length) {
        const missing = document.createElement('li')
        missing.dataset.comparisonContent = ''
        missing.className = 'missing-value'
        missing.textContent = MISSING_VALUE
        mainList.append(missing)
      }
      if (id === 'object-designations' && items.length) {
        get('designations-row').hidden = false
        get('designations-empty-row').hidden = true
      }
    }
    const values = specValues(other, options.star('sun')!, unit)
    for (const row of specs.querySelectorAll<HTMLElement>('.properties > div')) {
      if (row.id === 'object-subtypes-empty-row' && !subtypesRow.hidden) continue
      const main = row.querySelector('dd')!
      const keys = [main.id, ...[...main.querySelectorAll('[id]')].map((node) => node.id)].filter((id) => values[id])
      if (!keys.length) continue
      const entries = keys.map((id) => values[id]!)
      const label = row.querySelector('dt')!
      if (row.hidden) {
        if (entries.every((entry) => entry.text === MISSING_VALUE || entry.text === '0')) continue
        row.dataset.comparisonRevealed = ''
        row.hidden = false
        if (!main.textContent?.trim()) {
          const missing = document.createElement('span')
          missing.dataset.comparisonPlaceholder = ''
          missing.className = 'missing-value'
          missing.textContent = MISSING_VALUE
          main.append(missing)
        }
        if (!label.textContent) {
          label.dataset.comparisonLabel = ''
          label.textContent = entries[0]!.label ?? ''
        }
      }
      const labelText = label.textContent
      const metric = keys[0]!
      const cell = document.createElement('dd')
      cell.dataset.comparisonValue = metric
      cell.className = 'comparison-value'
      const content = metric in COMPARISON_DETAIL_TOGGLES ? document.createElement('button') : cell
      if (content instanceof HTMLButtonElement) {
        content.type = 'button'
        content.className = 'comparison-spec-toggle'
        content.disabled = !options.detailAvailable(metric)
        content.setAttribute('aria-label', `${labelText}: ${other.name}`)
        content.addEventListener('click', (event) => {
          event.stopPropagation()
          options.openDetail(metric)
        })
        cell.append(content)
      }
      for (const entry of entries) {
        const value = document.createElement('span')
        value.textContent = entry.text
        value.title = entry.title ?? ''
        value.classList.toggle('unresolved-measurement', Boolean(entry.unresolved))
        value.classList.toggle('missing-value', entry.text === MISSING_VALUE)
        content.append(value)
        if (entry.label && entry.label !== labelText) {
          const context = document.createElement('small')
          context.textContent = entry.label
          content.append(context)
        }
      }
      row.append(cell)
    }
    syncDetails()
  }

  function cancel(): void {
    baseId = otherId = null
    waiting = false
    options.update(false)
  }

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (waiting || otherId !== null) { cancel(); return }
    const selected = selectedStar()
    if (!eligible(selected)) return
    baseId = selected!.id
    waiting = true
    render()
  }, { signal })
  get('comparison-other-select').addEventListener('click', () => {
    const other = comparisonStar()
    if (!other) return
    baseId = otherId = null
    waiting = false
    options.select(other.id)
  }, { signal })
  // Keep clicks on the right side from also activating the left-side handler.
  specs.addEventListener('click', (event) => {
    if ((event.target as Element).closest('summary')) return
    if ((event.target as Element).closest('[data-comparison-value]')) {
      if (!(event.target as Element).closest('.comparison-spec-toggle')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }, { capture: true, signal })
  document.addEventListener('pointerdown', (event) => {
    pointerInput = true
    consumedSceneTap = undefined
    scenePointerUp = undefined
    dismissedPointerId = undefined
    touch = coarsePointer.matches || event.pointerType === 'touch'
    if (!touch) pointer = { x: event.clientX, y: event.clientY }
    if (!picker.hidden && event.target instanceof Node && !picker.contains(event.target)) {
      dismissedPointerId = event.pointerId
      closePicker()
      renderHint()
    }
  }, { capture: true, passive: true, signal })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') pointerInput = false
  }, { signal })
  document.addEventListener('pointerup', (event) => {
    if (!(event.target instanceof Element) || !event.target.matches('#scene canvas')) return
    scenePointerUp = event
  }, { capture: true, signal })
  document.addEventListener('pointerup', () => { scenePointerUp = undefined }, { signal })
  document.addEventListener('click', (event) => {
    const tap = consumedSceneTap
    consumedSceneTap = undefined
    // Touch's compatibility click can hit a newly expanded property under the finger.
    if (tap && Math.abs(event.clientX - tap.x) < 2 && Math.abs(event.clientY - tap.y) < 2 && event.timeStamp - tap.time < 1000) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }, { capture: true, signal })
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return
    pointer = { x: event.clientX, y: event.clientY }
    if (waiting) positionHint()
  }, { passive: true, signal })
  picker.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const members = [...picker.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const index = members.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? members.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + members.length) % members.length
    members[next]?.focus({ preventScroll: true })
    event.preventDefault()
  }, { signal })
  window.addEventListener('resize', positionHint, { signal })

  return {
    render, clearColumns, positionHint, hover,
    get other() { return comparisonStar() },
    get waiting() { return waiting },
    abort(): boolean {
      // Some browsers retain focus on the enclosing summary after a pointer click.
      // Clear that pointer focus without removing keyboard navigation cues.
      const summary = get('object-card-details').querySelector('summary')!
      if ((waiting || otherId !== null) && pointerInput && document.activeElement instanceof HTMLElement && summary.contains(document.activeElement)) document.activeElement.blur()
      if (!waiting) return false
      cancel()
      return true
    },
    consumeSelection(id: string | null): boolean {
      if (!waiting) return false
      if (scenePointerUp && dismissedPointerId === scenePointerUp.pointerId) return true
      const other = options.star(id)
      if (!other || !eligible(other)) return true
      if (scenePointerUp) consumedSceneTap = { x: scenePointerUp.clientX, y: scenePointerUp.clientY, time: scenePointerUp.timeStamp }
      const system = scenePointerUp ? options.system(other.id) : undefined
      if (system) showPicker(other, system)
      else if (other.id !== options.context().selectedId) completeComparison(other)
      return true
    },
  }
}
