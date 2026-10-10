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
import brightProvenance from './data/catalogs/bright-stars/provenance.json?raw'
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
import { apparentVisualMagnitude, displayMotionForStar, formatDistance, galacticToWorld, temperatureToColor, visibilityTier } from './astronomy'
import { retainBrightestCoincidentComponents } from './viewer-primitives'
import { catalogLoader, mergeCatalogStars, parseCatalogPayload } from './catalog-runtime'
import { coincidentComponentGroups, indexStarSystems } from './star-systems'
import { completeCatalogCompanions } from './stellar-companions'
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
    expect(catalogCoverage(large)).toMatchObject({ rawAstrometry: 100, radialVelocities: 70, transverseOnly: 30 })
  })

  it('validates the nearest-1000 release and preserves every curated shared row', () => {
    expect(nearest1000).toHaveLength(1037)
    expect(catalogCoverage(nearest1000)).toMatchObject({
      objects: 1036,
      constellations: 1036,
      rawAstrometry: 1036,
      radialVelocities: 701,
      transverseOnly: 335,
    })
    for (const star of large) expect(nearest1000.find((candidate) => candidate.id === star.id)).toEqual(star)
    const provenance = JSON.parse(nearest1000Provenance)
    expect(provenance.cutoff).toMatchObject({ baselineRank: 1000, id: 'cns5-0864', nextId: 'cns5-2673', oneSigmaIntervalsOverlap: true })
    expect(provenance.reviewedAdditionIds).toHaveLength(36)
    expect(nearest1000.find((star) => star.id === 'cns5-3517')?.name).toBe('Arcturus')
    expect(nearest1000.find((star) => star.id === 'cns5-1415')).toMatchObject({
      raw_astrometry: { radial_velocity_kms: 106.061874, radial_velocity_error_kms: 0.1704749, radial_velocity_ref: 'Gaia DR3' },
    })
    expect(provenance.objects.find((object: { id: string }) => object.id === 'cns5-1415')?.radialVelocity).toMatchObject({
      status: 'gaia-dr3-fallback',
      observation: { sourceId: 'gaia-dr3', valueKms: 106.061874 },
    })
    expect(nearest1000.find((star) => star.id === 'cns5-1208')).toMatchObject({
      name: 'Tabit', vx_kms: -25.645926, vy_kms: -14.814296, vz_kms: 4.397823,
      raw_astrometry: {
        radial_velocity_kms: 24.11,
        radial_velocity_error_kms: 0.08,
        radial_velocity_ref: '2010A&A...521A..12M',
      },
    })
    expect(provenance.objects.find((object: { id: string }) => object.id === 'cns5-1208')?.radialVelocity).toMatchObject({
      status: 'reviewed-literature-override',
      observation: { sourceId: 'reviewed-literature-rv', sourceRecordId: 'HIP 22449', valueKms: 24.11, uncertaintyKms: 0.08 },
    })
    expect(provenance.objects.find((object: { id: string }) => object.id === 'cns5-4846')?.radialVelocity).toMatchObject({
      status: 'compiled-cns5',
      observation: { sourceId: 'cns5', valueKms: 26.576419830322266 },
    })
    expect(nearest1000.find((star) => star.id === 'cns5-1475')).toMatchObject({
      vx_kms: null, vy_kms: null, vz_kms: null,
      raw_astrometry: { radial_velocity_kms: null },
    })
    expect(provenance.objects.find((object: { id: string }) => object.id === 'cns5-1475')?.radialVelocity).toMatchObject({
      status: 'withheld-white-dwarf',
      observation: { sourceId: 'gaia-dr3', valueKms: -414.01544 },
    })
    expect(catalogCoverage(nearest1000)).toMatchObject({ radii: 686, metallicities: 612, ages: 90, masses: 655, luminosities: 665, temperatures: 877 })
    expect(catalogCoverage(large)).toMatchObject({ masses: 68, luminosities: 72, radii: 72 })
    expect(nearest1000.find((star) => star.id === 'cns5-4566')).toMatchObject({
      temperature_k: 985, mass_solar: 0.02068605705, radius_solar: 0.109956073,
      luminosity_solar: 9.77237221e-6, age_gyr: null, metallicity_dex: null,
      vx_kms: null, raw_astrometry: { radial_velocity_kms: null },
    })
    expect(provenance.objects.find((object: { id: string }) => object.id === 'cns5-1604')?.radialVelocity).toMatchObject({
      status: 'reviewed-literature-fallback',
      observation: { sourceId: 'reviewed-ultracool-rv', valueKms: 1.2, uncertaintyKms: 1, reference: '2021ApJS..257...45H' },
    })
    expect(small.find((star) => star.id === 'barnards-star')).toMatchObject({ mass_solar: 0.144, radius_solar: 0.1931, luminosity_solar: 0.0035225088 })
    expect(nearest1000.find((star) => star.id === 'cns5-5672')).toMatchObject({ mass_solar: 0.6116, radius_solar: 0.6299 })
  })

  it('keeps the bright landmark catalog bounded and merges it without duplicates', () => {
    expect(bright).toHaveLength(126)
    expect(bright.at(-1)?.name).toBe('Arneb')
    expect(catalogCoverage(bright)).toMatchObject({ temperatures: 121, masses: 56, luminosities: 110, radii: 111, metallicities: 76, ages: 12, radialVelocities: 118 })
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
      temperature_k: 8421, mass_solar: 1.9, radius_solar: 1.621810097, luminosity_solar: 11.91651817,
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
      temperature_k: 3508, mass_solar: null, radius_solar: 153.871, luminosity_solar: 3221.38, metallicity_dex: 0.208,
    })
    expect(bright.find((star) => star.name === 'Gacrux')).toMatchObject({
      temperature_k: 3689, mass_solar: null, radius_solar: 71.952, luminosity_solar: 861.411,
    })
    expect(bright.find((star) => star.name === 'Mizar A')).toMatchObject({
      temperature_k: 9700, mass_solar: null, radius_solar: null, luminosity_solar: null,
    })
    expect(['Alnitak', 'Alnilam', 'Mintaka'].every((name) => bright.some((star) => star.name === name))).toBe(true)
    expect(['Sabik', 'Arneb', 'Muphrid'].every((name) => bright.some((star) => star.name === name))).toBe(true)
    expect(bright.some((star) => star.name === 'NGC 1980')).toBe(false)
    expect(bright.filter((star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc) * 3.261563777 > 1000).map((star) => star.name)).toEqual([
      'Naos', 'Regor', 'Deneb', 'Wezen', 'Sadr', 'Alnilam', 'Aludra', 'Arneb',
    ])
    expect(Math.max(...bright.map((star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc) * 3.261563777))).toBeLessThan(3000)
    expect(parseCatalogManifest(brightManifest).cutoffPolicy).toContain('3000 light-years')
    const brightOriginalIds = new Set<string>(JSON.parse(brightProvenance).originalLandmarkIds)
    expect(Math.max(...bright.filter((star) => brightOriginalIds.has(star.id)).map((star) => apparentVisualMagnitude(
      star.absolute_mag, Math.hypot(star.x_pc, star.y_pc, star.z_pc),
    )!))).toBeLessThan(2.70)
    const originalAltair = structuredClone(large.find((star) => star.name === 'Altair'))
    const merged = mergeCatalogStars(large, bright)
    expect(merged).toHaveLength(218)
    expect(new Set(merged.map((star) => star.id)).size).toBe(merged.length)
    expect(merged.find((star) => star.name === 'Altair')).toMatchObject({
      id: '10pc-0117', spectral_type: 'A7Vn', temperature_k: 7586, mass_solar: 1.6, metallicity_dex: 0.19,
    })
    expect(merged.find((star) => star.name === 'Altair')!.radius_solar).toBeCloseTo(1.8183, 4)
    expect(large.find((star) => star.name === 'Altair')).toEqual(originalAltair)
    expect(merged.filter((star) => star.name === 'Procyon A' || star.name === 'Procyon')).toHaveLength(1)
    const sirius = bright.find((star) => star.id === 'sirius-a')!
    expect(mergeCatalogStars([sirius], [{ ...sirius, id: 'duplicate-sirius' }])).toHaveLength(1)
    expect(mergeCatalogStars([sirius], [small.find((star) => star.id === 'sirius-b')!])).toHaveLength(2)
    const largestMerged = mergeCatalogStars(nearest1000, bright)
    expect(largestMerged).toHaveLength(1142)
    expect(largestMerged.filter((star) => star.name === 'Denebola')).toHaveLength(1)
    expect(new Set(largestMerged.map((star) => star.id)).size).toBe(largestMerged.length)
  })

  it('enriches Procyon components and keeps reviewed parameters across catalogs', () => {
    const primary = large.find((star) => star.id === '10pc-0031')!
    const companion = large.find((star) => star.id === '10pc-0032')!
    expect(primary).toMatchObject({ temperature_k: 6591, mass_solar: 1.478, radius_solar: 2.019, metallicity_dex: -0.05, age_gyr: 2.7 })
    expect(companion).toMatchObject({ temperature_k: 7740, mass_solar: 0.592, radius_solar: 0.01232, metallicity_dex: null, age_gyr: 2.7 })
    expect(primary.absolute_mag).not.toBeNull()
    expect(companion.absolute_mag).not.toBeNull()
    expect(primary.luminosity_solar).toBeGreaterThan(6)
    expect(companion.luminosity_solar).toBeGreaterThan(0)
    for (const stars of [bright, western]) {
      expect(stars.find((star) => star.name === 'Procyon')).toMatchObject({
        temperature_k: primary.temperature_k, mass_solar: primary.mass_solar,
        radius_solar: primary.radius_solar, age_gyr: primary.age_gyr,
      })
    }
    const provenance = JSON.parse(nearest1000Provenance)
    const estimated = provenance.objects.filter((object: any) => object.sharedPhysicalEnrichment?.temperature_k?.status === 'estimated')
    expect(estimated.length).toBe(157)
    for (const object of estimated) {
      const star = nearest1000.find((candidate) => candidate.id === object.id)!
      expect(star.notes).toContain('not an object-specific measurement')
      expect(object.fieldStatus.temperature_k).toBe('estimated')
    }
  })

  it('ships reviewed Mu Cas primary properties with uncertainties and model caveats', () => {
    expect(nearest1000.find((star) => star.id === 'cns5-0317')).toMatchObject({
      name: 'Mu Cassiopeiae A', temperature_k: 5346, mass_solar: 0.744, luminosity_solar: 0.458,
      radius_solar: 0.789, metallicity_dex: -0.81, age_gyr: 12.7, absolute_mag: 5.784,
    })
    const provenance = JSON.parse(nearest1000Provenance)
    const physical = provenance.objects.find((object: { id: string }) => object.id === 'cns5-0317').supersededSharedPhysicalEnrichment
    expect(physical.mass_solar).toMatchObject({ component: 'A', uncertainty: 0.0122, status: 'measured' })
    expect(physical.age_gyr).toMatchObject({ uncertainty: 2.7, status: 'model-derived' })
    expect(physical.radius_solar.caveat).toContain('systematic')
  })

  it('restores resolved Mu Cas B properties and explicitly shared systemic motion', () => {
    const primary = nearest1000.find((star) => star.id === 'cns5-0317')!
    const secondary = nearest1000.find((star) => star.id === 'mu-cassiopeiae-b')!
    expect(secondary).toMatchObject({
      type: 'star', absolute_mag: 11.6, mass_solar: 0.1728, temperature_k: 3034,
      radius_solar: 0.26, luminosity_solar: 0.0051, metallicity_dex: null,
    })
    for (const star of [primary, secondary]) {
      expect(star.raw_astrometry?.radial_velocity_kms).toBe(-97)
      expect(star.raw_astrometry?.radial_velocity_error_kms).toBeNull()
      expect(displayMotionForStar(star, 'solar')?.mode).toBe('full')
      const object = JSON.parse(nearest1000Provenance).objects.find((item: any) => item.id === star.id)
      expect(object.radialVelocity).toMatchObject({ status: 'systemic-approximation' })
      expect(object.astrometryScope).toContain('without individual orbital velocity')
    }
    const age = JSON.parse(nearest1000Provenance).objects.find((item: any) => item.id === secondary.id).reviewedComponentEnrichment.adopted.age_gyr
    expect(age.scope).toContain('not an independent B age')
    expect(secondary.notes).not.toContain('absolute_mag,')
  })

  it('uses comparable resolved Achird iron measurements and restores B physical properties', () => {
    const primary = nearest1000.find((star) => star.id === 'cns5-0239')!
    const secondary = nearest1000.find((star) => star.id === 'cns5-0238')!
    expect(primary).toMatchObject({ metallicity_kind: '[Fe/H]', metallicity_dex: -0.230 })
    expect(secondary).toMatchObject({
      metallicity_kind: '[Fe/H]', metallicity_dex: -0.305, temperature_k: 4011,
      mass_solar: 0.5487, radius_solar: 0.57, luminosity_solar: 0.082, age_gyr: null,
    })
    const provenance = JSON.parse(nearest1000Provenance)
    const observations = [primary, secondary].map((star) => provenance.objects.find((item: any) => item.id === star.id).reviewedComponentEnrichment)
    expect(observations[0].replaced.metallicity_dex).toMatchObject({ value: -0.972, kind: '[M/H]' })
    expect(observations[1].adopted.metallicity_dex.uncertainty).toBe(0.448)
    expect(observations[1].adopted.metallicity_dex.caveat).toContain('no accurate Fe II')
    expect(observations[1].adopted.luminosity_solar.uncertainty).toBeNull()
  })

  it('restores Achird A space motion from its resolved observed radial velocity', () => {
    const primary = nearest1000.find((star) => star.id === 'cns5-0239')!
    const secondary = nearest1000.find((star) => star.id === 'cns5-0238')!
    expect(primary.raw_astrometry).toMatchObject({
      radial_velocity_kms: 8.397,
      radial_velocity_error_kms: null,
      radial_velocity_ref: 'arXiv:1207.6212:Table 3',
    })
    expect(displayMotionForStar(primary, 'solar')?.mode).toBe('full')
    expect(Math.hypot(primary.vx_kms!, primary.vy_kms!, primary.vz_kms!)).toBeCloseTo(35.031, 3)
    const object = JSON.parse(nearest1000Provenance).objects.find((item: any) => item.id === primary.id)
    expect(object.radialVelocity).toMatchObject({
      status: 'reviewed-literature-override',
      observation: { sourceRecordId: 'HIP 3821', valueKms: 8.397, uncertaintyKms: null },
    })
    expect(primary.notes).toContain('Includes component orbital motion, not a binary systemic velocity')
    expect(primary.notes).toContain('0.117 km/s is observation scatter, not a formal uncertainty')
    expect(secondary.raw_astrometry?.radial_velocity_kms).toBe(10.446348190307617)
  })

  it('keeps abundance types through payload loading and overlay supplementation', () => {
    for (const stars of [small, large, nearest1000, bright, western, cluster]) {
      for (const star of stars) {
        if (star.metallicity_dex !== null) expect(['[M/H]', '[Fe/H]']).toContain(star.metallicity_kind)
        else expect(star.metallicity_kind).toBeNull()
      }
    }
    const source = nearest1000.find((star) => star.id === 'cns5-0239')!
    const blank = { ...source, metallicity_dex: null, metallicity_kind: null }
    expect(mergeCatalogStars([blank], [source])[0]).toMatchObject({ metallicity_dex: -0.23, metallicity_kind: '[Fe/H]' })
    const metadata = parseCatalogManifest(nearest1000Manifest)
    expect(() => parseCatalogPayload({ schemaVersion: 1, catalogId: metadata.id, stars: nearest1000.map((star) => star.id === source.id ? { ...star, metallicity_kind: null } : star) }, metadata)).toThrow('metallicity quantity')
  })

  it('keeps the Mu Cas primary bright when its shared-position companion remains the visibility reference', () => {
    const primary = nearest1000.find((star) => star.id === 'cns5-0317')!
    const secondary = nearest1000.find((star) => star.id === 'mu-cassiopeiae-b')!
    // Deselecting leaves the last chosen component as the visibility reference.
    // Neither direction may demote a co-located primary/companion to background.
    expect(visibilityTier(primary, secondary, 0)).toBe('base')
    expect(visibilityTier(secondary, primary, 0)).toBe('base')
    expect(visibilityTier(primary, { ...secondary, x_pc: secondary.x_pc + 10 }, 0)).toBe('background')
  })

  it('draws only the brightest coincident component while retaining separated Alpha Centauri members', () => {
    const groups = coincidentComponentGroups(nearest1000)
    const index = (id: string) => nearest1000.findIndex((star) => star.id === id)
    const primary = index('cns5-0317')
    const secondary = index('mu-cassiopeiae-b')
    const alpha = ['alpha-centauri-a', 'alpha-centauri-b', 'proxima-centauri'].map(index)
    const positions = nearest1000.map(galacticToWorld)
    const enabled = new Uint8Array(nearest1000.length)
    for (const member of [primary, secondary, ...alpha]) enabled[member] = 1
    retainBrightestCoincidentComponents(groups, positions, enabled)
    expect(enabled[primary]).toBe(1)
    expect(enabled[secondary]).toBe(0)
    expect(alpha.map((member) => enabled[member])).toEqual([1, 1, 1])
    // Separating the simulated positions restores an independent secondary point.
    positions[secondary]!.x += 0.01
    enabled[secondary] = 1
    retainBrightestCoincidentComponents(groups, positions, enabled)
    expect(enabled[secondary]).toBe(1)
    // A hidden primary must not suppress its sole visible companion.
    positions[secondary]!.copy(positions[primary]!)
    enabled[primary] = 0
    retainBrightestCoincidentComponents(groups, positions, enabled)
    expect(enabled[secondary]).toBe(1)
  })

  it('carries resolved companion supplements into overlays and retains unknown individual fields', () => {
    for (const id of ['zeta-herculis-b', 'iota-pegasi-b', 'gamma-cephei-b', 'capella-ab']) {
      const base = nearest1000.find((star) => star.id === id)!
      const overlay = western.find((star) => star.id === id)!
      expect(overlay).toMatchObject({
        temperature_k: base.temperature_k, radius_solar: base.radius_solar,
        luminosity_solar: base.luminosity_solar, mass_solar: base.mass_solar,
        age_gyr: base.age_gyr, absolute_mag: base.absolute_mag,
      })
      expect(mergeCatalogStars(nearest1000, western).filter((star) => star.id === id)).toHaveLength(1)
    }
    expect(nearest1000.find((star) => star.id === 'gj-644-bb')?.absolute_mag).toBe(11.71)
    expect(nearest1000.find((star) => star.id === 'hd-50281-bb')).toMatchObject({
      temperature_k: null, luminosity_solar: null, absolute_mag: null,
    })
    expect(nearest1000.find((star) => star.id === 'gj-569-bb')).toMatchObject({
      temperature_k: 2400, radius_solar: 0.102, mass_solar: null,
    })
    const calibrated = JSON.parse(nearest1000Provenance).objects.find((item: any) => item.id === 'cns5-1324')
    expect(calibrated.reviewedComponentEnrichment.adopted.mass_solar.status).toBe('estimated')
    expect(calibrated.reviewedComponentEnrichment.review.gaiaDr3Id).toBe(calibrated.gaiaDr3Id)
  })

  it('ships reviewed Gorgonea Tertia properties with source uncertainties and radius inputs', () => {
    const star = western.find((candidate) => candidate.id === 'hip-14354')!
    expect(star).toMatchObject({
      name: 'Gorgonea Tertia', temperature_k: 3619, metallicity_dex: -0.4384,
      mass_solar: 1.9, luminosity_solar: 2691.534804, radius_solar: 143, age_gyr: null,
    })
    const observations = JSON.parse(westernProvenance).objects[star.id].physicalObservations
    expect(observations.find((item: any) => item.field === 'mass_solar')).toMatchObject({
      reference: '2019A&A...624A..35K', uncertainty: 0.7, status: 'derived',
    })
    expect(observations.find((item: any) => item.field === 'radius_solar')).toMatchObject({
      uncertainty: 12, status: 'derived', inputs: { temperature_k: 3479 },
    })
    expect(star.notes).toContain('Rho Persei (Gorgonea Tertia)')
    expect(star.notes).not.toContain('Mu Cas')
  })

  it('includes every source-defined Western constellation figure star as an independent overlay', () => {
    const provenance = JSON.parse(westernProvenance)
    expect(western).toHaveLength(714)
    expect(catalogCoverage(western)).toMatchObject({
      objects: 713, constellations: 713, magnitudes: 697, rawAstrometry: 713,
      temperatures: 695, masses: 377, luminosities: 643, radii: 644, metallicities: 532, ages: 101,
    })
    expect(provenance).toMatchObject({ figureConstellations: 88, uniqueHipparcosStars: 691 })
    expect(new Set(Object.values(provenance.objects).flatMap((entry: any) => entry.figureConstellations ?? [])).size).toBe(88)
    expect(Math.max(...western.map((star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc) * 3.261563777))).toBeLessThan(10000)
    expect(Math.max(...western.filter((star) => star.id.startsWith('hip-') && star.absolute_mag !== null).map((star) => apparentVisualMagnitude(
      star.absolute_mag, Math.hypot(star.x_pc, star.y_pc, star.z_pc),
    )!))).toBeLessThan(6.54)
    expect(Math.hypot(...(['x_pc', 'y_pc', 'z_pc'] as const).map((field) => western.find((star) => star.name === 'x Car')![field]))).toBeCloseTo(2623, 5)
    expect(Math.hypot(...(['x_pc', 'y_pc', 'z_pc'] as const).map((field) => western.find((star) => star.name === 'Polis')![field]))).toBeCloseTo(1499.9503, 5)
    expect(Math.hypot(...(['x_pc', 'y_pc', 'z_pc'] as const).map((field) => western.find((star) => star.name === 'Beta Phe')![field]))).toBeCloseTo(55.772448, 5)
    expect(provenance.objects['hip-54463'].adoptedDistance).toMatchObject({ method: 'co-moving group distance', sourceId: '2026A&A...708A..78K' })
    expect(provenance.objects['hip-89341'].adoptedDistance).toMatchObject({ method: 'associated-system geometric posterior' })
    expect(provenance.objects['hip-5165'].adoptedDistance).toMatchObject({ method: 'binary-orbit parallax', sourceId: '2015AN....336..378A' })
    expect(western.find((star) => star.id === 'hip-22449')).toMatchObject({
      name: 'Tabit', vx_kms: -25.645926, vy_kms: -14.814296, vz_kms: 4.397823,
      raw_astrometry: { radial_velocity_kms: 24.11, radial_velocity_error_kms: 0.08, radial_velocity_ref: '2010A&A...521A..12M' },
    })
    expect(western.find((star) => star.id === 'hip-81266')).toMatchObject({
      name: 'Paikauhale', vx_kms: 1.748073, vy_kms: -16.806049, vz_kms: -4.278355,
      raw_astrometry: { radial_velocity_kms: 3.15, radial_velocity_error_kms: 0.7, radial_velocity_ref: '2017A&A...603A..56C' },
    })
    expect(western.find((star) => star.id === 'hip-52419')).toMatchObject({
      name: 'Theta Car', vx_kms: -6.812084, vy_kms: -23.879625, vz_kms: -0.497474,
      raw_astrometry: { radial_velocity_kms: 20.18, radial_velocity_error_kms: 0.04, radial_velocity_ref: '2008A&A...488..287H' },
    })
    expect(provenance.objects['hip-81266'].radialVelocity).toMatchObject({
      status: 'reviewed-literature-override', frozenSimbadValueKms: -650.47, adoptedValueKms: 3.15,
    })
    expect(provenance.objects['hip-52419'].radialVelocity).toMatchObject({
      status: 'reviewed-literature-override', frozenSimbadValueKms: 459.7, adoptedValueKms: 20.18,
    })
    const withBrightStars = mergeCatalogStars(bright, western)
    expect(withBrightStars).toHaveLength(715)
    expect(withBrightStars.filter((star) => star.name === 'Rigel')).toHaveLength(1)
  })

  it('keeps famous cluster stars curated, recognizable and separate from bright-star membership', () => {
    const provenance = JSON.parse(clusterProvenance)
    expect(cluster).toHaveLength(43)
    expect(catalogCoverage(cluster)).toMatchObject({
      objects: 42, constellations: 42, magnitudes: 42, rawAstrometry: 42,
      temperatures: 42, masses: 26, luminosities: 42, radii: 42, metallicities: 34, ages: 7,
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
    expect(cluster.find((star) => star.id === 'hip-52419')).toMatchObject({
      vx_kms: -6.812084, vy_kms: -23.879625, vz_kms: -0.497474,
      raw_astrometry: { radial_velocity_kms: 20.18, radial_velocity_error_kms: 0.04, radial_velocity_ref: '2008A&A...488..287H' },
    })
    expect(provenance.objects['hip-52419'].radialVelocity).toMatchObject({
      status: 'reviewed-literature-override', frozenSimbadValueKms: 459.7, adoptedValueKms: 20.18,
    })

    const sirius = western.find((star) => star.id === 'hip-32349')!
    const merged = mergeCatalogStars(small, [sirius, ...cluster])
    expect(merged.filter((star) => star.name === 'Sirius' || star.name === 'Sirius A')).toHaveLength(1)
    expect(merged).toHaveLength(64)
    expect(mergeCatalogStars(small, [sirius])).toHaveLength(22)
  })

  it('offers reviewed overlay components and preserves shared-position companions in either merge order', () => {
    expect(mergeCatalogStars(small, bright)).toHaveLength(142)
    expect(mergeCatalogStars(small, western)).toHaveLength(729)
    expect(mergeCatalogStars(mergeCatalogStars(small, bright), western)).toHaveLength(730)
    expect(mergeCatalogStars(mergeCatalogStars(small, western), cluster)).toHaveLength(764)
    expect(mergeCatalogStars(mergeCatalogStars(mergeCatalogStars(small, bright), western), cluster)).toHaveLength(765)
    const expected = { 'Alpha Centauri': ['A', 'B', 'C'], Sirius: ['A', 'B'], Procyon: ['A', 'B'],
      Fomalhaut: ['A', 'B', 'C'], Capella: ['Aa', 'Ab', 'H', 'L'], Rigel: ['A', 'Ba', 'Bb', 'C'] }
    for (const stars of [bright, western, mergeCatalogStars(bright, western), mergeCatalogStars(western, bright),
      mergeCatalogStars(nearest1000, mergeCatalogStars(bright, western))]) {
      const systems = indexStarSystems(stars)
      for (const [name, labels] of Object.entries(expected)) {
        const system = [...systems.values()].find((item) => item.name === name)!
        expect(system?.components.map((item) => item.label), name).toEqual(labels)
        expect(new Set(system.components.map((item) => item.star.id)).size).toBe(labels.length)
      }
      expect(stars.find((star) => star.id === 'rigel-bb')).toMatchObject({ temperature_k: null, mass_solar: null,
        radius_solar: null, luminosity_solar: null, absolute_mag: null, vx_kms: null,
        raw_astrometry: { radial_velocity_kms: null } })
    }
    const forward = mergeCatalogStars(bright, western)
    const reverse = mergeCatalogStars(western, bright)
    expect(forward).toHaveLength(reverse.length)
    for (const stars of [bright, western]) {
      const capella = [...indexStarSystems(stars).values()].find((system) => system.name === 'Capella')!
      expect(capella.components[0]!.star).toMatchObject({ mass_solar: 2.5687, temperature_k: 4970,
        luminosity_solar: 78.7, age_gyr: 0.649 })
      expect(capella.components[1]!.star).toMatchObject({ mass_solar: 2.4828, temperature_k: 5730, luminosity_solar: 72.7 })
    }
    expect(indexStarSystems(western).get('hip-86974')?.components.map((item) => item.label)).toEqual(['Aa', 'Ab', 'B', 'C'])
    const trapezium = cluster.filter((star) => star.name.startsWith('Theta1 Orionis'))
    expect(trapezium.every((star) => !indexStarSystems(cluster).has(star.id))).toBe(true)
  })

  it('rebuilds bright and landmark catalogs exactly from frozen sources', () => {
    execFileSync('python3', ['scripts/author-bright-stars.py'], { cwd: fileURLToPath(new URL('../', import.meta.url)) })
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
    const unsafePayload = JSON.parse(compactPayloadRaw)
    unsafePayload.objects[0].compact.source_url = 'javascript:alert(1)'
    expect(() => parseCompactOverlayPayload(unsafePayload, compactManifest)).toThrow(/row/)
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
    expect(await first).toEqual(completeCatalogCompanions(stars))
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
    expect(visibilityTier({ ...target, x_pc: 100 }, observer, 12)).toBe('base')
    expect(visibilityTier({ ...target, id: 'base' }, observer, 0)).toBe('base')
    expect(visibilityTier(target, { ...observer, x_pc: 0 }, 7)).toBe('background')
    expect(visibilityTier(target, observer, 8)).toBe('eligible')
  })
})
