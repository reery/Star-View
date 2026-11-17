import { readdirSync, readFileSync } from 'node:fs'
import { ShaderChunk } from 'three'
import { expect, it } from 'vitest'

// Shaders are patched by replacing a line of their source. A plain `.replace` with a string changes only the
// first match, so a second path through the same shader silently keeps the unpatched line: the sky's
// visible-light branch once skipped the dust pass's display capture this way and rendered far too dark.
// With `.replaceAll` every match is patched, and a needle that should have matched once fails loudly at compile.
const sourceDirectory = new URL('./', import.meta.url)
const sources = readdirSync(sourceDirectory)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => ({ name, text: readFileSync(new URL(name, sourceDirectory), 'utf8') }))
const replacement = /\.(replace|replaceAll)\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g
const shaderNeedle = /#include\s*<|\bgl_\w+|\bvoid main\b/
const patches = sources.flatMap(({ name, text }) => [...text.matchAll(replacement)]
  .filter((match) => shaderNeedle.test(match[3]!))
  .map((match) => ({ at: `${name}:${text.slice(0, match.index).split('\n').length}`, method: match[1]!, needle: match[3]! })))

it('finds the shader patches it guards', () => {
  expect(patches.length).toBeGreaterThan(0)
})

it('patches every occurrence of a shader line', () => {
  expect(patches.filter((patch) => patch.method === 'replace').map((patch) => `${patch.at} ${patch.needle}`)).toEqual([])
})

it('patches only shader chunks three still has', () => {
  const missing = patches.flatMap((patch) => [...patch.needle.matchAll(/#include\s*<(\w+)>/g)]
    .filter(([, chunk]) => !(chunk! in ShaderChunk)).map(([include]) => `${patch.at} ${include}`))
  expect(missing).toEqual([])
})
