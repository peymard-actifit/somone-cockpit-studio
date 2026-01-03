import { useState } from 'react';
import type { SubElement, DataSource, DataSourceType } from '../../types';
import { MuiIcon } from '../IconPicker';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuthStore } from '../../store/authStore';

interface DataSourceManagerProps {
  subElement: SubElement;
  sources: DataSource[];
  onUpdate: (sources: DataSource[]) => void;
}

const DATA_SOURCE_TYPES: Array<{ value: DataSourceType; label: string; icon: string }> = [
  { value: 'excel', label: 'Excel', icon: 'FileSpreadsheet' },
  { value: 'csv', label: 'CSV', icon: 'FileText' },
  { value: 'json', label: 'JSON', icon: 'FileJson' },
  { value: 'api', label: 'API', icon: 'Cloud' },
  { value: 'database', label: 'Base de données', icon: 'Storage' },
  { value: 'email', label: 'E-mail', icon: 'Mail' },
  { value: 'supervision', label: 'Supervision', icon: 'Assessment' },
  { value: 'hypervision', label: 'Hypervision', icon: 'Layers' },
  { value: 'observability', label: 'Observabilité', icon: 'Eye' },
  { value: 'other', label: 'Autre', icon: 'More' },
];

const generateId = () => crypto.randomUUID();

