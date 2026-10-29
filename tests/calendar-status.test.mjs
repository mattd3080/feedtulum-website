import test from 'node:test';
import assert from 'node:assert/strict';
import { getFilledDays, loadCalendarStatus, START_MS } from '../lib/calendar-status.mjs';

const scope = { accountId: 'act_test', campaignId: 'cmp_test', nowMs: Date.parse('2026-10-29T00:00:00Z') };
const subscription = (changes = {}) => ({
  id: 'sub_test', account: { id: scope.accountId }, campaign: { id: scope.campaignId },
  created: START_MS, status: 'active', livemode: true, currency: 'usd',
  recurring_frequency: '1.month', amount_in_cents: 200,
  donation_parent: { id: 'dnt_test', status: 'processed', livemode: true, recurring: true, refunded: null },
  meta_data: null, ...changes,
});

test('fills exact monthly dollar levels once, including both ends of the calendar', () => {
  assert.deepEqual(getFilledDays([subscription(), subscription(), subscription({ amount_in_cents: 100 }), subscription({ amount_in_cents: 3100 })], scope), [1, 2, 31]);
});

test('requires a new, paid, active monthly commitment for this account and campaign', () => {
  const excluded = [
    { created: START_MS - 1 }, { created: scope.nowMs + 1 }, { status: 'canceled' }, { status: 'suspended' },
    { recurring_frequency: '1.year' }, { currency: 'mxn' }, { livemode: false },
    { account: { id: 'act_other' } }, { campaign: { id: 'cmp_other' } },
    { amount_in_cents: 99 }, { amount_in_cents: 3200 }, { amount_in_cents: 250 },
    { donation_parent: { status: 'pending', livemode: true, recurring: true } },
    { donation_parent: { status: 'processed', livemode: true, recurring: true, refunded: 200 } },
    { donation_parent: { status: 'processed', livemode: false, recurring: true } },
  ];
  assert.deepEqual(getFilledDays(excluded.map(subscription), scope), []);
});

test('matches the gift before optional fees and rejects stale fee metadata', () => {
  assert.deepEqual(getFilledDays([subscription({ amount_in_cents: 242, meta_data: { 'base-amount': 200, 'donor-pays-fees': 42 } })], scope), [2]);
  assert.deepEqual(getFilledDays([subscription({ amount_in_cents: 300, meta_data: { 'base-amount': 200, 'donor-pays-fees': 42 } })], scope), [3]);
});

test('uses the start of October 28 in Tulum and keeps older renewals out', () => {
  assert.equal(START_MS, Date.parse('2026-10-28T00:00:00-05:00'));
  assert.deepEqual(getFilledDays([subscription({ created: START_MS - 86400000, updated: scope.nowMs })], scope), []);
});

test('reads all pages and returns only public calendar data', async () => {
  let calls = 0;
  const result = await loadCalendarStatus({ ...scope, token: 'private-test-token', fetchImpl: async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.donately.com');
    assert.equal(parsed.searchParams.get('account_id'), scope.accountId);
    assert.match(init.headers.Authorization, /^Basic /);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(parsed.pathname, '/v2/subscriptions');
    assert.equal(parsed.searchParams.get('offset'), String(calls));
    const item = subscription({ id: `sub_${calls}`, amount_in_cents: calls++ === 0 ? 200 : 3100, person: { email: 'private@example.test' } });
    return { ok: true, json: async () => ({ data: [item], summary: { total_count: 2 } }) };
  }});
  assert.equal(calls, 2);
  assert.deepEqual(result.filledDays, [2, 31]);
  assert.deepEqual(Object.keys(result).sort(), ['filledDays', 'updatedAt']);
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('upstream failures and incomplete pages cannot report empty availability', async () => {
  for (const response of [
    { ok: false, status: 401 },
    { ok: true, json: async () => ({ data: [], summary: { total_count: 1 } }) },
    { ok: true, json: async () => ({ unexpected: true }) },
  ]) {
    await assert.rejects(loadCalendarStatus({ ...scope, token: 'test', fetchImpl: async () => response }));
  }
});
