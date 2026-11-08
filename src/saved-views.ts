import { isEarthOrbitMode, type EarthOrbitMode } from './earth-orbit'
import { isVisibilityConeMode, type VisibilityConeMode } from './constellation-visibility'
import { isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey } from './object-filter'
import { MOTION_YEAR_OPTIONS, SIMULATION_YEAR_LIMIT, type MotionYears, type ViewerViewState } from './viewer'
import type { MotionFrame } from './astronomy'
import type { SkyGridMode } from './sky-grid'
import { isPaintSettingId, PAINT_CHANNELS, PAINT_LEVEL_RANGE, type PaintChannel, type PaintSettingId } from './star-paint'
import type { SavedGraphSelection } from './graphs'
import { NEIGHBORHOOD_RADIUS_LY } from './neighborhood'

export const SAVED_VIEWS_STORAGE_KEY = 'star-view-saved-views'
export const OBJECT_DISTANCE_STEPS_LY = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 10000, 20000] as const

export interface SavedViewSettings {
  catalogId: string
  /** Legacy saved views use this flag to enable the constellation catalog that now holds the bright stars. */
  showAlwaysBright: boolean
  showWesternConstellationStars: boolean
  /** Absent in entries saved before the catalog existed. */
  showNakedEyeStars?: boolean
  /** Absent in entries saved before the catalog existed. */
  showNotableDistantStars?: boolean
  /** Legacy saved views use this flag to enable the combined constellation catalog. */
  showFamousClusterStars: boolean
  filterCategories: FilterCategoryId[]
  filterSubtypes: FilterKey[]
  magnitudeLimit: number
  /** Absent in views saved before the option existed. */
  hideFainterObjects?: boolean
  objectDistanceLimitLy: number
  earthOrbitMode: EarthOrbitMode
  milkyWayVisible: boolean
  /** Absent in views saved before the option existed. */
  oortCloudVisible?: boolean
  /** Absent in views saved before the option existed. */
  visibilityConeMode?: VisibilityConeMode
  motionArrowsVisible: boolean
  motionYears: MotionYears
  motionFrame: MotionFrame
  gridVisible: boolean
  skyGridMode?: SkyGridMode
  simulationYears: number
  simulationPlaying: boolean
  simulationDirection: 1 | -1
  playbackSecondsPerThousandYears: number
  followSelection: boolean
  selectedId: string | null
  observerId: string
  referenceId: string
  observerView: boolean
  observerViewAnchorId: string | null
  objectSearch: string
  viewState: ViewerViewState
  /** Absent in views saved before graph filters and paint were stored. */
  graphFilter?: SavedGraphSelection[]
  /** Channels are absent in views saved before settings could share the paint. */
  paint?: [PaintSettingId, number, PaintChannel[]?][]
  /** Absent in views saved without a neighborhood. The birth year stays private and is never saved. */
  neighborhood?: { centerId: string; radiusLy: number }
}

export interface SavedView {
  version: 1
  id: string
  name: string
  originName: string
  savedAt: string
  settings: SavedViewSettings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const isRangeEnd = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value))

function isGraphSelection(value: unknown): value is SavedGraphSelection {
  return isRecord(value) && typeof value.section === 'string' && typeof value.key === 'string' && typeof value.label === 'string'
    && (value.range === undefined || (Array.isArray(value.range) && (value.range.length === 2 || value.range.length === 4) && value.range.every(isRangeEnd)))
}

function isPaintChannels(value: unknown): value is PaintChannel[] {
  return Array.isArray(value) && value.length > 0 && value.every((channel, index) => PAINT_CHANNELS.includes(channel) && value.indexOf(channel) === index)
}

function isPaintEntry(value: unknown): value is [PaintSettingId, number, PaintChannel[]?] {
  return Array.isArray(value) && (value.length === 2 || (value.length === 3 && isPaintChannels(value[2]))) && isPaintSettingId(value[0])
    && typeof value[1] === 'number' && value[1] >= PAINT_LEVEL_RANGE[0] && value[1] <= PAINT_LEVEL_RANGE[1]
}

function isFiniteTuple3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
}

