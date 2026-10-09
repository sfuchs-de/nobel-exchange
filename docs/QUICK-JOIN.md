# Quick join — no email required

October 9 release for both groups. Publication/deployment was explicitly authorized; see [release status](STATUS.md) for the completed verification ledger.

## For participants

1. Pick your economists and allocate 100 credits.
2. Choose **Sign in & save → Quick join**, then enter a public display name.
3. Copy the private recovery code and keep it somewhere private. Confirm you have kept it.
4. Return to your picks and press **Save portfolio**. Joining alone does not enter you.

Your browser remembers the account for up to 30 days. On another device, choose **Already joined? Use recovery code** in the same group. Recovery returns to the existing saved entry; it does not create a second one. Sign out on shared devices.

Codes start `NX-O.` for the original group or `NX-P.` for the public group. They do not transfer between groups, even if someone changes the prefix. Google players must continue using Google; accounts are not automatically linked or merged. Creating a new Quick join account instead of recovering an existing one makes a different account. Please submit only once per person in each group.

There is no email reset. Anyone with the code can edit that account's picks while the market is open. Do not include the code in screenshots, posts or public bug reports. If both the remembered browser sign-in and the recovery code are lost, access cannot be restored by identifying a nickname alone.

## Security and storage

- Server-generated 256-bit random codes. Only SHA-256 verifiers are stored in each group's private `quick_accounts` table; plaintext codes are returned once and never logged or exported.
- Random private account subjects are separate from random public portfolio IDs. Names and final picks become public only at closing, just like Google entries.
- Signed 30-day Quick join sessions carry the exact group ID and cannot grant administrator access. Existing Google sessions/routes remain unchanged. Remembered Quick join tokens use separate per-group browser keys; sign-out clears the current group's token, not the other group.
- Registration/recovery are POST-only, bounded JSON requests, allowed-origin checked and no-store. Rate limits are 30 registrations and 90 recovery attempts per network/group in ten minutes. Only a keyed network digest is stored temporarily, never a raw address. This is abuse resistance, not proof of one person per account. Shared networks may encounter the limit.
- New registration is allowed only while open and before the server deadline. Recovery works afterward, but locked portfolios remain locked. Temporary rate records are cleaned on requests; no new alarm, service, scope, paid API or email delivery is introduced.
- Existing portfolio rules, atomic saves, version checks, retry receipts, histories, scoring and market separation are reused. Quick-account setup never modifies the pool, revision or public history.

Recovery depends on persistent private Cloudflare storage. The existing administrator export contains portfolio/audit data, **not recovery verifiers**; it is not a full authentication backup. Use provider-native recovery for those tables. Preserve this schema if rolling code back after Quick join has been released; older code cannot authenticate the new entries even if their data survives.

## Verification

`npm test` includes credential-format and browser-restoration checks. `npm run test:integration` exercises existing market/Google flows and the disposable Quick join runtime suite: registration, recovery, cross-group rejection, denied admin access, save retries/versions, concurrent edits, preserved Google entry, restart persistence, throttle persistence and closing behavior. No production accounts or portfolios are used.

October 9 local gate: 105 unit and 197 runtime checks passed, plus build, Worker types and data/configuration checks. Browser save/reload/recovery passed in both isolated groups; forms were inspected at 1440/390/320px. Actual iPhone/Safari and production Quick join remain unverified until an authorized release and device retry.

For temporary visual QA only, `node tests/quick-auth-integration.mjs --ui` starts a disposable backend on loopback port 8812, allowed only from port 4198. Run `VITE_API_URL=http://127.0.0.1:8812 npm run dev -- --port 4198` separately. Stop the backend with Ctrl-C to remove its temporary configuration/data. Never deploy these fixtures. Automated integration tests use a different port and authenticate their own runtime before accepting readiness.
