import { useState, useMemo } from 'react';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseEventDate(iso) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function eventOverlapsDay(eventStart, eventEnd, dayStart) {
  const start = new Date(eventStart);
  const end = new Date(eventEnd);
  const day = new Date(dayStart);
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return start < dayEnd && end > day;
}

function getDaysForMonthView(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
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

function getEventsForDay(events, dayKey) {
  const dayStart = new Date(dayKey + 'T00:00:00');
  return (events || []).filter((e) => eventOverlapsDay(e.start, e.end, dayStart));
}

function getEventsInRange(events, start, end) {
  if (!start || !end) return [];
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  const rangeEndExcl = new Date(rangeEnd);
  rangeEndExcl.setDate(rangeEndExcl.getDate() + 1);
  return (events || [])
    .filter((e) => {
      const evStart = new Date(e.start);
      const evEnd = new Date(e.end);
      return evStart < rangeEndExcl && evEnd >= rangeStart;
    })
    .sort((x, y) => new Date(x.start) - new Date(y.start));
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarMobile({ events = [] }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = useMemo(() => getDaysForMonthView(year, month), [year, month]);

  const eventsByDay = useMemo(() => {
    const map = {};
    days.forEach(({ key }) => {
      map[key] = getEventsForDay(events, key);
    });
    return map;
  }, [events, days]);

  const rangeEvents = useMemo(() => {
    const start = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : rangeStart;
    const end = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : rangeStart;
    return getEventsInRange(events, start, end);
  }, [events, rangeStart, rangeEnd]);

  const selectedSingleDayEvents = rangeStart && !rangeEnd ? getEventsForDay(events, toDateKey(rangeStart)) : [];

  const goPrev = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const goNext = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));
  const goToday = () => {
    const t = new Date();
    setViewDate(t);
    setRangeStart(null);
    setRangeEnd(null);
  };

  const handleDayTap = (dayDate) => {
    const key = toDateKey(dayDate);
    if (!rangeStart) {
      setRangeStart(dayDate);
      setRangeEnd(null);
      return;
    }
    if (rangeStart && !rangeEnd) {
      if (toDateKey(rangeStart) === key) {
        setRangeStart(null);
        return;
      }
      setRangeEnd(dayDate);
      return;
    }
    setRangeStart(dayDate);
    setRangeEnd(null);
  };

  const clearRange = () => {
    setRangeStart(null);
    setRangeEnd(null);
  };

  const isInRange = (dayKey) => {
    if (!rangeStart) return false;
    if (!rangeEnd) return toDateKey(rangeStart) === dayKey;
    const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    const d = new Date(dayKey + 'T12:00:00');
    return d >= start && d <= end;
  };

  const isRangeStart = (dayKey) => rangeStart && toDateKey(rangeStart) === dayKey;
  const isRangeEnd = (dayKey) => rangeEnd && toDateKey(rangeEnd) === dayKey;

  const listToShow = rangeStart && rangeEnd ? rangeEvents : selectedSingleDayEvents;

  return (
    <div className="calendar-mobile select-none">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <button type="button" onClick={goPrev} className="rounded-lg p-2 text-gray-600 transition-all hover:bg-gray-200 active:scale-90" aria-label="Mes anterior">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTHS[month]} {year}
        </span>
        <button type="button" onClick={goNext} className="rounded-lg p-2 text-gray-600 transition-all hover:bg-gray-200 active:scale-90" aria-label="Mes siguiente">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <button type="button" onClick={goToday} className="mt-2 w-full rounded-lg bg-gray-100 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200">
        Hoy
      </button>

      <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-xs transition-opacity duration-200">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 font-medium text-gray-500">
            {w}
          </div>
        ))}
        {days.map(({ date, key, isCurrentMonth, isToday }) => {
          const dayEvents = eventsByDay[key] || [];
          const inRange = isInRange(key);
          const startOfRange = isRangeStart(key);
          const endOfRange = isRangeEnd(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleDayTap(date)}
              className={`relative flex min-h-[44px] flex-col items-center justify-center rounded-lg py-1 transition-all active:scale-95 ${
                !isCurrentMonth ? 'text-gray-300' : 'text-gray-900'
              } ${isToday ? 'font-bold text-teal-500' : ''} ${
                inRange ? 'bg-teal-100' : ''
              } ${startOfRange || endOfRange ? 'ring-2 ring-teal-500 ring-offset-1' : ''} ${
                isCurrentMonth && !inRange ? 'hover:bg-gray-100' : ''
              }`}
            >
              <span>{date.getDate()}</span>
              {dayEvents.length > 0 && (
                <span className="mt-0.5 flex gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.extendedProps?.type === 'cancelled' ? 'bg-red-400' : 'bg-teal-500'}`} />
                  ))}
                  {dayEvents.length > 3 && <span className="text-[10px] text-gray-500">+{dayEvents.length - 3}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-gray-200 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {rangeStart && rangeEnd ? 'Eventos en el rango' : rangeStart ? 'Eventos del día' : 'Toca un día o elige un rango'}
          </span>
          {(rangeStart || rangeEnd) && (
            <button type="button" onClick={clearRange} className="text-xs text-teal-500 hover:underline">
              Limpiar
            </button>
          )}
        </div>
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {listToShow.length === 0 && (rangeStart || rangeEnd) && (
            <li className="text-sm text-gray-500">Sin eventos en este periodo.</li>
          )}
          {listToShow.map((e) => (
            <li key={e.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium text-gray-900">{e.title}</span>
              <span className="ml-2 text-gray-500">
                {formatTime(e.start)}
                {e.end && ` – ${formatTime(e.end)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
