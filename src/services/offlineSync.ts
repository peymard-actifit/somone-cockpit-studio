/**
 * Service de synchronisation offline pour le studio
 * Gère les modifications en cas de coupure réseau et les synchronise au retour
 */

import { Cockpit } from '../types';

// Types pour les opérations en queue
export interface PendingOperation {
  id: string;
  timestamp: number;
  cockpitId: string;
  type: 'update' | 'save';
  payload: any;
  retryCount: number;
}

// État de la synchronisation
export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
}

// Clé de stockage localStorage
const STORAGE_KEY = 'cockpit_offline_queue';
const COCKPIT_BACKUP_KEY = 'cockpit_backup_';
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000; // 2 secondes, multiplié exponentiellement

// Singleton du service
class OfflineSyncService {
  private queue: PendingOperation[] = [];
  private listeners: Set<(state: SyncState) => void> = new Set();
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    // Charger la queue depuis localStorage
    this.loadQueue();

    // Écouter les événements réseau
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Vérifier l'état initial
    this.isOnline = navigator.onLine;
    
    // Si on est en ligne et qu'il y a des opérations en attente, synchroniser
    if (this.isOnline && this.queue.length > 0) {
      this.scheduleSync(1000);
    }

    console.log('[OfflineSync] Service initialisé, online:', this.isOnline, 'pending:', this.queue.length);
  }

  private handleOnline = () => {
    console.log('[OfflineSync] Réseau de retour');
    this.isOnline = true;
    this.lastError = null;
    this.notifyListeners();

    // Synchroniser les opérations en attente
    if (this.queue.length > 0) {
      this.scheduleSync(500);
    }
  };

  private handleOffline = () => {
    console.log('[OfflineSync] Perte de connexion réseau');
    this.isOnline = false;
    this.notifyListeners();
  };

  private loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log('[OfflineSync] Queue chargée:', this.queue.length, 'opérations');
      }
    } catch (error) {
      console.error('[OfflineSync] Erreur chargement queue:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineSync] Erreur sauvegarde queue:', error);
    }
  }

  /**
   * Sauvegarde une copie locale du cockpit en cas de coupure
   */
  backupCockpit(cockpit: Cockpit) {
    try {
      const key = COCKPIT_BACKUP_KEY + cockpit.id;
      localStorage.setItem(key, JSON.stringify({
        cockpit,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[OfflineSync] Erreur backup cockpit:', error);
    }
  }

  /**
   * Récupère la sauvegarde locale d'un cockpit
   */
  getBackup(cockpitId: string): { cockpit: Cockpit; timestamp: number } | null {
    try {
      const key = COCKPIT_BACKUP_KEY + cockpitId;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[OfflineSync] Erreur lecture backup:', error);
    }
    return null;
  }

  /**
   * Supprime la sauvegarde locale d'un cockpit
   */
  clearBackup(cockpitId: string) {
    try {
      const key = COCKPIT_BACKUP_KEY + cockpitId;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[OfflineSync] Erreur suppression backup:', error);
    }
  }

  /**
   * Ajoute une opération à la queue
   */
  enqueue(cockpitId: string, type: 'update' | 'save', payload: any): string {
    const operation: PendingOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      cockpitId,
      type,
      payload,
      retryCount: 0,
    };

    // Optimisation : fusionner avec la dernière opération si c'est le même cockpit
    // et que l'opération précédente n'a pas encore été envoyée
    const lastOp = this.queue[this.queue.length - 1];
    if (lastOp && lastOp.cockpitId === cockpitId && lastOp.type === type) {
      // Remplacer la dernière opération par la nouvelle (plus récente)
      this.queue[this.queue.length - 1] = operation;
    } else {
      this.queue.push(operation);
    }

    this.saveQueue();
    this.notifyListeners();

    console.log('[OfflineSync] Opération ajoutée:', operation.id, 'queue:', this.queue.length);

    // Si on est en ligne, planifier la synchronisation
    if (this.isOnline && !this.isSyncing) {
      this.scheduleSync(100);
    }

    return operation.id;
  }

  /**
   * Planifie une synchronisation
   */
  private scheduleSync(delay: number) {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => this.processQueue(), delay);
  }

  /**
   * Traite la queue des opérations
   */
  private async processQueue() {
    if (!this.isOnline || this.isSyncing || this.queue.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    console.log('[OfflineSync] Début synchronisation, opérations:', this.queue.length);

    // Traiter les opérations dans l'ordre
    while (this.queue.length > 0 && this.isOnline) {
      const operation = this.queue[0];
      
      try {
        await this.executeOperation(operation);
        
        // Succès : retirer de la queue
        this.queue.shift();
        this.saveQueue();
        this.lastSyncTime = Date.now();
        this.lastError = null;
        
        console.log('[OfflineSync] Opération réussie:', operation.id, 'restant:', this.queue.length);
        
      } catch (error: any) {
        console.error('[OfflineSync] Erreur opération:', operation.id, error);
        
        // Incrémenter le compteur de retry
        operation.retryCount++;
        
        if (operation.retryCount >= MAX_RETRIES) {
          // Trop de tentatives, abandonner cette opération
          console.error('[OfflineSync] Abandon après', MAX_RETRIES, 'tentatives:', operation.id);
          this.queue.shift();
          this.saveQueue();
          this.lastError = `Échec après ${MAX_RETRIES} tentatives: ${error.message}`;
        } else {
          // Réessayer plus tard avec un délai exponentiel
          const delay = RETRY_DELAY_BASE * Math.pow(2, operation.retryCount - 1);
          this.lastError = `Erreur réseau, nouvelle tentative dans ${delay / 1000}s...`;
          this.saveQueue();
          this.isSyncing = false;
          this.notifyListeners();
          this.scheduleSync(delay);
          return;
        }
      }
      
      this.notifyListeners();
    }

    this.isSyncing = false;
    this.notifyListeners();

    console.log('[OfflineSync] Synchronisation terminée');
  }

  /**
   * Exécute une opération de synchronisation
   */
  private async executeOperation(operation: PendingOperation): Promise<void> {
    const { useAuthStore } = await import('../store/authStore');
    const token = useAuthStore.getState().token;
    
    if (!token) {
      throw new Error('Non authentifié');
    }

    const API_URL = '/api';
    
    const response = await fetch(`${API_URL}/cockpits/${operation.cockpitId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(operation.payload),
    });

    if (!response.ok) {
      // Vérifier si c'est une erreur réseau ou serveur
      if (response.status === 0 || response.status >= 500) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      // Erreur client (4xx) - ne pas réessayer
      const errorData = await response.json().catch(() => ({}));
      console.error('[OfflineSync] Erreur client:', response.status, errorData);
      
      // Pour un conflit (409), on considère que c'est "ok" - les données ont été mises à jour ailleurs
      if (response.status === 409) {
        console.warn('[OfflineSync] Conflit détecté, opération ignorée');
        return;
      }
      
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }
  }

  /**
   * Vérifie si le réseau est disponible en faisant un ping
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Force une tentative de synchronisation
   */
  async forceSync(): Promise<boolean> {
    if (this.queue.length === 0) {
      return true;
    }

    // Vérifier d'abord la connexion
    const isConnected = await this.checkConnection();
    if (!isConnected) {
      this.isOnline = false;
      this.notifyListeners();
      return false;
    }

    this.isOnline = true;
    await this.processQueue();
    return this.queue.length === 0;
  }

  /**
   * Retourne l'état actuel de la synchronisation
   */
  getState(): SyncState {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.queue.length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  /**
   * S'abonne aux changements d'état
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    // Notifier immédiatement avec l'état actuel
    listener(this.getState());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Nettoie le service (pour les tests)
   */
  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.listeners.clear();
  }
}

// Instance singleton
export const offlineSync = new OfflineSyncService();

// Hook React pour utiliser le service
export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(offlineSync.getState());

  useEffect(() => {
    return offlineSync.subscribe(setState);
  }, []);

  return state;
}

// Import React hooks pour le hook
import { useState, useEffect } from 'react';
