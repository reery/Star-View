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
  radius_solar: number | null
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
