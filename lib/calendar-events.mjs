import { createHash } from 'node:crypto';
import { getSupporterCounts, START_MS } from './calendar-status.mjs';

export const ACCOUNT = 'act_50d509c0c0b4';
export const CAMPAIGN = 'cmp_164cd8d8b53b';
export const EVENTS = ['account.donation.create.success', 'account.donation.update.success', 'account.subscription.update.success', 'account.subscription.recur.failure'];
export const emptyState = () => ({ version: 1, subscriptions: {}, payments: {} });
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[a-zA-Z0-9]+$`).test(value) ? value : null;
const timestamp = (value) => typeof value === 'number' ? value : Date.parse(value);
function supporterKey(record) {
  const person = record.person?.id;
  return typeof person === 'string' && person.length > 0 && person.length <= 128
    ? createHash('sha256').update(`${ACCOUNT}:${person}`).digest('hex') : null;
}
function version(record, now) {
  const value = timestamp(record.updated ?? record.updated_at ?? record.created ?? record.created_at ?? record.donation_date);
  if (!Number.isFinite(value) || value > now + 300000 || value < 0) throw new Error('Missing record timestamp');
  return value;
}
function payment(record, now) {
  if (!id(record.id, 'dnt') || typeof record.status !== 'string' || typeof record.livemode !== 'boolean' || typeof record.recurring !== 'boolean') throw new Error('Invalid donation');
  return { id: record.id, updated: version(record, now), status: record.status, livemode: record.livemode, recurring: record.recurring, refunded: Boolean(record.refunded), supporterKey: supporterKey(record) };
}
function subscription(record, now) {
  const created = timestamp(record.created ?? record.created_at);
  if (!id(record.id, 'sub') || !Number.isFinite(created) || typeof record.status !== 'string' || typeof record.livemode !== 'boolean' || !Number.isInteger(record.amount_in_cents) || typeof record.currency !== 'string' || typeof (record.recurring_frequency ?? record.frequency) !== 'string') throw new Error('Invalid subscription');
  const parent = id(record.donation_parent?.id ?? record.donation_parent_id, 'dnt');
  const meta = record.meta_data;
  return {
    id: record.id, updated: version(record, now), created, supporterKey: supporterKey(record),
    status: record.status, livemode: record.livemode, currency: record.currency.toLowerCase(),
    recurring_frequency: record.recurring_frequency ?? (record.frequency === 'monthly' ? '1.month' : record.frequency),
    amount_in_cents: record.amount_in_cents, parent,
    meta_data: { 'base-amount': Number.isInteger(meta?.['base-amount']) ? meta['base-amount'] : null, 'donor-pays-fees': Number.isInteger(meta?.['donor-pays-fees']) ? meta['donor-pays-fees'] : null },
  };
}

// Explicitly supported envelopes; reject unfamiliar data so Donately records a failed delivery.
export function normalizeEvent(body, eventType, now = Date.now()) {
  if (!EVENTS.includes(eventType) || !body || typeof body !== 'object') throw new Error('Unsupported event');
  let record = body.object_data ?? body.data ?? body;
  if (Array.isArray(record) && record.length === 1) record = record[0];
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid event');
  const account = record.account?.id ?? record.account_id;
  const campaign = record.campaign?.id ?? record.campaign_id;
  if (!id(account, 'act')) throw new Error('Missing account');
  if (account !== ACCOUNT || (campaign && campaign !== CAMPAIGN) || record.livemode === false) return null;
  if (campaign !== CAMPAIGN) throw new Error('Missing campaign');
  const result = { subscriptions: [], payments: [] };
  if (eventType.startsWith('account.subscription.')) {
    const sub = subscription(record, now);
    result.subscriptions.push(sub);
    if (record.donation_parent?.status) result.payments.push(payment(record.donation_parent, now));
  } else {
    if (record.recurring === false) return null;
    result.payments.push(payment(record, now));
    if (record.recurring === true) {
      const sub = record.subscription;
      if (!sub || typeof sub !== 'object') {
        if (eventType === 'account.donation.update.success') return result;
        throw new Error('Missing subscription details');
      }
      const subAccount = sub.account?.id ?? sub.account_id;
      const subCampaign = sub.campaign?.id ?? sub.campaign_id;
      if ((subAccount && subAccount !== ACCOUNT) || (subCampaign && subCampaign !== CAMPAIGN)) throw new Error('Mismatched subscription');
      // Donation webhooks carry an abbreviated subscription. Keep the payment
      // update; the subscription webhook supplies frequency and start date.
      if (sub.created == null && sub.created_at == null) {
        if (!id(sub.id, 'sub')) throw new Error('Missing subscription ID');
        // Renewals point to their original payment. Only that original payment
        // is used by the calendar, so do not retain every monthly charge.
        if (id(record.parent?.id, 'dnt') && record.parent.id !== record.id) return { subscriptions: [], payments: [] };
        const first = result.payments[0];
        first.subscriptionId = sub.id;
        first.created = timestamp(record.created ?? record.created_at ?? record.donation_date);
        let cents = record.amount_in_cents;
        const base = record.meta_data?.['base-amount'];
        const fees = record.meta_data?.['donor-pays-fees'];
        if (Number.isInteger(base) && Number.isInteger(fees) && fees >= 0 && base + fees === cents) cents = base;
        first.calendarLevel = record.currency?.toLowerCase() === 'usd' && Number.isInteger(cents) && cents >= 100 && cents <= 3100 && cents % 100 === 0 ? cents / 100 : null;
        return result;
      }
      const normalized = subscription(sub, now);
      result.subscriptions.push(normalized);
      if (record.id !== normalized.parent) result.payments = [];
      if (sub.donation_parent?.status) result.payments.push(payment(sub.donation_parent, now));
    }
  }
  return result;
}

export function applyEvent(state, event) {
  const next = structuredClone(state);
  if (!event) return next;
  for (const kind of ['subscriptions', 'payments']) {
    for (const item of event[kind]) {
      const previous = next[kind][item.id];
      // A duplicate or older active snapshot must never revive an inactive/refunded record.
      const inactive = kind === 'subscriptions' ? item.status !== 'active' : item.refunded || item.status !== 'processed';
      if (!previous || item.updated > previous.updated || (item.updated === previous.updated && inactive)) {
        const identified = { ...item, supporterKey: item.supporterKey ?? previous?.supporterKey ?? null };
        if (kind === 'payments' && previous) {
          next[kind][item.id] = { ...previous, ...identified, subscriptionId: item.subscriptionId ?? previous.subscriptionId, created: Number.isFinite(item.created) ? item.created : previous.created };
        } else {
          next[kind][item.id] = kind === 'subscriptions' && !item.parent && previous?.parent ? { ...identified, parent: previous.parent } : identified;
        }
      }
    }
  }
  return next;
}

export function publicStatus(state, now = Date.now()) {
  if (state?.version !== 1 || !state.subscriptions || !state.payments) throw new Error('Invalid stored state');
  // A newly paid plan may arrive before its detailed subscription event. Do
  // not claim the square is available while its frequency is still unknown.
  for (const payment of Object.values(state.payments)) {
    if (payment.subscriptionId && payment.calendarLevel && payment.created >= START_MS && payment.created <= now && payment.status === 'processed' && payment.livemode === true && !payment.refunded && !state.subscriptions[payment.subscriptionId]) throw new Error('Awaiting recurring plan details');
  }
  // Plan webhooks omit donation_parent. Join them to the first non-renewal
  // donation notification by subscription ID, in either delivery order.
  const firstPayments = new Map();
  for (const payment of Object.values(state.payments)) {
    if (!payment.subscriptionId || !Number.isFinite(payment.created)) continue;
    const previous = firstPayments.get(payment.subscriptionId);
    if (!previous || payment.created < previous.created) firstPayments.set(payment.subscriptionId, payment);
  }
  const subscriptions = Object.values(state.subscriptions).map(sub => ({ ...sub, account: { id: ACCOUNT }, campaign: { id: CAMPAIGN }, donation_parent: sub.parent ? state.payments[sub.parent] : firstPayments.get(sub.id) }));
  const supporterCounts = getSupporterCounts(subscriptions, { accountId: ACCOUNT, campaignId: CAMPAIGN, nowMs: now });
  return { supporterCounts, filledDays: Object.keys(supporterCounts).map(Number), updatedAt: new Date(now).toISOString() };
}
