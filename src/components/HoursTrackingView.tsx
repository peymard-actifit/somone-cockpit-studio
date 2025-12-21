import { useState, useMemo, useRef, useEffect } from 'react';
import type { Domain, Resource, ResourceType, TimeEntry, HalfDay, SupplierEntry } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface HoursTrackingViewProps {
  domain: Domain;
  readOnly?: boolean;
}

// Helper pour obtenir la date locale au format ISO (YYYY-MM-DD) sans problème de fuseau horaire
function getLocalDateISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Composant pour une ressource sortable
function SortableResourceItem({
  resource,
  columnWidth,
  editingResourceId,
  editingResourceName,
  setEditingResourceId,
  setEditingResourceName,
  updateResourceName,
  updateDailyRate,
  getPersonDays,
  getPersonTotal,
  getSupplierTotal,
  handleDeleteResource,
  readOnly,
  columnRef
}: {
  resource: Resource;
  columnWidth: number;
  editingResourceId: string | null;
  editingResourceName: string;
  setEditingResourceId: (id: string | null) => void;
  setEditingResourceName: (name: string) => void;
  updateResourceName: (id: string, name: string) => void;
  updateDailyRate: (id: string, rate: number) => void;
  getPersonDays: (resource: Resource) => { past: number; future: number };
  getPersonTotal: (resource: Resource) => { past: number; future: number };
  getSupplierTotal: (resource: Resource) => { past: number; future: number };
  handleDeleteResource: (id: string) => void;
  readOnly: boolean;
  columnRef: React.RefObject<HTMLDivElement>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: resource.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style, height: '40px' }} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB] flex">
      <div
        ref={columnRef}
        className="bg-white border-r border-[#E2E8F0] p-2 relative group flex items-center flex-shrink-0"
        style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px`, height: '40px' }}
      >
        <div className="flex items-center w-full h-full relative">
          {/* Nom à gauche */}
          <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: '30%' }}>
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <MuiIcon
                name={resource.type === 'person' ? 'Person' : 'Business'}
                size={16}
                className="text-[#1E3A5F] flex-shrink-0"
              />
            </div>
            {editingResourceId === resource.id ? (
              <input
                type="text"
                value={editingResourceName}
                onChange={(e) => setEditingResourceName(e.target.value)}
                onBlur={() => {
                  if (editingResourceName.trim()) {
                    updateResourceName(resource.id, editingResourceName);
                  } else {
                    setEditingResourceId(null);
                    setEditingResourceName('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingResourceName.trim()) {
                      updateResourceName(resource.id, editingResourceName);
                    } else {
                      setEditingResourceId(null);
                      setEditingResourceName('');
                    }
                  }
                  if (e.key === 'Escape') {
                    setEditingResourceId(null);
                    setEditingResourceName('');
                  }
                }}
                className="font-medium text-[#1E3A5F] text-sm bg-white border border-[#1E3A5F] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                autoFocus
              />
            ) : (
              <span
                className="font-medium text-[#1E3A5F] text-sm whitespace-nowrap truncate cursor-pointer hover:underline"
                onClick={() => {
                  if (!readOnly) {
                    setEditingResourceId(resource.id);
                    setEditingResourceName(resource.name);
                  }
                }}
                title={readOnly ? undefined : "Cliquer pour éditer"}
              >
                {resource.name}
              </span>
            )}
          </div>

          {/* Zone TJM centrée */}
          {resource.type === 'person' && (
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1">
              <label className="text-[10px] text-[#64748B] whitespace-nowrap">TJM:</label>
              {readOnly ? (
                <span className="text-xs font-semibold text-[#1E3A5F]">
                  {resource.dailyRate?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '') || '0€'}
                </span>
              ) : (
                <input
                  type="number"
                  value={resource.dailyRate || 0}
                  onChange={(e) => updateDailyRate(resource.id, parseFloat(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 bg-white border border-[#1E3A5F] rounded text-xs font-semibold text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  min="0"
                  step="10"
                  placeholder="0"
                />
              )}
            </div>
          )}

          {/* Infos à droite (jours/total + poubelle) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            {resource.type === 'person' ? (
              <>
                <span className="text-[10px] text-[#64748B]">
                  {(() => {
                    const days = getPersonDays(resource);
                    if (days.past === 0 && days.future === 0) {
                      return '0 JH';
                    }
                    const formatJH = (jh: number) => {
                      return jh % 1 === 0 ? jh.toString() : jh.toFixed(1);
                    };
                    return (
                      <>
                        {days.past > 0 && <span>{formatJH(days.past)}</span>}
                        {days.past > 0 && days.future > 0 && <span>/</span>}
                        {days.future > 0 && <span className="text-green-600">{formatJH(days.future)}</span>}
                        <span className="ml-0.5">JH</span>
                      </>
                    );
                  })()}
                </span>
                <span className="text-xs font-semibold text-[#1E3A5F]">
                  {(() => {
                    const totals = getPersonTotal(resource);
                    if (totals.past === 0 && totals.future === 0) {
                      return '0€';
                    }
                    return (
                      <>
                        {totals.past > 0 && <span>{totals.past.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '')}</span>}
                        {totals.past > 0 && totals.future > 0 && <span>/</span>}
                        {totals.future > 0 && <span className="text-green-600">{totals.future.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '')}</span>}
                      </>
                    );
                  })()}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] text-[#64748B]">Total:</span>
                <span className="text-xs font-semibold text-[#1E3A5F]">
                  {(() => {
                    const totals = getSupplierTotal(resource);
                    if (totals.past === 0 && totals.future === 0) {
                      return '0€';
                    }
                    return (
                      <>
                        {totals.past > 0 && <span>{totals.past.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '')}</span>}
                        {totals.past > 0 && totals.future > 0 && <span>/</span>}
                        {totals.future > 0 && <span className="text-green-600">{totals.future.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '')}</span>}
                      </>
                    );
                  })()}
                </span>
              </>
            )}
            {!readOnly && (
              <button
                onClick={() => handleDeleteResource(resource.id)}
                className="text-[#E57373] hover:text-red-600 p-0.5 flex-shrink-0 ml-1"
                title="Supprimer"
              >
                <MuiIcon name="Delete" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Poignée de redimensionnement - masquée car on utilise l'icône pour drag */}
      </div>
    </div>
  );
}

export default function HoursTrackingView({ domain, readOnly = false }: HoursTrackingViewProps) {
  const { updateDomain } = useCockpitStore();
  const hoursData = domain.hoursTracking || {
    projectStartDate: new Date().toISOString().split('T')[0],
    projectEndDate: (() => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3); // 3 mois par défaut
      return endDate.toISOString().split('T')[0];
    })(),
    salePrice: 0,
    resources: []
  };

  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceType, setNewResourceType] = useState<ResourceType>('person');
  const [newResourceDailyRate, setNewResourceDailyRate] = useState<number>(0);
  const [showAddResource, setShowAddResource] = useState(false);
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; value: number } | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingResourceName, setEditingResourceName] = useState<string>('');

  // État pour la sélection par zone
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ resourceId: string; date: string; halfDay: HalfDay } | null>(null);
  const [selectionCurrent, setSelectionCurrent] = useState<{ date: string; halfDay: HalfDay } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ resourceId: string; date: string; halfDay: HalfDay } | null>(null);

  // Largeur de la première colonne (nom + infos)
  const storageKey = `hoursTracking_colWidth_${domain.id}`;
  const [columnWidth, setColumnWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) return parseInt(saved, 10);
    // Largeur par défaut ajustée pour aligner toutes les poubelles
    // Nom à gauche + TJM centré + jours/total à droite + poubelle alignée
    return 320; // px (ajusté pour aligner les poubelles)
  });

  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const columnRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Hauteur du graphique (redimensionnable)
  const [graphHeight, setGraphHeight] = useState(300);
  const isResizingGraph = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Générer la liste des dates depuis projectStartDate jusqu'à projectEndDate
  const dates = useMemo(() => {
    const startDate = new Date(hoursData.projectStartDate);
    const endDate = hoursData.projectEndDate
      ? new Date(hoursData.projectEndDate)
      : (() => {
        const defaultEnd = new Date(startDate);
        defaultEnd.setDate(defaultEnd.getDate() + 90);
        return defaultEnd;
      })();

    const dateList: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dateList.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dateList;
  }, [hoursData.projectStartDate, hoursData.projectEndDate]);

  // Calculer le nombre de jours/hommes (JH) imputés pour une personne (passés et futurs séparément)
  const getPersonDays = (resource: Resource): { past: number; future: number } => {
    if (resource.type !== 'person' || !resource.timeEntries) return { past: 0, future: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let pastJH = 0;
    let futureJH = 0;

    // Grouper les imputations par date
    const entriesByDate = new Map<string, { morning: boolean; afternoon: boolean }>();

    resource.timeEntries.forEach(te => {
      const existing = entriesByDate.get(te.date) || { morning: false, afternoon: false };
      if (te.halfDay === 'morning') {
        existing.morning = true;
      } else if (te.halfDay === 'afternoon') {
        existing.afternoon = true;
      }
      entriesByDate.set(te.date, existing);
    });

    // Calculer les JH par date
    entriesByDate.forEach((entry, date) => {
      let jh = 0;
      if (entry.morning && entry.afternoon) {
        jh = 1; // Journée complète = 1 JH
      } else if (entry.morning || entry.afternoon) {
        jh = 0.5; // Demi-journée = 0.5 JH
      }

      if (date < todayStr) {
        pastJH += jh;
      } else if (date > todayStr) {
        futureJH += jh;
      } else {
        // Aujourd'hui compte comme passé
        pastJH += jh;
      }
    });

    return { past: pastJH, future: futureJH };
  };

  // Calculer le coût total pour une personne (passé et futur séparément)
  const getPersonTotal = (resource: Resource): { past: number; future: number } => {
    if (resource.type !== 'person' || !resource.dailyRate || !resource.timeEntries) return { past: 0, future: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const dailyRate = resource.dailyRate; // S'assurer que dailyRate est défini

    let pastCost = 0;
    let futureCost = 0;

    resource.timeEntries.forEach(te => {
      const cost = dailyRate * 0.5; // Demi-journée
      if (te.date < todayStr) {
        pastCost += cost;
      } else if (te.date > todayStr) {
        futureCost += cost;
      } else {
        // Aujourd'hui compte comme passé
        pastCost += cost;
      }
    });

    return { past: pastCost, future: futureCost };
  };

  // Calculer le coût total pour un fournisseur (passé et futur séparément)
  const getSupplierTotal = (resource: Resource): { past: number; future: number } => {
    if (resource.type !== 'supplier' || !resource.entries) return { past: 0, future: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let pastCost = 0;
    let futureCost = 0;

    resource.entries.forEach(entry => {
      if (entry.date < todayStr) {
        pastCost += entry.amount;
      } else if (entry.date > todayStr) {
        futureCost += entry.amount;
      } else {
        // Aujourd'hui compte comme passé
        pastCost += entry.amount;
      }
    });

    return { past: pastCost, future: futureCost };
  };

  // Calculer le coût par jour (somme de toutes les personnes + fournisseurs)
  const getDayCost = (date: string): number => {
    let cost = 0;

    hoursData.resources.forEach(resource => {
      if (resource.type === 'person' && resource.dailyRate && resource.timeEntries) {
        const hasMorning = resource.timeEntries.some(te => te.date === date && te.halfDay === 'morning');
        const hasAfternoon = resource.timeEntries.some(te => te.date === date && te.halfDay === 'afternoon');
        if (hasMorning || hasAfternoon) {
          // Si les deux demi-journées sont cochées, c'est une journée complète
          if (hasMorning && hasAfternoon) {
            cost += resource.dailyRate;
          } else {
            // Sinon, c'est une demi-journée = 50% du TJM
            cost += resource.dailyRate * 0.5;
          }
        }
      } else if (resource.type === 'supplier' && resource.entries) {
        const entry = resource.entries.find(e => e.date === date);
        if (entry) {
          cost += entry.amount;
        }
      }
    });

    return cost;
  };

  // Calculer le coût global
  const getGlobalCost = (): number => {
    let total = 0;

    hoursData.resources.forEach(resource => {
      if (resource.type === 'person') {
        const totals = getPersonTotal(resource);
        total += totals.past + totals.future;
      } else if (resource.type === 'supplier') {
        const totals = getSupplierTotal(resource);
        total += totals.past + totals.future;
      }
    });

    return total;
  };

  // Calculer les coûts dépensés (passés)
  const getSpentCost = (): number => {
    let total = 0;

    hoursData.resources.forEach(resource => {
      if (resource.type === 'person') {
        const totals = getPersonTotal(resource);
        total += totals.past;
      } else if (resource.type === 'supplier') {
        const totals = getSupplierTotal(resource);
        total += totals.past;
      }
    });

    return total;
  };

  // Calculer les coûts prévus (futurs)
  const getPlannedCost = (): number => {
    let total = 0;

    hoursData.resources.forEach(resource => {
      if (resource.type === 'person') {
        const totals = getPersonTotal(resource);
        total += totals.future;
      } else if (resource.type === 'supplier') {
        const totals = getSupplierTotal(resource);
        total += totals.future;
      }
    });

    return total;
  };

  // Calculer le nombre de jours imputés par date
  const getDaysByDate = (date: string): number => {
    let days = 0;
    hoursData.resources.forEach(resource => {
      if (resource.type === 'person' && resource.timeEntries) {
        const hasMorning = resource.timeEntries.some(te => te.date === date && te.halfDay === 'morning');
        const hasAfternoon = resource.timeEntries.some(te => te.date === date && te.halfDay === 'afternoon');
        if (hasMorning && hasAfternoon) {
          days += 1; // Journée complète
        } else if (hasMorning || hasAfternoon) {
          days += 0.5; // Demi-journée
        }
      }
    });
    return days;
  };

  // Calculer le coût cumulé jusqu'à une date
  const getCumulativeCost = (date: string): number => {
    let total = 0;
    const targetDate = new Date(date);

    hoursData.resources.forEach(resource => {
      if (resource.type === 'person' && resource.dailyRate !== undefined && resource.timeEntries) {
        const dailyRate = resource.dailyRate;
        resource.timeEntries.forEach(te => {
          const entryDate = new Date(te.date);
          if (entryDate <= targetDate) {
            total += dailyRate * 0.5; // Demi-journée
          }
        });
      } else if (resource.type === 'supplier' && resource.entries) {
        resource.entries.forEach(entry => {
          const entryDate = new Date(entry.date);
          if (entryDate <= targetDate) {
            total += entry.amount;
          }
        });
      }
    });

    return total;
  };

  // Calculer le coût cumulé fournisseurs jusqu'à une date
  const getCumulativeSupplierCost = (date: string): number => {
    let total = 0;
    const targetDate = new Date(date);

    hoursData.resources.forEach(resource => {
      if (resource.type === 'supplier' && resource.entries) {
        resource.entries.forEach(entry => {
          const entryDate = new Date(entry.date);
          if (entryDate <= targetDate) {
            total += entry.amount;
          }
        });
      }
    });

    return total;
  };

  // Générer les dates pour le graphique (de projectStartDate à projectEndDate)
  const chartDates = useMemo(() => {
    const startDate = new Date(hoursData.projectStartDate);
    const endDate = hoursData.projectEndDate
      ? new Date(hoursData.projectEndDate)
      : (() => {
        const defaultEnd = new Date(startDate);
        defaultEnd.setMonth(defaultEnd.getMonth() + 3);
        return defaultEnd;
      })();

    const dateList: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dateList.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dateList;
  }, [hoursData.projectStartDate, hoursData.projectEndDate]);

  // Calculer les données pour le graphique
  const chartData = useMemo(() => {
    return chartDates.map(date => ({
      date,
      days: getDaysByDate(date),
      cumulativeCost: getCumulativeCost(date),
      cumulativeSupplierCost: getCumulativeSupplierCost(date)
    }));
  }, [chartDates, hoursData.resources, hoursData.projectStartDate]);

  const salePrice = hoursData.salePrice || 0;

  // Calculer les valeurs max réelles pour les échelles (avec limites de réserve d'espace)
  const maxDays = useMemo(() => {
    const realMax = Math.max(...chartData.map(d => d.days), 1);
    // Utiliser le max réel mais réserver de l'espace jusqu'à 365
    return Math.max(realMax * 1.1, 10); // Au moins 10% de marge, minimum 10 jours
  }, [chartData]);

  const maxCost = useMemo(() => {
    const realMax = Math.max(...chartData.map(d => d.cumulativeCost), salePrice || 0, 1000);
    // Utiliser le max réel mais réserver de l'espace jusqu'à 999999
    return Math.max(realMax * 1.1, 1000); // Au moins 10% de marge, minimum 1000€
  }, [chartData, salePrice]);

  // Calculer la marge
  const getMargin = (): number => {
    const globalCost = getGlobalCost();
    return salePrice - globalCost;
  };

  // Ajouter une ressource
  const handleAddResource = (type?: ResourceType, dailyRate?: number) => {
    const resourceType = type || newResourceType;
    const resourceName = type ? '' : newResourceName.trim();
    const resourceDailyRate = dailyRate !== undefined ? dailyRate : (resourceType === 'person' ? newResourceDailyRate : undefined);

    if (!resourceName && !type) {
      // Si on appelle depuis le formulaire, vérifier le nom
      if (!newResourceName.trim()) return;
    }

    const newResource: Resource = {
      id: crypto.randomUUID(),
      type: resourceType,
      name: resourceName || (resourceType === 'person' ? 'Nouvelle personne' : 'Nouveau fournisseur'),
      order: hoursData.resources.length > 0 ? Math.max(...hoursData.resources.map(r => r.order || 0)) + 1 : 0,
      ...(resourceType === 'person'
        ? { dailyRate: resourceDailyRate || 0, timeEntries: [] }
        : { entries: [] }
      )
    };

    const updatedData = {
      ...hoursData,
      resources: [...hoursData.resources, newResource]
    };

    updateDomain(domain.id, { hoursTracking: updatedData });
    setNewResourceName('');
    setNewResourceDailyRate(0);
    setNewResourceType('person');
    setShowAddResource(false);
  };

  // Toggle une demi-journée pour une personne
  const toggleHalfDay = (resourceId: string, date: string, halfDay: HalfDay, forceAdd?: boolean) => {
    if (readOnly) return;

    const resource = hoursData.resources.find(r => r.id === resourceId);
    if (!resource || resource.type !== 'person') return;

    const timeEntries = resource.timeEntries || [];
    const existingIndex = timeEntries.findIndex(
      te => te.date === date && te.halfDay === halfDay
    );

    let updatedEntries: TimeEntry[];
    if (forceAdd === true) {
      // Forcer l'ajout (pour la sélection par zone)
      if (existingIndex < 0) {
        updatedEntries = [...timeEntries, { date, halfDay }];
      } else {
        updatedEntries = timeEntries; // Déjà présent
      }
    } else if (existingIndex >= 0) {
      // Retirer la demi-journée
      updatedEntries = timeEntries.filter((_, i) => i !== existingIndex);
    } else {
      // Ajouter la demi-journée
      updatedEntries = [...timeEntries, { date, halfDay }];
    }

    const updatedResources = hoursData.resources.map(r =>
      r.id === resourceId
        ? { ...r, timeEntries: updatedEntries }
        : r
    );

    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        resources: updatedResources
      }
    });
  };

  // Démarrer la sélection par zone
  const handleSelectionStart = (resourceId: string, date: string, halfDay: HalfDay) => {
    if (readOnly) return;
    const resource = hoursData.resources.find(r => r.id === resourceId);
    if (!resource || resource.type !== 'person') return;

    setIsSelecting(true);
    isSelectingRef.current = true;
    const start = { resourceId, date, halfDay };
    setSelectionStart(start);
    selectionStartRef.current = start;
    setSelectionCurrent({ date, halfDay });

    // Marquer qu'on a commencé une sélection pour éviter le toggle immédiat
    setTimeout(() => {
      // Si on n'a pas bougé après 100ms, c'est probablement un clic simple
      if (isSelectingRef.current && selectionStartRef.current &&
        selectionStartRef.current.date === date &&
        selectionStartRef.current.halfDay === halfDay) {
        // Pas de mouvement, on peut considérer ça comme un clic simple
        // Mais on attend quand même le mouseup pour être sûr
      }
    }, 100);
  };

  // Mettre à jour la sélection en cours
  const handleSelectionMove = (date: string, halfDay: HalfDay) => {
    if (!isSelectingRef.current || !selectionStartRef.current) return;
    setSelectionCurrent({ date, halfDay });
  };

  // Finaliser la sélection par zone
  const handleSelectionEnd = () => {
    // Si on n'a pas vraiment fait de sélection (pas de mouvement), on ne fait rien
    // Le onClick du bouton gérera le toggle simple
    if (!isSelectingRef.current || !selectionStartRef.current) {
      setIsSelecting(false);
      isSelectingRef.current = false;
      setSelectionStart(null);
      selectionStartRef.current = null;
      setSelectionCurrent(null);
      return;
    }

    // Vérifier si on a vraiment bougé (sélection par zone) ou juste cliqué (toggle simple)
    const selectionStartValue = selectionStartRef.current;
    const selectionCurrentValue = selectionCurrent;

    // Si on est resté sur le même bouton, c'est un clic simple, pas une sélection
    if (selectionCurrentValue && selectionStartValue &&
      selectionStartValue.date === selectionCurrentValue.date &&
      selectionStartValue.halfDay === selectionCurrentValue.halfDay) {
      setIsSelecting(false);
      isSelectingRef.current = false;
      setSelectionStart(null);
      selectionStartRef.current = null;
      setSelectionCurrent(null);
      return; // Laisser le onClick gérer le toggle
    }

    const start = selectionStartRef.current;
    const current = selectionCurrent;

    if (!current) {
      setIsSelecting(false);
      isSelectingRef.current = false;
      setSelectionStart(null);
      selectionStartRef.current = null;
      setSelectionCurrent(null);
      return;
    }

    // Trouver toutes les dates entre start et current
    const startDate = new Date(start.date);
    const endDate = new Date(current.date);
    const datesInRange: string[] = [];

    // Trier les dates pour gérer les cas où on sélectionne vers le passé
    const sortedDates = [startDate, endDate].sort((a, b) => a.getTime() - b.getTime());
    const minDate = sortedDates[0];
    const maxDate = sortedDates[1];

    // Générer toutes les dates dans la plage
    const currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      datesInRange.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Appliquer la sélection à toutes les demi-journées dans la plage
    // Si on commence par "morning" et finit par "afternoon" (ou vice versa), on sélectionne les deux demi-journées
    const halfDaysToSelect: HalfDay[] = [];
    if (start.halfDay === 'morning' && current.halfDay === 'afternoon') {
      halfDaysToSelect.push('morning', 'afternoon');
    } else if (start.halfDay === 'afternoon' && current.halfDay === 'morning') {
      halfDaysToSelect.push('morning', 'afternoon');
    } else {
      // Même type de demi-journée : sélectionner uniquement ce type
      halfDaysToSelect.push(start.halfDay);
    }

    // Trouver la ressource et préparer les modifications
    const resource = hoursData.resources.find(r => r.id === start.resourceId);
    if (!resource || resource.type !== 'person') {
      // Réinitialiser en cas d'erreur
      setIsSelecting(false);
      isSelectingRef.current = false;
      setSelectionStart(null);
      selectionStartRef.current = null;
      setSelectionCurrent(null);
      return;
    }

    const existingEntries = resource.timeEntries || [];

    // Déterminer l'action à effectuer en fonction de l'état de la première demi-journée
    const firstDate = datesInRange[0];
    const firstHalfDay = halfDaysToSelect[0];
    const firstEntryExists = existingEntries.some(
      te => te.date === firstDate && te.halfDay === firstHalfDay
    );

    // Si la première demi-journée est sélectionnée, on désélectionne toute la zone
    // Sinon, on sélectionne toute la zone
    const shouldAdd = !firstEntryExists;

    let updatedEntries: TimeEntry[];

    if (shouldAdd) {
      // Ajouter toutes les demi-journées de la zone qui ne sont pas déjà sélectionnées
      const entriesToAdd: TimeEntry[] = [];
      datesInRange.forEach(date => {
        halfDaysToSelect.forEach(halfDay => {
          const exists = existingEntries.some(te => te.date === date && te.halfDay === halfDay);
          if (!exists) {
            entriesToAdd.push({ date, halfDay });
          }
        });
      });
      updatedEntries = [...existingEntries, ...entriesToAdd];
    } else {
      // Retirer toutes les demi-journées de la zone qui sont sélectionnées
      updatedEntries = existingEntries.filter(te => {
        const isInRange = datesInRange.includes(te.date);
        const isHalfDayToRemove = halfDaysToSelect.includes(te.halfDay);
        // Garder l'entrée seulement si elle n'est pas dans la zone sélectionnée
        return !(isInRange && isHalfDayToRemove);
      });
    }

    // Appliquer toutes les modifications en une seule fois
    const updatedResources = hoursData.resources.map(r =>
      r.id === start.resourceId
        ? { ...r, timeEntries: updatedEntries }
        : r
    );

    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        resources: updatedResources
      }
    });

    // Réinitialiser
    setIsSelecting(false);
    isSelectingRef.current = false;
    setSelectionStart(null);
    selectionStartRef.current = null;
    setSelectionCurrent(null);
  };

  // Gérer les événements de souris globaux pour la sélection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;

      // Trouver l'élément sous le curseur
      const target = e.target as HTMLElement;
      const dateCell = target.closest('[data-date]') as HTMLElement;
      if (!dateCell) return;

      const date = dateCell.getAttribute('data-date');
      const halfDay = dateCell.getAttribute('data-halfday') as HalfDay;
      if (date && halfDay) {
        handleSelectionMove(date, halfDay);
      }
    };

    const handleMouseUp = () => {
      if (isSelectingRef.current) {
        handleSelectionEnd();
      }
    };

    if (isSelecting) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, selectionCurrent]);

  // Mettre à jour le TJM d'une personne
  // Mettre à jour le nom d'une ressource
  const updateResourceName = (resourceId: string, newName: string) => {
    if (readOnly) return;

    const updatedData = {
      ...hoursData,
      resources: hoursData.resources.map(resource =>
        resource.id === resourceId
          ? { ...resource, name: newName.trim() || resource.name }
          : resource
      )
    };

    updateDomain(domain.id, { hoursTracking: updatedData });
    setEditingResourceId(null);
    setEditingResourceName('');
  };

  const updateDailyRate = (resourceId: string, dailyRate: number) => {
    if (readOnly) return;

    const updatedResources = hoursData.resources.map(r =>
      r.id === resourceId && r.type === 'person'
        ? { ...r, dailyRate }
        : r
    );

    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        resources: updatedResources
      }
    });
  };

  // Ajouter/modifier un montant pour un fournisseur
  const updateSupplierAmount = (resourceId: string, date: string, amount: number) => {
    if (readOnly) return;

    const resource = hoursData.resources.find(r => r.id === resourceId);
    if (!resource || resource.type !== 'supplier') return;

    const entries = resource.entries || [];
    const existingIndex = entries.findIndex(e => e.date === date);

    let updatedEntries: SupplierEntry[];
    if (amount === 0 && existingIndex >= 0) {
      // Supprimer l'entrée si le montant est 0
      updatedEntries = entries.filter((_, i) => i !== existingIndex);
    } else if (existingIndex >= 0) {
      // Mettre à jour l'entrée existante
      updatedEntries = entries.map((e, i) =>
        i === existingIndex ? { ...e, amount } : e
      );
    } else {
      // Ajouter une nouvelle entrée
      updatedEntries = [...entries, { date, amount }];
    }

    const updatedResources = hoursData.resources.map(r =>
      r.id === resourceId
        ? { ...r, entries: updatedEntries }
        : r
    );

    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        resources: updatedResources
      }
    });
  };

  // Supprimer une ressource
  const handleDeleteResource = (resourceId: string) => {
    if (readOnly) return;

    const updatedResources = hoursData.resources.filter(r => r.id !== resourceId);
    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        resources: updatedResources
      }
    });
  };

  // Mettre à jour la date de début du projet
  const updateProjectStartDate = (date: string) => {
    if (readOnly) return;
    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        projectStartDate: date
      }
    });
  };

  // Mettre à jour la date de fin du projet
  const updateProjectEndDate = (date: string) => {
    if (readOnly) return;
    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        projectEndDate: date
      }
    });
  };

  // Mettre à jour le prix de vente
  const updateSalePrice = (price: number) => {
    if (readOnly) return;
    updateDomain(domain.id, {
      hoursTracking: {
        ...hoursData,
        salePrice: price
      }
    });
  };

  const spentCost = getSpentCost();
  const plannedCost = getPlannedCost();
  const margin = getMargin();

  // Gestion du redimensionnement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(200, Math.min(600, resizeStartWidth.current + diff));
      setColumnWidth(newWidth);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isResizing.current) {
        const diff = e.clientX - resizeStartX.current;
        const finalWidth = Math.max(200, Math.min(600, resizeStartWidth.current + diff));
        setColumnWidth(finalWidth);
        localStorage.setItem(storageKey, finalWidth.toString());
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    // Ajouter les listeners de manière permanente
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [storageKey]);

  // Centrer sur aujourd'hui au chargement
  useEffect(() => {
    // Utiliser la date locale pour éviter les problèmes de fuseau horaire
    const today = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const todayIndex = dates.findIndex(d => d === today);
    if (todayIndex >= 0) {
      // Attendre un peu pour que le DOM soit prêt
      setTimeout(() => {
        if (contentScrollRef.current && headerScrollRef.current) {
          const dayWidth = 48; // w-12 = 48px
          const containerWidth = contentScrollRef.current.clientWidth;
          const scrollPosition = (todayIndex * dayWidth) - (containerWidth / 2) + (dayWidth / 2);
          const finalScroll = Math.max(0, scrollPosition);
          contentScrollRef.current.scrollLeft = finalScroll;
          headerScrollRef.current.scrollLeft = finalScroll;
        }
      }, 100);
    }
  }, [dates]);

  // Gestion du redimensionnement vertical du graphique
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingGraph.current) return;

      const diff = resizeStartY.current - e.clientY; // Inversé car on tire vers le haut
      const newHeight = Math.max(150, Math.min(800, resizeStartHeight.current + diff));
      setGraphHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizingGraph.current) {
        isResizingGraph.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleGraphResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingGraph.current = true;
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = graphHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  // Configuration des capteurs pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler pour le drag & drop des ressources
  const handleResourceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedResources.findIndex(r => r.id === active.id);
    const newIndex = sortedResources.findIndex(r => r.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedResources = arrayMove(sortedResources, oldIndex, newIndex);
      // Mettre à jour l'ordre
      const updatedResources = reorderedResources.map((resource, index) => ({
        ...resource,
        order: index
      }));

      updateDomain(domain.id, {
        hoursTracking: {
          ...hoursData,
          resources: updatedResources
        }
      });
    }
  };

  // Trier les ressources par order
  const sortedResources = useMemo(() => {
    return [...hoursData.resources].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [hoursData.resources]);

  // Fonction pour calculer la date de Pâques (algorithme de Gauss)
  const getEasterDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  // Fonction pour vérifier si une date est un jour férié français
  const isPublicHoliday = (date: Date): boolean => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();

    // Jours fériés fixes
    if (month === 1 && day === 1) return true; // Jour de l'an
    if (month === 5 && day === 1) return true; // Fête du travail
    if (month === 5 && day === 8) return true; // Victoire en Europe
    if (month === 7 && day === 14) return true; // Fête nationale
    if (month === 8 && day === 15) return true; // Assomption
    if (month === 11 && day === 1) return true; // Toussaint
    if (month === 11 && day === 11) return true; // Armistice
    if (month === 12 && day === 25) return true; // Noël

    // Jours fériés variables (basés sur Pâques)
    const easter = getEasterDate(year);
    const easterTime = easter.getTime();
    const dateTime = date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    // Lundi de Pâques (Pâques + 1 jour)
    if (dateTime === easterTime + oneDay) return true;
    // Ascension (Pâques + 39 jours)
    if (dateTime === easterTime + 39 * oneDay) return true;
    // Lundi de Pentecôte (Pâques + 50 jours)
    if (dateTime === easterTime + 50 * oneDay) return true;

    return false;
  };

  // Fonction pour vérifier si une date est un week-end
  const isWeekend = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = dimanche, 6 = samedi
  };

  return (
    <div className="h-full flex flex-col bg-white" style={{ minHeight: 0, height: '100%', overflowX: 'hidden' }}>
      {/* Bandeau en haut avec montant global, prix de vente et marge */}
      <div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between border-b border-[#2C4A6E]">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-xs text-white/70 mb-1">Coûts dépensé</div>
            <div className="text-2xl font-bold">{spentCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
          </div>
          <div>
            <div className="text-xs text-white/70 mb-1">Coûts prévu</div>
            <div className="text-2xl font-bold text-green-300">{plannedCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
          </div>
          <div>
            <div className="text-xs text-white/70 mb-1">Prix de vente</div>
            <div className="text-2xl font-bold">{salePrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
          </div>
          <div>
            <div className="text-xs text-white/70 mb-1">Marge</div>
            <div className={`text-2xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-300'}`}>
              {margin.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-end gap-4">
            {/* Bouton d'ajout - aligné sur le bas */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowAddResource(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/30 rounded text-white text-sm hover:bg-white/20 transition-all font-medium"
              >
                <span>Ajouter Personne ou Fournisseur</span>
              </button>
            </div>
            <div>
              <label className="text-xs text-white/70 mb-1 block">Date de début</label>
              <input
                type="date"
                value={hoursData.projectStartDate}
                onChange={(e) => updateProjectStartDate(e.target.value)}
                className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/70 mb-1 block">Date de fin</label>
              <input
                type="date"
                value={hoursData.projectEndDate || ''}
                onChange={(e) => updateProjectEndDate(e.target.value)}
                className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/70 mb-1 block">Prix de vente (€)</label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => updateSalePrice(parseFloat(e.target.value) || 0)}
                className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm w-32 focus:outline-none focus:border-white/40"
                placeholder="0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Formulaire d'ajout de ressource (affiché dans le bandeau si showAddResource) */}
      {!readOnly && showAddResource && (
        <div className="border-t border-[#2C4A6E] bg-[#1E3A5F] px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
              <MuiIcon
                name={newResourceType === 'person' ? 'Person' : 'Business'}
                size={16}
                className="text-white"
              />
              <span className="text-sm font-medium text-white">
                {newResourceType === 'person' ? 'Nouvelle personne' : 'Nouveau fournisseur'}
              </span>
            </div>
            <button
              onClick={() => {
                setNewResourceType(newResourceType === 'person' ? 'supplier' : 'person');
                setNewResourceDailyRate(0);
              }}
              className="px-3 py-1.5 text-xs text-white/80 hover:text-white border border-white/30 rounded-lg hover:border-white/50 transition-colors"
            >
              Changer de type
            </button>
            <input
              type="text"
              value={newResourceName}
              onChange={(e) => setNewResourceName(e.target.value)}
              placeholder={newResourceType === 'person' ? 'Nom de la personne' : 'Nom du fournisseur'}
              className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddResource();
                }
                if (e.key === 'Escape') {
                  setShowAddResource(false);
                  setNewResourceName('');
                  setNewResourceDailyRate(0);
                }
              }}
              autoFocus
            />
            {newResourceType === 'person' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/70 whitespace-nowrap">TJM (€):</label>
                <input
                  type="number"
                  value={newResourceDailyRate}
                  onChange={(e) => setNewResourceDailyRate(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/40"
                  min="0"
                  step="10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddResource();
                    }
                  }}
                />
              </div>
            )}
            <button
              onClick={() => handleAddResource()}
              className="px-4 py-1.5 bg-white text-[#1E3A5F] rounded-lg hover:bg-white/90 transition-colors font-medium"
            >
              Ajouter
            </button>
            <button
              onClick={() => {
                setShowAddResource(false);
                setNewResourceName('');
                setNewResourceDailyRate(0);
                setNewResourceType('person');
              }}
              className="px-4 py-1.5 text-white/80 hover:text-white border border-white/30 rounded-lg hover:border-white/50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Zone de contenu avec colonne fixe et scroll horizontal */}
      <div className="flex-1 flex" style={{ minHeight: 0, overflow: 'hidden', overflowX: 'hidden' }}>
        {/* Colonne fixe à gauche */}
        <div className="flex-shrink-0 flex flex-col">
          {/* En-tête fixe avec "Total par jour" */}
          <div className="sticky top-0 bg-[#F5F7FA] border-b border-[#E2E8F0] z-10">
            <div
              className="bg-[#F5F7FA] border-r border-[#E2E8F0] p-2 relative group flex items-center"
              style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px`, height: '60px' }}
            >
              <div className="text-xs text-[#64748B] font-medium">Total par jour</div>
              {/* Poignée de redimensionnement sur l'en-tête aussi */}
              {!readOnly && (
                <div
                  onMouseDown={handleResizeStart}
                  className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-[#1E3A5F] opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  style={{ marginRight: '-4px' }}
                  title="Redimensionner la colonne (glisser vers la droite ou la gauche)"
                />
              )}
            </div>
          </div>

          {/* Lignes de ressources - colonne fixe */}
          <div className="bg-white flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleResourceDragEnd}
            >
              <SortableContext
                items={sortedResources.map(r => r.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedResources.map((resource) => (
                  <SortableResourceItem
                    key={resource.id}
                    resource={resource}
                    columnWidth={columnWidth}
                    editingResourceId={editingResourceId}
                    editingResourceName={editingResourceName}
                    setEditingResourceId={setEditingResourceId}
                    setEditingResourceName={setEditingResourceName}
                    updateResourceName={updateResourceName}
                    updateDailyRate={updateDailyRate}
                    getPersonDays={getPersonDays}
                    getPersonTotal={getPersonTotal}
                    getSupplierTotal={getSupplierTotal}
                    handleDeleteResource={handleDeleteResource}
                    readOnly={readOnly}
                    columnRef={columnRef}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Zone scrollable pour les dates */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0, overflow: 'hidden' }}>
          {/* En-tête avec dates - scrollable */}
          <div
            ref={headerScrollRef}
            className="sticky top-0 bg-[#F5F7FA] border-b border-[#E2E8F0] z-10 overflow-x-auto overflow-y-hidden"
            onScroll={(e) => {
              if (contentScrollRef.current) {
                contentScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            onDoubleClick={() => {
              // Centrer le scroll sur le jour en cours
              const today = (() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                return d.toISOString().split('T')[0];
              })();
              const todayIndex = dates.findIndex(d => d === today);
              if (todayIndex >= 0 && headerScrollRef.current) {
                const scrollContainer = headerScrollRef.current;
                const dayWidth = 48; // w-12 = 48px (réduit pour 99999€)
                const containerWidth = scrollContainer.clientWidth;
                const scrollPosition = (todayIndex * dayWidth) - (containerWidth / 2) + (dayWidth / 2);
                scrollContainer.scrollLeft = Math.max(0, scrollPosition);
                // Synchroniser aussi le contenu
                if (contentScrollRef.current) {
                  contentScrollRef.current.scrollLeft = scrollPosition;
                }
              }
            }}
            style={{ height: '60px' }}
          >
            <div className="flex items-center" style={{ minWidth: 'max-content', height: '60px' }}>
              {dates.map((date) => {
                const dayCost = getDayCost(date);
                const dateObj = new Date(date);
                const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
                const dayNumber = dateObj.getDate();
                const month = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
                // Utiliser la date locale pour éviter les problèmes de fuseau horaire
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const isToday = date === todayStr;
                const isWeekendDay = isWeekend(dateObj);
                const isHoliday = isPublicHoliday(dateObj);
                const isWeekendOrHoliday = isWeekendDay || isHoliday;

                return (
                  <div
                    key={date}
                    className={`w-12 border-r border-[#E2E8F0] p-1 text-center flex-shrink-0 flex flex-col justify-center ${isToday ? 'bg-purple-200/80' : ''} ${isWeekendOrHoliday ? 'bg-gray-200/80' : ''}`}
                    style={{ height: '60px' }}
                  >
                    <div className={`text-[10px] leading-tight ${isWeekendOrHoliday ? 'text-[#64748B]/80' : 'text-[#64748B]'}`}>{dayName}</div>
                    <div className={`text-xs font-semibold leading-tight ${isWeekendOrHoliday ? 'text-[#1E3A5F]/80' : 'text-[#1E3A5F]'}`}>{dayNumber}/{month.substring(0, 3)}</div>
                    <div className={`text-[10px] font-medium mt-0.5 leading-tight ${isWeekendOrHoliday ? 'text-[#1E3A5F]/80' : 'text-[#1E3A5F]'}`}>
                      {dayCost > 0 ? dayCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '') : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lignes de ressources - dates scrollables */}
          <div
            ref={contentScrollRef}
            className="flex-1 overflow-y-hidden [&::-webkit-scrollbar]:hidden"
            style={{
              overflowX: 'auto',
              scrollbarWidth: 'none' as const,
              msOverflowStyle: 'none' as const
            }}
            onScroll={(e) => {
              if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            onDoubleClick={() => {
              // Centrer le scroll sur le jour en cours
              const today = (() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                return d.toISOString().split('T')[0];
              })();
              const todayIndex = dates.findIndex(d => d === today);
              if (todayIndex >= 0 && contentScrollRef.current) {
                const scrollContainer = contentScrollRef.current;
                const dayWidth = 48; // w-12 = 48px (réduit pour 99999€)
                const containerWidth = scrollContainer.clientWidth;
                const scrollPosition = (todayIndex * dayWidth) - (containerWidth / 2) + (dayWidth / 2);
                scrollContainer.scrollLeft = Math.max(0, scrollPosition);
                // Synchroniser aussi l'en-tête
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollLeft = scrollPosition;
                }
              }
            }}
          >
            <div className="bg-white">
              {sortedResources.map((resource) => (
                <div key={resource.id} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB] flex" style={{ height: '40px' }}>
                  {/* Cases pour chaque date */}
                  <div className="flex items-center flex-shrink-0" style={{ minWidth: 'max-content', height: '40px' }}>
                    {dates.map((date) => {
                      const dateObj = new Date(date);
                      const todayStr = getLocalDateISO();
                      const isToday = date === todayStr;
                      // Pour isFuture, comparer avec la date locale à minuit
                      const todayDate = new Date();
                      todayDate.setHours(0, 0, 0, 0);
                      const isFuture = dateObj > todayDate;

                      if (resource.type === 'person') {
                        const hasMorning = resource.timeEntries?.some(te => te.date === date && te.halfDay === 'morning');
                        const hasAfternoon = resource.timeEntries?.some(te => te.date === date && te.halfDay === 'afternoon');

                        // Vérifier si cette demi-journée est dans la sélection en cours
                        const checkIsInSelection = (halfDay: HalfDay) => {
                          if (!isSelecting || !selectionStart || !selectionCurrent) return false;
                          if (selectionStart.resourceId !== resource.id) return false;

                          const startDate = new Date(selectionStart.date);
                          const endDate = new Date(selectionCurrent.date);
                          const currentDate = new Date(date);
                          const sortedDates = [startDate, endDate].sort((a, b) => a.getTime() - b.getTime());
                          const inDateRange = currentDate >= sortedDates[0] && currentDate <= sortedDates[1];

                          if (!inDateRange) return false;

                          // Vérifier le type de demi-journée
                          if (selectionStart.halfDay === 'morning' && selectionCurrent.halfDay === 'afternoon') {
                            return true; // Toutes les demi-journées
                          }
                          if (selectionStart.halfDay === 'afternoon' && selectionCurrent.halfDay === 'morning') {
                            return true; // Toutes les demi-journées
                          }

                          // Même type : vérifier si c'est le bon type
                          if (selectionStart.halfDay === 'morning' && selectionCurrent.halfDay === 'morning') {
                            return halfDay === 'morning';
                          }
                          if (selectionStart.halfDay === 'afternoon' && selectionCurrent.halfDay === 'afternoon') {
                            return halfDay === 'afternoon';
                          }

                          return false;
                        };

                        const isMorningInSelection = checkIsInSelection('morning');
                        const isAfternoonInSelection = checkIsInSelection('afternoon');

                        return (
                          <div
                            key={date}
                            className={`w-12 border-r border-[#E2E8F0] p-0.5 flex gap-0.5 items-center flex-shrink-0 ${isToday ? 'bg-purple-200/80' : ''}`}
                          >
                            <button
                              data-date={date}
                              data-halfday="morning"
                              onMouseDown={(e) => {
                                if (!readOnly && e.button === 0) { // Clic gauche uniquement
                                  e.preventDefault(); // Empêcher le focus et le comportement par défaut
                                  handleSelectionStart(resource.id, date, 'morning');
                                }
                              }}
                              onClick={(e) => {
                                // Ne toggle que si on n'a pas fait de sélection par zone
                                // handleSelectionEnd sera appelé par le gestionnaire global mouseup
                                // On utilise un petit délai pour laisser handleSelectionEnd s'exécuter d'abord
                                setTimeout(() => {
                                  if (!isSelectingRef.current && !readOnly) {
                                    toggleHalfDay(resource.id, date, 'morning');
                                  }
                                }, 10);
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              disabled={readOnly}
                              className={`flex-1 h-6 rounded text-[10px] font-medium transition-all flex items-center justify-center ${isMorningInSelection
                                ? hasMorning
                                  ? isFuture
                                    ? 'bg-green-500 text-white ring-2 ring-blue-400 ring-offset-1'
                                    : 'bg-blue-400 text-white ring-2 ring-blue-300 ring-offset-1'
                                  : 'bg-blue-300 text-white'
                                : hasMorning
                                  ? isFuture
                                    ? 'bg-green-600 text-white'
                                    : 'bg-[#1E3A5F] text-white'
                                  : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E2E8F0]'
                                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                              title="Matin"
                            >
                              M
                            </button>
                            <button
                              data-date={date}
                              data-halfday="afternoon"
                              onMouseDown={(e) => {
                                if (!readOnly && e.button === 0) { // Clic gauche uniquement
                                  e.preventDefault(); // Empêcher le focus et le comportement par défaut
                                  handleSelectionStart(resource.id, date, 'afternoon');
                                }
                              }}
                              onClick={(e) => {
                                // Ne toggle que si on n'a pas fait de sélection par zone
                                // handleSelectionEnd sera appelé par le gestionnaire global mouseup
                                // On utilise un petit délai pour laisser handleSelectionEnd s'exécuter d'abord
                                setTimeout(() => {
                                  if (!isSelectingRef.current && !readOnly) {
                                    toggleHalfDay(resource.id, date, 'afternoon');
                                  }
                                }, 10);
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              disabled={readOnly}
                              className={`flex-1 h-6 rounded text-[10px] font-medium transition-all flex items-center justify-center ${isAfternoonInSelection
                                ? hasAfternoon
                                  ? isFuture
                                    ? 'bg-green-500 text-white ring-2 ring-blue-400 ring-offset-1'
                                    : 'bg-blue-400 text-white ring-2 ring-blue-300 ring-offset-1'
                                  : 'bg-blue-300 text-white'
                                : hasAfternoon
                                  ? isFuture
                                    ? 'bg-green-600 text-white'
                                    : 'bg-[#1E3A5F] text-white'
                                  : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E2E8F0]'
                                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                              title="Après-midi"
                            >
                              A
                            </button>
                          </div>
                        );
                      } else {
                        // Fournisseur : champ de montant
                        const entry = resource.entries?.find(e => e.date === date);
                        const amount = entry?.amount || 0;
                        const hasValue = amount > 0;
                        const hasValueAndFuture = hasValue && isFuture;

                        // Calculer isToday pour les fournisseurs aussi
                        const todayStrForSupplier = getLocalDateISO();
                        const isTodayForSupplier = date === todayStrForSupplier;

                        return (
                          <div
                            key={date}
                            className={`w-12 border-r border-[#E2E8F0] p-0.5 flex-shrink-0 ${isTodayForSupplier ? 'bg-purple-200/80' : ''} ${hasValueAndFuture ? 'bg-green-200/20' : ''}`}
                          >
                            {readOnly ? (
                              <div className="text-[10px] text-center text-[#1E3A5F] font-medium h-6 flex items-center justify-center">
                                {amount > 0 ? amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '') : '-'}
                              </div>
                            ) : (
                              <input
                                type="number"
                                value={amount || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  updateSupplierAmount(resource.id, date, value);
                                }}
                                className={`w-full h-6 px-0.5 text-[10px] text-center border border-[#E2E8F0] rounded text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] ${hasValueAndFuture ? 'bg-green-200/20' : 'bg-white'}`}
                                placeholder="0"
                                min="0"
                                max="99999"
                                step="10"
                              />
                            )}
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Séparateur redimensionnable */}
      {!readOnly && (
        <div
          onMouseDown={handleGraphResizeStart}
          className="h-2 bg-[#E2E8F0] cursor-row-resize hover:bg-[#1E3A5F] transition-colors relative group"
          style={{ flexShrink: 0 }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-0.5 bg-[#94A3B8] group-hover:bg-[#1E3A5F] transition-colors" />
          </div>
        </div>
      )}

      {/* Graphique en bas */}
      <div className="bg-white p-4" style={{ height: `${graphHeight}px`, minHeight: `${graphHeight}px`, overflowX: 'hidden', flexShrink: 0 }}>
        <div className="h-full relative" style={{ overflowX: 'hidden' }}>
          <svg width="100%" height="100%" viewBox="0 0 1000 240" preserveAspectRatio="none">
            {/* Labels des échelles - seront positionnés dans le graphique */}

            {/* Zone de dessin */}
            {(() => {
              const padding = { top: 30, right: 60, bottom: 30, left: 70 }; // Plus d'espace pour les labels
              const width = 1000;
              const height = 240;
              const chartWidth = width - padding.left - padding.right;
              const chartHeight = height - padding.top - padding.bottom;

              // Calculer les positions X pour chaque date
              const xScale = (index: number) => padding.left + (index / (chartData.length - 1 || 1)) * chartWidth;

              // Échelle pour les jours (gauche)
              const yDaysScale = (days: number) => padding.top + chartHeight - (days / maxDays) * chartHeight;

              // Échelle pour les coûts (droite)
              const yCostScale = (cost: number) => padding.top + chartHeight - (cost / maxCost) * chartHeight;

              // Date du jour en cours (date locale)
              const today = (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              })();
              const todayIndex = chartData.findIndex(d => d.date === today);

              return (
                <g>
                  {/* Grille horizontale pour les jours */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const value = maxDays * ratio;
                    const y = yDaysScale(value);
                    return (
                      <g key={`grid-days-${ratio}`}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={width - padding.right}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeWidth="1"
                          strokeDasharray="2,2"
                        />
                        <text
                          x={padding.left - 15}
                          y={y + 4}
                          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                          fontSize="11"
                          fill="#64748B"
                          textAnchor="end"
                        >
                          {value.toFixed(0)}
                        </text>
                        {/* Label "J" au-dessus de la première valeur */}
                        {ratio === 1 && (
                          <text
                            x={padding.left - 15}
                            y={y - 8}
                            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                            fontSize="13"
                            fontWeight="600"
                            fill="#1E3A5F"
                            textAnchor="end"
                          >
                            J
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Grille horizontale pour les coûts */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const value = maxCost * ratio;
                    const y = yCostScale(value);
                    return (
                      <g key={`grid-cost-${ratio}`}>
                        <text
                          x={width - padding.right + 15}
                          y={y + 4}
                          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                          fontSize="11"
                          fill="#64748B"
                          textAnchor="start"
                        >
                          {value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                        </text>
                        {/* Label "€" au-dessus de la première valeur */}
                        {ratio === 1 && (
                          <text
                            x={width - padding.right + 15}
                            y={y - 8}
                            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                            fontSize="13"
                            fontWeight="600"
                            fill="#1E3A5F"
                            textAnchor="start"
                          >
                            €
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Barre de seuil (prix de vente) */}
                  {salePrice > 0 && (
                    <line
                      x1={padding.left}
                      y1={yCostScale(salePrice)}
                      x2={width - padding.right}
                      y2={yCostScale(salePrice)}
                      stroke="#E57373"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                    />
                  )}

                  {/* Barres cumulées (coûts) */}
                  {chartData.map((data, index) => {
                    const x = xScale(index);
                    const barHeight = (data.cumulativeCost / maxCost) * chartHeight;
                    const y = padding.top + chartHeight - barHeight;
                    const isToday = data.date === today;

                    return (
                      <g key={`bar-${index}`}>
                        <rect
                          x={x - 2}
                          y={y}
                          width="4"
                          height={barHeight}
                          fill={isToday ? "#1E3A5F" : "#94A3B8"}
                          opacity={0.7}
                        />

                        {/* Barre de marge prévisionnelle au jour en cours */}
                        {isToday && salePrice > 0 && data.cumulativeCost < salePrice && (
                          <rect
                            x={x - 2}
                            y={y - ((salePrice - data.cumulativeCost) / maxCost) * chartHeight}
                            width="4"
                            height={((salePrice - data.cumulativeCost) / maxCost) * chartHeight}
                            fill="#9CCC65"
                            opacity={0.8}
                            onMouseEnter={(e) => {
                              const svg = e.currentTarget.ownerSVGElement;
                              if (!svg) return;
                              const svgPoint = svg.createSVGPoint();
                              svgPoint.x = e.clientX;
                              svgPoint.y = e.clientY;
                              const ctm = svg.getScreenCTM();
                              if (ctm) {
                                const point = svgPoint.matrixTransform(ctm.inverse());
                                setTooltipData({
                                  x: point.x,
                                  y: point.y - 10,
                                  value: salePrice - data.cumulativeCost
                                });
                              }
                            }}
                            onMouseLeave={() => setTooltipData(null)}
                            onMouseMove={(e) => {
                              const svg = e.currentTarget.ownerSVGElement;
                              if (!svg) return;
                              const svgPoint = svg.createSVGPoint();
                              svgPoint.x = e.clientX;
                              svgPoint.y = e.clientY;
                              const ctm = svg.getScreenCTM();
                              if (ctm) {
                                const point = svgPoint.matrixTransform(ctm.inverse());
                                setTooltipData(prev => prev ? {
                                  ...prev,
                                  x: point.x,
                                  y: point.y - 10
                                } : null);
                              }
                            }}
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Courbe des jours */}
                  {chartData.length > 1 && (
                    <path
                      d={`M ${chartData.map((data, index) => {
                        const x = xScale(index);
                        const y = yDaysScale(data.days);
                        return `${x},${y}`;
                      }).join(' L ')}`}
                      fill="none"
                      stroke="#42A5F5"
                      strokeWidth="2"
                    />
                  )}

                  {/* Points sur la courbe */}
                  {chartData.map((data, index) => {
                    const x = xScale(index);
                    const y = yDaysScale(data.days);
                    return (
                      <circle
                        key={`point-${index}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#42A5F5"
                      />
                    );
                  })}

                  {/* Courbe des dépenses fournisseurs (échelle de droite) */}
                  {chartData.length > 1 && (
                    <path
                      d={`M ${chartData.map((data, index) => {
                        const x = xScale(index);
                        const y = yCostScale(data.cumulativeSupplierCost);
                        return `${x},${y}`;
                      }).join(' L ')}`}
                      fill="none"
                      stroke="#FFB74D"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                    />
                  )}

                  {/* Points sur la courbe fournisseurs */}
                  {chartData.map((data, index) => {
                    if (data.cumulativeSupplierCost === 0) return null;
                    const x = xScale(index);
                    const y = yCostScale(data.cumulativeSupplierCost);
                    return (
                      <circle
                        key={`supplier-point-${index}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#FFB74D"
                      />
                    );
                  })}

                  {/* Ligne verticale pour aujourd'hui */}
                  {todayIndex >= 0 && (
                    <line
                      x1={xScale(todayIndex)}
                      y1={padding.top}
                      x2={xScale(todayIndex)}
                      y2={padding.top + chartHeight}
                      stroke="#1E3A5F"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity={0.5}
                    />
                  )}

                  {/* Labels des dates (tous les 15 jours environ) */}
                  {chartData.map((data, index) => {
                    const step = Math.max(1, Math.floor(chartData.length / 8)); // ~8 labels
                    if (index % step !== 0 && index !== chartData.length - 1) return null;
                    const x = xScale(index);
                    const dateObj = new Date(data.date);
                    const label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
                    return (
                      <g key={`label-${index}`}>
                        <line
                          x1={x}
                          y1={padding.top + chartHeight}
                          x2={x}
                          y2={padding.top + chartHeight + 5}
                          stroke="#E2E8F0"
                          strokeWidth="1"
                        />
                        <text
                          x={x}
                          y={height - padding.bottom + 15}
                          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                          fontSize="10"
                          fill="#64748B"
                          textAnchor="middle"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Tooltip pour la marge prévisionnelle */}
                  {tooltipData && (
                    <g>
                      <rect
                        x={tooltipData.x - 50}
                        y={tooltipData.y - 30}
                        width="100"
                        height="24"
                        fill="#1E3A5F"
                        rx="4"
                        opacity="0.95"
                      />
                      <text
                        x={tooltipData.x}
                        y={tooltipData.y - 12}
                        fontFamily="system-ui, -apple-system, sans-serif"
                        fontSize="11"
                        fill="white"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {tooltipData.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}
