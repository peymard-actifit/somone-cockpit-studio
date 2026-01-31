import { useState, useEffect, useMemo } from 'react';
import { MuiIcon } from './IconPicker';
import { useJourneyStore } from '../store/journeyStore';
import { useCockpitStore } from '../store/cockpitStore';
import { useLanguage } from '../contexts/LanguageContext';
import type {
  JourneyPresentationStep,
  JourneyInteractionStep,
  JourneyFieldResponse,
  JourneyInteractionField,
  JourneyQuestionField,
  JourneyPromptField,
  JourneyDataField,
} from '../types';

interface JourneyPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  cockpitId?: string;
}

export default function JourneyPlayer({ isOpen, onClose, cockpitId }: JourneyPlayerProps) {
  const { language } = useLanguage();
  const {
    journeys,
    currentSession,
    fetchSteps,
    fetchJourneys,
    startJourney,
    submitStepResponse,
    goToNextStep,
    goToPreviousStep,
    abandonSession,
    completeSession,
    getCurrentStep,
    getSessionProgress,
    getActiveJourneys,
    isLoading,
    error,
  } = useJourneyStore();
  
  const { fetchCockpits } = useCockpitStore();

  // États locaux
  const [view, setView] = useState<'select' | 'play' | 'generating' | 'complete'>('select');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [currentResponses, setCurrentResponses] = useState<Record<string, any>>({});
  const [generationResult, setGenerationResult] = useState<{ domainIds: string[] } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Charger les données à l'ouverture
  useEffect(() => {
    if (isOpen) {
      fetchSteps();
      fetchJourneys();
      setView('select');
      setSelectedJourneyId(null);
      setCurrentResponses({});
      setGenerationResult(null);
    }
  }, [isOpen, fetchSteps, fetchJourneys]);

  // Parcours actifs
  const activeJourneys = useMemo(() => getActiveJourneys(), [journeys]);

  // Étape courante
  const currentStep = getCurrentStep();
  const progress = getSessionProgress();
  const currentJourney = journeys.find(j => j.id === currentSession?.journeyId);

  // Démarrer un parcours
  const handleStartJourney = async () => {
    if (!selectedJourneyId) return;
    
    const session = await startJourney(selectedJourneyId, cockpitId);
    if (session) {
      setView('play');
      setCurrentResponses({});
    }
  };

  // Valider et soumettre les réponses de l'étape courante
  const validateCurrentStep = (): boolean => {
    if (!currentStep || currentStep.type !== 'interaction') return true;
    
    const interactionStep = currentStep as JourneyInteractionStep;
    const errors: Record<string, string> = {};
    
    for (const field of interactionStep.fields || []) {
      if (field.required) {
        const value = currentResponses[field.id];
        if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && !value.trim())) {
          errors[field.id] = 'Ce champ est obligatoire';
        }
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Passer à l'étape suivante
  const handleNext = async () => {
    if (!currentStep) return;
    
    // Valider si c'est une étape d'interaction
    if (currentStep.type === 'interaction') {
      if (!validateCurrentStep()) return;
      
      // Construire les réponses
      const interactionStep = currentStep as JourneyInteractionStep;
      const responses: JourneyFieldResponse[] = (interactionStep.fields || []).map(field => ({
        fieldId: field.id,
        fieldType: field.type,
        value: currentResponses[field.id] || '',
      }));
      
      await submitStepResponse(responses);
    }
    
    // Vérifier si c'est la dernière étape
    if (currentSession && currentJourney && progress.current >= progress.total) {
      // Lancer la génération
      setView('generating');
      const result = await completeSession();
      if (result) {
        setGenerationResult(result);
        setView('complete');
        // Rafraîchir la liste des cockpits pour voir le nouveau domaine
        await fetchCockpits();
      } else {
        // Erreur
        setView('play');
      }
    } else {
      // Passer à l'étape suivante
      goToNextStep();
      setCurrentResponses({});
      setValidationErrors({});
    }
  };

  // Retourner à l'étape précédente
  const handlePrevious = () => {
    goToPreviousStep();
    setCurrentResponses({});
    setValidationErrors({});
  };

  // Abandonner le parcours
  const handleAbandon = async () => {
    if (confirm('Êtes-vous sûr de vouloir abandonner ce parcours ? Les réponses seront perdues.')) {
      await abandonSession();
      setView('select');
      setCurrentResponses({});
    }
  };

  // Fermer le player
  const handleClose = () => {
    if (currentSession && view === 'play') {
      if (!confirm('Voulez-vous vraiment quitter ? Le parcours en cours sera abandonné.')) {
        return;
      }
      abandonSession();
    }
    onClose();
  };

  // Mettre à jour une réponse
  const updateResponse = (fieldId: string, value: any) => {
    setCurrentResponses(prev => ({ ...prev, [fieldId]: value }));
    // Effacer l'erreur de validation
    if (validationErrors[fieldId]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  // Ajouter un élément à une liste
  const addToList = (fieldId: string) => {
    const current = currentResponses[fieldId] || [];
    updateResponse(fieldId, [...current, '']);
  };

  // Supprimer un élément d'une liste
  const removeFromList = (fieldId: string, index: number) => {
    const current = currentResponses[fieldId] || [];
    updateResponse(fieldId, current.filter((_: any, i: number) => i !== index));
  };

  // Mettre à jour un élément dans une liste
  const updateListItem = (fieldId: string, index: number, value: string) => {
    const current = currentResponses[fieldId] || [];
    const updated = [...current];
    updated[index] = value;
    updateResponse(fieldId, updated);
  };

  // Obtenir le texte localisé
  const getLocalizedText = (fr?: string, en?: string) => {
    if (language === 'EN' && en) return en;
    return fr || '';
  };

  // Rendu d'un champ d'interaction
  const renderField = (field: JourneyInteractionField) => {
    const hasError = !!validationErrors[field.id];
    
    switch (field.type) {
      case 'question': {
        const qField = field as JourneyQuestionField;
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-white font-medium">
              {getLocalizedText(qField.label, qField.labelEN)}
              {qField.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={currentResponses[field.id] || ''}
              onChange={(e) => updateResponse(field.id, e.target.value)}
              placeholder={getLocalizedText(qField.placeholder, qField.placeholderEN)}
              className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
              }`}
            />
            {hasError && <p className="text-red-400 text-sm">{validationErrors[field.id]}</p>}
          </div>
        );
      }
      
      case 'prompt': {
        const pField = field as JourneyPromptField;
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-white font-medium">
              {getLocalizedText(pField.label, pField.labelEN)}
              {pField.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {pField.hint && (
              <p className="text-gray-400 text-sm italic">
                💡 {getLocalizedText(pField.hint, pField.hintEN)}
              </p>
            )}
            <textarea
              value={currentResponses[field.id] || ''}
              onChange={(e) => updateResponse(field.id, e.target.value)}
              placeholder={getLocalizedText(pField.placeholder, pField.placeholderEN)}
              rows={4}
              className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
              }`}
            />
            {hasError && <p className="text-red-400 text-sm">{validationErrors[field.id]}</p>}
          </div>
        );
      }
      
      case 'data': {
        const dField = field as JourneyDataField;
        const currentList = currentResponses[field.id] || [];
        
        return (
          <div key={field.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-white font-medium">
                {getLocalizedText(dField.label, dField.labelEN)}
                {dField.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <button
                onClick={() => addToList(field.id)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                <MuiIcon name="Add" className="mr-1" />
                Ajouter
              </button>
            </div>
            
            {dField.description && (
              <p className="text-gray-400 text-sm">
                {getLocalizedText(dField.description, dField.descriptionEN)}
              </p>
            )}
            
            {dField.inputType === 'text-list' && (
              <div className="space-y-2">
                {currentList.map((item: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateListItem(field.id, index, e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder={`Élément ${index + 1}`}
                    />
                    <button
                      onClick={() => removeFromList(field.id, index)}
                      className="p-2 hover:bg-red-500/30 rounded-lg text-gray-400 hover:text-red-400"
                    >
                      <MuiIcon name="Delete" />
                    </button>
                  </div>
                ))}
                {currentList.length === 0 && (
                  <p className="text-gray-500 text-sm py-4 text-center border border-dashed border-gray-700 rounded-lg">
                    Aucun élément. Cliquez sur "Ajouter" pour commencer.
                  </p>
                )}
              </div>
            )}
            
            {dField.inputType === 'select' && dField.options && (
              <select
                value={currentResponses[field.id] || ''}
                onChange={(e) => updateResponse(field.id, e.target.value)}
                className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 ${
                  hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
                }`}
              >
                <option value="">Sélectionnez...</option>
                {dField.options.map(opt => (
                  <option key={opt.id} value={opt.value}>
                    {getLocalizedText(opt.label, opt.labelEN)}
                  </option>
                ))}
              </select>
            )}
            
            {dField.inputType === 'multiselect' && dField.options && (
              <div className="space-y-2">
                {dField.options.map(opt => (
                  <label key={opt.id} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                    <input
                      type="checkbox"
                      checked={(currentResponses[field.id] || []).includes(opt.value)}
                      onChange={(e) => {
                        const current = currentResponses[field.id] || [];
                        if (e.target.checked) {
                          updateResponse(field.id, [...current, opt.value]);
                        } else {
                          updateResponse(field.id, current.filter((v: string) => v !== opt.value));
                        }
                      }}
                      className="w-5 h-5 rounded text-blue-600"
                    />
                    <span className="text-white">{getLocalizedText(opt.label, opt.labelEN)}</span>
                  </label>
                ))}
              </div>
            )}
            
            {dField.inputType === 'key-value' && (
              <div className="space-y-2">
                {currentList.map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.key || ''}
                      onChange={(e) => updateListItem(field.id, index, { ...item, key: e.target.value })}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="Clé"
                    />
                    <input
                      type="text"
                      value={item.value || ''}
                      onChange={(e) => updateListItem(field.id, index, { ...item, value: e.target.value })}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="Valeur"
                    />
                    <button
                      onClick={() => removeFromList(field.id, index)}
                      className="p-2 hover:bg-red-500/30 rounded-lg text-gray-400 hover:text-red-400"
                    >
                      <MuiIcon name="Delete" />
                    </button>
                  </div>
                ))}
                {currentList.length === 0 && (
                  <p className="text-gray-500 text-sm py-4 text-center border border-dashed border-gray-700 rounded-lg">
                    Aucune paire clé-valeur. Cliquez sur "Ajouter" pour commencer.
                  </p>
                )}
              </div>
            )}
            
            {hasError && <p className="text-red-400 text-sm">{validationErrors[field.id]}</p>}
          </div>
        );
      }
      
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-rose-900/50 to-pink-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 rounded-xl">
              <MuiIcon name="Route" className="text-2xl text-rose-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {view === 'select' && 'Parcours de création'}
                {view === 'play' && currentJourney?.name}
                {view === 'generating' && 'Génération en cours...'}
                {view === 'complete' && 'Parcours terminé !'}
              </h2>
              {view === 'play' && (
                <p className="text-sm text-gray-400">
                  Étape {progress.current} sur {progress.total}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <MuiIcon name="Close" className="text-2xl" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto">
          {/* Vue: Sélection du parcours */}
          {view === 'select' && (
            <div className="p-6 space-y-6">
              <p className="text-gray-300">
                Choisissez un parcours pour vous guider dans la création de votre cockpit.
                À la fin du parcours, l'IA générera automatiquement les éléments en fonction de vos réponses.
              </p>
              
              {activeJourneys.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MuiIcon name="Route" className="text-5xl mb-3 opacity-50" />
                  <p className="text-lg">Aucun parcours disponible</p>
                  <p className="text-sm mt-2">
                    Les parcours sont créés par les administrateurs du studio.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {activeJourneys.map((journey) => (
                    <div
                      key={journey.id}
                      onClick={() => setSelectedJourneyId(journey.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedJourneyId === journey.id
                          ? 'bg-rose-500/20 border-rose-500 shadow-lg'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                          selectedJourneyId === journey.id ? 'bg-rose-500/30' : 'bg-gray-700'
                        }`}>
                          <MuiIcon
                            name={journey.icon || 'Route'}
                            className={`text-2xl ${
                              selectedJourneyId === journey.id ? 'text-rose-400' : 'text-gray-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">
                            {getLocalizedText(journey.name, journey.nameEN)}
                          </h3>
                          {journey.description && (
                            <p className="text-gray-400 text-sm mt-1">
                              {getLocalizedText(journey.description, journey.descriptionEN)}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MuiIcon name="Layers" className="text-sm" />
                              {journey.steps.length} étape{journey.steps.length > 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <MuiIcon name="AutoAwesome" className="text-sm" />
                              Génère : {journey.targetGeneration === 'domain' ? '1 domaine' : journey.targetGeneration === 'domains' ? 'Plusieurs domaines' : journey.targetGeneration}
                            </span>
                          </div>
                        </div>
                        {selectedJourneyId === journey.id && (
                          <MuiIcon name="CheckCircle" className="text-2xl text-rose-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vue: Lecture du parcours */}
          {view === 'play' && currentStep && (
            <div className="p-6">
              {/* Barre de progression */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {Array.from({ length: progress.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        i < progress.current
                          ? 'bg-rose-500'
                          : i === progress.current - 1
                          ? 'bg-rose-400'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Contenu de l'étape */}
              <div className="space-y-6">
                {/* Titre de l'étape */}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    currentStep.type === 'presentation' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                  }`}>
                    <MuiIcon
                      name={currentStep.icon || (currentStep.type === 'presentation' ? 'Article' : 'QuestionAnswer')}
                      className={`text-xl ${
                        currentStep.type === 'presentation' ? 'text-emerald-400' : 'text-purple-400'
                      }`}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {getLocalizedText(currentStep.title, currentStep.titleEN)}
                  </h3>
                </div>

                {/* Étape de présentation */}
                {currentStep.type === 'presentation' && (
                  <div
                    className="prose prose-invert prose-lg max-w-none bg-gray-800 rounded-xl p-6"
                    dangerouslySetInnerHTML={{
                      __html: getLocalizedText(
                        (currentStep as JourneyPresentationStep).content,
                        (currentStep as JourneyPresentationStep).contentEN
                      )
                    }}
                  />
                )}

                {/* Étape d'interaction */}
                {currentStep.type === 'interaction' && (
                  <div className="space-y-6">
                    {(currentStep as JourneyInteractionStep).description && (
                      <p className="text-gray-300 bg-gray-800 rounded-xl p-4">
                        {getLocalizedText(
                          (currentStep as JourneyInteractionStep).description,
                          (currentStep as JourneyInteractionStep).descriptionEN
                        )}
                      </p>
                    )}
                    
                    <div className="space-y-6">
                      {((currentStep as JourneyInteractionStep).fields || []).map(field => renderField(field))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vue: Génération en cours */}
          {view === 'generating' && (
            <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
              <div className="animate-spin mb-6">
                <MuiIcon name="AutoAwesome" className="text-6xl text-rose-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                L'IA génère votre cockpit...
              </h3>
              <p className="text-gray-400 text-center max-w-md">
                Analyse de vos réponses et création de la structure optimale
                pour votre domaine de pilotage.
              </p>
            </div>
          )}

          {/* Vue: Parcours terminé */}
          {view === 'complete' && (
            <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
              <div className="mb-6 p-4 bg-green-500/20 rounded-full">
                <MuiIcon name="CheckCircle" className="text-6xl text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Parcours terminé avec succès !
              </h3>
              {generationResult && generationResult.domainIds.length > 0 ? (
                <p className="text-gray-400 text-center max-w-md">
                  {generationResult.domainIds.length} domaine{generationResult.domainIds.length > 1 ? 's' : ''} créé{generationResult.domainIds.length > 1 ? 's' : ''} avec succès.
                  Vous pouvez maintenant le{generationResult.domainIds.length > 1 ? 's' : ''} personnaliser dans le studio.
                </p>
              ) : (
                <p className="text-gray-400 text-center max-w-md">
                  Le parcours est terminé. Vous pouvez fermer cette fenêtre.
                </p>
              )}
            </div>
          )}

          {/* Message d'erreur */}
          {error && (
            <div className="mx-6 mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer avec navigation */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <div>
            {view === 'play' && (
              <button
                onClick={handleAbandon}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <MuiIcon name="Cancel" className="mr-2" />
                Abandonner
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {view === 'select' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleStartJourney}
                  disabled={!selectedJourneyId}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <MuiIcon name="PlayArrow" className="mr-2" />
                  Commencer
                </button>
              </>
            )}
            
            {view === 'play' && (
              <>
                {progress.current > 1 && (
                  <button
                    onClick={handlePrevious}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    <MuiIcon name="ArrowBack" className="mr-2" />
                    Précédent
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={isLoading}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {progress.current >= progress.total ? (
                    <>
                      <MuiIcon name="AutoAwesome" className="mr-2" />
                      Générer
                    </>
                  ) : (
                    <>
                      Suivant
                      <MuiIcon name="ArrowForward" className="ml-2" />
                    </>
                  )}
                </button>
              </>
            )}
            
            {(view === 'complete' || view === 'generating') && (
              <button
                onClick={handleClose}
                disabled={view === 'generating'}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                <MuiIcon name="Check" className="mr-2" />
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
