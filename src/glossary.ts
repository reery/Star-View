import { ChevronUp, createElement } from 'lucide'
import { GLOSSARY_GROUPS, GLOSSARY_TERMS, linkGlossaryTerms, loadGlossaryArticles, searchGlossary, type GlossaryArticle, type GlossaryFigure, type GlossaryTerm, type GlossaryWidget, wiki } from './glossary-index'
import type { WidgetMount } from './glossary-widget'
import { clearLoadRecovery, loadWithRecovery } from './load-recovery'

const START_TERMS = ['star', 'lightyear', 'apparent-magnitude', 'spectral-type', 'hr-diagram', 'stellar-evolution', 'parallax', 'constellation']

const WIDGETS: Record<GlossaryWidget, () => Promise<{ mount: WidgetMount }>> = {
  temperature: () => import('./glossary-widget-temperature'),
  parallax: () => import('./glossary-widget-parallax'),
  magnitude: () => import('./glossary-widget-magnitude'),
  orbit: () => import('./glossary-widget-orbit'),
  lightcurve: () => import('./glossary-widget-lightcurve'),
  hr: () => import('./glossary-widget-hr'),
  fate: () => import('./glossary-widget-fate'),
  habitable: () => import('./glossary-widget-habitable'),
  velocity: () => import('./glossary-widget-velocity'),
  angular: () => import('./glossary-widget-angular'),
  coordinates: () => import('./glossary-widget-coordinates'),
}

export interface GlossaryBrowser {
  open(): void
  show(id: string): void
}

