import { useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Globe, Phone } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { km } from '../lib/format';
import type { NearbyPlace, PlaceType } from '../lib/types';
import { Badge } from './ui';

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  hotel: 'Stays',
  restaurant: 'Food',
  hospital: 'Hospitals',
  pharmacy: 'Pharmacies',
  police: 'Police',
  atm: 'ATMs',
  fuel: 'Petrol',
  transport: 'Transport',
  parking: 'Parking',
};

function safeUrl(u: string) {
  const url = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    return new URL(url).protocol.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

export function NearbyItem({ p, onFocus, active }: { p: NearbyPlace; onFocus?: () => void; active?: boolean }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const website = p.website ? safeUrl(p.website) : null;
  return (
    <li className={`rounded-xl border p-3 text-sm ${active ? 'border-brand-200 bg-brand-50/50' : 'border-line bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onFocus} className="text-left font-medium text-ink hover:text-brand-700">{p.name}</button>
        <span className="shrink-0 text-xs text-muted">{km(p.distanceKm)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {p.subtype && <Badge>{p.subtype.replace(/_/g, ' ')}</Badge>}
        {p.stars && <Badge tone="amber">{p.stars}★ (OSM)</Badge>}
        {p.cuisine && <Badge tone="brand">{p.cuisine}</Badge>}
        {p.wheelchair === 'yes' && <Badge tone="blue">Wheelchair accessible (OSM)</Badge>}
      </div>
      {p.address && <p className="mt-1 text-xs text-muted">{p.address}</p>}
      {p.openingHours && <p className="mt-1 text-xs text-muted">Hours (from OSM): {p.openingHours}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {p.phone && (
          <a href={`tel:${p.phone.split(/[;,]/)[0].replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
            <Phone className="h-3.5 w-3.5" /> {p.phone.split(/[;,]/)[0]}
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
            <Globe className="h-3.5 w-3.5" /> Website
          </a>
        )}
        <a href={p.osmUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted hover:underline">
          OSM <ExternalLink className="h-3 w-3" />
        </a>
        {user && (
          <button
            className="ml-auto inline-flex items-center gap-1 text-muted hover:text-brand-700"
            disabled={saved}
            onClick={async () => {
              try {
                await api('/saved', { method: 'POST', body: { externalRef: p.id, name: p.name, kind: p.type, lat: p.lat, lng: p.lng } });
                setSaved(true);
              } catch (e) {
                setErr(errorMessage(e));
              }
            }}
          >
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />} {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </li>
  );
}
