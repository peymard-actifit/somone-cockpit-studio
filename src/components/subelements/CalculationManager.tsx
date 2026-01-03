import { useState } from 'react';
import type { SubElement, Calculation, DataSource } from '../../types';
import { MuiIcon } from '../IconPicker';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuthStore } from '../../store/authStore';

interface CalculationManagerProps {
  subElement: SubElement;
  sources: DataSource[];
  calculations: Calculation[];
  onUpdate: (calculations: Calculation[]) => void;
}

const generateId = () => crypto.randomUUID();

export default function CalculationManager({ subElement, sources, calculations, onUpdate }: CalculationManagerProps) {
  const [editingCalculation, setEditingCalculation] = useState<Calculation | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const confirm = useConfirm();
  const { token } = useAuthStore();

  const handleAdd = () => {
    const newCalculation: Calculation = {
      id: generateId(),
      subElementId: subElement.id,
      name: '',
      description: '',
      definition: '',
      sources: [],
    };
    setEditingCalculation(newCalculation);
    setShowForm(true);
  };

  const handleEdit = (calculation: Calculation) => {
    setEditingCalculation({ ...calculation });
    setShowForm(true);
  };

  const handleDelete = async (calculationId: string) => {
    const confirmed = await confirm({
      title: 'Supprimer le calcul',
      message: 'Voulez-vous supprimer ce calcul ?',
    });
    if (confirmed) {
      onUpdate(calculations.filter(c => c.id !== calculationId));
    }
  };

  const handleSave = async () => {
    if (!editingCalculation) return;
    
    if (!editingCalculation.name.trim()) {
      alert('Le nom du calcul est obligatoire');
      return;
    }

    if (!editingCalculation.definition.trim()) {
      alert('La définition du calcul est obligatoire');
      return;
    }

    // Validation JSON/YAML basique
    try {
      if (editingCalculation.definition.trim().startsWith('{') || editingCalculation.definition.trim().startsWith('[')) {
        JSON.parse(editingCalculation.definition);
      }
    } catch (e) {
      const shouldContinue = await confirm({
        title: 'Validation JSON',
        message: 'La définition ne semble pas être un JSON valide. Continuer quand même ?',
      });
      if (!shouldContinue) {
        return;
      }
    }

    const updatedCalculations = editingCalculation.id && calculations.some(c => c.id === editingCalculation.id)
      ? calculations.map(c => c.id === editingCalculation.id ? editingCalculation : c)
      : [...calculations, editingCalculation];

    onUpdate(updatedCalculations);
    setEditingCalculation(null);
    setShowForm(false);
  };

  const handleCancel = () => {
    setEditingCalculation(null);
    setShowForm(false);
  };

  const toggleSource = (sourceId: string) => {
    if (!editingCalculation) return;
    const currentSources = editingCalculation.sources || [];
    const newSources = currentSources.includes(sourceId)
      ? currentSources.filter(id => id !== sourceId)
      : [...currentSources, sourceId];
    setEditingCalculation({ ...editingCalculation, sources: newSources });
  };

  // Génération IA des champs depuis le prompt
  const generateFromPrompt = async () => {
    if (!editingCalculation?.prompt?.trim()) {
      alert('Veuillez entrer une description du calcul dans le champ prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-calculation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: editingCalculation.prompt,
          subElementName: subElement.name,
          availableSources: sources.map(s => ({ id: s.id, name: s.name, type: s.type })),
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération');
      }

      const result = await response.json();
      
      // Mettre à jour les champs avec les valeurs générées (remplacement complet)
      setEditingCalculation({
        ...editingCalculation,
        name: result.name || '',
        description: result.description || '',
        definition: result.definition || '',
        sources: result.sources || [],
        prompt: editingCalculation.prompt, // Préserver le prompt
      });
    } catch (error) {
      console.error('Erreur génération IA:', error);
      alert('Erreur lors de la génération. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (showForm && editingCalculation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[#1E3A5F]">
            {editingCalculation.id && calculations.some(c => c.id === editingCalculation.id) ? 'Modifier' : 'Ajouter'} un calcul
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
              Prompt IA - Décrivez le calcul souhaité
            </label>
            <div className="flex gap-2">
              <textarea
                value={editingCalculation.prompt || ''}
                onChange={(e) => setEditingCalculation({ ...editingCalculation, prompt: e.target.value })}
                placeholder="Ex: Je veux calculer le taux de disponibilité mensuel à partir des données de supervision, en excluant les maintenances planifiées..."
                rows={2}
                className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-purple-500 resize-none"
              />
              <button
                onClick={generateFromPrompt}
                disabled={isGenerating || !editingCalculation.prompt?.trim()}
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
              Décrivez en langage naturel le calcul dont vous avez besoin. L'IA générera la définition technique.
            </p>
          </div>

          <div className="border-t border-[#E2E8F0] pt-3">
            <p className="text-xs text-[#64748B] mb-2">Champs générés (modifiables) :</p>
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Nom *</label>
            <input
              type="text"
              value={editingCalculation.name}
              onChange={(e) => setEditingCalculation({ ...editingCalculation, name: e.target.value })}
              placeholder="Nom du calcul"
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Description métier</label>
            <textarea
              value={editingCalculation.description || ''}
              onChange={(e) => setEditingCalculation({ ...editingCalculation, description: e.target.value })}
              placeholder="Description du calcul en langage métier..."
              rows={2}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Sources utilisées (optionnel)</label>
            {sources.length === 0 ? (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700 text-center">
                <MuiIcon name="Info" size={14} className="inline mr-1" />
                Aucune source définie. Vous pouvez en ajouter dans l'onglet "Sources", ou utiliser le prompt IA ci-dessus pour générer le calcul.
              </div>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {sources.map(source => (
                  <label
                    key={source.id}
                    className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] hover:border-[#1E3A5F] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={(editingCalculation.sources || []).includes(source.id)}
                      onChange={() => toggleSource(source.id)}
                      className="rounded border-[#E2E8F0] text-[#1E3A5F] focus:ring-[#1E3A5F]"
                    />
                    <span className="text-sm text-[#1E3A5F]">{source.name}</span>
                    <span className="text-xs text-[#94A3B8] ml-auto">({source.type})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">Définition technique * (JSON/YAML/DSL)</label>
            <textarea
              value={editingCalculation.definition}
              onChange={(e) => setEditingCalculation({ ...editingCalculation, definition: e.target.value })}
              placeholder='Exemple JSON: {"operation": "sum", "sources": ["source1"], "filter": {"field": "status", "value": "ok"}}'
              rows={8}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg text-[#1E3A5F] text-sm focus:outline-none focus:border-[#1E3A5F] resize-none font-mono"
            />
            <p className="text-xs text-[#94A3B8] mt-1">
              Format JSON, YAML ou DSL interne. Permet d&apos;effectuer des opérations, filtres, agrégations ou transformations.
            </p>
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
        <h4 className="text-sm font-semibold text-[#1E3A5F]">Calculs</h4>
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white rounded-lg text-xs font-medium flex items-center gap-1"
        >
          <MuiIcon name="Plus" size={14} />
          <span>Ajouter</span>
        </button>
      </div>

      {calculations.length === 0 ? (
        <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] text-center">
          <p className="text-sm text-[#64748B]">Aucun calcul défini</p>
          <button
            onClick={handleAdd}
            className="mt-2 text-sm text-[#1E3A5F] hover:underline"
          >
            Ajouter un calcul
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {calculations.map(calculation => {
            const usedSources = sources.filter(s => calculation.sources.includes(s.id));
            return (
              <div
                key={calculation.id}
                className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] hover:border-[#1E3A5F] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MuiIcon name="Tune" size={16} className="text-[#64748B]" />
                      <span className="text-sm font-medium text-[#1E3A5F]">{calculation.name}</span>
                    </div>
                    {calculation.description && (
                      <p className="text-xs text-[#64748B] mb-2">{calculation.description}</p>
                    )}
                    {usedSources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {usedSources.map(source => (
                          <span
                            key={source.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-[#E2E8F0] text-xs text-[#64748B]"
                          >
                            <MuiIcon name="Database" size={12} />
                            {source.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 p-2 bg-white rounded border border-[#E2E8F0]">
                      <p className="text-xs text-[#94A3B8] mb-1">Définition :</p>
                      <pre className="text-xs text-[#1E3A5F] font-mono overflow-x-auto whitespace-pre-wrap break-words">
                        {calculation.definition.substring(0, 100)}
                        {calculation.definition.length > 100 ? '...' : ''}
                      </pre>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(calculation);
                      }}
                      className="p-1 text-[#64748B] hover:text-[#1E3A5F]"
                      title="Modifier"
                    >
                      <MuiIcon name="Edit" size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(calculation.id);
                      }}
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

