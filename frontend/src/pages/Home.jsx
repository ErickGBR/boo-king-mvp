import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Home() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <nav className={`sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            {t('app.name')}
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            {user ? (
              <>
                <Link to="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">{t('nav.dashboard')}</Link>
                <button type="button" onClick={logout} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">{t('nav.login')}</Link>
                <Link to="/register" className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 active:scale-[0.97]">{t('nav.tryFree')}</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-orb-float absolute -left-20 -top-20 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="animate-orb-float-2 absolute -bottom-32 right-10 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />
            <div className="animate-orb-float-3 absolute left-1/3 top-1/3 h-48 w-48 rounded-full bg-teal-300/10 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full bg-teal-500/10 px-4 py-1.5 text-sm font-medium text-teal-400">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                {nav.tryFree} — {t('hero.noCardShort')}
              </div>
              <h1 className="animate-fade-in-up animate-stagger-1 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                {t('hero.title')}
              </h1>
              <p className="animate-fade-in-up animate-stagger-2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-300">
                {t('hero.subtitle')}
              </p>
              {!user && (
                <div className="animate-fade-in-up animate-stagger-3 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-600 hover:shadow-xl hover:shadow-teal-500/25 active:scale-[0.97]">
                    {t('hero.cta')}
                    <span aria-hidden>→</span>
                  </Link>
                  <span className="text-sm text-gray-300">{t('hero.noCard')}</span>
                </div>
              )}
              {user && (
                <Link to="/dashboard" className="animate-fade-in-up animate-stagger-3 mt-10 inline-flex rounded-xl bg-teal-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-600 hover:shadow-xl hover:shadow-teal-500/25 active:scale-[0.97]">
                  {t('hero.goDashboard')}
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="animate-fade-in-up mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold text-gray-900">{t('features.title')}</h2>
              <p className="mt-4 text-gray-600">{t('features.subtitle')}</p>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: '📅', title: t('features.online'), desc: t('features.onlineDesc') },
                { icon: '🔔', title: t('features.reminders'), desc: t('features.remindersDesc') },
                { icon: '👥', title: t('features.team'), desc: t('features.teamDesc') },
                { icon: '📊', title: t('features.reports'), desc: t('features.reportsDesc') },
                { icon: '🌐', title: t('features.lang'), desc: t('features.langDesc') },
                { icon: '📱', title: t('features.mobile'), desc: t('features.mobileDesc') },
              ].map((f, i) => (
                <div key={f.title} className={`animate-fade-in-up animate-stagger-${i + 1} group rounded-2xl border border-gray-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-xl`}>
                  <span className="inline-block text-3xl transition-transform duration-300 group-hover:scale-110">{f.icon}</span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!user && (
          <section className="bg-gradient-to-r from-teal-600 to-teal-500 py-16">
            <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-white">{t('cta.title')}</h2>
              <p className="mt-2 text-teal-100">{t('cta.subtitle')}</p>
              <Link to="/register" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-teal-600 shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-[0.97]">
                {t('hero.cta')} <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        )}

        <footer className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8 md:flex-row md:justify-between">
              <div className="max-w-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="font-semibold text-gray-900">{t('app.name')}</span>
                </div>
                <p className="mt-3 text-sm text-gray-600">{t('footer.description')}</p>
                <p className="mt-4 text-xs text-gray-400">{t('footer.rights')}</p>
              </div>
              <div className="flex gap-12">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t('footer.product')}</h3>
                  <ul className="mt-3 space-y-2">
                    <li><Link to="/" className="text-sm text-gray-600 hover:text-gray-900">{t('nav.home')}</Link></li>
                    <li><Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">{t('nav.login')}</Link></li>
                    <li><Link to="/register" className="text-sm text-gray-600 hover:text-gray-900">{t('nav.register')}</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t('footer.support')}</h3>
                  <ul className="mt-3 space-y-2">
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">{t('footer.help')}</a></li>
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">{t('footer.docs')}</a></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t('footer.legal')}</h3>
                  <ul className="mt-3 space-y-2">
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">{t('footer.privacy')}</a></li>
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">{t('footer.terms')}</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
