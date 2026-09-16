import Papa from 'papaparse'

export const BASE_CATALOG_HEADERS = [
  'type', 'id', 'name', 'spectral_type', 'x_pc', 'y_pc', 'z_pc',
  'vx_kms', 'vy_kms', 'vz_kms', 'temperature_k', 'mass_solar',
  'luminosity_solar', 'absolute_mag', 'epoch', 'notes', 'constellation',
] as const

export const RAW_ASTROMETRY_HEADERS = [
  'ra_deg', 'dec_deg', 'astrometry_epoch', 'parallax_mas', 'parallax_error_mas',
  'pm_ra_cosdec_masyr', 'pm_ra_error_masyr', 'pm_dec_masyr', 'pm_dec_error_masyr',
  'radial_velocity_kms', 'radial_velocity_error_kms', 'astrometry_ref', 'radial_velocity_ref',
] as const

export const CATALOG_HEADERS = [...BASE_CATALOG_HEADERS, ...RAW_ASTROMETRY_HEADERS] as const

export const CONSTELLATIONS = [
  'Andromeda', 'Antlia', 'Apus', 'Aquarius', 'Aquila', 'Ara', 'Aries', 'Auriga',
  'Bootes', 'Caelum', 'Camelopardalis', 'Cancer', 'Canes Venatici', 'Canis Major',
  'Canis Minor', 'Capricornus', 'Carina', 'Cassiopeia', 'Centaurus', 'Cepheus',
  'Cetus', 'Chamaeleon', 'Circinus', 'Columba', 'Coma Berenices', 'Corona Australis',
  'Corona Borealis', 'Corvus', 'Crater', 'Crux', 'Cygnus', 'Delphinus', 'Dorado',
  'Draco', 'Equuleus', 'Eridanus', 'Fornax', 'Gemini', 'Grus', 'Hercules',
  'Horologium', 'Hydra', 'Hydrus', 'Indus', 'Lacerta', 'Leo', 'Leo Minor', 'Lepus',
  'Libra', 'Lupus', 'Lynx', 'Lyra', 'Mensa', 'Microscopium', 'Monoceros', 'Musca',
  'Norma', 'Octans', 'Ophiuchus', 'Orion', 'Pavo', 'Pegasus', 'Perseus', 'Phoenix',
  'Pictor', 'Pisces', 'Piscis Austrinus', 'Puppis', 'Pyxis', 'Reticulum', 'Sagitta',
  'Sagittarius', 'Scorpius', 'Sculptor', 'Scutum', 'Serpens', 'Sextans', 'Taurus',
  'Telescopium', 'Triangulum', 'Triangulum Australe', 'Tucana', 'Ursa Major',
  'Ursa Minor', 'Vela', 'Virgo', 'Volans', 'Vulpecula',
] as const

export const OBJECT_TYPES = ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'] as const
export type ObjectType = typeof OBJECT_TYPES[number]

export interface RawAstrometry {
  ra_deg: number
  dec_deg: number
  epoch: number
  parallax_mas: number
  parallax_error_mas: number | null
  pm_ra_cosdec_masyr: number
  pm_ra_error_masyr: number | null
  pm_dec_masyr: number
  pm_dec_error_masyr: number | null
  radial_velocity_kms: number | null
  radial_velocity_error_kms: number | null
  astrometry_ref: string
  radial_velocity_ref: string | null
}

export interface Star {
  type: ObjectType
  id: string
  name: string
  spectral_type: string | null
  constellation: string | null
  x_pc: number
  y_pc: number
  z_pc: number
  vx_kms: number | null
  vy_kms: number | null
  vz_kms: number | null
  temperature_k: number | null
  mass_solar: number | null
  luminosity_solar: number | null
  absolute_mag: number | null
  epoch: number
  notes: string
  raw_astrometry: RawAstrometry | null
}

type CatalogField = typeof CATALOG_HEADERS[number]
type CsvRecord = Partial<Record<CatalogField, string>>

export function objectTypeLabel(type: ObjectType): string {
  return {
    star: 'Star',
    white_dwarf: 'White dwarf',
    brown_dwarf: 'Brown dwarf',
    sub_brown_dwarf: 'Sub-brown dwarf',
  }[type]
}

function isObjectType(value: string | undefined): value is ObjectType {
  return OBJECT_TYPES.some((candidate) => candidate === value)
}

