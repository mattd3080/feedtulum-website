// Local-only visual fixture. No credentials, provider requests, or payments.
// Usage: node tests/preview-calendar.mjs [filled|santa|empty|unavailable]
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const state = process.argv[2] || 'filled';
if (!['filled', 'santa', 'empty', 'unavailable'].includes(state)) throw new Error('Use filled, santa, empty, or unavailable');
const files = {
  '/calendar': ['../giving-calendar/index.html', 'text/html'],
  '/giving-calendar/status.js': ['../giving-calendar/status.js', 'text/javascript'],
  '/giving-calendar/images/santa.png': ['../giving-calendar/images/santa.png', 'image/png'],
  '/favicon.svg': ['../favicon.svg', 'image/svg+xml'],
};
http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/api/calendar-status') {
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = state === 'unavailable' ? 503 : 200;
    return response.end(JSON.stringify(state === 'unavailable' ? { error: 'Fixture outage' } : {
      supporterCounts: state === 'santa' ? Object.fromEntries(Array.from({ length: 31 }, (_, index) => [index + 1, 3])) : state === 'filled' ? { 2: 1, 15: 2, 21: 3, 31: 5 } : {}, updatedAt: new Date().toISOString(),
    }));
  }
  const file = files[request.url];
  if (!file) { response.statusCode = 404; return response.end(); }
  response.setHeader('Content-Type', file[1]);
  response.end(await readFile(new URL(file[0], import.meta.url)));
}).listen(8766, '127.0.0.1', () => console.log(`Test fixture (${state}): http://127.0.0.1:8766/calendar`));
