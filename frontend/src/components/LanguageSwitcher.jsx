import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'es';

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(current === 'es' ? 'en' : 'es')}
      className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {current === 'es' ? '🇺🇸 EN' : '🇲🇽 ES'}
    </button>
  );
}
