import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getCurrentBusinessId, setCurrentBusinessId } from '../api/client';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import InstallPrompt from '../components/InstallPrompt';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [businesses, setBusinesses] = useState([]);
  const currentId = getCurrentBusinessId();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api('/api/businesses').then(setBusinesses).catch(() => setBusinesses([]));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const location = useLocation();
  const current = businesses.find((b) => String(b.id) === currentId) || businesses[0];
  useEffect(() => {
    if (businesses.length && !currentId) setCurrentBusinessId(businesses[0]?.id);
  }, [businesses, currentId]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [sidebarOpen]);
  const is = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const tealBg = 'bg-teal-500';

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

  const roleLabel = { owner: 'Dueño', admin: 'Admin', staff: 'Staff' };

  const navItems = [
    { path: '/dashboard', label: t('sidebar.panel'), icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
    { path: '/dashboard/appointments', label: t('sidebar.appointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/dashboard/businesses', label: t('sidebar.businesses'), icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { path: '/dashboard/calendar', label: t('sidebar.calendar'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm2-7h2m4 0h2' },
    { path: '/dashboard/reportes', label: t('sidebar.reports'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('common.cancel')}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 lg:hidden ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
        onClick={closeSidebar}
        onKeyDown={(e) => e.key === 'Escape' && closeSidebar()}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-[#1e1e1e] text-white transition-transform duration-200 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            <span className="font-semibold text-white">{t('app.name')}</span>
          </div>
        </div>
        {user && (
          <div className="px-4 mt-2">
            <div className="rounded-lg bg-gray-700/50 px-3 py-2 text-xs">
              <p className="text-gray-300 truncate">{user.email}</p>
              <p className="text-teal-400 font-medium mt-0.5">{roleLabel[user.role] || user.role}</p>
            </div>
          </div>
        )}
        <nav className="mt-4 space-y-1 px-2">
          {navItems.map((item, i) => {
            const active = item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : is(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={`animate-fade-in-up animate-stagger-${i + 1} relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? 'bg-teal-500 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-teal-500 before:rounded-r-full'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-4 pb-4 lg:hidden">
          <button
            type="button"
            onClick={closeSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{t('common.cancel')}</span>
          </button>
        </div>
      </aside>
      <header className={`sticky top-0 z-20 border-b border-gray-200 bg-white pl-4 pr-6 transition-shadow duration-300 lg:pl-56 ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="flex h-14 items-center justify-between">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label={sidebarOpen ? t('common.cancel') : 'Menú'}
          >
            {sidebarOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
          <div className="flex flex-1 items-center justify-end gap-4 lg:justify-between">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-semibold text-white">
                {current ? String(current.name).slice(0, 2).toUpperCase() : '—'}
              </span>
              <select
                value={currentId || ''}
                onChange={(e) => setCurrentBusinessId(e.target.value ? Number(e.target.value) : null)}
                className="border-0 bg-transparent text-sm font-medium text-gray-900 focus:ring-0"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">{t('nav.logout')}</button>
            </div>
          </div>
        </div>
      </header>
      <main className="p-4 lg:pl-56 lg:p-6">
        <InstallPrompt />
        <Outlet />
      </main>
    </div>
  );
}
