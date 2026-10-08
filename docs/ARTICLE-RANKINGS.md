# Citation-ranked articles

Snapshot: **8 October 2026**. The candidate dialog now contains a compact ranked list with title, publication/index year, journal, recorded citation count and a readable publication link. The market list stays compact. The two selected landmark works remain separately available, including important books. The existing 2021–2025 trend still sums those two landmarks, not the new ranked list.

## Coverage and limits

There are **413 displayed articles across 89 matched economists**: 69 profiles have five, 20 have one to four. Ten profiles remain unavailable pending confident author matching (Amy Finkelstein and the nine recent additions). Missing articles/counts are not invented or filled with zeroes.

Counts come from OpenAlex's `cited_by_count`: works in that database with matched references to the indexed work. These are not Google Scholar figures, a quality score or Nobel-winning probabilities. Coverage, merged author identities and publication versions can affect rankings. The label is **Most cited indexed articles**, not a claim of exhaustive career coverage.

The current data comes from the eight highest-cited records already cached for each matched author. The larger 60-record refresh was blocked by OpenAlex's exhausted shared keyless daily budget; its response says this resets at midnight UTC. No alternate IP, credentials, paid service or automated future run was used. A wider retrieval is necessary to complete every profile.

Book records, book chapters/reprints, identified book reviews, corrections, paratext and retracted records are excluded. Research surveys remain eligible. A publisher journal location is accepted even if a repository is the primary location. Duplicate DOI/title records are not added together. The explicit review exclusions are in `research/article-exclusions.json`; they apply across coauthors too.

Publisher-deposited Crossref metadata independently matches author, title and journal-article type for **372** displayed entries. The other **41** use checked OpenAlex authorship because DOI metadata was unavailable or there is no DOI. Their dates are visibly labelled **Indexed**, rather than claimed as publisher-verified publication dates. Genuine Crossref identity/type mismatches are held out. Crossref access also returned some 429 responses; the refresh now stops network requests on the first such response and preserves the caches.

The original 99 identities, eligibility, 198 landmark selections, honors, editorial groups, 89 author totals and 86 landmark trends are unchanged. Removing only `mostCitedArticles` from the enriched JSON reproduces the original input SHA-256.

## Reproduce or resume locally

From the repository root, after the public API budget has reset:

```sh
npm run enrich:articles
```

This prepares a draft and audit, without modifying the public roster. A fresh retrieval uses the execution date; an explicit `--date=YYYY-MM-DD` permits reproducing a dated snapshot. It uses canonical names, institutional history and a previously checked publication anchor for unresolved people; alternative-name/coauthor lists are not identity evidence. It retrieves up to 60 citation-sorted records and resumes from immutable raw responses.

Inspect `research/raw/articles-2026-10-08/prepared-candidates.json` and `research/article-ranking-audit.json`. Then cross-check publisher metadata and apply only the new ranking fields locally:

```sh
npm run verify:articles -- --apply
npm run check:data
npm test
npm run build
npm run typecheck:worker
```

For an offline reconstruction of the current eight-record snapshot:

```sh
npm run enrich:articles -- --cached --date=2026-10-08
npm run verify:articles -- --offline --apply
```

The independent metadata ledger is `research/article-bibliography-audit.json`. Raw responses are ignored by Git. No API keys, private data or participant records enter these files. Preparation refuses direct `--apply`; verification checks identity conflicts before copying the ranking field and never replaces other profile fields. Application rejects a deliberately launch-approved roster. Do not run preparation during a live game without an explicit reviewed metadata-update procedure; preserve the frozen identities.

## Verification

- 43 unit cases and 45 isolated Worker integration checks pass, plus build, Worker typecheck and data validation.
- Desktop 1440px and phones 390px/320px were visually inspected: complete list, long titles, aligned counts, landmark disclosure, partial lists and unavailable state. No horizontal dialog/list overflow at 320px.
- Main fictional preview remains two participants, 200 points and revision 3. No portfolios, backend behavior or roster identities changed.
- The pre-existing build-size advisory remains; the production JavaScript is approximately 657 kB, 145 kB compressed. Publication and deployment remain separate authorization gates.

Sources: [OpenAlex work attributes](https://help.openalex.org/data/works/attributes/), [sorting](https://help.openalex.org/api/sorting/), [public API budgets](https://help.openalex.org/api/authentication/), and each linked publisher/DOI record. Citation data is a dated snapshot, not live metrics.
