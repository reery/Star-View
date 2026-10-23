import { Globe, Sun, createElement } from 'lucide'
import { starDisplayColor, type StarColorMode } from './astronomy'
import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { renderComparisonName } from './comparison-tiles'
import { disposeConstellationStars, renderConstellationStars } from './constellation-star-appearance'
import { MISSING_VALUE } from './format'
import { typicalMassRangePosition } from './mass-classification'
import { equalFluxDistance, luminosityComparisonClass, luminosityProperties, originFluxAtAu } from './luminosity-properties'
import dwarfSequence from './data/stellar-class-references.json'
import catalogReferences from './data/catalog-class-references.json'
import planetarySystems from './data/planetary-systems.json'

const solarPlanets = planetarySystems.systems.find(({ hostStarId }) => hostStarId === 'sun')!.planets
const number = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 3 })
const superscripts: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const exponent = (value: number) => String(value).split('').map((digit) => superscripts[digit]).join('')
const scientific = (value: number | null, unit: string) => {
  if (value === null) return MISSING_VALUE
  const [coefficient, power] = value.toExponential(2).split('e')
  return `${number(Number(coefficient))} × 10${exponent(Number(power))} ${unit}`
}
const solar = (value: number) => `${value < 0.001 || value >= 1e6 ? scientific(value, '').trim() : value >= 1000 ? `${number(value / 1000)}k` : number(value)} L☉`
const comparisonSolar = (value: number) => value >= 1000 ? solar(value)
  : `${value.toLocaleString('en-US', value < 0.01 ? { maximumSignificantDigits: 1 } : { maximumFractionDigits: 2 })} L☉`
const markerDistance = (value: number) => value < 0.05 ? number(value)
  : value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const factor = (value: number | null) => value === null ? MISSING_VALUE
  : value < 0.001 || value >= 1e6 ? scientific(value, '').replace(' × ', ' · ').trim()
    : value >= 1000 ? `${number(value / 1000)}k` : number(value)

export function nearbySolarOrbit(distanceAu: number): string | null {
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) return null
  let closest: string | null = null
  let closestDifference = 0.2 + Number.EPSILON
  for (const planet of solarPlanets) {
    const difference = Math.abs(distanceAu / planet.semiMajorAxisAu - 1)
    if (difference <= closestDifference) {
      closest = planet.name
      closestDifference = difference
    }
  }
  return closest
}

export function solarOrbitMarkers(maximumAu: number): { name: string; distanceAu: number }[] {
  if (!Number.isFinite(maximumAu) || maximumAu <= 0) return []
  const orbit = (name: string) => solarPlanets.find((planet) => planet.name === name)!.semiMajorAxisAu
  // Keep the outer scales sparse once Saturn's orbit fits; Neptune takes over when it fits.
  const names = maximumAu < 1.3 ? ['Mercury', 'Venus']
    : maximumAu < orbit('Saturn') ? ['Mars', 'Jupiter']
      : maximumAu < orbit('Neptune') ? ['Jupiter'] : ['Neptune']
  return solarPlanets.filter((planet) => (planet.name === 'Earth' ? maximumAu > 1 : names.includes(planet.name)) && planet.semiMajorAxisAu <= maximumAu)
    .map((planet) => ({ name: planet.name, distanceAu: planet.semiMajorAxisAu }))
}

