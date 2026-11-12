import { STREAM_EASING, STREAM_MS, streamIn } from './content-stream'
import { hideTouchTooltip } from './touch-tooltips'

const SETTLE_MS = 160
const HEADING_SHIFT_PX = 48
const HEADING_FADE_SPAN = 0.6 // Share of the way to arming each heading fades over; the two overlap only briefly.
const BODY_FADE = 0.6 // How much of the old content has faded when a step arms.
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'
const COMMIT_DISTANCE_PX = 96
const FLICK_DISTANCE_PX = 24
const FLICK_SPEED = 0.45 // px per ms along the swipe
const RETURN_SPEED = -0.2 // Moving back this fast cancels even past the commit distance.
const IDLE_MS = 80 // A finger held this long before lifting has no speed left.
const AXIS_BIAS = 1.2 // A diagonal start belongs to vertical scrolling.
const END_RESISTANCE = 0.2
const WIGGLE_PX = 8
const WIGGLE_MS = 420
const HINT_FADE_MS = 200

/** Each line sits beside its arrows: sideways between the left and right ones, up or down under its own, above OK. */
type SwipeHint = { key: string; lines: readonly (readonly ['sideways' | 'up' | 'down', string])[] }
const OBJECT_HINT: SwipeHint = {
  key: 'swipe-hint-object-card',
  lines: [['sideways', 'Swipe left or right to switch tabs'], ['up', 'Swipe up to collapse the card']],
}
const DETAIL_HINT: SwipeHint = {
  key: 'swipe-hint-detail-card',
  lines: [['sideways', 'Swipe left or right for the previous or next detail'], ['down', 'Swipe down to close the card']],
}

