// ─────────────────────────────────────────────────────────────
// Referral lucky draw API (Vercel Function; server.js serves it locally too)
//
//   GET  /api/draw?t=TOKEN    is this draw ready, already drawn, expired or invalid?
//                             Returns the wheel's prizes and odds, never the result
//                             of an undrawn draw.
//   POST /api/draw {t}        draws it: returns the prize (fixed on the server)
//   GET  /api/draw?sample=referrer|friend|bonus
//                             a fresh sample link token, previews only (DRAW_MODE=sample)
//
// No token, no wheel: the page shows the rules only. See api/_draw-engine.mjs.
// TODO (live): read and mark draws in the CRM, and ask the chatbot to send the
// WhatsApp confirmation with the voucher when a draw is made.
// ─────────────────────────────────────────────────────────────

import { readToken, outcome, prizes, memoryStore, sampleToken, mode, KINDS } from './_draw-engine.mjs';

const store = memoryStore();
const hits = new Map();
const MAX_BODY = 4 * 1024;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});

/** At most 30 requests a minute from one address. */
function limited(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '?';
  const t = Date.now();
  const recent = (hits.get(ip) || []).filter((x) => t - x < 60000);
  recent.push(t);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 30;
}

const wheel = () => prizes().map(({ id, label, value, odds }) => ({ id, label, value, odds }));

async function lookup(token) {
  const t = await readToken(token);
  if (t.error) return { status: t.error };
  const done = await store.get(t.drawId);
  return { status: done ? 'drawn' : 'ready', token: t, done };
}

export async function GET(request) {
  if (limited(request)) return json(429, { error: 'Too many tries. Wait a minute and try again.' });
  const url = new URL(request.url);
  try {
    if (url.searchParams.has('sample')) {
      return json(200, { token: await sampleToken(url.searchParams.get('sample')) });
    }
    const r = await lookup(url.searchParams.get('t'));
    if (!r.token) return json(200, { status: r.status, mode: mode(), prizes: wheel() });
    return json(200, {
      status: r.status,
      kind: r.token.kind,
      title: KINDS[r.token.kind],
      sample: r.token.sample,
      expires: r.token.expires,
      prizes: wheel(),
      ...(r.done ? { result: r.done } : {}),
    });
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : 'Something went wrong. Try again in a moment.' });
  }
}

export async function POST(request) {
  if (limited(request)) return json(429, { error: 'Too many tries. Wait a minute and try again.' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'Not allowed' });
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json(413, { error: 'Request too large' });
    body = JSON.parse(text || '{}');
  } catch { return json(400, { error: 'Send JSON' }); }
  try {
    const r = await lookup(body.t);
    if (!r.token) return json(r.status === 'expired' ? 410 : 400, { status: r.status });
    if (r.done) return json(200, { status: 'drawn', result: r.done, already: true });
    const { index, prize } = await outcome(r.token.drawId, r.token.sample);
    const result = await store.markDrawn(r.token.drawId, { index, id: prize.id, label: prize.label, value: prize.value });
    return json(200, { status: 'drawn', result, sample: r.token.sample });
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : 'Something went wrong. Try again in a moment.' });
  }
}
