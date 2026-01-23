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

// Fonction pour obtenir la clé d'aide au survol (très limitée pour précision)
// Ne remonte que de 2 niveaux max - l'élément survolé et son parent direct
function getHoverHelpKey(element: HTMLElement): string | null {
  // Vérifier l'élément lui-même
  const helpKey = element.getAttribute('data-help-key');
  if (helpKey) {
    return helpKey;
  }
  
  // Vérifier le parent direct uniquement
  const parent = element.parentElement;
  if (parent) {
    const parentKey = parent.getAttribute('data-help-key');
    if (parentKey) {
      return parentKey;
    }
  }
  
  return null; // Pas de clé trouvée sur l'élément ou son parent direct
}

// Fonction pour générer une clé contextuelle à partir d'un élément DOM (pour le clic droit)
function getContextualKey(element: HTMLElement): string {
  const parts: string[] = [];
  
  // Chercher des attributs data-help-key spécifiques (remonte toute la hiérarchie)
  let current: HTMLElement | null = element;
  while (current) {
    const helpKey = current.getAttribute('data-help-key');
    if (helpKey) {
      return helpKey;
    }
    current = current.parentElement;
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
    return `studio-${tag}${classes ? `-${classes}` : ''}`;
  }
  
  return `studio-${parts.join('-')}`;
}

interface ContextualHelpProviderProps {
  children: React.ReactNode;
}

export function ContextualHelpProvider({ children }: ContextualHelpProviderProps) {
  const { user, token } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [helpContent, setHelpContent] = useState<ContextualHelp | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const helpCacheRef = React.useRef<Map<string, string | null>>(new Map());
  const currentHoverKeyRef = React.useRef<string | null>(null);

  const isAdmin = user?.isAdmin === true;

  // Fetch help content for a specific key
  const fetchHelp = useCallback(async (elementKey: string) => {
    if (!token) return null;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contextual-help/${encodeURIComponent(elementKey)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
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

  // Save help content
  const saveHelp = useCallback(async (elementKey: string, content: string) => {
    if (!token || !isAdmin) return false;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contextual-help/${encodeURIComponent(elementKey)}`, {
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
        return true;
      }
    } catch (error) {
      console.error('Error saving contextual help:', error);
    } finally {
      setIsLoading(false);
    }
    return false;
  }, [token, isAdmin]);

  // Delete help content
  const deleteHelp = useCallback(async (elementKey: string) => {
    if (!token || !isAdmin) return false;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contextual-help/${encodeURIComponent(elementKey)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Vider le cache pour cette clé
        helpCacheRef.current.delete(elementKey);
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

  // Show help popup
  const showHelp = useCallback((elementKey: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
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
    setIsOpen(true);
    setIsEditing(false);
    
    fetchHelp(elementKey);
  }, [fetchHelp]);

  // Global context menu handler
  const handleGlobalContextMenu = useCallback((event: MouseEvent) => {
    // Ne pas intercepter si on est sur un input/textarea en mode édition
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Permettre le menu contextuel standard pour copier/coller
      return;
    }
    
    event.preventDefault();
    
    // Générer la clé contextuelle basée sur l'élément cliqué
    const contextKey = getContextualKey(target);
    
    showHelp(contextKey, event as unknown as React.MouseEvent);
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

  // Check if help exists for a key (with cache)
  const checkHelpExists = useCallback(async (elementKey: string): Promise<string | null> => {
    // Check cache first
    if (helpCacheRef.current.has(elementKey)) {
      return helpCacheRef.current.get(elementKey) || null;
    }
    
    if (!token) return null;
    
    try {
      const response = await fetch(`/api/contextual-help/${encodeURIComponent(elementKey)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.help?.content || null;
        helpCacheRef.current.set(elementKey, content);
        return content;
      }
    } catch (error) {
      console.error('Error checking help:', error);
    }
    
    helpCacheRef.current.set(elementKey, null);
    return null;
  }, [token]);

  // Handle hover for tooltip
  const handleMouseMove = useCallback(async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Ignore if popup is open or on inputs
    if (isOpen || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setHoverTooltip(null);
      currentHoverKeyRef.current = null;
      return;
    }
    
    // Get hover help key (limited to nearby elements only)
    const hoverKey = getHoverHelpKey(target);
    
    // If no key found in proximity, hide tooltip and return
    if (!hoverKey) {
      if (currentHoverKeyRef.current) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setHoverTooltip(null);
        currentHoverKeyRef.current = null;
      }
      return;
    }
    
    // If same key as before, just update position if tooltip is visible
    if (hoverKey === currentHoverKeyRef.current) {
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
    
    // Update current key
    currentHoverKeyRef.current = hoverKey;
    
    // Hide previous tooltip immediately when changing elements
    setHoverTooltip(null);
    
    // Delay to avoid too many requests
    hoverTimeoutRef.current = setTimeout(async () => {
      // Check if we're still on the same element
      if (currentHoverKeyRef.current !== hoverKey) return;
      
      const content = await checkHelpExists(hoverKey);
      if (content && currentHoverKeyRef.current === hoverKey) {
        setHoverTooltip({
          content,
          x: event.clientX + 15,
          y: event.clientY + 15
        });
      }
    }, 500); // 500ms delay before showing tooltip
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
    setHelpContent(null);
    setIsEditing(false);
    setEditContent('');
  }, []);

  // Start editing
  const startEditing = useCallback(() => {
    setEditContent(helpContent?.content || '');
    setIsEditing(true);
  }, [helpContent]);

  // Save and close editing
  const saveAndClose = useCallback(async () => {
    if (!currentKey) return;
    
    const success = await saveHelp(currentKey, editContent);
    if (success) {
      setIsEditing(false);
    }
  }, [currentKey, editContent, saveHelp]);

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
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Clé: {currentKey}
                    </span>
                    <div className="flex items-center gap-2">
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
            
            {/* Footer discret */}
            {helpContent && !isEditing && (
              <div className="px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-300 flex items-center justify-between">
                <span>Mis à jour le {new Date(helpContent.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <div className="flex items-center gap-2">
                  {helpContent.updatedByUsername && (
                    <span>{helpContent.updatedByUsername}</span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        if (currentKey && window.confirm('Supprimer cette aide contextuelle ?')) {
                          const success = await deleteHelp(currentKey);
                          if (success) {
                            closeHelp();
                          }
                        }
                      }}
                      className="text-red-400 hover:text-red-600"
                      title="Supprimer l'aide"
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
