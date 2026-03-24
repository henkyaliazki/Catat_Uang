import { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import client, { setAuth } from '../api/client';

const AuthContext = createContext(null);
const SESSION_KEY = 'catatuang_token';

export function AuthProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(null);
  const [waNumber, setWaNumber] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    const savedToken = sessionStorage.getItem(SESSION_KEY);
    const activeToken = urlToken || savedToken;

    console.log('[AUTH] urlToken:', urlToken ? 'ada' : 'tidak ada');
    console.log('[AUTH] savedToken:', savedToken ? 'ada' : 'tidak ada');

    if (!activeToken) {
      console.log('[AUTH] Tidak ada token sama sekali → redirect ke /login');
      setIsLoading(false);
      return;
    }

    // Jika token baru dari URL, simpan ke session storage
    if (urlToken) {
      console.log('[AUTH] Token baru dari URL, disimpan ke sessionStorage');
      sessionStorage.setItem(SESSION_KEY, urlToken);
      // Hapus token dari URL (security)
      searchParams.delete('token');
      setSearchParams(searchParams, { replace: true });
    }

    // Set auth header dulu sebelum validasi
    setAuth(activeToken, null);
    console.log('[AUTH] Memvalidasi token ke server...');

    client
      .get('/api/v1/expenses', { params: { limit: 1 } })
      .then((res) => {
        console.log('[AUTH] Response validasi:', res.status, JSON.stringify(res.data).slice(0, 100));
        if (res.data.success) {
          setToken(activeToken);
          setIsAuthenticated(true);
          console.log('[AUTH] ✅ Autentikasi berhasil!');

          // Decode waNumber dari JWT payload
          try {
            const payload = JSON.parse(atob(activeToken.split('.')[1]));
            setWaNumber(payload.waNumber || null);
            setAuth(activeToken, payload.waNumber);
            console.log('[AUTH] waNumber:', payload.waNumber);
          } catch (e) {
            console.warn('[AUTH] Gagal decode JWT payload:', e.message);
            setAuth(activeToken, null);
          }
        } else {
          console.warn('[AUTH] ❌ Server menolak token:', res.data);
          sessionStorage.removeItem(SESSION_KEY);
          setError('Token tidak valid atau sesi habis');
          setAuth(null, null);
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        const detail = err?.response?.data || err.message;
        console.error('[AUTH] ❌ Error validasi token:', status, detail);
        sessionStorage.removeItem(SESSION_KEY);
        setError(`Token tidak valid (HTTP ${status || 'network error'})`);
        setAuth(null, null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
    setWaNumber(null);
    setIsAuthenticated(false);
  };

  const value = { token, waNumber, isAuthenticated, isLoading, error, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
