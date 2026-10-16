import { describe, expect, it } from 'vitest'
import { equatorialToGalacticPc, type Star } from './catalog-model'
import { constellationCardAvailable, constellationStarObject, constellationStarObjects, loadConstellationChart, objectSkyPosition, projectConstellationPosition } from './constellations'
import culture from '../catalog-work/western-constellation-stars/stellarium-western-index.json'
import { completeCatalogCompanions } from './stellar-companions'
import { catalogMeasurement, missingCatalogMeasurements } from './catalog-source'
import { luminosityCardAvailable } from './luminosity-properties'

const object = (overrides: Partial<Star> = {}): Star => ({
  type: 'star', id: 'sirius-a', name: 'Sirius A', constellation: 'Canis Major', spectral_type: 'A1V',
  ...equatorialToGalacticPc(101.287, -16.716, 2.64),
  vx_kms: null, vy_kms: null, vz_kms: null, temperature_k: null, mass_solar: null,
  luminosity_solar: null, radius_solar: null, metallicity_dex: null, age_gyr: null,
  absolute_mag: null, epoch: 2000, notes: '', raw_astrometry: null, ...overrides,
})

describe('all 88 constellation charts', () => {
  it('opens charts for every supported object type and requires a known constellation', () => {
    expect(constellationCardAvailable(object())).toBe(true)
    expect(constellationCardAvailable(object({ type: 'pulsar' }))).toBe(true)
    expect(constellationCardAvailable(object({ type: 'molecular_cloud' }))).toBe(true)
    expect(constellationCardAvailable(object({ constellation: 'Centaurus' }))).toBe(true)
    expect(constellationCardAvailable(object({ constellation: 'Orion' }))).toBe(true)
    expect(constellationCardAvailable(object({ constellation: 'Unknown' }))).toBe(false)
    expect(constellationCardAvailable(object({ constellation: null }))).toBe(false)
    expect(constellationCardAvailable(object({ id: 'sun' }))).toBe(false)
  })

  it('loads all fifteen figure stars with complete line endpoints and a pinned source', async () => {
    const chart = (await loadConstellationChart(object()))!
    expect(chart.name).toBe('Canis Major')
    expect(chart.stars).toHaveLength(15)
    expect(chart.stars.find((star) => star.hip === 32349)?.name).toBe('Sirius')
    const ids = new Set(chart.stars.map((star) => star.hip))
    expect(chart.lines.every((line) => line.length === 2 && line.every((id) => ids.has(id)))).toBe(true)
    expect(chart.sources[0]!.url).toContain('014fbb5e59233d133c22f9811af96b67d05a95c9')
    expect(await loadConstellationChart(object({ constellation: null }))).toBeNull()
  })

  it('loads every source figure with complete endpoints, closed regions, and finite sky geometry', async () => {
    expect(culture.constellations).toHaveLength(88)
    for (const figure of culture.constellations) {
      const name = figure.common_name.native
      const selected = object({ constellation: name })
      expect(constellationCardAvailable(selected), name).toBe(true)
      const chart = (await loadConstellationChart(selected))!
      expect(chart.name).toBe(name)
      expect(chart.abbreviation).toBe(figure.iau)
      const ids = new Set(chart.stars.map((star) => star.hip))
      const sourceLines = (figure.lines as (number | string)[][]).map((line) => line.filter((hip): hip is number => typeof hip === 'number'))
      expect(chart.lines).toEqual(sourceLines.flatMap((line) => line.slice(1).map((hip, i) => [line[i], hip])))
      expect([...ids].sort((a, b) => a - b)).toEqual([...new Set(sourceLines.flat())].sort((a, b) => a - b))
      expect(chart.lines.every((line) => line.every((hip) => ids.has(hip)))).toBe(true)
      const starts = chart.boundaries.map((boundary) => JSON.stringify(boundary.points[0])).sort()
      const ends = chart.boundaries.map((boundary) => JSON.stringify(boundary.points.at(-1))).sort()
      expect(ends, `${name} region closure`).toEqual(starts)
      for (const point of [...chart.stars, ...chart.boundaries.flatMap((boundary) => boundary.points)]) {
        const projected = projectConstellationPosition(point, chart.center)
        expect(projected, name).not.toBeNull()
        expect(Number.isFinite(projected!.x) && Number.isFinite(projected!.y), name).toBe(true)
      }
      expect(chart.boundaries.every((boundary) => culture.constellations.some((neighbor) => neighbor.common_name.native === boundary.neighbor))).toBe(true)
      expect(chart.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true)
    }
  })

  it('keeps Serpens as two closed regions without joining across Ophiuchus', async () => {
    const chart = (await loadConstellationChart(object({ constellation: 'Serpens' })))!
    const jumps = chart.boundaries.filter((boundary, index) => JSON.stringify(boundary.points.at(-1)) !== JSON.stringify(chart.boundaries[(index + 1) % chart.boundaries.length]!.points[0]))
    expect(jumps).toHaveLength(2)
    expect(chart.stars).toHaveLength(12)
    expect(chart.lines.every(([a, b]) => (a < 80000) === (b < 80000))).toBe(true)
    const neighbors = (await loadConstellationChart(object({ constellation: 'Ophiuchus' })))!.boundaries
    expect(neighbors.filter((boundary) => boundary.neighbor === 'Serpens').map((boundary) => boundary.neighbor_abbreviation))
      .toEqual(expect.arrayContaining(['SER1', 'SER2']))
  })

  it('encloses both celestial poles and retains pipe-separated catalogue aliases', async () => {
    for (const [name, declination] of [['Ursa Minor', 90], ['Octans', -90]] as const) {
      const chart = (await loadConstellationChart(object({ constellation: name })))!
      const pole = projectConstellationPosition({ ra_deg: 0, dec_deg: declination }, chart.center)!
      const polygon = chart.boundaries.flatMap((boundary) => boundary.points.slice(0, -1))
        .map((point) => projectConstellationPosition(point, chart.center)!)
      let inside = false
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!, b = polygon[j]!
        if ((a.y > pole.y) !== (b.y > pole.y) && pole.x < (b.x - a.x) * (pole.y - a.y) / (b.y - a.y) + a.x) inside = !inside
      }
      expect(inside, name).toBe(true)
    }
    const auriga = (await loadConstellationChart(object({ constellation: 'Auriga' })))!
    expect(auriga.stars.find((star) => star.hip === 24608)!.object.designations).toContain('Capella')
  })

  it('keeps Bayer identities and sourced J2000 neighboring boundaries', async () => {
    const chart = (await loadConstellationChart(object()))!
    expect(chart.stars.find((star) => star.hip === 32349)?.bayer).toBe('α')
    expect(chart.stars.find((star) => star.hip === 30324)?.bayer).toBe('β')
    expect([...new Set(chart.boundaries.map((boundary) => boundary.neighbor))].sort()).toEqual(['Columba', 'Lepus', 'Monoceros', 'Puppis'])
    for (const boundary of chart.boundaries) {
      expect(boundary.points.length).toBeGreaterThan(2)
      expect(boundary.points.every((point) => point.ra_deg > 90 && point.ra_deg < 113 && point.dec_deg > -34 && point.dec_deg < -10)).toBe(true)
    }
    expect(chart.boundaries.flatMap((border) => border.points)).toContainEqual({ ra_deg: 111.973399, dec_deg: -11.2521448 })
    expect(chart.sources.find((source) => source.label.includes('boundaries'))?.path).toContain('boundaries-j2000')
  })

  it('selects the exact Sirius component and reuses Hipparcos aliases across catalogs', async () => {
    const chart = (await loadConstellationChart(object()))!
    const sirius = chart.stars.find((star) => star.hip === 32349)!
    const primary = object(), companion = object({ id: 'sirius-b', name: 'Sirius B', type: 'white_dwarf' })
    expect(constellationStarObject(sirius, [companion, primary])).toBe(primary)
    const mirzam = chart.stars.find((star) => star.hip === 30324)!
    const loaded = { ...mirzam.object, id: 'custom-mirzam', designations: ['HIP 30324'] }
    expect(constellationStarObject(mirzam, [loaded])).toBe(loaded)
    expect(constellationStarObject(mirzam, []).id).toBe(mirzam.object.id)
  })

  it('resolves unloaded Furud through the reviewed component data and preserves its source measurements', async () => {
    const chart = (await loadConstellationChart(object()))!
    const figure = chart.stars.find((star) => star.hip === 30122)!
    const fallback = constellationStarObjects(chart, [object()]).get(figure.hip)!
    expect(fallback).toMatchObject({ id: 'hip-30122', name: 'Furud Aa', luminosity_solar: null, radius_solar: null })
    const components = completeCatalogCompanions([fallback])
    expect(components.map((star) => star.name)).toEqual(['Furud Aa', 'Furud Ab'])
    expect(constellationStarObject(figure, components)).toEqual(fallback)
    expect(luminosityCardAvailable(fallback)).toBe(false)
    expect(catalogMeasurement(fallback, 'luminosity_solar')).toBe(figure.object.luminosity_solar)
    expect(catalogMeasurement(fallback, 'radius_solar')).toBe(figure.object.radius_solar)
    expect(missingCatalogMeasurements(figure.object, fallback)).toEqual([])
  })

  it('loads Centaurus once with all figure stars and its concave Crux boundary', async () => {
    const selected = object({ constellation: 'Centaurus' })
    const [chart, repeated] = await Promise.all([loadConstellationChart(selected), loadConstellationChart(selected)])
    expect(repeated).toBe(chart)
    expect(chart!.stars).toHaveLength(17)
    expect(chart!.lines).toHaveLength(16)
    const ids = new Set(chart!.stars.map((star) => star.hip))
    expect(chart!.lines.every((line) => line.every((id) => ids.has(id)))).toBe(true)
    expect(chart!.stars.find((star) => star.hip === 71683)?.bayer).toBe('α')
    expect(chart!.stars.find((star) => star.hip === 68282)?.bayer).toBe('υ1')
    expect([...new Set(chart!.boundaries.map((boundary) => boundary.neighbor))].sort())
      .toEqual(['Antlia', 'Carina', 'Circinus', 'Crux', 'Hydra', 'Lupus', 'Musca', 'Vela'])
    expect(chart!.boundaries).toHaveLength(20)
    expect(chart!.boundaries.filter((boundary) => boundary.neighbor === 'Crux')).toHaveLength(3)
    for (const [index, boundary] of chart!.boundaries.entries()) {
      expect(boundary.points.at(-1)).toEqual(chart!.boundaries[(index + 1) % chart!.boundaries.length]!.points[0])
    }
    const polygon = chart!.boundaries.flatMap((boundary) => boundary.points.slice(0, -1))
      .map((point) => projectConstellationPosition(point, chart!.center)!)
    const contains = (ra_deg: number, dec_deg: number) => {
      const point = projectConstellationPosition({ ra_deg, dec_deg }, chart!.center)!
      let inside = false
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!, b = polygon[j]!
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
      }
      return inside
    }
    expect(contains(219.85892215, -60.83163195)).toBe(true) // Alpha Centauri.
    expect(contains(186.65, -63.10)).toBe(false) // Acrux, inside the Crux notch.
    expect(chart!.sources.at(-1)!.inputs?.[0]!.path).toContain('boundary-contours-b1875')
  })

  it('caches small figure matches per catalog while preserving Centaurus component identities', async () => {
    const chart = (await loadConstellationChart(object({ constellation: 'Centaurus' })))!
    const alpha = chart.stars.find((star) => star.hip === 71683)!
    const a = { ...alpha.object, id: 'alpha-centauri-a', name: 'Alpha Centauri A' }
    const b = { ...a, id: 'alpha-centauri-b', name: 'Alpha Centauri B' }
    const proxima = { ...a, id: 'proxima-centauri', name: 'Proxima Centauri' }
    const alias = { ...a, id: 'custom-alpha', designations: ['HIP 71683'] }
    const hadarFigure = chart.stars.find((star) => star.hip === 68702)!
    const hadar = { ...hadarFigure.object, id: 'bright-hadar', name: 'Hadar Aa' }
    const catalog = [alias, b, proxima, a, hadar]
    const matches = constellationStarObjects(chart, catalog)
    expect(matches.size).toBe(chart.stars.length)
    expect(matches.get(71683)).toBe(a)
    expect(matches.get(68702)).toBe(hadar)
    expect(constellationStarObjects(chart, catalog)).toBe(matches)
    expect(constellationStarObjects(chart, [b, proxima]).get(71683)?.id).toBe('alpha-centauri-a')
    expect(constellationStarObjects(chart, [alias]).get(71683)).toBe(alias)
  })
})

