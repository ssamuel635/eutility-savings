// Minimal data hook: loads on focus (so tabs show fresh data when you come
// back to them), exposes refresh for pull-to-refresh. Swap for TanStack Query
// if caching needs grow once the real API is in.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useQuery<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { run(); }, [run]));

  return { data, error, loading, refreshing, refresh: () => run(true), setData };
}
