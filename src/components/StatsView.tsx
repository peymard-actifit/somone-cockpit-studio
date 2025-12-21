import { useState, useRef, useEffect, useMemo } from 'react';
import type { Domain, Cockpit, Incident, StatsData, StatsPeriodType, ServiceHours } from '../types';
import { useCockpitStore } from '../store/cockpitStore';
import { MuiIcon } from './IconPicker';
import { STATUS_COLORS } from '../types';

interface StatsViewProps {
  domain: Domain;
  cockpit: Cockpit;
  readOnly?: boolean;
}

// Couleurs pour les graphiques
const CHART_COLORS = {
  green: STATUS_COLORS.ok.hex,      // Vert - Aucune alerte
  blue: STATUS_COLORS.information.hex, // Bleu - Alertes non responsables
  red: STATUS_COLORS.critique.hex,  // Rouge - Alertes responsables
};

// Générer des couleurs pour les éléments (évite rouge, violet, orange pour ne pas confondre avec les sévérités)
const ELEMENT_COLORS = [
  '#36A2EB', '#4BC0C0', '#7BC225', '#3498DB', '#1ABC9C',
  '#2ECC71', '#5DADE2', '#48C9B0', '#85C1E9', '#58D68D',
  '#27AE60', '#2980B9', '#17A589', '#45B39D', '#52BE80',
  '#73C6B6', '#7FB3D5', '#A9CCE3', '#A2D9CE', '#ABEBC6',
];

// Heures de service par défaut (8h-18h lun-ven)
const DEFAULT_SERVICE_HOURS: ServiceHours = {
  monday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  tuesday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  wednesday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  thursday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  friday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  saturday: [],
  sunday: [],
};

// Données par défaut pour StatsData
const DEFAULT_STATS_DATA: StatsData = {
  periodType: 'month',
  periodCount: 12,
  serviceHours: DEFAULT_SERVICE_HOURS,
  excludeWeekends: true,
  excludeHolidays: false,
  excludedDates: [],
  columnWidth: 100,
};

