import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Cockpit, Element, Category } from '../types';
import { MuiIcon } from '../components/IconPicker';
import DomainView from '../components/DomainView';
import ElementView from '../components/ElementView';
import MindMapView from '../components/MindMapView';
import PublicAIChat from '../components/PublicAIChat';
import DateTimeline from '../components/DateTimeline';
import { VERSION_DISPLAY } from '../config/version';
import { getDomainWorstStatus, STATUS_COLORS } from '../types';
import { TrackingProvider, useTracking } from '../contexts/TrackingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCockpitStore } from '../store/cockpitStore';

function PublicCockpitContent() {
  const { publicId } = useParams();
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string | null>(null);
  const [currentElementId, setCurrentElementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showMindMap, setShowMindMap] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRightControlsHovered, setIsRightControlsHovered] = useState(false);
  const { trackEvent } = useTracking();
  const { language, setLanguage, t } = useLanguage();

  // Fonction pour changer la date active (local uniquement, pas de sauvegarde serveur)
  const handleDateChange = (newDate: string) => {
    if (!cockpit || !cockpit.dataHistory?.columns?.length) return;
    
    const targetColumn = cockpit.dataHistory.columns.find(col => col.date === newDate);
    if (!targetColumn) return;
    
    // Appliquer les données historiques à tous les sous-éléments
    const updatedDomains = cockpit.domains.map(domain => ({
      ...domain,
      categories: (domain.categories || []).map(category => ({
        ...category,
        elements: (category.elements || []).map(element => ({
          ...element,
          subCategories: (element.subCategories || []).map(subCategory => ({
            ...subCategory,
            subElements: (subCategory.subElements || []).map(subElement => {
              const historyKey = subElement.linkedGroupId || subElement.id;
              const historicalData = targetColumn.data[historyKey];
              
              if (historicalData) {
                return {
                  ...subElement,
                  status: historicalData.status,
                  value: historicalData.value || '',
                  unit: historicalData.unit || '',
                };
              }
              return subElement;
            }),
          })),
        })),
      })),
    }));
    
    const updatedCockpit = {
      ...cockpit,
      domains: updatedDomains,
      selectedDataDate: newDate,
    };
    
    setCockpit(updatedCockpit);
    // Mettre aussi à jour le store pour que les composants enfants voient les bonnes données
    useCockpitStore.setState({ currentCockpit: updatedCockpit });
    setShowDatePicker(false);
  };

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
          (data.domains || []).forEach((domain: any, index: number) => {
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

        // Si une date historique est sélectionnée, appliquer les données à tous les sous-éléments
        let cockpitToSet = data;
        if (data.selectedDataDate && data.dataHistory?.columns?.length) {
          const targetColumn = data.dataHistory.columns.find((col: any) => col.date === data.selectedDataDate);
          if (targetColumn) {
            console.log('[PublicCockpitPage] Applying historical data for date:', data.selectedDataDate);
            cockpitToSet = {
              ...data,
              domains: data.domains.map((domain: any) => ({
                ...domain,
                categories: (domain.categories || []).map((category: any) => ({
                  ...category,
                  elements: (category.elements || []).map((element: any) => ({
                    ...element,
                    subCategories: (element.subCategories || []).map((subCategory: any) => ({
                      ...subCategory,
                      subElements: (subCategory.subElements || []).map((subElement: any) => {
                        const historyKey = subElement.linkedGroupId || subElement.id;
                        const historicalData = targetColumn.data[historyKey];
                        if (historicalData) {
                          return {
                            ...subElement,
                            status: historicalData.status,
                            value: historicalData.value || '',
                            unit: historicalData.unit || '',
                          };
                        }
                        return subElement;
                      }),
                    })),
                  })),
                })),
              })),
            };
          }
        }
        
        setCockpit(cockpitToSet);
        
        // Mettre le cockpit dans le store pour que les composants enfants puissent y accéder
        // (nécessaire pour les données historiques dans SubElementTile)
        useCockpitStore.setState({ currentCockpit: cockpitToSet });

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
    
    // Nettoyer le store quand le composant est démonté
    return () => {
      useCockpitStore.setState({ currentCockpit: null });
    };
  }, [publicId]);

  // Tracker la première page vue une fois le cockpit chargé
  useEffect(() => {
    if (cockpit && currentDomainId) {
      trackEvent('page', { domainId: currentDomainId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cockpit?.id]); // Ne tracker qu'une fois au chargement initial

  // Mettre à jour le titre de l'onglet du navigateur avec le nom du cockpit
  useEffect(() => {
    if (cockpit?.name) {
      document.title = cockpit.name;
    }
    // Restaurer le titre original quand on quitte la page
    return () => {
      document.title = 'SOMONE Cockpit Studio';
    };
  }, [cockpit?.name]);

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

  // Protection: s'assurer que cockpit.domains existe
  const domains = cockpit.domains || [];
  const currentDomain = domains.find(d => d.id === currentDomainId);
  
  // Déterminer si on utilise la vue originale (activé par défaut si non défini)
  const useOriginalView = cockpit.useOriginalView !== false;
  
  // Déterminer si on est sur une vue Map ou Background (pour masquer les bandeaux)
  const isMapOrBackgroundView = currentDomain && 
    (currentDomain.templateType === 'map' || currentDomain.templateType === 'background') &&
    !currentElementId; // Pas en mode vue élément

  // Trouver l'élément courant si on est en vue élément
  // Protection: s'assurer que les tableaux existent
  let currentElement: Element | null = null;
  let currentCategory: Category | null = null;
  if (currentElementId && currentDomain) {
    for (const cat of (currentDomain.categories || [])) {
      const el = (cat.elements || []).find(e => e.id === currentElementId);
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
    trackEvent('element', { elementId, domainId: currentDomainId || undefined });
  };

  // Handler pour revenir à la vue domaine
  const handleBackToDomain = () => {
    setCurrentElementId(null);
  };

  // =====================================================
  // RENDU HEADER - Vue Originale ou Vue Standard
  // =====================================================
  
  const renderOriginalHeader = () => {
    // Extraire le nom du cockpit pour le styliser (ex: "RETAIL COCKPIT" -> "RETAIL" + "COCKPIT")
    const nameParts = cockpit.name.toUpperCase().split(' ');
    const firstPart = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
    const lastPart = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    
    return (
      <header className="bg-[#1E3A5F] shadow-lg z-50">
        <div className="px-6 py-2">
          {/* Layout 3 colonnes : Gauche (titre) | Centre (onglets) | Droite (IA) */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            {/* GAUCHE : Logo et nom stylisé */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {cockpit.logo ? (
                <img src={cockpit.logo} alt="Logo" className="h-10 w-auto" />
              ) : (
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-bold text-[#F5A623] tracking-wider">{firstPart}</span>
                  {lastPart && <span className="text-lg font-bold text-white tracking-wider">{lastPart}</span>}
                </div>
              )}
            </div>
            
            {/* CENTRE : Onglets domaines - centrés */}
            <div className="flex items-center justify-center gap-1">
              {domains.map((domain) => {
                const worstStatus = getDomainWorstStatus(
                  domain as any, 
                  domains as any, 
                  undefined, 
                  { dataHistory: cockpit.dataHistory, selectedDataDate: cockpit.selectedDataDate }
                );
                const statusColor = STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex;
                const hasAlert = worstStatus !== 'ok';
                const isActive = currentDomainId === domain.id;
                
                return (
                  <button
                    key={domain.id}
                    onClick={() => {
                      setCurrentDomainId(domain.id);
                      setCurrentElementId(null);
                      trackEvent('page', { domainId: domain.id });
                    }}
                    className={`relative px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-[#4A6D8C] text-white'
                        : 'bg-[#2D4A63] text-slate-300 hover:bg-[#3A5A75] hover:text-white'
                    }`}
                  >
                    {domain.name}
                    {/* Pastille de statut en haut à droite */}
                    {hasAlert && (
                      <div
                        className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-white/50"
                        style={{ backgroundColor: statusColor }}
                        title={`Statut: ${worstStatus}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* DROITE : Assistant IA et infos */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Bouton Vue éclatée */}
              <button
                onClick={() => setShowMindMap(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                title={t('studio.explodedViewTitle')}
              >
                <MuiIcon name="AccountTree" size={16} />
                <span className="text-sm font-medium">{t('studio.explodedView')}</span>
              </button>
              
              {/* Assistant IA stylisé */}
              {publicId && cockpit && (
                <PublicAIChat publicId={publicId} cockpitName={cockpit.name} />
              )}
              
              {/* Sélecteur de langue */}
              <div className="flex items-center gap-1 bg-[#2D4A63] rounded-lg border border-[#4A6D8C] p-1">
                <button
                  onClick={() => setLanguage('FR')}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    language === 'FR'
                      ? 'bg-cyan-500 text-white'
                      : 'text-slate-300 hover:bg-slate-600'
                  }`}
                  title="Français"
                >
                  <svg width="20" height="14" viewBox="0 0 30 20" className="rounded-sm overflow-hidden shadow-sm">
                    <rect x="0" y="0" width="10" height="20" fill="#002395"/>
                    <rect x="10" y="0" width="10" height="20" fill="#FFFFFF"/>
                    <rect x="20" y="0" width="10" height="20" fill="#ED2939"/>
                  </svg>
                </button>
                <button
                  onClick={() => setLanguage('EN')}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    language === 'EN'
                      ? 'bg-cyan-500 text-white'
                      : 'text-slate-300 hover:bg-slate-600'
                  }`}
                  title="English"
                >
                  <svg width="20" height="14" viewBox="0 0 60 40" className="rounded-sm overflow-hidden shadow-sm">
                    <rect width="60" height="40" fill="#012169"/>
                    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8"/>
                    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4"/>
                    <path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" strokeWidth="12"/>
                    <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="6"/>
                  </svg>
                </button>
              </div>
              
              {/* Badge "A jour" ou date sélectionnée (cliquable si date) */}
              <div className="relative">
                {cockpit.selectedDataDate && cockpit.dataHistory?.columns?.length ? (
                  <>
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D4A63] rounded-lg border border-[#4A6D8C] hover:bg-[#3D5A73] hover:border-amber-400/50 transition-all cursor-pointer"
                      title={t('public.selectDate') || 'Changer de date'}
                    >
                      <MuiIcon name="CalendarToday" size={14} className="text-amber-400" />
                      <span className="text-sm text-amber-400">
                        {new Date(cockpit.selectedDataDate).toLocaleDateString(language === 'EN' ? 'en-GB' : 'fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>
                      <MuiIcon name="ArrowDropDown" size={16} className="text-amber-400" />
                    </button>
                    
                    {/* Dropdown de sélection de date */}
                    {showDatePicker && (
                      <>
                        {/* Overlay pour fermer le dropdown */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowDatePicker(false)}
                        />
                        <div className="absolute top-full right-0 mt-2 bg-[#1E3A5F] border border-[#4A6D8C] rounded-xl shadow-2xl z-50 min-w-[200px] overflow-hidden">
                          <div className="p-2 border-b border-[#4A6D8C]">
                            <p className="text-xs text-slate-400 font-medium px-2">
                              {t('public.availableDates') || 'Dates disponibles'}
                            </p>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {cockpit.dataHistory.columns.map((col) => {
                              const isActive = cockpit.selectedDataDate === col.date;
                              const dateObj = new Date(col.date);
                              return (
                                <button
                                  key={col.date}
                                  onClick={() => handleDateChange(col.date)}
                                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-all ${
                                    isActive 
                                      ? 'bg-amber-500/20 text-amber-400' 
                                      : 'text-white hover:bg-[#2D4A63]'
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                      {dateObj.toLocaleDateString(language === 'EN' ? 'en-GB' : 'fr-FR', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </span>
                                    {col.label && (
                                      <span className="text-xs text-slate-400">{col.label}</span>
                                    )}
                                  </div>
                                  {isActive && (
                                    <MuiIcon name="Check" size={16} className="text-amber-400" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D4A63] rounded-lg border border-[#4A6D8C]">
                    <span className="text-sm text-green-400">{t('public.upToDate')}</span>
                    <MuiIcon name="Check" size={14} className="text-green-400" />
                  </div>
                )}
              </div>
              
              {/* Avatar utilisateur (placeholder) */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2D4A63] flex items-center justify-center overflow-hidden">
                  <MuiIcon name="Person" size={24} className="text-slate-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{t('public.visitor')}</p>
                  <p className="text-xs text-slate-400">
                    {new Date().toLocaleTimeString(language === 'EN' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  };
  
  const renderStandardHeader = () => (
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
                {t('public.consultationMode')} {VERSION_DISPLAY}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bouton Vue éclatée */}
            <button
              onClick={() => setShowMindMap(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              title={t('studio.explodedViewTitle')}
            >
              <MuiIcon name="AccountTree" size={16} />
              <span className="text-sm font-medium">{t('studio.explodedView')}</span>
            </button>
            
            {/* Assistant IA */}
            {publicId && cockpit && (
              <PublicAIChat publicId={publicId} cockpitName={cockpit.name} />
            )}

            {/* Sélecteur de langue */}
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg border border-slate-600/50 p-1">
              <button
                onClick={() => setLanguage('FR')}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                  language === 'FR'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:bg-slate-600'
                }`}
                title="Français"
              >
                <svg width="20" height="14" viewBox="0 0 30 20" className="rounded-sm overflow-hidden shadow-sm">
                  <rect x="0" y="0" width="10" height="20" fill="#002395"/>
                  <rect x="10" y="0" width="10" height="20" fill="#FFFFFF"/>
                  <rect x="20" y="0" width="10" height="20" fill="#ED2939"/>
                </svg>
              </button>
              <button
                onClick={() => setLanguage('EN')}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                  language === 'EN'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:bg-slate-600'
                }`}
                title="English"
              >
                <svg width="20" height="14" viewBox="0 0 60 40" className="rounded-sm overflow-hidden shadow-sm">
                  <rect width="60" height="40" fill="#012169"/>
                  <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8"/>
                  <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4"/>
                  <path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" strokeWidth="12"/>
                  <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="6"/>
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <MuiIcon name="Visibility" size={16} className="text-blue-400" />
              <span className="text-sm text-blue-400">{t('public.readOnly')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation des domaines avec indicateurs de statut */}
      <div className="bg-slate-800/30 border-t border-slate-700/30">
        <div className="px-6">
          <div className="flex gap-1 overflow-x-auto py-1">
            {domains.map((domain) => {
              // Calculer le statut le plus critique du domaine
              const worstStatus = getDomainWorstStatus(
                domain as any, 
                domains as any, 
                undefined, 
                { dataHistory: cockpit.dataHistory, selectedDataDate: cockpit.selectedDataDate }
              );
              const statusColor = STATUS_COLORS[worstStatus]?.hex || STATUS_COLORS.ok.hex;
              const hasAlert = worstStatus !== 'ok';
              const isActive = currentDomainId === domain.id;
              
              return (
                <button
                  key={domain.id}
                  onClick={() => {
                    setCurrentDomainId(domain.id);
                    setCurrentElementId(null);
                    trackEvent('page', { domainId: domain.id });
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
  );

  return (
    <div className="h-screen bg-cockpit-bg-dark flex flex-col overflow-hidden">
      {/* Zone de survol invisible pour faire réapparaître le header (vues Map/Background) */}
      {isMapOrBackgroundView && !isHeaderHovered && (
        <div 
          className="fixed top-0 left-0 right-0 h-2 z-[60] cursor-pointer"
          onMouseEnter={() => setIsHeaderHovered(true)}
        />
      )}
      
      {/* Header - conditionnel selon useOriginalView et masqué sur Map/Background */}
      <div 
        className={`transition-all duration-300 ${
          isMapOrBackgroundView && !isHeaderHovered 
            ? 'transform -translate-y-full absolute top-0 left-0 right-0 z-50' 
            : ''
        }`}
        onMouseEnter={() => isMapOrBackgroundView && setIsHeaderHovered(true)}
        onMouseLeave={() => isMapOrBackgroundView && setIsHeaderHovered(false)}
      >
        {useOriginalView ? renderOriginalHeader() : renderStandardHeader()}
      </div>

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
              onDateChange={handleDateChange}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500">Aucun domaine disponible</p>
          </div>
        )}
      </main>

      {/* DateTimeline global pour les vues normales (pas Map/Background qui ont leur propre panneau) */}
      {!isMapOrBackgroundView && (cockpit.dataHistory?.columns?.length ?? 0) > 0 && (
        <>
          {/* Zone de déclenchement pour faire apparaître le timeline */}
          {!isRightControlsHovered && (
            <div 
              className="fixed top-0 right-0 w-16 h-full z-40"
              onMouseEnter={() => setIsRightControlsHovered(true)}
            />
          )}
          <div 
            className={`fixed right-4 top-1/2 transform -translate-y-1/2 z-40 transition-all duration-300 ${
              !isRightControlsHovered ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
            }`}
            onMouseEnter={() => setIsRightControlsHovered(true)}
            onMouseLeave={() => setIsRightControlsHovered(false)}
          >
            <DateTimeline onDateChange={handleDateChange} domainId={currentDomainId || undefined} />
          </div>
        </>
      )}

      {/* Footer - masqué sur les vues Map/Background */}
      {!isMapOrBackgroundView && (
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
      )}

      {/* Vue éclatée (Mind Map) */}
      {showMindMap && (
        <MindMapView
          cockpit={cockpit}
          onClose={() => setShowMindMap(false)}
          onNavigateToDomain={(domainId) => {
            setCurrentDomainId(domainId);
            setCurrentElementId(null);
            setShowMindMap(false);
          }}
          onNavigateToElement={(domainId, elementId) => {
            setCurrentDomainId(domainId);
            setCurrentElementId(elementId);
            setShowMindMap(false);
          }}
          onNavigateToSubElement={(domainId, elementId, _subElementId) => {
            setCurrentDomainId(domainId);
            setCurrentElementId(elementId);
            setShowMindMap(false);
          }}
          readOnly={true}
        />
      )}

      {/* Popup Message d'accueil */}
      {showWelcomeMessage && (cockpit as any).welcomeMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Header avec titre du cockpit */}
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2D4A6F] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {cockpit.logo ? (
                    <img src={cockpit.logo} alt="Logo" className="h-10 w-auto" />
                  ) : (
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <MuiIcon name="Dashboard" size={24} className="text-white" />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-white">{cockpit.name}</h2>
                </div>
              </div>
            </div>
            
            {/* Contenu du message */}
            <div className="px-6 py-6">
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">
                  {(cockpit as any).welcomeMessage}
                </p>
              </div>
            </div>
            
            {/* Bouton Continuer */}
            <div className="px-6 pb-6 flex justify-center">
              <button
                onClick={() => setShowWelcomeMessage(false)}
                className="px-8 py-3 bg-gradient-to-r from-[#1E3A5F] to-[#2D4A6F] hover:from-[#2D4A6F] hover:to-[#3D5A7F] text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <MuiIcon name="ArrowForward" size={20} />
                Accéder à la maquette de cockpit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper avec le TrackingProvider
export default function PublicCockpitPage() {
  const { publicId } = useParams();
  
  return (
    <TrackingProvider publicId={publicId} enabled={true}>
      <PublicCockpitContent />
    </TrackingProvider>
  );
}
