export const STELLAR_OBJECT_TYPES = ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'] as const
export const COMPACT_OBJECT_TYPES = ['pulsar', 'neutron_star', 'black_hole'] as const
export const NEBULA_OBJECT_TYPES = ['reflection_nebula', 'hii_region', 'planetary_nebula'] as const
export const MOLECULAR_CLOUD_OBJECT_TYPES = ['molecular_cloud'] as const
export const BUBBLE_OBJECT_TYPES = ['bubble'] as const
export const OBJECT_TYPES = [...STELLAR_OBJECT_TYPES, ...COMPACT_OBJECT_TYPES, ...NEBULA_OBJECT_TYPES, ...MOLECULAR_CLOUD_OBJECT_TYPES, ...BUBBLE_OBJECT_TYPES] as const
export type ObjectType = typeof OBJECT_TYPES[number]
export type StellarObjectType = typeof STELLAR_OBJECT_TYPES[number]
export type CompactObjectType = typeof COMPACT_OBJECT_TYPES[number]
export type NebulaObjectType = typeof NEBULA_OBJECT_TYPES[number]
export type MolecularCloudObjectType = typeof MOLECULAR_CLOUD_OBJECT_TYPES[number]
export type BubbleObjectType = typeof BUBBLE_OBJECT_TYPES[number]

// IAU ICRS-to-Galactic rotation (Hipparcos convention), row-major.
export const ICRS_TO_GALACTIC_ROWS = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
] as const

export function equatorialToGalacticPc(raDeg: number, decDeg: number, distancePc: number): { x_pc: number; y_pc: number; z_pc: number } {
  const alpha = raDeg * Math.PI / 180
  const delta = decDeg * Math.PI / 180
  const equatorial = [Math.cos(delta) * Math.cos(alpha), Math.cos(delta) * Math.sin(alpha), Math.sin(delta)]
  const [x, y, z] = ICRS_TO_GALACTIC_ROWS.map((row) => distancePc * (row[0] * equatorial[0]! + row[1] * equatorial[1]! + row[2] * equatorial[2]!))
  return { x_pc: x!, y_pc: y!, z_pc: z! }
}

export const NEBULA_SHAPE_KINDS = ['ellipsoid', 'blister', 'layers', 'shell'] as const
export type NebulaShapeKind = typeof NEBULA_SHAPE_KINDS[number]

export interface NebulaShape {
  kind: NebulaShapeKind
  // Line-of-sight depth from the Sun, then sky-plane major and minor semi-axes.
  semi_axes_pc: [number, number, number]
  // Major axis angle from Galactic north toward increasing Galactic longitude.
  position_angle_deg: number
  // Line-of-sight sheet centers relative to the nebula center (layers only).
  layer_offsets_pc: number[]
}

export interface NebulaDetails {
  designations: string[]
  ra_deg: number
  dec_deg: number
  distance_pc: number
  distance_error_pc: number | null
  distance_source: string
  position_source: string
  angular_size_arcmin: [number, number]
  illuminating_stars: string
  shape: NebulaShape
  // Hex sRGB colors ordered from the illuminated core outward.
  palette: { real: string[]; exaggerated: string[] }
  brightness: number
  puff_count: number
  seed: number
  source_label: string
  source_url: string
  model_note: string
}

export interface MolecularCloudDetails {
  catalog_id: number
  complex_name: string | null
  distance_pc: number
  galactic_longitude_deg: number
  galactic_latitude_deg: number
  equivalent_radius_pc: number
  mean_density_cm3: number
  peak_density_cm3: number
  surface_area_pc2: number
  volume_pc3: number
  source_voxel_count: number
  // Flattened Galactic Cartesian display samples: x, y, z, x, y, z, ...
  sample_points_pc: number[]
  bounds_pc: { x: [number, number]; y: [number, number]; z: [number, number] }
  palette: {
    real: { body: string; rim: string }
    exaggerated: { body: string; rim: string }
  }
  opacity: number
  position_source: string
  source_label: string
  source_url: string
  model_note: string
}

export interface BubbleShapeFeature {
  // Galactic longitude and latitude of a broad radial extension or indentation.
  longitude_deg: number
  latitude_deg: number
  amplitude_pc: number
  width_deg: number
}

