import { create } from 'zustand';
import type { Cockpit, Domain, Category, Element, SubCategory, SubElement, Template, Zone, TileStatus, MapElement, MapBounds, GpsCoords, TemplateType, Incident } from '../types';
import { useAuthStore } from './authStore';

// Interface pour tracker les modifications récentes
export interface RecentChange {
  id: string;
  type: 'domain' | 'category' | 'element' | 'subCategory' | 'subElement' | 'mapElement' | 'cockpit';
  action: 'add' | 'update' | 'delete' | 'move' | 'reorder';
  name: string;
  timestamp: number;
}

interface CockpitState {
  cockpits: Cockpit[];
  currentCockpit: Cockpit | null;
  currentDomainId: string | null;
  currentElementId: string | null;
  templates: Template[];
  zones: Zone[];
  isLoading: boolean;
  error: string | null;
  autoSaveTimeout: NodeJS.Timeout | null;

  // Chargement
  fetchCockpits: () => Promise<void>;
  fetchCockpit: (id: string) => Promise<void>;
  fetchTemplates: () => Promise<void>;

  // CRUD Cockpits
  createCockpit: (name: string) => Promise<Cockpit | null>;
  duplicateCockpit: (id: string, newName: string) => Promise<Cockpit | null>;
  deleteCockpit: (id: string) => Promise<boolean>;
  reorderCockpits: (cockpitIds: string[]) => Promise<void>;

  // Navigation
  setCurrentDomain: (domainId: string | null) => void;
  setCurrentElement: (elementId: string | null) => void;

  // Modifications avec auto-save
  updateCockpit: (updates: Partial<Cockpit>) => void;
  addDomain: (name: string, templateType?: TemplateType) => void;
  updateDomain: (domainId: string, updates: Partial<Domain>) => void;
  deleteDomain: (domainId: string) => void;
  duplicateDomain: (domainId: string) => void;
  reorderDomains: (domainIds: string[]) => void;

  addCategory: (domainId: string, name: string, orientation: 'horizontal' | 'vertical') => void;
  updateCategory: (categoryId: string, updates: Partial<Category>) => void;
  deleteCategory: (categoryId: string) => void;
  reorderCategory: (domainId: string, categoryIds: string[]) => void;

  addElement: (categoryId: string, name: string) => void;
  updateElement: (elementId: string, updates: Partial<Element>, _propagating?: boolean) => void;
  deleteElement: (elementId: string) => void;
  moveElement: (elementId: string, fromCategoryId: string, toCategoryId: string) => void;
  reorderElement: (elementId: string, categoryId: string, newIndex: number) => void;

  addSubCategory: (elementId: string, name: string, orientation: 'horizontal' | 'vertical', _propagating?: boolean) => void;
  updateSubCategory: (subCategoryId: string, updates: Partial<SubCategory>, _propagating?: boolean) => void;
  deleteSubCategory: (subCategoryId: string) => void;
  reorderSubCategory: (elementId: string, subCategoryIds: string[]) => void;

  addSubElement: (subCategoryId: string, name: string, _propagating?: boolean) => void;
  updateSubElement: (subElementId: string, updates: Partial<SubElement>, _propagating?: boolean) => void;
  deleteSubElement: (subElementId: string) => void;
  moveSubElement: (subElementId: string, fromSubCategoryId: string, toSubCategoryId: string) => void;
  reorderSubElement: (subElementId: string, subCategoryId: string, newIndex: number) => void;

  // Zones
  addZone: (name: string) => void;
  deleteZone: (zoneId: string) => void;

  // Map Elements (points sur la carte)
  addMapElement: (domainId: string, name: string, gps: GpsCoords, status?: TileStatus, icon?: string) => void;
  updateMapElement: (mapElementId: string, updates: Partial<MapElement>) => void;
  deleteMapElement: (mapElementId: string) => void;
  cloneMapElement: (mapElementId: string) => void;
  updateMapBounds: (domainId: string, bounds: MapBounds) => void;

  // Clone Element (pour BackgroundView)
  cloneElement: (elementId: string) => void;

  // Duplication liée d'éléments et sous-éléments
  duplicateElementLinked: (elementId: string) => void;
  duplicateSubElementLinked: (subElementId: string) => void;

  // Export
  exportToExcel: () => Promise<Blob | null>;
  exportCockpit: (id: string, fileName?: string, directoryHandle?: FileSystemDirectoryHandle | null) => Promise<void>;
  importCockpit: (file: File) => Promise<Cockpit | null>;

  // Publication
  publishCockpit: (id: string) => Promise<{ publicId: string } | null>;
  unpublishCockpit: (id: string) => Promise<boolean>;

  // Utilitaires
  triggerAutoSave: () => void;
  forceSave: () => Promise<boolean>;
  clearError: () => void;

  // Tracking des modifications
  recentChanges: RecentChange[];
  addRecentChange: (change: Omit<RecentChange, 'id' | 'timestamp'>) => void;
  clearRecentChanges: () => void;

  // Liaison entre éléments/sous-éléments du même nom
  findElementsByName: (name: string) => Array<{ element: Element; domainName: string; categoryName: string }>;
  findSubElementsByName: (name: string) => Array<{ subElement: SubElement; domainName: string; categoryName: string; elementName: string; subCategoryName: string }>;
  getAllElements: () => Array<{ element: Element; domainId: string; domainName: string; categoryId: string; categoryName: string }>;
  getAllSubElements: () => Array<{ subElement: SubElement; domainId: string; domainName: string; categoryId: string; categoryName: string; elementId: string; elementName: string; subCategoryId: string; subCategoryName: string }>;
  getLinkedElements: (elementId: string) => Array<{ element: Element; domainId: string; domainName: string; categoryId: string; categoryName: string }>;
  getLinkedSubElements: (subElementId: string) => Array<{ subElement: SubElement; domainId: string; domainName: string; categoryId: string; categoryName: string; elementId: string; elementName: string; subCategoryId: string; subCategoryName: string }>;
  linkElement: (elementId: string, linkedGroupId: string, linkSubElements?: boolean) => void;
  linkSubElement: (subElementId: string, linkedGroupId: string) => void;
  unlinkElement: (elementId: string) => void;
  unlinkSubElement: (subElementId: string) => void;
  copyElementContent: (targetElementId: string, sourceElementId: string, linkSubElements?: boolean) => void;
  copySubElementContent: (targetSubElementId: string, sourceSubElementId: string) => void;
  moveElementToCategory: (elementId: string, targetCategoryId: string) => void;
  moveSubElementToSubCategory: (subElementId: string, targetSubCategoryId: string) => void;

  // Incidents (Vue Alertes)
  addIncident: (domainId: string, incident: Omit<Incident, 'id' | 'domainId' | 'createdAt' | 'updatedAt'>) => void;
  updateIncident: (domainId: string, incidentId: string, updates: Partial<Incident>) => void;
  deleteIncident: (domainId: string, incidentId: string) => void;
}

const API_URL = '/api';

const generateId = () => crypto.randomUUID();

// Ordre de criticité des statuts (du moins critique au plus critique)
const STATUS_PRIORITY: Record<TileStatus, number> = {
  'ok': 0,
  'information': 1,
  'herite': 2,
  'deconnecte': 3,
  'mineur': 4,
  'critique': 5,
  'fatal': 6,
};

// Fonction pour obtenir le statut le plus critique entre deux statuts
const getMostCriticalStatus = (status1: TileStatus, status2: TileStatus): TileStatus => {
  const priority1 = STATUS_PRIORITY[status1] ?? 0;
  const priority2 = STATUS_PRIORITY[status2] ?? 0;
  return priority1 >= priority2 ? status1 : status2;
};

