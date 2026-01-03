import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MuiIcon } from '../IconPicker';

interface ExecutionStep {
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
  timestamp: string;
}

interface CalculationExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: ExecutionStep[];
  result: {
    value?: string;
    unit?: string;
    status?: string;
    explanation?: string;
    mode?: string;
  } | null;
  isExecuting: boolean;
  onApply: () => void;
  calculationName?: string;
}

export default function CalculationExecutionModal({
  isOpen,
  onClose,
  steps,
  result,
  isExecuting,
  onApply,
  calculationName,
}: CalculationExecutionModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand de nouvelles étapes arrivent
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  if (!isOpen) return null;

  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'pending':
        return <MuiIcon name="Schedule" size={16} className="text-gray-400" />;
      case 'running':
        return <MuiIcon name="Refresh" size={16} className="text-blue-500 animate-spin" />;
      case 'success':
        return <MuiIcon name="CheckCircle" size={16} className="text-green-500" />;
      case 'error':
        return <MuiIcon name="Error" size={16} className="text-red-500" />;
      case 'skipped':
        return <MuiIcon name="RemoveCircle" size={16} className="text-yellow-500" />;
      default:
        return <MuiIcon name="Circle" size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'pending': return 'border-gray-200 bg-gray-50';
      case 'running': return 'border-blue-200 bg-blue-50';
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'skipped': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      validation: '✓ Validation',
      fetch_sources: '📥 Récupération sources',
      fetch_source: '📄 Source',
      validate_source: '🔍 Validation source',
      parse_definition: '📝 Analyse définition',
      execute: '⚡ Exécution',
      no_data: '⚠️ Données manquantes',
      error: '❌ Erreur',
      ai_fallback: '🤖 Assistance IA',
    };
    return labels[action] || action;
  };

  const hasErrors = steps.some(s => s.status === 'error');
  const allSuccess = !isExecuting && steps.length > 0 && steps.every(s => s.status === 'success' || s.status === 'skipped');

  // Utiliser un portail pour rendre le modal en dehors du contexte de stacking
  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isExecuting ? 'bg-blue-100' : allSuccess ? 'bg-green-100' : hasErrors ? 'bg-red-100' : 'bg-gray-100'}`}>
              {isExecuting ? (
                <MuiIcon name="Refresh" size={24} className="text-blue-600 animate-spin" />
              ) : allSuccess ? (
                <MuiIcon name="CheckCircle" size={24} className="text-green-600" />
              ) : hasErrors ? (
                <MuiIcon name="Error" size={24} className="text-red-600" />
              ) : (
                <MuiIcon name="PlayArrow" size={24} className="text-gray-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Exécution du calcul
              </h2>
              {calculationName && (
                <p className="text-sm text-gray-500">{calculationName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MuiIcon name="Close" size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Steps */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {steps.length === 0 && isExecuting && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <MuiIcon name="Refresh" size={24} className="animate-spin mr-2" />
              <span>Démarrage de l'exécution...</span>
            </div>
          )}
          
          {steps.map((step, index) => (
            <div
              key={`${step.step}-${index}`}
              className={`p-3 rounded-lg border ${getStatusColor(step.status)} transition-all duration-300`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 bg-white/60 rounded">
                      {getActionLabel(step.action)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={`text-sm ${step.status === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
                    {step.message}
                  </p>
                  {step.details && (
                    <div className="mt-2 text-xs font-mono bg-white/50 rounded p-2 text-gray-600 overflow-x-auto">
                      {typeof step.details === 'object' 
                        ? Object.entries(step.details).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-gray-400">{k}:</span>
                              <span className="text-gray-700">{String(v)}</span>
                            </div>
                          ))
                        : String(step.details)
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Result */}
        {result && !isExecuting && (
          <div className={`mx-5 mb-4 p-4 rounded-lg border-2 ${
            result.status === 'ok' ? 'border-green-300 bg-green-50' :
            result.status === 'warning' ? 'border-yellow-300 bg-yellow-50' :
            result.status === 'critical' ? 'border-red-300 bg-red-50' :
            'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Résultat final</span>
              {result.mode && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  result.mode === 'real-data' ? 'bg-blue-100 text-blue-700' :
                  result.mode === 'ai-assisted' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {result.mode === 'real-data' ? '📊 Données réelles' :
                   result.mode === 'ai-assisted' ? '🤖 IA' : result.mode}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{result.value}</span>
              {result.unit && (
                <span className="text-lg text-gray-500">{result.unit}</span>
              )}
            </div>
            {result.explanation && (
              <p className="mt-2 text-sm text-gray-600">{result.explanation}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {steps.length} étape(s) • {steps.filter(s => s.status === 'success').length} réussie(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              Fermer
            </button>
            {result && !isExecuting && (
              <button
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <MuiIcon name="Check" size={16} />
                <span>Appliquer au sous-élément</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Rendre via un portail dans le body pour éviter les problèmes de z-index
  return createPortal(modalContent, document.body);
}
