import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { applyEvent, emptyState, publicStatus } from './calendar-events.mjs';

const path = 'calendar/state-v1.json';
function options() {
  if (!process.env.BLOB_STORE_ID) throw new Error('Storage configuration missing');
  return { access: 'private', storeId: process.env.BLOB_STORE_ID };
}
export async function readState() {
  const result = await get(path, { ...options(), useCache: false });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) throw new Error('Storage unavailable');
  const state = await new Response(result.stream).json();
  if (state?.version !== 1 || !state.subscriptions || !state.payments) throw new Error('Invalid stored state');
  return { state, etag: result.blob.etag };
}
export async function updateState(event, { read = readState, write = put } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await read();
    const state = applyEvent(current?.state ?? emptyState(), event);
    const body = JSON.stringify(state);
    if (body.length > 2_000_000) throw new Error('Calendar storage capacity exceeded');
    try {
      await write(path, body, { ...options(), addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60, ...(current ? { ifMatch: current.etag } : {}) });
      return;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error;
    }
  }
  throw new Error('Concurrent calendar update; retry delivery');
}
export async function loadCalendarStatus() {
  const stored = await readState();
  if (!stored) throw new Error('Calendar is not initialized');
  return publicStatus(stored.state);
}
