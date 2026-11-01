import { describe, expect, it } from 'vitest'
import { equatorialToGalacticPc, type Star } from './catalog-model'
import { objectLinks } from './object-links'
import objectLinkData from './data/object-links.json'

const object = (overrides: Partial<Star> = {}): Star => ({
  type: 'star', id: 'sirius-b', name: 'Sirius B', constellation: 'Canis Major', spectral_type: 'DA2',
  ...equatorialToGalacticPc(101.287, -16.716, 2.64),
  vx_kms: null, vy_kms: null, vz_kms: null, temperature_k: null, mass_solar: null,
  luminosity_solar: null, radius_solar: null, metallicity_dex: null, age_gyr: null,
  absolute_mag: null, epoch: 2000, notes: '', raw_astrometry: null, ...overrides,
})

describe('selected-object links', () => {
  it('orders links by importance and builds encoded source URLs', () => {
    const links = objectLinks(object(), {
      wikipedia: 'PSR J0437−4715#Planetary system',
      kaler: { page: 'sirius', title: 'Sirius' },
      atnf: 'J0437-4715',
      esaHubble: { image: 'heic0516a', title: 'Sirius A and B' },
    })
    expect(links.map((link) => link.title.split(':')[0])).toEqual(['Wikipedia', 'Aladin Lite', 'Jim Kaler’s STARS', 'ATNF Pulsar Catalogue', 'ESA/Hubble'])
    expect(links[0]!.url).toBe('https://en.wikipedia.org/wiki/PSR_J0437%E2%88%924715#Planetary_system')
    expect(links[1]!.url).toBe('https://aladin.cds.unistra.fr/AladinLite/?target=101.28700%20-16.71600&fov=0.25')
    expect(links[3]!.url).toContain('pulsar_names=J0437-4715&')
  })

  it('shows only links that exist for the object', () => {
    expect(objectLinks(object({ id: 'sun', x_pc: 0, y_pc: 0, z_pc: 0 }), undefined)).toEqual([])
    expect(objectLinks(object({ type: 'bubble', bubble: {} as Star['bubble'] }), undefined)).toEqual([])
    const nebula = object({ type: 'reflection_nebula', nebula: { ra_deg: 56.658333, dec_deg: 24.178056, angular_size_arcmin: [90, 70] } as Star['nebula'] })
    expect(objectLinks(nebula, undefined).map((link) => link.url)).toEqual(['https://aladin.cds.unistra.fr/AladinLite/?target=56.65833%20%2B24.17806&fov=2.4'])
  })

  it('keeps the shipped data to known link fields', () => {
    const fields = new Set(Object.values(objectLinkData.objects).flatMap((entry) => Object.keys(entry)))
    expect([...fields].every((field) => ['wikipedia', 'kaler', 'atnf', 'esaHubble'].includes(field))).toBe(true)
  })
})