export default function DataSourceManager({ subElement, sources, onUpdate }: DataSourceManagerProps) {
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const confirm = useConfirm();
  const { token } = useAuthStore();

  const handleAdd = () => {
    const newSource: DataSource = {
      id: generateId(),
      subElementId: subElement.id,
      name: '',
      type: 'excel',
      location: '',
      fields: '',
      description: '',
    };
    setEditingSource(newSource);
    setShowForm(true);
  };

  const handleEdit = (source: DataSource) => {
    setEditingSource({ ...source });
    setShowForm(true);
  };

  const handleDelete = async (sourceId: string) => {
    const confirmed = await confirm({
      title: 'Supprimer la source',
      message: 'Voulez-vous supprimer cette source de données ?',
    });
    if (confirmed) {
      onUpdate(sources.filter(s => s.id !== sourceId));
    }
  };

  const handleSave = () => {
    if (!editingSource) return;
    
    if (!editingSource.name.trim()) {
      alert('Le nom de la source est obligatoire');
      return;
    }

    const updatedSources = editingSource.id && sources.some(s => s.id === editingSource.id)
      ? sources.map(s => s.id === editingSource.id ? editingSource : s)
      : [...sources, editingSource];

    onUpdate(updatedSources);
    setEditingSource(null);
    setShowForm(false);
  };

  const handleCancel = () => {
    setEditingSource(null);
    setShowForm(false);
  };

  // Génération IA des champs depuis le prompt
  const generateFromPrompt = async () => {
    if (!editingSource?.prompt?.trim()) {
      alert('Veuillez entrer une description de la source dans le champ prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: editingSource.prompt,
          subElementName: subElement.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération');
      }

      const result = await response.json();
      
      // Mettre à jour les champs avec les valeurs générées (remplacement complet)
      setEditingSource({
        ...editingSource,
        name: result.name || '',
        type: result.type || 'other',
        location: result.location || '',
        connection: result.connection || '',
        fields: result.fields || '',
        description: result.description || '',
        prompt: editingSource.prompt, // Préserver le prompt
      });
    } catch (error) {
      console.error('Erreur génération IA:', error);
      alert('Erreur lors de la génération. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (showForm && editingSource) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[#1E3A5F]">
            {editingSource.id && sources.some(s => s.id === editingSource.id) ? 'Modifier' : 'Ajouter'} une source
          </h4>
          <button
            onClick={handleCancel}
            className="text-[#64748B] hover:text-[#1E3A5F]"
          >
            <MuiIcon name="X" size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Champ Prompt IA */}
          <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <label className="block text-xs text-purple-700 font-medium mb-1">
              <MuiIcon name="AutoAwesome" size={12} className="inline mr-1" />
              Prompt IA - Décrivez la source souhaitée
            </label>
            <div className="flex gap-2">
              <textarea
                value={editingSource.prompt || ''}
                onChange={(e) => setEditingSource({ ...editingSource, prompt: e.target.value })}
                placeholder="Ex: Je veux récupérer les données de vente du fichier Excel mensuel situé sur le serveur partagé, dans la feuille 'Ventes', colonnes A à F..."
                rows={2}
                className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-purple-500 resize-none"
              />
              <button
                onClick={generateFromPrompt}
                disabled={isGenerating || !editingSource.prompt?.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                title="Générer les champs automatiquement"
              >
                {isGenerating ? (
                  <MuiIcon name="Refresh" size={16} className="animate-spin" />
                ) : (
                  <MuiIcon name="AutoAwesome" size={16} />
                )}
              </button>
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Décrivez en langage naturel la source de données dont vous avez besoin. L'IA remplira les champs automatiquement.
            </p>
          </div>

          <div className="border-t border-[#E2E8F0] pt-3">
            <p className="text-xs text-[#64748B] mb-2">Champs générés (modifiables) :</p>
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Nom *</label>
            <input
              type="text"
              value={editingSource.name}
              onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
              placeholder="Nom de la source"
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Type</label>
            <select
              value={editingSource.type}
              onChange={(e) => setEditingSource({ ...editingSource, type: e.target.value as DataSourceType })}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            >
              {DATA_SOURCE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Emplacement / Fichier / Connecteur</label>
            <input
              type="text"
              value={editingSource.location || ''}
              onChange={(e) => setEditingSource({ ...editingSource, location: e.target.value })}
              placeholder="Chemin, URL, nom de fichier, etc."
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Connexion (optionnel)</label>
            <input
              type="text"
              value={editingSource.connection || ''}
              onChange={(e) => setEditingSource({ ...editingSource, connection: e.target.value })}
              placeholder="Détails de connexion (pour API, bases de données)"
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Champs / Feuilles / Règles d'extraction</label>
            <textarea
              value={editingSource.fields || ''}
              onChange={(e) => setEditingSource({ ...editingSource, fields: e.target.value })}
              placeholder="Champs à extraire, noms de feuilles Excel, règles d'extraction..."
              rows={3}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Description</label>
            <textarea
              value={editingSource.description || ''}
              onChange={(e) => setEditingSource({ ...editingSource, description: e.target.value })}
              placeholder="Description de la source..."
              rows={2}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Enregistrer
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-[#F5F7FA] hover:bg-[#E2E8F0] text-[#64748B] rounded-lg text-sm font-medium transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#1E3A5F]">Sources de données</h4>
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white rounded-lg text-xs font-medium flex items-center gap-1"
        >
          <MuiIcon name="Plus" size={14} />
          <span>Ajouter</span>
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] text-center">
          <p className="text-sm text-[#64748B]">Aucune source de données définie</p>
          <button
            onClick={handleAdd}
            className="mt-2 text-sm text-[#1E3A5F] hover:underline"
          >
            Ajouter une source
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(source => {
            const typeInfo = DATA_SOURCE_TYPES.find(t => t.value === source.type);
            return (
              <div
                key={source.id}
                className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] hover:border-[#1E3A5F] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {typeInfo && <MuiIcon name={typeInfo.icon} size={16} className="text-[#64748B]" />}
                      <span className="text-sm font-medium text-[#1E3A5F]">{source.name}</span>
                      <span className="text-xs text-[#94A3B8]">({typeInfo?.label})</span>
                    </div>
                    {source.location && (
                      <p className="text-xs text-[#64748B] mb-1">{source.location}</p>
                    )}
                    {source.description && (
                      <p className="text-xs text-[#94A3B8]">{source.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(source)}
                      className="p-1 text-[#64748B] hover:text-[#1E3A5F]"
                      title="Modifier"
                    >
                      <MuiIcon name="Edit" size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      className="p-1 text-[#64748B] hover:text-red-600"
                      title="Supprimer"
                    >
                      <MuiIcon name="Delete" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

