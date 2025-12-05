import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from '../components/IconPicker';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { cockpits, fetchCockpits, createCockpit, duplicateCockpit, deleteCockpit, publishCockpit, unpublishCockpit, isLoading } = useCockpitStore();
  
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [newName, setNewName] = useState('');
  
  useEffect(() => {
    fetchCockpits();
  }, [fetchCockpits]);
  
  const handleCreate = async () => {
    if (!newName.trim()) return;
    const cockpit = await createCockpit(newName.trim());
    if (cockpit) {
      navigate(`/studio/${cockpit.id}`);
    }
    setShowNewModal(false);
    setNewName('');
  };
  
  const handleDuplicate = async (id: string) => {
    if (!newName.trim()) return;
    const cockpit = await duplicateCockpit(id, newName.trim());
    if (cockpit) {
      navigate(`/studio/${cockpit.id}`);
    }
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
    return 'https://somone-cockpit.vercel.app';
  };
  
  const handlePublish = async (id: string) => {
    const result = await publishCockpit(id);
    if (result) {
      const url = `${getPublicBaseUrl()}/public/${result.publicId}`;
      setPublishedUrl(url);
    }
  };
  
  const handleUnpublish = async (id: string) => {
    await unpublishCockpit(id);
    setShowPublishModal(null);
    setPublishedUrl(null);
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-cockpit-bg-dark via-slate-900 to-cockpit-bg-dark">
      {/* Header */}
      <header className="bg-cockpit-nav-bg/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MuiIcon name="Dashboard" size={32} className="text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-white">SOMONE Cockpit Studio</h1>
              <p className="text-xs text-slate-500">Studio de création de maquettes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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
                <MuiIcon name="ShieldIcon" size={16} className="text-amber-400" />
              )}
            </button>
            
            {showUserMenu && (
              <>
                <div className="fixed inset-0" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-cockpit-bg-card border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-3 border-b border-slate-700/50">
                    <p className="text-sm text-slate-400">Connecté en tant que</p>
                    <p className="text-white font-medium">{user?.username}</p>
                    {user?.isAdmin && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                        <MuiIcon name="ShieldIcon" size={12} />
                        Administrateur
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors text-left">
                      <MuiIcon name="KeyRound" size={16} />
                      Changer le mot de passe
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors text-left">
                      <MuiIcon name="SettingsIcon" size={16} />
                      {user?.isAdmin ? 'Quitter le mode admin' : 'Passer administrateur'}
                    </button>
                    <hr className="my-2 border-slate-700/50" />
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                    >
                      <MuiIcon name="LogOut" size={16} />
                      Déconnexion
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
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Mes maquettes</h2>
            <p className="text-slate-400">
              {cockpits.length} maquette{cockpits.length !== 1 ? 's' : ''} disponible{cockpits.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/25"
          >
            <MuiIcon name="Plus" size={20} />
            Nouvelle maquette
          </button>
        </div>
        
        {/* Loading State */}
        {isLoading && cockpits.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin"><MuiIcon name="Loader2" size={32} className="text-blue-400" /></div>
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && cockpits.length === 0 && (
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
        
        {/* Cockpits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cockpits.map((cockpit) => (
            <div
              key={cockpit.id}
              className="group bg-cockpit-bg-card/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
            >
              {/* Preview Area */}
              <div 
                onClick={() => navigate(`/studio/${cockpit.id}`)}
                className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center cursor-pointer relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-cockpit-bg-card/80 to-transparent" />
                <MuiIcon name="Dashboard" size={48} className="text-slate-700 group-hover:text-slate-600 transition-colors" />
                
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium">
                    Ouvrir
                    <MuiIcon name="ChevronRightIcon" size={16} />
                  </span>
                </div>
              </div>
              
              {/* Info */}
              <div className="p-5">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2 truncate">
                  {cockpit.name || 'Sans nom'}
                </h3>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                  <MuiIcon name="Clock" size={16} />
                  <span>Modifié le {formatDate(cockpit.updatedAt)}</span>
                </div>
                
                {/* Badge publié */}
                {cockpit.isPublished && (
                  <div className="flex items-center gap-2 mb-3 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <MuiIcon name="Globe" size={14} className="text-green-400" />
                    <span className="text-xs text-green-400">Publié</span>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowPublishModal(cockpit.id);
                      if (cockpit.isPublished && cockpit.publicId) {
                        setPublishedUrl(`${getPublicBaseUrl()}/public/${cockpit.publicId}`);
                      } else {
                        setPublishedUrl(null);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                      cockpit.isPublished
                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                        : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                    }`}
                  >
                    <MuiIcon name="Globe" size={16} />
                    {cockpit.isPublished ? 'Gérer' : 'Publier'}
                  </button>
                  <button
                    onClick={() => {
                      setNewName(cockpit.name + ' - Copie');
                      setShowDuplicateModal(cockpit.id);
                    }}
                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-600/50 rounded-lg transition-colors"
                    title="Dupliquer"
                  >
                    <MuiIcon name="CopyIcon" size={16} />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(cockpit.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <MuiIcon name="Trash2" size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      
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
            Êtes-vous sûr de vouloir supprimer cette maquette ? Cette action est irréversible.
          </p>
        </Modal>
      )}
      
      {/* Modal: Publier */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cockpit-bg-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MuiIcon name="Globe" size={20} className="text-blue-400" />
                Publication
              </h3>
              <button
                onClick={() => { setShowPublishModal(null); setPublishedUrl(null); }}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <MuiIcon name="X" size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {(() => {
                const cockpit = cockpits.find(c => c.id === showPublishModal);
                const isPublished = cockpit?.isPublished;
                
                if (isPublished && publishedUrl) {
                  return (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <MuiIcon name="CheckCircle" size={20} className="text-green-400" />
                        <span className="text-green-400 font-medium">Cette maquette est publiée</span>
                      </div>
                      
                      <div>
                        <p className="text-sm text-slate-400 mb-2">URL publique :</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={publishedUrl}
                            readOnly
                            className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-sm"
                          />
                          <button
                            onClick={() => copyToClipboard(publishedUrl)}
                            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                            title="Copier"
                          >
                            <MuiIcon name="CopyIcon" size={18} />
                          </button>
                          <a
                            href={publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            title="Ouvrir"
                          >
                            <MuiIcon name="ExternalLink" size={18} />
                          </a>
                        </div>
                      </div>
                      
                      <p className="text-xs text-slate-500">
                        Cette URL permet à n'importe qui d'accéder à votre maquette en mode lecture seule.
                      </p>
                      
                      <button
                        onClick={() => handleUnpublish(showPublishModal)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-colors"
                      >
                        <MuiIcon name="EyeOff" size={16} />
                        Dépublier
                      </button>
                    </>
                  );
                }
                
                return (
                  <>
                    <p className="text-slate-300">
                      Publier cette maquette la rendra accessible via une URL publique. 
                      N'importe qui disposant du lien pourra consulter le cockpit en mode lecture seule.
                    </p>
                    
                    <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <MuiIcon name="Info" size={20} className="text-blue-400" />
                      <p className="text-sm text-blue-300">
                        Le cockpit publié ne sera pas modifiable par les visiteurs.
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handlePublish(showPublishModal)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="animate-spin"><MuiIcon name="Loader2" size={18} /></div>
                      ) : (
                        <MuiIcon name="Globe" size={18} />
                      )}
                      Publier maintenant
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
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
            className={`px-5 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            } disabled:opacity-50`}
          >
            {isLoading && <div className="animate-spin"><MuiIcon name="Loader2" size={16} /></div>}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


