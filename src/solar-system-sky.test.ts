import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { earthOrbitMarker } from './earth-orbit'
import { earthShadowRadii, MOON_RADIUS_KM, solarSystemSky, type SkyMoon } from './solar-system-sky'

const degreesBetween = (first: { angleTo(other: never): number }, second: unknown) => first.angleTo(second as never) * 180 / Math.PI
/** The Moon center's distance from Earth's shadow axis, and the umbra's radius there, in km. */
function shadowAtMoon({ fromEarthKm, shadowAxis, sunDistanceKm }: SkyMoon) {
  const along = fromEarthKm.dot(shadowAxis)
  return { offset: fromEarthKm.clone().addScaledVector(shadowAxis, -along).length(), ...earthShadowRadii(along, sunDistanceKm) }
}
const sunDirection = (date: Date) => earthOrbitMarker(date).earthPosition.negate().normalize()

describe('solar system sky', () => {
  it('puts the Moon on the Sun at the total solar eclipse of 12 August 2026', () => {
    const date = new Date('2026-08-12T17:46:00Z')
    // Gamma 0.898: the shadow axis passes 0.9 Earth radii from Earth's center, about 0.85° of lunar parallax.
    const separation = degreesBetween(solarSystemSky(date).moon.direction, sunDirection(date))
    expect(separation).toBeGreaterThan(0.6)
    expect(separation).toBeLessThan(1.1)
  })

  it('puts the Moon opposite the Sun at the total lunar eclipse of 3 March 2026', () => {
    const date = new Date('2026-03-03T11:33:00Z')
    const { moon } = solarSystemSky(date)
    expect(degreesBetween(moon.direction, sunDirection(date).negate())).toBeLessThan(0.6)
    // A full Moon is lit from behind the observer.
    expect(degreesBetween(moon.sunDirection, moon.direction.clone().negate())).toBeLessThan(1)
    expect(moon.angularRadius * 180 / Math.PI).toBeGreaterThan(0.24)
    expect(moon.angularRadius * 180 / Math.PI).toBeLessThan(0.28)
    // A full Moon is about −12.7 mag.
    expect(moon.magnitude).toBeCloseTo(-12.7, 0)
  })

  it('shows Jupiter and Saturn opposite the Sun at opposition, at their observed brightness', () => {
    const jupiterDate = new Date('2026-01-10T08:00:00Z')
    const jupiter = solarSystemSky(jupiterDate).planets.find(({ id }) => id === 'jupiter')!
    expect(degreesBetween(jupiter.direction, sunDirection(jupiterDate).negate())).toBeLessThan(1)
    expect(jupiter.magnitude).toBeCloseTo(-2.7, 0)
    const saturnDate = new Date('2025-09-21T05:00:00Z')
    const saturn = solarSystemSky(saturnDate).planets.find(({ id }) => id === 'saturn')!
    expect(degreesBetween(saturn.direction, sunDirection(saturnDate).negate())).toBeLessThan(3)
    // Its rings were nearly edge-on, so Saturn was unusually faint for an opposition.
    expect(saturn.magnitude).toBeGreaterThan(0.4)
    expect(saturn.magnitude).toBeLessThan(0.8)
  })

  it('lists the seven other major planets with plausible magnitudes', () => {
    const { planets } = solarSystemSky(new Date('2026-11-13T00:00:00Z'))
    expect(planets.map(({ id }) => id)).toEqual(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'])
    const range: Record<string, [number, number]> = {
      mercury: [-2.6, 5.8], venus: [-4.9, -3.8], mars: [-3, 1.9], jupiter: [-2.95, -1.6], saturn: [-0.6, 1.5], uranus: [5.3, 6.1], neptune: [7.6, 8.0],
    }
    for (const planet of planets) {
      expect(planet.magnitude).toBeGreaterThan(range[planet.id]![0])
      expect(planet.magnitude).toBeLessThan(range[planet.id]![1])
    }
  })

  it('moves the Moon by its parallax for an observer on the surface', () => {
    const date = new Date('2026-03-03T11:33:00Z')
    const geocentric = solarSystemSky(date).moon.direction
    // With the Moon on the horizon, its parallax is greatest.
    const zenith = geocentric.clone().cross(new Vector3(0, 1, 0)).normalize()
    const shifted = solarSystemSky(date, zenith).moon.direction
    expect(degreesBetween(geocentric, shifted)).toBeGreaterThan(0.85)
    expect(degreesBetween(geocentric, shifted)).toBeLessThan(1.05)
  })

  it('puts the Moon in Earth’s shadow during lunar eclipses', () => {
    // Total on 3 March 2026 (gamma −0.38): the whole Moon inside the umbra.
    const total = shadowAtMoon(solarSystemSky(new Date('2026-03-03T11:33:00Z')).moon)
    expect(total.offset + MOON_RADIUS_KM).toBeLessThan(total.umbra)
    // Partial on 28 August 2026: the umbra covered 0.93 of the Moon's diameter.
    const partial = shadowAtMoon(solarSystemSky(new Date('2026-08-28T04:13:00Z')).moon)
    expect((partial.umbra - partial.offset + MOON_RADIUS_KM) / (2 * MOON_RADIUS_KM)).toBeCloseTo(0.93, 1)
    // Two weeks later the Moon is new, nowhere near the shadow.
    const later = shadowAtMoon(solarSystemSky(new Date('2026-03-17T11:33:00Z')).moon)
    expect(later.offset).toBeGreaterThan(later.penumbra)
  })
})
