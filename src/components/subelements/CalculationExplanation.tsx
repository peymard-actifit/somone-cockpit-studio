import { useEffect, useState } from 'react';
import type { Calculation, DataSource, CalculationExplanation as CalculationExplanationType } from '../../types';
import { MuiIcon } from '../IconPicker';

interface CalculationExplanationProps {
  calculation: Calculation;
  sources: DataSource[];
}

export default function CalculationExplanation({ calculation, sources }: CalculationExplanationProps) {
  const [explanation, setExplanation] = useState<CalculationExplanationType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateExplanation();
  }, [calculation, sources]);

  const generateExplanation = async () => {
    setIsGenerating(true);
    
    // Récupérer les sources utilisées
    const usedSources = sources.filter(s => calculation.sources.includes(s.id));
    
    // Générer une explication en langage naturel
    let calculationDescription = '';
    let extractedValues: any = {};
    
    try {
      // Parser la définition du calcul
      let parsedDefinition: any = {};
      try {
        parsedDefinition = JSON.parse(calculation.definition);
      } catch {
        // Si ce n'est pas du JSON, traiter comme du texte brut
        parsedDefinition = { raw: calculation.definition };
      }

      // Générer la description du calcul
      if (parsedDefinition.operation) {
        const operations: Record<string, string> = {
          sum: 'somme',
          average: 'moyenne',
          min: 'minimum',
          max: 'maximum',
          count: 'compte',
          filter: 'filtre',
          transform: 'transformation',
        };
        calculationDescription = `Effectue une ${operations[parsedDefinition.operation] || parsedDefinition.operation}`;
        
        if (parsedDefinition.filter) {
          calculationDescription += ` en filtrant sur ${parsedDefinition.filter.field || 'un champ'}`;
          if (parsedDefinition.filter.value) {
            calculationDescription += ` avec la valeur "${parsedDefinition.filter.value}"`;
          }
        }
        
        if (parsedDefinition.field) {
          calculationDescription += ` du champ "${parsedDefinition.field}"`;
        }
      } else {
        calculationDescription = calculation.description || 'Calcul personnalisé basé sur la définition fournie';
      }

      // Simuler des valeurs extraites (dans un vrai cas, elles viendraient de l'exécution réelle)
      usedSources.forEach(source => {
        extractedValues[source.id] = {
          sourceName: source.name,
          sampleData: 'Données extraites',
          fieldCount: source.fields?.split(',').length || 0,
        };
      });

      // Générer l'explication complète
      const generatedExplanation: CalculationExplanationType = {
        calculationId: calculation.id,
        summary: `Le calcul "${calculation.name}" ${calculationDescription.toLowerCase()} en utilisant ${usedSources.length} source(s) de données.`,
        sourcesUsed: usedSources.map(source => ({
          sourceId: source.id,
          sourceName: source.name,
          parameters: {
            type: source.type,
            location: source.location,
            fields: source.fields,
            connection: source.connection,
          },
          extractedValues: extractedValues[source.id],
        })),
        calculationDescription,
        result: calculation.result,
      };

      setExplanation(generatedExplanation);
    } catch (error) {
      console.error('Erreur lors de la génération de l\'explication:', error);
      setExplanation({
        calculationId: calculation.id,
        summary: 'Erreur lors de la génération de l\'explication',
        sourcesUsed: [],
        calculationDescription: calculation.description || '',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] text-center">
        <div className="animate-spin inline-block">
          <MuiIcon name="Loader2" size={24} className="text-[#64748B]" />
        </div>
        <p className="text-sm text-[#64748B] mt-2">Génération de l'explication...</p>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0] text-center">
        <p className="text-sm text-[#64748B]">Aucune explication disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <MuiIcon name="Info" size={20} className="text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h5 className="text-sm font-semibold text-blue-900 mb-1">Résumé</h5>
            <p className="text-sm text-blue-800">{explanation.summary}</p>
          </div>
        </div>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-[#1E3A5F] mb-2 flex items-center gap-2">
            <MuiIcon name="Storage" size={16} />
          Sources utilisées
        </h5>
        <div className="space-y-2">
          {explanation.sourcesUsed.map((sourceInfo, index) => (
            <div
              key={sourceInfo.sourceId || index}
              className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]"
            >
              <div className="flex items-center gap-2 mb-2">
                <MuiIcon name="Storage" size={14} className="text-[#64748B]" />
                <span className="text-sm font-medium text-[#1E3A5F]">{sourceInfo.sourceName}</span>
              </div>
              <div className="ml-6 space-y-1">
                <div className="text-xs text-[#64748B]">
                  <span className="font-medium">Type :</span> {sourceInfo.parameters.type}
                </div>
                {sourceInfo.parameters.location && (
                  <div className="text-xs text-[#64748B]">
                    <span className="font-medium">Emplacement :</span> {sourceInfo.parameters.location}
                  </div>
                )}
                {sourceInfo.parameters.fields && (
                  <div className="text-xs text-[#64748B]">
                    <span className="font-medium">Champs :</span> {sourceInfo.parameters.fields}
                  </div>
                )}
                {sourceInfo.extractedValues && (
                  <div className="mt-2 p-2 bg-white rounded border border-[#E2E8F0]">
                    <div className="text-xs text-[#94A3B8] mb-1">Valeurs extraites :</div>
                    <div className="text-xs text-[#1E3A5F]">
                      {sourceInfo.extractedValues.sampleData} ({sourceInfo.extractedValues.fieldCount} champ(s))
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-[#1E3A5F] mb-2 flex items-center gap-2">
            <MuiIcon name="Tune" size={16} />
          Description du calcul
        </h5>
        <div className="p-3 bg-[#F5F7FA] rounded-lg border border-[#E2E8F0]">
          <p className="text-sm text-[#1E3A5F]">{explanation.calculationDescription}</p>
        </div>
      </div>

      {explanation.result !== undefined && (
        <div>
          <h5 className="text-sm font-semibold text-[#1E3A5F] mb-2 flex items-center gap-2">
            <MuiIcon name="CheckCircle" size={16} />
            Résultat
          </h5>
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <pre className="text-sm text-green-800 font-mono whitespace-pre-wrap break-words">
              {typeof explanation.result === 'object' 
                ? JSON.stringify(explanation.result, null, 2) 
                : String(explanation.result)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

