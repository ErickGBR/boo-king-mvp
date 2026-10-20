import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function DashboardHome() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ businesses: 0, appointmentsToday: 0 });

  useEffect(() => {
    api('/api/businesses')
      .then((list) => setStats((s) => ({ ...s, businesses: list.length })))
      .catch(() => {});
    api('/api/reports/summary')
      .then((data) => setStats((s) => ({ ...s, appointmentsToday: data?.summary?.today || 0 })))
      .catch(() => {});
  }, []);

  const quickActions = [
    { path: '/dashboard/appointments', label: t('sidebar.appointments'), desc: t('welcome.manageAppointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/dashboard/businesses', label: t('sidebar.businesses'), desc: t('welcome.manageBusinesses'), icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { path: '/dashboard/calendar', label: t('sidebar.calendar'), desc: t('welcome.viewCalendar'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm2-7h2m4 0h2' },
    { path: '/dashboard/reportes', label: t('sidebar.reports'), desc: t('welcome.viewReports'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  return (
    <div>
      {/* Welcome card */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-500 to-teal-400 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">{t('welcome.title')}, {user?.name || user?.email}</h1>
        <p className="mt-1 text-sm text-teal-100">{t('sidebar.panel')}</p>

        <div className="mt-4 flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.businesses}</p>
            <p className="text-xs text-teal-100">{t('welcome.stats.businesses')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.appointmentsToday}</p>
            <p className="text-xs text-teal-100">{t('welcome.stats.appointments')}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-gray-900">{t('welcome.quickActions')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, i) => (
            <Link
              key={action.path}
              to={action.path}
              className={`animate-fade-in-up animate-stagger-${i + 1} group rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300/50 hover:shadow-xl`}
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
    </div>
  );
}
