import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'

/** Fills a paired comparison tile heading with the star's scene-color swatch and name. */
export function renderComparisonName(target: HTMLElement, star: Star, mode: StarColorMode): void {
  target.classList.add('comparison-tile-name')
  const swatch = document.createElement('i')
  swatch.className = 'star-swatch'
  swatch.style.background = starDisplayColor(star, mode).getStyle()
  swatch.setAttribute('aria-hidden', 'true')
  const name = document.createElement('span')
  name.textContent = star.name
  target.replaceChildren(swatch, name)
}
