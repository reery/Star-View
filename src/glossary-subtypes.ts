import type { GlossaryEntry } from './glossary-data'
import { OBJECT_SUBTYPE_LABELS, objectSubtypeDescription, type ObjectSubtypeLabel } from './object-subtype-info'
import fusionImage from './assets/glossary/stellar-fusion.svg'
import eclipseImage from './assets/glossary/eclipsing-binary.svg'
import ellipsoidalImage from './assets/glossary/ellipsoidal-variable.svg'
import accretionImage from './assets/glossary/accreting-binary.svg'
import pulsationImage from './assets/glossary/pulsating-star.svg'
import rotationImage from './assets/glossary/rotating-star.svg'
import youngStarImage from './assets/glossary/young-star.svg'
import spectrumImage from './assets/glossary/emission-lines.svg'

type SubtypeLabel = Exclude<ObjectSubtypeLabel, 'Neutron star' | 'Pulsar'>
type Illustration = Pick<GlossaryEntry, 'image' | 'caption' | 'imageAlt'>
interface SubtypeReference {
  source: string
  sourceLabel: string
  aliases: string
  context?: string
  illustration?: Illustration
}

const fusion: Illustration = {
  image: fusionImage,
  caption: 'Core and shell fusion in three stellar stages · schematic, not to scale',
  imageAlt: 'Cross-sections show hydrogen fusion in a main-sequence core; helium core fusion with a hydrogen shell on the horizontal branch; and hydrogen and helium shells around a carbon–oxygen core on the asymptotic giant branch.',
}
const eclipse: Illustration = {
  image: eclipseImage,
  caption: 'An eclipse blocks part of the pair’s combined light · schematic',
  imageAlt: 'A smaller star crosses in front of a larger star. The combined brightness falls during the overlap and recovers after the eclipse.',
}
const ellipsoidal: Illustration = {
  image: ellipsoidalImage,
  caption: 'A tidally stretched star presents a changing area as it orbits · schematic',
  imageAlt: 'A stretched star seen broadside presents a larger area and is brighter; seen end-on it presents a smaller area and is fainter. No star passes in front of the other.',
}
const accretion: Illustration = {
  image: accretionImage,
  caption: 'Gas can flow from a companion into a disk around a compact object · schematic, not to scale',
  imageAlt: 'Gas leaves a companion star and streams into an accretion disk around a compact object. The compact object can be a white dwarf, neutron star or black hole, depending on the binary class.',
}
const pulsation: Illustration = {
  image: pulsationImage,
  caption: 'Radial pulsation changes a star’s radius and temperature · schematic',
  imageAlt: 'A star alternately contracts and expands. A separate curve shows repeating changes in brightness; the drawing does not assign brightness maxima to a particular radius.',
}
const rotation: Illustration = {
  image: rotationImage,
  caption: 'Rotation carries uneven surface patches into and out of view · schematic',
  imageAlt: 'Three views of a rotating star show a darker surface patch appearing, crossing the visible face, and disappearing, changing the observed brightness.',
}
const youngStar: Illustration = {
  image: youngStarImage,
  caption: 'A young star can gather gas from a surrounding disk · schematic, not to scale',
  imageAlt: 'A young star sits at the center of a gas-and-dust disk. Arrows show material moving inward toward the star.',
}
const spectrum: Illustration = {
  image: spectrumImage,
  caption: 'Emission lines rise above the surrounding spectrum · schematic',
  imageAlt: 'An absorption spectrum has downward dips at selected wavelengths; an emission spectrum has upward peaks. Neither curve is a measured stellar spectrum.',
}

const simbad = (code: string, aliases: string, illustration?: Illustration): SubtypeReference => ({
  source: `https://simbad.cds.unistra.fr/simbad/otypes#${encodeURIComponent(code)}`,
  sourceLabel: 'SIMBAD', aliases, illustration,
})
const variable = (code: string, aliases: string, illustration?: Illustration): SubtypeReference => ({
  source: 'https://vsx.aavso.org/index.php?view=about.vartypes',
  sourceLabel: 'AAVSO', aliases: `${code} ${aliases}`, illustration,
})
const evolution = (aliases: string, context: string, illustration?: Illustration): SubtypeReference => ({
  source: 'https://science.nasa.gov/universe/stars/types/',
  sourceLabel: 'NASA', aliases, context, illustration,
})

