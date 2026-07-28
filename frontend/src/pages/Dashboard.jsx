import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getCurrentBusinessId, setCurrentBusinessId } from '../api/client';
import { useState, useEffect } from 'react';
import InstallPrompt from '../components/InstallPrompt';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const currentId = getCurrentBusinessId();

  useEffect(() => {
    api('/api/businesses').then(setBusinesses).catch(() => setBusinesses([]));
  }, []);

  const location = useLocation();
  const current = businesses.find((b) => String(b.id) === currentId) || businesses[0];
  useEffect(() => {
    if (businesses.length && !currentId) setCurrentBusinessId(businesses[0]?.id);
  }, [businesses, currentId]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Abrir por defecto en escritorio
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
  const tealBg = 'bg-[#14b8a6]';
  const panelActive = location.pathname === '/dashboard';

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

  return (
    <div className="min-h-screen bg-gray-100">
      <div
        role="button"
        tabIndex={0}
        aria-label="Cerrar menú"
        className={`fixed inset-0 z-30 bg-black/50 lg:hidden ${sidebarOpen ? 'visible' : 'invisible pointer-events-none'}`}
        onClick={closeSidebar}
        onKeyDown={(e) => e.key === 'Escape' && closeSidebar()}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-[#1e1e1e] text-white transition-transform duration-200 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#14b8a6] text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            <span className="font-semibold text-white">Boo-king</span>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-2">
          <Link to="/dashboard" onClick={closeSidebar} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${panelActive ? tealBg + ' text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>Panel</Link>
          <Link to="/dashboard/appointments" onClick={closeSidebar} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${is('/dashboard/appointments') ? tealBg + ' text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>Citas</Link>
          <Link to="/dashboard/businesses" onClick={closeSidebar} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${is('/dashboard/businesses') ? tealBg + ' text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>Negocios</Link>
          <Link to="/dashboard/calendar" onClick={closeSidebar} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${is('/dashboard/calendar') ? tealBg + ' text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>Calendario</Link>
          <Link to="/dashboard/reportes" onClick={closeSidebar} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${is('/dashboard/reportes') ? tealBg + ' text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>Reportes</Link>
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
            <span>Ocultar menú</span>
          </button>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white pl-4 pr-6 lg:pl-56">
        <div className="flex h-14 items-center justify-between">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {sidebarOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
          <div className="flex flex-1 items-center justify-end gap-4 lg:justify-start">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14b8a6] text-xs font-semibold text-white">
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
          </div>
          <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">Cerrar sesión</button>
        </div>
      </header>
      <main className="p-4 lg:pl-56 lg:p-6">
        <InstallPrompt />
        <Outlet />
      </main>
    </div>
  );
}
