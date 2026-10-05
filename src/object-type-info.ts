import { describeObject, type ObjectType, type Star } from './catalog-model'
import credits from './assets/object-types/credits.json'
import starImage from './assets/object-types/star.jpg'
import whiteStarImage from './assets/object-types/white_star.jpg'
import redDwarfImage from './assets/object-types/red_dwarf.jpg'
import whiteDwarfImage from './assets/object-types/white_dwarf.jpg'
import brownDwarfImage from './assets/object-types/brown_dwarf.jpg'
import subBrownDwarfImage from './assets/object-types/sub_brown_dwarf.jpg'
import pulsarImage from './assets/object-types/pulsar.jpg'
import neutronStarImage from './assets/object-types/neutron_star.jpg'
import blackHoleImage from './assets/object-types/black_hole.jpg'
import reflectionNebulaImage from './assets/object-types/reflection_nebula.jpg'
import hiiRegionImage from './assets/object-types/hii_region.jpg'
import planetaryNebulaImage from './assets/object-types/planetary_nebula.jpg'
import molecularCloudImage from './assets/object-types/molecular_cloud.jpg'
import bubbleImage from './assets/object-types/bubble.jpg'

interface TypeIntroduction {
  description: string
  article: string
  image: string
  caption: string
  imagePosition?: string
}

const introductions: Record<ObjectType, TypeIntroduction> = {
  star: {
    description: 'A star is a vast, luminous sphere of hot plasma held together by gravity. For most of its life, nuclear fusion in its core turns hydrogen into helium, releasing the energy that makes it shine. The Sun is the nearest star to Earth; the other stars visible in the night sky lie much farther away.',
    article: 'Star', image: starImage, caption: 'The Sun in visible light · SDO/HMI',
  },
  white_dwarf: {
    description: 'A white dwarf is the dense remnant left when a star like the Sun sheds its outer layers. It can contain a mass comparable to the Sun packed into a body roughly the size of Earth. With no sustained fusion to replenish its energy, it shines from stored heat and gradually cools over billions of years.',
    article: 'White_dwarf', image: whiteDwarfImage, caption: 'Isolated white dwarf · AI illustration',
  },
  brown_dwarf: {
    description: 'A brown dwarf is a substellar object with a mass between that of a giant planet and a small star. It is too light to sustain the hydrogen fusion that powers ordinary stars, although some briefly fuse deuterium. Brown dwarfs cool as they age and emit much of their light at infrared wavelengths.',
    article: 'Brown_dwarf', image: brownDwarfImage, caption: 'A rapidly rotating brown dwarf · artist’s concept',
  },
  sub_brown_dwarf: {
    description: 'A sub-brown dwarf is an object with a planetary mass below the approximate threshold for deuterium fusion. The term is often used for bodies thought to form through the collapse of a gas cloud, as stars do, rather than in a planet-forming disk. Their boundary with giant planets is debated, and many drift freely through space.',
    article: 'Sub-brown_dwarf', image: subBrownDwarfImage, caption: 'Planetary-mass object 2M1207 b · artist’s concept', imagePosition: '50% 100%',
  },
  pulsar: {
    description: 'A pulsar is a rapidly rotating, strongly magnetized neutron star that sends beams of radiation into space. When a beam sweeps across Earth, it appears as a repeating pulse, much like a lighthouse. These extraordinarily regular signals let astronomers study dense matter, measure stellar orbits, and test gravity.',
    article: 'Pulsar', image: pulsarImage, caption: 'A pulsar’s rotating beams · artist’s concept',
  },
  neutron_star: {
    description: 'A neutron star is the collapsed core left behind when a massive star explodes as a supernova. It packs more mass than the Sun into a sphere only about the size of a city, making it one of the densest objects in the universe. Some neutron stars are observed as pulsars; others have exceptionally strong magnetic fields.',
    article: 'Neutron_star', image: neutronStarImage, caption: 'Isolated neutron star · AI illustration',
  },
  black_hole: {
    description: 'A black hole is a region of spacetime where gravity is so strong that nothing, including light, can escape from within its event horizon. Stellar black holes can form when massive stars collapse. Although a black hole itself emits no light, nearby gas may form a hot, bright accretion disk as it spirals inward.',
    article: 'Black_hole', image: blackHoleImage, caption: 'Black hole and accretion disk · NASA simulation',
  },
  reflection_nebula: {
    description: 'A reflection nebula is a cloud of interstellar dust that shines by scattering light from nearby stars. Unlike an emission nebula, it is not mainly glowing from ionized gas. Many reflection nebulae appear blue because small dust grains scatter blue light more effectively than red light, much as Earth’s atmosphere does.',
    article: 'Reflection_nebula', image: reflectionNebulaImage, caption: 'Reflective dust around RS Puppis · Hubble',
  },
  hii_region: {
    description: 'An H II region is a cloud of gas in which ultraviolet light from hot, young stars has ionized the hydrogen. As electrons recombine with hydrogen nuclei, the gas emits light, often producing a characteristic red glow. These bright nebulae mark regions of recent star formation and can contain entire clusters of newborn stars.',
    article: 'H_II_region', image: hiiRegionImage, caption: 'Pillars of Creation in the Eagle Nebula · Hubble',
  },
  planetary_nebula: {
    description: 'A planetary nebula is an expanding shell of glowing gas expelled by an aging star. Ultraviolet radiation from the exposed hot core lights up the surrounding material, often creating striking rings, lobes, and filaments. Despite their name, these nebulae have nothing to do with planets; the central star eventually becomes a white dwarf.',
    article: 'Planetary_nebula', image: planetaryNebulaImage, caption: 'The Ring Nebula · Hubble',
  },
  molecular_cloud: {
    description: 'A molecular cloud is a cold, dense region of interstellar gas and dust where atoms can join into molecules, especially molecular hydrogen. Dust shields its interior from starlight, allowing temperatures to remain low. The densest parts can collapse under gravity to form new stars, making these clouds the birthplaces of stellar systems.',
    article: 'Molecular_cloud', image: molecularCloudImage, caption: 'Star-forming gas and dust around LH 95 · Hubble',
  },
  bubble: {
    description: 'An interstellar bubble is a cavity in the gas between stars, carved out by powerful stellar winds or supernova explosions. The expanding hot gas sweeps surrounding material into a shell, leaving a relatively sparse interior. Large cavities created by groups of massive stars are called superbubbles; the Sun lies within one known as the Local Bubble.',
    article: 'Superbubble', image: bubbleImage, caption: 'The Bubble Nebula, a stellar-wind bubble · Hubble',
  },
}

