import { useState, useRef, useEffect, useMemo } from 'react';
import type { Domain, Incident, IncidentSeverity, Cockpit } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { STATUS_COLORS } from '../types';

interface AlertsViewProps {
  domain: Domain;
  cockpit: Cockpit;
  readOnly?: boolean;
}

// Couleurs des sévérités (utilisant les mêmes couleurs que les autres vues)
const SEVERITY_HEX: Record<IncidentSeverity, string> = {
  fatal: STATUS_COLORS.fatal.hex,     // Violet
  critique: STATUS_COLORS.critique.hex, // Rouge
  mineur: STATUS_COLORS.mineur.hex,   // Orange
};

// Ordre des sévérités pour le tri (orange=0, rouge=1, violet=2)
const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  mineur: 0,
  critique: 1,
  fatal: 2,
};

// Colonnes du tableau
interface ColumnDef {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  sortable: boolean;
  filterable: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'severity', label: 'Couleur', width: 70, minWidth: 50, sortable: true, filterable: true },
  { id: 'startDate', label: 'Début', width: 180, minWidth: 150, sortable: true, filterable: true },
  { id: 'endDate', label: 'Fin', width: 180, minWidth: 150, sortable: true, filterable: true },
  { id: 'duration', label: 'Durée', width: 90, minWidth: 70, sortable: true, filterable: false },
  { id: 'targetDomainName', label: 'Domaine', width: 130, minWidth: 100, sortable: true, filterable: true },
  { id: 'targetCategoryName', label: 'Catégorie', width: 130, minWidth: 100, sortable: true, filterable: true },
  { id: 'targetElementName', label: 'Élément', width: 130, minWidth: 100, sortable: true, filterable: true },
  { id: 'targetSubCategoryName', label: 'Sous-cat.', width: 110, minWidth: 90, sortable: true, filterable: true },
  { id: 'targetSubElementName', label: 'Sous-élém.', width: 110, minWidth: 90, sortable: true, filterable: true },
  { id: 'responsible', label: 'Resp.', width: 70, minWidth: 60, sortable: true, filterable: true },
  { id: 'description', label: 'Description', width: 200, minWidth: 150, sortable: false, filterable: true },
  { id: 'actions', label: '', width: 100, minWidth: 100, sortable: false, filterable: false },
];

// Clé pour localStorage
const getStorageKey = (domainId: string) => `alertsView_draft_${domainId}`;

