// Signed tokens, the same scheme as the preview gate (middleware.js):
// base64url(JSON payload) + "." + HMAC-SHA256 signature. No database needed.
//
//   AUTH_SECRET  long random string that signs customer tokens. Changing it
//                signs every customer out. Required with NODE_ENV=production;
//                locally a throwaway one is made (sessions end on restart).
//
// Two kinds:
//   session       { typ: 'session', sub: customerId, phone }   30 days
//   registration  { typ: 'reg', phone }                        15 minutes —
//                 proof the phone was verified, spent by /api/auth/register

const crypto = require('crypto');

const SESSION_TTL_SEC = 30 * 24 * 3600;
const REG_TTL_SEC = 15 * 60;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function createTokens(env = process.env, { now = () => Date.now() } = {}) {
  let secret = env.AUTH_SECRET;
  if (!secret) {
    if (env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is required in production');
    secret = crypto.randomBytes(32).toString('hex');
    console.warn('  Auth: no AUTH_SECRET set — using a temporary one (customers are signed out when the server restarts)');
  }
  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const revoked = new Map(); // jti → exp (signed-out sessions, until they would have expired)

  function issue(claims, ttlSec) {
    const iat = Math.floor(now() / 1000);
    const payload = b64url(JSON.stringify({ ...claims, jti: crypto.randomBytes(9).toString('base64url'), iat, exp: iat + ttlSec }));
    return `${payload}.${sign(payload)}`;
  }

  /** The claims if the token is genuine, unexpired, of this type and not signed out; otherwise null. */
  function read(token, typ) {
    const [payload, sig, extra] = String(token || '').split('.');
    if (!payload || !sig || extra !== undefined) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    let claims;
    try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
    if (claims.typ !== typ || !(claims.exp > now() / 1000) || revoked.has(claims.jti)) return null;
    return claims;
  }

  function revoke(claims) {
    const t = now() / 1000;
    for (const [jti, exp] of revoked) if (exp < t) revoked.delete(jti);
    revoked.set(claims.jti, claims.exp);
  }

  return {
    session: (customerId, phone) => issue({ typ: 'session', sub: customerId, phone }, SESSION_TTL_SEC),
    registration: (phone) => issue({ typ: 'reg', phone }, REG_TTL_SEC),
    read,
    revoke,
  };
}

module.exports = { createTokens, SESSION_TTL_SEC, REG_TTL_SEC };
