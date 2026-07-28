import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InstallPrompt from '../components/InstallPrompt';

const TEAL = '#14b8a6';
const TEAL_DARK = '#0d9488';

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: TEAL }}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Boo-king
          </Link>
          <div className="flex items-center gap-1">
            {user ? (
              <>
                <Link to="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900">Panel</Link>
                <button type="button" onClick={logout} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900">Cerrar sesión</button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900">Iniciar sesión</Link>
                <Link to="/register" className="rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" style={{ backgroundColor: TEAL }}>Prueba gratis</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="rounded-2xl px-6 py-16 text-white" style={{ backgroundColor: '#1f2937' }}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Empieza a recibir reservas hoy mismo
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
              Únete a miles de negocios que ya usan Boo-king para crecer. Agenda, reprograma y gestiona todas tus citas en un solo lugar.
            </p>
            {!user && (
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link to="/register" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: TEAL }}>
                  Crear cuenta gratis
                  <span aria-hidden>→</span>
                </Link>
                <span className="text-sm text-gray-400">Sin tarjeta de crédito requerida</span>
              </div>
            )}
            {user && (
              <Link to="/dashboard" className="mt-8 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: TEAL }}>
                Ir al panel
              </Link>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8">
          <InstallPrompt />
        </section>

        <footer className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8 md:flex-row md:justify-between">
              <div className="max-w-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: TEAL }}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                  <span className="font-semibold text-gray-900">Boo-king</span>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  La plataforma de citas que potencia tu negocio. Simple, rápida y profesional.
                </p>
                <p className="mt-4 text-xs text-gray-500">2026 Boo-king. Todos los derechos reservados.</p>
              </div>
              <div className="flex gap-12">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Producto</h3>
                  <ul className="mt-3 space-y-2">
                    <li><Link to="/" className="text-sm text-gray-600 hover:text-gray-900">Inicio</Link></li>
                    <li><Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Iniciar sesión</Link></li>
                    <li><Link to="/register" className="text-sm text-gray-600 hover:text-gray-900">Registrarse</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Soporte</h3>
                  <ul className="mt-3 space-y-2">
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">Centro de ayuda</a></li>
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">Documentación</a></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Legal</h3>
                  <ul className="mt-3 space-y-2">
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">Privacidad</a></li>
                    <li><a href="#" className="text-sm text-gray-600 hover:text-gray-900">Términos</a></li>
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
