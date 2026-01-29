import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Tutorial, TutorialChapter, TutorialSubChapter, TutorialProgress } from '../types';
import { useAuthStore } from '../store/authStore';
import { useLanguage } from './LanguageContext';

// Chapitres par défaut du tutoriel
const DEFAULT_TUTORIAL: Tutorial = {
  id: 'default',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  chapters: [
    {
      id: 'ch1-welcome',
      title: 'Bienvenue',
      titleEN: 'Welcome',
      description: 'Présentation générale du studio',
      descriptionEN: 'General overview of the studio',
      icon: 'Celebration',
      order: 1,
      subChapters: [
        {
          id: 'ch1-sub1',
          title: 'Bienvenue dans SOMONE Cockpit Studio',
          titleEN: 'Welcome to SOMONE Cockpit Studio',
          content: '<p>Bienvenue dans <strong>SOMONE Cockpit Studio</strong> !</p><p>Cette application vous permet de créer des maquettes de cockpits de supervision pour visualiser l\'état de vos services et infrastructures.</p><p>Ce tutoriel va vous guider pas à pas dans la création de votre premier cockpit.</p>',
          contentEN: '<p>Welcome to <strong>SOMONE Cockpit Studio</strong>!</p><p>This application allows you to create supervision cockpit mockups to visualize the status of your services and infrastructure.</p><p>This tutorial will guide you step by step through creating your first cockpit.</p>',
          order: 1,
          action: 'observe'
        }
      ]
    },
    {
      id: 'ch2-navigation',
      title: 'Navigation',
      titleEN: 'Navigation',
      description: 'Tour de la page d\'accueil',
      descriptionEN: 'Tour of the home page',
      icon: 'Explore',
      order: 2,
      subChapters: [
        {
          id: 'ch2-sub1',
          title: 'La page d\'accueil',
          titleEN: 'The home page',
          content: '<p>Vous êtes sur la <strong>page d\'accueil</strong>. C\'est ici que vous retrouverez toutes vos maquettes de cockpits.</p><p>Vous pouvez les organiser en dossiers, les partager avec d\'autres utilisateurs, et les publier pour les rendre accessibles.</p>',
          contentEN: '<p>You are on the <strong>home page</strong>. This is where you will find all your cockpit mockups.</p><p>You can organize them in folders, share them with other users, and publish them to make them accessible.</p>',
          order: 1,
          targetElement: 'home-cockpits-list',
          action: 'observe'
        },
        {
          id: 'ch2-sub2',
          title: 'Le bouton Nouvelle maquette',
          titleEN: 'The New mockup button',
          content: '<p>Le bouton <strong>Nouvelle</strong> en haut à droite vous permet de créer une nouvelle maquette.</p><p>Cliquez dessus pour commencer !</p>',
          contentEN: '<p>The <strong>New</strong> button in the top right allows you to create a new mockup.</p><p>Click on it to get started!</p>',
          order: 2,
          targetElement: 'home-btn-new-cockpit',
          action: 'click'
        }
      ]
    },
    {
      id: 'ch3-create',
      title: 'Créer un cockpit',
      titleEN: 'Create a cockpit',
      description: 'Création de votre première maquette',
      descriptionEN: 'Creating your first mockup',
      icon: 'AddCircle',
      order: 3,
      subChapters: [
        {
          id: 'ch3-sub1',
          title: 'Nommer votre cockpit',
          titleEN: 'Name your cockpit',
          content: '<p>Donnez un <strong>nom</strong> à votre cockpit. Ce nom sera visible dans la liste et dans le bandeau du cockpit publié.</p><p>Exemple : "Supervision IT", "État des services", "Cockpit Production"...</p>',
          contentEN: '<p>Give your cockpit a <strong>name</strong>. This name will be visible in the list and in the published cockpit banner.</p><p>Example: "IT Supervision", "Service Status", "Production Cockpit"...</p>',
          order: 1,
          action: 'input'
        }
      ]
    },
    {
      id: 'ch4-domains',
      title: 'Les domaines',
      titleEN: 'Domains',
      description: 'Ajout et configuration des onglets',
      descriptionEN: 'Adding and configuring tabs',
      icon: 'Tab',
      order: 4,
      subChapters: [
        {
          id: 'ch4-sub1',
          title: 'Qu\'est-ce qu\'un domaine ?',
          titleEN: 'What is a domain?',
          content: '<p>Un <strong>domaine</strong> est un onglet dans votre cockpit. Il regroupe des catégories et des éléments liés à un même thème.</p><p>Exemples : "Infrastructure", "Applications", "Réseau", "Sécurité"...</p>',
          contentEN: '<p>A <strong>domain</strong> is a tab in your cockpit. It groups categories and elements related to the same theme.</p><p>Examples: "Infrastructure", "Applications", "Network", "Security"...</p>',
          order: 1,
          action: 'observe'
        },
        {
          id: 'ch4-sub2',
          title: 'Ajouter un domaine',
          titleEN: 'Add a domain',
          content: '<p>Cliquez sur le bouton <strong>+ Domaine</strong> dans la barre de navigation pour ajouter un nouveau domaine à votre cockpit.</p>',
          contentEN: '<p>Click the <strong>+ Domain</strong> button in the navigation bar to add a new domain to your cockpit.</p>',
          order: 2,
          targetElement: 'navbar',
          action: 'click'
        }
      ]
    },
    {
      id: 'ch5-categories',
      title: 'Les catégories',
      titleEN: 'Categories',
      description: 'Organisation des éléments',
      descriptionEN: 'Organizing elements',
      icon: 'Category',
      order: 5,
      subChapters: [
        {
          id: 'ch5-sub1',
          title: 'Organiser avec les catégories',
          titleEN: 'Organize with categories',
          content: '<p>Les <strong>catégories</strong> permettent d\'organiser vos éléments au sein d\'un domaine.</p><p>Elles peuvent être horizontales (éléments côte à côte) ou verticales (éléments empilés).</p>',
          contentEN: '<p><strong>Categories</strong> allow you to organize your elements within a domain.</p><p>They can be horizontal (elements side by side) or vertical (stacked elements).</p>',
          order: 1,
          action: 'observe'
        }
      ]
    },
    {
      id: 'ch6-elements',
      title: 'Les éléments',
      titleEN: 'Elements',
      description: 'Création et configuration des tuiles',
      descriptionEN: 'Creating and configuring tiles',
      icon: 'Widgets',
      order: 6,
      subChapters: [
        {
          id: 'ch6-sub1',
          title: 'Les tuiles d\'éléments',
          titleEN: 'Element tiles',
          content: '<p>Un <strong>élément</strong> est une tuile qui représente un service, une application, un serveur, etc.</p><p>Chaque élément a un nom, un statut (couleur), et peut avoir une valeur, une icône, et des sous-éléments.</p>',
          contentEN: '<p>An <strong>element</strong> is a tile that represents a service, application, server, etc.</p><p>Each element has a name, a status (color), and can have a value, an icon, and sub-elements.</p>',
          order: 1,
          action: 'observe'
        }
      ]
    },
    {
      id: 'ch7-status',
      title: 'Les statuts',
      titleEN: 'Statuses',
      description: 'Système de couleurs et criticité',
      descriptionEN: 'Color system and criticality',
      icon: 'Traffic',
      order: 7,
      subChapters: [
        {
          id: 'ch7-sub1',
          title: 'Comprendre les statuts',
          titleEN: 'Understanding statuses',
          content: '<p>Chaque élément peut avoir un <strong>statut</strong> qui indique son état :</p><ul><li><span style="color:#22C55E">●</span> <strong>OK</strong> : Tout fonctionne normalement</li><li><span style="color:#FFB74D">●</span> <strong>Mineur</strong> : Problème mineur</li><li><span style="color:#FF7043">●</span> <strong>Critique</strong> : Problème important</li><li><span style="color:#EF4444">●</span> <strong>Fatal</strong> : Problème bloquant</li><li><span style="color:#94A3B8">●</span> <strong>Déconnecté</strong> : Service non disponible</li></ul>',
          contentEN: '<p>Each element can have a <strong>status</strong> indicating its state:</p><ul><li><span style="color:#22C55E">●</span> <strong>OK</strong>: Everything works normally</li><li><span style="color:#FFB74D">●</span> <strong>Minor</strong>: Minor issue</li><li><span style="color:#FF7043">●</span> <strong>Critical</strong>: Important issue</li><li><span style="color:#EF4444">●</span> <strong>Fatal</strong>: Blocking issue</li><li><span style="color:#94A3B8">●</span> <strong>Disconnected</strong>: Service unavailable</li></ul>',
          order: 1,
          action: 'observe'
        }
      ]
    },
    {
      id: 'ch8-publish',
      title: 'Publication',
      titleEN: 'Publishing',
      description: 'Publier et partager votre cockpit',
      descriptionEN: 'Publish and share your cockpit',
      icon: 'Share',
      order: 8,
      subChapters: [
        {
          id: 'ch8-sub1',
          title: 'Publier votre cockpit',
          titleEN: 'Publish your cockpit',
          content: '<p>Une fois votre cockpit terminé, vous pouvez le <strong>publier</strong> pour le rendre accessible via une URL unique.</p><p>Retournez sur la page d\'accueil et cliquez sur le bouton <strong>Publier</strong> de votre maquette.</p>',
          contentEN: '<p>Once your cockpit is complete, you can <strong>publish</strong> it to make it accessible via a unique URL.</p><p>Return to the home page and click the <strong>Publish</strong> button on your mockup.</p>',
          order: 1,
          action: 'observe'
        },
        {
          id: 'ch8-sub2',
          title: 'Félicitations !',
          titleEN: 'Congratulations!',
          content: '<p>🎉 <strong>Félicitations !</strong> Vous avez terminé le tutoriel.</p><p>Vous êtes maintenant prêt à créer vos propres cockpits de supervision.</p><p>N\'hésitez pas à relancer ce tutoriel depuis le menu utilisateur si vous avez besoin d\'un rappel.</p>',
          contentEN: '<p>🎉 <strong>Congratulations!</strong> You have completed the tutorial.</p><p>You are now ready to create your own supervision cockpits.</p><p>Feel free to restart this tutorial from the user menu if you need a reminder.</p>',
          order: 2,
          action: 'observe'
        }
      ]
    }
  ]
};