// Formater une période pour l'affichage
function formatPeriod(date: Date, periodType: StatsPeriodType): string {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  switch (periodType) {
    case 'day':
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    case 'week':
      const weekNum = getWeekNumber(date);
      return `S${weekNum}`;
    case 'month':
      return `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toLocaleDateString('fr-FR');
  }
}

// Obtenir le numéro de semaine
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Générer les périodes à partir d'une date de début
function generatePeriods(periodType: StatsPeriodType, periodCount: number, startDate?: string): Date[] {
  const periods: Date[] = [];
  const start = startDate ? new Date(startDate) : new Date();

  // Si pas de date de début, on part de maintenant et on recule
  if (!startDate) {
    for (let i = periodCount - 1; i >= 0; i--) {
      const date = new Date(start);
      switch (periodType) {
        case 'day':
          date.setDate(date.getDate() - i);
          break;
        case 'week':
          date.setDate(date.getDate() - i * 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() - i);
          break;
        case 'year':
          date.setFullYear(date.getFullYear() - i);
          break;
      }
      periods.push(date);
    }
  } else {
    // Sinon on part de la date de début et on avance
    for (let i = 0; i < periodCount; i++) {
      const date = new Date(start);
      switch (periodType) {
        case 'day':
          date.setDate(date.getDate() + i);
          break;
        case 'week':
          date.setDate(date.getDate() + i * 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() + i);
          break;
        case 'year':
          date.setFullYear(date.getFullYear() + i);
          break;
      }
      periods.push(date);
    }
  }

  return periods;
}

// Générer les intervalles de service (heures d'ouverture) pour une période
function generateServiceIntervals(
  periodStart: Date,
  periodEnd: Date,
  serviceHours: ServiceHours,
  excludeWeekends: boolean,
  excludedDates: string[]
): Array<{ start: number; end: number }> {
  const intervals: Array<{ start: number; end: number }> = [];
  const current = new Date(periodStart);
  current.setHours(0, 0, 0, 0);

  const dayNames: (keyof ServiceHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  while (current < periodEnd) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Vérifier si le jour est exclu
    if (!excludedDates.includes(dateStr)) {
      // Vérifier si c'est un week-end et si on les exclut
      if (!(excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6))) {
        // Obtenir les heures de service pour ce jour
        const hours = serviceHours[dayNames[dayOfWeek]] || [];

        // Créer des intervalles pour chaque heure de service
        // Regrouper les heures consécutives en intervalles
        if (hours.length > 0) {
          const sortedHours = [...hours].sort((a, b) => a - b);
          let rangeStart = sortedHours[0];
          let rangeEnd = sortedHours[0] + 1;

          for (let i = 1; i < sortedHours.length; i++) {
            if (sortedHours[i] === rangeEnd) {
              // Heure consécutive, étendre l'intervalle
              rangeEnd = sortedHours[i] + 1;
            } else {
              // Nouvelle plage, sauvegarder l'ancienne
              const dayStart = new Date(current);
              dayStart.setHours(rangeStart, 0, 0, 0);
              const dayEnd = new Date(current);
              dayEnd.setHours(rangeEnd, 0, 0, 0);

              // Ne garder que la partie qui intersecte avec la période
              const intervalStart = Math.max(dayStart.getTime(), periodStart.getTime());
              const intervalEnd = Math.min(dayEnd.getTime(), periodEnd.getTime());

              if (intervalEnd > intervalStart) {
                intervals.push({ start: intervalStart, end: intervalEnd });
              }

              rangeStart = sortedHours[i];
              rangeEnd = sortedHours[i] + 1;
            }
          }

          // Sauvegarder le dernier intervalle
          const dayStart = new Date(current);
          dayStart.setHours(rangeStart, 0, 0, 0);
          const dayEnd = new Date(current);
          dayEnd.setHours(rangeEnd, 0, 0, 0);

          const intervalStart = Math.max(dayStart.getTime(), periodStart.getTime());
          const intervalEnd = Math.min(dayEnd.getTime(), periodEnd.getTime());

          if (intervalEnd > intervalStart) {
            intervals.push({ start: intervalStart, end: intervalEnd });
          }
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return intervals;
}

// Intersecter deux ensembles d'intervalles (retourne A ∩ B)
function intersectIntervals(
  intervalsA: Array<{ start: number; end: number }>,
  intervalsB: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (intervalsA.length === 0 || intervalsB.length === 0) return [];

  const result: Array<{ start: number; end: number }> = [];

  for (const a of intervalsA) {
    for (const b of intervalsB) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);

      if (end > start) {
        result.push({ start, end });
      }
    }
  }

  return mergeIntervals(result);
}

// Fusionner les intervalles qui se chevauchent
function mergeIntervals(intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (intervals.length === 0) return [];

  // Trier par date de début
  const sorted = [...intervals].sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end) {
      // Les intervalles se chevauchent ou sont adjacents, on les fusionne
      current = { start: current.start, end: Math.max(current.end, next.end) };
    } else {
      // Pas de chevauchement, on ajoute l'intervalle courant et on passe au suivant
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

// Soustraire les intervalles B des intervalles A (retourne A - B)
function subtractIntervals(
  intervalsA: Array<{ start: number; end: number }>,
  intervalsB: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (intervalsA.length === 0) return [];
  if (intervalsB.length === 0) return intervalsA;

  const result: Array<{ start: number; end: number }> = [];

  for (const a of intervalsA) {
    let remaining = [a];

    for (const b of intervalsB) {
      const newRemaining: Array<{ start: number; end: number }> = [];

      for (const r of remaining) {
        // Pas de chevauchement
        if (b.end <= r.start || b.start >= r.end) {
          newRemaining.push(r);
        } else {
          // Partie avant B
          if (r.start < b.start) {
            newRemaining.push({ start: r.start, end: b.start });
          }
          // Partie après B
          if (r.end > b.end) {
            newRemaining.push({ start: b.end, end: r.end });
          }
        }
      }

      remaining = newRemaining;
    }

    result.push(...remaining);
  }

  return result;
}

// Calculer le temps total d'intervalles en minutes
function calculateTotalMinutes(intervals: Array<{ start: number; end: number }>): number {
  return intervals.reduce((total, interval) => total + (interval.end - interval.start) / 60000, 0);
}

// Collecter les intervalles d'incidents pour une période
function collectIncidentIntervals(
  periodStart: Date,
  periodEnd: Date,
  incidents: Incident[],
  responsibleOnly: boolean | null // null = tous, true = responsables, false = non-responsables
): Array<{ start: number; end: number }> {
  const intervals: Array<{ start: number; end: number }> = [];

  incidents.forEach(incident => {
    // Filtrer par responsabilité si spécifié
    if (responsibleOnly === true && incident.responsible === false) return;
    if (responsibleOnly === false && incident.responsible !== false) return;

    // Filtrer par sévérité (critique ou fatal)
    if (incident.severity !== 'critique' && incident.severity !== 'fatal') return;

    const incidentStart = new Date(incident.startDate);
    const incidentEnd = incident.endDate ? new Date(incident.endDate) : new Date();

    // Calculer l'overlap avec la période
    const overlapStart = Math.max(periodStart.getTime(), incidentStart.getTime());
    const overlapEnd = Math.min(periodEnd.getTime(), incidentEnd.getTime());

    if (overlapEnd > overlapStart) {
      intervals.push({ start: overlapStart, end: overlapEnd });
    }
  });

  return intervals;
}

export default function StatsView({ domain, cockpit, readOnly = false }: StatsViewProps) {
  const { updateDomain } = useCockpitStore();

  // État local
  const [splitPosition, setSplitPosition] = useState(() => domain.statsData?.splitPosition || 50);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [hoveredElementKey, setHoveredElementKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Récupérer les données de stats ou utiliser les valeurs par défaut
  const statsData = domain.statsData || DEFAULT_STATS_DATA;
  const columnWidth = statsData.columnWidth || 100;

  // Récupérer les incidents selon la source configurée
  const incidents = useMemo(() => {
    // Si "all" ou non défini, prendre toutes les alertes de tous les domaines Alertes
    if (!statsData.alertsDomainId || statsData.alertsDomainId === 'all') {
      const allIncidents: Incident[] = [];
      cockpit.domains.forEach(d => {
        if (d.templateType === 'alerts' && d.alertsData?.incidents) {
          allIncidents.push(...d.alertsData.incidents);
        }
      });
      return allIncidents;
    }
    // Sinon, chercher le domaine spécifique
    const alertsDomain = cockpit.domains.find(d => d.id === statsData.alertsDomainId);
    return alertsDomain?.alertsData?.incidents || [];
  }, [cockpit.domains, statsData.alertsDomainId]);

  // Vérifier s'il y a au moins un domaine Alertes
  const hasAlertsDomain = cockpit.domains.some(d => d.templateType === 'alerts');

  // Générer les périodes
  const periods = useMemo(() =>
    generatePeriods(statsData.periodType, statsData.periodCount, statsData.startDate),
    [statsData.periodType, statsData.periodCount, statsData.startDate]
  );

  // Calculer les données pour le graphique du haut (barres à 100%)
  const topChartData = useMemo(() => {
    return periods.map((periodDate) => {
      const periodStart = new Date(periodDate);
      let periodEnd: Date;

      switch (statsData.periodType) {
        case 'day':
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'week':
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
        case 'month':
          periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
        case 'year':
          periodEnd = new Date(periodStart);
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          break;
        default:
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
      }

      // Générer les intervalles de service (heures d'ouverture)
      const serviceIntervals = generateServiceIntervals(
        periodStart,
        periodEnd,
        statsData.serviceHours,
        statsData.excludeWeekends,
        statsData.excludedDates
      );

      // Temps de service total (en heures)
      const totalServiceHours = calculateTotalMinutes(serviceIntervals) / 60;

      // Collecter les intervalles d'alertes responsables (rouge) - sur toute la période
      const rawResponsibleIntervals = mergeIntervals(
        collectIncidentIntervals(periodStart, periodEnd, incidents, true)
      );

      // Collecter les intervalles d'alertes non-responsables - sur toute la période
      const rawNonResponsibleIntervals = mergeIntervals(
        collectIncidentIntervals(periodStart, periodEnd, incidents, false)
      );

      // IMPORTANT: Intersecter avec les heures de service pour ne compter que l'indisponibilité
      // pendant les heures d'ouverture (pas la nuit, pas les week-ends exclus, etc.)
      const responsibleIntervals = intersectIntervals(rawResponsibleIntervals, serviceIntervals);
      const nonResponsibleIntervals = intersectIntervals(rawNonResponsibleIntervals, serviceIntervals);

      // Bleu = non-responsables MOINS responsables (le bleu ne s'affiche que là où il n'y a pas de rouge)
      const blueOnlyIntervals = subtractIntervals(nonResponsibleIntervals, responsibleIntervals);

      // Calculer les durées (uniquement pendant les heures de service)
      const responsibleDowntime = calculateTotalMinutes(responsibleIntervals);
      const blueOnlyDowntime = calculateTotalMinutes(blueOnlyIntervals);

      // Convertir en pourcentages
      const totalMinutes = totalServiceHours * 60;
      const redPercent = totalMinutes > 0 ? Math.min(100, (responsibleDowntime / totalMinutes) * 100) : 0;
      const bluePercent = totalMinutes > 0 ? Math.min(100 - redPercent, (blueOnlyDowntime / totalMinutes) * 100) : 0;
      const greenPercent = 100 - redPercent - bluePercent;

      return {
        label: formatPeriod(periodDate, statsData.periodType),
        green: Math.max(0, greenPercent),
        blue: bluePercent,
        red: redPercent,
      };
    });
  }, [periods, statsData, incidents]);

  // Calculer les données pour le graphique du bas (barres par élément)
  const bottomChartData = useMemo(() => {
    // Grouper les incidents par élément (en utilisant catégorie + élément comme clé unique)
    const elementMap = new Map<string, { name: string; color: string; durations: number[] }>();
    let colorIndex = 0;

    incidents.forEach(incident => {
      const categoryName = incident.targetCategoryName || '';
      const elementName = incident.targetElementName || 'Inconnu';
      // Utiliser catégorie + élément comme clé unique (pas l'ID qui peut être absent)
      const elementKey = `${categoryName}::${elementName}`;
      // Afficher Catégorie / Élément si catégorie disponible
      const displayName = categoryName ? `${categoryName} / ${elementName}` : elementName;

      if (!elementMap.has(elementKey)) {
        elementMap.set(elementKey, {
          name: displayName,
          color: ELEMENT_COLORS[colorIndex % ELEMENT_COLORS.length],
          durations: new Array(periods.length).fill(0),
        });
        colorIndex++;
      }

      // Calculer la durée de l'incident pour chaque période
      periods.forEach((periodDate, periodIndex) => {
        const periodStart = new Date(periodDate);
        let periodEnd: Date;

        switch (statsData.periodType) {
          case 'day':
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 1);
            break;
          case 'week':
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 7);
            break;
          case 'month':
            periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            break;
          case 'year':
            periodEnd = new Date(periodStart);
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            break;
          default:
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 1);
        }

        const incidentStart = new Date(incident.startDate);
        const incidentEnd = incident.endDate ? new Date(incident.endDate) : new Date();

        // Calculer l'overlap
        const overlapStart = Math.max(periodStart.getTime(), incidentStart.getTime());
        const overlapEnd = Math.min(periodEnd.getTime(), incidentEnd.getTime());

        if (overlapEnd > overlapStart) {
          const element = elementMap.get(elementKey)!;
          element.durations[periodIndex] += (overlapEnd - overlapStart) / 3600000; // En heures
        }
      });
    });

    // Calculer la durée maximale par colonne (somme des durées de tous les éléments)
    const columnTotals = new Array(periods.length).fill(0);
    elementMap.forEach(element => {
      element.durations.forEach((duration, index) => {
        columnTotals[index] += duration;
      });
    });
    const maxColumnTotal = Math.max(...columnTotals, 1);

    // Convertir en tableau avec clé et total
    const elementsArray = Array.from(elementMap.entries()).map(([key, value]) => ({
      key,
      name: value.name,
      color: value.color,
      durations: value.durations,
      totalDuration: value.durations.reduce((sum, d) => sum + d, 0),
    }));

    // Calculer la somme totale des durées et les totaux par période
    const periodTotals = periods.map((_, i) =>
      elementsArray.reduce((sum, el) => sum + el.durations[i], 0)
    );
    const grandTotal = elementsArray.reduce((sum, el) => sum + el.totalDuration, 0);

    return {
      elements: elementsArray,
      maxDuration: maxColumnTotal,
      periodTotals,
      grandTotal,
    };
  }, [incidents, periods, statsData.periodType]);

  // Calculer la moyenne du pourcentage rouge sur toutes les périodes
  const averageRedPercent = useMemo(() => {
    if (topChartData.length === 0) return 0;
    const totalRed = topChartData.reduce((sum, data) => sum + data.red, 0);
    return totalRed / topChartData.length;
  }, [topChartData]);

  // Gestion du redimensionnement du séparateur
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit(true);
  };

  useEffect(() => {
    if (!isResizingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPosition = ((e.clientY - rect.top) / rect.height) * 100;
      setSplitPosition(Math.max(20, Math.min(80, newPosition)));
    };

    const handleMouseUp = () => {
      setIsResizingSplit(false);
      updateDomain(domain.id, {
        statsData: {
          ...statsData,
          splitPosition,
        },
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplit, domain.id, statsData, splitPosition, updateDomain]);

  // Échelle pour le graphe du haut (0% à 100%)
  const topScaleLabels = ['100%', '80%', '60%', '40%', '20%', '0%'];

  // Échelle pour le graphe du bas (durées)
  const bottomScaleLabels = useMemo(() => {
    const max = bottomChartData.maxDuration;
    if (max <= 0) return ['0h'];
    return [
      `${max.toFixed(0)}h`,
      `${(max * 0.8).toFixed(0)}h`,
      `${(max * 0.6).toFixed(0)}h`,
      `${(max * 0.4).toFixed(0)}h`,
      `${(max * 0.2).toFixed(0)}h`,
      '0h',
    ];
  }, [bottomChartData.maxDuration]);

  // Message si pas de domaine Alertes
  if (!hasAlertsDomain) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F5F7FA]">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-[#E2E8F0]">
          <MuiIcon name="Warning" size={48} className="mx-auto mb-4 text-[#FFB74D]" />
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">Aucun domaine Alertes trouvé</h3>
          <p className="text-[#64748B]">
            Créez d'abord un domaine de type "Alertes" pour visualiser les statistiques.
          </p>
        </div>
      </div>
    );
  }

  // Largeur calculée pour le conteneur des barres
  const barsContainerStyle = columnWidth < 100 ? {
    width: `${columnWidth}%`,
    marginLeft: 'auto',
    marginRight: 'auto',
  } : {};

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-[#F5F7FA]"
    >
      {/* Partie haute : Graphique d'indisponibilité (barres empilées à 100%) */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-1 overflow-hidden"
        style={{ height: `${splitPosition}%` }}
      >
        <div className="h-full bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-[#1E3A5F] mb-1">
            Indisponibilité des Services C1
            <span className="ml-2 text-xs font-normal text-[#64748B]">
              (moy. {averageRedPercent.toFixed(1)}% indispo.)
            </span>
          </h3>

          {/* Légende - Justifiée à gauche */}
          <div className="flex gap-4 mb-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.green }} />
              <span className="text-[#64748B]">Disponible</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.blue }} />
              <span className="text-[#64748B]">Indispo. non resp.</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.red }} />
              <span className="text-[#64748B]">Indispo. responsable</span>
            </div>
          </div>

          {/* Graphique avec échelle */}
          <div className="flex-1 flex">
            {/* Échelle à gauche */}
            <div className="w-10 flex flex-col justify-between pr-1 text-right">
              {topScaleLabels.map((label, i) => (
                <span key={i} className="text-[9px] text-[#94A3B8]">{label}</span>
              ))}
            </div>

            {/* Zone des barres */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-end border-l border-b border-[#E2E8F0]" style={barsContainerStyle}>
                {topChartData.map((data, index) => (
                  <div key={index} className="flex-1 flex flex-col h-full px-0.5">
                    {/* Barre */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="w-full rounded-t overflow-hidden" style={{ height: '100%' }}>
                        {/* Rouge en haut */}
                        {data.red > 0 && (
                          <div
                            className="w-full"
                            style={{ height: `${data.red}%`, backgroundColor: CHART_COLORS.red }}
                            title={`Indispo. responsable: ${data.red.toFixed(1)}%`}
                          />
                        )}
                        {/* Bleu au milieu */}
                        {data.blue > 0 && (
                          <div
                            className="w-full"
                            style={{ height: `${data.blue}%`, backgroundColor: CHART_COLORS.blue }}
                            title={`Indispo. non resp.: ${data.blue.toFixed(1)}%`}
                          />
                        )}
                        {/* Vert en bas */}
                        <div
                          className="w-full"
                          style={{ height: `${data.green}%`, backgroundColor: CHART_COLORS.green }}
                          title={`Disponible: ${data.green.toFixed(1)}%`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Labels des périodes */}
              <div className="flex" style={barsContainerStyle}>
                {topChartData.map((data, index) => (
                  <div key={index} className="flex-1 text-center px-0.5">
                    <span className="text-[9px] text-[#64748B]">{data.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Séparateur redimensionnable */}
      {!readOnly && (
        <div
          className={`h-1 bg-[#E2E8F0] cursor-row-resize hover:bg-[#CBD5E1] transition-colors flex items-center justify-center mx-4 ${isResizingSplit ? 'bg-[#94A3B8]' : ''}`}
          onMouseDown={handleSplitMouseDown}
        >
          <div className="w-12 h-0.5 bg-[#94A3B8] rounded-full" />
        </div>
      )}
      {readOnly && <div className="h-1 bg-[#E2E8F0] mx-4" />}

      {/* Partie basse : Graphique des durées d'alertes par élément */}
      <div
        className="flex-1 px-4 pb-4 pt-1 overflow-hidden"
        style={{ height: `${100 - splitPosition}%` }}
      >
        <div className="h-full bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-[#1E3A5F] mb-1">
            Indisponibilités par systèmes critiques C1
            <span className="ml-2 text-xs font-normal text-[#64748B]">
              ({bottomChartData.grandTotal.toFixed(1)}h total)
            </span>
          </h3>

          {/* Graphique avec échelle */}
          <div className="flex-1 flex min-h-0">
            {/* Échelle à gauche */}
            <div className="w-10 flex flex-col justify-between pr-1 text-right">
              {bottomScaleLabels.map((label, i) => (
                <span key={i} className="text-[9px] text-[#94A3B8]">{label}</span>
              ))}
            </div>

            {/* Zone des barres */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex items-end border-l border-b border-[#E2E8F0] min-h-0" style={barsContainerStyle}>
                {periods.map((_, periodIndex) => {
                  // Calculer la hauteur totale de la colonne
                  const columnTotal = bottomChartData.elements.reduce(
                    (sum, el) => sum + el.durations[periodIndex], 0
                  );
                  const columnHeightPercent = bottomChartData.maxDuration > 0
                    ? (columnTotal / bottomChartData.maxDuration) * 100
                    : 0;

                  return (
                    <div key={periodIndex} className="flex-1 flex flex-col h-full px-0.5 justify-end">
                      {/* Conteneur de la barre avec hauteur proportionnelle */}
                      <div
                        className="w-full rounded-t overflow-hidden flex flex-col"
                        style={{ height: `${columnHeightPercent}%` }}
                      >
                        {bottomChartData.elements.map((element, elemIndex) => {
                          const duration = element.durations[periodIndex];
                          // Hauteur relative à la somme de la colonne
                          const heightPercent = columnTotal > 0
                            ? (duration / columnTotal) * 100
                            : 0;
                          if (heightPercent <= 0) return null;

                          const isHovered = hoveredElementKey === element.key;
                          const isOtherHovered = hoveredElementKey !== null && hoveredElementKey !== element.key;

                          return (
                            <div
                              key={elemIndex}
                              className="w-full flex-shrink-0 cursor-pointer transition-all duration-150"
                              style={{
                                height: `${heightPercent}%`,
                                backgroundColor: element.color,
                                minHeight: '2px',
                                opacity: isOtherHovered ? 0.3 : 1,
                                boxShadow: isHovered ? 'inset 0 0 0 2px rgba(255,255,255,0.8)' : 'none',
                                transform: isHovered ? 'scaleX(1.05)' : 'scaleX(1)',
                              }}
                              title={`${element.name}\nCette période: ${duration.toFixed(1)}h\nTotal toutes périodes: ${element.totalDuration.toFixed(1)}h`}
                              onMouseEnter={() => setHoveredElementKey(element.key)}
                              onMouseLeave={() => setHoveredElementKey(null)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Labels des périodes avec somme des heures (alignés avec le graphe du haut) */}
              <div className="flex" style={barsContainerStyle}>
                {periods.map((periodDate, index) => (
                  <div key={index} className="flex-1 text-center px-0.5">
                    <span className="text-[9px] text-[#64748B] block">
                      {formatPeriod(periodDate, statsData.periodType)}
                    </span>
                    <span className="text-[8px] text-[#94A3B8] block">
                      {bottomChartData.periodTotals[index].toFixed(1)}h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Légende - En dessous du graphe, compacte et alignée */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
            {bottomChartData.elements.map((element, index) => {
              const isHovered = hoveredElementKey === element.key;
              const isOtherHovered = hoveredElementKey !== null && hoveredElementKey !== element.key;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-1 cursor-pointer px-1 py-0 rounded transition-all duration-150 ${isHovered ? 'bg-[#F1F5F9] ring-1 ring-[#3B82F6]' : ''
                    }`}
                  style={{ opacity: isOtherHovered ? 0.4 : 1 }}
                  onMouseEnter={() => setHoveredElementKey(element.key)}
                  onMouseLeave={() => setHoveredElementKey(null)}
                  title={`Total: ${element.totalDuration.toFixed(1)}h sur toutes les périodes`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: element.color }}
                  />
                  <span className={`text-[10px] leading-tight ${isHovered ? 'text-[#1E3A5F] font-medium' : 'text-[#64748B]'}`}>
                    {element.name}
                    {isHovered && (
                      <span className="ml-1 text-[#3B82F6] font-semibold">
                        ({element.totalDuration.toFixed(1)}h)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {bottomChartData.elements.length === 0 && (
              <span className="text-[#94A3B8]">Aucune alerte</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



