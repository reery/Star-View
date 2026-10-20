import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { indexStarSystems, reviewedStarSystems, starComponentIdentity } from './star-systems'
import { mergeCatalogStars } from './catalog-runtime'
import { mkPoint } from './mk-diagram'
import { catalogMeasurement, missingCatalogMeasurements } from './catalog-source'
import { parseObjectStats, supplementObjectStats } from './object-stats'
import { parseObjectIdentities, supplementObjectIdentities } from './designations'
import { apparentVisualMagnitude } from './astronomy'
import { spaceMotionForStar } from './space-motion'

const bright = parseStarCatalog(readFileSync(new URL('./data/catalogs/bright-stars/stars.csv', import.meta.url), 'utf8'))
const western = parseStarCatalog(readFileSync(new URL('./data/catalogs/western-constellation-stars/stars.csv', import.meta.url), 'utf8'))
const dubhe = bright.find((star) => star.id === 'bright-dubhe')!
const sun = bright.find((star) => star.id === 'sun')!

describe('component coverage shared by every catalog', () => {
  it.each([['bright stars', bright], ['constellation stars', western]])('exposes the reviewed Castor and Spica individuals in %s', (_label, input) => {
    const completed = completeCatalogCompanions(input)
    const byId = new Map(completed.map((star) => [starComponentIdentity(star.id)?.canonicalStarId ?? star.id, star]))
    const ca = byId.get('msc-07346+3153-c')!, cb = byId.get('msc-07346+3153-cb')!
    expect(ca).toMatchObject({ name: 'Castor Ca', mass_solar: .60597, radius_solar: .614, apparent_mag: null })
    expect(cb).toMatchObject({ name: 'Castor Cb', mass_solar: .60633, radius_solar: .612, apparent_mag: null })
    expect(indexStarSystems(completed).get(ca.id)?.components.map((component) => component.label))
      .toEqual(['Aa', 'Ab', 'Ba', 'Bb', 'Ca', 'Cb'])
    for (const star of [ca, cb]) {
      expect(star.unresolved_photometry?.scope).toContain('Ca+Cb')
      expect(star.catalog_sources?.some((source) => source.record.name === 'Castor C')).toBe(true)
      expect(star.notes).toContain('adopted common atmosphere parameter')
    }
    const a = byId.get('bright-spica')!, b = byId.get('msc-13252-1110-ab')!
    expect(a).toMatchObject({ name: 'Spica Aa', mass_solar: 11.43, radius_solar: 7.47, temperature_k: 25300, apparent_mag: null })
    expect(b).toMatchObject({ name: 'Spica Ab', mass_solar: 7.21, radius_solar: 3.74, temperature_k: 20900, apparent_mag: null })
    expect(byId.has('msc-13252-1110-ac')).toBe(true)
    expect(a.catalog_sources?.some((source) => source.record.name === 'Spica Aab')).toBe(true)
    for (const source of input.filter((star) => ['bright-spica', 'hip-65474'].includes(star.id))) {
      expect(missingCatalogMeasurements(source, byId.get('bright-spica')!)).toEqual([])
    }
  })

  it('keeps Nunki model masses distinct from total dynamical mass and updates the beta Aur solution', () => {
    const stars = new Map(completeCatalogCompanions(bright).map((star) => [star.id, star]))
    for (const [id, mass, radius] of [['bright-nunki', 6.5, 4.1], ['msc-18553-2618-ab', 6.3, 3.9]] as const) {
      const star = stars.get(id)!
      expect(star.mass_solar).toBe(mass)
      expect(star.radius_solar).toBe(radius)
      expect(star.luminosity_solar).toBeNull()
      expect(star.notes).toContain('total binary mass')
    }
    expect(stars.get('bright-menkalinan')).toMatchObject({ mass_solar: 2.359, radius_solar: 2.752 })
    expect(stars.get('orb6-05595+4457-aa-ab-ab')).toMatchObject({ mass_solar: 2.293, radius_solar: 2.622 })
    expect(stars.get('orb6-05595+4457-aa-ab-ab')?.temperature_k).toBe(Math.round(9350 * .997543))
  })

  it.each(['nearest-100', 'nearest-1000'])('applies reviewed component gap repairs and preserves pair flux in %s', (catalog) => {
    const input = parseStarCatalog(readFileSync(new URL(`./data/catalogs/${catalog}/stars.csv`, import.meta.url), 'utf8'))
    const stars = new Map(completeCatalogCompanions(input).map((star) => [star.id, star]))
    for (const [aId, bId, aMass, bMass, pairV, deltaV] of [
      ['10pc-0066', '10pc-0067', .223, .109, 11.14, 3.08],
      ['10pc-0074', '10pc-0075', .1379, .1258, 12.47, -.01],
      ['10pc-0087', '10pc-0088', .120, .081, 13.41, 3.29],
    ] as const) {
      const a = stars.get(aId)!, b = stars.get(bId)!
      expect(a.mass_solar).toBe(aMass)
      expect(b.mass_solar).toBe(bMass)
      expect(b.apparent_mag! - a.apparent_mag!).toBeCloseTo(deltaV, 8)
      expect(-2.5 * Math.log10(10 ** (-.4 * a.apparent_mag!) + 10 ** (-.4 * b.apparent_mag!)))
        .toBeCloseTo(pairV, 8)
      for (const star of [a, b]) {
        expect(star.absolute_mag).not.toBeNull()
        expect(star.notes).not.toContain('multi-star system V withheld')
      }
    }
    expect(stars.get('10pc-0030')?.mass_solar).toBe(.6289) // 61 Cyg B is the fit's primary.
    expect(stars.get('10pc-0110')).toMatchObject({ mass_solar: .573, radius_solar: .01308, luminosity_solar: .01349 })
  })

  it('keeps reviewed component gap repairs exact through hierarchical and filtered component completion', () => {
    const pool = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as { stars: typeof bright }
    const byId = new Map(pool.stars.map((star) => [star.id, star]))
    for (const [id, mass] of [['cns5-0155', .405], ['gj-22-c', .157],
      ['cns5-4014', .379], ['msc-16240+4822-ab', .114],
      ['cns5-5064', .237], ['orb6-20298+0941-a-b-b', .114]] as const) {
      const star = byId.get(id)!
      expect(star.mass_solar).toBe(mass)
      expect(completeCatalogCompanions([star]).find((candidate) => candidate.id === id)?.mass_solar).toBe(mass)
    }
    expect(byId.get('cns5-3857')).toMatchObject({ temperature_k: 3571, mass_solar: .2883,
      radius_solar: .296, luminosity_solar: .0105504 })
    // These source rows are flagged or aggregated; the exception must not spread.
    for (const id of ['cns5-3682', 'cns5-1155', 'cns5-1702', 'hd-50281-bb']) {
      expect(byId.get(id)?.mass_solar, id).toBeNull()
    }
    expect(byId.get('10pc-0035')?.spectral_type).toBe('M1.0V')
    expect(byId.get('10pc-0089')?.spectral_type).toBe('M5.5V')
  })

  it.each(['nearest-100', 'nearest-1000'])('keeps reviewed Kruger 60 components and source motion intact in %s', (catalog) => {
    const input = parseStarCatalog(readFileSync(new URL(`./data/catalogs/${catalog}/stars.csv`, import.meta.url), 'utf8'))
    const expanded = completeCatalogCompanions(input)
    const review = JSON.parse(readFileSync(new URL('../catalog-work/shared-enrichment/kruger-60-review.json', import.meta.url), 'utf8'))
    const a = expanded.find((star) => star.id === '10pc-0061')!
    const b = expanded.find((star) => star.id === '10pc-0062')!
    expect(a).toMatchObject({ name: 'Kruger 60 A', spectral_type: 'M3V', temperature_k: 3342,
      mass_solar: .268, radius_solar: .3085, luminosity_solar: .00983, age_gyr: null, metallicity_dex: null })
    expect(b).toMatchObject({ name: 'DO Cep', spectral_type: 'M4V', temperature_k: 3097,
      mass_solar: .172, radius_solar: .2085, luminosity_solar: .00393, age_gyr: null,
      metallicity_dex: -.25, metallicity_kind: '[Fe/H]' })
    for (const star of [a, b]) {
      const before = review.objects[star.id].previousEffectiveComponent
      expect(star.raw_astrometry).toEqual(before.raw_astrometry)
      for (const field of ['x_pc', 'y_pc', 'z_pc', 'vx_kms', 'vy_kms', 'vz_kms'] as const) {
        expect(star[field]).toBe(before[field])
      }
      expect(star.subtypes).toContain('Main-sequence')
      expect(star.notes).not.toContain('multi-star system V withheld')
      const source = input.find((candidate) => candidate.id === star.id)!
      expect(missingCatalogMeasurements(source, star)).toEqual([])
      expect(apparentVisualMagnitude(star.absolute_mag, Math.hypot(star.x_pc, star.y_pc, star.z_pc)))
        .toBeCloseTo(star.apparent_mag!, 6)
    }
    expect(b.subtypes).toContain('Eruptive variable')
    expect(b.apparent_mag! - a.apparent_mag!).toBeCloseTo(1.61, 5)
    // Deblended components must reproduce the observed system flux, not each inherit it.
    expect(-2.5 * Math.log10(10 ** (-.4 * a.apparent_mag!) + 10 ** (-.4 * b.apparent_mag!)))
      .toBeCloseTo(9.57, 6)
  })

  it('recovers individual Orion photometry from the final adopted component distances', () => {
    const inputs = [...bright, ...western.filter((star) => star.id === 'hip-26207')]
    const components = completeCatalogCompanions(inputs)
    for (const [id, magnitude] of [['bright-alnitak', 2], ['bright-mintaka', 2.76], ['hip-26207', 3.47]] as const) {
      const star = components.find((star) => star.id === id)!
      const distance = Math.hypot(star.x_pc, star.y_pc, star.z_pc)
      expect(star.apparent_mag, star.name).toBe(magnitude)
      expect(apparentVisualMagnitude(star.absolute_mag, distance), star.name).toBeCloseTo(magnitude, 6)
    }
  })

  it('retains Furud source photometry without assigning unresolved flux or variability to Aa/Ab', () => {
    const furud = western.find((star) => star.id === 'hip-30122')!
    const expanded = completeCatalogCompanions([furud])
    const a = expanded.find((star) => star.id === furud.id)!
    const b = expanded.find((star) => star.name === 'Furud Ab')!
    expect(a).toMatchObject({ spectral_type: 'B2.5V', subtypes: ['Main-sequence'],
      apparent_mag: null, absolute_mag: null, mass_solar: null, luminosity_solar: null,
      unresolved_photometry: { magnitude_v: 2.99, error_mag: .01 } })
    expect(a.unresolved_photometry?.scope).toContain('Aa+Ab')
    expect(catalogMeasurement(a, 'luminosity_solar')).toBe(furud.luminosity_solar)
    expect(catalogMeasurement(a, 'radius_solar')).toBe(furud.radius_solar)
    expect(catalogMeasurement(a, 'absolute_mag')).toBe(furud.absolute_mag)
    expect(catalogMeasurement(a, 'temperature_k')).toBe(18500)
    expect(missingCatalogMeasurements(furud, a)).toEqual([])
    expect(b).toMatchObject({ apparent_mag: null, absolute_mag: null, spectral_type: null, subtypes: [] })
    expect(b.unresolved_photometry).toBeUndefined()
    expect(b.catalog_sources?.every((source) => source.catalog_id === 'constellation-motion-before-20261019')).toBe(true)
    expect(completeCatalogCompanions([b]).find((star) => star.id === furud.id)).toEqual(a)
  })

  it('preserves every known source measurement and uncertainty across all bundled catalogs', () => {
    const identities = parseObjectIdentities(JSON.parse(readFileSync(new URL('./data/object-designations.json', import.meta.url), 'utf8')))
    const stats = parseObjectStats(JSON.parse(readFileSync(new URL('./data/object-stats.json', import.meta.url), 'utf8')))
    const paths = [new URL('./data/stars.csv', import.meta.url),
      ...readdirSync(new URL('./data/catalogs/', import.meta.url)).map((id) => new URL(`./data/catalogs/${id}/stars.csv`, import.meta.url))]
    for (const path of paths) {
      const original = supplementObjectStats(supplementObjectIdentities(parseStarCatalog(readFileSync(path, 'utf8')), identities), stats)
      const expanded = new Map(completeCatalogCompanions(original).map((star) => [star.id, star]))
      for (const source of original) {
        expect(expanded.has(source.id), source.id).toBe(true)
        expect(missingCatalogMeasurements(source, expanded.get(source.id)!), source.id).toEqual([])
      }
    }
  })

  it('detects replacement loss of physical values and nested astrometric uncertainties', () => {
    const source = western.find((star) => star.id === 'hip-30122')!
    const a = completeCatalogCompanions([source])[0]!
    expect(missingCatalogMeasurements(source, { ...a, catalog_sources: undefined })).toContain('luminosity_solar')
    expect(missingCatalogMeasurements(source, { ...a, catalog_sources: undefined })).toContain('raw_astrometry.parallax_error_mas')
    expect(missingCatalogMeasurements(source, a)).toEqual([])
  })

  it('retains new input measurements when a bundled component lacks them', () => {
    const furud = western.find((star) => star.id === 'hip-30122')!
    const input = { ...furud, mass_solar: 7.7 }
    const expanded = completeCatalogCompanions([input])
    const a = expanded[0]!
    expect(a.mass_solar).toBeNull()
    expect(catalogMeasurement(a, 'mass_solar')).toBe(7.7)
    expect(missingCatalogMeasurements(input, a)).toEqual([])
    expect(completeCatalogCompanions(expanded)).toEqual(expanded)
    expect(expanded.find((star) => star.name === 'Furud Ab')?.catalog_sources?.some((source) => source.record.mass_solar === 7.7)).toBe(false)
  })

  it('classifies new components from their own spectra while keeping ambiguous stages unavailable', () => {
    const pool = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as { stars: typeof bright }
    const byId = new Map(pool.stars.map((star) => [star.id, star]))
    expect(byId.get('hip-45336')?.subtypes).toEqual(['Main-sequence'])
    expect(byId.get('hip-112158')?.subtypes).toEqual(['Bright giant'])
    expect(byId.get('orb6-16003-2237-a-b-b')?.subtypes).toEqual(['Main-sequence'])
    expect(byId.get('cns5-2182')?.subtypes).toEqual([]) // IV-V cannot select one stage.
    const individual = pool.stars.filter((star) => star.apparent_mag != null)
    expect(individual.every((star) => star.unresolved_photometry === undefined)).toBe(true)
  })

  it.each([
    ['Achernar', 'bright-achernar', ['A', 'B']],
    ['Porrima', 'hip-61941', ['A', 'B']],
    ['Sabik', 'bright-sabik', ['A', 'B']],
    ['Ascella', 'bright-ascella', ['A', 'B']],
    ['Rasalhague', 'bright-rasalhague', ['A', 'B']],
    ['Mu Velorum', 'bright-mu-velorum', ['A', 'B']],
    ['Alhena', 'bright-alhena', ['Aa', 'Ab']],
    ['Chamukuy', 'hip-20894', ['Aa', 'Ab']],
  ])('loads the detected components of %s despite its single catalog spectrum', (_name, id, labels) => {
    const parent = [...bright, ...western].find((star) => star.id === id)!
    const expanded = completeCatalogCompanions([parent])
    expect(indexStarSystems(expanded).get(parent.id)?.components.map((member) => member.label)).toEqual(labels)
    expect(completeCatalogCompanions(expanded)).toEqual(expanded)
    const secondary = expanded.find((star) => star.id !== parent.id)!
    expect(completeCatalogCompanions([secondary])[0]!.id).toBe(secondary.id)
    expect(spaceMotionForStar(expanded[0]!)).toMatchObject({ systemicMotion: true, label: 'System bulk motion' })
  })

  it('loads reviewed Dschubba properties from either catalog while retaining direct B selection', () => {
    const fromBright = completeCatalogCompanions([bright.find((star) => star.id === 'bright-dschubba')!])
    const fromWestern = completeCatalogCompanions([western.find((star) => star.id === 'hip-78401')!])
    for (const expanded of [fromBright, fromWestern]) {
      const a = expanded.find((star) => star.name === 'Dschubba A')!
      const b = expanded.find((star) => star.name === 'Dschubba B')!
      expect(a).toMatchObject({ spectral_type: 'B0.3IV', temperature_k: 29700,
        mass_solar: 15.3, luminosity_solar: 28000, age_gyr: .0073 })
      expect(a.radius_solar).toBeCloseTo(Math.sqrt(28000) / (29700 / 5772) ** 2, 7)
      expect(b).toMatchObject({ spectral_type: 'B1-3V', mass_solar: 8.2,
        temperature_k: null, luminosity_solar: null, radius_solar: null, age_gyr: null,
        apparent_mag: null, absolute_mag: null })
      expect(spaceMotionForStar(b).label).toBe('System bulk motion')
      expect(completeCatalogCompanions([b])[0]).toMatchObject({ id: b.id, mass_solar: 8.2 })
    }
    expect(mergeCatalogStars(fromBright, fromWestern)).toHaveLength(2)
  })

  it('uses individual eclipsing-binary values and preserves unresolved source gaps', () => {
    const expanded = completeCatalogCompanions([bright.find((star) => star.id === 'bright-menkalinan')!])
    expect(expanded.map((star) => star.mass_solar)).toEqual([2.359, 2.293])
    expect(expanded.map((star) => star.radius_solar)).toEqual([2.752, 2.622])
    expect(expanded[0]?.temperature_k).toBe(9350)
    expect(expanded[1]?.temperature_k).toBe(Math.round(9350 * .997543))
    expect(expanded.map((star) => star.apparent_mag)).toEqual([2.602, 2.705])
    const unreviewed = completeCatalogCompanions([western.find((star) => star.id === 'hip-61941')!])
    expect(unreviewed[0]).toMatchObject({ mass_solar: null, luminosity_solar: null, radius_solar: null })
  })

  it('keeps the per-component gap audit synchronized with the generated pool', () => {
    const pool = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as { stars: typeof bright }
    const audit = JSON.parse(readFileSync(new URL('../catalog-work/star-systems/catalog-companions-audit.json', import.meta.url), 'utf8')) as {
      propertyCoverage: { fields: (keyof typeof bright[number])[]; available: Record<string, number>;
        withoutProperties: string[]; missingByComponent: Record<string, string[]> }
    }
    for (const field of audit.propertyCoverage.fields) {
      expect(audit.propertyCoverage.available[field]).toBe(pool.stars.filter((star) => star[field] !== null).length)
    }
    for (const star of pool.stars) {
      const missing = audit.propertyCoverage.fields.filter((field) => star[field] === null)
      expect(audit.propertyCoverage.missingByComponent[star.id] ?? []).toEqual(missing)
      expect(audit.propertyCoverage.withoutProperties.includes(star.id)).toBe(missing.length === audit.propertyCoverage.fields.length)
    }
  })

  it('closes over every newly authored detected pair in the source coverage audit', () => {
    const audit = JSON.parse(readFileSync(new URL('../catalog-work/star-systems/catalog-companions-audit.json', import.meta.url), 'utf8')) as {
      ordinaryBinaryCoverage: { decision: string; systemId?: string; labels: string[] }[]
    }
    const detected = audit.ordinaryBinaryCoverage.filter((pair) => pair.decision === 'authored-detected-pair')
    expect(detected.length).toBeGreaterThan(50)
    const pool = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as { stars: typeof bright }
    for (const pair of detected) {
      const system = reviewedStarSystems.find((system) => system.id === pair.systemId)!
      expect(system.components.map((component) => component.label)).toEqual(pair.labels)
      for (const component of system.components) {
        const star = pool.stars.find((star) => star.id === component.starId)!
        const expanded = completeCatalogCompanions([star])
        expect(expanded[0]!.id).toBe(star.id)
        expect(indexStarSystems(expanded).get(star.id)?.components.map((member) => member.label)).toEqual(pair.labels)
      }
    }
  })

  it('recognizes Adhara A/B from both catalogs and merges their exact component identities', () => {
    const fromBright = completeCatalogCompanions([bright.find((star) => star.id === 'bright-adhara')!])
    const fromWestern = completeCatalogCompanions([western.find((star) => star.id === 'hip-33579')!])
    for (const expanded of [fromBright, fromWestern]) {
      expect(expanded).toHaveLength(2)
      expect(expanded[0]!.name).toBe('Adhara A')
      expect(indexStarSystems(expanded).get(expanded[0]!.id)?.components.map((member) => member.label)).toEqual(['A', 'B'])
      const b = expanded.find((star) => star.id === 'adhara-b')!
      expect(b).toMatchObject({ name: 'Adhara B', spectral_type: null,
        temperature_k: null, mass_solar: null, radius_solar: null,
        luminosity_solar: null, metallicity_dex: null, age_gyr: null,
        apparent_mag: null, absolute_mag: null })
      expect(b.raw_astrometry).toMatchObject({ parallax_mas: 7.6159, radial_velocity_kms: 27.3 })
      expect(spaceMotionForStar(b).label).toBe('System bulk motion')
      expect(b.designations).toContain('Gaia DR3 5608832155887268480')
      expect(b.x_pc).not.toBe(expanded[0]!.x_pc)
      expect(completeCatalogCompanions(expanded)).toEqual(expanded)
      const direct = completeCatalogCompanions([b])
      expect(direct[0]!.id).toBe('adhara-b')
      expect(indexStarSystems(direct).get(b.id)?.components).toHaveLength(2)
    }
    expect(starComponentIdentity('hip-33579')).toMatchObject({ canonicalStarId: 'bright-adhara', label: 'A' })
    expect(mergeCatalogStars(fromBright, fromWestern)).toHaveLength(2)
  })

  it('loads faint and unclassified companions with their own records and no primary-property copying', () => {
    const expanded = completeCatalogCompanions([sun, dubhe])
    const a = expanded.find((star) => star.id === dubhe.id)!
    const b = expanded.find((star) => star.name === 'Dubhe B')!
    expect(a).toMatchObject({ name: 'Dubhe A', spectral_type: 'G9III', apparent_mag: 1.87, mass_solar: 4.25 })
    expect(b).toMatchObject({ spectral_type: 'A7.5', apparent_mag: 4.86, mass_solar: null, luminosity_solar: null })
    expect(mkPoint(a)).toMatchObject({ luminosityClass: 'III' })
    expect(mkPoint(b)).toBeNull()
    expect(indexStarSystems(expanded).get(b.id)?.components.map((member) => member.label)).toEqual(['A', 'B', 'Ca', 'Cb', 'D'])
  })

  it('retains the directly loaded B component and closes over the rest of its system', () => {
    const b = completeCatalogCompanions([sun, dubhe]).find((star) => star.name === 'Dubhe B')!
    const expanded = completeCatalogCompanions([sun, b])
    expect(expanded[1]!.id).toBe(b.id)
    expect(expanded.filter((star) => star.name === 'Dubhe A')).toHaveLength(1)
    expect(starComponentIdentity(b.id)).toMatchObject({ name: 'Dubhe', label: 'B' })
  })

  it('loads the three measured 1 Gem masses without copying primary properties into Ba/Bb', () => {
    const expanded = completeCatalogCompanions([western.find((star) => star.id === 'hip-28734')!])
    const system = indexStarSystems(expanded).get('hip-28734')!
    expect(system.components.map((member) => member.label)).toEqual(['A', 'Ba', 'Bb'])
    expect(system.components.map((member) => member.star.mass_solar)).toEqual([1.94, 1.707, 1.012])
    const ba = expanded.find((star) => star.name === '1 Gem Ba')!
    const bb = expanded.find((star) => star.name === '1 Gem Bb')!
    expect(ba.spectral_type).toBe('F6IV')
    expect(bb.spectral_type).toBe('G2V?')
    expect(mkPoint(ba)).toMatchObject({ luminosityClass: 'IV' })
    for (const companion of [ba, bb]) {
      expect(companion).toMatchObject({ temperature_k: null, radius_solar: null,
        luminosity_solar: null, metallicity_dex: null, age_gyr: null })
    }
    expect(completeCatalogCompanions([bb])[0]).toMatchObject({ id: bb.id, mass_solar: 1.012 })
  })

  it('keeps alternate selection IDs stable and merges shared-position components individually', () => {
    const fromWestern = completeCatalogCompanions([sun, western.find((star) => star.id === 'hip-54061')!])
    expect(fromWestern[1]).toMatchObject({ id: 'hip-54061', name: 'Dubhe A', spectral_type: 'G9III' })
    const fromBright = completeCatalogCompanions([sun, dubhe])
    const merged = mergeCatalogStars(fromBright, fromWestern)
    expect(merged).toHaveLength(fromBright.length)
    expect(merged.filter((star) => star.name === 'Dubhe B')).toHaveLength(1)
    expect(merged.filter((star) => star.name === 'Dubhe A')).toHaveLength(1)
  })

  it('does not add duplicate companions on repeated completion', () => {
    const first = completeCatalogCompanions(bright)
    expect(completeCatalogCompanions(first)).toEqual(first)
    expect(new Set(first.map((star) => star.id)).size).toBe(first.length)
  })

  it('loads EZ Aquarii from any component and preserves all three shared-position identities', () => {
    const nearest = parseStarCatalog(readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8'))
    const c = nearest.find((star) => star.id === 'ez-aquarii-c')!
    const expanded = completeCatalogCompanions([c])
    expect(expanded[0]!.id).toBe(c.id)
    expect(expanded.map((star) => star.id).sort()).toEqual(['ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c'])
    expect(indexStarSystems(expanded).get(c.id)?.id).toBe('ez-aquarii')
    const merged = mergeCatalogStars([], expanded)
    expect(merged).toHaveLength(3)
    expect(mergeCatalogStars(merged, completeCatalogCompanions(expanded))).toHaveLength(3)
  })

  it('unifies Epsilon Indi Ba/Bb with their existing census component IDs', () => {
    const nearest = parseStarCatalog(readFileSync(new URL('./data/catalogs/nearest-100/stars.csv', import.meta.url), 'utf8'))
    const a = nearest.find((star) => star.id === '10pc-0040')!
    const expanded = completeCatalogCompanions([a])
    expect(expanded.map((star) => star.id).sort()).toEqual(['10pc-0040', '10pc-0042', '10pc-0043'])
    expect(indexStarSystems(expanded).get(a.id)?.components.map((c) => c.label)).toEqual(['A', 'Ba', 'Bb'])
    expect(starComponentIdentity('msc-22034-5647-ba')?.canonicalStarId).toBe('10pc-0042')
    const merged = mergeCatalogStars(expanded, nearest.filter((star) => ['10pc-0042', '10pc-0043'].includes(star.id)))
    expect(merged).toHaveLength(3)
  })

  it('does not infer a system from a spectral label or a shared sky position', () => {
    const unrelated = { ...dubhe, id: 'unreviewed-binary', name: 'Unreviewed binary' }
    expect(completeCatalogCompanions([sun, unrelated])).toEqual([sun, unrelated])
  })

  it('keeps distinct Trapezium subsystems separate even when their common names match', () => {
    const cluster = parseStarCatalog(readFileSync(new URL('./data/catalogs/western-constellation-stars/stars.csv', import.meta.url), 'utf8'))
    const expanded = completeCatalogCompanions(cluster)
    const systems = indexStarSystems(expanded)
    const a = systems.get('trapezium-theta1-orionis-a')!
    const d = systems.get('trapezium-theta1-orionis-d')!
    expect(a.components.map((member) => member.label)).toEqual(['Aa1', 'Aa2', 'Ab'])
    expect(d.components.map((member) => member.label)).toEqual(['Da1', 'Da2'])
    expect(a).not.toBe(d)
  })
})
