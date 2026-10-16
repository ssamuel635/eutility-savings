// The app's single entry to data. Screens import `api` from here only.
//
// Sign-in and the profile come from Eutility's server (./http.ts); everything
// the server doesn't serve yet (savings, bills, switches, rewards, notices)
// still comes from the on-device mock (./mock). EXPO_PUBLIC_API=mock makes
// the whole app mock again — no server needed.

import { httpApi } from './http';
import { mockApi } from './mock';
import type { Api } from './types';

export const MOCK = process.env.EXPO_PUBLIC_API === 'mock';

/** Keep the server's profile in step when the mock changes usage or plan. */
const sync = (patch: { monthlyKwh?: number; currentPlanId?: string }) =>
  httpApi.customer.update(patch).catch(() => { /* not signed in or offline: the next check sets it */ });

const liveApi: Api = {
  ...mockApi,
  auth: httpApi.auth,
  customer: httpApi.customer,
  savings: {
    ...mockApi.savings,
    async quote(input) {
      const q = await mockApi.savings.quote(input);
      if (await httpApi.auth.restore()) await sync({ monthlyKwh: input.kwh, currentPlanId: q.input.currentPlanId });
      return q;
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