export function initializeGlossary(signal: AbortSignal): GlossaryBrowser {
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
  const terms = get('glossary-terms')
  const body = terms.closest<HTMLElement>('.glossary-body')!
  const search = get<HTMLInputElement>('glossary-search')
  const detail = get('glossary-detail')
  const content = get('glossary-content')
  const heading = get('glossary-term-heading')
  const lead = get('glossary-lead')
  const related = get('glossary-related')
  const back = get<HTMLButtonElement>('glossary-back')
  const sidebar = get<HTMLButtonElement>('glossary-sidebar')
  const empty = get('glossary-empty')
  const phone = window.matchMedia('(max-width: 720px)')
  const termById = new Map(GLOSSARY_TERMS.map((term) => [term.id, term]))
  let selected: GlossaryTerm | null = null
  let filled: GlossaryTerm | null = null
  let widget: AbortController | undefined
  // Terms followed through article links; choosing from the list starts over.
  const trail: GlossaryTerm[] = []

  const buttons = new Map(GLOSSARY_TERMS.map((term) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'glossary-term'
    button.dataset.glossaryId = term.id
    button.textContent = term.title
    button.setAttribute('aria-controls', 'glossary-detail')
    return [term.id, button]
  }))
  const groups = new Map(GLOSSARY_GROUPS.map((group) => {
    const members = GLOSSARY_TERMS.filter((term) => term.group === group)
      .sort((first, second) => first.title.localeCompare(second.title, 'en', { sensitivity: 'base' }))
      .map((term) => buttons.get(term.id)!)
    const details = document.createElement('details')
    details.className = 'glossary-group'
    const summary = document.createElement('summary')
    summary.className = 'glossary-group-heading'
    const count = document.createElement('span')
    count.className = 'glossary-group-count'
    count.textContent = String(members.length)
    summary.append(group, count, createElement(ChevronUp, { width: 16, height: 16, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
    details.append(summary)
    // Fetch the group's articles as it opens, so choosing a term in it shows the whole article at once.
    details.addEventListener('toggle', () => { if (details.open) void loadGlossaryArticles(group).catch(() => {}) }, { signal })
    return [group, { details, members }]
  }))

  function renderLinked(target: HTMLElement, text: string, seen: Set<string>): void {
    target.replaceChildren(...linkGlossaryTerms(text, seen).map((part) => typeof part === 'string' ? part : termLink(part.id, part.text)))
  }

  function termLink(id: string, text: string): HTMLButtonElement {
    const link = document.createElement('button')
    link.type = 'button'
    link.className = 'constellation-info-link'
    link.dataset.glossaryLink = id
    link.textContent = text
    return link
  }

  function renderRelated(ids: readonly string[], label?: string): void {
    related.hidden = ids.length === 0
    related.replaceChildren(...(label ? [Object.assign(document.createElement('span'), { textContent: label }), ' '] : []))
    ids.forEach((id, index) => related.append(...(index ? [' · '] : []), termLink(id, termById.get(id)!.title)))
  }

  function figureElement({ image, caption, alt, position, fit, credit, creditUrl }: GlossaryFigure, lazy: boolean): HTMLElement {
    const figure = Object.assign(document.createElement('figure'), { className: 'glossary-figure' })
    const picture = Object.assign(document.createElement('img'), { src: image, alt: alt ?? caption, decoding: 'async' })
    if (lazy) picture.loading = 'lazy'
    picture.style.objectPosition = position ?? 'center'
    picture.style.objectFit = fit ?? 'cover'
    const text = document.createElement('figcaption')
    text.append(caption)
    if (credit) {
      text.append(' · Image: ')
      if (creditUrl) text.append(Object.assign(document.createElement('a'), { href: creditUrl, textContent: credit, target: '_blank', rel: 'noreferrer' }))
      else text.append(credit)
    }
    figure.append(picture, text)
    return figure
  }

  function paragraph(text: string, seen: Set<string>): HTMLParagraphElement {
    const element = Object.assign(document.createElement('p'), { className: 'glossary-description' })
    renderLinked(element, text, seen)
    return element
  }

  function externalLink(target: HTMLAnchorElement, label: string, url: string | undefined): void {
    target.hidden = !url
    if (!url) return
    target.href = url
    const arrow = document.createElement('span')
    arrow.textContent = ' ↗'
    arrow.setAttribute('aria-hidden', 'true')
    target.replaceChildren(label, arrow)
  }

  function mountWidget(host: HTMLElement, term: GlossaryTerm, { id, variant }: NonNullable<GlossaryArticle['interactive']>): void {
    const controller = widget = new AbortController()
    void loadWithRecovery(host, () => WIDGETS[id](), {
      label: 'this interactive diagram', silent: true, keepContent: true,
      retry: () => mountWidget(host, term, { id, variant }),
      isCurrent: () => selected === term,
    }).then((result) => { if (result && !controller.signal.aborted) result.value.mount(host, controller.signal, variant) })
  }

  /** Everything beyond the title and the definition, which the index already holds. */
  function renderArticleBody(article: GlossaryArticle | null, term: GlossaryTerm | null, seen: Set<string>): void {
    const parts: HTMLElement[] = []
    if (article?.figure) parts.push(figureElement(article.figure, false))
    if (article?.details) parts.push(paragraph(article.details, seen))
    const widgetHost = article?.interactive && term ? Object.assign(document.createElement('div'), { className: 'glossary-widget' }) : null
    if (widgetHost) parts.push(widgetHost)
    for (const { title, text, source, figure } of article?.sections ?? []) {
      const section = document.createElement('section')
      const heading = Object.assign(document.createElement('h4'), { className: 'card-subgroup-heading', textContent: title })
      if (source) {
        const link = Object.assign(document.createElement('a'), { href: source, target: '_blank', rel: 'noreferrer', className: 'planet-info-source', textContent: '↗' })
        link.setAttribute('aria-label', `Source for ${title}`)
        heading.append(link)
      }
      section.append(heading, paragraph(text, seen))
      if (figure) section.append(figureElement(figure, true))
      parts.push(section)
    }
    if (article?.deeper) {
      const deeper = Object.assign(document.createElement('details'), { className: 'designation-details glossary-deeper' })
      deeper.append(Object.assign(document.createElement('summary'), { textContent: 'Going deeper' }), paragraph(article.deeper, seen))
      parts.push(deeper)
    }
    get('glossary-article').replaceChildren(...parts)
    // Loading checks that the host is in the page, so mount only once it is.
    if (widgetHost) mountWidget(widgetHost, term!, article!.interactive!)
    if (term) renderRelated(article?.related ?? [], 'See also')
    externalLink(get<HTMLAnchorElement>('glossary-source'), `Read more on ${article?.sourceLabel ?? 'Wikipedia'}`, article?.source)
    externalLink(get<HTMLAnchorElement>('glossary-reference'), article?.reference?.label ?? '', article?.reference?.url)
    const also = get('glossary-also')
    also.hidden = !article?.also?.length
    also.replaceChildren()
    article?.also?.forEach((page, index) => {
      const url = page.startsWith('http') ? page : wiki(page)
      const label = page.startsWith('http') ? new URL(page).hostname.replace(/^www\./, '') : page.replace(/_/g, ' ')
      also.append(index ? ' · ' : 'Also from: ', Object.assign(document.createElement('a'), { href: url, textContent: label, target: '_blank', rel: 'noreferrer' }))
    })
    get('glossary-attribution').hidden = !article || article.sourceLabel !== undefined
  }

  function renderOverview(): void {
    heading.textContent = 'Start here'
    lead.textContent = 'Clear explanations of the ideas behind Star View, from what a star is to how astronomers measure one. Many terms include a diagram you can play with. Search above, open a group, or try one of these:'
    renderArticleBody(null, null, new Set())
    renderRelated(START_TERMS)
  }

  function renderTerm(term: GlossaryTerm): void {
    selected = term
    filled = null
    widget?.abort()
    clearLoadRecovery(content)
    heading.textContent = term.title
    const seen = new Set([term.id])
    renderLinked(lead, term.summary, seen)
    renderArticleBody(null, term, seen)
    for (const [id, button] of buttons) {
      if (id === term.id) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
    content.scrollTop = 0
    syncBack()
    // The definition shows at once; the rest follows when the group's articles arrive.
    void loadWithRecovery(content, () => loadGlossaryArticles(term.group), {
      label: term.title, silent: true, keepContent: true,
      retry: () => renderTerm(term),
      isCurrent: () => selected === term,
    }).then((result) => {
      if (!result) return
      renderArticleBody(result.value[term.id]!, term, seen)
      filled = term
    })
  }

  function syncBack(): void {
    const previous = trail.at(-1)
    body.toggleAttribute('data-term-history', previous !== undefined)
    const label = previous ? `Back to ${previous.title}` : 'Back to term list'
    back.setAttribute('aria-label', label)
    back.title = label
  }

  function setReading(reading: boolean): void {
    body.toggleAttribute('data-reading', reading)
    syncInert()
  }

  // On phones the off-screen pane, and the article while it only peeks past the list, must not take focus.
  function syncInert(): void {
    const reading = body.hasAttribute('data-reading')
    terms.inert = phone.matches && reading
    detail.inert = phone.matches && !reading
  }

  function revealSelected(): void {
    if (!selected) return
    if (!search.value.trim()) groups.get(selected.group)!.details.open = true
    const button = buttons.get(selected.id)!
    if (!button.isConnected) return
    // Only ever scroll the list itself: scrolling an ancestor would shift the sliding panes sideways.
    const list = terms.getBoundingClientRect(), bounds = button.getBoundingClientRect()
    if (bounds.top < list.top || bounds.bottom > list.bottom) terms.scrollTop += bounds.top - list.top - list.height / 2
  }

  function openTerm(term: GlossaryTerm): void {
    renderTerm(term)
    revealSelected()
    setReading(true)
    if (phone.matches) back.focus({ preventScroll: true })
  }

  function chooseFromList(term: GlossaryTerm): void {
    trail.length = 0
    openTerm(term)
  }

  function showList(): void {
    setReading(false)
    revealSelected()
    const button = selected && buttons.get(selected.id)
    if (button?.isConnected) button.focus({ preventScroll: true })
    else search.focus({ preventScroll: true })
  }

  function renderTerms(): void {
    terms.scrollTop = 0
    if (!search.value.trim()) {
      for (const { details, members } of groups.values()) details.append(...members)
      terms.replaceChildren(...[...groups.values()].map(({ details }) => details))
      revealSelected()
      return
    }
    const matches = searchGlossary(search.value)
    empty.hidden = matches.length !== 0
    terms.replaceChildren(...(matches.length ? matches.map((term) => buttons.get(term.id)!) : [empty]))
  }

  search.addEventListener('input', renderTerms, { signal })
  search.addEventListener('focus', () => {
    // Typing needs the list in view.
    if (phone.matches) setReading(false)
    else if (sidebar.getAttribute('aria-expanded') === 'false') sidebar.click()
  }, { signal })
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !search.value.trim()) return
    const first = searchGlossary(search.value)[0]
    if (first) chooseFromList(first)
  }, { signal })
  terms.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const term = termById.get(event.target.closest<HTMLButtonElement>('[data-glossary-id]')?.dataset.glossaryId ?? '')
    if (term) chooseFromList(term)
  }, { signal })
  detail.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const term = termById.get(event.target.closest<HTMLButtonElement>('[data-glossary-link]')?.dataset.glossaryLink ?? '')
    if (!term) return
    if (selected) trail.push(selected)
    openTerm(term)
  }, { signal })
  back.addEventListener('click', () => {
    const previous = trail.pop()
    if (previous) openTerm(previous)
    else showList()
  }, { signal })
  // An inert article passes its taps to the body: tapping the part that peeks past the list returns to it.
  body.addEventListener('click', (event) => {
    if (event.target !== body || !phone.matches || body.hasAttribute('data-reading')) return
    setReading(true)
    back.focus({ preventScroll: true })
  }, { signal })
  phone.addEventListener('change', syncInert, { signal })

  renderOverview()
  renderTerms()
  syncBack()
  syncInert()

  return {
    // A load interrupted by closing the card resumes when it reopens.
    open() { if (selected && filled !== selected) renderTerm(selected) },
    show(id) {
      const term = termById.get(id)
      if (!term) return
      if (search.value) {
        search.value = ''
        renderTerms()
      }
      chooseFromList(term)
      if (!phone.matches) heading.focus({ preventScroll: true })
    },
  }
}
