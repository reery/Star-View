import { AAVSO, simbad } from './glossary-article-helpers'
import { subtypeId, wiki, type GlossaryArticle } from './glossary-index'
import { accretion, barycenter, eclipse, ellipsoidal, rocheLobe } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  binary: {
    also: ['Star', 'Mizar_and_Alcor'],
    source: wiki('Binary_star'), figure: barycenter,
    details: 'A binary star is two stars held together by gravity, each circling their shared balance point. Pairs are very common: around half of Sun-like stars have at least one companion, so a planet with two suns is no fantasy.',
    sections: [
      { title: 'How we weigh a star', text: 'Binaries are the main way to measure star masses directly. Gravity sets how fast the two stars orbit each other, so timing their dance gives their masses.' },
      { title: 'Ways to spot a pair', text: 'Some pairs can be seen separately through a telescope (visual binaries). Others are revealed by shifting spectral lines (spectroscopic binaries), or by the dips in light when one star blocks the other (eclipsing binaries).' },
    ],
    deeper: 'With a period P in years and an orbit size a in au, the total mass in solar masses is M₁ + M₂ = a³/P². Mizar and Alcor, in the Big Dipper’s handle, are a famous naked-eye pair; Mizar itself is often called the first binary star ever discovered.',
    related: ['barycenter', 'keplers-laws', 'multiple_system', 'optical-double', 'orbital-period'],
  },
  multiple_system: {
    also: ['Alpha_Centauri', 'Castor_(star)'],
    source: wiki('Star_system'),
    details: 'A multiple star system has three or more stars bound by gravity. To be stable they are usually arranged in a hierarchy: a close pair, with another star or pair circling far outside it. Closer in, three bodies would soon throw one out.',
    sections: [
      { title: 'Our nearest neighbors', text: 'Alpha Centauri is the closest system to the Sun: stars A and B orbit each other every 80 years, and Proxima Centauri circles them far out. Castor looks like one star to the eye but is actually six, in three pairs.' },
    ],
    related: ['binary', 'orbital-period', 'barycenter'],
  },
  'optical-double': {
    source: wiki('Double_star'),
    details: 'Two stars can line up from Earth’s point of view but sit at very different distances, like a streetlight seeming to touch a distant tower. They have no link at all. True pairs are revealed by their shared motion through space or distance.',
    related: ['binary', 'parallax', 'proper-motion'],
  },
  'roche-lobe': {
    source: wiki('Roche_lobe'), figure: rocheLobe,
    details: 'Around each star in a binary is a teardrop-shaped zone where its gravity is in charge. Where the two teardrops touch, gas can pass between them. If a star grows to fill its zone, gas begins to flow toward its companion.',
    sections: [
      { title: 'When stars steal from each other', text: 'This transfer can completely change a star’s life. It makes novae, X-ray binaries and blue stragglers possible, and it can end with the stars merging. Algol is a famous puzzle: the less massive star there is the older one, because it has already passed mass to its partner.' },
    ],
    related: ['accretion-disk', 'binary', subtypeId('Blue straggler'), subtypeId('Cataclysmic variable')],
  },
  'accretion-disk': {
    source: wiki('Accretion_disk'), figure: accretion,
    details: 'Gas falling toward a star or black hole does not drop straight in. Its sideways motion makes it spiral inward, forming a flat, spinning disk. Friction in the disk heats the gas to brilliant temperatures, and that makes it glow.',
    sections: [
      { title: 'From planets to quasars', text: 'Disks form at all scales. They appear around newborn stars, and may become planetary systems. They feed compact objects in binaries, where they shine in X-rays. At galaxy centers they power quasars. Falling matter can release far more energy than fusion.' },
    ],
    related: ['black_hole', 'roche-lobe', subtypeId('X-ray binary'), subtypeId('T Tauri')],
  },
  [subtypeId('Spectroscopic binary')]: {
    source: wiki('Binary_star'), reference: { label: 'Example: ESO', url: 'https://www.eso.org/public/ireland/news/eso0133/' },
    details: 'Their light gives them away: as they orbit, the lines shift back and forth with a Doppler shift, repeating with the orbital period. Most known binaries were found this way.',
    interactive: { id: 'velocity' },
    related: ['doppler-effect', 'radial-velocity', 'binary'],
  },
  [subtypeId('Eclipsing binary')]: {
    also: ['Algol'],
    source: wiki('Binary_star'), reference: simbad('EB*'), figure: eclipse,
    details: 'Algol, the “Demon Star” in Perseus, is the classic example: its brightness falls by about a factor of three every 2.87 days.',
    interactive: { id: 'lightcurve', variant: 'eclipse' },
    sections: [
      { title: 'Precision measuring tape', text: 'How deep the dips are and how long they last give the relative sizes and temperatures of both stars. Add spectra and you have true masses and radii. Eclipsing binaries are among the most accurately measured stars anywhere, and also serve as distance markers.' },
    ],
    related: ['light-curve', 'inclination', 'transit', 'binary'],
  },
  [subtypeId('Ellipsoidal variable')]: {
    source: wiki('Ellipsoidal_variable'), reference: AAVSO, figure: ellipsoidal,
    details: 'It works just as the Moon raises tides on Earth. Because the broad side comes around twice per orbit, the light rises and falls twice, and no eclipse is needed.',
    interactive: { id: 'lightcurve', variant: 'ellipsoidal' },
    related: ['light-curve', 'roche-lobe', 'binary'],
  },
  [subtypeId('Symbiotic star')]: {
    source: wiki('Symbiotic_binary'), reference: simbad('Sy*'),
    details: 'The giant’s wind feeds the companion, whose ultraviolet light makes that same gas glow. Their spectra show a cool star and a hot star at once, which first drew attention to them.',
    related: [subtypeId('Nova'), 'white_dwarf', 'stellar-wind'],
  },
  [subtypeId('Cataclysmic variable')]: {
    source: wiki('Cataclysmic_variable_star'), reference: simbad('CV*'), figure: accretion,
    details: 'The two stars are so close that one orbit often takes only hours. Eruptions range from small dwarf novae to full novae.',
    related: ['accretion-disk', subtypeId('Nova'), 'roche-lobe', 'white_dwarf'],
  },
  [subtypeId('Nova')]: {
    also: ['T_Coronae_Borealis'],
    source: wiki('Nova'), reference: AAVSO, figure: accretion,
    details: 'Nova means “new”, because a star seems to appear from nowhere. In fact a white dwarf has gathered hydrogen from a companion until the layer ignites in a runaway blast. The star brightens tens of thousands of times or more, then fades over weeks and months.',
    sections: [
      { title: 'Not the end', text: 'Unlike a supernova, a nova does not destroy the star. The system can settle down and start building up again, so some, called recurrent novae, erupt repeatedly. T Coronae Borealis erupts about every 80 years, as it did in 1866 and 1946.' },
    ],
    related: ['white_dwarf', 'supernova', 'accretion-disk', subtypeId('Cataclysmic variable')],
  },
  [subtypeId('X-ray binary')]: {
    source: wiki('X-ray_binary'), reference: simbad('XB*'), figure: accretion,
    details: 'Those temperatures make them shine mainly in X-rays. Cygnus X-1 is the famous case, and was the first widely accepted black hole.',
    related: [subtypeId('Low-mass X-ray binary'), subtypeId('High-mass X-ray binary'), 'black_hole', 'neutron_star'],
  },
  [subtypeId('Low-mass X-ray binary')]: {
    source: wiki('X-ray_binary'), reference: simbad('LXB'), figure: accretion,
    details: 'The donor overflows its Roche lobe, and almost all of the system’s light comes from the disk, in X-rays. Many pulsars spinning hundreds of times per second are thought to have been sped up in these systems.',
    related: [subtypeId('X-ray binary'), 'roche-lobe', 'pulsar'],
  },
  [subtypeId('High-mass X-ray binary')]: {
    source: wiki('X-ray_binary'), reference: simbad('HXB'), figure: accretion,
    details: 'Such systems are young, because stars that massive live only millions of years. Cygnus X-1 is one.',
    related: [subtypeId('X-ray binary'), 'stellar-wind', 'star-o', 'black_hole'],
  },
}
