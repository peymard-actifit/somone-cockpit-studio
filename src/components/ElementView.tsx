import type { Domain, Element } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import SubCategorySection from './SubCategorySection';
import SubElementTile from './SubElementTile';
import { MuiIcon } from './IconPicker';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';
import LinkElementModal from './LinkElementModal';
import { useLanguage } from '../contexts/LanguageContext';

// Constantes pour le zoom
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

interface ElementViewProps {
  element: Element;
  domain?: Domain;
  readOnly?: boolean;
  onBack?: () => void;
  onSubElementClick?: (subElementId: string) => void; // Callback pour ouvrir le menu d'édition d'un sous-élément
  forceVerticalSubCategories?: boolean; // Force toutes les sous-categories en mode vertical (vue grille)
}

export default function ElementView({ element, domain, readOnly = false, onBack, onSubElementClick, forceVerticalSubCategories = false }: ElementViewProps) {
  const { setCurrentElement, addSubCategory, addSubElement, deleteSubCategory, reorderSubElement, moveSubElement, findSubElementsByName, linkSubElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newSubCategoryOrientation, setNewSubCategoryOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [addingSubElementToSubCategory, setAddingSubElementToSubCategory] = useState<string | null>(null);
  const [newSubElementName, setNewSubElementName] = useState('');

  // État pour le modal de liaison des sous-éléments
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingSubElementName, setPendingSubElementName] = useState('');
  const [pendingSubCategoryId, setPendingSubCategoryId] = useState<string | null>(null);
  const [pendingChainNext, setPendingChainNext] = useState(false);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);
  const [draggingOverSubCategoryId, setDraggingOverSubCategoryId] = useState<string | null>(null);
  
  // ============================================================================
  // ZOOM - Refs et états pour le zoom interne de la vue élément
  // ============================================================================
  const fullscreenContainerRef = useRef<HTMLDivElement>(null); // Pour le mode plein écran
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Fonction pour charger l'état de zoom sauvegardé
  const loadSavedZoom = (elementId: string): number => {
    const savedZoom = localStorage.getItem(`elementView-zoom-${elementId}`);
    if (savedZoom) {
      const parsed = parseFloat(savedZoom);
      if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
        return parsed;
      }
    }
    return 1;
  };
  
  const hasSavedZoom = (elementId: string): boolean => {
    return localStorage.getItem(`elementView-zoom-${elementId}`) !== null;
  };
  
  const [scale, setScale] = useState(() => loadSavedZoom(element.id));
  const lastElementIdRef = useRef<string>(element.id);
  const needsFitToContentRef = useRef<boolean>(!hasSavedZoom(element.id));
  const hasFittedRef = useRef<boolean>(false);
  
  // État pour auto-hide des contrôles en mode lecture seule
  const [isRightControlsHovered, setIsRightControlsHovered] = useState(false);
  
  // État pour le mode plein écran
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useLanguage();
  
  // Position du panneau de contrôle (drag and drop) - seulement en mode studio
  const loadControlPanelPosition = (): { x: number; y: number } | null => {
    const savedPos = localStorage.getItem(`elementViewControlPanel-${element.id}`);
    if (savedPos) {
      try { return JSON.parse(savedPos); } catch { return null; }
    }
    return null;
  };
  const [controlPanelPosition, setControlPanelPosition] = useState<{ x: number; y: number } | null>(() => loadControlPanelPosition());
  const [isDraggingControlPanel, setIsDraggingControlPanel] = useState(false);
  const controlPanelDragStartRef = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Gestionnaires pour le drag du panneau de contrôle
  const saveControlPanelPosition = useCallback((pos: { x: number; y: number } | null) => {
    if (pos) {
      localStorage.setItem(`elementViewControlPanel-${element.id}`, JSON.stringify(pos));
    } else {
      localStorage.removeItem(`elementViewControlPanel-${element.id}`);
    }
  }, [element.id]);

  const handleControlPanelDragStart = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    
    const container = mainContainerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const currentX = controlPanelPosition?.x ?? (containerRect.width - 80);
    const currentY = controlPanelPosition?.y ?? 80;
    
    controlPanelDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: currentX,
      panelY: currentY
    };
    setIsDraggingControlPanel(true);
  }, [readOnly, controlPanelPosition]);

  useEffect(() => {
    if (!isDraggingControlPanel) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!controlPanelDragStartRef.current || !mainContainerRef.current) return;
      
      const containerRect = mainContainerRef.current.getBoundingClientRect();
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

  const resetControlPanelPosition = useCallback(() => {
    setControlPanelPosition(null);
    saveControlPanelPosition(null);
  }, [saveControlPanelPosition]);

  // Calculer le zoom optimal pour afficher tout le contenu et maximiser l'utilisation de l'espace
  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    
    // Temporairement remettre le scale à 1 pour mesurer
    const originalScale = scale;
    content.style.transform = 'scale(1)';
    content.style.width = '100%';
    content.style.minHeight = '100%';
    
    void content.offsetHeight;
    
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const contentWidth = content.scrollWidth;
    const contentHeight = content.scrollHeight;
    
    content.style.transform = `scale(${originalScale})`;
    content.style.width = `${100 / originalScale}%`;
    content.style.minHeight = `${100 / originalScale}%`;
    
    // Toujours calculer le zoom optimal pour maximiser l'utilisation de l'espace
    // (avec une marge de 2% pour éviter que le contenu touche les bords)
    const scaleX = (containerWidth * 0.98) / contentWidth;
    const scaleY = (containerHeight * 0.98) / contentHeight;
    const optimalScale = Math.min(scaleX, scaleY);
    
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, optimalScale));
    setScale(newScale);
    
    // Caler la vue en haut à gauche après avoir ajusté le zoom
    setTimeout(() => {
      container.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }, 50);
  }, [scale]);
  
  // Restaurer/réinitialiser le zoom quand l'élément change
  useEffect(() => {
    if (lastElementIdRef.current !== element.id) {
      if (hasSavedZoom(element.id)) {
        setScale(loadSavedZoom(element.id));
        needsFitToContentRef.current = false;
      } else {
        setScale(1);
        needsFitToContentRef.current = true;
        hasFittedRef.current = false;
      }
      lastElementIdRef.current = element.id;
    }
  }, [element.id]);
  
  // Fit-to-content automatique au premier chargement
  useEffect(() => {
    if (needsFitToContentRef.current && !hasFittedRef.current) {
      const timer = setTimeout(() => {
        fitToContent();
        hasFittedRef.current = true;
        needsFitToContentRef.current = false;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [fitToContent]);
  
  // Sauvegarder le zoom quand il change
  useEffect(() => {
    if (hasFittedRef.current || hasSavedZoom(element.id)) {
      localStorage.setItem(`elementView-zoom-${element.id}`, String(scale));
    }
  }, [scale, element.id]);
  
  // Fonctions de zoom
  const zoomIn = useCallback(() => setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => fitToContent(), [fitToContent]);

  // Caler la vue en haut à gauche (pour aligner les sous-catégories)
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

  // Toggle plein écran
  const toggleFullscreen = useCallback(async () => {
    const container = fullscreenContainerRef.current;
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
  
  // Zoom avec la molette (Ctrl + molette)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);
  
  // Empêcher le zoom du navigateur
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    container.addEventListener('wheel', preventBrowserZoom, { passive: false });
    return () => container.removeEventListener('wheel', preventBrowserZoom);
  }, []);
  
  // ============================================================================
  // Préférences d'espacement (indépendantes par élément)
  const storageKey = `element_${element.id}`;
  const [verticalSubCategoryWidth, setVerticalSubCategoryWidth] = useState(() => {
    const saved = localStorage.getItem(`verticalSubCategoryWidth_${storageKey}`);
    return saved ? parseInt(saved, 10) : 200;
  });
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => {
    const saved = localStorage.getItem(`horizontalSpacing_${storageKey}`);
    return saved ? parseInt(saved, 10) : 50;
  });
  const [subCategorySpacing, setSubCategorySpacing] = useState(() => {
    const saved = localStorage.getItem(`subCategorySpacing_${storageKey}`);
    return saved ? parseInt(saved, 10) : 80;
  });

  useEffect(() => {
    const handleSpacingChange = () => {
      setHorizontalSpacing(parseInt(localStorage.getItem(`horizontalSpacing_${storageKey}`) || '50', 10));
      setSubCategorySpacing(parseInt(localStorage.getItem(`subCategorySpacing_${storageKey}`) || '80', 10));
      setVerticalSubCategoryWidth(parseInt(localStorage.getItem(`verticalSubCategoryWidth_${storageKey}`) || '200', 10));
    };
    window.addEventListener(`spacingPreferenceChanged_${storageKey}`, handleSpacingChange);
    window.addEventListener(`verticalSubCategoryWidthChanged_${storageKey}`, handleSpacingChange);
    return () => {
      window.removeEventListener(`spacingPreferenceChanged_${storageKey}`, handleSpacingChange);
      window.removeEventListener(`verticalSubCategoryWidthChanged_${storageKey}`, handleSpacingChange);
    };
  }, [storageKey]);

  // Convertir la valeur du slider (0-100) en classe Tailwind space-y-*
  const getSpaceYClass = (value: number) => {
    if (value < 5) return 'space-y-0';
    if (value < 10) return 'space-y-1';
    if (value < 15) return 'space-y-2';
    if (value < 25) return 'space-y-3';
    if (value < 35) return 'space-y-4';
    if (value < 45) return 'space-y-5';
    if (value < 55) return 'space-y-6';
    if (value < 65) return 'space-y-7';
    if (value < 75) return 'space-y-8';
    if (value < 85) return 'space-y-9';
    return 'space-y-10';
  };

  // Modal de configuration supprimée - l'édition se fait maintenant via EditorPanel

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setCurrentElement(null);
    }
  };

  // chainNext: true = enchaîner sur un suivant (Entrée), false = terminer (clic bouton)
  const handleAddSubCategory = (chainNext: boolean = false) => {
    if (newSubCategoryName.trim()) {
      addSubCategory(element.id, newSubCategoryName.trim(), newSubCategoryOrientation);
      setNewSubCategoryName('');
      if (!chainNext) {
        setIsAddingSubCategory(false);
      }
      // Si chainNext est true, on reste en mode ajout pour créer la suivante
    }
  };

  // chainNext: true = enchaîner sur un suivant (Entrée), false = terminer (clic bouton)
  const handleAddSubElement = (subCategoryId: string, chainNext: boolean = false) => {
    if (newSubElementName.trim()) {
      const name = newSubElementName.trim();

      // Vérifier s'il existe des sous-éléments avec le même nom
      const matches = findSubElementsByName(name);

      if (matches.length > 0) {
        // Des sous-éléments avec ce nom existent - afficher le modal
        setPendingSubElementName(name);
        setPendingSubCategoryId(subCategoryId);
        setPendingChainNext(chainNext);
        setExistingMatches(matches.map(m => ({
          id: m.subElement.id,
          name: m.subElement.name,
          location: `${m.domainName} > ${m.categoryName} > ${m.elementName} > ${m.subCategoryName}`,
          linkedGroupId: m.subElement.linkedGroupId,
          status: m.subElement.status,
          type: 'subElement' as const,
        })));
        setShowLinkModal(true);
      } else {
        // Pas de doublon - créer normalement
        addSubElement(subCategoryId, name);
        setNewSubElementName('');
        if (!chainNext) {
          setAddingSubElementToSubCategory(null);
        }
      }
    }
  };

  // Créer le sous-élément indépendamment (sans liaison)
  const handleCreateIndependent = () => {
    if (pendingSubCategoryId) {
      addSubElement(pendingSubCategoryId, pendingSubElementName);
      setNewSubElementName('');
      setShowLinkModal(false);
      if (!pendingChainNext) {
        setAddingSubElementToSubCategory(null);
      }
    }
  };

  // Créer le sous-élément et le lier à un groupe existant
  const handleCreateLinked = (linkedGroupId: string) => {
    if (pendingSubCategoryId) {
      addSubElement(pendingSubCategoryId, pendingSubElementName);
      // Trouver le sous-élément qu'on vient de créer
      setTimeout(() => {
        const cockpit = useCockpitStore.getState().currentCockpit;
        if (cockpit) {
          for (const d of cockpit.domains) {
            for (const c of d.categories) {
              for (const e of c.elements) {
                for (const sc of e.subCategories) {
                  if (sc.id === pendingSubCategoryId) {
                    const lastSubElement = sc.subElements[sc.subElements.length - 1];
                    if (lastSubElement && lastSubElement.name === pendingSubElementName) {
                      linkSubElement(lastSubElement.id, linkedGroupId);
                    }
                  }
                }
              }
            }
          }
        }
      }, 50);
      setNewSubElementName('');
      setShowLinkModal(false);
      if (!pendingChainNext) {
        setAddingSubElementToSubCategory(null);
      }
    }
  };

  // Handlers de drag-and-drop pour les sous-catégories verticales
  const handleDragOver = (e: React.DragEvent, subCategoryId: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggingOverSubCategoryId(subCategoryId);
  };

  const handleDragLeave = () => {
    setDraggingOverSubCategoryId(null);
  };

  const handleDrop = (e: React.DragEvent, subCategoryId: string) => {
    if (readOnly) return;
    e.preventDefault();
    setDraggingOverSubCategoryId(null);

    try {
      const data = e.dataTransfer.getData('application/subelement');
      if (!data) return;

      const { subElementId, subCategoryId: fromSubCategoryId } = JSON.parse(data);
      if (fromSubCategoryId !== subCategoryId) {
        moveSubElement(subElementId, fromSubCategoryId, subCategoryId);
      }
    } catch (error) {
      console.error('Erreur lors du drop:', error);
    }
  };

  // Trouver la catégorie parente - protection pour les tableaux
  const parentCategory = (domain?.categories || []).find(c =>
    (c.elements || []).some(e => e.id === element.id)
  );

  // Séparer les sous-catégories horizontales et verticales
  // Les sous-catégories sans orientation définie sont considérées comme horizontales
  // Protection: s'assurer que element.subCategories existe
  const subCategories = element.subCategories || [];
  const horizontalSubCategories = forceVerticalSubCategories ? [] : subCategories.filter(sc => sc.orientation !== 'vertical');
  const verticalSubCategories = forceVerticalSubCategories ? subCategories : subCategories.filter(sc => sc.orientation === 'vertical');

  // Préférence pour le mode inline des sous-catégories horizontales (grille CSS)
  const [horizontalSubCategoriesInline, setHorizontalSubCategoriesInline] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`horizontalSubCategoriesInline_${storageKey}`) === 'true';
  });

  // Écouter les changements de préférence
  useEffect(() => {
    const handlePreferenceChange = () => {
      setHorizontalSubCategoriesInline(localStorage.getItem(`horizontalSubCategoriesInline_${storageKey}`) === 'true');
    };
    window.addEventListener(`horizontalSubCategoriesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    return () => {
      window.removeEventListener(`horizontalSubCategoriesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    };
  }, [storageKey]);

  // Calculer la largeur minimale des en-têtes de sous-catégories pour l'alignement
  const maxSubCategoryHeaderWidth = useMemo(() => {
    if (horizontalSubCategories.length === 0) return 0;
    const maxNameLength = Math.max(...horizontalSubCategories.map(sc => sc.name.length));
    const hasIcons = horizontalSubCategories.some(sc => sc.icon);
    // Estimer la largeur: caractères * 10px + icône (44px si présente) + padding (24px)
    return maxNameLength * 10 + (hasIcons ? 44 : 0) + 24;
  }, [horizontalSubCategories]);


  // Utiliser un seul ref pour le conteneur (mainContainerRef remplace containerRef pour le drag)
  const combinedContainerRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (mainContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (fullscreenContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, []);

  return (
    <div 
      ref={combinedContainerRef}
      className="h-full bg-[#F5F7FA] relative overflow-auto"
      onWheel={handleWheel}
    >
      {/* Zone de déclenchement pour les contrôles de droite (mode lecture seule) */}
      {readOnly && !isRightControlsHovered && (
        <div 
          className="fixed top-0 right-0 w-16 h-full z-50"
          onMouseEnter={() => setIsRightControlsHovered(true)}
        />
      )}

      {/* Contrôles de zoom - repositionnable en mode studio, auto-hide en mode lecture seule */}
      <div 
        ref={controlPanelRef}
        className={`fixed z-40 flex flex-col gap-3 transition-all duration-300 ${
          readOnly && !isRightControlsHovered ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
        } ${isDraggingControlPanel ? 'cursor-grabbing' : ''}`}
        style={controlPanelPosition && !readOnly ? {
          left: controlPanelPosition.x,
          top: controlPanelPosition.y,
          position: 'fixed',
        } : {
          top: 80,
          right: 24,
        }}
        onMouseEnter={() => readOnly && setIsRightControlsHovered(true)}
        onMouseLeave={() => readOnly && setIsRightControlsHovered(false)}
      >
        {/* Boutons de zoom avec handle de drag intégré */}
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
          
          <button onClick={zoomIn} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Zoomer (Ctrl + molette)">
            <MuiIcon name="Add" size={20} />
          </button>
          <button onClick={zoomOut} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Dézoomer (Ctrl + molette)">
            <MuiIcon name="Remove" size={20} />
          </button>
          <button onClick={resetZoom} onDoubleClick={() => setScale(1)} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title={t('zoom.fitToWindow')}>
            <MuiIcon name="FitScreen" size={20} />
          </button>
          <button onClick={toggleFullscreen} className={`p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] ${readOnly ? 'border-b border-[#E2E8F0]' : ''}`} title={isFullscreen ? t('zoom.exitFullscreen') : t('zoom.fullscreen')}>
            <MuiIcon name={isFullscreen ? "FullscreenExit" : "Fullscreen"} size={20} />
          </button>
          {readOnly && (
            <button onClick={centerView} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F]" title={t('zoom.center')}>
              <MuiIcon name="CenterFocusStrong" size={20} />
            </button>
          )}
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

      {/* Contenu zoomable */}
      <div 
        ref={contentRef}
        className="min-h-full origin-top-left transition-transform duration-100"
        style={{ 
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          minHeight: `${100 / scale}%`
        }}
      >
        {/* Image de fond en mode BEHIND (en dessous) - sticky pour rester dans la zone visible */}
        {element.backgroundImage && (!element.backgroundMode || element.backgroundMode === 'behind') && (
          <div className="sticky top-0 h-0 z-0">
            <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
              <img
                src={element.backgroundImage}
                alt=""
              className="w-full h-full object-contain"
              style={{
                opacity: element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity / 100 : 1
              }}
            />
            {/* Voile semi-transparent pour la lisibilité */}
            <div className="absolute inset-0 bg-[#F5F7FA]/80" />
          </div>
        </div>
      )}

      {/* Image de fond en mode OVERLAY (au-dessus, sans gêner les clics) - sticky */}
      {element.backgroundImage && element.backgroundMode === 'overlay' && (
        <div className="sticky top-0 h-0 z-40">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
            <img
              src={element.backgroundImage}
              alt=""
              className="w-full h-full object-contain"
              style={{
                opacity: element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity / 100 : 0.2
              }}
            />
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="relative z-20 p-8">
        {/* Header avec retour - Style PDF SOMONE mode clair */}
        <div className="mb-10">
          {/* Bouton retour */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#1E3A5F] hover:text-[#2C4A6E] transition-colors mb-6 group bg-white px-4 py-2 rounded-full border border-[#E2E8F0] shadow-sm"
          >
            <MuiIcon name="ArrowLeft" size={20} />
            <span className="font-medium">Retour{domain ? ` à ${domain.name}` : ''}</span>
          </button>

          {/* Breadcrumb */}
          <div className="text-sm text-[#64748B] mb-3 flex items-center gap-2">
            {domain && <span>{domain.name}</span>}
            {parentCategory && (
              <>
                <span className="text-[#CBD5E1]">/</span>
                <span>{parentCategory.name}</span>
              </>
            )}
          </div>

          {/* Titre de l'élément */}
          <div className="flex items-center gap-5">
            {element.icon && (
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#E2E8F0] shadow-sm">
                <MuiIcon name={element.icon} size={32} className="text-[#1E3A5F]" />
              </div>
            )}
            <div>
              <h2 className="text-4xl font-bold text-[#1E3A5F] tracking-tight">
                {element.name}
              </h2>
              {element.value && (
                <p className="text-[#64748B] text-lg mt-1">
                  <span className="font-semibold text-[#1E3A5F]">{element.value}</span>
                  {element.unit && <span className="ml-1">{element.unit}</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Conteneur blanc pour les sous-catégories */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          {/* Sous-catégories VERTICALES : affichées côte à côte en colonnes */}
          {verticalSubCategories.length > 0 && (
            <div className="mb-10 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0] overflow-hidden">
              {/* En-têtes des sous-catégories verticales - en ligne */}
              <div className="flex border-b border-[#E2E8F0]">
                {verticalSubCategories.map((subCategory) => (
                  <div
                    key={subCategory.id}
                    className="border-r border-[#E2E8F0] last:border-r-0 bg-white"
                    style={{
                      minWidth: `${verticalSubCategoryWidth}px`,
                      maxWidth: `${verticalSubCategoryWidth}px`,
                      flex: `0 0 ${verticalSubCategoryWidth}px`
                    }}
                  >
                    <div className="p-4 flex items-center gap-3">
                      {subCategory.icon && (
                        <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                          <MuiIcon name={subCategory.icon} size={20} className="text-white" />
                        </div>
                      )}
                      {!subCategory.icon && (
                        <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                          <MuiIcon name="Store" size={16} className="text-white" />
                        </div>
                      )}
                      <h3 className="text-base font-bold text-[#1E3A5F] flex-1">
                        {subCategory.name}
                      </h3>
                      {!readOnly && (
                        <button
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: 'Supprimer la sous-catégorie',
                              message: `Voulez-vous supprimer la sous-catégorie "${subCategory.name}" et tous ses sous-éléments ?`,
                            });
                            if (confirmed) {
                              deleteSubCategory(subCategory.id);
                            }
                          }}
                          className="p-1.5 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Supprimer"
                        >
                          <MuiIcon name="Delete" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tuiles des sous-catégories verticales - en colonnes */}
              <div className="flex">
                {verticalSubCategories.map((subCategory) => {
                  return (
                    <div
                      key={subCategory.id}
                      className={`border-r border-[#E2E8F0] last:border-r-0 transition-all ${draggingOverSubCategoryId === subCategory.id ? 'bg-[#F5F7FA] border-2 border-[#1E3A5F]' : ''
                        }`}
                      style={{
                        minWidth: `${verticalSubCategoryWidth}px`,
                        maxWidth: `${verticalSubCategoryWidth}px`,
                        flex: `0 0 ${verticalSubCategoryWidth}px`
                      }}
                      onDragOver={(e) => handleDragOver(e, subCategory.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, subCategory.id)}
                    >
                      <div className="p-4 flex flex-col gap-3">
                        {(subCategory.subElements || []).map((subElement, index) => (
                          <SubElementTile
                            key={subElement.id}
                            subElement={subElement}
                            breadcrumb={{
                              domain: domain?.name || '',
                              category: parentCategory?.name || '',
                              element: element.name,
                              subCategory: subCategory.name,
                            }}
                            readOnly={readOnly}
                            subCategoryId={subCategory.id}
                            index={index}
                            totalElements={subCategory.subElements.length}
                            onReorder={(draggedSubElementId, targetIndex) => {
                              if (!readOnly) {
                                reorderSubElement(draggedSubElementId, subCategory.id, targetIndex);
                              }
                            }}
                            onSubElementClick={onSubElementClick}
                            isVertical={true}
                            columnWidth={verticalSubCategoryWidth}
                          />
                        ))}

                        {/* Bouton ajouter sous-élément */}
                        {!readOnly && addingSubElementToSubCategory !== subCategory.id && (
                          <button
                            onClick={() => setAddingSubElementToSubCategory(subCategory.id)}
                            className="flex items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors bg-white/50 py-4"
                          >
                            <MuiIcon name="Add" size={20} />
                            <span className="text-sm font-medium">Ajouter</span>
                          </button>
                        )}
                        {!readOnly && addingSubElementToSubCategory === subCategory.id && (
                          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3">
                            <input
                              type="text"
                              value={newSubElementName}
                              onChange={(e) => setNewSubElementName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddSubElement(subCategory.id, true); // Entrée = enchaîner
                                if (e.key === 'Escape') {
                                  setAddingSubElementToSubCategory(null);
                                  setNewSubElementName('');
                                }
                              }}
                              placeholder="Nom"
                              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] mb-2"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAddSubElement(subCategory.id, false)} // Clic = terminer
                                className="flex-1 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => {
                                  setAddingSubElementToSubCategory(null);
                                  setNewSubElementName('');
                                }}
                                className="px-2 py-1.5 text-[#64748B] hover:text-[#1E3A5F] text-sm transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sous-catégories HORIZONTALES : affichées de manière classique */}
          {/* Utiliser CSS Grid pour aligner les tuiles quand mode inline est activé */}
          <div 
            className={horizontalSubCategoriesInline ? 'grid gap-x-4 gap-y-4' : getSpaceYClass(subCategorySpacing)}
            style={horizontalSubCategoriesInline ? { gridTemplateColumns: 'max-content 1fr' } : undefined}
          >
            {horizontalSubCategories.map((subCategory) => (
              <SubCategorySection
                key={subCategory.id}
                subCategory={subCategory}
                element={element}
                domain={domain}
                readOnly={readOnly}
                onSubElementClick={onSubElementClick}
                elementId={element.id}
                verticalSubCategoryWidth={verticalSubCategoryWidth}
                horizontalSpacing={horizontalSpacing}
                subCategorySpacing={subCategorySpacing}
                subCategoryHeaderMinWidth={maxSubCategoryHeaderWidth}
                useGridLayout={horizontalSubCategoriesInline}
              />
            ))}
          </div>

          {/* Bouton ajouter sous-catégorie */}
          {!readOnly && (
            !isAddingSubCategory ? (
              <button
                onClick={() => setIsAddingSubCategory(true)}
                className="mt-8 flex items-center gap-3 px-6 py-4 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors w-full justify-center bg-[#F5F7FA]/50"
              >
                <MuiIcon name="Add" size={24} />
                <span className="font-semibold">Ajouter une sous-catégorie</span>
              </button>
            ) : (
              <div className="mt-8 bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-6">
                <h4 className="text-[#1E3A5F] font-semibold text-lg mb-4">Nouvelle sous-catégorie</h4>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={newSubCategoryName}
                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubCategory(true); // Entrée = enchaîner
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsAddingSubCategory(false);
                        setNewSubCategoryName('');
                      }
                    }}
                    placeholder="Nom de la sous-catégorie"
                    className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                    autoFocus
                  />

                  <div className="flex items-center gap-4">
                    <label className="text-[#64748B] text-sm">Orientation :</label>
                    <button
                      onClick={() => setNewSubCategoryOrientation('horizontal')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${newSubCategoryOrientation === 'horizontal'
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-white text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                        }`}
                    >
                      Horizontal
                    </button>
                    <button
                      onClick={() => setNewSubCategoryOrientation('vertical')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${newSubCategoryOrientation === 'vertical'
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-white text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                        }`}
                    >
                      Vertical
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsAddingSubCategory(false);
                        setNewSubCategoryName('');
                      }}
                      className="px-5 py-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleAddSubCategory(false)} // Clic = terminer
                      className="px-5 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white font-medium rounded-lg transition-colors"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Légende - Style PDF SOMONE mode clair */}
        <div className="mt-10 flex items-center justify-start gap-8 flex-wrap py-4">
          <LegendItem color="#8B5CF6" label="Fatal" />
          <LegendItem color="#E57373" label="Critique" />
          <LegendItem color="#FFB74D" label="Mineur" />
          <LegendItem color="#9CCC65" label="OK" />
          <LegendItem color="#9E9E9E" label="Déconnecté" />
        </div>
      </div>

        {/* Modal de liaison pour les sous-éléments du même nom */}
        {showLinkModal && (
          <LinkElementModal
            type="subElement"
            newItemName={pendingSubElementName}
            existingMatches={existingMatches}
            onLink={handleCreateLinked}
            onIndependent={handleCreateIndependent}
            onCancel={() => {
              setShowLinkModal(false);
              setNewSubElementName('');
            }}
          />
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-4 rounded"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-[#64748B] font-medium">{label}</span>
    </div>
  );
}
