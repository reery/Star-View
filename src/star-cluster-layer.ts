import { Color, Group, Vector3, type Camera } from 'three'
import type { StarColorMode } from './astronomy'
import type { Star, StarClusterDetails } from './catalog-model'
import { distanceFade } from './milky-way-layer'
import { createPuffLayer, seededRandom, type NebulaLayer, type PuffInstances, type PuffSource } from './nebula-layer'

// A cluster's faint members, which no catalog holds, drawn as one soft glow: a Plummer sphere whose scale is the
// published half-member radius, cut at the tidal radius. Where the bright members are catalog stars, the glow fades
// out between these camera distances, in half-member radii, and they take over. A cluster without them keeps its glow.
const GLOW_FADE_RADII = [8, 30] as const
const GLOW_PUFFS = 600
const GLOW_ALPHA = 0.02
// Up close, a glow puff grows no larger than this fraction of the view height: it keeps its opacity, so the glow
// dims as the camera enters the cluster, and the fill stays within a few screens instead of a hundred.
const GLOW_MAX_SCREEN_FRACTION = 0.06
// A globular cluster is far denser: its glow follows its measured core and half-light radii, and its brightest giants
// are drawn as stars, too small to see from afar, that resolve as the camera approaches.
const GLOBULAR_GLOW_PUFFS = 1200
const GLOBULAR_GLOW_ALPHA = 0.03
const GLOBULAR_STARS = 3000
const GLOBULAR_STAR_PC = 0.15
const GLOBULAR_STAR_ALPHA = 1.6
// The giants stay points up close: their size on screen is capped at this fraction of the view height.
const GLOBULAR_STAR_MAX_SCREEN_FRACTION = 0.003
// Beyond this distance from a globular cluster's edge, every giant is far below a pixel and fades to nothing
// (1.5-pixel minimum, energy-preserving alpha under 0.001 for a 1080-pixel view), so their layer is not drawn.
const GLOBULAR_STARS_RANGE_PC = 4000
// A globular cluster's light is concentrated: its level of detail follows twice its half-light radius, not its tidal
// radius, so a distant cluster draws only a few dozen glow puffs.
const GLOBULAR_DETAIL_RADII = 2
// Old stars: red giants, the brightest giants near the tip of their branch, subgiants at the turnoff, and blue
// horizontal-branch stars, which metal-poor clusters hold in numbers (real and exaggerated colors).
const GIANT = ['#ffcf96', '#ffb466'] as const
const TIP_GIANT = ['#ffad78', '#ff8a4a'] as const
const SUBGIANT = ['#fff2dc', '#ffe6b8'] as const
const BLUE_HORIZONTAL_BRANCH = ['#d2deff', '#9ab8ff'] as const
const METAL_POOR_FE_H = -1.4

const seedFor = (id: string) => [...id].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 0x811c)

function puffBuffer(count: number): PuffInstances {
  return {
    count,
    centers: new Float32Array(count * 3),
    shapes: new Float32Array(count * 4),
    realColors: new Float32Array(count * 3),
    vividColors: new Float32Array(count * 3),
  }
}

// Radii in even steps of ln(1 + r/a) resolve both a dense core and a long halo.
const PROFILE_STEPS = 512

/** Cumulative mass of the Elson–Fall–Freeman density ∝ (1 + r²/a²)^(−(γ+1)/2), cut at the tidal radius. */
function truncatedProfile(slope: number, scale: number, limit: number): { radii: Float64Array; cumulative: Float64Array } {
  const radii = new Float64Array(PROFILE_STEPS + 1)
  const cumulative = new Float64Array(PROFILE_STEPS + 1)
  const end = Math.log1p(limit / scale)
  const density = (x: number) => x * x * (1 + x * x) ** (-(slope + 1) / 2) * (1 + x)
  for (let index = 1; index <= PROFILE_STEPS; index++) {
    radii[index] = scale * Math.expm1(end * index / PROFILE_STEPS)
    cumulative[index] = cumulative[index - 1]! + (density(radii[index - 1]! / scale) + density(radii[index]! / scale)) / 2
  }
  return { radii, cumulative }
}