export interface BubbleAnalyticShape {
  kind: 'analytic'
  // The surface is sampled radially from this Galactic Cartesian position.
  origin_pc: [number, number, number]
  base_radius_pc: number
  axis_scale: [number, number, number]
  features: BubbleShapeFeature[]
  roughness_pc: number
  seed: number
}

export interface BubbleSurfaceGrid {
  schema_version: 1
  source_url: string
  source_commit: string
  sampling: string
  longitude_segments: number
  latitude_segments: number
  source_point_count: number
  source_bounds_pc: [number, number, number, number, number, number]
  // South-to-north latitude rows, each containing a wrapped 0-360 degree longitude row.
  radii_pc: number[]
}

export interface BubbleDirectionalGridShape {
  kind: 'directional_grid'
  // The radial surface origin in Galactic Cartesian coordinates.
  origin_pc: [number, number, number]
  surface_grid: BubbleSurfaceGrid
}

export type BubbleShape = BubbleAnalyticShape | BubbleDirectionalGridShape

export interface BubbleDetails {
  designations: string[]
  average_radius_pc: number
  surface_distance_range_pc: [number, number]
  surface_distance_max_open: boolean
  shell_thickness_pc: number
  reported_bounds_pc: {
    x: [number, number]
    y: [number, number]
    z: [number, number]
  }
  shape: BubbleShape
  palette: { real: string; exaggerated: string }
  opacity: number
  position_source: string
  source_label: string
  source_url: string
  model_note: string
}

export interface CompactObjectDetails {
  confidence: 'confirmed' | 'candidate'
  distance_method: string
  distance_source: string
  position_source: string
  mass_error_solar: number | null
  rotation_period_s: number | null
  rotation_period_error_s: number | null
  radio_luminosity_1400_mjy_kpc2: number | null
  characteristic_age_yr: number | null
  surface_magnetic_field_gauss: number | null
  spin_down_power_erg_s: number | null
  orbital_period_days: number | null
  orbital_period_error_days: number | null
  companion: string | null
  detection_method: string
  source_label: string
  source_url: string
  ra_deg: number
  dec_deg: number
  period_derivative: number | null
  period_derivative_error: number | null
  dispersion_measure_pc_cm3: number | null
  transverse_velocity_kms: number | null
  /** Readable ATNF type classes, plus Millisecond pulsar below 30 ms. */
  pulsar_classes: string[]
  /** Readable ATNF associations, such as a supernova remnant or gamma-ray source. */
  associations: string[]
  glitch_count: number | null
  eccentricity: number | null
  projected_semi_major_axis_lt_s: number | null
  /** Companion masses for a 1.35 M☉ pulsar at 90° and 60° inclination. */
  companion_min_mass_solar: number | null
  companion_median_mass_solar: number | null
}

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

/** Observations whose passband or conditional scope prevents scalar adoption. */
export interface StellarObservations {
  atmosphere_temperature?: {
    value_k: number
    error_k: number
    quantity: 'T*'
    status: 'model-derived'
    reference: string
    source_url: string
    scope: string
  }
  mass_range?: {
    min_jupiter: number
    max_jupiter: number
    assumed_age_min_gyr: number
    assumed_age_max_gyr: number
    status: 'model-derived'
    reference: string
    source_url: string
    scope: string
  }
  temperature_range?: {
    min_k: number
    max_k: number
    summary: string
    status: 'model-derived'
    reference: string
    source_url: string
    scope: string
  }
  radius_range?: {
    min_jupiter: number
    max_jupiter: number
    summary: string
    status: 'model-derived'
    reference: string
    source_url: string
    scope: string
  }
  infrared_photometry?: {
    band: string
    instrument: string
    wavelength_microns: number
    system: 'Vega' | 'AB'
    magnitude: number
    error_mag: number | null
    observed_on: string[]
    reference: string
    source_url: string
    scope: string
  }
  radial_velocity_review?: {
    status: 'withheld'
    reference: string
    source_url: string
    reason: string
  }
  // Published rotation model; the radius ratio shapes the radius card only.
  rotation?: {
    period_days: number
    equatorial_velocity_kms: number
    polar_to_equatorial_radius?: number
    reference: string
    source_url: string
    scope: string
  }
  // GCVS 5.1 range and period; never a catalog V input.
  variability?: {
    gcvs_name: string
    type: string
    system: string
    max_mag: number
    min_mag?: number
    amplitude_mag?: number
    min_system?: string
    period_days?: number
    max_uncertain?: true
    min_uncertain?: true
    period_uncertain?: true
  }
}

