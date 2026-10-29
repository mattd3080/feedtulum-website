import { loadCalendarStatus } from '../lib/calendar-status.mjs';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  // There are no caller-controlled account IDs, destinations, or filters.
  // Reject cache-busting query strings before making any authenticated request.
  if (new URL(request.url, 'https://www.feedtulum.com').search) {
    return response.status(400).json({ error: 'Query parameters are not supported' });
  }
  try {
    const status = await loadCalendarStatus({
      token: process.env.DONATELY_API_TOKEN,
      accountId: 'act_50d509c0c0b4',
      campaignId: 'cmp_164cd8d8b53b',
    });
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return response.status(200).json(status);
  } catch {
    // Do not log provider responses: they can contain donor details.
    return response.status(503).json({ error: 'Donation status is temporarily unavailable' });
  }
}
