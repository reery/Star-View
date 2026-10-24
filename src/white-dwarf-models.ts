// Build- and test-time only: the browser reads the precomputed white-dwarf-class-references.json.
import { existsSync, readFileSync } from 'node:fs'
import { massProperties } from './mass-properties.ts'
import {
  requiredWhiteDwarfReferences, WHITE_DWARF_SURFACE_METRICS,
  type WhiteDwarfEnvelope, type WhiteDwarfMetric, type WhiteDwarfReference, type WhiteDwarfSurfaceMetric,
} from './white-dwarf-class.ts'

type CoolingRow = readonly [temperature: number, radiusCm: number, luminosityErgs: number]
interface CoolingTrack { mass_solar: number; envelope: string; rows: readonly CoolingRow[] }
interface CoolingGrid { source: string; citation: string; version: string; archive_sha256: string; tracks: CoolingTrack[] }

/** Disposable copy of the Bédard et al. (2020) grid, written by scripts/extract-white-dwarf-references.py. */
export const COOLING_GRID_CACHE = new URL('../node_modules/.cache/star-view/white-dwarf-cooling-grid.json', import.meta.url)

export function coolingGridAvailable(): boolean {
  return existsSync(COOLING_GRID_CACHE)
}

let grid: CoolingGrid | undefined
function coolingGrid(): CoolingGrid {
  if (!coolingGridAvailable()) {
    throw new Error('White dwarf cooling grid is not cached. Run `python3 scripts/extract-white-dwarf-references.py` first.')
  }
  grid ??= JSON.parse(readFileSync(COOLING_GRID_CACHE, 'utf8')) as CoolingGrid
  return grid
}

const coolingProperties = (mass: number, [, radiusCm, luminosityErgs]: CoolingRow) => massProperties({
  type: 'white_dwarf', mass_solar: mass,
  radius_solar: radiusCm / 6.957e10,
  luminosity_solar: luminosityErgs / 3.828e33,
})

function coolingPropertiesAt(track: CoolingTrack, temperature: number) {
  const low = track.rows.findLast((row) => row[0] <= temperature)
  const high = track.rows.find((row) => row[0] >= temperature)
  if (!low || !high) return null // Never extrapolate a cooling track.
  if (low === high) return coolingProperties(track.mass_solar, low)
  const fraction = (temperature - low[0]) / (high[0] - low[0])
  const radius = low[1] + fraction * (high[1] - low[1])
  const luminosity = 10 ** (Math.log10(low[2]) + fraction * Math.log10(high[2] / low[2]))
  return coolingProperties(track.mass_solar, [temperature, radius, luminosity])
}

/** Evaluates the full Bédard et al. (2020) cooling grid for one atmosphere envelope and temperature. */
export function whiteDwarfModelReference(envelope: WhiteDwarfEnvelope, temperature: number | null): WhiteDwarfReference {
  const tracks = coolingGrid().tracks.filter((track) => envelope === null || track.envelope === envelope)
  const referenceTrack = envelope === null ? null : tracks.find((track) => track.mass_solar === 0.6)!
  const reference = temperature === null || referenceTrack === null ? null : coolingPropertiesAt(referenceTrack, temperature)
  const samples = temperature === null
    ? tracks.flatMap((track) => track.rows.map((row) => coolingProperties(track.mass_solar, row)))
    : tracks.flatMap((track) => {
      const properties = coolingPropertiesAt(track, temperature)
      return properties === null ? [] : [properties]
    })
  const metrics = Object.fromEntries(WHITE_DWARF_SURFACE_METRICS.map((metric): [WhiteDwarfSurfaceMetric, WhiteDwarfMetric] => {
    const values = samples.map((sample) => sample[metric]!).filter((value) => Number.isFinite(value) && value > 0)
    return [metric, { value: reference?.[metric] ?? null, range: values.length ? [Math.min(...values), Math.max(...values)] : null }]
  })) as Record<WhiteDwarfSurfaceMetric, WhiteDwarfMetric>
  return { benchmark: reference !== null, metrics }
}

export interface WhiteDwarfClassReferences {
  source: string
  citation: string
  version: string
  archive_sha256: string
  references: Record<string, WhiteDwarfReference>
}

/** Six significant digits: far beyond the card's displayed precision and the source fits' uncertainties. */
function stored(reference: WhiteDwarfReference): WhiteDwarfReference {
  const round = (value: number) => Number(value.toPrecision(6))
  const metrics = Object.fromEntries(Object.entries(reference.metrics).map(([metric, { value, range }]) =>
    [metric, { value: value === null ? null : round(value), range: range && [round(range[0]), round(range[1])] }]))
  return { benchmark: reference.benchmark, metrics: metrics as WhiteDwarfReference['metrics'] }
}

/** Evaluates the full grid for every reference the given objects can request. */
export function buildWhiteDwarfClassReferences(stars: Iterable<{ type: string; spectral_type: string | null; temperature_k: number | null }>): WhiteDwarfClassReferences {
  const models = coolingGrid()
  return {
    source: models.source, citation: models.citation, version: models.version, archive_sha256: models.archive_sha256,
    references: Object.fromEntries([...requiredWhiteDwarfReferences(stars)]
      .map(([key, [envelope, temperature]]) => [key, stored(whiteDwarfModelReference(envelope, temperature))])),
  }
}
