# Nobel Exchange: test report and deployment recommendation

Reviewed October 8, 2026. **Local functionality tested; not yet ready for public invitations.**

This was a diagnostic review, not a release. Application code, roster and main preview records were not changed. No repository, Google client, Cloudflare service, credentials or remote deployment was created. Work Task Manager, Family Planner and Framework remain unrelated and unchanged.

## What was tested

| Check | Result | Limits of the evidence |
| --- | --- | --- |
| Unit tests | 37 passed | Scoring, ranking, catalog and market visualizations |
| Isolated Worker integration | 45 passed | Atomic budgets, retries, concurrency, restart persistence, origins, authority, deadline and correction history |
| Production frontend build | Passed | Existing 512 kB JavaScript size advisory; not a launch failure |
| Worker TypeScript check | Passed | Static correctness, not live provider configuration |
| Candidate structural validation | Passed | 99 profiles; does not replace final editorial approval |
| Production dependency audit | No known vulnerabilities reported | Production packages only; not a complete security assurance |
| Release gate | Correctly blocked | `launchReady` is false; public authentication/privacy setup is unfinished |
| Additional local diagnostics | 12 checks passed, two hardening findings | See findings below; no production capacity claim |

The additional disposable test accepted **40 parallel first entries**, kept exactly **4,000 total credits**, and rejected all but one of eight competing updates to one saved version. Participant count and budget stayed consistent. Missing/foreign origins, malformed JSON and unusable authentication did not grant access. In the unconfigured fixture, the Google endpoint returned configuration failure: this is not evidence of working Google-token verification end to end.

## Actual browser flows

Two independent browser tabs used a separate disposable local market, not the main preview:

- Joined with clearly labelled synthetic accounts; an incomplete allocation could not save.
- Selected candidates, balanced credits, chose a display name and saved. Refresh restored the saved allocation and version.
- Saved a second participant; the first tab received the new player count, pool and backing without refresh.
- Edited the same portfolio in two tabs. The stale save was rejected with an explanation; loading the saved version recovered the current allocation rather than overwriting it.
- Inspected long candidate details, publication/source links, unavailable citation labels, keyboard Escape dismissal, How to play, Sources and Privacy.
- Paused and resumed the disposable market; the participant screen followed the state change.
- Closed the fixture through the explicit confirmation. Portfolios became public only in the closed/results flow.
- Previewed a hypothetical 50%/25%/25% shared prize, including an unbacked outside-roster name: **450 awarded + 150 unawarded** from the 600-point pool. Ties shared ranks.
- Published that fictional result and corrected it to a 50%/50% split: **600 awarded**, two tied leaders at **195 points**, and settlement revision 2. Both settlement records remained in the administrator audit.
- The export API contained six synthetic entries and six audit rows, without their private sign-in subjects. The in-app browser did not expose a completed download event, so the browser-file download still needs verification in normal Chrome/Safari.
- Desktop at 1440 px and phone layouts at 390/320 px were inspected. Sample candidate dialogs and results stayed within the viewport, with no horizontal page overflow. No browser console errors were captured in either QA tab.

Screenshots in private temporary storage:

- `/private/tmp/nobel-qa-results-desktop.jpg`
- `/private/tmp/nobel-qa-results-phone.jpg`

These show **hypothetical test winners, not actual laureates or forecasts**. Disposable fixtures were stopped after testing. The main preview remains at revision 3, two fictional participants, 200 points, Varian 150 credits and Athey 50; individual portfolios remain absent from its public open-market response.

## Issues to fix before launch

1. **Saved display-name normalization.** Entering `  QA   Explorer  ` saves the normalized `QA Explorer`, but the client retains the old text and incorrectly says “unsaved changes.” Set the displayed name from the successful server response and add a UI regression test. No saved data was lost.
2. **Administrator input hardening.** A winner array containing `null` returns a generic HTTP 500 instead of a validation response. Validate each object and field before accessing it. A roster ID with a conflicting supplied name is also accepted; derive canonical names from the roster server-side, leaving manual names only for outside-roster winners. These endpoints require administrator authority; no anonymous privilege escalation was observed.
3. **Search aliases.** `Soren Johansen` does not match `Søren Johansen`; surname-only search works. Existing normalization handles ordinary accents but not letters such as ø. Add explicit transliteration/aliases and regression tests.
4. **Small stale copy.** Sources says “eight further additions,” but the roster now has nine. Results says “0 points unawarded because those laureates had no backers” when the entire pool is awarded; use “All points awarded” for that case.

The administrator fields do have accessible labels in the browser accessibility tree; an initial label-locator mismatch was a test-tool limitation, not a confirmed application defect.

Other worthwhile improvements, not claimed as implemented:

- Save a recoverable local draft or warn before leaving with unsaved picks. Saved portfolios persist; unsaved drafts currently live only in memory.
- Use hibernation-compatible automatic WebSocket ping responses and reduce repeated full-database snapshot reads. Current live updates work, but their free-quota cost has not been measured on Cloudflare.
- Add bounded abuse protection to public authentication/market endpoints; the existing per-participant save throttle is not an all-endpoint rate limit.
- Include integration tests in the release workflow; the current manual Pages workflow checks units/types/data but not the isolated integration suite.

