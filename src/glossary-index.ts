import { OBJECT_SUBTYPE_LABELS, objectSubtypeDescription, type ObjectSubtypeLabel } from './object-subtype-info'

export const GLOSSARY_GROUPS = ['Stars', 'Star lives', 'Stellar remnants', 'Double & multiple stars', 'Variable stars', 'Nebulae & interstellar space', 'Distance & size', 'Light & brightness', 'Spectra', 'Stellar properties', 'Sky & coordinates', 'Motion & orbits', 'Planets', 'Catalogs & data'] as const
export type GlossaryGroup = typeof GLOSSARY_GROUPS[number]

/** What the list, search and the first line of an article need; loaded when the glossary opens. */
export interface GlossaryTerm {
  id: string
  title: string
  group: GlossaryGroup
  summary: string
  aliases: string
}

export interface GlossaryFigure {
  image: string
  caption: string
  alt?: string
  position?: string
  fit?: 'cover' | 'contain'
  credit?: string
  creditUrl?: string
}

export type GlossaryWidget = 'temperature' | 'parallax' | 'magnitude' | 'orbit' | 'lightcurve' | 'hr' | 'fate' | 'habitable' | 'velocity' | 'angular' | 'coordinates'

export interface GlossarySection {
  title: string
  text: string
  /** Where this section's facts come from, when not the article's own source. */
  source?: string
  figure?: GlossaryFigure
}

/** The rest of an article, loaded with its group. */
export interface GlossaryArticle {
  source: string
  sourceLabel?: string
  /** Further pages the article's facts rest on: Wikipedia page names, or full URLs. */
  also?: readonly string[]
  /** A classification or reference page beside the main source. */
  reference?: { label: string; url: string }
  figure?: GlossaryFigure
  details?: string
  interactive?: { id: GlossaryWidget; variant?: string }
  sections?: readonly GlossarySection[]
  /** One collapsed part with notation and numbers for hobbyists. */
  deeper?: string
  related?: readonly string[]
}

