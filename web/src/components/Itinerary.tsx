import { Link } from 'react-router';
import { BedDouble, Landmark, MoreHorizontal, TrainFront, UtensilsCrossed } from 'lucide-react';
import type { BudgetEstimate, ItemKind, ItineraryItem } from '../lib/types';
import { CATEGORY_LABELS, addDays, fmtDate, inr } from '../lib/format';
import { Badge } from './ui';

export const KIND_META: Record<ItemKind, { label: string; icon: typeof Landmark; tone: string }> = {
  attraction: { label: 'Sightseeing', icon: Landmark, tone: 'bg-brand-50 text-brand-800' },
  food: { label: 'Food', icon: UtensilsCrossed, tone: 'bg-orange-50 text-orange-800' },
  travel: { label: 'Travel', icon: TrainFront, tone: 'bg-indigo-50 text-indigo-800' },
  stay: { label: 'Stay', icon: BedDouble, tone: 'bg-sky-50 text-sky-800' },
  other: { label: 'Other', icon: MoreHorizontal, tone: 'bg-slate-100 text-slate-700' },
};

export function groupByDay(items: ItineraryItem[], days: number) {
  const out: ItineraryItem[][] = Array.from({ length: days }, () => []);
  for (const i of items) if (i.day >= 1 && i.day <= days) out[i.day - 1].push(i);
  out.forEach((d) => d.sort((a, b) => a.position - b.position));
  return out;
}

export function ItineraryTimeline({ items, days, startDate }: { items: ItineraryItem[]; days: number; startDate: string }) {
  const byDay = groupByDay(items, days);
  return (
    <div className="space-y-8">
      {byDay.map((list, idx) => (
        <section key={idx} aria-labelledby={`day-${idx + 1}`}>
          <h3 id={`day-${idx + 1}`} className="mb-3 flex items-baseline gap-2">
            <span className="text-lg font-semibold">Day {idx + 1}</span>
            <span className="text-sm text-muted">{fmtDate(addDays(startDate, idx), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </h3>
          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Free day — explore at your own pace.</p>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-line pl-6">
              {list.map((i, k) => {
                const meta = KIND_META[i.kind];
                return (
                  <li key={i.id ?? `${idx}-${k}`} className="relative">
                    <span className={`absolute -left-[37px] top-1 grid h-7 w-7 place-items-center rounded-full ring-4 ring-white ${meta.tone}`}>
                      <meta.icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="rounded-xl border border-line bg-white p-3.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-ink">
                          {i.destinationSlug ? <Link to={`/destinations/${i.destinationSlug}`} className="hover:text-brand-700 hover:underline">{i.title}</Link> : i.title}
                        </p>
                        {(i.startTime || i.endTime) && <span className="text-sm tabular-nums text-muted">{i.startTime}{i.endTime ? ` – ${i.endTime}` : ''}</span>}
                      </div>
                      {i.notes && <p className="mt-1 text-sm text-muted">{i.notes}</p>}
                      {i.estCost > 0 && <Badge className="mt-2">≈ {inr(i.estCost)} est. for group</Badge>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

export function EstimateBreakdown({ estimate, budget, travellers }: { estimate: BudgetEstimate; budget: number; travellers: number }) {
  const over = estimate.total > budget;
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Estimated total</p>
          <p className="text-2xl font-semibold">{inr(estimate.total)}</p>
          <p className="text-xs text-muted">{inr(estimate.perPerson)} per person · {travellers} traveller{travellers > 1 ? 's' : ''}</p>
        </div>
        <Badge tone={over ? 'red' : 'green'}>{over ? `${inr(estimate.total - budget)} over budget` : `${inr(budget - estimate.total)} under budget`}</Badge>
      </div>
      <ul className="divide-y divide-line text-sm">
        {estimate.lines.map((l) => (
          <li key={l.category} className="py-2.5">
            <div className="flex justify-between gap-3"><span className="font-medium">{CATEGORY_LABELS[l.category]}</span><span className="tabular-nums">{inr(l.planned)}</span></div>
            <p className="mt-0.5 text-xs text-muted">{l.basis}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Estimates use typical {estimate.tier.toLowerCase()}-tier rates — not live prices. Entry fees are placeholders until verified on each place's official source.
      </p>
    </div>
  );
}
