import type { Star } from './catalog-model.ts'
import { uniqueDesignations } from './designations.ts'
import { reviewedStarSystems, starComponentIdentity } from './star-systems.ts'
import companionData from './data/stellar-companions.json' with { type: 'json' }
import { missingCatalogMeasurements } from './catalog-source.ts'

const records = new Map((companionData.stars as Star[]).map((star) => [star.id, star]))
const systems = new Map(reviewedStarSystems.flatMap((system) => system.components.flatMap((component) =>
  [component.starId, ...component.alternateStarIds ?? []].map((id) => [id, system] as const))))

/** Close catalog membership over explicit stellar systems, without magnitude,
 * distance, spectral-class or luminosity cuts on their individual companions.
 * Keep selection IDs stable, including direct selection of a B/C component.
 */
export function completeCatalogCompanions(stars: readonly Star[]): Star[] {
  const present = new Set(stars.map((star) => starComponentIdentity(star.id)?.canonicalStarId ?? star.id))
  const result = stars.map((star) => {
    const canonicalId = starComponentIdentity(star.id)?.canonicalStarId
    const component = canonicalId ? records.get(canonicalId) : undefined
    if (!component) return star
    const catalogSources = [...component.catalog_sources ?? [], ...star.catalog_sources ?? []]
      .filter((source, index, sources) => sources.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(source)) === index)
    if (missingCatalogMeasurements(star, { ...component, catalog_sources: catalogSources }).length) {
      const { catalog_sources: _sources, unresolved_photometry: _photometry, ...record } = star
      catalogSources.push({ catalog_id: 'input', record,
        scope: `Original ${star.name} input source; component contributions are not separated here. Retained source measurements, not individual component measurements.` })
    }
    return {
      ...component,
      id: star.id,
      ...(catalogSources.length ? { catalog_sources: catalogSources } : {}),
      designations: uniqueDesignations([...component.designations ?? [], star.name, ...star.designations ?? []], component.name),
    }
  })
  for (const star of stars) {
    const system = systems.get(star.id)
    if (!system) continue
    for (const { starId } of system.components) {
      if (present.has(starId)) continue
      const companion = records.get(starId)
      if (!companion) throw new Error(`Missing reviewed stellar component: ${starId}`)
      result.push({ ...companion, designations: uniqueDesignations(companion.designations ?? [], companion.name) })
      present.add(starId)
    }
  }
  return result
}
