import type { Star } from './catalog-model'
import { placeSpectralMarkerLabels, spectralMarker, starIcon, svgNode } from './spectral-chart'

const spectralClasses = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const
const luminosityRows = [
  ['Ia+', 'Hypergiants'], ['Ia', 'Luminous supergiants'], ['Ib', 'Supergiants'],
  ['II', 'Bright giants'], ['III', 'Giants'], ['IV', 'Subgiants'],
  ['V', 'Main sequence'], ['VI', 'Subdwarfs'],
] as const
const classPositions: Record<string, number> = { 'IA+': 0, IA: 1, IAB: 1.5, IB: 2, I: 1.5, II: 3, III: 4, IV: 5, V: 6, VI: 7 }
export interface MkPoint { spectralClass: string; subtype: number; luminosityClass: string; x: number; y: number }

// White-dwarf D families describe spectra, not M-K luminosity classes.
// McCook–Sion catalog: https://heasarc.gsfc.nasa.gov/W3Browse/all/mcksion.html
const whiteDwarfFamilies = [
  ['DA', 'Hydrogen lines'], ['DB', 'Neutral helium lines'], ['DC', 'Featureless spectrum'],
  ['DO', 'Ionized helium lines'], ['DQ', 'Carbon features'], ['DZ', 'Metal lines'],
  ['DX', 'Peculiar or unclassifiable spectrum'],
] as const

export function whiteDwarfClassification(star: Pick<Star, 'type' | 'spectral_type'>): { family: string; spectralType: string; description: string } | null {
  if (star.type !== 'white_dwarf') return null
  const spectralType = star.spectral_type?.trim()
  const classification = spectralType?.match(/^D([ABCOQZX])[ABCOQZXHPEV]*(?:\d+(?:\.\d+)?)?(?:[?:]|pec)?$/i)
  if (!classification || !spectralType) return null
  const family = `D${classification[1]!.toUpperCase()}`
  const description = whiteDwarfFamilies.find(([type]) => type === family)![1]
  return { family, spectralType, description }
}

function renderWhiteDwarfClassification(card: HTMLElement, star: Star, reference: Star): void {
  const selectedClass = whiteDwarfClassification(star), referenceClass = whiteDwarfClassification(reference)
  const families = whiteDwarfFamilies.map(([family, description]) => {
    const cell = document.createElement('div')
    cell.className = 'white-dwarf-family'
    cell.dataset.family = family
    cell.setAttribute('role', 'listitem')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'white-dwarf-family-help'
    button.textContent = family
    const tooltip = document.createElement('span')
    tooltip.id = `white-dwarf-${family.toLowerCase()}-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip white-dwarf-family-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = description
    button.setAttribute('aria-describedby', tooltip.id)
    cell.append(button, tooltip)
    cell.classList.toggle('is-selected', selectedClass?.family === family)
    cell.classList.toggle('is-reference', star.id !== reference.id && referenceClass?.family === family)
    return cell
  })
  card.querySelector('#white-dwarf-families')!.replaceChildren(...families)
  const rows: HTMLElement[] = []
  for (const [object, selected] of [[star, true], [reference, false]] as const) {
    if (object.type !== 'white_dwarf' || (!selected && star.id === reference.id)) continue
    const classification = whiteDwarfClassification(object)
    const familyIndex = whiteDwarfFamilies.findIndex(([family]) => family === classification?.family)
    const row = document.createElement('div')
    row.className = `white-dwarf-star is-${selected ? 'selected' : 'reference'}`
    row.dataset.family = classification?.family ?? ''
    row.title = classification?.description ?? 'White-dwarf spectral classification not available'
    const icon = document.createElement('span')
    icon.className = 'white-dwarf-star-icon'
    const image = document.createElement('img')
    image.src = starIcon(object)
    image.alt = ''
    icon.append(image)
    const name = document.createElement('span')
    name.className = 'white-dwarf-star-name'
    name.textContent = object.name
    if (familyIndex >= 0) {
      icon.style.gridColumn = String(familyIndex + 1)
      const labelOnLeft = familyIndex >= whiteDwarfFamilies.length / 2
      name.style.gridColumn = labelOnLeft ? `1 / ${familyIndex + 1}` : `${familyIndex + 2} / -1`
      name.style.justifySelf = labelOnLeft ? 'end' : 'start'
    } else {
      row.classList.add('is-unclassified')
    }
    row.append(icon, name)
    rows.push(row)
  }
  card.querySelector('#white-dwarf-stars')!.replaceChildren(...rows)
}

// MK is a classification from spectra, not a conversion from H–R coordinates.
// Morgan, Abt & Tapscott (1978), terminology and autonomous standard grid:
// https://ned.ipac.caltech.edu/level5/March02/Morgan/Morgan1.html
export function mkPoint(star: Pick<Star, 'type' | 'spectral_type'>): MkPoint | null {
  if (star.type !== 'star') return null
  if (/[+/-]\s*[OBAFGKM]\d/i.test(star.spectral_type ?? '')) return null
  const luminosity = '(Iab|Ia\\+?|Ib|III|II|IV|VI|V|I)'
  // Am notation (e.g. A0mA1Va): place the star by its metallic-line type, as for Sirius A's usual A1V.
  const spectralType = star.spectral_type?.trim()
    .replace(/^k[OBAFGKM]\d(?:\.\d+)?h([OBAFGKM]\d(?:\.\d+)?)(?:m[OBAFGKM]\d(?:\.\d+)?)?/i, '$1')
    .replace(/^[OBAFGKM]\d(?:\.\d+)?m([OBAFGKM]\d(?:\.\d+)?)/i, '$1')
  const spectral = spectralType?.match(new RegExp(`^([OBAFGKM])(\\d(?:\\.\\d+)?)[?:\\s-]*\\(?\\s*${luminosity}(?:[-/]${luminosity})?(?=$|[^IV])`, 'i'))
  if (!spectral) return null
  const spectralClass = spectral[1]!.toUpperCase()
  const subtype = Number(spectral[2])
  if (!Number.isFinite(subtype) || subtype < 0 || subtype >= 10) return null
  const canonicalClass = (value: string) => value.toUpperCase().replace('IAB', 'Iab').replace('IA', 'Ia').replace('IB', 'Ib')
  const firstClass = canonicalClass(spectral[3]!)
  const secondClass = spectral[4] ? canonicalClass(spectral[4]) : null
  const row = classPositions[firstClass.toUpperCase()]!
  const lastRow = secondClass ? classPositions[secondClass.toUpperCase()]! : row
  return {
    spectralClass, subtype, luminosityClass: secondClass ? `${firstClass}–${secondClass}` : firstClass,
    x: (spectralClasses.indexOf(spectralClass as typeof spectralClasses[number]) + subtype / 10) / spectralClasses.length,
    y: ((row + lastRow) / 2 + 0.5) / luminosityRows.length,
  }
}

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
  renderWhiteDwarfClassification(card, star, reference)
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
