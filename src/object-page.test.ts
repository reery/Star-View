import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { dataShards } from '../scripts/data-shards.ts'
import { DATA_SHARD_COUNTS, dataShardIndex, dataShardPath, OBJECT_PAGE_SHARDS_PATH, type DataShardSet } from './data-shards'
import worker from '../worker/index.ts'
import { objectIdFromPath, renderObjectPage, SITEMAP_OBJECT_URL, type ObjectPage, type ObjectPageAlias } from './object-page'

const generated = fileURLToPath(new URL('./data/generated', import.meta.url))
const sitemap = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url))
const pages = JSON.parse(readFileSync(new URL('./data/generated/object-pages.json', import.meta.url), 'utf8')) as Record<string, ObjectPage | ObjectPageAlias>

it('parses only object paths with catalog IDs', () => {
  expect(objectIdFromPath('/objects/sirius-a')).toBe('sirius-a')
  expect(objectIdFromPath('/objects/msc-04007+1229-ab/')).toBe('msc-04007+1229-ab')
  expect(objectIdFromPath('/objects/cns5-gj-426.1-b')).toBe('cns5-gj-426.1-b')
  expect(objectIdFromPath('/objects/msc-04007%2B1229-ab')).toBe('msc-04007+1229-ab')
  for (const path of ['/', '/objects/', '/objects/Sirius', '/objects/a/b', '/objects/%E0%A4%A', '/assets/objects/sirius-a']) {
    expect(objectIdFromPath(path)).toBeNull()
  }
})

it('renders the object head and an escaped summary into index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const page: ObjectPage = { ...pages['sirius-a'] as ObjectPage, name: 'Sirius <A>' }
  const rendered = renderObjectPage(html, 'sirius-a', page)
  expect(rendered).toContain('<title>Sirius &#60;A&#62; – Star View</title>')
  expect(rendered).toContain('<link rel="canonical" href="https://starview-app.com/objects/sirius-a" />')
  expect(rendered).toContain('<meta property="og:url" content="https://starview-app.com/objects/sirius-a" />')
  expect(rendered).toContain('<h1>Sirius &#60;A&#62;</h1>')
  expect(rendered).toContain('<a href="/objects/sirius-b">Sirius B</a>')
  expect(rendered.match(/<meta name="description" content="([^"]*)"/)?.[1]).toBe(page.description)
  expect(rendered.indexOf('<article id="object-summary"')).toBeGreaterThan(rendered.indexOf('<body>'))
})

it('lists only generated objects in the sitemap and marks exactly those indexable', () => {
  const listed = [...readFileSync(sitemap, 'utf8').matchAll(SITEMAP_OBJECT_URL)].map((match) => match[1]!)
  expect(listed.length).toBeGreaterThan(0)
  expect(listed.filter((id) => !pages[id] || 'canonical' in pages[id])).toEqual([])
  const shards = dataShards(generated, sitemap)['object-page'].map(({ content }) => JSON.parse(content) as Record<string, ObjectPage | ObjectPageAlias>)
  const indexable = shards.flatMap((shard) => Object.entries(shard).filter(([, page]) => 'indexable' in page).map(([id]) => id))
  expect(indexable.sort()).toEqual([...listed].sort())
})

it('places every key in the one shard the browser and Worker request', () => {
  const shards = dataShards(generated, sitemap)
  for (const [set, files] of Object.entries(shards) as [DataShardSet, { content: string }[]][]) {
    expect(files).toHaveLength(DATA_SHARD_COUNTS[set])
    files.forEach(({ content }, index) => {
      for (const key of Object.keys(JSON.parse(content))) expect(dataShardIndex(set, key)).toBe(index)
    })
  }
  expect(pages['hip-32349']).toEqual({ canonical: 'sirius-a' })
  expect(Object.keys(shards['object-page'].reduce((all, { content }) => ({ ...all, ...JSON.parse(content) }), {})).length).toBe(Object.keys(pages).length)
})

it('serves listed, unlisted, merged and unknown object pages from the Worker', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const shards = dataShards(generated, sitemap)['object-page']
  const files = new Map([['/', html], [`/${OBJECT_PAGE_SHARDS_PATH}`, JSON.stringify(shards.map(({ hash }) => hash))],
    ...shards.map(({ hash, content }, index) => [`/${dataShardPath('object-page', index, hash)}`, content] as const)])
  const env = { ASSETS: { fetch: async (input: Request | string) => {
    const body = files.get(new URL(input instanceof Request ? input.url : input).pathname)
    return new Response(body ?? 'Not found', { status: body === undefined ? 404 : 200 })
  } } }
  const get = (url: string) => worker.fetch(new Request(url), env)
  const listed = await get('https://starview-app.com/objects/sirius-a')
  expect(listed.status).toBe(200)
  expect(listed.headers.get('X-Robots-Tag')).toBeNull()
  expect(listed.headers.get('Strict-Transport-Security')).not.toBeNull()
  expect(await listed.text()).toContain('<title>Sirius A – Star View</title>')
  const unlisted = Object.entries(pages).find(([, page]) => 'catalog' in page && !page.introduction && !page.planets && page.catalog === 'nearest-5000')![0]
  expect((await get(`https://starview-app.com/objects/${unlisted}`)).headers.get('X-Robots-Tag')).toBe('noindex')
  const merged = await get('https://starview-app.com/objects/hip-32349')
  expect(merged.status).toBe(301)
  expect(merged.headers.get('Location')).toBe('https://starview-app.com/objects/sirius-a')
  const unknown = await get('https://starview-app.com/objects/not-an-object')
  expect(unknown.status).toBe(404)
  expect(unknown.headers.get('X-Robots-Tag')).toBe('noindex')
  expect(await unknown.text()).toBe(html)
  const probe = await get('https://starview-app.com/wp-admin/setup.php')
  expect(probe.status).toBe(404)
  expect(await probe.text()).toBe('Not found')
  expect((await get('https://star-view.example.workers.dev/objects/sirius-a')).headers.get('X-Robots-Tag')).toBe('noindex')
})
