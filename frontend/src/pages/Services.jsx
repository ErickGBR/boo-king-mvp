import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getCurrentBusinessId } from '../api/client';
import EmptyState from '../components/EmptyState';
import { SkeletonRow } from '../components/Skeleton';
import { toast } from 'sonner';

const EMPTY_FORM = { name: '', price: '', durationMinutes: '', active: true };

export default function Services() {
  const { t } = useTranslation();
  const businessId = getCurrentBusinessId();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    api('/api/services')
      .then((data) => setServices(data.services || []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (svc) => {
    setEditing(svc);
    setForm({
      name: svc.name,
      price: String(svc.price),
      durationMinutes: svc.durationMinutes ? String(svc.durationMinutes) : '',
      active: svc.active,
    });
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t('services.required');
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) e.price = t('services.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      active: form.active,
    };
    if (form.durationMinutes) payload.durationMinutes = parseInt(form.durationMinutes, 10);

    const method = editing ? 'PUT' : 'POST';
    const path = editing ? `/api/services/${editing.id}` : '/api/services';

    api(path, { method, body: JSON.stringify(payload) })
      .then(() => {
        closeModal();
        load();
        toast.success(editing ? t('services.saved') : t('services.saved'));
      })
      .catch((err) => {
        setErrors({ server: err?.error || err?.message || t('common.error') });
      })
      .finally(() => setSubmitting(false));
  };

  const handleDelete = (svc) => {
    if (!window.confirm(t('services.deleteConfirm'))) return;
    api(`/api/services/${svc.id}`, { method: 'DELETE' })
      .then(() => {
        toast.success(t('services.deleted'));
        load();
      })
      .catch(() => toast.error(t('common.error')));
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);

  if (!businessId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('services.title')}</h1>
        <EmptyState icon="✨" title={t('services.notFound')} description={t('reports.selectBusiness')} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('services.description')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-600 hover:shadow-lg active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('services.newService')}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            icon="✨"
            title={t('services.notFound')}
            description={t('services.description')}
            action={
              <button type="button" onClick={openCreate} className="rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors">
                {t('services.newService')}
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {services.map((svc) => (
              <li key={svc.id} className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{svc.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatPrice(svc.price)}
                    {svc.durationMinutes ? ` · ${svc.durationMinutes} min` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${svc.active ? 'bg-teal-500/20 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                  {svc.active ? t('services.active') : t('services.inactive')}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(svc)}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(svc)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="animate-scale-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? t('services.editService') : t('services.newService')}
              </h2>
              <button type="button" onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('services.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  placeholder={t('services.name')}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t('services.price')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  placeholder="0.00"
                />
                {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t('services.duration')}</label>
                <input
                  type="number"
                  min="0"
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  placeholder="60"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${form.active ? 'bg-teal-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${form.active ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-gray-700">{form.active ? t('services.active') : t('services.inactive')}</span>
              </div>

              {errors.server && <p className="text-sm text-red-600">{errors.server}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={closeModal} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                {t('services.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 active:scale-[0.97] transition-all disabled:opacity-70"
              >
                {submitting ? t('common.loading') : t('services.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
