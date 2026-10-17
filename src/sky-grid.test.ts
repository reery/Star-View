import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeSkyGridGeometry, skyGridDirection, skyGridMarkers } from './sky-grid'

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