export interface Star {
  // Transport metadata for deferred source notes; never scientific measurements.
  catalog_detail_key?: string
  catalog_note_supplements?: { key?: string; notes?: string; fields: string[] }[]
  catalog_flags?: { withheld?: string[]; barycenter?: boolean; source_rv?: boolean }
  type: ObjectType
  id: string
  name: string
  designations?: string[]
  subtypes?: string[]
  // Confirmed planets in the adopted archive snapshot; null means no coverage.
  known_planets?: number | null
  // Earth-view Johnson V snapshot, independent of the map's observer.
  apparent_mag?: number | null
  stellar_observations?: StellarObservations
  // Resolved V snapshot metadata; uncertainties and epoch belong to this measurement.
  resolved_photometry?: {
    magnitude_v: number
    error_mag: number | null
    observed_on: string
    reference: string
    source_url: string
    scope: string
  }
  // Observed component RV is independent of the astrometry/motion bundle.
  // Orbital motion and a different observing epoch can prevent a bulk vector.
  radial_velocity_observation?: {
    value_kms: number
    error_kms: number | null
    uncertainty_kind: string
    observed_from: string
    observed_to: string
    reference: string
    source_url: string
    scope: string
  }
  // Observed parent-source flux, kept separate from individual component V.
  // Never use for stellar luminosity, absolute magnitude or observer rendering.
  unresolved_photometry?: {
    magnitude_v: number
    error_mag: number | null
    scope: string
    source: string
    source_url: string | null
  }
  // Original catalog records survive component replacement with their scope.
  // Source quantities never become individual physical/rendering inputs.
  catalog_sources?: CatalogSource[]
  // Retained but scientifically rejected fields must not reappear as UI fallbacks.
  withheld_source_fields?: string[]
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
  radius_solar: number | null
  // The abundance ratio is mandatory whenever a metallicity value is supplied.
  metallicity_kind?: '[M/H]' | '[Fe/H]' | null
  metallicity_dex: number | null
  age_gyr: number | null
  absolute_mag: number | null
  epoch: number
  notes: string
  raw_astrometry: RawAstrometry | null
  compact?: CompactObjectDetails
  nebula?: NebulaDetails
  molecular_cloud?: MolecularCloudDetails
  bubble?: BubbleDetails
}

export interface CatalogSource {
  catalog_id: string
  scope: string
  record: Omit<Star, 'catalog_sources' | 'unresolved_photometry'>
}

export function isCompactObject(star: Pick<Star, 'type'>): boolean {
  return COMPACT_OBJECT_TYPES.some((type) => type === star.type)
}

export function isNebulaObject(star: Pick<Star, 'type'>): boolean {
  return NEBULA_OBJECT_TYPES.some((type) => type === star.type)
}

export function isMolecularCloudObject(star: Pick<Star, 'type'>): boolean {
  return MOLECULAR_CLOUD_OBJECT_TYPES.some((type) => type === star.type)
}

export function isBubbleObject(star: Pick<Star, 'type'>): boolean {
  return BUBBLE_OBJECT_TYPES.some((type) => type === star.type)
}

export function objectTypeLabel(type: ObjectType): string {
  return {
    star: 'Star',
    white_dwarf: 'White dwarf',
    brown_dwarf: 'Brown dwarf',
    sub_brown_dwarf: 'Sub-brown dwarf',
    pulsar: 'Pulsar',
    neutron_star: 'Neutron star',
    black_hole: 'Black hole',
    reflection_nebula: 'Reflection nebula',
    hii_region: 'H II region',
    planetary_nebula: 'Planetary nebula',
    molecular_cloud: 'Molecular cloud',
    bubble: 'Bubble',
  }[type]
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
