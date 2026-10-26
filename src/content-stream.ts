const mask = { maskImage: 'linear-gradient(#000 40%, transparent 60%)', maskSize: '100% 250%', maskRepeat: 'no-repeat' }
const STREAM_KEYFRAMES: Keyframe[] = [{ ...mask, maskPosition: '0 100%' }, { ...mask, maskPosition: '0 0' }]
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const waits = new WeakMap<HTMLElement, { stream: Animation; start: CSSNumberish | null }>()

/**
 * Keep content masked while its data loads, then stream it in top to bottom.
 * Data that arrives before the next frame shows at once; the latest load on a target decides when it streams.
 */
export function streamWhenLoaded<T>(target: HTMLElement, loading: Promise<T>): Promise<T> {
  if (reducedMotion.matches) return loading
  const previous = waits.get(target)
  const wait = previous ? { ...previous } : { stream: target.animate(STREAM_KEYFRAMES, { duration: 220, easing: 'ease-in-out' }), start: document.timeline.currentTime }
  wait.stream.pause()
  waits.set(target, wait)
  return loading.finally(() => {
    if (waits.get(target) !== wait) return
    waits.delete(target)
    if (document.timeline.currentTime === wait.start) wait.stream.cancel()
    else wait.stream.play()
  })
}
