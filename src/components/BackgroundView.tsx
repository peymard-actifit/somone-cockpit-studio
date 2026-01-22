import type { Domain, Element, TileStatus } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { STATUS_COLORS, STATUS_LABELS, STATUS_PRIORITY_MAP, getEffectiveColors, getEffectiveStatus } from '../types';
import IconPicker, { MuiIcon, isCustomIcon } from './IconPicker';
import LinkElementModal from './LinkElementModal';
import BulkEditModal from './BulkEditModal';
import MapCategoryElementsView from './MapCategoryElementsView';
import StatusSummary, { formatLastUpdate } from './StatusSummary';
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Ordre de priorité des statuts (du plus critique au moins critique)
const STATUS_PRIORITY: Record<TileStatus, number> = STATUS_PRIORITY_MAP;

// Icônes populaires pour les éléments
const POPULAR_ICONS = [
  'Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Building2',
  'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart', 'Users',
  'Server', 'Database', 'Wifi', 'Radio', 'Cpu', 'HardDrive',
  'AlertTriangle', 'Shield', 'Lock', 'Key', 'Eye', 'Camera',
  'Zap', 'Activity', 'Thermometer', 'Droplet', 'Wind', 'Sun',
];

// Interface pour un cluster d'éléments
interface ElementCluster {
  id: string;
  elements: Element[];
  bounds: { x: number; y: number; width: number; height: number };
  worstStatus: TileStatus;
  count: number;
}

interface BackgroundViewProps {
  domain: Domain;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
  domains?: Domain[]; // Domaines pour calculer l'héritage (mode public)
}

