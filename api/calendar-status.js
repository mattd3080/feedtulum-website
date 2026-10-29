import { loadCalendarStatus } from '../lib/calendar-store.mjs';

export function createHandler(load = loadCalendarStatus) { return async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  // There are no caller-controlled account IDs, destinations, or filters.
  // Reject cache-busting query strings before reading private storage.
  if (new URL(request.url, 'https://www.feedtulum.com').search) {
    return response.status(400).json({ error: 'Query parameters are not supported' });
  }
  try {
    const status = await load();
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return response.status(200).json(status);
  } catch {
    // Do not log provider responses: they can contain donor details.
    return response.status(503).json({ error: 'Donation status is temporarily unavailable' });
  }
}; }
export default createHandler();