/** Radius on the sky within which half of a spherical profile's mass appears. */
function projectedHalfRadius({ radii, cumulative }: ReturnType<typeof truncatedProfile>): number {
  const total = cumulative[PROFILE_STEPS]!
  const projected = (sky: number) => {
    let sum = 0
    for (let index = 1; index <= PROFILE_STEPS; index++) {
      const radius = (radii[index - 1]! + radii[index]!) / 2
      sum += (cumulative[index]! - cumulative[index - 1]!) * (radius <= sky ? 1 : 1 - Math.sqrt(1 - (sky / radius) ** 2))
    }
    return sum
  }
  let [low, high] = [0, radii[PROFILE_STEPS]!]
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    if (projected(middle) < total / 2) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/**
 * Draws 3D radii (pc) for a globular cluster: an Elson–Fall–Freeman profile, surface brightness ∝ (1 + R²/a²)^(−γ/2),
 * whose core radius (half the central surface brightness) is the published one and whose slope γ puts half the light
 * within the published half-light radius once the profile is cut at the tidal radius.
 */
export function globularRadius(core: number, halfLight: number, limit: number): (random: number) => number {
  const scaleFor = (slope: number) => core / Math.sqrt(2 ** (2 / slope) - 1)
  // A flatter halo (smaller slope) moves the half-light radius outward.
  let [low, high] = [2.0001, 60]
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    if (projectedHalfRadius(truncatedProfile(middle, scaleFor(middle), limit)) > halfLight) low = middle
    else high = middle
  }
  const { radii, cumulative } = truncatedProfile((low + high) / 2, scaleFor((low + high) / 2), limit)
  return (random) => {
    const target = random * cumulative[PROFILE_STEPS]!
    let [lower, upper] = [0, PROFILE_STEPS]
    while (upper - lower > 1) {
      const middle = (lower + upper) >> 1
      if (cumulative[middle]! < target) lower = middle
      else upper = middle
    }
    const fraction = (target - cumulative[lower]!) / Math.max(cumulative[upper]! - cumulative[lower]!, 1e-300)
    return radii[lower]! + fraction * (radii[upper]! - radii[lower]!)
  }
}

function placeOnSphere(puffs: PuffInstances, index: number, radius: number, random: () => number): void {
  const z = 2 * random() - 1
  const phi = 2 * Math.PI * random()
  const across = radius * Math.sqrt(1 - z * z)
  puffs.centers.set([across * Math.cos(phi), across * Math.sin(phi), radius * z], index * 3)
}

/** The glow's puffs, relative to the cluster center; the sphere looks the same along any axes. */
export function starClusterGlowPuffs(id: string, details: StarClusterDetails): PuffInstances {
  const { half_member_radius_pc: scale, tidal_radius_pc: limit, core_radius_pc: core, palette } = details
  const random = seededRandom(seedFor(id))
  const globularRadii = core === null ? null : globularRadius(core, scale, limit)
  const count = globularRadii ? GLOBULAR_GLOW_PUFFS : GLOW_PUFFS
  const alpha = globularRadii ? GLOBULAR_GLOW_ALPHA : GLOW_ALPHA
  const puffs = puffBuffer(count)
  const real = new Color(palette.real).toArray()
  const vivid = new Color(palette.exaggerated).toArray()
  for (let index = 0; index < count; index++) {
    let radius: number
    if (globularRadii) radius = globularRadii(random())
    else do radius = scale / Math.sqrt(random() ** (-2 / 3) - 1)
    while (!(radius <= limit))
    placeOnSphere(puffs, index, radius, random)
    // Larger puffs outward keep the faint outskirts smooth; a globular cluster's core keeps smaller ones.
    const size = globularRadii ? Math.max(core!, scale * 0.5 * Math.min(1, radius / scale)) : scale * (0.25 + 0.25 * Math.min(1, radius / scale))
    puffs.shapes.set([size, alpha * (0.7 + 0.3 * random()), 1 / (2 * scale), 0.37], index * 4)
    puffs.realColors.set(real, index * 3)
    puffs.vividColors.set(vivid, index * 3)
  }
  return puffs
}

/** A globular cluster's brightest giants, relative to its center, following the same profile as its glow. */
export function globularClusterStarPuffs(id: string, details: StarClusterDetails): PuffInstances {
  const { half_member_radius_pc: scale, tidal_radius_pc: limit, core_radius_pc: core, metallicity_fe_h: metallicity } = details
  const random = seededRandom(seedFor(`${id}:stars`))
  const radius = globularRadius(core!, scale, limit)
  const blueFraction = metallicity < METAL_POOR_FE_H ? 0.25 : 0.03
  const puffs = puffBuffer(GLOBULAR_STARS)
  const color = new Color()
  for (let index = 0; index < GLOBULAR_STARS; index++) {
    placeOnSphere(puffs, index, radius(random()), random)
    const kind = random()
    const [real, vivid] = kind < blueFraction ? BLUE_HORIZONTAL_BRANCH : kind < blueFraction + 0.1 ? TIP_GIANT : kind < 0.75 ? GIANT : SUBGIANT
    // Few stars are bright: the luminosity function falls steeply toward the tip of the giant branch.
    puffs.shapes.set([GLOBULAR_STAR_PC, GLOBULAR_STAR_ALPHA * (0.25 + 0.75 * random() ** 2), 0, 0.37], index * 4)
    puffs.realColors.set(color.set(real).toArray(), index * 3)
    puffs.vividColors.set(color.set(vivid).toArray(), index * 3)
  }
  return puffs
}

