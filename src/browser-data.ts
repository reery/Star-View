function browserDataEntries(): { storage: Storage; key: string; bytes: number }[] {
  return [localStorage, sessionStorage].flatMap((storage) => {
    const entries = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith('star-view-')) continue
      const value = storage.getItem(key) ?? ''
      // Web Storage keeps keys and values as UTF-16 strings (two bytes per code unit).
      entries.push({ storage, key, bytes: (key.length + value.length) * 2 })
    }
    return entries
  })
}

export function browserDataSize(): string {
  const bytes = browserDataEntries().reduce((sum, entry) => sum + entry.bytes, 0)
  return `${(bytes / 1024).toFixed(2)} KB`
}

export function deleteBrowserData(): void {
  for (const { storage, key } of browserDataEntries()) storage.removeItem(key)
}

/** Every Star View storage entry as gzip-compressed JSON. */
export function exportBrowserData(): Promise<Blob> {
  const data = Object.fromEntries(Object.entries({ localStorage, sessionStorage }).map(([name, storage]) => [name, Object.fromEntries(
    browserDataEntries().filter((entry) => entry.storage === storage).map(({ key }) => [key, storage.getItem(key) ?? '']),
  )]))
  const json = new Blob([JSON.stringify({ app: 'star-view', version: 1, ...data })]).stream()
  return new Response(json.pipeThrough(new CompressionStream('gzip'))).blob()
}

/** Replaces all Star View storage entries with those of an exported file (gzip-compressed or plain JSON). */
export async function importBrowserData(file: Blob): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const stream = new Blob([bytes]).stream()
  const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? stream.pipeThrough(new DecompressionStream('gzip')) : stream
  const data: unknown = await new Response(json).json()
  if (typeof data !== 'object' || data === null || (data as { app?: unknown }).app !== 'star-view') throw new Error('Not a Star View data file')
  const entries = Object.entries({ localStorage, sessionStorage }).flatMap(([name, storage]) => {
    const values: unknown = (data as Record<string, unknown>)[name] ?? {}
    if (typeof values !== 'object' || values === null) throw new Error(`Invalid ${name} data`)
    return Object.entries(values).map(([key, value]) => {
      if (!key.startsWith('star-view-') || typeof value !== 'string') throw new Error(`Invalid entry ${key}`)
      return { storage, key, value }
    })
  })
  deleteBrowserData()
  for (const { storage, key, value } of entries) storage.setItem(key, value)
}
