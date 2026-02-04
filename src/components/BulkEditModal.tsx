import { useState, useEffect, useRef } from 'react';
import type { Element, Category, TileStatus, Domain } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';
import { useCockpitStore } from '../store/cockpitStore';

// Formes simples disponibles
const SIMPLE_SHAPES = [
  { id: 'shape:circle', name: 'Cercle', label: '●' },
  { id: 'shape:square', name: 'Carré', label: '■' },
  { id: 'shape:triangle', name: 'Triangle', label: '▲' },
  { id: 'shape:diamond', name: 'Losange', label: '◆' },
  { id: 'shape:hexagon', name: 'Hexagone', label: '⬡' },
  { id: 'shape:star', name: 'Étoile', label: '★' },
  { id: 'shape:stadium', name: 'Stade', label: '▭' },
  { id: 'shape:lightning', name: 'Éclair', label: '⚡' },
  { id: 'shape:faucet', name: 'Robinet', label: '🚰' },
];

// Helper pour détecter si c'est une forme
const isShape = (icon: string | undefined): boolean => {
  return icon?.startsWith('shape:') || false;
};

// Helper pour obtenir le label de la forme
const getShapeLabel = (icon: string | undefined): string => {
  if (!icon || !isShape(icon)) return '';
  const shape = SIMPLE_SHAPES.find(s => s.id === icon);
  return shape?.label || icon.replace('shape:', '');
};

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: Element[];
  categories: Category[];
  domain: Domain;
  templates?: string[];
}

