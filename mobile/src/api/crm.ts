// ─────────────────────────────────────────────────────────────
// CRM sync for the app — the ONLY file in the app that knows where customer
// records go. The mock backend calls it after it saves anything.
//
// Today:  POST {EXPO_PUBLIC_CRM_URL}/api/crm/*  → server.js → Excel workbook
// Later:  same calls with Freshworks behind them (CRM_PROVIDER=freshworks).
//         When FXMedia's API replaces the mock, their backend talks to the
//         CRM and this file goes away.
//
// EXPO_PUBLIC_CRM_URL is the computer running `npm start` in the website
// folder, e.g. http://192.168.1.20:5173 (see mobile/.env.example). On the web
// preview it defaults to http://localhost:5173. Unset on a phone = off.
// Writes that can't be sent wait in an outbox and go on the next launch.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Customer, Dwelling } from './types';

const BASE = (process.env.EXPO_PUBLIC_CRM_URL || (Platform.OS === 'web' ? 'http://localhost:5173' : '')).replace(/\/+$/, '');
const OUTBOX = 'eutility:mobile:v1:crm-outbox';
const MAX_OUTBOX = 30;

export const crmEnabled = !!BASE;

/** What the CRM holds about a person. Matches server/crm/schema.js. */
export interface CrmContact {
  source: 'mobile_app' | 'referral';
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postal: string;
  dwelling: Dwelling;
  monthlyKwh: number | null;
  currentPlan: string;
  referralCode: string;
  referredBy?: string;
  marketingConsent?: boolean;
}

export interface CrmApplication {
  reference: string;
  plan: string;
  stage: string;
  stageUpdatedAt: string;
  staffNote: string;
}

export function toCrmContact(c: Customer, currentPlan = '', referredBy?: string): CrmContact {
  return {
    source: c.source === 'referral' ? 'referral' : 'mobile_app',
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    postal: c.postal,
    dwelling: c.dwelling,
    monthlyKwh: c.monthlyKwh,
    currentPlan,
    referralCode: c.referralCode,
    referredBy,
    marketingConsent: c.preferences.whatsappUpdates,
  };
}

/** fetch that gives up after `ms` — a phone off the office Wi-Fi must not hang. */
async function timed(url: string, init: RequestInit = {}, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await timed(`${BASE}/api/crm${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, path === '/bills' ? 30_000 : 6000);
  if (!res.ok) throw new Error(`crm ${res.status}`);
  return res.json() as Promise<T>;
}

async function readOutbox(): Promise<{ path: string; body: unknown }[]> {
  try { return JSON.parse((await AsyncStorage.getItem(OUTBOX)) || '[]'); } catch { return []; }
}
async function writeOutbox(items: { path: string; body: unknown }[]) {
  try { await AsyncStorage.setItem(OUTBOX, JSON.stringify(items.slice(-MAX_OUTBOX))); } catch { /* full or blocked */ }
}

/** Send now, or keep it for later. Never throws — the app works without a CRM. */
async function send<T>(path: string, body: unknown, { queue = true } = {}): Promise<T | null> {
  if (!BASE) return null;
  try {
    return await post<T>(path, body);
  } catch {
    if (queue) await writeOutbox([...(await readOutbox()), { path, body }]);
    return null;
  }
}

export async function flushOutbox() {
  if (!BASE) return;
  const box = await readOutbox();
  if (!box.length) return;
  const left: typeof box = [];
  for (const item of box) {
    try { await post(item.path, item.body); } catch { left.push(item); }
  }
  await writeOutbox(left);
}

type Ids = { contactId: string };

export const crm = {
  syncContact: (contact: CrmContact) => send<Ids>('/contacts', { contact }),

  logSavingsCheck: (contact: CrmContact, check: { kwh: number; currentPlan: string; bestPlan: string; savingYearly: number }) =>
    send<Ids>('/savings-checks', { contact, check: { channel: 'mobile_app', ...check } }),

  createApplication: (contact: CrmContact, application: { reference: string; plan: string; estimatedSavingYearly: number }) =>
    send<Ids & { reference: string }>('/applications', { contact, application: { channel: 'mobile_app', ...application } }),

  /** Bills go once, straight away — too large to wait in the outbox. */
  async sendBill(contact: CrmContact, file: { uri: string; fileName: string; mimeType: string }, billingMonth: string) {
    if (!BASE) return null;
    try {
      const blob = await (await fetch(file.uri)).blob();
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      return await send<Ids>('/bills', {
        contact,
        bill: { channel: 'mobile_app', fileName: file.fileName, mimeType: file.mimeType, dataBase64, billingMonth },
      }, { queue: false });
    } catch {
      return null;
    }
  },

  /** Stages staff have set in the CRM (the Excel "Stage" column). */
  async applications(contactId: string): Promise<CrmApplication[] | null> {
    if (!BASE || !contactId) return null;
    try {
      const res = await timed(`${BASE}/api/crm/applications?contactId=${encodeURIComponent(contactId)}`, {}, 4000);
      if (!res.ok) return null;
      return ((await res.json()) as { applications: CrmApplication[] }).applications;
    } catch {
      return null;
    }
  },
};
