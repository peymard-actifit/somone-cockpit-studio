import { useState, useEffect } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from './IconPicker';

// Interface pour représenter un changement de traduction
interface TranslationChange {
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
            {isLoading && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
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
}) => (
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
              {isSavingOriginals && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
              <MuiIcon name="Save" size={16} />
              Figer
            </button>
          )}
          {showRestoreButton && onRestore && (
            <button
              onClick={onRestore}
              disabled={isLoading || isSavingOriginals || isRestoring}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Restaurer la version sauvegardée"
            >
              {isRestoring && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
              <MuiIcon name="RotateCcw" size={16} />
              Restaurer
            </button>
          )}
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
      const response = await fetch('/api/translation/languages');
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
      alert('✅ Version actuelle sauvegardée. Vous pourrez restaurer cette version à tout moment avec le bouton "Restaurer".');
      
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

      setShowModal(false);
      alert('✅ Version sauvegardée restaurée avec succès.');
    } catch (error: any) {
      console.error('Erreur restauration:', error);
      alert(`Erreur lors de la restauration : ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Fonction récursive pour extraire tous les champs textuels avec leurs chemins complets
  const extractTextFields = (
    data: any,
    _parentPath: string[] = [],
    changes: TranslationChange[] = [],
    useTranslated: boolean = false
  ): TranslationChange[] => {
    const textFields = ['name', 'description', 'actions', 'scrollingBanner', 'unit', 'duration', 'ticketNumber', 'zone', 'address', 'templateName'];
    
    if (!data || typeof data !== 'object') {
      return changes;
    }

    // Traiter scrollingBanner au niveau racine
    if (data.scrollingBanner && typeof data.scrollingBanner === 'string' && data.scrollingBanner.trim() !== '') {
      const pathStr = 'Bannière défilante';
      if (!changes.find(c => c.path === pathStr && c.field === 'scrollingBanner')) {
        changes.push({
          path: pathStr,
          field: 'scrollingBanner',
          original: useTranslated ? data.scrollingBanner : data.scrollingBanner,
          translated: useTranslated ? data.scrollingBanner : data.scrollingBanner,
          editable: true,
        });
      }
    }

    // Traiter les domaines
    if (data.domains && Array.isArray(data.domains)) {
      data.domains.forEach((domain: any) => {
        const domainPath = [domain.name || domain.id || 'Domaine'];
        
        // Champs du domaine
        textFields.forEach(field => {
          if (domain[field] && typeof domain[field] === 'string' && domain[field].trim() !== '') {
            const pathStr = domainPath.join(' > ');
            if (!changes.find(c => c.path === pathStr && c.field === field)) {
              changes.push({
                path: pathStr,
                field,
                original: useTranslated ? domain[field] : domain[field],
                translated: useTranslated ? domain[field] : domain[field],
                editable: true,
              });
            }
          }
        });

        // Traiter les catégories
        if (domain.categories && Array.isArray(domain.categories)) {
          domain.categories.forEach((category: any) => {
            const categoryPath = [...domainPath, category.name || category.id || 'Catégorie'];
            
            textFields.forEach(field => {
              if (category[field] && typeof category[field] === 'string' && category[field].trim() !== '') {
                const pathStr = categoryPath.join(' > ');
                if (!changes.find(c => c.path === pathStr && c.field === field)) {
                  changes.push({
                    path: pathStr,
                    field,
                    original: useTranslated ? category[field] : category[field],
                    translated: useTranslated ? category[field] : category[field],
                    editable: true,
                  });
                }
              }
            });

            // Traiter les éléments
            if (category.elements && Array.isArray(category.elements)) {
              category.elements.forEach((element: any) => {
                const elementPath = [...categoryPath, element.name || element.id || 'Élément'];
                
                textFields.forEach(field => {
                  if (element[field] && typeof element[field] === 'string' && element[field].trim() !== '') {
                    const pathStr = elementPath.join(' > ');
                    if (!changes.find(c => c.path === pathStr && c.field === field)) {
                      changes.push({
                        path: pathStr,
                        field,
                        original: useTranslated ? element[field] : element[field],
                        translated: useTranslated ? element[field] : element[field],
                        editable: true,
                      });
                    }
                  }
                });

                // Traiter value (si c'est un texte)
                if (element.value && typeof element.value === 'string' && element.value.trim() !== '') {
                  const numValue = parseFloat(element.value);
                  if (isNaN(numValue)) {
                    const pathStr = elementPath.join(' > ');
                    if (!changes.find(c => c.path === pathStr && c.field === 'value')) {
                      changes.push({
                        path: pathStr,
                        field: 'value',
                        original: useTranslated ? element.value : element.value,
                        translated: useTranslated ? element.value : element.value,
                        editable: true,
                      });
                    }
                  }
                }

                // Traiter les sous-catégories
                if (element.subCategories && Array.isArray(element.subCategories)) {
                  element.subCategories.forEach((subCategory: any) => {
                    const subCategoryPath = [...elementPath, subCategory.name || subCategory.id || 'Sous-catégorie'];
                    
                    textFields.forEach(field => {
                      if (subCategory[field] && typeof subCategory[field] === 'string' && subCategory[field].trim() !== '') {
                        const pathStr = subCategoryPath.join(' > ');
                        if (!changes.find(c => c.path === pathStr && c.field === field)) {
                          changes.push({
                            path: pathStr,
                            field,
                            original: useTranslated ? subCategory[field] : subCategory[field],
                            translated: useTranslated ? subCategory[field] : subCategory[field],
                            editable: true,
                          });
                        }
                      }
                    });

                    // Traiter les sous-éléments
                    if (subCategory.subElements && Array.isArray(subCategory.subElements)) {
                      subCategory.subElements.forEach((subElement: any) => {
                        const subElementPath = [...subCategoryPath, subElement.name || subElement.id || 'Sous-élément'];
                        
                        textFields.forEach(field => {
                          if (subElement[field] && typeof subElement[field] === 'string' && subElement[field].trim() !== '') {
                            const pathStr = subElementPath.join(' > ');
                            if (!changes.find(c => c.path === pathStr && c.field === field)) {
                              changes.push({
                                path: pathStr,
                                field,
                                original: useTranslated ? subElement[field] : subElement[field],
                                translated: useTranslated ? subElement[field] : subElement[field],
                                editable: true,
                              });
                            }
                          }
                        });

                        // Traiter value des sous-éléments
                        if (subElement.value && typeof subElement.value === 'string' && subElement.value.trim() !== '') {
                          const numValue = parseFloat(subElement.value);
                          if (isNaN(numValue)) {
                            const pathStr = subElementPath.join(' > ');
                            if (!changes.find(c => c.path === pathStr && c.field === 'value')) {
                              changes.push({
                                path: pathStr,
                                field: 'value',
                                original: useTranslated ? subElement.value : subElement.value,
                                translated: useTranslated ? subElement.value : subElement.value,
                                editable: true,
                              });
                            }
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
          const pathStr = `Zone: ${zone.name}`;
          if (!changes.find(c => c.path === pathStr && c.field === 'name')) {
            changes.push({
              path: pathStr,
              field: 'name',
              original: useTranslated ? zone.name : zone.name,
              translated: useTranslated ? zone.name : zone.name,
              editable: true,
            });
          }
        }
      });
    }

    return changes;
  };

  // Fonction pour appliquer les traductions modifiées aux données en utilisant les IDs
  const applyEditedTranslations = (data: any, changes: TranslationChange[]): any => {
    // Créer un mapping rapide : path|field -> valeur traduite
    const changeMap = new Map<string, string>();
    changes.forEach(change => {
      const key = `${change.path}|${change.field}`;
      changeMap.set(key, change.translated);
    });

    // Fonction récursive pour appliquer les changements en utilisant les noms/chemins
    const applyRecursive = (obj: any, pathParts: string[] = []): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) => {
          if (item && typeof item === 'object') {
            // Construire le chemin pour cet élément
            const itemPath = item.name || item.id || `${pathParts[pathParts.length - 1]}[${index}]`;
            return applyRecursive(item, [...pathParts, itemPath]);
          }
          return item;
        });
      }

      const result: any = {};

      // Traiter scrollingBanner au niveau racine
      if ('scrollingBanner' in obj && typeof obj.scrollingBanner === 'string') {
        const key = 'Bannière défilante|scrollingBanner';
        result.scrollingBanner = changeMap.get(key) || obj.scrollingBanner;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'originals') {
          result[key] = value;
          continue;
        }

        const textFields = ['name', 'description', 'actions', 'unit', 'duration', 'ticketNumber', 'zone', 'address', 'templateName', 'value'];
        
        if (textFields.includes(key) && typeof value === 'string') {
          // Construire la clé pour chercher dans changeMap
          const currentPath = pathParts.join(' > ');
          const mapKey = `${currentPath}|${key}`;
          
          // Chercher correspondance exacte ou partielle
          let translatedValue = value;
          for (const [changeKey, changeValue] of changeMap.entries()) {
            if (changeKey === mapKey) {
              translatedValue = changeValue;
              break;
            }
            // Si le chemin correspond partiellement (pour gérer les cas où le nom a changé)
            const [changePath, changeField] = changeKey.split('|');
            if (changeField === key && changePath.endsWith(pathParts[pathParts.length - 1] || '')) {
              translatedValue = changeValue;
              break;
            }
          }
          result[key] = translatedValue;
        } else if (value && typeof value === 'object') {
          if (key === 'domains' && Array.isArray(value)) {
            result[key] = value.map((domain: any) => 
              applyRecursive(domain, [domain.name || domain.id || 'Domaine'])
            );
          } else if (key === 'categories' && Array.isArray(value)) {
            result[key] = value.map((category: any) => 
              applyRecursive(category, [...pathParts, category.name || category.id || 'Catégorie'])
            );
          } else if (key === 'elements' && Array.isArray(value)) {
            result[key] = value.map((element: any) => 
              applyRecursive(element, [...pathParts, element.name || element.id || 'Élément'])
            );
          } else if (key === 'subCategories' && Array.isArray(value)) {
            result[key] = value.map((subCategory: any) => 
              applyRecursive(subCategory, [...pathParts, subCategory.name || subCategory.id || 'Sous-catégorie'])
            );
          } else if (key === 'subElements' && Array.isArray(value)) {
            result[key] = value.map((subElement: any) => 
              applyRecursive(subElement, [...pathParts, subElement.name || subElement.id || 'Sous-élément'])
            );
          } else if (key === 'zones' && Array.isArray(value)) {
            result[key] = value.map((zone: any) => 
              applyRecursive(zone, [`Zone: ${zone.name || zone.id || 'Zone'}`])
            );
          } else {
            result[key] = applyRecursive(value, pathParts);
          }
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return applyRecursive(data);
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
      
      // Extraire les champs textuels des données actuelles
      const currentChanges = extractTextFields(currentCockpit, [], [], false);
      
      // Extraire les champs textuels des données traduites
      const translatedChanges = extractTextFields(translatedData, [], [], true);
      
      // Créer un mapping des changements par chemin+champ
      const changesMap = new Map<string, TranslationChange>();
      
      // Remplir avec les originaux
      currentChanges.forEach(change => {
        const key = `${change.path}|${change.field}`;
        changesMap.set(key, { ...change });
      });
      
      // Mettre à jour avec les traductions en faisant correspondre par chemin
      translatedChanges.forEach(translatedChange => {
        const key = `${translatedChange.path}|${translatedChange.field}`;
        if (changesMap.has(key)) {
          // Mettre à jour la traduction
          const existing = changesMap.get(key)!;
          existing.translated = translatedChange.translated;
        } else {
          // Nouveau champ dans la traduction
          changesMap.set(key, translatedChange);
        }
      });
      
      // Filtrer pour ne garder que ceux qui ont changé
      const finalChanges = Array.from(changesMap.values()).filter(
        change => change.original.trim() !== change.translated.trim()
      );
      
      setPreviewChanges(finalChanges);
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

      // Mettre à jour le cockpit
      const updatedCockpit = {
        id: currentCockpit.id,
        name: currentCockpit.name,
        userId: currentCockpit.userId,
        createdAt: currentCockpit.createdAt,
        updatedAt: new Date().toISOString(),
        domains: finalData.domains || [],
        zones: finalData.zones || [],
        scrollingBanner: finalData.scrollingBanner,
        logo: currentCockpit.logo,
        publicId: currentCockpit.publicId,
      } as any;

      updateCockpit(updatedCockpit);

      if (fetchCockpit) {
        setTimeout(async () => {
          await fetchCockpit(cockpitId);
        }, 500);
      }

      setHasOriginals(true);
      setShowPreviewModal(false);
      alert('✅ Traduction appliquée avec succès.');
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
        <MuiIcon name="Languages" size={16} />
        Traduction
      </button>
      
      {showModal && (
        <Modal
          title="Traduire le cockpit"
          onClose={() => setShowModal(false)}
          onConfirm={handlePreparePreview}
          confirmText="Traduire"
          isLoading={isTranslating}
          showSaveButton={true}
          onSaveOriginals={handleSaveOriginals}
          isSavingOriginals={isSavingOriginals}
          showRestoreButton={hasOriginals}
          onRestore={handleRestore}
          isRestoring={isRestoring}
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
