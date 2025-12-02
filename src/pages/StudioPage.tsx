import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';
import DomainView from '../components/DomainView';
import ElementView from '../components/ElementView';
import EditorPanel from '../components/EditorPanel';
import AIPromptInput from '../components/AIPromptInput';
import { MuiIcon } from '../components/IconPicker';

export default function StudioPage() {
  const { cockpitId } = useParams<{ cockpitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    currentCockpit, 
    currentDomainId, 
    currentElementId,
    fetchCockpit, 
    exportToExcel,
    isLoading,
    error
  } = useCockpitStore();
  
  const [showEditor, setShowEditor] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
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
          <div className="animate-spin mx-auto mb-4"><MuiIcon name="Loader2" size={40} className="text-[#1E3A5F]" /></div>
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
  
  const currentDomain = currentCockpit.domains.find(d => d.id === currentDomainId);
  
  // Trouver l'élément actuel à travers les catégories
  let currentElement = null;
  if (currentElementId && currentDomain) {
    for (const category of currentDomain.categories) {
      const found = category.elements.find(e => e.id === currentElementId);
      if (found) {
        currentElement = found;
        break;
      }
    }
  }
  
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Header - Style PDF SOMONE bleu marine */}
      <header className="bg-[#1E3A5F] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <MuiIcon name="ArrowLeftIcon" size={20} />
          </button>
          
          <div>
            <h1 className="text-lg font-semibold text-white">{currentCockpit.name}</h1>
            <p className="text-xs text-white/60">
              Par {user?.username} · Modifié il y a quelques secondes
            </p>
          </div>
          
          {/* Indicateur de sauvegarde */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-all ${
            isSaving 
              ? 'bg-green-500/20 text-green-300' 
              : 'bg-white/10 text-white/60'
          }`}>
            <MuiIcon name="SaveIcon" size={12} />
            {isSaving ? 'Sauvegardé' : 'Auto-save'}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Assistant IA */}
          <AIPromptInput />
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>
            ) : (
              <MuiIcon name="DownloadIcon" size={16} />
            )}
            Export Excel
          </button>
          
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={showEditor ? 'Masquer le panneau' : 'Afficher le panneau'}
          >
            {showEditor ? (
              <MuiIcon name="PanelRightClose" size={20} />
            ) : (
              <MuiIcon name="PanelRight" size={20} />
            )}
          </button>
        </div>
      </header>
      
      {/* Navigation des domaines */}
      <Navbar />
      
      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone de prévisualisation */}
        <main className={`flex-1 overflow-auto transition-all ${showEditor ? 'mr-80' : ''}`}>
          {currentElementId && currentElement ? (
            <ElementView element={currentElement} domain={currentDomain!} />
          ) : currentDomain ? (
            <DomainView domain={currentDomain} />
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
    </div>
  );
}
