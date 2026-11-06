import { objectFigure } from './glossary-article-helpers'
import { wiki, type GlossaryArticle } from './glossary-index'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  white_dwarf: {
    source: wiki('White_dwarf'), figure: objectFigure('white_dwarf'),
    details: 'This is how most stars end, including the Sun. After a star sheds its outer layers, only the hot core remains: about the mass of the Sun, squeezed into a ball about the size of Earth. A teaspoon of it would weigh several tonnes.',
    interactive: { id: 'hr', variant: 'dwarfs' },
    sections: [
      { title: 'A dying ember', text: 'A white dwarf no longer has any fusion to power it, so it just cools, shining with leftover heat. It takes so long that the universe is not yet old enough for any white dwarf to have gone completely dark.' },
      { title: 'Sirius’s faint secret', text: 'In 1844, Friedrich Bessel noticed that bright Sirius wobbled, as if something unseen were pulling it. That companion, Sirius B, was first spotted in 1862, and later measurements showed it had a Sun’s worth of mass in a tiny body, a result so strange that it was hard to believe.' },
    ],
    deeper: 'Electron degeneracy pressure supports it, so adding mass makes it smaller, up to the Chandrasekhar limit of about 1.4 solar masses. Most have carbon–oxygen cores with thin hydrogen or helium atmospheres. Spectral classes begin with D: DA stars show hydrogen, DB helium.',
    related: ['degenerate-matter', 'chandrasekhar-limit', 'planetary_nebula', 'stellar-evolution', 'subtype-nova'],
  },
  neutron_star: {
    source: wiki('Neutron_star'), figure: objectFigure('neutron_star'),
    details: 'When a massive star’s core collapses in a supernova, atoms themselves are crushed, and electrons and protons merge into neutrons. The result has more mass than the Sun but is only about 20 km wide, about the size of a city.',
    sections: [
      { title: 'A mountain in a teaspoon', text: 'A sugar-cube-sized piece of neutron star would outweigh a mountain, at hundreds of millions of tonnes per cubic centimeter. Gravity at the surface is so strong that a mountain there could stand only millimeters high.' },
      { title: 'Spinning and magnetic', text: 'A collapsing core spins faster as it shrinks, as an ice skater does pulling in their arms. It also squeezes the magnetic field. That is why newborn neutron stars can spin many times per second, with fields trillions of times stronger than Earth’s.' },
    ],
    deeper: 'A typical mass is about 1.4 solar masses. Above an upper limit of roughly 2.2–2.9 solar masses, the core becomes a black hole instead. Merging neutron stars produce gravitational waves and forge heavy elements such as gold, as seen in the event GW170817.',
    related: ['pulsar', 'supernova', 'degenerate-matter', 'black_hole', 'magnetic-field'],
  },
  pulsar: {
    also: ['Hulse–Taylor_binary'],
    source: wiki('Pulsar'), figure: objectFigure('pulsar'),
    details: 'A pulsar is a spinning neutron star that sends beams of radiation out from its magnetic poles. Each time a beam sweeps past Earth, we see a pulse, much like the flash of a lighthouse. Some repeat with precision to rival atomic clocks.',
    sections: [
      { title: 'Little green men', text: 'Jocelyn Bell Burnell noticed the first pulsar in 1967 as a “bit of scruff” on a chart recording. The signal repeated every 1.33 seconds, so steadily that she and her colleagues half-jokingly named it LGM-1, for “little green men”.' },
      { title: 'Cosmic clocks', text: 'Most pulsars rotate about once a second and slow down gradually, but some spin hundreds of times per second, sped up by gas from a companion. A pulsar found in a binary in 1974 gave the first indirect evidence for gravitational waves, later earning a Nobel Prize.' },
    ],
    deeper: 'Radio pulses arrive first at high frequency and later at low, by an amount that reveals the free electrons along the way: the dispersion measure. Period P and slowdown rate Ṗ give the characteristic age, spin-down power and surface magnetic field, all under a simple magnetic-braking model.',
    related: ['neutron_star', 'dispersion-measure', 'spin-down-power', 'characteristic-age', 'pulsar-glitch'],
  },
  black_hole: {
    also: ['Gaia_BH1'],
    source: wiki('Black_hole'), figure: objectFigure('black_hole'),
    details: 'A black hole forms when so much mass is squeezed into so little space that gravity overcomes every other force. It is not a cosmic vacuum cleaner: from a safe distance it pulls just like any other object of the same mass. Inside its boundary, though, nothing can escape.',
    sections: [
      { title: 'Seeing the invisible', text: 'Black holes themselves give off no light, so astronomers find them by their effects: gas heated to millions of degrees as it falls in, stars orbiting nothing visible, and gravitational waves when two of them merge. Those waves were first detected in 2015.' },
      { title: 'From stars to giants', text: 'Stellar black holes form when very massive stars collapse, and usually have from a few to tens of solar masses. At the other extreme, the Milky Way’s center holds one of about 4 million solar masses, Sagittarius A*, imaged in 2022.' },
    ],
    deeper: 'A black hole’s event horizon has a radius of about 3 km per solar mass. Isolated stellar black holes are hard to detect; most confirmed ones are in X-ray binaries or found through gravitational waves. The closest known, Gaia BH1, was found in 2022 from its companion’s motion.',
    related: ['event-horizon', 'accretion-disk', 'subtype-x-ray-binary', 'neutron_star', 'supernova'],
  },
  supernova_remnant: {
    source: wiki('Supernova_remnant'),
    details: 'A supernova remnant is the expanding debris of an exploded star, along with the surrounding gas it sweeps up. These shells keep racing outward at thousands of kilometers per second, and can glow for tens of thousands of years.',
    sections: [
      { title: 'Spreading the seeds of new stars', text: 'Shock waves heat the gas to millions of degrees and accelerate particles to very high energies, likely including many of the cosmic rays that reach Earth. The newly forged elements mix into interstellar space, where they can become part of later stars and planets. Cassiopeia A and the Crab Nebula are well-known examples.' },
    ],
    related: ['supernova', 'pulsar_wind_nebula', 'superbubble', 'interstellar-medium'],
  },
  pulsar_wind_nebula: {
    also: ['Crab_Pulsar'],
    source: wiki('Pulsar_wind_nebula'),
    details: 'A young pulsar drives a fast wind of energetic particles. Where it meets surrounding gas, it creates a glowing cloud that radiates from radio waves to X-rays. The Crab Nebula is the classic case, powered by a pulsar spinning 30 times per second.',
    related: ['pulsar', 'supernova_remnant', 'spin-down-power'],
  },
  'chandrasekhar-limit': {
    source: wiki('Chandrasekhar_limit'),
    details: 'Unlike normal stars, white dwarfs get smaller as they gain mass. Above about 1.4 solar masses, even the quantum pressure holding one up cannot resist gravity any longer.',
    sections: [
      { title: 'The student on the ship', text: 'Subrahmanyan Chandrasekhar worked out the limit around 1930, on a voyage from India to England at age 19. It was attacked at first, notably by the famous Arthur Eddington, who thought the conclusion absurd. Chandrasekhar shared the 1983 Nobel Prize in Physics.' },
      { title: 'Why it matters', text: 'A white dwarf gaining mass from a companion can approach the limit and explode as a Type Ia supernova. The similar masses of these explosions help make them useful as distance markers. A collapsing iron core in a massive star passes a similar limit as it falls in.' },
    ],
    related: ['white_dwarf', 'degenerate-matter', 'supernova'],
  },
  'degenerate-matter': {
    source: wiki('Degenerate_matter'),
    details: 'Normal gas pushes back because it is hot. Crush matter hard enough and a different force appears: quantum rules forbid particles like electrons from sharing the same state, so they resist being packed tighter even when cold.',
    sections: [
      { title: 'Stranger the more you add', text: 'Degenerate matter holds up white dwarfs (electrons) and neutron stars (neutrons), neither of which needs fusion to keep from collapsing. Temperature hardly affects its pressure. It also behaves oppositely to ordinary objects: add mass and it shrinks.' },
    ],
    related: ['white_dwarf', 'neutron_star', 'chandrasekhar-limit', 'brown_dwarf'],
  },
  'event-horizon': {
    source: wiki('Event_horizon'),
    details: 'The event horizon is a point of no return, not a surface you could touch. Once past it, every possible path leads inward, and nothing, even light, can come back out to tell the tale.',
    sections: [
      { title: 'How big?', text: 'The size depends only on mass: about 3 km of radius per solar mass for a non-spinning black hole. Squeeze the Sun down to about 3 km and it would become one; Earth would have to fit within about 9 mm.' },
    ],
    related: ['black_hole', 'accretion-disk'],
  },
  'characteristic-age': {
    also: ['SN_1054', 'Crab_Pulsar'],
    source: wiki('Pulsar'),
    details: 'Pulsars slow down as they lose energy, so a pulsar’s spin and rate of slowing work like a clock. Dividing the period by twice its rate of change gives a rough age.',
    sections: [
      { title: 'A rough clock', text: 'The estimate assumes a simple braking process and a birth spin much faster than today’s. It can be far off. The Crab pulsar’s result comes close to the true age, known from the supernova of 1054, while for other pulsars it can be far from the true age.' },
    ],
    deeper: 'τ = P / (2Ṗ), where P is the period and Ṗ its rate of increase. It assumes magnetic dipole braking (braking index n = 3) and an initial period much shorter than the current one.',
    related: ['pulsar', 'spin-down-power', 'rotation', 'age'],
  },
  'spin-down-power': {
    also: ['Crab_Nebula'],
    source: wiki('Pulsar'),
    details: 'A spinning pulsar is a giant flywheel holding a huge store of energy. As it slows, that energy is released, mostly as a wind of particles and magnetic energy rather than the radio pulses we detect.',
    sections: [
      { title: 'Far more than meets the eye', text: 'The Crab Nebula shines with about 148,000 times the Sun’s power, and the pulsar’s lost spin energy is what keeps it lit. The radio pulses carry only a tiny fraction of this. A catalog value describes the power available, not the light observed in any one band.' },
    ],
    deeper: 'Ė = 4π²I Ṗ / P³, where I is the star’s moment of inertia, commonly assumed to be 10³⁸ kg m².',
    related: ['pulsar', 'pulsar_wind_nebula', 'characteristic-age'],
  },
  'magnetic-field': {
    source: wiki('Neutron_star'),
    details: 'Magnetic fields store energy and steer charged particles. Neutron stars have the strongest known: a typical field is about a trillion times as strong as Earth’s, and in rare magnetars a thousand times more than that again.',
    sections: [
      { title: 'A value inferred, not measured', text: 'Nobody can place a compass on a pulsar. Catalog values are estimated from its spin rate and how fast it is slowing, assuming magnetic braking is what slows it. They are good for comparison, but they are not a direct measurement.' },
    ],
    deeper: 'For a standard dipole model, B ≈ 3.2 × 10¹⁹ √(P Ṗ) gauss, with P in seconds. One tesla equals 10,000 gauss. Earth’s surface field is about half a gauss, and magnetars reach 10¹⁴–10¹⁵ gauss.',
    related: ['neutron_star', 'pulsar', 'spin-down-power'],
  },
  'dispersion-measure': {
    source: wiki('Dispersion_(optics)'),
    details: 'Space is not quite empty. Radio waves from a pulsar pass through thin clouds of free electrons, and lower frequencies are slowed slightly more than higher ones. The pulse arrives smeared out, high notes first and low notes last.',
    sections: [
      { title: 'A distance from a delay', text: 'The delay tells astronomers how many electrons lie along the path. Combine this with a map of the electrons in the Milky Way and you get a rough distance. Such distances can be well off, so Star View favors direct measurements where they exist.' },
    ],
    deeper: 'DM is the electron column density, measured in pc/cm³. The arrival delay between two frequencies is proportional to DM × (1/f₁² − 1/f₂²). Models of the galaxy’s electrons turn DM into a distance estimate.',
    related: ['pulsar', 'interstellar-medium', 'modelled-value', 'parallax'],
  },
  'pulsar-glitch': {
    source: wiki('Glitch_(astronomy)'),
    details: 'Pulsars slow down with great regularity, but sometimes one suddenly spins up by a tiny amount. The Vela pulsar is the best-known example, jolting every few years.',
    sections: [
      { title: 'A window into the star', text: 'Glitches likely happen when the fluid inside the star, a superfluid rotating slightly faster than the crust, suddenly passes on some of its spin. They offer a rare look inside matter far denser than anything on Earth.' },
    ],
    related: ['pulsar', 'neutron_star', 'rotation'],
  },
}
