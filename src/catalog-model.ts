export const STELLAR_OBJECT_TYPES = ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'] as const
export const COMPACT_OBJECT_TYPES = ['pulsar', 'neutron_star', 'black_hole'] as const
export const NEBULA_OBJECT_TYPES = ['reflection_nebula', 'hii_region', 'planetary_nebula', 'supernova_remnant'] as const
export const MOLECULAR_CLOUD_OBJECT_TYPES = ['molecular_cloud', 'dark_nebula'] as const
export const BUBBLE_OBJECT_TYPES = ['bubble'] as const
export const GALAXY_OBJECT_TYPES = ['galaxy'] as const
export const OBJECT_TYPES = [...STELLAR_OBJECT_TYPES, ...COMPACT_OBJECT_TYPES, ...NEBULA_OBJECT_TYPES, ...MOLECULAR_CLOUD_OBJECT_TYPES, ...BUBBLE_OBJECT_TYPES, ...GALAXY_OBJECT_TYPES] as const
export type ObjectType = typeof OBJECT_TYPES[number]
export type NebulaObjectType = typeof NEBULA_OBJECT_TYPES[number]
export type MolecularCloudObjectType = typeof MOLECULAR_CLOUD_OBJECT_TYPES[number]
export type BubbleObjectType = typeof BUBBLE_OBJECT_TYPES[number]
export type GalaxyObjectType = typeof GALAXY_OBJECT_TYPES[number]

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

export const NEBULA_SHAPE_KINDS = ['ellipsoid', 'blister', 'layers', 'shell', 'filaments', 'points'] as const
export type NebulaShapeKind = typeof NEBULA_SHAPE_KINDS[number]

export interface NebulaShape {
  kind: NebulaShapeKind
  // Line-of-sight depth from the Sun, then sky-plane major and minor semi-axes.
  semi_axes_pc: [number, number, number]
  // Major axis angle from Galactic north toward increasing Galactic longitude.
  position_angle_deg: number
  // Line-of-sight sheet centers relative to the nebula center (layers only).
  layer_offsets_pc: number[]
  // Observed sky brightness (8-bit, base64) on a tangent-plane grid spanning both semi-axes:
  // rows run toward Galactic north, columns toward increasing longitude (position angle 0 only).
  mask?: { size: [number, number]; values: string }
  // Measured 3D emission (points only): per puff 8-bit line-of-sight, major and minor offsets
  // spanning ±semi-axes and an opacity, base64. Puffs beyond them fill a smooth body.
  points?: { radius_pc: number; values: string }
  // Dark lanes seen against the glow, on the grid of `mask` (8-bit optical depth, base64), drawn with `puffs`
  // absorbing puffs.
  dust?: { size: [number, number]; puffs: number; values: string }
  // Measured dust pillars: columns through axis points (toward Galactic north, toward increasing longitude, depth away
  // from the Sun, radius; pc from the nebula centre), lit by the stars at `light_pc`. `rim_puffs` of `puff_count`
  // draw their lit skin; `dust_puffs` more absorb the light behind them. A column's `opacity` (1 by default) thins its dust; an unlit column (`lit: false`) has no glowing skin;
  // a `tint` (hex) is the colour its dust lets through; a fading column (`fade: true`) rises out of the glow from its first point.
  pillars?: {
    light_pc: [number, number, number]; rim_puffs: number; dust_puffs: number
    columns: { name: string; opacity?: number; lit?: boolean; tint?: string; fade?: boolean; points: [number, number, number, number][] }[]
  }
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
  // R-band mag/arcsec² (Vega); estimated values come from plate classes or calibrated hand estimates.
  surface_brightness_mag_arcsec2: number
  surface_brightness_source: string
  surface_brightness_estimated: boolean
  puff_count: number
  seed: number
  source_label: string
  source_url: string
  model_note: string
  remnant?: RemnantDetails
}

export interface RemnantDetails {
  age_yr: [min: number, max: number]
  age_source: string
  // The neutron star the explosion left behind, when one is identified in the compact-object overlay.
  neutron_star: { id: string; name: string } | null
  // The star that survived the explosion, in the star catalog that holds it.
  surviving_star?: { catalog: string; id: string; name: string }
  // Temperature of the X-ray-emitting gas; null when not adopted.
  hot_gas_kev: number | null
  hot_gas_source: string | null
  // What the drawn volume represents, such as modeled visible-light filaments or X-ray emission.
  drawn_as: string
}

/** Dust drawn from a 3D dust map: one-parsec voxels, sampled for display. */
export interface DustGeometry {
  // Seeds the display texture of the samples.
  catalog_id: number
  mean_density_cm3: number
  peak_density_cm3: number
  source_voxel_count: number
  // Flattened Galactic Cartesian display samples: x, y, z, x, y, z, ...
  sample_points_pc: number[]
  bounds_pc: { x: [number, number]; y: [number, number]; z: [number, number] }
  palette: {
    real: { body: string; rim: string }
    exaggerated: { body: string; rim: string }
  }
  opacity: number
}

export interface MolecularCloudDetails extends DustGeometry {
  // The published complex of the source catalog; null when it names none.
  complex_name: string | null
  // A complex this catalog associates the cloud with, from its dark nebulae or measured sightlines.
  association?: { name: string; source: string }
  distance_pc: number
  galactic_longitude_deg: number
  galactic_latitude_deg: number
  equivalent_radius_pc: number
  surface_area_pc2: number
  volume_pc3: number
  position_source: string
  source_label: string
  source_url: string
  model_note: string
}

