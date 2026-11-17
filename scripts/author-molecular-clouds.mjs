#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const DOI_URL = 'https://doi.org/10.3847/1538-4357/ad0cf8'
const DATAVERSE_URL = 'https://doi.org/10.7910/DVN/BFYDG8'
const EXPECTED = {
  metadata: '36040a858ab163659cf0708442da281410f48de202e92eb6d90afd4041e85fba',
  positions: 'bbad4cfb1f2787074451a35ca54d1c557ba5c014a169510fbe22ceeb30fb75bb',
}

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function cleanString(buffer, start, length) {
  return buffer.subarray(start, start + length).toString('ascii').replaceAll('\0', '').trim()
}

function hduDataOffset(buffer, hduIndex) {
  let offset = 0
  for (let hdu = 0; hdu <= hduIndex; hdu++) {
    const headerStart = offset
    const values = new Map()
    while (true) {
      const card = buffer.subarray(offset, offset + 80).toString('ascii')
      offset += 80
      const key = card.slice(0, 8).trim()
      if (card[8] === '=') values.set(key, card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim())
      if (key === 'END') break
    }
    offset = Math.ceil(offset / 2880) * 2880
    if (hdu === hduIndex) return { offset, values }
    const bitpix = Math.abs(Number(values.get('BITPIX') ?? 8))
    const axes = Number(values.get('NAXIS') ?? 0)
    let elements = axes === 0 ? 0 : 1
    for (let axis = 1; axis <= axes; axis++) elements *= Number(values.get(`NAXIS${axis}`) ?? 0)
    const bytes = elements * bitpix / 8 + Number(values.get('PCOUNT') ?? 0)
    offset += Math.ceil(bytes / 2880) * 2880
    if (offset <= headerStart) throw new Error('Invalid FITS HDU length.')
  }
  throw new Error(`Missing FITS HDU ${hduIndex}.`)
}

function readMetadata(buffer) {
  const { offset, values } = hduDataOffset(buffer, 1)
  const rowLength = Number(values.get('NAXIS1'))
  const rowCount = Number(values.get('NAXIS2'))
  if (rowLength !== 99 || rowCount !== 65) throw new Error('Unexpected Cahlon Table 1 shape.')
  return Array.from({ length: rowCount }, (_, index) => {
    const start = offset + index * rowLength
    return {
      id: Number(cleanString(buffer, start, 15)),
      complex: cleanString(buffer, start + 15, 20),
      x: buffer.readInt32BE(start + 35),
      y: buffer.readInt32BE(start + 39),
      z: buffer.readInt32BE(start + 43),
      longitude: buffer.readDoubleBE(start + 47),
      latitude: buffer.readDoubleBE(start + 55),
      distance: buffer.readInt32BE(start + 63),
      density: buffer.readInt32BE(start + 67),
      peakDensity: buffer.readInt32BE(start + 71),
      mass: buffer.readInt32BE(start + 75),
      radius: buffer.readDoubleBE(start + 79),
      surfaceArea: buffer.readInt32BE(start + 87),
      volume: buffer.readInt32BE(start + 91),
    }
  })
}

function readPositions(buffer) {
  const { offset, values } = hduDataOffset(buffer, 1)
  const rowLength = Number(values.get('NAXIS1'))
  const rowCount = Number(values.get('NAXIS2'))
  if (rowLength !== 40 || rowCount !== 78_326) throw new Error('Unexpected Cahlon position-table shape.')
  const groups = Array.from({ length: 65 }, () => [])
  for (let index = 0; index < rowCount; index++) {
    const start = offset + index * rowLength
    const id = buffer.readInt32BE(start)
    const point = [buffer.readInt32BE(start + 4), buffer.readInt32BE(start + 8), buffer.readInt32BE(start + 12)]
    if (!groups[id]) throw new Error(`Unexpected molecular-cloud component ID ${id}.`)
    groups[id].push(point)
  }
  return groups
}

