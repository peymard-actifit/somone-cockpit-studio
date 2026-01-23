import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Domain, SubElement } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { STATUS_COLORS, getEffectiveColors } from '../types';
import { MuiIcon } from './IconPicker';
import LinkElementModal from './LinkElementModal';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GridViewProps {
  domain: Domain;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
  viewMode?: 'expanded' | 'collapsed';
  domains?: Domain[]; // Domaines pour calculer l'héritage (mode public)
}

// Composant draggable pour les sous-éléments
interface DraggableSubElementProps {
  subElement: SubElement & { _elementId: string; _elementName: string; _subCategoryId: string };
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  readOnly: boolean;
}

function DraggableSubElement({ subElement, isSelected, onSelect, readOnly }: DraggableSubElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subElement.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const colors = STATUS_COLORS[subElement.status] || STATUS_COLORS.ok;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: colors.hex }}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      className={`relative p-1.5 rounded cursor-grab transition-all select-none ${isSelected ? 'ring-2 ring-[#1E3A5F] ring-offset-1 scale-105' : ''} hover:scale-105 ${isDragging ? 'z-50 shadow-lg' : ''}`}
      title={`${subElement.name}${subElement._elementName ? ` (${subElement._elementName})` : ''}`}
    >
      <div className="flex items-center gap-1">
        {subElement.icon && <MuiIcon name={subElement.icon} size={12} className="text-white" />}
        <span className="text-[10px] text-white truncate max-w-[60px]">{subElement.name}</span>
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#1E3A5F] rounded-full flex items-center justify-center">
            <MuiIcon name="Check" size={8} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function GridView({ domain, onElementClick, readOnly = false, viewMode = 'expanded', domains: domainsProp }: GridViewProps) {
  const { addCategory, addSubCategory, addSubElement, addElement, deleteElement, moveSubElement, findSubElementsByName, linkSubElement, currentCockpit } = useCockpitStore();
  // Utiliser les domaines passés en prop (mode public) ou ceux du store (mode édition)
  const domains = domainsProp || currentCockpit?.domains;

  // Selection state
  const [selectedSubElements, setSelectedSubElements] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number, y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const subElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Drag & Drop state
  const [, setActiveId] = useState<string | null>(null);
  const [activeSubElement, setActiveSubElement] = useState<(SubElement & { _elementId: string; _elementName: string; _subCategoryId: string }) | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Modal state
  const [showCreateElementModal, setShowCreateElementModal] = useState(false);
  const [newElementName, setNewElementName] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [assignMode, setAssignMode] = useState<'create' | 'existing'>('create');
  const [targetElementId, setTargetElementId] = useState<string | null>(null);

  // Add states
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [addingSubElementAt, setAddingSubElementAt] = useState<{ catId: string, subCatName: string } | null>(null);
  const [addingElementToCategoryId, setAddingElementToCategoryId] = useState<string | null>(null);
  const [newElementNameInput, setNewElementNameInput] = useState('');
  const [newSubElementName, setNewSubElementName] = useState('');

  // État pour le modal de liaison des sous-éléments
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingSubElementName, setPendingSubElementName] = useState('');
  const [pendingSubCategoryId, setPendingSubCategoryId] = useState<string | null>(null);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);

  // Preferences d'affichage (connectees au localStorage via events)
  const domainStorageKey = `domain_${domain.id}`;

  const [greenTilesAsColored, setGreenTilesAsColored] = useState(() => {
    return localStorage.getItem(`greenTilesAsColored_${domainStorageKey}`) === 'true';
  });

  const [horizontalCategoriesInline, setHorizontalCategoriesInline] = useState(() => {
    return localStorage.getItem(`horizontalCategoriesInline_${domainStorageKey}`) === 'true';
  });

  const [cellSpacing, setCellSpacing] = useState(() => {
    return parseInt(localStorage.getItem(`gridCellSpacing_${domainStorageKey}`) || '4', 10);
  });

  const [categorySpacing, setCategorySpacing] = useState(() => {
    return parseInt(localStorage.getItem(`gridCategorySpacing_${domainStorageKey}`) || '0', 10);
  });

  // Largeur de la colonne des categories (redimensionnable)
  const [categoryColumnWidth, setCategoryColumnWidth] = useState(() => {
    const width = parseInt(localStorage.getItem(`gridCategoryColumnWidth_${domainStorageKey}`) || '250', 10);
    return width;
  });

  // Effet pour synchroniser la ref avec l'etat
  useEffect(() => {
    currentWidthRef.current = categoryColumnWidth;
  }, [categoryColumnWidth]);
  const [, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const currentWidthRef = useRef(250);

  // Largeurs des colonnes de sous-categories
  const [subCatColumnWidths, setSubCatColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`gridSubCatWidths_${domainStorageKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Ordre des sous-categories (liste des noms)
  const [subCategoryOrder, setSubCategoryOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`gridSubCatOrder_${domainStorageKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });


  // Ecouter les changements de preferences
  useEffect(() => {
    const handleGreenTilesChange = () => {
      setGreenTilesAsColored(localStorage.getItem(`greenTilesAsColored_${domainStorageKey}`) === 'true');
    };
    const handleCategoriesInlineChange = () => {
      setHorizontalCategoriesInline(localStorage.getItem(`horizontalCategoriesInline_${domainStorageKey}`) === 'true');
    };
    const handleSpacingChange = () => {
      setCellSpacing(parseInt(localStorage.getItem(`gridCellSpacing_${domainStorageKey}`) || '4', 10));
      setCategorySpacing(parseInt(localStorage.getItem(`gridCategorySpacing_${domainStorageKey}`) || '0', 10));
    };
    const handleViewModeChange = () => {
      // viewMode est gere par DomainView via prop
    };

    window.addEventListener(`greenTilesPreferenceChanged_${domainStorageKey}`, handleGreenTilesChange);
    window.addEventListener(`horizontalCategoriesPreferenceChanged_${domainStorageKey}`, handleCategoriesInlineChange);
    window.addEventListener(`gridSpacingChanged_${domainStorageKey}`, handleSpacingChange);
    window.addEventListener(`gridViewModeChanged_${domainStorageKey}`, handleViewModeChange);

    const handleWidthChange = () => {
      setCategoryColumnWidth(parseInt(localStorage.getItem(`gridCategoryColumnWidth_${domainStorageKey}`) || '250', 10));
    };
    window.addEventListener(`gridColumnWidthChanged_${domainStorageKey}`, handleWidthChange);

    const handleSubCatOrderChange = () => {
      try {
        const saved = localStorage.getItem(`gridSubCatOrder_${domainStorageKey}`);
        setSubCategoryOrder(saved ? JSON.parse(saved) : []);
      } catch { setSubCategoryOrder([]); }
    };
    window.addEventListener(`gridSubCatOrderChanged_${domainStorageKey}`, handleSubCatOrderChange);

    return () => {
      window.removeEventListener(`greenTilesPreferenceChanged_${domainStorageKey}`, handleGreenTilesChange);
      window.removeEventListener(`horizontalCategoriesPreferenceChanged_${domainStorageKey}`, handleCategoriesInlineChange);
      window.removeEventListener(`gridSpacingChanged_${domainStorageKey}`, handleSpacingChange);
      window.removeEventListener(`gridViewModeChanged_${domainStorageKey}`, handleViewModeChange);
      window.removeEventListener(`gridColumnWidthChanged_${domainStorageKey}`, handleWidthChange);
      window.removeEventListener(`gridSubCatOrderChanged_${domainStorageKey}`, handleSubCatOrderChange);
    };
  }, [domainStorageKey]);

  // Collect all unique subcategories (for COLUMNS) - triees selon l'ordre defini
  // Protection: s'assurer que les tableaux existent
  const allSubCategories = useMemo(() => {
    const subCatMap = new Map<string, { name: string; icon?: string; id?: string; elementId?: string }>();
    for (const category of (domain.categories || [])) {
      for (const element of (category.elements || [])) {
        for (const subCat of (element.subCategories || [])) {
          if (!subCatMap.has(subCat.name)) {
            subCatMap.set(subCat.name, { name: subCat.name, icon: subCat.icon, id: subCat.id, elementId: element.id });
          }
        }
      }
    }
    const allCats = Array.from(subCatMap.values());

    // Trier selon l'ordre defini, les nouvelles sous-cats vont a la fin
    if (subCategoryOrder.length > 0) {
      return allCats.sort((a, b) => {
        const idxA = subCategoryOrder.indexOf(a.name);
        const idxB = subCategoryOrder.indexOf(b.name);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }
    return allCats;
  }, [domain.categories, subCategoryOrder]);



  // Fonction pour redimensionner une colonne de sous-categorie
  const handleSubCatResize = (subCatName: string, startX: number, startWidth: number) => {
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(20, Math.min(600, startWidth + delta));
      setSubCatColumnWidths(prev => ({ ...prev, [subCatName]: newWidth }));
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      // Sauvegarder les largeurs
      const widths = { ...subCatColumnWidths };
      localStorage.setItem(`gridSubCatWidths_${domainStorageKey}`, JSON.stringify(widths));
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  // Organize data: category (row) -> subcategory (col) -> subElements (ancienne structure)
  // Protection: s'assurer que les tableaux existent
  const gridData = useMemo(() => {
    const data: Map<string, Map<string, (SubElement & { _elementId: string; _elementName: string; _subCategoryId: string })[]>> = new Map();
    for (const category of (domain.categories || [])) {
      const categoryData: Map<string, (SubElement & { _elementId: string; _elementName: string; _subCategoryId: string })[]> = new Map();
      for (const subCatInfo of allSubCategories) {
        categoryData.set(subCatInfo.name, []);
      }
      for (const element of (category.elements || [])) {
        for (const subCat of (element.subCategories || [])) {
          const existing = categoryData.get(subCat.name) || [];
          existing.push(...(subCat.subElements || []).map(se => ({
            ...se,
            _elementId: element.id,
            _elementName: element.name,
            _subCategoryId: subCat.id
          })));
          categoryData.set(subCat.name, existing);
        }
      }
      data.set(category.id, categoryData);
    }
    return data;
  }, [domain.categories, allSubCategories]);

  // NOUVELLE STRUCTURE: element (row) -> subcategory (col) -> subElements
  // Pour la vue avec éléments verticaux et sous-éléments à droite
  // Protection: s'assurer que les tableaux existent
  const elementGridData = useMemo(() => {
    const data: Map<string, Map<string, (SubElement & { _elementId: string; _elementName: string; _subCategoryId: string })[]>> = new Map();
    for (const category of (domain.categories || [])) {
      for (const element of (category.elements || [])) {
        const elementData: Map<string, (SubElement & { _elementId: string; _elementName: string; _subCategoryId: string })[]> = new Map();
        // Initialiser toutes les colonnes de sous-catégories
        for (const subCatInfo of allSubCategories) {
          elementData.set(subCatInfo.name, []);
        }
        // Remplir avec les sous-éléments de cet élément
        for (const subCat of (element.subCategories || [])) {
          const existing = elementData.get(subCat.name) || [];
          existing.push(...(subCat.subElements || []).map(se => ({
            ...se,
            _elementId: element.id,
            _elementName: element.name,
            _subCategoryId: subCat.id
          })));
          elementData.set(subCat.name, existing);
        }
        data.set(element.id, elementData);
      }
    }
    return data;
  }, [domain.categories, allSubCategories]);

  // Drag & Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Trouver le sous-élément actif
    for (const category of domain.categories) {
      for (const element of category.elements) {
        for (const subCat of element.subCategories) {
          const found = subCat.subElements.find(se => se.id === active.id);
          if (found) {
            setActiveSubElement({
              ...found,
              _elementId: element.id,
              _elementName: element.name,
              _subCategoryId: subCat.id
            });
            return;
          }
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveSubElement(null);

    if (!over || active.id === over.id) return;

    // Trouver les informations source et destination
    const sourceSubCatId = activeSubElement?._subCategoryId;

    // over.id peut être un sous-élément ou une cellule de drop
    // Si c'est une cellule, l'id sera format "cell_elementId_subCatName"
    const overId = over.id as string;

    if (overId.startsWith('cell_')) {
      // Drop dans une cellule vide
      const parts = overId.split('_');
      const targetElementId = parts[1];
      const targetSubCatName = parts.slice(2).join('_');

      // Trouver la sous-catégorie cible
      for (const category of domain.categories) {
        for (const element of category.elements) {
          if (element.id === targetElementId) {
            const targetSubCat = element.subCategories.find(sc => sc.name === targetSubCatName);
            if (targetSubCat && sourceSubCatId && sourceSubCatId !== targetSubCat.id) {
              moveSubElement(active.id as string, sourceSubCatId, targetSubCat.id);
            }
            return;
          }
        }
      }
    } else {
      // Drop sur un autre sous-élément - trouver sa sous-catégorie
      for (const category of domain.categories) {
        for (const element of category.elements) {
          for (const subCat of element.subCategories) {
            if (subCat.subElements.find(se => se.id === overId)) {
              if (sourceSubCatId && sourceSubCatId !== subCat.id) {
                moveSubElement(active.id as string, sourceSubCatId, subCat.id);
              }
              return;
            }
          }
        }
      }
    }
  };

  // Toggle selection with Shift support
  const toggleSelection = (subElementId: string, categoryId: string, event: React.MouseEvent) => {
    if (readOnly) return;

    const newSelection = new Set(selectedSubElements);

    if (event.shiftKey && selectedSubElements.size > 0) {
      // Shift-click: select range (simplified - just add to selection)
      newSelection.add(subElementId);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd-click: toggle individual
      if (newSelection.has(subElementId)) {
        newSelection.delete(subElementId);
      } else {
        newSelection.add(subElementId);
      }
    } else {
      // Simple click: select only this one
      newSelection.clear();
      newSelection.add(subElementId);
    }

    if (newSelection.size > 0 && !targetCategoryId) {
      setTargetCategoryId(categoryId);
    } else if (newSelection.size === 0) {
      setTargetCategoryId(null);
    }

    setSelectedSubElements(newSelection);
  };

  // Rectangle selection handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsSelecting(true);
    setSelectionStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelectedSubElements(new Set());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      return;
    }

    // Calculate selection rectangle
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    // Only process if rectangle is significant
    if (maxX - minX > 10 && maxY - minY > 10) {
      const newSelection = new Set(selectedSubElements);
      const gridRect = gridRef.current?.getBoundingClientRect();

      if (gridRect) {
        subElementRefs.current.forEach((el, id) => {
          const elRect = el.getBoundingClientRect();
          const elX = elRect.left - gridRect.left + elRect.width / 2;
          const elY = elRect.top - gridRect.top + elRect.height / 2;

          if (elX >= minX && elX <= maxX && elY >= minY && elY <= maxY) {
            newSelection.add(id);
          }
        });
      }

      setSelectedSubElements(newSelection);
      if (newSelection.size > 0 && domain.categories.length > 0) {
        setTargetCategoryId(domain.categories[0].id);
      }
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const clearSelection = () => {
    setSelectedSubElements(new Set());
    setTargetCategoryId(null);
  };

  const handleCreateElement = () => {
    if (!targetCategoryId || selectedSubElements.size === 0 || !newElementName.trim()) return;
    addElement(targetCategoryId, newElementName.trim());
    setShowCreateElementModal(false);
    setNewElementName('');
    clearSelection();
  };

  // Stocker le nom de la derniere categorie ajoutee pour creer un element
  const [lastAddedCategoryName, setLastAddedCategoryName] = useState<string | null>(null);

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const catName = newCategoryName.trim();
      setLastAddedCategoryName(catName);
      addCategory(domain.id, catName, 'horizontal');
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  // Effet pour creer automatiquement un element dans les categories vides
  React.useEffect(() => {
    // Pour la nouvelle categorie ajoutee
    if (lastAddedCategoryName) {
      const newCategory = domain.categories.find(c => c.name === lastAddedCategoryName && c.elements.length === 0);
      if (newCategory) {
        addElement(newCategory.id, 'Element 1');
        setLastAddedCategoryName(null);
        return;
      }
    }

    // Pour toutes les categories existantes sans element
    for (const category of domain.categories) {
      if (category.elements.length === 0) {
        addElement(category.id, 'Element 1');
        break; // Un seul a la fois pour eviter boucle infinie
      }
    }
  }, [domain.categories, lastAddedCategoryName, addElement]);

  // Ajouter un element a une categorie
  const handleAddElementToCategory = (categoryId: string) => {
    if (newElementNameInput.trim()) {
      addElement(categoryId, newElementNameInput.trim());
      setNewElementNameInput('');
      setAddingElementToCategoryId(null);
    }
  };

  const handleAddSubCategory = () => {
    if (!newSubCategoryName.trim()) return;

    // Trouver le premier element disponible dans toutes les categories
    let targetElementId: string | null = null;
    for (const category of domain.categories) {
      if (category.elements.length > 0) {
        targetElementId = category.elements[0].id;
        break;
      }
    }

    if (!targetElementId) {
      // Aucun element disponible - creer d'abord un element dans la premiere categorie
      if (domain.categories.length > 0) {
        addElement(domain.categories[0].id, 'Element 1');
        // On ne peut pas ajouter la sous-categorie immediatement car l'element n'est pas encore cree
        // On garde le modal ouvert pour que l'utilisateur reessaie
        alert('Un element a ete cree automatiquement. Cliquez a nouveau pour ajouter la sous-categorie.');
        return;
      } else {
        alert('Creez d\'abord une categorie avant d\'ajouter une sous-categorie.');
        return;
      }
    }

    addSubCategory(targetElementId, newSubCategoryName.trim(), 'vertical');
    setNewSubCategoryName('');
    setIsAddingSubCategory(false);
  };

  const handleAddSubElementInCell = (categoryId: string, subCatName: string) => {
    if (!newSubElementName.trim()) return;

    const name = newSubElementName.trim();

    // Trouver ou creer la sous-categorie dans le premier element de cette categorie
    const category = domain.categories.find(c => c.id === categoryId);
    if (!category || category.elements.length === 0) return;

    const firstElement = category.elements[0];
    const subCat = firstElement.subCategories.find(sc => sc.name === subCatName);

    if (subCat) {
      // Vérifier s'il existe des sous-éléments avec le même nom
      const matches = findSubElementsByName(name);

      if (matches.length > 0) {
        // Des sous-éléments avec ce nom existent - afficher le modal
        setPendingSubElementName(name);
        setPendingSubCategoryId(subCat.id);
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
        addSubElement(subCat.id, name);
        setNewSubElementName('');
        setAddingSubElementAt(null);
      }
    } else {
      // Creer la sous-categorie puis ajouter le sous-element
      addSubCategory(firstElement.id, subCatName, 'vertical');
      // Le sous-element sera ajoute apres re-render, on garde les infos
      // Pour l'instant, on informe l'utilisateur
      alert('Sous-categorie creee. Cliquez a nouveau pour ajouter le sous-element.');
      setNewSubElementName('');
      setAddingSubElementAt(null);
    }
  };

  const handleAddSubElement = (subCatId: string) => {
    if (newSubElementName.trim()) {
      const name = newSubElementName.trim();

      // Vérifier s'il existe des sous-éléments avec le même nom
      const matches = findSubElementsByName(name);

      if (matches.length > 0) {
        // Des sous-éléments avec ce nom existent - afficher le modal
        setPendingSubElementName(name);
        setPendingSubCategoryId(subCatId);
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
        addSubElement(subCatId, name);
        setNewSubElementName('');
        setAddingSubElementAt(null);
      }
    }
  };

  // Créer le sous-élément indépendamment (sans liaison)
  const handleCreateIndependent = () => {
    if (pendingSubCategoryId) {
      addSubElement(pendingSubCategoryId, pendingSubElementName);
      setNewSubElementName('');
      setAddingSubElementAt(null);
    }
    setShowLinkModal(false);
  };

  // Créer le sous-élément et le lier à un groupe existant
  const handleCreateLinked = (linkedGroupId: string) => {
    if (pendingSubCategoryId) {
      addSubElement(pendingSubCategoryId, pendingSubElementName);
      // Trouver le sous-élément qu'on vient de créer et le lier
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
      setAddingSubElementAt(null);
    }
    setShowLinkModal(false);
  };

  // Find subcategory ID for a given category and subcategory name
  const findSubCatId = (categoryId: string, subCatName: string): string | null => {
    const category = domain.categories.find(c => c.id === categoryId);
    if (!category) return null;
    for (const element of category.elements) {
      const subCat = element.subCategories.find(sc => sc.name === subCatName);
      if (subCat) return subCat.id;
    }
    return null;
  };

  const renderSubElementMini = (subElement: SubElement & { _elementId?: string; _elementName?: string }, categoryId: string) => {
    const colors = STATUS_COLORS[subElement.status] || STATUS_COLORS.ok;
    const isSelected = selectedSubElements.has(subElement.id);

    return (
      <div
        key={subElement.id}
        ref={(el) => { if (el) subElementRefs.current.set(subElement.id, el); }}
        onClick={(e) => { e.stopPropagation(); toggleSelection(subElement.id, categoryId, e); }}
        className={`relative p-1.5 rounded cursor-pointer transition-all select-none ${isSelected ? 'ring-2 ring-[#1E3A5F] ring-offset-1 scale-105' : ''} hover:scale-105`}
        style={{ backgroundColor: colors.hex }}
        title={`${subElement.name}${subElement._elementName ? ` (${subElement._elementName})` : ''}`}
      >
        <div className="flex items-center gap-1">
          {subElement.icon && <MuiIcon name={subElement.icon} size={12} className="text-white" />}
          <span className="text-[10px] text-white truncate max-w-[60px]">{subElement.name}</span>
          {isSelected && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#1E3A5F] rounded-full flex items-center justify-center">
              <MuiIcon name="Check" size={8} className="text-white" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Get selection rectangle style
  const getSelectionRectStyle = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) return { display: 'none' };

    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    return {
      position: 'absolute' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '2px dashed #1E3A5F',
      backgroundColor: 'rgba(30, 58, 95, 0.1)',
      pointerEvents: 'none' as const,
      zIndex: 100,
    };
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-auto">
      {/* Selection toolbar */}
      {!readOnly && selectedSubElements.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-3 p-2 bg-[#1E3A5F] text-white shadow-lg">
          <span className="text-sm font-medium">{selectedSubElements.size} sous-element{selectedSubElements.size > 1 ? 's' : ''} selectionne{selectedSubElements.size > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCreateElementModal(true)}
            className="px-3 py-1.5 bg-white text-[#1E3A5F] text-xs font-medium rounded-lg hover:bg-white/90 flex items-center gap-1"
          >
            <MuiIcon name="CreateNewFolder" size={14} />
            Creer un Element
          </button>
          <button onClick={clearSelection} className="px-2 py-1 text-white/70 hover:text-white text-xs">
            <MuiIcon name="Close" size={14} className="inline mr-1" />Annuler
          </button>
          <span className="text-xs text-white/60 ml-auto">Shift+clic ou rectangle pour selection multiple</span>
        </div>
      )}

      {/* Main grid */}
      <div
        ref={gridRef}
        className="flex-1 p-4 relative select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Selection rectangle */}
        <div style={getSelectionRectStyle()} />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table style={{ borderCollapse: "separate", borderSpacing: `0 ${categorySpacing}px`, tableLayout: "fixed" }}>
              <thead>
                <tr className="bg-[#1E3A5F]">
                  {/* Header corner avec bouton + et poignee redimensionnement */}
                  <th
                    className="p-2 border-r border-[#2C4A6E] sticky left-0 bg-[#1E3A5F] z-10 relative select-none"
                    style={{ width: `${categoryColumnWidth}px`, minWidth: '20px', maxWidth: '1000px' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {viewMode === 'expanded' ? (
                        <span className="text-xs text-white/70 whitespace-nowrap">Categories / Sous-cat</span>
                      ) : (
                        <span className="text-xs text-white/70">Categories</span>
                      )}

                      {/* Bouton ajouter sous-categorie */}
                      {!readOnly && viewMode === 'expanded' && !isAddingSubCategory && (
                        <button
                          onClick={() => setIsAddingSubCategory(true)}
                          className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0"
                          title="Ajouter une sous-categorie"
                        >
                          <MuiIcon name="Add" size={14} />
                        </button>
                      )}
                    </div>

                    {/* Formulaire ajout sous-categorie inline */}
                    {!readOnly && isAddingSubCategory && (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={newSubCategoryName}
                          onChange={(e) => setNewSubCategoryName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubCategory(); if (e.key === 'Escape') { setIsAddingSubCategory(false); setNewSubCategoryName(''); } }}
                          placeholder="Nom sous-cat"
                          className="flex-1 min-w-0 px-2 py-1 text-xs bg-white/10 border border-white/30 rounded text-white placeholder-white/50"
                          autoFocus
                        />
                        <button onClick={handleAddSubCategory} className="p-1 text-white hover:bg-white/10 rounded shrink-0"><MuiIcon name="Check" size={12} /></button>
                        <button onClick={() => { setIsAddingSubCategory(false); setNewSubCategoryName(''); }} className="p-1 text-white/50 hover:text-white shrink-0"><MuiIcon name="Close" size={12} /></button>
                      </div>
                    )}

                    {/* Poignee de redimensionnement */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                        resizeStartX.current = e.clientX;
                        resizeStartWidth.current = categoryColumnWidth;

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const delta = moveEvent.clientX - resizeStartX.current;
                          const newWidth = Math.max(20, Math.min(1000, resizeStartWidth.current + delta));
                          setCategoryColumnWidth(newWidth);
                          currentWidthRef.current = newWidth;
                        };

                        const handleMouseUp = () => {
                          setIsResizing(false);
                          localStorage.setItem(`gridCategoryColumnWidth_${domainStorageKey}`, String(currentWidthRef.current));
                          window.dispatchEvent(new Event(`gridColumnWidthChanged_${domainStorageKey}`));
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                  </th>

                  {/* Subcategory columns headers - redimensionnables */}
                  {allSubCategories.map((subCat) => {
                    const colWidth = subCatColumnWidths[subCat.name] || 120;
                    return (
                      <th
                        key={subCat.name}
                        className="p-2 border-r border-[#2C4A6E] last:border-r-0 relative"
                        style={{ width: `${colWidth}px`, minWidth: '20px', maxWidth: '600px' }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {subCat.icon && <MuiIcon name={subCat.icon} size={14} className="text-white" />}
                          <span className="text-xs text-white font-medium truncate">{subCat.name}</span>
                        </div>
                        {/* Poignee de redimensionnement */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSubCatResize(subCat.name, e.clientX, colWidth);
                          }}
                        />
                      </th>
                    );
                  })}


                </tr>
              </thead>

              <tbody>
                {viewMode === 'expanded' ? (
                  <>
                    {horizontalCategoriesInline ? (
                      /* MODE HORIZONTAL : Catégories avec éléments en ligne à gauche */
                      domain.categories.map((category, rowIndex) => (
                        <tr key={category.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}>
                          <td className="p-2 border-r border-[#E2E8F0] bg-[#F5F7FA] sticky left-0 z-10" style={{ width: `${categoryColumnWidth}px`, minWidth: '20px', maxWidth: '1000px', paddingBottom: `${categorySpacing}px` }}>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 shrink-0">
                                {category.icon && <MuiIcon name={category.icon} size={14} className="text-[#1E3A5F]" />}
                                <span className="text-xs text-[#1E3A5F] font-bold whitespace-nowrap">{category.name}</span>
                              </div>
                              <div className="w-px h-6 bg-[#E2E8F0] shrink-0" />
                              <div className="flex gap-1 flex-wrap items-center" style={{ gap: `${cellSpacing}px` }}>
                                {category.elements.map((element) => {
                                  const colors = getEffectiveColors(element, domains);
                                  const hexToRgba = (hex: string, alpha: number) => {
                                    const r = parseInt(hex.slice(1, 3), 16);
                                    const g = parseInt(hex.slice(3, 5), 16);
                                    const b = parseInt(hex.slice(5, 7), 16);
                                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                  };
                                  const isOk = colors.hex === STATUS_COLORS.ok.hex;
                                  const bgColor = isOk ? (greenTilesAsColored ? hexToRgba(colors.hex, 0.2) : '#FFFFFF') : hexToRgba(colors.hex, 0.2);
                                  return (
                                    <button key={element.id} onClick={() => onElementClick?.(element.id)}
                                      className="group flex items-center gap-1 px-2 py-1 rounded border cursor-pointer hover:scale-105 transition-all"
                                      style={{ backgroundColor: bgColor, borderColor: colors.hex, color: colors.hex }}
                                      title={`${element.name} - Cliquer pour voir les details`}>
                                      {element.icon && <MuiIcon name={element.icon} size={10} />}
                                      <span className="text-[10px] font-medium truncate max-w-[50px]">{element.name}</span>
                                      {!readOnly && (
                                        <span onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }}
                                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-opacity cursor-pointer" title="Supprimer">
                                          <MuiIcon name="Close" size={8} />
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                                {!readOnly && (
                                  addingElementToCategoryId === category.id ? (
                                    <div className="flex items-center gap-1">
                                      <input type="text" value={newElementNameInput} onChange={(e) => setNewElementNameInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddElementToCategory(category.id); if (e.key === 'Escape') { setAddingElementToCategoryId(null); setNewElementNameInput(''); } }}
                                        placeholder="Element" className="w-16 px-1 py-0.5 text-[10px] bg-white border border-[#E2E8F0] rounded text-[#1E3A5F]" autoFocus onClick={(e) => e.stopPropagation()} />
                                      <button onClick={(e) => { e.stopPropagation(); handleAddElementToCategory(category.id); }} className="p-0.5 text-[#1E3A5F] hover:bg-[#E2E8F0] rounded"><MuiIcon name="Check" size={10} /></button>
                                    </div>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setAddingElementToCategoryId(category.id); }} className="p-1 text-[#CBD5E1] hover:text-[#1E3A5F] hover:bg-white rounded transition-colors" title="Ajouter element">
                                      <MuiIcon name="Add" size={12} />
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </td>
                          {allSubCategories.map((subCat) => {
                            const categoryData = gridData.get(category.id);
                            const subElements = categoryData?.get(subCat.name) || [];
                            const subCatId = findSubCatId(category.id, subCat.name);
                            const isAdding = addingSubElementAt?.catId === category.id && addingSubElementAt?.subCatName === subCat.name;
                            const colWidth = subCatColumnWidths[subCat.name] || 120;
                            return (
                              <td key={subCat.name} className="p-1 border-r border-[#E2E8F0] last:border-r-0 align-top" style={{ width: `${colWidth}px`, minWidth: '20px', maxWidth: '600px' }}>
                                <SortableContext items={subElements.map(se => se.id)} strategy={rectSortingStrategy}>
                                  <div className="flex flex-wrap gap-1 min-h-[30px]">
                                    {subElements.map((se) => (
                                      <DraggableSubElement key={se.id} subElement={se} isSelected={selectedSubElements.has(se.id)}
                                        onSelect={(e) => toggleSelection(se.id, category.id, e)} readOnly={readOnly} />
                                    ))}
                                    {!readOnly && (isAdding ? (
                                      <div className="flex items-center gap-1 p-1">
                                        <input type="text" value={newSubElementName} onChange={(e) => setNewSubElementName(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { if (subCatId) handleAddSubElement(subCatId); else handleAddSubElementInCell(category.id, subCat.name); } if (e.key === 'Escape') { setAddingSubElementAt(null); setNewSubElementName(''); } }}
                                          placeholder="Nom" className="w-14 px-1 py-0.5 text-[10px] bg-[#F5F7FA] border border-[#E2E8F0] rounded text-[#1E3A5F]" autoFocus onClick={(e) => e.stopPropagation()} />
                                        <button onClick={(e) => { e.stopPropagation(); if (subCatId) handleAddSubElement(subCatId); else handleAddSubElementInCell(category.id, subCat.name); }} className="p-0.5 text-[#1E3A5F] hover:bg-[#E2E8F0] rounded"><MuiIcon name="Check" size={10} /></button>
                                      </div>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setAddingSubElementAt({ catId: category.id, subCatName: subCat.name }); }} className="p-1 text-[#CBD5E1] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors" title="Ajouter sous-element">
                                        <MuiIcon name="Add" size={12} />
                                      </button>
                                    ))}
                                  </div>
                                </SortableContext>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      /* MODE VERTICAL : Éléments empilés verticalement, sous-éléments à droite */
                      domain.categories.map((category, catIndex) => (
                        <React.Fragment key={category.id}>
                          {/* Ligne d'en-tête de catégorie */}
                          <tr className="bg-[#1E3A5F]/10">
                            <td colSpan={allSubCategories.length + 1} className="p-2 border-b border-[#E2E8F0]" style={{ marginTop: catIndex > 0 ? `${categorySpacing}px` : 0 }}>
                              <div className="flex items-center gap-2">
                                {category.icon && <MuiIcon name={category.icon} size={16} className="text-[#1E3A5F]" />}
                                <span className="text-sm text-[#1E3A5F] font-bold">{category.name}</span>
                                <span className="text-xs text-[#64748B]">({category.elements.length} élément{category.elements.length > 1 ? 's' : ''})</span>
                                {!readOnly && (
                                  addingElementToCategoryId === category.id ? (
                                    <div className="flex items-center gap-1 ml-auto">
                                      <input type="text" value={newElementNameInput} onChange={(e) => setNewElementNameInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddElementToCategory(category.id); if (e.key === 'Escape') { setAddingElementToCategoryId(null); setNewElementNameInput(''); } }}
                                        placeholder="Nouvel élément" className="px-2 py-1 text-xs bg-white border border-[#E2E8F0] rounded text-[#1E3A5F]" autoFocus />
                                      <button onClick={() => handleAddElementToCategory(category.id)} className="p-1 text-[#1E3A5F] hover:bg-white rounded"><MuiIcon name="Check" size={14} /></button>
                                      <button onClick={() => { setAddingElementToCategoryId(null); setNewElementNameInput(''); }} className="p-1 text-[#64748B] hover:text-[#1E3A5F]"><MuiIcon name="Close" size={14} /></button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setAddingElementToCategoryId(category.id)} className="ml-auto p-1 text-[#64748B] hover:text-[#1E3A5F] hover:bg-white rounded" title="Ajouter un élément">
                                      <MuiIcon name="Add" size={14} />
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Lignes des éléments de cette catégorie */}
                          {category.elements.map((element, elIndex) => {
                            const colors = getEffectiveColors(element, domains);
                            const hexToRgba = (hex: string, alpha: number) => {
                              const r = parseInt(hex.slice(1, 3), 16);
                              const g = parseInt(hex.slice(3, 5), 16);
                              const b = parseInt(hex.slice(5, 7), 16);
                              return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                            };
                            const isOk = colors.hex === STATUS_COLORS.ok.hex;
                            const bgColor = isOk ? (greenTilesAsColored ? hexToRgba(colors.hex, 0.15) : '#FFFFFF') : hexToRgba(colors.hex, 0.15);

                            return (
                              <tr key={element.id} className={elIndex % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}>
                                {/* Cellule de l'élément */}
                                <td className="p-2 border-r border-[#E2E8F0] sticky left-0 z-10"
                                  style={{ width: `${categoryColumnWidth}px`, minWidth: '20px', maxWidth: '1000px', backgroundColor: bgColor }}>
                                  <button onClick={() => onElementClick?.(element.id)}
                                    className="group flex items-center gap-2 w-full text-left cursor-pointer hover:opacity-80 transition-all"
                                    title={`${element.name} - Cliquer pour voir les details`}>
                                    {element.icon && <span style={{ color: colors.hex }}><MuiIcon name={element.icon} size={14} /></span>}
                                    <span className="text-xs font-medium truncate" style={{ color: colors.hex }}>{element.name}</span>
                                    {element.value && <span className="text-[10px] text-[#64748B]">{element.value}{element.unit ? ` ${element.unit}` : ''}</span>}
                                    {!readOnly && (
                                      <span onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }}
                                        className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-opacity" title="Supprimer">
                                        <MuiIcon name="Close" size={10} className="text-[#94A3B8]" />
                                      </span>
                                    )}
                                  </button>
                                </td>

                                {/* Cellules des sous-éléments par sous-catégorie */}
                                {allSubCategories.map((subCat) => {
                                  const elementData = elementGridData.get(element.id);
                                  const subElements = elementData?.get(subCat.name) || [];
                                  const subCatObj = element.subCategories.find(sc => sc.name === subCat.name);
                                  const subCatId = subCatObj?.id;
                                  const isAdding = addingSubElementAt?.catId === element.id && addingSubElementAt?.subCatName === subCat.name;
                                  const colWidth = subCatColumnWidths[subCat.name] || 120;
                                  const cellId = `cell_${element.id}_${subCat.name}`;

                                  return (
                                    <td key={subCat.name} id={cellId} className="p-1 border-r border-[#E2E8F0] last:border-r-0 align-top"
                                      style={{ width: `${colWidth}px`, minWidth: '20px', maxWidth: '600px' }}>
                                      <SortableContext items={[...subElements.map(se => se.id), cellId]} strategy={rectSortingStrategy}>
                                        <div className="flex flex-wrap gap-1 min-h-[28px]">
                                          {subElements.map((se) => (
                                            <DraggableSubElement key={se.id} subElement={se} isSelected={selectedSubElements.has(se.id)}
                                              onSelect={(e) => toggleSelection(se.id, category.id, e)} readOnly={readOnly} />
                                          ))}
                                          {!readOnly && (isAdding ? (
                                            <div className="flex items-center gap-1 p-1">
                                              <input type="text" value={newSubElementName} onChange={(e) => setNewSubElementName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    if (subCatId) handleAddSubElement(subCatId);
                                                    else {
                                                      // Créer la sous-catégorie si elle n'existe pas
                                                      addSubCategory(element.id, subCat.name, 'vertical');
                                                    }
                                                  }
                                                  if (e.key === 'Escape') { setAddingSubElementAt(null); setNewSubElementName(''); }
                                                }}
                                                placeholder="Nom" className="w-14 px-1 py-0.5 text-[10px] bg-[#F5F7FA] border border-[#E2E8F0] rounded text-[#1E3A5F]" autoFocus onClick={(e) => e.stopPropagation()} />
                                              <button onClick={(e) => { e.stopPropagation(); if (subCatId) handleAddSubElement(subCatId); }} className="p-0.5 text-[#1E3A5F] hover:bg-[#E2E8F0] rounded"><MuiIcon name="Check" size={10} /></button>
                                            </div>
                                          ) : (
                                            <button onClick={(e) => { e.stopPropagation(); setAddingSubElementAt({ catId: element.id, subCatName: subCat.name }); }}
                                              className="p-1 text-[#CBD5E1] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors" title="Ajouter sous-element">
                                              <MuiIcon name="Add" size={12} />
                                            </button>
                                          ))}
                                        </div>
                                      </SortableContext>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))
                    )}

                    {/* Add category row */}
                    {!readOnly && (
                      <tr className="bg-[#F5F7FA] border-t-2 border-[#E2E8F0]">
                        <td colSpan={allSubCategories.length + 2} className="p-3">
                          {!isAddingCategory ? (
                            <button
                              onClick={() => setIsAddingCategory(true)}
                              className="flex items-center gap-2 px-4 py-2 text-[#64748B] hover:text-[#1E3A5F] hover:bg-white rounded-lg transition-colors border-2 border-dashed border-[#E2E8F0] hover:border-[#1E3A5F] w-full justify-center"
                            >
                              <MuiIcon name="Add" size={16} />
                              <span className="text-sm font-medium">Ajouter une categorie</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setIsAddingCategory(false); setNewCategoryName(''); } }}
                                placeholder="Nom de la categorie"
                                className="flex-1 px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                                autoFocus
                              />
                              <button onClick={handleAddCategory} className="px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E]">
                                <MuiIcon name="Check" size={16} />
                              </button>
                              <button onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }} className="px-3 py-2 text-[#94A3B8] hover:text-[#1E3A5F]">
                                <MuiIcon name="Close" size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  /* Collapsed view: categories + sous-elements (sans elements) */
                  <>
                    {domain.categories.map((category, rowIndex) => (
                      <tr key={category.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}>
                        {/* Category name only (no elements in collapsed mode) */}
                        <td className="p-2 border-r border-[#E2E8F0] bg-[#F5F7FA] sticky left-0 z-10" style={{ width: `${categoryColumnWidth}px`, minWidth: '20px', maxWidth: '1000px' }}>
                          <div className="flex items-center gap-2">
                            {category.icon && <MuiIcon name={category.icon} size={14} className="text-[#1E3A5F]" />}
                            <span className="text-xs text-[#1E3A5F] font-bold whitespace-nowrap">{category.name}</span>
                            <span className="text-[10px] text-[#94A3B8]">({category.elements.length})</span>
                          </div>
                        </td>

                        {/* Cells: subcategory columns with sub-elements */}
                        {allSubCategories.map((subCat) => {
                          const categoryData = gridData.get(category.id);
                          const subElements = categoryData?.get(subCat.name) || [];
                          const colWidth = subCatColumnWidths[subCat.name] || 120;

                          return (
                            <td key={subCat.name} className="p-1 border-r border-[#E2E8F0] last:border-r-0 align-top" style={{ width: `${colWidth}px`, minWidth: '20px', maxWidth: '600px' }}>
                              <div className="flex flex-wrap gap-1 min-h-[20px]">
                                {subElements.map((se) => renderSubElementMini(se, category.id))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* DragOverlay pour le sous-élément en cours de drag */}
          <DragOverlay>
            {activeSubElement && (
              <div
                className="p-1.5 rounded shadow-lg"
                style={{ backgroundColor: STATUS_COLORS[activeSubElement.status]?.hex || STATUS_COLORS.ok.hex }}
              >
                <div className="flex items-center gap-1">
                  {activeSubElement.icon && <MuiIcon name={activeSubElement.icon} size={12} className="text-white" />}
                  <span className="text-[10px] text-white truncate max-w-[60px]">{activeSubElement.name}</span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modal de gestion des sous-elements selectionnes */}
      {showCreateElementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] shadow-2xl">
            <h3 className="text-lg font-bold text-[#1E3A5F] mb-2 flex items-center gap-2">
              <MuiIcon name="Assignment" size={24} />
              Attribuer {selectedSubElements.size} sous-element{selectedSubElements.size > 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-[#64748B] mb-4">
              Choisissez de creer un nouvel element ou d'attribuer la selection a un element existant.
            </p>

            {/* Choix du mode */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAssignMode('create')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${assignMode === 'create' ? 'bg-[#1E3A5F] text-white' : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E2E8F0]'}`}
              >
                <MuiIcon name="Add" size={16} className="inline mr-1" />
                Creer un element
              </button>
              <button
                onClick={() => setAssignMode('existing')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${assignMode === 'existing' ? 'bg-[#1E3A5F] text-white' : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E2E8F0]'}`}
              >
                <MuiIcon name="Link" size={16} className="inline mr-1" />
                Element existant
              </button>
            </div>

            {/* Categorie cible */}
            <div className="mb-4">
              <label className="block text-sm text-[#64748B] mb-1">Categorie cible</label>
              <select
                value={targetCategoryId || ''}
                onChange={(e) => { setTargetCategoryId(e.target.value); setTargetElementId(null); }}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              >
                {domain.categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Mode creer: nom de l'element */}
            {assignMode === 'create' && (
              <div className="mb-4">
                <label className="block text-sm text-[#64748B] mb-1">Nom du nouvel element</label>
                <input
                  type="text"
                  value={newElementName}
                  onChange={(e) => setNewElementName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateElement(); if (e.key === 'Escape') setShowCreateElementModal(false); }}
                  placeholder="Ex: Serveur Principal"
                  className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                  autoFocus
                />
              </div>
            )}

            {/* Mode existant: liste des elements */}
            {assignMode === 'existing' && targetCategoryId && (
              <div className="mb-4">
                <label className="block text-sm text-[#64748B] mb-1">Element cible</label>
                {(() => {
                  const targetCategory = domain.categories.find(c => c.id === targetCategoryId);
                  if (!targetCategory || targetCategory.elements.length === 0) {
                    return <p className="text-sm text-[#94A3B8] italic">Aucun element dans cette categorie</p>;
                  }
                  return (
                    <select
                      value={targetElementId || ''}
                      onChange={(e) => setTargetElementId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                    >
                      <option value="">-- Selectionnez un element --</option>
                      {targetCategory.elements.map(el => (
                        <option key={el.id} value={el.id}>{el.name}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowCreateElementModal(false); clearSelection(); setAssignMode('create'); }} className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors">
                Annuler
              </button>
              {assignMode === 'create' ? (
                <button
                  onClick={handleCreateElement}
                  disabled={!newElementName.trim() || !targetCategoryId}
                  className="px-4 py-2 bg-[#1E3A5F] text-white font-medium rounded-lg hover:bg-[#2C4A6E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <MuiIcon name="Add" size={16} />
                  Creer
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!targetElementId) return;
                    // TODO: Implementer l'attribution aux sous-categories de l'element existant
                    // Pour l'instant, on ferme le modal
                    alert('Attribution a un element existant - fonctionnalite a implementer');
                    setShowCreateElementModal(false);
                    clearSelection();
                    setAssignMode('create');
                  }}
                  disabled={!targetElementId}
                  className="px-4 py-2 bg-[#1E3A5F] text-white font-medium rounded-lg hover:bg-[#2C4A6E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <MuiIcon name="Link" size={16} />
                  Attribuer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
  );
}
