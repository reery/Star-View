import { describe, expect, it } from 'vitest'
import { readSpectralType, spectralLines } from './spectral-type'

const parts = (type: string) => readSpectralType(type).parts.map(({ text }) => text)
const meaning = (type: string, part: string) => readSpectralType(type).parts.find(({ text }) => text === part)?.meaning

describe('readSpectralType', () => {
  it('splits M-K types into class, subtype, luminosity class and suffixes', () => {
    expect(parts('G2V')).toEqual(['G', '2', 'V'])
    expect(parts('K1.5IIIFe-0.5')).toEqual(['K', '1.5', 'III', 'Fe-0.5'])
    expect(meaning('K1.5IIIFe-0.5', 'Fe-0.5')).toBe('Iron lines weaker than normal for this type')
    expect(parts('F5IV-V')).toEqual(['F', '5', 'IV-V'])
    expect(meaning('F5IV-V', 'IV-V')).toBe('Luminosity class: between subgiants and main sequence')
    expect(parts('M0VpCa-3Cr-1')).toEqual(['M', '0', 'V', 'p', 'Ca-3', 'Cr-1'])
  })

  it('reads Keenan half-steps, ranges and activity suffixes', () => {
    expect(parts('M2+Vk')).toEqual(['M', '2', '+', 'V', 'k'])
    expect(meaning('M2+Vk', '+')).toBe('Slightly later (cooler) than this subtype')
    expect(parts('K0-IIIb')).toEqual(['K', '0', '-', 'IIIb'])
    expect(meaning('K0-IIIb', 'IIIb')).toBe('Luminosity class: giants, fainter part')
    expect(parts('G9V(k)')).toEqual(['G', '9', 'V', '(k)'])
    expect(parts('K2/3V')).toEqual(['K', '2', '/3', 'V'])
    expect(parts('M1.5 Vk:')).toEqual(['M', '1.5', 'V', 'k', ':'])
  })

  it('places metallic-line stars by their hydrogen type', () => {
    expect(parts('kA2hA5mA7V')).toEqual(['kA2', 'hA5', 'mA7', 'V'])
    expect(readSpectralType('kA2hA5mA7V')).toMatchObject({ letter: 'A', subtype: 5 })
    expect(parts('A0mA1Va')).toEqual(['A', '0', 'mA1', 'Va'])
  })

  it('decodes white dwarfs, prefixes, substellar gravity flags and composites', () => {
    expect(parts('DA2')).toEqual(['D', 'A', '2'])
    expect(meaning('DA2', '2')).toBe('Temperature index: about 25,200 K')
    expect(readSpectralType('DAZ')).toMatchObject({ whiteDwarf: 'AZ', letter: null })
    expect(parts('dM4.5')).toEqual(['d', 'M', '4.5'])
    expect(parts('L2beta')).toEqual(['L', '2', 'beta'])
    expect(parts('T0+T2?')).toEqual(['T', '0', '+ T2?'])
    expect(parts('> T9')).toEqual(['>', 'T', '9'])
    expect(parts('DA8P')).toEqual(['D', 'A', 'P', '8'])
    expect(parts('B1IVe_shell')).toEqual(['B', '1', 'IV', 'e', 'shell'])
    expect(parts('L8+/-1')).toEqual(['L', '8', '+/-1'])
  })

  it('keeps unknown notation as written instead of guessing', () => {
    expect(readSpectralType('O4I(n)fp').parts.at(-1)).toEqual({ text: 'fp', meaning: 'Further catalog notation' })
    expect(parts('B9IVp_lB?')).toEqual(['B', '9', 'IV', 'p', 'lB', '?'])
    expect(readSpectralType(null).parts).toEqual([])
  })
})

describe('spectralLines', () => {
  const strongest = (type: string) => {
    const lines = spectralLines(readSpectralType(type))!
    return lines.reduce((best, line) => line.strength > best.strength ? line : best).label
  }

  it('follows the classic sequence of dominant features', () => {
    expect(strongest('O5V')).toBe('He II')
    expect(strongest('B2V')).toBe('He I')
    expect(strongest('A0V')).toMatch(/^H/)
    expect(strongest('G2V')).toBe('Ca II')
    expect(strongest('M5V')).toBe('TiO')
  })

  it('deepens red TiO before blue-green TiO and weakens TiO in subdwarfs', () => {
    const tio = (type: string, nm: number) => spectralLines(readSpectralType(type))!.find((line) => line.label === 'TiO' && line.nm === nm)?.strength ?? 0
    expect(tio('M1V', 705.4)).toBeGreaterThan(tio('M1V', 495.4))
    expect(tio('sdM1', 705.4)).toBeLessThan(tio('M1V', 705.4))
    expect(tio('esdM1', 705.4)).toBeLessThan(tio('sdM1', 705.4))
    expect(readSpectralType('sdM1')).toMatchObject({ prefix: 'sd', letter: 'M', subtype: 1 })
    const cah = spectralLines(readSpectralType('esdM5'))!.find((line) => line.label === 'CaH')!.strength
    expect(cah).toBeGreaterThan(tio('esdM5', 705.4))
    expect(cah).toBeLessThan(tio('M5V', 705.4))
  })

  it('draws white-dwarf families and skips unsupported classes', () => {
    expect(spectralLines(readSpectralType('DC9'))).toEqual([])
    expect(strongest('DA2')).toMatch(/^H/)
    expect(spectralLines(readSpectralType('DX'))).toBeNull()
    expect(spectralLines(readSpectralType('T6'))).toBeNull()
    expect(spectralLines(readSpectralType(null))).toBeNull()
  })
})
