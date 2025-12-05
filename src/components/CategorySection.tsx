import type { Category } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import ElementTile from './ElementTile';
import { MuiIcon } from './IconPicker';
import { useState } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';

interface CategorySectionProps {
  category: Category;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
}

// Ce composant gère uniquement les catégories HORIZONTALES
// Les catégories VERTICALES sont gérées directement dans DomainView
export default function CategorySection({ category, onElementClick, readOnly = false }: CategorySectionProps) {
  const { addElement, deleteCategory, moveElement, reorderElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingElement, setIsAddingElement] = useState(false);
  const [newElementName, setNewElementName] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const handleAddElement = () => {
    if (newElementName.trim()) {
      addElement(category.id, newElementName.trim());
      setNewElementName('');
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
  
  return (
    <div className="group mb-8">
      {/* En-tête de catégorie - Style PDF SOMONE mode clair */}
      <div className="flex items-center gap-3 mb-4">
        {category.icon && (
          <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
            <span className="text-xl text-white">{category.icon}</span>
          </div>
        )}
        
        <h3 className="text-lg font-bold text-[#1E3A5F]">
          {category.name}
        </h3>
        
        <div className="flex-1" />
        
        {/* Bouton supprimer catégorie */}
        {!readOnly && (
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
            <MuiIcon name="Trash2" size={16} />
            <span>Supprimer</span>
          </button>
        )}
      </div>
      
      {/* Conteneur blanc pour les éléments - Style PDF SOMONE */}
      <div 
        className={`bg-white rounded-xl border p-6 shadow-sm transition-all ${
          isDraggingOver ? 'border-[#1E3A5F] border-2 bg-[#F5F7FA]' : 'border-[#E2E8F0]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-row flex-wrap gap-4">
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
                    if (e.key === 'Enter') handleAddElement();
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
                    onClick={handleAddElement}
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
    </div>
  );
}
