import { useState, useEffect } from 'react';
import type { Category, Domain, Element } from '../types';
import { STATUS_COLORS, getEffectiveStatus } from '../types';
import { MuiIcon } from './IconPicker';
import SubElementTile from './SubElementTile';
import { useLanguage } from '../contexts/LanguageContext';
import { useCockpitStore } from '../store/cockpitStore';

interface CategoryViewProps {
  category: Category;
  domain: Domain;
  onBack: () => void;
  onElementClick?: (elementId: string) => void;
  onDomainClick?: () => void; // Pour naviguer vers la vue domaine complète
  readOnly?: boolean;
  domains?: Domain[]; // Pour le calcul de l'héritage
}

/**
 * Vue Catégorie - Affiche tous les sous-éléments d'une catégorie regroupés par éléments
 * Cette vue permet de voir en un coup d'œil tous les indicateurs d'une catégorie
 */
export default function CategoryView({ 
  category, 
  domain, 
  onBack, 
  onElementClick,
  onDomainClick,
  readOnly = false,
  domains 
}: CategoryViewProps) {
  const { t } = useLanguage();
  const { currentCockpit } = useCockpitStore();
  
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
    if (value < 20) return 'gap-1';
    if (value < 40) return 'gap-2';
    if (value < 60) return 'gap-3';
    if (value < 80) return 'gap-4';
    return 'gap-6';
  };

  // Collecter tous les sous-éléments de chaque élément - protection pour les tableaux
  const getSubElementsForElement = (element: Element) => {
    const subElements: Array<{
      subElement: typeof element.subCategories[0]['subElements'][0];
      subCategoryName: string;
    }> = [];
    
    for (const subCategory of (element.subCategories || [])) {
      for (const subElement of (subCategory.subElements || [])) {
        subElements.push({
          subElement,
          subCategoryName: subCategory.name
        });
      }
    }
    
    return subElements;
  };

  // Obtenir la couleur effective d'un élément (gère l'héritage et les données historiques)
  const getElementColors = (element: Element) => {
    const historyOptions = { dataHistory: currentCockpit?.dataHistory, selectedDataDate: currentCockpit?.selectedDataDate };
    const effectiveStatus = getEffectiveStatus(element, domains, undefined, historyOptions);
    return STATUS_COLORS[effectiveStatus] || STATUS_COLORS.ok;
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
        </button>

        {/* Titre de la vue - compensé pour rester lisible à bas zoom */}
        <h1 
          className="font-bold text-[#1E3A5F] mb-2"
          style={{ fontSize: 'calc(1.875rem * var(--text-compensation, 1))' }} // text-3xl = 1.875rem
        >
          {category.name}
        </h1>
      </div>

      {/* Nom du domaine en sous-titre (cliquable pour voir la vue domaine complète) */}
      <div className="mb-8 p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
        <button
          onClick={() => onDomainClick?.()}
          className="group flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          title="Cliquez pour voir tous les indicateurs du domaine"
        >
          <h2 
            className="font-semibold text-[#1E3A5F] group-hover:underline decoration-2 underline-offset-4"
            style={{ fontSize: 'calc(1.25rem * var(--text-compensation, 1))' }} // text-xl = 1.25rem
          >
            {domain.name}
          </h2>
          <MuiIcon name="ChevronRight" size={20} className="text-[#64748B] group-hover:text-[#1E3A5F] transition-colors" />
        </button>
      </div>

      {/* Liste des éléments avec leurs sous-éléments - protection pour les tableaux */}
      <div className="space-y-6">
        {(category.elements || []).map((element) => {
          const subElements = getSubElementsForElement(element);
          const elementColors = getElementColors(element);
          
          // Ne pas afficher les éléments sans sous-éléments
          if (subElements.length === 0) return null;

          return (
            <div 
              key={element.id} 
              className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden"
            >
              {/* En-tête de l'élément (cliquable) */}
              <button
                onClick={() => onElementClick?.(element.id)}
                className="w-full p-4 flex items-center gap-3 hover:bg-[#F5F7FA] transition-colors border-b border-[#E2E8F0]"
              >
                {/* Icône de l'élément avec couleur de statut */}
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: elementColors.hex }}
                >
                  {element.icon ? (
                    <MuiIcon name={element.icon} size={20} className="text-white" />
                  ) : (
                    <MuiIcon name="Dashboard" size={20} className="text-white" />
                  )}
                </div>

                {/* Nom de l'élément */}
                <h3 
                  className="font-bold text-[#1E3A5F] flex-1 text-left"
                  style={{ fontSize: 'calc(1.125rem * var(--text-compensation, 1))' }} // text-lg = 1.125rem
                >
                  {element.name}
                </h3>

                {/* Indicateur du nombre de sous-éléments */}
                <span className="text-sm text-[#64748B] bg-[#F5F7FA] px-3 py-1 rounded-full">
                  {subElements.length} indicateur{subElements.length > 1 ? 's' : ''}
                </span>

                {/* Flèche */}
                <MuiIcon name="ChevronRight" size={20} className="text-[#64748B]" />
              </button>

              {/* Grille des sous-éléments */}
              <div className={`p-4 flex flex-row flex-wrap ${getGapClass(horizontalSpacing)}`}>
                {subElements.map(({ subElement }) => (
                  <SubElementTile
                    key={subElement.id}
                    subElement={subElement}
                    breadcrumb={{
                      domain: domain.name,
                      category: category.name,
                      element: element.name,
                      subCategory: '' // On n'affiche pas la sous-catégorie dans cette vue
                    }}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Message si aucun élément avec des sous-éléments - protection pour les tableaux */}
        {(category.elements || []).every(el => getSubElementsForElement(el).length === 0) && (
          <div className="text-center py-12 text-[#64748B]">
            <MuiIcon name="Info" size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Cette catégorie n'a pas encore de sous-éléments.</p>
            <p className="text-sm mt-2">
              Cliquez sur un élément pour ajouter des sous-catégories et sous-éléments.
            </p>
          </div>
        )}
      </div>

      {/* Légende des couleurs */}
      <div className="mt-12 flex items-center justify-start gap-8 flex-wrap py-4">
        <LegendItem color="#8B5CF6" label={t('status.fatal')} />
        <LegendItem color="#E57373" label={t('status.critical')} />
        <LegendItem color="#FFB74D" label={t('status.minor')} />
        <LegendItem color="#9CCC65" label={t('status.ok')} />
        <LegendItem color="#9E9E9E" label={t('status.disconnected')} />
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
