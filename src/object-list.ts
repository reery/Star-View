import type { Star } from './catalog-model'
import { objectDesignations } from './designations'
import { formatDistance, starDisplayColor, sunRelativeMetrics, type DistanceUnit, type StarColorMode } from './astronomy'
import { ObjectDatabase } from './object-database'

const VIRTUAL_THRESHOLD = 200
const ROW_HEIGHT = 36
const OVERSCAN = 4
const GREEK_SEARCH_NAMES: Record<string, string> = Object.fromEntries(
  [...'αβγδεζηθικλμνξοπρστυφχψω'].map((letter, index) => [letter,
    'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega'.split(' ')[index]!]),
)

export function normalizeObjectSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/[α-ω]/g, (letter) => `${GREEK_SEARCH_NAMES[letter] ?? letter} `)
    // Coordinate signs distinguish different objects, unlike name punctuation.
    .replace(/[+\-−](?=\d)/g, (sign) => sign === '+' ? 'plus' : 'minus')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export function objectSearchText(star: Star): string {
  return normalizeObjectSearch([star.name, star.id, star.spectral_type ?? '', ...(star.subtypes ?? []), ...objectDesignations(star), star.molecular_cloud?.complex_name ?? ''].join(' '))
}

export function virtualRange(scrollTop: number, viewportHeight: number, count: number): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  return { start, end }
}

interface ObjectListItem {
  star: Star
  distancePc: number
  sunDistancePc: number
  search: string
  compactSearch: string
  color: string
}

export function sortObjectListItemsByDistance<T extends { distancePc: number }>(items: readonly T[]): T[] {
  return [...items].sort((first, second) => first.distancePc - second.distancePc)
}

export class ObjectList {
  private readonly container: HTMLElement
  private readonly onCountChange: (shown: number, total: number) => void
  private items: ObjectListItem[] = []
  private filtered: ObjectListItem[] = []
  private query = ''
  private compactQuery = ''
  private filter: (star: Star) => boolean = () => true
  private countedShown = -1
  private countedTotal = -1
  private selectedId: string | null = null
  private referenceId = 'sun'
  private unit: DistanceUnit = 'ly'
  private colorMode: StarColorMode = 'real'
  private scrollFrame: number | null = null
  private renderedVirtualItems: ObjectListItem[] | null = null
  private renderedVirtualStart = -1
  private renderedVirtualEnd = -1
  private readonly database: ObjectDatabase | null
  private expanded = false

