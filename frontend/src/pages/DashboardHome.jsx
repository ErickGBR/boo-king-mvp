import { Link } from 'react-router-dom';

export default function DashboardHome() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Panel</h1>
      <p className="mt-2 text-gray-600">Gestiona tus citas y negocios.</p>
      <div className="mt-6 flex gap-4">
        <Link to="/dashboard/appointments" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">Citas</Link>
        <Link to="/dashboard/businesses" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">Negocios</Link>
        <Link to="/dashboard/calendar" className="rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 hover:bg-gray-50">Calendario</Link>
      </div>
    </div>
  );
}
