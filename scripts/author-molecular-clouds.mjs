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
        model_note: 'Published one-parsec 3D dust segmentation, deterministically sampled at 25% for display. Fog texture, opacity and illuminated rims are visualization choices.',
      },
    }
  })
  const sourceVoxelCount = positions.reduce((sum, points) => sum + points.length, 0)
  const displaySampleCount = objects.reduce((sum, object) => sum + object.molecular_cloud.sample_points_pc.length / 3, 0)
  const manifest = {
    schemaVersion: 1,
    id: 'molecular-clouds',
    label: 'Molecular clouds',
    description: 'The 65 distinct molecular-cloud features segmented in true 3D from the Leike et al. solar-neighborhood dust map by Cahlon et al. (2024).',
    epoch: 2000,
    objectCount: objects.length,
    counts: { molecular_cloud: objects.length },
    sourceVoxelCount,
    displaySampleCount,
    sources: [
      { name: 'Cahlon et al. (2024); parsec-scale catalog of molecular clouds in the solar neighborhood', url: DOI_URL },
      { name: 'Cahlon et al. (2024) machine-readable tables; Harvard Dataverse', url: DATAVERSE_URL },
      { name: 'Leike et al. (2020); parsec-resolution 3D dust map', url: 'https://doi.org/10.1051/0004-6361/202038169' },
    ],
    cutoffPolicy: 'All 65 filtered 3D cloud features in Cahlon et al. (2024) are retained. Their catalog centers span 116-440 pc (about 378-1435 ly), so every feature lies within the Star View 2000-ly scope. The underlying Leike et al. map is effectively limited to about 400 pc and is not a complete census of the outer 440-613 pc shell.',
    snapshot: 'Cahlon et al. (2024) Harvard Dataverse tables, reviewed and transformed 2026-10-04.',
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
    console.log(`Wrote 65 molecular clouds to ${output}.`)
  }
}