export default function BulkEditModal({ isOpen, onClose, elements, categories, domain, templates = [] }: BulkEditModalProps) {
  const { updateElement } = useCockpitStore();
  const [searchTerm, setSearchTerm] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Filtrer les éléments par recherche
  const filteredElements = elements.filter(el => 
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

  const statuses: TileStatus[] = ['ok', 'information', 'mineur', 'critique', 'fatal', 'deconnecte', 'herite_domaine'];

  // Icônes organisées par catégories
  const iconCategories = [
    {
      name: 'Formes',
      icons: SIMPLE_SHAPES.map(s => s.id),
    },
    {
      name: 'Lieux',
      icons: ['Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Apartment', 'Business', 'LocationCity'],
    },
    {
      name: 'Transport',
      icons: ['Truck', 'LocalShipping', 'DirectionsCar', 'Flight', 'Train', 'DirectionsBoat'],
    },
    {
      name: 'Infrastructure',
      icons: ['Server', 'Database', 'Storage', 'Wifi', 'Router', 'Memory', 'Dns', 'Cloud'],
    },
    {
      name: 'Alertes',
      icons: ['Warning', 'Error', 'Info', 'CheckCircle', 'Cancel', 'Block', 'ReportProblem'],
    },
    {
      name: 'Divers',
      icons: ['Place', 'MapPin', 'Flag', 'Star', 'Favorite', 'Bookmark', 'Person', 'Group'],
    },
  ];

  const handleUpdate = (elementId: string, updates: Partial<Element>) => {
    updateElement(elementId, updates);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixe */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F5F7FA] flex-shrink-0">
          <div className="flex items-center gap-3">
            <MuiIcon name="Edit" size={20} className="text-[#1E3A5F]" />
            <h3 className="text-lg font-semibold text-[#1E3A5F]">
              Édition en masse ({elements.length} éléments)
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
        <div className="grid grid-cols-[2fr_100px_150px_80px_60px_120px_120px] gap-2 px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] flex-shrink-0">
          <div>Nom</div>
          <div>Statut</div>
          <div>Icône / Forme</div>
          <div>Valeur</div>
          <div>Unité</div>
          <div>Catégorie</div>
          <div>Template</div>
        </div>

        {/* Liste des éléments avec scroll */}
        <div className="flex-1 overflow-y-auto">
          {filteredElements.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#94A3B8]">
              Aucun élément trouvé
            </div>
          ) : (
            filteredElements.map((element) => (
              <BulkEditRow
                key={element.id}
                element={element}
                categories={categories}
                templates={templates}
                statuses={statuses}
                iconCategories={iconCategories}
                onUpdate={handleUpdate}
                domainTemplateName={domain.templateName}
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
interface BulkEditRowProps {
  element: Element;
  categories: Category[];
  templates: string[];
  statuses: TileStatus[];
  iconCategories: Array<{ name: string; icons: string[] }>;
  onUpdate: (elementId: string, updates: Partial<Element>) => void;
  domainTemplateName?: string;
}

function BulkEditRow({ element, categories, templates, statuses, iconCategories, onUpdate, domainTemplateName }: BulkEditRowProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const colors = STATUS_COLORS[element.status] || STATUS_COLORS.ok;
  const currentIcon = element.icon || 'Store';
  const isCurrentShape = isShape(currentIcon);

  // Fermer le picker quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    };
    if (showIconPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showIconPicker]);

  // Obtenir le nom de l'icône actuelle
  const getCurrentIconName = () => {
    if (isCurrentShape) {
      const shape = SIMPLE_SHAPES.find(s => s.id === currentIcon);
      return shape?.name || currentIcon.replace('shape:', '');
    }
    return currentIcon;
  };

  return (
    <div className="grid grid-cols-[2fr_100px_150px_80px_60px_120px_120px] gap-2 px-4 py-1.5 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] items-center text-sm">
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

      {/* Icône - Affichage amélioré avec nom visible */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowIconPicker(!showIconPicker)}
          className={`w-full px-2 py-1 border rounded flex items-center gap-2 hover:bg-[#F5F7FA] transition-colors ${
            showIconPicker ? 'border-[#1E3A5F] bg-[#F5F7FA]' : 'border-[#E2E8F0]'
          }`}
        >
          {/* Icône actuelle avec couleur du statut */}
          <div 
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: colors.hex + '20', color: colors.hex }}
          >
            {isCurrentShape ? (
              <span className="text-xs">{getShapeLabel(currentIcon)}</span>
            ) : (
              <MuiIcon name={currentIcon} size={14} className="text-inherit" />
            )}
          </div>
          {/* Nom de l'icône */}
          <span className="text-[10px] text-[#64748B] truncate flex-1 text-left">{getCurrentIconName()}</span>
          {/* Chevron */}
          <MuiIcon name={showIconPicker ? 'ExpandLess' : 'ExpandMore'} size={12} className="text-[#94A3B8] flex-shrink-0" />
        </button>

        {/* Picker d'icônes amélioré */}
        {showIconPicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-3 w-72 max-h-64 overflow-y-auto">
            {iconCategories.map((category, catIndex) => (
              <div key={category.name} className={catIndex > 0 ? 'mt-2.5' : ''}>
                <div className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1">
                  {category.name}
                </div>
                <div className="grid grid-cols-6 gap-0.5">
                  {category.icons.map(icon => {
                    const isSelected = currentIcon === icon;
                    const iconIsShape = isShape(icon);
                    return (
                      <button
                        key={icon}
                        onClick={() => {
                          onUpdate(element.id, { icon });
                          setShowIconPicker(false);
                        }}
                        className={`p-1 rounded transition-all ${
                          isSelected 
                            ? 'bg-[#1E3A5F] text-white ring-1 ring-[#1E3A5F] ring-offset-1' 
                            : 'hover:bg-[#F5F7FA] text-[#1E3A5F]'
                        }`}
                        title={iconIsShape ? SIMPLE_SHAPES.find(s => s.id === icon)?.name : icon}
                      >
                        {iconIsShape ? (
                          <span className="text-xs block text-center">
                            {getShapeLabel(icon)}
                          </span>
                        ) : (
                          <MuiIcon name={icon} size={16} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Valeur */}
      <input
        type="text"
        value={element.value || ''}
        onChange={(e) => onUpdate(element.id, { value: e.target.value })}
        placeholder="-"
        className="px-2 py-1 border border-transparent hover:border-[#E2E8F0] focus:border-[#1E3A5F] rounded text-[#1E3A5F] focus:outline-none bg-transparent text-center"
      />

      {/* Unité */}
      <input
        type="text"
        value={element.unit || ''}
        onChange={(e) => onUpdate(element.id, { unit: e.target.value })}
        placeholder="-"
        className="px-2 py-1 border border-transparent hover:border-[#E2E8F0] focus:border-[#1E3A5F] rounded text-[#1E3A5F] focus:outline-none bg-transparent text-center text-xs"
      />

      {/* Catégorie */}
      <select
        value={element.categoryId}
        onChange={(e) => onUpdate(element.id, { categoryId: e.target.value })}
        className="px-2 py-1 border border-[#E2E8F0] rounded text-xs focus:outline-none focus:border-[#1E3A5F] truncate"
      >
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>

      {/* Template */}
      <select
        value={element.template || domainTemplateName || ''}
        onChange={(e) => onUpdate(element.id, { template: e.target.value || undefined })}
        className="px-2 py-1 border border-[#E2E8F0] rounded text-xs focus:outline-none focus:border-[#1E3A5F] truncate"
      >
        <option value="">Par défaut</option>
        {templates.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}
