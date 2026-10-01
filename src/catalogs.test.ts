import { describe, expect, it, vi } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import csv from './data/stars.csv?raw'
import largeCsv from './data/catalogs/nearest-100/stars.csv?raw'
import manifest from './data/catalogs/nearest-100/catalog.json?raw'
import nearest1000Csv from './data/catalogs/nearest-1000/stars.csv?raw'
import nearest1000Manifest from './data/catalogs/nearest-1000/catalog.json?raw'
import nearest1000Provenance from './data/catalogs/nearest-1000/provenance.json?raw'
import brightCsv from './data/catalogs/bright-stars/stars.csv?raw'
import brightManifest from './data/catalogs/bright-stars/catalog.json?raw'
import westernCsv from './data/catalogs/western-constellation-stars/stars.csv?raw'
import westernManifest from './data/catalogs/western-constellation-stars/catalog.json?raw'
import westernProvenance from './data/catalogs/western-constellation-stars/provenance.json?raw'
import clusterCsv from './data/catalogs/famous-cluster-stars/stars.csv?raw'
import clusterManifest from './data/catalogs/famous-cluster-stars/catalog.json?raw'
import clusterProvenance from './data/catalogs/famous-cluster-stars/provenance.json?raw'
import compactManifestRaw from './data/overlays/compact-remnants/manifest.json?raw'
import compactPayloadRaw from './data/overlays/compact-remnants/objects.json?raw'
import { buildCatalog, catalogCoverage, catalogSelection, DEFAULT_CATALOG_MANIFEST, loadCatalog, parseCatalogManifest } from './catalogs'
import { parseStarCatalog } from './catalog'
import { apparentVisualMagnitude, formatDistance, temperatureToColor, visibilityTier } from './astronomy'
import { catalogLoader, mergeCatalogStars } from './catalog-runtime'
import { parseCompactOverlayManifest, parseCompactOverlayPayload } from './compact-overlay-model'

