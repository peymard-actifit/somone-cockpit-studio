// SOMONE Cockpit Studio - Utilitaires de navigation et recherche dans les cockpits
// Extraction depuis cockpitStore.ts pour réutilisation

import type { Cockpit, Domain, Category, Element, SubCategory, SubElement, MapElement } from '../../types';

/**
 * Génère un identifiant unique
 */
export const generateId = (): string => crypto.randomUUID();

/**
 * Trouver un domaine par son ID
 */
export const findDomainById = (cockpit: Cockpit | null, domainId: string): Domain | undefined => {
  return cockpit?.domains?.find(d => d.id === domainId);
};

/**
 * Trouver une catégorie par son ID (recherche dans tous les domaines)
 */
export const findCategoryById = (cockpit: Cockpit | null, categoryId: string): { category: Category; domain: Domain } | undefined => {
  for (const domain of cockpit?.domains || []) {
    const category = domain.categories?.find(c => c.id === categoryId);
    if (category) {
      return { category, domain };
    }
  }
  return undefined;
};

/**
 * Trouver un élément par son ID (recherche dans tous les domaines et catégories)
 */
export const findElementById = (
  cockpit: Cockpit | null, 
  elementId: string
): { element: Element; category: Category; domain: Domain } | undefined => {
  for (const domain of cockpit?.domains || []) {
    for (const category of domain.categories || []) {
      const element = category.elements?.find(e => e.id === elementId);
      if (element) {
        return { element, category, domain };
      }
    }
  }
  return undefined;
};

/**
 * Trouver une sous-catégorie par son ID
 */
export const findSubCategoryById = (
  cockpit: Cockpit | null, 
  subCategoryId: string
): { subCategory: SubCategory; element: Element; category: Category; domain: Domain } | undefined => {
  for (const domain of cockpit?.domains || []) {
    for (const category of domain.categories || []) {
      for (const element of category.elements || []) {
        const subCategory = element.subCategories?.find(sc => sc.id === subCategoryId);
        if (subCategory) {
          return { subCategory, element, category, domain };
        }
      }
    }
  }
  return undefined;
};

/**
 * Trouver un sous-élément par son ID
 */
export const findSubElementById = (
  cockpit: Cockpit | null, 
  subElementId: string
): { 
  subElement: SubElement; 
  subCategory: SubCategory; 
  element: Element; 
  category: Category; 
  domain: Domain 
} | undefined => {
  for (const domain of cockpit?.domains || []) {
    for (const category of domain.categories || []) {
      for (const element of category.elements || []) {
        for (const subCategory of element.subCategories || []) {
          const subElement = subCategory.subElements?.find(se => se.id === subElementId);
          if (subElement) {
            return { subElement, subCategory, element, category, domain };
          }
        }
      }
    }
  }
  return undefined;
};

/**
 * Trouver un MapElement par son ID
 */
export const findMapElementById = (
  cockpit: Cockpit | null, 
  mapElementId: string
): { mapElement: MapElement; domain: Domain } | undefined => {
  for (const domain of cockpit?.domains || []) {
    const mapElement = domain.mapElements?.find(me => me.id === mapElementId);
    if (mapElement) {
      return { mapElement, domain };
    }
  }
  return undefined;
};

/**
 * Compter le nombre total d'éléments dans un cockpit
 */
export const countElements = (cockpit: Cockpit | null): number => {
  let count = 0;
  for (const domain of cockpit?.domains || []) {
    for (const category of domain.categories || []) {
      count += category.elements?.length || 0;
    }
  }
  return count;
};

/**
 * Compter le nombre total de sous-éléments dans un cockpit
 */
export const countSubElements = (cockpit: Cockpit | null): number => {
  let count = 0;
  for (const domain of cockpit?.domains || []) {
    for (const category of domain.categories || []) {
      for (const element of category.elements || []) {
        for (const subCategory of element.subCategories || []) {
          count += subCategory.subElements?.length || 0;
        }
      }
    }
  }
  return count;
};

/**
 * Deep clone d'un objet (utilise JSON pour la sérialisation)
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Obtenir la date actuelle au format ISO
 */
export const nowISO = (): string => new Date().toISOString();
