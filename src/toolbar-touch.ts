/** Give touch input an explicit equivalent of the toolbar's hover flyouts. */
export function initializeToolbarTouch(toolbar: HTMLElement, signal: AbortSignal): void {
  let openGroup: HTMLElement | null = null
  let openingTouch: HTMLElement | null = null

  const close = (blurFocus = true) => {
    if (!openGroup) return
    openGroup.removeAttribute('data-touch-open')
    // A second tap can focus a button. Release that focus so :focus-within
    // does not keep the flyout visible after an outside touch.
    if (blurFocus && document.activeElement instanceof HTMLElement && openGroup.contains(document.activeElement)) {
      document.activeElement.blur()
    }
    openGroup = null
  }

  document.addEventListener('pointerdown', (event) => {
    openingTouch = null
    const target = event.target instanceof Element ? event.target : null
    const group = target?.closest<HTMLElement>('[data-toolbar-flyout]') ?? null
    if (group !== openGroup) close()
    if (event.pointerType !== 'touch' || !group || !toolbar.contains(group)) return
    if (group === openGroup || !group.querySelector('button:not(:disabled)')) return

    openGroup = group
    openingTouch = group
    group.setAttribute('data-touch-open', '')
    // The first touch only reveals the options; a subsequent tap performs
    // the primary action. Do not depend on mobile browsers focusing buttons.
    event.preventDefault()
  }, { capture: true, signal })

  document.addEventListener('click', (event) => {
    if (!openingTouch || !(event.target instanceof Node) || !openingTouch.contains(event.target)) return
    openingTouch = null
    event.preventDefault()
    event.stopImmediatePropagation()
  }, { capture: true, signal })

  document.addEventListener('pointercancel', () => {
    if (openingTouch) close()
    openingTouch = null
  }, { signal })

  document.addEventListener('keydown', (event) => {
    openingTouch = null
    if (event.key === 'Escape') close()
    if (event.key === 'Tab') close(false)
  }, { signal })
}
