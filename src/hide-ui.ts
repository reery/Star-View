const REVEAL_MS = 3000
const MOUSE_EDGE_PX = 96
const TOUCH_EDGE_PX = 24
const SWIPE_PX = 24

/**
 * Hide UI slides the right-hand button rails off screen. Moving the pointer near the right edge, or
 * swiping in from it, brings them back for a few seconds; hovering, keyboard focus or an open touch
 * flyout keeps them in view.
 */
export function initializeHideUi(button: HTMLButtonElement, closeFlyout: () => void, onChange: (hidden: boolean) => void, signal: AbortSignal): void {
  const root = document.documentElement
  const rails = [...document.querySelectorAll<HTMLElement>('.scene-toolbar, .dock-rail')]
  const tooltip = button.querySelector('.tooltip')!
  let timer: number | undefined
  let swipe: { id: number, x: number } | undefined

  const hidden = () => root.hasAttribute('data-ui-hidden')
  const inRails = (target: EventTarget | null) => target instanceof Node && rails.some((rail) => rail.contains(target))
  const conceal = () => {
    if (rails.some((rail) => rail.matches(':hover') || rail.querySelector('[data-touch-open], :focus-visible'))) {
      timer = window.setTimeout(conceal, REVEAL_MS)
      return
    }
    closeFlyout()
    if (inRails(document.activeElement)) (document.activeElement as HTMLElement).blur()
    root.removeAttribute('data-ui-revealed')
  }
  const reveal = () => {
    if (!hidden()) return
    root.setAttribute('data-ui-revealed', '')
    clearTimeout(timer)
    timer = window.setTimeout(conceal, REVEAL_MS)
  }

  button.addEventListener('click', () => {
    const hide = !hidden()
    clearTimeout(timer)
    root.toggleAttribute('data-ui-hidden', hide)
    root.removeAttribute('data-ui-revealed')
    button.setAttribute('aria-pressed', String(hide))
    tooltip.textContent = hide ? 'Show UI' : 'Hide UI'
    if (hide) conceal()
    onChange(hide)
  }, { signal })

  document.addEventListener('pointermove', (event) => {
    if (!hidden()) return
    if (swipe?.id === event.pointerId) {
      event.stopPropagation()
      if (swipe.x - event.clientX >= SWIPE_PX) {
        swipe = undefined
        reveal()
      }
      return
    }
    if (event.pointerType !== 'touch' && event.buttons === 0 && (event.clientX >= window.innerWidth - MOUSE_EDGE_PX || inRails(event.target))) reveal()
  }, { capture: true, passive: true, signal })

  document.addEventListener('pointerdown', (event) => {
    if (!hidden()) return
    if (inRails(event.target)) {
      reveal()
      return
    }
    // A touch starting at the right edge of the map opens the rails instead of moving the camera.
    if (event.pointerType !== 'touch' || root.hasAttribute('data-ui-revealed') || event.clientX < window.innerWidth - TOUCH_EDGE_PX) return
    if (!(event.target instanceof HTMLCanvasElement) || !event.target.closest('.scene')) return
    swipe = { id: event.pointerId, x: event.clientX }
    event.stopPropagation()
  }, { capture: true, signal })

  const endSwipe = (event: PointerEvent) => {
    if (swipe?.id !== event.pointerId) return
    swipe = undefined
    event.stopPropagation()
  }
  document.addEventListener('pointerup', endSwipe, { capture: true, signal })
  document.addEventListener('pointercancel', endSwipe, { capture: true, signal })

  for (const rail of rails) rail.addEventListener('focusin', reveal, { signal })
}
