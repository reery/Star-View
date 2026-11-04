import './tutorial.css'

export interface TutorialHost {
  /** Selects an object when none is, so the selected-object card has content. */
  ensureSelection(): void
  /** Opens the object menu on an object offering both of its actions; false when this one does not. */
  openObjectMenu(id: string, x: number, y: number): boolean
  /** The distance filter's slider position for 1,000 light-years. */
  thousandLightYearsStep: number
}

interface Step {
  title: string
  body: string | (() => string)
  /** Existing icon element, name and description of each control the step lists. */
  items?: readonly (readonly [iconId: string, name: string, description: string])[]
  /** What the arrow points at; the first visible match wins. */
  target?: string | (() => string)
  /** A card the tile should sit beside rather than cover. */
  avoid?: string
  /** The side tried first when the default order would cover something the step shows. */
  side?: Side
  /** A toolbar flyout held open for the step. */
  flyout?: string
  /** A dock or toolbar card shown during the step. */
  panel?: string
  /** The control the step itself presses, when it still needs pressing. */
  press?(): string | null
  enter?(): void
  leave?(): void
}

const VIEWPORT_MARGIN = 12
const ARROW_ROOM = 76
const ARROW_LENGTH = { min: 64, max: 190 }
const MIN_TILE_HEIGHT = 200
const PRESS_FLASH_MS = 700
const SIDES = ['left', 'right', 'below', 'above'] as const
type Side = typeof SIDES[number]
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)))
const query = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)
const originName = () => query('#reference-base')?.textContent ?? 'Sun'

const panelOpen = (name: string) => query(`#${name}-toggle`)?.getAttribute('aria-expanded') === 'true'

function setPanel(name: string, open: boolean): void {
  if (panelOpen(name) !== open) query(`#${name}-toggle`)?.click()
}

function visibleElement(selector: string): HTMLElement | null {
  const element = query(selector)
  return element?.checkVisibility({ visibilityProperty: true }) ? element : null
}

/** A flyout's bounds cover its options as well as its trigger. */
function targetBounds(element: HTMLElement): DOMRect {
  const bounds = element.getBoundingClientRect()
  const options = element.matches('[data-toolbar-flyout]') ? element.querySelector('[data-toolbar-options]')?.getBoundingClientRect() : undefined
  if (!options) return bounds
  const left = Math.min(bounds.left, options.left)
  const top = Math.min(bounds.top, options.top)
  return new DOMRect(left, top, Math.max(bounds.right, options.right) - left, Math.max(bounds.bottom, options.bottom) - top)
}

/**
 * The tile's corner and height on the first side with room for it and the arrow, level with the target.
 * It sits beside the card it should not cover; when that leaves no room, beside the target, scrolling if it must.
 */
function tilePlacement(target: DOMRect, avoid: DOMRect | undefined, width: number, height: number, first?: Side): { x: number; y: number; height: number } {
  const free = (bounds: DOMRect) => ({ left: bounds.left, right: innerWidth - bounds.right, below: innerHeight - bounds.bottom, above: bounds.top })
  const needs = (side: Side) => (side === 'left' || side === 'right' ? width : height) + ARROW_ROOM + VIEWPORT_MARGIN
  const fittingSide = (bounds: DOMRect) => (first ? [first, ...SIDES] : SIDES).find((side) => free(bounds)[side] >= needs(side))
  const anchor = avoid && fittingSide(avoid) ? avoid : target
  const room = free(anchor)
  const side = fittingSide(anchor) ?? SIDES.reduce((best, candidate) => room[candidate] > room[best] ? candidate : best)
  const fitted = side === 'above' || side === 'below' ? Math.min(height, Math.max(room[side] - ARROW_ROOM - VIEWPORT_MARGIN, MIN_TILE_HEIGHT)) : height
  const x = side === 'left' ? anchor.left - ARROW_ROOM - width : side === 'right' ? anchor.right + ARROW_ROOM : target.left + (target.width - width) / 2
  const y = side === 'above' ? anchor.top - ARROW_ROOM - fitted : side === 'below' ? anchor.bottom + ARROW_ROOM : target.top + (target.height - fitted) / 2
  return {
    x: clamp(x, VIEWPORT_MARGIN, innerWidth - width - VIEWPORT_MARGIN),
    y: clamp(y, VIEWPORT_MARGIN, innerHeight - fitted - VIEWPORT_MARGIN),
    height: fitted,
  }
}

