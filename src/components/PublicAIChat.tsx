import { useState, useRef, useEffect } from 'react';
import { MuiIcon } from './IconPicker';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PublicAIChatProps {
  publicId: string;
  cockpitName: string;
}

export default function PublicAIChat({ publicId, cockpitName }: PublicAIChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          <MuiIcon name="Sparkles" size={16} />
          <span className="font-medium">IA</span>
          {isConfigured && <span className="text-xs opacity-75">GPT</span>}
        </button>
      ) : (
        <>
          {/* Panneau de chat */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${
              isConfigured 
                ? 'bg-gradient-to-r from-violet-600 to-purple-600'
                : 'bg-slate-700'
            }`}>
              <div className="flex items-center gap-2">
                <MuiIcon name="Sparkles" size={20} className="text-white" />
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
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-8">
                  <div className="mx-auto mb-3"><MuiIcon name="Sparkles" size={32} className="text-slate-600" /></div>
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
                    <div className="animate-spin"><MuiIcon name="Loader2" size={16} className="text-slate-400" /></div>
                    <span className="text-xs text-slate-400">
                      {isConfigured ? 'GPT réfléchit...' : 'Traitement...'}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
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
                  <MuiIcon name="SendIcon" size={16} />
                </button>
              </div>
            </form>
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
            <MuiIcon name="Sparkles" size={16} />
            <span className="font-medium">IA</span>
            <MuiIcon name="ChevronUp" size={16} />
          </button>
        </>
      )}
    </div>
  );
}

