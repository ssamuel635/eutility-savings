// ─────────────────────────────────────────────────────────────
// Where signed-in customers' profiles live, found by mobile number.
//
//   CUSTOMER_SOURCE=local    (default) data/crm/app-customers.json — beside
//                            the CRM workbook, so also never committed.
//                            Every change is copied to the CRM (Excel or
//                            Freshworks) as a contact.
//   CUSTOMER_SOURCE=fxmedia  FXMedia's customer API — agreed 15 Oct 2026 that
//                            our server calls it once a customer has signed
//                            in, but the API isn't published yet. Add the
//                            adapter here (same five calls) when it is.
//
// Interface: findByPhone(phone), get(id), create(phone, details), update(id, patch)
// all resolve to a customer in the app's shape (mobile/src/api/types.ts), or null.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validate, ValidationError, DWELLINGS, normEmail } = require('../crm/schema');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const uid = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');
const HOME_DWELLINGS = DWELLINGS.filter((d) => d !== 'Business premises');

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/** Profile fields a customer may set, checked. `required` for registration. */
function profile(input, { required = false } = {}) {
  const out = {};
  const has = (k) => input?.[k] !== undefined;
  if (required || has('fullName')) {
    out.fullName = text(input?.fullName, 120);
    if (!out.fullName) throw new ValidationError('Enter your full name');
  }
  if (required || has('email')) {
    out.email = normEmail(input?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) throw new ValidationError('Enter a valid email address');
  }
  if (required || has('address')) out.address = text(input?.address, 200);
  if (required || has('postal')) {
    out.postal = text(input?.postal, 6);
    if (!/^\d{6}$/.test(out.postal)) throw new ValidationError('Enter a 6-digit postal code');
  }
  if (required || has('dwelling')) {
    if (!HOME_DWELLINGS.includes(input?.dwelling)) throw new ValidationError('Choose your home type');
    out.dwelling = input.dwelling;
  }
  if (has('monthlyKwh')) {
    const n = input.monthlyKwh === null ? null : Number(input.monthlyKwh);
    if (n !== null && !(Number.isFinite(n) && n >= 0 && n <= 100_000)) throw new ValidationError('Usage must be between 0 and 100,000 kWh');
    out.monthlyKwh = n === null ? null : Math.round(n);
  }
  if (has('currentPlanId')) out.currentPlanId = input.currentPlanId === null ? null : text(input.currentPlanId, 80);
  if (has('preferences')) {
    const p = input.preferences || {};
    out.preferences = { pushNotifications: p.pushNotifications !== false, whatsappUpdates: p.whatsappUpdates !== false };
  }
  return out;
}

/** What the API returns: the record minus our internal bookkeeping. */
const publicView = (rec) => (rec ? (({ crmId: _c, referredBy: _r, ...c }) => c)(rec) : null);

function createLocalCustomers({ file, crm = null, log = console } = {}) {
  const FILE = path.resolve(file || path.join(__dirname, '..', '..', 'data', 'crm', 'app-customers.json'));
  let data;
  const load = () => {
    if (!data) {
      try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; data = { customers: {} }; }
    }
    return data;
  };
  const save = () => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE); // atomic: never half-written
  };
  const all = () => Object.values(load().customers);

  /** Copy to the CRM. A CRM failure is logged, never shown to the customer. */
  async function toCrm(rec, lastAction, extra = {}) {
    if (!crm) return;
    try {
      const r = await crm.upsertContact(validate.contact({
        source: rec.source, sourcePage: 'mobile_app', lastAction,
        fullName: rec.fullName, email: rec.email, phone: rec.phone, address: rec.address, postal: rec.postal,
        dwelling: rec.dwelling, monthlyKwh: rec.monthlyKwh, referralCode: rec.referralCode,
        contactConsent: rec.preferences.whatsappUpdates, ...extra,
      }));
      if (r?.id && r.id !== rec.crmId) { rec.crmId = r.id; save(); }
    } catch (e) {
      log.error('[auth] could not copy customer to CRM:', e.message);
    }
  }

  return {
    source: 'local',
    where: FILE,

    async findByPhone(phone) {
      return publicView(all().find((c) => c.phone === phone));
    },

    async get(id) {
      return publicView(load().customers[id]);
    },

    async create(phone, details) {
      if (all().some((c) => c.phone === phone)) throw new ValidationError('This mobile number already has an account');
      const p = profile(details, { required: true });
      if (all().some((c) => c.email === p.email)) throw new ValidationError('That email is already used by another account');
      const referredBy = text(details?.referredBy, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const rec = {
        id: 'CUST-' + uid(6),
        ...p,
        phone,
        monthlyKwh: null,
        currentPlanId: null,
        referralCode: (p.fullName.split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'EU') + uid(2),
        source: referredBy ? 'referral' : 'mobile_app',
        createdAt: new Date().toISOString(),
        preferences: { pushNotifications: true, whatsappUpdates: true },
        referredBy,
      };
      load().customers[rec.id] = rec;
      save();
      await toCrm(rec, 'account_created', { referredBy, termsAcceptedAt: rec.createdAt });
      return publicView(rec);
    },

    async update(id, patch) {
      const rec = load().customers[id];
      if (!rec) return null;
      const p = profile(patch);
      if (p.email && p.email !== rec.email && all().some((c) => c.email === p.email)) {
        throw new ValidationError('That email is already used by another account');
      }
      Object.assign(rec, p);
      save();
      await toCrm(rec, 'profile_updated');
      return publicView(rec);
    },
  };
}

function createCustomers({ env = process.env, crm = null } = {}) {
  const source = (env.CUSTOMER_SOURCE || 'local').toLowerCase();
  if (source === 'local') return createLocalCustomers({ file: env.CUSTOMERS_FILE || undefined, crm });
  if (source === 'fxmedia') throw new Error('CUSTOMER_SOURCE=fxmedia: FXMedia\'s customer API is not available yet — use local');
  throw new Error(`Unknown CUSTOMER_SOURCE "${source}" — use local`);
}

module.exports = { createCustomers, createLocalCustomers, profile };
