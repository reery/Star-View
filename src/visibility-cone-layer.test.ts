import { describe, expect, it } from 'vitest'
import { Vector3, type Mesh } from 'three'
import { LIGHT_YEARS_PER_PARSEC } from './astronomy'
import { earthOrbitMarker } from './earth-orbit'
import { createVisibilityConeLayer } from './visibility-cone-layer'

describe('visibility cone layer', () => {
  const date = new Date(Date.UTC(2026, 10, 4, 12))
  const cone = { axis: new Vector3(1, 2, -2).normalize(), halfAngleDeg: 80 }
  const layer = createVisibilityConeLayer({ value: 0.3 })
  layer.setCone(cone, date)
  const band = layer.rim.children[0] as Mesh
  const positions = layer.rim.geometry.getAttribute('position')
  const fade = layer.rim.geometry.getAttribute('fade')
  const rimVertices = layer.rim.geometry.drawRange.count
  const angleFromAxis = (index: number) => new Vector3().fromBufferAttribute(positions, index).angleTo(cone.axis) * 180 / Math.PI

  it('draws the rim at the half-angle around the axis', () => {
    expect(rimVertices).toBe(positions.count / 2)
    for (let index = 0; index < rimVertices; index++) {
      expect(new Vector3().fromBufferAttribute(positions, index).length()).toBeCloseTo(1, 5)
      expect(angleFromAxis(index)).toBeCloseTo(80, 3)
      expect(fade.getX(index)).toBe(1)
    }
  })

  it('fades a narrow band from the rim towards the centre of the cone', () => {
    for (let index = rimVertices; index < positions.count; index++) {
      expect(angleFromAxis(index)).toBeLessThan(80)
      expect(angleFromAxis(index)).toBeGreaterThan(75)
      expect(fade.getX(index)).toBe(0)
    }
    const indices = Array.from(band.geometry.getIndex()!.array)
    expect(indices).toHaveLength(rimVertices * 6)
    expect(Math.max(...indices)).toBe(positions.count - 1)
  })

  it('runs a two light-year wall from Earth along the same cone, fading to nothing', () => {
    const wall = layer.wall.geometry.getAttribute('position')
    const color = layer.wall.geometry.getAttribute('color')
    expect(layer.wall.position.distanceTo(earthOrbitMarker(date).earthPosition)).toBeLessThan(1e-12)
    expect(new Vector3().fromBufferAttribute(wall, 0).length()).toBe(0)
    expect(color.getW(0)).toBe(1)
    for (let index = 1; index < wall.count; index++) {
      const edge = new Vector3().fromBufferAttribute(wall, index)
      expect(edge.length() * LIGHT_YEARS_PER_PARSEC).toBeCloseTo(2, 4)
      expect(edge.angleTo(cone.axis) * 180 / Math.PI).toBeCloseTo(80, 3)
      expect(color.getW(index)).toBe(0)
    }
  })

  it('moves with the cone', () => {
    layer.setCone({ axis: new Vector3(0, 1, 0), halfAngleDeg: 60 }, date)
    expect(new Vector3().fromBufferAttribute(positions, 0).angleTo(new Vector3(0, 1, 0)) * 180 / Math.PI).toBeCloseTo(60, 3)
  })
})
