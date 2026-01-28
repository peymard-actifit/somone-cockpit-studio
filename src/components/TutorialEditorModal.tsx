import { useState, useEffect, useCallback } from 'react';
import { MuiIcon } from './IconPicker';
import { useTutorial } from '../contexts/TutorialContext';
import type { Tutorial, TutorialChapter, TutorialSubChapter } from '../types';
import { useAuthStore } from '../store/authStore';

interface TutorialEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Générer un ID unique
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function TutorialEditorModal({ isOpen, onClose }: TutorialEditorModalProps) {
  const { tutorial, saveTutorial, loadTutorial, isLoading } = useTutorial();
  const { token } = useAuthStore();
  
  const [localTutorial, setLocalTutorial] = useState<Tutorial | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSubChapterId, setSelectedSubChapterId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Charger le tutoriel local à l'ouverture
  useEffect(() => {
    if (isOpen && tutorial) {
      setLocalTutorial(JSON.parse(JSON.stringify(tutorial)));
    }
  }, [isOpen, tutorial]);
  
  // Sélectionner le premier chapitre par défaut
  useEffect(() => {
    if (localTutorial && localTutorial.chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(localTutorial.chapters[0].id);
    }
  }, [localTutorial, selectedChapterId]);
  
  const selectedChapter = localTutorial?.chapters.find(c => c.id === selectedChapterId);
  const selectedSubChapter = selectedChapter?.subChapters.find(s => s.id === selectedSubChapterId);
  
  // Ajouter un chapitre
  const addChapter = useCallback(() => {
    if (!localTutorial) return;
    
    const newChapter: TutorialChapter = {
      id: generateId(),
      title: 'Nouveau chapitre',
      titleEN: 'New chapter',
      description: '',
      icon: 'Article',
      order: localTutorial.chapters.length + 1,
      subChapters: []
    };
    
    setLocalTutorial({
      ...localTutorial,
      chapters: [...localTutorial.chapters, newChapter]
    });
    setSelectedChapterId(newChapter.id);
    setSelectedSubChapterId(null);
  }, [localTutorial]);
  
  // Supprimer un chapitre
  const deleteChapter = useCallback((chapterId: string) => {
    if (!localTutorial) return;
    
    const newChapters = localTutorial.chapters
      .filter(c => c.id !== chapterId)
      .map((c, i) => ({ ...c, order: i + 1 }));
    
    setLocalTutorial({
      ...localTutorial,
      chapters: newChapters
    });
    
    if (selectedChapterId === chapterId) {
      setSelectedChapterId(newChapters[0]?.id || null);
      setSelectedSubChapterId(null);
    }
  }, [localTutorial, selectedChapterId]);
  
  // Mettre à jour un chapitre
  const updateChapter = useCallback((chapterId: string, updates: Partial<TutorialChapter>) => {
    if (!localTutorial) return;
    
    setLocalTutorial({
      ...localTutorial,
      chapters: localTutorial.chapters.map(c =>
        c.id === chapterId ? { ...c, ...updates } : c
      )
    });
  }, [localTutorial]);
  
  // Ajouter un sous-chapitre
  const addSubChapter = useCallback((chapterId: string) => {
    if (!localTutorial) return;
    
    const chapter = localTutorial.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    const newSubChapter: TutorialSubChapter = {
      id: generateId(),
      title: 'Nouvelle étape',
      titleEN: 'New step',
      content: '<p>Contenu de l\'étape...</p>',
      contentEN: '<p>Step content...</p>',
      order: chapter.subChapters.length + 1,
      action: 'observe'
    };
    
    updateChapter(chapterId, {
      subChapters: [...chapter.subChapters, newSubChapter]
    });
    setSelectedSubChapterId(newSubChapter.id);
  }, [localTutorial, updateChapter]);
  
  // Supprimer un sous-chapitre
  const deleteSubChapter = useCallback((chapterId: string, subChapterId: string) => {
    if (!localTutorial) return;
    
    const chapter = localTutorial.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    const newSubChapters = chapter.subChapters
      .filter(s => s.id !== subChapterId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    
    updateChapter(chapterId, { subChapters: newSubChapters });
    
    if (selectedSubChapterId === subChapterId) {
      setSelectedSubChapterId(null);
    }
  }, [localTutorial, updateChapter, selectedSubChapterId]);
  
  // Mettre à jour un sous-chapitre
  const updateSubChapter = useCallback((chapterId: string, subChapterId: string, updates: Partial<TutorialSubChapter>) => {
    if (!localTutorial) return;
    
    const chapter = localTutorial.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    updateChapter(chapterId, {
      subChapters: chapter.subChapters.map(s =>
        s.id === subChapterId ? { ...s, ...updates } : s
      )
    });
  }, [localTutorial, updateChapter]);
  
  // Traduire un texte en anglais
  const translateToEnglish = useCallback(async (text: string): Promise<string> => {
    if (!token || !text.trim()) return text;
    
    try {
      const response = await fetch('/api/tutorial/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, targetLang: 'EN' })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.translatedText || text;
      }
    } catch (error) {
      console.error('[Tutorial] Erreur traduction:', error);
    }
    
    return text;
  }, [token]);
  
  // Traduire automatiquement le chapitre sélectionné
  const translateChapter = useCallback(async () => {
    if (!selectedChapter || !selectedChapterId) return;
    
    setIsTranslating(true);
    
    try {
      // Traduire le titre et la description du chapitre
      const titleEN = await translateToEnglish(selectedChapter.title);
      const descriptionEN = selectedChapter.description 
        ? await translateToEnglish(selectedChapter.description) 
        : undefined;
      
      // Traduire les sous-chapitres
      const translatedSubChapters = await Promise.all(
        selectedChapter.subChapters.map(async (sub) => ({
          ...sub,
          titleEN: await translateToEnglish(sub.title),
          contentEN: await translateToEnglish(sub.content)
        }))
      );
      
      updateChapter(selectedChapterId, {
        titleEN,
        descriptionEN,
        subChapters: translatedSubChapters
      });
      
      setSaveMessage('Traduction terminée !');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('[Tutorial] Erreur traduction chapitre:', error);
      setSaveMessage('Erreur de traduction');
      setTimeout(() => setSaveMessage(null), 2000);
    } finally {
      setIsTranslating(false);
    }
  }, [selectedChapter, selectedChapterId, translateToEnglish, updateChapter]);
  
  // Sauvegarder le tutoriel
  const handleSave = useCallback(async () => {
    if (!localTutorial) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const success = await saveTutorial(localTutorial);
      if (success) {
        setSaveMessage('Tutoriel sauvegardé !');
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        setSaveMessage('Erreur de sauvegarde');
      }
    } catch (error) {
      setSaveMessage('Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [localTutorial, saveTutorial]);
  
  // Déplacer un chapitre vers le haut ou le bas
  const moveChapter = useCallback((chapterId: string, direction: 'up' | 'down') => {
    if (!localTutorial) return;
    
    const index = localTutorial.chapters.findIndex(c => c.id === chapterId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localTutorial.chapters.length) return;
    
    const newChapters = [...localTutorial.chapters];
    [newChapters[index], newChapters[newIndex]] = [newChapters[newIndex], newChapters[index]];
    
    // Recalculer les ordres
    newChapters.forEach((c, i) => c.order = i + 1);
    
    setLocalTutorial({
      ...localTutorial,
      chapters: newChapters
    });
  }, [localTutorial]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <MuiIcon name="School" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1E3A5F]">Éditeur de Tutoriel</h2>
              <p className="text-sm text-[#64748B]">
                Version {localTutorial?.version || 1} • {localTutorial?.chapters.length || 0} chapitres
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
        
        {/* Contenu principal */}
        <div className="flex flex-1 overflow-hidden">
          {/* Liste des chapitres (gauche) */}
          <div className="w-64 border-r border-[#E2E8F0] flex flex-col bg-[#F8FAFC]">
            <div className="p-3 border-b border-[#E2E8F0] flex items-center justify-between">
              <span className="text-sm font-medium text-[#64748B]">Chapitres</span>
              <button
                onClick={addChapter}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Ajouter un chapitre"
              >
                <MuiIcon name="Add" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {localTutorial?.chapters.sort((a, b) => a.order - b.order).map((chapter, index) => (
                <div
                  key={chapter.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedChapterId === chapter.id
                      ? 'bg-[#1E3A5F] text-white'
                      : 'hover:bg-[#E2E8F0] text-[#1E3A5F]'
                  }`}
                  onClick={() => {
                    setSelectedChapterId(chapter.id);
                    setSelectedSubChapterId(null);
                  }}
                >
                  <span className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full bg-current/20">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{chapter.title}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveChapter(chapter.id, 'up'); }}
                      className="p-0.5 hover:bg-white/20 rounded"
                      disabled={index === 0}
                    >
                      <MuiIcon name="ArrowUpward" size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveChapter(chapter.id, 'down'); }}
                      className="p-0.5 hover:bg-white/20 rounded"
                      disabled={index === localTutorial.chapters.length - 1}
                    >
                      <MuiIcon name="ArrowDownward" size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }}
                      className="p-0.5 hover:bg-red-500/20 text-red-400 rounded"
                    >
                      <MuiIcon name="Delete" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Détails du chapitre (centre) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedChapter ? (
              <>
                {/* En-tête du chapitre */}
                <div className="p-4 border-b border-[#E2E8F0] bg-white">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Titre (FR)</label>
                        <input
                          type="text"
                          value={selectedChapter.title}
                          onChange={(e) => updateChapter(selectedChapter.id, { title: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-[#1E3A5F] font-medium focus:outline-none focus:border-[#1E3A5F]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Titre (EN)</label>
                        <input
                          type="text"
                          value={selectedChapter.titleEN || ''}
                          onChange={(e) => updateChapter(selectedChapter.id, { titleEN: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-[#64748B] focus:outline-none focus:border-[#1E3A5F]"
                          placeholder="English title..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Description (FR)</label>
                        <input
                          type="text"
                          value={selectedChapter.description || ''}
                          onChange={(e) => updateChapter(selectedChapter.id, { description: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]"
                          placeholder="Description courte..."
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Icône</label>
                        <input
                          type="text"
                          value={selectedChapter.icon || ''}
                          onChange={(e) => updateChapter(selectedChapter.id, { icon: e.target.value })}
                          className="w-24 px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]"
                          placeholder="Article"
                        />
                      </div>
                      <button
                        onClick={translateChapter}
                        disabled={isTranslating}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 text-sm disabled:opacity-50"
                      >
                        <MuiIcon name={isTranslating ? 'HourglassTop' : 'Translate'} size={16} />
                        {isTranslating ? '...' : 'Traduire'}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Liste des sous-chapitres + éditeur */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Liste des sous-chapitres */}
                  <div className="w-56 border-r border-[#E2E8F0] flex flex-col bg-[#FAFBFC]">
                    <div className="p-2 border-b border-[#E2E8F0] flex items-center justify-between">
                      <span className="text-xs font-medium text-[#64748B]">Étapes ({selectedChapter.subChapters.length})</span>
                      <button
                        onClick={() => addSubChapter(selectedChapter.id)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Ajouter une étape"
                      >
                        <MuiIcon name="Add" size={16} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                      {selectedChapter.subChapters.sort((a, b) => a.order - b.order).map((sub, index) => (
                        <div
                          key={sub.id}
                          className={`group flex items-center gap-1.5 p-1.5 rounded cursor-pointer transition-colors ${
                            selectedSubChapterId === sub.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'hover:bg-[#E2E8F0] text-[#64748B]'
                          }`}
                          onClick={() => setSelectedSubChapterId(sub.id)}
                        >
                          <span className="text-[10px] font-bold w-4">{index + 1}.</span>
                          <span className="flex-1 truncate text-xs">{sub.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSubChapter(selectedChapter.id, sub.id); }}
                            className="hidden group-hover:block p-0.5 hover:bg-red-100 text-red-400 rounded"
                          >
                            <MuiIcon name="Close" size={12} />
                          </button>
                        </div>
                      ))}
                      {selectedChapter.subChapters.length === 0 && (
                        <p className="text-xs text-[#94A3B8] text-center p-4">
                          Aucune étape.<br/>Cliquez sur + pour ajouter.
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Éditeur de sous-chapitre */}
                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                    {selectedSubChapter ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[#64748B] mb-1">Titre étape (FR)</label>
                            <input
                              type="text"
                              value={selectedSubChapter.title}
                              onChange={(e) => updateSubChapter(selectedChapter.id, selectedSubChapter.id, { title: e.target.value })}
                              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#64748B] mb-1">Titre étape (EN)</label>
                            <input
                              type="text"
                              value={selectedSubChapter.titleEN || ''}
                              onChange={(e) => updateSubChapter(selectedChapter.id, selectedSubChapter.id, { titleEN: e.target.value })}
                              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                              placeholder="English title..."
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[#64748B] mb-1">Élément ciblé (data-help-key)</label>
                            <input
                              type="text"
                              value={selectedSubChapter.targetElement || ''}
                              onChange={(e) => updateSubChapter(selectedChapter.id, selectedSubChapter.id, { targetElement: e.target.value })}
                              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-sm"
                              placeholder="home-btn-new-cockpit"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#64748B] mb-1">Action attendue</label>
                            <select
                              value={selectedSubChapter.action || 'observe'}
                              onChange={(e) => updateSubChapter(selectedChapter.id, selectedSubChapter.id, { action: e.target.value as any })}
                              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-sm"
                            >
                              <option value="observe">Observer (lecture seule)</option>
                              <option value="click">Cliquer sur l'élément</option>
                              <option value="input">Saisir du texte</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-[#64748B] mb-1">Contenu HTML (FR)</label>
                          <textarea
                            value={selectedSubChapter.content}
                            onChange={(e) => updateSubChapter(selectedChapter.id, selectedSubChapter.id, { content: e.target.value })}
                            className="w-full h-32 px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F] font-mono text-sm resize-none"
                            placeholder="<p>Contenu HTML...</p>"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-[#64748B] mb-1">Contenu HTML (EN)</label>
                          <textarea
                            value={selectedSubChapter.contentEN || ''}
                            onChange={(e) => updateSubChapter(selectedChapter.id, selectedSubChapter.id, { contentEN: e.target.value })}
                            className="w-full h-32 px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F] font-mono text-sm resize-none"
                            placeholder="<p>HTML content...</p>"
                          />
                        </div>
                        
                        {/* Prévisualisation */}
                        <div>
                          <label className="block text-xs text-[#64748B] mb-1">Prévisualisation</label>
                          <div 
                            className="p-4 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: selectedSubChapter.content }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-[#94A3B8]">
                        <MuiIcon name="TouchApp" size={48} className="mb-2" />
                        <p>Sélectionnez une étape à éditer</p>
                        <p className="text-sm">ou créez-en une nouvelle avec le bouton +</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#94A3B8]">
                <MuiIcon name="School" size={64} className="mb-4" />
                <p className="text-lg">Aucun chapitre sélectionné</p>
                <p className="text-sm mb-4">Sélectionnez un chapitre ou créez-en un nouveau</p>
                <button
                  onClick={addChapter}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                >
                  <MuiIcon name="Add" size={18} />
                  Créer un chapitre
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
