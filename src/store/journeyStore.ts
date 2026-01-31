import { create } from 'zustand';
import type {
  JourneyStep,
  JourneyPresentationStep,
  JourneyInteractionStep,
  Journey,
  JourneySession,
  JourneyStepResponse,
  JourneyFieldResponse,
  JourneyInteractionField,
} from '../types';
import { useAuthStore } from './authStore';

const API_URL = '/api';

// Helper pour générer un ID unique
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

interface JourneyState {
  // Données
  steps: JourneyStep[];
  journeys: Journey[];
  currentSession: JourneySession | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // === GESTION DES ÉTAPES ===
  fetchSteps: () => Promise<void>;
  createStep: (step: Omit<JourneyStep, 'id' | 'createdAt' | 'updatedAt'>) => Promise<JourneyStep | null>;
  updateStep: (id: string, updates: Partial<JourneyStep>) => Promise<boolean>;
  deleteStep: (id: string) => Promise<boolean>;
  duplicateStep: (id: string) => Promise<JourneyStep | null>;
  reorderSteps: (stepIds: string[]) => Promise<void>;
  
  // === GESTION DES PARCOURS ===
  fetchJourneys: () => Promise<void>;
  createJourney: (journey: Omit<Journey, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Journey | null>;
  updateJourney: (id: string, updates: Partial<Journey>) => Promise<boolean>;
  deleteJourney: (id: string) => Promise<boolean>;
  duplicateJourney: (id: string) => Promise<Journey | null>;
  toggleJourneyActive: (id: string) => Promise<boolean>;
  
  // === EXÉCUTION D'UN PARCOURS ===
  startJourney: (journeyId: string, cockpitId?: string) => Promise<JourneySession | null>;
  submitStepResponse: (responses: JourneyFieldResponse[]) => Promise<boolean>;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  abandonSession: () => Promise<void>;
  completeSession: () => Promise<{ domainIds: string[] } | null>;
  
  // === HELPERS ===
  getStepById: (id: string) => JourneyStep | undefined;
  getJourneyById: (id: string) => Journey | undefined;
  getActiveJourneys: () => Journey[];
  getCurrentStep: () => JourneyStep | undefined;
  getSessionProgress: () => { current: number; total: number };
  getAllResponses: () => Record<string, any>;
  clearError: () => void;
}

export const useJourneyStore = create<JourneyState>()((set, get) => ({
  // État initial
  steps: [],
  journeys: [],
  currentSession: null,
  isLoading: false,
  error: null,

  // === GESTION DES ÉTAPES ===
  
  fetchSteps: async () => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/steps`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erreur lors du chargement des étapes');
      
      const data = await response.json();
      set({ steps: data.steps || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createStep: async (stepData) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(stepData),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la création de l\'étape');
      
      const data = await response.json();
      const newStep = data.step;
      
      set((state) => ({
        steps: [...state.steps, newStep],
        isLoading: false,
      }));
      
      return newStep;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  updateStep: async (id, updates) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/steps/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la mise à jour de l\'étape');
      
      const data = await response.json();
      
      set((state) => ({
        steps: state.steps.map(s => s.id === id ? data.step : s),
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  deleteStep: async (id) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/steps/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erreur lors de la suppression de l\'étape');
      
      set((state) => ({
        steps: state.steps.filter(s => s.id !== id),
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  duplicateStep: async (id) => {
    const step = get().getStepById(id);
    if (!step) return null;
    
    const duplicatedStep = {
      ...step,
      name: `${step.name} (copie)`,
    };
    // Retirer les propriétés qui seront régénérées
    delete (duplicatedStep as any).id;
    delete (duplicatedStep as any).createdAt;
    delete (duplicatedStep as any).updatedAt;
    
    return get().createStep(duplicatedStep as any);
  },

  reorderSteps: async (stepIds) => {
    const token = useAuthStore.getState().token;
    
    // Mise à jour optimiste locale
    set((state) => ({
      steps: stepIds.map((id, index) => {
        const step = state.steps.find(s => s.id === id);
        return step ? { ...step, order: index } : step;
      }).filter(Boolean) as JourneyStep[],
    }));
    
    try {
      await fetch(`${API_URL}/journey/steps/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stepIds }),
      });
    } catch (error) {
      console.error('Erreur réorganisation étapes:', error);
      // Recharger en cas d'erreur
      await get().fetchSteps();
    }
  },

  // === GESTION DES PARCOURS ===
  
  fetchJourneys: async () => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/journeys`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erreur lors du chargement des parcours');
      
      const data = await response.json();
      set({ journeys: data.journeys || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createJourney: async (journeyData) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/journeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(journeyData),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la création du parcours');
      
      const data = await response.json();
      const newJourney = data.journey;
      
      set((state) => ({
        journeys: [...state.journeys, newJourney],
        isLoading: false,
      }));
      
      return newJourney;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  updateJourney: async (id, updates) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/journeys/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la mise à jour du parcours');
      
      const data = await response.json();
      
      set((state) => ({
        journeys: state.journeys.map(j => j.id === id ? data.journey : j),
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  deleteJourney: async (id) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/journey/journeys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erreur lors de la suppression du parcours');
      
      set((state) => ({
        journeys: state.journeys.filter(j => j.id !== id),
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  duplicateJourney: async (id) => {
    const journey = get().getJourneyById(id);
    if (!journey) return null;
    
    const duplicatedJourney = {
      ...journey,
      name: `${journey.name} (copie)`,
      isActive: false, // Le duplicata est inactif par défaut
    };
    delete (duplicatedJourney as any).id;
    delete (duplicatedJourney as any).createdAt;
    delete (duplicatedJourney as any).updatedAt;
    
    return get().createJourney(duplicatedJourney as any);
  },

  toggleJourneyActive: async (id) => {
    const journey = get().getJourneyById(id);
    if (!journey) return false;
    
    return get().updateJourney(id, { isActive: !journey.isActive });
  },

  // === EXÉCUTION D'UN PARCOURS ===
  
  startJourney: async (journeyId, cockpitId) => {
    const journey = get().getJourneyById(journeyId);
    if (!journey || !journey.isActive) {
      set({ error: 'Parcours non disponible' });
      return null;
    }
    
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ error: 'Utilisateur non connecté' });
      return null;
    }
    
    const session: JourneySession = {
      id: generateId(),
      journeyId,
      userId: user.id,
      cockpitId,
      currentStepIndex: 0,
      stepResponses: [],
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };
    
    set({ currentSession: session, error: null });
    return session;
  },

  submitStepResponse: async (responses) => {
    const { currentSession, journeys, steps } = get();
    if (!currentSession) return false;
    
    const journey = journeys.find(j => j.id === currentSession.journeyId);
    if (!journey) return false;
    
    const currentStepLink = journey.steps[currentSession.currentStepIndex];
    if (!currentStepLink) return false;
    
    const stepResponse: JourneyStepResponse = {
      stepId: currentStepLink.stepId,
      responses,
      completedAt: new Date().toISOString(),
    };
    
    set((state) => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        stepResponses: [...state.currentSession.stepResponses, stepResponse],
      } : null,
    }));
    
    return true;
  },

  goToNextStep: () => {
    const { currentSession, journeys } = get();
    if (!currentSession) return;
    
    const journey = journeys.find(j => j.id === currentSession.journeyId);
    if (!journey) return;
    
    const nextIndex = currentSession.currentStepIndex + 1;
    if (nextIndex >= journey.steps.length) {
      // Fin du parcours
      return;
    }
    
    set((state) => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        currentStepIndex: nextIndex,
      } : null,
    }));
  },

  goToPreviousStep: () => {
    const { currentSession } = get();
    if (!currentSession || currentSession.currentStepIndex === 0) return;
    
    set((state) => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        currentStepIndex: state.currentSession.currentStepIndex - 1,
      } : null,
    }));
  },

  abandonSession: async () => {
    set((state) => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        status: 'abandoned',
      } : null,
    }));
    
    // Petit délai puis fermer la session
    setTimeout(() => {
      set({ currentSession: null });
    }, 100);
  },

  completeSession: async () => {
    const { currentSession } = get();
    if (!currentSession) return null;
    
    const token = useAuthStore.getState().token;
    
    try {
      // Appeler l'API pour générer le domaine avec l'IA
      const response = await fetch(`${API_URL}/journey/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          journeyId: currentSession.journeyId,
          cockpitId: currentSession.cockpitId,
          responses: currentSession.stepResponses,
        }),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la génération');
      
      const data = await response.json();
      
      set((state) => ({
        currentSession: state.currentSession ? {
          ...state.currentSession,
          status: 'completed',
          completedAt: new Date().toISOString(),
          generatedDomainIds: data.domainIds,
        } : null,
      }));
      
      return { domainIds: data.domainIds || [] };
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  // === HELPERS ===
  
  getStepById: (id) => {
    return get().steps.find(s => s.id === id);
  },

  getJourneyById: (id) => {
    return get().journeys.find(j => j.id === id);
  },

  getActiveJourneys: () => {
    return get().journeys.filter(j => j.isActive);
  },

  getCurrentStep: () => {
    const { currentSession, journeys, steps } = get();
    if (!currentSession) return undefined;
    
    const journey = journeys.find(j => j.id === currentSession.journeyId);
    if (!journey) return undefined;
    
    const stepLink = journey.steps[currentSession.currentStepIndex];
    if (!stepLink) return undefined;
    
    return steps.find(s => s.id === stepLink.stepId);
  },

  getSessionProgress: () => {
    const { currentSession, journeys } = get();
    if (!currentSession) return { current: 0, total: 0 };
    
    const journey = journeys.find(j => j.id === currentSession.journeyId);
    if (!journey) return { current: 0, total: 0 };
    
    return {
      current: currentSession.currentStepIndex + 1,
      total: journey.steps.length,
    };
  },

  getAllResponses: () => {
    const { currentSession, steps } = get();
    if (!currentSession) return {};
    
    const allResponses: Record<string, any> = {};
    
    for (const stepResponse of currentSession.stepResponses) {
      const step = steps.find(s => s.id === stepResponse.stepId);
      if (!step) continue;
      
      for (const fieldResponse of stepResponse.responses) {
        allResponses[fieldResponse.fieldId] = {
          stepId: stepResponse.stepId,
          stepName: step.name,
          fieldType: fieldResponse.fieldType,
          value: fieldResponse.value,
        };
      }
    }
    
    return allResponses;
  },

  clearError: () => set({ error: null }),
}));