export const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`

type TermRow = readonly [id: string, title: string, summary: string, aliases?: string]
const terms = (group: GlossaryGroup, rows: readonly TermRow[]): GlossaryTerm[] =>
  rows.map(([id, title, summary, aliases = '']) => ({ id, title, group, summary, aliases }))

export type SubtypeLabel = Exclude<ObjectSubtypeLabel, 'Neutron star' | 'Pulsar'>
export const subtypeId = (label: string) => `subtype-${label.toLowerCase().replace(/[²]/g, '2').replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`

const subtypeTerms: Record<SubtypeLabel, readonly [GlossaryGroup, string]> = {
  'Low-mass star': ['Stars', 'low mass star small star'],
  'Wolf–Rayet': ['Stars', 'Wolf Rayet WR WN WC WO wind emission'],
  'Be star': ['Stars', 'B emission Balmer disk rapid rotation'],
  'Emission-line star': ['Stars', 'emission line bright spectral lines'],
  'Chemically peculiar': ['Stars', 'CP peculiar abundances Ap Bp Am'],
  'Carbon star': ['Stars', 'carbon rich C/O C star'],
  'S-type star': ['Stars', 'S star zirconium oxide ZrO'],
  'L-type': ['Stars', 'L type L dwarf ultracool spectral class metal hydrides alkali'],
  'T-type': ['Stars', 'T type T dwarf methane brown dwarf spectral class'],
  'Y-type': ['Stars', 'Y type Y dwarf cold brown dwarf spectral class'],
  'Pre-main-sequence': ['Star lives', 'pre main sequence PMS contracting young star'],
  'Young stellar object': ['Star lives', 'YSO protostar star formation'],
  'T Tauri': ['Star lives', 'TTS T Tauri star young low mass'],
  'Herbig Ae/Be': ['Star lives', 'Herbig Ae Be HAeBe young intermediate mass star'],
  'Main-sequence': ['Star lives', 'main sequence dwarf luminosity class V'],
  'Subgiant': ['Star lives', 'luminosity class IV stellar evolution'],
  'Giant': ['Star lives', 'luminosity class III evolved star'],
  'Bright giant': ['Star lives', 'luminosity class II bright giant'],
  'Red giant': ['Star lives', 'RGB red giant branch cool evolved star'],
  'Horizontal-branch': ['Star lives', 'horizontal branch HB helium core fusion'],
  'Asymptotic giant branch': ['Star lives', 'AGB shell fusion carbon oxygen core'],
  'Supergiant': ['Star lives', 'luminosity class I Ia Iab Ib massive star'],
  'Evolved supergiant': ['Star lives', 'evolved supergiant luminosity class I'],
  'Red supergiant': ['Star lives', 'RSG cool massive star'],
  'Yellow supergiant': ['Star lives', 'YSG yellow massive star'],
  'Blue supergiant': ['Star lives', 'BSG hot massive star'],
  'Subdwarf': ['Star lives', 'luminosity class VI subdwarf sd'],
  'Hot subdwarf': ['Star lives', 'sdB sdO stripped envelope'],
  'Blue straggler': ['Star lives', 'cluster merger mass transfer rejuvenated star'],
  'Spectroscopic binary': ['Double & multiple stars', 'SB1 SB2 Doppler radial velocity binary'],
  'Eclipsing binary': ['Double & multiple stars', 'eclipse EA EB EW occultation light curve'],
  'Ellipsoidal variable': ['Double & multiple stars', 'ELL tidal deformation close binary projected area'],
  'Symbiotic star': ['Double & multiple stars', 'symbiotic binary interacting giant white dwarf'],
  'Cataclysmic variable': ['Double & multiple stars', 'CV accreting white dwarf dwarf nova'],
  'Nova': ['Double & multiple stars', 'N classical nova thermonuclear outburst white dwarf'],
  'X-ray binary': ['Double & multiple stars', 'X ray XB accretion compact companion'],
  'Low-mass X-ray binary': ['Double & multiple stars', 'low mass X ray LMXB donor'],
  'High-mass X-ray binary': ['Double & multiple stars', 'high mass X ray HMXB donor'],
  'Variable star': ['Variable stars', 'variability light curve brightness'],
  'Pulsating variable': ['Variable stars', 'pulsation oscillation radial nonradial'],
  'Rotating variable': ['Variable stars', 'ROT rotation surface patches spots'],
  'Eruptive variable': ['Variable stars', 'eruption stellar activity brightness'],
  'Irregular variable': ['Variable stars', 'L irregular variability nonperiodic'],
  'Long-period variable': ['Variable stars', 'LPV long period cool giant pulsation'],
  'Mira variable': ['Variable stars', 'M Mira long period pulsating red giant'],
  'Semiregular variable': ['Variable stars', 'SR semi regular semiregular giant supergiant pulsation'],
  'Cepheid variable': ['Variable stars', 'CEP Cepheid period luminosity distance pulsation'],
  'Classical Cepheid': ['Variable stars', 'DCEP delta Cephei Type I Cepheid young population I'],
  'Type II Cepheid': ['Variable stars', 'CW CWA CWB W Virginis BL Herculis old population II'],
  'RR Lyrae variable': ['Variable stars', 'RR RRAB RRC RR Lyrae horizontal branch old distance marker'],
  'Delta Scuti variable': ['Variable stars', 'DSCT delta Scuti δ Scuti short period oscillation'],
  'Beta Cephei variable': ['Variable stars', 'BCEP beta Cephei β Cephei hot pulsator'],
  'Gamma Doradus variable': ['Variable stars', 'GDOR gamma Doradus γ Doradus nonradial gravity modes'],
  'RV Tauri variable': ['Variable stars', 'RV RVA RVB RV Tauri alternating deep shallow minima'],
  'Alpha² CVn variable': ['Variable stars', 'ACV alpha2 alpha² Canum Venaticorum α² CVn magnetic chemical patches'],
  'BY Draconis variable': ['Variable stars', 'BY BY Draconis cool dwarf starspots'],
  'RS CVn variable': ['Variable stars', 'RS RS Canum Venaticorum active binary starspots'],
  'Orion variable': ['Variable stars', 'IN Orion young irregular nebulosity'],
  'Flare star': ['Variable stars', 'UV UV Ceti flare magnetic eruption'],
  'FU Orionis variable': ['Variable stars', 'FU FU Orionis FUor young accretion outburst'],
  'R Coronae Borealis variable': ['Variable stars', 'RCB R Coronae Borealis R CrB carbon dust fading'],
}

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  ...terms('Stars', [
    ['star', 'Star', 'A star is a vast ball of hot gas that shines by its own power, held together by its own gravity.'],
    ['sun', 'Sun', 'The Sun is the star at the center of our Solar System and the yardstick for measuring other stars.'],
    ['star-o', 'Blue star', 'The hottest, most massive and shortest-lived ordinary stars, shining a fierce blue.', 'O-type spectral class main sequence'],
    ['star-b', 'Blue-white star', 'Hot, massive, blue-white stars that light up the gas around them.', 'B-type spectral class main sequence'],
    ['star-a', 'White star', 'White stars somewhat heavier and much brighter than the Sun.', 'A-type spectral class main sequence'],
    ['star-f', 'Yellow-white star', 'Yellow-white stars a little hotter and heavier than the Sun.', 'F-type spectral class main sequence'],
    ['star-g', 'Sun-like star', 'Yellowish stars like the Sun, with surfaces of roughly 5,200–6,000 K.', 'G-type spectral class main sequence'],
    ['star-k', 'Orange dwarf', 'Orange stars a little smaller and cooler than the Sun that can shine for tens of billions of years.', 'K-type spectral class main sequence'],
    ['star-m', 'Red dwarf', 'The smallest, coolest and most common true stars: dim, red and extremely long-lived.', 'M-type spectral class main sequence'],
    ['brown_dwarf', 'Brown dwarf', 'A brown dwarf is an object too heavy to be called a planet but too light to shine like a star.'],
    ['sub_brown_dwarf', 'Sub-brown dwarf', 'A sub-brown dwarf is a lonely object with the mass of a planet that forms the way a star does.'],
  ]),
  ...terms('Star lives', [
    ['stellar-evolution', 'Stellar evolution', 'Stellar evolution is the story of how a star changes from birth to death, a path set mainly by its mass.', 'life cycle of stars birth death'],
    ['nuclear-fusion', 'Nuclear fusion', 'Nuclear fusion joins light atomic nuclei into heavier ones, releasing the energy that makes stars shine.', 'hydrogen helium proton-proton CNO burning'],
    ['stellar-wind', 'Stellar wind', 'A stellar wind is the steady stream of gas a star blows into space.', 'solar wind mass loss'],
    ['supernova', 'Supernova', 'A supernova is the explosion of a star, briefly as bright as a whole galaxy.', 'supernovae explosion type Ia II core collapse'],
  ]),
  ...terms('Stellar remnants', [
    ['white_dwarf', 'White dwarf', 'A white dwarf is the dense remnant left when a star like the Sun sheds its outer layers.'],
    ['neutron_star', 'Neutron star', 'A neutron star is the collapsed core left behind when a massive star explodes as a supernova.', 'neutron star candidate'],
    ['pulsar', 'Pulsar', 'A pulsar is a rapidly rotating, strongly magnetized neutron star that sends beams of radiation into space.', 'pulsar candidate'],
    ['black_hole', 'Black hole', 'A black hole is a region where gravity is so strong that nothing, not even light, can get out.'],
    ['supernova_remnant', 'Supernova remnant', 'A supernova remnant is the expanding debris and shocked surrounding gas left by a stellar explosion.'],
    ['pulsar_wind_nebula', 'Pulsar-wind nebula', 'A pulsar-wind nebula is a cloud powered by energetic particles flowing from a pulsar.', 'plerion'],
    ['characteristic-age', 'Characteristic age', 'A pulsar’s characteristic age is an estimate of its age, based on how fast it spins and how quickly it is slowing down.', 'pulsar spin-down age'],
    ['spin-down-power', 'Spin-down power', 'Spin-down power is the energy a pulsar releases each second as its spin slows.', 'pulsar rotational energy watts'],
    ['magnetic-field', 'Surface magnetic field', 'A surface magnetic field is the strength of an object’s magnetism at its surface, enormous on neutron stars.', 'magnetism tesla gauss G'],
    ['chandrasekhar-limit', 'Chandrasekhar limit', 'The Chandrasekhar limit is the greatest mass a white dwarf can have, about 1.4 times the Sun’s.', 'white dwarf maximum mass collapse 1.4'],
    ['degenerate-matter', 'Degenerate matter', 'Degenerate matter is gas crushed so tightly that quantum physics, not heat, holds it up against gravity.', 'electron degeneracy pressure neutron Pauli'],
    ['event-horizon', 'Event horizon', 'An event horizon is the boundary around a black hole beyond which nothing can return.', 'Schwarzschild radius black hole boundary'],
    ['dispersion-measure', 'Dispersion measure', 'Dispersion measure counts the free electrons between a pulsar and us, by how much they delay its radio pulses.', 'DM pc/cm3 pulsar radio delay'],
    ['pulsar-glitch', 'Pulsar glitch', 'A pulsar glitch is a sudden, tiny jump in a pulsar’s spin.', 'glitches spin-up Vela'],
  ]),
  ...terms('Double & multiple stars', [
    ['binary', 'Binary star', 'A binary star consists of two stars held together by gravity, orbiting their common center of mass.', 'binaries companion'],
    ['multiple_system', 'Multiple star system', 'A multiple star system contains three or more stars bound together by gravity.', 'multiple systems triples'],
    ['optical-double', 'Optical double', 'An optical double is two stars that look close together in the sky but are not actually near each other.', 'double star line of sight visual binary Mizar'],
    ['roche-lobe', 'Roche lobe', 'A Roche lobe is the region around a star in a binary where its own gravity keeps hold of its gas.', 'mass transfer overflow contact binary'],
    ['accretion-disk', 'Accretion disk', 'An accretion disk is a flat, hot, spinning disk of gas spiraling onto a star or compact object.', 'accretion disc infall'],
  ]),
  ...terms('Variable stars', [
    ['light-curve', 'Light curve', 'A light curve is a graph of an object’s brightness over time.', 'brightness time photometry period'],
    ['period-luminosity', 'Period–luminosity relation', 'The period–luminosity relation links how long a pulsating star takes to brighten and fade to how powerful it is.', 'Leavitt law Cepheid distance standard candle'],
  ]),
  ...terms('Nebulae & interstellar space', [
    ['reflection_nebula', 'Reflection nebula', 'A reflection nebula is a cloud of interstellar dust that shines by scattering light from nearby stars.'],
    ['hii_region', 'H II region', 'An H II region is a glowing cloud of hydrogen lit up by the fierce ultraviolet light of young, hot stars.'],
    ['planetary_nebula', 'Planetary nebula', 'A planetary nebula is an expanding shell of glowing gas expelled by an aging star.'],
    ['molecular_cloud', 'Molecular cloud', 'A molecular cloud is a cold, dense cloud of gas and dust, and the place where stars are born.'],
    ['bubble', 'Bubble', 'An interstellar bubble is a cavity in the gas between stars, blown out by stellar winds or supernova explosions.'],
    ['superbubble', 'Superbubble', 'A superbubble is a huge cavity of hot, thin gas blown out by groups of massive stars and their supernovae.'],
    ['dark_nebula', 'Dark nebula', 'A dark nebula is a dense interstellar cloud whose dust blocks visible light from objects behind it.'],
    ['dust_sheet', 'Dust sheet', 'A dust sheet is a thin layer of the tiny solid grains that float between the stars.', 'interstellar dust'],
    ['interstellar-medium', 'Interstellar medium', 'The interstellar medium is the thin gas and dust that fills the space between the stars.', 'ISM gas dust'],
    ['local-bubble', 'Local Bubble', 'The Local Bubble is the hot, thin cavity in the interstellar medium that surrounds the Sun.', 'Local Hot Bubble Solar System neighborhood supernovae'],
    ['star-cluster', 'Star cluster', 'A star cluster is a group of stars born together and bound by gravity.', 'open cluster globular association Pleiades'],
    ['milky-way', 'Milky Way', 'The Milky Way is our home galaxy, a barred spiral of more than 100 billion stars.', 'Galaxy galactic disk bar spiral'],
  ]),
  ...terms('Distance & size', [
    ['parsec', 'Parsec', 'A parsec (pc) is a distance of approximately 3.26 light-years.', 'pc kiloparsec kpc megaparsec'],
    ['lightyear', 'Lightyear', 'A light-year is the distance light travels in one year: about 9.46 trillion kilometers.', 'light year light-year ly'],
    ['astronomical-unit', 'Astronomical unit', 'An astronomical unit (au) is about the distance between Earth and the Sun: nearly 150 million kilometers.', 'au AU'],
    ['parallax', 'Parallax', 'Parallax is the small shift of a nearby star against far-away stars as Earth orbits the Sun, and it gives the star’s distance.', 'astrometry mas distance'],
    ['apparent-size', 'Apparent size', 'Apparent size is how wide an object looks, measured as the angle it covers on the sky.', 'angular diameter extent arcmin arcsec'],
    ['arcsecond', 'Arcsecond', 'An arcsecond is a tiny angle on the sky: 1/3,600 of a degree.', 'arcminute mas milliarcsecond angle minute second of arc'],
    ['distance-ladder', 'Cosmic distance ladder', 'The cosmic distance ladder is the chain of methods astronomers use to measure ever greater distances.', 'standard candle distance measurement Cepheid supernova'],
  ]),
  ...terms('Light & brightness', [
    ['apparent-magnitude', 'Apparent magnitude', 'Apparent magnitude is how bright an object looks from Earth, on a scale where smaller numbers mean brighter.', 'magnitude brightness mag'],
    ['absolute-magnitude', 'Absolute magnitude', 'Absolute magnitude is how bright an object would look from a standard distance of 10 parsecs, which makes true power easy to compare.', 'absolute mag V Mv'],
    ['bolometric-luminosity', 'Bolometric luminosity', 'Bolometric luminosity is the total power an object gives off, counting all light, seen and unseen.', 'brightness power Lsun luminosity_solar'],
    ['solar-luminosity', 'Solar luminosity', 'Solar luminosity (L☉) is the Sun’s total power, used as the unit for comparing stars.', 'Lsun L☉'],
    ['inverse-square-law', 'Inverse-square law', 'The inverse-square law says that an object at twice the distance looks four times fainter.', 'flux distance dimming brightness'],
    ['color-index', 'Color index', 'A color index measures a star’s color by comparing its brightness through two filters.', 'B−V B-V color photometry'],
    ['passband', 'Passband', 'A passband is the range of wavelengths a filter lets through, such as the V band used for visual magnitudes.', 'filter photometric system UBV G band J H K'],
    ['extinction', 'Extinction', 'Extinction is the dimming of starlight by dust between a star and us.', 'interstellar reddening dust absorption A_V'],
  ]),
  ...terms('Spectra', [
    ['spectral-type', 'Spectral type', 'A spectral type is a star’s classification, read from the pattern in its light, and it mainly reveals surface temperature.', 'stellar classification spectrum'],
    ['hr-diagram', 'Hertzsprung–Russell diagram', 'The Hertzsprung–Russell (HR) diagram plots stars by temperature and luminosity, revealing how they live and age.', 'HR diagram H-R CMD color magnitude'],
    ['luminosity-class', 'Luminosity class', 'A luminosity class tells a star’s size category, from dwarf to supergiant, using a Roman numeral in its spectral type.', 'MK Morgan-Keenan Yerkes I II III IV V dwarf giant'],
    ['spectrum', 'Spectrum', 'A spectrum is light spread out by wavelength like a rainbow, with dark or bright lines that reveal what a star is made of.', 'spectra spectroscopy absorption lines emission lines Fraunhofer'],
    ['black-body', 'Black body', 'A black body is an idealized object whose glow depends only on its temperature, which stars roughly resemble.', 'blackbody Planck Wien thermal radiation'],
    ['doppler-effect', 'Doppler effect', 'The Doppler effect is the change in a wave’s pitch or color when its source moves toward or away from us.', 'Doppler shift blueshift wavelength'],
    ['redshift', 'Redshift', 'Redshift is the stretching of light toward longer, redder wavelengths.', 'blueshift z cosmological expansion'],
  ]),
  ...terms('Stellar properties', [
    ['temperature', 'Effective temperature', 'Effective temperature is the temperature of a star’s visible surface, worked out from the light it gives off.', 'temperature surface kelvin K'],
    ['mass', 'Solar mass', 'The solar mass (M☉) is the mass of the Sun, used as the unit for weighing stars.', 'mass M☉ Msun stellar mass'],
    ['radius', 'Solar radius', 'The solar radius (R☉) is the Sun’s radius, used as the unit for comparing the sizes of stars.', 'radius R☉ Rsun stellar radius'],
    ['photosphere-gravity', 'Photosphere gravity', 'Photosphere gravity is how strongly a star pulls on something at its visible surface.', 'surface gravity photospheric acceleration log g m/s²'],
    ['metallicity', 'Metallicity', 'Metallicity is how much of a star is made of elements heavier than hydrogen and helium.', 'M/H Fe/H dex composition'],
    ['age', 'Stellar age', 'A star’s age is the time since it formed, usually an estimate rather than a direct measurement.', 'age Myr Gyr'],
    ['rotation', 'Rotation period', 'A rotation period is the time an object takes to spin once around its axis.', 'spin seconds milliseconds'],
    ['dex', 'Dex', 'A dex is a step of one power of ten on a logarithmic scale, so 1 dex means a factor of 10.', 'decimal exponent logarithm metallicity'],
  ]),
  ...terms('Sky & coordinates', [
    ['constellation', 'Constellation', 'A constellation is one of 88 agreed regions of the sky, each named after a traditional star pattern.'],
    ['right-ascension', 'Right ascension', 'Right ascension is the sky’s version of longitude.', 'RA coordinates'],
    ['declination', 'Declination', 'Declination is the sky’s version of latitude.', 'Dec coordinates'],
    ['epoch', 'Epoch', 'An epoch is the moment in time that a star’s listed position refers to.', 'astrometry J2000 time'],
    ['celestial-sphere', 'Celestial sphere', 'The celestial sphere is an imaginary globe around Earth, onto which all the stars seem to be painted.', 'pole celestial equator coordinates sky'],
    ['ecliptic', 'Ecliptic', 'The ecliptic is the Sun’s apparent yearly path across the sky, which is also the plane of Earth’s orbit.', 'zodiac equinox solstice obliquity'],
    ['galactic-coordinates', 'Galactic coordinates', 'Galactic coordinates locate objects relative to the plane and center of the Milky Way.', 'galactic longitude latitude l b'],
    ['precession', 'Precession', 'Precession is the slow wobble of Earth’s axis, which gradually shifts all star coordinates.', 'axial wobble 26000 pole star Thuban equinoxes'],
  ]),
  ...terms('Motion & orbits', [
    ['proper-motion', 'Proper motion', 'Proper motion is how fast a star creeps across the sky, seen as a tiny change in its position over the years.', 'RA Dec mas/yr transverse velocity'],
    ['radial-velocity', 'Radial velocity', 'Radial velocity is how fast an object moves toward or away from us, measured from the color shift of its light.', 'km/s line of sight velocity'],
    ['orbital-period', 'Orbital period', 'An orbital period is the time one body takes to go once around another.', 'binary companion orbit'],
    ['transverse-velocity', 'Transverse velocity', 'Transverse velocity is how fast an object really moves across the sky, in kilometers per second.', 'tangential speed proper motion'],
    ['space-velocity', 'Space velocity', 'Space velocity is a star’s full motion through space relative to the Sun, combining all directions.', 'UVW velocity X Y Z peculiar 3D'],
    ['semi-major-axis', 'Semi-major axis', 'The semi-major axis is half the longest width of an orbit, and the usual measure of its size.', 'orbit size a au'],
    ['eccentricity', 'Eccentricity', 'Eccentricity measures how stretched an orbit is, from 0 for a perfect circle to nearly 1 for a long, thin ellipse.', 'orbit shape e ellipse'],
    ['inclination', 'Inclination', 'Inclination is the tilt of an orbit, as seen from Earth or relative to a chosen plane.', 'tilt orbit face-on edge-on i'],
    ['periastron', 'Periastron', 'Periastron is the point in an orbit where two bodies come closest; apastron is where they are farthest apart.', 'apastron perihelion aphelion argument node orbital elements'],
    ['barycenter', 'Barycenter', 'A barycenter is the balance point that two orbiting bodies circle together.', 'center of mass barycentre'],
    ['keplers-laws', 'Kepler’s laws', 'Kepler’s three laws describe how planets and stars move in their orbits.', 'Kepler laws planetary motion ellipse equal areas third law'],
  ]),
  ...terms('Planets', [
    ['exoplanet', 'Exoplanet', 'An exoplanet is a planet orbiting a star other than the Sun.', 'extrasolar planet detection radial velocity transit'],
    ['habitable-zone', 'Habitable zone', 'The habitable zone is the range of distances from a star where liquid water could exist on a planet’s surface.', 'Goldilocks zone HZ water life'],
    ['transit', 'Transit', 'A transit is the passage of a planet across the face of its star, seen as a tiny dip in the star’s light.', 'transit method Kepler TESS eclipse'],
    ['tidal-locking', 'Tidal locking', 'Tidal locking is when an orbiting body always shows the same side to the body it orbits.', 'synchronous rotation Moon tidal force'],
  ]),
  ...terms('Catalogs & data', [
    ['measurement-uncertainty', 'Measurement uncertainty', 'Uncertainty is the plus-or-minus range around a measured value, showing how far it can be trusted.', 'error bar ± plus minus sigma confidence'],
    ['gaia', 'Gaia', 'Gaia is a European space telescope that mapped the positions, distances and motions of nearly two billion stars.', 'ESA DR3 astrometry Gaia mission'],
    ['hipparcos', 'Hipparcos', 'Hipparcos was the first space mission dedicated to measuring star positions and distances; HIP numbers come from its catalog.', 'HIP Tycho ESA catalogue'],
    ['star-names', 'Star names and designations', 'Stars carry many names at once, from ancient ones like Betelgeuse to catalog labels like HD 39801.', 'Bayer Flamsteed HD HR designation identifier catalogue proper name'],
    ['modelled-value', 'Modelled value', 'A modelled value is calculated from theory and other measurements rather than measured directly.', 'model estimate calculated derived greyed'],
  ]),
  // Pulsar and Neutron star have their own articles, so do not duplicate them.
  ...OBJECT_SUBTYPE_LABELS
    .filter((label): label is SubtypeLabel => label !== 'Neutron star' && label !== 'Pulsar')
    .map((label): GlossaryTerm => ({ id: subtypeId(label), title: label, group: subtypeTerms[label][0], summary: objectSubtypeDescription(label), aliases: `${subtypeTerms[label][1]} ${label} candidate` })),
]

const loaders: Record<GlossaryGroup, () => Promise<{ glossaryArticles: Readonly<Record<string, GlossaryArticle>> }>> = {
  'Stars': () => import('./glossary-articles-stars'),
  'Star lives': () => import('./glossary-articles-lives'),
  'Stellar remnants': () => import('./glossary-articles-remnants'),
  'Double & multiple stars': () => import('./glossary-articles-binaries'),
  'Variable stars': () => import('./glossary-articles-variables'),
  'Nebulae & interstellar space': () => import('./glossary-articles-nebulae'),
  'Distance & size': () => import('./glossary-articles-distance'),
  'Light & brightness': () => import('./glossary-articles-light'),
  'Spectra': () => import('./glossary-articles-spectra'),
  'Stellar properties': () => import('./glossary-articles-properties'),
  'Sky & coordinates': () => import('./glossary-articles-sky'),
  'Motion & orbits': () => import('./glossary-articles-motion'),
  'Planets': () => import('./glossary-articles-planets'),
  'Catalogs & data': () => import('./glossary-articles-catalogs'),
}

export const loadGlossaryArticles = (group: GlossaryGroup) => loaders[group]().then((module) => module.glossaryArticles)

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[-‐‑–—]/g, ' ').replace(/\s+/g, ' ').trim()
const searchable = GLOSSARY_TERMS.map((term) => ({ term, title: normalize(term.title), named: normalize(`${term.title} ${term.aliases}`), all: normalize(`${term.title} ${term.aliases} ${term.summary}`) }))

/** Terms containing every search word, best match first: the title, then aliases, then the definition. */
export function searchGlossary(query: string): GlossaryTerm[] {
  const wanted = normalize(query)
  const words = wanted.split(' ').filter(Boolean)
  const has = (text: string) => words.every((word) => text.includes(word))
  const rank = ({ title, named }: typeof searchable[number]) => title === wanted ? 0 : title.startsWith(wanted) ? 1 : has(title) ? 2 : has(named) ? 3 : 4
  return searchable.filter(({ all }) => has(all))
    .map((entry) => ({ term: entry.term, rank: rank(entry) }))
    .sort((first, second) => first.rank - second.rank || first.term.title.localeCompare(second.term.title, 'en', { sensitivity: 'base' }))
    .map(({ term }) => term)
}

// Too common in running text for a link to help.
const UNLINKED_TITLES = new Set(['Star', 'Sun', 'Giant', 'Bubble'])
const LINK_NAMES: [name: string, id: string][] = [
  ...GLOSSARY_TERMS.filter(({ title }) => !UNLINKED_TITLES.has(title)).map(({ title, id }): [string, string] => [title.toLowerCase(), id]),
  ['light-year', 'lightyear'], ['main sequence', 'subtype-main-sequence'], ['supernovae', 'supernova'], ['spectral class', 'spectral-type'], ['cepheid', 'subtype-cepheid-variable'], ['spectra', 'spectrum'],
]
LINK_NAMES.sort((first, second) => second[0].length - first[0].length)
const linkIds = new Map(LINK_NAMES)
const linkPattern = new RegExp(`(?<![\\p{L}\\p{N}-])(${LINK_NAMES.map(([name]) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})s?(?![\\p{L}\\p{N}-])`, 'giu')

/** Splits text around the first mention of each other term; `seen` carries over between an article's paragraphs. */
export function linkGlossaryTerms(text: string, seen: Set<string>): (string | { id: string; text: string })[] {
  const parts: (string | { id: string; text: string })[] = []
  let position = 0
  for (const match of text.matchAll(linkPattern)) {
    const id = linkIds.get(match[1]!.toLowerCase())!
    if (seen.has(id)) continue
    seen.add(id)
    parts.push(text.slice(position, match.index), { id, text: match[0] })
    position = match.index + match[0].length
  }
  parts.push(text.slice(position))
  return parts.filter((part) => part !== '')
}
