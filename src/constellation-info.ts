import type { Star } from './catalog-model'
import { constellationStarObject, type ConstellationChart } from './constellations'
import type { InfoImage, InfoSource, ObjectInfo } from './object-info-content'

interface ArticleImage { file: string; caption: string; alt: string }
interface ArticlePayload {
  reviewedAt: string
  name: string
  wikipedia: string
  introduction: string
  sections: { id: string; title: string; paragraphs: string[]; image?: ArticleImage }[]
}

// Each article is a separate lazy chunk; the glob keys alone tell which constellations have one.
const articles = import.meta.glob<ArticlePayload>('./data/constellation-info/*.json', { import: 'default' })
const diagrams = import.meta.glob<string>('./assets/constellations/*.svg', { query: '?url&no-inline', import: 'default', eager: true })
const articlePath = (name: string) => `./data/constellation-info/${name.toLowerCase().replace(/\s+/g, '-')}.json`

export function constellationInfoAvailable(name: string): boolean {
  return articlePath(name) in articles
}

function diagram(image: ArticleImage): InfoImage {
  const src = diagrams[`./assets/constellations/${image.file}.svg`]!
  const source: InfoSource = { title: 'Open full-size schematic', url: src }
  return { src, width: 840, height: 480, alt: image.alt, caption: image.caption, source,
    credit: 'Original Star View schematic drawn from the bundled catalogue positions. Not to scale unless stated.' }
}

export async function loadConstellationInfo(name: string): Promise<ObjectInfo> {
  const article = await articles[articlePath(name)]!()
  const source = { title: `Wikipedia: ${article.name} · reviewed ${article.reviewedAt}`, url: article.wikipedia }
  return {
    introduction: { label: article.name, text: article.introduction, source },
    sections: article.sections.map((section) => ({
      id: section.id, title: section.title, source,
      paragraphs: section.paragraphs.map((text) => ({ text })),
      image: section.image && diagram(section.image),
    })),
  }
}

/** Turn `[label](hip:N)` and `[label](id:object-id)` references into buttons that select the object. */
export function constellationInfoLinks(chart: ConstellationChart, objects: readonly Star[], onSelect: (object: Star) => void) {
  return (text: string): (string | Node)[] => text.split(/(\[[^\]]+\]\((?:hip|id):[^)]+\))/).map((part) => {
    const match = /^\[([^\]]+)\]\((hip|id):([^)]+)\)$/.exec(part)
    if (!match) return part
    const [, label, kind, reference] = match
    const figure = kind === 'hip' ? chart.stars.find((star) => star.hip === Number(reference)) : undefined
    const object = figure ? constellationStarObject(figure, objects) : objects.find((candidate) => candidate.id === reference)
    // Objects outside the loaded catalog or disabled layers stay plain text.
    if (!object) return label!
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'constellation-info-link'
    button.textContent = label!
    button.title = `Select ${object.name}`
    button.addEventListener('click', () => onSelect(object))
    return button
  })
}
