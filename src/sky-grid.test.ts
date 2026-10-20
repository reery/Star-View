import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeSkyGridGeometry, placeSkyGridLabels, skyGridDirection, skyGridMarkers, type SkyGridLabelSlot } from './sky-grid'

describe('sky coordinate frames', () => {
  it('places Galactic center, increasing longitude and north on the established world axes', () => {
    expect(skyGridDirection('galactic', 0, 0).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-9)
    expect(skyGridDirection('galactic', 90, 0).distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-9)
    expect(skyGridDirection('galactic', 0, 90).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-9)
  })

  it('aligns the equatorial grid with the ICRS north Galactic pole and celestial pole', () => {
    expect(skyGridDirection('equatorial', 192.85948, 27.12825).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6)
    expect(skyGridDirection('equatorial', 0, 90).distanceTo(new Vector3(-0.4838350155, 0.4559837762, -0.7469822445))).toBeLessThan(1e-9)
  })

  it.each(['equatorial', 'galactic'] as const)('keeps every %s segment on the unit sphere with stronger equator lines', (frame) => {
    const geometry = makeSkyGridGeometry(frame)
    const positions = geometry.getAttribute('position')
    const emphasis = geometry.getAttribute('emphasis')
    expect(positions.count).toBeGreaterThan(0)
    expect(positions.count % 2).toBe(0)
    expect(emphasis.count).toBe(positions.count)
    const point = new Vector3()
    for (let index = 0; index < positions.count; index++) expect(point.fromBufferAttribute(positions, index).length()).toBeCloseTo(1, 6)
    expect(Array.from(emphasis.array)).toContain(1)
    expect(Array.from(emphasis.array).some((strength) => strength < 1)).toBe(true)
    geometry.dispose()
  })

  it('labels RA in hours, Galactic longitude in degrees, and declination with signed angles', () => {
    const equatorial = skyGridMarkers('equatorial').map((marker) => marker.text)
    const galactic = skyGridMarkers('galactic').map((marker) => marker.text)
    expect(equatorial).toEqual(expect.arrayContaining(['0h', '22h', 'Dec −80°', 'Dec −20°', 'Dec +20°', 'Dec +80°', 'North celestial pole']))
    expect(galactic).toEqual(expect.arrayContaining(['l 0°', 'l 330°', 'b −80°', 'b −20°', 'b +20°', 'b +80°', 'South galactic pole']))
    expect(equatorial).not.toContain('Dec +30°')
    expect(galactic).not.toContain('b +30°')
    expect(equatorial).not.toContain('24h')
    expect(galactic).not.toContain('l 360°')
  })
})

describe('sky grid label placement', () => {
  const viewport = { left: 0, top: 0, width: 800, height: 600 }
  const slot = (x: number, y: number): SkyGridLabelSlot => ({ visible: true, x, y, width: 30, height: 12, placed: false })

  it('checks collisions only on layout passes so labels do not toggle between throttled star layouts', () => {
    const labels = [slot(100, 100), slot(300, 100)]
    let blockedCalls = 0
    // The first label overlaps a star name reserved during the layout pass.
    placeSkyGridLabels(labels, viewport, (bounds) => { blockedCalls++; return bounds.left < 200 }, true)
    expect(labels.map((label) => label.placed)).toEqual([false, true])
    expect(blockedCalls).toBe(2)

    // Between passes the star names are absent from the obstacle index.
    labels[0]!.x += 2
    labels[1]!.x += 2
    placeSkyGridLabels(labels, viewport, () => { blockedCalls++; return false }, false)
    expect(labels.map((label) => label.placed)).toEqual([false, true])
    expect(blockedCalls).toBe(2)
  })

  it('still hides placed labels that leave the view between layout passes', () => {
    const labels = [slot(100, 100), slot(300, 100)]
    placeSkyGridLabels(labels, viewport, () => false, true)
    labels[0]!.visible = false
    labels[1]!.x = 790
    placeSkyGridLabels(labels, viewport, () => false, false)
    expect(labels.map((label) => label.placed)).toEqual([false, false])
  })

  it('keeps grid labels from overlapping each other on layout passes', () => {
    const labels = [slot(100, 100), slot(105, 102), slot(300, 100)]
    placeSkyGridLabels(labels, viewport, () => false, true)
    expect(labels.map((label) => label.placed)).toEqual([true, false, true])
  })
})
