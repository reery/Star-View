import type { Star } from './catalog-model'
import { massProperties } from './mass-properties'
import dwarfSequence from './data/stellar-class-references.json'
import whiteDwarfModels from './data/white-dwarf-references.json'
import catalogReferences from './data/catalog-class-references.json'
import { closestCatalogClass, type CatalogClassReference } from './catalog-class-references'

export type MassReference = 'class' | 'origin' | 'sun'
export { MASS_METRICS, massComparisonClass } from './mass-classification'
import { massComparisonClass, type MassMetric, type MassRange } from './mass-classification'
export type { MassMetric, MassRange } from './mass-classification'
function mapMetrics<T>(create: (metric: MassMetric) => T): Record<MassMetric, T> {
  return { mass: create('mass'), gravity: create('gravity'), escapeKms: create('escapeKms'), density: create('density'), luminosityPerMass: create('luminosityPerMass') }
}
interface ClassMetric { value: number | null; range: MassRange | null; referenceLabel?: string; rangeLabel?: string }
export interface TypicalMassClass {
  label: string
  referenceLabel: string
  rangeLabel: string | null
  source: string
  sourceLabel: string
  note: string
  benchmarkLabel?: string
  fallbackLabel?: string
  metrics: Record<MassMetric, ClassMetric>
}

type ClassStar = Pick<Star, 'type' | 'spectral_type' | 'temperature_k'> & Partial<Pick<Star, 'id'>>

function catalogMassClass(star: ClassStar, catalog: readonly CatalogClassReference[]): TypicalMassClass | null {
  const requested = massComparisonClass(star)
  const massReference = closestCatalogClass(star, catalog, 'mass')
  if (!requested?.letter || !massReference) return null
  const references = mapMetrics((metric) => closestCatalogClass(star, catalog, metric))
  const samples = [...new Set(Object.values(references).flatMap((row) => row ? [row.spectral] : []))]
  const metricNotes = Object.entries(references).map(([metric, row]) => row
    ? `${metric}: ${row.spectral}, ${row.metrics[metric as MassMetric].count} measured object(s)` : `${metric}: unavailable`).join('; ')
  const usingFallback = requested.spectral !== massReference.spectral || requested.assumedStage
    || requested.spectral.toUpperCase() !== star.spectral_type?.trim().toUpperCase()
  const massCount = massReference.metrics.mass.count
  return {
    label: massComparisonClass({ type: 'star', spectral_type: massReference.spectral })!.label,
    referenceLabel: massReference.spectral,
    rangeLabel: `Catalog range · ${massCount} ${massCount === 1 ? 'star' : 'stars'}`,
    benchmarkLabel: 'Catalog average',
    fallbackLabel: usingFallback ? `Using ${massReference.spectral} for ${star.spectral_type}` : undefined,
    source: '', sourceLabel: `All ${catalogReferences.catalogIds.length} bundled catalogs`,
    note: `No published calibration is assigned to ${star.spectral_type}. The fallback uses all ${catalogReferences.catalogIds.length} bundled stellar catalogs, independent of the selected catalog, filters or origin. Repeated stars are merged using the map’s identity and component rules; resolved companions remain separate. Reviewed nearest-1000 measurements take priority, then nearest-100, nearest-neighbors, bright-stars, western-constellation-stars and famous-cluster-stars. Missing accepted measurements can be supplemented by another catalog, while deliberately withheld fields stay unavailable. Each metric is the arithmetic mean of available measurements in the exact normalized spectral class, including the selected star when it belongs to that sample. Bounds are that same sample’s minimum and maximum. Gravity, escape speed, density and luminosity per mass are calculated for each star before averaging. Missing measurements are omitted per metric. Transition classes use their first stated stage (B2IV-V becomes B2IV); peculiar suffixes do not create a separate basic class. If the exact class lacks a metric, use the nearest subtype with data in the same family and stage, then the same stage in another family, then the closest available class. ${samples.length > 1 ? 'Different metrics can use different classes where measurements are missing. ' : ''}Samples: ${metricNotes}. A one-star sample has identical average and bounds. These are catalog sample statistics, not population limits or a published scientific calibration.`,
    metrics: mapMetrics<ClassMetric>((metric) => {
      const row = references[metric]
      return { value: row?.metrics[metric].value ?? null, range: row?.metrics[metric].range ?? null,
        referenceLabel: row?.spectral,
        rangeLabel: row ? `Catalog range for ${row.spectral} · ${row.metrics[metric].count} measured stars` : undefined }
    }),
  }
}

