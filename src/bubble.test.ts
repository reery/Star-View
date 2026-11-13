import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import manifestRaw from './data/overlays/bubbles/manifest.json?raw'
import payloadRaw from './data/overlays/bubbles/objects.json?raw'
import surfaceRaw from './data/overlays/bubbles/local-bubble-surface.json?raw'
import { starDisplayColor } from './astronomy'
import { bubbleRadiusPc, createBubbleLayer, generateBubbleSurface } from './bubble-layer'
import { hydrateBubbleSurfaceGridFiles, parseBubbleOverlayManifest, parseBubbleOverlayPayload } from './bubble-overlay-model'

const manifest = parseBubbleOverlayManifest(manifestRaw)
function hydratedPayload(): unknown {
  return hydrateBubbleSurfaceGridFiles(JSON.parse(payloadRaw), (filename) => {
    if (filename !== 'local-bubble-surface.json') throw new Error(`Unexpected surface: ${filename}`)
    return JSON.parse(surfaceRaw)
  })
}

const bubbles = parseBubbleOverlayPayload(hydratedPayload(), manifest)
const localBubble = bubbles[0]!

function direction(longitudeDeg: number, latitudeDeg: number): Vector3 {
  const longitude = longitudeDeg * Math.PI / 180
  const latitude = latitudeDeg * Math.PI / 180
  return new Vector3(Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude))
}

describe('bubble overlay data', () => {
  it('validates the sourced Local Bubble record', () => {
    expect(bubbles.map(({ id }) => id)).toEqual(['local-bubble', 'loop-i-superbubble', 'orion-eridanus-superbubble', 'per-tau-shell'])
    expect(manifest.counts).toEqual({ bubble: 4 })
    expect(localBubble).toMatchObject({ id: 'local-bubble', type: 'bubble', x_pc: -9.8, y_pc: 1.9, z_pc: 0.2 })
    expect(localBubble.bubble).toMatchObject({
      average_radius_pc: 170,
      surface_distance_range_pc: [70, 600],
      surface_distance_max_open: true,
      shell_thickness_pc: 35,
      shape: {
        kind: 'directional_grid',
        surface_grid: { longitude_segments: 128, latitude_segments: 64, source_point_count: 786_392 },
      },
    })
  })

  it('rejects malformed shapes and count mismatches', () => {
    const malformed = hydratedPayload() as any
    malformed.objects[0].bubble.shape.surface_grid.radii_pc[0] = 0
    expect(() => parseBubbleOverlayPayload(malformed, manifest)).toThrow(/row/)
    const wrongType = JSON.parse(payloadRaw)
    wrongType.objects[0].type = 'hii_region'
    expect(() => parseBubbleOverlayPayload(wrongType, manifest)).toThrow(/row/)
  })

  it('uses restrained and exaggerated shell colors', () => {
    expect(starDisplayColor(localBubble, 'real').getHexString()).toBe('77b9d6')
    expect(starDisplayColor(localBubble, 'exaggerated').getHexString()).toBe('54d5f3')
  })
})

describe('published directional bubble shell', () => {
  it('keeps the nearby wall compact while preserving the narrow northern chimney and southern tunnel', () => {
    const details = localBubble.bubble!
    expect(bubbleRadiusPc(details, direction(53.4375, 11.25))).toBeCloseTo(77)
    expect(bubbleRadiusPc(details, direction(137.8125, 78.75))).toBeCloseTo(602)
    expect(bubbleRadiusPc(details, direction(250, -20))).toBeGreaterThan(370)
  })

  it('generates one compact indexed surface within the published coordinate envelope', () => {
    const surface = generateBubbleSurface(localBubble)
    expect(surface.indices).toHaveLength(5_120 * 3)
    expect(surface.positions.length / 3).toBe(2_562)
    expect(surface.bounds.max.y).toBeGreaterThan(460)
    expect(surface.bounds.max.y).toBeLessThan(605)
    expect(surface.bounds.max.x - surface.bounds.min.x).toBeLessThan(630)
    expect(surface.bounds.max.z - surface.bounds.min.z).toBeLessThan(805)
  })

  it('merges shells into a single visibility-controlled mesh', () => {
    const layer = createBubbleLayer(bubbles, 'real')
    const visible = layer.mesh.geometry.getAttribute('bubbleVisible')
    const selected = layer.mesh.geometry.getAttribute('bubbleSelected')
    expect(layer.triangleCount()).toBe(5_120 + 3 * 980)
    expect(layer.mesh.visible).toBe(false)
    expect(visible.getX(0)).toBe(0)
    layer.setVisible([true])
    expect(layer.mesh.visible).toBe(true)
    expect(visible.getX(0)).toBe(1)
    layer.setSelected('local-bubble')
    expect(selected.getX(0)).toBe(1)
    layer.setColorMode('exaggerated')
    layer.setVisible([false])
    expect(layer.mesh.visible).toBe(false)
    layer.dispose()
  })
})

