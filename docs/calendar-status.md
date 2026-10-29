# Giving calendar status

`GET /api/calendar-status` reads Donately subscriptions for Feed Tulum's main campaign. Set `DONATELY_API_TOKEN` as a sensitive Vercel production environment variable before deploying. Never put it in HTML, browser JavaScript, or Git.

A square is filled when at least one live, active USD monthly subscription for that campaign was created on or after October 28, 2026 at midnight in Tulum (UTC-5), has a processed, unrefunded first payment, and its current monthly amount matches the square ($1–$31). Donor-paid fees are excluded when the fee metadata matches the current total. Renewals of older subscriptions do not count. Canceled or suspended subscriptions no longer fill a square. Filled squares remain donation links.

The endpoint returns only `filledDays` and `updatedAt`. It caches successful results at the CDN for 60 seconds. The page checks every 60 seconds, so changes normally appear within about two minutes after Donately updates. Errors return HTTP 503 without caching; the page hides the availability key and displays an unavailable message while retaining the links. No database or webhook configuration is needed.

Run `node --test tests/*.test.mjs`. These fixtures cover matching, fees, date boundaries, exclusions, pagination, and endpoint failures without making donations. A live read verifies connectivity; no test payment is submitted.

For visual testing, run `node tests/preview-calendar.mjs filled` and open `http://127.0.0.1:8766/calendar`. The fixture shows 2, 21 and 31 filled. Restart with `empty` or `unavailable` to inspect those states. It binds only to localhost, never reads an API token and never contacts Donately. Tests are excluded from deployment. The UI regression test runs the actual status script through paid → canceled → filled → unavailable → recovered states and checks that all donation links remain unchanged.

## Credential security

The personal token is stored as a sensitive, production-only Vercel environment variable. The endpoint accepts GET without parameters, uses a fixed Donately destination/account/campaign, refuses upstream redirects, and returns only public day numbers and a timestamp. Errors are generic and never log provider responses. Git and deployment ignore rules exclude local secrets. These controls protect the website boundary; they do not reduce the token's privileges at Donately.

Donately's API supports refunds, subscription edits and immediate charges. Treat a stolen personal token as potential donor-data and financial compromise. The dashboard exposes no read-only token setting as of October 28, 2026. Ask Donately support whether they can provision a credential restricted to reading subscriptions for this account. See [API reference](https://developer.donate.ly/api/) and [account roles](https://support.donately.com/help/team-members).

If a token leaks, rotate it in Donately, replace the sensitive Vercel production value and redeploy promptly; review activity with Donately and the payment processor. Rotation can interrupt other integrations using the same personal token. Losing the local copy alone is not a disclosure. Do not store passwords or tokens in this document or Git.
