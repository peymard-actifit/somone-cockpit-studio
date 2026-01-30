import { useMemo } from 'react';
import type { Cockpit, SubElement, TileStatus, SubElementDataSnapshot } from '../types';

interface HistoricalData {
  status: TileStatus;
  value?: string;
  unit?: string;
  alertDescription?: string;
  isFromHistory: boolean; // true si les données viennent de l'historique
}

/**
 * Hook pour récupérer les données d'un sous-élément selon la date sélectionnée
 * Si une date est sélectionnée dans le cockpit et que des données historiques existent,
 * elles seront retournées à la place des données actuelles du sous-élément.
 */
export function useSubElementData(
  subElement: SubElement,
  cockpit: Cockpit | null | undefined
): HistoricalData {
  return useMemo(() => {
    // Données par défaut (actuelles)
    const defaultData: HistoricalData = {
      status: subElement.status,
      value: subElement.value,
      unit: subElement.unit,
      alertDescription: subElement.alert?.description,
      isFromHistory: false,
    };

    // Si pas de cockpit ou pas d'historique, utiliser les données actuelles
    if (!cockpit?.dataHistory?.columns?.length) {
      // Log uniquement si le cockpit existe mais pas de dataHistory
      if (cockpit && !cockpit.dataHistory) {
        console.log(`[useSubElementData] Cockpit "${cockpit.name}" sans dataHistory`);
      }
      return defaultData;
    }

    // Utiliser la date sélectionnée ou la dernière date disponible par défaut
    const activeDate = cockpit.selectedDataDate || cockpit.dataHistory.columns[cockpit.dataHistory.columns.length - 1]?.date;
    
    if (!activeDate) {
      return defaultData;
    }

    // Trouver la colonne correspondant à la date active
    const selectedColumn = cockpit.dataHistory.columns.find(
      col => col.date === activeDate
    );

    if (!selectedColumn) {
      console.log(`[useSubElementData] Colonne non trouvée pour date ${activeDate}`);
      return defaultData;
    }

    // Chercher les données du sous-élément
    // D'abord par linkedGroupId si le sous-élément est lié
    const key = subElement.linkedGroupId || subElement.id;
    const historicalData = selectedColumn.data[key];

    if (!historicalData) {
      // Log pour debug - chercher dans toutes les clés disponibles
      const availableKeys = Object.keys(selectedColumn.data);
      console.log(`[useSubElementData] SE "${subElement.name}" (key: ${key}) non trouvé. Clés disponibles: ${availableKeys.slice(0, 5).join(', ')}${availableKeys.length > 5 ? '...' : ''}`);
      return defaultData;
    }

    // Log succès
    console.log(`[useSubElementData] SE "${subElement.name}" trouvé avec description: "${historicalData.alertDescription || 'none'}"`);

    // Retourner les données historiques
    return {
      status: historicalData.status,
      value: historicalData.value,
      unit: historicalData.unit,
      alertDescription: historicalData.alertDescription,
      isFromHistory: true,
    };
  }, [subElement, cockpit?.selectedDataDate, cockpit?.dataHistory]);
}

/**
 * Hook pour récupérer toutes les données historiques d'un sous-élément
 * Retourne un tableau de toutes les dates avec leurs données
 */
export function useSubElementHistory(
  subElement: SubElement,
  cockpit: Cockpit | null | undefined
): Array<{ date: string; label?: string; data: SubElementDataSnapshot }> {
  return useMemo(() => {
    if (!cockpit?.dataHistory?.columns?.length) {
      return [];
    }

    const key = subElement.linkedGroupId || subElement.id;
    
    return cockpit.dataHistory.columns
      .filter(col => col.data[key])
      .map(col => ({
        date: col.date,
        label: col.label,
        data: col.data[key],
      }));
  }, [subElement, cockpit?.dataHistory]);
}