function hashPoint(id, [x, y, z]) {
  let value = Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(x, 0x85ebca6b) ^ Math.imul(y, 0xc2b2ae35) ^ Math.imul(z, 0x27d4eb2f)
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad)
  value = Math.imul(value ^ value >>> 15, 0x735a2d97)
  return (value ^ value >>> 15) >>> 0
}

const PALETTES = [
  { real: { body: '#45423f', rim: '#827a70' }, exaggerated: { body: '#564b42', rim: '#b89a78' } },
  { real: { body: '#424548', rim: '#788184' }, exaggerated: { body: '#45515a', rim: '#91a4aa' } },
  { real: { body: '#49453f', rim: '#877e70' }, exaggerated: { body: '#5e5043', rim: '#c0a27a' } },
  { real: { body: '#454442', rim: '#7e7c78' }, exaggerated: { body: '#504d49', rim: '#a9a19a' } },
  { real: { body: '#46423d', rim: '#81776a' }, exaggerated: { body: '#594a3e', rim: '#b78f69' } },
]

const EDENHOFER_URL = 'https://doi.org/10.1051/0004-6361/202347628'
const ZUCKER_2021_URL = 'https://doi.org/10.3847/1538-4357/ac1f96'
const ZUCKER_2020_URL = 'https://doi.org/10.1051/0004-6361/201936145'
const LEIKE_URL = 'https://doi.org/10.1051/0004-6361/202038169'
const ADDITIONS = join(root, 'catalog-work/molecular-clouds/additions.json')
const CATALOGS = {
  'Lynds (1962)': { label: 'Lynds (1962)', url: 'https://doi.org/10.1086/190072' },
  'Feitzinger & Stuewe (1984)': { label: 'Feitzinger & Stüwe (1984)', url: 'https://ui.adsabs.harvard.edu/abs/1984A%26AS...58..365F' },
  'Barnard (1927)': { label: 'Barnard (1927)', url: 'https://ui.adsabs.harvard.edu/abs/1927cpsm.book.....B' },
}
// Zucker et al. (2020) cloud names of their sightlines.
const COMPLEXES = {
  Aquila_Rift: 'Aquila Rift', Aquila_S: 'Aquila South', Coalsack: 'Coalsack', Corona_Australis: 'Corona Australis',
  Hercules: 'Hercules', L1333: 'LDN 1333', Lupus: 'Lupus', Pegasus: 'Pegasus',
}
// Clouds better known by a name of their own than by one of their dark nebulae.
const KNOWN_AS = {
  'cahlon-cloud-0': { name: 'MBM 12', source: 'High-latitude cloud MBM 12 of Magnani, Blitz & Mundy (1985), which holds LDN 1453–1458' },
}
// Complexes far larger than any one drawn feature, whose features are named as parts.
const PARTS_OF_LARGER = new Set(['Aquila Rift'])
const LY_PER_PC = 3.26156

const galacticName = (longitude, latitude) => `G${longitude.toFixed(1)}${latitude < 0 ? '−' : '+'}${Math.abs(latitude).toFixed(1)}`

function sampled(seed, voxels) {
  const points = []
  for (let index = 0; index < voxels.length; index += 3) points.push([voxels[index], voxels[index + 1], voxels[index + 2]])
  const bounds = {
    x: [Math.min(...points.map((point) => point[0])), Math.max(...points.map((point) => point[0]))],
    y: [Math.min(...points.map((point) => point[1])), Math.max(...points.map((point) => point[1]))],
    z: [Math.min(...points.map((point) => point[2])), Math.max(...points.map((point) => point[2]))],
  }
  const samples = points.sort((first, second) => hashPoint(seed, first) - hashPoint(seed, second))
    .slice(0, Math.ceil(points.length / 4)).flat()
  return { source_voxel_count: points.length, sample_points_pc: samples, bounds_pc: bounds }
}

