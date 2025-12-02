import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { useState } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';

export default function Navbar() {
  const { currentCockpit, currentDomainId, setCurrentDomain, addDomain, deleteDomain } = useCockpitStore();
  const confirm = useConfirm();
  const [isAdding, setIsAdding] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  
  if (!currentCockpit) return null;
  
  const domains = currentCockpit.domains || [];
  const canAddMore = domains.length < 6;
  
  const handleAddDomain = () => {
    if (newDomainName.trim()) {
      addDomain(newDomainName.trim());
      setNewDomainName('');
      setIsAdding(false);
    }
  };
  
  return (
    <nav className="bg-[#1E3A5F]">
      <div className="flex items-center">
        {/* Domaines - Style bandeau PDF SOMONE */}
        <div className="flex items-center flex-1">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setCurrentDomain(domain.id)}
              className={`
                group relative flex items-center gap-2 px-6 py-3 
                text-sm font-semibold
                transition-all duration-200
                ${currentDomainId === domain.id
                  ? 'bg-white text-[#1E3A5F] rounded-t-lg'
                  : 'text-white hover:bg-white/10'
                }
              `}
            >
              <span>{domain.name}</span>
              
              {/* Indicateur point rouge si alerte */}
              {currentDomainId === domain.id && (
                <div className="absolute -top-1 right-2 w-2 h-2 bg-[#E57373] rounded-full" />
              )}
              
              {/* Bouton supprimer - visible au survol */}
              {domains.length > 1 && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const confirmed = await confirm({
                      title: 'Supprimer le domaine',
                      message: `Voulez-vous supprimer le domaine "${domain.name}" et tout son contenu ?`,
                    });
                    if (confirmed) {
                      deleteDomain(domain.id);
                    }
                  }}
                  className={`ml-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${
                    currentDomainId === domain.id
                      ? 'text-red-500 hover:bg-red-50'
                      : 'text-white/70 hover:text-red-300 hover:bg-red-500/20'
                  }`}
                  title="Supprimer ce domaine"
                >
                  <MuiIcon name="Trash2" size={14} />
                </button>
              )}
            </button>
          ))}
          
          {/* Bouton ajouter domaine */}
          {canAddMore && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-5 py-3 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <MuiIcon name="Plus" size={16} />
              <span className="text-sm font-medium">Ajouter</span>
            </button>
          )}
          
          {/* Input nouveau domaine */}
          {isAdding && (
            <div className="flex items-center gap-2 px-4 py-2">
              <input
                type="text"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddDomain();
                  if (e.key === 'Escape') {
                    setIsAdding(false);
                    setNewDomainName('');
                  }
                }}
                placeholder="Nom du domaine"
                className="px-3 py-1.5 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/60 w-40"
                autoFocus
              />
              <button
                onClick={handleAddDomain}
                className="p-1.5 bg-white text-[#1E3A5F] hover:bg-white/90 rounded-lg transition-colors"
              >
                <MuiIcon name="Plus" size={16} />
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewDomainName('');
                }}
                className="p-1.5 text-white/70 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={16} />
              </button>
            </div>
          )}
        </div>
        
        {/* Indicateur max */}
        {!canAddMore && (
          <span className="px-4 py-3 text-xs text-white/50">
            Max 6 domaines
          </span>
        )}
      </div>
    </nav>
  );
}
