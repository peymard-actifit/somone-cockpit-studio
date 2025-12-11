import type { SubCategory, Element as ElementType, Domain } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import SubElementTile from './SubElementTile';
import { MuiIcon } from './IconPicker';
import { useState, useEffect } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';

interface SubCategorySectionProps {
  subCategory: SubCategory;
  element: ElementType;
  domain?: Domain;
  readOnly?: boolean;
  onSubElementClick?: (subElementId: string) => void; // Callback pour ouvrir le menu d'édition d'un sous-élément
  elementId?: string; // ID de l'élément pour les préférences indépendantes
  verticalSubCategoryWidth?: number; // Largeur pour les sous-catégories verticales
  horizontalSpacing?: number; // Espacement horizontal passé depuis ElementView
  subCategorySpacing?: number; // Espacement entre sous-catégories passé depuis ElementView
}

export default function SubCategorySection({ subCategory, element, domain, readOnly = false, onSubElementClick, elementId, verticalSubCategoryWidth, horizontalSpacing: propHorizontalSpacing }: SubCategorySectionProps) {
  const { addSubElement, deleteSubCategory, moveSubElement, reorderSubElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingSubElement, setIsAddingSubElement] = useState(false);
  const [newSubElementName, setNewSubElementName] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const handleAddSubElement = () => {
    if (newSubElementName.trim()) {
      addSubElement(subCategory.id, newSubElementName.trim());
      setNewSubElementName('');
      setIsAddingSubElement(false);
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
      const data = e.dataTransfer.getData('application/subelement');
      if (!data) return;
      
      const { subElementId, subCategoryId: fromSubCategoryId } = JSON.parse(data);
      if (fromSubCategoryId !== subCategory.id) {
        moveSubElement(subElementId, fromSubCategoryId, subCategory.id);
      }
    } catch (error) {
      console.error('Erreur lors du drop:', error);
    }
  };
  
  // Trouver la catégorie parente
  const parentCategory = domain?.categories.find(c => 
    c.elements.some(e => e.id === element.id)
  );
  
  // Préférence pour la position des sous-catégories horizontales (indépendante des catégories)
  const [horizontalSubCategoriesInline, setHorizontalSubCategoriesInline] = useState(() => {
    return localStorage.getItem('horizontalSubCategoriesInline') === 'true';
  });
  
  useEffect(() => {
    const handlePreferenceChange = () => {
      setHorizontalSubCategoriesInline(localStorage.getItem('horizontalSubCategoriesInline') === 'true');
    };
    window.addEventListener('horizontalSubCategoriesPreferenceChanged', handlePreferenceChange);
    return () => {
      window.removeEventListener('horizontalSubCategoriesPreferenceChanged', handlePreferenceChange);
    };
  }, []);
  
  const isHorizontal = subCategory.orientation === 'horizontal';
  const useInlineLayout = isHorizontal && horizontalSubCategoriesInline;
  
  // Préférences d'espacement (indépendantes par élément)
  const storageKey = elementId ? `element_${elementId}` : 'global';
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => {
    if (propHorizontalSpacing !== undefined) return propHorizontalSpacing;
    const saved = localStorage.getItem(`horizontalSpacing_${storageKey}`);
    return saved ? parseInt(saved, 10) : 50; // Défaut 50 (équivalent à gap-3)
  });
  // subCategorySpacing est maintenant géré par le conteneur parent (ElementView)
  // On garde juste la prop pour compatibilité mais on ne l'utilise plus ici
  
  useEffect(() => {
    const handleSpacingChange = () => {
      const newHorizontalSpacing = propHorizontalSpacing !== undefined 
        ? propHorizontalSpacing 
        : parseInt(localStorage.getItem(`horizontalSpacing_${storageKey}`) || '50', 10);
      setHorizontalSpacing(newHorizontalSpacing);
    };
    window.addEventListener(`spacingPreferenceChanged_${storageKey}`, handleSpacingChange);
    return () => {
      window.removeEventListener(`spacingPreferenceChanged_${storageKey}`, handleSpacingChange);
    };
  }, [storageKey, propHorizontalSpacing]);
  
  // Mettre à jour les valeurs si les props changent
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
  
  
  return (
    <div className={`group ${useInlineLayout ? `flex items-center ${getGapClass(horizontalSpacing)}` : ''}`}>
      {/* En-tête de sous-catégorie - Style PDF SOMONE mode clair */}
      <div className={`flex items-center gap-3 ${useInlineLayout ? 'mb-0 flex-shrink-0' : 'mb-4'}`}>
        {subCategory.icon && (
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
            <MuiIcon name={subCategory.icon} size={20} className="text-white" />
          </div>
        )}
        
        <h3 className="text-base font-bold text-[#1E3A5F]">
          {subCategory.name}
        </h3>
        
        {!useInlineLayout && <div className="flex-1" />}
        
        {/* Bouton supprimer sous-catégorie */}
        {!readOnly && !useInlineLayout && (
          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Supprimer la sous-catégorie',
                message: `Voulez-vous supprimer la sous-catégorie "${subCategory.name}" et tous ses sous-éléments ?`,
              });
              if (confirmed) {
                deleteSubCategory(subCategory.id);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-[#E57373]/30 hover:border-[#E57373]"
            title="Supprimer la sous-catégorie"
          >
            <MuiIcon name="Delete" size={16} />
            <span>Supprimer</span>
          </button>
        )}
      </div>
      
      {/* Grille de sous-éléments */}
      <div 
        className={`
          flex-1
          ${subCategory.orientation === 'vertical' 
            ? 'flex flex-col gap-3' 
            : `flex flex-row flex-wrap ${getGapClass(horizontalSpacing)}`
          }
          transition-all rounded-lg ${useInlineLayout ? getPaddingClass(horizontalSpacing) : 'p-2'}
          ${isDraggingOver ? 'bg-[#F5F7FA] border-2 border-[#1E3A5F]' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {subCategory.subElements.map((subElement, index) => (
          <SubElementTile 
            key={subElement.id} 
            subElement={subElement}
            breadcrumb={{
              domain: domain?.name || '',
              category: parentCategory?.name || '',
              element: element.name,
              subCategory: subCategory.name,
            }}
            readOnly={readOnly}
            subCategoryId={subCategory.id}
            index={index}
            totalElements={subCategory.subElements.length}
            onSubElementClick={onSubElementClick}
            onReorder={(draggedSubElementId, targetIndex) => {
              if (!readOnly) {
                reorderSubElement(draggedSubElementId, subCategory.id, targetIndex);
              }
            }}
            isVertical={subCategory.orientation === 'vertical'}
            columnWidth={subCategory.orientation === 'vertical' && verticalSubCategoryWidth ? verticalSubCategoryWidth : undefined}
          />
        ))}
        
        {/* Bouton ajouter sous-élément */}
        {!readOnly && (
          !isAddingSubElement ? (
            <button
              onClick={() => setIsAddingSubElement(true)}
              className={`
                flex items-center justify-center gap-2 
                border-2 border-dashed border-[#CBD5E1] 
                text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] 
                rounded-lg transition-colors bg-[#F5F7FA]/50
                ${subCategory.orientation === 'vertical'
                  ? 'py-4 w-full'
                  : 'px-6 py-4 min-w-[140px] min-h-[70px]'
                }
              `}
            >
              <MuiIcon name="Plus" size={20} />
              <span className="text-sm font-medium">Ajouter</span>
            </button>
          ) : (
            <div className={`
              bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg p-3
              ${subCategory.orientation === 'vertical' ? 'w-full' : 'min-w-[180px]'}
            `}>
              <input
                type="text"
                value={newSubElementName}
                onChange={(e) => setNewSubElementName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubElement();
                  if (e.key === 'Escape') {
                    setIsAddingSubElement(false);
                    setNewSubElementName('');
                  }
                }}
                placeholder="Nom"
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] mb-2"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddSubElement}
                  className="flex-1 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  OK
                </button>
                <button
                  onClick={() => {
                    setIsAddingSubElement(false);
                    setNewSubElementName('');
                  }}
                  className="px-3 py-1.5 text-[#64748B] hover:text-[#1E3A5F] text-sm transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
