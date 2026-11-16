import { describe, expect, it } from 'vitest'
import manifestRaw from './data/overlays/nebulae/manifest.json?raw'
import payloadRaw from './data/overlays/nebulae/objects.json?raw'
import type { Star } from './catalog-model'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from './nebula-overlay-model'
import { specValues } from './spec-values'
import {
  blackbodyColorIndex, isWavelengthBandId, MOLECULAR_CLOUD_BANDS, nebulaBandSurfaceBrightness, registerWavelengthBandData, shownInBand,
  WAVELENGTH_BANDS, wavelengthAbsoluteMagnitude, type WavelengthBandData,
} from './wavelength-vision'

const nebulae = parseNebulaOverlayPayload(JSON.parse(payloadRaw), parseNebulaOverlayManifest(manifestRaw))
const nebula = (id: string) => nebulae.find((candidate) => candidate.id === id)!

function star(fields: Partial<Star>): Star {
  return {
    type: 'star', id: 'test', name: 'Test', spectral_type: null, constellation: null, x_pc: 10, y_pc: 0, z_pc: 0,
    vx_kms: null, vy_kms: null, vz_kms: null, temperature_k: null, mass_solar: null, luminosity_solar: null, radius_solar: null,
    metallicity_dex: null, age_gyr: null, absolute_mag: null, epoch: 2000, notes: '', raw_astrometry: null, ...fields,
  } as Star
}

const pulsar = (compact: Partial<NonNullable<Star['compact']>>) => star({ type: 'pulsar', compact: { associations: [], detection_method: 'Radio pulses', radio_luminosity_1400_mjy_kpc2: null, ...compact } as NonNullable<Star['compact']> })

