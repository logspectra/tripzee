import { Link } from 'react-router';
import { MapPin, Mountain } from 'lucide-react';
import type { DestinationCard as Card } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { km } from '../lib/format';
import { Stars, cx } from './ui';

export function DestinationImage({ src, alt, credit, className }: { src?: string | null; alt: string; credit?: string | null; className?: string }) {
  if (!src) {
    return (
      <div className={cx('flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 text-brand-700/40', className)} role="img" aria-label={`${alt} (no photo yet)`}>
        <Mountain className="h-10 w-10" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt} title={credit ?? undefined} loading="lazy" referrerPolicy="no-referrer" className={cx('object-cover', className)} />;
}

export function DestinationCard({ d, compact }: { d: Card; compact?: boolean }) {
  const { pick, locale } = useI18n();
  return (
    <Link
      to={`/destinations/${d.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-lg hover:shadow-slate-200/60"
    >
      <div className="relative">
        <DestinationImage src={d.imageUrl} alt={d.name} credit={d.imageCredit} className={cx('w-full', compact ? 'h-32' : 'h-44')} />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-ink backdrop-blur">
          {locale === 'hi' ? d.category.nameHi : d.category.name}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-semibold text-ink group-hover:text-brand-700">{pick(d.name, d.nameHi)}</h3>
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" aria-hidden /> {d.city}
          {d.distanceKm != null && <span>· {km(d.distanceKm)}</span>}
        </p>
        {!compact && <p className="line-clamp-2 text-sm text-muted">{pick(d.summary, d.summaryHi)}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted">
          {d.reviewCount > 0 ? (
            <>
              <Stars value={d.avgRating} /> <span>{d.avgRating?.toFixed(1)} ({d.reviewCount})</span>
            </>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>
      </div>
    </Link>
  );
}
