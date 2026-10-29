import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, applyEvent, publicStatus, emptyState } from '../lib/calendar-events.mjs';

const time = Date.parse('2026-10-29T00:00:00Z');
const plan = (extra = {}) => ({ id: 'sub_test', object: 'subscription', account: { id: 'act_50d509c0c0b4' }, campaign: { id: 'cmp_164cd8d8b53b' }, created: time - 1000, updated: time, status: 'active', livemode: true, currency: 'usd', recurring_frequency: '1.month', amount_in_cents: 200, donation_parent: { id: 'dnt_test', status: 'processed', livemode: true, recurring: true, refunded: null, updated: time }, ...extra });
const event = (p) => normalizeEvent({ data: p }, 'account.subscription.update.success', time + 5000);
test('accepts the Donately event envelope without retaining envelope or donor fields', () => {
  const normalized=normalizeEvent({id:'evt_example',type_string:'subscription.updated',api_version:'2019-03-15',created:time,object:'subscription',object_data:plan(),event_data:{event:'update'}},'account.subscription.update.success',time+5000);
  assert.deepEqual(publicStatus(applyEvent(emptyState(),normalized),time+5000).filledDays,[2]);
  assert.ok(!JSON.stringify(normalized).includes('evt_example'));
});
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
test('actual abbreviated donation payload updates a known first payment without inventing plan details', () => {
  const original=applyEvent(emptyState(),event(plan()));
  const payment={...plan().donation_parent,account:plan().account,campaign:plan().campaign,updated:time+1000,refunded:200,subscription:{id:'sub_test',status:'active',livemode:true,currency:'usd',amount_in_cents:200}};
  const normalized=normalizeEvent({object_data:payment,created:time+1000},'account.donation.update.success',time+5000);
  assert.deepEqual(normalized.subscriptions,[]);
  assert.deepEqual(publicStatus(applyEvent(original,normalized),time+5000).filledDays,[]);
});
test('a new abbreviated signup waits for plan details; later details fill it and old renewals are not retained', () => {
  const p={...plan().donation_parent,created:time,amount_in_cents:200,currency:'usd',account:plan().account,campaign:plan().campaign,parent:{},subscription:{id:'sub_test',status:'active',livemode:true,currency:'usd',amount_in_cents:200}};
  const normalized=normalizeEvent({object_data:p},'account.donation.create.success',time+5000);
  const pending=applyEvent(emptyState(),normalized);
  assert.throws(()=>publicStatus(pending,time+5000),/Awaiting recurring plan details/);
  assert.deepEqual(publicStatus(applyEvent(pending,event(plan())),time+5000).filledDays,[2]);
  const renewal=normalizeEvent({object_data:{...p,id:'dnt_renewal',parent:{id:'dnt_test'}}},'account.donation.create.success',time+5000);
  assert.deepEqual(renewal.payments,[]);
  const foreign=normalizeEvent({object_data:{...p,currency:'mxn'}},'account.donation.create.success',time+5000);
  assert.deepEqual(publicStatus(applyEvent(emptyState(),foreign),time+5000).filledDays,[]);
});
test('real plan notifications omit payment IDs: join both delivery orders and preserve refunds and cancellations', () => {
  const details=event(plan({donation_parent:undefined}));
  const p={...plan().donation_parent,created:time,amount_in_cents:200,currency:'usd',account:plan().account,campaign:plan().campaign,subscription:{id:'sub_test'}};
  const paid=normalizeEvent({object_data:p},'account.donation.create.success',time+5000);
  for (const events of [[details,paid],[paid,details]]) {
    let state=events.reduce(applyEvent,emptyState());
    assert.deepEqual(publicStatus(state,time+5000).filledDays,[2]);
    const withoutPlan=normalizeEvent({object_data:{...p,subscription:undefined,created:undefined,updated:time+500}},'account.donation.update.success',time+5000);
    state=applyEvent(state,withoutPlan);
    assert.deepEqual(publicStatus(state,time+5000).filledDays,[2]);
    const refunded=normalizeEvent({object_data:{...p,updated:time+1000,refunded:200}},'account.donation.update.success',time+5000);
    assert.deepEqual(publicStatus(applyEvent(state,refunded),time+5000).filledDays,[]);
    state=applyEvent(state,event(plan({donation_parent:undefined,status:'canceled',updated:time+1000})));
    assert.deepEqual(publicStatus(state,time+5000).filledDays,[]);
  }
  const baseline=applyEvent(emptyState(),event(plan()));
  const updated=applyEvent(baseline,event(plan({donation_parent:undefined,updated:time+1000})));
  assert.equal(updated.subscriptions.sub_test.parent,'dnt_test');
  assert.deepEqual(publicStatus(updated,time+5000).filledDays,[2]);
});