export default function BackgroundView({ domain, onElementClick: _onElementClick, readOnly: _readOnly = false, domains: domainsProp }: BackgroundViewProps) {
  // ============================================================================
  // TOUS LES HOOKS DOIVENT ÊTRE DÉCLARÉS ICI, AVANT TOUT RETURN CONDITIONNEL
  // (Règle #300 de React : les hooks doivent être appelés dans le même ordre à chaque rendu)
  // ============================================================================

  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const { setCurrentElement, updateElement, updateDomain, addCategory, addElement, cloneElement, forceSave, findElementsByName, linkElement, currentCockpit, lastClonedElementId, clearLastClonedElementId, zones } = useCockpitStore();
  // Utiliser les domaines passés en prop (mode public) ou ceux du store (mode édition)
  const domains = domainsProp || currentCockpit?.domains;

  // Ã‰tat pour stocker la position et taille réelle de l'image dans le conteneur
  const [imageBounds, setImageBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Fonction pour charger l'état sauvegardé depuis localStorage
  const loadSavedViewState = (domainId: string) => {
    const viewStateKey = `backgroundView-${domainId}`;
    const savedState = localStorage.getItem(viewStateKey);
    if (savedState) {
      try {
        const { scale: savedScale, position: savedPosition } = JSON.parse(savedState);
        if (typeof savedScale === 'number' && savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
          return { scale: savedScale, position: savedPosition, hasSavedState: true };
        }
      } catch (e) {
        console.warn('[BackgroundView] Erreur lors de la restauration du zoom/position:', e);
      }
    }
    return { scale: 1, position: { x: 0, y: 0 }, hasSavedState: false };
  };
  
  // Ref pour suivre si on doit faire un fit-to-content au premier chargement
  const needsFitToContentRef = useRef<boolean>(!loadSavedViewState(domain.id).hasSavedState);

  // Ã‰tat du zoom et position (comme MapView) - initialisé depuis localStorage
  // Utiliser une fonction d'initialisation pour éviter de recalculer à chaque render
  const [scale, setScale] = useState(() => loadSavedViewState(domain.id).scale);
  const [position, setPosition] = useState(() => loadSavedViewState(domain.id).position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Ref pour suivre si on doit restaurer l'état sauvegardé quand le domaine change
  const lastDomainIdRef = useRef<string>(domain.id);
  const lastBackgroundImageRef = useRef<string | undefined>(domain.backgroundImage);

  // Ã‰tat pour le drag d'un élément
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const elementDragStartPosRef = useRef<{ elementId: string; x: number; y: number } | null>(null);
  const hasDraggedElementRef = useRef<boolean>(false);
  const preventClickRef = useRef<boolean>(false); // Pour empêcher le onClick après un drag

  // Modal de configuration
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [imageUrl, setImageUrl] = useState(domain.backgroundImage || '');
  const [enableClustering, setEnableClustering] = useState(domain.enableClustering !== false);
  const [imageOpacity, setImageOpacity] = useState(domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100);

  // Modal d'ajout d'élément
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });
  const [drawnRect, setDrawnRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [newElementForm, setNewElementForm] = useState({
    name: '',
    status: 'ok' as TileStatus,
    categoryMode: 'existing' as 'existing' | 'new',
    categoryId: '',
    newCategoryName: '',
    icon: '',
  });
  const [showIconPicker, setShowIconPicker] = useState(false);

  // États pour le filtre de catégories - toutes les catégories sélectionnées par défaut
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => 
    domain.categories?.map(c => c.id) || []
  );
  const [showCategoryFilter, setShowCategoryFilter] = useState(true);
  // État pour la vue éléments d'une catégorie (quand on clique sur le nom de la catégorie)
  const [categoryViewId, setCategoryViewId] = useState<string | null>(null);

  // Mettre à jour les catégories sélectionnées si les catégories du domaine changent
  useEffect(() => {
    const currentCategoryIds = domain.categories?.map(c => c.id) || [];
    // Ajouter les nouvelles catégories qui n'existent pas encore dans la sélection
    setSelectedCategories(prev => {
      const newCategories = currentCategoryIds.filter(id => !prev.includes(id));
      if (newCategories.length > 0) {
        return [...prev, ...newCategories];
      }
      // Retirer les catégories qui n'existent plus
      return prev.filter(id => currentCategoryIds.includes(id));
    });
  }, [domain.categories]);

  // États pour le modal de liaison d'éléments
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingElementData, setPendingElementData] = useState<{
    name: string;
    categoryId: string;
    status: TileStatus;
    icon: string;
    rect: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);

  // Modal d'édition supprimé - l'édition se fait maintenant via EditorPanel

  // Tooltip au survol
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number; elementId: string } | null>(null);

  // Renommage rapide après clonage
  const [renamingElementId, setRenamingElementId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Modal d'édition en masse
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // Activer le mode renommage quand un élément est cloné
  useEffect(() => {
    if (lastClonedElementId && !_readOnly) {
      // Chercher l'élément cloné dans ce domaine
      const clonedElement = domain.categories
        ?.flatMap(c => c.elements)
        .find(e => e.id === lastClonedElementId);
      
      if (clonedElement) {
        setRenamingElementId(lastClonedElementId);
        setRenamingValue(clonedElement.name);
        clearLastClonedElementId();
        // Focus sur l'input après le rendu
        setTimeout(() => {
          renameInputRef.current?.focus();
          renameInputRef.current?.select();
        }, 50);
      }
    }
  }, [lastClonedElementId, domain.categories, _readOnly, clearLastClonedElementId]);

  // Gérer la validation du renommage
  const handleRenameSubmit = useCallback(() => {
    if (renamingElementId && renamingValue.trim()) {
      updateElement(renamingElementId, { name: renamingValue.trim() });
    }
    setRenamingElementId(null);
    setRenamingValue('');
  }, [renamingElementId, renamingValue, updateElement]);

  // Gérer l'annulation du renommage
  const handleRenameCancel = useCallback(() => {
    setRenamingElementId(null);
    setRenamingValue('');
  }, []);

  // Limites de zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.25;

  // Récupérer tous les éléments du domaine avec position et taille
  // Sécurité : s'assurer que categories existe et que chaque catégorie a bien un tableau elements
  const allElements = (domain.categories || [])
    .filter(c => c && Array.isArray(c.elements))
    .flatMap(c => c.elements || [])
    .filter(e => e && typeof e === 'object' && e.id); // Vérifier que chaque élément est valide

  // Filtrer les éléments positionnés selon les catégories sélectionnées
  const positionedElements = allElements.filter(e => {
    if (!e || e.positionX === undefined || e.positionY === undefined ||
        e.width === undefined || e.height === undefined) {
      return false;
    }
    // Si aucune catégorie sélectionnée, afficher tous les éléments
    if (selectedCategories.length === 0) return true;
    // Sinon, filtrer par catégorie
    const elementCategory = domain.categories.find(c => c.elements.some(el => el.id === e.id));
    return elementCategory && selectedCategories.includes(elementCategory.id);
  });

  // Restaurer l'état sauvegardé quand on change de domaine (une seule fois au montage)
  useEffect(() => {
    // Au premier montage ou changement de domaine, restaurer depuis localStorage
    if (lastDomainIdRef.current !== domain.id) {
      const savedState = loadSavedViewState(domain.id);
      if (savedState.hasSavedState) {
        setScale(savedState.scale);
        setPosition(savedState.position);
        needsFitToContentRef.current = false;
      } else {
        // Pas d'état sauvegardé - on va faire un fit-to-content
        setScale(1);
        setPosition({ x: 0, y: 0 });
        needsFitToContentRef.current = true;
      }
      lastDomainIdRef.current = domain.id;
      lastBackgroundImageRef.current = domain.backgroundImage;
    }
    // Si l'image change réellement (pas juste au remontage), réinitialiser
    // Mais seulement si c'est un vrai changement, pas juste un remontage du composant
    else if (lastBackgroundImageRef.current !== domain.backgroundImage &&
      lastBackgroundImageRef.current !== undefined &&
      domain.backgroundImage !== undefined) {
      // C'est un vrai changement d'image (utilisateur a changé l'image), réinitialiser et refaire fit-to-content
      setScale(1);
      setPosition({ x: 0, y: 0 });
      needsFitToContentRef.current = true;
      lastBackgroundImageRef.current = domain.backgroundImage;
    }
    // Sinon, on ne fait rien - on garde l'état actuel même si le composant se remonte
  }, [domain.id, domain.backgroundImage]);

  // Sauvegarder le zoom et la position quand ils changent
  useEffect(() => {
    const viewStateKey = `backgroundView-${domain.id}`;
    localStorage.setItem(viewStateKey, JSON.stringify({ scale, position }));
  }, [scale, position, domain.id]);

  // Fonction de validation d'image base64
  const isValidBase64Image = (str: string | undefined | null): boolean => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (trimmed.length < 100) return false; // Une vraie image fait au moins 100 caractères
    if (!trimmed.startsWith('data:image/')) return false;
    const base64Part = trimmed.split(',')[1];
    if (!base64Part || base64Part.length < 50) return false;
    // Vérifier que c'est du base64 valide
    return /^[A-Za-z0-9+/]*={0,2}$/.test(base64Part);
  };

  // Mettre à jour l'URL et le clustering quand le domaine change
  useEffect(() => {
    let newImageUrl = '';

    if (domain?.backgroundImage && typeof domain.backgroundImage === 'string') {
      const trimmed = domain.backgroundImage.trim();
      // En mode readOnly, on accepte l'image même si elle ne passe pas la validation stricte
      if (_readOnly || isValidBase64Image(trimmed)) {
        newImageUrl = trimmed;
      } else {
        console.warn(`[BackgroundView] âš ï¸ Image invalide pour "${domain?.name}":`, {
          length: trimmed.length,
          startsWithDataImage: trimmed.startsWith('data:image/'),
          hasComma: trimmed.includes(','),
          preview: trimmed.substring(0, 50)
        });
      }
    }

    console.log(`[BackgroundView] useEffect - Domain backgroundImage update:`, {
      domainName: domain?.name,
      hasBackgroundImage: !!domain?.backgroundImage,
      backgroundImageType: typeof domain?.backgroundImage,
      backgroundImageLength: domain?.backgroundImage ? domain.backgroundImage.length : 0,
      isValidImage: isValidBase64Image(domain?.backgroundImage),
      newImageUrlLength: newImageUrl.length,
      newImageUrlPreview: newImageUrl.substring(0, 50)
    });
    setImageUrl(newImageUrl);
    setImageOpacity(domain?.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100);
    setEnableClustering(domain?.enableClustering !== false);
  }, [domain?.backgroundImage, domain?.backgroundImageOpacity, domain?.enableClustering, _readOnly]);

  // Gérer l'upload de fichier avec limite de 10MB (réduite pour fiabilité Redis)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier la taille du fichier (10MB max pour fiabilité)
      const maxSizeMB = 10;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        alert(`Erreur: Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). La taille maximale est de ${maxSizeMB} MB pour garantir une sauvegarde fiable.`);
        e.target.value = ''; // Réinitialiser l'input
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const base64SizeMB = base64.length / 1024 / 1024;
        if (base64SizeMB > 15) {
          alert(`Erreur: L'image encodée est trop volumineuse. Veuillez utiliser une image plus petite.`);
          return;
        }
        console.log(`[BackgroundView] Image chargée: ${base64SizeMB.toFixed(2)} MB`);
        setImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // État pour indiquer si une sauvegarde est en cours
  const [isSaving, setIsSaving] = useState(false);

  // Sauvegarder l'image et les options
  const handleSaveImage = async () => {
    // Validation finale avant sauvegarde
    if (!isValidBase64Image(imageUrl)) {
      alert('Erreur: L\'image n\'est pas valide. Veuillez réessayer de charger l\'image.');
      console.error('[BackgroundView] âŒ Tentative de sauvegarde d\'une image invalide');
      return;
    }

    // Vérifier la taille (limite 10MB pour fiabilité Redis)
    const sizeMB = imageUrl.length / 1024 / 1024;
    const maxSizeMB = 15; // Limite base64

    if (sizeMB > maxSizeMB) {
      alert(`Erreur: L'image est trop volumineuse (${sizeMB.toFixed(2)} MB). La taille maximale est de 10 MB.`);
      return;
    }

    setIsSaving(true);
    console.log(`[BackgroundView] Sauvegarde image: ${sizeMB.toFixed(2)} MB (${imageUrl.length} chars)`);

    // Mettre à jour le domaine
    updateDomain(domain.id, {
      backgroundImage: imageUrl,
      backgroundImageOpacity: imageOpacity,
      enableClustering: enableClustering,
    });

    // Forcer une sauvegarde IMMÉDIATE
    const saved = await forceSave();
    setIsSaving(false);

    if (saved) {
      console.log('[BackgroundView] Image sauvegardée avec succès');
      setShowConfigModal(false);
    } else {
      console.error('[BackgroundView] Échec de la sauvegarde');
      alert('Erreur: La sauvegarde a échoué. Veuillez réessayer avec une image plus petite.');
    }
  };

  // Zoom avec la molette
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isDrawing) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, [isDrawing]);

  // Zoom avec les boutons
  const zoomIn = () => setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  const zoomOut = () => setScale(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Fit to content - Calculer le zoom optimal pour voir tous les éléments
  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageBounds) {
      // Pas encore chargé, utiliser le reset view
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    // Si pas d'éléments positionnés, juste réinitialiser
    if (positionedElements.length === 0) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    // Calculer le bounding box des éléments (en % de l'image, 0-100)
    let minX = 100, minY = 100, maxX = 0, maxY = 0;
    for (const el of positionedElements) {
      if (el.positionX !== undefined && el.positionY !== undefined) {
        const elWidth = el.width || 5;
        const elHeight = el.height || 5;
        minX = Math.min(minX, el.positionX);
        minY = Math.min(minY, el.positionY);
        maxX = Math.max(maxX, el.positionX + elWidth);
        maxY = Math.max(maxY, el.positionY + elHeight);
      }
    }

    // Ajouter une marge de 5%
    const margin = 5;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(100, maxX + margin);
    maxY = Math.min(100, maxY + margin);

    // Dimensions du bounding box en % de l'image
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Dimensions du conteneur
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Dimensions de l'image affichée
    const imageWidth = imageBounds.width;
    const imageHeight = imageBounds.height;

    // Calculer les dimensions du contenu en pixels (à scale=1)
    const contentPixelWidth = (contentWidth / 100) * imageWidth;
    const contentPixelHeight = (contentHeight / 100) * imageHeight;

    // Calculer le zoom pour remplir le conteneur avec le contenu (avec marge)
    const scaleX = (containerWidth * 0.9) / contentPixelWidth;
    const scaleY = (containerHeight * 0.9) / contentPixelHeight;
    const newScale = Math.min(Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)), MAX_ZOOM);

    // Calculer le centre du contenu en pixels (dans le système de coordonnées de l'image)
    const contentCenterX = imageBounds.x + ((minX + maxX) / 2 / 100) * imageWidth;
    const contentCenterY = imageBounds.y + ((minY + maxY) / 2 / 100) * imageHeight;

    // Calculer la position pour centrer le contenu
    // Avec transform-origin: center, le centre du conteneur reste fixe
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;
    
    const newPosX = containerCenterX - contentCenterX * newScale;
    const newPosY = containerCenterY - contentCenterY * newScale;

    setScale(newScale);
    setPosition({ x: newPosX, y: newPosY });
  }, [imageBounds, positionedElements]);

  // Fit-to-content automatique au premier chargement (si pas d'état sauvegardé)
  useEffect(() => {
    if (needsFitToContentRef.current && imageBounds && positionedElements.length > 0) {
      // Petit délai pour s'assurer que tout est bien rendu
      const timer = setTimeout(() => {
        fitToContent();
        needsFitToContentRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [imageBounds, positionedElements.length, fitToContent]);

  // Calculer la position et taille réelle de l'image dans le conteneur transformé (avec object-contain)
  // Les bounds sont calculés dans le système de coordonnées du conteneur transformé (imageContainerRef)
  // qui a les dimensions du conteneur parent AVANT transformation, mais avec la transformation appliquée visuellement
  const calculateImageBounds = useCallback(() => {
    const container = containerRef.current; // Conteneur parent (pas transformé)
    const imageContainer = imageContainerRef.current; // Conteneur transformé
    const img = imageRef.current;
    const bgImage = domain?.backgroundImage;
    if (!container || !imageContainer || !img || !bgImage || typeof bgImage !== 'string' || bgImage.trim().length === 0) {
      setImageBounds(null);
      return;
    }

    // Utiliser les dimensions du conteneur parent (pas transformé) car le conteneur transformé
    // a les mêmes dimensions de base (100% width/height) mais avec transform appliqué
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Dimensions naturelles de l'image
    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;

    if (imgNaturalWidth === 0 || imgNaturalHeight === 0) {
      setImageBounds(null);
      return;
    }

    // Calculer les dimensions avec object-contain
    const containerAspect = containerWidth / containerHeight;
    const imageAspect = imgNaturalWidth / imgNaturalHeight;

    let displayedWidth: number;
    let displayedHeight: number;

    if (imageAspect > containerAspect) {
      // L'image est plus large : elle est limitée par la largeur
      displayedWidth = containerWidth;
      displayedHeight = containerWidth / imageAspect;
    } else {
      // L'image est plus haute : elle est limitée par la hauteur
      displayedHeight = containerHeight;
      displayedWidth = containerHeight * imageAspect;
    }

    // Position centrée dans le conteneur transformé
    // Les bounds sont dans le système de coordonnées du conteneur transformé (même dimensions que le parent)
    const x = (containerWidth - displayedWidth) / 2;
    const y = (containerHeight - displayedHeight) / 2;

    setImageBounds({ x, y, width: displayedWidth, height: displayedHeight });
  }, [domain.backgroundImage]);

  // Mettre à jour les bounds quand l'image charge ou que le conteneur change
  useEffect(() => {
    if (!domain.backgroundImage) {
      setImageBounds(null);
      return;
    }

    const container = imageContainerRef.current;
    const img = imageRef.current;

    if (!container || !img) return;

    // Attendre que l'image soit chargée
    if (img.complete) {
      calculateImageBounds();
    } else {
      img.onload = calculateImageBounds;
    }

    // Recalculer lors du resize
    const resizeObserver = new ResizeObserver(calculateImageBounds);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (img) {
        img.onload = null;
      }
    };
  }, [domain?.backgroundImage, calculateImageBounds]);

  // Convertir position écran en position % relative à l'image (0-100% de l'image elle-même)
  // Doit tenir compte du zoom et pan du conteneur transformé
  // Avec transform: translate(x, y) scale(s) et transform-origin: center center
  // L'image utilise object-contain donc elle a des bounds spécifiques dans le conteneur transformé
  const screenToImagePercent = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const imageContainer = imageContainerRef.current;
    if (!container || !imageContainer || !imageBounds) return { x: 0, y: 0 };

    const containerRect = container.getBoundingClientRect();

    // Position de la souris relative au conteneur (pas transformé - coordonnées de l'écran)
    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;

    // Centre du conteneur (point d'origine de la transformation)
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    // Convertir en coordonnées locales du conteneur AVANT transformation
    // Inverser la transformation: point = center + ((mouse - center) - translate) / scale
    const localX = containerCenterX + ((mouseX - containerCenterX) - position.x) / scale;
    const localY = containerCenterY + ((mouseY - containerCenterY) - position.y) / scale;

    // Coordonnées relatives à l'image (imageBounds est calculé dans le conteneur AVANT transformation)
    const imageX = localX - imageBounds.x;
    const imageY = localY - imageBounds.y;

    // Convertir en pourcentage par rapport à l'image
    const x = (imageX / imageBounds.width) * 100;
    const y = (imageY / imageBounds.height) * 100;

    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, [imageBounds, scale, position]);


  // Début du drag de la vue ou du dessin
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Ne pas démarrer le drag de la vue si on drague un élément
    if (draggingElementId) return;

    // Ne pas démarrer le drag si le clic est sur un élément ou un bouton d'action
    const target = e.target as HTMLElement;
    const isElement = target.closest('[data-element-tile]') || target.closest('.cursor-move');
    const isActionButton = target.closest('button');

    if (isElement || isActionButton) {
      return;
    }

    if (isDrawing) {
      const pos = screenToImagePercent(e.clientX, e.clientY);
      setDrawStart(pos);
      setDrawEnd(pos);
      setDrawnRect(null);
    } else {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  // Pendant le drag de la vue ou le dessin
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Drag d'un élément
    if (draggingElementId) {
      // Arrêter le drag de la vue si elle est en cours
      if (isDragging) {
        setIsDragging(false);
      }

      // Marquer qu'un drag a eu lieu
      if (elementDragStartPosRef.current) {
        const dragDistance = Math.sqrt(
          Math.pow(e.clientX - elementDragStartPosRef.current.x, 2) +
          Math.pow(e.clientY - elementDragStartPosRef.current.y, 2)
        );
        if (dragDistance > 5) {
          hasDraggedElementRef.current = true;
        }
      }
      const pos = screenToImagePercent(e.clientX, e.clientY);
      const element = positionedElements.find(el => el.id === draggingElementId);
      if (element) {
        // Ajuster pour que le centre de l'élément suive le curseur
        const centerX = pos.x - (element.width || 0) / 2;
        const centerY = pos.y - (element.height || 0) / 2;
        updateElement(element.id, {
          positionX: Math.max(0, Math.min(100 - (element.width || 0), centerX)),
          positionY: Math.max(0, Math.min(100 - (element.height || 0), centerY)),
        });
      }
      return;
    }

    if (isDrawing && drawStart.x !== 0) {
      const pos = screenToImagePercent(e.clientX, e.clientY);
      setDrawEnd(pos);
    } else if (isDragging && !draggingElementId) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, isDrawing, drawStart, draggingElementId, positionedElements, updateElement, screenToImagePercent]);

  // Fin du drag de la vue ou du dessin
  const handleMouseUp = (e?: React.MouseEvent) => {
    if (isDrawing && drawStart.x !== 0) {
      const x = Math.min(drawStart.x, drawEnd.x);
      const y = Math.min(drawStart.y, drawEnd.y);
      const width = Math.abs(drawEnd.x - drawStart.x);
      const height = Math.abs(drawEnd.y - drawStart.y);

      if (width > 0.1 && height > 0.1) {
        setDrawnRect({ x, y, width, height });
        setIsDrawing(false);
        setShowAddModal(true);
      }
      setDrawStart({ x: 0, y: 0 });
      setDrawEnd({ x: 0, y: 0 });
    }

    const wasDraggingElement = !!draggingElementId && hasDraggedElementRef.current;

    setIsDragging(false);

    // Si on a fait un drag, marquer pour empêcher le onClick
    if (wasDraggingElement) {
      preventClickRef.current = true;
      // Réinitialiser après un court délai pour permettre au onClick de vérifier le flag
      setTimeout(() => {
        preventClickRef.current = false;
      }, 300);
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    // Réinitialiser immédiatement pour éviter les conflits
    setDraggingElementId(null);
    elementDragStartPosRef.current = null;
    hasDraggedElementRef.current = false;
  };

  // Double-clic pour zoomer
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isDrawing) return;
    e.preventDefault();
    if (scale < MAX_ZOOM) {
      setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP * 2));
    } else {
      resetView();
    }
  };

  // Activer le mode dessin
  const startDrawingMode = () => {
    setIsDrawing(true);
    setDrawnRect(null);
  };

  // Ajouter l'élément
  const handleAddElement = () => {
    if (!drawnRect || !newElementForm.name.trim()) return;

    // Mode "nouvelle catégorie"
    if (newElementForm.categoryMode === 'new' && newElementForm.newCategoryName.trim()) {
      const categoryName = newElementForm.newCategoryName.trim();
      // Vérifier si la catégorie existe déjà
      const existingCategory = domain.categories.find(c => c.name === categoryName);
      if (existingCategory) {
        createElementInCategory(existingCategory.id);
      } else {
        // Créer la nouvelle catégorie
        addCategory(domain.id, categoryName, 'horizontal');
        // Attendre la création
        setTimeout(() => {
          const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
          const newCategory = updatedDomain?.categories.find(c => c.name === categoryName);
          if (newCategory) {
            createElementInCategory(newCategory.id);
          }
        }, 100);
      }
      return;
    }

    // Mode "catégorie existante"
    let categoryId = newElementForm.categoryId;

    // Si pas de catégorie sélectionnée, créer une catégorie par défaut
    if (!categoryId) {
      let defaultCategory = domain.categories.find(c => c.name === 'Ã‰léments');
      if (!defaultCategory) {
        addCategory(domain.id, 'Ã‰léments', 'horizontal');
        // Attendre la création
        setTimeout(() => {
          const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
          const newCategory = updatedDomain?.categories.find(c => c.name === 'Ã‰léments');
          if (newCategory) {
            createElementInCategory(newCategory.id);
          }
        }, 100);
        return;
      }
      categoryId = defaultCategory.id;
    }

    createElementInCategory(categoryId);
  };

  const createElementInCategory = (categoryId: string) => {
    if (!drawnRect) return;

    const elementName = newElementForm.name.trim();

    // Vérifier s'il existe des éléments avec le même nom
    const matches = findElementsByName(elementName);

    if (matches.length > 0) {
      // Des éléments avec ce nom existent - afficher le modal
      setPendingElementData({
        name: elementName,
        categoryId,
        status: newElementForm.status,
        icon: newElementForm.icon,
        rect: drawnRect,
      });
      setExistingMatches(matches.map(m => ({
        id: m.element.id,
        name: m.element.name,
        location: `${m.domainName} > ${m.categoryName}`,
        linkedGroupId: m.element.linkedGroupId,
        status: m.element.status,
        type: 'element' as const,
      })));
      setShowLinkModal(true);
    } else {
      // Pas de doublon - créer normalement
      doCreateElement(categoryId, elementName, null);
    }
  };

  // Créer l'élément effectivement
  const doCreateElement = (categoryId: string, elementName: string, linkedGroupId: string | null, linkSubElements?: boolean) => {
    if (!drawnRect && !pendingElementData) return;

    const rect = drawnRect || pendingElementData?.rect;
    const status = pendingElementData?.status || newElementForm.status;
    const icon = pendingElementData?.icon || newElementForm.icon;

    if (!rect) return;

    addElement(categoryId, elementName);

    // Attendre la création puis mettre à jour position/taille
    setTimeout(() => {
      const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
      const category = updatedDomain?.categories.find(c => c.id === categoryId);
      const newElement = category?.elements.find(e => e.name === elementName);

      if (newElement) {
        updateElement(newElement.id, {
          status,
          icon: icon || undefined,
          positionX: rect.x,
          positionY: rect.y,
          width: rect.width,
          height: rect.height,
        });

        // Si on doit lier à un groupe existant (avec fusion des catégories/sous-éléments)
        if (linkedGroupId) {
          linkElement(newElement.id, linkedGroupId, linkSubElements);
        }
      }

      // Reset
      setShowAddModal(false);
      setDrawnRect(null);
      setPendingElementData(null);
      setNewElementForm({ name: '', status: 'ok', categoryMode: 'existing', categoryId: '', newCategoryName: '', icon: '' });
    }, 100);
  };

  // Créer l'élément indépendamment (sans liaison)
  const handleCreateIndependent = () => {
    if (pendingElementData) {
      doCreateElement(pendingElementData.categoryId, pendingElementData.name, null);
    }
    setShowLinkModal(false);
  };

  // Créer l'élément et le lier à un groupe existant (avec fusion des catégories/sous-éléments)
  const handleCreateLinked = (linkedGroupId: string, linkSubElements?: boolean) => {
    if (pendingElementData) {
      doCreateElement(pendingElementData.categoryId, pendingElementData.name, linkedGroupId, linkSubElements);
    }
    setShowLinkModal(false);
  };

  // Ã‰tat local pour le toggle (réactif) - avec localStorage en mode readOnly
  const getInitialClustering = (): boolean => {
    if (_readOnly) {
      const localValue = localStorage.getItem(`clustering-${domain.id}`);
      if (localValue !== null) {
        return localValue === 'true';
      }
    }
    return domain.enableClustering !== false;
  };

  const [localClustering, setLocalClustering] = useState(getInitialClustering);

  // États pour afficher/masquer l'encart domaine et les catégories
  const getInitialShowDomainInfo = (): boolean => {
    const localValue = localStorage.getItem(`showDomainInfo-${domain.id}`);
    return localValue !== null ? localValue === 'true' : true; // Par défaut true
  };
  const getInitialShowCategories = (): boolean => {
    const localValue = localStorage.getItem(`showCategories-${domain.id}`);
    return localValue !== null ? localValue === 'true' : true; // Par défaut true
  };
  const [showDomainInfo, setShowDomainInfo] = useState(getInitialShowDomainInfo);
  const [showCategories, setShowCategories] = useState(getInitialShowCategories);

  // Synchroniser avec le domaine quand il change
  useEffect(() => {
    if (_readOnly) {
      const localValue = localStorage.getItem(`clustering-${domain.id}`);
      if (localValue !== null) {
        setLocalClustering(localValue === 'true');
      } else {
        setLocalClustering(domain.enableClustering !== false);
      }
    } else {
      setLocalClustering(domain.enableClustering !== false);
    }
  }, [domain.id, domain.enableClustering, _readOnly]);

  // ============================================================================
  // VÉRIFICATION DE SÉCURITÉ APRÈS LES HOOKS
  // (Doit être après tous les hooks pour respecter les règles React)
  // ============================================================================
  if (!domain || !domain.categories || !Array.isArray(domain.categories)) {
    console.error('[BackgroundView] Domain invalide:', domain);
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Erreur : Domaine invalide ou données manquantes</p>
      </div>
    );
  }

  // Calculer les clusters d'éléments qui se chevauchent
  const calculateClusters = (): { clusters: ElementCluster[]; singleElements: Element[] } => {
    if (positionedElements.length === 0) return { clusters: [], singleElements: [] };

    // Vérifier si le clustering est activé
    const clusteringEnabled = localClustering;

    // Si le clustering est désactivé, retourner tous les éléments individuellement
    if (!clusteringEnabled) {
      return { clusters: [], singleElements: positionedElements };
    }

    // Distance de clustering en % (augmente quand on dézoome)
    const clusterThreshold = 5 / scale;

    // Si zoom > 1.5, pas de clustering
    if (scale > 1.5) {
      return { clusters: [], singleElements: positionedElements };
    }

    const usedElements = new Set<string>();
    const clusters: ElementCluster[] = [];
    const singleElements: Element[] = [];

    // Vérifie si deux rectangles se chevauchent ou sont proches
    const doOverlap = (e1: Element, e2: Element) => {
      const margin = clusterThreshold;
      const r1 = { x: e1.positionX!, y: e1.positionY!, w: e1.width!, h: e1.height! };
      const r2 = { x: e2.positionX!, y: e2.positionY!, w: e2.width!, h: e2.height! };

      return !(r1.x + r1.w + margin < r2.x ||
        r2.x + r2.w + margin < r1.x ||
        r1.y + r1.h + margin < r2.y ||
        r2.y + r2.h + margin < r1.y);
    };

    positionedElements.forEach(element => {
      if (usedElements.has(element.id)) return;

      // Trouver les éléments qui chevauchent
      const overlapping = positionedElements.filter(e => {
        if (e.id === element.id || usedElements.has(e.id)) return false;
        return doOverlap(element, e);
      });

      if (overlapping.length > 0) {
        const clusterElements = [element, ...overlapping];
        clusterElements.forEach(e => usedElements.add(e.id));

        // Calculer les bounds englobants
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        clusterElements.forEach(e => {
          minX = Math.min(minX, e.positionX!);
          minY = Math.min(minY, e.positionY!);
          maxX = Math.max(maxX, e.positionX! + e.width!);
          maxY = Math.max(maxY, e.positionY! + e.height!);
        });

        // Trouver le statut le plus critique
        let worstStatus: TileStatus = 'ok';
        let worstPriority = STATUS_PRIORITY['ok'];
        clusterElements.forEach(e => {
          if (!e || typeof e !== 'object') return; // Ignorer les éléments invalides
          const effectiveStatus: TileStatus = getEffectiveStatus(e, domains) || e.status || 'ok';
          const priority = STATUS_PRIORITY[effectiveStatus] || 0;
          if (priority > worstPriority) {
            worstPriority = priority;
            worstStatus = effectiveStatus;
          }
        });

        clusters.push({
          id: `cluster-${element.id}`,
          elements: clusterElements,
          bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          worstStatus,
          count: clusterElements.length,
        });
      } else {
        usedElements.add(element.id);
        singleElements.push(element);
      }
    });

    return { clusters, singleElements };
  };

  const { clusters, singleElements } = calculateClusters();

  // Les fonctions d'édition ont été déplacées vers EditorPanel

  // Diagnostic en mode read-only - Vérifications approfondies
  useEffect(() => {
    if (_readOnly) {
      console.log(`[BackgroundView READ-ONLY] ====================`);
      console.log(`[BackgroundView READ-ONLY] Domain "${domain?.name}" (templateType: ${domain?.templateType})`);
      console.log(`[BackgroundView READ-ONLY] Domain object keys:`, domain ? Object.keys(domain) : 'DOMAIN IS NULL');
      console.log(`[BackgroundView READ-ONLY] backgroundImage type:`, typeof domain?.backgroundImage);
      console.log(`[BackgroundView READ-ONLY] backgroundImage value:`, domain?.backgroundImage ? `${domain.backgroundImage.substring(0, 50)}...` : 'null/undefined');
      console.log(`[BackgroundView READ-ONLY] imageUrl state:`, imageUrl ? `${imageUrl.substring(0, 50)}...` : 'EMPTY');
      console.log(`[BackgroundView READ-ONLY] imageUrl length:`, imageUrl?.length || 0);

      if (!domain?.backgroundImage || !domain.backgroundImage.trim()) {
        console.error(`[BackgroundView READ-ONLY] âŒ Domain "${domain?.name}": backgroundImage est ${domain?.backgroundImage ? 'VIDE' : 'ABSENTE'}`);
        if (domain) {
          console.error(`[BackgroundView READ-ONLY] Domain object (preview):`, JSON.stringify(domain, null, 2).substring(0, 1000));
        }
      } else {
        const isValid = isValidBase64Image(domain.backgroundImage);
        console.log(`[BackgroundView READ-ONLY] âœ… Domain "${domain?.name}": backgroundImage présente (${domain.backgroundImage.length} caractères)`);
        console.log(`[BackgroundView READ-ONLY] backgroundImage starts with:`, domain.backgroundImage.substring(0, 30));
        console.log(`[BackgroundView READ-ONLY] Starts with 'data:':`, domain.backgroundImage.startsWith('data:'));
        console.log(`[BackgroundView READ-ONLY] Starts with 'data:image/':`, domain.backgroundImage.startsWith('data:image/'));
        console.log(`[BackgroundView READ-ONLY] Is valid base64 image:`, isValid);
        if (!isValid) {
          console.error(`[BackgroundView READ-ONLY] âŒ Image INVALIDE pour "${domain?.name}" - ne passera pas la validation`);
          const base64Part = domain.backgroundImage.split(',')[1];
          console.error(`[BackgroundView READ-ONLY] Base64 part length:`, base64Part?.length || 0);
          console.error(`[BackgroundView READ-ONLY] Base64 part preview:`, base64Part?.substring(0, 50) || 'NONE');
        }
      }

      // Vérifier aussi imageUrl après traitement
      console.log(`[BackgroundView READ-ONLY] imageUrl après traitement:`, {
        hasImageUrl: !!imageUrl,
        imageUrlLength: imageUrl?.length || 0,
        isValid: imageUrl ? isValidBase64Image(imageUrl) : false,
        willRender: imageUrl && imageUrl.trim().length > 0 && imageUrl.startsWith('data:image/') && isValidBase64Image(imageUrl)
      });
      console.log(`[BackgroundView READ-ONLY] ====================`);
    }
  }, [domain, imageUrl, _readOnly]);

  // Trouver la catégorie sélectionnée pour la vue des éléments
  const categoryForView = categoryViewId 
    ? domain.categories?.find(c => c.id === categoryViewId) 
    : null;

  // Afficher la vue des éléments d'une catégorie si sélectionnée
  if (categoryForView) {
    return (
      <MapCategoryElementsView
        category={categoryForView}
        domain={domain}
        onBack={() => setCategoryViewId(null)}
        onElementClick={_onElementClick}
        readOnly={_readOnly}
        domains={domainsProp}
      />
    );
  }

  return (
    <div className="relative h-full flex flex-col bg-[#F5F7FA] overflow-hidden">
      {/* Header - Style PDF SOMONE mode clair (conditionnel) */}
      {showDomainInfo && (
        <div className="absolute top-4 left-4 z-20 bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-md">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[#1E3A5F] flex items-center gap-2">
              <MuiIcon name="Image" size={20} className="text-[#1E3A5F]" />
              {domain.name}
            </h2>
            <span className="text-xs text-[#94A3B8] whitespace-nowrap">
              maj le : {formatLastUpdate(domain.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-[#64748B]">
              {positionedElements.length} élément(s) positionné(s)
              {selectedCategories.length > 0 && ` (filtre: ${selectedCategories.length} cat.)`}
            </p>
            {!_readOnly && positionedElements.length > 0 && (
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="p-1 text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors"
                title="Édition en masse"
              >
                <MuiIcon name="EditNote" size={16} />
              </button>
            )}
          </div>
          {/* Résumé des statuts par criticité */}
          <StatusSummary elements={positionedElements} domains={domains} compact />
        </div>
      )}

      {/* Filtre de catégories - positionné sous l'encart header (conditionnel) */}
      {showCategories && domain.categories && domain.categories.length > 0 && (
        <div 
          className="absolute left-4 z-20 bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden" 
          style={{ 
            top: showDomainInfo ? '11rem' : '1rem', // Positionner selon si l'encart domaine est visible
            maxHeight: 'calc(100vh - 250px)' 
          }}
        >
          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className="w-full px-4 py-2 flex items-center justify-between gap-2 hover:bg-[#F5F7FA] transition-colors"
          >
            <span className="text-sm font-medium text-[#1E3A5F] flex items-center gap-2">
              <MuiIcon name="Filter" size={16} />
              Catégories
            </span>
            <MuiIcon name={showCategoryFilter ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-[#64748B]" />
          </button>
          
          {showCategoryFilter && (
            <div className="px-2 py-2 border-t border-[#E2E8F0] max-h-64 overflow-y-auto">
              {/* Bouton tout sélectionner / désélectionner */}
              <button
                onClick={() => {
                  if (selectedCategories.length === domain.categories.length) {
                    setSelectedCategories([]);
                  } else {
                    setSelectedCategories(domain.categories.map(c => c.id));
                  }
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors mb-1"
              >
                {selectedCategories.length === domain.categories.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              
              {domain.categories.map(category => {
                const isSelected = selectedCategories.includes(category.id);
                const elementCount = category.elements.filter(e => 
                  e.positionX !== undefined && e.positionY !== undefined
                ).length;
                
                return (
                  <div
                    key={category.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                      isSelected ? 'bg-[#1E3A5F]/10' : 'hover:bg-[#F5F7FA]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, category.id]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#1E3A5F] focus:ring-[#1E3A5F] cursor-pointer"
                    />
                    <button
                      onClick={() => setCategoryViewId(category.id)}
                      className="text-sm text-[#1E3A5F] flex-1 text-left hover:text-[#2D5A8F] hover:underline transition-colors"
                      title="Cliquez pour voir les éléments de cette catégorie"
                    >
                      {category.name}
                    </button>
                    <span className="text-xs text-[#64748B]">({elementCount})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contrôles de zoom */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden">
        <button onClick={zoomIn} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Zoomer">
          <MuiIcon name="Plus" size={20} />
        </button>
        <button onClick={zoomOut} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Dézoomer">
          <MuiIcon name="Minus" size={20} />
        </button>
        <button onClick={resetView} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Réinitialiser">
          <MuiIcon name="Maximize" size={20} />
        </button>
      </div>

      {/* Indicateur de zoom */}
      <div className="absolute top-4 right-20 z-20 bg-white rounded-lg px-3 py-2 border border-[#E2E8F0] shadow-md">
        <span className="text-sm font-medium text-[#1E3A5F]">{Math.round(scale * 100)}%</span>
      </div>

      {/* Panneau de toggles - Visible dans le studio et les cockpits publiés */}
      <div className="absolute top-40 right-4 z-30 bg-white rounded-lg px-2 py-1.5 border border-[#E2E8F0] shadow-md space-y-1.5">
        {/* Toggle regroupement */}
        <div className="flex items-center gap-1.5">
          <MuiIcon name="Layers" size={12} className="text-[#1E3A5F]" />
          <button
            onClick={() => {
              const newValue = !localClustering;
              setLocalClustering(newValue);

              if (_readOnly) {
                // En mode readOnly, sauvegarder dans localStorage
                localStorage.setItem(`clustering-${domain.id}`, String(newValue));
              } else {
                // En mode studio, sauvegarder dans le domaine
                updateDomain(domain.id, { enableClustering: newValue });
              }
            }}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${localClustering ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
              }`}
            role="switch"
            aria-checked={localClustering}
            title={localClustering ? 'Désactiver le regroupement' : 'Activer le regroupement'}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${localClustering ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
            />
          </button>
        </div>
        
        {/* Toggle affichage encart domaine */}
        <div className="flex items-center gap-1.5">
          <MuiIcon name="Info" size={12} className="text-[#1E3A5F]" />
          <button
            onClick={() => {
              const newValue = !showDomainInfo;
              setShowDomainInfo(newValue);
              localStorage.setItem(`showDomainInfo-${domain.id}`, String(newValue));
            }}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${showDomainInfo ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
              }`}
            role="switch"
            aria-checked={showDomainInfo}
            title={showDomainInfo ? 'Masquer infos domaine' : 'Afficher infos domaine'}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${showDomainInfo ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
            />
          </button>
        </div>
        
        {/* Toggle affichage catégories */}
        <div className="flex items-center gap-1.5">
          <MuiIcon name="Category" size={12} className="text-[#1E3A5F]" />
          <button
            onClick={() => {
              const newValue = !showCategories;
              setShowCategories(newValue);
              localStorage.setItem(`showCategories-${domain.id}`, String(newValue));
            }}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${showCategories ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
              }`}
            role="switch"
            aria-checked={showCategories}
            title={showCategories ? 'Masquer catégories' : 'Afficher catégories'}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${showCategories ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
            />
          </button>
        </div>
      </div>

      {/* Mode dessin actif */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-[#1E3A5F] text-white rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <MuiIcon name="Pencil" size={16} />
          <span className="text-sm font-medium">Dessinez un rectangle sur l'image</span>
          <button
            onClick={() => setIsDrawing(false)}
            className="ml-2 p-1 hover:bg-white/20 rounded"
          >
            <MuiIcon name="X" size={16} />
          </button>
        </div>
      )}

      {/* Conteneur de la vue avec zoom/pan - utilise 100% de la hauteur disponible */}
      <div
        ref={containerRef}
        className={`w-full ${_readOnly ? 'h-full' : 'flex-1'} overflow-hidden ${isDrawing ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        style={{
          position: 'relative',
          height: _readOnly ? '100%' : undefined,
          minHeight: _readOnly ? '100%' : '400px'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          ref={imageContainerRef}
          className="w-full h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging || isDrawing || draggingElementId ? 'none' : 'transform 0.1s ease-out',
            position: 'relative',
            width: '100%',
            height: '100%'
          }}
        >
          {/* Image de fond */}
          {/* CRITIQUE: Vérifier explicitement que l'image est valide avant de l'afficher */}
          {/* En mode readOnly, on utilise directement domain.backgroundImage si imageUrl est vide */}
          {(() => {
            const imageToDisplay = imageUrl || (_readOnly && domain.backgroundImage ? domain.backgroundImage : '');
            return imageToDisplay && imageToDisplay.trim().length > 0 && (
              imageToDisplay.startsWith('data:image/') || imageToDisplay.startsWith('data:') || _readOnly
            ) ? (
              <img
                key={`bg-image-${domain.id}-${(imageToDisplay || '').substring(0, 20)}-${_readOnly ? 'readonly' : 'edit'}`}
                ref={imageRef}
                src={imageToDisplay}
                alt="Fond"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 0,
                  opacity: imageOpacity / 100
                }}
                crossOrigin="anonymous"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  const container = imageContainerRef.current;
                  const parentContainer = containerRef.current;
                  const computedStyle = window.getComputedStyle(img);
                  const containerRect = container?.getBoundingClientRect();
                  const parentRect = parentContainer?.getBoundingClientRect();
                  const imgRect = img.getBoundingClientRect();

                  console.log(`[BackgroundView] âœ… Image chargée avec succès pour "${domain.name}" - dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
                  console.log(`[BackgroundView] Image src length: ${domain.backgroundImage?.length || 0}`);
                  console.log(`[BackgroundView] Image element computed style:`, {
                    display: computedStyle.display,
                    width: computedStyle.width,
                    height: computedStyle.height,
                    visibility: computedStyle.visibility,
                    opacity: computedStyle.opacity,
                    position: computedStyle.position,
                    top: computedStyle.top,
                    left: computedStyle.left,
                    right: computedStyle.right,
                    bottom: computedStyle.bottom,
                  });
                  console.log(`[BackgroundView] Image getBoundingClientRect:`, {
                    width: imgRect.width,
                    height: imgRect.height,
                    top: imgRect.top,
                    left: imgRect.left,
                    bottom: imgRect.bottom,
                    right: imgRect.right,
                  });
                  if (container) {
                    console.log(`[BackgroundView] Container dimensions:`, {
                      offsetWidth: container.offsetWidth,
                      offsetHeight: container.offsetHeight,
                      clientWidth: container.clientWidth,
                      clientHeight: container.clientHeight,
                      rectWidth: containerRect?.width,
                      rectHeight: containerRect?.height,
                      rectTop: containerRect?.top,
                      rectLeft: containerRect?.left,
                      rectBottom: containerRect?.bottom,
                      rectRight: containerRect?.right,
                    });
                  }
                  if (parentContainer) {
                    console.log(`[BackgroundView] Parent container dimensions:`, {
                      offsetWidth: parentContainer.offsetWidth,
                      offsetHeight: parentContainer.offsetHeight,
                      clientWidth: parentContainer.clientWidth,
                      clientHeight: parentContainer.clientHeight,
                      rectWidth: parentRect?.width,
                      rectHeight: parentRect?.height,
                      rectTop: parentRect?.top,
                      rectLeft: parentRect?.left,
                      rectBottom: parentRect?.bottom,
                      rectRight: parentRect?.right,
                    });
                  }
                  calculateImageBounds();
                  if (_readOnly) {
                    console.log(`[BackgroundView READ-ONLY] âœ… Image chargée avec succès pour le domaine "${domain.name}"`);
                    console.log(`[BackgroundView READ-ONLY] Image rect:`, {
                      width: imgRect.width,
                      height: imgRect.height,
                      top: imgRect.top,
                      left: imgRect.left,
                      bottom: imgRect.bottom,
                      right: imgRect.right
                    });
                    console.log(`[BackgroundView READ-ONLY] Container rect:`, containerRect ? {
                      width: containerRect.width,
                      height: containerRect.height,
                      top: containerRect.top,
                      left: containerRect.left,
                      bottom: containerRect.bottom,
                      right: containerRect.right
                    } : 'NULL');
                    console.log(`[BackgroundView READ-ONLY] Parent container rect:`, parentRect ? {
                      width: parentRect.width,
                      height: parentRect.height,
                      top: parentRect.top,
                      left: parentRect.left,
                      bottom: parentRect.bottom,
                      right: parentRect.right
                    } : 'NULL');
                    console.log(`[BackgroundView READ-ONLY] ðŸ” DIAGNOSTIC - Image visible:`, imgRect.width > 1 && imgRect.height > 1 ? 'OUI' : 'NON');
                    console.log(`[BackgroundView READ-ONLY] ðŸ” DIAGNOSTIC - Container visible:`, containerRect && containerRect.width > 1 && containerRect.height > 1 ? 'OUI' : 'NON');
                    console.log(`[BackgroundView READ-ONLY] ðŸ” DIAGNOSTIC - Parent visible:`, parentRect && parentRect.width > 1 && parentRect.height > 1 ? 'OUI' : 'NON');
                  }
                }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  console.error(`[BackgroundView] âŒ ERREUR chargement image de fond pour le domaine "${domain.name}"`);
                  console.error(`[BackgroundView] URL preview:`, imageUrl?.substring(0, 100) || 'EMPTY');
                  console.error(`[BackgroundView] Longueur totale:`, imageUrl?.length || 0);
                  console.error(`[BackgroundView] Type:`, typeof imageUrl);
                  console.error(`[BackgroundView] Starts with data:`, imageUrl?.startsWith('data:'));
                  console.error(`[BackgroundView] Domain backgroundImage:`, domain?.backgroundImage ? `${typeof domain.backgroundImage} (${domain.backgroundImage.length} chars)` : 'ABSENT');
                  console.error(`[BackgroundView] Image element:`, img);
                  if (_readOnly) {
                    console.error(`[BackgroundView READ-ONLY] âŒ Image non chargée - imageUrl length: ${imageUrl?.length || 0} caractères`);
                    console.error(`[BackgroundView READ-ONLY] Domain backgroundImage:`, domain?.backgroundImage ? 'PRESENTE' : 'ABSENTE');
                  }
                  // Ne pas cacher l'image en cas d'erreur - laisser visible pour debug
                  // img.style.display = 'none';
                }}
              />
            ) : null;
          })()}

          {/* Placeholder si pas d'image */}
          {!domain.backgroundImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-[#E2E8F0]">
                <div className="mx-auto mb-4"><MuiIcon name="Image" size={64} className="text-[#CBD5E1]" /></div>
                <p className="text-[#64748B]">Aucune image de fond configurée</p>
                <p className="text-sm text-[#94A3B8] mt-2 mb-4">
                  Ajoutez une image depuis un fichier ou une URL depuis le menu d'édition
                </p>
              </div>
            </div>
          )}

          {/* Rectangle en cours de dessin */}
          {isDrawing && drawStart.x !== 0 && imageBounds && (
            <div
              className="absolute border-2 border-dashed border-[#1E3A5F] bg-[#1E3A5F]/10 pointer-events-none"
              style={{
                left: `${imageBounds.x + Math.min(drawStart.x, drawEnd.x) * imageBounds.width / 100}px`,
                top: `${imageBounds.y + Math.min(drawStart.y, drawEnd.y) * imageBounds.height / 100}px`,
                width: `${Math.abs(drawEnd.x - drawStart.x) * imageBounds.width / 100}px`,
                height: `${Math.abs(drawEnd.y - drawStart.y) * imageBounds.height / 100}px`,
              }}
            />
          )}

          {/* Clusters d'éléments */}
          {clusters.map((cluster) => {
            if (!imageBounds || !cluster) return null;

            // Sécurité : vérifier que le statut existe
            const worstStatus = cluster.worstStatus || 'ok';
            const colors = STATUS_COLORS[worstStatus] || STATUS_COLORS.ok;
            if (!colors || !colors.hex) {
              console.warn('[BackgroundView] Couleurs invalides pour cluster:', cluster);
              return null;
            }

            // Centre du cluster (en % de l'image)
            const centerX = cluster.bounds.x + cluster.bounds.width / 2;
            const centerY = cluster.bounds.y + cluster.bounds.height / 2;

            // Convertir en pixels dans le conteneur transformé
            const left = imageBounds.x + centerX * imageBounds.width / 100;
            const top = imageBounds.y + centerY * imageBounds.height / 100;
            let clusterSize = 3 * imageBounds.width / 100; // 3% de l'image en pixels
            // Augmenter de 15% dans les DEUX dimensions (largeur ET hauteur) si le statut est mineur, critique ou fatal (fonctionne en studio ET en mode publié)
            const isCriticalCluster = cluster.worstStatus === 'mineur' || cluster.worstStatus === 'critique' || cluster.worstStatus === 'fatal';
            const clusterSizeMultiplier = isCriticalCluster ? 1.15 : 1.0;
            const originalClusterSize = clusterSize;
            clusterSize = clusterSize * clusterSizeMultiplier; // Appliqué à width ET height (cercle)

            // Log de débogage pour vérifier l'augmentation
            if (isCriticalCluster) {
              console.log(`[BackgroundView] ðŸ” Cluster - Statut: ${cluster.worstStatus}, Multiplicateur: ${clusterSizeMultiplier}, Taille: ${originalClusterSize.toFixed(1)} â†’ ${clusterSize.toFixed(1)}`);
            }

            return (
              <div
                key={cluster.id}
                className="absolute z-10 group transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${clusterSize}px`,
                  height: `${clusterSize}px`,
                }}
                onMouseEnter={() => setHoveredElement(cluster.id)}
                onMouseLeave={() => setHoveredElement(null)}
              >
                <div
                  className="w-full h-full rounded-full cursor-pointer hover:brightness-110 transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: colors.hex,
                    boxShadow: `0 2px 8px ${colors.hex}50`
                  }}
                >
                  <span className="text-white font-bold text-sm">{cluster.count}</span>
                </div>

                {/* Tooltip cluster */}
                {hoveredElement === cluster.id && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-[9999] pointer-events-none">
                    <div className="bg-[#1E3A5F] text-white rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                      <p className="font-medium text-sm">{cluster.count} éléments groupés</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Zoomez pour voir les détails</p>
                      <div className="text-xs mt-1 space-y-0.5">
                        {cluster.elements.slice(0, 3).map(e => {
                          if (!e || !e.id) return null; // Ignorer les éléments invalides
                          const statusColors = STATUS_COLORS[e.status] || STATUS_COLORS.ok;
                          return (
                            <div key={e.id} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors.hex }} />
                              <span>{e.name || 'Ã‰lément'}</span>
                            </div>
                          );
                        })}
                        {cluster.elements.length > 3 && (
                          <p className="text-[#94A3B8]">+{cluster.elements.length - 3} autres</p>
                        )}
                      </div>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-[#1E3A5F]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Ã‰léments individuels (rectangles ou icônes colorés) */}
          {singleElements.map((element) => {
            // Vérifications de sécurité
            if (!element || typeof element !== 'object' || !element.id) {
              console.warn('[BackgroundView] Ã‰lément invalide:', element);
              return null;
            }

            if (!imageBounds) return null;

            const colors = getEffectiveColors(element, domains);
            if (!colors || !colors.hex) {
              console.warn('[BackgroundView] Couleurs invalides pour élément:', element.name, element);
              return null;
            }

            const hasIcon = !!element.icon;

            // Convertir les pourcentages de l'image en pixels dans le conteneur transformé
            let width = (element.width || 0) * imageBounds.width / 100;
            let height = (element.height || 0) * imageBounds.height / 100;

            // Augmenter de 15% dans les DEUX dimensions (largeur ET hauteur) si le statut est mineur, critique ou fatal (fonctionne en studio ET en mode publié)
            const effectiveStatus = getEffectiveStatus(element, domains);
            const isCritical = effectiveStatus === 'mineur' || effectiveStatus === 'critique' || effectiveStatus === 'fatal';
            const sizeMultiplier = isCritical ? 1.15 : 1.0;
            const originalWidth = width;
            const originalHeight = height;
            width = width * sizeMultiplier;   // Largeur augmentée de 15%
            height = height * sizeMultiplier; // Hauteur augmentée de 15%

            // Log de débogage pour vérifier l'augmentation
            if (isCritical && (originalWidth > 0 || originalHeight > 0)) {
              console.log(`[BackgroundView] ðŸ” Ã‰lément "${element.name}" - Statut: ${effectiveStatus}, Multiplicateur: ${sizeMultiplier}, Taille: ${originalWidth.toFixed(1)}x${originalHeight.toFixed(1)} â†’ ${width.toFixed(1)}x${height.toFixed(1)}`);
            }

            // Ajuster la position pour garder le centre fixe (l'élément grandit de manière centrée)
            const centerX = (element.positionX || 0) + (element.width || 0) / 2;
            const centerY = (element.positionY || 0) + (element.height || 0) / 2;
            const left = imageBounds.x + (centerX * imageBounds.width / 100) - (width / 2);
            const top = imageBounds.y + (centerY * imageBounds.height / 100) - (height / 2);

            return (
              <div
                key={element.id}
                data-element-tile="true"
                className={`absolute z-10 group ${!_readOnly ? 'cursor-move' : 'cursor-pointer'
                  }`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  minWidth: '8px',
                  minHeight: '8px',
                }}
                onMouseEnter={(e) => {
                  setHoveredElement(element.id);
                  // Calculer la position du tooltip par rapport à l'écran
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8, // Au-dessus de l'élément
                    elementId: element.id
                  });
                }}
                onMouseLeave={() => {
                  setHoveredElement(null);
                  setTooltipPosition(null);
                }}
                onMouseDown={(e) => {
                  if (!_readOnly && e.button === 0) {
                    // Ignorer si on clique sur un bouton d'action
                    const target = e.target as HTMLElement;
                    if (target.closest('button')) {
                      return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    // Arrêter le drag de la vue si elle est en cours
                    setIsDragging(false);
                    setDraggingElementId(element.id);
                    elementDragStartPosRef.current = { elementId: element.id, x: e.clientX, y: e.clientY };
                  }
                }}
                onClick={(e) => {
                  // Ignorer si on clique sur un bouton d'action
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) {
                    return;
                  }
                  e.stopPropagation();
                  // Ne pas ouvrir si un drag a eu lieu
                  if (preventClickRef.current) {
                    return;
                  }
                  // Ouvrir le menu d'édition via onElementClick
                  if (_onElementClick) {
                    _onElementClick(element.id);
                  } else {
                    setCurrentElement(element.id);
                  }
                }}
              >
                {/* Icône colorée OU rectangle coloré simple */}
                {hasIcon ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center hover:scale-110 transition-all pointer-events-none"
                    style={{ color: colors.hex }}
                  >
                    <MuiIcon
                      name={element.icon!}
                      size={Math.max(16, Math.min(48, Math.min(element.width! || 5, element.height! || 5) * 8))}
                      color={colors.hex}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full h-full rounded-sm hover:brightness-110 transition-all pointer-events-none"
                    style={{
                      backgroundColor: colors.hex,
                      boxShadow: `0 2px 8px ${colors.hex}50`
                    }}
                  />
                )}

                {/* Boutons d'action au survol - collés au coin supérieur droit de l'élément */}
                {hoveredElement === element.id && !_readOnly && (
                  <div className="absolute top-0 right-0 flex items-center gap-0.5 z-30 transform translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                    {/* Bouton crayon supprimé - l'édition se fait maintenant via le menu de droite */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        cloneElement(element.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="flex items-center justify-center bg-white rounded-full hover:bg-gray-50 hover:scale-110 transition-all shadow-lg border border-[#E2E8F0]"
                      style={{
                        padding: '1px',
                        width: '9px',
                        height: '9px',
                      }}
                      title="Cloner"
                    >
                      <MuiIcon name="ContentCopy" size={6} className="text-[#1E3A5F]" />
                    </button>
                  </div>
                )}

                {/* Tooltip rendu via Portal pour être toujours au premier plan */}
              </div>
            );
          })}
        </div>
      </div>

      {/* Boutons d'action - masqués en mode readOnly */}
      {!_readOnly && (
        <div className="absolute bottom-4 right-4 z-20 flex gap-2">
          <button
            onClick={startDrawingMode}
            disabled={!domain.backgroundImage}
            className="flex items-center gap-2 px-4 py-3 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={!domain.backgroundImage ? 'Configurez d\'abord une image de fond' : 'Dessinez un rectangle pour ajouter un élément'}
          >
            <MuiIcon name="Plus" size={20} />
            Ajouter un élément
          </button>
        </div>
      )}

      {/* Modal Configuration Image */}
      {showConfigModal && (
        <Modal title="Configuration de l'image de fond" onClose={() => setShowConfigModal(false)}>
          <div className="space-y-6">
            {/* Upload de fichier */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Charger une image</label>
              <div className="p-4 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="bg-image-upload"
                />
                <label
                  htmlFor="bg-image-upload"
                  className="flex flex-col items-center justify-center cursor-pointer text-[#64748B] hover:text-[#1E3A5F]"
                >
                  <MuiIcon name="Upload" size={32} className="mb-2" />
                  <span className="text-sm font-medium">Cliquez pour choisir un fichier</span>
                  <span className="text-xs mt-1">PNG, JPG, GIF jusqu'à 10MB</span>
                </label>
              </div>
            </div>

            {/* Séparateur */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-sm text-[#94A3B8]">ou</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">URL de l'image</label>
              <input
                type="text"
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemple.com/image.png"
                className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            {/* Aperçu */}
            {imageUrl && (
              <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                <img
                  src={imageUrl}
                  alt="Aperçu"
                  className="max-h-40 rounded border border-[#E2E8F0] mx-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {imageUrl.startsWith('data:') && (
                  <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                    <MuiIcon name="CheckCircle" size={12} />
                    Fichier chargé
                  </p>
                )}
              </div>
            )}

            {/* Options d'affichage */}
            <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
              <h4 className="font-medium text-[#1E3A5F] mb-3 flex items-center gap-2">
                <MuiIcon name="SettingsIcon" size={16} />
                Options d'affichage
              </h4>

              {/* Opacité de l'image */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                  Opacité de l'image ({imageOpacity}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={imageOpacity}
                  onChange={(e) => setImageOpacity(Number(e.target.value))}
                  className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #1E3A5F 0%, #1E3A5F ${imageOpacity}%, #E2E8F0 ${imageOpacity}%, #E2E8F0 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-[#64748B] mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Toggle regroupement */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-[#1E3A5F]">Regroupement des éléments</label>
                  <p className="text-xs text-[#64748B] mt-1">
                    Regrouper les éléments proches en clusters pour améliorer la lisibilité
                  </p>
                </div>
                <button
                  onClick={() => setEnableClustering(!enableClustering)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableClustering ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                    }`}
                  role="switch"
                  aria-checked={enableClustering}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableClustering ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  setImageUrl(domain.backgroundImage || '');
                  setImageOpacity(domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100);
                  setEnableClustering(domain.enableClustering !== false);
                  setShowConfigModal(false);
                }}
                className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveImage}
                disabled={!imageUrl || isSaving}
                className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  'Enregistrer'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Ajouter Ã‰lément */}
      {showAddModal && drawnRect && (
        <Modal title="Ajouter un élément" onClose={() => {
          setShowAddModal(false);
          setDrawnRect(null);
          setNewElementForm({ name: '', status: 'ok', categoryMode: 'existing', categoryId: '', newCategoryName: '', icon: '' });
        }}>
          <div className="space-y-4">
            {/* Aperçu du rectangle */}
            <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
              <p className="text-xs text-[#64748B] mb-2">Zone sélectionnée :</p>
              <div className="flex items-center gap-4 text-sm text-[#1E3A5F]">
                <span>Position: {drawnRect.x.toFixed(1)}%, {drawnRect.y.toFixed(1)}%</span>
                <span>Taille: {drawnRect.width.toFixed(1)}% Ã— {drawnRect.height.toFixed(1)}%</span>
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Nom de l'élément *</label>
              <input
                type="text"
                value={newElementForm.name}
                onChange={(e) => setNewElementForm({ ...newElementForm, name: e.target.value })}
                placeholder="ex: Zone Nord"
                className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                autoFocus
              />
            </div>

            {/* Statut (couleur) */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Statut (couleur)</label>
              <div className="grid grid-cols-5 gap-2">
                {(['ok', 'mineur', 'critique', 'fatal', 'deconnecte'] as TileStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setNewElementForm({ ...newElementForm, status })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${newElementForm.status === status
                      ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                  >
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: STATUS_COLORS[status]?.hex || '#9E9E9E' }}
                    />
                    <span className="text-[10px] text-[#64748B]">{STATUS_LABELS[status]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Icône (optionnel) */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                Icône (optionnel)
                <span className="text-xs text-[#94A3B8] ml-2">Remplace le rectangle par une icône colorée</span>
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] max-h-32 overflow-y-auto">
                <button
                  onClick={() => setNewElementForm({ ...newElementForm, icon: '' })}
                  className={`p-2 rounded-lg border transition-all ${!newElementForm.icon
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                    : 'border-transparent hover:bg-white'
                    }`}
                  title="Aucune icône (rectangle)"
                >
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: STATUS_COLORS[newElementForm.status]?.hex || '#9E9E9E' }} />
                </button>
                {POPULAR_ICONS.map((iconName) => (
                  <button
                    key={iconName}
                    onClick={() => setNewElementForm({ ...newElementForm, icon: iconName })}
                    className={`p-2 rounded-lg border transition-all ${newElementForm.icon === iconName
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                      : 'border-transparent hover:bg-white'
                      }`}
                    title={iconName}
                  >
                    <MuiIcon name={iconName} size={24} color={STATUS_COLORS[newElementForm.status]?.hex || '#9E9E9E'} />
                  </button>
                ))}
                {/* Bouton pour ouvrir le sélecteur complet */}
                <button
                  onClick={() => setShowIconPicker(true)}
                  className="p-2 rounded-lg border border-dashed border-[#CBD5E1] hover:border-[#1E3A5F] hover:bg-white transition-all"
                  title="Plus d'icônes et images personnalisées..."
                >
                  <MuiIcon name="MoreHoriz" size={24} className="text-[#64748B]" />
                </button>
                {/* Afficher l'icône personnalisée si sélectionnée */}
                {newElementForm.icon && isCustomIcon(newElementForm.icon) && (
                  <button
                    className="p-2 rounded-lg border border-[#1E3A5F] bg-[#1E3A5F]/10"
                    title="Image personnalisée"
                  >
                    <MuiIcon name={newElementForm.icon} size={24} color={STATUS_COLORS[newElementForm.status]?.hex || '#9E9E9E'} />
                  </button>
                )}
              </div>
              {/* Sélecteur d'icônes complet */}
              {showIconPicker && (
                <IconPicker
                  value={newElementForm.icon}
                  onChange={(iconName) => {
                    setNewElementForm({ ...newElementForm, icon: iconName || '' });
                    setShowIconPicker(false);
                  }}
                  onClose={() => setShowIconPicker(false)}
                />
              )}
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Catégorie</label>

              {/* Choix du mode */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setNewElementForm({ ...newElementForm, categoryMode: 'existing' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${newElementForm.categoryMode === 'existing'
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                    : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                    }`}
                >
                  <MuiIcon name="FolderOpen" size={16} />
                  Existante
                </button>
                <button
                  onClick={() => setNewElementForm({ ...newElementForm, categoryMode: 'new' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${newElementForm.categoryMode === 'new'
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                    : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                    }`}
                >
                  <MuiIcon name="CreateNewFolder" size={16} />
                  Nouvelle
                </button>
              </div>

              {/* Sélection catégorie existante */}
              {newElementForm.categoryMode === 'existing' && (
                <select
                  value={newElementForm.categoryId}
                  onChange={(e) => setNewElementForm({ ...newElementForm, categoryId: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                >
                  <option value="">-- Sélectionner une catégorie --</option>
                  {domain.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}

              {/* Création nouvelle catégorie */}
              {newElementForm.categoryMode === 'new' && (
                <input
                  type="text"
                  value={newElementForm.newCategoryName}
                  onChange={(e) => setNewElementForm({ ...newElementForm, newCategoryName: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newElementForm.name.trim() && newElementForm.newCategoryName.trim()) {
                        handleAddElement();
                      }
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setNewElementForm({ ...newElementForm, categoryMode: 'existing', newCategoryName: '' });
                    }
                  }}
                  placeholder="Nom de la nouvelle catégorie"
                  className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                />
              )}

              <p className="text-xs text-[#94A3B8] mt-2">
                Les éléments seront affichés par catégorie en vue classique (horizontal)
              </p>
            </div>

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setDrawnRect(null);
                  setNewElementForm({ name: '', status: 'ok', categoryMode: 'existing', categoryId: '', newCategoryName: '', icon: '' });
                }}
                className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
              >
                Annuler
              </button>
              <button
                onClick={handleAddElement}
                disabled={
                  !newElementForm.name.trim() ||
                  (newElementForm.categoryMode === 'new' && !newElementForm.newCategoryName.trim())
                }
                className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <MuiIcon name="Plus" size={16} />
                Ajouter
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal d'édition supprimé - l'édition se fait maintenant via EditorPanel */}

      {/* Modal de liaison pour les éléments du même nom */}
      {showLinkModal && pendingElementData && (
        <LinkElementModal
          type="element"
          newItemName={pendingElementData.name}
          existingMatches={existingMatches}
          onLink={handleCreateLinked}
          onIndependent={handleCreateIndependent}
          onCancel={() => {
            setShowLinkModal(false);
            setPendingElementData(null);
          }}
        />
      )}

      {/* Modal d'édition en masse */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        elements={positionedElements}
        categories={domain.categories || []}
        domain={domain}
        templates={zones?.map(z => z.name) || []}
      />

      {/* Popup de renommage rapide après clonage */}
      {renamingElementId && createPortal(
        <div
          className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/30"
          onClick={handleRenameCancel}
          onMouseDown={(e) => e.target === e.currentTarget && e.stopPropagation()}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-4 min-w-[300px]"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Renommer l'élément cloné</h4>
            <input
              ref={renameInputRef}
              type="text"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRenameSubmit();
                } else if (e.key === 'Escape') {
                  handleRenameCancel();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onSelect={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#1E3A5F]"
              placeholder="Nom de l'élément"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={handleRenameCancel}
                onMouseDown={(e) => e.stopPropagation()}
                className="px-3 py-1.5 text-sm text-[#64748B] hover:text-[#1E3A5F] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRenameSubmit}
                onMouseDown={(e) => e.stopPropagation()}
                className="px-3 py-1.5 text-sm bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors"
              >
                Valider (Entrée)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tooltip au survol - rendu via Portal pour être toujours au premier plan */}
      {tooltipPosition && createPortal(
        <div
          className="fixed pointer-events-none z-[99999]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%) translateY(-100%) scale(2.1)',
            transformOrigin: 'bottom center'
          }}
        >
          <div className="bg-[#1E3A5F] text-white rounded-lg shadow-lg px-2 py-1 whitespace-nowrap">
            <p className="font-medium text-xs">
              {positionedElements.find(e => e.id === tooltipPosition.elementId)?.name ||
                allElements.find(e => e.id === tooltipPosition.elementId)?.name ||
                'Ã‰lément'}
            </p>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-[#1E3A5F]" style={{ transform: 'translateX(-50%) scale(1)' }} />
        </div>,
        document.body
      )}
    </div>
  );
}

// Composant Modal (utilisé pour les modals de configuration et d'ajout)
function Modal({ title, children, onClose, maxWidth = 'max-w-lg' }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <h3 className="text-lg font-semibold text-[#1E3A5F]">{title}</h3>
          <button onClick={onClose} className="p-1 text-[#94A3B8] hover:text-[#1E3A5F]">
            <MuiIcon name="X" size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// Composant Légende
