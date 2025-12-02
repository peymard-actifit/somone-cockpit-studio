import type { Domain, Element } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import SubCategorySection from './SubCategorySection';
import { MuiIcon } from './IconPicker';
import { useState } from 'react';

interface ElementViewProps {
  element: Element;
  domain: Domain;
}

export default function ElementView({ element, domain }: ElementViewProps) {
  const { setCurrentElement, addSubCategory } = useCockpitStore();
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newSubCategoryOrientation, setNewSubCategoryOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  
  const handleBack = () => {
    setCurrentElement(null);
  };
  
  const handleAddSubCategory = () => {
    if (newSubCategoryName.trim()) {
      addSubCategory(element.id, newSubCategoryName.trim(), newSubCategoryOrientation);
      setNewSubCategoryName('');
      setIsAddingSubCategory(false);
    }
  };
  
  // Trouver la catégorie parente
  const parentCategory = domain.categories.find(c => 
    c.elements.some(e => e.id === element.id)
  );
  
  return (
    <div className="min-h-full p-8 bg-[#F5F7FA]">
      {/* Header avec retour - Style PDF SOMONE mode clair */}
      <div className="mb-10">
        {/* Bouton retour */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[#1E3A5F] hover:text-[#2C4A6E] transition-colors mb-6 group bg-white px-4 py-2 rounded-full border border-[#E2E8F0] shadow-sm"
        >
          <MuiIcon name="ArrowLeftIcon" size={20} />
          <span className="font-medium">Retour à {domain.name}</span>
        </button>
        
        {/* Breadcrumb */}
        <div className="text-sm text-[#64748B] mb-3 flex items-center gap-2">
          <span>{domain.name}</span>
          {parentCategory && (
            <>
              <span className="text-[#CBD5E1]">/</span>
              <span>{parentCategory.name}</span>
            </>
          )}
        </div>
        
        {/* Titre de l'élément */}
        <div className="flex items-center gap-5">
          {element.icon && (
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#E2E8F0] shadow-sm">
              <MuiIcon name={element.icon} size={32} className="text-[#1E3A5F]" />
            </div>
          )}
          <div>
            <h2 className="text-4xl font-bold text-[#1E3A5F] tracking-tight">
              {element.name}
            </h2>
            {element.value && (
              <p className="text-[#64748B] text-lg mt-1">
                <span className="font-semibold text-[#1E3A5F]">{element.value}</span>
                {element.unit && <span className="ml-1">{element.unit}</span>}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Conteneur blanc pour les sous-catégories */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        {/* Sous-catégories */}
        <div className="space-y-10">
          {element.subCategories.map((subCategory) => (
            <SubCategorySection 
              key={subCategory.id} 
              subCategory={subCategory}
              element={element}
              domain={domain}
            />
          ))}
        </div>
        
        {/* Bouton ajouter sous-catégorie */}
        {!isAddingSubCategory ? (
          <button
            onClick={() => setIsAddingSubCategory(true)}
            className="mt-8 flex items-center gap-3 px-6 py-4 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors w-full justify-center bg-[#F5F7FA]/50"
          >
            <MuiIcon name="Plus" size={24} />
            <span className="font-semibold">Ajouter une sous-catégorie</span>
          </button>
        ) : (
          <div className="mt-8 bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-6">
            <h4 className="text-[#1E3A5F] font-semibold text-lg mb-4">Nouvelle sous-catégorie</h4>
            
            <div className="space-y-4">
              <input
                type="text"
                value={newSubCategoryName}
                onChange={(e) => setNewSubCategoryName(e.target.value)}
                placeholder="Nom de la sous-catégorie"
                className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                autoFocus
              />
              
              <div className="flex items-center gap-4">
                <label className="text-[#64748B] text-sm">Orientation :</label>
                <button
                  onClick={() => setNewSubCategoryOrientation('horizontal')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newSubCategoryOrientation === 'horizontal'
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-white text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => setNewSubCategoryOrientation('vertical')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newSubCategoryOrientation === 'vertical'
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-white text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                  }`}
                >
                  Vertical
                </button>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsAddingSubCategory(false);
                    setNewSubCategoryName('');
                  }}
                  className="px-5 py-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddSubCategory}
                  className="px-5 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white font-medium rounded-lg transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Légende - Style PDF SOMONE mode clair */}
      <div className="mt-10 flex items-center justify-start gap-8 flex-wrap py-4">
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
