import { useState, useRef, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { MuiIcon } from './IconPicker';
import { ZoomProvider, calculateTextCompensation } from '../contexts/ZoomContext';
import { useLanguage } from '../contexts/LanguageContext';
import DateTimeline from './DateTimeline';

const MIN_ZOOM = 0.1;  // Étendu pour permettre une vue plus large
const MAX_ZOOM = 5;    // Étendu pour plus de zoom
const ZOOM_STEP = 0.1;

interface ZoomableContainerProps {
  children: ReactNode;
  domainId: string;
  className?: string;
  showControls?: boolean;
  readOnly?: boolean; // Mode lecture seule (cockpits publiés) - active l'auto-hide
  minFontZoom?: number; // Valeur minimale de zoom pour la police (0-100, défaut: 50)
  onDateChange?: (date: string) => void; // Callback pour changer la date sélectionnée (mode publié)
  hideHeader?: boolean; // État actuel du masquage du header
  onToggleHeader?: (hide: boolean) => void; // Callback pour toggle le header
}

// Helper pour charger la position du panneau de contrôle depuis localStorage
const loadControlPanelPosition = (domainId: string): { x: number; y: number } | null => {
  const savedPos = localStorage.getItem(`zoomControlPanel-${domainId}`);
  if (savedPos) {
    try {
      return JSON.parse(savedPos);
    } catch (e) {
      return null;
    }
  }
  return null;
};

/**
 * Conteneur zoomable pour les vues qui ne gèrent pas leur propre zoom.
 * Le zoom est sauvegardé par domaine dans le localStorage.
 * Indépendant du zoom du navigateur.
 * Au premier affichage, calcule automatiquement le zoom optimal pour tout afficher.
 * En mode readOnly, les contrôles sont masqués et réapparaissent au survol du bord droit.
 */
export default function ZoomableContainer({ 
  children, 
  domainId, 
  className = '',
  showControls = true,
  readOnly = false,
  minFontZoom = 50,
  onDateChange,
  hideHeader,
  onToggleHeader
}: ZoomableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Vérifier si un zoom est sauvegardé
  const hasSavedZoom = (id: string): boolean => {
    const savedZoom = localStorage.getItem(`zoomableView-${id}`);
    return savedZoom !== null;
  };
  
  // Charger l'état sauvegardé depuis localStorage
  const loadSavedZoom = (id: string): number => {
    const savedZoom = localStorage.getItem(`zoomableView-${id}`);
    if (savedZoom) {
      const parsed = parseFloat(savedZoom);
      if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
        return parsed;
      }
    }
    return 1;
  };

  const [scale, setScale] = useState(() => loadSavedZoom(domainId));
  const lastDomainIdRef = useRef<string>(domainId);
  const needsFitToContentRef = useRef<boolean>(!hasSavedZoom(domainId));
  const hasFittedRef = useRef<boolean>(false);
  
  // État pour l'auto-hide des contrôles en mode lecture seule
  const [isRightControlsHovered, setIsRightControlsHovered] = useState(false);
  
  // État pour le mode plein écran
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useLanguage();
  
  // Position du panneau de contrôle (drag and drop) - seulement en mode studio
  const [controlPanelPosition, setControlPanelPosition] = useState<{ x: number; y: number } | null>(() => 
    loadControlPanelPosition(domainId)
  );
  const [isDraggingControlPanel, setIsDraggingControlPanel] = useState(false);
  const controlPanelDragStartRef = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  // Sauvegarder la position du panneau de contrôle
  const saveControlPanelPosition = useCallback((pos: { x: number; y: number } | null) => {
    if (pos) {
      localStorage.setItem(`zoomControlPanel-${domainId}`, JSON.stringify(pos));
    } else {
      localStorage.removeItem(`zoomControlPanel-${domainId}`);
    }
  }, [domainId]);

  // Gestionnaire de drag du panneau de contrôle
  const handleControlPanelDragStart = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    
    const container = containerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const currentX = controlPanelPosition?.x ?? (containerRect.width - 80);
    const currentY = controlPanelPosition?.y ?? 16;
    
    controlPanelDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: currentX,
      panelY: currentY
    };
    setIsDraggingControlPanel(true);
  }, [readOnly, controlPanelPosition]);

  // Effet pour gérer le drag du panneau
  useEffect(() => {
    if (!isDraggingControlPanel) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!controlPanelDragStartRef.current || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - controlPanelDragStartRef.current.mouseX;
      const deltaY = e.clientY - controlPanelDragStartRef.current.mouseY;
      
      let newX = controlPanelDragStartRef.current.panelX + deltaX;
      let newY = controlPanelDragStartRef.current.panelY + deltaY;
      
      const panelWidth = controlPanelRef.current?.offsetWidth || 60;
      const panelHeight = controlPanelRef.current?.offsetHeight || 200;
      
      newX = Math.max(0, Math.min(containerRect.width - panelWidth, newX));
      newY = Math.max(0, Math.min(containerRect.height - panelHeight, newY));
      
      setControlPanelPosition({ x: newX, y: newY });
    };
    
    const handleMouseUp = () => {
      setIsDraggingControlPanel(false);
      if (controlPanelPosition) {
        saveControlPanelPosition(controlPanelPosition);
      }
      controlPanelDragStartRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingControlPanel, controlPanelPosition, saveControlPanelPosition]);

  // Réinitialiser la position du panneau
  const resetControlPanelPosition = useCallback(() => {
    setControlPanelPosition(null);
    saveControlPanelPosition(null);
  }, [saveControlPanelPosition]);

  // Calculer le zoom optimal pour afficher tout le contenu et maximiser l'utilisation de l'espace
  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Temporairement remettre le scale à 1 pour mesurer la taille réelle du contenu
    const originalScale = scale;
    content.style.transform = 'scale(1)';
    content.style.width = '100%';
    content.style.minHeight = '100%';
    
    // Forcer un reflow pour obtenir les bonnes dimensions
    void content.offsetHeight;
    
    // Dimensions du conteneur (viewport disponible)
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Dimensions du contenu (scrollWidth/scrollHeight incluent le contenu débordant)
    const contentWidth = content.scrollWidth;
    const contentHeight = content.scrollHeight;
    
    // Restaurer le scale original pour l'instant
    content.style.transform = `scale(${originalScale})`;
    content.style.width = `${100 / originalScale}%`;
    content.style.minHeight = `${100 / originalScale}%`;
    
    // Toujours calculer le zoom optimal pour maximiser l'utilisation de l'espace
    // (avec une marge de 2% pour éviter que le contenu touche les bords)
    const scaleX = (containerWidth * 0.98) / contentWidth;
    const scaleY = (containerHeight * 0.98) / contentHeight;
    const optimalScale = Math.min(scaleX, scaleY);
    
    // Appliquer le zoom calculé (dans les limites)
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, optimalScale));
    setScale(newScale);
    
    // Caler la vue en haut à gauche après avoir ajusté le zoom
    setTimeout(() => {
      container.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }, 50);
  }, [scale]);

  // Restaurer le zoom quand on change de domaine
  useEffect(() => {
    if (lastDomainIdRef.current !== domainId) {
      if (hasSavedZoom(domainId)) {
        setScale(loadSavedZoom(domainId));
        needsFitToContentRef.current = false;
      } else {
        setScale(1);
        needsFitToContentRef.current = true;
        hasFittedRef.current = false;
      }
      lastDomainIdRef.current = domainId;
    }
  }, [domainId]);

  // Fit-to-content automatique au premier chargement (si pas de zoom sauvegardé)
  useEffect(() => {
    if (needsFitToContentRef.current && !hasFittedRef.current) {
      // Petit délai pour s'assurer que le contenu est bien rendu
      const timer = setTimeout(() => {
        fitToContent();
        hasFittedRef.current = true;
        needsFitToContentRef.current = false;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [fitToContent]);

  // Sauvegarder le zoom quand il change (mais pas lors du fit initial)
  useEffect(() => {
    if (hasFittedRef.current || hasSavedZoom(domainId)) {
      localStorage.setItem(`zoomableView-${domainId}`, String(scale));
    }
  }, [scale, domainId]);

  // Zoom avec les boutons
  const zoomIn = useCallback(() => setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => {
    // Fit-to-content au lieu de juste remettre à 1
    fitToContent();
  }, [fitToContent]);

  // Toggle plein écran
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Erreur plein écran:', error);
    }
  }, []);

  // Écouter les changements de plein écran (ex: Echap)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Caler la vue en haut à gauche (pour aligner les catégories/sous-catégories)
  const centerView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scroll vers le coin supérieur gauche
    container.scrollTo({
      left: 0,
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Zoom avec la molette
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ne zoomer que si Ctrl est enfoncé (pour ne pas interférer avec le scroll normal)
    if (!e.ctrlKey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  // Calcul du contexte de zoom pour les enfants
  // minFontZoom est en % (0-100), on le convertit en décimal (0-1)
  const minVisualSize = minFontZoom / 100;
  const zoomContextValue = useMemo(() => ({
    scale,
    textCompensation: calculateTextCompensation(scale, minVisualSize),
  }), [scale, minVisualSize]);

  // Empêcher le zoom du navigateur sur ce conteneur
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', preventBrowserZoom, { passive: false });
    return () => container.removeEventListener('wheel', preventBrowserZoom);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative h-full overflow-auto ${className}`}
      onWheel={handleWheel}
    >
      {/* Zone de déclenchement pour les contrôles de droite (mode lecture seule) */}
      {readOnly && !isRightControlsHovered && (
        <div 
          className="absolute top-0 right-0 w-16 h-full z-40"
          onMouseEnter={() => setIsRightControlsHovered(true)}
        />
      )}

      {/* Contrôles de zoom - repositionnable en mode studio, auto-hide en mode lecture seule */}
      {showControls && (
        <div 
          ref={controlPanelRef}
          className={`absolute z-30 flex flex-col items-end gap-3 transition-all duration-300 ${
            readOnly && !isRightControlsHovered ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
          } ${isDraggingControlPanel ? 'cursor-grabbing' : ''}`}
          style={controlPanelPosition && !readOnly ? {
            left: controlPanelPosition.x,
            top: controlPanelPosition.y,
          } : {
            top: 16,
            right: 16,
          }}
          onMouseEnter={() => readOnly && setIsRightControlsHovered(true)}
          onMouseLeave={() => readOnly && setIsRightControlsHovered(false)}
        >
          {/* Boutons de zoom avec handle de drag intégré en mode studio */}
          <div className="flex flex-col bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden">
            {/* Handle de drag - seulement en mode studio */}
            {!readOnly && (
              <div 
                className="flex items-center justify-center gap-1 bg-[#1E3A5F] px-2 py-1.5 cursor-grab hover:bg-[#2a4a6f] active:cursor-grabbing transition-colors"
                onMouseDown={handleControlPanelDragStart}
                title="Glisser pour déplacer le panneau"
              >
                <MuiIcon name="DragIndicator" size={16} className="text-white/70" />
                <span className="text-[10px] text-white/60 font-medium">DÉPLACER</span>
                {controlPanelPosition && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resetControlPanelPosition(); }}
                    className="p-0.5 hover:bg-white/20 rounded text-white/50 hover:text-white ml-1"
                    title="Réinitialiser la position"
                  >
                    <MuiIcon name="RestartAlt" size={12} />
                  </button>
                )}
              </div>
            )}
            
            <button 
              onClick={zoomIn} 
              className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" 
              title="Zoomer (Ctrl + molette)"
            >
              <MuiIcon name="Add" size={20} />
            </button>
            <button 
              onClick={zoomOut} 
              className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" 
              title="Dézoomer (Ctrl + molette)"
            >
              <MuiIcon name="Remove" size={20} />
            </button>
            <button 
              onClick={resetZoom}
              onDoubleClick={() => setScale(1)}
              className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" 
              title={t('zoom.fitToWindow')}
            >
              <MuiIcon name="FitScreen" size={20} />
            </button>
            <button 
              onClick={toggleFullscreen} 
              className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]"
              title={isFullscreen ? t('zoom.exitFullscreen') : t('zoom.fullscreen')}
            >
              <MuiIcon name={isFullscreen ? "FullscreenExit" : "Fullscreen"} size={20} />
            </button>
            <button 
              onClick={centerView} 
              className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F]" 
              title={t('zoom.center')}
            >
              <MuiIcon name="CenterFocusStrong" size={20} />
            </button>
          </div>

          {/* Indicateur de zoom éditable */}
          <div className="bg-white rounded-lg px-2 py-1 border border-[#E2E8F0] shadow-md text-center flex items-center gap-0.5">
            <input
              type="number"
              min="10"
              max="500"
              defaultValue={Math.round(scale * 100)}
              key={Math.round(scale * 100)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const newZoom = parseInt((e.target as HTMLInputElement).value) || 100;
                  const clampedZoom = Math.min(500, Math.max(10, newZoom));
                  setScale(clampedZoom / 100);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e) => {
                const newZoom = parseInt(e.target.value) || 100;
                const clampedZoom = Math.min(500, Math.max(10, newZoom));
                setScale(clampedZoom / 100);
              }}
              className="w-10 text-sm font-medium text-[#1E3A5F] bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Entrez le zoom et appuyez sur Entrée"
            />
            <span className="text-sm font-medium text-[#1E3A5F]">%</span>
          </div>

          {/* DateTimeline unifié - toggle + cases dans un seul bloc compact (mode publié uniquement) */}
          {readOnly && onDateChange && (
            <DateTimeline onDateChange={onDateChange} domainId={domainId} />
          )}

          {/* Toggle masquage header (mode publié uniquement) */}
          {readOnly && onToggleHeader && (
            <div className="bg-white rounded-lg px-2 py-1.5 border border-[#E2E8F0] shadow-md">
              <div className="flex items-center gap-1.5">
                <MuiIcon name="VerticalAlignTop" size={12} className="text-[#1E3A5F]" />
                <button
                  onClick={() => onToggleHeader(!hideHeader)}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${
                    !hideHeader ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                  }`}
                  role="switch"
                  aria-checked={!hideHeader}
                  title={hideHeader ? t('zoom.showHeader') : t('zoom.hideHeader')}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                      !hideHeader ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenu zoomable */}
      <div 
        ref={contentRef}
        className="w-full min-h-full origin-top-left transition-transform duration-100"
        style={{ 
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          minHeight: `${100 / scale}%`,
          // CSS custom property pour la compensation de texte
          // Permet aux composants enfants d'ajuster leur taille de police
          '--text-compensation': zoomContextValue.textCompensation,
        } as React.CSSProperties}
      >
        <ZoomProvider value={zoomContextValue}>
          {children}
        </ZoomProvider>
      </div>
    </div>
  );
}
