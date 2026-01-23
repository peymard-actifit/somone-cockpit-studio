import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { MuiIcon } from './IconPicker';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

interface ZoomableContainerProps {
  children: ReactNode;
  domainId: string;
  className?: string;
  showControls?: boolean;
  readOnly?: boolean; // Mode lecture seule (cockpits publiés) - active l'auto-hide
}

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
  readOnly = false
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

  // Calculer le zoom optimal pour afficher tout le contenu
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
    
    // Si le contenu est plus petit que le conteneur, pas besoin de dézoomer
    if (contentWidth <= containerWidth && contentHeight <= containerHeight) {
      setScale(1);
      return;
    }
    
    // Calculer le zoom pour que tout rentre avec une marge de 5%
    const scaleX = (containerWidth * 0.95) / contentWidth;
    const scaleY = (containerHeight * 0.95) / contentHeight;
    const optimalScale = Math.min(scaleX, scaleY);
    
    // Appliquer le zoom calculé (dans les limites)
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, optimalScale));
    setScale(newScale);
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

  // Zoom avec la molette
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ne zoomer que si Ctrl est enfoncé (pour ne pas interférer avec le scroll normal)
    if (!e.ctrlKey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

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

      {/* Contrôles de zoom - avec auto-hide en mode lecture seule */}
      {showControls && (
        <div 
          className={`absolute top-4 right-4 z-30 flex flex-col gap-3 transition-all duration-300 ${
            readOnly && !isRightControlsHovered ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
          }`}
          onMouseEnter={() => readOnly && setIsRightControlsHovered(true)}
          onMouseLeave={() => readOnly && setIsRightControlsHovered(false)}
        >
          {/* Boutons de zoom */}
          <div className="flex flex-col gap-1 bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden">
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
              className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F]" 
              title="Ajuster à la fenêtre"
            >
              <MuiIcon name="FitScreen" size={20} />
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
        </div>
      )}

      {/* Contenu zoomable */}
      <div 
        ref={contentRef}
        className="w-full min-h-full origin-top-left transition-transform duration-100"
        style={{ 
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          minHeight: `${100 / scale}%`
        }}
      >
        {children}
      </div>
    </div>
  );
}
