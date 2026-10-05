import { GLOSSARY_ENTRIES, GLOSSARY_GROUPS, type GlossaryEntry } from './glossary-data'

export function initializeGlossary(signal: AbortSignal): void {
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
  const terms = get('glossary-terms')
  const search = get<HTMLInputElement>('glossary-search')
  const detail = get('glossary-detail')
  let selectedId = GLOSSARY_ENTRIES[0]!.id
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[-‐‑–—]/g, ' ').replace(/\s+/g, ' ').trim()

  function renderDetail(entry: GlossaryEntry): void {
    selectedId = entry.id
    get('glossary-term-heading').textContent = entry.title
    get('glossary-term-category').textContent = entry.group
    get('glossary-description').textContent = entry.description
    get<HTMLAnchorElement>('glossary-source').href = entry.source
    const image = get<HTMLImageElement>('glossary-image')
    get('glossary-figure').hidden = !entry.image
    if (entry.image) {
      image.src = entry.image
      image.alt = entry.caption ?? entry.title
      image.style.objectPosition = entry.imagePosition ?? 'center'
      get('glossary-caption').textContent = entry.caption ?? ''
    } else {
      image.removeAttribute('src')
      image.alt = ''
    }
    const credit = get('glossary-image-credit')
    credit.replaceChildren()
    credit.hidden = !entry.imageCredit
    if (entry.imageCredit) {
      credit.append('Image: ')
      if (entry.imageSource) {
        const link = document.createElement('a')
        link.href = entry.imageSource
        link.textContent = entry.imageCredit
        link.target = '_blank'
        link.rel = 'noreferrer'
        credit.append(link)
      } else credit.append(entry.imageCredit)
    }
    for (const button of terms.querySelectorAll<HTMLButtonElement>('[data-glossary-id]')) {
      if (button.dataset.glossaryId === selectedId) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
    detail.scrollTop = 0
  }

  function renderTerms(): void {
    const query = normalize(search.value)
    const words = query.split(' ').filter(Boolean)
    const matches = GLOSSARY_ENTRIES.filter((entry) => {
      const haystack = normalize(`${entry.title} ${entry.aliases ?? ''}`)
      return words.every((word) => haystack.includes(word))
    })
    const fragment = document.createDocumentFragment()
    for (const group of GLOSSARY_GROUPS) {
      const entries = matches
        .filter((entry) => entry.group === group)
        .sort((first, second) => first.title.localeCompare(second.title, 'en', { sensitivity: 'base' }))
      if (!entries.length) continue
      const section = document.createElement('div')
      section.className = 'glossary-group'
      const heading = document.createElement('h3')
      heading.className = 'glossary-group-heading'
      heading.textContent = group
      section.append(heading)
      for (const entry of entries) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'glossary-term'
        button.dataset.glossaryId = entry.id
        button.textContent = entry.title
        button.setAttribute('aria-controls', 'glossary-detail')
        section.append(button)
      }
      fragment.append(section)
    }
    terms.replaceChildren(fragment)
    detail.hidden = matches.length === 0
    get('glossary-empty').hidden = matches.length !== 0
    const selected = matches.find((entry) => entry.id === selectedId) ?? matches[0]
    if (selected) renderDetail(selected)
  }

  search.addEventListener('input', renderTerms, { signal })
  terms.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('[data-glossary-id]')
    const entry = GLOSSARY_ENTRIES.find((candidate) => candidate.id === button?.dataset.glossaryId)
    if (entry) renderDetail(entry)
  }, { signal })
  renderTerms()
}
