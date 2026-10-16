import { Globe, Sun, createElement } from 'lucide'
import { starDisplayColor, type StarColorMode } from './astronomy'
import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
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
  return solarPlanets.filter((planet) => names.includes(planet.name) && planet.semiMajorAxisAu <= maximumAu
    && (planet.name !== 'Jupiter' || maximumAu > 6))
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

export function renderLuminosityCard(card: HTMLElement, star: Star, origin: Star, sun: Star, colorMode: StarColorMode): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, value: string) => { get(id).textContent = value }
  const luminosity = star.luminosity_solar!
  const color = starDisplayColor(star, colorMode).getStyle()
  card.style.setProperty('--luminosity-star-color', color)
  // The result illustrates perceived color, independent of exaggerated scene colors.
  card.style.setProperty('--luminosity-real-color', starDisplayColor(star, 'real').getStyle())
  for (const [id, shape] of [['luminosity-area-icon', Globe], ['luminosity-surface-flux-icon', Sun]] as const) {
    get(id).replaceChildren(createElement(shape, { width: 36, height: 36, 'stroke-width': 1.3, 'aria-hidden': 'true' }))
  }
  const properties = luminosityProperties(star)
  set('luminosity-area', factor(properties.areaSolar))
  set('luminosity-surface-flux', factor(properties.surfaceFluxSolar))
  set('luminosity-calculated-value', factor(properties.calculatedSolar))
  for (const id of ['luminosity-area', 'luminosity-surface-flux', 'luminosity-calculated-value']) {
    get(id).classList.toggle('luminosity-long-value', get(id).textContent!.length > 5)
  }
  get('luminosity-calculated-unit').hidden = properties.calculatedSolar === null
  const missing = [properties.areaM2 === null ? 'radius' : '', properties.surfaceFlux === null ? 'effective temperature' : ''].filter(Boolean)
  const difference = properties.calculatedSolar === null ? 0 : Math.abs(properties.calculatedSolar / luminosity - 1)
  set('luminosity-calculation-note', missing.length ? `Catalog ${missing.join(' and ')} unavailable; the surface calculation cannot be completed.`
    : difference > 0.05 ? `Catalog R, T and L differ by ${number(difference * 100)}%; comparisons use catalog L.` : '')
  get('luminosity-calculation-note').hidden = !get('luminosity-calculation-note').textContent

  const originFlux = originFluxAtAu(origin)
  const reference = originFlux === null ? sun : origin
  const flux = originFluxAtAu(reference)
  set('luminosity-flux-origin-value', originFlux === null ? '' : `${number(originFlux)} W/m²`)
  get('luminosity-flux-origin-value').hidden = originFlux === null
  const rows = [['origin', origin], ['selected', star], ['sun', sun]] as const
  const shownObjects = new Set<string>()
  const distances = rows.map(([id, object]) => {
    const comparison = equalFluxDistance(object, reference)
    const visible = !shownObjects.has(object.id)
    shownObjects.add(object.id)
    return { id, object, ...comparison, visible }
  })
  const maximum = Math.max(1, ...distances.flatMap((row) => row.visible && !row.insidePhotosphere && row.distanceAu !== null ? [row.distanceAu] : [])) * 1.08
  const orbitMarkers = flux === null ? [] : solarOrbitMarkers(maximum)
  const bottomBarId = distances.findLast((row) => row.visible && !row.insidePhotosphere && row.distanceAu !== null)?.id
  const notes: string[] = []
  if (originFlux === null) {
    notes.push(origin.luminosity_solar === null ? `${origin.name} has no catalog bolometric luminosity.` : 'The origin is not a supported radiating star, or 1 AU is inside its photosphere.')
    if (flux !== null) notes.push(`Using the Sun’s flux at 1 AU (${number(flux)} W/m²) as the reference.`)
  }
  for (const row of distances) {
    get(`luminosity-flux-${row.id}`).hidden = !row.visible
    set(`luminosity-flux-${row.id}-name`, row.object.name)
    const available = flux !== null && row.distanceAu !== null && !row.insidePhotosphere
    set(`luminosity-flux-${row.id}-distance`, available ? `${number(row.distanceAu!)} AU` : MISSING_VALUE)
    const orbit = available && row.object.id !== sun.id ? nearbySolarOrbit(row.distanceAu!) : null
    set(`luminosity-flux-${row.id}-orbit`, orbit ? `(about ${orbit}’s orbit)` : '')
    get(`luminosity-flux-${row.id}-orbit`).hidden = !orbit
    const preview = get(`luminosity-flux-${row.id}-star`) as HTMLCanvasElement
    preview.hidden = !STELLAR_OBJECT_TYPES.some((type) => type === row.object.type)
    if (row.visible && !preview.hidden) {
      // Use the scene's exact core/halo materials at a fixed illustrative size.
      renderConstellationStars(preview, [{ object: row.object, x: 16, y: 16, magnitude: null }], 32, 32, colorMode, true)
    }
    const bar = get(`luminosity-flux-${row.id}-bar`)
    const track = bar.querySelector<HTMLElement>('.mass-ratio-track')!
    track.querySelectorAll('.luminosity-orbit-tick').forEach((tick) => tick.remove())
    const markers = row.id === bottomBarId ? orbitMarkers : []
    bar.classList.toggle('mass-scale', markers.length > 0)
    for (const marker of markers) {
      const tick = document.createElement('span')
      tick.className = 'mass-scale-tick luminosity-orbit-tick'
      tick.dataset.planet = marker.name
      tick.setAttribute('aria-hidden', 'true')
      const percent = marker.distanceAu / maximum * 100
      tick.style.left = `${percent}%`
      tick.style.setProperty('--mass-tick-offset', percent < 15 ? '0%' : percent > 85 ? '-100%' : '-50%')
      const label = document.createElement('span')
      label.textContent = marker.name
      tick.append(label)
      track.append(tick)
    }
    bar.hidden = !available
    bar.style.setProperty('--luminosity-star-color', starDisplayColor(row.object, colorMode).getStyle())
    if (available) {
      bar.style.setProperty('--mass-ratio-position', `${row.distanceAu! / maximum * 100}%`)
      const references = markers.length ? ` Solar orbit references: ${markers.map((marker) => `${marker.name} at ${number(marker.distanceAu)} AU`).join(', ')}.` : ''
      bar.setAttribute('aria-label', `${row.object.name}: Earth at ${number(row.distanceAu!)} AU receives ${number(flux!)} watts per square meter. Shared linear distance scale from zero to ${number(maximum)} AU.${references}`)
    } else if (flux !== null && row.visible && !(row.id === 'origin' && originFlux === null)) notes.push(row.insidePhotosphere ? `${row.object.name}: the calculated distance lies inside its photosphere.` : `${row.object.name}: bolometric luminosity unavailable.`)
  }
  set('luminosity-distance-axis-high', `${number(maximum)} AU`)
  get('luminosity-distance-axis').hidden = flux === null
  set('luminosity-flux-note', notes.join(' '))
  get('luminosity-flux-note').hidden = notes.length === 0

  const lowPower = Math.min(-6, Math.floor(Math.log10(luminosity)))
  const highPower = Math.max(6, Math.ceil(Math.log10(luminosity)))
  const scale = get('luminosity-scale')
  scale.style.setProperty('--mass-ratio-position', `${(Math.log10(luminosity) - lowPower) / (highPower - lowPower) * 100}%`)
  scale.style.setProperty('--luminosity-sun-position', `${-lowPower / (highPower - lowPower) * 100}%`)
  scale.querySelector<HTMLElement>('.mass-ratio-sun')!.style.left = `${-lowPower / (highPower - lowPower) * 100}%`
  set('luminosity-scale-low', `10${exponent(lowPower)} L☉`)
  set('luminosity-scale-high', `10${exponent(highPower)} L☉`)
  set('luminosity-scale-value', solar(luminosity))
  scale.setAttribute('aria-label', `${star.name}: ${number(luminosity)} solar luminosities. Logarithmic scale from 10 to the power ${lowPower} to 10 to the power ${highPower} solar luminosities; Sun at one solar luminosity.`)

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
  if (range) {
    const axis = typicalMassRangePosition(luminosity, [range.low, range.high])
    classBar.style.setProperty('--mass-ratio-position', `${axis.position}%`)
    classBar.style.setProperty('--mass-range-low-position', `${axis.rangeLowPosition}%`)
    classBar.style.setProperty('--mass-range-high-position', `${axis.rangeHighPosition}%`)
    classBar.querySelector<HTMLElement>('.mass-typical-low')!.style.left = `${axis.rangeLowPosition}%`
    classBar.querySelector<HTMLElement>('.mass-typical-high')!.style.left = `${axis.rangeHighPosition}%`
    const position = (value: number) => Math.log(value / axis.low) / Math.log(axis.high / axis.low) * 100
    const band = classBar.querySelector<HTMLElement>('.luminosity-class-range')!
    band.hidden = !range.centralRange
    if (range.centralRange) {
      classBar.style.setProperty('--luminosity-distribution-low-position', `${position(range.centralRange[0])}%`)
      classBar.style.setProperty('--luminosity-distribution-high-position', `${position(range.centralRange[1])}%`)
    }
    const median = classBar.querySelector<HTMLElement>('.luminosity-class-median')!
    median.hidden = range.median === null
    if (range.median !== null) median.style.left = `${position(range.median)}%`
    set('luminosity-class-low', solar(axis.low))
    set('luminosity-class-high', solar(axis.high))
    set('luminosity-class-median-value', range.median === null ? '' : `Median ${solar(range.median)}`)
    const distribution = range.centralRange ? ` Middle 80% of catalog luminosities from ${number(range.centralRange[0])} to ${number(range.centralRange[1])} solar luminosities.` : ''
    const reference = range.median === null ? '' : ` Catalog median ${number(range.median)} solar luminosities.`
    classBar.setAttribute('aria-label', `${star.name}: ${number(luminosity)} solar luminosities. ${range.label} ${range.context.toLowerCase()} from ${number(range.low)} to ${number(range.high)} solar luminosities.${distribution}${reference} Logarithmic axis from ${number(axis.low)} to ${number(axis.high)}; marked class boundaries remain visible for outliers.`)
  }
}

export function disposeLuminosityCard(): void {
  disposeConstellationStars()
}
