import { useState, useMemo } from 'react';
import { ICONS, ICON_NAMES } from './icons';

// Composant SVG pour afficher une icône
interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function MuiIcon({ name, size = 24, className = '' }: IconProps) {
  const path = ICONS[name];
  
  if (!path) {
    return (
      <div 
        className={`rounded-full bg-slate-400 ${className}`} 
        style={{ width: size * 0.6, height: size * 0.6 }} 
      />
    );
  }
  
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size} 
      height={size} 
      fill="currentColor"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

interface IconPickerProps {
  value: string | undefined;
  onChange: (iconName: string | undefined) => void;
  onClose: () => void;
}

export default function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');
  
  const filteredIcons = useMemo(() => {
    if (!search) return ICON_NAMES;
    const searchLower = search.toLowerCase();
    return ICON_NAMES.filter(name => name.toLowerCase().includes(searchLower));
  }, [search]);
  
  // Catégories d'icônes populaires
  const categories = [
    { name: 'Alertes', icons: ['Warning', 'Error', 'Info', 'CheckCircle', 'Cancel', 'Report'] },
    { name: 'Transport', icons: ['Flight', 'DirectionsCar', 'Train', 'DirectionsBoat', 'LocalShipping'] },
    { name: 'Technique', icons: ['Build', 'Engineering', 'Bolt', 'Speed', 'Thermostat', 'BatteryFull'] },
    { name: 'Réseau', icons: ['Wifi', 'Cloud', 'Router', 'Storage', 'Computer', 'Smartphone'] },
    { name: 'Sécurité', icons: ['Security', 'Shield', 'Lock', 'Key', 'Visibility', 'Fingerprint'] },
  ];
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Choisir une icône</h3>
            <p className="text-xs text-slate-500">{ICON_NAMES.length} icônes Material Design</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <MuiIcon name="X" size={20} />
          </button>
        </div>
        
        {/* Recherche */}
        <div className="px-5 py-3 border-b border-slate-700">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <MuiIcon name="SearchIcon" size={20} />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une icône..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          
          {value && (
            <button
              onClick={() => {
                onChange(undefined);
                onClose();
              }}
              className="mt-3 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Supprimer l'icône actuelle
            </button>
          )}
        </div>
        
        {/* Icône sélectionnée */}
        {value && ICONS[value] && (
          <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/50">
            <p className="text-xs text-slate-500 mb-2">Icône actuelle</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                <MuiIcon name={value} size={28} />
              </div>
              <span className="text-white font-medium">{value}</span>
            </div>
          </div>
        )}
        
        {/* Catégories populaires (si pas de recherche) */}
        {!search && (
          <div className="px-5 py-3 border-b border-slate-700">
            <p className="text-xs text-slate-500 mb-3">Catégories populaires</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.name} className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg">
                  <span className="text-xs text-slate-400">{cat.name}:</span>
                  {cat.icons.slice(0, 4).map((iconName) => (
                    <button
                      key={iconName}
                      onClick={() => {
                        onChange(iconName);
                        onClose();
                      }}
                      className="p-1.5 text-slate-300 hover:bg-slate-700 rounded transition-colors"
                      title={iconName}
                    >
                      <MuiIcon name={iconName} size={18} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Grille d'icônes */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredIcons.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              Aucune icône trouvée pour "{search}"
            </p>
          ) : (
            <div className="grid grid-cols-8 gap-2">
              {filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => {
                    onChange(iconName);
                    onClose();
                  }}
                  className={`
                    p-3 rounded-xl transition-all flex items-center justify-center
                    ${value === iconName 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }
                  `}
                  title={iconName}
                >
                  <MuiIcon name={iconName} size={24} />
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            {filteredIcons.length} / {ICON_NAMES.length} icônes Material Design
          </p>
        </div>
      </div>
    </div>
  );
}
