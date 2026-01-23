import { useMemo } from 'react';
import type { Domain, Cockpit, Zone } from '../types';
import { MuiIcon } from './IconPicker';

interface LibraryViewProps {
  domain: Domain;  // Requis par DomainView mais non utilisé directement
  cockpit: Cockpit;
  readOnly?: boolean;  // Requis par DomainView mais non utilisé directement
}

// Interface pour un template avec son état d'utilisation
interface TemplateInfo {
  name: string;
  icon?: string;
  isUsed: boolean; // true si au moins un élément utilise ce template
  elementCount: number; // Nombre d'éléments utilisant ce template
}

// Interface pour une zone avec ses templates
interface ZoneWithTemplates {
  zone: Zone;
  templates: TemplateInfo[];
}

export default function LibraryView({ cockpit }: LibraryViewProps) {
  // Récupérer toutes les zones de la maquette
  const zones = useMemo(() => {
    return (cockpit as any).zones || [];
  }, [cockpit]);

  // Protection: s'assurer que cockpit.domains existe
  const cockpitDomains = cockpit?.domains || [];

  // Récupérer tous les templates uniques et leurs icônes
  const allTemplates = useMemo(() => {
    const templateMap = new Map<string, { icon?: string; elementCount: number }>();
    const templateIcons = (cockpit as any).templateIcons || {};

    // Parcourir tous les domaines pour trouver les templates - protection pour les tableaux
    cockpitDomains.forEach(d => {
      // Templates depuis le domaine (ancien système)
      if (d.templateName && !templateMap.has(d.templateName)) {
        templateMap.set(d.templateName, { 
          icon: templateIcons[d.templateName], 
          elementCount: 0 
        });
      }

      // Templates depuis les éléments (nouveau système)
      (d.categories || []).forEach(c => {
        (c.elements || []).forEach(e => {
          if (e.template) {
            const existing = templateMap.get(e.template);
            if (existing) {
              existing.elementCount++;
            } else {
              templateMap.set(e.template, { 
                icon: templateIcons[e.template], 
                elementCount: 1 
              });
            }
          }
        });
      });
    });

    return templateMap;
  }, [cockpit]);

  // Associer les templates aux zones
  const zonesWithTemplates = useMemo((): ZoneWithTemplates[] => {
    // Si pas de zones, créer une zone "par défaut" avec tous les templates
    if (zones.length === 0) {
      const templates: TemplateInfo[] = [];
      allTemplates.forEach((info, name) => {
        templates.push({
          name,
          icon: info.icon,
          isUsed: info.elementCount > 0,
          elementCount: info.elementCount,
        });
      });
      // Trier : utilisés en premier, puis par nom
      templates.sort((a, b) => {
        if (a.isUsed !== b.isUsed) return a.isUsed ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return [{
        zone: { id: 'default', name: 'Tous les templates', icon: 'Category' } as Zone,
        templates,
      }];
    }

    // Pour chaque zone, trouver les templates associés via les éléments
    const result: ZoneWithTemplates[] = [];
    const templatesInZones = new Set<string>();

    zones.forEach((zone: Zone) => {
      const zoneTemplates: TemplateInfo[] = [];

      // Trouver les éléments dans cette zone et leurs templates - protection pour les tableaux
      cockpitDomains.forEach(d => {
        (d.categories || []).forEach(c => {
          (c.elements || []).forEach(e => {
            if (e.zone === zone.name && e.template) {
              // Vérifier si ce template n'est pas déjà ajouté pour cette zone
              if (!zoneTemplates.some(t => t.name === e.template)) {
                const templateInfo = allTemplates.get(e.template);
                zoneTemplates.push({
                  name: e.template,
                  icon: templateInfo?.icon,
                  isUsed: (templateInfo?.elementCount || 0) > 0,
                  elementCount: templateInfo?.elementCount || 0,
                });
                templatesInZones.add(e.template);
              }
            }
          });
        });
      });

      // Ajouter aussi les templates du domaine qui ont cette zone (si applicable)
      // Trier : utilisés en premier, puis par nom
      zoneTemplates.sort((a, b) => {
        if (a.isUsed !== b.isUsed) return a.isUsed ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      result.push({ zone, templates: zoneTemplates });
    });

    // Ajouter une zone "Sans zone" pour les templates non associés à une zone
    const unzonedTemplates: TemplateInfo[] = [];
    allTemplates.forEach((info, name) => {
      if (!templatesInZones.has(name)) {
        unzonedTemplates.push({
          name,
          icon: info.icon,
          isUsed: info.elementCount > 0,
          elementCount: info.elementCount,
        });
      }
    });

    if (unzonedTemplates.length > 0) {
      unzonedTemplates.sort((a, b) => {
        if (a.isUsed !== b.isUsed) return a.isUsed ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      result.push({
        zone: { id: 'unzoned', name: 'Sans zone', icon: 'Block' } as Zone,
        templates: unzonedTemplates,
      });
    }

    return result;
  }, [zones, allTemplates, cockpit]);

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-auto">
      {/* En-tête */}
      <div className="p-6 border-b border-[#E2E8F0] bg-white">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Bibliothèque</h1>
        <p className="text-sm text-[#64748B] mt-1">Tous les éléments supervisables.</p>
      </div>

      {/* Contenu principal - Grille CSS pour alignement */}
      <div className="flex-1 p-6 overflow-auto">
        {zonesWithTemplates.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MuiIcon name="LibraryBooks" size={40} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-[#1E3A5F] mb-2">Bibliothèque vide</h3>
            <p className="text-[#64748B]">Aucune zone ou template n'a été défini dans cette maquette.</p>
          </div>
        ) : (
          <div 
            className="grid gap-x-6 gap-y-4"
            style={{ gridTemplateColumns: 'max-content 1fr' }}
          >
            {zonesWithTemplates.map(({ zone, templates }) => (
              <>
                {/* Colonne Zone (comme une catégorie) */}
                <div 
                  key={`zone-${zone.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  {zone.icon && (
                    <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MuiIcon name={zone.icon} size={24} className="text-white" />
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-[#1E3A5F] whitespace-nowrap">
                    {zone.name}
                  </h3>
                </div>

                {/* Colonne Templates (comme des éléments alignés) */}
                <div 
                  key={`templates-${zone.id}`}
                  className="flex flex-wrap gap-3 items-center py-3"
                >
                  {templates.length === 0 ? (
                    <span className="text-sm text-[#94A3B8] italic">Aucun template</span>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.name}
                        className={`
                          flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all
                          ${template.isUsed 
                            ? 'bg-white border-[#E2E8F0] shadow-sm' 
                            : 'bg-[#F1F5F9] border-[#E2E8F0]'
                          }
                        `}
                        title={template.isUsed 
                          ? `Utilisé par ${template.elementCount} élément${template.elementCount > 1 ? 's' : ''}` 
                          : 'Non utilisé par aucun élément'
                        }
                      >
                        {/* Icône */}
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center
                          ${template.isUsed 
                            ? 'bg-[#E3F2FD]' 
                            : 'bg-[#E2E8F0]'
                          }
                        `}>
                          <MuiIcon 
                            name={template.icon || 'Description'} 
                            size={18} 
                            className={template.isUsed ? 'text-[#1E3A5F]' : 'text-[#64748B]'}
                          />
                        </div>

                        {/* Nom du template */}
                        <span className={`
                          text-sm font-medium whitespace-nowrap
                          ${template.isUsed ? 'text-[#1E3A5F]' : 'text-[#64748B]'}
                        `}>
                          {template.name}
                        </span>

                        {/* Badge nombre d'éléments si utilisé */}
                        {template.isUsed && (
                          <span className="ml-1 px-2 py-0.5 text-xs bg-[#DBEAFE] text-[#1E3A5F] rounded-full">
                            {template.elementCount}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

