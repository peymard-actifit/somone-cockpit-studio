import { useState, useEffect, useCallback, useRef } from 'react';
import { MuiIcon } from './IconPicker';
import type { PresentationConfig, PresentationOutputFormat, CapturedImage, PresentationGenerationState, TileStatus } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

// Interface pour les actions IA de modification
interface AIAction {
  type: 'navigate_domain' | 'navigate_element' | 'change_status' | 'change_value' | 'capture_screen';
  domainId?: string;
  elementId?: string;
  subElementId?: string;
  status?: TileStatus;
  value?: string;
  description?: string;
}

// Interface pour les images existantes réutilisables
interface ExistingImage {
  id: string;
  filename: string;
  timestamp: string;
  description?: string;
  domainId?: string;
  domainName?: string;
  relevanceScore?: number;
}

// Interface pour le snapshot de l'état initial de la maquette (pour restauration après démo)
// Note: On ne sauvegarde que les propriétés modifiables (statuts, valeurs), pas la structure
interface CockpitSnapshot {
  timestamp: string;
  elements: Array<{
    id: string;
    status: TileStatus;
    value?: string;
  }>;
  subElements: Array<{
    id: string;
    status: TileStatus;
    value?: string;
  }>;
}

export default function PresentationConfigModal({
  isOpen,
  onClose,
  cockpitId,
  cockpitName,
}: PresentationConfigModalProps) {
  const { token } = useAuthStore();
  const { 
    currentCockpit, 
    setCurrentDomain, 
    setCurrentElement,
    updateElement,
    updateSubElement,
  } = useCockpitStore();
  
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
  
  // Images existantes réutilisables
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [reusingImages, setReusingImages] = useState(false);
  
  // Indicateur de capture d'écran (appareil photo)
  const [showCaptureIndicator, setShowCaptureIndicator] = useState(false);
  const captureIndicatorTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Référence pour l'animation du studio
  const [currentAction, setCurrentAction] = useState<string>('');
  
  // Snapshot de l'état initial pour restauration après la démo
  const initialSnapshotRef = useRef<CockpitSnapshot | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Sauvegarder un snapshot de l'état initial de la maquette (statuts et valeurs uniquement)
  const saveInitialSnapshot = useCallback((): CockpitSnapshot => {
    const elements: CockpitSnapshot['elements'] = [];
    const subElements: CockpitSnapshot['subElements'] = [];
    
    // Parcourir tous les domaines, catégories, éléments et sous-éléments
    for (const domain of currentCockpit?.domains || []) {
      for (const category of domain.categories || []) {
        for (const element of category.elements || []) {
          // Sauvegarder l'état de l'élément
          elements.push({
            id: element.id,
            status: element.status,
            value: element.value,
          });
          
          // Sauvegarder l'état des sous-éléments
          for (const subCategory of element.subCategories || []) {
            for (const subElement of subCategory.subElements || []) {
              subElements.push({
                id: subElement.id,
                status: subElement.status,
                value: subElement.value,
              });
            }
          }
        }
      }
    }
    
    const snapshot: CockpitSnapshot = {
      timestamp: new Date().toISOString(),
      elements,
      subElements,
    };
    
    console.log(`[Présentation] Snapshot sauvegardé: ${elements.length} éléments, ${subElements.length} sous-éléments`);
    return snapshot;
  }, [currentCockpit]);

  // Restaurer l'état initial de la maquette depuis le snapshot
  const restoreFromSnapshot = useCallback(async (snapshot: CockpitSnapshot) => {
    if (!snapshot) return;
    
    setIsRestoring(true);
    setCurrentAction('Restauration de l\'état initial...');
    
    console.log(`[Présentation] Restauration du snapshot du ${snapshot.timestamp}`);
    
    try {
      // Restaurer les éléments
      for (const elem of snapshot.elements) {
        updateElement(elem.id, { 
          status: elem.status, 
          value: elem.value 
        });
      }
      
      // Restaurer les sous-éléments
      for (const subElem of snapshot.subElements) {
        updateSubElement(subElem.id, { 
          status: subElem.status, 
          value: subElem.value 
        });
      }
      
      // Petite pause pour que les updates se propagent
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log(`[Présentation] Restauration terminée: ${snapshot.elements.length} éléments, ${snapshot.subElements.length} sous-éléments`);
    } catch (error) {
      console.error('[Présentation] Erreur lors de la restauration:', error);
    } finally {
      setIsRestoring(false);
      setCurrentAction('');
    }
  }, [updateElement, updateSubElement]);

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

  // Charger les images existantes pour réutilisation
  const loadExistingImages = useCallback(async () => {
    if (!token || !cockpitId) return;
    
    try {
      const response = await fetch(`/api/presentations/images/${cockpitId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Enrichir avec les noms de domaines
        const enrichedImages = (data.images || []).map((img: ExistingImage) => {
          const domain = currentCockpit?.domains?.find(d => d.id === img.domainId);
          return {
            ...img,
            domainName: domain?.name || 'Inconnu',
          };
        });
        setExistingImages(enrichedImages);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des images existantes:', error);
    }
  }, [token, cockpitId, currentCockpit]);

  // Charger les configurations et images au montage
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      loadExistingImages();
    }
  }, [isOpen, loadConfigs, loadExistingImages]);

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
    }, 800);
  }, []);

  // Navigation automatique vers un domaine
  const navigateToDomain = useCallback(async (domainId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(null);
    // Attendre que le DOM se mette à jour
    await new Promise(resolve => setTimeout(resolve, 500));
  }, [setCurrentDomain, setCurrentElement]);

  // Navigation automatique vers un élément
  const navigateToElement = useCallback(async (domainId: string, elementId: string) => {
    setCurrentDomain(domainId);
    setCurrentElement(elementId);
    await new Promise(resolve => setTimeout(resolve, 500));
  }, [setCurrentDomain, setCurrentElement]);

  // Modifier le statut d'un élément (pour la démo)
  const changeElementStatus = useCallback((elementId: string, status: TileStatus) => {
    updateElement(elementId, { status });
  }, [updateElement]);

  // Modifier la valeur d'un élément
  const changeElementValue = useCallback((elementId: string, value: string) => {
    updateElement(elementId, { value });
  }, [updateElement]);

  // Modifier le statut d'un sous-élément
  const changeSubElementStatus = useCallback((subElementId: string, status: TileStatus) => {
    updateSubElement(subElementId, { status });
  }, [updateSubElement]);

  // Capturer une image de l'écran
  const captureScreenshot = useCallback(async (description?: string, domainId?: string): Promise<CapturedImage | null> => {
    try {
      const studioElement = document.querySelector('main');
      if (!studioElement) return null;

      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(studioElement as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F5F7FA',
        scale: 2, // Meilleure qualité
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
        description,
        domainId,
      };
      
      showCapture();
      return image;
    } catch (error) {
      console.error('Erreur lors de la capture:', error);
      return null;
    }
  }, [cockpitId, showCapture]);

  // Trouver des images existantes similaires
  const findSimilarExistingImages = useCallback((description: string, domainId?: string): ExistingImage[] => {
    if (existingImages.length === 0) return [];
    
    // Score de pertinence basé sur la description et le domaine
    const scoredImages = existingImages.map(img => {
      let score = 0;
      
      // Même domaine = +50 points
      if (domainId && img.domainId === domainId) {
        score += 50;
      }
      
      // Mots clés en commun dans la description
      if (description && img.description) {
        const descWords = description.toLowerCase().split(/\s+/);
        const imgWords = img.description.toLowerCase().split(/\s+/);
        const commonWords = descWords.filter(w => imgWords.includes(w) && w.length > 3);
        score += commonWords.length * 10;
      }
      
      // Image récente = bonus
      const ageInHours = (Date.now() - new Date(img.timestamp).getTime()) / (1000 * 60 * 60);
      if (ageInHours < 24) score += 20;
      else if (ageInHours < 168) score += 10; // Moins d'une semaine
      
      return { ...img, relevanceScore: score };
    });
    
    // Retourner les images avec un score > 30, triées par pertinence
    return scoredImages
      .filter(img => (img.relevanceScore || 0) > 30)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 5);
  }, [existingImages]);

  // Exécuter une action IA
  const executeAIAction = useCallback(async (action: AIAction): Promise<CapturedImage | null> => {
    setCurrentAction(action.description || `${action.type}...`);
    
    switch (action.type) {
      case 'navigate_domain':
        if (action.domainId) {
          await navigateToDomain(action.domainId);
        }
        break;
        
      case 'navigate_element':
        if (action.domainId && action.elementId) {
          await navigateToElement(action.domainId, action.elementId);
        }
        break;
        
      case 'change_status':
        if (action.elementId && action.status) {
          changeElementStatus(action.elementId, action.status);
        } else if (action.subElementId && action.status) {
          changeSubElementStatus(action.subElementId, action.status);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        break;
        
      case 'change_value':
        if (action.elementId && action.value) {
          changeElementValue(action.elementId, action.value);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        break;
        
      case 'capture_screen':
        return await captureScreenshot(action.description, action.domainId);
    }
    
    return null;
  }, [navigateToDomain, navigateToElement, changeElementStatus, changeSubElementStatus, changeElementValue, captureScreenshot]);

  // Générer un PDF avec jsPDF
  const generatePDF = useCallback(async (
    images: CapturedImage[], 
    scenario: { title: string; introduction: string; sections: any[]; conclusion: string }
  ): Promise<string> => {
    const { jsPDF } = await import('jspdf');
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Page de titre
    pdf.setFillColor(30, 58, 95); // #1E3A5F
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(32);
    pdf.text(scenario.title || cockpitName, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    pdf.setFontSize(14);
    pdf.text(scenario.introduction || 'Présentation générée automatiquement', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(new Date().toLocaleDateString('fr-FR'), pageWidth / 2, pageHeight - 20, { align: 'center' });
    
    // Pages de contenu avec images
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const section = scenario.sections?.[i];
      
      pdf.addPage();
      
      // Fond blanc
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Titre de la section
      pdf.setTextColor(30, 58, 95);
      pdf.setFontSize(18);
      pdf.text(section?.title || image.description || `Slide ${i + 1}`, 15, 20);
      
      // Image
      if (image.base64Data) {
        const imgWidth = pageWidth - 30;
        const imgHeight = (pageHeight - 50) * 0.7;
        pdf.addImage(image.base64Data, 'PNG', 15, 30, imgWidth, imgHeight);
      }
      
      // Texte descriptif
      if (section?.content) {
        pdf.setFontSize(11);
        pdf.setTextColor(100, 116, 139);
        const textY = pageHeight - 35;
        const lines = pdf.splitTextToSize(section.content, pageWidth - 30);
        pdf.text(lines.slice(0, 3), 15, textY);
      }
      
      // Numéro de page
      pdf.setFontSize(9);
      pdf.text(`${i + 2}`, pageWidth - 15, pageHeight - 10);
    }
    
    // Page de conclusion
    if (scenario.conclusion) {
      pdf.addPage();
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('Conclusion', pageWidth / 2, pageHeight / 2 - 30, { align: 'center' });
      pdf.setFontSize(14);
      const conclusionLines = pdf.splitTextToSize(scenario.conclusion, pageWidth - 60);
      pdf.text(conclusionLines, pageWidth / 2, pageHeight / 2, { align: 'center' });
    }
    
    // Retourner le PDF en base64
    return pdf.output('datauristring');
  }, [cockpitName]);

  // Générer un PPTX avec pptxgenjs
  const generatePPTX = useCallback(async (
    images: CapturedImage[],
    scenario: { title: string; introduction: string; sections: any[]; conclusion: string }
  ): Promise<string> => {
    const PptxGenJS = (await import('pptxgenjs')).default;
    
    const pptx = new PptxGenJS();
    pptx.author = 'SOMONE Cockpit Studio';
    pptx.title = scenario.title || cockpitName;
    pptx.subject = 'Présentation générée automatiquement';
    
    // Slide de titre
    const titleSlide = pptx.addSlide();
    titleSlide.addText(scenario.title || cockpitName, {
      x: 0.5,
      y: 2,
      w: '90%',
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: '1E3A5F',
      align: 'center',
    });
    titleSlide.addText(scenario.introduction || 'Présentation générée automatiquement', {
      x: 0.5,
      y: 3.5,
      w: '90%',
      h: 0.75,
      fontSize: 18,
      color: '64748B',
      align: 'center',
    });
    titleSlide.addText(new Date().toLocaleDateString('fr-FR'), {
      x: 0.5,
      y: 5,
      w: '90%',
      h: 0.5,
      fontSize: 12,
      color: '94A3B8',
      align: 'center',
    });
    
    // Slides de contenu avec images
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const section = scenario.sections?.[i];
      
      const slide = pptx.addSlide();
      
      // Titre
      slide.addText(section?.title || image.description || `Slide ${i + 1}`, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: '1E3A5F',
      });
      
      // Image
      if (image.base64Data) {
        slide.addImage({
          data: image.base64Data,
          x: 0.5,
          y: 1,
          w: 9,
          h: 4,
        });
      }
      
      // Notes du présentateur
      if (section?.content || section?.notes) {
        slide.addNotes(section.notes || section.content || '');
      }
    }
    
    // Slide de conclusion
    if (scenario.conclusion) {
      const conclusionSlide = pptx.addSlide();
      conclusionSlide.addText('Conclusion', {
        x: 0.5,
        y: 1.5,
        w: '90%',
        h: 1,
        fontSize: 36,
        bold: true,
        color: '1E3A5F',
        align: 'center',
      });
      conclusionSlide.addText(scenario.conclusion, {
        x: 1,
        y: 2.8,
        w: '80%',
        h: 2,
        fontSize: 18,
        color: '475569',
        align: 'center',
        valign: 'middle',
      });
    }
    
    // Retourner le PPTX en base64
    const pptxOutput = await pptx.write({ outputType: 'base64' });
    return `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${pptxOutput}`;
  }, [cockpitName]);

  // Lancer la génération de la présentation
  const handleGenerate = async () => {
    if (!token || currentConfig.outputFormats.length === 0) return;
    
    // IMPORTANT: Sauvegarder l'état initial AVANT toute modification
    // Cela permet de restaurer la maquette à la fin de la démo
    setGenerationState({
      isGenerating: true,
      currentStep: 'Sauvegarde de l\'état initial...',
      progress: 0,
      capturedImages: [],
      errors: [],
    });
    
    // Sauvegarder le snapshot de l'état initial
    initialSnapshotRef.current = saveInitialSnapshot();
    
    try {
      // Étape 1: Demander à l'IA les actions à effectuer
      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Analyse de la maquette et planification IA...',
        progress: 5,
      }));

      // Construire le contexte pour l'IA
      const domains = currentCockpit?.domains || [];
      const cockpitContext = {
        name: cockpitName,
        domains: domains.map(d => ({
          id: d.id,
          name: d.name,
          templateType: d.templateType,
          categories: d.categories?.map(c => ({
            id: c.id,
            name: c.name,
            elements: c.elements?.map(e => ({
              id: e.id,
              name: e.name,
              status: e.status,
              value: e.value,
            })),
          })),
        })),
        globalPrompt: currentCockpit?.welcomeMessage || '',
      };

      // Vérifier les images existantes réutilisables
      setReusingImages(true);
      const reusableImages: ExistingImage[] = [];
      
      for (const domain of domains) {
        const similar = findSimilarExistingImages(`Vue du domaine ${domain.name}`, domain.id);
        if (similar.length > 0) {
          reusableImages.push(...similar);
        }
      }
      
      setReusingImages(false);

      // Demander à l'IA les actions à effectuer
      const aiResponse = await fetch('/api/presentations/plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cockpitId,
          cockpitContext,
          config: currentConfig,
          existingImages: reusableImages.map(img => ({
            id: img.id,
            filename: img.filename,
            description: img.description,
            domainId: img.domainId,
            domainName: img.domainName,
          })),
        }),
      });

      let aiPlan: { actions: AIAction[]; scenario: any; reusedImageIds: string[] } = {
        actions: [],
        scenario: { title: cockpitName, introduction: '', sections: [], conclusion: '' },
        reusedImageIds: [],
      };

      if (aiResponse.ok) {
        aiPlan = await aiResponse.json();
      } else {
        // Plan de secours: parcourir tous les domaines
        aiPlan.actions = domains.flatMap((domain) => [
          { type: 'navigate_domain' as const, domainId: domain.id, description: `Navigation vers ${domain.name}` },
          { type: 'capture_screen' as const, domainId: domain.id, description: `Vue du domaine ${domain.name}` },
        ]);
        aiPlan.scenario = {
          title: `Présentation ${cockpitName}`,
          introduction: currentConfig.prompt || 'Présentation de la maquette',
          sections: domains.map(d => ({ title: d.name, content: `Vue du domaine ${d.name}` })),
          conclusion: 'Merci pour votre attention.',
        };
      }

      setGenerationState(prev => ({
        ...prev,
        currentStep: `Exécution de ${aiPlan.actions.length} actions...`,
        progress: 10,
      }));

      // Exécuter les actions IA
      const capturedImages: CapturedImage[] = [];
      const totalActions = aiPlan.actions.length;

      for (let i = 0; i < totalActions; i++) {
        const action = aiPlan.actions[i];
        
        setGenerationState(prev => ({
          ...prev,
          currentStep: action.description || `Action ${i + 1}/${totalActions}`,
          progress: 10 + Math.floor((i / totalActions) * 50),
        }));

        const capturedImage = await executeAIAction(action);
        if (capturedImage) {
          capturedImages.push(capturedImage);
          setGenerationState(prev => ({
            ...prev,
            capturedImages: [...prev.capturedImages, capturedImage],
          }));
        }

        // Pause pour l'animation
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setCurrentAction('');

      // Ajouter les images réutilisées (référence seulement)
      // Note: En production, on récupérerait les données complètes
      if (aiPlan.reusedImageIds && aiPlan.reusedImageIds.length > 0) {
        setGenerationState(prev => ({
          ...prev,
          currentStep: `${aiPlan.reusedImageIds.length} image(s) réutilisée(s) de la banque...`,
        }));
      }

      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Génération des fichiers de sortie...',
        progress: 70,
      }));

      // Générer les fichiers selon les formats demandés
      const outputFiles: { format: PresentationOutputFormat; filename: string; url: string }[] = [];
      const safeFilename = cockpitName.replace(/[^a-z0-9]/gi, '_');

      // Générer PDF
      if (currentConfig.outputFormats.includes('pdf')) {
        setGenerationState(prev => ({
          ...prev,
          currentStep: 'Génération du fichier PDF...',
          progress: 75,
        }));
        
        const pdfDataUri = await generatePDF(capturedImages, aiPlan.scenario);
        outputFiles.push({
          format: 'pdf',
          filename: `${safeFilename}_presentation.pdf`,
          url: pdfDataUri,
        });
      }

      // Générer PPTX
      if (currentConfig.outputFormats.includes('pptx')) {
        setGenerationState(prev => ({
          ...prev,
          currentStep: 'Génération du fichier PowerPoint...',
          progress: 85,
        }));
        
        const pptxDataUri = await generatePPTX(capturedImages, aiPlan.scenario);
        outputFiles.push({
          format: 'pptx',
          filename: `${safeFilename}_presentation.pptx`,
          url: pptxDataUri,
        });
      }

      // Génération vidéo avec l'API RENDI
      if (currentConfig.outputFormats.includes('video')) {
        setGenerationState(prev => ({
          ...prev,
          currentStep: 'Génération de la vidéo avec RENDI...',
          progress: 88,
        }));
        
        try {
          // Appeler l'API pour démarrer la génération vidéo
          const videoResponse = await fetch('/api/presentations/generate-video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cockpitId,
              cockpitName,
              images: capturedImages.map(img => ({
                id: img.id,
                base64Data: img.base64Data,
                description: img.description,
              })),
              scenario: aiPlan.scenario,
              durationPerSlide: Math.max(3, Math.floor((currentConfig.duration || 60) / capturedImages.length)),
            }),
          });
          
          if (videoResponse.ok) {
            const videoResult = await videoResponse.json();
            
            if (videoResult.commandId) {
              setGenerationState(prev => ({
                ...prev,
                currentStep: 'Vidéo en cours de génération sur le cloud...',
                progress: 90,
              }));
              
              // Polling pour suivre la progression
              let videoStatus = 'PROCESSING';
              let videoUrl = '';
              let pollCount = 0;
              const maxPolls = 60; // 5 minutes max (60 * 5s)
              
              while (videoStatus === 'PROCESSING' || videoStatus === 'PENDING') {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes
                pollCount++;
                
                if (pollCount > maxPolls) {
                  console.warn('[RENDI] Timeout après 5 minutes');
                  break;
                }
                
                setGenerationState(prev => ({
                  ...prev,
                  currentStep: `Génération vidéo en cours... (${pollCount * 5}s)`,
                }));
                
                const statusResponse = await fetch(`/api/presentations/video-status/${videoResult.commandId}`, {
                  headers: { 'Authorization': `Bearer ${token}` },
                });
                
                if (statusResponse.ok) {
                  const statusResult = await statusResponse.json();
                  videoStatus = statusResult.status;
                  
                  if (statusResult.status === 'SUCCESS' && statusResult.videoUrl) {
                    videoUrl = statusResult.videoUrl;
                    console.log(`[RENDI] Vidéo générée: ${videoUrl}`);
                  } else if (statusResult.status === 'FAILED') {
                    console.error('[RENDI] Échec génération:', statusResult.error);
                    break;
                  }
                }
              }
              
              if (videoUrl) {
                outputFiles.push({
                  format: 'video',
                  filename: `${safeFilename}_presentation.mp4`,
                  url: videoUrl,
                });
              } else {
                console.warn('[RENDI] Vidéo non générée ou timeout');
                outputFiles.push({
                  format: 'video',
                  filename: `${safeFilename}_presentation.mp4`,
                  url: '', // URL vide si échec
                });
              }
            }
          } else {
            console.error('[RENDI] Erreur lors de la requête');
            outputFiles.push({
              format: 'video',
              filename: `${safeFilename}_presentation.mp4`,
              url: '',
            });
          }
        } catch (videoError) {
          console.error('[RENDI] Erreur génération vidéo:', videoError);
          outputFiles.push({
            format: 'video',
            filename: `${safeFilename}_presentation.mp4`,
            url: '',
          });
        }
      }

      // Sauvegarder les images dans la banque
      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Sauvegarde des images dans la banque...',
        progress: 95,
      }));

      for (const image of capturedImages) {
        await fetch('/api/presentations/images', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cockpitId,
            includeBase64: true, // Stocker les données base64 pour réutilisation future
            image: {
              id: image.id,
              filename: image.filename,
              timestamp: image.timestamp,
              description: image.description,
              domainId: image.domainId,
              width: image.width,
              height: image.height,
              base64Data: image.base64Data, // Stocker les données complètes
            },
          }),
        });
      }

      // Recharger les images existantes
      await loadExistingImages();

      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Génération terminée ! Téléchargement automatique...',
        progress: 98,
        outputFiles,
      }));

      // Téléchargement automatique de tous les fichiers
      // 1. Télécharger les fichiers PDF/PPTX individuellement
      const localOutputFiles = outputFiles.filter(f => f.url && f.url.startsWith('data:'));
      if (localOutputFiles.length > 0) {
        autoDownloadFiles(localOutputFiles);
      }
      
      // 2. Télécharger le ZIP complet avec images + fichiers
      if (capturedImages.length > 0 || outputFiles.length > 0) {
        await downloadAllAsZip(capturedImages, outputFiles);
      }

      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Génération terminée ! Fichiers téléchargés.',
        progress: 100,
      }));

    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      setGenerationState(prev => ({
        ...prev,
        errors: [...prev.errors, String(error)],
      }));
    } finally {
      // IMPORTANT: Toujours restaurer l'état initial de la maquette après la démo
      // Cela garantit que la maquette n'est pas perturbée par les modifications de la démo
      if (initialSnapshotRef.current) {
        setGenerationState(prev => ({
          ...prev,
          currentStep: 'Restauration de l\'état initial de la maquette...',
          progress: 98,
        }));
        
        await restoreFromSnapshot(initialSnapshotRef.current);
        initialSnapshotRef.current = null;
      }
      
      setGenerationState(prev => ({
        ...prev,
        isGenerating: false,
      }));
    }
  };

  // Télécharger un fichier généré
  const downloadFile = (filename: string, url?: string) => {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Télécharger une image individuelle
  const downloadImage = (image: CapturedImage) => {
    if (image.base64Data) {
      const a = document.createElement('a');
      a.href = image.base64Data;
      a.download = image.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Télécharger toutes les images en ZIP
  const downloadAllImagesAsZip = async (images: CapturedImage[]) => {
    if (images.length === 0) return;
    
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${cockpitName.replace(/[^a-z0-9]/gi, '_')}_images`);
      
      if (!folder) return;
      
      // Ajouter chaque image au ZIP
      for (const image of images) {
        if (image.base64Data) {
          // Extraire les données base64 pures (sans le préfixe data:image/png;base64,)
          const base64Data = image.base64Data.split(',')[1];
          if (base64Data) {
            folder.file(image.filename, base64Data, { base64: true });
          }
        }
      }
      
      // Générer et télécharger le ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${cockpitName.replace(/[^a-z0-9]/gi, '_')}_images.zip`);
      
    } catch (error) {
      console.error('Erreur lors de la création du ZIP:', error);
    }
  };

  // Télécharger tout (images + fichiers générés) en un seul ZIP
  // Accepte des paramètres optionnels pour permettre le téléchargement automatique après génération
  const downloadAllAsZip = async (
    images?: CapturedImage[], 
    files?: Array<{ filename: string; url?: string; format: PresentationOutputFormat }>
  ) => {
    const imagesToDownload = images || generationState.capturedImages;
    const filesToDownload = files || generationState.outputFiles;
    
    if (imagesToDownload.length === 0 && (!filesToDownload || filesToDownload.length === 0)) {
      return;
    }
    
    try {
      const zip = new JSZip();
      const baseName = cockpitName.replace(/[^a-z0-9]/gi, '_');
      
      // Dossier pour les images
      const imagesFolder = zip.folder(`${baseName}_images`);
      if (imagesFolder && imagesToDownload.length > 0) {
        for (const image of imagesToDownload) {
          if (image.base64Data) {
            const base64Data = image.base64Data.split(',')[1];
            if (base64Data) {
              imagesFolder.file(image.filename, base64Data, { base64: true });
            }
          }
        }
      }
      
      // Ajouter les fichiers générés (PDF, PPTX) s'ils sont des data URI
      if (filesToDownload) {
        for (const file of filesToDownload) {
          if (file.url && file.url.startsWith('data:')) {
            const base64Data = file.url.split(',')[1];
            if (base64Data) {
              zip.file(file.filename, base64Data, { base64: true });
            }
          }
        }
      }
      
      // Générer et télécharger le ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${baseName}_presentation_complete.zip`);
      
    } catch (error) {
      console.error('Erreur lors de la création du ZIP complet:', error);
    }
  };

  // Télécharger automatiquement tous les fichiers générés (PDF, PPTX individuels)
  const autoDownloadFiles = (files: Array<{ filename: string; url?: string; format: PresentationOutputFormat }>) => {
    for (const file of files) {
      if (file.url && file.url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Indicateur de capture global (visible même avec le modal) */}
      {showCaptureIndicator && (
        <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full shadow-lg animate-pulse">
          <MuiIcon name="CameraAlt" size={20} />
          <span className="text-sm font-medium">Capture !</span>
        </div>
      )}

      {/* Indicateur de restauration de l'état initial */}
      {isRestoring && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-full shadow-lg animate-pulse">
          <MuiIcon name="Restore" size={20} />
          <span className="text-sm font-medium">Restauration de la maquette...</span>
        </div>
      )}

      {/* Action en cours */}
      {currentAction && generationState.isGenerating && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-[#1E3A5F] text-white rounded-full shadow-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin">
              <MuiIcon name="AutoAwesome" size={18} />
            </div>
            <span className="text-sm">{currentAction}</span>
          </div>
        </div>
      )}

      <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-[100] transition-opacity ${generationState.isGenerating ? 'bg-black/30' : ''}`}>
        <div className={`bg-white rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-6xl flex flex-col overflow-hidden transition-all ${generationState.isGenerating ? 'opacity-90' : ''}`}>
        {/* Header */}
        <div className="bg-[#1E3A5F] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MuiIcon name="Slideshow" size={24} className="text-cyan-300" />
            <div>
              <h2 className="text-lg font-semibold text-white">Générateur de Présentations</h2>
              <p className="text-xs text-white/60">Maquette : {cockpitName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existingImages.length > 0 && (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs">
                {existingImages.length} image(s) en banque
              </span>
            )}
            <button
              onClick={onClose}
              disabled={generationState.isGenerating}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <MuiIcon name="Close" size={20} />
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 flex overflow-hidden">
          {/* Panneau gauche: Liste des configurations */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={handleNewConfig}
                disabled={generationState.isGenerating}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors text-sm disabled:opacity-50"
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
                      onClick={() => !generationState.isGenerating && handleSelectConfig(config)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{config.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfig(config.id);
                          }}
                          disabled={generationState.isGenerating}
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
                disabled={generationState.isGenerating}
                placeholder="Ex: Présentation commerciale Q1 2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
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
                disabled={generationState.isGenerating}
                placeholder={`Décrivez la présentation souhaitée...

Exemples:
- "Créer une présentation commerciale de 10 slides présentant l'état de supervision de notre infrastructure."
- "Générer une démo montrant les alertes critiques et leur résolution. Change les statuts des éléments pour simuler des incidents."
- "Produire un rapport PDF avec toutes les métriques clés par domaine."
- "Faire une démonstration du passage d'un état OK à un état critique sur le domaine Réseau."`}
                className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none font-mono text-sm disabled:bg-gray-100"
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
                    disabled={generationState.isGenerating}
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
                    disabled={generationState.isGenerating}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <MuiIcon name="VideoLibrary" size={24} className="text-purple-500" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Vidéo</span>
                    <span className="text-[10px] text-purple-400">(RENDI)</span>
                  </div>
                </label>

                {/* PPTX */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={currentConfig.outputFormats.includes('pptx')}
                    onChange={() => toggleOutputFormat('pptx')}
                    disabled={generationState.isGenerating}
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
                  {/* Indicateur de réutilisation */}
                  {reusingImages && (
                    <div className="flex items-center gap-2 p-3 bg-amber-100 text-amber-700 rounded-lg">
                      <MuiIcon name="Collections" size={20} />
                      <span className="text-sm">Recherche d'images réutilisables...</span>
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
                            className="aspect-video bg-gray-200 rounded overflow-hidden relative group cursor-pointer"
                            onClick={() => downloadImage(img)}
                            title="Cliquer pour télécharger"
                          >
                            <img
                              src={img.base64Data}
                              alt={img.filename}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                              <MuiIcon name="Download" size={16} className="text-white" />
                              <span className="text-[8px] text-white text-center px-1">
                                {img.description?.substring(0, 20) || 'Télécharger'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : generationState.outputFiles && generationState.outputFiles.length > 0 ? (
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
                        disabled={!file.url}
                        className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MuiIcon
                          name={file.format === 'pdf' ? 'PictureAsPdf' : file.format === 'video' ? 'VideoLibrary' : 'Dns'}
                          size={24}
                          className={file.format === 'pdf' ? 'text-red-500' : file.format === 'video' ? 'text-purple-500' : 'text-orange-500'}
                        />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-700">{file.filename}</p>
                          <p className="text-xs text-gray-400 uppercase">
                            {file.format}
                            {!file.url && file.format === 'video' && ' - En préparation'}
                          </p>
                        </div>
                        <MuiIcon name="Download" size={18} className="text-gray-400" />
                      </button>
                    ))}
                  </div>

                  {/* Images capturées après génération */}
                  {generationState.capturedImages.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <p className="text-sm text-gray-600">
                        {generationState.capturedImages.length} image(s) capturée(s)
                      </p>
                      
                      {/* Aperçu des images cliquables */}
                      <div className="grid grid-cols-4 gap-1">
                        {generationState.capturedImages.slice(0, 8).map(img => (
                          <div
                            key={img.id}
                            className="aspect-video bg-gray-200 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all"
                            onClick={() => downloadImage(img)}
                            title={`Télécharger ${img.filename}`}
                          >
                            <img
                              src={img.base64Data}
                              alt={img.filename}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Boutons de téléchargement */}
                      <div className="space-y-2">
                        <button
                          onClick={() => downloadAllImagesAsZip(generationState.capturedImages)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                        >
                          <MuiIcon name="FolderZip" size={16} />
                          Télécharger les images (ZIP)
                        </button>
                        
                        <button
                          onClick={() => downloadAllAsZip()}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors text-sm"
                        >
                          <MuiIcon name="Archive" size={16} />
                          Tout télécharger (ZIP complet)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MuiIcon name="Slideshow" size={48} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">
                    Configurez votre présentation et cliquez sur "Générer" pour démarrer.
                  </p>
                  {existingImages.length > 0 && (
                    <p className="text-xs text-amber-600">
                      💡 {existingImages.length} image(s) en banque peuvent être réutilisées
                    </p>
                  )}
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
              disabled={!configName.trim() || isSaving || generationState.isGenerating}
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
              disabled={generationState.isGenerating}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
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
    </>
  );
}
