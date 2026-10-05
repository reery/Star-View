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
    expect(bubbles).toHaveLength(1)
    expect(manifest.counts).toEqual({ bubble: 1 })
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
    expect(surface.indices).toHaveLength(16_128 * 3)
    expect(surface.positions.length / 3).toBeLessThan(8_500)
    expect(surface.bounds.max.y).toBeGreaterThan(580)
    expect(surface.bounds.max.y).toBeLessThan(605)
    expect(surface.bounds.max.x - surface.bounds.min.x).toBeLessThan(630)
    expect(surface.bounds.max.z - surface.bounds.min.z).toBeLessThan(805)
  })

  it('merges shells into a single visibility-controlled mesh', () => {
    const layer = createBubbleLayer(bubbles, 'real')
    const visible = layer.mesh.geometry.getAttribute('bubbleVisible')
    const selected = layer.mesh.geometry.getAttribute('bubbleSelected')
    expect(layer.triangleCount()).toBe(16_128)
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
