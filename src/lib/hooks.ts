import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getVersion, subscribe } from '../data/store';

/** Re-render whenever the mock database changes (any mutation or role switch). */
export function useDbVersion() {
  return useSyncExternalStore(subscribe, getVersion);
}

export interface Query<T> {
  data?: T;
  error?: Error;
  loading: boolean;
  reload: () => void;
}

/** Run an async API call, re-running it after every database change. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const version = useDbVersion();
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (error: Error) => alive && setState({ error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}
