import { useRef, useState, useEffect, useCallback } from 'react';
import type { Domain, TileStatus, MapBounds, GpsCoords, MapElement } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';

// Liste des icônes populaires pour les points de carte
const POPULAR_MAP_ICONS = [
  'Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Building2',
  'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart', 'Users',
  'Server', 'Database', 'Wifi', 'Radio', 'Cpu', 'HardDrive',
  'AlertTriangle', 'Shield', 'Lock', 'Key', 'Eye', 'Camera',
];

// Ordre de priorité des statuts (du plus critique au moins critique)
// Note: Utilise maintenant STATUS_PRIORITY_MAP depuis types/index.ts
const STATUS_PRIORITY: Record<TileStatus, number> = {
  fatal: 6,
  critique: 5,
  mineur: 4,
  ok: 3,
  information: 2,
  deconnecte: 1,
  herite: 0,
};

// Interface pour un cluster de points
interface PointCluster {
  id: string;
  points: MapElement[];
  center: { x: number; y: number };
  worstStatus: TileStatus;
  count: number;
}

interface MapViewProps {
  domain: Domain;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
}

export default function MapView({ domain, onElementClick: _onElementClick, readOnly: _readOnly = false }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { updateDomain, addMapElement, updateMapElement, cloneMapElement, updateMapBounds, setCurrentElement, addCategory, addElement, updateElement } = useCockpitStore();
  const { token } = useAuthStore();
  
  // État de l'analyse IA
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    detected: boolean;
    region?: string;
    confidence?: string;
    description?: string;
  } | null>(null);
  
  // État du zoom et position
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // État pour le drag d'un point
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const pointDragStartPosRef = useRef<{ pointId: string; x: number; y: number } | null>(null);
  const hasDraggedPointRef = useRef<boolean>(false);
  const preventClickRef = useRef<boolean>(false); // Pour empêcher le onClick après un drag
  
  // Modales
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  // Modal d'édition supprimé - l'édition se fait maintenant via EditorPanel
  
  // Formulaire configuration carte
  const [configForm, setConfigForm] = useState({
    imageUrl: domain.backgroundImage || '',
    topLeftLat: domain.mapBounds?.topLeft.lat?.toString() || '',
    topLeftLng: domain.mapBounds?.topLeft.lng?.toString() || '',
    bottomRightLat: domain.mapBounds?.bottomRight.lat?.toString() || '',
    bottomRightLng: domain.mapBounds?.bottomRight.lng?.toString() || '',
    enableClustering: domain.enableClustering !== false, // Par défaut true
  });
  
  // Formulaire ajout point
  const [pointForm, setPointForm] = useState({
    name: '',
    description: '',
    address: '',
    lat: '',
    lng: '',
    status: 'ok' as TileStatus,
    locationType: 'gps' as 'gps' | 'address',
    icon: 'Store' as string,
  });
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  
  // Formulaire édition point supprimé - l'édition se fait maintenant via EditorPanel
  
  // Limites de zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.25;
  
  // Reset zoom et position quand l'image change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [domain.backgroundImage]);
  
  // Mettre à jour le formulaire quand le domaine change
  useEffect(() => {
    setConfigForm({
      imageUrl: domain.backgroundImage || '',
      topLeftLat: domain.mapBounds?.topLeft.lat?.toString() || '',
      topLeftLng: domain.mapBounds?.topLeft.lng?.toString() || '',
      bottomRightLat: domain.mapBounds?.bottomRight.lat?.toString() || '',
      bottomRightLng: domain.mapBounds?.bottomRight.lng?.toString() || '',
      enableClustering: domain.enableClustering !== false,
    });
  }, [domain]);
  
  // Convertir coordonnées GPS en position % sur l'image
  // Utilise une projection linéaire simple (équirectangulaire)
  // adaptée aux cartes statiques (images) qui ne sont généralement pas en Mercator
  const gpsToPosition = (gps: GpsCoords): { x: number; y: number } | null => {
    if (!domain.mapBounds) return null;
    
    const { topLeft, bottomRight } = domain.mapBounds;
    
    // Vérifier que les bounds sont valides
    if (!topLeft || !bottomRight) return null;
    if (topLeft.lat === bottomRight.lat || topLeft.lng === bottomRight.lng) return null;
    
    // Projection linéaire simple (équirectangulaire)
    // X: 0% = ouest (topLeft.lng), 100% = est (bottomRight.lng)
    const x = ((gps.lng - topLeft.lng) / (bottomRight.lng - topLeft.lng)) * 100;
    
    // Y: 0% = nord (topLeft.lat), 100% = sud (bottomRight.lat)
    // Note: topLeft.lat > bottomRight.lat car le nord a une latitude plus élevée
    const y = ((topLeft.lat - gps.lat) / (topLeft.lat - bottomRight.lat)) * 100;
    
    
    return { x, y };
  };
  
  // Convertir position % sur l'image en coordonnées GPS (inverse de gpsToPosition)
  const positionToGps = (pos: { x: number; y: number }): GpsCoords | null => {
    if (!domain.mapBounds) return null;
    
    const { topLeft, bottomRight } = domain.mapBounds;
    
    // Vérifier que les bounds sont valides
    if (!topLeft || !bottomRight) return null;
    if (topLeft.lat === bottomRight.lat || topLeft.lng === bottomRight.lng) return null;
    
    // Conversion inverse
    const lng = topLeft.lng + (pos.x / 100) * (bottomRight.lng - topLeft.lng);
    const lat = topLeft.lat - (pos.y / 100) * (topLeft.lat - bottomRight.lat);
    
    return { lat, lng };
  };
  
  // Convertir position de la souris en position relative dans l'image (en tenant compte du zoom et pan)
  // Avec transform: translate(x, y) scale(s) et transform-origin: center center
  // La transformation CSS: point_transformed = center + (point - center) * scale + translate
  // Pour inverser: point = center + ((point_transformed - center) - translate) / scale
  const mouseToImagePosition = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!containerRef.current || !imageContainerRef.current) return null;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
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
    
    // Convertir en pourcentage par rapport au conteneur (l'image occupe 100% du conteneur)
    const relativeX = (localX / containerRect.width) * 100;
    const relativeY = (localY / containerRect.height) * 100;
    
    return { x: Math.max(0, Math.min(100, relativeX)), y: Math.max(0, Math.min(100, relativeY)) };
  }, [scale, position]);
  
  // Zoom avec la molette
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);
  
  // Zoom avec les boutons
  const zoomIn = () => setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  const zoomOut = () => setScale(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Début du drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    // Ne pas démarrer le drag de la vue si on drague un point
    if (draggingPointId) return;
    
    // Ne pas démarrer le drag si le clic est sur un point ou un bouton d'action
    const target = e.target as HTMLElement;
    const isPointElement = target.closest('[data-point-element]') || target.closest('.cursor-move');
    const isActionButton = target.closest('button');
    
    if (isPointElement || isActionButton) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };
  
  // Pendant le drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Drag d'un point
    if (draggingPointId) {
      // Arrêter le drag de la vue si elle est en cours
      if (isDragging) {
        setIsDragging(false);
      }
      
      // Marquer qu'un drag a eu lieu
      if (pointDragStartPosRef.current) {
        const dragDistance = Math.sqrt(
          Math.pow(e.clientX - pointDragStartPosRef.current.x, 2) + 
          Math.pow(e.clientY - pointDragStartPosRef.current.y, 2)
        );
        if (dragDistance > 5) {
          hasDraggedPointRef.current = true;
        }
      }
      const imagePos = mouseToImagePosition(e.clientX, e.clientY);
      if (imagePos) {
        const newGps = positionToGps(imagePos);
        if (newGps) {
          updateMapElement(draggingPointId, { gps: newGps });
        }
      }
      return;
    }
    
    // Drag de la vue - s'assurer qu'on ne drague pas un point
    if (!isDragging || draggingPointId) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart, draggingPointId, mouseToImagePosition, positionToGps, updateMapElement]);
  
  // Fin du drag
  const handleMouseUp = (e?: React.MouseEvent) => {
    const wasDraggingPoint = !!draggingPointId && hasDraggedPointRef.current;
    
    setIsDragging(false);
    
    // Si on a fait un drag, marquer pour empêcher le onClick
    if (wasDraggingPoint) {
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
    setDraggingPointId(null);
    pointDragStartPosRef.current = null;
    hasDraggedPointRef.current = false;
  };
  
  // Double-clic pour zoomer
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (scale < MAX_ZOOM) {
      setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP * 2));
    } else {
      resetView();
    }
  };
  
  // Analyser l'image avec l'IA pour détecter les coordonnées GPS
  const analyzeMapImage = async () => {
    if (!configForm.imageUrl) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      // Si l'image est en base64, l'envoyer comme imageBase64
      const isBase64 = configForm.imageUrl.startsWith('data:');
      
      const response = await fetch('/api/ai/analyze-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(
          isBase64 
            ? { imageBase64: configForm.imageUrl }
            : { imageUrl: configForm.imageUrl }
        ),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'analyse');
      }
      
      if (result.detected && result.topLeft && result.bottomRight) {
        // Pré-remplir les coordonnées détectées
        setConfigForm(prev => ({
          ...prev,
          topLeftLat: result.topLeft.lat.toString(),
          topLeftLng: result.topLeft.lng.toString(),
          bottomRightLat: result.bottomRight.lat.toString(),
          bottomRightLng: result.bottomRight.lng.toString(),
        }));
        
        // Sauvegarder automatiquement les coordonnées GPS détectées
        const bounds: MapBounds = {
          topLeft: { lat: result.topLeft.lat, lng: result.topLeft.lng },
          bottomRight: { lat: result.bottomRight.lat, lng: result.bottomRight.lng },
        };
        updateMapBounds(domain.id, bounds);
        
        setAnalysisResult({
          detected: true,
          region: result.region,
          confidence: result.confidence,
          description: `${result.description} — Coordonnées enregistrées automatiquement.`,
        });
      } else {
        setAnalysisResult({
          detected: false,
          description: result.reason || 'Zone géographique non reconnue',
        });
      }
    } catch (error: any) {
      console.error('Erreur analyse carte:', error);
      setAnalysisResult({
        detected: false,
        description: error.message || 'Erreur lors de l\'analyse de l\'image',
      });
    }
    
    setIsAnalyzing(false);
  };
  
  // Sauvegarder la configuration de la carte
  const handleSaveConfig = () => {
    // Sauvegarder l'URL de l'image et le clustering
    updateDomain(domain.id, { 
      backgroundImage: configForm.imageUrl,
      enableClustering: configForm.enableClustering,
    });
    
    // Sauvegarder les coordonnées GPS si toutes sont remplies
    const lat1 = parseFloat(configForm.topLeftLat);
    const lng1 = parseFloat(configForm.topLeftLng);
    const lat2 = parseFloat(configForm.bottomRightLat);
    const lng2 = parseFloat(configForm.bottomRightLng);
    
    if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
      const bounds: MapBounds = {
        topLeft: { lat: lat1, lng: lng1 },
        bottomRight: { lat: lat2, lng: lng2 },
      };
      updateMapBounds(domain.id, bounds);
    }
    
    setShowConfigModal(false);
  };
  
  // Géocoder une adresse en coordonnées GPS avec l'IA
  const geocodeAddress = async () => {
    if (!pointForm.address.trim()) return;
    
    setIsGeocodingAddress(true);
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Donne-moi les coordonnées GPS (latitude et longitude en degrés décimaux) de l'adresse suivante : "${pointForm.address}". Réponds UNIQUEMENT avec un JSON de ce format exact, sans texte avant ou après : {"lat": 48.8566, "lng": 2.3522}`,
          cockpitContext: {},
          history: [],
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        // Extraire les coordonnées du message
        const coordsMatch = result.message.match(/\{[^}]*"lat"\s*:\s*([-\d.]+)[^}]*"lng"\s*:\s*([-\d.]+)[^}]*\}/);
        if (coordsMatch) {
          setPointForm(prev => ({
            ...prev,
            lat: coordsMatch[1],
            lng: coordsMatch[2],
          }));
        } else {
          // Essayer de parser directement la réponse
          try {
            const coords = JSON.parse(result.message);
            if (coords.lat && coords.lng) {
              setPointForm(prev => ({
                ...prev,
                lat: coords.lat.toString(),
                lng: coords.lng.toString(),
              }));
            }
          } catch {
            console.error('Impossible de parser les coordonnées');
          }
        }
      }
    } catch (error) {
      console.error('Erreur géocodage:', error);
    }
    
    setIsGeocodingAddress(false);
  };
  
  // Ajouter un point
  const handleAddPoint = () => {
    const lat = parseFloat(pointForm.lat);
    const lng = parseFloat(pointForm.lng);
    
    if (pointForm.name.trim() && !isNaN(lat) && !isNaN(lng)) {
      addMapElement(domain.id, pointForm.name.trim(), { lat, lng }, pointForm.status, pointForm.icon);
      setPointForm({ name: '', description: '', address: '', lat: '', lng: '', status: 'ok', locationType: 'gps', icon: 'Store' });
      setShowAddPointModal(false);
    }
  };
  
  // Ouvrir l'édition d'un point
  // Les fonctions d'édition ont été déplacées vers EditorPanel
  
  // Clic sur un point pour aller vers la vue Element (ou la créer)
  const handlePointClick = (point: MapElement) => {
    if (!_readOnly) {
      if (point.elementId) {
        // Si le point est lié à un élément, ouvrir le menu d'édition via onElementClick
        if (_onElementClick) {
          _onElementClick(point.elementId);
        } else {
          setCurrentElement(point.elementId);
        }
      } else {
        // Créer un Element pour ce point
        createElementFromPoint(point);
      }
    }
  };
  
  // Créer un Element à partir d'un point de carte
  const createElementFromPoint = (point: MapElement) => {
    // Chercher ou créer une catégorie "Points de carte" dans le domaine
    let mapCategory = domain.categories.find(c => c.name === 'Points de carte');
    
    if (!mapCategory) {
      // Créer la catégorie si elle n'existe pas
      addCategory(domain.id, 'Points de carte', 'horizontal');
      // On doit attendre que le store soit mis à jour, donc on utilise un setTimeout
      setTimeout(() => {
        // Re-récupérer la catégorie créée
        const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
        const newCategory = updatedDomain?.categories.find(c => c.name === 'Points de carte');
        if (newCategory) {
          createElementInCategory(newCategory.id, point);
        }
      }, 100);
    } else {
      createElementInCategory(mapCategory.id, point);
    }
  };
  
  // Créer l'élément dans une catégorie et lier le point
  const createElementInCategory = (categoryId: string, point: MapElement) => {
    // Créer l'élément
    addElement(categoryId, point.name);
    
    // Attendre que l'élément soit créé puis le lier au point
    setTimeout(() => {
      const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
      const category = updatedDomain?.categories.find(c => c.id === categoryId);
      const newElement = category?.elements.find(e => e.name === point.name);
      
      if (newElement) {
        // Lier le point à l'élément créé
        updateMapElement(point.id, { elementId: newElement.id });
        // Copier le statut et l'icône du point vers l'élément
        updateElement(newElement.id, { 
          status: point.status,
          icon: point.icon 
        });
        // Naviguer vers l'élément
        setCurrentElement(newElement.id);
      }
    }, 100);
  };
  
  // Normaliser l'URL de l'image - s'assurer qu'elle est valide
  const mapImageUrl = (domain?.backgroundImage && typeof domain.backgroundImage === 'string' && domain.backgroundImage.trim().length > 0) 
    ? domain.backgroundImage.trim() 
    : '';
  
  // Diagnostic en mode read-only - Vérifications approfondies
  useEffect(() => {
    if (_readOnly) {
      console.log(`[MapView READ-ONLY] ====================`);
      console.log(`[MapView READ-ONLY] Domain "${domain?.name}" (templateType: ${domain?.templateType})`);
      console.log(`[MapView READ-ONLY] Domain object keys:`, domain ? Object.keys(domain) : 'DOMAIN IS NULL');
      console.log(`[MapView READ-ONLY] backgroundImage type:`, typeof domain?.backgroundImage);
      console.log(`[MapView READ-ONLY] backgroundImage value:`, domain?.backgroundImage ? `${domain.backgroundImage.substring(0, 50)}...` : 'null/undefined');
      console.log(`[MapView READ-ONLY] mapImageUrl:`, mapImageUrl ? `${mapImageUrl.substring(0, 50)}...` : 'EMPTY');
      console.log(`[MapView READ-ONLY] mapImageUrl length:`, mapImageUrl?.length || 0);
      console.log(`[MapView READ-ONLY] mapImageUrl.trim():`, mapImageUrl?.trim() || 'EMPTY');
      
      if (!mapImageUrl || !mapImageUrl.trim()) {
        console.error(`[MapView READ-ONLY] ❌ Domain "${domain?.name}": backgroundImage est ${mapImageUrl ? 'VIDE' : 'ABSENTE'}`);
        if (domain) {
          console.error(`[MapView READ-ONLY] Domain object (preview):`, JSON.stringify(domain, null, 2).substring(0, 1000));
        }
      } else {
        console.log(`[MapView READ-ONLY] ✅ Domain "${domain?.name}": backgroundImage présente (${mapImageUrl.length} caractères)`);
        console.log(`[MapView READ-ONLY] backgroundImage starts with:`, mapImageUrl.substring(0, 30));
        console.log(`[MapView READ-ONLY] Starts with 'data:':`, mapImageUrl.startsWith('data:'));
      }
      console.log(`[MapView READ-ONLY] ====================`);
    }
  }, [domain, mapImageUrl, _readOnly]);
  const hasMapBounds = domain.mapBounds?.topLeft && domain.mapBounds?.bottomRight;
  
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
  
  // Calculer les clusters de points en fonction du niveau de zoom
  const calculateClusters = (): { clusters: PointCluster[]; singlePoints: MapElement[] } => {
    const points = domain.mapElements || [];
    if (points.length === 0) return { clusters: [], singlePoints: [] };
    
    // Vérifier si le clustering est activé
    const clusteringEnabled = localClustering;
    
    // Si le clustering est désactivé, retourner tous les points individuellement
    if (!clusteringEnabled) {
      return { clusters: [], singlePoints: points };
    }
    
    // Distance de clustering en % (augmente quand on dézoome)
    const clusterDistance = 15 / scale; // Plus on dézoome, plus la distance est grande
    
    // Si zoom > 1.5, pas de clustering
    if (scale > 1.5) {
      return { clusters: [], singlePoints: points };
    }
    
    const usedPoints = new Set<string>();
    const clusters: PointCluster[] = [];
    const singlePoints: MapElement[] = [];
    
    points.forEach(point => {
      if (usedPoints.has(point.id)) return;
      
      const pos = gpsToPosition(point.gps);
      if (!pos) return;
      
      // Trouver les points proches
      const nearbyPoints = points.filter(p => {
        if (p.id === point.id || usedPoints.has(p.id)) return false;
        const pPos = gpsToPosition(p.gps);
        if (!pPos) return false;
        
        const distance = Math.sqrt(Math.pow(pos.x - pPos.x, 2) + Math.pow(pos.y - pPos.y, 2));
        return distance < clusterDistance;
      });
      
      if (nearbyPoints.length > 0) {
        // Créer un cluster
        const clusterPoints = [point, ...nearbyPoints];
        clusterPoints.forEach(p => usedPoints.add(p.id));
        
        // Calculer le centre du cluster
        let sumX = 0, sumY = 0;
        clusterPoints.forEach(p => {
          const pPos = gpsToPosition(p.gps);
          if (pPos) {
            sumX += pPos.x;
            sumY += pPos.y;
          }
        });
        
        // Trouver le statut le plus critique
        let worstStatus: TileStatus = 'ok';
        clusterPoints.forEach(p => {
          if (STATUS_PRIORITY[p.status] > STATUS_PRIORITY[worstStatus]) {
            worstStatus = p.status;
          }
        });
        
        clusters.push({
          id: `cluster-${point.id}`,
          points: clusterPoints,
          center: { x: sumX / clusterPoints.length, y: sumY / clusterPoints.length },
          worstStatus,
          count: clusterPoints.length,
        });
      } else {
        usedPoints.add(point.id);
        singlePoints.push(point);
      }
    });
    
    return { clusters, singlePoints };
  };
  
  const { clusters, singlePoints } = calculateClusters();
  
  return (
    <div className="relative h-full bg-[#F5F7FA] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="absolute top-4 left-4 z-20 bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-md">
        <h2 className="text-xl font-bold text-[#1E3A5F] flex items-center gap-2">
          <MuiIcon name="MapPinIcon" size={20} className="text-[#1E3A5F]" />
          {domain.name}
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          {(domain.mapElements?.length || 0)} point(s) sur la carte
        </p>
        {!_readOnly && !hasMapBounds && mapImageUrl && (
          <p className="text-xs text-[#FFB74D] mt-1 flex items-center gap-1">
            <MuiIcon name="AlertTriangleIcon" size={12} />
            Configurez les coordonnées GPS
          </p>
        )}
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
      <div className="absolute top-20 right-4 z-30 bg-white rounded-lg px-2 py-1.5 border border-[#E2E8F0] shadow-md">
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
      
      {/* Conteneur de la carte */}
      <div
        ref={containerRef}
        className={`w-full flex-1 overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          ref={imageContainerRef}
          className="w-full h-full relative"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging || draggingPointId ? 'none' : 'transform 0.1s ease-out',
            minWidth: '100%',
            minHeight: '100%',
          }}
        >
          {/* Image de fond */}
          {mapImageUrl && mapImageUrl.trim() ? (
            <img 
              key={`map-image-${domain.id}-${mapImageUrl.substring(0, 20)}-${_readOnly ? 'readonly' : 'edit'}`}
              src={mapImageUrl}
              alt="Carte"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ 
                minWidth: '1px', 
                minHeight: '1px',
                width: '100%',
                height: '100%',
                zIndex: 0,
                opacity: 1,
                display: 'block',
                visibility: 'visible',
                pointerEvents: 'none' // Permettre les clics à travers l'image
              }}
              crossOrigin="anonymous"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                const container = imageContainerRef.current;
                console.log(`[MapView] ✅ Image chargée avec succès pour "${domain.name}" - dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
                console.log(`[MapView] Image src length: ${mapImageUrl?.length || 0}`);
                console.log(`[MapView] Image src preview: ${mapImageUrl?.substring(0, 50) || 'EMPTY'}`);
                console.log(`[MapView] Domain backgroundImage type:`, typeof domain?.backgroundImage);
                console.log(`[MapView] Domain backgroundImage length:`, domain?.backgroundImage ? domain.backgroundImage.length : 'N/A');
                console.log(`[MapView] Image element computed style:`, {
                  display: window.getComputedStyle(img).display,
                  width: window.getComputedStyle(img).width,
                  height: window.getComputedStyle(img).height,
                  visibility: window.getComputedStyle(img).visibility,
                  opacity: window.getComputedStyle(img).opacity,
                });
                if (container) {
                  console.log(`[MapView] Container dimensions:`, {
                    width: container.offsetWidth,
                    height: container.offsetHeight,
                  });
                }
                if (_readOnly) {
                  console.log(`[MapView READ-ONLY] ✅ Image de carte chargée avec succès pour le domaine "${domain.name}"`);
                  console.log(`[MapView READ-ONLY] Container rect:`, container?.getBoundingClientRect());
                }
              }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                console.error(`[MapView] ❌ ERREUR chargement image carte pour le domaine "${domain.name}"`);
                console.error(`[MapView] URL preview:`, mapImageUrl?.substring(0, 100));
                console.error(`[MapView] Longueur totale:`, mapImageUrl?.length || 0);
                console.error(`[MapView] Type:`, typeof mapImageUrl);
                console.error(`[MapView] Starts with data:`, mapImageUrl?.startsWith('data:'));
                console.error(`[MapView] Image element:`, img);
                console.error(`[MapView] Image element styles:`, {
                  display: window.getComputedStyle(img).display,
                  width: window.getComputedStyle(img).width,
                  height: window.getComputedStyle(img).height,
                  src: img.src?.substring(0, 100),
                });
                if (_readOnly) {
                  console.error(`[MapView READ-ONLY] ❌ Image de carte non chargée - longueur: ${mapImageUrl?.length || 0} caractères`);
                }
                // Ne pas cacher l'image en cas d'erreur - laisser visible pour debug
                // img.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#EEF2F7]">
              <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-[#E2E8F0]">
                <MuiIcon name="MapPinIcon" size={48} className="text-[#94A3B8] mx-auto mb-4" />
                <p className="text-[#64748B] font-medium mb-2">Aucune carte configurée</p>
                <p className="text-sm text-[#94A3B8] mb-4">Configurez l'image et les coordonnées GPS</p>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E]"
                >
                  Configurer la carte
                </button>
              </div>
            </div>
          )}
          
          {/* Clusters de points (quand on dézoome) - cliquables pour zoomer */}
          {clusters.map((cluster) => {
            const colors = STATUS_COLORS[cluster.worstStatus];
            
            // Taille dynamique basée sur le nombre d'éléments ET inversement proportionnelle au zoom
            const baseSize = Math.min(80, Math.max(40, cluster.count * 8));
            const clusterSize = baseSize / scale;
            const fontSize = Math.max(10, Math.round(16 / scale));
            
            // Handler pour zoomer sur le cluster
            const handleClusterClick = () => {
              // Zoom +100% (ajouter 1 à l'échelle actuelle)
              const newScale = Math.min(MAX_ZOOM, scale + 1);
              
              // Centrer la vue sur le cluster
              const container = containerRef.current;
              if (container) {
                const containerRect = container.getBoundingClientRect();
                
                // Calculer la position pour centrer le cluster
                // Le cluster est à (center.x%, center.y%) - on calcule le décalage depuis le centre (50%)
                const offsetX = (0.5 - cluster.center.x / 100) * containerRect.width * newScale;
                const offsetY = (0.5 - cluster.center.y / 100) * containerRect.height * newScale;
                
                setPosition({ x: offsetX, y: offsetY });
              }
              
              setScale(newScale);
            };
            
            return (
              <div
                key={cluster.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group cursor-pointer"
                style={{ left: `${cluster.center.x}%`, top: `${cluster.center.y}%` }}
                onMouseEnter={() => setHoveredPoint(cluster.id)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={handleClusterClick}
              >
                {/* Cercle cluster */}
                <div 
                  className="rounded-full shadow-lg flex items-center justify-center font-bold text-white hover:scale-110 hover:brightness-110 transition-all"
                  style={{ 
                    width: `${clusterSize}px`,
                    height: `${clusterSize}px`,
                    fontSize: `${fontSize}px`,
                    backgroundColor: colors.hex,
                    boxShadow: `0 4px 12px ${colors.hex}50`
                  }}
                >
                  {cluster.count}
                </div>
                
                {/* Tooltip au survol - taille dynamique */}
                {hoveredPoint === cluster.id && (
                  <div 
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 z-50"
                    style={{ marginBottom: `${8 / scale}px` }}
                  >
                    <div 
                      className="bg-[#1E3A5F] text-white rounded-lg shadow-lg whitespace-nowrap"
                      style={{ 
                        padding: `${6 / scale}px ${10 / scale}px`,
                        fontSize: `${Math.max(10, 14 / scale)}px`
                      }}
                    >
                      {cluster.count} éléments groupés
                      <div 
                        className="text-[#94A3B8]"
                        style={{ 
                          fontSize: `${Math.max(8, 11 / scale)}px`,
                          marginTop: `${3 / scale}px`
                        }}
                      >
                        Cliquez pour zoomer (+100%)
                      </div>
                    </div>
                    <div 
                      className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-transparent border-r-transparent border-t-[#1E3A5F]"
                      style={{
                        borderLeftWidth: `${6 / scale}px`,
                        borderRightWidth: `${6 / scale}px`,
                        borderTopWidth: `${8 / scale}px`
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Indicateurs des coins GPS (debug) - visible au hover de la carte */}
          {hasMapBounds && (
            <>
              {/* Coin haut-gauche (NW) */}
              <div 
                className="absolute z-5 opacity-30 hover:opacity-100 transition-opacity"
                style={{ left: '0%', top: '0%' }}
                title={`NW: ${domain.mapBounds?.topLeft.lat.toFixed(3)}, ${domain.mapBounds?.topLeft.lng.toFixed(3)}`}
              >
                <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow" />
              </div>
              {/* Coin bas-droite (SE) */}
              <div 
                className="absolute z-5 opacity-30 hover:opacity-100 transition-opacity"
                style={{ left: '100%', top: '100%', transform: 'translate(-100%, -100%)' }}
                title={`SE: ${domain.mapBounds?.bottomRight.lat.toFixed(3)}, ${domain.mapBounds?.bottomRight.lng.toFixed(3)}`}
              >
                <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow" />
              </div>
            </>
          )}
          
          {/* Points individuels sur la carte */}
          {singlePoints.map((point) => {
            const pos = gpsToPosition(point.gps);
            if (!pos) return null;
            
            const colors = STATUS_COLORS[point.status];
            const iconName = point.icon || 'MapPin';
            const hasLinkedElement = !!point.elementId;
            
            // Taille dynamique inversement proportionnelle au zoom pour rester constante visuellement
            const baseSize = 40; // Taille de base en pixels
            const dynamicSize = baseSize / scale;
            const iconSize = Math.max(12, Math.round(20 / scale));
            
            return (
              <div
                key={point.id}
                data-point-element="true"
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group ${
                  !_readOnly ? 'cursor-move' : 'cursor-pointer'
                }`}
                style={{ 
                  left: `${pos.x}%`, 
                  top: `${pos.y}%`,
                  // Zone de drag plus large que l'icône pour faciliter la saisie
                  padding: `${Math.max(8, dynamicSize * 0.3)}px`,
                  minWidth: `${dynamicSize * 1.6}px`,
                  minHeight: `${dynamicSize * 1.6}px`,
                }}
                onMouseEnter={() => setHoveredPoint(point.id)}
                onMouseLeave={() => setHoveredPoint(null)}
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
                    setDraggingPointId(point.id);
                    pointDragStartPosRef.current = { pointId: point.id, x: e.clientX, y: e.clientY };
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
                  handlePointClick(point);
                }}
              >
                {/* Icône colorée - draggable en mode studio */}
                <div 
                  className="rounded-full shadow-lg flex items-center justify-center transition-all hover:brightness-110 pointer-events-none"
                  style={{ 
                    width: `${dynamicSize}px`,
                    height: `${dynamicSize}px`,
                    backgroundColor: colors.hex,
                    boxShadow: `0 4px 12px ${colors.hex}50`
                  }}
                >
                  <MuiIcon name={iconName} size={iconSize} className="text-white" />
                </div>
                
                {/* Tooltip avec le nom au survol - taille dynamique */}
                {hoveredPoint === point.id && (
                  <div 
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 z-50"
                    style={{ marginBottom: `${8 / scale}px` }}
                  >
                    <div 
                      className="bg-[#1E3A5F] text-white rounded-lg shadow-lg whitespace-nowrap font-medium"
                      style={{ 
                        padding: `${6 / scale}px ${10 / scale}px`,
                        fontSize: `${Math.max(10, 14 / scale)}px`
                      }}
                    >
                      {point.name}
                      <div 
                        className="text-[#94A3B8] font-normal"
                        style={{ 
                          fontSize: `${Math.max(8, 10 / scale)}px`,
                          marginTop: `${2 / scale}px`
                        }}
                      >
                        📍 {point.gps.lat.toFixed(4)}, {point.gps.lng.toFixed(4)}
                      </div>
                      <div 
                        className="text-[#94A3B8]"
                        style={{ 
                          fontSize: `${Math.max(8, 11 / scale)}px`,
                          marginTop: `${2 / scale}px`
                        }}
                      >
                        {hasLinkedElement ? 'Cliquez pour voir l\'élément' : 'Cliquez pour créer l\'élément'}
                      </div>
                    </div>
                    <div 
                      className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-transparent border-r-transparent border-t-[#1E3A5F]"
                      style={{
                        borderLeftWidth: `${6 / scale}px`,
                        borderRightWidth: `${6 / scale}px`,
                        borderTopWidth: `${8 / scale}px`
                      }}
                    />
                  </div>
                )}
                
                {/* Boutons d'action au survol - collés au coin supérieur droit du point */}
                {hoveredPoint === point.id && !_readOnly && (
                  <div className="absolute top-0 right-0 flex items-center gap-0.5 z-30 transform translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                    {/* Bouton crayon supprimé - l'édition se fait maintenant via le menu de droite */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        cloneMapElement(point.id);
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
      
      {/* Boutons d'action (masqués en mode lecture seule) */}
      {!_readOnly && (
        <div className="absolute bottom-4 right-4 z-20 flex gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-[#E2E8F0] text-[#1E3A5F] rounded-xl hover:bg-[#F5F7FA] shadow-md"
          >
            <MuiIcon name="SettingsIcon" size={20} />
            Configurer
          </button>
          <button
            onClick={() => setShowAddPointModal(true)}
            disabled={!hasMapBounds}
            className="flex items-center gap-2 px-4 py-3 bg-[#1E3A5F] text-white rounded-xl hover:bg-[#2C4A6E] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={!hasMapBounds ? 'Configurez d\'abord les coordonnées GPS de la carte' : 'Ajouter un point'}
          >
            <MuiIcon name="Plus" size={20} />
            Ajouter un point
          </button>
        </div>
      )}
      
      {/* Modal Configuration */}
      {showConfigModal && (
        <Modal title="Configuration de la carte" onClose={() => setShowConfigModal(false)}>
          <div className="space-y-6">
            {/* Image de la carte */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Image de la carte</label>
              
              {/* Upload ou URL */}
              <div className="mb-3 p-4 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setConfigForm({ ...configForm, imageUrl: base64 });
                        setAnalysisResult(null);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                  id="map-image-upload"
                />
                <label 
                  htmlFor="map-image-upload"
                  className="flex flex-col items-center justify-center cursor-pointer text-[#64748B] hover:text-[#1E3A5F]"
                >
                  <MuiIcon name="Upload" size={24} className="mb-2" />
                  <span className="text-sm font-medium">Cliquez pour uploader une image</span>
                  <span className="text-xs mt-1">ou glissez-déposez ici</span>
                </label>
              </div>
              
              {/* URL alternative */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={configForm.imageUrl.startsWith('data:') ? '' : configForm.imageUrl}
                  onChange={(e) => {
                    setConfigForm({ ...configForm, imageUrl: e.target.value });
                    setAnalysisResult(null);
                  }}
                  placeholder="Ou collez une URL : https://exemple.com/carte.png"
                  className="flex-1 px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] text-sm"
                />
                <button
                  onClick={analyzeMapImage}
                  disabled={!configForm.imageUrl || isAnalyzing}
                  className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  title="Analyser l'image avec l'IA pour détecter les coordonnées GPS"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>
                      <span>Analyse...</span>
                    </>
                  ) : (
                    <>
                      <MuiIcon name="Sparkles" size={16} />
                      <span>Détecter GPS</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Aperçu de l'image */}
              {configForm.imageUrl && (
                <div className="mt-3 p-2 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                  <img 
                    src={configForm.imageUrl} 
                    alt="Aperçu de la carte" 
                    className="max-h-32 rounded border border-[#E2E8F0] mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Résultat de l'analyse */}
              {analysisResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  analysisResult.detected 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  {analysisResult.detected ? (
                    <div className="flex items-start gap-2">
                      <MuiIcon name="CheckCircle" size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Zone détectée : {analysisResult.region}</p>
                        <p className="text-xs mt-1 opacity-80">{analysisResult.description}</p>
                        <p className="text-xs mt-1 opacity-60">Confiance : {analysisResult.confidence}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MuiIcon name="AlertTriangleIcon" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Détection impossible</p>
                        <p className="text-xs mt-1 opacity-80">{analysisResult.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Coordonnées GPS */}
            <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
              <h4 className="font-medium text-[#1E3A5F] mb-3 flex items-center gap-2">
                <MuiIcon name="MapPinIcon" size={16} />
                Coordonnées GPS des coins de l'image
              </h4>
              <p className="text-xs text-[#64748B] mb-4">
                Ces coordonnées correspondent aux pixels des coins de l'image (pas à la zone géographique).
              </p>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <p className="font-medium mb-1">💡 Astuce pour ajuster :</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Point trop haut</strong> → Augmentez la latitude du coin Nord-Ouest</li>
                  <li><strong>Point trop bas</strong> → Diminuez la latitude du coin Sud-Est</li>
                  <li><strong>Point trop à gauche</strong> → Diminuez la longitude du coin Nord-Ouest</li>
                  <li><strong>Point trop à droite</strong> → Augmentez la longitude du coin Sud-Est</li>
                </ul>
              </div>
              
              {/* Coin haut-gauche */}
              <div className="mb-4">
                <label className="block text-sm text-[#64748B] mb-2">📍 Coin haut-gauche (Nord-Ouest)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={configForm.topLeftLat}
                      onChange={(e) => setConfigForm({ ...configForm, topLeftLat: e.target.value })}
                      placeholder="ex: 51.089"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={configForm.topLeftLng}
                      onChange={(e) => setConfigForm({ ...configForm, topLeftLng: e.target.value })}
                      placeholder="ex: -5.142"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                </div>
              </div>
              
              {/* Coin bas-droite */}
              <div>
                <label className="block text-sm text-[#64748B] mb-2">📍 Coin bas-droite (Sud-Est)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={configForm.bottomRightLat}
                      onChange={(e) => setConfigForm({ ...configForm, bottomRightLat: e.target.value })}
                      placeholder="ex: 41.303"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={configForm.bottomRightLng}
                      onChange={(e) => setConfigForm({ ...configForm, bottomRightLng: e.target.value })}
                      placeholder="ex: 9.561"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Options d'affichage */}
            <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
              <h4 className="font-medium text-[#1E3A5F] mb-3 flex items-center gap-2">
                <MuiIcon name="SettingsIcon" size={16} />
                Options d'affichage
              </h4>
              
              {/* Toggle regroupement */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-[#1E3A5F]">Regroupement des points</label>
                  <p className="text-xs text-[#64748B] mt-1">
                    Regrouper les points proches en clusters pour améliorer la lisibilité
                  </p>
                </div>
                <button
                  onClick={() => setConfigForm({ ...configForm, enableClustering: !configForm.enableClustering })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    configForm.enableClustering ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                  }`}
                  role="switch"
                  aria-checked={configForm.enableClustering}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      configForm.enableClustering ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            {/* Boutons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E]"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Modal Ajouter un élément/point */}
      {showAddPointModal && (
        <Modal title="Ajouter un élément sur la carte" onClose={() => setShowAddPointModal(false)}>
          <div className="space-y-4">
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Nom de l'élément *</label>
              <input
                type="text"
                value={pointForm.name}
                onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
                placeholder="ex: Magasin Paris Centre"
                className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                autoFocus
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Description (optionnel)</label>
              <textarea
                value={pointForm.description}
                onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })}
                placeholder="Description de l'élément..."
                rows={2}
                className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] resize-none"
              />
            </div>
            
            {/* Type de localisation */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Localisation</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setPointForm({ ...pointForm, locationType: 'address' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    pointForm.locationType === 'address'
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <MuiIcon name="MapPinIcon" size={16} />
                  Adresse
                </button>
                <button
                  onClick={() => setPointForm({ ...pointForm, locationType: 'gps' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    pointForm.locationType === 'gps'
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <MuiIcon name="Navigation" size={16} />
                  Coordonnées GPS
                </button>
              </div>
              
              {/* Saisie par adresse */}
              {pointForm.locationType === 'address' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pointForm.address}
                      onChange={(e) => setPointForm({ ...pointForm, address: e.target.value })}
                      placeholder="ex: 10 rue de la Paix, 75002 Paris"
                      className="flex-1 px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                    />
                    <button
                      onClick={geocodeAddress}
                      disabled={!pointForm.address.trim() || isGeocodingAddress}
                      className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title="Convertir l'adresse en coordonnées GPS"
                    >
                      {isGeocodingAddress ? (
                        <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>
                      ) : (
                        <MuiIcon name="Sparkles" size={16} />
                      )}
                    </button>
                  </div>
                  
                  {/* Coordonnées détectées */}
                  {(pointForm.lat || pointForm.lng) && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                      <div className="flex items-center gap-2 text-green-800">
                        <MuiIcon name="CheckCircle" size={16} className="text-green-600" />
                        <span>Coordonnées détectées : {pointForm.lat}, {pointForm.lng}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Saisie par coordonnées GPS */}
              {pointForm.locationType === 'gps' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={pointForm.lat}
                      onChange={(e) => setPointForm({ ...pointForm, lat: e.target.value })}
                      placeholder="ex: 48.8566"
                      className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={pointForm.lng}
                      onChange={(e) => setPointForm({ ...pointForm, lng: e.target.value })}
                      placeholder="ex: 2.3522"
                      className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Statut</label>
              <div className="grid grid-cols-4 gap-2">
                {(['ok', 'mineur', 'critique', 'deconnecte'] as TileStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setPointForm({ ...pointForm, status })}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      pointForm.status === status
                        ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status].hex }} />
                    <span className="text-xs text-[#1E3A5F]">{STATUS_LABELS[status]}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Icône */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Icône</label>
              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#CBD5E1] transition-all"
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: STATUS_COLORS[pointForm.status].hex }}
                  >
                    <MuiIcon name={pointForm.icon} size={18} className="text-white" />
                  </div>
                  <span className="flex-1 text-left">{pointForm.icon}</span>
                  <MuiIcon name="ChevronDown" size={16} className="text-[#94A3B8]" />
                </button>
                
                {showIconPicker && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 p-3 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-6 gap-2">
                      {POPULAR_MAP_ICONS.map((iconName) => (
                        <button
                          key={iconName}
                          onClick={() => {
                            setPointForm({ ...pointForm, icon: iconName });
                            setShowIconPicker(false);
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            pointForm.icon === iconName
                              ? 'bg-[#1E3A5F] text-white'
                              : 'hover:bg-[#F5F7FA] text-[#1E3A5F]'
                          }`}
                          title={iconName}
                        >
                          <MuiIcon name={iconName} size={20} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  setShowAddPointModal(false);
                  setShowIconPicker(false);
                  setPointForm({ name: '', description: '', address: '', lat: '', lng: '', status: 'ok', locationType: 'gps', icon: 'Store' });
                }}
                className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
              >
                Annuler
              </button>
              <button
                onClick={handleAddPoint}
                disabled={!pointForm.name.trim() || !pointForm.lat || !pointForm.lng}
                className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <MuiIcon name="Plus" size={16} />
                Ajouter l'élément
              </button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Modal d'édition supprimé - l'édition se fait maintenant via EditorPanel */}
    </div>
  );
}

// Composant Modal
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
      <span className="text-sm text-[#64748B]">{label}</span>
    </div>
  );
}
