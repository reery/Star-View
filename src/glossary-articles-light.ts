import { wiki, type GlossaryArticle } from './glossary-index'
import { dustReddening } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  'apparent-magnitude': {
    also: ['Sun', 'Hipparchus'],
    source: wiki('Apparent_magnitude'),
    details: 'The scale runs backwards: smaller numbers mean brighter, and very bright objects go negative. The faintest stars visible to the naked eye are around +6. Sirius, the brightest star at night, is −1.46, and the Sun is about −27.',
    interactive: { id: 'magnitude' },
    sections: [
      { title: 'A 2,000-year-old system', text: 'In the 2nd century BCE, Hipparchus sorted stars by eye into six classes, with the brightest as “first magnitude”. That is why bigger numbers mean fainter. In 1856 Norman Pogson made it precise, keeping the old system’s feel.' },
      { title: 'Why it isn’t linear', text: 'Our eyes respond to ratios of brightness, not differences. So each step on the scale is a multiplication: 1 magnitude is about 2.5 times in brightness, and 5 magnitudes are exactly 100 times.' },
    ],
    deeper: 'm₁ − m₂ = −2.5 log₁₀(F₁/F₂), where F is the measured flux. Apparent magnitude depends on the passband (V for visual, G for Gaia, and so on), and it includes the effect of any dust along the way. Star View’s visibility guides put city skies near +4.5 and the naked-eye limit near +6.',
    related: ['absolute-magnitude', 'inverse-square-law', 'passband', 'extinction'],
  },
  'absolute-magnitude': {
    source: wiki('Absolute_magnitude'),
    details: 'Apparent magnitude mixes up how powerful a star is with how far away. Absolute magnitude removes distance by asking how bright every star would look from the same spot: 10 parsecs, or 32.6 light-years.',
    interactive: { id: 'magnitude' },
    sections: [
      { title: 'Lining them up fairly', text: 'From that distance the Sun would be an unremarkable star of magnitude +4.83, only just visible from a dark site. Rigel, by contrast, would be about −8, brighter than Venus ever gets. The numbers run the same way as before: lower means more powerful.' },
    ],
    deeper: 'M = m − 5 log₁₀(d/10 pc) − A, where A is extinction. The V label means the visual passband. Absolute bolometric magnitude counts all wavelengths, and the Sun’s is +4.74. A distance modulus, m − M, is another common way to write distance.',
    related: ['apparent-magnitude', 'bolometric-luminosity', 'parsec', 'hr-diagram'],
  },
  'bolometric-luminosity': {
    source: wiki('Luminosity'),
    details: 'A star’s true power output, not how bright it seems. “Bolometric” means every kind of light is counted, from X-rays to infrared. A red dwarf or a very hot star can emit most of its energy where your eye cannot see it, so it may be far more powerful than it looks.',
    sections: [
      { title: 'Size and heat', text: 'Power depends on two things: surface area and temperature. A cool star can be very luminous if it is enormous, and a very hot star can be faint if it is tiny. That explains how red giants and white dwarfs end up at opposite corners of the HR diagram.' },
    ],
    deeper: 'L = 4πR²σT⁴, the Stefan–Boltzmann law, where R is radius and T is effective temperature. Double the temperature and the power rises 16 times. Double the radius and it rises 4 times. Astronomers can seldom measure every wavelength directly, so a bolometric correction is usually added to a visual magnitude.',
    related: ['solar-luminosity', 'temperature', 'radius', 'absolute-magnitude', 'black-body'],
  },
  'solar-luminosity': {
    also: ['Sirius', 'Rigel', 'Proxima_Centauri'],
    source: wiki('Solar_luminosity'),
    details: 'A value of 2 L☉ means twice the Sun’s power. It lets you compare stars without enormous numbers: Sirius A gives off about 25 L☉, Rigel over 100,000 L☉, and Proxima Centauri only about 0.0016 L☉.',
    deeper: 'The nominal value is 3.828 × 10²⁶ watts, set by the International Astronomical Union in 2015 as a fixed conversion. The real Sun varies by about 0.1% over its 11-year activity cycle.',
    related: ['bolometric-luminosity', 'sun', 'mass', 'radius'],
  },
  'inverse-square-law': {
    source: wiki('Inverse-square_law'),
    details: 'Light spreads out as it travels, over a growing sphere. At double the distance the same light covers four times the area, so each patch receives a quarter as much. At ten times the distance it is a hundred times fainter.',
    interactive: { id: 'magnitude' },
    sections: [
      { title: 'A tool for measuring the universe', text: 'This simple law underlies much of astronomy. If you know a star’s real power and you measure how bright it looks, the law gives you its distance. It also explains why planets far from the Sun are so cold: Neptune, 30 times farther than Earth, gets about 900 times less sunlight.' },
    ],
    deeper: 'Flux F = L / (4πd²). A 100-fold fall in flux equals 5 magnitudes, so moving a star 10 times farther away makes it exactly 5 magnitudes fainter.',
    related: ['apparent-magnitude', 'absolute-magnitude', 'bolometric-luminosity', 'distance-ladder'],
  },
  'color-index': {
    also: ['Betelgeuse'],
    source: wiki('Color_index'),
    details: 'Measure a star through a blue filter and a yellow-green one, then subtract. The difference tells you its color, and so roughly its temperature, with no need for a spectrum. Small or negative values mean blue and hot, and large ones mean red and cool.',
    sections: [
      { title: 'A quick thermometer', text: 'The Sun’s B−V index is about +0.65. Hot Rigel is about −0.03, and red Betelgeuse is about +1.85. Filter measurements are fast, so color can be found for far fainter stars than spectra can reach, which is what makes large surveys possible.' },
    ],
    deeper: 'B−V = m_B − m_V, set so that Vega-like A0V stars are close to zero. Dust makes stars look redder, so a measured value often needs a correction called color excess. HR diagrams often plot this color in place of temperature.',
    related: ['passband', 'temperature', 'extinction', 'hr-diagram'],
  },
  passband: {
    source: wiki('Photometric_system'),
    details: 'A brightness measurement always covers some range of wavelengths. Filters fix that range, so that measurements from different telescopes can be compared. Magnitudes in different passbands can differ greatly for the same star: a red star is much brighter in red light than in blue.',
    sections: [
      { title: 'The alphabet of filters', text: 'The classic UBV system runs from ultraviolet through blue to visual (yellow-green, near what the eye sees). Infrared bands include J, H and K, used by the 2MASS survey. Gaia has its own very wide G band. This is why Star View labels which band a magnitude refers to.' },
    ],
    related: ['apparent-magnitude', 'color-index', 'gaia'],
  },
  extinction: {
    source: wiki('Extinction_(astronomy)'), figure: dustReddening,
    details: 'Starlight can pass through dust on its way to us. Dust scatters and absorbs some of the light, so the star looks fainter than it really is. Blue suffers more than red, so the star also looks redder, an effect called reddening, for much the same reason sunsets are red.',
    sections: [
      { title: 'A hidden galaxy', text: 'In the plane of the Milky Way, dust is so thick that visible light from the galaxy’s center is dimmed by about 30 magnitudes, a factor of a trillion. Infrared light passes through much more easily, and this is how astronomers can watch stars orbit the central black hole.' },
    ],
    deeper: 'A_V is the extinction in magnitudes in the V band. It is tied to reddening by A_V ≈ 3.1 × E(B−V) along typical lines of sight in the Milky Way. In the solar neighborhood, a typical value is about 1.8 magnitudes per kiloparsec, although it varies widely.',
    related: ['interstellar-medium', 'dust_sheet', 'dark_nebula', 'color-index', 'absolute-magnitude'],
  },
}
