import { useState, useMemo, useRef, useEffect } from 'react';
import type { Domain, Resource, ResourceType, TimeEntry, HalfDay, SupplierEntry } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';

interface HoursTrackingViewProps {
  domain: Domain;
  readOnly?: boolean;
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

  // Calculer le nombre de jours imputés pour une personne (passés et futurs séparément)
  const getPersonDays = (resource: Resource): { past: number; future: number } => {
    if (resource.type !== 'person' || !resource.timeEntries) return { past: 0, future: 0 };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    let pastDays = 0;
    let futureDays = 0;
    const uniqueDates = new Set<string>();
    
    resource.timeEntries.forEach(te => {
      if (!uniqueDates.has(te.date)) {
        uniqueDates.add(te.date);
        const entryDate = new Date(te.date);
        entryDate.setHours(0, 0, 0, 0);
        
        if (te.date < todayStr) {
          pastDays++;
        } else if (te.date > todayStr) {
          futureDays++;
        } else {
          // Aujourd'hui compte comme passé
          pastDays++;
        }
      }
    });
    
    return { past: pastDays, future: futureDays };
  };

  // Calculer le coût total pour une personne
  const getPersonTotal = (resource: Resource): number => {
    if (resource.type !== 'person' || !resource.dailyRate || !resource.timeEntries) return 0;
    // Compter les demi-journées et multiplier par 0.5 * TJM
    return resource.timeEntries.length * resource.dailyRate * 0.5;
  };

  // Calculer le coût total pour un fournisseur
  const getSupplierTotal = (resource: Resource): number => {
    if (resource.type !== 'supplier' || !resource.entries) return 0;
    return resource.entries.reduce((sum, entry) => sum + entry.amount, 0);
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
        total += getPersonTotal(resource);
      } else if (resource.type === 'supplier') {
        total += getSupplierTotal(resource);
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
      order: hoursData.resources.length,
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
  const toggleHalfDay = (resourceId: string, date: string, halfDay: HalfDay) => {
    if (readOnly) return;

    const resource = hoursData.resources.find(r => r.id === resourceId);
    if (!resource || resource.type !== 'person') return;

    const timeEntries = resource.timeEntries || [];
    const existingIndex = timeEntries.findIndex(
      te => te.date === date && te.halfDay === halfDay
    );

    let updatedEntries: TimeEntry[];
    if (existingIndex >= 0) {
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

  const globalCost = getGlobalCost();
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

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="h-full flex flex-col bg-white" style={{ minHeight: 0, height: '100%', overflowX: 'hidden' }}>
      {/* Bandeau en haut avec montant global, prix de vente et marge */}
      <div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between border-b border-[#2C4A6E]">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-xs text-white/70 mb-1">Coût global</div>
            <div className="text-2xl font-bold">{globalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
          </div>
          <div>
            <div className="text-xs text-white/70 mb-1">Prix de vente</div>
            <div className="text-2xl font-bold">{salePrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
          </div>
          <div>
            <div className="text-xs text-white/70 mb-1">Marge</div>
            <div className={`text-2xl font-bold ${margin >= 0 ? 'text-green-300' : 'text-red-300'}`}>
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
            {hoursData.resources.map((resource) => (
              <div key={resource.id} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB]">
                <div
                  ref={columnRef}
                  className="bg-white border-r border-[#E2E8F0] p-2 relative group flex items-center"
                  style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px`, height: '40px' }}
                >
                  <div className="flex items-center w-full h-full relative">
                    {/* Nom à gauche */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: '30%' }}>
                      <MuiIcon
                        name={resource.type === 'person' ? 'Person' : 'Business'}
                        size={16}
                        className="text-[#1E3A5F] flex-shrink-0"
                      />
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
                                return '0j';
                              }
                              return (
                                <>
                                  {days.past > 0 && <span>{days.past}j</span>}
                                  {days.past > 0 && days.future > 0 && <span>/</span>}
                                  {days.future > 0 && <span className="text-green-600">{days.future}j</span>}
                                </>
                              );
                            })()}
                          </span>
                          <span className="text-xs font-semibold text-[#1E3A5F]">
                            {getPersonTotal(resource).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-[#64748B]">Total:</span>
                          <span className="text-xs font-semibold text-[#1E3A5F]">
                            {getSupplierTotal(resource).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/\s/g, '')}
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

                  {/* Poignée de redimensionnement */}
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
            ))}
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
              const today = new Date().toISOString().split('T')[0];
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
                const isToday = date === new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={date}
                    className={`w-12 border-r border-[#E2E8F0] p-1 text-center flex-shrink-0 flex flex-col justify-center ${isToday ? 'bg-blue-50' : ''}`}
                    style={{ height: '60px' }}
                  >
                    <div className="text-[10px] text-[#64748B] leading-tight">{dayName}</div>
                    <div className="text-xs font-semibold text-[#1E3A5F] leading-tight">{dayNumber}/{month.substring(0, 3)}</div>
                    <div className="text-[10px] font-medium text-[#1E3A5F] mt-0.5 leading-tight">
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
              const today = new Date().toISOString().split('T')[0];
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
              {hoursData.resources.map((resource) => (
                <div key={resource.id} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB] flex items-center" style={{ height: '40px' }}>
                  {/* Cases pour chaque date */}
                  <div className="flex items-center" style={{ minWidth: 'max-content', height: '40px' }}>
                    {dates.map((date) => {
                      const dateObj = new Date(date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isToday = date === today.toISOString().split('T')[0];
                      const isFuture = dateObj > today;

                      if (resource.type === 'person') {
                        const hasMorning = resource.timeEntries?.some(te => te.date === date && te.halfDay === 'morning');
                        const hasAfternoon = resource.timeEntries?.some(te => te.date === date && te.halfDay === 'afternoon');

                        return (
                          <div
                            key={date}
                            className={`w-12 border-r border-[#E2E8F0] p-0.5 flex gap-0.5 items-center flex-shrink-0 ${isToday ? 'bg-blue-50' : ''}`}
                          >
                            <button
                              onClick={() => !readOnly && toggleHalfDay(resource.id, date, 'morning')}
                              disabled={readOnly}
                              className={`flex-1 h-6 rounded text-[10px] font-medium transition-all flex items-center justify-center ${hasMorning
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
                              onClick={() => !readOnly && toggleHalfDay(resource.id, date, 'afternoon')}
                              disabled={readOnly}
                              className={`flex-1 h-6 rounded text-[10px] font-medium transition-all flex items-center justify-center ${hasAfternoon
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

                        return (
                          <div
                            key={date}
                            className={`w-12 border-r border-[#E2E8F0] p-0.5 flex-shrink-0 ${isToday ? 'bg-blue-50' : ''} ${hasValueAndFuture ? 'bg-green-200/20' : ''}`}
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


      {/* Graphique en bas */}
      <div className="border-t border-[#E2E8F0] bg-white p-4" style={{ height: '300px', minHeight: '300px', overflowX: 'hidden' }}>
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

              // Date du jour en cours
              const today = new Date().toISOString().split('T')[0];
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
