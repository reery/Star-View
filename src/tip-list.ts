import type { Tip } from './tips'
import type { Step } from './tutorial'

const query = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)
const shown = (selector: string) => !!query(selector)?.checkVisibility()
const usable = (selector: string) => {
  const button = query<HTMLButtonElement>(selector)
  return !!button && !button.disabled && button.checkVisibility()
}
const textOf = (selector: string) => query(selector)?.textContent?.trim() ?? ''

/** Show me opens a tab through its own button first, as the visitor would. */
function opening(selector: string): Pick<Step, 'press' | 'enter'> {
  const closed = () => query(selector)?.getAttribute('aria-expanded') !== 'true'
  return {
    press: () => closed() ? selector : null,
    enter: () => { if (closed()) query(selector)?.click() },
  }
}

/** An Explore tool's tip points at its button in the Explore menu, without opening its card. */
const exploreTip = (panel: string, text: Tip['text'], title: string, body: string, when?: () => boolean): Tip => ({
  id: panel, feature: panel, level: 'novice', text, when,
  step: { title, body, target: `#${panel}-toggle`, flyout: '.discover-controls' },
})

/**
 * One is picked at random among those that fit and introduce something not used yet.
 * Show me points at where a feature is; it opens a tab or card only when the feature sits inside it.
 * Tip texts mark up objects, [features] and *terms*, as `Tip.text` describes.
 */
