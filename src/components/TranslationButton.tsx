import { useState, useEffect } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from './IconPicker';
// Composant Modal simple pour la traduction
const Modal = ({ title, children, onClose, onConfirm, confirmText, isLoading }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  isLoading?: boolean;
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-lg w-full mx-4">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
      <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        {onConfirm && (
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
            {confirmText || 'Confirmer'}
          </button>
        )}
      </div>
    </div>
  </div>
);

interface Language {
  code: string;
  name: string;
}

export default function TranslationButton({ cockpitId }: { cockpitId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('FR');
  const [isTranslating, setIsTranslating] = useState(false);
  const { currentCockpit, updateCockpit } = useCockpitStore();
  const { token, user } = useAuthStore();
  
  useEffect(() => {
    // Charger les langues disponibles avec fallback
    const loadLanguages = async () => {
      try {
        const response = await fetch('/api/translation/languages');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.languages && data.languages.length > 0) {
          setLanguages(data.languages);
        } else {
          // Fallback : langues par défaut si l'API ne retourne rien
          setLanguages([
            { code: 'FR', name: 'Français (Originale)' },
            { code: 'EN', name: 'English' },
            { code: 'DE', name: 'Deutsch' },
            { code: 'ES', name: 'Español' },
            { code: 'IT', name: 'Italiano' },
            { code: 'PT', name: 'Português' },
            { code: 'RU', name: 'Русский' },
            { code: 'JA', name: '日本語' },
            { code: 'ZH', name: '中文' },
            { code: 'NL', name: 'Nederlands' },
            { code: 'PL', name: 'Polski' },
            { code: 'AR', name: 'العربية' },
          ]);
        }
      } catch (err) {
        console.error('Erreur chargement langues:', err);
        // Fallback : langues par défaut en cas d'erreur
        setLanguages([
          { code: 'FR', name: 'Français (Originale)' },
          { code: 'EN', name: 'English' },
          { code: 'DE', name: 'Deutsch' },
          { code: 'ES', name: 'Español' },
          { code: 'IT', name: 'Italiano' },
          { code: 'PT', name: 'Português' },
          { code: 'RU', name: 'Русский' },
          { code: 'JA', name: '日本語' },
          { code: 'ZH', name: '中文' },
          { code: 'NL', name: 'Nederlands' },
          { code: 'PL', name: 'Polski' },
          { code: 'AR', name: 'العربية' },
        ]);
      }
    };
    
    loadLanguages();
  }, []);
  
  const handleTranslate = async () => {
    // Traduire ou restaurer (même route pour les deux cas)
    try {
      setIsTranslating(true);
      if (!token) {
        throw new Error('Vous devez être connecté pour traduire le cockpit');
      }
      
      const response = await fetch(`/api/cockpits/${cockpitId}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetLang: selectedLang,
          preserveOriginals: true, // Toujours préserver les originaux
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Erreur inconnue' };
        }
        console.error(`Erreur API (${response.status}):`, errorData);
        throw new Error(errorData.error || (selectedLang === 'FR' ? 'Erreur restauration' : 'Erreur traduction'));
      }
      
      const { translatedData } = await response.json();
      
      // Mettre à jour le cockpit avec les données traduites ou restaurées
      if (currentCockpit) {
        const updatedCockpit = {
          ...currentCockpit,
          ...translatedData, // Remplacer toutes les données
          domains: translatedData.domains || currentCockpit.domains,
        } as any;
        updateCockpit(updatedCockpit);
      }
      
      setShowModal(false);
    } catch (error: any) {
      console.error(`Erreur ${selectedLang === 'FR' ? 'restauration' : 'traduction'}:`, error);
      const errorMessage = error.message || 'Erreur inconnue';
      alert(`Erreur lors de la ${selectedLang === 'FR' ? 'restauration des textes originaux' : 'traduction'}: ${errorMessage}`);
    } finally {
      setIsTranslating(false);
    }
  };
  
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        title="Traduire le cockpit"
      >
        <MuiIcon name="Languages" size={16} />
        Traduction
      </button>
      
      {showModal && (
        <Modal
          title="Traduire le cockpit"
          onClose={() => setShowModal(false)}
          onConfirm={handleTranslate}
          confirmText={selectedLang === 'FR' ? 'Restaurer' : 'Traduire'}
          isLoading={isTranslating}
        >
          <div className="space-y-4">
            {!user || !token ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <MuiIcon name="AlertTriangle" size={16} className="text-red-400 mt-0.5" />
                  <p className="text-xs text-red-300">
                    Vous devez être connecté pour utiliser la traduction. Veuillez vous connecter ou rafraîchir la page.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-sm">
                Sélectionnez la langue vers laquelle traduire le cockpit. Les textes originaux seront sauvegardés automatiquement.
              </p>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Langue de traduction
              </label>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-2">
                <MuiIcon name="Info" size={16} className="text-blue-400 mt-0.5" />
                <p className="text-xs text-blue-300">
                  {selectedLang === 'FR' 
                    ? 'Vous pouvez revenir aux textes originaux en sélectionnant "Français (Originale)".'
                    : 'Les textes seront traduits dans la langue sélectionnée. Les textes originaux seront sauvegardés et pourront être restaurés à tout moment.'}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

