export interface InfoSource {
  title: string
  url: string
}

export interface InfoImage {
  src: string
  width: number
  height: number
  alt: string
  caption: string
  credit: string
  source: InfoSource
  license?: InfoSource
}

export interface InfoParagraph {
  text: string
  label?: string
  source?: InfoSource
}

export interface ObjectInfo {
  image?: InfoImage
  introduction: InfoParagraph
  sections: {
    id: string
    title: string
    source?: InfoSource
    paragraphs: InfoParagraph[]
    image?: InfoImage
  }[]
}

function sourceLink(source: InfoSource): HTMLAnchorElement {
  const link = document.createElement('a')
  link.href = source.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.title = source.title
  return link
}

export type InfoInline = (text: string) => (string | Node)[]

function infoParagraph(paragraph: InfoParagraph, inline?: InfoInline): HTMLParagraphElement {
  const element = document.createElement('p')
  if (paragraph.label) {
    const label = document.createElement('strong')
    if (paragraph.source) {
      const link = sourceLink(paragraph.source)
      link.textContent = paragraph.label
      label.append(link)
    } else label.textContent = paragraph.label
    element.append(label, ' ')
  }
  element.append(...(inline ? inline(paragraph.text) : [paragraph.text]))
  return element
}

function infoFigure(image: InfoImage, hero = false): HTMLElement {
  const figure = document.createElement('figure')
  figure.className = `planet-info-figure${hero ? ' planet-info-hero' : ''}`
  const link = sourceLink(image.source)
  link.title = image.credit
  link.setAttribute('aria-label', `${image.source.title}. ${image.credit}`)
  const picture = document.createElement('img')
  picture.src = image.src
  picture.width = image.width
  picture.height = image.height
  picture.alt = image.alt
  picture.loading = 'lazy'
  picture.decoding = 'async'
  link.append(picture)
  const caption = document.createElement('figcaption')
  const attribution = sourceLink(image.source)
  attribution.title = image.credit
  attribution.setAttribute('aria-label', `${image.caption}. ${image.credit}`)
  attribution.textContent = image.caption
  caption.append(attribution)
  if (image.license) {
    const license = sourceLink(image.license)
    license.textContent = image.license.title
    caption.append(' · ', license)
  }
  figure.append(link, caption)
  return figure
}

/** Shared sourced article layout for the selected-object, planet and constellation cards. */
export function renderObjectInfoContent(container: HTMLElement, info: ObjectInfo | undefined, inline?: InfoInline): boolean {
  container.replaceChildren()
  if (!info) return false
  if (info.image) container.append(infoFigure(info.image, true))
  container.append(infoParagraph(info.introduction, inline))
  for (const entry of info.sections) {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.id = `${container.id}-${entry.id}-heading`
    heading.className = 'card-subgroup-heading'
    heading.textContent = entry.title
    section.setAttribute('aria-labelledby', heading.id)
    if (entry.source) {
      const link = sourceLink(entry.source)
      link.className = 'planet-info-source'
      link.setAttribute('aria-label', `Source for ${entry.title}: ${entry.source.title}`)
      link.textContent = '↗'
      heading.append(link)
    }
    section.append(heading, ...entry.paragraphs.map((paragraph) => infoParagraph(paragraph, inline)))
    if (entry.image) section.append(infoFigure(entry.image))
    container.append(section)
  }
  return true
}
