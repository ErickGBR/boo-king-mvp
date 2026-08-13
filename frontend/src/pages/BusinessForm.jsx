import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];
const TIMEZONES = ['America/Mexico_City', 'America/New_York', 'America/Lima', 'Europe/Madrid', 'UTC'];

function emptySchedule() {
  return Object.fromEntries(DAYS.map((d) => [d.value, { start: '09:00', end: '18:00' }]));
}

function scheduleFromApi(schedules) {
  const out = emptySchedule();
  (schedules || []).forEach((s) => {
    out[s.dayOfWeek] = { start: s.startTime?.slice(0, 5) || '09:00', end: s.endTime?.slice(0, 5) || '18:00' };
  });
  return out;
}

export default function BusinessForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [locationType, setLocationType] = useState('presencial');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [schedule, setSchedule] = useState(emptySchedule);

  useEffect(() => {
    api('/api/categories')
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => { if (isNew) setLoading(false); });
  }, [isNew]);

  useEffect(() => {
    if (!isNew) {
      api(`/api/businesses/${id}`)
        .then((b) => {
          setName(b.name || '');
          setCategoryId(String(b.categoryId ?? ''));
          setDurationMinutes(b.durationMinutes ?? 30);
          setTimezone(b.timezone || 'America/Mexico_City');
          setLocationType(b.locationType || 'presencial');
          setDescription(b.description || '');
          setAddress(b.address || '');
          setMeetingUrl(b.meetingUrl || '');
          setSchedule(scheduleFromApi(b.schedules));
        })
        .catch(() => setError('No se pudo cargar el negocio'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const updateSchedule = (day, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const applyPreset = (dayIndexes, start, end) => {
    setSchedule((prev) => {
      const next = { ...prev };
      dayIndexes.forEach((day) => {
        next[day] = { start, end };
      });
      return next;
    });
  };

  const SCHEDULE_PRESETS = [
    { label: 'Lun–Vie 8:00–21:00', days: [1, 2, 3, 4, 5], start: '08:00', end: '21:00' },
    { label: 'Lun–Sáb 9:00–18:00', days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' },
    { label: 'Todos 9:00–18:00', days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: name.trim(),
      categoryId: Number(categoryId),
      durationMinutes,
      timezone,
      locationType,
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      meetingUrl: meetingUrl.trim() || undefined,
      schedule,
    };
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/businesses' : `/api/businesses/${id}`;
    api(url, { method, body: JSON.stringify(payload) })
      .then(() => navigate('/dashboard/businesses'))
      .catch((err) => setError(err.errors ? err.errors.map((e) => e.msg).join(', ') : err.message || 'Error al guardar'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-4">
          <Link to="/dashboard/businesses" className="text-gray-600 hover:text-gray-900">← Negocios</Link>
          <h1 className="text-2xl font-semibold text-gray-900">{isNew ? 'Nuevo negocio' : 'Editar negocio'}</h1>
        </div>
        <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard/businesses" className="text-gray-600 hover:text-gray-900">← Negocios</Link>
        <h1 className="text-2xl font-semibold text-gray-900">{isNew ? 'Nuevo negocio' : 'Editar negocio'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-sm p-6 shadow-sm">
        {error && (
          <div className="animate-shake flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Información básica</h2>
          <p className="mt-1 text-sm text-gray-500">Los datos principales de tu negocio</p>
        </div>
        <hr className="border-gray-200" />

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="Ej. Peluquería Centro"
            />
          </div>
        </div>

        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <select
              id="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 appearance-none bg-white"
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="durationMinutes" className="mb-1 block text-sm font-medium text-gray-700">Duración de cita (min)</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <select
              id="durationMinutes"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 appearance-none bg-white"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} minutos</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-gray-700">Zona horaria</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 appearance-none bg-white"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ubicación</h2>
          <p className="mt-1 text-sm text-gray-500">Dónde se realizarán las citas</p>
        </div>
        <hr className="border-gray-200" />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de ubicación</label>
          <div className="flex gap-4">
            <label className="relative flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm has-[input:checked]:ring-2 has-[input:checked]:ring-teal-500 has-[input:checked]:border-teal-500 transition-all">
              <input
                type="radio"
                name="locationType"
                value="presencial"
                checked={locationType === 'presencial'}
                onChange={() => setLocationType('presencial')}
                className="peer sr-only"
              />
              <svg className="h-4 w-4 text-gray-400 peer-checked:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Presencial</span>
            </label>
            <label className="relative flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm has-[input:checked]:ring-2 has-[input:checked]:ring-teal-500 has-[input:checked]:border-teal-500 transition-all">
              <input
                type="radio"
                name="locationType"
                value="online"
                checked={locationType === 'online'}
                onChange={() => setLocationType('online')}
                className="peer sr-only"
              />
              <svg className="h-4 w-4 text-gray-400 peer-checked:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>En línea</span>
            </label>
          </div>
        </div>

        {locationType === 'presencial' && (
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="Calle, número, ciudad"
              />
            </div>
          </div>
        )}

        {locationType === 'online' && (
          <div>
            <label htmlFor="meetingUrl" className="mb-1 block text-sm font-medium text-gray-700">URL de reunión</label>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                id="meetingUrl"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="https://meet.example.com/..."
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">Descripción (opcional)</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="Breve descripción del negocio"
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Horario</h2>
          <p className="mt-1 text-sm text-gray-500">Define los días y horas de atención</p>
        </div>
        <hr className="border-gray-200" />

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Rellenar rápido:</span>
            {SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.days, preset.start, preset.end)}
                className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-all hover:bg-teal-100 active:bg-teal-200"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {DAYS.map(({ value: day, label }) => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-10 text-sm font-medium text-gray-600">{label}</span>
                <input
                  type="time"
                  value={schedule[day]?.start ?? ''}
                  onChange={(e) => updateSchedule(day, 'start', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  value={schedule[day]?.end ?? ''}
                  onChange={(e) => updateSchedule(day, 'end', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
          >
            {saving && <LoadingSpinner size="sm" />}
            {saving ? 'Guardando...' : isNew ? 'Crear negocio' : 'Guardar cambios'}
          </button>
          <Link
            to="/dashboard/businesses"
            className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
