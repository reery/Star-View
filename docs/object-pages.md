# Object pages and the sitemap

Every catalog and compact-remnant object has a page at `/objects/<id>`, named by its stable catalog ID. The app reads the path at startup and selects that object. An object outside the start catalog loads its catalog the way Explore top lists do. Afterwards the URL and the title follow the selection, without adding browser history entries. The start page stays at `/` until a visitor selects an object.

## Worker

`wrangler.jsonc` routes only `/objects/*` to `worker/index.ts`; all other requests stay static assets, which cost no Worker requests. For each page the Worker:

1. reads the object's entry from the object-page shards (their hashes are listed in `object-page-shards.json`),
2. fills `index.html` with the object's title, description, canonical URL and Open Graph tags (`renderObjectPage` in `src/object-page.ts`),
3. adds a screen-reader summary with the key facts, the Info introduction and links to the other system components. The app removes it when another object is selected.

Unknown IDs return the start page with status 404. A record that the map merges into another catalog's record of the same object (for example the constellation catalog's `hip-32349` into `sirius-a`) redirects with 301, so each object has one URL. Pages not listed in the sitemap, and every page on `*.workers.dev`, are sent with `X-Robots-Tag: noindex`. The Worker sets the security headers from `worker/security-headers.ts` itself, the same values that `vite.config.ts` writes to `_headers`.

## Page data

`npm run catalog:generate` writes `src/data/generated/object-pages.json`. Each object belongs to the smallest catalog that holds it, so that a link loads as little as possible. The description is the Info introduction when there is one. Otherwise it is a sentence built from the object's type, distance and spectral type. The build shards these entries like the other per-object payloads (see [deferred-star-data.md](deferred-star-data.md)) and marks the sitemap's objects `indexable`.

## Sitemap

`python3 scripts/author-sitemap.py` (`npm run catalog:sitemap`) writes `public/sitemap.xml`, and `catalog:validate` checks that it is current. Run it after `catalog:generate` whenever objects, articles or top lists change. An object is listed when its card offers more than catalog specs:

- an Info article,
- known planets,
- membership in the nearest neighbors or nearest 100,
- a curated catalog: Western constellation stars or notable distant stars,
- an entry in an Explore top list.

Change these rules in the script. The build adds `robots.txt`, which points to the sitemap. A sitemap holds at most 50,000 URLs; the script fails before that limit.
