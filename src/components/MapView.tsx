import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Domain, TileStatus, MapBounds, GpsCoords, MapElement, Element } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';
import LinkElementModal from './LinkElementModal';
import BulkEditMapModal from './BulkEditMapModal';
import MapCategoryElementsView from './MapCategoryElementsView';
import StatusSummary, { formatLastUpdate } from './StatusSummary';
import { useLanguage } from '../contexts/LanguageContext';
import DateTimeline from './DateTimeline';

// Liste des icônes populaires pour les points de carte
const POPULAR_MAP_ICONS = [
  'Store', 'Business', 'Factory', 'Warehouse', 'Home', 'Domain',
  'Place', 'NearMe', 'LocalShipping', 'Inventory', 'ShoppingCart', 'People',
  'Dns', 'Storage', 'Wifi', 'Radio', 'Memory', 'SdStorage',
  'Warning', 'Shield', 'Lock', 'Key', 'Visibility', 'PhotoCamera',
];

// Formes simples (sans icône, juste des formes géométriques colorées)
const SIMPLE_SHAPES = [
  { id: 'shape:square', name: 'Carré', label: 'Carré' },
  { id: 'shape:circle', name: 'Cercle', label: 'Cercle' },
  { id: 'shape:circle-outline', name: 'Rond creux', label: 'Rond creux' },
  { id: 'shape:triangle', name: 'Triangle', label: 'Triangle' },
  { id: 'shape:diamond', name: 'Losange', label: 'Losange' },
  { id: 'shape:hexagon', name: 'Hexagone', label: 'Hexagone' },
  { id: 'shape:star', name: 'Étoile', label: 'Étoile' },
  { id: 'shape:plus', name: 'Plus', label: 'Plus (+)' },
  { id: 'shape:minus', name: 'Moins', label: 'Moins (-)' },
  { id: 'shape:check', name: 'Check', label: 'Check (✓)' },
  { id: 'shape:cross', name: 'Croix', label: 'Croix (✗)' },
  // Animaux
  { id: 'shape:rabbit', name: 'Lapin', label: 'Lapin' },
  { id: 'shape:cow', name: 'Vache', label: 'Vache' },
  { id: 'shape:bird', name: 'Oiseau', label: 'Oiseau' },
  { id: 'shape:cat', name: 'Chat', label: 'Chat' },
  { id: 'shape:dog', name: 'Chien', label: 'Chien' },
  { id: 'shape:horse', name: 'Cheval', label: 'Cheval' },
  { id: 'shape:sheep', name: 'Mouton', label: 'Mouton' },
  { id: 'shape:chicken', name: 'Poule', label: 'Poule' },
  // Symboles spéciaux
  { id: 'shape:lightning', name: 'Éclair', label: 'Éclair (Zeus)' },
  { id: 'shape:faucet', name: 'Robinet', label: 'Robinet (eau)' },
  { id: 'shape:stadium', name: 'Stade', label: 'Stade (pilule)' },
];

// Helper pour détecter si une icône est une forme simple
const isShape = (icon: string | undefined): boolean => {
  return !!icon && icon.startsWith('shape:');
};

// Helper pour obtenir le type de forme
const getShapeType = (icon: string | undefined): string | null => {
  if (!icon || !icon.startsWith('shape:')) return null;
  return icon.replace('shape:', '');
};

