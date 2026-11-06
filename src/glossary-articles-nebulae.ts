import { objectFigure } from './glossary-article-helpers'
import { wiki, type GlossaryArticle } from './glossary-index'
import { dustReddening } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  reflection_nebula: {
    source: wiki('Reflection_nebula'), figure: objectFigure('reflection_nebula'),
    details: 'A reflection nebula does not glow on its own. Its dust scatters the light of nearby stars toward us, much as fog glows around a streetlight. The stars are not quite hot enough to make the gas glow, as an H II region does.',
    sections: [
      { title: 'Why they are blue', text: 'Tiny dust grains scatter blue light better than red, for the same reason that Earth’s sky is blue. The wisps around the Pleiades are the best-known example and they look a soft blue in photographs.' },
    ],
    related: ['dark_nebula', 'hii_region', 'dust_sheet', 'interstellar-medium'],
  },
  hii_region: {
    source: wiki('H_II_region'), figure: objectFigure('hii_region'),
    details: 'Young, hot stars flood the gas around them with ultraviolet light, tearing electrons off the hydrogen atoms. As electrons fall back, the hydrogen glows, usually a deep pink-red. The Orion Nebula, visible to the naked eye, is the nearest large example.',
    sections: [
      { title: 'Nurseries that destroy themselves', text: 'New stars are still forming in these clouds, yet the fierce radiation and winds slowly blow the clouds away. After a few million years, only a young cluster of stars is left behind. Astronomers use H II regions to trace star formation across other galaxies, where they stand out as strings of pink beads along spiral arms.' },
    ],
    deeper: 'H II is astronomers’ notation for ionized hydrogen (H I is neutral). The red color comes mainly from the H-alpha line at 656.3 nm. Emission lines from oxygen and other elements reveal the gas’s temperature, usually around 10,000 K, and its chemical makeup.',
    related: ['molecular_cloud', 'star-o', 'spectrum', 'star-cluster'],
  },
  planetary_nebula: {
    also: ['Helix_Nebula'],
    source: wiki('Planetary_nebula'), figure: objectFigure('planetary_nebula'),
    details: 'Despite the name, these have nothing to do with planets. Through small early telescopes, some looked like round disks, a bit like Uranus. In fact they are the cast-off outer layers of a dying Sun-like star, lit up by the hot core left behind.',
    sections: [
      { title: 'A fleeting beauty', text: 'They last only about 10,000 years before fading, a blink for a star. The Sun should make a faint one. Their complex rings and lobes are likely shaped by companions and magnetic fields. The Ring Nebula and the Helix Nebula are favorite targets for amateur astronomers.' },
    ],
    related: ['white_dwarf', 'subtype-asymptotic-giant-branch', 'stellar-evolution'],
  },
  molecular_cloud: {
    source: wiki('Molecular_cloud'), figure: objectFigure('molecular_cloud'),
    details: 'These are the coldest, densest parts of space, at just 10–20 K above absolute zero. Dust blocks out starlight, which lets hydrogen atoms pair up into molecules. Gravity then gathers clumps within the cloud, and these clumps become stars.',
    sections: [
      { title: 'Where everything starts', text: 'Giant clouds can hold millions of solar masses, and they span up to hundreds of light-years. They also hold water, alcohol and other molecules, some of which may end up on new planets. The closest big star-forming clouds lie in Taurus and Orion.' },
    ],
    related: ['dark_nebula', 'hii_region', 'subtype-young-stellar-object', 'interstellar-medium'],
  },
  bubble: {
    source: wiki('Superbubble'), figure: objectFigure('bubble'),
    details: 'Powerful stellar winds or supernova explosions push the thin gas of space aside, sweeping it into a shell around a hot, nearly empty interior. Some are small enough to surround one star, like the Bubble Nebula. Many of them overlap into larger cavities.',
    related: ['superbubble', 'local-bubble', 'stellar-wind', 'supernova_remnant'],
  },
  superbubble: {
    source: wiki('Superbubble'),
    details: 'A group of massive stars forms together and, over millions of years, blows out one enormous cavity through their winds and supernovae. These can reach hundreds of light-years across. If big enough, one can burst through the disk of a galaxy and vent hot gas above it.',
    related: ['bubble', 'local-bubble', 'supernova_remnant', 'star-cluster'],
  },
  dark_nebula: {
    also: ['Horsehead_Nebula', 'Coalsack_Nebula', 'Australian_Aboriginal_astronomy'],
    source: wiki('Dark_nebula'),
    details: 'A dark nebula is a cloud so dense with dust that it blocks the light from behind, leaving what looks like a hole in the stars.',
    sections: [
      { title: 'Silhouettes in the sky', text: 'The Horsehead Nebula and the Coalsack, beside the Southern Cross, are well-known examples. Infrared telescopes can see inside them and often find young stars forming there. Indigenous Australian astronomy even traced a great “Emu in the Sky” in these dark lanes of the Milky Way.' },
    ],
    related: ['molecular_cloud', 'extinction', 'dust_sheet'],
  },
  dust_sheet: {
    source: wiki('Cosmic_dust'), figure: dustReddening,
    details: 'Interstellar dust is made of grains far smaller than household dust, mostly of carbon and silicates. It makes up only about 1% of the mass of the gas between stars, but it matters out of all proportion. In Star View, a dust sheet shows a layer of it, rather than a separate kind of object.',
    sections: [
      { title: 'A veil, and an ingredient', text: 'Dust dims and reddens the light of the stars behind it, soaks up energy and glows in infrared. It also helps form molecules on its surface and it is the raw material for planets, including the one you are standing on.' },
    ],
    related: ['extinction', 'interstellar-medium', 'reflection_nebula', 'dark_nebula'],
  },
  'interstellar-medium': {
    source: wiki('Interstellar_medium'),
    details: 'The space between stars seems empty, but it holds an extremely thin mix of gas and dust, about 99% gas by mass. A typical spot has only about one atom per cubic centimeter, far emptier than the best vacuum on Earth.',
    sections: [
      { title: 'A galactic recycling system', text: 'Gas clouds collapse into stars. Stars cook heavier elements and return them to space through winds and explosions. That enriched gas forms the next generation, so each generation of stars starts out richer in heavy elements than the last.' },
    ],
    related: ['molecular_cloud', 'local-bubble', 'extinction', 'metallicity'],
  },
  'local-bubble': {
    source: wiki('Local_Bubble'),
    details: 'The Sun sits inside a cavity of very thin, hot gas about 1,000 light-years across. It was probably blown out by a series of supernovae over the last 10 to 20 million years, whose stars belonged to a moving group now near Scorpius and Centaurus.',
    sections: [
      { title: 'Why star formation surrounds us', text: 'A 2022 study found that nearly all young stars within 500 light-years lie on the bubble’s surface, where the expanding shell swept gas into dense clouds. Traces of supernova iron-60 in deep-sea sediment on Earth also fit this story.' },
    ],
    related: ['superbubble', 'bubble', 'interstellar-medium', 'supernova'],
  },
  'star-cluster': {
    also: ['Globular_cluster'],
    source: wiki('Star_cluster'),
    details: 'Stars form in groups, so many are born together in clusters from the same cloud, sharing an age and makeup. This makes clusters natural laboratories: differences among their stars come almost entirely from mass.',
    sections: [
      { title: 'Open and globular', text: 'Open clusters are young, loose groups of up to a few thousand stars, such as the Pleiades and the Hyades. They drift apart within millions to billions of years. Globular clusters are dense, ancient spheres of hundreds of thousands of stars, more than 10 billion years old, orbiting the Milky Way.' },
      { title: 'Reading a cluster’s age', text: 'Massive stars die first, so the top of a cluster’s main sequence gets shorter as it ages. The point where stars are just leaving, the “turnoff”, acts as a clock. That is how astronomers date clusters.' },
    ],
    related: ['hr-diagram', 'age', 'subtype-main-sequence', 'subtype-blue-straggler'],
  },
  'milky-way': {
    source: wiki('Milky_Way'),
    details: 'That pale band across a dark sky is our galaxy seen from inside its disk. It is a barred spiral about 87,000 light-years across, with the Sun about 27,000 light-years from the center. Almost every star in Star View belongs to it, and they are only a small nearby sample.',
    sections: [
      { title: 'A long galactic year', text: 'The Sun takes about 240 million years to orbit the center, moving at over 200 km per second. At the middle sits Sagittarius A*, a black hole of about 4 million solar masses.' },
    ],
    related: ['galactic-coordinates', 'black_hole', 'space-velocity', 'star-cluster'],
  },
}
