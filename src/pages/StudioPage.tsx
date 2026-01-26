import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCockpitStore, RecentChange } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { useContextualHelp } from '../contexts/ContextualHelpContext';
import Navbar from '../components/Navbar';
import DomainView from '../components/DomainView';
import ElementView from '../components/ElementView';
import EditorPanel from '../components/EditorPanel';
import AIPromptInput from '../components/AIPromptInput';
import TranslationButton from '../components/TranslationButton';
import MindMapView from '../components/MindMapView';
import PresentationConfigModal from '../components/PresentationConfigModal';
import { MuiIcon } from '../components/IconPicker';
import { VERSION_DISPLAY } from '../config/version';

// Composant pour afficher le fil des modifications
function RecentChangesMarquee({ changes }: { changes: RecentChange[] }) {
  const [displayedChanges, setDisplayedChanges] = useState<RecentChange[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ajouter les nouvelles modifications avec animation
  useEffect(() => {
    if (changes.length > 0) {
      setDisplayedChanges(changes.slice(0, 5)); // Garder les 5 dernières
    }
  }, [changes]);

  // Nettoyer les modifications après 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayedChanges(prev =>
        prev.filter(c => Date.now() - c.timestamp < 10000)
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTypeIcon = (type: RecentChange['type']) => {
    switch (type) {
      case 'domain': return 'Dashboard';
      case 'category': return 'FolderOpen';
      case 'element': return 'Widgets';
      case 'subCategory': return 'Category';
      case 'subElement': return 'Extension';
      case 'mapElement': return 'Place';
      default: return 'Edit';
    }
  };

  const getTypeLabel = (type: RecentChange['type']) => {
    switch (type) {
      case 'domain': return 'Domaine';
      case 'category': return 'Cat.';
      case 'element': return 'Élém.';
      case 'subCategory': return 'Sous-cat.';
      case 'subElement': return 'Sous-élém.';
      case 'mapElement': return 'Point';
      default: return '';
    }
  };

  if (displayedChanges.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1 overflow-hidden max-w-[300px]"
    >
      <div className="flex items-center gap-2 animate-pulse">
        {displayedChanges.slice(0, 3).map((change, index) => (
          <div
            key={change.id}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-all duration-500 ${index === 0 ? 'bg-green-500/30 text-green-200' : 'bg-white/10 text-white/50'
              }`}
            style={{
              opacity: 1 - (index * 0.3),
              transform: `scale(${1 - (index * 0.05)})`,
            }}
          >
            <MuiIcon name={getTypeIcon(change.type)} size={10} />
            <span className="truncate max-w-[80px]">
              {getTypeLabel(change.type)} {change.name}
            </span>
          </div>
        ))}
      </div>
      {displayedChanges.length > 3 && (
        <span className="text-[10px] text-white/40">+{displayedChanges.length - 3}</span>
      )}
    </div>
  );
}

export default function StudioPage() {
  const { cockpitId } = useParams<{ cockpitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { enableGlobalContextMenu, disableGlobalContextMenu, enableHoverHelp, disableHoverHelp } = useContextualHelp();
  const {
    currentCockpit,
    currentDomainId,
    currentElementId,
    fetchCockpit,
    exportToExcel,
    isLoading,
    error,
    setCurrentElement,
    setCurrentDomain,
    recentChanges
  } = useCockpitStore();

  const [showEditor, setShowEditor] = useState(false); // Masqué par défaut
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSubElementId, setSelectedSubElementId] = useState<string | null>(null);
  const [showMindMap, setShowMindMap] = useState(false); // Vue éclatée
  const [showPresentation, setShowPresentation] = useState(false); // Modal de génération de présentations
  
  // État pour la navigation depuis la vue éclatée
  const [cameFromMindMap, setCameFromMindMap] = useState(false);
  const [mindMapState, setMindMapState] = useState<{
    focusedNodeId: string | null;
    focusedNodeType: 'cockpit' | 'domain' | 'element' | 'subElement' | null;
    scale: number;
    position: { x: number; y: number };
  } | undefined>(undefined);

  // Activer l'aide contextuelle par clic droit dans le studio
  useEffect(() => {
    enableGlobalContextMenu();
    return () => {
      disableGlobalContextMenu();
    };
  }, [enableGlobalContextMenu, disableGlobalContextMenu]);

  // Activer/désactiver l'aide au survol selon l'option du cockpit (activé par défaut)
  useEffect(() => {
    // Par défaut (undefined), l'aide au survol est activée
    if (currentCockpit?.showHelpOnHover !== false) {
      enableHoverHelp();
    } else {
      disableHoverHelp();
    }
    return () => {
      disableHoverHelp();
    };
  }, [currentCockpit?.showHelpOnHover, enableHoverHelp, disableHoverHelp]);

  useEffect(() => {
    if (cockpitId) {
      fetchCockpit(cockpitId);
    }
  }, [cockpitId, fetchCockpit]);

  const handleExport = async () => {
    setIsExporting(true);
    const blob = await exportToExcel();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentCockpit?.name || 'cockpit'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setIsExporting(false);
  };

  // Indicateur de sauvegarde auto
  useEffect(() => {
    const timeout = setTimeout(() => setIsSaving(false), 1500);
    return () => clearTimeout(timeout);
  }, [currentCockpit?.updatedAt]);

  if (isLoading || !currentCockpit) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mx-auto mb-4"><MuiIcon name="Refresh" size={40} className="text-[#1E3A5F]" /></div>
          <p className="text-[#64748B]">Chargement de la maquette...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // Protection pour les tableaux
  const currentDomain = (currentCockpit?.domains || []).find(d => d.id === currentDomainId);

  // Trouver l'élément actuel à travers les catégories - protection pour les tableaux
  let currentElement = null;
  if (currentElementId && currentDomain) {
    for (const category of (currentDomain.categories || [])) {
      const found = (category.elements || []).find(e => e.id === currentElementId);
      if (found) {
        currentElement = found;
        break;
      }
    }
  }

  // Handler pour cliquer sur un élément dans MapView ou BackgroundView
  const handleElementClick = (elementId: string) => {
    setCurrentElement(elementId);
    setShowEditor(true); // Ouvrir le menu d'édition
    setSelectedSubElementId(null); // Réinitialiser la sélection de sous-élément
  };

  // Navigation depuis la vue éclatée vers un domaine
  const handleNavigateToDomain = (domainId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(null); // Pas d'élément sélectionné, on voit la vue du domaine
    setShowMindMap(false);
    setCameFromMindMap(true);
    setShowEditor(false); // Fermer le panneau d'édition pour voir la vue domaine
    setSelectedSubElementId(null);
  };

  // Navigation depuis la vue éclatée vers un élément
  const handleNavigateToElement = (domainId: string, elementId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(elementId);
    setShowMindMap(false);
    setCameFromMindMap(true);
    setShowEditor(true);
    setSelectedSubElementId(null);
  };

  // Navigation depuis la vue éclatée vers un sous-élément
  const handleNavigateToSubElement = (domainId: string, elementId: string, subElementId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(elementId);
    setShowMindMap(false);
    setCameFromMindMap(true);
    setShowEditor(true);
    setSelectedSubElementId(subElementId);
  };

  // Retour à la vue éclatée
  const handleReturnToMindMap = () => {
    setCameFromMindMap(false);
    setShowMindMap(true);
  };

  return (
    <div 
      className="min-h-screen bg-[#F5F7FA] flex flex-col"
      data-cockpit-id={currentCockpit.id}
    >
      {/* Header - Style PDF SOMONE bleu marine */}
      <header className="bg-[#1E3A5F] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {cameFromMindMap ? (
            <button
              onClick={handleReturnToMindMap}
              className="flex items-center gap-2 px-3 py-2 text-cyan-300 hover:text-white hover:bg-cyan-600/50 rounded-lg transition-colors"
              title="Retour à la vue éclatée"
            >
              <MuiIcon name="ArrowLeft" size={20} />
              <span className="text-sm font-medium">Vue éclatée</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <MuiIcon name="ArrowLeft" size={20} />
            </button>
          )}

          <div>
            <h1 className="text-lg font-semibold text-white">{currentCockpit.name}</h1>
            <p className="text-xs text-white/60">
              Par {user?.username} · Modifié il y a quelques secondes · {VERSION_DISPLAY}
            </p>
          </div>

          {/* Indicateur de sauvegarde et fil des modifications */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-all ${isSaving
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white/60'
              }`}>
              <MuiIcon name="Save" size={12} />
              {isSaving ? 'Sauvegardé' : 'Auto-save'}
            </div>

            {/* Fil des modifications récentes */}
            <RecentChangesMarquee changes={recentChanges} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Bouton Présentation (générateur de présentations IA) */}
          <button
            onClick={() => setShowPresentation(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition-colors"
            title="Générateur de présentations automatisées"
          >
            <MuiIcon name="Slideshow" size={16} />
            <span className="text-sm font-medium">Présentation</span>
          </button>

          {/* Bouton Vue éclatée (Mind Map) */}
          <button
            onClick={() => setShowMindMap(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            title="Vue éclatée de la maquette"
          >
            <MuiIcon name="AccountTree" size={16} />
            <span className="text-sm font-medium">Vue éclatée</span>
          </button>

          {/* Bouton de traduction */}
          <TranslationButton cockpitId={currentCockpit.id} />

          {/* Assistant IA */}
          <AIPromptInput />

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>
            ) : (
              <MuiIcon name="Download" size={16} />
            )}
            Export Excel
          </button>

          <button
            onClick={() => setShowEditor(!showEditor)}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={showEditor ? 'Masquer le panneau' : 'Afficher le panneau'}
          >
            {showEditor ? (
              <MuiIcon name="MenuOpen" size={20} />
            ) : (
              <MuiIcon name="Menu" size={20} />
            )}
          </button>
        </div>
      </header>

      {/* Navigation des domaines */}
      <Navbar />

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone de prévisualisation - largeur fixe pour éviter le décalage des éléments */}
        <main
          className="overflow-auto transition-all"
          style={{ width: showEditor ? 'calc(100% - 320px)' : '100%' }}
        >
          {currentElementId && currentElement ? (
            <ElementView
              element={currentElement}
              domain={currentDomain!}
              forceVerticalSubCategories={currentDomain?.templateType === 'grid'}
              onSubElementClick={(subElementId) => {
                // Ouvrir le menu d'édition et sélectionner le sous-élément
                setShowEditor(true);
                setSelectedSubElementId(subElementId);
              }}
            />
          ) : currentDomain ? (
            <DomainView domain={currentDomain} onElementClick={handleElementClick} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#64748B]">Sélectionnez ou créez un domaine</p>
            </div>
          )}
        </main>

        {/* Panneau d'édition */}
        {showEditor && (
          <EditorPanel
            domain={currentDomain}
            element={currentElement}
            selectedSubElementId={selectedSubElementId}
            onSelectSubElement={(subElementId) => setSelectedSubElementId(subElementId)}
          />
        )}
      </div>

      {/* Bandeau défilant (si configuré) - Style PDF SOMONE */}
      {currentCockpit.scrollingBanner && (
        <div className="bg-white border-t border-[#E2E8F0] py-2 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            <span className="text-[#64748B] text-sm mx-4">
              {currentCockpit.scrollingBanner}
            </span>
          </div>
        </div>
      )}

      {/* Vue éclatée (Mind Map) */}
      {showMindMap && (
        <MindMapView
          cockpit={currentCockpit}
          onClose={() => {
            setShowMindMap(false);
            setCameFromMindMap(false);
          }}
          onNavigateToDomain={handleNavigateToDomain}
          onNavigateToElement={handleNavigateToElement}
          onNavigateToSubElement={handleNavigateToSubElement}
          savedState={mindMapState}
          onSaveState={setMindMapState}
        />
      )}

      {/* Modal de génération de présentations */}
      <PresentationConfigModal
        isOpen={showPresentation}
        onClose={() => setShowPresentation(false)}
        cockpitId={currentCockpit.id}
        cockpitName={currentCockpit.name}
      />
    </div>
  );
}
