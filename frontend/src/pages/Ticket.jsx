import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generateTicketPdf, ticketNumberFromId } from '../utils/ticketPdf';
import { Skeleton } from '../components/Skeleton';

const API = import.meta.env.VITE_API_URL || '';

export default function Ticket() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(API + '/api/tickets/' + id)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (d.appointment?.status === 'present') setCheckInDone(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Generate QR dynamically
  useEffect(() => {
    if (!data) return;
    import('qrcode').then(({ default: QRCode }) => {
      const url =
        (typeof window !== 'undefined' ? window.location.origin : '') +
        '/t/' +
        id;
      QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQrDataUrl);
    });
  }, [data, id]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API + '/api/appointments/' + id + '/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: 'Bearer ' + token }),
        },
      });
      if (res.ok) {
        setCheckInDone(true);
        setData((prev) =>
          prev ? { ...prev, appointment: { ...prev.appointment, status: 'present' } } : prev
        );
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setCheckingIn(false);
    }
  };

  const handleDownloadPdf = () => {
    if (data?.appointment) generateTicketPdf(data.appointment);
  };

  const apt = data?.appointment;
  const ticketNumber = apt?.ticketNumber || ticketNumberFromId(apt?.id);
  const canCheckIn = data?.canCheckIn && !checkInDone;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-6 w-3/4 mx-auto mb-6" />
          <Skeleton className="h-40 w-40 mx-auto mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !apt) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">🎫</div>
        <h1 className="text-2xl font-bold text-gray-900">{t('ticket.notFound')}</h1>
        <p className="mt-2 text-gray-600 text-center max-w-sm">{t('ticket.notFoundDesc')}</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-600 hover:shadow-xl active:scale-[0.97]"
        >
          ← {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        {/* Header */}
        <div className="bg-teal-500 px-6 py-4 text-white">
          <p className="text-sm font-semibold">Boo-king</p>
          {apt.business?.name && (
            <p className="text-xs opacity-90 mt-0.5">{apt.business.name}</p>
          )}
        </div>

        <div className="p-6">
          {/* Ticket number */}
          <p className="text-xs text-gray-500 text-center">{t('ticket.number')}</p>
          <p className="text-2xl font-bold text-teal-600 text-center mt-1 tracking-wide">
            {ticketNumber}
          </p>

          {/* QR */}
          {qrDataUrl ? (
            <div className="flex justify-center my-5">
              <img src={qrDataUrl} alt="QR" className="w-40 h-40" />
            </div>
          ) : (
            <div className="flex justify-center my-5">
              <Skeleton className="w-40 h-40" />
            </div>
          )}
          <p className="text-xs text-gray-400 text-center -mt-2 mb-5">{t('ticket.scanHint')}</p>

          {/* Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('ticket.date')}</span>
              <span className="font-medium text-gray-900">
                {new Date(apt.startsAt).toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('ticket.time')}</span>
              <span className="font-medium text-gray-900">
                {new Date(apt.startsAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -{' '}
                {new Date(apt.endsAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {apt.business?.name && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('ticket.business')}</span>
                <span className="font-medium text-gray-900 text-right max-w-[60%]">
                  {apt.business.name}
                </span>
              </div>
            )}
            {apt.business?.locationType === 'presencial' && apt.business?.address && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('ticket.location')}</span>
                <span className="font-medium text-gray-900 text-right max-w-[60%]">
                  📍 {apt.business.address}
                </span>
              </div>
            )}
            {apt.business?.locationType === 'online' && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('ticket.location')}</span>
                <span className="font-medium text-gray-900">💻 {t('location.online')}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('ticket.status')}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  checkInDone || apt.status === 'present'
                    ? 'bg-green-100 text-green-700'
                    : apt.status === 'confirmed'
                    ? 'bg-teal-100 text-teal-700'
                    : apt.status === 'cancelled'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {checkInDone || apt.status === 'present'
                  ? `✓ ${t('ticket.checkedIn')}`
                  : t(`status.${apt.status}`)}
              </span>
            </div>
          </div>

          {/* Check-in button */}
          {canCheckIn && (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="mt-5 w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.98] disabled:opacity-70"
            >
              {checkingIn ? t('common.loading') : t('ticket.checkIn')}
            </button>
          )}

          {/* Checked-in badge */}
          {checkInDone && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-2.5">
              <span className="text-sm font-semibold text-green-700">
                ✓ {t('ticket.checkedIn')}
              </span>
            </div>
          )}

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t('ticket.download')}
          </button>
        </div>
      </div>
    </div>
  );
}
