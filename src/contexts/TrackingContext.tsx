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
    if (!enabled || !publicId) return;
    
    // Appel API non bloquant
    fetch(`/api/public/track/${publicId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, ...extra })
    }).catch(() => {}); // Silencieux en cas d'erreur
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