  constructor(container: HTMLElement, onSelect: (id: string) => void, onCountChange: (shown: number, total: number) => void, databaseContainer?: HTMLElement) {
    this.container = container
    this.onCountChange = onCountChange
    this.database = databaseContainer ? new ObjectDatabase(databaseContainer, () => this.refresh(true), onSelect) : null
    container.addEventListener('scroll', () => this.scheduleScrollRender(), { passive: true })
    container.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-star]')
      if (button) onSelect(button.dataset.star!)
    })
  }

  setStars(stars: readonly Star[], unit: DistanceUnit, selectedId: string | null, referenceId = 'sun'): void {
    const sun = stars.find((star) => star.id === 'sun')!
    const reference = stars.find((star) => star.id === referenceId) ?? sun
    this.items = sortObjectListItemsByDistance(stars.map((star) => {
      const search = objectSearchText(star)
      return {
        star,
        distancePc: sunRelativeMetrics(star, reference).distancePc,
        sunDistancePc: sunRelativeMetrics(star, sun).distancePc,
        search,
        compactSearch: search.replace(/ /g, ''),
        color: starDisplayColor(star, this.colorMode).getStyle(),
      }
    }))
    this.query = ''
    this.compactQuery = ''
    this.unit = unit
    this.selectedId = selectedId
    this.referenceId = reference.id
    this.database?.setStars(stars)
    this.database?.setReference(reference.id, reference.name)
    this.refresh()
  }

  setReference(id: string): void {
    if (id === this.referenceId) return
    const reference = this.items.find((item) => item.star.id === id)?.star
    if (!reference) return
    this.referenceId = id
    this.database?.setReference(id, reference.name)
    this.items = sortObjectListItemsByDistance(this.items.map((item) => ({
      ...item,
      distancePc: sunRelativeMetrics(item.star, reference).distancePc,
    })))
    this.refresh()
  }

  setQuery(query: string): void {
    this.query = normalizeObjectSearch(query)
    this.compactQuery = this.query.replace(/ /g, '')
    this.refresh()
  }

  setFilter(filter: (star: Star) => boolean): void {
    this.filter = filter
    this.refresh()
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded && this.database !== null
    this.container.hidden = this.expanded
    this.closeColumnFilter()
    this.refresh(true)
  }

  closeColumnFilter(): void {
    this.database?.closeFilter()
  }

  private refresh(force = false): void {
    const matching = this.items.filter((item) => this.filter(item.star) && (!this.query || item.search.includes(this.query) || item.compactSearch.includes(this.compactQuery)))
    const filtered = this.expanded ? this.database!.filterAndSort(matching) : matching
    if (filtered.length !== this.countedShown || this.items.length !== this.countedTotal) {
      this.countedShown = filtered.length
      this.countedTotal = this.items.length
      this.onCountChange(filtered.length, this.items.length)
    }
    if (!force && filtered.length === this.filtered.length && filtered.every((item, index) => item === this.filtered[index])) return
    this.filtered = filtered
    this.container.scrollTop = 0
    if (this.expanded) this.database!.resetScroll()
    this.render(true)
  }

  setDistanceUnit(unit: DistanceUnit): void {
    if (unit === this.unit) return
    this.unit = unit
    this.render(true)
  }

  setColorMode(mode: StarColorMode): void {
    if (mode === this.colorMode) return
    this.colorMode = mode
    for (const item of this.items) item.color = starDisplayColor(item.star, mode).getStyle()
    this.render(true)
  }

  setSelected(id: string | null, reveal = false): void {
    if (id === this.selectedId && !reveal) return
    this.selectedId = id
    if (this.expanded && reveal && id) this.database!.reveal(id)
    if (reveal && id) {
      const index = this.filtered.findIndex((item) => item.star.id === id)
      if (index >= 0 && this.filtered.length > VIRTUAL_THRESHOLD) {
        const top = index * ROW_HEIGHT
        if (top < this.container.scrollTop || top + ROW_HEIGHT > this.container.scrollTop + this.container.clientHeight) {
          this.container.scrollTop = Math.max(0, top - this.container.clientHeight / 2 + ROW_HEIGHT / 2)
        }
      }
    }
    this.render(true)
  }

  private button(item: ObjectListItem, index: number, virtual: boolean): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'catalog-entry'
    button.classList.toggle('is-selected', item.star.id === this.selectedId)
    button.classList.toggle('is-reference', item.star.id === this.referenceId)
    button.dataset.star = item.star.id
    button.setAttribute('aria-label', `Select ${item.star.name}`)
    button.setAttribute('aria-pressed', String(item.star.id === this.selectedId))
    if (item.star.id === this.referenceId) button.setAttribute('aria-current', 'true')
    if (virtual) {
      button.style.position = 'absolute'
      button.style.transform = `translateY(${index * ROW_HEIGHT}px)`
    }
    const swatch = document.createElement('span')
    swatch.className = 'star-swatch'
    swatch.style.background = item.color
    swatch.setAttribute('aria-hidden', 'true')
    const marker = document.createElement('span')
    marker.className = 'catalog-marker'
    marker.append(swatch)
    if (item.star.id === this.referenceId) {
      const reference = document.createElement('span')
      reference.className = 'reference-star'
      reference.textContent = '\u2605'
      reference.title = 'Origin object'
      reference.setAttribute('aria-hidden', 'true')
      marker.append(reference)
    }
    const name = document.createElement('span')
    name.className = 'catalog-name'
    name.textContent = item.star.name
    const distance = document.createElement('span')
    distance.className = 'catalog-distance'
    distance.textContent = formatDistance(item.distancePc, this.unit)
    button.append(marker, name, distance)
    return button
  }

  private scheduleScrollRender(): void {
    if (this.scrollFrame !== null) return
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null
      this.render()
    })
  }

  private render(force = false): void {
    if (force && this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame)
      this.scrollFrame = null
    }
    if (this.database) this.database.setVisible(this.expanded)
    if (this.expanded) {
      this.database!.render(this.filtered, this.selectedId, this.unit, force)
      return
    }
    const virtual = this.filtered.length > VIRTUAL_THRESHOLD
    this.container.classList.toggle('is-virtualized', virtual)
    if (!virtual) {
      this.renderedVirtualItems = null
      this.renderedVirtualStart = -1
      this.renderedVirtualEnd = -1
      this.container.replaceChildren(...this.filtered.map((item, index) => this.button(item, index, false)))
      return
    }
    const { start, end } = virtualRange(this.container.scrollTop, this.container.clientHeight || 320, this.filtered.length)
    if (!force && this.renderedVirtualItems === this.filtered && this.renderedVirtualStart === start && this.renderedVirtualEnd === end) return
    const spacer = document.createElement('div')
    spacer.className = 'catalog-virtual-spacer'
    spacer.style.height = `${this.filtered.length * ROW_HEIGHT}px`
    this.container.replaceChildren(spacer, ...this.filtered.slice(start, end).map((item, offset) => this.button(item, start + offset, true)))
    this.renderedVirtualItems = this.filtered
    this.renderedVirtualStart = start
    this.renderedVirtualEnd = end
  }
}
