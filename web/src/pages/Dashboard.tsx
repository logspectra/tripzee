import { Link } from 'react-router';
import { Bookmark, CalendarDays, MapPin, Plus, Trash2, Users, WifiOff } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/auth';
import { cachedTrips, useOnline } from '../lib/offline';
import { fmtDate, inr } from '../lib/format';
import type { SavedPlace, TripSummary } from '../lib/types';
import { DestinationCard } from '../components/DestinationCard';
import { Badge, Card, EmptyState, ErrorState, LinkButton, Notice, PageHeader, Spinner } from '../components/ui';

interface Dash {
  upcoming: TripSummary[];
  past: TripSummary[];
  saved: SavedPlace[];
  rooms: { id: string; name: string; members: number; owner: boolean }[];
  unreadNotifications: number;
}

function TripRow({ t }: { t: TripSummary }) {
  return (
    <Link to={`/trips/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 hover:shadow-md">
      <div className="min-w-0">
        <p className="truncate font-medium">{t.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(t.startDate, { day: 'numeric', month: 'short', year: 'numeric' })} · {t.days}d</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {t.city}</span>
          <span>{inr(t.budget)}</span>
        </p>
      </div>
      {t.role === 'member' && <Badge tone="blue">Group</Badge>}
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const online = useOnline();
  const dash = useAsync((signal) => api<Dash>('/me/dashboard', { signal }), []);

  if (!online && !dash.data) {
    const offline = cachedTrips();
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <PageHeader title="Offline trips" subtitle="Itineraries saved on this device." />
        <Notice tone="warn" className="mb-4"><span className="flex items-center gap-1.5"><WifiOff className="h-4 w-4" /> You're offline. Only trips you've opened before on this device are available.</span></Notice>
        {offline.length === 0 ? <EmptyState title="No offline trips">Open a trip while online to keep a copy on this device.</EmptyState> : (
          <div className="space-y-2">{offline.map((c) => <TripRow key={c.trip.id} t={{ ...c.trip, role: c.trip.isOwner ? 'owner' : 'member', createdAt: c.savedAt }} />)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title={`Hi, ${user?.name.split(' ')[0] ?? 'traveller'}`} subtitle="Your trips, saved places and travel rooms." actions={<LinkButton to="/plan"><Plus className="h-4 w-4" /> Plan a new trip</LinkButton>} />
      {dash.error ? <ErrorState error={dash.error} onRetry={dash.reload} /> : !dash.data ? <Spinner /> : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold">Upcoming trips</h2>
              {dash.data.upcoming.length === 0 ? (
                <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No upcoming trips" action={<LinkButton to="/plan">Plan a trip</LinkButton>}>Generate an itinerary in under a minute.</EmptyState>
              ) : <div className="space-y-2">{dash.data.upcoming.map((t) => <TripRow key={t.id} t={t} />)}</div>}
            </section>
            {dash.data.past.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Past trips</h2>
                <div className="space-y-2">{dash.data.past.map((t) => <TripRow key={t.id} t={t} />)}</div>
              </section>
            )}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Bookmark className="h-5 w-5" /> Saved places</h2>
              {dash.data.saved.length === 0 ? (
                <EmptyState title="Nothing saved yet" action={<LinkButton variant="secondary" to="/destinations">Explore destinations</LinkButton>}>Tap “Save” on any destination, hotel or restaurant.</EmptyState>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {dash.data.saved.map((s) => s.destination ? <DestinationCard key={s.id} d={s.destination} compact /> : (
                    <Card key={s.id} className="flex flex-col justify-between p-4">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs capitalize text-muted">{s.kind} · OpenStreetMap</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        {s.lat != null && <Link to={`/map?lat=${s.lat}&lng=${s.lng}&name=${encodeURIComponent(s.name)}`} className="text-brand-700 hover:underline">Show on map</Link>}
                        <button className="text-muted hover:text-red-700" aria-label={`Remove ${s.name}`} onClick={async () => { await api(`/saved/${s.id}`, { method: 'DELETE' }); dash.reload(); }}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-5 w-5" /> Travel Rooms</h2>
              {dash.data.rooms.length === 0 ? <p className="text-sm text-muted">No rooms yet. Create one from a trip to travel with friends.</p> : (
                <ul className="space-y-2 text-sm">
                  {dash.data.rooms.map((r) => (
                    <li key={r.id}><Link to={`/rooms/${r.id}`} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"><span>{r.name}</span><span className="text-muted">{r.members} 👥</span></Link></li>
                  ))}
                </ul>
              )}
              <LinkButton variant="secondary" to="/rooms" className="mt-3 w-full">Manage rooms</LinkButton>
            </Card>
            <Card className="p-5 text-sm text-muted">
              <p className="font-medium text-ink">Offline access</p>
              <p className="mt-1">Trips you open are kept on this device so you can read itineraries without a connection. Signing out clears them.</p>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