export function luminosityClassRange(star: Pick<Star, 'type' | 'spectral_type'>) {
  const classification = luminosityComparisonClass(star)
  if (!classification) return null
  const sample = catalogReferences.luminosityClasses.find(({ key }) => key === classification.key)
  if (sample && sample.count >= 2) return {
    label: classification.label, low: sample.low, high: sample.high, median: sample.median,
    centralRange: sample.count >= 5 ? [sample.p10, sample.p90] as const : null,
    context: `Catalog range · ${sample.count} objects`, source: '', sourceLabel: '',
    note: `Luminosities of ${sample.count} distinct ${classification.label.toLowerCase()}s across all ${catalogReferences.catalogIds.length} bundled stellar catalogs, independent of the active catalog, filters or origin. The full bar shows the observed minimum and maximum. The colored band spans the 10th–90th percentiles (the middle 80%); the thin reference tick marks the median. Percentiles interpolate linearly between sorted luminosities; an even-sized sample averages its two middle values for the median. The band needs at least five measurements. These describe the bundled sample, not all stars in the Galaxy: the catalogs favor nearby and prominent objects. Repeated objects are merged by the established identity and component rules; resolved companions stay separate. Only positive recorded bolometric luminosities count. Ordinary stars share their broad spectral family and explicit luminosity class (I subclasses pooled); white dwarfs share their D family; substellar objects share their family and object type. Missing luminosities are omitted, never inferred.`,
  }
  if (classification.stage === 'V' && classification.letter) {
    const rows = dwarfSequence.rows.filter(([spectral]) => String(spectral).startsWith(classification.letter!))
    const values = rows.map((row) => 10 ** Number(row[3]))
    if (values.length) return {
      label: classification.label, low: Math.min(...values), high: Math.max(...values), median: null, centralRange: null, context: 'Published sequence range',
      source: dwarfSequence.source, sourceLabel: 'Pecaut & Mamajek · updated dwarf sequence ↗',
      note: `The ${classification.letter}-type main-sequence range is the minimum and maximum of the published mean subtype luminosities in Mamajek’s ${dwarfSequence.version} sequence. Too few cataloged objects have measured luminosities for a distribution, so no median or percentile band is inferred. This is a sequence envelope, not a population percentile, uncertainty interval or hard class boundary.`,
    }
  }
  return null
}

type LuminosityPoint = { name: string; position: number; object?: Star; value?: string; inlineValue?: boolean; detail?: string; role?: string }

/** Share the same compact, collision-aware label layout across the three bars. */
function renderPlotMarkers(bar: HTMLElement, points: LuminosityPoint[], colorMode: StarColorMode): void {
  const track = bar.querySelector<HTMLElement>('.mass-ratio-track')!
  track.querySelectorAll('.luminosity-plot-marker').forEach((marker) => marker.remove())
  bar.style.setProperty('--luminosity-label-space', '0px')
  const width = track.getBoundingClientRect().width
  bar.style.setProperty('--luminosity-label-max', `${width}px`)
  const occupied: { left: number; right: number; top: number; bottom: number }[] = []
  for (const point of points) {
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
    const labelBounds = label.getBoundingClientRect()
    const anchor = point.position / 100 * width
    const left = Math.max(0, Math.min(width - labelBounds.width, anchor - labelBounds.width / 2))
    label.style.transform = `translateX(${left - anchor}px)`
    let top = 32
    for (const previous of occupied) {
      if (left < previous.right + 6 && left + labelBounds.width + 6 > previous.left && top < previous.bottom + 4) top = previous.bottom + 4
    }
    marker.style.setProperty('--luminosity-label-top', `${top + 3}px`)
    occupied.push({ left, right: left + labelBounds.width, top, bottom: top + labelBounds.height })
  }
  const naturalHeight = bar.getBoundingClientRect().height
  const bottom = Math.max(naturalHeight, ...occupied.map((label) => label.bottom))
  bar.style.setProperty('--luminosity-label-space', `${Math.max(0, bottom - naturalHeight) + 2}px`)
}

