import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Plus, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { fmtDate } from '../lib/format';
import type { RoomDetail, RoomSummary, TripSummary } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Notice, PageHeader, Select, Spinner } from '../components/ui';

export default function Rooms() {
  const navigate = useNavigate();
  const rooms = useAsync((signal) => api<RoomSummary[]>('/rooms', { signal }), []);
  const trips = useAsync((signal) => api<TripSummary[]>('/trips', { signal }), []);
  const [name, setName] = useState('');
  const [tripId, setTripId] = useState('');
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy('create');
    setError(null);
    try {
      const r = await api<RoomDetail>('/rooms', { method: 'POST', body: { name, tripId: tripId || undefined } });
      navigate(`/rooms/${r.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy('join');
    setError(null);
    try {
      const r = await api<RoomDetail>('/rooms/join', { method: 'POST', body: { code: code.trim() } });
      navigate(`/rooms/${r.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader title="Travel Rooms" subtitle="Coordinate group trips: shared itinerary, chat, meeting points and opt-in live location." />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {rooms.error ? <ErrorState error={rooms.error} onRetry={rooms.reload} /> : rooms.loading && !rooms.data ? <Spinner /> : rooms.data?.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} title="No Travel Rooms yet">Create one for your next group trip, or join with an invite code from a friend.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rooms.data?.map((r) => (
                <li key={r.id}>
                  <Link to={`/rooms/${r.id}`} className="block rounded-2xl border border-line bg-white p-5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{r.name}</h3>
                      {r.isOwner && <Badge tone="brand">Owner</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{r.memberCount} member{r.memberCount === 1 ? '' : 's'}</p>
                    {r.trip && <p className="mt-2 text-sm">{r.trip.title} · {fmtDate(r.trip.startDate, { day: 'numeric', month: 'short' })}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Create a room</h2>
            <form onSubmit={create} className="space-y-3">
              <Field label="Room name"><Input required minLength={2} maxLength={120} placeholder="e.g. Varanasi with college friends" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Link a trip (optional)" hint="Members can view the itinerary and add expenses.">
                <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  <option value="">No trip</option>
                  {trips.data?.filter((t) => t.role === 'owner').map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </Select>
              </Field>
              <Button type="submit" className="w-full" loading={busy === 'create'}><Plus className="h-4 w-4" /> Create room</Button>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Join with a code</h2>
            <form onSubmit={join} className="flex gap-2">
              <Input aria-label="Invite code" required pattern="[A-Za-z0-9]{6,12}" placeholder="ABCD2345" className="uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} />
              <Button type="submit" loading={busy === 'join'}>Join</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
