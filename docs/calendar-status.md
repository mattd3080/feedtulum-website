# Giving calendar status

The website makes no authenticated requests to Donately and needs no Donately API token. Donation links still preload the chosen monthly amount.

`POST /api/donately-webhook` accepts authenticated donation notifications, strips private donor fields and updates private Vercel Blob storage using conditional writes. `GET /api/calendar-status` returns only filled days and a timestamp. It returns 503 when storage is unavailable or not initialized; the page then hides the availability legend and keeps donation links working. Successful status responses cache for 60 seconds; the page refreshes every 60 seconds.

Rules remain: an active live monthly USD plan created since October 28, 2026 at midnight in Tulum, with a processed unrefunded first payment, fills its $1–$31 square. Valid donor-paid fee metadata is excluded. Older renewals, one-time donations, tests and other campaigns do not fill squares. Cancellation or suspension releases a square unless another plan still fills it.

## Configuration and delivery verification

- Private Blob store: `feedtulum-calendar`, accessed using `BLOB_STORE_ID` and Vercel's automatically rotated OIDC identity. No static storage token is needed by the application.
- `CALENDAR_WEBHOOK_TOKEN_HASH` is the SHA-256 digest of a random receiver token. Donately's delivery URL includes the raw receiver token, which can only submit calendar events; it cannot access Donately, donors, refunds or bank accounts. Request URLs may appear in platform/provider logs. Never log bodies or secrets in application code.
- Required events: `account.donation.create.success`, `account.donation.update.success`, `account.subscription.update.success`, `account.subscription.recur.failure`. The receiver URL has `event` and `token` query parameters.
- Four webhooks are enabled. Registration succeeds using the API's default `2019-03-15` version: omit the `Donately-Version` header and use `account_id`, `hook`, `post_url`, and `title`. Explicitly requesting `2022-12-15` caused the dashboard/API version error. The personal token is needed only for setup, never for runtime delivery.
- Real Donately donation delivery was replayed successfully with HTTP 200. The event envelope uses `object_data`. Donation records contain only abbreviated subscription details; frequency and start date are absent. The receiver keeps first-payment updates, ignores renewal payments, and waits for the separate detailed subscription event before classifying a new calendar-sized commitment. Unknown frequency is not assumed to mean monthly.
- A real new $1–$31 monthly signup still needs end-to-end verification: Donately rejects `account.subscription.create.success`, and we have not proved that an initial signup emits `account.subscription.update.success`. Until that is proved or Donately supplies the missing details, activation does not establish automatic classification of every new signup. Pending eligible payments make public status unavailable rather than falsely available.
- A one-time baseline import uses only sanitized new subscriptions. No ongoing API polling is enabled. Tests of the provider path used reversible nonfinancial record updates; comments and metadata were restored. No payment or refund was submitted by the agent.

## Checks

Run `npm test` and `npm audit --omit=dev`. Tests cover amount/date rules, duplicate and delayed events, refunds, multiple supporters, authentication, privacy, size limits, conditional-write retries and the existing browser status behavior. For visual fixtures, run `node tests/preview-calendar.mjs filled` and open localhost:8766/calendar. Tests are excluded from deployment.

## Credential retirement

Remove the former Donately token from all Vercel environments and delete retired deployments that captured it. Scan local files and Git objects without displaying matches. Rotate the personal token in Donately to invalidate any inaccessible retained copies. Rotation may affect unrelated integrations using that same personal token. Never copy the replacement into this project.

Local cleanup and deployment deletion cannot prove erasure of third-party backups or inaccessible logs. Rotation is the effective revocation step. Browser policy requires the account holder to perform the final credential-change action.