export function describeObject(star: Pick<Star, 'type' | 'spectral_type'>): string {
  const spectral = star.spectral_type?.match(/^([OBAFGKM])\d(?:\.\d)?\s*V(?:e|n|ne)?$/)
  if (star.type !== 'star' || !spectral) return objectTypeLabel(star.type)
  const labels: Record<string, string> = {
    O: 'Blue star', B: 'Blue-white star', A: 'White star', F: 'Yellow-white star',
    G: 'Sun-like star', K: 'Orange dwarf', M: 'Red dwarf',
  }
  return labels[spectral[1]!]!
}

function invalid(record: number, field: string, reason: string): never {
  throw new Error(`CSV record ${record}, ${field}: ${reason}`)
}

function numeric(value: string | undefined, field: string, record: number): number
function numeric(value: string | undefined, field: string, record: number, optional: true): number | null
function numeric(value: string | undefined, field: string, record: number, optional = false): number | null {
  const text = value?.trim() ?? ''
  if (optional && text === '') return null
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    invalid(record, field, 'expected a decimal number.')
  }
  const number = Number(text)
  if (!Number.isFinite(number)) invalid(record, field, 'expected a finite number.')
  return number
}

export function parseStarCatalog(csv: string): Star[] {
  const result = Papa.parse<CsvRecord>(csv, {
    delimiter: ',',
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  })

  const headers = result.meta.fields ?? []
  const expected = new Set<string>(CATALOG_HEADERS)
  const hasRawAstrometry = RAW_ASTROMETRY_HEADERS.some((header) => headers.includes(header))
  if (
    BASE_CATALOG_HEADERS.some((header) => header !== 'constellation' && !headers.includes(header)) ||
    (hasRawAstrometry && RAW_ASTROMETRY_HEADERS.some((header) => !headers.includes(header))) ||
    new Set(headers).size !== headers.length ||
    headers.some((header) => !expected.has(header))
  ) {
    throw new Error(`CSV headers must contain each required field exactly once: ${BASE_CATALOG_HEADERS.filter((header) => header !== 'constellation').join(', ')}. Optional groups: constellation; ${RAW_ASTROMETRY_HEADERS.join(', ')}.`)
  }
  const firstError = result.errors[0]
  if (firstError) {
    throw new Error(`CSV record ${(firstError.row ?? 0) + 1}: ${firstError.message}`)
  }
  if (result.data.length === 0) throw new Error('The object catalog is empty.')

  const ids = new Set<string>()
  const stars = result.data.map((row, index): Star => {
    const record = index + 1
    const type = row.type?.trim()
    if (!isObjectType(type)) {
      invalid(record, 'type', `expected one of: ${OBJECT_TYPES.join(', ')}.`)
    }
    const id = row.id?.trim() ?? ''
    const name = row.name?.trim() ?? ''
    if (!id) invalid(record, 'id', 'a unique ID is required.')
    if (ids.has(id)) invalid(record, 'id', `duplicate ID "${id}".`)
    if (!name) invalid(record, 'name', 'a name is required.')
    ids.add(id)

    let rawAstrometry: RawAstrometry | null = null
    if (hasRawAstrometry) {
      const rawValues = ['ra_deg', 'dec_deg', 'astrometry_epoch', 'parallax_mas', 'pm_ra_cosdec_masyr', 'pm_dec_masyr'] as const
      const hasAnyValue = RAW_ASTROMETRY_HEADERS.some((field) => row[field]?.trim())
      if (hasAnyValue) {
        for (const field of rawValues) {
          if (!row[field]?.trim()) invalid(record, field, 'is required when raw astrometry is present.')
        }
        const astrometryRef = row.astrometry_ref?.trim() ?? ''
        if (!astrometryRef) invalid(record, 'astrometry_ref', 'is required when raw astrometry is present.')
        const radialVelocity = numeric(row.radial_velocity_kms, 'radial_velocity_kms', record, true)
        const radialVelocityError = numeric(row.radial_velocity_error_kms, 'radial_velocity_error_kms', record, true)
        const radialVelocityRef = row.radial_velocity_ref?.trim() || null
        if (radialVelocity === null && (radialVelocityError !== null || radialVelocityRef !== null)) {
          invalid(record, 'radial_velocity_kms', 'is required when radial-velocity uncertainty or reference is present.')
        }
        if (radialVelocity !== null && radialVelocityRef === null) {
          invalid(record, 'radial_velocity_ref', 'is required when radial velocity is present.')
        }
        rawAstrometry = {
          ra_deg: numeric(row.ra_deg, 'ra_deg', record),
          dec_deg: numeric(row.dec_deg, 'dec_deg', record),
          epoch: numeric(row.astrometry_epoch, 'astrometry_epoch', record),
          parallax_mas: numeric(row.parallax_mas, 'parallax_mas', record),
          parallax_error_mas: numeric(row.parallax_error_mas, 'parallax_error_mas', record, true),
          pm_ra_cosdec_masyr: numeric(row.pm_ra_cosdec_masyr, 'pm_ra_cosdec_masyr', record),
          pm_ra_error_masyr: numeric(row.pm_ra_error_masyr, 'pm_ra_error_masyr', record, true),
          pm_dec_masyr: numeric(row.pm_dec_masyr, 'pm_dec_masyr', record),
          pm_dec_error_masyr: numeric(row.pm_dec_error_masyr, 'pm_dec_error_masyr', record, true),
          radial_velocity_kms: radialVelocity,
          radial_velocity_error_kms: radialVelocityError,
          astrometry_ref: astrometryRef,
          radial_velocity_ref: radialVelocityRef,
        }
        if (rawAstrometry.ra_deg < 0 || rawAstrometry.ra_deg >= 360) invalid(record, 'ra_deg', 'must be in the range [0, 360).')
        if (rawAstrometry.dec_deg < -90 || rawAstrometry.dec_deg > 90) invalid(record, 'dec_deg', 'must be in the range [-90, 90].')
        if (rawAstrometry.parallax_mas <= 0) invalid(record, 'parallax_mas', 'must be positive.')
        for (const field of ['parallax_error_mas', 'pm_ra_error_masyr', 'pm_dec_error_masyr', 'radial_velocity_error_kms'] as const) {
          if (rawAstrometry[field] !== null && rawAstrometry[field] < 0) invalid(record, field, 'must be non-negative.')
        }
      }
    }

    const star: Star = {
      type, id, name,
      spectral_type: row.spectral_type?.trim() || null,
      constellation: row.constellation?.trim() || null,
      x_pc: numeric(row.x_pc, 'x_pc', record),
      y_pc: numeric(row.y_pc, 'y_pc', record),
      z_pc: numeric(row.z_pc, 'z_pc', record),
      vx_kms: numeric(row.vx_kms, 'vx_kms', record, true),
      vy_kms: numeric(row.vy_kms, 'vy_kms', record, true),
      vz_kms: numeric(row.vz_kms, 'vz_kms', record, true),
      temperature_k: numeric(row.temperature_k, 'temperature_k', record, true),
      mass_solar: numeric(row.mass_solar, 'mass_solar', record, true),
      luminosity_solar: numeric(row.luminosity_solar, 'luminosity_solar', record, true),
      absolute_mag: numeric(row.absolute_mag, 'absolute_mag', record, true),
      epoch: numeric(row.epoch, 'epoch', record),
      notes: row.notes?.trim() ?? '',
      raw_astrometry: rawAstrometry,
    }
    if (star.constellation !== null && !CONSTELLATIONS.some((name) => name === star.constellation)) {
      invalid(record, 'constellation', 'expected a full IAU constellation name or blank.')
    }
    if (id === 'sun' && star.constellation !== null) invalid(record, 'constellation', 'the Sun has no fixed constellation.')
    for (const field of ['temperature_k', 'mass_solar', 'luminosity_solar'] as const) {
      if (star[field] !== null && star[field] <= 0) invalid(record, field, 'must be positive.')
    }
    return star
  })

  const sun = stars.find((star) => star.id === 'sun')
  if (!sun) throw new Error('The catalog must contain the reference star with id "sun".')
  if (sun.x_pc !== 0 || sun.y_pc !== 0 || sun.z_pc !== 0) {
    throw new Error('The Sun must be at the origin (0, 0, 0).')
  }
  if ([sun.vx_kms, sun.vy_kms, sun.vz_kms].some((velocity) => velocity !== null && velocity !== 0)) {
    throw new Error('The Sun must have zero velocity in this Sun-relative frame, or blank values.')
  }
  if (sun.raw_astrometry !== null) throw new Error('The Sun must not have object raw astrometry in this origin-centered catalog.')
  if (stars.some((star) => star.epoch !== sun.epoch)) {
    throw new Error('All stars must share the same epoch; position propagation is not supported.')
  }
  return stars
}