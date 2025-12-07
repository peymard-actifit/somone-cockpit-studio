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
  
  // Fonction pour charger les langues avec l'option "Restaurer" si nécessaire
  const loadLanguagesWithRestore = async (hasOriginalsValue: boolean) => {
    try {
      const response = await fetch('/api/translation/languages');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      
      const frenchLanguage: Language = { code: 'FR', name: 'Français' };
      const restoreOption: Language | null = hasOriginalsValue ? { code: 'Restauration', name: '🔙 Restauration' } : null;
      
      if (data.languages && data.languages.length > 0) {
        const languagesWithFrench = data.languages.filter((l: Language) => l.code !== 'FR');
        languagesWithFrench.unshift(frenchLanguage);
        if (restoreOption) {
          languagesWithFrench.unshift(restoreOption);
        }
        setLanguages(languagesWithFrench);
      } else {
        const defaultLanguages: Language[] = [
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
        ];
        if (restoreOption) {
          defaultLanguages.unshift(restoreOption);
        }
        setLanguages(defaultLanguages);
      }
    } catch (err) {
      console.error('Erreur chargement langues:', err);
      // Fallback : langues par défaut en cas d'erreur
      const defaultLanguages: Language[] = [
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
      ];
      if (hasOriginalsValue) {
        defaultLanguages.unshift({ code: 'Restauration', name: '🔙 Restauration' });
      }
      setLanguages(defaultLanguages);
    }
  };
  
  // Charger les langues initialement
  useEffect(() => {
    loadLanguagesWithRestore(hasOriginals);
  }, [hasOriginals]);
  
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
          const hasOriginalsValue = !!(cockpit.data && cockpit.data.originals);
          setHasOriginals(hasOriginalsValue);
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
      alert('✅ Version actuelle sauvegardée. Vous pourrez restaurer cette version à tout moment en sélectionnant "Restauration" dans la liste des langues.');
      
      // Recharger le cockpit pour mettre à jour les données
      if (fetchCockpit) {
        await fetchCockpit(cockpitId);
      }
      
      // Recharger les langues pour ajouter l'option "Restaurer" sans recharger la page
      // Le useEffect avec showModal va se déclencher automatiquement
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
      
      // Si "Restauration" est sélectionné, utiliser 'Restauration' comme targetLang
      const targetLangToSend = selectedLang === 'Restauration' ? 'Restauration' : selectedLang;
      
      const response = await fetch(`/api/cockpits/${cockpitId}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetLang: targetLangToSend,
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
        const actionText = selectedLang === 'Restauration' ? 'restauration' : 'traduction';
        throw new Error(errorData.error || `Erreur ${actionText}`);
      }
      
      const { translatedData } = await response.json();
      
      // Mettre à jour le cockpit avec les données traduites ou restaurées
      // IMPORTANT: Remplacer COMPLÈTEMENT les données pour garantir que tout est mis à jour
      if (currentCockpit && translatedData) {
        // Créer un nouveau cockpit avec toutes les données traduites/restaurées
        // En préservant les métadonnées (id, userId, createdAt, etc.)
        const updatedCockpit = {
          id: currentCockpit.id,
          name: currentCockpit.name,
          userId: currentCockpit.userId,
          createdAt: currentCockpit.createdAt,
          updatedAt: new Date().toISOString(),
          // Remplacer TOUTES les données par celles traduites/restaurées
          domains: translatedData.domains || [],
          zones: translatedData.zones || [],
          scrollingBanner: translatedData.scrollingBanner,
          logo: currentCockpit.logo,
          publicId: currentCockpit.publicId,
        } as any;
        
        // Vérifier que les domaines contiennent bien les éléments traduits
        if (updatedCockpit.domains && updatedCockpit.domains.length > 0) {
          const firstDomain = updatedCockpit.domains[0];
          if (firstDomain.categories && firstDomain.categories.length > 0) {
            const firstCategory = firstDomain.categories[0];
            if (firstCategory.elements && firstCategory.elements.length > 0) {
              const firstElement = firstCategory.elements[0];
              console.log('[Translation] Avant updateCockpit - Premier élément:', {
                id: firstElement.id,
                name: firstElement.name,
              });
            }
          }
        }
        
        console.log('[Translation] Mise à jour du cockpit avec données traduites/restaurées:', {
          domainsCount: updatedCockpit.domains.length,
          zonesCount: updatedCockpit.zones?.length || 0,
        });
        
        updateCockpit(updatedCockpit);
        
        // Vérifier après mise à jour
        setTimeout(() => {
          const { currentCockpit } = useCockpitStore.getState();
          if (currentCockpit && currentCockpit.domains && currentCockpit.domains.length > 0) {
            const firstDomain = currentCockpit.domains[0];
            if (firstDomain.categories && firstDomain.categories.length > 0) {
              const firstCategory = firstDomain.categories[0];
              if (firstCategory.elements && firstCategory.elements.length > 0) {
                const firstElement = firstCategory.elements[0];
                console.log('[Translation] Après updateCockpit dans le store - Premier élément:', {
                  id: firstElement.id,
                  name: firstElement.name,
                });
              }
            }
          }
        }, 100);
        
        // Forcer un rechargement du cockpit depuis le serveur pour s'assurer que tout est synchronisé
        if (fetchCockpit) {
          setTimeout(async () => {
            await fetchCockpit(cockpitId);
          }, 500);
        }
      }
      
      // Re-vérifier si des originaux sont sauvegardés après traduction
      if (selectedLang !== 'Restauration') {
        setHasOriginals(true);
      }
      
      setShowModal(false);
    } catch (error: any) {
      console.error(`Erreur ${selectedLang === 'Restauration' ? 'restauration' : 'traduction'}:`, error);
      const errorMessage = error.message || 'Erreur inconnue';
      const actionText = selectedLang === 'Restauration' ? 'restauration' : 'traduction';
      alert(`Erreur lors de la ${actionText}: ${errorMessage}`);
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
          confirmText={selectedLang === 'Restauration' ? 'Restaurer' : 'Traduire'}
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
                  Sélectionnez la langue vers laquelle traduire le cockpit ou choisissez "Restauration" pour restaurer la dernière version sauvegardée.
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
                  {selectedLang === 'Restauration'
                    ? 'Vous allez restaurer la dernière version sauvegardée. Tous les textes reviendront à la version que vous avez figée précédemment (peut être dans n\'importe quelle langue).'
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
