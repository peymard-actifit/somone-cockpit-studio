import { useState } from 'react';
import type { SubElement, DataSource, Calculation } from '../../types';
import DataSourceManager from './DataSourceManager';
import CalculationManager from './CalculationManager';
import CalculationExplanation from './CalculationExplanation';
import CalculationExecutionModal from './CalculationExecutionModal';
import { MuiIcon } from '../IconPicker';
import { useAuthStore } from '../../store/authStore';

interface ExecutionStep {
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
  timestamp: string;
}

interface SourcesAndCalculationsPanelProps {
  subElement: SubElement;
  onUpdate: (updates: Partial<SubElement>) => void;
}

export default function SourcesAndCalculationsPanel({ subElement, onUpdate }: SourcesAndCalculationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'sources' | 'calculations' | 'explanation'>('sources');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    value?: string;
    unit?: string;
    status?: string;
    explanation?: string;
    error?: string;
    mode?: string;
    warnings?: string[];
    rawData?: { sourceCount: number; dataCount: number; filteredCount: number };
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

  // Exécuter le calcul avec modal des étapes
  const executeCalculation = async () => {
    if (!selectedCalculation) return;

    // Ouvrir le modal et réinitialiser
    setShowExecutionModal(true);
    setIsExecuting(true);
    setExecutionResult(null);
    setExecutionSteps([]);

    // Ajouter une étape initiale côté client
    setExecutionSteps([{
      step: 0,
      action: 'init',
      status: 'running',
      message: 'Envoi de la requête au serveur...',
      timestamp: new Date().toISOString(),
    }]);

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

      const result = await response.json();
      
      // Mettre à jour les étapes depuis le serveur
      if (result.steps && Array.isArray(result.steps)) {
        setExecutionSteps(result.steps);
      }

      if (!response.ok) {
        setExecutionResult({
          success: false,
          error: result.error || 'Erreur lors de l\'exécution',
        });
      } else {
        setExecutionResult({
          success: true,
          value: result.value,
          unit: result.unit,
          status: result.status,
          explanation: result.explanation,
          mode: result.mode,
          warnings: result.warnings,
          rawData: result.rawData,
        });
      }
    } catch (error: any) {
      console.error('Erreur exécution calcul:', error);
      setExecutionSteps(prev => [...prev, {
        step: prev.length + 1,
        action: 'network_error',
        status: 'error',
        message: `Erreur réseau: ${error.message}`,
        timestamp: new Date().toISOString(),
      }]);
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MuiIcon name="CheckCircle" size={16} className="text-green-600" />
                      <span className="text-sm font-medium text-green-800">Résultat obtenu</span>
                    </div>
                    {executionResult.mode && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        executionResult.mode === 'real-data' 
                          ? 'bg-blue-100 text-blue-700' 
                          : executionResult.mode === 'ai-assisted'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {executionResult.mode === 'real-data' ? '📊 Données réelles' :
                         executionResult.mode === 'ai-assisted' ? '🤖 Assisté par IA' :
                         executionResult.mode === 'no-data' ? '⚠️ Sans données' : executionResult.mode}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {executionResult.value !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">Valeur :</span>
                        <span className="font-mono font-bold text-lg text-green-900">
                          {executionResult.value} {executionResult.unit || ''}
                        </span>
                      </div>
                    )}
                    {executionResult.status && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">Statut :</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          executionResult.status === 'ok' ? 'bg-green-100 text-green-700' :
                          executionResult.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          executionResult.status === 'critical' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {executionResult.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {/* Informations sur les données */}
                    {executionResult.rawData && (
                      <div className="flex items-center gap-3 text-xs text-green-600">
                        <span>📁 {executionResult.rawData.sourceCount} source(s)</span>
                        <span>📋 {executionResult.rawData.dataCount} enregistrement(s)</span>
                        {executionResult.rawData.filteredCount !== executionResult.rawData.dataCount && (
                          <span>🔍 {executionResult.rawData.filteredCount} après filtre</span>
                        )}
                      </div>
                    )}
                    
                    {executionResult.explanation && (
                      <div className="mt-2 p-2 bg-white/50 rounded text-xs text-green-700">
                        {executionResult.explanation}
                      </div>
                    )}
                    
                    {/* Avertissements */}
                    {executionResult.warnings && executionResult.warnings.length > 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <div className="flex items-center gap-1 text-yellow-700 font-medium mb-1">
                          <MuiIcon name="Warning" size={12} />
                          <span>Avertissements</span>
                        </div>
                        <ul className="text-yellow-600 space-y-0.5">
                          {executionResult.warnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
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

      {/* Modal d'exécution */}
      <CalculationExecutionModal
        isOpen={showExecutionModal}
        onClose={() => setShowExecutionModal(false)}
        steps={executionSteps}
        result={executionResult ? {
          value: executionResult.value,
          unit: executionResult.unit,
          status: executionResult.status,
          explanation: executionResult.explanation,
          mode: executionResult.mode,
        } : null}
        isExecuting={isExecuting}
        onApply={applyResult}
        calculationName={selectedCalculation?.name}
      />
    </div>
  );
}

