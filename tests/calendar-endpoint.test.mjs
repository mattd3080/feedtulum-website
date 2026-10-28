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
    await handler({ method: 'GET' }, read);
    assert.equal(read.code, 503);
    assert.equal(read.headers['Cache-Control'], 'no-store');
    assert.deepEqual(read.body, { error: 'Donation status is temporarily unavailable' });
  } finally {
    if (saved !== undefined) process.env.DONATELY_API_TOKEN = saved;
  }
});
