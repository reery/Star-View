import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { LIGHT_YEARS_PER_PARSEC } from './astronomy'
import { faintObjectBlobs, isFaintObject } from './faint-object-cloud'

describe('faint objects', () => {
  it('covers red dwarfs and everything fainter, but not giants or brighter dwarfs', () => {
    const faint = (type: string, spectral_type: string | null) => isFaintObject({ type: type as 'star', spectral_type })
    for (const spectral of ['M3.5Ve', 'M2/3V', 'M5', 'sdM1', 'L5', 'T8', 'Y0', null, '']) expect(faint('star', spectral)).toBe(true)
    for (const type of ['brown_dwarf', 'sub_brown_dwarf', 'white_dwarf']) expect(faint(type, null)).toBe(true)
    for (const spectral of ['G2V', 'K7V', 'A1V', 'M2Iab', 'M0.5III', 'M4IV', 'gM0']) expect(faint('star', spectral)).toBe(false)
    expect(faint('pulsar', null)).toBe(false)
    expect(faint('molecular_cloud', null)).toBe(false)
  })

  it('merges a dense neighbourhood into one blob and leaves stragglers and small groups as dots', () => {
    const ly = (x: number, y = 0, z = 0) => new Vector3(x, y, z).divideScalar(LIGHT_YEARS_PER_PARSEC)
    const positions = [
      ...Array.from({ length: 200 }, (_, index) => ly(70 * Math.cos(index), 70 * Math.sin(index * 1.7), 70 * Math.sin(index))),
      // A chain of stragglers reaching far beyond the neighbourhood.
      ...[150, 280, 410, 540].map((x) => ly(x)),
      // A small, separate group.
      ...Array.from({ length: 5 }, (_, index) => ly(3000 + index)),
    ]
    const blobs = faintObjectBlobs(positions, () => true)
    expect(blobs).toHaveLength(1)
    expect(blobs[0]!.members.every((index) => index < 200)).toBe(true)
    expect(blobs[0]!.center.length() * LIGHT_YEARS_PER_PARSEC).toBeLessThan(30)
    expect(blobs[0]!.radius * LIGHT_YEARS_PER_PARSEC).toBeGreaterThan(50)
    expect(blobs[0]!.radius * LIGHT_YEARS_PER_PARSEC).toBeLessThan(130)
    expect(faintObjectBlobs(positions, (index) => index >= 200)).toHaveLength(0)
  })
})
