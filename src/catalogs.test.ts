import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import csv from './data/stars.csv?raw'
import largeCsv from './data/catalogs/nearest-100/stars.csv?raw'
import manifest from './data/catalogs/nearest-100/catalog.json?raw'
import { buildCatalog, catalogCoverage, catalogSelection, loadCatalog, parseCatalogManifest } from './catalogs'
import { parseStarCatalog } from './catalog'
import { apparentVisualMagnitude, formatDistance, temperatureToColor, visibilityTier } from './astronomy'

describe('catalog packages and display settings', () => {
  const small = parseStarCatalog(csv)
  const large = loadCatalog({ manifest: parseCatalogManifest(manifest), csv: largeCsv })

  it('validates both real catalogs and shared object metadata', () => {
    expect(small).toHaveLength(22)
    expect(large).toHaveLength(101)
    expect(catalogCoverage(small).constellations).toBe(21)
    expect(catalogCoverage(large).constellations).toBe(100)
    for (const star of small) expect(large.find((candidate) => candidate.id === star.id)).toEqual(star)
    expect(small[0]).toMatchObject({ constellation: null, absolute_mag: 4.83 })
    expect(small.find((star) => star.id === 'sirius-a')!.constellation).toBe('Canis Major')
    expect(small.find((star) => star.id === 'barnards-star')!.constellation).toBe('Ophiuchus')
  })

  it('rejects malformed packages and preserves nullable selection', () => {
    expect(() => parseCatalogManifest('{}')).toThrow('schemaVersion')
    expect(() => loadCatalog({ manifest: parseCatalogManifest(manifest), csv })).toThrow('objectCount')
    expect(catalogSelection(small, null, 'sirius-a')).toEqual({ selectedId: null, observerId: 'sirius-a' })
    expect(catalogSelection(small, 'absent', 'absent')).toEqual({ selectedId: null, observerId: 'sun' })
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