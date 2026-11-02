import { createElement, type IconNode } from 'lucide'
import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'

/** Fills a paired comparison tile heading with the star's scene-color swatch and name. */
export function renderComparisonName(target: HTMLElement, star: Star, mode: StarColorMode): void {
  target.classList.add('comparison-tile-name')
  const swatch = document.createElement('i')
  swatch.className = 'star-swatch'
  swatch.style.background = starDisplayColor(star, mode).getStyle()
  swatch.setAttribute('aria-hidden', 'true')
  const name = document.createElement('span')
  name.textContent = star.name
  target.replaceChildren(swatch, name)
}

// A bar segment from `from` to `to` (percent), or a gradient track with the marker in the object's color,
// with an optional marker for the object itself, a caption above it and end labels beside it.
interface FactBar { from?: number; to?: number; gradient?: string; marker?: number; caption?: string; ends?: readonly [string, string] }
export interface Fact { title: string; icon: IconNode; value: string; unit: string; notes: string[]; bar?: FactBar }

/** One horizontal row per quantity, with a value cell for each shown object. */
export function renderFact(facts: Fact[], objects: Star[], colorMode: StarColorMode, glow: boolean): HTMLElement {
  const comparing = objects.length > 1
  // Paired values share a font size, so a long value in either cell shrinks both.
  const long = facts.some((fact) => fact.value.length > (comparing ? 6 : 10))
  const row = document.createElement('div')
  row.className = `planet-fact-tile mass-fact${glow ? ' luminosity-result' : ''}`
  row.setAttribute('role', 'group')
  row.setAttribute('aria-label', facts.map((fact, index) => `${objects[index]!.name}: ${fact.title} ${fact.value} ${fact.unit}`.trim()).join('. '))
  if (glow) row.style.setProperty('--luminosity-real-color', starDisplayColor(objects[0]!, 'real').getStyle())
  const icon = document.createElement('span')
  icon.className = 'luminosity-factor-icon mass-fact-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.append(createElement(facts[0]!.icon, { width: 28, height: 28, 'stroke-width': 1.3, 'aria-hidden': 'true' }))
  // One title per row; paired objects can show different quantities (e.g. lifetime and burn rate).
  const title = document.createElement('h3')
  title.className = 'luminosity-factor-title mass-fact-title'
  title.textContent = [...new Set(facts.map((fact) => fact.title))].join(' · ')
  // Single rows lay the icon and title out separately; paired rows show them as a centered header.
  const header = document.createElement('div')
  header.className = 'mass-fact-header'
  header.append(icon, title)
  row.append(header, ...facts.map((fact, index) => {
    const cell = document.createElement('div')
    cell.className = 'mass-fact-cell'
    if (comparing) {
      const name = document.createElement('span')
      name.className = 'luminosity-factor-name'
      renderComparisonName(name, objects[index]!, colorMode)
      cell.append(name)
    }
    const quantity = document.createElement('div')
    quantity.className = 'luminosity-factor-quantity'
    const value = document.createElement('strong')
    value.textContent = fact.value
    value.classList.toggle('luminosity-long-value', long)
    quantity.append(value)
    if (fact.unit) {
      const unit = document.createElement('span')
      unit.className = 'luminosity-factor-unit'
      unit.textContent = fact.unit
      quantity.append(unit)
    }
    const notes = document.createElement('div')
    notes.className = 'mass-fact-notes'
    if (fact.bar?.caption) {
      const caption = document.createElement('small')
      caption.className = 'mass-benchmark'
      caption.textContent = fact.bar.caption
      notes.append(caption)
    }
    if (fact.bar) {
      const bar = document.createElement('div')
      bar.className = 'mass-fact-bar'
      const track = document.createElement('div')
      track.className = 'mass-ratio-track mass-fact-progress'
      track.setAttribute('aria-hidden', 'true')
      if (fact.bar.gradient) track.style.background = fact.bar.gradient
      else {
        const fill = document.createElement('span')
        fill.className = 'mass-ratio-fill'
        fill.style.left = `${fact.bar.from ?? 0}%`
        fill.style.width = `${(fact.bar.to ?? 0) - (fact.bar.from ?? 0)}%`
        track.append(fill)
      }
      if (fact.bar.marker !== undefined) {
        const marker = document.createElement('span')
        marker.className = 'mass-ratio-marker'
        marker.style.left = `${fact.bar.marker}%`
        if (fact.bar.gradient) marker.style.background = starDisplayColor(objects[index]!, colorMode).getStyle()
        track.append(marker)
      }
      const [low, high] = fact.bar.ends ?? []
      const end = (text: string) => {
        const label = document.createElement('small')
        label.className = 'mass-benchmark'
        label.textContent = text
        return label
      }
      bar.append(...(low ? [end(low)] : []), track, ...(high ? [end(high)] : []))
      notes.append(bar)
    }
    for (const text of fact.notes.filter(Boolean)) {
      const note = document.createElement('small')
      note.className = 'mass-benchmark'
      note.textContent = text
      notes.append(note)
    }
    cell.append(quantity, notes)
    return cell
  }))
  return row
}
