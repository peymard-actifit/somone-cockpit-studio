import { useState, useCallback, useMemo } from 'react';
import { MuiIcon } from './IconPicker';
import { useLanguage, DEFAULT_TRANSLATIONS } from '../contexts/LanguageContext';
import { useAuthStore } from '../store/authStore';

interface LanguageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LanguageEditorModal({ isOpen, onClose }: LanguageEditorModalProps) {
  const { translations, customTranslations, updateTranslation, saveTranslations } = useLanguage();
  const { token } = useAuthStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ FR: string; EN: string }>({ FR: '', EN: '' });
  
  const categoryLabels: Record<string, string> = {
    nav: 'Navigation',
    home: 'Page d\'accueil',
    user: 'Menu utilisateur',
    mockup: 'Maquettes',
    folder: 'Dossiers',
    studio: 'Studio',
    editor: 'Éditeur',
    status: 'Statuts',
    template: 'Templates',
    modal: 'Modales',
    msg: 'Messages',
    tutorial: 'Tutoriel',
    lang: 'Langues',
    help: 'Aide',
    footer: 'Pied de page'
  };
  
  // Filtrer les clés
  const filteredKeys = useMemo(() => {
    let keys = Object.keys(translations);
    
    if (selectedCategory) {
      keys = keys.filter(k => k.startsWith(selectedCategory + '.'));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      keys = keys.filter(k => 
        k.toLowerCase().includes(query) ||
        translations[k]?.FR?.toLowerCase().includes(query) ||
        translations[k]?.EN?.toLowerCase().includes(query)
      );
    }
    
    return keys.sort();
  }, [translations, selectedCategory, searchQuery]);
  
  // Démarrer l'édition d'une clé
  const startEditing = useCallback((key: string) => {
    setEditingKey(key);
    setEditValues({
      FR: translations[key]?.FR || '',
      EN: translations[key]?.EN || ''
    });
  }, [translations]);
  
  // Sauvegarder les modifications d'une clé
  const saveEditedKey = useCallback(() => {
    if (!editingKey) return;
    
    updateTranslation(editingKey, 'FR', editValues.FR);
    updateTranslation(editingKey, 'EN', editValues.EN);
    setEditingKey(null);
  }, [editingKey, editValues, updateTranslation]);
  
  // Traduire une clé via DeepL
  const translateKey = useCallback(async (key: string) => {
    if (!token) return;
    
    const frText = translations[key]?.FR;
    if (!frText) return;
    
    setIsTranslating(true);
    
    try {
      const response = await fetch('/api/translations/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: frText, targetLang: 'EN' })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.translatedText) {
          updateTranslation(key, 'EN', data.translatedText);
          if (editingKey === key) {
            setEditValues(prev => ({ ...prev, EN: data.translatedText }));
          }
        }
      }
    } catch (error) {
      console.error('[Language] Erreur traduction:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [token, translations, updateTranslation, editingKey]);
  
  // Traduire toutes les clés manquantes
  const translateAllMissing = useCallback(async () => {
    if (!token) return;
    
    setIsTranslating(true);
    setSaveMessage('Traduction en cours...');
    
    const keysToTranslate = filteredKeys.filter(key => 
      translations[key]?.FR && !translations[key]?.EN
    );
    
    let translated = 0;
    
    for (const key of keysToTranslate) {
      try {
        const response = await fetch('/api/translations/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ text: translations[key].FR, targetLang: 'EN' })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.translatedText) {
            updateTranslation(key, 'EN', data.translatedText);
            translated++;
          }
        }
        
        // Petite pause pour éviter de surcharger l'API
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        console.error(`[Language] Erreur traduction ${key}:`, error);
      }
    }
    
    setSaveMessage(`${translated} traductions effectuées`);
    setTimeout(() => setSaveMessage(null), 3000);
    setIsTranslating(false);
  }, [token, filteredKeys, translations, updateTranslation]);
  
  // Sauvegarder toutes les traductions
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const success = await saveTranslations();
      if (success) {
        setSaveMessage('Traductions sauvegardées !');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Erreur de sauvegarde');
      }
    } catch {
      setSaveMessage('Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [saveTranslations]);
  
  // Réinitialiser une traduction
  const resetTranslation = useCallback((key: string) => {
    const defaultVal = DEFAULT_TRANSLATIONS[key];
    if (defaultVal) {
      updateTranslation(key, 'FR', defaultVal.FR);
      updateTranslation(key, 'EN', defaultVal.EN);
    }
  }, [updateTranslation]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <MuiIcon name="Translate" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1E3A5F]">Gestion des langues</h2>
              <p className="text-sm text-[#64748B]">
                {Object.keys(translations).length} clés • {Object.keys(customTranslations).length} personnalisées
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className={`text-sm px-3 py-1 rounded-lg ${
                saveMessage.includes('Erreur') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
              }`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-400 disabled:opacity-50"
            >
              <MuiIcon name={isSaving ? 'HourglassTop' : 'Save'} size={18} />
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded-lg"
            >
              <MuiIcon name="Close" size={24} />
            </button>
          </div>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          {/* Recherche */}
          <div className="flex-1 relative">
            <MuiIcon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une clé ou un texte..."
              className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
          
          {/* Filtre par catégorie */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]"
          >
            <option value="">Toutes les catégories</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          
          {/* Traduire tout */}
          <button
            onClick={translateAllMissing}
            disabled={isTranslating}
            className="flex items-center gap-2 px-3 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 disabled:opacity-50 text-sm"
          >
            <MuiIcon name={isTranslating ? 'HourglassTop' : 'Translate'} size={16} />
            Traduire manquants
          </button>
        </div>
        
        {/* Liste des traductions */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-[#F5F7FA] sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-[#64748B] w-48">Clé</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-[#64748B]">Français</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-[#64748B]">Anglais</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-[#64748B] w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map((key) => {
                const isEditing = editingKey === key;
                const hasCustom = customTranslations[key] !== undefined;
                const missingEN = !translations[key]?.EN;
                
                return (
                  <tr 
                    key={key} 
                    className={`border-b border-[#E2E8F0] hover:bg-[#F8FAFC] ${hasCustom ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <code className="text-xs text-[#64748B] bg-[#F5F7FA] px-1.5 py-0.5 rounded">
                        {key}
                      </code>
                      {hasCustom && (
                        <span className="ml-2 text-[10px] text-blue-600 bg-blue-100 px-1 rounded">
                          modifié
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.FR}
                          onChange={(e) => setEditValues(prev => ({ ...prev, FR: e.target.value }))}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-[#1E3A5F]">{translations[key]?.FR || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValues.EN}
                            onChange={(e) => setEditValues(prev => ({ ...prev, EN: e.target.value }))}
                            className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => translateKey(key)}
                            disabled={isTranslating}
                            className="p-1 text-violet-600 hover:bg-violet-100 rounded"
                            title="Traduire via DeepL"
                          >
                            <MuiIcon name="Translate" size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className={`text-sm ${missingEN ? 'text-red-400 italic' : 'text-[#64748B]'}`}>
                          {translations[key]?.EN || '(manquant)'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEditedKey}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                              title="Valider"
                            >
                              <MuiIcon name="Check" size={16} />
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="Annuler"
                            >
                              <MuiIcon name="Close" size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(key)}
                              className="p-1 text-[#64748B] hover:text-blue-600 hover:bg-blue-100 rounded"
                              title="Modifier"
                            >
                              <MuiIcon name="Edit" size={16} />
                            </button>
                            <button
                              onClick={() => translateKey(key)}
                              disabled={isTranslating || !translations[key]?.FR}
                              className="p-1 text-[#64748B] hover:text-violet-600 hover:bg-violet-100 rounded disabled:opacity-30"
                              title="Traduire"
                            >
                              <MuiIcon name="Translate" size={16} />
                            </button>
                            {hasCustom && (
                              <button
                                onClick={() => resetTranslation(key)}
                                className="p-1 text-[#64748B] hover:text-amber-600 hover:bg-amber-100 rounded"
                                title="Réinitialiser"
                              >
                                <MuiIcon name="Refresh" size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredKeys.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[#94A3B8]">
              <MuiIcon name="SearchOff" size={48} className="mb-2" />
              <p>Aucune traduction trouvée</p>
            </div>
          )}
        </div>
        
        {/* Footer avec statistiques */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B] flex items-center justify-between">
          <span>{filteredKeys.length} clés affichées</span>
          <span>
            {Object.values(translations).filter(t => t.EN).length} / {Object.keys(translations).length} traduites en anglais
          </span>
        </div>
      </div>
    </div>
  );
}
