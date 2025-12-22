import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Cockpit, Element, Category } from '../types';
import { MuiIcon } from '../components/IconPicker';
import DomainView from '../components/DomainView';
import ElementView from '../components/ElementView';
import PublicAIChat from '../components/PublicAIChat';
import { VERSION_DISPLAY } from '../config/version';
import { getDomainWorstStatus, STATUS_COLORS } from '../types';

export default function PublicCockpitPage() {
  const { publicId } = useParams();
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string | null>(null);
  const [currentElementId, setCurrentElementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicCockpit = async () => {
      try {
        console.log('Fetching public cockpit:', publicId);
        const response = await fetch(`/api/public/cockpit/${publicId}`);

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error response:', errorData);
          if (response.status === 404) {
            setError('Cette maquette n\'existe pas ou n\'est plus publiée.');
          } else {
            setError(`Erreur ${response.status}: ${errorData.error || 'Erreur inconnue'}`);
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();

        // Diagnostic approfondi : vérifier les images dans les domaines
        console.log('[PublicCockpitPage] Réponse API reçue:', {
          domainsCount: data.domains?.length || 0,
          cockpitName: data.name
        });

        if (data.domains && Array.isArray(data.domains)) {
          data.domains.forEach((domain: any, index: number) => {
            console.log(`[PublicCockpitPage] Domaine ${index + 1}: "${domain.name}" (${domain.templateType})`);
            console.log(`[PublicCockpitPage]   - Keys:`, Object.keys(domain));
            console.log(`[PublicCockpitPage]   - backgroundImage type:`, typeof domain.backgroundImage);

            if (domain.backgroundImage) {
              console.log(`[PublicCockpitPage] ✅ Domain "${domain.name}": image présente (${domain.backgroundImage.length} caractères)`);
              console.log(`[PublicCockpitPage]   - Preview:`, domain.backgroundImage.substring(0, 100));
              console.log(`[PublicCockpitPage]   - Starts with data:`, domain.backgroundImage.startsWith('data:'));
              console.log(`[PublicCockpitPage]   - Starts with data:image:`, domain.backgroundImage.startsWith('data:image'));
              console.log(`[PublicCockpitPage]   - Image length check:`, domain.backgroundImage.length > 100 ? 'LONGUE (>100)' : 'COURTE (<100)');
            } else {
              console.error(`[PublicCockpitPage] ❌ Domain "${domain.name}": PAS d'image de fond`);
              console.error(`[PublicCockpitPage]   - backgroundImage value:`, domain.backgroundImage);
              console.error(`[PublicCockpitPage]   - backgroundImage === undefined:`, domain.backgroundImage === undefined);
              console.error(`[PublicCockpitPage]   - backgroundImage === null:`, domain.backgroundImage === null);
              console.error(`[PublicCockpitPage]   - backgroundImage === '':`, domain.backgroundImage === '');
              console.error(`[PublicCockpitPage]   - Domain object:`, JSON.stringify(domain, null, 2).substring(0, 500));
            }
          });
        } else {
          console.error('[PublicCockpitPage] ❌ data.domains n\'est pas un tableau:', typeof data.domains);
        }

        setCockpit(data);

        // Sélectionner le premier domaine par défaut
        if (data.domains && data.domains.length > 0) {
          setCurrentDomainId(data.domains[0].id);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
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
      <div className="min-h-screen bg-cockpit-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <MuiIcon name="Refresh" size={48} className="text-white" />
          </div>
          <p className="text-slate-400">Chargement du cockpit...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cockpit-bg-dark flex items-center justify-center">
        <div className="text-center bg-cockpit-bg-card p-8 rounded-xl shadow-lg border border-slate-700/50 max-w-md">
          <MuiIcon name="Warning" size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Cockpit introuvable</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!cockpit) return null;

  const currentDomain = cockpit.domains.find(d => d.id === currentDomainId);

  // Trouver l'élément courant si on est en vue élément
  let currentElement: Element | null = null;
  let currentCategory: Category | null = null;
  if (currentElementId && currentDomain) {
    for (const cat of currentDomain.categories) {
      const el = cat.elements.find(e => e.id === currentElementId);
      if (el) {
        currentElement = el;
        currentCategory = cat;
        break;
      }
    }
  }

  // Handler pour cliquer sur un élément
  const handleElementClick = (elementId: string) => {
    setCurrentElementId(elementId);
  };

  // Handler pour revenir à la vue domaine
  const handleBackToDomain = () => {
    setCurrentElementId(null);
  };

  return (
    <div className="h-screen bg-cockpit-bg-dark flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-cockpit-bg-card border-b border-slate-700/50 shadow-lg z-50">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {cockpit.logo && (
                <img src={cockpit.logo} alt="Logo" className="h-10 w-auto" />
              )}
              <div>
                <h1 className="text-xl font-bold text-white">{cockpit.name}</h1>
                <p className="text-xs text-slate-500">
                  Mode consultation {VERSION_DISPLAY}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Assistant IA */}
              {publicId && cockpit && (
                <PublicAIChat publicId={publicId} cockpitName={cockpit.name} />
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <MuiIcon name="Visibility" size={16} className="text-blue-400" />
                <span className="text-sm text-blue-400">Lecture seule</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation des domaines avec indicateurs de statut */}
        <div className="bg-slate-800/30 border-t border-slate-700/30">
          <div className="px-6">
            <div className="flex gap-1 overflow-x-auto py-1">
              {cockpit.domains.map((domain) => {
                // Calculer le statut le plus critique du domaine
                const worstStatus = getDomainWorstStatus(domain as any, cockpit.domains as any);
                const statusColor = STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex;
                const hasAlert = worstStatus !== 'ok';
                const isActive = currentDomainId === domain.id;
                
                return (
                  <button
                    key={domain.id}
                    onClick={() => {
                      setCurrentDomainId(domain.id);
                      setCurrentElementId(null);
                    }}
                    style={hasAlert ? {
                      borderLeft: `3px solid ${statusColor}`,
                      borderTop: `3px solid ${statusColor}`,
                      borderRight: `3px solid ${statusColor}`,
                    } : undefined}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                      isActive
                        ? 'bg-white text-[#1E3A5F]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {/* Pastille de statut */}
                    {hasAlert && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30"
                        style={{ backgroundColor: statusColor }}
                        title={`Statut: ${worstStatus}`}
                      />
                    )}
                    {domain.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 overflow-auto flex flex-col" style={{ minHeight: 0 }}>
        {currentElement && currentCategory ? (
          // Vue Element (sous-éléments)
          <div className="flex flex-col min-h-full">
            {/* Breadcrumb */}
            <div className="bg-cockpit-bg-card border-b border-slate-700/50 px-6 py-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={handleBackToDomain}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {currentDomain?.name}
                </button>
                <MuiIcon name="ChevronRight" size={16} className="text-slate-600" />
                <span className="text-slate-400">{currentCategory.name}</span>
                <MuiIcon name="ChevronRight" size={16} className="text-slate-600" />
                <span className="text-white font-medium">{currentElement.name}</span>
              </div>
            </div>
            <div className="flex-1">
              <ElementView
                element={currentElement}
                readOnly={true}
                onBack={handleBackToDomain}
              />
            </div>
          </div>
        ) : currentDomain ? (
          // Vue Domaine
          <div className="flex flex-col min-h-full">
            <DomainView
              domain={currentDomain}
              onElementClick={handleElementClick}
              readOnly={true}
              cockpit={cockpit}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500">Aucun domaine disponible</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-cockpit-bg-card border-t border-slate-700/50 flex-shrink-0">
        {/* Bandeau défilant */}
        {cockpit.scrollingBanner && (
          <div className="bg-white py-2 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm text-black mx-4">{cockpit.scrollingBanner}</span>
              <span className="text-sm text-black mx-4">{cockpit.scrollingBanner}</span>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
