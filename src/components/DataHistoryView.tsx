import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import type { Cockpit, TileStatus, DataHistoryColumn, SubElementDataSnapshot } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { useLanguage } from '../contexts/LanguageContext';
import * as XLSX from 'xlsx';

// ============================================================================
// CONSTANTES DE VIRTUALISATION
// ============================================================================
const ROW_HEIGHT = 60; // Hauteur fixe d'une ligne en pixels
const BUFFER_ROWS = 5; // Nombre de lignes en buffer au-dessus/en-dessous

// ============================================================================
// HOOKS UTILITAIRES
// ============================================================================

// Hook pour debounce
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Mapping des statuts pour l'export/import
const STATUS_EXPORT_MAP: Record<TileStatus, string> = {
  'ok': 'OK',
  'mineur': 'Mineur',
  'critique': 'Critique',
  'fatal': 'Fatal',
  'deconnecte': 'Déconnecté',
  'information': 'Information',
  'herite': 'Hérité',
  'herite_domaine': 'Hérité domaine',
};

const STATUS_IMPORT_MAP: Record<string, TileStatus> = {
  'ok': 'ok',
  'mineur': 'mineur',
  'critique': 'critique',
  'fatal': 'fatal',
  'déconnecté': 'deconnecte',
  'deconnecte': 'deconnecte',
  'information': 'information',
  'hérité': 'herite',
  'herite': 'herite',
  'hérité domaine': 'herite_domaine',
  'herite_domaine': 'herite_domaine',
};

// ============================================================================
// COMPOSANTS ISOLÉS POUR ÉVITER LES RE-RENDERS
// ============================================================================

// Composant d'input isolé pour éviter les re-renders
interface EditableInputProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}

const EditableInput = memo(function EditableInput({ initialValue, onSave, onCancel, placeholder, className }: EditableInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleBlur = () => onSave(value);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onSave(value); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
});

// ============================================================================
// TYPES
// ============================================================================

interface DataHistoryViewProps {
  cockpit: Cockpit;
  readOnly?: boolean;
}

interface LocationInfo {
  domainId: string;
  domainName: string;
  categoryId: string;
  categoryName: string;
  elementId: string;
  elementName: string;
  subCategoryId: string;
  subCategoryName: string;
  fullPath: string;
}

interface UniqueSubElement {
  id: string;
  name: string;
  locations: string[];
  locationInfos: LocationInfo[];
  linkedGroupId?: string;
  linkedCount: number;
  originalIds: string[];
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function DataHistoryView({ cockpit, readOnly = false }: DataHistoryViewProps) {
  const { t } = useLanguage();
  const { updateCockpit, updateSubElement } = useCockpitStore();
  
  // États principaux
  const [columns, setColumns] = useState<DataHistoryColumn[]>(cockpit.dataHistory?.columns || []);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnDate, setNewColumnDate] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [editingCell, setEditingCell] = useState<{
    subElementId: string;
    columnDate: string;
    field: 'status' | 'value' | 'unit' | 'alertDescription';
  } | null>(null);

  // États pour les filtres
  const [filterDomainId, setFilterDomainId] = useState<string>('');
  const [filterElementId, setFilterElementId] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebouncedValue(searchText, 300);
  const [previousActiveDate, setPreviousActiveDate] = useState<string | null>(null);

  // États pour la virtualisation
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Référence pour l'import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTargetDate, setImportTargetDate] = useState<string>('');

  // ============================================================================
  // CALCULS MÉMORISÉS (useMemo)
  // ============================================================================

