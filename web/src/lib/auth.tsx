import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { clearOfflineData } from './offline';
import type { User } from './types';

interface Auth {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User | null }>('/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<Auth>(
    () => ({
      user,
      ready,
      refresh,
      login: async (email, password) => {
        const r = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
        setUser(r.user);
        return r.user;
      },
      register: async (name, email, password) => {
        const r = await api<{ user: User }>('/auth/register', { method: 'POST', body: { name, email, password } });
        setUser(r.user);
        return r.user;
      },
      logout: async () => {
        await api('/auth/logout', { method: 'POST' });
        clearOfflineData(); // don't leave itineraries on shared devices
        setUser(null);
      },
    }),
    [user, ready, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