describe('constellation sky geometry', () => {
  it('recovers sky coordinates from Galactic positions for stars and extended objects', () => {
    for (const type of ['star', 'molecular_cloud', 'black_hole', 'hii_region'] as const) {
      const position = objectSkyPosition(object({ type }))!
      expect(position.ra_deg).toBeCloseTo(101.287, 6)
      expect(position.dec_deg).toBeCloseTo(-16.716, 6)
    }
    expect(objectSkyPosition(object({ x_pc: 0, y_pc: 0, z_pc: 0 }))).toBeNull()
    expect(objectSkyPosition(object({ x_pc: NaN }))).toBeNull()
  })

  it('uses directly sourced non-stellar coordinates before the Cartesian fallback', () => {
    const nebula = { ra_deg: 102, dec_deg: -20 } as Star['nebula']
    expect(objectSkyPosition(object({ type: 'hii_region', nebula }))).toEqual({ ra_deg: 102, dec_deg: -20 })
    const compact = { ra_deg: 104, dec_deg: -25 } as Star['compact']
    expect(objectSkyPosition(object({ type: 'pulsar', compact }))).toEqual({ ra_deg: 104, dec_deg: -25 })
  })

  it('keeps north up and east left, including across the RA wrap', () => {
    const center = { ra_deg: 359, dec_deg: -20 }
    expect(projectConstellationPosition(center, center)).toEqual({ x: -0, y: -0 })
    expect(projectConstellationPosition({ ra_deg: 1, dec_deg: -20 }, center)!.x).toBeLessThan(0)
    expect(projectConstellationPosition({ ra_deg: 359, dec_deg: -19 }, center)!.y).toBeLessThan(0)
    expect(projectConstellationPosition({ ra_deg: 179, dec_deg: 20 }, center)).toBeNull()
  })
})