interface TutorialContextType {
  // Données du tutoriel
  tutorial: Tutorial | null;
  isLoading: boolean;
  error: string | null;
  
  // État du lecteur (pour les clients)
  isPlaying: boolean;
  currentChapter: TutorialChapter | null;
  currentSubChapter: TutorialSubChapter | null;
  progress: TutorialProgress | null;
  
  // Actions
  loadTutorial: () => Promise<void>;
  saveTutorial: (tutorial: Tutorial) => Promise<boolean>;
  startTutorial: () => void;
  stopTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToChapter: (chapterId: string) => void;
  skipTutorial: () => void;
  resetProgress: () => void;
  
  // Langue (depuis LanguageContext)
  language: 'FR' | 'EN';
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuthStore();
  const { language } = useLanguage(); // Utiliser la langue du contexte global
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // État du lecteur
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentSubChapterIndex, setCurrentSubChapterIndex] = useState(0);
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  
  // Charger le tutoriel depuis l'API
  const loadTutorial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/tutorial', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        setTutorial(data.tutorial || DEFAULT_TUTORIAL);
      } else {
        // Si pas de tutoriel en base, utiliser le défaut
        setTutorial(DEFAULT_TUTORIAL);
      }
    } catch (err) {
      console.error('[Tutorial] Erreur chargement:', err);
      setTutorial(DEFAULT_TUTORIAL);
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  
  // Sauvegarder le tutoriel (admin uniquement)
  const saveTutorial = useCallback(async (tutorialData: Tutorial): Promise<boolean> => {
    if (!token || !user?.isAdmin) {
      setError('Accès non autorisé');
      return false;
    }
    
    try {
      const response = await fetch('/api/tutorial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tutorial: tutorialData })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTutorial(data.tutorial);
        return true;
      } else {
        const err = await response.json();
        setError(err.error || 'Erreur de sauvegarde');
        return false;
      }
    } catch (err) {
      console.error('[Tutorial] Erreur sauvegarde:', err);
      setError('Erreur de connexion');
      return false;
    }
  }, [token, user]);
  
  // Charger la progression de l'utilisateur
  const loadProgress = useCallback(async () => {
    if (!user || !token) return;
    
    // Charger depuis localStorage pour l'instant
    const saved = localStorage.getItem(`tutorial-progress-${user.id}`);
    if (saved) {
      try {
        setProgress(JSON.parse(saved));
      } catch {
        setProgress(null);
      }
    }
  }, [user, token]);
  
  // Sauvegarder la progression
  const saveProgress = useCallback((newProgress: TutorialProgress) => {
    if (!user) return;
    setProgress(newProgress);
    localStorage.setItem(`tutorial-progress-${user.id}`, JSON.stringify(newProgress));
  }, [user]);
  
  // Démarrer le tutoriel
  const startTutorial = useCallback(() => {
    if (!tutorial || tutorial.chapters.length === 0) return;
    
    setIsPlaying(true);
    setCurrentChapterIndex(0);
    setCurrentSubChapterIndex(0);
    
    if (user && !progress) {
      saveProgress({
        userId: user.id,
        completed: false,
        startedAt: new Date().toISOString(),
        completedChapters: [],
        completedSubChapters: [],
        skipped: false
      });
    }
  }, [tutorial, user, progress, saveProgress]);
  
  // Arrêter le tutoriel
  const stopTutorial = useCallback(() => {
    setIsPlaying(false);
  }, []);
  
  // Étape suivante
  const nextStep = useCallback(() => {
    if (!tutorial) return;
    
    const chapter = tutorial.chapters[currentChapterIndex];
    if (!chapter) return;
    
    // Marquer le sous-chapitre comme terminé
    if (progress && user) {
      const subChapter = chapter.subChapters[currentSubChapterIndex];
      if (subChapter && !progress.completedSubChapters.includes(subChapter.id)) {
        const newProgress = {
          ...progress,
          completedSubChapters: [...progress.completedSubChapters, subChapter.id]
        };
        saveProgress(newProgress);
      }
    }
    
    // Passer au sous-chapitre suivant
    if (currentSubChapterIndex < chapter.subChapters.length - 1) {
      setCurrentSubChapterIndex(prev => prev + 1);
    } else {
      // Marquer le chapitre comme terminé
      if (progress && user && !progress.completedChapters.includes(chapter.id)) {
        const newProgress = {
          ...progress,
          completedChapters: [...progress.completedChapters, chapter.id]
        };
        saveProgress(newProgress);
      }
      
      // Passer au chapitre suivant
      if (currentChapterIndex < tutorial.chapters.length - 1) {
        setCurrentChapterIndex(prev => prev + 1);
        setCurrentSubChapterIndex(0);
      } else {
        // Tutoriel terminé
        if (progress && user) {
          saveProgress({
            ...progress,
            completed: true,
            completedAt: new Date().toISOString()
          });
        }
        setIsPlaying(false);
      }
    }
  }, [tutorial, currentChapterIndex, currentSubChapterIndex, progress, user, saveProgress]);
  
  // Étape précédente
  const prevStep = useCallback(() => {
    if (currentSubChapterIndex > 0) {
      setCurrentSubChapterIndex(prev => prev - 1);
    } else if (currentChapterIndex > 0) {
      setCurrentChapterIndex(prev => prev - 1);
      const prevChapter = tutorial?.chapters[currentChapterIndex - 1];
      if (prevChapter) {
        setCurrentSubChapterIndex(prevChapter.subChapters.length - 1);
      }
    }
  }, [currentChapterIndex, currentSubChapterIndex, tutorial]);
  
  // Aller à un chapitre spécifique
  const goToChapter = useCallback((chapterId: string) => {
    if (!tutorial) return;
    
    const chapterIndex = tutorial.chapters.findIndex(c => c.id === chapterId);
    if (chapterIndex >= 0) {
      setCurrentChapterIndex(chapterIndex);
      setCurrentSubChapterIndex(0);
      setIsPlaying(true);
    }
  }, [tutorial]);
  
  // Sauter le tutoriel
  const skipTutorial = useCallback(() => {
    if (progress && user) {
      saveProgress({
        ...progress,
        skipped: true
      });
    } else if (user) {
      saveProgress({
        userId: user.id,
        completed: false,
        skipped: true,
        completedChapters: [],
        completedSubChapters: []
      });
    }
    setIsPlaying(false);
  }, [progress, user, saveProgress]);
  
  // Réinitialiser la progression
  const resetProgress = useCallback(() => {
    if (user) {
      localStorage.removeItem(`tutorial-progress-${user.id}`);
      setProgress(null);
    }
  }, [user]);
  
  // Charger le tutoriel et la progression au démarrage
  useEffect(() => {
    loadTutorial();
    loadProgress();
  }, [loadTutorial, loadProgress]);
  
  // Chapitres et sous-chapitres courants
  const currentChapter = tutorial?.chapters[currentChapterIndex] || null;
  const currentSubChapter = currentChapter?.subChapters[currentSubChapterIndex] || null;
  
  return (
    <TutorialContext.Provider value={{
      tutorial,
      isLoading,
      error,
      isPlaying,
      currentChapter,
      currentSubChapter,
      progress,
      loadTutorial,
      saveTutorial,
      startTutorial,
      stopTutorial,
      nextStep,
      prevStep,
      goToChapter,
      skipTutorial,
      resetProgress,
      language
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
