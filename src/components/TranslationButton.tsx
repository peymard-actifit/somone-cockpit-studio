import { useState, useEffect } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from './IconPicker';

// Interface pour représenter un changement de traduction
interface TranslationChange {
  id: string; // ID unique de l'élément (ex: "domainId|categoryId|elementId|field")
  path: string; // Chemin hiérarchique (ex: "Domaine > Catégorie > Élément")
  field: string; // Nom du champ (name, description, etc.)
  original: string; // Texte original
  translated: string; // Texte traduit
  editable: boolean; // Peut être édité
}

// Composant Modal pour l'aperçu de traduction
const TranslationPreviewModal = ({
  changes,
  onApply,
  onCancel,
  isLoading,
}: {
  changes: TranslationChange[];
  onApply: (editedChanges: TranslationChange[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const [editedChanges, setEditedChanges] = useState<TranslationChange[]>(changes);

  useEffect(() => {
    setEditedChanges(changes);
  }, [changes]);

  const handleChange = (index: number, newValue: string) => {
    const updated = [...editedChanges];
    updated[index] = { ...updated[index], translated: newValue };
    setEditedChanges(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Aperçu de la traduction</h2>
          <p className="text-sm text-slate-400 mt-1">
            Vérifiez et modifiez les traductions avant de les appliquer
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {editedChanges.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                Aucune traduction nécessaire
              </p>
            ) : (
              <>
                {/* En-têtes du tableau */}
                <div className="grid grid-cols-12 gap-4 pb-2 border-b border-slate-700">
                  <div className="col-span-3 text-sm font-medium text-slate-400">Désignation</div>
                  <div className="col-span-4 text-sm font-medium text-slate-400">Version actuelle</div>
                  <div className="col-span-5 text-sm font-medium text-slate-400">Version traduite</div>
                </div>
                {/* Lignes de traduction */}
                {editedChanges.map((change, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start py-2 border-b border-slate-700/50">
                    <div className="col-span-3 text-sm text-slate-300">
                      <div className="font-medium">{change.path}</div>
                      <div className="text-xs text-slate-500 mt-1">{change.field}</div>
                    </div>
                    <div className="col-span-4 text-sm text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-700">
                      {change.original}
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={change.translated}
                        onChange={(e) => handleChange(index, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                        disabled={!change.editable || isLoading}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onApply(editedChanges)}
            disabled={isLoading || editedChanges.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
            Appliquer la traduction
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal simple pour la traduction
const Modal = ({
  title,
  children,
  onClose,
  onConfirm,
  confirmText,
  isLoading,
  showSaveButton,
  onSaveOriginals,
  isSavingOriginals,
  showRestoreButton,
  onRestore,
  isRestoring,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  isLoading?: boolean;
  showSaveButton?: boolean;
  onSaveOriginals?: () => void;
  isSavingOriginals?: boolean;
  showRestoreButton?: boolean;
  onRestore?: () => void;
  isRestoring?: boolean;
}) => {
  // Log pour déboguer l'affichage du bouton restaurer
  console.log('[Modal] Rendu - showRestoreButton =', showRestoreButton, 'onRestore =', !!onRestore);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-lg w-full mx-4">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
      <div className="p-6 border-t border-slate-700 flex justify-between items-center gap-3">
        {/* Boutons de gauche : Figer et Restaurer */}
        <div className="flex gap-3">
          {showSaveButton && onSaveOriginals && (
            <button
              onClick={onSaveOriginals}
              disabled={isLoading || isSavingOriginals || isRestoring}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Figer la version actuelle comme originaux à restaurer"
            >
              {isSavingOriginals && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
              <MuiIcon name="Save" size={16} />
              Figer
            </button>
          )}
          {showRestoreButton && onRestore ? (
            <button
              onClick={onRestore}
              disabled={isLoading || isSavingOriginals || isRestoring}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Restaurer la version sauvegardée"
            >
              {isRestoring && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
              <MuiIcon name="Undo" size={16} />
              Restaurer
            </button>
          ) : null}
        </div>
        
        {/* Boutons de droite : Annuler et Confirmer */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading || isSavingOriginals || isRestoring}
            className="px-4 py-2 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={isLoading || isSavingOriginals || isRestoring}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
              {confirmText || 'Confirmer'}
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

interface Language {
  code: string;
  name: string;
}

export default function TranslationButton({ cockpitId }: { cockpitId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('FR');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSavingOriginals, setIsSavingOriginals] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasOriginals, setHasOriginals] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<TranslationChange[]>([]);
  const { currentCockpit, updateCockpit, fetchCockpit } = useCockpitStore();
  const { token, user } = useAuthStore();

  // Fonction pour charger les langues (sans l'option Restaurer, maintenant gérée par le bouton)
  const loadLanguages = async () => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch('/api/translation/languages', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      
      const frenchLanguage: Language = { code: 'FR', name: 'Français' };
      
      if (data.languages && data.languages.length > 0) {
        const languagesWithFrench = data.languages.filter((l: Language) => l.code !== 'FR');
        languagesWithFrench.unshift(frenchLanguage);
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
      setLanguages(defaultLanguages);
    }
  };
  
  // Charger les langues initialement
  useEffect(() => {
    loadLanguages();
  }, []);
  
  // Vérifier si des originaux sont sauvegardés - au chargement et à chaque ouverture du modal
  useEffect(() => {
    const checkOriginals = async () => {
      if (!cockpitId || !token) return;
      
      try {
        // D'abord vérifier dans currentCockpit du store (plus rapide)
        if (currentCockpit && (currentCockpit as any).originals) {
          const hasOriginalsValue = !!(currentCockpit as any).originals;
          // console.log('[Translation] Originaux trouvés dans currentCockpit:', hasOriginalsValue);
          setHasOriginals(hasOriginalsValue);
          return;
        }
        
        // Sinon, vérifier via l'API
        const response = await fetch(`/api/cockpits/${cockpitId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          const cockpit = await response.json();
          // IMPORTANT: Les données sont spread dans la réponse API, donc originals est directement dans cockpit, pas dans cockpit.data
          const hasOriginalsValue = !!(cockpit.originals);
          // console.log('[Translation] Vérification originaux:', hasOriginalsValue, '(modal ouvert:', showModal, ')');
          // console.log('[Translation] Détails cockpit:', Object.keys(cockpit));
          // console.log('[Translation] Détails cockpit.originals:', cockpit.originals ? 'présent' : 'absent');
          if (cockpit.originals) {
            // console.log('[Translation] Taille originaux:', JSON.stringify(cockpit.originals).length, 'caractères');
          }
          setHasOriginals(hasOriginalsValue);
          // console.log('[Translation] État hasOriginals mis à jour à:', hasOriginalsValue);
        } else {
          console.warn('[Translation] Réponse API non OK:', response.status);
        }
      } catch (err) {
        console.error('Erreur vérification originaux:', err);
      }
    };
    
    // Vérifier au chargement initial
    checkOriginals();
    
    // Re-vérifier à chaque fois que le modal s'ouvre
    if (showModal) {
      checkOriginals();
    }
  }, [cockpitId, token, showModal, currentCockpit]);
  
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
      
      // Vérifier immédiatement les originaux après la sauvegarde
      // console.log('[Translation] ✅ Sauvegarde réussie, vérification des originaux...');
      
      try {
        const checkResponse = await fetch(`/api/cockpits/${cockpitId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (checkResponse.ok) {
          const cockpit = await checkResponse.json();
          // IMPORTANT: Les données sont spread dans la réponse API, donc originals est directement dans cockpit, pas dans cockpit.data
          const hasOriginalsValue = !!(cockpit.originals);
          // console.log('[Translation] Vérification API après figement: originaux présents =', hasOriginalsValue);
          // console.log('[Translation] Détails cockpit:', Object.keys(cockpit));
          // console.log('[Translation] Détails cockpit.originals:', cockpit.originals ? 'présent' : 'absent');
          
          // Toujours mettre à jour avec la valeur de l'API pour être sûr
          setHasOriginals(hasOriginalsValue);
          
          // Forcer un re-render si nécessaire
          if (hasOriginalsValue) {
            // console.log('[Translation] ✅ hasOriginals mis à jour à true, le bouton restaurer devrait apparaître');
          } else {
            // console.log('[Translation] ⚠️ hasOriginals est false, vérifier pourquoi les originaux ne sont pas présents');
          }
        } else {
          // Si la vérification échoue, on suppose que la sauvegarde a réussi
          // console.log('[Translation] ⚠️ Vérification échouée (status:', checkResponse.status, '), on suppose que la sauvegarde a réussi');
          setHasOriginals(true);
        }
      } catch (err) {
        console.error('[Translation] Erreur vérification originaux:', err);
        // En cas d'erreur, on suppose que la sauvegarde a réussi
        setHasOriginals(true);
      }
      
      // Recharger le cockpit pour mettre à jour les données (en arrière-plan)
      if (fetchCockpit) {
        fetchCockpit(cockpitId);
      }
      
      // Ne pas fermer le modal, ne pas afficher d'alert
      // Le modal reste ouvert pour permettre de continuer à travailler
      // console.log('[Translation] ✅ Figement terminé, modal reste ouvert');
    } catch (error: any) {
      console.error('Erreur sauvegarde originaux:', error);
      alert(`Erreur lors de la sauvegarde : ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsSavingOriginals(false);
    }
  };
  
  // Surveiller currentCockpit pour mettre à jour hasOriginals quand le cockpit change
  useEffect(() => {
    if (currentCockpit && (currentCockpit as any).originals) {
      const hasOriginalsValue = !!(currentCockpit as any).originals;
      // console.log('[Translation] Originaux détectés dans currentCockpit:', hasOriginalsValue);
      if (hasOriginalsValue !== hasOriginals) {
        setHasOriginals(hasOriginalsValue);
      }
    } else if (currentCockpit && !(currentCockpit as any).originals && hasOriginals) {
      // Si currentCockpit n'a pas d'originaux mais hasOriginals est true, vérifier via l'API
      // console.log('[Translation] currentCockpit n\'a pas d\'originaux, vérification via API...');
      const checkOriginals = async () => {
        if (!cockpitId || !token) return;
        try {
          const response = await fetch(`/api/cockpits/${cockpitId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
            const cockpit = await response.json();
            const hasOriginalsValue = !!(cockpit.originals);
            setHasOriginals(hasOriginalsValue);
          }
        } catch (err) {
          console.error('[Translation] Erreur vérification originaux depuis currentCockpit:', err);
        }
      };
      checkOriginals();
    }
  }, [currentCockpit, cockpitId, token, hasOriginals]);

  // Restaurer la version sauvegardée
  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      if (!token) {
        throw new Error('Vous devez être connecté');
      }

      const response = await fetch(`/api/cockpits/${cockpitId}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetLang: 'Restauration',
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
        throw new Error(errorData.error || 'Erreur lors de la restauration');
      }

      const { translatedData } = await response.json();

      if (currentCockpit && translatedData) {
        const updatedCockpit = {
          id: currentCockpit.id,
          name: currentCockpit.name,
          userId: currentCockpit.userId,
          createdAt: currentCockpit.createdAt,
          updatedAt: new Date().toISOString(),
          domains: translatedData.domains || [],
          zones: translatedData.zones || [],
          scrollingBanner: translatedData.scrollingBanner,
          logo: currentCockpit.logo,
          publicId: currentCockpit.publicId,
        } as any;

        updateCockpit(updatedCockpit);

        if (fetchCockpit) {
          setTimeout(async () => {
            await fetchCockpit(cockpitId);
          }, 500);
        }
      }

      // Vérifier les originaux après restauration
      try {
        const checkResponse = await fetch(`/api/cockpits/${cockpitId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (checkResponse.ok) {
          const cockpit = await checkResponse.json();
          // IMPORTANT: Les données sont spread dans la réponse API, donc originals est directement dans cockpit, pas dans cockpit.data
          const hasOriginalsValue = !!(cockpit.originals);
          // console.log('[Translation] Vérification après restauration: originaux présents =', hasOriginalsValue);
          setHasOriginals(hasOriginalsValue);
        }
      } catch (err) {
        console.error('[Translation] Erreur vérification originaux après restauration:', err);
      }
      
      // Ne pas fermer le modal, ne pas afficher d'alert
    } catch (error: any) {
      console.error('Erreur restauration:', error);
      alert(`Erreur lors de la restauration : ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsRestoring(false);
    }
  };


  // Fonction pour appliquer les traductions modifiées aux données en utilisant les IDs
  const applyEditedTranslations = (data: any, changes: TranslationChange[]): any => {
    // Créer un mapping par ID : id -> valeur traduite
    const changeMap = new Map<string, string>();
    changes.forEach(change => {
      // Utiliser l'ID unique plutôt que le chemin (les noms peuvent changer)
      changeMap.set(change.id, change.translated);
    });

    // Fonction récursive pour appliquer les changements en utilisant les IDs
    const applyRecursive = (obj: any, idParts: string[] = []): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => {
          if (item && typeof item === 'object') {
            const itemId = item.id || '';
            return applyRecursive(item, itemId ? [...idParts, itemId] : idParts);
          }
          return item;
        });
      }

      const result: any = { ...obj };

      // Traiter scrollingBanner au niveau racine
      if ('scrollingBanner' in obj && typeof obj.scrollingBanner === 'string') {
        const id = 'cockpit-root';
        if (changeMap.has(`${id}|scrollingBanner`)) {
          result.scrollingBanner = changeMap.get(`${id}|scrollingBanner`);
        }
      }

      // Construire l'ID complet pour cet objet
      const currentId = idParts.length > 0 ? idParts.join('|') : null;
      const objId = obj.id || '';

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'originals' || key === 'id') {
          continue; // Conserver l'ID et ignorer originals
        }

        const textFields = ['name', 'description', 'actions', 'unit', 'duration', 'ticketNumber', 'zone', 'address', 'templateName', 'value'];
        
        if (textFields.includes(key) && typeof value === 'string') {
          // Construire l'ID complet pour ce champ
          let fieldId: string;
          if (key === 'scrollingBanner') {
            fieldId = 'cockpit-root|scrollingBanner';
          } else if (currentId) {
            fieldId = `${currentId}|${key}`;
          } else if (objId) {
            fieldId = `${objId}|${key}`;
          } else {
            fieldId = key; // Fallback
          }
          
          // Chercher dans changeMap par ID
          if (changeMap.has(fieldId)) {
            result[key] = changeMap.get(fieldId);
          }
        } else if (value && typeof value === 'object') {
          if (key === 'domains' && Array.isArray(value)) {
            result[key] = value.map((domain: any) => 
              applyRecursive(domain, domain.id ? [domain.id] : [])
            );
          } else if (key === 'categories' && Array.isArray(value)) {
            result[key] = value.map((category: any) => 
              applyRecursive(category, category.id ? [...idParts, category.id] : idParts)
            );
          } else if (key === 'elements' && Array.isArray(value)) {
            result[key] = value.map((element: any) => 
              applyRecursive(element, element.id ? [...idParts, element.id] : idParts)
            );
          } else if (key === 'subCategories' && Array.isArray(value)) {
            result[key] = value.map((subCategory: any) => 
              applyRecursive(subCategory, subCategory.id ? [...idParts, subCategory.id] : idParts)
            );
          } else if (key === 'subElements' && Array.isArray(value)) {
            result[key] = value.map((subElement: any) => 
              applyRecursive(subElement, subElement.id ? [...idParts, subElement.id] : idParts)
            );
          } else if (key === 'zones' && Array.isArray(value)) {
            result[key] = value.map((zone: any) => 
              applyRecursive(zone, zone.id ? [zone.id] : [])
            );
          } else {
            result[key] = applyRecursive(value, idParts);
          }
        }
      }
      return result;
    };

    return applyRecursive(data);
  };

  // Fonction pour extraire les champs avec leurs IDs pour faciliter la correspondance
  interface FieldWithId {
    id: string;
    path: string;
    field: string;
    value: string;
  }

  const extractFieldsWithIds = (data: any, _pathParts: string[] = [], fields: FieldWithId[] = []): FieldWithId[] => {
    if (!data || typeof data !== 'object') return fields;

    const textFields = ['name', 'description', 'actions', 'scrollingBanner', 'unit', 'duration', 'ticketNumber', 'zone', 'address', 'templateName'];

    // Traiter scrollingBanner au niveau racine
    if (data.scrollingBanner && typeof data.scrollingBanner === 'string' && data.scrollingBanner.trim() !== '') {
      fields.push({
        id: 'cockpit-root',
        path: 'Bannière défilante',
        field: 'scrollingBanner',
        value: data.scrollingBanner,
      });
    }

    // Traiter les domaines
    if (data.domains && Array.isArray(data.domains)) {
      (data.domains || []).forEach((domain: any) => {
        const domainPath = [domain.name || domain.id || 'Domaine'];
        const domainId = domain.id || `domain-${domainPath[0]}`;

        textFields.forEach(field => {
          if (domain[field] && typeof domain[field] === 'string' && domain[field].trim() !== '') {
            fields.push({
              id: `${domainId}|${field}`,
              path: domainPath.join(' > '),
              field,
              value: domain[field],
            });
          }
        });

        // Traiter les catégories
        if (domain.categories && Array.isArray(domain.categories)) {
          (domain.categories || []).forEach((category: any) => {
            const categoryPath = [...domainPath, category.name || category.id || 'Catégorie'];
            const categoryId = category.id || `category-${categoryPath[categoryPath.length - 1]}`;

            textFields.forEach(field => {
              if (category[field] && typeof category[field] === 'string' && category[field].trim() !== '') {
                fields.push({
                  id: `${domainId}|${categoryId}|${field}`,
                  path: categoryPath.join(' > '),
                  field,
                  value: category[field],
                });
              }
            });

            // Traiter les éléments
            if (category.elements && Array.isArray(category.elements)) {
              (category.elements || []).forEach((element: any) => {
                const elementPath = [...categoryPath, element.name || element.id || 'Élément'];
                const elementId = element.id || `element-${elementPath[elementPath.length - 1]}`;

                textFields.forEach(field => {
                  if (element[field] && typeof element[field] === 'string' && element[field].trim() !== '') {
                    fields.push({
                      id: `${domainId}|${categoryId}|${elementId}|${field}`,
                      path: elementPath.join(' > '),
                      field,
                      value: element[field],
                    });
                  }
                });

                // Traiter value (si c'est un texte)
                if (element.value && typeof element.value === 'string' && element.value.trim() !== '') {
                  const numValue = parseFloat(element.value);
                  if (isNaN(numValue)) {
                    fields.push({
                      id: `${domainId}|${categoryId}|${elementId}|value`,
                      path: elementPath.join(' > '),
                      field: 'value',
                      value: element.value,
                    });
                  }
                }

                // Traiter les sous-catégories
                if (element.subCategories && Array.isArray(element.subCategories)) {
                  (element.subCategories || []).forEach((subCategory: any) => {
                    const subCategoryPath = [...elementPath, subCategory.name || subCategory.id || 'Sous-catégorie'];
                    const subCategoryId = subCategory.id || `subcategory-${subCategoryPath[subCategoryPath.length - 1]}`;

                    textFields.forEach(field => {
                      if (subCategory[field] && typeof subCategory[field] === 'string' && subCategory[field].trim() !== '') {
                        fields.push({
                          id: `${domainId}|${categoryId}|${elementId}|${subCategoryId}|${field}`,
                          path: subCategoryPath.join(' > '),
                          field,
                          value: subCategory[field],
                        });
                      }
                    });

                    // Traiter les sous-éléments
                    if (subCategory.subElements && Array.isArray(subCategory.subElements)) {
                      (subCategory.subElements || []).forEach((subElement: any) => {
                        const subElementPath = [...subCategoryPath, subElement.name || subElement.id || 'Sous-élément'];
                        const subElementId = subElement.id || `subelement-${subElementPath[subElementPath.length - 1]}`;

                        textFields.forEach(field => {
                          if (subElement[field] && typeof subElement[field] === 'string' && subElement[field].trim() !== '') {
                            fields.push({
                              id: `${domainId}|${categoryId}|${elementId}|${subCategoryId}|${subElementId}|${field}`,
                              path: subElementPath.join(' > '),
                              field,
                              value: subElement[field],
                            });
                          }
                        });

                        // Traiter value des sous-éléments
                        if (subElement.value && typeof subElement.value === 'string' && subElement.value.trim() !== '') {
                          const numValue = parseFloat(subElement.value);
                          if (isNaN(numValue)) {
                            fields.push({
                              id: `${domainId}|${categoryId}|${elementId}|${subCategoryId}|${subElementId}|value`,
                              path: subElementPath.join(' > '),
                              field: 'value',
                              value: subElement.value,
                            });
                          }
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    // Traiter les zones
    if (data.zones && Array.isArray(data.zones)) {
      data.zones.forEach((zone: any) => {
        if (zone.name && typeof zone.name === 'string' && zone.name.trim() !== '') {
          const zoneId = zone.id || `zone-${zone.name}`;
          fields.push({
            id: `${zoneId}|name`,
            path: `Zone: ${zone.name}`,
            field: 'name',
            value: zone.name,
          });
        }
      });
    }

    return fields;
  };

  // Préparer l'aperçu de traduction
  const handlePreparePreview = async () => {
    if (!currentCockpit || !token) return;
    
    try {
      setIsTranslating(true);
      
      // Obtenir les données traduites depuis l'API (sans les appliquer)
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
        throw new Error('Erreur lors de la préparation de la traduction');
      }

      const { translatedData } = await response.json();
      
      console.log('[Translation Preview] Données actuelles:', currentCockpit);
      console.log('[Translation Preview] Données traduites:', translatedData);
      
      // Extraire les champs avec IDs depuis les données actuelles
      const currentFields = extractFieldsWithIds(currentCockpit);
      
      // Extraire les champs avec IDs depuis les données traduites
      const translatedFields = extractFieldsWithIds(translatedData);
      
      console.log('[Translation Preview] Champs actuels:', currentFields.length);
      console.log('[Translation Preview] Champs traduits:', translatedFields.length);
      
      // Créer un mapping par ID pour faire correspondre les champs
      const changesMap = new Map<string, TranslationChange>();
      
      // Remplir avec les champs actuels
      currentFields.forEach(field => {
        changesMap.set(field.id, {
          id: field.id, // IMPORTANT: Stocker l'ID pour l'application des changements
          path: field.path,
          field: field.field,
          original: field.value,
          translated: field.value, // Par défaut, même valeur (sera remplacé par la traduction)
          editable: true,
        });
      });
      
      // Mettre à jour avec les valeurs traduites
      translatedFields.forEach(translatedField => {
        if (changesMap.has(translatedField.id)) {
          const existing = changesMap.get(translatedField.id)!;
          existing.translated = translatedField.value;
        } else {
          // Nouveau champ dans la traduction
          changesMap.set(translatedField.id, {
            id: translatedField.id,
            path: translatedField.path,
            field: translatedField.field,
            original: translatedField.value,
            translated: translatedField.value,
            editable: true,
          });
        }
      });
      
      // AFFICHER TOUS LES ÉLÉMENTS, même ceux qui n'ont pas changé
      // Cela permet à l'utilisateur de voir et modifier toutes les traductions
      const finalChanges = Array.from(changesMap.values());
      
      console.log('[Translation Preview] Éléments à afficher:', finalChanges.length);
      console.log('[Translation Preview] Champs actuels extraits:', currentFields.length);
      console.log('[Translation Preview] Champs traduits extraits:', translatedFields.length);
      
      if (finalChanges.length > 0) {
        finalChanges.slice(0, 5).forEach(change => {
          console.log(`  - ${change.path} > ${change.field}: "${change.original.substring(0, 30)}..." -> "${change.translated.substring(0, 30)}..."`);
        });
        if (finalChanges.length > 5) {
          console.log(`  ... et ${finalChanges.length - 5} autres éléments`);
        }
      } else {
        console.warn('[Translation Preview] ⚠️ Aucun élément trouvé à traduire !');
      }
      
      setPreviewChanges(finalChanges);
      
      // Fermer le modal principal et ouvrir le modal d'aperçu
      setShowModal(false);
      setShowPreviewModal(true);
    } catch (error: any) {
      console.error('Erreur préparation aperçu:', error);
      alert(`Erreur : ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Appliquer les traductions éditées
  const handleApplyTranslation = async (editedChanges: TranslationChange[]) => {
    try {
      setIsTranslating(true);
      
      if (!currentCockpit || !token) return;

      // Obtenir les données traduites depuis l'API
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
        throw new Error('Erreur lors de la traduction');
      }

      const { translatedData } = await response.json();
      
      // Appliquer les modifications manuelles
      const finalData = applyEditedTranslations(translatedData, editedChanges);

      // Sauvegarder les données traduites dans la base de données
      const saveResponse = await fetch(`/api/cockpits/${cockpitId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: currentCockpit.name,
          domains: finalData.domains || [],
          zones: finalData.zones || [],
          scrollingBanner: finalData.scrollingBanner,
          logo: currentCockpit.logo,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Erreur lors de la sauvegarde de la traduction');
      }

      // Mettre à jour le cockpit dans le store
      const updatedCockpit = {
        ...currentCockpit,
        domains: finalData.domains || [],
        zones: finalData.zones || [],
        scrollingBanner: finalData.scrollingBanner,
        updatedAt: new Date().toISOString(),
      } as any;

      updateCockpit(updatedCockpit);

      // Recharger le cockpit pour s'assurer que tout est synchronisé
      if (fetchCockpit) {
        await fetchCockpit(cockpitId);
      }
      
      // IMPORTANT: Vérifier que les originaux sont toujours présents après la traduction
      // Les originaux doivent être préservés dans la base de données même après traduction
      try {
        const checkResponse = await fetch(`/api/cockpits/${cockpitId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (checkResponse.ok) {
          const cockpit = await checkResponse.json();
          const hasOriginalsValue = !!(cockpit.originals);
          // console.log('[Translation] Vérification originaux après traduction:', hasOriginalsValue);
          if (hasOriginalsValue !== hasOriginals) {
            setHasOriginals(hasOriginalsValue);
            // console.log('[Translation] hasOriginals mis à jour après traduction:', hasOriginalsValue);
          }
        }
      } catch (err) {
        console.error('[Translation] Erreur vérification originaux après traduction:', err);
      }

      // Fermer seulement le modal d'aperçu, pas le modal principal
      setShowPreviewModal(false);
      
      // Rouvrir le modal principal pour permettre de continuer à travailler
      setShowModal(true);
    } catch (error: any) {
      console.error('Erreur application traduction:', error);
      alert(`Erreur : ${error.message || 'Erreur inconnue'}`);
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
        <MuiIcon name="Language" size={16} />
        Traduction
      </button>
      
      {showModal && (
        <Modal
          key={`translation-modal-${cockpitId}-${hasOriginals ? 'has-originals' : 'no-originals'}`}
          title="Traduire le cockpit"
          onClose={() => setShowModal(false)}
          onConfirm={handlePreparePreview}
          confirmText="Traduire"
          isLoading={isTranslating}
          showSaveButton={true}
          onSaveOriginals={handleSaveOriginals}
          isSavingOriginals={isSavingOriginals}
          showRestoreButton={!!hasOriginals}
          onRestore={handleRestore}
          isRestoring={isRestoring}
        >
          <div className="space-y-4">
            {!user || !token ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <MuiIcon name="Warning" size={16} className="text-red-400 mt-0.5" />
                  <p className="text-xs text-red-300">
                    Vous devez être connecté pour utiliser la traduction. Veuillez vous connecter ou rafraîchir la page.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Ne plus afficher le message d'avertissement si hasOriginals est true */}
                
                <p className="text-slate-300 text-sm">
                  Sélectionnez la langue vers laquelle traduire le cockpit.
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
                  Un aperçu des traductions sera affiché avant application. Vous pourrez modifier chaque traduction avant de l'appliquer.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showPreviewModal && (
        <TranslationPreviewModal
          changes={previewChanges}
          onApply={handleApplyTranslation}
          onCancel={() => {
            setShowPreviewModal(false);
            setShowModal(true);
          }}
          isLoading={isTranslating}
        />
      )}
    </>
  );
}
