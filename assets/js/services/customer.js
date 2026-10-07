// Customer service — sign-up, profile, electricity details, bill uploads and
// saved savings checks. Mock only: everything lives in this browser (see store.js).
// Replace the store calls with API calls when the backend exists; the page code
// below the service does not change.

import { store, uid, nowISO, MOCK } from './store.js';

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

function accounts() { return store.read(ACCOUNTS, {}) || {}; }

function seedDemo() {
  const all = accounts();
  if (all[DEMO.email]) return;
  all[DEMO.email] = {
    pw: scramble(DEMO.password),
    profile: {
      id: 'CUST-DEMO01',
      fullName: 'Demo Customer',
      email: DEMO.email,
      phone: '9123 4567',
      address: '140 Paya Lebar Road, #05-08',
      postal: '409015',
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
  return { ok: true, customer };
}

/** Save credentials for an account created through sign-up. */
export function setPassword(email, password) {
  const all = accounts();
  const k = norm(email);
  all[k] = { pw: scramble(String(password || '')), profile: { ...(all[k]?.profile || {}), ...(get() || {}), email: k } };
  store.write(ACCOUNTS, all);
}

export const DWELLINGS = ['HDB 1–2 room', 'HDB 3-room', 'HDB 4-room', 'HDB 5-room', 'HDB Executive', 'Condominium / Apartment', 'Landed property', 'Business premises'];

export function isSignedIn() { return !!get(); }
export function get() { return store.read(KEY); }

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
/** Save the result of a calculator run so it shows up in the account. */
export function saveCheck({ kwh, currentPlanId, currentPlanName, bestPlanId, bestPlanName, savingYearly, savingMonthly, type = 'residential' }) {
  const checks = listChecks();
  const record = {
    id: 'CHK-' + uid(6),
    at: nowISO(),
    type, kwh, currentPlanId, currentPlanName, bestPlanId, bestPlanName, savingYearly, savingMonthly,
  };
  store.write(CHECKS, [record, ...checks].slice(0, 20));
  return record;
}
export function listChecks() { return store.read(CHECKS, []) || []; }
export function latestCheck() { return listChecks()[0] || null; }

// ── Bill uploads ─────────────────────────────────────────────
/**
 * Store a bill. In the prototype the file is kept as a data URL in this browser
 * (images/PDFs under ~2 MB). A real build uploads to storage and keeps only the URL.
 */
export async function addBill(file) {
  const meta = { id: 'BILL-' + uid(6), name: file.name, size: file.size, type: file.type, at: nowISO() };
  if (MOCK && file.size <= 2 * 1024 * 1024 && file.type.startsWith('image/')) {
    meta.dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => res(null);
      r.readAsDataURL(file);
    });
  }
  const bills = listBills();
  store.write(BILLS, [meta, ...bills].slice(0, 5));
  return meta;
}
export function listBills() { return store.read(BILLS, []) || []; }
export function latestBill() { return listBills()[0] || null; }

// ── Validation helpers used by the sign-up form ──────────────
export const validators = {
  fullName: (v) => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
  phone: (v) => (/^(\+?65)?[\s-]?[689]\d{3}[\s-]?\d{4}$/.test(v.trim()) ? '' : 'Enter a Singapore mobile number, e.g. 9123 4567.'),
  address: (v) => (v.trim().length >= 5 ? '' : 'Please enter your street address.'),
  postal: (v) => (/^\d{6}$/.test(v.trim()) ? '' : 'Singapore postal codes have 6 digits.'),
  kwh: (v) => (Number(v) >= 50 && Number(v) <= 5000 ? '' : 'Enter a usage between 50 and 5,000 kWh.'),
  password: (v) => (String(v).length >= 8 ? '' : 'Use at least 8 characters.'),
};
