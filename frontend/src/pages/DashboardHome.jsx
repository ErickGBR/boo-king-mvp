import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function DashboardHome() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const roleLabel = { owner: 'Dueño', admin: 'Admin', staff: 'Staff' };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('sidebar.panel')}</h1>
        {user && (
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700">
            {roleLabel[user.role] || user.role}
          </span>
        )}
      </div>
      <p className="mt-2 text-gray-600">Bienvenido, {user?.name || user?.email}.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link to="/dashboard/appointments" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">{t('sidebar.appointments')}</Link>
        <Link to="/dashboard/businesses" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">{t('sidebar.businesses')}</Link>
        <Link to="/dashboard/calendar" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">{t('sidebar.calendar')}</Link>
        <Link to="/dashboard/reportes" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">{t('sidebar.reports')}</Link>
      </div>
    </div>
  );
}
