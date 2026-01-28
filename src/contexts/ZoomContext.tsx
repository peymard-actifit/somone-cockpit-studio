import { createContext, useContext } from 'react';

interface ZoomContextType {
  scale: number;
  // Facteur de compensation pour garder le texte lisible
  // Quand scale < minVisualSize, on compense pour que le texte reste à minimum 75%
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
 * - Si scale >= minVisualSize (75%) : pas de compensation, le texte se réduit naturellement
 * - Si scale < minVisualSize : compensation pour maintenir le texte à 75% minimum
 * 
 * Comportement :
 * - À 100% zoom : texte à 100%
 * - À 75% zoom : texte à 75% (pas de compensation)
 * - À 50% zoom : texte à 75% (compensation de 1.5x)
 * - À 30% zoom : texte à 75% (compensation de 2.5x)
 */
export function calculateTextCompensation(scale: number, minVisualSize: number = 0.75): number {
  // Si le zoom est assez grand pour que le texte reste lisible (>= 75%), pas de compensation
  if (scale >= minVisualSize) return 1;
  // Sinon, compenser pour maintenir le texte à 75% de sa taille normale
  return minVisualSize / scale;
}
