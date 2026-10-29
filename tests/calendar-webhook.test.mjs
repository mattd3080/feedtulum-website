import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, applyEvent, publicStatus, emptyState } from '../lib/calendar-events.mjs';

const time = Date.parse('2026-10-29T00:00:00Z');
const plan = (extra = {}) => ({ id: 'sub_test', object: 'subscription', account: { id: 'act_50d509c0c0b4' }, campaign: { id: 'cmp_164cd8d8b53b' }, created: time - 1000, updated: time, status: 'active', livemode: true, currency: 'usd', recurring_frequency: '1.month', amount_in_cents: 200, donation_parent: { id: 'dnt_test', status: 'processed', livemode: true, recurring: true, refunded: null, updated: time }, ...extra });
const event = (p) => normalizeEvent({ data: p }, 'account.subscription.update.success', time + 5000);
test('paid monthly plan fills its square, duplicate and stale events cannot undo cancellation', () => {
  let state = applyEvent(emptyState(), event(plan()));
  assert.deepEqual(publicStatus(state, time + 5000).filledDays, [2]);
  state = applyEvent(state, event(plan({ status: 'canceled', updated: time + 1000 })));
  state = applyEvent(state, event(plan()));
  assert.deepEqual(publicStatus(state, time + 5000).filledDays, []);
});
test('another supporter keeps a refunded square filled; sanitized records omit private data', () => {
  let state = applyEvent(emptyState(), event(plan({ person: { email: 'private@example.test' }, api_token: 'private' })));
  const refund = { ...plan().donation_parent, object: 'donation', account: plan().account, campaign: plan().campaign, updated: time + 1000, refunded: 200 };
  state = applyEvent(state, normalizeEvent({ data: refund }, 'account.donation.update.success', time + 5000));
  assert.deepEqual(publicStatus(state, time + 5000).filledDays, []);
  state = applyEvent(state, event(plan({ id: 'sub_other', donation_parent: { ...plan().donation_parent, id: 'dnt_other' } })));
  assert.deepEqual(publicStatus(state, time + 5000).filledDays, [2]);
  assert.ok(!JSON.stringify(state).includes('private'));
});
test('unknown payloads fail explicitly, unrelated accounts are ignored', () => {
  assert.throws(() => event({ id: 'sub_test' }));
  assert.equal(event(plan({ account: { id: 'act_other' } })), null);
});
test('one-time gifts and renewal payment bodies are not retained', () => {
  const payment = { ...plan().donation_parent, account: plan().account, campaign: plan().campaign };
  assert.equal(normalizeEvent({data:{...payment,recurring:false}},'account.donation.create.success',time+5000),null);
  const renewal = normalizeEvent({data:{...payment,id:'dnt_renewal',subscription:plan()}},'account.donation.create.success',time+5000);
  assert.deepEqual(renewal.payments.map(p=>p.id),['dnt_test']);
});
