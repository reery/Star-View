// Plain-language summaries of catalog labels, not new classifications.
// References: https://vsx.aavso.org/index.php?view=about.vartypes
// https://www.ivoa.net/rdf/object-type
// https://science.nasa.gov/universe/stars/types/
// https://www.ipac.caltech.edu/2mass/overview/dwarfs.html
const descriptions = {
  'Main-sequence': 'A star in its long, stable phase of life, powered by hydrogen fusion in its core. The Sun is one.',
  'Subgiant': 'A star beginning to expand after using up the hydrogen fuel in its core, on its way toward becoming a giant.',
  'Giant': 'An evolved star with an expanded outer envelope, larger and usually brighter than a main-sequence star of the same temperature.',
  'Supergiant': 'An exceptionally large, luminous star. This class describes its spectrum and can include different stages of stellar evolution.',
  'Evolved supergiant': 'A very luminous, expanded star that has moved beyond the hydrogen-burning stage of its core.',
  'Red giant': 'An aging star whose outer layers have expanded and cooled, giving it an orange or reddish appearance.',
  'Red supergiant': 'A massive evolved star with an enormous, relatively cool outer envelope and a reddish appearance.',
  'Yellow supergiant': 'A very luminous, expanded star with a surface temperature that gives it a yellowish appearance.',
  'Blue supergiant': 'A very luminous star with a hot surface that gives it a blue or blue-white appearance.',
  'Asymptotic giant branch': 'A late stage of a giant star, with hydrogen and helium burning in shells around a carbon-and-oxygen core.',
  'Horizontal-branch': 'An evolved star burning helium in its core after passing through the red-giant stage.',
  'Hot subdwarf': 'A small, hot evolved star with much of its outer hydrogen envelope stripped away.',
  'Low-mass star': 'A star with relatively little mass, generally using its fuel more slowly than a more massive star.',
  'Blue straggler': 'A star unusually blue and bright for its aging stellar group, often explained by a merger or mass transfer.',
  'Pre-main-sequence': 'A young star still contracting toward the stable stage when hydrogen fusion powers its core.',
  'Young stellar object': 'A star in the early stages of formation or evolution, often still surrounded by gas and dust.',
  'T Tauri': 'A young, low-mass star still settling toward the main sequence, often showing magnetic activity and a surrounding disk.',
  'Herbig Ae/Be': 'A young A- or B-type star still approaching the main sequence, with surrounding material that produces emission lines.',
  'Wolf–Rayet': 'A very hot star losing material through powerful stellar winds, which produce broad, bright lines in its spectrum.',
  'Be star': 'A B-type star whose spectrum shows hydrogen emission, usually from a gas disk around the rapidly rotating star.',
  'Emission-line star': 'A star whose spectrum contains bright lines from glowing gas, in its atmosphere or surrounding material.',
  'Chemically peculiar': 'A star whose spectrum shows unusual amounts of certain elements compared with typical stars of similar temperature.',
  'Carbon star': 'A star with more carbon than oxygen in its atmosphere, often a cool giant with a deep reddish appearance.',
  'S-type star': 'Usually a cool giant whose spectrum shows zirconium oxide, with atmospheric carbon and oxygen in roughly similar amounts.',
  'Spectroscopic binary': 'An orbiting pair revealed by shifts in its spectral lines, even when a telescope cannot separate the stars.',
  'Eclipsing binary': 'An orbiting pair that dims when one star passes in front of the other from our viewpoint.',
  'Ellipsoidal variable': 'A close binary whose stretched stars show different projected areas as they orbit, changing the brightness we see.',
  'Symbiotic star': 'An interacting pair, typically a cool giant and a hot compact companion, with gas flowing between them.',
  'Cataclysmic variable': 'An interacting binary in which a white dwarf draws in gas from a companion, causing brightness changes or outbursts.',
  'Nova': 'An outburst caused by explosive burning of gas accumulated on a white dwarf from its companion.',
  'X-ray binary': 'A binary emitting X-rays as gas from a companion falls toward a neutron star or black hole.',
  'Low-mass X-ray binary': 'An X-ray binary in which a relatively low-mass companion supplies gas to a neutron star or black hole.',
  'High-mass X-ray binary': 'An X-ray binary in which a massive companion supplies gas to a neutron star or black hole.',
  'Variable star': 'A star whose observed brightness changes over time. This broad label does not specify the cause.',
  'Pulsating variable': 'A star that repeatedly expands and contracts, changing its temperature and brightness.',
  'Rotating variable': 'A star whose brightness changes as rotation brings unevenly bright surface regions or surrounding structures into view.',
  'Eruptive variable': 'A star with brightness changes linked to activity or eruptions in its atmosphere or surrounding material.',
  'Irregular variable': 'A star whose brightness changes without a clear, regular repeating pattern.',
  'Long-period variable': 'Usually a cool giant or supergiant whose brightness varies over long cycles, often months or years.',
  'Mira variable': 'A cool pulsating giant with large brightness changes over cycles lasting many months.',
  'Semiregular variable': 'A giant or supergiant with partly repeating brightness cycles interrupted by irregular changes.',
  'Cepheid variable': 'A luminous star that brightens and fades as it pulsates. Its cycle length helps astronomers estimate distances.',
  'Classical Cepheid': 'A relatively young, luminous pulsating star whose cycle length is closely linked to its luminosity, making it a distance marker.',
  'Type II Cepheid': 'An older, lower-mass pulsating star, fainter than a classical Cepheid with the same cycle length.',
  'RR Lyrae variable': 'An old pulsating star, usually burning helium in its core, whose short brightness cycles help measure distances.',
  'Delta Scuti variable': 'An A- or F-type star with small, rapid pulsations, often completing a brightness cycle in a few hours.',
  'Beta Cephei variable': 'A hot, massive star whose pulsations cause brightness changes over a few hours.',
  'Gamma Doradus variable': 'An A- or F-type star with gentle pulsations across its surface, typically cycling over about a day.',
  'RV Tauri variable': 'An evolved pulsating star whose brightness dips usually alternate between deeper and shallower minima.',
  'Alpha² CVn variable': 'A magnetic, chemically peculiar star whose brightness changes as rotation reveals surface patches with different element abundances.',
  'BY Draconis variable': 'A cool star whose brightness changes as dark starspots rotate into and out of view. Some also flare.',
  'RS CVn variable': 'A magnetically active binary whose starspots cause brightness changes as the stars rotate.',
  'Orion variable': 'A young star associated with nebulosity, showing irregular brightness changes during its early evolution.',
  'Flare star': 'A star that suddenly brightens when magnetic energy is released in a flare, then fades again.',
  'FU Orionis variable': 'A young star with a major, lasting brightening linked to a surge of gas falling in from its disk.',
  'R Coronae Borealis variable': 'A carbon-rich star that can fade dramatically when newly formed dust obscures its light.',
  'Neutron star': 'An extremely dense remnant of a massive star, packing roughly a stellar mass into a body the size of a city.',
  'Pulsar': 'A rotating neutron star whose radiation beams produce repeating pulses when they sweep across Earth.',
  'L-type': 'A cool spectral class identified by metal compounds and alkali metals. It includes brown dwarfs and the coolest low-mass stars.',
  'T-type': 'A cooler dwarf spectral class with strong methane absorption, radiating most of its light in the infrared.',
  'Y-type': 'The coolest dwarf spectral class, with extremely faint visible light and most of its radiation in the infrared.',
} as const

export type ObjectSubtypeLabel = keyof typeof descriptions
export const OBJECT_SUBTYPE_LABELS: readonly ObjectSubtypeLabel[] = Object.keys(descriptions) as ObjectSubtypeLabel[]

export function objectSubtypeDescription(label: string): string {
  const candidate = / candidate$/i.test(label)
  const subtype = label.replace(/ candidate$/i, '').trim()
  const description = Object.hasOwn(descriptions, subtype)
    ? descriptions[subtype as ObjectSubtypeLabel]
    : 'A catalog classification supplied for this object; a description is not available yet.'
  return candidate ? `${description} The catalog marks this classification as unconfirmed.` : description
}
