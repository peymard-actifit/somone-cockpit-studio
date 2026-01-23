import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Cockpit, Domain, Category, Element, SubElement } from '../types';
import { STATUS_COLORS, getDomainWorstStatus, getEffectiveStatus } from '../types';
import { MuiIcon } from './IconPicker';
import AlertPopup from './AlertPopup';

interface MindMapViewProps {
  cockpit: Cockpit;
  onClose: () => void;
  onNavigateToDomain?: (domainId: string) => void;
  onNavigateToElement?: (domainId: string, elementId: string) => void;
  onNavigateToSubElement?: (domainId: string, elementId: string, subElementId: string) => void;
  // État sauvegardé pour revenir à la même position
  savedState?: {
    focusedNodeId: string | null;
    focusedNodeType: NodeType | null;
    scale: number;
    position: { x: number; y: number };
  };
  onSaveState?: (state: {
    focusedNodeId: string | null;
    focusedNodeType: NodeType | null;
    scale: number;
    position: { x: number; y: number };
  }) => void;
  // Mode lecture seule (cockpits publiés) - active l'auto-hide des contrôles
  readOnly?: boolean;
}

// Types pour les nœuds du mind map
type NodeType = 'cockpit' | 'domain' | 'element' | 'subElement';

interface MindMapNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  color: string;
  data?: Domain | Element | SubElement;
  parentId?: string;
  linkLabel?: string; // Pour les catégories et sous-catégories
}

interface MindMapLink {
  sourceId: string;
  targetId: string;
  color: string;
  label?: string;
}

