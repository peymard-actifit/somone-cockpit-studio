import { useEffect, useRef, useState, useCallback } from 'react';
import { MuiIcon } from './IconPicker';
import { useTutorial } from '../contexts/TutorialContext';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * TutorialPlayer - Lecteur de tutoriel interactif pour les utilisateurs Client
 * 
 * Affiche les étapes du tutoriel avec :
 * - Un modal pour les explications (déplaçable et redimensionnable)
 * - Un highlight de l'élément ciblé
 * - Navigation entre les étapes
 */
export default function TutorialPlayer() {
  const {
    tutorial,
    isPlaying,
    currentChapter,
    currentSubChapter,
    progress,
    nextStep,
    prevStep,
    stopTutorial,
    skipTutorial,
    goToChapter,
    language
  } = useTutorial();
  
  const { t } = useLanguage();
  
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({ width: 420, height: 'auto' as any });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasUserMoved, setHasUserMoved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Gestion du déplacement (drag)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      setHasUserMoved(true);
    }
  }, []);
  
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newLeft = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - (modalSize.width || 420)));
      const newTop = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 100));
      setModalPosition({ top: newTop, left: newLeft });
    }
  }, [isDragging, dragOffset, modalSize.width]);
  
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Gestion du redimensionnement (resize)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setHasUserMoved(true);
  }, []);
  
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      const newWidth = Math.max(320, Math.min(e.clientX - rect.left, window.innerWidth - rect.left - 20));
      const newHeight = Math.max(200, Math.min(e.clientY - rect.top, window.innerHeight - rect.top - 20));
      setModalSize({ width: newWidth, height: newHeight });
    }
  }, [isResizing]);
  
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);
  
  // Écouteurs globaux pour drag et resize
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);
  
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);
  
  // Trouver et mettre en évidence l'élément ciblé
  useEffect(() => {
    if (!isPlaying || !currentSubChapter?.targetElement) {
      setHighlightedElement(null);
      return;
    }
    
    // Chercher l'élément par data-help-key
    const element = document.querySelector(`[data-help-key="${currentSubChapter.targetElement}"]`) as HTMLElement;
    
    if (element) {
      setHighlightedElement(element);
      
      // Ne positionner automatiquement que si l'utilisateur n'a pas déplacé le modal
      if (!hasUserMoved) {
        const rect = element.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const modalWidth = modalSize.width || 420;
        const modalHeight = 300;
        
        let top = rect.bottom + 20;
        let left = rect.left;
        
        // Ajuster si le modal dépasse à droite
        if (left + modalWidth > windowWidth - 20) {
          left = windowWidth - modalWidth - 20;
        }
        
        // Ajuster si le modal dépasse en bas
        if (top + modalHeight > windowHeight - 20) {
          top = rect.top - modalHeight - 20;
        }
        
        // S'assurer que le modal reste visible
        top = Math.max(20, top);
        left = Math.max(20, left);
        
        setModalPosition({ top, left });
      }
      
      // Faire défiler jusqu'à l'élément
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setHighlightedElement(null);
      // Position par défaut au centre (seulement si pas déjà déplacé)
      if (!hasUserMoved) {
        setModalPosition({
          top: window.innerHeight / 2 - 150,
          left: window.innerWidth / 2 - 200
        });
      }
    }
  }, [isPlaying, currentSubChapter, hasUserMoved, modalSize.width]);
  
  // Réinitialiser la position quand on démarre le tutoriel
  useEffect(() => {
    if (isPlaying) {
      setHasUserMoved(false);
      setModalSize({ width: 420, height: 'auto' as any });
    }
  }, [isPlaying]);
  
  // Calculer la progression
  const totalSteps = tutorial?.chapters.reduce((sum, ch) => sum + ch.subChapters.length, 0) || 0;
  const currentChapterIndex = tutorial?.chapters.findIndex(c => c.id === currentChapter?.id) || 0;
  const currentStepIndex = currentChapter?.subChapters.findIndex(s => s.id === currentSubChapter?.id) || 0;
  const globalStepIndex = (tutorial?.chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.subChapters.length, 0) || 0) + currentStepIndex + 1;
  
  // Contenu en fonction de la langue
  const title = language === 'EN' && currentSubChapter?.titleEN 
    ? currentSubChapter.titleEN 
    : currentSubChapter?.title || '';
  const content = language === 'EN' && currentSubChapter?.contentEN 
    ? currentSubChapter.contentEN 
    : currentSubChapter?.content || '';
  const chapterTitle = language === 'EN' && currentChapter?.titleEN 
    ? currentChapter.titleEN 
    : currentChapter?.title || '';
  
  if (!isPlaying || !currentChapter || !currentSubChapter) {
    return null;
  }
  
  return (
    <>
      {/* Overlay sombre */}
      <div 
        className="fixed inset-0 bg-black/40 z-[1000] transition-opacity duration-300"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Highlight de l'élément ciblé */}
      {highlightedElement && (
        <div
          className="fixed z-[1001] pointer-events-none"
          style={{
            top: highlightedElement.getBoundingClientRect().top - 4,
            left: highlightedElement.getBoundingClientRect().left - 4,
            width: highlightedElement.getBoundingClientRect().width + 8,
            height: highlightedElement.getBoundingClientRect().height + 8,
            border: '3px solid #3B82F6',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.5)',
            animation: 'pulse 2s infinite',
          }}
        />
      )}
      
      {/* Modal du tutoriel - Déplaçable et redimensionnable */}
      <div
        ref={modalRef}
        className="fixed z-[1002] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          top: modalPosition.top,
          left: modalPosition.left,
          width: modalSize.width,
          height: typeof modalSize.height === 'number' ? modalSize.height : undefined,
          minWidth: 320,
          minHeight: 200,
          maxWidth: '90vw',
          maxHeight: '90vh',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Header avec le chapitre - Zone de drag */}
        <div 
          className="bg-gradient-to-r from-[#1E3A5F] to-[#2a4a6f] p-4 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Indicateur de déplacement */}
              <div className="flex flex-col gap-0.5 mr-1 opacity-50">
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-white rounded-full" />
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-white rounded-full" />
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-white rounded-full" />
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
              </div>
              {currentChapter.icon && (
                <div className="p-2 bg-white/20 rounded-lg">
                  <MuiIcon name={currentChapter.icon as any} size={20} className="text-white" />
                </div>
              )}
              <div>
                <p className="text-white/70 text-xs font-medium">
                  {t('tutorial.chapter')} {currentChapterIndex + 1} / {tutorial?.chapters.length || 0}
                </p>
                <h3 className="text-white font-bold">{chapterTitle}</h3>
              </div>
            </div>
            <button
              onClick={stopTutorial}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={t('tutorial.skip')}
            >
              <MuiIcon name="Close" size={20} />
            </button>
          </div>
          
          {/* Barre de progression */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${(globalStepIndex / totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-white/70 text-xs">
              {globalStepIndex} / {totalSteps}
            </span>
          </div>
        </div>
        
        {/* Contenu de l'étape - Scrollable */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h4 className="text-[#1E3A5F] font-semibold mb-3">{title}</h4>
          <div 
            className="prose prose-sm max-w-none text-[#64748B] [&_strong]:text-[#1E3A5F] [&_li]:my-1"
            dangerouslySetInnerHTML={{ __html: content }}
          />
          
          {/* Indication d'action */}
          {currentSubChapter.action === 'click' && highlightedElement && (
            <div className="mt-4 flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              <MuiIcon name="TouchApp" size={18} />
              <span>{t('tutorial.clickToContinue')}</span>
            </div>
          )}
        </div>
        
        {/* Footer avec navigation */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={skipTutorial}
              className="text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors"
            >
              {t('tutorial.skip')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevStep}
              disabled={currentChapterIndex === 0 && currentStepIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#E2E8F0] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <MuiIcon name="ArrowBack" size={16} />
              {t('tutorial.previous')}
            </button>
            <button
              onClick={nextStep}
              className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-400 transition-colors"
            >
              {globalStepIndex === totalSteps ? t('tutorial.finish') : t('tutorial.next')}
              <MuiIcon name="ArrowForward" size={16} />
            </button>
          </div>
        </div>
        
        {/* Menu des chapitres (expandable) */}
        <details className="border-t border-[#E2E8F0]">
          <summary className="p-3 text-sm text-[#64748B] cursor-pointer hover:bg-[#F5F7FA] flex items-center gap-2">
            <MuiIcon name="List" size={16} />
            {t('tutorial.allChapters')}
          </summary>
          <div className="max-h-48 overflow-y-auto border-t border-[#E2E8F0]">
            {tutorial?.chapters.map((ch, index) => {
              const isCompleted = progress?.completedChapters.includes(ch.id);
              const isCurrent = ch.id === currentChapter?.id;
              const chTitle = language === 'EN' && ch.titleEN ? ch.titleEN : ch.title;
              
              return (
                <button
                  key={ch.id}
                  onClick={() => goToChapter(ch.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    isCurrent 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'hover:bg-[#F5F7FA] text-[#64748B]'
                  }`}
                >
                  <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                    isCompleted 
                      ? 'bg-green-100 text-green-600' 
                      : isCurrent 
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-[#E2E8F0] text-[#64748B]'
                  }`}>
                    {isCompleted ? <MuiIcon name="Check" size={14} /> : index + 1}
                  </span>
                  <span className="flex-1 text-sm truncate">{chTitle}</span>
                  {ch.icon && <MuiIcon name={ch.icon as any} size={16} className="text-[#94A3B8]" />}
                </button>
              );
            })}
          </div>
        </details>
        
        {/* Poignée de redimensionnement (coin bas-droit) */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-[#94A3B8] group-hover:border-[#1E3A5F] transition-colors" />
        </div>
      </div>
      
      {/* Style pour l'animation pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4), 0 0 30px rgba(59, 130, 246, 0.8); }
        }
      `}</style>
    </>
  );
}