## Recommended public deployment

Use the already implemented architecture, with **one GitHub repository as the source and release hub**:

| Component | Location | Responsibility |
| --- | --- | --- |
| Source, reviewed candidate snapshot, guides | `sfuchs-de/nobel-exchange` | Versioned public-safe code/data, not participant records |
| Public interface | `https://sfuchs-de.github.io/nobel-exchange/` | Market, portfolio, visualizations and results |
| Live backend | Cloudflare Worker + SQLite Durable Object | Verified sign-in, atomic saves, live broadcasts, deadline, settlement and history |
| Sign-in | Google Identity Services | One portfolio per Google account; no Gmail/Drive/Calendar integration |

GitHub Pages is a static host, so GitHub alone cannot safely accept or synchronize live entries. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

This recommendation keeps the existing code and target URL, and does not depend on Framework being online. Running this backend on Framework would require a different runtime and public ingress/security operations; private Tailscale access would not provide seamless access for everyone with the link.

Cloudflare supports SQLite Durable Objects on its free plan. The published limits include 100,000 requests/day, 13,000 GB-s/day, five million rows read/day, 100,000 rows written/day and 5 GB stored. Exceeding a free limit causes operations of that type to fail until reset; these are not unlimited capacity or a guarantee that this workload stays free. Check both Workers and Durable Object usage during the pilot. Do not enable paid upgrades automatically. [Current Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

### GitHub-centered release process

The existing workflow deploys only the frontend manually. Extend it to a single **Run workflow → Release** action, not a deployment on every push:

1. Select an explicitly reviewed commit. Run local checks first, then unit/integration/type/data/release checks in the workflow.
2. Check production configuration: reviewed frozen roster, correct server dates, HTTPS API, exact allowed origin, configured Google/admin/session settings, and no development authentication.
3. Deploy the Worker while preserving the Durable Object binding, class/migration and edition identity. Never reset or seed live participant data.
4. Smoke-test the API, then publish Pages built with that API URL. A frontend failure must not erase data; record both deployed versions because a two-provider release is not an atomic transaction.
5. Record release/rollback instructions and preserve a private export before backend updates. Participant edits never create GitHub commits or trigger CI.

Use a narrowly scoped Cloudflare deployment token in GitHub's protected environment secrets, not in code. Keep the session secret and administrator identity in Cloudflare's secret store. Repository workflow permission should be limited to what Pages/release needs. [Cloudflare's GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

If minimizing GitHub Actions minutes becomes more important than preserving the github.io address, a later alternative is to host the frontend and Worker together on Cloudflare and use its GitHub build integration. That would require configuration changes and separate approval; it is not the current tested path.

## One-time launch checklist

- [ ] Authorize publication and deployment separately; audit public repository contents. Exclude caches, credentials, internal memory and private exports.
- [ ] Confirm Cloudflare account and free-plan limits, without buying a plan.
- [ ] Create this app's Google **Web** identity client. Authorized JavaScript origin is `https://sfuchs-de.github.io`, without the project path; local testing uses separately authorized localhost origins. Configure identity only. [Google setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [ ] Privately configure the session secret and Simon's verified administrator subject; never use “first login becomes admin.”
- [ ] Select a support/deletion contact and retention date, and finish the public privacy notice.
- [ ] Approve the 99-person editorial roster, recheck eligibility, set the release flag, and confirm the configured closing deadline. Do not mutate the frozen roster after opening.
- [ ] Fix the confirmed interface/input issues and rerun the checks.
- [ ] Deploy into a controlled prelaunch state and test two real Google accounts, including a non-admin, on HTTPS.
- [ ] Verify normal Chrome and actual iPhone Safari: sign-in, edit/save/refresh, stale-version recovery, result-link navigation, export download, network disconnect/reconnect and small-screen interaction.
- [ ] Run a first-time participant trial: understand the game and save exactly 100 credits in under five minutes. This has not been measured yet.
- [ ] Verify recovery on a staging Durable Object, then document a production recovery procedure. Cloudflare's SQLite point-in-time recovery is unavailable locally and covers the past 30 days. The current sanitized administrator export is **not** a full identity-linked restore image. [Recovery API documentation](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [ ] Open entries only after these gates pass; share one ordinary link with participants.

For participants, the intended experience is simply: **open the link → sign in with Google → choose a public display name → allocate 100 credits → save**. No invitation codes, Tailscale, app installation or GitHub account should be needed.

## What is needed from Simon

When ready to proceed: permission to fix the small launch issues and prepare the combined release workflow; then explicit authorization to create/publish the standalone repository and deploy. One-time interactive Google/Cloudflare sign-in or approval may be required. Also choose the contact/retention policy. No password or token needs to be pasted into chat.