/** Frames a control, with at least a size the eye can find around a one-pixel star anchor. */
function placeRing(ring: HTMLElement, target: DOMRect): { x: number; y: number; width: number; height: number } {
  const width = Math.max(target.width + 10, 30)
  const height = Math.max(target.height + 10, 30)
  const x = target.x + target.width / 2
  const y = target.y + target.height / 2
  ring.style.width = `${width}px`
  ring.style.height = `${height}px`
  ring.style.transform = `translate(${x - width / 2}px, ${y - height / 2}px)`
  return { x, y, width, height }
}

/** Runs the tour; each step drives the app's real controls, and going back or finishing undoes what it changed. */
export function runTutorial(host: TutorialHost, signal: AbortSignal): void {
  const undo: { step: number; run(): void }[] = []
  let stopRotationOnLeave = false
  let closeDetailsOnLeave = false

  function recordChange(run: () => void): void {
    undo.push({ step: index, run })
  }

  function undoChangesFrom(step: number): void {
    while (undo.length && undo[undo.length - 1]!.step >= step) undo.pop()!.run()
  }

  function setSwitch(selector: string): void {
    const input = query<HTMLInputElement>(selector)
    if (!input || input.checked) return
    input.click()
    recordChange(() => input.click())
  }

  function setSlider(selector: string, value: number): void {
    const input = query<HTMLInputElement>(selector)
    if (!input) return
    const previous = input.value
    const apply = (next: string) => {
      input.value = next
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    apply(String(value))
    recordChange(() => apply(previous))
  }

  const steps: readonly Step[] = [
    {
      title: 'The origin',
      body: () => `Every distance here is measured from one point, the origin, and the grid is centered on it. Right now the origin is ${originName() === 'Sun' ? 'the Sun, so you see distances as they are from home' : originName()}.`,
      target: () => originName() === 'Sun' ? '.map-anchor[data-star-id="sun"]' : '#reference-base',
      side: 'below',
    },
    {
      title: 'Move the origin',
      body: 'Select any object and press this button to make it the origin. All distances and the grid follow, so you can measure the sky from another star. Beside it are shortcuts back to the origin and to the Sun.',
      target: '#origin-controls',
      flyout: '#origin-controls',
    },
    {
      title: 'Where you stand',
      body: 'This line keeps you oriented. Origin is where distances start. Visibility from is the object whose position decides which stars look bright. Distance from viewer is how far your camera is from that object.',
      target: '.visibility-observer > span',
      side: 'above',
    },
    {
      title: 'The object menu',
      body: 'Right-click an object, or hold a finger on it, to open this menu. From here you can make it the origin or compare it against your selection.',
      target: '#scene-context-menu',
      enter() {
        const center = { x: innerWidth / 2, y: innerHeight / 2 }
        const objects = [...document.querySelectorAll<HTMLElement>('.map-anchor[data-star-id]')]
          .map((anchor) => ({ id: anchor.dataset.starId!, ...anchor.getBoundingClientRect().toJSON() as { x: number; y: number } }))
          // Only objects the pointer could reach, not ones behind a card; the tile moves away for this step.
          .filter(({ x, y }) => document.elementsFromPoint(x, y).find((element) => !tile.contains(element))?.closest('#scene canvas'))
          .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))
        objects.some(({ id, x, y }) => host.openObjectMenu(id, x, y))
      },
      leave() {
        if (!query('#scene-context-menu')?.hidden) query('#scene-context-backdrop')?.click()
      },
    },
    {
      title: 'The selected object',
      body: 'Selecting an object opens this card. Its tabs show you different sides of it, and many values open a detailed card of their own when you click them.',
      items: [
        ['object-specs-icon', 'Specs', 'Distance, temperature, mass, brightness and more.'],
        ['object-info-icon', 'Info', 'The object’s story, where one is written.'],
        ['object-system-icon', 'System', 'Its companion stars and planets.'],
        ['object-compare-icon', 'Compare', 'Set it side by side with another star.'],
      ],
      target: '.object-card-footer',
      avoid: '#selected-object-card',
      press: () => query<HTMLDetailsElement>('#object-card-details')?.open ? null : '#object-specs-toggle',
      enter() {
        host.ensureSelection()
        closeDetailsOnLeave = !query<HTMLDetailsElement>('#object-card-details')?.open
        if (closeDetailsOnLeave) query('#object-specs-toggle')?.click()
      },
      leave() {
        const details = query<HTMLDetailsElement>('#object-card-details')
        if (closeDetailsOnLeave && details) details.open = false
      },
    },
    {
      title: 'Automatic rotation',
      body: 'A turning map makes its depth much easier to see. This button sits behind Reset view, and it’s running now. Use its card to change direction and speed, or to return to where you started.',
      target: '#rotation-toggle',
      side: 'below',
      flyout: '.camera-view-controls',
      panel: 'rotation',
      enter() {
        stopRotationOnLeave = query('#rotation-left')?.getAttribute('aria-pressed') !== 'true' && query('#rotation-right')?.getAttribute('aria-pressed') !== 'true'
        if (stopRotationOnLeave) query('#rotation-right')?.click()
      },
      leave() {
        if (!stopRotationOnLeave) return
        if (query('#rotation-right')?.getAttribute('aria-pressed') === 'true') query('#rotation-right')?.click()
        query('#rotation-reset')?.click()
      },
    },
    {
      title: 'Grids',
      body: 'Hover over the grid button, or tap it, to see all three grids. Each one can be switched on by itself.',
      items: [
        ['grid-icon', 'Map grid', 'Centered on the origin. Its spacing is shown in the bottom corner.'],
        ['equatorial-grid-icon', 'Equatorial grid', 'Right ascension and declination, as astronomers map Earth’s sky.'],
        ['galactic-grid-icon', 'Galactic grid', 'Coordinates aligned with the plane of the Milky Way.'],
      ],
      target: '.grid-controls',
      flyout: '.grid-controls',
    },
    {
      title: 'Saved views',
      body: 'Found a view worth keeping? Give it a name and save it. A saved view brings back the camera, filters, selection and motion settings, and stays in this browser.',
      target: '#save-view-form',
      avoid: '#views-panel',
      panel: 'views',
    },
    {
      title: 'Filters',
      body: 'This card decides what’s on the map: how many objects, which kinds, how far away and how faint. Let’s change two settings and watch the map fill up. We’ll put them back at the end.',
      target: '#filter-heading',
      avoid: '#filter-panel',
      panel: 'filter',
    },
    {
      title: 'Western constellations',
      body: 'Now switched on: every star of the Western constellation figures, plus famous star clusters. The nearest of them join the map straight away.',
      target: 'label[for="show-western-constellation-stars"]',
      avoid: '#filter-panel',
      panel: 'filter',
      enter: () => setSwitch('#show-western-constellation-stars'),
    },
    {
      title: 'Visibility distance',
      body: 'Now raised from 100 to 1,000 light-years from the origin. The constellation stars out to that distance now fill the map.',
      target: '.range-filter:has(#object-distance-limit)',
      avoid: '#filter-panel',
      panel: 'filter',
      enter: () => setSlider('#object-distance-limit', host.thousandLightYearsStep),
    },
    {
      title: 'Observe from',
      body: 'Stand on the selected object and look around: the sky appears as it would from there, with the stars at their brightness from that spot. Beside it, the second button observes from the origin.',
      target: '#observer-view-controls',
      flyout: '#observer-view-controls',
    },
    {
      title: 'Explore',
      body: 'Seven more tools are waiting behind this button.',
      items: [
        ['top-lists-icon', 'Top lists', 'The largest and hottest stars, supernova candidates and more.'],
        ['constellations-icon', 'Constellations', 'A chart of each one, and when you can see it.'],
        ['neighborhood-icon', 'Neighborhood', 'Who lives within a chosen radius of a star.'],
        ['motion-icon', 'Stellar motion', 'Run the clock 500,000 years either way and watch the stars move.'],
        ['paint-icon', 'Paint', 'Color and size the stars by their properties.'],
        ['graphs-icon', 'Graphs', 'Chart the objects on the map, then filter by a range.'],
        ['spaceship-icon', 'Spaceship', 'Take the controls and fly between the stars.'],
      ],
      target: '.discover-controls',
      flyout: '.discover-controls',
    },
    {
      title: 'Objects',
      body: 'Everything on the map, as a list you can search. Click a row to select an object. Right-click it, or hold a finger on it, for the same menu as on the map.',
      target: '#object-search',
      avoid: '#objects-panel',
      panel: 'objects',
    },
    {
      title: 'The full table',
      body: 'This button expands the list into a table with far more columns. Sort and filter it to answer questions like which of the nearest stars is the hottest.',
      target: '#objects-expand',
      side: 'above',
      panel: 'objects',
      press: () => query('#objects-panel')?.classList.contains('is-expanded') ? null : '#objects-expand',
      enter() {
        if (query('#objects-panel')?.classList.contains('is-expanded')) return
        query('#objects-expand')?.click()
        recordChange(() => { if (query('#objects-panel')?.classList.contains('is-expanded')) query('#objects-expand')?.click() })
      },
    },
    {
      title: 'Glossary',
      body: 'Not sure what a spectral class or a parallax is? Every term is explained here. That’s the tour. When you finish, your map goes back to how you left it. Clear skies!',
      target: '#glossary-terms',
      avoid: '#glossary-panel',
      panel: 'glossary',
    },
  ]

  const tile = document.createElement('section')
  tile.className = 'tutorial-tile'
  tile.setAttribute('role', 'dialog')
  tile.setAttribute('aria-labelledby', 'tutorial-title')
  const heading = document.createElement('div')
  heading.className = 'panel-heading'
  const title = document.createElement('h2')
  title.id = 'tutorial-title'
  const progress = document.createElement('span')
  progress.className = 'tutorial-progress'
  heading.append(title, progress)
  const content = document.createElement('div')
  content.className = 'tutorial-content'
  content.setAttribute('aria-live', 'polite')
  const actions = document.createElement('div')
  actions.className = 'browser-data-actions'
  const quit = Object.assign(document.createElement('button'), { type: 'button', className: 'tutorial-quit', textContent: 'Quit tutorial' })
  const back = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Previous' })
  const next = Object.assign(document.createElement('button'), { type: 'button', className: 'tutorial-next' })
  actions.append(quit, back, next)
  tile.append(heading, content, actions)
  const ring = Object.assign(document.createElement('div'), { className: 'tutorial-ring', hidden: true })
  const arrow = Object.assign(document.createElement('div'), { className: 'tutorial-arrow', hidden: true })
  arrow.append(document.createElement('i'))
  const pressedRing = Object.assign(document.createElement('div'), { className: 'tutorial-ring tutorial-pressed', hidden: true })
  document.body.append(ring, pressedRing, tile, arrow)

  let index = -1
  let frame = 0
  let lastLayout = ''
  /** The control flashing before the step presses it; the tile waits so nothing covers it. */
  let pressing: HTMLElement | null = null
  let pressTimer = 0
  const status = query('#scene-status')

  function showStep(nextIndex: number): void {
    const previous = steps[index]
    const step = steps[nextIndex]!
    previous?.leave?.()
    if (previous?.flyout && previous.flyout !== step.flyout) query(previous.flyout)?.removeAttribute('data-touch-open')
    if (previous?.panel && previous.panel !== step.panel) setPanel(previous.panel, false)
    index = nextIndex
    if (step.flyout) {
      const flyout = query(step.flyout)
      flyout?.removeAttribute('data-dismissed')
      flyout?.setAttribute('data-touch-open', '')
    }
    const control = step.panel && !panelOpen(step.panel) ? `#${step.panel}-toggle` : step.press?.()
    // The flyout holding the control has only just started opening, so its visibility cannot be asked yet.
    const element = control ? query(control) : null
    pressing = element?.checkVisibility() ? element : null
    if (!pressing) {
      presentStep(step)
      return
    }
    revealTarget(step, pressing)
    tile.style.visibility = 'hidden'
    pressedRing.classList.add('is-flashing')
    pressTimer = window.setTimeout(() => presentStep(step), PRESS_FLASH_MS)
  }

  function presentStep(step: Step): void {
    pressing = null
    tile.style.visibility = ''
    pressedRing.classList.remove('is-flashing')
    if (step.panel) setPanel(step.panel, true)
    step.enter?.()
    revealTarget(step)
    title.textContent = step.title
    progress.textContent = `${index + 1} / ${steps.length}`
    const body = document.createElement('p')
    body.textContent = typeof step.body === 'function' ? step.body() : step.body
    const list = document.createElement('ul')
    list.className = 'tutorial-items'
    for (const [iconId, name, description] of step.items ?? []) {
      const item = document.createElement('li')
      const icon = document.getElementById(iconId)?.firstElementChild?.cloneNode(true)
      const text = document.createElement('span')
      text.append(Object.assign(document.createElement('b'), { textContent: name }), ` · ${description}`)
      item.append(icon ?? document.createElement('span'), text)
      list.append(item)
    }
    content.replaceChildren(body, ...step.items ? [list] : [])
    content.scrollTop = 0
    const last = index === steps.length - 1
    next.textContent = last ? 'Finish' : 'Next'
    quit.hidden = last
    back.hidden = index === 0
    next.focus({ preventScroll: true })
    // Restarts the sweep along the tile's edge.
    tile.classList.remove('is-appearing')
    void tile.offsetWidth
    tile.classList.add('is-appearing')
  }

  /** Short screens scroll the rail and cards; a flyout there takes its height from its trigger. */
  function revealTarget(step: Step, control?: HTMLElement): void {
    const selector = typeof step.target === 'function' ? step.target() : step.target
    const flyout = step.flyout ? query(step.flyout) : null
    const target = flyout ?? control ?? (selector ? query(selector) : null)
    if (target?.closest('.scene-toolbar, .dock-card')) target.scrollIntoView({ block: 'nearest' })
    flyout?.style.setProperty('--toolbar-options-top', `${flyout.getBoundingClientRect().top}px`)
  }

  /** Follows moving targets, such as a star during rotation or a card opening late. */
  function layout(): void {
    frame = requestAnimationFrame(layout)
    // The toolbar's buttons wait for a loading scene, and so does the next step that uses them.
    const busy = status?.hidden === false
    if (next.disabled !== busy) {
      next.disabled = back.disabled = busy
      if (!busy) next.focus({ preventScroll: true })
    }
    const step = steps[index]!
    const selector = typeof step.target === 'function' ? step.target() : step.target
    const targetElement = selector && !pressing ? visibleElement(selector) : null
    const target = targetElement ? targetBounds(targetElement) : undefined
    const avoid = step.avoid ? visibleElement(step.avoid)?.getBoundingClientRect() : undefined
    // The icon of an open card stays framed; a target that is that icon already is.
    const heldElement = pressing ?? (step.panel ? visibleElement(`#${step.panel}-toggle`) : null)
    const held = heldElement && heldElement !== targetElement ? heldElement.getBoundingClientRect() : undefined
    const width = tile.offsetWidth
    const naturalHeight = Math.min(heading.offsetHeight + content.scrollHeight + actions.offsetHeight + 2, innerHeight - 2 * VIEWPORT_MARGIN)
    const position = target
      ? tilePlacement(target, avoid, width, naturalHeight, step.side)
      : { x: (innerWidth - width) / 2, y: (innerHeight - naturalHeight) / 2, height: naturalHeight }
    const key = `${position.x},${position.y},${position.height},${target?.x},${target?.y},${target?.width},${target?.height},${held?.x},${held?.y},${held?.width},${held?.height},${innerWidth},${innerHeight}`
    if (key === lastLayout) return
    lastLayout = key
    tile.style.height = `${position.height}px`
    tile.style.transform = `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)`
    pressedRing.hidden = !held
    if (held) placeRing(pressedRing, held)
    ring.hidden = arrow.hidden = !target
    if (!target) return

    ring.classList.toggle('is-point', target.width <= 1)
    const { x: ringX, y: ringY, width: ringWidth, height: ringHeight } = placeRing(ring, target)

    // The arrow leaves the tile at its point nearest the target, so it stays level when they are level.
    const startX = clamp(ringX, position.x, position.x + width)
    const startY = clamp(ringY, position.y, position.y + position.height)
    const distance = Math.hypot(ringX - startX, ringY - startY)
    arrow.hidden = distance === 0
    if (arrow.hidden) return
    const directionX = (ringX - startX) / distance
    const directionY = (ringY - startY) / distance
    const toRing = Math.min(ringWidth / 2 / (Math.abs(directionX) || 1e-6), ringHeight / 2 / (Math.abs(directionY) || 1e-6)) + 6
    const length = clamp(distance - toRing - 6, ARROW_LENGTH.min, ARROW_LENGTH.max)
    arrow.style.width = `${length}px`
    arrow.style.transform = `translate(${ringX - directionX * toRing - length}px, ${ringY - directionY * toRing - arrow.offsetHeight / 2}px) rotate(${Math.atan2(directionY, directionX)}rad)`
  }

  const keys = new AbortController()
  function finish(): void {
    cancelAnimationFrame(frame)
    clearTimeout(pressTimer)
    keys.abort()
    const step = steps[index]
    step?.leave?.()
    if (step?.flyout) query(step.flyout)?.removeAttribute('data-touch-open')
    if (step?.panel) setPanel(step.panel, false)
    undoChangesFrom(0)
    tile.remove()
    ring.remove()
    pressedRing.remove()
    arrow.remove()
  }

  quit.addEventListener('click', finish)
  back.addEventListener('click', () => {
    undoChangesFrom(index)
    showStep(index - 1)
  })
  next.addEventListener('click', () => {
    if (index === steps.length - 1) finish()
    else showStep(index + 1)
  })
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') finish() }, { signal: keys.signal })
  signal.addEventListener('abort', finish, { once: true, signal: keys.signal })

  // The tour needs the toolbar's controls, and its own cards are the only ones it should show.
  for (const toggle of document.querySelectorAll<HTMLElement>('.scene-toolbar .panel-button[aria-expanded="true"], .dock-rail .panel-button[aria-expanded="true"]')) toggle.click()
  showStep(0)
  layout()
}
