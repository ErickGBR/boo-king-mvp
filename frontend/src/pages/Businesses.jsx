import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function BusinessCard({ business }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${business.slug}` : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
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

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-4 bg-teal-500 text-white">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">N</div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{business.name}</h2>
          <p className="text-sm opacity-90">{business.category?.name} · {business.durationMinutes} min</p>
        </div>
        <Link
          to={`/dashboard/businesses/${business.id}`}
          className="hidden shrink-0 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg_white/20 sm:inline-flex"
        >
          Editar
        </Link>
      </div>
      <div className="px-4 py-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Enlace de reserva</p>
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
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver detalle
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600"
          >
            Compartir
          </button>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/businesses/${business.id}`)}
            className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:hidden"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Businesses() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const max = user?.subscriptionPlan === 'paid' ? 10 : 2;
  const canAdd = businesses.length < max;

  useEffect(() => {
    api('/api/businesses').then(setBusinesses).catch(() => setBusinesses([]));
  }, []);

  if (!businesses.length && !canAdd) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mis negocios</h1>
        <p className="mt-2 text-gray-500">Límite de negocios alcanzado para tu plan.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        {canAdd ? (
          <Link to="/dashboard/businesses/new" className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">Nuevo negocio</Link>
        ) : (
          <p className="text-sm text-gray-500">Máximo {max} negocios. <a href="#" className="text-teal-600 hover:underline">Mejorar plan</a></p>
        )}
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Mis negocios</h1>
      <p className="mt-1 text-gray-600">Gestiona tus negocios y enlaces de reserva</p>
      {businesses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">Aún no tienes negocios.</p>
          <Link to="/dashboard/businesses/new" className="mt-4 inline-block rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">Crear primer negocio</Link>
        </div>
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
