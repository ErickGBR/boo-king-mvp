import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

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
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard/businesses" className="text-gray-600 hover:text-gray-900">
          ← Negocios
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">{isNew ? 'Nuevo negocio' : 'Editar negocio'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            placeholder="Ej. Peluquería Centro"
          />
        </div>

        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
          <select
            id="categoryId"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="durationMinutes" className="mb-1 block text-sm font-medium text-gray-700">Duración de cita (min)</label>
          <select
            id="durationMinutes"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} minutos</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-gray-700">Zona horaria</label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de ubicación</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="locationType"
                value="presencial"
                checked={locationType === 'presencial'}
                onChange={() => setLocationType('presencial')}
                className="text-teal-600 focus:ring-teal-500"
              />
              <span>Presencial</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="locationType"
                value="online"
                checked={locationType === 'online'}
                onChange={() => setLocationType('online')}
                className="text-teal-600 focus:ring-teal-500"
              />
              <span>En línea</span>
            </label>
          </div>
        </div>

        {locationType === 'presencial' && (
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              placeholder="Calle, número, ciudad"
            />
          </div>
        )}

        {locationType === 'online' && (
          <div>
            <label htmlFor="meetingUrl" className="mb-1 block text-sm font-medium text-gray-700">URL de reunión</label>
            <input
              id="meetingUrl"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              placeholder="https://meet.example.com/..."
            />
          </div>
        )}

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">Descripción (opcional)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            placeholder="Breve descripción del negocio"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Horario</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Rellenar rápido:</span>
            {SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.days, preset.start, preset.end)}
                className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {DAYS.map(({ value: day, label }) => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-10 text-sm text-gray-600">{label}</span>
                <input
                  type="time"
                  value={schedule[day]?.start ?? ''}
                  onChange={(e) => updateSchedule(day, 'start', e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  value={schedule[day]?.end ?? ''}
                  onChange={(e) => updateSchedule(day, 'end', e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isNew ? 'Crear negocio' : 'Guardar cambios'}
          </button>
          <Link
            to="/dashboard/businesses"
            className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
