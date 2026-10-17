import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'es';

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(current === 'es' ? 'en' : 'es')}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={current === 'en' ? 'text-teal-600 font-semibold' : ''}>EN</span>
      <span className="text-gray-300">/</span>
      <span className={current === 'es' ? 'text-teal-600 font-semibold' : ''}>ES</span>
    </button>
  );
}
