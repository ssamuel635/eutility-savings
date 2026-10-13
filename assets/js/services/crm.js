// ─────────────────────────────────────────────────────────────
// CRM sync — the ONLY file on the website that knows where customer records
// go. customer.js calls it after saving anything locally.
//
// Today:  POST /api/crm/*  → server.js → server/crm (Excel workbook)
// Later:  the same calls with Freshworks behind them (CRM_PROVIDER=freshworks),
//         or swap ENDPOINT for FXMedia's API. Nothing that calls this changes.
//
// Records that can't be sent yet (offline, or a host with no CRM such as the
// static preview on Vercel) wait in an outbox in this browser and go on a
// later page load. Bills are too big for the outbox: they're sent once.
// ─────────────────────────────────────────────────────────────

import { store } from './store.js';
import { getPlan, RATES_DATE, TARIFF_PERIOD, CONTRACT_FILTERS } from '../calc.js';

const ENDPOINT = '/api/crm';
const OUTBOX = 'crm-outbox';
const MAX_OUTBOX = 30;
let available = true; // turns false for this page view if the host has no CRM

const planName = (id) => { const p = id && getPlan(id); return p ? `${p.retailer} · ${p.name}` : ''; };
const referredBy = () => { try { return localStorage.getItem('eu_referred_by') || ''; } catch { return ''; } };

const page = () => (typeof location !== 'undefined' ? location.pathname : '');

/**
 * The customer record as the CRM wants it — never passwords or local-only
 * fields. `action` says what they just did (account_created, savings_check…).
 */
export function toContact(c, action) {
  const ref = c.referredBy || referredBy();
  // A brand-new account has (almost) the same created and updated time.
  const isNew = c.createdAt && c.updatedAt && Math.abs(new Date(c.updatedAt) - new Date(c.createdAt)) < 5000;
  return {
    source: ref ? 'referral' : 'website',
    leadType: 'Residential',
    sourcePage: page(),
    lastAction: action || (isNew ? 'account_created' : 'profile_updated'),
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    unit: c.unit,
    postal: c.postal,
    dwelling: c.dwelling,
    currentPlan: planName(c.currentPlanId),
    monthlyKwh: c.monthlyKwh,
    spAccount: c.accountNo,
    referralCode: c.referralCode,
    referredBy: ref,
    termsAcceptedAt: c.termsAcceptedAt,
    // a time if they agreed; null means they declined, which the CRM records as "No"
    contactConsentAt: c.contactConsentAt === null ? false : c.contactConsentAt,
  };
}

/** A short reference code ("EC-7K3Q9P") made here, so it can go in a WhatsApp message straight away. */
export function newReference(prefix = 'EC') {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `${prefix}-` + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => a[b % a.length]).join('');
}

/** The fields every comparison result carries (FXMedia email, "Comparison result"). */
function comparisonFields({ kwh, currentPlanName, bestPlanName, savingMonthly, savingYearly, contract, greenOnly }) {
  return {
    channel: 'website',
    sourcePage: page(),
    kwh,
    currentPlan: currentPlanName,
    bestPlan: bestPlanName,
    savingMonthly,
    savingYearly,
    contractFilter: contract && CONTRACT_FILTERS[contract] ? CONTRACT_FILTERS[contract].label : '',
    greenOnly: typeof greenOnly === 'boolean' ? greenOnly : undefined,
    ratesDate: RATES_DATE,
    tariffPeriod: TARIFF_PERIOD,
  };
}

async function post(path, body) {
  if (!available) throw new Error('crm-unavailable');
  const res = await fetch(ENDPOINT + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: JSON.stringify(body).length < 60_000, // lets a send finish if the page is closing
  });
  if (res.status === 404 || res.status === 503) { available = false; throw new Error('crm-unavailable'); }
  if (!res.ok) throw new Error(`crm-${res.status}`);
  return res.json();
}

function queue(path, body) {
  const box = store.readList(OUTBOX);
  box.push({ path, body, at: Date.now() });
  store.write(OUTBOX, box.slice(-MAX_OUTBOX));
}

/** Send now; if that fails, keep it for later. Never throws — the site works without a CRM. */
async function send(path, body) {
  try {
    return await post(path, body);
  } catch {
    queue(path, body);
    return null;
  }
}

/** Retry anything waiting in the outbox. */
export async function flush() {
  const box = store.readList(OUTBOX);
  if (!box.length) return 0;
  const left = [];
  for (const item of box) {
    try { await post(item.path, item.body); } catch { left.push(item); }
  }
  store.write(OUTBOX, left);
  return box.length - left.length;
}

// ── What the rest of the site calls ──────────────────────────
export const syncContact = (customer, action) => send('/contacts', { contact: toContact(customer, action) });

/** A signed-in customer's saved check. */
export const logSavingsCheck = (check, customer) => send('/savings-checks', {
  contact: toContact(customer, 'savings_check'),
  check: { ...comparisonFields(check), action: 'savings_check' },
});

/**
 * Someone tapped "Switch on WhatsApp" or "Switch by email" on a result. The
 * reference also goes in their message, so the chat can pull up this exact
 * comparison. `customer` is optional: most people switch without an account.
 */
export const logComparison = (reference, action, comparison, customer) => send('/savings-checks', {
  contact: customer ? toContact(customer, action) : undefined,
  check: { ...comparisonFields(comparison), reference, action },
});

/** A business (SME) quote request from the SME calculator. */
export const logBusinessEnquiry = (reference, { companyName, sites, savingYearly, tier }, customer) => send('/business-enquiries', {
  contact: customer ? { ...toContact(customer, 'business_quote'), leadType: 'Business' } : undefined,
  enquiry: { reference, channel: 'website', sourcePage: page(), companyName, sites, savingYearly, tier },
});

/** A bill file goes once, straight away (it's too large to wait in the outbox). */
export async function sendBill(file, customer, billingMonth = '') {
  try {
    const dataBase64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    return await post('/bills', {
      contact: toContact(customer, 'bill_uploaded'),
      bill: { channel: 'website', fileName: file.name, mimeType: file.type, dataBase64, billingMonth },
    });
  } catch {
    return null;
  }
}

// Anything left over from an earlier visit goes once the page has settled.
if (typeof window !== 'undefined') setTimeout(() => { flush().catch(() => {}); }, 2000);
