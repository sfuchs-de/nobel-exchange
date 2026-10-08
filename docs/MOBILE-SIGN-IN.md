# Mobile Google sign-in

The game uses full-page sign-in on iPhones/iPads. Desktop browsers keep the existing popup button and also offer **Use full-page sign-in**. Open the game itself directly in Safari or Chrome; unsupported embedded webviews may still require opening in a system browser. Google documents that redirect mode is required on iOS due to ITP: [supported browsers](https://developers.google.com/identity/gsi/web/guides/supported-browsers).

## Player experience

1. Open the intended original or public group. Choose any draft picks.
2. Join → Continue with Google (or Use full-page sign-in on desktop).
3. On the secure sign-in page, press Google's own sign-in button and choose an account.
4. Return to the same group, with the draft restored. Choose a display name and save exactly 100 credits.

Sign-in does not create a participant. Only a successful portfolio save enrolls that account, in that group alone. Existing saved picks are loaded if there is no pending draft. Keep the same browser/tab throughout: a verifier and draft stored in that tab are needed to finish. No automatic portfolio submission.

## Operator configuration

The existing identity-only Google client retains the GitHub Pages origin and adds `https://nobel-exchange-api.sfuchs-de.workers.dev` as a JavaScript origin. Its two authorized redirect URIs are:

- `https://nobel-exchange-api.sfuchs-de.workers.dev/api/auth/callback`
- `https://nobel-exchange-api.sfuchs-de.workers.dev/api/public/auth/callback`

No new scopes, client secret, billing plan or participant migration. Google warns configuration changes can take five minutes to several hours to propagate. The browser login page is on the Worker origin so Google's CSRF cookie reaches the same-origin receiver, rather than attempting to post a GitHub Pages cookie to a different domain. [Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [token/CSRF verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Security and storage

- `/auth/redirect` accepts an S256 challenge from an allowed frontend origin; the raw 256-bit verifier stays in the initiating tab.
- A ten-minute attempt has a fresh ID-token nonce, fixed group and allowed return origin. There is no arbitrary return URL or user-supplied room.
- Google returns a form to `/auth/callback`. The server requires matching double-submit CSRF cookie/body, a correctly signed Google ID token, correct audience/issuer/expiry, and the attempt's nonce.
- A two-minute, single-use random code returns in the URL fragment. It is not a Google ID token or app bearer token. The app removes the fragment immediately and exchanges code + verifier in a protected POST. Both are required, protecting against a login link started by a different browser.
- Auth state is an isolated `auth_flows` SQLite table in each existing group object. Atomic completion/redemption rejects concurrent use/replays. It is not included in participant exports, public snapshots, scores, history or feeds. Redeemed records are deleted; expired records are pruned on subsequent sign-in starts. Maximum 1,000 outstanding attempts per group limits growth. No market alarm is replaced.
- Tokens, codes, verifiers and raw Google subjects must never be logged, shown in screenshots, committed or copied into diagnostics. Sign-in pages and responses use no-store/no-referrer headers and cannot be framed. There is no debug Google authentication in production.

## Verification and rollback

The disposable runtime suite uses a locally generated RSA key/JWK server, not a real Google account or production entry. It tests Google-token nonce/audience/expiry checks, CSRF failures, wrong verifier/code, cross-group rejection, concurrent single-use enforcement, restart persistence and unchanged market snapshots. Pure tests cover iOS selection, S256, pending draft validation, response parsing and expired/malformed flows.

Production release still requires observing actual Google login and same-group return; physical iPhone acceptance cannot be substituted by a narrow desktop viewport. Test real sign-in without saving or changing picks when only checking authentication.

Rollback to the pre-mobile release preserves both original/public groups and all 102 candidates. Auth table data may remain until pruning, but participant records are not changed. In-progress mobile login attempts will need restarting after rollback. Never roll back to pre-public/pre-102 code or replace persistent storage with test fixtures.
