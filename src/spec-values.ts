import { formatDistance, galacticToWorld, galacticVelocityToWorld, sunRelativeMetrics, type DistanceUnit } from './astronomy'
import { describeObject, type Star } from './catalog-model'
import { catalogMeasurement, catalogSourceFor } from './catalog-source'
import { measurement, MISSING_VALUE, quantity } from './format'
import { planetCountForStar } from './planetary-systems'
import { spaceMotionForStar } from './space-motion'

export interface SpecValue {
  text: string
  title?: string
  unresolved?: boolean
  label?: string
}

/** A system record's radial velocity, used when the component has no measurement of its own. */
export function radialVelocitySource(star: Star) {
  return star.raw_astrometry?.radial_velocity_kms == null
    ? star.catalog_sources?.find((entry) => entry.record.raw_astrometry?.radial_velocity_kms != null) : undefined
}

/** The radial velocity along the line of sight from the Sun: the bulk motion that moves the object on the map, otherwise a scoped measurement. */
export function radialVelocityKms(star: Star): number | null {
  const velocity = galacticVelocityToWorld(star)
  return velocity ? galacticToWorld(star).normalize().dot(velocity)
    : star.radial_velocity_observation?.value_kms ?? radialVelocitySource(star)?.record.raw_astrometry?.radial_velocity_kms ?? null
}

