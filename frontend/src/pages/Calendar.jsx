import { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { api } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import CalendarMobile from '../components/CalendarMobile';
import { Skeleton } from '../components/Skeleton';

function mapToFullCalendar(list) {
  return (list || []).map((e) => ({
    id: String(e.id),
    title: e.title,
    start: e.start,
    end: e.end,
    extendedProps: e.extendedProps || {},
  }));
}

export default function CalendarPage() {
  const isMobile = useIsMobile();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    api('/api/calendar/events')
      .then((data) => setEvents(data || []))
      .catch(() => { setEvents([]); setError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const fullCalendarEvents = useMemo(() => mapToFullCalendar(events), [events]);

  const fullCalendarEl = (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
      events={fullCalendarEvents}
      locale={esLocale}
      height="auto"
      eventBackgroundColor="#14b8a6"
      eventBorderColor="#0d9488"
      eventTextColor="#fff"
      buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' }}
    />
  );

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendario</h1>
        <p className="mt-1 text-gray-600">Tus citas como cliente y como dueño</p>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendario</h1>
        <p className="mt-1 text-gray-600">Tus citas como cliente y como dueño</p>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
          <svg className="mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500">No se pudieron cargar los eventos.</p>
          <button onClick={load} className="mt-4 rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 active:scale-[0.97] transition-all">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendario</h1>
        <p className="mt-1 text-gray-600">Tus citas como cliente y como dueño</p>
        <div className="mt-6 min-h-[500px] rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-sm p-4 sm:p-6">
          <CalendarMobile events={events} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold text-gray-900">Calendario</h1>
      <p className="mt-1 text-gray-600">Tus citas como cliente y como dueño</p>
      <div className="mt-6 min-h-[500px] rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-sm p-4 shadow-md sm:p-6">
        {fullCalendarEl}
      </div>
    </div>
  );
}
