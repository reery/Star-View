# Writing Info articles

Read this before adding or editing Info text for a star, system or other object (`src/data/star-info.json`, `nearest-100-info.json`, `constellation-star-info.json`). The Info tab is where a reader learns why an object is worth their attention. Write for a curious reader without astronomy training.

## What an article must do

1. **Lead with what makes the object special.** The introduction says what the object is, how far away it is, in which constellation, and the single most remarkable fact: the coldest known brown dwarf, the closest system found since 1916, the brightest red dwarf in the northern sky. Do not bury the best fact in the last section.
2. **Give a few important details.** Use concrete numbers that a reader can picture: “a quarter of a degree in a human lifetime, about half the full Moon”, “ten times as bright as the full Moon if it replaced the Sun”, “less than a tenth of Mercury’s distance”. Choose numbers that tell a story; the Specs tab already lists the measurements.
3. **Tell the stories.** Discovery, famous mistakes, cultural history, records, future encounters, missions, appearances in fiction: these are what make a reader want to keep going.
4. **Scale the length to the material.** There is no fixed number of sections or words. A well-studied system such as Alpha Centauri or Sirius can have five or six sections; a star with little known about it gets an introduction and one or two short sections. Never add a section only to fill space.

## Structure

- `introduction` starts with a lowercase verb, because the name is rendered in front of it: `"is the brightest star in Earth’s night sky…"`. Two or three sentences.
- Each section has a short title that works as a hook (“The sky’s fastest-moving star”, “Planets that were not there”, “A red Sirius?”). Avoid generic titles such as “Activity matters”, “Rotation and companions” or “Discovery and motion”.
- One section covers one theme, usually 40–90 words in a single paragraph. Order the sections from the most striking to the least.
- Multiple systems share one article. Key it by the reviewed system ID from `stellar-system-identities.json`, not by a component ID, so that A, B and every other component show the same Info. Name the components clearly (A, B, C) and explain how they relate to each other.
- If the same single star appears in another catalog under a different ID, add that exact ID to the article’s `aliases` list instead of writing a second article. Link only by an exact shared identifier, such as a HIP number, never by name or position.

## Sources

- Every fact must be supported by the section’s source. A section without its own `source` falls back to the article’s Wikipedia page, so facts from any other page need an explicit section `source`. Each section has exactly one source, so group facts by source when planning sections.
- Use Wikipedia for established background. Link papers, NASA, ESA or ESO directly for recent or contested findings.
- Comparisons derived from catalog values (for example “only Sirius A and Alpha Centauri A give off more light within 11 light-years”) are fine when they hold in the shipped catalogs.
- Verify every number before writing it. When sources disagree, prefer the primary source or use a rounded value that covers both.
- Use absolute dates (“in 2025”, “September 2026”), never “recently”.

## Do not write

- **Stock absence lines** such as “No confirmed planets are reported in the sources reviewed for this article.” Leave out what is not known. Mention an absence only when it is a story in itself, such as a famous planet claim that was refuted.
- **Process or editorial language:** “in the sources reviewed”, “should be described as”, “should not be treated as”, “these are projections, not a fixed timetable”. Write about the object, not about how the article was written.
- **Stacked caveats.** Qualify an uncertain claim once, in plain words (“still a candidate”, “disputed”, “unconfirmed”), and move on. Do not repeat general method caveats such as “Doppler measurements give minimum masses” in every article.
- **Redundant judgements** such as “small for its class” (see `AGENTS.md`).
- **Speculation without a source**, such as “Could planets fit here?” sections.

## Style

- Plain, vivid English. Short sentences. Active voice.
- Typography: curly apostrophes and quotes (’ “ ”), en dashes for ranges (3–4), the minus sign for negative values (−1.46), °C and K with a space.
- Use the object names that appear in the catalog, and mention other common designations once in the introduction.
- Do not mention images unless a caption is not enough to prevent a misunderstanding, for example that an image is an artist’s concept.

## Checklist before committing

- Introduction answers: what, where, and why it matters.
- Every section title is a hook, and every section is supported by its source.
- No stock lines, editorial instructions or repeated caveats.
- The length matches how much there is to tell.
- `reviewedAt` is updated when an article file’s content is reviewed.
- Run `npm run catalog:generate` and the focused tests in `src/star-info.test.ts`.
- Keep data-provenance sections that document catalog values (adopted or alternative measurements, model estimates with their assumptions) unchanged unless the catalog data changes; tests check some of their wording.
