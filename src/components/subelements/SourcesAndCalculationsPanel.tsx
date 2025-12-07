import { useState } from 'react';
import type { SubElement, DataSource, Calculation } from '../../types';
import DataSourceManager from './DataSourceManager';
import CalculationManager from './CalculationManager';
import CalculationExplanation from './CalculationExplanation';
import { MuiIcon } from '../IconPicker';

interface SourcesAndCalculationsPanelProps {
  subElement: SubElement;
  onUpdate: (updates: Partial<SubElement>) => void;
}

export default function SourcesAndCalculationsPanel({ subElement, onUpdate }: SourcesAndCalculationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'sources' | 'calculations' | 'explanation'>('sources');

  const handleSourcesUpdate = (sources: DataSource[]) => {
    onUpdate({ sources });
  };

  const handleCalculationsUpdate = (calculations: Calculation[]) => {
    onUpdate({ calculations });
  };

  const selectedCalculation = subElement.calculations && subElement.calculations.length > 0 
    ? subElement.calculations[0] 
    : null;

  return (
    <div className="space-y-4">
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

