import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Bot, RefreshCw, Save, Sparkles } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { addDays, todayIso } from '../lib/format';
import type { City, PlanDraft, PlanRequest, TripDetail } from '../lib/types';
import { EstimateBreakdown, ItineraryTimeline } from '../components/Itinerary';
import { MapView, PIN_COLORS } from '../components/MapView';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, cx } from '../components/ui';

const INTERESTS = ['history', 'architecture', 'spirituality', 'culture', 'nature', 'adventure', 'food', 'shopping'] as const;
const DRAFT_KEY = 'tz:plan-draft';

export default function Planner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cities = useAsync((signal) => api<City[]>('/destinations/cities', { signal }), []);
  const meta = useAsync((signal) => api<{ aiEnabled: boolean }>('/meta', { signal }), []);

  const start = addDays(todayIso(), 14);
  const [form, setForm] = useState<PlanRequest>({
    origin: 'Delhi',
    city: params.get('city') ?? 'Agra',
    startDate: start,
    endDate: addDays(start, 1),
    travellers: 2,
    budget: 15000,
    interests: ['history'],
    transport: 'train',
    pace: 'moderate',
  });
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a draft the user generated before being asked to sign in.
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw && params.get('resume')) {
      try {
        const saved = JSON.parse(raw) as { form: PlanRequest; draft: PlanDraft };
        setForm(saved.form);
        setDraft(saved.draft);
      } catch {
        sessionStorage.removeItem(DRAFT_KEY);
      }
    }
  }, [params]);

  const set = <K extends keyof PlanRequest>(k: K, v: PlanRequest[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function generate(e?: FormEvent) {
    e?.preventDefault();
    if (form.endDate < form.startDate) return setError('End date must be on or after the start date.');
    setBusy(true);
    setError(null);
    try {
      setDraft(await api<PlanDraft>('/trips/plan', { method: 'POST', body: form }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (!user) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, draft }));
      return navigate(`/login?next=${encodeURIComponent('/plan?resume=1')}`);
    }
    setSaving(true);
    setError(null);
    try {
      const trip = await api<TripDetail>('/trips', { method: 'POST', body: { request: { ...form, title: draft.title }, items: draft.items, generatedBy: draft.generatedBy } });
      sessionStorage.removeItem(DRAFT_KEY);
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const attractionPins = (draft?.items ?? []).filter((i) => i.lat != null && i.lng != null && i.kind === 'attraction');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title={t('planner.title')}
        subtitle="Tell us the essentials — we'll draft a realistic day-by-day plan you can edit and save."
        actions={
          meta.data && (
            <Badge tone={meta.data.aiEnabled ? 'brand' : 'slate'}>
              {meta.data.aiEnabled ? <><Sparkles className="h-3.5 w-3.5" /> AI planner enabled</> : <><Bot className="h-3.5 w-3.5" /> Rule-based planner (no AI key configured)</>}
            </Badge>
          )
        }
      />
      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-5">
          <form onSubmit={generate} className="space-y-4">
            <Field label="Starting from" htmlFor="origin" hint="City or town — used for travel time and cost">
              <Input id="origin" list="origins" required maxLength={160} value={form.origin} onChange={(e) => set('origin', e.target.value)} />
              <datalist id="origins">
                {['Delhi', 'Noida', 'Lucknow', 'Kanpur', 'Mumbai', 'Bengaluru', 'Kolkata', 'Jaipur', 'Patna'].map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Destination" htmlFor="city">
              <Select id="city" value={form.city} onChange={(e) => set('city', e.target.value)}>
                {(cities.data ?? [{ name: form.city, count: 0, lat: 0, lng: 0 }]).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date" htmlFor="start">
                <Input id="start" type="date" required min={todayIso()} value={form.startDate} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate })); }} />
              </Field>
              <Field label="End date" htmlFor="end">
                <Input id="end" type="date" required min={form.startDate} max={addDays(form.startDate, 13)} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Travellers" htmlFor="trav">
                <Input id="trav" type="number" min={1} max={30} required value={form.travellers} onChange={(e) => set('travellers', Number(e.target.value))} />
              </Field>
              <Field label="Total budget (₹)" htmlFor="budget">
                <Input id="budget" type="number" min={500} step={500} required value={form.budget} onChange={(e) => set('budget', Number(e.target.value))} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Interests</legend>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map((i) => {
                  const on = form.interests.includes(i);
                  return (
                    <button type="button" key={i} aria-pressed={on} onClick={() => set('interests', on ? form.interests.filter((x) => x !== i) : [...form.interests, i])}
                      className={cx('rounded-full border px-3 py-1 text-xs font-medium capitalize', on ? 'border-brand-700 bg-brand-700 text-white' : 'border-line text-muted hover:text-ink')}>
                      {i}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Transport" htmlFor="transport">
                <Select id="transport" value={form.transport} onChange={(e) => set('transport', e.target.value as PlanRequest['transport'])}>
                  <option value="train">Train</option>
                  <option value="bus">Bus</option>
                  <option value="car">Car / cab</option>
                  <option value="flight">Flight</option>
                </Select>
              </Field>
              <Field label="Pace" htmlFor="pace">
                <Select id="pace" value={form.pace} onChange={(e) => set('pace', e.target.value as PlanRequest['pace'])}>
                  <option value="relaxed">Relaxed</option>
                  <option value="moderate">Moderate</option>
                  <option value="packed">Packed</option>
                </Select>
              </Field>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" loading={busy} className="w-full"><Sparkles className="h-4 w-4" /> {draft ? 'Update itinerary' : 'Generate itinerary'}</Button>
          </form>
        </Card>

        <div className="min-w-0">
          {!draft ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-line p-10 text-center text-muted">
              <Sparkles className="mb-3 h-8 w-8 text-brand-600" />
              <p className="max-w-sm">Your itinerary will appear here — with timings, travel between stops, food breaks and a transparent cost estimate.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">{draft.title}</h2>
                  <p className="text-sm text-muted">
                    {draft.days} day{draft.days > 1 ? 's' : ''} · {form.origin} → {draft.city}
                    {draft.oneWayKm != null && ` · ~${Math.round(draft.oneWayKm)} km away`} ·{' '}
                    <Badge tone={draft.generatedBy === 'llm' ? 'brand' : 'slate'}>{draft.generatedBy === 'llm' ? 'AI-generated' : 'Rule-based plan'}</Badge>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => generate()} loading={busy}><RefreshCw className="h-4 w-4" /> Regenerate</Button>
                  <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> {user ? 'Save trip' : 'Sign in to save'}</Button>
                </div>
              </div>
              {draft.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
              <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                <ItineraryTimeline items={draft.items} days={draft.days} startDate={draft.startDate} />
                <div className="space-y-6">
                  <Card className="p-5"><EstimateBreakdown estimate={draft.budget} budget={form.budget} travellers={form.travellers} /></Card>
                  {attractionPins.length > 0 && (
                    <MapView
                      className="h-72"
                      ariaLabel="Itinerary map"
                      markers={attractionPins.map((i, k) => ({ id: `${i.day}-${k}`, lat: i.lat!, lng: i.lng!, label: String(i.day), color: PIN_COLORS.heritage, popup: `Day ${i.day}: ${i.title}` }))}
                    />
                  )}
                  <p className="text-xs text-muted">After saving you can edit stops, track expenses and share the plan with your group.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
