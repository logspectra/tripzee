import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Bookmark, BookmarkCheck, CalendarPlus, Clock, ExternalLink, Hotel, Navigation, Pause, Utensils, Volume2, Hospital } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/auth';
import { useI18n, type MessageKey } from '../lib/i18n';
import { useSpeech } from '../lib/speech';
import { fmtDate, minutes } from '../lib/format';
import type { DestinationDetail } from '../lib/types';
import { DestinationCard, DestinationImage } from '../components/DestinationCard';
import { MapView, PIN_COLORS } from '../components/MapView';
import { ReviewSection } from '../components/ReviewSection';
import { Badge, Button, Card, ErrorState, LinkButton, Notice, Spinner, Stars, VerifiedBadge } from '../components/ui';

function Fact({ label, value, verified, unverifiedNote }: { label: string; value?: string | null; verified: boolean; unverifiedNote: string }) {
  return (
    <div className="py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">
        {value ? (
          <>
            {value}
            {!verified && <Badge tone="amber" className="ml-2">{unverifiedNote}</Badge>}
          </>
        ) : (
          <span className="text-muted">{unverifiedNote} — check the official source before visiting.</span>
        )}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="prose-tz text-[15px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export default function DestinationPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { t, pick, locale } = useI18n();
  const navigate = useNavigate();
  const speech = useSpeech();
  const { data: d, error, loading, reload, setData } = useAsync((signal) => api<DestinationDetail>(`/destinations/${slug}`, { signal }), [slug]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading && !d) return <Spinner />;
  if (error || !d) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={error} onRetry={reload} /></div>;

  async function toggleSave() {
    if (!user) return navigate(`/login?next=/destinations/${slug}`);
    setSaving(true);
    setSaveError(null);
    try {
      if (d!.saved && d!.savedId) {
        await api(`/saved/${d!.savedId}`, { method: 'DELETE' });
        setData((prev) => ({ ...prev!, saved: false, savedId: null }));
      } else {
        const r = await api<{ id: string }>('/saved', { method: 'POST', body: { destinationId: d!.id } });
        setData((prev) => ({ ...prev!, saved: true, savedId: r.id }));
      }
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const narration = locale === 'hi' && d.summaryHi ? `${d.nameHi ?? d.name}. ${d.summaryHi}` : `${d.name}. ${d.summary} ${d.description} ${d.history ?? ''}`;
  const unverified = t('common.notVerified');
  const L = (k: MessageKey) => t(k);

  return (
    <article>
      <div className="relative h-72 bg-slate-200 sm:h-96">
        <DestinationImage src={d.imageUrl} alt={d.name} credit={d.imageCredit} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-4 pb-6 text-white sm:px-6">
            <p className="text-sm text-white/80">
              <Link to={`/destinations?city=${encodeURIComponent(d.city)}`} className="hover:underline">{d.city}</Link> · {locale === 'hi' ? d.category.nameHi : d.category.name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{pick(d.name, d.nameHi)}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Stars value={d.rating.average} />
              <span>{d.rating.count ? `${d.rating.average?.toFixed(1)} · ${d.rating.count} review${d.rating.count === 1 ? '' : 's'}` : 'No reviews yet'}</span>
            </div>
          </div>
        </div>
        {d.imageCredit && <p className="absolute right-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[10px] text-white/80">Photo: {d.imageCredit}</p>}
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Button variant={d.saved ? 'secondary' : 'primary'} onClick={toggleSave} loading={saving}>
              {d.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {d.saved ? t('common.saved') : t('common.save')}
            </Button>
            <LinkButton variant="secondary" to={`/map?to=${d.slug}`}><Navigation className="h-4 w-4" /> {t('common.directions')}</LinkButton>
            <LinkButton variant="secondary" to={`/plan?city=${encodeURIComponent(d.city)}`}><CalendarPlus className="h-4 w-4" /> Plan a trip to {d.city}</LinkButton>
            {speech.supported && (
              <Button variant="ghost" onClick={() => (speech.speaking ? speech.stop() : speech.speak(narration, locale))} aria-pressed={speech.speaking}>
                {speech.speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {speech.speaking ? t('common.stop') : t('common.listen')}
              </Button>
            )}
          </div>
          {saveError && <Notice tone="error">{saveError}</Notice>}
          {speech.supported && locale === 'hi' && !speech.hasVoice('hi') && (
            <Notice tone="info">Your device has no Hindi voice installed, so narration may use a default voice.</Notice>
          )}

          <p className="text-lg text-ink">{pick(d.summary, d.summaryHi)}</p>
          <Section title="About">
            <p>{d.description}</p>
          </Section>
          {d.history && <Section title={L('dest.history')}><p>{d.history}</p></Section>}
          {d.culturalSignificance && <Section title={L('dest.culture')}><p>{d.culturalSignificance}</p></Section>}
          {locale === 'hi' && <p className="text-xs text-muted">विस्तृत विवरण अभी अंग्रेज़ी में उपलब्ध है।</p>}

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{L('dest.nearbyPlaces')}</h2>
            {d.nearby.length === 0 ? (
              <p className="text-sm text-muted">No other curated places within 60 km yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.nearby.slice(0, 6).map((n) => <DestinationCard key={n.id} d={n} compact />)}</div>
            )}
          </section>

          <ReviewSection
            slug={d.slug}
            histogram={d.ratingHistogram}
            count={d.rating.count}
            average={d.rating.average}
            reviewedByMe={d.reviewedByMe}
            onChanged={reload}
          />
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{L('dest.practical')}</h2>
              <VerifiedBadge verified={d.factsVerified} />
            </div>
            {d.factsVerified && d.lastVerifiedAt && <p className="mt-1 text-xs text-muted">Last verified {fmtDate(d.lastVerifiedAt)}</p>}
            <dl className="mt-2 divide-y divide-line">
              <Fact label={L('dest.hours')} value={d.openingHours} verified={d.factsVerified} unverifiedNote={unverified} />
              <Fact label={L('dest.fee')} value={d.entryFee} verified={d.factsVerified} unverifiedNote={unverified} />
              <div className="py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{L('dest.duration')}</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm"><Clock className="h-4 w-4 text-muted" /> ~{minutes(d.visitMinutes)} <span className="text-xs text-muted">(typical estimate)</span></dd>
              </div>
              {d.bestTimeToVisit && (
                <div className="py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">{L('dest.bestTime')}</dt>
                  <dd className="mt-1 text-sm">{d.bestTimeToVisit} <span className="text-xs text-muted">(general guidance)</span></dd>
                </div>
              )}
              <Fact label={L('dest.accessibility')} value={d.accessibility} verified={d.factsVerified} unverifiedNote="No verified accessibility information yet" />
              {d.guidelines && (
                <div className="py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">{L('dest.guidelines')}</dt>
                  <dd className="mt-1 text-sm">{d.guidelines}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.officialUrl && (
                <a href={d.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-sm hover:bg-slate-50">
                  {L('dest.official')} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {d.ticketUrl && (
                <a href={d.ticketUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-800">
                  {L('dest.tickets')} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {(d.officialUrl || d.ticketUrl) && <p className="mt-2 text-xs text-muted">External sites open in a new tab. Tripzee doesn't sell tickets.</p>}
          </Card>

          <MapView
            className="h-64"
            ariaLabel={`Map of ${d.name}`}
            fit={false}
            center={[d.lat, d.lng]}
            zoom={14}
            markers={[{ id: d.id, lat: d.lat, lng: d.lng, popup: d.name, color: PIN_COLORS[d.category.slug as keyof typeof PIN_COLORS] }]}
          />
          <p className="-mt-4 text-xs text-muted">
            {d.lat.toFixed(5)}, {d.lng.toFixed(5)} {d.coordsSource ? `· coordinates from ${d.coordsSource}` : '· approximate coordinates'}
          </p>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Around here</h2>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { type: 'hotel', label: 'Stays', icon: Hotel },
                { type: 'restaurant', label: 'Food', icon: Utensils },
                { type: 'hospital', label: 'Hospitals', icon: Hospital },
              ].map((s) => (
                <Link key={s.type} to={`/services?lat=${d.lat}&lng=${d.lng}&type=${s.type}&near=${encodeURIComponent(d.name)}`} className="rounded-xl border border-line p-3 hover:bg-slate-50">
                  <s.icon className="mx-auto mb-1 h-5 w-5 text-brand-700" aria-hidden />
                  {s.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">{L('dest.sources')}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {d.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    {s.label} <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Editorial summary for the Tripzee demo catalogue. Spot an error? Report it to our moderators via a review report.</p>
          </Card>
        </aside>
      </div>
    </article>
  );
}
