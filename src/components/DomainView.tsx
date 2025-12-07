import type { Domain, BackgroundMode } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import CategorySection from './CategorySection';
import MapView from './MapView';
import BackgroundView from './BackgroundView';
import { MuiIcon } from './IconPicker';
import { useState, useEffect } from 'react';
import ElementTile from './ElementTile';
import { useConfirm } from '../contexts/ConfirmContext';

interface DomainViewProps {
  domain: Domain;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
}

export default function DomainView({ domain, onElementClick, readOnly = false }: DomainViewProps) {
  const { addCategory, deleteCategory, addElement, updateDomain, moveElement, reorderElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryOrientation, setNewCategoryOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [addingElementToCategory, setAddingElementToCategory] = useState<string | null>(null);
  const [newElementName, setNewElementName] = useState('');
  const [draggingOverCategoryId, setDraggingOverCategoryId] = useState<string | null>(null);
  
  // Modal de configuration de l'image de fond
  const [showBgConfigModal, setShowBgConfigModal] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState(domain.backgroundImage || '');
  const [bgMode, setBgMode] = useState<BackgroundMode>(domain.backgroundMode || 'behind');
  // Défaut : 60% pour "behind" (voile), 40% pour "overlay" (opacité image)
  const getDefaultDarkness = (mode: BackgroundMode) => mode === 'overlay' ? 40 : 60;
  const [bgDarkness, setBgDarkness] = useState<number>(
    domain.backgroundDarkness ?? getDefaultDarkness(domain.backgroundMode || 'behind')
  );
  
  // Mettre à jour quand le domaine change
  useEffect(() => {
    setBgImageUrl(domain.backgroundImage || '');
    const newMode = domain.backgroundMode || 'behind';
    setBgMode(newMode);
    setBgDarkness(domain.backgroundDarkness ?? getDefaultDarkness(newMode));
  }, [domain.backgroundImage, domain.backgroundMode, domain.backgroundDarkness]);
  
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
    const darknessToSave = bgDarkness ?? getDefaultDarkness(bgMode);
    console.log('[DomainView] SAUVEGARDE - Darkness:', darknessToSave, 'Mode:', bgMode, 'Domain ID:', domain.id);
    updateDomain(domain.id, { 
      backgroundImage: bgImageUrl || undefined,
      backgroundMode: bgMode,
      backgroundDarkness: darknessToSave
    });
    console.log('[DomainView] SAUVEGARDE EFFECTUÉE');
    // Ne pas fermer immédiatement pour voir les changements
    setTimeout(() => {
      setShowBgConfigModal(false);
    }, 500);
  };
  
  // Supprimer l'image de fond
  const handleRemoveBgImage = () => {
    setBgImageUrl('');
    updateDomain(domain.id, { 
      backgroundImage: undefined,
      backgroundMode: undefined 
    });
    setShowBgConfigModal(false);
  };
  
  // Vue carte dynamique
  if (domain.templateType === 'map') {
    return (
      <div className="h-full">
        <MapView domain={domain} onElementClick={onElementClick} readOnly={readOnly} />
      </div>
    );
  }
  
  // Vue avec image de fond
  if (domain.templateType === 'background') {
    return (
      <div className="h-full">
        <BackgroundView domain={domain} onElementClick={onElementClick} readOnly={readOnly} />
      </div>
    );
  }
  
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(domain.id, newCategoryName.trim(), newCategoryOrientation);
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleAddElement = (categoryId: string) => {
    if (newElementName.trim()) {
      addElement(categoryId, newElementName.trim());
      setNewElementName('');
      setAddingElementToCategory(null);
    }
  };
  
  // Séparer les catégories horizontales et verticales
  const horizontalCategories = domain.categories.filter(c => c.orientation === 'horizontal');
  const verticalCategories = domain.categories.filter(c => c.orientation === 'vertical');
  
  return (
    <div 
      className="min-h-full bg-[#F5F7FA] relative"
    >
      {/* Image de fond en mode BEHIND (en dessous) - sticky pour rester dans la zone visible */}
      {domain.backgroundImage && (!domain.backgroundMode || domain.backgroundMode === 'behind') && (
        <div className="sticky top-0 h-0 z-0">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
          <img 
            src={domain.backgroundImage}
            alt=""
            className="w-full h-full object-contain"
          />
          {/* Voile semi-transparent pour la lisibilité */}
          {(() => {
            const opacity = (domain.backgroundDarkness !== undefined && domain.backgroundDarkness !== null ? domain.backgroundDarkness : 60) / 100;
            console.log('[DomainView] AFFICHAGE BEHIND - Opacity:', opacity, 'Darkness:', domain.backgroundDarkness);
            return (
              <div 
                className="absolute inset-0 bg-[#F5F7FA]" 
                style={{ opacity }}
              />
            );
          })()}
          </div>
        </div>
      )}
      
      {/* Image de fond en mode OVERLAY (au-dessus, sans gêner les clics) - sticky */}
      {domain.backgroundImage && domain.backgroundMode === 'overlay' && (
        <div className="sticky top-0 h-0 z-40">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
          {(() => {
            const opacity = (domain.backgroundDarkness !== undefined && domain.backgroundDarkness !== null ? domain.backgroundDarkness : 40) / 100;
            console.log('[DomainView] AFFICHAGE OVERLAY - Opacity:', opacity, 'Darkness:', domain.backgroundDarkness);
            return (
              <img 
                src={domain.backgroundImage}
                alt=""
                className="w-full h-full object-contain"
                style={{ opacity }}
              />
            );
          })()}
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
      
      {/* Contenu principal (z-20 pour être au-dessus de l'overlay) */}
      <div className="relative z-20 p-8">
        {/* Titre du domaine - Style PDF SOMONE mode clair */}
        <div className="mb-10">
          <h2 className="text-4xl font-bold text-[#1E3A5F] tracking-tight">{domain.name}</h2>
          {domain.templateName && (
            <span className="inline-block mt-2 px-3 py-1 bg-white rounded-full text-xs text-[#64748B] uppercase tracking-wider border border-[#E2E8F0]">
              Template: {domain.templateName}
            </span>
          )}
        </div>
      
      {/* Catégories VERTICALES : affichées côte à côte en colonnes */}
      {verticalCategories.length > 0 && (
        <div className="mb-10 bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {/* En-têtes des catégories verticales - en ligne */}
          <div className="flex border-b border-[#E2E8F0]">
            {verticalCategories.map((category) => (
              <div 
                key={category.id} 
                className="flex-1 p-4 border-r border-[#E2E8F0] last:border-r-0 bg-[#F5F7FA]"
              >
                <div className="flex items-center gap-3">
                  {category.icon && (
                    <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl text-white">{category.icon}</span>
                    </div>
                  )}
                  {!category.icon && (
                    <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MuiIcon name="Store" size={20} className="text-white" />
                    </div>
                  )}
                  <h3 className="text-base font-bold text-[#1E3A5F] flex-1">
                    {category.name}
                  </h3>
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
          
          {/* Tuiles des catégories verticales - en colonnes */}
          <div className="flex">
            {verticalCategories.map((category) => {
              // Gestion du drag and drop pour cette catégorie
              const handleDragOver = (e: React.DragEvent) => {
                if (readOnly) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDraggingOverCategoryId(category.id);
              };
              
              const handleDragLeave = () => {
                setDraggingOverCategoryId(null);
              };
              
              const handleDrop = (e: React.DragEvent) => {
                if (readOnly) return;
                e.preventDefault();
                setDraggingOverCategoryId(null);
                
                try {
                  const data = e.dataTransfer.getData('application/element');
                  if (!data) return;
                  
                  const { elementId, categoryId: fromCategoryId } = JSON.parse(data);
                  if (fromCategoryId !== category.id) {
                    moveElement(elementId, fromCategoryId, category.id);
                  }
                } catch (error) {
                  console.error('Erreur lors du drop:', error);
                }
              };
              
              return (
                <div 
                  key={category.id} 
                  className={`flex-1 p-4 border-r border-[#E2E8F0] last:border-r-0 transition-all ${
                    draggingOverCategoryId === category.id ? 'bg-[#F5F7FA] border-[#1E3A5F] border-2' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col gap-3">
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
                  {!readOnly && addingElementToCategory !== category.id && (
                    <button
                      onClick={() => setAddingElementToCategory(category.id)}
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors bg-[#F5F7FA]/50 py-4"
                    >
                      <MuiIcon name="Plus" size={20} />
                      <span className="text-sm font-medium">Ajouter</span>
                    </button>
                  )}
                  {!readOnly && addingElementToCategory === category.id && (
                    <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-3">
                      <input
                        type="text"
                        value={newElementName}
                        onChange={(e) => setNewElementName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddElement(category.id);
                          if (e.key === 'Escape') {
                            setAddingElementToCategory(null);
                            setNewElementName('');
                          }
                        }}
                        placeholder="Nom"
                        className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] mb-2"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddElement(category.id)}
                          className="flex-1 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setAddingElementToCategory(null);
                            setNewElementName('');
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
      
      {/* Catégories HORIZONTALES : affichées de manière classique */}
      <div className="space-y-10">
        {horizontalCategories.map((category) => (
          <CategorySection key={category.id} category={category} onElementClick={onElementClick} readOnly={readOnly} />
        ))}
      </div>
      
      {/* Bouton ajouter catégorie (masqué en mode lecture seule) */}
      {!readOnly && (!isAddingCategory ? (
        <button
          onClick={() => setIsAddingCategory(true)}
          className="mt-10 flex items-center gap-3 px-6 py-4 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors w-full justify-center bg-white/50"
        >
          <MuiIcon name="Plus" size={24} />
          <span className="font-semibold">Ajouter une catégorie</span>
        </button>
      ) : (
        <div className="mt-10 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <h4 className="text-[#1E3A5F] font-semibold text-lg mb-4">Nouvelle catégorie</h4>
          
          <div className="space-y-4">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nom de la catégorie"
              className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              autoFocus
            />
            
            <div className="flex items-center gap-4">
              <label className="text-[#64748B] text-sm">Orientation :</label>
              <button
                onClick={() => setNewCategoryOrientation('horizontal')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newCategoryOrientation === 'horizontal'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                }`}
              >
                Horizontal
              </button>
              <button
                onClick={() => setNewCategoryOrientation('vertical')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newCategoryOrientation === 'vertical'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                }`}
              >
                Vertical
              </button>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewCategoryName('');
                }}
                className="px-5 py-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddCategory}
                className="px-5 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white font-medium rounded-lg transition-colors"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      ))}
      
        {/* Légende des couleurs - Style PDF SOMONE */}
        <div className="mt-16 flex items-center justify-start gap-8 flex-wrap py-4">
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
                  htmlFor="domain-bg-upload"
                  className="block p-6 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgFileUpload}
                    className="hidden"
                    id="domain-bg-upload"
                  />
                  <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                    <MuiIcon name="Upload" size={40} className="mb-3" />
                    <span className="text-sm font-medium">Cliquez pour choisir un fichier</span>
                    <span className="text-xs mt-1 text-[#94A3B8]">PNG, JPG, GIF</span>
                  </div>
                </label>
              </div>
              
              {/* Mode d'affichage - Afficher seulement si une image existe */}
              {((bgImageUrl && bgImageUrl.trim() !== '') || (domain.backgroundImage && domain.backgroundImage.trim() !== '')) && (
                <div>
                  <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Mode d'affichage</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setBgMode('behind');
                        // Si pas de valeur sauvegardée, utiliser la valeur par défaut pour "behind"
                        if (bgDarkness === undefined || bgDarkness === null) {
                          setBgDarkness(domain.backgroundDarkness ?? 60);
                        }
                      }}
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
                      onClick={() => {
                        setBgMode('overlay');
                        // Si pas de valeur sauvegardée, utiliser la valeur par défaut pour "overlay"
                        if (bgDarkness === undefined || bgDarkness === null) {
                          setBgDarkness(domain.backgroundDarkness ?? 40);
                        }
                      }}
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
              
              {/* Réglage de l'assombrissement/opacité - TOUJOURS AFFICHER */}
              {(() => {
                const currentDarkness = bgDarkness ?? getDefaultDarkness(bgMode);
                console.log('[DomainView] SLIDER RENDER - Modal ouvert:', showBgConfigModal, 'Darkness:', currentDarkness, 'Mode:', bgMode);
                return (
                  <div className="mt-4 border border-red-500 p-4 bg-yellow-50">
                    <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                      {bgMode === 'behind' 
                        ? `Assombrissement de l'image : ${currentDarkness}%`
                        : `Opacité de l'image : ${currentDarkness}%`
                      }
                    </label>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentDarkness}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          console.log('[DomainView] SLIDER CHANGE:', newValue);
                          setBgDarkness(newValue);
                        }}
                        className="w-full h-3 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                        style={{
                          background: `linear-gradient(to right, #1E3A5F 0%, #1E3A5F ${currentDarkness}%, #E2E8F0 ${currentDarkness}%, #E2E8F0 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-[#64748B]">
                        <span>Clair/Transparent (0%)</span>
                        <span>Foncé/Opaque (100%)</span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1">
                        {bgMode === 'behind' 
                          ? 'Plus la valeur est élevée, plus l\'image de fond est assombrie pour améliorer la lisibilité du contenu.'
                          : 'Plus la valeur est élevée, plus l\'image est opaque (visible). Plus la valeur est faible, plus l\'image est transparente.'
                        }
                      </p>
                    </div>
                  </div>
                );
              })()}
              
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
                {domain.backgroundImage && (
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
                      setBgImageUrl(domain.backgroundImage || '');
                      setBgMode(domain.backgroundMode || 'behind');
                      setBgDarkness(domain.backgroundDarkness ?? (domain.backgroundMode === 'overlay' ? 40 : 60));
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
