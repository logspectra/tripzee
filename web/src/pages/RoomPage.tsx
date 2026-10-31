import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Copy, LogOut, MapPin, Navigation, RefreshCw, Send, ShieldCheck, Trash2, UserMinus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRoomSocket, type RoomEvent } from '../lib/useRoomSocket';
import { distanceKm, fmtDate, fmtDateTime, timeAgo } from '../lib/format';
import type { MeetingPoint, Member, RoomDetail, RoomMessage, SharedLocation, TripSummary } from '../lib/types';
import { MapView, PIN_COLORS } from '../components/MapView';
import { ReportButton } from '../components/ReviewSection';
import { Badge, Button, Card, ErrorState, Field, Input, Notice, Select, Spinner, cx } from '../components/ui';

const SEND_EVERY_MS = 15_000;
const MIN_MOVE_KM = 0.03;

export default function RoomPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'warn'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setRoom(await api<RoomDetail>(`/rooms/${id}`));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onEvent = useCallback((e: RoomEvent) => {
    setRoom((r) => {
      if (!r) return r;
      switch (e.type) {
        case 'message': {
          const m = e.payload as RoomMessage;
          return r.messages.some((x) => x.id === m.id) ? r : { ...r, messages: [...r.messages, m].slice(-200) };
        }
        case 'location': {
          const l = e.payload as SharedLocation;
          return { ...r, locations: [...r.locations.filter((x) => x.userId !== l.userId), l] };
        }
        case 'location-removed':
          return { ...r, locations: r.locations.filter((x) => x.userId !== (e.payload as { userId: string }).userId) };
        case 'member-sharing': {
          const p = e.payload as { userId: string; sharingLocation: boolean };
          return {
            ...r,
            members: r.members.map((m) => (m.userId === p.userId ? { ...m, sharingLocation: p.sharingLocation } : m)),
            locations: p.sharingLocation ? r.locations : r.locations.filter((x) => x.userId !== p.userId),
          };
        }
        case 'member-joined': {
          const m = e.payload as Member;
          return r.members.some((x) => x.userId === m.userId) ? r : { ...r, members: [...r.members, { ...m, isMe: m.userId === user?.id }] };
        }
        case 'member-left':
          return { ...r, members: r.members.filter((m) => m.userId !== (e.payload as { userId: string }).userId) };
        case 'meeting-point': {
          const p = e.payload as MeetingPoint;
          return r.meetingPoints.some((x) => x.id === p.id) ? r : { ...r, meetingPoints: [...r.meetingPoints, p] };
        }
        case 'meeting-point-removed':
          return { ...r, meetingPoints: r.meetingPoints.filter((p) => p.id !== (e.payload as { id: string }).id) };
        default:
          return r;
      }
    });
    if (e.type === 'room-deleted') navigate('/rooms', { replace: true });
    if (e.type === 'member-left' && (e.payload as { userId: string }).userId === user?.id) navigate('/rooms', { replace: true });
    if (e.type === 'trip-linked') void load();
  }, [navigate, user?.id, load]);

  const connected = useRoomSocket(room ? id : undefined, onEvent);

  // Fallback polling while the socket is down.
  useEffect(() => {
    if (connected || !room) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [connected, room, load]);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={error} onRetry={load} /></div>;
  if (!room) return <Spinner />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <RoomHeader room={room} connected={connected} onChange={setRoom} onNotice={setNotice} />
      {notice && <Notice tone={notice.tone} className="mb-4">{notice.text}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <LocationSharing room={room} onChange={setRoom} onNotice={setNotice} />
          <GroupMap room={room} onNotice={setNotice} />
        </div>
        <div className="space-y-6">
          <Chat room={room} />
          <MembersCard room={room} onNotice={setNotice} />
        </div>
      </div>
    </div>
  );
}

