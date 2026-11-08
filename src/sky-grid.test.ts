import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeSkyGridGeometry, placeSkyGridLabels, skyConeCardinals, skyGridDirection, skyGridMarkers, skyWindowCone, type SkyGridLabelSlot } from './sky-grid'
import { skyAltitude, sunEquatorialPosition, visibilityConeHours } from './constellation-visibility'
import { earthOrbitMarker } from './earth-orbit'

describe('sky window cone', () => {
  const angleDeg = (a: Vector3, b: Vector3) => a.angleTo(b) * 180 / Math.PI
  const polaris = skyGridDirection('equatorial', 37.95, 89.264)
  const sirius = skyGridDirection('equatorial', 101.287, -16.716)
  const betelgeuse = skyGridDirection('equatorial', 88.793, 7.407)
  const rigel = skyGridDirection('equatorial', 78.634, -8.202)
  const november = new Date(Date.UTC(2026, 10, 4, 12))
  const december = new Date(Date.UTC(2026, 11, 15, 12))
  const inside = (cone: ReturnType<typeof skyWindowCone>, direction: Vector3) => angleDeg(cone.axis, direction) <= cone.halfAngleDeg

  it('holds Sirius and Orion from 50° N before dawn in November, but not in the early evening', () => {
    const dawn = skyWindowCone(50, november, visibilityConeHours('4-6')!)
    for (const star of [sirius, betelgeuse, rigel]) expect(inside(dawn, star)).toBe(true)
    const evening = skyWindowCone(50, november, visibilityConeHours('18-20')!)
    for (const star of [sirius, betelgeuse, rigel]) expect(inside(evening, star)).toBe(false)
  })

  it('keeps Polaris in view from the north and out of view from the south', () => {
    const hours = visibilityConeHours('22-24')!
    expect(inside(skyWindowCone(50, december, hours), polaris)).toBe(true)
    expect(inside(skyWindowCone(-30, december, hours), polaris)).toBe(false)
  })

  it('narrows as the zenith moves further through the window, most at the equator', () => {
    const hours = { start: 0, end: 2 }
    expect(skyWindowCone(0, december, hours).halfAngleDeg).toBeCloseTo(75, 6)
    expect(skyWindowCone(80, december, hours).halfAngleDeg).toBeGreaterThan(87)
  })

  it('turns with the date and the hour while its size stays fixed', () => {
    const hours = { start: 0, end: 2 }
    const june = new Date(Date.UTC(2026, 5, 15, 12))
    expect(angleDeg(skyWindowCone(40, june, hours).axis, skyWindowCone(40, december, hours).axis)).toBeGreaterThan(30)
    expect(skyWindowCone(40, june, hours).halfAngleDeg).toBeCloseTo(skyWindowCone(40, december, hours).halfAngleDeg, 6)
    expect(angleDeg(skyWindowCone(40, december, { start: 4, end: 6 }).axis, skyWindowCone(40, december, hours).axis)).toBeGreaterThan(20)
  })

  it('points away from the Sun, through Earth, around midnight as Earth moves around its orbit', () => {
    for (let month = 0; month < 12; month++) {
      const date = new Date(Date.UTC(2026, month, 15, 12))
      // Up to the 15° of a 1 am centre plus the obliquity's reach in declination.
      expect(angleDeg(skyWindowCone(0, date, { start: 0, end: 2 }).axis, earthOrbitMarker(date).earthPosition)).toBeLessThan(28)
    }
  })

  it.each([-60, -20, 0, 40, 80])('keeps everything inside above the horizon through the window at %d°', (latitude) => {
    const cone = skyWindowCone(latitude, december, { start: 22, end: 24 })
    const sunRa = sunEquatorialPosition(december).ra
    for (let ra = 0; ra < 360; ra += 10) {
      for (let dec = -85; dec <= 85; dec += 5) {
        if (!inside(cone, skyGridDirection('equatorial', ra, dec))) continue
        for (const hour of [22, 23, 24]) {
          expect(skyAltitude(dec, latitude, sunRa + (hour - 12) * 15 - ra)).toBeGreaterThanOrEqual(-1e-6)
        }
      }
    }
  })

  it.each([-60, -20, 0, 40])('puts the compass letters on the matching horizon sides at %d°', (latitude) => {
    const localSiderealDeg = sunEquatorialPosition(december).ra + (22 - 12) * 15
    const cone = skyWindowCone(latitude, december, { start: 22, end: 22 })
    const [north, east, south, west] = skyConeCardinals(cone)
    const pole = skyGridDirection('equatorial', 0, 90)
    // The pole stands at the latitude's altitude over the north point, and the letters sit 1° below the horizon.
    expect(angleDeg(north!, pole)).toBeCloseTo(Math.abs(latitude + 1), 3)
    expect(angleDeg(south!, pole.clone().negate())).toBeCloseTo(Math.abs(latitude - 1), 3)
    expect(angleDeg(east!, skyGridDirection('equatorial', localSiderealDeg + 90, 0))).toBeCloseTo(1, 3)
    expect(angleDeg(west!, skyGridDirection('equatorial', localSiderealDeg - 90, 0))).toBeCloseTo(1, 3)
    for (const direction of [north, east, south, west]) expect(angleDeg(cone.axis, direction!)).toBeCloseTo(cone.halfAngleDeg + 1, 3)
  })
})

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
