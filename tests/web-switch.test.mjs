// The website Switch (api/_web-switch.mjs) against the fake FXMedia. Nothing
// here calls the real API: its dev environment writes to the live Freshworks account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebSwitch, matchPlan, normPhone } from '../api/_web-switch.mjs';
import { createFakeFxmedia, FAKE_KEY, FAKE_PLANS } from '../tools/fake-fxmedia.mjs';

const env = { FXMEDIA_BASE_URL: 'https://fx.example', FXMEDIA_API_KEY: FAKE_KEY, FXMEDIA_TEST_PHONES: '9123 4567', WEB_SWITCH_SECRET: 'test-secret' };
const GENECO = { id: 'geneco-get-it-fixed-24', retailer: 'Geneco', name: 'Get It Fixed 24' };
const DETAILS = {
  plan: GENECO, kwh: 370, currentRetailer: 'SP Group', fullName: 'Test Person', email: 'test@example.com',
  address: 'Blk 123 Tampines St 11 #08-45', postal: '521123', unitType: 'hdb_4rm', termsAccepted: true, contactConsent: true,
};

function setup(extra = {}) {
  const fx = createFakeFxmedia();
  let t = Date.parse('2026-11-24T08:00:00Z');
  const handle = createWebSwitch({ env: { ...env, ...extra }, fetch: fx.fetch, now: () => t });
  const post = async (body, ip = '1.2.3.4') => handle({ method: 'POST', body, ip });
  return { fx, handle, post, tick: (ms) => { t += ms; } };
}

async function getVerified(post, phone = '9123 4567') {
  const sent = await post({ step: 'code', phone });
  assert.equal(sent.status, 200);
  const ok = await post({ step: 'verify', phone, code: sent.body.demoCode, codeToken: sent.body.codeToken });
  assert.equal(ok.status, 200);
  return ok.body.verifiedToken;
}

test('numbers: Singapore formats normalise; only test numbers may go further', async () => {
  assert.equal(normPhone('9123 4567'), '+6591234567');
  assert.equal(normPhone('+65 9123-4567'), '+6591234567');
  assert.equal(normPhone('12'), '');
  const { post, fx } = setup();
  const r = await post({ step: 'code', phone: '9876 5432' });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'not_a_test_number');
  assert.equal((await post({ step: 'code', phone: '6123 4567' })).status, 400, 'landlines refused');
  assert.equal(fx.calls.length, 0, 'nothing reached FXMedia');
});

test('the code: wrong, expired or for another number is refused', async () => {
  const { post, tick } = setup({ FXMEDIA_TEST_PHONES: '9123 4567, 8123 4567' });
  const sent = await post({ step: 'code', phone: '91234567' });
  assert.match(sent.body.demoCode, /^\d{6}$/);
  const wrong = String((Number(sent.body.demoCode) + 1) % 1e6).padStart(6, '0');
  assert.equal((await post({ step: 'verify', phone: '91234567', code: wrong, codeToken: sent.body.codeToken })).body.code, 'invalid_code');
  assert.equal((await post({ step: 'verify', phone: '81234567', code: sent.body.demoCode, codeToken: sent.body.codeToken })).body.code, 'expired');
  const forged = sent.body.codeToken.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  assert.equal((await post({ step: 'verify', phone: '91234567', code: sent.body.demoCode, codeToken: forged })).status, 400);
  tick(6 * 60_000);
  assert.equal((await post({ step: 'verify', phone: '91234567', code: sent.body.demoCode, codeToken: sent.body.codeToken })).body.code, 'expired');
});

test('details and confirm need a verified number', async () => {
  const { post, fx } = setup();
  assert.equal((await post({ step: 'details', ...DETAILS, verifiedToken: 'nope' })).status, 401);
  assert.equal((await post({ step: 'confirm', verifiedToken: '', planId: 'x' })).status, 401);
  assert.equal(fx.calls.length, 0);
});

