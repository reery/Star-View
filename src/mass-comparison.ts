import type { Star } from './catalog-model'
import { massProperties } from './mass-properties'
import dwarfSequence from './data/stellar-class-references.json'
import whiteDwarfReferences from './data/white-dwarf-class-references.json'
import { whiteDwarfEnvelope, whiteDwarfReferenceKey, whiteDwarfTemperature, type WhiteDwarfReference, type WhiteDwarfReferenceResolver } from './white-dwarf-class'
import catalogReferences from './data/catalog-class-references.json'
import { closestCatalogClass, type CatalogClassReference } from './catalog-class-references'

export type MassReference = 'class' | 'origin' | 'sun'
export { MASS_METRICS, massComparisonClass, typicalMassRangePosition } from './mass-classification'
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
    note: `No published calibration is assigned to ${star.spectral_type}. The fallback uses all ${catalogReferences.catalogIds.length} bundled stellar catalogs, independent of the selected catalog, filters or origin. Repeated stars are merged using the map’s identity and component rules; resolved companions remain separate. Reviewed nearest-1000 measurements take priority, then nearest-100, nearest-neighbors, western-constellation-stars. Missing accepted measurements can be supplemented by another catalog, while deliberately withheld fields stay unavailable. Each metric is the arithmetic mean of available measurements in the exact normalized spectral class, including the selected star when it belongs to that sample. Bounds are that same sample’s minimum and maximum. Gravity, escape speed, density and luminosity per mass are calculated for each star before averaging. Missing measurements are omitted per metric. Transition classes use their first stated stage (B2IV-V becomes B2IV); peculiar suffixes do not create a separate basic class. If the exact class lacks a metric, use the nearest subtype with data in the same family and stage, then the same stage in another family, then the closest available class. ${samples.length > 1 ? 'Different metrics can use different classes where measurements are missing. ' : ''}Samples: ${metricNotes}. A one-star sample has identical average and bounds. These are catalog sample statistics, not population limits or a published scientific calibration.`,
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

// Generated by scripts/catalogs.ts; tests compare it with a fresh full-grid evaluation.
const precomputedWhiteDwarfReferences = whiteDwarfReferences.references as unknown as Record<string, WhiteDwarfReference>
/** Every bundled white dwarf's envelope/temperature is precomputed at build time from the full cooling grid. */
const precomputedWhiteDwarfReference: WhiteDwarfReferenceResolver = (envelope, temperature) =>
  precomputedWhiteDwarfReferences[whiteDwarfReferenceKey(envelope, temperature)]
const WHITE_DWARF_SOURCE_LABEL = 'Montréal · Bédard et al. (2020)'

function whiteDwarfClass(star: Pick<Star, 'spectral_type' | 'temperature_k'>, resolveReference: WhiteDwarfReferenceResolver): TypicalMassClass {
  const spectral = star.spectral_type?.trim().toUpperCase() ?? ''
  // Mixed/unknown atmospheres use both envelopes, without inventing a mean model.
  const envelope = whiteDwarfEnvelope(spectral)
  const temperature = whiteDwarfTemperature(star.temperature_k)
  const model = resolveReference(envelope, temperature)
  if (!model) return massOnlyGuide('White dwarf', 0.6, [0.2, 1.3], whiteDwarfReferences.source, WHITE_DWARF_SOURCE_LABEL,
    'Cooling-model surface references are unavailable for this object, so only the conventional 0.6 M☉ mass benchmark and the published 0.2–1.3 M☉ model grid are shown.')
  const atmosphereNote = envelope === 'thick' ? 'DA benchmarks use the thick hydrogen-envelope sequence.'
    : envelope === 'thin' ? 'Helium-atmosphere benchmarks use the thin hydrogen-envelope sequence; DQ/DZ comparisons are helium-envelope proxies, not carbon/metal atmosphere fits.'
      : 'The atmosphere is unknown or mixed: ranges include both envelopes, and no single surface benchmark is assigned.'
  const temperatureNote = temperature === null ? 'Catalog temperature is unavailable: surface ranges span all model temperatures, and no single surface benchmark is assigned.'
    : `Surface ranges use only tracks covering the catalog effective temperature of ${temperature.toLocaleString('en-US')} K.${!model.benchmark && envelope !== null ? ' The 0.6 M☉ track does not cover this temperature, so no surface benchmark is extrapolated.' : ''}`
  return {
    label: 'White dwarf', referenceLabel: spectral.match(/^D[ABCOQZ]/)?.[0] ?? 'White dwarf',
    rangeLabel: temperature === null ? 'Cooling-model envelope · temperature unavailable'
      : `${temperature.toLocaleString('en-US')} K ${envelope === null ? 'H/He ' : ''}model envelope`,
    source: whiteDwarfReferences.source, sourceLabel: WHITE_DWARF_SOURCE_LABEL,
    note: `White dwarf references use the Montréal carbon/oxygen-core cooling sequences of Bédard et al. (2020). The conventional 0.6 M☉ mass benchmark is not a population median. ${atmosphereNote} ${temperatureNote} Radius is interpolated linearly in temperature and luminosity in log space between adjacent model points. Gravity, escape speed, mean density and luminosity per mass use each model’s paired mass, radius and luminosity. The mass range is the published 0.2–1.3 M☉ grid; surface ranges are model envelopes, not population percentiles, uncertainty intervals or white dwarf mass limits. Helium-core and oxygen/neon-core remnants can differ.`,
    metrics: mapMetrics<ClassMetric>((metric) => metric === 'mass' ? { value: 0.6, range: [0.2, 1.3] } : { ...model.metrics[metric] }),
  }
}

export function typicalMassClass(
  star: ClassStar,
  catalog: readonly CatalogClassReference[] = catalogReferences.classes as CatalogClassReference[],
  resolveWhiteDwarfReference: WhiteDwarfReferenceResolver = precomputedWhiteDwarfReference,
): TypicalMassClass | null {
  if (star.type === 'white_dwarf') return whiteDwarfClass(star, resolveWhiteDwarfReference)
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

export function massComparison(
  star: Star, origin: Star, mode: MassReference,
  catalog: readonly CatalogClassReference[] = catalogReferences.classes as CatalogClassReference[],
  resolveWhiteDwarfReference?: WhiteDwarfReferenceResolver,
) {
  const classification = massComparisonClass(star)
  const typical = mode === 'class' ? typicalMassClass(star, catalog, resolveWhiteDwarfReference) : null
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
