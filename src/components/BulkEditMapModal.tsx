import { useState, useEffect, useRef } from 'react';
import type { MapElement, TileStatus } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';
import { useCockpitStore } from '../store/cockpitStore';

interface BulkEditMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapElements: MapElement[];
}

export default function BulkEditMapModal({ isOpen, onClose, mapElements }: BulkEditMapModalProps) {
  const { updateMapElement } = useCockpitStore();
  const [searchTerm, setSearchTerm] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Filtrer les éléments par recherche
  const filteredElements = mapElements.filter(el => 
    el.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const statuses: TileStatus[] = ['ok', 'information', 'mineur', 'critique', 'fatal', 'deconnecte'];

  // Icônes populaires pour sélection rapide
  const popularIcons = [
    'Store', 'Building', 'Factory', 'Warehouse', 'Home',
    'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart',
    'Server', 'Database', 'Wifi', 'AlertTriangle', 'Shield',
  ];

  const handleUpdate = (elementId: string, updates: Partial<MapElement>) => {
    updateMapElement(elementId, updates);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixe */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F5F7FA] flex-shrink-0">
          <div className="flex items-center gap-3">
            <MuiIcon name="Edit" size={20} className="text-[#1E3A5F]" />
            <h3 className="text-lg font-semibold text-[#1E3A5F]">
              Édition en masse ({mapElements.length} points)
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MuiIcon name="Search" size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1E3A5F] w-48"
              />
            </div>
            <button 
              onClick={onClose} 
              className="flex items-center gap-1 px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors text-sm"
            >
              <MuiIcon name="Check" size={16} />
              Fermer
            </button>
          </div>
        </div>

        {/* En-têtes de colonnes */}
        <div className="grid grid-cols-[2fr_100px_80px_100px_100px] gap-2 px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] flex-shrink-0">
          <div>Nom</div>
          <div>Statut</div>
          <div>Icône</div>
          <div>Latitude</div>
          <div>Longitude</div>
        </div>

        {/* Liste des éléments avec scroll */}
        <div className="flex-1 overflow-y-auto">
          {filteredElements.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#94A3B8]">
              Aucun point trouvé
            </div>
          ) : (
            filteredElements.map((element) => (
              <BulkEditMapRow
                key={element.id}
                element={element}
                statuses={statuses}
                popularIcons={popularIcons}
                onUpdate={handleUpdate}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B] flex-shrink-0">
          💡 Toutes les modifications sont sauvegardées automatiquement
        </div>
      </div>
    </div>
  );
}

// Composant ligne pour un élément
interface BulkEditMapRowProps {
  element: MapElement;
  statuses: TileStatus[];
  popularIcons: string[];
  onUpdate: (elementId: string, updates: Partial<MapElement>) => void;
}

function BulkEditMapRow({ element, statuses, popularIcons, onUpdate }: BulkEditMapRowProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const colors = STATUS_COLORS[element.status];

  return (
    <div className="grid grid-cols-[2fr_100px_80px_100px_100px] gap-2 px-4 py-1.5 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] items-center text-sm">
      {/* Nom */}
      <input
        type="text"
        value={element.name}
        onChange={(e) => onUpdate(element.id, { name: e.target.value })}
        className="px-2 py-1 border border-transparent hover:border-[#E2E8F0] focus:border-[#1E3A5F] rounded text-[#1E3A5F] focus:outline-none bg-transparent"
      />

      {/* Statut */}
      <div className="relative">
        <select
          value={element.status}
          onChange={(e) => onUpdate(element.id, { status: e.target.value as TileStatus })}
          className="w-full px-2 py-1 border border-[#E2E8F0] rounded text-xs focus:outline-none focus:border-[#1E3A5F] appearance-none cursor-pointer"
          style={{ 
            backgroundColor: colors.hex + '20',
            color: colors.hex
          }}
        >
          {statuses.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Icône */}
      <div className="relative">
        <button
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="w-full px-2 py-1 border border-[#E2E8F0] rounded flex items-center justify-center hover:bg-[#F5F7FA]"
        >
          <MuiIcon name={element.icon || 'MapPin'} size={16} className="text-[#1E3A5F]" />
        </button>
        {showIconPicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 w-40">
            {popularIcons.map(icon => (
              <button
                key={icon}
                onClick={() => {
                  onUpdate(element.id, { icon });
                  setShowIconPicker(false);
                }}
                className={`p-1.5 rounded hover:bg-[#F5F7FA] ${element.icon === icon ? 'bg-[#E2E8F0]' : ''}`}
                title={icon}
              >
                <MuiIcon name={icon} size={16} className="text-[#1E3A5F]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Latitude */}
      <input
        type="number"
        step="0.000001"
        value={element.gps.lat}
        onChange={(e) => onUpdate(element.id, { gps: { ...element.gps, lat: parseFloat(e.target.value) || 0 } })}
        className="px-2 py-1 border border-transparent hover:border-[#E2E8F0] focus:border-[#1E3A5F] rounded text-[#1E3A5F] focus:outline-none bg-transparent text-center text-xs"
      />

      {/* Longitude */}
      <input
        type="number"
        step="0.000001"
        value={element.gps.lng}
        onChange={(e) => onUpdate(element.id, { gps: { ...element.gps, lng: parseFloat(e.target.value) || 0 } })}
        className="px-2 py-1 border border-transparent hover:border-[#E2E8F0] focus:border-[#1E3A5F] rounded text-[#1E3A5F] focus:outline-none bg-transparent text-center text-xs"
      />
    </div>
  );
}
