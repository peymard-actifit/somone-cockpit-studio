import type { Domain, Element, TileStatus } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';
import { useState, useCallback, useEffect, useRef } from 'react';

// Ordre de priorité des statuts (du plus critique au moins critique)
const STATUS_PRIORITY: Record<TileStatus, number> = {
  fatal: 5,
  critique: 4,
  mineur: 3,
  deconnecte: 2,
  ok: 1,
};

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
  const { setCurrentElement, updateElement, updateDomain, addCategory, addElement } = useCockpitStore();
  
  // État du zoom et position (comme MapView)
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Modal de configuration
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [imageUrl, setImageUrl] = useState(domain.backgroundImage || '');
  
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
  
  // Modal d'édition d'élément existant
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingElement, setEditingElement] = useState<Element | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    status: 'ok' as TileStatus,
    icon: '',
    width: 0,
    height: 0,
  });
  
  // Tooltip au survol
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  
  // Limites de zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;
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
  
  // Mettre à jour l'URL quand le domaine change
  useEffect(() => {
    setImageUrl(domain.backgroundImage || '');
  }, [domain.backgroundImage]);
  
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
  
  // Sauvegarder l'image
  const handleSaveImage = () => {
    updateDomain(domain.id, { backgroundImage: imageUrl });
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
  
  // Convertir position écran en position % sur l'image
  const screenToImagePercent = (clientX: number, clientY: number) => {
    const container = imageContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    
    const rect = container.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };
  
  // Début du drag de la vue ou du dessin
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
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
    if (isDrawing && drawStart.x !== 0) {
      const pos = screenToImagePercent(e.clientX, e.clientY);
      setDrawEnd(pos);
    } else if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, isDrawing, drawStart]);
  
  // Fin du drag de la vue ou du dessin
  const handleMouseUp = () => {
    if (isDrawing && drawStart.x !== 0) {
      const x = Math.min(drawStart.x, drawEnd.x);
      const y = Math.min(drawStart.y, drawEnd.y);
      const width = Math.abs(drawEnd.x - drawStart.x);
      const height = Math.abs(drawEnd.y - drawStart.y);
      
      if (width > 1 && height > 1) {
        setDrawnRect({ x, y, width, height });
        setIsDrawing(false);
        setShowAddModal(true);
      }
      setDrawStart({ x: 0, y: 0 });
      setDrawEnd({ x: 0, y: 0 });
    }
    setIsDragging(false);
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
  
  // Calculer les clusters d'éléments qui se chevauchent
  const calculateClusters = (): { clusters: ElementCluster[]; singleElements: Element[] } => {
    if (positionedElements.length === 0) return { clusters: [], singleElements: [] };
    
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
        clusterElements.forEach(e => {
          if (STATUS_PRIORITY[e.status] > STATUS_PRIORITY[worstStatus]) {
            worstStatus = e.status;
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
  
  // Ouvrir le modal d'édition
  const openEditModal = (element: Element) => {
    setEditingElement(element);
    setEditForm({
      name: element.name,
      status: element.status,
      icon: element.icon || '',
      width: element.width || 5,
      height: element.height || 5,
    });
    setShowEditModal(true);
  };
  
  // Sauvegarder les modifications d'un élément
  const handleSaveEdit = () => {
    if (!editingElement) return;
    
    // Calculer le nouveau centre pour garder la position centrée
    const oldWidth = editingElement.width || 5;
    const oldHeight = editingElement.height || 5;
    const oldCenterX = (editingElement.positionX || 0) + oldWidth / 2;
    const oldCenterY = (editingElement.positionY || 0) + oldHeight / 2;
    
    // Nouvelle position pour garder le centre
    const newX = oldCenterX - editForm.width / 2;
    const newY = oldCenterY - editForm.height / 2;
    
    updateElement(editingElement.id, {
      name: editForm.name,
      status: editForm.status,
      icon: editForm.icon || undefined,
      positionX: Math.max(0, newX),
      positionY: Math.max(0, newY),
      width: editForm.width,
      height: editForm.height,
    });
    
    setShowEditModal(false);
    setEditingElement(null);
  };
  
  return (
    <div className="relative min-h-full bg-[#F5F7FA] overflow-hidden">
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
        <button onClick={resetView} className="p-3 hover:bg-[#F5F7FA] text-[#1E3A5F]" title="Réinitialiser">
          <MuiIcon name="Maximize2" size={20} />
        </button>
      </div>
      
      {/* Indicateur de zoom */}
      <div className="absolute top-4 right-20 z-20 bg-white rounded-lg px-3 py-2 border border-[#E2E8F0] shadow-md">
        <span className="text-sm font-medium text-[#1E3A5F]">{Math.round(scale * 100)}%</span>
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
      
      {/* Conteneur de la vue avec zoom/pan */}
      <div
        ref={containerRef}
        className={`w-full h-[calc(100vh-180px)] overflow-hidden ${
          isDrawing ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
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
            transition: isDragging || isDrawing ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Image de fond */}
          {domain.backgroundImage ? (
            <img 
              src={domain.backgroundImage}
              alt="Fond"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
              onError={(e) => {
                console.error('Erreur chargement image de fond');
                (e.target as HTMLImageElement).style.display = 'none';
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
          {isDrawing && drawStart.x !== 0 && (
            <div
              className="absolute border-2 border-dashed border-[#1E3A5F] bg-[#1E3A5F]/10 pointer-events-none"
              style={{
                left: `${Math.min(drawStart.x, drawEnd.x)}%`,
                top: `${Math.min(drawStart.y, drawEnd.y)}%`,
                width: `${Math.abs(drawEnd.x - drawStart.x)}%`,
                height: `${Math.abs(drawEnd.y - drawStart.y)}%`,
              }}
            />
          )}
          
          {/* Clusters d'éléments */}
          {clusters.map((cluster) => {
            const colors = STATUS_COLORS[cluster.worstStatus];
            
            return (
              <div
                key={cluster.id}
                className="absolute z-10 group"
                style={{
                  left: `${cluster.bounds.x}%`,
                  top: `${cluster.bounds.y}%`,
                  width: `${cluster.bounds.width}%`,
                  height: `${cluster.bounds.height}%`,
                }}
                onMouseEnter={() => setHoveredElement(cluster.id)}
                onMouseLeave={() => setHoveredElement(null)}
              >
                <div 
                  className="w-full h-full rounded-sm cursor-pointer hover:brightness-110 transition-all flex items-center justify-center"
                  style={{ 
                    backgroundColor: colors.hex,
                    boxShadow: `0 2px 8px ${colors.hex}50`
                  }}
                >
                  <span className="text-white font-bold text-lg">{cluster.count}</span>
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
            const colors = STATUS_COLORS[element.status];
            const hasIcon = !!element.icon;
            
            // Calculer la taille de l'icône en fonction de la taille du rectangle
            const iconSize = Math.min(element.width!, element.height!) * 3; // Taille proportionnelle
            
            return (
              <div
                key={element.id}
                className="absolute z-10 group"
                style={{
                  left: `${element.positionX}%`,
                  top: `${element.positionY}%`,
                  width: `${element.width}%`,
                  height: `${element.height}%`,
                }}
                onMouseEnter={() => setHoveredElement(element.id)}
                onMouseLeave={() => setHoveredElement(null)}
              >
                {/* Icône colorée OU rectangle coloré simple */}
                {hasIcon ? (
                  <div 
                    className="w-full h-full flex items-center justify-center cursor-pointer hover:scale-110 transition-all"
                    onClick={() => setCurrentElement(element.id)}
                    style={{ color: colors.hex }}
                  >
                    <MuiIcon name={element.icon!} size={iconSize} />
                  </div>
                ) : (
                  <div 
                    className="w-full h-full rounded-sm cursor-pointer hover:brightness-110 transition-all"
                    onClick={() => setCurrentElement(element.id)}
                    style={{ 
                      backgroundColor: colors.hex,
                      boxShadow: `0 2px 8px ${colors.hex}50`
                    }}
                  />
                )}
                
                {/* Bouton d'édition au survol - en bas, centré, à l'intérieur */}
                {hoveredElement === element.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(element);
                    }}
                    className="absolute bottom-[5%] left-1/2 transform -translate-x-1/2 flex items-center justify-center bg-white/80 rounded-sm hover:bg-white hover:scale-110 transition-all z-20"
                    style={{
                      width: '25%',
                      height: '25%',
                      maxWidth: '25%',
                      maxHeight: '25%',
                      minWidth: '12px',
                      minHeight: '12px',
                    }}
                    title="Modifier"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[70%] h-[70%]">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                  </button>
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
            
            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  setImageUrl(domain.backgroundImage || '');
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
      
      {/* Modal Éditer Élément */}
      {showEditModal && editingElement && (
        <Modal title="Modifier l'élément" onClose={() => { setShowEditModal(false); setEditingElement(null); }}>
          <div className="space-y-4">
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Nom de l'élément</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            
            {/* Statut (couleur) */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Statut (couleur)</label>
              <div className="grid grid-cols-5 gap-2">
                {(['ok', 'mineur', 'critique', 'fatal', 'deconnecte'] as TileStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setEditForm({ ...editForm, status })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      editForm.status === status
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
            
            {/* Icône */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                Icône
                <span className="text-xs text-[#94A3B8] ml-2">Icône colorée ou rectangle</span>
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] max-h-32 overflow-y-auto">
                <button
                  onClick={() => setEditForm({ ...editForm, icon: '' })}
                  className={`p-2 rounded-lg border transition-all ${
                    !editForm.icon
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                      : 'border-transparent hover:bg-white'
                  }`}
                  title="Aucune icône (rectangle)"
                >
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: STATUS_COLORS[editForm.status].hex }} />
                </button>
                {POPULAR_ICONS.map((iconName) => (
                  <button
                    key={iconName}
                    onClick={() => setEditForm({ ...editForm, icon: iconName })}
                    className={`p-2 rounded-lg border transition-all ${
                      editForm.icon === iconName
                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                        : 'border-transparent hover:bg-white'
                    }`}
                    title={iconName}
                    style={{ color: STATUS_COLORS[editForm.status].hex }}
                  >
                    <MuiIcon name={iconName} size={24} />
                  </button>
                ))}
              </div>
            </div>
            
            {/* Taille */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                Taille
                <span className="text-xs text-[#94A3B8] ml-2">Le centre reste fixe lors du redimensionnement</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Largeur (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={editForm.width}
                    onChange={(e) => setEditForm({ ...editForm, width: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Hauteur (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={editForm.height}
                    onChange={(e) => setEditForm({ ...editForm, height: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>
              {/* Prévisualisation taille */}
              <div className="mt-3 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                <div className="flex items-center justify-center h-20">
                  {editForm.icon ? (
                    <span style={{ color: STATUS_COLORS[editForm.status].hex }}>
                      <MuiIcon 
                        name={editForm.icon} 
                        size={Math.min(editForm.width, editForm.height) * 2} 
                      />
                    </span>
                  ) : (
                    <div 
                      className="rounded"
                      style={{ 
                        backgroundColor: STATUS_COLORS[editForm.status].hex,
                        width: `${editForm.width * 2}px`,
                        height: `${editForm.height * 2}px`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            
            {/* Boutons */}
            <div className="flex justify-between gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setCurrentElement(editingElement.id)}
                className="px-4 py-2 text-[#1E3A5F] hover:bg-[#F5F7FA] rounded-lg flex items-center gap-2"
              >
                <MuiIcon name="ExternalLink" size={16} />
                Voir détails
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowEditModal(false); setEditingElement(null); }}
                  className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editForm.name.trim()}
                  className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <MuiIcon name="Check" size={16} />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Composant Modal
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
