import type { Element, Domain, TileStatus } from '../types';
import { STATUS_COLORS, STATUS_LABELS, getEffectiveStatus } from '../types';
import { useCockpitStore } from '../store/cockpitStore';

// Ordre de priorité des statuts (du plus critique au moins critique)
const STATUS_PRIORITY_ORDER: TileStatus[] = ['fatal', 'critique', 'mineur', 'ok', 'information', 'deconnecte'];

interface StatusSummaryProps {
  elements: Element[];
  domains?: Domain[];
  compact?: boolean;
}

/**
 * Composant affichant un résumé des statuts par criticité
 * Triés par criticité décroissante, ne montrant que les couleurs présentes
 */
export default function StatusSummary({ elements, domains, compact = false }: StatusSummaryProps) {
  const { currentCockpit } = useCockpitStore();
  
  // Compter les éléments par statut effectif
  const statusCounts: Record<TileStatus, number> = {
    fatal: 0,
    critique: 0,
    mineur: 0,
    ok: 0,
    information: 0,
    deconnecte: 0,
    herite: 0,
    herite_domaine: 0,
  };

  // Options pour les données historiques
  const historyOptions = { dataHistory: currentCockpit?.dataHistory, selectedDataDate: currentCockpit?.selectedDataDate };

  elements.forEach(element => {
    const effectiveStatus = domains ? getEffectiveStatus(element, domains, undefined, historyOptions) : element.status;
    if (statusCounts[effectiveStatus] !== undefined) {
      statusCounts[effectiveStatus]++;
    }
  });

  // Filtrer les statuts présents et trier par priorité décroissante
  const presentStatuses = STATUS_PRIORITY_ORDER.filter(status => statusCounts[status] > 0);

  if (presentStatuses.length === 0) return null;

  return (
    <div className={`${compact ? 'space-y-0.5' : 'space-y-1'} mt-2`}>
      {presentStatuses.map(status => {
        const colors = STATUS_COLORS[status];
        const count = statusCounts[status];
        const label = STATUS_LABELS[status];

        return (
          <div key={status} className="flex items-center gap-2">
            <div
              className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full flex-shrink-0`}
              style={{ backgroundColor: colors?.hex || '#9E9E9E' }}
            />
            <span className={`${compact ? 'text-xs' : 'text-xs'} text-[#64748B]`}>
              {count} {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Formatte la date de dernière mise à jour
 */
export function formatLastUpdate(date?: Date | string | null): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
