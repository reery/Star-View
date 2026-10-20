import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model.ts'
import definitions from './data/stellar-system-identities.json' with { type: 'json' }

interface ComponentDefinition { starId: string; label: string; alternateStarIds?: string[] }
interface SystemDefinition { id: string; name: string; components: ComponentDefinition[] }

// The shared pool includes the existing literature reviews and the wider,
// explicitly sourced component coverage. Its definitions supersede older copies.
export const reviewedStarSystems: readonly SystemDefinition[] = definitions.systems

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

// A display limit, not an inferred orbital size. Use projected separation because
// independent component parallaxes can produce spurious line-of-sight offsets.
export const MIN_MAP_COMPONENT_SEPARATION_AU = 500
const AU_PER_PARSEC = 206264.80624709636

function projectedSeparationAu(a: Star, b: Star): number {
  const da = Math.hypot(a.x_pc, a.y_pc, a.z_pc)
  const db = Math.hypot(b.x_pc, b.y_pc, b.z_pc)
  if (da === 0 || db === 0) return Math.hypot(a.x_pc - b.x_pc, a.y_pc - b.y_pc, a.z_pc - b.z_pc) * AU_PER_PARSEC
  return Math.hypot(a.x_pc / da - b.x_pc / db, a.y_pc / da - b.y_pc / db, a.z_pc / da - b.z_pc / db)
    * (da + db) / 2 * AU_PER_PARSEC
}

/** Draw the brightest close component plus any explicitly selected companion. */
export function mapComponentVisibility(stars: readonly Star[], selectedId: string | null = null): Uint8Array {
  const indices = new Map(stars.map((star, index) => [star.id, index]))
  const visible = new Uint8Array(stars.length).fill(1)
  for (const system of new Set(indexStarSystems(stars).values())) {
    const remaining = new Set(system.components)
    while (remaining.size > 0) {
      const group = [remaining.values().next().value!]
      remaining.delete(group[0]!)
      // Connected close pairs also collapse hierarchical triples (A-C, A-B).
      for (const member of group) {
        for (const candidate of remaining) {
          if (projectedSeparationAu(member.star, candidate.star) > MIN_MAP_COMPONENT_SEPARATION_AU) continue
          group.push(candidate)
          remaining.delete(candidate)
        }
      }
      group.sort((a, b) => (a.star.absolute_mag ?? Infinity) - (b.star.absolute_mag ?? Infinity)
        || (b.star.luminosity_solar ?? 0) - (a.star.luminosity_solar ?? 0)
        || a.label.localeCompare(b.label, 'en'))
      for (const { star } of group.slice(1)) visible[indices.get(star.id)!] = star.id === selectedId ? 1 : 0
    }
  }
  return visible
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
    // Use a shared preferred spelling (for example Epsilon Indi) when every
    // explicitly identified member carries it. Membership still comes from IDs.
    const stems = components.map(({ label, star }) => star.name.endsWith(` ${label}`)
      ? star.name.slice(0, -label.length - 1) : null)
    const name = stems.every((stem) => stem && stem === stems[0]) ? stems[0]! : names.get(key)!
    const system = { id: key, name, components }
    for (const { star } of components) systems.set(star.id, system)
  }
  return systems
}
