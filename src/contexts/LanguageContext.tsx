import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';

// Types
export type Language = 'FR' | 'EN';

// Traductions par défaut du studio
export const DEFAULT_TRANSLATIONS: Record<string, { FR: string; EN: string }> = {
  // === Navigation et Header ===
  'nav.home': { FR: 'Accueil', EN: 'Home' },
  'nav.studio': { FR: 'Studio', EN: 'Studio' },
  'nav.back': { FR: 'Retour', EN: 'Back' },
  'nav.explodedView': { FR: 'Vue éclatée', EN: 'Exploded View' },
  
  // === Page d'accueil ===
  'home.title': { FR: 'SOMONE Cockpit Studio', EN: 'SOMONE Cockpit Studio' },
  'home.titleClient': { FR: 'OPEN COCKPIT', EN: 'OPEN COCKPIT' },
  'home.subtitle': { FR: 'Gérez vos maquettes de cockpits', EN: 'Manage your cockpit mockups' },
  'home.newMockup': { FR: 'Nouvelle', EN: 'New' },
  'home.newFolder': { FR: 'Répertoire', EN: 'Folder' },
  'home.import': { FR: 'Importer', EN: 'Import' },
  'home.infos': { FR: 'Infos', EN: 'Info' },
  'home.users': { FR: 'Utilisateurs', EN: 'Users' },
  'home.tutorial': { FR: 'Tutoriel', EN: 'Tutorial' },
  'home.language': { FR: 'Langue', EN: 'Language' },
  'home.publications': { FR: 'Publications', EN: 'Publications' },
  'home.myMockups': { FR: 'Mes maquettes', EN: 'My mockups' },
  'home.sharedWithMe': { FR: 'Partagées avec moi', EN: 'Shared with me' },
  'home.noMockups': { FR: 'Aucune maquette', EN: 'No mockups' },
  'home.createFirst': { FR: 'Créez votre première maquette', EN: 'Create your first mockup' },
  'home.search': { FR: 'Rechercher...', EN: 'Search...' },
  
  // === Menu utilisateur ===
  'user.connectedAs': { FR: 'Connecté en tant que', EN: 'Connected as' },
  'user.admin': { FR: 'Administrateur', EN: 'Administrator' },
  'user.standard': { FR: 'Standard', EN: 'Standard' },
  'user.client': { FR: 'Client', EN: 'Client' },
  'user.changeName': { FR: 'Changer le nom', EN: 'Change name' },
  'user.changeEmail': { FR: 'Changer l\'email', EN: 'Change email' },
  'user.changePassword': { FR: 'Changer le mot de passe', EN: 'Change password' },
  'user.adminMode': { FR: 'Passer administrateur', EN: 'Switch to admin' },
  'user.exitAdmin': { FR: 'Quitter le mode admin', EN: 'Exit admin mode' },
  'user.logout': { FR: 'Déconnexion', EN: 'Logout' },
  'user.language': { FR: 'Langue', EN: 'Language' },
  'user.french': { FR: 'Français', EN: 'French' },
  'user.english': { FR: 'Anglais', EN: 'English' },
  
  // === Actions sur les maquettes ===
  'mockup.open': { FR: 'Ouvrir', EN: 'Open' },
  'mockup.edit': { FR: 'Modifier', EN: 'Edit' },
  'mockup.duplicate': { FR: 'Dupliquer', EN: 'Duplicate' },
  'mockup.delete': { FR: 'Supprimer', EN: 'Delete' },
  'mockup.publish': { FR: 'Publier', EN: 'Publish' },
  'mockup.unpublish': { FR: 'Dépublier', EN: 'Unpublish' },
  'mockup.share': { FR: 'Partager', EN: 'Share' },
  'mockup.export': { FR: 'Exporter', EN: 'Export' },
  'mockup.rename': { FR: 'Renommer', EN: 'Rename' },
  'mockup.move': { FR: 'Déplacer', EN: 'Move' },
  'mockup.created': { FR: 'Créée le', EN: 'Created on' },
  'mockup.modified': { FR: 'Modifiée le', EN: 'Modified on' },
  'mockup.published': { FR: 'Publiée', EN: 'Published' },
  'mockup.notPublished': { FR: 'Non publiée', EN: 'Not published' },
  
  // === Dossiers ===
  'folder.new': { FR: 'Nouveau répertoire', EN: 'New folder' },
  'folder.rename': { FR: 'Renommer le répertoire', EN: 'Rename folder' },
  'folder.delete': { FR: 'Supprimer le répertoire', EN: 'Delete folder' },
  'folder.empty': { FR: 'Répertoire vide', EN: 'Empty folder' },
  'folder.contains': { FR: 'maquettes', EN: 'mockups' },
  
  // === Studio / Éditeur ===
  'studio.presentation': { FR: 'Présentation', EN: 'Presentation' },
  'studio.explodedView': { FR: 'Vue éclatée', EN: 'Exploded View' },
  'studio.translate': { FR: 'Traduire', EN: 'Translate' },
  'studio.exportExcel': { FR: 'Export Excel', EN: 'Export Excel' },
  'studio.autoSave': { FR: 'Auto-save', EN: 'Auto-save' },
  'studio.saved': { FR: 'Sauvegardé', EN: 'Saved' },
  'studio.tutorial': { FR: 'Tutoriel', EN: 'Tutorial' },
  'studio.reviewTutorial': { FR: 'Revoir', EN: 'Review' },
  
  // === Panneau d'édition ===
  'editor.cockpit': { FR: 'Cockpit', EN: 'Cockpit' },
  'editor.domain': { FR: 'Domaine', EN: 'Domain' },
  'editor.element': { FR: 'Élément', EN: 'Element' },
  'editor.subElement': { FR: 'Sous-élément', EN: 'Sub-element' },
  'editor.category': { FR: 'Catégorie', EN: 'Category' },
  'editor.name': { FR: 'Nom', EN: 'Name' },
  'editor.description': { FR: 'Description', EN: 'Description' },
  'editor.status': { FR: 'Statut', EN: 'Status' },
  'editor.value': { FR: 'Valeur', EN: 'Value' },
  'editor.icon': { FR: 'Icône', EN: 'Icon' },
  'editor.color': { FR: 'Couleur', EN: 'Color' },
  'editor.add': { FR: 'Ajouter', EN: 'Add' },
  'editor.remove': { FR: 'Supprimer', EN: 'Remove' },
  'editor.save': { FR: 'Enregistrer', EN: 'Save' },
  'editor.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'editor.preferences': { FR: 'Préférences d\'affichage', EN: 'Display preferences' },
  
  // === Statuts ===
  'status.ok': { FR: 'OK', EN: 'OK' },
  'status.minor': { FR: 'Mineur', EN: 'Minor' },
  'status.critical': { FR: 'Critique', EN: 'Critical' },
  'status.fatal': { FR: 'Fatal', EN: 'Fatal' },
  'status.disconnected': { FR: 'Déconnecté', EN: 'Disconnected' },
  'status.information': { FR: 'Information', EN: 'Information' },
  'status.inherited': { FR: 'Hérité', EN: 'Inherited' },
  
  // === Templates de vues ===
  'template.standard': { FR: 'Standard', EN: 'Standard' },
  'template.grid': { FR: 'Grille', EN: 'Grid' },
  'template.map': { FR: 'Carte', EN: 'Map' },
  'template.background': { FR: 'Background', EN: 'Background' },
  'template.hoursTracking': { FR: 'Suivi des heures', EN: 'Hours Tracking' },
  'template.library': { FR: 'Bibliothèque', EN: 'Library' },
  
  // === Modales ===
  'modal.confirm': { FR: 'Confirmer', EN: 'Confirm' },
  'modal.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'modal.close': { FR: 'Fermer', EN: 'Close' },
  'modal.yes': { FR: 'Oui', EN: 'Yes' },
  'modal.no': { FR: 'Non', EN: 'No' },
  'modal.ok': { FR: 'OK', EN: 'OK' },
  'modal.save': { FR: 'Enregistrer', EN: 'Save' },
  'modal.delete': { FR: 'Supprimer', EN: 'Delete' },
  'modal.areYouSure': { FR: 'Êtes-vous sûr ?', EN: 'Are you sure?' },
  
  // === Messages ===
  'msg.loading': { FR: 'Chargement...', EN: 'Loading...' },
  'msg.saving': { FR: 'Enregistrement...', EN: 'Saving...' },
  'msg.error': { FR: 'Erreur', EN: 'Error' },
  'msg.success': { FR: 'Succès', EN: 'Success' },
  'msg.noResults': { FR: 'Aucun résultat', EN: 'No results' },
  
  // === Tutoriel ===
  'tutorial.start': { FR: 'Tutoriel', EN: 'Tutorial' },
  'tutorial.review': { FR: 'Revoir le tutoriel', EN: 'Review tutorial' },
  'tutorial.skip': { FR: 'Passer le tutoriel', EN: 'Skip tutorial' },
  'tutorial.next': { FR: 'Suivant', EN: 'Next' },
  'tutorial.previous': { FR: 'Précédent', EN: 'Previous' },
  'tutorial.finish': { FR: 'Terminer', EN: 'Finish' },
  'tutorial.chapter': { FR: 'Chapitre', EN: 'Chapter' },
  'tutorial.allChapters': { FR: 'Voir tous les chapitres', EN: 'View all chapters' },
  
  // === Gestion des langues ===
  'lang.title': { FR: 'Gestion des langues', EN: 'Language Management' },
  'lang.key': { FR: 'Clé', EN: 'Key' },
  'lang.french': { FR: 'Français', EN: 'French' },
  'lang.english': { FR: 'Anglais', EN: 'English' },
  'lang.translate': { FR: 'Traduire', EN: 'Translate' },
  'lang.translateAll': { FR: 'Traduire tout', EN: 'Translate all' },
  'lang.reset': { FR: 'Réinitialiser', EN: 'Reset' },
  'lang.search': { FR: 'Rechercher une clé...', EN: 'Search key...' },
  
  // === Aide contextuelle ===
  'help.title': { FR: 'Aide', EN: 'Help' },
  'help.close': { FR: 'Fermer', EN: 'Close' },
  
  // === Footer ===
  'footer.version': { FR: 'Version', EN: 'Version' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  translations: Record<string, { FR: string; EN: string }>;
  customTranslations: Record<string, { FR: string; EN: string }>;
  updateTranslation: (key: string, lang: Language, value: string) => void;
  saveTranslations: () => Promise<boolean>;
  loadTranslations: () => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token } = useAuthStore();
  const [language, setLanguageState] = useState<Language>('FR');
  const [customTranslations, setCustomTranslations] = useState<Record<string, { FR: string; EN: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Charger la langue depuis localStorage au démarrage
  useEffect(() => {
    const savedLang = localStorage.getItem('studio-language') as Language;
    if (savedLang && (savedLang === 'FR' || savedLang === 'EN')) {
      setLanguageState(savedLang);
    }
  }, []);
  
  // Changer la langue
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('studio-language', lang);
  }, []);
  
  // Fonction de traduction
  const t = useCallback((key: string, fallback?: string): string => {
    // Chercher d'abord dans les traductions personnalisées
    if (customTranslations[key]?.[language]) {
      return customTranslations[key][language];
    }
    // Puis dans les traductions par défaut
    if (DEFAULT_TRANSLATIONS[key]?.[language]) {
      return DEFAULT_TRANSLATIONS[key][language];
    }
    // Fallback ou clé
    return fallback || key;
  }, [language, customTranslations]);
  
  // Fusionner les traductions
  const translations = { ...DEFAULT_TRANSLATIONS, ...customTranslations };
  
  // Mettre à jour une traduction
  const updateTranslation = useCallback((key: string, lang: Language, value: string) => {
    setCustomTranslations(prev => ({
      ...prev,
      [key]: {
        ...DEFAULT_TRANSLATIONS[key],
        ...prev[key],
        [lang]: value
      }
    }));
  }, []);
  
  // Charger les traductions personnalisées depuis l'API
  const loadTranslations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/translations', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.translations) {
          setCustomTranslations(data.translations);
        }
      }
    } catch (error) {
      console.error('[Language] Erreur chargement traductions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  
  // Sauvegarder les traductions personnalisées
  const saveTranslations = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    
    try {
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ translations: customTranslations })
      });
      
      return response.ok;
    } catch (error) {
      console.error('[Language] Erreur sauvegarde traductions:', error);
      return false;
    }
  }, [token, customTranslations]);
  
  // Charger les traductions au démarrage
  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);
  
  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      t,
      translations,
      customTranslations,
      updateTranslation,
      saveTranslations,
      loadTranslations,
      isLoading
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
