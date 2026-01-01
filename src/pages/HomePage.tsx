import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from '../components/IconPicker';
import { VERSION_DISPLAY, APP_VERSION } from '../config/version';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Cockpit, Folder } from '../types';

// Composant pour une carte de répertoire
function FolderCard({
  folder,
  onClick,
  onRename,
  onDelete,
  cockpitsCount,
  isUserFolder = true, // true = répertoire de l'utilisateur, false = répertoire d'un autre compte (admin)
  isDraggingCockpit = false, // true si une maquette est en cours de drag
}: {
  folder: Folder;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  cockpitsCount: number;
  isUserFolder?: boolean;
  isDraggingCockpit?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `folder-${folder.id}` });

  // Zone droppable pour recevoir les maquettes
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `folder-${folder.id}`,
  });

  // Combiner les refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Déterminer si on doit illuminer (survol avec une maquette)
  const isHighlighted = isOver && isDraggingCockpit;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group border-2 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
        isHighlighted
          ? 'bg-amber-200 border-amber-500 shadow-lg shadow-amber-300/50 scale-105 ring-2 ring-amber-400'
          : isUserFolder 
            ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-200/30' 
            : 'bg-purple-50 border-purple-200 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-200/30'
      }`}
      onClick={onClick}
    >
      {/* En-tête avec icône dossier et drag */}
      <div className={`p-2.5 border-b ${isUserFolder ? 'border-amber-200' : 'border-purple-200'}`}>
        <div className="flex items-center gap-2">
          {/* Icône dossier */}
          <div className={`p-1.5 rounded-lg ${isUserFolder ? 'bg-amber-100' : 'bg-purple-100'}`}>
            <MuiIcon name="Folder" size={18} className={isUserFolder ? 'text-amber-600' : 'text-purple-600'} />
          </div>
          
          {/* Nom du dossier */}
          <h3 className={`flex-1 text-sm font-semibold truncate ${isUserFolder ? 'text-amber-900' : 'text-purple-900'}`}>
            {folder.name}
          </h3>

          {/* Handle de drag (seulement pour les dossiers utilisateur) */}
          {isUserFolder && (
            <div
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="p-1 bg-amber-100 hover:bg-amber-200 rounded cursor-grab active:cursor-grabbing transition-colors"
              title="Glisser pour réorganiser"
            >
              <MuiIcon name="DragIndicator" size={12} className="text-amber-500" />
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-2.5">
        {/* Nombre de maquettes */}
        <div className={`flex items-center gap-1.5 text-[10px] mb-2 ${isUserFolder ? 'text-amber-600' : 'text-purple-600'}`}>
          <MuiIcon name="Description" size={10} />
          <span>{cockpitsCount} maquette{cockpitsCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Actions (seulement pour les dossiers utilisateur) */}
        {isUserFolder && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onRename(); }}
              className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded transition-colors text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700"
            >
              <MuiIcon name="Edit" size={12} />
              Renommer
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`p-1 rounded transition-colors ${
                cockpitsCount > 0 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
              }`}
              title={cockpitsCount > 0 ? 'Le répertoire doit être vide pour être supprimé' : 'Supprimer'}
              disabled={cockpitsCount > 0}
            >
              <MuiIcon name="Delete" size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Composant droppable pour le breadcrumb "Mes maquettes"
function DroppableBreadcrumb({ 
  isActive, 
  onNavigate,
  isDragging 
}: { 
  isActive: boolean; 
  onNavigate: () => void;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'breadcrumb-root',
  });

  return (
    <h2 
      ref={setNodeRef}
      className={`text-2xl font-bold transition-all duration-200 ${
        isActive 
          ? 'text-slate-500 cursor-pointer hover:text-[#1E3A5F]' 
          : 'text-[#1E3A5F]'
      } ${isDragging && isActive ? 'px-3 py-1 rounded-lg border-2 border-dashed' : ''} ${
        isOver && isDragging
          ? 'bg-blue-500/20 border-blue-500 text-blue-600 scale-105' 
          : isDragging && isActive 
            ? 'border-slate-400/50 bg-slate-100/50' 
            : ''
      }`}
      onClick={() => isActive && onNavigate()}
      title={isDragging && isActive ? 'Déposer ici pour remettre à la racine' : undefined}
    >
      Mes maquettes
      {isDragging && isActive && (
        <span className="ml-2 text-sm font-normal text-blue-600">
          ← Déposer ici
        </span>
      )}
    </h2>
  );
}

// Composant pour une carte de maquette sortable
function SortableCockpitCard({
  cockpit,
  navigate,
  handleUnpublish,
  getPublicBaseUrl,
  openPublishModal,
  openEditWelcomeModal,
  setNewName,
  setShowDuplicateModal,
  handleExportClick,
  setShowDeleteModal,
  formatDate
}: {
  cockpit: Cockpit;
  navigate: (path: string) => void;
  handleUnpublish: (id: string) => Promise<void>;
  getPublicBaseUrl: () => string;
  openPublishModal: (id: string) => void;
  openEditWelcomeModal: (id: string) => void;
  setNewName: (name: string) => void;
  setShowDuplicateModal: (id: string) => void;
  handleExportClick: (id: string) => void;
  setShowDeleteModal: (id: string) => void;
  formatDate: (dateString: string) => string;
}) {
  // État local pour le chargement de cette carte uniquement
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cockpit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const onUnpublish = async () => {
    setIsUnpublishing(true);
    try {
      await handleUnpublish(cockpit.id);
    } finally {
      setIsUnpublishing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-cockpit-bg-card/80 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10"
    >
      {/* En-tête avec nom cliquable et drag */}
      <div className="p-2.5 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          {/* Nom du cockpit - cliquable pour ouvrir */}
          <h3
            onClick={() => navigate(`/studio/${cockpit.id}`)}
            className="flex-1 text-sm font-semibold text-[#1E3A5F] truncate cursor-pointer hover:text-blue-600 transition-colors"
            title="Cliquer pour ouvrir"
          >
            {cockpit.name || 'Sans nom'}
          </h3>

          {/* Handle de drag */}
          <div
            {...attributes}
            {...listeners}
            className="p-1 bg-slate-700/50 hover:bg-slate-600/50 rounded cursor-grab active:cursor-grabbing transition-colors"
            title="Glisser pour réorganiser"
          >
            <MuiIcon name="DragIndicator" size={12} className="text-slate-400" />
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-2.5">
        {/* Date de modification */}
        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-2">
          <MuiIcon name="Clock" size={10} />
          <span>{formatDate(cockpit.updatedAt)}</span>
        </div>

        {/* URL publique pour les cockpits publiés */}
        {cockpit.isPublished && cockpit.publicId && (
          <div className="flex items-center gap-1 mb-2 px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px]">
            <input
              type="text"
              readOnly
              value={`${getPublicBaseUrl()}/public/${cockpit.publicId}`}
              className="flex-1 text-slate-700 bg-transparent border-none outline-none truncate"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={async () => {
                const url = `${getPublicBaseUrl()}/public/${cockpit.publicId}`;
                await navigator.clipboard.writeText(url);
              }}
              className="p-0.5 hover:bg-slate-200 rounded transition-colors"
              title="Copier l'URL"
            >
              <MuiIcon name="ContentCopy" size={10} className="text-slate-600" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {cockpit.isPublished ? (
            <>
              <button
                onClick={onUnpublish}
                className="flex items-center justify-center gap-0.5 px-1.5 py-1 rounded transition-colors text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400"
                disabled={isUnpublishing}
              >
                {isUnpublishing ? (
                  <div className="animate-spin"><MuiIcon name="Refresh" size={12} /></div>
                ) : (
                  <>
                    <MuiIcon name="Globe" size={12} />
                    Dépublier
                  </>
                )}
              </button>
              {cockpit.publicId && (
                <>
                  <button
                    onClick={() => {
                      window.open(`${getPublicBaseUrl()}/public/${cockpit.publicId}`, '_blank');
                    }}
                    className="p-1 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded transition-colors"
                    title="Ouvrir la version publiée"
                  >
                    <MuiIcon name="OpenInBrowser" size={12} />
                  </button>
                  <button
                    onClick={() => openEditWelcomeModal(cockpit.id)}
                    className={`p-1 rounded transition-colors ${
                      cockpit.welcomeMessage 
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-600/50'
                    }`}
                    title={cockpit.welcomeMessage ? "Modifier le message d'accueil" : "Ajouter un message d'accueil"}
                  >
                    <MuiIcon name="Campaign" size={12} />
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              onClick={() => openPublishModal(cockpit.id)}
              className="flex items-center justify-center gap-0.5 px-1.5 py-1 rounded transition-colors text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
            >
              <MuiIcon name="Globe" size={12} />
              Publier
            </button>
          )}
          <button
            onClick={() => {
              setNewName(cockpit.name + ' - Copie');
              setShowDuplicateModal(cockpit.id);
            }}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-600/50 rounded transition-colors"
            title="Dupliquer"
          >
            <MuiIcon name="ContentCopy" size={12} />
          </button>
          <button
            onClick={() => handleExportClick(cockpit.id)}
            className="p-1 text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
            title="Exporter"
          >
            <MuiIcon name="Download" size={12} />
          </button>
          <button
            onClick={() => setShowDeleteModal(cockpit.id)}
            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
            title="Supprimer"
          >
            <MuiIcon name="Delete" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, changePassword, changeName, changeEmail, toggleAdmin, isLoading: authLoading, error: authError, clearError } = useAuthStore();
  const { 
    cockpits, fetchCockpits, createCockpit, duplicateCockpit, deleteCockpit, publishCockpit, unpublishCockpit, exportCockpit, importCockpit, reorderCockpits, 
    folders, fetchFolders, createFolder, updateFolder, deleteFolder, reorderFolders, currentFolderId, setCurrentFolder, moveCockpitToFolder,
    isLoading 
  } = useCockpitStore();

  // Capteurs pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler pour le début du drag
  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    // Si c'est un cockpit qui est draggé
    if (!activeId.startsWith('folder-')) {
      setDraggedCockpitId(activeId);
    }
  };

  // Handler pour la fin du drag
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedCockpitId(null);

    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Si on dépose un cockpit sur un dossier
    if (!activeId.startsWith('folder-') && overId.startsWith('folder-')) {
      const folderId = overId.replace('folder-', '');
      await moveCockpitToFolder(activeId, folderId);
      return;
    }
    
    // Si on dépose un cockpit sur "Mes maquettes" (breadcrumb), le remettre à la racine
    if (!activeId.startsWith('folder-') && overId === 'breadcrumb-root') {
      await moveCockpitToFolder(activeId, null);
      return;
    }

    // Sinon, réorganisation normale
    if (active.id !== over.id) {
      // Réorganisation des cockpits
      if (!activeId.startsWith('folder-') && !overId.startsWith('folder-')) {
        const oldIndex = sortedCockpits.findIndex(c => c.id === activeId);
        const newIndex = sortedCockpits.findIndex(c => c.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(sortedCockpits, oldIndex, newIndex);
          const cockpitIds = newOrder.map(c => c.id);
          await reorderCockpits(cockpitIds);
        }
      }
      
      // Réorganisation des dossiers
      if (activeId.startsWith('folder-') && overId.startsWith('folder-')) {
        const folderId1 = activeId.replace('folder-', '');
        const folderId2 = overId.replace('folder-', '');
        const oldIndex = userFolders.findIndex(f => f.id === folderId1);
        const newIndex = userFolders.findIndex(f => f.id === folderId2);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(userFolders, oldIndex, newIndex);
          const folderIds = newOrder.map(f => f.id);
          await reorderFolders(folderIds);
        }
      }
    }
  };

  const [showNewModal, setShowNewModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [newName, setNewName] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showToggleAdminModal, setShowToggleAdminModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState<FileSystemDirectoryHandle | null>(null);
  const [useCustomDirectory, setUseCustomDirectory] = useState(false);
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const { token } = useAuthStore();
  
  // États pour le message d'accueil (publication)
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);
  const [publishWelcomeMessage, setPublishWelcomeMessage] = useState('');
  const [showEditWelcomeModal, setShowEditWelcomeModal] = useState<string | null>(null);
  const [editWelcomeMessage, setEditWelcomeMessage] = useState('');
  
  // États pour les répertoires
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameFolderModal, setShowRenameFolderModal] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [draggedCockpitId, setDraggedCockpitId] = useState<string | null>(null);

  useEffect(() => {
    fetchCockpits();
    fetchFolders();
    fetchSystemPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Ne pas inclure les fonctions dans les dépendances pour éviter les rechargements inutiles
  
  // Répertoire courant (pour la navigation)
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;
  
  // Filtrer les cockpits selon le répertoire courant
  const filteredCockpits = useMemo(() => {
    if (currentFolderId) {
      // Dans un répertoire : afficher les maquettes de ce répertoire
      return cockpits.filter(c => c.folderId === currentFolderId);
    }
    // À la racine : afficher les maquettes sans répertoire
    return cockpits.filter(c => !c.folderId && c.userId === user?.id);
  }, [cockpits, currentFolderId, user?.id]);

  // Trier les cockpits filtrés par ordre (si défini) ou par date de mise à jour
  const sortedCockpits = useMemo(() => {
    return [...filteredCockpits].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filteredCockpits]);

  // Répertoires de l'utilisateur (triés)
  const userFolders = useMemo(() => {
    return folders
      .filter(f => f.userId === user?.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [folders, user?.id]);
  
  // Pour les admins : répertoires virtuels pour les autres comptes
  const otherUsersFolders = useMemo(() => {
    if (!user?.isAdmin) return [];
    
    // Récupérer les userIds des cockpits qui ne sont pas à nous
    const otherUserIds = [...new Set(cockpits.filter(c => c.userId !== user?.id).map(c => c.userId))];
    
    return otherUserIds.map(userId => ({
      id: `user-${userId}`,
      userId,
      name: `Compte ${userId.substring(0, 8)}...`,
      cockpitsCount: cockpits.filter(c => c.userId === userId).length,
    }));
  }, [cockpits, user?.id, user?.isAdmin]);

  const fetchSystemPrompt = async () => {
    try {
      const response = await fetch('/api/ai/system-prompt', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.prompt || '');
      }
    } catch (error) {
      console.error('Erreur récupération prompt système:', error);
    }
  };

  const saveSystemPrompt = async () => {
    try {
      const response = await fetch('/api/ai/system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: systemPrompt }),
      });
      if (response.ok) {
        setShowSystemPromptModal(false);
        alert('Prompt système sauvegardé avec succès');
      } else {
        alert('Erreur lors de la sauvegarde du prompt système');
      }
    } catch (error) {
      console.error('Erreur sauvegarde prompt système:', error);
      alert('Erreur lors de la sauvegarde du prompt système');
    }
  };

  const handleExport = async (id: string, fileName?: string) => {
    try {
      await exportCockpit(id, fileName, useCustomDirectory ? selectedDirectory : null);
      setShowExportModal(null);
      setExportFileName('');
      setSelectedDirectory(null);
      setUseCustomDirectory(false);
    } catch (error) {
      console.error('Erreur export:', error);
    }
  };

  const handleExportClick = (id: string) => {
    const cockpit = cockpits.find(c => c.id === id);
    if (cockpit) {
      // Nom par défaut : "YYYYMMDD SOMONE MAQ NomMaquette vX.Y.Z HHMMSS"
      const now = new Date();
      const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const year = parisTime.getFullYear();
      const month = String(parisTime.getMonth() + 1).padStart(2, '0');
      const day = String(parisTime.getDate()).padStart(2, '0');
      const hours = String(parisTime.getHours()).padStart(2, '0');
      const minutes = String(parisTime.getMinutes()).padStart(2, '0');
      const seconds = String(parisTime.getSeconds()).padStart(2, '0');
      const dateStamp = `${year}${month}${day}`;
      const timeStamp = `${hours}${minutes}${seconds}`;
      const sanitizedName = cockpit.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      const defaultName = `${dateStamp} SOMONE MAQ ${sanitizedName} v${APP_VERSION} ${timeStamp}`;
      setExportFileName(defaultName);
      setShowExportModal(id);
      setSelectedDirectory(null);
      setUseCustomDirectory(false);
    }
  };

  const handleChooseDirectory = async () => {
    try {
      // Vérifier si l'API File System Access est disponible
      if (!('showDirectoryPicker' in window)) {
        alert('Cette fonctionnalité n\'est pas disponible dans votre navigateur. Utilisez Chrome, Edge ou un autre navigateur moderne.');
        return;
      }

      const directoryHandle = await (window as any).showDirectoryPicker();
      setSelectedDirectory(directoryHandle);
      setUseCustomDirectory(true);
    } catch (error: any) {
      // L'utilisateur a annulé la sélection
      if (error.name !== 'AbortError') {
        console.error('Erreur lors de la sélection du répertoire:', error);
        alert('Erreur lors de la sélection du répertoire: ' + error.message);
      }
    }
  };

  // Vérifier si l'API File System Access est disponible
  const isFileSystemAccessAvailable = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedCockpit = await importCockpit(file);
      if (importedCockpit) {
        // Ne pas recharger - importCockpit met déjà à jour le store localement
        // Cela préserve l'ordre des cockpits après un drag & drop
      }
    } catch (error) {
      console.error('Erreur import:', error);
    } finally {
      // Réinitialiser l'input pour permettre de réimporter le mÃªme fichier
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const cockpit = await createCockpit(newName.trim());
    if (cockpit) {
      // Ne pas recharger - createCockpit met déjà à jour le store localement
      // Cela préserve l'ordre des cockpits après un drag & drop
    }
    setShowNewModal(false);
    setNewName('');
  };

  const handleDuplicate = async (id: string) => {
    if (!newName.trim()) return;
    await duplicateCockpit(id, newName.trim());
    // Ne pas naviguer automatiquement - rester sur la page d'accueil
    setShowDuplicateModal(null);
    setNewName('');
  };

  const handleDelete = async (id: string) => {
    await deleteCockpit(id);
    setShowDeleteModal(null);
  };

  // URL de base pour les publications (Vercel en production, local en dev)
  const getPublicBaseUrl = () => {
    // Si on est sur Vercel ou en production
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
    // En développement, utiliser l'URL Vercel si disponible
    return 'https://somone-cockpit-studio.vercel.app';
  };

  // Ouvre le modal pour publier avec un message d'accueil
  const openPublishModal = (id: string) => {
    const cockpit = cockpits.find(c => c.id === id);
    setPublishWelcomeMessage(cockpit?.welcomeMessage || '');
    setShowPublishModal(id);
  };
  
  // Effectue la publication avec le message
  const handlePublish = async (id: string, welcomeMessage?: string) => {
    const result = await publishCockpit(id, welcomeMessage);
    setShowPublishModal(null);
    setPublishWelcomeMessage('');
    // Recharger la liste pour mettre à jour l'affichage
    await fetchCockpits();
    return result;
  };
  
  // Ouvre le modal pour éditer le message d'accueil
  const openEditWelcomeModal = (id: string) => {
    const cockpit = cockpits.find(c => c.id === id);
    setEditWelcomeMessage(cockpit?.welcomeMessage || '');
    setShowEditWelcomeModal(id);
  };
  
  // Sauvegarde le message d'accueil modifié
  const handleSaveWelcomeMessage = async (id: string) => {
    const { updateWelcomeMessage } = useCockpitStore.getState();
    await updateWelcomeMessage(id, editWelcomeMessage || null);
    setShowEditWelcomeModal(null);
    setEditWelcomeMessage('');
    // Recharger pour avoir les données à jour
    fetchCockpits();
  };

  const handleUnpublish = async (id: string) => {
    await unpublishCockpit(id);
    // Recharger la liste pour mettre à jour l'affichage
    await fetchCockpits();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) return;

    clearError();
    const success = await changePassword(oldPassword, newPassword);
    if (success) {
      setShowChangePasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Afficher un message de succès (optionnel)
      alert('Mot de passe changé avec succès');
    }
  };

  const handleToggleAdmin = async () => {
    // Si l'utilisateur est déjà admin, on peut quitter sans code
    if (user?.isAdmin) {
      clearError();
      const success = await toggleAdmin('');
      if (success) {
        setShowToggleAdminModal(false);
        setAdminCode('');
        // Le store met à jour automatiquement le user
      }
      return;
    }

    // Sinon, nécessite le code
    if (!adminCode) return;

    clearError();
    const success = await toggleAdmin(adminCode);
    if (success) {
      setShowToggleAdminModal(false);
      setAdminCode('');
      // Le store met à jour automatiquement le user
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cockpit-bg-dark via-slate-900 to-cockpit-bg-dark">
      {/* Header */}
      <header className="bg-cockpit-nav-bg/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MuiIcon name="Dashboard" size={32} className="text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-white">SOMONE Cockpit Studio</h1>
              <p className="text-xs text-white/80">Studio de création de maquettes · {VERSION_DISPLAY}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Infos utilisateur - 3 lignes superposées */}
            <div className="text-right mr-2 leading-none">
              <p className="text-[11px] font-semibold text-white truncate max-w-[160px]">
                {user?.name || user?.username}
              </p>
              <p className="text-[10px] text-white/80 truncate max-w-[160px]">
                {user?.username}
              </p>
              <p className="text-[9px] text-white/60 font-mono">
                ID: {user?.id}
              </p>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300">{user?.username}</span>
                {user?.isAdmin && (
                  <MuiIcon name="Shield" size={16} className="text-amber-400" />
                )}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-cockpit-bg-card border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
                      <p className="text-xs text-slate-300 mb-1 font-medium">Connecté en tant que</p>
                      <p className="text-white font-bold text-lg">{user?.username}</p>
                      {user?.isAdmin && (
                        <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-amber-500/30 text-amber-300 text-xs rounded-full font-semibold border border-amber-500/50">
                          <MuiIcon name="ShieldIcon" size={14} />
                          Administrateur
                        </span>
                      )}
                    </div>
                    <div className="p-2 bg-slate-900/50">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setEditName(user?.name || '');
                          setShowChangeNameModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white font-semibold hover:bg-green-600/30 rounded-lg transition-colors text-left border border-transparent hover:border-green-500/50 mb-2"
                      >
                        <MuiIcon name="Person" size={18} className="text-green-400" />
                        <span className="text-base">Modifier mon nom</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setEditEmail(user?.username || '');
                          setShowChangeEmailModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white font-semibold hover:bg-purple-600/30 rounded-lg transition-colors text-left border border-transparent hover:border-purple-500/50 mb-2"
                      >
                        <MuiIcon name="Email" size={18} className="text-purple-400" />
                        <span className="text-base">Modifier mon email</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowChangePasswordModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white font-semibold hover:bg-blue-600/30 rounded-lg transition-colors text-left border border-transparent hover:border-blue-500/50 mb-2"
                      >
                        <MuiIcon name="VpnKey" size={18} className="text-blue-400" />
                        <span className="text-base">Changer le mot de passe</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowToggleAdminModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white font-semibold hover:bg-amber-600/30 rounded-lg transition-colors text-left border border-transparent hover:border-amber-500/50 mb-2"
                      >
                        <MuiIcon name="Settings" size={18} className="text-amber-400" />
                        <span className="text-base">{user?.isAdmin ? 'Quitter le mode admin' : 'Passer administrateur'}</span>
                      </button>
                      <hr className="my-3 border-slate-700" />
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white font-semibold hover:bg-red-600/30 rounded-lg transition-colors text-left border border-transparent hover:border-red-500/50"
                      >
                        <MuiIcon name="Logout" size={18} className="text-red-400" />
                        <span className="text-base">Déconnexion</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        {/* Section Header avec Breadcrumb */}
        <div className="flex items-center justify-between mb-8">
          <div>
            {/* Breadcrumb avec zone de drop */}
            <div className="flex items-center gap-2 mb-1">
              <DroppableBreadcrumb 
                isActive={!!currentFolderId} 
                onNavigate={() => setCurrentFolder(null)}
                isDragging={!!draggedCockpitId}
              />
              {currentFolder && (
                <>
                  <MuiIcon name="ChevronRight" size={24} className="text-slate-400" />
                  <h2 className="text-2xl font-bold text-[#1E3A5F]">{currentFolder.name}</h2>
                </>
              )}
            </div>
            <p className="text-slate-400">
              {currentFolderId 
                ? `${filteredCockpits.length} maquette${filteredCockpits.length !== 1 ? 's' : ''} dans ce répertoire`
                : `${filteredCockpits.length} maquette${filteredCockpits.length !== 1 ? 's' : ''} disponible${filteredCockpits.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Bouton Mes cockpits publiés (uniquement à la racine) */}
            {!currentFolderId && user?.id && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/public/user/${user.id}`;
                  window.open(url, '_blank');
                }}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-500/25"
                title="Voir et partager la liste de vos cockpits publiés"
              >
                <MuiIcon name="Share" size={20} />
                Mes publications
              </button>
            )}
            {/* Bouton Nouveau répertoire (uniquement à la racine) */}
            {!currentFolderId && (
              <button
                onClick={() => {
                  setNewFolderName('');
                  setShowNewFolderModal(true);
                }}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-500/25"
              >
                <MuiIcon name="CreateNewFolder" size={20} />
                Nouveau répertoire
              </button>
            )}
            <input
              type="file"
              accept=".json"
              ref={importFileInputRef}
              onChange={handleImport}
              className="hidden"
              id="import-cockpit-input"
            />
            <label
              htmlFor="import-cockpit-input"
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-green-500/25 cursor-pointer"
            >
              <MuiIcon name="Upload" size={20} />
              Importer
            </label>
            <button
              onClick={() => {
                setShowSystemPromptModal(true);
                fetchSystemPrompt();
              }}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-500/25"
              title="Configurer le prompt système de l'IA"
            >
              <MuiIcon name="Settings" size={20} />
              <span>Prompt IA</span>
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/25"
            >
              <MuiIcon name="Plus" size={20} />
              Nouvelle maquette
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && cockpits.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin"><MuiIcon name="Refresh" size={32} className="text-blue-400" /></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredCockpits.length === 0 && userFolders.length === 0 && !currentFolderId && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MuiIcon name="Dashboard" size={40} className="text-slate-600" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Aucune maquette</h3>
            <p className="text-slate-400 mb-6">Créez votre première maquette de cockpit</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
            >
              <MuiIcon name="Plus" size={20} />
              Créer une maquette
            </button>
          </div>
        )}

        {/* Grid avec Drag & Drop (Répertoires + Maquettes) */}
          <SortableContext
            items={[
              ...userFolders.map(f => `folder-${f.id}`),
              ...sortedCockpits.map(c => c.id)
            ]}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Répertoires de l'utilisateur (uniquement à la racine) */}
              {!currentFolderId && userFolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onClick={() => setCurrentFolder(folder.id)}
                  onRename={() => {
                    setRenameFolderName(folder.name);
                    setShowRenameFolderModal(folder.id);
                  }}
                  onDelete={async () => {
                    const success = await deleteFolder(folder.id);
                    if (!success) {
                      alert('Le répertoire doit être vide pour être supprimé');
                    }
                  }}
                  cockpitsCount={cockpits.filter(c => c.folderId === folder.id).length}
                  isUserFolder={true}
                  isDraggingCockpit={!!draggedCockpitId}
                />
              ))}
              
              {/* Maquettes */}
              {sortedCockpits.map((cockpit) => (
                <SortableCockpitCard
                  key={cockpit.id}
                  cockpit={cockpit}
                  navigate={navigate}
                  handleUnpublish={handleUnpublish}
                  getPublicBaseUrl={getPublicBaseUrl}
                  openPublishModal={openPublishModal}
                  openEditWelcomeModal={openEditWelcomeModal}
                  setNewName={setNewName}
                  setShowDuplicateModal={setShowDuplicateModal}
                  handleExportClick={handleExportClick}
                  setShowDeleteModal={setShowDeleteModal}
                  formatDate={formatDate}
                />
              ))}
              
              {/* Répertoires des autres comptes (pour admins, à la racine uniquement) */}
              {!currentFolderId && user?.isAdmin && otherUsersFolders.map((userFolder) => (
                <div
                  key={userFolder.id}
                  className="group bg-purple-50 border border-purple-200 rounded-xl overflow-hidden transition-all duration-300 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-200/30 cursor-pointer"
                  onClick={() => {
                    // TODO: Navigation vers les maquettes de ce compte
                    alert(`Affichage des ${userFolder.cockpitsCount} maquettes du compte ${userFolder.userId}`);
                  }}
                >
                  <div className="p-2.5 border-b border-purple-200">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-100">
                        <MuiIcon name="AccountCircle" size={18} className="text-purple-600" />
                      </div>
                      <h3 className="flex-1 text-sm font-semibold text-purple-900 truncate">
                        {userFolder.name}
                      </h3>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-600">
                      <MuiIcon name="Description" size={10} />
                      <span>{userFolder.cockpitsCount} maquette{userFolder.cockpitsCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
          
        </DndContext>
      </main>

      {/* Modal: Nouveau répertoire */}
      {showNewFolderModal && (
        <Modal
          title="Nouveau répertoire"
          onClose={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
          onConfirm={async () => {
            if (newFolderName.trim()) {
              await createFolder(newFolderName.trim());
              setShowNewFolderModal(false);
              setNewFolderName('');
            }
          }}
          confirmText="Créer"
          isLoading={isLoading}
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nom du répertoire"
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </Modal>
      )}

      {/* Modal: Renommer répertoire */}
      {showRenameFolderModal && (
        <Modal
          title="Renommer le répertoire"
          onClose={() => { setShowRenameFolderModal(null); setRenameFolderName(''); }}
          onConfirm={async () => {
            if (renameFolderName.trim() && showRenameFolderModal) {
              await updateFolder(showRenameFolderModal, renameFolderName.trim());
              setShowRenameFolderModal(null);
              setRenameFolderName('');
            }
          }}
          confirmText="Renommer"
          isLoading={isLoading}
        >
          <input
            type="text"
            value={renameFolderName}
            onChange={(e) => setRenameFolderName(e.target.value)}
            placeholder="Nouveau nom"
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </Modal>
      )}

      {/* Modal: Nouvelle maquette */}
      {showNewModal && (
        <Modal
          title="Nouvelle maquette"
          onClose={() => { setShowNewModal(false); setNewName(''); }}
          onConfirm={handleCreate}
          confirmText="Créer"
          isLoading={isLoading}
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la maquette"
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </Modal>
      )}

      {/* Modal: Dupliquer */}
      {showDuplicateModal && (
        <Modal
          title="Dupliquer la maquette"
          onClose={() => { setShowDuplicateModal(null); setNewName(''); }}
          onConfirm={() => handleDuplicate(showDuplicateModal)}
          confirmText="Dupliquer"
          isLoading={isLoading}
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la copie"
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </Modal>
      )}

      {/* Modal: Supprimer */}
      {showDeleteModal && (
        <Modal
          title="Supprimer la maquette"
          onClose={() => setShowDeleteModal(null)}
          onConfirm={() => handleDelete(showDeleteModal)}
          confirmText="Supprimer"
          confirmVariant="danger"
          isLoading={isLoading}
        >
          <p className="text-slate-300">
            ÃŠtes-vous sÃ»r de vouloir supprimer cette maquette ? Cette action est irréversible.
          </p>
        </Modal>
      )}


      {/* Modal: Exporter */}
      {showExportModal && (
        <Modal
          title="Exporter la maquette"
          onClose={() => {
            setShowExportModal(null);
            setExportFileName('');
            setSelectedDirectory(null);
            setUseCustomDirectory(false);
          }}
          onConfirm={() => {
            if (showExportModal) {
              handleExport(showExportModal, exportFileName);
            }
          }}
          confirmText="Exporter"
          isLoading={isLoading}
        >
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Choisissez le nom du fichier à exporter. Le fichier sera téléchargé dans votre dossier de téléchargements par défaut.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Nom du fichier
              </label>
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="nom_du_fichier"
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                L'extension .json sera ajoutée automatiquement
              </p>
            </div>

            {/* Choix du répertoire de sauvegarde */}
            {isFileSystemAccessAvailable && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Répertoire de sauvegarde
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="export-default-dir"
                      name="export-directory"
                      checked={!useCustomDirectory}
                      onChange={() => {
                        setUseCustomDirectory(false);
                        setSelectedDirectory(null);
                      }}
                      className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                    />
                    <label htmlFor="export-default-dir" className="text-sm text-slate-300 cursor-pointer">
                      Dossier de téléchargements par défaut
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="export-custom-dir"
                      name="export-directory"
                      checked={useCustomDirectory}
                      onChange={() => {
                        if (!selectedDirectory) {
                          handleChooseDirectory();
                        } else {
                          setUseCustomDirectory(true);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                    />
                    <label htmlFor="export-custom-dir" className="text-sm text-slate-300 cursor-pointer flex-1">
                      Choisir un répertoire personnalisé
                    </label>
                    {selectedDirectory && (
                      <button
                        onClick={handleChooseDirectory}
                        className="px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors"
                      >
                        Changer
                      </button>
                    )}
                  </div>
                  {selectedDirectory && (
                    <div className="ml-7 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-xs text-green-400 flex items-center gap-2">
                        <MuiIcon name="CheckCircle" size={14} />
                        Répertoire sélectionné: <span className="font-mono text-green-300">{(selectedDirectory as any).name}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-2">
                <MuiIcon name="Info" size={16} className="text-blue-400 mt-0.5" />
                <p className="text-xs text-blue-300">
                  Le fichier contiendra toutes les données de la maquette, y compris les images de fond encodées en base64.
                  {!isFileSystemAccessAvailable && (
                    <span className="block mt-1 text-blue-400/80">
                      Pour choisir un répertoire personnalisé, utilisez Chrome, Edge ou un autre navigateur moderne.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Publier avec message d'accueil */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="Globe" size={20} className="text-blue-400" />
                Publier la maquette
              </h3>
              <button
                onClick={() => { setShowPublishModal(null); setPublishWelcomeMessage(''); }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="Close" size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message d'accueil (optionnel)
                </label>
                <textarea
                  value={publishWelcomeMessage}
                  onChange={(e) => setPublishWelcomeMessage(e.target.value)}
                  placeholder="Ce message s'affichera à chaque ouverture du cockpit publié..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Les visiteurs verront ce message dans un popup avant d'accéder au cockpit.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowPublishModal(null); setPublishWelcomeMessage(''); }}
                    className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      if (showPublishModal) {
                        await handlePublish(showPublishModal, publishWelcomeMessage || undefined);
                      }
                    }}
                    disabled={isLoading || !publishWelcomeMessage.trim()}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>
                    ) : (
                      <>
                        <MuiIcon name="Campaign" size={16} />
                        Publier avec message
                      </>
                    )}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    if (showPublishModal) {
                      await handlePublish(showPublishModal, undefined);
                    }
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>
                  ) : (
                    <>
                      <MuiIcon name="Globe" size={16} />
                      Publier sans message
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modifier le message d'accueil */}
      {showEditWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="Campaign" size={20} className="text-amber-400" />
                Message d'accueil
              </h3>
              <button
                onClick={() => { setShowEditWelcomeModal(null); setEditWelcomeMessage(''); }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="Close" size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message affiché aux visiteurs
                </label>
                <textarea
                  value={editWelcomeMessage}
                  onChange={(e) => setEditWelcomeMessage(e.target.value)}
                  placeholder="Ce message s'affichera à chaque ouverture du cockpit publié..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Laissez vide pour supprimer le message d'accueil.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowEditWelcomeModal(null); setEditWelcomeMessage(''); }}
                  className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    if (showEditWelcomeModal) {
                      await handleSaveWelcomeMessage(showEditWelcomeModal);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <MuiIcon name="Save" size={16} />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Changer le nom */}
      {showChangeNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="Person" size={20} className="text-green-400" />
                Modifier mon nom
              </h3>
              <button
                onClick={() => { setShowChangeNameModal(false); clearError(); }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{authError}</p>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Nouveau nom</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
                  placeholder="Entrez votre nom"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700/50">
              <button
                onClick={() => { setShowChangeNameModal(false); clearError(); }}
                className="flex-1 px-4 py-3 text-slate-400 hover:text-white border border-slate-600/50 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (editName.trim().length >= 2) {
                    const success = await changeName(editName.trim());
                    if (success) {
                      setShowChangeNameModal(false);
                      clearError();
                    }
                  }
                }}
                disabled={authLoading || editName.trim().length < 2}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {authLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Changer l'email */}
      {showChangeEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="Email" size={20} className="text-purple-400" />
                Modifier mon email
              </h3>
              <button
                onClick={() => { setShowChangeEmailModal(false); clearError(); }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{authError}</p>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Nouvel email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  placeholder="Entrez votre email"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-700/50">
              <button
                onClick={() => { setShowChangeEmailModal(false); clearError(); }}
                className="flex-1 px-4 py-3 text-slate-400 hover:text-white border border-slate-600/50 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (editEmail.includes('@')) {
                    const success = await changeEmail(editEmail.trim());
                    if (success) {
                      setShowChangeEmailModal(false);
                      clearError();
                    }
                  }
                }}
                disabled={authLoading || !editEmail.includes('@')}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {authLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Changer le mot de passe */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="VpnKey" size={20} className="text-blue-400" />
                Changer le mot de passe
              </h3>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  clearError();
                }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{authError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-2">Ancien mot de passe</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Entrez votre ancien mot de passe"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Entrez votre nouveau mot de passe"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Confirmez votre nouveau mot de passe"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleChangePassword();
                    }
                  }}
                />
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-sm text-amber-400">Les mots de passe ne correspondent pas</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700/50">
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  clearError();
                }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={authLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleChangePassword}
                disabled={authLoading || !oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {authLoading && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
                Changer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Toggle Admin */}
      {showToggleAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="Settings" size={20} className="text-blue-400" />
                {user?.isAdmin ? 'Quitter le mode administrateur' : 'Activer le mode administrateur'}
              </h3>
              <button
                onClick={() => {
                  setShowToggleAdminModal(false);
                  setAdminCode('');
                  clearError();
                }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{authError}</p>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <MuiIcon name="Info" size={20} className="text-amber-400" />
                <p className="text-sm text-amber-300">
                  {user?.isAdmin
                    ? 'Vous allez quitter le mode administrateur. Vous perdrez les privilèges d\'administration.'
                    : 'Entrez le code administrateur pour activer les privilèges d\'administration.'}
                </p>
              </div>

              {!user?.isAdmin && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Code administrateur</label>
                  <input
                    type="password"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="Entrez le code administrateur"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleToggleAdmin();
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700/50">
              <button
                onClick={() => {
                  setShowToggleAdminModal(false);
                  setAdminCode('');
                  clearError();
                }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={authLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleToggleAdmin}
                disabled={authLoading || (!user?.isAdmin && !adminCode)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {authLoading && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
                {user?.isAdmin ? 'Quitter le mode admin' : 'Activer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Prompt Système IA */}
      {showSystemPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white">Prompt Système de l'IA</h3>
              <button
                onClick={() => setShowSystemPromptModal(false)}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-slate-400 mb-4">
                Ce prompt sera utilisé en première instruction pour toutes les interactions avec l'IA du studio.
                Il définit les principes et objectifs de création des cockpits.
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={15}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Définissez ici les principes et objectifs de l'IA pour la création de cockpits..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700/50">
              <button
                onClick={() => setShowSystemPromptModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveSystemPrompt}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all flex items-center gap-2"
              >
                <MuiIcon name="Save" size={16} />
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-cockpit-nav-bg/50 border-t border-slate-700/50 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-white/80">
            SOMONE Cockpit Studio {VERSION_DISPLAY}
          </p>
        </div>
      </footer>
    </div>
  );
}

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmText: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
}

function Modal({ title, children, onClose, onConfirm, confirmText, confirmVariant = 'primary', isLoading }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white transition-colors"
          >
            <MuiIcon name="X" size={20} />
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${confirmVariant === 'danger'
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
              } disabled:opacity-50`}
          >
            {isLoading && <div className="animate-spin"><MuiIcon name="Refresh" size={16} /></div>}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

