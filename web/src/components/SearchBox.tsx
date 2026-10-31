import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Landmark, Loader2, MapPin, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { SearchResponse } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { cx } from './ui';

type Option =
  | { kind: 'dest'; key: string; label: string; sub: string; slug: string }
  | { kind: 'place'; key: string; label: string; sub: string; lat: number; lng: number };

/** Combobox searching curated destinations + OpenStreetMap places. */
export function SearchBox({ large, onPlace, placeholder }: { large?: boolean; onPlace?: (p: { name: string; lat: number; lng: number }) => void; placeholder?: string }) {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setRes(await api<SearchResponse>(`/search?q=${encodeURIComponent(term)}`, { signal: ac.signal }));
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options: Option[] = [
    ...(res?.destinations ?? []).map((d) => ({ kind: 'dest' as const, key: `d-${d.id}`, label: pick(d.name, d.nameHi), sub: `${d.city} · Tripzee guide`, slug: d.slug })),
    ...(res?.places ?? []).map((p, i) => ({ kind: 'place' as const, key: `p-${i}`, label: p.name, sub: p.displayName, lat: p.lat, lng: p.lng })),
  ];

  function choose(o: Option) {
    setOpen(false);
    if (o.kind === 'dest') navigate(`/destinations/${o.slug}`);
    else if (onPlace) onPlace({ name: o.label, lat: o.lat, lng: o.lng });
    else navigate(`/map?lat=${o.lat}&lng=${o.lng}&name=${encodeURIComponent(o.label)}`);
  }

  return (
    <div ref={wrap} className="relative w-full">
      <div className={cx('flex items-center gap-2 rounded-2xl border border-line bg-white px-4 shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100', large ? 'py-3.5' : 'py-2.5')}>
        <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <input
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t('common.search')}
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && options[active]) {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder ?? t('home.searchPlaceholder')}
          className={cx('w-full bg-transparent outline-none placeholder:text-slate-400', large ? 'text-base' : 'text-sm')}
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden />}
      </div>
      {open && q.trim().length >= 2 && !loading && (res || error) && (
        <ul id={listId} role="listbox" className="absolute z-[1000] mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          {error && <li className="p-3 text-sm text-red-700">{error}</li>}
          {res?.placesError && <li className="p-3 text-xs text-amber-800">{res.placesError}</li>}
          {options.length === 0 && !error && <li className="p-3 text-sm text-muted">No matches. Try a city like “Agra” or “Varanasi”.</li>}
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx('flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-slate-50')}
            >
              {o.kind === 'dest' ? <Landmark className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden /> : <MapPin className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden />}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{o.label}</span>
                <span className="block truncate text-xs text-muted">{o.sub}</span>
              </span>
            </li>
          ))}
          {(res?.places.length ?? 0) > 0 && <li className="px-3 pb-1 pt-2 text-[11px] text-slate-400">Map results © OpenStreetMap contributors</li>}
        </ul>
      )}
    </div>
  );
}
