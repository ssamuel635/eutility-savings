// Customer sign-in (server/auth) and phone-first CRM matching. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createConsoleSms } = require('../server/auth/sms.js');
const { createTokens } = require('../server/auth/tokens.js');
const { createLocalCustomers } = require('../server/auth/customers.js');
const { createAuthRoutes } = require('../server/auth/routes.js');
const { createExcelCrm } = require('../server/crm/excel.js');
const { validate, findMatch } = require('../server/crm/schema.js');

const env = { AUTH_SECRET: 'test-secret' };
const ALEX = { fullName: 'Alex Tan', email: 'alex@example.com', address: '123 Ang Mo Kio Ave 3', postal: '560123', dwelling: 'HDB 4-room' };

/** A server on a free port with a fake CRM and a controllable clock. */
async function start() {
  const clock = { t: Date.now() };
  const now = () => clock.t;
  const crmCalls = [];
  const crm = { upsertContact: async (c) => { crmCalls.push(c); return { id: 'CRM-1' }; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eu-auth-'));
  const customers = createLocalCustomers({ file: path.join(dir, 'customers.json'), crm });
  const routes = createAuthRoutes({ sms: createConsoleSms({ log: () => {}, now }), tokens: createTokens(env, { now }), customers, env, now });
  const server = http.createServer((req, res) => routes(req, res, new URL(req.url, 'http://x')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body, token) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  const later = (ms) => { clock.t += ms; };
  return { call, later, crmCalls, dir, close: () => server.close() };
}

test('a new number verifies, registers, and gets its profile', async () => {
  const s = await start();
  const sent = await s.call('POST', '/api/auth/otp', { phone: '9123 4567' });
  assert.equal(sent.status, 200);
  assert.match(sent.body.demoCode, /^\d{6}$/);

  const v = await s.call('POST', '/api/auth/otp/verify', { phone: '+65 9123-4567', code: sent.body.demoCode });
  assert.equal(v.body.status, 'new');

  const r = await s.call('POST', '/api/auth/register', { registrationToken: v.body.registrationToken, ...ALEX, referredBy: 'jane12' });
  assert.equal(r.status, 200);
  assert.equal(r.body.customer.phone, '+6591234567', 'stored in the format FXMedia uses');
  assert.equal(r.body.customer.source, 'referral');
  assert.equal(r.body.session.customerId, r.body.customer.id);
  assert.equal(r.body.customer.crmId, undefined, 'internal fields stay internal');

  assert.equal(s.crmCalls.length, 1, 'copied to the CRM');
  assert.equal(s.crmCalls[0].phone, '+6591234567');
  assert.equal(s.crmCalls[0].referredBy, 'JANE12');

  const token = r.body.session.token;
  const me = await s.call('GET', '/api/customers/me', null, token);
  assert.equal(me.body.customer.fullName, 'Alex Tan');

  const up = await s.call('PATCH', '/api/customers/me', { monthlyKwh: 420, preferences: { whatsappUpdates: false } }, token);
  assert.equal(up.body.customer.monthlyKwh, 420);
  assert.equal(up.body.customer.preferences.whatsappUpdates, false);
  assert.equal(s.crmCalls.at(-1).contactConsent, 'No');

  assert.equal((await s.call('POST', '/api/auth/logout', null, token)).status, 204);
  assert.equal((await s.call('GET', '/api/customers/me', null, token)).status, 401, 'signed out');
  s.close();
});

test('a known number signs straight in; a registration token works once', async () => {
  const s = await start();
  let code = (await s.call('POST', '/api/auth/otp', { phone: '81234567' })).body.demoCode;
  const v = await s.call('POST', '/api/auth/otp/verify', { phone: '81234567', code });
  const first = await s.call('POST', '/api/auth/register', { registrationToken: v.body.registrationToken, ...ALEX });
  assert.equal(first.status, 200);
  const again = await s.call('POST', '/api/auth/register', { registrationToken: v.body.registrationToken, ...ALEX });
  assert.equal(again.status, 400);
  assert.equal(again.body.code, 'expired');

  s.later(31_000);
  code = (await s.call('POST', '/api/auth/otp', { phone: '81234567' })).body.demoCode;
  const back = await s.call('POST', '/api/auth/otp/verify', { phone: '81234567', code });
  assert.equal(back.body.status, 'existing');
  assert.equal(back.body.customer.id, first.body.customer.id);
  s.close();
});

test('wrong, reused and expired codes are refused', async () => {
  const s = await start();
  const phone = '91112222';
  let code = (await s.call('POST', '/api/auth/otp', { phone })).body.demoCode;
  const wrong = code === '000000' ? '111111' : '000000';
  const bad = await s.call('POST', '/api/auth/otp/verify', { phone, code: wrong });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'invalid_code');
  assert.equal((await s.call('POST', '/api/auth/otp/verify', { phone, code })).status, 200);
  assert.equal((await s.call('POST', '/api/auth/otp/verify', { phone, code })).body.code, 'expired', 'a code works once');

  s.later(31_000);
  code = (await s.call('POST', '/api/auth/otp', { phone })).body.demoCode;
  s.later(301_000);
  assert.equal((await s.call('POST', '/api/auth/otp/verify', { phone, code })).body.code, 'expired');

  s.later(31_000);
  code = (await s.call('POST', '/api/auth/otp', { phone })).body.demoCode;
  for (let i = 0; i < 4; i++) await s.call('POST', '/api/auth/otp/verify', { phone, code: wrong });
  const fifth = await s.call('POST', '/api/auth/otp/verify', { phone, code: wrong });
  assert.equal(fifth.status, 429, 'locked after five wrong tries');
  assert.equal((await s.call('POST', '/api/auth/otp/verify', { phone, code })).body.code, 'expired', 'even the right code is gone');
  s.close();
});

test('only Singapore mobiles; resends wait 30 seconds; tampered sessions fail', async () => {
  const s = await start();
  assert.equal((await s.call('POST', '/api/auth/otp', { phone: '6123 4567' })).status, 400, 'landline');
  assert.equal((await s.call('POST', '/api/auth/otp', { phone: '+44 7700 900123' })).status, 400, 'overseas');
  assert.equal((await s.call('POST', '/api/auth/otp', { phone: '91234567' })).status, 200);
  const soon = await s.call('POST', '/api/auth/otp', { phone: '91234567' });
  assert.equal(soon.status, 429);
  assert.match(soon.body.error, /wait/);

  const tokens = createTokens(env);
  const real = tokens.session('CUST-AAAAAA', '+6591234567');
  const [payload, sig] = real.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: 'CUST-BBBBBB' })).toString('base64url');
  assert.equal(tokens.read(`${forged}.${sig}`, 'session'), null);
  assert.equal(tokens.read(real, 'reg'), null, 'a session is not a registration token');
  assert.equal(createTokens({ AUTH_SECRET: 'other' }).read(real, 'session'), null, 'changing AUTH_SECRET signs everyone out');
  assert.equal((await s.call('GET', '/api/customers/me')).status, 401);
  s.close();
});

test('the CRM matches a contact by mobile number first, email second', async () => {
  const rows = [{ id: 'A', phone: '+6591234567', email: 'old@example.com' }, { id: 'B', phone: '', email: 'alex@example.com' }];
  assert.equal(findMatch(rows, { phone: '+6591234567', email: 'alex@example.com' }).id, 'A', 'phone wins over email');
  assert.equal(findMatch(rows, { phone: '+6599999999', email: 'alex@example.com' }).id, 'B', 'email when the phone is new');
  assert.equal(findMatch(rows, { phone: '', email: 'nobody@example.com' }), undefined);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eu-crm-'));
  const crm = createExcelCrm({ file: path.join(dir, 'crm.xlsx') });
  const first = await crm.upsertContact(validate.contact({ fullName: 'Alex Tan', phone: '91234567', email: 'alex@example.com' }));
  const newEmail = await crm.upsertContact(validate.contact({ phone: '+65 9123 4567', email: 'alex.tan@work.com' }));
  assert.equal(newEmail.id, first.id, 'same phone, new email → same customer');
  crm.close();
});
