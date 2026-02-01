import { useState, useMemo, useEffect, useRef } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { STATUS_COLORS, TileStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DateTimelineProps {
  onDateChange?: (date: string) => void;
  domainId?: string;
}

// Hauteur par défaut des cases (même hauteur que les boutons du menu)
const DEFAULT_CELL_HEIGHT = 28;
const MIN_CELL_HEIGHT = 4;

export default function DateTimeline({ onDateChange, domainId }: DateTimelineProps) {
  const { currentCockpit } = useCockpitStore();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>(0);
  
  // État pour montrer/cacher le timeline (persiste en localStorage)
  const storageKey = domainId ? `dateTimeline-${domainId}` : 'dateTimeline-global';
  const [showTimeline, setShowTimeline] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved === 'true';
  });

  // Mettre à jour localStorage quand l'état change
  useEffect(() => {
    localStorage.setItem(storageKey, String(showTimeline));
  }, [showTimeline, storageKey]);

  // Calculer la hauteur disponible
  useEffect(() => {
    const updateHeight = () => {
      // Hauteur de la fenêtre moins un peu de marge
      const availableHeight = window.innerHeight - 180;
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

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Bouton toggle pour montrer/cacher le timeline */}
      <div className="bg-white rounded-lg px-2 py-1.5 border border-[#E2E8F0] shadow-md">
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
      </div>

      {/* Timeline des dates */}
      {showTimeline && (
        <div 
          ref={containerRef}
          className="bg-white rounded-lg border border-[#E2E8F0] shadow-md overflow-hidden"
          style={{ maxHeight: maxHeight }}
        >
          <div className="flex flex-col">
            {datesCriticalities.map((item, index) => {
              const isSelected = item.date === selectedDate;
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
                  title={item.date}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