type SwipeKind = 'step' | 'close' | 'retract'
type Swipe = {
  card: HTMLElement
  target: Element
  startX: number
  startY: number
  kind?: SwipeKind
  /** What follows the finger: the card, or for a retract the content sliding under the header. */
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
  previous?: HTMLButtonElement
  next?: HTMLButtonElement
  peeked?: HTMLButtonElement
  /** The neighbouring card, showing only its heading while a step is under way. */
  incoming?: HTMLElement
  incomingWidth: number
  incomingHeading: HTMLElement[]
  outgoingHeading: HTMLElement[]
  outgoingBody: HTMLElement[]
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

const headingParts = (card: HTMLElement) => [...card.querySelector(':scope > .panel-heading')!.children] as HTMLElement[]
const bodyParts = (card: HTMLElement) => ([...card.children] as HTMLElement[]).filter((child) => !child.matches('.panel-heading'))
const toggledCard = (toggle: HTMLButtonElement) => document.getElementById(toggle.getAttribute('aria-controls')!)!
/** Streams in what is not already waiting for its data to stream in. */
const streamInParts = (parts: HTMLElement[]) => parts
  .filter((part) => !part.getAnimations().some((animation) => !(animation instanceof CSSAnimation)))
  .map(streamIn)
const isLoading = (card: HTMLElement) => card.matches('[aria-busy="true"], :has([aria-busy="true"]:not([hidden], [hidden] *, details:not([open]) *))')

/**
 * Touch swipes on the object cards: sideways steps through the detail cards or the selected object card's
 * sections, down closes a detail card, and up retracts the selected object card. A step keeps the card's
 * frame and heading row in place, exchanges what the row holds and moves the content out under it. Everything follows the finger by transform and
 * opacity alone and nothing renders until a swipe commits, so a cancelled swipe costs no work and an idle
 * card holds no extra layer.
 */
export function initializeCardSwipes(inspector: HTMLElement, objectDetails: HTMLDetailsElement, touchInput: MediaQueryList, signal: AbortSignal): void {
  const blankFrame = inspector.querySelector<HTMLElement>('.card-swipe-frame')!
  const objectHeader = inspector.querySelector<HTMLElement>('#object-card-header')!
  const objectBody = objectDetails.querySelector<HTMLElement>('.object-card-body')!
  const selectedCard = objectDetails.closest<HTMLElement>('.selected-object')!
  const shownSection = () => [...objectBody.children].filter((child) => !(child as HTMLElement).hidden) as HTMLElement[]
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let swipe: Swipe | undefined
  let settling = false
  let reveal: Animation[] = []
  let endDrawIn: (() => void) | undefined

  // A lone keyframe animates from the inline value the finger left behind, on the compositor where it can.
  const settle = (element: Element, to: PropertyIndexedKeyframes) => element.animate(to, {
    duration: reducedMotion.matches ? 0 : SETTLE_MS, easing: EASING, fill: 'forwards',
  })
  const release = (element: HTMLElement) => {
    // Only what settle() left behind: content may still be held by a stream waiting for its data.
    element.getAnimations().forEach((animation) => {
      if (animation.effect?.getTiming().fill === 'forwards') animation.cancel()
    })
    element.style.removeProperty('transform')
    element.style.removeProperty('opacity')
    element.style.removeProperty('width')
    element.style.removeProperty('clip-path')
    element.classList.remove('is-swiping', 'is-step-part', 'is-stepping', 'is-step-peek')
    element.removeAttribute('data-armed')
  }
  const dropIncoming = (active: Swipe) => {
    active.incomingHeading.forEach(release)
    active.incomingHeading = []
    if (active.incoming) release(active.incoming)
    active.incoming = undefined
  }
  /** Leaves `hidden` set, so that to the app the neighbouring card stays closed until a step commits. */
  const showIncoming = (active: Swipe, toggle: HTMLButtonElement) => {
    const card = toggledCard(toggle)
    if (titleInRow.has(toggle.id)) card.querySelector('h2')!.textContent = toggle.textContent!.trim()
    card.classList.add('is-step-peek')
    // Cards differ slightly in width; the heading stays inside the frame it is drawn over.
    active.incomingWidth = card.offsetWidth
    card.style.width = `${active.card.offsetWidth}px`
    active.incoming = card
    active.incomingHeading = headingParts(card)
    active.incomingHeading.forEach((part) => part.classList.add('is-step-part'))
  }
  const endStep = (active: Swipe) => {
    dropIncoming(active)
    active.outgoingHeading.forEach(release)
    active.outgoingBody.forEach(release)
  }
  const shift = (x: number) => `translate3d(${x}px,0,0)`
  /** `shown` runs from 0, displaced towards `side`, to 1 at the part's own place. */
  const poseHeading = (parts: HTMLElement[], side: number, shown: number) => parts.forEach((part) => {
    part.style.transform = shift(side * (1 - shown) * HEADING_SHIFT_PX)
    part.style.opacity = String(shown)
  })

  const steppableToggles = () => [...document.querySelectorAll<HTMLButtonElement>('#object-specs .object-type-toggle[aria-controls$="-card"]')]
    .filter((toggle) => !toggle.disabled && !toggle.closest('[hidden]'))
  // Compare has no section of its own, so it is not among them.
  const sectionToggles = () => [...objectHeader.querySelectorAll<HTMLButtonElement>('.object-section-button[aria-controls]')]
    .filter((toggle) => !toggle.disabled)

  /** Claims the gesture from its first movement, the only one a browser still lets a page cancel. */
  function kindOf(active: Swipe, dx: number, dy: number): SwipeKind | undefined {
    const { target, card } = active
    if (target.closest('input, select, textarea') || getComputedStyle(target).touchAction === 'none') return undefined
    const sideways = Math.abs(dx) > Math.abs(dy) * AXIS_BIAS
    if (card === selectedCard && !sideways) {
      if (dy >= 0 || !objectDetails.open) return undefined
      const scrollsUp = anyUpTo(card, target, (element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop > 1 && scrollable(getComputedStyle(element).overflowY))
      return scrollsUp ? undefined : 'retract'
    }
    if (sideways) {
      if (card === selectedCard && !objectDetails.open) return undefined
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
      active.extent = height - objectHeader.offsetHeight
      active.commitAt = Math.min(COMMIT_DISTANCE_PX, active.extent / 2)
    } else if (kind === 'close') {
      active.commitAt = Math.min(COMMIT_DISTANCE_PX, height / 2)
    } else {
      const sections = active.card === selectedCard
      const toggles = sections ? sectionToggles() : steppableToggles()
      const index = toggles.findIndex((toggle) => sections
        ? toggle.getAttribute('aria-expanded') === 'true'
        : toggle.getAttribute('aria-controls') === active.card.id)
      if (index >= 0) {
        active.previous = toggles[index - 1]
        active.next = toggles[index + 1]
      }
      active.commitAt = Math.min(COMMIT_DISTANCE_PX, active.card.offsetWidth * 0.4)
      // The header with the section buttons stays; only the section moves.
      if (sections) {
        active.outgoingBody = [objectBody]
        objectBody.classList.add('is-step-part')
        return
      }
      active.outgoingHeading = headingParts(active.card)
      active.outgoingBody = bodyParts(active.card)
      active.card.classList.add('is-stepping')
      for (const part of [...active.outgoingHeading, ...active.outgoingBody]) part.classList.add('is-step-part')
      return
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
        dropIncoming(active)
        if (neighbour && active.card !== selectedCard) showIncoming(active, neighbour)
        else poseHeading(active.outgoingHeading, 0, 1)
      }
      // The exchange completes exactly as the swipe arms.
      const progress = neighbour ? Math.min(1, Math.abs(raw) / active.commitAt) : 0
      if (neighbour) {
        poseHeading(active.outgoingHeading, Math.sign(raw), Math.max(0, 1 - progress / HEADING_FADE_SPAN))
        poseHeading(active.incomingHeading, -Math.sign(raw), Math.max(0, (progress - 1 + HEADING_FADE_SPAN) / HEADING_FADE_SPAN))
      }
      for (const part of active.outgoingBody) {
        part.style.transform = shift(neighbour ? raw : raw * END_RESISTANCE)
        part.style.opacity = String(1 - progress * BODY_FADE)
      }
      armed = Boolean(neighbour) && Math.abs(raw) >= active.commitAt
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
    const opened = active.incoming!
    const { card, radius, incomingWidth } = active
    const direction = Math.sign(active.position)
    // With only its heading laid out, this is the height the new card draws from.
    const headingHeight = opened.offsetHeight
    const { offsetWidth: oldWidth, offsetHeight: oldHeight } = card
    if (incomingWidth !== card.offsetWidth) settle(opened, { width: `${incomingWidth}px` })
    active.incomingHeading.forEach((part) => settle(part, { transform: 'none', opacity: 1 }))
    active.outgoingHeading.forEach((part) => settle(part, { transform: shift(direction * HEADING_SHIFT_PX), opacity: 0 }))
    // Rendering waits until the old content is gone, so even a heavy card cannot stutter its way out.
    await Promise.all(active.outgoingBody.map((part) => settle(part, { transform: shift(direction * oldWidth), opacity: 0 }).finished))
    // A card whose module is loaded renders during the click, and its charts measure themselves: the peek must be over.
    dropIncoming(active)
    if (!card.hidden) toggle.click()
    endStep(active)
    if (!opened.hidden && !reducedMotion.matches) drawIn(opened, oldWidth, oldHeight, `inset(0 0 calc(100% - ${headingHeight}px) 0 round ${radius})`, `inset(0 0 0 0 round ${radius})`)
  }

  /** The section slides out, and the next one draws in from the top as a stepped-to card does. */
  async function commitSection(active: Swipe): Promise<void> {
    const { card, radius } = active
    const oldHeight = card.offsetHeight
    await settle(objectBody, { transform: shift(Math.sign(active.position) * card.offsetWidth), opacity: 0 }).finished
    endStep(active)
    active.peeked!.click()
    if (reducedMotion.matches) return
    const timing = { duration: STREAM_MS, easing: STREAM_EASING }
    reveal = [card.animate({ clipPath: [`inset(0 0 ${Math.max(0, card.offsetHeight - oldHeight)}px 0 round ${radius})`, `inset(0 0 0 0 round ${radius})`] }, timing)]
    reveal.push(...streamInParts(shownSection()))
  }

  /** Nothing lies that way: the content springs back past its place and settles, so the swipe still answers. */
  const wiggle = (element: HTMLElement, side: number) => element.animate([
    { transform: shift(-side * WIGGLE_PX), opacity: 1, offset: 0.3 },
    { transform: shift(side * WIGGLE_PX * 0.5), opacity: 1, offset: 0.55 },
    { transform: shift(-side * WIGGLE_PX * 0.2), opacity: 1, offset: 0.8 },
    { transform: 'none', opacity: 1 },
  ], { duration: WIGGLE_MS, easing: 'ease-out', fill: 'forwards' })

  /** A blank frame keeps the old card's size until the new card has its content, then eases to the new size as the card draws in over it. */
  function drawIn(opened: HTMLElement, oldWidth: number, oldHeight: number, closed: string, open: string): void {
    const startWidth = `${Math.max(oldWidth, opened.offsetWidth)}px`
    const startHeight = `${oldHeight}px`
    blankFrame.style.width = startWidth
    blankFrame.style.height = startHeight
    blankFrame.setAttribute('aria-busy', 'true')
    blankFrame.hidden = false
    opened.style.clipPath = closed
    const clear = () => {
      blankFrame.hidden = true
      blankFrame.removeAttribute('style')
      blankFrame.removeAttribute('aria-busy')
      opened.style.removeProperty('clip-path')
      endDrawIn = undefined
    }
    let frameRequest = 0
    // A touch does not wait for a slow card: it shows as a tapped card would.
    endDrawIn = () => {
      cancelAnimationFrame(frameRequest)
      clear()
    }
    const draw = () => {
      if (opened.hidden) return clear()
      if (isLoading(opened)) {
        frameRequest = requestAnimationFrame(draw)
        return
      }
      const timing = { duration: STREAM_MS, easing: STREAM_EASING }
      const frame = blankFrame.animate({
        width: [startWidth, `${opened.offsetWidth}px`],
        height: [startHeight, `${opened.offsetHeight}px`],
      }, timing)
      frame.onfinish = clear
      endDrawIn = undefined
      blankFrame.removeAttribute('aria-busy')
      opened.style.removeProperty('clip-path')
      reveal = [frame, opened.animate({ clipPath: [closed, open] }, timing)]
      // Content that waited for its data is already streaming in.
      reveal.push(...streamInParts(bodyParts(opened)))
    }
    frameRequest = requestAnimationFrame(draw)
  }

  async function finish(active: Swipe, commit: boolean): Promise<void> {
    settling = true
    swipe = undefined
    const { kind, card, moved, position, extent, radius } = active
    try {
      if (!commit) {
        moved.removeAttribute('data-armed')
        if (kind === 'retract') settle(card, { clipPath: `inset(0 0 0 0 round ${radius})` })
        if (kind === 'step') {
          active.incomingHeading.forEach((part) => settle(part, { transform: shift(-Math.sign(position) * HEADING_SHIFT_PX), opacity: 0 }))
          active.outgoingHeading.forEach((part) => settle(part, { transform: 'none', opacity: 1 }))
          const end = !active.peeked && Math.abs(position) >= FLICK_DISTANCE_PX && !reducedMotion.matches
          await Promise.all(active.outgoingBody.map((part) => (end ? wiggle(part, Math.sign(position)) : settle(part, { transform: 'none', opacity: 1 })).finished))
        } else await settle(moved, { transform: 'translate3d(0,0,0)' }).finished
      } else if (kind === 'step') {
        await (card === selectedCard ? commitSection(active) : commitStep(active))
      } else if (kind === 'close') {
        await settle(card, { transform: `translate3d(0,${position + 120}px,0)`, opacity: 0 }).finished
        card.querySelector<HTMLButtonElement>('[id$="-close"]')!.click()
      } else {
        settle(card, { clipPath: `inset(0 0 ${extent}px 0 round ${radius})` })
        await settle(objectBody, { transform: `translate3d(0,${-extent}px,0)`, opacity: 0 }).finished
        objectDetails.open = false
      }
    } finally {
      endStep(active)
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
    if (settling || !touchInput.matches || !(event.target instanceof Element) || event.target.closest('.swipe-hint')) return
    const card = event.target.closest<HTMLElement>('.object-type-card, .selected-object')
    if (!card) return
    // A quick next swipe does not wait for the previous card to finish arriving.
    endDrawIn?.()
    reveal.forEach((animation) => animation.finish())
    reveal = []
    const touch = event.touches[0]!
    swipe = {
      card, target: event.target, startX: touch.clientX, startY: touch.clientY, moved: card,
      position: 0, lastRaw: 0, lastTime: event.timeStamp, speed: 0, commitAt: COMMIT_DISTANCE_PX,
      armed: false, radius: '0', extent: 0, incomingWidth: 0, incomingHeading: [], outgoingHeading: [], outgoingBody: [],
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

  initializeSwipeHints()

  /**
   * The first time a touch visitor opens the selected object card, and then a detail card, the card opens
   * empty, blurs, and shows arrows naming its swipes. OK or a swipe down acknowledges them, and the content
   * then streams in as usual. A card that closes first shows its hint again next time.
   */
  function initializeSwipeHints(): void {
    const seen = new Set<string>()
    const hintSeen = (hint: SwipeHint) => {
      if (seen.has(hint.key)) return true
      try { return localStorage.getItem(`star-view-${hint.key}`) !== null } catch { return false }
    }
    if (hintSeen(OBJECT_HINT) && hintSeen(DETAIL_HINT)) return
    let shown: { card: HTMLElement; overlay: HTMLElement } | undefined
    const dismiss = () => {
      if (!shown) return
      shown.overlay.remove()
      shown.card.removeAttribute('data-swipe-hint')
      shown = undefined
    }
    // Observer callbacks run before the next paint, so the content never shows ahead of its hint.
    const observer = new MutationObserver((records) => {
      for (const { target } of records) {
        const card = target === objectDetails ? selectedCard : target as HTMLElement
        if (target === objectDetails ? objectDetails.open : !card.hidden) show(card, card === selectedCard ? OBJECT_HINT : DETAIL_HINT)
        else if (shown?.card === card) dismiss()
      }
    })
    observer.observe(objectDetails, { attributeFilter: ['open'] })
    for (const card of inspector.querySelectorAll('.dock-card.object-type-card:not(.card-swipe-frame)')) observer.observe(card, { attributeFilter: ['hidden'] })
    signal.addEventListener('abort', () => observer.disconnect(), { once: true })

    async function acknowledge(hint: SwipeHint): Promise<void> {
      if (!shown) return
      seen.add(hint.key)
      try { localStorage.setItem(`star-view-${hint.key}`, 'seen') } catch {}
      if (hintSeen(OBJECT_HINT) && hintSeen(DETAIL_HINT)) observer.disconnect()
      const { card, overlay } = shown
      overlay.inert = true
      const blurred = ([...card.children] as HTMLElement[]).filter((child) => child !== overlay)
      const timing = { duration: reducedMotion.matches ? 0 : HINT_FADE_MS, easing: EASING, fill: 'forwards' as const }
      const fades = [overlay.animate({ opacity: 0 }, timing), ...blurred.map((child) => child.animate({ filter: 'none' }, timing))]
      await Promise.all(fades.map((fade) => fade.finished))
      if (shown?.overlay !== overlay) return
      dismiss()
      fades.forEach((fade) => fade.cancel())
      if (!reducedMotion.matches) reveal.push(...streamInParts(card === selectedCard ? shownSection() : bodyParts(card)))
    }

    function show(card: HTMLElement, hint: SwipeHint): void {
      if (shown || !touchInput.matches || hintSeen(hint) || document.querySelector('.tutorial-tile')) return
      const overlay = document.createElement('div')
      overlay.className = 'swipe-hint'
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-label', 'Swipe gestures')
      for (const [gesture, line] of hint.lines) {
        for (const direction of gesture === 'sideways' ? ['left', 'right'] : [gesture]) {
          const arrow = Object.assign(document.createElement('span'), { className: 'swipe-hint-arrow' })
          arrow.dataset.direction = direction
          arrow.setAttribute('aria-hidden', 'true')
          arrow.append(document.createElement('i'))
          overlay.append(arrow)
        }
        const copy = Object.assign(document.createElement('p'), { textContent: line })
        copy.dataset.gesture = gesture
        overlay.append(copy)
      }
      const actions = Object.assign(document.createElement('div'), { className: 'browser-data-actions' })
      const ok = Object.assign(document.createElement('button'), { type: 'button', textContent: 'OK' })
      ok.addEventListener('click', () => { void acknowledge(hint) }, { signal })
      actions.append(ok)
      overlay.append(actions)

      // A swipe down fades the hint with the finger and, far enough, acknowledges it.
      let startY: number | undefined
      let pulled = 0
      const restore = () => {
        startY = undefined
        if (pulled) settle(overlay, { opacity: 1 }).finished.then(() => release(overlay), () => undefined)
        pulled = 0
      }
      overlay.addEventListener('touchstart', (event) => {
        startY = event.touches.length === 1 ? event.touches[0]!.clientY : undefined
      }, { passive: true, signal })
      overlay.addEventListener('touchmove', (event) => {
        if (startY === undefined) return
        pulled = Math.max(0, event.touches[0]!.clientY - startY)
        overlay.style.opacity = String(1 - Math.min(1, pulled / COMMIT_DISTANCE_PX) * 0.7)
      }, { passive: true, signal })
      overlay.addEventListener('touchend', () => {
        if (pulled >= COMMIT_DISTANCE_PX) void acknowledge(hint)
        else restore()
      }, { passive: true, signal })
      overlay.addEventListener('touchcancel', restore, { passive: true, signal })

      card.setAttribute('data-swipe-hint', '')
      card.append(overlay)
      shown = { card, overlay }
      ok.focus({ preventScroll: true })
    }
  }
}
