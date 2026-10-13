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
import { getPlan } from '../calc.js';

const ENDPOINT = '/api/crm';
const OUTBOX = 'crm-outbox';
const MAX_OUTBOX = 30;
let available = true; // turns false for this page view if the host has no CRM

const planName = (id) => { const p = id && getPlan(id); return p ? `${p.retailer} · ${p.name}` : ''; };
const referredBy = () => { try { return localStorage.getItem('eu_referred_by') || ''; } catch { return ''; } };

/** The customer record as the CRM wants it — never passwords or local-only fields. */
export function toContact(c) {
  const ref = c.referredBy || referredBy();
  return {
    source: ref ? 'referral' : 'website',
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    address: [c.address, c.unit].filter(Boolean).join(', '),
    postal: c.postal,
    dwelling: c.dwelling,
    monthlyKwh: c.monthlyKwh,
    currentPlan: planName(c.currentPlanId),
    referralCode: c.referralCode,
    referredBy: ref,
    marketingConsent: c.contactConsentAt ? true : c.contactConsentAt === null ? false : undefined,
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
export const syncContact = (customer) => send('/contacts', { contact: toContact(customer) });

export const logSavingsCheck = (check, customer) => send('/savings-checks', {
  contact: toContact(customer),
  check: { channel: 'website', kwh: check.kwh, currentPlan: check.currentPlanName, bestPlan: check.bestPlanName, savingYearly: check.savingYearly },
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
      contact: toContact(customer),
      bill: { channel: 'website', fileName: file.name, mimeType: file.type, dataBase64, billingMonth },
    });
  } catch {
    return null;
  }
}

// Anything left over from an earlier visit goes once the page has settled.
if (typeof window !== 'undefined') setTimeout(() => { flush().catch(() => {}); }, 2000);
