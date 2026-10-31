import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { Bell, LogOut, Menu, ShieldCheck, User as UserIcon, WifiOff, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n, type MessageKey } from '../lib/i18n';
import { useOnline } from '../lib/offline';
import { api } from '../lib/api';
import type { AppNotification } from '../lib/types';
import { timeAgo } from '../lib/format';
import { Spinner, cx } from './ui';

const NAV: { to: string; key: MessageKey }[] = [
  { to: '/destinations', key: 'nav.explore' },
  { to: '/map', key: 'nav.map' },
  { to: '/plan', key: 'nav.plan' },
  { to: '/services', key: 'nav.services' },
  { to: '/rooms', key: 'nav.rooms' },
  { to: '/community', key: 'nav.community' },
  { to: '/assistant', key: 'nav.assistant' },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg">Tripzee</span>
    </Link>
  );
}

function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="Language">
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cx('rounded-md px-2 py-1 font-medium', locale === l ? 'bg-brand-700 text-white' : 'text-muted hover:text-ink')}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const unread = items?.filter((n) => !n.read).length ?? 0;
  const location = useLocation();

  useEffect(() => {
    api<AppNotification[]>('/notifications').then(setItems).catch(() => setItems([]));
  }, [location.pathname]);

  async function toggle() {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      await api('/notifications/read', { method: 'POST' }).catch(() => undefined);
      setItems((xs) => xs?.map((n) => ({ ...n, read: true })) ?? null);
    }
  }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={open}>
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
      </button>
      {open && (
        <div className="absolute right-0 z-[1000] mt-2 w-80 rounded-2xl border border-line bg-white p-2 shadow-xl">
          {items === null ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  {n.link ? (
                    <Link to={n.link} onClick={() => setOpen(false)} className="block rounded-xl p-3 text-sm hover:bg-slate-50">
                      {n.message}
                      <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.createdAt)}</span>
                    </Link>
                  ) : (
                    <div className="rounded-xl p-3 text-sm">
                      {n.message}
                      <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.createdAt)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-800' : 'text-muted hover:text-ink');

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-[900] border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-0.5 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={navCls}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            {user ? (
              <>
                <Notifications />
                <NavLink to="/dashboard" className={({ isActive }) => cx('hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium sm:flex', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink hover:bg-slate-100')}>
                  <UserIcon className="h-4 w-4" aria-hidden /> {t('nav.dashboard')}
                </NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin" className="hidden rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink sm:block" aria-label={t('nav.admin')} title={t('nav.admin')}>
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                  </NavLink>
                )}
                <button
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="hidden rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink sm:block"
                  aria-label={t('nav.logout')}
                  title={t('nav.logout')}
                >
                  <LogOut className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100 sm:block">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="hidden rounded-xl bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800 sm:block">
                  {t('nav.register')}
                </Link>
              </>
            )}
            <button className="rounded-lg p-2 text-ink hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-line bg-white px-4 py-3 lg:hidden" aria-label="Mobile">
            <div className="grid gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={navCls}>
                  {t(n.key)}
                </NavLink>
              ))}
              <div className="my-2 border-t border-line" />
              {user ? (
                <>
                  <NavLink to="/dashboard" className={navCls}>
                    {t('nav.dashboard')}
                  </NavLink>
                  {user.role === 'ADMIN' && (
                    <NavLink to="/admin" className={navCls}>
                      {t('nav.admin')}
                    </NavLink>
                  )}
                  <button onClick={async () => { await logout(); navigate('/'); }} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted">
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navCls}>{t('nav.login')}</NavLink>
                  <NavLink to="/register" className={navCls}>{t('nav.register')}</NavLink>
                </>
              )}
            </div>
          </nav>
        )}
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
            <WifiOff className="h-3.5 w-3.5" aria-hidden /> {t('offline.banner')}
          </div>
        )}
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs">Smart travel for India — starting with Uttar Pradesh.</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-ink">About our data</p>
            <p>
              Destination content is an editorial demo catalogue. Opening hours and fees are shown only when available and are labelled
              unless verified — always confirm with official sources.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-ink">Credits</p>
            <p>
              Maps &amp; places © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.
              Routing by OSRM. Photos from Wikimedia Commons via Wikipedia.
            </p>
            <p>Emergency in India: dial <strong className="text-ink">112</strong>.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  const online = useOnline();
  if (!ready) return <Spinner />;
  if (!user && !online && !admin) return <>{children}</>; // pages fall back to on-device copies
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Administrators only</h1>
        <p className="mt-2 text-muted">Your account doesn't have access to this area.</p>
      </div>
    );
  }
  return <>{children}</>;
}
