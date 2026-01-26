import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from '../components/IconPicker';

interface ContextualHelp {
  id: string;
  elementKey: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  updatedByUsername?: string;
}

interface ContextualHelpContextType {
  showHelp: (elementKey: string, event: React.MouseEvent) => void;
  enableGlobalContextMenu: () => void;
  disableGlobalContextMenu: () => void;
  enableHoverHelp: () => void;
  disableHoverHelp: () => void;
}

const ContextualHelpContext = createContext<ContextualHelpContextType | null>(null);

export function useContextualHelp() {
  const context = useContext(ContextualHelpContext);
  if (!context) {
    throw new Error('useContextualHelp must be used within a ContextualHelpProvider');
  }
  return context;
}

// Fonction pour obtenir le cockpitId depuis un élément DOM
// Remonte la hiérarchie pour trouver un data-cockpit-id
function getCockpitIdFromElement(element: HTMLElement): string | null {
  let current: HTMLElement | null = element;
  let levels = 0;
  const maxLevels = 20; // Remonter jusqu'à 20 niveaux
  
  while (current && levels < maxLevels) {
    const cockpitId = current.getAttribute('data-cockpit-id');
    if (cockpitId) {
      return cockpitId;
    }
    current = current.parentElement;
    levels++;
  }
  
  return null; // Pas de cockpitId trouvé = aide globale
}

// Fonction pour obtenir la clé d'aide au survol
// Remonte jusqu'à 8 niveaux pour trouver un data-help-key
// Retourne aussi le cockpitId si trouvé (pour aides locales)
function getHoverHelpKey(element: HTMLElement): { key: string | null; cockpitId: string | null } {
  let current: HTMLElement | null = element;
  let levels = 0;
  const maxLevels = 8; // Remonter jusqu'à 8 niveaux pour la helpKey
  let cockpitId: string | null = null;
  let foundHelpKey: string | null = null;
  
  while (current && levels < maxLevels) {
    // Chercher le cockpitId (continuer même après avoir trouvé helpKey)
    if (!cockpitId) {
      cockpitId = current.getAttribute('data-cockpit-id');
    }
    
    // Chercher la helpKey
    if (!foundHelpKey) {
      const helpKey = current.getAttribute('data-help-key');
      if (helpKey) {
        foundHelpKey = helpKey;
      }
    }
    
    current = current.parentElement;
    levels++;
  }
  
  // Si on a trouvé une helpKey mais pas de cockpitId, chercher le cockpitId plus haut
  if (foundHelpKey && !cockpitId) {
    cockpitId = getCockpitIdFromElement(element);
  }
  
  return { key: foundHelpKey, cockpitId };
}

