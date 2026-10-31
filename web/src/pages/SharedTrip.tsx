import { useParams } from 'react-router';
import { CalendarDays, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { CATEGORY_LABELS, fmtDate, inr } from '../lib/format';
import type { TripDetail } from '../lib/types';
import { ItineraryTimeline } from '../components/Itinerary';
import { Card, ErrorState, LinkButton, Spinner } from '../components/ui';

export default function SharedTrip() {
  const { token = '' } = useParams();
  const { data: trip, error, loading, reload } = useAsync((signal) => api<TripDetail>(`/shared/${encodeURIComponent(token)}`, { signal }), [token]);
  if (loading && !trip) return <Spinner />;
  if (error || !trip) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={error} onRetry={reload} /></div>;
  const b = trip.budgetSummary;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-sm text-muted">Shared itinerary · read-only</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{trip.title}</h1>
      <p className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
        <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}</span>
        <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {trip.travellers} traveller{trip.travellers > 1 ? 's' : ''}</span>
        <span>{trip.origin} → {trip.city}</span>
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <ItineraryTimeline items={trip.items} days={trip.days} startDate={trip.startDate} />
        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Planned budget (estimate)</p>
            <p className="mt-1 text-2xl font-semibold">{inr(b.plannedTotal)}</p>
            <p className="text-xs text-muted">{inr(b.perPersonPlanned)} per person</p>
            <ul className="mt-3 divide-y divide-line text-sm">
              {b.lines.map((l) => <li key={l.category} className="flex justify-between py-2"><span>{CATEGORY_LABELS[l.category]}</span><span className="tabular-nums">{inr(l.planned)}</span></li>)}
            </ul>
          </Card>
          <LinkButton to="/plan" className="w-full">Plan your own trip</LinkButton>
        </aside>
      </div>
    </div>
  );
}
