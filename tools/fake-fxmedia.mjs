// A fake of FXMedia's Website API (v1.0), answering like their docs, so the
// app and server can be tried end to end without touching FXMedia: their dev
// environment writes to Eutility's LIVE Freshworks account.
//
//   node tools/fake-fxmedia.mjs     the fake on :5199 plus our server (server.js)
//                                   set to use it; then run the app as usual
//
// Two test numbers: 9123 4567 (new: registers) and 8123 4567 (a contact the
// chatbot made, with no email, address or postal code yet). Sign-in codes show
// in this window. Contacts are kept in memory only. tests/fxmedia.test.mjs
// uses the same fake.

export const FAKE_KEY = 'fake-fxmedia-key';
export const UNIT_TYPES = [
  { code: 'hdb_1_2rm', label: 'HDB 1-Room / 2-Room' }, { code: 'hdb_3rm', label: 'HDB 3-Room' }, { code: 'hdb_4rm', label: 'HDB 4-Room' },
  { code: 'hdb_5rm', label: 'HDB 5-Room' }, { code: 'hdb_exec', label: 'HDB Executive' }, { code: 'condo', label: 'Condominium / Apartment' },
  { code: 'landed', label: 'Landed Property' },
];
export const CHATBOT_CONTACT = {
  phone: '+6581234567', full_name: 'Mei Ling', email: '', address: '', unit_type: 'hdb_3rm', current_plan: 'Geneco Get It Fixed 24',
  monthly_usage_kwh: 300, source: 'Chatbot', lead_type: '', referral_code: '', contact_consent: true, created_at: '2026-10-20T02:00:00.000Z',
};

/** The fake: contacts by phone, the documented checks and error shapes. fetch() is a drop-in for global fetch. */
export function createFakeFxmedia({ key = FAKE_KEY, seed = [] } = {}) {
  const contacts = new Map(seed.map((c) => [c.phone, { ...c }]));
  const calls = [];
  const fail = (http, error_code, message) => ({ http, body: { status: false, error_code, message, next_action: 'retry' } });
  const ok = (data, extra = {}) => ({ http: 200, body: { status: true, ...extra, data } });
  const norm = (p) => { const d = String(p).replace(/\D/g, ''); return d.length === 8 ? `+65${d}` : `+${d}`; };
  const routes = {
    'GET /providers': () => ok({ providers: [{ code: 'SP_GROUP', name: 'SP Group' }], others_code: 'OTHERS' }),
    'GET /unit-types': () => ok({ unit_types: UNIT_TYPES }),
    'POST /contacts/lookup': (b) => (contacts.has(norm(b.phone)) ? ok({ contact: contacts.get(norm(b.phone)) }) : fail(404, 'CONTACT_NOT_FOUND', 'No contact')),
    'POST /contacts': (b) => {
      const phone = norm(b.phone);
      const had = contacts.get(phone);
      if (!had && !b.full_name) return fail(400, 'CUSTOMER_NAME_REQUIRED', 'Full name is required.');
      if (!had && b.terms_accepted !== true) return fail(400, 'CONSENT_REQUIRED', 'Terms must be accepted.');
      if (b.email && !/@/.test(b.email)) return fail(400, 'INVALID_EMAIL', 'Email is not valid.');
      const c = { phone, full_name: '', email: '', address: '', unit_type: '', current_plan: '', monthly_usage_kwh: null, source: 'Web',
        lead_type: '', referral_code: '', contact_consent: true, created_at: new Date().toISOString(), ...had };
      for (const [k, v] of Object.entries(b)) if (k !== 'phone' && k !== 'terms_accepted' && v !== undefined) c[k] = v;
      contacts.set(phone, c);
      return ok({ created: !had, contact: c });
    },
    'PUT /contacts': (b) => {
      const c = contacts.get(norm(b.phone));
      if (!c) return fail(404, 'CONTACT_NOT_FOUND', 'No contact');
      for (const [k, v] of Object.entries(b)) if (k !== 'phone') c[k] = k === 'monthly_usage_kwh' && v === '' ? null : v;
      return ok({ contact: c });
    },
    'POST /comparison': (b) => (contacts.get(norm(b.phone))?.monthly_usage_kwh
      ? ok({ current_rate_source: 'sp_tariff', top_plans: [{ rank: 1, plan_id: 'p1', retailer: 'PacificLight', plan: 'Classic 60' }] })
      : fail(409, 'CONTACT_USAGE_MISSING', 'No usage saved')),
    'POST /sign-up': (b) => (b.plan_id === 'gone' ? fail(409, 'PLAN_NOT_AVAILABLE', 'Plan no longer offered')
      : ok({ customer_id: 'c1', duplicate: false, status: 'signed' }, { message: 'OK' })),
  };
  function answer(method, pathname, apiKey, body) {
    calls.push({ method, path: pathname, key: apiKey, body });
    const route = routes[`${method} ${pathname.replace('/api/web/v1', '')}`];
    return apiKey !== key ? fail(401, 'UNAUTHORIZED', 'Bad key') : route ? route(body) : fail(404, 'NOT_FOUND', 'No route');
  }
  async function fetch(url, init) {
    const r = answer(init.method, new URL(url).pathname, init.headers['X-API-Key'], init.body ? JSON.parse(init.body) : {});
    return new Response(JSON.stringify(r.body), { status: r.http, headers: { 'Content-Type': 'application/json' } });
  }
  return { fetch, answer, contacts, calls };
}

// Run directly: the fake over HTTP, then our server pointed at it.
const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const http = await import('node:http');
  const { createRequire } = await import('node:module');
  const PORT = 5199;
  const fake = createFakeFxmedia({ seed: [CHATBOT_CONTACT] });
  http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { /* answered as a bad request below */ }
      const r = fake.answer(req.method, new URL(req.url, 'http://x').pathname, req.headers['x-api-key'], body);
      console.log(`  [fake fxmedia] ${req.method} ${req.url} → ${r.http}${r.body.error_code ? ` ${r.body.error_code}` : ''}`);
      res.writeHead(r.http, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r.body));
    });
  }).listen(PORT, () => console.log(`\n  Fake FXMedia → http://localhost:${PORT} (test numbers 9123 4567 new, 8123 4567 chatbot contact)`));
  Object.assign(process.env, {
    CUSTOMER_SOURCE: 'fxmedia', FXMEDIA_BASE_URL: `http://localhost:${PORT}`, FXMEDIA_API_KEY: FAKE_KEY,
    FXMEDIA_TEST_PHONES: '91234567,81234567', FXMEDIA_ANY_NUMBER: '',
  });
  createRequire(import.meta.url)('../server.js');
}
