// Start of October 28, 2026 in Tulum (UTC-5).
export const START_MS = Date.parse('2026-10-28T00:00:00-05:00');

export function getFilledDays(subscriptions, { accountId, campaignId, nowMs = Date.now() }) {
  const filled = new Set();
  for (const subscription of subscriptions) {
    const payment = subscription.donation_parent;
    if (subscription.account?.id !== accountId || subscription.campaign?.id !== campaignId ||
        !Number.isFinite(subscription.created) || subscription.created < START_MS || subscription.created > nowMs ||
        subscription.status !== 'active' || subscription.livemode !== true ||
        subscription.recurring_frequency !== '1.month' || subscription.currency !== 'usd' ||
        payment?.status !== 'processed' || payment.livemode !== true || payment.recurring !== true || payment.refunded) continue;

    let cents = subscription.amount_in_cents;
    const base = subscription.meta_data?.['base-amount'];
    const fees = subscription.meta_data?.['donor-pays-fees'];
    // Only trust fee metadata when it still describes the current subscription.
    if (Number.isInteger(base) && base > 0 && Number.isInteger(fees) && fees >= 0 && base + fees === cents) cents = base;
    if (Number.isInteger(cents) && cents >= 100 && cents <= 3100 && cents % 100 === 0) filled.add(cents / 100);
  }
  return [...filled].sort((a, b) => a - b);
}

export async function loadCalendarStatus({ token, accountId, campaignId, nowMs = Date.now(), fetchImpl = fetch }) {
  if (!token || !accountId || !campaignId) throw new Error('Calendar configuration missing');
  const subscriptions = [];
  const seen = new Set();
  const signal = AbortSignal.timeout(10000);
  for (let page = 0; page < 100; page++) {
    const url = new URL('https://api.donately.com/v2/subscriptions');
    url.search = new URLSearchParams({ account_id: accountId, limit: '100', offset: String(subscriptions.length) });
    const response = await fetchImpl(url, {
      signal,
      headers: {
        Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`,
        'Donately-Account': accountId,
        'Donately-Version': '2022-12-15',
      },
    });
    if (!response.ok) throw new Error('Donately request failed');
    const body = await response.json();
    const total = body.summary?.total_count;
    if (!Array.isArray(body.data) || !Number.isInteger(total) || total < 0) throw new Error('Invalid Donately response');
    for (const item of body.data) {
      if (!item?.id || seen.has(item.id)) throw new Error('Inconsistent Donately pagination');
      seen.add(item.id);
      subscriptions.push(item);
    }
    if (subscriptions.length === total) return {
      filledDays: getFilledDays(subscriptions, { accountId, campaignId, nowMs }),
      updatedAt: new Date(nowMs).toISOString(),
    };
    if (!body.data.length || subscriptions.length > total) throw new Error('Incomplete Donately response');
  }
  throw new Error('Donately pagination limit exceeded');
}
