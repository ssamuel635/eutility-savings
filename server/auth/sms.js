// ─────────────────────────────────────────────────────────────
// How the six-digit sign-in code reaches the customer's phone.
//
//   SMS_PROVIDER=console  (default) no SMS is sent: the code is printed in
//                         this terminal and handed back to the app as
//                         `demoCode`. For local testing only — the server
//                         refuses to start this way with NODE_ENV=production.
//   SMS_PROVIDER=twilio   Twilio Verify (Twilio makes, sends and checks the code)
//                         TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//                         TWILIO_VERIFY_SERVICE_SID (Console → Verify → Services)
//
// Every provider has the same two calls:
//   send(phone)        → { expiresInSec, demoCode? }
//   check(phone, code) → 'ok' | 'wrong' | 'expired' | 'locked'
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');

const CODE_TTL_SEC = 300;
const MAX_TRIES = 5;

function createConsoleSms({ log = console.log, now = () => Date.now() } = {}) {
  const codes = new Map(); // phone → { hash, exp, tries }
  const hash = (code) => crypto.createHash('sha256').update(code).digest('hex');
  return {
    provider: 'console',
    async send(phone) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      codes.set(phone, { hash: hash(code), exp: now() + CODE_TTL_SEC * 1000, tries: 0 });
      log(`  [sms] sign-in code for ${phone}: ${code}`);
      return { expiresInSec: CODE_TTL_SEC, demoCode: code };
    },
    async check(phone, code) {
      const entry = codes.get(phone);
      if (!entry || now() > entry.exp) { codes.delete(phone); return 'expired'; }
      if (++entry.tries > MAX_TRIES) { codes.delete(phone); return 'locked'; }
      const a = Buffer.from(hash(code), 'hex');
      if (!crypto.timingSafeEqual(a, Buffer.from(entry.hash, 'hex'))) {
        if (entry.tries < MAX_TRIES) return 'wrong';
        codes.delete(phone);
        return 'locked';
      }
      codes.delete(phone);
      return 'ok';
    },
  };
}

// Written from Twilio's Verify API docs (twilio.com/docs/verify/api), not yet
// run against a real account: Verifications and VerificationCheck endpoints,
// form-encoded bodies, Basic auth, a 10-minute default code lifetime, status
// "approved" on success, 404 once a code has expired or been used, 429 after
// too many attempts. VERIFY with a trial account before going live.
function createTwilioSms({ accountSid, authToken, serviceSid }) {
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('SMS_PROVIDER=twilio needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID');
  }
  const base = `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}`;
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const post = (pathname, fields) => fetch(base + pathname, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),
  });

  return {
    provider: 'twilio',
    async send(phone) {
      const res = await post('/Verifications', { To: phone, Channel: 'sms' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw Object.assign(new Error(`Twilio send → ${res.status}: ${d.message || ''}`), { status: res.status === 429 ? 429 : 502 });
      }
      return { expiresInSec: 600 };
    },
    async check(phone, code) {
      const res = await post('/VerificationCheck', { To: phone, Code: code });
      if (res.status === 404) return 'expired';
      if (res.status === 429) return 'locked';
      if (!res.ok) throw Object.assign(new Error(`Twilio check → ${res.status}`), { status: 502 });
      const d = await res.json();
      return d.status === 'approved' ? 'ok' : 'wrong';
    },
  };
}

function createSms(env = process.env) {
  const provider = (env.SMS_PROVIDER || 'console').toLowerCase();
  if (provider === 'console') {
    if (env.NODE_ENV === 'production') throw new Error('SMS_PROVIDER=console is for local testing only — set SMS_PROVIDER=twilio');
    return createConsoleSms();
  }
  if (provider === 'twilio') {
    return createTwilioSms({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN, serviceSid: env.TWILIO_VERIFY_SERVICE_SID });
  }
  throw new Error(`Unknown SMS_PROVIDER "${provider}" — use console or twilio`);
}

module.exports = { createSms, createConsoleSms, createTwilioSms, CODE_TTL_SEC, MAX_TRIES };
