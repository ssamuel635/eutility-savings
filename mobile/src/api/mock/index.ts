// Mock implementation of the Api contract (../types.ts). Behaves like the
// real backend — validation, errors, latency — with everything on the device.
// Customer records are also copied to Eutility's CRM through ../crm.ts
// (the Excel workbook for now), and application stages staff set there are
// read back, so the Track tab follows what Eutility does.

import { CONFIG, CONTRACT_FILTERS, TARIFF_PERIOD } from '@/engine';
import { crm, flushOutbox, toCrmContact, type CrmAction } from '../crm';
import { ApiError, type Api, type Customer, type Invoice, type Notice, type Plan, type SavingsQuote, type Session } from '../types';
import { advance, applyCrmStage, toApplication } from './applications';
import { db, delay, normEmail, normPhone, nowISO, reset, save, uid, type Db } from './db';
import { catalogue, planById, quote } from './pricing';
import { DEMO } from './seed';

const REFERRAL_BASE = 'https://eutility-savings.vercel.app/r/';

async function me(): Promise<{ d: Db; c: Customer }> {
  const d = await db();
  const c = d.session ? d.customers[d.session.customerId] : undefined;
  if (!c) throw new ApiError('not_signed_in', 'Please sign in again.');
  return { d, c };
}

function notify(d: Db, customerId: string, n: Omit<Notice, 'id' | 'at' | 'read'>) {
  (d.notices[customerId] ??= []).unshift({ ...n, id: 'N-' + uid(6), at: nowISO(), read: false });
}

function startSession(d: Db, customerId: string) {
  d.session = { token: 'mock.' + uid(24), customerId };
  return d.session;
}

const toInvoice = ({ customerId: _c, ...row }: Db['invoices'][number]): Invoice => row;

// ── CRM copy ─────────────────────────────────────────────────
const planLabel = (id: string | null | undefined) => { const p = planById(id); return p ? `${p.retailer} · ${p.name}` : ''; };
const contactOf = (c: Customer, action?: CrmAction, referredBy?: string) => toCrmContact(c, planLabel(c.currentPlanId), referredBy, action);

/** Remember the CRM's id for this customer once it answers (needed to read stages back). */
function remember(customerId: string) {
  return async (r: { contactId: string } | null) => {
    if (!r?.contactId) return;
    const d = await db();
    if (d.crmIds[customerId] !== r.contactId) { d.crmIds[customerId] = r.contactId; await save(); }
  };
}

/** Pull stages staff set in the CRM onto this customer's applications. */
async function syncStages(d: Db, c: Customer) {
  const contactId = d.crmIds[c.id];
  if (!contactId) return;
  const remote = await crm.applications(contactId);
  if (!remote) return;
  let changed = false;
  for (const row of d.applications.filter((a) => a.customerId === c.id)) {
    const r = remote.find((x) => x.reference === row.reference);
    if (!r) continue;
    const before = JSON.stringify([row.reached, row.staffNote, row.needsAttention]);
    const wasFlagged = !!row.needsAttention;
    const moved = applyCrmStage(row, r);
    if (moved) notify(d, c.id, { title: moved, body: `Your switch (${row.reference}) has moved on.`, link: '/application' });
    if (row.needsAttention && !wasFlagged) notify(d, c.id, { title: 'We need something from you', body: r.staffNote || `About your switch ${row.reference}.`, link: '/application' });
    changed ||= before !== JSON.stringify([row.reached, row.staffNote, row.needsAttention]);
  }
  if (changed) await save();
}

/**
 * Live sign-in (../http.ts): hold the server's session and a copy of its
 * customer here, so the parts still served by this mock (bills, switches,
 * rewards, notices, savings) work for that customer. The mobile number is
 * the customer ID, so anything this device already holds for the same
 * number (e.g. the demo account) moves to the server's customer id.
 */
/** A plan from the customer's latest quote (FXMedia's plans aren't in the price sheet). */
function planFromQuote(q: SavingsQuote | undefined, id: string): Plan | null {
  return (q && [q.recommended, ...q.alternatives].find((x) => x?.plan.id === id)?.plan) ?? null;
}

/** Keep a quote the server made, so latest() and switching work as with the device's own. */
export async function rememberQuote(q: SavingsQuote) {
  const d = await db();
  const c = d.session && d.customers[d.session.customerId];
  if (!c) return;
  d.quotes[c.id] = q;
  d.customers[c.id] = { ...c, monthlyKwh: q.input.kwh, currentPlanId: q.input.currentPlanId };
  await save();
}

