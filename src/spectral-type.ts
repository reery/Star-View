import type { Star } from './catalog-model'
import { luminosityRows, whiteDwarfFamilies } from './mk-properties'
import { svgNode } from './spectral-chart'

export interface SpectralPart { text: string; meaning: string }
export interface SpectralReading {
  parts: SpectralPart[]
  /** Leading Harvard class and subtype; for Am stars, the hydrogen-line type when given. */
  letter: string | null
  subtype: number | null
  /** White-dwarf feature letters after the D, primary first (e.g. "AZ"). */
  whiteDwarf: string | null
}

const classMeanings: Record<string, string> = {
  O: 'Hottest blue stars: ionized helium lines',
  B: 'Blue-white stars: neutral helium lines',
  A: 'White stars: the strongest hydrogen lines',
  F: 'Yellow-white stars: calcium lines grow as hydrogen fades',
  G: 'Yellow stars like the Sun: strong calcium and metal lines',
  K: 'Orange stars: metal lines dominate',
  M: 'Red stars: titanium-oxide molecular bands',
  L: 'Very cool dwarfs: metal hydrides and alkali metals',
  T: 'Cool brown dwarfs: methane absorption',
  Y: 'The coldest brown dwarfs: ammonia absorption',
}
const prefixes: Record<string, string> = {
  d: 'Dwarf: an older prefix for main-sequence stars',
  g: 'Giant: an older prefix for luminosity class III',
  sd: 'Subdwarf: poor in metals, just below the main sequence',
  esd: 'Extreme subdwarf: very poor in metals',
  usd: 'Ultra subdwarf: extremely poor in metals',
  'd/sd': 'Dwarf or subdwarf',
}
const luminosityNames: Record<string, string> = { ...Object.fromEntries(luminosityRows), Iab: 'Intermediate supergiants', I: 'Supergiants' }
const luminosityParts: Record<string, string> = { a: ', brighter part', ab: ', middle part', b: ', fainter part' }
const amTypes: Record<string, string> = { k: 'Type from the calcium K line', h: 'Type from the hydrogen lines', m: 'Type from the metal lines' }
const indexNames: Record<string, string> = {
  Fe: 'Iron lines', CN: 'Cyanogen (CN) bands', CH: 'CH molecular band', Ca: 'Calcium lines', Ba: 'Barium lines',
  Hdel: 'Hydrogen Hδ line', C2: 'Carbon (C₂) bands', Sr: 'Strontium lines', Mg: 'Magnesium lines', Cr: 'Chromium lines',
}
const elements: Record<string, string> = { Sr: 'strontium', Cr: 'chromium', Eu: 'europium', Si: 'silicon', Hg: 'mercury', Mn: 'manganese' }
const whiteDwarfFlags: Record<string, string> = { H: 'Magnetic field splits the lines', P: 'Magnetic, with polarized light', E: 'Emission lines', V: 'Variable: the star pulsates' }
const gravity: Record<string, string> = {
  alpha: 'Normal surface gravity', beta: 'Low surface gravity: a young object',
  gamma: 'Very low surface gravity: a very young object', delta: 'Extremely low surface gravity: a very young object',
}
const luminosity = 'Ia\\+|Iab|Ia|Ib|III|II|IV|VI|V|I'
const luminosityPattern = new RegExp(`\\(?(${luminosity})(ab|a|b)?(?:[-/](${luminosity})(ab|a|b)?)?\\)?`, 'y')

