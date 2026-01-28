import type { Element, Domain } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { STATUS_COLORS, getEffectiveColors } from '../types';
import { MuiIcon } from './IconPicker';
import { useConfirm } from '../contexts/ConfirmContext';
import { useZoom } from '../contexts/ZoomContext';
import { useState, useRef, useEffect } from 'react';

interface ElementTileProps {
  element: Element;
  mini?: boolean;
  onElementClick?: (elementId: string) => void;
  readOnly?: boolean;
  categoryId?: string; // Pour le drag and drop
  index?: number; // Index dans la catégorie pour le réordonnancement
  totalElements?: number; // Nombre total d'éléments dans la catégorie
  onReorder?: (draggedElementId: string, targetIndex: number) => void; // Callback pour réordonner
  domainId?: string; // ID du domaine pour les préférences indépendantes
  domains?: Domain[]; // Domaines pour calculer l'héritage (mode public)
}

export default function ElementTile({ element, mini = false, onElementClick, readOnly = false, categoryId, index, totalElements, onReorder, domainId, domains: domainsProp }: ElementTileProps) {
  const { setCurrentElement, deleteElement, duplicateElementLinked, currentCockpit } = useCockpitStore();
  const confirm = useConfirm();
  // Utiliser les domaines passés en prop (mode public) ou ceux du store (mode édition)
  const domains = domainsProp || currentCockpit?.domains;
  // Utiliser la couleur effective (gère le cas hérité et héritage domaine)
  const colors = getEffectiveColors(element, domains);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isOkStatus = colors.hex === STATUS_COLORS.ok.hex;
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Récupérer le contexte de zoom pour compenser la taille du texte
  const { textCompensation } = useZoom();

  // Préférence pour l'affichage des tuiles vertes (ok) - avec état React pour réactivité (indépendante par domaine)
  const storageKey = domainId ? `domain_${domainId}` : 'global';
  const [greenTilesAsColored, setGreenTilesAsColored] = useState(() => {
    const saved = localStorage.getItem(`greenTilesAsColored_${storageKey}`);
    return saved === 'true';
  });
  const shouldUseWhiteBackground = isOkStatus && !greenTilesAsColored;

  // Écouter les changements de préférence
  useEffect(() => {
    const handlePreferenceChange = () => {
      setGreenTilesAsColored(localStorage.getItem(`greenTilesAsColored_${storageKey}`) === 'true');
    };

    window.addEventListener(`greenTilesPreferenceChanged_${storageKey}`, handlePreferenceChange);

    return () => {
      window.removeEventListener(`greenTilesPreferenceChanged_${storageKey}`, handlePreferenceChange);
    };
  }, [storageKey]);

  // Convertir la couleur hex en rgba pour avoir 20% d'opacité (80% de transparence - plus clair)
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Appliquer le style de fond quand le statut change
  useEffect(() => {
    if (!buttonRef.current || mini) return;
    if (shouldUseWhiteBackground) {
      buttonRef.current.style.backgroundColor = '#FFFFFF';
    } else {
      buttonRef.current.style.backgroundColor = hexToRgba(colors.hex, 0.2);
    }
  }, [element.status, colors.hex, shouldUseWhiteBackground, mini]);

  // Gestion du drag and drop
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    if (readOnly || mini || !categoryId) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/element', JSON.stringify({
      elementId: element.id,
      categoryId: categoryId,
    }));
    e.currentTarget.style.opacity = '0.5';
    setIsDragging(true);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity = '1';
    setIsDraggingOver(false);
    setIsDragging(false);
    // Réinitialiser le style de fond
    if (shouldUseWhiteBackground) {
      e.currentTarget.style.backgroundColor = '#FFFFFF';
    } else {
      e.currentTarget.style.backgroundColor = hexToRgba(colors.hex, 0.2);
    }
  };

  // Gestion du drop sur cette tuile (pour réordonnancement)
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly || mini || !categoryId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly || mini || !categoryId || !onReorder || typeof index === 'undefined') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    try {
      const data = e.dataTransfer.getData('application/element');
      if (!data) return;

      const { elementId: draggedElementId, categoryId: fromCategoryId } = JSON.parse(data);

      // Si c'est la même catégorie et un élément différent, c'est un réordonnancement
      if (fromCategoryId === categoryId && draggedElementId !== element.id && onReorder) {
        // Déterminer la position selon la position de la souris
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const isBefore = mouseY < rect.height / 2;

        // Placer avant ou après selon la position de la souris
        const targetIndex = isBefore ? index : Math.min((index || 0) + 1, totalElements || 0);
        onReorder(draggedElementId, targetIndex);
      }
    } catch (error) {
      console.error('Erreur lors du drop:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    const confirmed = await confirm({
      title: 'Supprimer l\'élément',
      message: `Voulez-vous supprimer l'élément "${element.name}" ?`,
    });
    if (confirmed) {
      deleteElement(element.id);
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    duplicateElementLinked(element.id);
  };

  const handleClick = () => {
    if (onElementClick) {
      onElementClick(element.id);
    } else {
      setCurrentElement(element.id);
    }
  };

  if (mini) {
    // Version mini pour les cartes et vues avec image de fond
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md transition-all hover:scale-105 hover:shadow-lg border border-[#E2E8F0]"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: colors.hex }}
        />
        <span className="text-sm font-medium text-[#1E3A5F] truncate">{element.name}</span>
      </button>
    );
  }

  // Tuile standard conforme au PDF SOMONE - Fond blanc avec barre de couleur À GAUCHE
  // Si le statut n'est pas "ok", le fond est rempli avec la couleur du statut à 20% d'opacité (80% de transparence - plus clair)

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      draggable={!readOnly && !mini && !!categoryId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        group relative
        w-[200px] h-[140px]
        border rounded-xl
        shadow-sm hover:shadow-md
        transition-all duration-200
        hover:scale-[1.02]
        text-left
        flex
        overflow-hidden
        ${!readOnly && !mini && categoryId
          ? (isDragging ? 'cursor-grabbing' : 'cursor-grab')
          : 'cursor-pointer'
        }
        ${isDraggingOver ? 'border-[#1E3A5F] border-2 ring-2 ring-[#1E3A5F]/20' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}
      `}
      style={{
        backgroundColor: shouldUseWhiteBackground ? '#FFFFFF' : hexToRgba(colors.hex, 0.2),
        transition: 'background-color 0.2s ease-out',
      } as React.CSSProperties & { backgroundColor?: string }}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isDragging) {
          if (shouldUseWhiteBackground) {
            e.currentTarget.style.backgroundColor = '#FAFBFC';
          } else {
            e.currentTarget.style.backgroundColor = hexToRgba(colors.hex, 0.3);
          }
        }
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isDragging) {
          if (shouldUseWhiteBackground) {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          } else {
            e.currentTarget.style.backgroundColor = hexToRgba(colors.hex, 0.2);
          }
        }
      }}
    >
      {/* Barre de couleur À GAUCHE - Style PDF SOMONE */}
      <div
        className="w-1.5 h-full flex-shrink-0"
        style={{ backgroundColor: colors.hex }}
      />

      {/* Contenu principal */}
      <div className="flex-1 p-3 flex flex-col min-h-0">
        {/* Nom de l'élément en haut - plus d'espace */}
        {/* La taille du texte est compensée quand le zoom est < 100% pour rester lisible */}
        <div className="flex items-start gap-1 mb-2 pr-6">
          <h4 
            className="text-[#1E3A5F] font-semibold leading-snug flex-1 overflow-hidden"
            style={{ 
              fontSize: `${0.875 * textCompensation}rem`, // text-sm = 0.875rem
              // Réduire le nombre de lignes quand le texte est compensé pour qu'il reste dans la tuile
              display: '-webkit-box',
              WebkitLineClamp: textCompensation > 1.5 ? 2 : 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {element.name}
          </h4>
        </div>

        {/* Espace flexible */}
        <div className="flex-1" />

        {/* Zone basse : Icône + Liaison + Valeur sur la même ligne */}
        <div className="flex items-end justify-between gap-2">
          {/* Icône principale + indicateur de liaison */}
          <div className="flex items-center gap-1">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${colors.hex}20`, color: colors.hex }}
            >
              {element.icon ? (
                <MuiIcon name={element.icon} size={16} />
              ) : (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors.hex }}
                />
              )}
            </div>
            {/* Indicateur de liaison - visible au survol, à droite de l'icône */}
            {element.linkedGroupId && (
              <div 
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-blue-500 rounded-full p-1"
                title="🔗 Cet élément est lié à d'autres éléments"
              >
                <MuiIcon name="Link" size={14} className="text-white" />
              </div>
            )}
          </div>

          {/* Valeur et unité (si présent) - alignés à droite */}
          {/* La taille du texte est compensée quand le zoom est < 100% pour rester lisible */}
          {element.value ? (
            <div className="flex items-baseline gap-1 flex-1 justify-end overflow-hidden">
              <span
                className="font-bold truncate"
                style={{ 
                  color: colors.hex,
                  fontSize: `${1 * textCompensation}rem`, // text-base = 1rem
                }}
              >
                {element.value}
              </span>
              {element.unit && (
                <span 
                  className="text-[#64748B] flex-shrink-0"
                  style={{ fontSize: `${0.625 * textCompensation}rem` }} // 10px = 0.625rem
                >
                  {element.unit}
                </span>
              )}
            </div>
          ) : (
            /* Icônes secondaires - seulement si pas de valeur */
            <div className="flex items-center gap-1">
              {element.icon2 && (
                <MuiIcon name={element.icon2} size={14} className="text-[#94A3B8]" />
              )}
              {element.icon3 && (
                <MuiIcon name={element.icon3} size={14} className="text-[#94A3B8]" />
              )}
            </div>
          )}
        </div>

        {/* Icônes secondaires en dessous si valeur présente */}
        {element.value && (element.icon2 || element.icon3) && (
          <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[#E2E8F0]">
            {element.icon2 && (
              <MuiIcon name={element.icon2} size={12} className="text-[#94A3B8]" />
            )}
            {element.icon3 && (
              <MuiIcon name={element.icon3} size={12} className="text-[#94A3B8]" />
            )}
          </div>
        )}
      </div>


      {/* Boutons (visibles au survol) - en haut à droite */}
      {!readOnly && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDuplicate}
            className="p-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-sm"
            title="Dupliquer (lié)"
          >
            <MuiIcon name="ContentCopy" size={12} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 bg-[#E57373] text-white rounded-md hover:bg-red-500 shadow-sm"
            title="Supprimer l'élément"
          >
            <MuiIcon name="Delete" size={12} />
          </button>
        </div>
      )}
    </button>
  );
}
