import { NASA_STAR_TYPES, simbad, STSCI_CLASSES } from './glossary-article-helpers'
import { subtypeId, wiki, type GlossaryArticle } from './glossary-index'
import { fusion, youngStar } from './glossary-schematics'


export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  'stellar-evolution': {
    also: ['Main_sequence', 'Mass–luminosity_relation'],
    source: wiki('Stellar_evolution'),
    details: 'Stars are not eternal. They form, age and die over spans from a few million to many trillions of years. No one can watch a single star live its whole life, so astronomers piece the story together from millions of stars seen at different stages, like working out how trees grow by walking through a forest.',
    interactive: { id: 'fate' },
    sections: [
      { title: 'Birth in a cold cloud', text: 'A star begins when part of a cold cloud of gas and dust collapses under its own gravity. The center heats up, and when it reaches about 10 million K hydrogen starts fusing into helium. A star is born.' },
      { title: 'A long middle age', text: 'For about 90% of its life, a star sits on the main sequence, steadily fusing hydrogen in its core. How long this lasts depends on mass, because heavy stars burn their fuel far faster than light ones.' },
      { title: 'Two very different endings', text: 'When hydrogen runs out in the core, a star swells into a giant. A star like the Sun then gently sheds its outer layers and leaves a white dwarf. A star above about 8 solar masses goes further, building heavier elements until its core collapses in a supernova, leaving a neutron star or a black hole.' },
    ],
    deeper: 'Main-sequence lifetime scales roughly as M/L, and with L ∝ M^3.5 this gives about 10 Gyr × M^−2.5. The evolution of a star is usually tracked as a path on the Hertzsprung–Russell diagram. Mass transfer in binaries, rotation and metallicity can all change the path and the outcome.',
    related: ['hr-diagram', 'nuclear-fusion', 'subtype-main-sequence', 'supernova', 'white_dwarf'],
  },
  'nuclear-fusion': {
    source: wiki('Stellar_nucleosynthesis'), figure: fusion,
    details: 'Fusion is the power source of stars. Under huge pressure and heat, atomic nuclei collide hard enough to stick together, and a little of their mass becomes energy. The Sun turns about 4 million tonnes of matter into pure energy every second.',
    sections: [
      { title: 'We are made of this', text: 'Almost every element heavier than helium was made inside stars and scattered when they died. The carbon in your cells, the oxygen you breathe and the iron in your blood all come from stars that lived and died before the Sun formed.' },
      { title: 'Why it stops at iron', text: 'Fusing elements up to iron releases energy. Fusing iron costs energy. When a massive star’s core turns to iron, the fire that held it up goes out and gravity wins within a second, triggering a supernova.' },
    ],
    deeper: 'Stars like the Sun fuse hydrogen mainly through the proton–proton chain, whose rate climbs slowly with temperature. Stars above about 1.3 solar masses favor the CNO cycle, which uses carbon, nitrogen and oxygen as catalysts and is far more sensitive to temperature. Helium then fuses through the triple-alpha process, at around 100 million K.',
    related: ['star', 'supernova', 'stellar-evolution', 'metallicity'],
  },
  'stellar-wind': {
    also: ['Solar_wind'],
    source: wiki('Stellar_wind'),
    details: 'Every star leaks. Gas flows from its outer atmosphere into space, sometimes as a gentle breeze and sometimes as a storm that blows away much of the star. The Sun’s wind causes auroras on Earth and shapes comet tails.',
    sections: [
      { title: 'From a breeze to a hurricane', text: 'The solar wind carries away only about one fifty-trillionth of the Sun’s mass each year, far too little to matter. A hot O-type or Wolf–Rayet star may lose tens to hundreds of millions of times more than that, at speeds of thousands of kilometers per second, and the loss changes how the star ends its life.' },
    ],
    related: [subtypeId('Wolf–Rayet'), 'bubble', subtypeId('Asymptotic giant branch'), 'interstellar-medium'],
  },
  supernova: {
    also: ['Betelgeuse'],
    source: wiki('Supernova'),
    details: 'For a few weeks a single exploding star can outshine a galaxy of billions. The blast spreads newly made elements through space, and its shock wave can trigger the birth of new stars.',
    sections: [
      { title: 'Two ways to explode', text: 'In a core-collapse supernova, a massive star runs out of fuel and its core falls in on itself within a second, then rebounds. In a Type Ia supernova, a white dwarf gains too much mass from a companion, or merges with one, and blows apart in a runaway nuclear explosion.' },
      { title: 'Seen with the naked eye', text: 'None has been seen in the Milky Way since 1604, when Kepler’s supernova appeared. In 1987 a star exploded in the Large Magellanic Cloud and was visible without a telescope. Astronomers expect a few per century in our galaxy, many of them hidden by dust. Betelgeuse should explode within about the next 100,000 years.' },
    ],
    deeper: 'Type Ia events peak at similar brightness, around absolute magnitude −19.3, which makes them standard candles for measuring the expansion of the universe. Types II, Ib and Ic arise from core collapse in massive stars and are classified by which spectral lines appear.',
    related: ['supernova_remnant', 'neutron_star', 'chandrasekhar-limit', 'distance-ladder', 'black_hole'],
  },
  [subtypeId('Pre-main-sequence')]: {
    source: wiki('Pre-main-sequence_star'), reference: simbad('pMS*'), figure: youngStar,
    details: 'It shines from heat released as it shrinks, not from fusion. For the Sun this took tens of millions of years, and for massive stars it is far shorter.',
    related: [subtypeId('T Tauri'), subtypeId('Herbig Ae/Be'), subtypeId('Main-sequence'), 'molecular_cloud'],
  },
  [subtypeId('Young stellar object')]: {
    source: wiki('Young_stellar_object'), reference: simbad('Y*O'), figure: youngStar,
    details: 'The label runs from dense clumps still deep inside their birth clouds up to young stars ready to begin fusion. Infrared telescopes see them best, because dust hides them from visible light.',
    related: ['molecular_cloud', subtypeId('Pre-main-sequence'), subtypeId('T Tauri')],
  },
  [subtypeId('T Tauri')]: {
    source: wiki('T_Tauri_star'), reference: simbad('TT*'), figure: youngStar,
    details: 'This is what the Sun looked like in its first few million years. They flicker unpredictably, and are often surrounded by the disks where planets form.',
    related: [subtypeId('Herbig Ae/Be'), 'accretion-disk', 'exoplanet', subtypeId('Orion variable')],
  },
  [subtypeId('Herbig Ae/Be')]: {
    source: wiki('Herbig_Ae/Be_star'), reference: simbad('Ae*'), figure: youngStar,
    details: 'They are still contracting, and still have disks and surrounding gas, which cause their bright emission lines.',
    related: [subtypeId('T Tauri'), subtypeId('Be star'), subtypeId('Pre-main-sequence')],
  },
  [subtypeId('Main-sequence')]: {
    source: wiki('Main_sequence'), reference: NASA_STAR_TYPES, figure: fusion,
    details: 'Plot many stars by temperature and brightness, and most fall along one diagonal band: the main sequence. It is not a path stars travel along. A star lands at the spot set by its mass and stays there for most of its life. Star View assigns this label from luminosity class V in the spectral type.',
    interactive: { id: 'hr', variant: 'main' },
    sections: [
      { title: 'A question of mass', text: 'Heavy stars sit at the upper left, hot and brilliant; light ones sit at the lower right, cool and dim. Stars here are often called dwarfs, even the huge blue ones, which is one of astronomy’s confusing habits.' },
    ],
    related: ['hr-diagram', 'luminosity-class', 'nuclear-fusion', 'stellar-evolution'],
  },
  [subtypeId('Subgiant')]: {
    also: ['Beta_Hydri', 'Procyon'],
    source: wiki('Subgiant'), reference: { label: 'Luminosity class IV: NASA', url: 'https://heasarc.gsfc.nasa.gov/W3Browse/rosat/rassdwarf.html' },
    details: 'When the core’s hydrogen is gone, fusion moves to a shell around it and the star starts to grow. This brief stage comes between the main sequence and the giants. Star View assigns this label from luminosity class IV in the spectral type. Procyon A is approaching this stage, and Beta Hydri is already there.',
    related: [subtypeId('Main-sequence'), subtypeId('Giant'), 'luminosity-class'],
  },
  [subtypeId('Giant')]: {
    source: wiki('Giant_star'), reference: NASA_STAR_TYPES,
    details: 'It got that way by running out of hydrogen at its core. Star View assigns this label from luminosity class III in the spectral type. Arcturus and Capella are bright examples.',
    interactive: { id: 'hr', variant: 'giants' },
    related: ['hr-diagram', subtypeId('Red giant'), 'luminosity-class'],
  },
  [subtypeId('Bright giant')]: {
    source: wiki('Bright_giant'), reference: STSCI_CLASSES,
    details: 'These stars sit between the giants and the supergiants. Star View assigns this label from luminosity class II in the spectral type. Some are stars too light to count as true supergiants, and others are massive stars moving through a short transitional stage.',
    related: [subtypeId('Giant'), subtypeId('Supergiant'), 'luminosity-class'],
  },
  [subtypeId('Red giant')]: {
    source: wiki('Red_giant'), reference: simbad('RG*'),
    details: 'This happens to stars of up to about 8 solar masses as they run short of fuel. Aldebaran and Gacrux are bright examples.',
    sections: [
      { title: 'Swallowing the inner planets', text: 'In about 5 billion years, the Sun will become so large that it engulfs Mercury and Venus, and perhaps Earth. Yet nearly all that bulk will be extremely thin gas, while the real power comes from a thin shell of burning hydrogen around a tiny, dense core.' },
    ],
    related: [subtypeId('Giant'), subtypeId('Asymptotic giant branch'), 'planetary_nebula', 'stellar-evolution'],
  },
  [subtypeId('Horizontal-branch')]: {
    source: wiki('Horizontal_branch'), reference: simbad('HB*'), figure: fusion,
    details: 'After its red giant phase, a Sun-like star ignites helium in its core and settles for a while as a smaller, hotter star. On the HR diagram of a star cluster, these stars line up in a nearly flat row, which gives the stage its name.',
    related: [subtypeId('Red giant'), subtypeId('RR Lyrae variable'), 'hr-diagram'],
  },
  [subtypeId('Asymptotic giant branch')]: {
    source: wiki('Asymptotic_giant_branch'), reference: simbad('AB*'), figure: fusion,
    details: 'This is the last act for stars like the Sun. With an inert carbon–oxygen core, the star burns hydrogen and helium in thin shells and can swell to hundreds of times the Sun’s size. Its dusty winds supply much of the carbon in the galaxy and it ends by casting off its outer layers as a planetary nebula.',
    related: [subtypeId('Red giant'), 'planetary_nebula', subtypeId('Mira variable'), subtypeId('Carbon star')],
  },
  [subtypeId('Supergiant')]: {
    source: wiki('Supergiant'), reference: NASA_STAR_TYPES,
    details: 'They shine hundreds of thousands of times as powerfully as the Sun. Star View assigns this label from luminosity class I in the spectral type, including its Ia, Iab and Ib divisions.',
    interactive: { id: 'hr', variant: 'supergiants' },
    related: [subtypeId('Red supergiant'), subtypeId('Blue supergiant'), subtypeId('Yellow supergiant'), 'supernova'],
  },
  [subtypeId('Evolved supergiant')]: {
    source: wiki('Supergiant'), reference: simbad('sg*'),
    details: 'This catalog label does not say what color the star is. Blue, yellow and red supergiants are the color-based kinds, and one star can move between them during its life.',
    related: [subtypeId('Supergiant'), subtypeId('Red supergiant'), subtypeId('Blue supergiant')],
  },
  [subtypeId('Red supergiant')]: {
    also: ['Betelgeuse'],
    source: wiki('Red_supergiant'), reference: simbad('s*r'),
    details: 'Among the largest stars by volume. If Betelgeuse replaced the Sun, its surface would reach beyond the asteroid belt.',
    sections: [
      { title: 'A candle burning at both ends', text: 'Though immense, these stars are near the end of their lives, and they shed mass quickly. Most finish as core-collapse supernovae. Antares and Betelgeuse are easy to pick out for their deep orange tint.' },
    ],
    related: [subtypeId('Supergiant'), 'supernova', 'stellar-wind'],
  },
  [subtypeId('Yellow supergiant')]: {
    also: ['Polaris', 'Delta_Cephei'],
    source: wiki('Yellow_supergiant'), reference: simbad('s*y'),
    details: 'These stars have surfaces about as hot as the Sun’s but are thousands of times brighter. They are rare, because massive stars cross this part of the HR diagram quickly. Polaris and Delta Cephei belong here, and the same zone hosts many Cepheid variables.',
    related: [subtypeId('Supergiant'), subtypeId('Classical Cepheid'), 'hr-diagram'],
  },
  [subtypeId('Blue supergiant')]: {
    source: wiki('Blue_supergiant'), reference: simbad('s*b'),
    details: 'Their surfaces reach from about 10,000 to 50,000 K, and they lose mass in strong winds. The star that exploded as Supernova 1987A was one, which came as a surprise at the time.',
    related: [subtypeId('Supergiant'), 'stellar-wind', 'supernova'],
  },
  [subtypeId('Subdwarf')]: {
    source: wiki('Subdwarf'), reference: STSCI_CLASSES,
    details: 'Many are ancient stars from the Milky Way’s earliest generations, with too little metal to look like younger stars. Star View assigns this label from luminosity class VI in the spectral type; not the same as a hot subdwarf.',
    related: ['metallicity', subtypeId('Hot subdwarf'), 'luminosity-class'],
  },
  [subtypeId('Hot subdwarf')]: {
    source: wiki('Subdwarf_B_star'), reference: simbad('HS*'),
    details: 'What remains is the star’s helium-burning core: about a fifth of the Sun’s width, with a surface above 20,000 K. It will finish as a white dwarf.',
    related: [subtypeId('Horizontal-branch'), subtypeId('Subdwarf'), 'white_dwarf', 'binary'],
  },
  [subtypeId('Blue straggler')]: {
    source: wiki('Blue_straggler'), reference: simbad('BS*'),
    details: 'In an old star cluster, all the massive blue stars should be long dead. Yet some remain, looking far younger than their neighbors. They most likely stole mass from a companion or merged with one.',
    related: ['star-cluster', 'hr-diagram', 'binary', 'roche-lobe'],
  },
}
