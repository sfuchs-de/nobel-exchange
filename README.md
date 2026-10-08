# The Nobel Exchange — Economics 2026

Big ideas. Bragging rights. A friendly, imaginary-credit prediction game: one Google account, 100 credits, up to ten economists, and a continuously updating shared market.

**Status: public beta open.** Visit [The Nobel Exchange](https://sfuchs-de.github.io/nobel-exchange/). Google sign-in and Simon's administrator access are verified; the reviewed 99-person roster is frozen for this edition. Entries close Sunday, October 11, at 8 p.m. Eastern. See [data review](docs/DATA-REVIEW.md), [deployment](docs/DEPLOYMENT.md) and [status](docs/STATUS.md) for checks and remaining acceptance work.

## Play in under five minutes

1. Browse the compact market list or search a name/field. Tap a name to see research and sources.
2. Back 1–10 people. Split exactly 100 whole credits between them; “Split evenly” is a shortcut.
3. Sign in, choose a public display name, and save. Only the saved portfolio counts.
4. Change it any time before closing. The draft shows conditional payouts before saving. Everyone may back the same economists.

If Save is grey, read the explanation directly beneath it. Most often some of the 100 credits remain unallocated; use **Split evenly across my picks** or adjust the amounts. A signed-in player also needs a display name of at least two characters. **All changes saved** plus a saved-version receipt means the server has accepted the portfolio; an unchanged saved portfolio does not need saving again.

Open **Crowd** to see the most-backed economists, their share of saved credits, supporter counts and changes since the previous portfolio update. It shows the top ten by default, with the full ranking available on demand. **Market pulse** adds concentration, backing-band and field-share charts, plus a conditional-payout playground. Backing history stays available below. Individual portfolios remain private until closing; player scores appear in Results after settlement.

**Featured** now puts mature prize cases first, rather than sorting by award year. Use the contender filter for **Established**, **Broad watchlist**, **Future**, or **Outsiders**. These are editorial judgments, not odds. Each row has dated inclusion evidence; its profile separates awards, annual predictions, public previews, market listings and broad future longlists.

Candidate profiles also show **up to five most-cited indexed articles**, with citation counts, journal/year and publication links. The two selected landmark works stay separate. Current coverage is 413 articles across 89 economists (69 complete five-article lists); unavailable matches and shorter lists are explicit. See [article-ranking methodology and refresh instructions](docs/ARTICLE-RANKINGS.md). Counts are a dated OpenAlex snapshot, not live Google Scholar counts.

Backing percentages are **shares of allocated credits, not probabilities**. Estimates float as people join or change picks. There are no purchases, cash prizes, trading gains, fixed odds, or auction rounds. An early allocation gets no special price.

The pool is 100 points per submitted participant. For each actual laureate, multiply the pool by their official Nobel prize share, then divide that portion among their backers in proportion to credits. With 100 players, 10% of the backing of a sole winner pays 1,000 points; a half-share winner pays 500. Conditional sole-winner estimates are alternative scenarios and must not be added together. Tied scores share a rank; unbacked laureates' portions remain unawarded. No backers of any winner means nobody scores.

Default close: **Sunday, 11 October 2026, 8 p.m. Eastern** (`2026-10-12T00:00:00Z`). Earliest scheduled announcement: **Monday, 12 October, 5:45 a.m. Eastern** (`2026-10-12T09:45:00Z`). The server clock, not a phone clock, controls acceptance.

## Local preview

Use Node 22.12+ (tested with Node 26.3) and npm. From this directory:

```sh
npm ci
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open **http://127.0.0.1:4196/nobel-exchange/**. The local preview offers Alice, Bob and Admin test accounts. In a fresh preview, sign in as Admin, open the account menu → Administrator, then open the market. Use a separate tab for Bob to watch live updates. Preview identities are accepted only on loopback with the explicit development flag; they do not exist in production. Local SQLite state stays under ignored `.wrangler/preview-2026.3/` across restarts. Earlier 90- and 98-person test states remain intact in `.wrangler/state/` and `.wrangler/preview-2026.2/`; they are not migrated into an already-open market. Roster freeze is never bypassed.

Keep test data separate from production. Do not deploy `.wrangler`, raw research caches, tokens, or exports. The frontend Vite proxy sends `/api` to port 8796. Production uses a `VITE_API_URL` pointing to the Worker; it is a public service URL, never a credential.

## What is included

- Market, portfolio, Crowd and results views, a compact candidate list with inline credit controls, full research profiles, field filters, private drafts, save receipts, countdown, source notes and a phone portfolio tray.
- A live aggregate Crowd leaderboard: shared ranks for ties, saved-credit shares, backer counts and percentage-point changes. Unsaved drafts never affect this public ranking.
- Market pulse: cumulative concentration against equal backing, an effective equally-backed count, all-candidate backing bands and field-share bars on a common 0–100% scale. Click a field to browse its economists. Zero backing and a small sample are explicit; chart values have readable/table alternatives.
- A hypothetical new-player payout playground: choose an economist, 1–100 credits and a sole/half/third prize share. It includes the new player's 100-point contribution and own dilution, with a curve and scenario table. Remaining credits are assumed to go elsewhere. It does not save a portfolio or imply winning probabilities; your actual draft remains in My portfolio.
- Expandable backing history and changes since the first retained snapshot. No private individual portfolios are used by the new visuals.
- Live aggregate WebSocket updates with reconnect and polling fallback. An update never silently overwrites an unsaved draft.
- Server-side Google ID-token verification and short-lived app sessions; one saved entry per Google subject. Public IDs are random, not Google IDs.
- A SQLite-backed Durable Object: atomic replacements, optimistic versions, retry receipts, final locked portfolios, audit history and official-share scoring.
- Admin open/pause/close, result preview, settlement/corrections, and portable JSON export. No paid APIs, autonomous agents or integrations with any planner.
- 99 reviewed profiles: all original 90 candidates plus Bresnahan, Kortum, Newey, Fudenberg, Jackson, Mas-Colell, Chernozhukov, Zingales and Haltiwanger. Two checked publication examples each; citation totals and selected-work trends only where identity was matched. No scraped portraits or invented metrics.

## Checks

```sh
npm test
npm run test:integration
npm run typecheck:worker
npm run build
npm run check:data
npm run check:release
```

Integration tests start an isolated local Worker on 8797 and do not alter preview or production records. `check:release` refuses an incomplete editorial checklist. There are no automatic CI runs on pushes. The manual release workflow publishes Pages and can optionally update the Worker without replacing participant data.

To reproduce the current editorial draft, run `npm run review:editorial` then `npm run check:data`. This deterministic migration reads the preserved [candidate audit](research/candidate-review-2026-10-08.md) and reviewed [additions](research/roster-additions.json). It retains original IDs, publications and metrics, and refuses a launch-ready roster. Never use preparation scripts to change a live game's frozen roster.

## Launch and administration

See [deployment](docs/DEPLOYMENT.md), [administrator guide](docs/ADMIN.md), [privacy](docs/PRIVACY.md), and [verification status](docs/STATUS.md). Publication requires Simon's explicit authorization. Do not create a public repository, deploy the Worker, or change Google/Cloudflare access merely by following this README.

Code is MIT-licensed; source data and third-party assets retain their own terms. No affiliation with the Nobel Foundation, Clarivate, OpenAlex, Google, or any candidate is implied.
