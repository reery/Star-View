export function positionCardHeaderTooltips(card: HTMLElement): void {
  for (const option of card.querySelectorAll<HTMLElement>('.mass-reference-option')) {
    const button = option.querySelector<HTMLButtonElement>('button')!
    const tooltip = option.querySelector<HTMLElement>('[role="tooltip"]')!
    const always = option.hasAttribute('data-tooltip-always')
    const clipped = !button.hidden && button.scrollWidth > button.clientWidth
    option.dataset.clipped = String(clipped)
    if (!always) tooltip.textContent = button.textContent
    if (!button.hidden && (always || clipped)) {
      button.setAttribute('aria-describedby', tooltip.id)
      const bounds = option.getBoundingClientRect()
      const cardBounds = card.getBoundingClientRect()
      option.style.setProperty('--mass-tooltip-width', `${Math.min(240, cardBounds.width - 32)}px`)
      // Short labels use less than the maximum width; anchor their triangle to the actual popup.
      tooltip.style.display = 'block'
      const width = tooltip.getBoundingClientRect().width
      const border = tooltip.clientLeft
      tooltip.style.removeProperty('display')
      const inset = always ? 8 : 16
      const left = Math.max(cardBounds.left + inset, Math.min(bounds.left, cardBounds.right - width - inset))
      option.style.setProperty('--mass-tooltip-offset', `${left - bounds.left}px`)
      option.style.setProperty('--mass-tooltip-arrow', `${Math.max(always ? 4 : 10, Math.min(bounds.left + bounds.width / 2 - left - border - 4, width - 18))}px`)
    } else button.removeAttribute('aria-describedby')
    button.removeAttribute('title')
  }
}
