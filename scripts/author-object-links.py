"""Build the selected-object reading links from frozen, exact-identity sources.

Wikipedia articles come from Wikidata items carrying an object's exact SIMBAD
identifier (P3083). Jim Kaler's STARS pages and ESA/Hubble observations match
exact designations; ATNF links use the frozen PSRJ names. No positional or
fuzzy matching. Run --refresh to freeze the network sources, --check to compare
the checked-in links without writing them.
"""

import argparse
import hashlib
import html
import http.client
import json
import re
import runpy
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from catalog_sources.filesystem import write_managed_files

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/object-links"
OUTPUT = ROOT / "src/data/object-links.json"
CACHE = None
USER_AGENT = "StarView-catalog/0.7 (https://starview-app.com)"
WIKIDATA = "https://query.wikidata.org/sparql"
WIKIPEDIA = "https://en.wikipedia.org/w/api.php"
KALER = "http://stars.astro.illinois.edu/sow/"
ESA_HUBBLE = "https://esahubble.org/images/"
ESA_CATEGORIES = ["stars", "nebulae"]
# Reviewed Kaler leads that misspell the designation, list several stars or open with
# another parenthesis; each names the exact catalog designation the page is about.
KALER_DESIGNATIONS = {
    "alnasl": "Gamma2 Sagittarii", "alya": "Theta1 Serpentis", "epseri": "Epsilon Eridani",
    "fomalhaut": "Alpha Piscis Austrini", "nunki": "Sigma Sagittarii", "omegaeri": "Omega Eridani",
    "sadalbari": "Mu Pegasi", "suhail": "Lambda Velorum",
}
DESIGNATIONS = runpy.run_path(str(ROOT / "scripts/author-object-designations.py"))
CONSTELLATIONS = {name.casefold(): abbreviation for abbreviation, genitive in DESIGNATIONS["GENITIVES"].items() for name in [genitive, abbreviation]}
GREEK = {name.casefold(): abbreviation for abbreviation, name in DESIGNATIONS["GREEK"].items()}
# Wikidata classes for a gravitationally bound system, the only accepted P361 parents:
# binary, double, multiple and spectroscopic binary stars and triple systems. Moving groups,
# clusters, asterisms, optical doubles and generic triads or heptads (the Big Dipper) are excluded.
STAR_SYSTEM_CLASSES = {"Q50053", "Q13890", "Q878367", "Q1993624", "Q2088753"}


def collapse(value):
    return " ".join(value.split())


def key(value):
    # Designation spellings differ only in spacing, punctuation, padding zeros and SIMBAD prefixes.
    # Case is significant: 'Fomalhaut b' is a planet, 'Fomalhaut B' a star; 'a Car' is not 'A Car'.
    value = re.sub(r"^(?:NAME|V\*|\*\*|\*)\s+", "", collapse(value))
    return re.sub(r"(?<=[A-Za-z])0+(?=\d)", "", re.sub(r"[\s.\-]+", "", value))


def component_parent(identifier):
    """The enclosing system of an explicit component identifier, e.g. '* 61 Cyg A'."""
    match = re.fullmatch(r"(.*\S)\s(?:[A-H][a-h]?|[A-H]{2})|(.*\d)(?:[A-H][a-h]?|[A-H]{2})", collapse(identifier))
    parent = match and (match[1] or match[2])
    return parent if parent and re.search(r"\s", parent) else None


def request(url, data=None, accept=None):
    payload = urllib.parse.urlencode(data).encode() if data else None
    # An optional response cache lets an interrupted refresh resume without refetching.
    cached = CACHE and CACHE / hashlib.sha256(url.encode() + (payload or b"")).hexdigest()
    if cached and cached.exists():
        return cached.read_text()
    context = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    headers = {"User-Agent": USER_AGENT, **({"Accept": accept} if accept else {})}
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=payload, headers=headers), context=context, timeout=120) as response:
                result = response.read().decode("utf-8", errors="replace")
            break
        except (OSError, http.client.HTTPException) as error:
            # Retry only transient failures; a missing page stays missing.
            if attempt == 4 or isinstance(error, urllib.error.HTTPError) and error.code not in {429, 500, 502, 503, 504}:
                raise
            time.sleep(5 * (attempt + 1))
    if cached:
        cached.write_text(result)
    return result


def identities():
    return json.loads((ROOT / "src/data/object-designations.json").read_text())["objects"]


