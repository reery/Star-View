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
  it('retains all 65 published 3D cloud features inside 2000 light-years', () => {
    expect(clouds).toHaveLength(65)
    expect(manifest).toMatchObject({ sourceVoxelCount: 78_326, displaySampleCount: 19_606 })
    expect(clouds.every((cloud) => cloud.type === 'molecular_cloud')).toBe(true)
    expect(Math.min(...clouds.map((cloud) => cloud.molecular_cloud!.distance_pc))).toBe(116)
    expect(Math.max(...clouds.map((cloud) => cloud.molecular_cloud!.distance_pc)) * LIGHT_YEARS_PER_PARSEC).toBeLessThan(2000)
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
