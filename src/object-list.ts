import type { Star } from './catalog'
import { formatDistance, sunRelativeMetrics, temperatureToColor, type DistanceUnit } from './astronomy'

const VIRTUAL_THRESHOLD = 200
const ROW_HEIGHT = 48
const OVERSCAN = 4

export function normalizeObjectSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function virtualRange(scrollTop: number, viewportHeight: number, count: number): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  return { start, end }
}

interface ObjectListItem {
  star: Star
  distancePc: number
  search: string
}

export class ObjectList {
  private readonly container: HTMLElement
  private items: ObjectListItem[] = []
  private filtered: ObjectListItem[] = []
  private selectedId: string | null = null
  private unit: DistanceUnit = 'ly'

  constructor(container: HTMLElement, onSelect: (id: string) => void) {
    this.container = container
    container.addEventListener('scroll', () => this.render())
    container.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-star]')
      if (button) onSelect(button.dataset.star!)
    })
  }

  setStars(stars: readonly Star[], unit: DistanceUnit, selectedId: string | null): void {
    const sun = stars.find((star) => star.id === 'sun')!
    this.items = stars.map((star) => ({
      star,
      distancePc: sunRelativeMetrics(star, sun).distancePc,
      search: normalizeObjectSearch(`${star.name} ${star.id} ${star.spectral_type ?? ''}`),
    }))
    this.filtered = this.items
    this.unit = unit
    this.selectedId = selectedId
    this.container.scrollTop = 0
    this.render()
  }

  setQuery(query: string): void {
    const normalized = normalizeObjectSearch(query)
    this.filtered = normalized ? this.items.filter((item) => item.search.includes(normalized)) : this.items
    this.container.scrollTop = 0
    this.render()
  }

  setDistanceUnit(unit: DistanceUnit): void {
    this.unit = unit
    this.render()
  }

  setSelected(id: string | null, reveal = false): void {
    this.selectedId = id
    if (reveal && id) {
      const index = this.filtered.findIndex((item) => item.star.id === id)
      if (index >= 0 && this.filtered.length > VIRTUAL_THRESHOLD) {
        const top = index * ROW_HEIGHT
        if (top < this.container.scrollTop || top + ROW_HEIGHT > this.container.scrollTop + this.container.clientHeight) {
          this.container.scrollTop = Math.max(0, top - this.container.clientHeight / 2 + ROW_HEIGHT / 2)
        }
      }
    }
    this.render()
  }

  private button(item: ObjectListItem, index: number, virtual: boolean): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'catalog-entry'
    button.classList.toggle('is-selected', item.star.id === this.selectedId)
    button.dataset.star = item.star.id
    button.setAttribute('aria-label', `Select ${item.star.name}`)
    button.setAttribute('aria-pressed', String(item.star.id === this.selectedId))
    if (virtual) {
      button.style.position = 'absolute'
      button.style.transform = `translateY(${index * ROW_HEIGHT}px)`
    }
    const swatch = document.createElement('span')
    swatch.className = 'star-swatch'
    swatch.style.background = temperatureToColor(item.star.temperature_k).getStyle()
    swatch.setAttribute('aria-hidden', 'true')
    const name = document.createElement('span')
    name.className = 'catalog-name'
    name.textContent = item.star.name
    const distance = document.createElement('span')
    distance.className = 'catalog-distance'
    distance.textContent = formatDistance(item.distancePc, this.unit)
    button.append(swatch, name, distance)
    return button
  }

  private render(): void {
    const virtual = this.filtered.length > VIRTUAL_THRESHOLD
    this.container.classList.toggle('is-virtualized', virtual)
    if (!virtual) {
      this.container.replaceChildren(...this.filtered.map((item, index) => this.button(item, index, false)))
      return
    }
    const { start, end } = virtualRange(this.container.scrollTop, this.container.clientHeight || 320, this.filtered.length)
    const spacer = document.createElement('div')
    spacer.className = 'catalog-virtual-spacer'
    spacer.style.height = `${this.filtered.length * ROW_HEIGHT}px`
    this.container.replaceChildren(spacer, ...this.filtered.slice(start, end).map((item, offset) => this.button(item, start + offset, true)))
  }
}