def refresh_wikidata():
    names = set()
    for entry in identities().values():
        if entry.get("simbadId"):
            names.add(collapse(entry["simbadId"]))
            parent = component_parent(entry["simbadId"])
            if parent:
                names.add(parent)
    names = sorted(names)
    rows = []
    for start in range(0, len(names), 250):
        values = " ".join(json.dumps(name) for name in names[start:start + 250])
        query = (
            "SELECT ?sim ?item ?article ?badge ?parent ?parentClass ?parentArticle WHERE { "
            f"VALUES ?sim {{ {values} }} ?item wdt:P3083 ?sim . "
            "OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . OPTIONAL { ?article wikibase:badge ?badge } } "
            "OPTIONAL { ?item wdt:P361 ?parent . ?parent wdt:P31 ?parentClass . "
            "OPTIONAL { ?parentArticle schema:about ?parent ; schema:isPartOf <https://en.wikipedia.org/> } } }")
        result = json.loads(request(WIKIDATA, {"query": query}, "application/sparql-results+json"))
        for binding in result["results"]["bindings"]:
            row = {field: value["value"].rsplit("/", 1)[-1] if field in {"item", "badge", "parent", "parentClass"} else value["value"]
                   for field, value in binding.items()}
            for field in ["article", "parentArticle"]:
                if field in row:
                    row[field] = urllib.parse.unquote(row[field].removeprefix("https://en.wikipedia.org/wiki/")).replace("_", " ")
            rows.append(row)
        print(f"Wikidata: {min(start + 250, len(names))}/{len(names)} identifiers", flush=True)
        time.sleep(1)
    rows.sort(key=lambda row: json.dumps(row, sort_keys=True))
    return rows


def refresh_wikipedia(titles):
    pages = {}
    titles = sorted(titles)
    for start in range(0, len(titles), 50):
        batch = titles[start:start + 50]
        result = json.loads(request(WIKIPEDIA + "?" + urllib.parse.urlencode({
            "action": "query", "format": "json", "formatversion": "2", "redirects": "1",
            "prop": "pageprops", "ppprop": "disambiguation", "titles": "|".join(batch)})))["query"]
        normalized = {entry["from"]: entry["to"] for entry in result.get("normalized", [])}
        redirects = {entry["from"]: entry for entry in result.get("redirects", [])}
        found = {page["title"]: page for page in result["pages"]}
        for title in batch:
            name = normalized.get(title, title)
            redirect = redirects.get(name)
            target = redirect["to"] if redirect else name
            page = found.get(target, {})
            pages[title] = {"target": target, **({"fragment": redirect["tofragment"]} if redirect and redirect.get("tofragment") else {}),
                            **({"missing": True} if page.get("missing") or page.get("invalid") else {}),
                            **({"disambiguation": True} if "disambiguation" in page.get("pageprops", {}) else {})}
        print(f"Wikipedia: {min(start + 50, len(titles))}/{len(titles)} titles", flush=True)
        time.sleep(0.5)
    return pages


def text(fragment):
    return collapse(html.unescape(re.sub(r"<[^>]+>", " ", fragment)))


def refresh_kaler():
    index = request(KALER + "sowlist.html")
    pages = []
    for table in re.split(r"<h3 align=center>STARS:", index)[1:]:
        pages += re.findall(r'href="([^"#/]+)\.html"', table.split("</table>")[0])
    records = []
    for number, page in enumerate(sorted(set(pages)), 1):
        try:
            source = request(f"{KALER}{page}.html")
        except urllib.error.HTTPError as error:
            # The index still lists a few removed pages; never link them.
            if error.code != 404:
                raise
            continue
        title = text(re.search(r"<title>(.*?)</title>", source, re.S | re.I)[1])
        body = source[source.lower().find("<body"):]
        # The lead names the star and its designation, e.g. "SIRIUS (Alpha Canis Majoris)."
        records.append({"page": page, "title": title, "lead": text(body[body.find(">") + 1:])[:240]})
        if number % 100 == 0:
            print(f"Kaler: {number}/{len(set(pages))} pages", flush=True)
        time.sleep(0.3)
    return records


def refresh_esa_hubble():
    identifiers = set()
    for category in ESA_CATEGORIES:
        for number in range(1, 100):
            listing = request(f"{ESA_HUBBLE}archive/category/{category}/page/{number}/")
            found = re.findall(r"id: '([a-z0-9-]+)'", listing)
            identifiers.update(found)
            if f"/page/{number + 1}/" not in listing:
                break
    records = []
    for number, identifier in enumerate(sorted(identifiers), 1):
        source = request(f"{ESA_HUBBLE}{identifier}/")
        rows = defaultdict(list)
        for label, value in re.findall(r'scope="row">([^<]+):</th>\s*<td>(.*?)</td>', source, re.S):
            rows[label].append(value)
        name_cell = rows["Name"][0] if rows["Name"] else ""
        records.append({
            "id": identifier,
            "title": text(re.search(r"<h1[^>]*>(.*?)</h1>", source, re.S)[1]),
            "imageType": text(rows["Type"][0]) if rows["Type"] else "",
            "names": [text(name) for name in re.split(r",(?![^<]*</a>)", name_cell) if text(name)],
            "simbad": sorted({collapse(urllib.parse.unquote_plus(value)) for value in re.findall(r"sim-id\?Ident=([^\"&]+)", name_cell)}),
        })
        if number % 100 == 0:
            print(f"ESA/Hubble: {number}/{len(identifiers)} images", flush=True)
        time.sleep(0.3)
    return records


