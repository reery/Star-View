import { Group, Vector3 } from 'three'
import type { Star } from './catalog-model'
import { LIGHT_YEARS_PER_PARSEC, type StarColorMode } from './astronomy'
import { createPuffLayer, puffSource, type NebulaLayer } from './nebula-layer'
import { distanceFade } from './milky-way-layer'

// From this camera distance, a blob of faint objects is only a clump of
// overlapping minimum-size dots: one soft cloud stands in for its members.
// Only drawing changes; lists, counts and filters still include every member.
export const FAINT_CLOUD_COLLAPSE_PC = 7500 / LIGHT_YEARS_PER_PARSEC
const FAINT_CLOUD_FADE_PC = [6000 / LIGHT_YEARS_PER_PARSEC, FAINT_CLOUD_COLLAPSE_PC] as const
const BLOB_CELL_PC = 150 / LIGHT_YEARS_PER_PARSEC
const MIN_BLOB_MEMBERS = 25

// Luminosity classes I–IV (or an old "g" prefix) mark giants, which stay drawn.
const GIANT = /^g|(?<![IV])(?:III|II|IV|I)(?![IV])/

/** Red dwarfs and everything fainter: M, L, T and Y dwarfs, brown and white dwarfs, and unclassified stars. */
export function isFaintObject(star: Pick<Star, 'type' | 'spectral_type'>): boolean {
  if (star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf' || star.type === 'white_dwarf') return true
  if (star.type !== 'star') return false
  const spectral = star.spectral_type?.trim() ?? ''
  const letter = spectral.match(/^(?:esd|usd|sd|d|g)?([OBAFGKMLTY])/)?.[1]
  return !letter || ('MLTY'.includes(letter) && !GIANT.test(spectral))
}

export interface FaintBlob { members: number[]; center: Vector3; radius: number }

/** Groups faint objects whose grid cells touch; groups too small to blur together stay as dots. */
export function faintObjectBlobs(positions: readonly Vector3[], faint: (index: number) => boolean): FaintBlob[] {
  const cells = new Map<string, number[]>()
  positions.forEach((position, index) => {
    if (!faint(index)) return
    const key = position.toArray().map((value) => Math.floor(value / BLOB_CELL_PC)).join()
    const cell = cells.get(key)
    if (cell) cell.push(index)
    else cells.set(key, [index])
  })
  const parent = new Map([...cells.keys()].map((key) => [key, key]))
  const root = (key: string): string => {
    while (parent.get(key) !== key) key = parent.get(key)!
    return key
  }
  for (const key of cells.keys()) {
    const [x, y, z] = key.split(',').map(Number) as [number, number, number]
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const neighbor = `${x + dx},${y + dy},${z + dz}`
      if (cells.has(neighbor)) parent.set(root(neighbor), root(key))
    }
  }
  const groups = new Map<string, number[]>()
  for (const [key, members] of cells) {
    const group = groups.get(root(key))
    if (group) group.push(...members)
    else groups.set(root(key), [...members])
  }
  return [...groups.values()].filter((members) => members.length >= MIN_BLOB_MEMBERS).map((members) => {
    const center = members.reduce((sum, index) => sum.add(positions[index]!), new Vector3()).divideScalar(members.length)
    // Cover nearly all members without letting a few stragglers inflate the cloud.
    const distances = members.map((index) => positions[index]!.distanceTo(center))
    const radius = [...distances].sort((a, b) => a - b)[Math.floor(0.9 * (distances.length - 1))]!
    // Stragglers chained in through neighboring cells stay as their own dots.
    return { members: members.filter((_, member) => distances[member]! <= 1.25 * radius), center, radius }
  })
}

export interface FaintObjectClouds {
  group: Group
  /** Fades each cloud with camera distance; returns true when a blob collapses or expands. */
  update(cameraPosition: Vector3): boolean
  collapsed(blob: number): boolean
  /** Hides clouds whose members are all filtered out. */
  setShown(shown: readonly boolean[]): void
  setColorMode(mode: StarColorMode): void
  setViewportHeight(pixels: number): void
  dispose(): void
}

export function createFaintObjectClouds(blobs: readonly FaintBlob[], mode: StarColorMode): FaintObjectClouds {
  const group = new Group()
  const layers: NebulaLayer[] = blobs.map(({ center, radius }) => {
    const layer = createPuffLayer([puffSource({
      count: 1,
      centers: Float32Array.from(center.toArray()),
      shapes: Float32Array.of(radius, 0.5, 1 / radius, 0.5),
      realColors: Float32Array.of(1, 0.62, 0.3),
      vividColors: Float32Array.of(1, 0.48, 0.16),
    })], mode)
    layer.setVisible([true])
    // Behind star cores, above the Milky Way, like the other extended glows.
    layer.mesh.renderOrder = 1.5
    group.add(layer.mesh)
    return layer
  })
  const collapsed = blobs.map(() => false)
  let shown = blobs.map(() => true)
  const fades = blobs.map(() => 0)
  const sync = (index: number) => {
    layers[index]!.mesh.visible = shown[index]! && fades[index]! > 0
  }
  return {
    group,
    update(cameraPosition) {
      let changed = false
      blobs.forEach(({ center }, index) => {
        const distance = cameraPosition.distanceTo(center)
        fades[index] = distanceFade(distance, FAINT_CLOUD_FADE_PC)
        layers[index]!.setOpacity(fades[index]!)
        sync(index)
        const next = distance >= FAINT_CLOUD_COLLAPSE_PC
        if (next !== collapsed[index]) changed = true
        collapsed[index] = next
      })
      return changed
    },
    collapsed: (blob) => collapsed[blob]!,
    setShown(next) {
      shown = blobs.map((_, index) => next[index] === true)
      blobs.forEach((_, index) => sync(index))
    },
    setColorMode(next) {
      for (const layer of layers) layer.setColorMode(next)
    },
    setViewportHeight(pixels) {
      for (const layer of layers) layer.setViewportHeight(pixels)
    },
    dispose() {
      for (const layer of layers) layer.dispose()
    },
  }
}
