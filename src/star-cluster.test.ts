import { describe, expect, it } from 'vitest'
import { parseStarClusterOverlayManifest, parseStarClusterOverlayPayload } from './star-cluster-overlay-model'
import { clusterStarPuffs, starClusterGlowPuffs } from './star-cluster-layer'
import { parseStarCatalog } from './catalog'
import { clusterExtentPc, clusterHasCatalogMembers, type StarClusterObjectType } from './catalog-model'
import { clusterBandWeight } from './wavelength-vision'
import manifestRaw from './data/overlays/star-clusters/manifest.json?raw'
import payloadRaw from './data/overlays/star-clusters/objects.json?raw'
import westernCsv from './data/catalogs/western-constellation-stars/stars.csv?raw'
import nakedEyeCsv from './data/catalogs/naked-eye-stars/stars.csv?raw'
import notableDistantCsv from './data/catalogs/notable-distant-stars/stars.csv?raw'
import nebulaObjects from './data/overlays/nebulae/objects.json'
import compactObjects from './data/overlays/compact-remnants/objects.json'

const manifest = parseStarClusterOverlayManifest(manifestRaw)
const clusters = parseStarClusterOverlayPayload(JSON.parse(payloadRaw), manifest)
const cluster = (id: string) => clusters.find((star) => star.id === id)!

describe('star-cluster overlay', () => {
  it('holds the landmark open, globular and super star clusters', () => {
    expect(clusters.map(({ id, type }) => [id, type])).toEqual([
      ...['hyades', 'pleiades', 'beehive-cluster', 'ngc-869', 'ngc-884', 'messier-67', 'ngc-3532', 'trumpler-14'].map((id) => [id, 'open_cluster']),
      ...['omega-centauri', '47-tucanae', 'messier-4', 'messier-13', 'messier-22', 'messier-15', 'terzan-5'].map((id) => [id, 'globular_cluster']),
      ...['westerlund-1', 'westerlund-2', 'ngc-3603', 'arches-cluster', 'quintuplet-cluster', 'r136', 'rsgc-1', 'stephenson-2', 'rsgc-3']
        .map((id) => [id, 'super_star_cluster']),
    ])
  })

  it('places each super star cluster at the distance of the records it belongs with', () => {
    const nebula = (id: string) => nebulaObjects.objects.find((object) => object.id === id)!.nebula.distance_pc
    const sgrA = compactObjects.objects.find(({ id }) => id === 'sgr-a-star')!
    const notable = new Map(parseStarCatalog(notableDistantCsv).map((star) => [star.id, Math.hypot(star.x_pc, star.y_pc, star.z_pc)]))
    expect(cluster('westerlund-2').cluster!.distance_pc).toBe(nebula('rcw-49'))
    expect(cluster('r136').cluster!.distance_pc).toBe(nebula('tarantula-nebula'))
    expect(cluster('westerlund-1').cluster!.distance_pc).toBeCloseTo(notable.get('westerlund-1-w26')!, 0)
    expect(cluster('r136').cluster!.distance_pc).toBeCloseTo(notable.get('r136a1')!, 0)
    expect(cluster('stephenson-2').cluster!.distance_pc).toBeCloseTo(notable.get('stephenson-2-18')!, 0)
    expect(cluster('quintuplet-cluster').cluster!.distance_pc).toBeCloseTo(notable.get('pistol-star')!, 0)
    for (const id of ['arches-cluster', 'quintuplet-cluster']) expect(cluster(id).cluster!.distance_pc).toBeCloseTo(Math.hypot(sgrA.x_pc, sgrA.y_pc, sgrA.z_pc), 0)
  })

  it('gives super star clusters no tidal edge, space motion or unmeasured values', () => {
    for (const { cluster: details, vx_kms: vx } of clusters.filter(({ type }) => type === 'super_star_cluster')) {
      expect(details!.tidal_radius_pc).toBeNull()
      expect(vx).toBeNull()
      expect(details!.mass_solar).toBeGreaterThanOrEqual(10_000)
      expect([details!.metallicity_fe_h, details!.radial_velocity_kms]).toEqual([null, null])
    }
  })

  it('places Messier 4 nearest and Omega Centauri as the most massive globular cluster', () => {
    const globulars = clusters.filter(({ type }) => type === 'globular_cluster')
    const nearest = globulars.reduce((best, star) => star.cluster!.distance_pc < best.cluster!.distance_pc ? star : best)
    const heaviest = globulars.reduce((best, star) => star.cluster!.mass_solar > best.cluster!.mass_solar ? star : best)
    expect([nearest.id, heaviest.id]).toEqual(['messier-4', 'omega-centauri'])
    // Its pulsar sits at the cluster's distance.
    const pulsar = compactObjects.objects.find(({ id }) => id === 'psr-j1623m2631')!
    expect(Math.hypot(pulsar.x_pc - nearest.x_pc, pulsar.y_pc - nearest.y_pc, pulsar.z_pc - nearest.z_pc)).toBeLessThan(nearest.cluster!.tidal_radius_pc!)
  })

  it('moves each cluster with the published space velocity of its members', () => {
    // Gaia EDR3 (U, V, W) of the Hyades: (−42.11, −19.09, −1.32) km/s; Pleiades about (−6.7, −28.0, −14.0) km/s.
    const hyades = cluster('hyades')
    expect([hyades.vx_kms!, hyades.vy_kms!, hyades.vz_kms!].map((value, axis) => Math.abs(value - [-42.11, -19.09, -1.32][axis]!))).toSatisfy((errors: number[]) => errors.every((error) => error < 1))
    const pleiades = cluster('pleiades')
    expect(Math.hypot(pleiades.vx_kms! + 6.7, pleiades.vy_kms! + 28, pleiades.vz_kms! + 14)).toBeLessThan(1.5)
  })

  it('moves the two halves of the Double Cluster together, with the spectroscopic velocity instead of the sparse Gaia one', () => {
    const [h, chi] = [cluster('ngc-869'), cluster('ngc-884')]
    expect(h.cluster!.radial_velocity_kms).toBe(-47.4)
    expect(chi.cluster!.radial_velocity_source).toEqual(h.cluster!.radial_velocity_source)
    expect(Math.hypot(h.vx_kms! - chi.vx_kms!, h.vy_kms! - chi.vy_kms!, h.vz_kms! - chi.vz_kms!)).toBeLessThan(1)
    expect(Math.hypot(h.x_pc - chi.x_pc, h.y_pc - chi.y_pc, h.z_pc - chi.z_pc)).toBeLessThan(25)
  })

  it('places the Pleiades at the distance of its reflection nebulosity', () => {
    const nebula = nebulaObjects.objects.find(({ id }) => id === 'pleiades-nebula')!
    expect(cluster('pleiades').cluster!.distance_pc).toBe(nebula.nebula.distance_pc)
  })

  it('links notable members to stars of the named catalog', () => {
    const catalogs: Record<string, Set<string>> = {
      'western-constellation-stars': new Set(parseStarCatalog(westernCsv).map(({ id }) => id)),
      'naked-eye-stars': new Set(parseStarCatalog(nakedEyeCsv).map(({ id }) => id)),
      'compact-remnants': new Set(compactObjects.objects.map(({ id }) => id)),
      'notable-distant-stars': new Set(parseStarCatalog(notableDistantCsv).map(({ id }) => id)),
    }
    // These have no member in a bundled catalog.
    expect(clusters.filter(({ cluster: details }) => !details!.notable_members.length).map(({ id }) => id))
      .toEqual(['ngc-869', 'messier-67', 'trumpler-14', 'omega-centauri', '47-tucanae', 'messier-13', 'messier-22', 'messier-15',
        'westerlund-2', 'ngc-3603', 'arches-cluster', 'rsgc-1', 'rsgc-3'])
    for (const { cluster: details } of clusters) {
      for (const member of details!.notable_members) expect(catalogs[member.catalog]?.has(member.id), member.id).toBe(true)
    }
  })
})

