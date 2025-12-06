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
  moveElement: (elementId: string, fromCategoryId: string, toCategoryId: string) => void;
  reorderElement: (elementId: string, categoryId: string, newIndex: number) => void;
  
  addSubCategory: (elementId: string, name: string, orientation: 'horizontal' | 'vertical') => void;
  updateSubCategory: (subCategoryId: string, updates: Partial<SubCategory>) => void;
  deleteSubCategory: (subCategoryId: string) => void;
  
  addSubElement: (subCategoryId: string, name: string) => void;
  updateSubElement: (subElementId: string, updates: Partial<SubElement>) => void;
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
  
  // Export
  exportToExcel: () => Promise<Blob | null>;
  exportCockpit: (id: string, fileName?: string, directoryHandle?: FileSystemDirectoryHandle | null) => Promise<void>;
  importCockpit: (file: File) => Promise<Cockpit | null>;
  
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
          // Envoyer uniquement les champs attendus par l'API PUT
          // L'API fait un merge profond, donc on envoie les domains avec TOUTES leurs propriétés
          const payload: any = {
            name: currentCockpit.name,
            domains: currentCockpit.domains || [],
            logo: currentCockpit.logo,
            scrollingBanner: currentCockpit.scrollingBanner,
          };
          // Ajouter zones si disponible (peut ne pas être dans le type Cockpit mais dans les données)
          if ((currentCockpit as any).zones) {
            payload.zones = (currentCockpit as any).zones;
          }
          
          console.log('[Auto-save] Envoi des données:', {
            name: payload.name,
            domainsCount: payload.domains.length,
            zonesCount: payload.zones.length,
            domainsWithImages: payload.domains.filter((d: any) => d.backgroundImage && d.backgroundImage.length > 0).length
          });
          
          // Log des images dans les domaines
          payload.domains.forEach((d: any, idx: number) => {
            const hasBg = d.backgroundImage && d.backgroundImage.length > 0;
            console.log(`[Auto-save] Domain[${idx}] "${d.name}": backgroundImage=${hasBg ? `PRESENTE (${d.backgroundImage.length} chars)` : 'ABSENTE'}`);
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
      
      // Recharger la liste des cockpits
      await get().fetchCockpits();
      
      set({ isLoading: false });
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


