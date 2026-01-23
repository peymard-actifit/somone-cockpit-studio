import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDomainWorstStatus, STATUS_COLORS } from '../types';
import { useSyncState, offlineSync } from '../services/offlineSync';

// Clés pour les préférences d'affichage des onglets
const DOMAIN_TAB_COLOR_MODE_KEY = 'domainTabColorMode';
const DOMAIN_TAB_ICON_KEY = 'domainTabStatusIcon';

// Composant pour un onglet de domaine sortable
function SortableDomainTab({ domain, isActive, onSelect, colorMode, statusIcon }: {
  domain: { id: string; name: string };
  isActive: boolean;
  onSelect: () => void;
  colorMode: 'dot' | 'square' | 'full' | 'border' | 'icon' | 'corner'; // 'dot' = pastille ronde, 'square' = pastille carrée, 'full' = onglet coloré, 'border' = bordure 3 côtés, 'icon' = icône colorée, 'corner' = pastille haut-droite discrète
  statusIcon: string; // Icône à afficher pour le mode 'icon'
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: domain.id });

  // Calculer le statut le plus critique pour ce domaine - protection pour les tableaux
  const { currentCockpit } = useCockpitStore();
  const cockpitDomains = currentCockpit?.domains || [];
  const domainData = cockpitDomains.find(d => d.id === domain.id);
  // Passer tous les domaines pour le calcul récursif (éléments avec status herite_domaine)
  const worstStatus = domainData ? getDomainWorstStatus(domainData, cockpitDomains) : 'ok';
  // Protection: vérifier que STATUS_COLORS[worstStatus] existe avant d'accéder à .hex
  const statusColor = STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex;
  const hasAlert = worstStatus !== 'ok' && worstStatus !== undefined;

  // Style de base pour le drag
  const baseStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Ajouter les styles en fonction du mode
  let style: React.CSSProperties = baseStyle;
  if (colorMode === 'full' && hasAlert) {
    style = { ...baseStyle, backgroundColor: isActive ? statusColor : `${statusColor}CC` };
  } else if (colorMode === 'border' && hasAlert) {
    // Bordure sur 3 côtés (gauche, haut, droite) - pas en bas pour effet onglet
    style = {
      ...baseStyle,
      borderLeft: `3px solid ${statusColor}`,
      borderTop: `3px solid ${statusColor}`,
      borderRight: `3px solid ${statusColor}`,
      borderBottom: 'none',
    };
  }
  // Mode 'icon' n'a pas besoin de styles spéciaux sur le conteneur

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={onSelect}
      className={`
        group relative flex items-center gap-2 px-6 py-3 
        text-sm font-semibold
        transition-all duration-200
        ${colorMode === 'full' && hasAlert
          ? (isActive ? 'text-white rounded-t-lg' : 'text-white hover:brightness-110')
          : colorMode === 'border' && hasAlert
            ? (isActive ? 'bg-white text-[#1E3A5F] rounded-t-lg' : 'text-white hover:bg-white/10 rounded-t-lg')
            : (isActive ? 'bg-white text-[#1E3A5F] rounded-t-lg' : 'text-white hover:bg-white/10')
        }
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}
    >
      {/* Pastille discrète en haut à droite - mode 'corner' */}
      {colorMode === 'corner' && hasAlert && (
        <div
          className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full shadow-sm border border-white/40"
          style={{ backgroundColor: statusColor }}
          title={`Statut le plus critique: ${worstStatus}`}
        />
      )}

      {/* Pastille ronde à gauche - mode 'dot' uniquement */}
      {colorMode === 'dot' && hasAlert && (
        <div
          className="w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 border-white/50 shadow-sm"
          style={{ backgroundColor: statusColor }}
          title={`Statut le plus critique: ${worstStatus}`}
        />
      )}

      {/* Pastille carrée à gauche - mode 'square' uniquement */}
      {colorMode === 'square' && hasAlert && (
        <div
          className="w-3.5 h-3.5 rounded-sm flex-shrink-0 border-2 border-white/50 shadow-sm"
          style={{ backgroundColor: statusColor }}
          title={`Statut le plus critique: ${worstStatus}`}
        />
      )}

      {/* Icône colorée à gauche - mode 'icon' uniquement */}
      {colorMode === 'icon' && hasAlert && (
        <div
          className="flex-shrink-0"
          style={{ color: statusColor }}
          title={`Statut le plus critique: ${worstStatus}`}
        >
          <MuiIcon name={statusIcon || 'Warning'} size={18} />
        </div>
      )}

      {/* Handle de drag - visible au survol */}
      <div
        {...listeners}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        title="Glisser pour réorganiser"
      >
        <MuiIcon
          name="DragIndicator"
          size={14}
          className={colorMode === 'full' && hasAlert ? 'text-white/50' : (isActive ? 'text-[#1E3A5F]/50' : 'text-white/50')}
        />
      </div>

      <span>{domain.name}</span>
    </button>
  );
}

// Composant indicateur de synchronisation
function SyncIndicator() {
  const syncState = useSyncState();
  
  // Si tout est ok, ne rien afficher
  if (syncState.isOnline && syncState.pendingCount === 0 && !syncState.isSyncing) {
    return null;
  }

  // Déterminer l'état et les couleurs
  let bgColor = 'bg-green-500';
  let icon = 'CloudDone';
  let tooltip = 'Synchronisé';
  let animate = false;

  if (!syncState.isOnline) {
    bgColor = 'bg-orange-500';
    icon = 'CloudOff';
    tooltip = `Hors ligne - ${syncState.pendingCount} modification${syncState.pendingCount > 1 ? 's' : ''} en attente`;
    animate = syncState.pendingCount > 0;
  } else if (syncState.isSyncing) {
    bgColor = 'bg-blue-500';
    icon = 'CloudSync';
    tooltip = `Synchronisation en cours... (${syncState.pendingCount})`;
    animate = true;
  } else if (syncState.pendingCount > 0) {
    bgColor = 'bg-yellow-500';
    icon = 'CloudQueue';
    tooltip = `${syncState.pendingCount} modification${syncState.pendingCount > 1 ? 's' : ''} en attente`;
    animate = true;
  }

  return (
    <div 
      className={`flex items-center gap-1.5 px-3 py-1.5 ${bgColor} rounded-lg mr-2 cursor-pointer transition-all hover:opacity-90`}
      title={tooltip}
      onClick={() => {
        if (syncState.isOnline && syncState.pendingCount > 0) {
          offlineSync.forceSync();
        }
      }}
    >
      <MuiIcon 
        name={icon as any} 
        size={14} 
        className={`text-white ${animate ? 'animate-pulse' : ''}`} 
      />
      {syncState.pendingCount > 0 && (
        <span className="text-xs font-medium text-white">
          {syncState.pendingCount}
        </span>
      )}
    </div>
  );
}

export default function Navbar() {
  const { currentCockpit, currentDomainId, setCurrentDomain, addDomain, reorderDomains } = useCockpitStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');

  // Préférence pour le mode de coloration des onglets
  const [domainTabColorMode, setDomainTabColorMode] = useState<'dot' | 'square' | 'full' | 'border' | 'icon' | 'corner'>(() => {
    const saved = localStorage.getItem(DOMAIN_TAB_COLOR_MODE_KEY);
    if (saved === 'square' || saved === 'full' || saved === 'border' || saved === 'icon' || saved === 'corner') return saved as 'dot' | 'square' | 'full' | 'border' | 'icon' | 'corner';
    return 'dot';
  });

  // Préférence pour l'icône de statut
  const [domainTabStatusIcon, setDomainTabStatusIcon] = useState<string>(() => {
    return localStorage.getItem(DOMAIN_TAB_ICON_KEY) || 'Warning';
  });

  // Écouter les changements de préférence depuis EditorPanel
  useEffect(() => {
    const handlePreferenceChange = () => {
      const saved = localStorage.getItem(DOMAIN_TAB_COLOR_MODE_KEY);
      if (saved === 'square' || saved === 'full' || saved === 'border' || saved === 'icon' || saved === 'corner') {
        setDomainTabColorMode(saved as 'dot' | 'square' | 'full' | 'border' | 'icon' | 'corner');
      } else {
        setDomainTabColorMode('dot');
      }
      // Mettre à jour l'icône
      const savedIcon = localStorage.getItem(DOMAIN_TAB_ICON_KEY);
      setDomainTabStatusIcon(savedIcon || 'Warning');
    };
    window.addEventListener('domainTabColorModeChanged', handlePreferenceChange);
    return () => window.removeEventListener('domainTabColorModeChanged', handlePreferenceChange);
  }, []);

  // ============================================================================
  // HOOKS POUR LE DRAG AND DROP - DOIVENT ÊTRE DÉCLARÉS AVANT TOUT RETURN CONDITIONNEL
  // (Règle #300 de React : les hooks doivent être appelés dans le même ordre à chaque rendu)
  // ============================================================================
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Return conditionnel - APRÈS tous les hooks
  if (!currentCockpit) return null;

  const domains = currentCockpit.domains || [];

  // Trier les domaines par order pour garantir l'ordre correct
  const sortedDomains = [...domains].sort((a, b) => a.order - b.order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedDomains.findIndex(d => d.id === active.id);
      const newIndex = sortedDomains.findIndex(d => d.id === over.id);

      const newOrder = arrayMove(sortedDomains, oldIndex, newIndex);
      reorderDomains(newOrder.map(d => d.id));
    }
  };

  const handleAddDomain = () => {
    if (newDomainName.trim()) {
      addDomain(newDomainName.trim(), 'standard');
      setNewDomainName('');

      setIsAdding(false);
    }
  };

  return (
    <nav className="bg-[#1E3A5F]">
      <div className="flex items-center">
        {/* Domaines - Style bandeau PDF SOMONE avec drag and drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedDomains.map(d => d.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-center flex-1">
              {sortedDomains.map((domain) => (
                <SortableDomainTab
                  key={domain.id}
                  domain={domain}
                  isActive={currentDomainId === domain.id}
                  onSelect={() => setCurrentDomain(domain.id)}
                  colorMode={domainTabColorMode}
                  statusIcon={domainTabStatusIcon}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Indicateur de synchronisation */}
        <SyncIndicator />

        {/* Bouton ajouter domaine */}
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-5 py-3 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <MuiIcon name="Tab" size={16} />
            <span className="text-sm font-medium">+ Domaine</span>
          </button>
        )}

        {/* Input nouveau domaine */}
        {isAdding && (
          <div className="flex items-center gap-2 px-4 py-2">
            <input
              type="text"
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddDomain();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewDomainName('');

                }
              }}
              placeholder="Nom du domaine"
              className="px-3 py-1.5 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/60 w-40"
              autoFocus
            />

            <button
              onClick={handleAddDomain}
              className="p-1.5 bg-white text-[#1E3A5F] hover:bg-white/90 rounded-lg transition-colors"
            >
              <MuiIcon name="Check" size={16} />
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewDomainName('');
              }}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
            >
              <MuiIcon name="Close" size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
