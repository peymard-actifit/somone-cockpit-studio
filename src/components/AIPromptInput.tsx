import { useState, useRef, useEffect } from 'react';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { MuiIcon } from './IconPicker';
import type { TileStatus, SubElement } from '../types';
import * as XLSX from 'xlsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAction {
  type: string;
  params: Record<string, any>;
}

interface AIResponse {
  message: string;
  actions?: AIAction[];
}

export default function AIPromptInput() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // État pour le drag et le redimensionnement de la fenêtre
  const [position, setPosition] = useState({ x: window.innerWidth - 400, y: 100 });
  const [size, setSize] = useState({ width: 384, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  
  // Charger la position et taille sauvegardées au montage
  useEffect(() => {
    const savedPosition = localStorage.getItem('aiWindowPosition');
    const savedSize = localStorage.getItem('aiWindowSize');
    if (savedPosition) {
      try {
        const { x, y } = JSON.parse(savedPosition);
        setPosition({ x, y });
      } catch (e) {
        // Ignorer si le parsing échoue
      }
    }
    if (savedSize) {
      try {
        const { width, height } = JSON.parse(savedSize);
        setSize({ width, height });
      } catch (e) {
        // Ignorer si le parsing échoue
      }
    }
  }, []);
  
  // Sauvegarder la position et taille quand elles changent
  useEffect(() => {
    localStorage.setItem('aiWindowPosition', JSON.stringify(position));
  }, [position]);
  
  useEffect(() => {
    localStorage.setItem('aiWindowSize', JSON.stringify(size));
  }, [size]);
  
  // Gérer le drag de la fenêtre
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current && isExpanded && !isResizing) {
      setIsDragging(true);
      const rect = windowRef.current.getBoundingClientRect();
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };
  
  // Gérer le redimensionnement
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.width,
        y: e.clientY - rect.height
      });
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && windowRef.current) {
        const newWidth = Math.max(300, Math.min(1200, e.clientX - position.x + dragStart.x));
        const newHeight = Math.max(400, Math.min(window.innerHeight - position.y - 20, e.clientY - position.y + dragStart.y));
        setSize({ width: newWidth, height: newHeight });
      } else if (isDragging && isExpanded) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Limiter la position dans les bounds de la fenêtre
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, isExpanded, position, size]);
  
  const { token } = useAuthStore();
  const {
    currentCockpit,
    updateCockpit,
    addDomain,
    deleteDomain,
    updateDomain,
    reorderDomains,
    addCategory,
    updateCategory,
    deleteCategory,
    addElement,
    deleteElement,
    updateElement,
    moveElement,
    reorderElement,
    cloneElement,
    addSubCategory,
    updateSubCategory,
    deleteSubCategory,
    addSubElement,
    deleteSubElement,
    updateSubElement,
    moveSubElement,
    reorderSubElement,
    addZone,
    deleteZone,
    addMapElement,
    updateMapElement,
    deleteMapElement,
    cloneMapElement,
    updateMapBounds,
    zones,
    currentDomainId,
    currentElementId,
    setCurrentDomain,
    setCurrentElement,
    createCockpit,
    fetchCockpits,
  } = useCockpitStore();
  
  // Vérifier le statut de l'API OpenAI au montage
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch('/api/ai/status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const status = await response.json();
          setAiStatus(status);
        }
      } catch (error) {
        console.error('Erreur vérification statut IA:', error);
      }
    };
    if (token) {
      checkAIStatus();
    }
  }, [token]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
    }]);
  };

  // Lire un fichier uploadé
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const maxSize = 10 * 1024 * 1024; // 10 MB max
    if (file.size > maxSize) {
      addMessage('assistant', `❌ Fichier trop volumineux (max 10 MB). Taille: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      return;
    }
    
    try {
      let content = '';
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.pdf')) {
        // Fichier PDF - extraction du texte avec chargement dynamique
        try {
          const pdfjsLib = await import('pdfjs-dist');
          // Configurer le worker avec unpkg CDN (supporte toutes les versions)
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          const textParts: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            textParts.push(`=== Page ${i} ===\n${pageText}`);
          }
          content = textParts.join('\n\n');
          
          addMessage('assistant', `📄 Fichier PDF "${file.name}" lu avec succès (${pdf.numPages} page(s))`);
        } catch (pdfError) {
          console.error('Erreur lecture PDF:', pdfError);
          addMessage('assistant', `❌ Erreur lors de la lecture du PDF: ${pdfError instanceof Error ? pdfError.message : 'Format non supporté'}`);
          return;
        }
        
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Fichier Excel - conversion en texte lisible
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Convertir toutes les feuilles en texte
        const sheets: string[] = [];
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(worksheet);
          sheets.push(`=== Feuille: ${sheetName} ===\n${csvData}`);
        });
        content = sheets.join('\n\n');
        
        addMessage('assistant', `📊 Fichier Excel "${file.name}" lu avec succès (${workbook.SheetNames.length} feuille(s): ${workbook.SheetNames.join(', ')})`);
        
      } else if (fileName.endsWith('.json')) {
        // Fichier JSON
        const text = await file.text();
        const json = JSON.parse(text);
        content = JSON.stringify(json, null, 2);
      } else if (fileName.endsWith('.csv')) {
        // Fichier CSV
        content = await file.text();
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        // Fichier texte
        content = await file.text();
      } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || fileName.endsWith('.webp')) {
        // Fichier image - convertir en base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            resolve(e.target?.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        // Stocker directement le base64 (format data:image/...;base64,...)
        // On stocke le base64 complet pour l'extraction facile plus tard
        content = base64; // Stocker directement le data URL complet
        
        const imageFormat = fileName.split('.').pop()?.toUpperCase() || 'IMAGE';
        const imageSizeKB = (file.size / 1024).toFixed(2);
        addMessage('assistant', `🖼️ Fichier image "${file.name}" chargé (${imageSizeKB} KB, Format: ${imageFormat}). L'IA pourra analyser le contenu et faire de l'OCR.`);
      } else if (fileName.endsWith('.docx')) {
        // Fichier Word - utiliser mammoth.js pour extraire le texte
        try {
          // @ts-ignore - mammoth n'a pas de types TypeScript officiels
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          // @ts-ignore
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
          
          if (result.messages.length > 0) {
            const warnings = result.messages.filter((m: any) => m.type === 'warning').map((m: any) => m.message).join(', ');
            if (warnings) {
              addMessage('assistant', `⚠️ Avertissements lors de la lecture du Word: ${warnings}`);
            }
          }
          
          addMessage('assistant', `📝 Fichier Word "${file.name}" lu avec succès`);
        } catch (docxError) {
          console.error('Erreur lecture Word:', docxError);
          addMessage('assistant', `❌ Erreur lors de la lecture du fichier Word: ${docxError instanceof Error ? docxError.message : 'Format non supporté. Assurez-vous que le fichier est bien un .docx valide.'}`);
          return;
        }
      } else if (fileName.endsWith('.pptx')) {
        // Fichier PowerPoint - extraire le texte des diapositives
        try {
          // Pour PPTX, on va utiliser une approche simple : convertir en texte via une bibliothèque
          // Pour l'instant, on informe l'utilisateur que le support PPTX est limité
          addMessage('assistant', `⚠️ Le support PowerPoint (.pptx) est en cours de développement. Pour l'instant, veuillez convertir votre présentation en PDF ou exporter le texte.`);
          return;
        } catch (pptxError) {
          console.error('Erreur lecture PowerPoint:', pptxError);
          addMessage('assistant', `❌ Erreur lors de la lecture du fichier PowerPoint: ${pptxError instanceof Error ? pptxError.message : 'Format non supporté'}`);
          return;
        }
      } else {
        // Essayer de lire comme texte
        content = await file.text();
      }
      
      // Limiter la taille du contenu (GPT a des limites de tokens)
      // MAIS pour les images, on ne tronque PAS le base64 car il doit rester complet
      const isImageFile = fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || fileName.endsWith('.webp');
      if (!isImageFile && content.length > 100000) {
        content = content.substring(0, 100000) + '\n\n... (contenu tronqué, fichier trop long pour GPT)';
      }
      
      setAttachedFile({ name: file.name, content });
      addMessage('assistant', `📎 Fichier "${file.name}" attaché. Posez votre question sur ce fichier.`);
      
    } catch (error) {
      console.error('Erreur lecture fichier:', error);
      addMessage('assistant', `❌ Erreur lors de la lecture du fichier: ${error instanceof Error ? error.message : 'Format non supporté'}`);
    }
    
    // Reset input
    e.target.value = '';
  };

  // Retirer le fichier attaché
  const removeAttachedFile = () => {
    setAttachedFile(null);
  };

  // Fonctions utilitaires pour trouver des IDs par nom - protection pour les tableaux
  const findDomainByName = (name: string) => {
    return (currentCockpit?.domains || []).find(d => 
      d.name.toLowerCase() === name.toLowerCase()
    );
  };
  
  const findCategoryByName = (name: string, domainId?: string) => {
    const domains = domainId 
      ? (currentCockpit?.domains || []).filter(d => d.id === domainId)
      : (currentCockpit?.domains || []);
    for (const domain of domains) {
      const cat = (domain.categories || []).find(c => 
        c.name.toLowerCase() === name.toLowerCase()
      );
      if (cat) return cat;
    }
    return null;
  };
  
  const findElementByName = (name: string) => {
    for (const domain of (currentCockpit?.domains || [])) {
      for (const category of (domain.categories || [])) {
        const el = (category.elements || []).find(e => 
          e.name.toLowerCase() === name.toLowerCase()
        );
        if (el) return el;
      }
    }
    return null;
  };
  
  const findSubCategoryByName = (name: string, elementId?: string) => {
    for (const domain of (currentCockpit?.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          if (elementId && element.id !== elementId) continue;
          const sc = (element.subCategories || []).find(sc => 
            sc.name.toLowerCase() === name.toLowerCase()
          );
          if (sc) return sc;
        }
      }
    }
    return null;
  };
  
  const findSubElementByName = (name: string) => {
    for (const domain of (currentCockpit?.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            const se = (subCategory.subElements || []).find(se => 
              se.name.toLowerCase() === name.toLowerCase()
            );
            if (se) return se;
          }
        }
      }
    }
    return null;
  };
  
  // Vérifier si un ID existe dans le cockpit - protection pour les tableaux
  const domainExists = (id: string) => (currentCockpit?.domains || []).some(d => d.id === id);
  const categoryExists = (id: string) => {
    for (const domain of (currentCockpit?.domains || [])) {
      if ((domain.categories || []).some(c => c.id === id)) return true;
    }
    return false;
  };
  const elementExists = (id: string) => {
    for (const domain of (currentCockpit?.domains || [])) {
      for (const category of (domain.categories || [])) {
        if ((category.elements || []).some(e => e.id === id)) return true;
      }
    }
    return false;
  };

  // Exécuter une action retournée par l'IA
  const executeAction = (action: AIAction): string => {
    console.log('🤖 [AIPromptInput] Exécution action:', action.type, action.params);
    
    if (!action.type) {
      console.error('🤖 [AIPromptInput] Action invalide - type manquant:', action);
      return '❌ Action invalide: type manquant';
    }
    
    if (!action.params) {
      console.warn('🤖 [AIPromptInput] Action sans params:', action.type);
      action.params = {};
    }
    
    try {
      switch (action.type) {
        case 'addDomain':
          if (currentCockpit && (currentCockpit.domains || []).length < 6) {
            addDomain(action.params.name.toUpperCase());
            return `✅ Domaine "${action.params.name.toUpperCase()}" créé`;
          }
          return '❌ Maximum 6 domaines atteint';
          
        case 'deleteDomain': {
          let domainId = action.params.domainId;
          // Si l'ID n'existe pas, chercher par nom
          if (!domainId || !domainExists(domainId)) {
            const domain = findDomainByName(action.params.name || action.params.domainName || '');
            domainId = domain?.id;
          }
          if (domainId && domainExists(domainId)) {
            deleteDomain(domainId);
            return `✅ Domaine supprimé`;
          }
          return '❌ Domaine non trouvé';
        }
          
        case 'addCategory': {
          // Trouver le domaine: par ID, par nom, ou utiliser le courant
          let domainId = action.params.domainId;
          if (!domainId || !domainExists(domainId)) {
            if (action.params.domainName) {
              domainId = findDomainByName(action.params.domainName)?.id;
            }
          }
          domainId = domainId || currentDomainId;
          
          if (domainId) {
            addCategory(domainId, action.params.name, action.params.orientation || 'horizontal');
            return `✅ Catégorie "${action.params.name}" créée`;
          }
          return '❌ Aucun domaine sélectionné. Sélectionnez un domaine d\'abord.';
        }
          
        case 'deleteCategory': {
          let categoryId = action.params.categoryId;
          if (!categoryId || !categoryExists(categoryId)) {
            const cat = findCategoryByName(action.params.name || action.params.categoryName || '');
            categoryId = cat?.id;
          }
          if (categoryId) {
            deleteCategory(categoryId);
            return `✅ Catégorie supprimée`;
          }
          return '❌ Catégorie non trouvée';
        }
          
        case 'addElement': {
          // Trouver la catégorie: par ID, par nom, ou première du domaine courant
          let categoryId = action.params.categoryId;
          if (!categoryId || !categoryExists(categoryId)) {
            if (action.params.categoryName) {
              categoryId = findCategoryByName(action.params.categoryName)?.id;
            }
          }
          if (!categoryId && currentDomainId) {
            const domain = (currentCockpit?.domains || []).find(d => d.id === currentDomainId);
            categoryId = (domain?.categories || [])[0]?.id;
          }
          
          if (categoryId) {
            addElement(categoryId, action.params.name);
            return `✅ Élément "${action.params.name}" créé`;
          }
          return '❌ Aucune catégorie disponible. Créez une catégorie d\'abord.';
        }
          
        case 'addElements': {
          const names = action.params.names || [];
          let categoryId = action.params.categoryId;
          
          if (!categoryId || !categoryExists(categoryId)) {
            if (action.params.categoryName) {
              categoryId = findCategoryByName(action.params.categoryName)?.id;
            }
          }
          if (!categoryId && currentDomainId) {
            const domain = (currentCockpit?.domains || []).find(d => d.id === currentDomainId);
            categoryId = (domain?.categories || [])[0]?.id;
          }
          
          if (categoryId && names.length > 0) {
            names.forEach((name: string) => addElement(categoryId!, name));
            return `✅ ${names.length} éléments créés`;
          }
          return '❌ Aucune catégorie disponible ou liste vide';
        }
          
        case 'deleteElement': {
          let elementId = action.params.elementId;
          if (!elementId || !elementExists(elementId)) {
            const el = findElementByName(action.params.name || action.params.elementName || '');
            elementId = el?.id;
          }
          if (elementId) {
            deleteElement(elementId);
            return `✅ Élément supprimé`;
          }
          return '❌ Élément non trouvé';
        }
          
        case 'updateElement': {
          let elementId = action.params.elementId;
          if (!elementId || !elementExists(elementId)) {
            const el = findElementByName(action.params.name || action.params.elementName || '');
            elementId = el?.id;
          }
          elementId = elementId || currentElementId;
          
          if (elementId) {
            updateElement(elementId, action.params.updates || action.params);
            return `✅ Élément mis à jour`;
          }
          return '❌ Aucun élément sélectionné';
        }
          
        case 'updateStatus': {
          const status = action.params.status as TileStatus;
          
          if (action.params.elementId || action.params.elementName) {
            let elementId = action.params.elementId;
            if (!elementId || !elementExists(elementId)) {
              elementId = findElementByName(action.params.elementName)?.id;
            }
            if (elementId) {
              updateElement(elementId, { status });
              return `✅ Statut → ${status}`;
            }
          }
          
          if (action.params.subElementId || action.params.subElementName) {
            let subEl = action.params.subElementId 
              ? null 
              : findSubElementByName(action.params.subElementName);
            const subElementId = action.params.subElementId || subEl?.id;
            if (subElementId) {
              updateSubElement(subElementId, { status });
              return `✅ Statut → ${status}`;
            }
          }
          
          if (currentElementId) {
            updateElement(currentElementId, { status });
            return `✅ Statut → ${status}`;
          }
          return '❌ Aucun élément sélectionné';
        }
          
        case 'addSubCategory': {
          const elementId = action.params.elementId || currentElementId;
          if (elementId) {
            addSubCategory(elementId, action.params.name, action.params.orientation || 'horizontal');
            return `✅ Sous-catégorie "${action.params.name}" créée`;
          }
          return '❌ Aucun élément sélectionné. Cliquez sur un élément d\'abord.';
        }
          
        case 'deleteSubCategory': {
          let subCategoryId = action.params.subCategoryId;
          if (!subCategoryId) {
            const sc = findSubCategoryByName(action.params.name || action.params.subCategoryName || '');
            subCategoryId = sc?.id;
          }
          if (subCategoryId) {
            deleteSubCategory(subCategoryId);
            return `✅ Sous-catégorie supprimée`;
          }
          return '❌ Sous-catégorie non trouvée';
        }
          
        case 'addSubElement': {
          let subCategoryId = action.params.subCategoryId;
          if (!subCategoryId && action.params.subCategoryName) {
            subCategoryId = findSubCategoryByName(action.params.subCategoryName)?.id;
          }
          if (subCategoryId) {
            addSubElement(subCategoryId, action.params.name);
            return `✅ Sous-élément "${action.params.name}" créé`;
          }
          return '❌ Aucune sous-catégorie disponible';
        }
          
        case 'addSubElements': {
          const names = action.params.names || [];
          let subCategoryId = action.params.subCategoryId;
          if (!subCategoryId && action.params.subCategoryName) {
            // Chercher dans l'élément courant si spécifié
            const elementId = action.params.elementId || currentElementId;
            const subCategory = findSubCategoryByName(action.params.subCategoryName, elementId);
            // findSubCategoryByName retourne null ou un objet avec .id
            subCategoryId = subCategory ? subCategory.id : undefined;
            
            // Si pas trouvé avec elementId, chercher globalement
            if (!subCategoryId) {
              const subCategoryGlobal = findSubCategoryByName(action.params.subCategoryName);
              subCategoryId = subCategoryGlobal ? subCategoryGlobal.id : undefined;
            }
          }
          
          if (!subCategoryId) {
            console.error(`[addSubElements] Sous-catégorie "${action.params.subCategoryName || action.params.subCategoryId || 'non spécifiée'}" non trouvée`);
            console.error(`[addSubElements] Paramètres:`, action.params);
            return `❌ Sous-catégorie "${action.params.subCategoryName || action.params.subCategoryId || 'non spécifiée'}" non trouvée pour addSubElements`;
          }
          
          if (names.length > 0) {
            names.forEach((name: string) => addSubElement(subCategoryId!, name));
            return `✅ ${names.length} sous-éléments créés dans la sous-catégorie`;
          }
          return '❌ Liste de noms vide pour addSubElements';
        }
          
        case 'deleteSubElement': {
          let subElementId = action.params.subElementId;
          if (!subElementId) {
            const se = findSubElementByName(action.params.name || action.params.subElementName || '');
            subElementId = se?.id;
          }
          if (subElementId) {
            deleteSubElement(subElementId);
            return `✅ Sous-élément supprimé`;
          }
          return '❌ Sous-élément non trouvé';
        }
          
        case 'selectDomain': {
          let domainId = action.params.domainId;
          if (!domainId || !domainExists(domainId)) {
            domainId = findDomainByName(action.params.name || action.params.domainName || '')?.id;
          }
          if (domainId) {
            setCurrentDomain(domainId);
            return `✅ Domaine sélectionné`;
          }
          return '❌ Domaine non trouvé';
        }
          
        case 'selectElement': {
          let elementId = action.params.elementId;
          if (!elementId || !elementExists(elementId)) {
            elementId = findElementByName(action.params.name || action.params.elementName || '')?.id;
          }
          if (elementId) {
            setCurrentElement(elementId);
            return `✅ Élément sélectionné`;
          }
          return '❌ Élément non trouvé';
        }
        
        case 'updateDomain': {
          let domainId = action.params.domainId;
          if (!domainId || !domainExists(domainId)) {
            domainId = findDomainByName(action.params.name || '')?.id || currentDomainId;
          }
          if (domainId) {
            const updates = action.params.updates || {};
            if (action.params.name && !updates.name) updates.name = action.params.name;
            updateDomain(domainId, updates);
            return `✅ Domaine mis à jour`;
          }
          return '❌ Domaine non trouvé';
        }
        
        case 'updateCategory': {
          let categoryId = action.params.categoryId;
          if (!categoryId || !categoryExists(categoryId)) {
            categoryId = findCategoryByName(action.params.name || '')?.id;
          }
          if (categoryId) {
            const updates = action.params.updates || {};
            if (action.params.name && !updates.name) updates.name = action.params.name;
            updateCategory(categoryId, updates);
            return `✅ Catégorie mise à jour`;
          }
          return '❌ Catégorie non trouvée';
        }
        
        case 'updateSubCategory': {
          let subCategoryId = action.params.subCategoryId;
          if (!subCategoryId) {
            subCategoryId = findSubCategoryByName(action.params.name || '')?.id;
          }
          if (subCategoryId) {
            const updates = action.params.updates || {};
            if (action.params.name && !updates.name) updates.name = action.params.name;
            updateSubCategory(subCategoryId, updates);
            return `✅ Sous-catégorie mise à jour`;
          }
          return '❌ Sous-catégorie non trouvée';
        }
        
        case 'updateSubElement': {
          let subElementId = action.params.subElementId;
          if (!subElementId) {
            subElementId = findSubElementByName(action.params.name || '')?.id;
          }
          if (subElementId) {
            updateSubElement(subElementId, action.params.updates || {});
            return `✅ Sous-élément mis à jour`;
          }
          return '❌ Sous-élément non trouvé';
        }
        
        case 'cloneElement': {
          let elementId = action.params.elementId;
          if (!elementId || !elementExists(elementId)) {
            elementId = findElementByName(action.params.name || '')?.id || currentElementId;
          }
          if (elementId) {
            cloneElement(elementId);
            return `✅ Élément cloné`;
          }
          return '❌ Élément non trouvé';
        }
        
        case 'addZone': {
          addZone(action.params.name);
          return `✅ Zone "${action.params.name}" créée`;
        }
        
        case 'deleteZone': {
          const zone = zones?.find((z: any) => z.id === action.params.zoneId || z.name === action.params.name);
          if (zone) {
            deleteZone(zone.id);
            return `✅ Zone supprimée`;
          }
          return '❌ Zone non trouvée';
        }
        
        case 'addMapElement': {
          let domainId = action.params.domainId;
          if (!domainId || !domainExists(domainId)) {
            domainId = findDomainByName(action.params.domainName || '')?.id || currentDomainId;
          }
          if (domainId && action.params.lat && action.params.lng) {
            addMapElement(
              domainId,
              action.params.name,
              { lat: action.params.lat, lng: action.params.lng },
              action.params.status || 'ok',
              action.params.icon
            );
            return `✅ Point de carte "${action.params.name}" ajouté`;
          }
          return '❌ Paramètres invalides pour addMapElement';
        }
        
        case 'updateMapElement': {
          let mapElementId = action.params.mapElementId;
          if (!mapElementId && action.params.name) {
            // Chercher dans tous les domaines
            for (const domain of currentCockpit?.domains || []) {
              const mapEl = domain.mapElements?.find(me => me.name === action.params.name);
              if (mapEl) {
                mapElementId = mapEl.id;
                break;
              }
            }
          }
          if (mapElementId) {
            const updates: any = action.params.updates || {};
            if (action.params.name && !updates.name) updates.name = action.params.name;
            if (action.params.lat && action.params.lng) {
              updates.gps = { lat: action.params.lat, lng: action.params.lng };
            }
            updateMapElement(mapElementId, updates);
            return `✅ Point de carte mis à jour`;
          }
          return '❌ Point de carte non trouvé';
        }
        
        case 'deleteMapElement': {
          let mapElementId = action.params.mapElementId;
          if (!mapElementId && action.params.name) {
            for (const domain of currentCockpit?.domains || []) {
              const mapEl = domain.mapElements?.find(me => me.name === action.params.name);
              if (mapEl) {
                mapElementId = mapEl.id;
                break;
              }
            }
          }
          if (mapElementId) {
            deleteMapElement(mapElementId);
            return `✅ Point de carte supprimé`;
          }
          return '❌ Point de carte non trouvé';
        }
        
        case 'cloneMapElement': {
          let mapElementId = action.params.mapElementId;
          if (!mapElementId && action.params.name) {
            for (const domain of currentCockpit?.domains || []) {
              const mapEl = domain.mapElements?.find(me => me.name === action.params.name);
              if (mapEl) {
                mapElementId = mapEl.id;
                break;
              }
            }
          }
          if (mapElementId) {
            cloneMapElement(mapElementId);
            return `✅ Point de carte cloné`;
          }
          return '❌ Point de carte non trouvé';
        }
        
        case 'updateMapBounds': {
          let domainId = action.params.domainId;
          if (!domainId || !domainExists(domainId)) {
            domainId = findDomainByName(action.params.domainName || '')?.id || currentDomainId;
          }
          if (domainId && action.params.topLeft && action.params.bottomRight) {
            updateMapBounds(domainId, {
              topLeft: action.params.topLeft,
              bottomRight: action.params.bottomRight
            });
            return `✅ Coordonnées GPS de la carte mises à jour`;
          }
          return '❌ Paramètres invalides pour updateMapBounds';
        }
        
        case 'updateCockpit': {
          if (!currentCockpit) return '❌ Aucun cockpit ouvert';
          const updates = action.params.updates || {};
          if (action.params.name && !updates.name) updates.name = action.params.name;
          if (action.params.logo !== undefined && !updates.logo) updates.logo = action.params.logo;
          if (action.params.scrollingBanner !== undefined && !updates.scrollingBanner) updates.scrollingBanner = action.params.scrollingBanner;
          updateCockpit(updates);
          return `✅ Cockpit mis à jour`;
        }
        
        case 'reorderDomains': {
          const domainIds = action.params.domainIds || [];
          if (domainIds.length === 0) return '❌ Liste de domaines vide';
          if (!currentCockpit) return '❌ Aucun cockpit ouvert';
          
          // Vérifier que tous les domaines existent
          const validDomainIds = domainIds.filter((id: string) => domainExists(id));
          if (validDomainIds.length !== domainIds.length) {
            return '❌ Certains domaines n\'existent pas';
          }
          
          reorderDomains(validDomainIds);
          return `✅ Ordre des domaines mis à jour`;
        }
        
        case 'moveElement': {
          let elementId = action.params.elementId;
          if (!elementId || !elementExists(elementId)) {
            elementId = findElementByName(action.params.elementName || '')?.id;
          }
          
          let toCategoryId = action.params.toCategoryId;
          if (!toCategoryId || !categoryExists(toCategoryId)) {
            toCategoryId = findCategoryByName(action.params.toCategoryName || '')?.id;
          }
          
          let fromCategoryId = action.params.fromCategoryId;
          if (!fromCategoryId || !categoryExists(fromCategoryId)) {
            // Trouver la catégorie actuelle de l'élément - protection pour les tableaux
            for (const domain of (currentCockpit?.domains || [])) {
              for (const category of (domain.categories || [])) {
                if ((category.elements || []).some(e => e.id === elementId)) {
                  fromCategoryId = category.id;
                  break;
                }
              }
              if (fromCategoryId) break;
            }
          }
          
          if (elementId && fromCategoryId && toCategoryId) {
            moveElement(elementId, fromCategoryId, toCategoryId);
            return `✅ Élément déplacé`;
          }
          return '❌ Paramètres invalides pour moveElement';
        }
        
        case 'reorderElement': {
          let elementId = action.params.elementId;
          if (!elementId || !elementExists(elementId)) {
            elementId = findElementByName(action.params.elementName || '')?.id;
          }
          
          let categoryId = action.params.categoryId;
          if (!categoryId || !categoryExists(categoryId)) {
            categoryId = findCategoryByName(action.params.categoryName || '')?.id;
          }
          
          const newIndex = action.params.newIndex;
          if (typeof newIndex !== 'number' || newIndex < 0) {
            return '❌ Index invalide (doit être un nombre >= 0)';
          }
          
          if (elementId && categoryId) {
            reorderElement(elementId, categoryId, newIndex);
            return `✅ Ordre de l'élément mis à jour`;
          }
          return '❌ Paramètres invalides pour reorderElement';
        }
        
        case 'moveSubElement': {
          let subElementId = action.params.subElementId;
          if (!subElementId) {
            subElementId = findSubElementByName(action.params.subElementName || '')?.id;
          }
          
          let toSubCategoryId = action.params.toSubCategoryId;
          if (!toSubCategoryId) {
            toSubCategoryId = findSubCategoryByName(action.params.toSubCategoryName || '')?.id;
          }
          
          let fromSubCategoryId = action.params.fromSubCategoryId;
          if (!fromSubCategoryId) {
            // Trouver la sous-catégorie actuelle - protection pour les tableaux
            for (const domain of (currentCockpit?.domains || [])) {
              for (const category of (domain.categories || [])) {
                for (const element of (category.elements || [])) {
                  for (const subCategory of (element.subCategories || [])) {
                    if ((subCategory.subElements || []).some(se => se.id === subElementId)) {
                      fromSubCategoryId = subCategory.id;
                      break;
                    }
                  }
                  if (fromSubCategoryId) break;
                }
                if (fromSubCategoryId) break;
              }
              if (fromSubCategoryId) break;
            }
          }
          
          if (subElementId && fromSubCategoryId && toSubCategoryId) {
            moveSubElement(subElementId, fromSubCategoryId, toSubCategoryId);
            return `✅ Sous-élément déplacé`;
          }
          return '❌ Paramètres invalides pour moveSubElement';
        }
        
        case 'reorderSubElement': {
          let subElementId = action.params.subElementId;
          if (!subElementId) {
            subElementId = findSubElementByName(action.params.subElementName || '')?.id;
          }
          
          let subCategoryId = action.params.subCategoryId;
          if (!subCategoryId) {
            subCategoryId = findSubCategoryByName(action.params.subCategoryName || '')?.id;
          }
          
          const newIndex = action.params.newIndex;
          if (typeof newIndex !== 'number' || newIndex < 0) {
            return '❌ Index invalide (doit être un nombre >= 0)';
          }
          
          if (subElementId && subCategoryId) {
            reorderSubElement(subElementId, subCategoryId, newIndex);
            return `✅ Ordre du sous-élément mis à jour`;
          }
          return '❌ Paramètres invalides pour reorderSubElement';
        }
        
        case 'addDataSource': {
          let subElementId = action.params.subElementId;
          if (!subElementId && action.params.subElementName) {
            subElementId = findSubElementByName(action.params.subElementName)?.id;
          }
          if (!subElementId && currentElementId) {
            const element = currentCockpit?.domains
              .flatMap(d => d.categories)
              .flatMap(c => c.elements)
              .find(e => e.id === currentElementId);
            const firstSubElement = element?.subCategories[0]?.subElements[0];
            if (firstSubElement) subElementId = firstSubElement.id;
          }
          if (subElementId) {
            const subElement = findSubElementById(subElementId);
            if (subElement) {
              const newSource = {
                id: crypto.randomUUID(),
                subElementId,
                name: action.params.name,
                type: action.params.type || 'other',
                location: action.params.location,
                connection: action.params.connection,
                fields: action.params.fields,
                description: action.params.description,
              };
              const sources = subElement.sources || [];
              updateSubElement(subElementId, { sources: [...sources, newSource] });
              return `✅ Source de données "${action.params.name}" ajoutée`;
            }
          }
          return '❌ Sous-élément non trouvé. Sélectionnez un sous-élément ou spécifiez subElementName.';
        }
        
        case 'updateDataSource': {
          let subElementId = action.params.subElementId;
          if (!subElementId && action.params.subElementName) {
            subElementId = findSubElementByName(action.params.subElementName)?.id;
          }
          if (subElementId) {
            const subElement = findSubElementById(subElementId);
            if (subElement) {
              const sources = subElement.sources || [];
              const sourceIndex = sources.findIndex(s => s.id === action.params.dataSourceId);
              if (sourceIndex >= 0) {
                const updated = { ...sources[sourceIndex], ...action.params.updates };
                sources[sourceIndex] = updated;
                updateSubElement(subElementId, { sources: [...sources] });
                return `✅ Source de données mise à jour`;
              }
            }
          }
          return '❌ Source de données non trouvée';
        }
        
        case 'deleteDataSource': {
          let subElementId = action.params.subElementId;
          if (!subElementId && action.params.subElementName) {
            subElementId = findSubElementByName(action.params.subElementName)?.id;
          }
          if (subElementId) {
            const subElement = findSubElementById(subElementId);
            if (subElement) {
              const sources = (subElement.sources || []).filter(s => s.id !== action.params.dataSourceId);
              updateSubElement(subElementId, { sources });
              return `✅ Source de données supprimée`;
            }
          }
          return '❌ Source de données non trouvée';
        }
        
        case 'addCalculation': {
          let subElementId = action.params.subElementId;
          if (!subElementId && action.params.subElementName) {
            subElementId = findSubElementByName(action.params.subElementName)?.id;
          }
          if (!subElementId && currentElementId) {
            const element = currentCockpit?.domains
              .flatMap(d => d.categories)
              .flatMap(c => c.elements)
              .find(e => e.id === currentElementId);
            const firstSubElement = element?.subCategories[0]?.subElements[0];
            if (firstSubElement) subElementId = firstSubElement.id;
          }
          if (subElementId) {
            const subElement = findSubElementById(subElementId);
            if (subElement) {
              const newCalculation = {
                id: crypto.randomUUID(),
                subElementId,
                name: action.params.name,
                description: action.params.description,
                definition: action.params.definition || '',
                sources: action.params.sources || [],
              };
              const calculations = subElement.calculations || [];
              updateSubElement(subElementId, { calculations: [...calculations, newCalculation] });
              return `✅ Calcul "${action.params.name}" ajouté`;
            }
          }
          return '❌ Sous-élément non trouvé. Sélectionnez un sous-élément ou spécifiez subElementName.';
        }
        
        case 'updateCalculation': {
          let subElementId = action.params.subElementId;
          if (!subElementId && action.params.subElementName) {
            subElementId = findSubElementByName(action.params.subElementName)?.id;
          }
          if (subElementId) {
            const subElement = findSubElementById(subElementId);
            if (subElement) {
              const calculations = subElement.calculations || [];
              const calcIndex = calculations.findIndex(c => c.id === action.params.calculationId);
              if (calcIndex >= 0) {
                const updated = { ...calculations[calcIndex], ...action.params.updates };
                calculations[calcIndex] = updated;
                updateSubElement(subElementId, { calculations: [...calculations] });
                return `✅ Calcul mis à jour`;
              }
            }
          }
          return '❌ Calcul non trouvé';
        }
        
        case 'setDisplayPreference': {
          // Contrôler les préférences d'affichage (sliders, toggles)
          let domainId = action.params.domainId || currentDomainId;
          if (!domainId && action.params.domainName) {
            domainId = findDomainByName(action.params.domainName)?.id;
          }
          
          const domainStorageKey = domainId ? `domain_${domainId}` : 'global';
          const elementStorageKey = action.params.elementId ? `element_${action.params.elementId}` : 'global';
          
          // Préférences de domaine
          if (action.params.horizontalSpacing !== undefined) {
            const value = Math.max(0, Math.min(100, parseInt(String(action.params.horizontalSpacing), 10)));
            localStorage.setItem(`horizontalSpacing_${domainStorageKey}`, String(value));
            window.dispatchEvent(new Event(`spacingPreferenceChanged_${domainStorageKey}`));
          }
          
          if (action.params.categorySpacing !== undefined) {
            const value = Math.max(0, Math.min(100, parseInt(String(action.params.categorySpacing), 10)));
            localStorage.setItem(`categorySpacing_${domainStorageKey}`, String(value));
            window.dispatchEvent(new Event(`spacingPreferenceChanged_${domainStorageKey}`));
          }
          
          if (action.params.greenTilesAsColored !== undefined) {
            const value = Boolean(action.params.greenTilesAsColored);
            localStorage.setItem(`greenTilesAsColored_${domainStorageKey}`, String(value));
            window.dispatchEvent(new Event(`greenTilesPreferenceChanged_${domainStorageKey}`));
          }
          
          if (action.params.horizontalCategoriesInline !== undefined) {
            const value = Boolean(action.params.horizontalCategoriesInline);
            localStorage.setItem(`horizontalCategoriesInline_${domainStorageKey}`, String(value));
            window.dispatchEvent(new Event(`horizontalCategoriesPreferenceChanged_${domainStorageKey}`));
          }
          
          // Préférences d'élément
          if (action.params.elementId && action.params.subCategorySpacing !== undefined) {
            const value = Math.max(0, Math.min(100, parseInt(String(action.params.subCategorySpacing), 10)));
            localStorage.setItem(`subCategorySpacing_${elementStorageKey}`, String(value));
            window.dispatchEvent(new Event(`spacingPreferenceChanged_${elementStorageKey}`));
          }
          
          if (action.params.elementId && action.params.verticalSubCategoryWidth !== undefined) {
            const value = Math.max(100, Math.min(500, parseInt(String(action.params.verticalSubCategoryWidth), 10)));
            localStorage.setItem(`verticalSubCategoryWidth_${elementStorageKey}`, String(value));
            window.dispatchEvent(new Event(`verticalSubCategoryWidthChanged_${elementStorageKey}`));
          }
          
          if (action.params.elementId && action.params.horizontalSubCategoriesInline !== undefined) {
            const value = Boolean(action.params.horizontalSubCategoriesInline);
            localStorage.setItem(`horizontalSubCategoriesInline_${elementStorageKey}`, String(value));
            window.dispatchEvent(new Event(`horizontalSubCategoriesPreferenceChanged_${elementStorageKey}`));
          }
          
          return `✅ Préférences d'affichage mises à jour`;
        }
        
        case 'deleteCalculation': {
          let subElementId = action.params.subElementId;
          if (!subElementId && action.params.subElementName) {
            subElementId = findSubElementByName(action.params.subElementName)?.id;
          }
          if (subElementId) {
            const subElement = findSubElementById(subElementId);
            if (subElement) {
              const calculations = (subElement.calculations || []).filter(c => c.id !== action.params.calculationId);
              updateSubElement(subElementId, { calculations });
              return `✅ Calcul supprimé`;
            }
          }
          return '❌ Calcul non trouvé';
        }
        
        case 'createCockpit': {
          const name = action.params.name || 'Nouveau Cockpit';
          // Note: createCockpit est asynchrone mais executeAction est synchrone
          // On lance la création en arrière-plan
          createCockpit(name).then(newCockpit => {
            if (newCockpit) {
              fetchCockpits();
            }
          }).catch(error => {
            console.error('Erreur création cockpit:', error);
          });
          return `✅ Création du cockpit "${name}" en cours... Tu peux ajouter des domaines et éléments dès qu'il sera créé.`;
        }
          
        default:
          console.warn('Action non reconnue:', action.type);
          return `⚠️ Action non reconnue: ${action.type}`;
      }
    } catch (error) {
      console.error('❌ Erreur exécution action:', action.type, error);
      return `❌ Erreur: ${error instanceof Error ? error.message : 'inconnue'}`;
    }
  };
  
  // Helper pour trouver un sous-élément par ID - protection pour les tableaux
  const findSubElementById = (id: string): SubElement | undefined => {
    if (!currentCockpit) return undefined;
    for (const domain of (currentCockpit.domains || [])) {
      for (const category of (domain.categories || [])) {
        for (const element of (category.elements || [])) {
          for (const subCategory of (element.subCategories || [])) {
            const found = (subCategory.subElements || []).find(se => se.id === id);
            if (found) return found;
          }
        }
      }
    }
    return undefined;
  };
  
  // Exécuter plusieurs actions
  const executeActions = (actions: AIAction[]): string => {
    if (!actions || actions.length === 0) {
      console.log('🤖 [AIPromptInput] Aucune action à exécuter');
      return '';
    }
    
    console.log(`🤖 [AIPromptInput] Exécution de ${actions.length} action(s)`);
    
    // Gérer de très gros tableaux d'actions (100+)
    if (actions.length > 50) {
      console.log(`🤖 [AIPromptInput] ⚠️ Nombre élevé d'actions (${actions.length}), traitement séquentiel...`);
    }
    
    // Mapping pour stocker les IDs créés (nom -> id)
    const createdIds: { categories: Map<string, string>, subCategories: Map<string, string> } = {
      categories: new Map(),
      subCategories: new Map()
    };
    
    // Exécuter les actions SÉQUENTIELLEMENT pour que les IDs créés soient disponibles
    const results: string[] = [];
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index];
      
      // Log tous les 10 actions pour éviter de surcharger la console
      if (index % 10 === 0 || index === actions.length - 1) {
        console.log(`🤖 [AIPromptInput] Action ${index + 1}/${actions.length}:`, action.type);
      }
      
      try {
        // Si l'action référence une catégorie par nom et qu'elle vient d'être créée, utiliser son ID
        if (action.type === 'addElement' || action.type === 'addElements') {
          const categoryName = action.params.categoryName;
          if (categoryName && createdIds.categories.has(categoryName)) {
            action.params.categoryId = createdIds.categories.get(categoryName);
            delete action.params.categoryName; // Utiliser l'ID au lieu du nom
            console.log(`🤖 [AIPromptInput] Résolution catégorie "${categoryName}" -> ID: ${action.params.categoryId}`);
          }
        }
        
        // Si l'action référence une sous-catégorie par nom et qu'elle vient d'être créée, utiliser son ID
        if (action.type === 'addSubElement' || action.type === 'addSubElements') {
          const subCategoryName = action.params.subCategoryName;
          if (subCategoryName) {
            // D'abord, vérifier si elle est dans le cache des IDs créés
            if (createdIds.subCategories.has(subCategoryName)) {
              action.params.subCategoryId = createdIds.subCategories.get(subCategoryName);
              delete action.params.subCategoryName; // Utiliser l'ID au lieu du nom
              console.log(`🤖 [AIPromptInput] Résolution sous-catégorie "${subCategoryName}" depuis cache -> ID: ${action.params.subCategoryId}`);
            } else {
              // Si pas dans le cache, chercher dans le store
              const elementId = action.params.elementId || currentElementId;
              const subCategory = findSubCategoryByName(subCategoryName, elementId);
              // findSubCategoryByName retourne null ou un objet avec .id
              if (subCategory && subCategory.id) {
                action.params.subCategoryId = subCategory.id;
                delete action.params.subCategoryName;
                createdIds.subCategories.set(subCategoryName, subCategory.id); // Mettre en cache
                console.log(`🤖 [AIPromptInput] Résolution sous-catégorie "${subCategoryName}" depuis store -> ID: ${subCategory.id}`);
              } else {
                // Essayer une recherche globale (sans elementId)
                const subCategoryGlobal = findSubCategoryByName(subCategoryName);
                if (subCategoryGlobal && subCategoryGlobal.id) {
                  action.params.subCategoryId = subCategoryGlobal.id;
                  delete action.params.subCategoryName;
                  createdIds.subCategories.set(subCategoryName, subCategoryGlobal.id); // Mettre en cache
                  console.log(`🤖 [AIPromptInput] Résolution sous-catégorie "${subCategoryName}" depuis recherche globale -> ID: ${subCategoryGlobal.id}`);
                } else {
                  console.warn(`🤖 [AIPromptInput] Sous-catégorie "${subCategoryName}" non trouvée dans le store`);
                }
              }
            }
          }
        }
        
        const result = executeAction(action);
        results.push(result);
        
        // Si une catégorie a été créée, stocker son ID - protection pour les tableaux
        if (action.type === 'addCategory' && action.params.name) {
          // Trouver l'ID de la catégorie créée
          const domainId = action.params.domainId || currentDomainId;
          if (domainId) {
            const domain = (currentCockpit?.domains || []).find(d => d.id === domainId);
            const category = (domain?.categories || []).find(c => c.name === action.params.name);
            if (category) {
              createdIds.categories.set(action.params.name, category.id);
              console.log(`🤖 [AIPromptInput] Catégorie "${action.params.name}" créée avec ID: ${category.id}`);
            }
          }
        }
        
        // Si une sous-catégorie a été créée, stocker son ID
        // Le store Zustand se met à jour de manière synchrone, donc on peut chercher immédiatement
        if (action.type === 'addSubCategory' && action.params.name) {
          const elementId = action.params.elementId || currentElementId;
          if (elementId) {
            // Utiliser findSubCategoryByName qui cherche dans currentCockpit (mis à jour par Zustand)
            const subCategory = findSubCategoryByName(action.params.name, elementId);
            if (subCategory) {
              createdIds.subCategories.set(action.params.name, subCategory.id);
              console.log(`🤖 [AIPromptInput] Sous-catégorie "${action.params.name}" créée avec ID: ${subCategory.id}`);
            } else {
              // Si pas trouvée, essayer une recherche plus large (sans elementId)
              const subCategoryGlobal = findSubCategoryByName(action.params.name);
              if (subCategoryGlobal) {
                createdIds.subCategories.set(action.params.name, subCategoryGlobal.id);
                console.log(`🤖 [AIPromptInput] Sous-catégorie "${action.params.name}" trouvée globalement avec ID: ${subCategoryGlobal.id}`);
              } else {
                console.warn(`🤖 [AIPromptInput] Sous-catégorie "${action.params.name}" pas trouvée après création`);
              }
            }
          }
        }
        
      } catch (error) {
        console.error(`🤖 [AIPromptInput] Erreur action ${index + 1}:`, error);
        results.push(`❌ Erreur action ${index + 1}: ${error instanceof Error ? error.message : 'inconnue'}`);
      }
    }
    
    const resultString = results.join('\n');
    console.log('🤖 [AIPromptInput] Résultats des actions:', resultString);
    return resultString;
  };

  // Appeler l'API OpenAI avec l'historique complet
  const callOpenAI = async (userMessage: string, conversationHistory: Message[]): Promise<AIResponse> => {
    // Protection: s'assurer que tous les tableaux existent pour éviter les erreurs .map() sur undefined
    const cockpitContext = {
      cockpitName: currentCockpit?.name,
      currentDomainId,
      currentElementId,
      domains: (currentCockpit?.domains || []).map(d => ({
        id: d.id,
        name: d.name,
        categories: (d.categories || []).map(c => ({
          id: c.id,
          name: c.name,
          elements: (c.elements || []).map(e => ({
            id: e.id,
            name: e.name,
            status: e.status,
            subCategories: (e.subCategories || []).map(sc => ({
              id: sc.id,
              name: sc.name,
                subElements: (sc.subElements || []).map(se => ({
                  id: se.id,
                  name: se.name,
                  status: se.status,
                  sources: se.sources || [],
                  calculations: se.calculations || [],
                }))
            }))
          }))
        }))
      }))
    };
    
    // Construire l'historique des messages pour GPT
    const history = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Construire le message avec le fichier attaché si présent
    let fullMessage = userMessage;
    let hasImage = false;
    let imageBase64 = '';
    let imageMimeType = 'image/png';
    
    if (attachedFile) {
      const fileName = attachedFile.name.toLowerCase();
      hasImage = fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || fileName.endsWith('.webp');
      
      if (hasImage) {
        // Détecter le type MIME à partir de l'extension du fichier
        if (fileName.endsWith('.png')) {
          imageMimeType = 'image/png';
        } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
          imageMimeType = 'image/jpeg';
        } else if (fileName.endsWith('.gif')) {
          imageMimeType = 'image/gif';
        } else if (fileName.endsWith('.webp')) {
          imageMimeType = 'image/webp';
        }
        
        // Extraire le base64 de l'image
        // Le contenu est en format data:image/...;base64,...
        let base64Content = String(attachedFile.content);
        
        console.log('[AIPromptInput] Extraction base64 - Longueur contenu:', base64Content.length);
        console.log('[AIPromptInput] Extraction base64 - Début:', base64Content.substring(0, 100));
        
        // Extraire uniquement la partie base64 (après "base64,")
        let extractedBase64 = '';
        
        if (base64Content.includes('base64,')) {
          const base64Index = base64Content.indexOf('base64,');
          extractedBase64 = base64Content.substring(base64Index + 7); // +7 pour "base64,"
          console.log('[AIPromptInput] Base64 extrait après base64, - Longueur:', extractedBase64.length);
        } else if (base64Content.includes('data:image/') && base64Content.includes(',')) {
          // Format: data:image/...;base64,...
          const commaIndex = base64Content.lastIndexOf(',');
          extractedBase64 = base64Content.substring(commaIndex + 1);
          console.log('[AIPromptInput] Base64 extrait après virgule - Longueur:', extractedBase64.length);
        } else {
          // Si pas de préfixe, c'est peut-être déjà du base64 pur
          extractedBase64 = base64Content;
          console.log('[AIPromptInput] Base64 utilisé tel quel - Longueur:', extractedBase64.length);
        }
        
        // Nettoyer le base64 : enlever espaces, retours à la ligne, etc.
        imageBase64 = extractedBase64.trim().replace(/\s+/g, '').replace(/\n/g, '').replace(/\r/g, '');
        
        console.log('[AIPromptInput] Base64 final nettoyé - Longueur:', imageBase64.length);
        console.log('[AIPromptInput] Base64 final - Début:', imageBase64.substring(0, 50));
        console.log('[AIPromptInput] Base64 valide (regex):', /^[A-Za-z0-9+/=]+$/.test(imageBase64));
        
        // Vérifier que le base64 est valide
        if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
          console.error('[AIPromptInput] Base64 invalide détecté, nettoyage supplémentaire');
          imageBase64 = imageBase64.replace(/[^A-Za-z0-9+/=]/g, '');
        }
        
        // Pour les images, préparer un message qui demande l'OCR
        const fileExtension = attachedFile.name.split('.').pop()?.toUpperCase() || 'IMAGE';
        fullMessage = `[IMAGE ATTACHÉE: ${attachedFile.name} - Format: ${fileExtension}]\n\nAnalyse cette image et fais de l'OCR si elle contient du texte. Extrais toutes les informations pertinentes.\n\nQuestion de l'utilisateur: ${userMessage}`;
      } else {
        // Pour les autres fichiers, utiliser le format texte
        fullMessage = `[FICHIER ATTACHÉ: ${attachedFile.name}]\n\nContenu du fichier:\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\nQuestion de l'utilisateur: ${userMessage}`;
      }
    }
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: fullMessage,
        cockpitContext,
        history, // Envoyer l'historique complet
        hasImage: hasImage && imageBase64 ? true : false, // Indiquer qu'il y a une image
        imageBase64: hasImage && imageBase64 ? imageBase64 : undefined, // Envoyer le base64 de l'image si présent
        imageMimeType: hasImage ? imageMimeType : undefined, // Envoyer le type MIME
      }),
    });
    
    if (!response.ok) {
      let errorMessage = 'Erreur API inconnue';
      try {
        const errorText = await response.text();
        console.error('[AIPromptInput] Erreur API (raw):', errorText);
        
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || error.message || errorText;
        } catch (parseError) {
          // Si ce n'est pas du JSON, utiliser le texte brut
          errorMessage = errorText || `Erreur HTTP ${response.status}`;
        }
      } catch (textError) {
        console.error('[AIPromptInput] Impossible de lire la réponse d\'erreur:', textError);
        errorMessage = `Erreur HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    let result;
    try {
      const responseText = await response.text();
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[AIPromptInput] Erreur parsing réponse:', parseError);
      throw new Error('Réponse serveur invalide (non-JSON). Vérifiez les logs serveur.');
    }
    
    return result;
  };

  // Fallback local (pattern matching basique)
  const parseLocalCommand = (userPrompt: string): string => {
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Ajouter un domaine - protection pour les tableaux
    if (lowerPrompt.includes('ajoute') && lowerPrompt.includes('domaine')) {
      const match = userPrompt.match(/domaine\s+[«"']?([^»"']+)[»"']?/i);
      if (match) {
        const name = match[1].trim().replace(/[«»"']/g, '');
        if (currentCockpit && (currentCockpit.domains || []).length < 6) {
          addDomain(name.toUpperCase());
          return `✅ Domaine "${name.toUpperCase()}" ajouté !`;
        }
        return `❌ Maximum 6 domaines atteint.`;
      }
    }
    
    // Ajouter une catégorie
    if (lowerPrompt.includes('ajoute') && lowerPrompt.includes('catégorie')) {
      const match = userPrompt.match(/catégorie\s+[«"']?([^»"']+)[»"']?/i);
      if (match && currentDomainId) {
        const name = match[1].trim().replace(/[«»"']/g, '');
        const orientation = lowerPrompt.includes('vertical') ? 'vertical' : 'horizontal';
        addCategory(currentDomainId, name, orientation);
        return `✅ Catégorie "${name}" ajoutée !`;
      }
      return `❌ Sélectionnez d'abord un domaine.`;
    }
    
    // Changer statut
    if (lowerPrompt.includes('statut') || lowerPrompt.includes('couleur')) {
      let status: TileStatus | null = null;
      if (lowerPrompt.includes('fatal') || lowerPrompt.includes('violet')) status = 'fatal';
      else if (lowerPrompt.includes('critique') || lowerPrompt.includes('rouge')) status = 'critique';
      else if (lowerPrompt.includes('mineur') || lowerPrompt.includes('orange')) status = 'mineur';
      else if (lowerPrompt.includes('ok') || lowerPrompt.includes('vert')) status = 'ok';
      else if (lowerPrompt.includes('déconnecté') || lowerPrompt.includes('gris')) status = 'deconnecte';
      
      if (status && currentElementId) {
        updateElement(currentElementId, { status });
        return `✅ Statut changé en "${status}" !`;
      }
    }
    
    return `💡 Mode local: Commande non reconnue. L'IA complète nécessite une clé API OpenAI.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    
    const userPrompt = prompt.trim();
    setPrompt('');
    addMessage('user', userPrompt);
    setIsLoading(true);
    
    try {
      if (aiStatus?.configured) {
        // Utiliser l'API OpenAI avec l'historique
        const result = await callOpenAI(userPrompt, messages);
        
        // Exécuter les actions si présentes
        let actionResult = '';
        console.log('🤖 [AIPromptInput] Réponse API:', result);
        if (result.actions && Array.isArray(result.actions) && result.actions.length > 0) {
          console.log(`🤖 [AIPromptInput] ${result.actions.length} action(s) détectée(s) dans la réponse`);
          actionResult = '\n\n' + executeActions(result.actions);
        } else {
          console.log('🤖 [AIPromptInput] Aucune action dans la réponse API');
        }
        
        addMessage('assistant', result.message + actionResult);
        // Reset le fichier attaché après utilisation
        setAttachedFile(null);
      } else {
        // Fallback local
        await new Promise(resolve => setTimeout(resolve, 300));
        const response = parseLocalCommand(userPrompt);
        addMessage('assistant', response);
      }
    } catch (error) {
      console.error('[AIPromptInput] Erreur complète:', error);
      let errorMessage = 'Erreur inconnue';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Si le message contient "Unexpected token", c'est une erreur de parsing JSON
        if (errorMessage.includes('Unexpected token') || errorMessage.includes('is not valid JSON')) {
          errorMessage = 'Erreur: Réponse serveur invalide. Vérifiez que l\'API OpenAI est correctement configurée et que l\'image est valide.';
        }
      }
      
      addMessage('assistant', `❌ Erreur: ${errorMessage}`);
    }
    
    setIsLoading(false);
    
    // Remettre le focus sur le champ de saisie après la réponse
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all shadow-lg ${
          aiStatus?.configured 
            ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-purple-500/25'
            : 'bg-slate-600 hover:bg-slate-500'
        }`}
        title={aiStatus?.configured ? 'Assistant IA OpenAI' : 'Assistant IA (mode local)'}
      >
        <MuiIcon name="AutoAwesome" size={16} />
        <span className="font-medium">IA</span>
        {aiStatus?.configured && <span className="text-xs opacity-75">GPT</span>}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Panneau de chat */}
      <div 
        ref={windowRef}
        className="fixed bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {/* Header - zone de drag */}
        <div 
          onMouseDown={handleMouseDown}
          className={`flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none ${
            aiStatus?.configured 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600'
              : 'bg-slate-700'
          }`}>
          <div className="flex items-center gap-2">
            <MuiIcon name="AutoAwesome" size={20} className="text-white" />
            <span className="font-semibold text-white">Assistant IA</span>
            {aiStatus?.configured && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                {aiStatus.model}
              </span>
            )}
            {!aiStatus?.configured && (
              <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded-full text-yellow-200">
                Mode local
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMessages([])}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors text-xs"
            >
              Effacer
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <MuiIcon name="X" size={16} />
            </button>
          </div>
        </div>
        
        {/* Avertissement si pas configuré */}
        {!aiStatus?.configured && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
            <p className="text-xs text-yellow-300">
              ⚠️ Pour activer l'IA complète, ajoutez <code className="bg-black/30 px-1 rounded">OPENAI_API_KEY</code> à vos variables d'environnement.
            </p>
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              <div className="mx-auto mb-3"><MuiIcon name="AutoAwesome" size={32} className="text-slate-600" /></div>
              <p>Demandez-moi de modifier votre maquette !</p>
              <p className="mt-2 text-xs">
                {aiStatus?.configured 
                  ? 'Ex: "Crée un domaine EXPLOITATION avec 3 catégories"'
                  : 'Ex: "Ajoute le domaine EXPLOITATION"'
                }
              </p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 px-4 py-2 rounded-xl flex items-center gap-2">
                <div className="animate-spin"><MuiIcon name="Refresh" size={16} className="text-slate-400" /></div>
                <span className="text-xs text-slate-400">
                  {aiStatus?.configured ? 'GPT réfléchit...' : 'Traitement...'}
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Fichier attaché */}
        {attachedFile && (
          <div className="px-3 py-2 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2 text-sm">
              <MuiIcon 
                name={attachedFile.name.toLowerCase().endsWith('.pdf') ? 'PictureAsPdf' : 'TableChart'} 
                size={16} 
                className={attachedFile.name.toLowerCase().endsWith('.pdf') ? 'text-red-400' : 'text-blue-400'} 
              />
              <span className="text-slate-300 flex-1 truncate">{attachedFile.name}</span>
              <span className="text-xs text-slate-500">
                {attachedFile.content.length > 1024 * 1024 
                  ? `${(attachedFile.content.length / 1024 / 1024).toFixed(2)} MB`
                  : `${(attachedFile.content.length / 1024).toFixed(1)} KB`
                }
              </span>
              <button
                onClick={removeAttachedFile}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Retirer le fichier"
              >
                <MuiIcon name="X" size={14} />
              </button>
            </div>
          </div>
        )}
        
        {/* Zone de redimensionnement */}
        <div 
          onMouseDown={handleResizeStart}
          className="h-2 cursor-nwse-resize bg-slate-700 hover:bg-slate-500 transition-colors flex-shrink-0 relative group"
          title="Redimensionner la fenêtre"
        >
          <div className="absolute right-2 bottom-0 w-3 h-3 border-r-2 border-b-2 border-slate-500 group-hover:border-slate-300 transition-colors" />
        </div>
        
        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Bouton upload fichier */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".txt,.csv,.json,.md,.xml,.xlsx,.xls,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
              title="Attacher un fichier (PDF, Excel, Word, PowerPoint, Images, CSV, JSON, TXT...)"
            >
              <MuiIcon name="Add" size={16} />
            </button>
            
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={attachedFile ? "Question sur le fichier..." : (aiStatus?.configured ? "Demandez n'importe quoi..." : "Tapez une commande...")}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 placeholder-slate-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <MuiIcon name="Send" size={16} />
            </button>
          </div>
        </form>
      </div>
      
      {/* Bouton quand ouvert */}
      <button
        onClick={() => setIsExpanded(false)}
        className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${
          aiStatus?.configured 
            ? 'bg-gradient-to-r from-violet-600 to-purple-600'
            : 'bg-slate-600'
        }`}
      >
        <MuiIcon name="AutoAwesome" size={16} />
        <span className="font-medium">IA</span>
        <MuiIcon name="KeyboardArrowUp" size={16} />
      </button>
    </div>
  );
}
