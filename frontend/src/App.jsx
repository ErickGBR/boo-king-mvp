import { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Businesses from './pages/Businesses';
import Appointments from './pages/Appointments';
import Calendar from './pages/Calendar';
import Booking from './pages/Booking';
import DashboardHome from './pages/DashboardHome';
import Reportes from './pages/Reportes';
import BusinessForm from './pages/BusinessForm';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 p-4">
          <p className="text-center text-gray-700">Algo ha fallado. Recarga la página.</p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 active:scale-[0.97] transition-all duration-200">
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-teal-500" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-8xl font-bold text-teal-500">404</div>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Página no encontrada</h1>
      <p className="mt-2 text-gray-600">La página que buscas no existe.</p>
      <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-600 hover:shadow-xl active:scale-[0.97]">
        ← Volver al inicio
      </Link>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/b/:slug" element={<Booking />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
        <Route index element={<DashboardHome />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="businesses" element={<Businesses />} />
        <Route path="businesses/new" element={<BusinessForm />} />
        <Route path="businesses/:id" element={<BusinessForm />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="reportes" element={<Reportes />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  const content = (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );

  if (!googleClientId) return content;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {content}
    </GoogleOAuthProvider>
  );
}