describe('published model shells', () => {
  const byId = (id: string) => bubbles.find((bubble) => bubble.id === id)!
  // World space is Galactic (x, z, -y); distances are frame-independent.
  const vertexDistances = (surface: ReturnType<typeof generateBubbleSurface>, center: Vector3) => {
    const distances: number[] = []
    for (let index = 0; index < surface.positions.length; index += 3) {
      distances.push(Math.hypot(surface.positions[index]! - center.x, surface.positions[index + 1]! - center.y, surface.positions[index + 2]! - center.z))
    }
    return distances
  }

  it('renders each model on a 980-triangle shell within its reported bounds', () => {
    for (const id of ['loop-i-superbubble', 'orion-eridanus-superbubble', 'per-tau-shell']) {
      const bubble = byId(id)
      const surface = generateBubbleSurface(bubble)
      const { x, y, z } = bubble.bubble!.reported_bounds_pc
      expect(surface.indices.length / 3, id).toBe(980)
      expect(surface.bounds.min.x, id).toBeGreaterThanOrEqual(x[0] - 1)
      expect(surface.bounds.max.x, id).toBeLessThanOrEqual(x[1] + 1)
      expect(surface.bounds.min.z, id).toBeGreaterThanOrEqual(-y[1] - 1)
      expect(surface.bounds.max.z, id).toBeLessThanOrEqual(-y[0] + 1)
      expect(surface.bounds.min.y, id).toBeGreaterThanOrEqual(z[0] - 1)
      expect(surface.bounds.max.y, id).toBeLessThanOrEqual(z[1] + 1)
    }
  })

  it('keeps the published sphere radii of Loop I (Wolleben 2007) and the Per-Tau Shell (Bialy et al. 2021)', () => {
    for (const [id, radius] of [['loop-i-superbubble', 75], ['per-tau-shell', 78]] as const) {
      const bubble = byId(id)
      const distances = vertexDistances(generateBubbleSurface(bubble), new Vector3(bubble.x_pc, bubble.z_pc, -bubble.y_pc))
      expect(Math.min(...distances), id).toBeCloseTo(radius, 3)
      expect(Math.max(...distances), id).toBeCloseTo(radius, 3)
    }
  })

  it('reproduces the nearest and farthest walls of the Pon et al. (2016) θ = −35° Orion–Eridanus model', () => {
    const bubble = byId('orion-eridanus-superbubble')
    const distances = vertexDistances(generateBubbleSurface(bubble), new Vector3())
    expect(Math.min(...distances)).toBeGreaterThan(176)
    expect(Math.min(...distances)).toBeLessThan(184)
    expect(Math.max(...distances)).toBeGreaterThan(412)
    expect(Math.max(...distances)).toBeLessThan(420)
    // The Orion end lies 54 pc below the driving source, the Eridanus end 224 pc above it.
    expect(bubbleRadiusPc(bubble.bubble!, direction(229.05, 18.64))).toBeCloseTo(54.1, 1)
    expect(bubbleRadiusPc(bubble.bubble!, direction(49.05, -18.64))).toBeCloseTo(224.1, 1)
  })
})
