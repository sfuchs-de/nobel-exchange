# Administrator guide

## Before opening

Sign in as Simon, open the account menu, and choose **Administrator desk**. Verify the edition, roster, closing time, official announcement time, privacy notice and authentication. Opening freezes candidate IDs/names/eligibility. The deadline freezes after the first submitted entry. Data/configuration must be reviewed before production opening.

**Pause** temporarily rejects new saves without deleting anything. Existing portfolios still count. **Close** is final: it makes individual portfolios public and rejects future changes. A closed market cannot be reopened, including by pausing first. A state change is audited. The deadline closes the market even if nobody has the admin page open.

## Settle the prize

1. Read the official Nobel announcement. Select the actual laureates and their exact fractions of the prize (not equal fractions unless that is the official split).
2. A laureate outside the candidate roster can be entered by name. Their portion is unawarded; the roster is not silently expanded after closing.
3. Preview settlement. Confirm pool size, winner shares, leaderboard and unawarded points. Shares must sum to one; one to three distinct winners are supported.
4. Enter the official `https://www.nobelprize.org/…` result link and an audit note. The link's host is validated; the administrator must still verify that the page actually supports the chosen result.
5. Publish. Settlement is version-checked and production publishing is blocked before the scheduled announcement. Players immediately see results.

To correct a mistake: preview the corrected winners/shares, explain the correction, and publish. The earlier settlement remains in the private audit export; the public result identifies its revision. Never delete previous settlement history or manually edit the database to conceal an error.

## Disputes and scoring

Each submitted person adds 100 points to the pool. A winner's portion is divided proportional to the credits on that winner. A zero-backed portion stays unawarded. Equal scores share ranks (e.g. 1, 1, 3), with a small floating-point comparison tolerance. Display rounding does not change the scoring values. There are no prizes, payouts of money, fees or side bets.

Duplicate display names are allowed: identity is the Google account, not the visible name. One person could control multiple Google accounts; this is a social game, not a verified-one-human system. Do not advertise stronger fraud prevention than is implemented. Investigate abusive participation before closing; this initial version has no hidden score-adjustment or user-deletion control.

## Support

- “Changed in another tab”: preserve the user's draft, then use **load latest saved version**. Never bypass version checks.
- “Sign-in expired”: sign in again. Drafts are in-memory and can be lost on refresh; saved entries are server-persistent.
- “Reconnecting”: the app retries and polls. A failed save is not a saved portfolio; retry the same save to receive its original receipt if it had already succeeded.
- “Roster changed”: restore the frozen roster; do not silently migrate live picks.
- Unexpected quota or service failure: pause if possible, explain availability honestly, and do not secretly extend a frozen deadline.

Export the administrator JSON for an audit and retain it privately. See deployment instructions for full-data recovery limitations.
