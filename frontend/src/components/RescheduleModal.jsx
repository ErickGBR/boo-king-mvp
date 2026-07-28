import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';

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
    days.push({ date: d, key: toDateKey(d), isCurrentMonth: d.getMonth() === month, isToday: toDateKey(d) === toDateKey(new Date()) });
  }
  return days;
}

function buildSlotsByDate(events) {
  const byDate = {};
  (events || []).forEach((e) => {
    const dateStr = e.start?.slice(0, 10);
    if (!dateStr) return;
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push({ start: e.start?.slice(11, 16), end: e.end?.slice(11, 16), start_iso: e.start, end_iso: e.end });
  });
  return byDate;
}

export default function RescheduleModal({ appointment, onClose, onRescheduled }) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsInRange, setSlotsInRange] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const start = toDateKey(new Date());
    const end = new Date();
    end.setDate(end.getDate() + 28);
    api(`/api/appointments/calendar-slots?start=${start}&end=${toDateKey(end)}`)
      .then(setSlotsInRange)
      .catch(() => setSlotsInRange([]))
      .finally(() => setLoading(false));
  }, []);

  const slotsByDate = useMemo(() => buildSlotsByDate(slotsInRange), [slotsInRange]);
  const days = useMemo(() => getDaysForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()), [calendarMonth]);
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const todayKey = toDateKey(new Date());

  const handleReschedule = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api(`/api/appointments/${appointment.id}/reschedule`, {
        method: 'PUT',
        body: JSON.stringify({ starts_at: selectedSlot.start_iso, ends_at: selectedSlot.end_iso }),
      });
      onRescheduled(updated);
      onClose();
    } catch (err) {
      setError(err?.error === 'slot_taken' ? 'Ese horario ya no está disponible.' : 'Error al reprogramar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Reprogramar cita</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">×</button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Cita actual: {new Date(appointment.startsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} a las{' '}
          {new Date(appointment.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{MONTHS[month]} {year}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setCalendarMonth(new Date(year, month - 1))} className="rounded p-1 text-gray-500 hover:bg-gray-100">‹</button>
              <button type="button" onClick={() => setCalendarMonth(new Date())} className="rounded px-2 py-1 text-xs text-[#14b8a6] hover:bg-teal-50">Hoy</button>
              <button type="button" onClick={() => setCalendarMonth(new Date(year, month + 1))} className="rounded p-1 text-gray-500 hover:bg-gray-100">›</button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs">
            {WEEKDAYS.map((w) => (<div key={w} className="py-1 font-medium text-gray-500">{w}</div>))}
            {days.map(({ date, key, isCurrentMonth, isToday }) => {
              const available = slotsByDate[key]?.length > 0;
              const isSelected = selectedDate && toDateKey(selectedDate) === key;
              const isPast = key < todayKey;
              const canSelect = isCurrentMonth && available && !isPast;
              return (
                <button key={key} type="button" disabled={!canSelect}
                  onClick={() => canSelect && (setSelectedDate(date), setSelectedSlot(null))}
                  className={`min-h-[36px] rounded-lg py-1 text-sm transition ${!isCurrentMonth ? 'text-gray-300' : isPast ? 'text-gray-400' : 'text-gray-900'} ${isToday ? 'font-bold text-[#14b8a6]' : ''} ${isSelected ? 'bg-[#14b8a6] text-white' : ''} ${canSelect ? 'hover:bg-teal-50' : ''} ${!canSelect && isCurrentMonth && !isPast ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {date.getDate()}
                  {available && isCurrentMonth && !isPast && !isSelected && <span className="block h-0.5 w-0.5 mx-auto mt-0.5 rounded-full bg-[#14b8a6]" />}
                </button>
              );
            })}
          </div>
        </div>
        {loading && <p className="mt-3 text-sm text-gray-500">Cargando...</p>}
        {selectedDate && !loading && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Horarios disponibles</p>
            <div className="flex flex-wrap gap-2">
              {(slotsByDate[toDateKey(selectedDate)] || []).length === 0 ? (
                <p className="text-sm text-gray-500">No hay horarios ese día.</p>
              ) : (
                (slotsByDate[toDateKey(selectedDate)] || []).map((slot) => (
                  <button key={slot.start} type="button" onClick={() => setSelectedSlot(slot)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${selectedSlot?.start === slot.start ? 'bg-[#14b8a6] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {slot.start}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {selectedSlot && (
          <div className="mt-4 flex gap-3 border-t pt-4">
            <button type="button" onClick={handleReschedule} disabled={submitting}
              className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-70"
            >
              {submitting ? 'Reprogramando...' : 'Confirmar reprogramación'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
