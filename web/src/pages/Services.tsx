import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LocateFixed, MapPin } from 'lucide-react';
import { api, errorMessage, qs } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useGeolocation } from '../lib/useGeolocation';
import type { City, NearbyResult, PlaceType } from '../lib/types';
import { MapView, PIN_COLORS } from '../components/MapView';
import { NearbyItem, PLACE_TYPE_LABELS } from '../components/NearbyList';
import { SearchBox } from '../components/SearchBox';
import { Button, EmptyState, Notice, PageHeader, Select, Spinner, cx } from '../components/ui';

interface Anchor {
  name: string;
  lat: number;
  lng: number;
}

const TYPES = Object.keys(PLACE_TYPE_LABELS) as PlaceType[];

export default function Services() {
  const [params, setParams] = useSearchParams();
  const geo = useGeolocation();
  const cities = useAsync((signal) => api<City[]>('/destinations/cities', { signal }), []);
  const type = (TYPES.includes(params.get('type') as PlaceType) ? params.get('type') : 'hotel') as PlaceType;
  const [radius, setRadius] = useState(3000);
  const [anchor, setAnchor] = useState<Anchor | null>(() => {
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    return params.get('lat') && Number.isFinite(lat) && Number.isFinite(lng) ? { name: params.get('near') ?? 'Selected location', lat, lng } : null;
  });
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (geo.position) setAnchor({ name: 'Your location', lat: geo.position.lat, lng: geo.position.lng });
  }, [geo.position]);

  useEffect(() => {
    if (!anchor) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    api<NearbyResult>(`/places/nearby${qs({ lat: anchor.lat.toFixed(5), lng: anchor.lng.toFixed(5), type, radius })}`, { signal: ac.signal })
      .then(setResult)
      .catch((e) => (e as Error).name !== 'AbortError' && setError(errorMessage(e)))
      .finally(() => !ac.signal.aborted && setLoading(false));
    return () => ac.abort();
  }, [anchor, type, radius]);

  const setType = (t: PlaceType) => {
    const next = new URLSearchParams(params);
    next.set('type', t);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Hotels, food & local services" subtitle="Real places from OpenStreetMap — stays, restaurants, hospitals, pharmacies, ATMs, fuel, transport and parking." />

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <SearchBox placeholder="Search an area, landmark or address…" onPlace={(p) => setAnchor(p)} />
        <Select aria-label="Pick a city" value="" onChange={(e) => { const c = cities.data?.find((x) => x.name === e.target.value); if (c) setAnchor({ name: `${c.name} centre`, lat: c.lat, lng: c.lng }); }}>
          <option value="">Or pick a city…</option>
          {cities.data?.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </Select>
        <Button variant="secondary" onClick={geo.locate} loading={geo.loading}><LocateFixed className="h-4 w-4" /> Near me</Button>
      </div>
      {geo.error && <Notice tone="warn" className="mb-4">{geo.error}</Notice>}

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} aria-pressed={type === t} className={cx('rounded-full border px-3.5 py-1.5 text-sm font-medium', type === t ? 'border-brand-700 bg-brand-700 text-white' : 'border-line text-muted hover:text-ink')}>
            {PLACE_TYPE_LABELS[t]}
          </button>
        ))}
        <Select aria-label="Radius" className="ml-auto w-auto" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
          <option value={1000}>Within 1 km</option>
          <option value={3000}>Within 3 km</option>
          <option value={5000}>Within 5 km</option>
          <option value={10000}>Within 10 km</option>
        </Select>
      </div>

      {(type === 'hospital' || type === 'police' || type === 'pharmacy') && (
        <Notice tone="error" className="mb-4">In an emergency call <strong>112</strong> (India's national emergency number) first.</Notice>
      )}

      {!anchor ? (
        <EmptyState icon={<MapPin className="h-8 w-8" />} title="Choose where to look">Search an area, pick a city, or share your location (only when you tap “Near me”).</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted">Showing {PLACE_TYPE_LABELS[type].toLowerCase()} near <strong className="text-ink">{anchor.name}</strong></p>
            {loading ? <Spinner label="Searching OpenStreetMap…" /> : error ? <Notice tone="error">{error}</Notice> : result && result.places.length === 0 ? (
              <EmptyState title="Nothing found nearby">OpenStreetMap has no {PLACE_TYPE_LABELS[type].toLowerCase()} mapped within this radius. Try a larger radius.</EmptyState>
            ) : result ? (
              <>
                <ul className="space-y-2">{result.places.map((p) => <NearbyItem key={p.id} p={p} onFocus={() => setFocus([p.lat, p.lng])} />)}</ul>
                <p className="text-xs text-muted">
                  {result.attribution} · via {result.source === 'overpass' ? 'Overpass API' : 'Nominatim (fallback)'}. Details like phone, hours and stars come from community data and may be out of date.
                  Tripzee doesn't make bookings — contact places directly.
                </p>
              </>
            ) : null}
          </div>
          <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            <MapView
              className="h-[50vh] lg:h-full"
              ariaLabel="Services map"
              flyTo={focus}
              fitPoints={[[anchor.lat, anchor.lng], ...(result?.places.slice(0, 20).map((p) => [p.lat, p.lng] as [number, number]) ?? [])]}
              markers={[
                { id: 'anchor', lat: anchor.lat, lng: anchor.lng, color: '#0f172a', popup: anchor.name },
                ...(result?.places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: PIN_COLORS[p.type], popup: p.name })) ?? []),
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
