# Giving calendar status

`GET /api/calendar-status` reads Donately subscriptions for Feed Tulum's main campaign. Set `DONATELY_API_TOKEN` as a sensitive Vercel production environment variable before deploying. Never put it in HTML, browser JavaScript, or Git.

A square is filled when at least one live, active USD monthly subscription for that campaign was created on or after October 28, 2026 at midnight in Tulum (UTC-5), has a processed, unrefunded first payment, and its current monthly amount matches the square ($1–$31). Donor-paid fees are excluded when the fee metadata matches the current total. Renewals of older subscriptions do not count. Canceled or suspended subscriptions no longer fill a square. Filled squares remain donation links.

The endpoint returns only `filledDays` and `updatedAt`. It caches successful results at the CDN for 60 seconds. The page checks every 60 seconds, so changes normally appear within about two minutes after Donately updates. Errors return HTTP 503 without caching; the page hides the availability key and displays an unavailable message while retaining the links. No database or webhook configuration is needed.

Run `node --test tests/*.test.mjs`. These fixtures cover matching, fees, date boundaries, exclusions, pagination, and endpoint failures without making donations. A live read verifies connectivity; no test payment is submitted.
