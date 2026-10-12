# Nearby-star Info articles

`src/data/star-info.json` holds 15 editorial articles covering the 22 original objects in `src/data/stars.csv`, reviewed on 2026-10-11. The articles cover introductions, distinguishing features, history or physical context, and stellar or planetary orbits. They are original summaries with links to Wikipedia for further reading and to primary sources for recent research. They do not replace catalog measurements or the frozen planet-membership data.

`src/star-info.ts` resolves explicit component identities through `starComponentIdentity`: Alpha Centauri A/B/Proxima, Sirius A/B, Luhman 16 A/B, Luyten 726-8 A/B, and EZ Aquarii A/B/C each share one article. Selection still refers to the chosen component. Reviewed cross-catalog aliases also reuse the article; unreviewed names or nearby positions do not establish identity. Objects without articles clear the old content and disable Info.

The selected-object and planet cards share the DOM renderer in `src/object-info-content.ts` and the existing planet Info styles. Nine articles have locally stored, credited images; six are text-only. See [image provenance](../src/assets/stars/README.md). Captions distinguish photographs, survey composites, infrared or ultraviolet views, and artist's concepts, and distinguish observing dates from publication dates.

Recent research includes the 2025 four-planet Barnard's Star analysis; the 2026 four-planet GJ 887 analysis and additional candidate; September 2026 evidence for patchy water clouds on WISE 0855; the unconfirmed 2025 Alpha Centauri A imaging candidate; the unconfirmed 2024 GJ 65 candidate with ambiguous A/B host; and 2025 Webb Epsilon Eridani imaging upper limits. Candidate/disputed signals and habitable-zone uncertainty are retained explicitly. “No confirmed planets” statements refer to the reviewed sources, not proof that a system is planet-free.

Focused coverage is in `src/star-info.test.ts` (all 22 IDs, shared articles, aliases and unknown IDs) and `e2e/star-info.spec.ts` (UI availability, all components, local-image loading and shared content). Full-suite authorization remains governed by `AGENTS.md`.