interface SequenceRow { spectral: string; subtype: number; mass: number; radius: number; logLuminosity: number }
const sequence = (dwarfSequence.rows as [string, number, number, number][]).map(([spectral, mass, radius, logLuminosity]): SequenceRow =>
  ({ spectral, subtype: Number(spectral.slice(1, -1)), mass, radius, logLuminosity }))

function rowProperties(row: SequenceRow) {
  return massProperties({ type: 'star', mass_solar: row.mass, radius_solar: row.radius, luminosity_solar: 10 ** row.logLuminosity })
}

function massOnlyGuide(label: string, value: number | null, range: MassRange | null, source: string, sourceLabel: string, note: string): TypicalMassClass {
  return {
    label, referenceLabel: label, rangeLabel: range ? 'Class mass guide' : null, source, sourceLabel, note,
    metrics: {
      mass: { value, range },
      gravity: { value: null, range: null }, escapeKms: { value: null, range: null },
      density: { value: null, range: null }, luminosityPerMass: { value: null, range: null },
    },
  }
}

type CoolingRow = [temperature: number, radiusCm: number, luminosityErgs: number]
interface CoolingTrack { mass_solar: number; envelope: string; rows: CoolingRow[] }
const coolingTracks = whiteDwarfModels.tracks.map((track): CoolingTrack => ({
  mass_solar: track.mass_solar, envelope: track.envelope,
  rows: track.rows.map((row) => [row[0]!, row[1]!, row[2]!]),
}))
const coolingProperties = (mass: number, [, radiusCm, luminosityErgs]: CoolingRow) => massProperties({
  type: 'white_dwarf', mass_solar: mass,
  radius_solar: radiusCm / 6.957e10,
  luminosity_solar: luminosityErgs / 3.828e33,
})

function coolingPropertiesAt(track: CoolingTrack, temperature: number) {
  const low = track.rows.findLast((row) => row[0] <= temperature)
  const high = track.rows.find((row) => row[0] >= temperature)
  if (!low || !high) return null // Never extrapolate a cooling track.
  if (low === high) return coolingProperties(track.mass_solar, low)
  const fraction = (temperature - low[0]) / (high[0] - low[0])
  const radius = low[1] + fraction * (high[1] - low[1])
  const luminosity = 10 ** (Math.log10(low[2]) + fraction * Math.log10(high[2] / low[2]))
  return coolingProperties(track.mass_solar, [temperature, radius, luminosity])
}

function whiteDwarfClass(star: Pick<Star, 'spectral_type' | 'temperature_k'>): TypicalMassClass {
  const spectral = star.spectral_type?.trim().toUpperCase() ?? ''
  // Mixed/unknown atmospheres use both envelopes, without inventing a mean model.
  const envelope = /[+/]/.test(spectral) ? null : /^DA(?![BOQ])/.test(spectral) ? 'thick'
    : /^D(?:B(?!A)|O(?!A)|Q(?!A)|Z)/.test(spectral) ? 'thin' : null
  const temperature = star.temperature_k !== null && Number.isFinite(star.temperature_k) && star.temperature_k > 0 ? star.temperature_k : null
  const tracks = coolingTracks.filter((track) => envelope === null || track.envelope === envelope)
  const referenceTrack = envelope === null ? null : tracks.find((track) => track.mass_solar === 0.6)!
  const reference = temperature === null || referenceTrack === null ? null : coolingPropertiesAt(referenceTrack, temperature)
  const models = temperature === null
    ? tracks.flatMap((track) => track.rows.map((row) => coolingProperties(track.mass_solar, row)))
    : tracks.flatMap((track) => {
      const properties = coolingPropertiesAt(track, temperature)
      return properties === null ? [] : [properties]
    })
  const atmosphereNote = envelope === 'thick' ? 'DA benchmarks use the thick hydrogen-envelope sequence.'
    : envelope === 'thin' ? 'Helium-atmosphere benchmarks use the thin hydrogen-envelope sequence; DQ/DZ comparisons are helium-envelope proxies, not carbon/metal atmosphere fits.'
      : 'The atmosphere is unknown or mixed: ranges include both envelopes, and no single surface benchmark is assigned.'
  const temperatureNote = temperature === null ? 'Catalog temperature is unavailable: surface ranges span all model temperatures, and no single surface benchmark is assigned.'
    : `Surface ranges use only tracks covering the catalog effective temperature of ${temperature.toLocaleString('en-US')} K.${reference === null && envelope !== null ? ' The 0.6 M☉ track does not cover this temperature, so no surface benchmark is extrapolated.' : ''}`
  return {
    label: 'White dwarf', referenceLabel: spectral.match(/^D[ABCOQZ]/)?.[0] ?? 'White dwarf',
    rangeLabel: temperature === null ? 'Cooling-model envelope · temperature unavailable'
      : `${temperature.toLocaleString('en-US')} K ${envelope === null ? 'H/He ' : ''}model envelope`,
    source: whiteDwarfModels.source, sourceLabel: 'Montréal · Bédard et al. (2020)',
    note: `White dwarf references use the Montréal carbon/oxygen-core cooling sequences of Bédard et al. (2020). The conventional 0.6 M☉ mass benchmark is not a population median. ${atmosphereNote} ${temperatureNote} Radius is interpolated linearly in temperature and luminosity in log space between adjacent model points. Gravity, escape speed, mean density and luminosity per mass use each model’s paired mass, radius and luminosity. The mass range is the published 0.2–1.3 M☉ grid; surface ranges are model envelopes, not population percentiles, uncertainty intervals or white dwarf mass limits. Helium-core and oxygen/neon-core remnants can differ.`,
    metrics: mapMetrics<ClassMetric>((metric) => {
      if (metric === 'mass') return { value: 0.6, range: [0.2, 1.3] }
      const values = models.map((model) => model[metric]!).filter((value) => Number.isFinite(value) && value > 0)
      return { value: reference?.[metric] ?? null, range: values.length ? [Math.min(...values), Math.max(...values)] : null }
    }),
  }
}

