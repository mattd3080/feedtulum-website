import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, applyEvent, publicStatus, emptyState } from '../lib/calendar-events.mjs';

const time = Date.parse('2026-10-29T00:00:00Z');
const plan = (extra = {}) => ({ id: 'sub_test', object: 'subscription', account: { id: 'act_50d509c0c0b4' }, campaign: { id: 'cmp_164cd8d8b53b' }, created: time - 1000, updated: time, status: 'active', livemode: true, currency: 'usd', recurring_frequency: '1.month', amount_in_cents: 200, donation_parent: { id: 'dnt_test', status: 'processed', livemode: true, recurring: true, refunded: null, updated: time }, ...extra });
const event = (p) => normalizeEvent({ data: p }, 'account.subscription.update.success', time + 5000);
test('donor IDs become private fingerprints; totals deduplicate people without exposing identities', () => {
  const original = plan({ person: { id: 'person_alice', email: 'private@example.test' } });
  let state = applyEvent(emptyState(), event(original));
  state = applyEvent(state, event({ ...original, id: 'sub_second' }));
  state = applyEvent(state, event(plan({ id: 'sub_bob', person: { id: 'person_bob' } })));
  assert.deepEqual(publicStatus(state, time + 5000).supporterCounts, { 2: 2 });
  state = applyEvent(state, event(plan({ updated: time + 1000 })));
  assert.deepEqual(publicStatus(state, time + 5000).supporterCounts, { 2: 2 });
  assert.ok(!JSON.stringify(state).includes('person_alice'));
  assert.ok(!JSON.stringify(state).includes('private@example.test'));
  assert.deepEqual(Object.keys(publicStatus(state, time + 5000)).sort(), ['filledDays', 'supporterCounts', 'updatedAt']);
});
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
test('a new abbreviated signup counts immediately; later details do not double count and renewals are ignored', () => {
  const p={...plan().donation_parent,created:time,amount_in_cents:200,currency:'usd',account:plan().account,campaign:plan().campaign,parent:{},subscription:{id:'sub_test',status:'active',livemode:true,currency:'usd',amount_in_cents:200}};
  const normalized=normalizeEvent({object_data:p},'account.donation.create.success',time+5000);
  const pending=applyEvent(emptyState(),normalized);
  assert.deepEqual(publicStatus(pending,time+5000).supporterCounts,{2:1});
  assert.deepEqual(publicStatus(applyEvent(pending,event(plan())),time+5000).filledDays,[2]);
  const renewal=normalizeEvent({object_data:{...p,id:'dnt_renewal',parent:{id:'dnt_test'}}},'account.donation.create.success',time+5000);
  assert.deepEqual(renewal.payments,[]);
  const foreign=normalizeEvent({object_data:{...p,currency:'mxn'}},'account.donation.create.success',time+5000);
  assert.deepEqual(publicStatus(applyEvent(emptyState(),foreign),time+5000).filledDays,[]);
});

test('abbreviated signups fill all 31 amounts with three supporters without plan details', () => {
  let state = emptyState();
  for (let day = 1; day <= 31; day++) {
    for (let person = 1; person <= 3; person++) {
      const suffix = `${day}x${person}`;
      const p = { ...plan().donation_parent, id: `dnt_${suffix}`, created: time,
        amount_in_cents: day * 100, currency: 'usd', account: plan().account, campaign: plan().campaign,
        person: {id: `per_${suffix}`}, subscription: { id: `sub_${suffix}`, status: 'active' } };
      const paid = normalizeEvent({object_data:p}, 'account.donation.create.success', time+5000);
      state = applyEvent(applyEvent(state, paid), paid);
      assert.equal(publicStatus(state,time+5000).supporterCounts[day], person);
      // A second plan from the same person at the same amount adds no supporter.
      state = applyEvent(state, normalizeEvent({object_data:{...p,id:`dnt_other${suffix}`,subscription:{id:`sub_other${suffix}`}}}, 'account.donation.create.success', time+5000));
      assert.equal(publicStatus(state,time+5000).supporterCounts[day], person);
    }
  }
  assert.deepEqual(publicStatus(state,time+5000).supporterCounts, Object.fromEntries(Array.from({length:31},(_,i)=>[i+1,3])));
  assert.deepEqual(state.subscriptions, {});
});

test('abbreviated signup respects fees, refunds, eligibility and later plan status', () => {
  const p = { ...plan().donation_parent, created:time, amount_in_cents:1042, currency:'usd',
    meta_data:{'base-amount':1000,'donor-pays-fees':42},
    account:plan().account, campaign:plan().campaign, subscription:{id:'sub_test',status:'active'} };
  const paid = normalizeEvent({object_data:p},'account.donation.create.success',time+5000);
  const initial = applyEvent(emptyState(),paid);
  assert.deepEqual(publicStatus(initial,time+5000).supporterCounts,{10:1});
  for (const changes of [{created:time-86400000*2}, {created:time+6000}, {currency:'mxn'}, {amount_in_cents:3200}, {status:'pending'}, {refunded:1042}, {livemode:false}, {recurring:false}, {campaign:{id:'cmp_other'}}, {subscription:{id:'sub_test',status:'canceled'}}, {parent:{id:'dnt_older'}}]) {
    const ignored = normalizeEvent({object_data:{...p,...changes}},'account.donation.create.success',time+5000);
    assert.deepEqual(publicStatus(applyEvent(emptyState(),ignored),time+5000).supporterCounts,{},JSON.stringify(changes));
  }
  const refund = normalizeEvent({object_data:{...p, subscription:undefined, created:undefined, updated:time+1000, refunded:1042}},'account.donation.update.success',time+5000);
  const refunded = applyEvent(initial,refund);
  assert.deepEqual(publicStatus(applyEvent(refunded,paid),time+5000).supporterCounts,{});
  const canceled = event(plan({amount_in_cents:1000,recurring_frequency:undefined,donation_parent:undefined,status:'canceled',updated:time+1000}));
  for (const events of [[paid,canceled],[canceled,paid]]) {
    assert.deepEqual(publicStatus(events.reduce(applyEvent,emptyState()),time+5000).supporterCounts,{});
  }
  const moved = event(plan({amount_in_cents:1500,recurring_frequency:'1.year',donation_parent:undefined,updated:time+1000}));
  assert.deepEqual(publicStatus(applyEvent(initial,moved),time+5000).supporterCounts,{15:1});
});

test('a full plan without an explicit payment parent still counts its first payment', () => {
  const p = {...plan().donation_parent,account:plan().account,campaign:plan().campaign,subscription:plan({donation_parent:undefined})};
  const paid = normalizeEvent({object_data:p},'account.donation.create.success',time+5000);
  assert.deepEqual(publicStatus(applyEvent(emptyState(),paid),time+5000).supporterCounts,{2:1});
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
