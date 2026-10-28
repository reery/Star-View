type TooltipActions = { show: () => void; hide: () => void }

const actions = new WeakMap<HTMLElement, TooltipActions>()

export function registerTouchTooltip(button: HTMLElement, handlers: TooltipActions): void {
  actions.set(button, handlers)
}

export function usingTouchTooltips(): boolean {
  return document.documentElement.dataset.tooltipInput === 'touch'
}

/** Touch must not depend on Safari focusing a button or emulating hover. */
export function initializeTouchTooltips(signal: AbortSignal): void {
  let active: { button: HTMLElement; tooltip: HTMLElement } | undefined
  let observer: MutationObserver | undefined
  const hide = () => {
    if (active) {
      active.tooltip.removeAttribute('data-touch-tooltip-open')
      actions.get(active.button)?.hide()
      active = undefined
    }
    observer?.disconnect()
  }
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
    hide()
    if (!event.isPrimary || !(event.target instanceof Element)) return
    const button = event.target.closest<HTMLElement>('[aria-describedby]')
    if (!button) return
    const tooltip = button.getAttribute('aria-describedby')?.split(/\s+/)
      .map((id) => document.getElementById(id))
      // Constellation stars select on the first tap instead of revealing their tooltip.
      .find((element) => element?.matches('.mass-metric-tooltip[role="tooltip"]:not([hidden], .constellation-tooltip)'))
    if (!tooltip) return
    active = { button, tooltip }
    tooltip.setAttribute('data-touch-tooltip-open', '')
    actions.get(button)?.show()
    observer = new MutationObserver(() => {
      if (!button.isConnected || !button.checkVisibility()) hide()
    })
    observer.observe(button.closest('.dock-card, .selected-object') ?? document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'],
    })
  }, { capture: true, passive: true, signal })

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') hide()
    else if (event.pointerType === 'mouse' && usingTouchTooltips()) keyboardOrMouse()
  }, { capture: true, passive: true, signal })
  document.addEventListener('pointercancel', hide, { capture: true, passive: true, signal })
  document.addEventListener('scroll', hide, { capture: true, passive: true, signal })
  document.addEventListener('keydown', keyboardOrMouse, { capture: true, signal })
  window.addEventListener('resize', hide, { signal })
  window.addEventListener('blur', hide, { signal })
  signal.addEventListener('abort', () => { hide(); delete document.documentElement.dataset.tooltipInput }, { once: true })
}