// Composant pour rendre une forme SVG
const ShapeSVG = ({ shape, color, size }: { shape: string; color: string; size: number }) => {
  const viewBox = "0 0 100 100";
  
  switch (shape) {
    case 'square':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <rect x="10" y="10" width="80" height="80" fill={color} rx="4" />
        </svg>
      );
    case 'circle':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <circle cx="50" cy="50" r="40" fill={color} />
        </svg>
      );
    case 'circle-outline':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeWidth="8" />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <polygon points="50,10 90,90 10,90" fill={color} />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <polygon points="50,5 95,50 50,95 5,50" fill={color} />
        </svg>
      );
    case 'hexagon':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <polygon points="50,5 93,27 93,73 50,95 7,73 7,27" fill={color} />
        </svg>
      );
    case 'star':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={color} />
        </svg>
      );
    case 'plus':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <rect x="40" y="10" width="20" height="80" fill={color} rx="4" />
          <rect x="10" y="40" width="80" height="20" fill={color} rx="4" />
        </svg>
      );
    case 'minus':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <rect x="10" y="40" width="80" height="20" fill={color} rx="4" />
        </svg>
      );
    case 'check':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <path d="M20,55 L40,75 L80,25" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'cross':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <path d="M20,20 L80,80 M80,20 L20,80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        </svg>
      );
    // Animaux - de profil, debout
    case 'rabbit':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Oreilles */}
          <ellipse cx="70" cy="12" rx="5" ry="14" fill={color} />
          <ellipse cx="80" cy="15" rx="4" ry="12" fill={color} />
          {/* Tête */}
          <circle cx="75" cy="32" r="15" fill={color} />
          {/* Corps */}
          <ellipse cx="45" cy="55" rx="30" ry="22" fill={color} />
          {/* Queue */}
          <circle cx="12" cy="50" r="8" fill={color} />
          {/* Pattes arrière */}
          <ellipse cx="25" cy="80" rx="10" ry="15" fill={color} />
          {/* Pattes avant */}
          <rect x="60" y="70" width="6" height="20" rx="3" fill={color} />
          <rect x="70" y="70" width="6" height="20" rx="3" fill={color} />
          {/* Oeil */}
          <circle cx="80" cy="30" r="3" fill="white" />
        </svg>
      );
    case 'cow':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Cornes */}
          <ellipse cx="78" cy="12" rx="4" ry="10" fill="white" />
          {/* Tête */}
          <ellipse cx="80" cy="32" rx="12" ry="15" fill={color} />
          {/* Corps */}
          <ellipse cx="45" cy="45" rx="35" ry="25" fill={color} />
          {/* Pis */}
          <ellipse cx="35" cy="68" rx="8" ry="6" fill="white" />
          {/* Pattes */}
          <rect x="15" y="65" width="7" height="25" rx="3" fill={color} />
          <rect x="28" y="65" width="7" height="25" rx="3" fill={color} />
          <rect x="55" y="65" width="7" height="25" rx="3" fill={color} />
          <rect x="68" y="65" width="7" height="25" rx="3" fill={color} />
          {/* Queue */}
          <path d="M8,40 Q2,55 8,70" stroke={color} strokeWidth="3" fill="none" />
          {/* Oeil */}
          <circle cx="85" cy="28" r="3" fill="white" />
          {/* Museau */}
          <ellipse cx="90" cy="38" rx="6" ry="5" fill="white" />
        </svg>
      );
    case 'bird':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Queue */}
          <polygon points="5,45 15,35 15,55" fill={color} />
          {/* Corps */}
          <ellipse cx="40" cy="45" rx="28" ry="18" fill={color} />
          {/* Aile */}
          <ellipse cx="35" cy="42" rx="15" ry="10" fill="white" fillOpacity="0.3" />
          {/* Tête */}
          <circle cx="72" cy="40" r="14" fill={color} />
          {/* Bec */}
          <polygon points="86,40 98,44 86,48" fill="white" />
          {/* Oeil */}
          <circle cx="78" cy="38" r="3" fill="white" />
          {/* Pattes */}
          <line x1="35" y1="62" x2="35" y2="85" stroke={color} strokeWidth="3" />
          <line x1="45" y1="62" x2="45" y2="85" stroke={color} strokeWidth="3" />
          <line x1="30" y1="85" x2="40" y2="85" stroke={color} strokeWidth="3" />
          <line x1="40" y1="85" x2="50" y2="85" stroke={color} strokeWidth="3" />
        </svg>
      );
    case 'cat':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Queue relevée */}
          <path d="M8,30 Q2,50 12,65" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* Corps */}
          <ellipse cx="45" cy="55" rx="28" ry="18" fill={color} />
          {/* Tête */}
          <circle cx="78" cy="45" r="16" fill={color} />
          {/* Oreilles */}
          <polygon points="68,30 72,18 78,28" fill={color} />
          <polygon points="82,28 88,18 92,30" fill={color} />
          {/* Pattes */}
          <rect x="25" y="68" width="6" height="22" rx="3" fill={color} />
          <rect x="38" y="68" width="6" height="22" rx="3" fill={color} />
          <rect x="58" y="68" width="6" height="22" rx="3" fill={color} />
          <rect x="68" y="68" width="6" height="22" rx="3" fill={color} />
          {/* Oeil */}
          <ellipse cx="83" cy="43" rx="3" ry="4" fill="white" />
          {/* Museau */}
          <circle cx="90" cy="48" r="4" fill="white" />
        </svg>
      );
    case 'dog':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Queue relevée */}
          <path d="M8,35 Q5,20 15,15" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* Corps */}
          <ellipse cx="42" cy="50" rx="30" ry="20" fill={color} />
          {/* Tête */}
          <ellipse cx="78" cy="40" rx="14" ry="16" fill={color} />
          {/* Oreille tombante */}
          <ellipse cx="72" cy="30" rx="6" ry="12" fill={color} />
          {/* Museau */}
          <ellipse cx="92" cy="45" rx="8" ry="6" fill="white" />
          {/* Pattes */}
          <rect x="20" y="65" width="7" height="25" rx="3" fill={color} />
          <rect x="32" y="65" width="7" height="25" rx="3" fill={color} />
          <rect x="55" y="65" width="7" height="25" rx="3" fill={color} />
          <rect x="67" y="65" width="7" height="25" rx="3" fill={color} />
          {/* Oeil */}
          <circle cx="82" cy="38" r="3" fill="white" />
          {/* Nez */}
          <circle cx="96" cy="43" r="3" fill="black" />
        </svg>
      );
    case 'horse':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Queue */}
          <path d="M5,45 Q2,60 8,75" stroke={color} strokeWidth="4" fill="none" />
          {/* Corps */}
          <ellipse cx="40" cy="45" rx="32" ry="22" fill={color} />
          {/* Cou */}
          <polygon points="65,30 75,15 85,25 75,45" fill={color} />
          {/* Tête */}
          <ellipse cx="88" cy="28" rx="10" ry="14" fill={color} />
          {/* Oreille */}
          <polygon points="85,12 88,5 93,14" fill={color} />
          {/* Crinière */}
          <path d="M70,18 Q75,25 70,35" stroke="white" strokeWidth="3" fill="none" opacity="0.5" />
          {/* Pattes */}
          <rect x="18" y="62" width="6" height="28" rx="2" fill={color} />
          <rect x="30" y="62" width="6" height="28" rx="2" fill={color} />
          <rect x="52" y="62" width="6" height="28" rx="2" fill={color} />
          <rect x="64" y="62" width="6" height="28" rx="2" fill={color} />
          {/* Oeil */}
          <circle cx="92" cy="25" r="2" fill="white" />
        </svg>
      );
    case 'sheep':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Laine corps */}
          <circle cx="30" cy="45" r="15" fill={color} />
          <circle cx="45" cy="40" r="16" fill={color} />
          <circle cx="55" cy="45" r="15" fill={color} />
          <circle cx="40" cy="55" r="14" fill={color} />
          <circle cx="50" cy="52" r="13" fill={color} />
          {/* Tête */}
          <ellipse cx="75" cy="50" rx="12" ry="14" fill="white" />
          {/* Oreilles */}
          <ellipse cx="68" cy="42" rx="6" ry="4" fill="white" />
          {/* Pattes */}
          <rect x="25" y="65" width="5" height="25" rx="2" fill="black" />
          <rect x="35" y="65" width="5" height="25" rx="2" fill="black" />
          <rect x="50" y="65" width="5" height="25" rx="2" fill="black" />
          <rect x="60" y="65" width="5" height="25" rx="2" fill="black" />
          {/* Oeil */}
          <circle cx="80" cy="48" r="2" fill="black" />
        </svg>
      );
    case 'chicken':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Queue */}
          <polygon points="5,35 15,25 18,40 15,50 5,45" fill={color} />
          {/* Corps */}
          <ellipse cx="40" cy="50" rx="28" ry="22" fill={color} />
          {/* Aile */}
          <ellipse cx="35" cy="48" rx="12" ry="10" fill="white" fillOpacity="0.3" />
          {/* Cou */}
          <ellipse cx="68" cy="40" rx="8" ry="15" fill={color} />
          {/* Tête */}
          <circle cx="75" cy="28" r="12" fill={color} />
          {/* Crête */}
          <ellipse cx="75" cy="15" rx="4" ry="6" fill="white" />
          <ellipse cx="70" cy="18" rx="3" ry="5" fill="white" />
          {/* Bec */}
          <polygon points="87,28 95,32 87,35" fill="white" />
          {/* Barbillon */}
          <ellipse cx="82" cy="38" rx="3" ry="5" fill="white" />
          {/* Oeil */}
          <circle cx="80" cy="26" r="2" fill="white" />
          {/* Pattes */}
          <line x1="35" y1="70" x2="35" y2="88" stroke="white" strokeWidth="3" />
          <line x1="48" y1="70" x2="48" y2="88" stroke="white" strokeWidth="3" />
          <line x1="30" y1="88" x2="40" y2="88" stroke="white" strokeWidth="2" />
          <line x1="43" y1="88" x2="53" y2="88" stroke="white" strokeWidth="2" />
        </svg>
      );
    // Symboles spéciaux
    case 'lightning':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Cadre / nuage d'orage en haut */}
          <ellipse cx="50" cy="12" rx="35" ry="10" fill={color} fillOpacity="0.4" />
          <ellipse cx="35" cy="15" rx="20" ry="8" fill={color} fillOpacity="0.3" />
          <ellipse cx="65" cy="15" rx="20" ry="8" fill={color} fillOpacity="0.3" />
          {/* Éclair stylisé type Zeus - forme en zigzag puissante */}
          <polygon 
            points="55,18 38,45 48,45 32,85 72,50 58,50 75,18" 
            fill={color}
          />
          {/* Reflet lumineux */}
          <polygon 
            points="58,24 48,40 52,40 42,68 62,48 55,48 65,24" 
            fill="white" 
            fillOpacity="0.3"
          />
          {/* Impact au sol */}
          <ellipse cx="52" cy="92" rx="12" ry="4" fill={color} fillOpacity="0.5" />
          <ellipse cx="52" cy="92" rx="6" ry="2" fill="white" fillOpacity="0.4" />
        </svg>
      );
    case 'faucet':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Robinet d'eau de profil - très reconnaissable */}
          {/* Corps principal du robinet (tube horizontal) */}
          <rect x="20" y="35" width="50" height="14" rx="3" fill={color} />
          {/* Bec verseur (courbé vers le bas) */}
          <path d="M70,42 Q85,42 85,55 L85,70 Q85,75 80,75 L78,75 Q73,75 73,70 L73,58 Q73,52 67,52" 
                fill={color} />
          {/* Poignée/volant (croix style classique) */}
          <rect x="30" y="20" width="8" height="20" rx="2" fill={color} />
          <rect x="24" y="26" width="20" height="8" rx="2" fill={color} />
          {/* Cercle central de la poignée */}
          <circle cx="34" cy="30" r="5" fill="white" fillOpacity="0.5" />
          {/* Fixation murale */}
          <rect x="8" y="30" width="16" height="24" rx="3" fill={color} />
          <rect x="5" y="33" width="6" height="18" rx="2" fill="white" fillOpacity="0.3" />
          {/* Gouttes d'eau */}
          <ellipse cx="79" cy="82" rx="3" ry="5" fill={color} fillOpacity="0.6" />
          <ellipse cx="79" cy="92" rx="2" ry="3" fill={color} fillOpacity="0.4" />
        </svg>
      );
    case 'stadium':
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          {/* Forme stade/pilule - rectangle avec demi-cercles aux extrémités */}
          <path 
            d="M25,30 
               L75,30 
               A20,20 0 0 1 75,70 
               L25,70 
               A20,20 0 0 1 25,30 
               Z" 
            fill={color}
          />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox={viewBox}>
          <rect x="10" y="10" width="80" height="80" fill={color} rx="4" />
        </svg>
      );
  }
};

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
  herite_domaine: 0,
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
  onDomainClick?: (domainId: string) => void; // Double-clic pour naviguer vers le domaine source
  readOnly?: boolean;
  domains?: Domain[]; // Domaines pour calculer l'héritage (mode public)
  onDateChange?: (date: string) => void; // Callback pour changer la date sélectionnée
  hideHeader?: boolean | null; // État actuel du masquage du header (null = comportement par défaut)
  onToggleHeader?: (hide: boolean) => void; // Callback pour toggle le header
}