describe('wavelength bands', () => {
  it('orders the bands from the shortest wavelength to the longest, with visible light among them', () => {
    expect(WAVELENGTH_BANDS.map((band) => band.id)).toEqual(['gamma', 'x-ray', 'ultraviolet', 'visible', 'near-infrared', 'far-infrared', 'radio'])
    // Each band starts where the previous one ends, or after a gap (the mid infrared), on the logarithmic bar.
    WAVELENGTH_BANDS.forEach(({ wavelengthsM: [shortest, longest] }, index) => {
      expect(longest).toBeGreaterThan(shortest)
      expect(shortest).toBeGreaterThanOrEqual(WAVELENGTH_BANDS[index - 1]?.wavelengthsM[1] ?? 0)
    })
    expect(isWavelengthBandId('radio')).toBe(true)
    expect(isWavelengthBandId('microwave')).toBe(false)
  })

  it('gives blackbody colors relative to a Vega-like star', () => {
    expect(blackbodyColorIndex(9600, 2.2)).toBeCloseTo(0, 10)
    // The Sun is redder than Vega: brighter in K and fainter in the ultraviolet, relative to V.
    expect(blackbodyColorIndex(5772, 2.2)).toBeCloseTo(-1.19, 2)
    expect(blackbodyColorIndex(5772, 0.23)).toBeGreaterThan(1.5)
    expect(blackbodyColorIndex(30_000, 0.23)).toBeLessThan(0)
  })

  it('brightens cool stars in the near infrared and hot ones in the ultraviolet', () => {
    const red = star({ temperature_k: 3000, absolute_mag: 12 })
    const blue = star({ temperature_k: 25_000, absolute_mag: -3 })
    expect(wavelengthAbsoluteMagnitude(red, 'near-infrared')!).toBeLessThan(12 - 3)
    expect(wavelengthAbsoluteMagnitude(blue, 'ultraviolet')!).toBeLessThan(-3)
    expect(wavelengthAbsoluteMagnitude(red, 'visible')).toBe(12)
  })

  it('estimates a missing V from luminosity and temperature, and keeps V without a temperature', () => {
    expect(wavelengthAbsoluteMagnitude(star({ temperature_k: 5772, luminosity_solar: 1 }), 'near-infrared')).toBeCloseTo(4.83 - 1.19, 2)
    expect(wavelengthAbsoluteMagnitude(star({ absolute_mag: 8 }), 'near-infrared')).toBe(8)
  })

  it('removes ordinary stars outside the thermal bands', () => {
    const sunLike = star({ temperature_k: 5772, absolute_mag: 4.83 })
    for (const band of ['gamma', 'x-ray', 'far-infrared', 'radio'] as const) {
      expect(shownInBand(sunLike, band)).toBe(false)
      expect(wavelengthAbsoluteMagnitude(sunLike, band)).toBeNull()
    }
  })

  it('shows pulsars by their radio luminosity, gamma-ray association or X-ray evidence', () => {
    // About 1 Jy at Vela's 287 pc shows near magnitude 0.
    const radio = pulsar({ radio_luminosity_1400_mjy_kpc2: 1000 * 0.287 ** 2 })
    expect(wavelengthAbsoluteMagnitude(radio, 'radio')! + 5 * (Math.log10(287) - 1)).toBeCloseTo(0, 6)
    expect(shownInBand(radio, 'gamma')).toBe(false)
    expect(shownInBand(pulsar({ associations: ['Gamma-ray source: 4FGL J0835.3-4510'] }), 'gamma')).toBe(true)
    expect(shownInBand(pulsar({ associations: ['X-ray source: RX J0007.0+7303'] }), 'x-ray')).toBe(true)
    expect(shownInBand(pulsar({ detection_method: 'Astrometric and spectroscopic binary orbit' }), 'x-ray')).toBe(false)
  })

  it('gives every supernova remnant a high-energy or radio appearance and keeps visible light unchanged', () => {
    for (const remnant of nebulae.filter((candidate) => candidate.type === 'supernova_remnant')) {
      expect(['gamma', 'x-ray', 'radio'].some((band) => nebulaBandSurfaceBrightness(remnant, band as 'gamma') !== null), remnant.id).toBe(true)
    }
    for (const candidate of nebulae) expect(nebulaBandSurfaceBrightness(candidate, 'visible')).toBe(candidate.nebula!.surface_brightness_mag_arcsec2)
    expect(nebulaBandSurfaceBrightness(nebula('crab-nebula'), 'x-ray')!).toBeLessThan(nebulaBandSurfaceBrightness(nebula('sn-1006'), 'x-ray')!)
    expect(shownInBand(nebula('pleiades-nebula'), 'x-ray')).toBe(false)
    expect(shownInBand(nebula('orion-nebula'), 'radio')).toBe(true)
  })

  it('prefers measured values over the model once a band’s data is loaded', () => {
    const data = (objects: WavelengthBandData['objects']): WavelengthBandData => ({ unit: '', sources: {}, objects })
    // At 10 pc the absolute magnitude equals the apparent one.
    const measured = star({ id: 'measured', temperature_k: 5772, absolute_mag: 4.83, x_pc: 10 })
    expect(shownInBand(measured, 'x-ray')).toBe(false)
    registerWavelengthBandData('x-ray', data({ measured: [1e-11, null, 'erass1'] }))
    registerWavelengthBandData('near-infrared', data({ measured: [3.2, 0.02, '2mass'] }))
    expect(shownInBand(measured, 'x-ray')).toBe(true)
    expect(wavelengthAbsoluteMagnitude(measured, 'x-ray')).toBeCloseTo(2.5, 10)
    expect(wavelengthAbsoluteMagnitude(measured, 'near-infrared')).toBe(3.2)
    // A remnant's measured radio flux sets its surface brightness: more flux on the same area is brighter.
    const casA = nebula('cassiopeia-a')
    registerWavelengthBandData('radio', data({ 'cassiopeia-a': [2_000_000, null, 'green'] }))
    const bright = nebulaBandSurfaceBrightness(casA, 'radio')!
    registerWavelengthBandData('radio', data({ 'cassiopeia-a': [200_000, null, 'green'] }))
    expect(nebulaBandSurfaceBrightness(casA, 'radio')!).toBeCloseTo(bright + 2.5, 10)
  })

  it('lets dust clouds fade in the near infrared and glow in the far infrared', () => {
    expect(MOLECULAR_CLOUD_BANDS['near-infrared'].absorption).toBeLessThan(0.3)
    expect(MOLECULAR_CLOUD_BANDS['far-infrared']).toEqual({ absorption: 0, glow: 1 })
  })
})

describe('band values on the object card', () => {
  const source = { label: 'Survey', reference: 'Author 2024', url: '', note: '0.2–2.3 keV flux' }
  const measured = star({ id: 'card-star' })
  const sun = star({ id: 'sun', x_pc: 0 })

  it('shows the measured value in the chosen band with its source, and nothing in visible light', () => {
    registerWavelengthBandData('x-ray', { unit: 'erg cm-2 s-1', sources: { survey: source }, objects: { 'card-star': [6.182e-11, 1.66e-12, 'survey', '1eRASS J0', 'Whole system'] } })
    registerWavelengthBandData('radio', { unit: 'mJy', sources: { survey: source }, objects: { 'card-star': [2_400_000, null, 'survey'] } })
    registerWavelengthBandData('near-infrared', { unit: 'mag', sources: { survey: source }, objects: { 'card-star': [4.213, 0.02, 'survey'] } })
    expect(specValues(measured, sun, 'ly', 'x-ray')['band-value']).toEqual({
      text: '(6.18 ± 0.17) × 10⁻¹¹ erg/cm²/s', label: 'X-ray flux',
      title: '1eRASS J0. Survey, Author 2024. 0.2–2.3 keV flux. Whole system.',
    })
    expect(specValues(measured, sun, 'ly', 'radio')['band-value']!.text).toBe('2,400 Jy')
    expect(specValues(measured, sun, 'ly', 'near-infrared')['band-value']!.text).toBe('4.21 ± 0.02')
    expect(specValues(measured, sun, 'ly', 'visible')['band-value']!.text).toBe('—')
  })
})
