import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { MuiIcon } from './IconPicker';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

interface ZoomableContainerProps {
  children: ReactNode;
  domainId: string;
  className?: string;
  showControls?: boolean;
}

/**
 * Conteneur zoomable pour les vues qui ne gèrent pas leur propre zoom.
 * Le zoom est sauvegardé par domaine dans le localStorage.
 * Indépendant du zoom du navigateur.
 */
export default function ZoomableContainer({ 
  children, 
  domainId, 
  className = '',
  showControls = true 
}: ZoomableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
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

  // Restaurer le zoom quand on change de domaine
  useEffect(() => {
    if (lastDomainIdRef.current !== domainId) {
      setScale(loadSavedZoom(domainId));
      lastDomainIdRef.current = domainId;
    }
  }, [domainId]);

  // Sauvegarder le zoom quand il change
  useEffect(() => {
    localStorage.setItem(`zoomableView-${domainId}`, String(scale));
  }, [scale, domainId]);

  // Zoom avec les boutons
  const zoomIn = useCallback(() => setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => setScale(1), []);

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
      {/* Contrôles de zoom */}
      {showControls && (
        <>
          <div className="absolute top-4 right-4 z-30 flex flex-col gap-1 bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden">
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
              title="Réinitialiser le zoom"
            >
              <MuiIcon name="Maximize" size={20} />
            </button>
          </div>

          {/* Indicateur de zoom */}
          <div className="absolute top-4 right-20 z-30 bg-white rounded-lg px-3 py-2 border border-[#E2E8F0] shadow-md">
            <span className="text-sm font-medium text-[#1E3A5F]">{Math.round(scale * 100)}%</span>
          </div>
        </>
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
