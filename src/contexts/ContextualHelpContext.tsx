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
}

interface ContextualHelpContextType {
  showHelp: (elementKey: string, event: React.MouseEvent) => void;
  enableGlobalContextMenu: () => void;
  disableGlobalContextMenu: () => void;
}

const ContextualHelpContext = createContext<ContextualHelpContextType | null>(null);

export function useContextualHelp() {
  const context = useContext(ContextualHelpContext);
  if (!context) {
    throw new Error('useContextualHelp must be used within a ContextualHelpProvider');
  }
  return context;
}

// Fonction pour générer une clé contextuelle à partir d'un élément DOM
function getContextualKey(element: HTMLElement): string {
  const parts: string[] = [];
  
  // Chercher des attributs data-help-key spécifiques
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

  // Attach/detach global listener
  useEffect(() => {
    if (globalEnabled) {
      document.addEventListener('contextmenu', handleGlobalContextMenu);
      return () => {
        document.removeEventListener('contextmenu', handleGlobalContextMenu);
      };
    }
  }, [globalEnabled, handleGlobalContextMenu]);

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

  // Get formatted key for display
  const getFormattedKey = (key: string) => {
    return key
      .replace(/^studio-/, '')
      .replace(/-/g, ' ')
      .replace(/\./g, ' › ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <ContextualHelpContext.Provider value={{ showHelp, enableGlobalContextMenu, disableGlobalContextMenu }}>
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
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1E3A5F] to-[#2C4A6E] text-white">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MuiIcon name="Help" size={20} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm block truncate" title={currentKey}>
                    Aide contextuelle
                  </span>
                  <span className="text-xs text-white/70 block truncate" title={currentKey}>
                    {getFormattedKey(currentKey)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {isAdmin && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Modifier l'aide"
                  >
                    <MuiIcon name="Edit" size={18} />
                  </button>
                )}
                <button
                  onClick={closeHelp}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="Fermer"
                >
                  <MuiIcon name="Close" size={18} />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
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
                  className="prose prose-sm max-w-none text-slate-700 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4"
                  dangerouslySetInnerHTML={{ __html: helpContent.content }}
                />
              ) : (
                <div className="text-center py-8">
                  <MuiIcon name="HelpOutline" size={48} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-1">
                    Aucune aide disponible pour cet élément.
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Clé: {currentKey}
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
            
            {/* Footer */}
            {helpContent && !isEditing && (
              <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-400 flex items-center justify-between">
                <span>Mis à jour le {new Date(helpContent.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {isAdmin && (
                  <button
                    onClick={startEditing}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <MuiIcon name="Edit" size={12} />
                    Modifier
                  </button>
                )}
              </div>
            )}
            
            {/* Hint footer for non-admin */}
            {!helpContent && !isEditing && !isAdmin && (
              <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-400">
                Demandez à un administrateur d'ajouter l'aide pour cet élément.
              </div>
            )}
          </div>
        </>
      )}
    </ContextualHelpContext.Provider>
  );
}
