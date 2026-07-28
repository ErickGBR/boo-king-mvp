import { useState, useEffect } from 'react';
import { api, getCurrentBusinessId } from '../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';

const TEAL = '#14b8a6';

export default function Reportes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const businessId = getCurrentBusinessId();

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    api('/api/reports/summary')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (!businessId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">Selecciona un negocio en el menú superior.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="mt-4 text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="mt-4 text-gray-500">No se pudieron cargar los datos.</p>
      </div>
    );
  }

  const { summary, byStatus, byDay } = data;
  const pieData = [
    { name: 'Confirmadas', value: byStatus.confirmed, color: TEAL },
    { name: 'Completadas', value: byStatus.completed, color: '#6b7280' },
    { name: 'Canceladas', value: byStatus.cancelled, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const formatDay = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
      <p className="mt-1 text-sm text-gray-600">Análisis de citas del último mes</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: TEAL }}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.today}</p>
              <p className="text-sm text-gray-500">Citas hoy</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: TEAL }}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.last7Days}</p>
              <p className="text-sm text-gray-500">Últimos 7 días</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: TEAL }}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.last30Days}</p>
              <p className="text-sm text-gray-500">Últimos 30 días</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Citas por día (últimos 30 días)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay.map((d) => ({ ...d, label: formatDay(d.date) }))} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, 'Citas']} />
                <Bar dataKey="total" name="Citas" fill={TEAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Citas por estado (últimos 30 días)</h2>
          {pieData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-gray-500">Sin datos para mostrar</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Citas']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
