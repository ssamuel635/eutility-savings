// Sign-in and the customer profile over fetch(), against Eutility's own
// server (server/auth in the website repo, run with `npm start`):
//
//   POST  /api/auth/otp · /api/auth/otp/verify · /api/auth/register · /api/auth/logout
//   GET / PATCH  /api/customers/me
//   POST  /api/savings/quote · /api/switch   (when the server uses FXMedia; see `fxmedia` below)
//
// The mobile number (+65XXXXXXXX) is the customer ID everywhere. The session
// token is kept where the mock keeps it (its on-device store), and a copy of
// the server's customer goes there too, so the parts the server doesn't serve
// yet (bills, switches, rewards, notices) keep working from the mock.
//
// EXPO_PUBLIC_API_URL  the computer running `npm start`, e.g. http://192.168.1.20:5173.
//                      Defaults: web → http://localhost:5173; Expo Go → the dev
//                      machine's address on port 5173.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { linkCustomer } from './mock';
import { db, save } from './mock/db';
import { ApiError, type Api, type ApiErrorCode, type ContractFilter, type Customer, type PricedPlan, type Session } from './types';

function baseUrl() {
  const set = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_CRM_URL;
  if (set) return set;
  if (Platform.OS === 'web') return 'http://localhost:5173';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:5173` : 'http://localhost:5173';
}
const BASE = baseUrl().replace(/\/+$/, '');

const CODES: ApiErrorCode[] = ['invalid_code', 'invalid_login', 'expired', 'not_signed_in', 'network', 'validation'];
const OFFLINE = 'We couldn’t reach Eutility. Check your connection and try again.';

async function token() {
  return (await db()).session?.token ?? null;
}

async function forget() {
  const d = await db();
  if (d.session) { d.session = null; await save(); }
}

/** One call to the server. Errors come back as ApiError with the server's message. */
async function request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = await token();
    if (!t) throw new ApiError('not_signed_in', 'Please sign in again.');
    headers.Authorization = `Bearer ${t}`;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch {
    throw new ApiError('network', OFFLINE);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;
  if (res.status === 404 && (!data.code || data.code === 'not_available')) throw new NotAvailable();

  const message = typeof data.error === 'string' && data.error ? data.error : OFFLINE;
  if (res.status === 401) {
    if (auth) await forget();
    throw new ApiError('not_signed_in', message);
  }
  if (CODES.includes(data.code)) throw new ApiError(data.code, message);
  throw new ApiError(res.status >= 500 ? 'network' : 'validation', message);
}

type Signed = { session: Session; customer: Customer };

/** The server doesn't serve this (it isn't using FXMedia): the caller does it on the device. */
export class NotAvailable extends Error {}

/** FXMedia's comparison as the server returns it; savings are against the SP tariff. */
export interface FxQuote {
  calculatedOn: string | null;
  current: { provider: string | null; monthly: number | null };
  plans: PricedPlan[];
}

/** Savings check and switch through FXMedia (server/fxmedia/routes.js). null = not available here. */
export const fxmedia = {
  async quote(input: { kwh: number; currentRetailer: string; currentPlanId: string; contract: ContractFilter; greenOnly: boolean }) {
    try {
      return await request<FxQuote>('POST', '/api/savings/quote', input, true);
    } catch (e) {
      if (e instanceof NotAvailable) return null;
      throw e;
    }
  },
  async signUp(planId: string, promoCode = '') {
    return request<{ reference: string; duplicate: boolean; signedAt: string | null; promoApplied: boolean }>('POST', '/api/switch', { planId, promoCode }, true);
  },
};

export const httpApi: Pick<Api, 'auth' | 'customer'> = {
  auth: {
    async requestOtp(phone) {
      return request('POST', '/api/auth/otp', { phone });
    },
    async verifyOtp(phone, code) {
      const r = await request<({ status: 'existing' } & Signed) | { status: 'new'; registrationToken: string }>(
        'POST', '/api/auth/otp/verify', { phone, code });
      if (r.status === 'new') return { status: 'new', registrationToken: r.registrationToken };
      await linkCustomer(r.customer, r.session);
      return { status: 'existing', session: r.session };
    },
    async register(registrationToken, { fullName, email, address, postal, dwelling, referredBy }) {
      // The server has no passwords: sign-in is by SMS code only.
      const r = await request<Signed>('POST', '/api/auth/register', { registrationToken, fullName, email, address, postal, dwelling, referredBy });
      await linkCustomer(r.customer, r.session, { welcome: true });
      return r.session;
    },
    async signInWithEmail() {
      throw new ApiError('invalid_login', 'Email sign-in isn’t available yet. Please continue with your mobile number.');
    },
    async signOut() {
      try { await request('POST', '/api/auth/logout', undefined, true); } catch { /* signed out on this device regardless */ }
      await forget();
    },
    async restore() {
      const s = (await db()).session;
      if (s?.token.startsWith('mock.')) { await forget(); return null; } // left from a fully-mock build
      return s;
    },
  },

  customer: {
    async me() {
      const { customer } = await request<{ customer: Customer }>('GET', '/api/customers/me', undefined, true);
      await linkCustomer(customer);
      return customer;
    },
    async update(patch) {
      const { customer } = await request<{ customer: Customer }>('PATCH', '/api/customers/me', patch, true);
      await linkCustomer(customer);
      return customer;
    },
  },
};
