import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ProfileModal from '../components/ProfileModal';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Profile() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  const roleLabel = {
    owner: t('profile.owner'),
    admin: t('profile.admin'),
    staff: t('profile.staff'),
  };

  const initials = user ? (user.name || user.email || '').slice(0, 2).toUpperCase() : '??';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h1>
      <p className="mt-1 text-sm text-gray-600">{t('profile.subtitle')}</p>

      <div className="mt-6 max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xl font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{user?.name}</h2>
              <p className="text-sm text-gray-500 truncate">{user?.email}</p>
              <span className="mt-1 inline-block rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
                {roleLabel[user?.role] || user?.role}
              </span>
            </div>
          </div>

          <hr className="my-5 border-gray-200" />

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">{t('profile.name')}</p>
              <p className="mt-1 text-sm text-gray-900">{user?.name || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('profile.email')}</p>
              <p className="mt-1 text-sm text-gray-900">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('profile.role')}</p>
              <p className="mt-1 text-sm text-gray-900">{roleLabel[user?.role] || user?.role}</p>
            </div>
          </div>

          <hr className="my-5 border-gray-200" />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-lg active:scale-[0.97]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('profile.edit')}
            </button>
          </div>

          <hr className="my-5 border-gray-200" />

          <div>
            <p className="mb-2 text-sm font-medium text-gray-500">{t('profile.language')}</p>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <ProfileModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
