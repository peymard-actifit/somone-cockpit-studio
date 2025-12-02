import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Cockpit, Domain } from '../types';
import { MuiIcon } from '../components/IconPicker';
import { STATUS_COLORS } from '../types';

// Composants simplifiés pour l'affichage en lecture seule
import ElementTile from '../components/ElementTile';

export default function PublicCockpitPage() {
  const { publicId } = useParams();
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchPublicCockpit = async () => {
      try {
        const response = await fetch(`/api/public/cockpit/${publicId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Cette maquette n\'existe pas ou n\'est plus publiée.');
          } else {
            setError('Erreur lors du chargement de la maquette.');
          }
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        setCockpit(data);
        
        // Sélectionner le premier domaine par défaut
        if (data.domains && data.domains.length > 0) {
          setCurrentDomainId(data.domains[0].id);
        }
        
        setIsLoading(false);
      } catch (err) {
        setError('Erreur de connexion au serveur.');
        setIsLoading(false);
      }
    };
    
    if (publicId) {
      fetchPublicCockpit();
    }
  }, [publicId]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <MuiIcon name="Loader2" size={48} className="text-[#1E3A5F]" />
          </div>
          <p className="text-[#64748B]">Chargement de la maquette...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-[#E2E8F0] max-w-md">
          <MuiIcon name="AlertTriangle" size={48} className="text-[#E57373] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#1E3A5F] mb-2">Maquette introuvable</h1>
          <p className="text-[#64748B]">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!cockpit) return null;
  
  const currentDomain = cockpit.domains.find(d => d.id === currentDomainId);
  
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Header */}
      <header className="bg-[#1E3A5F] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {cockpit.logo && (
                <img src={cockpit.logo} alt="Logo" className="h-10 w-auto" />
              )}
              <div>
                <h1 className="text-xl font-bold">{cockpit.name}</h1>
                <p className="text-sm text-white/60">Mode consultation</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
              <MuiIcon name="Eye" size={16} />
              <span className="text-sm">Lecture seule</span>
            </div>
          </div>
        </div>
        
        {/* Bandeau défilant */}
        {cockpit.scrollingBanner && (
          <div className="bg-[#2C4A6E] py-2 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm text-white/80 mx-4">{cockpit.scrollingBanner}</span>
              <span className="text-sm text-white/80 mx-4">{cockpit.scrollingBanner}</span>
            </div>
          </div>
        )}
        
        {/* Navigation des domaines */}
        <div className="bg-[#2C4A6E] border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto">
              {cockpit.domains.map((domain) => (
                <button
                  key={domain.id}
                  onClick={() => setCurrentDomainId(domain.id)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    currentDomainId === domain.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {domain.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      
      {/* Contenu principal */}
      <main className="flex-1">
        {currentDomain && (
          <PublicDomainView domain={currentDomain} />
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-4">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-[#94A3B8]">
            Maquette publiée avec SOMONE Cockpit Studio
          </p>
        </div>
      </footer>
    </div>
  );
}

// Vue simplifiée d'un domaine (lecture seule)
function PublicDomainView({ domain }: { domain: Domain }) {
  const horizontalCategories = domain.categories.filter(c => c.orientation === 'horizontal');
  const verticalCategories = domain.categories.filter(c => c.orientation === 'vertical');
  
  // Pour les vues spéciales, afficher un message
  if (domain.templateType === 'map' || domain.templateType === 'background') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-[#E2E8F0]">
          <MuiIcon name="MapPinIcon" size={48} className="text-[#94A3B8] mx-auto mb-4" />
          <p className="text-[#64748B]">
            Cette vue ({domain.templateType === 'map' ? 'Carte' : 'Image de fond'}) n'est pas encore disponible en mode public.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8">
      {/* Titre du domaine */}
      <div className="mb-10">
        <h2 className="text-4xl font-bold text-[#1E3A5F] tracking-tight">{domain.name}</h2>
      </div>
      
      {/* Catégories verticales */}
      {verticalCategories.length > 0 && (
        <div className="mb-10 bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="flex border-b border-[#E2E8F0]">
            {verticalCategories.map((category) => (
              <div 
                key={category.id} 
                className="flex-1 p-4 border-r border-[#E2E8F0] last:border-r-0 bg-[#F5F7FA]"
              >
                <h3 className="text-base font-bold text-[#1E3A5F]">{category.name}</h3>
              </div>
            ))}
          </div>
          <div className="flex">
            {verticalCategories.map((category) => (
              <div 
                key={category.id} 
                className="flex-1 p-4 border-r border-[#E2E8F0] last:border-r-0"
              >
                <div className="flex flex-col gap-3">
                  {category.elements.map((element) => (
                    <PublicElementTile key={element.id} element={element} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Catégories horizontales */}
      <div className="space-y-10">
        {horizontalCategories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="p-4 bg-[#F5F7FA] border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#1E3A5F]">{category.name}</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-4">
                {category.elements.map((element) => (
                  <PublicElementTile key={element.id} element={element} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Légende */}
      <div className="mt-16 flex items-center justify-start gap-8 flex-wrap py-4">
        <LegendItem color="#8B5CF6" label="Fatal" />
        <LegendItem color="#E57373" label="Critique" />
        <LegendItem color="#FFB74D" label="Mineur" />
        <LegendItem color="#9CCC65" label="OK" />
        <LegendItem color="#9E9E9E" label="Déconnecté" />
      </div>
    </div>
  );
}

// Tuile d'élément simplifiée (lecture seule)
function PublicElementTile({ element }: { element: any }) {
  const colors = STATUS_COLORS[element.status as keyof typeof STATUS_COLORS];
  
  return (
    <div
      className="
        w-[200px] h-[140px]
        bg-white hover:bg-[#FAFBFC]
        border border-[#E2E8F0]
        rounded-xl
        shadow-sm
        text-left
        flex
        overflow-hidden
      "
    >
      {/* Barre de couleur */}
      <div 
        className="w-1.5 h-full flex-shrink-0"
        style={{ backgroundColor: colors.hex }}
      />
      
      {/* Contenu */}
      <div className="flex-1 p-3 flex flex-col min-h-0">
        <h4 className="text-[#1E3A5F] font-semibold text-sm leading-snug line-clamp-3 mb-2">
          {element.name}
        </h4>
        
        <div className="flex-1" />
        
        {/* Valeur si présente */}
        {element.value && (
          <div className="flex items-baseline gap-1">
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
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
      <span className="text-sm text-[#64748B] font-medium">{label}</span>
    </div>
  );
}

