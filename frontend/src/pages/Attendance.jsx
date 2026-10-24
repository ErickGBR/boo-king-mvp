import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getCurrentBusinessId } from '../api/client';
import EmptyState from '../components/EmptyState';
import { toast } from 'sonner';
import jsQR from 'jsqr';

const API = import.meta.env.VITE_API_URL || '';

function parseTicketId(text) {
  if (!text) return null;
  const match = text.match(/\/t\/(\d+)/);
  if (match) return match[1];
  const numMatch = text.match(/BK-(\d+)/i);
  if (numMatch) return numMatch[1];
  if (/^\d+$/.test(text.trim())) return text.trim();
  return null;
}

function StatusBadge({ status, t }) {
  const styles = {
    confirmed: 'bg-teal-500/20 text-teal-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-800',
    present: 'bg-green-100 text-green-800',
    no_show: 'bg-red-100 text-red-700',
  };
  const labels = {
    confirmed: t('status.confirmed'),
    completed: t('status.completed'),
    cancelled: t('status.cancelled'),
    present: t('attendance.present'),
    no_show: t('attendance.noShow'),
  };
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function Attendance() {
  const { t } = useTranslation();
  const businessId = getCurrentBusinessId();
  const [activeTab, setActiveTab] = useState('scan');

  // QR Scanner state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const startingRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualUrl, setManualUrl] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Selected appointment
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [clientHistory, setClientHistory] = useState(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      // Start scanning loop
      const scanFrame = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            const id = parseTicketId(code.data);
            if (id) {
              stopCamera();
              loadAppointmentById(id);
              return;
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(scanFrame);
      };
      animFrameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError(t('attendance.cameraError'));
      setCameraActive(false);
    } finally {
      startingRef.current = false;
    }
  };

  const loadAppointmentById = (id) => {
    api(`/api/appointments/${id}`)
      .then((data) => {
        setSelectedAppointment(data.appointment || data);
        fetchClientHistory(data.appointment?.guestEmail || data.guestEmail);
      })
      .catch(() => {
        toast.error(t('attendance.urlParseError'));
      });
  };

  const handleManualParse = () => {
    const id = parseTicketId(manualUrl);
    if (!id) {
      toast.error(t('attendance.urlParseError'));
      return;
    }
    loadAppointmentById(id);
    setManualUrl('');
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const filter = searchQuery.trim() ? '' : '&filter=upcoming';
    api(`/api/appointments?q=${encodeURIComponent(searchQuery.trim())}${filter}`)
      .then((data) => {
        setSearchResults(Array.isArray(data) ? data : data.appointments || []);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const fetchClientHistory = (email) => {
    if (!email) { setClientHistory(null); return; }
    api(`/api/appointments?q=${encodeURIComponent(email)}`)
      .then((data) => {
        const all = Array.isArray(data) ? data : data.appointments || [];
        const nonCancelled = all.filter((a) => a.status !== 'cancelled');
        const attended = all.filter((a) => a.status === 'present' || a.status === 'completed');
        setClientHistory({ visits: nonCancelled.length, attendances: attended.length });
      })
      .catch(() => setClientHistory(null));
  };

  const markCheckIn = (aptId) => {
    api(`/api/appointments/${aptId}/checkin`, { method: 'POST' })
      .then(() => {
        toast.success(t('attendance.checkInDone'));
        setSelectedAppointment((prev) => prev ? { ...prev, status: 'present' } : prev);
        if (searchResults.length) {
          setSearchResults((prev) => prev.map((a) => a.id === aptId ? { ...a, status: 'present' } : a));
        }
      })
      .catch(() => toast.error(t('common.error')));
  };

  const markNoShow = (aptId) => {
    api(`/api/appointments/${aptId}/no-show`, { method: 'POST' })
      .then(() => {
        toast.success(t('attendance.noShow'));
        setSelectedAppointment((prev) => prev ? { ...prev, status: 'no_show' } : prev);
        if (searchResults.length) {
          setSearchResults((prev) => prev.map((a) => a.id === aptId ? { ...a, status: 'no_show' } : a));
        }
      })
      .catch(() => toast.error(t('common.error')));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  if (!businessId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('attendance.title')}</h1>
        <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('reports.selectBusiness')}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'scan', label: t('attendance.scanTab') },
    { id: 'search', label: t('attendance.searchTab') },
  ];

  const renderAppointmentCard = (apt) => {
    const isPresent = apt.status === 'present';
    const isCompleted = apt.status === 'completed';
    const isNoShow = apt.status === 'no_show';
    const isCancelled = apt.status === 'cancelled';
    const isAlreadyMarked = isPresent || isCompleted || isNoShow || isCancelled;

    return (
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">{apt.guestName || '—'}</p>
            <p className="mt-0.5 text-sm text-gray-500">{apt.guestEmail || ''}</p>
            {apt.guestPhone && <p className="text-sm text-gray-500">{apt.guestPhone}</p>}
            <p className="mt-2 text-sm text-gray-600">
              {formatDate(apt.startsAt)} · {formatTime(apt.startsAt)}
            </p>
            {apt.appointmentServices && apt.appointmentServices.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {apt.appointmentServices.map((s) => s.name || s.service?.name).filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <StatusBadge status={apt.status} t={t} />
        </div>

        {/* Action buttons */}
        {!isAlreadyMarked ? (
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => markCheckIn(apt.id)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('attendance.arrived')}
            </button>
            <button
              type="button"
              onClick={() => markNoShow(apt.id)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-600 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('attendance.notArrived')}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {isPresent && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-700 font-medium">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('attendance.present')}
              </div>
            )}
            {isNoShow && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 font-medium">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('attendance.noShow')}
              </div>
            )}
            {(isCompleted || isCancelled) && (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 font-medium">
                <StatusBadge status={apt.status} t={t} />
              </div>
            )}
          </div>
        )}

        {/* Client history */}
        {clientHistory && (
          <div className="mt-4 flex gap-4 rounded-xl bg-gray-50 p-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{clientHistory.visits}</p>
              <p className="text-xs text-gray-500">{t('attendance.visits')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{clientHistory.attendances}</p>
              <p className="text-xs text-gray-500">{t('attendance.attendances')}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('attendance.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('attendance.description')}</p>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedAppointment(null);
              setClientHistory(null);
              if (activeTab === 'scan') stopCamera();
            }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scan Tab */}
      {activeTab === 'scan' && (
        <div className="mt-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">{t('attendance.scanTab')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('attendance.scanHint')}</p>

            <div className="mt-4 overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="w-full" style={{ display: cameraActive ? 'block' : 'none' }} playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraActive && (
                <div className="flex h-48 items-center justify-center text-gray-400">
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {cameraError && <p className="mt-3 text-sm text-red-600">{cameraError}</p>}

            <div className="mt-4 flex gap-3">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 active:scale-95"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('attendance.startCamera')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-600 active:scale-95"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {t('attendance.stopCamera')}
                </button>
              )}
            </div>

            {/* Manual input */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">{t('attendance.pasteUrl')}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualParse(); }}
                  placeholder={t('attendance.pastePlaceholder')}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <button
                  type="button"
                  onClick={handleManualParse}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {t('common.search')}
                </button>
              </div>
            </div>
          </div>

          {selectedAppointment && renderAppointmentCard(selectedAppointment)}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="mt-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">{t('attendance.searchTab')}</h2>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('attendance.searchPlaceholder')}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searchLoading}
                className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 active:scale-95 transition-all disabled:opacity-70"
              >
                {searchLoading ? t('common.loading') : t('common.search')}
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {searchResults.map((apt) => (
                <div
                  key={apt.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm cursor-pointer transition-all hover:shadow-md"
                  onClick={() => {
                    setSelectedAppointment(apt);
                    fetchClientHistory(apt.guestEmail);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{apt.guestName || '—'}</p>
                      <p className="text-sm text-gray-500">{apt.guestEmail || ''}</p>
                      {apt.guestPhone && <p className="text-sm text-gray-500">{apt.guestPhone}</p>}
                      <p className="mt-1 text-sm text-gray-600">
                        {formatDate(apt.startsAt)} · {formatTime(apt.startsAt)}
                      </p>
                      {apt.appointmentServices && apt.appointmentServices.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {apt.appointmentServices.map((s) => s.name || s.service?.name).filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={apt.status} t={t} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && !searchLoading && searchQuery && (
            <EmptyState icon="🔍" title={t('attendance.noResults')} description={t('attendance.searchPlaceholder')} />
          )}

          {selectedAppointment && renderAppointmentCard(selectedAppointment)}
        </div>
      )}
    </div>
  );
}