  // Collecter tous les sous-éléments uniques
  const uniqueSubElements = useMemo(() => {
    const subElementsMap = new Map<string, UniqueSubElement>();

    for (const domain of cockpit.domains) {
      for (const category of domain.categories || []) {
        for (const element of category.elements || []) {
          for (const subCat of element.subCategories || []) {
            for (const subElement of subCat.subElements || []) {
              const location = `${domain.name} > ${category.name} > ${element.name} > ${subCat.name}`;
              const locationInfo: LocationInfo = {
                domainId: domain.id,
                domainName: domain.name,
                categoryId: category.id,
                categoryName: category.name,
                elementId: element.id,
                elementName: element.name,
                subCategoryId: subCat.id,
                subCategoryName: subCat.name,
                fullPath: location,
              };
              const key = subElement.linkedGroupId || subElement.id;
              
              if (subElementsMap.has(key)) {
                const existing = subElementsMap.get(key)!;
                if (!existing.locations.includes(location)) {
                  existing.locations.push(location);
                  existing.locationInfos.push(locationInfo);
                }
                existing.linkedCount++;
                existing.originalIds.push(subElement.id);
                if (!existing.linkedGroupId && subElement.linkedGroupId) {
                  existing.linkedGroupId = subElement.linkedGroupId;
                }
              } else {
                subElementsMap.set(key, {
                  id: key,
                  name: subElement.name,
                  locations: [location],
                  locationInfos: [locationInfo],
                  linkedGroupId: subElement.linkedGroupId,
                  linkedCount: 1,
                  originalIds: [subElement.id],
                });
              }
            }
          }
        }
      }
    }

    for (const se of subElementsMap.values()) {
      if (se.linkedCount > 1 && !se.linkedGroupId) {
        se.linkedGroupId = se.id;
      }
    }

    return Array.from(subElementsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cockpit.domains]);

  // Liste des domaines disponibles
  const availableDomains = useMemo(() => {
    return cockpit.domains.map(d => ({ id: d.id, name: d.name }));
  }, [cockpit.domains]);

  // Liste des éléments disponibles
  const availableElements = useMemo(() => {
    const elements: { id: string; name: string; domainName: string }[] = [];
    const seen = new Set<string>();
    
    for (const domain of cockpit.domains) {
      if (filterDomainId && domain.id !== filterDomainId) continue;
      
      for (const category of domain.categories || []) {
        for (const element of category.elements || []) {
          if (!seen.has(element.id)) {
            seen.add(element.id);
            elements.push({ id: element.id, name: element.name, domainName: domain.name });
          }
        }
      }
    }
    
    return elements.sort((a, b) => a.name.localeCompare(b.name));
  }, [cockpit.domains, filterDomainId]);

  // Sous-éléments filtrés
  const filteredSubElements = useMemo(() => {
    let filtered = uniqueSubElements;
    
    if (filterDomainId || filterElementId) {
      filtered = filtered.filter(se => {
        return se.locationInfos.some(loc => {
          if (filterDomainId && loc.domainId !== filterDomainId) return false;
          if (filterElementId && loc.elementId !== filterElementId) return false;
          return true;
        });
      });
    }
    
    if (debouncedSearchText.trim()) {
      const searchLower = debouncedSearchText.toLowerCase().trim();
      const searchColumns = columns.slice(-2);
      
      filtered = filtered.filter(se => {
        if (se.name.toLowerCase().includes(searchLower)) return true;
        if (se.locations[0]?.toLowerCase().includes(searchLower)) return true;
        
        for (const col of searchColumns) {
          const cellData = col.data[se.id];
          if (cellData) {
            const statusLabel = STATUS_LABELS[cellData.status] || '';
            if (statusLabel.toLowerCase().includes(searchLower)) return true;
            if (cellData.value?.toLowerCase().includes(searchLower)) return true;
            if (cellData.unit?.toLowerCase().includes(searchLower)) return true;
            if (cellData.alertDescription?.toLowerCase().includes(searchLower)) return true;
          }
        }
        
        return false;
      });
    }
    
    return filtered;
  }, [uniqueSubElements, filterDomainId, filterElementId, debouncedSearchText, columns]);

  // Breadcrumb du filtre
  const filterBreadcrumb = useMemo(() => {
    const parts = [cockpit.name];
    if (filterDomainId) {
      const domain = availableDomains.find(d => d.id === filterDomainId);
      if (domain) parts.push(domain.name);
    }
    if (filterElementId) {
      const element = availableElements.find(e => e.id === filterElementId);
      if (element) parts.push(element.name);
    }
    return parts.join(' / ');
  }, [cockpit.name, filterDomainId, filterElementId, availableDomains, availableElements]);

  // Date active
  const activeDate = cockpit.selectedDataDate || columns[columns.length - 1]?.date;
  
  // Colonnes à afficher
  const displayedColumns = useMemo(() => {
    if (columns.length === 0) return [];
    if (columns.length === 1) return columns;
    
    const activeColumn = columns.find(c => c.date === activeDate);
    if (!activeColumn) return [columns[columns.length - 1]];
    
    if (!previousActiveDate) return [activeColumn];
    
    const previousColumn = columns.find(c => c.date === previousActiveDate);
    if (!previousColumn || previousActiveDate === activeDate) return [activeColumn];
    
    return [activeColumn, previousColumn];
  }, [columns, activeDate, previousActiveDate]);

  // ============================================================================
  // VIRTUALISATION - Calcul des lignes visibles
  // ============================================================================
  
  const { startIndex, visibleItems } = useMemo(() => {
    const totalItems = filteredSubElements.length;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
    const endIndex = Math.min(totalItems, startIndex + visibleCount);
    
    const visibleItems = filteredSubElements.slice(startIndex, endIndex);
    
    return { startIndex, visibleItems };
  }, [filteredSubElements, scrollTop, containerHeight]);

  // ============================================================================
  // HANDLERS (useCallback pour éviter les re-renders)
  // ============================================================================

  const saveToStore = useCallback((newColumns: DataHistoryColumn[]) => {
    const dataHistory = {
      columns: newColumns,
      subElements: uniqueSubElements.map(se => ({
        id: se.id,
        name: se.name,
        location: se.locations.join(' | '),
        linkedGroupId: se.linkedGroupId,
        linkedCount: se.linkedCount,
      })),
      lastUpdated: new Date().toISOString(),
    };
    updateCockpit({ dataHistory });
  }, [uniqueSubElements, updateCockpit]);

  const getCellData = useCallback((subElementId: string, columnDate: string): SubElementDataSnapshot => {
    const column = columns.find(c => c.date === columnDate);
    return column?.data[subElementId] || { status: 'ok' };
  }, [columns]);

  const handleSetEditingCell = useCallback((cell: { subElementId: string; columnDate: string; field: 'status' | 'value' | 'unit' | 'alertDescription' } | null) => {
    setEditingCell(cell);
  }, []);

  const handleUpdateCell = useCallback((
    subElementId: string,
    columnDate: string,
    field: keyof SubElementDataSnapshot,
    value: string,
    closeEditor: boolean = true
  ) => {
    setColumns(prevColumns => {
      const updatedColumns = prevColumns.map(col => {
        if (col.date !== columnDate) return col;
        
        const updatedData = { ...col.data };
        if (!updatedData[subElementId]) {
          updatedData[subElementId] = { status: 'ok' };
        }
        
        if (field === 'status') {
          updatedData[subElementId] = { ...updatedData[subElementId], status: value as TileStatus };
        } else {
          updatedData[subElementId] = { ...updatedData[subElementId], [field]: value || undefined };
        }
        
        return { ...col, data: updatedData };
      });
      
      // Sauvegarder de manière asynchrone pour ne pas bloquer
      setTimeout(() => saveToStore(updatedColumns), 0);
      
      return updatedColumns;
    });
    
    if (closeEditor) setEditingCell(null);
    
    // Synchroniser avec les sous-éléments si c'est la date active
    if (columnDate === activeDate) {
      const uniqueSE = uniqueSubElements.find(se => se.id === subElementId);
      if (uniqueSE) {
        for (const originalId of uniqueSE.originalIds) {
          const updates: Partial<{ status: TileStatus; value: string; unit: string }> = {};
          if (field === 'status') updates.status = value as TileStatus;
          else if (field === 'value') updates.value = value || undefined;
          else if (field === 'unit') updates.unit = value || undefined;
          updateSubElement(originalId, updates);
        }
      }
    }
  }, [activeDate, uniqueSubElements, saveToStore, updateSubElement]);

  // Handler de scroll optimisé avec RAF
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // Utiliser requestAnimationFrame pour throttle le scroll
    requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
    });
  }, []);

  // ============================================================================
  // EFFETS
  // ============================================================================

  // Détecter la hauteur du conteneur
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);
    
    return () => resizeObserver.disconnect();
  }, []);

  // Référence pour la date active précédente
  const previousActiveDateRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (activeDate && previousActiveDateRef.current && previousActiveDateRef.current !== activeDate) {
      setPreviousActiveDate(previousActiveDateRef.current);
    }
    previousActiveDateRef.current = activeDate || null;
  }, [activeDate]);

  // Reset du filtre élément quand on change de domaine
  useEffect(() => {
    if (filterDomainId) {
      const elementStillValid = availableElements.some(e => e.id === filterElementId);
      if (!elementStillValid) setFilterElementId('');
    }
  }, [filterDomainId, availableElements, filterElementId]);

  // Initialiser les colonnes
  useEffect(() => {
    if (columns.length === 0 && uniqueSubElements.length > 0) {
      initializeWithCurrentValues();
    }
  }, [uniqueSubElements]);

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  const initializeWithCurrentValues = () => {
    const today = new Date().toISOString().split('T')[0];
    const data: Record<string, SubElementDataSnapshot> = {};

    for (const domain of cockpit.domains) {
      for (const category of domain.categories || []) {
        for (const element of category.elements || []) {
          for (const subCat of element.subCategories || []) {
            for (const subElement of subCat.subElements || []) {
              const key = subElement.linkedGroupId || subElement.id;
              if (!data[key]) {
                data[key] = {
                  status: subElement.status,
                  value: subElement.value,
                  unit: subElement.unit,
                  alertDescription: subElement.alert?.description,
                };
              }
            }
          }
        }
      }
    }

    const initialColumn: DataHistoryColumn = { date: today, label: 'Données actuelles', data };
    setColumns([initialColumn]);
    saveToStore([initialColumn]);
  };

  const handleAddColumn = () => {
    if (!newColumnDate) return;
    if (columns.some(c => c.date === newColumnDate)) {
      alert('Cette date existe déjà');
      return;
    }

    const newData: Record<string, SubElementDataSnapshot> = {};
    
    if (columns.length > 0) {
      const newDateMs = new Date(newColumnDate).getTime();
      let closestColumn = columns[0];
      let minDistance = Math.abs(new Date(columns[0].date).getTime() - newDateMs);
      
      for (const col of columns) {
        const distance = Math.abs(new Date(col.date).getTime() - newDateMs);
        if (distance < minDistance) {
          minDistance = distance;
          closestColumn = col;
        }
      }
      
      for (const [key, value] of Object.entries(closestColumn.data)) {
        newData[key] = { ...value };
      }
    } else {
      for (const se of uniqueSubElements) {
        newData[se.id] = { status: 'ok' };
      }
    }

    const newColumn: DataHistoryColumn = { date: newColumnDate, label: newColumnLabel || undefined, data: newData };
    const updatedColumns = [...columns, newColumn].sort((a, b) => a.date.localeCompare(b.date));
    setColumns(updatedColumns);
    saveToStore(updatedColumns);
    
    setIsAddingColumn(false);
    setNewColumnDate('');
    setNewColumnLabel('');
  };

  const handleDeleteColumn = (date: string) => {
    if (!confirm(`Supprimer la colonne du ${date} ?`)) return;
    const updatedColumns = columns.filter(c => c.date !== date);
    setColumns(updatedColumns);
    saveToStore(updatedColumns);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const generateExportFileName = (date: string) => {
    const now = new Date();
    const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const year = parisTime.getFullYear();
    const month = String(parisTime.getMonth() + 1).padStart(2, '0');
    const day = String(parisTime.getDate()).padStart(2, '0');
    const hours = String(parisTime.getHours()).padStart(2, '0');
    const minutes = String(parisTime.getMinutes()).padStart(2, '0');
    const seconds = String(parisTime.getSeconds()).padStart(2, '0');
    const dateStamp = `${year}${month}${day}`;
    const timeStamp = `${hours}${minutes}${seconds}`;
    const cleanName = cockpit.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
    const cleanDate = date.replace(/-/g, '');
    return `${dateStamp} SOMONE Cockpit Data ${cleanName} ${cleanDate} ${timeStamp}.xlsx`;
  };

  const handleExportDate = (date: string) => {
    const column = columns.find(c => c.date === date);
    if (!column) return;

    const exportData: any[] = [];
    const exportedIds = new Set<string>();
    
    for (const se of filteredSubElements) {
      if (exportedIds.has(se.id)) continue;
      exportedIds.add(se.id);
      
      const cellData = column.data[se.id] || { status: 'ok' };
      const firstLocation = se.locationInfos[0];
      const allLocations = se.linkedCount > 1 
        ? se.locationInfos.map(loc => `${loc.domainName} > ${loc.elementName}`).join(' | ')
        : '';
      const isLinked = se.linkedCount > 1 || !!se.linkedGroupId;
      
      exportData.push({
        'Maquette': cockpit.name,
        'Domaine': firstLocation?.domainName || '',
        'Élément': firstLocation?.elementName || '',
        'Sous-élément': se.name,
        'Lié': isLinked ? `Oui (${se.linkedCount})` : 'Non',
        'Localisations': allLocations,
        'Criticité': STATUS_EXPORT_MAP[cellData.status] || cellData.status,
        'Valeur': cellData.value || '',
        'Unité': cellData.unit || '',
        'Description': cellData.alertDescription || '',
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 15 },
      { wch: 50 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 40 },
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Données');
    XLSX.writeFile(wb, generateExportFileName(date));
  };

  const handleImportDate = (date: string) => {
    setImportTargetDate(date);
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importTargetDate) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      let sheetName: string;
      if (workbook.SheetNames.length === 1) {
        sheetName = workbook.SheetNames[0];
      } else {
        const dateFormatted = importTargetDate.replace(/-/g, '');
        const matchingSheet = workbook.SheetNames.find(name => name === dateFormatted);
        
        if (matchingSheet) {
          sheetName = matchingSheet;
        } else {
          const dateOfDaySheet = workbook.SheetNames.find(name => name === 'Date du jour');
          if (dateOfDaySheet) {
            sheetName = dateOfDaySheet;
          } else {
            alert(`Aucun onglet "${dateFormatted}" ni "Date du jour" trouvé.\nUtilisation du premier onglet.`);
            sheetName = workbook.SheetNames[0];
          }
        }
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        alert('Le fichier est vide ou mal formaté');
        return;
      }

      const existingColumn = columns.find(c => c.date === importTargetDate);
      let updatedColumns = [...columns];
      
      let targetColumn: DataHistoryColumn;
      if (existingColumn) {
        targetColumn = { ...existingColumn, data: { ...existingColumn.data } };
      } else {
        targetColumn = { date: importTargetDate, data: {} };
      }

      let updated = 0;
      let notFound = 0;

      const getRowValue = (row: any, ...keys: string[]): any => {
        for (const key of keys) {
          if (row[key] !== undefined) return row[key];
          const cleanKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (row[cleanKey] !== undefined) return row[cleanKey];
        }
        return undefined;
      };

      for (const row of jsonData) {
        const domainName = getRowValue(row, 'Domaine', 'Domain');
        const elementName = getRowValue(row, 'Élément', 'Element', 'Élement');
        const subElementName = getRowValue(row, 'Sous-élément', 'Sous-element', 'SubElement', 'Sous-élement');
        const criticite = getRowValue(row, 'Criticité', 'Criticite', 'Status');
        const valeur = getRowValue(row, 'Valeur', 'Value');
        const unite = getRowValue(row, 'Unité', 'Unite', 'Unit');
        const description = getRowValue(row, 'Description');

        if (!subElementName) { notFound++; continue; }

        let matchedSE = uniqueSubElements.find(se => {
          if (se.name !== subElementName) return false;
          if (domainName || elementName) {
            return se.locationInfos.some(loc => {
              const domainMatch = !domainName || loc.domainName === domainName;
              const elementMatch = !elementName || loc.elementName === elementName;
              return domainMatch && elementMatch;
            });
          }
          return true;
        });

        if (!matchedSE) { notFound++; continue; }

        const existingData = targetColumn.data[matchedSE.id] || { status: 'ok' as TileStatus };
        const newData: SubElementDataSnapshot = { ...existingData };

        if (criticite !== undefined && criticite !== '') {
          const normalizedStatus = criticite.toString().toLowerCase().trim();
          newData.status = STATUS_IMPORT_MAP[normalizedStatus] || newData.status;
        }
        if (valeur !== undefined && valeur !== '') newData.value = String(valeur);
        if (unite !== undefined && unite !== '') newData.unit = String(unite);
        if (description !== undefined && description !== '') newData.alertDescription = String(description);

        targetColumn.data[matchedSE.id] = newData;
        updated++;

        if (importTargetDate === activeDate) {
          for (const originalId of matchedSE.originalIds) {
            const updates: Partial<{ status: TileStatus; value: string; unit: string }> = {};
            if (criticite !== undefined && criticite !== '') {
              const normalizedStatus = criticite.toString().toLowerCase().trim();
              const mappedStatus = STATUS_IMPORT_MAP[normalizedStatus];
              if (mappedStatus) updates.status = mappedStatus;
            }
            if (valeur !== undefined && valeur !== '') updates.value = String(valeur);
            if (unite !== undefined && unite !== '') updates.unit = String(unite);
            if (Object.keys(updates).length > 0) updateSubElement(originalId, updates);
          }
        }
      }

      if (existingColumn) {
        updatedColumns = updatedColumns.map(col => col.date === importTargetDate ? targetColumn : col);
      } else {
        updatedColumns.push(targetColumn);
      }
      updatedColumns = updatedColumns.sort((a, b) => a.date.localeCompare(b.date));
      
      setColumns(updatedColumns);
      saveToStore(updatedColumns);

      alert(`Import terminé !\n${updated} sous-élément(s) mis à jour\n${notFound} ligne(s) non trouvée(s)`);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert('Erreur lors de la lecture du fichier Excel');
    }

    event.target.value = '';
    setImportTargetDate('');
  };

  // ============================================================================
  // RENDU D'UNE LIGNE (VIRTUALISÉE)
  // ============================================================================
  
  const renderRow = useCallback((se: UniqueSubElement, _idx: number, actualIndex: number) => {
    const bgColor = actualIndex % 2 === 0 ? 'white' : '#F5F7FA';
    
    return (
      <tr 
        key={se.id} 
        style={{ 
          backgroundColor: bgColor,
          height: ROW_HEIGHT,
        }}
      >
        <td className="sticky left-0 z-10 p-2 border-r border-[#E2E8F0] align-top" style={{ backgroundColor: bgColor }}>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#1E3A5F] text-sm truncate">{se.name}</span>
              {(se.linkedCount > 1 || se.linkedGroupId) && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full whitespace-nowrap">
                  🔗 {se.linkedCount}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#64748B] truncate" title={se.locations[0]}>
              {se.locationInfos[0]?.elementName || se.locations[0]?.split(' > ').slice(-2).join(' > ')}
            </span>
          </div>
        </td>
        
        {displayedColumns.map((col) => {
          const cellData = getCellData(se.id, col.date);
          const statusColors = STATUS_COLORS[cellData.status] || STATUS_COLORS.ok;
          const isEditing = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date;
          const isActiveColumn = col.date === activeDate;
          const activeBg = isActiveColumn ? 'bg-violet-50' : '';
          
          return (
            <React.Fragment key={col.date}>
              {/* Criticité */}
              <td className={`p-1 border-r border-[#E2E8F0] text-center align-middle ${activeBg}`}>
                {isEditing && editingCell?.field === 'status' ? (
                  <select
                    value={cellData.status}
                    onChange={(e) => handleUpdateCell(se.id, col.date, 'status', e.target.value)}
                    onBlur={() => handleSetEditingCell(null)}
                    autoFocus
                    className="w-full px-1 py-0.5 text-[10px] border border-[#E2E8F0] rounded"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <div 
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white cursor-pointer hover:opacity-80`}
                    style={{ backgroundColor: statusColors.hex }}
                    onClick={() => !readOnly && handleSetEditingCell({ subElementId: se.id, columnDate: col.date, field: 'status' })}
                  >
                    {STATUS_LABELS[cellData.status]}
                  </div>
                )}
              </td>
              
              {/* Valeur */}
              <td className={`p-1 border-r border-[#E2E8F0] text-center align-middle ${activeBg}`}>
                {isEditing && editingCell?.field === 'value' ? (
                  <EditableInput
                    initialValue={cellData.value || ''}
                    onSave={(val) => handleUpdateCell(se.id, col.date, 'value', val, true)}
                    onCancel={() => handleSetEditingCell(null)}
                    className="w-full px-1 py-0.5 border border-[#E2E8F0] rounded text-[10px] text-center"
                  />
                ) : (
                  <span 
                    className={`text-xs text-[#1E3A5F] ${!readOnly ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => !readOnly && handleSetEditingCell({ subElementId: se.id, columnDate: col.date, field: 'value' })}
                  >
                    {cellData.value || '—'}
                  </span>
                )}
              </td>
              
              {/* Unité */}
              <td className={`p-1 border-r border-[#E2E8F0] text-center align-middle ${activeBg}`}>
                {isEditing && editingCell?.field === 'unit' ? (
                  <EditableInput
                    initialValue={cellData.unit || ''}
                    onSave={(val) => handleUpdateCell(se.id, col.date, 'unit', val, true)}
                    onCancel={() => handleSetEditingCell(null)}
                    className="w-full px-1 py-0.5 border border-[#E2E8F0] rounded text-[10px] text-center"
                  />
                ) : (
                  <span 
                    className={`text-[10px] text-[#64748B] ${!readOnly ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => !readOnly && handleSetEditingCell({ subElementId: se.id, columnDate: col.date, field: 'unit' })}
                  >
                    {cellData.unit || '—'}
                  </span>
                )}
              </td>
              
              {/* Description */}
              <td className={`p-1 border-r border-[#E2E8F0] text-left align-middle ${activeBg}`}>
                {isEditing && editingCell?.field === 'alertDescription' ? (
                  <EditableInput
                    initialValue={cellData.alertDescription || ''}
                    onSave={(val) => handleUpdateCell(se.id, col.date, 'alertDescription', val, true)}
                    onCancel={() => handleSetEditingCell(null)}
                    className="w-full px-1 py-0.5 border border-[#E2E8F0] rounded text-[10px]"
                  />
                ) : (
                  <span 
                    className={`text-[10px] text-[#64748B] ${!readOnly ? 'cursor-pointer hover:underline' : ''} line-clamp-1`}
                    onClick={() => !readOnly && handleSetEditingCell({ subElementId: se.id, columnDate: col.date, field: 'alertDescription' })}
                    title={cellData.alertDescription || ''}
                  >
                    {cellData.alertDescription || '—'}
                  </span>
                )}
              </td>
            </React.Fragment>
          );
        })}
      </tr>
    );
  }, [displayedColumns, activeDate, editingCell, readOnly, getCellData, handleUpdateCell, handleSetEditingCell]);

  // ============================================================================
  // RENDU PRINCIPAL
  // ============================================================================

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-hidden">
      {/* Input file caché pour l'import */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileImport} className="hidden" />
      
      {/* En-tête compact */}
      <div className="shrink-0 bg-white border-b border-[#E2E8F0] shadow-sm">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
              <MuiIcon name="TableChart" size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1E3A5F]">{t('dataHistory.title') || 'Historique des données'}</h2>
              <p className="text-[10px] text-[#64748B]">
                {filteredSubElements.length} / {uniqueSubElements.length} sous-éléments • {columns.length} date{columns.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {!readOnly && columns.length === 0 && (
            <button onClick={initializeWithCurrentValues} className="flex items-center gap-1 px-3 py-1.5 bg-violet-500 text-white rounded-lg hover:bg-violet-600 text-xs">
              <MuiIcon name="Refresh" size={14} />
              Initialiser
            </button>
          )}
        </div>
        
        {/* Calendrier compact */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {columns.map((col) => {
              const isActive = activeDate === col.date;
              const dateObj = new Date(col.date);
              
              return (
                <button
                  key={col.date}
                  onClick={() => !readOnly && updateCockpit({ selectedDataDate: col.date })}
                  className={`
                    relative flex flex-col items-center min-w-[60px] px-2 py-1 rounded-lg border transition-all text-[10px]
                    ${isActive 
                      ? 'bg-violet-500 border-violet-600 text-white' 
                      : 'bg-white border-[#E2E8F0] text-[#1E3A5F] hover:border-violet-300'
                    }
                  `}
                >
                  {isActive && <span className="absolute -top-1.5 px-1 bg-amber-400 text-amber-900 text-[8px] font-bold rounded">{t('dataHistory.active')}</span>}
                  <span className="font-bold">{dateObj.getDate()}</span>
                  <span className={isActive ? 'text-violet-200' : 'text-[#64748B]'}>
                    {dateObj.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </button>
              );
            })}
            
            {/* Bouton ajouter */}
            {!readOnly && (
              !isAddingColumn ? (
                <button
                  onClick={() => setIsAddingColumn(true)}
                  className="flex flex-col items-center min-w-[60px] px-2 py-1 rounded-lg border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] text-[10px]"
                >
                  <MuiIcon name="Add" size={16} />
                  <span>Ajouter</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-[#1E3A5F]">
                  <input
                    type="date"
                    value={newColumnDate}
                    onChange={(e) => setNewColumnDate(e.target.value)}
                    className="px-1 py-0.5 border border-[#E2E8F0] rounded text-[10px] w-28"
                    autoFocus
                  />
                  <button onClick={handleAddColumn} disabled={!newColumnDate} className="px-2 py-0.5 bg-green-500 text-white rounded text-[10px] disabled:opacity-50">
                    <MuiIcon name="Check" size={12} />
                  </button>
                  <button onClick={() => { setIsAddingColumn(false); setNewColumnDate(''); }} className="px-1 py-0.5 text-[#64748B] hover:text-red-500 text-[10px]">
                    <MuiIcon name="Close" size={12} />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Tableau virtualisé */}
      <div className="flex-1 p-2 overflow-hidden">
        {uniqueSubElements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#64748B]">
            <MuiIcon name="Info" size={48} className="mb-4 opacity-50" />
            <p>Aucun sous-élément dans cette maquette</p>
          </div>
        ) : (
          <div 
            ref={tableContainerRef}
            className="h-full bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-auto"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse table-fixed" style={{ minWidth: 200 + displayedColumns.length * 280 }}>
              {/* Définition des largeurs de colonnes */}
              <colgroup>
                <col style={{ width: 200 }} />
                {displayedColumns.map((col) => (
                  <React.Fragment key={col.date}>
                    <col style={{ width: 80 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 50 }} />
                    <col style={{ width: 80 }} />
                  </React.Fragment>
                ))}
              </colgroup>
              
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#1E3A5F] text-white">
                  <th rowSpan={2} className="sticky left-0 z-30 bg-[#1E3A5F] p-2 text-left text-[10px] font-medium border-r border-[#2C4A6E]">
                    {/* Filtres compacts */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-cyan-300 text-[9px]">
                        <MuiIcon name="FilterList" size={10} />
                        <span className="truncate">{filterBreadcrumb}</span>
                        {(filterDomainId || filterElementId || searchText) && (
                          <button onClick={() => { setFilterDomainId(''); setFilterElementId(''); setSearchText(''); }} className="px-1 bg-white/20 rounded text-[8px]">✕</button>
                        )}
                      </div>
                      <select value={filterDomainId} onChange={(e) => setFilterDomainId(e.target.value)} className="w-full px-1 py-0.5 text-[9px] bg-[#2C4A6E] border border-[#3D5A7E] rounded text-white">
                        <option value="">Tous domaines</option>
                        {availableDomains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <div className="relative">
                        <input
                          type="text"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          placeholder="Rechercher..."
                          className="w-full pl-5 pr-1 py-0.5 text-[9px] bg-[#2C4A6E] border border-[#3D5A7E] rounded text-white placeholder-white/40"
                        />
                        <MuiIcon name="Search" size={10} className="absolute left-1 top-1/2 -translate-y-1/2 text-white/50" />
                      </div>
                    </div>
                  </th>
                  {displayedColumns.map((col) => {
                    const isActiveColumn = col.date === activeDate;
                    return (
                      <th key={col.date} colSpan={4} className={`p-1 text-center text-[10px] font-medium border-r border-[#2C4A6E] ${isActiveColumn ? 'bg-violet-700' : ''}`}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-center gap-1">
                            {isActiveColumn && <span className="px-1 bg-amber-400 text-amber-900 text-[8px] font-bold rounded">{t('dataHistory.active')}</span>}
                            <span>{col.label || formatDate(col.date)}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleExportDate(col.date)} className="px-1 py-0.5 text-[8px] bg-green-600 hover:bg-green-700 rounded">{t('dataHistory.export')}</button>
                            {!readOnly && <button onClick={() => handleImportDate(col.date)} className="px-1 py-0.5 text-[8px] bg-orange-600 hover:bg-orange-700 rounded">{t('dataHistory.import')}</button>}
                            {!readOnly && columns.length > 1 && <button onClick={() => handleDeleteColumn(col.date)} className="px-1 py-0.5 text-[8px] bg-red-600 hover:bg-red-700 rounded">✕</button>}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-[#2C4A6E] text-white">
                  {displayedColumns.map((col) => {
                    const isActiveColumn = col.date === activeDate;
                    return (
                      <React.Fragment key={col.date}>
                        <th className={`p-1 text-center text-[9px] font-medium border-r border-[#3D5A7E] ${isActiveColumn ? 'bg-violet-600' : ''}`}>Criticité</th>
                        <th className={`p-1 text-center text-[9px] font-medium border-r border-[#3D5A7E] ${isActiveColumn ? 'bg-violet-600' : ''}`}>Valeur</th>
                        <th className={`p-1 text-center text-[9px] font-medium border-r border-[#3D5A7E] ${isActiveColumn ? 'bg-violet-600' : ''}`}>Unité</th>
                        <th className={`p-1 text-center text-[9px] font-medium border-r border-[#3D5A7E] ${isActiveColumn ? 'bg-violet-600' : ''}`}>Description</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              
              <tbody>
                {/* Espaceur virtuel au-dessus */}
                {startIndex > 0 && (
                  <tr style={{ height: startIndex * ROW_HEIGHT }}>
                    <td colSpan={1 + displayedColumns.length * 4}></td>
                  </tr>
                )}
                
                {/* Lignes visibles */}
                {visibleItems.map((se, idx) => renderRow(se, idx, startIndex + idx))}
                
                {/* Espaceur virtuel en-dessous */}
                {(startIndex + visibleItems.length) < filteredSubElements.length && (
                  <tr style={{ height: (filteredSubElements.length - startIndex - visibleItems.length) * ROW_HEIGHT }}>
                    <td colSpan={1 + displayedColumns.length * 4}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
