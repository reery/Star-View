import type { Star } from './catalog-model'
import { placeSpectralMarkerLabels, spectralMarker, svgNode, temperaturePalette } from './spectral-chart'

import { spectralClasses, luminosityRows, mkPoint, whiteDwarfClassification, whiteDwarfDiagramTemperature, whiteDwarfFamilies, type MkPoint } from './mk-properties'
export { mkPoint, whiteDwarfClassification, type MkPoint } from './mk-properties'
export { renderSpectralFeatures } from './spectral-type'

export function renderMkDiagram(card: HTMLElement, star: Star, reference: Star): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const point = mkPoint(star), referencePoint = mkPoint(reference)
  const same = star.id === reference.id
  card.querySelector('.mk-stats')!.classList.toggle('is-reference', same)
  for (const [prefix, object, classification] of [['selected', star, point], ['reference', reference, referencePoint]] as const) {
    get(`mk-${prefix}-name`).textContent = object.name
    get(`mk-${prefix}-type`).textContent = object.spectral_type ?? 'Not available'
    get(`mk-${prefix}-class`).textContent = classification?.luminosityClass ?? (object.type === 'white_dwarf' ? 'Not applicable' : 'Not available')
  }
  const unavailable = (object: Star, classification: MkPoint | null) => classification ? ''
    : object.type === 'white_dwarf' ? whiteDwarfClassification(object) ? '' : `${object.name} has no supported white-dwarf D classification in the catalog.`
      : object.type === 'brown_dwarf' || object.type === 'sub_brown_dwarf' ? `${object.name} uses a substellar spectral classification, outside this M-K grid.`
        : /[+]\s*(?:[OBAFGKM]|D[A-Z]|W[CN])/i.test(object.spectral_type ?? '') ? `${object.name} has a composite spectrum; individual stellar components need separate classifications.`
          : /^[OBAFGKM]\d(?:\.\d+)?[?:]?$/i.test(object.spectral_type?.trim() ?? '') ? `${object.name}: luminosity class is not recorded for ${object.spectral_type}; no vertical M-K position can be assigned.`
        : `${object.name} has no supported explicit O–M subtype and luminosity class in the catalog.`
  const note = get('mk-missing')
  note.textContent = [...new Set([unavailable(star, point), unavailable(reference, referencePoint)])].filter(Boolean).join(' ')
  note.hidden = !note.textContent
  const svg = svgNode('svg', { viewBox: '0 0 400 430', role: 'img', 'aria-labelledby': 'mk-title', 'aria-describedby': 'mk-description' })
  svg.append(svgNode('title', { id: 'mk-title' }, `Morgan–Keenan diagram: ${star.name}${same ? '' : ` and ${reference.name}`}`),
    svgNode('desc', { id: 'mk-description' }, `Spectral type O through M, left to right. Luminosity class Ia+ through VI, top to bottom. These are classification categories, not equally spaced magnitudes. ${star.name}: ${star.spectral_type ?? 'unknown'}. ${same ? '' : `${reference.name}: ${reference.spectral_type ?? 'unknown'}.`} ${note.textContent}`))
  const left = 54, top = 50, size = 330, band = size / spectralClasses.length, rowHeight = size / luminosityRows.length
  const label = (content: string, x: number, y: number, className = 'hr-axis-text', anchor = 'middle', parent: SVGElement = svg) => {
    const text = svgNode('text', { x, y, class: className, 'text-anchor': anchor }, content)
    parent.append(text)
    return text
  }
  const palette = ['#648cff', '#91b7ff', '#d9e5ff', '#fff3d3', '#ffe291', '#ffa95e', '#ee5b42']
  for (let index = 0; index < spectralClasses.length; index++) {
    svg.append(svgNode('rect', { x: left + index * band, y: top, width: band, height: size, fill: palette[index]!, opacity: 0.18 }))
    svg.append(svgNode('line', { x1: left + index * band, x2: left + index * band, y1: top, y2: top + size, class: 'hr-grid' }))
    label(spectralClasses[index]!, left + (index + 0.5) * band, top + size + 26, 'hr-spectral-text')
    label('0–9', left + (index + 0.5) * band, top - 10)
  }
  luminosityRows.forEach(([luminosityClass, name], index) => {
    const y = top + index * rowHeight
    if (index % 2 === 0) svg.append(svgNode('rect', { x: left, y, width: size, height: rowHeight, fill: '#ffffff05' }))
    svg.append(svgNode('line', { x1: left, x2: left + size, y1: y, y2: y, class: 'hr-grid' }))
    label(luminosityClass, left - 9, y + rowHeight / 2 + 4, 'hr-axis-text', 'end')
    label(name, left + 8, y + 16, 'mk-region-text', 'start')
  })
  svg.append(svgNode('rect', { x: left, y: top, width: size, height: size, class: 'hr-frame' }))
  label('Spectral subtype', left + size / 2, 17)
  label('Spectral type', left + size / 2, 423)
  const vertical = label('Luminosity class', 14, top + size / 2)
  vertical.setAttribute('transform', `rotate(-90 14 ${top + size / 2})`)
  const referenceX = referencePoint ? left + size * referencePoint.x : null
  const referenceY = referencePoint ? top + size * referencePoint.y : null
  const mark = (object: Star, classification: MkPoint, selected: boolean) => {
    const x = left + size * classification.x, y = top + size * classification.y
    const group = spectralMarker(object, x, y, selected, 'mk', object.spectral_type!)
    const nearby = !same && referenceX !== null && referenceY !== null && point !== null && Math.hypot(left + size * point.x - referenceX, top + size * point.y - referenceY) < 28
    if (!selected && nearby) group.querySelector('circle')!.setAttribute('r', '18')
    const rightAligned = x > left + size * 0.7
    const shortName = object.name.length > 22 ? `${object.name.slice(0, 21)}…` : object.name
    label(shortName, x + (rightAligned ? -17 : 17), y + (selected ? -19 : 27), 'hr-marker-text', rightAligned ? 'end' : 'start', group)
    svg.append(group)
  }
  if (!same && referencePoint) mark(reference, referencePoint, false)
  if (point) mark(star, point, true)
  get('mk-diagram').replaceChildren(svg)
  placeSpectralMarkerLabels(svg, { left, top, right: left + size, bottom: top + size })
}

