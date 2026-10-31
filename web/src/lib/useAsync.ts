import { useCallback, useEffect, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

/** Runs an async loader on mount / when deps change; aborts stale requests. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load(ac.signal)
      .then((data) => !ac.signal.aborted && setState({ data, loading: false }))
      .catch((error) => !ac.signal.aborted && setState((s) => ({ data: s.data, error, loading: false })));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setState((s) => ({
      ...s,
      data: typeof updater === 'function' ? (updater as (p: T | undefined) => T)(s.data) : updater,
    }));
  }, []);

  return { ...state, reload, setData };
}
