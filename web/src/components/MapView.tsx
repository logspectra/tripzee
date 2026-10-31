import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { cx } from './ui';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  popup?: ReactNode;
  onClick?: () => void;
}

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const iconCache = new Map<string, L.DivIcon>();
function pin(color: string, label = '') {
  const key = `${color}|${label}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const safe = label.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
    icon = L.divIcon({
      className: '',
      html: `<div class="tz-pin" style="background:${color}"><span>${safe}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -26],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const userIcon = L.divIcon({ className: '', html: '<div class="tz-dot" style="background:#2563eb"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function FitBounds({ points, padding = 40 }: { points: [number, number][]; padding?: number }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 14));
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FlyTo({ target }: { target?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function MapView({
  center = [26.85, 80.95],
  zoom = 7,
  markers = [],
  route,
  userLocation,
  fit = true,
  fitPoints,
  flyTo,
  onMapClick,
  className,
  ariaLabel = 'Map',
}: {
  /** Overrides which points the map fits to (defaults to all markers + route). */
  fitPoints?: [number, number][];
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: [number, number][] | null;
  userLocation?: { lat: number; lng: number; accuracy?: number | null } | null;
  fit?: boolean;
  flyTo?: [number, number] | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [tileErrors, setTileErrors] = useState(0);
  const loaded = useRef(false);
  const points = useMemo<[number, number][]>(
    () => fitPoints ?? [...markers.map((m) => [m.lat, m.lng] as [number, number]), ...(route ?? [])],
    [fitPoints, markers, route],
  );

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-line bg-slate-100', className ?? 'h-96')} role="region" aria-label={ariaLabel}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          eventHandlers={{
            tileload: () => {
              loaded.current = true;
            },
            tileerror: () => setTileErrors((n) => n + 1),
          }}
        />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pin(m.color ?? '#0f766e', m.label)}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
            title={typeof m.popup === 'string' ? m.popup : undefined}
          >
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#0f766e', weight: 5, opacity: 0.85 }} />}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} title="Your location" />
            {userLocation.accuracy ? <Circle center={[userLocation.lat, userLocation.lng]} radius={userLocation.accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }} /> : null}
          </>
        )}
        {fit && <FitBounds points={points} />}
        <FlyTo target={flyTo} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
      </MapContainer>
      {tileErrors > 4 && !loaded.current && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-white/95 p-3 text-sm text-muted shadow">
          Map tiles couldn't be loaded (offline or tile server unreachable). Places and directions below still work as a list.
        </div>
      )}
    </div>
  );
}

export const PIN_COLORS = {
  heritage: '#b45309',
  spiritual: '#7c3aed',
  nature: '#15803d',
  landmark: '#0369a1',
  hotel: '#0f766e',
  restaurant: '#c2410c',
  hospital: '#dc2626',
  pharmacy: '#db2777',
  police: '#1e3a8a',
  atm: '#4d7c0f',
  fuel: '#a16207',
  transport: '#4338ca',
  parking: '#475569',
  meeting: '#0f766e',
  member: '#2563eb',
  route: '#0f766e',
} as const;
