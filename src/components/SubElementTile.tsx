import { useState } from 'react';
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
}

export default function SubElementTile({ subElement, breadcrumb, readOnly = false, subCategoryId, index, totalElements, onReorder }: SubElementTileProps) {
  const [showAlert, setShowAlert] = useState(false);
  const { deleteSubElement } = useCockpitStore();
  const confirm = useConfirm();
  const colors = STATUS_COLORS[subElement.status];
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
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
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity = '1';
    setIsDraggingOver(false);
    setIsDragging(false);
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
      }
    } catch (error) {
      console.error('Erreur lors du drop:', error);
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
  
  // Les tuiles vertes et grises ne montrent pas d'alerte
  const hasAlert = ['fatal', 'critique', 'mineur'].includes(subElement.status);
  
  const handleClick = () => {
    if (hasAlert) {
      setShowAlert(true);
    }
  };
  
  // Style PDF SOMONE : Tuile avec fond de couleur selon statut
  return (
    <>
      <button
        onClick={handleClick}
        disabled={!hasAlert}
        draggable={!readOnly && !!subCategoryId}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          group relative overflow-hidden
          min-w-[150px] px-4 py-3
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
        }}
      >
        {/* Contenu */}
        <div className="flex items-center gap-3">
          {/* Icône (si présente) */}
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <MuiIcon name="Store" size={18} className="text-white" />
          </div>
          
          {/* Nom du sous-élément */}
          <h4 className="text-white font-semibold text-sm leading-tight line-clamp-2">
            {subElement.name}
          </h4>
        </div>
        
        {/* Valeur et unité (si présent) */}
        {subElement.value && (
          <div className="flex items-baseline gap-1 mt-2 pt-2 border-t border-white/20">
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
        
        {/* Bouton supprimer (visible au survol) */}
        {!readOnly && (
          <button
            onClick={handleDelete}
            className="absolute top-1 left-1 p-1 bg-white/20 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30"
            title="Supprimer le sous-élément"
          >
            <MuiIcon name="Trash2" size={12} />
          </button>
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
