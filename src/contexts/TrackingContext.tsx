import { createContext, useContext, useCallback, ReactNode } from 'react';

type TrackEventType = 'click' | 'page' | 'element' | 'subElement';

interface TrackingContextType {
  trackEvent: (eventType: TrackEventType, extra?: { elementId?: string; subElementId?: string; domainId?: string }) => void;
  isTracking: boolean;
}

const TrackingContext = createContext<TrackingContextType>({
  trackEvent: () => {},
  isTracking: false,
});

interface TrackingProviderProps {
  children: ReactNode;
  publicId?: string;
  enabled?: boolean;
}

export function TrackingProvider({ children, publicId, enabled = false }: TrackingProviderProps) {
  const trackEvent = useCallback((eventType: TrackEventType, extra?: { elementId?: string; subElementId?: string; domainId?: string }) => {
    if (!enabled || !publicId) {
      console.log(`[Tracking] Skip: enabled=${enabled}, publicId=${publicId}`);
      return;
    }
    
    console.log(`[Tracking] Envoi: type=${eventType}`, extra);
    
    // Appel API non bloquant
    fetch(`/api/public/track/${publicId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, ...extra })
    }).then(res => {
      console.log(`[Tracking] Réponse: ${res.status}`);
    }).catch(err => {
      console.error('[Tracking] Erreur:', err);
    });
  }, [enabled, publicId]);

  return (
    <TrackingContext.Provider value={{ trackEvent, isTracking: enabled }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  return useContext(TrackingContext);
}
