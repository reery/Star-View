import { hideTouchTooltip } from './touch-tooltips'

const SETTLE_MS = 160
const REVEAL_MS = 220
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'
const COMMIT_DISTANCE_PX = 96
const FLICK_DISTANCE_PX = 24
const FLICK_SPEED = 0.45 // px per ms along the swipe
const RETURN_SPEED = -0.2 // Moving back this fast cancels even past the commit distance.
const IDLE_MS = 80 // A finger held this long before lifting has no speed left.
const AXIS_BIAS = 1.2 // A diagonal start belongs to vertical scrolling.
const END_RESISTANCE = 0.2

type SwipeKind = 'step' | 'close' | 'retract'
type Swipe = {
  card: HTMLElement
  target: Element
  startX: number
  startY: number
  kind?: SwipeKind
  /** What follows the finger: the card, or for a retract the content sliding under the summary. */
  moved: HTMLElement
  position: number
  lastRaw: number
  lastTime: number
  speed: number
  commitAt: number
  armed: boolean
  radius: string
  /** Distance a retract covers. */
  extent: number
  left: number
  previous?: HTMLButtonElement
  next?: HTMLButtonElement
  peeked?: HTMLButtonElement
  peekWidth: number
  peekHeight: number
  peekStart: number
}

/** Their headings still describe the last render, so the row's value names what will open. */
const titleInRow = new Set(['object-type-toggle', 'constellation-toggle'])

function anyUpTo(card: HTMLElement, from: Element, matches: (element: Element) => boolean): boolean {
  for (let element: Element | null = from; element; element = element.parentElement) {
    if (matches(element)) return true
    if (element === card) break
  }
  return false
}

const scrollable = (overflow: string) => overflow === 'auto' || overflow === 'scroll'

/**
 * Touch swipes on the object cards: sideways steps through the detail cards, down closes one, and up
 * retracts the selected object card. A card follows the finger by transform alone and nothing renders
 * until a swipe commits, so a cancelled swipe costs no work and an idle card holds no extra layer.
 */
