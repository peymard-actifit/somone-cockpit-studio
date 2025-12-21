import { useState, useRef } from 'react';
import type { SubElement } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import AlertPopup from './AlertPopup';
import { MuiIcon } from './IconPicker';
import { useConfirm } from '../contexts/ConfirmContext';

interface SubElementTileProps {
  subElement: SubElement;
  breadcrumb: {
    domain: string;
    category: string;
    element: string;
    subCategory: string;
  };
  readOnly?: boolean;
  subCategoryId?: string; // Pour le drag and drop
  index?: number; // Index dans la sous-catégorie pour le réordonnancement
  totalElements?: number; // Nombre total de sous-éléments dans la sous-catégorie
  onReorder?: (draggedSubElementId: string, targetIndex: number) => void; // Callback pour réordonner
  onSubElementClick?: (subElementId: string) => void; // Callback pour ouvrir le menu d'édition
  isVertical?: boolean; // Si la sous-catégorie est verticale
  columnWidth?: number; // Largeur de la colonne pour les sous-catégories verticales
}

export default function SubElementTile({ subElement, breadcrumb, readOnly = false, subCategoryId, index, totalElements, onReorder, onSubElementClick, isVertical = false, columnWidth }: SubElementTileProps) {
  const [showAlert, setShowAlert] = useState(false);
  const { deleteSubElement, duplicateSubElementLinked } = useCockpitStore();
  const confirm = useConfirm();
  const colors = STATUS_COLORS[subElement.status];
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const hasDraggedRef = useRef<boolean>(false); // Pour distinguer drag du clic
  const preventClickRef = useRef<boolean>(false); // Pour empêcher le onClick après un drag

  // Gestion du drag and drop
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    if (readOnly || !subCategoryId) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/subelement', JSON.stringify({
      subElementId: subElement.id,
      subCategoryId: subCategoryId,
    }));
    e.currentTarget.style.opacity = '0.5';
    setIsDragging(true);
    hasDraggedRef.current = false; // Réinitialiser au début du drag
    preventClickRef.current = false;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity = '1';
    setIsDraggingOver(false);
    setIsDragging(false);

    // Si on a vraiment déplacé (drag), empêcher le clic
    if (hasDraggedRef.current) {
      preventClickRef.current = true;
      // Réinitialiser après un court délai
      setTimeout(() => {
        preventClickRef.current = false;
        hasDraggedRef.current = false;
      }, 300);
    }
  };

  // Gestion du drop sur cette tuile (pour réordonnancement)
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly || !subCategoryId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly || !subCategoryId || !onReorder || typeof index === 'undefined') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    try {
      const data = e.dataTransfer.getData('application/subelement');
      if (!data) return;

      const { subElementId: draggedSubElementId, subCategoryId: fromSubCategoryId } = JSON.parse(data);

      // Si c'est la même sous-catégorie et un sous-élément différent, c'est un réordonnancement
      if (fromSubCategoryId === subCategoryId && draggedSubElementId !== subElement.id && onReorder) {
        // Déterminer la position selon la position de la souris
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const isBefore = mouseY < rect.height / 2;

        // Placer avant ou après selon la position de la souris
        const targetIndex = isBefore ? index : Math.min((index || 0) + 1, totalElements || 0);
        onReorder(draggedSubElementId, targetIndex);
        hasDraggedRef.current = true; // On a fait un drag
      }
    } catch (error) {
      console.error('Erreur lors du drop:', error);
    }
  };

  // Gérer le mouvement de la souris pendant le drag pour détecter si on a vraiment déplacé
  const handleMouseMove = () => {
    if (isDragging) {
      hasDraggedRef.current = true;
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    const confirmed = await confirm({
      title: 'Supprimer le sous-élément',
      message: `Voulez-vous supprimer le sous-élément "${subElement.name}" ?`,
    });
    if (confirmed) {
      deleteSubElement(subElement.id);
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    duplicateSubElementLinked(subElement.id);
  };

  // Les tuiles vertes et grises ne montrent pas d'alerte
  const hasAlert = ['fatal', 'critique', 'mineur'].includes(subElement.status);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Ne pas ouvrir le menu si on vient de faire un drag
    if (preventClickRef.current) {
      return;
    }

    // Si en mode lecture seule, juste ouvrir l'alerte si présente
    if (readOnly) {
      if (hasAlert) {
        setShowAlert(true);
      }
      return;
    }

    // En mode édition, ouvrir le menu d'édition du sous-élément
    if (onSubElementClick) {
      onSubElementClick(subElement.id);
    } else if (hasAlert) {
      // Fallback : ouvrir l'alerte si pas de callback
      setShowAlert(true);
    }
  };

  // Style PDF SOMONE : Tuile avec fond de couleur selon statut
  return (
    <>
      <button
        onClick={handleClick}
        disabled={readOnly && !hasAlert}
        draggable={!readOnly && !!subCategoryId}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseMove={handleMouseMove}
        className={`
          group relative overflow-hidden
          ${isVertical ? 'w-full' : 'min-w-[150px]'} ${isVertical ? '' : 'px-4'} py-3
          min-h-[56px]
          rounded-lg
          shadow-sm hover:shadow-md
          transition-all duration-200
          text-left
          ${!readOnly && subCategoryId
            ? (isDragging ? 'cursor-grabbing' : 'cursor-grab')
            : (hasAlert ? 'cursor-pointer' : 'cursor-default')
          }
          ${hasAlert ? 'hover:scale-[1.02]' : ''}
          ${isDraggingOver ? 'ring-2 ring-white/50 ring-offset-2' : ''}
        `}
        style={{
          backgroundColor: colors.hex,
          ...(isVertical && columnWidth ? {
            width: `${columnWidth - 32}px`,
            maxWidth: `${columnWidth - 32}px`,
            marginLeft: 'auto',
            marginRight: 'auto'
          } : {})
        }}
      >
        {/* Contenu */}
        <div className={`flex items-center gap-3 ${isVertical ? 'px-2' : ''}`}>
          {/* Icône (si présente) */}
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            {subElement.icon ? (
              <MuiIcon name={subElement.icon} size={18} className="text-white" />
            ) : (
              <MuiIcon name="Store" size={18} className="text-white" />
            )}
          </div>

          {/* Nom du sous-élément */}
          <h4 className="text-white font-semibold text-sm leading-tight line-clamp-2 flex-1">
            {subElement.name}
          </h4>
          
          {/* Indicateur de liaison - visible au survol */}
          {subElement.linkedGroupId && (
            <div 
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-white/40 rounded-full p-1"
              title="🔗 Ce sous-élément est lié à d'autres sous-éléments"
            >
              <MuiIcon name="Link" size={14} className="text-white" />
            </div>
          )}
        </div>

        {/* Valeur et unité (si présent) */}
        {subElement.value && (
          <div className={`flex items-baseline gap-1 mt-2 pt-2 border-t border-white/20 ${isVertical ? 'px-2' : ''}`}>
            <span className="text-lg font-bold text-white">
              {subElement.value}
            </span>
            {subElement.unit && (
              <span className="text-xs text-white/80">{subElement.unit}</span>
            )}
          </div>
        )}

        {/* Indicateur d'alerte */}
        {hasAlert && (
          <div className="absolute top-2 right-2">
            <span className="text-white/80 text-xs">ⓘ</span>
          </div>
        )}

        {/* Boutons (visibles au survol) */}
        {!readOnly && (
          <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDuplicate}
              className="p-1 bg-white/30 text-white rounded-md hover:bg-white/40"
              title="Dupliquer (lié)"
            >
              <MuiIcon name="ContentCopy" size={12} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 bg-white/20 text-white rounded-md hover:bg-white/30"
              title="Supprimer le sous-élément"
            >
              <MuiIcon name="Delete" size={12} />
            </button>
          </div>
        )}
      </button>

      {/* Popup d'alerte */}
      {showAlert && subElement.alert && (
        <AlertPopup
          alert={subElement.alert}
          subElement={subElement}
          breadcrumb={breadcrumb}
          onClose={() => setShowAlert(false)}
        />
      )}

      {/* Popup d'alerte par défaut si pas d'alerte définie */}
      {showAlert && !subElement.alert && (
        <AlertPopup
          alert={{
            id: 'temp',
            subElementId: subElement.id,
            date: new Date().toISOString(),
            description: `Alerte ${STATUS_LABELS[subElement.status]} sur ${subElement.name}`,
          }}
          subElement={subElement}
          breadcrumb={breadcrumb}
          onClose={() => setShowAlert(false)}
        />
      )}
    </>
  );
}
