import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReconciliation, reconcile } from '../scripts/reconcile-calendar.mjs';

const input = () => ({receiverUrl:`https://www.feedtulum.com/api/donately-webhook?token=${'a'.repeat(64)}`,
  snapshots:[{kind:'payment',id:'dnt_test',subscriptionId:'sub_test',created:Date.parse('2026-11-01T10:00:00-05:00'),observedAt:new Date().toISOString(),status:'processed',amount_in_cents:3100,currency:'usd',verifiedLive:true,verifiedRecurring:true,refunded:false}]});
test('reconciliation validates every snapshot before sending, strips private fields and pins the receiver', async () => {
  const batch=input();
  batch.snapshots[0].email='private@example.test';
  assert.ok(!JSON.stringify(prepareReconciliation(batch)).includes('private@example.test'));
  assert.equal(prepareReconciliation(batch)[0].body.object_data.status,'processed');
  for (const receiverUrl of ['https://example.com/api/donately-webhook?token='+'a'.repeat(64),'https://www.feedtulum.com/other?token='+'a'.repeat(64)]) {
    assert.throws(()=>prepareReconciliation({...batch,receiverUrl}));
  }
  let writes=0;
  await assert.rejects(reconcile({...batch,snapshots:[batch.snapshots[0],{...batch.snapshots[0],verifiedLive:false}]},async()=>{writes++;}));
  assert.equal(writes,0);
  assert.throws(()=>prepareReconciliation({...batch,snapshots:[{...batch.snapshots[0],observedAt:'2026-10-01'}]}));
});
test('reconciliation reports partial failure without leaking URLs or provider errors', async () => {
  const batch=input(); batch.snapshots.push({...batch.snapshots[0],id:'dnt_second'});
  let calls=0;
  await assert.rejects(reconcile(batch,async()=>{
    if (++calls===2) throw new Error(batch.receiverUrl);
    return {ok:true,json:async()=>({received:true})};
  }), {message:'Reconciliation stopped: 1/2 snapshots saved. Verify and retry the remaining batch.'});
});
