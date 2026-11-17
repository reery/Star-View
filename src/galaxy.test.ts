import { describe, expect, it } from 'vitest'
import { ARMS, armRadius, galactocentricToWorld, generateGalaxyPuffs, generateLocalGalaxyPuffs, tiltedDisk } from './galaxy-layer'
import { distanceFade } from './milky-way-layer'
import { parseGalaxyOverlayManifest, parseGalaxyOverlayPayload } from './galaxy-overlay-model'
import { isObjectMapVisible, maxOrbitDistancePc } from './viewer-primitives'
import { galacticToWorld, LIGHT_YEARS_PER_PARSEC } from './astronomy'
import { ICRS_TO_GALACTIC_ROWS } from './catalog-model'
import { Vector3 } from 'three'
import manifestRaw from './data/overlays/galaxies/manifest.json?raw'
import payloadRaw from './data/overlays/galaxies/objects.json?raw'

const arm = (name: string) => ARMS.find((candidate) => candidate.name === name)!

describe('Galaxy model', () => {
  it('places the Sun at the origin and the Galactic Center toward l = 0°', () => {
    expect(galactocentricToWorld(8150, 0, 5.5).map((value) => Math.abs(value))).toEqual([0, 0, 0])
    expect(galactocentricToWorld(0, 0, 0)).toEqual([8150, -5.5, -0])
    // Increasing azimuth follows Galactic rotation, toward l = 90° (world -z).
    expect(galactocentricToWorld(8150, 10, 0)[2]).toBeLessThan(0)
  })

  it('follows the published arm fits and puts the Sun on the Local Arm’s inner edge', () => {
    for (const { kink, radius, ...rest } of ARMS) expect(armRadius({ kink, radius, ...rest }, kink)).toBeCloseTo(radius, 10)
    const local = armRadius(arm('Local'), 0)
    expect(local - 8.15).toBeGreaterThan(0.2)
    expect(local - 8.15).toBeLessThan(0.5)
    expect(armRadius(arm('Sagittarius–Carina'), 0)).toBeLessThan(8.15)
    expect(armRadius(arm('Perseus'), 0)).toBeGreaterThan(local)
  })

  it('continues Norma across the far side into the Outer arm', () => {
    expect(armRadius(arm('Norma'), -289)).toBeCloseTo(armRadius(arm('Outer'), 71), 1)
  })

  it('generates the same finite puffs every time, within the Galactic disk', () => {
    const first = generateGalaxyPuffs()
    const second = generateGalaxyPuffs()
    expect(second.emission.centers).toEqual(first.emission.centers)
    expect(second.dust.shapes).toEqual(first.dust.shapes)
    for (const puffs of [first.emission, first.dust]) {
      expect(puffs.count).toBeGreaterThan(0)
      expect(puffs.centers.every(Number.isFinite) && puffs.shapes.every(Number.isFinite)).toBe(true)
      for (let index = 0; index < puffs.count; index++) {
        const [x, y, z] = puffs.centers.subarray(index * 3, index * 3 + 3)
        expect(Math.hypot(x! - 8150, z!)).toBeLessThan(20_000)
        expect(Math.abs(y!)).toBeLessThan(3000)
      }
    }
  })
})

describe('Milky Way distance fade', () => {
  it('eases from 0 to 1 across the range on a logarithmic scale', () => {
    const range = [1000, 10_000] as const
    expect(distanceFade(500, range)).toBe(0)
    expect(distanceFade(1000, range)).toBe(0)
    expect(distanceFade(Math.sqrt(1000 * 10_000), range)).toBeCloseTo(0.5, 10)
    expect(distanceFade(10_000, range)).toBe(1)
    expect(distanceFade(50_000, range)).toBe(1)
  })
})

