import { useState } from 'react';
import type { SubElement, DataSource, Calculation } from '../../types';
import DataSourceManager from './DataSourceManager';
import CalculationManager from './CalculationManager';
import CalculationExplanation from './CalculationExplanation';
import { MuiIcon } from '../IconPicker';
import { useAuthStore } from '../../store/authStore';

interface SourcesAndCalculationsPanelProps {
  subElement: SubElement;
  onUpdate: (updates: Partial<SubElement>) => void;
}

export default function SourcesAndCalculationsPanel({ subElement, onUpdate }: SourcesAndCalculationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'sources' | 'calculations' | 'explanation'>('sources');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    value?: string;
    unit?: string;
    status?: string;
    explanation?: string;
    error?: string;
  } | null>(null);
  const { token } = useAuthStore();

  const handleSourcesUpdate = (sources: DataSource[]) => {
    onUpdate({ sources });
  };

  const handleCalculationsUpdate = (calculations: Calculation[]) => {
    onUpdate({ calculations });
  };

  const selectedCalculation = subElement.calculations && subElement.calculations.length > 0 
    ? subElement.calculations[0] 
    : null;

  const hasCalculations = (subElement.calculations?.length || 0) > 0;
  const hasSources = (subElement.sources?.length || 0) > 0;

  // Exécuter le calcul
  const executeCalculation = async () => {
    if (!selectedCalculation) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch('/api/ai/execute-calculation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          calculation: selectedCalculation,
          sources: subElement.sources || [],
          subElementName: subElement.name,
          currentValue: subElement.value,
          currentUnit: subElement.unit,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'exécution');
      }

      const result = await response.json();
      setExecutionResult({
        success: true,
        value: result.value,
        unit: result.unit,
        status: result.status,
        explanation: result.explanation,
      });
    } catch (error: any) {
      console.error('Erreur exécution calcul:', error);
      setExecutionResult({
        success: false,
        error: error.message || 'Erreur lors de l\'exécution du calcul',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Appliquer le résultat au sous-élément
  const applyResult = () => {
    if (!executionResult?.success) return;

    const updates: Partial<SubElement> = {};
    if (executionResult.value !== undefined) {
      updates.value = executionResult.value;
    }
    if (executionResult.unit !== undefined) {
      updates.unit = executionResult.unit;
    }
    if (executionResult.status) {
      updates.status = executionResult.status as SubElement['status'];
    }

    onUpdate(updates);
    setExecutionResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Section Exécution du calcul */}
      {hasCalculations && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MuiIcon name="PlayArrow" size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Exécution du calcul</span>
            </div>
            <button
              onClick={executeCalculation}
              disabled={isExecuting || !selectedCalculation}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {isExecuting ? (
                <>
                  <MuiIcon name="Refresh" size={14} className="animate-spin" />
                  <span>Exécution...</span>
                </>
              ) : (
                <>
                  <MuiIcon name="PlayArrow" size={14} />
                  <span>Exécuter</span>
                </>
              )}
            </button>
          </div>

          {/* Résultat de l'exécution */}
          {executionResult && (
            <div className={`mt-3 p-3 rounded-lg border ${
              executionResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              {executionResult.success ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <MuiIcon name="CheckCircle" size={16} className="text-green-600" />
                    <span className="text-sm font-medium text-green-800">Résultat obtenu</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {executionResult.value !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">Valeur :</span>
                        <span className="font-mono font-medium text-green-900">
                          {executionResult.value} {executionResult.unit || ''}
                        </span>
                      </div>
                    )}
                    {executionResult.status && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">Statut :</span>
                        <span className="font-medium text-green-900">{executionResult.status}</span>
                      </div>
                    )}
                    {executionResult.explanation && (
                      <div className="mt-2 p-2 bg-white/50 rounded text-xs text-green-700">
                        {executionResult.explanation}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={applyResult}
                    className="mt-3 w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <MuiIcon name="Check" size={16} />
                    <span>Appliquer au sous-élément</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <MuiIcon name="Error" size={16} className="text-red-600" />
                  <span className="text-sm text-red-800">{executionResult.error}</span>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-blue-600 mt-2">
            Exécute le calcul avec les sources définies et affiche le résultat.
          </p>
        </div>
      )}

      {/* Toggle Application automatique du calcul */}
      {(hasCalculations || hasSources) && (
        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={subElement.applyCalculation || false}
                onChange={(e) => onUpdate({ applyCalculation: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${
                subElement.applyCalculation ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  subElement.applyCalculation ? 'translate-x-4' : ''
                }`} />
              </div>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-green-800">Application automatique</span>
              <p className="text-xs text-green-600">
                {subElement.applyCalculation 
                  ? 'Activé - Le calcul sera exécuté automatiquement' 
                  : 'Désactivé - Exécution manuelle uniquement'}
              </p>
            </div>
            {subElement.applyCalculation && (
              <MuiIcon name="CheckCircle" size={20} className="text-green-500" />
            )}
          </label>
        </div>
      )}

      {/* Onglets */}
      <div className="flex border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sources'
              ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
              : 'text-[#64748B] hover:text-[#1E3A5F]'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MuiIcon name="Storage" size={16} />
            <span>Sources</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('calculations')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'calculations'
              ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
              : 'text-[#64748B] hover:text-[#1E3A5F]'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MuiIcon name="Tune" size={16} />
            <span>Calculs</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('explanation')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'explanation'
              ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
              : 'text-[#64748B] hover:text-[#1E3A5F]'
          }`}
          disabled={!selectedCalculation}
        >
          <div className="flex items-center justify-center gap-2">
            <MuiIcon name="Info" size={16} />
            <span>Explication</span>
          </div>
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="mt-4">
        {activeTab === 'sources' && (
          <DataSourceManager
            subElement={subElement}
            sources={subElement.sources || []}
            onUpdate={handleSourcesUpdate}
          />
        )}
        
        {activeTab === 'calculations' && (
          <CalculationManager
            subElement={subElement}
            sources={subElement.sources || []}
            calculations={subElement.calculations || []}
            onUpdate={handleCalculationsUpdate}
          />
        )}
        
        {activeTab === 'explanation' && selectedCalculation && (
          <CalculationExplanation
            calculation={selectedCalculation}
            sources={subElement.sources || []}
          />
        )}
      </div>
    </div>
  );
}