export function typicalMassClass(star: ClassStar, catalog: readonly CatalogClassReference[] = catalogReferences.classes as CatalogClassReference[]): TypicalMassClass | null {
  if (star.type === 'white_dwarf') return whiteDwarfClass(star)
  if (star.type === 'neutron_star' || star.type === 'pulsar') return massOnlyGuide('Neutron star', 1.4, null,
    'https://www.nasa.gov/universe/nasas-nicer-probes-the-squeezability-of-neutron-stars/', 'NASA NICER: standard neutron star mass',
    'The 1.4 M☉ value is a standard neutron star reference, not a mass limit or a median of all pulsars. Surface properties need a relativistic model; luminosity depends on cooling, rotation and accretion.')
  if (star.type === 'brown_dwarf') {
    // IAU 2015 B3 nominal Jupiter GM divided by nominal solar GM.
    const jupiterMassSolar = 1.2668653e17 / 1.3271244e20
    return massOnlyGuide('Brown dwarf', null, [13 * jupiterMassSolar, 80 * jupiterMassSolar],
      'https://www.jpl.nasa.gov/images/pia23685-what-is-a-brown-dwarf/', 'NASA/JPL: brown dwarf mass guide',
      'Approximate 13–80 Jupiter-mass guide, not a statistical typical interval; fusion boundaries depend on composition. No midpoint is treated as a typical mass. Surface properties and luminosity also depend on age, so no universal values are assigned.')
  }
  const classification = massComparisonClass(star)
  if (!classification) return null
  if (classification.stage !== 'V') {
    const fallback = catalogMassClass(star, catalog)
    if (fallback) return fallback
  }
  if (!classification.letter) return null
  const rows = sequence.filter((row) => row.spectral[0] === classification.letter)
  const exact = rows.find((row) => row.subtype === classification.subtype)
  const lower = rows.findLast((row) => row.subtype < classification.subtype!)
  const upper = rows.find((row) => row.subtype > classification.subtype!)
  let reference = exact ?? null
  if (!reference && lower && upper) {
    const fraction = (classification.subtype! - lower.subtype) / (upper.subtype - lower.subtype)
    const interpolate = (low: number, high: number) => low + (high - low) * fraction
    reference = {
      spectral: `${classification.letter}${classification.subtype}V`, subtype: classification.subtype!,
      mass: interpolate(lower.mass, upper.mass), radius: interpolate(lower.radius, upper.radius),
      logLuminosity: interpolate(lower.logLuminosity, upper.logLuminosity),
    }
  }
  // Missing endpoints use the closest published subtype, without extrapolation.
  const nearest = !reference
  reference ??= [...rows].sort((a, b) => Math.abs(a.subtype - classification.subtype!) - Math.abs(b.subtype - classification.subtype!))[0]!
  const fallbackLabel = classification.stage !== 'V' || classification.assumedStage || nearest
    ? `Using ${reference.spectral} for ${star.spectral_type}` : undefined
  const properties = reference ? rowProperties(reference) : null
  const classProperties = rows.map(rowProperties)
  return {
    label: classification.stage === 'V' ? classification.label : `${classification.letter}-type main-sequence reference`,
    fallbackLabel,
    referenceLabel: reference?.spectral ?? `${classification.letter}-type sequence`,
    rangeLabel: `${rows[0]!.spectral}–${rows.at(-1)!.spectral} sequence`,
    source: dwarfSequence.source, sourceLabel: `Pecaut & Mamajek · ${dwarfSequence.version}`,
    note: `Reference mass, radius and luminosity come from Mamajek’s ${dwarfSequence.version} mean dwarf sequence.${reference && !exact && !nearest ? ' This subtype is interpolated between the neighboring entries: mass and radius linearly, luminosity in log space.' : ''}${nearest ? ' The requested subtype is outside the sequence; the closest published subtype is used without extrapolation.' : ''}${classification.stage !== 'V' ? ` No published ${classification.stage} calibration or usable catalog fallback is assigned, so ${reference.spectral} is a main-sequence proxy, not a typical ${classification.stage} star.` : ''}${classification.assumedStage ? ' Luminosity class is unavailable, so a main-sequence reference is used.' : ''} The displayed ranges span the published subtype reference values within ${classification.letter}, not population percentiles or uncertainty intervals. Gravity, escape speed and density are calculated for each paired mass and radius; luminosity per mass uses the same row. The source describes adopted masses as tentative; composition, age and rotation can shift individual stars.`,
    metrics: mapMetrics<ClassMetric>((metric) => {
      const values = classProperties.map((entry) => entry[metric]!).filter((value) => Number.isFinite(value) && value > 0)
      return { value: properties?.[metric] ?? null, range: [Math.min(...values), Math.max(...values)] }
    }),
  }
}

