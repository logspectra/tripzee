import { Link } from 'react-router';
import { ArrowRight, Bot, CalendarRange, Hotel, Map, Users, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import type { City, DestinationCard as Card, Page } from '../lib/types';
import { SearchBox } from '../components/SearchBox';
import { DestinationCard } from '../components/DestinationCard';
import { ErrorState, LinkButton, Skeleton } from '../components/ui';

const FEATURES = [
  { to: '/map', icon: Map, title: 'Interactive map', text: 'Find monuments, routes, travel time and what is nearby.' },
  { to: '/plan', icon: CalendarRange, title: 'Trip planner', text: 'Day-by-day itineraries matched to your pace and interests.' },
  { to: '/dashboard', icon: Wallet, title: 'Budget & expenses', text: 'Transparent estimates, then track what you actually spend.' },
  { to: '/services', icon: Hotel, title: 'Hotels & services', text: 'Stays, food, hospitals, ATMs and transport from OpenStreetMap.' },
  { to: '/rooms', icon: Users, title: 'Travel Rooms', text: 'Plan with friends, set meeting points, share location by choice.' },
  { to: '/assistant', icon: Bot, title: 'Travel assistant', text: 'Ask about history and timing in English or Hindi — with audio.' },
];

export function Home() {
  const { t } = useI18n();
  const featured = useAsync((signal) => api<Page<Card>>('/destinations?sort=name&pageSize=60', { signal }), []);
  const cities = useAsync((signal) => api<City[]>('/destinations/cities', { signal }), []);

  // Prefer destinations that already have a photo for the featured row.
  const picks = (featured.data?.items ?? [])
    .slice()
    .sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl) || (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .filter((d, i, arr) => arr.findIndex((x) => x.city === d.city) === i || i < 3)
    .slice(0, 6);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50/70 to-white">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-medium text-brand-700">Uttar Pradesh · India</p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{t('home.title')}</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted">{t('home.subtitle')}</p>
            <div className="mt-8 max-w-2xl">
              <SearchBox large />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {['Taj Mahal', 'Varanasi', 'Lucknow', 'Ayodhya', 'Sarnath'].map((s) => (
                <Link key={s} to={`/destinations?q=${encodeURIComponent(s)}`} className="rounded-full border border-line bg-white px-3 py-1 text-muted hover:border-brand-200 hover:text-brand-800">
                  {s}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">{t('home.featured')}</h2>
          <Link to="/destinations" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.error ? (
          <ErrorState error={featured.error} onRetry={featured.reload} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.loading && !featured.data
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)
              : picks.map((d) => <DestinationCard key={d.id} d={d} />)}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="grid gap-8 overflow-hidden rounded-3xl bg-ink p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('home.planCta')}</h2>
            <p className="mt-3 max-w-xl text-slate-300">{t('home.planCtaSub')}</p>
            <LinkButton to="/plan" className="mt-6 bg-brand-500 text-ink hover:bg-brand-200">
              {t('nav.plan')} <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="rounded-2xl bg-white/5 p-4">✓ Real travel times between stops, lunch and dinner breaks</li>
            <li className="rounded-2xl bg-white/5 p-4">✓ Cost estimate that shows its working — never fake prices</li>
            <li className="rounded-2xl bg-white/5 p-4">✓ Edit, regenerate, save offline and share with your group</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{t('home.cities')}</h2>
        <div className="flex flex-wrap gap-3">
          {cities.loading && !cities.data && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-32" />)}
          {cities.data?.map((c) => (
            <Link key={c.name} to={`/destinations?city=${encodeURIComponent(c.name)}`} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm hover:border-brand-200 hover:bg-brand-50">
              <span className="font-medium text-ink">{c.name}</span> <span className="text-muted">· {c.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-slate-50/60">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className="group rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-md">
              <f.icon className="h-6 w-6 text-brand-700" aria-hidden />
              <h3 className="mt-4 font-semibold text-ink group-hover:text-brand-700">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