describe('catalog packages and display settings', () => {
  const small = parseStarCatalog(csv)
  const large = loadCatalog({ manifest: parseCatalogManifest(manifest), csv: largeCsv })
  const nearest1000 = loadCatalog({ manifest: parseCatalogManifest(nearest1000Manifest), csv: nearest1000Csv })
  const bright = loadCatalog({ manifest: parseCatalogManifest(brightManifest), csv: brightCsv })
  const western = loadCatalog({ manifest: parseCatalogManifest(westernManifest), csv: westernCsv })
  const cluster = loadCatalog({ manifest: parseCatalogManifest(clusterManifest), csv: clusterCsv })

  it('validates both real catalogs and shared object metadata', () => {
    expect(small).toHaveLength(22)
    expect(large).toHaveLength(101)
    expect(catalogCoverage(small).constellations).toBe(21)
    expect(catalogCoverage(large).constellations).toBe(100)
    for (const star of small) expect(large.find((candidate) => candidate.id === star.id)).toEqual(star)
    expect(small[0]).toMatchObject({ constellation: null, absolute_mag: 4.83 })
    expect(small.find((star) => star.id === 'sirius-a')!.constellation).toBe('Canis Major')
    expect(small.find((star) => star.id === 'barnards-star')!.constellation).toBe('Ophiuchus')
    expect(large.find((star) => star.id === '10pc-0059')).toMatchObject({ mass_solar: 0.281 })
    expect(large.find((star) => star.id === '10pc-0098')).toMatchObject({
      vx_kms: null,
      vy_kms: null,
      vz_kms: null,
      raw_astrometry: { pm_ra_cosdec_masyr: 1012.444720371, pm_dec_masyr: -554.030838673, radial_velocity_kms: null },
    })
    expect(catalogCoverage(large)).toMatchObject({ rawAstrometry: 100, radialVelocities: 68, transverseOnly: 32 })
  })

  it('validates the nearest-1000 release and preserves every curated shared row', () => {
    expect(nearest1000).toHaveLength(1001)
    expect(catalogCoverage(nearest1000)).toMatchObject({
      objects: 1000,
      constellations: 1000,
      rawAstrometry: 1000,
      radialVelocities: 326,
      transverseOnly: 674,
    })
    for (const star of large) expect(nearest1000.find((candidate) => candidate.id === star.id)).toEqual(star)
    const provenance = JSON.parse(nearest1000Provenance)
    expect(provenance.cutoff).toMatchObject({ rank: 1000, id: 'cns5-0864', nextId: 'cns5-2673', oneSigmaIntervalsOverlap: true })
    expect(nearest1000.find((star) => star.id === 'cns5-3517')?.name).toBe('Arcturus')
    expect(catalogCoverage(nearest1000)).toMatchObject({ radii: 568, metallicities: 350, ages: 68, masses: 526, luminosities: 505, temperatures: 558 })
    expect(catalogCoverage(large)).toMatchObject({ masses: 54, luminosities: 38, radii: 40 })
    expect(small.find((star) => star.id === 'barnards-star')).toMatchObject({ mass_solar: 0.144, radius_solar: 0.1931, luminosity_solar: 0.0035225088 })
    expect(nearest1000.find((star) => star.id === 'cns5-5672')).toMatchObject({ mass_solar: 0.6116, radius_solar: 0.6299 })
  })

  it('keeps the bright landmark catalog bounded and merges it without duplicates', () => {
    expect(bright).toHaveLength(115)
    expect(bright.at(-1)?.name).toBe('Arneb')
    expect(catalogCoverage(bright)).toMatchObject({ temperatures: 113, masses: 45, luminosities: 99, radii: 98, metallicities: 23, ages: 1 })
    expect(bright.find((star) => star.name === 'Rigel')).toMatchObject({
      temperature_k: 11968, radius_solar: 74.0262, luminosity_solar: 83226.2, metallicity_dex: -0.159,
    })
    expect(bright.find((star) => star.name === 'Antares')).toMatchObject({
      temperature_k: 3548, mass_solar: 15, radius_solar: 682.1352, luminosity_solar: 66430.9, age_gyr: 0.013,
    })
    expect(bright.find((star) => star.name === 'Acrux')).toMatchObject({
      temperature_k: 24547, mass_solar: null, radius_solar: 10.5782, luminosity_solar: 36602.6,
    })
    expect(bright.find((star) => star.name === 'Denebola')).toMatchObject({
      temperature_k: 8710, mass_solar: 1.9, radius_solar: 1.6218, luminosity_solar: 13.639,
    })
    expect(bright.find((star) => star.name === 'Sadr')).toMatchObject({
      temperature_k: 5863, mass_solar: 12.11, radius_solar: 173.5751, luminosity_solar: 32073.7,
    })
    expect(bright.find((star) => star.name === 'Aludra')).toMatchObject({
      temperature_k: 10000, mass_solar: 19.19, radius_solar: 66.8279, luminosity_solar: 40235.6,
    })
    expect(bright.find((star) => star.name === 'Menkar')).toMatchObject({
      temperature_k: 3795, mass_solar: 2.3, radius_solar: 89, luminosity_solar: 1460, metallicity_dex: -0.221,
    })
    expect(bright.find((star) => star.name === 'Beta Gruis')).toMatchObject({
      temperature_k: 3508, mass_solar: null, radius_solar: 153.871, luminosity_solar: 3221.38, metallicity_dex: null,
    })
    expect(bright.find((star) => star.name === 'Gacrux')).toMatchObject({
      temperature_k: 3689, mass_solar: null, radius_solar: 71.952, luminosity_solar: 861.411,
    })
    expect(bright.find((star) => star.name === 'Mizar A')).toMatchObject({
      temperature_k: null, mass_solar: null, radius_solar: null, luminosity_solar: null,
    })
    expect(['Alnitak', 'Alnilam', 'Mintaka'].every((name) => bright.some((star) => star.name === name))).toBe(true)
    expect(['Sabik', 'Arneb', 'Muphrid'].every((name) => bright.some((star) => star.name === name))).toBe(true)
    expect(bright.some((star) => star.name === 'NGC 1980')).toBe(false)
    expect(bright.filter((star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc) * 3.261563777 > 1000).map((star) => star.name)).toEqual([
      'Naos', 'Regor', 'Deneb', 'Wezen', 'Sadr', 'Alnilam', 'Aludra', 'Arneb',
    ])
    expect(Math.max(...bright.map((star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc) * 3.261563777))).toBeLessThan(3000)
    expect(parseCatalogManifest(brightManifest).cutoffPolicy).toContain('3000 light-years')
    expect(Math.max(...bright.filter((star) => star.id !== 'sun').map((star) => apparentVisualMagnitude(
      star.absolute_mag, Math.hypot(star.x_pc, star.y_pc, star.z_pc),
    )!))).toBeLessThan(2.70)
    const merged = mergeCatalogStars(large, bright)
    expect(merged).toHaveLength(210)
    expect(new Set(merged.map((star) => star.id)).size).toBe(merged.length)
    expect(merged.find((star) => star.name === 'Altair')).toMatchObject({
      id: '10pc-0117', temperature_k: 7760, mass_solar: 1.6, radius_solar: 1.8183, metallicity_dex: 0.19,
    })
    expect(large.find((star) => star.name === 'Altair')).toMatchObject({ mass_solar: null, radius_solar: null })
    expect(merged.filter((star) => star.name === 'Procyon A' || star.name === 'Procyon')).toHaveLength(1)
    const sirius = bright.find((star) => star.id === 'sirius-a')!
    expect(mergeCatalogStars([sirius], [{ ...sirius, id: 'duplicate-sirius' }])).toHaveLength(1)
    expect(mergeCatalogStars([sirius], [small.find((star) => star.id === 'sirius-b')!])).toHaveLength(2)
    const largestMerged = mergeCatalogStars(nearest1000, bright)
    expect(largestMerged).toHaveLength(1103)
    expect(largestMerged.filter((star) => star.name === 'Denebola')).toHaveLength(1)
    expect(new Set(largestMerged.map((star) => star.id)).size).toBe(largestMerged.length)
  })

  it('includes every source-defined Western constellation figure star as an independent overlay', () => {
    const provenance = JSON.parse(westernProvenance)
    expect(western).toHaveLength(692)
    expect(catalogCoverage(western)).toMatchObject({
      objects: 691, constellations: 691, magnitudes: 691, rawAstrometry: 691,
      temperatures: 668, masses: 353, luminosities: 626, radii: 626, metallicities: 223, ages: 88,
    })
    expect(provenance).toMatchObject({ figureConstellations: 88, uniqueHipparcosStars: 691 })
    expect(new Set(Object.values(provenance.objects).flatMap((entry: any) => entry.figureConstellations)).size).toBe(88)
    expect(Math.max(...western.map((star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc) * 3.261563777))).toBeLessThan(10000)
    expect(Math.max(...western.filter((star) => star.id !== 'sun').map((star) => apparentVisualMagnitude(
      star.absolute_mag, Math.hypot(star.x_pc, star.y_pc, star.z_pc),
    )!))).toBeLessThan(6.54)
    expect(Math.hypot(...(['x_pc', 'y_pc', 'z_pc'] as const).map((field) => western.find((star) => star.name === 'x Car')![field]))).toBeCloseTo(2623, 5)
    expect(Math.hypot(...(['x_pc', 'y_pc', 'z_pc'] as const).map((field) => western.find((star) => star.name === 'Polis')![field]))).toBeCloseTo(1499.9503, 5)
    expect(Math.hypot(...(['x_pc', 'y_pc', 'z_pc'] as const).map((field) => western.find((star) => star.name === 'Beta Phe')![field]))).toBeCloseTo(55.772448, 5)
    expect(provenance.objects['hip-54463'].adoptedDistance).toMatchObject({ method: 'co-moving group distance', sourceId: '2026A&A...708A..78K' })
    expect(provenance.objects['hip-89341'].adoptedDistance).toMatchObject({ method: 'associated-system geometric posterior' })
    expect(provenance.objects['hip-5165'].adoptedDistance).toMatchObject({ method: 'binary-orbit parallax', sourceId: '2015AN....336..378A' })
    const withBrightStars = mergeCatalogStars(bright, western)
    expect(withBrightStars).toHaveLength(694)
    expect(withBrightStars.filter((star) => star.name === 'Rigel')).toHaveLength(1)
  })

  it('keeps famous cluster stars curated, recognizable and separate from bright-star membership', () => {
    const provenance = JSON.parse(clusterProvenance)
    expect(cluster).toHaveLength(43)
    expect(catalogCoverage(cluster)).toMatchObject({
      objects: 42, constellations: 42, magnitudes: 42, rawAstrometry: 42,
      temperatures: 42, masses: 26, luminosities: 42, radii: 42, metallicities: 22, ages: 7,
    })
    expect(provenance.groups.map((group: { name: string }) => group.name)).toEqual([
      'Pleiades', 'Trapezium Cluster', 'Hyades', 'Coma Star Cluster', 'Southern Pleiades', 'Omicron Velorum Cluster', 'Beehive Cluster',
    ])
    expect(['Celaeno', 'Electra', 'Taygeta', 'Asterope', 'Maia', 'Merope', 'Alcyone', 'Theta1 Orionis C'].every((name) => cluster.some((star) => star.name === name))).toBe(true)
    expect(cluster.some((star) => star.name === 'Aldebaran')).toBe(false)
    expect(bright.some((star) => star.name === 'Alcyone')).toBe(false)
    expect(cluster.find((star) => star.name === 'Alcyone')).toMatchObject({ temperature_k: 10168, luminosity_solar: 1161.86861365969 })
    expect(cluster.find((star) => star.name === 'Theta1 Orionis C')).toMatchObject({
      temperature_k: 39000, mass_solar: 33.4, luminosity_solar: 177827.941, radius_solar: 9.4,
    })

    const sirius = western.find((star) => star.name === 'Sirius')!
    const merged = mergeCatalogStars(small, [sirius, ...cluster])
    expect(merged.filter((star) => star.name === 'Sirius' || star.name === 'Sirius A')).toHaveLength(1)
    expect(merged).toHaveLength(64)
    expect(mergeCatalogStars(small, [sirius])).toHaveLength(22)
  })

  it('rebuilds both landmark catalogs exactly from frozen sources', () => {
    execFileSync('python3', ['scripts/author-landmark-stars.py'], { cwd: fileURLToPath(new URL('../', import.meta.url)) })
  })

  it('validates the source-defined compact-remnant overlay and its nullable measurements', () => {
    const compactManifest = parseCompactOverlayManifest(compactManifestRaw)
    const compact = parseCompactOverlayPayload(JSON.parse(compactPayloadRaw), compactManifest)
    expect(compact).toHaveLength(269)
    expect(compactManifest.counts).toEqual({ pulsar: 266, neutron_star: 1, black_hole: 2 })
    expect(Math.max(...compact.map((object) => Math.hypot(object.x_pc, object.y_pc, object.z_pc) * 3.261563777))).toBeLessThanOrEqual(3000)
    expect(compact.filter((object) => object.type === 'pulsar' && object.compact?.rotation_period_s !== null)).toHaveLength(263)
    expect(compact.find((object) => object.id === 'gaia-bh1')).toMatchObject({
      type: 'black_hole', mass_solar: 9.27, compact: { confidence: 'confirmed', orbital_period_days: 185.387 },
    })
    expect(compact.find((object) => object.id === 'gaia-ns1')).toMatchObject({
      type: 'neutron_star', mass_solar: 1.9, compact: { confidence: 'candidate' },
    })
    expect(compact.filter((object) => object.type === 'pulsar').every((object) => object.mass_solar === null)).toBe(true)
  })

  it('rejects malformed packages and preserves nullable selection', () => {
    expect(() => parseCatalogManifest('{}')).toThrow('schemaVersion')
    expect(() => loadCatalog({ manifest: parseCatalogManifest(manifest), csv })).toThrow('objectCount')
    expect(catalogSelection(small, null, 'sirius-a')).toEqual({ selectedId: null, observerId: 'sirius-a' })
    expect(catalogSelection(small, 'absent', 'absent')).toEqual({ selectedId: null, observerId: 'sun' })
  })

  it('fetches and parses each browser catalog payload once', async () => {
    const manifest = { ...DEFAULT_CATALOG_MANIFEST, objectCount: 22 }
    const stars = parseStarCatalog(csv)
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, catalogId: manifest.id, stars })))
    const load = catalogLoader(manifest, '/assets/nearest-neighbors.json', fetcher)
    const first = load()
    const second = load()
    expect(second).toBe(first)
    expect(await first).toEqual(stars)
    expect(await load()).toBe(await first)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('builds deterministic native subsets and rejects incomplete adopted inputs', () => {
    const definition = { ...parseCatalogManifest(manifest), id: 'custom-sample', objectCount: 4 }
    const provenance = Object.fromEntries(small.map((star) => [star.id, { source: star.notes }]))
    const result = buildCatalog(definition, csv, provenance)
    expect(parseStarCatalog(result.csv).map((star) => star.id)).toEqual(['sun', 'proxima-centauri', 'alpha-centauri-b', 'alpha-centauri-a'])
    expect(buildCatalog(definition, csv, provenance)).toEqual(result)
    expect(() => buildCatalog(definition, csv, {})).toThrow('Missing object provenance')
    expect(() => buildCatalog({ ...definition, objectCount: 1000 }, csv, provenance)).toThrow('Not enough candidates')
    expect(() => buildCatalog({ ...definition, epoch: 2016 }, csv, provenance)).toThrow('epoch')
    expect(() => buildCatalog({ ...definition, id: 'nearest-neighbors' }, csv, provenance)).toThrow('reserved')
  })

  it('runs the authoring CLI offline and refuses accidental overwrites', () => {
    const directory = mkdtempSync(join(tmpdir(), 'star-view-catalog-'))
    const input = join(directory, 'adopted.json')
    const output = join(directory, 'custom-sample')
    const script = fileURLToPath(new URL('../scripts/catalogs.ts', import.meta.url))
    try {
      writeFileSync(join(directory, 'candidates.csv'), csv)
      writeFileSync(input, JSON.stringify({
        manifest: { ...parseCatalogManifest(manifest), id: 'custom-sample', objectCount: 4 },
        candidatesCsv: 'candidates.csv',
        provenance: Object.fromEntries(small.map((star) => [star.id, { source: star.notes }])),
      }))
      execFileSync(process.execPath, [script, 'build', input, output])
      const before = readFileSync(join(output, 'stars.csv'), 'utf8')
      expect(parseStarCatalog(before)).toHaveLength(4)
      expect(spawnSync(process.execPath, [script, 'build', input, output]).status).toBe(1)
      execFileSync(process.execPath, [script, 'build', input, output, '--force'])
      expect(readFileSync(join(output, 'stars.csv'), 'utf8')).toBe(before)
      expect(execFileSync(process.execPath, [script, 'validate', output], { encoding: 'utf8' })).toContain('4 rows')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('keeps authoring inputs contained and refuses symlinked outputs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'star-view-catalog-security-'))
    const recipeDirectory = join(directory, 'recipe')
    const input = join(recipeDirectory, 'adopted.json')
    const script = fileURLToPath(new URL('../scripts/catalogs.ts', import.meta.url))
    const definition = { ...parseCatalogManifest(manifest), id: 'custom-secure', objectCount: 4 }
    const provenance = Object.fromEntries(parseStarCatalog(csv).map((star) => [star.id, { source: star.notes }]))
    try {
      mkdirSync(recipeDirectory)
      writeFileSync(join(directory, 'outside.csv'), csv)
      const recipe = (candidatesCsv: string) => JSON.stringify({ manifest: definition, candidatesCsv, provenance })
      writeFileSync(input, recipe('../outside.csv'))
      expect(spawnSync(process.execPath, [script, 'build', input, join(directory, 'escaped')], { encoding: 'utf8' }).stderr).toContain('stay inside')
      writeFileSync(input, recipe(join(directory, 'outside.csv')))
      expect(spawnSync(process.execPath, [script, 'build', input, join(directory, 'absolute')], { encoding: 'utf8' }).stderr).toContain('must be relative')
      writeFileSync(join(recipeDirectory, 'candidates.csv'), csv)
      writeFileSync(input, recipe('candidates.csv'))
      symlinkSync(join(directory, 'real-output'), join(directory, 'linked-output'))
      expect(spawnSync(process.execPath, [script, 'build', input, join(directory, 'linked-output'), '--force'], { encoding: 'utf8' }).stderr).toContain('symbolic link')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('formats presentation distances without changing canonical data', () => {
    expect(formatDistance(0.5, 'ly')).toBe('1.63 ly')
    expect(formatDistance(0.5, 'pc')).toBe('0.50 pc')
    expect(formatDistance(-1, 'ly', 3)).toBe('-3.262 ly')
    expect(formatDistance(-0.00001, 'pc')).toBe('0.00 pc')
    expect(temperatureToColor(null).r).toBe(temperatureToColor(null).b)
  })

  it('uses the distance modulus with inclusive unrounded thresholds', () => {
    expect(apparentVisualMagnitude(7, 10)).toBe(7)
    expect(apparentVisualMagnitude(7, 1)).toBe(2)
    expect(apparentVisualMagnitude(7, 100)).toBe(12)
    expect(apparentVisualMagnitude(-1, 10)).toBe(-1)
    for (const distance of [0, -1, NaN, Infinity]) expect(apparentVisualMagnitude(7, distance)).toBeNull()
    for (const magnitude of [null, NaN, Infinity]) expect(apparentVisualMagnitude(magnitude, 10)).toBeNull()
    const observer = { id: 'base', x_pc: 100, y_pc: 0, z_pc: 0 }
    const target = { id: 'target', x_pc: 110, y_pc: 0, z_pc: 0, absolute_mag: 7 }
    expect(visibilityTier(target, observer, 7)).toBe('eligible')
    expect(visibilityTier({ ...target, absolute_mag: 7.00001 }, observer, 7)).toBe('background')
    expect(visibilityTier({ ...target, absolute_mag: null }, observer, 12)).toBe('background')
    expect(visibilityTier({ ...target, x_pc: 100 }, observer, 12)).toBe('background')
    expect(visibilityTier({ ...target, id: 'base' }, observer, 0)).toBe('base')
    expect(visibilityTier(target, { ...observer, x_pc: 0 }, 7)).toBe('background')
    expect(visibilityTier(target, observer, 8)).toBe('eligible')
  })
})
