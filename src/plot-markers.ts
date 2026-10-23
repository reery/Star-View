import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'

export type PlotPoint = { name: string; position: number; object?: Star; value?: string; inlineValue?: boolean; detail?: string; role?: string }

/**
 * Share the same compact, collision-aware label layout across the Luminosity and Mass plots.
 * `spread` places all labels on one row across the full width with elbow leader lines,
 * falling back to stacked rows when they do not fit.
 */
export function renderPlotMarkers(bar: HTMLElement, points: PlotPoint[], colorMode: StarColorMode, spread = false): void {
  const track = bar.querySelector<HTMLElement>('.mass-ratio-track')!
  track.querySelectorAll('.luminosity-plot-marker').forEach((marker) => marker.remove())
  bar.style.setProperty('--luminosity-label-space', '0px')
  const width = track.getBoundingClientRect().width
  bar.style.setProperty('--luminosity-label-max', `${width}px`)
  const placed = points.map((point) => {
    const marker = document.createElement('span')
    marker.className = `luminosity-plot-marker ${point.object ? 'mass-ratio-marker luminosity-object-marker' : 'mass-scale-tick luminosity-orbit-tick'}`
    marker.style.left = `${point.position}%`
    marker.style.setProperty('--luminosity-marker-color', point.object ? starDisplayColor(point.object, colorMode).getStyle() : 'var(--muted)')
    marker.setAttribute('aria-hidden', 'true')
    if (point.object) marker.dataset.objectId = point.object.id
    else marker.dataset.planet = point.name
    if (point.role) marker.dataset.role = point.role
    const label = document.createElement('span')
    label.className = 'luminosity-plot-label'
    if (point.role) label.id = `${bar.id}-${point.role}-label`
    const name = document.createElement('span')
    name.textContent = point.name
    label.append(name)
    if (point.value) {
      const value = document.createElement(point.inlineValue ? 'small' : 'span')
      value.className = point.inlineValue ? 'luminosity-marker-distance' : 'luminosity-marker-value'
      value.textContent = point.value
      if (point.inlineValue) label.append(' ')
      label.append(value)
    }
    if (point.detail) {
      const detail = document.createElement('small')
      detail.className = 'luminosity-marker-detail'
      detail.textContent = point.detail
      label.append(detail)
    }
    marker.append(label)
    track.append(marker)
    const { width: labelWidth, height } = label.getBoundingClientRect()
    return { marker, label, anchor: point.position / 100 * width, width: labelWidth, height, left: 0, top: 32, fixed: !point.object }
  })
  // Center each label under its marker, dropping it below any earlier label it would overlap.
  const stack = (entries: typeof placed) => {
    const occupied: { left: number; right: number; top: number; bottom: number }[] = []
    for (const entry of entries) {
      const left = Math.max(0, Math.min(width - entry.width, entry.anchor - entry.width / 2))
      entry.label.style.transform = `translateX(${left - entry.anchor}px)`
      let top = 32
      for (const previous of occupied) {
        if (left < previous.right + 6 && left + entry.width + 6 > previous.left && top < previous.bottom + 4) top = previous.bottom + 4
      }
      entry.marker.style.setProperty('--luminosity-label-top', `${top + 3}px`)
      entry.top = top
      occupied.push({ left, right: left + entry.width, top, bottom: top + entry.height })
    }
  }
  const gap = 10
  const row = placed.filter((entry) => !entry.fixed).sort((a, b) => a.anchor - b.anchor)
  if (spread && row.reduce((total, entry) => total + entry.width + gap, -gap) <= width) {
    // Reference ticks (solar orbits) keep their labels centered under the tick; objects spread below them.
    const fixed = placed.filter((entry) => entry.fixed)
    stack(fixed)
    const jog = Math.max(37, ...fixed.map((entry) => entry.top + entry.height + 4)), top = jog + 8
    // Keep the markers' order, push neighbors apart, then pull back from the right edge.
    row.forEach((entry, index) => {
      entry.left = Math.max(0, entry.anchor - entry.width / 2, index ? row[index - 1]!.left + row[index - 1]!.width + gap : 0)
    })
    for (let index = row.length - 1; index >= 0; index--) {
      const limit = index === row.length - 1 ? width : row[index + 1]!.left - gap
      row[index]!.left = Math.min(row[index]!.left, limit - row[index]!.width)
    }
    for (const entry of row) {
      // Down, sideways to the label's center, then down to the label.
      const offset = entry.left + entry.width / 2 - entry.anchor
      entry.top = top - 3
      entry.label.style.transform = `translateX(${entry.left - entry.anchor}px)`
      entry.marker.style.setProperty('--luminosity-label-top', `${top}px`)
      if (Math.abs(offset) < 2) continue
      // The vertical stub stops 3px short of its target, so aim it 3px lower to meet the elbow.
      entry.marker.style.setProperty('--luminosity-leader-top', `${jog + 3}px`)
      const leader = document.createElement('span')
      leader.className = `luminosity-plot-leader ${offset > 0 ? 'is-right' : 'is-left'}`
      leader.style.top = `${jog}px`
      leader.style.height = `${top - jog}px`
      leader.style.left = `calc(50% + ${Math.min(0, offset)}px)`
      leader.style.width = `${Math.abs(offset)}px`
      entry.marker.append(leader)
    }
  } else stack(placed)
  const naturalHeight = bar.getBoundingClientRect().height
  const bottom = Math.max(naturalHeight, ...placed.map((entry) => entry.top + entry.height))
  bar.style.setProperty('--luminosity-label-space', `${Math.max(0, bottom - naturalHeight) + 2}px`)
}
