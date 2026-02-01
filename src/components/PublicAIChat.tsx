import { useState, useRef, useEffect } from 'react';
import { MuiIcon } from './IconPicker';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PublicAIChatProps {
  publicId: string;
  cockpitName: string;
  forceExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export default function PublicAIChat({ publicId, cockpitName, forceExpanded = false, onExpandedChange }: PublicAIChatProps) {
  const [isExpanded, setIsExpanded] = useState(forceExpanded);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // État pour le drag et le redimensionnement de la fenêtre
  const [position, setPosition] = useState({ x: window.innerWidth - 400, y: 100 });
  const [size, setSize] = useState({ width: 384, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  
  // Synchroniser forceExpanded avec isExpanded
  useEffect(() => {
    if (forceExpanded && !isExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  // Notifier le parent quand isExpanded change
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);
  
  // Charger la position et taille sauvegardées au montage
  useEffect(() => {
    const savedPosition = localStorage.getItem('publicAIWindowPosition');
    const savedSize = localStorage.getItem('publicAIWindowSize');
    if (savedPosition) {
      try {
        const { x, y } = JSON.parse(savedPosition);
        setPosition({ x, y });
      } catch (e) {
        // Ignorer si le parsing échoue
      }
    }
    if (savedSize) {
      try {
        const { width, height } = JSON.parse(savedSize);
        setSize({ width, height });
      } catch (e) {
        // Ignorer si le parsing échoue
      }
    } else {
      // Position par défaut si pas de sauvegarde
      setPosition({ x: window.innerWidth - 400, y: 100 });
    }
  }, []);
  
  // Sauvegarder la position et taille quand elles changent
  useEffect(() => {
    localStorage.setItem('publicAIWindowPosition', JSON.stringify(position));
  }, [position]);
  
  useEffect(() => {
    localStorage.setItem('publicAIWindowSize', JSON.stringify(size));
  }, [size]);
  
  // Gérer le drag de la fenêtre
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current && isExpanded && !isResizing) {
      setIsDragging(true);
      const rect = windowRef.current.getBoundingClientRect();
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };
  
  // Gérer le redimensionnement
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.width,
        y: e.clientY - rect.height
      });
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && windowRef.current) {
        const newWidth = Math.max(300, Math.min(1200, e.clientX - position.x + dragStart.x));
        const newHeight = Math.max(400, Math.min(window.innerHeight - position.y - 20, e.clientY - position.y + dragStart.y));
        setSize({ width: newWidth, height: newHeight });
      } else if (isDragging && isExpanded) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Limiter la position dans les bounds de la fenêtre
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, isExpanded, position, size]);

  // Vérifier le statut de l'API OpenAI au montage
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch(`/api/public/ai/status/${publicId}`);
        if (response.ok) {
          const status = await response.json();
          setAiStatus(status);
        }
      } catch (error) {
        console.error('Erreur vérification statut IA:', error);
        setAiStatus({ configured: false, model: '' });
      }
    };
    if (publicId) {
      checkAIStatus();
    }
  }, [publicId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { role, content }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading || !isConfigured) {
      if (!isConfigured) {
        addMessage('assistant', '❌ L\'assistant IA n\'est pas configuré. Veuillez ajouter la clé API OpenAI dans les variables d\'environnement Vercel.');
      }
      return;
    }

    const userPrompt = prompt.trim();
    setPrompt('');
    addMessage('user', userPrompt);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/public/ai/chat/${publicId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userPrompt,
          history: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la communication avec l\'IA');
      }

      const data = await response.json();
      addMessage('assistant', data.message);
    } catch (error: any) {
      addMessage('assistant', `❌ Erreur: ${error.message || 'Impossible de contacter l\'assistant IA.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Toujours afficher le bouton, même si l'IA n'est pas configurée
  // Si aiStatus est null, on affiche quand même le bouton (en vérifiant en arrière-plan)
  const isConfigured = aiStatus?.configured ?? false;
  
  // Si contrôlé de l'extérieur (onExpandedChange) et pas expanded, ne rien rendre
  if (!isExpanded && onExpandedChange) {
    return null;
  }

  return (
    <div className="relative">
      {!isExpanded ? (
        // Bouton pour ouvrir le chat (intégré dans le header)
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all shadow-lg ${
            isConfigured 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-purple-500/25'
              : 'bg-slate-600 hover:bg-slate-500'
          }`}
          title={isConfigured ? 'Assistant IA OpenAI' : 'Assistant IA (non configuré)'}
        >
          <MuiIcon name="AutoAwesome" size={16} />
          <span className="font-medium">IA</span>
          {isConfigured && <span className="text-xs opacity-75">GPT</span>}
        </button>
      ) : (
        <>
          {/* Panneau de chat - déplaçable et redimensionnable */}
          <div 
            ref={windowRef}
            className="fixed bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${size.width}px`,
              height: `${size.height}px`,
              cursor: isDragging ? 'grabbing' : 'default'
            }}
          >
            {/* Header - zone de drag */}
            <div 
              onMouseDown={handleMouseDown}
              className={`flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none ${
                isConfigured 
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600'
                  : 'bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MuiIcon name="AutoAwesome" size={20} className="text-white" />
                <span className="font-semibold text-white">Assistant IA</span>
                {isConfigured && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                    GPT
                  </span>
                )}
                {!isConfigured && (
                  <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded-full text-yellow-200">
                    Non configuré
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors text-xs"
                >
                  Effacer
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                >
                  <MuiIcon name="X" size={16} />
                </button>
              </div>
            </div>
            
            {/* Avertissement si pas configuré */}
            {!isConfigured && (
              <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                <p className="text-xs text-yellow-300">
                  ⚠️ L'assistant IA n'est pas configuré. Ajoutez <code className="bg-black/30 px-1 rounded">OPENAI_API_KEY</code> dans les variables d'environnement Vercel.
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-8">
                  <div className="mx-auto mb-3"><MuiIcon name="AutoAwesome" size={32} className="text-slate-600" /></div>
                  <p>Posez-moi une question sur le cockpit "{cockpitName}"</p>
                  <p className="mt-2 text-xs">
                    Exemples : "Combien d'éléments sont en statut critique ?" • "Quels sont les domaines ?"
                  </p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 px-4 py-2 rounded-xl flex items-center gap-2">
                    <div className="animate-spin"><MuiIcon name="Refresh" size={16} className="text-slate-400" /></div>
                    <span className="text-xs text-slate-400">
                      {isConfigured ? 'GPT réfléchit...' : 'Traitement...'}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={isConfigured ? "Posez une question..." : "IA non configurée"}
                  disabled={isLoading || !isConfigured}
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 placeholder-slate-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!prompt.trim() || isLoading || !isConfigured}
                  className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <MuiIcon name="Send" size={16} />
                </button>
              </div>
            </form>
            
            {/* Resize handle */}
            <div 
              onMouseDown={handleResizeStart}
              className="h-2 cursor-nwse-resize bg-slate-700 hover:bg-slate-500 transition-colors flex-shrink-0 relative group"
              title="Redimensionner la fenêtre"
            >
              <div className="absolute right-2 bottom-0 w-3 h-3 border-r-2 border-b-2 border-slate-500 group-hover:border-slate-300 transition-colors" />
            </div>
          </div>
          
          {/* Bouton quand ouvert */}
          <button
            onClick={() => setIsExpanded(false)}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${
              isConfigured 
                ? 'bg-gradient-to-r from-violet-600 to-purple-600'
                : 'bg-slate-600'
            }`}
          >
            <MuiIcon name="AutoAwesome" size={16} />
            <span className="font-medium">IA</span>
            <MuiIcon name="KeyboardArrowUp" size={16} />
          </button>
        </>
      )}
    </div>
  );
}

