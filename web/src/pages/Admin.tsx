import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ExternalLink, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api, errorMessage, qs } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { fmtDate } from '../lib/format';
import type { Category, Page, Source } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Notice, PageHeader, Select, Spinner, Tabs, Textarea, VerifiedBadge } from '../components/ui';

type Tab = 'overview' | 'destinations' | 'moderation' | 'users';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Admin" subtitle="Manage destinations, verify facts, moderate content and manage users." />
      <div className="mb-6">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'destinations', label: 'Destinations' },
          { value: 'moderation', label: 'Moderation' },
          { value: 'users', label: 'Users' },
        ]} />
      </div>
      {tab === 'overview' && <Overview onGo={setTab} />}
      {tab === 'destinations' && <DestinationsAdmin />}
      {tab === 'moderation' && <Moderation />}
      {tab === 'users' && <Users />}
    </div>
  );
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const s = useAsync((signal) => api<Record<string, number>>('/admin/stats', { signal }), []);
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.data) return <Spinner />;
  const d = s.data;
  const cards = [
    ['Users', d.users, `${d.newUsers7d} new this week`],
    ['Trips', d.trips, `${d.newTrips7d} created this week`],
    ['Destinations', d.destinations, `${d.publishedDestinations} published`],
    ['Facts verified', d.verifiedDestinations, `of ${d.destinations} destinations`],
    ['Visible reviews', d.reviews, `${d.hiddenReviews} hidden`],
    ['Travel Rooms', d.rooms, 'active groups'],
  ] as const;
  return (
    <div className="space-y-6">
      {d.openReports > 0 && (
        <Notice tone="warn">
          {d.openReports} open report{d.openReports > 1 ? 's' : ''} need review. <button className="font-medium underline" onClick={() => onGo('moderation')}>Open moderation</button>
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, sub]) => (
          <Card key={label} className="p-5"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p><p className="text-xs text-muted">{sub}</p></Card>
        ))}
      </div>
    </div>
  );
}

// ---------------- Destinations ----------------

interface Row { id: string; slug: string; name: string; city: string; category: string; published: boolean; factsVerified: boolean; lastVerifiedAt?: string | null; hasImage: boolean; updatedAt: string }
interface Form {
  slug: string; name: string; nameHi?: string | null; city: string; state?: string | null; categorySlug: string; lat: number; lng: number;
  summary: string; summaryHi?: string | null; description: string; history?: string | null; culturalSignificance?: string | null; interests?: string | null;
  openingHours?: string | null; entryFee?: string | null; visitMinutes?: number | null; bestTimeToVisit?: string | null; accessibility?: string | null;
  guidelines?: string | null; officialUrl?: string | null; ticketUrl?: string | null; wikiTitle?: string | null; imageUrl?: string | null; imageCredit?: string | null; published?: boolean;
}
interface AdminDest { id: string; form: Form; factsVerified: boolean; lastVerifiedAt?: string | null; coordsSource?: string | null; sources: Source[] }

const EMPTY: Form = { slug: '', name: '', city: '', categorySlug: 'heritage', lat: 26.85, lng: 80.95, summary: '', description: '', visitMinutes: 120, published: true, state: 'Uttar Pradesh' };

