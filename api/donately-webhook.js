import { createHash, timingSafeEqual } from 'node:crypto';
import { EVENTS, normalizeEvent } from '../lib/calendar-events.mjs';
import { updateState } from '../lib/calendar-store.mjs';

export function createHandler(save = updateState) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
    const url = new URL(request.url, 'https://www.feedtulum.com');
    const expected = process.env.CALENDAR_WEBHOOK_TOKEN_HASH;
    const token = url.searchParams.get('token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(expected ?? '') || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(expected, 'hex'))) return response.status(401).json({ error: 'Unauthorized' });
    const type = url.searchParams.get('event');
    if (!EVENTS.includes(type)) return response.status(400).json({ error: 'Unsupported event' });
    let event;
    try {
      if (Number(request.headers?.['content-length']) > 131072) return response.status(413).json({ error: 'Payload too large' });
      const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (!raw || Buffer.byteLength(raw) > 131072) return response.status(413).json({ error: 'Payload too large' });
      event = normalizeEvent(JSON.parse(raw), type);
    } catch {
      return response.status(422).json({ error: 'Unsupported donation payload' });
    }
    if (event) {
      try { await save(event); }
      catch { return response.status(503).json({ error: 'Calendar update unavailable; retry delivery' }); }
    }
    return response.status(200).json({ received: true });
  };
}
export default createHandler();
