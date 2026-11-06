import { wiki, type GlossaryArticle } from './glossary-index'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  temperature: {
    source: wiki('Effective_temperature'),
    details: 'A star has no solid surface, and its temperature varies with depth. So astronomers ask a simpler question: what temperature would a perfect glowing object need, to give off this much light from each square meter? For the Sun, the answer is 5,772 K.',
    interactive: { id: 'temperature' },
    sections: [
      { title: 'Color tells you', text: 'Stars are like hot metal: red is cooler than white, and white is cooler than blue. This feels backward to anyone who thinks of red as hot and blue as cold. A cool red dwarf is about 3,000 K, and a blue O-type star can exceed 30,000 K. Kelvin starts at absolute zero, so K and °C differ by about 273.' },
    ],
    deeper: 'Effective temperature is defined by L = 4πR²σT⁴, using the star’s luminosity and radius. In practice it is usually derived from spectra or colors. It describes the visible layer, not the core, which is far hotter: about 15 million K for the Sun.',
    related: ['black-body', 'spectral-type', 'bolometric-luminosity', 'color-index'],
  },
  mass: {
    also: ['R136a1', 'Star'],
    source: wiki('Solar_mass'),
    details: 'The Sun has about 333,000 times the mass of Earth. Mass is the most important property a star has, because it sets almost everything else about it, from brightness to how the star will die. A value of 0.5 M☉ means half the Sun’s mass.',
    interactive: { id: 'fate' },
    sections: [
      { title: 'How do you weigh a star?', text: 'You cannot put one on a scale, but you can watch it pull on something. The speed and size of an orbit reveal how much mass drives it, so binaries give the most reliable star masses. For single stars, astronomers usually rely on models or on patterns inside the star.' },
    ],
    deeper: 'One solar mass is about 1.988 × 10³⁰ kg. Stars span from about 0.08 M☉ to well over 100 M☉, with R136a1 among the heaviest known. Values in Star View are greyed when they come from models rather than from direct measurements.',
    related: ['keplers-laws', 'binary', 'radius', 'modelled-value', 'stellar-evolution'],
  },
  radius: {
    also: ['Sun', 'List_of_largest_stars'],
    source: wiki('Solar_radius'),
    details: 'The Sun’s radius is 695,700 km, about 109 times Earth’s. A star of 2 R☉ is twice as wide as the Sun, and so has 8 times its volume. Stars range enormously: white dwarfs are about Earth-sized, and red supergiants can reach over 1,000 R☉.',
    sections: [
      { title: 'Measuring a point of light', text: 'Nearly all stars look like dots even through big telescopes, so sizes are usually calculated. Knowing a star’s power and temperature gives its radius. Astronomers can measure some directly by combining telescopes, or by timing eclipses in binary stars.' },
    ],
    deeper: 'R = √(L / 4πσT⁴), which is the standard route from catalog values. Stars have no sharp edge, so the radius refers to the visible surface, the photosphere. That is a nominal convention, and the very largest stars have fuzzy boundaries with quite uncertain sizes.',
    related: ['mass', 'apparent-size', 'bolometric-luminosity', 'temperature'],
  },
  'photosphere-gravity': {
    also: ['Sun'],
    source: wiki('Surface_gravity'),
    details: 'Gravity at the surface depends on both mass and size. The Sun’s surface pull is about 274 m/s², or 28 times Earth’s. Red giants have huge radii, so theirs is weak, even with more mass than the Sun. White dwarfs have enormous gravity because they are so tiny. The photosphere is the visible layer that gives off a star’s light.',
    sections: [
      { title: 'A clue in the light', text: 'Lower gravity means a thinner atmosphere, which makes spectral lines sharper. That lets astronomers tell a giant from a dwarf of the same temperature, without knowing its distance.' },
    ],
    deeper: 'g = GM/R², measured in m/s². Astronomers usually quote log g, the base-10 logarithm of gravity in cm/s²: the Sun is 4.44, a typical giant about 2–3, and a white dwarf about 8. Star View’s Mass card derives this from catalog mass and radius, and it leaves out rotation and radiation pressure. Compact remnants need other treatment.',
    related: ['mass', 'radius', 'luminosity-class', 'spectrum'],
  },
  metallicity: {
    source: wiki('Metallicity'),
    details: 'To an astronomer, all elements heavier than helium are “metals”, even oxygen and carbon. The Big Bang made almost only hydrogen and helium, and the rest came later from stars. So metallicity reveals how much earlier stars enriched the gas a star formed from: in general, older stars have less.',
    sections: [
      { title: 'A star’s birth certificate', text: 'Metal-rich stars formed later and tend to live in a galaxy’s disk. Metal-poor stars formed earlier and lie mostly in the halo. Giant planets are also found more often around metal-rich stars, a pattern that helped shape ideas about how planets form.' },
    ],
    deeper: 'Written [Fe/H] or [M/H], it compares a star’s ratio to the Sun’s on a logarithmic scale. 0 is solar, +1 is ten times solar, and −1 is one tenth. The units are called dex. By mass, the Sun’s metal content is only about 1.3%.',
    related: ['dex', 'interstellar-medium', 'nuclear-fusion', 'age', 'exoplanet'],
  },
  age: {
    also: ['Sun', 'Gyrochronology'],
    source: wiki('Stellar_age_estimation'),
    details: 'Stars do not change much for most of their lives, and they carry no birth date. Of all the basic properties, age is among the hardest to pin down. Myr means million years, and Gyr means billion years. The Sun’s age, 4.6 Gyr, is well known only because we can date Solar System meteorites.',
    sections: [
      { title: 'Different clocks for different stars', text: 'A cluster’s stars share an age, which can be read from the HR diagram. Single stars are harder. Astronomers can compare one with models, or use the fact that stars spin more slowly as they get older, a method called gyrochronology.' },
    ],
    deeper: 'Isochrone fitting compares temperature and luminosity against models of known age, and works best for evolved stars. Uncertainty often runs to tens of percent, or more, for ordinary single main-sequence stars.',
    related: ['star-cluster', 'hr-diagram', 'rotation', 'stellar-evolution', 'measurement-uncertainty'],
  },
  rotation: {
    also: ['Sun', 'Solar_rotation'],
    source: wiki('Stellar_rotation'),
    details: 'Stars spin, and at very different rates. The Sun takes about 26 days at its equator and about 34 near its poles, because it is not solid. Some young hot stars spin in under a day, and some pulsars turn hundreds of times every second.',
    sections: [
      { title: 'Slowing down with age', text: 'Young Sun-like stars spin fast, and lose speed as their winds carry away spin. Spin also powers magnetic activity, so fast stars tend to have more spots and flares. Very rapid rotators even bulge at the equator.' },
      { title: 'Measuring a spin', text: 'Starspots rotating into view make the light rise and fall, which gives the period directly. Rotation also broadens spectral lines. For a pulsar, each pulse marks one turn, so the period can be timed with extraordinary precision.' },
    ],
    related: ['pulsar', 'subtype-rotating-variable', 'orbital-period', 'tidal-locking', 'age'],
  },
  dex: {
    source: wiki('Decimal_exponent'),
    details: 'A dex is shorthand for one power of ten. If a value differs by 1 dex, it is ten times bigger or smaller. A difference of 2 dex means a hundred times, and 0.3 dex means about twice. It is mostly used for metallicity, as when a star is written as “−0.5 dex”, meaning about a third of the Sun’s metal content.',
    related: ['metallicity', 'apparent-magnitude', 'measurement-uncertainty'],
  },
}
