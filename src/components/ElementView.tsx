import type { Domain, Element, BackgroundMode } from '../types';
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
}

export default function ElementView({ element, domain, readOnly = false, onBack }: ElementViewProps) {
  const { setCurrentElement, addSubCategory, addSubElement, deleteSubCategory, updateElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newSubCategoryOrientation, setNewSubCategoryOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [addingSubElementToSubCategory, setAddingSubElementToSubCategory] = useState<string | null>(null);
  const [newSubElementName, setNewSubElementName] = useState('');
  
  // Modal de configuration de l'image de fond
  const [showBgConfigModal, setShowBgConfigModal] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState(element.backgroundImage || '');
  const [bgMode, setBgMode] = useState<BackgroundMode>(element.backgroundMode || 'behind');
  
  // Mettre à jour quand l'élément change
  useEffect(() => {
    setBgImageUrl(element.backgroundImage || '');
    setBgMode(element.backgroundMode || 'behind');
  }, [element.backgroundImage, element.backgroundMode]);
  
  // Gérer l'upload de fichier
  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setBgImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Sauvegarder la configuration
  const handleSaveBgConfig = () => {
    updateElement(element.id, { 
      backgroundImage: bgImageUrl || undefined,
      backgroundMode: bgMode 
    });
    setShowBgConfigModal(false);
  };
  
  // Supprimer l'image de fond
  const handleRemoveBgImage = () => {
    setBgImageUrl('');
    updateElement(element.id, { 
      backgroundImage: undefined,
      backgroundMode: undefined 
    });
    setShowBgConfigModal(false);
  };
  
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
              className="w-full h-full object-contain opacity-20"
            />
          </div>
        </div>
      )}
      
      {/* Bouton configuration image de fond (masqué en mode lecture seule) */}
      {!readOnly && (
        <button
          onClick={() => setShowBgConfigModal(true)}
          className="fixed bottom-4 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-white border border-[#E2E8F0] text-[#1E3A5F] rounded-xl hover:bg-[#F5F7FA] shadow-lg transition-all"
          title="Configurer l'image de fond"
        >
          <MuiIcon name="ImageIcon" size={20} />
          <span className="text-sm font-medium">Fond</span>
        </button>
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
          <MuiIcon name="ArrowLeftIcon" size={20} />
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
                  className="flex-1 p-4 border-r border-[#E2E8F0] last:border-r-0 bg-white"
                >
                  <div className="flex items-center gap-3">
                    {subCategory.icon && (
                      <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-lg text-white">{subCategory.icon}</span>
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
                        <MuiIcon name="Trash2" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Tuiles des sous-catégories verticales - en colonnes */}
            <div className="flex">
              {verticalSubCategories.map((subCategory) => (
                <div 
                  key={subCategory.id} 
                  className="flex-1 p-4 border-r border-[#E2E8F0] last:border-r-0"
                >
                  <div className="flex flex-col gap-3">
                    {subCategory.subElements.map((subElement) => (
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
              ))}
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
      
      {/* Modal Configuration Image de Fond */}
      {showBgConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowBgConfigModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Image de fond</h3>
              <button onClick={() => setShowBgConfigModal(false)} className="p-1 text-[#94A3B8] hover:text-[#1E3A5F]">
                <MuiIcon name="X" size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Upload de fichier */}
              <div>
                <p className="block text-sm font-medium text-[#1E3A5F] mb-2">Charger une image</p>
                <label 
                  htmlFor="element-bg-upload"
                  className="block p-6 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgFileUpload}
                    className="hidden"
                    id="element-bg-upload"
                  />
                  <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                    <MuiIcon name="Upload" size={40} className="mb-3" />
                    <span className="text-sm font-medium">Cliquez pour choisir un fichier</span>
                    <span className="text-xs mt-1 text-[#94A3B8]">PNG, JPG, GIF</span>
                  </div>
                </label>
              </div>
              
              {/* Mode d'affichage */}
              {bgImageUrl && (
                <div>
                  <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Mode d'affichage</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBgMode('behind')}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        bgMode === 'behind'
                          ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
                          : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MuiIcon name="Layers" size={20} className="text-[#1E3A5F]" />
                        <span className="font-medium text-[#1E3A5F]">En fond</span>
                      </div>
                      <p className="text-xs text-[#64748B]">Image derrière le contenu avec un voile semi-transparent</p>
                    </button>
                    <button
                      onClick={() => setBgMode('overlay')}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        bgMode === 'overlay'
                          ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
                          : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MuiIcon name="Square" size={20} className="text-[#1E3A5F]" />
                        <span className="font-medium text-[#1E3A5F]">En overlay</span>
                      </div>
                      <p className="text-xs text-[#64748B]">Image par-dessus, transparente, sans gêner les clics</p>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Aperçu */}
              {bgImageUrl && (
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                  <img 
                    src={bgImageUrl} 
                    alt="Aperçu" 
                    className="max-h-32 rounded border border-[#E2E8F0] mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Boutons */}
              <div className="flex justify-between gap-3 pt-4 border-t border-[#E2E8F0]">
                {element.backgroundImage && (
                  <button
                    onClick={handleRemoveBgImage}
                    className="px-4 py-2 text-[#E57373] hover:text-red-600 flex items-center gap-2"
                  >
                    <MuiIcon name="Trash2" size={16} />
                    Supprimer
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => {
                      setBgImageUrl(element.backgroundImage || '');
                      setBgMode(element.backgroundMode || 'behind');
                      setShowBgConfigModal(false);
                    }}
                    className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F]"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveBgConfig}
                    className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E]"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
