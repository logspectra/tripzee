import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Flag, Lightbulb, MessageSquareText } from 'lucide-react';
import { api, errorMessage, qs } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/auth';
import { fmtDate, todayIso } from '../lib/format';
import type { Page, Review } from '../lib/types';
import { Button, EmptyState, ErrorState, Field, Input, Notice, Select, Spinner, StarInput, Stars, Textarea } from './ui';

export function ReportButton({ targetType, targetId }: { targetType: 'review' | 'message'; targetId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('misleading');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  if (msg?.tone === 'success') return <span className="text-xs text-emerald-700">{msg.text}</span>;
  return open ? (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="misleading">Misleading or false</option>
        <option value="spam">Spam or advertising</option>
        <option value="offensive">Offensive or abusive</option>
        <option value="other">Other</option>
      </Select>
      <Input aria-label="Details (optional)" placeholder="Details (optional)" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      {msg && <p className="text-xs text-red-700">{msg.text}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ message: string }>('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details || undefined } });
              setMsg({ tone: 'success', text: r.message });
            } catch (e) {
              setMsg({ tone: 'error', text: errorMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Submit report
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-700">
      <Flag className="h-3.5 w-3.5" aria-hidden /> Report
    </button>
  );
}

function ReviewForm({ slug, existing, onDone, onCancel }: { slug: string; existing?: Review; onDone: () => void; onCancel?: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [tip, setTip] = useState(existing?.tip ?? '');
  const [visitedOn, setVisitedOn] = useState(existing?.visitedOn ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return setError('Please choose a star rating.');
    setBusy(true);
    setError(null);
    const payload = { rating, title, body, tip: tip || undefined, visitedOn: visitedOn || undefined };
    try {
      if (existing) await api(`/reviews/${existing.id}`, { method: 'PATCH', body: payload });
      else await api(`/destinations/${slug}/reviews`, { method: 'POST', body: payload });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-slate-50/60 p-5">
      <h3 className="font-semibold">{existing ? 'Edit your review' : 'Share your experience'}</h3>
      {error && <Notice tone="error">{error}</Notice>}
      <StarInput value={rating} onChange={setRating} />
      <Field label="Title"><Input required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Your review" hint="What was it like? Crowds, cleanliness, highlights. At least 10 characters.">
        <Textarea required minLength={10} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Travel tip (optional)" hint="e.g. Go early on a weekday"><Input maxLength={1000} value={tip} onChange={(e) => setTip(e.target.value)} /></Field>
        <Field label="Visited on (optional)"><Input type="date" max={todayIso()} value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} /></Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>{existing ? 'Save changes' : 'Post review'}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

export function ReviewItem({ r, onEdit, onDelete, showDestination }: { r: Review; onEdit?: () => void; onDelete?: () => void; showDestination?: boolean }) {
  return (
    <article className="border-b border-line py-5 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={r.rating} />
        <h4 className="font-semibold text-ink">{r.title}</h4>
      </div>
      <p className="mt-1 text-xs text-muted">
        {r.author.name} · {fmtDate(r.createdAt)}
        {r.visitedOn && <> · visited {fmtDate(r.visitedOn, { month: 'short', year: 'numeric' })}</>}
        {showDestination && r.destination && (
          <> · <Link to={`/destinations/${r.destination.slug}`} className="text-brand-700 hover:underline">{r.destination.name}, {r.destination.city}</Link></>
        )}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm text-ink">{r.body}</p>
      {r.tip && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {r.tip}
        </p>
      )}
      <div className="mt-2 flex gap-3">
        {r.mine ? (
          <>
            {onEdit && <button className="text-xs font-medium text-brand-700 hover:underline" onClick={onEdit}>Edit</button>}
            {onDelete && <button className="text-xs text-muted hover:text-red-700" onClick={onDelete}>Delete</button>}
          </>
        ) : (
          <ReportButton targetType="review" targetId={r.id} />
        )}
      </div>
    </article>
  );
}

export function ReviewSection({ slug, histogram, count, average, reviewedByMe, onChanged }: {
  slug: string;
  histogram: Record<string, number>;
  count: number;
  average: number | null;
  reviewedByMe: boolean;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [sort, setSort] = useState('recent');
  const [rating, setRating] = useState('');
  const [tips, setTips] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Review | null>(null);
  const list = useAsync((signal) => api<Page<Review>>(`/destinations/${slug}/reviews${qs({ sort, rating, tips: tips || undefined, page })}`, { signal }), [slug, sort, rating, tips, page]);

  const refresh = () => {
    setEditing(null);
    list.reload();
    onChanged();
  };

  return (
    <section aria-labelledby="reviews-h" className="space-y-6">
      <h2 id="reviews-h" className="text-xl font-semibold">Reviews & tips</h2>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <p className="text-4xl font-semibold">{average?.toFixed(1) ?? '—'}</p>
          <Stars value={average} size="md" />
          <p className="mt-1 text-sm text-muted">{count} review{count === 1 ? '' : 's'} from Tripzee travellers</p>
          <div className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((s) => (
              <button key={s} onClick={() => { setRating(rating === String(s) ? '' : String(s)); setPage(1); }} className="flex w-full items-center gap-2 text-xs text-muted hover:text-ink" aria-pressed={rating === String(s)}>
                <span className="w-3">{s}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${count ? ((histogram[s] ?? 0) / count) * 100 : 0}%` }} />
                </span>
                <span className="w-6 text-right">{histogram[s] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          {user ? (
            editing ? (
              <ReviewForm slug={slug} existing={editing} onDone={refresh} onCancel={() => setEditing(null)} />
            ) : !reviewedByMe ? (
              <ReviewForm slug={slug} onDone={refresh} />
            ) : null
          ) : (
            <Notice tone="info">
              <Link to={`/login?next=/destinations/${slug}`} className="font-medium underline">Sign in</Link> to write a review. One review per traveller keeps ratings honest.
            </Notice>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Select aria-label="Sort reviews" className="w-auto" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="recent">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </Select>
            <label className="flex items-center gap-2 rounded-xl border border-line px-3 text-sm">
              <input type="checkbox" checked={tips} onChange={(e) => { setTips(e.target.checked); setPage(1); }} /> With tips only
            </label>
          </div>
          {list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : list.loading && !list.data ? (
            <Spinner />
          ) : list.data?.items.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={<MessageSquareText className="h-7 w-7" />} title="No reviews yet">
                {rating || tips ? 'No reviews match these filters.' : 'Be the first to share your experience.'}
              </EmptyState>
            </div>
          ) : (
            <div className="mt-2">
              {list.data?.items.map((r) => (
                <ReviewItem
                  key={r.id}
                  r={r}
                  onEdit={() => setEditing(r)}
                  onDelete={async () => {
                    if (!confirm('Delete your review?')) return;
                    await api(`/reviews/${r.id}`, { method: 'DELETE' });
                    refresh();
                  }}
                />
              ))}
              {list.data && list.data.totalPages > 1 && (
                <div className="flex items-center gap-2 pt-4">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="text-sm text-muted">Page {page} of {list.data.totalPages}</span>
                  <Button size="sm" variant="secondary" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