// Calculer la durée entre deux dates
function calculateDuration(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) return '-';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}j ${remainingHours}h`;
  }
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  }
  return `${diffMins}m`;
}

// Formater une date pour l'affichage
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Formater pour input datetime-local
function toDateTimeLocal(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

export default function AlertsView({ domain, cockpit, readOnly = false }: AlertsViewProps) {
  const { addIncident, deleteIncident, updateIncident, updateDomain } = useCockpitStore();

  // État local - hauteur initiale minimale pour la partie haute (15%)
  const [splitPosition, setSplitPosition] = useState(() => domain.alertsData?.splitPosition || 15);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [sortColumn, setSortColumn] = useState<string>('startDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'none'>('desc');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState<string | null>(null);
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null);
  const [editingBackup, setEditingBackup] = useState<Incident | null>(null);

  // Charger les données d'édition depuis localStorage
  const [newIncident, setNewIncident] = useState<Partial<Incident>>(() => {
    if (typeof window === 'undefined') return { severity: 'mineur', startDate: new Date().toISOString(), responsible: true };
    const saved = localStorage.getItem(getStorageKey(domain.id));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // S'assurer que responsible est défini (migration des anciennes données)
        if (parsed.responsible === undefined) parsed.responsible = true;
        return parsed;
      } catch {
        return { severity: 'mineur', startDate: new Date().toISOString(), responsible: true };
      }
    }
    return { severity: 'mineur', startDate: new Date().toISOString(), responsible: true };
  });

  // Sauvegarder les données d'édition dans localStorage
  useEffect(() => {
    localStorage.setItem(getStorageKey(domain.id), JSON.stringify(newIncident));
  }, [newIncident, domain.id]);

  // États pour les sélecteurs en cascade (aussi persistés)
  const [selectedDomainForNew, setSelectedDomainForNew] = useState<string>(() => {
    const saved = localStorage.getItem(`${getStorageKey(domain.id)}_domain`);
    return saved || '';
  });
  const [selectedCategoryForNew, setSelectedCategoryForNew] = useState<string>(() => {
    const saved = localStorage.getItem(`${getStorageKey(domain.id)}_category`);
    return saved || '';
  });
  const [selectedElementForNew, setSelectedElementForNew] = useState<string>(() => {
    const saved = localStorage.getItem(`${getStorageKey(domain.id)}_element`);
    return saved || '';
  });
  const [selectedSubCategoryForNew, setSelectedSubCategoryForNew] = useState<string>(() => {
    const saved = localStorage.getItem(`${getStorageKey(domain.id)}_subCategory`);
    return saved || '';
  });

  // Sauvegarder les sélections en cascade
  useEffect(() => {
    localStorage.setItem(`${getStorageKey(domain.id)}_domain`, selectedDomainForNew);
  }, [selectedDomainForNew, domain.id]);
  useEffect(() => {
    localStorage.setItem(`${getStorageKey(domain.id)}_category`, selectedCategoryForNew);
  }, [selectedCategoryForNew, domain.id]);
  useEffect(() => {
    localStorage.setItem(`${getStorageKey(domain.id)}_element`, selectedElementForNew);
  }, [selectedElementForNew, domain.id]);
  useEffect(() => {
    localStorage.setItem(`${getStorageKey(domain.id)}_subCategory`, selectedSubCategoryForNew);
  }, [selectedSubCategoryForNew, domain.id]);

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Récupérer les incidents du domaine
  const incidents = domain.alertsData?.incidents || [];
  const rowSpacing = domain.alertsData?.rowSpacing || 4;

  // Filtrer et trier les incidents
  const filteredAndSortedIncidents = useMemo(() => {
    let result = [...incidents];

    // Appliquer les filtres (multi-sélection)
    Object.entries(filters).forEach(([columnId, filterValues]) => {
      if (!filterValues || filterValues.length === 0) return;
      result = result.filter(incident => {
        if (columnId === 'severity') {
          return filterValues.includes(incident.severity);
        }
        if (columnId === 'responsible') {
          const isResponsible = incident.responsible !== false;
          const respValue = isResponsible ? 'oui' : 'non';
          return filterValues.includes(respValue);
        }
        const value = incident[columnId as keyof Incident];
        if (typeof value === 'string') {
          // Pour les autres colonnes, vérifier si la valeur correspond à l'un des filtres
          return filterValues.some(fv => value.toLowerCase().includes(fv.toLowerCase()));
        }
        return true;
      });
    });

    // Appliquer le tri si actif
    if (sortColumn && sortDirection !== 'none') {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (sortColumn === 'severity') {
          aVal = SEVERITY_ORDER[a.severity as IncidentSeverity];
          bVal = SEVERITY_ORDER[b.severity as IncidentSeverity];
        } else if (sortColumn === 'duration') {
          // Calculer la durée en ms
          const aEnd = a.endDate ? new Date(a.endDate).getTime() : Date.now();
          const bEnd = b.endDate ? new Date(b.endDate).getTime() : Date.now();
          aVal = aEnd - new Date(a.startDate).getTime();
          bVal = bEnd - new Date(b.startDate).getTime();
        } else if (sortColumn === 'responsible') {
          // Tri par responsabilité (Oui = 1, Non = 0)
          aVal = a.responsible !== false ? 1 : 0;
          bVal = b.responsible !== false ? 1 : 0;
        } else {
          aVal = a[sortColumn as keyof Incident];
          bVal = b[sortColumn as keyof Incident];
        }

        // Gérer les valeurs nulles/undefined
        if (aVal === undefined || aVal === null || aVal === '') {
          return sortDirection === 'asc' ? 1 : -1;
        }
        if (bVal === undefined || bVal === null || bVal === '') {
          return sortDirection === 'asc' ? -1 : 1;
        }

        // Comparaison
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [incidents, filters, sortColumn, sortDirection]);

  // Compteurs pour les tuiles
  const counts = useMemo(() => ({
    total: incidents.length,
    fatal: incidents.filter(i => i.severity === 'fatal').length,
    critique: incidents.filter(i => i.severity === 'critique').length,
    mineur: incidents.filter(i => i.severity === 'mineur').length,
  }), [incidents]);

  // Protection: s'assurer que cockpit.domains existe
  const cockpitDomains = cockpit?.domains || [];

  // Options pour les sélecteurs en cascade
  const domainOptions = cockpitDomains.filter(d => d.id !== domain.id);

  const categoryOptions = useMemo(() => {
    if (!selectedDomainForNew) return [];
    const targetDomain = cockpitDomains.find(d => d.id === selectedDomainForNew);
    return targetDomain?.categories || [];
  }, [cockpitDomains, selectedDomainForNew]);

  const elementOptions = useMemo(() => {
    if (!selectedCategoryForNew) return [];
    const targetDomain = cockpitDomains.find(d => d.id === selectedDomainForNew);
    const targetCategory = (targetDomain?.categories || []).find(c => c.id === selectedCategoryForNew);
    return targetCategory?.elements || [];
  }, [cockpitDomains, selectedDomainForNew, selectedCategoryForNew]);

  const subCategoryOptions = useMemo(() => {
    if (!selectedElementForNew) return [];
    const targetDomain = cockpitDomains.find(d => d.id === selectedDomainForNew);
    const targetCategory = (targetDomain?.categories || []).find(c => c.id === selectedCategoryForNew);
    const targetElement = (targetCategory?.elements || []).find(e => e.id === selectedElementForNew);
    return targetElement?.subCategories || [];
  }, [cockpitDomains, selectedDomainForNew, selectedCategoryForNew, selectedElementForNew]);

  const subElementOptions = useMemo(() => {
    if (!selectedSubCategoryForNew) return [];
    const targetDomain = cockpitDomains.find(d => d.id === selectedDomainForNew);
    const targetCategory = (targetDomain?.categories || []).find(c => c.id === selectedCategoryForNew);
    const targetElement = (targetCategory?.elements || []).find(e => e.id === selectedElementForNew);
    const targetSubCategory = (targetElement?.subCategories || []).find(sc => sc.id === selectedSubCategoryForNew);
    return targetSubCategory?.subElements || [];
  }, [cockpitDomains, selectedDomainForNew, selectedCategoryForNew, selectedElementForNew, selectedSubCategoryForNew]);

  // Gestion du redimensionnement du séparateur
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit(true);
  };

  useEffect(() => {
    if (!isResizingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPosition = ((e.clientY - rect.top) / rect.height) * 100;
      // Permettre de réduire jusqu'à 5% pour juste afficher les textes et chiffres
      setSplitPosition(Math.max(5, Math.min(50, newPosition)));
    };

    const handleMouseUp = () => {
      setIsResizingSplit(false);
      updateDomain(domain.id, {
        alertsData: {
          ...domain.alertsData,
          incidents: domain.alertsData?.incidents || [],
          splitPosition,
        },
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplit, domain.id, domain.alertsData, splitPosition, updateDomain]);

  // Gestion du redimensionnement des colonnes
  const handleColumnResizeStart = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
  };

  // Double-clic pour auto-ajuster la largeur de colonne
  const handleColumnAutoFit = (columnId: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id !== columnId) return col;
      return { ...col, width: col.minWidth };
    }));
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      setColumns(prev => prev.map(col => {
        if (col.id !== resizingColumn) return col;
        const newWidth = Math.max(col.minWidth, col.width + e.movementX);
        return { ...col, width: newWidth };
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);

  // Ajouter un nouvel incident - protection pour les tableaux
  const handleAddIncident = () => {
    if (!newIncident.severity || !newIncident.startDate) return;

    const targetDomain = cockpitDomains.find(d => d.id === selectedDomainForNew);
    const targetCategory = (targetDomain?.categories || []).find(c => c.id === selectedCategoryForNew);
    const targetElement = (targetCategory?.elements || []).find(e => e.id === selectedElementForNew);
    const targetSubCategory = (targetElement?.subCategories || []).find(sc => sc.id === selectedSubCategoryForNew);
    const targetSubElement = (targetSubCategory?.subElements || []).find(se => se.id === newIncident.targetSubElementId);

    addIncident(domain.id, {
      severity: newIncident.severity as IncidentSeverity,
      startDate: newIncident.startDate,
      endDate: newIncident.endDate,
      targetDomainId: selectedDomainForNew || undefined,
      targetCategoryId: selectedCategoryForNew || undefined,
      targetElementId: selectedElementForNew || undefined,
      targetSubCategoryId: selectedSubCategoryForNew || undefined,
      targetSubElementId: newIncident.targetSubElementId,
      targetDomainName: targetDomain?.name,
      targetCategoryName: targetCategory?.name,
      targetElementName: targetElement?.name,
      targetSubCategoryName: targetSubCategory?.name,
      targetSubElementName: targetSubElement?.name,
      responsible: newIncident.responsible !== false, // Par défaut true
      description: newIncident.description,
    });

    // Réinitialiser
    setNewIncident({
      severity: 'mineur',
      startDate: new Date().toISOString(),
      responsible: true,
    });
    setSelectedDomainForNew('');
    setSelectedCategoryForNew('');
    setSelectedElementForNew('');
    setSelectedSubCategoryForNew('');
  };

  // Dupliquer un incident (avec les mêmes dates)
  const handleDuplicateIncident = (incident: Incident) => {
    addIncident(domain.id, {
      severity: incident.severity,
      startDate: incident.startDate,
      endDate: incident.endDate,
      targetDomainId: incident.targetDomainId,
      targetCategoryId: incident.targetCategoryId,
      targetElementId: incident.targetElementId,
      targetSubCategoryId: incident.targetSubCategoryId,
      targetSubElementId: incident.targetSubElementId,
      targetDomainName: incident.targetDomainName,
      targetCategoryName: incident.targetCategoryName,
      targetElementName: incident.targetElementName,
      targetSubCategoryName: incident.targetSubCategoryName,
      targetSubElementName: incident.targetSubElementName,
      responsible: incident.responsible !== false, // Copier la responsabilité
      description: incident.description ? `${incident.description} (copie)` : undefined,
    });
  };

  // Supprimer un incident
  const handleDeleteIncident = (incidentId: string) => {
    deleteIncident(domain.id, incidentId);
  };

  // Commencer l'édition (sauvegarder l'état avant)
  const handleStartEditing = (incident: Incident) => {
    setEditingBackup({ ...incident });
    setEditingIncidentId(incident.id);
  };

  // Valider l'édition
  const handleConfirmEditing = () => {
    setEditingIncidentId(null);
    setEditingBackup(null);
  };

  // Annuler l'édition (restaurer les valeurs)
  const handleCancelEditing = () => {
    if (editingBackup) {
      updateIncident(domain.id, editingBackup.id, editingBackup);
    }
    setEditingIncidentId(null);
    setEditingBackup(null);
  };

  // Éditer un incident inline
  const handleEditIncident = (incidentId: string, updates: Partial<Incident>) => {
    updateIncident(domain.id, incidentId, updates);
  };

  // Tri par colonne
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Cycle: asc -> desc -> none -> asc
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection('none');
      } else {
        setSortDirection('asc');
      }
    } else {
      // Nouvelle colonne: commencer par asc
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Obtenir l'état de tri d'une colonne
  const getSortState = (columnId: string): 'asc' | 'desc' | 'none' => {
    if (sortColumn === columnId) {
      return sortDirection;
    }
    return 'none';
  };

  // Valeurs uniques pour les filtres
  const getUniqueValues = (columnId: string): string[] => {
    const values = new Set<string>();
    incidents.forEach(incident => {
      const value = incident[columnId as keyof Incident];
      if (typeof value === 'string' && value) {
        values.add(value);
      }
    });
    return Array.from(values).sort();
  };

  // Rendu d'une cellule (pour affichage ou édition)
  const renderCell = (incident: Incident, columnId: string, isEditing: boolean) => {
    if (columnId === 'severity') {
      if (isEditing) {
        return (
          <div className="flex gap-1">
            {(['fatal', 'critique', 'mineur'] as IncidentSeverity[]).map(sev => (
              <button
                key={sev}
                onClick={() => handleEditIncident(incident.id, { severity: sev })}
                className={`w-6 h-6 rounded-full border-2 transition-all ${incident.severity === sev ? 'border-[#1E3A5F] scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: SEVERITY_HEX[sev] }}
              />
            ))}
          </div>
        );
      }
      return (
        <div
          className="w-5 h-5 rounded-full mx-auto"
          style={{ backgroundColor: SEVERITY_HEX[incident.severity] }}
        />
      );
    }

    if (columnId === 'startDate') {
      if (isEditing) {
        return (
          <input
            type="datetime-local"
            value={toDateTimeLocal(incident.startDate)}
            onChange={(e) => handleEditIncident(incident.id, { startDate: new Date(e.target.value).toISOString() })}
            className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded"
          />
        );
      }
      return formatDate(incident.startDate);
    }

    if (columnId === 'endDate') {
      if (isEditing) {
        return (
          <input
            type="datetime-local"
            value={toDateTimeLocal(incident.endDate)}
            min={toDateTimeLocal(incident.startDate)}
            onChange={(e) => handleEditIncident(incident.id, { endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded"
          />
        );
      }
      return formatDate(incident.endDate);
    }

    if (columnId === 'duration') {
      return calculateDuration(incident.startDate, incident.endDate);
    }

    if (columnId === 'responsible') {
      const isResponsible = incident.responsible !== false; // Par défaut true
      if (isEditing) {
        return (
          <select
            value={isResponsible ? 'oui' : 'non'}
            onChange={(e) => handleEditIncident(incident.id, { responsible: e.target.value === 'oui' })}
            className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white"
          >
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
        );
      }
      return (
        <span className={`text-xs font-medium ${isResponsible ? 'text-[#E57373]' : 'text-[#64B5F6]'}`}>
          {isResponsible ? 'Oui' : 'Non'}
        </span>
      );
    }

    if (columnId === 'description') {
      if (isEditing) {
        return (
          <input
            type="text"
            value={incident.description || ''}
            onChange={(e) => handleEditIncident(incident.id, { description: e.target.value })}
            className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded"
          />
        );
      }
      return (
        <div className="flex items-center gap-2 w-full">
          <span className="truncate flex-1">{incident.description || '-'}</span>
          {incident.attachmentName && (
            <span title={incident.attachmentName}>
              <MuiIcon name="AttachFile" size={14} className="text-[#94A3B8]" />
            </span>
          )}
        </div>
      );
    }

    if (columnId === 'actions') {
      return null; // Géré séparément
    }

    // Colonnes de cible (non éditables inline)
    const fieldMap: Record<string, keyof Incident> = {
      targetDomainName: 'targetDomainName',
      targetCategoryName: 'targetCategoryName',
      targetElementName: 'targetElementName',
      targetSubCategoryName: 'targetSubCategoryName',
      targetSubElementName: 'targetSubElementName',
    };

    const field = fieldMap[columnId];
    if (field) {
      return incident[field] || '-';
    }

    return null;
  };

  // Colonnes pour le mode lecture seule (sans actions)
  const readOnlyColumns = columns.filter(c => c.id !== 'actions');

  // En mode lecture seule (publié), afficher les tuiles et la liste des alertes (sans édition)
  if (readOnly) {
    return (
      <div
        ref={containerRef}
        className="flex flex-col h-full bg-[#F5F7FA]"
      >
        {/* Partie haute : Tuiles de comptage */}
        <div className="flex-shrink-0 p-4 overflow-hidden" style={{ height: `${splitPosition}%` }}>
          <div className="grid grid-cols-4 gap-4 h-full">
            {/* Total - Bleu */}
            <div
              className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
              style={{ backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }}
            >
              <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.information.hex }}>
                <MuiIcon name="Warning" size={16} />
                <span className="text-xs font-medium whitespace-nowrap">Alertes totales en cours</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.information.hex }}>{counts.total}</span>
            </div>

            {/* Fatales - Violet */}
            <div
              className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
              style={{ backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }}
            >
              <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.fatal.hex }}>
                <MuiIcon name="Warning" size={16} />
                <span className="text-xs font-medium whitespace-nowrap">Alertes fatales</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.fatal.hex }}>{counts.fatal}</span>
            </div>

            {/* Critiques - Rouge */}
            <div
              className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
              style={{ backgroundColor: '#FEE2E2', borderColor: '#FECACA' }}
            >
              <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.critique.hex }}>
                <MuiIcon name="Warning" size={16} />
                <span className="text-xs font-medium whitespace-nowrap">Alertes critiques</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.critique.hex }}>{counts.critique}</span>
            </div>

            {/* Mineures - Orange */}
            <div
              className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
              style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}
            >
              <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.mineur.hex }}>
                <MuiIcon name="Warning" size={16} />
                <span className="text-xs font-medium whitespace-nowrap">Alertes mineures</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.mineur.hex }}>{counts.mineur}</span>
            </div>
          </div>
        </div>

        {/* Séparateur (non interactif en mode lecture) */}
        <div className="h-2 bg-[#E2E8F0] flex items-center justify-center">
          <div className="w-12 h-1 bg-[#94A3B8] rounded-full" />
        </div>

        {/* Partie basse : Tableau d'incidents en lecture seule */}
        <div
          className="flex-1 overflow-hidden flex flex-col bg-white"
          style={{ height: `${100 - splitPosition}%` }}
        >
          {/* En-têtes du tableau */}
          <div className="flex-shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex">
              {readOnlyColumns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center px-2 py-2 text-xs font-semibold text-[#64748B] uppercase tracking-wider border-r border-[#E2E8F0] last:border-r-0"
                  style={{ width: column.width, minWidth: column.minWidth }}
                >
                  <span className="truncate">{column.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Corps du tableau avec scroll */}
          <div className="flex-1 overflow-y-auto">
            {filteredAndSortedIncidents.map((incident) => (
              <div
                key={incident.id}
                className="flex border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                style={{ marginBottom: rowSpacing }}
              >
                {readOnlyColumns.map(column => (
                  <div
                    key={column.id}
                    className="px-2 py-1.5 text-sm text-[#1E3A5F] border-r border-[#E2E8F0] last:border-r-0 flex items-center"
                    style={{ width: column.width, minWidth: column.minWidth }}
                  >
                    {renderCell(incident, column.id, false)}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Message si aucun incident */}
          {incidents.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-[#94A3B8]">
              <div className="text-center">
                <MuiIcon name="CheckCircle" size={48} className="mx-auto mb-2 text-[#9CCC65]" />
                <p>Aucun incident enregistré</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-[#F5F7FA]"
    >
      {/* Partie haute : Tuiles de comptage */}
      <div
        className="flex-shrink-0 p-4 overflow-hidden"
        style={{ height: `${splitPosition}%` }}
      >
        <div className="grid grid-cols-4 gap-4 h-full">
          {/* Total - Bleu */}
          <div
            className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
            style={{ backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }}
          >
            <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.information.hex }}>
              <MuiIcon name="Warning" size={16} />
              <span className="text-xs font-medium whitespace-nowrap">Alertes totales en cours</span>
            </div>
            <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.information.hex }}>{counts.total}</span>
          </div>

          {/* Fatales - Violet */}
          <div
            className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
            style={{ backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }}
          >
            <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.fatal.hex }}>
              <MuiIcon name="Warning" size={16} />
              <span className="text-xs font-medium whitespace-nowrap">Alertes fatales</span>
            </div>
            <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.fatal.hex }}>{counts.fatal}</span>
          </div>

          {/* Critiques - Rouge */}
          <div
            className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
            style={{ backgroundColor: '#FEE2E2', borderColor: '#FECACA' }}
          >
            <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.critique.hex }}>
              <MuiIcon name="Warning" size={16} />
              <span className="text-xs font-medium whitespace-nowrap">Alertes critiques</span>
            </div>
            <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.critique.hex }}>{counts.critique}</span>
          </div>

          {/* Mineures - Orange */}
          <div
            className="rounded-xl border-2 shadow-sm flex flex-col items-center justify-center p-2 overflow-hidden"
            style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}
          >
            <div className="flex items-center gap-2" style={{ color: STATUS_COLORS.mineur.hex }}>
              <MuiIcon name="Warning" size={16} />
              <span className="text-xs font-medium whitespace-nowrap">Alertes mineures</span>
            </div>
            <span className="text-3xl font-bold" style={{ color: STATUS_COLORS.mineur.hex }}>{counts.mineur}</span>
          </div>
        </div>
      </div>

      {/* Séparateur redimensionnable */}
      <div
        className={`h-2 bg-[#E2E8F0] cursor-row-resize hover:bg-[#CBD5E1] transition-colors flex items-center justify-center ${isResizingSplit ? 'bg-[#94A3B8]' : ''}`}
        onMouseDown={handleSplitMouseDown}
      >
        <div className="w-12 h-1 bg-[#94A3B8] rounded-full" />
      </div>

      {/* Partie basse : Tableau d'incidents */}
      <div
        ref={tableRef}
        className="flex-1 overflow-hidden flex flex-col bg-white"
        style={{ height: `${100 - splitPosition}%` }}
      >
        {/* En-têtes du tableau */}
        <div className="flex-shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex">
            {columns.map((column, index) => {
              const sortState = getSortState(column.id);
              const hasFilter = filters[column.id] && filters[column.id].length > 0;
              const hasSort = sortState !== 'none';

              return (
                <div
                  key={column.id}
                  className="relative flex items-center px-2 py-2 text-xs font-semibold text-[#64748B] uppercase tracking-wider border-r border-[#E2E8F0] last:border-r-0"
                  style={{ width: column.width, minWidth: column.minWidth }}
                >
                  <div className="flex items-center gap-1 flex-1 overflow-hidden">
                    <span className="truncate">{column.label}</span>

                    {/* Bouton de tri (sauf pour description et actions) */}
                    {column.sortable && column.id !== 'description' && (
                      <button
                        onClick={() => handleSort(column.id)}
                        className={`p-0.5 rounded hover:bg-[#E2E8F0] transition-colors ${hasSort ? 'bg-[#DBEAFE] text-[#1E3A5F]' : ''}`}
                        title={sortState === 'none' ? 'Trier' : sortState === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
                      >
                        <MuiIcon
                          name={sortState === 'asc' ? 'ArrowUpward' : sortState === 'desc' ? 'ArrowDownward' : 'UnfoldMore'}
                          size={12}
                        />
                      </button>
                    )}

                    {/* Bouton de filtre */}
                    {column.filterable && (
                      <button
                        onClick={() => setShowFilterMenu(showFilterMenu === column.id ? null : column.id)}
                        className={`p-0.5 rounded hover:bg-[#E2E8F0] transition-colors ${hasFilter ? 'bg-[#DBEAFE] text-[#1E3A5F]' : ''}`}
                        title="Filtrer"
                      >
                        <MuiIcon name="FilterList" size={12} />
                      </button>
                    )}
                  </div>

                  {/* Menu de filtre */}
                  {showFilterMenu === column.id && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-50 min-w-[150px]">
                      <div className="p-2 border-b border-[#E2E8F0]">
                        <span className="text-xs text-[#64748B]">
                          {filters[column.id]?.length || 0} sélectionné(s)
                        </span>
                      </div>
                      {column.id === 'severity' && (
                        <div className="border-t border-[#E2E8F0]">
                          {(['fatal', 'critique', 'mineur'] as IncidentSeverity[]).map(sev => {
                            const isSelected = filters.severity?.includes(sev);
                            return (
                              <button
                                key={sev}
                                onClick={() => {
                                  setFilters(prev => {
                                    const current = prev.severity || [];
                                    const newValues = isSelected
                                      ? current.filter(v => v !== sev)
                                      : [...current, sev];
                                    return { ...prev, severity: newValues };
                                  });
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#F5F7FA] flex items-center gap-2 ${isSelected ? 'bg-[#DBEAFE]' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  className="rounded border-[#E2E8F0]"
                                />
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: SEVERITY_HEX[sev] }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {column.id === 'responsible' && (
                        <div className="border-t border-[#E2E8F0]">
                          {[{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }].map(opt => {
                            const isSelected = filters.responsible?.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setFilters(prev => {
                                    const current = prev.responsible || [];
                                    const newValues = isSelected
                                      ? current.filter(v => v !== opt.value)
                                      : [...current, opt.value];
                                    return { ...prev, responsible: newValues };
                                  });
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#F5F7FA] flex items-center gap-2 ${isSelected ? 'bg-[#DBEAFE]' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  className="rounded border-[#E2E8F0]"
                                />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {getUniqueValues(column.id).length > 0 && column.id !== 'severity' && column.id !== 'responsible' && (
                        <div className="border-t border-[#E2E8F0] max-h-40 overflow-y-auto">
                          {getUniqueValues(column.id).map(value => {
                            const isSelected = filters[column.id]?.includes(value);
                            return (
                              <button
                                key={value}
                                onClick={() => {
                                  setFilters(prev => {
                                    const current = prev[column.id] || [];
                                    const newValues = isSelected
                                      ? current.filter(v => v !== value)
                                      : [...current, value];
                                    return { ...prev, [column.id]: newValues };
                                  });
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#F5F7FA] truncate flex items-center gap-2 ${isSelected ? 'bg-[#DBEAFE]' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  className="rounded border-[#E2E8F0] flex-shrink-0"
                                />
                                <span className="truncate">{value}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="border-t border-[#E2E8F0] p-2">
                        <button
                          onClick={() => {
                            setFilters(prev => {
                              const newFilters = { ...prev };
                              delete newFilters[column.id];
                              return newFilters;
                            });
                            setShowFilterMenu(null);
                          }}
                          className="w-full px-2 py-1 text-xs text-[#64748B] hover:text-[#1E3A5F]"
                        >
                          Effacer le filtre
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Poignée de redimensionnement avec double-clic */}
                  {index < columns.length - 1 && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#94A3B8] z-10"
                      onMouseDown={(e) => handleColumnResizeStart(column.id, e)}
                      onDoubleClick={() => handleColumnAutoFit(column.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Corps du tableau */}
        <div className="flex-1 overflow-y-auto">
          {filteredAndSortedIncidents.map((incident) => {
            const isEditing = editingIncidentId === incident.id;
            return (
              <div
                key={incident.id}
                className={`flex border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors ${isEditing ? 'bg-[#FFFBEB]' : ''}`}
                style={{ marginBottom: rowSpacing }}
              >
                {columns.map(column => (
                  <div
                    key={column.id}
                    className="px-2 py-1.5 text-sm text-[#1E3A5F] border-r border-[#E2E8F0] last:border-r-0 flex items-center"
                    style={{ width: column.width, minWidth: column.minWidth }}
                  >
                    {column.id === 'actions' ? (
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleConfirmEditing}
                              className="p-1 text-[#9CCC65] hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Valider"
                            >
                              <MuiIcon name="Check" size={14} />
                            </button>
                            <button
                              onClick={handleCancelEditing}
                              className="p-1 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Annuler"
                            >
                              <MuiIcon name="Close" size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEditing(incident)}
                              className="p-1 text-[#94A3B8] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors"
                              title="Éditer"
                            >
                              <MuiIcon name="Edit" size={14} />
                            </button>
                            <button
                              onClick={() => handleDuplicateIncident(incident)}
                              className="p-1 text-[#94A3B8] hover:text-[#1E3A5F] hover:bg-[#F5F7FA] rounded transition-colors"
                              title="Dupliquer"
                            >
                              <MuiIcon name="ContentCopy" size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteIncident(incident.id)}
                              className="p-1 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer"
                            >
                              <MuiIcon name="Delete" size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      renderCell(incident, column.id, isEditing)
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Ligne d'ajout */}
          <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]">
            {columns.map(column => (
              <div
                key={column.id}
                className="px-1 py-1.5 text-sm border-r border-[#E2E8F0] last:border-r-0 flex items-center"
                style={{ width: column.width, minWidth: column.minWidth }}
              >
                {column.id === 'severity' && (
                  <div className="flex gap-1 justify-center w-full">
                    {(['fatal', 'critique', 'mineur'] as IncidentSeverity[]).map(sev => (
                      <button
                        key={sev}
                        onClick={() => setNewIncident(prev => ({ ...prev, severity: sev }))}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${newIncident.severity === sev ? 'border-[#1E3A5F] scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: SEVERITY_HEX[sev] }}
                      />
                    ))}
                  </div>
                )}
                {column.id === 'startDate' && (
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(newIncident.startDate)}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, startDate: new Date(e.target.value).toISOString() }))}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded"
                  />
                )}
                {column.id === 'endDate' && (
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(newIncident.endDate)}
                    min={toDateTimeLocal(newIncident.startDate)}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded"
                  />
                )}
                {column.id === 'duration' && (
                  <span className="text-[#94A3B8] text-xs">
                    {newIncident.startDate ? calculateDuration(newIncident.startDate, newIncident.endDate) : '-'}
                  </span>
                )}
                {column.id === 'targetDomainName' && (
                  <select
                    value={selectedDomainForNew}
                    onChange={(e) => {
                      setSelectedDomainForNew(e.target.value);
                      setSelectedCategoryForNew('');
                      setSelectedElementForNew('');
                      setSelectedSubCategoryForNew('');
                    }}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white"
                  >
                    <option value="">-</option>
                    {domainOptions.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
                {column.id === 'targetCategoryName' && (
                  <select
                    value={selectedCategoryForNew}
                    onChange={(e) => {
                      setSelectedCategoryForNew(e.target.value);
                      setSelectedElementForNew('');
                      setSelectedSubCategoryForNew('');
                    }}
                    disabled={!selectedDomainForNew}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white disabled:bg-[#F5F7FA] disabled:text-[#94A3B8]"
                  >
                    <option value="">-</option>
                    {categoryOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {column.id === 'targetElementName' && (
                  <select
                    value={selectedElementForNew}
                    onChange={(e) => {
                      setSelectedElementForNew(e.target.value);
                      setSelectedSubCategoryForNew('');
                    }}
                    disabled={!selectedCategoryForNew}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white disabled:bg-[#F5F7FA] disabled:text-[#94A3B8]"
                  >
                    <option value="">-</option>
                    {elementOptions.map(el => (
                      <option key={el.id} value={el.id}>{el.name}</option>
                    ))}
                  </select>
                )}
                {column.id === 'targetSubCategoryName' && (
                  <select
                    value={selectedSubCategoryForNew}
                    onChange={(e) => setSelectedSubCategoryForNew(e.target.value)}
                    disabled={!selectedElementForNew}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white disabled:bg-[#F5F7FA] disabled:text-[#94A3B8]"
                  >
                    <option value="">-</option>
                    {subCategoryOptions.map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                )}
                {column.id === 'targetSubElementName' && (
                  <select
                    value={newIncident.targetSubElementId || ''}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, targetSubElementId: e.target.value || undefined }))}
                    disabled={!selectedSubCategoryForNew}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white disabled:bg-[#F5F7FA] disabled:text-[#94A3B8]"
                  >
                    <option value="">-</option>
                    {subElementOptions.map(se => (
                      <option key={se.id} value={se.id}>{se.name}</option>
                    ))}
                  </select>
                )}
                {column.id === 'responsible' && (
                  <select
                    value={newIncident.responsible !== false ? 'oui' : 'non'}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, responsible: e.target.value === 'oui' }))}
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded bg-white"
                  >
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                )}
                {column.id === 'description' && (
                  <input
                    type="text"
                    value={newIncident.description || ''}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description..."
                    className="w-full px-1 py-0.5 text-xs border border-[#E2E8F0] rounded"
                  />
                )}
                {column.id === 'actions' && (
                  <button
                    onClick={handleAddIncident}
                    className="p-1 text-[#9CCC65] hover:text-green-600 hover:bg-green-50 rounded transition-colors mx-auto"
                    title="Ajouter"
                  >
                    <MuiIcon name="Add" size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Message si aucun incident */}
        {incidents.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[#94A3B8]">
            <div className="text-center">
              <MuiIcon name="CheckCircle" size={48} className="mx-auto mb-2 text-[#9CCC65]" />
              <p>Aucun incident enregistré</p>
              <p className="text-sm">Utilisez la ligne ci-dessus pour ajouter un incident</p>
            </div>
          </div>
        )}
      </div>

      {/* Fermer le menu de filtre quand on clique ailleurs */}
      {showFilterMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowFilterMenu(null)}
        />
      )}
    </div>
  );
}