function geometry(seed, voxels, mean, peak, densityScale = 1) {
  const contrast = Math.min(1, Math.log10(peak / mean + 1) / 1.5)
  return {
    catalog_id: seed,
    mean_density_cm3: mean,
    peak_density_cm3: peak,
    ...sampled(seed, voxels),
    palette: PALETTES[seed % PALETTES.length],
    opacity: Number(((0.066 + 0.034 * contrast) * densityScale).toFixed(4)),
  }
}

function additionalObjects(cahlon) {
  const additions = JSON.parse(readFileSync(ADDITIONS, 'utf8'))
  const nebulae = additions.darkNebulae
  const hosted = new Map()
  for (const nebula of nebulae) {
    if (!nebula.parent_cloud) continue
    hosted.set(nebula.parent_cloud, [...hosted.get(nebula.parent_cloud) ?? [], nebula])
  }
  // A cloud's association: its own published complex, a measured sightline through it, or its largest dark nebula.
  function association(id) {
    if (KNOWN_AS[id]) return KNOWN_AS[id]
    const complexes = [...new Set((additions.zuckerSightlines[id] ?? []).map((hit) => COMPLEXES[hit.cloud]).filter(Boolean))]
    if (complexes.length === 1) {
      return { name: complexes[0], source: `Zucker et al. (2020) measured distances along ${complexes[0]} sightlines that run through this cloud at its distance` }
    }
    const largest = [...hosted.get(id) ?? []].sort((first, second) => second.area_deg2 - first.area_deg2 || first.key.localeCompare(second.key))[0]
    return largest ? { name: `${largest.designations[0]} cloud`, source: `Holds the dark nebula ${largest.designations[0]} of ${CATALOGS[largest.catalog].label}` } : null
  }
  const complexOf = (object) => object.molecular_cloud.complex_name ?? object.molecular_cloud.association?.name
  for (const object of cahlon) {
    if (object.molecular_cloud.complex_name !== null) continue
    const found = association(object.id)
    if (found) object.molecular_cloud.association = found
  }
  const clouds = additions.clouds.map((cloud, index) => {
    const fromEdenhofer = cloud.source === 'edenhofer'
    const seed = 100 + index
    const found = fromEdenhofer ? association(cloud.id) : { name: 'Corona Australis', source: 'Zucker et al. (2021), Corona Australis cutout of the Leike et al. (2020) map' }
    return {
      type: 'molecular_cloud',
      id: cloud.id,
      name: '',
      spectral_type: null,
      constellation: null,
      x_pc: cloud.center_pc[0],
      y_pc: cloud.center_pc[1],
      z_pc: cloud.center_pc[2],
      vx_kms: null, vy_kms: null, vz_kms: null,
      temperature_k: null,
      mass_solar: cloud.mass_solar,
      luminosity_solar: null, radius_solar: null, metallicity_dex: null, age_gyr: null, absolute_mag: null,
      epoch: 2000,
      notes: fromEdenhofer
        ? `Connected structure above n_H = 25 cm^-3 in the Edenhofer et al. (2024) 3D dust map, resampled to one-parsec voxels and segmented with the boundary and minimum size of Cahlon et al. (2024); it is below their 500-solar-mass floor or outside their map. Densities use A_V = 2.8 E(ZGR23) and N_H/A_V = 2.21e21 cm^-2. The displayed fog samples keep one in four voxels.`
        : 'Voxels above n_H = 25 cm^-3 in the Zucker et al. (2021) cutout of the Leike et al. (2020) map, the map Cahlon et al. (2024) segmented: the cloud body and the dense head around R CrA, which the boundary separates. Cahlon et al. leave the cloud out at their 150-voxel and 500-solar-mass floors. The displayed fog samples keep one in four voxels.',
      raw_astrometry: null,
      molecular_cloud: {
        ...geometry(seed, cloud.voxels_pc, cloud.mean_density_cm3, cloud.peak_density_cm3),
        complex_name: null,
        ...(found ? { association: found } : {}),
        distance_pc: cloud.distance_pc,
        galactic_longitude_deg: cloud.galactic_longitude_deg,
        galactic_latitude_deg: cloud.galactic_latitude_deg,
        equivalent_radius_pc: cloud.equivalent_radius_pc,
        surface_area_pc2: cloud.surface_area_pc2,
        volume_pc3: cloud.volume_pc3,
        position_source: fromEdenhofer ? 'Density-weighted center of the segmented Edenhofer et al. (2024) voxels' : 'Density-weighted center of the segmented Leike et al. (2020) voxels',
        source_label: fromEdenhofer ? 'Edenhofer et al. (2024)' : 'Zucker et al. (2021)',
        source_url: fromEdenhofer ? EDENHOFER_URL : ZUCKER_2021_URL,
        model_note: 'One-parsec 3D dust segmentation, deterministically sampled at 25% for display. Dust texture, optical depth and faint edge reflection are illustrative visualization choices, not calibrated extinction or a local illumination model.',
      },
      label: fromEdenhofer ? galacticName(cloud.galactic_longitude_deg, cloud.galactic_latitude_deg) : null,
    }
  })
  // Names follow Cahlon et al.: "<complex> Molecular Cloud" for a lone member, "<complex> - Cloud <label>" otherwise.
  const all = [...cahlon, ...clouds]
  const members = new Map()
  for (const object of all) {
    const complex = complexOf(object)
    if (complex) members.set(complex, (members.get(complex) ?? 0) + 1)
  }
  for (const object of all) {
    const complex = complexOf(object)
    const label = object.label ?? String(object.molecular_cloud.catalog_id)
    delete object.label
    if (object.molecular_cloud.complex_name !== null) continue
    if (KNOWN_AS[object.id]) object.name = KNOWN_AS[object.id].name
    else if (complex?.endsWith(' cloud')) object.name = complex.replace(/ cloud$/, ' Cloud')
    else if (complex) object.name = members.get(complex) === 1 && !PARTS_OF_LARGER.has(complex) ? `${complex} Molecular Cloud` : `${complex} - Cloud ${label}`
    else if (!object.name) object.name = `Molecular Cloud ${label}`
  }
  const names = new Map(all.map((object) => [object.id, object.name]))
  const darkNebulae = nebulae.map((nebula, index) => {
    const catalog = CATALOGS[nebula.catalog]
    const distance = nebula.distance_pc
    const [longitude, latitude] = [nebula.l, nebula.b]
    const radians = Math.PI / 180
    const position = [
      distance * Math.cos(latitude * radians) * Math.cos(longitude * radians),
      distance * Math.cos(latitude * radians) * Math.sin(longitude * radians),
      distance * Math.sin(latitude * radians),
    ].map((value) => Number(value.toFixed(4)))
    const name = nebula.designations.find((designation) => designation.startsWith('Barnard ')) ?? nebula.designations[0]
    // A short citation for the card; the notes say how the distance was measured.
    const [distanceLabel, distanceUrl, distanceMethod] = {
      edenhofer2024: ['Edenhofer et al. (2024)', EDENHOFER_URL, 'Distance of the dust layer along the nebula in the Edenhofer et al. (2024) 3D dust map.'],
      leike2020: ['Leike et al. (2020)', LEIKE_URL, `Distance of the ${names.get(nebula.parent_cloud)} voxels along the nebula in the Leike et al. (2020) 3D dust map.`],
      zucker2020: ['Zucker et al. (2020)', ZUCKER_2020_URL, `Distance measured by Zucker et al. (2020) along their ${nebula.zucker_cloud?.replaceAll('_', ' ')} sightline at l = ${nebula.zucker_sightline?.[0]}°, b = ${nebula.zucker_sightline?.[1]}°.`],
    }[nebula.distance_method]
    const own = nebula.parent_cloud === null
    const densityScale = own ? Math.min(1, nebula.mean_density_cm3 / 25) : 1
    return {
      type: 'dark_nebula',
      id: nebula.key,
      name,
      designations: nebula.designations,
      spectral_type: null,
      constellation: nebula.constellation,
      x_pc: position[0], y_pc: position[1], z_pc: position[2],
      vx_kms: null, vy_kms: null, vz_kms: null,
      temperature_k: null, mass_solar: null, luminosity_solar: null, radius_solar: null, metallicity_dex: null, age_gyr: null, absolute_mag: null,
      epoch: 2000,
      notes: `Dark nebula ${nebula.designations.join(', ')}${nebula.opacity_class ? `, opacity class ${nebula.opacity_class} of 6` : ''}. ${own
        ? 'No drawn cloud holds it; it is drawn with the Edenhofer et al. (2024) voxels inside its outline and dust layer, above half the layer\'s peak density.'
        : `Drawn with the dust of the ${names.get(nebula.parent_cloud)}.`} ${distanceMethod}`,
      raw_astrometry: null,
      dark_nebula: {
        catalog: catalog.label,
        galactic_longitude_deg: longitude,
        galactic_latitude_deg: latitude,
        angular_diameter_arcmin: nebula.angular_diameter_arcmin,
        opacity_class: nebula.opacity_class,
        distance_pc: distance,
        distance_range_pc: nebula.distance_range_pc,
        distance_source: distanceLabel,
        distance_url: distanceUrl,
        parent_cloud_id: nebula.parent_cloud,
        geometry: own ? geometry(1000 + index, nebula.voxels_pc, nebula.mean_density_cm3, nebula.peak_density_cm3, densityScale) : null,
        position_source: `${catalog.label} catalog position`,
        source_label: catalog.label,
        source_url: catalog.url,
      },
    }
  })
  for (const nebula of darkNebulae) if (nebula.dark_nebula.distance_pc * LY_PER_PC > 1000) throw new Error(`Dark nebula beyond 1000 ly: ${nebula.id}`)
  return [...clouds, ...darkNebulae]
}

