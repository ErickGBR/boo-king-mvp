import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

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
            className={`min-h-[36px] rounded-lg py-1 text-sm transition ${
              !isCurrentMonth ? 'text-gray-300' : isPast ? 'text-gray-400' : 'text-gray-900'
            } ${isToday ? 'font-bold text-[#14b8a6]' : ''} ${
              isSelected ? 'bg-[#14b8a6] text-white' : ''
            } ${canSelect ? 'hover:bg-teal-50' : ''} ${
              !canSelect && isCurrentMonth && !isPast ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {date.getDate()}
            {available && isCurrentMonth && !isPast && !isSelected && (
              <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-[#14b8a6]" />
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
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API + '/api/booking/business/' + slug)
      .then((r) => r.json())
      .then((data) => {
        setBusiness(data.business);
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
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) setDone(true);
        else setError(data?.error === 'slot_taken' ? 'Ese horario ya no está disponible.' : 'No se pudo completar la reserva.');
      })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">Cargando...</div>;
  if (!business) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">Negocio no encontrado.</div>;

  const durationHour = business.durationMinutes >= 60 ? (business.durationMinutes / 60) + ' hora' + (business.durationMinutes > 60 ? 's' : '') : business.durationMinutes + ' min';

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#14b8a6] text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </span>
          <span className="ml-2 font-semibold text-gray-900">Boo-king</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date())}
                  className="rounded px-2 py-1 text-xs text-[#14b8a6] hover:bg-teal-50"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
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
                          isChosen ? 'bg-[#14b8a6] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

        {selectedSlot && !done && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-medium text-gray-700">Tus datos</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600">Nombre</label>
                <input type="text" value={form.guest_name} onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))} placeholder="Nombre completo" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Email</label>
                <input type="email" value={form.guest_email} onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))} placeholder="email@ejemplo.com" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Teléfono</label>
                <input type="tel" value={form.guest_phone} onChange={(e) => setForm((f) => ({ ...f, guest_phone: e.target.value }))} placeholder="+52 555 0000" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <button type="button" onClick={handleReserve} disabled={submitting} className="mt-4 w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d9488] disabled:opacity-70">
              {submitting ? 'Reservando…' : 'Confirmar reserva'}
            </button>
          </div>
        )}

        {done && (
          <div className="mt-6 rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/10 p-6">
            <div className="text-center">
              <p className="font-semibold text-[#0d9488]">Reserva confirmada</p>
              <p className="mt-1 text-sm text-gray-600">Te hemos enviado un correo con los detalles.</p>
            </div>
            {business.locationType === 'online' && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-medium text-purple-800">🔗 Reunión en línea</p>
                <p className="mt-1 text-sm text-purple-600">Recibirás el enlace de la reunión en tu correo.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