// Storage is user-controlled input: validate every field before it reaches the viewer.
function isSavedView(value: unknown): value is SavedView {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== 'string' || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.originName !== 'string' || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || !isRecord(value.settings)) return false
  const settings = value.settings
  const viewState = settings.viewState
  return typeof settings.catalogId === 'string'
    && typeof settings.showAlwaysBright === 'boolean'
    && typeof settings.showWesternConstellationStars === 'boolean'
    && (settings.showNakedEyeStars === undefined || typeof settings.showNakedEyeStars === 'boolean')
    && (settings.showNotableDistantStars === undefined || typeof settings.showNotableDistantStars === 'boolean')
    && typeof settings.showFamousClusterStars === 'boolean'
    && Array.isArray(settings.filterCategories) && settings.filterCategories.every(isFilterCategoryId)
    && Array.isArray(settings.filterSubtypes) && settings.filterSubtypes.every(isFilterKey)
    && typeof settings.magnitudeLimit === 'number' && settings.magnitudeLimit >= 0 && settings.magnitudeLimit <= 25
    && (settings.hideFainterObjects === undefined || typeof settings.hideFainterObjects === 'boolean')
    && typeof settings.objectDistanceLimitLy === 'number' && OBJECT_DISTANCE_STEPS_LY.includes(settings.objectDistanceLimitLy as typeof OBJECT_DISTANCE_STEPS_LY[number])
    && typeof settings.earthOrbitMode === 'string' && isEarthOrbitMode(settings.earthOrbitMode)
    && typeof settings.milkyWayVisible === 'boolean'
    && (settings.oortCloudVisible === undefined || typeof settings.oortCloudVisible === 'boolean')
    && (settings.visibilityConeMode === undefined || (typeof settings.visibilityConeMode === 'string' && isVisibilityConeMode(settings.visibilityConeMode)))
    && typeof settings.motionArrowsVisible === 'boolean'
    && typeof settings.motionYears === 'number' && MOTION_YEAR_OPTIONS.includes(settings.motionYears as MotionYears)
    && (settings.motionFrame === 'galactic' || settings.motionFrame === 'solar')
    && typeof settings.gridVisible === 'boolean'
    && (settings.skyGridMode === undefined || settings.skyGridMode === 'off' || settings.skyGridMode === 'equatorial' || settings.skyGridMode === 'galactic')
    && typeof settings.simulationYears === 'number' && Math.abs(settings.simulationYears) <= SIMULATION_YEAR_LIMIT
    && typeof settings.simulationPlaying === 'boolean'
    && (settings.simulationDirection === 1 || settings.simulationDirection === -1)
    && typeof settings.playbackSecondsPerThousandYears === 'number' && settings.playbackSecondsPerThousandYears >= 0.5 && settings.playbackSecondsPerThousandYears <= 15
    && typeof settings.followSelection === 'boolean'
    && (settings.selectedId === null || typeof settings.selectedId === 'string')
    && typeof settings.observerId === 'string'
    && typeof settings.referenceId === 'string'
    && typeof settings.observerView === 'boolean'
    && (settings.observerViewAnchorId === null || typeof settings.observerViewAnchorId === 'string')
    && typeof settings.objectSearch === 'string'
    && isRecord(viewState) && isFiniteTuple3(viewState.position) && isFiniteTuple3(viewState.target)
    && typeof viewState.home === 'boolean' && typeof viewState.observerRollRadians === 'number' && Number.isFinite(viewState.observerRollRadians)
    && (viewState.observerTelescope === undefined || typeof viewState.observerTelescope === 'boolean')
    && (viewState.observerObservatory === undefined || typeof viewState.observerObservatory === 'boolean')
    && (settings.graphFilter === undefined || (Array.isArray(settings.graphFilter) && settings.graphFilter.every(isGraphSelection)))
    && (settings.paint === undefined || (Array.isArray(settings.paint) && settings.paint.every(isPaintEntry)))
    && (settings.neighborhood === undefined || (isRecord(settings.neighborhood) && typeof settings.neighborhood.centerId === 'string'
      && Number.isInteger(settings.neighborhood.radiusLy) && (settings.neighborhood.radiusLy as number) >= NEIGHBORHOOD_RADIUS_LY.min
      && (settings.neighborhood.radiusLy as number) <= NEIGHBORHOOD_RADIUS_LY.max))
}

export function readSavedViews(): SavedView[] {
  try {
    const stored = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isSavedView).sort((first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt)) : []
  } catch {
    return []
  }
}

