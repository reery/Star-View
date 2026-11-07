import { describe, expect, it } from 'vitest'
import { decodeSavedViewLink, encodeSavedViewLink, type SavedViewSettings } from './saved-views'

const defaults: SavedViewSettings = {
  catalogId: 'nearest-neighbors', showAlwaysBright: false, showWesternConstellationStars: false, showNakedEyeStars: false, showNotableDistantStars: false,
  showFamousClusterStars: false, filterCategories: ['compact_objects'],
  filterSubtypes: ['sun', 'star', 'brown_dwarf', 'white_dwarf', 'molecular_cloud', 'reflection_nebula', 'hii_region', 'planetary_nebula', 'bubble'],
  magnitudeLimit: 7, hideFainterObjects: false, objectDistanceLimitLy: 100, earthOrbitMode: 'now', milkyWayVisible: true, oortCloudVisible: true,
  visibilityConeMode: 'off', motionArrowsVisible: false, motionYears: 1_000, motionFrame: 'galactic', gridVisible: true, skyGridMode: 'off',
  simulationYears: 0, simulationPlaying: false, simulationDirection: 1, playbackSecondsPerThousandYears: 1, followSelection: false,
  selectedId: 'sirius-a', observerId: 'sirius-a', referenceId: 'sun', observerView: false, observerViewAnchorId: null, objectSearch: '',
  viewState: { position: [3.4128765123, -1.98234123, 2.76523412], target: [-0.4938271234, 2.47712345, -0.7591234], home: false, observerRollRadians: 0, observerTelescope: false },
  graphFilter: [], paint: [],
}

const observer: SavedViewSettings = {
  ...defaults, catalogId: 'nearest-1000', showWesternConstellationStars: true, filterSubtypes: [...defaults.filterSubtypes, 'neutron_star', 'pulsar'],
  magnitudeLimit: 6.5, objectDistanceLimitLy: 150, skyGridMode: 'equatorial', motionArrowsVisible: true, motionYears: 10_000, simulationYears: -12_345,
  selectedId: 'aldebaran-a', observerId: 'aldebaran-a', observerView: true, observerViewAnchorId: 'aldebaran-a',
  viewState: { position: [12.345678901234, -3.2109876543, 45.678901234], target: [12.345679901234, -3.2109866543, 45.678902234], home: false, observerRollRadians: 0.123, observerTelescope: true },
}

const graphs: SavedViewSettings = {
  ...defaults, catalogId: 'nearest-5000', showNakedEyeStars: true, milkyWayVisible: false, selectedId: null, observerId: 'sun',
  graphFilter: [{ section: 'hr', key: '4000 9000 10.00 1000', label: '4,000 to 9,000 K, 10 to 1,000 L☉', range: [4000, 9000, 10, null] }, { section: 'spectral', key: 'G', label: 'G' }],
  paint: [['temperature', 0.75, ['color']], ['distance', 0.5]], neighborhood: { centerId: 'vega', radiusLy: 20 },
  viewState: { position: [48.12345678, -120.98765432, 33.33333333], target: [0, 0, 0], home: true, observerRollRadians: 0, observerTelescope: false },
}

function expectRoundTrip(settings: SavedViewSettings, name = 'A view'): string {
  const link = encodeSavedViewLink({ name, settings })
  const view = decodeSavedViewLink(`#${link}`)
  expect(view?.name).toBe(name)
  const { viewState, ...rest } = view!.settings
  const { viewState: expectedViewState, ...expected } = settings
  // The graphs rebuild a range's key and label.
  const graphFilter = expected.graphFilter?.map((selection) => selection.range ? { ...selection, key: '', label: '' } : selection)
  expect(rest).toEqual({ ...expected, graphFilter })
  expect({ ...viewState, position: undefined, target: undefined }).toEqual({ ...expectedViewState, position: undefined, target: undefined })
  // The camera offset keeps five significant digits of the viewing distance.
  const offset = (state: typeof viewState) => state.position.map((value, index) => value - state.target[index]!)
  const distance = Math.hypot(...offset(expectedViewState))
  offset(viewState).forEach((value, index) => expect(Math.abs(value - offset(expectedViewState)[index]!)).toBeLessThan(distance * 1e-4))
  if (!settings.observerView) viewState.target.forEach((value, index) => expect(Math.abs(value - expectedViewState.target[index]!)).toBeLessThan(distance * 1e-4))
  return link
}

describe('saved view links', () => {
  it('leaves link defaults out', () => {
    expect(expectRoundTrip(defaults, 'Sirius')).toBe('v=-4,u57,-yer,r70,-3t6,j43,-5uv&n=Sirius')
  })

  it('keeps only the camera direction in the observer view', () => {
    const link = expectRoundTrip(observer, 'Hyades from Aldebaran')
    expect(link.split('&').find((part) => part.startsWith('v='))!.split(',')).toHaveLength(4)
    expect(link.length).toBeLessThan(160)
  })

  it('restores graph filters, paint and neighborhoods', () => {
    expect(expectRoundTrip(graphs, 'Giants ~ near, & far.')).toContain('&h=hr~4000~9000~10~&h=spectral~G&')
  })

  it('keeps only the size of nearest-N catalogs', () => {
    expect(expectRoundTrip(observer)).toMatch(/^c=1000&/)
    expect(expectRoundTrip({ ...defaults, catalogId: 'western-constellation-stars' })).toMatch(/^c=western-constellation-stars&/)
  })

  it('leaves the object search and playback controls to the recipient', () => {
    const settings: SavedViewSettings = { ...defaults, objectSearch: 'HD 12345', simulationPlaying: true, simulationDirection: -1, playbackSecondsPerThousandYears: 4, followSelection: true }
    const link = encodeSavedViewLink({ name: 'View', settings })
    expect(link).toBe(encodeSavedViewLink({ name: 'View', settings: defaults }))
    expect(decodeSavedViewLink(link)?.settings).toMatchObject({ objectSearch: '', simulationPlaying: false, simulationDirection: 1, followSelection: false })
  })

  it('ignores fragments without a valid view', () => {
    expect(decodeSavedViewLink('')).toBeNull()
    expect(decodeSavedViewLink('#tutorial')).toBeNull()
    expect(decodeSavedViewLink('#v=-4,1,2,3&n=')).toBeNull()
    expect(decodeSavedViewLink('#v=-4,1,2,3&n=%E0')).toBeNull()
    expect(decodeSavedViewLink('#v=-4,1,2,3&e=never&n=View')).toBeNull()
  })
})