// Fonction pour générer une clé contextuelle à partir d'un élément DOM (pour le clic droit)
// Retourne aussi le cockpitId si trouvé (pour aides locales aux maquettes)
function getContextualKey(element: HTMLElement): { key: string; cockpitId: string | null } {
  const parts: string[] = [];
  let cockpitId: string | null = null;
  let foundHelpKey: string | null = null;
  
  // Chercher des attributs data-help-key et data-cockpit-id spécifiques (remonte TOUTE la hiérarchie)
  let current: HTMLElement | null = element;
  while (current) {
    // Chercher le cockpitId (continuer même après avoir trouvé helpKey)
    if (!cockpitId) {
      cockpitId = current.getAttribute('data-cockpit-id');
    }
    
    // Chercher la helpKey (mais ne pas retourner immédiatement, continuer pour le cockpitId)
    if (!foundHelpKey) {
      const helpKey = current.getAttribute('data-help-key');
      if (helpKey) {
        foundHelpKey = helpKey;
      }
    }
    
    // Si on a trouvé les deux, on peut retourner
    if (foundHelpKey && cockpitId) {
      return { key: foundHelpKey, cockpitId };
    }
    
    current = current.parentElement;
  }
  
  // Si on a trouvé une helpKey (même sans cockpitId), la retourner
  if (foundHelpKey) {
    return { key: foundHelpKey, cockpitId };
  }
  
  // Sinon, construire une clé basée sur la structure
  current = element;
  
  // Chercher des indices contextuels
  while (current && parts.length < 5) {
    // Section du panneau d'édition
    if (current.hasAttribute('data-section')) {
      parts.unshift(`section-${current.getAttribute('data-section')}`);
    }
    
    // Boutons avec titre ou aria-label
    if (current.tagName === 'BUTTON') {
      const title = current.getAttribute('title') || current.getAttribute('aria-label');
      if (title) {
        parts.unshift(`button-${title.toLowerCase().replace(/\s+/g, '-')}`);
      }
    }
    
    // Inputs avec label
    if (current.tagName === 'INPUT' || current.tagName === 'SELECT' || current.tagName === 'TEXTAREA') {
      const id = current.getAttribute('id');
      const name = current.getAttribute('name');
      const placeholder = current.getAttribute('placeholder');
      if (id) parts.unshift(`input-${id}`);
      else if (name) parts.unshift(`input-${name}`);
      else if (placeholder) parts.unshift(`input-${placeholder.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`);
    }
    
    // Labels
    if (current.tagName === 'LABEL') {
      const text = current.textContent?.trim().slice(0, 30);
      if (text) parts.unshift(`label-${text.toLowerCase().replace(/\s+/g, '-')}`);
    }
    
    // Menus et sous-menus
    if (current.classList.contains('menu') || current.getAttribute('role') === 'menu') {
      parts.unshift('menu');
    }
    
    // Panneaux spécifiques
    if (current.id === 'editor-panel') parts.unshift('editor');
    if (current.id === 'navbar') parts.unshift('navbar');
    if (current.id === 'domain-view') parts.unshift('domain-view');
    if (current.id === 'element-view') parts.unshift('element-view');
    
    // Classes significatives
    const significantClasses = ['editor-section', 'domain-tab', 'category-section', 'element-tile', 'sub-element-tile'];
    for (const cls of significantClasses) {
      if (current.classList.contains(cls)) {
        parts.unshift(cls);
        break;
      }
    }
    
    current = current.parentElement;
  }
  
  // Si on n'a rien trouvé, utiliser le tag et les premières classes
  if (parts.length === 0) {
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).slice(0, 2).join('-');
    return { key: `studio-${tag}${classes ? `-${classes}` : ''}`, cockpitId };
  }
  
  return { key: `studio-${parts.join('-')}`, cockpitId };
}

interface ContextualHelpProviderProps {
  children: React.ReactNode;
}

