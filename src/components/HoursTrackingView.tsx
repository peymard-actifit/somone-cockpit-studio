import { useState, useMemo } from 'react';
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
    salePrice: 0,
    resources: []
  };

  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceType, setNewResourceType] = useState<ResourceType>('person');
  const [showAddResource, setShowAddResource] = useState(false);

  // Générer la liste des dates depuis projectStartDate jusqu'à aujourd'hui + 30 jours
  const dates = useMemo(() => {
    const startDate = new Date(hoursData.projectStartDate);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 jours dans le futur
    
    const dateList: string[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      dateList.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dateList;
  }, [hoursData.projectStartDate]);

  // Calculer le nombre de jours imputés pour une personne
  const getPersonDays = (resource: Resource): number => {
    if (resource.type !== 'person' || !resource.timeEntries) return 0;
    const uniqueDates = new Set(resource.timeEntries.map(te => te.date));
    return uniqueDates.size;
  };

  // Calculer le coût total pour une personne
  const getPersonTotal = (resource: Resource): number => {
    if (resource.type !== 'person' || !resource.dailyRate) return 0;
    return getPersonDays(resource) * resource.dailyRate;
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

  // Calculer la marge
  const getMargin = (): number => {
    const globalCost = getGlobalCost();
    const salePrice = hoursData.salePrice || 0;
    return salePrice - globalCost;
  };

  // Ajouter une ressource
  const handleAddResource = () => {
    if (!newResourceName.trim()) return;
    
    const newResource: Resource = {
      id: crypto.randomUUID(),
      type: newResourceType,
      name: newResourceName.trim(),
      order: hoursData.resources.length,
      ...(newResourceType === 'person' 
        ? { dailyRate: 0, timeEntries: [] }
        : { entries: [] }
      )
    };
    
    const updatedData = {
      ...hoursData,
      resources: [...hoursData.resources, newResource]
    };
    
    updateDomain(domain.id, { hoursTracking: updatedData });
    setNewResourceName('');
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
  const salePrice = hoursData.salePrice || 0;
  const margin = getMargin();

  return (
    <div className="h-full flex flex-col bg-white" style={{ minHeight: 0, height: '100%' }}>
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
          <div className="flex items-center gap-4">
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

      {/* Zone de contenu avec scroll horizontal */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        <div className="inline-block min-w-full">
          {/* En-tête avec dates */}
          <div className="sticky top-0 bg-[#F5F7FA] border-b border-[#E2E8F0] z-10">
            <div className="flex">
              {/* Colonne gauche fixe pour les totaux par jour */}
              <div className="w-64 bg-[#F5F7FA] border-r border-[#E2E8F0] p-3">
                <div className="text-xs text-[#64748B] font-medium mb-2">Total par jour</div>
              </div>
              
              {/* Dates déroulantes */}
              <div className="flex">
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
                      className={`w-24 border-r border-[#E2E8F0] p-2 text-center ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className="text-xs text-[#64748B]">{dayName}</div>
                      <div className="text-sm font-semibold text-[#1E3A5F]">{dayNumber} {month}</div>
                      <div className="text-xs font-medium text-[#1E3A5F] mt-1">
                        {dayCost > 0 ? dayCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lignes de ressources */}
          <div className="bg-white">
            {hoursData.resources.map((resource) => (
              <div key={resource.id} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB]">
                <div className="flex">
                  {/* Colonne gauche avec nom, type, TJM et total */}
                  <div className="w-64 bg-white border-r border-[#E2E8F0] p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MuiIcon 
                          name={resource.type === 'person' ? 'User' : 'Building'} 
                          size={16} 
                          className="text-[#64748B]"
                        />
                        <span className="font-medium text-[#1E3A5F]">{resource.name}</span>
                      </div>
                      {!readOnly && (
                        <button
                          onClick={() => handleDeleteResource(resource.id)}
                          className="text-[#E57373] hover:text-red-600 p-1"
                          title="Supprimer"
                        >
                          <MuiIcon name="Delete" size={14} />
                        </button>
                      )}
                    </div>
                    
                    {resource.type === 'person' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[#64748B]">TJM (€):</label>
                          {readOnly ? (
                            <span className="text-sm font-medium text-[#1E3A5F]">
                              {resource.dailyRate?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) || '0 €'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              value={resource.dailyRate || 0}
                              onChange={(e) => updateDailyRate(resource.id, parseFloat(e.target.value) || 0)}
                              className="flex-1 px-2 py-1 bg-[#F5F7FA] border border-[#E2E8F0] rounded text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                              min="0"
                              step="10"
                            />
                          )}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {getPersonDays(resource)} jour{getPersonDays(resource) > 1 ? 's' : ''} • {getPersonTotal(resource).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-[#64748B]">
                        Total: {getSupplierTotal(resource).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </div>
                    )}
                  </div>
                  
                  {/* Cases pour chaque date */}
                  <div className="flex">
                    {dates.map((date) => {
                      if (resource.type === 'person') {
                        const hasMorning = resource.timeEntries?.some(te => te.date === date && te.halfDay === 'morning');
                        const hasAfternoon = resource.timeEntries?.some(te => te.date === date && te.halfDay === 'afternoon');
                        const isToday = date === new Date().toISOString().split('T')[0];
                        
                        return (
                          <div
                            key={date}
                            className={`w-24 border-r border-[#E2E8F0] p-1 flex gap-1 ${isToday ? 'bg-blue-50' : ''}`}
                          >
                            <button
                              onClick={() => !readOnly && toggleHalfDay(resource.id, date, 'morning')}
                              disabled={readOnly}
                              className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                                hasMorning
                                  ? 'bg-[#1E3A5F] text-white'
                                  : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E2E8F0]'
                              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                              title="Matin"
                            >
                              M
                            </button>
                            <button
                              onClick={() => !readOnly && toggleHalfDay(resource.id, date, 'afternoon')}
                              disabled={readOnly}
                              className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                                hasAfternoon
                                  ? 'bg-[#1E3A5F] text-white'
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
                        const isToday = date === new Date().toISOString().split('T')[0];
                        
                        return (
                          <div
                            key={date}
                            className={`w-24 border-r border-[#E2E8F0] p-1 ${isToday ? 'bg-blue-50' : ''}`}
                          >
                            {readOnly ? (
                              <div className="text-xs text-center text-[#1E3A5F] font-medium h-8 flex items-center justify-center">
                                {amount > 0 ? amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '-'}
                              </div>
                            ) : (
                              <input
                                type="number"
                                value={amount || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  updateSupplierAmount(resource.id, date, value);
                                }}
                                className="w-full h-8 px-1 text-xs text-center bg-white border border-[#E2E8F0] rounded text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                                placeholder="0"
                                min="0"
                                step="10"
                              />
                            )}
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bouton pour ajouter une ressource */}
          {!readOnly && (
            <div className="border-b border-[#E2E8F0] p-3">
              {!showAddResource ? (
                <button
                  onClick={() => setShowAddResource(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#EEF2F7] hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors"
                >
                  <MuiIcon name="Plus" size={16} />
                  <span>Ajouter une personne ou un fournisseur</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <select
                    value={newResourceType}
                    onChange={(e) => setNewResourceType(e.target.value as ResourceType)}
                    className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                  >
                    <option value="person">Personne</option>
                    <option value="supplier">Fournisseur</option>
                  </select>
                  <input
                    type="text"
                    value={newResourceName}
                    onChange={(e) => setNewResourceName(e.target.value)}
                    placeholder="Nom"
                    className="flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddResource();
                      }
                      if (e.key === 'Escape') {
                        setShowAddResource(false);
                        setNewResourceName('');
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleAddResource}
                    className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => {
                      setShowAddResource(false);
                      setNewResourceName('');
                    }}
                    className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
