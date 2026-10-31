import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LayoutGrid, Map as MapIcon, SearchX } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import type { Category, City, DestinationCard as Card, Page } from '../lib/types';
import { DestinationCard } from '../components/DestinationCard';
import { MapView, PIN_COLORS } from '../components/MapView';
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Tabs } from '../components/ui';

const INTERESTS = ['history', 'architecture', 'spirituality', 'culture', 'nature', 'adventure', 'food', 'shopping'];

export default function Destinations() {
  const { locale, pick } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const q = params.get('q') ?? '';
  const city = params.get('city') ?? '';
  const category = params.get('category') ?? '';
  const interest = params.get('interest') ?? '';
  const sort = params.get('sort') ?? 'name';
  const page = Number(params.get('page') ?? 1);
  const [text, setText] = useState(q);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const list = useAsync(
    (signal) => api<Page<Card>>(`/destinations${qs({ q, city, category, interest, sort, page, pageSize: view === 'map' ? 60 : 12 })}`, { signal }),
    [q, city, category, interest, sort, page, view],
  );
  const cities = useAsync((signal) => api<City[]>('/destinations/cities', { signal }), []);
  const cats = useAsync((signal) => api<Category[]>('/categories', { signal }), []);
  const filtered = !!(q || city || category || interest);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Explore destinations"
        subtitle="Heritage sites, temples, ghats and wildlife across Uttar Pradesh."
        actions={
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: 'grid', label: <span className="flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" /> Grid</span> },
              { value: 'map', label: <span className="flex items-center gap-1.5"><MapIcon className="h-4 w-4" /> Map</span> },
            ]}
          />
        }
      />

      <form
        className="mb-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: text.trim() });
        }}
      >
        <Input aria-label="Search destinations" placeholder="Search by name, city…" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() !== q && set({ q: text.trim() })} />
        <Select aria-label="City" value={city} onChange={(e) => set({ city: e.target.value })}>
          <option value="">All cities</option>
          {cities.data?.map((c) => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </Select>
        <Select aria-label="Category" value={category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {cats.data?.map((c) => (
            <option key={c.slug} value={c.slug}>{locale === 'hi' ? c.nameHi : c.name}</option>
          ))}
        </Select>
        <Select aria-label="Interest" value={interest} onChange={(e) => set({ interest: e.target.value })}>
          <option value="">Any interest</option>
          {INTERESTS.map((i) => (
            <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>
          ))}
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="name">Sort: City & name</option>
          <option value="rating">Sort: Top rated</option>
        </Select>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        {list.data && <span>{list.data.total} place{list.data.total === 1 ? '' : 's'}</span>}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => { setText(''); setParams(new URLSearchParams()); }}>
            Clear filters
          </Button>
        )}
        <Badge tone="slate" className="ml-auto">Demo catalogue · facts labelled until verified</Badge>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState icon={<SearchX className="h-8 w-8" />} title="No destinations match" action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>}>
          Try another city or remove a filter.
        </EmptyState>
      ) : view === 'map' ? (
        <MapView
          className="h-[70vh]"
          ariaLabel="Destinations map"
          markers={(list.data?.items ?? []).map((d) => ({
            id: d.id,
            lat: d.lat,
            lng: d.lng,
            color: PIN_COLORS[d.category.slug as keyof typeof PIN_COLORS] ?? PIN_COLORS.landmark,
            popup: (
              <button className="text-left" onClick={() => navigate(`/destinations/${d.slug}`)}>
                <strong>{pick(d.name, d.nameHi)}</strong>
                <br />
                <span>{d.city} · View details →</span>
              </button>
            ),
          }))}
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.data?.items.map((d) => <DestinationCard key={d.id} d={d} />)}</div>
          {list.data && list.data.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</Button>
              <span className="text-sm text-muted">Page {page} of {list.data.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= list.data.totalPages} onClick={() => set({ page: String(page + 1) })}>Next</Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
