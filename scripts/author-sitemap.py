"""Write public/sitemap.xml with the object pages worth indexing.

Every object has a page at /objects/<id>, but an object's card only earns a
search listing when it offers more than catalog specs: an Info article, known
planets, a place among the nearest 100 objects, a curated catalog (bright
constellation stars, notable distant stars) or a Discover top list. The
build marks every other page noindex. Reads the output of
`npm run catalog:generate`.

  --check  compare the checked-in sitemap without writing it
"""

import argparse
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/sitemap.xml"
GENERATED = ROOT / "src/data/generated"
ORIGIN = "https://starview-app.com"
CURATED_CATALOGS = ["nearest-neighbors", "nearest-100", "western-constellation-stars", "notable-distant-stars"]
# A sitemap file holds at most 50,000 URLs; split into a sitemap index before reaching it.
URL_LIMIT = 50000


def catalog_ids(name):
    return {star["id"] for star in json.loads((GENERATED / f"catalogs/{name}.json").read_text())["stars"]}


def top_list_ids():
    lists = json.loads((ROOT / "src/data/top-lists.json").read_text())["lists"]
    return {entry["object"]["id"] for top_list in lists for entry in top_list["entries"] if entry.get("object")}


def listed_ids():
    pages = json.loads((GENERATED / "object-pages.json").read_text())
    curated = set().union(*(catalog_ids(name) for name in CURATED_CATALOGS), top_list_ids())
    return sorted(
        page_id for page_id, page in pages.items()
        # Records the map merges into another catalog's record redirect to that page.
        if "canonical" not in page and ("introduction" in page or page.get("planets") or page_id in curated)
    )


def sitemap(ids):
    urls = [f"{ORIGIN}/"] + [f"{ORIGIN}/objects/{page_id}" for page_id in ids]
    if len(urls) > URL_LIMIT:
        sys.exit(f"{len(urls)} URLs exceed the sitemap limit of {URL_LIMIT}.")
    lines = [f"  <url><loc>{escape(url)}</loc></url>" for url in urls]
    return "\n".join(['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', *lines, "</urlset>"]) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    ids = listed_ids()
    content = sitemap(ids)
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            sys.exit(f"{OUTPUT.relative_to(ROOT)} is stale. Run `python3 scripts/author-sitemap.py`.")
        return
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(content)
    print(f"Wrote {len(ids)} object pages to {OUTPUT.relative_to(ROOT)}.")


if __name__ == "__main__":
    main()