describe('Local Group galaxies', () => {
  const manifest = parseGalaxyOverlayManifest(manifestRaw)
  const galaxies = parseGalaxyOverlayPayload(JSON.parse(payloadRaw), manifest)
  const galaxy = (id: string) => galaxies.find((candidate) => candidate.id === id)!

  it('places each galaxy at its reviewed center and distance', () => {
    expect(galaxies.map(({ id }) => id)).toEqual(['milky-way', 'large-magellanic-cloud', 'small-magellanic-cloud', 'andromeda-galaxy', 'triangulum-galaxy',
      'sagittarius-dwarf-galaxy', 'fornax-dwarf-galaxy', 'sculptor-dwarf-galaxy', 'draco-dwarf-galaxy', 'ursa-minor-dwarf-galaxy', 'carina-dwarf-galaxy',
      'sextans-dwarf-galaxy', 'leo-i-dwarf-galaxy', 'leo-ii-dwarf-galaxy', 'messier-32', 'messier-110', 'ngc-185', 'ngc-147'])
    // Sagittarius A* lies just below the plane toward l = 0°; Andromeda at l = 121.2°, b = −21.6°.
    const center = galaxy('milky-way')
    expect(Math.hypot(center.x_pc, center.y_pc, center.z_pc)).toBeCloseTo(8178, 0)
    const andromeda = galaxy('andromeda-galaxy')
    expect((Math.atan2(andromeda.y_pc, andromeda.x_pc) * 180 / Math.PI + 360) % 360).toBeCloseTo(121.17, 1)
    expect(Math.asin(andromeda.z_pc / andromeda.galaxy!.distance_pc) * 180 / Math.PI).toBeCloseTo(-21.57, 1)
  })

  it('rejects a position that disagrees with the center and distance', () => {
    const payload = JSON.parse(payloadRaw)
    payload.objects[1].x_pc += 100
    expect(() => parseGalaxyOverlayPayload(payload, manifest)).toThrow(/position/)
  })

  it('tilts a disk by its inclination, with the far side receding', () => {
    const disk = tiltedDisk(60, 0, 90)
    // The line of nodes runs north and stays in the sky plane.
    expect(disk.toSky(1000, 0, 0).map((value) => Math.round(value))).toEqual([0, 1000, 0])
    // Toward the far side (east), the disk is foreshortened by cos i and recedes by sin i.
    const [east, north, depth] = disk.toSky(0, 1000, 0)
    expect(east).toBeCloseTo(500, 6)
    expect(north).toBeCloseTo(0, 6)
    expect(depth).toBeCloseTo(866.03, 1)
    expect(disk.fromSky(500, 300)).toEqual([300, expect.closeTo(1000, 6)])
  })

  it('generates each model as a deterministic prefix, so any detail level is an unbiased subset', () => {
    for (const id of galaxies.slice(1).map((galaxy) => galaxy.id)) {
      const target = galaxy(id) as Parameters<typeof generateLocalGalaxyPuffs>[0]
      const coarse = generateLocalGalaxyPuffs(target, 'emission', 64)
      const fine = generateLocalGalaxyPuffs(target, 'emission', 256)
      expect(fine.centers.subarray(0, 64 * 3), id).toEqual(coarse.centers)
      expect(fine.shapes.every(Number.isFinite), id).toBe(true)
      // Puffs stay within a few model radii of the center.
      const radius = galaxy(id).galaxy!.model_radius_pc
      for (let index = 0; index < fine.count; index++) {
        expect(Math.hypot(...fine.centers.subarray(index * 3, index * 3 + 3)), id).toBeLessThan(3 * radius)
      }
    }
  })

  it('draws each dwarf as its published half-light ellipse, without dust', () => {
    const fornax = galaxy('fornax-dwarf-galaxy') as Parameters<typeof generateLocalGalaxyPuffs>[0]
    const { half_light_radius_pc: scale, ellipticity, position_angle_deg: angle } = fornax.galaxy.spheroid!
    expect(generateLocalGalaxyPuffs(fornax, 'dust').count).toBe(0)
    const puffs = generateLocalGalaxyPuffs(fornax, 'emission')
    // Undo the sky frame: world offsets back to east and north, then onto the long and short axes.
    const alpha = fornax.galaxy.ra_deg * Math.PI / 180
    const delta = fornax.galaxy.dec_deg * Math.PI / 180
    const toWorld = (equatorial: number[]) => {
      const [x, y, z] = [0, 1, 2].map((row) => [0, 1, 2].reduce((sum, column) => sum + ICRS_TO_GALACTIC_ROWS[row]![column]! * equatorial[column]!, 0))
      return galacticToWorld({ x_pc: x!, y_pc: y!, z_pc: z! })
    }
    const east = toWorld([-Math.sin(alpha), Math.cos(alpha), 0])
    const north = toWorld([-Math.sin(delta) * Math.cos(alpha), -Math.sin(delta) * Math.sin(alpha), Math.cos(delta)])
    const [along, across] = [[] as number[], [] as number[]]
    for (let index = 0; index < puffs.count; index++) {
      const point = new Vector3(...puffs.centers.subarray(index * 3, index * 3 + 3))
      const [e, n] = [point.dot(east), point.dot(north)]
      along.push(Math.abs(e * Math.sin(angle * Math.PI / 180) + n * Math.cos(angle * Math.PI / 180)))
      across.push(Math.abs(e * Math.cos(angle * Math.PI / 180) - n * Math.sin(angle * Math.PI / 180)))
    }
    const median = (values: number[]) => values.sort((first, second) => first - second)[values.length >> 1]!
    // A Plummer profile cut at three scale radii has a median offset along one axis of 0.49 scale radii.
    expect(median(along) / scale).toBeCloseTo(0.49, 1)
    expect(median(across) / median(along)).toBeCloseTo(1 - ellipticity, 1)
  })

  it('shows galaxies with the Galaxies filter at any distance limit', () => {
    const andromeda = galaxy('andromeda-galaxy')
    expect(isObjectMapVisible(andromeda, new Set(['star']), null, 'sun', 2.5e6, 100, true)).toBe(true)
    expect(isObjectMapVisible(andromeda, new Set(['star']), null, 'sun', 2.5e6, 100, false)).toBe(false)
    expect(isObjectMapVisible(andromeda, new Set(['star']), andromeda.id, 'sun', 2.5e6, 100, false)).toBe(true)
  })

  it('reaches across the Local Group only with galaxies shown and no distance limit', () => {
    expect(maxOrbitDistancePc(Infinity, true) * LIGHT_YEARS_PER_PARSEC).toBeCloseTo(4_000_000)
    expect(maxOrbitDistancePc(1000, true)).toBe(maxOrbitDistancePc(1000))
    expect(maxOrbitDistancePc(Infinity)).toBe(maxOrbitDistancePc(1000))
  })
})
