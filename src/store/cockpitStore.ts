import { create } from 'zustand';
import type { Cockpit, Domain, Category, Element, SubCategory, SubElement, Template, Zone, TileStatus, MapElement, MapBounds, GpsCoords } from '../types';
import { useAuthStore } from './authStore';

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
  
  // Navigation
  setCurrentDomain: (domainId: string | null) => void;
  setCurrentElement: (elementId: string | null) => void;
  
  // Modifications avec auto-save
  updateCockpit: (updates: Partial<Cockpit>) => void;
  addDomain: (name: string) => void;
  updateDomain: (domainId: string, updates: Partial<Domain>) => void;
  deleteDomain: (domainId: string) => void;
  
  addCategory: (domainId: string, name: string, orientation: 'horizontal' | 'vertical') => void;
  updateCategory: (categoryId: string, updates: Partial<Category>) => void;
  deleteCategory: (categoryId: string) => void;
  
  addElement: (categoryId: string, name: string) => void;
  updateElement: (elementId: string, updates: Partial<Element>) => void;
  deleteElement: (elementId: string) => void;
  
  addSubCategory: (elementId: string, name: string, orientation: 'horizontal' | 'vertical') => void;
  updateSubCategory: (subCategoryId: string, updates: Partial<SubCategory>) => void;
  deleteSubCategory: (subCategoryId: string) => void;
  
  addSubElement: (subCategoryId: string, name: string) => void;
  updateSubElement: (subElementId: string, updates: Partial<SubElement>) => void;
  deleteSubElement: (subElementId: string) => void;
  
  // Zones
  addZone: (name: string) => void;
  deleteZone: (zoneId: string) => void;
  
  // Map Elements (points sur la carte)
  addMapElement: (domainId: string, name: string, gps: GpsCoords, status?: TileStatus, icon?: string) => void;
  updateMapElement: (mapElementId: string, updates: Partial<MapElement>) => void;
  deleteMapElement: (mapElementId: string) => void;
  updateMapBounds: (domainId: string, bounds: MapBounds) => void;
  
  // Export
  exportToExcel: () => Promise<Blob | null>;
  
  // Publication
  publishCockpit: (id: string) => Promise<{ publicId: string } | null>;
  unpublishCockpit: (id: string) => Promise<boolean>;
  
  // Utilitaires
  triggerAutoSave: () => void;
  clearError: () => void;
}

const API_URL = '/api';

const generateId = () => crypto.randomUUID();

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

  fetchCockpits: async () => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${API_URL}/cockpits`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erreur lors du chargement');
      
      const cockpits = await response.json();
      set({ cockpits, isLoading: false });
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
        currentCockpit: cockpit, 
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
        await fetch(`${API_URL}/cockpits/${currentCockpit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(currentCockpit),
        });
      } catch (error) {
        console.error('Erreur auto-save:', error);
      }
    }, 1000);
    
    set({ autoSaveTimeout: timeout });
  },

  updateCockpit: (updates: Partial<Cockpit>) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: { ...state.currentCockpit, ...updates, updatedAt: new Date().toISOString() },
      };
    });
    get().triggerAutoSave();
  },

  addDomain: (name: string) => {
    const newDomain: Domain = {
      id: generateId(),
      cockpitId: get().currentCockpit?.id || '',
      name,
      order: get().currentCockpit?.domains.length || 0,
      templateType: 'standard',
      categories: [],
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

  updateElement: (elementId: string, updates: Partial<Element>) => {
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
    get().triggerAutoSave();
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

  addSubCategory: (elementId: string, name: string, orientation: 'horizontal' | 'vertical') => {
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
  },

  updateSubCategory: (subCategoryId: string, updates: Partial<SubCategory>) => {
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
    get().triggerAutoSave();
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

  addSubElement: (subCategoryId: string, name: string) => {
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
  },

  updateSubElement: (subElementId: string, updates: Partial<SubElement>) => {
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
    get().triggerAutoSave();
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
      const response = await fetch(`${API_URL}/cockpits/${currentCockpit.id}/export`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erreur export');
      
      return await response.blob();
    } catch (error) {
      set({ error: 'Erreur lors de l\'export Excel' });
      return null;
    }
  },
  
  publishCockpit: async (id: string) => {
    const token = useAuthStore.getState().token;
    set({ isLoading: true });
    
    try {
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

  clearError: () => set({ error: null }),
}));