export default function MindMapView({ 
  cockpit, 
  onClose, 
  onNavigateToDomain,
  onNavigateToElement,
  onNavigateToSubElement,
  savedState,
  onSaveState,
  readOnly = false
}: MindMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Timer pour distinguer clic simple et double-clic
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickedNodeRef = useRef<MindMapNode | null>(null);

  // État du zoom et position (initialisé depuis l'état sauvegardé si disponible)
  const [scale, setScale] = useState(savedState?.scale ?? 1);
  const [position, setPosition] = useState(savedState?.position ?? { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // État pour l'auto-hide des contrôles en mode lecture seule
  const [isRightControlsHovered, setIsRightControlsHovered] = useState(false);

  // État du focus (null = vue globale, sinon ID du domaine ou élément au centre)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(savedState?.focusedNodeId ?? null);
  const [focusedNodeType, setFocusedNodeType] = useState<NodeType | null>(savedState?.focusedNodeType ?? null);

  // État pour l'alerte popup
  const [alertPopup, setAlertPopup] = useState<{
    alert: SubElement['alert'];
    subElement: SubElement;
    breadcrumb: { domain: string; category: string; element: string; subCategory: string };
  } | null>(null);

  // Dimensions du conteneur
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  // Mettre à jour les dimensions du conteneur
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Limites de zoom
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.15;

  // Calculer les nœuds et liens du mind map
  const { nodes, links } = useMemo(() => {
    const nodes: MindMapNode[] = [];
    const links: MindMapLink[] = [];

    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;

    // Protection: vérifier que cockpit.domains existe
    const domains = cockpit?.domains || [];

    // Mode focus sur un domaine - affiche le domaine avec tous ses éléments ET sous-éléments
    if (focusedNodeId && focusedNodeType === 'domain') {
      const domain = domains.find(d => d.id === focusedNodeId);
      if (!domain) return { nodes: [], links: [] };

      const worstStatus = getDomainWorstStatus(domain, domains);
      const domainColor = STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex;

      // Domaine au centre
      nodes.push({
        id: domain.id,
        type: 'domain',
        name: domain.name,
        x: centerX,
        y: centerY,
        color: domainColor,
        data: domain,
      });

      // Éléments autour du domaine - protection pour categories et elements
      const allElements = (domain.categories || []).flatMap(cat => 
        (cat.elements || []).map(el => ({ ...el, category: cat }))
      );
      const elementCount = allElements.length;

      if (elementCount > 0) {
        // Calcul dynamique des rayons basé sur le nombre d'éléments
        const baseRadius = Math.min(containerSize.width, containerSize.height);
        // Plus il y a d'éléments, plus le rayon des éléments est grand
        const elementRadius = baseRadius * (0.25 + Math.min(0.15, elementCount * 0.01));
        // Rayon pour les sous-éléments - assez grand pour être visible
        const subElementRadius = baseRadius * 0.12;
        
        allElements.forEach((element, index) => {
          const angle = (2 * Math.PI * index) / elementCount - Math.PI / 2;
          const elementX = centerX + Math.cos(angle) * elementRadius;
          const elementY = centerY + Math.sin(angle) * elementRadius;

          const effectiveStatus = getEffectiveStatus(element, cockpit.domains);
          const elementColor = STATUS_COLORS[effectiveStatus]?.hex || STATUS_COLORS.ok.hex;

          nodes.push({
            id: element.id,
            type: 'element',
            name: element.name,
            x: elementX,
            y: elementY,
            color: elementColor,
            data: element,
            parentId: domain.id,
            linkLabel: element.category.name,
          });

          links.push({
            sourceId: domain.id,
            targetId: element.id,
            color: elementColor,
            label: element.category.name,
          });

          // Ajouter les sous-éléments de chaque élément - protection pour subCategories et subElements
          const allSubElements = (element.subCategories || []).flatMap(subCat =>
            (subCat.subElements || []).map(se => ({ ...se, subCategory: subCat }))
          );
          const subElementCount = allSubElements.length;

          if (subElementCount > 0) {
            // Arc de 90° (PI/2) centré sur la direction de l'élément vers l'extérieur
            const arcSpan = Math.PI / 2;
            const subStartAngle = angle - arcSpan / 2;
            const subEndAngle = angle + arcSpan / 2;
            const subAngleStep = subElementCount > 1 ? (subEndAngle - subStartAngle) / (subElementCount - 1) : 0;

            allSubElements.forEach((subElement, subIndex) => {
              const subAngle = subElementCount === 1 
                ? angle 
                : subStartAngle + subAngleStep * subIndex;
              const subX = elementX + Math.cos(subAngle) * subElementRadius;
              const subY = elementY + Math.sin(subAngle) * subElementRadius;

              const subElementColor = STATUS_COLORS[subElement.status]?.hex || STATUS_COLORS.ok.hex;

              nodes.push({
                id: subElement.id,
                type: 'subElement',
                name: subElement.name,
                x: subX,
                y: subY,
                color: subElementColor,
                data: subElement,
                parentId: element.id,
                linkLabel: subElement.subCategory.name,
              });

              links.push({
                sourceId: element.id,
                targetId: subElement.id,
                color: subElementColor,
                label: subElement.subCategory.name,
              });
            });
          }
        });
      }

      return { nodes, links };
    }

    // Mode focus sur un élément
    if (focusedNodeId && focusedNodeType === 'element') {
      let foundElement: Element | null = null;
      let foundDomain: Domain | null = null;
      let foundCategory: Category | null = null;

      for (const domain of domains) {
        for (const cat of (domain.categories || [])) {
          const el = (cat.elements || []).find(e => e.id === focusedNodeId);
          if (el) {
            foundElement = el;
            foundDomain = domain;
            foundCategory = cat;
            break;
          }
        }
        if (foundElement) break;
      }

      if (!foundElement || !foundDomain || !foundCategory) return { nodes: [], links: [] };

      const effectiveStatus = getEffectiveStatus(foundElement, domains);
      const elementColor = STATUS_COLORS[effectiveStatus]?.hex || STATUS_COLORS.ok.hex;

      // Élément au centre
      nodes.push({
        id: foundElement.id,
        type: 'element',
        name: foundElement.name,
        x: centerX,
        y: centerY,
        color: elementColor,
        data: foundElement,
      });

      // Sous-éléments autour de l'élément - protection pour subCategories et subElements
      const allSubElements = (foundElement.subCategories || []).flatMap(subCat =>
        (subCat.subElements || []).map(se => ({ ...se, subCategory: subCat }))
      );
      const subElementCount = allSubElements.length;

      if (subElementCount > 0) {
        const subElementRadius = Math.min(containerSize.width, containerSize.height) * 0.35;
        allSubElements.forEach((subElement, index) => {
          const angle = (2 * Math.PI * index) / subElementCount - Math.PI / 2;
          const x = centerX + Math.cos(angle) * subElementRadius;
          const y = centerY + Math.sin(angle) * subElementRadius;

          const subElementColor = STATUS_COLORS[subElement.status]?.hex || STATUS_COLORS.ok.hex;

          nodes.push({
            id: subElement.id,
            type: 'subElement',
            name: subElement.name,
            x,
            y,
            color: subElementColor,
            data: subElement,
            parentId: foundElement!.id,
            linkLabel: subElement.subCategory.name,
          });

          links.push({
            sourceId: foundElement!.id,
            targetId: subElement.id,
            color: subElementColor,
            label: subElement.subCategory.name,
          });
        });
      }

      return { nodes, links };
    }

    // Vue globale : Cockpit au centre
    nodes.push({
      id: cockpit.id,
      type: 'cockpit',
      name: cockpit.name,
      x: centerX,
      y: centerY,
      color: '#1E3A5F',
    });

    // Calculer la disposition des domaines
    const domainCount = domains.length;
    if (domainCount === 0) return { nodes, links };

    // Rayon pour les domaines (adapté à la taille du conteneur)
    const domainRadius = Math.min(containerSize.width, containerSize.height) * 0.25;
    // Rayon pour les éléments
    const elementRadius = Math.min(containerSize.width, containerSize.height) * 0.15;

    domains.forEach((domain, domainIndex) => {
      const domainAngle = (2 * Math.PI * domainIndex) / domainCount - Math.PI / 2;
      const domainX = centerX + Math.cos(domainAngle) * domainRadius;
      const domainY = centerY + Math.sin(domainAngle) * domainRadius;

      // Calculer le statut du domaine
      const worstStatus = getDomainWorstStatus(domain, domains);
      const domainColor = STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex;

      nodes.push({
        id: domain.id,
        type: 'domain',
        name: domain.name,
        x: domainX,
        y: domainY,
        color: domainColor,
        data: domain,
        parentId: cockpit.id,
      });

      links.push({
        sourceId: cockpit.id,
        targetId: domain.id,
        color: domainColor,
      });

      // Ajouter les éléments de chaque domaine - protection pour categories et elements
      const allElements = (domain.categories || []).flatMap(cat => 
        (cat.elements || []).map(el => ({ ...el, category: cat }))
      );
      const elementCount = allElements.length;

      if (elementCount > 0) {
        // Répartir les éléments en arc autour du domaine
        const startAngle = domainAngle - Math.PI / 3;
        const endAngle = domainAngle + Math.PI / 3;
        const angleStep = elementCount > 1 ? (endAngle - startAngle) / (elementCount - 1) : 0;

        allElements.forEach((element, elementIndex) => {
          const elementAngle = elementCount === 1 
            ? domainAngle 
            : startAngle + angleStep * elementIndex;
          const elementX = domainX + Math.cos(elementAngle) * elementRadius;
          const elementY = domainY + Math.sin(elementAngle) * elementRadius;

          const effectiveStatus = getEffectiveStatus(element, domains);
          const elementColor = STATUS_COLORS[effectiveStatus]?.hex || STATUS_COLORS.ok.hex;

          nodes.push({
            id: element.id,
            type: 'element',
            name: element.name,
            x: elementX,
            y: elementY,
            color: elementColor,
            data: element,
            parentId: domain.id,
            linkLabel: element.category.name,
          });

          links.push({
            sourceId: domain.id,
            targetId: element.id,
            color: elementColor,
            label: element.category.name,
          });

          // Ajouter les sous-éléments de chaque élément - protection pour subCategories et subElements
          const allSubElements = (element.subCategories || []).flatMap(subCat =>
            (subCat.subElements || []).map(se => ({ ...se, subCategory: subCat }))
          );
          const subElementCount = allSubElements.length;

          if (subElementCount > 0) {
            const subElementRadius = elementRadius * 0.5;
            const subStartAngle = elementAngle - Math.PI / 4;
            const subEndAngle = elementAngle + Math.PI / 4;
            const subAngleStep = subElementCount > 1 ? (subEndAngle - subStartAngle) / (subElementCount - 1) : 0;

            allSubElements.forEach((subElement, subIndex) => {
              const subAngle = subElementCount === 1 
                ? elementAngle 
                : subStartAngle + subAngleStep * subIndex;
              const subX = elementX + Math.cos(subAngle) * subElementRadius;
              const subY = elementY + Math.sin(subAngle) * subElementRadius;

              const subElementColor = STATUS_COLORS[subElement.status]?.hex || STATUS_COLORS.ok.hex;

              nodes.push({
                id: subElement.id,
                type: 'subElement',
                name: subElement.name,
                x: subX,
                y: subY,
                color: subElementColor,
                data: subElement,
                parentId: element.id,
                linkLabel: subElement.subCategory.name,
              });

              links.push({
                sourceId: element.id,
                targetId: subElement.id,
                color: subElementColor,
                label: subElement.subCategory.name,
              });
            });
          }
        });
      }
    });

    return { nodes, links };
  }, [cockpit, containerSize, focusedNodeId, focusedNodeType]);

  // Calculer les tailles de police adaptatives
  const getFontSize = useCallback((nodeType: NodeType): number => {
    const baseSize = Math.min(containerSize.width, containerSize.height) / 60;
    
    if (focusedNodeId) {
      // En mode focus, les nœuds sont plus grands
      switch (nodeType) {
        case 'cockpit': return baseSize * 2;
        case 'domain': return baseSize * 1.8;
        case 'element': return baseSize * 1.4;
        case 'subElement': return baseSize * 1.2;
      }
    }
    
    // Vue globale - tailles adaptées au nombre de nœuds
    const totalNodes = nodes.length;
    const scaleFactor = Math.max(0.5, Math.min(1, 30 / totalNodes));
    
    switch (nodeType) {
      case 'cockpit': return baseSize * 1.8 * scaleFactor;
      case 'domain': return baseSize * 1.3 * scaleFactor;
      case 'element': return baseSize * 0.9 * scaleFactor;
      case 'subElement': return baseSize * 0.7 * scaleFactor;
    }
  }, [containerSize, focusedNodeId, nodes.length]);

  // Calculer les tailles de nœuds
  const getNodeSize = useCallback((nodeType: NodeType): number => {
    const baseSize = Math.min(containerSize.width, containerSize.height) / 15;
    
    if (focusedNodeId) {
      switch (nodeType) {
        case 'cockpit': return baseSize * 1.5;
        case 'domain': return baseSize * 1.3;
        case 'element': return baseSize * 1;
        case 'subElement': return baseSize * 0.8;
      }
    }
    
    const totalNodes = nodes.length;
    const scaleFactor = Math.max(0.4, Math.min(1, 25 / totalNodes));
    
    switch (nodeType) {
      case 'cockpit': return baseSize * 1.2 * scaleFactor;
      case 'domain': return baseSize * 0.9 * scaleFactor;
      case 'element': return baseSize * 0.6 * scaleFactor;
      case 'subElement': return baseSize * 0.4 * scaleFactor;
    }
  }, [containerSize, focusedNodeId, nodes.length]);

  // Zoom avec la molette
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // Début du drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-node]')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Pendant le drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  // Fin du drag
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double-clic sur un nœud - annule le clic simple et fait le focus/expand
  const handleNodeDoubleClick = (node: MindMapNode) => {
    // Annuler le timer du clic simple
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickedNodeRef.current = null;
    
    if (node.type === 'cockpit') {
      // Retour à la vue globale
      setFocusedNodeId(null);
      setFocusedNodeType(null);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else if (node.type === 'domain') {
      if (focusedNodeId === node.id) {
        // Double-clic sur le domaine centré = retour vue globale
        setFocusedNodeId(null);
        setFocusedNodeType(null);
      } else {
        // Focus sur ce domaine
        setFocusedNodeId(node.id);
        setFocusedNodeType('domain');
      }
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else if (node.type === 'element') {
      if (focusedNodeId === node.id) {
        // Double-clic sur l'élément centré = retour vue globale
        setFocusedNodeId(null);
        setFocusedNodeType(null);
      } else {
        // Focus sur cet élément
        setFocusedNodeId(node.id);
        setFocusedNodeType('element');
      }
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else if (node.type === 'subElement') {
      // Double-clic sur un sous-élément avec alerte
      const subElement = node.data as SubElement;
      if (subElement?.alert) {
        // Trouver le chemin complet
        let breadcrumb = { domain: '', category: '', element: '', subCategory: '' };
        
        for (const domain of cockpit.domains) {
          for (const cat of domain.categories) {
            for (const el of cat.elements) {
              for (const subCat of el.subCategories) {
                const se = subCat.subElements.find(s => s.id === subElement.id);
                if (se) {
                  breadcrumb = {
                    domain: domain.name,
                    category: cat.name,
                    element: el.name,
                    subCategory: subCat.name,
                  };
                  break;
                }
              }
            }
          }
        }
        
        setAlertPopup({
          alert: subElement.alert,
          subElement,
          breadcrumb,
        });
      }
    }
  };

  // Contrôles de zoom
  const zoomIn = () => setScale(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  const zoomOut = () => setScale(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setFocusedNodeId(null);
    setFocusedNodeType(null);
  };

  // Animation d'entrée
  const [isAnimating, setIsAnimating] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Trouver le domainId pour un élément
  const findDomainIdForElement = useCallback((elementId: string): string | null => {
    for (const domain of cockpit.domains) {
      for (const cat of domain.categories) {
        if (cat.elements.some(e => e.id === elementId)) {
          return domain.id;
        }
      }
    }
    return null;
  }, [cockpit.domains]);

  // Trouver le domainId et elementId pour un sous-élément
  const findPathForSubElement = useCallback((subElementId: string): { domainId: string; elementId: string } | null => {
    for (const domain of cockpit.domains) {
      for (const cat of domain.categories) {
        for (const el of cat.elements) {
          for (const subCat of el.subCategories) {
            if (subCat.subElements.some(se => se.id === subElementId)) {
              return { domainId: domain.id, elementId: el.id };
            }
          }
        }
      }
    }
    return null;
  }, [cockpit.domains]);

  // Exécuter la navigation (clic simple confirmé)
  const executeNavigation = useCallback((node: MindMapNode) => {
    // Sauvegarder l'état actuel avant de naviguer
    const saveState = () => {
      onSaveState?.({
        focusedNodeId,
        focusedNodeType,
        scale,
        position,
      });
    };

    if (node.type === 'domain' && onNavigateToDomain) {
      saveState();
      onNavigateToDomain(node.id);
    } else if (node.type === 'element' && onNavigateToElement) {
      const domainId = findDomainIdForElement(node.id);
      if (domainId) {
        saveState();
        onNavigateToElement(domainId, node.id);
      }
    } else if (node.type === 'subElement' && onNavigateToSubElement) {
      const path = findPathForSubElement(node.id);
      if (path) {
        saveState();
        onNavigateToSubElement(path.domainId, path.elementId, node.id);
      }
    }
  }, [onNavigateToDomain, onNavigateToElement, onNavigateToSubElement, findDomainIdForElement, findPathForSubElement, focusedNodeId, focusedNodeType, scale, position, onSaveState]);

  // Clic simple sur un nœud - utilise un délai pour distinguer du double-clic
  const handleNodeClick = useCallback((node: MindMapNode, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Ne pas naviguer pour le cockpit (centre)
    if (node.type === 'cockpit') return;
    
    // Sauvegarder le nœud cliqué
    clickedNodeRef.current = node;
    
    // Annuler le timer précédent s'il existe
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    
    // Démarrer un nouveau timer - si pas de double-clic dans 250ms, exécuter la navigation
    clickTimerRef.current = setTimeout(() => {
      if (clickedNodeRef.current && clickedNodeRef.current.id === node.id) {
        executeNavigation(node);
      }
      clickedNodeRef.current = null;
      clickTimerRef.current = null;
    }, 250);
  }, [executeNavigation]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0F1729] via-[#1E3A5F] to-[#0F1729]">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <MuiIcon name="ArrowLeft" size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-3">
                <MuiIcon name="AccountTree" size={24} className="text-cyan-400" />
                Vue Éclatée
              </h1>
              <p className="text-sm text-white/60">
                {focusedNodeId 
                  ? `Focus sur: ${nodes.find(n => n.id === focusedNodeId)?.name || ''}`
                  : cockpit.name
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Légende des interactions */}
            <div className="flex items-center gap-4 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Clic:</span>
                <span className="text-xs text-white">Voir détail</span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Double-clic:</span>
                <span className="text-xs text-white">Développer ici</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone de déclenchement pour les contrôles de droite (mode lecture seule) */}
      {readOnly && !isRightControlsHovered && (
        <div 
          className="absolute top-0 right-0 w-16 h-full z-30"
          onMouseEnter={() => setIsRightControlsHovered(true)}
        />
      )}

      {/* Contrôles de zoom - avec auto-hide en mode lecture seule */}
      <div 
        className={`absolute top-20 right-4 z-20 flex flex-col gap-3 transition-all duration-300 ${
          readOnly && !isRightControlsHovered ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
        }`}
        onMouseEnter={() => readOnly && setIsRightControlsHovered(true)}
        onMouseLeave={() => readOnly && setIsRightControlsHovered(false)}
      >
        {/* Boutons de zoom */}
        <div className="flex flex-col gap-1 bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
          <button onClick={zoomIn} className="p-3 text-white hover:bg-white/20 transition-colors" title="Zoomer">
            <MuiIcon name="Add" size={20} />
          </button>
          <button onClick={zoomOut} className="p-3 text-white hover:bg-white/20 border-t border-white/10 transition-colors" title="Dézoomer">
            <MuiIcon name="Remove" size={20} />
          </button>
          <button onClick={resetView} className="p-3 text-white hover:bg-white/20 border-t border-white/10 transition-colors" title="Réinitialiser">
            <MuiIcon name="CenterFocusStrong" size={20} />
          </button>
        </div>

        {/* Indicateur de zoom */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
          <span className="text-sm font-medium text-white">{Math.round(scale * 100)}%</span>
        </div>
      </div>

      {/* Info mode focus */}
      {focusedNodeId && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
          <p className="text-white text-sm flex items-center gap-2">
            <MuiIcon name="Info" size={16} className="text-cyan-400" />
            Double-cliquez sur le centre pour revenir à la vue globale
          </p>
        </div>
      )}

      {/* Zone de rendu du mind map */}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="w-full h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          {/* Définitions pour les effets */}
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Liens */}
          <g className="links">
            {links.map((link, index) => {
              const sourceNode = nodes.find(n => n.id === link.sourceId);
              const targetNode = nodes.find(n => n.id === link.targetId);
              if (!sourceNode || !targetNode) return null;

              // Calculer le point de contrôle pour une courbe de Bézier
              const midX = (sourceNode.x + targetNode.x) / 2;
              const midY = (sourceNode.y + targetNode.y) / 2;
              
              // Décaler légèrement le point de contrôle pour créer une courbe
              const dx = targetNode.x - sourceNode.x;
              const dy = targetNode.y - sourceNode.y;
              const perpX = -dy * 0.1;
              const perpY = dx * 0.1;

              const path = `M ${sourceNode.x} ${sourceNode.y} Q ${midX + perpX} ${midY + perpY} ${targetNode.x} ${targetNode.y}`;

              return (
                <g key={`link-${index}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={link.color}
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    className={isAnimating ? 'animate-pulse' : ''}
                    style={{
                      strokeDasharray: isAnimating ? '5,5' : 'none',
                    }}
                  />
                  {/* Label sur le lien (catégorie/sous-catégorie) */}
                  {link.label && scale > 0.6 && (
                    <text
                      x={midX + perpX}
                      y={midY + perpY}
                      fill="white"
                      fillOpacity={0.5}
                      fontSize={Math.max(8, getFontSize('subElement') * 0.7)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none"
                    >
                      {link.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nœuds */}
          <g className="nodes">
            {nodes.map((node) => {
              const nodeSize = getNodeSize(node.type);
              const fontSize = getFontSize(node.type);
              const isCenter = node.type === 'cockpit' || 
                (focusedNodeId === node.id);

              return (
                <g
                  key={node.id}
                  data-node
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  style={{
                    transition: isAnimating ? 'none' : 'transform 0.3s ease-out',
                  }}
                  onClick={(e) => handleNodeClick(node, e)}
                  onDoubleClick={() => handleNodeDoubleClick(node)}
                >
                  {/* Cercle externe (glow) */}
                  <circle
                    r={nodeSize * 0.6}
                    fill={node.color}
                    fillOpacity={0.2}
                    filter="url(#glow)"
                  />
                  
                  {/* Cercle principal */}
                  <circle
                    r={nodeSize * 0.5}
                    fill={node.color}
                    stroke="white"
                    strokeWidth={isCenter ? 3 : 1.5}
                    strokeOpacity={0.8}
                    filter="url(#shadow)"
                    className="transition-all duration-200 hover:brightness-125"
                  />

                  {/* Indicateur d'alerte pour les sous-éléments */}
                  {node.type === 'subElement' && (node.data as SubElement)?.alert && (
                    <g transform={`translate(${nodeSize * 0.35}, -${nodeSize * 0.35})`}>
                      <circle r={nodeSize * 0.15} fill="#EF4444" />
                      <text
                        fill="white"
                        fontSize={nodeSize * 0.2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        !
                      </text>
                    </g>
                  )}

                  {/* Nom du nœud */}
                  <text
                    y={nodeSize * 0.7}
                    fill="white"
                    fontSize={fontSize}
                    fontWeight={isCenter ? 'bold' : 'normal'}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none select-none"
                    style={{
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}
                  >
                    {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
                  </text>

                  {/* Valeur pour les sous-éléments */}
                  {node.type === 'subElement' && (node.data as SubElement)?.value && scale > 0.8 && (
                    <text
                      y={nodeSize * 0.95}
                      fill="white"
                      fillOpacity={0.7}
                      fontSize={fontSize * 0.8}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none"
                    >
                      {(node.data as SubElement).value} {(node.data as SubElement).unit || ''}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Popup d'alerte */}
      {alertPopup && (
        <AlertPopup
          alert={alertPopup.alert!}
          subElement={alertPopup.subElement}
          breadcrumb={alertPopup.breadcrumb}
          onClose={() => setAlertPopup(null)}
        />
      )}

      {/* Légende en bas à gauche */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/10 backdrop-blur-sm rounded-xl p-4">
        <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Légende</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#1E3A5F]" />
            <span className="text-xs text-white">Cockpit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.ok.hex }} />
            <span className="text-xs text-white">OK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.mineur.hex }} />
            <span className="text-xs text-white">Mineur</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.critique.hex }} />
            <span className="text-xs text-white">Critique</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.fatal.hex }} />
            <span className="text-xs text-white">Fatal</span>
          </div>
        </div>
      </div>

      {/* Statistiques en bas à droite */}
      <div className="absolute bottom-4 right-4 z-20 bg-white/10 backdrop-blur-sm rounded-xl p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="text-white/60">Domaines</div>
          <div className="text-white font-medium">{cockpit.domains.length}</div>
          <div className="text-white/60">Éléments</div>
          <div className="text-white font-medium">
            {cockpit.domains.reduce((sum, d) => sum + d.categories.reduce((s, c) => s + c.elements.length, 0), 0)}
          </div>
          <div className="text-white/60">Sous-éléments</div>
          <div className="text-white font-medium">
            {cockpit.domains.reduce((sum, d) => 
              sum + d.categories.reduce((s, c) => 
                s + c.elements.reduce((se, e) => 
                  se + e.subCategories.reduce((sse, sc) => sse + sc.subElements.length, 0), 0), 0), 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
