// Customer service — sign-up, profile, electricity details, bill uploads and
// saved savings checks. Sign-in is still mock (this browser only, see
// store.js); the records themselves are also sent to Eutility's CRM through
// crm.js (an Excel workbook for now, Freshworks later). Replace the store
// calls with API calls when the backend exists; page code does not change.

import { store, uid, nowISO, MOCK } from './store.js';
import { compare } from '../calc.js';
import * as crm from './crm.js';

const KEY = 'customer';
const CHECKS = 'savings-checks';
const BILLS = 'bills';
const ACCOUNTS = 'accounts';

// ── Mock authentication ──────────────────────────────────────
// NOT SECURITY. Accounts live in this browser only and the "hash" below is a
// scramble, not a password hash. It exists so the sign-in screen behaves the
// way a real one does — wrong password is refused, unknown email is refused —
// while there is no server. When the backend lands, signIn/signUp call it and
// nothing above this file changes.
function scramble(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const norm = (e) => String(e || '').trim().toLowerCase();

/** The demo account, so the site can be looked at without signing up first. */
export const DEMO = { email: 'demo@eutility.com.sg', password: 'getcontrol' };

function accounts() { return store.readObject(ACCOUNTS, {}) || {}; }

function seedDemo() {
  const all = accounts();
  if (all[DEMO.email]) return;
  all[DEMO.email] = {
    pw: scramble(DEMO.password),
    profile: {
      id: 'CUST-DEMO01',
      fullName: 'Alex Tan',
      email: DEMO.email,
      phone: '9123 4567',
      address: 'Blk 123 Tampines Street 11, #08-45',
      postal: '521123',
      dwelling: 'HDB 4-room',
      monthlyKwh: 450,
      currentPlanId: 'sp-group-regulated-tariff',
      referralCode: 'DEMO24',
      createdAt: nowISO(),
    },
  };
  store.write(ACCOUNTS, all);
}
seedDemo();

/** The demo account comes with one saved check and one bill so the account pages have something to show. */
function seedDemoActivity() {
  if (listChecks().length === 0) {
    const { current, best } = compare({ kwh: 450 });
    if (best) {
      store.write(CHECKS, [{
        id: 'CHK-DEMO01', at: nowISO(), type: 'residential', kwh: 450, sample: true,
        currentPlanId: current.plan.id, currentPlanName: `${current.plan.retailer} · ${current.plan.name}`,
        bestPlanId: best.plan.id, bestPlanName: `${best.plan.retailer} · ${best.plan.name}`,
        savingYearly: best.savingYearly, savingMonthly: best.savingMonthly,
      }]);
    }
  }
  if (listBills().length === 0) {
    store.write(BILLS, [{ id: 'BILL-DEMO01', name: 'sample-sp-bill.pdf', size: 184320, type: 'application/pdf', at: nowISO(), sample: true }]);
  }
}

/** Is this email already registered in this browser? */
export function emailTaken(email) { return !!accounts()[norm(email)]; }

/**
 * Sign in. Returns { ok: true, customer } or { ok: false, error }.
 * Errors are deliberately vague about which field was wrong, as a real one would be.
 */
export function signIn(email, password) {
  const all = accounts();
  const acct = all[norm(email)];
  if (!acct || acct.pw !== scramble(String(password || ''))) {
    return { ok: false, error: 'That email and password don’t match an account.' };
  }
  const customer = { ...acct.profile, updatedAt: nowISO() };
  store.write(KEY, customer);
  if (norm(email) === DEMO.email) seedDemoActivity();
  return { ok: true, customer };
}

/** Save credentials for an account created through sign-up. */
export function setPassword(email, password) {
  const all = accounts();
  const k = norm(email);
  all[k] = { pw: scramble(String(password || '')), profile: { ...(all[k]?.profile || {}), ...(get() || {}), email: k } };
  store.write(ACCOUNTS, all);
}

export const DWELLINGS = ['HDB 1- or 2-room', 'HDB 3-room', 'HDB 4-room', 'HDB 5-room', 'HDB Executive', 'Condominium / Apartment', 'Landed property', 'Business premises'];

export function isSignedIn() { return !!get(); }
export function get() {
  const c = store.readObject(KEY);
  return c && typeof c.fullName === 'string' ? c : null;
}

/** Create (or update) the local customer record. Returns the saved customer. */
export function signUp(profile) {
  const existing = get();
  const customer = {
    id: existing?.id || 'CUST-' + uid(6),
    createdAt: existing?.createdAt || nowISO(),
    updatedAt: nowISO(),
    referralCode: existing?.referralCode || uid(6),
    ...existing,
    ...profile,
  };
  store.write(KEY, customer);
  crm.syncContact(customer);
  // A bill chosen earlier in the sign-up steps can go now that we know whose it is.
  if (pendingBill) { crm.sendBill(pendingBill, customer); pendingBill = null; }
  // Keep the account list in step so the person can sign back in later.
  if (customer.email) {
    const all = accounts();
    const k = norm(customer.email);
    all[k] = { pw: all[k]?.pw || scramble(customer.password || 'getcontrol'), profile: { ...customer, password: undefined } };
    store.write(ACCOUNTS, all);
  }
  return customer;
}

export function update(patch) {
  const c = get();
  if (!c) return null;
  const next = { ...c, ...patch, updatedAt: nowISO() };
  store.write(KEY, next);
  crm.syncContact(next);
  return next;
}

export function signOut() { store.remove(KEY); }

/** Wipe everything this prototype stored on the device. */
export function clearDemoData() { store.clearAll(); }

export function firstName() {
  const n = get()?.fullName || '';
  return n.trim().split(/\s+/)[0] || '';
}

// ── Savings checks ───────────────────────────────────────────
/**
 * Save the result of a calculator run so it shows up in the account.
 * Returns 'saved', 'duplicate' (same result as the latest check — not stored again)
 * or 'failed' (the browser refused to store it).
 */
export function saveCheck({ kwh, currentPlanId, currentPlanName, bestPlanId, bestPlanName, savingYearly, savingMonthly, type = 'residential' }) {
  const checks = listChecks();
  const last = checks[0];
  if (last && last.kwh === kwh && last.currentPlanId === currentPlanId && last.bestPlanId === bestPlanId
      && last.savingYearly === savingYearly) return 'duplicate';
  const record = {
    id: 'CHK-' + uid(6),
    at: nowISO(),
    type, kwh, currentPlanId, currentPlanName, bestPlanId, bestPlanName, savingYearly, savingMonthly,
  };
  const c = get();
  if (c) crm.logSavingsCheck(record, c);
  return store.write(CHECKS, [record, ...checks].slice(0, 20)) ? 'saved' : 'failed';
}
export function listChecks() { return store.readList(CHECKS); }
export function latestCheck() { return listChecks()[0] || null; }

// ── Bill uploads ─────────────────────────────────────────────
/**
 * Store a bill. In the prototype the file is kept as a data URL in this browser
 * (images/PDFs under ~2 MB). A real build uploads to storage and keeps only the URL.
 */
let pendingBill = null; // a bill picked during sign-up, before the account exists

export async function addBill(file) {
  const meta = { id: 'BILL-' + uid(6), name: file.name, size: file.size, type: file.type, at: nowISO() };
  const c = get();
  if (c) crm.sendBill(file, c); else pendingBill = file;
  // Browser storage is small (~5 MB). Keep a preview only for small images, and
  // keep at most 3 bills; if the browser still refuses, keep the details without the preview.
  if (MOCK && file.size <= 700 * 1024 && file.type.startsWith('image/')) {
    meta.dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => res(null);
      r.readAsDataURL(file);
    });
  }
  const bills = listBills();
  if (store.write(BILLS, [meta, ...bills].slice(0, 3))) return meta;
  const lean = { ...meta, dataUrl: undefined };
  const leanList = [lean, ...bills.map((b) => ({ ...b, dataUrl: undefined }))].slice(0, 3);
  if (store.write(BILLS, leanList)) return lean;
  throw new Error('storage-full');
}
export function listBills() { return store.readList(BILLS); }
export function latestBill() { return listBills()[0] || null; }

// ── Validation helpers used by the sign-up form ──────────────
export const validators = {
  fullName: (v) => (v.trim().length >= 2 ? '' : 'Enter your full name.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.'),
  phone: (v) => (/^(\+?65)?[\s-]?[689]\d{3}[\s-]?\d{4}$/.test(v.trim()) ? '' : 'Enter a Singapore mobile number, e.g. 9123 4567.'),
  address: (v) => (v.trim().length >= 5 ? '' : 'Enter your street address.'),
  postal: (v) => (/^\d{6}$/.test(v.trim()) ? '' : 'Singapore postal codes have 6 digits.'),
  kwh: (v) => (Number(v) >= 50 && Number(v) <= 5000 ? '' : 'Enter a usage between 50 and 5,000 kWh.'),
  password: (v) => (String(v).length >= 8 ? '' : 'Use at least 8 characters.'),
};
