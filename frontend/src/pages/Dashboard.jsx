import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getCurrentBusinessId, setCurrentBusinessId } from '../api/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import InstallPrompt from '../components/InstallPrompt';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ProfileModal from '../components/ProfileModal';

const DESKTOP_BREAKPOINT = 1024;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const isDesktop = useMediaQuery(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

  const [businesses, setBusinesses] = useState([]);
  const currentId = getCurrentBusinessId();
  const [scrolled, setScrolled] = useState(false);

  // Sidebar states: mobile uses sidebarOpen, desktop uses desktopExpanded
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(true);

  // Profile modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // User dropdown
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const userButtonRef = useRef(null);

  // When viewport crosses breakpoint, sync sidebar
  useEffect(() => {
    if (isDesktop) {
      setSidebarOpen(false);
      document.body.style.overflow = '';
    } else {
      // On mobile, sidebar should be closed by default
      setSidebarOpen(false);
    }
  }, [isDesktop]);

  // Mobile body scroll lock
  useEffect(() => {
    if (!isDesktop && sidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [sidebarOpen, isDesktop]);

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load businesses
  useEffect(() => {
    api('/api/businesses').then(setBusinesses).catch(() => setBusinesses([]));
  }, []);

  const current = businesses.find((b) => String(b.id) === currentId) || businesses[0];
  useEffect(() => {
    if (businesses.length && !currentId) setCurrentBusinessId(businesses[0]?.id);
  }, [businesses, currentId]);

  // Close user dropdown on outside click
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClick = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userDropdownOpen]);

  // Close user dropdown on navigation
  useEffect(() => {
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const closeMobileSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) {
      setDesktopExpanded((v) => !v);
    } else {
      setSidebarOpen((v) => !v);
    }
  }, [isDesktop]);

  const handleSidebarNav = useCallback(() => {
    if (!isDesktop) closeMobileSidebar();
  }, [isDesktop, closeMobileSidebar]);

  const handleLogout = useCallback(() => {
    setUserDropdownOpen(false);
    logout();
  }, [logout]);

  const handleEditProfile = useCallback(() => {
    setUserDropdownOpen(false);
    setProfileModalOpen(true);
  }, []);

  const is = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const roleLabel = { owner: t('profile.owner'), admin: t('profile.admin'), staff: t('profile.staff') };

  // Sidebar width classes
  const sidebarWidthClass = isDesktop
    ? (desktopExpanded ? 'w-64' : 'w-16')
    : 'w-64';

  // Dynamic padding for header and main
  const contentPaddingClass = isDesktop
    ? (desktopExpanded ? 'lg:pl-64' : 'lg:pl-16')
    : '';

  const navItems = [
    { path: '/dashboard', label: t('sidebar.panel'), icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
    { path: '/dashboard/appointments', label: t('sidebar.appointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/dashboard/businesses', label: t('sidebar.businesses'), icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { path: '/dashboard/calendar', label: t('sidebar.calendar'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm2-7h2m4 0h2' },
    { path: '/dashboard/reportes', label: t('sidebar.reports'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { path: '/dashboard/services', label: t('sidebar.services'), icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { path: '/dashboard/attendance', label: t('sidebar.attendance'), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/dashboard/staff', label: t('sidebar.staff'), icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { path: '/dashboard/profile', label: t('sidebar.profile'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ];

  const sidebarLogoCollapsed = (
    <div className="flex h-14 items-center justify-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </span>
    </div>
  );

  const sidebarLogoExpanded = (
    <div className="flex h-14 items-center justify-between gap-2 px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>
        <span className="font-semibold text-white">{t('app.name')}</span>
      </div>
    </div>
  );

  const sidebarUserExpanded = user && (
    <div className="px-3 mt-2">
      <div className="rounded-lg bg-gray-700/50 px-3 py-2 text-xs">
        <p className="text-gray-300 truncate">{user.email}</p>
        <p className="text-teal-400 font-medium mt-0.5">{roleLabel[user.role] || user.role}</p>
      </div>
    </div>
  );

  const sidebarUserCollapsed = user && (
    <div className="flex justify-center mt-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-semibold text-white" title={user.email}>
        {(user.name || user.email || '').slice(0, 2).toUpperCase()}
      </div>
    </div>
  );

  const renderNavItem = (item) => {
    const active = item.path === '/dashboard'
      ? location.pathname === '/dashboard'
      : is(item.path);

    if (!desktopExpanded && isDesktop) {
      // Collapsed desktop: icon-only with tooltip
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={handleSidebarNav}
          title={item.label}
          aria-label={item.label}
          className={`relative flex items-center justify-center rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
            active
              ? 'bg-teal-500 text-white'
              : 'text-gray-200 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
          </svg>
        </Link>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={handleSidebarNav}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
          active
            ? 'bg-teal-500 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-white before:rounded-r-full'
            : 'text-gray-200 hover:bg-gray-700 hover:text-white'
        }`}
      >
        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
        </svg>
        <span>{item.label}</span>
      </Link>
    );
  };

  // User dropdown menu
  const userDropdown = (
    <div className="relative" ref={userDropdownRef}>
      <button
        ref={userButtonRef}
        type="button"
        onClick={() => setUserDropdownOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
        aria-expanded={userDropdownOpen}
        aria-haspopup="true"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-semibold text-white">
          {(user?.name || user?.email || '').slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden text-sm font-medium text-gray-700 lg:block">{user?.name || user?.email}</span>
        <svg className={`hidden h-4 w-4 text-gray-400 transition-transform lg:block ${userDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {userDropdownOpen && (
        <div className="animate-slide-down absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleEditProfile}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t('user.editProfile')}
          </button>
          <div className="border-t border-gray-100 px-4 py-2">
            <p className="mb-1 text-xs font-medium text-gray-500">{t('user.changeLanguage')}</p>
            <LanguageSwitcher />
          </div>
          <hr className="border-gray-100" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('user.logout')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile overlay */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t('sidebar.close')}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 lg:hidden ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
        onClick={closeMobileSidebar}
        onKeyDown={(e) => e.key === 'Escape' && closeMobileSidebar()}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-[#1e1e1e] text-white transition-all duration-200 ease-out ${sidebarWidthClass} ${
          isDesktop
            ? 'translate-x-0'
            : sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        {desktopExpanded || !isDesktop ? sidebarLogoExpanded : sidebarLogoCollapsed}

        {/* User info (mobile always, desktop collapsed only) */}
        {!isDesktop && sidebarUserExpanded}
        {isDesktop && !desktopExpanded && sidebarUserCollapsed}
        {isDesktop && desktopExpanded && sidebarUserExpanded}

        {/* Nav items */}
        <nav className="mt-4 space-y-1 px-2">
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Bottom actions (mobile only) */}
        {!isDesktop && (
          <div className="mt-auto px-4 pb-4">
            <button
              type="button"
              onClick={closeMobileSidebar}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{t('sidebar.close')}</span>
            </button>
          </div>
        )}

        {/* Desktop collapse toggle at bottom */}
        {isDesktop && (
          <div className="mt-auto px-2 pb-4">
            <button
              type="button"
              onClick={() => setDesktopExpanded((v) => !v)}
              title={desktopExpanded ? t('sidebar.collapse') : t('sidebar.expand')}
              className={`flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-white ${!desktopExpanded ? 'justify-center' : 'justify-center'}`}
            >
              <svg
                className={`h-5 w-5 transition-transform duration-200 ${!desktopExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {desktopExpanded && <span className="ml-2">{t('sidebar.expand')}</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Header */}
      <header className={`sticky top-0 z-20 border-b border-gray-200 bg-white pl-4 pr-4 transition-all duration-200 ${contentPaddingClass} ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="flex h-14 items-center justify-between">
          {/* Burger button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
            aria-label={
              isDesktop
                ? (desktopExpanded ? t('sidebar.collapseMenu') : t('sidebar.expandMenu'))
                : (sidebarOpen ? t('sidebar.close') : t('sidebar.menu'))
            }
          >
            {isDesktop
              ? desktopExpanded
                ? (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )
                : (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )
              : sidebarOpen
              ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )
              : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
          </button>

          <div className="flex flex-1 items-center justify-end gap-3 lg:justify-between">
            {/* Business selector (desktop) */}
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

            {/* Right side: user dropdown */}
            <div className="flex items-center gap-2">
              {userDropdown}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`p-4 transition-all duration-200 ${contentPaddingClass} lg:p-6`}>
        <InstallPrompt />
        <Outlet />
      </main>

      {/* Profile modal */}
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}
