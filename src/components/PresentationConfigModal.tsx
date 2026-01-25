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

// Fonction utilitaire pour générer un nom de fichier horodaté (format identique aux Excel)
const generateTimestampedFilename = (cockpitName: string, type: 'PRES' | 'IMG' | 'ZIP' | 'BANQUE', extension: string): string => {
  const now = new Date();
  // Convertir en heure de Paris
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  
  const year = parisTime.getFullYear();
  const month = String(parisTime.getMonth() + 1).padStart(2, '0');
  const day = String(parisTime.getDate()).padStart(2, '0');
  const hours = String(parisTime.getHours()).padStart(2, '0');
  const minutes = String(parisTime.getMinutes()).padStart(2, '0');
  const seconds = String(parisTime.getSeconds()).padStart(2, '0');
  
  const dateStamp = `${year}${month}${day}`;
  const timeStamp = `${hours}${minutes}${seconds}`;
  const cleanName = cockpitName.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
  
  // Format: YYYYMMDD SOMONE {TYPE} {CockpitName} HHMMSS.{ext}
  return `${dateStamp} SOMONE ${type} ${cleanName} ${timeStamp}.${extension}`;
};

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
        scale: 1.5, // Équilibre qualité/taille (réduit de 2 à 1.5)
      });
      
      // Compresser l'image en JPEG pour réduire la taille (de ~2MB PNG à ~200KB JPEG)
      const compressedData = canvas.toDataURL('image/jpeg', 0.85); // 85% qualité
      
      const timestamp = new Date();
      const filename = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}_${String(timestamp.getMilliseconds()).padStart(3, '0')}.jpg`;
      
      const image: CapturedImage = {
        id: crypto.randomUUID(),
        cockpitId,
        filename,
        timestamp: timestamp.toISOString(),
        width: canvas.width,
        height: canvas.height,
        base64Data: compressedData,
        description,
        domainId,
      };
      
      // Log taille pour debug
      const sizeKB = Math.round(compressedData.length * 0.75 / 1024);
      console.log(`[Capture] ${filename}: ${sizeKB}KB (${canvas.width}x${canvas.height})`);
      
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
    scenario: { title?: string; subtitle?: string; introduction?: string; sections?: any[]; conclusion?: string; callToAction?: string }
  ): Promise<string> => {
    const { jsPDF } = await import('jspdf');
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const primaryColor: [number, number, number] = [30, 58, 95]; // #1E3A5F
    const accentColor: [number, number, number] = [59, 130, 246]; // #3B82F6
    
    // === PAGE DE TITRE ===
    // Fond dégradé simulé (rectangle principal + bande)
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFillColor(...accentColor);
    pdf.rect(0, pageHeight - 30, pageWidth, 30, 'F');
    
    // Titre principal
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    const titleLines = pdf.splitTextToSize(scenario.title || cockpitName, pageWidth - 60);
    pdf.text(titleLines, pageWidth / 2, pageHeight / 2 - 35, { align: 'center' });
    
    // Sous-titre
    if (scenario.subtitle) {
      pdf.setFontSize(16);
      pdf.setTextColor(200, 220, 255);
      pdf.text(scenario.subtitle, pageWidth / 2, pageHeight / 2, { align: 'center' });
    }
    
    // Introduction (en plusieurs lignes si nécessaire)
    if (scenario.introduction) {
      pdf.setFontSize(12);
      pdf.setTextColor(180, 200, 230);
      const introLines = pdf.splitTextToSize(scenario.introduction, pageWidth - 80);
      pdf.text(introLines.slice(0, 3), pageWidth / 2, pageHeight / 2 + 25, { align: 'center' });
    }
    
    // Date et branding
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    
    // === PAGES DE CONTENU ===
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const section = scenario.sections?.[i] || {};
      
      pdf.addPage();
      
      // Fond blanc avec bordure colorée en haut
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, 8, 'F');
      
      // Numéro de section
      pdf.setFillColor(...accentColor);
      pdf.circle(20, 20, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text(`${i + 1}`, 20, 22, { align: 'center' });
      
      // Titre de la section
      pdf.setTextColor(...primaryColor);
      pdf.setFontSize(20);
      const sectionTitle = section.title || image.description || `Section ${i + 1}`;
      pdf.text(sectionTitle, 35, 22);
      
      // Image (centrée, avec ombre simulée)
      if (image.base64Data) {
        const imgMaxWidth = pageWidth - 40;
        const imgMaxHeight = pageHeight - 85;
        const imgRatio = image.width / image.height;
        let imgWidth = imgMaxWidth;
        let imgHeight = imgWidth / imgRatio;
        
        if (imgHeight > imgMaxHeight) {
          imgHeight = imgMaxHeight;
          imgWidth = imgHeight * imgRatio;
        }
        
        const imgX = (pageWidth - imgWidth) / 2;
        const imgY = 32;
        
        // Ombre
        pdf.setFillColor(220, 220, 220);
        pdf.roundedRect(imgX + 2, imgY + 2, imgWidth, imgHeight, 2, 2, 'F');
        
        // Image avec format auto-détecté
        const imageFormat = image.base64Data.includes('image/jpeg') ? 'JPEG' : 'PNG';
        pdf.addImage(image.base64Data, imageFormat, imgX, imgY, imgWidth, imgHeight);
        
        // Bordure
        pdf.setDrawColor(200, 200, 200);
        pdf.roundedRect(imgX, imgY, imgWidth, imgHeight, 2, 2, 'S');
      }
      
      // Zone de texte en bas
      const textY = pageHeight - 42;
      
      // Contenu descriptif
      if (section.content) {
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        const contentLines = pdf.splitTextToSize(section.content, pageWidth - 40);
        pdf.text(contentLines.slice(0, 3), margin + 5, textY);
      }
      
      // Points clés (highlights)
      if (section.highlights && section.highlights.length > 0) {
        pdf.setFontSize(9);
        pdf.setTextColor(...accentColor);
        const highlightText = section.highlights.slice(0, 3).map((h: string) => `• ${h}`).join('  ');
        pdf.text(highlightText, margin + 5, textY + 12);
      }
      
      // Pied de page
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${i + 2} / ${images.length + 2}`, pageWidth - 15, pageHeight - 8);
      pdf.text(cockpitName, margin, pageHeight - 8);
    }
    
    // === PAGE DE CONCLUSION ===
    pdf.addPage();
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFillColor(...accentColor);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    // Titre conclusion
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.text('Conclusion', pageWidth / 2, 28, { align: 'center' });
    
    // Texte de conclusion
    if (scenario.conclusion) {
      pdf.setFontSize(14);
      pdf.setTextColor(220, 235, 255);
      const conclusionLines = pdf.splitTextToSize(scenario.conclusion, pageWidth - 80);
      pdf.text(conclusionLines, pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });
    }
    
    // Call to action
    if (scenario.callToAction) {
      pdf.setFontSize(12);
      pdf.setTextColor(255, 200, 100);
      pdf.text(`→ ${scenario.callToAction}`, pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });
    }
    
    // Merci
    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Merci pour votre attention', pageWidth / 2, pageHeight - 30, { align: 'center' });
    
    // Retourner le PDF en base64
    return pdf.output('datauristring');
  }, [cockpitName]);

  // Générer un PPTX avec pptxgenjs
  const generatePPTX = useCallback(async (
    images: CapturedImage[],
    scenario: { title?: string; subtitle?: string; introduction?: string; sections?: any[]; conclusion?: string; callToAction?: string }
  ): Promise<string> => {
    const PptxGenJS = (await import('pptxgenjs')).default;
    
    const pptx = new PptxGenJS();
    pptx.author = 'SOMONE Cockpit Studio';
    pptx.title = scenario.title || cockpitName;
    pptx.subject = 'Présentation de cockpit de supervision';
    pptx.company = 'SOMONE';
    
    // Couleurs du thème
    const primaryColor = '1E3A5F';
    const accentColor = '3B82F6';
    const textColor = '475569';
    
    // === SLIDE DE TITRE ===
    const titleSlide = pptx.addSlide();
    titleSlide.bkgd = primaryColor;
    
    // Bande d'accent en haut
    titleSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: accentColor },
    });
    
    // Titre principal
    titleSlide.addText(scenario.title || cockpitName, {
      x: 0.5,
      y: 2,
      w: '90%',
      h: 1.2,
      fontSize: 40,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
    });
    
    // Sous-titre
    if (scenario.subtitle) {
      titleSlide.addText(scenario.subtitle, {
        x: 0.5,
        y: 3.2,
        w: '90%',
        h: 0.5,
        fontSize: 18,
        color: 'C8DCFF',
        align: 'center',
      });
    }
    
    // Introduction
    if (scenario.introduction) {
      titleSlide.addText(scenario.introduction, {
        x: 1,
        y: 3.9,
        w: '80%',
        h: 0.8,
        fontSize: 14,
        color: 'B4C8E6',
        align: 'center',
      });
    }
    
    // Date
    titleSlide.addText(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), {
      x: 0.5,
      y: 5.1,
      w: '90%',
      h: 0.4,
      fontSize: 11,
      color: '94A3B8',
      align: 'center',
    });
    
    // === SLIDES DE CONTENU ===
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const section = scenario.sections?.[i] || {};
      
      const slide = pptx.addSlide();
      
      // Bandeau d'en-tête
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: '100%',
        h: 0.15,
        fill: { color: primaryColor },
      });
      
      // Numéro de section
      slide.addShape('ellipse', {
        x: 0.3,
        y: 0.25,
        w: 0.4,
        h: 0.4,
        fill: { color: accentColor },
      });
      slide.addText(`${i + 1}`, {
        x: 0.3,
        y: 0.28,
        w: 0.4,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      });
      
      // Titre de la section
      slide.addText(section.title || image.description || `Section ${i + 1}`, {
        x: 0.85,
        y: 0.25,
        w: 8.5,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: primaryColor,
      });
      
      // Image principale
      if (image.base64Data) {
        slide.addImage({
          data: image.base64Data,
          x: 0.4,
          y: 0.85,
          w: 9.2,
          h: 4.2,
          rounding: true,
        });
      }
      
      // Zone de texte en bas
      if (section.content) {
        slide.addText(section.content, {
          x: 0.4,
          y: 5.15,
          w: 7,
          h: 0.5,
          fontSize: 11,
          color: textColor,
        });
      }
      
      // Points clés (highlights)
      if (section.highlights && section.highlights.length > 0) {
        const highlightText = section.highlights.slice(0, 3).map((h: string) => `• ${h}`).join('\n');
        slide.addText(highlightText, {
          x: 7.5,
          y: 5.1,
          w: 2.3,
          h: 0.6,
          fontSize: 9,
          color: accentColor,
          bullet: false,
        });
      }
      
      // Numéro de page
      slide.addText(`${i + 2} / ${images.length + 2}`, {
        x: 9,
        y: 5.35,
        w: 0.8,
        h: 0.25,
        fontSize: 8,
        color: '94A3B8',
        align: 'right',
      });
      
      // Notes du présentateur (contenu + notes)
      const notes = [
        section.content ? `Description: ${section.content}` : '',
        section.notes ? `Notes: ${section.notes}` : '',
        section.highlights?.length ? `Points clés: ${section.highlights.join(', ')}` : '',
      ].filter(Boolean).join('\n\n');
      
      if (notes) {
        slide.addNotes(notes);
      }
    }
    
    // === SLIDE DE CONCLUSION ===
    const conclusionSlide = pptx.addSlide();
    conclusionSlide.bkgd = primaryColor;
    
    // Bandeau d'accent
    conclusionSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: accentColor },
    });
    
    // Titre
    conclusionSlide.addText('Conclusion', {
      x: 0.5,
      y: 0.15,
      w: '90%',
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
    });
    
    // Texte de conclusion
    if (scenario.conclusion) {
      conclusionSlide.addText(scenario.conclusion, {
        x: 1,
        y: 2,
        w: '80%',
        h: 1.5,
        fontSize: 16,
        color: 'DCEAFF',
        align: 'center',
        valign: 'middle',
      });
    }
    
    // Call to action
    if (scenario.callToAction) {
      conclusionSlide.addText(`→ ${scenario.callToAction}`, {
        x: 1,
        y: 3.8,
        w: '80%',
        h: 0.5,
        fontSize: 14,
        color: 'FFC864',
        align: 'center',
      });
    }
    
    // Remerciement
    conclusionSlide.addText('Merci pour votre attention', {
      x: 0.5,
      y: 4.8,
      w: '90%',
      h: 0.5,
      fontSize: 18,
      color: 'FFFFFF',
      align: 'center',
    });
    
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
      
      // Set pour tracker les images déjà capturées (éviter doublons)
      const capturedDomainElements = new Set<string>();
      
      // Charger les images réutilisées depuis la banque
      const reusedImagesData: CapturedImage[] = [];
      if (aiPlan.reusedImageIds && aiPlan.reusedImageIds.length > 0) {
        setGenerationState(prev => ({
          ...prev,
          currentStep: `Chargement de ${aiPlan.reusedImageIds.length} image(s) depuis la banque...`,
          progress: 8,
        }));
        
        for (const imageId of aiPlan.reusedImageIds) {
          try {
            const imgResponse = await fetch(`/api/presentations/images/${cockpitId}/${imageId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (imgResponse.ok) {
              const imgData = await imgResponse.json();
              if (imgData.base64Data) {
                // Trouver les métadonnées de cette image
                const imgMeta = existingImages.find(img => img.id === imageId);
                reusedImagesData.push({
                  id: imageId,
                  cockpitId,
                  filename: imgMeta?.filename || `reused_${imageId}.png`,
                  timestamp: imgMeta?.timestamp || new Date().toISOString(),
                  description: imgMeta?.description || 'Image réutilisée',
                  domainId: imgMeta?.domainId,
                  width: 0,
                  height: 0,
                  base64Data: imgData.base64Data,
                });
                // Marquer comme déjà capturé
                if (imgMeta?.domainId) {
                  capturedDomainElements.add(imgMeta.domainId);
                }
              }
            }
          } catch (err) {
            console.warn(`Impossible de charger l'image ${imageId}:`, err);
          }
        }
        
        if (reusedImagesData.length > 0) {
          capturedImages.push(...reusedImagesData);
          setGenerationState(prev => ({
            ...prev,
            capturedImages: [...prev.capturedImages, ...reusedImagesData],
            currentStep: `${reusedImagesData.length} image(s) réutilisée(s) de la banque`,
          }));
        }
      }

      for (let i = 0; i < totalActions; i++) {
        const action = aiPlan.actions[i];
        
        setGenerationState(prev => ({
          ...prev,
          currentStep: action.description || `Action ${i + 1}/${totalActions}`,
          progress: 10 + Math.floor((i / totalActions) * 50),
        }));

        // Vérifier si on a déjà une image pour ce domaine/élément (éviter doublons)
        if (action.type === 'capture_screen') {
          const captureKey = action.elementId 
            ? `${action.domainId}_${action.elementId}` 
            : action.domainId || 'global';
          
          if (capturedDomainElements.has(captureKey)) {
            console.log(`[Présentation] Image déjà capturée pour ${captureKey}, skip`);
            continue;
          }
          capturedDomainElements.add(captureKey);
        }

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

      setGenerationState(prev => ({
        ...prev,
        currentStep: 'Génération des fichiers de sortie...',
        progress: 70,
      }));

      // Générer les fichiers selon les formats demandés
      const outputFiles: { format: PresentationOutputFormat; filename: string; url: string }[] = [];

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
          filename: generateTimestampedFilename(cockpitName, 'PRES', 'pdf'),
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
          filename: generateTimestampedFilename(cockpitName, 'PRES', 'pptx'),
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
          // Uploader les images une par une vers imgbb (évite erreur 413)
          setGenerationState(prev => ({
            ...prev,
            currentStep: `Upload des ${capturedImages.length} images pour la vidéo...`,
            progress: 89,
          }));
          
          const imageUrls: Record<string, string> = {};
          
          for (let i = 0; i < capturedImages.length; i++) {
            const img = capturedImages[i];
            console.log(`[Video] Upload image ${i + 1}/${capturedImages.length}...`);
            
            try {
              const uploadResponse = await fetch('/api/presentations/upload-image-to-imgbb', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  base64Data: img.base64Data,
                  filename: img.filename,
                }),
              });
              
              if (uploadResponse.ok) {
                const uploadResult = await uploadResponse.json();
                if (uploadResult.url) {
                  imageUrls[`in_img_${i + 1}`] = uploadResult.url;
                }
              } else {
                console.error(`[Video] Échec upload image ${i + 1}:`, uploadResponse.status);
              }
            } catch (uploadError) {
              console.error(`[Video] Erreur upload image ${i + 1}:`, uploadError);
            }
          }
          
          if (Object.keys(imageUrls).length === 0) {
            console.error('[Video] Aucune image uploadée');
            throw new Error('Échec de l\'upload des images');
          }
          
          console.log(`[Video] ${Object.keys(imageUrls).length} images uploadées, lancement RENDI...`);
          
          // Appeler l'API pour démarrer la génération vidéo (avec URLs au lieu de base64)
          const videoResponse = await fetch('/api/presentations/generate-video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cockpitId,
              cockpitName,
              imageUrls, // URLs pré-uploadées (pas de base64)
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
                  console.log(`[RENDI] Poll #${pollCount} - Status: ${videoStatus}`, statusResult);
                  
                  if (statusResult.status === 'SUCCESS') {
                    if (statusResult.videoUrl) {
                      videoUrl = statusResult.videoUrl;
                      console.log(`[RENDI] Vidéo générée: ${videoUrl}`);
                    } else {
                      console.error('[RENDI] SUCCESS mais pas d\'URL!', statusResult);
                      // Essayer de récupérer l'URL du debug
                      if (statusResult.debug?.output_files) {
                        const firstOutput = Object.values(statusResult.debug.output_files)[0] as any;
                        videoUrl = firstOutput?.storage_url || firstOutput?.url;
                        console.log(`[RENDI] URL trouvée dans debug: ${videoUrl}`);
                      }
                    }
                    break;
                  } else if (statusResult.status === 'FAILED') {
                    console.error('[RENDI] Échec génération:', statusResult.error, statusResult.debug);
                    setGenerationState(prev => ({
                      ...prev,
                      errors: [...prev.errors, `Erreur RENDI: ${statusResult.error || 'Échec génération vidéo'}`],
                    }));
                    break;
                  }
                } else {
                  console.error(`[RENDI] Erreur HTTP polling: ${statusResponse.status}`);
                }
              }
              
              if (videoUrl) {
                outputFiles.push({
                  format: 'video',
                  filename: generateTimestampedFilename(cockpitName, 'PRES', 'mp4'),
                  url: videoUrl,
                });
              } else {
                console.warn('[RENDI] Vidéo non générée ou timeout');
                outputFiles.push({
                  format: 'video',
                  filename: generateTimestampedFilename(cockpitName, 'PRES', 'mp4'),
                  url: '', // URL vide si échec
                });
              }
            }
          } else {
            console.error('[RENDI] Erreur lors de la requête');
            outputFiles.push({
              format: 'video',
              filename: generateTimestampedFilename(cockpitName, 'PRES', 'mp4'),
              url: '',
            });
          }
        } catch (videoError) {
          console.error('[RENDI] Erreur génération vidéo:', videoError);
          outputFiles.push({
            format: 'video',
            filename: generateTimestampedFilename(cockpitName, 'PRES', 'mp4'),
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
      // 1. Télécharger les fichiers PDF/PPTX/Vidéo individuellement
      const filesToDownload = outputFiles.filter(f => f.url);
      if (filesToDownload.length > 0) {
        await autoDownloadFiles(filesToDownload);
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

  // Télécharger un fichier généré (gère data URIs et URLs externes via proxy)
  const downloadFile = async (filename: string, url?: string) => {
    if (!url) return;
    
    try {
      if (url.startsWith('data:')) {
        // Téléchargement direct pour les data URIs (PDF, PPTX)
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (url.startsWith('http')) {
        // Pour les URLs externes (vidéos RENDI), utiliser le proxy serveur pour contourner CORS
        console.log(`[Download] Téléchargement via proxy: ${filename}`);
        
        const response = await fetch('/api/presentations/download-video', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoUrl: url, filename }),
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          console.log(`[Download] Vidéo téléchargée: ${filename}`);
        } else {
          console.error(`[Download] Erreur proxy: ${response.status}`);
          // Fallback: ouvrir dans un nouvel onglet
          window.open(url, '_blank');
        }
      }
    } catch (error) {
      console.error(`Erreur téléchargement ${filename}:`, error);
      // Fallback: ouvrir dans un nouvel onglet
      window.open(url, '_blank');
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
      const cleanName = cockpitName.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
      const folder = zip.folder(`${cleanName} Images`);
      
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
      
      // Générer et télécharger le ZIP avec nom horodaté
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, generateTimestampedFilename(cockpitName, 'IMG', 'zip'));
      
    } catch (error) {
      console.error('Erreur lors de la création du ZIP:', error);
    }
  };

  // État pour le téléchargement des images de la banque
  const [isDownloadingBankImages, setIsDownloadingBankImages] = useState(false);

  // Télécharger les images existantes de la banque (récupère les données base64 depuis l'API)
  const downloadExistingImagesFromBank = async () => {
    if (existingImages.length === 0 || !token) return;
    
    setIsDownloadingBankImages(true);
    
    try {
      const zip = new JSZip();
      const cleanName = cockpitName.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
      const folder = zip.folder(`${cleanName} Banque Images`);
      
      if (!folder) {
        setIsDownloadingBankImages(false);
        return;
      }
      
      let downloadedCount = 0;
      
      // Récupérer les données base64 de chaque image depuis l'API
      for (const image of existingImages) {
        try {
          const response = await fetch(`/api/presentations/images/${cockpitId}/${image.id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.base64Data) {
              // Extraire les données base64 pures
              const base64Pure = data.base64Data.split(',')[1];
              if (base64Pure) {
                folder.file(image.filename, base64Pure, { base64: true });
                downloadedCount++;
              }
            }
          }
        } catch (err) {
          console.warn(`Impossible de récupérer l'image ${image.id}:`, err);
        }
      }
      
      if (downloadedCount > 0) {
        // Générer et télécharger le ZIP avec nom horodaté
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, generateTimestampedFilename(cockpitName, 'BANQUE', 'zip'));
      } else {
        console.warn('Aucune image n\'a pu être récupérée (données expirées ou non disponibles)');
        alert('Les images de la banque ont expiré (durée de stockage: 7 jours). Générez une nouvelle présentation pour créer de nouvelles images.');
      }
      
    } catch (error) {
      console.error('Erreur lors du téléchargement des images de la banque:', error);
    } finally {
      setIsDownloadingBankImages(false);
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
      const cleanName = cockpitName.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
      
      // Dossier pour les images (avec nom propre)
      const imagesFolder = zip.folder(`${cleanName} Images`);
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
      
      // Générer et télécharger le ZIP avec nom horodaté
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, generateTimestampedFilename(cockpitName, 'ZIP', 'zip'));
      
    } catch (error) {
      console.error('Erreur lors de la création du ZIP complet:', error);
    }
  };

  // Télécharger automatiquement tous les fichiers générés (PDF, PPTX, vidéos)
  const autoDownloadFiles = async (files: Array<{ filename: string; url?: string; format: PresentationOutputFormat }>) => {
    for (const file of files) {
      if (!file.url) continue;
      
      try {
        if (file.url.startsWith('data:')) {
          // Téléchargement direct pour les data URIs (PDF, PPTX)
          const a = document.createElement('a');
          a.href = file.url;
          a.download = file.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else if (file.url.startsWith('http')) {
          // Pour les URLs externes (vidéos RENDI), utiliser le proxy serveur pour contourner CORS
          setGenerationState(prev => ({
            ...prev,
            currentStep: `Téléchargement de ${file.filename}...`,
          }));
          
          console.log(`[AutoDownload] Téléchargement via proxy: ${file.filename}`);
          
          const response = await fetch('/api/presentations/download-video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoUrl: file.url, filename: file.filename }),
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = file.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            console.log(`[AutoDownload] Vidéo téléchargée: ${file.filename}`);
          } else {
            console.error(`[AutoDownload] Erreur proxy ${file.filename}: ${response.status}`);
          }
        }
      } catch (error) {
        console.error(`Erreur téléchargement ${file.filename}:`, error);
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
              <button
                onClick={downloadExistingImagesFromBank}
                disabled={isDownloadingBankImages || generationState.isGenerating}
                className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs hover:bg-amber-500/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait flex items-center gap-1.5"
                title="Cliquer pour télécharger les images de la banque"
              >
                {isDownloadingBankImages ? (
                  <>
                    <MuiIcon name="HourglassEmpty" size={12} className="animate-spin" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <MuiIcon name="Download" size={12} />
                    {existingImages.length} image(s) en banque
                  </>
                )}
              </button>
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
                    <button
                      onClick={downloadExistingImagesFromBank}
                      disabled={isDownloadingBankImages}
                      className="text-xs text-amber-600 hover:text-amber-700 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                      title="Cliquer pour télécharger les images de la banque"
                    >
                      {isDownloadingBankImages ? (
                        '⏳ Téléchargement en cours...'
                      ) : (
                        `💡 ${existingImages.length} image(s) en banque - cliquer pour télécharger`
                      )}
                    </button>
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
