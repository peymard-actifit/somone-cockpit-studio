import React, { useState, useEffect, useRef } from 'react';
import type { Domain, Element, SubElement, TileStatus, TemplateType, Alert, MapBounds, StatsPeriodType, ServiceHours, Incident, IncidentSeverity } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import IconPicker, { MuiIcon, isCustomIcon } from './IconPicker';
import SubElementTile from './SubElementTile';
import { useConfirm } from '../contexts/ConfirmContext';
import ElementTile from './ElementTile';
import SourcesAndCalculationsPanel from './subelements/SourcesAndCalculationsPanel';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LinkElementModal from './LinkElementModal';

// Composant input avec etat local pour eviter la perte de focus
function EditableInput({ value, onChange, className, placeholder, allowEmpty = false }: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => {
        const trimmed = e.target.value.trim();
        if (allowEmpty || trimmed) {
          if (trimmed !== value) {
            onChange(trimmed);
          }
        } else {
          setLocalValue(value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setLocalValue(value);
          e.currentTarget.blur();
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

interface EditorPanelProps {
  domain: Domain | undefined;
  element: Element | null;
  onSelectSubElement?: (subElementId: string) => void; // Callback pour sélectionner un sous-élément
  selectedSubElementId?: string | null; // ID du sous-élément à sélectionner depuis l'extérieur
}

// Composant pour une catégorie sortable
function SortableCategoryItem({ category, onIconClick, onNameChange, onDelete, subElementsCount }: {
  category: { id: string; name: string; icon?: string };
  onIconClick: () => void;
  onNameChange: (name: string) => void;
  onDelete: () => void;
  subElementsCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 p-2 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
      {/* Handle de drag */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 text-[#94A3B8] hover:text-[#1E3A5F] shrink-0"
        title="Glisser pour réorganiser"
      >
        <MuiIcon name="DragIndicator" size={14} />
      </div>
      <button
        onClick={onIconClick}
        className="flex items-center justify-center w-6 h-6 bg-white border border-[#E2E8F0] rounded hover:border-[#1E3A5F] transition-colors shrink-0"
        title="Choisir une icône"
      >
        {category.icon ? (
          <MuiIcon name={category.icon} size={14} className="text-[#1E3A5F]" />
        ) : (
          <MuiIcon name="Image" size={14} className="text-[#94A3B8]" />
        )}
      </button>
      <EditableInput value={category.name} onChange={onNameChange} className="flex-1 min-w-0 px-2 py-1 bg-white border border-[#E2E8F0] rounded text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] truncate" />
      <span className="text-xs text-[#94A3B8] shrink-0 whitespace-nowrap">
        {subElementsCount}
      </span>
      <button
        onClick={onDelete}
        className="p-1 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
        title="Supprimer la catégorie"
      >
        <MuiIcon name="Delete" size={16} />
      </button>
    </div>
  );
}

// Composant pour une sous-catégorie sortable
function SortableSubCategoryItem({ subCategory, onIconClick, onNameChange, onDelete, subElementsCount }: {
  subCategory: { id: string; name: string; icon?: string };
  onIconClick: () => void;
  onNameChange: (name: string) => void;
  onDelete: () => void;
  subElementsCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subCategory.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
      {/* Handle de drag */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-[#94A3B8] hover:text-[#1E3A5F]"
        title="Glisser pour réorganiser"
      >
        <MuiIcon name="DragIndicator" size={16} />
      </div>
      <button
        onClick={onIconClick}
        className="flex items-center justify-center w-8 h-8 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors"
        title="Choisir une icône"
      >
        {subCategory.icon ? (
          <MuiIcon name={subCategory.icon} size={18} className="text-[#1E3A5F]" />
        ) : (
          <MuiIcon name="Image" size={18} className="text-[#94A3B8]" />
        )}
      </button>
      <EditableInput value={subCategory.name} onChange={onNameChange} className="flex-1 px-2 py-1 bg-white border border-[#E2E8F0] rounded text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]" />
      <span className="text-xs text-[#94A3B8]">
        {subElementsCount} sous-élément{subElementsCount > 1 ? 's' : ''}
      </span>
      <button
        onClick={onDelete}
        className="p-1 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        title="Supprimer la sous-catégorie"
      >
        <MuiIcon name="Delete" size={16} />
      </button>
    </div>
  );
}

export default function EditorPanel({ domain, element, selectedSubElementId }: EditorPanelProps) {
  const {
    updateDomain,
    deleteDomain,
    duplicateDomain,
    updateCategory,
    deleteCategory,
    reorderCategory,
    updateSubCategory,
    deleteSubCategory,
    reorderSubCategory,
    updateElement,
    deleteElement,
    updateSubElement,
    deleteSubElement,
    updateCockpit,
    currentCockpit,
    zones,
    addZone,
    updateZone,
    updateTemplateIcon,
    setCurrentElement,
    setCurrentDomain,
    updateMapElement,
    deleteMapElement,
    cloneMapElement,
    updateMapBounds,
    forceSave,
    findElementsByName,
    findSubElementsByName,
    copyElementContent,
    copySubElementContent,
    addIncident,
    unlinkElement,
    unlinkSubElement,
    getAllElements,
    getAllSubElements,
    linkElement,
    linkSubElement,
    moveElementToCategory,
    moveSubElementToSubCategory,
    addCategory,
    getLinkedElements,
    getLinkedSubElements
  } = useCockpitStore();
  const { token, user } = useAuthStore();
  const confirm = useConfirm();

  // État pour la liste des utilisateurs et le partage
  const [users, setUsers] = useState<Array<{ id: string; username: string; isAdmin: boolean }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Configuration des capteurs pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler pour le drag & drop des catégories
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!domain || !over || active.id === over.id) return;

    const oldIndex = domain.categories.findIndex(c => c.id === active.id);
    const newIndex = domain.categories.findIndex(c => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(domain.categories.map(c => c.id), oldIndex, newIndex);
      reorderCategory(domain.id, newOrder);
    }
  };

  // Handler pour le drag & drop des sous-catégories
  const handleSubCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!element || !over || active.id === over.id) return;

    const oldIndex = element.subCategories.findIndex(sc => sc.id === active.id);
    const newIndex = element.subCategories.findIndex(sc => sc.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(element.subCategories.map(sc => sc.id), oldIndex, newIndex);
      reorderSubCategory(element.id, newOrder);
    }
  };

  const [activeSection, setActiveSection] = useState<string | null>('properties');
  const [newZoneName, setNewZoneName] = useState('');
  const [selectedSubElement, setSelectedSubElement] = useState<SubElement | null>(null);
  const [editingSubElementName, setEditingSubElementName] = useState<string>('');
  const selectedSubElementIdRef = useRef<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<'icon' | 'icon2' | 'icon3' | 'category' | 'subCategory' | 'subElement' | 'backgroundIcon' | 'domainTabIcon' | 'zone' | 'template' | 'domainIcon' | null>(null);
  const [iconPickerContext, setIconPickerContext] = useState<{ type: 'category' | 'subCategory' | 'domainTabIcon' | 'zone' | 'template' | 'domainIcon'; id?: string } | null>(null);

  // États pour le modal de liaison lors du changement de nom
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingNameChange, setPendingNameChange] = useState<{
    type: 'element' | 'subElement';
    id: string;
    newName: string;
  } | null>(null);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);

  // États pour la génération d'alertes (déclarés au niveau supérieur pour respecter les règles des hooks)
  const [alertGenStartDate, setAlertGenStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [alertGenEndDate, setAlertGenEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [alertGenCount, setAlertGenCount] = useState(10);
  const [alertGenSeverities, setAlertGenSeverities] = useState<{ fatal: boolean; critique: boolean; mineur: boolean }>({
    fatal: true,
    critique: true,
    mineur: true,
  });
  const [alertGenResponsiblePercent, setAlertGenResponsiblePercent] = useState(70);
  const [alertGenMinDuration, setAlertGenMinDuration] = useState(30);
  const [alertGenMaxDuration, setAlertGenMaxDuration] = useState(480);
  const [isGenerating, setIsGenerating] = useState(false);

  // État pour les dates exclues de la vue Stats (déclaré au niveau supérieur pour respecter les règles des hooks)
  const [newExcludedDate, setNewExcludedDate] = useState('');

  // Préférence pour le mode de coloration des onglets de domaine
  const [domainTabColorMode, setDomainTabColorMode] = useState<'dot' | 'square' | 'full' | 'border' | 'icon' | 'corner'>(() => {
    const saved = localStorage.getItem('domainTabColorMode');
    if (saved === 'square' || saved === 'full' || saved === 'border' || saved === 'icon' || saved === 'corner') return saved as 'dot' | 'square' | 'full' | 'border' | 'icon' | 'corner';
    return 'dot';
  });

  // Préférence pour l'icône de statut dans les onglets (mode 'icon')
  const [domainTabStatusIcon, setDomainTabStatusIcon] = useState<string>(() => {
    return localStorage.getItem('domainTabStatusIcon') || 'Warning';
  });

  // Préférence pour l'affichage des tuiles vertes (ok)
  // Préférences d'affichage et d'espacement (indépendantes par domaine/élément)
  const domainStorageKey = domain ? `domain_${domain.id}` : 'global';
  const elementStorageKey = element ? `element_${element.id}` : 'global';

  const [greenTilesAsColored, setGreenTilesAsColored] = useState(() => {
    const saved = domain ? localStorage.getItem(`greenTilesAsColored_${domainStorageKey}`) : localStorage.getItem('greenTilesAsColored');
    return saved === 'true';
  });

  // Préférence pour la position des catégories/sous-catégories horizontales
  const [horizontalCategoriesInline, setHorizontalCategoriesInline] = useState(() => {
    const saved = domain ? localStorage.getItem(`horizontalCategoriesInline_${domainStorageKey}`) : localStorage.getItem('horizontalCategoriesInline');
    return saved === 'true';
  });

  // Préférence pour la position des sous-catégories horizontales (indépendante par élément)
  const [horizontalSubCategoriesInline, setHorizontalSubCategoriesInline] = useState(() => {
    const saved = element ? localStorage.getItem(`horizontalSubCategoriesInline_${elementStorageKey}`) : localStorage.getItem('horizontalSubCategoriesInline');
    return saved === 'true';
  });

  const [horizontalSpacing, setHorizontalSpacing] = useState(() => {
    const saved = domain ? localStorage.getItem(`horizontalSpacing_${domainStorageKey}`) : localStorage.getItem('horizontalSpacing');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [categorySpacing, setCategorySpacing] = useState(() => {
    const saved = domain ? localStorage.getItem(`categorySpacing_${domainStorageKey}`) : localStorage.getItem('categorySpacing');
    return saved ? parseInt(saved, 10) : 80;
  });
  const [verticalCategoryWidth, setVerticalCategoryWidth] = useState(() => {
    const saved = domain ? localStorage.getItem(`verticalCategoryWidth_${domainStorageKey}`) : localStorage.getItem('verticalCategoryWidth');
    return saved ? parseInt(saved, 10) : 200;
  });
  const [elementHorizontalSpacing, setElementHorizontalSpacing] = useState(() => {
    const saved = element ? localStorage.getItem(`horizontalSpacing_${elementStorageKey}`) : localStorage.getItem('horizontalSpacing');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [subCategorySpacing, setSubCategorySpacing] = useState(() => {
    const saved = element ? localStorage.getItem(`subCategorySpacing_${elementStorageKey}`) : localStorage.getItem('subCategorySpacing');
    return saved ? parseInt(saved, 10) : 80;
  });
  // Preferences specifiques a la vue grille
  const [gridViewMode, setGridViewMode] = useState<'expanded' | 'collapsed'>(() => {
    if (domain) {
      return (localStorage.getItem(`gridViewMode_${domain.id}`) as 'expanded' | 'collapsed') || 'expanded';
    }
    return 'expanded';
  });
  const [gridCellSpacing, setGridCellSpacing] = useState(() => {
    return parseInt(localStorage.getItem(`gridCellSpacing_${domainStorageKey}`) || '4', 10);
  });
  const [gridCategorySpacing, setGridCategorySpacing] = useState(() => {
    return parseInt(localStorage.getItem(`gridCategorySpacing_${domainStorageKey}`) || '0', 10);
  });
  const [gridCategoryColumnWidth, setGridCategoryColumnWidth] = useState(() => {
    return parseInt(localStorage.getItem(`gridCategoryColumnWidth_${domainStorageKey}`) || '250', 10);
  });

  const [verticalSubCategoryWidth, setVerticalSubCategoryWidth] = useState(() => {
    const saved = element ? localStorage.getItem(`verticalSubCategoryWidth_${elementStorageKey}`) : localStorage.getItem('verticalSubCategoryWidth');
    return saved ? parseInt(saved, 10) : 200;
  });

  // Charger la liste des utilisateurs quand on ouvre la section cockpit
  useEffect(() => {
    if (activeSection === 'cockpit' && users.length === 0 && !isLoadingUsers) {
      setIsLoadingUsers(true);
      fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          setUsers(data);
          setIsLoadingUsers(false);
        })
        .catch(err => {
          console.error('Erreur chargement utilisateurs:', err);
          setIsLoadingUsers(false);
        });
    }
  }, [activeSection, users.length, isLoadingUsers, token]);

  // Synchroniser les valeurs depuis localStorage quand on ouvre les sections ou change de domaine/élément
  useEffect(() => {
    // Mettre à jour les préférences d'affichage quand le domaine change
    if (domain) {
      const savedGreenTiles = localStorage.getItem(`greenTilesAsColored_${domainStorageKey}`);
      setGreenTilesAsColored(savedGreenTiles === 'true');
      const savedHorizontalCategories = localStorage.getItem(`horizontalCategoriesInline_${domainStorageKey}`);
      setHorizontalCategoriesInline(savedHorizontalCategories === 'true');
    }

    const handleDomainSpacingChange = () => {
      if (domain) {
        setHorizontalSpacing(parseInt(localStorage.getItem(`horizontalSpacing_${domainStorageKey}`) || '50', 10));
        setCategorySpacing(parseInt(localStorage.getItem(`categorySpacing_${domainStorageKey}`) || '80', 10));
        setVerticalCategoryWidth(parseInt(localStorage.getItem(`verticalCategoryWidth_${domainStorageKey}`) || '200', 10));
      }
    };
    const handleDomainDisplayChange = () => {
      if (domain) {
        const savedGreenTiles = localStorage.getItem(`greenTilesAsColored_${domainStorageKey}`);
        setGreenTilesAsColored(savedGreenTiles === 'true');
        const savedHorizontalCategories = localStorage.getItem(`horizontalCategoriesInline_${domainStorageKey}`);
        setHorizontalCategoriesInline(savedHorizontalCategories === 'true');
      }
    };
    const handleElementSpacingChange = () => {
      if (element) {
        setElementHorizontalSpacing(parseInt(localStorage.getItem(`horizontalSpacing_${elementStorageKey}`) || '50', 10));
        setSubCategorySpacing(parseInt(localStorage.getItem(`subCategorySpacing_${elementStorageKey}`) || '80', 10));
        setVerticalSubCategoryWidth(parseInt(localStorage.getItem(`verticalSubCategoryWidth_${elementStorageKey}`) || '200', 10));
        setHorizontalSubCategoriesInline(localStorage.getItem(`horizontalSubCategoriesInline_${elementStorageKey}`) === 'true');
      }
    };
    if (domain) {
      window.addEventListener(`spacingPreferenceChanged_${domainStorageKey}`, handleDomainSpacingChange);
      window.addEventListener(`verticalCategoryWidthChanged_${domainStorageKey}`, handleDomainSpacingChange);
      window.addEventListener(`greenTilesPreferenceChanged_${domainStorageKey}`, handleDomainDisplayChange);
      window.addEventListener(`horizontalCategoriesPreferenceChanged_${domainStorageKey}`, handleDomainDisplayChange);
    }
    if (element) {
      window.addEventListener(`spacingPreferenceChanged_${elementStorageKey}`, handleElementSpacingChange);
      window.addEventListener(`verticalSubCategoryWidthChanged_${elementStorageKey}`, handleElementSpacingChange);
    }
    return () => {
      if (domain) {
        window.removeEventListener(`spacingPreferenceChanged_${domainStorageKey}`, handleDomainSpacingChange);
        window.removeEventListener(`verticalCategoryWidthChanged_${domainStorageKey}`, handleDomainSpacingChange);
        window.removeEventListener(`greenTilesPreferenceChanged_${domainStorageKey}`, handleDomainDisplayChange);
        window.removeEventListener(`horizontalCategoriesPreferenceChanged_${domainStorageKey}`, handleDomainDisplayChange);
      }
      if (element) {
        window.removeEventListener(`spacingPreferenceChanged_${elementStorageKey}`, handleElementSpacingChange);
        window.removeEventListener(`verticalSubCategoryWidthChanged_${elementStorageKey}`, handleElementSpacingChange);
        window.removeEventListener(`horizontalSubCategoriesPreferenceChanged_${elementStorageKey}`, handleElementSpacingChange);
      }
    };
  }, [domain?.id, element?.id, domainStorageKey, elementStorageKey]);

  // États pour la configuration de l'image de fond (MapView et BackgroundView)
  const [imageUrl, setImageUrl] = useState(domain?.backgroundImage || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    detected: boolean;
    region?: string;
    confidence?: string;
    description?: string;
  } | null>(null);
  const [gpsForm, setGpsForm] = useState({
    topLeftLat: domain?.mapBounds?.topLeft.lat?.toString() || '',
    topLeftLng: domain?.mapBounds?.topLeft.lng?.toString() || '',
    bottomRightLat: domain?.mapBounds?.bottomRight.lat?.toString() || '',
    bottomRightLng: domain?.mapBounds?.bottomRight.lng?.toString() || '',
  });

  // Mettre à jour les états quand le domaine change
  useEffect(() => {
    if (domain) {
      setImageUrl(domain.backgroundImage || '');
      setGpsForm({
        topLeftLat: domain.mapBounds?.topLeft.lat?.toString() || '',
        topLeftLng: domain.mapBounds?.topLeft.lng?.toString() || '',
        bottomRightLat: domain.mapBounds?.bottomRight.lat?.toString() || '',
        bottomRightLng: domain.mapBounds?.bottomRight.lng?.toString() || '',
      });
    }
  }, [domain?.id, domain?.backgroundImage, domain?.mapBounds]);

  // Fonction de validation d'image base64

  // Analyser l'image avec l'IA pour détecter les coordonnées GPS (MapView uniquement)
  const analyzeMapImage = async () => {
    if (!domain || !imageUrl) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const isBase64 = imageUrl.startsWith('data:');

      const response = await fetch('/api/ai/analyze-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(
          isBase64
            ? { imageBase64: imageUrl }
            : { imageUrl: imageUrl }
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'analyse');
      }

      if (result.detected && result.topLeft && result.bottomRight) {
        setGpsForm({
          topLeftLat: result.topLeft.lat.toString(),
          topLeftLng: result.topLeft.lng.toString(),
          bottomRightLat: result.bottomRight.lat.toString(),
          bottomRightLng: result.bottomRight.lng.toString(),
        });

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

  // Sauvegarder les coordonnées GPS
  const saveGpsBounds = () => {
    if (!domain) return;

    const lat1 = parseFloat(gpsForm.topLeftLat);
    const lng1 = parseFloat(gpsForm.topLeftLng);
    const lat2 = parseFloat(gpsForm.bottomRightLat);
    const lng2 = parseFloat(gpsForm.bottomRightLng);

    if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
      const bounds: MapBounds = {
        topLeft: { lat: lat1, lng: lng1 },
        bottomRight: { lat: lat2, lng: lng2 },
      };
      updateMapBounds(domain.id, bounds);
    }
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  // Gestion du changement de nom avec détection de doublons et liaison
  const handleElementNameChange = (elementId: string, newName: string, currentName: string) => {
    if (newName === currentName) return;

    // Chercher si le nouveau nom existe déjà
    const matches = findElementsByName(newName).filter(m => m.element.id !== elementId);

    if (matches.length > 0) {
      // Des éléments avec ce nom existent → afficher le modal
      setPendingNameChange({ type: 'element', id: elementId, newName });
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
      // Pas de doublon → appliquer directement le changement
      updateElement(elementId, { name: newName });
    }
  };

  const handleSubElementNameChange = (subElementId: string, newName: string, currentName: string) => {
    if (newName === currentName) return;

    // Chercher si le nouveau nom existe déjà
    const matches = findSubElementsByName(newName).filter(m => m.subElement.id !== subElementId);

    if (matches.length > 0) {
      // Des sous-éléments avec ce nom existent → afficher le modal
      setPendingNameChange({ type: 'subElement', id: subElementId, newName });
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
      // Pas de doublon → appliquer directement le changement
      updateSubElement(subElementId, { name: newName });
      if (selectedSubElement && selectedSubElement.id === subElementId) {
        setSelectedSubElement({ ...selectedSubElement, name: newName });
      }
    }
  };

  const handleCreateIndependent = () => {
    if (!pendingNameChange) return;

    if (pendingNameChange.type === 'element') {
      updateElement(pendingNameChange.id, { name: pendingNameChange.newName });
    } else {
      updateSubElement(pendingNameChange.id, { name: pendingNameChange.newName });
      if (selectedSubElement && selectedSubElement.id === pendingNameChange.id) {
        setSelectedSubElement({ ...selectedSubElement, name: pendingNameChange.newName });
      }
    }

    setShowLinkModal(false);
    setPendingNameChange(null);
    setExistingMatches([]);
  };

  const handleCreateLinked = (linkedGroupId: string, linkSubElements?: boolean) => {
    if (!pendingNameChange) return;

    // Trouver l'élément/sous-élément source pour copier son contenu
    const sourceMatch = existingMatches.find(m => m.linkedGroupId === linkedGroupId || m.id === linkedGroupId);
    const sourceId = sourceMatch?.id;

    if (pendingNameChange.type === 'element') {
      // D'abord changer le nom
      updateElement(pendingNameChange.id, { name: pendingNameChange.newName });
      // Puis copier tout le contenu de l'élément source avec fusion des catégories/sous-éléments
      if (sourceId) {
        copyElementContent(pendingNameChange.id, sourceId, linkSubElements);
      }
    } else {
      // D'abord changer le nom
      updateSubElement(pendingNameChange.id, { name: pendingNameChange.newName });
      // Puis copier le contenu du sous-élément source
      if (sourceId) {
        copySubElementContent(pendingNameChange.id, sourceId);
      }
      if (selectedSubElement && selectedSubElement.id === pendingNameChange.id) {
        setSelectedSubElement({ ...selectedSubElement, name: pendingNameChange.newName });
      }
    }

    setShowLinkModal(false);
    setPendingNameChange(null);
    setExistingMatches([]);
  };

  // Trouver tous les sous-éléments de l'élément courant
  const allSubElements: SubElement[] = element?.subCategories?.flatMap(sc => sc.subElements) || [];

  // Ouvrir automatiquement la section "Statut (couleur)" quand on sélectionne un sous-élément
  useEffect(() => {
    if (selectedSubElement && activeSection !== 'status') {
      setActiveSection('status');
    }
  }, [selectedSubElement]);

  // Sélectionner automatiquement un sous-élément depuis l'extérieur (depuis un clic dans ElementView)
  useEffect(() => {
    if (selectedSubElementId && element) {
      // Trouver le sous-élément dans l'élément courant
      for (const subCategory of element.subCategories) {
        const foundSubElement = subCategory.subElements.find(se => se.id === selectedSubElementId);
        if (foundSubElement) {
          setSelectedSubElement(foundSubElement);
          setActiveSection('status'); // Ouvrir automatiquement la section statut
          break;
        }
      }
    }
  }, [selectedSubElementId, element]);

  // Référence pour savoir si on est en train d'éditer (le champ a le focus)
  const isEditingNameRef = useRef(false);

  // Synchroniser selectedSubElement avec les données du store après chaque mise à jour
  // Mais seulement si on n'est pas en train d'éditer
  useEffect(() => {
    if (selectedSubElementIdRef.current && element && !isEditingNameRef.current) {
      // Trouver le sous-élément mis à jour dans l'élément courant
      for (const subCategory of element.subCategories) {
        const updatedSubElement = subCategory.subElements.find(se => se.id === selectedSubElementIdRef.current);
        if (updatedSubElement) {
          // Si on est en train d'éditer le nom, on préserve la valeur locale
          if (editingSubElementName !== '' && updatedSubElement.id === selectedSubElementIdRef.current) {
            setSelectedSubElement(prev => prev ? { ...updatedSubElement, name: editingSubElementName } : updatedSubElement);
          } else {
            setSelectedSubElement(updatedSubElement);
            setEditingSubElementName(updatedSubElement.name);
          }
        }
      }
    }
  }, [element]);

  // Mettre à jour la référence et réinitialiser l'édition quand selectedSubElement change
  useEffect(() => {
    if (selectedSubElement) {
      selectedSubElementIdRef.current = selectedSubElement.id;
      setEditingSubElementName(selectedSubElement.name);
    } else {
      selectedSubElementIdRef.current = null;
      setEditingSubElementName('');
    }
  }, [selectedSubElement?.id]);

  // Édition d'un sous-élément
  if (selectedSubElement) {
    // Ouvrir automatiquement la section "Statut (couleur)" pour les sous-éléments
    const subElementActiveSection = activeSection || 'status';

    return (
      <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <div className="flex items-start justify-between">
            <div>
              <button
                onClick={() => {
                  setSelectedSubElement(null);
                  setActiveSection(null);
                }}
                className="flex items-center gap-2 text-[#64748B] hover:text-[#1E3A5F] mb-2"
              >
                <div className="rotate-180"><MuiIcon name="ChevronRightIcon" size={16} /></div>
                Retour
              </button>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Édition sous-élément</h3>
              <p className="text-sm text-[#64748B]">{selectedSubElement.name}</p>
            </div>
            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Supprimer le sous-élément',
                  message: `Voulez-vous supprimer le sous-élément "${selectedSubElement.name}" ?`,
                });
                if (confirmed) {
                  deleteSubElement(selectedSubElement.id);
                  setSelectedSubElement(null);
                }
              }}
              className="p-2 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer ce sous-élément"
            >
              <MuiIcon name="Delete" size={18} />
            </button>
          </div>
        </div>

        {/* Prévisualisation du sous-élément */}
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <h4 className="text-sm font-medium text-[#64748B] mb-3">Aperçu</h4>
          <div className="flex justify-center">
            <SubElementTile
              subElement={selectedSubElement}
              breadcrumb={{
                domain: domain?.name || '',
                category: element?.name || '',
                element: element?.name || '',
                subCategory: element?.subCategories.find(sc => sc.subElements.some(se => se.id === selectedSubElement.id))?.name || ''
              }}
              readOnly={true}
            />
          </div>
        </div>

        {/* Propriétés du sous-élément */}
        <Section
          title="Propriétés"
          iconName="SettingsIcon"
          isOpen={activeSection === 'properties'}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom</label>
              <input
                type="text"
                value={editingSubElementName}
                onChange={(e) => setEditingSubElementName(e.target.value)}
                onFocus={() => {
                  isEditingNameRef.current = true;
                }}
                onBlur={(e) => {
                  isEditingNameRef.current = false;
                  if (selectedSubElement && e.target.value.trim()) {
                    handleSubElementNameChange(selectedSubElement.id, e.target.value.trim(), selectedSubElement.name);
                  }
                }}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Valeur</label>
                <EditableInput

                  value={selectedSubElement.value || ''}
                  onChange={(v) => {
                    updateSubElement(selectedSubElement.id, { value: v });
                    setSelectedSubElement({ ...selectedSubElement, value: v });
                  }}
                  placeholder="123"
                  allowEmpty={true}
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Unité</label>
                <EditableInput

                  value={selectedSubElement.unit || ''}
                  onChange={(v) => {
                    updateSubElement(selectedSubElement.id, { unit: v });
                    setSelectedSubElement({ ...selectedSubElement, unit: v });
                  }}
                  placeholder="kg"
                  allowEmpty={true}
                />
              </div>
            </div>

            {/* Icône du sous-élément */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Icône</label>
              <button
                onClick={() => setShowIconPicker('subElement')}
                className="w-full flex items-center gap-3 px-3 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
              >
                {selectedSubElement.icon ? (
                  <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                    <MuiIcon name={selectedSubElement.icon} size={20} className="text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-[#E2E8F0] rounded-lg flex items-center justify-center">
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  </div>
                )}
                <span className="text-sm truncate flex-1">
                  {selectedSubElement.icon
                    ? (isCustomIcon(selectedSubElement.icon) ? '📷 Image personnalisée' : selectedSubElement.icon)
                    : 'Choisir une icône...'}
                </span>
              </button>
            </div>

            {/* Liaison du sous-élément */}
            <div className="border-t border-[#E2E8F0] pt-4 mt-4">
              <label className="block text-sm text-[#64748B] mb-2">Liaison</label>
              {selectedSubElement.linkedGroupId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <MuiIcon name="Link" size={16} className="text-blue-600" />
                    <span className="text-sm text-blue-800">Ce sous-élément est lié</span>
                  </div>
                  
                  {/* Liste des sous-éléments liés */}
                  {(() => {
                    const linkedSubElements = getLinkedSubElements(selectedSubElement.id);
                    if (linkedSubElements.length === 0) return null;
                    
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-[#64748B] font-medium">Lié avec :</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {linkedSubElements.map(item => (
                            <div 
                              key={item.subElement.id} 
                              className="flex items-center justify-between gap-2 p-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg group hover:bg-blue-50 hover:border-blue-200 transition-colors"
                            >
                              <button
                                onClick={() => {
                                  // Naviguer vers ce sous-élément
                                  setCurrentDomain(item.domainId);
                                  setCurrentElement(item.elementId);
                                  // Laisser le temps au changement de domaine/élément avant de sélectionner le sous-élément
                                  setTimeout(() => {
                                    setSelectedSubElement(item.subElement);
                                  }, 50);
                                }}
                                className="flex-1 text-left text-xs text-[#1E3A5F] hover:text-blue-600 truncate"
                                title={`${item.domainName} / ${item.categoryName} / ${item.elementName} / ${item.subCategoryName} / ${item.subElement.name}`}
                              >
                                <span className="text-[#64748B]">{item.domainName} / {item.categoryName} / {item.elementName} / </span>
                                <span className="font-medium">{item.subElement.name}</span>
                              </button>
                              <button
                                onClick={() => {
                                  unlinkSubElement(item.subElement.id);
                                }}
                                className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                title="Délier ce sous-élément"
                              >
                                <MuiIcon name="LinkOff" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Ajouter une nouvelle liaison */}
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <select
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const targetId = e.target.value;
                          linkSubElement(selectedSubElement.id, targetId);
                          setSelectedSubElement({ ...selectedSubElement, linkedGroupId: targetId });
                        }
                      }}
                    >
                      <option value="">Lier à un autre sous-élément...</option>
                      {getAllSubElements()
                        .filter(item => item.subElement.id !== selectedSubElement.id && item.subElement.linkedGroupId !== selectedSubElement.linkedGroupId)
                        .map(item => (
                          <option key={item.subElement.id} value={item.subElement.linkedGroupId || item.subElement.id}>
                            {item.domainName} / {item.categoryName} / {item.elementName} / {item.subCategoryName} / {item.subElement.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => {
                      unlinkSubElement(selectedSubElement.id);
                      setSelectedSubElement({ ...selectedSubElement, linkedGroupId: undefined });
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-orange-300 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <MuiIcon name="LinkOff" size={16} />
                    <span className="text-sm">Délier ce sous-élément de tous</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#94A3B8]">Ce sous-élément n'est pas lié.</p>
                  <select
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const targetId = e.target.value;
                        linkSubElement(selectedSubElement.id, targetId);
                        setSelectedSubElement({ ...selectedSubElement, linkedGroupId: targetId });
                      }
                    }}
                  >
                    <option value="">Lier à un autre sous-élément...</option>
                    {getAllSubElements()
                      .filter(item => item.subElement.id !== selectedSubElement.id)
                      .map(item => (
                        <option key={item.subElement.id} value={item.subElement.linkedGroupId || item.subElement.id}>
                          {item.domainName} / {item.categoryName} / {item.elementName} / {item.subCategoryName} / {item.subElement.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Changer la sous-catégorie */}
            {element && element.subCategories.length > 1 && (
              <div className="border-t border-[#E2E8F0] pt-4 mt-4">
                <label className="block text-sm text-[#64748B] mb-2">Sous-catégorie</label>
                <select
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  value={selectedSubElement.subCategoryId}
                  onChange={(e) => {
                    if (e.target.value && e.target.value !== selectedSubElement.subCategoryId) {
                      moveSubElementToSubCategory(selectedSubElement.id, e.target.value);
                    }
                  }}
                >
                  {element.subCategories.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sélecteur d'icônes pour les sous-éléments */}
          {showIconPicker === 'subElement' && selectedSubElement && (
            <IconPicker
              value={selectedSubElement.icon}
              onChange={(iconName) => {
                updateSubElement(selectedSubElement.id, { icon: iconName });
                setSelectedSubElement({ ...selectedSubElement, icon: iconName });
              }}
              onClose={() => setShowIconPicker(null)}
            />
          )}
        </Section>

        {/* Statut / Couleur du sous-élément */}
        <Section
          title="Statut (couleur)"
          iconName="Palette"
          isOpen={subElementActiveSection === 'status'}
          onToggle={() => toggleSection('status')}
        >
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(STATUS_COLORS) as TileStatus[]).filter(status => status !== 'herite').map((status) => (
              <button
                key={status}
                onClick={() => {
                  updateSubElement(selectedSubElement.id, { status });
                  setSelectedSubElement({ ...selectedSubElement, status });
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${selectedSubElement.status === status
                  ? `${STATUS_COLORS[status].bg} text-white`
                  : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                  }`}
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: STATUS_COLORS[status].hex }}
                />
                <span>{STATUS_LABELS[status]}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Alerte (uniquement si Fatal, Critique ou Mineur) */}
        {['fatal', 'critique', 'mineur'].includes(selectedSubElement.status) && (
          <Section
            title="Alerte"
            iconName="AlertTriangleIcon"
            isOpen={activeSection === 'alert'}
            onToggle={() => toggleSection('alert')}
          >
            <div className="space-y-4">
              <p className="text-xs text-[#94A3B8]">
                Cette alerte s'affichera quand l'utilisateur clique sur le sous-élément.
              </p>

              <div>
                <label className="block text-sm text-[#64748B] mb-1">Description de l'alerte</label>
                <textarea
                  value={selectedSubElement.alert?.description || ''}
                  onChange={(e) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: e.target.value,
                      duration: selectedSubElement.alert?.duration,
                      ticketNumber: selectedSubElement.alert?.ticketNumber,
                      actions: selectedSubElement.alert?.actions,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="Description du problème..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-[#64748B] mb-1">Durée</label>
                <EditableInput

                  value={selectedSubElement.alert?.duration || ''}
                  onChange={(v) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: selectedSubElement.alert?.description || '',
                      duration: v,
                      ticketNumber: selectedSubElement.alert?.ticketNumber,
                      actions: selectedSubElement.alert?.actions,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="ex: 2h 30m"
                  allowEmpty={true}
                />
              </div>

              <div>
                <label className="block text-sm text-[#64748B] mb-1">Numéro de ticket</label>
                <EditableInput

                  value={selectedSubElement.alert?.ticketNumber || ''}
                  onChange={(v) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: selectedSubElement.alert?.description || '',
                      duration: selectedSubElement.alert?.duration,
                      ticketNumber: v,
                      actions: selectedSubElement.alert?.actions,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  allowEmpty={true}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#64748B] mb-1">Actions suggérées</label>
                <textarea
                  value={selectedSubElement.alert?.actions || ''}
                  onChange={(e) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: selectedSubElement.alert?.description || '',
                      duration: selectedSubElement.alert?.duration,
                      ticketNumber: selectedSubElement.alert?.ticketNumber,
                      actions: e.target.value,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="Actions à entreprendre..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
                />
              </div>

              {selectedSubElement.alert?.description && (
                <button
                  onClick={() => {
                    updateSubElement(selectedSubElement.id, { alert: undefined });
                    setSelectedSubElement({ ...selectedSubElement, alert: undefined });
                  }}
                  className="w-full px-3 py-2 text-[#E57373] hover:bg-red-50 rounded-lg text-sm transition-colors border border-[#E57373]/30"
                >
                  Supprimer l'alerte
                </button>
              )}
            </div>
          </Section>
        )}

        {/* Sources et calculs */}
        <Section
          title="Sources et calculs"
          iconName="Database"
          isOpen={activeSection === 'sources-calculations'}
          onToggle={() => toggleSection('sources-calculations')}
        >
          <SourcesAndCalculationsPanel
            subElement={selectedSubElement}
            onUpdate={(updates) => {
              updateSubElement(selectedSubElement.id, updates);
              setSelectedSubElement({ ...selectedSubElement, ...updates });
            }}
          />
        </Section>

        {/* Modal de liaison lors du changement de nom */}
        {showLinkModal && pendingNameChange && (
          <LinkElementModal
            type={pendingNameChange.type}
            newItemName={pendingNameChange.newName}
            existingMatches={existingMatches}
            onLink={handleCreateLinked}
            onIndependent={handleCreateIndependent}
            onCancel={() => {
              setShowLinkModal(false);
              setPendingNameChange(null);
              setExistingMatches([]);
            }}
          />
        )}
      </div>
    );
  }

  // Édition d'un élément
  if (element) {
    return (
      <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Édition élément</h3>
              <p className="text-sm text-[#64748B]">{element.name}</p>
            </div>
            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Supprimer l\'élément',
                  message: `Voulez-vous supprimer l'élément "${element.name}" et tous ses sous-éléments ?`,
                });
                if (confirmed) {
                  deleteElement(element.id);
                  setCurrentElement(null);
                }
              }}
              className="p-2 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer cet élément"
            >
              <MuiIcon name="Delete" size={18} />
            </button>
          </div>
        </div>

        {/* Prévisualisation de l'élément */}
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <h4 className="text-sm font-medium text-[#64748B] mb-3">Aperçu</h4>
          <div className="flex justify-center">
            <ElementTile
              element={element}
              mini={false}
              readOnly={true}
            />
          </div>
        </div>

        {/* Propriétés */}
        <Section
          title="Propriétés"
          iconName="SettingsIcon"
          isOpen={activeSection === 'properties'}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom</label>
              <EditableInput value={element.name} onChange={(v) => handleElementNameChange(element.id, v, element.name)} className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Valeur</label>
                <EditableInput value={element.value || ""} onChange={(v) => updateElement(element.id, { value: v })} placeholder="123" allowEmpty={true} className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Unité</label>
                <EditableInput value={element.unit || ""} onChange={(v) => updateElement(element.id, { unit: v })} placeholder="kg" allowEmpty={true} className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`element-publiable-${element.id}`}
                checked={element.publiable !== false}
                onChange={(e) => updateElement(element.id, { publiable: e.target.checked })}
                className="w-4 h-4 text-[#1E3A5F] border-[#E2E8F0] rounded focus:ring-[#1E3A5F]"
              />
              <label htmlFor={`element-publiable-${element.id}`} className="text-sm text-[#64748B] cursor-pointer">
                Publiable
              </label>
            </div>

            {/* Icônes - Sélection via Material Icons */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Icône principale</label>
              <button
                onClick={() => setShowIconPicker('icon')}
                className="w-full flex items-center gap-3 px-3 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
              >
                {element.icon ? (
                  <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                    <MuiIcon name={element.icon} size={20} className="text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-[#E2E8F0] rounded-lg flex items-center justify-center">
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  </div>
                )}
                <span className="text-sm truncate flex-1">
                  {element.icon
                    ? (isCustomIcon(element.icon) ? '📷 Image personnalisée' : element.icon)
                    : 'Choisir une icône...'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-2">Icône 2</label>
                <button
                  onClick={() => setShowIconPicker('icon2')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
                >
                  {element.icon2 ? (
                    <MuiIcon name={element.icon2} size={18} className="text-[#1E3A5F]" />
                  ) : (
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  )}
                  <span className="text-xs truncate flex-1">
                    {element.icon2
                      ? (isCustomIcon(element.icon2) ? '📷 Image' : element.icon2)
                      : 'Choisir...'}
                  </span>
                </button>
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-2">Icône 3</label>
                <button
                  onClick={() => setShowIconPicker('icon3')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
                >
                  {element.icon3 ? (
                    <MuiIcon name={element.icon3} size={18} className="text-[#1E3A5F]" />
                  ) : (
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  )}
                  <span className="text-xs truncate flex-1">
                    {element.icon3
                      ? (isCustomIcon(element.icon3) ? '📷 Image' : element.icon3)
                      : 'Choisir...'}
                  </span>
                </button>
              </div>
            </div>

            {/* Liaison de l'élément */}
            <div className="border-t border-[#E2E8F0] pt-4 mt-4">
              <label className="block text-sm text-[#64748B] mb-2">Liaison</label>
              {element.linkedGroupId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <MuiIcon name="Link" size={16} className="text-blue-600" />
                    <span className="text-sm text-blue-800">Cet élément est lié</span>
                  </div>
                  
                  {/* Liste des éléments liés */}
                  {(() => {
                    const linkedElements = getLinkedElements(element.id);
                    if (linkedElements.length === 0) return null;
                    
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-[#64748B] font-medium">Lié avec :</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {linkedElements.map(item => (
                            <div 
                              key={item.element.id} 
                              className="flex items-center justify-between gap-2 p-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg group hover:bg-blue-50 hover:border-blue-200 transition-colors"
                            >
                              <button
                                onClick={() => {
                                  // Naviguer vers cet élément
                                  setCurrentDomain(item.domainId);
                                  setCurrentElement(item.element.id);
                                }}
                                className="flex-1 text-left text-xs text-[#1E3A5F] hover:text-blue-600 truncate"
                                title={`${item.domainName} / ${item.categoryName} / ${item.element.name}`}
                              >
                                <span className="text-[#64748B]">{item.domainName} / {item.categoryName} / </span>
                                <span className="font-medium">{item.element.name}</span>
                              </button>
                              <button
                                onClick={() => {
                                  unlinkElement(item.element.id);
                                }}
                                className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                title="Délier cet élément"
                              >
                                <MuiIcon name="LinkOff" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Ajouter une nouvelle liaison */}
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <select
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          linkElement(element.id, e.target.value);
                        }
                      }}
                    >
                      <option value="">Lier à un autre élément...</option>
                      {getAllElements()
                        .filter(item => item.element.id !== element.id && item.element.linkedGroupId !== element.linkedGroupId)
                        .map(item => (
                          <option key={item.element.id} value={item.element.linkedGroupId || item.element.id}>
                            {item.domainName} / {item.categoryName} / {item.element.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => unlinkElement(element.id)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-orange-300 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <MuiIcon name="LinkOff" size={16} />
                    <span className="text-sm">Délier cet élément de tous</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#94A3B8]">Cet élément n'est pas lié.</p>
                  <select
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        linkElement(element.id, e.target.value);
                      }
                    }}
                  >
                    <option value="">Lier à un autre élément...</option>
                    {getAllElements()
                      .filter(item => item.element.id !== element.id)
                      .map(item => (
                        <option key={item.element.id} value={item.element.linkedGroupId || item.element.id}>
                          {item.domainName} / {item.categoryName} / {item.element.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Changer ou créer une catégorie */}
            {domain && domain.categories.length >= 1 && (
              <div className="border-t border-[#E2E8F0] pt-4 mt-4">
                <label className="block text-sm text-[#64748B] mb-2">Catégorie</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    value={element.categoryId}
                    onChange={(e) => {
                      if (e.target.value && e.target.value !== element.categoryId) {
                        moveElementToCategory(element.id, e.target.value);
                      }
                    }}
                  >
                    {domain.categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const categoryName = prompt('Nom de la nouvelle catégorie:');
                      if (categoryName && categoryName.trim()) {
                        addCategory(domain.id, categoryName.trim(), 'horizontal');
                        // Attendre la création puis déplacer l'élément
                        setTimeout(() => {
                          const updatedDomain = useCockpitStore.getState().currentCockpit?.domains.find(d => d.id === domain.id);
                          const newCategory = updatedDomain?.categories.find(c => c.name === categoryName.trim());
                          if (newCategory) {
                            moveElementToCategory(element.id, newCategory.id);
                          }
                        }, 100);
                      }
                    }}
                    className="px-3 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2d5a8f] transition-colors flex items-center gap-1"
                    title="Créer une nouvelle catégorie et y déplacer l'élément"
                  >
                    <MuiIcon name="Add" size={16} />
                  </button>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Déplacez l'élément vers une autre catégorie ou créez-en une nouvelle
                </p>
              </div>
            )}

            {/* Template */}
            <div className="border-t border-[#E2E8F0] pt-4 mt-4">
              <label className="block text-sm text-[#64748B] mb-2">Template</label>
              {(() => {
                const allElements = getAllElements();
                const existingTemplates = [...new Set(
                  allElements
                    .map(item => item.element.template)
                    .filter((t): t is string => !!t)
                )].sort();
                
                return (
                  <div className="flex gap-2">
                    <select
                      value={element.template || ""}
                      onChange={(e) => {
                        const newTemplate = e.target.value;
                        const oldTemplate = element.template;
                        
                        // Mettre à jour le template
                        updateElement(element.id, { template: newTemplate || undefined });
                        
                        // Si on définit un nouveau template existant, copier la structure
                        if (newTemplate && newTemplate !== oldTemplate) {
                          const sourceElement = allElements.find(
                            item => item.element.id !== element.id && item.element.template === newTemplate
                          );
                          if (sourceElement) {
                            copyElementContent(element.id, sourceElement.element.id, false);
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    >
                      <option value="">Aucun template</option>
                      {existingTemplates.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const newTemplate = prompt('Nom du nouveau template:');
                        if (newTemplate && newTemplate.trim()) {
                          updateElement(element.id, { template: newTemplate.trim() });
                        }
                      }}
                      className="px-3 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2d5a8f] transition-colors flex items-center gap-1"
                      title="Créer un nouveau template"
                    >
                      <MuiIcon name="Add" size={16} />
                    </button>
                  </div>
                );
              })()}
              <p className="text-xs text-[#94A3B8] mt-1">
                Associer un template copie les sous-catégories et sous-éléments d'un élément existant avec le même template
              </p>

              {/* Icônes des templates */}
              {(() => {
                const allElements = getAllElements();
                const existingTemplates = [...new Set(
                  allElements
                    .map(item => item.element.template)
                    .filter((t): t is string => !!t)
                )].sort();
                
                if (existingTemplates.length === 0) return null;
                
                return (
                  <div className="border-t border-[#E2E8F0] pt-3 mt-3">
                    <p className="text-xs text-[#64748B] mb-2">Icônes des templates</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {existingTemplates.map((templateName) => {
                        const templateIcon = currentCockpit?.templateIcons?.[templateName];
                        return (
                          <div key={templateName} className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg">
                            <button
                              onClick={() => {
                                setIconPickerContext({ type: 'template', id: templateName });
                                setShowIconPicker('template');
                              }}
                              className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded border border-[#E2E8F0] hover:border-[#1E3A5F] transition-colors cursor-pointer"
                              title="Choisir une icône"
                            >
                              {templateIcon ? (
                                <MuiIcon name={templateIcon} size={18} className="text-[#1E3A5F]" />
                              ) : (
                                <MuiIcon name="Add" size={18} className="text-[#94A3B8]" />
                              )}
                            </button>
                            <span className="flex-1 text-sm text-[#1E3A5F] truncate">{templateName}</span>
                            {templateIcon && (
                              <button
                                onClick={() => updateTemplateIcon(templateName, undefined)}
                                className="p-1 text-[#94A3B8] hover:text-red-500 transition-colors"
                                title="Supprimer l'icône"
                              >
                                <MuiIcon name="Close" size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sélecteur d'icônes pour les templates */}
                    {showIconPicker === 'template' && iconPickerContext?.type === 'template' && iconPickerContext.id && (
                      <IconPicker
                        value={currentCockpit?.templateIcons?.[iconPickerContext.id]}
                        onChange={(iconName) => {
                          updateTemplateIcon(iconPickerContext.id!, iconName);
                        }}
                        onClose={() => {
                          setShowIconPicker(null);
                          setIconPickerContext(null);
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Sélecteur d'icônes */}
            {showIconPicker === 'icon' && (
              <IconPicker
                value={element.icon}
                onChange={(iconName) => updateElement(element.id, { icon: iconName })}
                onClose={() => setShowIconPicker(null)}
              />
            )}
            {showIconPicker === 'icon2' && (
              <IconPicker
                value={element.icon2}
                onChange={(iconName) => updateElement(element.id, { icon2: iconName })}
                onClose={() => setShowIconPicker(null)}
              />
            )}
            {showIconPicker === 'icon3' && (
              <IconPicker
                value={element.icon3}
                onChange={(iconName) => updateElement(element.id, { icon3: iconName })}
                onClose={() => setShowIconPicker(null)}
              />
            )}
          </div>
        </Section>

        {/* Image de fond pour l'élément */}
        <Section
          title="Image de fond"
          iconName="Image"
          isOpen={activeSection === 'element-background'}
          onToggle={() => toggleSection('element-background')}
        >
          <div className="space-y-4">
            {/* Zone de sélection de fichier */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Charger une image</label>
              <label
                htmlFor={`element-bg-upload-${element.id}`}
                className="block p-4 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors cursor-pointer"
              >
                <input
                  type="file"
                  accept="image/*"
                  id={`element-bg-upload-${element.id}`}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const maxSizeMB = 25; // Augmenté à 25MB (Redis supporte 50MB)
                      const maxSizeBytes = maxSizeMB * 1024 * 1024;
                      if (file.size > maxSizeBytes) {
                        alert(`Erreur: Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). La taille maximale autorisée est de ${maxSizeMB} MB.`);
                        e.target.value = '';
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const base64 = event.target?.result as string;
                        const base64SizeMB = base64.length / 1024 / 1024;
                        if (base64SizeMB > 35) {
                          alert(`Erreur: L'image encodée est trop volumineuse (${base64SizeMB.toFixed(2)} MB). Veuillez utiliser une image plus petite (max 35 MB encodé).`);
                          return;
                        }
                        console.log(`[EditorPanel] 📸 Upload image élément: ${base64SizeMB.toFixed(2)} MB`);
                        updateElement(element.id, { backgroundImage: base64 });
                        // Forcer la sauvegarde immédiate
                        const saved = await forceSave();
                        if (!saved) {
                          alert('Attention: L\'image a été chargée mais la sauvegarde a échoué.');
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                  <MuiIcon name="Upload" size={24} className="mb-2" />
                  <span className="text-xs font-medium">Cliquez pour choisir un fichier</span>
                  <span className="text-[10px] text-[#94A3B8] mt-1">PNG, JPG, GIF jusqu'à 10MB</span>
                </div>
              </label>
            </div>

            {/* Séparateur */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-xs text-[#94A3B8]">ou</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>

            {/* URL alternative */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">URL de l'image</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={element.backgroundImage && !element.backgroundImage.startsWith('data:') ? element.backgroundImage : ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    if (url.trim()) {
                      updateElement(element.id, { backgroundImage: url.trim() });
                    }
                  }}
                  placeholder="https://exemple.com/image.png"
                  className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              {element.backgroundImage && !element.backgroundImage.startsWith('data:') && (
                <button
                  onClick={() => {
                    if (element.backgroundImage) {
                      updateElement(element.id, { backgroundImage: element.backgroundImage });
                    }
                  }}
                  className="mt-2 w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] text-sm"
                >
                  Enregistrer l'URL
                </button>
              )}
            </div>

            {/* Aperçu et options */}
            {element.backgroundImage && (
              <div className="space-y-3">
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                  <img
                    src={element.backgroundImage}
                    alt="Aperçu"
                    className="max-h-32 rounded border border-[#E2E8F0] mx-auto w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {element.backgroundImage.startsWith('data:') && (
                    <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                      <MuiIcon name="CheckCircle" size={12} />
                      Fichier chargé
                    </p>
                  )}
                </div>

                {/* Opacité de l'image */}
                <div>
                  <label className="block text-sm text-[#64748B] mb-2">
                    Opacité de l'image ({element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}
                    onChange={(e) => updateElement(element.id, { backgroundImageOpacity: Number(e.target.value) })}
                    className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #1E3A5F 0%, #1E3A5F ${element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}%, #E2E8F0 ${element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}%, #E2E8F0 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-[#64748B] mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Mode d'affichage */}
                <div>
                  <p className="text-xs text-[#64748B] mb-2">Position de l'image</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateElement(element.id, { backgroundMode: 'behind' })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${(!element.backgroundMode || element.backgroundMode === 'behind')
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                        }`}
                    >
                      En dessous
                    </button>
                    <button
                      onClick={() => updateElement(element.id, { backgroundMode: 'overlay' })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${element.backgroundMode === 'overlay'
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                        }`}
                    >
                      Au dessus
                    </button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">
                    {(!element.backgroundMode || element.backgroundMode === 'behind')
                      ? 'L\'image sera derrière les sous-catégories'
                      : 'L\'image sera par-dessus (transparente, sans gêner les clics)'}
                  </p>
                </div>

                <button
                  onClick={() => updateElement(element.id, { backgroundImage: undefined, backgroundMode: undefined, backgroundImageOpacity: undefined })}
                  className="w-full px-3 py-1.5 text-xs text-[#E57373] hover:bg-red-50 rounded-lg border border-[#E57373]/30 transition-colors flex items-center justify-center gap-1"
                >
                  <MuiIcon name="Delete" size={12} />
                  Supprimer l'image
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* Couleur / Statut */}
        <Section
          title="Statut (couleur)"
          iconName="Palette"
          isOpen={activeSection === 'status'}
          onToggle={() => toggleSection('status')}
        >
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(STATUS_COLORS) as TileStatus[]).filter(status => {
              // 'herite' uniquement si l'élément a des sous-catégories
              if (status === 'herite') return element.subCategories.length > 0;
              // 'herite_domaine' uniquement s'il y a des domaines disponibles
              if (status === 'herite_domaine') return currentCockpit && currentCockpit.domains.length > 0;
              return true;
            }).map((status) => (
              <button
                key={status}
                onClick={() => {
                  if (status === 'herite_domaine' && !element.inheritFromDomainId && currentCockpit?.domains.length) {
                    // Par défaut, sélectionner le premier domaine disponible
                    updateElement(element.id, { status, inheritFromDomainId: currentCockpit.domains[0].id });
                  } else {
                    updateElement(element.id, { status });
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${element.status === status
                  ? `${STATUS_COLORS[status].bg} text-white`
                  : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                  }`}
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: STATUS_COLORS[status].hex }}
                />
                <span>{STATUS_LABELS[status]}</span>
              </button>
            ))}
          </div>
          {/* Sélecteur de domaine pour le statut "Héritage Domaine" */}
          {element.status === 'herite_domaine' && currentCockpit && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <label className="block text-xs font-medium text-purple-800 mb-2">
                Domaine source de la couleur :
              </label>
              <select
                value={element.inheritFromDomainId || ''}
                onChange={(e) => updateElement(element.id, { inheritFromDomainId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-purple-300 rounded-lg bg-white text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">Sélectionner un domaine...</option>
                {currentCockpit.domains
                  .filter((d) => d.id !== domain?.id) // Exclure le domaine actuel pour éviter les références circulaires
                  .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-purple-600 mt-2">
                La couleur de cet élément sera synchronisée avec le statut le plus critique du domaine sélectionné.
              </p>
              {element.inheritFromDomainId === domain?.id && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ Attention : Un élément ne peut pas hériter de son propre domaine.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Édition des sous-catégories */}
        {element.subCategories && element.subCategories.length > 0 && (
          <Section
            title={`Sous-catégories (${element.subCategories.length})`}
            iconName="FolderOpen"
            isOpen={activeSection === 'subcategories'}
            onToggle={() => toggleSection('subcategories')}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSubCategoryDragEnd}
            >
              <SortableContext
                items={element.subCategories.map(sc => sc.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {element.subCategories.map((subCategory) => (
                    <SortableSubCategoryItem
                      key={subCategory.id}
                      subCategory={subCategory}
                      onIconClick={() => {
                        setIconPickerContext({ type: 'subCategory', id: subCategory.id });
                        setShowIconPicker('subCategory');
                      }}
                      onNameChange={(name) => updateSubCategory(subCategory.id, { name })}
                      onDelete={async () => {
                        const confirmed = await confirm({
                          title: 'Supprimer la sous-catégorie',
                          message: `Voulez-vous supprimer la sous-catégorie "${subCategory.name}" ?`,
                        });
                        if (confirmed) {
                          deleteSubCategory(subCategory.id);
                        }
                      }}
                      subElementsCount={subCategory.subElements.length}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {/* Sélecteur d'icônes pour les sous-catégories */}
            {showIconPicker === 'subCategory' && iconPickerContext && iconPickerContext.id && element && (
              <IconPicker
                value={element.subCategories.find(sc => sc.id === iconPickerContext.id)?.icon}
                onChange={(iconName) => {
                  if (iconPickerContext.type === 'subCategory' && iconPickerContext.id) {
                    updateSubCategory(iconPickerContext.id, { icon: iconName });
                  }
                }}
                onClose={() => {
                  setShowIconPicker(null);
                  setIconPickerContext(null);
                }}
              />
            )}
          </Section>
        )}

        {/* Préférences d'affichage pour les sous-catégories */}
        {element.subCategories && element.subCategories.length > 0 && (() => {
          const horizontalSubCategories = element.subCategories.filter(sc => sc.orientation !== 'vertical');
          const verticalSubCategories = element.subCategories.filter(sc => sc.orientation === 'vertical');

          return (
            <Section
              title="Préférences d'affichage"
              iconName="Settings"
              isOpen={activeSection === 'element-display-preferences'}
              onToggle={() => toggleSection('element-display-preferences')}
            >
              <div className="space-y-4">
                {/* Toggle et sliders pour sous-catégories horizontales */}
                {horizontalSubCategories.length > 0 && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-[#1E3A5F] mb-1">
                          Sous-catégories horizontales
                        </label>
                        <p className="text-xs text-[#64748B]">
                          {horizontalSubCategoriesInline
                            ? 'Affichage en ligne (à gauche des sous-éléments)'
                            : 'Affichage au-dessus des sous-éléments (par défaut)'
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = !horizontalSubCategoriesInline;
                          setHorizontalSubCategoriesInline(newValue);
                          const key = element ? `horizontalSubCategoriesInline_${elementStorageKey}` : 'horizontalSubCategoriesInline';
                          localStorage.setItem(key, String(newValue));
                          window.dispatchEvent(new Event(`horizontalSubCategoriesPreferenceChanged_${elementStorageKey}`));
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${horizontalSubCategoriesInline ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                          }`}
                        role="switch"
                        aria-checked={horizontalSubCategoriesInline}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${horizontalSubCategoriesInline ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>

                    {/* Slider espacement horizontal */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Espacement entre sous-éléments (vues horizontales)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={elementHorizontalSpacing}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setElementHorizontalSpacing(newValue);
                          const key = element ? `horizontalSpacing_${elementStorageKey}` : 'horizontalSpacing';
                          localStorage.setItem(key, String(newValue));
                          window.dispatchEvent(new Event(`spacingPreferenceChanged_${elementStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>Compact</span>
                        <span>Espacé</span>
                      </div>
                    </div>

                    {/* Slider espacement entre sous-catégories horizontales */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Espacement entre sous-catégories horizontales
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={subCategorySpacing}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setSubCategorySpacing(newValue);
                          const key = element ? `subCategorySpacing_${elementStorageKey}` : 'subCategorySpacing';
                          localStorage.setItem(key, String(newValue));
                          window.dispatchEvent(new Event(`spacingPreferenceChanged_${elementStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>Compact</span>
                        <span>Espacé</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Sliders pour sous-catégories verticales */}
                {verticalSubCategories.length > 0 && (
                  <>
                    {/* Slider largeur sous-catégories verticales */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Largeur des sous-catégories verticales (px)
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="500"
                        step="10"
                        value={verticalSubCategoryWidth}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setVerticalSubCategoryWidth(newValue);
                          const key = element ? `verticalSubCategoryWidth_${elementStorageKey}` : 'verticalSubCategoryWidth';
                          localStorage.setItem(key, String(newValue));
                          window.dispatchEvent(new Event(`verticalSubCategoryWidthChanged_${elementStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>100px</span>
                        <span className="font-medium">{verticalSubCategoryWidth}px</span>
                        <span>500px</span>
                      </div>
                    </div>

                  </>
                )}
              </div>
            </Section>
          );
        })()}

        {/* Liste des sous-éléments à éditer */}
        {allSubElements.length > 0 && (
          <Section
            title={`Sous-éléments (${allSubElements.length})`}
            iconName="Label"
            isOpen={activeSection === 'subelements'}
            onToggle={() => toggleSection('subelements')}
          >
            <div className="space-y-2">
              <p className="text-xs text-[#94A3B8] mb-3">
                Cliquez sur un sous-élément pour modifier son statut et son alerte.
              </p>
              {allSubElements.map((se) => (
                <button
                  key={se.id}
                  onClick={() => setSelectedSubElement(se)}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-[#F5F7FA] hover:bg-[#EEF2F7] rounded-lg transition-colors text-left border border-[#E2E8F0]"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[se.status].hex }}
                  />
                  <span className="text-sm text-[#1E3A5F] truncate flex-1">{se.name}</span>
                  {se.alert && (
                    <MuiIcon name="AlertTriangleIcon" size={16} className="text-[#FFB74D] flex-shrink-0" />
                  )}
                  <MuiIcon name="ChevronRightIcon" size={16} className="text-[#94A3B8] flex-shrink-0" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Propriétés de position (pour BackgroundView/MapView) */}
        {element.positionX !== undefined && element.positionY !== undefined && (
          <Section
            title="Position et taille"
            iconName="Move"
            isOpen={activeSection === 'position'}
            onToggle={() => toggleSection('position')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#64748B] mb-1">Largeur (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={element.width || 5}
                    onChange={(e) => {
                      const newWidth = parseFloat(e.target.value) || 1;
                      const oldWidth = element.width || 5;
                      const oldCenterX = (element.positionX || 0) + oldWidth / 2;
                      const newX = oldCenterX - newWidth / 2;
                      updateElement(element.id, {
                        width: newWidth,
                        positionX: Math.max(0, newX)
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#64748B] mb-1">Hauteur (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={element.height || 5}
                    onChange={(e) => {
                      const newHeight = parseFloat(e.target.value) || 1;
                      const oldHeight = element.height || 5;
                      const oldCenterY = (element.positionY || 0) + oldHeight / 2;
                      const newY = oldCenterY - newHeight / 2;
                      updateElement(element.id, {
                        height: newHeight,
                        positionY: Math.max(0, newY)
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#64748B] mb-2">
                  Icône pour rectangle
                  <span className="text-xs text-[#94A3B8] ml-2">Icône colorée ou rectangle</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] max-h-32 overflow-y-auto">
                  <button
                    onClick={() => updateElement(element.id, { icon: '' })}
                    className={`p-2 rounded-lg border transition-all ${!element.icon
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                      : 'border-transparent hover:bg-white'
                      }`}
                    title="Aucune icône (rectangle)"
                  >
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: STATUS_COLORS[element.status].hex }} />
                  </button>
                  {[
                    'Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Building2',
                    'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart', 'Users',
                    'Server', 'Database', 'Wifi', 'Radio', 'Cpu', 'HardDrive',
                    'AlertTriangle', 'Shield', 'Lock', 'Key', 'Eye', 'Camera',
                    'Zap', 'Activity', 'Thermometer', 'Droplet', 'Wind', 'Sun',
                  ].map((iconName) => (
                    <button
                      key={iconName}
                      onClick={() => updateElement(element.id, { icon: iconName })}
                      className={`p-2 rounded-lg border transition-all ${element.icon === iconName
                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                        : 'border-transparent hover:bg-white'
                        }`}
                      title={iconName}
                    >
                      <MuiIcon name={iconName} size={24} color={STATUS_COLORS[element.status].hex} />
                    </button>
                  ))}
                  {/* Bouton pour ouvrir le sélecteur complet */}
                  <button
                    onClick={() => setShowIconPicker('backgroundIcon')}
                    className="p-2 rounded-lg border border-dashed border-[#CBD5E1] hover:border-[#1E3A5F] hover:bg-white transition-all"
                    title="Plus d'icônes et images personnalisées..."
                  >
                    <MuiIcon name="MoreHoriz" size={24} className="text-[#64748B]" />
                  </button>
                  {/* Afficher l'icône personnalisée si sélectionnée */}
                  {element.icon && isCustomIcon(element.icon) && (
                    <button
                      className="p-2 rounded-lg border border-[#1E3A5F] bg-[#1E3A5F]/10"
                      title="Image personnalisée"
                    >
                      <MuiIcon name={element.icon} size={24} color={STATUS_COLORS[element.status].hex} />
                    </button>
                  )}
                </div>
                {/* Sélecteur d'icônes complet pour background */}
                {showIconPicker === 'backgroundIcon' && (
                  <IconPicker
                    value={element.icon}
                    onChange={(iconName) => updateElement(element.id, { icon: iconName })}
                    onClose={() => setShowIconPicker(null)}
                  />
                )}
                <p className="text-xs text-[#94A3B8] mt-2">
                  Le centre reste fixe lors du redimensionnement
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Point de carte GPS (si l'élément est lié à un MapElement) */}
        {domain && element && (() => {
          const mapElement = domain.mapElements?.find(me => me.elementId === element.id);
          return mapElement ? (
            <Section
              title="Point de carte (GPS)"
              iconName="MapPinIcon"
              isOpen={activeSection === 'gps'}
              onToggle={() => toggleSection('gps')}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#64748B] mb-1">Nom du point</label>
                  <EditableInput

                    value={mapElement.name}
                    onChange={(v) => updateMapElement(mapElement.id, { name: v })}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[#64748B] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={mapElement.gps.lat}
                      onChange={(e) => {
                        const lat = parseFloat(e.target.value);
                        if (!isNaN(lat)) {
                          updateMapElement(mapElement.id, { gps: { ...mapElement.gps, lat } });
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                      placeholder="ex: 48.8566"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#64748B] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={mapElement.gps.lng}
                      onChange={(e) => {
                        const lng = parseFloat(e.target.value);
                        if (!isNaN(lng)) {
                          updateMapElement(mapElement.id, { gps: { ...mapElement.gps, lng } });
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                      placeholder="ex: 2.3522"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#64748B] mb-2">Statut</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ok', 'mineur', 'critique', 'fatal', 'deconnecte', 'information'] as TileStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateMapElement(mapElement.id, { status })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${mapElement.status === status
                          ? `${STATUS_COLORS[status].bg} text-white`
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                          }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[status].hex }}
                        />
                        <span className="text-sm">{STATUS_LABELS[status]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#64748B] mb-2">Icône du point</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] max-h-32 overflow-y-auto">
                    {[
                      'Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Building2',
                      'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart', 'Users',
                      'Server', 'Database', 'Wifi', 'Radio', 'Cpu', 'HardDrive',
                      'AlertTriangle', 'Shield', 'Lock', 'Key', 'Eye', 'Camera',
                      'Zap', 'Activity', 'Thermometer', 'Droplet', 'Wind', 'Sun',
                    ].map((iconName) => (
                      <button
                        key={iconName}
                        onClick={() => updateMapElement(mapElement.id, { icon: iconName })}
                        className={`p-2 rounded-lg border transition-all ${mapElement.icon === iconName
                          ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                          : 'border-transparent hover:bg-white'
                          }`}
                        title={iconName}
                        style={{ color: STATUS_COLORS[mapElement.status].hex }}
                      >
                        <MuiIcon name={iconName} size={24} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Supprimer le point de carte',
                        message: `Voulez-vous supprimer le point "${mapElement.name}" de la carte ?`,
                      });
                      if (confirmed) {
                        deleteMapElement(mapElement.id);
                      }
                    }}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <MuiIcon name="Delete" size={16} />
                    <span>Supprimer le point</span>
                  </button>
                  <button
                    onClick={() => cloneMapElement(mapElement.id)}
                    className="px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] flex items-center gap-2 text-sm"
                  >
                    <MuiIcon name="CopyIcon" size={16} />
                    <span>Cloner le point</span>
                  </button>
                </div>
              </div>
            </Section>
          ) : null;
        })()}

        {/* Zone */}
        <Section
          title="Zone"
          iconName="MapPinIcon"
          isOpen={activeSection === 'zone'}
          onToggle={() => toggleSection('zone')}
        >
          <div className="space-y-3">
            <select
              value={element.zone || ''}
              onChange={(e) => updateElement(element.id, { zone: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="">Aucune zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>{zone.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nouvelle zone"
                className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                onClick={() => {
                  if (newZoneName.trim()) {
                    addZone(newZoneName.trim());
                    setNewZoneName('');
                  }
                }}
                className="px-3 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white rounded-lg text-sm"
              >
                +
              </button>
            </div>

            {/* Liste des zones avec icônes */}
            {zones.length > 0 && (
              <div className="border-t border-[#E2E8F0] pt-3 mt-3">
                <p className="text-xs text-[#64748B] mb-2">Icônes des zones</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {zones.map((zone) => (
                    <div key={zone.id} className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg">
                      <button
                        onClick={() => {
                          setIconPickerContext({ type: 'zone', id: zone.id });
                          setShowIconPicker('zone');
                        }}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded border border-[#E2E8F0] hover:border-[#1E3A5F] transition-colors cursor-pointer"
                        title="Choisir une icône"
                      >
                        {zone.icon ? (
                          <MuiIcon name={zone.icon} size={18} className="text-[#1E3A5F]" />
                        ) : (
                          <MuiIcon name="Add" size={18} className="text-[#94A3B8]" />
                        )}
                      </button>
                      <span className="flex-1 text-sm text-[#1E3A5F] truncate">{zone.name}</span>
                      {zone.icon && (
                        <button
                          onClick={() => updateZone(zone.id, { icon: undefined })}
                          className="p-1 text-[#94A3B8] hover:text-red-500 transition-colors"
                          title="Supprimer l'icône"
                        >
                          <MuiIcon name="Close" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sélecteur d'icônes pour les zones */}
            {showIconPicker === 'zone' && iconPickerContext?.type === 'zone' && iconPickerContext.id && (
              <IconPicker
                value={zones.find(z => z.id === iconPickerContext.id)?.icon}
                onChange={(iconName) => {
                  updateZone(iconPickerContext.id!, { icon: iconName });
                }}
                onClose={() => {
                  setShowIconPicker(null);
                  setIconPickerContext(null);
                }}
              />
            )}
          </div>
        </Section>

        {/* Modal de liaison lors du changement de nom */}
        {showLinkModal && pendingNameChange && (
          <LinkElementModal
            type={pendingNameChange.type}
            newItemName={pendingNameChange.newName}
            existingMatches={existingMatches}
            onLink={handleCreateLinked}
            onIndependent={handleCreateIndependent}
            onCancel={() => {
              setShowLinkModal(false);
              setPendingNameChange(null);
              setExistingMatches([]);
            }}
          />
        )}
      </div>
    );
  }

  // Édition d'un domaine
  if (domain) {
    return (
      <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Édition domaine</h3>
              <p className="text-sm text-[#64748B]">{domain.name}</p>
            </div>
            <div className="flex items-center gap-1">
              {/* Bouton dupliquer le domaine */}
              <button
                onClick={() => duplicateDomain(domain.id)}
                className="p-2 text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded-lg transition-colors"
                title="Dupliquer ce domaine"
              >
                <MuiIcon name="ContentCopy" size={18} />
              </button>
              {/* Bouton supprimer le domaine */}
              {currentCockpit && currentCockpit.domains.length > 1 && (
                <button
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Supprimer le domaine',
                      message: `Voulez-vous supprimer le domaine "${domain.name}" et tout son contenu ?`,
                    });
                    if (confirmed) {
                      deleteDomain(domain.id);
                    }
                  }}
                  className="p-2 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer ce domaine"
                >
                  <MuiIcon name="Delete" size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques des alertes (affiché en haut pour la vue Alertes) */}
        {domain.templateType === 'alerts' && (
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <h4 className="font-medium text-[#1E3A5F] mb-3 text-sm flex items-center gap-2">
              <MuiIcon name="Assessment" size={16} />
              Statistiques
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white rounded-lg border border-[#E2E8F0] text-center">
                <p className="text-2xl font-bold text-[#1E3A5F]">{domain.alertsData?.incidents?.length || 0}</p>
                <p className="text-xs text-[#64748B]">Total</p>
              </div>
              <div className="p-2 bg-[#F3E8FF] rounded-lg border border-[#DDD6FE] text-center">
                <p className="text-2xl font-bold text-[#8B5CF6]">{domain.alertsData?.incidents?.filter(i => i.severity === 'fatal').length || 0}</p>
                <p className="text-xs text-[#8B5CF6]">Fatales</p>
              </div>
              <div className="p-2 bg-[#FEE2E2] rounded-lg border border-[#FECACA] text-center">
                <p className="text-2xl font-bold text-[#E57373]">{domain.alertsData?.incidents?.filter(i => i.severity === 'critique').length || 0}</p>
                <p className="text-xs text-[#E57373]">Critiques</p>
              </div>
              <div className="p-2 bg-[#FFF7ED] rounded-lg border border-[#FED7AA] text-center">
                <p className="text-2xl font-bold text-[#FFB74D]">{domain.alertsData?.incidents?.filter(i => i.severity === 'mineur').length || 0}</p>
                <p className="text-xs text-[#FFB74D]">Mineures</p>
              </div>
            </div>
          </div>
        )}

        {/* Propriétés du domaine */}
        <Section
          title="Propriétés"
          iconName="SettingsIcon"
          isOpen={activeSection === 'properties'}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom</label>
              <EditableInput

                value={domain.name}
                onChange={(v) => updateDomain(domain.id, { name: v })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1">Icône</label>
              <button
                onClick={() => {
                  setIconPickerContext({ type: 'domainIcon', id: domain.id });
                  setShowIconPicker('domainIcon');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
              >
                {domain.icon ? (
                  <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                    <MuiIcon name={domain.icon} size={20} className="text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-[#CBD5E1] rounded-lg flex items-center justify-center">
                    <MuiIcon name="Add" size={20} className="text-white" />
                  </div>
                )}
                <span className="text-sm">{domain.icon || 'Choisir une icône...'}</span>
                {domain.icon && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDomain(domain.id, { icon: undefined });
                    }}
                    className="ml-auto p-1 text-[#94A3B8] hover:text-red-500 transition-colors"
                    title="Supprimer l'icône"
                  >
                    <MuiIcon name="Close" size={16} />
                  </button>
                )}
              </button>
            </div>

            {/* Sélecteur d'icônes pour le domaine */}
            {showIconPicker === 'domainIcon' && iconPickerContext?.type === 'domainIcon' && (
              <IconPicker
                value={domain.icon}
                onChange={(iconName) => {
                  updateDomain(domain.id, { icon: iconName });
                }}
                onClose={() => {
                  setShowIconPicker(null);
                  setIconPickerContext(null);
                }}
              />
            )}

            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom du template</label>
              <EditableInput

                value={domain.templateName || ''}
                onChange={(v) => updateDomain(domain.id, { templateName: v })}
                placeholder="Mon template"
                allowEmpty={true}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`domain-publiable-${domain.id}`}
                checked={domain.publiable !== false}
                onChange={(e) => updateDomain(domain.id, { publiable: e.target.checked })}
                className="w-4 h-4 text-[#1E3A5F] border-[#E2E8F0] rounded focus:ring-[#1E3A5F]"
              />
              <label htmlFor={`domain-publiable-${domain.id}`} className="text-sm text-[#64748B] cursor-pointer">
                Publiable
              </label>
            </div>
          </div>
        </Section>

        {/* Type de template */}
        <Section
          title="Type de vue"
          iconName="Layers"
          isOpen={activeSection === 'template'}
          onToggle={() => toggleSection('template')}
        >
          <div className="space-y-2">
            {[
              { type: 'standard' as TemplateType, label: 'Standard', desc: 'Catégories et éléments' },
              { type: 'grid' as TemplateType, label: 'Grille', desc: 'Tuiles en grille simple' },
              { type: 'map' as TemplateType, label: 'Carte', desc: 'Carte dynamique' },
              { type: 'background' as TemplateType, label: 'Image de fond', desc: 'Positionnement libre' },
              { type: 'hours-tracking' as TemplateType, label: 'Suivi des heures', desc: 'Suivi des heures et coûts du projet' },
              { type: 'alerts' as TemplateType, label: 'Alertes', desc: 'Liste d\'incidents et statistiques' },
              { type: 'stats' as TemplateType, label: 'Stats', desc: 'Graphiques de disponibilité' },
              { type: 'library' as TemplateType, label: 'Bibliothèque', desc: 'Zones et templates supervisables' },
            ].map(({ type, label, desc }) => (
              <button
                key={type}
                onClick={() => updateDomain(domain.id, { templateType: type })}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-all text-left ${domain.templateType === type
                  ? 'bg-[#1E3A5F]/10 border border-[#1E3A5F]/30 text-[#1E3A5F]'
                  : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                  }`}
              >
                <div className={`w-4 h-4 rounded-full mt-0.5 ${domain.templateType === type ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                  }`} />
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-[#94A3B8]">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Image de fond - Masquée pour hours-tracking et alerts */}
        {domain.templateType !== 'hours-tracking' && domain.templateType !== 'alerts' && (
          <Section
            title="Image de fond"
            iconName="Image"
            isOpen={activeSection === 'background'}
            onToggle={() => toggleSection('background')}
          >
            <div className="space-y-4">
              {/* Zone de sélection de fichier */}
              <div>
                <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Charger une image</label>
                <label
                  htmlFor={`bg-upload-${domain.id}`}
                  className="block p-4 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    id={`bg-upload-${domain.id}`}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const maxSizeMB = 25; // Augmenté à 25MB (Redis supporte 50MB)
                        const maxSizeBytes = maxSizeMB * 1024 * 1024;
                        if (file.size > maxSizeBytes) {
                          alert(`Erreur: Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). La taille maximale autorisée est de ${maxSizeMB} MB.`);
                          e.target.value = '';
                          return;
                        }

                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const base64 = event.target?.result as string;

                          // Vérifier la taille en base64 (généralement 1.33x la taille originale)
                          const base64SizeMB = base64.length / 1024 / 1024;
                          if (base64SizeMB > 35) {
                            alert(`Erreur: L'image encodée est trop volumineuse (${base64SizeMB.toFixed(2)} MB). Veuillez utiliser une image plus petite (max 35 MB encodé).`);
                            return;
                          }

                          console.log(`[EditorPanel] 📸 Upload image: ${base64SizeMB.toFixed(2)} MB`);
                          setImageUrl(base64);
                          updateDomain(domain.id, { backgroundImage: base64 });

                          // Forcer une sauvegarde IMMÉDIATE pour éviter toute perte
                          const saved = await forceSave();
                          if (saved) {
                            console.log('[EditorPanel] ✅ Image sauvegardée avec succès');
                          } else {
                            console.error('[EditorPanel] ❌ Échec de la sauvegarde de l\'image');
                            alert('Attention: L\'image a été chargée mais la sauvegarde a échoué. Veuillez réessayer ou utiliser une image plus petite.');
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                    <MuiIcon name="Upload" size={24} className="mb-2" />
                    <span className="text-xs font-medium">Cliquez pour choisir un fichier</span>
                    <span className="text-[10px] text-[#94A3B8] mt-1">PNG, JPG, GIF jusqu'à 30MB</span>
                  </div>
                </label>
              </div>

              {/* Séparateur */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-xs text-[#94A3B8]">ou</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              {/* URL alternative */}
              <div>
                <label className="block text-sm font-medium text-[#1E3A5F] mb-2">URL de l'image</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setAnalysisResult(null);
                    }}
                    placeholder="https://exemple.com/image.png"
                    className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                  {domain.templateType === 'map' && (
                    <button
                      onClick={analyzeMapImage}
                      disabled={!imageUrl || isAnalyzing}
                      className="px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap text-xs"
                      title="Analyser l'image avec l'IA pour détecter les coordonnées GPS"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin"><MuiIcon name="Refresh" size={14} /></div>
                          <span>Analyse...</span>
                        </>
                      ) : (
                        <>
                          <MuiIcon name="AutoAwesome" size={14} />
                          <span>Détecter GPS</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {domain.templateType !== 'map' && (
                  <button
                    onClick={() => {
                      if (imageUrl && imageUrl.trim()) {
                        updateDomain(domain.id, { backgroundImage: imageUrl });
                      }
                    }}
                    className="mt-2 w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] text-sm"
                  >
                    Enregistrer l'URL
                  </button>
                )}
              </div>

              {/* Aperçu */}
              {imageUrl && (
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                  <img
                    src={imageUrl}
                    alt="Aperçu"
                    className="max-h-32 rounded border border-[#E2E8F0] mx-auto w-full object-contain"
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

              {/* Résultat de l'analyse IA (MapView uniquement) */}
              {domain.templateType === 'map' && analysisResult && (
                <div className={`p-3 rounded-lg text-sm ${analysisResult.detected
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
                  }`}>
                  {analysisResult.detected ? (
                    <div className="flex items-start gap-2">
                      <MuiIcon name="CheckCircle" size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Zone détectée : {analysisResult.region}</p>
                        <p className="text-xs mt-1 opacity-80">{analysisResult.description}</p>
                        {analysisResult.confidence && (
                          <p className="text-xs mt-1 opacity-60">Confiance : {analysisResult.confidence}</p>
                        )}
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

              {/* Coordonnées GPS (MapView uniquement) */}
              {domain.templateType === 'map' && (
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <h4 className="font-medium text-[#1E3A5F] mb-2 text-sm flex items-center gap-2">
                    <MuiIcon name="Place" size={14} />
                    Coordonnées GPS des coins de l'image
                  </h4>
                  <p className="text-xs text-[#64748B] mb-3">
                    Ces coordonnées correspondent aux pixels des coins de l'image (pas à la zone géographique).
                  </p>

                  {/* Coin haut-gauche */}
                  <div className="mb-3">
                    <label className="block text-xs text-[#64748B] mb-1">📍 Coin haut-gauche (Nord-Ouest)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={gpsForm.topLeftLat}
                          onChange={(e) => setGpsForm({ ...gpsForm, topLeftLat: e.target.value })}
                          placeholder="ex: 51.089"
                          className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={gpsForm.topLeftLng}
                          onChange={(e) => setGpsForm({ ...gpsForm, topLeftLng: e.target.value })}
                          placeholder="ex: -5.142"
                          className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Coin bas-droite */}
                  <div className="mb-3">
                    <label className="block text-xs text-[#64748B] mb-1">📍 Coin bas-droite (Sud-Est)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={gpsForm.bottomRightLat}
                          onChange={(e) => setGpsForm({ ...gpsForm, bottomRightLat: e.target.value })}
                          placeholder="ex: 41.303"
                          className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={gpsForm.bottomRightLng}
                          onChange={(e) => setGpsForm({ ...gpsForm, bottomRightLng: e.target.value })}
                          placeholder="ex: 9.561"
                          className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={saveGpsBounds}
                    className="w-full px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] text-xs"
                  >
                    Enregistrer les coordonnées GPS
                  </button>
                </div>
              )}

              {/* Options d'affichage */}
              {domain.backgroundImage && (
                <div className="space-y-3">
                  <div className="relative">
                    <img
                      src={domain.backgroundImage}
                      alt="Aperçu"
                      className="w-full h-20 object-cover rounded-lg border border-[#E2E8F0]"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs">Image de fond</span>
                    </div>
                  </div>

                  {/* Mode d'affichage */}
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">Position de l'image</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateDomain(domain.id, { backgroundMode: 'behind' })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${(!domain.backgroundMode || domain.backgroundMode === 'behind')
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                          }`}
                      >
                        En dessous
                      </button>
                      <button
                        onClick={() => updateDomain(domain.id, { backgroundMode: 'overlay' })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${domain.backgroundMode === 'overlay'
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                          }`}
                      >
                        Au dessus
                      </button>
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-1">
                      {(!domain.backgroundMode || domain.backgroundMode === 'behind')
                        ? 'L\'image sera derrière les tuiles'
                        : 'L\'image sera par-dessus (transparente, sans gêner les clics)'}
                    </p>
                  </div>

                  {/* Opacité de l'image (BackgroundView uniquement) */}
                  {domain.templateType === 'background' && (
                    <div>
                      <label className="block text-sm text-[#64748B] mb-2">
                        Opacité de l'image ({domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}
                        onChange={(e) => updateDomain(domain.id, { backgroundImageOpacity: Number(e.target.value) })}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #1E3A5F 0%, #1E3A5F ${domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}%, #E2E8F0 ${domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}%, #E2E8F0 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  {/* Regroupement (clustering) */}
                  <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-[#1E3A5F]">
                          {domain.templateType === 'map' ? 'Regroupement des points' : 'Regroupement des éléments'}
                        </label>
                        <p className="text-xs text-[#64748B] mt-1">
                          {domain.templateType === 'map'
                            ? 'Regrouper les points proches en clusters pour améliorer la lisibilité'
                            : 'Regrouper les éléments proches en clusters pour améliorer la lisibilité'}
                        </p>
                      </div>
                      <button
                        onClick={() => updateDomain(domain.id, { enableClustering: !(domain.enableClustering !== false) })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${domain.enableClustering !== false ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                          }`}
                        role="switch"
                        aria-checked={domain.enableClustering !== false}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${domain.enableClustering !== false ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => updateDomain(domain.id, { backgroundImage: undefined, backgroundMode: undefined, backgroundImageOpacity: undefined })}
                    className="w-full px-3 py-1.5 text-xs text-[#E57373] hover:bg-red-50 rounded-lg border border-[#E57373]/30 transition-colors flex items-center justify-center gap-1"
                  >
                    <MuiIcon name="Delete" size={12} />
                    Supprimer l'image
                  </button>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Édition des catégories - Visible pour map, background et standard */}
        {domain.templateType !== 'hours-tracking' && domain.templateType !== 'alerts' && domain.templateType !== 'stats' && (
          <Section
            title={`Catégories (${domain.categories?.length || 0})`}
            iconName="FolderOpen"
            isOpen={activeSection === 'categories'}
            onToggle={() => toggleSection('categories')}
          >
            {/* Bouton d'ajout de catégorie */}
            <div className="mb-3">
              <button
                onClick={() => {
                  const name = prompt('Nom de la nouvelle catégorie :');
                  if (name && name.trim()) {
                    addCategory(domain.id, name.trim(), 'horizontal');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[#1E3A5F] bg-[#F5F7FA] hover:bg-[#E2E8F0] rounded-lg transition-colors border border-dashed border-[#CBD5E1]"
              >
                <MuiIcon name="Plus" size={16} />
                Ajouter une catégorie
              </button>
            </div>
            
            {domain.categories && domain.categories.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext
                  items={domain.categories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {domain.categories.map((category) => (
                      <SortableCategoryItem
                        key={category.id}
                        category={category}
                        onIconClick={() => {
                          setIconPickerContext({ type: 'category', id: category.id });
                          setShowIconPicker('category');
                        }}
                        onNameChange={(name) => updateCategory(category.id, { name })}
                        onDelete={async () => {
                          const confirmed = await confirm({
                            title: 'Supprimer la catégorie',
                            message: `Voulez-vous supprimer la catégorie "${category.name}" ?`,
                          });
                          if (confirmed) {
                            deleteCategory(category.id);
                          }
                        }}
                        subElementsCount={category.elements.length}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-sm text-[#64748B] text-center py-2">
                Aucune catégorie. Cliquez sur le bouton ci-dessus pour en ajouter.
              </p>
            )}
            {/* Sélecteur d'icônes pour les catégories */}
            {showIconPicker === 'category' && iconPickerContext && iconPickerContext.id && (
              <IconPicker
                value={domain?.categories.find(c => c.id === iconPickerContext.id)?.icon}
                onChange={(iconName) => {
                  if (iconPickerContext.type === 'category' && iconPickerContext.id) {
                    updateCategory(iconPickerContext.id, { icon: iconName });
                  }
                }}
                onClose={() => {
                  setShowIconPicker(null);
                  setIconPickerContext(null);
                }}
              />
            )}
          </Section>
        )}

        {/* Menu d'édition spécifique pour Suivi des heures */}
        {domain && domain.templateType === 'hours-tracking' && (
          <Section
            title="Configuration du suivi"
            iconName="Clock"
            isOpen={activeSection === 'hours-tracking-config'}
            onToggle={() => toggleSection('hours-tracking-config')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Date de début du projet</label>
                <input
                  type="date"
                  value={domain.hoursTracking?.projectStartDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => updateDomain(domain.id, {
                    hoursTracking: {
                      ...(domain.hoursTracking || {
                        projectStartDate: new Date().toISOString().split('T')[0],
                        salePrice: 0,
                        resources: []
                      }),
                      projectStartDate: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Prix de vente au client (€)</label>
                <input
                  type="number"
                  value={domain.hoursTracking?.salePrice || 0}
                  onChange={(e) => updateDomain(domain.id, {
                    hoursTracking: {
                      ...(domain.hoursTracking || {
                        projectStartDate: new Date().toISOString().split('T')[0],
                        salePrice: 0,
                        resources: []
                      }),
                      salePrice: parseFloat(e.target.value) || 0
                    }
                  })}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  min="0"
                  step="100"
                />
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 Les personnes et fournisseurs sont gérés directement dans la vue. Utilisez le bouton "Ajouter" dans la vue pour ajouter des ressources.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Menu d'édition spécifique pour Vue Alertes */}
        {domain && domain.templateType === 'alerts' && (
          <Section
            title="Préférences d'affichage"
            iconName="Settings"
            isOpen={activeSection === 'alerts-config'}
            onToggle={() => toggleSection('alerts-config')}
          >
            <div className="space-y-4">
              {/* Espacement entre les lignes */}
              <div>
                <label className="block text-sm text-[#64748B] mb-2">
                  Espacement entre les lignes ({domain.alertsData?.rowSpacing || 4}px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={domain.alertsData?.rowSpacing || 4}
                  onChange={(e) => updateDomain(domain.id, {
                    alertsData: {
                      ...domain.alertsData,
                      incidents: domain.alertsData?.incidents || [],
                      rowSpacing: parseInt(e.target.value)
                    }
                  })}
                  className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[#64748B] mt-1">
                  <span>Compact</span>
                  <span>Espacé</span>
                </div>
              </div>

            </div>
          </Section>
        )}

        {/* Sous-menu Génération d'alertes pour Vue Alertes */}
        {domain && domain.templateType === 'alerts' && (() => {
          // Fonction pour collecter tous les éléments et sous-éléments de la maquette
          const collectAllTargets = () => {
            const targets: Array<{
              domainName: string;
              categoryName: string;
              elementName: string;
              subCategoryName?: string;
              subElementName?: string;
            }> = [];

            currentCockpit?.domains.forEach(d => {
              if (d.templateType === 'alerts' || d.templateType === 'stats') return;

              d.categories?.forEach(cat => {
                cat.elements?.forEach(el => {
                  // Ajouter l'élément seul
                  targets.push({
                    domainName: d.name,
                    categoryName: cat.name,
                    elementName: el.name,
                  });

                  // Ajouter les sous-éléments
                  el.subCategories?.forEach(subCat => {
                    subCat.subElements?.forEach(subEl => {
                      targets.push({
                        domainName: d.name,
                        categoryName: cat.name,
                        elementName: el.name,
                        subCategoryName: subCat.name,
                        subElementName: subEl.name,
                      });
                    });
                  });
                });
              });
            });

            return targets;
          };

          // Calculer les cibles à chaque rendu pour avoir des données fraîches
          const allTargets = collectAllTargets();

          const descriptions = [
            'Incident réseau majeur',
            'Panne serveur',
            'Problème de connexion',
            'Maintenance imprévue',
            'Erreur applicative',
            'Surcharge système',
            'Coupure électrique',
            'Problème DNS',
            'Certificat expiré',
            'Base de données indisponible',
            'Mise à jour en cours',
            'Incident sécurité',
            'Problème VPN',
            'Saturation réseau',
            'Défaillance matérielle',
            'Timeout API',
            'Erreur de synchronisation',
            'Problème authentification',
          ];

          const handleGenerateAlerts = () => {
            if (allTargets.length === 0) {
              alert('Aucun élément ou sous-élément disponible dans la maquette pour générer des alertes.');
              return;
            }

            const enabledSeverities: IncidentSeverity[] = [];
            if (alertGenSeverities.fatal) enabledSeverities.push('fatal');
            if (alertGenSeverities.critique) enabledSeverities.push('critique');
            if (alertGenSeverities.mineur) enabledSeverities.push('mineur');

            if (enabledSeverities.length === 0) {
              alert('Veuillez sélectionner au moins une criticité.');
              return;
            }

            setIsGenerating(true);

            const startDate = new Date(alertGenStartDate);
            const endDate = new Date(alertGenEndDate);

            if (startDate >= endDate) {
              alert('La date de fin doit être postérieure à la date de début.');
              setIsGenerating(false);
              return;
            }

            const alerts: Incident[] = [];
            const timeRange = endDate.getTime() - startDate.getTime();

            for (let i = 0; i < alertGenCount; i++) {
              // Date de début aléatoire
              const alertStart = new Date(startDate.getTime() + Math.random() * timeRange);

              // Durée aléatoire entre min et max
              const durationMinutes = alertGenMinDuration + Math.random() * (alertGenMaxDuration - alertGenMinDuration);
              const alertEnd = new Date(alertStart.getTime() + durationMinutes * 60000);

              // Cible aléatoire
              const target = allTargets[Math.floor(Math.random() * allTargets.length)];

              // Sévérité aléatoire
              const severity = enabledSeverities[Math.floor(Math.random() * enabledSeverities.length)];

              // Responsable selon le pourcentage
              const isResponsible = Math.random() * 100 < alertGenResponsiblePercent;

              // Description aléatoire
              const description = descriptions[Math.floor(Math.random() * descriptions.length)];

              alerts.push({
                id: `alert_gen_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`,
                domainId: domain.id,
                severity,
                startDate: alertStart.toISOString(),
                endDate: alertEnd.toISOString(),
                targetDomainName: target.domainName,
                targetCategoryName: target.categoryName,
                targetElementName: target.elementName,
                targetSubCategoryName: target.subCategoryName,
                targetSubElementName: target.subElementName,
                responsible: isResponsible,
                description: `${description} (#${i + 1})`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            // Trier par date de début
            alerts.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

            // Ajouter les alertes au domaine
            alerts.forEach(alert => {
              addIncident(domain.id, alert);
            });

            setIsGenerating(false);
            alert(`${alerts.length} alertes générées avec succès !`);
          };

          return (
            <Section
              title="Génération d'alertes"
              iconName="AutoAwesome"
              isOpen={activeSection === 'alerts-generation'}
              onToggle={() => toggleSection('alerts-generation')}
            >
              <div className="space-y-4">
                <p className="text-xs text-[#64748B] italic">
                  Générez des alertes aléatoires pour tester la vue Stats.
                </p>

                {/* Période */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Date de début</label>
                    <input
                      type="date"
                      value={alertGenStartDate}
                      onChange={(e) => setAlertGenStartDate(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-[#E2E8F0] rounded focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Date de fin</label>
                    <input
                      type="date"
                      value={alertGenEndDate}
                      onChange={(e) => setAlertGenEndDate(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-[#E2E8F0] rounded focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Nombre d'alertes */}
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">
                    Nombre d'alertes : {alertGenCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={alertGenCount}
                    onChange={(e) => setAlertGenCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-[#64748B] mt-1">
                    <span>1</span>
                    <span>50</span>
                  </div>
                </div>

                {/* Criticités */}
                <div>
                  <label className="block text-xs text-[#64748B] mb-2">Criticités à générer</label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={alertGenSeverities.fatal}
                        onChange={(e) => setAlertGenSeverities(prev => ({ ...prev, fatal: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="px-2 py-0.5 rounded text-white" style={{ backgroundColor: '#8B5CF6' }}>Fatal</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={alertGenSeverities.critique}
                        onChange={(e) => setAlertGenSeverities(prev => ({ ...prev, critique: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="px-2 py-0.5 rounded text-white" style={{ backgroundColor: '#E57373' }}>Critique</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={alertGenSeverities.mineur}
                        onChange={(e) => setAlertGenSeverities(prev => ({ ...prev, mineur: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="px-2 py-0.5 rounded text-white" style={{ backgroundColor: '#FFB74D' }}>Mineur</span>
                    </label>
                  </div>
                </div>

                {/* % Responsable */}
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">
                    % alertes "Responsable" : {alertGenResponsiblePercent}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={alertGenResponsiblePercent}
                    onChange={(e) => setAlertGenResponsiblePercent(parseInt(e.target.value))}
                    className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-[#64748B] mt-1">
                    <span>0% (Non)</span>
                    <span>100% (Oui)</span>
                  </div>
                </div>

                {/* Durée des alertes */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Durée min (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="2880"
                      value={alertGenMinDuration}
                      onChange={(e) => setAlertGenMinDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1 text-sm border border-[#E2E8F0] rounded focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Durée max (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="2880"
                      value={alertGenMaxDuration}
                      onChange={(e) => setAlertGenMaxDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1 text-sm border border-[#E2E8F0] rounded focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-xs text-[#64748B]">
                  (30 min = 0.5h, 60 = 1h, 480 = 8h, 1440 = 24h)
                </p>

                {/* Info sur les cibles */}
                <div className="p-2 bg-[#F1F5F9] rounded-lg text-xs text-[#64748B] space-y-1">
                  <p><strong>{allTargets.length}</strong> cibles disponibles :</p>
                  <p>• {allTargets.filter(t => !t.subElementName).length} éléments</p>
                  <p>• {allTargets.filter(t => t.subElementName).length} sous-éléments</p>
                  {allTargets.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[#3B82F6] hover:underline">Voir la liste</summary>
                      <ul className="mt-1 max-h-32 overflow-y-auto text-[10px] space-y-0.5">
                        {allTargets.slice(0, 30).map((t, i) => (
                          <li key={i} className="truncate">
                            {t.domainName} / {t.categoryName} / {t.elementName}
                            {t.subElementName && ` / ${t.subCategoryName} / ${t.subElementName}`}
                          </li>
                        ))}
                        {allTargets.length > 30 && <li className="italic">... et {allTargets.length - 30} autres</li>}
                      </ul>
                    </details>
                  )}
                </div>

                {/* Bouton de génération */}
                <button
                  onClick={handleGenerateAlerts}
                  disabled={isGenerating || allTargets.length === 0}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-white flex items-center justify-center gap-2 ${isGenerating || allTargets.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#3B82F6] to-[#1E40AF] hover:from-[#2563EB] hover:to-[#1E3A8A]'
                    }`}
                >
                  <MuiIcon name="AutoAwesome" size={18} />
                  {isGenerating ? 'Génération en cours...' : `Générer ${alertGenCount} alertes`}
                </button>
              </div>
            </Section>
          );
        })()}

        {/* Menu d'édition spécifique pour Vue Stats */}
        {domain && domain.templateType === 'stats' && (() => {
          const defaultServiceHours: ServiceHours = {
            monday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            tuesday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            wednesday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            thursday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            friday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            saturday: [] as number[],
            sunday: [] as number[],
          };

          const statsData = domain.statsData || {
            periodType: 'month' as StatsPeriodType,
            periodCount: 12,
            serviceHours: defaultServiceHours,
            excludeWeekends: true,
            excludeHolidays: false,
            excludedDates: [] as string[],
            columnWidth: 100,
          };

          const alertsDomains = currentCockpit?.domains.filter(d => d.templateType === 'alerts') || [];

          const dayNames: { key: keyof ServiceHours; label: string }[] = [
            { key: 'monday', label: 'Lun' },
            { key: 'tuesday', label: 'Mar' },
            { key: 'wednesday', label: 'Mer' },
            { key: 'thursday', label: 'Jeu' },
            { key: 'friday', label: 'Ven' },
            { key: 'saturday', label: 'Sam' },
            { key: 'sunday', label: 'Dim' },
          ];

          const hours = Array.from({ length: 24 }, (_, i) => i);

          const toggleHour = (day: keyof ServiceHours, hour: number) => {
            const currentHours = statsData.serviceHours[day] || [];
            const newHours = currentHours.includes(hour)
              ? currentHours.filter(h => h !== hour)
              : [...currentHours, hour].sort((a, b) => a - b);
            updateDomain(domain.id, {
              statsData: {
                ...statsData,
                serviceHours: {
                  ...statsData.serviceHours,
                  [day]: newHours,
                },
              },
            });
          };

          // newExcludedDate et setNewExcludedDate sont maintenant déclarés au niveau supérieur du composant

          return (
            <>
              {/* Paramètres des graphes */}
              <Section
                title="Paramètres des graphes"
                iconName="BarChart"
                isOpen={activeSection === 'stats-config'}
                onToggle={() => toggleSection('stats-config')}
              >
                <div className="space-y-4">
                  {/* Source des alertes */}
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">
                      Source des alertes
                    </label>
                    <select
                      value={statsData.alertsDomainId || 'all'}
                      onChange={(e) => updateDomain(domain.id, {
                        statsData: { ...statsData, alertsDomainId: e.target.value === 'all' ? undefined : e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm"
                    >
                      <option value="all">Toute la maquette (toutes les alertes)</option>
                      {alertsDomains.map(d => (
                        <option key={d.id} value={d.id}>Vue Alertes : {d.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {alertsDomains.length} vue(s) Alertes disponible(s)
                    </p>
                  </div>

                  {/* Type de période */}
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">
                      Type de période
                    </label>
                    <select
                      value={statsData.periodType}
                      onChange={(e) => updateDomain(domain.id, {
                        statsData: { ...statsData, periodType: e.target.value as StatsPeriodType }
                      })}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm"
                    >
                      <option value="day">Jour</option>
                      <option value="week">Semaine</option>
                      <option value="month">Mois</option>
                      <option value="year">Année</option>
                    </select>
                  </div>

                  {/* Date de début */}
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={statsData.startDate ? statsData.startDate.split('T')[0] : ''}
                      onChange={(e) => updateDomain(domain.id, {
                        statsData: { ...statsData, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined }
                      })}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm"
                    />
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {statsData.startDate ? 'Les périodes commencent à cette date' : 'Non défini = périodes jusqu\'à aujourd\'hui'}
                    </p>
                  </div>

                  {/* Nombre de périodes */}
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">
                      Nombre de périodes ({statsData.periodCount})
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="24"
                      value={statsData.periodCount}
                      onChange={(e) => updateDomain(domain.id, {
                        statsData: { ...statsData, periodCount: parseInt(e.target.value) }
                      })}
                      className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Plages horaires de service */}
                  <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                    <h4 className="font-medium text-[#1E3A5F] mb-2 text-sm">Plages horaires de service</h4>
                    <p className="text-xs text-[#64748B] mb-3">
                      Cliquez sur les heures pour les activer/désactiver
                    </p>

                    {/* Grille heures par jour */}
                    <div className="overflow-x-auto">
                      <div className="min-w-[400px]">
                        {/* En-tête heures */}
                        <div className="flex mb-1">
                          <div className="w-10 flex-shrink-0" />
                          {hours.map(hour => (
                            <div key={hour} className="w-4 text-center text-[7px] text-[#94A3B8]">
                              {hour}
                            </div>
                          ))}
                        </div>

                        {/* Lignes par jour */}
                        {dayNames.map(({ key, label }) => (
                          <div key={key} className="flex items-center mb-0.5">
                            <div className="w-10 flex-shrink-0 text-xs text-[#64748B]">{label}</div>
                            {hours.map(hour => {
                              const isActive = (statsData.serviceHours[key] || []).includes(hour);
                              return (
                                <button
                                  key={hour}
                                  onClick={() => toggleHour(key, hour)}
                                  className={`w-4 h-4 border border-[#E2E8F0] transition-colors ${isActive ? 'bg-[#9CCC65]' : 'bg-white hover:bg-[#F5F7FA]'
                                    }`}
                                  title={`${label} ${hour}h`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Exclusions */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-[#64748B]">
                      <input
                        type="checkbox"
                        checked={statsData.excludeWeekends}
                        onChange={(e) => updateDomain(domain.id, {
                          statsData: { ...statsData, excludeWeekends: e.target.checked }
                        })}
                        className="rounded border-[#E2E8F0]"
                      />
                      Exclure les week-ends
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#64748B]">
                      <input
                        type="checkbox"
                        checked={statsData.excludeHolidays}
                        onChange={(e) => updateDomain(domain.id, {
                          statsData: { ...statsData, excludeHolidays: e.target.checked }
                        })}
                        className="rounded border-[#E2E8F0]"
                      />
                      Exclure les jours fériés
                    </label>
                  </div>

                  {/* Jours exclus spécifiques */}
                  <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                    <h4 className="font-medium text-[#1E3A5F] mb-2 text-sm">Jours exclus spécifiques</h4>

                    {/* Ajouter un jour */}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="date"
                        value={newExcludedDate}
                        onChange={(e) => setNewExcludedDate(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-[#E2E8F0] rounded bg-white"
                      />
                      <button
                        onClick={() => {
                          if (newExcludedDate && !statsData.excludedDates.includes(newExcludedDate)) {
                            updateDomain(domain.id, {
                              statsData: {
                                ...statsData,
                                excludedDates: [...statsData.excludedDates, newExcludedDate].sort(),
                              },
                            });
                            setNewExcludedDate('');
                          }
                        }}
                        className="px-2 py-1 bg-[#1E3A5F] text-white text-sm rounded hover:bg-[#2D4A6F]"
                      >
                        Ajouter
                      </button>
                    </div>

                    {/* Liste des jours exclus */}
                    {statsData.excludedDates.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {statsData.excludedDates.map(date => (
                          <span
                            key={date}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#64748B]"
                          >
                            {new Date(date).toLocaleDateString('fr-FR')}
                            <button
                              onClick={() => updateDomain(domain.id, {
                                statsData: {
                                  ...statsData,
                                  excludedDates: statsData.excludedDates.filter(d => d !== date),
                                },
                              })}
                              className="text-[#E57373] hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">Aucun jour exclu</p>
                    )}
                  </div>
                </div>
              </Section>

              {/* Préférences d'affichage Stats */}
              <Section
                title="Préférences d'affichage"
                iconName="Settings"
                isOpen={activeSection === 'stats-display'}
                onToggle={() => toggleSection('stats-display')}
              >
                <div className="space-y-4">
                  {/* Largeur des colonnes */}
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">
                      Largeur des colonnes ({statsData.columnWidth || 100}%)
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      value={statsData.columnWidth || 100}
                      onChange={(e) => updateDomain(domain.id, {
                        statsData: { ...statsData, columnWidth: parseInt(e.target.value) }
                      })}
                      className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-[#64748B] mt-1">
                      <span>Compact</span>
                      <span>Large</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      💡 Vert = disponible, Bleu = indispo. non responsable, Rouge = indispo. responsable.
                    </p>
                  </div>
                </div>
              </Section>
            </>
          );
        })()}

        {/* Préférences d'affichage - Masquées pour les vues Map, Background, Hours-tracking, Alerts et Stats */}
        {domain && domain.templateType !== 'map' && domain.templateType !== 'background' && domain.templateType !== 'hours-tracking' && domain.templateType !== 'alerts' && domain.templateType !== 'stats' && (() => {
          const horizontalCategories = domain.categories.filter(c => c.orientation === 'horizontal');
          const verticalCategories = domain.categories.filter(c => c.orientation === 'vertical');

          return (
            <Section
              title="Préférences d'affichage"
              iconName="Settings"
              isOpen={activeSection === 'display-preferences'}
              onToggle={() => toggleSection('display-preferences')}
            >
              <div className="space-y-4">
                {/* Mode de coloration des onglets de domaine */}
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                    Indicateur statut onglets
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="domainTabColorMode"
                        checked={domainTabColorMode === 'dot'}
                        onChange={() => {
                          setDomainTabColorMode('dot');
                          localStorage.setItem('domainTabColorMode', 'dot');
                          window.dispatchEvent(new Event('domainTabColorModeChanged'));
                        }}
                        className="w-4 h-4 text-[#1E3A5F] border-[#CBD5E1] focus:ring-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#64748B]">Pastille ronde</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="domainTabColorMode"
                        checked={domainTabColorMode === 'square'}
                        onChange={() => {
                          setDomainTabColorMode('square');
                          localStorage.setItem('domainTabColorMode', 'square');
                          window.dispatchEvent(new Event('domainTabColorModeChanged'));
                        }}
                        className="w-4 h-4 text-[#1E3A5F] border-[#CBD5E1] focus:ring-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#64748B]">Pastille carrée</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="domainTabColorMode"
                        checked={domainTabColorMode === 'border'}
                        onChange={() => {
                          setDomainTabColorMode('border');
                          localStorage.setItem('domainTabColorMode', 'border');
                          window.dispatchEvent(new Event('domainTabColorModeChanged'));
                        }}
                        className="w-4 h-4 text-[#1E3A5F] border-[#CBD5E1] focus:ring-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#64748B]">Bordure 3 côtés</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="domainTabColorMode"
                        checked={domainTabColorMode === 'full'}
                        onChange={() => {
                          setDomainTabColorMode('full');
                          localStorage.setItem('domainTabColorMode', 'full');
                          window.dispatchEvent(new Event('domainTabColorModeChanged'));
                        }}
                        className="w-4 h-4 text-[#1E3A5F] border-[#CBD5E1] focus:ring-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#64748B]">Onglet entier coloré</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="domainTabColorMode"
                        checked={domainTabColorMode === 'icon'}
                        onChange={() => {
                          setDomainTabColorMode('icon');
                          localStorage.setItem('domainTabColorMode', 'icon');
                          window.dispatchEvent(new Event('domainTabColorModeChanged'));
                        }}
                        className="w-4 h-4 text-[#1E3A5F] border-[#CBD5E1] focus:ring-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#64748B]">Icône colorée</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="domainTabColorMode"
                        checked={domainTabColorMode === 'corner'}
                        onChange={() => {
                          setDomainTabColorMode('corner');
                          localStorage.setItem('domainTabColorMode', 'corner');
                          window.dispatchEvent(new Event('domainTabColorModeChanged'));
                        }}
                        className="w-4 h-4 text-[#1E3A5F] border-[#CBD5E1] focus:ring-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#64748B]">Pastille discrète (haut-droite)</span>
                    </label>
                  </div>

                  {/* Sélecteur d'icône (visible uniquement en mode 'icon') */}
                  {domainTabColorMode === 'icon' && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                      <label className="block text-xs text-[#64748B] mb-2">
                        Icône de statut
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowIconPicker('domainTabIcon');
                            setIconPickerContext({ type: 'domainTabIcon' });
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F5F7FA] transition-colors"
                        >
                          <MuiIcon name={domainTabStatusIcon} size={18} className="text-[#1E3A5F]" />
                          <span className="text-sm text-[#64748B]">{domainTabStatusIcon}</span>
                        </button>
                        <span className="text-xs text-[#94A3B8]">
                          Cliquer pour changer
                        </span>
                      </div>
                      {/* IconPicker pour l'icône de statut des onglets */}
                      {showIconPicker === 'domainTabIcon' && (
                        <IconPicker
                          value={domainTabStatusIcon}
                          onChange={(iconName) => {
                            const newIcon = iconName || 'Warning';
                            setDomainTabStatusIcon(newIcon);
                            localStorage.setItem('domainTabStatusIcon', newIcon);
                            window.dispatchEvent(new Event('domainTabColorModeChanged'));
                          }}
                          onClose={() => {
                            setShowIconPicker(null);
                            setIconPickerContext(null);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[#1E3A5F] mb-1">
                      Tuiles vertes (statut OK)
                    </label>
                    <p className="text-xs text-[#64748B]">
                      {greenTilesAsColored
                        ? 'Affichage avec couleur verte (comme les autres statuts)'
                        : 'Affichage avec fond blanc (par défaut)'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newValue = !greenTilesAsColored;
                      setGreenTilesAsColored(newValue);
                      const key = domain ? `greenTilesAsColored_${domainStorageKey}` : 'greenTilesAsColored';
                      localStorage.setItem(key, String(newValue));
                      // Forcer le re-render des tuiles dans la même fenêtre
                      window.dispatchEvent(new Event(`greenTilesPreferenceChanged_${domainStorageKey}`));
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${greenTilesAsColored ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                      }`}
                    role="switch"
                    aria-checked={greenTilesAsColored}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${greenTilesAsColored ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                {/* Toggle et sliders pour catégories horizontales */}
                {(horizontalCategories.length > 0 || domain?.templateType === 'grid') && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-[#1E3A5F] mb-1">
                          Catégories horizontales
                        </label>
                        <p className="text-xs text-[#64748B]">
                          {horizontalCategoriesInline
                            ? 'En-tête à gauche, tuiles à droite (en ligne)'
                            : 'En-tête au-dessus des tuiles (par défaut)'
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = !horizontalCategoriesInline;
                          setHorizontalCategoriesInline(newValue);
                          const key = domain ? `horizontalCategoriesInline_${domainStorageKey}` : 'horizontalCategoriesInline';
                          localStorage.setItem(key, String(newValue));
                          // Forcer le re-render des catégories
                          window.dispatchEvent(new Event(`horizontalCategoriesPreferenceChanged_${domainStorageKey}`));
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${horizontalCategoriesInline ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                          }`}
                        role="switch"
                        aria-checked={horizontalCategoriesInline}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${horizontalCategoriesInline ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>

                    {/* Slider espacement horizontal */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Espacement entre éléments (vues horizontales)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={horizontalSpacing}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setHorizontalSpacing(newValue);
                          const key = domain ? `horizontalSpacing_${domainStorageKey}` : 'horizontalSpacing';
                          localStorage.setItem(key, String(newValue));
                          window.dispatchEvent(new Event(`spacingPreferenceChanged_${domainStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>Compact</span>
                        <span>Espacé</span>
                      </div>
                    </div>

                    {/* Slider espacement entre catégories horizontales */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Espacement entre catégories horizontales
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={categorySpacing}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setCategorySpacing(newValue);
                          const key = domain ? `categorySpacing_${domainStorageKey}` : 'categorySpacing';
                          localStorage.setItem(key, String(newValue));
                          window.dispatchEvent(new Event(`spacingPreferenceChanged_${domainStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>Compact</span>
                        <span>Espacé</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Slider pour catégories verticales */}
                {verticalCategories.length > 0 && domain?.templateType !== 'grid' && (
                  <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                    <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                      Largeur des catégories verticales (px)
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="500"
                      step="10"
                      value={verticalCategoryWidth}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value, 10);
                        setVerticalCategoryWidth(newValue);
                        const key = domain ? `verticalCategoryWidth_${domainStorageKey}` : 'verticalCategoryWidth';
                        localStorage.setItem(key, String(newValue));
                        window.dispatchEvent(new Event(`verticalCategoryWidthChanged_${domainStorageKey}`));
                      }}
                      className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                    />
                    <div className="flex justify-between text-xs text-[#64748B] mt-1">
                      <span>100px</span>
                      <span className="font-medium">{verticalCategoryWidth}px</span>
                      <span>500px</span>
                    </div>
                  </div>
                )}

                {/* Options specifiques a la vue grille */}
                {domain?.templateType === 'grid' && (
                  <>
                    {/* Mode eclate / resserre */}
                    <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-[#1E3A5F] mb-1">
                          Mode d'affichage de la grille
                        </label>
                        <p className="text-xs text-[#64748B]">
                          {gridViewMode === 'expanded'
                            ? 'Vue eclatee : tous les elements visibles'
                            : 'Vue resserree : uniquement les categories'
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = gridViewMode === 'expanded' ? 'collapsed' : 'expanded';
                          setGridViewMode(newValue);
                          localStorage.setItem(`gridViewMode_${domain.id}`, newValue);
                          window.dispatchEvent(new Event(`gridViewModeChanged_${domain.id}`));
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${gridViewMode === 'expanded' ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'}`}
                        role="switch"
                        aria-checked={gridViewMode === 'expanded'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${gridViewMode === 'expanded' ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>

                    {/* Espacement des cellules */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Espacement des elements (px)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={gridCellSpacing}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setGridCellSpacing(newValue);
                          localStorage.setItem(`gridCellSpacing_${domainStorageKey}`, String(newValue));
                          window.dispatchEvent(new Event(`gridSpacingChanged_${domainStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>0px</span>
                        <span className="font-medium">{gridCellSpacing}px</span>
                        <span>20px</span>
                      </div>
                    </div>

                    {/* Espacement entre categories */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Espacement entre categories (px)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={gridCategorySpacing}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setGridCategorySpacing(newValue);
                          localStorage.setItem(`gridCategorySpacing_${domainStorageKey}`, String(newValue));
                          window.dispatchEvent(new Event(`gridSpacingChanged_${domainStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>0px</span>
                        <span className="font-medium">{gridCategorySpacing}px</span>
                        <span>20px</span>
                      </div>
                    </div>

                    {/* Largeur de la colonne categories */}
                    <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        Largeur colonne categories (px)
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="1000"
                        step="10"
                        value={gridCategoryColumnWidth}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setGridCategoryColumnWidth(newValue);
                          localStorage.setItem(`gridCategoryColumnWidth_${domainStorageKey}`, String(newValue));
                          window.dispatchEvent(new Event(`gridColumnWidthChanged_${domainStorageKey}`));
                        }}
                        className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                      />
                      <div className="flex justify-between text-xs text-[#64748B] mt-1">
                        <span>40px</span>
                        <span className="font-medium">{gridCategoryColumnWidth}px</span>
                        <span>1000px</span>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-1">Ou glissez la bordure dans la grille</p>
                    </div>

                  </>
                )}
              </div>
            </Section>
          );
        })()}

        {/* Paramètres du cockpit */}
        <Section
          title="Cockpit"
          iconName="Label"
          isOpen={activeSection === 'cockpit'}
          onToggle={() => toggleSection('cockpit')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom du cockpit</label>
              <EditableInput

                value={currentCockpit?.name || ''}
                onChange={(v) => updateCockpit({ name: v })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1">Logo (URL)</label>
              <EditableInput

                value={currentCockpit?.logo || ''}
                onChange={(v) => updateCockpit({ logo: v })}
                placeholder="https://exemple.com/logo.png"
                allowEmpty={true}
              />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1">Bandeau défilant</label>
              <textarea
                value={currentCockpit?.scrollingBanner || ''}
                onChange={(e) => updateCockpit({ scrollingBanner: e.target.value })}
                placeholder="Texte du bandeau..."
                rows={2}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
              />
            </div>

            {/* Option Vue Cockpit Original (préparation future fonctionnalité) */}
            <div className="border-t border-[#E2E8F0] pt-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-[#F5F7FA] rounded-lg hover:bg-[#E2E8F0] transition-colors">
                <input
                  type="checkbox"
                  checked={currentCockpit?.useOriginalView || false}
                  onChange={(e) => updateCockpit({ useOriginalView: e.target.checked })}
                  className="w-5 h-5 text-[#1E3A5F] border-[#E2E8F0] rounded focus:ring-[#1E3A5F] focus:ring-2"
                />
                <div>
                  <span className="block text-sm font-medium text-[#1E3A5F]">Vue Cockpit Original</span>
                  <span className="block text-xs text-[#94A3B8]">
                    Active une vue alternative pour les cockpits publiés (bientôt disponible)
                  </span>
                </div>
              </label>
            </div>

            {/* Partage avec d'autres utilisateurs */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Partage avec d'autres utilisateurs</label>
              {isLoadingUsers ? (
                <div className="text-sm text-[#94A3B8] py-2">Chargement des utilisateurs...</div>
              ) : users.length === 0 ? (
                <div className="text-sm text-[#94A3B8] py-2">Aucun utilisateur disponible</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {users
                    .filter(u => u.id !== user?.id) // Exclure l'utilisateur actuel
                    .map((userItem) => {
                      const isShared = currentCockpit?.sharedWith?.includes(userItem.id) || false;
                      return (
                        <label
                          key={userItem.id}
                          className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg hover:bg-[#E2E8F0] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isShared}
                            onChange={(e) => {
                              const currentShared = currentCockpit?.sharedWith || [];
                              const newShared = e.target.checked
                                ? [...currentShared, userItem.id]
                                : currentShared.filter(id => id !== userItem.id);
                              updateCockpit({ sharedWith: newShared });
                            }}
                            className="w-4 h-4 text-[#1E3A5F] border-[#E2E8F0] rounded focus:ring-[#1E3A5F] focus:ring-2"
                          />
                          <span className="text-sm text-[#1E3A5F] flex-1">{userItem.username}</span>
                          {userItem.isAdmin && (
                            <span className="text-xs text-[#94A3B8] bg-[#E2E8F0] px-2 py-0.5 rounded">Admin</span>
                          )}
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>
    );
  }

  // Aucune sélection
  return (
    <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] flex items-center justify-center shadow-lg">
      <p className="text-[#94A3B8] text-center px-8">
        Sélectionnez un domaine ou un élément pour l'éditer
      </p>
    </div>
  );
}

interface SectionProps {
  title: string;
  iconName: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, iconName, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="border-b border-[#E2E8F0]">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F7FA] transition-colors"
      >
        <MuiIcon name={iconName} size={16} className="text-[#94A3B8]" />
        <span className="flex-1 text-sm font-medium text-[#1E3A5F]">{title}</span>
        {isOpen ? (
          <MuiIcon name="ChevronDown" size={16} className="text-[#94A3B8]" />
        ) : (
          <MuiIcon name="ChevronRightIcon" size={16} className="text-[#94A3B8]" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
