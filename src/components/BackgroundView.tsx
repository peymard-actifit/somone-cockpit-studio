import type { Domain, Element, TileStatus } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { STATUS_COLORS, STATUS_LABELS, STATUS_PRIORITY_MAP, getEffectiveColors, getEffectiveStatus } from '../types';
import { MuiIcon } from './IconPicker';
import { useState, useCallback, useEffect, useRef } from 'react';

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
}

export default function BackgroundView({ domain, onElementClick: _onElementClick, readOnly: _readOnly = false }: BackgroundViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const { setCurrentElement, updateElement, updateDomain, addCategory, addElement, cloneElement } = useCockpitStore();
  
  // État pour stocker la position et taille réelle de l'image dans le conteneur
  const [imageBounds, setImageBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // État du zoom et position (comme MapView)
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // État pour le drag d'un élément
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const elementDragStartPosRef = useRef<{ elementId: string; x: number; y: number } | null>(null);
  const hasDraggedElementRef = useRef<boolean>(false);
  const preventClickRef = useRef<boolean>(false); // Pour empêcher le onClick après un drag
  
  // Modal de configuration
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [imageUrl, setImageUrl] = useState(domain.backgroundImage || '');
  const [enableClustering, setEnableClustering] = useState(domain.enableClustering !== false);
  
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
  
  // Modal d'édition supprimé - l'édition se fait maintenant via EditorPanel
  
  // Tooltip au survol
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  
  // Limites de zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.25;
  
  // Récupérer tous les éléments du domaine avec position et taille
  const allElements = domain.categories.flatMap(c => c.elements);
  const positionedElements = allElements.filter(e => 
    e.positionX !== undefined && e.positionY !== undefined && 
    e.width !== undefined && e.height !== undefined
  );
  
  // Reset zoom et position quand l'image change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [domain.backgroundImage]);
  
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
      if (isValidBase64Image(trimmed)) {
        newImageUrl = trimmed;
      } else {
        console.warn(`[BackgroundView] ⚠️ Image invalide pour "${domain?.name}":`, {
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
    setEnableClustering(domain?.enableClustering !== false);
  }, [domain?.backgroundImage, domain?.enableClustering]);
  
  // Gérer l'upload de fichier
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Sauvegarder l'image et les options
  const handleSaveImage = () => {
    // Validation finale avant sauvegarde
    if (!isValidBase64Image(imageUrl)) {
      alert('Erreur: L\'image n\'est pas valide. Veuillez réessayer de charger l\'image.');
      console.error('[BackgroundView] ❌ Tentative de sauvegarde d\'une image invalide');
      return;
    }
    
    // Vérifier la taille (avertir si > 3MB)
    const sizeMB = imageUrl.length / 1024 / 1024;
    if (sizeMB > 3) {
      const confirmSave = confirm(
        `L'image est volumineuse (${sizeMB.toFixed(2)} MB). ` +
        `Cela peut ralentir le chargement. Voulez-vous continuer ?`
      );
      if (!confirmSave) return;
    }
    
    console.log(`[BackgroundView] 💾 Sauvegarde image: ${sizeMB.toFixed(2)} MB (${imageUrl.length} chars)`);
    updateDomain(domain.id, { 
      backgroundImage: imageUrl,
      enableClustering: enableClustering,
    });
    setShowConfigModal(false);
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
      let defaultCategory = domain.categories.find(c => c.name === 'Éléments');
      if (!defaultCategory) {
        addCategory(domain.id, 'Éléments', 'horizontal');
        // Attendre la création
        setTimeout(() => {
          const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
          const newCategory = updatedDomain?.categories.find(c => c.name === 'Éléments');
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
    addElement(categoryId, elementName);
    
    // Attendre la création puis mettre à jour position/taille
    setTimeout(() => {
      const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
      const category = updatedDomain?.categories.find(c => c.id === categoryId);
      const newElement = category?.elements.find(e => e.name === elementName);
      
      if (newElement) {
        updateElement(newElement.id, {
          status: newElementForm.status,
          icon: newElementForm.icon || undefined,
          positionX: drawnRect.x,
          positionY: drawnRect.y,
          width: drawnRect.width,
          height: drawnRect.height,
        });
      }
      
      // Reset
      setShowAddModal(false);
      setDrawnRect(null);
      setNewElementForm({ name: '', status: 'ok', categoryMode: 'existing', categoryId: '', newCategoryName: '', icon: '' });
    }, 100);
  };
  
  // État local pour le toggle (réactif) - avec localStorage en mode readOnly
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
          const effectiveStatus: TileStatus = getEffectiveStatus(e);
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
        console.error(`[BackgroundView READ-ONLY] ❌ Domain "${domain?.name}": backgroundImage est ${domain?.backgroundImage ? 'VIDE' : 'ABSENTE'}`);
        if (domain) {
          console.error(`[BackgroundView READ-ONLY] Domain object (preview):`, JSON.stringify(domain, null, 2).substring(0, 1000));
        }
      } else {
        const isValid = isValidBase64Image(domain.backgroundImage);
        console.log(`[BackgroundView READ-ONLY] ✅ Domain "${domain?.name}": backgroundImage présente (${domain.backgroundImage.length} caractères)`);
        console.log(`[BackgroundView READ-ONLY] backgroundImage starts with:`, domain.backgroundImage.substring(0, 30));
        console.log(`[BackgroundView READ-ONLY] Starts with 'data:':`, domain.backgroundImage.startsWith('data:'));
        console.log(`[BackgroundView READ-ONLY] Starts with 'data:image/':`, domain.backgroundImage.startsWith('data:image/'));
        console.log(`[BackgroundView READ-ONLY] Is valid base64 image:`, isValid);
        if (!isValid) {
          console.error(`[BackgroundView READ-ONLY] ❌ Image INVALIDE pour "${domain?.name}" - ne passera pas la validation`);
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
  
  return (
    <div className="relative h-full flex flex-col bg-[#F5F7FA] overflow-hidden">
      {/* Header - Style PDF SOMONE mode clair */}
      <div className="absolute top-4 left-4 z-20 bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-md">
        <h2 className="text-xl font-bold text-[#1E3A5F] flex items-center gap-2">
          <MuiIcon name="ImageIcon" size={20} className="text-[#1E3A5F]" />
          {domain.name}
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          {positionedElements.length} élément(s) positionnés
        </p>
      </div>
      
      {/* Contrôles de zoom */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden">
        <button onClick={zoomIn} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Zoomer">
          <MuiIcon name="Plus" size={20} />
        </button>
        <button onClick={zoomOut} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Dézoomer">
          <MuiIcon name="Minus" size={20} />
        </button>
        <button onClick={resetView} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Réinitialiser">
          <MuiIcon name="Maximize2" size={20} />
        </button>
      </div>
      
      {/* Indicateur de zoom */}
      <div className="absolute top-4 right-20 z-20 bg-white rounded-lg px-3 py-2 border border-[#E2E8F0] shadow-md">
        <span className="text-sm font-medium text-[#1E3A5F]">{Math.round(scale * 100)}%</span>
      </div>
      
      {/* Toggle regroupement - Visible dans le studio et les cockpits publiés */}
      <div className="absolute top-[140px] right-4 z-30 bg-white rounded-lg px-2 py-1.5 border border-[#E2E8F0] shadow-md">
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
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${
              localClustering ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
            }`}
            role="switch"
            aria-checked={localClustering}
            title={localClustering ? 'Désactiver le regroupement' : 'Activer le regroupement'}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                localClustering ? 'translate-x-3.5' : 'translate-x-0.5'
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
        className={`w-full ${_readOnly ? 'h-full' : 'flex-1'} overflow-hidden ${
          isDrawing ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ 
          minHeight: _readOnly ? 'calc(100vh - 200px)' : '400px', 
          height: _readOnly ? '100%' : undefined,
          position: _readOnly ? 'relative' : undefined,
          display: _readOnly ? 'block' : undefined
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
          className={`w-full relative ${_readOnly ? 'h-full' : ''}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging || isDrawing || draggingElementId ? 'none' : 'transform 0.1s ease-out',
            height: _readOnly ? '100%' : '100%',
            width: '100%',
            minHeight: _readOnly ? '100%' : undefined,
            minWidth: '100%',
            position: 'relative'
          }}
        >
          {/* Image de fond */}
          {/* CRITIQUE: Vérifier explicitement que l'image est valide avant de l'afficher */}
          {imageUrl && imageUrl.trim().length > 0 && imageUrl.startsWith('data:image/') && isValidBase64Image(imageUrl) ? (
            <img 
              key={`bg-image-${domain.id}-${imageUrl.substring(0, 20)}-${_readOnly ? 'readonly' : 'edit'}`}
              ref={imageRef}
              src={imageUrl}
              alt="Fond"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                zIndex: 0,
                opacity: 1,
                display: 'block'
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
                
                console.log(`[BackgroundView] ✅ Image chargée avec succès pour "${domain.name}" - dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
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
                    rect: containerRect,
                  });
                }
                if (parentContainer) {
                  console.log(`[BackgroundView] Parent container dimensions:`, {
                    offsetWidth: parentContainer.offsetWidth,
                    offsetHeight: parentContainer.offsetHeight,
                    clientWidth: parentContainer.clientWidth,
                    clientHeight: parentContainer.clientHeight,
                    rect: parentRect,
                  });
                }
                calculateImageBounds();
                if (_readOnly) {
                  console.log(`[BackgroundView READ-ONLY] ✅ Image chargée avec succès pour le domaine "${domain.name}"`);
                  console.log(`[BackgroundView READ-ONLY] Image rect:`, imgRect);
                  console.log(`[BackgroundView READ-ONLY] Container rect:`, containerRect);
                  console.log(`[BackgroundView READ-ONLY] Parent container rect:`, parentRect);
                }
              }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                console.error(`[BackgroundView] ❌ ERREUR chargement image de fond pour le domaine "${domain.name}"`);
                console.error(`[BackgroundView] URL preview:`, imageUrl?.substring(0, 100) || 'EMPTY');
                console.error(`[BackgroundView] Longueur totale:`, imageUrl?.length || 0);
                console.error(`[BackgroundView] Type:`, typeof imageUrl);
                console.error(`[BackgroundView] Starts with data:`, imageUrl?.startsWith('data:'));
                console.error(`[BackgroundView] Domain backgroundImage:`, domain?.backgroundImage ? `${typeof domain.backgroundImage} (${domain.backgroundImage.length} chars)` : 'ABSENT');
                console.error(`[BackgroundView] Image element:`, img);
                if (_readOnly) {
                  console.error(`[BackgroundView READ-ONLY] ❌ Image non chargée - imageUrl length: ${imageUrl?.length || 0} caractères`);
                  console.error(`[BackgroundView READ-ONLY] Domain backgroundImage:`, domain?.backgroundImage ? 'PRESENTE' : 'ABSENTE');
                }
                // Ne pas cacher l'image en cas d'erreur - laisser visible pour debug
                // img.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-[#EEF2F7]" />
          )}
          
        {/* Placeholder si pas d'image */}
        {!domain.backgroundImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-[#E2E8F0]">
              <div className="mx-auto mb-4"><MuiIcon name="ImageIcon" size={64} className="text-[#CBD5E1]" /></div>
              <p className="text-[#64748B]">Aucune image de fond configurée</p>
                <p className="text-sm text-[#94A3B8] mt-2 mb-4">
                  Ajoutez une image depuis un fichier ou une URL
                </p>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E]"
                >
                  Configurer l'image
                </button>
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
            if (!imageBounds) return null;
            
            const colors = STATUS_COLORS[cluster.worstStatus];
            
            // Centre du cluster (en % de l'image)
            const centerX = cluster.bounds.x + cluster.bounds.width / 2;
            const centerY = cluster.bounds.y + cluster.bounds.height / 2;
            
            // Convertir en pixels dans le conteneur transformé
            const left = imageBounds.x + centerX * imageBounds.width / 100;
            const top = imageBounds.y + centerY * imageBounds.height / 100;
            const clusterSize = 3 * imageBounds.width / 100; // 3% de l'image en pixels
            
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
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
                    <div className="bg-[#1E3A5F] text-white rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                      <p className="font-medium text-sm">{cluster.count} éléments groupés</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Zoomez pour voir les détails</p>
                      <div className="text-xs mt-1 space-y-0.5">
                        {cluster.elements.slice(0, 3).map(e => (
                          <div key={e.id} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[e.status].hex }} />
                            <span>{e.name}</span>
                          </div>
                        ))}
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
          
          {/* Éléments individuels (rectangles ou icônes colorés) */}
          {singleElements.map((element) => {
            const colors = getEffectiveColors(element);
            const hasIcon = !!element.icon;
            
            // Les positions sont stockées en pourcentage de l'image (0-100%)
            // Mais il faut les convertir en position absolue dans le conteneur transformé
            // en tenant compte de imageBounds (position et taille de l'image avec object-contain)
            if (!imageBounds) return null;
            
            // Convertir les pourcentages de l'image en pixels dans le conteneur transformé
            const left = imageBounds.x + (element.positionX || 0) * imageBounds.width / 100;
            const top = imageBounds.y + (element.positionY || 0) * imageBounds.height / 100;
            const width = (element.width || 0) * imageBounds.width / 100;
            const height = (element.height || 0) * imageBounds.height / 100;
            
            return (
              <div
                key={element.id}
                data-element-tile="true"
                className={`absolute z-10 group ${
                  !_readOnly ? 'cursor-move' : 'cursor-pointer'
                }`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  minWidth: '8px',
                  minHeight: '8px',
                }}
                onMouseEnter={() => setHoveredElement(element.id)}
                onMouseLeave={() => setHoveredElement(null)}
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
                        padding: '2px',
                        width: '18px',
                        height: '18px',
                      }}
                      title="Cloner"
                    >
                      <MuiIcon name="CopyIcon" size={12} className="text-[#1E3A5F]" />
                    </button>
                  </div>
                )}
                
                {/* Tooltip au survol */}
                {hoveredElement === element.id && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
                    <div className="bg-[#1E3A5F] text-white rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                      <p className="font-medium text-sm">{element.name}</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Cliquez pour voir les détails</p>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-[#1E3A5F]" />
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      
      {/* Barre d'instructions */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#E2E8F0]">
        <p className="text-xs text-[#64748B] flex items-center gap-4">
          <span>🖱️ Glisser = déplacer</span>
          <span>🔄 Molette = zoom</span>
          <span>👆 Double-clic = zoom</span>
        </p>
      </div>
      
      {/* Légende */}
      <div className="absolute bottom-4 left-4 z-20 bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-md">
        <div className="flex items-center gap-6">
          <LegendItem color="#8B5CF6" label="Fatal" />
          <LegendItem color="#E57373" label="Critique" />
          <LegendItem color="#FFB74D" label="Mineur" />
          <LegendItem color="#9CCC65" label="OK" />
          <LegendItem color="#9E9E9E" label="Déconnecté" />
        </div>
      </div>
      
      {/* Boutons d'action */}
      <div className="absolute bottom-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-white border border-[#E2E8F0] text-[#1E3A5F] rounded-xl hover:bg-[#F5F7FA] shadow-md"
        >
          <MuiIcon name="SettingsIcon" size={20} />
          Configurer
        </button>
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enableClustering ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                  }`}
                  role="switch"
                  aria-checked={enableClustering}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enableClustering ? 'translate-x-6' : 'translate-x-1'
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
                  setEnableClustering(domain.enableClustering !== false);
                  setShowConfigModal(false);
                }}
                className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveImage}
                disabled={!imageUrl}
                className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Modal Ajouter Élément */}
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
                <span>Taille: {drawnRect.width.toFixed(1)}% × {drawnRect.height.toFixed(1)}%</span>
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
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      newElementForm.status === status
                        ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div 
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: STATUS_COLORS[status].hex }}
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
                  className={`p-2 rounded-lg border transition-all ${
                    !newElementForm.icon
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                      : 'border-transparent hover:bg-white'
                  }`}
                  title="Aucune icône (rectangle)"
                >
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: STATUS_COLORS[newElementForm.status].hex }} />
                </button>
                {POPULAR_ICONS.map((iconName) => (
                  <button
                    key={iconName}
                    onClick={() => setNewElementForm({ ...newElementForm, icon: iconName })}
                    className={`p-2 rounded-lg border transition-all ${
                      newElementForm.icon === iconName
                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                        : 'border-transparent hover:bg-white'
                    }`}
                    title={iconName}
                    style={{ color: STATUS_COLORS[newElementForm.status].hex }}
                  >
                    <MuiIcon name={iconName} size={24} />
                  </button>
                ))}
              </div>
            </div>
            
            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Catégorie</label>
              
              {/* Choix du mode */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setNewElementForm({ ...newElementForm, categoryMode: 'existing' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                    newElementForm.categoryMode === 'existing'
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <MuiIcon name="FolderOpen" size={16} />
                  Existante
                </button>
                <button
                  onClick={() => setNewElementForm({ ...newElementForm, categoryMode: 'new' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                    newElementForm.categoryMode === 'new'
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <MuiIcon name="FolderPlus" size={16} />
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
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
      <span className="text-sm text-[#64748B]">{label}</span>
    </div>
  );
}
