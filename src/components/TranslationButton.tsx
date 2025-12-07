import { useState, useEffect } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from './IconPicker';

// Composant Modal simple pour la traduction
const Modal = ({ title, children, onClose, onConfirm, confirmText, isLoading, showSaveButton, onSaveOriginals, isSavingOriginals }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  isLoading?: boolean;
  showSaveButton?: boolean;
  onSaveOriginals?: () => void;
  isSavingOriginals?: boolean;
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-lg w-full mx-4">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
      <div className="p-6 border-t border-slate-700 flex justify-between items-center">
        {/* Bouton pour figer la version actuelle */}
        {showSaveButton && onSaveOriginals && (
          <button
            onClick={onSaveOriginals}
            disabled={isLoading || isSavingOriginals}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            title="Figer la version actuelle comme originaux à restaurer"
          >
            {isSavingOriginals && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
            <MuiIcon name="Save" size={16} />
            Figer la version actuelle
          </button>
        )}
        {!showSaveButton && <div />}
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading || isSavingOriginals}
            className="px-4 py-2 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={isLoading || isSavingOriginals}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
              {confirmText || 'Confirmer'}
            </button>
          )}
        </div>
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
  const [isSavingOriginals, setIsSavingOriginals] = useState(false);
  const [hasOriginals, setHasOriginals] = useState(false);
  const { currentCockpit, updateCockpit, fetchCockpit } = useCockpitStore();
  const { token, user } = useAuthStore();
  
  // Charger les langues et vérifier si des originaux sont sauvegardés
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch('/api/translation/languages');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        // Toujours inclure le français dans la liste, indépendamment de la version sauvegardée
        const frenchLanguage: Language = { code: 'FR', name: 'Français' };
        
        if (data.languages && data.languages.length > 0) {
          // S'assurer que le français est dans la liste
          const languagesWithFrench = data.languages.filter((l: Language) => l.code !== 'FR');
          languagesWithFrench.unshift(frenchLanguage);
          setLanguages(languagesWithFrench);
        } else {
          // Fallback : langues par défaut
          setLanguages([
            { code: 'FR', name: 'Français' },
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
          { code: 'FR', name: 'Français' },
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
  
  // Vérifier si des originaux sont sauvegardés
  useEffect(() => {
    const checkOriginals = async () => {
      if (!cockpitId || !token) return;
      
      try {
        const response = await fetch(`/api/cockpits/${cockpitId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          const cockpit = await response.json();
          setHasOriginals(!!(cockpit.data && cockpit.data.originals));
        }
      } catch (err) {
        console.error('Erreur vérification originaux:', err);
      }
    };
    
    checkOriginals();
    // Re-vérifier quand le modal s'ouvre
    if (showModal) {
      checkOriginals();
    }
  }, [cockpitId, token, showModal]);
  
  // Sauvegarder explicitement la version actuelle comme originaux
  const handleSaveOriginals = async () => {
    try {
      setIsSavingOriginals(true);
      if (!token) {
        throw new Error('Vous devez être connecté');
      }
      
      const response = await fetch(`/api/cockpits/${cockpitId}/save-originals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Erreur inconnue' };
        }
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
      }
      
      setHasOriginals(true);
      alert('✅ Version actuelle sauvegardée comme originaux. Vous pourrez restaurer cette version en sélectionnant "Français".');
      
      // Recharger le cockpit pour mettre à jour les données
      if (fetchCockpit) {
        await fetchCockpit(cockpitId);
      }
    } catch (error: any) {
      console.error('Erreur sauvegarde originaux:', error);
      alert(`Erreur lors de la sauvegarde : ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsSavingOriginals(false);
    }
  };
  
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
      
      // Re-vérifier si des originaux sont sauvegardés après traduction
      setHasOriginals(selectedLang === 'FR' ? hasOriginals : true);
      
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
          showSaveButton={true}
          onSaveOriginals={handleSaveOriginals}
          isSavingOriginals={isSavingOriginals}
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
              <>
                {!hasOriginals && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-start gap-2">
                      <MuiIcon name="AlertTriangle" size={16} className="text-amber-400 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        ⚠️ Aucune version n'est sauvegardée pour restauration. Si vous traduisez maintenant, la version actuelle sera automatiquement sauvegardée. Vous pouvez aussi cliquer sur "Figer la version actuelle" pour sauvegarder explicitement.
                      </p>
                    </div>
                  </div>
                )}
                
                <p className="text-slate-300 text-sm">
                  Sélectionnez la langue vers laquelle traduire le cockpit. Le français permet de restaurer la dernière version sauvegardée.
                </p>
              </>
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
                    ? hasOriginals
                      ? 'Vous allez restaurer la dernière version sauvegardée en français.'
                      : 'Aucune version n\'est sauvegardée. La version actuelle sera sauvegardée automatiquement.'
                    : 'Les textes seront traduits dans la langue sélectionnée. Si aucune version n\'est sauvegardée, la version actuelle le sera automatiquement avant la traduction.'}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
