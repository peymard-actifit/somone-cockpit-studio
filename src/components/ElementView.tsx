import type { Domain, Element } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import SubCategorySection from './SubCategorySection';
import SubElementTile from './SubElementTile';
import { MuiIcon } from './IconPicker';
import { useState, useEffect } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';

interface ElementViewProps {
  element: Element;
  domain?: Domain;
  readOnly?: boolean;
  onBack?: () => void;
  onSubElementClick?: (subElementId: string) => void; // Callback pour ouvrir le menu d'édition d'un sous-élément
}

export default function ElementView({ element, domain, readOnly = false, onBack, onSubElementClick }: ElementViewProps) {
  const { setCurrentElement, addSubCategory, addSubElement, deleteSubCategory, reorderSubElement, moveSubElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newSubCategoryOrientation, setNewSubCategoryOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [addingSubElementToSubCategory, setAddingSubElementToSubCategory] = useState<string | null>(null);
  const [newSubElementName, setNewSubElementName] = useState('');
  const [draggingOverSubCategoryId, setDraggingOverSubCategoryId] = useState<string | null>(null);
  // Préférences d'espacement (indépendantes par élément)
  const storageKey = `element_${element.id}`;
  const [verticalSubCategoryWidth, setVerticalSubCategoryWidth] = useState(() => {
    const saved = localStorage.getItem(`verticalSubCategoryWidth_${storageKey}`);
    return saved ? parseInt(saved, 10) : 200;
  });
  
  useEffect(() => {
    const handleWidthChange = () => {
      setVerticalSubCategoryWidth(parseInt(localStorage.getItem(`verticalSubCategoryWidth_${storageKey}`) || '200', 10));
    };
    window.addEventListener(`verticalSubCategoryWidthChanged_${storageKey}`, handleWidthChange);
    return () => {
      window.removeEventListener(`verticalSubCategoryWidthChanged_${storageKey}`, handleWidthChange);
    };
  }, [storageKey]);
  
  // Modal de configuration supprimée - l'édition se fait maintenant via EditorPanel
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setCurrentElement(null);
    }
  };
  
  const handleAddSubCategory = () => {
    if (newSubCategoryName.trim()) {
      addSubCategory(element.id, newSubCategoryName.trim(), newSubCategoryOrientation);
      setNewSubCategoryName('');
      setIsAddingSubCategory(false);
    }
  };
  
  const handleAddSubElement = (subCategoryId: string) => {
    if (newSubElementName.trim()) {
      addSubElement(subCategoryId, newSubElementName.trim());
      setNewSubElementName('');
      setAddingSubElementToSubCategory(null);
    }
  };
  
  // Handlers de drag-and-drop pour les sous-catégories verticales
  const handleDragOver = (e: React.DragEvent, subCategoryId: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggingOverSubCategoryId(subCategoryId);
  };
  
  const handleDragLeave = () => {
    setDraggingOverSubCategoryId(null);
  };
  
  const handleDrop = (e: React.DragEvent, subCategoryId: string) => {
    if (readOnly) return;
    e.preventDefault();
    setDraggingOverSubCategoryId(null);
    
    try {
      const data = e.dataTransfer.getData('application/subelement');
      if (!data) return;
      
      const { subElementId, subCategoryId: fromSubCategoryId } = JSON.parse(data);
      if (fromSubCategoryId !== subCategoryId) {
        moveSubElement(subElementId, fromSubCategoryId, subCategoryId);
      }
    } catch (error) {
      console.error('Erreur lors du drop:', error);
    }
  };
  
  // Trouver la catégorie parente
  const parentCategory = domain?.categories.find(c => 
    c.elements.some(e => e.id === element.id)
  );
  
  // Séparer les sous-catégories horizontales et verticales
  // Les sous-catégories sans orientation définie sont considérées comme horizontales
  const horizontalSubCategories = element.subCategories.filter(sc => sc.orientation !== 'vertical');
  const verticalSubCategories = element.subCategories.filter(sc => sc.orientation === 'vertical');
  
  
  return (
    <div className="min-h-full bg-[#F5F7FA] relative">
      {/* Image de fond en mode BEHIND (en dessous) - sticky pour rester dans la zone visible */}
      {element.backgroundImage && (!element.backgroundMode || element.backgroundMode === 'behind') && (
        <div className="sticky top-0 h-0 z-0">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
            <img 
              src={element.backgroundImage}
              alt=""
              className="w-full h-full object-contain"
              style={{ 
                opacity: element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity / 100 : 1 
              }}
            />
            {/* Voile semi-transparent pour la lisibilité */}
            <div className="absolute inset-0 bg-[#F5F7FA]/80" />
          </div>
        </div>
      )}
      
      {/* Image de fond en mode OVERLAY (au-dessus, sans gêner les clics) - sticky */}
      {element.backgroundImage && element.backgroundMode === 'overlay' && (
        <div className="sticky top-0 h-0 z-40">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
            <img 
              src={element.backgroundImage}
              alt=""
              className="w-full h-full object-contain"
              style={{ 
                opacity: element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity / 100 : 0.2 
              }}
            />
          </div>
        </div>
      )}
      
      {/* Contenu principal */}
      <div className="relative z-20 p-8">
      {/* Header avec retour - Style PDF SOMONE mode clair */}
      <div className="mb-10">
        {/* Bouton retour */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[#1E3A5F] hover:text-[#2C4A6E] transition-colors mb-6 group bg-white px-4 py-2 rounded-full border border-[#E2E8F0] shadow-sm"
        >
          <MuiIcon name="ArrowLeft" size={20} />
          <span className="font-medium">Retour{domain ? ` à ${domain.name}` : ''}</span>
        </button>
        
        {/* Breadcrumb */}
        <div className="text-sm text-[#64748B] mb-3 flex items-center gap-2">
          {domain && <span>{domain.name}</span>}
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
        {/* Sous-catégories VERTICALES : affichées côte à côte en colonnes */}
        {verticalSubCategories.length > 0 && (
          <div className="mb-10 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0] overflow-hidden">
            {/* En-têtes des sous-catégories verticales - en ligne */}
            <div className="flex border-b border-[#E2E8F0]">
              {verticalSubCategories.map((subCategory) => (
                <div 
                  key={subCategory.id} 
                  className="p-4 border-r border-[#E2E8F0] last:border-r-0 bg-white flex items-center justify-center"
                  style={{ 
                    minWidth: `${verticalSubCategoryWidth}px`,
                    maxWidth: `${verticalSubCategoryWidth}px`,
                    flex: `0 0 ${verticalSubCategoryWidth}px`
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    {subCategory.icon && (
                      <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                        <MuiIcon name={subCategory.icon} size={20} className="text-white" />
                      </div>
                    )}
                    {!subCategory.icon && (
                      <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                        <MuiIcon name="Store" size={16} className="text-white" />
                      </div>
                    )}
                    <h3 className="text-base font-bold text-[#1E3A5F] flex-1">
                      {subCategory.name}
                    </h3>
                    {!readOnly && (
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
                        className="p-1.5 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Supprimer"
                      >
                        <MuiIcon name="Delete" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Tuiles des sous-catégories verticales - en colonnes */}
            <div className="flex">
              {verticalSubCategories.map((subCategory) => {
                // Préférence de largeur pour les sous-catégories verticales
                const verticalSubCategoryWidth = (() => {
                  const saved = localStorage.getItem('verticalSubCategoryWidth');
                  const width = saved ? parseInt(saved, 10) : 200; // Défaut 200px
                  return width;
                })();
                
                return (
                <div 
                  key={subCategory.id} 
                  className={`p-4 border-r border-[#E2E8F0] last:border-r-0 transition-all rounded-lg ${
                    draggingOverSubCategoryId === subCategory.id ? 'bg-[#F5F7FA] border-2 border-[#1E3A5F]' : ''
                  }`}
                  style={{ 
                    minWidth: `${verticalSubCategoryWidth}px`,
                    maxWidth: `${verticalSubCategoryWidth}px`,
                    flex: `0 0 ${verticalSubCategoryWidth}px`
                  }}
                  onDragOver={(e) => handleDragOver(e, subCategory.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, subCategory.id)}
                >
                  <div className="flex flex-col gap-3">
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
                        onReorder={(draggedSubElementId, targetIndex) => {
                          if (!readOnly) {
                            reorderSubElement(draggedSubElementId, subCategory.id, targetIndex);
                          }
                        }}
                        onSubElementClick={onSubElementClick}
                        isVertical={true}
                        columnWidth={verticalSubCategoryWidth}
                      />
                    ))}
                    
                    {/* Bouton ajouter sous-élément */}
                    {!readOnly && addingSubElementToSubCategory !== subCategory.id && (
                      <button
                        onClick={() => setAddingSubElementToSubCategory(subCategory.id)}
                        className="flex items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors bg-white/50 py-4"
                      >
                        <MuiIcon name="Plus" size={20} />
                        <span className="text-sm font-medium">Ajouter</span>
                      </button>
                    )}
                    {!readOnly && addingSubElementToSubCategory === subCategory.id && (
                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3">
                        <input
                          type="text"
                          value={newSubElementName}
                          onChange={(e) => setNewSubElementName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddSubElement(subCategory.id);
                            if (e.key === 'Escape') {
                              setAddingSubElementToSubCategory(null);
                              setNewSubElementName('');
                            }
                          }}
                          placeholder="Nom"
                          className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] mb-2"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAddSubElement(subCategory.id)}
                            className="flex-1 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => {
                              setAddingSubElementToSubCategory(null);
                              setNewSubElementName('');
                            }}
                            className="px-2 py-1.5 text-[#64748B] hover:text-[#1E3A5F] text-sm transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Sous-catégories HORIZONTALES : affichées de manière classique */}
        <div className="space-y-10">
            {horizontalSubCategories.map((subCategory) => (
              <SubCategorySection 
                key={subCategory.id} 
                subCategory={subCategory}
                element={element}
                domain={domain}
                readOnly={readOnly}
                onSubElementClick={onSubElementClick}
                elementId={element.id}
                verticalSubCategoryWidth={verticalSubCategoryWidth}
              />
            ))}
        </div>
        
        {/* Bouton ajouter sous-catégorie */}
        {!readOnly && (
          !isAddingSubCategory ? (
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
          )
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