describe('catalog members', () => {
  it('lets the bundled catalogs stand for the bright members of the nearby clusters only', () => {
    const stars = [...parseStarCatalog(westernCsv), ...parseStarCatalog(nakedEyeCsv)]
    expect(clusters.filter((star) => clusterHasCatalogMembers(star, stars)).map(({ id }) => id)).toEqual(['hyades', 'pleiades', 'beehive-cluster'])
  })
})

describe('star-cluster glow', () => {
  it('generates the same puffs every time, all within the tidal radius or display edge', () => {
    for (const { id, type, cluster: details } of clusters) {
      const first = starClusterGlowPuffs(id, type as StarClusterObjectType, details!)
      expect(starClusterGlowPuffs(id, type as StarClusterObjectType, details!).centers).toEqual(first.centers)
      for (let index = 0; index < first.count; index++) {
        const [x, y, z] = first.centers.slice(index * 3, index * 3 + 3)
        expect(Math.hypot(x!, y!, z!)).toBeLessThanOrEqual(clusterExtentPc(details!) + 1e-4)
      }
    }
  })

  it('fits a dense cluster profile to its published half-light radius', () => {
    for (const { id, type, cluster: details } of clusters.filter(({ type }) => type !== 'open_cluster')) {
      // Projected on the sky, half of the bright stars lie within the half-light radius.
      const { centers, count } = clusterStarPuffs(id, type as StarClusterObjectType, details!)
      const projected = Array.from({ length: count }, (_, index) => Math.hypot(centers[index * 3]!, centers[index * 3 + 1]!)).sort((a, b) => a - b)
      expect(projected[count / 2]! / details!.half_member_radius_pc, id).toBeGreaterThan(0.85)
      expect(projected[count / 2]! / details!.half_member_radius_pc, id).toBeLessThan(1.15)
    }
  })
})

describe('star clusters in wavelength bands', () => {
  it('lights young clusters in ultraviolet and X-rays, red supergiant clusters in the near infrared', () => {
    const weights = (id: string) => (['ultraviolet', 'near-infrared', 'x-ray', 'gamma', 'radio'] as const).map((band) => clusterBandWeight(cluster(id), band))
    expect(weights('r136')).toEqual([1.3, 0.8, 0.5, 0, 0])
    expect(weights('stephenson-2')).toEqual([0.8, 1.4, 0, 0, 0])
    expect(weights('westerlund-1')).toEqual([1.3, 0.8, 0.5, 0.4, 0])
    expect(weights('omega-centauri')).toEqual([0.3, 1.2, 0, 0, 0])
  })
})