// Temperatures in kelvin where each white-dwarf family is observed, hot to cool;
// `true` marks sparsely populated ranges. Rows run down the cooling cascade.
// Bédard (2024), Ap&SS 369, 43: https://doi.org/10.1007/s10509-024-04307-5
const coolingRows: readonly (readonly [string, readonly (readonly [number, number, boolean?])[]])[] = [
  ['DO', [[Infinity, 45_000]]],
  ['DB', [[45_000, 40_000], [40_000, 20_000, true], [20_000, 11_000]]],
  ['DQ', [[25_000, 10_000, true], [10_000, 5_000]]],
  ['DZ', [[11_000, 0]]],
  ['DC', [[11_000, 0]]],
  ['DA', [[Infinity, 5_000]]],
]
const coolingTransitions = [
  [45_000, 'DO', ['DB'], 'Below about 45,000 K, ionized helium lines give way to neutral helium: DO becomes DB.'],
  [11_000, 'DB', ['DQ', 'DZ', 'DC'], 'Below about 11,000 K, helium lines vanish: DB becomes DC, or DQ or DZ where carbon or metals show.'],
  [5_000, 'DA', ['DC'], 'Below about 5,000 K, hydrogen lines vanish: DA becomes DC.'],
] as const

export function renderWhiteDwarfDiagram(card: HTMLElement, star: Star, reference: Star, population: readonly Star[]): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const same = star.id === reference.id || reference.type !== 'white_dwarf'
  const objects = same ? [[star, true]] as const : [[star, true], [reference, false]] as const
  const place = (object: Star) => {
    const row = coolingRows.findIndex(([family]) => family === whiteDwarfClassification(object)?.family)
    const temperature = whiteDwarfDiagramTemperature(object)
    return row >= 0 && temperature ? { row, ...temperature } : null
  }
  card.querySelector('.wd-stats')!.classList.toggle('is-reference', same)
  const notes: string[] = []
  for (const [object, selected] of objects) {
    const prefix = selected ? 'selected' : 'reference'
    const temperature = whiteDwarfDiagramTemperature(object)
    get(`wd-${prefix}-name`).textContent = object.name
    get(`wd-${prefix}-type`).textContent = object.spectral_type ?? 'Not available'
    get(`wd-${prefix}-temperature`).textContent = !temperature ? 'Not available'
      : temperature.fromIndex ? `≈ ${(Math.round(temperature.temperature / 100) * 100).toLocaleString('en-US')} K (type index)`
        : `${Math.round(temperature.temperature).toLocaleString('en-US')} K`
    const family = whiteDwarfClassification(object)?.family
    if (!family || family === 'DX') notes.push(`${object.name} has no family row: ${family ? 'its spectrum is unclassifiable (DX)' : 'no supported D classification in the catalog'}.`)
    else if (!temperature) notes.push(`${object.name} cannot be placed: no catalog temperature or temperature index.`)
  }
  const note = get('wd-missing')
  note.textContent = notes.join(' ')
  note.hidden = !note.textContent

  const point = place(star), referencePoint = same ? null : place(reference)
  const extremes = [point, referencePoint].flatMap((value) => value ? [value.temperature] : [])
  const hot = Math.max(150_000, ...extremes.map((value) => value * 1.15)), cool = Math.min(3_000, ...extremes.map((value) => value / 1.15))
  const left = 54, top = 50, size = 330, bottom = top + size, rowHeight = size / coolingRows.length
  const x = (temperature: number) => left + size * Math.log10(hot / Math.min(hot, Math.max(cool, temperature))) / Math.log10(hot / cool)
  const bandY = (row: number) => top + row * rowHeight + 34
  const svg = svgNode('svg', { viewBox: '0 0 400 410', role: 'img', 'aria-labelledby': 'wd-title', 'aria-describedby': 'wd-description' })
  const describe = (object: Star, value: typeof point) => value ? `${object.name}: ${coolingRows[value.row]![0]}, about ${Math.round(value.temperature).toLocaleString('en-US')} K.` : ''
  svg.append(svgNode('title', { id: 'wd-title' }, `White-dwarf cooling diagram: ${star.name}${same ? '' : ` and ${reference.name}`}`),
    svgNode('desc', { id: 'wd-description' }, `White-dwarf spectral families by temperature, which decreases from ${hot.toLocaleString('en-US')} to ${cool.toLocaleString('en-US')} kelvin, left to right. Bands show where each family is observed. ${describe(star, point)} ${describe(reference, referencePoint)} ${note.textContent}`))
  const label = (content: string, px: number, py: number, className = 'hr-axis-text', anchor = 'middle', parent: SVGElement = svg) => {
    const text = svgNode('text', { x: px, y: py, class: className, 'text-anchor': anchor }, content)
    parent.append(text)
    return text
  }
  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: 'wd-temperature-gradient', gradientUnits: 'userSpaceOnUse', x1: left, x2: left + size, y1: 0, y2: 0 })
  for (const [temperature, color] of temperaturePalette) gradient.append(svgNode('stop', { offset: `${(x(temperature) - left) / size * 100}%`, 'stop-color': color }))
  const arrow = svgNode('marker', { id: 'wd-transition-arrow', viewBox: '0 0 6 6', refX: 5, refY: 3, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' })
  arrow.append(svgNode('path', { d: 'M 0 0 L 6 3 L 0 6 z', class: 'wd-transition-head' }))
  defs.append(gradient, arrow)
  svg.append(defs, svgNode('rect', { x: left, y: top, width: size, height: size, fill: '#0b0e14' }))
  const selectedFamily = point ? coolingRows[point.row]![0] : whiteDwarfClassification(star)?.family
  coolingRows.forEach(([family, ranges], row) => {
    const y = top + row * rowHeight
    if (row % 2 === 0) svg.append(svgNode('rect', { x: left, y, width: size, height: rowHeight, fill: '#ffffff05' }))
    svg.append(svgNode('line', { x1: left, x2: left + size, y1: y, y2: y, class: 'hr-grid' }))
    label(family, left - 9, bandY(row) + 5, `hr-spectral-text${family === selectedFamily ? ' is-selected' : ''}`, 'end')
    label(whiteDwarfFamilies.find(([name]) => name === family)![1], left + 8, y + 17, 'mk-region-text', 'start')
    for (const [from, to, rare] of ranges) {
      const x1 = x(from), x2 = x(to)
      svg.append(svgNode('rect', { x: x1, y: bandY(row) - 8, width: x2 - x1, height: 16, rx: 4, fill: 'url(#wd-temperature-gradient)', class: `wd-band${rare ? ' is-rare' : ''}` }))
    }
  })
  for (const temperature of [100_000, 50_000, 20_000, 10_000, 5_000]) {
    svg.append(svgNode('line', { x1: x(temperature), x2: x(temperature), y1: top, y2: bottom, class: 'hr-grid' }))
    label(temperature.toLocaleString('en-US'), x(temperature), top - 10)
  }
  // Other loaded white dwarfs, spread vertically inside their band.
  const dots = population.flatMap((object, index) => {
    if (object.type !== 'white_dwarf' || object.id === star.id || object.id === reference.id) return []
    const value = place(object)
    return value ? [`M ${x(value.temperature)},${bandY(value.row) + ((index * 7) % 11) - 5} h 0`] : []
  })
  if (dots.length) svg.append(svgNode('path', { d: dots.join(' '), class: 'hr-dot wd-dot' }))
  for (const [temperature, from, targets, description] of coolingTransitions) {
    const source = coolingRows.findIndex(([family]) => family === from)
    const group = svgNode('g', { class: 'wd-transition' })
    group.append(svgNode('title', {}, description))
    for (const target of targets) {
      const row = coolingRows.findIndex(([family]) => family === target), down = row > source
      group.append(svgNode('line', { x1: x(temperature), x2: x(temperature), y1: bandY(source) + (down ? 9 : -9), y2: bandY(row) + (down ? -10 : 10), 'marker-end': 'url(#wd-transition-arrow)' }))
    }
    svg.append(group)
  }
  svg.append(svgNode('rect', { x: left, y: top, width: size, height: size, class: 'hr-frame' }))
  label('Temperature (K)', left + size / 2, 17)
  label('Cooling over billions of years →', left + size / 2, bottom + 24)
  const vertical = label('Spectral family', 14, top + size / 2)
  vertical.setAttribute('transform', `rotate(-90 14 ${top + size / 2})`)
  const mark = (object: Star, value: NonNullable<typeof point>, selected: boolean) => {
    const px = x(value.temperature), py = bandY(value.row)
    const group = spectralMarker(object, px, py, selected, 'mk', `${object.spectral_type} · ${Math.round(value.temperature).toLocaleString('en-US')} K`)
    const rightAligned = px > left + size * 0.7
    const shortName = object.name.length > 22 ? `${object.name.slice(0, 21)}…` : object.name
    label(shortName, px + (rightAligned ? -17 : 17), py + (selected ? -19 : 27), 'hr-marker-text', rightAligned ? 'end' : 'start', group)
    svg.append(group)
  }
  if (referencePoint) mark(reference, referencePoint, false)
  if (point) mark(star, point, true)
  get('wd-diagram').replaceChildren(svg)
  placeSpectralMarkerLabels(svg, { left, top, right: left + size, bottom })
}
