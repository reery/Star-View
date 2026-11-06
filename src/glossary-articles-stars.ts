import { IPAC_DWARFS, objectFigure, simbad } from './glossary-article-helpers'
import { subtypeId, wiki, type GlossaryArticle } from './glossary-index'
import { spectrum, stellarBalance } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  star: {
    also: ['Mass–luminosity_relation', 'Sun'],
    source: wiki('Star'), figure: objectFigure('star'),
    details: 'Almost every point of light you can see at night is a star, and each one is a sun of its own. They only look tiny because they are so far away: light from even the nearest takes more than four years to reach us.',
    sections: [
      { title: 'A balancing act', text: 'A star is a fight that never quite ends. Gravity tries to crush all that gas toward the center, while the heat inside pushes back. For most of a star’s life the two balance almost perfectly, which is why the Sun neither collapses nor flies apart.', figure: stellarBalance },
      { title: 'Why stars shine', text: 'Deep in the core, pressure and heat are so extreme that hydrogen atoms fuse into helium, releasing enormous energy. In the Sun’s core, at about 15 million °C, this has been going on for 4.6 billion years. That energy slowly works its way out and leaves the surface as light.' },
      { title: 'Mass decides everything', text: 'A star’s birth mass sets its temperature, color, brightness and lifespan, and how it finally dies. Heavy stars burn hot and blue and last only millions of years. Light ones glow a dim red and can outlast the present age of the universe many times over.' },
    ],
    interactive: { id: 'fate' },
    deeper: 'By mass the Sun is about 74% hydrogen and 24% helium, with everything else making up the last 2%. Stars range from about 0.08 solar masses, the minimum for hydrogen fusion, to well over 100. On the main sequence, luminosity grows roughly as mass to the power of 3.5, which is why massive stars use up their fuel so quickly.',
    related: ['sun', 'nuclear-fusion', 'stellar-evolution', 'subtype-main-sequence', 'spectral-type'],
  },
  sun: {
    also: ['Solar_radius', 'Solar_mass', 'Solar_luminosity'],
    source: wiki('Sun'), figure: objectFigure('star'),
    details: 'It is the only star close enough to study in fine detail, so most of what we know about other stars began here. Its light takes about eight minutes to reach Earth, and it holds about 99.86% of all the mass in the Solar System.',
    sections: [
      { title: 'The yardstick for every other star', text: 'Astronomers measure stars in Suns. A star “of 2 solar masses” is twice as heavy; one “of 100 solar luminosities” gives off a hundred times as much light. That is why you will see M☉, R☉ and L☉ throughout Star View.' },
      { title: 'An ordinary star that isn’t', text: 'The Sun is a G-type main-sequence star, often called a yellow dwarf, although seen from space it looks white. It is not small by galactic standards: it outshines about 85% of the stars in the Milky Way, most of which are dim red dwarfs.' },
      { title: 'Halfway through its life', text: 'At 4.6 billion years old, the Sun is roughly halfway through its hydrogen-burning life. In about 5 billion years it will swell into a red giant, then shed its outer layers and leave a white dwarf about the size of Earth.' },
    ],
    deeper: 'Surface temperature 5,772 K; radius 695,700 km; mass 1.988 × 10³⁰ kg; luminosity 3.828 × 10²⁶ W; absolute visual magnitude +4.83; apparent magnitude −26.74. It orbits the center of the Milky Way about once every 225–250 million years.',
    related: ['star', 'star-g', 'mass', 'radius', 'solar-luminosity'],
  },
  'star-o': {
    also: ['Orion_Nebula'],
    source: wiki('O-type_main-sequence_star'), figure: objectFigure('star', 'O0V'),
    details: 'These are the giants of the main sequence: over 15 times the mass of the Sun, with surfaces hotter than 30,000 K. Most of their light is ultraviolet, invisible to our eyes, and it is powerful enough to set whole clouds of gas glowing.',
    sections: [
      { title: 'Live fast, die young', text: 'An O-type star burns through its fuel in just a few million years, an eyeblink next to the Sun’s 10 billion. That is why they are found near where they formed: they die before they can wander far, usually in a supernova.' },
      { title: 'Rare but impossible to miss', text: 'Only about one main-sequence star in three million is O-type, yet their brilliance lets them be seen across galaxies. The glowing Orion Nebula is lit mainly by one young O-type star, Theta¹ Orionis C.' },
    ],
    interactive: { id: 'temperature' },
    related: ['spectral-type', 'star-b', 'hii_region', 'supernova'],
  },
  'star-b': {
    also: ['Pleiades', 'Scorpius–Centaurus_association'],
    source: wiki('B-type_main-sequence_star'), figure: objectFigure('star', 'B0V'),
    details: 'B-type stars have between about 2 and 16 times the Sun’s mass and surface temperatures from 10,000 to 30,000 K. Their spectra show helium, which takes a very hot star to reveal.',
    sections: [
      { title: 'Bright families in the sky', text: 'Many familiar bright stars are B-type, including most of the Pleiades cluster and the blue-white stars of the Scorpius–Centaurus group. They live for tens to hundreds of millions of years, so they mark out regions of young star formation.' },
    ],
    related: ['spectral-type', 'star-o', 'star-a', 'subtype-be-star'],
  },
  'star-a': {
    also: ['Stellar_classification'],
    source: wiki('A-type_main-sequence_star'), figure: objectFigure('star', 'A0V'),
    details: 'A-type stars have about 1.4 to 2.1 times the Sun’s mass and surfaces of about 7,500–10,000 K. Sirius A and Vega are the famous examples, and both look a crisp white to the eye.',
    sections: [
      { title: 'The strongest hydrogen lines', text: 'Their spectra show hydrogen lines stronger than any other class. This is a temperature effect: cooler stars do not excite hydrogen enough to make the lines, and in hotter ones most of the hydrogen is stripped of its electrons.' },
      { title: 'The zero point of brightness', text: 'Vega is so important that astronomers long used it to define magnitude zero. Many magnitudes you see in catalogs are still tied to A-type stars like it, because they make a stable and convenient reference.' },
    ],
    related: ['spectral-type', 'star-b', 'star-f', 'apparent-magnitude'],
  },
  'star-f': {
    also: ['Stellar_classification'],
    source: wiki('F-type_main-sequence_star'), figure: objectFigure('star', 'F0V'),
    details: 'F-type stars have about 1 to 1.4 times the Sun’s mass and surfaces of about 6,000–7,500 K. Procyon A is the closest bright example, and they shine for a few billion years, long enough for planets to develop.',
    sections: [
      { title: 'A dividing line inside stars', source: wiki('Kraft_break'), text: 'Around this class the insides of stars change. Hotter stars move energy outward mainly by radiation near the surface, while cooler stars have churning outer layers like boiling water. The change leaves a mark: stars above the line tend to spin much faster.' },
    ],
    related: ['spectral-type', 'star-a', 'star-g'],
  },
  'star-g': {
    also: ['Stellar_classification'],
    source: wiki('G-type_main-sequence_star'), figure: objectFigure('star', 'G2V'),
    details: 'G-type stars have about 0.9 to 1.1 times the Sun’s mass. The Sun is one, and so is Alpha Centauri A. Although often called yellow dwarfs, they look nearly white from space: Earth’s atmosphere makes the Sun look yellower.',
    sections: [
      { title: 'A long, steady life', text: 'A G-type star fuses hydrogen for about 10 billion years, shining more steadily than most of the small stars around it. That long, stable output makes them a favorite target in the search for Earth-like planets.' },
    ],
    interactive: { id: 'temperature' },
    related: ['sun', 'spectral-type', 'star-f', 'star-k', 'habitable-zone'],
  },
  'star-k': {
    also: ['Stellar_classification'],
    source: wiki('K-type_main-sequence_star'), figure: objectFigure('star', 'K0V'),
    details: 'K-type stars have about 0.6 to 0.9 times the Sun’s mass and surfaces of 3,900–5,300 K. Alpha Centauri B and Epsilon Eridani are nearby examples.',
    sections: [
      { title: 'A sweet spot for planets', text: 'K dwarfs are stable for 17 to 70 billion years, far longer than the universe has existed. They are also calmer than red dwarfs in their violent youth, so some researchers think they may be the best hosts of all for life.' },
    ],
    related: ['spectral-type', 'star-g', 'star-m', 'habitable-zone'],
  },
  'star-m': {
    source: wiki('Red_dwarf'), figure: objectFigure('star', 'M0V'),
    details: 'Red dwarfs make up about three quarters of the stars in the Milky Way, yet not one can be seen with the naked eye. The nearest star to the Sun, Proxima Centauri, is a red dwarf with an eighth of the Sun’s mass.',
    sections: [
      { title: 'Almost immortal', text: 'Their churning insides let them use nearly all their hydrogen, slowly. The smallest could shine for trillions of years, so not one red dwarf has yet died of old age.' },
      { title: 'Stormy neighbors', text: 'Many young red dwarfs erupt in fierce flares that could strip a close planet’s atmosphere. Because they are so dim, their habitable zones lie very close in, which leaves planets there exposed to that violence and often tidally locked.' },
    ],
    related: ['spectral-type', 'star-k', 'subtype-flare-star', 'tidal-locking', 'habitable-zone'],
  },
  brown_dwarf: {
    source: wiki('Brown_dwarf'), figure: objectFigure('brown_dwarf'),
    details: 'Brown dwarfs form like stars, from a collapsing cloud, but never gather enough mass to start fusing ordinary hydrogen. They start out warm from their collapse and spend the rest of time cooling, so most of their glow is infrared.',
    sections: [
      { title: 'The missing link', text: 'Their masses run from about 13 to about 80 times Jupiter’s. Oddly, nearly all are about the size of Jupiter, however heavy they are: adding mass squeezes them instead of inflating them.' },
      { title: 'Weather on a failed star', text: 'Cool brown dwarfs have atmospheres with clouds of iron and rock, and their brightness can change as these clouds rotate in and out of view. Their surfaces span from over 2,000 K to below room temperature.' },
    ],
    interactive: { id: 'fate' },
    deeper: 'Above about 13 Jupiter masses, deuterium, a heavy form of hydrogen, can fuse briefly. Above about 65 Jupiter masses, lithium burns too, which gives astronomers a test: a low-mass object still showing lithium is likely a brown dwarf. Spectral classes L, T and Y track their cooling.',
    related: ['sub_brown_dwarf', subtypeId('L-type'), subtypeId('T-type'), subtypeId('Y-type'), 'degenerate-matter'],
  },
  sub_brown_dwarf: {
    source: wiki('Sub-brown_dwarf'), figure: objectFigure('sub_brown_dwarf'),
    details: 'A sub-brown dwarf has the mass of a giant planet, below about 13 Jupiters, too light for even brief fusion. What sets it apart is the way it forms: straight from a collapsing gas cloud, as a star does, rather than in a disk around a star.',
    sections: [
      { title: 'Planet or failed star?', text: 'The line between these objects and giant planets is still debated, because one with no companion looks much the same as a planet thrown out of its system. Many drift alone through space, far from any star.' },
    ],
    related: ['brown_dwarf', subtypeId('Y-type'), 'exoplanet'],
  },
  [subtypeId('Low-mass star')]: {
    source: wiki('Red_dwarf'), reference: simbad('LM*'),
    details: 'Most stars in the galaxy fit this label, and most of those are red dwarfs. They use their fuel so sparingly that they are the universe’s most patient residents.',
    related: ['star-m', 'brown_dwarf', 'subtype-flare-star'],
  },
  [subtypeId('Wolf–Rayet')]: {
    source: wiki('Wolf–Rayet_star'), reference: simbad('WR*'), figure: spectrum,
    details: 'Their spectra are remarkable: broad, bright emission lines where most stars show dark ones. They show layers that were once deep inside the star, which is how astronomers can see the products of its fusion directly.',
    sections: [
      { title: 'Stars turning themselves inside out', text: 'A Wolf–Rayet star loses mass very quickly, and its surface can reach about 200,000 K. The wind blows bright nebulae around it. Few stages of a star’s life are so brief or so violent, and many end in a supernova.' },
    ],
    related: ['stellar-wind', 'supernova', 'bubble', 'spectrum'],
  },
  [subtypeId('Be star')]: {
    source: wiki('Be_star'), reference: simbad('Be*'), figure: spectrum,
    details: 'The “e” stands for emission lines, which come from the disk. Not the same as the young Herbig Ae/Be stars.',
    sections: [
      { title: 'Spinning close to breaking point', text: 'These stars rotate so fast that their equators nearly fling material into space, and a thin disk of gas forms around them. The disk causes the bright lines, and can vanish and return over years. Gamma Cassiopeiae, in the W of Cassiopeia, was the first to be noticed.' },
    ],
    related: ['star-b', 'spectrum', 'rotation', subtypeId('Herbig Ae/Be')],
  },
  [subtypeId('Emission-line star')]: {
    source: wiki('Astronomical_spectroscopy'), reference: simbad('Em*'), figure: spectrum,
    details: 'Most stars show dark lines in their spectra. These show bright ones too, which means hot, thin gas lies around the star: in a disk, a strong wind or a surrounding shell.',
    related: ['spectrum', subtypeId('Be star'), subtypeId('Wolf–Rayet')],
  },
  [subtypeId('Chemically peculiar')]: {
    also: ['Przybylski\'s_Star'],
    source: wiki('Chemically_peculiar_star'), reference: simbad('Pe*'),
    details: 'Most were not born that way. In calm, slowly rotating stars, some elements sink while others are pushed up by light, sorting the surface layers like sediment settling in still water.',
    sections: [
      { title: 'A star with an odd signature', text: 'Some show enormous excesses of rare elements like strontium or europium. Przybylski’s Star is the most extreme known case. Certain classes (labeled Ap) have strong magnetic fields, which gather these elements into patches.' },
    ],
    related: ['metallicity', 'spectrum', subtypeId('Alpha² CVn variable')],
  },
  [subtypeId('Carbon star')]: {
    also: ['R_Leporis', 'La_Superba'],
    source: wiki('Carbon_star'), reference: simbad('C*'),
    details: 'In the Sun it is the other way around, with more oxygen than carbon. That difference gives these stars the deepest red color in the sky.',
    sections: [
      { title: 'Soot factories', text: 'Most are aging giants that have dredged carbon up from their interiors. As they shed their outer layers they enrich space with carbon, some of which ends up in new stars, planets and living things. La Superba and R Leporis, “Hind’s Crimson Star”, are favorites of backyard observers.' },
    ],
    related: [subtypeId('Asymptotic giant branch'), subtypeId('S-type star'), 'nuclear-fusion'],
  },
  [subtypeId('S-type star')]: {
    source: wiki('S-type_star'), reference: simbad('S*'),
    details: 'Their spectra show strong bands of zirconium oxide, in place of the titanium oxide found in ordinary cool stars. They are a rare stage on the way from a red giant to a carbon star.',
    related: [subtypeId('Carbon star'), subtypeId('Red giant'), subtypeId('Asymptotic giant branch')],
  },
  [subtypeId('L-type')]: {
    source: wiki('L_dwarf'), reference: IPAC_DWARFS,
    details: 'Too cool for the old O-to-M sequence, these objects needed new letters. At these temperatures, the metal oxides of M stars condense into dust, leaving thick clouds in the atmosphere.',
    related: ['brown_dwarf', 'star-m', subtypeId('T-type')],
  },
  [subtypeId('T-type')]: {
    source: wiki('T-type_star'), reference: IPAC_DWARFS,
    details: 'Gliese 229 B, found in 1995, was the first confirmed T dwarf and the first brown dwarf known beyond any doubt. Their spectra look more like Jupiter’s than any star’s.',
    related: ['brown_dwarf', subtypeId('L-type'), subtypeId('Y-type')],
  },
  [subtypeId('Y-type')]: {
    source: wiki('Y-type_star'), reference: { label: 'Y dwarfs: NASA', url: 'https://apod.nasa.gov/apod/ap110830.html' },
    details: 'Y dwarfs are the coldest objects with their own spectral class. Some have atmospheres cool enough for water clouds, and they emit almost nothing except infrared, so most were unknown until the WISE space telescope found them in 2011.',
    related: ['brown_dwarf', 'sub_brown_dwarf', subtypeId('T-type')],
  },
}
