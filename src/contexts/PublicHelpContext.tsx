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
  const currentHoverKeyRef = useRef<string | null>(null);

  // Le système est activé si le cockpit a showHelpOnHover=true (ou non défini = true par défaut)
  const isEnabled = cockpit?.showHelpOnHover !== false;

  // Fonction pour configurer le cockpit
  const setCockpit = useCallback((newCockpit: CockpitWithHelp | null) => {
    setCockpitState(newCockpit);
  }, []);

  // Trouver une aide par sa clé
  const findHelp = useCallback((elementKey: string): LocalContextualHelp | null => {
    if (!cockpit?.contextualHelps) return null;
    return cockpit.contextualHelps.find(h => h.elementKey === elementKey) || null;
  }, [cockpit]);

  // Obtenir le contenu traduit
  const getTranslatedContent = useCallback((help: LocalContextualHelp): string => {
    if (language === 'EN' && help.contentEN) {
      return help.contentEN;
    }
    return help.content;
  }, [language]);

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

  // Gérer le survol de la souris
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isEnabled) return;

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
      if (currentHoverKeyRef.current) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setHoverTooltip(null);
        currentHoverKeyRef.current = null;
      }
      return;
    }

    // Si même clé, juste mettre à jour la position
    if (helpKey === currentHoverKeyRef.current) {
      if (hoverTooltip) {
        setHoverTooltip(prev => prev ? {
          ...prev,
          x: event.clientX + 15,
          y: event.clientY + 15
        } : null);
      }
      return;
    }

    // Nouvelle clé - annuler le timeout précédent
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    currentHoverKeyRef.current = helpKey;
    setHoverTooltip(null);

    // Délai avant d'afficher le tooltip
    hoverTimeoutRef.current = setTimeout(() => {
      if (currentHoverKeyRef.current !== helpKey) return;

      const help = findHelp(helpKey);
      if (help) {
        const content = getTranslatedContent(help);
        setHoverTooltip({
          content,
          x: event.clientX + 15,
          y: event.clientY + 15
        });
      }
    }, 400); // 400ms de délai
  }, [isEnabled, findHelp, getTranslatedContent, hoverTooltip]);

  // Cacher le tooltip quand la souris quitte le document
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoverTooltip(null);
    currentHoverKeyRef.current = null;
  }, []);

  // Attacher/détacher les écouteurs
  useEffect(() => {
    if (isEnabled) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseleave', handleMouseLeave);
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
      };
    }
  }, [isEnabled, handleMouseMove, handleMouseLeave]);

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
