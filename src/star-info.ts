import definitions from './data/star-info.json'
import { renderObjectInfoContent, type InfoImage, type ObjectInfo } from './object-info-content'
import { starComponentIdentity } from './star-systems'
import sun from './assets/stars/sun.jpg'
import alphaCentauri from './assets/stars/alpha-centauri.jpg'
import barnard from './assets/stars/barnards-star.jpg'
import luhman from './assets/stars/luhman-16.jpg'
import wise from './assets/stars/wise-0855.gif'
import wolf from './assets/stars/wolf-359.jpg'
import sirius from './assets/object-types/white_star.jpg'
import epsilonEridani from './assets/stars/epsilon-eridani.jpg'
import ross128 from './assets/stars/ross-128.jpg'

const ccBy = { title: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
const ccBySa = { title: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }
const images: Readonly<Record<string, InfoImage>> = {
  sun: {
    src: sun, width: 6272, height: 6272,
    alt: 'A golden-colored ultraviolet mosaic of the Sun’s corona, with bright magnetic loops and dark filaments.',
    caption: 'ESA & NASA/Solar Orbiter/EUI Team, E. Kraaikamp (ROB) · ultraviolet mosaic · March 9, 2025',
    credit: 'ESA & NASA/Solar Orbiter/EUI Team, E. Kraaikamp (ROB). Mosaic of 200 images at 17.4 nm, March 9, 2025. False color; not a visible-light photograph. ESA’s low-resolution download, unmodified.',
    source: { title: 'ESA: Solar Orbiter’s widest high-resolution view of the Sun', url: 'https://www.esa.int/ESA_Multimedia/Images/2025/04/Solar_Orbiter_s_widest_high-res_view_of_the_Sun' },
    license: { title: 'CC BY-SA 3.0 IGO', url: 'https://creativecommons.org/licenses/by-sa/3.0/igo/' },
  },
  'alpha-centauri': {
    src: alphaCentauri, width: 1280, height: 1299,
    alt: 'A wide star field with brilliant Alpha Centauri and faint Proxima circled below it; Beta Centauri is at right.',
    caption: 'Digitized Sky Survey 2 · Acknowledgement: Davide De Martin/ Mahdi Zamani · released 2016',
    credit: 'Digitized Sky Survey 2. Acknowledgement: Davide De Martin/ Mahdi Zamani. Archival survey composite, released August 24, 2016. Alpha Centauri A and B are blended; Proxima is circled. ESO screensize download, unmodified.',
    source: { title: 'ESO: The sky around Alpha Centauri and Proxima Centauri', url: 'https://www.eso.org/public/images/eso1629i/' }, license: ccBy,
  },
  'barnards-star': {
    src: barnard, width: 1280, height: 1150,
    alt: 'A wide star field with Barnard’s Star at three colored positions near the center, showing its motion between survey exposures.',
    caption: 'ESO/Digitized Sky Survey 2 · Acknowledgement: Davide De Martin · released 2018',
    credit: 'ESO/Digitized Sky Survey 2. Acknowledgement: Davide De Martin. Archival exposures encode successive positions in red, yellow and blue; these are not three companion stars. Released November 14, 2018. ESO screensize download, unmodified.',
    source: { title: 'ESO: Barnard’s Star showing its motion', url: 'https://www.eso.org/public/images/eso1837d/' }, license: ccBy,
  },
  'luhman-16': {
    src: luhman, width: 956, height: 956,
    alt: 'Two orange-red points of light resolve the brown dwarfs Luhman 16 A and B in a VLT/MUSE image.',
    caption: 'ESO VLT MUSE; Melina Thévenot · visible-light composite · reprocessed 2026',
    credit: 'ESO VLT MUSE; Melina Thévenot. Published May 25, 2026, reprocessing an archival MUSE spectral cube. Multiple visible spectral bands combined, with a brightness correction in the upper quarter by the author. Downloaded unmodified; publication date is not an observation date.',
    source: { title: 'Wikimedia Commons: Luhman 16 in visible light, ESO VLT MUSE', url: 'https://commons.wikimedia.org/wiki/File:Luhman_16_in_visible_light_ESO_VLT_MUSE.jpg' }, license: ccBySa,
  },
  'wise-0855-0714': {
    src: wise, width: 1315, height: 858,
    alt: 'Two alternating Webb infrared frames show WISE 0855 moving against a background of distant stars and galaxies.',
    caption: 'NASA/ESA/CSA JWST NIRCam; Alves de Oliveira et al. · Melina Thévenot; animation: 文爻林夕 · 2022–2023',
    credit: 'NASA/ESA/CSA JWST NIRCam; Alves de Oliveira et al. Image processing: Melina Thévenot; GIF animation: 文爻林夕. F200W and F444W infrared observations, November 19, 2022 and April 27, 2023. Published June 9, 2024; false color, unmodified.',
    source: { title: 'Wikimedia Commons: WISE 0855 NIRCam motion', url: 'https://commons.wikimedia.org/wiki/File:WISE_0855-0714_NIRCam_gif.gif' }, license: ccBySa,
  },
  'wolf-359': {
    src: wolf, width: 659, height: 494,
    alt: 'Wolf 359 is the small orange star just above the center of a telescope photograph of a scattered star field.',
    caption: 'Klaus Hohmann · Wolf 359 · March 21, 2009',
    credit: 'Klaus Hohmann. March 21, 2009. Telescope photograph, north up and east left; Wolf 359 is slightly above center. Public domain, downloaded unmodified. Its position relative to background stars changes with time.',
    source: { title: 'Wikimedia Commons: Wolf359.jpg by Klaus Hohmann', url: 'https://commons.wikimedia.org/wiki/File:Wolf359.jpg' },
  },
  sirius: {
    src: sirius, width: 1280, height: 1398,
    alt: 'Bright Sirius A with long diffraction spikes and its much fainter white dwarf companion Sirius B near the lower left.',
    caption: 'NASA, ESA, H. Bond (STScI), and M. Barstow (University of Leicester) · Hubble · 2003',
    credit: 'NASA, ESA, H. Bond (STScI), and M. Barstow (University of Leicester). Hubble image, October 15, 2003; released December 2005. Sirius B is the faint point at lower left. Diffraction spikes are telescope artifacts. Reuses the existing local Hubble image.',
    source: { title: 'ESA/Hubble: The Dog Star, Sirius A, and its tiny companion', url: 'https://esahubble.org/images/heic0516a/' },
  },
  'epsilon-eridani': {
    src: epsilonEridani, width: 800, height: 652,
    alt: 'An artist’s concept of a giant planet above a dusty disk around Epsilon Eridani.',
    caption: 'NASA, ESA, and A. Feild (STScI) · artist’s concept · 2006',
    credit: 'NASA, ESA, and A. Feild (STScI). October 2006. Artist’s concept, not a detected planet image or a current orbital solution. NASA’s 800 × 652 rendition, unmodified.',
    source: { title: 'NASA: Epsilon Eridani’s Tilt', url: 'https://science.nasa.gov/asset/hubble/epsilon-eridanis-tilt/' },
  },
  'ross-128': {
    src: ross128, width: 1280, height: 1217,
    alt: 'A wide telescope survey field centered on the red dwarf Ross 128 in Virgo.',
    caption: 'Digitized Sky Survey 2 · Acknowledgement: Davide De Martin · released 2017',
    credit: 'Digitized Sky Survey 2. Acknowledgement: Davide De Martin. Archival survey composite centered on Ross 128, released November 15, 2017. The planet is not resolved. ESO screensize download, unmodified.',
    source: { title: 'ESO: The sky around the red dwarf Ross 128', url: 'https://www.eso.org/public/images/eso1736b/' }, license: ccBy,
  },
}

const articles: ReadonlyMap<string, ObjectInfo> = new Map(Object.entries(definitions.articles).map(([id, article]) => {
  const wikipedia = { title: `Wikipedia: ${article.name} · reviewed ${definitions.reviewedAt}`, url: article.wikipedia }
  return [id, {
    image: images[id],
    introduction: { label: article.name, text: article.introduction, source: wikipedia },
    sections: article.sections.map((section) => ({
      id: section.id, title: section.title,
      source: 'source' in section ? section.source : wikipedia,
      paragraphs: [{ text: section.text }],
    })),
  }]
}))

/** Resolve explicit catalog identities so every component shares its system article. */
export function starInfoForId(starId: string): ObjectInfo | undefined {
  const identity = starComponentIdentity(starId)
  return articles.get(identity?.systemId ?? starId)
    ?? articles.get(identity?.canonicalStarId ?? starId)
}

export function renderStarInfo(container: HTMLElement, starId: string | null): boolean {
  return renderObjectInfoContent(container, starId ? starInfoForId(starId) : undefined)
}
