import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { writeManagedFiles } from '../scripts/filesystem'

const directories: string[] = []
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'star-view-managed-'))
  directories.push(path)
  return path
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true })
})

it('leaves unchanged outputs in place without creating staging directories', () => {
  const root = directory()
  const target = join(root, 'catalog.json')
  writeManagedFiles(root, { 'catalog.json': '{"stars":[]}' }, true)
  utimesSync(target, 1000, 1000)
  const before = statSync(target)
  writeManagedFiles(root, { 'catalog.json': '{"stars":[]}' }, true)
  const after = statSync(target)
  expect(after.ino).toBe(before.ino)
  expect(after.mtimeMs).toBe(before.mtimeMs)
  expect(after.ctimeMs).toBe(before.ctimeMs)
  expect(readdirSync(root)).toEqual(['catalog.json'])
})

it('publishes changed and new outputs while preserving unchanged files', () => {
  const root = directory()
  writeManagedFiles(root, { 'same.json': 'same', 'changed.json': 'old' }, true)
  const before = statSync(join(root, 'same.json'))
  writeManagedFiles(root, { 'same.json': 'same', 'changed.json': 'new', 'added.json': 'added' }, true)
  expect(statSync(join(root, 'same.json')).ino).toBe(before.ino)
  expect(readFileSync(join(root, 'changed.json'), 'utf8')).toBe('new')
  expect(readFileSync(join(root, 'added.json'), 'utf8')).toBe('added')
  expect(readdirSync(root).sort()).toEqual(['added.json', 'changed.json', 'same.json'])
})

it('still requires force for an existing file even if its content is identical', () => {
  const root = directory()
  writeManagedFiles(root, { 'catalog.json': 'same' }, false)
  expect(() => writeManagedFiles(root, { 'catalog.json': 'same' }, false)).toThrow('Output already exists')
})

it('validates paths and rejects symlinks before skipping identical content', () => {
  const root = directory()
  writeFileSync(join(root, 'source.json'), 'same')
  symlinkSync(join(root, 'source.json'), join(root, 'link.json'))
  expect(() => writeManagedFiles(root, { 'link.json': 'same' }, true)).toThrow('symbolic link')
  expect(() => writeManagedFiles(root, { '../escape.json': 'same' }, true)).toThrow('plain file name')
})
