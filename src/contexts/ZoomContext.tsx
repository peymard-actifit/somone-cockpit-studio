import { createContext, useContext } from 'react';

interface ZoomContextType {
  scale: number;
  // Facteur de compensation pour garder le texte lisible
  // Quand scale < minVisualSize, on compense pour que le texte reste à minimum 50%
  textCompensation: number;
}

const ZoomContext = createContext<ZoomContextType>({
  scale: 1,
  textCompensation: 1,
});

export const ZoomProvider = ZoomContext.Provider;

export function useZoom(): ZoomContextType {
  return useContext(ZoomContext);
}

/**
 * Calcule le facteur de compensation pour le texte
 * - Si scale >= minVisualSize (50%) : pas de compensation, le texte se réduit naturellement
 * - Si scale < minVisualSize : compensation pour maintenir le texte à 50% minimum
 * 
 * Comportement :
 * - À 100% zoom : texte à 100%
 * - À 50% zoom : texte à 50% (pas de compensation)
 * - À 30% zoom : texte à 50% (compensation de ~1.67x)
 */
export function calculateTextCompensation(scale: number, minVisualSize: number = 0.50): number {
  // Si le zoom est assez grand pour que le texte reste lisible (>= 50%), pas de compensation
  if (scale >= minVisualSize) return 1;
  // Sinon, compenser pour maintenir le texte à 50% de sa taille normale
  return minVisualSize / scale;
}
