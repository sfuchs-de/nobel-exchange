# Candidate data review

Snapshot: 8 October 2026. This is a **reviewed editorial pool**, not nominations and not a forecast.

## Coverage

The original inventory has 117 economics Clarivate Citation Laureates. It excludes prior Nobel winners and deceased people, leaving 72; 18 additional John Bates Clark medalists made 90. The reviewed revision adds Timothy Bresnahan, Samuel Kortum, Whitney Newey, Drew Fudenberg, Matthew Jackson, Andreu Mas-Colell, Victor Chernozhukov, Luigi Zingales and John Haltiwanger, making **99**. Every original ID remains. The exclusions remain in `research/clarivate-inventory.json`. Inclusion does not imply annual winning odds. No padding, invented honors, or invented citation totals.

The public JSON contains original short descriptions, two publication examples, source URLs, retrieval dates and dated editorial evidence. Original affiliations remain **at award recognition**; new additions use primary profiles checked October 8, 2026. Each profile labels the basis. Initials replace portraits; no image licensing assumptions.

## Editorial treatment

The preserved [90-person review](../research/candidate-review-2026-10-08.md) supplies a disposition for every original name. The revised pool has **46 established contenders, 35 broad-watchlist picks, 11 future contenders and 7 outsiders**. Groups are judgments about maturity and distinctiveness of a research case, not committee knowledge, probabilities or age restrictions. All groups can be backed equally.

Featured uses group order, an explicit editorial opening sequence (Pakes, Athey and Barro first), then alphabetical order within groups. It does not sort by award year or imply calibrated odds. Research fields were corrected for the IO cluster, urban economics, political economy and credit-cycle/finance cases. Familiar display names retain old-name search aliases and stable IDs.

Evidence records distinguish a research award from an annual forecast, a public preview, a market listing, a long-horizon list or historical advocacy. Source dates remain historical; the 2025 Decker essay's forward 2026 trade call is explicitly labelled. Tol's possible partners and discussion mentions are not upgraded to his principal ten-name list. Clarivate recognition is not an annual prediction. Prediction-market listing is not expert endorsement and no market prices are copied.

Haltiwanger's firm-dynamics and productivity case belongs to the established group. His [2024 Cowen–Tabarrok podcast discussion](https://www.mercatus.org/marginal-revolution-podcast/economics-nobel-predictions-2024-missed-opportunities) is recorded as historical advocacy for data builders, not a current forecast. His Maryland affiliation, AEA Distinguished Fellowship (2024), entrepreneurship research award (2020), and two publication records were checked against primary sources and Crossref on October 8. No verified OpenAlex match is claimed.

The deterministic `npm run review:editorial` reads the audit and `research/roster-additions.json`, modifies only the draft roster and its review ledgers, and is idempotent. It requires `launchReady: false`. It cannot inspect runtime phase, so the operator must still ensure the roster is unopened. Never run it against a live game. The 99-person local preview has independent ignored storage; both earlier test states are retained, and the server's roster freeze is unchanged.

## What is checked and what remains

The separate **Most cited indexed articles** enhancement now displays 413 articles across 89 confidently matched economists, including five articles for 69 people. Twenty have shorter verified lists; ten author matches are unavailable. Counts are from the existing eight-record OpenAlex caches because the larger refresh hit the public daily quota. Crossref independently verifies 372 records; 41 retain explicitly labelled indexed dates. Book-review exclusions and version deduplication prevent obvious false rankings. The original 198 landmark selections and their citation trends are preserved. See [complete methodology and resumable refresh](ARTICLE-RANKINGS.md).

