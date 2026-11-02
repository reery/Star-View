// Plain-language summaries of catalog labels, not new classifications.
// References: https://vsx.aavso.org/index.php?view=about.vartypes
// https://www.ivoa.net/rdf/object-type
// https://science.nasa.gov/universe/stars/types/
// https://www.ipac.caltech.edu/2mass/overview/dwarfs.html
const descriptions = {
  'Main-sequence': 'A star in the long, stable middle of its life, fusing hydrogen into helium in its core. Stars spend about 90% of their lives here; the Sun is one.',
  'Subgiant': 'A star that has used up the hydrogen in its core and is starting to swell on its way to becoming a giant.',
  'Giant': 'An evolved star swollen to many times its former size, far more luminous than a main-sequence star of the same temperature.',
  'Bright giant': 'An evolved star more luminous than an ordinary giant, but not as luminous as a supergiant.',
  'Subdwarf': 'A star slightly fainter than a main-sequence star of the same spectral type, usually because it is old and poor in heavy elements.',
  'Supergiant': 'One of the most massive and luminous stars, with a life of only millions of years. Many end as supernovae.',
  'Evolved supergiant': 'A massive star that has used up the hydrogen in its core and swollen to enormous size.',
  'Red giant': 'An aging star whose outer layers have swollen and cooled, giving it an orange-red glow. The Sun will become one in about 5 billion years.',
  'Red supergiant': 'A massive star late in its life, swollen to hundreds of times the Sun’s width and cool enough to glow red. Antares is one.',
  'Yellow supergiant': 'A very luminous star with a Sun-like surface temperature. Rare, because massive stars pass quickly through this stage.',
  'Blue supergiant': 'A massive star with a hot, blue-white surface, among the most luminous stars known. Rigel is one.',
  'Asymptotic giant branch': 'A late-stage giant fusing hydrogen and helium in shells around a carbon–oxygen core. It sheds its outer layers, which can later glow as a planetary nebula.',
  'Horizontal-branch': 'An aging low-mass star fusing helium in its core, the stage that follows the red giant.',
  'Hot subdwarf': 'A small, very hot star that has lost almost all of its hydrogen envelope, usually to a companion, exposing a helium-burning core.',
  'Low-mass star': 'A star with less mass than the Sun. It burns its fuel slowly and can shine far longer than the Sun.',
  'Blue straggler': 'A star hotter and brighter than others of its age should be, probably rejuvenated by gas from a companion or by a stellar merger.',
  'Pre-main-sequence': 'A young star still shrinking under its own gravity, before hydrogen fusion in its core takes over.',
  'Young stellar object': 'A star still forming or only recently formed, often wrapped in the gas and dust it grew from.',
  'T Tauri': 'A young star of up to about twice the Sun’s mass, typically under 10 million years old and often still feeding from a surrounding disk.',
  'Herbig Ae/Be': 'A young star of about 2–8 solar masses, the heavier counterpart of a T Tauri star, with a disk that adds emission lines to its spectrum.',
  'Wolf–Rayet': 'A hot, massive star whose fierce winds have stripped away its outer hydrogen. The winds produce broad, bright lines in its spectrum.',
  'Be star': 'A fast-spinning B-type star that has shed a disk of gas around its equator. The disk adds bright hydrogen lines to its spectrum.',
  'Emission-line star': 'A star whose spectrum shows bright lines from glowing gas in its atmosphere or surroundings.',
  'Chemically peculiar': 'A star with unusual amounts of certain elements at its surface, usually because elements sink or rise through its calm atmosphere.',
  'Carbon star': 'A cool giant with more carbon than oxygen in its atmosphere. Carbon molecules and soot make it one of the reddest stars in the sky.',
  'S-type star': 'A cool giant between ordinary red giants and carbon stars, with nearly equal carbon and oxygen. Its spectrum shows zirconium oxide.',
  'Spectroscopic binary': 'A pair too close to separate in a telescope, revealed by periodic shifts in their spectral lines as they orbit.',
  'Eclipsing binary': 'A pair whose orbit we see almost edge-on, so the stars take turns passing in front of each other and the light dips.',
  'Ellipsoidal variable': 'A close pair stretched into egg shapes by tides. The light changes as they turn their wider or narrower sides toward us, without eclipses.',
  'Symbiotic star': 'An interacting pair, usually a cool giant and a hot white dwarf, wrapped in gas flowing from the giant.',
  'Cataclysmic variable': 'A close pair in which a white dwarf pulls gas from a companion, causing flickering and sudden outbursts.',
  'Nova': 'A white dwarf pair whose stolen gas ignites in a runaway explosion, brightening the system thousands of times or more. Unlike a supernova, the star survives.',
  'X-ray binary': 'A pair in which gas from a star falls onto a neutron star or black hole, heating to millions of degrees and glowing in X-rays.',
  'Low-mass X-ray binary': 'An X-ray binary in which a companion of about the Sun’s mass or less feeds a neutron star or black hole.',
  'High-mass X-ray binary': 'An X-ray binary in which a massive, hot companion feeds a neutron star or black hole, often through its wind.',
  'Variable star': 'A star whose brightness changes over time. This label alone does not say why.',
  'Pulsating variable': 'A star whose brightness changes as it pulsates, swelling and shrinking or vibrating in more complex patterns.',
  'Rotating variable': 'A star whose brightness changes as it spins, turning spots or brighter patches into and out of view.',
  'Eruptive variable': 'A star with sudden brightness changes from flares or eruptions. Most nearby ones are flaring red dwarfs, such as Proxima Centauri.',
  'Irregular variable': 'A star whose brightness changes without a clear repeating pattern.',
  'Long-period variable': 'A pulsating cool giant or supergiant whose brightness changes over months or years.',
  'Mira variable': 'A pulsating red giant that brightens and fades more than tenfold over cycles of 80–1,000 days, named after Mira in Cetus.',
  'Semiregular variable': 'A pulsating giant or supergiant whose cycles repeat only roughly, interrupted by irregular changes.',
  'Cepheid variable': 'A luminous pulsating star whose cycle length reveals its true brightness, making it a yardstick for cosmic distances.',
  'Classical Cepheid': 'A young, massive Cepheid pulsating over days to weeks; the slower its cycle, the more luminous it is. Polaris is the nearest.',
  'Type II Cepheid': 'An old, low-mass pulsating star, fainter than a classical Cepheid with the same cycle length.',
  'RR Lyrae variable': 'An old, low-mass star fusing helium in its core and pulsating in under a day. All have similar luminosity, making them distance markers.',
  'Delta Scuti variable': 'An A- or F-type star with small, rapid pulsations that repeat within hours.',
  'Beta Cephei variable': 'A hot, massive B-type star with small pulsations that repeat within hours.',
  'Gamma Doradus variable': 'An A- or F-type star with slow, subtle pulsations that repeat over about a day.',
  'RV Tauri variable': 'A luminous star near the end of its life whose pulsation dips alternate between deep and shallow.',
  'Alpha² CVn variable': 'A magnetic, chemically peculiar star whose brightness changes as it spins, turning patches rich in certain elements toward us.',
  'BY Draconis variable': 'A cool dwarf whose brightness changes as dark starspots spin into and out of view. Many also flare.',
  'RS CVn variable': 'A close binary of magnetically active stars whose large starspots change its brightness as they rotate.',
  'Orion variable': 'A young star in or near a nebula whose brightness changes irregularly as it forms.',
  'Flare star': 'A star, usually a red dwarf, that can brighten sharply within minutes during a magnetic flare.',
  'FU Orionis variable': 'A young star that brightened a hundredfold or more within about a year as gas flooded in from its disk, then stayed bright for decades.',
  'R Coronae Borealis variable': 'A rare, luminous carbon-rich star that can fade up to a thousandfold when soot clouds form around it, then slowly recover.',
  'Neutron star': 'The collapsed core of a massive star, packing more than the Sun’s mass into a ball about 20 km across.',
  'Pulsar': 'A spinning neutron star whose beams of radiation sweep past Earth, appearing as regular pulses.',
  'L-type': 'A very cool dwarf, about 1,300–2,200 K, with dusty clouds in its atmosphere. The class includes the coolest stars and many brown dwarfs.',
  'T-type': 'A brown dwarf cool enough, about 500–1,300 K, for methane to form in its atmosphere, as in Jupiter’s.',
  'Y-type': 'The coldest brown dwarfs, below about 500 K. The coldest known is about as warm as Earth’s surface.',
} as const

export type ObjectSubtypeLabel = keyof typeof descriptions
export const OBJECT_SUBTYPE_LABELS: readonly ObjectSubtypeLabel[] = Object.keys(descriptions) as ObjectSubtypeLabel[]

// The label itself shows when a classification is only a candidate.
export function objectSubtypeDescription(label: string): string {
  const subtype = label.replace(/ candidate$/i, '').trim()
  return Object.hasOwn(descriptions, subtype)
    ? descriptions[subtype as ObjectSubtypeLabel]
    : 'A catalog classification supplied for this object; a description is not available yet.'
}
