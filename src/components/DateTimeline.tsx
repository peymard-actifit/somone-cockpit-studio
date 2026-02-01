import { useState, useMemo, useEffect, useRef } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { STATUS_COLORS, TileStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DateTimelineProps {
  onDateChange?: (date: string) => void;
  domainId?: string;
  showToggleOnly?: boolean; // Afficher uniquement le toggle (pour intégration dans panneau toggles)
  showTimelineOnly?: boolean; // Afficher uniquement les cases (pour positionnement séparé)
}

// Hauteur par défaut des cases (même hauteur que les boutons du menu)
const DEFAULT_CELL_HEIGHT = 28;
const MIN_CELL_HEIGHT = 4;

// Fonction pour formater une date selon la langue
function formatDateForLocale(dateStr: string, language: 'FR' | 'EN'): string {
  // Essayer de parser la date (format attendu: YYYY-MM-DD ou YYYYMMDD)
  let year: string, month: string, day: string;
  
  if (dateStr.includes('-')) {
    [year, month, day] = dateStr.split('-');
  } else if (dateStr.length === 8) {
    year = dateStr.slice(0, 4);
    month = dateStr.slice(4, 6);
    day = dateStr.slice(6, 8);
  } else {
    return dateStr; // Format non reconnu, retourner tel quel
  }

  if (language === 'FR') {
    return `${day}/${month}/${year}`;
  } else {
    return `${month}/${day}/${year}`;
  }
}

export default function DateTimeline({ onDateChange, domainId, showToggleOnly = false, showTimelineOnly = false }: DateTimelineProps) {
  const { currentCockpit } = useCockpitStore();
  const { t, language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>(0);
  
  // État pour montrer/cacher le timeline (persiste en localStorage)
  const storageKey = domainId ? `dateTimeline-${domainId}` : 'dateTimeline-global';
  const [showTimeline, setShowTimeline] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved === 'true';
  });

  // Mettre à jour localStorage ET émettre un événement quand l'état change
  useEffect(() => {
    localStorage.setItem(storageKey, String(showTimeline));
    // Émettre un événement pour synchroniser les autres instances
    window.dispatchEvent(new CustomEvent('dateTimelineToggle', { detail: { key: storageKey, value: showTimeline } }));
  }, [showTimeline, storageKey]);

  // Écouter les changements d'autres instances pour synchroniser l'état
  useEffect(() => {
    const handleToggleChange = (e: CustomEvent<{ key: string; value: boolean }>) => {
      if (e.detail.key === storageKey) {
        setShowTimeline(e.detail.value);
      }
    };
    window.addEventListener('dateTimelineToggle', handleToggleChange as EventListener);
    return () => window.removeEventListener('dateTimelineToggle', handleToggleChange as EventListener);
  }, [storageKey]);

  // Calculer la hauteur disponible
  useEffect(() => {
    const updateHeight = () => {
      // Hauteur de la fenêtre moins un peu de marge
      const availableHeight = window.innerHeight - 250;
      setMaxHeight(availableHeight);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Récupérer les colonnes de données historiques, triées par date (plus ancienne en premier)
  const sortedColumns = useMemo(() => {
    if (!currentCockpit?.dataHistory?.columns?.length) return [];
    
    return [...currentCockpit.dataHistory.columns].sort((a, b) => {
      // Trier par date (format YYYY-MM-DD ou autre format comparable)
      return a.date.localeCompare(b.date);
    });
  }, [currentCockpit?.dataHistory?.columns]);

  // Calculer la criticité maximale pour chaque date
  const datesCriticalities = useMemo(() => {
    if (!sortedColumns.length) return [];

    const statusPriority: Record<TileStatus, number> = {
      'fatal': 6,
      'critique': 5,
      'mineur': 4,
      'ok': 3,
      'information': 2,
      'deconnecte': 1,
      'herite': 0,
      'herite_domaine': 0,
    };

    return sortedColumns.map(column => {
      let worstStatus: TileStatus = 'ok';
      let worstPriority = 0;

      // Parcourir toutes les données de cette colonne pour trouver la pire criticité
      Object.values(column.data).forEach((data: any) => {
        const status = data.status as TileStatus;
        const priority = statusPriority[status] || 0;
        if (priority > worstPriority) {
          worstPriority = priority;
          worstStatus = status;
        }
      });

      return {
        date: column.date,
        status: worstStatus,
        color: STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex,
      };
    });
  }, [sortedColumns]);

  // Si pas de données historiques, ne rien afficher
  if (!datesCriticalities.length) {
    return null;
  }

  // Calculer la hauteur de chaque case
  const totalDates = datesCriticalities.length;
  const idealHeight = DEFAULT_CELL_HEIGHT;
  const neededHeight = totalDates * idealHeight;
  const cellHeight = neededHeight > maxHeight 
    ? Math.max(MIN_CELL_HEIGHT, maxHeight / totalDates)
    : idealHeight;

  // Date actuellement sélectionnée
  const selectedDate = currentCockpit?.selectedDataDate;

  const handleDateClick = (date: string) => {
    if (onDateChange) {
      onDateChange(date);
    }
  };

  // Mode toggle uniquement (pour intégration dans le panneau de toggles)
  if (showToggleOnly) {
    return (
      <div className="flex items-center gap-1.5">
        <MuiIcon name="Timeline" size={12} className="text-[#1E3A5F]" />
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${
            showTimeline ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
          }`}
          role="switch"
          aria-checked={showTimeline}
          title={showTimeline ? (t('dateTimeline.hide') || 'Masquer les dates') : (t('dateTimeline.show') || 'Afficher les dates')}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
              showTimeline ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    );
  }

  // Mode timeline uniquement (pour positionnement séparé sous le panneau)
  if (showTimelineOnly) {
    if (!showTimeline) return null;
    
    return (
      <div 
        ref={containerRef}
        className="bg-white rounded-lg border border-[#E2E8F0] shadow-md overflow-hidden"
        style={{ maxHeight: maxHeight }}
      >
        <div className="flex flex-col">
          {datesCriticalities.map((item, index) => {
            const isSelected = item.date === selectedDate;
            const formattedDate = formatDateForLocale(item.date, language);
            return (
              <button
                key={item.date}
                onClick={() => handleDateClick(item.date)}
                className={`w-7 transition-all hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50 ${
                  isSelected ? 'ring-2 ring-inset ring-white shadow-inner' : ''
                }`}
                style={{
                  height: cellHeight,
                  backgroundColor: item.color,
                  // Légère bordure pour séparer visuellement les dates
                  borderBottom: index < datesCriticalities.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                }}
                title={formattedDate}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Mode complet (toggle + timeline dans UN SEUL bloc) - pour les vues normales
  // Largeur fixe w-[52px] pour correspondre aux autres éléments du panneau (boutons zoom ~44px + marge)
  return (
    <div className="w-[52px] bg-white rounded-lg border border-[#E2E8F0] shadow-md overflow-hidden">
      {/* Toggle en haut du bloc - centré dans la largeur fixe */}
      <div className={`py-1.5 flex justify-center ${showTimeline ? 'border-b border-[#E2E8F0]' : ''}`}>
        <div className="flex items-center gap-1">
          <MuiIcon name="Timeline" size={10} className="text-[#1E3A5F]" />
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-1 ${
              showTimeline ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
            }`}
            role="switch"
            aria-checked={showTimeline}
            title={showTimeline ? (t('dateTimeline.hide') || 'Masquer les dates') : (t('dateTimeline.show') || 'Afficher les dates')}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                showTimeline ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Timeline des dates directement en dessous dans le même bloc */}
      {showTimeline && (
        <div 
          ref={containerRef}
          className="flex flex-col items-center"
          style={{ maxHeight: maxHeight }}
        >
          {datesCriticalities.map((item, index) => {
            const isSelected = item.date === selectedDate;
            const formattedDate = formatDateForLocale(item.date, language);
            return (
              <button
                key={item.date}
                onClick={() => handleDateClick(item.date)}
                className={`w-full transition-all hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50 ${
                  isSelected ? 'ring-2 ring-inset ring-white shadow-inner' : ''
                }`}
                style={{
                  height: cellHeight,
                  backgroundColor: item.color,
                  // Légère bordure pour séparer visuellement les dates
                  borderBottom: index < datesCriticalities.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                }}
                title={formattedDate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
