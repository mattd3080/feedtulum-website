import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import handler, { createHandler } from '../api/calendar-status.js';
import { createHandler as webhook } from '../api/donately-webhook.js';
import { readState, updateState } from '../lib/calendar-store.mjs';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { emptyState, publicStatus } from '../lib/calendar-events.mjs';

const response = () => ({ headers: {}, code: 200, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } });
test('public endpoint rejects writes and query parameters, never exposes storage errors', async () => {
  for (const [method, url, code] of [['POST','/api/calendar-status',405], ['GET','/api/calendar-status?refresh=1',400], ['GET','/api/calendar-status',503]]) {
    const res = response(); await handler({ method, url }, res); assert.equal(res.code, code);
  }
  const res = response();
  await createHandler(async () => { throw new Error('private@example.test secret'); })({method:'GET',url:'/api/calendar-status'},res);
  assert.equal(res.headers['Cache-Control'],'no-store'); assert.ok(!JSON.stringify(res).includes('private'));
  const good = response();
  await createHandler(async () => ({filledDays:[2],updatedAt:'2026-10-29T00:00:00Z'}))({method:'GET',url:'/api/calendar-status'},good);
  assert.deepEqual(Object.keys(good.body).sort(), ['filledDays','updatedAt']);
});
test('webhook rejects unauthenticated, malformed and oversized deliveries without writing', async () => {
  const token = 'a'.repeat(64);
  process.env.CALENDAR_WEBHOOK_TOKEN_HASH = createHash('sha256').update(token).digest('hex');
  let writes = 0; const receive = webhook(async () => { writes++; });
  for (const [query, body, code] of [['token=bad',{},401],[`token=${token}&event=bad`,{},400],[`token=${token}&event=account.donation.create.success`,{},422],[`token=${token}&event=account.donation.create.success`,'x'.repeat(131073),413]]) {
    const res = response(); await receive({method:'POST',url:`/api/donately-webhook?${query}`,body},res); assert.equal(res.code,code);
  }
  assert.equal(writes,0); delete process.env.CALENDAR_WEBHOOK_TOKEN_HASH;
});
test('conditional storage retry re-reads state instead of overwriting another delivery', async () => {
  process.env.BLOB_STORE_ID = 'store_test';
  let reads = 0, writes = 0;
  await updateState({subscriptions:[],payments:[]}, {
    read: async () => ({state:{version:1,subscriptions:{},payments:{}},etag:`v${++reads}`}),
    write: async (_path,_body,options) => { assert.equal(options.ifMatch,`v${reads}`); if (++writes === 1) throw new BlobPreconditionFailedError(); },
  });
  assert.equal(reads,2); assert.equal(writes,2); delete process.env.BLOB_STORE_ID;
});
test('storage reads request an uncompressed representation for a usable conditional-write ETag', async () => {
  process.env.BLOB_STORE_ID = 'store_test';
  try {
    const stored = await readState({ fetchBlob: async (_path, options) => ({
      statusCode: 200,
      stream: new Response(JSON.stringify({version:1,subscriptions:{},payments:{}})).body,
      blob: { etag: options.headers?.['Accept-Encoding'] === 'identity' ? '"revision1"' : 'W/"revision1"' },
    }) });
    assert.equal(stored.etag, '"revision1"');
  } finally { delete process.env.BLOB_STORE_ID; }
});

test('a recurring payment with no frequency travels through webhook, storage and public status once', async () => {
  const token = 'b'.repeat(64);
  process.env.CALENDAR_WEBHOOK_TOKEN_HASH = createHash('sha256').update(token).digest('hex');
  process.env.BLOB_STORE_ID = 'store_test';
  let state = emptyState(), revision = 0;
  const receive = webhook(event => updateState(event, {
    read: async () => ({state,etag:String(revision)}),
    write: async (_path,body,options) => { assert.equal(options.ifMatch,String(revision)); state=JSON.parse(body); revision++; },
  }));
  const body = { object_data: {
    id:'dnt_example',created:Date.parse('2026-10-29T10:00:00-05:00'),status:'processed',livemode:true,
    amount_in_cents:1000,currency:'usd',recurring:true,refunded:null,
    account:{id:'act_50d509c0c0b4'},campaign:{id:'cmp_164cd8d8b53b'},
    person:{id:'per_example',email:'private@example.test'},
    subscription:{id:'sub_example',status:'active',livemode:true,amount_in_cents:1000,currency:'usd'},
  } };
  try {
    for (let replay=0; replay<2; replay++) {
      const res=response();
      await receive({method:'POST',url:`/api/donately-webhook?token=${token}&event=account.donation.create.success`,body},res);
      assert.equal(res.code,200);
      const status=response();
      await createHandler(async()=>publicStatus(state))({method:'GET',url:'/api/calendar-status'},status);
      assert.equal(status.code,200);
      assert.deepEqual(status.body.supporterCounts,{10:1});
      assert.ok(!JSON.stringify(state).includes('private@example.test'));
    }
    assert.deepEqual(state.subscriptions,{});
  } finally { delete process.env.CALENDAR_WEBHOOK_TOKEN_HASH; delete process.env.BLOB_STORE_ID; }
});
