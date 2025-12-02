import type { SubCategory, Element as ElementType, Domain } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import SubElementTile from './SubElementTile';
import { MuiIcon } from './IconPicker';
import { useState } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';

interface SubCategorySectionProps {
  subCategory: SubCategory;
  element: ElementType;
  domain: Domain;
}

export default function SubCategorySection({ subCategory, element, domain }: SubCategorySectionProps) {
  const { addSubElement, deleteSubCategory } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingSubElement, setIsAddingSubElement] = useState(false);
  const [newSubElementName, setNewSubElementName] = useState('');
  
  const handleAddSubElement = () => {
    if (newSubElementName.trim()) {
      addSubElement(subCategory.id, newSubElementName.trim());
      setNewSubElementName('');
      setIsAddingSubElement(false);
    }
  };
  
  // Trouver la catégorie parente
  const parentCategory = domain.categories.find(c => 
    c.elements.some(e => e.id === element.id)
  );
  
  return (
    <div className="group mb-8">
      {/* En-tête de sous-catégorie - Style PDF SOMONE mode clair */}
      <div className="flex items-center gap-3 mb-4">
        {subCategory.icon && (
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
            <span className="text-lg text-white">{subCategory.icon}</span>
          </div>
        )}
        
        <h3 className="text-base font-bold text-[#1E3A5F]">
          {subCategory.name}
        </h3>
        
        <div className="flex-1" />
        
        {/* Bouton supprimer sous-catégorie */}
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
          <MuiIcon name="Trash2" size={16} />
          <span>Supprimer</span>
        </button>
      </div>
      
      {/* Grille de sous-éléments */}
      <div className={`
        ${subCategory.orientation === 'vertical' 
          ? 'flex flex-col gap-3' 
          : 'flex flex-row flex-wrap gap-3'
        }
      `}>
        {subCategory.subElements.map((subElement) => (
          <SubElementTile 
            key={subElement.id} 
            subElement={subElement}
            breadcrumb={{
              domain: domain.name,
              category: parentCategory?.name || '',
              element: element.name,
              subCategory: subCategory.name,
            }}
          />
        ))}
        
        {/* Bouton ajouter sous-élément */}
        {!isAddingSubElement ? (
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
        )}
      </div>
    </div>
  );
}
