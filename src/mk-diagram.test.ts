import { describe, expect, it } from 'vitest'
import { mkPoint, whiteDwarfClassification } from './mk-diagram'

const classify = (spectral_type: string | null) => mkPoint({ type: 'star', spectral_type })

describe('Morgan–Keenan classification', () => {
  it('places a hot dwarf left of the Sun and a giant above the dwarf row', () => {
    const sun = classify('G2V')!
    const sirius = classify('A1V')!
    const giant = classify('K2III')!
    expect(sun.luminosityClass).toBe('V')
    expect(sirius.x).toBeLessThan(sun.x)
    expect(sirius.y).toBe(sun.y)
    expect(giant.x).toBeGreaterThan(sun.x)
    expect(giant.y).toBeLessThan(sun.y)
  })

  it('retains fractional subtypes and ignores ordinary spectral qualifiers', () => {
    expect(classify('M5.5Ve')).toMatchObject({ spectralClass: 'M', subtype: 5.5, luminosityClass: 'V' })
    expect(classify('B2IVn')).toMatchObject({ spectralClass: 'B', subtype: 2, luminosityClass: 'IV' })
    expect(classify('G2VI')).toMatchObject({ luminosityClass: 'VI' })
  })

  it('retains the explicit stages of uncertain and chemically annotated component spectra', () => {
    expect(classify('K3:III')).toMatchObject({ spectralClass: 'K', subtype: 3, luminosityClass: 'III' })
    expect(classify('B2:V:')).toMatchObject({ spectralClass: 'B', subtype: 2, luminosityClass: 'V' })
    expect(classify('F7(V)')).toMatchObject({ spectralClass: 'F', subtype: 7, luminosityClass: 'V' })
    expect(classify('kA0hA3(IV)SiSr')).toMatchObject({ spectralClass: 'A', subtype: 3, luminosityClass: 'IV' })
    expect(classify('A7.5')).toBeNull()
  })

  it('places Am stars by their metallic-line type', () => {
    expect(classify('A0mA1Va')).toMatchObject({ spectralClass: 'A', subtype: 1, luminosityClass: 'V' })
  })

  it('distinguishes hypergiants and the Ia, Iab, Ib and II classes', () => {
    const rows = ['Ia+', 'Ia', 'Iab', 'Ib', 'II'].map((luminosity) => classify(`B1${luminosity}`)!)
    expect(rows.map((point) => point.luminosityClass)).toEqual(['Ia+', 'Ia', 'Iab', 'Ib', 'II'])
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.y).toBeGreaterThan(rows[i - 1]!.y)
  })

  it('places explicit intermediate luminosity classes between their rows', () => {
    const intermediate = classify('G2IV-V')!
    expect(intermediate.luminosityClass).toBe('IV–V')
    expect(intermediate.y).toBeCloseTo((classify('G2IV')!.y + classify('G2V')!.y) / 2)
  })

  it('does not guess a luminosity class or map other schemes into the O–M grid', () => {
    for (const spectral of [null, 'G2', 'G', 'M3?', 'DA2', 'L8V', 'T1V', 'Y4', 'sdM4', 'WN5', 'G2V+K1V']) expect(classify(spectral)).toBeNull()
    expect(mkPoint({ type: 'white_dwarf', spectral_type: 'DA2' })).toBeNull()
    expect(mkPoint({ type: 'brown_dwarf', spectral_type: 'M8V' })).toBeNull()
  })
})

describe('white-dwarf D classification', () => {
  const classifyD = (spectral_type: string | null) => whiteDwarfClassification({ type: 'white_dwarf', spectral_type })

  it('places Sirius B in DA while preserving its temperature index', () => {
    expect(classifyD('DA2')).toEqual({ family: 'DA', spectralType: 'DA2', description: 'Hydrogen lines' })
    expect(classifyD('DB3.5')).toMatchObject({ family: 'DB', spectralType: 'DB3.5' })
  })

  it('keeps hybrid features and magnetic qualifiers in the full catalog label', () => {
    expect(classifyD('DAB2')).toMatchObject({ family: 'DA', spectralType: 'DAB2' })
    expect(classifyD('DBA4')).toMatchObject({ family: 'DB', spectralType: 'DBA4' })
    expect(classifyD('DAP3')).toMatchObject({ family: 'DA', spectralType: 'DAP3' })
    for (const family of ['DA', 'DB', 'DC', 'DO', 'DQ', 'DZ', 'DX']) expect(classifyD(family)?.family).toBe(family)
  })

  it('does not infer DX or classify ordinary stars as white dwarfs', () => {
    for (const spectral of [null, 'D', 'DH', 'G2V', 'DA2+M4V']) expect(classifyD(spectral)).toBeNull()
    expect(whiteDwarfClassification({ type: 'star', spectral_type: 'DA2' })).toBeNull()
  })
})
