# Privacy and launch decisions

The backend stores a Google subject identifier, random public entry ID, chosen display name, saved allocations, versions, timestamps and retry receipts. Google ID tokens are verified and exchanged for an eight-hour app session. They are not written to the database. The browser keeps the app session in session storage; normal Google browser cookies remain Google's responsibility.

Only aggregate credit totals/supporter counts are public before closing. After closing, chosen display names, random entry IDs and final portfolios are public. Results and their official source are public. Emails, Google subjects, and sign-in tokens are not exposed by the market feed or admin audit export. The server does not request private Google files or contacts.

The original and public groups use separate storage. A Google account may submit one independent portfolio in each; joining one does not copy an entry into the other. Public IDs are separately randomized, and the public feed does not expose the shared Google subject. A participant choosing the same nickname in both may still be recognizable; this is not an anonymity guarantee. Both URLs allow anyone with the link to participate. The same retention/support policy applies to both groups.

Google provides sign-in and fonts; Cloudflare hosts participant storage, while GitHub hosts static code/data. No analytics, advertising, payments, email notifications or social-posting integration is installed.

Simon approved **sfuchs.de@gmail.com** for private support/deletion requests on October 8, 2026. Account-linked data will be removed manually by **January 10, 2027**. Public nicknames, final picks and scores may remain as the edition’s archive. This is a manual commitment, not an installed automatic purge. Never ask participants to post account information in public GitHub issues. Cloudflare’s native recovery window may retain earlier versions temporarily; explain that limitation when answering deletion requests.

Participants should use a nickname if they do not want their real name on the final leaderboard. A roster card describes public academic work; it is not an endorsement or actual nomination. No third-party portrait is copied without an explicit reuse license.
