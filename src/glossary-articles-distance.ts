import { wiki, type GlossaryArticle } from './glossary-index'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  parsec: {
    source: wiki('Parsec'),
    details: 'Astronomers like this unit because it comes straight from how nearby stars are measured. A star one parsec away appears to shift by one arcsecond as Earth moves one astronomical unit along its orbit. The name joins “parallax” and “arcsecond”.',
    interactive: { id: 'parallax' },
    sections: [
      { title: 'Putting it to scale', text: 'One parsec is about 3.26 light-years, 206,265 astronomical units or 30.9 trillion kilometers. The nearest star, Proxima Centauri, lies 1.3 parsecs away. No star is closer to the Sun than one parsec, so most stellar distances come out as a comfortable number.' },
    ],
    deeper: 'Distance in parsecs is 1 divided by parallax in arcseconds. Larger scales use the kiloparsec (kpc, 1,000 pc) for distances within a galaxy, and the megaparsec (Mpc, a million pc) between galaxies. The International Astronomical Union defines the parsec exactly as 648,000/π astronomical units.',
    related: ['lightyear', 'astronomical-unit', 'parallax', 'arcsecond'],
  },
  lightyear: {
    also: ['Sirius', 'Polaris', 'Andromeda_Galaxy'],
    source: wiki('Light-year'),
    details: 'Despite the name, it measures distance, not time. Light is the fastest thing there is, at about 300,000 km per second, yet it still needs more than four years to reach us from the next nearest star.',
    sections: [
      { title: 'Looking into the past', text: 'Because light takes time to arrive, you always see a star as it was. Light from Sirius left about 8.6 years ago. Light from Polaris left more than 400 years ago. Look at the Andromeda Galaxy with your own eyes and you are seeing light that started out about 2.5 million years ago.' },
    ],
    deeper: 'One light-year is 9,460,730,472,580.8 km, based on the Julian year of 365.25 days, and equals about 63,241 astronomical units or 0.3066 parsecs. Professional papers usually prefer parsecs, but Star View lets you choose either in Preferences.',
    related: ['parsec', 'astronomical-unit', 'parallax'],
  },
  'astronomical-unit': {
    also: ['Apsis', 'Transit_of_Venus'],
    source: wiki('Astronomical_unit'),
    details: 'It is the ruler for anything inside a planetary system. Sunlight crosses one astronomical unit in about 8 minutes and 20 seconds. Jupiter orbits at about 5.2 au, and Neptune at about 30 au.',
    sections: [
      { title: 'A long search for a number', text: 'Measuring the distance to the Sun was one of the great challenges of early astronomy. In the 1700s, expeditions traveled the world to time Venus crossing the Sun, including James Cook’s voyage to Tahiti in 1769. Radar measurements finally settled it in the 1960s.' },
    ],
    deeper: 'Since 2012, the astronomical unit has been defined as exactly 149,597,870,700 m. Earth’s real distance from the Sun varies during the year, from about 0.983 to 1.017 au.',
    related: ['parsec', 'lightyear', 'semi-major-axis'],
  },
  parallax: {
    also: ['Hipparcos', 'Gaia_(spacecraft)'],
    source: wiki('Stellar_parallax'),
    details: 'Hold up a finger and close each eye in turn: your finger seems to jump against the background. Stars do the same as Earth travels around the Sun. The nearer the star, the larger the jump, so measuring it gives the distance with simple geometry, no assumptions about the star needed.',
    interactive: { id: 'parallax' },
    sections: [
      { title: 'A long hunt', text: 'If Earth moves, the stars should appear to shift. Nobody could see a shift, and Tycho Brahe counted that against the idea of a moving Earth, because it would put the stars at gigantic distances. They really are that far: the shifts are incredibly small. Friedrich Bessel finally measured one in 1838, for the star 61 Cygni.' },
      { title: 'From hundreds of stars to billions', text: 'Earth’s atmosphere blurs starlight, which limits measurements from the ground, so space telescopes took over. Hipparcos measured about 118,000 stars in the 1990s, and Gaia has now measured over a billion, with far better accuracy.' },
    ],
    deeper: 'Distance in parsecs is 1/p, with p in arcseconds, or 1000/p with p in milliarcseconds (mas). Proxima Centauri has the largest stellar parallax, about 768 mas. When the uncertainty is a large share of the parallax, simply inverting it gives a biased distance, so careful work uses statistical methods instead.',
    related: ['parsec', 'arcsecond', 'gaia', 'hipparcos', 'distance-ladder'],
  },
  arcsecond: {
    source: wiki('Minute_and_second_of_arc'),
    details: 'Angles on the sky are measured in degrees, split into 60 arcminutes, each split into 60 arcseconds. An arcsecond is about the width of a coin seen from 4 km away. Space is so vast that astronomers often need these tiny angles.',
    sections: [
      { title: 'Finer still', text: 'The full Moon spans about 30 arcminutes. Turbulence in the air typically blurs stars to around an arcsecond from good sites. A milliarcsecond (mas) is a thousandth of an arcsecond, and Gaia works at finer scales still.' },
    ],
    interactive: { id: 'angular' },
    related: ['apparent-size', 'parallax', 'proper-motion', 'parsec'],
  },
  'apparent-size': {
    also: ['Betelgeuse', 'Moon'],
    source: wiki('Angular_diameter'),
    details: 'Size on the sky depends on both true size and distance, so it says little on its own. Your thumb held at arm’s length can hide the Moon, and yet the Moon is 3,474 km across.',
    interactive: { id: 'angular' },
    sections: [
      { title: 'An astonishing coincidence', text: 'The Sun is about 400 times wider than the Moon and about 400 times farther away. They look almost exactly the same size, which is why the Moon can just cover the Sun in a total solar eclipse.' },
      { title: 'Big but invisible', text: 'Some nebulae look larger than the full Moon but are far too faint to see with the naked eye, because their light is spread so thin. Nearly all stars, by contrast, look like points even in big telescopes. Betelgeuse is among the largest in the sky, and it spans only about 0.05 arcseconds.' },
    ],
    deeper: 'For small angles, θ ≈ D/d, in radians, with true size D and distance d. A handy rule: an object of 1 au seen from 1 parsec spans 1 arcsecond. Star View quotes nebula sizes from each catalog’s own measurement.',
    related: ['arcsecond', 'radius', 'parsec'],
  },
  'distance-ladder': {
    also: ['Hubble\'s_law'],
    source: wiki('Cosmic_distance_ladder'),
    details: 'No single method works at every distance. Astronomers build a chain instead, where each step calibrates the next, like using a short ruler to check a longer one. A mistake in a lower rung carries up to all the higher ones.',
    sections: [
      { title: 'Rungs of the ladder', text: 'Radar measures the Solar System. Parallax takes over for nearby stars. Those stars calibrate “standard candles” of known power, such as Cepheid variables, which reach nearby galaxies. Type Ia supernovae then reach billions of light-years. At the largest scales, astronomers use redshift.' },
      { title: 'A standing puzzle', text: 'The ladder gives a figure for how fast the universe is expanding, the Hubble constant. It disagrees with the value from the early universe’s afterglow. This “Hubble tension” is one of the big open questions in cosmology.' },
    ],
    related: ['parallax', 'period-luminosity', 'supernova', 'redshift'],
  },
}
