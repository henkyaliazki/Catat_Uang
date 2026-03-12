import { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import client, { setAuth } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(null);
  const [waNumber, setWaNumber] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');

    if (!urlToken) {
      setIsLoading(false);
      return;
    }

    // Clean the token from the URL for security
    searchParams.delete('token');
    setSearchParams(searchParams, { replace: true });

    // Validate token by hitting the API
    setAuth(urlToken, null);

    client
      .get('/api/v1/expenses', { params: { limit: 1 } })
      .then((res) => {
        if (res.data.success) {
          setToken(urlToken);
          setIsAuthenticated(true);

          // Decode waNumber from JWT payload
          try {
            const payload = JSON.parse(atob(urlToken.split('.')[1]));
            setWaNumber(payload.waNumber || null);
            setAuth(urlToken, payload.waNumber);
          } catch {
            setAuth(urlToken, null);
          }
        }
      })
      .catch(() => {
        setError('Token tidak valid');
        setAuth(null, null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = { token, waNumber, isAuthenticated, isLoading, error };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
