// ─────────────────────────────────────────────────────────────
// Signed-in customers' profiles from FXMedia's API (CUSTOMER_SOURCE=fxmedia).
// Same interface as the local directory in server/auth/customers.js:
//   findByPhone(phone), get(id), crmIdOf(id), create(phone, details), update(id, patch)
// each resolving to a customer in the app's shape (mobile/src/api/types.ts).
//
// The contact lives in Freshworks only (one per mobile number, shared with
// the WhatsApp chatbot), so nothing is stored here: the id is the number
// ("FX-6591234567"), and every read asks FXMedia.
//
// Mapping notes:
// - Home type: FXMedia's unit-type codes are matched to our home types by
//   their labels (fetched once from /unit-types).
// - Address and postal code travel as one address ("…, Singapore 560123").
// - currentPlanId is FXMedia's current_plan when it's one of our plan ids
//   (what the app saves), else null, until plans come from FXMedia's
//   comparison (step 3). pushNotifications isn't stored there: it reads as on.
// - A contact the chatbot made may have no email, address or home type yet:
//   those read as '' / null and the app asks for them on Edit profile.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');
const { profile } = require('../auth/customers');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_PREFIX = 'FX-';

/** Our home type for an FXMedia unit type (code + label), or null. */
function dwellingOf(t) {
  const s = `${t.code} ${t.label}`.toLowerCase();
  if (/exec/.test(s)) return 'HDB Executive';
  if (/condo|apartment|private flat/.test(s)) return 'Condominium / Apartment';
  if (/landed|terrace|bungalow|semi-d/.test(s)) return 'Landed property';
  if (/\b[12][- ]?(room|rm)|1_?rm|2_?rm|[12]rm/.test(s)) return 'HDB 1- or 2-room';
  for (const n of ['3', '4', '5']) if (new RegExp(`${n}[- _]?(room|rm)`).test(s)) return `HDB ${n}-room`;
  return null;
}

/** The customer's own code to share: stable for a number, so nothing needs storing. */
function referralCodeOf(fullName, phone) {
  const head = String(fullName || '').split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'EU';
  const h = crypto.createHash('sha256').update(phone).digest();
  return head + ALPHABET[h[0] % ALPHABET.length] + ALPHABET[h[1] % ALPHABET.length];
}

function channelOf(c) {
  if (/app/i.test(c.lead_type || '')) return 'mobile_app';
  const s = String(c.source || '');
  if (/chat|whatsapp|bot/i.test(s)) return 'whatsapp';
  if (/refer/i.test(s)) return 'referral';
  if (/app/i.test(s)) return 'mobile_app';
  return 'website';
}

function createFxmediaCustomers({ client }) {
  let types = null;
  const unitTypes = async () => (types ||= (await client.unitTypes()).map((t) => ({ ...t, dwelling: dwellingOf(t) })));
  const unitCodeOf = async (dwelling) => (await unitTypes()).find((t) => t.dwelling === dwelling)?.code;
  const phoneOfId = (id) => (typeof id === 'string' && id.startsWith(ID_PREFIX) ? `+${id.slice(ID_PREFIX.length)}` : null);

  /** FXMedia contact → the app's customer. */
  async function toCustomer(c) {
    if (!c) return null;
    const m = /^(.*?)[,\s]*(?:Singapore\s*)?(\d{6})\s*$/i.exec(c.address || '');
    const dwelling = (await unitTypes()).find((t) => t.code === c.unit_type)?.dwelling || null;
    return {
      id: ID_PREFIX + c.phone.replace(/\D/g, ''),
      fullName: c.full_name || '',
      phone: c.phone,
      email: c.email || '',
      address: m ? m[1] : (c.address || ''),
      postal: m ? m[2] : '',
      dwelling,
      monthlyKwh: c.monthly_usage_kwh ?? null,
      // only one of our plan ids (the app writes those); the chatbot's plan wording isn't one
      currentPlanId: /^[a-z0-9]+(-[a-z0-9]+)+$/.test(c.current_plan || '') ? c.current_plan : null,
      referralCode: referralCodeOf(c.full_name, c.phone),
      source: channelOf(c),
      createdAt: c.created_at || '',
      preferences: { pushNotifications: true, whatsappUpdates: c.contact_consent !== false },
    };
  }

  /** Checked profile fields → FXMedia contact fields (only those given). */
  async function toFields(p, current = {}) {
    const f = {};
    if (p.fullName !== undefined) f.full_name = p.fullName;
    if (p.email !== undefined) f.email = p.email;
    if (p.address !== undefined || p.postal !== undefined) {
      const address = p.address ?? current.address ?? '';
      const postal = p.postal ?? current.postal ?? '';
      f.address = [address, postal && `Singapore ${postal}`].filter(Boolean).join(', ');
    }
    if (p.dwelling !== undefined) {
      const code = await unitCodeOf(p.dwelling);
      if (code) f.unit_type = code;
    }
    if (p.monthlyKwh !== undefined) f.monthly_usage_kwh = p.monthlyKwh >= 1 ? p.monthlyKwh : ''; // "" clears it
    if (p.currentPlanId !== undefined) f.current_plan = p.currentPlanId || '';
    if (p.preferences) f.contact_consent = p.preferences.whatsappUpdates;
    return f;
  }

  return {
    source: 'fxmedia',
    where: client.where,

    async findByPhone(phone) {
      return toCustomer(await client.lookup(phone));
    },

    async get(id) {
      const phone = phoneOfId(id);
      return phone ? toCustomer(await client.lookup(phone)) : null;
    },

    /** Applications are sign-ups at FXMedia now, which their API doesn't list (yet). */
    async crmIdOf() {
      return null;
    },

    async create(phone, details) {
      const p = profile(details, { required: true });
      const referredBy = String(details?.referredBy || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      const { contact } = await client.saveContact({
        phone,
        ...(await toFields(p)),
        terms_accepted: true,
        contact_consent: true,
        lead_type: 'Mobile app',
        ...(referredBy ? { referral_code: referredBy } : {}),
      });
      return toCustomer(contact);
    },

    async update(id, patch) {
      const phone = phoneOfId(id);
      if (!phone) return null;
      const p = profile(patch);
      const current = (p.address !== undefined) !== (p.postal !== undefined) ? await toCustomer(await client.lookup(phone)) : {};
      if (!current) return null;
      return toCustomer(await client.updateContact({ phone, ...(await toFields(p, current)) }));
    },
  };
}

module.exports = { createFxmediaCustomers, dwellingOf, referralCodeOf };
