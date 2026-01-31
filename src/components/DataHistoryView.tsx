import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Cockpit, TileStatus, DataHistoryColumn, SubElementDataSnapshot } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { useLanguage } from '../contexts/LanguageContext';
import * as XLSX from 'xlsx';

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

// Composant d'input isolé pour éviter les re-renders
interface EditableInputProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}

function EditableInput({ initialValue, onSave, onCancel, placeholder, className }: EditableInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus l'input au montage
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleBlur = () => {
    onSave(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
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
}

interface DataHistoryViewProps {
  cockpit: Cockpit;
  readOnly?: boolean;
}

// Informations de localisation détaillée
interface LocationInfo {
  domainId: string;
  domainName: string;
  categoryId: string;
  categoryName: string;
  elementId: string;
  elementName: string;
  subCategoryId: string;
  subCategoryName: string;
  fullPath: string; // Chemin complet pour affichage
}

// Collecter tous les sous-éléments uniques de la maquette
interface UniqueSubElement {
  id: string; // subElementId ou linkedGroupId
  name: string;
  locations: string[]; // Toutes les localisations (plusieurs si liés) - pour compatibilité
  locationInfos: LocationInfo[]; // Informations détaillées de localisation
  linkedGroupId?: string;
  linkedCount: number;
  originalIds: string[]; // IDs des sous-éléments originaux (pour mise à jour)
}

export default function DataHistoryView({ cockpit, readOnly = false }: DataHistoryViewProps) {
  const { t } = useLanguage();
  const { updateCockpit, updateSubElement } = useCockpitStore();
  
  // État local pour les colonnes de données
  const [columns, setColumns] = useState<DataHistoryColumn[]>(
    cockpit.dataHistory?.columns || []
  );
  
  // État pour l'ajout de nouvelle colonne
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnDate, setNewColumnDate] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  
  // État pour l'édition d'une cellule
  const [editingCell, setEditingCell] = useState<{
    subElementId: string;
    columnDate: string;
    field: 'status' | 'value' | 'unit' | 'alertDescription';
  } | null>(null);

  // États pour les filtres hiérarchiques
  const [filterDomainId, setFilterDomainId] = useState<string>('');
  const [filterElementId, setFilterElementId] = useState<string>('');
  // État pour la recherche textuelle
  const [searchText, setSearchText] = useState<string>('');
  // État pour la date précédemment active (pas chronologique, mais dernière date sélectionnée)
  const [previousActiveDate, setPreviousActiveDate] = useState<string | null>(null);

  // Collecter tous les sous-éléments uniques avec leurs informations de localisation
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
                // Ajouter la localisation si c'est un sous-élément lié
                const existing = subElementsMap.get(key)!;
                if (!existing.locations.includes(location)) {
                  existing.locations.push(location);
                  existing.locationInfos.push(locationInfo);
                }
                existing.linkedCount++;
                existing.originalIds.push(subElement.id);
              } else {
                // Nouveau sous-élément
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

    return Array.from(subElementsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cockpit.domains]);

  // Liste des domaines disponibles
  const availableDomains = useMemo(() => {
    return cockpit.domains.map(d => ({ id: d.id, name: d.name }));
  }, [cockpit.domains]);

  // Liste des éléments disponibles (filtrés par domaine si sélectionné)
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

  // Sous-éléments filtrés (par domaine, élément et recherche textuelle)
  const filteredSubElements = useMemo(() => {
    let filtered = uniqueSubElements;
    
    // Filtre par domaine et élément
    if (filterDomainId || filterElementId) {
      filtered = filtered.filter(se => {
        return se.locationInfos.some(loc => {
          if (filterDomainId && loc.domainId !== filterDomainId) return false;
          if (filterElementId && loc.elementId !== filterElementId) return false;
          return true;
        });
      });
    }
    
    // Filtre par recherche textuelle (insensible à la casse)
    // Recherche dans : nom, chemins, criticités, valeurs, unités, descriptions
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(se => {
        // Recherche dans le nom
        if (se.name.toLowerCase().includes(searchLower)) return true;
        
        // Recherche dans les chemins (localisations)
        if (se.locations.some(loc => loc.toLowerCase().includes(searchLower))) return true;
        
        // Recherche dans les données de toutes les colonnes
        for (const col of columns) {
          const cellData = col.data[se.id];
          if (cellData) {
            // Recherche dans la criticité (label traduit)
            const statusLabel = STATUS_LABELS[cellData.status] || '';
            if (statusLabel.toLowerCase().includes(searchLower)) return true;
            
            // Recherche dans la valeur
            if (cellData.value && cellData.value.toLowerCase().includes(searchLower)) return true;
            
            // Recherche dans l'unité
            if (cellData.unit && cellData.unit.toLowerCase().includes(searchLower)) return true;
            
            // Recherche dans la description
            if (cellData.alertDescription && cellData.alertDescription.toLowerCase().includes(searchLower)) return true;
          }
        }
        
        return false;
      });
    }
    
    return filtered;
  }, [uniqueSubElements, filterDomainId, filterElementId, searchText, columns]);

  // Construire le breadcrumb du filtre actuel
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

  // Calculer la date active
  const activeDate = cockpit.selectedDataDate || columns[columns.length - 1]?.date;
  
  // Référence pour stocker la date active précédente (pour détecter les changements)
  const previousActiveDateRef = React.useRef<string | null>(null);
  
  // Détecter les changements de date active et sauvegarder l'ancienne
  useEffect(() => {
    if (activeDate && previousActiveDateRef.current && previousActiveDateRef.current !== activeDate) {
      // La date active a changé, sauvegarder l'ancienne comme "précédente"
      setPreviousActiveDate(previousActiveDateRef.current);
    }
    previousActiveDateRef.current = activeDate || null;
  }, [activeDate]);
  
  // Colonnes à afficher dans le tableau : date active (gauche) + date précédemment active (droite)
  const displayedColumns = useMemo(() => {
    if (columns.length === 0) return [];
    if (columns.length === 1) return columns;
    
    // Trouver la colonne de la date active
    const activeColumn = columns.find(c => c.date === activeDate);
    if (!activeColumn) {
      // Date active non trouvée, afficher la dernière
      return [columns[columns.length - 1]];
    }
    
    // Si pas de date précédemment active, afficher seulement la date active
    if (!previousActiveDate) {
      return [activeColumn];
    }
    
    // Trouver la colonne de la date précédemment active
    const previousColumn = columns.find(c => c.date === previousActiveDate);
    if (!previousColumn || previousActiveDate === activeDate) {
      // Date précédente non trouvée ou identique à l'active, afficher seulement l'active
      return [activeColumn];
    }
    
    // Afficher la date active (gauche) + la date précédemment active (droite)
    return [activeColumn, previousColumn];
  }, [columns, activeDate, previousActiveDate]);

  // Reset du filtre élément quand on change de domaine
  useEffect(() => {
    if (filterDomainId) {
      // Vérifier si l'élément sélectionné appartient toujours au domaine
      const elementStillValid = availableElements.some(e => e.id === filterElementId);
      if (!elementStillValid) {
        setFilterElementId('');
      }
    }
  }, [filterDomainId, availableElements, filterElementId]);

  // Initialiser les colonnes avec les valeurs actuelles si vide
  useEffect(() => {
    if (columns.length === 0 && uniqueSubElements.length > 0) {
      initializeWithCurrentValues();
    }
  }, [uniqueSubElements]);

  // Fonction pour initialiser avec les valeurs actuelles
  const initializeWithCurrentValues = () => {
    const today = new Date().toISOString().split('T')[0];
    const data: Record<string, SubElementDataSnapshot> = {};

    // Parcourir tous les sous-éléments pour récupérer leurs valeurs actuelles
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

    const initialColumn: DataHistoryColumn = {
      date: today,
      label: 'Données actuelles',
      data,
    };

    setColumns([initialColumn]);
    saveToStore([initialColumn]);
  };

  // Sauvegarder dans le store
  const saveToStore = (newColumns: DataHistoryColumn[]) => {
    const dataHistory = {
      columns: newColumns,
      subElements: uniqueSubElements.map(se => ({
        id: se.id,
        name: se.name,
        location: se.locations.join(' | '), // Concaténer les localisations
        linkedGroupId: se.linkedGroupId,
        linkedCount: se.linkedCount,
      })),
      lastUpdated: new Date().toISOString(),
    };
    
    updateCockpit({ dataHistory });
  };

  // Ajouter une nouvelle colonne
  const handleAddColumn = () => {
    if (!newColumnDate) return;

    // Vérifier si la date existe déjà
    if (columns.some(c => c.date === newColumnDate)) {
      alert('Cette date existe déjà');
      return;
    }

    // Trouver la date la plus proche pour copier ses données
    const newData: Record<string, SubElementDataSnapshot> = {};
    
    if (columns.length > 0) {
      // Calculer la distance en jours pour chaque colonne existante
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
      
      // Copier les données de la date la plus proche
      for (const [key, value] of Object.entries(closestColumn.data)) {
        newData[key] = { ...value };
      }
    } else {
      // Initialiser avec des valeurs par défaut
      for (const se of uniqueSubElements) {
        newData[se.id] = { status: 'ok' };
      }
    }

    const newColumn: DataHistoryColumn = {
      date: newColumnDate,
      label: newColumnLabel || undefined,
      data: newData,
    };

    const updatedColumns = [...columns, newColumn].sort((a, b) => a.date.localeCompare(b.date));
    setColumns(updatedColumns);
    saveToStore(updatedColumns);
    
    setIsAddingColumn(false);
    setNewColumnDate('');
    setNewColumnLabel('');
  };

  // Supprimer une colonne
  const handleDeleteColumn = (date: string) => {
    if (!confirm(`Supprimer la colonne du ${date} ?`)) return;
    
    const updatedColumns = columns.filter(c => c.date !== date);
    setColumns(updatedColumns);
    saveToStore(updatedColumns);
  };

  // Mettre à jour une cellule (appelé sur onChange pour les selects, sur onBlur pour les inputs)
  const handleUpdateCell = (
    subElementId: string,
    columnDate: string,
    field: keyof SubElementDataSnapshot,
    value: string,
    closeEditor: boolean = true
  ) => {
    const updatedColumns = columns.map(col => {
      if (col.date !== columnDate) return col;
      
      const updatedData = { ...col.data };
      if (!updatedData[subElementId]) {
        updatedData[subElementId] = { status: 'ok' };
      }
      
      if (field === 'status') {
        updatedData[subElementId] = {
          ...updatedData[subElementId],
          status: value as TileStatus,
        };
      } else {
        updatedData[subElementId] = {
          ...updatedData[subElementId],
          [field]: value || undefined,
        };
      }
      
      return { ...col, data: updatedData };
    });
    
    setColumns(updatedColumns);
    saveToStore(updatedColumns);
    
    if (closeEditor) {
      setEditingCell(null);
    }
    
    // Si c'est la date active, synchroniser avec les sous-éléments
    const activeDate = cockpit.selectedDataDate || columns[columns.length - 1]?.date;
    if (columnDate === activeDate) {
      // Trouver l'UniqueSubElement correspondant pour obtenir les IDs originaux
      const uniqueSE = uniqueSubElements.find(se => se.id === subElementId);
      if (uniqueSE) {
        // Mettre à jour tous les sous-éléments originaux (liés ou non)
        for (const originalId of uniqueSE.originalIds) {
          const updates: Partial<{ status: TileStatus; value: string; unit: string }> = {};
          if (field === 'status') {
            updates.status = value as TileStatus;
          } else if (field === 'value') {
            updates.value = value || undefined;
          } else if (field === 'unit') {
            updates.unit = value || undefined;
          }
          updateSubElement(originalId, updates);
        }
      }
    }
  };

  // Obtenir les données d'une cellule
  const getCellData = (subElementId: string, columnDate: string): SubElementDataSnapshot => {
    const column = columns.find(c => c.date === columnDate);
    return column?.data[subElementId] || { status: 'ok' };
  };

  // Démarrer l'édition d'une cellule
  const startEditing = (subElementId: string, columnDate: string, field: 'status' | 'value' | 'unit' | 'alertDescription') => {
    if (readOnly) return;
    setEditingCell({ subElementId, columnDate, field });
  };

  // Formater une date pour l'affichage
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Générer le nom du fichier d'export
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

  // Exporter les données d'une date vers Excel
  const handleExportDate = (date: string) => {
    const column = columns.find(c => c.date === date);
    if (!column) return;

    // Préparer les données pour l'export
    const exportData: any[] = [];
    
    for (const se of uniqueSubElements) {
      const cellData = column.data[se.id] || { status: 'ok' };
      
      // Pour chaque localisation du sous-élément
      const firstLocation = se.locationInfos[0];
      
      exportData.push({
        'Maquette': cockpit.name,
        'Domaine': firstLocation?.domainName || '',
        'Élément': firstLocation?.elementName || '',
        'Sous-élément': se.name,
        'Lié': se.linkedGroupId ? `Oui (${se.linkedCount})` : 'Non',
        'Criticité': STATUS_EXPORT_MAP[cellData.status] || cellData.status,
        'Valeur': cellData.value || '',
        'Unité': cellData.unit || '',
        'Description': cellData.alertDescription || '',
      });
    }

    // Créer le workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Ajuster la largeur des colonnes
    ws['!cols'] = [
      { wch: 25 }, // Maquette
      { wch: 20 }, // Domaine
      { wch: 20 }, // Élément
      { wch: 25 }, // Sous-élément
      { wch: 15 }, // Lié
      { wch: 12 }, // Criticité
      { wch: 15 }, // Valeur
      { wch: 10 }, // Unité
      { wch: 40 }, // Description
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Données');

    // Télécharger le fichier
    const fileName = generateExportFileName(date);
    XLSX.writeFile(wb, fileName);
  };

  // Référence pour l'input file caché
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTargetDate, setImportTargetDate] = useState<string>('');

  // Importer les données depuis Excel
  const handleImportDate = (date: string) => {
    setImportTargetDate(date);
    fileInputRef.current?.click();
  };

  // Traiter le fichier importé
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importTargetDate) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        alert('Le fichier est vide ou mal formaté');
        return;
      }

      // Trouver ou créer la colonne pour la date cible
      let targetColumn = columns.find(c => c.date === importTargetDate);
      let updatedColumns = [...columns];
      
      if (!targetColumn) {
        targetColumn = {
          date: importTargetDate,
          data: {},
        };
        updatedColumns.push(targetColumn);
      }

      // Compteurs pour le feedback
      let updated = 0;
      let notFound = 0;

      // Traiter chaque ligne du fichier
      for (const row of jsonData) {
        const domainName = row['Domaine'] || row['Domain'];
        const elementName = row['Élément'] || row['Element'];
        const subElementName = row['Sous-élément'] || row['Sous-element'] || row['SubElement'];
        const criticite = row['Criticité'] || row['Criticite'] || row['Status'];
        const valeur = row['Valeur'] || row['Value'];
        const unite = row['Unité'] || row['Unite'] || row['Unit'];
        const description = row['Description'];

        if (!subElementName) {
          notFound++;
          continue;
        }

        // Trouver le sous-élément correspondant par Domaine + Élément + Nom
        let matchedSE = uniqueSubElements.find(se => {
          // Vérifier si le nom correspond
          if (se.name !== subElementName) return false;
          
          // Si domaine et élément sont spécifiés, vérifier qu'ils correspondent
          if (domainName || elementName) {
            return se.locationInfos.some(loc => {
              const domainMatch = !domainName || loc.domainName === domainName;
              const elementMatch = !elementName || loc.elementName === elementName;
              return domainMatch && elementMatch;
            });
          }
          
          return true;
        });

        if (!matchedSE) {
          notFound++;
          continue;
        }

        // Mettre à jour les données
        const newData: SubElementDataSnapshot = {
          status: targetColumn.data[matchedSE.id]?.status || 'ok',
        };

        if (criticite) {
          const normalizedStatus = criticite.toString().toLowerCase().trim();
          newData.status = STATUS_IMPORT_MAP[normalizedStatus] || newData.status;
        }
        if (valeur !== undefined && valeur !== '') {
          newData.value = valeur.toString();
        }
        if (unite !== undefined && unite !== '') {
          newData.unit = unite.toString();
        }
        if (description !== undefined && description !== '') {
          newData.alertDescription = description.toString();
        }

        targetColumn.data[matchedSE.id] = newData;
        updated++;

        // Si c'est la date active, mettre à jour les sous-éléments
        const activeDate = cockpit.selectedDataDate || columns[columns.length - 1]?.date;
        if (importTargetDate === activeDate) {
          for (const originalId of matchedSE.originalIds) {
            const updates: Partial<{ status: TileStatus; value: string; unit: string }> = {};
            if (criticite) {
              const normalizedStatus = criticite.toString().toLowerCase().trim();
              updates.status = STATUS_IMPORT_MAP[normalizedStatus];
            }
            if (valeur !== undefined && valeur !== '') {
              updates.value = valeur.toString();
            }
            if (unite !== undefined && unite !== '') {
              updates.unit = unite.toString();
            }
            if (Object.keys(updates).length > 0) {
              updateSubElement(originalId, updates);
            }
          }
        }
      }

      // Sauvegarder les colonnes mises à jour
      updatedColumns = updatedColumns.map(col => 
        col.date === importTargetDate ? targetColumn! : col
      ).sort((a, b) => a.date.localeCompare(b.date));
      
      setColumns(updatedColumns);
      saveToStore(updatedColumns);

      alert(`Import terminé !\n${updated} sous-élément(s) mis à jour\n${notFound} ligne(s) non trouvée(s)`);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert('Erreur lors de la lecture du fichier Excel');
    }

    // Réinitialiser l'input file
    event.target.value = '';
    setImportTargetDate('');
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-auto">
      {/* Input file caché pour l'import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileImport}
        className="hidden"
      />
      
      {/* En-tête */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#E2E8F0] shadow-sm">
        {/* Première ligne : Titre et boutons */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
              <MuiIcon name="TableChart" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E3A5F]">
                {t('dataHistory.title') || 'Historique des données'}
              </h2>
              <p className="text-sm text-[#64748B]">
                {uniqueSubElements.length} sous-élément{uniqueSubElements.length > 1 ? 's' : ''} unique{uniqueSubElements.length > 1 ? 's' : ''} • {columns.length} colonne{columns.length > 1 ? 's' : ''} de données
              </p>
            </div>
          </div>
          
          {!readOnly && (
            <div className="flex items-center gap-2">
              {columns.length === 0 && (
                <button
                  onClick={initializeWithCurrentValues}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
                >
                  <MuiIcon name="Refresh" size={20} />
                  <span>Initialiser avec valeurs actuelles</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Deuxième ligne : Calendrier horizontal de sélection de dates */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <MuiIcon name="CalendarMonth" size={20} className="text-[#1E3A5F]" />
            <span className="text-sm font-medium text-[#1E3A5F]">Sélectionner la date active pour le cockpit</span>
            <span className="text-xs text-[#64748B] ml-2">(Les autres vues utiliseront ces données)</span>
          </div>
          
          {/* Calendrier horizontal scrollable */}
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#CBD5E1] scrollbar-track-transparent">
            {columns.map((col) => {
              const isActive = (cockpit.selectedDataDate || columns[columns.length - 1]?.date) === col.date;
              const dateObj = new Date(col.date);
              const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
              const dayNum = dateObj.getDate();
              const monthName = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
              const year = dateObj.getFullYear();
              
              return (
                <div
                  key={col.date}
                  onClick={() => !readOnly && updateCockpit({ selectedDataDate: col.date })}
                  className={`
                    relative flex flex-col items-center min-w-[90px] px-3 py-2 rounded-xl border-2 transition-all cursor-pointer
                    ${isActive 
                      ? 'bg-gradient-to-b from-violet-500 to-violet-600 border-violet-700 text-white shadow-lg scale-105' 
                      : 'bg-white border-[#E2E8F0] text-[#1E3A5F] hover:border-violet-300 hover:bg-violet-50'
                    }
                    ${readOnly ? 'cursor-default' : ''}
                  `}
                >
                  {/* Badge date active */}
                  {isActive && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-400 text-amber-900 text-[9px] font-bold rounded-full uppercase tracking-wider shadow">
                      Active
                    </div>
                  )}
                  
                  {/* Jour de la semaine */}
                  <span className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-violet-200' : 'text-[#64748B]'}`}>
                    {dayName}
                  </span>
                  
                  {/* Numéro du jour */}
                  <span className={`text-2xl font-bold leading-tight ${isActive ? 'text-white' : 'text-[#1E3A5F]'}`}>
                    {dayNum}
                  </span>
                  
                  {/* Mois et année */}
                  <span className={`text-xs ${isActive ? 'text-violet-200' : 'text-[#64748B]'}`}>
                    {monthName} {year}
                  </span>
                  
                  {/* Label si présent */}
                  {col.label && (
                    <span className={`mt-1 text-[10px] font-medium truncate max-w-[80px] ${isActive ? 'text-violet-200' : 'text-violet-600'}`}>
                      {col.label}
                    </span>
                  )}
                  
                  {/* Bouton supprimer (visible au survol) */}
                  {!readOnly && columns.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteColumn(col.date); }}
                      className={`
                        absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity
                        ${isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600 hover:bg-red-500 hover:text-white'}
                      `}
                      title="Supprimer cette date"
                    >
                      <MuiIcon name="Close" size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            
            {/* Bouton ajouter une date */}
            {!readOnly && (
              <div className="flex items-center">
                {!isAddingColumn ? (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="flex flex-col items-center justify-center min-w-[90px] h-full px-3 py-2 rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] hover:bg-white transition-all"
                  >
                    <MuiIcon name="Add" size={24} />
                    <span className="text-xs mt-1">Ajouter</span>
                    <span className="text-[10px]">une date</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border-2 border-[#1E3A5F] shadow-lg min-w-[200px]">
                    <div className="flex items-center gap-2 text-[#1E3A5F]">
                      <MuiIcon name="Event" size={16} />
                      <span className="text-xs font-medium">Nouvelle date</span>
                    </div>
                    <input
                      type="date"
                      value={newColumnDate}
                      onChange={(e) => setNewColumnDate(e.target.value)}
                      className="px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newColumnLabel}
                      onChange={(e) => setNewColumnLabel(e.target.value)}
                      placeholder="Label (optionnel)"
                      className="px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddColumn}
                        disabled={!newColumnDate}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        <MuiIcon name="Check" size={14} />
                        Ajouter
                      </button>
                      <button
                        onClick={() => { setIsAddingColumn(false); setNewColumnDate(''); setNewColumnLabel(''); }}
                        className="px-2 py-1.5 text-[#64748B] hover:bg-[#F5F7FA] rounded-lg text-xs"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="flex-1 p-4 overflow-auto">
        {uniqueSubElements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#64748B]">
            <MuiIcon name="Info" size={48} className="mb-4 opacity-50" />
            <p>Aucun sous-élément dans cette maquette</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                {/* Ligne 1 : En-tête principal avec filtres et dates groupées */}
                <tr className="bg-[#1E3A5F] text-white">
                  <th 
                    rowSpan={2} 
                    className="sticky left-0 z-10 bg-[#1E3A5F] p-3 text-left text-sm font-medium border-r border-[#2C4A6E] min-w-[350px] align-top"
                  >
                    {/* Zone de filtres hiérarchiques */}
                    <div className="flex flex-col gap-2">
                      {/* Breadcrumb du filtre actuel */}
                      <div className="flex items-center gap-2 text-cyan-300 text-xs font-normal">
                        <MuiIcon name="FilterList" size={14} />
                        <span>{filterBreadcrumb}</span>
                        {(filterDomainId || filterElementId || searchText) && (
                          <button
                            onClick={() => { setFilterDomainId(''); setFilterElementId(''); setSearchText(''); }}
                            className="ml-2 px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px]"
                            title="Réinitialiser tous les filtres"
                          >
                            ✕ Tout effacer
                          </button>
                        )}
                      </div>
                      
                      {/* Sélecteurs de filtres */}
                      <div className="flex flex-col gap-1.5">
                        {/* Filtre Domaine */}
                        <select
                          value={filterDomainId}
                          onChange={(e) => setFilterDomainId(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-[#2C4A6E] border border-[#3D5A7E] rounded text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        >
                          <option value="">Tous les domaines</option>
                          {availableDomains.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        
                        {/* Filtre Élément */}
                        <select
                          value={filterElementId}
                          onChange={(e) => setFilterElementId(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-[#2C4A6E] border border-[#3D5A7E] rounded text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          disabled={availableElements.length === 0}
                        >
                          <option value="">Tous les éléments</option>
                          {availableElements.map(e => (
                            <option key={e.id} value={e.id}>
                              {filterDomainId ? e.name : `${e.name} (${e.domainName})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Recherche textuelle */}
                      <div className="relative">
                        <MuiIcon name="Search" size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50" />
                        <input
                          type="text"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          placeholder="Rechercher un sous-élément..."
                          className="w-full pl-7 pr-7 py-1 text-xs bg-[#2C4A6E] border border-[#3D5A7E] rounded text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        />
                        {searchText && (
                          <button
                            onClick={() => setSearchText('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                            title="Effacer la recherche"
                          >
                            <MuiIcon name="Close" size={14} />
                          </button>
                        )}
                      </div>
                      
                      {/* Compteur de résultats filtrés */}
                      <div className="text-[10px] text-white/70 font-normal">
                        {filteredSubElements.length} / {uniqueSubElements.length} sous-élément{filteredSubElements.length > 1 ? 's' : ''}
                        {searchText && <span className="ml-1 text-cyan-300">({t('dataHistory.searchActive') || 'recherche active'})</span>}
                      </div>
                    </div>
                  </th>
                  {displayedColumns.map((col) => {
                    const isActiveColumn = col.date === activeDate;
                    return (
                      <th 
                        key={col.date} 
                        colSpan={4} 
                        className={`p-2 text-center text-sm font-medium border-r border-[#2C4A6E] ${isActiveColumn ? 'bg-violet-700' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-center gap-2">
                            {/* Badge ACTIVE */}
                            {isActiveColumn && (
                              <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-[9px] font-bold rounded-full uppercase tracking-wider">
                                Active
                              </span>
                            )}
                            {!isActiveColumn && (
                              <span className="px-2 py-0.5 bg-white/20 text-white/70 text-[9px] font-medium rounded-full">
                                Précédente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <div>
                              <div className="font-semibold">{col.label || formatDate(col.date)}</div>
                              {col.label && <div className="text-xs opacity-70">{formatDate(col.date)}</div>}
                            </div>
                            {!readOnly && (
                              <button
                                onClick={() => handleDeleteColumn(col.date)}
                                className="p-1 hover:bg-white/20 rounded"
                                title="Supprimer cette colonne"
                              >
                                <MuiIcon name="Delete" size={14} />
                              </button>
                            )}
                          </div>
                          {/* Boutons Export/Import */}
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleExportDate(col.date)}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-green-600 hover:bg-green-700 rounded transition-colors"
                              title="Exporter vers Excel"
                            >
                              <MuiIcon name="Download" size={12} />
                              Export
                            </button>
                            {!readOnly && (
                              <button
                                onClick={() => handleImportDate(col.date)}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                                title="Importer depuis Excel"
                              >
                                <MuiIcon name="Upload" size={12} />
                                Import
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
                {/* Ligne 2 : Sous-en-têtes Criticité / Valeur / Unité / Description */}
                <tr className="bg-[#2C4A6E] text-white">
                  {displayedColumns.map((col) => {
                    const isActiveColumn = col.date === activeDate;
                    return (
                      <React.Fragment key={col.date}>
                        <th className={`p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[80px] ${isActiveColumn ? 'bg-violet-600' : ''}`}>
                          Criticité
                        </th>
                        <th className={`p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[80px] ${isActiveColumn ? 'bg-violet-600' : ''}`}>
                          Valeur
                        </th>
                        <th className={`p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[60px] ${isActiveColumn ? 'bg-violet-600' : ''}`}>
                          Unité
                        </th>
                        <th className={`p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[150px] ${isActiveColumn ? 'bg-violet-600' : ''}`}>
                          Description
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredSubElements.map((se, idx) => {
                  const bgColor = idx % 2 === 0 ? 'white' : '#F5F7FA';
                  
                  return (
                    <tr key={se.id} style={{ backgroundColor: bgColor }}>
                      {/* Colonne Sous-élément avec nom + localisations */}
                      <td 
                        className="sticky left-0 z-10 p-3 border-r border-[#E2E8F0] align-top" 
                        style={{ backgroundColor: bgColor }}
                      >
                        <div className="flex flex-col gap-1">
                          {/* Nom du sous-élément */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#1E3A5F]">{se.name}</span>
                            {se.linkedGroupId && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full whitespace-nowrap">
                                🔗 {se.linkedCount} liés
                              </span>
                            )}
                          </div>
                          {/* Localisations filtrées */}
                          <div className="flex flex-col gap-0.5">
                            {se.locationInfos
                              .filter(loc => {
                                if (filterDomainId && loc.domainId !== filterDomainId) return false;
                                if (filterElementId && loc.elementId !== filterElementId) return false;
                                return true;
                              })
                              .map((loc, locIdx) => {
                                // Construire le chemin en fonction des filtres actifs
                                let path = '';
                                if (!filterDomainId) {
                                  path = loc.fullPath;
                                } else if (!filterElementId) {
                                  // Domaine filtré : afficher Cat > Elem > SubCat
                                  path = `${loc.categoryName} > ${loc.elementName} > ${loc.subCategoryName}`;
                                } else {
                                  // Élément filtré : afficher SubCat uniquement
                                  path = loc.subCategoryName;
                                }
                                return (
                                  <span key={locIdx} className="text-xs text-[#64748B]">
                                    {path}
                                  </span>
                                );
                              })}
                          </div>
                        </div>
                      </td>
                      
                      {/* Colonnes de données par date (max 2 : précédente + active) */}
                      {displayedColumns.map((col) => {
                        const cellData = getCellData(se.id, col.date);
                        const statusColors = STATUS_COLORS[cellData.status] || STATUS_COLORS.ok;
                        const isEditingStatus = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'status';
                        const isEditingValue = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'value';
                        const isEditingUnit = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'unit';
                        const isEditingDescription = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'alertDescription';
                        const isActiveColumn = col.date === activeDate;
                        // Fond légèrement violet pour la colonne active
                        const activeBg = isActiveColumn ? 'bg-violet-50' : '';
                        
                        return (
                          <React.Fragment key={col.date}>
                            {/* Criticité */}
                            <td className={`p-2 border-r border-[#E2E8F0] text-center align-middle ${activeBg}`}>
                              {isEditingStatus ? (
                                <select
                                  value={cellData.status}
                                  onChange={(e) => handleUpdateCell(se.id, col.date, 'status', e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  autoFocus
                                  className="w-full px-1 py-1 text-xs border border-[#E2E8F0] rounded"
                                >
                                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                  ))}
                                </select>
                              ) : (
                                <div 
                                  className={`px-2 py-1 rounded text-xs font-medium text-white cursor-pointer hover:opacity-80 ${!readOnly ? 'hover:ring-2 hover:ring-offset-1 hover:ring-[#1E3A5F]' : ''}`}
                                  style={{ backgroundColor: statusColors.hex }}
                                  onClick={() => !readOnly && setEditingCell({ subElementId: se.id, columnDate: col.date, field: 'status' })}
                                >
                                  {STATUS_LABELS[cellData.status]}
                                </div>
                              )}
                            </td>
                            
                            {/* Valeur */}
                            <td className={`p-2 border-r border-[#E2E8F0] text-center align-middle ${activeBg}`}>
                              {isEditingValue ? (
                                <EditableInput
                                  initialValue={cellData.value || ''}
                                  onSave={(val) => {
                                    handleUpdateCell(se.id, col.date, 'value', val, true);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                  placeholder="—"
                                  className="w-full px-2 py-1 border border-[#E2E8F0] rounded text-xs text-center"
                                />
                              ) : (
                                <span 
                                  className={`text-sm text-[#1E3A5F] ${!readOnly ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={() => startEditing(se.id, col.date, 'value')}
                                >
                                  {cellData.value || '—'}
                                </span>
                              )}
                            </td>
                            
                            {/* Unité */}
                            <td className={`p-2 border-r border-[#E2E8F0] text-center align-middle ${activeBg}`}>
                              {isEditingUnit ? (
                                <EditableInput
                                  initialValue={cellData.unit || ''}
                                  onSave={(val) => {
                                    handleUpdateCell(se.id, col.date, 'unit', val, true);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                  placeholder="—"
                                  className="w-full px-2 py-1 border border-[#E2E8F0] rounded text-xs text-center"
                                />
                              ) : (
                                <span 
                                  className={`text-xs text-[#64748B] ${!readOnly ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={() => startEditing(se.id, col.date, 'unit')}
                                >
                                  {cellData.unit || '—'}
                                </span>
                              )}
                            </td>
                            
                            {/* Description */}
                            <td className={`p-2 border-r border-[#E2E8F0] text-left align-middle ${activeBg}`}>
                              {isEditingDescription ? (
                                <EditableInput
                                  initialValue={cellData.alertDescription || ''}
                                  onSave={(val) => {
                                    handleUpdateCell(se.id, col.date, 'alertDescription', val, true);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                  placeholder="Description de l'alerte..."
                                  className="w-full px-2 py-1 border border-[#E2E8F0] rounded text-xs"
                                />
                              ) : (
                                <span 
                                  className={`text-xs text-[#64748B] ${!readOnly ? 'cursor-pointer hover:underline' : ''} line-clamp-2`}
                                  onClick={() => startEditing(se.id, col.date, 'alertDescription')}
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
