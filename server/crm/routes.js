// HTTP endpoints the website and the app call. Contacts, bills and
// applications must name the customer (email and/or mobile); comparison
// results and business enquiries may come from someone without an account,
// and then carry only a reference code (also put in their WhatsApp message).
//
//   GET  /api/crm/health
//   POST /api/crm/contacts             { contact }
//   POST /api/crm/savings-checks       { contact?, check }        → { reference }
//   POST /api/crm/business-enquiries   { contact?, enquiry }      → { reference }
//   POST /api/crm/bills                { contact, bill: { fileName, mimeType, dataBase64, billingMonth, channel } }
//   POST /api/crm/applications         { contact, application }
//   GET  /api/crm/applications   (signed in: the customer's own applications)
//
// Who may do what:
//   Signed in (Authorization: Bearer <session> from server/auth, sent by the app):
//     the contact is always the signed-in mobile number, whatever the body says,
//     and its details may be updated.
//   Not signed in (the website, whose accounts still live in the browser): may
//     add a new contact or fill in empty fields, never change what a contact
//     already has — knowing someone's number mustn't be enough to edit them.
//   Reading applications needs a session.
// Beyond that: input checks, a rate limit and an origin allowlist.

const { validate, ValidationError, hasContact } = require('./schema');
const { makeOriginGuard, makeRateLimit, clientIp, readJson, json } = require('../http');

const SMALL = 64 * 1024;
const LARGE = 12 * 1024 * 1024; // a base64 bill up to 8 MB

/** `auth` is server/auth's { tokens, customers }, or null when sign-in is off (everyone is then "not signed in"). */
function createCrmRoutes(crm, env = process.env, auth = null) {
  const guard = makeOriginGuard(env);
  // 60 writes a minute per address is plenty for a person, too few for a script.
  const limited = makeRateLimit(60, 60_000);

  /** The session's claims ({ sub: customerId, phone }), or null if there isn't a valid one. */
  const sessionOf = (req) => {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    return (m && auth?.tokens.read(m[1], 'session')) || null;
  };

  return async function handle(req, res, url) {
    if (guard(req, res)) return;

    const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    try {
      if (route === 'GET /api/crm/health') {
        return json(res, 200, { ok: true, provider: crm.provider, pending: crm.pendingCount() });
      }
      if (route === 'GET /api/crm/applications') {
        const session = sessionOf(req);
        if (!session) return json(res, 401, { error: 'Please sign in again.', code: 'not_signed_in' });
        const contactId = await auth.customers.crmIdOf(session.sub);
        return json(res, 200, { applications: contactId ? await crm.listApplications(contactId) : [] });
      }

      if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
      if (limited(clientIp(req))) return json(res, 429, { error: 'Too many requests — try again in a minute' });

      const body = await readJson(req, route === 'POST /api/crm/bills' ? LARGE : SMALL);
      const session = sessionOf(req);
      if (session) body.contact = { ...(body.contact || {}), phone: session.phone };
      const optional = route === 'POST /api/crm/savings-checks' || route === 'POST /api/crm/business-enquiries';
      const contact = optional && !hasContact(body.contact) ? null : validate.contact(body.contact);
      const { id: contactId = '', queued } = contact ? await crm.upsertContact(contact, { fillOnly: !session }) : {};

      switch (route) {
        case 'POST /api/crm/contacts':
          return json(res, 200, { contactId, queued: !!queued });
        case 'POST /api/crm/savings-checks': {
          const r = await crm.logSavingsCheck(contactId, validate.savingsCheck(body.check));
          return json(res, 200, { contactId, reference: r.id });
        }
        case 'POST /api/crm/business-enquiries': {
          const enquiry = validate.businessEnquiry(body.enquiry);
          const c = contact ? { ...contact, leadType: 'Business' } : null;
          const r = await crm.logBusinessEnquiry(contactId, c, enquiry);
          return json(res, 200, { contactId, reference: r.id });
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

module.exports = { createCrmRoutes };