export interface StarClusterLayer {
  group: Group
  setVisible(visible: readonly boolean[]): void
  setColorMode(mode: StarColorMode): void
  setViewportHeight(pixels: number): void
  /** Follows each cluster's moving center and fades its glow, scaled by `opacity`, as the camera nears its stars. */
  update(camera: Camera, centers: readonly Vector3[], opacity: number): void
  dispose(): void
}

export function createStarClusterLayer(clusters: readonly Star[], mode: StarColorMode, glowOnly: ReadonlySet<string>): StarClusterLayer {
  const group = new Group()
  const glows = clusters.map((star) => {
    const cluster = star.cluster!
    let puffs: PuffInstances | null = null
    const globular = cluster.core_radius_pc !== null
    const detailRadius = globular ? GLOBULAR_DETAIL_RADII * cluster.half_member_radius_pc : cluster.tidal_radius_pc
    const source: PuffSource = {
      count: globular ? GLOBULAR_GLOW_PUFFS : GLOW_PUFFS,
      extent: { center: new Vector3(), semiAxes: [detailRadius, detailRadius] },
      // Generated on first draw.
      instances: () => (puffs ??= starClusterGlowPuffs(star.id, cluster)),
    }
    const layers = [createPuffLayer([source], mode, { maxScreenFraction: GLOW_MAX_SCREEN_FRACTION })]
    if (globular) {
      // Within range every giant is drawn: from afar each is far below a pixel and fades; nearer, it resolves.
      let stars: PuffInstances | null = null
      const starSource: PuffSource = { count: GLOBULAR_STARS, instances: () => (stars ??= globularClusterStarPuffs(star.id, cluster)) }
      layers.push(createPuffLayer([starSource], mode, { maxScreenFraction: GLOBULAR_STAR_MAX_SCREEN_FRACTION }))
    }
    for (const layer of layers) group.add(layer.mesh)
    const fade = glowOnly.has(star.id) ? null : GLOW_FADE_RADII.map((radii) => radii * cluster.half_member_radius_pc) as [number, number]
    return { layers, source, fade, starsRange: globular ? cluster.tidal_radius_pc + GLOBULAR_STARS_RANGE_PC : 0, starsShown: false }
  })
  const visibility = glows.map(() => false)
  const cameraPosition = new Vector3()
  const eachLayer = (action: (layer: NebulaLayer) => void) => glows.forEach(({ layers }) => layers.forEach(action))
  return {
    group,
    setVisible(visible) {
      glows.forEach((glow, index) => {
        visibility[index] = visible[index] === true
        glow.layers[0]!.setVisible([visibility[index]])
        // A hidden cluster hides its giants at once; update() shows them again within range.
        if (!visibility[index] && glow.starsShown) {
          glow.layers[1]!.setVisible([false])
          glow.starsShown = false
        }
      })
    },
    setColorMode(next) {
      eachLayer((layer) => layer.setColorMode(next))
    },
    setViewportHeight(pixels) {
      eachLayer((layer) => layer.setViewportHeight(pixels))
    },
    update(camera, centers, opacity) {
      cameraPosition.setFromMatrixPosition(camera.matrixWorld)
      glows.forEach((glow, index) => {
        const { layers, source, fade, starsRange } = glow
        const center = centers[index]!
        source.extent!.center.copy(center)
        const distance = cameraPosition.distanceTo(center)
        // The giants' layer is drawn only within the range where they can show.
        const starsShown = visibility[index] === true && distance < starsRange
        if (layers[1] && starsShown !== glow.starsShown) layers[1].setVisible([starsShown])
        glow.starsShown = starsShown
        const shown = fade ? opacity * distanceFade(distance, fade) : opacity
        for (const layer of layers) {
          // Puffs are stored relative to the center, which moves with the members.
          layer.mesh.position.copy(center)
          layer.setOpacity(shown)
          if (visibility[index]) layer.updateDetail(camera)
        }
      })
    },
    dispose() {
      eachLayer((layer) => layer.dispose())
    },
  }
}
