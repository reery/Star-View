import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { indexStarSystems, starComponentIdentity } from './star-systems'
import { mergeCatalogStars } from './catalog-runtime'
import { mkPoint } from './mk-diagram'

const bright = parseStarCatalog(readFileSync(new URL('./data/catalogs/bright-stars/stars.csv', import.meta.url), 'utf8'))
const western = parseStarCatalog(readFileSync(new URL('./data/catalogs/western-constellation-stars/stars.csv', import.meta.url), 'utf8'))
const dubhe = bright.find((star) => star.id === 'bright-dubhe')!
const sun = bright.find((star) => star.id === 'sun')!

describe('component coverage shared by every catalog', () => {
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

  it('does not infer a system from a spectral label or a shared sky position', () => {
    const unrelated = { ...dubhe, id: 'unreviewed-binary', name: 'Unreviewed binary' }
    expect(completeCatalogCompanions([sun, unrelated])).toEqual([sun, unrelated])
  })

  it('keeps distinct Trapezium subsystems separate even when their common names match', () => {
    const cluster = parseStarCatalog(readFileSync(new URL('./data/catalogs/famous-cluster-stars/stars.csv', import.meta.url), 'utf8'))
    const expanded = completeCatalogCompanions(cluster)
    const systems = indexStarSystems(expanded)
    const a = systems.get('trapezium-theta1-orionis-a')!
    const d = systems.get('trapezium-theta1-orionis-d')!
    expect(a.components.map((member) => member.label)).toEqual(['Aa1', 'Aa2', 'Ab'])
    expect(d.components.map((member) => member.label)).toEqual(['Da1', 'Da2'])
    expect(a).not.toBe(d)
  })
})
