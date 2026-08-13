import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api('/api/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = (email, password) =>
    api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      .then(({ user, token }) => {
        localStorage.setItem('token', token);
        setUser(user);
        return user;
      });

  const register = (name, email, password) =>
    api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
      .then(({ user, token }) => {
        localStorage.setItem('token', token);
        setUser(user);
        return user;
      });

  const loginWithGoogle = (credential) =>
    api('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) })
      .then(({ user, token }) => {
        localStorage.setItem('token', token);
        setUser(user);
        return user;
      });

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
