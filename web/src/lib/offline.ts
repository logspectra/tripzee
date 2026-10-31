import { useEffect, useState } from 'react';
import type { TripDetail } from './types';

const PREFIX = 'tz:trip:';

interface Cached {
  savedAt: string;
  trip: TripDetail;
}

/** Keeps the latest copy of each opened trip on-device so itineraries remain readable offline. */
export function cacheTrip(trip: TripDetail) {
  try {
    localStorage.setItem(PREFIX + trip.id, JSON.stringify({ savedAt: new Date().toISOString(), trip } satisfies Cached));
  } catch {
    // storage full or disabled — offline copy is best-effort
  }
}

export function cachedTrip(id: string): Cached | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

export function cachedTrips(): Cached[] {
  const out: Cached[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      const c = cachedTrip(k.slice(PREFIX.length));
      if (c) out.push(c);
    }
  }
  return out.sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
}

export function forgetTrip(id: string) {
  localStorage.removeItem(PREFIX + id);
}

export function clearOfflineData() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
  }
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
