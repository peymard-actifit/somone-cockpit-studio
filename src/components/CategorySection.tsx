import type { Category } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import ElementTile from './ElementTile';
import { MuiIcon } from './IconPicker';
import { useState, useEffect } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';
import LinkElementModal from './LinkElementModal';

interface CategorySectionProps {
  category: Category;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
  domainId?: string; // ID du domaine pour les préférences indépendantes
  horizontalSpacing?: number; // Espacement horizontal passé depuis DomainView
  categoryHeaderMinWidth?: number; // Largeur minimale de l'en-tête pour l'alignement
}

// Ce composant gère uniquement les catégories HORIZONTALES
// Les catégories VERTICALES sont gérées directement dans DomainView
export default function CategorySection({ category, onElementClick, readOnly = false, domainId, horizontalSpacing: propHorizontalSpacing, categoryHeaderMinWidth }: CategorySectionProps) {
  const { addElement, deleteCategory, moveElement, reorderElement, findElementsByName, linkElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingElement, setIsAddingElement] = useState(false);
  const [newElementName, setNewElementName] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // État pour le modal de liaison
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingElementName, setPendingElementName] = useState('');
  const [pendingChainNext, setPendingChainNext] = useState(false);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);

  // chainNext: true = enchaîner sur un suivant (Entrée), false = terminer (clic bouton)
  const handleAddElement = (chainNext: boolean = false) => {
    if (newElementName.trim()) {
      const name = newElementName.trim();

      // Vérifier s'il existe des éléments avec le même nom
      const matches = findElementsByName(name);

      if (matches.length > 0) {
        // Des éléments avec ce nom existent - afficher le modal
        setPendingElementName(name);
        setPendingChainNext(chainNext);
        setExistingMatches(matches.map(m => ({
          id: m.element.id,
          name: m.element.name,
          location: `${m.domainName} > ${m.categoryName}`,
          linkedGroupId: m.element.linkedGroupId,
          status: m.element.status,
          type: 'element' as const,
        })));
        setShowLinkModal(true);
      } else {
        // Pas de doublon - créer normalement
        addElement(category.id, name);
        setNewElementName('');
        if (!chainNext) {
          setIsAddingElement(false);
        }
      }
    }
  };

  // Créer l'élément indépendamment (sans liaison)
  const handleCreateIndependent = () => {
    addElement(category.id, pendingElementName);
    setNewElementName('');
    setShowLinkModal(false);
    if (!pendingChainNext) {
      setIsAddingElement(false);
    }
  };

  // Créer l'élément et le lier à un groupe existant
  const handleCreateLinked = (linkedGroupId: string) => {
    addElement(category.id, pendingElementName);
    // Trouver l'élément qu'on vient de créer (le dernier de la catégorie)
    setTimeout(() => {
      const cockpit = useCockpitStore.getState().currentCockpit;
      if (cockpit) {
        for (const d of cockpit.domains) {
          for (const c of d.categories) {
            if (c.id === category.id) {
              const lastElement = c.elements[c.elements.length - 1];
              if (lastElement && lastElement.name === pendingElementName) {
                linkElement(lastElement.id, linkedGroupId);
              }
            }
          }
        }
      }
    }, 50);
    setNewElementName('');
    setShowLinkModal(false);
    if (!pendingChainNext) {
      setIsAddingElement(false);
    }
  };

  // Gestion du drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDraggingOver(false);

    try {
      const data = e.dataTransfer.getData('application/element');
      if (!data) return;

      const { elementId, categoryId: fromCategoryId } = JSON.parse(data);

      // Si c'est une autre catégorie, déplacer l'élément à la fin
      if (fromCategoryId !== category.id) {
        moveElement(elementId, fromCategoryId, category.id);
      }
      // Si c'est la même catégorie mais drop sur le conteneur (pas sur une tuile), 
      // cela signifie qu'on veut le déplacer à la fin - pas besoin de faire quoi que ce soit
      // car le réordonnancement est géré par le drop sur les tuiles individuelles
    } catch (error) {
      console.error('Erreur lors du drop:', error);
    }
  };

  // Préférence pour la position des catégories horizontales (indépendante par domaine)
  const storageKey = domainId ? `domain_${domainId}` : 'global';
  const [horizontalCategoriesInline, setHorizontalCategoriesInline] = useState(() => {
    const saved = localStorage.getItem(`horizontalCategoriesInline_${storageKey}`);
    return saved === 'true';
  });

  useEffect(() => {
    const handlePreferenceChange = () => {
      setHorizontalCategoriesInline(localStorage.getItem(`horizontalCategoriesInline_${storageKey}`) === 'true');
    };
    window.addEventListener(`horizontalCategoriesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    return () => {
      window.removeEventListener(`horizontalCategoriesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    };
  }, [storageKey]);

  const isHorizontal = category.orientation === 'horizontal';
  const useInlineLayout = isHorizontal && horizontalCategoriesInline;

  // Préférences d'espacement (indépendantes par domaine)
  const spacingStorageKey = domainId ? `domain_${domainId}` : 'global';
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => {
    if (propHorizontalSpacing !== undefined) return propHorizontalSpacing;
    const saved = localStorage.getItem(`horizontalSpacing_${spacingStorageKey}`);
    return saved ? parseInt(saved, 10) : 50; // Défaut 50 (équivalent à gap-3)
  });
  const [categorySpacing, setCategorySpacing] = useState(() => {
    const saved = localStorage.getItem(`categorySpacing_${spacingStorageKey}`);
    return saved ? parseInt(saved, 10) : 80; // Défaut 80 (équivalent à mb-8)
  });

  useEffect(() => {
    const handleSpacingChange = () => {
      const newHorizontalSpacing = propHorizontalSpacing !== undefined
        ? propHorizontalSpacing
        : parseInt(localStorage.getItem(`horizontalSpacing_${spacingStorageKey}`) || '50', 10);
      setHorizontalSpacing(newHorizontalSpacing);
      setCategorySpacing(parseInt(localStorage.getItem(`categorySpacing_${spacingStorageKey}`) || '80', 10));
    };
    window.addEventListener(`spacingPreferenceChanged_${spacingStorageKey}`, handleSpacingChange);
    return () => {
      window.removeEventListener(`spacingPreferenceChanged_${spacingStorageKey}`, handleSpacingChange);
    };
  }, [spacingStorageKey, propHorizontalSpacing]);

  // Mettre à jour horizontalSpacing si la prop change
  useEffect(() => {
    if (propHorizontalSpacing !== undefined) {
      setHorizontalSpacing(propHorizontalSpacing);
    }
  }, [propHorizontalSpacing]);

  // Convertir la valeur du slider (0-100) en classes Tailwind
  const getGapClass = (value: number) => {
    if (value < 20) return 'gap-1';
    if (value < 40) return 'gap-2';
    if (value < 60) return 'gap-3';
    if (value < 80) return 'gap-4';
    return 'gap-6';
  };

  const getPaddingClass = (value: number) => {
    if (value < 20) return 'p-1';
    if (value < 40) return 'p-2';
    if (value < 60) return 'p-3';
    if (value < 80) return 'p-4';
    return 'p-6';
  };

  const getMarginBottomClass = (value: number) => {
    if (value < 5) return 'mb-0';
    if (value < 10) return 'mb-1';
    if (value < 15) return 'mb-2';
    if (value < 25) return 'mb-3';
    if (value < 35) return 'mb-4';
    if (value < 45) return 'mb-5';
    if (value < 55) return 'mb-6';
    if (value < 65) return 'mb-7';
    if (value < 75) return 'mb-8';
    if (value < 85) return 'mb-9';
    return 'mb-10';
  };

  return (
    <div className={`group ${getMarginBottomClass(categorySpacing)} ${useInlineLayout ? `flex items-center ${getGapClass(horizontalSpacing)}` : ''}`}>
      {/* En-tête de catégorie - Style PDF SOMONE mode clair */}
      <div
        className={`flex items-center gap-3 ${useInlineLayout ? 'mb-0 flex-shrink-0' : 'mb-4'}`}
        style={useInlineLayout && categoryHeaderMinWidth ? { minWidth: `${categoryHeaderMinWidth}px` } : undefined}
      >
        {category.icon && (
          <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
            <MuiIcon name={category.icon} size={24} className="text-white" />
          </div>
        )}

        <h3 className="text-lg font-bold text-[#1E3A5F] whitespace-nowrap">
          {category.name}
        </h3>

        {!useInlineLayout && <div className="flex-1" />}

        {/* Bouton supprimer catégorie */}
        {!readOnly && !useInlineLayout && (
          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Supprimer la catégorie',
                message: `Voulez-vous supprimer la catégorie "${category.name}" et tous ses éléments ?`,
              });
              if (confirmed) {
                deleteCategory(category.id);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-[#E57373]/30 hover:border-[#E57373]"
            title="Supprimer la catégorie"
          >
            <MuiIcon name="Delete" size={16} />
            <span>Supprimer</span>
          </button>
        )}
      </div>

      {/* Conteneur blanc pour les éléments - Style PDF SOMONE */}
      <div
        className={`bg-white rounded-xl border shadow-sm transition-all flex-1 ${isDraggingOver ? 'border-[#1E3A5F] border-2 bg-[#F5F7FA]' : 'border-[#E2E8F0]'
          } ${useInlineLayout ? `relative ${getPaddingClass(horizontalSpacing)}` : getPaddingClass(horizontalSpacing)}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {useInlineLayout && !readOnly && (
          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Supprimer la catégorie',
                message: `Voulez-vous supprimer la catégorie "${category.name}" et tous ses éléments ?`,
              });
              if (confirmed) {
                deleteCategory(category.id);
              }
            }}
            className="absolute top-2 right-2 p-1.5 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Supprimer la catégorie"
          >
            <MuiIcon name="Delete" size={16} />
          </button>
        )}
        <div className={`flex flex-row flex-wrap ${getGapClass(horizontalSpacing)}`}>
          {category.elements.map((element, index) => (
            <ElementTile
              key={element.id}
              element={element}
              onElementClick={onElementClick}
              readOnly={readOnly}
              categoryId={category.id}
              index={index}
              totalElements={category.elements.length}
              onReorder={(draggedElementId, targetIndex) => {
                if (!readOnly) {
                  reorderElement(draggedElementId, category.id, targetIndex);
                }
              }}
              domainId={domainId}
            />
          ))}

          {/* Bouton ajouter élément */}
          {!readOnly && (
            !isAddingElement ? (
              <button
                onClick={() => setIsAddingElement(true)}
                className="flex items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors bg-[#F5F7FA]/50 px-8 py-6 min-w-[180px] min-h-[120px]"
              >
                <MuiIcon name="Plus" size={24} />
                <span className="font-medium">Ajouter un élément</span>
              </button>
            ) : (
              <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-4 min-w-[220px]">
                <input
                  type="text"
                  value={newElementName}
                  onChange={(e) => setNewElementName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddElement(true); // Entrée = enchaîner
                    if (e.key === 'Escape') {
                      setIsAddingElement(false);
                      setNewElementName('');
                    }
                  }}
                  placeholder="Nom de l'élément"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] mb-3"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddElement(false)} // Clic = terminer
                    className="flex-1 px-4 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingElement(false);
                      setNewElementName('');
                    }}
                    className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F] text-sm transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal de liaison pour les éléments du même nom */}
      {showLinkModal && (
        <LinkElementModal
          type="element"
          newItemName={pendingElementName}
          existingMatches={existingMatches}
          onLink={handleCreateLinked}
          onIndependent={handleCreateIndependent}
          onCancel={() => {
            setShowLinkModal(false);
            setNewElementName('');
          }}
        />
      )}
    </div>
  );
}
