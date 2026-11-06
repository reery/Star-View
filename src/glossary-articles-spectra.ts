import { wiki, type GlossaryArticle } from './glossary-index'
import { spectrum } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  'spectral-type': {
    also: ['Annie_Jump_Cannon', 'Cecilia_Payne-Gaposchkin', 'Betelgeuse'],
    source: wiki('Stellar_classification'),
    details: 'Spread a star’s light into a rainbow and dark lines appear. Their pattern depends mainly on temperature, so stars can be sorted into a sequence: O, B, A, F, G, K, M, from hottest to coolest. Generations of students remember it as “Oh Be A Fine Girl/Guy, Kiss Me”.',
    interactive: { id: 'temperature' },
    sections: [
      { title: 'How to read a label', text: 'Take the Sun’s type, G2V. “G” is the main class. The digit, from 0 to 9, refines it, with 0 the hottest. “V” is the luminosity class, which marks it as a main-sequence star. So Betelgeuse’s M1–M2 Ia–ab says cool and enormously luminous.' },
      { title: 'The Harvard computers', text: 'The system came from a team of women at Harvard Observatory around 1900. Annie Jump Cannon classified hundreds of thousands of stars by eye, and reordered the letters into today’s sequence. Cecilia Payne then showed in 1925 that the differences come from temperature, and that stars are mostly hydrogen.' },
    ],
    deeper: 'Beyond M come the L, T and Y classes of cooler objects, mostly brown dwarfs. Additions mark oddities: “e” for emission lines, “p” for peculiar, “m” for strong metal lines. Sirius A’s A0mA1Va means its hydrogen lines look like an A0 star’s and its metal lines like an A1 star’s, with a Va luminosity class.',
    related: ['luminosity-class', 'temperature', 'spectrum', 'hr-diagram', 'star-g'],
  },
  'luminosity-class': {
    source: wiki('Stellar_classification'),
    details: 'Two stars can have the same temperature but vastly different sizes. Giants have thin, puffed-up atmospheres, which makes their spectral lines look sharper than those of dense dwarfs. A Roman numeral after the spectral type records this difference.',
    interactive: { id: 'hr', variant: 'giants' },
    sections: [
      { title: 'The classes', text: 'I marks supergiants (with Ia as the brightest), II bright giants, III giants, IV subgiants and V main-sequence dwarfs. VI subdwarfs are also used. Star View uses the numeral to label sub-types: so a star classed K0III appears as a giant, and one classed K0V as a dwarf.' },
    ],
    related: ['spectral-type', 'hr-diagram', 'subtype-main-sequence', 'subtype-giant', 'subtype-supergiant'],
  },
  'hr-diagram': {
    source: wiki('Hertzsprung–Russell_diagram'),
    details: 'This is the most important chart in stellar astronomy, devised around 1910 by Ejnar Hertzsprung and Henry Norris Russell. Plot stars by temperature and true brightness, and they do not scatter at random. Most fall in a few clear groups, and those groups tell the story of how stars live.',
    interactive: { id: 'hr' },
    sections: [
      { title: 'Reading the chart', text: 'Temperature runs from hot on the left to cool on the right, which surprises newcomers. Power runs from faint at the bottom to bright at the top. A star’s place on the chart therefore also reveals its size: the top right holds huge cool stars, and the bottom left holds tiny hot ones.' },
      { title: 'A chart of time', text: 'A star moves around the chart as it ages. The Sun will leave the main sequence, climb up to the right as a red giant, then cross to the lower left as a white dwarf. Clusters show this especially well, since all their stars have the same age.' },
    ],
    deeper: 'Observers often plot color index against absolute magnitude instead, which is called a color–magnitude diagram. The Graphs panel and each star’s spectral card in Star View show real catalog stars in this form. A Kiel diagram replaces luminosity with surface gravity, which comes directly from a star’s spectrum.',
    related: ['subtype-main-sequence', 'stellar-evolution', 'luminosity-class', 'star-cluster', 'absolute-magnitude'],
  },
  spectrum: {
    also: ['Auguste_Comte', 'Helium', 'Fraunhofer_lines'],
    source: wiki('Astronomical_spectroscopy'), figure: spectrum,
    details: 'Pass sunlight through a prism and you get a rainbow, crossed by many fine dark lines. Each line marks a wavelength absorbed by a certain atom or molecule in the star’s atmosphere. It is a chemical barcode you can read across trillions of kilometers.',
    sections: [
      { title: 'Knowledge we once thought impossible', text: 'In the 1830s, the philosopher Auguste Comte wrote that we would never know what stars are made of. Decades later, spectra showed exactly that. Helium was even discovered in the Sun’s spectrum in 1868, before it was found on Earth, which is why it is named after the Greek word for Sun.' },
      { title: 'Dark lines, bright lines', text: 'Cool gas in front of a hot source absorbs light, which gives dark lines. Hot, thin gas on its own emits at those same wavelengths, which gives bright lines. Nebulae show bright lines, and most stars show dark ones. Stars with winds or disks can show both.' },
    ],
    deeper: 'Line strengths reveal temperature and chemical makeup. Line shapes reveal pressure, rotation and magnetic fields. Line positions reveal motion through the Doppler effect. The Sun’s lines are often called Fraunhofer lines, after Joseph von Fraunhofer, who mapped them in 1814.',
    related: ['spectral-type', 'doppler-effect', 'metallicity', 'black-body'],
  },
  'black-body': {
    also: ['Cosmic_microwave_background'],
    source: wiki('Black-body_radiation'),
    details: 'Heat anything enough and it glows. A piece of iron goes from dull red to orange to white as it heats up. A black body is the ideal case: an object whose glow depends only on its temperature. Stars are not perfect ones, but they come close.',
    interactive: { id: 'temperature' },
    sections: [
      { title: 'Why hot stars are blue', text: 'As temperature rises, the peak of the glow moves to shorter wavelengths, so hotter stars look bluer. The total amount of light climbs steeply too. Green stars do not exist: a star peaking in green also gives off plenty of red and blue, and the mix looks white to the eye.' },
      { title: 'Why we feel it too', text: 'You glow as well, though in infrared. That is what thermal cameras see. The same physics explains the faint afterglow of the Big Bang, at about 2.7 K, the most perfect black body ever measured.' },
    ],
    deeper: 'Wien’s law gives the peak wavelength: λ = 2,898 µm·K / T, so the Sun at 5,772 K peaks near 502 nm. The Stefan–Boltzmann law gives the power per unit area as σT⁴. Max Planck’s law for the full curve, from 1900, launched quantum physics.',
    related: ['temperature', 'bolometric-luminosity', 'spectral-type', 'spectrum'],
  },
  'doppler-effect': {
    also: ['51_Pegasi_b', 'Doppler_spectroscopy'],
    source: wiki('Doppler_effect'),
    details: 'Think of an ambulance siren: high pitched coming toward you, lower going away. Light does the same. A star moving toward us has its light squeezed toward blue, and one moving away has its light stretched toward red.',
    interactive: { id: 'velocity' },
    sections: [
      { title: 'Why spectra matter here', text: 'A star’s overall color barely changes at these speeds. What gives the motion away are spectral lines, which act as markers at exactly known wavelengths. When the lines of hydrogen sit slightly to the red of where they should be, the star is moving away from us.' },
      { title: 'Finding unseen worlds', text: 'A planet tugs on its star, making it wobble very slightly. In 1995, this wobble revealed 51 Pegasi b, the first planet found around a Sun-like star. Early searches could detect wobbles of about 7 m/s, and Earth’s own pull moves the Sun by only 0.1 m/s, which is the target for the best instruments today.' },
    ],
    deeper: 'For speeds much lower than light, Δλ/λ = v/c. A star moving at 30 km/s shifts a line at 500 nm by only 0.05 nm. Pure motion across the sky gives almost no shift. Near the speed of light, relativity adds further corrections.',
    related: ['radial-velocity', 'redshift', 'spectrum', 'subtype-spectroscopic-binary', 'exoplanet'],
  },
  redshift: {
    also: ['JADES-GS-z14-0'],
    source: wiki('Redshift'),
    details: 'Redshift can happen in three ways: a source moving away, the stretching of space itself as the universe expands, or light climbing out of strong gravity. Each stretches the wavelength in a way we can measure. The opposite, a shift toward blue, is called blueshift.',
    interactive: { id: 'velocity' },
    sections: [
      { title: 'The discovery of expansion', text: 'In the 1920s, Edwin Hubble and others found that distant galaxies have redshifts that grow with distance. The universe is expanding. Almost all stars in Star View are too near for this to matter: their shifts come from their own motion, and it can go either way.' },
    ],
    deeper: 'z = Δλ / λ. At small values, z ≈ v/c. The light from the most distant galaxies known has been stretched to well over 10 times its original wavelength, with values above z = 14 measured by the James Webb Space Telescope.',
    related: ['doppler-effect', 'radial-velocity', 'distance-ladder'],
  },
}
