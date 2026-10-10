import type { Star } from './catalog-model.ts'
import { mergeCatalogStarLayers } from './catalog-merge.ts'
import { MASS_METRICS, massComparisonClass, type MassMetric, type MassRange } from './mass-classification.ts'
import { massProperties } from './mass-properties.ts'

export interface CatalogClassReference {
  spectral: string
  letter: string
  subtype: number
  stage: string
  count: number
  metrics: Record<MassMetric, { value: number | null; range: MassRange | null; count: number }>
}

/** Aggregate objects, not catalog rows: repeated observations never add statistical weight. */
export function buildCatalogClassReferences(
  catalogs: readonly { id: string; stars: readonly Star[] }[],
  componentIdentity: (id: string) => { canonicalStarId: string } | undefined = () => undefined,
) {
  // Prefer reviewed nearby components, then the smaller nearby catalogs, then landmarks.
  const priority = ['nearest-1000', 'nearest-100', 'nearest-neighbors', 'bright-stars', 'western-constellation-stars', 'famous-cluster-stars']
  const rank = (id: string) => priority.indexOf(id) < 0 ? priority.length : priority.indexOf(id)
  const ordered = [...catalogs].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  const stars = ordered.reduce<Star[]>((merged, catalog) => mergeCatalogStarLayers(merged, catalog.stars, componentIdentity), [])
  const groups = new Map<string, { classification: NonNullable<ReturnType<typeof massComparisonClass>>; stars: Star[] }>()
  for (const star of stars) {
    const classification = massComparisonClass(star)
    // Unknown stages and composite spectra are not measured members of an exact class.
    if (star.type !== 'star' || !classification?.letter || classification.assumedStage) continue
    let group = groups.get(classification.spectral)
    if (!group) groups.set(classification.spectral, group = { classification, stars: [] })
    group.stars.push(star)
  }
  const classes: CatalogClassReference[] = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([spectral, { classification, stars: members }]) => {
    const properties = members.map(massProperties)
    const metrics = Object.fromEntries(MASS_METRICS.map((metric) => {
      const values = properties.map((row) => row[metric]).filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0)
      return [metric, {
        value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        range: values.length ? [Math.min(...values), Math.max(...values)] : null,
        count: values.length,
      }]
    })) as CatalogClassReference['metrics']
    return { spectral, letter: classification.letter!, subtype: classification.subtype!, stage: classification.stage!, count: members.length, metrics }
  })
  return { schemaVersion: 1, catalogIds: ordered.map(({ id }) => id), uniqueObjects: stars.length, classes }
}

/** Prefer the exact subtype/stage, then its nearest subtype in the same family and stage. */
export function closestCatalogClass(star: Pick<Star, 'type' | 'spectral_type'>, classes: readonly CatalogClassReference[], metric: MassMetric) {
  const requested = massComparisonClass(star)
  if (star.type !== 'star' || !requested?.letter) return null
  const stages: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }
  const distance = (candidate: CatalogClassReference) => {
    if (candidate.spectral === requested.spectral) return -1
    const sameLetter = candidate.letter === requested.letter
    const sameStage = candidate.stage === requested.stage
    const tier = sameLetter && sameStage ? 0 : sameStage ? 1 : sameLetter ? 2 : 3
    return tier * 10000 + Math.abs('OBAFGKM'.indexOf(candidate.letter) - 'OBAFGKM'.indexOf(requested.letter!)) * 100
      + Math.abs(stages[candidate.stage]! - stages[requested.stage!]!) * 10 + Math.abs(candidate.subtype - requested.subtype!)
  }
  return classes.filter((row) => row.metrics[metric].count > 0).sort((a, b) => distance(a) - distance(b) || a.spectral.localeCompare(b.spectral))[0] ?? null
}
