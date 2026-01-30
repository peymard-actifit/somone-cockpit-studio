import { create } from 'zustand';
import type { Cockpit, Domain, Category, Element, SubCategory, SubElement, Template, Zone, TileStatus, MapElement, MapBounds, GpsCoords, TemplateType, Incident, Folder } from '../types';
import { useAuthStore } from './authStore';
import { APP_VERSION } from '../config/version';
import { offlineSync } from '../services/offlineSync';

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
  folders: Folder[];
  currentFolderId: string | null; // Répertoire actuellement ouvert (null = racine)
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
  fetchFolders: () => Promise<void>;

  // CRUD Cockpits
  createCockpit: (name: string) => Promise<Cockpit | null>;
  duplicateCockpit: (id: string, newName: string) => Promise<Cockpit | null>;
  deleteCockpit: (id: string) => Promise<boolean>;
  reorderCockpits: (cockpitIds: string[]) => Promise<void>;
  moveCockpitToFolder: (cockpitId: string, folderId: string | null) => Promise<boolean>;

  // CRUD Folders
  createFolder: (name: string) => Promise<Folder | null>;
  updateFolder: (id: string, name: string) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  reorderFolders: (folderIds: string[]) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;

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
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;
  deleteZone: (zoneId: string) => void;
  
  // Template Icons
  updateTemplateIcon: (templateName: string, icon: string | undefined) => void;

  // Map Elements (points sur la carte)
  addMapElement: (domainId: string, name: string, gps: GpsCoords, status?: TileStatus, icon?: string) => void;
  updateMapElement: (mapElementId: string, updates: Partial<MapElement>) => void;
  deleteMapElement: (mapElementId: string) => void;
  cloneMapElement: (mapElementId: string) => string | null; // Retourne l'ID du clone
  lastClonedMapElementId: string | null;
  clearLastClonedMapElementId: () => void;
  updateMapBounds: (domainId: string, bounds: MapBounds) => void;

  // Clone Element (pour BackgroundView)
  cloneElement: (elementId: string) => string | null; // Retourne l'ID du clone
  lastClonedElementId: string | null;
  clearLastClonedElementId: () => void;

  // Duplication liée d'éléments et sous-éléments
  duplicateElementLinked: (elementId: string) => void;
  duplicateSubElementLinked: (subElementId: string) => void;

  // Export
  exportToExcel: () => Promise<Blob | null>;
  exportCockpit: (id: string, fileName?: string, directoryHandle?: FileSystemDirectoryHandle | null) => Promise<void>;
  importCockpit: (file: File) => Promise<Cockpit | null>;

  // Publication
  publishCockpit: (id: string, welcomeMessage?: string) => Promise<{ publicId: string } | null>;
  unpublishCockpit: (id: string) => Promise<boolean>;
  updateWelcomeMessage: (id: string, welcomeMessage: string | null) => Promise<boolean>;

  // Utilitaires
  triggerAutoSave: () => void;
  triggerImmediateSave: () => Promise<void>; // Sauvegarde immédiate pour opérations critiques
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
  
  // Copie d'éléments entre domaines (BackgroundView) - copie aussi les catégories
  copyDomainElements: (sourceDomainId: string, targetDomainId: string) => Promise<{ success: boolean; message: string; copiedCount: number; copiedCategoriesCount: number }>;
  
  // Copie des sous-catégories et sous-éléments d'un élément vers un autre
  copyElementSubContent: (sourceElementId: string, targetElementId: string) => Promise<{ success: boolean; message: string; copiedSubCategoriesCount: number; copiedSubElementsCount: number }>;
  
  // Suppression de tous les éléments d'un domaine
  clearDomainElements: (domainId: string) => Promise<{ success: boolean; message: string; deletedCount: number }>;
  
  // Appliquer la taille d'un élément à tous les autres éléments du même domaine
  applySizeToAllElements: (elementId: string) => Promise<{ success: boolean; message: string; updatedCount: number }>;

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
  'herite_domaine': 2,
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
  folders: [],
  currentFolderId: null,
  currentCockpit: null,
  currentDomainId: null,
  currentElementId: null,
  templates: [],
  zones: [],
  isLoading: false,
  error: null,
  autoSaveTimeout: null,
  recentChanges: [],
  lastClonedElementId: null,
  lastClonedMapElementId: null,

  // =====================================================
  // GESTION DES RÉPERTOIRES
  // =====================================================

  fetchFolders: async () => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_URL}/folders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const folders = await response.json();
        set({ folders });
      }
    } catch (error) {
      console.error('Erreur chargement folders:', error);
    }
  },

  createFolder: async (name: string) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        const folder = await response.json();
        set((state) => ({ folders: [...state.folders, folder] }));
        return folder;
      }
      return null;
    } catch (error) {
      console.error('Erreur création folder:', error);
      return null;
    }
  },

  updateFolder: async (id: string, name: string) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_URL}/folders/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        set((state) => ({
          folders: state.folders.map(f => f.id === id ? { ...f, name } : f),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur mise à jour folder:', error);
      return false;
    }
  },

  deleteFolder: async (id: string) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_URL}/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        set((state) => ({
          folders: state.folders.filter(f => f.id !== id),
          currentFolderId: state.currentFolderId === id ? null : state.currentFolderId,
        }));
        return true;
      }
      const error = await response.json();
      console.error('Erreur suppression folder:', error);
      return false;
    } catch (error) {
      console.error('Erreur suppression folder:', error);
      return false;
    }
  },

  reorderFolders: async (folderIds: string[]) => {
    const token = useAuthStore.getState().token;
    // Mise à jour optimiste
    set((state) => ({
      folders: folderIds.map((id, index) => {
        const folder = state.folders.find(f => f.id === id);
        return folder ? { ...folder, order: index } : folder;
      }).filter(Boolean) as Folder[],
    }));
    
    try {
      await fetch(`${API_URL}/folders/reorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderIds }),
      });
    } catch (error) {
      console.error('Erreur réorganisation folders:', error);
      await get().fetchFolders();
    }
  },

  setCurrentFolder: (folderId: string | null) => {
    set({ currentFolderId: folderId });
  },

  moveCockpitToFolder: async (cockpitId: string, folderId: string | null) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_URL}/cockpits/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cockpitId, folderId }),
      });
      if (response.ok) {
        set((state) => ({
          cockpits: state.cockpits.map(c => 
            c.id === cockpitId ? { ...c, folderId: folderId || undefined } : c
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur déplacement cockpit:', error);
      return false;
    }
  },

  // =====================================================
  // FIN GESTION DES RÉPERTOIRES
  // =====================================================

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
    const state = get();
    
    // Sauvegarder l'état de navigation actuel pour les rechargements (ex: conflit 409)
    const isReload = state.currentCockpit?.id === id;
    const savedDomainId = isReload ? state.currentDomainId : null;
    const savedElementId = isReload ? state.currentElementId : null;
    
    // IMPORTANT: Sauvegarder le cockpit actuel AVANT de le recharger
    // pour éviter de perdre des modifications non sauvegardées
    if (isReload && state.currentCockpit) {
      console.log('[fetchCockpit] ⚠️ Rechargement détecté, sauvegarde préventive des données locales...');
      offlineSync.backupCockpit(state.currentCockpit);
    }
    
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/cockpits/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const serverCockpit = await response.json();
      
      // Vérifier s'il existe un backup local plus récent
      const backup = offlineSync.getBackup(id);
      let cockpitToUse = serverCockpit;
      
      if (backup && isReload) {
        const serverUpdatedAt = new Date(serverCockpit.updatedAt || 0).getTime();
        const backupTimestamp = backup.timestamp;
        
        // Si le backup local est plus récent que les données du serveur, l'utiliser
        if (backupTimestamp > serverUpdatedAt) {
          console.log('[fetchCockpit] 📦 Backup local plus récent détecté, utilisation du backup');
          console.log(`[fetchCockpit]   Server: ${new Date(serverUpdatedAt).toISOString()}`);
          console.log(`[fetchCockpit]   Backup: ${new Date(backupTimestamp).toISOString()}`);
          cockpitToUse = backup.cockpit;
          
          // Resauvegarder immédiatement vers le serveur
          const { triggerImmediateSave } = get();
          setTimeout(() => {
            console.log('[fetchCockpit] 🔄 Resynchronisation du backup vers le serveur...');
            triggerImmediateSave();
          }, 100);
        } else {
          // Les données du serveur sont plus récentes, supprimer le backup
          console.log('[fetchCockpit] ✅ Données serveur utilisées (plus récentes)');
          offlineSync.clearBackup(id);
        }
      }
      
      // Vérifier si les IDs sauvegardés sont toujours valides
      let validDomainId = cockpitToUse.domains?.[0]?.id || null;
      let validElementId: string | null = null;
      
      if (savedDomainId) {
        const foundDomain = cockpitToUse.domains?.find((d: any) => d.id === savedDomainId);
        if (foundDomain) {
          validDomainId = savedDomainId;
          // Vérifier si l'élément est toujours valide
          if (savedElementId) {
            for (const cat of foundDomain.categories || []) {
              if (cat.elements?.some((e: any) => e.id === savedElementId)) {
                validElementId = savedElementId;
                break;
              }
            }
          }
        }
      }
      
      set({
        currentCockpit: {
          ...cockpitToUse,
          sharedWith: cockpitToUse.sharedWith || [], // S'assurer que sharedWith existe
        },
        currentDomainId: validDomainId,
        currentElementId: validElementId,
        zones: cockpitToUse.zones || [],
        isLoading: false
      });
    } catch (error) {
      // En cas d'erreur réseau, essayer de charger depuis le backup local
      const backup = offlineSync.getBackup(id);
      if (backup) {
        console.log('[fetchCockpit] 📦 Erreur réseau, chargement depuis backup local');
        set({
          currentCockpit: backup.cockpit,
          currentDomainId: savedDomainId || backup.cockpit.domains?.[0]?.id || null,
          currentElementId: savedElementId,
          zones: (backup.cockpit as any).zones || state.zones || [],
          isLoading: false,
          error: null, // Pas d'erreur car on a le backup
        });
      } else {
        set({ error: 'Erreur lors du chargement de la maquette', isLoading: false });
      }
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
    const { autoSaveTimeout } = get();

    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(async () => {
      // IMPORTANT: Récupérer l'état ACTUEL au moment de l'exécution du timeout
      // et non la version capturée au moment de l'appel de triggerAutoSave
      const currentState = get();
      const currentCockpit = currentState.currentCockpit;
      const zones = currentState.zones;
      
      if (!currentCockpit) {
        console.warn('[Auto-save] Pas de cockpit à sauvegarder');
        return;
      }

      const token = useAuthStore.getState().token;
      if (!token) {
        console.warn('[Auto-save] Pas de token d\'authentification');
        return;
      }
      
      const payload: any = {
        name: currentCockpit.name,
        domains: currentCockpit.domains || [],
        logo: currentCockpit.logo,
        scrollingBanner: currentCockpit.scrollingBanner,
        sharedWith: currentCockpit.sharedWith || [],
        useOriginalView: currentCockpit.useOriginalView !== false, // true par défaut
        zones: zones || [],
        templateIcons: currentCockpit.templateIcons || {},
        clientUpdatedAt: currentCockpit.updatedAt,
        // Historique des données des sous-éléments
        dataHistory: currentCockpit.dataHistory,
        selectedDataDate: currentCockpit.selectedDataDate,
      };

      // Vérifier la taille du payload AVANT envoi (limite Vercel ~4.5MB)
      const payloadStr = JSON.stringify(payload);
      const payloadSizeMB = payloadStr.length / 1024 / 1024;
      
      console.log(`[Auto-save] 📦 Sauvegarde en cours... (${payloadSizeMB.toFixed(2)} MB, ${currentCockpit.domains?.length || 0} domaines)`);
      
      // Toujours sauvegarder une copie locale (backup)
      offlineSync.backupCockpit(currentCockpit);

      // Vérifier l'état du réseau
      const syncState = offlineSync.getState();
      
      if (!syncState.isOnline) {
        // Mode offline : ajouter à la queue
        console.log('[Auto-save] Mode offline, ajout à la queue');
        offlineSync.enqueue(currentCockpit.id, 'update', payload);
        return;
      }

      // Mode online : tenter la sauvegarde directe
      try {
        const response = await fetch(`${API_URL}/cockpits/${currentCockpit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: payloadStr,
        });

        if (response.status === 409) {
          // Conflit détecté mais on ne recharge PAS automatiquement pour ne pas perdre le focus
          console.warn('[Auto-save] ⚠️ Conflit détecté - les données locales seront conservées');
        } else if (response.status === 413) {
          console.error(`[Auto-save] ❌ Erreur 413 - Payload trop grand (${payloadSizeMB.toFixed(2)} MB)`);
        } else if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[Auto-save] ❌ Erreur serveur: ${response.status} - ${errorText}`);
        } else {
          console.log(`[Auto-save] ✅ Sauvegarde réussie`);
          // Succès : nettoyer le backup local
          offlineSync.clearBackup(currentCockpit.id);
        }
      } catch (error: any) {
        // Erreur réseau : passer en mode offline
        console.warn('[Auto-save] ⚠️ Erreur réseau, passage en mode offline:', error.message);
        offlineSync.enqueue(currentCockpit.id, 'update', payload);
      }
    }, 1000);

    set({ autoSaveTimeout: timeout });
  },

  // Sauvegarde immédiate pour opérations critiques (création/suppression de domaines, etc.)
  triggerImmediateSave: async () => {
    const { autoSaveTimeout } = get();

    // Annuler tout auto-save en attente
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      set({ autoSaveTimeout: null });
    }

    const currentState = get();
    const currentCockpit = currentState.currentCockpit;
    const zones = currentState.zones;
    
    if (!currentCockpit) {
      console.warn('[Immediate-save] Pas de cockpit à sauvegarder');
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('[Immediate-save] Pas de token d\'authentification');
      return;
    }
    
    const payload: any = {
      name: currentCockpit.name,
      domains: currentCockpit.domains || [],
      logo: currentCockpit.logo,
      scrollingBanner: currentCockpit.scrollingBanner,
      sharedWith: currentCockpit.sharedWith || [],
      useOriginalView: currentCockpit.useOriginalView !== false, // true par défaut
      zones: zones || [],
      templateIcons: currentCockpit.templateIcons || {},
      clientUpdatedAt: currentCockpit.updatedAt,
      // Historique des données des sous-éléments
      dataHistory: currentCockpit.dataHistory,
      selectedDataDate: currentCockpit.selectedDataDate,
    };

    const payloadStr = JSON.stringify(payload);
    const payloadSizeMB = payloadStr.length / 1024 / 1024;
    
    console.log(`[Immediate-save] 📦 Sauvegarde immédiate... (${payloadSizeMB.toFixed(2)} MB, ${currentCockpit.domains?.length || 0} domaines)`);
    
    // Toujours sauvegarder une copie locale
    offlineSync.backupCockpit(currentCockpit);

    try {
      const response = await fetch(`${API_URL}/cockpits/${currentCockpit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: payloadStr,
      });

      if (response.status === 409) {
        console.warn('[Immediate-save] ⚠️ Conflit détecté');
      } else if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[Immediate-save] ❌ Erreur: ${response.status} - ${errorText}`);
      } else {
        console.log(`[Immediate-save] ✅ Sauvegarde réussie`);
        offlineSync.clearBackup(currentCockpit.id);
      }
    } catch (error: any) {
      console.warn('[Immediate-save] ⚠️ Erreur réseau:', error.message);
      offlineSync.enqueue(currentCockpit.id, 'update', payload);
    }
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
    
    const payload: any = {
      name: currentCockpit.name,
      domains: currentCockpit.domains || [],
      logo: currentCockpit.logo,
      scrollingBanner: currentCockpit.scrollingBanner,
      sharedWith: currentCockpit.sharedWith || [],
      useOriginalView: currentCockpit.useOriginalView !== false, // true par défaut
      templateIcons: currentCockpit.templateIcons || {},
      clientUpdatedAt: currentCockpit.updatedAt,
      // Historique des données des sous-éléments
      dataHistory: currentCockpit.dataHistory,
      selectedDataDate: currentCockpit.selectedDataDate,
    };
    if ((currentCockpit as any).zones) {
      payload.zones = (currentCockpit as any).zones;
    }

    const payloadStr = JSON.stringify(payload);
    const payloadSizeMB = payloadStr.length / 1024 / 1024;
    console.log(`[forceSave] 📦 Taille du payload: ${payloadSizeMB.toFixed(2)} MB`);
    
    // Toujours sauvegarder une copie locale
    offlineSync.backupCockpit(currentCockpit);

    // Vérifier l'état du réseau
    const syncState = offlineSync.getState();
    
    if (!syncState.isOnline) {
      // Mode offline : ajouter à la queue et retourner succès (sauvegarde locale)
      console.log('[forceSave] Mode offline, ajout à la queue');
      offlineSync.enqueue(currentCockpit.id, 'save', payload);
      return true; // La sauvegarde sera faite au retour du réseau
    }

    try {
      const response = await fetch(`${API_URL}/cockpits/${currentCockpit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: payloadStr,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Gérer les conflits de version - PAS de rechargement automatique pour ne pas perdre le focus
        if (response.status === 409) {
          console.warn('[forceSave] ⚠️ Conflit détecté - les données locales seront conservées:', errorData.error);
          // On retourne true car les données locales sont sauvegardées en backup
          return true;
        }
        // Gérer les erreurs de payload trop grand
        if (response.status === 413) {
          console.error(`[forceSave] ❌ Payload trop grand (413): ${payloadSizeMB.toFixed(2)} MB`);
          return false;
        }
        console.error('[forceSave] Erreur serveur:', response.status, errorData);
        return false;
      }

      console.log(`[forceSave] ✅ Sauvegarde réussie (${payloadSizeMB.toFixed(2)} MB)`);
      // Succès : nettoyer le backup local
      offlineSync.clearBackup(currentCockpit.id);
      return true;
    } catch (error: any) {
      // Erreur réseau : passer en mode offline
      console.warn('[forceSave] Erreur réseau, passage en mode offline:', error.message);
      offlineSync.enqueue(currentCockpit.id, 'save', payload);
      return true; // La sauvegarde sera faite au retour du réseau
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
        // Sélectionner automatiquement le nouveau domaine créé
        currentDomainId: newDomain.id,
      };
    });
    // Sauvegarde immédiate pour la création de domaine (opération critique)
    get().triggerImmediateSave();
    get().addRecentChange({ type: 'domain', action: 'add', name });
  },

  updateDomain: (domainId: string, updates: Partial<Domain>) => {
    const domain = (get().currentCockpit?.domains || []).find(d => d.id === domainId);
    const domainName = updates.name || domain?.name || 'Domaine';

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d =>
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
    const domainName = (get().currentCockpit?.domains || []).find(d => d.id === domainId)?.name || 'Domaine';
    set((state) => {
      if (!state.currentCockpit) return state;
      const domains = (state.currentCockpit.domains || []).filter(d => d.id !== domainId);
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
    // Sauvegarde immédiate pour la suppression de domaine (opération critique)
    get().triggerImmediateSave();
    get().addRecentChange({ type: 'domain', action: 'delete', name: domainName });
  },

  duplicateDomain: (domainId: string) => {
    const state = get();
    if (!state.currentCockpit) return;

    const originalDomain = (state.currentCockpit.domains || []).find(d => d.id === domainId);
    if (!originalDomain) return;

    // Fonction pour générer de nouveaux IDs pour tous les enfants
    const duplicateWithNewIds = (domain: Domain): Domain => {
      const newDomainId = generateId();

      // Dupliquer les catégories avec nouveaux IDs
      const newCategories = (domain.categories || []).map(category => {
        const newCategoryId = generateId();

        // Dupliquer les éléments avec nouveaux IDs
        const newElements = (category.elements || []).map(element => {
          const newElementId = generateId();

          // Dupliquer les sous-catégories avec nouveaux IDs
          const newSubCategories = (element.subCategories || []).map(subCategory => {
            const newSubCategoryId = generateId();

            // Dupliquer les sous-éléments avec nouveaux IDs
            const newSubElements = (subCategory.subElements || []).map(subElement => ({
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
    const originalIndex = (state.currentCockpit.domains || []).findIndex(d => d.id === domainId);

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
    // Sauvegarde immédiate pour la duplication de domaine (opération critique)
    get().triggerImmediateSave();
  },

  reorderDomains: (domainIds: string[]) => {
    console.log('[reorderDomains] 🔄 Réorganisation des domaines:', domainIds);
    
    set((state) => {
      if (!state.currentCockpit) {
        console.warn('[reorderDomains] Pas de cockpit courant');
        return state;
      }

      // Créer un map pour un accès rapide aux domaines par ID
      const domainMap = new Map((state.currentCockpit.domains || []).map(d => [d.id, d]));

      // Reconstruire le tableau des domaines dans le nouvel ordre
      const reorderedDomains = domainIds
        .map((domainId, index) => {
          const domain = domainMap.get(domainId);
          if (!domain) return null;
          return { ...domain, order: index };
        })
        .filter((d): d is Domain => d !== null);

      // Ajouter les domaines qui n'étaient pas dans la liste (au cas où)
      const missingDomains = (state.currentCockpit.domains || []).filter(d => !domainIds.includes(d.id));
      reorderedDomains.push(...missingDomains.map((d, index) => ({ ...d, order: reorderedDomains.length + index })));

      const sortedDomains = reorderedDomains.sort((a, b) => a.order - b.order);
      console.log('[reorderDomains] ✅ Nouvel ordre:', sortedDomains.map(d => `${d.order}:${d.name}`).join(', '));

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: sortedDomains,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    
    // Déclencher l'auto-save
    console.log('[reorderDomains] 📤 Déclenchement auto-save...');
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
          domains: (state.currentCockpit.domains || []).map(d => {
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
    // Sauvegarde immédiate pour la création de catégorie (opération critique)
    get().triggerImmediateSave();
    get().addRecentChange({ type: 'category', action: 'add', name });
  },

  updateCategory: (categoryId: string, updates: Partial<Category>) => {
    // Trouver le nom de la catégorie
    let categoryName = updates.name || 'Catégorie';
    const cockpit = get().currentCockpit;
    if (cockpit) {
      for (const d of (cockpit.domains || [])) {
        const cat = (d.categories || []).find(c => c.id === categoryId);
        if (cat) { categoryName = updates.name || cat.name; break; }
      }
    }

    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c =>
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
    // Trouver le nom de la catégorie avant suppression
    let categoryName = 'Catégorie';
    const cockpit = get().currentCockpit;
    if (cockpit) {
      for (const domain of cockpit.domains || []) {
        const cat = (domain.categories || []).find(c => c.id === categoryId);
        if (cat) {
          categoryName = cat.name;
          break;
        }
      }
    }
    
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).filter(c => c.id !== categoryId),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    // Sauvegarde immédiate pour la suppression de catégorie (opération critique)
    get().triggerImmediateSave();
    get().addRecentChange({ type: 'category', action: 'delete', name: categoryName });
  },

  reorderCategory: (domainId: string, categoryIds: string[]) => {
    set((state) => {
      if (!state.currentCockpit) return state;

      const domain = (state.currentCockpit.domains || []).find(d => d.id === domainId);
      if (!domain) return state;

      // Créer un map pour un accès rapide aux catégories par ID
      const categoryMap = new Map((domain.categories || []).map(c => [c.id, c]));

      // Reconstruire le tableau des catégories dans le nouvel ordre
      const reorderedCategories = categoryIds
        .map((categoryId, index) => {
          const category = categoryMap.get(categoryId);
          if (!category) return null;
          return { ...category, order: index };
        })
        .filter((c): c is Category => c !== null);

      // Ajouter les catégories qui n'étaient pas dans la liste (au cas où)
      const missingCategories = (domain.categories || []).filter(c => !categoryIds.includes(c.id));
      reorderedCategories.push(...missingCategories.map((c, index) => ({ ...c, order: reorderedCategories.length + index })));

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d =>
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => {
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
    // Sauvegarde immédiate pour la création d'élément (opération critique)
    get().triggerImmediateSave();
    get().addRecentChange({ type: 'element', action: 'add', name });
  },

  updateElement: (elementId: string, updates: Partial<Element>, _propagating?: boolean) => {
    // Trouver l'élément et son nom
    let elementName = updates.name || 'Élément';
    let currentElement: Element | null = null;
    const cockpit = get().currentCockpit;
    if (cockpit) {
      outer: for (const d of (cockpit.domains || [])) {
        for (const c of (d.categories || [])) {
          const el = (c.elements || []).find(e => e.id === elementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e =>
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
            domains: (state.currentCockpit.domains || []).map(d => ({
              ...d,
              categories: (d.categories || []).map(c => ({
                ...c,
                elements: (c.elements || []).map(e =>
                  e.id === elementId 
                    ? { 
                        ...e, 
                        linkedGroupId: undefined,
                        // Délier aussi tous les sous-éléments
                        subCategories: (e.subCategories || []).map(sc => ({
                          ...sc,
                          subElements: (sc.subElements || []).map(se => ({
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
        if (updates.template !== undefined) syncUpdates.template = updates.template;
        if (updates.zone !== undefined) syncUpdates.zone = updates.zone;
        // Note: name n'est PAS propagé - le changement de nom sépare la liaison

        // Si aucune propriété synchronisable n'est mise à jour, pas besoin de propager
        if (Object.keys(syncUpdates).length === 0) return;

        // Trouver et mettre à jour tous les éléments du même groupe
        for (const d of updatedCockpit.domains) {
          for (const c of (d.categories || [])) {
            for (const e of (c.elements || [])) {
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
    // Trouver le nom de l'élément avant suppression
    let elementName = 'Élément';
    const cockpit = get().currentCockpit;
    if (cockpit) {
      for (const d of cockpit.domains || []) {
        for (const c of d.categories || []) {
          const el = (c.elements || []).find(e => e.id === elementId);
          if (el) {
            elementName = el.name;
            break;
          }
        }
      }
    }
    
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).filter(e => e.id !== elementId),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        currentElementId: state.currentElementId === elementId ? null : state.currentElementId,
      };
    });
    // Sauvegarde immédiate pour la suppression d'élément (opération critique)
    get().triggerImmediateSave();
    get().addRecentChange({ type: 'element', action: 'delete', name: elementName });
  },

  addSubCategory: (elementId: string, name: string, orientation: 'horizontal' | 'vertical', _propagating?: boolean) => {
    // Trouver l'élément pour vérifier s'il est lié
    const cockpit = get().currentCockpit;
    let sourceElement: Element | null = null;
    if (cockpit) {
      for (const d of (cockpit.domains || [])) {
        for (const c of (d.categories || [])) {
          const found = (c.elements || []).find(e => e.id === elementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => {
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
          for (const c of (d.categories || [])) {
            for (const e of (c.elements || [])) {
              if (e.id !== elementId && e.linkedGroupId === linkedGroupId) {
                // Vérifier que cette sous-catégorie n'existe pas déjà dans l'élément lié
                const existingSubCat = (e.subCategories || []).find(sc => sc.name === name);
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
      outer: for (const d of (cockpit.domains || [])) {
        for (const c of (d.categories || [])) {
          for (const e of (c.elements || [])) {
            const sc = (e.subCategories || []).find(s => s.id === subCategoryId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc =>
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
          for (const c of (d.categories || [])) {
            for (const e of (c.elements || [])) {
              if (e.id !== parentElement.id && e.linkedGroupId === linkedGroupId) {
                // Trouver la sous-catégorie correspondante par nom
                const correspondingSubCat = (e.subCategories || []).find(sc => sc.name === originalSubCatName);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).filter(sc => sc.id !== subCategoryId),
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
        for (const category of (domain.categories || [])) {
          const element = (category.elements || []).find(e => e.id === elementId);
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
      const subCategoryMap = new Map((targetElement.subCategories || []).map(sc => [sc.id, sc]));

      // Reconstruire le tableau des sous-catégories dans le nouvel ordre
      const reorderedSubCategories = subCategoryIds
        .map((subCategoryId, index) => {
          const subCategory = subCategoryMap.get(subCategoryId);
          if (!subCategory) return null;
          return { ...subCategory, order: index };
        })
        .filter((sc): sc is SubCategory => sc !== null);

      // Ajouter les sous-catégories qui n'étaient pas dans la liste (au cas où)
      const missingSubCategories = (targetElement.subCategories || []).filter(sc => !subCategoryIds.includes(sc.id));
      reorderedSubCategories.push(...missingSubCategories.map((sc, index) => ({ ...sc, order: reorderedSubCategories.length + index })));

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d =>
            d.id === targetDomain!.id
              ? {
                ...d,
                categories: (d.categories || []).map(c => ({
                  ...c,
                  elements: (c.elements || []).map(e =>
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
      outer: for (const d of (cockpit.domains || [])) {
        for (const c of (d.categories || [])) {
          for (const e of (c.elements || [])) {
            const sc = (e.subCategories || []).find(s => s.id === subCategoryId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => {
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
          for (const c of (d.categories || [])) {
            for (const e of (c.elements || [])) {
              if (e.id !== sourceElement.id && e.linkedGroupId === linkedGroupId) {
                // Trouver la sous-catégorie correspondante dans l'élément lié (par le nom)
                const correspondingSubCat = (e.subCategories || []).find(sc => sc.name === subCategoryName);
                if (correspondingSubCat) {
                  // Vérifier que ce sous-élément n'existe pas déjà
                  const existingSubEl = (correspondingSubCat.subElements || []).find(se => se.name === name);
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
      outer: for (const d of (cockpit.domains || [])) {
        for (const c of (d.categories || [])) {
          for (const e of (c.elements || [])) {
            for (const sc of (e.subCategories || [])) {
              const se = (sc.subElements || []).find(s => s.id === subElementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => ({
                  ...sc,
                  subElements: (sc.subElements || []).map(se =>
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
            domains: (state.currentCockpit.domains || []).map(d => ({
              ...d,
              categories: (d.categories || []).map(c => ({
                ...c,
                elements: (c.elements || []).map(e => ({
                  ...e,
                  subCategories: (e.subCategories || []).map(sc => ({
                    ...sc,
                    subElements: (sc.subElements || []).map(se =>
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
            for (const c of (d.categories || [])) {
              for (const e of (c.elements || [])) {
                for (const sc of (e.subCategories || [])) {
                  for (const se of (sc.subElements || [])) {
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
          for (const c of (d.categories || [])) {
            for (const e of (c.elements || [])) {
              for (const sc of (e.subCategories || [])) {
                if ((sc.subElements || []).some(se => se.id === subElementId)) {
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
            for (const c of (d.categories || [])) {
              for (const e of (c.elements || [])) {
                // Trouver les éléments liés au même groupe (mais pas le même élément)
                if (e.id !== parentElement.id && e.linkedGroupId === parentElement.linkedGroupId) {
                  for (const sc of (e.subCategories || [])) {
                    for (const se of (sc.subElements || [])) {
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => ({
                  ...sc,
                  subElements: (sc.subElements || []).filter(se => se.id !== subElementId),
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
        for (const category of (domain.categories || [])) {
          if (category.id === fromCategoryId) {
            const element = (category.elements || []).find(e => e.id === elementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => {
              if (c.id === fromCategoryId) {
                // Retirer l'élément
                return {
                  ...c,
                  elements: (c.elements || []).filter(e => e.id !== elementId),
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
        for (const category of (domain.categories || [])) {
          for (const element of (category.elements || [])) {
            for (const subCategory of (element.subCategories || [])) {
              if (subCategory.id === fromSubCategoryId) {
                const subElement = (subCategory.subElements || []).find(se => se.id === subElementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => {
                  if (sc.id === fromSubCategoryId) {
                    // Retirer le sous-élément
                    return {
                      ...sc,
                      subElements: (sc.subElements || []).filter(se => se.id !== subElementId),
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => {
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => {
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

  updateZone: (zoneId: string, updates: Partial<Zone>) => {
    set((state) => ({
      zones: state.zones.map(z =>
        z.id === zoneId ? { ...z, ...updates } : z
      ),
    }));
    get().triggerAutoSave();
  },

  deleteZone: (zoneId: string) => {
    set((state) => ({ zones: state.zones.filter(z => z.id !== zoneId) }));
    get().triggerAutoSave();
  },

  updateTemplateIcon: (templateName: string, icon: string | undefined) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      const currentIcons = state.currentCockpit.templateIcons || {};
      const newIcons = { ...currentIcons };
      
      if (icon) {
        newIcons[templateName] = icon;
      } else {
        delete newIcons[templateName];
      }
      
      return {
        currentCockpit: {
          ...state.currentCockpit,
          templateIcons: newIcons,
          updatedAt: new Date().toISOString(),
        },
      };
    });
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
          domains: (state.currentCockpit.domains || []).map(d => {
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
          domains: (state.currentCockpit.domains || []).map(d => ({
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
          domains: (state.currentCockpit.domains || []).map(d => ({
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
    const state = get();
    if (!state.currentCockpit) return null;

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

    if (!elementToClone || !domainId) return null;

    // Générer l'ID du clone avant pour pouvoir le retourner
    const cloneId = generateId();

    // Créer un clone avec un nouveau nom et un nouvel ID
    const clonedElement: MapElement = {
      ...elementToClone,
      id: cloneId,
      name: `${elementToClone.name} (copie)`,
    };

    set((s) => ({
      currentCockpit: s.currentCockpit ? {
        ...s.currentCockpit,
        domains: (s.currentCockpit.domains || []).map(d => {
          if (d.id !== domainId) return d;
          return {
            ...d,
            mapElements: [...(d.mapElements || []), clonedElement],
          };
        }),
        updatedAt: new Date().toISOString(),
      } : null,
      lastClonedMapElementId: cloneId,
    }));
    // Sauvegarde immédiate pour le clonage d'élément de carte (opération critique)
    get().triggerImmediateSave();
    return cloneId;
  },

  clearLastClonedMapElementId: () => {
    set({ lastClonedMapElementId: null });
  },

  cloneElement: (elementId: string) => {
    const state = get();
    if (!state.currentCockpit) return null;

    let elementToClone: Element | null = null;
    let categoryId: string | null = null;

    // Trouver l'élément à cloner
    for (const domain of state.currentCockpit.domains) {
      for (const category of (domain.categories || [])) {
        const element = (category.elements || []).find(e => e.id === elementId);
        if (element) {
          elementToClone = element;
          categoryId = category.id;
          break;
        }
      }
      if (elementToClone) break;
    }

    if (!elementToClone || !categoryId) return null;

    // Décaler légèrement la position du clone (2% vers la droite et le bas)
    const offsetX = elementToClone.positionX !== undefined ? Math.min(95, (elementToClone.positionX || 0) + 2) : undefined;
    const offsetY = elementToClone.positionY !== undefined ? Math.min(95, (elementToClone.positionY || 0) + 2) : undefined;

    // Générer l'ID du clone avant pour pouvoir le retourner
    const cloneId = generateId();

    // Créer un clone avec un nouveau nom, un nouvel ID et réinitialiser les sous-catégories
    const clonedElement: Element = {
      ...elementToClone,
      id: cloneId,
      categoryId,
      name: `${elementToClone.name} (copie)`,
      subCategories: [], // Ne pas cloner les sous-catégories
      order: 0, // Sera mis à jour dans le code ci-dessous
      // Préserver position et taille si présentes, avec décalage
      positionX: offsetX,
      positionY: offsetY,
    };

    set((s) => ({
      currentCockpit: s.currentCockpit ? {
        ...s.currentCockpit,
        domains: (s.currentCockpit.domains || []).map(d => ({
          ...d,
          categories: (d.categories || []).map(c => {
            if (c.id !== categoryId) return c;
            const newOrder = c.elements.length;
            return {
              ...c,
              elements: [...c.elements, { ...clonedElement, order: newOrder }],
            };
          }),
        })),
        updatedAt: new Date().toISOString(),
      } : null,
      lastClonedElementId: cloneId,
    }));
    // Sauvegarde immédiate pour le clonage d'élément (opération critique)
    get().triggerImmediateSave();
    return cloneId;
  },

  clearLastClonedElementId: () => {
    set({ lastClonedElementId: null });
  },

  // Dupliquer un élément avec liaison automatique dans la même catégorie
  duplicateElementLinked: (elementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver l'élément à dupliquer
    let elementToDuplicate: Element | null = null;
    let categoryId: string | null = null;

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        const element = (category.elements || []).find(e => e.id === elementId);
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
    newElement.subCategories = (newElement.subCategories || []).map((sc: SubCategory) => ({
      ...sc,
      id: generateId(),
      subElements: (sc.subElements || []).map((se: SubElement) => ({
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => {
              if (c.id !== categoryId) return c;
              const newOrder = c.elements.length;
              return {
                ...c,
                elements: [
                  ...(c.elements || []).map(e =>
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
    // Sauvegarde immédiate pour la duplication liée d'élément (opération critique)
    get().triggerImmediateSave();
  },

  // Dupliquer un sous-élément avec liaison automatique dans la même sous-catégorie
  duplicateSubElementLinked: (subElementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver le sous-élément à dupliquer
    let subElementToDuplicate: SubElement | null = null;
    let subCategoryId: string | null = null;

    outer: for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            const subElement = (subCategory.subElements || []).find(se => se.id === subElementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => {
                  if (sc.id !== subCategoryId) return sc;
                  const newOrder = sc.subElements.length;
                  return {
                    ...sc,
                    subElements: [
                      ...(sc.subElements || []).map(se =>
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
    // Sauvegarde immédiate pour la duplication liée de sous-élément (opération critique)
    get().triggerImmediateSave();
  },

  updateMapBounds: (domainId: string, bounds: MapBounds) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d =>
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

        // Générer le nom du fichier côté client (format: YYYYMMDD SOMONE Cockpit Generator NomMaquette LANG HHMMSS.xlsx)
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
        const cleanName = currentCockpit.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
        const fileName = `${dateStamp} SOMONE Cockpit Generator ${cleanName} ${lang} ${timeStamp}.xlsx`;

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

      // EXPORT COMPLET - Exporter TOUTES les données du cockpit sans exception
      // Seuls id/userId/createdAt/updatedAt seront régénérés à l'import (car nouvelle instance)
      // On les exclut de l'export car ils seront régénérés
      const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...cockpitData } = cockpit;
      
      const exportData = {
        exportVersion: '3.0', // Version 3.0 = export complet
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        cockpit: cockpitData // TOUT le reste est exporté : domains, zones, logo, scrollingBanner, 
                             // templateIcons, useOriginalView, originals, folderId, sharedWith, 
                             // publicId, isPublished, publishedAt, order, etc.
      };

      // Log pour debug
      const dataKeys = Object.keys(cockpitData);
      console.log(`[Export] Maquette "${cockpit.name}" - Export COMPLET avec ${dataKeys.length} propriétés: ${dataKeys.join(', ')}`);

      // Convertir en JSON
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });

      // Générer le nom du fichier avec le format "YYYYMMDD SOMONE MAQ NomMaquette vX.Y.Z HHMMSS"
      const now = new Date();
      // Convertir en heure de Paris
      const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const year = parisTime.getFullYear();
      const month = String(parisTime.getMonth() + 1).padStart(2, '0');
      const day = String(parisTime.getDate()).padStart(2, '0');
      const hours = String(parisTime.getHours()).padStart(2, '0');
      const minutes = String(parisTime.getMinutes()).padStart(2, '0');
      const seconds = String(parisTime.getSeconds()).padStart(2, '0');
      const dateStamp = `${year}${month}${day}`;
      const timeStamp = `${hours}${minutes}${seconds}`;
      const sanitizedName = cockpit.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      const defaultFileName = `${dateStamp} SOMONE MAQ ${sanitizedName} v${APP_VERSION} ${timeStamp}`;
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

      // Vérifier la structure (compatible v1.0 et v2.0)
      if (!importData.cockpit || !importData.cockpit.name) {
        throw new Error('Format de fichier invalide : structure de maquette manquante');
      }

      const importedCockpit = importData.cockpit;
      
      // Log des informations de version si disponibles
      const dataKeys = Object.keys(importedCockpit);
      console.log(`[Import] Fichier exporté depuis version ${importData.appVersion || importData.version || 'inconnue'} (format v${importData.exportVersion || '1.0'})`);
      console.log(`[Import] Maquette "${importedCockpit.name}" - ${dataKeys.length} propriétés: ${dataKeys.join(', ')}`);

      // IMPORT COMPLET - Envoyer TOUTES les données du fichier
      // L'API va régénérer les IDs et créer une nouvelle instance
      const response = await fetch(`${API_URL}/cockpits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...importedCockpit, // TOUTES les données du fichier exporté
          name: importedCockpit.name || 'Maquette importée', // S'assurer qu'il y a un nom
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

      console.log(`[Import] ✅ Maquette "${newCockpit.name}" importée avec succès (ID: ${newCockpit.id})`);
      return newCockpit;
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de l\'import de la maquette';
      set({ error: errorMessage, isLoading: false });
      console.error('[Import] ❌ Erreur:', error);
      return null;
    }
  },

  publishCockpit: async (id: string, welcomeMessage?: string) => {
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
          templateIcons: currentCockpit.templateIcons || {}, // Icônes des templates
          // IMPORTANT: Inclure useOriginalView pour que la publication utilise la bonne vue (true par défaut)
          useOriginalView: currentCockpit.useOriginalView !== false,
          // Historique des données des sous-éléments
          dataHistory: currentCockpit.dataHistory,
          selectedDataDate: currentCockpit.selectedDataDate,
        };
        if ((currentCockpit as any).zones) {
          payload.zones = (currentCockpit as any).zones;
        }

        console.log('[Publish] 💾 Sauvegarde complète avant publication (TOUTES les données, y compris non publiables):', {
          name: payload.name,
          domainsCount: payload.domains.length,
          domainsWithImages: (payload.domains || []).filter((d: any) => d.backgroundImage && d.backgroundImage.length > 0).length,
          nonPublishableDomains: (payload.domains || []).filter((d: any) => d.publiable === false).length,
          sharedWithCount: payload.sharedWith.length,
          useOriginalView: payload.useOriginalView, // Log explicite
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
        body: JSON.stringify({ welcomeMessage: welcomeMessage || null }),
      });

      if (!response.ok) throw new Error('Erreur publication');

      const result = await response.json();

      // Mettre à jour la liste des cockpits
      set(state => ({
        cockpits: state.cockpits.map(c =>
          c.id === id
            ? { ...c, publicId: result.publicId, isPublished: true, publishedAt: result.publishedAt, welcomeMessage: welcomeMessage || undefined }
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

  updateWelcomeMessage: async (id: string, welcomeMessage: string | null) => {
    const token = useAuthStore.getState().token;
    console.log(`[Store] updateWelcomeMessage appelé pour ${id} avec message: "${welcomeMessage?.substring(0, 30) || 'null'}..."`);
    
    try {
      const response = await fetch(`${API_URL}/cockpits/${id}/welcome-message`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ welcomeMessage }),
      });

      console.log(`[Store] Réponse API: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Store] Erreur API:`, errorData);
        throw new Error('Erreur mise à jour message');
      }

      const result = await response.json();
      console.log(`[Store] Résultat:`, result);

      // Mettre à jour la liste des cockpits
      set(state => ({
        cockpits: state.cockpits.map(c =>
          c.id === id
            ? { ...c, welcomeMessage: welcomeMessage || undefined }
            : c
        ),
      }));

      console.log(`[Store] Liste cockpits mise à jour`);
      return true;
    } catch (error) {
      console.error('Erreur updateWelcomeMessage:', error);
      return false;
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

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
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

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            for (const subElement of (subCategory.subElements || [])) {
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

    for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        const foundSource = (c.elements || []).find(e => e.id === linkedGroupId || e.linkedGroupId === linkedGroupId);
        if (foundSource) {
          sourceElement = foundSource;
        }
        const foundTarget = (c.elements || []).find(e => e.id === elementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => {
                // Traiter l'élément source
                if (e.id === sourceElement!.id) {
                  // Ajouter les sous-catégories de target qui n'existent pas dans source
                  const existingSubCatNames = (e.subCategories || []).map(sc => sc.name.toLowerCase());
                  const newSubCategories = targetElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => ({
                      ...sc,
                      id: generateId(),
                      elementId: e.id,
                      subElements: (sc.subElements || []).map(se => ({
                        ...se,
                        id: generateId(),
                        subCategoryId: '', // Sera mis à jour
                        linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                      })),
                    }));

                  // Mettre à jour les subCategoryId des sous-éléments
                  newSubCategories.forEach(sc => {
                    sc.subElements = (sc.subElements || []).map(se => ({
                      ...se,
                      subCategoryId: sc.id,
                    }));
                  });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  const mergedSubCategories = (e.subCategories || []).map(sc => {
                    const matchingTargetSubCat = (targetElement!.subCategories || []).find(
                      tsc => tsc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingTargetSubCat) {
                      const existingSubElNames = (sc.subElements || []).map(se => se.name.toLowerCase());
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
                  const existingSubCatNames = (e.subCategories || []).map(sc => sc.name.toLowerCase());
                  const newSubCategories = sourceElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => ({
                      ...sc,
                      id: generateId(),
                      elementId: e.id,
                      subElements: (sc.subElements || []).map(se => ({
                        ...se,
                        id: generateId(),
                        subCategoryId: '', // Sera mis à jour
                        linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                      })),
                    }));

                  // Mettre à jour les subCategoryId des sous-éléments
                  newSubCategories.forEach(sc => {
                    sc.subElements = (sc.subElements || []).map(se => ({
                      ...se,
                      subCategoryId: sc.id,
                    }));
                  });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  const mergedSubCategories = (e.subCategories || []).map(sc => {
                    const matchingSourceSubCat = (sourceElement!.subCategories || []).find(
                      ssc => ssc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingSourceSubCat) {
                      const existingSubElNames = (sc.subElements || []).map(se => se.name.toLowerCase());
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
          for (const c of (d.categories || [])) {
            const foundSource = (c.elements || []).find(e => e.id === sourceElement!.id);
            if (foundSource) updatedSourceElement = foundSource;
            const foundTarget = (c.elements || []).find(e => e.id === targetElement!.id);
            if (foundTarget) updatedTargetElement = foundTarget;
          }
        }

        if (updatedSourceElement && updatedTargetElement) {
          // Parcourir les sous-éléments de même nom et les lier
          for (const sourceSc of (updatedSourceElement.subCategories || [])) {
            for (const sourceSe of (sourceSc.subElements || [])) {
              // Trouver le sous-élément de même nom dans target
              for (const targetSc of (updatedTargetElement.subCategories || [])) {
                const matchingSe = (targetSc.subElements || []).find(
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
    outer: for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        for (const e of (c.elements || [])) {
          for (const sc of (e.subCategories || [])) {
            const found = (sc.subElements || []).find(se => se.id === linkedGroupId || se.linkedGroupId === linkedGroupId);
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
    // Délier l'élément ET tous ses sous-éléments
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e =>
                e.id === elementId 
                  ? { 
                      ...e, 
                      linkedGroupId: undefined,
                      // Délier aussi tous les sous-éléments
                      subCategories: (e.subCategories || []).map(sc => ({
                        ...sc,
                        subElements: (sc.subElements || []).map(se => ({
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
  },

  // Délier un sous-élément de son groupe
  unlinkSubElement: (subElementId: string) => {
    set((state) => {
      if (!state.currentCockpit) return state;
      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => ({
                  ...sc,
                  subElements: (sc.subElements || []).map(se =>
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

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
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

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            for (const subElement of (subCategory.subElements || [])) {
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
    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        const el = (category.elements || []).find(e => e.id === elementId);
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

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
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
    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            const subEl = (subCategory.subElements || []).find(se => se.id === subElementId);
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

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            for (const subElement of (subCategory.subElements || [])) {
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

    for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        const el = (c.elements || []).find(e => e.id === elementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => {
              if (c.id === sourceCategoryId) {
                // Retirer de la source
                return { ...c, elements: (c.elements || []).filter(e => e.id !== elementId) };
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

    outer: for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        for (const e of (c.elements || [])) {
          for (const sc of (e.subCategories || [])) {
            const se = (sc.subElements || []).find(s => s.id === subElementId);
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
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => ({
                ...e,
                subCategories: (e.subCategories || []).map(sc => {
                  if (sc.id === sourceSubCategoryId) {
                    // Retirer de la source
                    return { ...sc, subElements: (sc.subElements || []).filter(se => se.id !== subElementId) };
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
  // IMPORTANT: Cette fonction préserve les liaisons existantes (linkedGroupId) de l'élément cible
  copyElementContent: (targetElementId: string, sourceElementId: string, linkSubElements: boolean = false) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver l'élément source et l'élément cible
    let sourceElement: Element | null = null;
    let targetElement: Element | null = null;
    for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        const foundSource = (c.elements || []).find(e => e.id === sourceElementId);
        if (foundSource) sourceElement = foundSource;
        const foundTarget = (c.elements || []).find(e => e.id === targetElementId);
        if (foundTarget) targetElement = foundTarget;
      }
    }

    if (!sourceElement || !targetElement) return;

    // Copier les propriétés de l'élément SANS modifier le linkedGroupId existant
    // Le choix d'un template ne doit pas affecter les liaisons
    const elementUpdates: Partial<Element> = {
      status: sourceElement.status,
      icon: sourceElement.icon,
      icon2: sourceElement.icon2,
      icon3: sourceElement.icon3,
      value: sourceElement.value,
      unit: sourceElement.unit,
      publiable: sourceElement.publiable,
      // PRÉSERVER la liaison existante : ne pas écraser le linkedGroupId de l'élément cible
    };
    get().updateElement(targetElementId, elementUpdates, true);

    // Fusionner les sous-catégories : dans target, ajouter celles de source qui n'existent pas
    // Et aussi dans source, ajouter celles de target qui n'existent pas
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => {
                // Traiter l'élément cible
                if (e.id === targetElementId) {
                  const existingSubCatNames = (e.subCategories || []).map(sc => sc.name.toLowerCase());
                  
                  // Créer les nouvelles sous-catégories (celles de source qui n'existent pas dans target)
                  // Utiliser deep clone pour garantir la copie de toutes les propriétés
                  const newSubCategories = sourceElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => {
                      const newSubCatId = generateId();
                      const clonedSubCategory = JSON.parse(JSON.stringify(sc));
                      return {
                        ...clonedSubCategory,
                        id: newSubCatId,
                        elementId: targetElementId,
                        subElements: (clonedSubCategory.subElements || []).map((se: SubElement) => {
                          const clonedSubElement = JSON.parse(JSON.stringify(se));
                          return {
                            ...clonedSubElement,
                            id: generateId(),
                            subCategoryId: newSubCatId,
                            linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                          };
                        }),
                      };
                    });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  // Utiliser deep clone pour garantir la copie de toutes les propriétés
                  const mergedSubCategories = (e.subCategories || []).map(sc => {
                    const matchingSourceSubCat = (sourceElement!.subCategories || []).find(
                      ssc => ssc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingSourceSubCat) {
                      const existingSubElNames = (sc.subElements || []).map(se => se.name.toLowerCase());
                      const newSubElements = matchingSourceSubCat.subElements
                        .filter(se => !existingSubElNames.includes(se.name.toLowerCase()))
                        .map(se => {
                          const clonedSubElement = JSON.parse(JSON.stringify(se));
                          return {
                            ...clonedSubElement,
                            id: generateId(),
                            subCategoryId: sc.id,
                            linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                          };
                        });
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
                  const existingSubCatNames = (e.subCategories || []).map(sc => sc.name.toLowerCase());
                  
                  // Créer les nouvelles sous-catégories (celles de target qui n'existent pas dans source)
                  // Utiliser deep clone pour garantir la copie de toutes les propriétés
                  const newSubCategories = targetElement!.subCategories
                    .filter(sc => !existingSubCatNames.includes(sc.name.toLowerCase()))
                    .map(sc => {
                      const newSubCatId = generateId();
                      const clonedSubCategory = JSON.parse(JSON.stringify(sc));
                      return {
                        ...clonedSubCategory,
                        id: newSubCatId,
                        elementId: sourceElementId,
                        subElements: (clonedSubCategory.subElements || []).map((se: SubElement) => {
                          const clonedSubElement = JSON.parse(JSON.stringify(se));
                          return {
                            ...clonedSubElement,
                            id: generateId(),
                            subCategoryId: newSubCatId,
                            linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                          };
                        }),
                      };
                    });

                  // Fusionner les sous-éléments dans les sous-catégories existantes de même nom
                  // Utiliser deep clone pour garantir la copie de toutes les propriétés
                  const mergedSubCategories = (e.subCategories || []).map(sc => {
                    const matchingTargetSubCat = (targetElement!.subCategories || []).find(
                      tsc => tsc.name.toLowerCase() === sc.name.toLowerCase()
                    );
                    if (matchingTargetSubCat) {
                      const existingSubElNames = (sc.subElements || []).map(se => se.name.toLowerCase());
                      const newSubElements = matchingTargetSubCat.subElements
                        .filter(se => !existingSubElNames.includes(se.name.toLowerCase()))
                        .map(se => {
                          const clonedSubElement = JSON.parse(JSON.stringify(se));
                          return {
                            ...clonedSubElement,
                            id: generateId(),
                            subCategoryId: sc.id,
                            linkedGroupId: linkSubElements ? (se.linkedGroupId || se.id) : undefined,
                          };
                        });
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
    // Sauvegarde immédiate pour la copie de contenu d'élément (opération critique)
    get().triggerImmediateSave();
  },

  // Copier le contenu d'un sous-élément source vers un sous-élément cible
  copySubElementContent: (targetSubElementId: string, sourceSubElementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) return;

    // Trouver le sous-élément source
    let sourceSubElement: SubElement | null = null;
    outer: for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        for (const e of (c.elements || [])) {
          for (const sc of (e.subCategories || [])) {
            const found = (sc.subElements || []).find(se => se.id === sourceSubElementId);
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
          domains: (state.currentCockpit.domains || []).map(d => {
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
          domains: (state.currentCockpit.domains || []).map(d => {
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
          domains: (state.currentCockpit.domains || []).map(d => {
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

  // Copier tous les éléments ET catégories d'un domaine source vers un domaine cible
  // Chaque élément copié est lié à son élément source via linkedGroupId
  // Chaque sous-élément copié est lié à son sous-élément source via linkedGroupId
  // Les catégories sont également copiées (pas seulement les éléments)
  copyDomainElements: async (sourceDomainId: string, targetDomainId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) {
      return { success: false, message: 'Aucun cockpit sélectionné', copiedCount: 0, copiedCategoriesCount: 0 };
    }

    // Trouver les domaines source et cible
    const sourceDomain = (cockpit.domains || []).find(d => d.id === sourceDomainId);
    const targetDomain = (cockpit.domains || []).find(d => d.id === targetDomainId);

    if (!sourceDomain) {
      return { success: false, message: 'Domaine source introuvable', copiedCount: 0, copiedCategoriesCount: 0 };
    }
    if (!targetDomain) {
      return { success: false, message: 'Domaine cible introuvable', copiedCount: 0, copiedCategoriesCount: 0 };
    }

    // Vérifier que les domaines sont de type background ou map
    const validTypes = ['background', 'map'];
    if (!validTypes.includes(sourceDomain.templateType)) {
      return { success: false, message: 'Le domaine source doit être de type Background ou Map', copiedCount: 0, copiedCategoriesCount: 0 };
    }
    if (!validTypes.includes(targetDomain.templateType)) {
      return { success: false, message: 'Le domaine cible doit être de type Background ou Map', copiedCount: 0, copiedCategoriesCount: 0 };
    }

    // Collecter toutes les catégories et éléments du domaine source
    const sourceCategories = sourceDomain.categories || [];
    let totalElements = 0;
    for (const category of sourceCategories) {
      totalElements += (category.elements || []).length;
    }

    if (totalElements === 0) {
      return { success: false, message: 'Aucun élément à copier dans le domaine source', copiedCount: 0, copiedCategoriesCount: 0 };
    }

    // Préparer les nouvelles catégories avec leurs éléments et liaisons
    const newCategories: Category[] = [];
    const elementLinkMap: Map<string, string> = new Map(); // sourceId -> newLinkedGroupId
    const allNewElements: Element[] = []; // Pour référencer les sous-éléments lors de la mise à jour des sources

    // Récupérer l'ordre maximum des catégories existantes dans le domaine cible
    const existingMaxOrder = Math.max(0, ...(targetDomain.categories || []).map(c => c.order || 0));

    for (let catIndex = 0; catIndex < sourceCategories.length; catIndex++) {
      const sourceCategory = sourceCategories[catIndex];
      const newCategoryId = generateId();
      
      // Créer les nouveaux éléments pour cette catégorie
      const newElements: Element[] = [];
      
      for (const sourceElement of (sourceCategory.elements || [])) {
        // Générer un linkedGroupId pour la liaison (utiliser l'existant ou en créer un nouveau)
        const linkedGroupId = sourceElement.linkedGroupId || generateId();
        elementLinkMap.set(sourceElement.id, linkedGroupId);

        // Créer le nouvel élément
        const newElementId = generateId();
        const newElement: Element = {
          ...JSON.parse(JSON.stringify(sourceElement)), // Deep clone
          id: newElementId,
          categoryId: newCategoryId,
          linkedGroupId: linkedGroupId,
          // Décaler légèrement la position pour éviter la superposition
          positionX: sourceElement.positionX !== undefined ? Math.min(95, sourceElement.positionX + 2) : undefined,
          positionY: sourceElement.positionY !== undefined ? Math.min(95, sourceElement.positionY + 2) : undefined,
        };

        // Mettre à jour les sous-catégories et sous-éléments avec de nouveaux IDs et liaisons
        // Utiliser JSON.parse/stringify pour garantir une copie profonde de chaque sous-catégorie
        newElement.subCategories = (newElement.subCategories || []).map((sc: SubCategory) => {
          const newSubCategoryId = generateId();
          // Deep clone de la sous-catégorie pour éviter les problèmes de référence
          const clonedSubCategory: SubCategory = JSON.parse(JSON.stringify(sc));
          return {
            ...clonedSubCategory,
            id: newSubCategoryId,
            elementId: newElementId,
            subElements: (clonedSubCategory.subElements || []).map((se: SubElement) => {
              // Générer un linkedGroupId pour le sous-élément
              const subElementLinkedGroupId = se.linkedGroupId || generateId();
              // Deep clone du sous-élément
              const clonedSubElement: SubElement = JSON.parse(JSON.stringify(se));
              return {
                ...clonedSubElement,
                id: generateId(),
                subCategoryId: newSubCategoryId,
                linkedGroupId: subElementLinkedGroupId,
              };
            }),
          };
        });

        newElements.push(newElement);
        allNewElements.push(newElement);
      }

      // Créer la nouvelle catégorie avec ses éléments
      const newCategory: Category = {
        id: newCategoryId,
        domainId: targetDomainId,
        name: sourceCategory.name,
        icon: sourceCategory.icon,
        orientation: sourceCategory.orientation,
        order: existingMaxOrder + catIndex + 1,
        elements: newElements,
      };

      newCategories.push(newCategory);
    }

    // Appliquer les modifications
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => {
            // Mettre à jour le domaine source pour ajouter les linkedGroupId aux éléments d'origine
            if (d.id === sourceDomainId) {
              return {
                ...d,
                categories: (d.categories || []).map(c => ({
                  ...c,
                  elements: (c.elements || []).map(e => {
                    const newLinkedGroupId = elementLinkMap.get(e.id);
                    if (newLinkedGroupId && !e.linkedGroupId) {
                      // Mettre à jour aussi les sous-éléments sources avec leurs linkedGroupId
                      const newEl = allNewElements.find(ne => ne.linkedGroupId === newLinkedGroupId);
                      
                      return {
                        ...e,
                        linkedGroupId: newLinkedGroupId,
                        subCategories: (e.subCategories || []).map((sc, scIndex) => ({
                          ...sc,
                          subElements: (sc.subElements || []).map((se, seIndex) => {
                            // Trouver le sous-élément correspondant dans le nouvel élément
                            const newSubCat = newEl?.subCategories?.[scIndex];
                            const newSubEl = newSubCat?.subElements?.[seIndex];
                            if (newSubEl && !se.linkedGroupId) {
                              return { ...se, linkedGroupId: newSubEl.linkedGroupId };
                            }
                            return se;
                          }),
                        })),
                      };
                    }
                    return e;
                  }),
                })),
              };
            }

            // Ajouter les nouvelles catégories au domaine cible
            if (d.id === targetDomainId) {
              return {
                ...d,
                categories: [...(d.categories || []), ...newCategories],
              };
            }

            return d;
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });

    get().addRecentChange({ 
      type: 'domain', 
      action: 'add', 
      name: `${newCategories.length} catégorie(s) et ${totalElements} élément(s) copiés vers ${targetDomain.name}` 
    });
    // Sauvegarde immédiate pour la copie d'éléments entre domaines (opération critique)
    // IMPORTANT: await pour s'assurer que la sauvegarde est terminée avant de retourner
    await get().triggerImmediateSave();

    return { 
      success: true, 
      message: `${newCategories.length} catégorie(s) et ${totalElements} élément(s) copié(s) avec succès vers "${targetDomain.name}"`, 
      copiedCount: totalElements,
      copiedCategoriesCount: newCategories.length
    };
  },

  // Copier les sous-catégories et sous-éléments d'un élément source vers un élément cible
  // Les sous-catégories existantes dans la cible sont préservées, les nouvelles sont ajoutées
  // Chaque sous-élément copié est lié à son sous-élément source via linkedGroupId
  copyElementSubContent: async (sourceElementId: string, targetElementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) {
      return { success: false, message: 'Aucun cockpit sélectionné', copiedSubCategoriesCount: 0, copiedSubElementsCount: 0 };
    }

    // Trouver l'élément source et l'élément cible
    let sourceElement: Element | null = null;
    let targetElement: Element | null = null;

    for (const d of (cockpit.domains || [])) {
      for (const c of (d.categories || [])) {
        for (const e of (c.elements || [])) {
          if (e.id === sourceElementId) {
            sourceElement = e;
          }
          if (e.id === targetElementId) {
            targetElement = e;
          }
        }
      }
    }

    if (!sourceElement) {
      return { success: false, message: 'Élément source introuvable', copiedSubCategoriesCount: 0, copiedSubElementsCount: 0 };
    }
    if (!targetElement) {
      return { success: false, message: 'Élément cible introuvable', copiedSubCategoriesCount: 0, copiedSubElementsCount: 0 };
    }
    if (sourceElementId === targetElementId) {
      return { success: false, message: 'L\'élément source et cible sont identiques', copiedSubCategoriesCount: 0, copiedSubElementsCount: 0 };
    }

    const sourceSubCategories = sourceElement.subCategories || [];
    if (sourceSubCategories.length === 0) {
      return { success: false, message: 'Aucune sous-catégorie à copier dans l\'élément source', copiedSubCategoriesCount: 0, copiedSubElementsCount: 0 };
    }

    // Compter les sous-éléments
    let totalSubElements = 0;
    for (const sc of sourceSubCategories) {
      totalSubElements += (sc.subElements || []).length;
    }

    // Préparer les nouvelles sous-catégories avec leurs sous-éléments et liaisons
    const newSubCategories: SubCategory[] = [];
    const subElementLinkMap: Map<string, string> = new Map(); // sourceId -> newLinkedGroupId

    // Récupérer l'ordre maximum des sous-catégories existantes dans l'élément cible
    const existingMaxOrder = Math.max(0, ...(targetElement.subCategories || []).map(sc => sc.order || 0));

    for (let scIndex = 0; scIndex < sourceSubCategories.length; scIndex++) {
      const sourceSubCategory = sourceSubCategories[scIndex];
      const newSubCategoryId = generateId();

      // Créer les nouveaux sous-éléments pour cette sous-catégorie
      const newSubElements: SubElement[] = [];

      for (const sourceSubElement of (sourceSubCategory.subElements || [])) {
        // Générer un linkedGroupId pour la liaison (utiliser l'existant ou en créer un nouveau)
        const linkedGroupId = sourceSubElement.linkedGroupId || generateId();
        subElementLinkMap.set(sourceSubElement.id, linkedGroupId);

        // Créer le nouveau sous-élément avec deep clone complet
        const clonedSubElement: SubElement = JSON.parse(JSON.stringify(sourceSubElement));
        const newSubElement: SubElement = {
          ...clonedSubElement,
          id: generateId(),
          subCategoryId: newSubCategoryId,
          linkedGroupId: linkedGroupId,
        };

        newSubElements.push(newSubElement);
      }

      // Créer la nouvelle sous-catégorie avec ses sous-éléments (deep clone des propriétés)
      const clonedSubCategory = JSON.parse(JSON.stringify(sourceSubCategory));
      const newSubCategory: SubCategory = {
        ...clonedSubCategory,
        id: newSubCategoryId,
        elementId: targetElementId,
        order: existingMaxOrder + scIndex + 1,
        subElements: newSubElements,
      };

      newSubCategories.push(newSubCategory);
    }

    // Appliquer les modifications
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => ({
            ...d,
            categories: (d.categories || []).map(c => ({
              ...c,
              elements: (c.elements || []).map(e => {
                // Mettre à jour l'élément source pour ajouter les linkedGroupId aux sous-éléments d'origine
                if (e.id === sourceElementId) {
                  return {
                    ...e,
                    subCategories: (e.subCategories || []).map((sc) => ({
                      ...sc,
                      subElements: (sc.subElements || []).map((se) => {
                        const newLinkedGroupId = subElementLinkMap.get(se.id);
                        if (newLinkedGroupId && !se.linkedGroupId) {
                          return { ...se, linkedGroupId: newLinkedGroupId };
                        }
                        return se;
                      }),
                    })),
                  };
                }

                // Ajouter les nouvelles sous-catégories à l'élément cible
                if (e.id === targetElementId) {
                  return {
                    ...e,
                    subCategories: [...(e.subCategories || []), ...newSubCategories],
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

    get().addRecentChange({ 
      type: 'element', 
      action: 'add', 
      name: `${newSubCategories.length} sous-catégorie(s) copiées vers ${targetElement.name}` 
    });
    // Sauvegarde immédiate pour la copie de sous-éléments (opération critique)
    // IMPORTANT: await pour s'assurer que la sauvegarde est terminée avant de retourner
    await get().triggerImmediateSave();

    return { 
      success: true, 
      message: `${newSubCategories.length} sous-catégorie(s) et ${totalSubElements} sous-élément(s) copié(s) avec succès de "${sourceElement.name}" vers "${targetElement.name}"`, 
      copiedSubCategoriesCount: newSubCategories.length,
      copiedSubElementsCount: totalSubElements
    };
  },

  // Supprimer tous les éléments d'un domaine (avec leurs sous-catégories et sous-éléments)
  clearDomainElements: async (domainId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) {
      return { success: false, message: 'Aucun cockpit sélectionné', deletedCount: 0 };
    }

    // Trouver le domaine
    const domain = (cockpit.domains || []).find(d => d.id === domainId);
    if (!domain) {
      return { success: false, message: 'Domaine introuvable', deletedCount: 0 };
    }

    // Compter les éléments à supprimer
    let deletedCount = 0;
    for (const category of (domain.categories || [])) {
      deletedCount += (category.elements || []).length;
    }

    if (deletedCount === 0) {
      return { success: false, message: 'Aucun élément à supprimer dans ce domaine', deletedCount: 0 };
    }

    // Supprimer tous les éléments de toutes les catégories du domaine
    set((state) => {
      if (!state.currentCockpit) return state;

      return {
        currentCockpit: {
          ...state.currentCockpit,
          domains: (state.currentCockpit.domains || []).map(d => {
            if (d.id !== domainId) return d;
            
            return {
              ...d,
              categories: (d.categories || []).map(c => ({
                ...c,
                elements: [], // Vider tous les éléments
              })),
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });

    get().addRecentChange({ 
      type: 'domain', 
      action: 'delete', 
      name: `${deletedCount} éléments supprimés de ${domain.name}` 
    });
    // Sauvegarde immédiate pour la suppression d'éléments (opération critique)
    // IMPORTANT: await pour s'assurer que la sauvegarde est terminée avant de retourner
    await get().triggerImmediateSave();

    return { 
      success: true, 
      message: `${deletedCount} élément(s) supprimé(s) avec succès de "${domain.name}"`, 
      deletedCount 
    };
  },

  // Appliquer la taille d'un élément à tous les autres éléments du même domaine
  applySizeToAllElements: async (elementId: string) => {
    const cockpit = get().currentCockpit;
    if (!cockpit) {
      return { success: false, message: 'Aucun cockpit sélectionné', updatedCount: 0 };
    }

    // Trouver l'élément source et son domaine
    let sourceElement: Element | null = null;
    let sourceDomainId: string | null = null;
    let sourceDomainName: string = '';

    for (const domain of (cockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        const el = (category.elements || []).find(e => e.id === elementId);
        if (el) {
          sourceElement = el;
          sourceDomainId = domain.id;
          sourceDomainName = domain.name;
          
          // Vérifier que le domaine est de type background ou map
          if (domain.templateType !== 'background' && domain.templateType !== 'map') {
            return { success: false, message: 'Cette fonction est uniquement disponible pour les domaines Background et Map', updatedCount: 0 };
          }
          break;
        }
      }
      if (sourceElement) break;
    }

    if (!sourceElement || !sourceDomainId) {
      return { success: false, message: 'Élément source introuvable', updatedCount: 0 };
    }

    // Récupérer les valeurs de taille AVANT de faire quoi que ce soit d'autre
    const targetWidth = sourceElement.width !== undefined ? sourceElement.width : 5;
    const targetHeight = sourceElement.height !== undefined ? sourceElement.height : 5;
    const targetDomainId = sourceDomainId;
    const sourceElementId = elementId;

    // Compter les éléments à modifier
    let updateCount = 0;
    for (const domain of (cockpit.domains || [])) {
      if (domain.id !== targetDomainId) continue;
      for (const category of (domain.categories || [])) {
        for (const el of (category.elements || [])) {
          if (el.id !== sourceElementId) {
            updateCount++;
          }
        }
      }
    }

    if (updateCount === 0) {
      return { success: false, message: 'Aucun autre élément à modifier dans ce domaine', updatedCount: 0 };
    }

    // Appliquer la mise à jour en une seule opération - créer un nouvel objet cockpit complet
    const newDomains = (cockpit.domains || []).map(domain => {
      if (domain.id !== targetDomainId) {
        return domain;
      }
      
      return {
        ...domain,
        categories: (domain.categories || []).map(category => ({
          ...category,
          elements: (category.elements || []).map(element => {
            if (element.id === sourceElementId) {
              return element; // Ne pas modifier l'élément source
            }
            
            // Appliquer la nouvelle taille
            return {
              ...element,
              width: targetWidth,
              height: targetHeight,
            };
          }),
        })),
      };
    });

    const newCockpit = {
      ...cockpit,
      domains: newDomains,
      updatedAt: new Date().toISOString(),
    };

    // Mettre à jour le state avec le nouveau cockpit
    set({ currentCockpit: newCockpit });

    get().addRecentChange({ 
      type: 'element', 
      action: 'update', 
      name: `Taille appliquée à ${updateCount} élément(s)` 
    });
    // Sauvegarde immédiate pour l'application de taille à tous les éléments (opération critique)
    // IMPORTANT: await pour s'assurer que la sauvegarde est terminée avant de retourner
    await get().triggerImmediateSave();

    return { 
      success: true, 
      message: `Taille (${targetWidth}% × ${targetHeight}%) appliquée à ${updateCount} élément(s) dans "${sourceDomainName}"`, 
      updatedCount: updateCount 
    };
  },
}));


