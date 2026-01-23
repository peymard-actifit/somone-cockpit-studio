import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MuiIcon } from '../components/IconPicker';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [username, setUsername] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState('');

  // Vérifier la validité du token au chargement
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setErrorMessage('Lien invalide');
        setIsValidating(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/reset-password/${token}`);
        const data = await response.json();
        
        if (response.ok && data.valid) {
          setIsValid(true);
          setUsername(data.username || '');
          setExpiresAt(data.expiresAt || '');
        } else {
          setErrorMessage(data.error || 'Ce lien n\'est plus valide');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        setErrorMessage('Erreur de connexion au serveur');
      } finally {
        setIsValidating(false);
      }
    };
    
    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (!newPassword || newPassword.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/reset-password/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess(true);
      } else {
        setLocalError(data.error || 'Erreur lors de la réinitialisation');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setLocalError('Erreur de connexion au serveur');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Page de chargement
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cockpit-bg-dark via-slate-900 to-cockpit-bg-dark p-4">
        <div className="text-center">
          <MuiIcon name="HourglassEmpty" size={48} className="animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-white text-lg">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  // Page d'erreur (token invalide)
  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cockpit-bg-dark via-slate-900 to-cockpit-bg-dark p-4">
        <div className="bg-cockpit-bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MuiIcon name="Error" size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Lien invalide</h2>
          <p className="text-slate-400 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  // Page de succès
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cockpit-bg-dark via-slate-900 to-cockpit-bg-dark p-4">
        <div className="bg-cockpit-bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MuiIcon name="CheckCircle" size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Mot de passe modifié</h2>
          <p className="text-slate-400 mb-6">
            Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // Formulaire de réinitialisation
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
        
        {/* Carte de réinitialisation */}
        <div className="bg-cockpit-bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <MuiIcon name="VpnKey" size={24} className="text-blue-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-1">Nouveau mot de passe</h2>
            {username && (
              <p className="text-sm text-slate-400">
                Compte : <span className="text-blue-400 font-medium">{username}</span>
              </p>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nouveau mot de passe */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <MuiIcon name="LockIcon" size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <MuiIcon name="VisibilityOff" size={20} /> : <MuiIcon name="Visibility" size={20} />}
                </button>
              </div>
            </div>
            
            {/* Confirmer mot de passe */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <MuiIcon name="LockIcon" size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            {/* Erreur */}
            {localError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
                {localError}
              </div>
            )}
            
            {/* Info expiration */}
            {expiresAt && (
              <p className="text-xs text-slate-500 text-center">
                Ce lien expire le {new Date(expiresAt).toLocaleString('fr-FR')}
              </p>
            )}
            
            {/* Bouton submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {isSubmitting ? (
                <>
                  <MuiIcon name="HourglassEmpty" size={20} className="animate-spin" />
                  Modification en cours...
                </>
              ) : (
                'Changer le mot de passe'
              )}
            </button>
          </form>
          
          {/* Lien retour */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/auth')}
              className="text-slate-400 hover:text-blue-400 transition-colors text-sm"
            >
              Retour à la connexion
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
