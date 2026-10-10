import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model.ts'
import systemDefinitions from './data/star-systems.json' with { type: 'json' }
import companionDefinitions from './data/stellar-companions.json' with { type: 'json' }

interface ComponentDefinition { starId: string; label: string; alternateStarIds?: string[] }
interface SystemDefinition { id: string; name: string; components: ComponentDefinition[] }

// The shared pool includes the existing literature reviews and the wider,
// explicitly sourced component coverage. Its definitions supersede older copies.
export const reviewedStarSystems: readonly SystemDefinition[] = [...new Map<string, SystemDefinition>(
  [...systemDefinitions.systems, ...companionDefinitions.systems].map((system) => [system.id, system]),
).values()]

// Stable catalog IDs keep associations independent of common/display names.
const reviewedComponents = new Map(reviewedStarSystems.flatMap((system) =>
  system.components.flatMap((component) => {
    const aliases = component.alternateStarIds ?? []
    return [component.starId, ...aliases].map((id) => [id, {
      canonicalStarId: component.starId, systemId: system.id, name: system.name, label: component.label,
    }] as const)
  })))

/** Explicit cross-catalog identity; equal sky positions never establish it. */
export function starComponentIdentity(id: string) {
  return reviewedComponents.get(id)
}

export interface StarSystemComponent {
  label: string
  star: Star
}

export interface StarSystem {
  id: string
  name: string
  components: StarSystemComponent[]
}

/** Cache only system components that share a catalog position, brightest first. */
export function coincidentComponentGroups(stars: readonly Star[]): number[][] {
  const indices = new Map(stars.map((star, index) => [star.id, index]))
  const groups: number[][] = []
  for (const system of new Set(indexStarSystems(stars).values())) {
    const positions = new Map<string, number[]>()
    for (const { star } of system.components) {
      const key = `${star.x_pc},${star.y_pc},${star.z_pc}`
      let members = positions.get(key)
      if (!members) positions.set(key, members = [])
      members.push(indices.get(star.id)!)
    }
    for (const members of positions.values()) {
      if (members.length < 2) continue
      members.sort((a, b) => (stars[a]!.absolute_mag ?? Infinity) - (stars[b]!.absolute_mag ?? Infinity)
        || (stars[b]!.luminosity_solar ?? 0) - (stars[a]!.luminosity_solar ?? 0) || a - b)
      groups.push(members)
    }
  }
  return groups
}

/** Group resolved, named catalog components; never infer companions from proximity. */
export function indexStarSystems(stars: readonly Star[]): ReadonlyMap<string, StarSystem> {
  const groups = new Map<string, Map<string, Star>>()
  const names = new Map<string, string>()
  for (const star of stars) {
    if (!STELLAR_OBJECT_TYPES.includes(star.type as never)) continue
    const component = star.name.match(/^(.+) ([A-Z][a-z]?)$/)
    const reviewed = reviewedComponents.get(star.id)
    // Proxima is Alpha Centauri C, despite its separate common name.
    // https://www.eso.org/public/announcements/ann16089/
    const name = reviewed?.name ?? (star.id === 'proxima-centauri' ? 'Alpha Centauri' : component?.[1])
    const label = reviewed?.label ?? (star.id === 'proxima-centauri' ? 'C' : component?.[2])
    if (!name || !label) continue
    // These are separate Trapezium cluster systems, as documented in the
    // famous-cluster catalog notes, rather than components of one system.
    if (!reviewed && name === 'Theta1 Orionis') continue
    const key = reviewed?.systemId ?? `name:${name}`
    names.set(key, name)
    let members = groups.get(key)
    if (!members) groups.set(key, members = new Map())
    members.set(label, star)
  }
  const systems = new Map<string, StarSystem>()
  for (const [key, members] of groups) {
    if (members.size < 2) continue
    const components = [...members].sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([label, star]) => ({ label, star }))
    const system = { id: key, name: names.get(key)!, components }
    for (const { star } of components) systems.set(star.id, system)
  }
  return systems
}

/** System entry always starts with A, or the first cataloged A subcomponent. */
export function primarySystemStarId(system: StarSystem): string {
  return (system.components.find(({ label }) => label === 'A')
    ?? system.components.find(({ label }) => label === 'Aa')
    ?? system.components.find(({ label }) => label.startsWith('A'))
    ?? system.components[0]!).star.id
}
