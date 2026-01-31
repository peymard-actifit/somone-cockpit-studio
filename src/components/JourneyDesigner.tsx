import { useState, useEffect } from 'react';
import { MuiIcon } from './IconPicker';
import { useJourneyStore } from '../store/journeyStore';
import type {
  JourneyStep,
  JourneyPresentationStep,
  JourneyInteractionStep,
  Journey,
  JourneyStepLink,
  JourneyInteractionField,
  JourneyQuestionField,
  JourneyPromptField,
  JourneyDataField,
} from '../types';

interface JourneyDesignerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Générer un ID unique
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Onglets principaux
type MainTab = 'steps' | 'journeys';

export default function JourneyDesigner({ isOpen, onClose }: JourneyDesignerProps) {
  const {
    steps,
    journeys,
    fetchSteps,
    fetchJourneys,
    createStep,
    updateStep,
    deleteStep,
    createJourney,
    updateJourney,
    deleteJourney,
    isLoading,
    error,
  } = useJourneyStore();

  const [mainTab, setMainTab] = useState<MainTab>('steps');
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // États d'édition locale
  const [editingStep, setEditingStep] = useState<JourneyStep | null>(null);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Charger les données à l'ouverture
  useEffect(() => {
    if (isOpen) {
      fetchSteps();
      fetchJourneys();
    }
  }, [isOpen, fetchSteps, fetchJourneys]);

  // Sélectionner la première étape par défaut
  useEffect(() => {
    if (steps.length > 0 && !selectedStepId && mainTab === 'steps') {
      setSelectedStepId(steps[0].id);
      setEditingStep(JSON.parse(JSON.stringify(steps[0])));
    }
  }, [steps, selectedStepId, mainTab]);

  // Sélectionner le premier parcours par défaut
  useEffect(() => {
    if (journeys.length > 0 && !selectedJourneyId && mainTab === 'journeys') {
      setSelectedJourneyId(journeys[0].id);
      setEditingJourney(JSON.parse(JSON.stringify(journeys[0])));
    }
  }, [journeys, selectedJourneyId, mainTab]);

  // Mettre à jour l'étape en édition quand la sélection change
  useEffect(() => {
    if (selectedStepId) {
      const step = steps.find(s => s.id === selectedStepId);
      if (step) {
        setEditingStep(JSON.parse(JSON.stringify(step)));
      }
    }
  }, [selectedStepId, steps]);

  // Mettre à jour le parcours en édition quand la sélection change
  useEffect(() => {
    if (selectedJourneyId) {
      const journey = journeys.find(j => j.id === selectedJourneyId);
      if (journey) {
        setEditingJourney(JSON.parse(JSON.stringify(journey)));
      }
    }
  }, [selectedJourneyId, journeys]);

  // === GESTION DES ÉTAPES ===

  const handleCreateStep = async (type: 'presentation' | 'interaction') => {
    const stepData = type === 'presentation' 
      ? {
          type: 'presentation' as const,
          name: 'Nouvelle présentation',
          title: 'Titre de la présentation',
          content: '<p>Contenu de la présentation...</p>',
          icon: 'Article',
        }
      : {
          type: 'interaction' as const,
          name: 'Nouvelle interaction',
          title: 'Titre de l\'interaction',
          description: 'Description de l\'interaction',
          fields: [] as JourneyInteractionField[],
          icon: 'QuestionAnswer',
        };
    
    const newStep = await createStep(stepData);
    
    if (newStep) {
      setSelectedStepId(newStep.id);
      setEditingStep(JSON.parse(JSON.stringify(newStep)));
      showMessage('Étape créée');
    }
  };

  const handleSaveStep = async () => {
    if (!editingStep || !selectedStepId) return;
    
    setIsSaving(true);
    const success = await updateStep(selectedStepId, editingStep);
    setIsSaving(false);
    
    if (success) {
      showMessage('Étape sauvegardée');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette étape ?')) return;
    
    const success = await deleteStep(stepId);
    if (success) {
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
        setEditingStep(null);
      }
      showMessage('Étape supprimée');
    }
  };

  // === GESTION DES CHAMPS D'INTERACTION ===

  const addField = (type: 'question' | 'prompt' | 'data') => {
    if (!editingStep || editingStep.type !== 'interaction') return;
    
    const step = editingStep as JourneyInteractionStep;
    const fields = step.fields || [];
    
    let newField: JourneyInteractionField;
    
    if (type === 'question') {
      newField = {
        id: generateId(),
        type: 'question',
        label: 'Nouvelle question',
        placeholder: 'Votre réponse...',
        required: false,
      } as JourneyQuestionField;
    } else if (type === 'prompt') {
      newField = {
        id: generateId(),
        type: 'prompt',
        label: 'Nouvelle instruction',
        placeholder: 'Décrivez...',
        required: false,
        aiInstruction: '',
      } as JourneyPromptField;
    } else {
      newField = {
        id: generateId(),
        type: 'data',
        label: 'Nouveau groupe de données',
        inputType: 'text-list',
        allowCustom: true,
        required: false,
      } as JourneyDataField;
    }
    
    setEditingStep({
      ...step,
      fields: [...fields, newField],
    } as JourneyInteractionStep);
    setEditingFieldId(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<JourneyInteractionField>) => {
    if (!editingStep || editingStep.type !== 'interaction') return;
    
    const step = editingStep as JourneyInteractionStep;
    setEditingStep({
      ...step,
      fields: step.fields.map(f => f.id === fieldId ? { ...f, ...updates } as JourneyInteractionField : f),
    } as JourneyInteractionStep);
  };

  const deleteField = (fieldId: string) => {
    if (!editingStep || editingStep.type !== 'interaction') return;
    
    const step = editingStep as JourneyInteractionStep;
    setEditingStep({
      ...step,
      fields: step.fields.filter(f => f.id !== fieldId),
    } as JourneyInteractionStep);
    if (editingFieldId === fieldId) {
      setEditingFieldId(null);
    }
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    if (!editingStep || editingStep.type !== 'interaction') return;
    
    const step = editingStep as JourneyInteractionStep;
    const fields = [...step.fields];
    const index = fields.findIndex(f => f.id === fieldId);
    
    if (direction === 'up' && index > 0) {
      [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
    } else if (direction === 'down' && index < fields.length - 1) {
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
    }
    
    setEditingStep({ ...step, fields } as JourneyInteractionStep);
  };

  // === GESTION DES PARCOURS ===

  const handleCreateJourney = async () => {
    const newJourney = await createJourney({
      name: 'Nouveau parcours',
      description: 'Description du parcours',
      icon: 'Route',
      steps: [],
      targetGeneration: 'domain',
      isActive: false,
    });
    
    if (newJourney) {
      setSelectedJourneyId(newJourney.id);
      setEditingJourney(JSON.parse(JSON.stringify(newJourney)));
      showMessage('Parcours créé');
    }
  };

  const handleSaveJourney = async () => {
    if (!editingJourney || !selectedJourneyId) return;
    
    setIsSaving(true);
    const success = await updateJourney(selectedJourneyId, editingJourney);
    setIsSaving(false);
    
    if (success) {
      showMessage('Parcours sauvegardé');
    }
  };

  const handleDeleteJourney = async (journeyId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce parcours ?')) return;
    
    const success = await deleteJourney(journeyId);
    if (success) {
      if (selectedJourneyId === journeyId) {
        setSelectedJourneyId(null);
        setEditingJourney(null);
      }
      showMessage('Parcours supprimé');
    }
  };

  // Activer/Désactiver avec sauvegarde immédiate
  const handleToggleActive = async () => {
    if (!editingJourney || !selectedJourneyId) return;
    
    // Vérifier qu'il y a au moins une étape pour activer
    if (!editingJourney.isActive && editingJourney.steps.length === 0) {
      showMessage('Ajoutez au moins une étape avant d\'activer le parcours');
      return;
    }
    
    const newActiveState = !editingJourney.isActive;
    setIsSaving(true);
    
    // Sauvegarder d'abord toutes les modifications en cours + le nouveau statut
    const success = await updateJourney(selectedJourneyId, {
      ...editingJourney,
      isActive: newActiveState,
    });
    
    setIsSaving(false);
    
    if (success) {
      setEditingJourney({ ...editingJourney, isActive: newActiveState });
      showMessage(newActiveState ? 'Parcours activé et sauvegardé' : 'Parcours désactivé');
    }
  };

  const addStepToJourney = (stepId: string) => {
    if (!editingJourney) return;
    
    // Vérifier si l'étape n'est pas déjà dans le parcours
    if (editingJourney.steps.some((s: JourneyStepLink) => s.stepId === stepId)) return;
    
    setEditingJourney({
      ...editingJourney,
      steps: [
        ...editingJourney.steps,
        { stepId, order: editingJourney.steps.length },
      ],
    });
  };

  const removeStepFromJourney = (stepId: string) => {
    if (!editingJourney) return;
    
    setEditingJourney({
      ...editingJourney,
      steps: editingJourney.steps
        .filter((s: JourneyStepLink) => s.stepId !== stepId)
        .map((s: JourneyStepLink, i: number) => ({ ...s, order: i })),
    });
  };

  const moveStepInJourney = (stepId: string, direction: 'up' | 'down') => {
    if (!editingJourney) return;
    
    const stepsArr = [...editingJourney.steps];
    const index = stepsArr.findIndex(s => s.stepId === stepId);
    
    if (direction === 'up' && index > 0) {
      [stepsArr[index - 1], stepsArr[index]] = [stepsArr[index], stepsArr[index - 1]];
    } else if (direction === 'down' && index < stepsArr.length - 1) {
      [stepsArr[index], stepsArr[index + 1]] = [stepsArr[index + 1], stepsArr[index]];
    }
    
    setEditingJourney({
      ...editingJourney,
      steps: stepsArr.map((s: JourneyStepLink, i: number) => ({ ...s, order: i })),
    });
  };

  // === HELPERS ===

  const showMessage = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const getStepName = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    return step?.name || 'Étape inconnue';
  };

  const getStepIcon = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    return step?.icon || 'HelpOutline';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-[95vw] max-w-7xl h-[90vh] flex flex-col overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-4">
            <MuiIcon name="Route" className="text-3xl text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Conception des Parcours</h2>
              <p className="text-sm text-gray-400">
                Créez et gérez les parcours de création décisionnelle
              </p>
            </div>
          </div>
          
          {/* Onglets principaux */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMainTab('steps')}
              className={`px-4 py-2 rounded-lg transition-all ${
                mainTab === 'steps'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <MuiIcon name="ViewList" className="mr-2" />
              Étapes ({steps.length})
            </button>
            <button
              onClick={() => setMainTab('journeys')}
              className={`px-4 py-2 rounded-lg transition-all ${
                mainTab === 'journeys'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <MuiIcon name="Route" className="mr-2" />
              Parcours ({journeys.length})
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <MuiIcon name="Close" className="text-2xl" />
          </button>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 flex overflow-hidden">
          {/* === ONGLET ÉTAPES === */}
          {mainTab === 'steps' && (
            <>
              {/* Liste des étapes (sidebar gauche) */}
              <div className="w-72 border-r border-gray-700 flex flex-col bg-gray-800/30">
                <div className="p-3 border-b border-gray-700">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCreateStep('presentation')}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
                    >
                      <MuiIcon name="Article" className="mr-1" />
                      + Présentation
                    </button>
                    <button
                      onClick={() => handleCreateStep('interaction')}
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                    >
                      <MuiIcon name="QuestionAnswer" className="mr-1" />
                      + Interaction
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      onClick={() => {
                        setSelectedStepId(step.id);
                        setEditingStep(JSON.parse(JSON.stringify(step)));
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedStepId === step.id
                          ? 'bg-blue-600/30 border border-blue-500'
                          : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MuiIcon
                          name={step.icon || (step.type === 'presentation' ? 'Article' : 'QuestionAnswer')}
                          className={step.type === 'presentation' ? 'text-emerald-400' : 'text-purple-400'}
                        />
                        <span className="flex-1 truncate text-white text-sm">{step.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStep(step.id);
                          }}
                          className="p-1 hover:bg-red-500/30 rounded text-gray-400 hover:text-red-400"
                        >
                          <MuiIcon name="Delete" className="text-sm" />
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {step.type === 'presentation' ? 'Présentation' : 'Interaction'}
                      </div>
                    </div>
                  ))}
                  
                  {steps.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MuiIcon name="Inbox" className="text-4xl mb-2" />
                      <p>Aucune étape</p>
                      <p className="text-xs mt-1">Créez votre première étape</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Éditeur d'étape (centre) */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {editingStep ? (
                  <>
                    {/* Barre d'outils */}
                    <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          editingStep.type === 'presentation'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {editingStep.type === 'presentation' ? 'PRÉSENTATION' : 'INTERACTION'}
                        </span>
                        <span className="text-gray-400 text-sm">ID: {editingStep.id.slice(0, 8)}...</span>
                      </div>
                      
                      <button
                        onClick={handleSaveStep}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <MuiIcon name="Save" className="mr-2" />
                        {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                      </button>
                    </div>

                    {/* Contenu de l'éditeur */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Informations générales */}
                      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <MuiIcon name="Info" className="text-blue-400" />
                          Informations générales
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Nom (admin)</label>
                            <input
                              type="text"
                              value={editingStep.name}
                              onChange={(e) => setEditingStep({ ...editingStep, name: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Icône</label>
                            <input
                              type="text"
                              value={editingStep.icon || ''}
                              onChange={(e) => setEditingStep({ ...editingStep, icon: e.target.value })}
                              placeholder="Nom icône MUI"
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm text-gray-400 mb-1">Titre (affiché à l'utilisateur)</label>
                            <input
                              type="text"
                              value={editingStep.title}
                              onChange={(e) => setEditingStep({ ...editingStep, title: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Contenu spécifique au type */}
                      {editingStep.type === 'presentation' ? (
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MuiIcon name="Article" className="text-emerald-400" />
                            Contenu de la présentation
                          </h3>
                          
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Contenu HTML</label>
                            <textarea
                              value={(editingStep as JourneyPresentationStep).content || ''}
                              onChange={(e) => setEditingStep({
                                ...editingStep,
                                content: e.target.value,
                              } as JourneyPresentationStep)}
                              rows={12}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                              placeholder="<h2>Titre</h2><p>Votre contenu HTML...</p>"
                            />
                          </div>
                          
                          <div className="p-4 bg-gray-900 rounded-lg">
                            <p className="text-xs text-gray-500 mb-2">Aperçu :</p>
                            <div
                              className="prose prose-invert prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: (editingStep as JourneyPresentationStep).content || '' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                              <MuiIcon name="QuestionAnswer" className="text-purple-400" />
                              Champs d'interaction
                            </h3>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => addField('question')}
                                className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 rounded text-sm"
                              >
                                + Question
                              </button>
                              <button
                                onClick={() => addField('prompt')}
                                className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded text-sm"
                              >
                                + Prompt IA
                              </button>
                              <button
                                onClick={() => addField('data')}
                                className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded text-sm"
                              >
                                + Données
                              </button>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Description (optionnel)</label>
                            <textarea
                              value={(editingStep as JourneyInteractionStep).description || ''}
                              onChange={(e) => setEditingStep({
                                ...editingStep,
                                description: e.target.value,
                              } as JourneyInteractionStep)}
                              rows={2}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>

                          {/* Liste des champs */}
                          <div className="space-y-3">
                            {((editingStep as JourneyInteractionStep).fields || []).map((field, index) => (
                              <div
                                key={field.id}
                                className={`p-4 rounded-lg border transition-all ${
                                  editingFieldId === field.id
                                    ? 'bg-gray-700/50 border-blue-500'
                                    : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      field.type === 'question'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : field.type === 'prompt'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                      {field.type === 'question' ? 'QUESTION' : field.type === 'prompt' ? 'PROMPT IA' : 'DONNÉES'}
                                    </span>
                                    <span className="text-sm text-gray-400">#{index + 1}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => moveField(field.id, 'up')}
                                      disabled={index === 0}
                                      className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"
                                    >
                                      <MuiIcon name="KeyboardArrowUp" className="text-gray-400" />
                                    </button>
                                    <button
                                      onClick={() => moveField(field.id, 'down')}
                                      disabled={index === ((editingStep as JourneyInteractionStep).fields || []).length - 1}
                                      className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"
                                    >
                                      <MuiIcon name="KeyboardArrowDown" className="text-gray-400" />
                                    </button>
                                    <button
                                      onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
                                      className="p-1 hover:bg-gray-600 rounded"
                                    >
                                      <MuiIcon name={editingFieldId === field.id ? 'ExpandLess' : 'ExpandMore'} className="text-gray-400" />
                                    </button>
                                    <button
                                      onClick={() => deleteField(field.id)}
                                      className="p-1 hover:bg-red-500/30 rounded text-gray-400 hover:text-red-400"
                                    >
                                      <MuiIcon name="Delete" className="text-sm" />
                                    </button>
                                  </div>
                                </div>

                                {/* Label du champ */}
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-2"
                                  placeholder="Label du champ"
                                />

                                {/* Options détaillées */}
                                {editingFieldId === field.id && (
                                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                                        <input
                                          type="text"
                                          value={(field as any).placeholder || ''}
                                          onChange={(e) => updateField(field.id, { placeholder: e.target.value } as any)}
                                          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2 pt-5">
                                        <input
                                          type="checkbox"
                                          checked={field.required || false}
                                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                          className="rounded"
                                        />
                                        <label className="text-sm text-gray-400">Obligatoire</label>
                                      </div>
                                    </div>

                                    {/* Options spécifiques au type */}
                                    {field.type === 'prompt' && (
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Instructions pour l'IA</label>
                                        <textarea
                                          value={(field as JourneyPromptField).aiInstruction || ''}
                                          onChange={(e) => updateField(field.id, { aiInstruction: e.target.value } as any)}
                                          rows={3}
                                          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                          placeholder="Comment l'IA doit interpréter cette réponse..."
                                        />
                                      </div>
                                    )}

                                    {field.type === 'data' && (
                                      <>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Type d'entrée</label>
                                          <select
                                            value={(field as JourneyDataField).inputType}
                                            onChange={(e) => updateField(field.id, { inputType: e.target.value } as any)}
                                            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                          >
                                            <option value="text-list">Liste de textes</option>
                                            <option value="select">Sélection unique</option>
                                            <option value="multiselect">Sélection multiple</option>
                                            <option value="key-value">Clé-Valeur</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={(field as JourneyDataField).allowCustom || false}
                                            onChange={(e) => updateField(field.id, { allowCustom: e.target.checked } as any)}
                                            className="rounded"
                                          />
                                          <label className="text-sm text-gray-400">Permettre valeurs personnalisées</label>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {((editingStep as JourneyInteractionStep).fields || []).length === 0 && (
                              <div className="text-center text-gray-500 py-8 border border-dashed border-gray-700 rounded-lg">
                                <MuiIcon name="AddCircleOutline" className="text-3xl mb-2" />
                                <p>Aucun champ</p>
                                <p className="text-xs mt-1">Ajoutez des questions, prompts ou données</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MuiIcon name="TouchApp" className="text-5xl mb-3" />
                      <p>Sélectionnez une étape à modifier</p>
                      <p className="text-sm mt-1">ou créez-en une nouvelle</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* === ONGLET PARCOURS === */}
          {mainTab === 'journeys' && (
            <>
              {/* Liste des parcours (sidebar gauche) */}
              <div className="w-72 border-r border-gray-700 flex flex-col bg-gray-800/30">
                <div className="p-3 border-b border-gray-700">
                  <button
                    onClick={handleCreateJourney}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <MuiIcon name="Add" className="mr-1" />
                    Nouveau parcours
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {journeys.map((journey) => (
                    <div
                      key={journey.id}
                      onClick={() => {
                        setSelectedJourneyId(journey.id);
                        setEditingJourney(JSON.parse(JSON.stringify(journey)));
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedJourneyId === journey.id
                          ? 'bg-blue-600/30 border border-blue-500'
                          : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MuiIcon name={journey.icon || 'Route'} className="text-blue-400" />
                        <span className="flex-1 truncate text-white text-sm">{journey.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          journey.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {journey.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {journey.steps.length} étape{journey.steps.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                  
                  {journeys.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MuiIcon name="Route" className="text-4xl mb-2" />
                      <p>Aucun parcours</p>
                      <p className="text-xs mt-1">Créez votre premier parcours</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Éditeur de parcours (centre) */}
              <div className="flex-1 flex overflow-hidden">
                {editingJourney ? (
                  <>
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Barre d'outils */}
                      <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            editingJourney.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {editingJourney.isActive ? 'ACTIF' : 'INACTIF'}
                          </span>
                          <button
                            onClick={handleToggleActive}
                            disabled={isSaving}
                            className={`px-3 py-1 rounded text-sm transition-colors ${
                              editingJourney.isActive 
                                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            } disabled:opacity-50`}
                          >
                            {isSaving ? '...' : editingJourney.isActive ? 'Désactiver' : 'Activer'}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteJourney(editingJourney.id)}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm"
                          >
                            <MuiIcon name="Delete" className="mr-1" />
                            Supprimer
                          </button>
                          <button
                            onClick={handleSaveJourney}
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <MuiIcon name="Save" className="mr-2" />
                            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                          </button>
                        </div>
                      </div>

                      {/* Contenu de l'éditeur */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Informations générales */}
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MuiIcon name="Info" className="text-blue-400" />
                            Informations du parcours
                          </h3>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Nom du parcours</label>
                              <input
                                type="text"
                                value={editingJourney.name}
                                onChange={(e) => setEditingJourney({ ...editingJourney, name: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Icône</label>
                              <input
                                type="text"
                                value={editingJourney.icon || ''}
                                onChange={(e) => setEditingJourney({ ...editingJourney, icon: e.target.value })}
                                placeholder="Nom icône MUI"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-sm text-gray-400 mb-1">Description</label>
                              <textarea
                                value={editingJourney.description || ''}
                                onChange={(e) => setEditingJourney({ ...editingJourney, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Type de génération</label>
                              <select
                                value={editingJourney.targetGeneration}
                                onChange={(e) => setEditingJourney({ ...editingJourney, targetGeneration: e.target.value as any })}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              >
                                <option value="domain">Un domaine</option>
                                <option value="domains">Plusieurs domaines</option>
                                <option value="category">Une catégorie</option>
                                <option value="element">Un élément</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Étapes du parcours */}
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MuiIcon name="FormatListNumbered" className="text-purple-400" />
                            Étapes du parcours ({editingJourney.steps.length})
                          </h3>

                          <div className="space-y-2">
                            {editingJourney.steps.map((stepLink: JourneyStepLink, index: number) => (
                              <div
                                key={stepLink.stepId}
                                className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg"
                              >
                                <span className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-sm text-white font-bold">
                                  {index + 1}
                                </span>
                                <MuiIcon name={getStepIcon(stepLink.stepId)} className="text-gray-400" />
                                <span className="flex-1 text-white">{getStepName(stepLink.stepId)}</span>
                                
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => moveStepInJourney(stepLink.stepId, 'up')}
                                    disabled={index === 0}
                                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                                  >
                                    <MuiIcon name="KeyboardArrowUp" className="text-gray-400" />
                                  </button>
                                  <button
                                    onClick={() => moveStepInJourney(stepLink.stepId, 'down')}
                                    disabled={index === editingJourney.steps.length - 1}
                                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                                  >
                                    <MuiIcon name="KeyboardArrowDown" className="text-gray-400" />
                                  </button>
                                  <button
                                    onClick={() => removeStepFromJourney(stepLink.stepId)}
                                    className="p-1 hover:bg-red-500/30 rounded text-gray-400 hover:text-red-400"
                                  >
                                    <MuiIcon name="RemoveCircle" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            {editingJourney.steps.length === 0 && (
                              <div className="text-center text-gray-500 py-6 border border-dashed border-gray-700 rounded-lg">
                                <MuiIcon name="AddCircleOutline" className="text-3xl mb-2" />
                                <p>Aucune étape dans ce parcours</p>
                                <p className="text-xs mt-1">Ajoutez des étapes depuis la liste à droite</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Template de prompt IA */}
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MuiIcon name="Psychology" className="text-amber-400" />
                            Template de génération IA (optionnel)
                          </h3>
                          
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">
                              Prompt pour l'IA (utilisez {'{{context}}'} pour insérer les réponses)
                            </label>
                            <textarea
                              value={editingJourney.aiPromptTemplate || ''}
                              onChange={(e) => setEditingJourney({ ...editingJourney, aiPromptTemplate: e.target.value })}
                              rows={8}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                              placeholder="Laissez vide pour utiliser le prompt par défaut..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Liste des étapes disponibles (sidebar droite) */}
                    <div className="w-64 border-l border-gray-700 flex flex-col bg-gray-800/30">
                      <div className="p-3 border-b border-gray-700">
                        <h4 className="text-sm font-semibold text-white">Étapes disponibles</h4>
                        <p className="text-xs text-gray-500 mt-1">Cliquez pour ajouter au parcours</p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {steps.map((step) => {
                          const isInJourney = editingJourney.steps.some((s: JourneyStepLink) => s.stepId === step.id);
                          return (
                            <button
                              key={step.id}
                              onClick={() => !isInJourney && addStepToJourney(step.id)}
                              disabled={isInJourney}
                              className={`w-full p-2 rounded-lg text-left transition-all ${
                                isInJourney
                                  ? 'bg-gray-900 text-gray-600 cursor-not-allowed'
                                  : 'bg-gray-800 hover:bg-gray-700 text-white cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <MuiIcon
                                  name={step.icon || (step.type === 'presentation' ? 'Article' : 'QuestionAnswer')}
                                  className={isInJourney ? 'text-gray-600' : step.type === 'presentation' ? 'text-emerald-400' : 'text-purple-400'}
                                />
                                <span className="flex-1 truncate text-sm">{step.name}</span>
                                {isInJourney && (
                                  <MuiIcon name="Check" className="text-green-500 text-sm" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                        
                        {steps.length === 0 && (
                          <div className="text-center text-gray-500 py-6">
                            <p className="text-xs">Aucune étape créée</p>
                            <p className="text-xs mt-1">Allez dans l'onglet "Étapes"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MuiIcon name="TouchApp" className="text-5xl mb-3" />
                      <p>Sélectionnez un parcours à modifier</p>
                      <p className="text-sm mt-1">ou créez-en un nouveau</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer avec messages */}
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {error && <span className="text-red-400">{error}</span>}
            {saveMessage && <span className="text-green-400">{saveMessage}</span>}
            {isLoading && <span className="text-blue-400">Chargement...</span>}
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
