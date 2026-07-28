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

  useEffect(() => {
    api('/api/calendar/events')
      .then((data) => setEvents(data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const fullCalendarEvents = useMemo(() => mapToFullCalendar(events), [events]);

  const fullCalendarEl = (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
      events={fullCalendarEvents}
      locale={esLocale}
      height="auto"
      buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' }}
    />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando calendario...</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendario</h1>
        <p className="mt-1 text-gray-600">Tus citas como cliente y como dueño</p>
        <div className="mt-6 min-h-[500px] rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <CalendarMobile events={events} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Calendario</h1>
      <p className="mt-1 text-gray-600">Tus citas como cliente y como dueño</p>
      <div className="mt-6 min-h-[500px] rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        {fullCalendarEl}
      </div>
    </div>
  );
}
