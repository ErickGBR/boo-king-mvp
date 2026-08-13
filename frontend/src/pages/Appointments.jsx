import { useState, useEffect, useMemo } from 'react';
import { api, getCurrentBusinessId } from '../api/client';
import RescheduleModal from '../components/RescheduleModal';
import EmptyState from '../components/EmptyState';
import { SkeletonRow } from '../components/Skeleton';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function getDaysForMonth(year, month) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days = [];
  const from = new Date(first);
  from.setDate(from.getDate() - startDow);
  for (let i = 0; i < 42; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    days.push({
      date: d,
      key: toDateKey(d),
      isCurrentMonth: d.getMonth() === month,
      isToday: toDateKey(d) === toDateKey(new Date()),
    });
  }
  return days;
}

function buildSlotsByDate(events) {
  const byDate = {};
  (events || []).forEach((e) => {
    const dateStr = e.extendedProps?.date || e.start?.slice(0, 10);
    if (!dateStr) return;
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push({
      start: e.extendedProps?.startTime || e.start?.slice(11, 16),
      end: e.extendedProps?.endTime || e.end?.slice(11, 16),
      start_iso: e.start,
      end_iso: e.end,
    });
  });
  return byDate;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [slotsInRange, setSlotsInRange] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ guest_name: '', guest_email: '', guest_phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [businessDetails, setBusinessDetails] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const businessId = getCurrentBusinessId();

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    const q = searchQ ? '&q=' + encodeURIComponent(searchQ) : '';
    api('/api/appointments?filter=' + filter + q)
      .then(setAppointments)
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [filter, businessId, searchQ]);

  useEffect(() => {
    if (!businessId) return;
    api('/api/businesses').then((list) => {
      const b = list.find((x) => String(x.id) === String(businessId));
      setBusinessDetails(b ? { name: b.name, durationMinutes: b.durationMinutes } : null);
    }).catch(() => setBusinessDetails(null));
  }, [businessId]);

  useEffect(() => {
    if (!modalOpen || !businessId) {
      setSlotsInRange([]);
      setSelectedDate(null);
      setSelectedSlot(null);
      return;
    }
    setLoadingSlots(true);
    const today = toDateKey(new Date());
    const end = new Date();
    end.setDate(end.getDate() + 28);
    const endStr = toDateKey(end);
    api('/api/appointments/calendar-slots?start=' + today + '&end=' + endStr)
      .then(setSlotsInRange)
      .catch(() => setSlotsInRange([]))
      .finally(() => setLoadingSlots(false));
  }, [modalOpen, businessId]);

  const slotsByDate = useMemo(() => buildSlotsByDate(slotsInRange), [slotsInRange]);

  const currentBusiness = appointments[0]?.business || (businessDetails ? { name: businessDetails.name, durationMinutes: businessDetails.durationMinutes } : null);

  if (!businessId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Citas</h1>
        <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">Selecciona un negocio en el menú superior.</p>
      </div>
    );
  }

  const handleCreate = () => {
    setError(null);
    if (!form.guest_name?.trim() || !form.guest_email?.trim() || !selectedSlot) {
      setError('Completa Cliente, Email y elige un horario disponible.');
      return;
    }
    setSubmitting(true);
    const dateStr = toDateKey(selectedDate);
    api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        date: dateStr,
        start: selectedSlot.start,
        guest_name: form.guest_name.trim(),
        guest_email: form.guest_email.trim(),
        guest_phone: form.guest_phone?.trim() || undefined,
      }),
    })
      .then(() => {
        setModalOpen(false);
        setSelectedDate(null);
        setSelectedSlot(null);
        setForm({ guest_name: '', guest_email: '', guest_phone: '' });
        return api('/api/appointments?filter=' + filter).then(setAppointments);
      })
      .catch((err) => setError(err?.error || err?.message || 'No se pudo crear la cita. Ese horario puede estar ocupado.'))
      .finally(() => setSubmitting(false));
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setSelectedDate(null);
    setSelectedSlot(null);
    setForm({ guest_name: '', guest_email: '', guest_phone: '' });
    setError(null);
  };

  const daySlots = selectedDate ? (slotsByDate[toDateKey(selectedDate)] || []) : [];
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const days = useMemo(() => getDaysForMonth(year, month), [year, month]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
          <p className="mt-1 text-sm text-gray-600">Gestiona todas las citas de tu negocio</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-600 hover:shadow-lg active:scale-95">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva Cita
        </button>
      </div>
      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        {['all', 'today', 'upcoming', 'past'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${filter === f ? 'bg-teal-500 text-white' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'}`}>
            {f === 'all' ? 'Todas' : f === 'today' ? 'Hoy' : f === 'upcoming' ? 'Próximas' : 'Pasadas'}
          </button>
        ))}
        <div className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Buscar citas..." className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-4 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 sm:w-56" />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState icon="📅" title="No hay citas" description="No hay citas con los filtros seleccionados." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {appointments.map((apt) => (
              <li key={apt.id} className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50 sm:flex-nowrap">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-sm font-semibold text-teal-700">
                  {(apt.guestName || '').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{apt.guestName}</p>
                  <p className="text-sm text-gray-500">{apt.business?.category?.name} · {apt.business?.durationMinutes} min</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {new Date(apt.startsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {new Date(apt.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${apt.status === 'confirmed' ? 'bg-teal-500/20 text-teal-700' : apt.status === 'cancelled' ? 'bg-red-100 text-red-800' : apt.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>
                  {apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'cancelled' ? 'Cancelada' : apt.status === 'completed' ? 'Completada' : apt.status}
                </span>
                {apt.status === 'confirmed' && (
                  <button type="button" onClick={() => setRescheduleTarget(apt)}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    Reprogramar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nueva Cita</h2>
              <button type="button" onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
            </div>
            <p className="mt-1 text-sm text-gray-500">Elige un día con disponibilidad y luego un horario. No se pueden elegir horarios ya ocupados.</p>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{MONTHS[month]} {year}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))} className="rounded p-1 text-gray-500 transition-all hover:bg-gray-100 active:scale-90">‹</button>
                  <button type="button" onClick={() => setCalendarMonth(new Date())} className="rounded px-2 py-1 text-xs text-teal-500 hover:bg-teal-50 transition-colors">Hoy</button>
                  <button type="button" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))} className="rounded p-1 text-gray-500 transition-all hover:bg-gray-100 active:scale-90">›</button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1 font-medium text-gray-500">{w}</div>
                ))}
                {days.map(({ date, key, isCurrentMonth, isToday }) => {
                  const available = slotsByDate[key]?.length > 0;
                  const isSelected = selectedDate && toDateKey(selectedDate) === key;
                  const isPast = key < toDateKey(new Date());
                  const canSelect = isCurrentMonth && available && !isPast;
                  const slotCount = slotsByDate[key]?.length || 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => canSelect && setSelectedDate(date)}
                      className={`relative min-h-[36px] rounded-lg py-1 text-sm transition ${
                        !isCurrentMonth ? 'text-gray-300' : isPast ? 'text-gray-400' : 'text-gray-900'
                      } ${isToday ? 'font-bold text-teal-500' : ''} ${
                        isSelected ? 'bg-teal-500 text-white' : ''
                      } ${canSelect ? 'hover:bg-teal-50' : ''} ${!canSelect && isCurrentMonth && !isPast ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {date.getDate()}
                      {available && isCurrentMonth && !isPast && !isSelected && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white">{slotCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingSlots && (
              <p className="mt-3 text-sm text-gray-500">Cargando disponibilidad…</p>
            )}

            {selectedDate && !loadingSlots && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Horarios disponibles para {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay huecos ese día.</p>
                  ) : (
                    daySlots.map((slot) => {
                      const isChosen = selectedSlot?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${isChosen ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {slot.start}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {selectedSlot && (
              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cliente</label>
                  <input type="text" value={form.guest_name} onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))} placeholder="Nombre del cliente" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Servicio</label>
                  <div className="mt-1 rounded-xl border border-teal-500/40 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                    {currentBusiness ? `${currentBusiness.name} · ${currentBusiness.durationMinutes} min` : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={form.guest_email} onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))} placeholder="email@ejemplo.com" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <input type="tel" value={form.guest_phone} onChange={(e) => setForm((f) => ({ ...f, guest_phone: e.target.value }))} placeholder="+52 555 0000" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="button" onClick={handleCreate} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-600 active:scale-[0.97] disabled:opacity-70">
                  {submitting && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {submitting ? 'Creando…' : 'Crear Cita'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {rescheduleTarget && (
        <RescheduleModal
          appointment={rescheduleTarget}
          onClose={() => { setRescheduleTarget(null); api('/api/appointments?filter=' + filter).then(setAppointments).catch(() => setAppointments([])); }}
          onRescheduled={() => { api('/api/appointments?filter=' + filter).then(setAppointments).catch(() => setAppointments([])); }}
        />
      )}
    </div>
  );
}