function RoomHeader({ room, connected, onChange, onNotice }: { room: RoomDetail; connected: boolean; onChange: (r: RoomDetail) => void; onNotice: (n: { tone: 'error' | 'success'; text: string }) => void }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const link = `${window.location.origin}/rooms?code=${room.inviteCode}`;

  useEffect(() => {
    if (room.isOwner) api<TripSummary[]>('/trips').then((t) => setTrips(t.filter((x) => x.role === 'owner'))).catch(() => setTrips([]));
  }, [room.isOwner]);

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-sm text-muted"><Link to="/rooms" className="hover:underline">Travel Rooms</Link></p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-tight">
          {room.name}
          <Badge tone={connected ? 'green' : 'amber'}>{connected ? '● Live' : 'Reconnecting…'}</Badge>
        </h1>
        {room.trip ? (
          <p className="mt-1 text-sm">Trip: <Link to={`/trips/${room.trip.id}`} className="font-medium text-brand-700 hover:underline">{room.trip.title}</Link> · {fmtDate(room.trip.startDate, { day: 'numeric', month: 'short' })} – {fmtDate(room.trip.endDate, { day: 'numeric', month: 'short' })}</p>
        ) : <p className="mt-1 text-sm text-muted">No trip linked yet.</p>}
      </div>
      <Card className="space-y-2 p-4 lg:w-96">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Invite friends</p>
        <div className="flex items-center gap-2">
          <code className="rounded-lg bg-slate-100 px-3 py-1.5 text-lg font-semibold tracking-widest">{room.inviteCode}</code>
          <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            <Copy className="h-4 w-4" /> {copied ? 'Link copied' : 'Copy link'}
          </Button>
        </div>
        {room.isOwner && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={async () => {
              if (!confirm('Generate a new code? The old code and link will stop working.')) return;
              try {
                const r = await api<{ inviteCode: string }>(`/rooms/${room.id}/invite/rotate`, { method: 'POST' });
                onChange({ ...room, inviteCode: r.inviteCode });
              } catch (e) { onNotice({ tone: 'error', text: errorMessage(e) }); }
            }}><RefreshCw className="h-4 w-4" /> New code</Button>
            <Select aria-label="Linked trip" className="w-auto py-1.5" value={room.trip?.id ?? ''} onChange={async (e) => {
              try { onChange(await api<RoomDetail>(`/rooms/${room.id}/trip`, { method: 'PUT', body: { tripId: e.target.value || null } })); }
              catch (err) { onNotice({ tone: 'error', text: errorMessage(err) }); }
            }}>
              <option value="">No linked trip</option>
              {trips?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
            <Button variant="danger" size="sm" onClick={async () => {
              if (!confirm('Delete this room for everyone? Messages, meeting points and shared locations will be removed.')) return;
              try { await api(`/rooms/${room.id}`, { method: 'DELETE' }); navigate('/rooms'); } catch (e) { onNotice({ tone: 'error', text: errorMessage(e) }); }
            }}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        )}
        {!room.isOwner && (
          <Button variant="ghost" size="sm" onClick={async () => {
            if (!confirm('Leave this room? Your shared location will be removed.')) return;
            try { await api(`/rooms/${room.id}/leave`, { method: 'POST' }); navigate('/rooms'); } catch (e) { onNotice({ tone: 'error', text: errorMessage(e) }); }
          }}><LogOut className="h-4 w-4" /> Leave room</Button>
        )}
      </Card>
    </div>
  );
}

