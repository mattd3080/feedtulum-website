// Start of October 28, 2026 in Tulum (UTC-5).
export const START_MS = Date.parse('2026-10-28T00:00:00-05:00');

export function getSupporterCounts(subscriptions, { accountId, campaignId, nowMs = Date.now() }) {
  const supporters = new Map();
  for (const subscription of subscriptions) {
    const payment = subscription.donation_parent;
    if (subscription.account?.id !== accountId || subscription.campaign?.id !== campaignId ||
        !Number.isFinite(subscription.created) || subscription.created < START_MS || subscription.created > nowMs ||
        subscription.status !== 'active' || subscription.livemode !== true ||
        subscription.currency !== 'usd' ||
        payment?.status !== 'processed' || payment.livemode !== true || payment.recurring !== true || payment.refunded) continue;

    let cents = subscription.amount_in_cents;
    const base = subscription.meta_data?.['base-amount'];
    const fees = subscription.meta_data?.['donor-pays-fees'];
    // Only trust fee metadata when it still describes the current subscription.
    if (Number.isInteger(base) && base > 0 && Number.isInteger(fees) && fees >= 0 && base + fees === cents) cents = base;
    if (Number.isInteger(cents) && cents >= 100 && cents <= 3100 && cents % 100 === 0) {
      const day = cents / 100;
      const supporter = subscription.supporterKey ?? payment.supporterKey ?? subscription.id;
      if (!supporter) continue;
      if (!supporters.has(day)) supporters.set(day, new Set());
      supporters.get(day).add(supporter);
    }
  }
  return Object.fromEntries([...supporters].sort(([a], [b]) => a - b).map(([day, people]) => [day, people.size]));
}

export function getFilledDays(subscriptions, scope) {
  return Object.keys(getSupporterCounts(subscriptions, scope)).map(Number);
}