export function initializeCardSwipes(inspector: HTMLElement, objectDetails: HTMLDetailsElement, touchInput: MediaQueryList, signal: AbortSignal): void {
  const peek = inspector.querySelector<HTMLElement>('.card-swipe-title')!
  const peekTitle = peek.querySelector('h2')!
  const objectSummary = objectDetails.querySelector('summary')!
  const objectBody = objectDetails.querySelector<HTMLElement>('.object-card-body')!
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let swipe: Swipe | undefined
  let settling = false
  let reveal: Animation | undefined

  // A lone keyframe animates from the inline value the finger left behind, on the compositor where it can.
  const settle = (element: Element, to: PropertyIndexedKeyframes) => element.animate(to, {
    duration: reducedMotion.matches ? 0 : SETTLE_MS, easing: EASING, fill: 'forwards',
  })
  const release = (element: HTMLElement) => {
    element.getAnimations().forEach((animation) => animation.cancel())
    element.style.removeProperty('transform')
    element.style.removeProperty('clip-path')
    element.style.removeProperty('z-index')
    element.classList.remove('is-swiping')
    element.removeAttribute('data-armed')
  }
  const hidePeek = () => {
    release(peek)
    peek.hidden = true
  }
  const showPeek = (active: Swipe, title: string) => {
    peekTitle.textContent = title
    peek.hidden = false
    active.peekWidth = peek.offsetWidth
    active.peekHeight = peek.offsetHeight
  }

  const steppableToggles = () => [...document.querySelectorAll<HTMLButtonElement>('#object-specs .object-type-toggle[aria-controls$="-card"]')]
    .filter((toggle) => !toggle.disabled && !toggle.closest('[hidden]'))
  const stepTitle = (toggle: HTMLButtonElement) => titleInRow.has(toggle.id)
    ? toggle.textContent!.trim()
    : document.getElementById(toggle.getAttribute('aria-controls')!)!.querySelector('h2')!.textContent!.trim()

  /** Claims the gesture from its first movement, the only one a browser still lets a page cancel. */
  function kindOf(active: Swipe, dx: number, dy: number): SwipeKind | undefined {
    const { target, card } = active
    if (target.closest('input, select, textarea') || getComputedStyle(target).touchAction === 'none') return undefined
    const sideways = Math.abs(dx) > Math.abs(dy) * AXIS_BIAS
    if (card.matches('.selected-object')) {
      if (sideways || dy >= 0 || !objectDetails.open) return undefined
      const scrollsUp = anyUpTo(card, target, (element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop > 1 && scrollable(getComputedStyle(element).overflowY))
      return scrollsUp ? undefined : 'retract'
    }
    if (sideways) {
      const scrollsSideways = anyUpTo(card, target, (element) =>
        element.scrollWidth - element.clientWidth > 1 && scrollable(getComputedStyle(element).overflowX))
      return scrollsSideways ? undefined : 'step'
    }
    return dy > 0 && !anyUpTo(card, target, (element) => element.scrollTop > 0) ? 'close' : undefined
  }

  function begin(active: Swipe, kind: SwipeKind): void {
    hideTouchTooltip()
    active.kind = kind
    active.radius = getComputedStyle(active.card).borderTopLeftRadius
    const height = active.card.offsetHeight
    if (kind === 'retract') {
      active.moved = objectBody
      active.extent = height - objectSummary.offsetHeight
      active.commitAt = Math.min(COMMIT_DISTANCE_PX, active.extent / 2)
    } else if (kind === 'close') {
      active.commitAt = Math.min(COMMIT_DISTANCE_PX, height / 2)
      // The word waits underneath, uncovered as the card leaves.
      active.card.style.zIndex = '3'
      showPeek(active, 'Close')
    } else {
      const toggles = steppableToggles()
      const index = toggles.findIndex((toggle) => toggle.getAttribute('aria-controls') === active.card.id)
      if (index >= 0) {
        active.previous = toggles[index - 1]
        active.next = toggles[index + 1]
      }
      active.left = active.card.getBoundingClientRect().left
      active.commitAt = Math.min(COMMIT_DISTANCE_PX, active.card.offsetWidth * 0.4)
    }
    active.moved.classList.add('is-swiping')
  }

  function drag(active: Swipe, dx: number, dy: number, time: number): void {
    const raw = active.kind === 'step' ? dx : active.kind === 'close' ? dy : -dy
    if (time > active.lastTime) {
      active.speed = (raw - active.lastRaw) / (time - active.lastTime)
      active.lastRaw = raw
      active.lastTime = time
    }
    let armed: boolean
    if (active.kind === 'step') {
      active.position = raw
      const neighbour = raw < 0 ? active.next : active.previous
      if (neighbour !== active.peeked) {
        active.peeked = neighbour
        if (neighbour) {
          showPeek(active, stepTitle(neighbour))
          active.peekStart = raw < 0 ? window.innerWidth - active.left : -active.left - active.peekWidth
        } else peek.hidden = true
      }
      active.card.style.transform = `translate3d(${neighbour ? raw : raw * END_RESISTANCE}px,0,0)`
      armed = Boolean(neighbour) && Math.abs(raw) >= active.commitAt
      // The title reaches its final place exactly as the swipe arms.
      if (neighbour) peek.style.transform = `translate3d(${active.peekStart * Math.max(0, 1 - Math.abs(raw) / active.commitAt)}px,0,0)`
    } else if (active.kind === 'close') {
      active.position = Math.max(0, raw)
      active.card.style.transform = `translate3d(0,${active.position}px,0)`
      armed = active.position >= active.commitAt
    } else {
      active.position = Math.min(active.extent, Math.max(0, raw))
      objectBody.style.transform = `translate3d(0,${-active.position}px,0)`
      active.card.style.clipPath = `inset(0 0 ${active.position}px 0 round ${active.radius})`
      armed = active.position >= active.commitAt
    }
    if (armed !== active.armed) {
      active.armed = armed
      active.moved.toggleAttribute('data-armed', armed)
      peek.toggleAttribute('data-armed', armed)
    }
  }

  function shouldCommit(active: Swipe, time: number): boolean {
    if (active.kind === 'step' && !active.peeked) return false
    const forward = active.kind === 'step' ? Math.sign(active.position) : 1
    const speed = time - active.lastTime > IDLE_MS ? 0 : active.speed * forward
    if (speed <= RETURN_SPEED) return false
    return active.armed || (speed >= FLICK_SPEED && Math.abs(active.position) >= FLICK_DISTANCE_PX)
  }

  async function commitStep(active: Swipe): Promise<void> {
    const toggle = active.peeked!
    const direction = Math.sign(active.position)
    const { peekWidth, peekHeight, radius } = active
    peek.removeAttribute('data-armed')
    settle(peek, { transform: 'none' })
    if (!reducedMotion.matches) peekTitle.animate({ transform: ['scale(1.08)', 'none'] }, { duration: SETTLE_MS, easing: EASING })
    // Rendering waits until the old card is gone, so even a heavy card cannot stutter its way out.
    await settle(active.card, { transform: `translate3d(${direction * window.innerWidth}px,0,0)`, opacity: 0 }).finished
    if (!active.card.hidden) toggle.click()
    const opened = document.getElementById(toggle.getAttribute('aria-controls')!)!
    hidePeek()
    release(active.card)
    if (opened.hidden || reducedMotion.matches) return
    // The card unrolls from the very rectangle the title occupied.
    reveal = opened.animate({
      clipPath: [`inset(0 calc(100% - ${peekWidth}px) calc(100% - ${peekHeight}px) 0 round ${radius})`, `inset(0 0 0 0 round ${radius})`],
    }, { duration: REVEAL_MS, easing: EASING })
  }

  async function finish(active: Swipe, commit: boolean): Promise<void> {
    settling = true
    swipe = undefined
    const { kind, card, moved, position, extent, radius } = active
    try {
      if (!commit) {
        moved.removeAttribute('data-armed')
        peek.removeAttribute('data-armed')
        if (kind === 'step' && active.peeked) settle(peek, { transform: `translate3d(${active.peekStart}px,0,0)` })
        if (kind === 'retract') settle(card, { clipPath: `inset(0 0 0 0 round ${radius})` })
        await settle(moved, { transform: 'translate3d(0,0,0)' }).finished
      } else if (kind === 'step') {
        await commitStep(active)
      } else if (kind === 'close') {
        peek.hidden = true
        await settle(card, { transform: `translate3d(0,${position + 120}px,0)`, opacity: 0 }).finished
        card.querySelector<HTMLButtonElement>('[id$="-close"]')!.click()
      } else {
        settle(card, { clipPath: `inset(0 0 ${extent}px 0 round ${radius})` })
        await settle(objectBody, { transform: `translate3d(0,${-extent}px,0)`, opacity: 0 }).finished
        objectDetails.open = false
      }
    } finally {
      hidePeek()
      release(moved)
      release(card)
      settling = false
    }
  }

  const options = { passive: true, signal }
  inspector.addEventListener('touchstart', (event) => {
    if (event.touches.length > 1) {
      if (swipe?.kind) void finish(swipe, false)
      swipe = undefined
      return
    }
    if (settling || !touchInput.matches || !(event.target instanceof Element)) return
    const card = event.target.closest<HTMLElement>('.object-type-card, .selected-object')
    if (!card) return
    // A quick next swipe does not wait for the previous card to finish arriving.
    reveal?.finish()
    const touch = event.touches[0]!
    swipe = {
      card, target: event.target, startX: touch.clientX, startY: touch.clientY, moved: card,
      position: 0, lastRaw: 0, lastTime: event.timeStamp, speed: 0, commitAt: COMMIT_DISTANCE_PX,
      armed: false, radius: '0', extent: 0, left: 0, peekWidth: 0, peekHeight: 0, peekStart: 0,
    }
  }, options)

  inspector.addEventListener('touchmove', (event) => {
    if (!swipe) return
    const touch = event.touches[0]!
    const dx = touch.clientX - swipe.startX
    const dy = touch.clientY - swipe.startY
    if (!swipe.kind) {
      if (Math.hypot(dx, dy) < 4) return
      const kind = event.cancelable ? kindOf(swipe, dx, dy) : undefined
      if (!kind) {
        swipe = undefined
        return
      }
      begin(swipe, kind)
    }
    if (event.cancelable) event.preventDefault()
    drag(swipe, dx, dy, event.timeStamp)
  }, { passive: false, signal })

  inspector.addEventListener('touchend', (event) => {
    if (!swipe || event.touches.length) return
    const active = swipe
    if (active.kind) void finish(active, shouldCommit(active, event.timeStamp))
    swipe = undefined
  }, options)
  inspector.addEventListener('touchcancel', () => {
    if (swipe?.kind) void finish(swipe, false)
    swipe = undefined
  }, options)
}
