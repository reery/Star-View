import mercuryNaturalColor from './assets/planets/mercury-natural-color.jpg'
import mercuryHollows from './assets/planets/mercury-hollows.jpg'
import venusNaturalColor from './assets/planets/venus-natural-color.webp'
import earthBlueMarble from './assets/planets/earth-blue-marble.jpg'
import marsNaturalColor from './assets/planets/mars-natural-color.jpg'
import jupiterNaturalColor from './assets/planets/jupiter-natural-color.jpg'
import saturnNaturalColor from './assets/planets/saturn-natural-color.jpg'
import uranusVoyager from './assets/planets/uranus-voyager.jpg'
import neptuneVoyager from './assets/planets/neptune-voyager.jpg'

import { renderObjectInfoContent, type InfoSource, type ObjectInfo as PlanetInfo } from './object-info-content'
import { smallBodyInfo } from './small-body-info'

const mercuryFacts: InfoSource = {
  title: 'NASA: Mercury facts',
  url: 'https://science.nasa.gov/mercury/facts/',
}

const mercuryInfo: PlanetInfo = {
  image: {
    src: mercuryNaturalColor,
    width: 1040,
    height: 1040,
    alt: 'The entire disk of Mercury against black space, with a subtly grey-brown cratered surface and bright impact rays.',
    caption: 'NASA / MESSENGER · natural-color composite',
    credit: 'NASA / Johns Hopkins University Applied Physics Laboratory / Arizona State University / Carnegie Institution of Washington. October 6, 2008. Visible-light filters approximate natural color.',
    source: {
      title: 'NASA: Mercury’s “True” Color is in the Eye of the Beholder (PIA11364)',
      url: 'https://science.nasa.gov/photojournal/mercurys-true-color-is-in-the-eye-of-the-beholder/',
    },
  },
  introduction: {
    label: 'Mercury',
    source: mercuryFacts,
    text: 'is the smallest planet and the closest to the Sun, about 0.4 AU out. It is also the fastest, yet it spins so slowly that one day, from sunrise to sunrise, lasts two of its years. With almost no atmosphere to hold heat, the ground swings from about 430 °C by day to −180 °C at night.',
  },
  sections: [
    {
      id: 'orbit',
      title: 'Two years for every day',
      source: { title: 'Wikipedia: Mercury (planet)', url: 'https://en.wikipedia.org/wiki/Mercury_(planet)' },
      paragraphs: [{
        text: 'Mercury circles the Sun every 88 Earth days on the most eccentric orbit of any planet, ranging from about 0.31 to 0.47 AU. It turns exactly three times for every two orbits, so sunrise to sunrise takes 176 Earth days. Near perihelion, its orbital motion briefly outpaces its spin: from some places, the Sun would rise partway, sink back below the horizon and then rise again.',
      }],
    },
    {
      id: 'surface',
      title: 'Ice beside the Sun',
      source: mercuryFacts,
      paragraphs: [{
        text: 'Ancient lava plains and impact craters cover the surface; the Caloris basin alone spans about 1,550 km. Long cliffs rose as the interior cooled and the planet contracted. Yet the planet closest to the Sun holds water ice, preserved in polar craters whose floors never see sunlight.',
      }, {
        text: 'Bright, shallow pits called hollows are among the youngest features, probably left behind as volatile material escaped from the rock.',
      }],
      image: {
        src: mercuryHollows,
        width: 1080,
        height: 596,
        alt: 'A MESSENGER monochrome close-up of a 90 km crater, with bright hollows across its floor and central peaks.',
        caption: 'Bright hollows · 90 km crater · NASA / MESSENGER',
        credit: 'NASA / Johns Hopkins University Applied Physics Laboratory / Carnegie Institution of Washington. January 26, 2012. Monochrome Narrow Angle Camera image.',
        source: {
          title: 'NASA: Hollows, Hollows, Hollows (PIA15372)',
          url: 'https://science.nasa.gov/photojournal/hollows-hollows-hollows/',
        },
      },
    },
    {
      id: 'relativity',
      title: 'The orbit that proved Einstein right',
      source: { title: 'Wikipedia: Vulcan (hypothetical planet)', url: 'https://en.wikipedia.org/wiki/Vulcan_(hypothetical_planet)' },
      paragraphs: [{
        text: 'Mercury’s elongated orbit slowly turns around the Sun. By 1859, Urbain Le Verrier had found that it turns slightly faster than the pull of the known planets allowed; the excess is now measured at 43 arcseconds per century. Astronomers hunted for an unseen planet, Vulcan, inside Mercury’s orbit, and several claimed to have seen it. In 1915, Albert Einstein’s general relativity explained the excess exactly, and Vulcan vanished.',
      }],
    },
    {
      id: 'interior',
      title: 'An oversized iron heart',
      source: {
        title: 'NASA: Mercury’s solid inner core',
        url: 'https://www.nasa.gov/solar-system/a-closer-look-at-mercurys-spin-and-gravity-reveals-the-planets-inner-solid-core/',
      },
      paragraphs: [{
        text: 'A metallic core extends to about 85% of Mercury’s radius beneath a thin rocky mantle and crust, making the small planet almost as dense as Earth. Gravity and spin measurements point to a solid inner core surrounded by liquid metal.',
      }, {
        label: 'Magnetic field.',
        source: mercuryFacts,
        text: 'Motion in the liquid core generates a global field about 1% as strong as Earth’s at the surface. Atoms blasted from the ground by the solar wind and meteoroids form a thin exosphere, far too sparse to hold heat.',
      }],
    },
    {
      id: 'probes',
      title: 'Three missions in half a century',
      paragraphs: [{
        label: 'Mariner 10 (1974–1975).',
        source: { title: 'NASA: Mariner 10', url: 'https://science.nasa.gov/mission/mariner-10/' },
        text: 'Three flybys revealed the magnetic field and photographed nearly half the surface.',
      }, {
        label: 'MESSENGER (2011–2015).',
        source: { title: 'NASA: MESSENGER', url: 'https://science.nasa.gov/mission/messenger/' },
        text: 'The first orbiter mapped the planet, measured its composition and confirmed polar water ice. It ended its mission by crashing into the surface on April 30, 2015.',
      }, {
        label: 'BepiColombo (ESA / JAXA).',
        source: {
          title: 'ESA: BepiColombo arrival updates; reviewed October 7, 2026',
          url: 'https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/Latest_updates_BepiColombo_s_arrival_at_Mercury',
        },
        text: 'Two science orbiters will study the surface, interior and magnetic environment. Mercury orbit insertion is planned for November 2026.',
      }],
    },
    {
      id: 'history',
      title: 'A transit and a corrected spin',
      paragraphs: [{
        text: 'Known since antiquity, Mercury stays close to the Sun in our sky and is easiest to see low above the horizon around dawn or dusk.',
      }, {
        label: '1631.',
        source: {
          title: 'ESA: Pierre Gassendi’s first observed planetary transit',
          url: 'https://www.esa.int/Science_Exploration/Space_Science/SMART-1/Gassendi_crater_-_clue_on_the_thermal_history_of_Mare_Humorum',
        },
        text: 'Pierre Gassendi observed Mercury crossing the Sun, the first recorded observation of a planetary transit.',
      }, {
        label: '1965.',
        source: {
          title: 'NASA GISS: Rotation period of the planet Mercury (McGovern et al., 1965)',
          url: 'https://www.giss.nasa.gov/pubs/abs/mc04000r.html',
        },
        text: 'Arecibo radar established a rotation period of about 59 days, overturning the belief that one side always faced the Sun.',
      }],
    },
  ],
}

