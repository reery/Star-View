import { createElement, Image, RadioTower, Satellite, ScrollText, type IconNode } from 'lucide'
import type { Star } from './catalog-model'
import { objectSkyPosition } from './constellations'
import { loadJsonData } from './json-data'
import objectLinksUrl from './data/object-links.json?url&no-inline'

interface ObjectLinkData {
  wikipedia?: string
  kaler?: { page: string; title: string }
  atnf?: string
  esaHubble?: { image: string; title: string }
}

interface ObjectLink { title: string; url: string; icon: IconNode | 'W' }

let payload: Promise<Record<string, ObjectLinkData>> | undefined

function loadObjectLinks(): Promise<Record<string, ObjectLinkData>> {
  payload ??= loadJsonData<{ objects: Record<string, ObjectLinkData> }>(objectLinksUrl)
    .then(({ objects }) => objects)
    .catch((error: unknown) => { payload = undefined; throw error })
  return payload
}

/** Sky-survey field sized to the object; extended objects get their catalogued extent. */
function aladinFieldDeg(star: Star): number {
  const cloud = star.molecular_cloud
  const extent = star.nebula ? Math.max(...star.nebula.angular_size_arcmin) / 60
    : cloud ? 2 * Math.atan(cloud.equivalent_radius_pc / cloud.distance_pc) * 180 / Math.PI : 0
  return Number(Math.min(60, Math.max(0.25, extent * 1.6)).toPrecision(2))
}

function wikipediaUrl(article: string): string {
  const [title, fragment] = article.split('#')
  const path = (value: string) => encodeURIComponent(value.replaceAll(' ', '_'))
  return `https://en.wikipedia.org/wiki/${path(title!)}${fragment ? `#${path(fragment)}` : ''}`
}

/** Most important first: Wikipedia, Aladin Lite, Kaler's STARS, ATNF, ESA/Hubble. */
export function objectLinks(star: Star, data: ObjectLinkData | undefined): ObjectLink[] {
  const links: ObjectLink[] = []
  if (data?.wikipedia) links.push({ title: `Wikipedia: ${data.wikipedia.split('#')[0]}`, url: wikipediaUrl(data.wikipedia), icon: 'W' })
  // The Local Bubble surrounds the Sun, so it has no single sky position.
  const sky = star.bubble ? null : objectSkyPosition(star)
  if (sky) {
    const target = encodeURIComponent(`${sky.ra_deg.toFixed(5)} ${sky.dec_deg >= 0 ? '+' : ''}${sky.dec_deg.toFixed(5)}`)
    links.push({ title: 'Aladin Lite: sky survey image', url: `https://aladin.cds.unistra.fr/AladinLite/?target=${target}&fov=${aladinFieldDeg(star)}`, icon: Image })
  }
  if (data?.kaler) links.push({ title: `Jim Kaler’s STARS: ${data.kaler.title}`, url: `http://stars.astro.illinois.edu/sow/${data.kaler.page}.html`, icon: ScrollText })
  if (data?.atnf) {
    links.push({
      title: `ATNF Pulsar Catalogue: PSR ${data.atnf}`,
      url: `https://www.atnf.csiro.au/research/pulsar/psrcat/proc_form.php?startUserDefined=true&pulsar_names=${encodeURIComponent(data.atnf)}&ephemeris=long&submit_ephemeris=Get+Ephemeris&state=query`,
      icon: RadioTower,
    })
  }
  if (data?.esaHubble) links.push({ title: `ESA/Hubble: ${data.esaHubble.title}`, url: `https://esahubble.org/images/${data.esaHubble.image}/`, icon: Satellite })
  return links
}

/** Specs link icons, most important on the right; the row hides when an object has none. */
export async function renderObjectLinks(container: HTMLElement, star: Star): Promise<void> {
  // Selection re-renders often; keep the same links so hover and focus survive.
  if (container.dataset.starId === star.id) return
  container.dataset.starId = star.id
  const data = await loadObjectLinks().then((objects) => objects[star.id], () => undefined)
  if (container.dataset.starId !== star.id) return
  const links = objectLinks(star, data).reverse()
  container.replaceChildren(...links.map((link) => {
    const anchor = document.createElement('a')
    anchor.className = 'object-link'
    anchor.href = link.url
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    anchor.title = link.title
    anchor.setAttribute('aria-label', link.title)
    if (link.icon === 'W') {
      const mark = document.createElement('span')
      mark.className = 'wikipedia-mark'
      mark.setAttribute('aria-hidden', 'true')
      mark.textContent = 'W'
      anchor.append(mark)
    } else anchor.append(createElement(link.icon, { width: 14, height: 14, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
    return anchor
  }))
  container.parentElement!.hidden = !links.length
}
