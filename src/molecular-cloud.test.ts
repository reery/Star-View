import { describe, expect, it } from 'vitest'
import manifestRaw from './data/overlays/molecular-clouds/manifest.json?raw'
import payloadRaw from './data/overlays/molecular-clouds/objects.json?raw'
import { LIGHT_YEARS_PER_PARSEC, starDisplayColor } from './astronomy'
import { generateMolecularCloudPuffs, packMolecularCloudInstances } from './molecular-cloud-layer'
import { parseMolecularCloudOverlayManifest, parseMolecularCloudOverlayPayload } from './molecular-cloud-overlay-model'

const manifest = parseMolecularCloudOverlayManifest(manifestRaw)
const clouds = parseMolecularCloudOverlayPayload(JSON.parse(payloadRaw), manifest)
const byId = (id: string) => clouds.find((cloud) => cloud.id === id)!

function payloadWith(change: (object: Record<string, any>) => void) {
  const payload = JSON.parse(payloadRaw)
  change(payload.objects[0])
  return payload
}

describe('molecular-cloud overlay data', () => {
  it('retains all 65 published 3D cloud features and adds the smaller clouds within 1000 light-years', () => {
    const cahlon = clouds.filter((cloud) => cloud.id.startsWith('cahlon-cloud-'))
    const added = clouds.filter((cloud) => cloud.type === 'molecular_cloud' && !cloud.id.startsWith('cahlon-cloud-'))
    expect(cahlon).toHaveLength(65)
    expect(cahlon.reduce((sum, cloud) => sum + cloud.molecular_cloud!.source_voxel_count, 0)).toBe(78_326)
    expect(Math.min(...cahlon.map((cloud) => cloud.molecular_cloud!.distance_pc))).toBe(116)
    expect(Math.max(...cahlon.map((cloud) => cloud.molecular_cloud!.distance_pc)) * LIGHT_YEARS_PER_PARSEC).toBeLessThan(2000)
    expect(added).toHaveLength(manifest.counts.molecular_cloud - 65)
    expect(added.every((cloud) => cloud.molecular_cloud!.distance_pc * LIGHT_YEARS_PER_PARSEC <= 1000)).toBe(true)
    expect(added.every((cloud) => cloud.molecular_cloud!.source_voxel_count >= 100)).toBe(true)
  })

  it('places every dark nebula within 1000 light-years, inside a drawn cloud or with dust of its own', () => {
    const nebulae = clouds.filter((object) => object.type === 'dark_nebula')
    expect(nebulae).toHaveLength(manifest.counts.dark_nebula)
    expect(nebulae.length).toBeGreaterThan(500)
    for (const nebula of nebulae) {
      const details = nebula.dark_nebula!
      expect(details.distance_pc * LIGHT_YEARS_PER_PARSEC).toBeLessThanOrEqual(1000)
      if (details.parent_cloud_id) expect(byId(details.parent_cloud_id).type).toBe('molecular_cloud')
      else expect(details.geometry!.source_voxel_count).toBeGreaterThan(0)
    }
    // Barnard 68, a small globule in the Pipe Nebula, about 150 pc away.
    expect(byId('ldn-57')).toMatchObject({ name: 'Barnard 68', designations: ['LDN 57', 'Barnard 68'] })
    expect(byId('ldn-57').dark_nebula!.distance_pc).toBeGreaterThan(130)
    expect(byId('ldn-57').dark_nebula!.distance_pc).toBeLessThan(170)
    expect(byId('ldn-1688').dark_nebula!.parent_cloud_id).toBe('cahlon-cloud-34')
    // Edenhofer places Corona Australis about 70 pc too far; its nebulae follow the measured cloud.
    expect(byId('fest-1-445').dark_nebula).toMatchObject({ parent_cloud_id: 'corona-australis-molecular-cloud', distance_pc: 147 })
  })

  it('names unnamed clouds from measured sightlines and their dark nebulae', () => {
    expect(byId('cahlon-cloud-30')).toMatchObject({ name: 'Coalsack - Cloud 30', molecular_cloud: { complex_name: null, association: { name: 'Coalsack' } } })
    expect(byId('cahlon-cloud-0').name).toBe('MBM 12')
    expect(byId('corona-australis-molecular-cloud').name).toBe('Corona Australis Molecular Cloud')
    expect(byId('dust-cloud-g2111m365').name).toBe('LDN 1642 Cloud')
  })

  it('preserves named complexes and physical cloud properties', () => {
    expect(byId('cahlon-cloud-22')).toMatchObject({
      name: 'Taurus Molecular Cloud',
      mass_solar: 6352,
      molecular_cloud: {
        catalog_id: 22,
        complex_name: 'Taurus',
        distance_pc: 147,
        mean_density_cm3: 47,
        peak_density_cm3: 562,
        source_voxel_count: 4312,
      },
    })
    expect(byId('cahlon-cloud-7').molecular_cloud!.sample_points_pc).toHaveLength(1934 * 3)
  })

  it('rejects dark nebulae off their position or anchored to a missing cloud', () => {
    const nebula = (change: (object: Record<string, any>) => void) => {
      const payload = JSON.parse(payloadRaw)
      change(payload.objects.find((object: Record<string, any>) => object.id === 'ldn-1688'))
      return payload
    }
    expect(() => parseMolecularCloudOverlayPayload(nebula((object) => { object.z_pc += 1 }), manifest)).toThrow(/position/)
    expect(() => parseMolecularCloudOverlayPayload(nebula((object) => { object.dark_nebula.parent_cloud_id = 'cahlon-cloud-99' }), manifest)).toThrow(/missing cloud/)
  })

  it('rejects inconsistent centers, samples and totals', () => {
    expect(() => parseMolecularCloudOverlayPayload(payloadWith((object) => { object.x_pc += 3 }), manifest)).toThrow(/distance|direction/)
    expect(() => parseMolecularCloudOverlayPayload(payloadWith((object) => { object.molecular_cloud.sample_points_pc[0] = 10_000 }), manifest)).toThrow(/outside/)
    expect(() => parseMolecularCloudOverlayPayload(payloadWith((object) => { object.molecular_cloud.source_voxel_count += 1 }), manifest)).toThrow(/totals/)
  })

  it('uses the published overlay palette for object swatches', () => {
    const taurus = byId('cahlon-cloud-22')
    expect(starDisplayColor(taurus, 'real').getHexString()).toBe(taurus.molecular_cloud!.palette.real.rim.slice(1))
    expect(starDisplayColor(taurus, 'exaggerated').getHexString()).toBe(taurus.molecular_cloud!.palette.exaggerated.rim.slice(1))
  })
})