const stellarIntroductions: Record<string, string> = {
  'Blue star': 'A blue main-sequence star is extremely hot and massive. Its intense ultraviolet radiation can illuminate nearby gas, and it burns through its hydrogen fuel in only a few million years.',
  'Blue-white star': 'A blue-white main-sequence star is hotter, brighter, and generally more massive than the Sun. Its blue-white color reflects its high surface temperature, and it consumes its hydrogen fuel relatively quickly.',
  'White star': 'A white main-sequence star is hotter and usually more massive than the Sun. Its spectrum shows strong hydrogen absorption lines. Sirius A and Vega are familiar examples of this stellar class.',
  'Yellow-white star': 'A yellow-white main-sequence star is somewhat hotter and generally more luminous than the Sun. It belongs to spectral class F and spends much of its life producing energy through hydrogen fusion in its core.',
  'Sun-like star': 'A Sun-like star is a main-sequence star of spectral class G. It fuses hydrogen into helium in its core and has a surface temperature of roughly 5,200–6,000 kelvin. These stars can shine steadily for billions of years; our Sun is a familiar example.',
  'Orange dwarf': 'An orange dwarf is a main-sequence star of spectral class K, cooler and generally smaller than the Sun. It burns hydrogen slowly and can remain stable for many billions of years, longer than a Sun-like star.',
  'Red dwarf': 'A red dwarf is a small, cool main-sequence star. These faint stars consume hydrogen very slowly and can live far longer than the universe’s present age. They are the most common stars in the Milky Way, but none are bright enough to be seen from Earth with the unaided eye.',
}

export function objectTypeIntroduction(star: Pick<Star, 'type' | 'spectral_type'>) {
  const title = describeObject(star)
  const introduction = introductions[star.type]
  const stellarDescription = star.type === 'star' ? stellarIntroductions[title] : undefined
  const stellarImage = stellarDescription && ['Blue star', 'Blue-white star', 'White star', 'Yellow-white star'].includes(title)
    ? { image: whiteStarImage, caption: 'Sirius A, a main-sequence star · Hubble', ...credits.white_star }
    : stellarDescription && title === 'Red dwarf'
      ? { image: redDwarfImage, caption: 'Proxima Centauri · Hubble', ...credits.red_dwarf }
      : undefined
  return {
    ...introduction,
    title,
    description: stellarDescription ?? introduction.description,
    source: `https://en.wikipedia.org/wiki/${stellarDescription ? 'Stellar_classification' : introduction.article}`,
    image: stellarImage?.image ?? introduction.image,
    caption: stellarImage?.caption ?? introduction.caption,
    imageCredit: stellarImage?.credit ?? credits[star.type].credit,
    imageSource: stellarImage?.source ?? credits[star.type].source,
  }
}
