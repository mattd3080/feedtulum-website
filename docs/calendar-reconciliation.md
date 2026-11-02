# Daily calendar reconciliation

Eligible pending first payments count for seven days from their original creation time. Completion keeps the supporter; failure, refund or inactive plan removes them. Pending records expire automatically even if this task cannot run. A late confirmed payment restores the supporter. Notification retries cannot restart the grace period.

## Procedure

Use the logged-in Codex browser, account `act_50d509c0c0b4`, campaign `cmp_164cd8d8b53b`. No Donately API token is needed. If login expires, report the blocked check without guessing or claiming success. Scheduled browser work depends on the local Codex environment being available.

1. Read `https://www.feedtulum.com/api/calendar-status` for starting counts.
2. Inspect `https://admin.donately.com/act_50d509c0c0b4/subscriptions`, all statuses and every page. Verify each Feed Tulum plan's original **Started** date, status, amount and campaign. Record older plans too: donation payloads can omit both the parent ID and plan start date. Plans started before October 28, 2026 in Tulum remain excluded, even with later renewals. Eligible amounts are whole USD $1–$31 before verified donor-paid fees; any recurring frequency qualifies. One-time gifts, tests and other campaigns remain excluded.
3. For each potentially eligible plan, follow its initial donation from plan activity. Verify current processed/pending/failed/refunded status, recurring flag, original date and amount. Inspect recent donations since the last check to catch missed deliveries. Do not infer payment completion from an active plan. Paginate until coverage is complete. Never charge, refund, edit plans or change donor details. Report unclear or missing records instead of guessing.
4. Inspect Integrations → Webhooks delivery logs for failures. Visible payloads supply exact timestamps, fee metadata and person IDs for deduplication. Keep them in memory; never print raw payloads, names, emails or payment details. An old delivery does not establish current payment status.
5. Submit dashboard-verified snapshots to our receiver with `scripts/reconcile-calendar.mjs`. Read the receiver URL from the existing webhook's **POST URL**, keep it in memory, and pass JSON through subprocess stdin. Never put the URL/token in command arguments, source, files, logs or automation prompts. Never retrieve or store a Donately API key. This modifies only calendar storage.
6. Verify public counts after the 60-second cache expires, then inspect `/calendar`. Compare with unique eligible supporters from the dashboard. Record check time, aggregate counts, coverage, corrections and unresolved issues in a local audit note outside Git. Identical snapshots must not add supporters.

## Snapshot format

Call `node scripts/reconcile-calendar.mjs` through a subprocess, passing an in-memory JSON string as stdin. Input has `receiverUrl` and `snapshots`. Each snapshot includes:

- `kind`: `subscription` or `payment`; `id`: real provider ID.
- `observedAt`: ISO timestamp when dashboard verification completed, within one hour.
- `created`: original milliseconds/ISO timestamp. If a plan UI gives only a date, use midnight `-05:00` on that date. Never substitute a renewal date.
- `status`: current lowercase status (`Cancelled` → `canceled`); `amount_in_cents`; `currency: "usd"`; `verifiedLive: true` after verifying live account/campaign.
- Optional `baseAmount` and `fees`, in cents, only when verified and summing to the charge. Optional `personId` from visible payloads: the receiver hashes it; never print or save it locally. Omit unknown identity; existing fingerprints survive.
- Subscription: optional `parentId` of its initial donation, verified from plan activity.
- Payment: `subscriptionId`, `verifiedRecurring: true`, verified boolean `refunded`. Never substitute a renewal for the initial payment.

All snapshots validate before sending. Network/HTTP failure reports partial completion; stop and report it. Retry after verification. The script pins the website receiver, rejects redirects and logs no secrets. It is excluded from deployment. These are reconciliation snapshots (`updated = observedAt`), not fabricated provider deliveries.

## Alerts and limitations

Stay quiet when verification succeeds without meaningful change. Notify Matt of corrected counts, removed failed/expired gifts, login expiry, delivery failures or incomplete coverage. Seven-day expiry is a display rule, not proof the bank rejected a payment. Keep checking expired pending records for later completion.

Browser reconciliation is not a guaranteed always-on sync. Missing notifications can leave counts stale until a successful check. Counts represent commitments, not a monthly payment ledger: a failed renewal removes the commitment when its plan becomes inactive. Do not remove a confirmed active commitment solely because a later renewal is pending.
