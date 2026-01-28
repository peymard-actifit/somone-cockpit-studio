import { createContext, useContext } from 'react';

interface ZoomContextType {
  scale: number;
  // Facteur de compensation pour garder le texte lisible
  // Quand scale < 1, on compense pour que le texte reste à minimum 100%
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
 * - Si scale >= 1 : pas de compensation (facteur = 1)
 * - Si scale < 1 : compensation = 1/scale pour maintenir la taille visuelle
 * Le facteur est limité pour éviter que le texte déborde trop des tuiles
 */
export function calculateTextCompensation(scale: number, maxCompensation: number = 2.5): number {
  if (scale >= 1) return 1;
  return Math.min(1 / scale, maxCompensation);
}
