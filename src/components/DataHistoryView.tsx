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
    field: 'status' | 'value' | 'unit';
  } | null>(null);

  // États pour les filtres hiérarchiques
  const [filterDomainId, setFilterDomainId] = useState<string>('');
  const [filterElementId, setFilterElementId] = useState<string>('');

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

  // Sous-éléments filtrés
  const filteredSubElements = useMemo(() => {
    if (!filterDomainId && !filterElementId) {
      return uniqueSubElements;
    }

    return uniqueSubElements.filter(se => {
      return se.locationInfos.some(loc => {
        if (filterDomainId && loc.domainId !== filterDomainId) return false;
        if (filterElementId && loc.elementId !== filterElementId) return false;
        return true;
      });
    });
  }, [uniqueSubElements, filterDomainId, filterElementId]);

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
  const startEditing = (subElementId: string, columnDate: string, field: 'status' | 'value' | 'unit') => {
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
      <div className="sticky top-0 z-20 bg-white border-b border-[#E2E8F0] p-4 shadow-sm">
        <div className="flex items-center justify-between">
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
          
          {/* Sélecteur de date active */}
          {columns.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg">
              <MuiIcon name="Event" size={20} className="text-violet-600" />
              <span className="text-sm text-violet-700 font-medium">Date active :</span>
              <select
                value={cockpit.selectedDataDate || columns[columns.length - 1]?.date || ''}
                onChange={(e) => updateCockpit({ selectedDataDate: e.target.value })}
                className="px-3 py-1 border border-violet-300 rounded-lg text-sm bg-white text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                disabled={readOnly}
              >
                {columns.map((col) => (
                  <option key={col.date} value={col.date}>
                    {col.label ? `${col.label} (${formatDate(col.date)})` : formatDate(col.date)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-violet-500">
                Les autres vues utiliseront ces données
              </span>
            </div>
          )}
          
          {!readOnly && (
            <div className="flex items-center gap-2">
              {!isAddingColumn ? (
                <button
                  onClick={() => setIsAddingColumn(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors"
                >
                  <MuiIcon name="Add" size={20} />
                  <span>Ajouter une date</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newColumnDate}
                    onChange={(e) => setNewColumnDate(e.target.value)}
                    className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={newColumnLabel}
                    onChange={(e) => setNewColumnLabel(e.target.value)}
                    placeholder="Label (optionnel)"
                    className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm w-40"
                  />
                  <button
                    onClick={handleAddColumn}
                    disabled={!newColumnDate}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    <MuiIcon name="Check" size={20} />
                  </button>
                  <button
                    onClick={() => { setIsAddingColumn(false); setNewColumnDate(''); setNewColumnLabel(''); }}
                    className="p-2 text-[#64748B] hover:bg-[#F5F7FA] rounded-lg"
                  >
                    <MuiIcon name="Close" size={20} />
                  </button>
                </div>
              )}
              
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
                        {(filterDomainId || filterElementId) && (
                          <button
                            onClick={() => { setFilterDomainId(''); setFilterElementId(''); }}
                            className="ml-2 px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px]"
                            title="Réinitialiser les filtres"
                          >
                            ✕ Effacer
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
                      
                      {/* Compteur de résultats filtrés */}
                      <div className="text-[10px] text-white/70 font-normal">
                        {filteredSubElements.length} / {uniqueSubElements.length} sous-élément{filteredSubElements.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </th>
                  {columns.map((col) => (
                    <th 
                      key={col.date} 
                      colSpan={3} 
                      className="p-2 text-center text-sm font-medium border-r border-[#2C4A6E]"
                    >
                      <div className="flex flex-col gap-1">
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
                  ))}
                </tr>
                {/* Ligne 2 : Sous-en-têtes Criticité / Valeur / Unité */}
                <tr className="bg-[#2C4A6E] text-white">
                  {columns.map((col) => (
                    <React.Fragment key={col.date}>
                      <th className="p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[80px]">
                        Criticité
                      </th>
                      <th className="p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[80px]">
                        Valeur
                      </th>
                      <th className="p-2 text-center text-xs font-medium border-r border-[#3D5A7E] min-w-[60px]">
                        Unité
                      </th>
                    </React.Fragment>
                  ))}
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
                      
                      {/* Colonnes de données par date */}
                      {columns.map((col) => {
                        const cellData = getCellData(se.id, col.date);
                        const statusColors = STATUS_COLORS[cellData.status] || STATUS_COLORS.ok;
                        const isEditingStatus = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'status';
                        const isEditingValue = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'value';
                        const isEditingUnit = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date && editingCell?.field === 'unit';
                        
                        return (
                          <React.Fragment key={col.date}>
                            {/* Criticité */}
                            <td className="p-2 border-r border-[#E2E8F0] text-center align-middle">
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
                            <td className="p-2 border-r border-[#E2E8F0] text-center align-middle">
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
                            <td className="p-2 border-r border-[#E2E8F0] text-center align-middle">
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
