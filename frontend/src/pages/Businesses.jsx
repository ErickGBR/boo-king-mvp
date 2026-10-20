import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { toast } from 'sonner';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';

function BusinessCard({ business }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${business.slug}` : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t('businesses.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    const shareData = {
      title: business.name,
      text: `Reserva tu cita en ${business.name}`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') handleCopyUrl();
      }
    } else {
      handleCopyUrl();
    }
  };

  const initials = String(business.name).slice(0, 2).toUpperCase();

  return (
    <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-teal-500 to-teal-400 text-white">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">{initials}</div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{business.name}</h2>
          <p className="text-sm opacity-90">{business.category?.name} · {business.durationMinutes} min</p>
        </div>
        <Link
          to={`/dashboard/businesses/${business.id}`}
          className="hidden shrink-0 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 sm:inline-flex"
        >
          {t('businesses.edit')}
        </Link>
      </div>
      <div className="px-4 py-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('businesses.bookingLink')}</p>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <code className="min-w-0 flex-1 truncate text-sm text-gray-700">{url}</code>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            title="Copiar enlace"
          >
{copied ? (
              <svg className="h-4 w-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m2 4a2 2 0 01-2 2h-2m-4-1H8" /></svg>
            )}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
              type="button"
              onClick={() => navigate(`/dashboard/businesses/${business.id}`)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('businesses.viewDetail')}
          </button>
          <button
              type="button"
              onClick={handleShare}
              className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 active:scale-[0.97] transition-all"
            >
              {t('businesses.share')}
          </button>
          <button
              type="button"
              onClick={() => navigate(`/dashboard/businesses/${business.id}`)}
              className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:hidden"
            >
              {t('businesses.edit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Businesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    api('/api/businesses')
      .then(setBusinesses)
      .catch(() => setBusinesses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
<h1 className="text-2xl font-semibold text-gray-900">{t('businesses.title')}</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Link to="/dashboard/businesses/new" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.97]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo negocio
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">{t('businesses.title')}</h1>
      <p className="mt-1 text-gray-600">{t('businesses.subtitle')}</p>
      {businesses.length === 0 ? (
        <EmptyState
          icon="🏪"
          title={t('businesses.emptyTitle')}
          description={t('businesses.emptyDesc')}
          action={
            <Link to="/dashboard/businesses/new" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.97]">
              {t('businesses.createFirst')}
            </Link>
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}
