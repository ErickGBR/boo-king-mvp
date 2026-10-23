import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function Reportes() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const businessId = getCurrentBusinessId();

  // Refs to persist custom range across re-renders
  const customStartRef = useRef('');
  const customEndRef = useRef('');
  // Flag to prevent useEffect from firing a second load for 'custom'
  const skipCustomEffect = useRef(false);

  const getDateRange = (p) => {
    const now = new Date();
    const end = toDateKey(now);
    let start;
    switch (p) {
      case 'today':
        start = end;
        break;
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = toDateKey(d);
        break;
      }
      case 'month': {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        start = toDateKey(d);
        break;
      }
      case 'year': {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        start = toDateKey(d);
        break;
      }
      default:
        start = end;
    }
    return { start, end };
  };

  const load = (p, customStart, customEnd) => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    const range = customStart && customEnd
      ? { start: customStart, end: customEnd }
      : getDateRange(p || period);
    const url = `/api/reports/summary?start=${range.start}&end=${range.end}`;
    api(url)
      .then(setData)
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (period === 'custom' && skipCustomEffect.current) {
      skipCustomEffect.current = false;
      return;
    }
    if (period === 'custom' && customStartRef.current && customEndRef.current) {
      load('custom', customStartRef.current, customEndRef.current);
    } else {
      load(period);
    }
  }, [businessId, period]);

  const handleApplyRange = () => {
    if (!startDate || !endDate) return;
    customStartRef.current = startDate;
    customEndRef.current = endDate;
    skipCustomEffect.current = true;
    setPeriod('custom');
    load('custom', startDate, endDate);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const range = data.range || {};
    const wb = XLSX.utils.book_new();

    // Hoja Resumen
    const resumenRows = [
      ['Reporte Boo-king'],
      ['Período', `${range.start || '—'} al ${range.end || '—'}`],
      [''],
      ['Métrica', 'Valor'],
      ['Total de citas', range.total || 0],
      ['Completadas', range.completed || 0],
      ['Canceladas', range.cancelled || 0],
      ['Presentes', range.present || 0],
      ['No llegó', range.noShow || 0],
      ['Ingresos totales', `$${(range.totalIncome || 0).toFixed(2)}`],
      ['Promedio por cita', `$${(range.avgIncome || 0).toFixed(2)}`],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
    wsResumen['!cols'] = [{ wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Hoja Por servicio
    const svcHeaders = ['Servicio', 'Citas', 'Ingresos'];
    const svcRows = (range.byService || []).map((s) => [s.name, s.count, `$${(s.income || 0).toFixed(2)}`]);
    const wsSvc = XLSX.utils.aoa_to_sheet([svcHeaders, ...svcRows]);
    wsSvc['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSvc, 'Por servicio');

    const fileName = `reporte-${range.start || 'inicio'}_${range.end || 'fin'}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(t('reportes.exportExcel') + ' ✓');
  };

  if (!businessId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('reports.selectBusiness')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('reports.subtitle')}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
          <svg className="mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500">{t('reports.loadError')}</p>
          <button onClick={() => load()} className="mt-4 rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 active:scale-[0.97] transition-all">
            {t('reports.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <EmptyState icon="📊" title={t('reports.noData')} description={t('reports.loadError')} />
      </div>
    );
  }

  const range = data.range || {};
  const { summary, byStatus, byDay } = data;

  // Use ONLY range data when a range is active, ONLY byStatus when no range — never mix
  const isRange = range?.total != null;
  const pieCompleted = isRange ? (range.completed || 0) : (byStatus?.completed || 0);
  const pieCancelled = isRange ? (range.cancelled || 0) : (byStatus?.cancelled || 0);
  const piePresent = isRange ? (range.present || 0) : (byStatus?.present || 0);
  const pieNoShow = isRange ? (range.noShow || 0) : (byStatus?.noShow || 0);
  const pieConfirmed = isRange
    ? Math.max(0, (range.total || 0) - (range.completed || 0) - (range.cancelled || 0) - (range.present || 0) - (range.noShow || 0))
    : (byStatus?.confirmed || 0);

  const pieData = [
    { name: t('reportes.completed'), value: pieCompleted, color: '#6b7280' },
    { name: t('reportes.cancelled'), value: pieCancelled, color: '#ef4444' },
    { name: t('reportes.present'), value: piePresent, color: '#14b8a6' },
    { name: t('reportes.noShow'), value: pieNoShow, color: '#f59e0b' },
    { name: t('reports.confirmed'), value: pieConfirmed, color: '#3b82f6' },
  ].filter((d) => d.value > 0);

  const formatDay = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  const metrics = range.total != null ? [
    { label: t('reportes.totalCitas'), value: range.total || 0, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: t('reportes.avgIncome'), value: formatCurrency(range.avgIncome), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: t('reportes.totalIncome'), value: formatCurrency(range.totalIncome), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: t('reportes.present'), value: range.present || 0, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ] : [
    { label: t('reports.today'), value: summary?.today || 0, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: t('reports.last7'), value: summary?.last7Days || 0, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: t('reports.last30'), value: summary?.last30Days || 0, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  const periodButtons = [
    { id: 'today', label: t('reportes.periodToday') },
    { id: 'week', label: t('reportes.periodWeek') },
    { id: 'month', label: t('reportes.periodMonth') },
    { id: 'year', label: t('reportes.periodYear') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('reports.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleExportExcel}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-green-600 hover:shadow-lg active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t('reportes.exportExcel')}
        </button>
      </div>

      {/* Period selector */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {periodButtons.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setPeriod(p.id); setStartDate(''); setEndDate(''); load(p.id); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${period === p.id && !startDate ? 'bg-teal-500 text-white' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50 border border-gray-200'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
<input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 min-w-0 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
            <span className="text-gray-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 min-w-0 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          <button
            type="button"
            onClick={handleApplyRange}
            disabled={!startDate || !endDate}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {t('reportes.range')}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <div key={m.label} className={`animate-fade-in-up animate-stagger-${i + 1} rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 truncate">{m.value}</p>
                <p className="text-sm text-gray-500 truncate">{m.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status breakdown row */}
      {range.total != null && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: t('reportes.completed'), value: range.completed || 0, color: 'bg-gray-100 text-gray-700' },
            { label: t('reportes.cancelled'), value: range.cancelled || 0, color: 'bg-red-50 text-red-700' },
            { label: t('reportes.noShow'), value: range.noShow || 0, color: 'bg-amber-50 text-amber-700' },
            { label: t('reportes.present'), value: range.present || 0, color: 'bg-green-50 text-green-700' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t('reports.byDay')}</h2>
          {(!byDay || byDay.length === 0) ? (
            <EmptyState icon="📅" title={t('reports.noData')} description={t('reports.noDataDesc')} />
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
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t('reports.byStatus')}</h2>
          {pieData.length === 0 ? (
            <EmptyState icon="📊" title={t('reports.noData')} description={t('reports.noStatusData')} />
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
                    {pieData.map((entry) => (
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

      {/* By-service table */}
      {range.byService && range.byService.length > 0 && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t('reportes.byService')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-600">{t('services.name')}</th>
                  <th className="pb-3 text-right font-medium text-gray-600">{t('reportes.totalCitas')}</th>
                  <th className="pb-3 text-right font-medium text-gray-600">{t('reportes.totalIncome')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {range.byService.map((svc) => (
                  <tr key={svc.name}>
                    <td className="py-3 font-medium text-gray-900">{svc.name}</td>
                    <td className="py-3 text-right text-gray-700">{svc.count}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(svc.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {range.byService && range.byService.length === 0 && (
        <div className="mt-8">
          <EmptyState icon="📋" title={t('reportes.empty')} description={t('reportes.empty')} />
        </div>
      )}
    </div>
  );
}
