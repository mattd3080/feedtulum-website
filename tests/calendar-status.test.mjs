import test from 'node:test';
import assert from 'node:assert/strict';
import { getFilledDays, getSupporterCounts, START_MS } from '../lib/calendar-status.mjs';

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

test('counts unique monthly supporters per amount, not duplicate plans or payment deliveries', () => {
  const alice = subscription({ id: 'sub_alice', supporterKey: 'alice' });
  const bob = subscription({ id: 'sub_bob', donation_parent: { ...subscription().donation_parent, supporterKey: 'bob' } });
  const carol = subscription({ id: 'sub_carol', supporterKey: 'carol' });
  const plans = [alice, bob, carol, alice, { ...alice, id: 'sub_secondAlice' }];
  assert.deepEqual(getSupporterCounts(plans, scope), { 2: 3 });
  assert.deepEqual(getSupporterCounts([...plans, { ...alice, amount_in_cents: 1500 }], scope), { 2: 3, 15: 1 });
  assert.deepEqual(getSupporterCounts([alice, bob, { ...carol, status: 'canceled' }], scope), { 2: 2 });
  assert.deepEqual(getSupporterCounts([alice, { ...bob, donation_parent: { ...bob.donation_parent, refunded: 200 } }], scope), { 2: 1 });
  assert.deepEqual(getSupporterCounts([subscription(), subscription()], scope), { 2: 1 });
});