export const TIPS: readonly Tip[] = [
  {
    id: 'object-info', feature: 'object-info', level: 'novice',
    when: () => usable('#object-info-toggle'),
    text: '{selected} has an interesting [article] about its properties.',
    step: {
      title: 'Info',
      body: 'Here you can read summary [articles] about interesting or peculiar details of various objects.',
      target: '#object-info-toggle', avoid: '#selected-object-card',
    },
  },
  {
    id: 'value-card', feature: 'value-card', level: 'novice',
    // The row sits in the Specs tab, which may be closed; it is hidden only for objects without a mass.
    when: () => usable('#object-specs-toggle') && query('#mass-row')?.hidden === false,
    text: 'How will {selected} end its life? Its *mass* decides, and the [Mass] card shows how.',
    step: {
      title: 'Values open up',
      body: 'Most values in [Specs] open a card of their own with diagrams and comparisons. Click one whenever a number alone says little.',
      target: '#mass-toggle', avoid: '#selected-object-card', ...opening('#object-specs-toggle'),
    },
  },
  {
    id: 'solar-system', feature: 'solar-system', level: 'novice', select: 'sun',
    text: 'The {sun} has eight *planets*, each with a card of its own.',
    step: {
      title: 'Our Solar System',
      body: 'The [System] tab lists them. Each *planet* opens a card with its globe and key facts, and its *moons* where it has any.',
      target: '#object-system-toggle', avoid: '#selected-object-card',
    },
  },
  {
    id: 'star-system', feature: 'star-systems', level: 'novice',
    when: () => shown('#star-components'),
    text: '{selected} is not alone: it has *companion stars*.',
    step: {
      title: 'Star systems',
      body: 'The [System] tab shows the *companion stars* and known *planets* of an object. The buttons under its name switch between the stars of a system.',
      target: '#object-system-toggle', avoid: '#selected-object-card',
    },
  },
  {
    id: 'star-systems', feature: 'star-systems', level: 'novice', select: 'alpha-centauri-a',
    text: '{alpha-centauri-a} is one of three stars in the nearest *star system*.',
    step: {
      title: 'Star systems',
      body: 'The [System] tab shows the *companion stars* and known *planets* of an object. The buttons under its name switch between the stars of a system.',
      target: '#object-system-toggle', avoid: '#selected-object-card',
    },
  },
  {
    id: 'observer', feature: 'observer', level: 'novice',
    when: () => usable('#observer-view'),
    text: 'See the sky as it looks from {selected} in [Observer view].',
    step: {
      title: 'Observer view',
      body: 'The camera stands on the selected object, and the stars shine as bright as they would from there. Its card zooms in with a [telescope] and rolls the view.',
      target: '#observer-view-controls', flyout: '#observer-view-controls',
    },
  },
  {
    id: 'set-origin', feature: 'set-origin', level: 'novice',
    when: () => usable('#set-origin'),
    text: '[Set as origin] measures every distance from {selected} instead of the Sun.',
    step: {
      title: 'Set as origin',
      body: 'The grid and all distances move to the selected object. The buttons beside it go back to the *origin* or to the Sun.',
      target: '#origin-controls', flyout: '#origin-controls',
    },
  },
  {
    id: 'compare', feature: 'compare', level: 'novice',
    when: () => usable('#object-compare-toggle'),
    text: '[Compare] {selected} side by side with another star.',
    step: {
      title: 'Compare',
      body: 'Press [Compare], then pick the second star on the map or in [Objects]. The cards then show the values of both. You can do this with a right click or long press as well.',
      target: '#object-compare-toggle', avoid: '#selected-object-card',
    },
  },
  exploreTip('constellations', () => `{selected} lies in *${textOf('#constellation')}*. Its chart is under [Constellations].`, 'Constellations',
    'Every *constellation* has a chart, its stars and when you can see it from where you live.',
    () => shown('#constellation-row') && !!textOf('#constellation')),
  {
    id: 'selection-history', feature: 'selection-history', level: 'novice',
    when: () => usable('#selection-back') && !!textOf('#selection-back-object'),
    text: () => `[Previous selection] takes you back to ${textOf('#selection-back-object')}.`,
    step: {
      title: 'Selection history',
      body: '[Previous selection] and [Next selection] step through the objects you looked at, like a browser’s back and forward buttons.',
      target: '#selection-controls', flyout: '#selection-controls',
    },
  },
  {
    id: 'rotation', feature: 'rotation', level: 'novice',
    text: 'A slowly turning map shows its depth much better: try [Automatic rotation].',
    step: {
      title: 'Automatic rotation',
      body: 'Its card sets the [direction] and [speed], and brings the camera back to where it started.',
      target: '#rotation-toggle', side: 'below', flyout: '.camera-view-controls',
    },
  },
  {
    id: 'filter', feature: 'filter', level: 'novice',
    text: 'There is more out there: [Filter] adds constellation stars, *nebulae* and stars farther away.',
    step: {
      title: 'Filter',
      body: 'Choose the [catalog], which kinds of objects appear, how far from the *origin* and how faint they may be. At the bottom of the card you can also enable [Pulsars] and [Black holes].',
      target: '#filter-toggle',
    },
  },
  {
    id: 'objects', feature: 'objects', level: 'novice',
    text: '[Objects] finds any star by name or *catalog number*, such as HIP 70890 for Proxima Centauri.',
    step: {
      title: 'Objects',
      body: 'Everything on the map, as a list. Click a row to select it, or expand the list into a [table] to sort and filter.',
      target: '#objects-toggle',
    },
  },
  {
    id: 'explore', feature: 'explore', level: 'novice',
    text: 'Seven tools wait behind [Explore], from star records to a spaceship.',
    step: {
      title: 'Explore',
      body: '[Top lists], [Constellations], [Neighborhood], [Stellar motion], [Paint], [Graphs] and the [Spaceship] each open a card of their own.',
      target: '.discover-controls', flyout: '.discover-controls',
    },
  },
  {
    id: 'object-menu', feature: 'object-menu', level: 'novice',
    text: '[Right-click] a star on the map, or hold a finger on it, to see how far it is from your selection.',
  },
  {
    id: 'glossary-term', feature: 'glossary-term', level: 'novice',
    when: () => shown('#object-specs [data-glossary-term="age"]'),
    text: 'Labels with a [dotted underline], such as *Age*, explain themselves.',
    step: {
      title: 'Dotted labels',
      body: 'Click one to open its [Glossary] entry, written in plain words.',
      target: '#object-specs [data-glossary-term="age"]', avoid: '#selected-object-card',
    },
  },
  {
    id: 'sky-grid', feature: 'sky-grid', level: 'novice',
    text: '[Sky grids] lay the *coordinates* of Earth’s sky, or of the Milky Way, over the map.',
    step: {
      title: 'Sky grids',
      body: 'The [Equatorial grid] uses *right ascension* and *declination*, as astronomers map Earth’s sky. The [Galactic grid] follows the plane of the *Milky Way*.',
      target: '.grid-controls', flyout: '.grid-controls',
    },
  },
  {
    id: 'saved-views', feature: 'saved-views', level: 'novice',
    text: 'Like this view? Keep it in [Saved views] to come back later.',
    step: {
      title: 'Saved views',
      body: 'A [saved view] brings back the camera, filters, selection and motion settings, and stays in this browser.',
      target: '#views-toggle', side: 'below',
    },
  },
  exploreTip('paint', '[Paint] the stars by their *mass*, *distance* or *metallicity*.', 'Paint',
    'Pick a property, then let it set the [color], the [size] or both. A legend shows the scale.'),
  exploreTip('graphs', '[Graphs] chart every object on the map, from an *HR diagram* to their masses.', 'Graphs',
    'Select a range in a chart to keep only those objects; the map follows.'),
  exploreTip('top-lists', 'Which stars are the largest or the hottest? [Top lists] know.', 'Top lists',
    'Records such as the largest and hottest stars and *supernova* candidates. Click a name to select it on the map.'),
  exploreTip('motion', 'Stars move. Run the clock in [Stellar motion] and watch them drift.', 'Stellar motion',
    'Time runs up to 500,000 years forward or back, and every star moves with its measured *motion*.'),
  exploreTip('neighborhood', 'Which objects are the closest neighbors of a star? Ask [Neighborhood].', 'Neighborhood',
    'Keep only the objects within a chosen radius of a star.'),
  exploreTip('spaceship', 'Fly between the stars yourself in the [Spaceship].', 'Spaceship',
    'Steer with the keyboard or the on-screen controls, and pick how fast you travel.'),
  {
    id: 'camera-views', feature: 'camera-views', level: 'novice',
    text: 'Look at the map straight from the [Top], the [Side] or the [Back].',
    step: {
      title: 'Camera views',
      body: '[Top], [Side] and [Back] sit behind [Reset view]. Each turns the camera to look along one axis of the grid.',
      target: '.camera-view-controls', flyout: '.camera-view-controls',
    },
  },
  {
    id: 'copy-link', feature: 'copy-link', level: 'novice',
    text: 'Send this exact view to someone with [Copy view as link].',
    step: {
      title: 'Copy view as link',
      body: 'Whoever opens the link sees the same view.',
      target: '#copy-view-link', flyout: '.saved-view-controls',
    },
  },
  {
    id: 'glossary', feature: 'glossary', level: 'novice',
    text: 'Unsure what a term means? The [Glossary] explains it in plain words.',
    step: {
      title: 'Glossary',
      body: 'Search it by name. Many articles have diagrams to try and a [Going deeper] part.',
      target: '#glossary-toggle',
    },
  },
  {
    id: 'preferences', feature: 'preferences', level: 'novice',
    text: 'Prefer *parsecs* to *light-years*, or more natural star colors? See [Preferences].',
    step: {
      title: 'Preferences',
      body: 'Units, star colors and labels, and extras for the scene such as [Earth’s orbit] and the [Milky Way].',
      target: '#preferences-toggle',
    },
  },
  {
    id: 'hide-ui', feature: 'hide-ui', level: 'novice',
    text: '[Hide UI] clears the controls away for an unobstructed view of the sky.',
    step: {
      title: 'Hide UI',
      body: 'The controls slide out of the way, for a clear view or a screenshot.',
      target: '#hide-ui', flyout: '.camera-view-controls',
    },
  },
]
