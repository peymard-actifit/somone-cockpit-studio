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
  registerHelpElement: (elementKey: string, element: HTMLElement | null) => void;
}

const ContextualHelpContext = createContext<ContextualHelpContextType | null>(null);

export function useContextualHelp() {
  const context = useContext(ContextualHelpContext);
  if (!context) {
    throw new Error('useContextualHelp must be used within a ContextualHelpProvider');
  }
  return context;
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
    
    // Position the popup near the click
    const x = Math.min(event.clientX, window.innerWidth - 400);
    const y = Math.min(event.clientY, window.innerHeight - 300);
    
    setPosition({ x, y });
    setCurrentKey(elementKey);
    setIsOpen(true);
    setIsEditing(false);
    
    fetchHelp(elementKey);
  }, [fetchHelp]);

  // Register an element to respond to right-click
  const registerHelpElement = useCallback((elementKey: string, element: HTMLElement | null) => {
    if (!element) return;
    
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showHelp(elementKey, e as unknown as React.MouseEvent);
    };
    
    element.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [showHelp]);

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

  // Get formatted key for display
  const getFormattedKey = (key: string) => {
    return key
      .replace(/\./g, ' › ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <ContextualHelpContext.Provider value={{ showHelp, registerHelpElement }}>
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
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 w-96 max-h-[80vh] overflow-hidden flex flex-col"
            style={{ left: position.x, top: position.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1E3A5F] text-white">
              <div className="flex items-center gap-2">
                <MuiIcon name="Help" size={18} />
                <span className="font-medium text-sm truncate" title={currentKey}>
                  {getFormattedKey(currentKey)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Modifier l'aide"
                  >
                    <MuiIcon name="Edit" size={16} />
                  </button>
                )}
                <button
                  onClick={closeHelp}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="Fermer"
                >
                  <MuiIcon name="Close" size={16} />
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
                  <p className="text-xs text-slate-500">
                    Vous pouvez utiliser du HTML pour formater l'aide.
                  </p>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-48 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="<p>Entrez l'aide contextuelle ici...</p>"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveAndClose}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : helpContent?.content ? (
                <div 
                  className="prose prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: helpContent.content }}
                />
              ) : (
                <div className="text-center py-8">
                  <MuiIcon name="Info" size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    Aucune aide disponible pour cet élément.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={startEditing}
                      className="mt-3 px-4 py-2 text-sm bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors"
                    >
                      Créer l'aide
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            {helpContent && !isEditing && (
              <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-400">
                Dernière mise à jour : {new Date(helpContent.updatedAt).toLocaleDateString('fr-FR')}
              </div>
            )}
          </div>
        </>
      )}
    </ContextualHelpContext.Provider>
  );
}
