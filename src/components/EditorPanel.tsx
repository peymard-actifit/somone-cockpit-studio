import { useState, useEffect } from 'react';
import type { Domain, Element, SubElement, TileStatus, TemplateType, Alert } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
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
    updateElement,
    deleteElement,
    updateSubElement,
    deleteSubElement,
    updateCategory,
    updateSubCategory,
    updateCockpit,
    currentCockpit,
    zones,
    addZone,
    deleteZone,
    setCurrentElement,
    updateMapElement,
    deleteMapElement,
    cloneMapElement
  } = useCockpitStore();
  const confirm = useConfirm();
  
  const [activeSection, setActiveSection] = useState<string | null>('properties');
  const [newZoneName, setNewZoneName] = useState('');
  const [selectedSubElement, setSelectedSubElement] = useState<SubElement | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<'icon' | 'icon2' | 'icon3' | 'category' | 'subCategory' | 'subElement' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  
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
            
            {/* Icône du sous-élément */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Icône</label>
              <button
                onClick={() => setShowIconPicker('subElement')}
                className="w-full flex items-center gap-3 px-3 py-3 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
              >
                {selectedSubElement.icon ? (
                  <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                    <MuiIcon name={selectedSubElement.icon} size={20} className="text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-[#E2E8F0] rounded-lg flex items-center justify-center">
                    <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                  </div>
                )}
                <span className="text-sm">{selectedSubElement.icon || 'Choisir une icône...'}</span>
              </button>
            </div>
          </div>
        </Section>
        
        {/* Icône du sous-élément - Sélecteur */}
        {showIconPicker === 'subElement' && (
          <IconPicker
            value={selectedSubElement.icon}
            onChange={(iconName) => {
              updateSubElement(selectedSubElement.id, { icon: iconName || undefined });
              setSelectedSubElement({ ...selectedSubElement, icon: iconName || undefined });
              setShowIconPicker(null);
            }}
            onClose={() => setShowIconPicker(null)}
          />
        )}
        
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
            {showIconPicker === 'subCategory' && selectedSubCategoryId && (
              <IconPicker
                value={element.subCategories.find(sc => sc.id === selectedSubCategoryId)?.icon}
                onChange={(iconName) => {
                  updateSubCategory(selectedSubCategoryId, { icon: iconName });
                  setShowIconPicker(null);
                  setSelectedSubCategoryId(null);
                }}
                onClose={() => {
                  setShowIconPicker(null);
                  setSelectedSubCategoryId(null);
                }}
              />
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
        
        {/* Liste des sous-catégories à éditer */}
        {element.subCategories.length > 0 && (
          <Section 
            title={`Sous-catégories (${element.subCategories.length})`}
            iconName="Folder" 
            isOpen={activeSection === 'subcategories'}
            onToggle={() => toggleSection('subcategories')}
          >
            <div className="space-y-2">
              <p className="text-xs text-[#94A3B8] mb-3">
                Cliquez sur une sous-catégorie pour modifier son icône.
              </p>
              {element.subCategories.map((subCategory) => (
                <button
                  key={subCategory.id}
                  onClick={() => {
                    setSelectedSubCategoryId(subCategory.id);
                    setShowIconPicker('subCategory');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-[#F5F7FA] hover:bg-[#EEF2F7] rounded-lg transition-colors text-left border border-[#E2E8F0]"
                >
                  {subCategory.icon ? (
                    <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MuiIcon name={subCategory.icon} size={18} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-[#E2E8F0] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                    </div>
                  )}
                  <span className="text-sm text-[#1E3A5F] truncate flex-1">{subCategory.name}</span>
                  <MuiIcon name="Pencil" size={16} className="text-[#94A3B8] flex-shrink-0" />
                </button>
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
          iconName="ImageIcon" 
          isOpen={activeSection === 'background'}
          onToggle={() => toggleSection('background')}
        >
          <div className="space-y-3">
            {/* Zone de sélection de fichier */}
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
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const base64 = event.target?.result as string;
                      updateDomain(domain.id, { backgroundImage: base64 });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center text-[#64748B] hover:text-[#1E3A5F]">
                <MuiIcon name="Upload" size={24} className="mb-2" />
                <span className="text-xs font-medium">Cliquez pour choisir</span>
                <span className="text-[10px] text-[#94A3B8] mt-1">PNG, JPG, GIF</span>
              </div>
            </label>
            
            {/* Aperçu et options */}
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
                
                <button
                  onClick={() => updateDomain(domain.id, { backgroundImage: undefined, backgroundMode: undefined })}
                  className="w-full px-3 py-1.5 text-xs text-[#E57373] hover:bg-red-50 rounded-lg border border-[#E57373]/30 transition-colors flex items-center justify-center gap-1"
                >
                  <MuiIcon name="Trash2" size={12} />
                  Supprimer l'image
                </button>
              </div>
            )}
          </div>
        </Section>
        
        {/* Liste des catégories à éditer */}
        {domain.categories.length > 0 && (
          <Section 
            title={`Catégories (${domain.categories.length})`}
            iconName="Folder" 
            isOpen={activeSection === 'categories'}
            onToggle={() => toggleSection('categories')}
          >
            <div className="space-y-2">
              <p className="text-xs text-[#94A3B8] mb-3">
                Cliquez sur une catégorie pour modifier son icône.
              </p>
              {domain.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setShowIconPicker('category');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-[#F5F7FA] hover:bg-[#EEF2F7] rounded-lg transition-colors text-left border border-[#E2E8F0]"
                >
                  {category.icon ? (
                    <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MuiIcon name={category.icon} size={18} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-[#E2E8F0] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MuiIcon name="ImageIcon" size={16} className="text-[#94A3B8]" />
                    </div>
                  )}
                  <span className="text-sm text-[#1E3A5F] truncate flex-1">{category.name}</span>
                  <MuiIcon name="Pencil" size={16} className="text-[#94A3B8] flex-shrink-0" />
                </button>
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
        
        {/* Icône de catégorie - Sélecteur */}
        {showIconPicker === 'category' && selectedCategoryId && domain && (
          <IconPicker
            value={domain.categories.find(c => c.id === selectedCategoryId)?.icon}
            onChange={(iconName) => {
              updateCategory(selectedCategoryId, { icon: iconName || undefined });
              setShowIconPicker(null);
              setSelectedCategoryId(null);
            }}
            onClose={() => {
              setShowIconPicker(null);
              setSelectedCategoryId(null);
            }}
          />
        )}
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
