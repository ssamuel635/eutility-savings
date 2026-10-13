// HTTP endpoints the website and the app call. Every write names the
// customer (email and/or mobile); the contact is upserted first, so the CRM
// always has who a check, bill or application belongs to.
//
//   GET  /api/crm/health
//   POST /api/crm/contacts          { contact }
//   POST /api/crm/savings-checks    { contact, check }
//   POST /api/crm/bills             { contact, bill: { fileName, mimeType, dataBase64, billingMonth, channel } }
//   POST /api/crm/applications      { contact, application }
//   GET  /api/crm/applications?contactId=CUST-…
//
// PROTOTYPE: there is no customer sign-in on the server yet, so these are
// protected only by input checks, a rate limit and an origin allowlist.
// Real authentication arrives with the production backend.

const { validate, ValidationError } = require('./schema');

const SMALL = 64 * 1024;
const LARGE = 12 * 1024 * 1024; // a base64 bill up to 8 MB

function createCrmRoutes(crm, env = process.env) {
  const allowed = new Set((env.CRM_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081')
    .split(',').map((s) => s.trim()).filter(Boolean));

  // 60 writes a minute per address is plenty for a person, too few for a script.
  const hits = new Map();
  const limited = (ip) => {
    const t = Date.now();
    const recent = (hits.get(ip) || []).filter((x) => t - x < 60_000);
    recent.push(t);
    hits.set(ip, recent);
    return recent.length > 60;
  };

  return async function handle(req, res, url) {
    const origin = req.headers.origin;
    // Native apps send no Origin. Browsers must be on the allowlist, or be the
    // site itself (e.g. served through a tunnel at https://….trycloudflare.com).
    const sameSite = origin && (() => { try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; } })();
    if (origin && !sameSite && !allowed.has(origin)) return json(res, 403, { error: 'Origin not allowed' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    try {
      if (route === 'GET /api/crm/health') {
        return json(res, 200, { ok: true, provider: crm.provider, pending: crm.pendingCount() });
      }
      if (route === 'GET /api/crm/applications') {
        const contactId = String(url.searchParams.get('contactId') || '');
        if (!/^[\w-]{4,40}$/.test(contactId)) throw new ValidationError('contactId required');
        return json(res, 200, { applications: await crm.listApplications(contactId) });
      }

      if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
      if (limited(clientIp(req))) return json(res, 429, { error: 'Too many requests — try again in a minute' });

      const body = await readJson(req, route === 'POST /api/crm/bills' ? LARGE : SMALL);
      const contact = validate.contact(body.contact);
      const { id: contactId, queued } = await crm.upsertContact(contact);

      switch (route) {
        case 'POST /api/crm/contacts':
          return json(res, 200, { contactId, queued: !!queued });
        case 'POST /api/crm/savings-checks': {
          const r = await crm.logSavingsCheck(contactId, validate.savingsCheck(body.check));
          return json(res, 200, { contactId, id: r.id });
        }
        case 'POST /api/crm/bills': {
          const r = await crm.saveBill(contactId, validate.bill(body.bill));
          return json(res, 200, { contactId, id: r.id });
        }
        case 'POST /api/crm/applications': {
          const r = await crm.createApplication(contactId, contact, validate.application(body.application));
          return json(res, 200, { contactId, reference: r.reference });
        }
        default:
          return json(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[crm]', e);
      return json(res, status, { error: status >= 500 ? 'The CRM could not save this. Please try again.' : e.message });
    }
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

module.exports = { createCrmRoutes };
