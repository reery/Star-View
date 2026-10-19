/** Give touch input an explicit equivalent of the toolbar's hover flyouts. */
export function initializeToolbarTouch(toolbar: HTMLElement, signal: AbortSignal): void {
  let openGroup: HTMLElement | null = null
  let openingTouch: HTMLElement | null = null
  const shortScreen = window.matchMedia('(max-height: 500px) and (orientation: landscape) and (pointer: coarse)')

  const positionOptions = () => {
    if (!shortScreen.matches) return
    for (const group of toolbar.querySelectorAll<HTMLElement>('[data-toolbar-flyout]')) {
      group.style.setProperty('--toolbar-options-top', `${group.getBoundingClientRect().top}px`)
    }
  }
  const syncScrolling = () => {
    for (const rail of [toolbar, document.querySelector<HTMLElement>('.dock-rail')!]) {
      if (shortScreen.matches) rail.tabIndex = 0
      else rail.removeAttribute('tabindex')
    }
    positionOptions()
  }

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

  toolbar.addEventListener('pointerdown', positionOptions, { capture: true, passive: true, signal })
  toolbar.addEventListener('focusin', positionOptions, { signal })
  toolbar.addEventListener('scroll', () => {
    if (!shortScreen.matches) return
    close()
    // Keep keyboard focus when scrolling brings its button into view.
    const focused = document.activeElement
    const group = focused instanceof HTMLElement ? focused.closest('[data-toolbar-flyout]') : null
    if (group && focused instanceof HTMLElement) {
      const anchor = group.getBoundingClientRect()
      const viewport = toolbar.getBoundingClientRect()
      if (anchor.bottom <= viewport.top || anchor.top >= viewport.bottom) focused.blur()
    }
    positionOptions()
  }, { passive: true, signal })
  window.addEventListener('resize', syncScrolling, { signal })
  shortScreen.addEventListener('change', syncScrolling, { signal })
  syncScrolling()

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
