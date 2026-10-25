import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SkeletonCard } from '../components/Skeleton';
import { Skeleton } from '../components/Skeleton';
import GoogleMapsLink from '../components/GoogleMapsLink';
import { generateTicketPdf } from '../utils/ticketPdf';

const API = import.meta.env.VITE_API_URL || '';

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
  for (let i = 0; i < 42; i += 1) {
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

function MiniBookingCalendar({ days, slotsByDate, selectedDate, onSelectDay }) {
  const todayKey = toDateKey(new Date());
  return (
    <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs">
      {WEEKDAYS.map((w) => (
        <div key={w} className="py-1 font-medium text-gray-500">
          {w}
        </div>
      ))}
      {days.map(({ date, key, isCurrentMonth, isToday }) => {
        const available = slotsByDate[key]?.length > 0;
        const isSelected = selectedDate && toDateKey(selectedDate) === key;
        const isPast = key < todayKey;
        const canSelect = isCurrentMonth && available && !isPast;
        return (
          <button
            key={key}
            type="button"
            disabled={!canSelect}
            onClick={() => canSelect && onSelectDay(date)}
            className={`min-h-[36px] rounded-lg py-1 text-sm transition-all ${
              !isCurrentMonth ? 'text-gray-300' : isPast ? 'text-gray-400' : 'text-gray-900'
            } ${isToday ? 'font-bold text-teal-500' : ''} ${
              isSelected ? 'bg-teal-500 text-white' : ''
            } ${canSelect ? 'hover:bg-teal-50 hover:scale-105' : ''} ${
              !canSelect && isCurrentMonth && !isPast ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {date.getDate()}
            {available && isCurrentMonth && !isPast && !isSelected && (
              <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-teal-500" />
            )}
          </button>
        );
      })}
    </div>
  );
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

export default function Booking() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slotsInRange, setSlotsInRange] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ guest_name: '', guest_email: '', guest_phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneAppointment, setDoneAppointment] = useState(null);
  const [error, setError] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  useEffect(() => {
    fetch(API + '/api/booking/business/' + slug)
      .then((r) => r.json())
      .then((data) => {
        setBusiness(data.business);
        setServices(data.services || []);
      })
      .catch(() => setBusiness(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!business) {
      setSlotsInRange([]);
      return;
    }
    setLoadingSlots(true);
    const start = toDateKey(new Date());
    const end = new Date();
    end.setDate(end.getDate() + 28);
    const endStr = toDateKey(end);
    fetch(API + '/api/booking/business/' + slug + '/calendar-slots?start=' + start + '&end=' + endStr)
      .then((r) => r.json())
      .then((events) => setSlotsInRange(events || []))
      .catch(() => setSlotsInRange([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, business]);

  const slotsByDate = useMemo(() => buildSlotsByDate(slotsInRange), [slotsInRange]);

  const days = useMemo(
    () => getDaysForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [calendarMonth],
  );

  const handleSelectDay = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleReserve = () => {
    setError(null);
    if (!selectedSlot || !form.guest_name?.trim() || !form.guest_email?.trim()) {
      setError('Completa nombre y email.');
      return;
    }
    setSubmitting(true);
    fetch(API + '/api/booking/business/' + slug + '/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        starts_at: selectedSlot.start_iso,
        ends_at: selectedSlot.end_iso,
        guest_name: form.guest_name.trim(),
        guest_email: form.guest_email.trim(),
        guest_phone: form.guest_phone?.trim() || undefined,
        service_ids: selectedServiceIds,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) {
          setDoneAppointment(data.appointment || null);
          setDone(true);
        } else setError(data?.error === 'slot_taken' ? 'Ese horario ya no está disponible.' : 'No se pudo completar la reserva.');
      })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <span className="font-semibold text-gray-900">Boo-king</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">
          <SkeletonCard />
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-6">
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900">Negocio no encontrado</h1>
        <p className="mt-2 text-gray-600">El negocio que buscas no existe o ha sido desactivado.</p>
        <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-600 hover:shadow-xl active:scale-[0.97]">
          ← Volver
        </Link>
      </div>
    );
  }

  const durationHour = business.durationMinutes >= 60
    ? (business.durationMinutes / 60) + ' hora' + (business.durationMinutes > 60 ? 's' : '')
    : business.durationMinutes + ' min';

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            <span className="font-semibold text-gray-900">Boo-king</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">{business.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{business.category?.name} · {durationHour}</p>
          <p className="mt-3 text-sm text-gray-600">
            Elige un horario disponible en el calendario y completa tus datos.
          </p>
          {business.locationType === 'presencial' && business.address && (
            <p className="mt-2 text-sm text-gray-500">📍 {business.address}</p>
          )}
          {business.locationType === 'online' && (
            <p className="mt-2 text-sm text-gray-500">💻 Reunión en línea</p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
          <p className="mb-2 text-sm font-medium text-gray-700">Elige el día y horario disponible</p>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">
                {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                  className="rounded p-1 text-gray-500 transition-all hover:bg-gray-100 active:scale-90"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date())}
                  className="rounded px-2 py-1 text-xs text-teal-500 hover:bg-teal-50"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                  className="rounded p-1 text-gray-500 transition-all hover:bg-gray-100 active:scale-90"
                >
                  ›
                </button>
              </div>
            </div>
            <MiniBookingCalendar
              days={days}
              slotsByDate={slotsByDate}
              selectedDate={selectedDate}
              onSelectDay={handleSelectDay}
            />
          </div>

          {loadingSlots && (
            <p className="mt-3 text-sm text-gray-500">Cargando disponibilidad…</p>
          )}

          {selectedDate && !loadingSlots && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                Horarios disponibles para{' '}
                {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <div className="flex flex-wrap gap-2">
                {(slotsByDate[toDateKey(selectedDate)] || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No hay horarios disponibles ese día.</p>
                ) : (
                  (slotsByDate[toDateKey(selectedDate)] || []).map((slot) => {
                    const isChosen = selectedSlot?.start === slot.start;
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                          isChosen ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {slot.start}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {selectedSlot && !done && services.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <p className="mb-1 text-sm font-medium text-gray-700">{t('booking.servicesOptional')}</p>
            <p className="mb-3 text-xs text-gray-500">{t('booking.selectServices')}</p>
            <div className="space-y-2">
              {services.map((svc) => {
                const isSelected = selectedServiceIds.includes(svc.id);
                return (
                  <label
                    key={svc.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                      isSelected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedServiceIds((prev) =>
                          isSelected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                        );
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-900">{svc.name}</span>
                    <span className="text-sm text-gray-500">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(svc.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {selectedSlot && !done && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <p className="mb-4 text-sm font-medium text-gray-700">Tus datos</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600">Nombre</label>
                <div className="relative mt-1">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input type="text" value={form.guest_name} onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))} placeholder="Nombre completo" className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Email</label>
                <div className="relative mt-1">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input type="email" value={form.guest_email} onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))} placeholder="email@ejemplo.com" className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Teléfono</label>
                <div className="relative mt-1">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <input type="tel" value={form.guest_phone} onChange={(e) => setForm((f) => ({ ...f, guest_phone: e.target.value }))} placeholder="+52 555 0000" className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <button type="button" onClick={handleReserve} disabled={submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.98] disabled:opacity-70">
              {submitting && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {submitting ? 'Reservando…' : 'Confirmar reserva'}
            </button>
          </div>
        )}

        {done && (
          <div className="animate-scale-in mt-6 rounded-2xl border border-teal-500/30 bg-teal-500/10 p-8 shadow-sm">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-white">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-teal-700">Reserva confirmada</p>
              <p className="mt-1 text-sm text-gray-600">Te hemos enviado un correo con los detalles.</p>
            </div>
            {business.locationType === 'presencial' && business.address && (
              <GoogleMapsLink address={business.address} />
            )}
            {business.locationType === 'online' && (
              <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-medium text-purple-800">🔗 Reunión en línea</p>
                <p className="mt-1 text-sm text-purple-600">Recibirás el enlace de la reunión en tu correo.</p>
              </div>
            )}
            {doneAppointment && (
              <button
                type="button"
                onClick={() => generateTicketPdf(doneAppointment)}
                className="mt-6 w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.98]"
              >
                🎫 {t('ticket.download')}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
