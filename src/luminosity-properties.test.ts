import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { buildCatalogClassReferences } from './catalog-class-references'
import { buildLuminosityClassReferences, equalFluxDistance, luminosityCardAvailable, luminosityComparisonClass, luminosityProperties, originFluxAtAu, SOLAR_FLUX_AT_AU } from './luminosity-properties'
import { luminosityClassRange, nearbySolarOrbit, solarOrbitMarkers } from './luminosity-card'

const sun: Star = {
  id: 'sun', name: 'Sun', type: 'star', spectral_type: 'G2V', mass_solar: 1, radius_solar: 1, luminosity_solar: 1, temperature_k: 5772,
  metallicity_dex: 0, age_gyr: 4.6, constellation: null, x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: 0, vy_kms: 0, vz_kms: 0,
  absolute_mag: 4.83, epoch: 2000, notes: '', raw_astrometry: null,
}

describe('bolometric luminosity physics and class references', () => {
  it('decomposes adopted luminosity into area and mean surface flux in solar units', () => {
    const properties = luminosityProperties(sun)
    expect(properties.areaM2! / 1e18).toBeCloseTo(6.0821, 3)
    expect(properties.surfaceFlux! / 1e6).toBeCloseTo(62.9387, 3)
    expect(properties.areaSolar).toBe(1)
    expect(properties.surfaceFluxSolar).toBeCloseTo(1, 4)
    expect(properties.areaSolar! * properties.surfaceFluxSolar!).toBeCloseTo(properties.catalogSolar!, 12)
    expect(properties.catalogSolar).toBe(1)
    expect(properties.catalogWatts).toBe(3.828e26)
    expect(SOLAR_FLUX_AT_AU).toBeCloseTo(1361.166, 3)
    const largerStar = luminosityProperties({ ...sun, radius_solar: 2, luminosity_solar: 64 })
    expect(largerStar.areaSolar).toBe(4)
    expect(largerStar.surfaceFluxSolar).toBeCloseTo(16, 12)
    expect(largerStar.areaSolar! * largerStar.surfaceFluxSolar!).toBeCloseTo(largerStar.catalogSolar!, 12)
  })

  it('uses 61 Cyg B catalog luminosity despite an independently estimated temperature', () => {
    const star = { ...sun, luminosity_solar: 0.09445296, radius_solar: 0.6768412, temperature_k: 4100 }
    const properties = luminosityProperties(star)
    expect(properties.catalogSolar).toBe(0.09445296)
    expect(properties.areaSolar).toBeCloseTo(0.458114, 6)
    expect(properties.surfaceFluxSolar).toBeCloseTo(0.206178, 6)
    expect(properties.areaSolar! * properties.surfaceFluxSolar!).toBeCloseTo(star.luminosity_solar, 12)
    expect(luminosityProperties({ ...star, temperature_k: null })).toEqual(properties)
    expect(luminosityProperties({ ...star, temperature_k: 3889.6328 })).toEqual(properties)
  })

  it('retains luminosity without radius and never invents missing luminosity', () => {
    const missingRadius = luminosityProperties({ ...sun, radius_solar: null })
    expect(missingRadius.areaSolar).toBeNull()
    expect(missingRadius.surfaceFlux).toBeNull()
    expect(missingRadius.catalogSolar).toBe(1)
    expect(missingRadius.catalogWatts).toBe(3.828e26)
    for (const luminosity_solar of [null, 0, -1, Infinity, NaN]) {
      const missingLuminosity = luminosityProperties({ ...sun, luminosity_solar })
      expect(missingLuminosity.catalogSolar).toBeNull()
      expect(missingLuminosity.catalogWatts).toBeNull()
      expect(missingLuminosity.surfaceFlux).toBeNull()
      expect(missingLuminosity.surfaceFluxSolar).toBeNull()
    }
  })

  it('puts brighter stars farther away and dimmer stars closer to match a given flux', () => {
    expect(equalFluxDistance({ ...sun, luminosity_solar: 100 }, sun).distanceAu).toBe(10)
    expect(equalFluxDistance({ ...sun, luminosity_solar: 0.01 }, sun).distanceAu).toBe(0.1)
    expect(equalFluxDistance({ ...sun, luminosity_solar: 100 }, { ...sun, luminosity_solar: 25 }).distanceAu).toBe(2)
    expect(originFluxAtAu({ ...sun, luminosity_solar: 25 })).toBe(SOLAR_FLUX_AT_AU * 25)
  })

  it('rejects exterior-flux comparisons inside a known photosphere', () => {
    expect(originFluxAtAu({ ...sun, radius_solar: 1000 })).toBeNull()
    const comparison = equalFluxDistance({ ...sun, luminosity_solar: 0.000001, radius_solar: 1 }, sun)
    expect(comparison.distanceAu).toBe(0.001)
    expect(comparison.insidePhotosphere).toBe(true)
  })

  it('does not invent luminosity for missing or nonstellar origins', () => {
    for (const luminosity_solar of [null, 0, -1, Infinity, NaN]) {
      const missing = { ...sun, luminosity_solar }
      expect(luminosityCardAvailable(missing)).toBe(false)
      expect(equalFluxDistance(sun, missing).distanceAu).toBeNull()
      expect(originFluxAtAu(missing)).toBeNull()
    }
    expect(luminosityCardAvailable({ ...sun, type: 'black_hole' })).toBe(false)
    expect(luminosityProperties({ ...sun, type: 'black_hole' }).surfaceFlux).toBeNull()
  })

  it('compares broad families within an explicit evolutionary stage, including Am stars and same-family intervals', () => {
    expect(luminosityComparisonClass({ ...sun, spectral_type: 'A0mA1Va' })?.key).toBe('AV')
    expect(luminosityComparisonClass({ ...sun, spectral_type: 'M1-M2Ia-ab' })?.key).toBe('MI')
    expect(luminosityComparisonClass({ ...sun, spectral_type: 'B8Ia' })?.key).toBe('BI')
    expect(luminosityComparisonClass({ ...sun, spectral_type: 'sdM3' })?.key).toBe('MVI')
    for (const spectral_type of ['G2', 'G9V-K4V', 'B2IV+B3V', 'K2/K3III']) {
      const classification = luminosityComparisonClass({ ...sun, spectral_type })
      if (spectral_type === 'K2/K3III') expect(classification?.key).toBe('KIII')
      else expect(classification).toBeNull()
    }
    expect(luminosityComparisonClass({ ...sun, type: 'white_dwarf', spectral_type: 'DA2' })?.key).toBe('DA')
    expect(luminosityComparisonClass({ ...sun, type: 'brown_dwarf', spectral_type: 'L7.5' })?.key).toBe('brown_dwarf:L')
    expect(luminosityComparisonClass({ ...sun, type: 'brown_dwarf', spectral_type: 'L8+/-1' })?.key).toBe('brown_dwarf:L')
  })

  it('uses measured class distributions and falls back to published envelopes without inventing a median', () => {
    const range = luminosityClassRange({ ...sun, spectral_type: 'A1V' })!
    expect(range.low).toBeGreaterThan(8)
    expect(range.low).toBeLessThan(9)
    expect(range.high).toBeGreaterThan(100)
    expect(range.median).toBeGreaterThan(range.low)
    expect(range.median).toBeLessThan(range.high)
    expect(range.centralRange).not.toBeNull()
    expect(range.context).toMatch(/^Catalog range/)
    const referenceOnly = luminosityClassRange({ ...sun, spectral_type: 'O3V' })!
    expect(referenceOnly.median).toBeNull()
    expect(referenceOnly.centralRange).toBeNull()
    expect(referenceOnly.source).not.toBe('')
    expect(luminosityClassRange({ ...sun, spectral_type: 'G2' })).toBeNull()
  })

  it('calculates medians and central percentiles for every supported broad stellar and substellar family', () => {
    const classifications: Pick<Star, 'type' | 'spectral_type'>[] = [
      ...'OBAFGKM'.split('').map((letter) => ({ type: 'star' as const, spectral_type: `${letter}2V` })),
      ...['DA', 'DB', 'DC', 'DO', 'DQ', 'DZ'].map((family) => ({ type: 'white_dwarf' as const, spectral_type: `${family}2` })),
      ...['M', 'L', 'T', 'Y'].flatMap((family) => [
        { type: 'brown_dwarf' as const, spectral_type: `${family}2` },
        { type: 'sub_brown_dwarf' as const, spectral_type: `${family}2` },
      ]),
    ]
    for (const classification of classifications) {
      const stars = [100, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((luminosity_solar, index) => ({
        ...sun, ...classification, id: `member-${index}`, luminosity_solar,
      }))
      const sample = buildLuminosityClassReferences(stars)[0]!
      expect(sample).toMatchObject({ low: 1, high: 100, count: 10, median: 5.5 })
      expect(sample.p10).toBeCloseTo(1.9, 10)
      expect(sample.p90).toBeCloseTo(18.1, 10)
      const oddSample = buildLuminosityClassReferences(stars.slice(1))[0]!
      expect(oddSample.median).toBe(5)
    }
  })

  it('uses the closest planetary orbital size only within twenty percent, through Neptune', () => {
    expect(nearbySolarOrbit(0.387)).toBe('Mercury')
    expect(nearbySolarOrbit(0.85)).toBe('Earth')
    expect(nearbySolarOrbit(4.97)).toBe('Jupiter')
    expect(nearbySolarOrbit(5.202887 * 0.8)).toBe('Jupiter')
    expect(nearbySolarOrbit(5.202887 * 1.2)).toBe('Jupiter')
    expect(nearbySolarOrbit(5.202887 * 0.799)).toBeNull()
    expect(nearbySolarOrbit(5.202887 * 1.201)).toBeNull()
    expect(nearbySolarOrbit(30.06992276)).toBe('Neptune')
    for (const distance of [0.038, 3, 40, 0, -1, NaN, Infinity]) expect(nearbySolarOrbit(distance)).toBeNull()
  })

  it('chooses sparse solar orbit references that fit the shared linear distance scale', () => {
    const names = (maximum: number) => solarOrbitMarkers(maximum).map((marker) => marker.name)
    expect(names(1)).toEqual(['Mercury', 'Venus'])
    expect(names(1.08)).toEqual(['Mercury', 'Venus', 'Earth'])
    expect(names(1.3)).toEqual(['Earth'])
    expect(names(1.5)).toEqual(['Earth'])
    expect(names(2)).toEqual(['Earth', 'Mars'])
    expect(names(4)).toEqual(['Earth', 'Mars'])
    expect(names(5.37)).toEqual(['Earth', 'Mars', 'Jupiter'])
    expect(names(6)).toEqual(['Earth', 'Mars', 'Jupiter'])
    expect(names(6.001)).toEqual(['Earth', 'Mars', 'Jupiter'])
    expect(names(8)).toEqual(['Earth', 'Mars', 'Jupiter'])
    expect(names(10)).toEqual(['Earth', 'Jupiter', 'Saturn'])
    expect(names(19.2)).toEqual(['Earth', 'Jupiter', 'Uranus'])
    expect(names(26.3)).toEqual(['Earth', 'Jupiter', 'Uranus'])
    expect(names(30)).toEqual(['Earth', 'Jupiter', 'Uranus'])
    expect(names(31)).toEqual(['Earth', 'Neptune'])
    expect(names(1000)).toEqual(['Earth', 'Neptune'])
    const jupiter = solarOrbitMarkers(5.37).find((marker) => marker.name === 'Jupiter')!
    expect(solarOrbitMarkers(jupiter.distanceAu).at(-1)).toEqual(jupiter)
    expect(names(jupiter.distanceAu - 0.001)).toEqual(['Earth', 'Mars'])
    const neptune = solarOrbitMarkers(31).find((marker) => marker.name === 'Neptune')!
    expect(solarOrbitMarkers(neptune.distanceAu).at(-1)).toEqual(neptune)
    expect(names(neptune.distanceAu - 0.001)).toEqual(['Earth', 'Jupiter', 'Uranus'])
    for (const maximum of [0.2, 0.5, 1.08, 2, 4, 5.37, 10, 19.2, 31, 1000]) {
      expect(solarOrbitMarkers(maximum).every((marker) => marker.distanceAu <= maximum)).toBe(true)
    }
    for (const maximum of [0, -1, NaN, Infinity]) expect(solarOrbitMarkers(maximum)).toEqual([])
  })

  it('counts deduplicated component measurements across catalogs, pools subtypes and keeps stages separate', () => {
    const first = { ...sun, id: 'first', name: 'first', spectral_type: 'B1Ia', luminosity_solar: 100 }
    const second = { ...sun, id: 'second', name: 'second', spectral_type: 'B8Ib', luminosity_solar: 400 }
    const third = { ...sun, id: 'third', name: 'third', spectral_type: 'B2V', luminosity_solar: 20 }
    const result = buildCatalogClassReferences([
      { id: 'nearest-1000', stars: [first, second, third] },
      { id: 'bright-stars', stars: [{ ...first, luminosity_solar: 999 }, { ...sun, id: 'missing', name: 'missing', spectral_type: 'B8Ia', luminosity_solar: null }] },
    ])
    expect(result.luminosityClasses.find(({ key }) => key === 'BI')).toEqual({ key: 'BI', label: 'B-type supergiant', low: 100, high: 400, count: 2, median: 250, p10: 130, p90: 370 })
    expect(result.luminosityClasses.find(({ key }) => key === 'BV')?.count).toBe(1)
  })
})
