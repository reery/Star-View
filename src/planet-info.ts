import mercuryNaturalColor from './assets/planets/mercury-natural-color.jpg'
import mercuryHollows from './assets/planets/mercury-hollows.jpg'
import venusNaturalColor from './assets/planets/venus-natural-color.png'
import earthBlueMarble from './assets/planets/earth-blue-marble.jpg'

interface InfoSource {
  title: string
  url: string
}

interface InfoImage {
  src: string
  width: number
  height: number
  alt: string
  caption: string
  credit: string
  source: InfoSource
  license?: InfoSource
}

interface InfoParagraph {
  text: string
  label?: string
  source?: InfoSource
}

interface PlanetInfo {
  image: InfoImage
  introduction: InfoParagraph
  sections: {
    id: string
    title: string
    source?: InfoSource
    paragraphs: InfoParagraph[]
    image?: InfoImage
  }[]
}

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
    text: 'is the smallest planet and the closest to the Sun. This rocky world has an ancient, cratered surface and almost no atmosphere. Despite its proximity to the Sun, it is cooler than Venus: without a thick atmosphere to trap heat, its nights become intensely cold.',
  },
  sections: [
    {
      id: 'interior',
      title: 'Internal structure',
      source: {
        title: 'NASA: Mercury’s solid inner core',
        url: 'https://www.nasa.gov/solar-system/a-closer-look-at-mercurys-spin-and-gravity-reveals-the-planets-inner-solid-core/',
      },
      paragraphs: [{
        text: 'An unusually large metallic core extends to about 85% of Mercury’s radius, beneath a thin rocky mantle and crust. Gravity and rotation measurements support a solid inner core surrounded by liquid metal. Motion within the liquid core generates its magnetic field.',
      }],
    },
    {
      id: 'surface',
      title: 'Surface geology',
      source: mercuryFacts,
      paragraphs: [{
        text: 'Impact craters and ancient lava plains dominate the surface. The Caloris impact basin spans about 1,550 km. Long cliffs formed as the cooling planet contracted. Water ice survives in permanently shadowed polar craters.',
      }, {
        text: 'Bright, shallow depressions called hollows are among the youngest features. Loss of volatile material is a leading explanation for their formation, which remains uncertain.',
      }],
      image: {
        src: mercuryHollows,
        width: 1934,
        height: 1067,
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
      id: 'magnetic-field',
      title: 'Magnetic field and exosphere',
      source: mercuryFacts,
      paragraphs: [{
        text: 'Mercury has a global magnetic field, roughly 1% as strong as Earth’s at the surface. Its extremely thin exosphere is continually replenished by solar-wind particles and impacts releasing atoms from the ground. These atoms rarely collide, so they cannot retain heat like a substantial atmosphere.',
      }],
    },
    {
      id: 'orbit',
      title: 'Orbit',
      source: mercuryFacts,
      paragraphs: [{
        text: 'Its eccentric orbit takes it from about 0.31 to 0.47 AU from the Sun. Mercury turns three times during every two orbits: a year lasts 88 Earth days, but sunrise to sunrise takes 176. Near perihelion, the Sun can briefly reverse its apparent motion across the sky.',
      }],
    },
    {
      id: 'probes',
      title: 'Observation (Probes)',
      paragraphs: [{
        label: 'Mariner 10 (1974–1975).',
        source: { title: 'NASA: Mariner 10', url: 'https://science.nasa.gov/mission/mariner-10/' },
        text: 'Three flybys revealed the magnetic field and photographed nearly half the surface.',
      }, {
        label: 'MESSENGER (2011–2015).',
        source: { title: 'NASA: MESSENGER', url: 'https://science.nasa.gov/mission/messenger/' },
        text: 'The first orbiter mapped the planet, measured its composition and confirmed polar water ice.',
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
      title: 'Observation (History)',
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
    text: 'is the second planet from the Sun and almost Earth’s size. A dense carbon-dioxide atmosphere traps heat, making it the hottest planet in the Solar System. Its bright, opaque cloud cover conceals a rocky surface with volcanoes, mountains and vast lava plains.',
  },
  sections: [
    {
      id: 'interior',
      title: 'Internal structure',
      source: {
        title: 'ESA: EnVision mission science, interior and core uncertainties',
        url: 'https://sci.esa.int/documents/34375/36249/EnVision_YB_final.pdf',
      },
      paragraphs: [{
        text: 'Venus is thought to have an iron-rich core beneath a rocky mantle and thin crust. Its interior is much less constrained than Earth’s: the core’s size and solid or liquid state remain uncertain. How the planet loses internal heat is still being investigated.',
      }],
    },
    {
      id: 'surface',
      title: 'Surface geology',
      source: {
        title: 'NASA / JPL: Magellan data reveals volcanic activity on Venus',
        url: 'https://www.jpl.nasa.gov/news/nasas-magellan-data-reveals-volcanic-activity-on-venus/',
      },
      paragraphs: [{
        text: 'Radar reveals extensive volcanic plains, shield volcanoes and deformed highlands. The surface cannot be seen through the dayside clouds in ordinary visible-light photographs.',
      }, {
        text: 'A 2023 reanalysis of Magellan radar images found a vent near Maat Mons that changed shape and grew between February and October 1991. The changes provide evidence of volcanic activity during that interval; they do not establish which volcanoes are erupting today.',
      }],
    },
    {
      id: 'magnetic-field',
      title: 'Magnetic field and atmosphere',
      source: venusFacts,
      paragraphs: [{
        text: 'Venus has no detected Earth-like, internally generated global magnetic field. The solar wind interacts with its upper atmosphere to create an induced magnetosphere.',
      }, {
        label: 'Cloud cover.',
        source: {
          title: 'NASA: Venus in visible and ultraviolet light',
          url: 'https://www.nasa.gov/technology/nasa-studies-cubesat-mission-to-solve-venusian-mystery/',
        },
        text: 'Sulfuric-acid droplets form the global cloud layers. To human eyes the planet is pale yellowish-white, with very little visible detail. The prominent dark bands in ultraviolet images trace an absorber whose identity remains uncertain.',
      }, {
        label: 'Surface conditions.',
        source: { title: 'NASA: Venus fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html' },
        text: 'Near the ground, the atmosphere is about 96.5% carbon dioxide and 3.5% nitrogen by volume. Pressure is about 92 bar and the mean temperature is 737 K (464 °C). The dense atmosphere limits day-night temperature changes.',
      }],
    },
    {
      id: 'orbit',
      title: 'Orbit',
      source: { title: 'NASA: Venus orbital and rotation parameters', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html' },
      paragraphs: [{
        text: 'Its nearly circular orbit lies about 0.72 AU from the Sun, and a year lasts 224.7 Earth days. The solid planet rotates backward once every 243 Earth days. Because rotation opposes orbital motion, a solar day—from one sunrise to the next—lasts 116.75 Earth days; the Sun would rise in the west.',
      }, {
        text: 'From Earth, Venus shows phases and stays near the Sun in the sky. The evening and morning “stars” are the same planet, seen at different points in its orbit.',
      }],
    },
    {
      id: 'probes',
      title: 'Observation (Probes)',
      paragraphs: [{
        label: 'Mariner 2 (1962).',
        source: { title: 'NASA: Mariner 2', url: 'https://science.nasa.gov/mission/mariner-2/' },
        text: 'The first successful planetary flyby measured Venus’s intense thermal emission and found no strong intrinsic magnetic field.',
      }, {
        label: 'Venera landers.',
        source: { title: 'NASA: Archived Venera atmospheric measurements and surface photographs', url: 'https://nssdc.gsfc.nasa.gov/planetary/venus_data.html' },
        text: 'Soviet probes measured the atmosphere and reached the surface. Venera 9 returned surface photographs in 1975; Venera 13 and 14 returned color panoramas in 1982.',
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
      title: 'Observation (History)',
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
    text: 'is the third planet from the Sun and the only world known to support life. Formed about 4.5 billion years ago, this rocky planet has liquid-water oceans, a nitrogen-and-oxygen atmosphere and one natural moon.',
  },
  sections: [
    {
      id: 'interior',
      title: 'Internal structure',
      source: {
        title: 'USGS: The interior of the Earth, inferred from seismic waves and other measurements',
        url: 'https://pubs.usgs.gov/gip/interior/index.html',
      },
      paragraphs: [{
        text: 'A thin crust overlies a rocky mantle, a liquid iron-rich outer core and a solid inner core. Earthquake waves help reveal these hidden layers: shear waves do not travel through the liquid outer core.',
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
      id: 'surface',
      title: 'Surface geology',
      source: earthFacts,
      paragraphs: [{
        text: 'Oceans cover about 71% of the surface. The crust and uppermost mantle form moving tectonic plates. Their boundaries host earthquakes, mountain building and much volcanic activity; erosion and the water cycle continually reshape the land.',
      }, {
        label: 'Moon.',
        source: { title: 'NASA: Moon facts and origin', url: 'https://science.nasa.gov/moon/facts/' },
        text: 'The leading explanation for the Moon’s origin is a giant impact early in Earth’s history. Its rotation is synchronized with its orbit, keeping nearly the same hemisphere facing Earth.',
      }],
    },
    {
      id: 'magnetic-field',
      title: 'Magnetic field and atmosphere',
      source: earthFacts,
      paragraphs: [{
        text: 'Motion in the electrically conducting outer core generates a global magnetic field. Its interaction with the solar wind forms the magnetosphere; energetic particles interacting with the upper atmosphere produce auroras.',
      }, {
        label: 'Air and climate.',
        source: { title: 'NASA: Earth atmosphere reference composition and temperature', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
        text: 'Dry air is about 78% nitrogen and 21% oxygen by volume, with argon and trace gases making up most of the rest. Water vapor varies. The Specs temperature of 288 K is a fixed reference mean from NASA’s fact sheet, not a current climate measurement.',
      }],
    },
    {
      id: 'orbit',
      title: 'Orbit',
      source: { title: 'NASA: Earth orbital and rotation parameters', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
      paragraphs: [{
        text: 'Earth orbits about 1 AU from the Sun. A revolution relative to the stars takes 365.256 days, while the seasonal year is about 365.242 days. A rotation relative to the stars takes 23 hours 56 minutes; the mean solar day is 24 hours.',
      }, {
        source: earthFacts,
        label: 'Seasons.',
        text: 'The axis is tilted about 23.4°. This changes sunlight’s angle and day length over the year, producing opposite seasons in the two hemispheres.',
      }],
    },
    {
      id: 'probes',
      title: 'Observation (Probes)',
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
        text: 'Its instruments were designed to measure land, oceans, atmosphere and Earth’s energy balance together. MODIS observations contributed to the globe’s Blue Marble composite.',
      }, {
        label: 'DSCOVR / EPIC (2015).',
        source: { title: 'NASA: EPIC’s full sunlit-Earth observations from DSCOVR', url: 'https://www.nasa.gov/news-release/nasa-satellite-camera-provides-epic-view-of-earth/' },
        text: 'From near the Sun–Earth L1 point, EPIC imaged the sunlit disk in multiple filters. Its red, green and blue observations can be combined into natural-color views.',
      }],
    },
    {
      id: 'history',
      title: 'Observation (History)',
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
        source: { title: 'NASA: The Blue Marble, December 7, 1972', url: 'https://science.nasa.gov/resource/the-blue-marble/' },
        text: 'The Apollo 17 crew took the Blue Marble photograph shown above during their journey to the Moon. Unlike the globe’s satellite mosaic, it records a single view of Earth.',
      }],
    },
  ],
}

const planetInfo: Readonly<Record<string, PlanetInfo>> = { mercury: mercuryInfo, venus: venusInfo, earth: earthInfo }

function sourceLink(source: InfoSource): HTMLAnchorElement {
  const link = document.createElement('a')
  link.href = source.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.title = source.title
  return link
}

function infoParagraph(paragraph: InfoParagraph): HTMLParagraphElement {
  const element = document.createElement('p')
  if (paragraph.label) {
    const label = document.createElement('strong')
    if (paragraph.source) {
      const link = sourceLink(paragraph.source)
      link.textContent = paragraph.label
      label.append(link)
    } else label.textContent = paragraph.label
    element.append(label, ' ')
  }
  element.append(paragraph.text)
  return element
}

function infoFigure(image: InfoImage, hero = false): HTMLElement {
  const figure = document.createElement('figure')
  figure.className = `planet-info-figure${hero ? ' planet-info-hero' : ''}`
  const link = sourceLink(image.source)
  link.title = image.credit
  link.setAttribute('aria-label', `${image.source.title}. ${image.credit}`)
  const picture = document.createElement('img')
  picture.src = image.src
  picture.width = image.width
  picture.height = image.height
  picture.alt = image.alt
  picture.loading = 'lazy'
  picture.decoding = 'async'
  link.append(picture)
  const caption = document.createElement('figcaption')
  const attribution = sourceLink(image.source)
  attribution.title = image.credit
  attribution.setAttribute('aria-label', `${image.caption}. ${image.credit}`)
  attribution.textContent = image.caption
  caption.append(attribution)
  if (image.license) {
    const license = sourceLink(image.license)
    license.textContent = image.license.title
    caption.append(' · ', license)
  }
  figure.append(link, caption)
  return figure
}

export function renderPlanetInfo(container: HTMLElement, planetId: string): boolean {
  const info = planetInfo[planetId]
  container.replaceChildren()
  if (!info) return false
  container.append(infoFigure(info.image, true), infoParagraph(info.introduction))
  for (const entry of info.sections) {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.id = `planet-info-${entry.id}-heading`
    heading.className = 'card-subgroup-heading'
    heading.textContent = entry.title
    section.setAttribute('aria-labelledby', heading.id)
    if (entry.source) {
      const link = sourceLink(entry.source)
      link.className = 'planet-info-source'
      link.setAttribute('aria-label', `Source for ${entry.title}: ${entry.source.title}`)
      link.textContent = '↗'
      heading.append(link)
    }
    section.append(heading, ...entry.paragraphs.map(infoParagraph))
    if (entry.image) section.append(infoFigure(entry.image))
    container.append(section)
  }
  return true
}
