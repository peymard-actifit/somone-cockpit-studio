import type { Domain, Cockpit, Category } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import CategorySection from './CategorySection';
import CategoryView from './CategoryView';
import FullDomainView from './FullDomainView';
import MapView from './MapView';
import BackgroundView from './BackgroundView';
import HoursTrackingView from './HoursTrackingView';
import GridView from './GridView';
import AlertsView from './AlertsView';
import StatsView from './StatsView';
import LibraryView from './LibraryView';
import ZoomableContainer from './ZoomableContainer';
import { MuiIcon } from './IconPicker';
import LinkElementModal from './LinkElementModal';
import { useState, useEffect, useMemo } from 'react';
import ElementTile from './ElementTile';
import { useConfirm } from '../contexts/ConfirmContext';

interface DomainViewProps {
  domain: Domain;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
  cockpit?: Cockpit; // Pour la vue publiée
}

export default function DomainView({ domain, onElementClick, readOnly = false, cockpit: cockpitProp }: DomainViewProps) {
  const { addCategory, deleteCategory, addElement, moveElement, reorderElement, findElementsByName, linkElement } = useCockpitStore();
  const confirm = useConfirm();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryOrientation, setNewCategoryOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [addingElementToCategory, setAddingElementToCategory] = useState<string | null>(null);
  const [newElementName, setNewElementName] = useState('');

  // État pour le modal de liaison d'éléments
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingElementName, setPendingElementName] = useState('');
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [existingMatches, setExistingMatches] = useState<Array<{
    id: string;
    name: string;
    location: string;
    linkedGroupId?: string;
    status: string;
    type: 'element' | 'subElement';
  }>>([]);
  
  // État pour la vue Catégorie (quand on clique sur une catégorie)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // État pour la vue Domaine Complète (quand on clique sur le titre du domaine)
  const [showFullDomainView, setShowFullDomainView] = useState(false);
  
  // Réinitialiser les vues quand on change de domaine
  useEffect(() => {
    setSelectedCategoryId(null);
    setShowFullDomainView(false);
  }, [domain.id]);
  const [draggingOverCategoryId, setDraggingOverCategoryId] = useState<string | null>(null);
  const domainStorageKey = `domain_${domain.id}`;
  const [categorySpacing, setCategorySpacing] = useState(() => {
    const saved = localStorage.getItem(`categorySpacing_${domainStorageKey}`);
    return saved ? parseInt(saved, 10) : 80;
  });
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => {
    const saved = localStorage.getItem(`horizontalSpacing_${domainStorageKey}`);
    return saved ? parseInt(saved, 10) : 50;
  });
  const [verticalCategoryWidth, setVerticalCategoryWidth] = useState(() => {
    const saved = localStorage.getItem(`verticalCategoryWidth_${domainStorageKey}`);
    return saved ? parseInt(saved, 10) : 200;
  });

  // Hook pour la vue grille - DOIT etre declare AVANT tout return conditionnel
  // pour respecter les regles des hooks React (meme ordre a chaque rendu)
  const [gridViewMode, setGridViewMode] = useState<'expanded' | 'collapsed'>(() => {
    return (localStorage.getItem(`gridViewMode_${domain.id}`) as 'expanded' | 'collapsed') || 'expanded';
  });

  useEffect(() => {
    const handleSpacingChange = () => {
      setCategorySpacing(parseInt(localStorage.getItem(`categorySpacing_${domainStorageKey}`) || '80', 10));
      setHorizontalSpacing(parseInt(localStorage.getItem(`horizontalSpacing_${domainStorageKey}`) || '50', 10));
      setVerticalCategoryWidth(parseInt(localStorage.getItem(`verticalCategoryWidth_${domainStorageKey}`) || '200', 10));
    };
    window.addEventListener(`spacingPreferenceChanged_${domainStorageKey}`, handleSpacingChange);
    window.addEventListener(`verticalCategoryWidthChanged_${domainStorageKey}`, handleSpacingChange);
    return () => {
      window.removeEventListener(`spacingPreferenceChanged_${domainStorageKey}`, handleSpacingChange);
      window.removeEventListener(`verticalCategoryWidthChanged_${domainStorageKey}`, handleSpacingChange);
    };
  }, [domainStorageKey]);

  // Hook useEffect pour le mode grille - DOIT etre declare AVANT tout return conditionnel
  useEffect(() => {
    const handleGridModeChange = () => {
      setGridViewMode((localStorage.getItem(`gridViewMode_${domain.id}`) as 'expanded' | 'collapsed') || 'expanded');
    };
    window.addEventListener(`gridViewModeChanged_${domain.id}`, handleGridModeChange);
    return () => window.removeEventListener(`gridViewModeChanged_${domain.id}`, handleGridModeChange);
  }, [domain.id]);

  // Récupérer le cockpit - DOIT être fait AVANT tout return conditionnel
  // pour les vues qui en ont besoin (alerts, stats)
  const cockpit = cockpitProp || useCockpitStore.getState().currentCockpit;
  
  // Mode cockpit original (fond transparent pour les catégories en mode publié) - activé par défaut
  const useOriginalView = cockpit?.useOriginalView !== false;

  // ============================================================================
  // TOUS LES HOOKS ET USEMEMO DOIVENT ÊTRE DÉCLARÉS ICI, AVANT TOUT RETURN CONDITIONNEL
  // (Règle #300 de React : les hooks doivent être appelés dans le même ordre à chaque rendu)
  // ============================================================================

  // Séparer les catégories horizontales et verticales (utilisé pour le calcul useMemo)
  // Les catégories sans orientation sont considérées comme horizontales par défaut
  // Protection: s'assurer que domain.categories existe
  const horizontalCategories = (domain.categories || []).filter(c => c.orientation !== 'vertical');
  const verticalCategories = (domain.categories || []).filter(c => c.orientation === 'vertical');

  // Préférence pour le mode inline des catégories horizontales (grille CSS)
  const storageKey = domain.id ? `domain_${domain.id}` : 'global';
  const [horizontalCategoriesInline, setHorizontalCategoriesInline] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`horizontalCategoriesInline_${storageKey}`) === 'true';
  });

  // Écouter les changements de préférence
  useEffect(() => {
    const handlePreferenceChange = () => {
      setHorizontalCategoriesInline(localStorage.getItem(`horizontalCategoriesInline_${storageKey}`) === 'true');
    };
    window.addEventListener(`horizontalCategoriesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    return () => {
      window.removeEventListener(`horizontalCategoriesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    };
  }, [storageKey]);

  // Calculer la largeur minimale des en-têtes de catégorie pour l'alignement
  // (basé sur le nom le plus long + icône si présente)
  // DOIT être déclaré AVANT les returns conditionnels !
  const maxCategoryHeaderWidth = useMemo(() => {
    if (horizontalCategories.length === 0) return 0;
    // Estimation améliorée pour text-lg font-bold (environ 12px par caractère en moyenne)
    // + 40px pour l'icône + 12px de gap + 24px de marge de sécurité
    const maxNameLength = Math.max(...horizontalCategories.map(c => c.name.length));
    const hasIcons = horizontalCategories.some(c => c.icon);
    // 12px par caractère pour text-lg bold, +52px si icône (40px icône + 12px gap), +24px marge
    return maxNameLength * 12 + (hasIcons ? 52 : 0) + 24;
  }, [horizontalCategories]);

  // Modal de configuration supprimée - l'édition se fait maintenant via EditorPanel

  // Vue carte dynamique
  if (domain.templateType === 'map') {
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <MapView domain={domain} onElementClick={onElementClick} readOnly={readOnly} domains={cockpit?.domains} />
      </div>
    );
  }

  // Vue avec image de fond
  if (domain.templateType === 'background') {
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <BackgroundView domain={domain} onElementClick={onElementClick} readOnly={readOnly} domains={cockpit?.domains} />
      </div>
    );
  }

  // Vue suivi des heures
  if (domain.templateType === 'hours-tracking') {
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={domain.id} readOnly={readOnly}>
          <HoursTrackingView domain={domain} readOnly={readOnly} />
        </ZoomableContainer>
      </div>
    );
  }

  // Vue grille
  if (domain.templateType === 'grid') {
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={domain.id} readOnly={readOnly}>
          <GridView domain={domain} onElementClick={onElementClick} readOnly={readOnly} viewMode={gridViewMode} domains={cockpit?.domains} />
        </ZoomableContainer>
      </div>
    );
  }

  // Vue alertes
  if (domain.templateType === 'alerts') {
    if (!cockpit) return null;
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={domain.id} readOnly={readOnly}>
          <AlertsView domain={domain} cockpit={cockpit} readOnly={readOnly} />
        </ZoomableContainer>
      </div>
    );
  }

  // Vue stats
  if (domain.templateType === 'stats') {
    if (!cockpit) return null;
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={domain.id} readOnly={readOnly}>
          <StatsView domain={domain} cockpit={cockpit} readOnly={readOnly} />
        </ZoomableContainer>
      </div>
    );
  }

  // Vue bibliothèque
  if (domain.templateType === 'library') {
    if (!cockpit) return null;
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={domain.id} readOnly={readOnly}>
          <LibraryView domain={domain} cockpit={cockpit} readOnly={readOnly} />
        </ZoomableContainer>
      </div>
    );
  }

  // chainNext: true = enchaîner sur un suivant (Entrée), false = terminer (clic bouton)
  const handleAddCategory = (chainNext: boolean = false) => {
    if (newCategoryName.trim()) {
      addCategory(domain.id, newCategoryName.trim(), newCategoryOrientation);
      setNewCategoryName('');
      if (!chainNext) {
        setIsAddingCategory(false);
      }
      // Si chainNext est true, on reste en mode ajout pour créer la suivante
    }
  };

  const handleAddElement = (categoryId: string) => {
    if (newElementName.trim()) {
      const name = newElementName.trim();

      // Vérifier s'il existe des éléments avec le même nom
      const matches = findElementsByName(name);

      if (matches.length > 0) {
        // Des éléments avec ce nom existent - afficher le modal
        setPendingElementName(name);
        setPendingCategoryId(categoryId);
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
        addElement(categoryId, name);
        setNewElementName('');
        setAddingElementToCategory(null);
      }
    }
  };

  // Créer l'élément indépendamment (sans liaison)
  const handleCreateIndependent = () => {
    if (pendingCategoryId) {
      addElement(pendingCategoryId, pendingElementName);
      setNewElementName('');
      setAddingElementToCategory(null);
    }
    setShowLinkModal(false);
  };

  // Créer l'élément et le lier à un groupe existant (avec fusion des catégories/sous-éléments)
  const handleCreateLinked = (linkedGroupId: string, linkSubElements?: boolean) => {
    if (pendingCategoryId) {
      addElement(pendingCategoryId, pendingElementName);
      // Trouver l'élément qu'on vient de créer et le lier
      setTimeout(() => {
        const cockpit = useCockpitStore.getState().currentCockpit;
        if (cockpit) {
          for (const d of cockpit.domains) {
            for (const c of d.categories) {
              if (c.id === pendingCategoryId) {
                const lastElement = c.elements[c.elements.length - 1];
                if (lastElement && lastElement.name === pendingElementName) {
                  linkElement(lastElement.id, linkedGroupId, linkSubElements);
                }
              }
            }
          }
        }
      }, 50);
      setNewElementName('');
      setAddingElementToCategory(null);
    }
    setShowLinkModal(false);
  };

  // Calculer l'opacité pour l'affichage
  const overlayOpacity = domain.backgroundDarkness !== undefined && domain.backgroundDarkness !== null
    ? domain.backgroundDarkness / 100
    : (domain.backgroundMode === 'overlay' ? 0.4 : 0.6);
  const veilOpacity = domain.backgroundDarkness !== undefined && domain.backgroundDarkness !== null
    ? domain.backgroundDarkness / 100
    : 0.6;

  // Trouver la catégorie sélectionnée pour la vue Catégorie
  const selectedCategory: Category | undefined = selectedCategoryId 
    ? (domain.categories || []).find(c => c.id === selectedCategoryId)
    : undefined;

  // Afficher la vue Domaine Complète si demandée
  if (showFullDomainView) {
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={`${domain.id}-full`} readOnly={readOnly}>
          <FullDomainView
            domain={domain}
            onBack={() => setShowFullDomainView(false)}
            onElementClick={onElementClick}
            onCategoryClick={(categoryId) => {
              // Fermer la vue domaine complète et ouvrir la vue catégorie
              setShowFullDomainView(false);
              setSelectedCategoryId(categoryId);
            }}
            readOnly={readOnly}
            domains={cockpit?.domains}
          />
        </ZoomableContainer>
      </div>
    );
  }

  // Afficher la vue Catégorie si une catégorie est sélectionnée
  if (selectedCategory) {
    return (
      <div className="h-full flex flex-col" style={{ minHeight: 0, height: '100%' }}>
        <ZoomableContainer domainId={`${domain.id}-cat-${selectedCategory.id}`} readOnly={readOnly}>
          <CategoryView
            category={selectedCategory}
            domain={domain}
            onBack={() => setSelectedCategoryId(null)}
            onElementClick={onElementClick}
            onDomainClick={() => {
              // Fermer la vue catégorie et ouvrir la vue domaine complète
              setSelectedCategoryId(null);
              setShowFullDomainView(true);
            }}
            readOnly={readOnly}
            domains={cockpit?.domains}
          />
        </ZoomableContainer>
      </div>
    );
  }

  return (
    <ZoomableContainer domainId={domain.id} className="bg-[#F5F7FA]" readOnly={readOnly}>
      <div
        className="min-h-full relative"
      >
        {/* Image de fond en mode BEHIND (en dessous) */}
        {domain.backgroundImage && (!domain.backgroundMode || domain.backgroundMode === 'behind') && (
        <div className="sticky top-0 h-0 z-0">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
            <img
              src={domain.backgroundImage}
              alt=""
              className="w-full h-full object-contain"
            />
            <div
              className="absolute inset-0 bg-[#F5F7FA]"
              style={{ opacity: veilOpacity }}
            />
          </div>
        </div>
      )}

      {/* Image de fond en mode OVERLAY (au-dessus) */}
      {domain.backgroundImage && domain.backgroundMode === 'overlay' && (
        <div className="sticky top-0 h-0 z-40">
          <div className="h-[calc(100vh-120px)] overflow-hidden pointer-events-none">
            <img
              src={domain.backgroundImage}
              alt=""
              className="w-full h-full object-contain"
              style={{ opacity: overlayOpacity }}
            />
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="relative z-20 p-8">
        {/* Titre du domaine (cliquable pour voir tous les sous-éléments) */}
        {/* La taille du texte est compensée quand le zoom est < 100% pour rester lisible */}
        <div className="mb-10">
          <button
            onClick={() => setShowFullDomainView(true)}
            className="group flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            title="Cliquez pour voir tous les indicateurs du domaine"
          >
            <h2 
              className="font-bold text-[#1E3A5F] tracking-tight group-hover:underline decoration-2 underline-offset-4"
              style={{ fontSize: 'calc(2.25rem * var(--text-compensation, 1))' }} // text-4xl = 2.25rem
            >
              {domain.name}
            </h2>
            <MuiIcon 
              name="Visibility" 
              size={24} 
              className="text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity" 
            />
          </button>
          {domain.templateName && (
            <span className="inline-block mt-2 px-3 py-1 bg-white rounded-full text-xs text-[#64748B] uppercase tracking-wider border border-[#E2E8F0]">
              Template: {domain.templateName}
            </span>
          )}
        </div>

        {/* Catégories VERTICALES */}
        {verticalCategories.length > 0 && (
          <div className={`mb-10 rounded-xl overflow-hidden ${readOnly && useOriginalView ? 'bg-transparent border-transparent shadow-none' : 'bg-white border border-[#E2E8F0] shadow-sm'}`}>
            <div className={`flex ${readOnly && useOriginalView ? '' : 'border-b border-[#E2E8F0]'}`}>
              {verticalCategories.map((category) => (
                <div
                  key={category.id}
                  className={`p-4 flex items-center justify-center ${readOnly && useOriginalView ? '' : 'border-r border-[#E2E8F0] last:border-r-0 bg-[#F5F7FA]'}`}
                  style={{
                    minWidth: `${verticalCategoryWidth}px`,
                    maxWidth: `${verticalCategoryWidth}px`,
                    flex: `0 0 ${verticalCategoryWidth}px`
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    {category.icon && (
                      <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                        <MuiIcon name={category.icon} size={24} className="text-white" />
                      </div>
                    )}
                    {!category.icon && (
                      <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                        <MuiIcon name="Store" size={20} className="text-white" />
                      </div>
                    )}
                    <h3 
                      className="font-bold text-[#1E3A5F] flex-1"
                      style={{ fontSize: 'calc(1rem * var(--text-compensation, 1))' }} // text-base = 1rem
                    >
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
                        <MuiIcon name="Delete" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex">
              {verticalCategories.map((category) => {
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
                    className={`p-4 transition-all ${readOnly && useOriginalView ? '' : 'border-r border-[#E2E8F0] last:border-r-0'} ${draggingOverCategoryId === category.id ? 'bg-[#F5F7FA] border-[#1E3A5F] border-2' : ''
                      }`}
                    style={{
                      minWidth: `${verticalCategoryWidth}px`,
                      maxWidth: `${verticalCategoryWidth}px`,
                      flex: `0 0 ${verticalCategoryWidth}px`
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col gap-3">
                      {(category.elements || []).map((element, index) => (
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
                          domainId={domain.id}
                        />
                      ))}

                      {!readOnly && addingElementToCategory !== category.id && (
                        <button
                          onClick={() => setAddingElementToCategory(category.id)}
                          className="flex items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors bg-[#F5F7FA]/50 py-4"
                        >
                          <MuiIcon name="Add" size={20} />
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

        {/* Catégories HORIZONTALES */}
        {/* Utiliser CSS Grid pour aligner les tuiles quand mode inline est activé */}
        <div 
          className={horizontalCategoriesInline ? 'grid gap-x-4' : ''}
          style={horizontalCategoriesInline ? { gridTemplateColumns: 'max-content 1fr' } : undefined}
        >
          {horizontalCategories.map((category) => {
            // Convertir la valeur du slider (0-100) en classes Tailwind
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
              <div key={category.id} className={horizontalCategoriesInline ? 'contents' : getMarginBottomClass(categorySpacing)}>
                <CategorySection
                  category={category}
                  onElementClick={onElementClick}
                  onCategoryClick={(categoryId) => setSelectedCategoryId(categoryId)}
                  readOnly={readOnly}
                  domainId={domain.id}
                  horizontalSpacing={horizontalSpacing}
                  categoryHeaderMinWidth={maxCategoryHeaderWidth}
                  domains={cockpit?.domains}
                  useGridLayout={horizontalCategoriesInline}
                  useOriginalView={readOnly && useOriginalView}
                />
              </div>
            );
          })}
        </div>

        {/* Bouton ajouter catégorie */}
        {!readOnly && (!isAddingCategory ? (
          <button
            onClick={() => setIsAddingCategory(true)}
            className="mt-10 flex items-center gap-3 px-6 py-4 border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#1E3A5F] hover:text-[#1E3A5F] rounded-xl transition-colors w-full justify-center bg-white/50"
          >
            <MuiIcon name="Add" size={24} />
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory(true); // Entrée = enchaîner
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                  }
                }}
                placeholder="Nom de la catégorie"
                className="w-full px-4 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                autoFocus
              />

              <div className="flex items-center gap-4">
                <label className="text-[#64748B] text-sm">Orientation :</label>
                <button
                  onClick={() => setNewCategoryOrientation('horizontal')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${newCategoryOrientation === 'horizontal'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                    }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => setNewCategoryOrientation('vertical')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${newCategoryOrientation === 'vertical'
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
                  onClick={() => handleAddCategory(false)} // Clic = terminer
                  className="px-5 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white font-medium rounded-lg transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Légende des couleurs */}
        <div className="mt-16 flex items-center justify-start gap-8 flex-wrap py-4">
          <LegendItem color="#8B5CF6" label="Fatal" />
          <LegendItem color="#E57373" label="Critique" />
          <LegendItem color="#FFB74D" label="Mineur" />
          <LegendItem color="#9CCC65" label="OK" />
          <LegendItem color="#9E9E9E" label="Déconnecté" />
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
    </ZoomableContainer>
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
