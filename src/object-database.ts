import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Filter, createElement, type IconNode } from 'lucide'
import { OBJECT_TYPES, objectTypeLabel, type Star } from './catalog-model'
import { formatDistance, type DistanceUnit } from './astronomy'
import { companionIcon } from './companion-icon'

export const OBJECT_DATABASE_COLUMNS = [
  { key: 'name', label: 'Name', width: 190 },
  { key: 'type', label: 'Object type', width: 128, filter: 'type' },
  { key: 'distance', label: 'Distance from Sun', width: 155 },
  { key: 'subtype', label: 'Sub-type', width: 190, filter: 'subtype' },
  { key: 'planets', label: 'Planets', width: 75 },
  { key: 'spectral', label: 'Spectral type', width: 110, filter: 'spectral' },
  { key: 'temperature', label: 'Temperature', unit: 'K', width: 105 },
  { key: 'luminosity', label: 'Bol. luminosity', unit: 'L☉', width: 120 },
  { key: 'mass', label: 'Mass', unit: 'M☉', width: 85 },
  { key: 'radius', label: 'Radius', unit: 'R☉', width: 85 },
  { key: 'metallicity', label: 'Metallicity', unit: 'dex', width: 130 },
  { key: 'age', label: 'Age', unit: 'Gyr', width: 80 },
  { key: 'absolute', label: 'Abs. mag', unit: 'V', width: 85 },
  { key: 'apparent', label: 'App. mag', unit: 'V', width: 85 },
] as const

export type ObjectDatabaseColumn = typeof OBJECT_DATABASE_COLUMNS[number]['key']
export type ObjectDatabaseFilter = 'type' | 'subtype' | 'spectral'
export interface ObjectDatabaseItem {
  star: Star
  distancePc: number
  sunDistancePc: number
  color: string
}
export interface ObjectDatabaseState {
  sort: ObjectDatabaseColumn
  direction: 'ascending' | 'descending'
  distance: 'sun' | 'origin'
  filters: Record<ObjectDatabaseFilter, ReadonlySet<string> | null>
}

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 50
const VIRTUAL_THRESHOLD = 200
const OVERSCAN = 4
const nameOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export function objectSpectralClass(star: Pick<Star, 'spectral_type'>): string {
  if (!star.spectral_type) return 'unavailable'
  return star.spectral_type.match(/^\s*(?:(?:u|e)?sd)?([OBAFGKM])/i)?.[1]?.toUpperCase() ?? 'other'
}

export function objectDatabaseValue(item: ObjectDatabaseItem, column: ObjectDatabaseColumn, distance: ObjectDatabaseState['distance']): string | number | null {
  const star = item.star
  switch (column) {
    case 'name': return star.name
    case 'type': return objectTypeLabel(star.type)
    case 'distance': return distance === 'sun' ? item.sunDistancePc : item.distancePc
    case 'subtype': return star.subtypes?.length ? star.subtypes.join(' · ') : null
    case 'planets': return star.known_planets ?? null
    case 'spectral': return star.spectral_type
    case 'temperature': return star.temperature_k
    case 'luminosity': return star.luminosity_solar
    case 'mass': return star.mass_solar
    case 'radius': return star.radius_solar
    case 'metallicity': return star.metallicity_dex
    case 'age': return star.age_gyr
    case 'absolute': return star.absolute_mag
    case 'apparent': return star.apparent_mag ?? null
  }
}

function missing(value: string | number | null): boolean {
  return value === null || value === '' || typeof value === 'number' && !Number.isFinite(value)
}

