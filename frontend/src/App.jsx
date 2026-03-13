import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';
import Dashboard from './pages/Dashboard';

// ── Placeholder Pages ───────────────────────────────────────

function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
        <div className="text-5xl mb-4">💰</div>
        <h1 className="text-2xl font-bold text-white mb-2">CatatUang</h1>
        <p className="text-gray-400 mb-6">WhatsApp Expense Tracker</p>
        <div className="bg-gray-800 rounded-xl p-4 text-left">
          <p className="text-gray-300 text-sm mb-3">Cara mengakses dashboard:</p>
          <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
            <li>Kirim pesan apa saja ke bot WhatsApp kami</li>
            <li>Bot akan membalas dengan link dashboard</li>
            <li>Klik link tersebut untuk masuk otomatis</li>
          </ol>
        </div>
        <p className="text-gray-600 text-xs mt-6">Token dikirim melalui WhatsApp untuk keamanan</p>
      </div>
    </div>
  );
}

function TokenError() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-white mb-2">Token Tidak Valid</h1>
        <p className="text-gray-400 text-sm">Token sudah expired atau tidak valid. Minta link baru via WhatsApp.</p>
      </div>
    </div>
  );
}

// ── Protected Route Wrapper ─────────────────────────────────

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Memverifikasi token...</div>
      </div>
    );
  }

  if (error) return <TokenError />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

// ── App ─────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