function build(metadataBuffer, positionsBuffer) {
  if (checksum(metadataBuffer) !== EXPECTED.metadata) throw new Error('Cahlon Table 1 checksum does not match the reviewed source.')
  if (checksum(positionsBuffer) !== EXPECTED.positions) throw new Error('Cahlon position-table checksum does not match the reviewed source.')
  const metadata = readMetadata(metadataBuffer)
  const positions = readPositions(positionsBuffer)
  const complexCounts = new Map()
  for (const row of metadata) if (row.complex !== '-') complexCounts.set(row.complex, (complexCounts.get(row.complex) ?? 0) + 1)
  const objects = metadata.map((row) => {
    if (row.id < 0 || row.id >= 65 || row.id !== metadata.indexOf(row)) throw new Error(`Unexpected metadata component ID ${row.id}.`)
    const sourcePoints = positions[row.id]
    if (!sourcePoints.length) throw new Error(`Component ${row.id} has no positions.`)
    const bounds = {
      x: [Math.min(...sourcePoints.map((point) => point[0])), Math.max(...sourcePoints.map((point) => point[0]))],
      y: [Math.min(...sourcePoints.map((point) => point[1])), Math.max(...sourcePoints.map((point) => point[1]))],
      z: [Math.min(...sourcePoints.map((point) => point[2])), Math.max(...sourcePoints.map((point) => point[2]))],
    }
    const displayCount = Math.ceil(sourcePoints.length / 4)
    const samples = [...sourcePoints]
      .sort((first, second) => hashPoint(row.id, first) - hashPoint(row.id, second))
      .slice(0, displayCount)
      .flat()
    const complexName = row.complex === '-' ? null : row.complex
    const name = complexName === null
      ? `Molecular Cloud ${row.id}`
      : complexCounts.get(complexName) === 1
        ? `${complexName} Molecular Cloud`
        : `${complexName} - Cloud ${row.id}`
    const contrast = Math.min(1, Math.log10(row.peakDensity / row.density + 1) / 1.5)
    return {
      type: 'molecular_cloud',
      id: `cahlon-cloud-${row.id}`,
      name,
      spectral_type: null,
      constellation: null,
      x_pc: row.x,
      y_pc: row.y,
      z_pc: row.z,
      vx_kms: null,
      vy_kms: null,
      vz_kms: null,
      temperature_k: null,
      mass_solar: row.mass,
      luminosity_solar: null,
      radius_solar: null,
      metallicity_dex: null,
      age_gyr: null,
      absolute_mag: null,
      epoch: 2000,
      notes: `${complexName ? `${complexName}; ` : ''}feature ${row.id} in the uniform 3D molecular-cloud segmentation of Cahlon et al. (2024). The displayed fog samples preserve the published one-parsec voxel geometry at one-quarter density; their soft visual radius is illustrative, not an additional measured cloud extent.`,
      raw_astrometry: null,
      molecular_cloud: {
        catalog_id: row.id,
        complex_name: complexName,
        distance_pc: row.distance,
        galactic_longitude_deg: row.longitude,
        galactic_latitude_deg: row.latitude,
        equivalent_radius_pc: row.radius,
        mean_density_cm3: row.density,
        peak_density_cm3: row.peakDensity,
        surface_area_pc2: row.surfaceArea,
        volume_pc3: row.volume,
        source_voxel_count: sourcePoints.length,
        sample_points_pc: samples,
        bounds_pc: bounds,
        palette: PALETTES[row.id % PALETTES.length],
        opacity: Number((0.066 + 0.034 * contrast).toFixed(4)),
        position_source: 'Cahlon et al. (2024), Table 1 and Galactic positions for all filtered clouds',
        source_label: 'Cahlon et al. (2024)',
        source_url: DOI_URL,
        model_note: 'Published one-parsec 3D dust segmentation, deterministically sampled at 25% for display. Dust texture, optical depth and faint edge reflection are illustrative visualization choices, not calibrated extinction or a local illumination model.',
      },
    }
  })
  objects.push(...additionalObjects(objects))
  const geometries = objects.map((object) => object.molecular_cloud ?? object.dark_nebula.geometry).filter(Boolean)
  const sourceVoxelCount = geometries.reduce((sum, geometry) => sum + geometry.source_voxel_count, 0)
  const displaySampleCount = geometries.reduce((sum, geometry) => sum + geometry.sample_points_pc.length / 3, 0)
  const counts = { molecular_cloud: 0, dark_nebula: 0 }
  for (const object of objects) counts[object.type] += 1
  const manifest = {
    schemaVersion: 1,
    id: 'molecular-clouds',
    label: 'Molecular clouds and dark nebulae',
    description: `${counts.molecular_cloud} molecular clouds in true 3D: the 65 features Cahlon et al. (2024) segmented from the Leike et al. (2020) dust map, plus the smaller clouds within 1000 ly that their 500-solar-mass floor leaves out, from the Edenhofer et al. (2024) map. ${counts.dark_nebula} catalogued dark nebulae within 1000 ly, placed by 3D dust maps and measured cloud distances, anchored to the clouds whose dust makes them.`,
    epoch: 2000,
    objectCount: objects.length,
    counts,
    sourceVoxelCount,
    displaySampleCount,
    sources: [
      { name: 'Cahlon et al. (2024); parsec-scale catalog of molecular clouds in the solar neighborhood', url: DOI_URL },
      { name: 'Cahlon et al. (2024) machine-readable tables; Harvard Dataverse', url: DATAVERSE_URL },
      { name: 'Leike et al. (2020); parsec-resolution 3D dust map', url: 'https://doi.org/10.1051/0004-6361/202038169' },
      { name: 'Edenhofer et al. (2024); parsec-scale Galactic 3D dust map out to 1.25 kpc', url: EDENHOFER_URL },
      { name: 'Zucker et al. (2021); 3D structure of local molecular clouds (Leike et al. cutouts)', url: ZUCKER_2021_URL },
      { name: 'Zucker et al. (2020); distances to molecular clouds in the Star Formation Handbook', url: ZUCKER_2020_URL },
      { name: 'Lynds (1962); Catalogue of Dark Nebulae (VizieR VII/7A)', url: CATALOGS['Lynds (1962)'].url },
      { name: 'Feitzinger & Stüwe (1984); dark nebulae and globules for l = 240–360° (VizieR VII/68)', url: CATALOGS['Feitzinger & Stuewe (1984)'].url },
      { name: 'Barnard (1927); catalogue of 349 dark objects (VizieR VII/220A)', url: CATALOGS['Barnard (1927)'].url },
    ],
    cutoffPolicy: 'All 65 filtered 3D cloud features in Cahlon et al. (2024) are retained; their centers span 116-440 pc (about 378-1435 ly), and the underlying Leike et al. map is effectively limited to about 400 pc. Within 1000 ly (306.6 pc) the census adds every connected Edenhofer et al. (2024) structure above Cahlon\'s n_H = 25 cm^-3 boundary with at least Cahlon\'s 150 one-parsec voxels, without Cahlon\'s 500-solar-mass floor, unless a Cahlon cloud already holds it: voxels within 6 pc of a Cahlon cloud, and structures covering the same sky at a similar distance, are that cloud displaced between the two maps. Corona Australis comes from the Leike et al. cutout of Zucker et al. (2021), because Edenhofer places most of its dust about 70 pc behind the Gaia distance of its young stars. Dark nebulae are those of Lynds (1962), Feitzinger & Stüwe (1984) and Barnard (1927) whose dust lies within 1000 ly: the nearest dust layer, in the Edenhofer map, where the nebula holds more dust than a ring around it, with at least half the column of the strongest such layer and an A_V above about 0.14 mag; a small nebula unresolved inside a larger cloud is placed by a single dominant dust layer at |b| >= 3 deg. A Zucker et al. (2020) distance measured inside a nebula replaces the map distance when it agrees within 25%; nebulae whose measured distance contradicts the map are left out. Each nebula is drawn with the cloud whose voxels fill it at its distance, or with its own map voxels where no cloud does.',
    snapshot: 'Cahlon et al. (2024) Harvard Dataverse tables, reviewed and transformed 2026-10-04. Edenhofer et al. (2024) mean map v1.0, Zucker et al. (2021) Corona Australis cutout and the dark-nebula catalogues measured 2026-11-16 (catalog-work/molecular-clouds/additions.json).',
  }
  return {
    manifest: `${JSON.stringify(manifest, null, 2)}\n`,
    payload: `${JSON.stringify({ schemaVersion: 1, overlayId: manifest.id, objects }, null, 2)}\n`,
  }
}

