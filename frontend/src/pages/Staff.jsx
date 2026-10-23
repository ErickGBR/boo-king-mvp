import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { toast } from 'sonner';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Staff() {
  const { t } = useTranslation();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const loadMembers = () => {
    setLoading(true);
    api('/api/staff')
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    setAdding(true);
    try {
      await api('/api/staff', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      toast.success(t('staff.added'));
      setEmail('');
      setRole('staff');
      loadMembers();
    } catch (err) {
      setError(err?.message || err?.error || t('staff.addError'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (member) => {
    if (!window.confirm(t('staff.confirmRemove'))) return;
    try {
      await api(`/api/staff/${member.id}`, { method: 'DELETE' });
      toast.success(t('staff.removed'));
      loadMembers();
    } catch {
      toast.error(t('staff.removeError'));
    }
  };

  const roleLabel = (r) => {
    if (r === 'admin') return t('staff.roleAdmin');
    return t('staff.roleStaff');
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('staff.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('staff.subtitle')}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('staff.addMember')}</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="staff-email" className="mb-1 block text-sm font-medium text-gray-700">
              {t('staff.email')}
            </label>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('staff.emailPlaceholder')}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
          <div className="sm:w-40">
            <label htmlFor="staff-role" className="mb-1 block text-sm font-medium text-gray-700">
              {t('staff.role')}
            </label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white"
            >
              <option value="staff">{t('staff.roleStaff')}</option>
              <option value="admin">{t('staff.roleAdmin')}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.97] disabled:opacity-50 sm:shrink-0"
          >
            {adding ? <LoadingSpinner size="sm" /> : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {t('staff.addMember')}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/4 rounded bg-gray-200" />
                </div>
                <div className="h-8 w-16 rounded-lg bg-gray-200" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon="👥"
            title={t('staff.empty')}
            description={t('staff.emptyDesc')}
          />
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
                  {(m.name || m.email || '').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{m.name || m.email}</p>
                  <p className="text-sm text-gray-500 truncate">{m.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
                  {roleLabel(m.role)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(m)}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  {t('staff.remove')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