export async function linkCustomer(customer: Customer, session?: Session, opts: { welcome?: boolean } = {}) {
  const d = await db();
  const old = d.byPhone[customer.phone];
  if (old && old !== customer.id) {
    const move = <T extends { customerId: string }>(rows: T[]) => rows.forEach((r) => { if (r.customerId === old) r.customerId = customer.id; });
    move(d.invoices);
    move(d.applications);
    d.referrals.forEach((r) => { if (r.referrerId === old) r.referrerId = customer.id; });
    for (const map of [d.quotes, d.notices, d.crmIds] as Record<string, unknown>[]) {
      if (old in map && !(customer.id in map)) map[customer.id] = map[old];
      delete map[old];
    }
    for (const login of Object.values(d.byEmail)) if (login.id === old) login.id = customer.id;
    delete d.customers[old];
  }
  d.customers[customer.id] = customer;
  d.byPhone[customer.phone] = customer.id;
  if (session) d.session = session;
  if (opts.welcome && !d.notices[customer.id]?.length) {
    notify(d, customer.id, { title: 'Welcome to Eutility', body: 'Check your savings, then send us a bill and we’ll handle the switch.' });
  }
  await save();
}

// Send anything left over from last time.
setTimeout(() => { flushOutbox().catch(() => {}); }, 3000);