const [command, metadataPath, positionsPath, outputPath = join(root, 'src/data/overlays/molecular-clouds')] = process.argv.slice(2)
if (!['build', 'check'].includes(command) || !metadataPath || !positionsPath) {
  console.error('Usage: author-molecular-clouds.mjs <build|check> <Table1.fits> <positions.fits> [output-directory]')
  process.exitCode = 1
} else {
  const generated = build(readFileSync(resolve(metadataPath)), readFileSync(resolve(positionsPath)))
  const output = resolve(outputPath)
  if (command === 'check') {
    if (readFileSync(join(output, 'manifest.json'), 'utf8') !== generated.manifest
      || readFileSync(join(output, 'objects.json'), 'utf8') !== generated.payload) {
      throw new Error('Molecular-cloud overlay differs from the deterministic Cahlon build.')
    }
    console.log('Molecular-cloud overlay matches the reviewed Cahlon source tables.')
  } else {
    mkdirSync(dirname(join(output, 'manifest.json')), { recursive: true })
    writeFileSync(join(output, 'manifest.json'), generated.manifest)
    writeFileSync(join(output, 'objects.json'), generated.payload)
    console.log(`Wrote ${JSON.parse(generated.payload).objects.length} molecular clouds and dark nebulae to ${output}.`)
  }
}
