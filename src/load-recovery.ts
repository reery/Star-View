export function createLoadError(label: string, retry: () => void): HTMLElement {
  const panel = document.createElement('span')
  panel.className = 'load-recovery'
  panel.setAttribute('role', 'alert')
  const message = document.createElement('span')
  message.textContent = `Could not load ${label}.`
  const hint = document.createElement('span')
  hint.textContent = 'Check your connection and retry, or reload the app to get the latest version.'
  const actions = document.createElement('span')
  actions.className = 'load-recovery-actions browser-data-actions'
  for (const [title, action] of [['Retry', retry], ['Reload app', () => window.location.reload()]] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = title
    button.addEventListener('click', action, { once: true })
    actions.append(button)
  }
  panel.append(message, hint, actions)
  return panel
}

interface LoadOptions {
  label: string
  retry(): void
  isCurrent?(): boolean
  onChange?(): void
  focusTarget?: HTMLElement
  keepContent?: boolean
}

const requests = new WeakMap<HTMLElement, object>()

export function clearLoadRecovery(target: HTMLElement): void {
  requests.delete(target)
  target.querySelector(':scope > .load-recovery')?.remove()
  if (target.classList.contains('load-state')) target.classList.remove('load-state')
  target.removeAttribute('aria-busy')
}

/** Keep static card markup intact, and ignore requests superseded or closed while loading. */
export async function loadWithRecovery<T>(
  target: HTMLElement,
  load: () => Promise<T>,
  options: LoadOptions,
): Promise<{ value: T } | undefined> {
  const request = {}
  requests.set(target, request)
  const isCurrent = () => requests.get(target) === request && target.isConnected
    && !target.closest('[hidden]') && (options.isCurrent?.() ?? true)
  if (!isCurrent()) return
  const previous = target.querySelector<HTMLElement>(':scope > .load-recovery')
  const restoreFocus = previous?.contains(document.activeElement) ?? false
  previous?.remove()
  let loading: HTMLElement | undefined
  const showLoading = () => {
    if (loading || !isCurrent()) return
    loading = document.createElement('p')
    loading.className = 'load-recovery'
    loading.setAttribute('role', 'status')
    loading.tabIndex = -1
    loading.textContent = `Loading ${options.label}…`
    if (!options.keepContent) target.classList.add('load-state')
    target.prepend(loading)
    if (restoreFocus) loading.focus({ preventScroll: true })
    options.onChange?.()
  }
  target.setAttribute('aria-busy', 'true')
  // Cached modules resolve before this timer, avoiding layout work on ordinary re-renders.
  const timer = window.setTimeout(showLoading, 150)
  if (restoreFocus) showLoading()
  try {
    const value = await load()
    if (!isCurrent()) return
    loading?.remove()
    target.classList.remove('load-state')
    if (restoreFocus) options.focusTarget?.focus({ preventScroll: true })
    return { value }
  } catch {
    if (!isCurrent()) return
    const error = createLoadError(options.label, options.retry)
    if (!options.keepContent) target.classList.add('load-state')
    if (loading) loading.replaceWith(error)
    else target.prepend(error)
    options.onChange?.()
    if (restoreFocus) error.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  } finally {
    window.clearTimeout(timer)
    if (requests.get(target) === request) {
      target.removeAttribute('aria-busy')
      if (loading) options.onChange?.()
    }
  }
}
