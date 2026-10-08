# Deployment and account setup

Deployment was explicitly authorized on October 8, 2026. Future releases remain manual: a code edit or push is not permission to deploy it.

## Architecture

GitHub Pages serves the React build and public candidate JSON. It cannot store live participant records. A separate Cloudflare Worker routes to one SQLite-backed Durable Object (`economics-2026`), which serializes saves and broadcasts public aggregates. Participant records never go into GitHub. No Framework or planner service is used.

## Required one-time setup

1. After explicit publication approval, create `sfuchs-de/nobel-exchange` as a standalone repository. Review its contents before making it public; include source, lockfile, public candidate data and documentation only.
2. Sign in to Cloudflare with the official Wrangler login flow. Use a free Workers account supporting SQLite Durable Objects. Confirm current [quotas/pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). Do not upgrade to a paid plan automatically. Free quota exhaustion can cause errors, so “no subscription” is not a capacity guarantee.
3. Create a Google OAuth Web client for this application, with authorized JavaScript origin `https://sfuchs-de.github.io` (not the path). For local testing add `http://127.0.0.1:4196`. Only identity sign-in is needed; no Gmail, Drive or Calendar scopes.
4. Fill `GOOGLE_CLIENT_ID` in the Worker configuration. Store a strong random `SESSION_SECRET` with Wrangler's secret prompt; do not paste it into source, chat, shell history or a public variable. Store Simon's Google subject ID as `ADMIN_SUB` privately. Obtain it from Simon's successful verified login/session in a controlled setup, not a guessed email address. Do not promote arbitrary users or use “first login becomes admin.”
5. Configure `ALLOWED_ORIGINS` to `https://sfuchs-de.github.io` for production. Remove local origins from the deployed config. Never set `DEV_AUTH` in production. The local command supplies that flag only for loopback tests.
6. Complete the data review, privacy contact/retention decisions, and release checks. The Worker refuses public opening when `launchReady` is false or authentication is incomplete.
7. With deployment authorization, deploy the Worker. Record its exact HTTPS URL and set repository variable `VITE_API_URL` to it. Enable GitHub Pages with GitHub Actions as the source.
8. Trigger the **manual** release workflow. It builds/tests and uploads only `dist/`. No deployment is triggered by every commit or push. Its optional `deploy_backend` input updates the Worker first, preserving persistent data, when a scoped GitHub deployment secret has been separately configured. Otherwise deploy the backend locally using the authenticated Wrangler flow; leave that input false.
9. Test production Google login with two authorized test accounts, cross-origin requests, live updates, saved-state refresh, server deadline, and the public results view before inviting participants. Do not claim this was tested from local preview accounts.

## October 8 setup

Production configuration is separate in `wrangler.production.jsonc`. Target: `nobel-exchange-api`, account ending `c3a4`, HTTPS API `https://nobel-exchange-api.sfuchs-de.workers.dev`. No development identity or localhost origin is permitted. The approved Google project is **Nobel Exchange 2026** (`astral-adapter-511018-p7`), with only a browser identity client and no billing added. Its public client ID is safe to include in configuration; its client secret is not needed and must not be downloaded or committed.

Local Wrangler authentication is encrypted and backed by macOS Keychain, with account/user read and Workers scripts write only. The optional Cloudflare agent MCP is registered but its OAuth callback failed issuer validation; it is not authenticated or usable yet. Do not bypass validation. The official Cloudflare skills are installed. Restart Codex to load newly installed skills/connectors.

The public Pages release has succeeded, and Simon's actual Google sign-in and administrator desk work. The market is open with the 99 reviewed candidate identities frozen. The replacement GitHub release credential is encrypted in repository secrets, restricted to Workers scripts write and account read on this account, and expires January 10, 2027. Its exposed predecessor was revoked and verified absent. `SESSION_SECRET` and `ADMIN_SUB` stay in Cloudflare, not GitHub. No DNS, billing, email or planner permissions were requested.

For an authorized update, open the repository's **Actions → Release Nobel Exchange (manual) → Run workflow**. Leave `deploy_backend` off for frontend-only changes; enable it for a reviewed backend update once the restricted secret is verified. A push alone does not publish a release. Neither choice seeds or replaces the persistent market database.

## Configuration and quotas

`wrangler.jsonc` preserves API routes `/api/config`, `/api/market`, `/api/live`, `/api/auth/google`, `/api/me`, `/api/portfolio`, and `/api/admin/*`. Browser writes require an allowed Origin plus a verified session. Every portfolio save validates IDs, integers, budget and version on the server. Retries reuse a request ID. Google subject identifiers remain private.

SQLite data remains attached to the Durable Object across code deployments. Do not rename the binding/class/migration or edition's object name accidentally. No reset/seed runs in production. The feed has a 500-socket cap, with clients falling back to periodic refresh. That cap does not imply the free plan can sustain 500 concurrent users; measure usage and obey quotas. Every accepted edit records history; the public chart shows the most recent 240 changes.

## Releases and recovery

Before a release: export via the administrator screen; save that file in private storage outside Git; record the Worker version; use Cloudflare's available SQLite recovery features as an additional safeguard. A public admin export deliberately omits Google subject IDs, so it is useful for auditing/scoring but is **not a complete account-linked disaster-recovery image**. Test Cloudflare-native restoration before claiming full recovery readiness.

Run local checks first. Updating static assets cannot modify portfolios. Updating the Worker must preserve the schema and binding. Roll back code with Cloudflare version controls if needed; do not overwrite newer participant data with an old export. This project does not include a dangerous bulk-import endpoint.

For a future edition, create a new Durable Object name and reviewed roster, update dates in server/frontend docs, keep the old results archived, and run the entire checklist. Do not reuse last year's open database or assume the announcement date.

## Public-host limitations

GitHub Pages does not let this repository set arbitrary response security headers. The Worker sets CORS and no-store for dynamic responses. A stronger edge CSP/header policy would need a separate frontend host or proxy; don't claim it is configured here. Google Fonts are fetched from Google's public font service; sign-in loads Google's identity script only when needed. No advertising or analytics is included.
