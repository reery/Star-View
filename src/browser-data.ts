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
