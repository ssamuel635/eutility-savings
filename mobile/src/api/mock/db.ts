// Mock backend storage. Holds what FXMedia's backend would hold, on the
// device (AsyncStorage), so the prototype survives an app restart.
// NOT SECURITY: passwords are compared in plain text on the device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Channel, Customer, InvoiceStatus, Notice, Plan, ReferralStatus, SavingsQuote, StageKey } from '../types';

const KEY = 'eutility:mobile:v1:db';

export interface InvoiceRow {
  id: string;
  customerId: string;
  fileName: string;
  previewUri: string | null;
  billingMonth: string;
  status: InvoiceStatus;
  note: string | null;
  submittedAt: string;
}

export interface ApplicationRow {
  id: string;
  customerId: string;
  reference: string;
  planId: string | null;
  /** The plan as quoted, when it isn't one of the price sheet's (FXMedia's plans). */
  plan?: Plan;
  estimatedSavingYearly: number;
  invoiceId: string | null;
  quoteId: string | null;
  channel: Channel;
  createdAt: string;
  /** When each stage was reached. The first missing one is the current stage. */
  reached: Partial<Record<StageKey, string>>;
  /** Set from the CRM by Eutility staff. */
  staffNote?: string;
  needsAttention?: boolean;
}

export interface ReferralRow { id: string; referrerId: string; name: string; status: ReferralStatus; at: string }

export interface Db {
  customers: Record<string, Customer>;
  byPhone: Record<string, string>;                           // +65… → customerId
  byEmail: Record<string, { id: string; password: string }>; // email → login
  session: { token: string; customerId: string } | null;
  pendingRegistrations: Record<string, { phone: string }>;   // registrationToken → phone
  quotes: Record<string, SavingsQuote>;                      // customerId → latest
  invoices: InvoiceRow[];
  applications: ApplicationRow[];
  referrals: ReferralRow[];
  notices: Record<string, Notice[]>;                         // customerId → newest first
  crmIds: Record<string, string>;                            // customerId → CRM contact id
}

const empty = (): Db => ({
  customers: {}, byPhone: {}, byEmail: {}, session: null, pendingRegistrations: {},
  quotes: {}, invoices: [], applications: [], referrals: [], notices: {}, crmIds: {},
});

let cache: Db | null = null;
let seedFn: ((db: Db) => void) | null = null;

/** Registered by ./seed so a fresh install has the demo account. */
export function onSeed(fn: (db: Db) => void) { seedFn = fn; }

export async function db(): Promise<Db> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? { ...empty(), ...JSON.parse(raw) } : null;
  } catch {
    cache = null;
  }
  if (!cache) {
    cache = empty();
    seedFn?.(cache);
    await save();
  }
  return cache!;
}

export async function save() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full or blocked — keep in memory */ }
}

export async function reset() {
  cache = null;
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Network-ish delay so loading states are real in the prototype. */
export const delay = (ms = 350 + Math.random() * 300) => new Promise((r) => setTimeout(r, ms));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function uid(n = 8) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export const nowISO = () => new Date().toISOString();
export const daysAgo = (d: number, h = 0) => new Date(Date.now() - (d * 24 + h) * 3600_000).toISOString();

export const normEmail = (e: string) => e.trim().toLowerCase();
/** "9123 4567" / "+65 9123-4567" → "+6591234567". */
export function normPhone(p: string) {
  const digits = p.replace(/\D/g, '');
  const local = digits.length === 10 && digits.startsWith('65') ? digits.slice(2) : digits;
  return `+65${local}`;
}