function LocationSharing({ room, onChange, onNotice }: { room: RoomDetail; onChange: (r: RoomDetail) => void; onNotice: (n: { tone: 'error' | 'success' | 'warn'; text: string } | null) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);

  const setSharing = useCallback(async (enabled: boolean) => {
    setBusy(true);
    try {
      await api(`/rooms/${room.id}/sharing`, { method: 'POST', body: { enabled } });
      onChange({ ...room, mySharing: enabled, members: room.members.map((m) => (m.isMe ? { ...m, sharingLocation: enabled } : m)), locations: enabled ? room.locations : room.locations.filter((l) => !room.members.find((m) => m.isMe && m.userId === l.userId)) });
      if (!enabled) {
        last.current = null;
        setLastSent(null);
      }
    } catch (e) {
      onNotice({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }, [room, onChange, onNotice]);

  useEffect(() => {
    if (!room.mySharing) return;
    if (!('geolocation' in navigator)) {
      onNotice({ tone: 'error', text: 'Your browser does not support location sharing.' });
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      async (p) => {
        const now = Date.now();
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        const prev = last.current;
        if (prev && now - prev.at < SEND_EVERY_MS && distanceKm(prev, pos) < MIN_MOVE_KM) return;
        last.current = { at: now, ...pos };
        try {
          await api<SharedLocation>(`/rooms/${room.id}/location`, { method: 'POST', body: { ...pos, accuracy: Math.round(p.coords.accuracy) } });
          setLastSent(new Date().toISOString());
        } catch (e) {
          onNotice({ tone: 'error', text: `Location update failed: ${errorMessage(e)}` });
        }
      },
      (err) => {
        onNotice({ tone: 'warn', text: err.code === err.PERMISSION_DENIED ? 'Location permission denied — sharing has been turned off.' : 'Could not read your location — sharing has been turned off.' });
        void setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [room.mySharing, room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className={cx('p-5', room.mySharing && 'border-brand-200 bg-brand-50/40')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-brand-700" /> Live location sharing</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {room.mySharing
              ? `You're sharing your live location with this room's ${room.members.length} member${room.members.length === 1 ? '' : 's'}.${lastSent ? ` Last update ${timeAgo(lastSent)}.` : ' Waiting for your first position…'}`
              : 'Off. Your location is never shared unless you turn this on. Only room members can see it, and it stops the moment you turn it off.'}
          </p>
        </div>
        {room.mySharing ? (
          <Button variant="danger" loading={busy} onClick={() => setSharing(false)}>Stop sharing</Button>
        ) : (
          <Button loading={busy} onClick={() => setConfirming(true)}><Navigation className="h-4 w-4" /> Share my location</Button>
        )}
      </div>
      {confirming && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4 text-sm" role="dialog" aria-labelledby="consent-h">
          <p id="consent-h" className="font-semibold">Share your live location?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Visible only to members of “{room.name}” ({room.members.map((m) => m.name).join(', ')}).</li>
            <li>Updates about every 15 seconds while this page is open.</li>
            <li>Only your latest position is kept, and it's deleted as soon as you stop sharing or leave.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={busy} onClick={() => setSharing(true)}>Yes, share with this room</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function GroupMap({ room, onNotice }: { room: RoomDetail; onNotice: (n: { tone: 'error' | 'success'; text: string }) => void }) {
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');
  const [meetAt, setMeetAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!pick) return;
    setBusy(true);
    try {
      await api(`/rooms/${room.id}/meeting-points`, { method: 'POST', body: { name, lat: pick.lat, lng: pick.lng, meetAt: meetAt ? new Date(meetAt).toISOString() : undefined, note: note || undefined } });
      setPick(null);
      setName('');
      setMeetAt('');
      setNote('');
    } catch (err) {
      onNotice({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const markers = [
    ...room.meetingPoints.map((p) => ({ id: `mp-${p.id}`, lat: p.lat, lng: p.lng, color: PIN_COLORS.meeting, label: 'M', popup: `${p.name}${p.meetAt ? ` · ${fmtDateTime(p.meetAt)}` : ''}${p.note ? ` — ${p.note}` : ''}` })),
    ...room.locations.map((l) => ({ id: `loc-${l.userId}`, lat: l.lat, lng: l.lng, color: l.userId === user?.id ? '#2563eb' : PIN_COLORS.member, label: l.name.slice(0, 1).toUpperCase(), popup: `${l.name} · updated ${timeAgo(l.updatedAt)}${l.accuracy ? ` · ±${Math.round(l.accuracy)} m` : ''}` })),
    ...(pick ? [{ id: 'pick', lat: pick.lat, lng: pick.lng, color: '#0f172a', popup: 'New meeting point' }] : []),
  ];

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Group map</h2>
        <span className="text-xs text-muted">{room.locations.length} sharing · {room.meetingPoints.length} meeting point{room.meetingPoints.length === 1 ? '' : 's'}</span>
      </div>
      <MapView className="h-[420px]" ariaLabel="Group map" markers={markers} fitPoints={markers.length ? undefined : [[26.85, 80.95]]} onMapClick={(lat, lng) => setPick({ lat, lng })} />
      <p className="text-xs text-muted"><MapPin className="inline h-3.5 w-3.5" /> Tap the map to place a new meeting point.</p>
      {pick && (
        <form onSubmit={add} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <Field label="Meeting point name"><Input required maxLength={120} placeholder="e.g. Main gate" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="When (optional)"><Input type="datetime-local" value={meetAt} onChange={(e) => setMeetAt(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Note (optional)"><Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" loading={busy}>Add meeting point</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPick(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {room.meetingPoints.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {room.meetingPoints.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted">{p.meetAt ? fmtDateTime(p.meetAt) : 'No time set'}{p.note ? ` · ${p.note}` : ''}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/map?lat=${p.lat}&lng=${p.lng}&name=${encodeURIComponent(p.name)}`} className="text-xs text-brand-700 hover:underline">Directions</Link>
                {(room.isOwner || p.createdById === user?.id) && (
                  <button className="text-xs text-muted hover:text-red-700" onClick={async () => {
                    try { await api(`/rooms/${room.id}/meeting-points/${p.id}`, { method: 'DELETE' }); } catch (e) { onNotice({ tone: 'error', text: errorMessage(e) }); }
                  }}>Remove</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Chat({ room }: { room: RoomDetail }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'message' | 'update'>('message');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [room.messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/rooms/${room.id}/messages`, { method: 'POST', body: { body: text.trim(), kind } });
      setText('');
      setKind('message');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-[520px] flex-col">
      <h2 className="border-b border-line px-5 py-3 font-semibold">Messages & updates</h2>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {room.messages.length === 0 && <p className="text-center text-sm text-muted">No messages yet. Say hello!</p>}
        {room.messages.map((m) => m.kind === 'update' ? (
          <div key={m.id} className="text-center text-xs text-muted">
            <span className="rounded-full bg-slate-100 px-3 py-1">{m.userId === user?.id || m.body.startsWith(m.userName) ? m.body : `${m.userName}: ${m.body}`} · {timeAgo(m.createdAt)}</span>
          </div>
        ) : (
          <div key={m.id} className={cx('flex flex-col', m.userId === user?.id ? 'items-end' : 'items-start')}>
            <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', m.userId === user?.id ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink')}>
              {m.userId !== user?.id && <p className="text-xs font-semibold">{m.userName}</p>}
              <p className="whitespace-pre-line break-words">{m.body}</p>
            </div>
            <div className="mt-0.5 flex gap-2 text-[11px] text-muted">
              {timeAgo(m.createdAt)} {m.userId !== user?.id && <ReportButton targetType="message" targetId={m.id} />}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="space-y-2 border-t border-line p-3">
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Input aria-label="Message" maxLength={2000} placeholder={kind === 'update' ? 'Trip update, e.g. “Train delayed 30 min”' : 'Write a message…'} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" loading={busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={kind === 'update'} onChange={(e) => setKind(e.target.checked ? 'update' : 'message')} /> Post as a trip update (highlighted for everyone)
        </label>
      </form>
    </Card>
  );
}

function MembersCard({ room, onNotice }: { room: RoomDetail; onNotice: (n: { tone: 'error' | 'success'; text: string }) => void }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">Members ({room.members.length})</h2>
      <ul className="space-y-2">
        {room.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold">{m.name.slice(0, 1).toUpperCase()}</span>
              <span>
                {m.name} {m.isMe && <span className="text-muted">(you)</span>}
                <span className="block text-xs text-muted">{m.role === 'OWNER' ? 'Owner' : `Joined ${fmtDate(m.joinedAt, { day: 'numeric', month: 'short' })}`}</span>
              </span>
            </span>
            <span className="flex items-center gap-2">
              {m.sharingLocation ? <Badge tone="green">Sharing location</Badge> : <Badge>Location off</Badge>}
              {room.isOwner && !m.isMe && (
                <button aria-label={`Remove ${m.name}`} className="rounded p-1 text-muted hover:text-red-700" onClick={async () => {
                  if (!confirm(`Remove ${m.name} from the room?`)) return;
                  try { await api(`/rooms/${room.id}/members/${m.userId}`, { method: 'DELETE' }); } catch (e) { onNotice({ tone: 'error', text: errorMessage(e) }); }
                }}><UserMinus className="h-4 w-4" /></button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
