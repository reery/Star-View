import { describe, expect, it } from 'vitest'
import { ARMS, armRadius, galactocentricToWorld, generateGalaxyPuffs } from './galaxy-layer'
import { distanceFade } from './milky-way-layer'

const arm = (name: string) => ARMS.find((candidate) => candidate.name === name)!

describe('Galaxy model', () => {
  it('places the Sun at the origin and the Galactic Center toward l = 0°', () => {
    expect(galactocentricToWorld(8150, 0, 5.5).map((value) => Math.abs(value))).toEqual([0, 0, 0])
    expect(galactocentricToWorld(0, 0, 0)).toEqual([8150, -5.5, -0])
    // Increasing azimuth follows Galactic rotation, toward l = 90° (world -z).
    expect(galactocentricToWorld(8150, 10, 0)[2]).toBeLessThan(0)
  })

  it('follows the published arm fits and puts the Sun on the Local Arm’s inner edge', () => {
    for (const { kink, radius, ...rest } of ARMS) expect(armRadius({ kink, radius, ...rest }, kink)).toBeCloseTo(radius, 10)
    const local = armRadius(arm('Local'), 0)
    expect(local - 8.15).toBeGreaterThan(0.2)
    expect(local - 8.15).toBeLessThan(0.5)
    expect(armRadius(arm('Sagittarius–Carina'), 0)).toBeLessThan(8.15)
    expect(armRadius(arm('Perseus'), 0)).toBeGreaterThan(local)
  })

  it('continues Norma across the far side into the Outer arm', () => {
    expect(armRadius(arm('Norma'), -289)).toBeCloseTo(armRadius(arm('Outer'), 71), 1)
  })

  it('generates the same finite puffs every time, within the Galactic disk', () => {
    const first = generateGalaxyPuffs()
    const second = generateGalaxyPuffs()
    expect(second.emission.centers).toEqual(first.emission.centers)
    expect(second.dust.shapes).toEqual(first.dust.shapes)
    for (const puffs of [first.emission, first.dust]) {
      expect(puffs.count).toBeGreaterThan(0)
      expect(puffs.centers.every(Number.isFinite) && puffs.shapes.every(Number.isFinite)).toBe(true)
      for (let index = 0; index < puffs.count; index++) {
        const [x, y, z] = puffs.centers.subarray(index * 3, index * 3 + 3)
        expect(Math.hypot(x! - 8150, z!)).toBeLessThan(20_000)
        expect(Math.abs(y!)).toBeLessThan(3000)
      }
    }
  })
})

describe('Milky Way distance fade', () => {
  it('eases from 0 to 1 across the range on a logarithmic scale', () => {
    const range = [1000, 10_000] as const
    expect(distanceFade(500, range)).toBe(0)
    expect(distanceFade(1000, range)).toBe(0)
    expect(distanceFade(Math.sqrt(1000 * 10_000), range)).toBeCloseTo(0.5, 10)
    expect(distanceFade(10_000, range)).toBe(1)
    expect(distanceFade(50_000, range)).toBe(1)
  })
})