// View links carry a view in the URL fragment, which never reaches the server. Each setting has a one-letter key
// and is left out at its link default. Links depend on these defaults, so they never change, even when the app's do.
const LINK_VALUES = {
  m: ['magnitudeLimit', 7], d: ['objectDistanceLimitLy', 100], e: ['earthOrbitMode', 'now'],
  k: ['visibilityConeMode', 'off'], y: ['motionYears', 1_000], r: ['motionFrame', 'galactic'], g: ['skyGridMode', 'off'],
  t: ['simulationYears', 0], s: ['selectedId', 'sirius-a'], o: ['referenceId', 'sun'],
} as const satisfies Record<string, readonly [keyof SavedViewSettings, string | number]>
const LINK_FILTERS = new Set<string>(['compact_objects', 'sun', 'star', 'brown_dwarf', 'white_dwarf', 'molecular_cloud', 'reflection_nebula', 'hii_region', 'planetary_nebula', 'bubble'])
/** Bit order of the `b` flags; append only. Each bit marks a flag that differs from its link default. */
const LINK_FLAGS = ['showWesternConstellationStars', 'showNakedEyeStars', 'showNotableDistantStars', 'hideFainterObjects', 'milkyWayVisible', 'oortCloudVisible',
  'motionArrowsVisible', 'gridVisible', 'observerView', 'home', 'observerTelescope', 'observerObservatory'] as const
const LINK_FLAGS_ON: readonly string[] = ['milkyWayVisible', 'oortCloudVisible', 'gridVisible']
/** Camera offsets keep five significant digits of the viewing distance. */
const LINK_CAMERA_DIGITS = 5

// `~` and `,` separate parts of a value, so encoded text never contains them.
const encodeLinkText = (text: string) => encodeURIComponent(text).replaceAll('%20', '+').replaceAll('~', '%7E')
const decodeLinkText = (text: string) => decodeURIComponent(text.replaceAll('+', ' '))

/** The URL fragment, without `#`, that restores a view; it leaves out the sender's object search and playback controls, including follow. */
export function encodeSavedViewLink({ name, settings }: Pick<SavedView, 'name' | 'settings'>): string {
  // Nearest-N catalogs keep only their size.
  const params: [string, string | number][] = settings.catalogId === 'nearest-neighbors' ? [] : [['c', encodeLinkText(settings.catalogId.replace(/^nearest-(?=\d+$)/, ''))]]
  const linked = { ...settings, simulationYears: Math.round(settings.simulationYears) }
  for (const [key, [field, fallback]] of Object.entries(LINK_VALUES)) {
    // Views saved before an option existed lack it; a null selection is empty.
    const value = linked[field] === undefined ? fallback : linked[field] ?? ''
    if (value !== fallback) params.push([key, encodeLinkText(String(value))])
  }
  // Views saved before the Oort cloud option existed show it; the retired catalog flags map to the constellation catalog, as on load.
  const flags: Partial<Record<typeof LINK_FLAGS[number], unknown>> = {
    ...settings, ...settings.viewState, oortCloudVisible: settings.oortCloudVisible ?? true,
    showWesternConstellationStars: settings.showWesternConstellationStars || settings.showFamousClusterStars || settings.showAlwaysBright,
  }
  const bits = LINK_FLAGS.reduce((sum, flag, bit) => sum | Number(Boolean(flags[flag]) !== LINK_FLAGS_ON.includes(flag)) << bit, 0)
  if (bits) params.push(['b', bits.toString(36)])
  const chosen = new Set<string>([...settings.filterCategories, ...settings.filterSubtypes])
  const toggled = [...new Set([...LINK_FILTERS, ...chosen])].filter((key) => chosen.has(key) !== LINK_FILTERS.has(key))
  if (toggled.length) params.push(['f', toggled.join(',')])
  // The camera is an offset from its target in steps of the viewing distance; the observer view re-centers on its anchor, so it needs only the offset.
  const { position, target, observerRollRadians } = settings.viewState
  const offset = position.map((value, index) => value - target[index]!)
  const exponent = Math.floor(Math.log10(Math.hypot(...offset) || 1)) - LINK_CAMERA_DIGITS + 1
  const camera = settings.observerView ? offset : [...offset, ...target]
  params.push(['v', [exponent, ...camera.map((value) => Math.round(value / 10 ** exponent).toString(36))].join(',')])
  const roll = Math.round(observerRollRadians * 1000)
  if (settings.observerView && roll) params.push(['w', roll])
  if (settings.observerView && settings.observerViewAnchorId !== settings.selectedId) params.push(['l', settings.observerViewAnchorId ?? ''])
  if (!settings.observerView && settings.observerId !== settings.selectedId) params.push(['i', settings.observerId])
  for (const [id, level, channels] of settings.paint ?? []) {
    params.push(['p', [id, level, ...(channels && channels.length < PAINT_CHANNELS.length ? channels : [])].join('~')])
  }
  // Graphs rebuild a picked group from its key and a range's key and label from its ends.
  for (const { section, key, range } of settings.graphFilter ?? []) {
    params.push(['h', [section, ...range?.map((end) => end ?? '') ?? [key]].map((part) => encodeLinkText(String(part))).join('~')])
  }
  const { neighborhood } = settings
  if (neighborhood) params.push(['a', neighborhood.centerId === settings.selectedId ? neighborhood.radiusLy : `${neighborhood.radiusLy}~${neighborhood.centerId}`])
  // The name comes last: a link ending in punctuation that a chat app trims loses only that.
  params.push(['n', encodeLinkText(name)])
  return params.map(([key, value]) => `${key}=${value}`).join('&')
}

