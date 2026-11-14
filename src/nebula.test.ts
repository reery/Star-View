import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import manifestRaw from './data/overlays/nebulae/manifest.json?raw'
import payloadRaw from './data/overlays/nebulae/objects.json?raw'
import compactPayloadRaw from './data/overlays/compact-remnants/objects.json?raw'
import compactInfo from './data/compact-object-info.json'
import { equatorialToGalacticPc, type Star } from './catalog-model'
import { galacticToWorld, LIGHT_YEARS_PER_PARSEC, starDisplayColor } from './astronomy'
import { decodeNebulaMask, parseNebulaOverlayManifest, parseNebulaOverlayPayload } from './nebula-overlay-model'
import { detailPuffCount, generateNebulaPuffs, nebulaBasis, nebulaExposure, packNebulaInstances, puffSource, seededRandom } from './nebula-layer'

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
    expect(nebulae).toHaveLength(93)
    expect(manifest.counts).toEqual({ reflection_nebula: 59, hii_region: 14, planetary_nebula: 16, supernova_remnant: 4 })
    expect(byId('sh-2-216').type).toBe('planetary_nebula')
  })

  it('keeps every census nebula within 1 sigma of 2000 ly and at least 5 arcmin across', () => {
    const cutoffPc = 2000 / LIGHT_YEARS_PER_PARSEC
    const showcases = ['orion-nebula', 'crab-nebula']
    for (const nebula of nebulae.filter((candidate) => !showcases.includes(candidate.id))) {
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

  it('rejects malformed H-alpha masks', () => {
    const masked = JSON.parse(payloadRaw).objects.findIndex((object: Record<string, any>) => object.nebula.shape.mask)
    const withMask = (change: (shape: Record<string, any>) => void) => {
      const payload = JSON.parse(payloadRaw)
      change(payload.objects[masked].nebula.shape)
      return payload
    }
    expect(() => parseNebulaOverlayPayload(withMask((shape) => { shape.mask.size = [3, 3] }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(withMask((shape) => { shape.position_angle_deg = 10 }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(withMask((shape) => { shape.kind = 'blister' }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(withMask((shape) => { shape.mask.values = 'not base64!' }), manifest)).toThrow(/row/)
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

  it('links each supernova remnant to a neutron star in the compact-object overlay', () => {
    // The app titles these pulsars by their Info article names.
    const compact = new Map((JSON.parse(compactPayloadRaw).objects as Star[]).map((star) =>
      [star.id, compactInfo.articles[star.id as keyof typeof compactInfo.articles]?.name ?? star.name]))
    const remnants = nebulae.filter((nebula) => nebula.type === 'supernova_remnant')
    expect(remnants.map(({ id }) => id)).toEqual(['vela-supernova-remnant', 'monogem-ring', 'hoinga', 'crab-nebula'])
    for (const { id, nebula } of remnants) {
      const star = nebula!.remnant!.neutron_star
      if (star) expect(compact.get(star.id), id).toBe(star.name)
    }
    expect(() => parseNebulaOverlayPayload(payloadWith((object) => { object.nebula.remnant = remnants[0]!.nebula!.remnant }), manifest)).toThrow(/Invalid nebula payload row/)
  })

  it('draws remnant filaments as thin threads on the shell surface', () => {
    const vela = byId('vela-supernova-remnant')
    const [depth, major, minor] = vela.nebula!.shape.semi_axes_pc
    const puffs = generateNebulaPuffs(vela, sun)
    const planetary = byId('sh-2-216')
    const shell = generateNebulaPuffs(planetary, sun)
    let oxygen = 0
    for (let index = 0; index < puffs.count; index++) {
      const [d, u, v] = puffs.local.subarray(index * 3, index * 3 + 3)
      expect(Math.hypot(d! / depth, u! / major, v! / minor)).toBeGreaterThan(0.9)
      if (puffs.vividColors[index * 3 + 1]! > puffs.vividColors[index * 3]!) oxygen++
    }
    // A teal [O III] sheath accompanies the red hydrogen threads.
    expect(oxygen / puffs.count).toBeGreaterThan(0.25)
    expect(oxygen / puffs.count).toBeLessThan(0.4)
    // Threads are much thinner than the soft puffs of a filled shell of the same puff budget.
    expect(puffs.shapes[0]! / major).toBeLessThan(0.5 * shell.shapes[0]! / planetary.nebula!.shape.semi_axes_pc[1])
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

  it('places mask-shaped puffs where the H-alpha map is bright', () => {
    const lambda = byId('lambda-orionis-nebula')
    const { semi_axes_pc: [depth, major, minor], mask } = lambda.nebula!.shape
    const values = decodeNebulaMask(mask!)
    const [columns, rows] = mask!.size
    const puffs = generateNebulaPuffs(lambda, sun)
    expect(puffs.count).toBe(lambda.nebula!.puff_count)
    let dark = 0
    for (let index = 0; index < puffs.count; index++) {
      const [d, u, v] = puffs.local.subarray(index * 3, index * 3 + 3)
      expect(Math.abs(u!)).toBeLessThanOrEqual(major)
      expect(Math.abs(v!)).toBeLessThanOrEqual(minor)
      expect(Math.abs(d!)).toBeLessThanOrEqual(depth)
      const column = Math.min(columns - 1, Math.floor((v! / minor + 1) / 2 * columns))
      const row = Math.min(rows - 1, Math.floor((u! / major + 1) / 2 * rows))
      if (values[row * columns + column] === 0) dark++
    }
    expect(dark).toBe(0)
    // Kernels follow the mask pixel scale, not the uniform-volume overlap rule.
    const kernel = 2 * 2 * major / rows
    expect(puffs.shapes[0]).toBeGreaterThanOrEqual(0.9 * kernel)
    expect(puffs.shapes[0]).toBeLessThanOrEqual(1.1 * kernel)
  })

  it('places measured Crab filaments inside a smooth synchrotron body', () => {
    const crab = byId('crab-nebula')
    const { semi_axes_pc: [depth, major, minor], points } = crab.nebula!.shape
    const measured = decodeNebulaMask(points!).length / 4
    const puffs = generateNebulaPuffs(crab, sun)
    expect(puffs.count).toBe(crab.nebula!.puff_count)
    const body: number[] = []
    for (let index = 0; index < puffs.count; index++) {
      const [d, u, v] = puffs.local.subarray(index * 3, index * 3 + 3)
      expect(Math.abs(d!)).toBeLessThanOrEqual(depth + 1e-6)
      expect(Math.abs(u!)).toBeLessThanOrEqual(major + 1e-6)
      expect(Math.abs(v!)).toBeLessThanOrEqual(minor + 1e-6)
      if (puffs.shapes[index * 4]! > 2 * points!.radius_pc) body.push(index)
    }
    expect(body).toHaveLength(puffs.count - measured)
    // Body puffs are spread through the order, so a level-of-detail prefix keeps the glow.
    expect(body.filter((index) => index < puffs.count / 2).length).toBeCloseTo(body.length / 2, -1)
    const withPoints = (change: (shape: Record<string, any>) => void) => {
      const payload = JSON.parse(payloadRaw)
      change(payload.objects.find((object: Record<string, any>) => object.id === 'crab-nebula').nebula.shape)
      return payload
    }
    expect(parseNebulaOverlayPayload(withPoints(() => {}), manifest)).toHaveLength(nebulae.length)
    expect(() => parseNebulaOverlayPayload(withPoints((shape) => { shape.kind = 'shell' }), manifest)).toThrow(/row/)
    expect(() => parseNebulaOverlayPayload(withPoints((shape) => { shape.points.values = 'AAA=' }), manifest)).toThrow(/row/)
  })

  it('packs drawn nebulae as level-of-detail prefixes with widened puffs', () => {
    const sources = nebulae.map((nebula) => generateNebulaPuffs(nebula, sun))
    const capacity = sources.reduce((sum, puffs) => sum + puffs.count, 0)
    const target = {
      centers: new Float32Array(capacity * 3),
      shapes: new Float32Array(capacity * 4),
      realColors: new Float32Array(capacity * 3),
      vividColors: new Float32Array(capacity * 3),
    }
    expect(packNebulaInstances(sources.map((puffs) => ({ puffs, count: puffs.count, radiusScale: 1, alphaScale: 1 })), target)).toBe(capacity)
    const [first, second] = sources as [typeof sources[0], typeof sources[0]]
    const half = Math.ceil(first.count / 2)
    expect(packNebulaInstances([
      { puffs: first, count: half, radiusScale: 2, alphaScale: 0.5 },
      { puffs: second, count: second.count, radiusScale: 1, alphaScale: 1 },
    ], target)).toBe(half + second.count)
    expect(target.shapes[0]).toBeCloseTo(2 * first.shapes[0]!)
    expect(target.shapes[1]).toBeCloseTo(0.5 * first.shapes[1]!)
    expect(target.shapes.subarray(2, 4)).toEqual(first.shapes.subarray(2, 4))
    expect(target.shapes.subarray(half * 4, half * 4 + 4)).toEqual(second.shapes.subarray(0, 4))
    expect(packNebulaInstances([], target)).toBe(0)
  })

  it('exposes every nebula by its surface brightness on one scale', () => {
    const exposure = (id: string) => nebulaExposure(byId(id).nebula!.surface_brightness_mag_arcsec2)
    expect(exposure('orion-nebula')).toBe(1)
    // The Orion Nebula outshines the faint lambda Orionis ring per patch of sky by an order of magnitude.
    expect(exposure('lambda-orionis-nebula')).toBeLessThan(exposure('orion-nebula') / 8)
    expect(exposure('california-nebula')).toBeGreaterThan(exposure('lambda-orionis-nebula'))
    // Each lift step (high brightness two, a telescope one) brightens fainter nebulae;
    // the Orion Nebula is already at full weight.
    const lifted = (id: string, lift: number) => nebulaExposure(byId(id).nebula!.surface_brightness_mag_arcsec2, lift)
    for (const lift of [1, 2, 3]) {
      expect(lifted('orion-nebula', lift)).toBe(1)
      expect(lifted('lambda-orionis-nebula', lift)).toBeGreaterThan(lifted('lambda-orionis-nebula', lift - 1))
      expect(lifted('vdb-27', lift)).toBeGreaterThan(lifted('vdb-27', lift - 1))
    }
    // Even the faintest stays faintly visible.
    expect(Math.min(...nebulae.map((nebula) => nebulaExposure(nebula.nebula!.surface_brightness_mag_arcsec2)))).toBeGreaterThan(0)
    // Measured values cite their catalogue; plate classes and hand estimates are flagged as estimated.
    expect(byId('orion-nebula').nebula!.surface_brightness_estimated).toBe(false)
    expect(byId('orion-nebula').nebula!.surface_brightness_source).toMatch(/Finkbeiner/)
    expect(byId('dumbbell-nebula').nebula!.surface_brightness_source).toMatch(/Strasbourg-ESO/)
    expect(byId('messier-78').nebula!.surface_brightness_estimated).toBe(true)
  })

  it('generates any prefix of a nebula identically', () => {
    for (const id of ['crab-nebula', 'vela-supernova-remnant', 'orion-nebula', 'pleiades-nebula']) {
      const full = generateNebulaPuffs(byId(id), sun)
      const prefix = generateNebulaPuffs(byId(id), sun, 16)
      expect(prefix.count, id).toBe(16)
      expect(prefix.centers, id).toEqual(full.centers.subarray(0, 16 * 3))
      expect(prefix.shapes, id).toEqual(full.shapes.subarray(0, 16 * 4))
      expect(prefix.realColors, id).toEqual(full.realColors.subarray(0, 16 * 3))
    }
  })

  it('thins nebulae only while their widened puffs stay below the minimum kernel', () => {
    const source = { ...puffSource(generateNebulaPuffs(byId('crab-nebula'), sun)), extent: { center: sun, semiAxes: [1.8, 1.5] as const } }
    // A few pixels across: the coarsest prefix; large on screen: every puff.
    expect(detailPuffCount(source, 0.05, 0.1)).toBe(16)
    expect(detailPuffCount(source, 0.05, 100)).toBe(source.count)
    // Levels step by four from full detail, so zooming repacks rarely.
    const counts = [0.3, 0.6, 1.2, 2.4, 4.8].map((pixelsPerPc) => detailPuffCount(source, 0.05, pixelsPerPc))
    expect(counts.every((count, index) => index === 0 || count >= counts[index - 1]!)).toBe(true)
    for (const count of counts.filter((value) => value > 16 && value < source.count)) {
      expect([1, 4, 16, 64, 256].map((step) => Math.ceil(source.count / step))).toContain(count)
    }
    // Each drawn puff widened by √(full / drawn) stays at most the 1.5 px minimum kernel.
    for (const pixelsPerPc of [0.3, 1.2, 4.8]) {
      const count = detailPuffCount(source, 0.05, pixelsPerPc)
      if (count < source.count) expect(0.05 * Math.sqrt(source.count / count) * pixelsPerPc).toBeLessThanOrEqual(1.5)
    }
  })
})