export function filterAndSortObjectDatabaseItems<T extends ObjectDatabaseItem>(items: readonly T[], state: ObjectDatabaseState): T[] {
  const { type, subtype, spectral } = state.filters
  return items.filter(({ star }) =>
    (!type || type.has(star.type)) &&
    (!subtype || (star.subtypes?.length ? star.subtypes : ['unavailable']).some((label) => subtype.has(label))) &&
    (!spectral || spectral.has(objectSpectralClass(star))),
  ).sort((first, second) => {
    const a = objectDatabaseValue(first, state.sort, state.distance)
    const b = objectDatabaseValue(second, state.sort, state.distance)
    // Missing measurements remain last in both directions; zero is a known value.
    const aMissing = missing(a)
    const bMissing = missing(b)
    if (aMissing !== bMissing) return aMissing ? 1 : -1
    const order = aMissing ? 0 : typeof a === 'number' && typeof b === 'number' ? a - b : nameOrder.compare(String(a), String(b))
    return (state.direction === 'ascending' ? order : -order) || nameOrder.compare(first.star.name, second.star.name) || nameOrder.compare(first.star.id, second.star.id)
  })
}

function numberLabel(value: number): string {
  const magnitude = Math.abs(value)
  if (magnitude !== 0 && (magnitude < 0.001 || magnitude >= 1_000_000)) return value.toExponential(2)
  return value.toLocaleString('en-US', { maximumSignificantDigits: 5 })
}

function smallIcon(shape: IconNode): SVGElement {
  return createElement(shape, { width: 13, height: 13, 'stroke-width': 1.7, 'aria-hidden': 'true' })
}

/** A virtualized table shares the compact list's catalog, search and membership. */
export class ObjectDatabase {
  private readonly container: HTMLElement
  private readonly onChange: () => void
  private readonly body: HTMLTableSectionElement
  private readonly headers = new Map<ObjectDatabaseColumn, HTMLTableCellElement>()
  private readonly popup: HTMLDivElement
  private stars: readonly Star[] = []
  private items: readonly ObjectDatabaseItem[] = []
  private selectedId: string | null = null
  private referenceId = 'sun'
  private referenceName = 'Sun'
  private unit: DistanceUnit = 'ly'
  private frame: number | null = null
  private start = -1
  private end = -1
  private activeFilter: ObjectDatabaseFilter | null = null
  private filterButton: HTMLButtonElement | null = null
  readonly state: ObjectDatabaseState = {
    sort: 'distance', direction: 'ascending', distance: 'sun',
    filters: { type: null, subtype: null, spectral: null },
  }

