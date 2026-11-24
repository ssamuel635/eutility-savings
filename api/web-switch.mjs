// Website Switch API (Vercel Function; server.js serves it locally too).
// The steps and settings are in api/_web-switch.mjs.

import { createWebSwitch } from './_web-switch.mjs';

let handle;
const MAX_BODY = 8 * 1024;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});

/** Browsers may only call this from the site itself. */
function foreign(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host !== (request.headers.get('x-forwarded-host') || request.headers.get('host')); } catch { return true; }
}

async function run(request, body) {
  if (foreign(request)) return json(403, { error: 'Origin not allowed' });
  try {
    handle = handle || createWebSwitch();
  } catch (e) {
    console.error('[web-switch]', e.message);
    return json(503, { error: 'Online switching isn’t set up yet.', code: 'not_available' });
  }
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '?';
  const r = await handle({ method: request.method, body, ip });
  return json(r.status, r.body);
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return json(400, { error: 'Send JSON' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'Request too large' });
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Invalid JSON' });
  return run(request, body);
}