- The automatic inventory and individual biography audit are separate. A listing alone is not a completed individual check.
- `research/eligibility-audit.json` records individual-source checks for all 99 people: the original 48 primary institutional/award profiles and 42 biographical cross-checks, plus nine primary profiles. The additions were compared with the official Nobel API's economics laureate names; no match was found. This is an evidence-backed snapshot, not proof that future eligibility cannot change. No alternate account, paid API, or access bypass was used.
- OpenAlex matching uses canonical names plus institutional history and publication authorship. Alternative-name arrays were rejected after discovering a coauthor-list alias that incorrectly mapped Amy Finkelstein to Daron Acemoglu. Amy's statistics remain unavailable; her two papers are sourced to MIT instead.
- Jordi Galí's unusual OpenAlex spelling was manually resolved using affiliation and publication evidence.
- Several highly ranked book reviews were replaced with actual research. All **198** publication examples have a recorded bibliography check: Crossref title/author metadata or a manually reviewed publisher, author, institutional or library source. Corrections distinguish working-paper, journal, online-first and original book-edition dates. The 18 added publications were checked against Crossref and primary publisher/author records. These are selected examples, not a claim that citation rank uniquely identifies a scholar's two best papers.
- Annual **author** `counts_by_year` bins in this snapshot were inconsistent with a citation-received-year interpretation. They are not plotted. The displayed sparklines instead sum citation-year records for the **two displayed publications**, explicitly labelled “Selected works · 2021–25.” These are not full-author citation histories. The large number is the separately recorded full-author citation total.
- API coverage is incomplete and changing. A missing statistic is not zero influence. No comparison is normalized for career length or field.
- Correcting editions for Krueger, Kirzner and Oswald invalidated the cached selected-work comparison; their trends are unavailable rather than silently reusing different records. In total, 89 citation totals and 86 selected-work trends are available.
- All previous citation data and bibliographies were preserved. The nine additions have no verified OpenAlex match yet; their metrics are explicitly unavailable, not zero or fabricated.

Run `npm run check:data` for structural checks and an exact list of pending individual checks. Run `npm run check:release` for the stricter launch gate. The production server also refuses to open an unreviewed roster.

## Final prelaunch check — October 8, 2026

The user authorized publication and setup after the individual review and requested additions were implemented. All 99 individual checks and all 198 selected-publication checks are complete. A fresh official Nobel API inventory of 99 economics laureates was compared against every candidate name and alias; no previous-winner match was found. The complete individual-source living-status audit remains the dated evidence, not a claim about future eligibility. Descriptions, institutions and editorial-evidence labels were reviewed in the profile audit. Missing article/citation metrics remain visibly unavailable. `launchReady` is now true; opening will freeze the 99 IDs, names and eligibility. No new names may be silently added after that point.

## Before public opening

1. Recheck any eligibility changes immediately before opening, especially prior prize winners and living status. The current inventory's individual checks are complete.
2. Review the editorial selections in the gallery; factual bibliography checks are complete, but different landmark choices may be preferable.
3. Review all descriptions and award years. Do not treat an award-time institution as a current affiliation.
4. Mark the reviewed version, rerun data checks, and set `launchReady: true` only after the checklist is complete.
5. Opening freezes candidate IDs, names and eligibility. Never silently add, remove or rename candidates after entries open.

## Sources

- [Clarivate archive](https://clarivate.com/citation-laureates/hall-of-citation-laureates/) — primary inclusion source.
- [AEA medal archive](https://www.aeaweb.org/about-aea/honors-awards/bates-clark) — primary supplemental inclusion source; individual linked biographies are recorded in the audit.
- [Official economic-sciences laureates](https://www.nobelprize.org/prizes/lists/all-prizes-in-economic-sciences/) — previous winners.
- [Nobel nomination rules](https://www.nobelprize.org/nomination/) — nominations are confidential for 50 years.
- [OpenAlex authors](https://help.openalex.org/data/authors/), [works attributes](https://help.openalex.org/data/works/attributes/) — bibliographic metrics. Data is CC0; linked source texts and images retain their respective rights.
- Wikipedia's award index and biographies are discovery/cross-check aids, not substitutes for the primary-source final review. The raw cache is excluded from Git.

## Refreshing

Preparation scripts use public data and local caches. Do not run them during a live game. `seed.ts` rebuilds the draft and overwrites enrichments; `enrich.ts` can replace editorial selections. Always work on a copy, run `curate.ts`, then `check-bibliography.ts` and `finalize-bibliography.ts`, inspect the diff, and rerun checks. The finalizer records explicit manual exceptions; it does not invent API values or approve launch. Stop on rate limits and resume later. Cached raw data is local-only and not required for the runtime game.
