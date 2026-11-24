// ─────────────────────────────────────────────────────────────
// Website Switch (agreed with FXMedia, 24 Nov 2026): a visitor signs up for a
// plan on the website, no account. The contact and the sign-up go to FXMedia;
// "signed" on the contact makes the WhatsApp chatbot send the confirmation.
//
//   GET  /api/web-switch                       → { unitTypes, smsDemo }
//   POST { step: 'code',    phone }            → { codeToken, expiresInSec, demoCode? }
//   POST { step: 'verify',  phone, code, codeToken } → { verifiedToken }
//   POST { step: 'details', verifiedToken, plan: { id, retailer, name }, kwh,
//          currentRetailer, fullName, email, address, postal, unitType,
//          spAccount?, referralCode?, termsAccepted, contactConsent }
//        → saves the contact, finds the plan in FXMedia's comparison:
//          { plan: { id, retailer, name, rateLabel, contractLabel, monthly, savingYearly, promo },
//            factSheetUrl, emaAdvisoryUrl }
//   POST { step: 'confirm', verifiedToken, planId, promoCode? }
//        → FXMedia sign-up + sign-up status "signed": { reference, duplicate, promoApplied }
//
// Proof of the number: a 6-digit code. Tokens are signed (HMAC), so no
// database is needed and any Vercel instance can check them.
//   SMS_PROVIDER=console (only option for now): no SMS is sent; the code comes
//   back as demoCode and the page shows it. Safe only because FXMedia calls are
//   limited to FXMEDIA_TEST_PHONES (numbers Eutility owns): FXMedia's dev API
//   writes to the LIVE Freshworks account. Real SMS waits for Kenneth's OK.
//
// Settings: FXMEDIA_BASE_URL, FXMEDIA_API_KEY, FXMEDIA_TEST_PHONES,
// WEB_SWITCH_SECRET (signs the tokens; required on Vercel).
// ─────────────────────────────────────────────────────────────

import crypto from 'node:crypto';

const CODE_TTL_SEC = 5 * 60;
const VERIFIED_TTL_SEC = 30 * 60;
const TIMEOUT_MS = 15_000;
const SG_MOBILE = /^\+65[89]\d{7}$/;

// Our plan id → FXMedia plan_id, for plans the name match below can't find.
// Fill in from FXMedia's plan list (asked for on 24 Nov).
export const PLAN_IDS = {};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const firstWord = (s) => norm(String(s || '').trim().split(/\s+/)[0]);
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const money = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);

/** "9123 4567", "+65 9123-4567" → "+6591234567"; anything else → '' */
export function normPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 8) return `+65${d}`;
  if (d.length === 10 && d.startsWith('65')) return `+${d}`;
  return '';
}

