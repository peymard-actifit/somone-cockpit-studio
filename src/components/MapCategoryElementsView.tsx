import { useState, useEffect } from 'react';
import type { Category, Domain, Element } from '../types';
import { STATUS_COLORS, getEffectiveStatus } from '../types';
import { MuiIcon } from './IconPicker';

interface MapCategoryElementsViewProps {
  category: Category;
  domain: Domain;
  onBack: () => void;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
  domains?: Domain[]; // Pour le calcul de l'héritage
}

/**
 * Vue des éléments d'une catégorie pour les vues Map et Background
 * Affiche tous les éléments d'une catégorie sous forme de tuiles standard
 */
export default function MapCategoryElementsView({ 
  category, 
  domain, 
  onBack, 
  onElementClick,
  readOnly = false,
  domains 
}: MapCategoryElementsViewProps) {
  // Préférence d'espacement horizontal (stockée par domaine)
  const storageKey = domain.id ? `domain_${domain.id}` : 'global';
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => {
    const saved = localStorage.getItem(`horizontalSpacing_${storageKey}`);
    return saved ? parseInt(saved, 10) : 50;
  });

  useEffect(() => {
    const handleSpacingChange = () => {
      setHorizontalSpacing(parseInt(localStorage.getItem(`horizontalSpacing_${storageKey}`) || '50', 10));
    };
    window.addEventListener(`spacingPreferenceChanged_${storageKey}`, handleSpacingChange);
    return () => {
      window.removeEventListener(`spacingPreferenceChanged_${storageKey}`, handleSpacingChange);
    };
  }, [storageKey]);

  // Convertir la valeur du slider (0-100) en classes Tailwind
  const getGapClass = (value: number) => {
    if (value < 20) return 'gap-2';
    if (value < 40) return 'gap-3';
    if (value < 60) return 'gap-4';
    if (value < 80) return 'gap-5';
    return 'gap-6';
  };

  // Obtenir la couleur effective d'un élément (gère l'héritage)
  const getElementColors = (element: Element) => {
    const effectiveStatus = getEffectiveStatus(element, domains);
    return STATUS_COLORS[effectiveStatus] || STATUS_COLORS.ok;
  };

  // Compter les sous-éléments d'un élément
  const getSubElementCount = (element: Element) => {
    return element.subCategories.reduce((total, sc) => total + sc.subElements.length, 0);
  };

  return (
    <div className="min-h-full bg-[#F5F7FA] p-8">
      {/* En-tête avec bouton retour */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors mb-4"
        >
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center">
            <MuiIcon name="ArrowBack" size={18} className="text-white" />
          </div>
          <span className="text-sm font-medium">Retour à la vue {domain.templateType === 'map' ? 'carte' : 'image'}</span>
        </button>

        {/* Titre de la catégorie */}
        <div className="flex items-center gap-3">
          {category.icon && (
            <div className="w-12 h-12 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
              <MuiIcon name={category.icon} size={28} className="text-white" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-[#1E3A5F]">
              {category.name}
            </h1>
            <p className="text-[#64748B]">
              {category.elements.length} élément{category.elements.length > 1 ? 's' : ''} • {domain.name}
            </p>
          </div>
        </div>
      </div>

      {/* Grille des éléments */}
      <div className={`flex flex-wrap ${getGapClass(horizontalSpacing)}`}>
        {category.elements.map((element) => {
          const colors = getElementColors(element);
          const subElementCount = getSubElementCount(element);
          
          return (
            <button
              key={element.id}
              onClick={() => onElementClick?.(element.id)}
              className="group bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#1E3A5F]/30 transition-all overflow-hidden text-left"
              style={{ minWidth: '200px', maxWidth: '280px', flex: '1 1 200px' }}
            >
              {/* En-tête avec couleur de statut */}
              <div 
                className="p-4 flex items-center gap-3"
                style={{ borderLeft: `4px solid ${colors.hex}` }}
              >
                {/* Icône de l'élément */}
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.hex }}
                >
                  {element.icon ? (
                    <MuiIcon name={element.icon} size={24} className="text-white" />
                  ) : (
                    <MuiIcon name="Dashboard" size={24} className="text-white" />
                  )}
                </div>

                {/* Nom et infos */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#1E3A5F] truncate group-hover:text-[#2D5A8F]">
                    {element.name}
                  </h3>
                  {subElementCount > 0 && (
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {subElementCount} indicateur{subElementCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Flèche */}
                <MuiIcon 
                  name="ChevronRight" 
                  size={20} 
                  className="text-[#CBD5E1] group-hover:text-[#1E3A5F] transition-colors flex-shrink-0" 
                />
              </div>

              {/* Description si présente */}
              {element.description && (
                <div className="px-4 pb-3 pt-0">
                  <p className="text-xs text-[#64748B] line-clamp-2">
                    {element.description}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Message si aucun élément */}
      {category.elements.length === 0 && (
        <div className="text-center py-12 text-[#64748B]">
          <MuiIcon name="Info" size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">Cette catégorie n'a pas encore d'éléments.</p>
          {!readOnly && (
            <p className="text-sm mt-2">
              Ajoutez des éléments depuis la vue carte ou background.
            </p>
          )}
        </div>
      )}

      {/* Légende des couleurs */}
      <div className="mt-12 flex items-center justify-start gap-8 flex-wrap py-4">
        <LegendItem color="#8B5CF6" label="Fatal" />
        <LegendItem color="#E57373" label="Critique" />
        <LegendItem color="#FFB74D" label="Mineur" />
        <LegendItem color="#9CCC65" label="OK" />
        <LegendItem color="#9E9E9E" label="Déconnecté" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-4 rounded"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-[#64748B] font-medium">{label}</span>
    </div>
  );
}