export function typicalMassRangePosition(value: number | null, [rangeLow, rangeHigh]: MassRange, typical: number | null = null) {
  // Keep the published range intact and extend the logarithmic axis for outliers.
  // Zero luminosity cannot be placed on a log axis; reserve a decade below the guide.
  const pointRange = rangeLow === rangeHigh
  const domainLow = rangeLow <= 0 ? rangeHigh > 0 ? rangeHigh / 10 : 0.1 : pointRange ? rangeLow / Math.sqrt(10) : rangeLow
  const domainHigh = rangeHigh <= 0 ? 1 : pointRange ? rangeHigh * Math.sqrt(10) : rangeHigh
  const low = value === null ? domainLow : Math.min(domainLow, value > 0 ? value : domainLow / 10)
  const high = value === null ? domainHigh : Math.max(domainHigh, value)
  const position = (entry: number) => entry <= 0 ? 0 : Math.log(entry / low) / Math.log(high / low) * 100
  return {
    low, high,
    position: value === null ? null : position(value),
    rangeLowPosition: position(rangeLow),
    rangeHighPosition: position(rangeHigh),
    typicalPosition: typical === null ? null : position(typical),
  }
}

export function massComparison(star: Star, origin: Star, mode: MassReference, catalog: readonly CatalogClassReference[] = catalogReferences.classes as CatalogClassReference[]) {
  const classification = massComparisonClass(star)
  const typical = mode === 'class' ? typicalMassClass(star, catalog) : null
  const reference = mode === 'class' ? null : massProperties(mode === 'sun'
    ? { type: 'star', mass_solar: 1, radius_solar: 1, luminosity_solar: 1 } : origin)
  const properties = massProperties(star)
  return {
    label: mode === 'class' ? typical?.referenceLabel ?? classification?.label ?? 'Unclassified object' : mode === 'sun' ? 'Sun' : origin.name,
    classLabel: classification?.label ?? null, typical,
    metrics: mapMetrics((metric) => {
      const value = mode === 'class' ? typical?.metrics[metric].value ?? null : reference![metric]
      const selected = properties[metric]
      return {
        value,
        ratio: selected !== null && value !== null && value > 0 ? selected / value : null,
        range: mode === 'class' ? typical?.metrics[metric].range ?? null : null,
      }
    }),
  }
}
