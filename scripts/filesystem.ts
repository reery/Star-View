import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

function isOutside(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
}

export function containedInput(recipePath: string, relativePath: string): string {
  if (isAbsolute(relativePath)) throw new Error('candidatesCsv must be relative to the adopted input file.')
  const root = realpathSync(dirname(recipePath))
  const lexical = resolve(root, relativePath)
  if (isOutside(root, lexical)) throw new Error('candidatesCsv must stay inside the adopted input directory.')
  if (lstatSync(lexical).isSymbolicLink()) throw new Error('candidatesCsv must not be a symbolic link.')
  const candidate = realpathSync(lexical)
  if (isOutside(root, candidate)) throw new Error('candidatesCsv must stay inside the adopted input directory.')
  return candidate
}

export function safeOutputDirectory(path: string): string {
  const absolute = resolve(path)
  if (lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error('Output directory must not be a symbolic link.')
  }
  mkdirSync(absolute, { recursive: true })
  return realpathSync(absolute)
}

export function writeManagedFiles(outputPath: string, files: Readonly<Record<string, string>>, force: boolean): void {
  const output = safeOutputDirectory(outputPath)
  for (const name of Object.keys(files)) {
    const target = join(output, name)
    if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Managed output must not be a symbolic link: ${name}`)
    if (existsSync(target) && !force) throw new Error('Output already exists; choose a new directory or explicitly pass --force.')
  }
  const staging = mkdtempSync(join(output, '.catalog-staging-'))
  const backup = mkdtempSync(join(output, '.catalog-backup-'))
  const installed: string[] = []
  const backedUp: string[] = []
  let preserveBackup = false
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(staging, name), content, { flag: 'wx' })
    for (const [name, content] of Object.entries(files)) {
      if (readFileSync(join(staging, name), 'utf8') !== content) throw new Error(`Failed to verify staged output: ${name}`)
    }
    try {
      for (const name of Object.keys(files)) {
        const target = join(output, name)
        if (existsSync(target)) {
          renameSync(target, join(backup, name))
          backedUp.push(name)
        }
      }
      for (const name of Object.keys(files)) {
        renameSync(join(staging, name), join(output, name))
        installed.push(name)
      }
    } catch (error) {
      for (const name of installed) rmSync(join(output, name), { force: true })
      try {
        for (const name of backedUp) renameSync(join(backup, name), join(output, name))
      } catch (restoreError) {
        preserveBackup = true
        throw new AggregateError([error, restoreError], `Failed to publish and restore catalog package; backup preserved at ${backup}`)
      }
      throw error
    }
  } finally {
    rmSync(staging, { recursive: true, force: true })
    if (!preserveBackup) rmSync(backup, { recursive: true, force: true })
  }
}