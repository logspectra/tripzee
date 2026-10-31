import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Car, Crosshair, Footprints, LocateFixed, MapPin, Route as RouteIcon, X } from 'lucide-react';
import { api, errorMessage, qs } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { useGeolocation } from '../lib/useGeolocation';
import { km, minutes } from '../lib/format';
import type { DestinationCard, NearbyResult, Page, PlaceType, RouteResult } from '../lib/types';
import { MapView, PIN_COLORS, type MapMarker } from '../components/MapView';
import { SearchBox } from '../components/SearchBox';
import { NearbyItem, PLACE_TYPE_LABELS } from '../components/NearbyList';
import { Button, Notice, Select, Spinner, Tabs, cx } from '../components/ui';

interface Point {
  name: string;
  lat: number;
  lng: number;
}

export default function MapExplorer() {
  const { pick } = useI18n();
  const [params] = useSearchParams();
  const geo = useGeolocation();
  const dests = useAsync((signal) => api<Page<DestinationCard>>('/destinations?pageSize=60', { signal }), []);
  const all = useMemo(() => dests.data?.items ?? [], [dests.data]);

  const [selected, setSelected] = useState<Point | null>(() => {
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    return params.get('lat') && Number.isFinite(lat) && Number.isFinite(lng) ? { name: params.get('name') ?? 'Selected place', lat, lng } : null;
  });
  const [panel, setPanel] = useState<'nearby' | 'directions'>(params.get('to') ? 'directions' : 'nearby');
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  // Directions
  const [fromKey, setFromKey] = useState<string>('me');
  const [toKey, setToKey] = useState<string>(params.get('to') ?? '');
  const [mode, setMode] = useState<'driving' | 'walking'>('driving');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeErr, setRouteErr] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);

  // Nearby
  const [type, setType] = useState<PlaceType>('restaurant');
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [nearbyErr, setNearbyErr] = useState<string | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [activePlace, setActivePlace] = useState<string | null>(null);

  const anchor: Point | null = selected ?? (geo.position ? { name: 'Your location', ...geo.position } : null);

  useEffect(() => {
    if (panel !== 'nearby' || !anchor) return;
    const ac = new AbortController();
    setNearbyLoading(true);
    setNearbyErr(null);
    api<NearbyResult>(`/places/nearby${qs({ lat: anchor.lat.toFixed(5), lng: anchor.lng.toFixed(5), type, radius: 3000 })}`, { signal: ac.signal })
      .then(setNearby)
      .catch((e) => (e as Error).name !== 'AbortError' && setNearbyErr(errorMessage(e)))
      .finally(() => !ac.signal.aborted && setNearbyLoading(false));
    return () => ac.abort();
  }, [panel, anchor?.lat, anchor?.lng, type]); // eslint-disable-line react-hooks/exhaustive-deps

  function resolve(key: string): Point | null {
    if (key === 'me') return geo.position ? { name: 'Your location', ...geo.position } : null;
    if (key === 'selected') return selected;
    const d = all.find((x) => x.slug === key);
    return d ? { name: d.name, lat: d.lat, lng: d.lng } : null;
  }

  async function getRoute() {
    const from = resolve(fromKey);
    const to = resolve(toKey);
    setRouteErr(null);
    if (!from) {
      if (fromKey === 'me') geo.locate();
      return setRouteErr(fromKey === 'me' ? 'Allow location access (or pick another start point), then try again.' : 'Choose a start point.');
    }
    if (!to) return setRouteErr('Choose a destination.');
    setRouting(true);
    try {
      setRoute(await api<RouteResult>(`/route${qs({ fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng, mode })}`));
    } catch (e) {
      setRouteErr(errorMessage(e));
    } finally {
      setRouting(false);
    }
  }

  const markers: MapMarker[] = [
    ...all.map((d) => ({
      id: d.id,
      lat: d.lat,
      lng: d.lng,
      color: PIN_COLORS[d.category.slug as keyof typeof PIN_COLORS] ?? PIN_COLORS.landmark,
      popup: (
        <div className="space-y-1">
          <strong>{pick(d.name, d.nameHi)}</strong>
          <div>{d.city}</div>
          <div className="flex gap-3">
            <Link to={`/destinations/${d.slug}`}>Details →</Link>
            <button className="text-teal-700" onClick={() => { setToKey(d.slug); setPanel('directions'); }}>Directions</button>
            <button className="text-teal-700" onClick={() => { setSelected({ name: d.name, lat: d.lat, lng: d.lng }); setPanel('nearby'); }}>Nearby</button>
          </div>
        </div>
      ),
    })),
    ...(panel === 'nearby' && nearby
      ? nearby.places.map((p) => ({ id: `n-${p.id}`, lat: p.lat, lng: p.lng, color: PIN_COLORS[p.type], label: p.name, popup: p.name, onClick: () => setActivePlace(p.id) }))
      : []),
    ...(selected ? [{ id: 'selected', lat: selected.lat, lng: selected.lng, color: '#0f172a', popup: selected.name }] : []),
  ];

  const fitPoints = useMemo<[number, number][]>(() => {
    if (route) return route.geometry;
    if (panel === 'nearby' && anchor && nearby?.places.length) {
      return [[anchor.lat, anchor.lng], ...nearby.places.slice(0, 15).map((p) => [p.lat, p.lng] as [number, number])];
    }
    if (anchor) return [[anchor.lat, anchor.lng]];
    return all.map((d) => [d.lat, d.lng] as [number, number]);
  }, [route, panel, anchor?.lat, anchor?.lng, nearby, all]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-6 sm:px-6 lg:h-[calc(100vh-4rem)] lg:grid-cols-[400px_1fr]">
      <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
        <SearchBox placeholder="Search a place to explore…" onPlace={(p) => { setSelected(p); setFlyTo([p.lat, p.lng]); setRoute(null); }} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={geo.locate} loading={geo.loading}>
            <LocateFixed className="h-4 w-4" /> Use my location
          </Button>
          <span className="text-xs text-muted">Only used when you tap — never stored.</span>
        </div>
        {geo.error && <Notice tone="warn">{geo.error}</Notice>}
        {selected && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-ink" /> <span className="truncate">{selected.name}</span></span>
            <button onClick={() => setSelected(null)} aria-label="Clear selected place" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted"><Crosshair className="h-3.5 w-3.5" /> Tip: tap anywhere on the map to drop a pin.</p>

        <Tabs value={panel} onChange={setPanel} tabs={[{ value: 'nearby', label: 'Nearby' }, { value: 'directions', label: 'Directions' }]} />

        {panel === 'nearby' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PLACE_TYPE_LABELS) as PlaceType[]).map((t) => (
                <button key={t} onClick={() => setType(t)} aria-pressed={type === t} className={cx('rounded-full border px-3 py-1 text-xs font-medium', type === t ? 'border-brand-700 bg-brand-700 text-white' : 'border-line text-muted hover:text-ink')}>
                  {PLACE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {!anchor ? (
              <Notice tone="info">Search a place, tap the map, or use your location to see what's nearby.</Notice>
            ) : nearbyLoading ? (
              <Spinner label="Finding nearby places…" />
            ) : nearbyErr ? (
              <Notice tone="error">{nearbyErr}</Notice>
            ) : nearby && nearby.places.length === 0 ? (
              <Notice tone="info">No {PLACE_TYPE_LABELS[type].toLowerCase()} found within 3 km in OpenStreetMap.</Notice>
            ) : nearby ? (
              <>
                <p className="text-xs text-muted">{nearby.places.length} results within 3 km of {anchor.name} · {nearby.attribution}</p>
                <ul className="space-y-2">
                  {nearby.places.map((p) => (
                    <NearbyItem key={p.id} p={p} active={activePlace === p.id} onFocus={() => { setActivePlace(p.id); setFlyTo([p.lat, p.lng]); }} />
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium">From
              <Select className="mt-1" value={fromKey} onChange={(e) => setFromKey(e.target.value)}>
                <option value="me">My current location</option>
                {selected && <option value="selected">Pinned: {selected.name}</option>}
                {all.map((d) => <option key={d.slug} value={d.slug}>{d.name} ({d.city})</option>)}
              </Select>
            </label>
            <label className="block text-sm font-medium">To
              <Select className="mt-1" value={toKey} onChange={(e) => setToKey(e.target.value)}>
                <option value="">Choose a destination…</option>
                {selected && <option value="selected">Pinned: {selected.name}</option>}
                {all.map((d) => <option key={d.slug} value={d.slug}>{d.name} ({d.city})</option>)}
              </Select>
            </label>
            <div className="flex gap-2">
              <Button variant={mode === 'driving' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('driving')} aria-pressed={mode === 'driving'}><Car className="h-4 w-4" /> Drive</Button>
              <Button variant={mode === 'walking' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('walking')} aria-pressed={mode === 'walking'}><Footprints className="h-4 w-4" /> Walk</Button>
              <Button size="sm" className="ml-auto" onClick={getRoute} loading={routing}><RouteIcon className="h-4 w-4" /> Get route</Button>
            </div>
            {routeErr && <Notice tone="error">{routeErr}</Notice>}
            {route && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-muted">Distance</p><p className="text-lg font-semibold">{km(route.distanceKm)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-muted">Est. time</p><p className="text-lg font-semibold">{minutes(route.durationMin)}</p></div>
                </div>
                {route.approximate ? <Notice tone="warn">{route.note}</Notice> : <p className="text-xs text-muted">Route by {route.source}. Times exclude live traffic.</p>}
                {route.steps.length > 0 && (
                  <ol className="space-y-1.5 text-sm">
                    {route.steps.map((s, i) => (
                      <li key={i} className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-0">
                        <span>{s.instruction}</span>
                        {s.distanceM > 0 && <span className="shrink-0 text-xs text-muted">{km(s.distanceM / 1000)}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
      <MapView
        className="h-[60vh] lg:h-full"
        ariaLabel="Interactive map"
        markers={markers}
        route={route?.geometry}
        userLocation={geo.position}
        fitPoints={fitPoints}
        flyTo={flyTo}
        onMapClick={(lat, lng) => { setSelected({ name: `Pin ${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng }); setRoute(null); }}
      />
    </div>
  );
}
