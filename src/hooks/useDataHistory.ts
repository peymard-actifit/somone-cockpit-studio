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

    // Si pas de cockpit, pas de date sélectionnée, ou pas d'historique, utiliser les données actuelles
    if (!cockpit?.selectedDataDate || !cockpit?.dataHistory?.columns?.length) {
      return defaultData;
    }

    // Trouver la colonne correspondant à la date sélectionnée
    const selectedColumn = cockpit.dataHistory.columns.find(
      col => col.date === cockpit.selectedDataDate
    );

    if (!selectedColumn) {
      return defaultData;
    }

    // Chercher les données du sous-élément
    // D'abord par linkedGroupId si le sous-élément est lié
    const key = subElement.linkedGroupId || subElement.id;
    const historicalData = selectedColumn.data[key];

    if (!historicalData) {
      return defaultData;
    }

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