const degrees = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg`
const modelRange = (min: number, max: number, unit: string) => `${quantity(min, '', 1)}–${quantity(max, '', 1)} ${unit}`

/**
 * Formats the Specs values once, keyed by the element id of each value, so the
 * selected and comparison columns share units, precision and source scopes.
 */
export function specValues(star: Star, sun: Star, unit: DistanceUnit): Record<string, SpecValue> {
  const values: Record<string, SpecValue> = {}
  const set = (id: string, text: string, title?: string, label?: string) => { values[id] = { text, title, label } }
  const source = <T extends Parameters<typeof catalogSourceFor>[1]>(id: string, field: T, format: (value: Exclude<Star[T], undefined> | null) => string, label?: string) => {
    const retained = catalogSourceFor(star, field)
    values[id] = { text: format(catalogMeasurement(star, field)), title: retained?.scope, unresolved: Boolean(retained), label }
    return retained
  }
  const metrics = sunRelativeMetrics(star, sun)
  const observations = star.stellar_observations
  const compact = star.compact
  const raw = star.raw_astrometry

  set('distance-toggle', formatDistance(metrics.distancePc, unit))
  set('object-type', describeObject(star))
  set('known-planets', String(planetCountForStar(star.id) ?? star.known_planets ?? 0))
  set('object-subtypes-empty', star.subtypes?.length ? String(star.subtypes.length) : MISSING_VALUE, star.subtypes?.join(', '))
  set('constellation', star.id === 'sun' ? MISSING_VALUE : star.constellation ?? MISSING_VALUE, star.constellation ?? undefined)
  source('spectral-type', 'spectral_type', (value) => value ?? MISSING_VALUE)

  const temperatureRange = star.temperature_k === null ? observations?.temperature_range : undefined
  const atmosphere = star.temperature_k === null ? observations?.atmosphere_temperature : undefined
  if (temperatureRange) set('temperature', `${quantity(temperatureRange.min_k, '', 0)}–${quantity(temperatureRange.max_k, 'K', 0)}`, temperatureRange.summary, 'Temperature (model)')
  else if (atmosphere) set('temperature', `${atmosphere.value_k.toLocaleString('en-US')} ± ${quantity(atmosphere.error_k, 'K', 0)}`, atmosphere.scope, 'Temperature T*')
  else source('temperature', 'temperature_k', (value) => quantity(value, 'K', 0), 'Temperature')

  source('luminosity', 'luminosity_solar', (value) => quantity(value, 'L☉', 1))
  const massRange = star.mass_solar === null ? observations?.mass_range : undefined
  if (massRange) set('mass', modelRange(massRange.min_jupiter, massRange.max_jupiter, 'M♃'), `${massRange.reference}. ${massRange.scope}`, 'Mass (model)')
  else source('mass', 'mass_solar', (value) => compact ? measurement(value, compact.mass_error_solar, 'M☉', 1) : quantity(value, 'M☉', 1), 'Mass')
  const radiusRange = star.radius_solar === null ? observations?.radius_range : undefined
  if (radiusRange) set('radius', modelRange(radiusRange.min_jupiter, radiusRange.max_jupiter, 'R♃'), radiusRange.summary, 'Radius (model)')
  else source('radius', 'radius_solar', (value) => quantity(value, 'R☉', 1), 'Radius')
  const metallicitySource = source('metallicity', 'metallicity_dex', (value) => quantity(value, 'dex'))
  values.metallicity!.label = `Metallicity ${(metallicitySource ? metallicitySource.record.metallicity_kind : star.metallicity_kind) ?? ''}`.trim()
  source('age', 'age_gyr', (value) => quantity(value, 'Gyr'))

  source('absolute-mag', 'absolute_mag', (value) => quantity(value, '', 2))
  const resolved = star.resolved_photometry
  const unresolved = star.apparent_mag == null ? star.unresolved_photometry : undefined
  if (resolved) set('apparent-mag', measurement(resolved.magnitude_v, resolved.error_mag, '', 2).trim(), `${resolved.reference}; ${resolved.observed_on}. ${resolved.scope}`)
  else if (unresolved) values['apparent-mag'] = {
    text: measurement(unresolved.magnitude_v, unresolved.error_mag, '', 2).trim(),
    title: `${unresolved.scope}. ${unresolved.source}. Earth-view snapshot; component fluxes are not separated.`,
    unresolved: true,
  }
  else if (star.apparent_mag != null) set('apparent-mag', quantity(star.apparent_mag, '', 2), 'Earth-view catalog V magnitude; a snapshot, not current variable-star photometry.')
  else source('apparent-mag', 'apparent_mag', (value) => quantity(value, '', 2))
  const infrared = observations?.infrared_photometry
  set('infrared-magnitude', infrared ? measurement(infrared.magnitude, infrared.error_mag, '', 2).trim() : MISSING_VALUE,
    infrared ? `${infrared.instrument} ${infrared.band}, ${infrared.wavelength_microns} μm, ${infrared.system} system; ${infrared.observed_on.join(', ')}. ${infrared.reference}. ${infrared.scope}` : undefined,
    infrared ? `Apparent mag. (${infrared.band})` : '')

  for (const axis of ['x', 'y', 'z'] as const) {
    set(`coordinate-${axis}`, formatDistance(star[`${axis}_pc`], unit, 3))
    source(`velocity-${axis}`, `v${axis}_kms`, (value) => quantity(value, 'km/s'))
  }
  set('plane-distance', formatDistance(metrics.planeDistancePc, unit, 3))
  set('epoch', `J${star.epoch.toFixed(1)}`)

  const motion = spaceMotionForStar(star)
  const rvSource = radialVelocitySource(star)
  const rvReview = raw?.radial_velocity_kms == null && !rvSource ? observations?.radial_velocity_review : undefined
  const observedRv = star.radial_velocity_observation
  const motionTitle = observedRv && !motion.fullVelocity && raw
    ? 'The measured component radial velocity includes orbital motion and belongs to a different epoch from the catalog proper motion; a constant bulk space-motion vector is not inferred.'
    : rvReview?.reason ?? motion.title
  set('motion-data', motion.label ?? MISSING_VALUE, motionTitle)

  const sky = raw ?? compact ?? star.nebula ?? null
  set('right-ascension', sky ? degrees(sky.ra_deg) : MISSING_VALUE)
  set('declination', sky ? degrees(sky.dec_deg) : MISSING_VALUE)
  set('astrometry-epoch', raw ? `J${raw.epoch.toFixed(1)}` : MISSING_VALUE)
  set('parallax', raw ? measurement(raw.parallax_mas, raw.parallax_error_mas, 'mas', 6) : MISSING_VALUE)
  set('proper-motion-ra', raw ? measurement(raw.pm_ra_cosdec_masyr, raw.pm_ra_error_masyr, 'mas/yr', 6) : MISSING_VALUE)
  set('proper-motion-dec', raw ? measurement(raw.pm_dec_masyr, raw.pm_dec_error_masyr, 'mas/yr', 6) : MISSING_VALUE)
  if (observedRv) {
    set('radial-velocity', measurement(observedRv.value_kms, observedRv.error_kms, 'km/s', 6),
      `${observedRv.reference}; ${observedRv.observed_from} to ${observedRv.observed_to}. ${observedRv.uncertainty_kind} ${observedRv.scope}`)
  } else {
    const rv = rvSource?.record.raw_astrometry ?? raw
    set('radial-velocity', rv ? measurement(rv.radial_velocity_kms, rv.radial_velocity_error_kms, 'km/s', 6) : MISSING_VALUE,
      rvReview ? `${rvReview.reference}. ${rvReview.reason}` : rvSource?.scope ?? raw?.radial_velocity_ref ?? undefined)
  }
  set('astrometry-source', raw?.astrometry_ref || compact?.position_source || star.nebula?.position_source
    || star.molecular_cloud?.position_source || star.bubble?.position_source || MISSING_VALUE)
  return values
}
