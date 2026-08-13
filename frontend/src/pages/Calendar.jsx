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
import { toast } from 'sonner';

function mapToFullCalendar(list) {
  return (list || []).map((e) => ({
    id: String(e.id),
    title: e.title,
    start: e.start,
    end: e.end,
    extendedProps: e.extendedProps || {},
  }));
}

/**
 * Google Calendar connect / sync / disconnect controls.
 * Renders nothing until the /api/google/status request resolves.
 */
function GoogleCalendarControls({ googleStatus, setGoogleStatus }) {
  if (!googleStatus) return null;

  const connect = async () => {
    try {
      const { url } = await api('/api/google/auth');
      window.location.href = url;
    } catch (err) {
      toast.error(err.error || 'No se pudo iniciar la conexión con Google');
    }
  };

  const toggleSync = async () => {
    try {
      const enabled = !googleStatus.syncEnabled;
      await api('/api/google/sync', { method: 'POST', body: JSON.stringify({ enabled }) });
      setGoogleStatus({ ...googleStatus, syncEnabled: enabled });
    } catch (err) {
      toast.error(err.error || 'No se pudo actualizar la sincronización');
    }
  };

  const disconnect = async () => {
    try {
      await api('/api/google/disconnect', { method: 'DELETE' });
      setGoogleStatus(null);
    } catch (err) {
      toast.error(err.error || 'No se pudo desconectar Google');
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {googleStatus.connected ? (
        <>
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Google Calendar {googleStatus.syncEnabled ? 'sincronizado' : 'conectado'}
          </span>
          <button
            onClick={toggleSync}
            className="text-sm font-medium text-[#14b8a6] hover:underline"
          >
            {googleStatus.syncEnabled ? 'Desactivar sync' : 'Activar sync'}
          </button>
          <button
            onClick={disconnect}
            className="text-sm font-medium text-red-500 hover:underline"
          >
            Desconectar
          </button>
        </>
      ) : (
        <button
          onClick={connect}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Conectar Google Calendar
        </button>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const isMobile = useIsMobile();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [googleStatus, setGoogleStatus] = useState(null);

  const loadGoogleStatus = () => {
    api('/api/google/status').then(setGoogleStatus).catch(() => setGoogleStatus(null));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('google');
    if (flag) {
      window.history.replaceState({}, '', window.location.pathname);
      if (flag === 'connected') toast.success('Google Calendar conectado correctamente');
      else if (flag === 'error') toast.error('Error al conectar Google Calendar');
      else if (flag === 'email_mismatch') toast.error('La cuenta de Google no coincide con el email de tu usuario');
    }
  }, []);

  useEffect(() => { loadGoogleStatus(); }, []);

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
        <GoogleCalendarControls googleStatus={googleStatus} setGoogleStatus={setGoogleStatus} />
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
      <GoogleCalendarControls googleStatus={googleStatus} setGoogleStatus={setGoogleStatus} />
      <div className="mt-6 min-h-[500px] rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-sm p-4 shadow-md sm:p-6">
        {fullCalendarEl}
      </div>
    </div>
  );
}