/** The view a link fragment restores, or null when the fragment holds none. */
export function decodeSavedViewLink(fragment: string): SavedView | null {
  const params = new Map<string, string[]>()
  for (const pair of fragment.replace(/^#/, '').split('&')) {
    const at = pair.indexOf('=')
    if (at > 0) params.set(pair.slice(0, at), [...params.get(pair.slice(0, at)) ?? [], pair.slice(at + 1)])
  }
  const one = (key: string) => params.get(key)?.[0]
  const camera = one('v')?.split(',')
  const name = one('n')
  if (!camera || name === undefined) return null
  try {
    const values = Object.fromEntries(Object.values(LINK_VALUES).map(([field, fallback], index) => {
      const raw = one(Object.keys(LINK_VALUES)[index]!)
      return [field, raw === undefined ? fallback : typeof fallback === 'number' ? Number(raw) : decodeLinkText(raw)]
    })) as Pick<SavedViewSettings, typeof LINK_VALUES[keyof typeof LINK_VALUES][0]>
    const bits = parseInt(one('b') ?? '0', 36)
    const flag = (name: typeof LINK_FLAGS[number]) => Boolean(bits >> LINK_FLAGS.indexOf(name) & 1) !== LINK_FLAGS_ON.includes(name)
    const filters = new Set(LINK_FILTERS)
    for (const key of one('f')?.split(',') ?? []) filters.delete(key) || filters.add(key)
    const [exponent, ...steps] = camera.map((part, index) => index ? parseInt(part, 36) : Number(part))
    const offset = steps.slice(0, 3).map((step) => step * 10 ** exponent!)
    const target = steps.length === 6 ? steps.slice(3).map((step) => step * 10 ** exponent!) : [0, 0, 0]
    const selectedId = values.selectedId || null
    const observerView = flag('observerView')
    const anchor = one('l')
    const observerViewAnchorId = observerView ? (anchor === undefined ? selectedId : anchor || null) : null
    const neighborhood = one('a')?.split('~')
    const catalog = one('c')
    const view = {
      version: 1, id: '', name: decodeLinkText(name), originName: values.referenceId, savedAt: new Date().toISOString(),
      settings: {
        ...values,
        catalogId: catalog === undefined ? 'nearest-neighbors' : /^\d+$/.test(catalog) ? `nearest-${catalog}` : decodeLinkText(catalog),
        selectedId,
        showAlwaysBright: false,
        showFamousClusterStars: false,
        // The search only narrows the sender's object list, so links leave it out.
        objectSearch: '',
        ...Object.fromEntries(LINK_FLAGS.slice(0, 9).map((name) => [name, flag(name)])),
        // Playback stays under the recipient's control: the view opens paused, and these are placeholders for their own follow, speed and direction.
        simulationPlaying: false,
        followSelection: false,
        simulationDirection: 1,
        playbackSecondsPerThousandYears: 1,
        filterCategories: [...filters].filter(isFilterCategoryId),
        filterSubtypes: [...filters].filter(isFilterKey),
        observerId: observerView ? observerViewAnchorId ?? '' : one('i') ?? selectedId ?? '',
        observerViewAnchorId,
        viewState: {
          position: offset.map((value, index) => value + target[index]!), target, home: flag('home'),
          observerRollRadians: Number(one('w') ?? 0) / 1000, observerTelescope: flag('observerTelescope'),
          observerObservatory: flag('observerObservatory'),
        },
        paint: (params.get('p') ?? []).map((entry) => {
          const [id, level, ...channels] = entry.split('~')
          return channels.length ? [id, Number(level), channels] : [id, Number(level)]
        }),
        graphFilter: (params.get('h') ?? []).map((entry) => {
          const [section, ...parts] = entry.split('~').map(decodeLinkText)
          return parts.length === 1 ? { section, key: parts[0], label: parts[0] } : { section, key: '', label: '', range: parts.map((end) => end === '' ? null : Number(end)) }
        }),
        ...neighborhood && { neighborhood: { radiusLy: Number(neighborhood[0]), centerId: neighborhood[1] ?? selectedId ?? '' } },
      },
    }
    return isSavedView(view) ? view : null
  } catch {
    return null
  }
}
