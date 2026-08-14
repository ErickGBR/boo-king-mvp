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
import { Skeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function Reportes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const businessId = getCurrentBusinessId();

  const load = () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    api('/api/reports/summary')
      .then(setData)
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [businessId]);

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
        <p className="mt-1 text-sm text-gray-600">Análisis de citas del último mes</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
          <svg className="mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500">No se pudieron cargar los datos.</p>
          <button onClick={load} className="mt-4 rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 active:scale-[0.97] transition-all">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <EmptyState icon="📊" title="Sin datos" description="No se pudieron cargar los datos." />
      </div>
    );
  }

  const { summary, byStatus, byDay } = data;
  const pieColors = ['#14b8a6', '#6b7280', '#ef4444'];
  const pieData = [
    { name: 'Confirmadas', value: byStatus.confirmed, color: pieColors[0] },
    { name: 'Completadas', value: byStatus.completed, color: pieColors[1] },
    { name: 'Canceladas', value: byStatus.cancelled, color: pieColors[2] },
  ].filter((d) => d.value > 0);

  const formatDay = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const metrics = [
    { label: 'Citas hoy', value: summary.today, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Últimos 7 días', value: summary.last7Days, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Últimos 30 días', value: summary.last30Days, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
      <p className="mt-1 text-sm text-gray-600">Análisis de citas del último mes</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((m, i) => (
          <div key={m.label} className={`animate-fade-in-up animate-stagger-${i + 1} rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
                </svg>
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                <p className="text-sm text-gray-500">{m.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Citas por día (últimos 30 días)</h2>
          {byDay.length === 0 ? (
            <EmptyState icon="📅" title="Sin datos" description="No hay datos de citas por día." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay.map((d) => ({ ...d, label: formatDay(d.date) }))} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [value, 'Citas']} />
                  <Bar dataKey="total" name="Citas" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Citas por estado (últimos 30 días)</h2>
          {pieData.length === 0 ? (
            <EmptyState icon="📊" title="Sin datos" description="Sin datos para mostrar" />
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
