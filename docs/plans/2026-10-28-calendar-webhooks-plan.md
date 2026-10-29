---
title: Replace calendar API access with donation webhooks
date: 2026-10-28
type: refactor
---

## Product contract

Keep the existing calendar and preloaded monthly donation links. Replace server-side Donately API polling with incoming donation notifications. Remove the broad Donately credential from the website and deployment settings; invalidate the old credential through rotation.

- R1: New paid, active monthly USD commitments since October 28 in Tulum fill the matching $1–$31 square. Preserve fee handling and exclude old renewals, tests, other campaigns and one-time gifts.
- R2: Cancellations, suspensions and refunds release a square unless another qualifying commitment fills it. Duplicate or delayed notifications must not corrupt the result.
- R3: Public responses contain only filled days and a timestamp. Persist only the necessary financial status fields and opaque record IDs, never names, emails, payment details, raw payloads or the Donately API token.
- R4: Remove old token configuration, local copies and token-bearing deployments. Audit tracked history and accessible logs without printing secrets. Do not claim provider backups or inaccessible logs have been erased.

## Technical decisions

- KTD1 (user-directed): Direct Donately webhooks replace API polling. No email mailbox or Zapier connection is needed.
- KTD2: Private Vercel Blob stores one compact state document, with conditional writes and uncached reads to prevent lost concurrent updates. Prefer short-lived Vercel OIDC over a static storage key.
- KTD3: Donately does not document signed deliveries. Use an unguessable receiver token, storing only its SHA-256 digest in the website environment. This token can update calendar state but cannot access Donately or issue refunds. Donately/platform request logs may contain its URL, so it is not equivalent to a scoped financial credential.
- KTD4: Preserve provider record timestamps, ignore older versions and favor inactive/refunded status on version ties. No browser-supplied success redirect can fill a square.

## Implementation units

1. U1: Implement and test sanitized event normalization, state reduction, authenticated receiver, conditional persistence and the existing public status contract. Remove outgoing Donately calls. Test unsupported payloads explicitly rather than guessing successful updates.
2. U2: Register donation-created, donation-updated, recurring-plan-updated and recurring-failure webhooks. Verify storage and receiver with synthetic fixtures and cleanup. Inspect a real Donately delivery if available; a fixture is not proof of the provider payload contract.
3. U3: Deploy and verify the website, remove the old environment variable and retired token-bearing deployments, scan local files/Git/accessibly retained logs, and complete token rotation or hand off the credential-change click if browser policy requires it.

## Verification and rollout

Use existing filtering and UI tests as characterization, then add duplicate, stale event, cancellation, refund, multiple-supporter, authentication, size-limit, persistence-conflict and privacy tests. Check npm audit, production endpoint responses and unchanged donation links. Establish the existing empty calendar baseline only after confirming live status and enabling event capture. On storage/format failure, return an error rather than falsely reporting successful processing; retain ordinary donation links.

Donately's published webhook guide documents events and retry/resend controls but not a complete payload schema or signing secret. Real delivery acceptance remains a launch check; report any unverified part precisely. Do not generate a real charge or refund for testing.

## Definition of done

The deployed website uses stored webhook state with no Donately API credential; hooks and tests work; old project credentials/deployments and local copies are removed; the old token is rotated. Any provider-side retention, unavailable live-event test, or required user rotation action is reported as outstanding rather than marked complete.

Sources: https://support.donately.com/help/webhooks ; https://vercel.com/docs/vercel-blob/using-blob-sdk
