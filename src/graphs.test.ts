import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { objectTypeCensus, radialVelocity, spectralGroup } from './graphs'

const object = (id: string, type: Star['type'], temperature_k: number | null) => ({ id, type, temperature_k }) as Star

describe('object type census', () => {
  it('counts the Sun as a star, merges sub-brown dwarfs and sorts by count', () => {
    const census = objectTypeCensus([
      object('sun', 'star', 5772), object('a', 'star', 3000), object('b', 'star', 4000),
      object('c', 'brown_dwarf', 1200), object('d', 'sub_brown_dwarf', 400), object('e', 'white_dwarf', null),
    ])
    expect(census.map(({ label, count }) => [label, count])).toEqual([['Stars', 3], ['Brown dwarfs', 2], ['White dwarfs', 1]])
    expect(census[0]!.typical.id).toBe('b')
    expect(census[2]!.typical.id).toBe('e')
  })
})

describe('spectral groups', () => {
  it('reads the Harvard class letter, skipping subdwarf and Am prefixes', () => {
    const group = (type: Star['type'], spectral_type: string | null) => spectralGroup({ type, spectral_type })
    expect(group('star', 'M5.5Ve')).toBe('M')
    expect(group('star', 'sdM1')).toBe('M')
    expect(group('star', 'kA2hA5mA7V')).toBe('A')
    expect(group('brown_dwarf', 'T8')).toBe('T')
    expect(group('white_dwarf', 'DA2')).toBe('D')
    expect(group('star', null)).toBeNull()
    expect(group('pulsar', 'B0')).toBeNull()
  })
})

describe('radial velocity', () => {
  const body = (x_pc: number, vx_kms: number | null) => ({ x_pc, y_pc: 0, z_pc: 0, vx_kms, vy_kms: 0, vz_kms: 0 }) as Star
  it('is negative while approaching the reference and needs both motions', () => {
    expect(radialVelocity(body(2, -10), body(0, 0))).toBe(-10)
    expect(radialVelocity(body(2, 5), body(4, 0))).toBe(-5)
    expect(radialVelocity(body(2, 5), body(0, null))).toBeNull()
    expect(radialVelocity(body(0, 5), body(0, 0))).toBeNull()
  })
})
