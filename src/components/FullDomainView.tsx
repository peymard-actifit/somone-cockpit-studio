import { useState, useEffect } from 'react';
import type { Domain, Element } from '../types';
import { STATUS_COLORS, getEffectiveStatus } from '../types';
import { MuiIcon } from './IconPicker';
import SubElementTile from './SubElementTile';

interface FullDomainViewProps {
  domain: Domain;
  onBack: () => void;
  onElementClick?: (elementId: string) => void;
  onCategoryClick?: (categoryId: string) => void; // Pour naviguer vers la vue catégorie
  readOnly?: boolean;
  domains?: Domain[]; // Pour le calcul de l'héritage
}

/**
 * Vue Domaine Complète - Affiche tous les sous-éléments du domaine regroupés par catégories puis par éléments
 * Cette vue permet de voir en un coup d'œil tous les indicateurs d'un domaine entier
 */
export default function FullDomainView({ 
  domain, 
  onBack, 
  onElementClick,
  onCategoryClick,
  readOnly = false,
  domains 
}: FullDomainViewProps) {
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

  // Collecter tous les sous-éléments d'un élément (sans découpage par sous-catégorie)
  // Protection: s'assurer que les tableaux existent
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

  // Obtenir la couleur effective d'un élément (gère l'héritage)
  const getElementColors = (element: Element) => {
    const effectiveStatus = getEffectiveStatus(element, domains);
    return STATUS_COLORS[effectiveStatus] || STATUS_COLORS.ok;
  };

  // Compter le total de sous-éléments dans le domaine - protection pour les tableaux
  const totalSubElements = (domain.categories || []).reduce((total, category) => {
    return total + (category.elements || []).reduce((catTotal, element) => {
      return catTotal + getSubElementsForElement(element).length;
    }, 0);
  }, 0);

  // Filtrer les catégories qui ont au moins un sous-élément - protection pour les tableaux
  const categoriesWithSubElements = (domain.categories || []).filter(category => 
    (category.elements || []).some(element => getSubElementsForElement(element).length > 0)
  );

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
          {domain.name}
        </h1>
        <p 
          className="text-[#64748B]"
          style={{ fontSize: 'calc(1rem * var(--text-compensation, 1))' }}
        >
          Vue complète • {totalSubElements} indicateur{totalSubElements > 1 ? 's' : ''} • {categoriesWithSubElements.length} catégorie{categoriesWithSubElements.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Liste des catégories avec leurs éléments et sous-éléments */}
      <div className="space-y-8">
        {categoriesWithSubElements.map((category) => (
          <div key={category.id} className="space-y-4">
            {/* En-tête de la catégorie (nom cliquable pour voir la vue catégorie) */}
            <div className="flex items-center gap-3 pb-2 border-b-2 border-[#1E3A5F]">
              {category.icon && (
                <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                  <MuiIcon name={category.icon} size={24} className="text-white" />
                </div>
              )}
              <button
                onClick={() => onCategoryClick?.(category.id)}
                className="group flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                title="Cliquez pour voir la vue catégorie détaillée"
              >
                <h2 
                  className="font-bold text-[#1E3A5F] group-hover:underline decoration-2 underline-offset-4"
                  style={{ fontSize: 'calc(1.5rem * var(--text-compensation, 1))' }} // text-2xl = 1.5rem
                >
                  {category.name}
                </h2>
                <MuiIcon name="ChevronRight" size={24} className="text-[#64748B] group-hover:text-[#1E3A5F] transition-colors" />
              </button>
              <span className="ml-auto text-sm text-[#64748B] bg-[#F5F7FA] px-3 py-1 rounded-full border border-[#E2E8F0]">
                {(category.elements || []).reduce((sum, el) => sum + getSubElementsForElement(el).length, 0)} indicateur{(category.elements || []).reduce((sum, el) => sum + getSubElementsForElement(el).length, 0) > 1 ? 's' : ''}
              </span>
            </div>

            {/* Éléments de cette catégorie - protection pour les tableaux */}
            <div className="space-y-4">
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
            </div>
          </div>
        ))}

        {/* Message si aucune catégorie avec des sous-éléments */}
        {categoriesWithSubElements.length === 0 && (
          <div className="text-center py-12 text-[#64748B]">
            <MuiIcon name="Info" size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Ce domaine n'a pas encore de sous-éléments.</p>
            <p className="text-sm mt-2">
              Cliquez sur un élément pour ajouter des sous-catégories et sous-éléments.
            </p>
          </div>
        )}
      </div>

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