describe('molecular-cloud fog volumes', () => {
  it('maps Galactic source voxels into viewer world coordinates deterministically', () => {
    const cloud = byId('cahlon-cloud-22')
    const first = generateMolecularCloudPuffs(cloud, 0)
    const second = generateMolecularCloudPuffs(cloud, 0)
    expect(second.centers).toEqual(first.centers)
    expect(second.shapes).toEqual(first.shapes)
    const source = cloud.molecular_cloud!.sample_points_pc
    expect(Array.from(first.centers.slice(0, 3))).toEqual([source[0], source[2], -source[1]!])
  })

  it('packs visible clouds and deterministic LOD prefixes', () => {
    const sources = clouds.slice(0, 2).map((cloud, index) => generateMolecularCloudPuffs(cloud, index))
    const capacity = sources.reduce((sum, source) => sum + source.count, 0)
    const target = {
      centers: new Float32Array(capacity * 3),
      shapes: new Float32Array(capacity * 4),
      realBodyColors: new Float32Array(capacity * 3),
      realRimColors: new Float32Array(capacity * 3),
      vividBodyColors: new Float32Array(capacity * 3),
      vividRimColors: new Float32Array(capacity * 3),
      cloudIndices: new Float32Array(capacity),
    }
    expect(packMolecularCloudInstances(sources, [true, true], 1, target)).toBe(capacity)
    expect(packMolecularCloudInstances(sources, [false, true], 1, target)).toBe(sources[1]!.count)
    expect(packMolecularCloudInstances(sources, [true, true], 0.4, target)).toBe(sources.reduce((sum, source) => sum + Math.ceil(source.count * 0.4), 0))
  })
})
