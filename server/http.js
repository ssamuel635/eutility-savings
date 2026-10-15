// Small HTTP helpers shared by the API route modules (server/crm, server/auth).

const { ValidationError } = require('./crm/schema');

const DEFAULT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081';

/**
 * Browsers must be on CRM_ALLOWED_ORIGINS or be the site itself (e.g. served
 * through a tunnel); native apps send no Origin. Sets CORS headers and answers
 * preflight. Returns true when the request has been answered already.
 */
function makeOriginGuard(env = process.env) {
  const allowed = new Set((env.CRM_ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((s) => s.trim()).filter(Boolean));
  return function guard(req, res) {
    const origin = req.headers.origin;
    const sameSite = origin && (() => { try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; } })();
    if (origin && !sameSite && !allowed.has(origin)) { json(res, 403, { error: 'Origin not allowed' }); return true; }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
    return false;
  };
}

/** At most `max` hits per key in the last `windowMs`. Returns true when over. */
function makeRateLimit(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = Date.now();
    const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
    recent.push(t);
    hits.set(key, recent);
    return recent.length > max;
  };
}

/** Behind a tunnel every request arrives from 127.0.0.1; the visitor is in the forwarded header. */
function clientIp(req) {
  const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');
  const fwd = local && (req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim());
  return fwd || req.socket.remoteAddress || '?';
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return reject(new ValidationError('Send JSON'));
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new ValidationError('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new ValidationError('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

module.exports = { makeOriginGuard, makeRateLimit, clientIp, readJson, json };
