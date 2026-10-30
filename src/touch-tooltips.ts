type TooltipActions = { show: () => void; hide: () => void }
type TooltipButton = HTMLElement | SVGElement

const actions = new WeakMap<TooltipButton, TooltipActions>()
let active: { button: TooltipButton; tooltip: HTMLElement } | undefined
let observer: MutationObserver | undefined

export function registerTouchTooltip(button: TooltipButton, handlers: TooltipActions): void {
  actions.set(button, handlers)
}

export function usingTouchTooltips(): boolean {
  return document.documentElement.dataset.tooltipInput === 'touch'
}

export function touchTooltipOpen(button: TooltipButton): boolean {
  return active?.button === button
}

export function hideTouchTooltip(): void {
  if (active) {
    active.tooltip.removeAttribute('data-touch-tooltip-open')
    actions.get(active.button)?.hide()
    active = undefined
  }
  observer?.disconnect()
}

export function showTouchTooltip(button: TooltipButton, tooltip: HTMLElement): void {
  hideTouchTooltip()
  active = { button, tooltip }
  tooltip.setAttribute('data-touch-tooltip-open', '')
  actions.get(button)?.show()
  observer = new MutationObserver(() => {
    if (!button.isConnected || !button.checkVisibility()) hideTouchTooltip()
  })
  observer.observe(button.closest('.dock-card, .selected-object') ?? document.body, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'],
  })
}

/** Touch must not depend on Safari focusing a button or emulating hover. */
export function initializeTouchTooltips(signal: AbortSignal): void {
  const hide = hideTouchTooltip
  const keyboardOrMouse = () => {
    hide()
    delete document.documentElement.dataset.tooltipInput
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') {
      keyboardOrMouse()
      return
    }
    document.documentElement.dataset.tooltipInput = 'touch'
    const button = event.isPrimary && event.target instanceof Element ? event.target.closest<HTMLElement>('[aria-describedby]') : null
    // A second tap acts on the open tooltip's button instead of reopening it.
    if (button && touchTooltipOpen(button)) return
    hide()
    // Card tabs switch on the first tap; tapping the active tab again explains it.
    if (!button || button.matches('.mass-reference-option > .distance-reference-button[aria-pressed="false"]:not(:disabled)')) return
    const tooltip = button.getAttribute('aria-describedby')?.split(/\s+/)
      .map((id) => document.getElementById(id))
      // Revealing constellation tooltips on pointerdown makes mobile Safari swallow the click; they open on click.
      .find((element) => element?.matches('.mass-metric-tooltip[role="tooltip"]:not([hidden], .constellation-tooltip)'))
    if (tooltip) showTouchTooltip(button, tooltip)
  }, { capture: true, passive: true, signal })

  document.addEventListener('pointermove', (event) => {
    // Tap jitter on the open tooltip's button must not turn the second tap into another preview.
    if (event.pointerType === 'touch') { if (!(event.target instanceof Node && active?.button.contains(event.target))) hide() }
    else if (event.pointerType === 'mouse' && usingTouchTooltips()) keyboardOrMouse()
  }, { capture: true, passive: true, signal })
  document.addEventListener('pointercancel', hide, { capture: true, passive: true, signal })
  document.addEventListener('scroll', hide, { capture: true, passive: true, signal })
  document.addEventListener('keydown', keyboardOrMouse, { capture: true, signal })
  window.addEventListener('resize', hide, { signal })
  window.addEventListener('blur', hide, { signal })
  signal.addEventListener('abort', () => { hide(); delete document.documentElement.dataset.tooltipInput }, { once: true })
}
