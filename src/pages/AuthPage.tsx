import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from '../components/IconPicker';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const { login, register, isLoading, error, clearError } = useAuthStore();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    
    if (!username.trim() || !password.trim()) {
      setLocalError('Veuillez remplir tous les champs');
      return;
    }
    
    if (!isLogin && password !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (!isLogin && password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (isLogin) {
      await login(username, password);
    } else {
      await register(username, password);
    }
  };
  
  const displayError = localError || error;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cockpit-bg-dark via-slate-900 to-cockpit-bg-dark p-4">
      {/* Éléments décoratifs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative w-full max-w-md">
        {/* Logo / Titre */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            SOMONE
          </h1>
          <p className="text-lg text-slate-400 font-light tracking-wide">
            Cockpit Studio
          </p>
        </div>
        
        {/* Carte de connexion */}
        <div className="bg-cockpit-bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifiant */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Identifiant
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><MuiIcon name="UserIcon" size={20} /></div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Votre identifiant"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><MuiIcon name="LockIcon" size={20} /></div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <MuiIcon name="EyeOff" size={20} /> : <MuiIcon name="Eye" size={20} />}
                </button>
              </div>
            </div>
            
            {/* Confirmation mot de passe (inscription) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><MuiIcon name="LockIcon" size={20} /></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}
            
            {/* Erreur */}
            {displayError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
                {displayError}
              </div>
            )}
            
            {/* Bouton submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin"><MuiIcon name="Loader2" size={20} /></div>
                  Chargement...
                </>
              ) : (
                isLogin ? 'Se connecter' : 'Créer le compte'
              )}
            </button>
          </form>
          
          {/* Basculer entre connexion et inscription */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                clearError();
                setLocalError('');
              }}
              className="text-slate-400 hover:text-blue-400 transition-colors text-sm"
            >
              {isLogin ? (
                <>Pas encore de compte ? <span className="text-blue-400">Créer un compte</span></>
              ) : (
                <>Déjà un compte ? <span className="text-blue-400">Se connecter</span></>
              )}
            </button>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-6">
          SOMONE Studio © 2024
        </p>
      </div>
    </div>
  );
}


