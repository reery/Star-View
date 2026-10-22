import { formatDistance, sunRelativeMetrics, type DistanceUnit, type StarColorMode } from './astronomy'
import { describeObject, STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { catalogMeasurement, catalogSourceFor } from './catalog-source'
import { measurement, MISSING_VALUE, quantity } from './format'
import { planetCountForStar } from './planetary-systems'
import { loadStarDetails } from './selected-star-details'
import { objectDesignations } from './designations'
import { objectSubtypeDescription } from './object-subtype-info'
import { renderSelectedStarPreview } from './selected-star-preview'
import { spaceMotionForStar } from './space-motion'
import type { StarSystem } from './star-systems'

interface ComparisonValue {
  text: string
  title?: string
  unresolved?: boolean
  label?: string
}

/** The same units, precision and source scopes used by the selected object's Specs. */
function comparisonValues(star: Star, sun: Star, unit: DistanceUnit): Record<string, ComparisonValue> {
  const values: Record<string, ComparisonValue> = {}
  const set = (id: string, text: string, title = '', label?: string) => { values[id] = { text, title, label } }
  const source = <T extends Parameters<typeof catalogSourceFor>[1]>(id: string, field: T, format: (value: Exclude<Star[T], undefined> | null) => string) => {
    const retained = catalogSourceFor(star, field)
    values[id] = { text: format(catalogMeasurement(star, field)), title: retained?.scope, unresolved: Boolean(retained) }
  }
  set('distance-toggle', formatDistance(sunRelativeMetrics(star, sun).distancePc, unit))
  set('object-type', describeObject(star))
  set('known-planets', String(planetCountForStar(star.id) ?? star.known_planets ?? 0))
  set('object-subtypes-empty', star.subtypes?.length ? String(star.subtypes.length) : MISSING_VALUE, star.subtypes?.join(', '))
  set('constellation', star.id === 'sun' ? MISSING_VALUE : star.constellation ?? MISSING_VALUE, star.constellation ?? '')
  source('spectral-type', 'spectral_type', (value) => value ?? MISSING_VALUE)
  source('temperature', 'temperature_k', (value) => quantity(value, 'K', 0))
  source('luminosity', 'luminosity_solar', (value) => quantity(value, 'L☉', 1))
  source('mass', 'mass_solar', (value) => quantity(value, 'M☉', 1))
  source('radius', 'radius_solar', (value) => quantity(value, 'R☉', 1))
  source('metallicity', 'metallicity_dex', (value) => quantity(value, 'dex'))
  const metallicitySource = catalogSourceFor(star, 'metallicity_dex')
  values.metallicity!.label = `Metallicity ${(metallicitySource ? metallicitySource.record.metallicity_kind : star.metallicity_kind) ?? ''}`.trim()
  source('age', 'age_gyr', (value) => quantity(value, 'Gyr'))
  source('absolute-mag', 'absolute_mag', (value) => quantity(value, '', 2))
  const observations = star.stellar_observations
  if (star.temperature_k === null && observations?.atmosphere_temperature) {
    const temperature = observations.atmosphere_temperature
    set('temperature', `${temperature.value_k.toLocaleString('en-US')} ± ${quantity(temperature.error_k, 'K', 0)}`, temperature.scope, 'Temperature T*')
  }
  if (star.temperature_k === null && observations?.temperature_range) {
    const range = observations.temperature_range
    set('temperature', `${quantity(range.min_k, '', 0)}–${quantity(range.max_k, 'K', 0)}`, range.summary, 'Temperature (model)')
  }
  if (star.mass_solar === null && observations?.mass_range) {
    const range = observations.mass_range
    set('mass', `${quantity(range.min_jupiter, '', 1)}–${quantity(range.max_jupiter, '', 1)} M♃`, `${range.reference}. ${range.scope}`, 'Mass (model)')
  }
  if (star.radius_solar === null && observations?.radius_range) {
    const range = observations.radius_range
    set('radius', `${quantity(range.min_jupiter, '', 1)}–${quantity(range.max_jupiter, '', 1)} R♃`, range.summary, 'Radius (model)')
  }
  values.temperature!.label ??= 'Temperature'
  values.mass!.label ??= 'Mass'
  values.radius!.label ??= 'Radius'
  const unresolved = star.apparent_mag == null ? star.unresolved_photometry : undefined
  const resolved = star.resolved_photometry
  source('apparent-mag', 'apparent_mag', (value) => quantity(value, '', 2))
  if (resolved) set('apparent-mag', measurement(resolved.magnitude_v, resolved.error_mag, '', 2).trim(), `${resolved.reference}; ${resolved.observed_on}. ${resolved.scope}`)
  else if (unresolved) values['apparent-mag'] = {
    text: measurement(unresolved.magnitude_v, unresolved.error_mag, '', 2).trim(),
    title: `${unresolved.scope}. ${unresolved.source}. Earth-view snapshot; component fluxes are not separated.`, unresolved: true,
  }
  const infrared = observations?.infrared_photometry
  set('infrared-magnitude', infrared ? measurement(infrared.magnitude, infrared.error_mag, '', 2).trim() : MISSING_VALUE,
    infrared ? `${infrared.instrument} ${infrared.band}, ${infrared.wavelength_microns} μm, ${infrared.system} system; ${infrared.observed_on.join(', ')}. ${infrared.reference}. ${infrared.scope}` : '',
    infrared ? `Apparent mag. (${infrared.band})` : undefined)
  for (const axis of ['x', 'y', 'z'] as const) {
    set(`coordinate-${axis}`, formatDistance(star[`${axis}_pc`], unit, 3))
    source(`velocity-${axis}`, `v${axis}_kms`, (value) => quantity(value, 'km/s'))
  }
  set('plane-distance', formatDistance(sunRelativeMetrics(star, sun).planeDistancePc, unit, 3))
  set('epoch', `J${star.epoch.toFixed(1)}`)
  const motion = spaceMotionForStar(star)
  set('motion-data', motion.label ?? MISSING_VALUE, motion.title)
  const raw = star.raw_astrometry
  set('right-ascension', raw ? `${raw.ra_deg.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg` : MISSING_VALUE)
  set('declination', raw ? `${raw.dec_deg.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg` : MISSING_VALUE)
  set('astrometry-epoch', raw ? `J${raw.epoch.toFixed(1)}` : MISSING_VALUE)
  set('parallax', raw ? measurement(raw.parallax_mas, raw.parallax_error_mas, 'mas', 6) : MISSING_VALUE)
  set('proper-motion-ra', raw ? measurement(raw.pm_ra_cosdec_masyr, raw.pm_ra_error_masyr, 'mas/yr', 6) : MISSING_VALUE)
  set('proper-motion-dec', raw ? measurement(raw.pm_dec_masyr, raw.pm_dec_error_masyr, 'mas/yr', 6) : MISSING_VALUE)
  const rvSource = raw?.radial_velocity_kms == null ? star.catalog_sources?.find((entry) => entry.record.raw_astrometry?.radial_velocity_kms != null) : undefined
  const rv = rvSource?.record.raw_astrometry ?? raw
  set('radial-velocity', rv ? measurement(rv.radial_velocity_kms, rv.radial_velocity_error_kms, 'km/s', 6) : MISSING_VALUE,
    rvSource?.scope ?? raw?.radial_velocity_ref ?? observations?.radial_velocity_review?.reason)
  if (star.radial_velocity_observation) {
    const observed = star.radial_velocity_observation
    set('radial-velocity', measurement(observed.value_kms, observed.error_kms, 'km/s', 6), `${observed.reference}; ${observed.observed_from} to ${observed.observed_to}. ${observed.uncertainty_kind} ${observed.scope}`)
  }
  set('astrometry-source', raw?.astrometry_ref || MISSING_VALUE)
  return values
}

interface ComparisonContext {
  selected: Star | undefined
  stars: readonly Star[]
  unit: DistanceUnit
  colorMode: StarColorMode
}

export function initializeStarComparison(options: {
  context(): ComparisonContext
  system(id: string): StarSystem | undefined
  showSpecs(): void
  layout(): void
  changed(): void
  select(id: string): void
  openDetail(metric: string, other: boolean): void
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

  const eligible = (star: Star | undefined) => star !== undefined && STELLAR_OBJECT_TYPES.some((type) => type === star.type)

  function comparisonStar(): Star | undefined {
    const { selected, stars } = options.context()
    return selected?.id === baseId ? stars.find((star) => star.id === otherId) : undefined
  }

  function syncDetails(): void {
    const { selected } = options.context()
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
    const { selected, stars, colorMode } = options.context()
    hint.hidden = !waiting || !picker.hidden
    get('comparison-escape').hidden = touch
    if (!waiting || !selected) return
    const candidate = stars.find((star) => star.id === hoveredId)
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
    const { stars, selected } = options.context()
    const candidate = stars.find((star) => star.id === id)
    const nextId = candidate && eligible(candidate) && (id !== selected?.id || options.system(candidate.id)) ? id : null
    if (hoveredId === nextId) return
    hoveredId = nextId
    renderHint()
  }

  function showPicker(star: Star, system: StarSystem): void {
    const { selected, colorMode } = options.context()
    pickerStarId = star.id
    pickerAnchor = { x: scenePointerUp!.clientX, y: scenePointerUp!.clientY }
    get('comparison-system-name').textContent = system.name
    get('comparison-system-members').replaceChildren(...system.components.map(({ star }) => {
      const member = document.createElement('button')
      member.type = 'button'
      member.className = 'comparison-member'
      member.dataset.comparisonStar = star.id
      member.disabled = star.id === selected?.id || !eligible(star)
      member.setAttribute('aria-label', `Compare ${star.name}`)
      if (star.id === selected?.id) member.title = `${star.name} is already selected`
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
    const { selected } = options.context()
    closePicker()
    otherId = other.id
    waiting = false
    render()
    options.showSpecs()
    options.changed()
    options.layout()
    get('selection-announcement').textContent = `${selected!.name} compared with ${other.name}. ${selected!.name} remains selected.`
    void loadStarDetails(other).then(() => {
      if (signal.aborted || otherId !== other.id || baseId !== options.context().selected?.id) return
      render()
      options.changed()
      options.layout()
    }).catch((error: unknown) => {
      // Keep the map values visible; source hydration can be retried by comparing again.
      console.error('Could not load comparison source details.', error)
    })
  }

  function render(): void {
    clearColumns()
    const { selected, stars, unit, colorMode } = options.context()
    const other = stars.find((star) => star.id === otherId)
    if (selected?.id !== baseId || !eligible(selected) || otherId !== null && !other) {
      baseId = otherId = null
      waiting = false
    }
    const active = waiting || otherId !== null
    button.disabled = !eligible(selected)
    button.setAttribute('aria-pressed', String(active))
    button.title = waiting ? 'Cancel comparison' : active ? 'Clear comparison' : 'Compare with another star'
    button.setAttribute('aria-label', button.title)
    card.classList.toggle('is-comparing', otherId !== null)
    heading.hidden = otherId === null
    if (!waiting || pickerStarId && !stars.some((star) => star.id === pickerStarId)) closePicker()
    if (!picker.hidden) {
      for (const member of picker.querySelectorAll<HTMLButtonElement>('[data-comparison-star]')) {
        const star = stars.find((star) => star.id === member.dataset.comparisonStar)
        if (star) renderSelectedStarPreview(member.querySelector('canvas')!, star, colorMode)
      }
    }
    renderHint()
    if (!other || !selected || otherId === null) { syncDetails(); return }
    get('comparison-other-select').setAttribute('aria-label', `Select ${other.name}`)
    for (const [prefix, star] of [['main', selected], ['other', other]] as const) {
      get(`comparison-${prefix}-name`).textContent = star.name
      get(`comparison-${prefix}-name`).title = star.name
      renderSelectedStarPreview(get<HTMLCanvasElement>(`comparison-${prefix}-icon`), star, colorMode)
    }
    const subtypes = other.subtypes ?? []
    if (selected.subtypes?.length || subtypes.length) {
      get('object-subtypes-row').hidden = false
      get('object-subtypes-empty-row').hidden = true
      if (!selected.subtypes?.length) get('object-subtypes-count').textContent = MISSING_VALUE
      const subtypeCount = document.createElement('span')
      subtypeCount.dataset.comparisonValue = 'subtypes'
      subtypeCount.className = 'comparison-value'
      subtypeCount.textContent = other.subtypes?.length ? String(other.subtypes.length) : MISSING_VALUE
      subtypeCount.title = other.subtypes?.join(', ') ?? ''
      get('object-subtypes-row').querySelector('summary')!.append(subtypeCount)
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
        } else item.textContent = value
        list.append(item)
      }
      const mainList = get(id)
      mainList.setAttribute('aria-label', selected.name)
      mainList.parentElement!.append(list)
      if (!mainList.children.length) {
        const missing = document.createElement('li')
        missing.dataset.comparisonContent = ''
        missing.textContent = MISSING_VALUE
        mainList.append(missing)
      }
      if (id === 'object-designations' && items.length) {
        get('designations-row').hidden = false
        get('designations-empty-row').hidden = true
      }
    }
    const values = comparisonValues(other, stars.find((star) => star.id === 'sun')!, unit)
    for (const row of specs.querySelectorAll<HTMLElement>('.properties > div')) {
      if (row.id === 'object-subtypes-empty-row' && !get('object-subtypes-row').hidden) continue
      const main = row.querySelector('dd')!
      const keys = [main.id, ...[...main.querySelectorAll('[id]')].map((node) => node.id)].filter((id) => values[id])
      if (!keys.length) continue
      const entries = keys.map((id) => values[id]!)
      if (row.hidden) {
        if (entries.every((entry) => entry.text === MISSING_VALUE || entry.text === '0')) continue
        row.dataset.comparisonRevealed = ''
        row.hidden = false
        if (!main.textContent?.trim()) {
          const missing = document.createElement('span')
          missing.dataset.comparisonPlaceholder = ''
          missing.textContent = MISSING_VALUE
          main.append(missing)
        }
        const label = row.querySelector('dt')!
        if (!label.textContent) {
          label.dataset.comparisonLabel = ''
          label.textContent = entries[0]!.label ?? ''
        }
      }
      const cell = document.createElement('dd')
      cell.dataset.comparisonValue = keys[0]!
      cell.className = 'comparison-value'
      const metric = keys[0]!
      const interactive = ['distance-toggle', 'object-type', 'constellation', 'spectral-type', 'temperature', 'luminosity', 'mass', 'radius', 'metallicity', 'absolute-mag'].includes(metric)
      const content = interactive ? document.createElement('button') : cell
      if (content instanceof HTMLButtonElement) {
        content.type = 'button'
        content.className = 'comparison-spec-toggle'
        content.disabled = !options.detailAvailable(metric)
        content.setAttribute('aria-label', `${row.querySelector('dt')!.textContent}: ${other.name}`)
        content.addEventListener('click', (event) => {
          event.stopPropagation()
          options.openDetail(metric, true)
        })
        cell.append(content)
      }
      for (const entry of entries) {
        const value = document.createElement('span')
        value.textContent = entry.text
        value.title = entry.title ?? ''
        value.classList.toggle('unresolved-measurement', Boolean(entry.unresolved))
        content.append(value)
        if (entry.label && entry.label !== row.querySelector('dt')!.textContent) {
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
    render()
    options.changed()
    options.layout()
  }

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (waiting || otherId !== null) { cancel(); return }
    const { selected } = options.context()
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
      const { stars, selected } = options.context()
      if (scenePointerUp && dismissedPointerId === scenePointerUp.pointerId) return true
      const other = stars.find((star) => star.id === id)
      if (!other || !eligible(other)) return true
      if (scenePointerUp) consumedSceneTap = { x: scenePointerUp.clientX, y: scenePointerUp.clientY, time: scenePointerUp.timeStamp }
      const system = scenePointerUp ? options.system(other.id) : undefined
      if (system) showPicker(other, system)
      else if (other.id !== selected?.id) completeComparison(other)
      return true
    },
  }
}
