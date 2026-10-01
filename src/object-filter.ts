import type { Star } from './catalog-model'

export const FILTER_CATEGORIES = [
  {
    id: 'compact_objects',
    label: 'Compact objects',
    subtypes: [
      { key: 'sun', label: 'Sun' },
      { key: 'star', label: 'Stars' },
      { key: 'brown_dwarf', label: 'Brown dwarfs' },
      { key: 'white_dwarf', label: 'White dwarfs' },
      { key: 'neutron_star', label: 'Neutron stars' },
      { key: 'pulsar', label: 'Pulsars' },
      { key: 'black_hole', label: 'Black holes' },
    ],
  },
  {
    id: 'stellar_systems',
    label: 'Stellar systems',
    subtypes: [
      { key: 'binary', label: 'Binaries' },
      { key: 'multiple_system', label: 'Multiple systems' },
    ],
  },
  {
    id: 'interstellar_medium',
    label: 'Interstellar medium',
    subtypes: [
      { key: 'molecular_cloud', label: 'Molecular clouds' },
      { key: 'dark_nebula', label: 'Dark nebulae' },
      { key: 'reflection_nebula', label: 'Reflection nebulae' },
      { key: 'hii_region', label: 'H II regions' },
    ],
  },
  {
    id: 'stellar_remnants',
    label: 'Stellar remnants',
    subtypes: [
      { key: 'planetary_nebula', label: 'Planetary nebulae' },
      { key: 'supernova_remnant', label: 'Supernova remnants' },
      { key: 'pulsar_wind_nebula', label: 'Pulsar-wind nebulae' },
    ],
  },
  {
    id: 'large_scale_structures',
    label: 'Large-scale structures',
    subtypes: [
      { key: 'bubble', label: 'Bubbles' },
      { key: 'superbubble', label: 'Superbubbles' },
      { key: 'dust_sheet', label: 'Dust sheets' },
      { key: 'local_bubble', label: 'Local Bubble' },
    ],
  },
] as const

export type FilterCategoryId = typeof FILTER_CATEGORIES[number]['id']
export type FilterKey = typeof FILTER_CATEGORIES[number]['subtypes'][number]['key']

export const FILTER_KEYS: readonly FilterKey[] = FILTER_CATEGORIES.flatMap((category) => category.subtypes.map((subtype) => subtype.key))
export const FILTER_CATEGORY_IDS: readonly FilterCategoryId[] = FILTER_CATEGORIES.map((category) => category.id)

// Bundled stellar catalogs always contain these; overlay keys come from manifest counts.
const CATALOG_FILTER_KEYS: readonly FilterKey[] = ['sun', 'star', 'brown_dwarf', 'white_dwarf']

export const DEFAULT_FILTER_CATEGORIES: readonly FilterCategoryId[] = ['compact_objects']
export const DEFAULT_FILTER_SUBTYPES: readonly FilterKey[] = ['sun', 'star', 'brown_dwarf', 'white_dwarf', 'reflection_nebula', 'hii_region', 'planetary_nebula']

export function isFilterKey(value: unknown): value is FilterKey {
  return FILTER_KEYS.includes(value as FilterKey)
}

export function isFilterCategoryId(value: unknown): value is FilterCategoryId {
  return FILTER_CATEGORY_IDS.includes(value as FilterCategoryId)
}

export function filterKeyForObject(star: Pick<Star, 'id' | 'type'>): FilterKey {
  if (star.id === 'sun') return 'sun'
  if (star.type === 'sub_brown_dwarf') return 'brown_dwarf'
  return star.type
}

export function filterCategoryForKey(key: FilterKey): FilterCategoryId {
  return FILTER_CATEGORIES.find((category) => category.subtypes.some((subtype) => subtype.key === key))!.id
}

export function availableFilterKeys(...overlayCounts: Readonly<Record<string, number>>[]): Set<FilterKey> {
  const available = new Set<FilterKey>(CATALOG_FILTER_KEYS)
  for (const counts of overlayCounts) {
    for (const [type, count] of Object.entries(counts)) if (count > 0 && isFilterKey(type)) available.add(type)
  }
  return available
}

export function categoryAvailable(id: FilterCategoryId, available: ReadonlySet<FilterKey>): boolean {
  return FILTER_CATEGORIES.find((category) => category.id === id)!.subtypes.some((subtype) => available.has(subtype.key))
}

export function effectiveFilterKeys(
  categories: ReadonlySet<FilterCategoryId>,
  subtypes: ReadonlySet<FilterKey>,
  available: ReadonlySet<FilterKey>,
): Set<FilterKey> {
  const effective = new Set<FilterKey>()
  for (const category of FILTER_CATEGORIES) {
    if (!categories.has(category.id)) continue
    for (const { key } of category.subtypes) if (subtypes.has(key) && available.has(key)) effective.add(key)
  }
  return effective
}

export function filterSummary(effective: ReadonlySet<FilterKey>, available: ReadonlySet<FilterKey>): string {
  return effective.size === available.size ? 'All' : `${effective.size} of ${available.size}`
}
