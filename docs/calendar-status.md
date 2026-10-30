# Giving calendar status

The website makes no authenticated requests to Donately and needs no Donately API token. Donation links still preload the chosen monthly amount.

`POST /api/donately-webhook` accepts authenticated donation notifications, strips private donor fields and updates private Vercel Blob storage using conditional writes. `GET /api/calendar-status` returns only supporter counts by amount, legacy filled days and a timestamp. It returns 503 when storage is unavailable or not initialized; the page then hides the supporter legend and keeps donation links working. Successful status responses cache for 60 seconds; the page refreshes every 60 seconds.

Rules: count a new live recurring USD commitment since October 28, 2026 at midnight in Tulum, with a processed unrefunded first payment, at an exact $1–$31 amount. The user selected this simpler rule on October 29: any recurring frequency qualifies, and calendar attribution is not required. Donation links still default to monthly. Valid donor-paid fee metadata is excluded. Older renewals, one-time donations, tests and other campaigns do not fill squares. Cancellation or suspension releases a square unless another plan still fills it.

An abbreviated donation webhook is sufficient: its subscription ID and first-payment date/amount identify the commitment. A successful recurring payment counts unless its embedded plan status says it is inactive. Detailed plan notifications, when available, take precedence for current status, amount and original creation date. No frequency is inferred or required; missing detailed plan notifications no longer make the public endpoint unavailable. Delivery retries and renewals cannot add supporters.

## Supporter levels

The page uses cream for zero supporters, light green for one, deeper green for two, and a Santa illustration on green for three or more. Counts remain exact above three and are exposed in each link's accessible name and hover title. Every amount remains available to donate.

Count unique supporters per dollar amount, rather than payment events. When supplied, a Donately `person.id` is SHA-256 hashed with the account ID and only that fingerprint is stored privately; names, emails and raw person IDs are discarded. Duplicate active plans for that same fingerprint count once at the same amount. Subscriptions without donor identity, including older sanitized records, fall back to their unique subscription ID; distinct people cannot be established for those records. Missing identity in later updates does not erase a known fingerprint. Cancellation and first-payment refund recalculate the count; renewals and duplicate webhooks do not add supporters. No Donately API token or new provider access is required.

## Configuration and delivery verification

- Private Blob store: `feedtulum-calendar`, accessed using `BLOB_STORE_ID` and Vercel's automatically rotated OIDC identity. No static storage token is needed by the application.
- `CALENDAR_WEBHOOK_TOKEN_HASH` is the SHA-256 digest of a random receiver token. Donately's delivery URL includes the raw receiver token, which can only submit calendar events; it cannot access Donately, donors, refunds or bank accounts. Request URLs may appear in platform/provider logs. Never log bodies or secrets in application code.
- Required events: `account.donation.create.success`, `account.donation.update.success`, `account.subscription.update.success`, `account.subscription.recur.failure`. The receiver URL has `event` and `token` query parameters.
- Four webhooks are enabled. Registration succeeds using the API's default `2019-03-15` version: omit the `Donately-Version` header and use `account_id`, `hook`, `post_url`, and `title`. Explicitly requesting `2022-12-15` caused the dashboard/API version error. The personal token is needed only for setup, never for runtime delivery.
- Real Donately donation delivery was replayed successfully with HTTP 200. The event envelope uses `object_data`. Donation records contain only abbreviated subscription details; frequency and start date are absent. Actual subscription-update notifications include those fields but omit `donation_parent`. The receiver joins notifications by subscription ID in either arrival order, preserves known original-payment IDs, and ignores renewal payments. It can count a first recurring payment before any detailed subscription notification arrives.
- On October 29, a real new $10 monthly signup exposed two independent problems. The donation notification failed with HTTP 503 because compressed Blob reads returned weak ETags that conditional writes rejected. Reads now request `Accept-Encoding: identity`; replay of the same payment succeeded with HTTP 200, preserving conditional-write concurrency protection.
- That signup produced no subscription-update notification. The $10 plan was initially verified in the Donately dashboard and manually reconciled through the receiver. The simpler recurring-commitment rule now removes this dependency for future signups: a new successful recurring donation can count on its own. Tests exercise the observed abbreviated payload shape through the authenticated handler, storage write and public status, including replay deduplication. No test charge is needed or submitted.
- A one-time baseline import uses only sanitized new subscriptions. No ongoing API polling is enabled. Tests of the provider path used reversible nonfinancial record updates; comments and metadata were restored. No payment or refund was submitted by the agent.

## Checks

Run `npm test` and `npm audit --omit=dev`. Tests cover amount/date rules, duplicate and delayed events, refunds, multiple supporters, authentication, privacy, size limits, conditional-write retries and the existing browser status behavior. For visual fixtures, run `node tests/preview-calendar.mjs filled` and open localhost:8766/calendar. Tests are excluded from deployment.

## Credential retirement

Remove the former Donately token from all Vercel environments and delete retired deployments that captured it. Scan local files and Git objects without displaying matches. Rotate the personal token in Donately to invalidate any inaccessible retained copies. Rotation may affect unrelated integrations using that same personal token. Never copy the replacement into this project.

Local cleanup and deployment deletion cannot prove erasure of third-party backups or inaccessible logs. Rotation is the effective revocation step. Browser policy requires the account holder to perform the final credential-change action.
