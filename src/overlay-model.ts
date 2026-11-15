// Checks the overlay manifests and payloads share.

export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
export const finitePositive = (value: unknown): value is number => finite(value) && value > 0

export function strings(value: unknown, minimum = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimum && value.every((entry) => typeof entry === 'string' && entry.length > 0)
}

/** Parses the fields every overlay manifest carries; `types` are the object types its counts cover. */
export function parseOverlayManifest<Manifest>(raw: string, id: string, name: string, types: readonly string[]): Manifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error(`${name} manifest must be an object.`)
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1 || manifest.id !== id) throw new Error(`Invalid ${name.toLowerCase()} manifest.`)
  const counts = manifest.counts as Record<string, unknown> | null
  if (!finite(manifest.epoch) || !Number.isInteger(manifest.objectCount)
    || !counts || typeof counts !== 'object' || !types.every((type) => Number.isInteger(counts[type]))) {
    throw new Error(`Invalid ${name.toLowerCase()} manifest counts.`)
  }
  return manifest as Manifest
}
