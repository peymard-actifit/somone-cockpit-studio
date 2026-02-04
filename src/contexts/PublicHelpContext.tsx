import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';

// Structure d'une aide contextuelle locale au cockpit
interface LocalContextualHelp {
  elementKey: string;
  content: string;
  contentEN?: string;
  updatedAt?: string;
  updatedByUsername?: string;
}

// Structure du cockpit avec les aides
interface CockpitWithHelp {
  showHelpOnHover?: boolean;
  contextualHelps?: LocalContextualHelp[];
}

interface PublicHelpContextType {
  // Activer/désactiver les tooltips (basé sur showHelpOnHover du cockpit)
  isEnabled: boolean;
  // Configurer le cockpit source des aides
  setCockpit: (cockpit: CockpitWithHelp | null) => void;
}

const PublicHelpContext = createContext<PublicHelpContextType | null>(null);

export function usePublicHelp() {
  const context = useContext(PublicHelpContext);
  if (!context) {
    // Retourner un objet par défaut si pas de provider (pour compatibilité)
    return { isEnabled: false, setCockpit: () => {} };
  }
  return context;
}

interface PublicHelpProviderProps {
  children: React.ReactNode;
}

export function PublicHelpProvider({ children }: PublicHelpProviderProps) {
  const { language } = useLanguage();
  const [cockpit, setCockpitState] = useState<CockpitWithHelp | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout pour masquer après 10s
  const currentHoverKeyRef = useRef<string | null>(null);
  const shownKeysRef = useRef<Set<string>>(new Set()); // Clés déjà affichées (pour ne pas réafficher avant d'être sorti)
  
  // Refs pour éviter les dépendances circulaires dans les callbacks
  const cockpitRef = useRef<CockpitWithHelp | null>(null);
  const languageRef = useRef(language);
  
  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    cockpitRef.current = cockpit;
  }, [cockpit]);
  
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Le système est activé si le cockpit a showHelpOnHover=true (ou non défini = true par défaut)
  const isEnabled = cockpit?.showHelpOnHover !== false && cockpit !== null;
  
  // Log du changement d'état
  useEffect(() => {
    console.log('[PublicHelp] État du système:', { 
      isEnabled, 
      cockpitLoaded: !!cockpit,
      showHelpOnHover: cockpit?.showHelpOnHover,
      helpsCount: cockpit?.contextualHelps?.length || 0
    });
  }, [isEnabled, cockpit]);

  // Fonction pour configurer le cockpit
  const setCockpit = useCallback((newCockpit: CockpitWithHelp | null) => {
    console.log('[PublicHelp] setCockpit appelé:', {
      showHelpOnHover: newCockpit?.showHelpOnHover,
      contextualHelpsCount: newCockpit?.contextualHelps?.length || 0,
      contextualHelps: newCockpit?.contextualHelps?.map(h => h.elementKey)
    });
    setCockpitState(newCockpit);
  }, []);

  // Fonction pour remonter la hiérarchie DOM et trouver un data-help-key
  const getHelpKeyFromElement = (element: HTMLElement): string | null => {
    let current: HTMLElement | null = element;
    let levels = 0;
    const maxLevels = 10;
    
    while (current && levels < maxLevels) {
      const helpKey = current.getAttribute('data-help-key');
      if (helpKey) {
        return helpKey;
      }
      current = current.parentElement;
      levels++;
    }
    
    return null;
  };

  // Cacher le tooltip quand la souris quitte le document
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setHoverTooltip(null);
    currentHoverKeyRef.current = null;
    // Réinitialiser les clés affichées quand on quitte le document
    shownKeysRef.current.clear();
  }, []);

  // Attacher/détacher les écouteurs - utilise une fonction inline pour accéder aux refs
  useEffect(() => {
    if (!isEnabled) {
      console.log('[PublicHelp] Système désactivé');
      return;
    }
    
    console.log('[PublicHelp] Système activé, écouteurs attachés');

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Ignorer les inputs et textareas
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setHoverTooltip(null);
        currentHoverKeyRef.current = null;
        return;
      }

      // Chercher la clé d'aide
      const helpKey = getHelpKeyFromElement(target);
      
      if (!helpKey) {
        // On quitte une zone avec aide - permettre de la réafficher plus tard
        if (currentHoverKeyRef.current) {
          // Retirer la clé des clés affichées quand on la quitte
          shownKeysRef.current.delete(currentHoverKeyRef.current);
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
          }
          setHoverTooltip(null);
          currentHoverKeyRef.current = null;
        }
        return;
      }

      // Si même clé, juste mettre à jour la position (si tooltip visible)
      if (helpKey === currentHoverKeyRef.current) {
        setHoverTooltip(prev => prev ? {
          ...prev,
          x: event.clientX + 15,
          y: event.clientY + 15
        } : null);
        return;
      }

      // Nouvelle clé - annuler les timeouts précédents
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Si l'ancienne clé existait, la retirer des clés affichées
      if (currentHoverKeyRef.current) {
        shownKeysRef.current.delete(currentHoverKeyRef.current);
      }

      currentHoverKeyRef.current = helpKey;
      setHoverTooltip(null);

      // Ne pas réafficher si cette clé a déjà été affichée (il faut sortir et revenir)
      if (shownKeysRef.current.has(helpKey)) {
        return;
      }

      // Délai avant d'afficher le tooltip
      hoverTimeoutRef.current = setTimeout(() => {
        if (currentHoverKeyRef.current !== helpKey) return;

        // Utiliser les refs pour accéder aux valeurs actuelles
        const currentCockpit = cockpitRef.current;
        const currentLanguage = languageRef.current;
        
        if (!currentCockpit?.contextualHelps) {
          console.log('[PublicHelp] Pas d\'aides contextuelles dans le cockpit');
          return;
        }
        
        const help = currentCockpit.contextualHelps.find(h => h.elementKey === helpKey);
        
        console.log('[PublicHelp] Recherche aide pour:', helpKey, '-> trouvé:', !!help);
        
        if (help) {
          const content = (currentLanguage === 'EN' && help.contentEN) ? help.contentEN : help.content;
          setHoverTooltip({
            content,
            x: event.clientX + 15,
            y: event.clientY + 15
          });
          
          // Marquer cette clé comme affichée
          shownKeysRef.current.add(helpKey);
          
          // Masquer automatiquement après 10 secondes
          hideTimeoutRef.current = setTimeout(() => {
            setHoverTooltip(null);
          }, 10000); // 10 secondes
        }
      }, 400); // 400ms de délai avant affichage
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isEnabled, handleMouseLeave]);

  return (
    <PublicHelpContext.Provider value={{ isEnabled, setCockpit }}>
      {children}

      {/* Tooltip d'aide */}
      {hoverTooltip && isEnabled && (
        <div
          className="fixed z-[9997] bg-slate-800 text-white text-sm px-3 py-2 rounded-lg shadow-lg max-w-md max-h-[50vh] overflow-y-auto pointer-events-none"
          style={{ 
            left: Math.min(hoverTooltip.x, window.innerWidth - 420), 
            top: Math.min(hoverTooltip.y, window.innerHeight - 200) 
          }}
        >
          <div 
            className="[&>p]:mb-1 [&>ul]:list-disc [&>ul]:pl-3 [&>ol]:list-decimal [&>ol]:pl-3"
            dangerouslySetInnerHTML={{ __html: hoverTooltip.content }}
          />
        </div>
      )}
    </PublicHelpContext.Provider>
  );
}
