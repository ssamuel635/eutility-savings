// FXMedia's Website API (server/fxmedia) against the fake FXMedia in
// tools/fake-fxmedia.mjs, which answers like their v1.0 docs. Nothing here calls the real API: its dev environment
// writes to the live Freshworks account. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createFxmediaClient } = require('../server/fxmedia/client.js');
const { createFxmediaCustomers, dwellingOf } = require('../server/fxmedia/customers.js');
const { createCustomers } = require('../server/auth/customers.js');
const { createConsoleSms } = require('../server/auth/sms.js');
const { createTokens } = require('../server/auth/tokens.js');
const { createAuthRoutes } = require('../server/auth/routes.js');
import { CHATBOT_CONTACT, createFakeFxmedia, FAKE_KEY, UNIT_TYPES } from '../tools/fake-fxmedia.mjs';

const KEY = FAKE_KEY;
const TEST = '+6591234567';
const env = { FXMEDIA_BASE_URL: 'https://fx.example/', FXMEDIA_API_KEY: KEY, FXMEDIA_TEST_PHONES: '9123 4567, 8123 4567', AUTH_SECRET: 'test-secret' };
const fakeFxmedia = () => createFakeFxmedia();

test('the client sends the key, normalises numbers and reads the lists', async () => {
  const fx = fakeFxmedia();
  const client = createFxmediaClient({ env, fetch: fx.fetch });
  assert.deepEqual((await client.providers()).map((p) => p.code), ['SP_GROUP']);
  assert.equal((await client.unitTypes()).length, 7);
  assert.equal(await client.lookup('9123 4567'), null, 'an unknown number is null, not an error');
  assert.ok(fx.calls.every((c) => c.key === KEY && c.path.startsWith('/api/web/v1/')), 'key on every call, no double slash');
  assert.equal(fx.calls.at(-1).body.phone, TEST, 'number in the body, in FXMedia\'s format');
});

test('safety: no call about a customer unless the number is a test number (until FXMEDIA_ANY_NUMBER=yes)', async () => {
  const fx = fakeFxmedia();
  const client = createFxmediaClient({ env, fetch: fx.fetch });
  for (const attempt of [() => client.lookup('98765432'), () => client.saveContact({ phone: '98765432', full_name: 'Someone' }),
    () => client.updateContact({ phone: '98765432' }), () => client.comparison('98765432'), () => client.signUp('98765432', 'p1')]) {
    await assert.rejects(attempt, (e) => e.code === 'NOT_A_TEST_NUMBER' && e.status === 403);
  }
  assert.equal(fx.calls.length, 0, 'refused before anything reached FXMedia');

  assert.throws(() => createFxmediaClient({ env: { ...env, FXMEDIA_ANY_NUMBER: 'yes' }, fetch: fx.fetch }), /SMS_PROVIDER/,
    'every number only with real sign-in codes');
  const live = createFxmediaClient({ env: { ...env, FXMEDIA_ANY_NUMBER: 'yes', SMS_PROVIDER: 'twilio' }, fetch: fx.fetch });
  assert.equal(await live.lookup('98765432'), null);
  assert.throws(() => createFxmediaClient({ env: { FXMEDIA_BASE_URL: 'https://fx.example' }, fetch: fx.fetch }), /FXMEDIA_API_KEY/);
});