export const useCockpitStore = create<CockpitState>((set, get) => ({
  cockpits: [],
  currentCockpit: null,
  currentDomainId: null,
  currentElementId: null,
  templates: [],
  zones: [],
  isLoading: false,
  error: null,
  autoSaveTimeout: null,
  recentChanges: [],

  fetchCockpits: async () => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/cockpits`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const cockpits = await response.json();
      // S'assurer que sharedWith existe pour chaque cockpit
      const cockpitsWithShared = cockpits.map((c: any) => ({
        ...c,
        sharedWith: c.sharedWith || []
      }));
      set({ cockpits: cockpitsWithShared, isLoading: false });
    } catch (error) {
      set({ error: 'Erreur lors du chargement des maquettes', isLoading: false });
    }
  },

  fetchCockpit: async (id: string) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/cockpits/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const cockpit = await response.json();
      set({
        currentCockpit: {
          ...cockpit,
          sharedWith: cockpit.sharedWith || [], // S'assurer que sharedWith existe
        },
        currentDomainId: cockpit.domains?.[0]?.id || null,
        currentElementId: null,
        zones: cockpit.zones || [],
        isLoading: false
      });
    } catch (error) {
      set({ error: 'Erreur lors du chargement de la maquette', isLoading: false });
    }
  },

  fetchTemplates: async () => {
    const token = useAuthStore.getState().token;

    try {
      const response = await fetch(`${API_URL}/templates`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const templates = await response.json();
      set({ templates });
    } catch (error) {
      console.error('Erreur chargement templates:', error);
    }
  },

  createCockpit: async (name: string) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/cockpits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) throw new Error('Erreur lors de la création');

      const cockpit = await response.json();
      set((state) => ({
        cockpits: [...state.cockpits, cockpit],
        isLoading: false
      }));
      return cockpit;
    } catch (error) {
      set({ error: 'Erreur lors de la création de la maquette', isLoading: false });
      return null;
    }
  },

  duplicateCockpit: async (id: string, newName: string) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/cockpits/${id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) throw new Error('Erreur lors de la duplication');

      const cockpit = await response.json();
      set((state) => ({
        cockpits: [...state.cockpits, cockpit],
        isLoading: false
      }));
      return cockpit;
    } catch (error) {
      set({ error: 'Erreur lors de la duplication de la maquette', isLoading: false });
      return null;
    }
  },

  deleteCockpit: async (id: string) => {
    const token = useAuthStore.getState().token;

    try {
      const response = await fetch(`${API_URL}/cockpits/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression');

      set((state) => ({
        cockpits: state.cockpits.filter(c => c.id !== id),
        currentCockpit: state.currentCockpit?.id === id ? null : state.currentCockpit,
      }));
      return true;
    } catch (error) {
      set({ error: 'Erreur lors de la suppression' });
      return false;
    }
  },

  setCurrentDomain: (domainId: string | null) => {
    set({ currentDomainId: domainId, currentElementId: null });
  },

  setCurrentElement: (elementId: string | null) => {
    set({ currentElementId: elementId });
  },

  triggerAutoSave: () => {
    const { autoSaveTimeout, currentCockpit } = get();

    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(async () => {
      if (!currentCockpit) return;

      const token = useAuthStore.getState().token;
      try {
        // IMPORTANT : Sauvegarder TOUTES les données (y compris non publiables)
        // L'auto-save doit préserver toutes les données du studio
        const payload: any = {
          name: currentCockpit.name,
          domains: currentCockpit.domains || [], // TOUS les domaines, y compris non publiables
          logo: currentCockpit.logo,
          scrollingBanner: currentCockpit.scrollingBanner,
          sharedWith: currentCockpit.sharedWith || [],
        };
        // Ajouter zones si disponible (peut ne pas être dans le type Cockpit mais dans les données)
        if ((currentCockpit as any).zones) {
          payload.zones = (currentCockpit as any).zones;
        }

        console.log('[Auto-save] Envoi de TOUTES les données (y compris non publiables):', {
          name: payload.name,
          domainsCount: payload.domains.length,
          zonesCount: payload.zones?.length || 0,
          domainsWithImages: payload.domains.filter((d: any) => d.backgroundImage && d.backgroundImage.length > 0).length,
          nonPublishableDomains: payload.domains.filter((d: any) => d.publiable === false).length
        });

        // Log des images dans les domaines
        payload.domains.forEach((d: any, idx: number) => {
          const hasBg = d.backgroundImage && d.backgroundImage.length > 0;
          const isPublishable = d.publiable !== false;
          console.log(`[Auto-save] Domain[${idx}] "${d.name}": backgroundImage=${hasBg ? `PRESENTE (${d.backgroundImage.length} chars)` : 'ABSENTE'}, publiable=${isPublishable}`);
        });

        await fetch(`${API_URL}/cockpits/${currentCockpit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('Erreur auto-save:', error);
      }
    }, 1000);

    set({ autoSaveTimeout: timeout });
  },

  // Sauvegarde forcée et synchrone - retourne une promesse
  forceSave: async () => {
    const { autoSaveTimeout, currentCockpit } = get();

    // Annuler l'auto-save en attente
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      set({ autoSaveTimeout: null });
    }

    if (!currentCockpit) {
      console.warn('[forceSave] Pas de cockpit courant à sauvegarder');
      return false;
    }

    const token = useAuthStore.getState().token;
    try {
      const payload: any = {
        name: currentCockpit.name,
        domains: currentCockpit.domains || [],
        logo: currentCockpit.logo,
        scrollingBanner: currentCockpit.scrollingBanner,
        sharedWith: currentCockpit.sharedWith || [],
      };
      if ((currentCockpit as any).zones) {
        payload.zones = (currentCockpit as any).zones;
      }

      // Log détaillé pour le debugging
      console.log('[forceSave] 💾 Sauvegarde FORCÉE et SYNCHRONE:', {
        name: payload.name,
        domainsCount: payload.domains.length,
        domainsWithImages: payload.domains.filter((d: any) => d.backgroundImage && d.backgroundImage.length > 0).length,
      });

      // Log des images
      payload.domains.forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && d.backgroundImage.length > 0;
        if (hasBg) {
          const sizeMB = (d.backgroundImage.length / 1024 / 1024).toFixed(2);
          console.log(`[forceSave] Domain[${idx}] "${d.name}": backgroundImage PRÉSENTE (${sizeMB} MB)`);
        }
      });

      const response = await fetch(`${API_URL}/cockpits/${currentCockpit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[forceSave] ❌ Erreur serveur:', response.status, errorData);
        return false;
      }

      console.log('[forceSave] ✅ Sauvegarde réussie');
      return true;
    } catch (error) {
      console.error('[forceSave] ❌ Erreur:', error);
      return false;
    }
  },

  updateCockpit: (updates: Partial<Cockpit>) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      // Effectuer une fusion profonde pour s'assurer que les tableaux comme 'domains' sont complètement remplacés
      // et non fusionnés superficiellement.
      const updatedCockpit = {
        ...state.currentCockpit,
        ...updates,
        domains: updates.domains !== undefined ? updates.domains : state.currentCockpit.domains,
        zones: (updates as any).zones !== undefined ? (updates as any).zones : (state.currentCockpit as any).zones,
        scrollingBanner: updates.scrollingBanner !== undefined ? updates.scrollingBanner : state.currentCockpit.scrollingBanner,
        updatedAt: new Date().toISOString(),
      };

      // Log pour vérifier que les domaines sont bien remplacés
      if (updates.domains && updates.domains.length > 0) {
        const firstDomain = updates.domains[0];
        if (firstDomain.categories && firstDomain.categories.length > 0) {
          const firstCategory = firstDomain.categories[0];
          if (firstCategory.elements && firstCategory.elements.length > 0) {
            console.log('[updateCockpit] Domaines remplacés - Premier élément:', {
              id: firstCategory.elements[0].id,
              name: firstCategory.elements[0].name,
            });
          }
        }
      }

      return {
        currentCockpit: updatedCockpit,
      };
    });
    get().triggerAutoSave();
  },

  addDomain: (name: string, templateType: TemplateType = 'standard') => {
    const newDomain: Domain = {
      id: generateId(),
      cockpitId: get().currentCockpit?.id || '',
      name,
      order: get().currentCockpit?.domains.length || 0,
      templateType,
      categories: [],
      ...(templateType === 'hours-tracking' ? {
        hoursTracking: {
          projectStartDate: new Date().toISOString().split('T')[0],
          projectEndDate: (() => {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 3); // 3 mois par défaut
            return endDate.toISOString().split('T')[0];
          })(),
          salePrice: 0,
          resources: []
        }
      } : {})
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: [...state.currentCockpit.domains, newDomain],
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  updateDomain: (domainId: string, updates: Partial<Domain>) => {
    const domain = get().currentCockpit?.domains.find(d => d.id === domainId);
    const domainName = updates.name || domain?.name || 'Domaine';

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d =>
            d.id === domainId ? { ...d, ...updates } : d
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'domain', action: 'update', name: domainName });
    get().triggerAutoSave();
  },

  deleteDomain: (domainId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      const domains = state.currentCockpit.domains.filter(d => d.id !== domainId);
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains,
          updatedAt: new Date().toISOString(),
        },
        currentDomainId: state.currentDomainId === domainId
          ? (domains[0]?.id || null)
          : state.currentDomainId,
      };
    });
    get().triggerAutoSave();
  },

  duplicateDomain: (domainId: string) => {
    const state = get();
    if (!state.currentCockpit) return;

    const originalDomain = state.currentCockpit.domains.find(d => d.id === domainId);
    if (!originalDomain) return;

    // Fonction pour générer de nouveaux IDs pour tous les enfants
    const duplicateWithNewIds = (domain: Domain): Domain => {
      const newDomainId = generateId();

      // Dupliquer les catégories avec nouveaux IDs
      const newCategories = domain.categories.map(category => {
        const newCategoryId = generateId();

        // Dupliquer les éléments avec nouveaux IDs
        const newElements = category.elements.map(element => {
          const newElementId = generateId();

          // Dupliquer les sous-catégories avec nouveaux IDs
          const newSubCategories = element.subCategories.map(subCategory => {
            const newSubCategoryId = generateId();

            // Dupliquer les sous-éléments avec nouveaux IDs
            const newSubElements = subCategory.subElements.map(subElement => ({
              ...subElement,
              id: generateId(),
              linkedGroupId: undefined, // Supprimer les liaisons
            }));

            return {
              ...subCategory,
              id: newSubCategoryId,
              subElements: newSubElements,
            };
          });

          return {
            ...element,
            id: newElementId,
            subCategories: newSubCategories,
            linkedGroupId: undefined, // Supprimer les liaisons
          };
        });

        return {
          ...category,
          id: newCategoryId,
          elements: newElements,
        };
      });

      // Dupliquer les alertsData avec nouveaux IDs pour les incidents
      let newAlertsData = domain.alertsData;
      if (domain.alertsData?.incidents) {
        newAlertsData = {
          ...domain.alertsData,
          incidents: domain.alertsData.incidents.map(incident => ({
            ...incident,
            id: generateId(),
          })),
        };
      }

      // Dupliquer les mapElements avec nouveaux IDs
      let newMapElements = domain.mapElements;
      if (domain.mapElements) {
        newMapElements = domain.mapElements.map(mapEl => ({
          ...mapEl,
          id: generateId(),
        }));
      }

      return {
        ...domain,
        id: newDomainId,
        name: `${domain.name} (copie)`,
        categories: newCategories,
        alertsData: newAlertsData,
        mapElements: newMapElements,
      };
    };

    const duplicatedDomain = duplicateWithNewIds(originalDomain);

    // Trouver l'index du domaine original
    const originalIndex = state.currentCockpit.domains.findIndex(d => d.id === domainId);

    // Insérer la copie juste après l'original
    const newDomains = [...state.currentCockpit.domains];
    newDomains.splice(originalIndex + 1, 0, duplicatedDomain);

    // Mettre à jour les ordres
    const orderedDomains = newDomains.map((d, index) => ({ ...d, order: index }));

    set({
      currentCockpit: {
        ...state.currentCockpit,
        domains: orderedDomains,
        updatedAt: new Date().toISOString(),
      },
      currentDomainId: duplicatedDomain.id, // Sélectionner le nouveau domaine
    });
    get().triggerAutoSave();
  },

  reorderDomains: (domainIds: string[]) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      // Créer un map pour un accès rapide aux domaines par ID
      const domainMap = new Map(state.currentCockpit.domains.map(d => [d.id, d]));

      // Reconstruire le tableau des domaines dans le nouvel ordre
      const reorderedDomains = domainIds
        .map((domainId, index) => {
          const domain = domainMap.get(domainId);
          if (!domain) return null;
          return { ...domain, order: index };
        })
        .filter((d): d is Domain => d !== null);

      // Ajouter les domaines qui n'étaient pas dans la liste (au cas où)
      const missingDomains = state.currentCockpit.domains.filter(d => !domainIds.includes(d.id));
      reorderedDomains.push(...missingDomains.map((d, index) => ({ ...d, order: reorderedDomains.length + index })));

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: reorderedDomains.sort((a, b) => a.order - b.order),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  addCategory: (domainId: string, name: string, orientation: 'horizontal' | 'vertical') => {
    const newCategory: Category = {
      id: generateId(),
      domainId,
      name,
      orientation,
      order: 0,
      elements: [],
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => {
            if (d.id !== domainId) return d;
            const newOrder = d.categories.length;
            return {
              ...d,
              categories: [...d.categories, { ...newCategory, order: newOrder }],
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  updateCategory: (categoryId: string, updates: Partial<Category>) => {
    // Trouver le nom de la catégorie
    let categoryName = updates.name || 'Catégorie';
    const cockpit = get().currentCockpit;
    if (cockpit) {
      for (const d of cockpit.domains) {
        const cat = d.categories.find(c => c.id === categoryId);
        if (cat) { categoryName = updates.name || cat.name; break; }
      }
    }

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c =>
              c.id === categoryId ? { ...c, ...updates } : c
            ),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'category', action: 'update', name: categoryName });
    get().triggerAutoSave();
  },

  deleteCategory: (categoryId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.filter(c => c.id !== categoryId),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  reorderCategory: (domainId: string, categoryIds: string[]) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      const domain = state.currentCockpit.domains.find(d => d.id === domainId);
      if (!domain) return state;

      // Créer un map pour un accès rapide aux catégories par ID
      const categoryMap = new Map(domain.categories.map(c => [c.id, c]));

      // Reconstruire le tableau des catégories dans le nouvel ordre
      const reorderedCategories = categoryIds
        .map((categoryId, index) => {
          const category = categoryMap.get(categoryId);
          if (!category) return null;
          return { ...category, order: index };
        })
        .filter((c): c is Category => c !== null);

      // Ajouter les catégories qui n'étaient pas dans la liste (au cas où)
      const missingCategories = domain.categories.filter(c => !categoryIds.includes(c.id));
      reorderedCategories.push(...missingCategories.map((c, index) => ({ ...c, order: reorderedCategories.length + index })));

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d =>
            d.id === domainId
              ? {
                ...d,
                categories: reorderedCategories.sort((a, b) => a.order - b.order),
              }
              : d
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  addElement: (categoryId: string, name: string) => {
    const newElement: Element = {
      id: generateId(),
      categoryId,
      name,
      status: 'ok' as TileStatus,
      order: 0,
      subCategories: [],
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => {
              if (c.id !== categoryId) return c;
              const newOrder = c.elements.length;
              return {
                ...c,
                elements: [...c.elements, { ...newElement, order: newOrder }],
              };
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  updateElement: (elementId: string, updates: Partial<Element>, _propagating?: boolean) => {
    // Trouver l'élément et son nom
    let elementName = updates.name || 'Élément';
    let currentElement: Element | null = null;
    const cockpit = get().currentCockpit;
    if (cockpit) {
      outer: for (const d of cockpit.domains) {
        for (const c of d.categories) {
          const el = c.elements.find(e => e.id === elementId);
          if (el) {
            elementName = updates.name || el.name;
            currentElement = el;
            break outer;
          }
        }
      }
    }

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e =>
                e.id === elementId ? { ...e, ...updates } : e
              ),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'element', action: 'update', name: elementName });
    get().triggerAutoSave();

    // Gérer le changement de nom : séparer la liaison si le nom change
    if (!_propagating && currentElement?.linkedGroupId && updates.name !== undefined && updates.name !== currentElement.name) {
      // Le nom change → séparer cet élément du groupe (supprimer le linkedGroupId)
      // ET délier aussi tous les sous-éléments de cet élément
      set((state) => {
        if (!state.currentCockpit) return state;
        return {
          currentCockpit: {
            ...state.currentCockpit,
            domains: state.currentCockpit.domains.map(d => ({
              ...d,
              categories: d.categories.map(c => ({
                ...c,
                elements: c.elements.map(e =>
                  e.id === elementId 
                    ? { 
                        ...e, 
                        linkedGroupId: undefined,
                        // Délier aussi tous les sous-éléments
                        subCategories: e.subCategories.map(sc => ({
                          ...sc,
                          subElements: sc.subElements.map(se => ({
                            ...se,
                            linkedGroupId: undefined
                          }))
                        }))
                      } 
                    : e
                ),
              })),
            })),
            updatedAt: new Date().toISOString(),
          },
        };
      });
      get().triggerAutoSave();
      // Ne pas propager si le nom change
      return;
    }

    // Propager aux éléments liés (sauf si c'est déjà une propagation)
    if (!_propagating && currentElement?.linkedGroupId) {
      const linkedGroupId = updates.linkedGroupId || currentElement.linkedGroupId;
      const updatedCockpit = get().currentCockpit;
      if (updatedCockpit) {
        // Propriétés à synchroniser (exclure name car le changement de nom sépare la liaison)
        const syncUpdates: Partial<Element> = {};
        if (updates.status !== undefined) syncUpdates.status = updates.status;
        if (updates.icon !== undefined) syncUpdates.icon = updates.icon;
        if (updates.icon2 !== undefined) syncUpdates.icon2 = updates.icon2;
        if (updates.icon3 !== undefined) syncUpdates.icon3 = updates.icon3;
        if (updates.value !== undefined) syncUpdates.value = updates.value;
        if (updates.unit !== undefined) syncUpdates.unit = updates.unit;
        if (updates.publiable !== undefined) syncUpdates.publiable = updates.publiable;
        // Note: name n'est PAS propagé - le changement de nom sépare la liaison

        // Si aucune propriété synchronisable n'est mise à jour, pas besoin de propager
        if (Object.keys(syncUpdates).length === 0) return;

        // Trouver et mettre à jour tous les éléments du même groupe
        for (const d of updatedCockpit.domains) {
          for (const c of d.categories) {
            for (const e of c.elements) {
              if (e.id !== elementId && e.linkedGroupId === linkedGroupId) {
                // Appeler updateElement avec _propagating = true pour éviter la boucle infinie
                get().updateElement(e.id, syncUpdates, true);
              }
            }
          }
        }
      }
    }
  },

  deleteElement: (elementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.filter(e => e.id !== elementId),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        currentElementId: state.currentElementId === elementId ? null : state.currentElementId,
      };
    });
    get().triggerAutoSave();
  },

  addSubCategory: (elementId: string, name: string, orientation: 'horizontal' | 'vertical', _propagating?: boolean) => {
    // Trouver l'élément pour vérifier s'il est lié
    const cockpit = get().currentCockpit;
    let sourceElement: Element | null = null;
    if (cockpit) {
      for (const d of cockpit.domains) {
        for (const c of d.categories) {
          const found = c.elements.find(e => e.id === elementId);
          if (found) {
            sourceElement = found;
            break;
          }
        }
        if (sourceElement) break;
      }
    }

    const newSubCategory: SubCategory = {
      id: generateId(),
      elementId,
      name,
      orientation,
      order: 0,
      subElements: [],
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => {
                if (e.id !== elementId) return e;
                const newOrder = e.subCategories.length;
                return {
                  ...e,
                  subCategories: [...e.subCategories, { ...newSubCategory, order: newOrder }],
                };
              }),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();

    // Propager aux éléments liés (sauf si c'est déjà une propagation)
    if (!_propagating && sourceElement?.linkedGroupId) {
      const linkedGroupId = sourceElement.linkedGroupId;
      const updatedCockpit = get().currentCockpit;
      if (updatedCockpit) {
        for (const d of updatedCockpit.domains) {
          for (const c of d.categories) {
            for (const e of c.elements) {
              if (e.id !== elementId && e.linkedGroupId === linkedGroupId) {
                // Vérifier que cette sous-catégorie n'existe pas déjà dans l'élément lié
                const existingSubCat = e.subCategories.find(sc => sc.name === name);
                if (!existingSubCat) {
                  get().addSubCategory(e.id, name, orientation, true);
                }
              }
            }
          }
        }
      }
    }
  },

  updateSubCategory: (subCategoryId: string, updates: Partial<SubCategory>, _propagating?: boolean) => {
    // Trouver la sous-catégorie et son élément parent
    let subCatName = updates.name || 'Sous-catégorie';
    let currentSubCategory: SubCategory | null = null;
    let parentElement: Element | null = null;
    const cockpit = get().currentCockpit;
    if (cockpit) {
      outer: for (const d of cockpit.domains) {
        for (const c of d.categories) {
          for (const e of c.elements) {
            const sc = e.subCategories.find(s => s.id === subCategoryId);
            if (sc) {
              subCatName = updates.name || sc.name;
              currentSubCategory = sc;
              parentElement = e;
              break outer;
            }
          }
        }
      }
    }

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc =>
                  sc.id === subCategoryId ? { ...sc, ...updates } : sc
                ),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'subCategory', action: 'update', name: subCatName });
    get().triggerAutoSave();

    // Propager aux éléments liés (sauf si c'est déjà une propagation)
    if (!_propagating && parentElement?.linkedGroupId && currentSubCategory) {
      const linkedGroupId = parentElement.linkedGroupId;
      const originalSubCatName = currentSubCategory.name;
      const updatedCockpit = get().currentCockpit;
      if (updatedCockpit) {
        // Propriétés à synchroniser (exclure name pour éviter de renommer toutes les sous-catégories)
        const syncUpdates: Partial<SubCategory> = {};
        if (updates.orientation !== undefined) syncUpdates.orientation = updates.orientation;
        if (updates.icon !== undefined) syncUpdates.icon = updates.icon;
        // Note: name n'est PAS propagé automatiquement

        // Si aucune propriété synchronisable n'est mise à jour, pas besoin de propager
        if (Object.keys(syncUpdates).length === 0) return;

        // Trouver et mettre à jour les sous-catégories correspondantes dans les éléments liés
        for (const d of updatedCockpit.domains) {
          for (const c of d.categories) {
            for (const e of c.elements) {
              if (e.id !== parentElement.id && e.linkedGroupId === linkedGroupId) {
                // Trouver la sous-catégorie correspondante par nom
                const correspondingSubCat = e.subCategories.find(sc => sc.name === originalSubCatName);
                if (correspondingSubCat) {
                  get().updateSubCategory(correspondingSubCat.id, syncUpdates, true);
                }
              }
            }
          }
        }
      }
    }
  },

  deleteSubCategory: (subCategoryId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.filter(sc => sc.id !== subCategoryId),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  reorderSubCategory: (elementId: string, subCategoryIds: string[]) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      // Trouver l'élément qui contient les sous-catégories
      let targetElement: Element | null = null;
      let targetDomain: Domain | null = null;

      for (const domain of state.currentCockpit.domains) {
        for (const category of domain.categories) {
          const element = category.elements.find(e => e.id === elementId);
          if (element) {
            targetElement = element;
            targetDomain = domain;
            break;
          }
        }
        if (targetElement) break;
      }

      if (!targetElement || !targetDomain) return state;

      // Créer un map pour un accès rapide aux sous-catégories par ID
      const subCategoryMap = new Map(targetElement.subCategories.map(sc => [sc.id, sc]));

      // Reconstruire le tableau des sous-catégories dans le nouvel ordre
      const reorderedSubCategories = subCategoryIds
        .map((subCategoryId, index) => {
          const subCategory = subCategoryMap.get(subCategoryId);
          if (!subCategory) return null;
          return { ...subCategory, order: index };
        })
        .filter((sc): sc is SubCategory => sc !== null);

      // Ajouter les sous-catégories qui n'étaient pas dans la liste (au cas où)
      const missingSubCategories = targetElement.subCategories.filter(sc => !subCategoryIds.includes(sc.id));
      reorderedSubCategories.push(...missingSubCategories.map((sc, index) => ({ ...sc, order: reorderedSubCategories.length + index })));

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d =>
            d.id === targetDomain!.id
              ? {
                ...d,
                categories: d.categories.map(c => ({
                  ...c,
                  elements: c.elements.map(e =>
                    e.id === elementId
                      ? {
                        ...e,
                        subCategories: reorderedSubCategories.sort((a, b) => a.order - b.order),
                      }
                      : e
                  ),
                })),
              }
              : d
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  addSubElement: (subCategoryId: string, name: string, _propagating?: boolean) => {
    // Trouver la sous-catégorie et son élément parent pour vérifier la liaison
    const cockpit = get().currentCockpit;
    let sourceElement: Element | null = null;
    let sourceSubCategory: SubCategory | null = null;
    if (cockpit) {
      outer: for (const d of cockpit.domains) {
        for (const c of d.categories) {
          for (const e of c.elements) {
            const sc = e.subCategories.find(s => s.id === subCategoryId);
            if (sc) {
              sourceElement = e;
              sourceSubCategory = sc;
              break outer;
            }
          }
        }
      }
    }

    const newSubElement: SubElement = {
      id: generateId(),
      subCategoryId,
      name,
      status: 'ok' as TileStatus,
      order: 0,
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => {
                  if (sc.id !== subCategoryId) return sc;
                  const newOrder = sc.subElements.length;
                  return {
                    ...sc,
                    subElements: [...sc.subElements, { ...newSubElement, order: newOrder }],
                  };
                }),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();

    // Propager aux éléments liés (sauf si c'est déjà une propagation)
    if (!_propagating && sourceElement?.linkedGroupId && sourceSubCategory) {
      const linkedGroupId = sourceElement.linkedGroupId;
      const subCategoryName = sourceSubCategory.name;
      const updatedCockpit = get().currentCockpit;
      if (updatedCockpit) {
        for (const d of updatedCockpit.domains) {
          for (const c of d.categories) {
            for (const e of c.elements) {
              if (e.id !== sourceElement.id && e.linkedGroupId === linkedGroupId) {
                // Trouver la sous-catégorie correspondante dans l'élément lié (par le nom)
                const correspondingSubCat = e.subCategories.find(sc => sc.name === subCategoryName);
                if (correspondingSubCat) {
                  // Vérifier que ce sous-élément n'existe pas déjà
                  const existingSubEl = correspondingSubCat.subElements.find(se => se.name === name);
                  if (!existingSubEl) {
                    get().addSubElement(correspondingSubCat.id, name, true);
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  updateSubElement: (subElementId: string, updates: Partial<SubElement>, _propagating?: boolean) => {
    // Trouver le sous-élément et son nom
    let subElName = updates.name || 'Sous-élément';
    let currentSubElement: SubElement | null = null;
    const cockpit = get().currentCockpit;
    if (cockpit) {
      outer: for (const d of cockpit.domains) {
        for (const c of d.categories) {
          for (const e of c.elements) {
            for (const sc of e.subCategories) {
              const se = sc.subElements.find(s => s.id === subElementId);
              if (se) {
                subElName = updates.name || se.name;
                currentSubElement = se;
                break outer;
              }
            }
          }
        }
      }
    }

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => ({
                  ...sc,
                  subElements: sc.subElements.map(se =>
                    se.id === subElementId ? { ...se, ...updates } : se
                  ),
                })),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'subElement', action: 'update', name: subElName });
    get().triggerAutoSave();

    // Gérer le changement de nom : séparer la liaison si le nom change
    if (!_propagating && currentSubElement?.linkedGroupId && updates.name !== undefined && updates.name !== currentSubElement.name) {
      // Le nom change → séparer ce sous-élément du groupe (supprimer le linkedGroupId)
      set((state) => {
        if (!state.currentCockpit) return state;
        return {
          currentCockpit: {
            ...state.currentCockpit,
            domains: state.currentCockpit.domains.map(d => ({
              ...d,
              categories: d.categories.map(c => ({
                ...c,
                elements: c.elements.map(e => ({
                  ...e,
                  subCategories: e.subCategories.map(sc => ({
                    ...sc,
                    subElements: sc.subElements.map(se =>
                      se.id === subElementId ? { ...se, linkedGroupId: undefined } : se
                    ),
                  })),
                })),
              })),
            })),
            updatedAt: new Date().toISOString(),
          },
        };
      });
      get().triggerAutoSave();
      // Ne pas propager si le nom change
      return;
    }

    // Propager aux sous-éléments liés (sauf si c'est déjà une propagation)
    if (!_propagating) {
      const updatedCockpit = get().currentCockpit;
      if (updatedCockpit && currentSubElement) {
        // Propriétés à synchroniser (exclure name car le changement de nom sépare la liaison)
        const syncUpdates: Partial<SubElement> = {};
        if (updates.status !== undefined) syncUpdates.status = updates.status;
        if (updates.icon !== undefined) syncUpdates.icon = updates.icon;
        if (updates.value !== undefined) syncUpdates.value = updates.value;
        if (updates.unit !== undefined) syncUpdates.unit = updates.unit;
        // Note: name n'est PAS propagé - le changement de nom sépare la liaison

        // Si aucune propriété synchronisable n'est mise à jour, pas besoin de propager
        if (Object.keys(syncUpdates).length === 0) return;

        // 1. Propager via linkedGroupId du sous-élément (liaison directe)
        if (currentSubElement.linkedGroupId) {
          const linkedGroupId = updates.linkedGroupId || currentSubElement.linkedGroupId;
          for (const d of updatedCockpit.domains) {
            for (const c of d.categories) {
              for (const e of c.elements) {
                for (const sc of e.subCategories) {
                  for (const se of sc.subElements) {
                    if (se.id !== subElementId && se.linkedGroupId === linkedGroupId) {
                      get().updateSubElement(se.id, syncUpdates, true);
                    }
                  }
                }
              }
            }
          }
        }

        // 2. Propager via l'élément parent lié (sous-éléments de même nom)
        // Trouver l'élément parent du sous-élément actuel
        let parentElement: Element | null = null;
        for (const d of updatedCockpit.domains) {
          for (const c of d.categories) {
            for (const e of c.elements) {
              for (const sc of e.subCategories) {
                if (sc.subElements.some(se => se.id === subElementId)) {
                  parentElement = e;
                  break;
                }
              }
              if (parentElement) break;
            }
            if (parentElement) break;
          }
          if (parentElement) break;
        }

        // Si l'élément parent est lié, propager aux sous-éléments de même nom dans les éléments liés
        if (parentElement?.linkedGroupId) {
          const subElementName = currentSubElement.name.toLowerCase();
          for (const d of updatedCockpit.domains) {
            for (const c of d.categories) {
              for (const e of c.elements) {
                // Trouver les éléments liés au même groupe (mais pas le même élément)
                if (e.id !== parentElement.id && e.linkedGroupId === parentElement.linkedGroupId) {
                  for (const sc of e.subCategories) {
                    for (const se of sc.subElements) {
                      // Trouver le sous-élément de même nom et le mettre à jour
                      if (se.name.toLowerCase() === subElementName && se.id !== subElementId) {
                        get().updateSubElement(se.id, syncUpdates, true);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  deleteSubElement: (subElementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => ({
                  ...sc,
                  subElements: sc.subElements.filter(se => se.id !== subElementId),
                })),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  moveElement: (elementId: string, fromCategoryId: string, toCategoryId: string) => {
    if (fromCategoryId === toCategoryId) return; // Pas besoin de déplacer si même catégorie

    set((state) => {
      if (!state.currentCockpit) return state;

      let elementToMove: Element | null = null;

      // Trouver l'élément à déplacer dans tous les domaines
      for (const domain of state.currentCockpit.domains) {
        for (const category of domain.categories) {
          if (category.id === fromCategoryId) {
            const element = category.elements.find(e => e.id === elementId);
            if (element) {
              elementToMove = element;
              break;
            }
          }
        }
        if (elementToMove) break;
      }

      if (!elementToMove) return state;

      // Retirer de la catégorie source et ajouter à la catégorie destination
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => {
              if (c.id === fromCategoryId) {
                // Retirer l'élément
                return {
                  ...c,
                  elements: c.elements.filter(e => e.id !== elementId),
                };
              }
              if (c.id === toCategoryId) {
                // Ajouter l'élément avec le nouveau categoryId
                const newOrder = c.elements.length;
                return {
                  ...c,
                  elements: [...c.elements, { ...elementToMove!, categoryId: toCategoryId, order: newOrder }],
                };
              }
              return c;
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  moveSubElement: (subElementId: string, fromSubCategoryId: string, toSubCategoryId: string) => {
    if (fromSubCategoryId === toSubCategoryId) return; // Pas besoin de déplacer si même sous-catégorie

    set((state) => {
      if (!state.currentCockpit) return state;

      let subElementToMove: SubElement | null = null;

      // Trouver le sous-élément à déplacer dans tous les domaines
      for (const domain of state.currentCockpit.domains) {
        for (const category of domain.categories) {
          for (const element of category.elements) {
            for (const subCategory of element.subCategories) {
              if (subCategory.id === fromSubCategoryId) {
                const subElement = subCategory.subElements.find(se => se.id === subElementId);
                if (subElement) {
                  subElementToMove = subElement;
                  break;
                }
              }
            }
            if (subElementToMove) break;
          }
          if (subElementToMove) break;
        }
        if (subElementToMove) break;
      }

      if (!subElementToMove) return state;

      // Retirer de la sous-catégorie source et ajouter à la sous-catégorie destination
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => {
                  if (sc.id === fromSubCategoryId) {
                    // Retirer le sous-élément
                    return {
                      ...sc,
                      subElements: sc.subElements.filter(se => se.id !== subElementId),
                    };
                  }
                  if (sc.id === toSubCategoryId) {
                    // Ajouter le sous-élément avec le nouveau subCategoryId
                    const newOrder = sc.subElements.length;
                    return {
                      ...sc,
                      subElements: [...sc.subElements, { ...subElementToMove!, subCategoryId: toSubCategoryId, order: newOrder }],
                    };
                  }
                  return sc;
                }),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  reorderElement: (elementId: string, categoryId: string, newIndex: number) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => {
              if (c.id !== categoryId) return c;

              const elements = [...c.elements];
              const currentIndex = elements.findIndex(e => e.id === elementId);

              if (currentIndex === -1 || currentIndex === newIndex) return c;

              // Retirer l'élément de sa position actuelle
              const [element] = elements.splice(currentIndex, 1);

              // Ajuster l'index cible si on déplace vers l'arrière
              // (car après avoir retiré l'élément, les indices après lui sont décalés)
              const adjustedIndex = currentIndex < newIndex ? newIndex - 1 : newIndex;

              // Insérer à la nouvelle position (bornée entre 0 et la longueur)
              const finalIndex = Math.max(0, Math.min(adjustedIndex, elements.length));
              elements.splice(finalIndex, 0, element);

              // Mettre à jour les ordres
              const updatedElements = elements.map((e, idx) => ({
                ...e,
                order: idx,
              }));

              return {
                ...c,
                elements: updatedElements,
              };
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  reorderSubElement: (subElementId: string, subCategoryId: string, newIndex: number) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => {
                  if (sc.id !== subCategoryId) return sc;

                  const subElements = [...sc.subElements];
                  const currentIndex = subElements.findIndex(se => se.id === subElementId);

                  if (currentIndex === -1 || currentIndex === newIndex) return sc;

                  // Retirer le sous-élément de sa position actuelle
                  const [subElement] = subElements.splice(currentIndex, 1);

                  // Ajuster l'index cible si on déplace vers l'arrière
                  // (car après avoir retiré le sous-élément, les indices après lui sont décalés)
                  const adjustedIndex = currentIndex < newIndex ? newIndex - 1 : newIndex;

                  // Insérer à la nouvelle position (bornée entre 0 et la longueur)
                  const finalIndex = Math.max(0, Math.min(adjustedIndex, subElements.length));
                  subElements.splice(finalIndex, 0, subElement);

                  // Mettre à jour les ordres
                  const updatedSubElements = subElements.map((se, idx) => ({
                    ...se,
                    order: idx,
                  }));

                  return {
                    ...sc,
                    subElements: updatedSubElements,
                  };
                }),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  addZone: (name: string) => {
    const newZone: Zone = {
      id: generateId(),
      name,
      cockpitId: get().currentCockpit?.id || '',
    };
    set((state) => ({ zones: [...state.zones, newZone] }));
    get().triggerAutoSave();
  },

  deleteZone: (zoneId: string) => {
    set((state) => ({ zones: state.zones.filter(z => z.id !== zoneId) }));
    get().triggerAutoSave();
  },

  addMapElement: (domainId: string, name: string, gps: GpsCoords, status: TileStatus = 'ok', icon: string = 'MapPin') => {
    const newMapElement: MapElement = {
      id: generateId(),
      domainId,
      name,
      gps,
      status,
      icon,
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => {
            if (d.id !== domainId) return d;
            return {
              ...d,
              mapElements: [...(d.mapElements || []), newMapElement],
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  updateMapElement: (mapElementId: string, updates: Partial<MapElement>) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            mapElements: (d.mapElements || []).map(me =>
              me.id === mapElementId ? { ...me, ...updates } : me
            ),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  deleteMapElement: (mapElementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            mapElements: (d.mapElements || []).filter(me => me.id !== mapElementId),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  cloneMapElement: (mapElementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      let elementToClone: MapElement | null = null;
      let domainId: string | null = null;

      // Trouver l'élément à cloner
      for (const domain of state.currentCockpit.domains) {
        const element = (domain.mapElements || []).find(me => me.id === mapElementId);
        if (element) {
          elementToClone = element;
          domainId = domain.id;
          break;
        }
      }

      if (!elementToClone || !domainId) return state;

      // Créer un clone avec un nouveau nom et un nouvel ID
      const clonedElement: MapElement = {
        ...elementToClone,
        id: generateId(),
        name: `${elementToClone.name} (copie)`,
      };

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => {
            if (d.id !== domainId) return d;
            return {
              ...d,
              mapElements: [...(d.mapElements || []), clonedElement],
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  cloneElement: (elementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      let elementToClone: Element | null = null;
      let categoryId: string | null = null;

      // Trouver l'élément à cloner
      for (const domain of state.currentCockpit.domains) {
        for (const category of domain.categories) {
          const element = category.elements.find(e => e.id === elementId);
          if (element) {
            elementToClone = element;
            categoryId = category.id;
            break;
          }
        }
        if (elementToClone) break;
      }

      if (!elementToClone || !categoryId) return state;

      // Décaler légèrement la position du clone (2% vers la droite et le bas)
      const offsetX = elementToClone.positionX !== undefined ? Math.min(95, (elementToClone.positionX || 0) + 2) : undefined;
      const offsetY = elementToClone.positionY !== undefined ? Math.min(95, (elementToClone.positionY || 0) + 2) : undefined;

      // Créer un clone avec un nouveau nom, un nouvel ID et réinitialiser les sous-catégories
      const clonedElement: Element = {
        ...elementToClone,
        id: generateId(),
        categoryId,
        name: `${elementToClone.name} (copie)`,
        subCategories: [], // Ne pas cloner les sous-catégories
        order: 0, // Sera mis à jour dans le code ci-dessous
        // Préserver position et taille si présentes, avec décalage
        positionX: offsetX,
        positionY: offsetY,
      };

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => {
              if (c.id !== categoryId) return c;
              const newOrder = c.elements.length;
              return {
                ...c,
                elements: [...c.elements, { ...clonedElement, order: newOrder }],
              };
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  // Dupliquer un élément avec liaison automatique dans la même catégorie
  duplicateElementLinked: (elementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver l'élément à dupliquer
    let elementToDuplicate: Element | null = null;
    let categoryId: string | null = null;

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        const element = category.elements.find(e => e.id === elementId);
        if (element) {
          elementToDuplicate = element;
          categoryId = category.id;
          break;
        }
      }
      if (elementToDuplicate) break;
    }

    if (!elementToDuplicate || !categoryId) return;

    // Générer un linkedGroupId si l'élément n'en a pas déjà un
    const linkedGroupId = elementToDuplicate.linkedGroupId || generateId();

    // Créer un nouvel élément lié avec le même contenu
    const newElementId = generateId();
    const newElement: Element = {
      ...JSON.parse(JSON.stringify(elementToDuplicate)), // Deep clone
      id: newElementId,
      categoryId,
      linkedGroupId,
      order: 0, // Sera mis à jour
    };

    // Générer de nouveaux IDs pour les sous-catégories et sous-éléments
    newElement.subCategories = newElement.subCategories.map((sc: SubCategory) => ({
      ...sc,
      id: generateId(),
      subElements: sc.subElements.map((se: SubElement) => ({
        ...se,
        id: generateId(),
        linkedGroupId: se.linkedGroupId || undefined, // Conserver ou non les liaisons des sous-éléments
      })),
    }));

    // Mettre à jour l'élément d'origine avec le linkedGroupId si pas déjà défini
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => {
              if (c.id !== categoryId) return c;
              const newOrder = c.elements.length;
              return {
                ...c,
                elements: [
                  ...c.elements.map(e =>
                    e.id === elementId
                      ? { ...e, linkedGroupId } // Mettre à jour l'élément d'origine
                      : e
                  ),
                  { ...newElement, order: newOrder }, // Ajouter le clone
                ],
              };
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'element', action: 'add', name: `${newElement.name} (lié)` });
    get().triggerAutoSave();
  },

  // Dupliquer un sous-élément avec liaison automatique dans la même sous-catégorie
  duplicateSubElementLinked: (subElementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver le sous-élément à dupliquer
    let subElementToDuplicate: SubElement | null = null;
    let subCategoryId: string | null = null;

    outer: for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          for (const subCategory of element.subCategories) {
            const subElement = subCategory.subElements.find(se => se.id === subElementId);
            if (subElement) {
              subElementToDuplicate = subElement;
              subCategoryId = subCategory.id;
              break outer;
            }
          }
        }
      }
    }

    if (!subElementToDuplicate || !subCategoryId) return;

    // Générer un linkedGroupId si le sous-élément n'en a pas déjà un
    const linkedGroupId = subElementToDuplicate.linkedGroupId || generateId();

    // Créer un nouveau sous-élément lié
    const newSubElement: SubElement = {
      ...subElementToDuplicate,
      id: generateId(),
      subCategoryId,
      linkedGroupId,
      order: 0, // Sera mis à jour
    };

    // Mettre à jour le sous-élément d'origine avec le linkedGroupId si pas déjà défini
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => {
                  if (sc.id !== subCategoryId) return sc;
                  const newOrder = sc.subElements.length;
                  return {
                    ...sc,
                    subElements: [
                      ...sc.subElements.map(se =>
                        se.id === subElementId
                          ? { ...se, linkedGroupId } // Mettre à jour l'original
                          : se
                      ),
                      { ...newSubElement, order: newOrder }, // Ajouter le clone
                    ],
                  };
                }),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'subElement', action: 'add', name: `${newSubElement.name} (lié)` });
    get().triggerAutoSave();
  },

  updateMapBounds: (domainId: string, bounds: MapBounds) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d =>
            d.id === domainId ? { ...d, mapBounds: bounds } : d
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  exportToExcel: async () => {
    const { currentCockpit } = get();
    const token = useAuthStore.getState().token;

    if (!currentCockpit) return null;

    try {
      // Télécharger les deux versions : FR et EN
      const downloadFile = async (lang: string) => {
        const response = await fetch(`${API_URL}/cockpits/${currentCockpit.id}/export/${lang}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) throw new Error(`Erreur export ${lang}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Extraire le nom du fichier depuis Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let fileName = `${currentCockpit.name}_${lang}.xlsx`;
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (fileNameMatch && fileNameMatch[1]) {
            fileName = fileNameMatch[1].replace(/['"]/g, '');
            // Décoder le nom de fichier
            try {
              fileName = decodeURIComponent(fileName);
            } catch (e) {
              // Si échec du décodage, utiliser tel quel
            }
          }
        }

        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      // Télécharger la version FR d'abord
      await downloadFile('FR');

      // Attendre un peu avant de télécharger la version EN (pour laisser le temps de traduire)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Télécharger la version EN
      await downloadFile('EN');

      return null; // Retourne null car les fichiers sont téléchargés directement
    } catch (error) {
      set({ error: 'Erreur lors de l\'export Excel' });
      return null;
    }
  },

  exportCockpit: async (id: string, fileName?: string, directoryHandle?: FileSystemDirectoryHandle | null) => {
    const token = useAuthStore.getState().token;

    try {
      // Récupérer le cockpit complet avec toutes ses données
      const response = await fetch(`${API_URL}/cockpits/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur lors de la récupération de la maquette');

      const cockpit = await response.json();

      // Créer un objet d'export avec toutes les données
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        cockpit: {
          name: cockpit.name,
          domains: cockpit.domains || [],
          zones: cockpit.zones || [],
          logo: cockpit.logo || null,
          scrollingBanner: cockpit.scrollingBanner || null,
          // Ne pas exporter les infos de publication (sera créé comme nouvelle maquette)
        }
      };

      // Convertir en JSON
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });

      // Utiliser le nom personnalisé ou générer un nom par défaut
      const defaultFileName = `${cockpit.name.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}`;
      const finalFileName = fileName ? fileName.trim() : defaultFileName;
      // S'assurer que le nom se termine par .json
      const fileExtension = finalFileName.endsWith('.json') ? '' : '.json';
      const completeFileName = `${finalFileName}${fileExtension}`;

      // Si un répertoire personnalisé est sélectionné, sauvegarder dedans
      if (directoryHandle) {
        try {
          const fileHandle = await directoryHandle.getFileHandle(completeFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return; // Succès, sortir de la fonction
        } catch (error: any) {
          console.error('Erreur lors de la sauvegarde dans le répertoire:', error);
          throw new Error(`Impossible de sauvegarder dans le répertoire: ${error.message}`);
        }
      }

      // Sinon, utiliser le téléchargement par défaut
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = completeFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      set({ error: 'Erreur lors de l\'export de la maquette' });
      throw error;
    }
  },

  importCockpit: async (file: File): Promise<Cockpit | null> => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });

    try {
      // Lire le fichier
      const text = await file.text();
      const importData = JSON.parse(text);

      // Vérifier la structure
      if (!importData.cockpit || !importData.cockpit.name) {
        throw new Error('Format de fichier invalide : structure de maquette manquante');
      }

      const importedCockpit = importData.cockpit;

      // Créer une nouvelle maquette avec les données importées
      // Les IDs seront régénérés automatiquement par le serveur
      const response = await fetch(`${API_URL}/cockpits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: importedCockpit.name || 'Maquette importée',
          domains: importedCockpit.domains || [],
          zones: importedCockpit.zones || [],
          logo: importedCockpit.logo || null,
          scrollingBanner: importedCockpit.scrollingBanner || null,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'import');
      }

      const newCockpit = await response.json();

      // Ajouter le nouveau cockpit à la liste sans recharger (préserve l'ordre)
      set((state) => ({
        cockpits: [...state.cockpits, newCockpit],
        isLoading: false
      }));

      return newCockpit;
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de l\'import de la maquette';
      set({ error: errorMessage, isLoading: false });
      console.error('Import error:', error);
      return null;
    }
  },

  publishCockpit: async (id: string) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true });

    try {
      // FORCER une sauvegarde complète et synchrone avant publication
      // IMPORTANT : Sauvegarder TOUTES les données (y compris non publiables) pour le studio
      const currentCockpit = get().currentCockpit;
      if (currentCockpit && currentCockpit.id === id) {
        // Annuler l'auto-save en attente
        const { autoSaveTimeout } = get();
        if (autoSaveTimeout) {
          clearTimeout(autoSaveTimeout);
          set({ autoSaveTimeout: null });
        }

        // Sauvegarder IMMÉDIATEMENT TOUTES les données actuelles (sans filtre)
        // Les données non publiables doivent rester dans le studio
        const payload: any = {
          name: currentCockpit.name,
          domains: currentCockpit.domains || [], // TOUS les domaines, y compris non publiables
          logo: currentCockpit.logo,
          scrollingBanner: currentCockpit.scrollingBanner,
          sharedWith: currentCockpit.sharedWith || [],
        };
        if ((currentCockpit as any).zones) {
          payload.zones = (currentCockpit as any).zones;
        }

        console.log('[Publish] 💾 Sauvegarde complète avant publication (TOUTES les données, y compris non publiables):', {
          name: payload.name,
          domainsCount: payload.domains.length,
          domainsWithImages: payload.domains.filter((d: any) => d.backgroundImage && d.backgroundImage.length > 0).length,
          nonPublishableDomains: payload.domains.filter((d: any) => d.publiable === false).length,
          sharedWithCount: payload.sharedWith.length
        });

        // Sauvegarder immédiatement TOUTES les données
        const saveResponse = await fetch(`${API_URL}/cockpits/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!saveResponse.ok) {
          throw new Error('Erreur lors de la sauvegarde avant publication');
        }

        // Attendre un peu pour que la DB soit à jour
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const response = await fetch(`${API_URL}/cockpits/${id}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) throw new Error('Erreur publication');

      const result = await response.json();

      // Mettre à jour la liste des cockpits
      set(state => ({
        cockpits: state.cockpits.map(c =>
          c.id === id
            ? { ...c, publicId: result.publicId, isPublished: true, publishedAt: result.publishedAt }
            : c
        ),
        isLoading: false
      }));

      return { publicId: result.publicId };
    } catch (error) {
      set({ error: 'Erreur lors de la publication', isLoading: false });
      return null;
    }
  },

  unpublishCockpit: async (id: string) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true });

    try {
      const response = await fetch(`${API_URL}/cockpits/${id}/unpublish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) throw new Error('Erreur dépublication');

      // Mettre à jour la liste des cockpits
      set(state => ({
        cockpits: state.cockpits.map(c =>
          c.id === id
            ? { ...c, isPublished: false }
            : c
        ),
        isLoading: false
      }));

      return true;
    } catch (error) {
      set({ error: 'Erreur lors de la dépublication', isLoading: false });
      return false;
    }
  },

  reorderCockpits: async (cockpitIds: string[]) => {
    const token = useAuthStore.getState().token;

    try {
      // Mettre à jour l'ordre localement
      set((state) => {
        const cockpitMap = new Map(state.cockpits.map(c => [c.id, c]));
        const reorderedCockpits: Cockpit[] = [];

        cockpitIds.forEach((id, index) => {
          const cockpit = cockpitMap.get(id);
          if (cockpit) {
            reorderedCockpits.push({ ...cockpit, order: index });
          }
        });

        // Ajouter les cockpits qui ne sont pas dans la liste (au cas où) avec leur ordre existant
        const remainingCockpits = state.cockpits
          .filter(c => !cockpitIds.includes(c.id))
          .map(c => ({ ...c, order: c.order ?? 9999 })); // Garder l'ordre existant ou mettre à la fin
        const allCockpits = [...reorderedCockpits, ...remainingCockpits];

        return { cockpits: allCockpits };
      });

      // Sauvegarder sur le serveur
      const response = await fetch(`${API_URL}/cockpits/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ cockpitIds }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la réorganisation');
      }

      // Ne PAS recharger les cockpits - l'ordre local est déjà à jour
      // Cela évite que les cockpits reviennent à leur position initiale
    } catch (error) {
      console.error('Erreur lors de la réorganisation des maquettes:', error);
      // Recharger les cockpits en cas d'erreur pour restaurer l'état
      await get().fetchCockpits();
    }
  },

  clearError: () => set({ error: null }),

  // Ajouter une modification récente (garde les 20 dernières)
  addRecentChange: (change) => {
    const newChange: RecentChange = {
      ...change,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    set((state) => ({
      recentChanges: [newChange, ...state.recentChanges].slice(0, 20),
    }));
  },

  clearRecentChanges: () => set({ recentChanges: [] }),

  // Trouver tous les éléments avec un nom donné
  findElementsByName: (name: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return [];

    const results: Array<{ element: Element; domainName: string; categoryName: string }> = [];
    const normalizedName = name.trim().toLowerCase();

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          if (element.name.trim().toLowerCase() === normalizedName) {
            results.push({
              element,
              domainName: domain.name,
              categoryName: category.name,
            });
          }
        }
      }
    }

    return results;
  },

  // Trouver tous les sous-éléments avec un nom donné
  findSubElementsByName: (name: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return [];

    const results: Array<{ subElement: SubElement; domainName: string; categoryName: string; elementName: string; subCategoryName: string }> = [];
    const normalizedName = name.trim().toLowerCase();

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          for (const subCategory of element.subCategories) {
            for (const subElement of subCategory.subElements) {
              if (subElement.name.trim().toLowerCase() === normalizedName) {
                results.push({
                  subElement,
                  domainName: domain.name,
                  categoryName: category.name,
                  elementName: element.name,
                  subCategoryName: subCategory.name,
                });
              }
            }
          }
        }
      }
    }

    return results;
  },

  // Lier un élément à un groupe avec fusion des catégories et sous-éléments
  linkElement: (elementId: string, linkedGroupId: string, linkSubElements: boolean = false) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver l'élément source (celui avec le linkedGroupId) et l'élément cible
    let sourceElement: Element | null = null;
    let targetElement: Element | null = null;

    for (const d of cockpit.domains) {
      for (const c of d.categories) {
        const foundSource = c.elements.find(e => e.id === linkedGroupId || e.linkedGroupId === linkedGroupId);
        if (foundSource) {
          sourceElement = foundSource;
        }
        const foundTarget = c.elements.find(e => e.id === elementId);
        if (foundTarget) {
          targetElement = foundTarget;
        }
      }
    }

    if (!sourceElement || !targetElement) return;

    // Prendre le statut le plus critique entre source et target
    const mostCriticalStatus = getMostCriticalStatus(sourceElement.status, targetElement.status);

    // Copier les propriétés de l'élément source vers le nouvel élément (avec le statut le plus critique)
    const updates: Partial<Element> = {
      linkedGroupId: linkedGroupId,
      status: mostCriticalStatus,
      icon: sourceElement.icon,
      icon2: sourceElement.icon2,
      icon3: sourceElement.icon3,
      value: sourceElement.value,
      unit: sourceElement.unit,
    };

    // Si la source n'a pas encore de linkedGroupId, on le lui assigne aussi
    // Et on met à jour son statut avec le plus critique
    if (!sourceElement.linkedGroupId) {
      get().updateElement(sourceElement.id, { linkedGroupId, status: mostCriticalStatus }, true);
    } else if (sourceElement.status !== mostCriticalStatus) {
      // Mettre à jour le statut de la source si nécessaire
      get().updateElement(sourceElement.id, { status: mostCriticalStatus }, true);
    }

    get().updateElement(elementId, updates, true);

    // Fusionner les sous-catégories : ajouter celles qui manquent dans chaque élément
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => {
                // Traiter l'élément source
                if (e.id === sourceElement!.id) {
                  // Ajouter les sous-catégories de target qui n'existent pas dans source
                  const existingSubCatNames = e.subCategories.map(sc => sc.name.toLowerCase());
                  const newSubCategories = targetElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => ({
                      ...sc,
                      id: generateId(),
                      elementId: e.id,
                      subElements: sc.subElements.map(se => ({
                        ...se,
                        id: generateId(),
                        subCategoryId: '', // Sera mis à jour
                        linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                      })),
                    }));

                  // Mettre à jour les subCategoryId des sous-éléments
                  newSubCategories.forEach(sc => {
                    sc.subElements = sc.subElements.map(se => ({
                      ...se,
                      subCategoryId: sc.id,
                    }));
                  });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  const mergedSubCategories = e.subCategories.map(sc => {
                    const matchingTargetSubCat = targetElement!.subCategories.find(
                      tsc => tsc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingTargetSubCat) {
                      const existingSubElNames = sc.subElements.map(se => se.name.toLowerCase());
                      const newSubElements = matchingTargetSubCat.subElements
                        .filter(se => !existingSubElNames.includes(se.name.toLowerCase()))
                        .map(se => ({
                          ...se,
                          id: generateId(),
                          subCategoryId: sc.id,
                          linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                        }));
                      return {
                        ...sc,
                        subElements: [...sc.subElements, ...newSubElements],
                      };
                    }
                    return sc;
                  });

                  return {
                    ...e,
                    subCategories: [...mergedSubCategories, ...newSubCategories],
                  };
                }

                // Traiter l'élément cible
                if (e.id === targetElement!.id) {
                  // Ajouter les sous-catégories de source qui n'existent pas dans target
                  const existingSubCatNames = e.subCategories.map(sc => sc.name.toLowerCase());
                  const newSubCategories = sourceElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => ({
                      ...sc,
                      id: generateId(),
                      elementId: e.id,
                      subElements: sc.subElements.map(se => ({
                        ...se,
                        id: generateId(),
                        subCategoryId: '', // Sera mis à jour
                        linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                      })),
                    }));

                  // Mettre à jour les subCategoryId des sous-éléments
                  newSubCategories.forEach(sc => {
                    sc.subElements = sc.subElements.map(se => ({
                      ...se,
                      subCategoryId: sc.id,
                    }));
                  });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  const mergedSubCategories = e.subCategories.map(sc => {
                    const matchingSourceSubCat = sourceElement!.subCategories.find(
                      ssc => ssc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingSourceSubCat) {
                      const existingSubElNames = sc.subElements.map(se => se.name.toLowerCase());
                      const newSubElements = matchingSourceSubCat.subElements
                        .filter(se => !existingSubElNames.includes(se.name.toLowerCase()))
                        .map(se => ({
                          ...se,
                          id: generateId(),
                          subCategoryId: sc.id,
                          linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                        }));
                      return {
                        ...sc,
                        subElements: [...sc.subElements, ...newSubElements],
                      };
                    }
                    return sc;
                  });

                  return {
                    ...e,
                    subCategories: [...mergedSubCategories, ...newSubCategories],
                  };
                }

                return e;
              }),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });

    // Si linkSubElements est activé, lier les sous-éléments de même nom avec le statut le plus critique
    if (linkSubElements) {
      const updatedCockpit = get().currentCockpit;
      if (updatedCockpit) {
        // Trouver les éléments source et target mis à jour
        let updatedSourceElement: Element | null = null;
        let updatedTargetElement: Element | null = null;
        
        for (const d of updatedCockpit.domains) {
          for (const c of d.categories) {
            const foundSource = c.elements.find(e => e.id === sourceElement!.id);
            if (foundSource) updatedSourceElement = foundSource;
            const foundTarget = c.elements.find(e => e.id === targetElement!.id);
            if (foundTarget) updatedTargetElement = foundTarget;
          }
        }

        if (updatedSourceElement && updatedTargetElement) {
          // Parcourir les sous-éléments de même nom et les lier
          for (const sourceSc of updatedSourceElement.subCategories) {
            for (const sourceSe of sourceSc.subElements) {
              // Trouver le sous-élément de même nom dans target
              for (const targetSc of updatedTargetElement.subCategories) {
                const matchingSe = targetSc.subElements.find(
                  se => se.name.toLowerCase() === sourceSe.name.toLowerCase()
                );
                if (matchingSe) {
                  // Prendre le statut le plus critique
                  const mostCriticalSubStatus = getMostCriticalStatus(sourceSe.status, matchingSe.status);
                  const subLinkGroupId = sourceSe.linkedGroupId || sourceSe.id;
                  
                  // Mettre à jour le source avec le linkedGroupId et le statut le plus critique
                  if (!sourceSe.linkedGroupId || sourceSe.status !== mostCriticalSubStatus) {
                    get().updateSubElement(sourceSe.id, { 
                      linkedGroupId: subLinkGroupId,
                      status: mostCriticalSubStatus 
                    }, true);
                  }
                  
                  // Lier le target au même groupe avec le statut le plus critique
                  get().updateSubElement(matchingSe.id, { 
                    linkedGroupId: subLinkGroupId,
                    status: mostCriticalSubStatus 
                  }, true);
                }
              }
            }
          }
        }
      }
    }

    get().triggerAutoSave();
  },

  // Lier un sous-élément à un groupe
  linkSubElement: (subElementId: string, linkedGroupId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver le sous-élément source
    let sourceSubElement: SubElement | null = null;
    outer: for (const d of cockpit.domains) {
      for (const c of d.categories) {
        for (const e of c.elements) {
          for (const sc of e.subCategories) {
            const found = sc.subElements.find(se => se.id === linkedGroupId || se.linkedGroupId === linkedGroupId);
            if (found) {
              sourceSubElement = found;
              break outer;
            }
          }
        }
      }
    }

    // Copier les propriétés
    const updates: Partial<SubElement> = {
      linkedGroupId: linkedGroupId,
    };

    if (sourceSubElement) {
      updates.status = sourceSubElement.status;
      updates.icon = sourceSubElement.icon;
      updates.value = sourceSubElement.value;
      updates.unit = sourceSubElement.unit;
    }

    // Si la source n'a pas encore de linkedGroupId, on le lui assigne aussi
    if (sourceSubElement && !sourceSubElement.linkedGroupId) {
      get().updateSubElement(sourceSubElement.id, { linkedGroupId });
    }

    get().updateSubElement(subElementId, updates);
  },

  // Délier un élément de son groupe
  unlinkElement: (elementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e =>
                e.id === elementId ? { ...e, linkedGroupId: undefined } : e
              ),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  // Délier un sous-élément de son groupe
  unlinkSubElement: (subElementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => ({
                  ...sc,
                  subElements: sc.subElements.map(se =>
                    se.id === subElementId ? { ...se, linkedGroupId: undefined } : se
                  ),
                })),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  // Obtenir tous les éléments avec leur chemin complet
  getAllElements: () => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return [];

    const results: Array<{ element: Element; domainId: string; domainName: string; categoryId: string; categoryName: string }> = [];

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          results.push({
            element,
            domainId: domain.id,
            domainName: domain.name,
            categoryId: category.id,
            categoryName: category.name,
          });
        }
      }
    }

    return results;
  },

  // Obtenir tous les sous-éléments avec leur chemin complet
  getAllSubElements: () => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return [];

    const results: Array<{ subElement: SubElement; domainId: string; domainName: string; categoryId: string; categoryName: string; elementId: string; elementName: string; subCategoryId: string; subCategoryName: string }> = [];

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          for (const subCategory of element.subCategories) {
            for (const subElement of subCategory.subElements) {
              results.push({
                subElement,
                domainId: domain.id,
                domainName: domain.name,
                categoryId: category.id,
                categoryName: category.name,
                elementId: element.id,
                elementName: element.name,
                subCategoryId: subCategory.id,
                subCategoryName: subCategory.name,
              });
            }
          }
        }
      }
    }

    return results;
  },

  // Obtenir tous les éléments liés à un élément donné
  getLinkedElements: (elementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return [];

    // Trouver l'élément et son linkedGroupId
    let targetElement: Element | null = null;
    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        const el = category.elements.find(e => e.id === elementId);
        if (el) {
          targetElement = el;
          break;
        }
      }
      if (targetElement) break;
    }

    if (!targetElement || !targetElement.linkedGroupId) return [];

    // Trouver tous les éléments avec le même linkedGroupId (sauf l'élément lui-même)
    const results: Array<{ element: Element; domainId: string; domainName: string; categoryId: string; categoryName: string }> = [];

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          if (element.linkedGroupId === targetElement.linkedGroupId && element.id !== elementId) {
            results.push({
              element,
              domainId: domain.id,
              domainName: domain.name,
              categoryId: category.id,
              categoryName: category.name,
            });
          }
        }
      }
    }

    return results;
  },

  // Obtenir tous les sous-éléments liés à un sous-élément donné
  getLinkedSubElements: (subElementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return [];

    // Trouver le sous-élément et son linkedGroupId
    let targetSubElement: SubElement | null = null;
    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          for (const subCategory of element.subCategories) {
            const subEl = subCategory.subElements.find(se => se.id === subElementId);
            if (subEl) {
              targetSubElement = subEl;
              break;
            }
          }
          if (targetSubElement) break;
        }
        if (targetSubElement) break;
      }
      if (targetSubElement) break;
    }

    if (!targetSubElement || !targetSubElement.linkedGroupId) return [];

    // Trouver tous les sous-éléments avec le même linkedGroupId (sauf le sous-élément lui-même)
    const results: Array<{ subElement: SubElement; domainId: string; domainName: string; categoryId: string; categoryName: string; elementId: string; elementName: string; subCategoryId: string; subCategoryName: string }> = [];

    for (const domain of cockpit.domains) {
      for (const category of domain.categories) {
        for (const element of category.elements) {
          for (const subCategory of element.subCategories) {
            for (const subElement of subCategory.subElements) {
              if (subElement.linkedGroupId === targetSubElement.linkedGroupId && subElement.id !== subElementId) {
                results.push({
                  subElement,
                  domainId: domain.id,
                  domainName: domain.name,
                  categoryId: category.id,
                  categoryName: category.name,
                  elementId: element.id,
                  elementName: element.name,
                  subCategoryId: subCategory.id,
                  subCategoryName: subCategory.name,
                });
              }
            }
          }
        }
      }
    }

    return results;
  },

  // Déplacer un élément vers une autre catégorie
  moveElementToCategory: (elementId: string, targetCategoryId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver l'élément et sa catégorie actuelle
    let elementToMove: Element | null = null;
    let sourceCategoryId: string | null = null;

    for (const d of cockpit.domains) {
      for (const c of d.categories) {
        const el = c.elements.find(e => e.id === elementId);
        if (el) {
          elementToMove = el;
          sourceCategoryId = c.id;
          break;
        }
      }
      if (elementToMove) break;
    }

    if (!elementToMove || !sourceCategoryId || sourceCategoryId === targetCategoryId) return;

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => {
              if (c.id === sourceCategoryId) {
                // Retirer de la source
                return { ...c, elements: c.elements.filter(e => e.id !== elementId) };
              }
              if (c.id === targetCategoryId) {
                // Ajouter à la destination
                const newOrder = c.elements.length;
                return { ...c, elements: [...c.elements, { ...elementToMove!, categoryId: targetCategoryId, order: newOrder }] };
              }
              return c;
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  // Déplacer un sous-élément vers une autre sous-catégorie
  moveSubElementToSubCategory: (subElementId: string, targetSubCategoryId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver le sous-élément et sa sous-catégorie actuelle
    let subElementToMove: SubElement | null = null;
    let sourceSubCategoryId: string | null = null;

    outer: for (const d of cockpit.domains) {
      for (const c of d.categories) {
        for (const e of c.elements) {
          for (const sc of e.subCategories) {
            const se = sc.subElements.find(s => s.id === subElementId);
            if (se) {
              subElementToMove = se;
              sourceSubCategoryId = sc.id;
              break outer;
            }
          }
        }
      }
    }

    if (!subElementToMove || !sourceSubCategoryId || sourceSubCategoryId === targetSubCategoryId) return;

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => ({
                ...e,
                subCategories: e.subCategories.map(sc => {
                  if (sc.id === sourceSubCategoryId) {
                    // Retirer de la source
                    return { ...sc, subElements: sc.subElements.filter(se => se.id !== subElementId) };
                  }
                  if (sc.id === targetSubCategoryId) {
                    // Ajouter à la destination
                    const newOrder = sc.subElements.length;
                    return { ...sc, subElements: [...sc.subElements, { ...subElementToMove!, subCategoryId: targetSubCategoryId, order: newOrder }] };
                  }
                  return sc;
                }),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  // Copier le contenu complet d'un élément source vers un élément cible avec fusion des sous-catégories
  copyElementContent: (targetElementId: string, sourceElementId: string, linkSubElements: boolean = false) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver l'élément source et l'élément cible
    let sourceElement: Element | null = null;
    let targetElement: Element | null = null;
    for (const d of cockpit.domains) {
      for (const c of d.categories) {
        const foundSource = c.elements.find(e => e.id === sourceElementId);
        if (foundSource) sourceElement = foundSource;
        const foundTarget = c.elements.find(e => e.id === targetElementId);
        if (foundTarget) targetElement = foundTarget;
      }
    }

    if (!sourceElement || !targetElement) return;

    // Copier les propriétés de l'élément
    const elementUpdates: Partial<Element> = {
      status: sourceElement.status,
      icon: sourceElement.icon,
      icon2: sourceElement.icon2,
      icon3: sourceElement.icon3,
      value: sourceElement.value,
      unit: sourceElement.unit,
      publiable: sourceElement.publiable,
      linkedGroupId: sourceElement.linkedGroupId || sourceElementId,
    };
    get().updateElement(targetElementId, elementUpdates, true);

    // Assigner le linkedGroupId à la source si elle ne l'a pas
    if (!sourceElement.linkedGroupId) {
      get().updateElement(sourceElementId, { linkedGroupId: sourceElementId }, true);
    }

    // Fusionner les sous-catégories : dans target, ajouter celles de source qui n'existent pas
    // Et aussi dans source, ajouter celles de target qui n'existent pas
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => ({
            ...d,
            categories: d.categories.map(c => ({
              ...c,
              elements: c.elements.map(e => {
                // Traiter l'élément cible
                if (e.id === targetElementId) {
                  const existingSubCatNames = e.subCategories.map(sc => sc.name.toLowerCase());
                  
                  // Créer les nouvelles sous-catégories (celles de source qui n'existent pas dans target)
                  const newSubCategories = sourceElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => {
                      const newSubCatId = generateId();
                      return {
                        ...sc,
                        id: newSubCatId,
                        elementId: targetElementId,
                        subElements: sc.subElements.map(se => ({
                          ...se,
                          id: generateId(),
                          subCategoryId: newSubCatId,
                          linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                        })),
                      };
                    });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  const mergedSubCategories = e.subCategories.map(sc => {
                    const matchingSourceSubCat = sourceElement!.subCategories.find(
                      ssc => ssc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingSourceSubCat) {
                      const existingSubElNames = sc.subElements.map(se => se.name.toLowerCase());
                      const newSubElements = matchingSourceSubCat.subElements
                        .filter(se => !existingSubElNames.includes(se.name.toLowerCase()))
                        .map(se => ({
                          ...se,
                          id: generateId(),
                          subCategoryId: sc.id,
                          linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                        }));
                      return {
                        ...sc,
                        subElements: [...sc.subElements, ...newSubElements],
                      };
                    }
                    return sc;
                  });

                  return {
                    ...e,
                    subCategories: [...mergedSubCategories, ...newSubCategories],
                  };
                }

                // Traiter l'élément source (y ajouter les sous-catégories de target qui n'existent pas)
                if (e.id === sourceElementId) {
                  const existingSubCatNames = e.subCategories.map(sc => sc.name.toLowerCase());
                  
                  // Créer les nouvelles sous-catégories (celles de target qui n'existent pas dans source)
                  const newSubCategories = targetElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => {
                      const newSubCatId = generateId();
                      return {
                        ...sc,
                        id: newSubCatId,
                        elementId: sourceElementId,
                        subElements: sc.subElements.map(se => ({
                          ...se,
                          id: generateId(),
                          subCategoryId: newSubCatId,
                          linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                        })),
                      };
                    });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  const mergedSubCategories = e.subCategories.map(sc => {
                    const matchingTargetSubCat = targetElement!.subCategories.find(
                      tsc => tsc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingTargetSubCat) {
                      const existingSubElNames = sc.subElements.map(se => se.name.toLowerCase());
                      const newSubElements = matchingTargetSubCat.subElements
                        .filter(se => !existingSubElNames.includes(se.name.toLowerCase()))
                        .map(se => ({
                          ...se,
                          id: generateId(),
                          subCategoryId: sc.id,
                          linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                        }));
                      return {
                        ...sc,
                        subElements: [...sc.subElements, ...newSubElements],
                      };
                    }
                    return sc;
                  });

                  return {
                    ...e,
                    subCategories: [...mergedSubCategories, ...newSubCategories],
                  };
                }

                return e;
              }),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().triggerAutoSave();
  },

  // Copier le contenu d'un sous-élément source vers un sous-élément cible
  copySubElementContent: (targetSubElementId: string, sourceSubElementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver le sous-élément source
    let sourceSubElement: SubElement | null = null;
    outer: for (const d of cockpit.domains) {
      for (const c of d.categories) {
        for (const e of c.elements) {
          for (const sc of e.subCategories) {
            const found = sc.subElements.find(se => se.id === sourceSubElementId);
            if (found) {
              sourceSubElement = found;
              break outer;
            }
          }
        }
      }
    }

    if (!sourceSubElement) return;

    // Copier les propriétés du sous-élément
    const updates: Partial<SubElement> = {
      status: sourceSubElement.status,
      icon: sourceSubElement.icon,
      value: sourceSubElement.value,
      unit: sourceSubElement.unit,
      linkedGroupId: sourceSubElement.linkedGroupId || sourceSubElementId,
    };
    get().updateSubElement(targetSubElementId, updates, true);

    // Assigner le linkedGroupId à la source si elle ne l'a pas
    if (!sourceSubElement.linkedGroupId) {
      get().updateSubElement(sourceSubElementId, { linkedGroupId: sourceSubElementId }, true);
    }
  },

  // ==================== INCIDENTS (Vue Alertes) ====================

  addIncident: (domainId: string, incident: Omit<Incident, 'id' | 'domainId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newIncident: Incident = {
      ...incident,
      id: generateId(),
      domainId,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => {
            if (d.id !== domainId) return d;
            return {
              ...d,
              alertsData: {
                ...d.alertsData,
                incidents: [...(d.alertsData?.incidents || []), newIncident],
              },
            };
          }),
          updatedAt: now,
        },
      };
    });
    get().addRecentChange({ type: 'domain', action: 'update', name: 'Incident ajouté' });
    get().triggerAutoSave();
  },

  updateIncident: (domainId: string, incidentId: string, updates: Partial<Incident>) => {
    const now = new Date().toISOString();

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => {
            if (d.id !== domainId) return d;
            return {
              ...d,
              alertsData: {
                ...d.alertsData,
                incidents: (d.alertsData?.incidents || []).map(inc =>
                  inc.id === incidentId ? { ...inc, ...updates, updatedAt: now } : inc
                ),
              },
            };
          }),
          updatedAt: now,
        },
      };
    });
    get().addRecentChange({ type: 'domain', action: 'update', name: 'Incident modifié' });
    get().triggerAutoSave();
  },

  deleteIncident: (domainId: string, incidentId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: state.currentCockpit.domains.map(d => {
            if (d.id !== domainId) return d;
            return {
              ...d,
              alertsData: {
                ...d.alertsData,
                incidents: (d.alertsData?.incidents || []).filter(inc => inc.id !== incidentId),
              },
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().addRecentChange({ type: 'domain', action: 'delete', name: 'Incident supprimé' });
    get().triggerAutoSave();
  },
}));


