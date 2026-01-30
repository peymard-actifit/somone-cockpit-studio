import { useState, useMemo, useEffect } from 'react';
import type { Cockpit, TileStatus, DataHistoryColumn, SubElementDataSnapshot } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { useLanguage } from '../contexts/LanguageContext';

interface DataHistoryViewProps {
  cockpit: Cockpit;
  readOnly?: boolean;
}

// Collecter tous les sous-éléments uniques de la maquette
interface UniqueSubElement {
  id: string; // subElementId ou linkedGroupId
  name: string;
  location: string;
  linkedGroupId?: string;
  linkedCount: number;
  originalIds: string[]; // IDs des sous-éléments originaux (pour mise à jour)
}

export default function DataHistoryView({ cockpit, readOnly = false }: DataHistoryViewProps) {
  const { t } = useLanguage();
  const { updateCockpit } = useCockpitStore();
  
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

  // Collecter tous les sous-éléments uniques
  const uniqueSubElements = useMemo(() => {
    const subElementsMap = new Map<string, UniqueSubElement>();
    const processedLinkedGroups = new Set<string>();

    for (const domain of cockpit.domains) {
      for (const category of domain.categories || []) {
        for (const element of category.elements || []) {
          for (const subCat of element.subCategories || []) {
            for (const subElement of subCat.subElements || []) {
              const location = `${domain.name} > ${category.name} > ${element.name} > ${subCat.name}`;
              
              if (subElement.linkedGroupId) {
                // Sous-élément lié - regrouper par linkedGroupId
                if (!processedLinkedGroups.has(subElement.linkedGroupId)) {
                  processedLinkedGroups.add(subElement.linkedGroupId);
                  subElementsMap.set(subElement.linkedGroupId, {
                    id: subElement.linkedGroupId,
                    name: subElement.name,
                    location: location + ' (lié)',
                    linkedGroupId: subElement.linkedGroupId,
                    linkedCount: 1,
                    originalIds: [subElement.id],
                  });
                } else {
                  const existing = subElementsMap.get(subElement.linkedGroupId)!;
                  existing.linkedCount++;
                  existing.originalIds.push(subElement.id);
                }
              } else {
                // Sous-élément non lié
                subElementsMap.set(subElement.id, {
                  id: subElement.id,
                  name: subElement.name,
                  location,
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
        location: se.location,
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

    // Copier les données de la dernière colonne ou initialiser à vide
    const lastColumn = columns[columns.length - 1];
    const newData: Record<string, SubElementDataSnapshot> = {};
    
    if (lastColumn) {
      // Copier les données de la dernière colonne
      for (const [key, value] of Object.entries(lastColumn.data)) {
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

  // Mettre à jour une cellule
  const handleUpdateCell = (
    subElementId: string,
    columnDate: string,
    field: keyof SubElementDataSnapshot,
    value: string
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
    setEditingCell(null);
  };

  // Obtenir les données d'une cellule
  const getCellData = (subElementId: string, columnDate: string): SubElementDataSnapshot => {
    const column = columns.find(c => c.date === columnDate);
    return column?.data[subElementId] || { status: 'ok' };
  };

  // Formater une date pour l'affichage
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-auto">
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
                <tr className="bg-[#1E3A5F] text-white">
                  <th className="sticky left-0 z-10 bg-[#1E3A5F] p-3 text-left text-sm font-medium border-r border-[#2C4A6E] min-w-[250px]">
                    Sous-élément
                  </th>
                  <th className="sticky left-[250px] z-10 bg-[#1E3A5F] p-3 text-left text-sm font-medium border-r border-[#2C4A6E] min-w-[200px]">
                    Localisation
                  </th>
                  {columns.map((col) => (
                    <th key={col.date} className="p-3 text-center text-sm font-medium border-r border-[#2C4A6E] min-w-[180px]">
                      <div className="flex items-center justify-center gap-2">
                        <div>
                          <div>{col.label || formatDate(col.date)}</div>
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
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueSubElements.map((se, idx) => (
                  <tr key={se.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}>
                    <td className="sticky left-0 z-10 p-3 text-sm font-medium text-[#1E3A5F] border-r border-[#E2E8F0]" style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#F5F7FA' }}>
                      <div className="flex items-center gap-2">
                        <span>{se.name}</span>
                        {se.linkedGroupId && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            🔗 {se.linkedCount} liés
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="sticky left-[250px] z-10 p-3 text-xs text-[#64748B] border-r border-[#E2E8F0]" style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#F5F7FA' }}>
                      {se.location}
                    </td>
                    {columns.map((col) => {
                      const cellData = getCellData(se.id, col.date);
                      const colors = STATUS_COLORS[cellData.status] || STATUS_COLORS.ok;
                      const isEditing = editingCell?.subElementId === se.id && editingCell?.columnDate === col.date;
                      
                      return (
                        <td key={col.date} className="p-2 border-r border-[#E2E8F0]">
                          <div 
                            className="flex flex-col gap-1 p-2 rounded-lg cursor-pointer hover:bg-[#F5F7FA]"
                            onClick={() => !readOnly && setEditingCell({ subElementId: se.id, columnDate: col.date, field: 'status' })}
                          >
                            {/* Status */}
                            {isEditing && editingCell?.field === 'status' ? (
                              <select
                                value={cellData.status}
                                onChange={(e) => handleUpdateCell(se.id, col.date, 'status', e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                                className="px-2 py-1 text-xs border border-[#E2E8F0] rounded"
                              >
                                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                            ) : (
                              <div 
                                className="px-2 py-1 rounded text-xs font-medium text-white text-center"
                                style={{ backgroundColor: colors.hex }}
                              >
                                {STATUS_LABELS[cellData.status]}
                              </div>
                            )}
                            
                            {/* Value + Unit */}
                            <div className="flex items-center gap-1 text-xs">
                              {isEditing && editingCell?.field === 'value' ? (
                                <input
                                  type="text"
                                  value={cellData.value || ''}
                                  onChange={(e) => handleUpdateCell(se.id, col.date, 'value', e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  autoFocus
                                  className="flex-1 px-2 py-1 border border-[#E2E8F0] rounded text-xs"
                                  placeholder="Valeur"
                                />
                              ) : (
                                <span 
                                  className="flex-1 text-[#1E3A5F] cursor-pointer hover:underline"
                                  onClick={(e) => { e.stopPropagation(); !readOnly && setEditingCell({ subElementId: se.id, columnDate: col.date, field: 'value' }); }}
                                >
                                  {cellData.value || '-'}
                                </span>
                              )}
                              {isEditing && editingCell?.field === 'unit' ? (
                                <input
                                  type="text"
                                  value={cellData.unit || ''}
                                  onChange={(e) => handleUpdateCell(se.id, col.date, 'unit', e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  autoFocus
                                  className="w-16 px-2 py-1 border border-[#E2E8F0] rounded text-xs"
                                  placeholder="Unité"
                                />
                              ) : (
                                <span 
                                  className="text-[#64748B] cursor-pointer hover:underline"
                                  onClick={(e) => { e.stopPropagation(); !readOnly && setEditingCell({ subElementId: se.id, columnDate: col.date, field: 'unit' }); }}
                                >
                                  {cellData.unit || ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
