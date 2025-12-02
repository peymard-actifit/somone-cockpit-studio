import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import StudioPage from './pages/StudioPage';
import PublicCockpitPage from './pages/PublicCockpitPage';
import { ConfirmProvider } from './contexts/ConfirmContext';
import React from 'react';

// Error Boundary pour attraper les erreurs React
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erreur React attrapée:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white p-8">
          <h1 className="text-2xl font-bold mb-4">Une erreur s'est produite</h1>
          <pre className="bg-black/50 p-4 rounded overflow-auto text-sm">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-white text-black rounded"
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { user } = useAuthStore();
  
  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <div className="min-h-screen bg-cockpit-bg-dark">
          <Routes>
          <Route 
            path="/auth" 
            element={user ? <Navigate to="/" replace /> : <AuthPage />} 
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/:cockpitId"
            element={
              <ProtectedRoute>
                <StudioPage />
              </ProtectedRoute>
            }
          />
          {/* Route publique - accessible sans authentification */}
          <Route path="/public/:publicId" element={<PublicCockpitPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

export default App;