/** Splits a catalog spectral type into M-K parts and common suffixes, keeping unknown notation as written. */
export function readSpectralType(type: string | null): SpectralReading {
  const text = type?.trim() ?? ''
  const reading: SpectralReading = { parts: [], letter: null, subtype: null, whiteDwarf: null }
  let index = 0
  const add = (part: string, meaning: string) => reading.parts.push({ text: part, meaning })
  const take = (pattern: RegExp) => {
    pattern.lastIndex = index
    const match = pattern.exec(text)
    if (match) index += match[0].length
    return match
  }
  let match = take(/([<>])\s*/y)
  if (match) add(match[1]!, match[1] === '>' ? 'Later (cooler) than the type that follows' : 'Earlier (hotter) than the type that follows')
  if ((match = take(/(?:d\/sd|esd|usd|sd|d|g)(?=[A-Z])/y))) add(match[0], prefixes[match[0]]!)
  if ((match = take(/D([ABCOQZX]*)([HPEV]*)(\d+(?:\.\d+)?)?([HPEV]*)/y))) {
    const [, families = '', leadingFlags = '', temperatureIndex, trailingFlags = ''] = match
    const flags = leadingFlags + trailingFlags
    add('D', 'White dwarf: a dense stellar remnant')
    reading.whiteDwarf = families
    for (const [position, family] of [...families].entries()) {
      const description = whiteDwarfFamilies.find(([name]) => name === `D${family}`)![1]
      add(family, position ? `Also: ${description.toLowerCase()}` : family === 'C' ? 'No strong lines: a featureless spectrum' : `Strongest features: ${description.toLowerCase()}`)
    }
    for (const flag of flags) add(flag, whiteDwarfFlags[flag]!)
    if (temperatureIndex && Number(temperatureIndex) > 0) {
      add(temperatureIndex, `Temperature index: about ${(Math.round(50_400 / Number(temperatureIndex) / 100) * 100).toLocaleString('en-US')} K`)
    }
  }
  const rules: [RegExp, (match: RegExpExecArray) => boolean | void][] = [
    [/[\s_]+/y, () => {}],
    [/\+\/-(\d+(?:\.\d+)?)/y, (match) => add(match[0], `Uncertain by about ${match[1]} subtype${match[1] === '1' ? '' : 's'}`)],
    [/\+\s*((?:sd|d)?[OBAFGKMLTYD].*)$/y, (match) => add(`+ ${match[1]}`, 'A second star’s spectrum blended in')],
    [/([khm])([OBAFGKM])(\d(?:\.\d+)?)/y, (match) => {
      add(match[0], amTypes[match[1]!]!)
      if (match[1] === 'h' || reading.letter === null) [reading.letter, reading.subtype] = [match[2]!, Number(match[3]!)]
    }],
    [/([OBAFGKMLTY])(\d+(?:\.\d+)?)?/y, (match) => {
      if (reading.letter !== null || reading.whiteDwarf !== null) return false
      reading.letter = match[1]!
      add(match[1]!, classMeanings[match[1]!]!)
      if (match[2]) {
        reading.subtype = Number(match[2])
        add(match[2], `Step on a 0–9 scale within class ${match[1]}; ${match[1]}0 is the hottest`)
      }
    }],
    [luminosityPattern, (match) => {
      const [, first, firstPart, second, secondPart] = match
      const name = (value: string, part?: string) => `${luminosityNames[value]!.toLowerCase()}${part ? luminosityParts[part] : ''}`
      add(match[0], second ? `Luminosity class: between ${name(first!, firstPart)} and ${name(second, secondPart)}` : `Luminosity class: ${name(first!, firstPart)}`)
    }],
    [/[+-](?=I|V|\(|k|:|$)/y, (match) => add(match[0], match[0] === '+' ? 'Slightly later (cooler) than this subtype' : 'Slightly earlier (hotter) than this subtype')],
    [/([/-])((?:[OBAFGKMLTY])?\d+(?:\.\d+)?)/y, (match) => add(match[0], match[1] === '/' ? 'Intermediate between the two types' : 'Spans a range of types')],
    [/(Fe|CN|CH|Ca|Ba|Hdel|C2|Sr|Mg|Cr)([+-]?\d+(?:\.\d+)?)/y, (match) => {
      const value = Number(match[2]!)
      add(match[0], `${indexNames[match[1]!]} ${value > 0 ? 'stronger than' : value < 0 ? 'weaker than' : 'as'} normal for this type`)
    }],
    [/(Sr|Cr|Eu|Si|Hg|Mn)/y, (match) => add(match[0], `Strong ${elements[match[0]]} lines`)],
    [/\(k\)/y, (match) => add(match[0], 'Slight calcium H & K emission: a mildly active chromosphere')],
    [/k/y, (match) => add(match[0], 'Calcium H & K emission: an active chromosphere')],
    [/\(e\)/y, (match) => add(match[0], 'Weak emission lines')],
    [/e/y, (match) => add(match[0], 'Emission lines from hot gas around the star or above its surface')],
    [/nn/y, (match) => add(match[0], 'Very broad lines: very fast rotation')],
    [/\(n\)/y, (match) => add(match[0], 'Slightly broadened lines: fast rotation')],
    [/n/y, (match) => add(match[0], 'Broad, diffuse lines: fast rotation')],
    [/pec|p/y, (match) => add(match[0], 'Peculiar spectrum')],
    [/(alpha|beta|gamma|delta)/y, (match) => add(match[0], gravity[match[0]]!)],
    [/var/y, (match) => add(match[0], 'Variable spectrum')],
    [/shell|sh/y, (match) => add(match[0], 'Shell star: absorption from a surrounding gas disk')],
    [/lB/y, (match) => add(match[0], 'λ Boötis star: metal-poor surface layers')],
    [/m/y, (match) => add(match[0], 'Metallic-line star: enhanced metal lines')],
    [/s/y, (match) => add(match[0], 'Sharp, narrow lines')],
    [/[:?]+/y, (match) => add(match[0], 'Uncertain classification')],
  ]
  while (index < text.length) {
    const start = index
    for (const [pattern, apply] of rules) {
      const found = take(pattern)
      if (!found) continue
      if (apply(found) === false) { index = start; continue }
      break
    }
    if (index === start) {
      add(text.slice(index), 'Further catalog notation')
      break
    }
  }
  return reading
}

// Typical absorption strengths (0–1) against a continuous class scale O0 = 0 … M9 = 6.9,
// rounded from the classification criteria in Gray's digital spectral classification
// atlas. Schematic only: luminosity class, rotation and composition are ignored.
// [label, wavelengths in nm, line width in nm, extra width at full strength, anchors, band direction]
type Anchors = readonly (readonly [number, number])[]
type Feature = readonly [string | null, readonly number[], number, number, Anchors, (1 | -1)?]
const balmer: Anchors = [[0.5, 0.3], [1, 0.4], [1.5, 0.65], [2, 1], [2.5, 0.95], [3, 0.8], [3.5, 0.6], [4, 0.45], [4.5, 0.35], [5, 0.3], [5.5, 0.2], [6, 0.12], [6.9, 0.08]]
const metals: Anchors = [[2.5, 0], [3, 0.15], [3.5, 0.3], [4, 0.5], [4.5, 0.65], [5, 0.8], [5.5, 0.9], [6, 0.8], [6.9, 0.6]]
const stellarFeatures: readonly Feature[] = [
  ['Hα', [656.3], 1.2, 4, balmer], ['Hβ', [486.1], 1.2, 4, balmer], ['Hγ', [434.0], 1.2, 4, balmer], ['Hδ', [410.2], 1.2, 4, balmer],
  [null, [397.0, 388.9], 1, 2.5, balmer],
  ['He II', [468.6, 454.1, 541.1], 0.8, 0.6, [[0.3, 1], [0.9, 0.4], [1, 0.15], [1.2, 0]]],
  ['He I', [447.1, 402.6, 587.6, 492.2, 501.6, 667.8], 0.8, 0.6, [[0.5, 0.35], [1, 0.8], [1.2, 1], [1.5, 0.75], [1.9, 0.3], [2, 0.1], [2.2, 0]]],
  ['Ca II', [393.4, 396.8], 1.2, 2.5, [[1.5, 0], [2, 0.2], [2.5, 0.45], [3, 0.7], [3.5, 0.85], [4, 1], [5, 1], [5.5, 0.95], [6, 0.8], [6.9, 0.6]]],
  ['Ca I', [422.7], 0.8, 0.6, [[3, 0], [4, 0.3], [4.5, 0.45], [5, 0.6], [5.5, 0.85], [6, 0.95], [6.9, 0.9]]],
  ['G band', [430.5], 1.6, 0, [[3, 0], [3.5, 0.3], [4, 0.6], [4.5, 0.8], [5, 0.9], [5.5, 0.7], [6, 0.4], [6.9, 0.2]]],
  ['Fe', [404.6, 438.4, 440.5, 495.7, 527.0, 532.8], 0.6, 0.4, metals],
  ['Mg', [517.3], 1.4, 0.6, [[2, 0], [2.5, 0.1], [3, 0.2], [3.5, 0.35], [4, 0.55], [4.5, 0.7], [5, 0.85], [5.5, 0.95], [6, 0.9], [6.9, 0.8]]],
  ['Na', [589.3], 1.2, 0.8, [[2.5, 0], [3, 0.05], [3.5, 0.15], [4, 0.35], [4.5, 0.5], [5, 0.65], [5.5, 0.8], [6, 0.9], [6.9, 1]]],
  ['TiO', [476.1, 495.4, 516.7, 544.8, 615.9, 705.4], 15, 0, [[5.3, 0], [5.5, 0.15], [5.8, 0.35], [6, 0.55], [6.3, 0.85], [6.5, 1]], 1],
]
// White-dwarf D families (McCook–Sion): pressure-broadened lines of one dominant element.
const whiteDwarfFeatures: Record<string, readonly Feature[]> = {
  A: [['Hα', [656.3], 10, 0, [[0, 1]]], ['Hβ', [486.1], 10, 0, [[0, 1]]], ['Hγ', [434.0], 9, 0, [[0, 1]]], ['Hδ', [410.2], 8, 0, [[0, 0.9]]], [null, [397.0], 6, 0, [[0, 0.8]]]],
  B: [['He I', [447.1, 402.6, 587.6, 492.2, 501.6, 667.8], 4, 0, [[0, 0.9]]]],
  O: [['He II', [468.6, 454.1, 541.1], 4, 0, [[0, 0.8]]]],
  Q: [['C₂', [473.7, 516.5, 563.5], 15, 0, [[0, 0.9]], -1]],
  Z: [['Ca II', [393.4, 396.8], 4, 0, [[0, 1]]], ['Mg', [517.3], 2, 0, [[0, 0.4]]], ['Na', [589.3], 2, 0, [[0, 0.3]]], ['Fe', [438.4, 527.0], 1.2, 0, [[0, 0.3]]]],
}

export interface SpectralLine { label: string | null; nm: number; strength: number; width: number; band: 1 | -1 | 0 }

const interpolate = (anchors: Anchors, t: number) => {
  if (t <= anchors[0]![0]) return anchors[0]![1]
  for (let index = 1; index < anchors.length; index++) {
    const [x1, y1] = anchors[index]!, [x0, y0] = anchors[index - 1]!
    if (t <= x1) return y0 + (y1 - y0) * (t - x0) / (x1 - x0)
  }
  return anchors.at(-1)![1]
}

/** Schematic absorption features for O–M stars and white-dwarf D families; null when not applicable. */
export function spectralLines(reading: SpectralReading): SpectralLine[] | null {
  const lines = (features: readonly Feature[], t: number, weight = 1) => features.flatMap(([label, wavelengths, width, growth, anchors, band]) => {
    const strength = interpolate(anchors, t) * weight
    return strength > 0.02 ? wavelengths.map((nm) => ({ label, nm, strength, width: width + growth * strength, band: band ?? 0 } as SpectralLine)) : []
  })
  if (reading.whiteDwarf === '' || reading.whiteDwarf?.startsWith('X')) return null
  if (reading.whiteDwarf !== null) return [...reading.whiteDwarf].flatMap((family, position) => lines(whiteDwarfFeatures[family] ?? [], 0, position ? 0.6 : 1))
  const letter = reading.letter === null ? -1 : 'OBAFGKM'.indexOf(reading.letter)
  return letter < 0 ? null : lines(stellarFeatures, letter + Math.min(9.9, reading.subtype ?? 5) / 10)
}

const balmerLine = (nm: number) => `Hydrogen at ${nm} nm, part of the Balmer series. Hydrogen lines are deepest in white A-type stars near 10,000 K, and in DA white dwarfs.`
const lineDescriptions: Record<string, string> = {
  'Hα': balmerLine(656), 'Hβ': balmerLine(486), 'Hγ': balmerLine(434), 'Hδ': balmerLine(410),
  'He II': 'Ionized helium at 469 nm. Only the hottest O stars, above about 30,000 K, can strip helium of an electron.',
  'He I': 'Neutral helium, strongest in blue B stars near 20,000 K. Cooler stars are not hot enough to excite it.',
  'Ca II': 'Ionized calcium: Fraunhofer’s H and K lines at 397 and 393 nm. The deepest lines in the Sun and other G and K stars.',
  'Ca I': 'Neutral calcium at 423 nm. It strengthens in cool K and M stars.',
  'G band': 'A band of CH molecules near 430 nm, named G by Fraunhofer. Prominent in the Sun and other G and K stars.',
  Fe: 'Neutral iron. Thousands of iron lines crowd the spectra of the Sun and cooler stars; only a few are drawn.',
  Mg: 'The magnesium b triplet near 517 nm. It deepens in cooler stars.',
  Na: 'The sodium D lines at 589 nm, the yellow of sodium streetlights. Strong in cool K and M stars.',
  TiO: 'Titanium oxide molecules. Their broad bands form only in cool atmospheres below about 4,000 K and define M stars.',
  'C₂': 'Molecular carbon (Swan bands). DQ white dwarfs show carbon dredged up from their interiors.',
}

const VISIBLE = [380, 780] as const
// Same visible-light colors as the temperature card's spectrum, 380–780 nm.
const visibleColors = ['#8646e9', '#456dff', '#49c4be', '#c8dc64', '#efaa55', '#e85550']

function renderLines(host: HTMLElement, rows: { star: Star; reading: SpectralReading; lines: SpectralLine[]; selected: boolean }[]): void {
  const width = Math.max(240, host.getBoundingClientRect().width)
  const left = 4, right = width - 4, strip = 26, rowHeight = 48, top = 12
  const x = (nm: number) => left + (nm - VISIBLE[0]) / (VISIBLE[1] - VISIBLE[0]) * (right - left)
  const height = top + rows.length * rowHeight + 22
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Schematic absorption lines from 380 to 780 nanometers. ${rows.map(({ star, lines }) =>
    `${star.name}: ${[...new Set(lines.filter((line) => line.label && line.strength >= 0.5).map((line) => line.label))].join(', ') || 'no strong lines'}.`).join(' ')}` })
  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: 'spectral-visible-gradient' })
  visibleColors.forEach((color, index) => gradient.append(svgNode('stop', { offset: index / (visibleColors.length - 1), 'stop-color': color })))
  const fade = (id: string, direction: 1 | -1) => {
    const band = svgNode('linearGradient', { id, x1: direction > 0 ? 0 : 1, x2: direction > 0 ? 1 : 0, y1: 0, y2: 0 })
    band.append(svgNode('stop', { offset: 0, 'stop-color': '#07080b' }), svgNode('stop', { offset: 1, 'stop-color': '#07080b', 'stop-opacity': 0 }))
    return band
  }
  defs.append(gradient, fade('spectral-band-red', 1), fade('spectral-band-blue', -1))
  svg.append(defs)
  // Label the strongest features once, skipping labels that would collide.
  const labels = new Map<string, { nm: number; strength: number }>()
  for (const { lines } of rows) for (const line of lines) {
    if (!line.label || line.strength < 0.3) continue
    const known = labels.get(line.label)
    if (!known || line.strength > known.strength) labels.set(line.label, { nm: line.band === 1 ? line.nm + line.width / 3 : line.nm, strength: line.strength })
  }
  // HTML labels above the strips, so each can explain its feature in a tooltip.
  const labelRow = document.createElement('div')
  labelRow.className = 'spectral-line-labels'
  const placed: [number, number][] = []
  for (const [label, { nm }] of [...labels].sort((a, b) => b[1].strength - a[1].strength)) {
    const px = x(nm), half = label.length * 3.6 + 4
    if (placed.some(([other, otherHalf]) => Math.abs(other - px) < half + otherHalf + 4)) continue
    svg.append(svgNode('line', { x1: px, x2: px, y1: 0, y2: 6, class: 'temperature-graph-grid' }))
    const center = Math.max(left + half, Math.min(right - half, px))
    const cell = document.createElement('span')
    cell.className = `mass-metric-copy spectral-line-label${center < width * 0.25 ? ' is-start' : center > width * 0.75 ? ' is-end' : ''}`
    cell.style.left = `${center / width * 100}%`
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'mass-metric-help'
    button.textContent = label
    const tooltip = document.createElement('span')
    tooltip.id = `spectral-line-${placed.length}-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = lineDescriptions[label] ?? ''
    button.setAttribute('aria-describedby', tooltip.id)
    cell.append(button, tooltip)
    labelRow.append(cell)
    placed.push([px, half])
  }
  rows.forEach(({ star, reading, lines, selected }, index) => {
    const y = top + index * rowHeight + 18
    const type = reading.whiteDwarf !== null ? `D${reading.whiteDwarf}` : `${reading.letter}${reading.subtype ?? ''}`
    svg.append(svgNode('text', { x: left, y: y - 6, class: `temperature-graph-caption spectral-lines-name${selected ? ' is-selected' : ''}` }, `${star.name} · ${type}`),
      svgNode('rect', { x: left, y, width: right - left, height: strip, fill: 'url(#spectral-visible-gradient)', rx: 3 }))
    for (const line of lines) {
      const fill = line.band === 1 ? 'url(#spectral-band-red)' : line.band === -1 ? 'url(#spectral-band-blue)' : '#07080b'
      const from = line.band === 1 ? line.nm : line.band === -1 ? line.nm - line.width : line.nm - line.width / 2
      svg.append(svgNode('rect', { x: x(from), y, width: Math.max(1, x(from + line.width) - x(from)), height: strip, fill, opacity: Math.min(0.92, line.strength) }))
    }
  })
  const axis = top + rows.length * rowHeight
  for (const nm of [400, 500, 600, 700]) {
    svg.append(svgNode('line', { x1: x(nm), x2: x(nm), y1: axis - 4, y2: axis, class: 'temperature-graph-grid' }),
      svgNode('text', { x: x(nm), y: axis + 14, 'text-anchor': 'middle', class: 'temperature-graph-caption' }, `${nm} nm`))
  }
  host.replaceChildren(labelRow, svg)
}

