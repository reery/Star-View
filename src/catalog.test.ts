import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { Matrix3, Vector3 } from 'three'
import csv from './data/stars.csv?raw'
import { CONSTELLATIONS, PHYSICAL_CATALOG_HEADERS, RAW_ASTROMETRY_HEADERS, describeObject, objectTypeLabel, parseStarCatalog } from './catalog'

const rawRows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data
const siriusRow = rawRows.find((row) => row.id === 'sirius-a')!

function changeSirius(fields: Record<string, string>): string {
  const physical = Object.fromEntries(PHYSICAL_CATALOG_HEADERS.map((field) => [field, '']))
  return Papa.unparse([{ ...rawRows[0], ...physical }, { ...siriusRow, ...physical, ...fields }])
}

describe('object catalog', () => {
  it('accepts legacy columns, unknown temperatures, and optional constellation metadata', () => {
    const legacy = rawRows.map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'constellation' && !RAW_ASTROMETRY_HEADERS.includes(field as typeof RAW_ASTROMETRY_HEADERS[number]))))
    expect(parseStarCatalog(Papa.unparse(legacy))[1]).toMatchObject({ constellation: null, raw_astrometry: null })
    const extended = [{ ...rawRows[0], constellation: '' }, { ...siriusRow, temperature_k: '', constellation: ' Canis Major ' }]
    expect(parseStarCatalog(Papa.unparse(extended))[1]).toMatchObject({ temperature_k: null, constellation: 'Canis Major' })
    expect(() => parseStarCatalog(Papa.unparse([{ ...extended[0], constellation: 'Leo' }, extended[1]!]))).toThrow('no fixed constellation')
    expect(() => parseStarCatalog(Papa.unparse([extended[0]!, { ...extended[1], constellation: 'Unknown' }]))).toThrow('IAU')
    expect(CONSTELLATIONS).toHaveLength(88)
    expect(new Set(CONSTELLATIONS).size).toBe(88)
    expect(PHYSICAL_CATALOG_HEADERS).toEqual(['radius_solar', 'metallicity_dex', 'age_gyr'])
  })

  it('retains raw proper motion without inventing a radial velocity', () => {
    const astrometry = Object.fromEntries(RAW_ASTROMETRY_HEADERS.map((field) => [field, '']))
    const rows = [
      { ...rawRows[0], ...astrometry },
      {
        ...siriusRow,
        ...astrometry,
        ra_deg: '43.771985935', dec_deg: '-47.016728356', astrometry_epoch: '2016.0',
        parallax_mas: '205.4251', parallax_error_mas: '0.1857',
        pm_ra_cosdec_masyr: '1012.444720371', pm_ra_error_masyr: '0.18216792',
        pm_dec_masyr: '-554.030838673', pm_dec_error_masyr: '0.24066855',
        astrometry_ref: 'Gaia EDR3',
      },
    ]
    expect(parseStarCatalog(Papa.unparse(rows))[1]!.raw_astrometry).toEqual({
      ra_deg: 43.771985935,
      dec_deg: -47.016728356,
      epoch: 2016,
      parallax_mas: 205.4251,
      parallax_error_mas: 0.1857,
      pm_ra_cosdec_masyr: 1012.444720371,
      pm_ra_error_masyr: 0.18216792,
      pm_dec_masyr: -554.030838673,
      pm_dec_error_masyr: 0.24066855,
      radial_velocity_kms: null,
      radial_velocity_error_kms: null,
      astrometry_ref: 'Gaia EDR3',
      radial_velocity_ref: null,
    })
  })

  it.each([
    ['star', 'M5.5Ve', 'Red dwarf'], ['star', 'K1V', 'Orange dwarf'],
    ['star', 'G2V', 'Sun-like star'], ['star', 'A1V', 'White star'],
    ['star', 'M2III', 'Star'], ['star', 'M?', 'Star'], ['star', 'G2IV', 'Star'],
    ['white_dwarf', 'DA2', 'White dwarf'], ['brown_dwarf', 'T1', 'Brown dwarf'],
  ] as const)('describes %s %s conservatively', (type, spectral_type, expected) => {
    expect(describeObject({ type, spectral_type })).toBe(expected)
  })

  it('loads the bundled stars and preserves missing values', () => {
    const stars = parseStarCatalog(csv)
    expect(stars.map((star) => star.id)).toEqual([
      'sun', 'proxima-centauri', 'alpha-centauri-a', 'alpha-centauri-b', 'barnards-star',
      'luhman-16-a', 'luhman-16-b', 'wise-0855-0714', 'wolf-359', 'lalande-21185',
      'sirius-a', 'sirius-b', 'luyten-726-8-a', 'luyten-726-8-b', 'ross-154', 'ross-248',
      'epsilon-eridani', 'lacaille-9352', 'ross-128', 'ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c',
    ])
    expect(stars[0]).toMatchObject({ x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: 0, epoch: 2000 })
    expect(stars.find((star) => star.id === 'sirius-a')).toMatchObject({ temperature_k: 9845, mass_solar: 2.063, vx_kms: 14.960, vy_kms: 0.257, vz_kms: -11.344 })
    expect(stars.find((star) => star.id === 'wise-0855-0714')).toMatchObject({ vx_kms: null, vy_kms: null, vz_kms: null })
    expect(stars.filter((star) => star.type === 'star')).toHaveLength(18)
    expect(stars.filter((star) => star.type === 'white_dwarf')).toHaveLength(1)
    expect(stars.filter((star) => star.type === 'brown_dwarf')).toHaveLength(2)
    expect(stars.filter((star) => star.type === 'sub_brown_dwarf')).toHaveLength(1)
  })

  it.each([
    ['proxima-centauri', 217.42894222160578, -62.67949018907555, -3781.741, 769.465, -20.578199],
    ['barnards-star', 269.4520769586187, 4.693364966576667, -801.551, 10362.394, -110.11],
    ['wolf-359', 164.1205036259475, 7.014723134801666, -3866.338, -2699.215, 19.57],
    ['lalande-21185', 165.8341450816425, 35.96988227279361, -580.057, -4776.589, -84.64],
    ['sirius-a', 101.28715533333335, -16.71611586111111, -546.01, -1223.07, -8.47],
    ['ross-154', 282.45568240083537, -23.83623538204166, 639.368, -193.958, -10.494],
    ['ross-248', 355.47931791771504, 44.17744969753222, 112.527, -1591.65, -77.51],
    ['epsilon-eridani', 53.23268537982792, -9.458260970518056, -974.758, 20.876, 16.376],
    ['lacaille-9352', 346.4668157737879, -35.85307088473306, 6765.995, 1330.285, 8.82],
    ['ross-128', 176.93498861725834, 0.8045556493308333, 607.299, -1223.028, -30.66],
  ] as const)('recovers the sourced astrometry from %s Galactic velocity', (id, ra, dec, pmra, pmdec, radialVelocity) => {
    const star = parseStarCatalog(csv).find((star) => star.id === id)!
    const equatorial = new Vector3(star.vx_kms!, star.vy_kms!, star.vz_kms!).applyMatrix3(new Matrix3().set(
      -0.0548755604, -0.8734370902, -0.4838350155,
      0.4941094279, -0.4448296300, 0.7469822445,
      -0.8676661490, -0.1980763734, 0.4559837762,
    ).transpose())
    const alpha = ra * Math.PI / 180
    const delta = dec * Math.PI / 180
    const radial = new Vector3(Math.cos(delta) * Math.cos(alpha), Math.cos(delta) * Math.sin(alpha), Math.sin(delta))
    const east = new Vector3(-Math.sin(alpha), Math.cos(alpha), 0)
    const north = new Vector3(-Math.sin(delta) * Math.cos(alpha), -Math.sin(delta) * Math.sin(alpha), Math.cos(delta))
    const scale = 4.74047 * Math.hypot(star.x_pc, star.y_pc, star.z_pc) / 1000
    expect(Math.abs(equatorial.dot(radial) - radialVelocity)).toBeLessThan(0.001)
    expect(Math.abs(equatorial.dot(east) / scale - pmra)).toBeLessThan(0.15)
    expect(Math.abs(equatorial.dot(north) / scale - pmdec)).toBeLessThan(0.15)
    expect(star.notes).toContain('Motion:')
  })

  it('retains unknown motion and explicitly shares only the Sirius system vector', () => {
    const stars = parseStarCatalog(csv)
    const velocities = (id: string) => {
      const star = stars.find((star) => star.id === id)!
      return [star.vx_kms, star.vy_kms, star.vz_kms]
    }
    expect(velocities('sirius-b')).toEqual(velocities('sirius-a'))
    expect(stars.find((star) => star.id === 'sirius-b')!.notes).toContain('inherited Sirius system motion')
    expect(stars.filter((star) => star.vx_kms !== null && star.id !== 'sun')).toHaveLength(11)
    for (const id of ['alpha-centauri-a', 'alpha-centauri-b', 'luhman-16-a', 'luhman-16-b', 'wise-0855-0714', 'luyten-726-8-a', 'luyten-726-8-b', 'ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c']) {
      expect(velocities(id)).toEqual([null, null, null])
    }
  })

  it('handles a BOM, CRLF, whitespace, and quoted commas, newlines, and quotes', () => {
    const notes = 'A binary, with "quoted" text\nand a second line.'
    const input = '\ufeff' + changeSirius({ notes }).replaceAll('\r\n', '\n').replaceAll('\n', '\r\n') + '\r\n  \r\n'
    expect(parseStarCatalog(input)[1]!.notes).toBe(notes.replace('\n', '\r\n'))
  })

  it('accepts negative magnitude and velocity as metadata', () => {
    const input = changeSirius({ absolute_mag: '-1.5', vx_kms: '-5.2', radius_solar: '1.7', metallicity_dex: '-0.4', age_gyr: '0.24' })
    expect(parseStarCatalog(input)[1]).toMatchObject({ absolute_mag: -1.5, vx_kms: -5.2, radius_solar: 1.7, metallicity_dex: -0.4, age_gyr: 0.24 })
  })

  it.each([
    ['star', 'Star'],
    ['white_dwarf', 'White dwarf'],
    ['brown_dwarf', 'Brown dwarf'],
    ['sub_brown_dwarf', 'Sub-brown dwarf'],
  ] as const)('accepts and labels the %s object type', (type, label) => {
    expect(parseStarCatalog(changeSirius({ type }))[1]!.type).toBe(type)
    expect(objectTypeLabel(type)).toBe(label)
  })

  it.each([
    [{ x_pc: '' }, 'x_pc'],
    [{ y_pc: 'NaN' }, 'y_pc'],
    [{ z_pc: '1e999' }, 'z_pc'],
    [{ temperature_k: '0' }, 'temperature_k'],
    [{ temperature_k: '-10' }, 'temperature_k'],
    [{ mass_solar: '-1' }, 'mass_solar'],
    [{ luminosity_solar: '0' }, 'luminosity_solar'],
    [{ radius_solar: '0' }, 'radius_solar'],
    [{ age_gyr: '-1' }, 'age_gyr'],
    [{ vx_kms: 'unknown' }, 'vx_kms'],
    [{ type: 'nebula' }, 'type'],
    [{ id: 'sun' }, 'duplicate ID'],
    [{ id: '' }, 'id'],
    [{ name: '  ' }, 'name'],
    [{ epoch: '2016' }, 'same epoch'],
    [{ epoch: '' }, 'epoch'],
  ])('rejects invalid records %j', (fields, error) => {
    expect(() => parseStarCatalog(changeSirius(fields))).toThrow(error)
  })

  it('requires the Sun and a zero origin', () => {
    expect(() => parseStarCatalog(Papa.unparse([rawRows[1]!]))).toThrow('reference star')
    expect(() => parseStarCatalog(Papa.unparse([{ ...rawRows[0], x_pc: '1' }, rawRows[1]!]))).toThrow('origin')
    expect(() => parseStarCatalog(Papa.unparse([{ ...rawRows[0], vz_kms: '1' }, rawRows[1]!]))).toThrow('zero velocity')
  })

  it('rejects missing and duplicate headers, malformed rows, and empty catalogs', () => {
    expect(() => parseStarCatalog(csv.replace('spectral_type,', ''))).toThrow('headers')
    expect(() => parseStarCatalog(csv.replace('spectral_type,', 'name,'))).toThrow('headers')
    expect(() => parseStarCatalog(csv.replace('5772,', '5772,extra,'))).toThrow('CSV record')
    expect(() => parseStarCatalog(csv + 'star,"unterminated')).toThrow('CSV record')
    expect(() => parseStarCatalog(Object.keys(rawRows[0]!).join(','))).toThrow('empty')
  })
})
