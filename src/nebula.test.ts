import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import manifestRaw from './data/overlays/nebulae/manifest.json?raw'
import payloadRaw from './data/overlays/nebulae/objects.json?raw'
import { equatorialToGalacticPc, type Star } from './catalog-model'
import { galacticToWorld, LIGHT_YEARS_PER_PARSEC, starDisplayColor } from './astronomy'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from './nebula-overlay-model'
import { generateNebulaPuffs, nebulaBasis, packNebulaInstances, seededRandom } from './nebula-layer'

const manifest = parseNebulaOverlayManifest(manifestRaw)
const nebulae = parseNebulaOverlayPayload(JSON.parse(payloadRaw), manifest)
const byId = (id: string) => nebulae.find((nebula) => nebula.id === id)!
const sun = new Vector3()

function payloadWith(change: (object: Record<string, any>) => void) {
  const payload = JSON.parse(payloadRaw)
  change(payload.objects[1])
  return payload
}

describe('nebula overlay data', () => {
  it('validates the bundled showcase and census records', () => {
    expect(nebulae.slice(0, 2).map((nebula) => [nebula.id, nebula.type])).toEqual([
      ['pleiades-nebula', 'reflection_nebula'],
      ['orion-nebula', 'hii_region'],
    ])
    expect(nebulae).toHaveLength(22)
    expect(manifest.counts).toEqual({ reflection_nebula: 17, hii_region: 4, planetary_nebula: 1 })
    expect(byId('sh-2-216').type).toBe('planetary_nebula')
  })

  it('keeps every census nebula within 1 sigma of 500 ly and at least 5 arcmin across', () => {
    const cutoffPc = 500 / LIGHT_YEARS_PER_PARSEC
    for (const nebula of nebulae.filter((candidate) => candidate.id !== 'orion-nebula')) {
      const { distance_pc, distance_error_pc, angular_size_arcmin } = nebula.nebula!
      expect(distance_pc - (distance_error_pc ?? 0), nebula.id).toBeLessThanOrEqual(cutoffPc)
      expect(Math.max(...angular_size_arcmin), nebula.id).toBeGreaterThanOrEqual(5)
    }
  })

  it('places the nebulae at their Galactic directions and adopted distances', () => {
    const orion = byId('orion-nebula')
    const pleiades = byId('pleiades-nebula')
    const galactic = (star: Star) => ({
      l: (Math.atan2(star.y_pc, star.x_pc) * 180 / Math.PI + 360) % 360,
      b: Math.asin(star.z_pc / Math.hypot(star.x_pc, star.y_pc, star.z_pc)) * 180 / Math.PI,
      distance: Math.hypot(star.x_pc, star.y_pc, star.z_pc),
    })
    expect(galactic(orion).l).toBeCloseTo(209.01, 1)
    expect(galactic(orion).b).toBeCloseTo(-19.38, 1)
    expect(galactic(orion).distance).toBeCloseTo(388, 3)
    expect(galactic(pleiades).l).toBeCloseTo(166.46, 1)
    expect(galactic(pleiades).b).toBeCloseTo(-23.53, 1)
    expect(galactic(pleiades).distance).toBeCloseTo(135.74, 3)
  })

  it('rejects positions that disagree with RA, Dec and distance', () => {
    expect(() => parseNebulaOverlayPayload(payloadWith((object) => { object.x_pc += 0.5 }), manifest)).toThrow(/position/)
    const shifted = payloadWith((object) => {
      object.nebula.distance_pc = 400
      Object.assign(object, equatorialToGalacticPc(object.nebula.ra_deg, object.nebula.dec_deg, 400))
    })
    expect(parseNebulaOverlayPayload(shifted, manifest)[1]!.nebula!.distance_pc).toBe(400)
  })

  it('rejects malformed palettes, shapes and type counts', () => {
    expect(() => parseNebulaOverlayPayload(payloadWith((object) => { object.nebula.palette.real = ['red'] }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(payloadWith((object) => { object.nebula.shape.kind = 'torus' }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(payloadWith((object) => { object.nebula.source_url = 'http://example.com' }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(payloadWith((object) => { object.type = 'reflection_nebula' }), manifest)).toThrow(/counts/)
  })

  it('uses palette colors for both color modes', () => {
    const orion = byId('orion-nebula')
    expect(starDisplayColor(orion, 'real').getHexString()).toBe('e7a5b0')
    expect(starDisplayColor(orion, 'exaggerated').getHexString()).toBe('ff4fa6')
  })
})

describe('nebula puff volumes', () => {
  it('builds an orthonormal sky basis around the line of sight', () => {
    const center = galacticToWorld(byId('orion-nebula'))
    const basis = nebulaBasis(center, sun, 30)
    for (const axis of [basis.lineOfSight, basis.major, basis.minor]) expect(axis.length()).toBeCloseTo(1, 10)
    expect(basis.lineOfSight.dot(basis.major)).toBeCloseTo(0, 10)
    expect(basis.lineOfSight.dot(basis.minor)).toBeCloseTo(0, 10)
    expect(basis.major.dot(basis.minor)).toBeCloseTo(0, 10)
    expect(basis.lineOfSight.dot(center.clone().normalize())).toBeCloseTo(1, 10)
  })

  it('is deterministic for a seed', () => {
    const random = seededRandom(7)
    const again = seededRandom(7)
    expect(Array.from({ length: 5 }, random)).toEqual(Array.from({ length: 5 }, again))
    const first = generateNebulaPuffs(byId('orion-nebula'), sun)
    const second = generateNebulaPuffs(byId('orion-nebula'), sun)
    expect(second.centers).toEqual(first.centers)
    expect(second.shapes).toEqual(first.shapes)
  })

  it('keeps the Orion bowl inside its modeled extent and mostly behind its center', () => {
    const orion = byId('orion-nebula')
    const [depth, major, minor] = orion.nebula!.shape.semi_axes_pc
    const puffs = generateNebulaPuffs(orion, sun)
    let behind = 0
    for (let index = 0; index < puffs.count; index++) {
      const [d, u, v] = puffs.local.subarray(index * 3, index * 3 + 3)
      expect(Math.hypot(d! / depth, u! / major, v! / minor)).toBeLessThan(1.5)
      if (d! > 0) behind++
    }
    expect(behind / puffs.count).toBeGreaterThan(0.75)
    const center = galacticToWorld(orion)
    const first = new Vector3().fromArray(puffs.centers, 0)
    expect(first.distanceTo(center)).toBeLessThan(Math.max(depth, major, minor) * 1.5)
  })

  it('places Pleiades dust in the configured line-of-sight sheets', () => {
    const pleiades = byId('pleiades-nebula')
    const { layer_offsets_pc: offsets, semi_axes_pc: [thickness] } = pleiades.nebula!.shape
    const puffs = generateNebulaPuffs(pleiades, sun)
    for (let index = 0; index < puffs.count; index++) {
      const depth = puffs.local[index * 3]!
      expect(Math.min(...offsets.map((offset) => Math.abs(depth - offset)))).toBeLessThan(thickness * 5)
    }
  })

  it('samples the planetary nebula as a hollow shell', () => {
    const shell = byId('sh-2-216')
    expect(shell.nebula!.shape.kind).toBe('shell')
    const [depth, major, minor] = shell.nebula!.shape.semi_axes_pc
    const puffs = generateNebulaPuffs(shell, sun)
    for (let index = 0; index < puffs.count; index++) {
      const [d, u, v] = puffs.local.subarray(index * 3, index * 3 + 3)
      const radius = Math.hypot(d! / depth, u! / major, v! / minor)
      expect(radius).toBeGreaterThanOrEqual(0.8 - 1e-6)
      expect(radius).toBeLessThanOrEqual(1 + 1e-6)
    }
  })

  it('packs visible nebulae with level-of-detail prefixes', () => {
    const sources = nebulae.map((nebula) => generateNebulaPuffs(nebula, sun))
    const capacity = sources.reduce((sum, puffs) => sum + puffs.count, 0)
    const target = {
      centers: new Float32Array(capacity * 3),
      shapes: new Float32Array(capacity * 4),
      realColors: new Float32Array(capacity * 3),
      vividColors: new Float32Array(capacity * 3),
    }
    const all = sources.map(() => true)
    const onlySecond = sources.map((_, index) => index === 1)
    expect(packNebulaInstances(sources, all, 1, target)).toBe(capacity)
    expect(packNebulaInstances(sources, onlySecond, 1, target)).toBe(sources[1]!.count)
    expect(target.centers.subarray(0, 3)).toEqual(sources[1]!.centers.subarray(0, 3))
    expect(packNebulaInstances(sources, all, 0.5, target)).toBe(sources.reduce((sum, puffs) => sum + Math.ceil(puffs.count / 2), 0))
    expect(target.shapes.subarray(Math.ceil(sources[0]!.count / 2) * 4, Math.ceil(sources[0]!.count / 2) * 4 + 4))
      .toEqual(sources[1]!.shapes.subarray(0, 4))
    expect(packNebulaInstances(sources, sources.map(() => false), 1, target)).toBe(0)
  })
})
