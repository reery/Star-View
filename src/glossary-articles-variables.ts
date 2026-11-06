import { AAVSO, simbad } from './glossary-article-helpers'
import { subtypeId, wiki, type GlossaryArticle } from './glossary-index'
import { pulsation, rotation, youngStar } from './glossary-schematics'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  'light-curve': {
    also: ['American_Association_of_Variable_Star_Observers', 'Kepler_space_telescope'],
    source: wiki('Light_curve'),
    details: 'Measure a star’s brightness night after night and plot it against time, and you have a light curve. Its shape works like a fingerprint: rhythmic bumps mean a pulsating star, sharp dips point to an eclipse, and a sudden spike could be a flare.',
    interactive: { id: 'lightcurve', variant: 'pulsation' },
    sections: [
      { title: 'Anyone can help', text: 'Amateur observers have collected light curves for over a century. The American Association of Variable Star Observers (AAVSO) holds tens of millions of brightness estimates, used by professionals. Space telescopes such as Kepler and TESS now record them for many thousands of stars at once.' },
    ],
    related: [subtypeId('Variable star'), subtypeId('Eclipsing binary'), 'transit'],
  },
  'period-luminosity': {
    source: wiki('Period-luminosity_relation'),
    details: 'A Cepheid’s rhythm reveals its true power: the slower it pulses, the brighter it really is. Time the pulse, work out the true power, compare it with how bright the star looks, and you have the distance.',
    sections: [
      { title: 'Leavitt’s discovery', text: 'Henrietta Swan Leavitt, working at Harvard, found the pattern in 1908 while studying stars in the Small Magellanic Cloud. All were about the same distance from us, so the link had to be real. Her law let Edwin Hubble show that the Andromeda “nebula” was a separate galaxy, and helped reveal that the universe is expanding.' },
    ],
    deeper: 'The relation is usually written M = a log₁₀(P) + b, where the values of a and b differ by Cepheid class and passband. Astronomers call it the Leavitt law. Dust and metallicity must be corrected for, and parallaxes from Gaia now pin down its zero point.',
    related: [subtypeId('Cepheid variable'), subtypeId('RR Lyrae variable'), 'distance-ladder', 'absolute-magnitude'],
  },
  [subtypeId('Variable star')]: {
    also: ['V838_Monocerotis'],
    source: wiki('Variable_star'), reference: simbad('V*'),
    details: 'Stars can change for many reasons. Some swell and shrink, some erupt, some are eclipsed by a partner, and some carry dark spots into view as they turn. Even the Sun varies, by about 0.1% across its 11-year cycle.',
    sections: [
      { title: 'What’s in a name', text: 'Variable stars have their own naming system, using letters and the constellation: R Leonis, RR Lyrae, V838 Monocerotis. Many of the types you see in Star View are named after the first star found to behave that way.' },
    ],
    related: ['light-curve', subtypeId('Pulsating variable'), subtypeId('Eclipsing binary'), subtypeId('Rotating variable')],
  },
  [subtypeId('Pulsating variable')]: {
    source: wiki('Variable_star'), reference: simbad('Pu*'), figure: pulsation,
    details: 'Stars can ring like bells. In certain stages, a layer in the star’s outer envelope traps heat as it compresses, then releases it, which keeps the star swelling and shrinking over and over like an engine. Some stars pulse as a whole, and others ripple in complex patterns.',
    interactive: { id: 'lightcurve', variant: 'pulsation' },
    related: ['light-curve', subtypeId('Cepheid variable'), subtypeId('Mira variable'), subtypeId('RR Lyrae variable')],
  },
  [subtypeId('Rotating variable')]: {
    source: wiki('Variable_star'), reference: AAVSO, figure: rotation,
    details: 'Timing the repeat gives the star’s rotation period, which is hard to measure any other way.',
    interactive: { id: 'lightcurve', variant: 'rotation' },
    related: ['rotation', subtypeId('BY Draconis variable'), subtypeId('Alpha² CVn variable')],
  },
  [subtypeId('Eruptive variable')]: {
    also: ['Eta_Carinae'],
    source: wiki('Variable_star'), reference: simbad('Er*'),
    details: 'The class spans young stars still forming, like T Tauri stars, and dying giants such as Eta Carinae.',
    related: [subtypeId('Flare star'), subtypeId('FU Orionis variable'), subtypeId('R Coronae Borealis variable')],
  },
  [subtypeId('Irregular variable')]: {
    source: wiki('Slow_irregular_variable'), reference: AAVSO,
    details: 'Many are cool giants and supergiants with slowly churning surfaces. Often an “irregular” star simply has not been observed long enough to reveal its rhythm.',
    related: [subtypeId('Semiregular variable'), subtypeId('Variable star')],
  },
  [subtypeId('Long-period variable')]: {
    source: wiki('Long-period_variable_star'), reference: simbad('LP*'), figure: pulsation,
    details: 'They include Mira stars and semiregular variables, and almost every very red giant varies to some degree.',
    related: [subtypeId('Mira variable'), subtypeId('Semiregular variable'), subtypeId('Asymptotic giant branch')],
  },
  [subtypeId('Mira variable')]: {
    also: ['Mira'],
    source: wiki('Mira_variable'), reference: AAVSO, figure: pulsation,
    details: 'Mira, “the wonderful”, was the first star found to vary in a repeating cycle, in the 1600s. Over about 11 months it fades from naked-eye brightness to invisibility and returns. Stars of its type vary by more than 2.5 magnitudes.',
    sections: [
      { title: 'Less change than meets the eye', text: 'Much of a Mira’s swing in visible brightness comes from temperature: as it cools, more of its light moves into the infrared, where we cannot see it. Its total power changes far less. These stars are near the end of their lives and shed their outer layers quickly.' },
    ],
    interactive: { id: 'lightcurve', variant: 'pulsation' },
    related: [subtypeId('Long-period variable'), subtypeId('Asymptotic giant branch'), 'light-curve'],
  },
  [subtypeId('Semiregular variable')]: {
    also: ['Betelgeuse'],
    source: wiki('Semiregular_variable_star'), reference: AAVSO,
    details: 'The light may rise and fall on a recognizable cycle, but with changing depth. Betelgeuse is an example, and its unusual dimming in 2019–2020 made headlines.',
    related: [subtypeId('Long-period variable'), subtypeId('Red supergiant'), subtypeId('Irregular variable')],
  },
  [subtypeId('Cepheid variable')]: {
    also: ['Harlow_Shapley'],
    source: wiki('Cepheid_variable'), reference: AAVSO, figure: pulsation,
    details: 'Cepheids are bright, pulsating yellow stars that repeat a very regular cycle, from about a day to a hundred days. They are famous because their rhythm reveals their true power, which makes them vital markers for measuring distances to other galaxies. Harlow Shapley used them to estimate the size of the Milky Way and the Sun’s place in it.',
    interactive: { id: 'lightcurve', variant: 'pulsation' },
    related: ['period-luminosity', 'distance-ladder', subtypeId('Classical Cepheid'), subtypeId('Type II Cepheid')],
  },
  [subtypeId('Classical Cepheid')]: {
    source: wiki('Classical_Cepheid_variable'), reference: AAVSO, figure: pulsation,
    details: 'These are young, massive stars, about 4 to 20 times the Sun’s mass, in the disks of galaxies. Their namesake is Delta Cephei, and Polaris is the nearest. They are typically 1,000 to 50,000 times as luminous as the Sun, so they can be seen across tens of millions of light-years.',
    related: [subtypeId('Cepheid variable'), subtypeId('Type II Cepheid'), 'period-luminosity'],
  },
  [subtypeId('Type II Cepheid')]: {
    also: ['Cepheid_variable'],
    source: wiki('Type_II_Cepheid'), reference: AAVSO, figure: pulsation,
    details: 'These pulse in a similar way to classical Cepheids, but they are old, low-mass stars of about half the Sun’s mass, about 1.6 magnitudes fainter at the same period. When Walter Baade recognized the difference in the 1940s, it doubled the estimated distances to other galaxies.',
    related: [subtypeId('Classical Cepheid'), 'period-luminosity', 'distance-ladder'],
  },
  [subtypeId('RR Lyrae variable')]: {
    source: wiki('RR_Lyrae_variable'), reference: AAVSO, figure: pulsation,
    details: 'Because they all have about the same power, comparing how bright one looks with how bright it really is gives its distance. That makes them useful markers within the Milky Way and nearby galaxies.',
    interactive: { id: 'lightcurve', variant: 'pulsation' },
    related: [subtypeId('Horizontal-branch'), 'distance-ladder', 'star-cluster'],
  },
  [subtypeId('Delta Scuti variable')]: {
    source: wiki('Delta_Scuti_variable'), reference: AAVSO,
    details: 'They pulse in many patterns at once. Tracking these patterns reveals their interiors, much as earthquakes reveal what is inside Earth. Altair is a bright example, and Vega is a suspected one.',
    related: ['star-a', 'star-f', subtypeId('Pulsating variable')],
  },
  [subtypeId('Beta Cephei variable')]: {
    source: wiki('Beta_Cephei_variable'), reference: AAVSO,
    details: 'Despite the name, not a Cepheid; they are hotter and more massive, with no useful relation between period and power. The unusual behavior of iron deep in their interiors is thought to drive their rhythm.',
    related: ['star-b', subtypeId('Cepheid variable'), subtypeId('Pulsating variable')],
  },
  [subtypeId('Gamma Doradus variable')]: {
    source: wiki('Gamma_Doradus_variable'), reference: AAVSO,
    details: 'Their pulsations travel deep through the star, so they let astronomers probe the region close to the core.',
    related: ['star-f', subtypeId('Delta Scuti variable'), subtypeId('Pulsating variable')],
  },
  [subtypeId('RV Tauri variable')]: {
    source: wiki('RV_Tauri_variable'), reference: AAVSO,
    details: 'Each full cycle lasts about a month or more. These stars are moving from the asymptotic giant branch toward becoming white dwarfs, and may have disks of dust around them.',
    related: [subtypeId('Asymptotic giant branch'), subtypeId('Type II Cepheid'), 'light-curve'],
  },
  [subtypeId('Alpha² CVn variable')]: {
    source: wiki('Alpha2_Canum_Venaticorum_variable'), reference: AAVSO, figure: rotation,
    details: 'These stars have strong magnetic fields, which gather certain chemical elements into patches on the surface. As the star rotates, the patches change both its brightness and its spectrum. The brightness cycle therefore measures its spin.',
    interactive: { id: 'lightcurve', variant: 'rotation' },
    related: [subtypeId('Chemically peculiar'), subtypeId('Rotating variable'), 'rotation'],
  },
  [subtypeId('BY Draconis variable')]: {
    source: wiki('BY_Draconis_variable'), reference: AAVSO, figure: rotation,
    details: 'Their spots are like sunspots, but can cover far more of the surface, and the change in light is usually small.',
    interactive: { id: 'lightcurve', variant: 'rotation' },
    related: [subtypeId('Flare star'), subtypeId('Rotating variable'), 'star-k', 'star-m'],
  },
  [subtypeId('RS CVn variable')]: {
    source: wiki('RS_Canum_Venaticorum_variable'), reference: AAVSO, figure: rotation,
    details: 'Tides in these close binaries keep the stars spinning quickly, which drives powerful magnetic activity. The result is huge starspots, strong X-rays and flares. Capella is a nearby system with similar traits.',
    interactive: { id: 'lightcurve', variant: 'rotation' },
    related: ['binary', subtypeId('BY Draconis variable'), 'tidal-locking'],
  },
  [subtypeId('Orion variable')]: {
    source: wiki('Orion_variable'), reference: AAVSO, figure: youngStar,
    details: 'Gas falling from a disk, clumps of dust passing in front, and the star’s strong magnetic activity all play a part. The Orion Nebula is full of them.',
    related: [subtypeId('T Tauri'), subtypeId('Young stellar object'), 'molecular_cloud'],
  },
  [subtypeId('Flare star')]: {
    source: wiki('Flare_star'), reference: AAVSO,
    details: 'A magnetic field that snaps and reconnects can release huge energy in minutes, and on a dim red dwarf it stands out dramatically. Proxima Centauri, the Sun’s nearest neighbor, flares often.',
    related: ['star-m', subtypeId('BY Draconis variable'), subtypeId('Eruptive variable')],
  },
  [subtypeId('FU Orionis variable')]: {
    also: ['FU_Orionis'],
    source: wiki('FU_Orionis_star'), reference: AAVSO, figure: youngStar,
    details: 'FU Orionis itself brightened in 1937, and has stayed bright ever since. Young stars like the Sun may pass through such bursts repeatedly.',
    related: [subtypeId('T Tauri'), 'accretion-disk', subtypeId('Eruptive variable')],
  },
  [subtypeId('R Coronae Borealis variable')]: {
    source: wiki('R_Coronae_Borealis_variable'), reference: AAVSO,
    details: 'Most variable stars brighten suddenly. These do the reverse, staying steady for months or years and then dropping by thousands of times in brightness within weeks. Clouds of carbon soot form above the star and block its light until a wind clears them.',
    sections: [
      { title: 'A star with almost no hydrogen', text: 'They are also strange in makeup, with very little hydrogen, the universe’s most common element. They may come from the merger of two white dwarfs. Only about 150 are known in our galaxy, and R Coronae Borealis itself can sometimes be seen with binoculars.' },
    ],
    related: [subtypeId('Carbon star'), 'white_dwarf', 'light-curve'],
  },
}