def refresh(retrieved):
    wikidata = refresh_wikidata()
    titles = {row[field] for row in wikidata for field in ["article", "parentArticle"] if field in row}
    files = {
        "wikidata.json": json.dumps(wikidata, indent=1, ensure_ascii=False) + "\n",
        "wikipedia-pages.json": json.dumps(refresh_wikipedia(titles), indent=1, ensure_ascii=False, sort_keys=True) + "\n",
        "kaler-pages.json": json.dumps(refresh_kaler(), indent=1, ensure_ascii=False) + "\n",
        "esa-hubble-images.json": json.dumps(refresh_esa_hubble(), indent=1, ensure_ascii=False) + "\n",
    }
    manifest = {"retrieved": retrieved, "sources": {"wikidata": WIKIDATA, "wikipedia": WIKIPEDIA, "kaler": KALER, "esaHubble": ESA_HUBBLE},
                "checksumsSha256": {name: hashlib.sha256(content.encode()).hexdigest() for name, content in files.items()}}
    files["source-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
    # Publish only after every request succeeded, so a failure never leaves a mixed snapshot.
    write_managed_files(WORK, files, force=True)


def abbreviated(designation):
    """'Alpha-2 Capricorni' or 'Alpha-2 Cap' -> 'alf2 Cap'; Flamsteed and Latin-letter prefixes stay as written."""
    for name, abbreviation in sorted(CONSTELLATIONS.items(), key=lambda item: -len(item[0])):
        if designation.casefold().endswith(" " + name):
            prefix = designation[:-len(name) - 1].strip()
            greek = re.fullmatch(r"([A-Za-z]+)[-\s]?(\d*)", prefix)
            if greek and greek[1].casefold() in GREEK:
                prefix = GREEK[greek[1].casefold()] + greek[2]
            return f"{prefix} {abbreviation}"
    return designation


def checked_sources():
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    for name, expected in manifest["checksumsSha256"].items():
        if hashlib.sha256((WORK / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Source checksum mismatch: {name}")
    return manifest, {name: json.loads((WORK / name).read_text()) for name in manifest["checksumsSha256"]}


def unique(values):
    return next(iter(values)) if len(values) == 1 else None


def build():
    manifest, sources = checked_sources()
    objects = identities()
    systems = json.loads((ROOT / "src/data/star-systems.json").read_text())["systems"]
    pages = sources["wikipedia-pages.json"]
    review = {"ambiguous": [], "rejected": [], "kalerUnmatched": []}

    def article(title):
        page = pages[title]
        target = page["target"]
        # Redirects into lists or missing/disambiguation pages are not the object's article.
        if page.get("missing") or page.get("disambiguation") or target.startswith("List of "):
            review["rejected"].append({"title": title, **page})
            return None
        return target + (f"#{page['fragment']}" if page.get("fragment") else "")

    own, parents = defaultdict(set), defaultdict(set)
    for row in sources["wikidata.json"]:
        if "article" in row and (found := article(row["article"])):
            own[row["sim"]].add(found)
        if row.get("parentClass") in STAR_SYSTEM_CLASSES and "parentArticle" in row and (found := article(row["parentArticle"])):
            parents[row["sim"]].add(found)

    links = defaultdict(dict)
    system_articles = {}
    for identifier, entry in objects.items():
        if not entry.get("simbadId"):
            continue
        simbad = collapse(entry["simbadId"])
        parent = component_parent(simbad)
        system = parents[simbad] or (own[parent] or parents[parent] if parent else set())
        for candidates in [own[simbad], system]:
            if len(candidates) > 1:
                review["ambiguous"].append({"id": identifier, "simbad": simbad, "articles": sorted(candidates)})
        if unique(own[simbad]):
            links[identifier]["wikipedia"] = unique(own[simbad])
        if unique(system):
            system_articles[identifier] = unique(system)

    # Kaler's pages each describe a naked-eye star system, named by its Bayer or Flamsteed designation.
    by_key = defaultdict(set)
    for identifier, entry in objects.items():
        for value in [entry["name"], *entry["designations"], *([entry["simbadId"]] if entry.get("simbadId") else [])]:
            by_key[key(value)].add(identifier)
            if (parent := component_parent(value)):
                by_key["system:" + key(parent)].add(identifier)
    kaler = {}
    for page in sources["kaler-pages.json"]:
        lead = re.match(r"[^()]{1,80}\(([^()]+)\)", page["lead"])
        designations = [KALER_DESIGNATIONS[page["page"]]] if page["page"] in KALER_DESIGNATIONS else re.split(r",?\s+or\s+|=", lead[1]) if lead else []
        forms = {form for designation in designations for form in [key(designation), key(abbreviated(designation.strip()))]}
        matches = set().union(*(by_key[form] for form in forms)) or set().union(*(by_key["system:" + form] for form in forms))
        if not matches:
            review["kalerUnmatched"].append(page["page"])
        for identifier in matches:
            kaler.setdefault(identifier, set()).add(page["page"])
    titles = {page["page"]: page["title"] for page in sources["kaler-pages.json"]}
    for identifier, found in kaler.items():
        if len(found) > 1:
            review["ambiguous"].append({"id": identifier, "kaler": sorted(found)})
        else:
            links[identifier]["kaler"] = {"page": unique(found), "title": titles[unique(found)]}

    for identifier, title in system_articles.items():
        links[identifier].setdefault("wikipedia", title)
    # Reviewed systems share system-level links with components that have none of their own.
    for system in systems:
        members = [component["starId"] for component in system["components"]]
        for field, shared in [("wikipedia", {system_articles[member] for member in members if member in system_articles}),
                              ("kaler", {json.dumps(links[member]["kaler"]) for member in members if "kaler" in links[member]})]:
            if len(shared) == 1:
                value = unique(shared) if field == "wikipedia" else json.loads(unique(shared))
                for member in members:
                    links[member].setdefault(field, value)

    atnf = re.findall(r"^PSRJ\s+(\S+)", (ROOT / "catalog-work/compact-remnants/atnf-subset.db").read_text(), re.M)
    pulsars = {row["id"] for row in json.loads((ROOT / "src/data/overlays/compact-remnants/objects.json").read_text())["objects"] if row["type"] == "pulsar"}
    for psrj in atnf:
        identifier = f"psr-{psrj.lower().replace('+', 'p').replace('-', 'm')}"
        if identifier in pulsars:
            links[identifier]["atnf"] = psrj

    # Hubble observations name their targets; artwork and ground-based context images are never linked.
    candidates = defaultdict(list)
    for image in sources["esa-hubble-images.json"]:
        if image["imageType"] == "Observation" and "ground-based" not in image["title"].casefold():
            for identifier in set().union(*(by_key[key(name)] for name in [*image["names"], *image["simbad"]])):
                candidates[identifier].append(image)
    rank = {"heic": 0, "opo": 1, "potw": 2}
    for identifier, images in candidates.items():
        entry = objects[identifier]
        titled = {key(value) for value in [entry["name"], *entry["designations"]]}
        # Prefer an image titled after the object, then a release's main image, then press releases.
        best = min(images, key=lambda image: (
            not any(form in key(image["title"]) for form in titled), not image["id"].endswith("a"),
            rank.get(re.match(r"[a-z]+", image["id"])[0], 3), len(image["names"]), image["id"]))
        links[identifier]["esaHubble"] = {"image": best["id"], "title": best["title"]}

    entries = {identifier: {field: links[identifier][field] for field in ["wikipedia", "kaler", "atnf", "esaHubble"] if links[identifier].get(field)}
               for identifier in sorted(links)}
    return {"schemaVersion": 1, "retrieved": manifest["retrieved"],
            "objects": {identifier: entry for identifier, entry in entries.items() if entry}}, review


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Freeze the network sources before building")
    parser.add_argument("--retrieved", help="Explicit ISO date recorded with --refresh")
    parser.add_argument("--cache", type=Path, help="Response cache directory for resumable refreshes")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--review", action="store_true", help="Print rejected, ambiguous and unmatched sources")
    args = parser.parse_args()
    if args.refresh:
        if not args.retrieved:
            parser.error("--refresh requires --retrieved")
        if args.cache:
            CACHE = args.cache
            CACHE.mkdir(parents=True, exist_ok=True)
        refresh(args.retrieved)
    payload, review = build()
    # One object per line keeps the shipped file compact and its diffs readable.
    content = "{\n" + ",\n".join([f'"schemaVersion":{payload["schemaVersion"]}', f'"retrieved":"{payload["retrieved"]}"', '"objects":{\n' + ",\n".join(
        f"{json.dumps(identifier)}:{json.dumps(entry, ensure_ascii=False, separators=(',', ':'))}" for identifier, entry in payload["objects"].items()) + "\n}"]) + "\n}\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit("Object links differ; regenerate with scripts/author-object-links.py after reviewing inputs.")
    else:
        OUTPUT.write_text(content)
    if args.review:
        print(json.dumps(review, indent=1, ensure_ascii=False))
    entries = payload["objects"].values()
    print(f"{len(payload['objects'])} objects with links; " + ", ".join(
        f"{sum(field in entry for entry in entries)} {field}" for field in ["wikipedia", "kaler", "atnf", "esaHubble"]))
