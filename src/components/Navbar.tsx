import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { useState } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDomainWorstStatus, STATUS_COLORS } from '../types';

// Composant pour un onglet de domaine sortable
function SortableDomainTab({ domain, isActive, onSelect, onDelete, domainsCount }: {
  domain: { id: string; name: string };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  domainsCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: domain.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calculer le statut le plus critique pour ce domaine
  const { currentCockpit } = useCockpitStore();
  const domainData = currentCockpit?.domains.find(d => d.id === domain.id);
  const worstStatus = domainData ? getDomainWorstStatus(domainData) : 'ok';
  const statusColor = STATUS_COLORS[worstStatus].hex;

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
        ${isActive
          ? 'bg-white text-[#1E3A5F] rounded-t-lg'
          : 'text-white hover:bg-white/10'
        }
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}
    >
      {/* Handle de drag - visible au survol */}
      <div
        {...listeners}
        className="opacity-0 group-hover:opacity-100 transition-opacity mr-1"
        onClick={(e) => e.stopPropagation()}
        title="Glisser pour réorganiser"
      >
        <MuiIcon name="GripVertical" size={14} className={isActive ? 'text-[#1E3A5F]/50' : 'text-white/50'} />
      </div>
      
      <span>{domain.name}</span>
      
      {/* Indicateur point de couleur basé sur le statut le plus critique */}
      {worstStatus !== 'ok' && (
        <div 
          className={`absolute top-1 ${domainsCount > 1 ? 'right-10' : 'right-2'} w-2.5 h-2.5 rounded-full z-10`}
          style={{ backgroundColor: statusColor }}
          title={`Statut le plus critique: ${worstStatus}`}
        />
      )}
      
      {/* Bouton supprimer - visible au survol */}
      {domainsCount > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`ml-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${
            isActive
              ? 'text-red-500 hover:bg-red-50'
              : 'text-white/70 hover:text-red-300 hover:bg-red-500/20'
          }`}
          title="Supprimer ce domaine"
        >
          <MuiIcon name="Trash2" size={14} />
        </button>
      )}
    </button>
  );
}

export default function Navbar() {
  const { currentCockpit, currentDomainId, setCurrentDomain, addDomain, deleteDomain, reorderDomains } = useCockpitStore();
  const confirm = useConfirm();
  const [isAdding, setIsAdding] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  
  if (!currentCockpit) return null;
  
  const domains = currentCockpit.domains || [];
  
  // Trier les domaines par order pour garantir l'ordre correct
  const sortedDomains = [...domains].sort((a, b) => a.order - b.order);
  
  // Capteurs pour le drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      addDomain(newDomainName.trim());
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
                  onDelete={async () => {
                    const confirmed = await confirm({
                      title: 'Supprimer le domaine',
                      message: `Voulez-vous supprimer le domaine "${domain.name}" et tout son contenu ?`,
                    });
                    if (confirmed) {
                      deleteDomain(domain.id);
                    }
                  }}
                  domainsCount={domains.length}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        {/* Bouton ajouter domaine */}
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-5 py-3 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <MuiIcon name="Plus" size={16} />
            <span className="text-sm font-medium">Ajouter</span>
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
              <MuiIcon name="Plus" size={16} />
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewDomainName('');
              }}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
            >
              <MuiIcon name="X" size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