export const mockApi: Api = {
  auth: {
    async requestOtp(phone) {
      await delay();
      if (!/^\+65[689]\d{7}$/.test(normPhone(phone))) throw new ApiError('validation', 'Enter a Singapore mobile number, e.g. 9123 4567.');
      return { expiresInSec: 60 };
    },
    async verifyOtp(phone, code) {
      await delay();
      // Until a real SMS provider is connected, any 6-digit code is accepted.
      if (!/^\d{6}$/.test(code)) throw new ApiError('invalid_code', 'That code isn’t right. Check the SMS and try again.');
      const d = await db();
      const p = normPhone(phone);
      const existing = d.byPhone[p];
      if (existing) {
        const session = startSession(d, existing);
        await save();
        return { status: 'existing', session };
      }
      const registrationToken = 'reg.' + uid(16);
      d.pendingRegistrations[registrationToken] = { phone: p };
      await save();
      return { status: 'new', registrationToken };
    },
    async register(token, details) {
      await delay();
      const d = await db();
      const pending = d.pendingRegistrations[token];
      if (!pending) throw new ApiError('expired', 'Your verification expired. Please enter your number again.');
      const email = normEmail(details.email);
      if (d.byEmail[email]) throw new ApiError('validation', 'That email is already used by another account.');
      const id = 'CUST-' + uid(6);
      const customer: Customer = {
        id,
        fullName: details.fullName.trim(),
        phone: pending.phone,
        email,
        address: details.address.trim(),
        postal: details.postal.trim(),
        dwelling: details.dwelling,
        monthlyKwh: null,
        currentPlanId: null,
        referralCode: details.fullName.trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) + uid(2),
        source: details.referredBy ? 'referral' : 'mobile_app',
        createdAt: nowISO(),
        preferences: { pushNotifications: true, whatsappUpdates: true },
      };
      d.customers[id] = customer;
      d.byPhone[pending.phone] = id;
      if (details.password) d.byEmail[email] = { id, password: details.password };
      delete d.pendingRegistrations[token];
      notify(d, id, { title: 'Welcome to Eutility', body: 'Check your savings, then send us a bill and we’ll handle the switch.' });
      const session = startSession(d, id);
      await save();
      crm.syncContact(contactOf(customer, 'account_created', details.referredBy)).then(remember(id));
      return session;
    },
    async signInWithEmail(email, password) {
      await delay();
      const d = await db();
      const login = d.byEmail[normEmail(email)];
      if (!login || login.password !== password) throw new ApiError('invalid_login', 'That email and password don’t match an account.');
      const session = startSession(d, login.id);
      await save();
      return session;
    },
    async signOut() {
      const d = await db();
      d.session = null;
      await save();
    },
    async restore() {
      return (await db()).session;
    },
  },

  customer: {
    async me() {
      await delay(150);
      return (await me()).c;
    },
    async update(patch) {
      await delay();
      const { d, c } = await me();
      if (patch.email && normEmail(patch.email) !== c.email) {
        const email = normEmail(patch.email);
        if (d.byEmail[email]) throw new ApiError('validation', 'That email is already used by another account.');
        if (d.byEmail[c.email]) { d.byEmail[email] = d.byEmail[c.email]; delete d.byEmail[c.email]; }
        patch = { ...patch, email };
      }
      const next = { ...c, ...patch, preferences: { ...c.preferences, ...patch.preferences } };
      d.customers[c.id] = next;
      await save();
      crm.syncContact(contactOf(next, 'profile_updated')).then(remember(c.id));
      return next;
    },
  },

  plans: {
    async catalogue() {
      await delay(200);
      return catalogue();
    },
  },

  savings: {
    async quote(input) {
      await delay(700); // the "we're checking 30+ plans" moment
      const q = quote(input);
      const d = await db();
      const c = d.session && d.customers[d.session.customerId];
      if (c) {
        d.quotes[c.id] = q;
        const next = { ...c, monthlyKwh: input.kwh, currentPlanId: q.input.currentPlanId };
        d.customers[c.id] = next;
        await save();
        crm.logSavingsCheck(contactOf(next, 'savings_check'), {
          kwh: input.kwh,
          currentPlan: `${q.current.plan.retailer} · ${q.current.plan.name}`,
          bestPlan: q.recommended ? `${q.recommended.plan.retailer} · ${q.recommended.plan.name}` : 'Already on one of the cheapest',
          savingMonthly: q.recommended?.savingMonthly ?? 0,
          savingYearly: q.recommended?.savingYearly ?? 0,
          contractFilter: CONTRACT_FILTERS[input.contract]?.label ?? '',
          greenOnly: input.greenOnly,
          ratesDate: q.ratesAsAt,
          tariffPeriod: TARIFF_PERIOD,
        }).then(remember(c.id));
      }
      return q;
    },
    async latest() {
      const { d, c } = await me();
      return d.quotes[c.id] ?? null;
    },
  },

  invoices: {
    async submit(file, billingMonth) {
      await delay(900);
      const { d, c } = await me();
      if (!/^\d{4}-\d{2}$/.test(billingMonth)) throw new ApiError('validation', 'Choose the month the bill is for.');
      const row = {
        id: 'INV-' + uid(6), customerId: c.id, fileName: file.fileName, previewUri: file.uri,
        billingMonth, status: 'received' as const, note: null, submittedAt: nowISO(),
      };
      d.invoices.unshift(row);
      await save();
      crm.sendBill(contactOf(c, 'bill_uploaded'), file, billingMonth).then(remember(c.id));
      return toInvoice(row);
    },
    async list() {
      await delay(200);
      const { d, c } = await me();
      return d.invoices.filter((i) => i.customerId === c.id).map(toInvoice);
    },
  },

  applications: {
    async create({ planId, invoiceId, quoteId, estimatedSavingYearly }) {
      await delay();
      const { d, c } = await me();
      const quoted = planId ? planFromQuote(d.quotes[c.id], planId) : null;
      const plan = planById(planId) ?? quoted;
      if (planId && !plan) throw new ApiError('validation', 'That plan is no longer available. Please check your savings again.');
      const at = nowISO();
      const row = {
        id: 'APP-' + uid(6), customerId: c.id, reference: 'EU-' + uid(6), planId, ...(quoted && !planById(planId) ? { plan: quoted } : {}),
        estimatedSavingYearly: Math.round(estimatedSavingYearly),
        invoiceId, quoteId, channel: 'mobile_app' as const, createdAt: at, reached: { submitted: at },
      };
      d.applications.unshift(row);
      notify(d, c.id, { title: 'Switch request sent', body: plan
        ? `We’ve started your switch to ${plan.retailer} ${plan.name}. Reference ${row.reference}.`
        : `We’ve got your bill and will recommend the best plan for you. Reference ${row.reference}.`, link: '/application' });
      await save();
      crm.createApplication(contactOf(c, 'switch_app'), {
        reference: row.reference,
        plan: plan ? `${plan.retailer} · ${plan.name}` : 'Eutility to recommend',
        estimatedSavingYearly: row.estimatedSavingYearly,
      }).then(remember(c.id));
      return toApplication(row);
    },
    async list() {
      await delay(200);
      const { d, c } = await me();
      await syncStages(d, c);
      return d.applications.filter((a) => a.customerId === c.id).map(toApplication);
    },
    async get(id) {
      await delay(150);
      const { d, c } = await me();
      await syncStages(d, c);
      const row = d.applications.find((a) => a.id === id && a.customerId === c.id);
      return row ? toApplication(row) : null;
    },
  },

  referrals: {
    async summary() {
      await delay(250);
      const { d, c } = await me();
      const mine = d.referrals.filter((r) => r.referrerId === c.id).sort((a, b) => b.at.localeCompare(a.at));
      return {
        code: c.referralCode,
        link: REFERRAL_BASE + c.referralCode,
        referred: mine.length,
        successful: mine.filter((r) => r.status === 'switched').length,
        rewardsEarned: null,
        nextRewardAt: CONFIG.rewards.nextRewardAt,
        referrals: mine.map(({ referrerId: _r, ...r }) => r),
        sample: c.phone === DEMO.phone,
      };
    },
  },

  notifications: {
    async list() {
      const { d, c } = await me();
      return (d.notices[c.id] ?? []).map((n) => ({ ...n }));
    },
    async markAllRead() {
      const { d, c } = await me();
      (d.notices[c.id] ?? []).forEach((n) => { n.read = true; });
      await save();
    },
  },

  demo: {
    async advanceApplication(id) {
      await delay(200);
      const { d, c } = await me();
      const row = d.applications.find((a) => a.id === id && a.customerId === c.id);
      if (!row) return null;
      const key = advance(row);
      const app = toApplication(row);
      const stage = app.stages.find((s) => s.key === key);
      if (stage) notify(d, c.id, { title: stage.label, body: stage.detail, link: '/application' });
      if (key === 'activated' && row.planId) d.customers[c.id] = { ...c, currentPlanId: row.planId };
      await save();
      return app;
    },
    async reset() {
      await reset();
    },
    hints: { phone: '9123 4567', otp: DEMO.otp, email: DEMO.email, password: DEMO.password },
  },
};
