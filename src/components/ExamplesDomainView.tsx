import { useState, useMemo } from 'react';
import type { Domain, Category, Element, Cockpit, TileStatus } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';
import IconPicker from './IconPicker';
import { useCockpitStore } from '../store/cockpitStore';
import { useAuthStore } from '../store/authStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirm } from '../contexts/ConfirmContext';

interface ExamplesDomainViewProps {
  domain: Domain;
  cockpit: Cockpit;
  readOnly?: boolean;
  onElementClick?: (elementId: string) => void;
}

// Liste des statuts disponibles
const AVAILABLE_STATUSES: TileStatus[] = ['ok', 'mineur', 'critique', 'fatal', 'information', 'deconnecte'];

/**
 * Vue Exemples - Affiche un domaine de type "examples"
 * Permet de créer et gérer des exemples d'éléments réutilisables
 */
export default function ExamplesDomainView({ domain, cockpit, readOnly = false, onElementClick }: ExamplesDomainViewProps) {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const confirmDialog = useConfirm();
  const {
    addCategory,
    deleteCategory,
    addElement,
    updateElement,
    deleteElement,
    addSubCategory,
    deleteSubCategory,
    addSubElement,
    updateSubElement,
    deleteSubElement,
  } = useCockpitStore();

  // États pour l'édition
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [addingElementToCategory, setAddingElementToCategory] = useState<string | null>(null);
  const [newElementName, setNewElementName] = useState('');
  const [addingSubCatToElement, setAddingSubCatToElement] = useState<string | null>(null);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [addingSubElementToSubCat, setAddingSubElementToSubCat] = useState<string | null>(null);
  const [newSubElementName, setNewSubElementName] = useState('');
  
  // États pour l'édition d'icône et statut
  const [editingIconElement, setEditingIconElement] = useState<string | null>(null);
  const [editingStatusElement, setEditingStatusElement] = useState<string | null>(null);
  const [editingStatusSubElement, setEditingStatusSubElement] = useState<string | null>(null);
  
  // État pour les notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Vérifier si l'utilisateur peut éditer (admin ou standard, pas client)
  const userType = user?.userType || (user?.isAdmin ? 'admin' : 'standard');
  const canEdit = !readOnly && userType !== 'client';

  const categories = domain.categories || [];

  // Afficher une notification
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Toggle expansion d'une catégorie
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle expansion d'un élément
  const toggleElement = (elementId: string) => {
    setExpandedElements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return newSet;
    });
  };

  // Ajouter une catégorie
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    addCategory(domain.id, newCategoryName.trim(), 'horizontal');
    setNewCategoryName('');
  };

  // Ajouter un élément
  const handleAddElement = (categoryId: string) => {
    if (!newElementName.trim()) return;
    addElement(categoryId, newElementName.trim());
    setNewElementName('');
    setAddingElementToCategory(null);
  };

  // Ajouter une sous-catégorie
  const handleAddSubCategory = (elementId: string) => {
    if (!newSubCatName.trim()) return;
    addSubCategory(elementId, newSubCatName.trim());
    setNewSubCatName('');
    setAddingSubCatToElement(null);
  };

  // Ajouter un sous-élément
  const handleAddSubElement = (subCategoryId: string) => {
    if (!newSubElementName.trim()) return;
    addSubElement(subCategoryId, newSubElementName.trim());
    setNewSubElementName('');
    setAddingSubElementToSubCat(null);
  };

  // Supprimer une catégorie avec confirmation
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const confirmed = await confirmDialog({
      title: t('examples.deleteCategory'),
      message: (t('examples.deleteCategoryConfirm') || '').replace('{name}', categoryName),
      confirmLabel: t('common.delete') || 'Supprimer',
      danger: true,
    });
    if (confirmed) {
      deleteCategory(categoryId);
    }
  };

  // Supprimer un élément avec confirmation
  const handleDeleteElement = async (elementId: string, elementName: string) => {
    const confirmed = await confirmDialog({
      title: t('examples.deleteElement'),
      message: (t('examples.deleteElementConfirm') || '').replace('{name}', elementName),
      confirmLabel: t('common.delete') || 'Supprimer',
      danger: true,
    });
    if (confirmed) {
      deleteElement(elementId);
    }
  };

  // Supprimer une sous-catégorie avec confirmation
  const handleDeleteSubCategory = async (subCategoryId: string, subCategoryName: string) => {
    const confirmed = await confirmDialog({
      title: t('examples.deleteSubCategory'),
      message: (t('examples.deleteSubCategoryConfirm') || '').replace('{name}', subCategoryName),
      confirmLabel: t('common.delete') || 'Supprimer',
      danger: true,
    });
    if (confirmed) {
      deleteSubCategory(subCategoryId);
    }
  };

  // Supprimer un sous-élément avec confirmation
  const handleDeleteSubElement = async (subElementId: string, subElementName: string) => {
    const confirmed = await confirmDialog({
      title: t('examples.deleteSubElement'),
      message: (t('examples.deleteSubElementConfirm') || '').replace('{name}', subElementName),
      confirmLabel: t('common.delete') || 'Supprimer',
      danger: true,
    });
    if (confirmed) {
      deleteSubElement(subElementId);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-hidden">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <MuiIcon name={notification.type === 'success' ? 'CheckCircle' : 'Error'} size={20} />
          <span className="font-medium">{notification.message}</span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <MuiIcon name="LibraryBooks" size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1E3A5F]">
              {domain.name}
            </h2>
            <p className="text-sm text-[#64748B]">
              {canEdit ? t('examples.subtitleEdit') : t('examples.subtitleView')}
            </p>
          </div>
        </div>
        <div className="text-sm text-[#94A3B8]">
          {categories.length} {categories.length > 1 ? t('examples.elementsCount') : t('examples.elementCount')}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Formulaire d'ajout de catégorie */}
        {canEdit && (
          <div className="mb-4 p-3 bg-white rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('examples.newCategory')}
                className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <MuiIcon name="Add" size={16} />
                {t('examples.addCategory')}
              </button>
            </div>
          </div>
        )}

        {/* Liste des catégories */}
        {categories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E2E8F0]">
            <MuiIcon name="Inbox" size={48} className="text-[#CBD5E1] mx-auto mb-4" />
            <p className="text-[#64748B]">{t('examples.empty')}</p>
            {canEdit && (
              <p className="text-sm text-[#94A3B8] mt-2">
                {t('examples.emptyHint')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                {/* Header de la catégorie */}
                <div 
                  className="flex items-center justify-between p-3 bg-[#F8FAFC] cursor-pointer hover:bg-[#F1F5F9]"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center gap-3">
                    <MuiIcon 
                      name={expandedCategories.has(category.id) ? 'ExpandMore' : 'ChevronRight'} 
                      size={20} 
                      className="text-[#64748B]" 
                    />
                    {category.icon && (
                      <MuiIcon name={category.icon} size={20} className="text-[#1E3A5F]" />
                    )}
                    <span className="font-semibold text-[#1E3A5F]">{category.name}</span>
                    <span className="text-xs text-[#64748B] bg-white px-2 py-0.5 rounded-full">
                      {category.elements.length} {category.elements.length > 1 ? t('examples.elementsCount') : t('examples.elementCount')}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(category.id, category.name);
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                      title={t('examples.deleteCategory')}
                    >
                      <MuiIcon name="Delete" size={18} />
                    </button>
                  )}
                </div>

                {/* Contenu de la catégorie */}
                {expandedCategories.has(category.id) && (
                  <div className="p-3 space-y-2">
                    {/* Bouton ajouter élément */}
                    {canEdit && (
                      <div className="mb-2">
                        {addingElementToCategory === category.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newElementName}
                              onChange={(e) => setNewElementName(e.target.value)}
                              placeholder={t('examples.elementName')}
                              className="flex-1 px-3 py-1.5 border border-[#E2E8F0] rounded text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddElement(category.id);
                                if (e.key === 'Escape') setAddingElementToCategory(null);
                              }}
                            />
                            <button
                              onClick={() => handleAddElement(category.id)}
                              className="px-3 py-1.5 bg-amber-500 text-white rounded text-sm"
                            >
                              {t('examples.add')}
                            </button>
                            <button
                              onClick={() => setAddingElementToCategory(null)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
                            >
                              {t('examples.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingElementToCategory(category.id)}
                            className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                          >
                            <MuiIcon name="Add" size={16} />
                            {t('examples.addElement')}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Liste des éléments */}
                    {category.elements.map((element) => (
                      <ExampleElementCard
                        key={element.id}
                        element={element}
                        expanded={expandedElements.has(element.id)}
                        onToggle={() => toggleElement(element.id)}
                        canEdit={canEdit}
                        onDelete={() => handleDeleteElement(element.id, element.name)}
                        onClick={() => onElementClick?.(element.id)}
                        onAddSubCategory={() => setAddingSubCatToElement(element.id)}
                        addingSubCat={addingSubCatToElement === element.id}
                        newSubCatName={newSubCatName}
                        setNewSubCatName={setNewSubCatName}
                        onSubmitSubCat={() => handleAddSubCategory(element.id)}
                        onCancelSubCat={() => setAddingSubCatToElement(null)}
                        onDeleteSubCategory={handleDeleteSubCategory}
                        addingSubElementTo={addingSubElementToSubCat}
                        setAddingSubElementTo={setAddingSubElementToSubCat}
                        newSubElementName={newSubElementName}
                        setNewSubElementName={setNewSubElementName}
                        onAddSubElement={handleAddSubElement}
                        onDeleteSubElement={handleDeleteSubElement}
                        t={t}
                        editingIconElement={editingIconElement}
                        setEditingIconElement={setEditingIconElement}
                        editingStatusElement={editingStatusElement}
                        setEditingStatusElement={setEditingStatusElement}
                        onUpdateElement={(id, updates) => updateElement(id, updates)}
                        onUpdateSubElement={(id, updates) => updateSubElement(id, updates)}
                        editingStatusSubElement={editingStatusSubElement}
                        setEditingStatusSubElement={setEditingStatusSubElement}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Composant carte d'élément exemple
interface ExampleElementCardProps {
  element: Element;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onDelete: () => void;
  onClick?: () => void;
  onAddSubCategory: () => void;
  addingSubCat: boolean;
  newSubCatName: string;
  setNewSubCatName: (name: string) => void;
  onSubmitSubCat: () => void;
  onCancelSubCat: () => void;
  onDeleteSubCategory: (id: string, name: string) => void;
  addingSubElementTo: string | null;
  setAddingSubElementTo: (id: string | null) => void;
  newSubElementName: string;
  setNewSubElementName: (name: string) => void;
  onAddSubElement: (subCategoryId: string) => void;
  onDeleteSubElement: (id: string, name: string) => void;
  // Traductions
  t: (key: string) => string;
  // Édition d'icône pour l'élément
  editingIconElement: string | null;
  setEditingIconElement: (id: string | null) => void;
  // Édition de statut pour l'élément
  editingStatusElement: string | null;
  setEditingStatusElement: (id: string | null) => void;
  // Mise à jour de l'élément
  onUpdateElement: (elementId: string, updates: Partial<Element>) => void;
  // Mise à jour du sous-élément
  onUpdateSubElement: (subElementId: string, updates: Partial<any>) => void;
  // Édition de statut pour le sous-élément
  editingStatusSubElement: string | null;
  setEditingStatusSubElement: (id: string | null) => void;
}

function ExampleElementCard({
  element,
  expanded,
  onToggle,
  canEdit,
  onDelete,
  onClick,
  onAddSubCategory,
  addingSubCat,
  newSubCatName,
  setNewSubCatName,
  onSubmitSubCat,
  onCancelSubCat,
  onDeleteSubCategory,
  addingSubElementTo,
  setAddingSubElementTo,
  newSubElementName,
  setNewSubElementName,
  onAddSubElement,
  onDeleteSubElement,
  t,
  editingIconElement,
  setEditingIconElement,
  editingStatusElement,
  setEditingStatusElement,
  onUpdateElement,
  onUpdateSubElement,
  editingStatusSubElement,
  setEditingStatusSubElement,
}: ExampleElementCardProps) {
  const statusColors = STATUS_COLORS[element.status] || STATUS_COLORS.ok;
  const totalSubElements = element.subCategories.reduce(
    (sum, sc) => sum + sc.subElements.length, 
    0
  );

  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
      {/* Header de l'élément */}
      <div 
        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-[#FAFBFC] ${statusColors.bg.replace('bg-', 'border-l-4 border-')}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <MuiIcon 
            name={expanded ? 'ExpandMore' : 'ChevronRight'} 
            size={18} 
            className="text-[#64748B]" 
          />
          {/* Icône de l'élément - cliquable pour éditer */}
          <div 
            className="relative"
            onClick={(e) => { if (canEdit) { e.stopPropagation(); setEditingIconElement(element.id); } }}
          >
            {element.icon ? (
              <MuiIcon name={element.icon} size={18} className={`text-[#1E3A5F] ${canEdit ? 'cursor-pointer hover:text-[#2C4A6E]' : ''}`} />
            ) : canEdit ? (
              <div className="w-5 h-5 border border-dashed border-[#CBD5E1] rounded flex items-center justify-center cursor-pointer hover:border-[#1E3A5F]">
                <MuiIcon name="Add" size={12} className="text-[#94A3B8]" />
              </div>
            ) : null}
            {/* Picker d'icône */}
            {editingIconElement === element.id && (
              <div className="absolute top-full left-0 z-50 mt-1" onClick={(e) => e.stopPropagation()}>
                <IconPicker
                  value={element.icon}
                  onChange={(icon: string | undefined) => {
                    onUpdateElement(element.id, { icon });
                    setEditingIconElement(null);
                  }}
                  onClose={() => setEditingIconElement(null)}
                />
              </div>
            )}
          </div>
          <span className="font-medium text-[#1E3A5F]">{element.name}</span>
          <span className="text-xs text-[#94A3B8]">
            ({element.subCategories.length} {t('examples.subCategories')} / {totalSubElements} {t('examples.subElements')})
          </span>
          {/* Indicateur de statut cliquable */}
          {canEdit && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setEditingStatusElement(editingStatusElement === element.id ? null : element.id)}
                className={`px-2 py-0.5 rounded text-xs ${statusColors.bg} text-white hover:opacity-80`}
                title={t('examples.editStatus')}
              >
                {STATUS_LABELS[element.status] || element.status}
              </button>
              {/* Sélecteur de statut */}
              {editingStatusElement === element.id && (
                <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-2 min-w-[120px]">
                  {AVAILABLE_STATUSES.map((status) => {
                    const colors = STATUS_COLORS[status];
                    return (
                      <button
                        key={status}
                        onClick={() => {
                          onUpdateElement(element.id, { status });
                          setEditingStatusElement(null);
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-xs mb-1 last:mb-0 ${colors.bg} text-white hover:opacity-80 ${element.status === status ? 'ring-2 ring-offset-1 ring-[#1E3A5F]' : ''}`}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onClick && (
            <button
              onClick={onClick}
              className="p-1.5 text-[#1E3A5F] hover:bg-[#1E3A5F]/10 rounded"
              title={t('editor.editElement')}
            >
              <MuiIcon name="Edit" size={16} />
            </button>
          )}
          {canEdit && (
            <button
              onClick={onDelete}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
              title={t('examples.deleteElement')}
            >
              <MuiIcon name="Delete" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Contenu de l'élément */}
      {expanded && (
        <div className="p-3 bg-[#FAFBFC] space-y-2">
          {/* Bouton ajouter sous-catégorie */}
          {canEdit && (
            <div className="mb-2">
              {addingSubCat ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubCatName}
                    onChange={(e) => setNewSubCatName(e.target.value)}
                    placeholder={t('examples.subCategoryName')}
                    className="flex-1 px-2 py-1 border border-[#E2E8F0] rounded text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSubmitSubCat();
                      if (e.key === 'Escape') onCancelSubCat();
                    }}
                  />
                  <button onClick={onSubmitSubCat} className="px-2 py-1 bg-amber-500 text-white rounded text-xs">OK</button>
                  <button onClick={onCancelSubCat} className="px-2 py-1 bg-gray-200 rounded text-xs">✕</button>
                </div>
              ) : (
                <button
                  onClick={onAddSubCategory}
                  className="flex items-center gap-1 text-xs text-[#64748B] hover:text-amber-600"
                >
                  <MuiIcon name="Add" size={14} />
                  {t('examples.addSubCategory')}
                </button>
              )}
            </div>
          )}

          {/* Liste des sous-catégories */}
          {element.subCategories.map((subCat) => (
            <div key={subCat.id} className="bg-white rounded border border-[#E2E8F0] p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[#1E3A5F]">{subCat.name}</span>
                {canEdit && (
                  <button
                    onClick={() => onDeleteSubCategory(subCat.id, subCat.name)}
                    className="p-0.5 text-red-400 hover:text-red-600"
                    title={t('examples.deleteSubCategory')}
                  >
                    <MuiIcon name="Close" size={14} />
                  </button>
                )}
              </div>
              
              {/* Sous-éléments */}
              <div className="flex flex-wrap gap-1">
                {subCat.subElements.map((se) => {
                  const seColors = STATUS_COLORS[se.status] || STATUS_COLORS.ok;
                  return (
                    <div 
                      key={se.id} 
                      className={`relative px-2 py-0.5 rounded text-xs text-white ${seColors.bg} flex items-center gap-1 group`}
                    >
                      {se.name}
                      {canEdit && (
                        <>
                          {/* Bouton de changement de statut */}
                          <button
                            onClick={() => setEditingStatusSubElement(editingStatusSubElement === se.id ? null : se.id)}
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                            title={t('examples.editStatus')}
                          >
                            <MuiIcon name="ColorLens" size={12} />
                          </button>
                          {/* Bouton de suppression */}
                          <button
                            onClick={() => onDeleteSubElement(se.id, se.name)}
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                            title={t('examples.deleteSubElement')}
                          >
                            <MuiIcon name="Close" size={12} />
                          </button>
                          {/* Sélecteur de statut pour sous-élément */}
                          {editingStatusSubElement === se.id && (
                            <div 
                              className="absolute top-full left-0 z-50 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-1 min-w-[100px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {AVAILABLE_STATUSES.map((status) => {
                                const colors = STATUS_COLORS[status];
                                return (
                                  <button
                                    key={status}
                                    onClick={() => {
                                      onUpdateSubElement(se.id, { status });
                                      setEditingStatusSubElement(null);
                                    }}
                                    className={`w-full text-left px-2 py-0.5 rounded text-xs mb-0.5 last:mb-0 ${colors.bg} text-white hover:opacity-80 ${se.status === status ? 'ring-1 ring-offset-1 ring-[#1E3A5F]' : ''}`}
                                  >
                                    {STATUS_LABELS[status]}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                
                {/* Ajouter sous-élément */}
                {canEdit && (
                  addingSubElementTo === subCat.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newSubElementName}
                        onChange={(e) => setNewSubElementName(e.target.value)}
                        placeholder={t('examples.subElementName')}
                        className="w-24 px-1 py-0.5 border rounded text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onAddSubElement(subCat.id);
                          if (e.key === 'Escape') setAddingSubElementTo(null);
                        }}
                      />
                      <button onClick={() => onAddSubElement(subCat.id)} className="text-green-600"><MuiIcon name="Check" size={14} /></button>
                      <button onClick={() => setAddingSubElementTo(null)} className="text-gray-400"><MuiIcon name="Close" size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSubElementTo(subCat.id)}
                      className="px-2 py-0.5 border border-dashed border-[#CBD5E1] rounded text-xs text-[#94A3B8] hover:border-amber-500 hover:text-amber-600"
                    >
                      {t('examples.addSubElement')}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
