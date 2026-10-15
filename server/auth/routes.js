// ─────────────────────────────────────────────────────────────
// Customer sign-in by mobile number + SMS code, and the signed-in profile.
// The paths and shapes are the ones the app's contract already names
// (mobile/src/api/types.ts → Api.auth and Api.customer).
//
//   POST  /api/auth/otp           { phone }            → { expiresInSec, demoCode? }
//   POST  /api/auth/otp/verify    { phone, code }      → { status: 'existing', session, customer }
//                                                        | { status: 'new', registrationToken }
//   POST  /api/auth/register      { registrationToken, fullName, email, address, postal, dwelling, referredBy? }
//                                                      → { session, customer }
//   POST  /api/auth/logout        (Bearer session)     → 204
//   GET   /api/customers/me       (Bearer session)     → { customer }
//   PATCH /api/customers/me       (Bearer session)     { …profile fields } → { customer }
//
// Sessions travel as `Authorization: Bearer <token>`. A session is
// { token, customerId }, as the app's Session type expects.
// ─────────────────────────────────────────────────────────────

const { ValidationError, normPhone } = require('../crm/schema');
const { makeOriginGuard, makeRateLimit, clientIp, readJson, json } = require('../http');

/** Singapore mobile numbers only (8xxx xxxx / 9xxx xxxx): landlines can't receive the SMS. */
const SG_MOBILE = /^\+65[89]\d{7}$/;
const RESEND_AFTER_MS = 30_000;

function createAuthRoutes({ sms, tokens, customers, env = process.env, now = () => Date.now() }) {
  const guard = makeOriginGuard(env);
  const ipLimited = makeRateLimit(30, 60 * 60_000);    // code requests per address per hour
  const phoneLimited = makeRateLimit(5, 60 * 60_000);  // codes sent to one number per hour
  const verifyLimited = makeRateLimit(30, 60 * 60_000); // code checks per address per hour
  const lastSent = new Map();                          // phone → time of last code

  const phoneOf = (v) => {
    const p = normPhone(v);
    if (!SG_MOBILE.test(p)) throw new ValidationError('Enter a Singapore mobile number, e.g. 9123 4567');
    return p;
  };
  const fail = (status, error, code) => Object.assign(new Error(error), { status, code });
  const sessionOf = (customer) => ({ token: tokens.session(customer.id, customer.phone), customerId: customer.id });

  function signedIn(req) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    const claims = m && tokens.read(m[1], 'session');
    if (!claims) throw fail(401, 'Please sign in again.', 'not_signed_in');
    return claims;
  }

  return async function handle(req, res, url) {
    if (guard(req, res)) return;
    const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    const ip = clientIp(req);
    try {
      switch (route) {
        case 'POST /api/auth/otp': {
          if (ipLimited(ip)) throw fail(429, 'Too many requests — try again later');
          const phone = phoneOf((await readJson(req, 4096)).phone);
          const wait = RESEND_AFTER_MS - (now() - (lastSent.get(phone) || 0));
          if (wait > 0) throw fail(429, `Please wait ${Math.ceil(wait / 1000)} seconds before asking for another code`);
          if (phoneLimited(phone)) throw fail(429, 'Too many codes sent to this number — try again in an hour');
          const sent = await sms.send(phone);
          lastSent.set(phone, now());
          return json(res, 200, sent);
        }

        case 'POST /api/auth/otp/verify': {
          if (verifyLimited(ip)) throw fail(429, 'Too many attempts — try again later');
          const body = await readJson(req, 4096);
          const phone = phoneOf(body.phone);
          const code = String(body.code ?? '').trim();
          if (!/^\d{6}$/.test(code)) throw fail(400, 'Enter the 6-digit code from the SMS', 'invalid_code');
          const result = await sms.check(phone, code);
          if (result === 'wrong') throw fail(400, 'That code isn’t right. Check the SMS and try again.', 'invalid_code');
          if (result === 'expired') throw fail(400, 'That code has expired. Ask for a new one.', 'expired');
          if (result === 'locked') throw fail(429, 'Too many wrong codes. Ask for a new one.', 'expired');
          const customer = await customers.findByPhone(phone);
          if (customer) return json(res, 200, { status: 'existing', session: sessionOf(customer), customer });
          return json(res, 200, { status: 'new', registrationToken: tokens.registration(phone) });
        }

        case 'POST /api/auth/register': {
          const body = await readJson(req, 16 * 1024);
          const reg = tokens.read(body.registrationToken, 'reg');
          if (!reg) throw fail(400, 'Your verification expired. Please enter your number again.', 'expired');
          const customer = await customers.create(reg.phone, body);
          tokens.revoke(reg); // one account per verification
          return json(res, 200, { session: sessionOf(customer), customer });
        }

        case 'POST /api/auth/logout': {
          tokens.revoke(signedIn(req));
          res.writeHead(204, { 'Cache-Control': 'no-store' });
          return res.end();
        }

        case 'GET /api/customers/me': {
          const customer = await customers.get(signedIn(req).sub);
          if (!customer) throw fail(401, 'Please sign in again.', 'not_signed_in');
          return json(res, 200, { customer });
        }

        case 'PATCH /api/customers/me': {
          const claims = signedIn(req);
          const customer = await customers.update(claims.sub, await readJson(req, 16 * 1024));
          if (!customer) throw fail(401, 'Please sign in again.', 'not_signed_in');
          return json(res, 200, { customer });
        }

        default:
          return json(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[auth]', e);
      const code = e.code || (status === 400 || status === 413 ? 'validation' : undefined);
      return json(res, status, { error: status >= 500 ? 'Something went wrong. Please try again.' : e.message, ...(code ? { code } : {}) });
    }
  };
}

module.exports = { createAuthRoutes, SG_MOBILE };