export function renderSpectralFeatures(card: HTMLElement, star: Star, reference: Star): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const reading = readSpectralType(star.spectral_type)
  get('spectral-decoder-name').textContent = star.name
  get('spectral-decoder-type').textContent = star.spectral_type ?? ''
  get('spectral-decoder-rows').replaceChildren(...reading.parts.map(({ text, meaning }) => {
    const row = document.createElement('tr')
    const part = document.createElement('th')
    part.scope = 'row'
    part.textContent = text
    const description = document.createElement('td')
    description.textContent = meaning
    row.append(part, description)
    return row
  }))
  get('spectral-decoder').hidden = !reading.parts.length
  const decoderNote = get('spectral-decoder-missing')
  decoderNote.textContent = reading.parts.length ? '' : `${star.name} has no catalog spectral type.`
  decoderNote.hidden = !decoderNote.textContent

  const rows: [Star, boolean][] = reference.id === star.id ? [[star, true]] : [[star, true], [reference, false]]
  const plotted = rows.flatMap(([object, selected]) => {
    const objectReading = object === star ? reading : readSpectralType(object.spectral_type)
    const lines = spectralLines(objectReading)
    return lines ? [{ star: object, reading: objectReading, lines, selected }] : []
  })
  const missing = rows.filter(([object]) => !plotted.some((row) => row.star === object)).map(([object]) => {
    const { letter } = object === star ? reading : readSpectralType(object.spectral_type)
    return letter && 'LTY'.includes(letter)
      ? `${object.name} is ${letter === 'L' ? 'an' : 'a'} ${letter}-type dwarf: it emits mostly infrared light, and its class rests on near-infrared features.`
      : `${object.name} has no supported O–M or white-dwarf spectral class.`
  })
  const note = get('spectral-lines-missing')
  note.textContent = missing.join(' ')
  note.hidden = !note.textContent
  const host = get('spectral-lines')
  host.hidden = !plotted.length
  if (plotted.length) renderLines(host, plotted)
}
