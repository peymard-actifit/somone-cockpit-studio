import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCockpitStore, RecentChange } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { useContextualHelp } from '../contexts/ContextualHelpContext';
import { useTutorial } from '../contexts/TutorialContext';
import { useLanguage } from '../contexts/LanguageContext';
import Navbar from '../components/Navbar';
import DomainView from '../components/DomainView';
import ElementView from '../components/ElementView';
import EditorPanel from '../components/EditorPanel';
import AIPromptInput from '../components/AIPromptInput';
import TranslationButton from '../components/TranslationButton';
import MindMapView from '../components/MindMapView';
import PresentationConfigModal from '../components/PresentationConfigModal';
import JourneyPlayer from '../components/JourneyPlayer';
import ExamplesView from '../components/ExamplesView';
import { MuiIcon } from '../components/IconPicker';
import { VERSION_DISPLAY } from '../config/version';

// Composant mémoïsé pour afficher le fil des modifications
const RecentChangesMarquee = memo(function RecentChangesMarquee({ changes }: { changes: RecentChange[] }) {
  const [displayedChanges, setDisplayedChanges] = useState<RecentChange[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Ajouter les nouvelles modifications avec animation
  useEffect(() => {
    if (changes.length > 0) {
      setDisplayedChanges(changes.slice(0, 5)); // Garder les 5 dernières
    }
  }, [changes]);

  // Nettoyer les modifications après 10 secondes - optimisé pour ne tourner que si nécessaire
  useEffect(() => {
    if (displayedChanges.length === 0) return;
    
    const interval = setInterval(() => {
      setDisplayedChanges(prev => {
        const filtered = prev.filter(c => Date.now() - c.timestamp < 10000);
        // Ne mettre à jour que si quelque chose a changé
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [displayedChanges.length > 0]);

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
      case 'domain': return t('type.domain');
      case 'category': return t('type.category');
      case 'element': return t('type.element');
      case 'subCategory': return t('type.subCategory');
      case 'subElement': return t('type.subElement');
      case 'mapElement': return t('type.mapElement');
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
});

export default function StudioPage() {
  const { cockpitId } = useParams<{ cockpitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const { enableGlobalContextMenu, disableGlobalContextMenu, enableHoverHelp, disableHoverHelp } = useContextualHelp();
  const { startTutorial, isPlaying: isTutorialPlaying, progress: tutorialProgress } = useTutorial();
  // Sélecteurs individuels optimisés pour éviter les re-renders inutiles
  const currentCockpit = useCockpitStore(state => state.currentCockpit);
  const currentDomainId = useCockpitStore(state => state.currentDomainId);
  const currentElementId = useCockpitStore(state => state.currentElementId);
  const isLoading = useCockpitStore(state => state.isLoading);
  const error = useCockpitStore(state => state.error);
  const recentChanges = useCockpitStore(state => state.recentChanges);
  
  // Actions du store (stables)
  const fetchCockpit = useCockpitStore(state => state.fetchCockpit);
  const exportToExcel = useCockpitStore(state => state.exportToExcel);
  const setCurrentElement = useCockpitStore(state => state.setCurrentElement);
  const setCurrentDomain = useCockpitStore(state => state.setCurrentDomain);
  
  // Exemples
  const showExamples = useCockpitStore(state => state.showExamples);
  const toggleShowExamples = useCockpitStore(state => state.toggleShowExamples);

  const [showEditor, setShowEditor] = useState(false); // Masqué par défaut
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSubElementId, setSelectedSubElementId] = useState<string | null>(null);
  const [showMindMap, setShowMindMap] = useState(false); // Vue éclatée
  const [showPresentation, setShowPresentation] = useState(false); // Modal de génération de présentations
  const [showJourneyPlayer, setShowJourneyPlayer] = useState(false); // Parcours de création
  const [showActionsMenu, setShowActionsMenu] = useState(false); // Menu Actions déroulant
  const [showAIPrompt, setShowAIPrompt] = useState(false); // Fenêtre Assistant IA
  const [showTranslation, setShowTranslation] = useState(false); // Modal Traduction
  
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

  // ============================================================================
  // IMPORTANT: Tous les hooks DOIVENT être déclarés AVANT les returns conditionnels
  // pour respecter les règles de React (Hooks Rules)
  // ============================================================================
  
  // Calculs mémoïsés - AVANT les returns conditionnels
  const currentDomain = useMemo(() => 
    (currentCockpit?.domains || []).find((d: { id: string }) => d.id === currentDomainId),
    [currentCockpit?.domains, currentDomainId]
  );

  // Trouver l'élément actuel à travers les catégories - mémoïsé
  const currentElement = useMemo(() => {
    if (!currentElementId || !currentDomain) return null;
    for (const category of (currentDomain.categories || [])) {
      const found = (category.elements || []).find((e: { id: string }) => e.id === currentElementId);
      if (found) return found;
    }
    return null;
  }, [currentElementId, currentDomain]);

  // Handlers mémoïsés - AVANT les returns conditionnels
  const handleElementClick = useCallback((elementId: string) => {
    setCurrentElement(elementId);
    setShowEditor(true);
    setSelectedSubElementId(null);
  }, [setCurrentElement]);

  const handleNavigateToDomain = useCallback((domainId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(null);
    setShowMindMap(false);
    setCameFromMindMap(true);
    setShowEditor(false);
    setSelectedSubElementId(null);
  }, [setCurrentDomain, setCurrentElement]);

  const handleNavigateToElement = useCallback((domainId: string, elementId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(elementId);
    setShowMindMap(false);
    setCameFromMindMap(true);
    setShowEditor(true);
    setSelectedSubElementId(null);
  }, [setCurrentDomain, setCurrentElement]);

  const handleNavigateToSubElement = useCallback((domainId: string, elementId: string, subElementId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(elementId);
    setShowMindMap(false);
    setCameFromMindMap(true);
    setShowEditor(true);
    setSelectedSubElementId(subElementId);
  }, [setCurrentDomain, setCurrentElement]);

  const handleReturnToMindMap = useCallback(() => {
    setCameFromMindMap(false);
    setShowMindMap(true);
  }, []);

  // ============================================================================
  // Returns conditionnels - APRÈS tous les hooks
  // ============================================================================

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
              title={t('studio.backToExplodedView')}
            >
              <MuiIcon name="ArrowLeft" size={20} />
              <span className="text-sm font-medium">{t('studio.explodedView')}</span>
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
              {t('studio.by')} {user?.username} · {t('studio.modifiedAgo')} · {VERSION_DISPLAY}
            </p>
          </div>

          {/* Indicateur de sauvegarde et fil des modifications */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-all ${isSaving
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white/60'
              }`}>
              <MuiIcon name="Save" size={12} />
              {isSaving ? t('studio.saved') : t('studio.autoSave')}
            </div>

            {/* Fil des modifications récentes */}
            <RecentChangesMarquee changes={recentChanges} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Menu Actions déroulant */}
          <div className="relative">
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D4A63] hover:bg-[#3D5A73] text-white rounded-lg transition-colors border border-[#4A6D8C]"
            >
              <MuiIcon name="MoreVert" size={18} />
              <span className="text-sm font-medium">{t('studio.actions') || 'Actions'}</span>
              <MuiIcon name={showActionsMenu ? 'ExpandLess' : 'ExpandMore'} size={16} />
            </button>
            
            {showActionsMenu && (
              <>
                {/* Overlay pour fermer le menu */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowActionsMenu(false)}
                />
                
                {/* Menu déroulant */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1E3A5F] border border-[#4A6D8C] rounded-xl shadow-2xl z-50 overflow-hidden">
                  {/* Tutoriel */}
                  {!isTutorialPlaying && (user?.isAdmin || user?.userType === 'client') && (
                    <button
                      onClick={() => {
                        startTutorial();
                        setShowActionsMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-600/30 text-white transition-colors border-b border-[#4A6D8C]/50"
                    >
                      <MuiIcon name="School" size={18} className="text-emerald-400" />
                      <span className="text-sm">
                        {tutorialProgress?.completed ? t('studio.reviewTutorial') : t('studio.tutorial')}
                      </span>
                    </button>
                  )}

                  {/* Présentation */}
                  <button
                    onClick={() => {
                      setShowPresentation(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-purple-600/30 text-white transition-colors border-b border-[#4A6D8C]/50"
                  >
                    <MuiIcon name="Slideshow" size={18} className="text-purple-400" />
                    <span className="text-sm">{t('studio.presentation')}</span>
                  </button>

                  {/* Vue éclatée */}
                  <button
                    onClick={() => {
                      setShowMindMap(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cyan-600/30 text-white transition-colors border-b border-[#4A6D8C]/50"
                  >
                    <MuiIcon name="AccountTree" size={18} className="text-cyan-400" />
                    <span className="text-sm">{t('studio.explodedView')}</span>
                  </button>

                  {/* Exemples */}
                  <button
                    onClick={() => {
                      toggleShowExamples();
                      setShowActionsMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#4A6D8C]/50 ${
                      showExamples ? 'bg-amber-600/30' : 'hover:bg-amber-600/30'
                    } text-white`}
                  >
                    <MuiIcon name="LibraryBooks" size={18} className="text-amber-400" />
                    <span className="text-sm">{t('examples.button') || 'Exemples'}</span>
                    {showExamples && <MuiIcon name="Check" size={16} className="ml-auto text-amber-400" />}
                  </button>

                  {/* Parcours de création */}
                  <button
                    onClick={() => {
                      setShowJourneyPlayer(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-rose-600/30 text-white transition-colors border-b border-[#4A6D8C]/50"
                  >
                    <MuiIcon name="Route" size={18} className="text-rose-400" />
                    <span className="text-sm">{t('studio.journey')}</span>
                  </button>

                  {/* Export Excel */}
                  <button
                    onClick={() => {
                      handleExport();
                      setShowActionsMenu(false);
                    }}
                    disabled={isExporting}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-600/30 text-white transition-colors border-b border-[#4A6D8C]/50 disabled:opacity-50"
                  >
                    {isExporting ? (
                      <div className="animate-spin"><MuiIcon name="Refresh" size={18} className="text-green-400" /></div>
                    ) : (
                      <MuiIcon name="Download" size={18} className="text-green-400" />
                    )}
                    <span className="text-sm">{t('studio.exportExcel')}</span>
                  </button>

                  {/* Traduction */}
                  <button
                    onClick={() => {
                      setShowTranslation(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-600/30 text-white transition-colors border-b border-[#4A6D8C]/50"
                  >
                    <MuiIcon name="Language" size={18} className="text-blue-400" />
                    <span className="text-sm">{t('studio.translation') || 'Traduction'}</span>
                  </button>

                  {/* Assistant IA */}
                  <button
                    onClick={() => {
                      setShowAIPrompt(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-600/30 text-white transition-colors"
                  >
                    <MuiIcon name="AutoAwesome" size={18} className="text-violet-400" />
                    <span className="text-sm">Assistant IA</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Bouton Menu panneau d'édition */}
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={showEditor ? t('studio.hidePanel') : t('studio.showPanel')}
          >
            {showEditor ? (
              <MuiIcon name="MenuOpen" size={20} />
            ) : (
              <MuiIcon name="Menu" size={20} />
            )}
          </button>
        </div>
      </header>

      {/* Assistant IA - rendu en dehors du menu pour persister */}
      <AIPromptInput 
        forceExpanded={showAIPrompt} 
        onExpandedChange={(expanded) => setShowAIPrompt(expanded)} 
      />

      {/* Traduction - rendu en dehors du menu pour persister */}
      <TranslationButton 
        cockpitId={currentCockpit.id}
        forceOpen={showTranslation}
        onOpenChange={(open) => setShowTranslation(open)}
      />

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

      {/* Vue Exemples - Sélecteur de vues exemples */}
      {showExamples && (
        <ExamplesView
          onClose={toggleShowExamples}
        />
      )}

      {/* Modal de génération de présentations */}
      <PresentationConfigModal
        isOpen={showPresentation}
        onClose={() => setShowPresentation(false)}
        cockpitId={currentCockpit.id}
        cockpitName={currentCockpit.name}
      />

      {/* Modal Parcours de création */}
      <JourneyPlayer
        isOpen={showJourneyPlayer}
        onClose={() => setShowJourneyPlayer(false)}
        cockpitId={currentCockpit.id}
      />
    </div>
  );
}
