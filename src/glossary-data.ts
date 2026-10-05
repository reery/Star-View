import { OBJECT_TYPES } from './catalog-model'
import { objectTypeIntroduction } from './object-type-info'

export const GLOSSARY_GROUPS = ['Object types', 'Distance & units', 'Stellar properties', 'Position & motion', 'Remnant properties'] as const
type GlossaryGroup = typeof GLOSSARY_GROUPS[number]

export interface GlossaryEntry {
  id: string
  title: string
  group: GlossaryGroup
  description: string
  source: string
  aliases?: string
  image?: string
  imagePosition?: string
  caption?: string
  imageCredit?: string
  imageSource?: string
}

// Concise adaptations of the linked English Wikipedia articles, reviewed 2026-10-05.
// Keep descriptions bundled so opening the glossary does not require a network request.
function entry(id: string, title: string, group: GlossaryGroup, article: string, description: string, aliases = ''): GlossaryEntry {
  return { id, title, group, description, aliases, source: `https://en.wikipedia.org/wiki/${article}` }
}

const objectTypes: GlossaryEntry[] = OBJECT_TYPES.map((type) => ({
  ...objectTypeIntroduction({ type, spectral_type: null }),
  id: type,
  group: 'Object types',
}))

const stellarClasses: GlossaryEntry[] = [
  ['O', 'Blue star', 'An O-type main-sequence star: exceptionally hot, massive, and blue, with a short lifetime.'],
  ['B', 'Blue-white star', 'A B-type main-sequence star: hot and blue-white, with prominent helium absorption in its spectrum.'],
  ['A', 'White star', 'An A-type main-sequence star: white, with strong hydrogen absorption lines. Sirius A is an example.'],
  ['F', 'Yellow-white star', 'An F-type main-sequence star: yellow-white and somewhat hotter than the Sun.'],
  ['G', 'Sun-like star', 'A G-type main-sequence star: yellowish, with a surface temperature similar to the Sun.'],
  ['K', 'Orange dwarf', 'A K-type main-sequence star: orange, cooler than the Sun, and long-lived.'],
  ['M', 'Red dwarf', 'An M-type main-sequence star: small, cool, and faint, with a very long lifetime.'],
].map(([spectral, title, description]) => ({
  ...objectTypeIntroduction({ type: 'star', spectral_type: `${spectral}0V` }),
  id: `star-${spectral!.toLowerCase()}`,
  title: title!,
  description: description!,
  group: 'Object types',
  aliases: `${spectral}-type spectral class main sequence`,
}))

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  ...objectTypes,
  ...stellarClasses,
  {
    ...objectTypeIntroduction({ type: 'star', spectral_type: null }),
    ...entry('sun', 'Sun', 'Object types', 'Sun', 'The Sun is the star at the center of the Solar System. It is a G-type main-sequence star powered by hydrogen fusion in its core. Its mass, radius, and luminosity provide useful reference units for comparing other stars.'),
  },
  entry('binary', 'Binary star', 'Object types', 'Binary_star', 'A binary star consists of two stars held together by gravity, orbiting their common center of mass. Their orbital motion can reveal their masses. A pair that merely appears close together in the sky may instead be an optical double.', 'binaries companion'),
  entry('multiple_system', 'Multiple star system', 'Object types', 'Star_system', 'A multiple star system contains three or more stars bound together by gravity. Many form a hierarchy: a close pair is orbited by a more distant star or another pair. These systems differ from larger stellar clusters.', 'multiple systems triples'),
  entry('dark_nebula', 'Dark nebula', 'Object types', 'Dark_nebula', 'A dark nebula is a dense interstellar cloud whose dust blocks visible light from objects behind it. It appears as a dark patch against a bright nebula or star field. Its cold interior can contain molecular gas and regions where new stars form.'),
  entry('supernova_remnant', 'Supernova remnant', 'Object types', 'Supernova_remnant', 'A supernova remnant is the expanding debris and shocked surrounding gas left by a stellar explosion. Its shock waves heat interstellar material, accelerate particles, and spread newly formed elements into space.'),
  entry('pulsar_wind_nebula', 'Pulsar-wind nebula', 'Object types', 'Pulsar_wind_nebula', 'A pulsar-wind nebula is a cloud powered by energetic particles flowing from a pulsar. Those particles interact with magnetic fields and emit radiation, often from radio wavelengths to X-rays. The Crab Nebula is a well-known example.', 'plerion'),
  entry('superbubble', 'Superbubble', 'Object types', 'Superbubble', 'A superbubble is a large cavity filled with hot, thin gas and surrounded by a swept-up shell. The combined stellar winds and supernova explosions of massive stars carve it out of the interstellar medium. The Local Bubble is a nearby example.'),
  entry('dust_sheet', 'Dust sheet', 'Object types', 'Cosmic_dust', 'Interstellar dust consists of small solid grains between stars. A dust sheet describes a layer of this material, rather than a separate stellar object. Dust absorbs and scatters starlight and radiates the absorbed energy at infrared wavelengths.', 'interstellar dust'),
  entry('parsec', 'Parsec', 'Distance & units', 'Parsec', 'A parsec (pc) is a distance of approximately 3.26 light-years. It is defined as the distance at which one astronomical unit subtends an angle of one arcsecond. The name combines parallax and arcsecond; astronomers commonly use parsecs for stellar distances.', 'pc kiloparsec kpc megaparsec'),
  entry('lightyear', 'Lightyear', 'Distance & units', 'Light-year', 'A light-year (ly) is the distance light travels through a vacuum in one Julian year: about 9.46 trillion kilometers. It measures distance, not time. Light arriving from an object ten light-years away has taken about ten years to reach us.', 'light year light-year ly'),
  entry('astronomical-unit', 'Astronomical unit', 'Distance & units', 'Astronomical_unit', 'An astronomical unit (au) is exactly 149,597,870,700 meters, close to the average distance between Earth and the Sun. It is useful for describing planetary orbits and distances within a star system.', 'au AU'),
  entry('spectral-type', 'Spectral type', 'Stellar properties', 'Stellar_classification', 'A spectral type classifies a star by its spectrum. The main temperature sequence runs O, B, A, F, G, K, M, from hottest to coolest. Digits refine the class; luminosity class V indicates a main-sequence star. The Sun is G2V.', 'stellar classification spectrum'),
  entry('temperature', 'Effective temperature', 'Stellar properties', 'Effective_temperature', 'A star’s effective temperature is the temperature of a black body that would radiate the same energy per unit surface area. It describes the star’s overall surface radiation and is measured in kelvin (K). Hotter stars generally appear bluer; cooler stars appear redder.', 'temperature surface kelvin K'),
  entry('bolometric-luminosity', 'Bolometric luminosity', 'Stellar properties', 'Luminosity', 'Bolometric luminosity is the total energy an object radiates per second across all wavelengths, including light outside the visible range. It measures the object’s intrinsic power output. It can be expressed in watts or relative to the Sun’s luminosity, L☉.', 'brightness power Lsun luminosity_solar'),
  entry('solar-luminosity', 'Solar luminosity', 'Stellar properties', 'Solar_luminosity', 'Solar luminosity (L☉) expresses radiant power relative to the Sun. The nominal solar luminosity is 3.828 × 10²⁶ watts. An object listed at 2 L☉ radiates twice this power.', 'Lsun L☉'),
  entry('mass', 'Solar mass', 'Stellar properties', 'Solar_mass', 'The solar mass (M☉) is a unit based on the Sun’s mass, approximately 1.99 × 10³⁰ kilograms. Stellar masses are often given in this unit. A value of 0.5 M☉ means half the mass of the Sun.', 'mass M☉ Msun stellar mass'),
  entry('radius', 'Solar radius', 'Stellar properties', 'Solar_radius', 'The solar radius (R☉) is a unit used to compare stellar sizes. Its nominal value is 695,700 kilometers. A star with a radius of 2 R☉ has twice the Sun’s reference radius; radius is measured from the center to the surface.', 'radius R☉ Rsun stellar radius'),
  entry('metallicity', 'Metallicity', 'Stellar properties', 'Metallicity', 'In astronomy, metals are elements heavier than helium. Metallicity describes their abundance. The notation [M/H] compares the metal-to-hydrogen ratio with the Sun on a logarithmic scale: 0 is solar, +1 is ten times solar, and −1 is one tenth solar.', 'M/H Fe/H dex composition'),
  entry('age', 'Stellar age', 'Stellar properties', 'Stellar_age_estimation', 'A stellar age estimates the time since a star formed. Astronomers infer it from observations and models, using clues such as stellar evolution, rotation, or membership in a star cluster. Estimates can be uncertain; Myr means million years and Gyr means billion years.', 'age Myr Gyr'),
  entry('absolute-magnitude', 'Absolute magnitude', 'Stellar properties', 'Absolute_magnitude', 'A star’s absolute magnitude is the apparent magnitude it would have at a distance of 10 parsecs, without intervening extinction. Smaller or more negative values mean a brighter object. The V label identifies the visible-light V passband.', 'absolute mag V Mv'),
  entry('apparent-magnitude', 'Apparent magnitude', 'Stellar properties', 'Apparent_magnitude', 'Apparent magnitude describes how bright an object looks to an observer in a specified wavelength band. It depends on luminosity, distance, and intervening dust. Smaller values are brighter; a difference of five magnitudes corresponds to a factor of 100 in brightness.', 'magnitude brightness mag'),
  entry('constellation', 'Constellation', 'Position & motion', 'Constellation', 'A constellation is an officially defined region of the sky. Astronomers divide the celestial sphere into 88 constellations. Stars appearing in the same constellation can lie at very different distances and need not be physically connected.'),
  entry('parallax', 'Parallax', 'Position & motion', 'Stellar_parallax', 'Stellar parallax is the apparent shift of a nearby star against distant background objects as Earth orbits the Sun. It provides a geometric distance measurement. Distance in parsecs is the reciprocal of parallax in arcseconds; mas means milliarcseconds.', 'astrometry mas distance'),
  entry('proper-motion', 'Proper motion', 'Position & motion', 'Proper_motion', 'Proper motion is an object’s angular movement across the sky relative to a reference frame, usually measured in milliarcseconds per year (mas/yr). Its components follow right ascension and declination. It describes transverse motion, while radial velocity describes movement along the line of sight.', 'RA Dec mas/yr transverse velocity'),
  entry('radial-velocity', 'Radial velocity', 'Position & motion', 'Radial_velocity', 'Radial velocity is motion along the line of sight, commonly measured in kilometers per second from shifts in spectral lines. Under the usual astronomical convention, positive values indicate recession and negative values indicate approach.', 'km/s line of sight velocity'),
  entry('right-ascension', 'Right ascension', 'Position & motion', 'Right_ascension', 'Right ascension (RA) is the celestial coordinate analogous to longitude. It measures eastward along the celestial equator from the reference equinox. It is commonly expressed in hours, minutes, and seconds, with 24 hours corresponding to a full circle of 360 degrees.', 'RA coordinates'),
  entry('declination', 'Declination', 'Position & motion', 'Declination', 'Declination (Dec) is the celestial coordinate analogous to latitude. It measures angular distance north or south of the celestial equator, from −90° at the south celestial pole to +90° at the north celestial pole.', 'Dec coordinates'),
  entry('epoch', 'Epoch', 'Position & motion', 'Epoch_(astronomy)', 'An epoch is the reference time for astronomical data such as coordinates and motion. Positions change over time, so an epoch identifies when the recorded values apply. J2000.0 is a common reference epoch near the start of the year 2000.', 'astrometry J2000 time'),
  entry('apparent-size', 'Apparent size', 'Position & motion', 'Angular_diameter', 'An object’s apparent or angular size is the angle it spans on the sky. It is measured in degrees, arcminutes, or arcseconds. It depends on physical size and distance, so an object can look small while spanning a large region of space.', 'angular diameter extent arcmin arcsec'),
  entry('rotation', 'Rotation period', 'Remnant properties', 'Stellar_rotation', 'A rotation period is the time an object takes to spin once about its axis. For a pulsar, repeated pulses can reveal this period with high precision. Ordinary stars can rotate at different rates at different latitudes.', 'spin seconds milliseconds'),
  entry('orbital-period', 'Orbital period', 'Remnant properties', 'Orbital_period', 'An orbital period is the time a body takes to complete one orbit. In a binary system it describes the repeating motion of the two companions around their common center of mass. The period depends on the system’s masses and orbital size.', 'binary companion orbit'),
  entry('characteristic-age', 'Characteristic age', 'Remnant properties', 'Pulsar', 'A pulsar’s characteristic age is an estimate from its rotation period and the rate at which that period increases. It assumes a particular braking model and a much shorter initial period. It can differ substantially from the pulsar’s true age.', 'pulsar spin-down age'),
  entry('spin-down-power', 'Spin-down power', 'Remnant properties', 'Pulsar', 'Spin-down power is the rate at which a pulsar loses rotational energy as its spin slows. This energy can supply particle winds and radiation. It describes the available rotational power rather than the luminosity measured in one observing band.', 'pulsar rotational energy watts'),
  entry('magnetic-field', 'Surface magnetic field', 'Remnant properties', 'Magnetic_field', 'A magnetic field describes magnetic influence around an object and is measured in tesla or gauss. Neutron stars can have extremely strong fields. Pulsar surface-field values are commonly inferred from rotation and spin-down using a magnetic braking model.', 'magnetism tesla gauss G'),
]
