import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import handler, { createHandler } from '../api/calendar-status.js';
import { createHandler as webhook } from '../api/donately-webhook.js';
import { updateState } from '../lib/calendar-store.mjs';
import { BlobPreconditionFailedError } from '@vercel/blob';

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