export function renderLuminosityCard(card: HTMLElement, star: Star, origin: Star, sun: Star, colorMode: StarColorMode, other?: Star): void {
  const comparing = other !== undefined
  const reference = other ?? origin
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, value: string) => { get(id).textContent = value }
  const luminosity = star.luminosity_solar!
  const color = starDisplayColor(star, colorMode).getStyle()
  card.classList.toggle('has-comparison', comparing)
  card.style.setProperty('--luminosity-star-color', color)
  // The result illustrates perceived color, independent of exaggerated scene colors.
  card.style.setProperty('--luminosity-real-color', starDisplayColor(star, 'real').getStyle())
  for (const [id, shape] of [['luminosity-area-icon', Globe], ['luminosity-surface-flux-icon', Sun]] as const) {
    get(id).replaceChildren(createElement(shape, { width: 36, height: 36, 'stroke-width': 1.3, 'aria-hidden': 'true' }))
  }
  const properties = luminosityProperties(star)
  const comparisonProperties = other ? luminosityProperties(other) : undefined
  for (const tile of card.querySelectorAll<HTMLElement>('.luminosity-comparison-tile')) tile.hidden = !comparing
  // Paired tiles share a font size, so a long value in either column shrinks both.
  for (const [id, field] of [['area', 'areaSolar'], ['surface-flux', 'surfaceFluxSolar'], ['value', 'catalogSolar']] as const) {
    const primary = factor(properties[field])
    const paired = comparisonProperties ? factor(comparisonProperties[field]) : ''
    const long = Math.max(primary.length, paired.length) > (comparing ? 7 : 5)
    set(`luminosity-${id}`, primary)
    get(`luminosity-${id}`).classList.toggle('luminosity-long-value', long)
    if (!comparisonProperties) continue
    set(`luminosity-comparison-${id}`, paired)
    get(`luminosity-comparison-${id}`).classList.toggle('luminosity-long-value', long)
  }
  for (const name of card.querySelectorAll<HTMLElement>('[data-luminosity-star]')) {
    name.hidden = !other
    if (other) renderComparisonName(name, name.dataset.luminosityStar === 'selected' ? star : other, colorMode)
  }
  if (other) {
    get('luminosity-comparison-value').closest<HTMLElement>('.luminosity-result')!
      .style.setProperty('--luminosity-real-color', starDisplayColor(other, 'real').getStyle())
  }
  get('luminosity-unit').hidden = properties.catalogSolar === null
  const calculationNotes = (other ? [{ object: star, properties }, { object: other, properties: comparisonProperties! }] : [{ object: star, properties }])
    .flatMap(({ object, properties }) => properties.areaM2 === null
      ? [`${comparing ? `${object.name}: radius` : 'Radius'} unavailable; surface area and surface flux cannot be derived.${properties.catalogSolar === null ? '' : ' Catalog luminosity is shown.'}`] : [])
  set('luminosity-calculation-note', calculationNotes.join(' '))
  get('luminosity-calculation-note').hidden = calculationNotes.length === 0

  // Every distance matches today's solar irradiance at Earth, independently of the pair or map origin.
  const flux = originFluxAtAu(sun)
  const rows = comparing ? [['selected', star], ['origin', reference], ['sun', sun]] as const
    : [['origin', reference], ['selected', star], ['sun', sun]] as const
  const shownObjects = new Set<string>()
  const distances = rows.map(([id, object]) => {
    const comparison = equalFluxDistance(object, sun)
    const visible = !shownObjects.has(object.id) && (!comparing || id !== 'sun')
    shownObjects.add(object.id)
    return { id, object, ...comparison, visible, stellarFlux: originFluxAtAu(object) }
  })
  const farthest = Math.max(0, ...distances.flatMap((row) => row.visible && row.object.id !== sun.id && !row.insidePhotosphere && row.distanceAu !== null ? [row.distanceAu] : []))
  const maximum = farthest < 0.9 ? 1 : Math.max(1, farthest) * 1.08
  const orbitMarkers = flux === null ? [] : solarOrbitMarkers(maximum)
  const notes: string[] = []
  const fluxBar = get('luminosity-flux-bar')
  for (const row of distances) {
    const available = flux !== null && row.distanceAu !== null && !row.insidePhotosphere
    if (!available && flux !== null && row.visible) {
      notes.push(row.insidePhotosphere ? `${row.object.name}: the calculated distance lies inside its photosphere.` : `${row.object.name}: bolometric luminosity unavailable.`)
    }
    // A comparison shows its pair on the shared bar alone; the listed rows stay hidden.
    get(`luminosity-flux-${row.id}`).hidden = comparing || !row.visible
    if (comparing || !row.visible) continue
    set(`luminosity-flux-${row.id}-name`, row.object.name)
    set(`luminosity-flux-${row.id}-distance`, available ? `${number(row.distanceAu!)} AU` : MISSING_VALUE)
    set(`luminosity-flux-${row.id}-value`, row.stellarFlux === null ? '' : `${number(row.stellarFlux)} W/m² at 1 AU`)
    get(`luminosity-flux-${row.id}-value`).hidden = row.stellarFlux === null
    const preview = get(`luminosity-flux-${row.id}-star`) as HTMLCanvasElement
    preview.hidden = !STELLAR_OBJECT_TYPES.some((type) => type === row.object.type)
    if (!preview.hidden) renderConstellationStars(preview, [{ object: row.object, x: 16, y: 16, magnitude: null }], 32, 32, colorMode, true)
  }
  const availableDistances = distances.filter((row) => flux !== null && row.visible && !row.insidePhotosphere && row.distanceAu !== null)
  const positions = availableDistances.map((row) => row.distanceAu! / maximum * 100)
  fluxBar.style.setProperty('--luminosity-flux-au-position', `${100 / maximum}%`)
  fluxBar.style.setProperty('--luminosity-flux-near-position', `${positions.length ? Math.min(...positions) : 0}%`)
  fluxBar.style.setProperty('--luminosity-flux-far-position', `${Math.max(0, ...positions)}%`)
  fluxBar.hidden = flux === null
  set('luminosity-distance-axis-high', `${number(maximum)} AU`)
  renderPlotMarkers(fluxBar, flux === null ? [] : [
    ...orbitMarkers.map((marker) => ({ name: marker.name, position: marker.distanceAu / maximum * 100 })),
    ...availableDistances.map((row) => ({ name: row.object.name, object: row.object, position: row.distanceAu! / maximum * 100,
      role: row.id === 'selected' ? 'selected' : row.id === 'origin' ? 'reference' : 'sun',
      value: `(${markerDistance(row.distanceAu!)} AU)`, inlineValue: true,
      detail: comparing && row.stellarFlux !== null ? `${number(row.stellarFlux)} W/m² at 1 AU` : undefined })),
  ], colorMode)
  fluxBar.setAttribute('aria-label', `${availableDistances.map((row) => `${row.object.name}: Earth at ${number(row.distanceAu!)} AU receives ${number(flux!)} watts per square meter.`).join(' ')} Shared linear distance scale from zero to ${number(maximum)} AU. Solar orbit references: ${orbitMarkers.map((marker) => `${marker.name} at ${number(marker.distanceAu)} AU`).join(', ')}.`)
  set('luminosity-flux-note', notes.join(' '))
  get('luminosity-flux-note').hidden = notes.length === 0

  const referenceLuminosity = comparing ? reference.luminosity_solar : 1
  const referenceAvailable = referenceLuminosity !== null && referenceLuminosity > 0 && Number.isFinite(referenceLuminosity)
  const includeSun = comparing && star.id !== sun.id && reference.id !== sun.id
  const lowPower = Math.min(-6, Math.floor(Math.log10(luminosity)), referenceAvailable ? Math.floor(Math.log10(referenceLuminosity)) : 0)
  const highPower = Math.max(6, Math.ceil(Math.log10(luminosity)), referenceAvailable ? Math.ceil(Math.log10(referenceLuminosity)) : 0)
  const scale = get('luminosity-scale')
  const position = (value: number) => (Math.log10(value) - lowPower) / (highPower - lowPower) * 100
  scale.style.setProperty('--mass-ratio-position', `${position(luminosity)}%`)
  set('luminosity-scale-low', `10${exponent(lowPower)} L☉`)
  set('luminosity-scale-high', `10${exponent(highPower)} L☉`)
  set('luminosity-scale-value', solar(luminosity))
  get('luminosity-scale-value').parentElement!.hidden = comparing
  const scalePoints: LuminosityPoint[] = [{ name: star.name, object: star, position: position(luminosity), role: 'selected', value: comparing ? comparisonSolar(luminosity) : undefined }]
  if (referenceAvailable && (comparing || star.id !== sun.id)) scalePoints.push({ name: comparing ? reference.name : 'Sun', object: comparing ? reference : sun,
    position: position(referenceLuminosity), role: 'reference', value: comparing ? comparisonSolar(referenceLuminosity) : '1 L☉' })
  if (includeSun) scalePoints.push({ name: sun.name, object: sun, position: position(1), role: 'sun', value: '1 L☉' })
  renderPlotMarkers(scale, scalePoints, colorMode)
  scale.setAttribute('aria-label', `${star.name}: ${number(luminosity)} solar luminosities. Logarithmic scale from 10 to the power ${lowPower} to 10 to the power ${highPower} solar luminosities; ${comparing ? `${reference.name}: ${referenceAvailable ? `${number(referenceLuminosity)} solar luminosities` : 'individual luminosity unavailable'}` : 'Sun at one solar luminosity'}.${includeSun ? ' Sun: 1 solar luminosity.' : ''}`)

  const range = luminosityClassRange(star)
  const classification = luminosityComparisonClass(star)
  set('luminosity-class-heading', range?.label ?? classification?.label ?? 'Spectral class')
  const outsideClassRange = range && (luminosity < range.low || luminosity > range.high)
  const rangeContext = range ? [range.median === null ? 'No measured class distribution.' : range.centralRange ? '' : range.context,
    outsideClassRange ? `Class range · ${solar(range.low)}–${solar(range.high)}` : ''].filter(Boolean).join(' · ')
    : classification ? 'Too few measured peers for a class range.' : 'No supported explicit spectral class.'
  set('luminosity-class-context', rangeContext)
  get('luminosity-class-context').hidden = !rangeContext
  set('luminosity-class-method', range?.note ?? 'No class range is inferred from brightness, temperature or an unstated luminosity class.')
  const source = get('luminosity-class-source') as HTMLAnchorElement
  source.hidden = !range?.source
  source.removeAttribute('href')
  if (range?.source) source.href = range.source
  source.textContent = range?.sourceLabel ?? ''
  const classBar = get('luminosity-class-bar')
  classBar.hidden = !range
  get('luminosity-class-median-value').hidden = !range || range.median === null
  if (range) {
    const baseAxis = typicalMassRangePosition(luminosity, [range.low, range.high])
    const low = Math.min(baseAxis.low, comparing && referenceAvailable ? referenceLuminosity : baseAxis.low, includeSun ? 1 : baseAxis.low)
    const high = Math.max(baseAxis.high, comparing && referenceAvailable ? referenceLuminosity : baseAxis.high, includeSun ? 1 : baseAxis.high)
    const classPosition = (value: number) => Math.log(value / low) / Math.log(high / low) * 100
    classBar.querySelector<HTMLElement>('.mass-typical-low')!.style.left = `${classPosition(range.low)}%`
    classBar.querySelector<HTMLElement>('.mass-typical-high')!.style.left = `${classPosition(range.high)}%`
    const band = classBar.querySelector<HTMLElement>('.luminosity-class-range')!
    band.hidden = !range.centralRange
    if (range.centralRange) {
      classBar.style.setProperty('--luminosity-distribution-low-position', `${classPosition(range.centralRange[0])}%`)
      classBar.style.setProperty('--luminosity-distribution-high-position', `${classPosition(range.centralRange[1])}%`)
    }
    const median = classBar.querySelector<HTMLElement>('.luminosity-class-median')!
    median.hidden = range.median === null
    if (range.median !== null) median.style.left = `${classPosition(range.median)}%`
    set('luminosity-class-low', solar(low))
    set('luminosity-class-high', solar(high))
    get('luminosity-class-median-value').querySelector('span')!.textContent = range.median === null ? '' : `Median ${solar(range.median)}`
    const classPoints: LuminosityPoint[] = [{ name: star.name, object: star, position: classPosition(luminosity), role: 'selected', value: comparing ? comparisonSolar(luminosity) : undefined }]
    if (comparing && referenceAvailable) classPoints.push({ name: reference.name, object: reference, position: classPosition(referenceLuminosity), role: 'reference', value: comparisonSolar(referenceLuminosity) })
    if (includeSun) classPoints.push({ name: sun.name, object: sun, position: classPosition(1), role: 'sun', value: '1 L☉' })
    renderPlotMarkers(classBar, classPoints, colorMode)
    const distribution = range.centralRange ? ` Middle 80% of catalog luminosities from ${number(range.centralRange[0])} to ${number(range.centralRange[1])} solar luminosities.` : ''
    const medianNote = range.median === null ? '' : ` Catalog median ${number(range.median)} solar luminosities.`
    classBar.setAttribute('aria-label', `${star.name}: ${number(luminosity)} solar luminosities.${comparing ? ` ${reference.name}: ${referenceAvailable ? `${number(referenceLuminosity)} solar luminosities` : 'individual luminosity unavailable'}.` : ''}${includeSun ? ' Sun: 1 solar luminosity.' : ''} ${range.label} ${range.context.toLowerCase()} from ${number(range.low)} to ${number(range.high)} solar luminosities.${distribution}${medianNote} Logarithmic axis from ${number(low)} to ${number(high)}; marked class boundaries remain visible for outliers.`)
  }
}

export function disposeLuminosityCard(): void {
  disposeConstellationStars()
}
