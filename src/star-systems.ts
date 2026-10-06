import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import systemDefinitions from './data/star-systems.json'

// Stable catalog IDs keep associations independent of common/display names.
const reviewedComponents = new Map(systemDefinitions.systems.flatMap((system) =>
  system.components.flatMap((component) => {
    const aliases = ('alternateStarIds' in component ? component.alternateStarIds : []) ?? []
    return [component.starId, ...aliases].map((id) => [id, {
      canonicalStarId: component.starId, name: system.name, label: component.label,
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
    if (name === 'Theta1 Orionis') continue
    let members = groups.get(name)
    if (!members) groups.set(name, members = new Map())
    members.set(label, star)
  }
  const systems = new Map<string, StarSystem>()
  for (const [name, members] of groups) {
    if (members.size < 2) continue
    const components = [...members].sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([label, star]) => ({ label, star }))
    const system = { name, components }
    for (const { star } of components) systems.set(star.id, system)
  }
  return systems
}