test('FXMedia errors keep their code; field errors show to the customer; a bad key is our fault', async () => {
  const fx = fakeFxmedia();
  const client = createFxmediaClient({ env, fetch: fx.fetch });
  await assert.rejects(client.saveContact({ phone: TEST, full_name: 'Alex', email: 'nope', terms_accepted: true }),
    (e) => e.status === 400 && e.code === 'INVALID_EMAIL' && e.message === 'Email is not valid.' && e.constructor.name === 'ValidationError');
  await client.saveContact({ phone: TEST, full_name: 'Alex Tan', terms_accepted: true });
  await assert.rejects(client.comparison(TEST), (e) => e.status === 409 && e.code === 'CONTACT_USAGE_MISSING');
  await assert.rejects(client.signUp(TEST, 'gone'), (e) => e.code === 'PLAN_NOT_AVAILABLE' && e.nextAction === 'retry');

  const wrongKey = createFxmediaClient({ env: { ...env, FXMEDIA_API_KEY: 'old' }, fetch: fx.fetch });
  await assert.rejects(wrongKey.providers(), (e) => e.status === 502 && e.code === 'UNAUTHORIZED' && !e.message.includes('old'),
    'shown as a server problem, and the key never appears in the message');
  const down = createFxmediaClient({ env, fetch: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(down.providers(), (e) => e.status === 502 && e.code === 'FXMEDIA_UNREACHABLE');
});

test('FXMedia home types map to ours by label', () => {
  assert.deepEqual(UNIT_TYPES.map(dwellingOf), ['HDB 1- or 2-room', 'HDB 3-room', 'HDB 4-room', 'HDB 5-room', 'HDB Executive',
    'Condominium / Apartment', 'Landed property']);
  assert.equal(dwellingOf({ code: 'hdb_4rm', label: '' }), 'HDB 4-room', 'the code alone is enough');
  assert.equal(dwellingOf({ code: 'shophouse', label: 'Shophouse' }), null);
});

test('customers: register, read back, update; a chatbot contact signs straight in', async () => {
  const fx = fakeFxmedia();
  const customers = createFxmediaCustomers({ client: createFxmediaClient({ env, fetch: fx.fetch }) });
  const alex = await customers.create(TEST, { fullName: 'Alex Tan', email: 'alex@example.com', address: '123 Ang Mo Kio Ave 3',
    postal: '560123', dwelling: 'HDB 4-room', referredBy: 'jane12' });
  const saved = fx.contacts.get(TEST);
  assert.equal(saved.address, '123 Ang Mo Kio Ave 3, Singapore 560123');
  assert.equal(saved.unit_type, 'hdb_4rm');
  assert.equal(saved.referral_code, 'JANE12');
  assert.equal(saved.lead_type, 'Mobile app');
  assert.equal(fx.calls.find((c) => c.path.endsWith('/contacts') && c.method === 'POST').body.terms_accepted, true);

  assert.equal(alex.id, 'FX-6591234567');
  assert.deepEqual([alex.address, alex.postal, alex.dwelling, alex.source], ['123 Ang Mo Kio Ave 3', '560123', 'HDB 4-room', 'mobile_app']);
  assert.match(alex.referralCode, /^ALEX[A-Z2-9]{2}$/);
  assert.deepEqual(await customers.get(alex.id), alex, 'read back the same');
  assert.equal((await customers.findByPhone(TEST)).referralCode, alex.referralCode, 'the share code is stable');

  const up = await customers.update(alex.id, { monthlyKwh: 420, postal: '560124', preferences: { whatsappUpdates: false } });
  assert.deepEqual([up.monthlyKwh, up.address, up.postal, up.preferences.whatsappUpdates], [420, '123 Ang Mo Kio Ave 3', '560124', false]);
  assert.equal((await customers.update(alex.id, { monthlyKwh: null })).monthlyKwh, null, 'clearing usage');
  assert.equal(await customers.get('CUST-ABCDEF'), null, 'a local id isn\'t an FXMedia one');
  assert.equal(await customers.crmIdOf(alex.id), null);

  fx.contacts.set(CHATBOT_CONTACT.phone, { ...CHATBOT_CONTACT });
  const mei = await customers.findByPhone('81234567');
  assert.deepEqual([mei.fullName, mei.dwelling, mei.monthlyKwh, mei.source, mei.email, mei.address, mei.postal],
    ['Mei Ling', 'HDB 3-room', 300, 'whatsapp', '', '', ''], 'a chatbot contact with gaps reads cleanly');
  assert.equal(mei.currentPlanId, null, 'the chatbot\'s plan wording isn\'t one of our plan ids');
  await customers.update(mei.id, { currentPlanId: 'sp-group-regulated-tariff' });
  assert.equal((await customers.get(mei.id)).currentPlanId, 'sp-group-regulated-tariff', 'a plan id the app saved reads back');
});

test('sign-in end to end with CUSTOMER_SOURCE=fxmedia', async () => {
  const fx = fakeFxmedia();
  const customers = createCustomers({ env: { ...env, CUSTOMER_SOURCE: 'fxmedia' }, fetch: fx.fetch });
  assert.equal(customers.source, 'fxmedia');
  const routes = createAuthRoutes({ sms: createConsoleSms({ log: () => {} }), tokens: createTokens(env), customers, env });
  const server = http.createServer((req, res) => routes(req, res, new URL(req.url, 'http://x')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body, token) => {
    const res = await fetch(base + p, { method, body: body ? JSON.stringify(body) : undefined,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    return { status: res.status, body: await res.json() };
  };
  try {
    const code = (await call('POST', '/api/auth/otp', { phone: '9123 4567' })).body.demoCode;
    const v = await call('POST', '/api/auth/otp/verify', { phone: '91234567', code });
    assert.equal(v.body.status, 'new');
    const r = await call('POST', '/api/auth/register', { registrationToken: v.body.registrationToken, fullName: 'Alex Tan',
      email: 'alex@example.com', address: '123 Ang Mo Kio Ave 3', postal: '560123', dwelling: 'HDB 4-room' });
    assert.equal(r.status, 200);
    const me = await call('GET', '/api/customers/me', null, r.body.session.token);
    assert.equal(me.body.customer.fullName, 'Alex Tan');
    const bad = await call('PATCH', '/api/customers/me', { email: 'not an email' }, r.body.session.token);
    assert.equal(bad.status, 400, 'checked on our side before FXMedia');

    const other = await call('POST', '/api/auth/otp', { phone: '9876 5432' });
    const refused = await call('POST', '/api/auth/otp/verify', { phone: '98765432', code: other.body.demoCode });
    assert.equal(refused.status, 403, 'a real customer\'s number never reaches the live CRM from a dev machine');
  } finally {
    server.close();
  }
});
