// The app's single entry to data. Screens import `api` from here only.
//
// Sign-in and the profile come from Eutility's server (./http.ts). When the
// server uses FXMedia (CUSTOMER_SOURCE=fxmedia), so do the savings check and
// the switch: FXMedia's plans and prices, and a sign-up FXMedia records, the
// same as the WhatsApp chatbot's. Everything else (bills, switch progress,
// rewards, notices) still comes from the on-device mock (./mock), as does
// pricing when the server doesn't use FXMedia. EXPO_PUBLIC_API=mock makes the
// whole app mock again — no server needed.

import { longDate } from '@/lib/format';
import { fxmedia, httpApi, type FxQuote } from './http';
import { mockApi, rememberQuote } from './mock';
import { planById, quote } from './mock/pricing';
import { ApiError, type Api, type SavingsQuote } from './types';

export const MOCK = process.env.EXPO_PUBLIC_API === 'mock';

// Until the server is hosted, a test build that can't reach it signs in on the
// device instead, so the demo accounts always work. Email sign-in (the server
// has none yet) does the same. A device session's token starts "mock.".
// Release builds never fall back: they show the connection error.
const DEVICE_FALLBACK = __DEV__;
let onDevice = false; // the sign-in in progress went to the device

const deviceSession = async () => (await mockApi.auth.restore())?.token.startsWith('mock.') ?? false;

/** Ask the server; if it can't be reached in a test build, ask the device. */
async function serverOrDevice<T>(server: () => Promise<T>, device: () => Promise<T>): Promise<T> {
  try {
    const r = await server();
    onDevice = false;
    return r;
  } catch (e) {
    if (!(DEVICE_FALLBACK && e instanceof ApiError && e.code === 'network')) throw e;
    onDevice = true;
    return device();
  }
}

const auth: Api['auth'] = {
  requestOtp: (phone) => serverOrDevice(() => httpApi.auth.requestOtp(phone), () => mockApi.auth.requestOtp(phone)),
  verifyOtp: (phone, code) => (onDevice ? mockApi.auth.verifyOtp(phone, code) : httpApi.auth.verifyOtp(phone, code)),
  register: (token, details) => (onDevice ? mockApi.auth.register(token, details) : httpApi.auth.register(token, details)),
  signInWithEmail: (email, password) =>
    DEVICE_FALLBACK ? mockApi.auth.signInWithEmail(email, password) : httpApi.auth.signInWithEmail(email, password),
  async signOut() {
    return (await deviceSession()) ? mockApi.auth.signOut() : httpApi.auth.signOut();
  },
  async restore() {
    if (DEVICE_FALLBACK && (await deviceSession())) return mockApi.auth.restore();
    return httpApi.auth.restore();
  },
};

const customer: Api['customer'] = {
  async me() { return (await deviceSession()) ? mockApi.customer.me() : httpApi.customer.me(); },
  async update(patch) { return (await deviceSession()) ? mockApi.customer.update(patch) : httpApi.customer.update(patch); },
};

/** Keep the server's profile in step when the mock changes usage or plan. */
async function sync(patch: { monthlyKwh?: number; currentPlanId?: string }) {
  // Device session first: the server's restore() would sign a device session out.
  if ((await deviceSession()) || !(await httpApi.auth.restore())) return;
  await httpApi.customer.update(patch).catch(() => { /* offline: the next check sets it */ });
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * FXMedia's plans, priced against what the customer pays now. FXMedia compares
 * with the SP tariff (it doesn't know a customer's own rate); `local` prices
 * the customer's current plan from the price sheet, as the device always has.
 */
function fromFxmedia(local: SavingsQuote, fx: FxQuote): SavingsQuote {
  const now = local.current.monthly;
  const priced = fx.plans
    .filter((p) => typeof p.monthly === 'number')
    .map((p) => ({ ...p, savingMonthly: cents(now - p.monthly), savingYearly: cents((now - p.monthly) * 12) }))
    .sort((a, b) => a.monthly - b.monthly);
  const best = priced[0];
  const alreadyBest = !best || best.savingMonthly <= 0;
  return {
    ...local,
    recommended: alreadyBest ? null : best,
    alternatives: alreadyBest ? priced.slice(0, 5) : priced.slice(1, 6),
    alreadyBest,
    ratesAsAt: fx.calculatedOn ? longDate(fx.calculatedOn) : local.ratesAsAt,
  };
}

const liveApi: Api = {
  ...mockApi,
  auth,
  customer,
  savings: {
    ...mockApi.savings,
    async quote(input) {
      if (!(await deviceSession())) {
        const local = quote(input);
        const fx = await fxmedia.quote({
          kwh: input.kwh, currentRetailer: local.current.plan.retailer, currentPlanId: local.input.currentPlanId,
          contract: input.contract, greenOnly: input.greenOnly,
        });
        if (fx) { // the server saved usage and current plan on the contact already
          const q = fromFxmedia(local, fx);
          await rememberQuote(q);
          return q;
        }
      }
      const q = await mockApi.savings.quote(input);
      await sync({ monthlyKwh: input.kwh, currentPlanId: q.input.currentPlanId });
      return q;
    },
  },
  applications: {
    ...mockApi.applications,
    async create(input) {
      // An FXMedia plan (not in the price sheet): FXMedia records the sign-up first, then
      // the device tracks the switch as before. A plan they no longer offer stops here.
      if (input.planId && !planById(input.planId) && !(await deviceSession())) await fxmedia.signUp(input.planId);
      return mockApi.applications.create(input);
    },
  },
  demo: mockApi.demo && {
    ...mockApi.demo,
    async advanceApplication(id) {
      const app = await mockApi.demo!.advanceApplication(id);
      if (app?.status === 'active' && app.plan) await sync({ currentPlanId: app.plan.id });
      return app;
    },
  },
};

export const api: Api = MOCK ? mockApi : liveApi;

export * from './types';