const venusFacts: InfoSource = {
  title: 'NASA: Venus facts',
  url: 'https://science.nasa.gov/venus/venus-facts/',
}

const venusInfo: PlanetInfo = {
  image: {
    src: venusNaturalColor,
    width: 1000,
    height: 1024,
    alt: 'A nearly featureless, ivory-white Venus wrapped in opaque clouds, with a shaded left limb, against black space. The original camera frame clips part of the left edge.',
    caption: 'NASA / MESSENGER / G. Ugarkovic · natural color',
    credit: 'NASA / Johns Hopkins University Applied Physics Laboratory / Carnegie Institution of Washington; color composite by Gordan Ugarkovic. June 5, 2007. Red, green and blue visible-light filters approximate natural color. Original frame, unmodified. CC BY-NC-ND 3.0.',
    source: {
      title: 'The Planetary Society: Venus in natural color from MESSENGER; image by Gordan Ugarkovic, CC BY-NC-ND 3.0',
      url: 'https://www.planetary.org/space-images/venus_messenger_3447783055_7201387b94_o',
    },
    license: {
      title: 'CC BY-NC-ND 3.0',
      url: 'https://creativecommons.org/licenses/by-nc-nd/3.0/',
    },
  },
  introduction: {
    label: 'Venus',
    source: venusFacts,
    text: 'is the second planet from the Sun, almost Earth’s twin in size, and after the Moon the brightest object in the night sky. It is also the hottest planet: a dense carbon-dioxide atmosphere traps so much heat that the surface could melt lead.',
  },
  sections: [
    {
      id: 'rotation',
      title: 'A day longer than its year',
      source: { title: 'NASA: Venus orbital and rotation parameters', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html' },
      paragraphs: [{
        text: 'Venus orbits about 0.72 AU from the Sun, completing a year in 224.7 Earth days. It spins backward so slowly that one rotation takes 243 Earth days, longer than its year. Because spin and orbit oppose each other, sunrise to sunrise takes 116.75 Earth days, and the Sun rises in the west.',
      }, {
        text: 'From Earth, Venus shows phases and stays near the Sun in the sky. The evening and morning “stars” are the same planet, seen at different points in its orbit.',
      }],
    },
    {
      id: 'atmosphere',
      title: 'A crushing greenhouse',
      source: { title: 'NASA: Venus fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html' },
      paragraphs: [{
        text: 'Near the ground, the air is about 96.5% carbon dioxide and 3.5% nitrogen by volume. Its pressure of about 92 bar equals the water pressure some 900 m below the ocean surface. The mean temperature is 737 K (464 °C), and the dense atmosphere keeps nights almost as hot as days.',
      }, {
        label: 'Clouds.',
        source: {
          title: 'NASA: Venus in visible and ultraviolet light',
          url: 'https://www.nasa.gov/technology/nasa-studies-cubesat-mission-to-solve-venusian-mystery/',
        },
        text: 'Sulfuric-acid droplets form the global cloud layers. To human eyes the planet is pale yellowish-white, with very little visible detail. The prominent dark bands in ultraviolet images trace an absorber whose identity remains uncertain.',
      }, {
        label: 'Super-rotation.',
        source: { title: 'Wikipedia: Atmosphere of Venus', url: 'https://en.wikipedia.org/wiki/Atmosphere_of_Venus' },
        text: 'The cloud tops race around the planet in just four Earth days, about 60 times faster than the solid surface turns.',
      }],
    },
    {
      id: 'surface',
      title: 'Volcanoes under the clouds',
      source: {
        title: 'NASA / JPL: Magellan data reveals volcanic activity on Venus',
        url: 'https://www.jpl.nasa.gov/news/nasas-magellan-data-reveals-volcanic-activity-on-venus/',
      },
      paragraphs: [{
        text: 'Radar reveals volcanic plains, shield volcanoes and deformed highlands hidden beneath the clouds. In 2023, a reanalysis of Magellan images showed a vent on Maat Mons that changed shape and grew between February and October 1991: direct geological evidence of recent volcanic activity.',
      }],
    },
    {
      id: 'life',
      title: 'Phosphine in the clouds?',
      source: { title: 'Wikipedia: Life on Venus', url: 'https://en.wikipedia.org/wiki/Life_on_Venus' },
      paragraphs: [{
        text: 'In September 2020, astronomers reported phosphine in Venus’s clouds, a gas considered a possible sign of life. Several later studies disputed the detection, while others have reported further hints, so the question remains open.',
      }],
    },
    {
      id: 'interior',
      title: 'A twin without a magnetic field',
      source: {
        title: 'ESA: EnVision mission science, interior and core uncertainties',
        url: 'https://sci.esa.int/documents/34375/36249/EnVision_YB_final.pdf',
      },
      paragraphs: [{
        text: 'Like Earth, Venus probably has an iron-rich core beneath a rocky mantle and thin crust. But the core’s size and state are unknown, and so is how the planet sheds its internal heat.',
      }, {
        label: 'Magnetic field.',
        source: venusFacts,
        text: 'Unlike Earth, Venus has no internally generated magnetic field. The solar wind interacts with its upper atmosphere to create an induced magnetosphere.',
      }],
    },
    {
      id: 'probes',
      title: 'Surviving the surface, mapping from orbit',
      paragraphs: [{
        label: 'Mariner 2 (1962).',
        source: { title: 'NASA: Mariner 2', url: 'https://science.nasa.gov/mission/mariner-2/' },
        text: 'The first successful planetary flyby measured Venus’s intense thermal emission and found no strong intrinsic magnetic field.',
      }, {
        label: 'Venera landers.',
        source: { title: 'Wikipedia: Venera', url: 'https://en.wikipedia.org/wiki/Venera' },
        text: 'Venera 7 made the first soft landing on another planet in 1970 and radioed data from the surface for 23 minutes. Venera 9 returned the first surface photographs in 1975. In 1982, Venera 13 sent back the first color images and survived 127 minutes in the heat and pressure.',
      }, {
        label: 'Pioneer Venus (1978).',
        source: { title: 'NASA: Pioneer Venus 2 atmospheric probes', url: 'https://science.nasa.gov/mission/pioneer-venus-2/' },
        text: 'An orbiter and multiple entry probes studied the atmosphere, clouds and solar-wind interaction.',
      }, {
        label: 'Magellan (1990–1994 at Venus).',
        source: { title: 'NASA: Magellan', url: 'https://science.nasa.gov/mission/magellan/' },
        text: 'Radar mapped about 98% of the surface through the clouds, revealing volcanic and tectonic landforms.',
      }, {
        label: 'Venus Express (2006–2014 at Venus).',
        source: { title: 'ESA: Venus Express science highlights', url: 'https://www.esa.int/Science_Exploration/Space_Science/Venus_Express/Venus_Express_science_highlights' },
        text: 'ESA’s orbiter investigated atmospheric circulation, polar vortices and evidence of volcanic activity.',
      }, {
        label: 'Akatsuki (2015–2025 at Venus).',
        source: { title: 'JAXA: Akatsuki operations completed, September 18, 2025', url: 'https://global.jaxa.jp/press/2025/09/20250918-2_e.html' },
        text: 'JAXA’s weather orbiter studied cloud motion, super-rotation and large atmospheric waves. Contact was lost in April 2024; operations ended in September 2025.',
      }],
    },
    {
      id: 'history',
      title: 'Phases, transits and the size of the Solar System',
      paragraphs: [{
        text: 'Known since antiquity, Venus is the brightest planet in Earth’s sky. Its clouds kept the surface hidden from telescopes, so much of its geology became known only through spacecraft radar.',
      }, {
        label: '1610.',
        source: { title: 'NASA Goddard: Galileo’s observations of Venus', url: 'https://pwg.gsfc.nasa.gov/stargaze/Svenus.htm' },
        text: 'Galileo observed its changing phases, evidence that Venus orbits the Sun.',
      }, {
        label: '1639.',
        source: { title: 'NASA / JPL: First recorded observation of a Venus transit', url: 'https://www.jpl.nasa.gov/news/venus-transit-and-the-search-for-other-worlds/' },
        text: 'Jeremiah Horrocks and William Crabtree recorded Venus crossing the Sun. Later transit measurements helped establish the scale of the Solar System.',
      }, {
        label: '2012.',
        source: { title: 'Wikipedia: Transit of Venus', url: 'https://en.wikipedia.org/wiki/Transit_of_Venus' },
        text: 'The last transit of this century took place on June 5–6. The next pair will come in December 2117 and December 2125.',
      }],
    },
  ],
}

const earthFacts: InfoSource = {
  title: 'NASA: Earth facts',
  url: 'https://science.nasa.gov/earth/facts/',
}

const earthInfo: PlanetInfo = {
  image: {
    src: earthBlueMarble,
    width: 1041,
    height: 1041,
    alt: 'The fully illuminated Earth against black space, showing Africa, Arabia, Madagascar and Antarctica amid blue oceans and white clouds.',
    caption: 'NASA / Apollo 17 · Blue Marble · 1972',
    credit: 'NASA / Johnson Space Center / Apollo 17 crew. December 7, 1972. Hasselblad color photograph AS17-148-22727, taken during the journey to the Moon. NASA’s published scan, unmodified; not the later satellite-derived Blue Marble composite.',
    source: {
      title: 'NASA: Apollo 17 Blue Marble photograph (AS17-148-22727)',
      url: 'https://www.nasa.gov/image-article/apollo-17-blue-marble/',
    },
  },
  introduction: {
    label: 'Earth',
    source: earthFacts,
    text: 'is the third planet from the Sun, about 1 AU out, and the only world known to support life. Formed about 4.5 billion years ago, it is the only planet with liquid water on its surface and the densest in the Solar System.',
  },
  sections: [
    {
      id: 'surface',
      title: 'A surface that renews itself',
      source: earthFacts,
      paragraphs: [{
        text: 'Oceans cover about 71% of the surface. The crust and uppermost mantle form moving tectonic plates. Their boundaries host earthquakes, mountain building and much volcanic activity; erosion and the water cycle continually reshape the land.',
      }],
    },
    {
      id: 'magnetic-field',
      title: 'A magnetic shield and a thin sky',
      source: earthFacts,
      paragraphs: [{
        text: 'Motion in the electrically conducting outer core generates a global magnetic field. Its interaction with the solar wind forms the magnetosphere; energetic particles interacting with the upper atmosphere produce auroras.',
      }, {
        label: 'Air.',
        source: { title: 'NASA: Earth atmosphere reference composition', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
        text: 'Dry air is about 78% nitrogen and 21% oxygen by volume, with argon and trace gases making up most of the rest. Water vapor varies from place to place.',
      }],
    },
    {
      id: 'interior',
      title: 'Layers revealed by earthquakes',
      source: {
        title: 'USGS: The interior of the Earth, inferred from seismic waves and other measurements',
        url: 'https://pubs.usgs.gov/gip/interior/index.html',
      },
      paragraphs: [{
        text: 'A thin crust overlies a rocky mantle, a liquid iron-rich outer core and a solid inner core. Earthquake waves reveal these hidden layers: shear waves cannot travel through the liquid outer core.',
      }, {
        label: 'Mantle.',
        source: {
          title: 'USGS: Are tectonic plates floating on magma?',
          url: 'https://www.usgs.gov/faqs/are-tectonic-plates-floating-magma',
        },
        text: 'Most of the mantle is solid rock, which deforms and flows slowly over geological time. It is not a global ocean of magma beneath the plates.',
      }],
    },
    {
      id: 'orbit',
      title: 'Seasons and a retreating Moon',
      source: { title: 'NASA: Earth orbital and rotation parameters', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
      paragraphs: [{
        text: 'Earth orbits about 1 AU from the Sun. A revolution relative to the stars takes 365.256 days, while the seasonal year is about 365.242 days. A rotation relative to the stars takes 23 hours 56 minutes; the mean solar day is 24 hours.',
      }, {
        source: earthFacts,
        label: 'Seasons.',
        text: 'The axis is tilted about 23.4°. This changes sunlight’s angle and day length over the year, producing opposite seasons in the two hemispheres.',
      }, {
        label: 'Moon.',
        source: { title: 'NASA: Moon facts and origin', url: 'https://science.nasa.gov/moon/facts/' },
        text: 'The Moon probably formed after a Mars-sized body collided with the young Earth. Its rotation is synchronized with its orbit, keeping nearly the same hemisphere facing us, and it moves about 2.5 cm farther away each year.',
      }],
    },
    {
      id: 'probes',
      title: 'Watching Earth from orbit',
      paragraphs: [{
        label: 'TIROS-1 (1960).',
        source: { title: 'NASA: TIROS weather-satellite program', url: 'https://science.nasa.gov/mission/tiros/' },
        text: 'The first successful weather satellite demonstrated that cloud patterns could be monitored from orbit.',
      }, {
        label: 'Landsat 1 (1972).',
        source: { title: 'NASA: Landsat 1', url: 'https://science.nasa.gov/mission/landsat-1/' },
        text: 'Launched on July 23, it began a long record of repeated land observations used to study forests, agriculture, cities and other surface changes.',
      }, {
        label: 'Terra (launched 1999).',
        source: { title: 'NASA: Terra Earth Observing System mission', url: 'https://science.nasa.gov/mission/terra/' },
        text: 'Its instruments were designed to measure land, oceans, atmosphere and Earth’s energy balance together.',
      }, {
        label: 'DSCOVR / EPIC (2015).',
        source: { title: 'NASA: EPIC’s full sunlit-Earth observations from DSCOVR', url: 'https://www.nasa.gov/news-release/nasa-satellite-camera-provides-epic-view-of-earth/' },
        text: 'From near the Sun–Earth L1 point, EPIC imaged the sunlit disk in multiple filters. Its red, green and blue observations can be combined into natural-color views.',
      }],
    },
    {
      id: 'history',
      title: 'From Eratosthenes to the Pale Blue Dot',
      paragraphs: [{
        label: 'Around 240 BCE.',
        source: { title: 'NASA / JPL: Eratosthenes and measuring Earth’s circumference', url: 'https://pumas.nasa.gov/sites/default/files/examples/04_01_13_1.pdf' },
        text: 'Eratosthenes estimated Earth’s circumference using the Sun’s different noon angles at two locations and the distance between them.',
      }, {
        label: '1968.',
        source: { title: 'NASA: Apollo 8’s Earthrise, photographed by Bill Anders', url: 'https://science.nasa.gov/resource/apollo-8s-iconic-earthrise/' },
        text: 'On December 24, Apollo 8 astronaut Bill Anders photographed Earth above the lunar horizon, showing our home from another world.',
      }, {
        label: '1972.',
        source: { title: 'Wikipedia: The Blue Marble', url: 'https://en.wikipedia.org/wiki/The_Blue_Marble' },
        text: 'On December 7, the Apollo 17 crew photographed the fully lit Earth on their way to the Moon. The Blue Marble became one of the most reproduced images in history.',
      }, {
        label: '1990.',
        source: { title: 'Wikipedia: Pale Blue Dot', url: 'https://en.wikipedia.org/wiki/Pale_Blue_Dot' },
        text: 'On February 14, Voyager 1 photographed Earth from more than 6 billion km away. In the image, our planet is less than a pixel across.',
      }],
    },
  ],
}

const marsFacts: InfoSource = {
  title: 'NASA: Mars facts',
  url: 'https://science.nasa.gov/mars/facts/',
}

const marsInfo: PlanetInfo = {
  image: {
    src: marsNaturalColor,
    width: 1080,
    height: 1080,
    alt: 'A global color mosaic of Mars, showing its north polar cap, rust-colored plains, dark regions, Tharsis volcanoes and Valles Marineris.',
    caption: 'NASA / JPL-Caltech / USGS · Viking color mosaic',
    credit: 'NASA / JPL-Caltech / USGS. Viking Orbiter mosaic, published June 8, 1998 (PIA00407). Red- and violet-filter observations with a synthesized green channel. Bright regions approximate natural color; dark regions have stretched color and contrast. A processed composite, not a single photograph.',
    source: {
      title: 'NASA: Global Color Views of Mars (PIA00407)',
      url: 'https://science.nasa.gov/resource/global-color-views-of-mars/',
    },
  },
  introduction: {
    label: 'Mars',
    source: marsFacts,
    text: 'is the fourth planet from the Sun, a cold desert world about 1.5 AU out with a thin atmosphere and two small moons. Iron minerals in its rocks and dust give it a reddish color. Dry river valleys and lakebeds show that liquid water once flowed across its surface.',
  },
  sections: [
    {
      id: 'surface',
      title: 'The Solar System’s largest volcano',
      source: marsFacts,
      paragraphs: [{
        text: 'Olympus Mons, the largest volcano in the Solar System, covers an area about the size of Arizona. The canyon system Valles Marineris stretches about 3,870 km and plunges 9.3 km at its deepest. Polar deposits hold water ice, while ancient river channels, deltas and water-altered minerals record a wetter past.',
      }],
    },
    {
      id: 'atmosphere',
      title: 'An atmosphere lost to space',
      source: marsFacts,
      paragraphs: [{
        text: 'Mars has no global magnetic field today, although magnetized crust preserves traces of an ancient one. Its thin atmosphere is mostly carbon dioxide, with nitrogen and argon. Suspended dust can grow into planet-wide storms, and the sparse air allows large temperature swings.',
      }, {
        label: 'Thin air.',
        source: { title: 'Wikipedia: Atmosphere of Mars', url: 'https://en.wikipedia.org/wiki/Atmosphere_of_Mars' },
        text: 'Surface pressure averages only about 0.6% of Earth’s. MAVEN measurements show that Mars has lost about 65% of its original argon to space.',
      }],
    },
    {
      id: 'interior',
      title: 'Listening to marsquakes',
      source: {
        title: 'Bi et al. (2025): Seismic detection of a 600-km solid inner core in Mars',
        url: 'https://www.nature.com/articles/s41586-025-09361-9',
      },
      paragraphs: [{
        text: 'A rocky crust and mantle surround an iron-rich core. Marsquakes recorded by InSight revealed a liquid outer core, and in 2025 an analysis of those signals found evidence for a solid inner core about 613 km in radius.',
      }],
    },
    {
      id: 'orbit',
      title: 'Long seasons and a doomed moon',
      source: marsFacts,
      paragraphs: [{
        text: 'A year lasts about 687 Earth days at an average distance of 1.52 AU from the Sun. A solar day, or sol, lasts about 24 hours 40 minutes. Its tilted axis produces seasons; the elliptical orbit makes their lengths unequal.',
      }, {
        label: 'Phobos.',
        source: { title: 'NASA: Mars moons', url: 'https://science.nasa.gov/mars/moons/' },
        text: 'The larger moon creeps about 1.8 m closer to Mars every century. In about 50 million years, it will either crash into the planet or break up into a ring.',
      }],
    },
    {
      id: 'probes',
      title: 'Orbiters, landers, rovers and a helicopter',
      paragraphs: [{
        label: 'Mariner 4 (1965) and Mariner 9 (1971).',
        source: { title: 'NASA: Viking and the earlier Mariner missions', url: 'https://science.nasa.gov/mission/viking/viking-50-years-on-mars/' },
        text: 'Early flybys returned close-up images. Mariner 9 became the first spacecraft to orbit another planet, revealing vast volcanoes, canyons and evidence of ancient flowing water.',
      }, {
        label: 'Viking 1 and 2 (1976).',
        source: { title: 'NASA: Viking Project', url: 'https://science.nasa.gov/mission/viking/' },
        text: 'Paired orbiters and landers mapped Mars and returned photographs and measurements from the surface.',
      }, {
        label: 'Curiosity (landed 2012).',
        source: { title: 'NASA: Mars Science Laboratory / Curiosity', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
        text: 'Exploration of Gale Crater found evidence that ancient environments could have supported microbial life.',
      }, {
        label: 'InSight (2018–2022).',
        source: { title: 'NASA / JPL: InSight', url: 'https://www.jpl.nasa.gov/missions/insight/' },
        text: 'A stationary lander measured marsquakes to investigate the crust, mantle and core.',
      }, {
        label: 'Perseverance (landed 2021).',
        source: { title: 'NASA: Mars 2020 / Perseverance', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
        text: 'The rover investigates Jezero Crater’s ancient lake and delta, searches for signs of past microbial life and collects rock samples.',
      }, {
        label: 'Ingenuity (2021–2024).',
        source: { title: 'Wikipedia: Ingenuity (helicopter)', url: 'https://en.wikipedia.org/wiki/Ingenuity_(helicopter)' },
        text: 'Carried by Perseverance, the small helicopter made the first powered, controlled flight on another planet on April 19, 2021. It flew 72 times before rotor damage ended its mission.',
      }, {
        label: 'Sapphire Canyon (2025).',
        source: { title: 'NASA / JPL: Mars rover discovered potential biosignature, September 10, 2025', url: 'https://www.jpl.nasa.gov/news/nasa-says-mars-rover-discovered-potential-biosignature-last-year/' },
        text: 'In September 2025, NASA reported potential biosignatures in this Perseverance sample, taken in 2024 from a rock called Cheyava Falls. Its “leopard spots” could have formed with the help of microbes, but other explanations cannot yet be ruled out.',
      }],
    },
    {
      id: 'history',
      title: 'Canals that were not there',
      paragraphs: [{
        text: 'Recognized since antiquity, Mars appears as a reddish point in Earth’s sky. Close oppositions offer especially favorable views through telescopes.',
      }, {
        label: '1877.',
        source: { title: 'NASA: Discovery of Mars’s moons', url: 'https://science.nasa.gov/mars/moons/' },
        text: 'Asaph Hall discovered Phobos and Deimos, the planet’s two small moons.',
      }, {
        label: 'The “canals”.',
        source: { title: 'NASA: Triumph of Mariner 4', url: 'https://science.nasa.gov/mars/triumph-of-mariner-4/' },
        text: 'Lines mapped by Giovanni Schiaparelli were called canali, meaning channels. Their interpretation as artificial canals fueled speculation about civilizations; spacecraft later revealed a very different landscape.',
      }],
    },
  ],
}

const jupiterFacts: InfoSource = {
  title: 'NASA: Jupiter facts',
  url: 'https://science.nasa.gov/jupiter/jupiter-facts/',
}

const jupiterExploration: InfoSource = {
  title: 'NASA: Jupiter exploration',
  url: 'https://science.nasa.gov/jupiter/exploration/',
}

const jupiterInfo: PlanetInfo = {
  image: {
    src: jupiterNaturalColor,
    width: 1080,
    height: 1350,
    alt: 'A partly illuminated Jupiter against black space, with cream and reddish-brown cloud bands, white storm ovals and the Great Red Spot; the right limb fades into shadow.',
    caption: 'NASA / JPL / SSI · Cassini true-color mosaic',
    credit: 'NASA / JPL / Space Science Institute. Cassini narrow-angle camera, December 29, 2000 (PIA04866). A mosaic of 27 red-, green- and blue-filter images approximating the human-eye view; not a single exposure.',
    source: {
      title: 'NASA / JPL: Cassini Jupiter Portrait (PIA04866)',
      url: 'https://www.jpl.nasa.gov/images/pia04866-cassini-jupiter-portrait/',
    },
  },
  introduction: {
    label: 'Jupiter',
    source: jupiterFacts,
    text: 'is the fifth planet from the Sun and by far the largest, more than twice as massive as everything else orbiting the Sun combined. This gas giant of hydrogen and helium lies about 5.2 AU out, wrapped in cloud bands and long-lived storms. Its four largest moons form a small planetary system of their own.',
  },
  sections: [
    {
      id: 'storms',
      title: 'A storm wider than Earth',
      source: {
        title: 'NASA / ESA: Hubble’s Jupiter global map (2019)',
        url: 'https://science.nasa.gov/asset/hubble/jupiter-global-map-2019/',
      },
      paragraphs: [{
        text: 'The visible globe shows clouds, not terrain. Opposing jet streams separate light zones from darker belts.',
      }, {
        label: 'Great Red Spot.',
        source: { title: 'Wikipedia: Great Red Spot', url: 'https://en.wikipedia.org/wiki/Great_Red_Spot' },
        text: 'This giant anticyclone in the southern hemisphere has been watched since 1831. About a century ago it stretched some 40,000 km; by 2017 it had shrunk to about 16,350 km, still about 1.3 times Earth’s width. Giovanni Cassini’s “permanent spot” of 1665 may have been a different storm.',
      }],
    },
    {
      id: 'magnetic-field',
      title: 'The strongest magnet among the planets',
      source: jupiterFacts,
      paragraphs: [{
        text: 'Motion in the metallic-hydrogen interior powers a magnetic field 16 to 54 times as strong as Earth’s. Trapped charged particles create intense radiation belts and polar aurorae. Clouds include ammonia ice, ammonium hydrosulfide and water; pressure and temperature rise toward the interior. There is no solid surface to land on.',
      }],
    },
    {
      id: 'interior',
      title: 'Metallic hydrogen and a fuzzy core',
      source: jupiterFacts,
      paragraphs: [{
        text: 'Pressure compresses hydrogen into liquid, then an electrically conducting metallic state. Juno’s gravity measurements revealed a dilute, “fuzzy” core: much larger than expected, not solid, and mixed with the surrounding hydrogen.',
      }],
    },
    {
      id: 'orbit',
      title: 'The shortest day',
      source: { title: 'NASA: Jupiter fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html' },
      paragraphs: [{
        text: 'Jupiter orbits about 5.2 AU from the Sun, completing a year in 4,332.6 Earth days, nearly 12 Earth years. It spins faster than any other planet: its reference day lasts about 9 hours 56 minutes, although cloud rotation varies with latitude. The rapid spin visibly flattens its poles.',
      }],
    },
    {
      id: 'probes',
      title: 'From flybys to Juno',
      paragraphs: [{
        label: 'Pioneer 10 and 11 (1973–1974).',
        source: jupiterExploration,
        text: 'The first close encounters measured the radiation environment and returned images of Jupiter and its moons.',
      }, {
        label: 'Voyager 1 and 2 (1979).',
        source: jupiterExploration,
        text: 'Flybys revealed a faint ring system, active volcanoes on Io and intricate cloud patterns.',
      }, {
        label: 'Galileo (1995–2003 at Jupiter).',
        source: jupiterExploration,
        text: 'The first Jupiter orbiter repeatedly visited its moons and delivered a probe that measured the atmosphere during descent.',
      }, {
        label: 'Cassini (2000 flyby).',
        source: { title: 'NASA / JPL: Cassini Jupiter Portrait', url: 'https://www.jpl.nasa.gov/images/pia04866-cassini-jupiter-portrait/' },
        text: 'On its way to Saturn, it produced the most detailed global color portrait of Jupiter yet made.',
      }, {
        label: 'Juno (arrived 2016).',
        source: { title: 'NASA: Juno', url: 'https://science.nasa.gov/mission/juno/' },
        text: 'Close polar passes investigated the deep atmosphere, gravity and magnetic field, and imaged cyclones around the poles.',
      }, {
        label: 'JUICE (launched 2023).',
        source: { title: 'Wikipedia: Jupiter Icy Moons Explorer', url: 'https://en.wikipedia.org/wiki/Jupiter_Icy_Moons_Explorer' },
        text: 'ESA’s spacecraft is due to reach Jupiter in July 2031. After flybys of Europa, Ganymede and Callisto, it will settle into orbit around Ganymede.',
      }, {
        label: 'Europa Clipper (launched 2024).',
        source: { title: 'Wikipedia: Europa Clipper', url: 'https://en.wikipedia.org/wiki/Europa_Clipper' },
        text: 'NASA’s spacecraft is due to arrive in April 2030 and make dozens of close flybys of Europa to study its ice shell and the ocean beneath.',
      }],
    },
    {
      id: 'history',
      title: 'Moons, light and a comet crash',
      paragraphs: [{
        text: 'Bright enough to see without a telescope, Jupiter has been known since antiquity.',
      }, {
        label: '1610.',
        source: { title: 'NASA / JPL: Galileo’s observations of Jupiter’s moons', url: 'https://www.jpl.nasa.gov/edu/resources/gallery/exploring-jupiter/' },
        text: 'Galileo observed Io, Europa, Ganymede and Callisto orbiting Jupiter. These Galilean moons showed that celestial bodies could orbit a world other than Earth.',
      }, {
        label: '1676.',
        source: { title: 'Wikipedia: Rømer’s determination of the speed of light', url: 'https://en.wikipedia.org/wiki/R%C3%B8mer%27s_determination_of_the_speed_of_light' },
        text: 'Ole Rømer noticed that eclipses of Io came early when Earth was closer to Jupiter and late when it was farther away. The delay showed that light travels at a finite speed.',
      }, {
        label: '1994.',
        source: { title: 'Wikipedia: Comet Shoemaker–Levy 9', url: 'https://en.wikipedia.org/wiki/Comet_Shoemaker%E2%80%93Levy_9' },
        text: 'From July 16 to 22, fragments of Comet Shoemaker–Levy 9 struck Jupiter, the first collision between Solar System bodies ever observed directly. One impact left a dark spot more than 12,000 km across, and the scars lasted for months.',
      }],
    },
  ],
}

const saturnFacts: InfoSource = { title: 'NASA: Saturn facts', url: 'https://science.nasa.gov/saturn/facts/' }
const saturnExploration: InfoSource = { title: 'NASA: Saturn exploration', url: 'https://science.nasa.gov/saturn/exploration/' }

const saturnInfo: PlanetInfo = {
  image: {
    src: saturnNaturalColor, width: 1080, height: 559,
    alt: 'Saturn against black space, with soft gold cloud bands, its north pole facing the viewer and broad pale rings crossed by the planet’s shadow.',
    caption: 'NASA / JPL / SSI · Cassini natural-color view',
    credit: 'NASA / JPL-Caltech / Space Science Institute. Cassini wide-angle camera, October 28, 2016 (PIA21345). Red-, green- and blue-filter images combined into a natural-color view, looking about 25° above the ring plane. Full published frame, unmodified.',
    source: { title: 'NASA: So Far from Home (PIA21345)', url: 'https://science.nasa.gov/photojournal/so-far-from-home/' },
  },
  introduction: {
    label: 'Saturn', source: saturnFacts,
    text: 'is the sixth planet from the Sun, about 9.5 AU out, and the second-largest. It is the only planet less dense than water, and its icy rings reach up to 282,000 km from the planet. Its moons include haze-covered Titan and ocean-bearing Enceladus.',
  },
  sections: [{
    id: 'rings', title: 'Vast rings, ten meters thick', source: saturnFacts,
    paragraphs: [{ text: 'The rings are countless orbiting pieces of ice and rock, from dust-sized grains to chunks as big as a house; a few are as large as mountains. Although they span hundreds of thousands of kilometers, the main rings are typically only about 10 m thick. The Cassini Division separates the bright A and B rings.' }, {
      label: 'How old?', source: { title: 'Wikipedia: Rings of Saturn', url: 'https://en.wikipedia.org/wiki/Rings_of_Saturn' },
      text: 'Cassini’s measurements suggested the rings could be much younger than Saturn itself, but there is still no consensus on when they formed.',
    }],
  }, {
    id: 'atmosphere', title: 'A hexagon at the pole', source: saturnFacts,
    paragraphs: [{ text: 'Alternating winds organize the atmosphere into faint bands. Near the equator, winds in the upper atmosphere reach about 500 m/s (1,800 km/h), more than four times the strongest hurricane winds on Earth.' }, {
      label: 'Hexagon.', source: { title: 'Wikipedia: Saturn’s hexagon', url: 'https://en.wikipedia.org/wiki/Saturn%27s_hexagon' },
      text: 'Around the north pole, a jet stream forms a long-lived six-sided pattern. Each side is about 14,500 km long, more than Earth’s diameter.',
    }],
  }, {
    id: 'interior', title: 'Lighter than water', source: saturnFacts,
    paragraphs: [{ text: 'Saturn’s average density is lower than that of water. It is mostly hydrogen and helium: pressure turns hydrogen into liquid and, deeper down, an electrically conducting metallic state, with heavier material concentrated toward the center. The magnetic field generated inside guides charged particles into polar aurorae.' }],
  }, {
    id: 'orbit', title: 'Seasons seven years long',
    source: { title: 'NASA: Saturn fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html' },
    paragraphs: [{ text: 'Saturn orbits about 9.5 AU from the Sun, completing a year in 10,755.7 Earth days, about 29.5 Earth years. Its 26.73° axial tilt gives it seasons, each lasting about seven Earth years. The reference day lasts about 10 hours 39 minutes; cloud rotation varies with latitude, and the rapid spin flattens the poles.' }],
  }, {
    id: 'probes', title: 'Thirteen years with Cassini',
    paragraphs: [{
      label: 'Pioneer 11 (1979).', source: saturnExploration,
      text: 'The first spacecraft encounter measured Saturn’s magnetic environment and discovered the narrow F ring.',
    }, {
      label: 'Voyager 1 and 2 (1980–1981).', source: saturnExploration,
      text: 'Flybys resolved intricate ring structure and returned close views of the planet and its moons.',
    }, {
      label: 'Cassini (2004–2017 at Saturn).',
      source: { title: 'NASA: Cassini-Huygens', url: 'https://science.nasa.gov/mission/cassini/' },
      text: 'The first Saturn orbiter studied seasonal changes, rings and moons for 13 years, including water-ice plumes from Enceladus. The mission ended with a planned plunge into Saturn’s atmosphere on September 15, 2017.',
    }, {
      label: 'Huygens (2005).',
      source: { title: 'NASA / ESA: Huygens', url: 'https://science.nasa.gov/mission/cassini-huygens/' },
      text: 'Carried by Cassini, ESA’s probe descended through Titan’s atmosphere and landed on January 14, returning measurements and images from the surface.',
    }, {
      label: 'Dragonfly (planned).',
      source: { title: 'Wikipedia: Dragonfly (Titan space probe)', url: 'https://en.wikipedia.org/wiki/Dragonfly_(Titan_space_probe)' },
      text: 'NASA’s rotorcraft lander is scheduled to launch in July 2028 and reach Titan in 2034, flying between sites to study the moon’s organic chemistry.',
    }],
  }, {
    id: 'history', title: 'The rings that vanished',
    paragraphs: [{ text: 'Visible without a telescope, Saturn has been known since antiquity.' }, {
      label: '1610.', source: saturnExploration,
      text: 'Galileo saw apparent companions beside Saturn; his telescope could not resolve the rings clearly.',
    }, {
      label: '1612.', source: { title: 'Wikipedia: Rings of Saturn', url: 'https://en.wikipedia.org/wiki/Rings_of_Saturn' },
      text: 'The companions disappeared, puzzling Galileo: Earth had passed through the plane of the thin rings, leaving them edge-on and invisible. Such crossings recur every 13–15 years; the latest was on March 23, 2025.',
    }, {
      label: '1655.', source: saturnExploration,
      text: 'Christiaan Huygens recognized the ring surrounding Saturn and discovered Titan.',
    }, {
      label: '1675.', source: saturnExploration,
      text: 'Giovanni Domenico Cassini identified the gap now called the Cassini Division.',
    }],
  }],
}

const uranusFacts: InfoSource = { title: 'NASA: Uranus facts', url: 'https://science.nasa.gov/uranus/facts/' }
const neptuneFacts: InfoSource = { title: 'NASA: Neptune facts', url: 'https://science.nasa.gov/neptune/neptune-facts/' }
const voyager2: InfoSource = { title: 'NASA: Voyager 2', url: 'https://science.nasa.gov/mission/voyager/voyager-2/' }
const iceGiantColors: InfoSource = {
  title: 'University of Oxford: the visible colors of Uranus and Neptune (2024)',
  url: 'https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0',
}

const uranusInfo: PlanetInfo = {
  image: {
    src: uranusVoyager, width: 1080, height: 1080,
    alt: 'The pale blue-green disk of Uranus against black space, with a smooth, hazy atmosphere and a shaded limb.',
    caption: 'NASA / JPL-Caltech · Voyager 2 (1986)',
    credit: 'NASA / JPL-Caltech. Voyager 2 image of Uranus in 1986 (PIA18182). The full published frame is displayed unchanged; the source does not specify a complete color-calibration recipe.',
    source: { title: 'NASA: Uranus as seen by Voyager 2 (PIA18182)', url: 'https://science.nasa.gov/photojournal/uranus-as-seen-by-nasas-voyager-2/' },
  },
  introduction: {
    label: 'Uranus', source: uranusFacts,
    text: 'is the seventh planet from the Sun, about 19 AU out, and the first discovered with a telescope. This ice giant rolls around the Sun on its side, with faint rings and five major moons: Miranda, Ariel, Umbriel, Titania and Oberon.',
  },
  sections: [{
    id: 'orbit', title: 'A planet on its side', source: uranusFacts,
    paragraphs: [{ text: 'Uranus’s axis is tilted almost 98°, which may be the result of a collision with an Earth-sized object long ago. A year lasts about 84 Earth years. For nearly a quarter of each year, the Sun shines almost directly over one pole, while the other half of the planet endures a 21-year-long dark winter.' }, {
      label: 'A longer day.', source: { title: 'ESA / Hubble: Uranus’ rotation rate with unprecedented precision (2025)', url: 'https://esahubble.org/news/heic2503/' },
      text: 'In 2025, astronomers used more than a decade of Hubble observations of its aurorae to time one rotation at 17 hours 14 minutes 52 seconds, 28 seconds longer than Voyager 2’s estimate.',
    }],
  }, {
    id: 'atmosphere', title: 'The coldest planet', source: { title: 'Wikipedia: Uranus', url: 'https://en.wikipedia.org/wiki/Uranus' },
    paragraphs: [{ text: 'Uranus has the coldest planetary atmosphere in the Solar System, dipping to about 49 K (−224 °C), even though Neptune lies farther from the Sun. It gives off far less internal heat than the other giant planets. Methane absorbs red light, giving the atmosphere its blue-green tint.' }, {
      label: 'Colors.', source: iceGiantColors,
      text: 'Visible light reveals a hazy, low-contrast globe whose shade varies with season and viewing latitude. Infrared observations bring out cloud and ring detail that is much less prominent to the human eye.',
    }],
  }, {
    id: 'interior', title: 'Slushy ices and a lopsided magnet', source: uranusFacts,
    paragraphs: [{ text: 'Models place a hydrogen-and-helium envelope above hot, dense material rich in water, ammonia and methane, surrounding a rocky core. “Ice giant” describes these materials, not a frozen solid interior. The magnetic axis is tilted nearly 60° from the rotation axis and offset from the center, producing a lopsided magnetosphere.' }],
  }, {
    id: 'rings', title: 'Dark rings and Shakespearean moons', source: uranusFacts,
    paragraphs: [{ text: 'Uranus has 13 known rings. The inner nine are narrow and dark grey, and all share the planet’s sideways tilt. While most moons in the Solar System carry names from mythology, Uranus’s moons are named after characters from the works of William Shakespeare and Alexander Pope.' }],
  }, {
    id: 'probes', title: 'One flyby on an unusual day',
    paragraphs: [{ label: 'Voyager 2 (1986).', source: voyager2,
      text: 'The January 24 flyby returned close views of the major moons and measurements of the atmosphere, rings and magnetic field. It discovered ten additional moons. Voyager 2 remains the only spacecraft to have visited Uranus.',
    }, { label: 'A rare snapshot.', source: { title: 'NASA / JPL: Mining old Voyager 2 data solves several Uranus mysteries (2024)', url: 'https://www.jpl.nasa.gov/news/mining-old-data-from-nasas-voyager-2-solves-several-uranus-mysteries/' },
      text: 'A 2024 reanalysis found that Voyager 2 arrived just after a burst of solar wind had squeezed the magnetosphere, conditions that occur only about 4% of the time. Some of the oddities it recorded reflect that coincidence rather than Uranus’s usual state.',
    }],
  }, {
    id: 'history', title: 'Mistaken for a star, then a comet',
    paragraphs: [{ label: '1690.', source: { title: 'Wikipedia: Uranus', url: 'https://en.wikipedia.org/wiki/Uranus' },
      text: 'John Flamsteed recorded Uranus as an ordinary star and cataloged it as 34 Tauri.',
    }, { label: '1781.', source: { title: 'Wikipedia: Uranus', url: 'https://en.wikipedia.org/wiki/Uranus' },
      text: 'William Herschel spotted it on March 13 and first reported it as a comet. He named it Georgium Sidus after King George III; Johann Bode’s proposal, Uranus, eventually won out.',
    }, { label: '1977.', source: { title: 'NASA: Uranus exploration', url: 'https://science.nasa.gov/uranus/exploration/' },
      text: 'An occultation of a background star revealed the planet’s narrow ring system before Voyager’s encounter.',
    }],
  }],
}

const neptuneInfo: PlanetInfo = {
  image: {
    src: neptuneVoyager, width: 1080, height: 1079,
    alt: 'Neptune in a published blue Voyager composite, with the Great Dark Spot and bright clouds against black space.',
    caption: 'NASA / JPL · Voyager 2 color composite (1989)',
    credit: 'NASA / JPL. Voyager 2 narrow-angle camera, August 1989 (PIA01492), assembled from green- and orange-filter images. Historical color processing emphasizes blue and cloud contrast; this is not a calibrated human-eye view. Full published frame, unmodified.',
    source: { title: 'NASA: Neptune Full Disk View (PIA01492)', url: 'https://science.nasa.gov/photojournal/neptune-full-disk-view/' },
  },
  introduction: {
    label: 'Neptune', source: neptuneFacts,
    text: 'is the eighth and most distant planet from the Sun, about 30 AU out, and the first planet located through mathematical prediction. This ice giant has winds faster than 2,000 km/h, changing storms and faint rings. Its largest moon, Triton, orbits backward.',
  },
  sections: [{
    id: 'discovery', title: 'Found with pen and paper',
    source: { title: 'Wikipedia: Discovery of Neptune', url: 'https://en.wikipedia.org/wiki/Discovery_of_Neptune' },
    paragraphs: [{ text: 'Uranus kept drifting from its predicted path. Urbain Le Verrier calculated where an unseen planet must be, and on September 23, 1846, Johann Gottfried Galle and Heinrich d’Arrest found Neptune at the Berlin Observatory less than 1° from his prediction. John Couch Adams had made similar calculations in England. Galileo had seen Neptune in 1612 and 1613 but mistook it for a star.' }, {
      label: '1949.', source: { title: 'NASA: Neptune exploration', url: 'https://science.nasa.gov/neptune/exploration/' },
      text: 'Gerard Kuiper discovered Nereid, whose highly elongated orbit carries it far beyond Triton.',
    }],
  }, {
    id: 'storms', title: 'Storms that come and go', source: neptuneFacts,
    paragraphs: [{ text: 'Bright methane-ice clouds stream above deeper layers on winds faster than 2,000 km/h. Large dark storms form and later fade.' }, {
      label: 'Great Dark Spot.', source: { title: 'Wikipedia: Great Dark Spot', url: 'https://en.wikipedia.org/wiki/Great_Dark_Spot' },
      text: 'Voyager 2 found this storm, about the size of Earth, in 1989. When Hubble looked again in 1994, it had disappeared completely.',
    }, {
      label: 'Colors.', source: iceGiantColors,
      text: 'Reprocessed observations show a softer blue-green world, only slightly bluer than Uranus. The familiar deep-blue Voyager portraits emphasize color and contrast to reveal cloud structure.',
    }],
  }, {
    id: 'triton', title: 'A captured moon on a backward orbit',
    source: { title: 'Wikipedia: Triton (moon)', url: 'https://en.wikipedia.org/wiki/Triton_(moon)' },
    paragraphs: [{ text: 'Triton is the only large moon in the Solar System that orbits opposite to its planet’s rotation, a sign that it probably began as a dwarf planet in the Kuiper Belt before Neptune captured it. William Lassell discovered it on October 10, 1846, just 17 days after Neptune itself. Voyager 2 photographed geyser-like plumes rising from its icy surface.' }],
  }, {
    id: 'interior', title: 'More heat out than in',
    source: { title: 'Wikipedia: Neptune', url: 'https://en.wikipedia.org/wiki/Neptune' },
    paragraphs: [{ text: 'A deep hydrogen-and-helium atmosphere merges into hot, dense material rich in water, ammonia and methane above a rocky core. Neptune radiates about 2.6 times as much energy as it receives from the distant Sun.' }, {
      label: 'Magnetic field.', source: neptuneFacts,
      text: 'The magnetic axis is tipped about 47° from the rotation axis.',
    }, {
      label: 'Auroras (2025).', source: { title: 'STScI: NASA’s Webb captures Neptune’s auroras for first time, March 26, 2025', url: 'https://www.stsci.edu/contents/news-releases/2025/news-2025-104' },
      text: 'The James Webb Space Telescope captured bright auroral activity on Neptune for the first time.',
    }],
  }, {
    id: 'orbit', title: 'One orbit since its discovery',
    source: { title: 'NASA: Neptune fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html' },
    paragraphs: [{ text: 'Neptune orbits roughly 30 AU from the Sun, so far that sunlight takes about four hours to arrive. A circuit takes about 165 Earth years. Its reference day lasts 16.11 hours, based on Voyager radio measurements, and a 28.32° axial tilt produces long seasons.' }, {
      label: '2011.', source: { title: 'Wikipedia: Neptune', url: 'https://en.wikipedia.org/wiki/Neptune' },
      text: 'On July 11, Neptune completed its first full orbit since its discovery in 1846.',
    }, {
      label: 'Pluto.', source: { title: 'Wikipedia: Pluto', url: 'https://en.wikipedia.org/wiki/Pluto' },
      text: 'Seen from above, Pluto’s orbit appears to cross Neptune’s. A 3:2 resonance, three Neptune orbits for every two of Pluto’s, keeps the two from ever coming close.',
    }],
  }, {
    id: 'probes', title: 'Voyager 2’s last planet',
    paragraphs: [{ label: 'Voyager 2 (1989).', source: voyager2,
      text: 'The August 25 encounter revealed storms, ring arcs and new moons, and photographed Triton’s icy surface. Voyager 2 remains the only spacecraft to have visited Neptune.',
    }],
  }],
}

const planetInfo: Readonly<Record<string, PlanetInfo>> = { mercury: mercuryInfo, venus: venusInfo, earth: earthInfo, mars: marsInfo, jupiter: jupiterInfo, saturn: saturnInfo, uranus: uranusInfo, neptune: neptuneInfo }

export function renderPlanetInfo(container: HTMLElement, planetId: string): boolean {
  return renderObjectInfoContent(container, planetInfo[planetId] ?? smallBodyInfo(planetId))
}
