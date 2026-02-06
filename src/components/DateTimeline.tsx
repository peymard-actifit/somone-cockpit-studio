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

// Configuration de la timeline
const MAX_VISIBLE_CELLS = 15; // Maximum 15 cases visibles
const ARROW_HEIGHT = 24; // Hauteur fixe des flèches
const MIN_CELL_HEIGHT = 16; // Hauteur minimum d'une case
const TIMELINE_PADDING = 4; // Padding vertical du conteneur

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
  const [availableHeight, setAvailableHeight] = useState<number>(0);
  const [scrollOffset, setScrollOffset] = useState(0); // Index de la première case visible
  
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

  // Calculer la hauteur disponible pour la timeline
  useEffect(() => {
    const updateHeight = () => {
      // Hauteur de la fenêtre moins les marges (header, padding, etc.)
      const windowHeight = window.innerHeight;
      // Marge totale : header (~105px) + padding bas (~20px) + toggle (~40px) + marge sécurité (~35px)
      const totalMargin = 200;
      setAvailableHeight(Math.max(200, windowHeight - totalMargin));
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

  // Calculer le nombre de cases visibles et leur hauteur
  const totalDates = datesCriticalities.length;
  const needsScrolling = totalDates > MAX_VISIBLE_CELLS;
  const visibleCellsCount = Math.min(totalDates, MAX_VISIBLE_CELLS);
  
  // Calculer la hauteur disponible pour les cases (entre les flèches)
  const arrowsHeight = needsScrolling ? ARROW_HEIGHT * 2 : 0;
  const cellsContainerHeight = availableHeight - arrowsHeight - TIMELINE_PADDING * 2;
  const cellHeight = Math.max(MIN_CELL_HEIGHT, Math.floor(cellsContainerHeight / visibleCellsCount));
  
  // Cases visibles (avec défilement)
  const visibleCells = needsScrolling
    ? datesCriticalities.slice(scrollOffset, scrollOffset + visibleCellsCount)
    : datesCriticalities;
  
  // Vérifier si on peut défiler
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + visibleCellsCount < totalDates;

  // Date actuellement sélectionnée
  const selectedDate = currentCockpit?.selectedDataDate;

  const handleDateClick = (date: string) => {
    if (onDateChange) {
      onDateChange(date);
    }
  };

  // Fonctions de défilement
  const scrollUp = () => {
    if (canScrollUp) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    }
  };

  const scrollDown = () => {
    if (canScrollDown) {
      setScrollOffset(Math.min(totalDates - visibleCellsCount, scrollOffset + 1));
    }
  };

  // Rendu d'une flèche
  const renderArrow = (direction: 'up' | 'down', enabled: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`w-7 flex items-center justify-center transition-colors ${
        enabled 
          ? 'bg-[#1E3A5F] hover:bg-[#2D4A6F] text-white cursor-pointer' 
          : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
      }`}
      style={{ height: ARROW_HEIGHT }}
      title={direction === 'up' ? 'Dates plus anciennes' : 'Dates plus récentes'}
    >
      <MuiIcon name={direction === 'up' ? 'KeyboardArrowUp' : 'KeyboardArrowDown'} size={16} />
    </button>
  );

  // Rendu des cases de la timeline
  const renderCells = () => (
    <div className="flex flex-col">
      {visibleCells.map((item, index) => {
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
              borderBottom: index < visibleCells.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
            }}
            title={formattedDate}
          />
        );
      })}
    </div>
  );

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
        style={{ maxHeight: availableHeight }}
      >
        <div className="flex flex-col">
          {/* Flèche haut (si défilement nécessaire) */}
          {needsScrolling && renderArrow('up', canScrollUp, scrollUp)}
          
          {/* Cases de la timeline */}
          {renderCells()}
          
          {/* Flèche bas (si défilement nécessaire) */}
          {needsScrolling && renderArrow('down', canScrollDown, scrollDown)}
        </div>
      </div>
    );
  }

  // Mode complet (toggle + timeline dans UN SEUL bloc) - pour les vues normales
  // Aligné à droite avec cases w-7 (28px) identiques à Map/Background
  return (
    <div className="flex flex-col items-end gap-3">
      {/* Toggle dans son propre bloc - aligné à droite */}
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

      {/* Timeline des dates - bloc séparé aligné à droite, identique à Map/Background */}
      {showTimeline && (
        <div 
          ref={containerRef}
          className="bg-white rounded-lg border border-[#E2E8F0] shadow-md overflow-hidden"
          style={{ maxHeight: availableHeight }}
        >
          <div className="flex flex-col">
            {/* Flèche haut (si défilement nécessaire) */}
            {needsScrolling && renderArrow('up', canScrollUp, scrollUp)}
            
            {/* Cases de la timeline */}
            {renderCells()}
            
            {/* Flèche bas (si défilement nécessaire) */}
            {needsScrolling && renderArrow('down', canScrollDown, scrollDown)}
          </div>
        </div>
      )}
    </div>
  );
}
