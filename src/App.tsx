import { Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuthStore } from './store/authStore';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import StudioPage from './pages/StudioPage';
import PublicCockpitPage from './pages/PublicCockpitPage';
import PublicUserCockpitsPage from './pages/PublicUserCockpitsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ContextualHelpProvider } from './contexts/ContextualHelpContext';
import React, { useEffect, useState } from 'react';

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
  const { user, token, logout } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);
  
  // Vérifier le token au démarrage
  useEffect(() => {
    const verifyToken = async () => {
      if (!token || !user) {
        setIsVerifying(false);
        return;
      }
      
      try {
        console.log('[App] Vérification du token au démarrage...');
        const response = await fetch('/api/auth/verify', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!response.ok) {
          console.error('[App] Token invalide - déconnexion forcée');
          logout();
        } else {
          console.log('[App] Token valide');
        }
      } catch (error) {
        console.error('[App] Erreur de vérification du token:', error);
        // En cas d'erreur réseau, on garde l'utilisateur connecté
      }
      
      setIsVerifying(false);
    };
    
    verifyToken();
  }, [token, user, logout]);
  
  // Afficher un loader pendant la vérification
  if (isVerifying && user) {
    return (
      <div className="min-h-screen bg-cockpit-bg-dark flex items-center justify-center">
        <div className="text-white text-lg">Vérification de la session...</div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <ContextualHelpProvider>
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
            {/* Routes publiques - accessibles sans authentification */}
            <Route path="/public/:publicId" element={<PublicCockpitPage />} />
            <Route path="/public/user/:userId" element={<PublicUserCockpitsPage />} />
            {/* Route de réinitialisation de mot de passe via QR code */}
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <SpeedInsights />
          </div>
        </ContextualHelpProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

export default App;