function DestinationsAdmin() {
  const list = useAsync((signal) => api<Row[]>('/admin/destinations', { signal }), []);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  if (editing) return <DestinationEditor id={editing} onClose={() => { setEditing(null); list.reload(); }} />;
  const rows = (list.data ?? []).filter((r) => !filter || `${r.name} ${r.city}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Filter" placeholder="Filter by name or city…" className="max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Button className="ml-auto" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New destination</Button>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">City</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Facts</th><th className="px-4 py-2.5">Updated</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-medium">{r.name}{!r.hasImage && <Badge className="ml-2">no photo</Badge>}</td>
                  <td className="px-4 py-2.5">{r.city}</td>
                  <td className="px-4 py-2.5">{r.category}</td>
                  <td className="px-4 py-2.5">{r.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</td>
                  <td className="px-4 py-2.5"><VerifiedBadge verified={r.factsVerified} label={r.factsVerified ? 'Verified' : 'Unverified'} /></td>
                  <td className="px-4 py-2.5 text-muted">{fmtDate(r.updatedAt)}</td>
                  <td className="px-4 py-2.5 text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(r.id)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function DestinationEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const isNew = id === 'new';
  const cats = useAsync((signal) => api<Category[]>('/categories', { signal }), []);
  const dest = useAsync((signal) => (isNew ? Promise.resolve(null) : api<AdminDest>(`/admin/destinations/${id}`, { signal })), [id]);
  if (dest.error) return <ErrorState error={dest.error} onRetry={dest.reload} />;
  if (!isNew && !dest.data) return <Spinner />;
  return <EditorForm key={id} id={id} initial={dest.data ?? null} categories={cats.data ?? []} onClose={onClose} reload={dest.reload} />;
}

function EditorForm({ id, initial, categories, onClose, reload }: { id: string; initial: AdminDest | null; categories: Category[]; onClose: () => void; reload: () => void }) {
  const isNew = id === 'new';
  const [form, setForm] = useState<Form>(initial?.form ?? EMPTY);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [src, setSrc] = useState({ label: '', url: '', field: 'general' });
  const set = (k: keyof Form, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const str = (k: keyof Form) => (form[k] as string | null | undefined) ?? '';

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy('save');
    setMsg(null);
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
    try {
      if (isNew) {
        await api('/admin/destinations', { method: 'POST', body });
        onClose();
      } else {
        const r = await api<{ factsVerified: boolean }>(`/admin/destinations/${id}`, { method: 'PATCH', body });
        setMsg(r.factsVerified || !initial?.factsVerified ? { tone: 'success', text: 'Saved.' } : { tone: 'warn', text: 'Saved. Practical facts changed, so the verified flag was cleared — re-verify when confirmed.' });
        reload();
      }
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function action(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'success', text: ok });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  const text = (k: keyof Form, label: string, opts: { area?: boolean; hint?: string; required?: boolean; max?: number } = {}) => (
    <Field label={label} hint={opts.hint}>
      {opts.area ? <Textarea required={opts.required} maxLength={opts.max} value={str(k)} onChange={(e) => set(k, e.target.value)} /> : <Input required={opts.required} maxLength={opts.max} value={str(k)} onChange={(e) => set(k, e.target.value)} />}
    </Field>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={save} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{isNew ? 'New destination' : `Edit: ${initial?.form.name}`}</h2>
          <Button type="button" variant="ghost" onClick={onClose}>← Back to list</Button>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {text('name', 'Name', { required: true, max: 160 })}
          {text('nameHi', 'Name (Hindi)', { max: 160 })}
          {text('slug', 'Slug', { required: true, max: 120, hint: 'lowercase-with-dashes, used in URLs' })}
          <Field label="Category">
            <Select value={form.categorySlug} onChange={(e) => set('categorySlug', e.target.value)}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select>
          </Field>
          {text('city', 'City', { required: true, max: 80 })}
          {text('state', 'State', { max: 80 })}
          <Field label="Latitude"><Input type="number" step="any" required min={-90} max={90} value={form.lat} onChange={(e) => set('lat', Number(e.target.value))} /></Field>
          <Field label="Longitude"><Input type="number" step="any" required min={-180} max={180} value={form.lng} onChange={(e) => set('lng', Number(e.target.value))} /></Field>
          {text('interests', 'Interests', { hint: 'comma separated: history,architecture,spirituality,culture,nature,adventure,food,shopping', max: 300 })}
          <Field label="Typical visit (minutes)"><Input type="number" min={15} max={720} value={form.visitMinutes ?? 120} onChange={(e) => set('visitMinutes', Number(e.target.value))} /></Field>
        </Card>
        <Card className="space-y-4 p-5">
          {text('summary', 'Summary', { required: true, area: true, max: 1000 })}
          {text('summaryHi', 'Summary (Hindi)', { area: true, max: 1000 })}
          {text('description', 'Description', { required: true, area: true, max: 8000 })}
          {text('history', 'History', { area: true, max: 8000 })}
          {text('culturalSignificance', 'Cultural significance', { area: true, max: 8000 })}
        </Card>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Notice tone="warn">Only enter practical facts you've confirmed from an official source, and add that source on the right. Leave blank if unknown — the site will say “not verified”.</Notice></div>
          {text('openingHours', 'Opening hours', { max: 500 })}
          {text('entryFee', 'Entry fee', { max: 500 })}
          {text('bestTimeToVisit', 'Best time to visit', { max: 500 })}
          {text('accessibility', 'Accessibility', { max: 1000 })}
          <div className="sm:col-span-2">{text('guidelines', 'Visitor guidelines', { area: true, max: 2000 })}</div>
          {text('officialUrl', 'Official website (https://…)', { max: 500 })}
          {text('ticketUrl', 'Official ticket link (https://…)', { max: 500 })}
          {text('wikiTitle', 'Wikipedia article title', { hint: 'Used to fetch a photo and coordinates', max: 200 })}
          {text('imageUrl', 'Image URL (optional override)', { max: 1000 })}
          {text('imageCredit', 'Image credit', { max: 300 })}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published !== false} onChange={(e) => set('published', e.target.checked)} /> Published</label>
        </Card>
        <div className="sticky bottom-4 flex gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg">
          <Button type="submit" loading={busy === 'save'}>{isNew ? 'Create destination' : 'Save changes'}</Button>
          {!isNew && <Link to={`/destinations/${form.slug}`} target="_blank" className="inline-flex items-center gap-1 px-3 text-sm text-brand-700 hover:underline">View page <ExternalLink className="h-3.5 w-3.5" /></Link>}
        </div>
      </form>

      {!isNew && initial && (
        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">Verification</h3>
            <VerifiedBadge verified={initial.factsVerified} />
            {initial.lastVerifiedAt && <p className="text-xs text-muted">Last verified {fmtDate(initial.lastVerifiedAt)}</p>}
            <p className="text-xs text-muted">Coordinates source: {initial.coordsSource ?? 'seed (approximate)'}</p>
            <div className="flex flex-wrap gap-2">
              {initial.factsVerified ? (
                <Button size="sm" variant="secondary" loading={busy === 'verify'} onClick={() => action('verify', () => api(`/admin/destinations/${id}/verify`, { method: 'POST', body: { verified: false } }), 'Marked as unverified.')}>Mark unverified</Button>
              ) : (
                <Button size="sm" loading={busy === 'verify'} onClick={() => action('verify', () => api(`/admin/destinations/${id}/verify`, { method: 'POST', body: { verified: true } }), 'Facts marked as verified.')}><ShieldCheck className="h-4 w-4" /> Mark facts verified</Button>
              )}
              <Button size="sm" variant="ghost" loading={busy === 'enrich'} onClick={() => action('enrich', () => api(`/admin/destinations/${id}/enrich`, { method: 'POST' }), 'Wikipedia lookup finished.')}><RefreshCw className="h-4 w-4" /> Wikipedia photo</Button>
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">Sources</h3>
            <ul className="space-y-2 text-sm">
              {initial.sources.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-brand-700 hover:underline"><span className="block truncate">{s.label}</span><span className="text-xs text-muted">{s.field}</span></a>
                  <button aria-label="Remove source" className="text-muted hover:text-red-700" onClick={() => action(`del-${s.id}`, () => api(`/admin/destinations/${id}/sources/${s.id}`, { method: 'DELETE' }), 'Source removed.')}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void action('src', async () => { await api(`/admin/destinations/${id}/sources`, { method: 'POST', body: src }); setSrc({ label: '', url: '', field: 'general' }); }, 'Source added.'); }}>
              <Input aria-label="Source label" required placeholder="Label, e.g. ASI official page" value={src.label} onChange={(e) => setSrc({ ...src, label: e.target.value })} />
              <Input aria-label="Source URL" required type="url" pattern="https?://.+" placeholder="https://…" value={src.url} onChange={(e) => setSrc({ ...src, url: e.target.value })} />
              <Select aria-label="Supports field" value={src.field} onChange={(e) => setSrc({ ...src, field: e.target.value })}>
                {['general', 'openingHours', 'entryFee', 'accessibility', 'history'].map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
              <Button size="sm" type="submit" loading={busy === 'src'}><Plus className="h-4 w-4" /> Add source</Button>
            </form>
          </Card>
        </aside>
      )}
    </div>
  );
}

// ---------------- Moderation ----------------

interface ReportRow { id: string; targetType: string; targetId: string; reason: string; details?: string | null; status: string; createdAt: string; reporterName: string; target: Record<string, string | number | boolean> }
interface ReviewRow { id: string; rating: number; title: string; body: string; status: string; author: string; destination: string; destinationSlug: string; createdAt: string }

function Moderation() {
  const [status, setStatus] = useState('OPEN');
  const reports = useAsync((signal) => api<Page<ReportRow>>(`/admin/reports${qs({ status })}`, { signal }), [status]);
  const [reviewStatus, setReviewStatus] = useState('');
  const reviews = useAsync((signal) => api<Page<ReviewRow>>(`/admin/reviews${qs({ status: reviewStatus })}`, { signal }), [reviewStatus]);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(id: string, s: 'RESOLVED' | 'DISMISSED', act: 'hide' | 'delete' | 'none') {
    try {
      await api(`/admin/reports/${id}`, { method: 'PATCH', body: { status: s, action: act } });
      reports.reload();
      reviews.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className="space-y-8">
      {err && <Notice tone="error">{err}</Notice>}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reports</h2>
          <Select aria-label="Report status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option>
          </Select>
        </div>
        {reports.error ? <ErrorState error={reports.error} onRetry={reports.reload} /> : !reports.data ? <Spinner /> : reports.data.items.length === 0 ? <EmptyState title="No reports here">Nothing needs your attention.</EmptyState> : (
          <ul className="space-y-3">
            {reports.data.items.map((r) => (
              <Card key={r.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="red">{r.reason}</Badge><Badge>{r.targetType}</Badge>
                  <span className="text-xs text-muted">by {r.reporterName} · {fmtDate(r.createdAt)}</span>
                </div>
                {r.details && <p className="mt-2 text-muted">“{r.details}”</p>}
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  {r.target.deleted ? <p className="text-muted">Content already deleted.</p> : (
                    <>
                      {r.target.title && <p className="font-medium">{String(r.target.title)} {r.target.rating ? `· ${r.target.rating}★` : ''}</p>}
                      <p className="whitespace-pre-line">{String(r.target.body ?? '')}</p>
                      <p className="mt-1 text-xs text-muted">by {String(r.target.author ?? '')}{r.target.destination ? ` · ${r.target.destination}` : ''}{r.target.status ? ` · ${r.target.status}` : ''}</p>
                    </>
                  )}
                </div>
                {r.status === 'OPEN' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.targetType === 'review' && <Button size="sm" onClick={() => resolve(r.id, 'RESOLVED', 'hide')}>Hide review</Button>}
                    <Button size="sm" variant="danger" onClick={() => confirm('Delete this content permanently?') && resolve(r.id, 'RESOLVED', 'delete')}>Delete content</Button>
                    <Button size="sm" variant="ghost" onClick={() => resolve(r.id, 'DISMISSED', 'none')}>Dismiss</Button>
                  </div>
                )}
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All reviews</h2>
          <Select aria-label="Review status" className="w-auto" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
            <option value="">All</option><option value="VISIBLE">Visible</option><option value="HIDDEN">Hidden</option>
          </Select>
        </div>
        {reviews.error ? <ErrorState error={reviews.error} onRetry={reviews.reload} /> : !reviews.data ? <Spinner /> : reviews.data.items.length === 0 ? <EmptyState title="No reviews" /> : (
          <Card className="divide-y divide-line">
            {reviews.data.items.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.title} · {r.rating}★ {r.status === 'HIDDEN' && <Badge tone="amber">Hidden</Badge>}</p>
                  <p className="line-clamp-2 text-muted">{r.body}</p>
                  <p className="text-xs text-muted">{r.author} · <Link to={`/destinations/${r.destinationSlug}`} className="hover:underline">{r.destination}</Link> · {fmtDate(r.createdAt)}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={async () => {
                  try { await api(`/admin/reviews/${r.id}`, { method: 'PATCH', body: { status: r.status === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN' } }); reviews.reload(); } catch (e) { setErr(errorMessage(e)); }
                }}>{r.status === 'HIDDEN' ? 'Unhide' : 'Hide'}</Button>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------------- Users ----------------

interface UserRow { id: string; email: string; name: string; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED'; createdAt: string }

function Users() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useAsync((signal) => api<Page<UserRow>>(`/admin/users${qs({ q, page })}`, { signal }), [q, page]);
  const [err, setErr] = useState<string | null>(null);

  async function update(u: UserRow, body: Partial<Pick<UserRow, 'role' | 'status'>>) {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body });
      list.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      {err && <Notice tone="error">{err}</Notice>}
      <Input aria-label="Search users" placeholder="Search by name or email…" className="max-w-sm" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-muted">{u.email}</td>
                  <td className="px-4 py-2.5 text-muted">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-2.5"><Select aria-label={`Role for ${u.name}`} className="w-auto py-1" value={u.role} onChange={(e) => update(u, { role: e.target.value as UserRow['role'] })}><option value="USER">User</option><option value="ADMIN">Admin</option></Select></td>
                  <td className="px-4 py-2.5"><Select aria-label={`Status for ${u.name}`} className="w-auto py-1" value={u.status} onChange={(e) => update(u, { status: e.target.value as UserRow['status'] })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></Select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {page} of {list.data.totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