test('details: field checks come back per field, before anything is saved', async () => {
  const { post, fx } = setup();
  const verifiedToken = await getVerified(post);
  const r = await post({ step: 'details', ...DETAILS, verifiedToken, email: 'notanemail', postal: '12', termsAccepted: false, spAccount: '123' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.body.errors).sort(), ['email', 'postal', 'spAccount', 'termsAccepted']);
  assert.equal(fx.calls.length, 0);
});

test('the whole switch: contact saved, plan matched, documents, sign-up, status signed', async () => {
  const { post, fx } = setup();
  const verifiedToken = await getVerified(post);
  const d = await post({ step: 'details', ...DETAILS, verifiedToken, spAccount: '89 1234 5678' });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  const geneco = FAKE_PLANS.find((p) => p.plan === 'Get It Fixed 24');
  assert.equal(d.body.plan.id, geneco.plan_id);
  assert.equal(d.body.plan.contractLabel, '24-month contract');
  assert.match(d.body.factSheetUrl, /\.pdf$/);
  const saved = fx.calls.find((c) => c.method === 'POST' && c.path.endsWith('/contacts')).body;
  assert.equal(saved.phone, '+6591234567');
  assert.equal(saved.address, 'Blk 123 Tampines St 11 #08-45, Singapore 521123');
  assert.equal(saved.sp_account_number, '8912345678');
  assert.equal(saved.source, 'Web');
  assert.equal(saved.terms_accepted, true);
  const picked = fx.calls.find((c) => c.method === 'PUT' && c.path.endsWith('/contacts')).body;
  assert.equal(picked.selected_plan_id, geneco.plan_id, 'selected_plan_id for the chatbot');

  const c = await post({ step: 'confirm', verifiedToken, planId: d.body.plan.id, promoCode: 'WRONG' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.promoApplied, false, 'a wrong code doesn\'t stop the switch');
  assert.ok(c.body.reference);
  const status = fx.calls.find((x) => x.path.endsWith('/sign-up-status'));
  assert.deepEqual(status.body, { phone: '+6591234567', sign_up_status: 'signed' });
});

test('a plan FXMedia doesn\'t have is refused with a way out', async () => {
  const { post } = setup();
  const verifiedToken = await getVerified(post);
  const r = await post({ step: 'details', ...DETAILS, verifiedToken, plan: { id: 'flo-x', retailer: 'Flo Energy', name: 'Nope' } });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'plan_not_found');
  assert.match(r.body.error, /WhatsApp/);
});

test('plan matching: by retailer\'s first word and plan name, or a fixed id', () => {
  const top = [{ plan_id: 'a', retailer: 'Keppel', plan: 'FIXED 12' }, { plan_id: 'b', retailer: 'Geneco', plan: 'Get It Fixed 24' }];
  assert.equal(matchPlan({ id: 'k', retailer: 'Keppel Electric', name: 'Fixed12' }, top)?.plan_id, 'a');
  assert.equal(matchPlan({ id: 'g', retailer: 'Geneco', name: 'Get It Fixed 12' }, top), null);
  assert.equal(matchPlan({ id: 'x', retailer: 'Other', name: 'Other' }, top, { x: 'b' })?.plan_id, 'b');
});

test('setup lists FXMedia\'s home types; no key means "not set up", not a crash', async () => {
  const { handle } = setup();
  const r = await handle({ method: 'GET' });
  assert.equal(r.status, 200);
  assert.ok(r.body.unitTypes.some((u) => u.code === 'hdb_4rm'));
  assert.equal(r.body.smsDemo, true);
  const bare = createWebSwitch({ env: { WEB_SWITCH_SECRET: 's' } });
  assert.equal((await bare({ method: 'GET' })).body.code, 'not_available');
  assert.throws(() => createWebSwitch({ env: { VERCEL: '1' } }), /WEB_SWITCH_SECRET/);
});