/** FXMedia's plan for one of ours: the PLAN_IDS entry, else same retailer and same plan name. */
export function matchPlan(ours, topPlans, ids = PLAN_IDS) {
  const fixed = ids[ours.id];
  if (fixed) return topPlans.find((p) => String(p.plan_id) === fixed) || null;
  return topPlans.find((p) => firstWord(p.retailer) === firstWord(ours.retailer) && norm(p.plan) === norm(ours.name)) || null;
}

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function createWebSwitch({ env = process.env, fetch = globalThis.fetch, now = () => Date.now() } = {}) {
  const base = String(env.FXMEDIA_BASE_URL || '').replace(/\/+$/, '');
  const key = env.FXMEDIA_API_KEY || '';
  const sms = String(env.SMS_PROVIDER || 'console').toLowerCase();
  const testPhones = new Set(String(env.FXMEDIA_TEST_PHONES || '').split(',').map(normPhone).filter(Boolean));
  let secret = env.WEB_SWITCH_SECRET || '';
  if (!secret) {
    if (env.VERCEL) throw new Error('WEB_SWITCH_SECRET is required on Vercel');
    secret = crypto.randomBytes(32).toString('hex'); // local: tokens end when the server restarts
  }

  // ── signed tokens ──
  const sign = (payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  const read = (token, typ) => {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const want = crypto.createHmac('sha256', secret).update(body).digest();
    const got = Buffer.from(sig, 'base64url');
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      return p.typ === typ && p.exp > now() / 1000 ? p : null;
    } catch { return null; }
  };
  const codeHash = (phone, code) => crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('base64url');

  // ── rate limits (per instance; FXMedia allows 60 calls a minute in all) ──
  const hits = new Map();
  const limited = (bucket, max, windowMs) => {
    const t = now();
    const recent = (hits.get(bucket) || []).filter((x) => t - x < windowMs);
    recent.push(t);
    hits.set(bucket, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > max;
  };

  // ── FXMedia ──
  async function fx(method, pathname, body) {
    if (!base || !key) throw new HttpError(503, 'Online switching isn’t set up yet.', 'not_available');
    let res;
    try {
      res = await fetch(`${base}/api/web/v1${pathname}`, {
        method,
        headers: { 'X-API-Key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new HttpError(502, 'We couldn’t reach our plan service. Please try again.', 'FXMEDIA_UNREACHABLE');
    }
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.status !== false) return out.data || {};
    const err = new HttpError(res.status === 401 || res.status >= 500 ? 502 : res.status === 200 ? 400 : res.status,
      out.message || `FXMedia ${method} ${pathname} → ${res.status}`, out.error_code || `HTTP_${res.status}`);
    throw err;
  }

  /** The visitor's number, if online switching is open to it. */
  function phoneOf(v) {
    const phone = normPhone(v);
    if (!SG_MOBILE.test(phone)) throw new HttpError(400, 'Enter a Singapore mobile number, e.g. 9123 4567', 'invalid_phone');
    if (!testPhones.has(phone)) {
      throw new HttpError(403, 'Online switching is still being tested, so it only works for Eutility’s test numbers for now.', 'not_a_test_number');
    }
    return phone;
  }

  function verified(token) {
    const p = read(token, 'verified');
    if (!p) throw new HttpError(401, 'Your code has expired. Please confirm your number again.', 'not_verified');
    return phoneOf(p.phone);
  }

  // ── steps ──
  async function setup() {
    const { unit_types: unitTypes = [] } = await fx('GET', '/unit-types');
    return { unitTypes: unitTypes.map(({ code, label }) => ({ code, label })), smsDemo: sms === 'console' };
  }

  async function sendCode(b, ip) {
    if (sms !== 'console') throw new HttpError(503, 'SMS codes aren’t set up yet.', 'not_available');
    if (limited(`ip:${ip}`, 20, 3600_000)) throw new HttpError(429, 'Too many requests. Please try again later.');
    const phone = phoneOf(b.phone);
    if (limited(`code:${phone}`, 5, 3600_000)) throw new HttpError(429, 'Too many codes sent to this number. Please try again in an hour.');
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeToken = sign({ typ: 'code', phone, h: codeHash(phone, code), exp: Math.floor(now() / 1000) + CODE_TTL_SEC });
    return { codeToken, expiresInSec: CODE_TTL_SEC, demoCode: code };
  }

  async function verify(b, ip) {
    if (limited(`verify:${ip}`, 30, 3600_000)) throw new HttpError(429, 'Too many attempts. Please try again later.');
    const phone = phoneOf(b.phone);
    const code = String(b.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code', 'invalid_code');
    const t = read(b.codeToken, 'code');
    if (!t || t.phone !== phone) throw new HttpError(400, 'That code has expired. Ask for a new one.', 'expired');
    const a = Buffer.from(codeHash(phone, code));
    const want = Buffer.from(t.h);
    if (a.length !== want.length || !crypto.timingSafeEqual(a, want)) throw new HttpError(400, 'That code isn’t right. Please try again.', 'invalid_code');
    return { verifiedToken: sign({ typ: 'verified', phone, exp: Math.floor(now() / 1000) + VERIFIED_TTL_SEC }) };
  }

  async function details(b) {
    const phone = verified(b.verifiedToken);
    const ours = { id: clean(b.plan?.id, 100), retailer: clean(b.plan?.retailer, 100), name: clean(b.plan?.name, 100) };
    if (!ours.id || !ours.retailer || !ours.name) throw new HttpError(400, 'Choose a plan first', 'validation');
    const kwh = Math.round(Number(b.kwh));
    if (!(kwh >= 50 && kwh <= 5000)) throw new HttpError(400, 'Usage must be between 50 and 5,000 kWh a month', 'validation');
    const fullName = clean(b.fullName, 100);
    const email = clean(b.email, 254);
    const address = clean(b.address, 200);
    const postal = clean(b.postal, 6);
    const unitType = clean(b.unitType, 50);
    const spAccount = clean(b.spAccount, 20).replace(/\s/g, '');
    const errors = {};
    if (fullName.length < 2) errors.fullName = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email, e.g. you@example.com';
    if (address.length < 5) errors.address = 'Enter your address';
    if (!/^\d{6}$/.test(postal)) errors.postal = 'Enter your 6-digit postal code';
    if (!unitType) errors.unitType = 'Choose your home type';
    if (spAccount && !/^\d{10}$/.test(spAccount)) errors.spAccount = 'Your SP account number has 10 digits';
    if (b.termsAccepted !== true) errors.termsAccepted = 'Tick this box to continue';
    if (Object.keys(errors).length) return { status: 400, body: { error: 'Please check the highlighted fields', code: 'validation', errors } };

    await fx('POST', '/contacts', {
      phone,
      full_name: fullName,
      email,
      address: `${address}, Singapore ${postal}`,
      unit_type: unitType,
      current_retailer: clean(b.currentRetailer, 100) || 'SP Group',
      monthly_usage_kwh: kwh,
      ...(spAccount ? { sp_account_number: spAccount } : {}),
      ...(clean(b.referralCode, 20) ? { referral_code: clean(b.referralCode, 20) } : {}),
      source: 'Web',
      lead_type: 'Residential',
      terms_accepted: true,
      contact_consent: b.contactConsent === true,
    });
    const data = await fx('POST', '/comparison', { phone, preference: 'default', limit: 'all' });
    const p = matchPlan(ours, data.top_plans || []);
    if (!p) throw new HttpError(409, 'This plan can’t be switched to online yet. Please message us on WhatsApp and we’ll help.', 'plan_not_found');
    // Monika (24 Nov): the chatbot reads the chosen plan from selected_plan_id
    await fx('PUT', '/contacts', { phone, selected_plan_id: String(p.plan_id) }).catch(() => {});
    let docs = {};
    try { docs = await fx('GET', `/plans/${encodeURIComponent(p.plan_id)}/documents`); } catch { /* shown as "ask us" on the page */ }
    const months = Number(p.contract_term_months) || 0;
    const rate = Number(p.effective_rate_cents_kwh ?? p.rate);
    const promo = (p.promotions || [])[0];
    return {
      plan: {
        id: String(p.plan_id),
        retailer: p.retailer,
        name: p.plan,
        rateLabel: Number.isFinite(rate) ? `${rate.toFixed(2)}¢/kWh${p.rate_is_average ? ' (average)' : ''}` : '',
        contractLabel: months ? `${months}-month contract` : 'No lock-in',
        earlyTermination: p.early_termination_fee || null,
        monthly: money(p.monthly_cost_sgd),
        savingYearly: money(p.annual_saving_sgd),
        promo: promo ? { title: promo.name, value: promo.display_value || null } : null,
      },
      factSheetUrl: docs.fact_sheet_url || null,
      emaAdvisoryUrl: docs.ema_advisory_url || null,
    };
  }

  async function confirm(b) {
    const phone = verified(b.verifiedToken);
    const planId = clean(b.planId, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(planId)) throw new HttpError(400, 'Choose a plan first', 'validation');
    const promo = clean(b.promoCode, 50);
    let r;
    let promoApplied = !!promo;
    try {
      r = await fx('POST', '/sign-up', { phone, plan_id: planId, promo_code: promo });
    } catch (e) {
      // A code that doesn't apply doesn't stop the switch: FXMedia's advice is to resend without it
      if (!promo || e.code !== 'PROMO_CODE_INVALID') throw e;
      r = await fx('POST', '/sign-up', { phone, plan_id: planId, promo_code: '' });
      promoApplied = false;
    }
    // "signed" on the contact is what makes the chatbot send the WhatsApp confirmation
    await fx('PUT', '/sign-up-status', { phone, sign_up_status: 'signed' });
    return { reference: r.customer_id || null, duplicate: !!r.duplicate, promoApplied };
  }

  /** One request: { method, body, ip } → { status, body }. */
  return async function handle({ method, body = {}, ip = '?' }) {
    try {
      if (method === 'GET') return { status: 200, body: await setup() };
      if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } };
      const steps = { code: sendCode, verify, details, confirm };
      const run = steps[body.step];
      if (!run) return { status: 400, body: { error: 'Unknown step' } };
      const out = await run(body, ip);
      return out && out.status && out.body ? out : { status: 200, body: out };
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[web-switch]', e.code || '', e.message);
      const shown = e instanceof HttpError && status !== 502 && status < 500 ? e.message
        : e instanceof HttpError && e.code === 'not_available' ? e.message
          : 'We couldn’t reach our plan service. Please try again.';
      // FXMedia's own field errors (e.g. INVALID_EMAIL) come back as 400s with their message
      return { status, body: { error: shown, ...(e.code ? { code: e.code } : {}) } };
    }
  };
}
