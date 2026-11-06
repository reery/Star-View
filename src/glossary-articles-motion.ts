import { wiki, type GlossaryArticle } from './glossary-index'
import { barycenter } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  'proper-motion': {
    also: ['Barnard\'s_Star'],
    source: wiki('Proper_motion'),
    details: 'The “fixed” stars are not fixed at all. They race through space, but they are so far away that the change takes years of careful measurement to detect. Proper motion is that drift across the sky. It is the motion you can switch on in Star View’s time controls.',
    interactive: { id: 'velocity' },
    sections: [
      { title: 'The star that moves fastest', text: 'Barnard’s Star holds the record, at about 10.3 arcseconds per year. That means it moves a full Moon-width across the sky in under 200 years. Most stars move far less, in the thousandths of an arcsecond per year.' },
      { title: 'A clue to nearby stars', text: 'In 1718, Edmond Halley noticed that Sirius and Arcturus had moved from their positions in ancient records. A large proper motion usually means a star is close to us, which is how astronomers have found many nearby stars.' },
    ],
    deeper: 'Catalogs give two parts: μα* along RA and μδ along Dec, in milliarcseconds per year (mas/yr). The RA part usually already includes the cos δ factor. Combine this with distance for the speed across the sky: v = 4.74 μ d, with μ in arcseconds per year, d in parsecs, and v in km/s.',
    related: ['transverse-velocity', 'radial-velocity', 'space-velocity', 'epoch', 'gaia'],
  },
  'radial-velocity': {
    also: ['Barnard\'s_Star'],
    source: wiki('Radial_velocity'),
    details: 'Proper motion shows movement across the sky, and radial velocity shows the other direction: straight toward or away from us. Positive values mean moving away, and negative values mean approaching. Barnard’s Star is coming toward us at about 110 km/s.',
    interactive: { id: 'velocity' },
    sections: [
      { title: 'A speedometer in the light', text: 'The Doppler effect shifts a star’s spectral lines by an amount set by its speed. Unlike proper motion, this works at any distance, as long as the star is bright enough for a good spectrum. It is also why this method finds so many planets: it can detect the tiny wobble a planet causes in its star.' },
    ],
    deeper: 'Published values are usually corrected to the Solar System’s barycenter, removing Earth’s own motion of up to about 30 km/s. For stars in binaries, the measured value also includes orbital motion, so the value of a single measurement depends on when it was taken.',
    related: ['doppler-effect', 'proper-motion', 'space-velocity', 'subtype-spectroscopic-binary', 'exoplanet'],
  },
  'transverse-velocity': {
    also: ['Pulsar_kick'],
    source: wiki('Proper_motion'),
    details: 'Proper motion is an angle, so a nearby slow star and a distant fast star can show the same drift. Multiply by distance and you have the real speed across the sky, in km/s. The Pulsar card calls this the transverse speed, and some pulsars exceed 1,000 km/s.',
    interactive: { id: 'velocity' },
    deeper: 'v_t = 4.74 × μ × d, with μ in arcseconds per year and d in parsecs, gives km/s. It leaves out radial motion. Together, radial and transverse speed give the star’s full speed: v² = v_r² + v_t².',
    related: ['proper-motion', 'radial-velocity', 'space-velocity', 'pulsar'],
  },
  'space-velocity': {
    source: wiki('Stellar_kinematics'),
    details: 'Combining a star’s motion across the sky, its motion toward or away from us, and its distance gives its motion in three dimensions. It reveals where a star came from and where it is heading. Star View uses this to move stars forward and backward in time.',
    sections: [
      { title: 'Families on the move', text: 'Stars born together keep moving in similar directions for a long time. That allows astronomers to trace “moving groups” back to their birthplaces, long after the group has spread out. Stars moving unusually fast often come from the older halo of the galaxy, or were flung out of a binary.' },
    ],
    deeper: 'It is usually given as U, V and W, or as X, Y and Z, in km/s, relative to the Sun. U points toward the galactic center, V along the Sun’s orbit, and W toward the galactic north pole. Motion relative to the Sun’s neighbors is called peculiar velocity. The Sun’s own is about 13–20 km/s.',
    related: ['proper-motion', 'radial-velocity', 'galactic-coordinates', 'milky-way'],
  },
  'orbital-period': {
    source: wiki('Orbital_period'),
    details: 'Earth’s orbital period around the Sun is one year. In a binary, the period may be a few hours for a close pair, or hundreds of thousands of years for a wide one. Longer periods go with wider orbits, and they get shorter with greater mass.',
    interactive: { id: 'orbit' },
    sections: [
      { title: 'Easy to measure, hard to wait for', text: 'A short period can be timed with great accuracy through a repeating eclipse or Doppler shift. Long periods are another matter: an orbit that takes a thousand years has only been followed for a small part of its path, so its period remains an estimate.' },
    ],
    deeper: 'Kepler’s third law gives P² = a³ / M, with P in years, a in astronomical units and M the total mass in solar masses. So once a period and an orbit’s size are known, the mass of the system follows.',
    related: ['keplers-laws', 'semi-major-axis', 'binary', 'rotation'],
  },
  'semi-major-axis': {
    source: wiki('Semi-major_and_semi-minor_axes'),
    details: 'An orbit is an ellipse, a slightly squashed circle. The longest line across it is the major axis, and half that is the semi-major axis. It works like an average orbital distance: Earth’s is 1 astronomical unit, by near definition, and Neptune’s about 30.',
    interactive: { id: 'orbit' },
    sections: [
      { title: 'The size that sets the clock', text: 'A semi-major axis alone fixes how long an orbit takes around a star of known mass, however stretched that orbit is. In a binary, Star View gives the value for the relative orbit of the two stars: how far one moves as seen from the other.' },
    ],
    related: ['eccentricity', 'orbital-period', 'keplers-laws', 'astronomical-unit'],
  },
  eccentricity: {
    also: ['Earth\'s_orbit'],
    source: wiki('Orbital_eccentricity'),
    details: 'A value of 0 is a perfect circle, and values approaching 1 mean a long, thin ellipse. Earth’s orbit is nearly circular, at 0.017. Halley’s Comet, at 0.967, comes inside Venus’s orbit and travels out past Neptune’s.',
    interactive: { id: 'orbit' },
    sections: [
      { title: 'Shape tells a story', text: 'Close binaries tend to have circular orbits, because tides gradually round them out. Wide binaries can have very stretched orbits. Many exoplanets also have far more eccentric orbits than our planets, a sign of past encounters between planets. An orbit with e of 1 or more is no longer closed: the body never returns.' },
    ],
    deeper: 'For semi-major axis a, closest approach is a(1 − e), and greatest distance is a(1 + e). The orbital speed at closest approach is faster than at the farthest point by a factor of (1 + e)/(1 − e).',
    related: ['semi-major-axis', 'periastron', 'keplers-laws', 'tidal-locking'],
  },
  inclination: {
    source: wiki('Orbital_inclination'),
    details: 'Face-on, at 0°, you see an orbit as its true shape. Edge-on, at 90°, it looks like a line, with the bodies moving back and forth. Eclipses and transits happen only for orbits very close to edge-on.',
    interactive: { id: 'orbit', variant: 'tilt' },
    sections: [
      { title: 'The trouble with tilt', text: 'If you do not know the tilt, you do not know the full speed of the orbit: Doppler shifts only see the part along our line of sight. This is why planets found that way usually have only a minimum mass, often written m sin i. Knowing the tilt, by transit or by imaging, gives the true mass.' },
    ],
    deeper: 'Values above 90° mean the object moves backward (retrograde) relative to the reference direction. In the Solar System, inclinations are measured relative to the ecliptic. In binaries they are measured relative to the plane of the sky.',
    related: ['transit', 'subtype-eclipsing-binary', 'eccentricity', 'exoplanet'],
  },
  periastron: {
    also: ['S2_(star)'],
    source: wiki('Apsis'),
    details: 'Bodies move fastest at closest approach and slowest when farthest apart. Each kind of orbit has its own word: perihelion and aphelion for the Sun, perigee and apogee for Earth. Periastron and apastron are the general words for stars.',
    interactive: { id: 'orbit' },
    sections: [
      { title: 'The numbers on a System card', text: 'Star View’s System card lists the periastron epoch, the date the two stars last came closest, and the argument of periastron, which says how the closest point is rotated within the orbit. Together with the longitude of the node, they place the ellipse on the sky.' },
    ],
    deeper: 'Seven numbers describe a binary’s orbit: period P, periastron time T, eccentricity e, semi-major axis a, inclination i, longitude of the ascending node Ω, and argument of periastron ω. The closest star orbiting the Milky Way’s central black hole, S2, reaches periastron about every 16 years.',
    related: ['eccentricity', 'semi-major-axis', 'inclination', 'keplers-laws'],
  },
  barycenter: {
    source: wiki('Barycenter_(astronomy)'), figure: barycenter,
    details: 'Two bodies orbit a shared point, like a see-saw balancing nearer the heavier child. Earth and Moon’s balance point lies inside Earth. The Sun itself wobbles around a point that is often outside its surface, mostly because of Jupiter.',
    sections: [
      { title: 'A wobble that finds planets', text: 'A star’s wobble around its barycenter reveals planets too small and faint to see. Astronomers track it with Doppler shifts, and Gaia can detect it directly as a movement on the sky.' },
    ],
    related: ['binary', 'keplers-laws', 'radial-velocity', 'exoplanet'],
  },
  'keplers-laws': {
    also: ['Johannes_Kepler'],
    source: wiki('Kepler%27s_laws_of_planetary_motion'),
    details: 'Johannes Kepler worked out these laws between 1609 and 1619 from Tycho Brahe’s careful records of Mars, breaking with 2,000 years of belief in perfect circles. They apply to planets, moons and stars alike, anywhere one body orbits another.',
    interactive: { id: 'orbit' },
    sections: [
      { title: 'One: orbits are ellipses', text: 'Every planet follows an ellipse with the Sun at one focus, not at the center. The star sits to one side of the orbit, so the planet’s distance changes as it goes around.' },
      { title: 'Two: equal areas in equal times', text: 'A line joining planet and star sweeps out equal areas in equal times. So planets speed up as they near the star, and slow down as they move away. Press play in the diagram above to see this.' },
      { title: 'Three: size sets the time', text: 'The farther the orbit, the longer it takes, in a fixed ratio. Square the period in years and you get the semi-major axis in astronomical units, cubed. This is how the masses of stars and planets are measured.' },
    ],
    deeper: 'Newton later explained these as a result of gravity, and generalized the third law: P² = a³/(M₁ + M₂), in years, astronomical units and solar masses. For binaries, it gives the combined mass directly once the distance is known.',
    related: ['orbital-period', 'semi-major-axis', 'eccentricity', 'binary'],
  },
}
