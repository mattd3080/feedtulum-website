import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/calendar-status.js';

function response() {
  return {
    headers: {}, code: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('endpoint rejects writes and never caches unavailable status', async () => {
  const write = response();
  await handler({ method: 'POST' }, write);
  assert.equal(write.code, 405);
  assert.equal(write.headers.Allow, 'GET');
  const saved = process.env.DONATELY_API_TOKEN;
  delete process.env.DONATELY_API_TOKEN;
  try {
    const read = response();
    await handler({ method: 'GET', url: '/api/calendar-status' }, read);
    assert.equal(read.code, 503);
    assert.equal(read.headers['Cache-Control'], 'no-store');
    assert.deepEqual(read.body, { error: 'Donation status is temporarily unavailable' });
  } finally {
    if (saved !== undefined) process.env.DONATELY_API_TOKEN = saved;
  }
});

test('all write methods and query parameters are rejected before contacting Donately', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected upstream request'); };
  try {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const res = response();
      await handler({ method, url: '/api/calendar-status' }, res);
      assert.equal(res.code, 405);
    }
    for (const query of ['account_id=act_other', 'url=https://example.test', 'refresh=1']) {
      const res = response();
      await handler({ method: 'GET', url: `/api/calendar-status?${query}` }, res);
      assert.equal(res.code, 400);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('successful responses contain only public status and errors never echo credentials or donor data', async () => {
  const originalFetch = globalThis.fetch;
  const saved = process.env.DONATELY_API_TOKEN;
  process.env.DONATELY_API_TOKEN = 'fake-sensitive-token';
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [], summary: { total_count: 0 }, token: 'fake-sensitive-token', donor: 'private@example.test' }) });
    const success = response();
    await handler({ method: 'GET', url: '/api/calendar-status' }, success);
    assert.equal(success.code, 200);
    assert.deepEqual(Object.keys(success.body).sort(), ['filledDays', 'updatedAt']);
    assert.equal(success.headers['Cache-Control'], 'public, max-age=0, s-maxage=60');
    globalThis.fetch = async () => { throw new Error('fake-sensitive-token private@example.test'); };
    const error = response();
    await handler({ method: 'GET', url: '/api/calendar-status' }, error);
    assert.equal(error.code, 503);
    assert.equal(error.headers['Cache-Control'], 'no-store');
    assert.ok(!JSON.stringify([success, error]).match(/fake-sensitive-token|private@example/));
  } finally {
    globalThis.fetch = originalFetch;
    if (saved === undefined) delete process.env.DONATELY_API_TOKEN;
    else process.env.DONATELY_API_TOKEN = saved;
  }
});