export function ContextualHelpProvider({ children }: ContextualHelpProviderProps) {
  const { user, token } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [currentCockpitId, setCurrentCockpitId] = useState<string | null>(null); // Pour les aides locales aux maquettes
  const [helpContent, setHelpContent] = useState<ContextualHelp | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Cache séparé pour aides globales et locales (clé = cockpitId:elementKey ou global:elementKey)
  const helpCacheRef = React.useRef<Map<string, string | null>>(new Map());
  const currentHoverKeyRef = React.useRef<string | null>(null);

  const isAdmin = user?.isAdmin === true;

  // Helper pour construire le cache key
  const getCacheKey = (elementKey: string, cockpitId: string | null) => {
    return cockpitId ? `local:${cockpitId}:${elementKey}` : `global:${elementKey}`;
  };

  // Helper pour construire l'URL de l'API
  const getApiUrl = (elementKey: string, cockpitId: string | null) => {
    if (cockpitId) {
      // Aide locale à une maquette
      return `/api/cockpits/${cockpitId}/contextual-help/${encodeURIComponent(elementKey)}`;
    }
    // Aide globale (studio)
    return `/api/contextual-help/${encodeURIComponent(elementKey)}`;
  };

  // Fetch help content for a specific key (avec support cockpitId pour aides locales)
  // FALLBACK: Si aide locale non trouvée, cherche aussi aide globale
  const fetchHelp = useCallback(async (elementKey: string, cockpitId: string | null = null) => {
    if (!token) return null;
    
    setIsLoading(true);
    try {
      // 1. Chercher l'aide locale si cockpitId fourni
      if (cockpitId) {
        const localUrl = getApiUrl(elementKey, cockpitId);
        const localResponse = await fetch(localUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (localResponse.ok) {
          const data = await localResponse.json();
          if (data.help) {
            setHelpContent(data.help);
            setIsLoading(false);
            return data.help;
          }
        }
      }
      
      // 2. FALLBACK: Chercher l'aide globale
      const globalUrl = getApiUrl(elementKey, null);
      const globalResponse = await fetch(globalUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (globalResponse.ok) {
        const data = await globalResponse.json();
        setHelpContent(data.help);
        return data.help;
      }
    } catch (error) {
      console.error('Error fetching contextual help:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [token]);

  // Save help content (avec support cockpitId pour aides locales)
  const saveHelp = useCallback(async (elementKey: string, content: string, cockpitId: string | null = null) => {
    if (!token || !isAdmin) return false;
    
    setIsLoading(true);
    try {
      const url = getApiUrl(elementKey, cockpitId);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setHelpContent(data.help);
        // Mettre à jour le cache
        const cacheKey = getCacheKey(elementKey, cockpitId);
        helpCacheRef.current.set(cacheKey, content);
        return true;
      }
    } catch (error) {
      console.error('Error saving contextual help:', error);
    } finally {
      setIsLoading(false);
    }
    return false;
  }, [token, isAdmin]);

  // Delete help content (avec support cockpitId pour aides locales)
  const deleteHelp = useCallback(async (elementKey: string, cockpitId: string | null = null) => {
    if (!token || !isAdmin) return false;
    
    setIsLoading(true);
    try {
      const url = getApiUrl(elementKey, cockpitId);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Vider le cache pour cette clé
        const cacheKey = getCacheKey(elementKey, cockpitId);
        helpCacheRef.current.delete(cacheKey);
        setHelpContent(null);
        return true;
      }
    } catch (error) {
      console.error('Error deleting contextual help:', error);
    } finally {
      setIsLoading(false);
    }
    return false;
  }, [token, isAdmin]);

  // Show help popup - extrait aussi le cockpitId pour les aides locales
  const showHelp = useCallback((elementKey: string, event: React.MouseEvent, cockpitIdOverride?: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Extraire le cockpitId de l'élément si pas fourni
    const target = event.target as HTMLElement;
    const cockpitId = cockpitIdOverride !== undefined ? cockpitIdOverride : getCockpitIdFromElement(target);
    
    // Position the popup near the click, ensure it stays on screen
    const popupWidth = 400;
    const popupHeight = 350;
    let x = event.clientX + 10;
    let y = event.clientY + 10;
    
    // Adjust if too close to right edge
    if (x + popupWidth > window.innerWidth) {
      x = event.clientX - popupWidth - 10;
    }
    
    // Adjust if too close to bottom edge
    if (y + popupHeight > window.innerHeight) {
      y = event.clientY - popupHeight - 10;
    }
    
    // Ensure minimum position
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setPosition({ x, y });
    setCurrentKey(elementKey);
    setCurrentCockpitId(cockpitId);
    setIsOpen(true);
    setIsEditing(false);
    
    fetchHelp(elementKey, cockpitId);
  }, [fetchHelp]);

  // Global context menu handler - extrait clé ET cockpitId
  const handleGlobalContextMenu = useCallback((event: MouseEvent) => {
    // Ne pas intercepter si on est sur un input/textarea en mode édition
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Permettre le menu contextuel standard pour copier/coller
      return;
    }
    
    event.preventDefault();
    
    // Générer la clé contextuelle ET le cockpitId basés sur l'élément cliqué
    const { key: contextKey, cockpitId } = getContextualKey(target);
    
    // Créer un événement React synthétique avec le cockpitId
    setCurrentCockpitId(cockpitId);
    
    // Appeler showHelp avec le cockpitId
    const syntheticEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
    } as React.MouseEvent;
    
    showHelp(contextKey, syntheticEvent, cockpitId);
  }, [showHelp]);

  // Enable/disable global context menu
  const enableGlobalContextMenu = useCallback(() => {
    setGlobalEnabled(true);
  }, []);

  const disableGlobalContextMenu = useCallback(() => {
    setGlobalEnabled(false);
  }, []);

  // Enable/disable hover help
  const enableHoverHelp = useCallback(() => {
    setHoverEnabled(true);
  }, []);

  const disableHoverHelp = useCallback(() => {
    setHoverEnabled(false);
    setHoverTooltip(null);
  }, []);

  // Check if help exists for a key (with cache) - supporte cockpitId pour aides locales
  // FALLBACK: Si aide locale non trouvée, cherche aussi aide globale
  const checkHelpExists = useCallback(async (elementKey: string, cockpitId: string | null = null): Promise<string | null> => {
    const cacheKey = getCacheKey(elementKey, cockpitId);
    
    // Check cache first
    if (helpCacheRef.current.has(cacheKey)) {
      return helpCacheRef.current.get(cacheKey) || null;
    }
    
    if (!token) return null;
    
    try {
      // 1. Chercher l'aide locale si cockpitId fourni
      if (cockpitId) {
        const localUrl = getApiUrl(elementKey, cockpitId);
        const localResponse = await fetch(localUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (localResponse.ok) {
          const data = await localResponse.json();
          if (data.help?.content) {
            helpCacheRef.current.set(cacheKey, data.help.content);
            return data.help.content;
          }
        }
      }
      
      // 2. FALLBACK: Chercher l'aide globale
      const globalUrl = getApiUrl(elementKey, null);
      const globalResponse = await fetch(globalUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (globalResponse.ok) {
        const data = await globalResponse.json();
        const content = data.help?.content || null;
        helpCacheRef.current.set(cacheKey, content);
        return content;
      }
    } catch (error) {
      console.error('Error checking help:', error);
    }
    
    helpCacheRef.current.set(cacheKey, null);
    return null;
  }, [token]);

  // Ref pour stocker le cockpitId du hover actuel
  const currentHoverCockpitIdRef = React.useRef<string | null>(null);

  // Handle hover for tooltip - supporte cockpitId pour aides locales
  const handleMouseMove = useCallback(async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Ignore if popup is open or on inputs
    if (isOpen || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setHoverTooltip(null);
      currentHoverKeyRef.current = null;
      currentHoverCockpitIdRef.current = null;
      return;
    }
    
    // Get hover help key AND cockpitId (limited to nearby elements only)
    const { key: hoverKey, cockpitId: hoverCockpitId } = getHoverHelpKey(target);
    
    // If no key found in proximity, hide tooltip and return
    if (!hoverKey) {
      if (currentHoverKeyRef.current) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setHoverTooltip(null);
        currentHoverKeyRef.current = null;
        currentHoverCockpitIdRef.current = null;
      }
      return;
    }
    
    // Construire une clé composite pour la comparaison (inclut cockpitId)
    const compositeKey = hoverCockpitId ? `${hoverCockpitId}:${hoverKey}` : hoverKey;
    const currentCompositeKey = currentHoverCockpitIdRef.current 
      ? `${currentHoverCockpitIdRef.current}:${currentHoverKeyRef.current}` 
      : currentHoverKeyRef.current;
    
    // If same key as before, just update position if tooltip is visible
    if (compositeKey === currentCompositeKey) {
      if (hoverTooltip) {
        setHoverTooltip(prev => prev ? {
          ...prev,
          x: event.clientX + 15,
          y: event.clientY + 15
        } : null);
      }
      return;
    }
    
    // New element - clear previous timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Update current key and cockpitId
    currentHoverKeyRef.current = hoverKey;
    currentHoverCockpitIdRef.current = hoverCockpitId;
    
    // Hide previous tooltip immediately when changing elements
    setHoverTooltip(null);
    
    // Delay to avoid too many requests
    hoverTimeoutRef.current = setTimeout(async () => {
      // Check if we're still on the same element
      if (currentHoverKeyRef.current !== hoverKey) return;
      
      // Passer le cockpitId pour les aides locales
      const content = await checkHelpExists(hoverKey, hoverCockpitId);
      if (content && currentHoverKeyRef.current === hoverKey) {
        setHoverTooltip({
          content,
          x: event.clientX + 15,
          y: event.clientY + 15
        });
      }
    }, 300); // 300ms delay before showing tooltip
  }, [isOpen, checkHelpExists, hoverTooltip]);

  // Hide tooltip on mouse leave document
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoverTooltip(null);
    currentHoverKeyRef.current = null;
  }, []);

  // Attach/detach global listener
  useEffect(() => {
    if (globalEnabled) {
      document.addEventListener('contextmenu', handleGlobalContextMenu);
      return () => {
        document.removeEventListener('contextmenu', handleGlobalContextMenu);
      };
    }
  }, [globalEnabled, handleGlobalContextMenu]);

  // Attach/detach hover listener
  useEffect(() => {
    if (hoverEnabled) {
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
  }, [hoverEnabled, handleMouseMove, handleMouseLeave]);

  // Close popup
  const closeHelp = useCallback(() => {
    setIsOpen(false);
    setCurrentKey(null);
    setCurrentCockpitId(null);
    setHelpContent(null);
    setIsEditing(false);
    setEditContent('');
  }, []);

  // Start editing
  const startEditing = useCallback(() => {
    setEditContent(helpContent?.content || '');
    setIsEditing(true);
  }, [helpContent]);

  // Save and close editing - utilise le cockpitId pour les aides locales
  const saveAndClose = useCallback(async () => {
    if (!currentKey) return;
    
    // Passer le currentCockpitId pour sauvegarder dans la maquette si c'est une aide locale
    const success = await saveHelp(currentKey, editContent, currentCockpitId);
    if (success) {
      setIsEditing(false);
    }
  }, [currentKey, editContent, saveHelp, currentCockpitId]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  return (
    <ContextualHelpContext.Provider value={{ showHelp, enableGlobalContextMenu, disableGlobalContextMenu, enableHoverHelp, disableHoverHelp }}>
      {children}
      
      {/* Help Popup */}
      {isOpen && currentKey && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/30 z-[9998]"
            onClick={closeHelp}
          />
          
          {/* Popup */}
          <div
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 w-[400px] max-h-[80vh] overflow-hidden flex flex-col"
            style={{ left: position.x, top: position.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Boutons en haut à droite */}
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              {isAdmin && !isEditing && helpContent?.content && (
                <button
                  onClick={startEditing}
                  className="p-1.5 bg-white/80 hover:bg-slate-100 rounded-full transition-colors shadow-sm"
                  title="Modifier l'aide"
                >
                  <MuiIcon name="Edit" size={16} className="text-slate-500" />
                </button>
              )}
              <button
                onClick={closeHelp}
                className="p-1.5 bg-white/80 hover:bg-slate-100 rounded-full transition-colors shadow-sm"
                title="Fermer"
              >
                <MuiIcon name="Close" size={16} className="text-slate-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto p-4 pt-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <MuiIcon name="HourglassEmpty" size={24} className="animate-spin text-slate-400" />
                </div>
              ) : isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                    <MuiIcon name="Info" size={14} />
                    <span>Utilisez du HTML pour formater. Ex: &lt;b&gt;gras&lt;/b&gt;, &lt;ul&gt;&lt;li&gt;liste&lt;/li&gt;&lt;/ul&gt;</span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-48 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="<p>Entrez l'aide contextuelle ici...</p>

Exemples:
<p>Description de la fonctionnalité.</p>
<ul>
  <li>Point 1</li>
  <li>Point 2</li>
</ul>"
                    autoFocus
                  />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${currentCockpitId ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {currentCockpitId ? 'AIDE LOCALE (maquette)' : 'AIDE GLOBALE (studio)'}
                      </span>
                      <span>Clé: {currentKey}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={saveAndClose}
                        disabled={isLoading}
                        className="px-4 py-1.5 text-sm bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <MuiIcon name="Save" size={14} />
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              ) : helpContent?.content ? (
                <div 
                  className="prose prose-sm max-w-none text-slate-700 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 pr-8"
                  dangerouslySetInnerHTML={{ __html: helpContent.content }}
                />
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400 mb-3">
                    Aucune aide disponible.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={startEditing}
                      className="px-4 py-2 text-sm bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors flex items-center gap-2 mx-auto"
                    >
                      <MuiIcon name="Add" size={16} />
                      Créer l'aide
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer discret avec indicateur locale/globale */}
            {helpContent && !isEditing && (
              <div className="px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Indicateur aide locale ou globale */}
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${currentCockpitId ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {currentCockpitId ? 'LOCAL' : 'GLOBAL'}
                  </span>
                  <span>Mis à jour le {new Date(helpContent.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  {helpContent.updatedByUsername && (
                    <span>{helpContent.updatedByUsername}</span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        const typeAide = currentCockpitId ? 'locale (spécifique à cette maquette)' : 'globale (studio)';
                        if (currentKey && window.confirm(`Supprimer cette aide contextuelle ${typeAide} ?`)) {
                          // Passer le cockpitId pour supprimer l'aide locale si applicable
                          const success = await deleteHelp(currentKey, currentCockpitId);
                          if (success) {
                            closeHelp();
                          }
                        }
                      }}
                      className="text-red-400 hover:text-red-600"
                      title={currentCockpitId ? "Supprimer l'aide locale" : "Supprimer l'aide globale"}
                    >
                      <MuiIcon name="Delete" size={10} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Hover Tooltip */}
      {hoverTooltip && !isOpen && (
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
    </ContextualHelpContext.Provider>
  );
}
