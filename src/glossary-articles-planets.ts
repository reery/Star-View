import { wiki, type GlossaryArticle } from './glossary-index'
import { tidalLocking, transit } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  exoplanet: {
    source: wiki('Exoplanet'),
    details: 'For most of history, nobody knew whether other stars had planets. Today we know of thousands, and studies suggest the average star in the Milky Way has at least one. Star View shows confirmed ones around nearby systems from the NASA Exoplanet Archive.',
    sections: [
      { title: 'A surprise from the start', text: 'The first planets confirmed around another star, in 1992, orbit a pulsar. In 1995, Michel Mayor and Didier Queloz found 51 Pegasi b, a giant planet circling a Sun-like star every four days, closer than Mercury orbits the Sun. No one had expected that, and it later earned them a Nobel Prize.' },
      { title: 'Finding what you cannot see', text: 'Planets are far too faint to see directly in most cases, lost in the star’s glare. So they are found through their effect on the star: the wobble they cause, or the dip in starlight when they cross in front of it. Together, these methods have found most known planets.' },
    ],
    deeper: 'A common size between Earth and Neptune has no counterpart in our Solar System. Doppler measurements alone give a minimum mass, written m sin i; transits give the radius. Together they yield a density, a first clue to whether a planet is rocky or gassy.',
    related: ['transit', 'habitable-zone', 'radial-velocity', 'inclination'],
  },
  'habitable-zone': {
    source: wiki('Circumstellar_habitable_zone'),
    details: 'Too close to a star and water boils away; too far and it freezes. Between these lies the habitable zone, sometimes called the Goldilocks zone. Its location depends on the star’s power: close in around a red dwarf, and farther out around a brighter star.',
    interactive: { id: 'habitable' },
    sections: [
      { title: 'Not a guarantee', text: 'Being in the zone says only that surface water might be possible. Venus sits near its inner edge and is scorching beneath a thick atmosphere, while Mars lies inside it and is frozen and dry. Moons outside the zone, such as Europa, may even hold liquid oceans under ice.' },
    ],
    deeper: 'Star View’s System card uses the conservative limits of Kopparapu et al. (2014), where the inner edge marks a runaway greenhouse and the outer edge a maximum greenhouse effect. They apply to stars between 2,600 and 7,200 K. For a planet of a given stellar flux, the zone scales with the square root of luminosity.',
    related: ['exoplanet', 'tidal-locking', 'star-m', 'astronomical-unit', 'bolometric-luminosity'],
  },
  transit: {
    also: ['Transit_(astronomy)'],
    source: wiki('Methods_of_detecting_exoplanets'), figure: transit,
    details: 'If a planet’s orbit lines up just right, it crosses in front of its star as seen from Earth, blocking a tiny part of the light. Jupiter would dim the Sun by about 1% for an outside observer, and Earth by only 0.01%. Regular dips reveal the planet’s orbit and size.',
    sections: [
      { title: 'Watching thousands of stars at once', text: 'NASA’s Kepler telescope stared at one patch of sky for years, and its data revealed thousands of planets. TESS now surveys nearly the whole sky. The method needs a lucky alignment, so for each planet found, many are missed.' },
      { title: 'Tasting an alien air', text: 'During a transit, a little starlight passes through the planet’s atmosphere, picking up the fingerprints of its gases. The James Webb Space Telescope uses this to study what those atmospheres are made of.' },
    ],
    deeper: 'Depth is about (R_planet / R_star)². The chance of a transit is about R_star / a: roughly 10% for a hot Jupiter and about 0.5% for an Earth twin orbiting a Sun-like star. Timing variations can reveal other unseen planets.',
    related: ['exoplanet', 'inclination', 'subtype-eclipsing-binary', 'light-curve'],
  },
  'tidal-locking': {
    source: wiki('Tidal_locking'), figure: tidalLocking,
    details: 'Gravity stretches a nearby body slightly, and that bulge acts as a brake on its spin until one rotation matches one orbit. This is why we only ever see one side of the Moon. Most large moons in the Solar System are locked to their planets.',
    sections: [
      { title: 'Planets with a permanent day', text: 'Red dwarfs are so dim that their habitable zones sit very close in, where planets are likely to be locked. One side of such a world would face eternal day and the other eternal night, although a thick atmosphere could spread the heat. Stars in close binaries can also lock to each other.' },
    ],
    related: ['habitable-zone', 'star-m', 'rotation', 'orbital-period'],
  },
}
