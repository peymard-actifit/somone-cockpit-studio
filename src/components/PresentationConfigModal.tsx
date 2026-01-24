import { useState, useEffect, useCallback, useRef } from 'react';
import { MuiIcon } from './IconPicker';
import type { PresentationConfig, PresentationOutputFormat, CapturedImage, PresentationGenerationState } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';

interface PresentationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  cockpitId: string;
  cockpitName: string;
}

// État initial d'une nouvelle configuration
const createEmptyConfig = (cockpitId: string): Omit<PresentationConfig, 'id' | 'createdAt' | 'updatedAt'> => ({
  cockpitId,
  name: '',
  prompt: '',
  outputFormats: ['pdf'],
  includeAllDomains: true,
  selectedDomainIds: [],
  transitionStyle: 'fade',
  duration: 60,
});

export default function PresentationConfigModal({
  isOpen,
  onClose,
  cockpitId,
  cockpitName,
}: PresentationConfigModalProps) {
  const { token } = useAuthStore();
  const { currentCockpit } = useCockpitStore();
  
  // État des configurations sauvegardées
  const [savedConfigs, setSavedConfigs] = useState<PresentationConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  
  // État de la configuration en cours d'édition
  const [currentConfig, setCurrentConfig] = useState(createEmptyConfig(cockpitId));
  const [configName, setConfigName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // État de la génération
  const [generationState, setGenerationState] = useState<PresentationGenerationState>({
    isGenerating: false,
    currentStep: '',
    progress: 0,
    capturedImages: [],
    errors: [],
  });
  
  // Indicateur de capture d'écran (appareil photo)
  const [showCaptureIndicator, setShowCaptureIndicator] = useState(false);
  const captureIndicatorTimeout = useRef<NodeJS.Timeout | null>(null);

  // Charger les configurations sauvegardées
  const loadConfigs = useCallback(async () => {
    if (!token || !cockpitId) return;
    
    setIsLoadingConfigs(true);
    try {
      const response = await fetch(`/api/presentations/configs/${cockpitId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavedConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des configurations:', error);
    } finally {
      setIsLoadingConfigs(false);
    }
  }, [token, cockpitId]);

  // Charger les configurations au montage
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen, loadConfigs]);

  // Sélectionner une configuration
  const handleSelectConfig = (config: PresentationConfig) => {
    setSelectedConfigId(config.id);
    setCurrentConfig({
      cockpitId: config.cockpitId,
      name: config.name,
      prompt: config.prompt,
      outputFormats: config.outputFormats,
      includeAllDomains: config.includeAllDomains,
      selectedDomainIds: config.selectedDomainIds,
      transitionStyle: config.transitionStyle,
      duration: config.duration,
    });
    setConfigName(config.name);
  };

  // Créer une nouvelle configuration
  const handleNewConfig = () => {
    setSelectedConfigId(null);
    setCurrentConfig(createEmptyConfig(cockpitId));
    setConfigName('');
  };

  // Sauvegarder la configuration
  const handleSaveConfig = async () => {
    if (!token || !configName.trim()) return;
    
    setIsSaving(true);
    try {
      const endpoint = selectedConfigId
        ? `/api/presentations/configs/${selectedConfigId}`
        : `/api/presentations/configs`;
      
      const method = selectedConfigId ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...currentConfig,
          name: configName.trim(),
          cockpitId,
        }),
      });
      
      if (response.ok) {
        await loadConfigs();
        const data = await response.json();
        if (data.config?.id) {
          setSelectedConfigId(data.config.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Supprimer une configuration
  const handleDeleteConfig = async (configId: string) => {
    if (!token || !confirm('Supprimer cette configuration de présentation ?')) return;
    
    try {
      const response = await fetch(`/api/presentations/configs/${configId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        await loadConfigs();
        if (selectedConfigId === configId) {
          handleNewConfig();
        }
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  // Toggle format de sortie
  const toggleOutputFormat = (format: PresentationOutputFormat) => {
    setCurrentConfig(prev => {
      const formats = prev.outputFormats.includes(format)
        ? prev.outputFormats.filter(f => f !== format)
        : [...prev.outputFormats, format];
      return { ...prev, outputFormats: formats.length > 0 ? formats : [format] };
    });
  };

  // Afficher l'indicateur de capture
  const showCapture = useCallback(() => {
    setShowCaptureIndicator(true);
    if (captureIndicatorTimeout.current) {
      clearTimeout(captureIndicatorTimeout.current);
    }
    captureIndicatorTimeout.current = setTimeout(() => {
      setShowCaptureIndicator(false);
    }, 500);
  }, []);

  // Capturer une image de l'écran
  const captureScreenshot = useCallback(async (): Promise<CapturedImage | null> => {
    try {
      // Utiliser html2canvas pour capturer l'écran
      const studioElement = document.querySelector('main');
      if (!studioElement) return null;

      // Import dynamique de html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(studioElement as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F5F7FA',
      });
      
      const timestamp = new Date();
      const filename = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}_${String(timestamp.getMilliseconds()).padStart(3, '0')}.png`;
      
      const image: CapturedImage = {
        id: crypto.randomUUID(),
        cockpitId,
        filename,
        timestamp: timestamp.toISOString(),
        width: canvas.width,
        height: canvas.height,
        base64Data: canvas.toDataURL('image/png'),
      };
      
      showCapture();
      return image;
    } catch (error) {
      console.error('Erreur lors de la capture:', error);
      return null;
    }
  }, [cockpitId, showCapture]);

  // Lancer la génération de la présentation
  const handleGenerate = async () => {
    if (!token || currentConfig.outputFormats.length === 0) return;
    
    setGenerationState({
      isGenerating: true,
      currentStep: 'Initialisation de la génération...',
      progress: 0,
      capturedImages: [],
      errors: [],
    });

    try {
      // Étape 1: Analyser la maquette
      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Analyse de la maquette...',
        progress: 10,
      }));

      // Capturer les images de chaque domaine
      const domains = currentCockpit?.domains || [];
      const capturedImages: CapturedImage[] = [];
      
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        setGenerationState(prev => ({
          ...prev,
          currentStep: `Capture du domaine "${domain.name}"...`,
          progress: 10 + Math.floor((i / domains.length) * 40),
        }));
        
        // Simuler la navigation vers le domaine et capturer
        // En production, cela déclencherait la navigation réelle
        const image = await captureScreenshot();
        if (image) {
          image.domainId = domain.id;
          image.description = `Vue du domaine ${domain.name}`;
          capturedImages.push(image);
        }
        
        // Petite pause pour l'animation
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setGenerationState(prev => ({
        ...prev,
        capturedImages,
        currentStep: 'Envoi à l\'IA pour génération du scénario...',
        progress: 50,
      }));

      // Étape 2: Envoyer à l'API pour génération IA
      const response = await fetch('/api/presentations/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cockpitId,
          cockpitName,
          config: currentConfig,
          images: capturedImages.map(img => ({
            id: img.id,
            filename: img.filename,
            description: img.description,
            domainId: img.domainId,
            base64Data: img.base64Data,
          })),
          globalPrompt: currentCockpit?.welcomeMessage || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération');
      }

      const result = await response.json();

      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Génération des fichiers de sortie...',
        progress: 80,
      }));

      // Stocker les images localement
      await saveImagesToLocal(capturedImages);

      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Génération terminée !',
        progress: 100,
        outputFiles: result.outputFiles,
      }));

    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      setGenerationState(prev => ({
        ...prev,
        isGenerating: false,
        errors: [...prev.errors, String(error)],
      }));
    }
  };

  // Sauvegarder les images localement (via File System Access API ou téléchargement)
  const saveImagesToLocal = async (images: CapturedImage[]) => {
    // Pour l'instant, on propose le téléchargement d'un ZIP
    // En production, on pourrait utiliser File System Access API
    for (const image of images) {
      // Les images sont stockées côté serveur dans la banque d'images
      await fetch('/api/presentations/images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cockpitId,
          image,
        }),
      });
    }
  };

  // Télécharger un fichier généré
  const downloadFile = (filename: string, url?: string) => {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-6xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#1E3A5F] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MuiIcon name="Slideshow" size={24} className="text-cyan-300" />
            <div>
              <h2 className="text-lg font-semibold text-white">Générateur de Présentations</h2>
              <p className="text-xs text-white/60">Maquette : {cockpitName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <MuiIcon name="Close" size={20} />
          </button>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 flex overflow-hidden">
          {/* Panneau gauche: Liste des configurations */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={handleNewConfig}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors text-sm"
              >
                <MuiIcon name="Add" size={16} />
                Nouvelle configuration
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingConfigs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin">
                    <MuiIcon name="Refresh" size={24} className="text-gray-400" />
                  </div>
                </div>
              ) : savedConfigs.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  Aucune configuration enregistrée
                </p>
              ) : (
                <div className="space-y-1">
                  {savedConfigs.map(config => (
                    <div
                      key={config.id}
                      className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedConfigId === config.id
                          ? 'bg-[#1E3A5F] text-white'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => handleSelectConfig(config)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{config.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfig(config.id);
                          }}
                          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            selectedConfigId === config.id
                              ? 'hover:bg-white/20 text-white/70'
                              : 'hover:bg-gray-200 text-gray-400'
                          }`}
                        >
                          <MuiIcon name="Delete" size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {config.outputFormats.map(format => (
                          <span
                            key={format}
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                              selectedConfigId === config.id
                                ? 'bg-white/20'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {format}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panneau central: Configuration */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nom de la configuration */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la configuration
              </label>
              <input
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="Ex: Présentation commerciale Q1 2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Zone de prompt */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions pour l'IA
              </label>
              <textarea
                value={currentConfig.prompt}
                onChange={(e) => setCurrentConfig(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder={`Décrivez la présentation souhaitée...

Exemples:
- "Créer une présentation commerciale de 10 slides présentant l'état de supervision de notre infrastructure."
- "Générer une démo vidéo de 2 minutes montrant les alertes critiques et leur résolution."
- "Produire un rapport PDF avec toutes les métriques clés par domaine."`}
                className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none font-mono text-sm"
              />
            </div>

            {/* Options de format */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Formats de sortie
              </label>
              <div className="flex items-center gap-6">
                {/* PDF */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={currentConfig.outputFormats.includes('pdf')}
                    onChange={() => toggleOutputFormat('pdf')}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <MuiIcon name="PictureAsPdf" size={24} className="text-red-500" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">PDF</span>
                  </div>
                </label>

                {/* Vidéo */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={currentConfig.outputFormats.includes('video')}
                    onChange={() => toggleOutputFormat('video')}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <MuiIcon name="VideoLibrary" size={24} className="text-purple-500" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Vidéo</span>
                  </div>
                </label>

                {/* PPTX */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={currentConfig.outputFormats.includes('pptx')}
                    onChange={() => toggleOutputFormat('pptx')}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <MuiIcon name="Dns" size={24} className="text-orange-500" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">PowerPoint</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Panneau droit: État de génération */}
          <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-700 flex items-center gap-2">
                <MuiIcon name="AutoAwesome" size={18} className="text-amber-500" />
                Génération IA
              </h3>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              {generationState.isGenerating ? (
                <div className="space-y-4">
                  {/* Indicateur de capture photo */}
                  {showCaptureIndicator && (
                    <div className="flex items-center gap-2 p-3 bg-green-100 text-green-700 rounded-lg animate-pulse">
                      <MuiIcon name="CameraAlt" size={20} />
                      <span className="text-sm font-medium">Capture en cours...</span>
                    </div>
                  )}

                  {/* Progression */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Progression</span>
                      <span className="font-medium">{generationState.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                        style={{ width: `${generationState.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Étape en cours */}
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">{generationState.currentStep}</p>
                  </div>

                  {/* Images capturées */}
                  {generationState.capturedImages.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        {generationState.capturedImages.length} image(s) capturée(s)
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {generationState.capturedImages.slice(-6).map(img => (
                          <div
                            key={img.id}
                            className="aspect-video bg-gray-200 rounded overflow-hidden"
                          >
                            <img
                              src={img.base64Data}
                              alt={img.filename}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : generationState.outputFiles ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-100 text-green-700 rounded-lg">
                    <MuiIcon name="CheckCircle" size={20} />
                    <span className="text-sm font-medium">Génération terminée !</span>
                  </div>

                  {/* Fichiers générés */}
                  <div className="space-y-2">
                    {generationState.outputFiles.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => downloadFile(file.filename, file.url)}
                        className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <MuiIcon
                          name={file.format === 'pdf' ? 'PictureAsPdf' : file.format === 'video' ? 'VideoLibrary' : 'Dns'}
                          size={24}
                          className={file.format === 'pdf' ? 'text-red-500' : file.format === 'video' ? 'text-purple-500' : 'text-orange-500'}
                        />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-700">{file.filename}</p>
                          <p className="text-xs text-gray-400 uppercase">{file.format}</p>
                        </div>
                        <MuiIcon name="Download" size={18} className="text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MuiIcon name="Slideshow" size={48} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Configurez votre présentation et cliquez sur "Générer" pour démarrer.
                  </p>
                </div>
              )}

              {/* Erreurs */}
              {generationState.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-700 mb-1">Erreurs :</p>
                  {generationState.errors.map((error, index) => (
                    <p key={index} className="text-xs text-red-600">{error}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveConfig}
              disabled={!configName.trim() || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <div className="animate-spin">
                  <MuiIcon name="Refresh" size={16} />
                </div>
              ) : (
                <MuiIcon name="Save" size={16} />
              )}
              {selectedConfigId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleGenerate}
              disabled={generationState.isGenerating || currentConfig.outputFormats.length === 0 || !currentConfig.prompt.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {generationState.isGenerating ? (
                <>
                  <div className="animate-spin">
                    <MuiIcon name="Refresh" size={18} />
                  </div>
                  Génération en cours...
                </>
              ) : (
                <>
                  <MuiIcon name="PlayArrow" size={18} />
                  Générer la présentation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