export interface DarkNebulaDetails {
  catalog: string
  galactic_longitude_deg: number
  galactic_latitude_deg: number
  // Diameter of the circle with the catalogued area.
  angular_diameter_arcmin: number
  // Lynds and Feitzinger & Stüwe opacity class, 1 (faintest) to 6 (darkest).
  opacity_class: number | null
  distance_pc: number
  // 16th to 84th percentile of the distance measurement, or of the dust layer along the nebula.
  distance_range_pc: [number, number]
  distance_source: string
  distance_url: string
  // The drawn cloud whose dust makes the nebula; null when the nebula carries its own dust.
  parent_cloud_id: string | null
  geometry: DustGeometry | null
  position_source: string
  source_label: string
  source_url: string
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

// Kompaneets (1960) blast wave in a medium whose density falls exponentially along the axis.
export interface BubbleKompaneetsShape {
  kind: 'kompaneets'
  // The driving source in Galactic Cartesian coordinates.
  origin_pc: [number, number, number]
  // Galactic direction of falling density, toward which the bubble elongates.
  axis_longitude_deg: number
  axis_latitude_deg: number
  scale_height_pc: number
  // Dimensionless age y/H; the shell blows out at 2.
  dimensionless_age: number
}

export type BubbleShape = BubbleAnalyticShape | BubbleDirectionalGridShape | BubbleKompaneetsShape

export interface BubbleDetails {
  designations: string[]
  average_radius_pc: number
  surface_distance_range_pc: [number, number]
  surface_distance_max_open: boolean
  // Null when the source models the shell as a thin surface.
  shell_thickness_pc: number | null
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

export interface GalaxySource {
  label: string
  url: string
}

export interface GalaxyDetails {
  /** De Vaucouleurs morphological class, such as SB(s)m. */
  morphology: string
  /** Plain-language form of the morphological class. */
  classification: string
  /** Center, J2000. */
  ra_deg: number
  dec_deg: number
  distance_pc: number
  distance_error_pc: number
  distance_method: string
  distance_source: GalaxySource
  /** Isophotal diameter; for the Milky Way a published value, otherwise the apparent size at the adopted distance. */
  diameter_pc: number
  /** Major and minor isophotal axes on the sky; null for the Milky Way, which surrounds us. */
  angular_size_deg: [number, number] | null
  size_source: GalaxySource
  /** Rough published star count range; null where none is published. */
  star_count: [number, number] | null
  star_count_source: GalaxySource | null
  /** Mass including dark matter, total or within a stated radius as its scope says; absent without a reviewed measurement. */
  total_mass?: { value_solar: number; lower_error_solar: number; upper_error_solar: number; scope: string; source: GalaxySource }
  /** Heliocentric; null for the Milky Way. */
  radial_velocity_kms: number | null
  radial_velocity_error_kms: number | null
  radial_velocity_source: GalaxySource | null
  /** Model radius: the drawn disk and the sky area that selects the galaxy. */
  model_radius_pc: number
  palette: { real: string; exaggerated: string }
  /** Published structure of a dwarf galaxy drawn as a smooth spheroid; absent for the galaxies with their own models. */
  spheroid?: {
    /** Along the long axis. */
    half_light_radius_pc: number
    /** 1 − minor/major axis ratio. */
    ellipticity: number
    /** Long axis, north through east, 0–180°. */
    position_angle_deg: number
    /** Mean V-band surface brightness within the half-light radius, mag/arcsec². */
    surface_brightness_v: number
    source: GalaxySource
  }
  position_source: string
  model_note: string
}

export interface CompactObjectDetails {
  /** A published model value, never a measurement; mass_solar stays null. */
  mass_model?: { value_solar: number; reference: string; source_url: string; scope: string }
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
  /** A published model mass, never a measurement; mass_solar stays null. */
  mass_model?: { value_solar: number; status: 'model-derived'; reference: string; source_url: string; scope: string }
  /** Scalars that charts and cards need, but which come from models rather than measurement. */
  modelled_values?: Partial<Record<'temperature_k' | 'radius_solar', {
    status: 'model-derived'
    reference: string
    source_url: string
    scope: string
  }>>
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
  // One paper's spectroscopic log g (cgs), independent of catalog mass and radius.
  surface_gravity?: {
    log_g: number
    reference: string
    // Independent papers within 0.3 dex of the selected value.
    measurements: number
    // Spread between three or more papers; SIMBAD lists no per-paper errors.
    scatter_dex?: number
    scope?: string
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
  /** Stands in for deferred raw astrometry on the map, where merging and sky charts need only the position. */
  sky_position?: { ra_deg: number; dec_deg: number }
  /** Stands in for deferred designations on the map, where charts and top lists identify stars by HIP number. */
  hip_numbers?: number[]
  /** Where a merged row's deferred designations come from, in merge order. */
  catalog_designation_parts?: DesignationPart[]
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
  dark_nebula?: DarkNebulaDetails
  bubble?: BubbleDetails
  galaxy?: GalaxyDetails
}

export type DesignationPart = { key: string } | { names: readonly string[] }

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

/** The dust a cloud or a free-standing dark nebula draws. */
export function dustGeometry(star: Pick<Star, 'molecular_cloud' | 'dark_nebula'>): DustGeometry | null {
  return star.molecular_cloud ?? star.dark_nebula?.geometry ?? null
}

export function isBubbleObject(star: Pick<Star, 'type'>): boolean {
  return BUBBLE_OBJECT_TYPES.some((type) => type === star.type)
}

export function isGalaxyObject(star: Pick<Star, 'type'>): boolean {
  return GALAXY_OBJECT_TYPES.some((type) => type === star.type)
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
    supernova_remnant: 'Supernova remnant',
    molecular_cloud: 'Molecular cloud',
    dark_nebula: 'Dark nebula',
    bubble: 'Bubble',
    galaxy: 'Galaxy',
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
