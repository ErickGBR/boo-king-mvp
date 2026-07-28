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
  const [googleStatus, setGoogleStatus] = useState(null);

  useEffect(() => {
    api('/api/calendar/events')
      .then((data) => setEvents(data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api('/api/google/status').then(setGoogleStatus).catch(() => setGoogleStatus(null));
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
        {googleStatus && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {googleStatus.connected ? (
              <>
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Google Calendar {googleStatus.syncEnabled ? 'sincronizado' : 'conectado'}
                </span>
                <button onClick={async () => {
                  const enabled = !googleStatus.syncEnabled;
                  await api('/api/google/sync', { method: 'POST', body: JSON.stringify({ enabled }) });
                  setGoogleStatus({ ...googleStatus, syncEnabled: enabled });
                }} className="text-sm text-[#14b8a6] hover:underline">
                  {googleStatus.syncEnabled ? 'Desactivar sync' : 'Activar sync'}
                </button>
              </>
            ) : (
              <button onClick={async () => {
                const { url } = await api('/api/google/auth');
                window.location.href = url;
              }} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Conectar Google Calendar
              </button>
            )}
          </div>
        )}
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
      {googleStatus && (
        <div className="mt-3 flex items-center gap-3">
          {googleStatus.connected ? (
            <>
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Google Calendar {googleStatus.syncEnabled ? 'sincronizado' : 'conectado'}
              </span>
              <button onClick={async () => {
                const enabled = !googleStatus.syncEnabled;
                await api('/api/google/sync', { method: 'POST', body: JSON.stringify({ enabled }) });
                setGoogleStatus({ ...googleStatus, syncEnabled: enabled });
              }} className="text-sm text-[#14b8a6] hover:underline">
                {googleStatus.syncEnabled ? 'Desactivar sync' : 'Activar sync'}
              </button>
              <button onClick={async () => {
                await api('/api/google/disconnect', { method: 'DELETE' });
                setGoogleStatus(null);
              }} className="text-sm text-red-500 hover:underline">Desconectar</button>
            </>
          ) : (
            <button onClick={async () => {
              const { url } = await api('/api/google/auth');
              window.location.href = url;
            }} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Conectar Google Calendar
            </button>
          )}
        </div>
      )}
      <div className="mt-6 min-h-[500px] rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        {fullCalendarEl}
      </div>
    </div>
  );
}
