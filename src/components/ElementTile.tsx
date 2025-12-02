import type { Element } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { STATUS_COLORS } from '../types';
import { MuiIcon } from './IconPicker';
import { useConfirm } from '../contexts/ConfirmContext';

interface ElementTileProps {
  element: Element;
  mini?: boolean;
}

export default function ElementTile({ element, mini = false }: ElementTileProps) {
  const { setCurrentElement, deleteElement } = useCockpitStore();
  const confirm = useConfirm();
  const colors = STATUS_COLORS[element.status];
  
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: 'Supprimer l\'élément',
      message: `Voulez-vous supprimer l'élément "${element.name}" ?`,
    });
    if (confirmed) {
      deleteElement(element.id);
    }
  };
  
  const handleClick = () => {
    setCurrentElement(element.id);
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
  return (
    <button
      onClick={handleClick}
      className="
        group relative
        w-[200px] h-[140px]
        bg-white hover:bg-[#FAFBFC]
        border border-[#E2E8F0] hover:border-[#CBD5E1]
        rounded-xl
        shadow-sm hover:shadow-md
        transition-all duration-200
        hover:scale-[1.02]
        cursor-pointer
        text-left
        flex
        overflow-hidden
      "
    >
      {/* Barre de couleur À GAUCHE - Style PDF SOMONE */}
      <div 
        className="w-1.5 h-full flex-shrink-0"
        style={{ backgroundColor: colors.hex }}
      />
      
      {/* Contenu principal */}
      <div className="flex-1 p-3 flex flex-col min-h-0">
        {/* Nom de l'élément en haut - plus d'espace */}
        <h4 className="text-[#1E3A5F] font-semibold text-sm leading-snug line-clamp-3 mb-2 pr-6">
          {element.name}
        </h4>
        
        {/* Espace flexible */}
        <div className="flex-1" />
        
        {/* Zone basse : Icône + Valeur sur la même ligne */}
        <div className="flex items-end justify-between gap-2">
          {/* Icône principale - taille réduite */}
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
          
          {/* Valeur et unité (si présent) - alignés à droite */}
          {element.value ? (
            <div className="flex items-baseline gap-1 flex-1 justify-end">
              <span 
                className="text-base font-bold"
                style={{ color: colors.hex }}
              >
                {element.value}
              </span>
              {element.unit && (
                <span className="text-[10px] text-[#64748B]">{element.unit}</span>
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
      
      {/* Zone (badge discret) */}
      {element.zone && (
        <span className="absolute top-2 right-2 text-[8px] text-[#94A3B8] uppercase tracking-wider bg-[#F5F7FA] px-1 py-0.5 rounded border border-[#E2E8F0]">
          {element.zone}
        </span>
      )}
      
      {/* Bouton supprimer (visible au survol) - en haut à droite */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1 bg-[#E57373] text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 shadow-sm"
        title="Supprimer l'élément"
      >
        <MuiIcon name="Trash2" size={12} />
      </button>
    </button>
  );
}
