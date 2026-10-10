import { ICRS_TO_GALACTIC_ROWS, type Star } from './catalog-model'
import { starComponentIdentity } from './star-systems'

export interface SkyPosition { ra_deg: number; dec_deg: number }
export interface ConstellationStar extends SkyPosition { hip: number; name: string; magnitude_v: number; bayer: string | null; object: Star }
export interface ConstellationChart {
  schemaVersion: number
  abbreviation: string
  name: string
  center: SkyPosition
  stars: ConstellationStar[]
  lines: [number, number][]
  boundaries: { neighbor: string; neighbor_abbreviation: string; points: SkyPosition[] }[]
  sources: { label: string; url: string; path: string; sha256: string; inputs?: { path: string; sha256: string }[] }[]
}

function resolveFigureObjects(figures: readonly ConstellationStar[], objects: readonly Star[]): ReadonlyMap<number, Star> {
  const canonicalIds = new Map(figures.map((figure) => [figure.hip, starComponentIdentity(figure.object.id)?.canonicalStarId ?? figure.object.id]))
  const wantedIds = new Set(canonicalIds.values()), wantedHips = new Set(canonicalIds.keys())
  const canonical = new Map<string, Star>(), aliases = new Map<number, Star>()
  // Retain only this figure's matches, rather than indexing the entire catalog.
  for (const object of objects) {
    const identity = starComponentIdentity(object.id)
    const id = identity?.canonicalStarId ?? object.id
    if (wantedIds.has(id) && !canonical.has(id)) canonical.set(id, object)
    if (canonical.size === wantedIds.size) break
    if (identity) continue
    for (const designation of object.designations ?? []) {
      const match = /^HIP(\d+)$/.exec(designation.replace(/\s+/g, ''))
      if (!match) continue
      const hip = Number(match[1])
      if (wantedHips.has(hip) && !aliases.has(hip)) aliases.set(hip, object)
    }
  }
  return new Map(figures.map((figure) => {
    const id = canonicalIds.get(figure.hip)!
    return [figure.hip, canonical.get(id) ?? aliases.get(figure.hip) ?? { ...figure.object, id }]
  }))
}

/** Resolve a figure's exact component identity in the current catalog, if loaded. */
export function constellationStarObject(figure: ConstellationStar, objects: readonly Star[]): Star {
  return resolveFigureObjects([figure], objects).get(figure.hip)!
}

const figureObjects = new WeakMap<readonly Star[], WeakMap<ConstellationChart, ReadonlyMap<number, Star>>>()

/** Scan once per chart/catalog pair; subsequent redraws reuse the small match map. */
export function constellationStarObjects(chart: ConstellationChart, objects: readonly Star[]): ReadonlyMap<number, Star> {
  let catalogCharts = figureObjects.get(objects)
  if (!catalogCharts) figureObjects.set(objects, catalogCharts = new WeakMap())
  let resolved = catalogCharts.get(chart)
  if (!resolved) catalogCharts.set(chart, resolved = resolveFigureObjects(chart.stars, objects))
  return resolved
}

// Only reviewed charts are registered. Each is a separate lazy-loaded chunk.
const charts = new Map<string, () => Promise<ConstellationChart>>([
  ['Canis Major', async () => (await import('./data/constellations/canis-major.json')).default as ConstellationChart],
  ['Centaurus', async () => (await import('./data/constellations/centaurus.json')).default as ConstellationChart],
])
const loaded = new Map<string, Promise<ConstellationChart>>()

export function constellationCardAvailable(object: Pick<Star, 'id' | 'constellation'>): boolean {
  return object.id !== 'sun' && charts.has(object.constellation ?? '')
}

export async function loadConstellationChart(object: Pick<Star, 'id' | 'constellation'>): Promise<ConstellationChart | null> {
  if (!constellationCardAvailable(object)) return null
  const name = object.constellation!
  let pending = loaded.get(name)
  if (!pending) {
    pending = charts.get(name)!().catch((error: unknown) => {
      loaded.delete(name)
      throw error
    })
    loaded.set(name, pending)
  }
  return pending
}

/** Catalogue sky position as seen from the Sun, independent of the 3D-map origin. */
export function objectSkyPosition(object: Star): SkyPosition | null {
  const astrometry = object.raw_astrometry ?? object.nebula ?? object.compact
  if (astrometry && Number.isFinite(astrometry.ra_deg) && Number.isFinite(astrometry.dec_deg)) {
    return { ra_deg: astrometry.ra_deg, dec_deg: astrometry.dec_deg }
  }
  // Clouds and other extended objects may only have Galactic Cartesian positions.
  // This is the transpose (inverse) of the shared orthogonal ICRS rotation.
  const galactic = [object.x_pc, object.y_pc, object.z_pc]
  if (!galactic.every(Number.isFinite) || Math.hypot(...galactic) === 0) return null
  const [x, y, z] = [0, 1, 2].map((column) => ICRS_TO_GALACTIC_ROWS.reduce((sum, row, i) => sum + row[column]! * galactic[i]!, 0))
  return { ra_deg: (Math.atan2(y!, x!) * 180 / Math.PI + 360) % 360, dec_deg: Math.atan2(z!, Math.hypot(x!, y!)) * 180 / Math.PI }
}

/** Gnomonic sky projection: north up, east left; null beyond the front hemisphere. */
export function projectConstellationPosition(position: SkyPosition, center: SkyPosition): { x: number; y: number } | null {
  const radians = Math.PI / 180
  const delta = (position.ra_deg - center.ra_deg) * radians
  const dec = position.dec_deg * radians, dec0 = center.dec_deg * radians
  const denominator = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(delta)
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  return {
    x: -Math.cos(dec) * Math.sin(delta) / denominator,
    y: -(Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(delta)) / denominator,
  }
}
