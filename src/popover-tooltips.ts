import { registerTouchTooltip, usingTouchTooltips } from './touch-tooltips'

let hideActiveTooltip: (() => void) | undefined

/** Below-preferred tooltips may extend past the card's bottom edge, staying within the viewport. */
export function attachPopoverTooltip(button: HTMLButtonElement, tooltip: HTMLElement, preferBelow = false): void {
  tooltip.setAttribute('popover', 'manual')
  button.setAttribute('aria-describedby', tooltip.id)
  let hovered = false
  let listeners: AbortController | undefined
  let observer: MutationObserver | undefined
  let resizeObserver: ResizeObserver | undefined
  const hide = () => {
    if (tooltip.matches(':popover-open')) tooltip.hidePopover()
    listeners?.abort()
    observer?.disconnect()
    resizeObserver?.disconnect()
    if (hideActiveTooltip === hide) hideActiveTooltip = undefined
  }
  const position = () => {
    if (!button.isConnected || !button.checkVisibility()) {
      hide()
      return
    }
    const card = button.closest<HTMLElement>('.dock-card, .selected-object')!
    const scroller = button.closest<HTMLElement>('.card-scroll-content, .object-card-body')!
    const anchor = button.getBoundingClientRect()
    const scrollBounds = scroller.getBoundingClientRect()
    if (anchor.bottom <= scrollBounds.top || anchor.top >= scrollBounds.bottom) {
      hide()
      return
    }
    const bounds = card.getBoundingClientRect()
    const margin = 8, gap = 8
    const leftEdge = Math.max(margin, bounds.left + margin)
    const rightEdge = Math.min(window.innerWidth - margin, bounds.right - margin)
    const topEdge = Math.max(margin, bounds.top + margin)
    const bottomEdge = Math.min(window.innerHeight, preferBelow ? Infinity : bounds.bottom) - margin
    const maxWidth = rightEdge - leftEdge
    let width = Math.min(button.closest('.moon-properties') ? 300 : 280, maxWidth)
    tooltip.style.maxWidth = `${width}px`
    // A wider tooltip needs fewer lines when its label is near the preferred edge.
    const room = preferBelow ? bottomEdge - anchor.bottom - gap : anchor.top - gap - topEdge
    while (tooltip.offsetHeight > room && width < maxWidth) {
      width = Math.min(width + 24, maxWidth)
      tooltip.style.maxWidth = `${width}px`
    }
    const size = tooltip.getBoundingClientRect()
    const alignRight = (anchor.left + anchor.right) / 2 > (bounds.left + bounds.right) / 2
    const left = Math.max(leftEdge, Math.min(alignRight ? anchor.right - size.width : anchor.left, rightEdge - size.width))
    const above = anchor.top - gap - size.height
    const fitsBelow = anchor.bottom + gap + size.height <= bottomEdge
    const below = preferBelow ? fitsBelow || above < topEdge : above < topEdge && fitsBelow
    const top = Math.max(topEdge, Math.min(below ? anchor.bottom + gap : above, bottomEdge - size.height))
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
    tooltip.dataset.placement = below ? 'below' : 'above'
    tooltip.style.setProperty('--popover-tooltip-arrow', `${Math.max(10, Math.min((anchor.left + anchor.right) / 2 - left - 4, size.width - 18))}px`)
  }
  const show = () => {
    if (tooltip.matches(':popover-open')) return
    hideActiveTooltip?.()
    hideActiveTooltip = hide
    // The top layer escapes both the scroll area's clipping and the sticky headers.
    tooltip.showPopover()
    position()
    if (!tooltip.matches(':popover-open')) return
    listeners = new AbortController()
    const { signal } = listeners
    window.addEventListener('resize', position, { signal })
    document.addEventListener('scroll', position, { capture: true, passive: true, signal })
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide() }, { signal })
    document.addEventListener('pointerdown', (event) => { if (!button.contains(event.target as Node)) hide() }, { signal })
    const card = button.closest<HTMLElement>('.dock-card, .selected-object')!
    observer = new MutationObserver(() => {
      if (!button.isConnected || !button.checkVisibility()) hide()
    })
    observer.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })
    resizeObserver = new ResizeObserver(position)
    resizeObserver.observe(card)
  }
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    hovered = true
    show()
  })
  button.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return
    hovered = false
    if (document.activeElement !== button) hide()
  })
  button.addEventListener('focus', () => { if (!usingTouchTooltips()) show() })
  button.addEventListener('blur', () => { if (!hovered && !usingTouchTooltips()) hide() })
  registerTouchTooltip(button, { show, hide })
}
