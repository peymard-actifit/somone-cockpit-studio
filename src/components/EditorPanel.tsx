import { useState, useEffect } from 'react';
import type { Domain, Element, SubElement, TileStatus, TemplateType, Alert, MapBounds } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import IconPicker, { MuiIcon } from './IconPicker';
import { useConfirm } from '../contexts/ConfirmContext';
import ElementTile from './ElementTile';
import SourcesAndCalculationsPanel from './subelements/SourcesAndCalculationsPanel';

interface EditorPanelProps {
  domain: Domain | undefined;
  element: Element | null;
  onSelectSubElement?: (subElementId: string) => void; // Callback pour sélectionner un sous-élément
  selectedSubElementId?: string | null; // ID du sous-élément à sélectionner depuis l'extérieur
}

export default function EditorPanel({ domain, element, selectedSubElementId }: EditorPanelProps) {
  const { 
    updateDomain,
    deleteDomain,
    updateCategory,
    updateSubCategory,
    updateElement,
    deleteElement,
    updateSubElement,
    deleteSubElement,
    updateCockpit,
    currentCockpit,
    zones,
    addZone,
    deleteZone,
    setCurrentElement,
    updateMapElement,
    deleteMapElement,
    cloneMapElement,
    updateMapBounds
  } = useCockpitStore();
  const { token } = useAuthStore();
  const confirm = useConfirm();
  
  const [activeSection, setActiveSection] = useState<string | null>('properties');
  const [newZoneName, setNewZoneName] = useState('');
  const [selectedSubElement, setSelectedSubElement] = useState<SubElement | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<'icon' | 'icon2' | 'icon3' | 'category' | null>(null);
  
  // États pour la configuration de l'image de fond (MapView et BackgroundView)
  const [imageUrl, setImageUrl] = useState(domain?.backgroundImage || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    detected: boolean;
    region?: string;
    confidence?: string;
    description?: string;
  } | null>(null);
  const [gpsForm, setGpsForm] = useState({
    topLeftLat: domain?.mapBounds?.topLeft.lat?.toString() || '',
    topLeftLng: domain?.mapBounds?.topLeft.lng?.toString() || '',
    bottomRightLat: domain?.mapBounds?.bottomRight.lat?.toString() || '',
    bottomRightLng: domain?.mapBounds?.bottomRight.lng?.toString() || '',
  });
  
  // Mettre à jour les états quand le domaine change
  useEffect(() => {
    if (domain) {
      setImageUrl(domain.backgroundImage || '');
      setGpsForm({
        topLeftLat: domain.mapBounds?.topLeft.lat?.toString() || '',
        topLeftLng: domain.mapBounds?.topLeft.lng?.toString() || '',
        bottomRightLat: domain.mapBounds?.bottomRight.lat?.toString() || '',
        bottomRightLng: domain.mapBounds?.bottomRight.lng?.toString() || '',
      });
    }
  }, [domain?.id, domain?.backgroundImage, domain?.mapBounds]);
  
  // Fonction de validation d'image base64
  
  // Analyser l'image avec l'IA pour détecter les coordonnées GPS (MapView uniquement)
  const analyzeMapImage = async () => {
    if (!domain || !imageUrl) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      const isBase64 = imageUrl.startsWith('data:');
      
      const response = await fetch('/api/ai/analyze-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(
          isBase64 
            ? { imageBase64: imageUrl }
            : { imageUrl: imageUrl }
        ),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'analyse');
      }
      
      if (result.detected && result.topLeft && result.bottomRight) {
        setGpsForm({
          topLeftLat: result.topLeft.lat.toString(),
          topLeftLng: result.topLeft.lng.toString(),
          bottomRightLat: result.bottomRight.lat.toString(),
          bottomRightLng: result.bottomRight.lng.toString(),
        });
        
        const bounds: MapBounds = {
          topLeft: { lat: result.topLeft.lat, lng: result.topLeft.lng },
          bottomRight: { lat: result.bottomRight.lat, lng: result.bottomRight.lng },
        };
        updateMapBounds(domain.id, bounds);
        
        setAnalysisResult({
          detected: true,
          region: result.region,
          confidence: result.confidence,
          description: `${result.description} — Coordonnées enregistrées automatiquement.`,
        });
      } else {
        setAnalysisResult({
          detected: false,
          description: result.reason || 'Zone géographique non reconnue',
        });
      }
    } catch (error: any) {
      console.error('Erreur analyse carte:', error);
      setAnalysisResult({
        detected: false,
        description: error.message || 'Erreur lors de l\'analyse de l\'image',
      });
    }
    
    setIsAnalyzing(false);
  };
  
  // Sauvegarder les coordonnées GPS
  const saveGpsBounds = () => {
    if (!domain) return;
    
    const lat1 = parseFloat(gpsForm.topLeftLat);
    const lng1 = parseFloat(gpsForm.topLeftLng);
    const lat2 = parseFloat(gpsForm.bottomRightLat);
    const lng2 = parseFloat(gpsForm.bottomRightLng);
    
    if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
      const bounds: MapBounds = {
        topLeft: { lat: lat1, lng: lng1 },
        bottomRight: { lat: lat2, lng: lng2 },
      };
      updateMapBounds(domain.id, bounds);
    }
  };
  
  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  // Trouver tous les sous-éléments de l'élément courant
  const allSubElements: SubElement[] = element?.subCategories?.flatMap(sc => sc.subElements) || [];
  
  // Ouvrir automatiquement la section "Statut (couleur)" quand on sélectionne un sous-élément
  useEffect(() => {
    if (selectedSubElement && activeSection !== 'status') {
      setActiveSection('status');
    }
  }, [selectedSubElement]);
  
  // Sélectionner automatiquement un sous-élément depuis l'extérieur (depuis un clic dans ElementView)
  useEffect(() => {
    if (selectedSubElementId && element) {
      // Trouver le sous-élément dans l'élément courant
      for (const subCategory of element.subCategories) {
        const foundSubElement = subCategory.subElements.find(se => se.id === selectedSubElementId);
        if (foundSubElement) {
          setSelectedSubElement(foundSubElement);
          setActiveSection('status'); // Ouvrir automatiquement la section statut
          break;
        }
      }
    }
  }, [selectedSubElementId, element]);
  
  // Édition d'un sous-élément
  if (selectedSubElement) {
    // Ouvrir automatiquement la section "Statut (couleur)" pour les sous-éléments
    const subElementActiveSection = activeSection || 'status';
    
    return (
      <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <div className="flex items-start justify-between">
            <div>
          <button
            onClick={() => {
              setSelectedSubElement(null);
              setActiveSection(null);
            }}
            className="flex items-center gap-2 text-[#64748B] hover:text-[#1E3A5F] mb-2"
          >
            <div className="rotate-180"><MuiIcon name="ChevronRightIcon" size={16} /></div>
            Retour
          </button>
          <h3 className="text-lg font-semibold text-[#1E3A5F]">Édition sous-élément</h3>
          <p className="text-sm text-[#64748B]">{selectedSubElement.name}</p>
            </div>
            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Supprimer le sous-élément',
                  message: `Voulez-vous supprimer le sous-élément "${selectedSubElement.name}" ?`,
                });
                if (confirmed) {
                  deleteSubElement(selectedSubElement.id);
                  setSelectedSubElement(null);
                }
              }}
              className="p-2 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer ce sous-élément"
            >
              <MuiIcon name="Trash2" size={18} />
            </button>
          </div>
        </div>
        
        {/* Propriétés du sous-élément */}
        <Section 
          title="Propriétés" 
          iconName="SettingsIcon" 
          isOpen={activeSection === 'properties'}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom</label>
              <input
                type="text"
                value={selectedSubElement.name}
                onChange={(e) => {
                  updateSubElement(selectedSubElement.id, { name: e.target.value });
                  setSelectedSubElement({ ...selectedSubElement, name: e.target.value });
                }}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Valeur</label>
                <input
                  type="text"
                  value={selectedSubElement.value || ''}
                  onChange={(e) => {
                    updateSubElement(selectedSubElement.id, { value: e.target.value });
                    setSelectedSubElement({ ...selectedSubElement, value: e.target.value });
                  }}
                  placeholder="123"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Unité</label>
                <input
                  type="text"
                  value={selectedSubElement.unit || ''}
                  onChange={(e) => {
                    updateSubElement(selectedSubElement.id, { unit: e.target.value });
                    setSelectedSubElement({ ...selectedSubElement, unit: e.target.value });
                  }}
                  placeholder="kg"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>
          </div>
        </Section>
        
        {/* Statut / Couleur du sous-élément */}
        <Section 
          title="Statut (couleur)" 
          iconName="Palette" 
          isOpen={subElementActiveSection === 'status'}
          onToggle={() => toggleSection('status')}
        >
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(STATUS_COLORS) as TileStatus[]).filter(status => status !== 'herite').map((status) => (
              <button
                key={status}
                onClick={() => {
                  updateSubElement(selectedSubElement.id, { status });
                  setSelectedSubElement({ ...selectedSubElement, status });
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  selectedSubElement.status === status 
                    ? `${STATUS_COLORS[status].bg} text-white` 
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                }`}
              >
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: STATUS_COLORS[status].hex }}
                />
                <span>{STATUS_LABELS[status]}</span>
              </button>
            ))}
          </div>
        </Section>
        
        {/* Alerte (uniquement si Fatal, Critique ou Mineur) */}
        {['fatal', 'critique', 'mineur'].includes(selectedSubElement.status) && (
          <Section 
            title="Alerte" 
            iconName="AlertTriangleIcon" 
            isOpen={activeSection === 'alert'}
            onToggle={() => toggleSection('alert')}
          >
            <div className="space-y-4">
              <p className="text-xs text-[#94A3B8]">
                Cette alerte s'affichera quand l'utilisateur clique sur le sous-élément.
              </p>
              
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Description de l'alerte</label>
                <textarea
                  value={selectedSubElement.alert?.description || ''}
                  onChange={(e) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: e.target.value,
                      duration: selectedSubElement.alert?.duration,
                      ticketNumber: selectedSubElement.alert?.ticketNumber,
                      actions: selectedSubElement.alert?.actions,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="Description du problème..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Durée</label>
                <input
                  type="text"
                  value={selectedSubElement.alert?.duration || ''}
                  onChange={(e) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: selectedSubElement.alert?.description || '',
                      duration: e.target.value,
                      ticketNumber: selectedSubElement.alert?.ticketNumber,
                      actions: selectedSubElement.alert?.actions,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="ex: 2h 30m"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Numéro de ticket</label>
                <input
                  type="text"
                  value={selectedSubElement.alert?.ticketNumber || ''}
                  onChange={(e) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: selectedSubElement.alert?.description || '',
                      duration: selectedSubElement.alert?.duration,
                      ticketNumber: e.target.value,
                      actions: selectedSubElement.alert?.actions,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="ex: TKT-12345"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Actions suggérées</label>
                <textarea
                  value={selectedSubElement.alert?.actions || ''}
                  onChange={(e) => {
                    const newAlert: Alert = {
                      id: selectedSubElement.alert?.id || crypto.randomUUID(),
                      subElementId: selectedSubElement.id,
                      date: selectedSubElement.alert?.date || new Date().toISOString(),
                      description: selectedSubElement.alert?.description || '',
                      duration: selectedSubElement.alert?.duration,
                      ticketNumber: selectedSubElement.alert?.ticketNumber,
                      actions: e.target.value,
                    };
                    updateSubElement(selectedSubElement.id, { alert: newAlert });
                    setSelectedSubElement({ ...selectedSubElement, alert: newAlert });
                  }}
                  placeholder="Actions à entreprendre..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
                />
              </div>
              
              {selectedSubElement.alert?.description && (
                <button
                  onClick={() => {
                    updateSubElement(selectedSubElement.id, { alert: undefined });
                    setSelectedSubElement({ ...selectedSubElement, alert: undefined });
                  }}
                  className="w-full px-3 py-2 text-[#E57373] hover:bg-red-50 rounded-lg text-sm transition-colors border border-[#E57373]/30"
                >
                  Supprimer l'alerte
                </button>
              )}
            </div>
          </Section>
        )}
        
        {/* Sources et calculs */}
        <Section 
          title="Sources et calculs" 
          iconName="Database" 
          isOpen={activeSection === 'sources-calculations'}
          onToggle={() => toggleSection('sources-calculations')}
        >
          <SourcesAndCalculationsPanel
            subElement={selectedSubElement}
            onUpdate={(updates) => {
              updateSubElement(selectedSubElement.id, updates);
              setSelectedSubElement({ ...selectedSubElement, ...updates });
            }}
          />
        </Section>
      </div>
    );
  }
  
  // Édition d'un élément
  if (element) {
    return (
      <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <div className="flex items-start justify-between">
            <div>
          <h3 className="text-lg font-semibold text-[#1E3A5F]">Édition élément</h3>
          <p className="text-sm text-[#64748B]">{element.name}</p>
            </div>
            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Supprimer l\'élément',
                  message: `Voulez-vous supprimer l'élément "${element.name}" et tous ses sous-éléments ?`,
                });
                if (confirmed) {
                  deleteElement(element.id);
                  setCurrentElement(null);
                }
              }}
              className="p-2 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer cet élément"
            >
              <MuiIcon name="Trash2" size={18} />
            </button>
          </div>
        </div>
        
        {/* Prévisualisation de l'élément */}
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <h4 className="text-sm font-medium text-[#64748B] mb-3">Aperçu</h4>
          <div className="flex justify-center">
            <ElementTile 
              element={element} 
              mini={false}
              readOnly={true}
            />
          </div>
        </div>
        
        {/* Propriétés */}
        <Section 
          title="Propriétés" 
          iconName="SettingsIcon" 
          isOpen={activeSection === 'properties'}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom</label>
              <input
                type="text"
                value={element.name}
                onChange={(e) => updateElement(element.id, { name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Valeur</label>
                <input
                  type="text"
                  value={element.value || ''}
                  onChange={(e) => updateElement(element.id, { value: e.target.value })}
                  placeholder="123"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Unité</label>
                <input
                  type="text"
                  value={element.unit || ''}
                  onChange={(e) => updateElement(element.id, { unit: e.target.value })}
                  placeholder="kg"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>
            
            {/* Icônes - Sélection via Material Icons */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Icône principale</label>
              <button
                onClick={() => setShowIconPicker('icon')}
                className="w-full flex items-center gap-3 px-3 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
              >
                {element.icon ? (
                  <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                    <MuiIcon name={element.icon} size={20} className="text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-[#E2E8F0] rounded-lg flex items-center justify-center">
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  </div>
                )}
                <span className="text-sm">{element.icon || 'Choisir une icône...'}</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-2">Icône 2</label>
                <button
                  onClick={() => setShowIconPicker('icon2')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
                >
                  {element.icon2 ? (
                    <MuiIcon name={element.icon2} size={18} className="text-[#1E3A5F]" />
                  ) : (
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  )}
                  <span className="text-xs truncate">{element.icon2 || 'Choisir...'}</span>
                </button>
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-2">Icône 3</label>
                <button
                  onClick={() => setShowIconPicker('icon3')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
                >
                  {element.icon3 ? (
                    <MuiIcon name={element.icon3} size={18} className="text-[#1E3A5F]" />
                  ) : (
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  )}
                  <span className="text-xs truncate">{element.icon3 || 'Choisir...'}</span>
                </button>
              </div>
            </div>
            
            {/* Sélecteur d'icônes */}
            {showIconPicker === 'icon' && (
              <IconPicker
                value={element.icon}
                onChange={(iconName) => updateElement(element.id, { icon: iconName })}
                onClose={() => setShowIconPicker(null)}
              />
            )}
            {showIconPicker === 'icon2' && (
              <IconPicker
                value={element.icon2}
                onChange={(iconName) => updateElement(element.id, { icon2: iconName })}
                onClose={() => setShowIconPicker(null)}
              />
            )}
            {showIconPicker === 'icon3' && (
              <IconPicker
                value={element.icon3}
                onChange={(iconName) => updateElement(element.id, { icon3: iconName })}
                onClose={() => setShowIconPicker(null)}
              />
            )}
          </div>
        </Section>
        
        {/* Image de fond pour l'élément */}
        <Section 
          title="Image de fond" 
          iconName="Image" 
          isOpen={activeSection === 'element-background'}
          onToggle={() => toggleSection('element-background')}
        >
          <div className="space-y-4">
            {/* Zone de sélection de fichier */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Charger une image</label>
              <label 
                htmlFor={`element-bg-upload-${element.id}`}
                className="block p-4 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors cursor-pointer"
              >
                <input
                  type="file"
                  accept="image/*"
                  id={`element-bg-upload-${element.id}`}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const maxSizeMB = 30;
                      const maxSizeBytes = maxSizeMB * 1024 * 1024;
                      if (file.size > maxSizeBytes) {
                        alert(`Erreur: Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). La taille maximale autorisée est de ${maxSizeMB} MB.`);
                        e.target.value = '';
                        return;
                      }
                      
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        updateElement(element.id, { backgroundImage: base64 });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                  <MuiIcon name="Upload" size={24} className="mb-2" />
                  <span className="text-xs font-medium">Cliquez pour choisir un fichier</span>
                  <span className="text-[10px] text-[#94A3B8] mt-1">PNG, JPG, GIF jusqu'à 30MB</span>
                </div>
              </label>
            </div>
            
            {/* Séparateur */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-xs text-[#94A3B8]">ou</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>
            
            {/* URL alternative */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">URL de l'image</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={element.backgroundImage && !element.backgroundImage.startsWith('data:') ? element.backgroundImage : ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    if (url.trim()) {
                      updateElement(element.id, { backgroundImage: url.trim() });
                    }
                  }}
                  placeholder="https://exemple.com/image.png"
                  className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              {element.backgroundImage && !element.backgroundImage.startsWith('data:') && (
                <button
                  onClick={() => {
                    if (element.backgroundImage) {
                      updateElement(element.id, { backgroundImage: element.backgroundImage });
                    }
                  }}
                  className="mt-2 w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] text-sm"
                >
                  Enregistrer l'URL
                </button>
              )}
            </div>
            
            {/* Aperçu et options */}
            {element.backgroundImage && (
              <div className="space-y-3">
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                  <img 
                    src={element.backgroundImage} 
                    alt="Aperçu" 
                    className="max-h-32 rounded border border-[#E2E8F0] mx-auto w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {element.backgroundImage.startsWith('data:') && (
                    <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                      <MuiIcon name="CheckCircle" size={12} />
                      Fichier chargé
                    </p>
                  )}
                </div>
                
                {/* Opacité de l'image */}
                <div>
                  <label className="block text-sm text-[#64748B] mb-2">
                    Opacité de l'image ({element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}
                    onChange={(e) => updateElement(element.id, { backgroundImageOpacity: Number(e.target.value) })}
                    className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #1E3A5F 0%, #1E3A5F ${element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}%, #E2E8F0 ${element.backgroundImageOpacity !== undefined ? element.backgroundImageOpacity : 100}%, #E2E8F0 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-[#64748B] mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
                
                {/* Mode d'affichage */}
                <div>
                  <p className="text-xs text-[#64748B] mb-2">Position de l'image</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateElement(element.id, { backgroundMode: 'behind' })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        (!element.backgroundMode || element.backgroundMode === 'behind')
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                      }`}
                    >
                      En dessous
                    </button>
                    <button
                      onClick={() => updateElement(element.id, { backgroundMode: 'overlay' })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        element.backgroundMode === 'overlay'
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                      }`}
                    >
                      Au dessus
                    </button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">
                    {(!element.backgroundMode || element.backgroundMode === 'behind') 
                      ? 'L\'image sera derrière les sous-catégories' 
                      : 'L\'image sera par-dessus (transparente, sans gêner les clics)'}
                  </p>
                </div>
                
                <button
                  onClick={() => updateElement(element.id, { backgroundImage: undefined, backgroundMode: undefined, backgroundImageOpacity: undefined })}
                  className="w-full px-3 py-1.5 text-xs text-[#E57373] hover:bg-red-50 rounded-lg border border-[#E57373]/30 transition-colors flex items-center justify-center gap-1"
                >
                  <MuiIcon name="Delete" size={12} />
                  Supprimer l'image
                </button>
              </div>
            )}
          </div>
        </Section>
        
        {/* Couleur / Statut */}
        <Section 
          title="Statut (couleur)" 
          iconName="Palette" 
          isOpen={activeSection === 'status'}
          onToggle={() => toggleSection('status')}
        >
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(STATUS_COLORS) as TileStatus[]).filter(status => status !== 'herite' || element.subCategories.length > 0).map((status) => (
              <button
                key={status}
                onClick={() => updateElement(element.id, { status })}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  element.status === status 
                    ? `${STATUS_COLORS[status].bg} text-white` 
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                }`}
              >
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: STATUS_COLORS[status].hex }}
                />
                <span>{STATUS_LABELS[status]}</span>
              </button>
            ))}
          </div>
        </Section>
        
        {/* Édition des sous-catégories */}
        {element.subCategories && element.subCategories.length > 0 && (
          <Section 
            title={`Sous-catégories (${element.subCategories.length})`}
            iconName="FolderOpen" 
            isOpen={activeSection === 'subcategories'}
            onToggle={() => toggleSection('subcategories')}
          >
            <div className="space-y-2">
              {element.subCategories.map((subCategory) => (
                <div key={subCategory.id} className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <input
                    type="text"
                    value={subCategory.name}
                    onChange={(e) => updateSubCategory(subCategory.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-[#E2E8F0] rounded text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <span className="text-xs text-[#94A3B8]">
                    {subCategory.subElements.length} sous-élément{subCategory.subElements.length > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
        
        {/* Liste des sous-éléments à éditer */}
        {allSubElements.length > 0 && (
          <Section 
            title={`Sous-éléments (${allSubElements.length})`}
            iconName="Label" 
            isOpen={activeSection === 'subelements'}
            onToggle={() => toggleSection('subelements')}
          >
            <div className="space-y-2">
              <p className="text-xs text-[#94A3B8] mb-3">
                Cliquez sur un sous-élément pour modifier son statut et son alerte.
              </p>
              {allSubElements.map((se) => (
                <button
                  key={se.id}
                  onClick={() => setSelectedSubElement(se)}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-[#F5F7FA] hover:bg-[#EEF2F7] rounded-lg transition-colors text-left border border-[#E2E8F0]"
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: STATUS_COLORS[se.status].hex }}
                  />
                  <span className="text-sm text-[#1E3A5F] truncate flex-1">{se.name}</span>
                  {se.alert && (
                    <MuiIcon name="AlertTriangleIcon" size={16} className="text-[#FFB74D] flex-shrink-0" />
                  )}
                  <MuiIcon name="ChevronRightIcon" size={16} className="text-[#94A3B8] flex-shrink-0" />
                </button>
              ))}
            </div>
          </Section>
        )}
        
        {/* Propriétés de position (pour BackgroundView/MapView) */}
        {element.positionX !== undefined && element.positionY !== undefined && (
          <Section 
            title="Position et taille" 
            iconName="Move" 
            isOpen={activeSection === 'position'}
            onToggle={() => toggleSection('position')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#64748B] mb-1">Largeur (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={element.width || 5}
                    onChange={(e) => {
                      const newWidth = parseFloat(e.target.value) || 1;
                      const oldWidth = element.width || 5;
                      const oldCenterX = (element.positionX || 0) + oldWidth / 2;
                      const newX = oldCenterX - newWidth / 2;
                      updateElement(element.id, { 
                        width: newWidth,
                        positionX: Math.max(0, newX)
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#64748B] mb-1">Hauteur (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={element.height || 5}
                    onChange={(e) => {
                      const newHeight = parseFloat(e.target.value) || 1;
                      const oldHeight = element.height || 5;
                      const oldCenterY = (element.positionY || 0) + oldHeight / 2;
                      const newY = oldCenterY - newHeight / 2;
                      updateElement(element.id, { 
                        height: newHeight,
                        positionY: Math.max(0, newY)
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-[#64748B] mb-2">
                  Icône pour rectangle
                  <span className="text-xs text-[#94A3B8] ml-2">Icône colorée ou rectangle</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] max-h-32 overflow-y-auto">
                  <button
                    onClick={() => updateElement(element.id, { icon: '' })}
                    className={`p-2 rounded-lg border transition-all ${
                      !element.icon
                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                        : 'border-transparent hover:bg-white'
                    }`}
                    title="Aucune icône (rectangle)"
                  >
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: STATUS_COLORS[element.status].hex }} />
                  </button>
                  {[
                    'Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Building2',
                    'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart', 'Users',
                    'Server', 'Database', 'Wifi', 'Radio', 'Cpu', 'HardDrive',
                    'AlertTriangle', 'Shield', 'Lock', 'Key', 'Eye', 'Camera',
                    'Zap', 'Activity', 'Thermometer', 'Droplet', 'Wind', 'Sun',
                  ].map((iconName) => (
                    <button
                      key={iconName}
                      onClick={() => updateElement(element.id, { icon: iconName })}
                      className={`p-2 rounded-lg border transition-all ${
                        element.icon === iconName
                          ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                          : 'border-transparent hover:bg-white'
                      }`}
                      title={iconName}
                      style={{ color: STATUS_COLORS[element.status].hex }}
                    >
                      <MuiIcon name={iconName} size={24} />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#94A3B8] mt-2">
                  Le centre reste fixe lors du redimensionnement
                </p>
              </div>
            </div>
          </Section>
        )}
        
        {/* Point de carte GPS (si l'élément est lié à un MapElement) */}
        {domain && element && (() => {
          const mapElement = domain.mapElements?.find(me => me.elementId === element.id);
          return mapElement ? (
            <Section 
              title="Point de carte (GPS)" 
              iconName="MapPinIcon" 
              isOpen={activeSection === 'gps'}
              onToggle={() => toggleSection('gps')}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#64748B] mb-1">Nom du point</label>
                  <input
                    type="text"
                    value={mapElement.name}
                    onChange={(e) => updateMapElement(mapElement.id, { name: e.target.value.trim() })}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[#64748B] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={mapElement.gps.lat}
                      onChange={(e) => {
                        const lat = parseFloat(e.target.value);
                        if (!isNaN(lat)) {
                          updateMapElement(mapElement.id, { gps: { ...mapElement.gps, lat } });
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                      placeholder="ex: 48.8566"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#64748B] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={mapElement.gps.lng}
                      onChange={(e) => {
                        const lng = parseFloat(e.target.value);
                        if (!isNaN(lng)) {
                          updateMapElement(mapElement.id, { gps: { ...mapElement.gps, lng } });
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                      placeholder="ex: 2.3522"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-[#64748B] mb-2">Statut</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ok', 'mineur', 'critique', 'fatal', 'deconnecte', 'information'] as TileStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateMapElement(mapElement.id, { status })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                          mapElement.status === status 
                            ? `${STATUS_COLORS[status].bg} text-white` 
                            : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                        }`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: STATUS_COLORS[status].hex }}
                        />
                        <span className="text-sm">{STATUS_LABELS[status]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-[#64748B] mb-2">Icône du point</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] max-h-32 overflow-y-auto">
                    {[
                      'Store', 'Building', 'Factory', 'Warehouse', 'Home', 'Building2',
                      'MapPin', 'Navigation', 'Truck', 'Package', 'ShoppingCart', 'Users',
                      'Server', 'Database', 'Wifi', 'Radio', 'Cpu', 'HardDrive',
                      'AlertTriangle', 'Shield', 'Lock', 'Key', 'Eye', 'Camera',
                      'Zap', 'Activity', 'Thermometer', 'Droplet', 'Wind', 'Sun',
                    ].map((iconName) => (
                      <button
                        key={iconName}
                        onClick={() => updateMapElement(mapElement.id, { icon: iconName })}
                        className={`p-2 rounded-lg border transition-all ${
                          mapElement.icon === iconName
                            ? 'border-[#1E3A5F] bg-[#1E3A5F]/10'
                            : 'border-transparent hover:bg-white'
                        }`}
                        title={iconName}
                        style={{ color: STATUS_COLORS[mapElement.status].hex }}
                      >
                        <MuiIcon name={iconName} size={24} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Supprimer le point de carte',
                        message: `Voulez-vous supprimer le point "${mapElement.name}" de la carte ?`,
                      });
                      if (confirmed) {
                        deleteMapElement(mapElement.id);
                      }
                    }}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <MuiIcon name="Trash2" size={16} />
                    <span>Supprimer le point</span>
                  </button>
                  <button
                    onClick={() => cloneMapElement(mapElement.id)}
                    className="px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] flex items-center gap-2 text-sm"
                  >
                    <MuiIcon name="CopyIcon" size={16} />
                    <span>Cloner le point</span>
                  </button>
                </div>
              </div>
            </Section>
          ) : null;
        })()}
        
        {/* Zone */}
        <Section 
          title="Zone" 
          iconName="MapPinIcon" 
          isOpen={activeSection === 'zone'}
          onToggle={() => toggleSection('zone')}
        >
          <div className="space-y-3">
            <select
              value={element.zone || ''}
              onChange={(e) => updateElement(element.id, { zone: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="">Aucune zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>{zone.name}</option>
              ))}
            </select>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nouvelle zone"
                className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                onClick={() => {
                  if (newZoneName.trim()) {
                    addZone(newZoneName.trim());
                    setNewZoneName('');
                  }
                }}
                className="px-3 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white rounded-lg text-sm"
              >
                +
              </button>
            </div>
            
            {zones.length > 0 && (
              <div className="border-t border-[#E2E8F0] pt-3 mt-3">
                <p className="text-xs text-[#94A3B8] mb-2">Zones existantes</p>
                <div className="space-y-1">
                  {zones.map((zone) => (
                    <div key={zone.id} className="flex items-center justify-between px-2 py-1 bg-[#F5F7FA] rounded border border-[#E2E8F0]">
                      <span className="text-sm text-[#1E3A5F]">{zone.name}</span>
                      <button
                        onClick={() => deleteZone(zone.id)}
                        className="p-1 text-[#94A3B8] hover:text-[#E57373]"
                      >
                        <MuiIcon name="Trash2" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>
    );
  }
  
  // Édition d'un domaine
  if (domain) {
    return (
      <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F5F7FA]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Édition domaine</h3>
              <p className="text-sm text-[#64748B]">{domain.name}</p>
            </div>
            {currentCockpit && currentCockpit.domains.length > 1 && (
              <button
                onClick={async () => {
                  const confirmed = await confirm({
                    title: 'Supprimer le domaine',
                    message: `Voulez-vous supprimer le domaine "${domain.name}" et tout son contenu ?`,
                  });
                  if (confirmed) {
                    deleteDomain(domain.id);
                  }
                }}
                className="p-2 text-[#E57373] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Supprimer ce domaine"
              >
                <MuiIcon name="Trash2" size={18} />
              </button>
            )}
          </div>
        </div>
        
        {/* Propriétés du domaine */}
        <Section 
          title="Propriétés" 
          iconName="SettingsIcon" 
          isOpen={activeSection === 'properties'}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom</label>
              <input
                type="text"
                value={domain.name}
                onChange={(e) => updateDomain(domain.id, { name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom du template</label>
              <input
                type="text"
                value={domain.templateName || ''}
                onChange={(e) => updateDomain(domain.id, { templateName: e.target.value })}
                placeholder="Mon template"
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>
        </Section>
        
        {/* Type de template */}
        <Section 
          title="Type de vue" 
          iconName="Layers" 
          isOpen={activeSection === 'template'}
          onToggle={() => toggleSection('template')}
        >
          <div className="space-y-2">
            {[
              { type: 'standard' as TemplateType, label: 'Standard', desc: 'Catégories et éléments' },
              { type: 'grid' as TemplateType, label: 'Grille', desc: 'Tuiles en grille simple' },
              { type: 'map' as TemplateType, label: 'Carte', desc: 'Carte dynamique' },
              { type: 'background' as TemplateType, label: 'Image de fond', desc: 'Positionnement libre' },
            ].map(({ type, label, desc }) => (
              <button
                key={type}
                onClick={() => updateDomain(domain.id, { templateType: type })}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-all text-left ${
                  domain.templateType === type 
                    ? 'bg-[#1E3A5F]/10 border border-[#1E3A5F]/30 text-[#1E3A5F]' 
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full mt-0.5 ${
                  domain.templateType === type ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                }`} />
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-[#94A3B8]">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>
        
        {/* Image de fond */}
        <Section 
          title="Image de fond" 
          iconName="Image" 
          isOpen={activeSection === 'background'}
          onToggle={() => toggleSection('background')}
        >
          <div className="space-y-4">
            {/* Zone de sélection de fichier */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Charger une image</label>
              <label 
                htmlFor={`bg-upload-${domain.id}`}
                className="block p-4 border-2 border-dashed border-[#E2E8F0] rounded-lg hover:border-[#1E3A5F] transition-colors cursor-pointer"
              >
                <input
                  type="file"
                  accept="image/*"
                  id={`bg-upload-${domain.id}`}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const maxSizeMB = 30;
                      const maxSizeBytes = maxSizeMB * 1024 * 1024;
                      if (file.size > maxSizeBytes) {
                        alert(`Erreur: Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). La taille maximale autorisée est de ${maxSizeMB} MB.`);
                        e.target.value = '';
                        return;
                      }
                      
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setImageUrl(base64);
                        updateDomain(domain.id, { backgroundImage: base64 });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                  <MuiIcon name="Upload" size={24} className="mb-2" />
                  <span className="text-xs font-medium">Cliquez pour choisir un fichier</span>
                  <span className="text-[10px] text-[#94A3B8] mt-1">PNG, JPG, GIF jusqu'à 30MB</span>
                </div>
              </label>
            </div>
            
            {/* Séparateur */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-xs text-[#94A3B8]">ou</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>
            
            {/* URL alternative */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">URL de l'image</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setAnalysisResult(null);
                  }}
                  placeholder="https://exemple.com/image.png"
                  className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
                {domain.templateType === 'map' && (
                  <button
                    onClick={analyzeMapImage}
                    disabled={!imageUrl || isAnalyzing}
                    className="px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap text-xs"
                    title="Analyser l'image avec l'IA pour détecter les coordonnées GPS"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="animate-spin"><MuiIcon name="Refresh" size={14} /></div>
                        <span>Analyse...</span>
                      </>
                    ) : (
                      <>
                        <MuiIcon name="AutoAwesome" size={14} />
                        <span>Détecter GPS</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              {domain.templateType !== 'map' && (
                <button
                  onClick={() => {
                    if (imageUrl && imageUrl.trim()) {
                      updateDomain(domain.id, { backgroundImage: imageUrl });
                    }
                  }}
                  className="mt-2 w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] text-sm"
                >
                  Enregistrer l'URL
                </button>
              )}
            </div>
            
            {/* Aperçu */}
            {imageUrl && (
              <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-2">Aperçu :</p>
                <img 
                  src={imageUrl} 
                  alt="Aperçu" 
                  className="max-h-32 rounded border border-[#E2E8F0] mx-auto w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {imageUrl.startsWith('data:') && (
                  <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                    <MuiIcon name="CheckCircle" size={12} />
                    Fichier chargé
                  </p>
                )}
              </div>
            )}
            
            {/* Résultat de l'analyse IA (MapView uniquement) */}
            {domain.templateType === 'map' && analysisResult && (
              <div className={`p-3 rounded-lg text-sm ${
                analysisResult.detected 
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}>
                {analysisResult.detected ? (
                  <div className="flex items-start gap-2">
                    <MuiIcon name="CheckCircle" size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Zone détectée : {analysisResult.region}</p>
                      <p className="text-xs mt-1 opacity-80">{analysisResult.description}</p>
                      {analysisResult.confidence && (
                        <p className="text-xs mt-1 opacity-60">Confiance : {analysisResult.confidence}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <MuiIcon name="Warning" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Détection impossible</p>
                      <p className="text-xs mt-1 opacity-80">{analysisResult.description}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Coordonnées GPS (MapView uniquement) */}
            {domain.templateType === 'map' && (
              <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                <h4 className="font-medium text-[#1E3A5F] mb-2 text-sm flex items-center gap-2">
                  <MuiIcon name="Place" size={14} />
                  Coordonnées GPS des coins de l'image
                </h4>
                <p className="text-xs text-[#64748B] mb-3">
                  Ces coordonnées correspondent aux pixels des coins de l'image (pas à la zone géographique).
                </p>
                
                {/* Coin haut-gauche */}
                <div className="mb-3">
                  <label className="block text-xs text-[#64748B] mb-1">📍 Coin haut-gauche (Nord-Ouest)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={gpsForm.topLeftLat}
                        onChange={(e) => setGpsForm({ ...gpsForm, topLeftLat: e.target.value })}
                        placeholder="ex: 51.089"
                        className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={gpsForm.topLeftLng}
                        onChange={(e) => setGpsForm({ ...gpsForm, topLeftLng: e.target.value })}
                        placeholder="ex: -5.142"
                        className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Coin bas-droite */}
                <div className="mb-3">
                  <label className="block text-xs text-[#64748B] mb-1">📍 Coin bas-droite (Sud-Est)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={gpsForm.bottomRightLat}
                        onChange={(e) => setGpsForm({ ...gpsForm, bottomRightLat: e.target.value })}
                        placeholder="ex: 41.303"
                        className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={gpsForm.bottomRightLng}
                        onChange={(e) => setGpsForm({ ...gpsForm, bottomRightLng: e.target.value })}
                        placeholder="ex: 9.561"
                        className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={saveGpsBounds}
                  className="w-full px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] text-xs"
                >
                  Enregistrer les coordonnées GPS
                </button>
              </div>
            )}
            
            {/* Options d'affichage */}
            {domain.backgroundImage && (
              <div className="space-y-3">
                <div className="relative">
                  <img 
                    src={domain.backgroundImage} 
                    alt="Aperçu" 
                    className="w-full h-20 object-cover rounded-lg border border-[#E2E8F0]"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs">Image de fond</span>
                  </div>
                </div>
                
                {/* Mode d'affichage */}
                <div>
                  <p className="text-xs text-[#64748B] mb-2">Position de l'image</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateDomain(domain.id, { backgroundMode: 'behind' })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        (!domain.backgroundMode || domain.backgroundMode === 'behind')
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                      }`}
                    >
                      En dessous
                    </button>
                    <button
                      onClick={() => updateDomain(domain.id, { backgroundMode: 'overlay' })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        domain.backgroundMode === 'overlay'
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#EEF2F7] border border-[#E2E8F0]'
                      }`}
                    >
                      Au dessus
                    </button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">
                    {(!domain.backgroundMode || domain.backgroundMode === 'behind') 
                      ? 'L\'image sera derrière les tuiles' 
                      : 'L\'image sera par-dessus (transparente, sans gêner les clics)'}
                  </p>
                </div>
                
                {/* Opacité de l'image (BackgroundView uniquement) */}
                {domain.templateType === 'background' && (
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">
                      Opacité de l'image ({domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}
                      onChange={(e) => updateDomain(domain.id, { backgroundImageOpacity: Number(e.target.value) })}
                      className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #1E3A5F 0%, #1E3A5F ${domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}%, #E2E8F0 ${domain.backgroundImageOpacity !== undefined ? domain.backgroundImageOpacity : 100}%, #E2E8F0 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-[#64748B] mt-1">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
                
                {/* Regroupement (clustering) */}
                <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-[#1E3A5F]">
                        {domain.templateType === 'map' ? 'Regroupement des points' : 'Regroupement des éléments'}
                      </label>
                      <p className="text-xs text-[#64748B] mt-1">
                        {domain.templateType === 'map' 
                          ? 'Regrouper les points proches en clusters pour améliorer la lisibilité'
                          : 'Regrouper les éléments proches en clusters pour améliorer la lisibilité'}
                      </p>
                    </div>
                    <button
                      onClick={() => updateDomain(domain.id, { enableClustering: !(domain.enableClustering !== false) })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        domain.enableClustering !== false ? 'bg-[#1E3A5F]' : 'bg-[#CBD5E1]'
                      }`}
                      role="switch"
                      aria-checked={domain.enableClustering !== false}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          domain.enableClustering !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => updateDomain(domain.id, { backgroundImage: undefined, backgroundMode: undefined, backgroundImageOpacity: undefined })}
                  className="w-full px-3 py-1.5 text-xs text-[#E57373] hover:bg-red-50 rounded-lg border border-[#E57373]/30 transition-colors flex items-center justify-center gap-1"
                >
                  <MuiIcon name="Delete" size={12} />
                  Supprimer l'image
                </button>
              </div>
            )}
          </div>
        </Section>
        
        {/* Édition des catégories */}
        {domain.categories && domain.categories.length > 0 && (
          <Section 
            title={`Catégories (${domain.categories.length})`}
            iconName="FolderOpen" 
            isOpen={activeSection === 'categories'}
            onToggle={() => toggleSection('categories')}
          >
            <div className="space-y-2">
              {domain.categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
                  <input
                    type="text"
                    value={category.name}
                    onChange={(e) => updateCategory(category.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-[#E2E8F0] rounded text-sm text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <span className="text-xs text-[#94A3B8]">
                    {category.elements.length} élément{category.elements.length > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
        
        {/* Paramètres du cockpit */}
        <Section 
          title="Cockpit" 
          iconName="Label" 
          isOpen={activeSection === 'cockpit'}
          onToggle={() => toggleSection('cockpit')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Nom du cockpit</label>
              <input
                type="text"
                value={currentCockpit?.name || ''}
                onChange={(e) => updateCockpit({ name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Logo (URL)</label>
              <input
                type="text"
                value={currentCockpit?.logo || ''}
                onChange={(e) => updateCockpit({ logo: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            
            <div>
              <label className="block text-sm text-[#64748B] mb-1">Bandeau défilant</label>
              <textarea
                value={currentCockpit?.scrollingBanner || ''}
                onChange={(e) => updateCockpit({ scrollingBanner: e.target.value })}
                placeholder="Texte du bandeau..."
                rows={2}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
              />
            </div>
          </div>
        </Section>
      </div>
    );
  }
  
  // Aucune sélection
  return (
    <div className="fixed right-0 top-[105px] bottom-0 w-80 bg-white border-l border-[#E2E8F0] flex items-center justify-center shadow-lg">
      <p className="text-[#94A3B8] text-center px-8">
        Sélectionnez un domaine ou un élément pour l'éditer
      </p>
    </div>
  );
}

interface SectionProps {
  title: string;
  iconName: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, iconName, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="border-b border-[#E2E8F0]">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F7FA] transition-colors"
      >
        <MuiIcon name={iconName} size={16} className="text-[#94A3B8]" />
        <span className="flex-1 text-sm font-medium text-[#1E3A5F]">{title}</span>
        {isOpen ? (
          <MuiIcon name="ChevronDown" size={16} className="text-[#94A3B8]" />
        ) : (
          <MuiIcon name="ChevronRightIcon" size={16} className="text-[#94A3B8]" />
        )}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
