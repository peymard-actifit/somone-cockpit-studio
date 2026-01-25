import { useState, useEffect } from 'react';
import { useAuthStore, UserListItem } from '../store/authStore';
import { MuiIcon } from './IconPicker';
import type { UserType } from '../types';

// Génération de QR Code simple en SVG (sans dépendance externe)
function generateQRCodeSVG(text: string, size: number = 200): string {
  // Version simplifiée - on affiche l'URL en texte avec un cadre stylisé
  // Pour un vrai QR code, il faudrait une lib comme qrcode
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <svg width="${size}" height="${size + 60}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="white" stroke="#1E3A5F" stroke-width="4" rx="8"/>
      <rect x="20" y="20" width="${size - 40}" height="${size - 40}" fill="#f0f0f0" rx="4"/>
      <text x="${size / 2}" y="${size / 2 - 10}" text-anchor="middle" font-size="12" fill="#1E3A5F" font-family="monospace">
        QR Code
      </text>
      <text x="${size / 2}" y="${size / 2 + 10}" text-anchor="middle" font-size="10" fill="#666" font-family="sans-serif">
        Copiez l'URL ci-dessous
      </text>
      <foreignObject x="5" y="${size + 5}" width="${size - 10}" height="50">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 8px; word-break: break-all; color: #1E3A5F; font-family: monospace;">
          ${escaped}
        </div>
      </foreignObject>
    </svg>
  `;
}

interface UserManagementProps {
  onClose: () => void;
}

export default function UserManagement({ onClose }: UserManagementProps) {
  const { user: currentUser, fetchUsers, createUser, updateUser, deleteUser, generateResetToken, isLoading, error, clearError } = useAuthStore();
  
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // QR Code
  const [qrCodeData, setQrCodeData] = useState<{ url: string; username: string; expiresAt: string } | null>(null);
  
  // Code admin
  const [adminCode, setAdminCode] = useState('');
  const [adminCodeLoading, setAdminCodeLoading] = useState(false);
  const [adminCodeSaved, setAdminCodeSaved] = useState(false);
  
  // Formulaire
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    userType: 'standard' as UserType,
    canBecomeAdmin: true
  });

  // Charger les utilisateurs et le code admin
  useEffect(() => {
    loadUsers();
    loadAdminCode();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const userList = await fetchUsers();
    setUsers(userList);
    setLoading(false);
  };

  const loadAdminCode = async () => {
    try {
      const token = localStorage.getItem('somone-cockpit-token');
      const response = await fetch('/api/admin/code', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAdminCode(data.adminCode || '');
      }
    } catch (err) {
      console.error('Erreur chargement code admin:', err);
    }
  };

  const saveAdminCode = async () => {
    // Si un code est saisi, il doit faire au moins 4 caractères
    if (adminCode.trim() && adminCode.trim().length < 4) {
      alert('Le code personnalisé doit contenir au moins 4 caractères (ou être vide pour utiliser uniquement le code par défaut)');
      return;
    }
    
    setAdminCodeLoading(true);
    try {
      const token = localStorage.getItem('somone-cockpit-token');
      const response = await fetch('/api/admin/code', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminCode: adminCode.trim() })
      });
      
      if (response.ok) {
        setAdminCodeSaved(true);
        setTimeout(() => setAdminCodeSaved(false), 2000);
      } else {
        const data = await response.json();
        alert(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('Erreur sauvegarde code admin:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setAdminCodeLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.username || !formData.password) {
      return;
    }
    
    const newUser = await createUser({
      username: formData.username,
      password: formData.password,
      name: formData.name || undefined,
      email: formData.email || undefined,
      userType: formData.userType,
      canBecomeAdmin: formData.userType === 'standard' ? formData.canBecomeAdmin : undefined
    });
    
    if (newUser) {
      await loadUsers();
      setShowCreateModal(false);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    
    const updateData: any = {};
    if (formData.username && formData.username !== editingUser.username) {
      updateData.username = formData.username;
    }
    if (formData.password) {
      updateData.password = formData.password;
    }
    if (formData.name !== (editingUser.name || '')) {
      updateData.name = formData.name;
    }
    if (formData.email !== (editingUser.email || '')) {
      updateData.email = formData.email;
    }
    
    // Déterminer le type effectif (pour les anciens utilisateurs sans userType)
    const effectiveEditingUserType = editingUser.userType || (editingUser.isAdmin ? 'admin' : 'standard');
    
    if (formData.userType !== effectiveEditingUserType) {
      updateData.userType = formData.userType;
    }
    
    // Toujours envoyer canBecomeAdmin si l'utilisateur est/sera standard
    if (formData.userType === 'standard') {
      // Envoyer canBecomeAdmin si la valeur a changé ou si on met à jour un utilisateur standard
      const previousCanBecomeAdmin = editingUser.canBecomeAdmin !== false;
      if (formData.canBecomeAdmin !== previousCanBecomeAdmin || effectiveEditingUserType === 'standard') {
        updateData.canBecomeAdmin = formData.canBecomeAdmin;
        console.log(`[UserManagement] Envoi canBecomeAdmin: ${formData.canBecomeAdmin}`);
      }
    }
    
    console.log(`[UserManagement] updateData:`, updateData);
    const updatedUser = await updateUser(editingUser.id, updateData);
    
    if (updatedUser) {
      await loadUsers();
      setEditingUser(null);
      resetForm();
    }
  };

  const handleDelete = async (userId: string) => {
    const success = await deleteUser(userId);
    if (success) {
      await loadUsers();
      setConfirmDelete(null);
    }
  };

  const handleGenerateQR = async (userId: string) => {
    const result = await generateResetToken(userId);
    if (result) {
      const user = users.find(u => u.id === userId);
      setQrCodeData({
        url: result.url,
        username: user?.username || '',
        expiresAt: result.expiresAt
      });
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      userType: 'standard',
      canBecomeAdmin: true
    });
    clearError();
  };

  const openEditModal = (user: UserListItem) => {
    setEditingUser(user);
    // S'assurer que userType a une valeur (migration des anciens utilisateurs)
    const effectiveUserType = user.userType || (user.isAdmin ? 'admin' : 'standard');
    setFormData({
      username: user.username,
      password: '',
      name: user.name || '',
      email: user.email || '',
      userType: effectiveUserType,
      canBecomeAdmin: user.canBecomeAdmin !== false
    });
  };

  const getUserTypeLabel = (type: UserType) => {
    switch (type) {
      case 'admin': return 'Administrateur';
      case 'standard': return 'Standard';
      case 'client': return 'Client';
      default: return type;
    }
  };

  const getUserTypeBadgeColor = (type: UserType) => {
    switch (type) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'standard': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'client': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MuiIcon name="Group" size={24} />
            <h2 className="text-xl font-semibold">Gestion des utilisateurs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <MuiIcon name="Close" size={20} />
          </button>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {users.length} utilisateur{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}
          </div>
          
          {/* Code admin */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="flex items-center gap-1" title="Le code par défaut (12411241) fonctionne toujours. Vous pouvez définir un code personnalisé supplémentaire.">
              <label className="text-xs text-slate-500 whitespace-nowrap">Code personnalisé :</label>
              <MuiIcon name="HelpOutline" size={12} className="text-slate-400" />
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Code additionnel (optionnel)"
              />
            </div>
            <button
              onClick={saveAdminCode}
              disabled={adminCodeLoading}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                adminCodeSaved 
                  ? 'bg-green-500 text-white' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
              title="Enregistrer le code personnalisé"
            >
              {adminCodeLoading ? (
                <MuiIcon name="HourglassEmpty" size={14} className="animate-spin" />
              ) : adminCodeSaved ? (
                <MuiIcon name="Check" size={14} />
              ) : (
                <MuiIcon name="Save" size={14} />
              )}
            </button>
            <span className="text-[10px] text-slate-400 whitespace-nowrap" title="Code par défaut toujours actif">
              + défaut
            </span>
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors"
          >
            <MuiIcon name="PersonAdd" size={18} />
            Créer un utilisateur
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <MuiIcon name="HourglassEmpty" size={32} className="animate-spin text-slate-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Aucun utilisateur trouvé
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left border-b-2 border-slate-200">
                  <th className="pb-3 font-semibold text-slate-700">Identifiant</th>
                  <th className="pb-3 font-semibold text-slate-700">Nom</th>
                  <th className="pb-3 font-semibold text-slate-700">Email</th>
                  <th className="pb-3 font-semibold text-slate-700">Type</th>
                  <th className="pb-3 font-semibold text-slate-700">Options</th>
                  <th className="pb-3 font-semibold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3">
                      <span className="font-medium text-slate-800">{user.username}</span>
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Vous</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-600">{user.name || '-'}</td>
                    <td className="py-3 text-slate-600">{user.email || '-'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded border text-xs font-medium ${getUserTypeBadgeColor(user.userType)}`}>
                        {getUserTypeLabel(user.userType)}
                      </span>
                    </td>
                    <td className="py-3">
                      {/* Afficher pour les utilisateurs standard (ou sans type défini et non-admin) */}
                      {(user.userType === 'standard' || (!user.userType && !user.isAdmin)) && (
                        <span className={`text-xs ${user.canBecomeAdmin !== false ? 'text-green-600' : 'text-red-600'}`}>
                          {user.canBecomeAdmin !== false ? '✓ Peut devenir admin' : '✗ Admin bloqué'}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleGenerateQR(user.id)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Générer un QR code de réinitialisation"
                        >
                          <MuiIcon name="QrCode2" size={18} />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <MuiIcon name="Edit" size={18} />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => setConfirmDelete(user.id)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <MuiIcon name="Delete" size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* QR Code display */}
        {qrCodeData && (
          <div className="border-t bg-blue-50 px-6 py-4">
            <div className="flex items-start gap-4">
              <div 
                className="bg-white p-2 rounded-lg border-2 border-blue-200"
                dangerouslySetInnerHTML={{ __html: generateQRCodeSVG(qrCodeData.url, 150) }}
              />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-2">
                  Lien de réinitialisation pour {qrCodeData.username}
                </h4>
                <p className="text-sm text-slate-600 mb-2">
                  Ce lien permet à l'utilisateur de définir un nouveau mot de passe. Il n'est utilisable qu'une seule fois.
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Expire le : {new Date(qrCodeData.expiresAt).toLocaleString('fr-FR')}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qrCodeData.url}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700"
                  />
                  <button
                    onClick={() => copyToClipboard(qrCodeData.url)}
                    className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors flex items-center gap-2"
                  >
                    <MuiIcon name="ContentCopy" size={16} />
                    Copier
                  </button>
                  <button
                    onClick={() => setQrCodeData(null)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal création/édition */}
      {(showCreateModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <MuiIcon name="Close" size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Identifiant *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="identifiant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mot de passe {editingUser ? '(laisser vide pour ne pas changer)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nom d'affichage
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Prénom Nom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@exemple.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type d'utilisateur
                </label>
                <select
                  value={formData.userType}
                  onChange={(e) => setFormData({ ...formData, userType: e.target.value as UserType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="admin">Administrateur</option>
                  <option value="standard">Standard</option>
                  <option value="client">Client</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {formData.userType === 'admin' && 'Accès complet à toutes les fonctionnalités et à la gestion des utilisateurs.'}
                  {formData.userType === 'standard' && 'Accès complet au studio, sans gestion des utilisateurs.'}
                  {formData.userType === 'client' && 'Accès simplifié au studio avec des fonctionnalités réduites.'}
                </p>
              </div>

              {formData.userType === 'standard' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="canBecomeAdmin"
                    checked={formData.canBecomeAdmin}
                    onChange={(e) => setFormData({ ...formData, canBecomeAdmin: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="canBecomeAdmin" className="text-sm text-slate-700">
                    Peut passer administrateur (avec le code)
                  </label>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={editingUser ? handleUpdate : handleCreate}
                disabled={isLoading || !formData.username || (!editingUser && !formData.password)}
                className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2a4a6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && <MuiIcon name="HourglassEmpty" size={16} className="animate-spin" />}
                {editingUser ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirmer la suppression</h3>
              <p className="text-slate-600">
                Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.
              </p>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <MuiIcon name="HourglassEmpty" size={16} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
