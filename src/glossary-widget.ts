import { svgNode } from './spectral-chart'

export { svgNode }
export type WidgetMount = (host: HTMLElement, signal: AbortSignal, variant?: string) => void

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
export const number = (value: number, digits = 3) => value.toLocaleString('en-US', { maximumSignificantDigits: digits })

/** The widget's drawing surface; text sizes assume this width and scale with the card. */
export function drawing(host: HTMLElement, height: number, label: string, width = 360): SVGSVGElement {
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label })
  host.append(svg)
  return svg
}

export const text = (content: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'start', className = 'gw-text') =>
  svgNode('text', { x, y, 'text-anchor': anchor, class: className }, content)

interface SliderOptions {
  label: string
  min: number
  max: number
  step?: number
  value: number
  format(value: number): string
  /** Slide along a logarithmic scale; min and max must be positive. */
  log?: boolean
  signal: AbortSignal
  onInput(value: number): void
}

export function slider(host: HTMLElement, options: SliderOptions): { value(): number; set(value: number): void } {
  const { min, max, log } = options
  const toValue = (position: number) => log ? min * (max / min) ** position : min + (max - min) * position
  const toPosition = (value: number) => log ? Math.log(value / min) / Math.log(max / min) : (value - min) / (max - min)
  const row = Object.assign(document.createElement('label'), { className: 'range-filter' })
  const heading = Object.assign(document.createElement('span'), { className: 'range-heading' })
  const output = document.createElement('output')
  heading.append(Object.assign(document.createElement('span'), { textContent: options.label }), output)
  const input = Object.assign(document.createElement('input'), { type: 'range', min: '0', max: '1', step: options.step === undefined ? '0.001' : String(options.step / (max - min)) })
  input.value = String(toPosition(options.value))
  row.append(heading, input)
  host.append(row)
  const value = () => toValue(Number(input.value))
  const show = () => {
    output.textContent = options.format(value())
    input.setAttribute('aria-valuetext', output.textContent)
  }
  show()
  input.addEventListener('input', () => { show(); options.onInput(value()) }, { signal: options.signal })
  return { value, set(next) { input.value = String(toPosition(next)); show() } }
}

/** Labelled results below a drawing; returns one setter per label. */
export function readouts(host: HTMLElement, labels: readonly string[]): ((value: string) => void)[] {
  const list = Object.assign(document.createElement('dl'), { className: 'glossary-widget-readouts' })
  host.append(list)
  return labels.map((label) => {
    const value = document.createElement('dd')
    const row = document.createElement('div')
    row.append(Object.assign(document.createElement('dt'), { textContent: label }), value)
    list.append(row)
    return (next: string) => { value.textContent = next }
  })
}

export function note(host: HTMLElement, content: string): HTMLElement {
  const element = Object.assign(document.createElement('p'), { className: 'glossary-widget-note', textContent: content })
  host.append(element)
  return element
}

export function choices<T extends string>(host: HTMLElement, label: string, options: readonly (readonly [value: T, title: string])[], selected: T, signal: AbortSignal, onSelect: (value: T) => void): void {
  const group = Object.assign(document.createElement('div'), { className: 'glossary-widget-choices' })
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', label)
  const sync = (value: T) => { for (const button of group.children) button.setAttribute('aria-pressed', String((button as HTMLElement).dataset.value === value)) }
  for (const [value, title] of options) {
    const button = Object.assign(document.createElement('button'), { type: 'button', textContent: title })
    button.dataset.value = value
    button.addEventListener('click', () => { sync(value); onSelect(value) }, { signal })
    group.append(button)
  }
  sync(selected)
  host.append(group)
}

/** A play button that advances until paused; nothing runs until it is pressed, and it stops when the widget or card goes away. */
export function player(host: HTMLElement, signal: AbortSignal, advance: (elapsedMs: number) => void): void {
  if (reducedMotion()) return
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'glossary-widget-play', textContent: 'Play' })
  let frame = 0
  let last = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    button.textContent = 'Play'
  }
  const tick = (now: number) => {
    if (signal.aborted || !button.checkVisibility()) return stop()
    advance(Math.min(100, now - last))
    last = now
    frame = requestAnimationFrame(tick)
  }
  button.addEventListener('click', () => {
    if (frame) return stop()
    button.textContent = 'Pause'
    last = performance.now()
    frame = requestAnimationFrame(tick)
  }, { signal })
  signal.addEventListener('abort', stop, { once: true })
  host.append(button)
}
