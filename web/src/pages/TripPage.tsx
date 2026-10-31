import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CalendarDays, Copy, Hotel, Link2, Link2Off, Pencil, RefreshCw, Trash2, Users, WifiOff } from 'lucide-react';
import { ApiError, api, errorMessage } from '../lib/api';
import { cacheTrip, cachedTrip, forgetTrip } from '../lib/offline';
import { fmtDate, fmtDateTime, inr } from '../lib/format';
import type { ItineraryItem, RoomDetail, TripDetail } from '../lib/types';
import { ItineraryTimeline } from '../components/Itinerary';
import { ItineraryEditor } from '../components/ItineraryEditor';
import { BudgetPanel } from '../components/BudgetPanel';
import { MapView, PIN_COLORS } from '../components/MapView';
import { Badge, Button, Card, ErrorState, Field, Input, LinkButton, Notice, Spinner, Tabs, Textarea } from '../components/ui';

type Tab = 'itinerary' | 'budget' | 'map' | 'details';

export default function TripPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [offlineCopy, setOfflineCopy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('itinerary');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setError(null);
    try {
      const t = await api<TripDetail>(`/trips/${id}`);
      setTrip(t);
      setOfflineCopy(null);
      cacheTrip(t);
    } catch (e) {
      const cached = cachedTrip(id);
      if (e instanceof ApiError && e.status === 0 && cached) {
        setTrip({ ...cached.trip, canEdit: false });
        setOfflineCopy(cached.savedAt);
      } else {
        if (e instanceof ApiError && e.status === 404) forgetTrip(id);
        setError(e);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<TripDetail>) => setTrip((t) => {
    if (!t) return t;
    const next = { ...t, ...p };
    cacheTrip(next);
    return next;
  });

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setActionError(null);
    try {
      return await fn();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={error} onRetry={load} /></div>;
  if (!trip) return <Spinner />;

  const shareUrl = trip.shareToken ? `${window.location.origin}/shared/${trip.shareToken}` : null;
  const pins = trip.items.filter((i) => i.lat != null && i.lng != null && i.kind !== 'travel');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {offlineCopy && (
        <Notice tone="warn" className="mb-4">
          <span className="flex items-center gap-1.5"><WifiOff className="h-4 w-4" /> Offline copy saved on this device {fmtDateTime(offlineCopy)}. Editing and live data need a connection.</span>
        </Notice>
      )}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-muted"><Link to="/dashboard" className="hover:underline">My trips</Link> / {trip.city}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{trip.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} ({trip.days} day{trip.days > 1 ? 's' : ''})</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {trip.travellers}</span>
            <span>From {trip.origin}</span>
            <span>Budget {inr(trip.budget)}</span>
            <Badge>{trip.generatedBy.startsWith('llm') ? 'AI plan' : trip.generatedBy === 'manual' ? 'Custom plan' : 'Rule-based plan'}{trip.generatedBy.includes('edited') ? ' · edited' : ''}</Badge>
            {!trip.isOwner && <Badge tone="blue">Shared with you via Travel Room</Badge>}
          </p>
        </div>
        {trip.canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={busy === 'regen'} onClick={() => confirm('Replace the itinerary with a freshly generated one? Your expenses are kept.') && run('regen', async () => patch(await api<TripDetail>(`/trips/${id}/regenerate`, { method: 'POST' })))}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
            {trip.rooms.length > 0 ? (
              <LinkButton variant="secondary" to={`/rooms/${trip.rooms[0].id}`}><Users className="h-4 w-4" /> Open Travel Room</LinkButton>
            ) : (
              <Button variant="secondary" size="sm" loading={busy === 'room'} onClick={() => run('room', async () => {
                const room = await api<RoomDetail>('/rooms', { method: 'POST', body: { name: trip.title, tripId: trip.id } });
                navigate(`/rooms/${room.id}`);
              })}>
                <Users className="h-4 w-4" /> Travel with friends
              </Button>
            )}
            <Button variant="danger" size="sm" loading={busy === 'delete'} onClick={() => confirm('Delete this trip permanently?') && run('delete', async () => {
              await api(`/trips/${id}`, { method: 'DELETE' });
              forgetTrip(id);
              navigate('/dashboard');
            })}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      {actionError && <Notice tone="error" className="mb-4">{actionError}</Notice>}

      {trip.isOwner && !offlineCopy && (
        <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm">
            <p className="font-medium">Share a read-only link</p>
            <p className="text-muted">{shareUrl ? 'Anyone with the link can view the itinerary and planned budget — not your expenses.' : 'Create a link to share the plan with family or friends.'}</p>
          </div>
          {shareUrl ? (
            <div className="flex flex-wrap gap-2">
              <Input readOnly value={shareUrl} className="w-72" aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="ghost" size="sm" loading={busy === 'unshare'} onClick={() => run('unshare', async () => { await api(`/trips/${id}/share`, { method: 'DELETE' }); patch({ shareToken: null }); })}>
                <Link2Off className="h-4 w-4" /> Disable
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" loading={busy === 'share'} onClick={() => run('share', async () => patch({ shareToken: (await api<{ shareToken: string }>(`/trips/${id}/share`, { method: 'POST' })).shareToken }))}>
              <Link2 className="h-4 w-4" /> Create link
            </Button>
          )}
        </Card>
      )}

      <div className="mb-6">
        <Tabs value={tab} onChange={(v) => { setTab(v); setEditing(false); }} tabs={[
          { value: 'itinerary', label: 'Itinerary' },
          { value: 'budget', label: 'Budget & expenses' },
          { value: 'map', label: 'Map' },
          { value: 'details', label: 'Details & notes' },
        ]} />
      </div>

      {tab === 'itinerary' && (
        editing ? (
          <ItineraryEditor
            items={trip.items}
            days={trip.days}
            startDate={trip.startDate}
            saving={busy === 'items'}
            error={actionError}
            onCancel={() => setEditing(false)}
            onSave={(items: ItineraryItem[]) => run('items', async () => {
              patch(await api<TripDetail>(`/trips/${id}/items`, { method: 'PUT', body: { items } }));
              setEditing(false);
            })}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              {trip.canEdit && <Button variant="secondary" size="sm" className="mb-4" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit itinerary</Button>}
              <ItineraryTimeline items={trip.items} days={trip.days} startDate={trip.startDate} />
            </div>
            <aside className="space-y-4">
              <Card className="p-4 text-sm">
                <p className="font-medium">Where to stay & eat</p>
                <p className="mt-1 text-muted">Browse real hotels and restaurants near your stops (OpenStreetMap data).</p>
                {pins[0] && (
                  <LinkButton variant="secondary" className="mt-3 w-full" to={`/services?lat=${pins[0].lat}&lng=${pins[0].lng}&type=hotel&near=${encodeURIComponent(pins[0].title)}`}>
                    <Hotel className="h-4 w-4" /> Hotels near {pins[0].title}
                  </LinkButton>
                )}
              </Card>
              <Card className="p-4 text-sm text-muted">
                This itinerary is saved on this device after you open it, so you can read it offline. Live maps and nearby search need a connection.
              </Card>
            </aside>
          </div>
        )
      )}

      {tab === 'budget' && (offlineCopy ? <Notice tone="info">Budget changes need a connection. Planned total: {inr(trip.budgetSummary.plannedTotal)}, spent: {inr(trip.budgetSummary.actualTotal)}.</Notice> : <BudgetPanel trip={trip} onChange={patch} />)}

      {tab === 'map' && (
        pins.length === 0 ? <Notice tone="info">No mapped stops yet.</Notice> : (
          <MapView className="h-[65vh]" ariaLabel="Trip map" markers={pins.map((i, k) => ({ id: i.id ?? String(k), lat: i.lat!, lng: i.lng!, label: String(i.day), color: i.kind === 'food' ? PIN_COLORS.restaurant : i.kind === 'stay' ? PIN_COLORS.hotel : PIN_COLORS.heritage, popup: `Day ${i.day} · ${i.startTime ?? ''} ${i.title}` }))} />
        )
      )}

      {tab === 'details' && <TripDetails trip={trip} onSaved={patch} />}
    </div>
  );
}

function TripDetails({ trip, onSaved }: { trip: TripDetail; onSaved: (t: TripDetail) => void }) {
  const [title, setTitle] = useState(trip.title);
  const [notes, setNotes] = useState(trip.notes ?? '');
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [travellers, setTravellers] = useState(trip.travellers);
  const [budget, setBudget] = useState(trip.budget);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!trip.canEdit) {
    return (
      <Card className="max-w-2xl p-5 text-sm">
        <p><strong>Interests:</strong> {trip.interests.join(', ') || '—'}</p>
        <p className="mt-1"><strong>Transport:</strong> {trip.transport} · <strong>Pace:</strong> {trip.pace}</p>
        {trip.notes && <p className="mt-3 whitespace-pre-line">{trip.notes}</p>}
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl space-y-4 p-5">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Field label="Trip name"><Input maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="End date" hint="Shortening a trip may hide stops on removed days — edit the itinerary afterwards."><Input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
        <Field label="Travellers"><Input type="number" min={1} max={30} value={travellers} onChange={(e) => setTravellers(Number(e.target.value))} /></Field>
        <Field label="Budget (₹)"><Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></Field>
      </div>
      <Field label="Notes" hint="Packing list, booking references, reminders…"><Textarea maxLength={4000} rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Button loading={busy} onClick={async () => {
        setBusy(true);
        setMsg(null);
        try {
          onSaved(await api<TripDetail>(`/trips/${trip.id}`, { method: 'PATCH', body: { title, notes, startDate, endDate, travellers, budget } }));
          setMsg({ tone: 'success', text: 'Saved.' });
        } catch (e) {
          setMsg({ tone: 'error', text: errorMessage(e) });
        } finally {
          setBusy(false);
        }
      }}>Save details</Button>
    </Card>
  );
}
