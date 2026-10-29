// ─────────────────────────────────────────────────────────────
// FXMedia's Website API (v1.0, 23 Oct 2026): contacts in Freshworks,
// comparison and sign-up. Only our server calls it; the key never reaches a
// browser, the app or a log.
//
//   FXMEDIA_BASE_URL       e.g. https://dev-eutility-wa.fxwebapps.com
//   FXMEDIA_API_KEY        sent as X-API-Key (one key per environment)
//   FXMEDIA_TEST_PHONES    numbers Eutility owns, e.g. +6591234567,+6598765432
//   FXMEDIA_ANY_NUMBER=yes production only: allow every customer's number
//
// Safety: FXMedia's dev environment writes to the LIVE Freshworks account,
// and saving a contact overwrites whoever has that number. So until
// FXMEDIA_ANY_NUMBER=yes, every call about a customer (lookup, save, update,
// comparison, sign-up) is refused unless the number is in FXMEDIA_TEST_PHONES.
// FXMEDIA_ANY_NUMBER=yes is refused while sign-in codes are only printed
// (SMS_PROVIDER=console), because then anyone could act for any number.
//
// Errors come back as an Error with .status (HTTP), .code (FXMedia's
// error_code) and .nextAction; field errors (400) are ValidationErrors, so the
// routes show their message next to the form.
// ─────────────────────────────────────────────────────────────

const { ValidationError, normPhone } = require('../crm/schema');

const TIMEOUT_MS = 15_000;
const FIELD_ERRORS = new Set(['INVALID_PHONE', 'CUSTOMER_NAME_REQUIRED', 'CONSENT_REQUIRED', 'INVALID_EMAIL', 'INVALID_UNIT_TYPE',
  'USAGE_OUT_OF_RANGE', 'INVALID_SP_ACCOUNT', 'INVALID_SOURCE', 'FIELD_TOO_LONG']);

const phoneList = (v) => new Set(String(v || '').split(',').map((p) => normPhone(p)).filter(Boolean));

function createFxmediaClient({ env = process.env, fetch = globalThis.fetch } = {}) {
  const base = String(env.FXMEDIA_BASE_URL || '').replace(/\/+$/, '');
  const key = env.FXMEDIA_API_KEY || '';
  if (!base || !key) throw new Error('FXMedia needs FXMEDIA_BASE_URL and FXMEDIA_API_KEY');
  const anyNumber = String(env.FXMEDIA_ANY_NUMBER || '').toLowerCase() === 'yes';
  if (anyNumber && (env.SMS_PROVIDER || 'console').toLowerCase() === 'console') {
    throw new Error('FXMEDIA_ANY_NUMBER=yes needs real sign-in codes (SMS_PROVIDER), not console');
  }
  const testPhones = phoneList(env.FXMEDIA_TEST_PHONES);

  /** The customer's number, normalised, if we may act for it. */
  function customerPhone(v) {
    const phone = normPhone(v);
    if (!/^\+\d{8,15}$/.test(phone)) throw new ValidationError('Enter a valid mobile number');
    if (!anyNumber && !testPhones.has(phone)) {
      throw Object.assign(new Error('This number is not on FXMEDIA_TEST_PHONES; FXMedia writes to the live CRM'),
        { status: 403, code: 'NOT_A_TEST_NUMBER' });
    }
    return phone;
  }

  async function call(method, pathname, body) {
    let res;
    try {
      res = await fetch(`${base}/api/web/v1${pathname}`, {
        method,
        headers: { 'X-API-Key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw Object.assign(new Error(`FXMedia ${method} ${pathname} could not be reached (${e.name})`), { status: 502, code: 'FXMEDIA_UNREACHABLE' });
    }
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.status !== false) return out;
    const code = out.error_code || `HTTP_${res.status}`;
    const message = out.message || `FXMedia ${method} ${pathname} → ${res.status}`;
    const err = FIELD_ERRORS.has(code) ? new ValidationError(message) : new Error(message);
    // Their 401 means our key is wrong: our server's fault, not the customer's.
    throw Object.assign(err, { status: res.status === 401 ? 502 : (res.ok ? 400 : res.status), code, nextAction: out.next_action });
  }

  return {
    where: base,

    /** Retailers for the "Current retailer" list: [{ code, name }]. */
    async providers() {
      return (await call('GET', '/providers')).data?.providers || [];
    },

    /** Home types: [{ code, label }]. */
    async unitTypes() {
      return (await call('GET', '/unit-types')).data?.unit_types || [];
    },

    /** The contact saved for this number, or null. */
    async lookup(phone) {
      try {
        return (await call('POST', '/contacts/lookup', { phone: customerPhone(phone) })).data.contact;
      } catch (e) {
        if (e.code === 'CONTACT_NOT_FOUND') return null;
        throw e;
      }
    },

    /** Create the contact, or update the one with this number: { created, contact }. */
    async saveContact(fields) {
      return (await call('POST', '/contacts', { ...fields, phone: customerPhone(fields.phone) })).data;
    },

    /** Change only the fields sent. */
    async updateContact(fields) {
      return (await call('PUT', '/contacts', { ...fields, phone: customerPhone(fields.phone) })).data.contact;
    },

    /** Top plans from what the CRM holds for this number (the chatbot's savings response). */
    async comparison(phone, { preference = 'default', limit = 3 } = {}) {
      return (await call('POST', '/comparison', { phone: customerPhone(phone), preference, limit })).data;
    },

    /** Record the plan the customer picked (a plan_id from comparison). Safe to repeat. */
    async signUp(phone, planId, promoCode = '') {
      return (await call('POST', '/sign-up', { phone: customerPhone(phone), plan_id: planId, promo_code: promoCode })).data;
    },
  };
}

module.exports = { createFxmediaClient };
