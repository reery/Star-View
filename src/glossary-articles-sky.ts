import { wiki, type GlossaryArticle } from './glossary-index'
import { galacticCoordinates } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  constellation: {
    also: ['Betelgeuse', 'Rigel'],
    source: wiki('Constellation'),
    details: 'To astronomers a constellation is not just a star pattern but a whole region of the sky with fixed borders, like a country on a map. Every star, galaxy and nebula lies inside exactly one of the 88.',
    sections: [
      { title: 'Patterns, not neighbors', text: 'The stars in a constellation seldom have anything to do with each other. They only line up from our point of view, often at wildly different distances: in Orion, Betelgeuse lies roughly 500 light-years away and Rigel about 850. Rotate the map in Star View, and the pattern falls apart.' },
      { title: 'Ancient stories, modern borders', text: 'Many northern constellations come from Greek and older Babylonian traditions. Southern ones were mostly added by European navigators in the 1500s–1700s. The International Astronomical Union fixed the 88 in 1922 and drew their official borders in 1930. Many cultures have their own very different skies.' },
    ],
    deeper: 'Hydra has the largest area and Crux the smallest. Star patterns such as the Big Dipper are called asterisms when they are not official constellations. Motions of the stars will slowly distort every pattern over tens of thousands of years.',
    related: ['celestial-sphere', 'right-ascension', 'declination', 'star-names', 'proper-motion'],
  },
  'celestial-sphere': {
    source: wiki('Celestial_sphere'),
    details: 'The stars are at many different distances, but to the eye they look as if they were all painted on one huge dome. Astronomers still use that idea as a map: extend Earth’s equator and poles outward, and you get a sky with its own equator and poles.',
    interactive: { id: 'coordinates' },
    sections: [
      { title: 'Why the sky seems to turn', text: 'Earth’s rotation makes the whole dome seem to wheel overhead each day, around a point in the sky very near Polaris in the north. How much of the sphere you can see depends on where you stand. From the poles, half of it never sets, and half never rises. At the equator, you can see it all during the year.' },
    ],
    related: ['right-ascension', 'declination', 'ecliptic', 'precession'],
  },
  'right-ascension': {
    source: wiki('Right_ascension'),
    details: 'Right ascension (RA) measures eastward around the sky’s equator. Unlike longitude, it is often written in hours, because the sky appears to turn once per day: 24 hours make the full 360°, so one hour is 15°. An object’s RA shows when it crosses your meridian, its highest point.',
    interactive: { id: 'coordinates' },
    sections: [
      { title: 'Where it starts', text: 'Zero marks the March equinox, the point where the Sun crosses the sky’s equator heading north. It is the Greenwich of the sky. Coordinates are fixed to the stars rather than to Earth’s surface, so a star’s RA and declination stay the same no matter when or where you observe.' },
    ],
    deeper: 'Written as hours, minutes and seconds, such as 05h 55m 10s. Because of precession the equinox drifts slowly, so catalogs state their reference epoch.',
    related: ['declination', 'celestial-sphere', 'epoch', 'precession'],
  },
  declination: {
    also: ['Sirius', 'Alpha_Centauri', 'Polaris'],
    source: wiki('Declination'),
    details: 'Declination (Dec) measures how far north or south of the sky’s equator an object lies. It runs from +90° at the north celestial pole to −90° at the south. Polaris is at nearly +89°, and the Southern Cross is near −60°.',
    interactive: { id: 'coordinates' },
    sections: [
      { title: 'What you can see from home', text: 'Declination tells you whether you can ever see a star. From latitude 50° north, stars above +40° never set, and stars south of −40° never rise. So Sirius, at about −17°, is visible from most of the world, whereas Alpha Centauri, at about −61°, stays hidden from most of Europe and the northern United States.' },
    ],
    related: ['right-ascension', 'celestial-sphere', 'epoch'],
  },
  epoch: {
    also: ['https://www.cosmos.esa.int/web/gaia/dr3'],
    source: wiki('Epoch_(astronomy)'),
    details: 'Stars move, and Earth’s axis slowly wobbles, so a star’s coordinates change gradually. An epoch names the moment when the listed position was true. It works like a date stamp on a map of a slowly shifting world.',
    sections: [
      { title: 'J2000 and Gaia’s dates', text: 'J2000.0 is the standard reference, about noon on January 1, 2000. Gaia’s third data release gives positions for 2016.0, the middle of that survey’s measuring period. Star View’s Epoch and Astrometry epoch rows show which moment a given position refers to.' },
    ],
    deeper: 'Strictly, the equinox and the epoch are different ideas: the coordinate frame, and when the star was at that spot. Modern catalogs use the International Celestial Reference System, tied to distant quasars, and quote an epoch for the star’s position within it.',
    related: ['proper-motion', 'precession', 'right-ascension', 'gaia'],
  },
  ecliptic: {
    source: wiki('Ecliptic'),
    details: 'Over a year, the Sun seems to drift through the stars, following a line called the ecliptic. It is tilted 23.4° from the sky’s equator, for the same reason Earth has seasons. The planets stay near it too, because the whole Solar System is rather flat.',
    interactive: { id: 'coordinates' },
    sections: [
      { title: 'Why it is called that', text: 'Eclipses can occur only when the Moon crosses this line, which is where the name comes from. The constellations it passes through make up the zodiac. The points where it crosses the sky’s equator are the March and September equinoxes.' },
    ],
    related: ['celestial-sphere', 'right-ascension', 'precession', 'constellation'],
  },
  'galactic-coordinates': {
    source: wiki('Galactic_coordinate_system'), figure: galacticCoordinates,
    details: 'For studying the Milky Way, it helps to use a map built around it. Galactic longitude (l) starts at zero toward the center of the galaxy and goes around the disk. Galactic latitude (b) measures the angle above or below the disk.',
    sections: [
      { title: 'Seeing the shape of things', text: 'Things that lie near the disk, such as young stars and nebulae, have small latitudes. Globular clusters and the galaxy’s halo stars spread over all latitudes. In these coordinates the shape of the Milky Way jumps out straight away. The galactic center lies at l = 0°, b = 0° in the direction of Sagittarius.' },
    ],
    related: ['milky-way', 'celestial-sphere', 'space-velocity'],
  },
  precession: {
    also: ['Pole_star'],
    source: wiki('Axial_precession'),
    details: 'Earth wobbles like a slowly turning top, with its axis tracing a circle in the sky about every 26,000 years. The pull of the Sun and Moon on Earth’s equatorial bulge causes this.',
    sections: [
      { title: 'Polaris is only temporary', text: 'Today Earth’s north pole points near Polaris. About 5,000 years ago, when the Egyptians were building the pyramids, the pole star was Thuban. In about 12,000 years it will be close to Vega. The wobble also shifts the equinoxes through the zodiac, so the signs of astrology no longer match the constellations they were named for.' },
    ],
    deeper: 'The shift is about 50 arcseconds a year, which is why catalogs state a reference epoch. It was probably first noticed by Hipparchus, in the 2nd century BCE, when he compared his star positions with older records.',
    related: ['epoch', 'right-ascension', 'celestial-sphere', 'ecliptic'],
  },
}
