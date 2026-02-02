// SOMONE Cockpit Studio - Utilitaires de statut
// Extraction depuis cockpitStore.ts pour réutilisation

import type { TileStatus } from '../../types';

/**
 * Ordre de criticité des statuts (du moins critique au plus critique)
 */
export const STATUS_PRIORITY: Record<TileStatus, number> = {
  'ok': 0,
  'information': 1,
  'herite': 2,
  'herite_domaine': 2,
  'deconnecte': 3,
  'mineur': 4,
  'critique': 5,
  'fatal': 6,
};

/**
 * Obtenir le statut le plus critique entre deux statuts
 */
export const getMostCriticalStatus = (status1: TileStatus, status2: TileStatus): TileStatus => {
  const priority1 = STATUS_PRIORITY[status1] ?? 0;
  const priority2 = STATUS_PRIORITY[status2] ?? 0;
  return priority1 >= priority2 ? status1 : status2;
};

/**
 * Vérifier si un statut est critique (mineur, critique ou fatal)
 */
export const isCriticalStatus = (status: TileStatus): boolean => {
  return STATUS_PRIORITY[status] >= STATUS_PRIORITY['mineur'];
};

/**
 * Obtenir la couleur associée à un statut
 */
export const getStatusColor = (status: TileStatus): string => {
  const colors: Record<TileStatus, string> = {
    'ok': '#22c55e',           // green-500
    'information': '#3b82f6',   // blue-500
    'herite': '#a855f7',        // purple-500
    'herite_domaine': '#a855f7', // purple-500
    'deconnecte': '#6b7280',    // gray-500
    'mineur': '#eab308',        // yellow-500
    'critique': '#f97316',      // orange-500
    'fatal': '#ef4444',         // red-500
  };
  return colors[status] || colors['ok'];
};

/**
 * Obtenir le label français d'un statut
 */
export const getStatusLabel = (status: TileStatus): string => {
  const labels: Record<TileStatus, string> = {
    'ok': 'OK',
    'information': 'Information',
    'herite': 'Hérité',
    'herite_domaine': 'Hérité domaine',
    'deconnecte': 'Déconnecté',
    'mineur': 'Mineur',
    'critique': 'Critique',
    'fatal': 'Fatal',
  };
  return labels[status] || status;
};
