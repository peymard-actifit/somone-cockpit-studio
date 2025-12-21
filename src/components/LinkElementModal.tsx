import { useState } from 'react';
import { MuiIcon } from './IconPicker';
import { STATUS_COLORS } from '../types';

interface ExistingMatch {
  id: string;
  name: string;
  location: string; // Ex: "Domaine > Catégorie" ou "Domaine > Catégorie > Élément > Sous-catégorie"
  linkedGroupId?: string;
  status: string;
  type: 'element' | 'subElement';
}

interface LinkElementModalProps {
  type: 'element' | 'subElement';
  newItemName: string;
  existingMatches: ExistingMatch[];
  onLink: (linkedGroupId: string) => void;
  onIndependent: () => void;
  onCancel: () => void;
}

export default function LinkElementModal({
  type,
  newItemName,
  existingMatches,
  onLink,
  onIndependent,
  onCancel,
}: LinkElementModalProps) {
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const typeLabel = type === 'element' ? 'élément' : 'sous-élément';
  const typeLabelPlural = type === 'element' ? 'éléments' : 'sous-éléments';

  // Regrouper par linkedGroupId (ou par id si pas de groupe)
  const groupedMatches: Map<string, ExistingMatch[]> = new Map();
  existingMatches.forEach(match => {
    const groupKey = match.linkedGroupId || `single-${match.id}`;
    if (!groupedMatches.has(groupKey)) {
      groupedMatches.set(groupKey, []);
    }
    groupedMatches.get(groupKey)!.push(match);
  });

  const handleConfirmLink = () => {
    if (selectedMatch) {
      // Trouver le linkedGroupId ou créer un nouveau basé sur l'élément sélectionné
      const match = existingMatches.find(m => m.id === selectedMatch);
      if (match) {
        // Utiliser le linkedGroupId existant ou l'id de l'élément comme nouveau groupe
        onLink(match.linkedGroupId || match.id);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2C4A6E] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <MuiIcon name="Link" size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} existant détecté
              </h3>
              <p className="text-white/80 text-sm">
                Un ou plusieurs {typeLabelPlural} portent déjà ce nom
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Nouveau nom */}
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-[#E2E8F0]">
            <p className="text-sm text-[#64748B] mb-1">Vous créez :</p>
            <p className="font-semibold text-[#1E3A5F] text-lg">"{newItemName}"</p>
          </div>

          {/* Existants */}
          <div>
            <p className="text-sm font-medium text-[#1E3A5F] mb-2">
              {typeLabelPlural.charAt(0).toUpperCase() + typeLabelPlural.slice(1)} existants avec ce nom :
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Array.from(groupedMatches.entries()).map(([groupKey, matches]) => (
                <button
                  key={groupKey}
                  onClick={() => setSelectedMatch(matches[0].id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selectedMatch === matches[0].id
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 ring-2 ring-[#1E3A5F]/20'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[matches[0].status as keyof typeof STATUS_COLORS]?.hex || '#9E9E9E' }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-[#1E3A5F]">{matches[0].name}</p>
                      <p className="text-xs text-[#64748B]">{matches[0].location}</p>
                      {matches.length > 1 && (
                        <p className="text-xs text-[#1E3A5F] mt-1 flex items-center gap-1">
                          <MuiIcon name="Link" size={12} />
                          Déjà lié à {matches.length - 1} autre(s) {typeLabelPlural}
                        </p>
                      )}
                    </div>
                    {selectedMatch === matches[0].id && (
                      <MuiIcon name="CheckCircle" size={20} className="text-[#1E3A5F]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Explication */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex gap-2">
              <MuiIcon name="Info" size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Que signifie "lier" ?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Les propriétés sont copiées et synchronisées</li>
                  <li>Modifier l'un modifie automatiquement les autres</li>
                  <li>Vous pouvez supprimer individuellement sans impact</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-[#F5F7FA] border-t border-[#E2E8F0] flex flex-col sm:flex-row gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F] transition-colors"
          >
            Annuler
          </button>
          <div className="flex-1" />
          <button
            onClick={onIndependent}
            className="px-4 py-2 border border-[#E2E8F0] bg-white text-[#1E3A5F] rounded-lg hover:bg-[#F5F7FA] transition-colors flex items-center justify-center gap-2"
          >
            <MuiIcon name="LinkOff" size={18} />
            Créer indépendant
          </button>
          <button
            onClick={handleConfirmLink}
            disabled={!selectedMatch}
            className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <MuiIcon name="Link" size={18} />
            Lier à la sélection
          </button>
        </div>
      </div>
    </div>
  );
}





