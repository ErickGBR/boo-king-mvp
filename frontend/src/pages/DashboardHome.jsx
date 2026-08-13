import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';

export default function DashboardHome() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const roleLabel = { owner: 'Dueño', admin: 'Admin', staff: 'Staff' };

  const quickActions = [
    { path: '/dashboard/appointments', label: t('sidebar.appointments'), desc: 'Gestiona y programa nuevas citas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/dashboard/businesses', label: t('sidebar.businesses'), desc: 'Administra tus negocios y enlaces', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { path: '/dashboard/calendar', label: t('sidebar.calendar'), desc: 'Vista general de todas tus citas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm2-7h2m4 0h2' },
    { path: '/dashboard/reportes', label: t('sidebar.reports'), desc: 'Analiza el rendimiento de tu negocio', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('sidebar.panel')}</h1>
        {user && (
          <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-700 border border-teal-200">
            {roleLabel[user.role] || user.role}
          </span>
        )}
      </div>
      <p className="mt-2 text-gray-600">Bienvenido, {user?.name || user?.email}.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, i) => (
          <Link
            key={action.path}
            to={action.path}
            className={`animate-fade-in-up animate-stagger-${i + 1} group rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300/50 hover:shadow-xl`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-transform duration-300 group-hover:scale-110 group-hover:bg-teal-100">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">{action.label}</h3>
            <p className="mt-1 text-sm text-gray-500">{action.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
