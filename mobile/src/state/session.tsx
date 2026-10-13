// Who's signed in. Wraps the app so the router can guard screens and every
// screen can read the customer without re-fetching it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Customer, type CustomerPatch, type Session } from '@/api';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  customer: Customer | null;
  /** Call with the session an auth method returned. */
  begin(session: Session): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  update(patch: CustomerPatch): Promise<Customer>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [customer, setCustomer] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await api.customer.me();
      setCustomer(c);
      setStatus('signedIn');
    } catch {
      setCustomer(null);
      setStatus('signedOut');
    }
  }, []);

  useEffect(() => {
    api.auth.restore().then((s) => (s ? load() : setStatus('signedOut')), () => setStatus('signedOut'));
  }, [load]);

  const value = useMemo<SessionValue>(() => ({
    status,
    customer,
    begin: async () => { await load(); },
    signOut: async () => {
      await api.auth.signOut();
      setCustomer(null);
      setStatus('signedOut');
    },
    refresh: load,
    update: async (patch) => {
      const c = await api.customer.update(patch);
      setCustomer(c);
      return c;
    },
  }), [status, customer, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside <SessionProvider>');
  return v;
}

/** For screens inside the signed-in area, where a customer always exists. */
export function useCustomer(): Customer {
  const { customer } = useSession();
  if (!customer) throw new Error('No signed-in customer');
  return customer;
}