export default function MapView({ domain, onElementClick: _onElementClick, onDomainClick, readOnly: _readOnly = false, domains: _domainsProp, onDateChange, hideHeader, onToggleHeader }: MapViewProps) {
  const fullscreenContainerRef = useRef<HTMLDivElement>(null); // Pour le mode plein écran
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { updateDomain, addMapElement, updateMapElement, cloneMapElement, updateMapBounds, setCurrentElement, addCategory, addElement, updateElement, findElementsByName, linkElement, lastClonedMapElementId, clearLastClonedMapElementId } = useCockpitStore();
  const { token } = useAuthStore();
  const { t } = useLanguage();

  // Fonction pour charger l'état sauvegardé depuis localStorage
  const loadSavedViewState = (domainId: string) => {
    const viewStateKey = `mapView-${domainId}`;
    const savedState = localStorage.getItem(viewStateKey);
    if (savedState) {
      try {
        const { scale: savedScale, position: savedPosition } = JSON.parse(savedState);
        if (typeof savedScale === 'number' && savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
          return { scale: savedScale, position: savedPosition, hasSavedState: true };
        }
      } catch (e) {
        console.warn('[MapView] Erreur lors de la restauration du zoom/position:', e);
      }
    }
    return { scale: 1, position: { x: 0, y: 0 }, hasSavedState: false };
  };

  // Ã‰tat de l'analyse IA
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    detected: boolean;
    region?: string;
    confidence?: string;
    description?: string;
  } | null>(null);

  // Ã‰tat du zoom et position - initialisé depuis localStorage
  const [scale, setScale] = useState(() => loadSavedViewState(domain.id).scale);
  const [position, setPosition] = useState(() => loadSavedViewState(domain.id).position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Ref pour suivre si on doit restaurer l'état sauvegardé quand le domaine change
  const lastDomainIdRef = useRef<string>(domain.id);
  const lastBackgroundImageRef = useRef<string | undefined>(domain.backgroundImage);
  const hasFittedToScreenRef = useRef<boolean>(loadSavedViewState(domain.id).hasSavedState);

  // Ã‰tat pour le drag d'un point
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const pointDragStartPosRef = useRef<{ pointId: string; x: number; y: number } | null>(null);
  const hasDraggedPointRef = useRef<boolean>(false);
  const preventClickRef = useRef<boolean>(false); // Pour empêcher le onClick après un drag

  // Modales
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  // Modal d'édition supprimé - l'édition se fait maintenant via EditorPanel

  // États pour le filtre de catégories - toutes les catégories sélectionnées par défaut
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => 
    domain.categories?.map(c => c.id) || []
  );
  const [showCategoryFilter, setShowCategoryFilter] = useState(true);
  // État pour la vue éléments d'une catégorie (quand on clique sur le nom de la catégorie)
  const [categoryViewId, setCategoryViewId] = useState<string | null>(null);

  // État pour le mode plein écran
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // État pour le modal de liaison d'éléments
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingElementData, setPendingElementData] = useState<{
    categoryId: string;
    point: MapElement;
  } | null>(null);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);

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
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number; pointId: string; isCluster: boolean } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipShownForRef = useRef<string | null>(null); // ID du point pour lequel le tooltip a déjà été affiché

  // Renommage rapide après clonage
  const [renamingPointId, setRenamingPointId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Modal d'édition en masse
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // Formulaire édition point supprimé - l'édition se fait maintenant via EditorPanel

  // Position du panneau de contrôle (drag and drop) - seulement en mode studio
  const loadControlPanelPosition = (domainId: string) => {
    const savedPos = localStorage.getItem(`mapControlPanel-${domainId}`);
    if (savedPos) {
      try {
        return JSON.parse(savedPos);
      } catch (e) {
        return null;
      }
    }
    return null;
  };
  
  const [controlPanelPosition, setControlPanelPosition] = useState<{ x: number; y: number } | null>(() => 
    loadControlPanelPosition(domain.id)
  );
  const [isDraggingControlPanel, setIsDraggingControlPanel] = useState(false);
  const controlPanelDragStartRef = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  // Sauvegarder la position du panneau de contrôle
  const saveControlPanelPosition = useCallback((pos: { x: number; y: number } | null) => {
    if (pos) {
      localStorage.setItem(`mapControlPanel-${domain.id}`, JSON.stringify(pos));
    } else {
      localStorage.removeItem(`mapControlPanel-${domain.id}`);
    }
  }, [domain.id]);

  // Gestionnaire de drag du panneau de contrôle
  const handleControlPanelDragStart = useCallback((e: React.MouseEvent) => {
    if (_readOnly) return; // Pas de drag en mode publié
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
  }, [_readOnly, controlPanelPosition]);

  // Effet pour gérer le drag du panneau (mouse move/up global)
  useEffect(() => {
    if (!isDraggingControlPanel) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!controlPanelDragStartRef.current || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - controlPanelDragStartRef.current.mouseX;
      const deltaY = e.clientY - controlPanelDragStartRef.current.mouseY;
      
      let newX = controlPanelDragStartRef.current.panelX + deltaX;
      let newY = controlPanelDragStartRef.current.panelY + deltaY;
      
      // Limiter aux bords du conteneur
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

  // Limites de zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.25;

  // Reset zoom et position quand l'image change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [domain.backgroundImage]);

  // Activer le mode renommage quand un point est cloné
  useEffect(() => {
    if (lastClonedMapElementId && !_readOnly) {
      // Chercher le point cloné dans ce domaine
      const clonedPoint = (domain.mapElements || []).find(p => p.id === lastClonedMapElementId);
      
      if (clonedPoint) {
        setRenamingPointId(lastClonedMapElementId);
        setRenamingValue(clonedPoint.name);
        clearLastClonedMapElementId();
        // Focus sur l'input après le rendu
        setTimeout(() => {
          renameInputRef.current?.focus();
          renameInputRef.current?.select();
        }, 50);
      }
    }
  }, [lastClonedMapElementId, domain.mapElements, _readOnly, clearLastClonedMapElementId]);

  // Gérer la validation du renommage
  const handleRenameSubmit = useCallback(() => {
    if (renamingPointId && renamingValue.trim()) {
      updateMapElement(renamingPointId, { name: renamingValue.trim() });
    }
    setRenamingPointId(null);
    setRenamingValue('');
  }, [renamingPointId, renamingValue, updateMapElement]);

  // Gérer l'annulation du renommage
  const handleRenameCancel = useCallback(() => {
    setRenamingPointId(null);
    setRenamingValue('');
  }, []);

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
  
  // Centrer la vue (remet la position au centre sans changer le zoom)
  const centerView = useCallback(() => {
    setPosition({ x: 0, y: 0 });
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
  
  // Fit to content - Calculer le zoom optimal pour voir tous les points
  const fitToContent = useCallback(() => {
    // En mode fullscreen, utiliser le conteneur fullscreen pour les dimensions
    const container = isFullscreen ? fullscreenContainerRef.current : containerRef.current;
    const imageContainer = imageContainerRef.current;
    if (!container || !imageContainer) {
      // Pas encore chargé, utiliser le reset view
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    const points = domain.mapElements || [];
    
    // Si pas de points, juste réinitialiser
    if (points.length === 0) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    // Dimensions du conteneur (fullscreen ou normal)
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Dimensions de l'image (recalculer pour le conteneur actuel)
    const imageRect = imageContainerRef.current?.getBoundingClientRect();
    let imageWidth = imageRect ? imageRect.width / scale : containerWidth;
    let imageHeight = imageRect ? imageRect.height / scale : containerHeight;

    // En mode fullscreen, recalculer les dimensions de l'image
    if (isFullscreen && domain.backgroundImage) {
      // L'image s'adapte au conteneur fullscreen avec object-contain
      const img = imageContainer.querySelector('img');
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const containerAspect = containerWidth / containerHeight;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        
        if (imageAspect > containerAspect) {
          imageWidth = containerWidth;
          imageHeight = containerWidth / imageAspect;
        } else {
          imageHeight = containerHeight;
          imageWidth = containerHeight * imageAspect;
        }
      }
    }
    
    // Calculer le bounding box des points (en utilisant gpsToPosition)
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    let hasValidPoints = false;
    
    for (const point of points) {
      const pos = gpsToPosition(point.gps);
      if (pos) {
        hasValidPoints = true;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x);
        maxY = Math.max(maxY, pos.y);
      }
    }
    
    if (!hasValidPoints) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    // Ajouter une marge de 10% autour des points
    const marginX = (maxX - minX) * 0.1 || imageWidth * 0.1;
    const marginY = (maxY - minY) * 0.1 || imageHeight * 0.1;
    minX = Math.max(0, minX - marginX);
    minY = Math.max(0, minY - marginY);
    maxX = Math.min(100, maxX + marginX);
    maxY = Math.min(100, maxY + marginY);

    // Dimensions du bounding box en pixels
    const contentWidth = ((maxX - minX) / 100) * imageWidth;
    const contentHeight = ((maxY - minY) / 100) * imageHeight;
    
    // Calculer le zoom pour remplir le conteneur avec le contenu (avec marge)
    const scaleX = (containerWidth * 0.9) / contentWidth;
    const scaleY = (containerHeight * 0.9) / contentHeight;
    const newScale = Math.min(Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)), MAX_ZOOM);

    // Calculer le centre du contenu
    const contentCenterX = ((minX + maxX) / 2 / 100) * imageWidth;
    const contentCenterY = ((minY + maxY) / 2 / 100) * imageHeight;

    // Calculer la position pour centrer le contenu
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;
    
    const newPosX = containerCenterX - contentCenterX * newScale;
    const newPosY = containerCenterY - contentCenterY * newScale;

    setScale(newScale);
    setPosition({ x: newPosX, y: newPosY });
  }, [domain.mapElements, domain.backgroundImage, scale, isFullscreen]);

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
          description: `${result.description} â€” Coordonnées enregistrées automatiquement.`,
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
    // Validation de l'image avant sauvegarde
    if (configForm.imageUrl && configForm.imageUrl.trim().length > 0) {
      if (!isValidBase64Image(configForm.imageUrl)) {
        alert('Erreur: L\'image n\'est pas valide. Veuillez réessayer de charger l\'image.');
        console.error('[MapView] âŒ Tentative de sauvegarde d\'une image invalide');
        return;
      }

      // Vérifier la taille (avertir si > 3MB)
      const sizeMB = configForm.imageUrl.length / 1024 / 1024;

      console.log(`[MapView] ðŸ’¾ Sauvegarde image: ${sizeMB.toFixed(2)} MB (${configForm.imageUrl.length} chars)`);
    }

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
    if (point.elementId) {
      // Si le point est lié à un élément, ouvrir les détails via onElementClick (fonctionne en mode read-only aussi)
      if (_onElementClick) {
        _onElementClick(point.elementId);
      } else if (!_readOnly) {
        // En mode édition, ouvrir le menu d'édition
        setCurrentElement(point.elementId);
      }
    } else if (!_readOnly) {
      // En mode édition seulement, créer un Element pour ce point
      createElementFromPoint(point);
    }
  };

  // Double-clic sur un point pour naviguer vers le domaine source si l'élément hérite sa couleur
  const handlePointDoubleClick = (point: MapElement) => {
    if (!point.elementId || !onDomainClick) return;
    
    // Trouver l'élément lié
    for (const cat of (domain.categories || [])) {
      const element = (cat.elements || []).find(e => e.id === point.elementId);
      if (element && element.status === 'herite_domaine' && element.inheritFromDomainId) {
        onDomainClick(element.inheritFromDomainId);
        return;
      }
    }
  };

  // Créer un Element à partir d'un point de carte
  const createElementFromPoint = (point: MapElement) => {
    // Chercher ou créer une catégorie "Points de carte" dans le domaine - protection pour les tableaux
    let mapCategory = (domain.categories || []).find(c => c.name === 'Points de carte');

    if (!mapCategory) {
      // Créer la catégorie si elle n'existe pas
      addCategory(domain.id, 'Points de carte', 'horizontal');
      // On doit attendre que le store soit mis à jour, donc on utilise un setTimeout
      setTimeout(() => {
        // Re-récupérer la catégorie créée
        const updatedDomain = (useCockpitStore.getState().currentCockpit?.domains || []).find(d => d.id === domain.id);
        const newCategory = (updatedDomain?.categories || []).find(c => c.name === 'Points de carte');
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
    // Vérifier s'il existe des éléments avec le même nom
    const matches = findElementsByName(point.name);

    if (matches.length > 0) {
      // Des éléments avec ce nom existent - afficher le modal
      setPendingElementData({ categoryId, point });
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
      doCreateElement(categoryId, point, null);
    }
  };

  // Effectuer la création de l'élément
  const doCreateElement = (categoryId: string, point: MapElement, linkedGroupId: string | null, linkSubElements?: boolean) => {
    // Créer l'élément
    addElement(categoryId, point.name);

    // Attendre que l'élément soit créé puis le lier au point
    setTimeout(() => {
      const updatedDomain = (useCockpitStore.getState().currentCockpit?.domains || []).find(d => d.id === domain.id);
      const category = (updatedDomain?.categories || []).find(c => c.id === categoryId);
      const newElement = (category?.elements || []).find(e => e.name === point.name);

      if (newElement) {
        // Lier le point à l'élément créé
        updateMapElement(point.id, { elementId: newElement.id });
        // Copier le statut et l'icône du point vers l'élément
        updateElement(newElement.id, {
          status: point.status,
          icon: point.icon
        });

        // Si on doit lier à un groupe existant (avec fusion des catégories/sous-éléments)
        if (linkedGroupId) {
          linkElement(newElement.id, linkedGroupId, linkSubElements);
        }

        // Naviguer vers l'élément
        setCurrentElement(newElement.id);
      }
    }, 100);
  };

  // Créer l'élément indépendamment (sans liaison)
  const handleCreateIndependent = () => {
    if (pendingElementData) {
      doCreateElement(pendingElementData.categoryId, pendingElementData.point, null);
    }
    setShowLinkModal(false);
    setPendingElementData(null);
  };

  // Créer l'élément et le lier à un groupe existant
  const handleCreateLinked = (linkedGroupId: string, linkSubElements?: boolean) => {
    if (pendingElementData) {
      doCreateElement(pendingElementData.categoryId, pendingElementData.point, linkedGroupId, linkSubElements);
    }
    setShowLinkModal(false);
    setPendingElementData(null);
  };

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

  // Normaliser l'URL de l'image - s'assurer qu'elle est valide
  // CRITIQUE : Vérifier explicitement la présence et le type de backgroundImage
  const mapImageUrl = (() => {
    if (!domain) return '';
    if (!domain.backgroundImage) {
      console.log(`[MapView] âŒ Domain "${domain.name}": backgroundImage est undefined/null/absent`);
      return '';
    }
    if (typeof domain.backgroundImage !== 'string') {
      console.log(`[MapView] âŒ Domain "${domain.name}": backgroundImage n'est pas une string (type: ${typeof domain.backgroundImage})`);
      return '';
    }
    const trimmed = domain.backgroundImage.trim();
    // En mode readOnly, on accepte l'image même si elle ne passe pas la validation stricte
    if (!(_readOnly || isValidBase64Image(trimmed))) {
      console.warn(`[MapView] âš ï¸ Domain "${domain.name}": backgroundImage invalide (length: ${trimmed.length}, startsWith: ${trimmed.substring(0, 20)}, valid: ${isValidBase64Image(trimmed)})`);
      return '';
    }
    console.log(`[MapView] âœ… Domain "${domain.name}": backgroundImage valide (${trimmed.length} chars, preview: ${trimmed.substring(0, 30)}...)`);
    return trimmed;
  })();

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
        console.error(`[MapView READ-ONLY] âŒ Domain "${domain?.name}": backgroundImage est ${mapImageUrl ? 'VIDE' : 'ABSENTE'}`);
        if (domain) {
          console.error(`[MapView READ-ONLY] Domain object (preview):`, JSON.stringify(domain, null, 2).substring(0, 1000));
        }
      } else {
        console.log(`[MapView READ-ONLY] âœ… Domain "${domain?.name}": backgroundImage présente (${mapImageUrl.length} caractères)`);
        console.log(`[MapView READ-ONLY] backgroundImage starts with:`, mapImageUrl.substring(0, 30));
        console.log(`[MapView READ-ONLY] Starts with 'data:':`, mapImageUrl.startsWith('data:'));
      }
      console.log(`[MapView READ-ONLY] ====================`);
    }
  }, [domain, mapImageUrl, _readOnly]);
  const hasMapBounds = domain.mapBounds?.topLeft && domain.mapBounds?.bottomRight;

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
  
  // État pour le masquage auto des contrôles de droite en mode publié
  const [isRightControlsHovered, setIsRightControlsHovered] = useState(false);

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

  // Synchroniser showDomainInfo et showCategories quand le domaine change (préférences indépendantes par domaine)
  useEffect(() => {
    const localShowDomainInfo = localStorage.getItem(`showDomainInfo-${domain.id}`);
    setShowDomainInfo(localShowDomainInfo !== null ? localShowDomainInfo === 'true' : true);
    
    const localShowCategories = localStorage.getItem(`showCategories-${domain.id}`);
    setShowCategories(localShowCategories !== null ? localShowCategories === 'true' : true);
  }, [domain.id]);

  // Restaurer l'état sauvegardé quand on change de domaine
  useEffect(() => {
    if (lastDomainIdRef.current !== domain.id) {
      const savedState = loadSavedViewState(domain.id);
      if (savedState.hasSavedState) {
        // Restaurer l'état sauvegardé
        setScale(savedState.scale);
        setPosition(savedState.position);
        hasFittedToScreenRef.current = true;
      } else {
        // Pas d'état sauvegardé - réinitialiser pour fit-to-screen
        setScale(1);
        setPosition({ x: 0, y: 0 });
        hasFittedToScreenRef.current = false;
      }
      lastDomainIdRef.current = domain.id;
      lastBackgroundImageRef.current = domain.backgroundImage;
    }
    // Si l'image change réellement, réinitialiser
    else if (lastBackgroundImageRef.current !== domain.backgroundImage &&
      lastBackgroundImageRef.current !== undefined &&
      domain.backgroundImage !== undefined) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      hasFittedToScreenRef.current = false;
      lastBackgroundImageRef.current = domain.backgroundImage;
    }
  }, [domain.id, domain.backgroundImage]);

  // Sauvegarder le zoom et la position quand ils changent
  useEffect(() => {
    const viewStateKey = `mapView-${domain.id}`;
    localStorage.setItem(viewStateKey, JSON.stringify({ scale, position }));
  }, [scale, position, domain.id]);

  // Calculer les clusters de points en fonction du niveau de zoom
  const calculateClusters = (): { clusters: PointCluster[]; singlePoints: MapElement[] } => {
    let points = domain.mapElements || [];
    
    // Filtrer les points selon les catégories sélectionnées
    if (selectedCategories.length > 0) {
      points = points.filter(point => {
        if (!point.elementId) return false; // Si pas d'élément lié, ne pas afficher quand filtre actif
        // Trouver la catégorie de l'élément lié - protection pour les tableaux
        const elementCategory = (domain.categories || []).find(c => 
          (c.elements || []).some(e => e.id === point.elementId)
        );
        return elementCategory && selectedCategories.includes(elementCategory.id);
      });
    }
    
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
        domains={_domainsProp}
      />
    );
  }

  return (
    <div ref={fullscreenContainerRef} className="relative h-full bg-[#F5F7FA] overflow-hidden flex flex-col">
      {/* Header (conditionnel) */}
      {showDomainInfo && (
        <div className="absolute top-4 left-4 z-20 bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-md">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[#1E3A5F] flex items-center gap-2">
              <MuiIcon name="Place" size={20} className="text-[#1E3A5F]" />
              {domain.name}
            </h2>
            <span className="text-xs text-[#94A3B8] whitespace-nowrap">
              maj le : {formatLastUpdate(domain.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-[#64748B]">
              {(domain.mapElements?.length || 0)} élément(s) positionné(s)
              {selectedCategories.length > 0 && ` (filtre: ${selectedCategories.length} cat.)`}
            </p>
            {!_readOnly && (domain.mapElements?.length || 0) > 0 && (
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="p-1 text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors"
                title="Édition en masse"
              >
                <MuiIcon name="EditNote" size={16} />
              </button>
            )}
          </div>
          {/* Résumé des statuts par criticité basé sur les éléments liés aux points */}
          {(() => {
            // Récupérer les éléments liés aux points de la carte - protection pour les tableaux
            const linkedElements: Element[] = [];
            const mapElements = domain.mapElements || [];
            for (const point of mapElements) {
              if (point.elementId) {
                for (const cat of (domain.categories || [])) {
                  const el = (cat.elements || []).find(e => e.id === point.elementId);
                  if (el) {
                    linkedElements.push(el);
                    break;
                  }
                }
              }
            }
            return linkedElements.length > 0 ? (
              <StatusSummary elements={linkedElements} domains={_domainsProp} compact />
            ) : null;
          })()}
          {!_readOnly && !hasMapBounds && mapImageUrl && (
            <p className="text-xs text-[#FFB74D] mt-1 flex items-center gap-1">
              <MuiIcon name="Warning" size={12} />
              Configurez les coordonnées GPS
            </p>
          )}
        </div>
      )}

      {/* Filtre de catégories - positionné sous l'encart header (conditionnel) */}
      {showCategories && domain.categories && domain.categories.length > 0 && (
        <div 
          className="absolute left-4 z-20 bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden" 
          style={{ 
            top: showDomainInfo ? '13rem' : '1rem', // Positionner avec plus d'espace sous l'encart domaine
            maxHeight: 'calc(100vh - 280px)',
            maxWidth: 'calc(100vw - 200px)' // Laisser de l'espace pour les contrôles de droite
          }}
        >
          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className="w-full px-4 py-2 flex items-center justify-between gap-2 hover:bg-[#F5F7FA] transition-colors"
          >
            <span className="text-sm font-medium text-[#1E3A5F] flex items-center gap-2">
              <MuiIcon name="FilterList" size={16} />
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
                    setSelectedCategories((domain.categories || []).map(c => c.id));
                  }
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors mb-1"
              >
                {selectedCategories.length === domain.categories.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              
              {(domain.categories || []).map(category => {
                const isSelected = selectedCategories.includes(category.id);
                // Compter les points liés à cette catégorie
                const pointCount = (domain.mapElements || []).filter(p => {
                  if (!p.elementId) return false;
                  return (category.elements || []).some(e => e.id === p.elementId);
                }).length;
                
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
                    <span className="text-xs text-[#64748B]">({pointCount})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Zone de déclenchement pour les contrôles de droite (mode publié uniquement) */}
      {_readOnly && !isRightControlsHovered && (
        <div 
          className="absolute top-0 right-0 w-16 h-full z-50"
          onMouseEnter={() => setIsRightControlsHovered(true)}
        />
      )}

      {/* Conteneur des contrôles de droite - repositionnable en mode studio, auto-hide en mode publié */}
      <div 
        ref={controlPanelRef}
        className={`absolute z-30 flex flex-col items-end gap-3 transition-all duration-300 ${
          _readOnly && !isRightControlsHovered ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
        } ${isDraggingControlPanel ? 'cursor-grabbing' : ''}`}
        style={controlPanelPosition && !_readOnly ? {
          left: controlPanelPosition.x,
          top: controlPanelPosition.y,
        } : {
          top: 16,
          right: 24,
        }}
        onMouseEnter={() => _readOnly && setIsRightControlsHovered(true)}
        onMouseLeave={() => _readOnly && setIsRightControlsHovered(false)}
      >
        {/* Contrôles de zoom avec handle de drag intégré en mode studio */}
        <div className={`flex flex-col bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden`}>
          {/* Handle de drag - seulement en mode studio */}
          {!_readOnly && (
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
          
          {/* Boutons de zoom */}
          <button onClick={zoomIn} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Zoomer">
            <MuiIcon name="Add" size={20} />
          </button>
          <button onClick={zoomOut} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title="Dézoomer">
            <MuiIcon name="Remove" size={20} />
          </button>
          <button onClick={fitToContent} onDoubleClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title={t('zoom.fitToWindow')}>
            <MuiIcon name="FitScreen" size={20} />
          </button>
          <button onClick={toggleFullscreen} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F] border-b border-[#E2E8F0]" title={isFullscreen ? t('zoom.exitFullscreen') : t('zoom.fullscreen')}>
            <MuiIcon name={isFullscreen ? "FullscreenExit" : "Fullscreen"} size={20} />
          </button>
          <button onClick={centerView} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F]" title={t('zoom.center')}>
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

        {/* Panneau de toggles */}
        <div className="bg-white rounded-lg px-2 py-1.5 border border-[#E2E8F0] shadow-md space-y-1.5">
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

          {/* Toggle masquage header (mode publié uniquement) */}
          {_readOnly && onToggleHeader && (
            <div className="flex items-center gap-1.5">
              <MuiIcon name="VerticalAlignTop" size={12} className="text-[#1E3A5F]" />
              <button
                onClick={() => onToggleHeader(hideHeader === false ? true : false)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${
                  hideHeader === false ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                }`}
                role="switch"
                aria-checked={hideHeader === false}
                title={hideHeader === false ? t('zoom.hideHeader') : t('zoom.showHeader')}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                    hideHeader === false ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Toggle timeline des dates (mode publié uniquement) - toujours à la fin */}
          {_readOnly && onDateChange && (
            <DateTimeline onDateChange={onDateChange} domainId={domain.id} showToggleOnly />
          )}
        </div>

        {/* Timeline des dates en dessous (mode publié uniquement) */}
        {_readOnly && onDateChange && (
          <DateTimeline onDateChange={onDateChange} domainId={domain.id} showTimelineOnly />
        )}
      </div>

      {/* Conteneur de la carte */}
      <div
        ref={containerRef}
        className={`w-full ${_readOnly ? 'h-full' : 'flex-1'} overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          minHeight: _readOnly ? 'calc(100vh - 200px)' : undefined,
          height: _readOnly ? '100%' : undefined,
          position: 'relative',
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
          className={`w-full ${_readOnly ? 'absolute inset-0' : 'relative h-full'}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging || draggingPointId ? 'none' : 'transform 0.1s ease-out',
            minWidth: '100%',
            minHeight: '100%',
            height: '100%',
            width: '100%',
            position: _readOnly ? 'absolute' : 'relative',
            top: _readOnly ? 0 : undefined,
            left: _readOnly ? 0 : undefined,
            right: _readOnly ? 0 : undefined,
            bottom: _readOnly ? 0 : undefined
          }}
        >
          {/* Image de fond */}
          {/* CRITIQUE: Vérifier que l'image est valide avant de l'afficher */}
          {/* En mode readOnly, on utilise directement domain.backgroundImage si mapImageUrl est vide */}
          {(() => {
            const imageToDisplay = mapImageUrl || (_readOnly && domain.backgroundImage ? domain.backgroundImage : '');
            return imageToDisplay && imageToDisplay.trim().length > 0 && (
              imageToDisplay.startsWith('data:image/') || imageToDisplay.startsWith('data:') || _readOnly
            ) ? (
              <img
                key={`map-image-${domain.id}-${(imageToDisplay || '').substring(0, 20)}-${_readOnly ? 'readonly' : 'edit'}`}
                src={imageToDisplay}
                alt="Carte"
                className="absolute inset-0 w-full h-full object-contain"
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
                  display: 'block',
                  visibility: 'visible',
                  pointerEvents: 'none' // Permettre les clics à travers l'image
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

                  console.log(`[MapView] âœ… Image chargée avec succès pour "${domain.name}" - dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
                  console.log(`[MapView] Image src length: ${mapImageUrl?.length || 0}`);
                  console.log(`[MapView] Image src preview: ${mapImageUrl?.substring(0, 50) || 'EMPTY'}`);
                  console.log(`[MapView] Domain backgroundImage type:`, typeof domain?.backgroundImage);
                  console.log(`[MapView] Domain backgroundImage length:`, domain?.backgroundImage ? domain.backgroundImage.length : 'N/A');
                  console.log(`[MapView] Image element computed style:`, {
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
                  console.log(`[MapView] Image getBoundingClientRect:`, {
                    width: imgRect.width,
                    height: imgRect.height,
                    top: imgRect.top,
                    left: imgRect.left,
                    bottom: imgRect.bottom,
                    right: imgRect.right,
                  });
                  if (container) {
                    console.log(`[MapView] Container dimensions:`, {
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
                    console.log(`[MapView] Parent container dimensions:`, {
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
                  if (_readOnly) {
                    console.log(`[MapView READ-ONLY] âœ… Image de carte chargée avec succès pour le domaine "${domain.name}"`);
                    console.log(`[MapView READ-ONLY] Image rect:`, {
                      width: imgRect.width,
                      height: imgRect.height,
                      top: imgRect.top,
                      left: imgRect.left,
                      bottom: imgRect.bottom,
                      right: imgRect.right
                    });
                    console.log(`[MapView READ-ONLY] Container rect:`, containerRect ? {
                      width: containerRect.width,
                      height: containerRect.height,
                      top: containerRect.top,
                      left: containerRect.left,
                      bottom: containerRect.bottom,
                      right: containerRect.right
                    } : 'NULL');
                    console.log(`[MapView READ-ONLY] Parent container rect:`, parentRect ? {
                      width: parentRect.width,
                      height: parentRect.height,
                      top: parentRect.top,
                      left: parentRect.left,
                      bottom: parentRect.bottom,
                      right: parentRect.right
                    } : 'NULL');
                    console.log(`[MapView READ-ONLY] ðŸ” DIAGNOSTIC - Image visible:`, imgRect.width > 1 && imgRect.height > 1 ? 'OUI' : 'NON');
                    console.log(`[MapView READ-ONLY] ðŸ” DIAGNOSTIC - Container visible:`, containerRect && containerRect.width > 1 && containerRect.height > 1 ? 'OUI' : 'NON');
                    console.log(`[MapView READ-ONLY] ðŸ” DIAGNOSTIC - Parent visible:`, parentRect && parentRect.width > 1 && parentRect.height > 1 ? 'OUI' : 'NON');
                  }
                }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  console.error(`[MapView] âŒ ERREUR chargement image carte pour le domaine "${domain.name}"`);
                  console.error(`[MapView] URL preview:`, mapImageUrl?.substring(0, 100));
                  console.error(`[MapView] Longueur totale:`, mapImageUrl?.length || 0);
                  console.error(`[MapView] Type:`, typeof mapImageUrl);
                  console.error(`[MapView] Starts with data:image/:`, mapImageUrl?.startsWith('data:image/'));
                  console.error(`[MapView] Is valid base64:`, isValidBase64Image(mapImageUrl));
                  if (mapImageUrl) {
                    const base64Part = mapImageUrl.split(',')[1];
                    console.error(`[MapView] Base64 part length:`, base64Part?.length || 0);
                    console.error(`[MapView] Base64 part preview:`, base64Part?.substring(0, 50) || 'NONE');
                    // Vérifier si c'est du base64 valide
                    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                    console.error(`[MapView] Base64 regex valid:`, base64Part ? base64Regex.test(base64Part) : false);
                  }
                  console.error(`[MapView] Image element:`, img);
                  console.error(`[MapView] Image element src length:`, img.src?.length || 0);
                  console.error(`[MapView] Image element styles:`, {
                    display: window.getComputedStyle(img).display,
                    width: window.getComputedStyle(img).width,
                    height: window.getComputedStyle(img).height,
                    src: img.src?.substring(0, 100),
                  });
                  if (_readOnly) {
                    console.error(`[MapView READ-ONLY] âŒ Image de carte non chargée - longueur: ${mapImageUrl?.length || 0} caractères`);
                    console.error(`[MapView READ-ONLY] Domain backgroundImage:`, domain?.backgroundImage ? `PRESENTE (${domain.backgroundImage.length} chars)` : 'ABSENTE');
                    console.error(`[MapView READ-ONLY] Image validity check:`, {
                      isValid: isValidBase64Image(domain?.backgroundImage),
                      startsWithDataImage: domain?.backgroundImage?.startsWith('data:image/'),
                      hasComma: domain?.backgroundImage?.includes(','),
                      base64PartLength: domain?.backgroundImage?.split(',')[1]?.length || 0
                    });
                  }
                  // Ne pas cacher l'image en cas d'erreur - laisser visible pour debug
                  // img.style.display = 'none';
                }}
              />
            ) : null;
          })()}

          {/* Clusters de points (quand on dézoome) - cliquables pour zoomer */}
          {clusters.map((cluster) => {
            const colors = STATUS_COLORS[cluster.worstStatus] || STATUS_COLORS.ok;

            // Taille relative à l'image de la carte (comme BackgroundView : 3% de l'image)
            // Calculer la taille de l'image pour avoir un équivalent
            const container = containerRef.current;
            const imageContainer = imageContainerRef.current;
            let clusterSize = 40; // Taille par défaut
            if (container && imageContainer) {
              const imageRect = imageContainer.getBoundingClientRect();
              // Utiliser 3% de la largeur de l'image visible (comme BackgroundView)
              clusterSize = Math.max(20, Math.min(80, imageRect.width * 0.03));
            }
            // Augmenter de 15% dans les DEUX dimensions (largeur ET hauteur) si le statut est mineur, critique ou fatal (fonctionne en studio ET en mode publié)
            const isCriticalCluster = cluster.worstStatus === 'mineur' || cluster.worstStatus === 'critique' || cluster.worstStatus === 'fatal';
            const clusterSizeMultiplier = isCriticalCluster ? 1.15 : 1.0;
            const originalClusterSize = clusterSize;
            clusterSize = clusterSize * clusterSizeMultiplier; // Appliqué à width ET height (cercle)

            // Log de débogage pour vérifier l'augmentation
            if (isCriticalCluster) {
              console.log(`[MapView] ðŸ” Cluster - Statut: ${cluster.worstStatus}, Multiplicateur: ${clusterSizeMultiplier}, Taille: ${originalClusterSize.toFixed(1)} â†’ ${clusterSize.toFixed(1)}`);
            }

            // Handler pour zoomer sur le cluster
            const handleClusterClick = () => {
              // Zoom +100% (ajouter 1 à l'échelle actuelle)
              const newScale = Math.min(MAX_ZOOM, scale + 1);

              // Centrer la vue sur le cluster
              const containerForClick = containerRef.current;
              if (containerForClick) {
                const containerRectForClick = containerForClick.getBoundingClientRect();

                // Calculer la position pour centrer le cluster
                // Le cluster est à (center.x%, center.y%) - on calcule le décalage depuis le centre (50%)
                const offsetX = (0.5 - cluster.center.x / 100) * containerRectForClick.width * newScale;
                const offsetY = (0.5 - cluster.center.y / 100) * containerRectForClick.height * newScale;

                setPosition({ x: offsetX, y: offsetY });
              }

              setScale(newScale);
            };

            return (
              <div
                key={cluster.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group cursor-pointer"
                style={{ left: `${cluster.center.x}%`, top: `${cluster.center.y}%` }}
                onMouseEnter={(e) => {
                  // Ne pas afficher le tooltip si déjà affiché pour ce cluster
                  if (tooltipShownForRef.current === cluster.id) {
                    return;
                  }
                  
                  if (tooltipTimeoutRef.current) {
                    clearTimeout(tooltipTimeoutRef.current);
                  }
                  
                  setHoveredPoint(cluster.id);
                  tooltipShownForRef.current = cluster.id;
                  
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    pointId: cluster.id,
                    isCluster: true
                  });
                  
                  // Masquer le tooltip après 0.5 seconde
                  tooltipTimeoutRef.current = setTimeout(() => {
                    setHoveredPoint(null);
                    setTooltipPosition(null);
                  }, 500);
                }}
                onMouseLeave={() => {
                  if (tooltipTimeoutRef.current) {
                    clearTimeout(tooltipTimeoutRef.current);
                    tooltipTimeoutRef.current = null;
                  }
                  setHoveredPoint(null);
                  setTooltipPosition(null);
                  tooltipShownForRef.current = null;
                }}
                onClick={handleClusterClick}
              >
                {/* Cercle cluster */}
                <div
                  className="rounded-full shadow-lg flex items-center justify-center font-bold text-white hover:scale-110 hover:brightness-110 transition-all"
                  style={{
                    width: `${clusterSize}px`,
                    height: `${clusterSize}px`,
                    backgroundColor: colors.hex,
                    boxShadow: `0 2px 8px ${colors.hex}50`
                  }}
                >
                  <span className="text-white font-bold text-sm">{cluster.count}</span>
                </div>

                {/* Tooltip rendu via Portal pour être toujours au premier plan */}
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

            const colors = STATUS_COLORS[point.status] || STATUS_COLORS.ok;
            const iconName = point.icon || 'Place';
            const hasLinkedElement = !!point.elementId;

            // Taille relative à l'image de la carte (comme BackgroundView qui utilise les dimensions définies)
            // Calculer la taille relative à l'image visible
            const containerForPoint = containerRef.current;
            const imageContainerForPoint = imageContainerRef.current;
            let dynamicSize = 20; // Taille par défaut
            let iconSize = 16; // Taille d'icône par défaut
            if (containerForPoint && imageContainerForPoint) {
              const imageRectForPoint = imageContainerForPoint.getBoundingClientRect();
              // Utiliser environ 2% de la largeur de l'image visible (taille raisonnable pour un point, équivalent à BackgroundView)
              const baseSize = Math.max(16, Math.min(48, imageRectForPoint.width * 0.02));
              // Augmenter de 15% dans les DEUX dimensions (largeur ET hauteur) si le statut est mineur, critique ou fatal (fonctionne en studio ET en mode publié)
              const isCritical = point.status === 'mineur' || point.status === 'critique' || point.status === 'fatal';
              const sizeMultiplier = isCritical ? 1.15 : 1.0;
              const originalSize = baseSize;
              dynamicSize = baseSize * sizeMultiplier; // Appliqué à width ET height (cercle)

              // Log de débogage pour vérifier l'augmentation
              if (isCritical) {
                console.log(`[MapView] ðŸ” Point "${point.name}" - Statut: ${point.status}, Multiplicateur: ${sizeMultiplier}, Taille: ${originalSize.toFixed(1)} â†’ ${dynamicSize.toFixed(1)}`);
              }
              // Taille d'icône proportionnelle à la taille du point (comme BackgroundView qui utilise 8x la taille)
              iconSize = Math.max(12, Math.round(dynamicSize * 0.5));
            }

            return (
              <div
                key={point.id}
                data-point-element="true"
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group ${!_readOnly ? 'cursor-move' : 'cursor-pointer'
                  }`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  // Zone de drag plus large que l'icône pour faciliter la saisie
                  padding: `${Math.max(8, dynamicSize * 0.3)}px`,
                  minWidth: `${dynamicSize * 1.6}px`,
                  minHeight: `${dynamicSize * 1.6}px`,
                }}
                onMouseEnter={(e) => {
                  // Ne pas afficher le tooltip si déjà affiché pour ce point
                  if (tooltipShownForRef.current === point.id) {
                    return;
                  }
                  
                  // Annuler le timeout précédent si existant
                  if (tooltipTimeoutRef.current) {
                    clearTimeout(tooltipTimeoutRef.current);
                  }
                  
                  setHoveredPoint(point.id);
                  tooltipShownForRef.current = point.id;
                  
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    pointId: point.id,
                    isCluster: false
                  });
                  
                  // Masquer le tooltip après 0.5 seconde
                  tooltipTimeoutRef.current = setTimeout(() => {
                    setHoveredPoint(null);
                    setTooltipPosition(null);
                  }, 500);
                }}
                onMouseLeave={() => {
                  // Annuler le timeout si on quitte le point
                  if (tooltipTimeoutRef.current) {
                    clearTimeout(tooltipTimeoutRef.current);
                    tooltipTimeoutRef.current = null;
                  }
                  setHoveredPoint(null);
                  setTooltipPosition(null);
                  // Réinitialiser le flag pour permettre de réafficher le tooltip au prochain survol
                  tooltipShownForRef.current = null;
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
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handlePointDoubleClick(point);
                }}
              >
                {/* Icône colorée, forme simple - draggable en mode studio */}
                {isShape(point.icon) ? (
                  // Forme simple (cercle, carré, triangle, losange, hexagone, étoile)
                  <div
                    className="flex items-center justify-center transition-all hover:brightness-110 pointer-events-none"
                    style={{
                      width: `${dynamicSize}px`,
                      height: `${dynamicSize}px`,
                    }}
                  >
                    <ShapeSVG
                      shape={getShapeType(point.icon) || 'circle'}
                      color={colors.hex}
                      size={dynamicSize}
                    />
                  </div>
                ) : (
                  // Icône MuiIcon classique (avec fond rond)
                  <div
                    className="rounded-full shadow-lg flex items-center justify-center transition-all hover:brightness-110 pointer-events-none"
                    style={{
                      width: `${dynamicSize}px`,
                      height: `${dynamicSize}px`,
                      backgroundColor: colors.hex,
                      boxShadow: `0 2px 8px ${colors.hex}50`
                    }}
                  >
                    <MuiIcon name={iconName} size={iconSize} className="text-white" />
                  </div>
                )}

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
                        ðŸ“ {point.gps.lat.toFixed(4)}, {point.gps.lng.toFixed(4)}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="absolute bottom-4 left-4 z-20 bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-md">
        <div className="flex items-center gap-6">
          <LegendItem color="#8B5CF6" label={t('status.fatal')} />
          <LegendItem color="#E57373" label={t('status.critical')} />
          <LegendItem color="#FFB74D" label={t('status.minor')} />
          <LegendItem color="#9CCC65" label={t('status.ok')} />
          <LegendItem color="#9E9E9E" label={t('status.disconnected')} />
        </div>
      </div>

      {/* Boutons d'action (masqués en mode lecture seule) */}
      {!_readOnly && (
        <div className="absolute bottom-4 right-4 z-20 flex gap-2">
          <button
            onClick={() => setShowAddPointModal(true)}
            disabled={!hasMapBounds}
            className="flex items-center gap-2 px-4 py-3 bg-[#1E3A5F] text-white rounded-xl hover:bg-[#2C4A6E] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={!hasMapBounds ? 'Configurez d\'abord les coordonnées GPS de la carte' : 'Ajouter un point'}
          >
            <MuiIcon name="Add" size={20} />
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
                      // Vérifier la taille du fichier (30MB max)
                      const maxSizeMB = 30;
                      const maxSizeBytes = maxSizeMB * 1024 * 1024;
                      if (file.size > maxSizeBytes) {
                        alert(`Erreur: Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). La taille maximale autorisée est de ${maxSizeMB} MB.`);
                        e.target.value = ''; // Réinitialiser l'input
                        return;
                      }

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
                      <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>
                      <span>Analyse...</span>
                    </>
                  ) : (
                    <>
                      <MuiIcon name="AutoAwesome" size={16} />
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
                <div className={`mt-3 p-3 rounded-lg text-sm ${analysisResult.detected
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
                      <MuiIcon name="Warning" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
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
                <MuiIcon name="Place" size={16} />
                Coordonnées GPS des coins de l'image
              </h4>
              <p className="text-xs text-[#64748B] mb-4">
                Ces coordonnées correspondent aux pixels des coins de l'image (pas à la zone géographique).
              </p>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <p className="font-medium mb-1">ðŸ’¡ Astuce pour ajuster :</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Point trop haut</strong> â†’ Augmentez la latitude du coin Nord-Ouest</li>
                  <li><strong>Point trop bas</strong> â†’ Diminuez la latitude du coin Sud-Est</li>
                  <li><strong>Point trop à gauche</strong> â†’ Diminuez la longitude du coin Nord-Ouest</li>
                  <li><strong>Point trop à droite</strong> â†’ Augmentez la longitude du coin Sud-Est</li>
                </ul>
              </div>

              {/* Coin haut-gauche */}
              <div className="mb-4">
                <label className="block text-sm text-[#64748B] mb-2">ðŸ“ Coin haut-gauche (Nord-Ouest)</label>
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
                <label className="block text-sm text-[#64748B] mb-2">ðŸ“ Coin bas-droite (Sud-Est)</label>
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
                <MuiIcon name="Settings" size={16} />
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configForm.enableClustering ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                    }`}
                  role="switch"
                  aria-checked={configForm.enableClustering}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configForm.enableClustering ? 'translate-x-6' : 'translate-x-1'
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
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${pointForm.locationType === 'address'
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                    }`}
                >
                  <MuiIcon name="Place" size={16} />
                  Adresse
                </button>
                <button
                  onClick={() => setPointForm({ ...pointForm, locationType: 'gps' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${pointForm.locationType === 'gps'
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
                        <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>
                      ) : (
                        <MuiIcon name="AutoAwesome" size={16} />
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
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${pointForm.status === status
                        ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status]?.hex || '#9E9E9E' }} />
                    <span className="text-xs text-[#1E3A5F]">{STATUS_LABELS[status]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Icône */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Icône / Forme</label>
              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#CBD5E1] transition-all"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: isShape(pointForm.icon) ? 'transparent' : (STATUS_COLORS[pointForm.status]?.hex || '#9E9E9E') }}
                  >
                    {isShape(pointForm.icon) ? (
                      <ShapeSVG shape={getShapeType(pointForm.icon) || 'square'} color={STATUS_COLORS[pointForm.status]?.hex || '#9E9E9E'} size={24} />
                    ) : (
                      <MuiIcon name={pointForm.icon} size={18} className="text-white" />
                    )}
                  </div>
                  <span className="flex-1 text-left">
                    {isShape(pointForm.icon) 
                      ? SIMPLE_SHAPES.find(s => s.id === pointForm.icon)?.label || pointForm.icon 
                      : pointForm.icon}
                  </span>
                  <MuiIcon name="KeyboardArrowDown" size={16} className="text-[#94A3B8]" />
                </button>

                {showIconPicker && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 p-3 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-6 gap-2">
                      {/* Formes simples */}
                      {SIMPLE_SHAPES.map((shape) => (
                        <button
                          key={shape.id}
                          onClick={() => {
                            setPointForm({ ...pointForm, icon: shape.id });
                            setShowIconPicker(false);
                          }}
                          className={`p-2 rounded-lg transition-all ${pointForm.icon === shape.id
                              ? 'bg-[#1E3A5F] text-white'
                              : 'hover:bg-[#F5F7FA] text-[#1E3A5F]'
                            }`}
                          title={shape.label}
                        >
                          <ShapeSVG shape={getShapeType(shape.id) || 'square'} color={STATUS_COLORS[pointForm.status]?.hex || '#9E9E9E'} size={20} />
                        </button>
                      ))}
                      {/* Séparateur visuel */}
                      <div className="col-span-6 h-px bg-[#E2E8F0] my-1" />
                      {/* Icônes populaires */}
                      {POPULAR_MAP_ICONS.map((iconName) => (
                        <button
                          key={iconName}
                          onClick={() => {
                            setPointForm({ ...pointForm, icon: iconName });
                            setShowIconPicker(false);
                          }}
                          className={`p-2 rounded-lg transition-all ${pointForm.icon === iconName
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
                <MuiIcon name="Add" size={16} />
                Ajouter l'élément
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
          newItemName={pendingElementData.point.name}
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
      <BulkEditMapModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        mapElements={domain.mapElements || []}
      />

      {/* Popup de renommage rapide après clonage */}
      {renamingPointId && createPortal(
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
            <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Renommer le point cloné</h4>
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
              placeholder="Nom du point"
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
              {tooltipPosition.isCluster
                ? `${clusters.find(c => c.id === tooltipPosition.pointId)?.count || 0} éléments groupés`
                : (domain.mapElements?.find(p => p.id === tooltipPosition.pointId)?.name || 'Point')}
            </p>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-[#1E3A5F]" style={{ transform: 'translateX(-50%) scale(1)' }} />
        </div>,
        document.body
      )}
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