// Cover every supported catalog label, including classes absent from today's
// bundled snapshot. Reuse the Specs descriptions to keep both views consistent.
const references = {
  'Main-sequence': evolution('main sequence dwarf luminosity class V', 'In the Morgan–Keenan spectral system, luminosity class V usually identifies this stage.', fusion),
  'Subgiant': { source: 'https://heasarc.gsfc.nasa.gov/W3Browse/rosat/rassdwarf.html', sourceLabel: 'NASA', aliases: 'luminosity class IV stellar evolution', context: 'Luminosity class IV identifies subgiant spectra; it is a spectral classification, rather than an age measurement.' },
  'Giant': evolution('luminosity class III evolved star', 'Luminosity class III identifies giant spectra. A giant need not be red.'),
  'Bright giant': { source: 'https://archive.stsci.edu/spec_class/spec_class_tables.html', sourceLabel: 'STScI', aliases: 'luminosity class II bright giant', context: 'This label follows the adopted spectral luminosity class; it does not supply a mass or age.' },
  'Subdwarf': { source: 'https://archive.stsci.edu/spec_class/spec_class_tables.html', sourceLabel: 'STScI', aliases: 'luminosity class VI subdwarf sd', context: 'This is a spectral luminosity classification, distinct from the hot-subdwarf object subtype.' },
  'Supergiant': evolution('luminosity class I Ia Iab Ib massive star', 'Supergiants can have red, yellow or blue surfaces; size and color are separate properties.'),
  'Evolved supergiant': simbad('sg*', 'evolved supergiant luminosity class I'),
  'Red giant': simbad('RG*', 'RGB red giant branch cool evolved star'),
  'Red supergiant': simbad('s*r', 'RSG cool massive star'),
  'Yellow supergiant': simbad('s*y', 'YSG yellow massive star'),
  'Blue supergiant': simbad('s*b', 'BSG hot massive star'),
  'Asymptotic giant branch': simbad('AB*', 'AGB shell fusion carbon oxygen core', fusion),
  'Horizontal-branch': simbad('HB*', 'horizontal branch HB helium core fusion', fusion),
  'Hot subdwarf': simbad('HS*', 'sdB sdO stripped envelope'),
  'Low-mass star': { ...simbad('LM*', 'low mass star small star'), context: 'This is a broad mass category, rather than a particular color or luminosity class.' },
  'Blue straggler': simbad('BS*', 'cluster merger mass transfer rejuvenated star'),
  'Pre-main-sequence': simbad('pMS*', 'pre main sequence PMS contracting young star', youngStar),
  'Young stellar object': simbad('Y*O', 'YSO protostar star formation', youngStar),
  'T Tauri': simbad('TT*', 'TTS T Tauri star young low mass', youngStar),
  'Herbig Ae/Be': simbad('Ae*', 'Herbig Ae Be HAeBe young intermediate mass star', youngStar),
  'Wolf–Rayet': simbad('WR*', 'Wolf Rayet WR WN WC WO wind emission', spectrum),
  'Be star': { ...simbad('Be*', 'B emission Balmer disk rapid rotation', spectrum), context: 'The “e” denotes emission lines. This label is distinct from the young Herbig Ae/Be class.' },
  'Emission-line star': simbad('Em*', 'emission line bright spectral lines', spectrum),
  'Chemically peculiar': simbad('Pe*', 'CP peculiar abundances Ap Bp Am'),
  'Carbon star': { ...simbad('C*', 'carbon rich C/O C star'), context: 'Carbon-bearing molecules give its spectrum distinctive absorption bands.' },
  'S-type star': { ...simbad('S*', 'S star zirconium oxide ZrO'), context: 'This is a stellar spectrum classification; it does not refer to an S-type planetary orbit.' },
  'Spectroscopic binary': { ...simbad('SB*', 'SB1 SB2 Doppler radial velocity binary'), source: 'https://www.eso.org/public/ireland/news/eso0133/', sourceLabel: 'ESO' },
  'Eclipsing binary': simbad('EB*', 'eclipse EA EB EW occultation light curve', eclipse),
  'Ellipsoidal variable': variable('ELL', 'tidal deformation close binary projected area', ellipsoidal),
  'Symbiotic star': simbad('Sy*', 'symbiotic binary interacting giant white dwarf'),
  'Cataclysmic variable': simbad('CV*', 'CV accreting white dwarf dwarf nova', accretion),
  'Nova': { ...variable('N', 'classical nova thermonuclear outburst white dwarf', accretion), context: 'A nova differs from a supernova: the white dwarf generally survives the outburst.' },
  'X-ray binary': simbad('XB*', 'X ray XB accretion compact companion', accretion),
  'Low-mass X-ray binary': simbad('LXB', 'low mass X ray LMXB donor', accretion),
  'High-mass X-ray binary': simbad('HXB', 'high mass X ray HMXB donor', accretion),
  'Variable star': { ...simbad('V*', 'variability light curve brightness'), context: 'Changes may originate within the star, at its surface, or from an orbiting companion.' },
  'Pulsating variable': { ...simbad('Pu*', 'pulsation oscillation radial nonradial', pulsation), context: 'Some pulsations affect the whole radius; others are waves across the stellar surface.' },
  'Rotating variable': variable('ROT', 'rotation surface patches spots', rotation),
  'Eruptive variable': simbad('Er*', 'eruption stellar activity brightness'),
  'Irregular variable': variable('L', 'irregular variability nonperiodic'),
  'Long-period variable': simbad('LP*', 'LPV long period cool giant pulsation', pulsation),
  'Mira variable': variable('M', 'Mira long period pulsating red giant', pulsation),
  'Semiregular variable': variable('SR', 'semi regular semiregular giant supergiant pulsation'),
  'Cepheid variable': variable('CEP', 'Cepheid period luminosity distance pulsation', pulsation),
  'Classical Cepheid': variable('DCEP', 'delta Cephei Type I Cepheid young population I', pulsation),
  'Type II Cepheid': variable('CW CWA CWB', 'W Virginis BL Herculis old population II', pulsation),
  'RR Lyrae variable': variable('RR RRAB RRC', 'RR Lyrae horizontal branch old distance marker', pulsation),
  'Delta Scuti variable': variable('DSCT', 'delta Scuti δ Scuti short period oscillation'),
  'Beta Cephei variable': { ...variable('BCEP', 'beta Cephei β Cephei hot pulsator'), context: 'Despite its name, this is a different class from Cepheid variables.' },
  'Gamma Doradus variable': variable('GDOR', 'gamma Doradus γ Doradus nonradial gravity modes'),
  'RV Tauri variable': variable('RV RVA RVB', 'RV Tauri alternating deep shallow minima'),
  'Alpha² CVn variable': variable('ACV', 'alpha2 alpha² Canum Venaticorum α² CVn magnetic chemical patches', rotation),
  'BY Draconis variable': variable('BY', 'BY Draconis cool dwarf starspots', rotation),
  'RS CVn variable': variable('RS', 'RS Canum Venaticorum active binary starspots', rotation),
  'Orion variable': variable('IN', 'Orion young irregular nebulosity', youngStar),
  'Flare star': variable('UV', 'UV Ceti flare magnetic eruption'),
  'FU Orionis variable': variable('FU', 'FU Orionis FUor young accretion outburst', youngStar),
  'R Coronae Borealis variable': variable('RCB', 'R Coronae Borealis R CrB carbon dust fading'),
  'L-type': { source: 'https://www.ipac.caltech.edu/2mass/overview/dwarfs.html', sourceLabel: 'IPAC', aliases: 'L type L dwarf ultracool spectral class metal hydrides alkali', context: 'The spectral label alone does not establish whether the object sustains hydrogen fusion.' },
  'T-type': { source: 'https://www.ipac.caltech.edu/2mass/overview/dwarfs.html', sourceLabel: 'IPAC', aliases: 'T type T dwarf methane brown dwarf spectral class', context: 'It follows L in the cool-dwarf spectral sequence; the classification comes from the spectrum.' },
  'Y-type': { source: 'https://apod.nasa.gov/apod/ap110830.html', sourceLabel: 'NASA', aliases: 'Y type Y dwarf cold brown dwarf spectral class', context: 'It follows T in the cool-dwarf spectral sequence.' },
} satisfies Record<SubtypeLabel, SubtypeReference>

export const GLOSSARY_SUBTYPES: readonly GlossaryEntry[] = OBJECT_SUBTYPE_LABELS
  // These have illustrated articles already, so do not duplicate them.
  .filter((label): label is SubtypeLabel => label !== 'Neutron star' && label !== 'Pulsar')
  .map((label) => {
    const reference: SubtypeReference = references[label]
    return {
      id: `subtype-${label.toLowerCase().replace(/[²]/g, '2').replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
      title: label,
      group: 'Object sub-types',
      description: [objectSubtypeDescription(label), reference.context,
        'A catalog label ending in “candidate” means this classification is unconfirmed.'].filter(Boolean).join(' '),
      source: reference.source,
      sourceLabel: reference.sourceLabel,
      aliases: `${reference.aliases} ${label} candidate`,
      ...reference.illustration,
      imageFit: 'contain',
      imageCredit: reference.illustration ? 'Star View · original schematic' : undefined,
    }
  })
