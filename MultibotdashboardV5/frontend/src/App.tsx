/**
 * Main application component with routing.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { initTheme } from './styles/theme';
import { Layout } from './components/common/Layout';
import { ToastContainer } from './components/common/Toast';
import Login from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BotDetail } from './pages/BotDetail';
import { Settings } from './pages/Settings';
import { Compare } from './pages/Compare';
import { UserManagement } from './pages/UserManagement';
import { Alerts } from './pages/Alerts';
import { Discovery } from './pages/Discovery';
import { Historic } from './pages/Historic';
import { Backtest } from './pages/Backtest';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 seconds
      retry: 1,
    },
  },
});

/**
 * Protected route wrapper that redirects to login if not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

/**
 * Main App component.
 */
function App() {
  const logout = useAuthStore((state) => state.logout);

  // Initialize theme on mount
  useEffect(() => {
    initTheme();
  }, []);

  // Listen for unauthorized events (401) and redirect to login
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastContainer />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes with Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bots/:botId"
            element={
              <ProtectedRoute>
                <BotDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <Compare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/discovery"
            element={
              <ProtectedRoute>
                <Discovery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historic"
            element={
              <ProtectedRoute>
                <Historic />
              </ProtectedRoute>
            }
          />
          <Route
            path="/backtest"
            element={
              <ProtectedRoute>
                <Backtest />
              </ProtectedRoute>
            }
          />

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