  constructor(container: HTMLElement, onChange: () => void, onSelect: (id: string) => void) {
    this.container = container
    this.onChange = onChange
    const table = document.createElement('table')
    table.className = 'object-database-table'
    table.setAttribute('aria-label', 'Objects database')
    const columns = document.createElement('colgroup')
    const head = table.createTHead().insertRow()
    for (const column of OBJECT_DATABASE_COLUMNS) {
      const col = document.createElement('col')
      col.style.width = `${column.width}px`
      columns.append(col)
      const th = document.createElement('th')
      th.scope = 'col'
      th.dataset.column = column.key
      const controls = document.createElement('div')
      controls.className = 'object-column-heading'
      const sort = document.createElement('button')
      sort.type = 'button'
      sort.className = 'object-column-sort'
      sort.dataset.sort = column.key
      const label = document.createElement('span')
      label.className = 'object-column-label'
      label.textContent = column.label
      sort.append(label, smallIcon(ArrowUpDown))
      sort.addEventListener('click', () => {
        this.state.direction = this.state.sort === column.key && this.state.direction === 'ascending' ? 'descending' : 'ascending'
        this.state.sort = column.key
        this.closeFilter()
        this.updateHeaders()
        this.onChange()
      })
      controls.append(sort)
      if ('filter' in column) {
        const filter = document.createElement('button')
        filter.type = 'button'
        filter.className = 'object-column-filter-button'
        filter.dataset.filter = column.filter
        filter.setAttribute('aria-label', `Filter ${column.label.toLowerCase()}`)
        filter.setAttribute('aria-expanded', 'false')
        filter.setAttribute('aria-controls', 'object-column-filter')
        filter.title = `Filter ${column.label.toLowerCase()}`
        filter.append(smallIcon(Filter))
        filter.addEventListener('click', () => this.openFilter(column.filter, filter))
        controls.append(filter)
      }
      if (column.key === 'distance') {
        const swap = document.createElement('button')
        swap.type = 'button'
        swap.className = 'object-distance-swap object-column-filter-button'
        swap.append(smallIcon(ArrowLeftRight))
        swap.addEventListener('click', () => {
          this.state.distance = this.state.distance === 'sun' ? 'origin' : 'sun'
          this.updateHeaders()
          this.onChange()
        })
        controls.append(swap)
      }
      const unit = document.createElement('span')
      unit.className = 'object-column-unit'
      unit.textContent = 'unit' in column ? column.unit : '\u00a0'
      th.append(controls, unit)
      head.append(th)
      this.headers.set(column.key, th)
    }
    table.prepend(columns)
    this.body = table.createTBody()
    container.append(table)
    this.popup = document.createElement('div')
    this.popup.id = 'object-column-filter'
    this.popup.className = 'object-column-filter'
    this.popup.setAttribute('popover', 'auto')
    document.body.append(this.popup)
    this.popup.addEventListener('toggle', () => {
      if (!this.popup.matches(':popover-open')) {
        this.filterButton?.setAttribute('aria-expanded', 'false')
        this.filterButton = null
        this.activeFilter = null
      }
    })
    this.popup.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        const button = this.filterButton
        this.closeFilter()
        button?.focus()
      }
    })
    container.addEventListener('click', (event) => {
      const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-star]')
      if (row) onSelect(row.dataset.star!)
    })
    container.addEventListener('scroll', () => {
      if (this.popup.matches(':popover-open')) this.positionFilter()
      if (this.frame !== null) return
      this.frame = requestAnimationFrame(() => {
        this.frame = null
        this.renderRows()
      })
    }, { passive: true })
    new ResizeObserver(() => {
      this.closeFilter()
      if (!container.hidden) this.renderRows(true)
    }).observe(container)
    this.updateHeaders()
  }

  setStars(stars: readonly Star[]): void {
    this.closeFilter()
    this.stars = stars
  }

  setReference(id: string, name: string): void {
    this.referenceId = id
    this.referenceName = name
    this.updateHeaders()
  }

  filterAndSort<T extends ObjectDatabaseItem>(items: readonly T[]): T[] {
    return filterAndSortObjectDatabaseItems(items, this.state)
  }

  render(items: readonly ObjectDatabaseItem[], selectedId: string | null, unit: DistanceUnit, force = false): void {
    const changed = this.items !== items || this.selectedId !== selectedId || this.unit !== unit
    this.items = items
    this.selectedId = selectedId
    if (this.unit !== unit) {
      this.unit = unit
      this.updateHeaders()
    }
    this.renderRows(force || changed)
  }

  reveal(id: string): void {
    const index = this.items.findIndex((item) => item.star.id === id)
    if (index < 0) return
    const top = index * ROW_HEIGHT
    const height = this.container.clientHeight - HEADER_HEIGHT
    if (top < this.container.scrollTop || top + ROW_HEIGHT > this.container.scrollTop + height) {
      this.container.scrollTop = Math.max(0, top - height / 2 + ROW_HEIGHT / 2)
    }
  }

  setVisible(visible: boolean): void {
    this.container.hidden = !visible
  }

  resetScroll(): void {
    this.container.scrollTop = 0
  }

  closeFilter(): void {
    this.popup.hidePopover()
    this.filterButton?.setAttribute('aria-expanded', 'false')
    this.filterButton = null
    this.activeFilter = null
  }

  private updateHeaders(): void {
    for (const [key, th] of this.headers) {
      const sort = th.querySelector<HTMLButtonElement>('.object-column-sort')!
      const selected = this.state.sort === key
      th.setAttribute('aria-sort', selected ? this.state.direction : 'none')
      sort.querySelector('svg')!.replaceWith(smallIcon(selected ? this.state.direction === 'ascending' ? ArrowUp : ArrowDown : ArrowUpDown))
      if (key === 'distance') {
        const label = `Distance from ${this.state.distance === 'sun' ? 'Sun' : this.referenceName}`
        sort.querySelector('.object-column-label')!.textContent = label
        th.querySelector('.object-column-unit')!.textContent = this.unit
        const swap = th.querySelector<HTMLButtonElement>('.object-distance-swap')!
        const next = this.state.distance === 'sun' ? this.referenceName : 'Sun'
        swap.disabled = this.referenceId === 'sun'
        swap.title = swap.disabled ? 'Origin is Sun' : `Switch to distance from ${next}`
        swap.setAttribute('aria-label', swap.title)
        swap.setAttribute('aria-pressed', String(this.state.distance === 'origin'))
      }
      const label = sort.querySelector('.object-column-label')!.textContent!
      sort.setAttribute('aria-label', `Sort by ${label.toLowerCase()}, ${selected && this.state.direction === 'ascending' ? 'descending' : 'ascending'}`)
      sort.title = sort.getAttribute('aria-label')!
      const filter = th.querySelector<HTMLButtonElement>('button[data-filter]')
      if (filter) {
        const values = this.state.filters[filter.dataset.filter as ObjectDatabaseFilter]
        filter.setAttribute('aria-pressed', String(values !== null))
        filter.title = values === null ? `Filter ${label.toLowerCase()}` : `Filter ${label.toLowerCase()} · ${values.size} selected`
      }
    }
  }

  private options(filter: ObjectDatabaseFilter): { value: string; label: string }[] {
    if (filter === 'type') return OBJECT_TYPES.filter((type) => this.stars.some((star) => star.type === type)).map((type) => ({ value: type, label: objectTypeLabel(type) }))
    if (filter === 'spectral') return [
      ...[...'OBAFGKM'].map((value) => ({ value, label: value })),
      { value: 'other', label: 'Other spectral types' },
      { value: 'unavailable', label: 'Not available' },
    ]
    const values = [...new Set(this.stars.flatMap((star) => star.subtypes ?? []))].sort(nameOrder.compare)
    return [...values.map((value) => ({ value, label: value })), { value: 'unavailable', label: 'Not available' }]
  }

  private openFilter(filter: ObjectDatabaseFilter, button: HTMLButtonElement): void {
    const wasOpen = this.activeFilter === filter && this.popup.matches(':popover-open')
    this.closeFilter()
    if (wasOpen) return
    this.activeFilter = filter
    this.filterButton = button
    const title = OBJECT_DATABASE_COLUMNS.find((column) => 'filter' in column && column.filter === filter)!.label
    const fieldset = document.createElement('fieldset')
    const legend = document.createElement('legend')
    legend.textContent = title
    const actions = document.createElement('div')
    actions.className = 'object-filter-actions'
    for (const [label, all] of [['All', true], ['Clear', false]] as const) {
      const action = document.createElement('button')
      action.type = 'button'
      action.textContent = label
      action.addEventListener('click', () => {
        this.state.filters[filter] = all ? null : new Set()
        for (const input of fieldset.querySelectorAll<HTMLInputElement>('input')) input.checked = all
        this.updateHeaders()
        this.onChange()
      })
      actions.append(action)
    }
    const options = this.options(filter)
    const list = document.createElement('div')
    list.className = 'object-filter-options'
    for (const { value, label } of options) {
      const option = document.createElement('label')
      option.className = 'object-type-option'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.value = value
      input.checked = this.state.filters[filter]?.has(value) ?? true
      input.addEventListener('change', () => {
        const selected = new Set(this.state.filters[filter] ?? options.map((option) => option.value))
        if (input.checked) selected.add(value)
        else selected.delete(value)
        this.state.filters[filter] = selected.size === options.length && options.every((option) => selected.has(option.value)) ? null : selected
        this.updateHeaders()
        this.onChange()
      })
      option.append(input, document.createTextNode(label))
      list.append(option)
    }
    fieldset.append(legend, actions, list)
    this.popup.replaceChildren(fieldset)
    this.positionFilter()
    this.popup.showPopover()
    button.setAttribute('aria-expanded', 'true')
    list.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  }

  private positionFilter(): void {
    if (!this.filterButton) return
    const bounds = this.filterButton.getBoundingClientRect()
    this.popup.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - 260))}px`
    this.popup.style.top = `${bounds.bottom + 5}px`
    this.popup.style.maxHeight = `${Math.max(100, window.innerHeight - bounds.bottom - 13)}px`
  }

  private spacer(height: number): HTMLTableRowElement {
    const row = document.createElement('tr')
    row.className = 'object-database-spacer'
    row.setAttribute('aria-hidden', 'true')
    const cell = row.insertCell()
    cell.colSpan = OBJECT_DATABASE_COLUMNS.length
    cell.style.height = `${height}px`
    return row
  }

  private row(item: ObjectDatabaseItem): HTMLTableRowElement {
    const row = document.createElement('tr')
    row.dataset.star = item.star.id
    row.classList.toggle('is-selected', item.star.id === this.selectedId)
    row.classList.toggle('is-reference', item.star.id === this.referenceId)
    for (const { key } of OBJECT_DATABASE_COLUMNS) {
      const cell = row.insertCell()
      cell.dataset.column = key
      if (key === 'name') {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'object-database-select'
        button.dataset.star = item.star.id
        button.setAttribute('aria-label', `Select ${item.star.name}`)
        button.setAttribute('aria-pressed', String(item.star.id === this.selectedId))
        if (item.star.id === this.referenceId) button.setAttribute('aria-current', 'true')
        const swatch = document.createElement('span')
        swatch.className = 'star-swatch'
        swatch.style.background = item.color
        swatch.setAttribute('aria-hidden', 'true')
        const name = document.createElement('span')
        name.className = 'catalog-name'
        name.textContent = item.star.name
        button.append(swatch, name)
        const companion = companionIcon(item.star.id)
        if (companion) button.insertBefore(companion, name)
        if (item.star.id === this.referenceId) {
          const marker = document.createElement('span')
          marker.className = 'reference-star'
          marker.textContent = '★'
          marker.title = 'Origin object'
          marker.setAttribute('aria-hidden', 'true')
          button.append(marker)
        }
        button.title = item.star.name
        cell.append(button)
        continue
      }
      const value = objectDatabaseValue(item, key, this.state.distance)
      cell.textContent = missing(value) ? '—' : key === 'distance' ? formatDistance(value as number, this.unit).replace(/\s\S+$/, '') : typeof value === 'number' ? numberLabel(value) : String(value)
      if (missing(value)) {
        cell.classList.add('is-unavailable')
        cell.title = key === 'planets' ? 'Confirmed planet count not available in the adopted catalog.' : 'Not available'
      } else {
        if (key === 'metallicity') cell.textContent = `${Number(value) > 0 ? '+' : ''}${cell.textContent} ${item.star.metallicity_kind ?? ''}`.trim()
        cell.title = cell.textContent
      }
    }
    return row
  }

  private renderRows(force = false): void {
    const count = this.items.length
    const virtual = count > VIRTUAL_THRESHOLD
    const start = virtual ? Math.min(count, Math.max(0, Math.floor(this.container.scrollTop / ROW_HEIGHT) - OVERSCAN)) : 0
    const end = virtual ? Math.min(count, Math.ceil((this.container.scrollTop + (this.container.clientHeight || 340)) / ROW_HEIGHT) + OVERSCAN) : count
    if (!force && start === this.start && end === this.end) return
    const rows: HTMLTableRowElement[] = []
    if (start > 0) rows.push(this.spacer(start * ROW_HEIGHT))
    rows.push(...this.items.slice(start, end).map((item) => this.row(item)))
    if (end < count) rows.push(this.spacer((count - end) * ROW_HEIGHT))
    if (!count) {
      const row = document.createElement('tr')
      row.className = 'object-database-empty'
      const cell = row.insertCell()
      cell.colSpan = OBJECT_DATABASE_COLUMNS.length
      cell.textContent = 'No matching objects'
      rows.push(row)
    }
    this.body.replaceChildren(...rows)
    this.start = start
    this.end = end
  }
}
