// Types pour le Cockpit Studio SOMONE

// Statuts possibles pour les tuiles
export type TileStatus = 'fatal' | 'critique' | 'mineur' | 'ok' | 'deconnecte' | 'information' | 'herite';

// Types de templates de vues
export type TemplateType = 
  | 'standard'      // Vue domaine classique avec catégories
  | 'grid'          // Vue grille simple (type Magasins)
  | 'map'           // Vue carte dynamique
  | 'background'    // Vue avec image de fond et positionnement libre
  | 'element';      // Vue élément (sous-catégories)

// Orientation des catégories
export type Orientation = 'horizontal' | 'vertical';

// Utilisateur
export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

// Maquette de cockpit
export interface Cockpit {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  domains: Domain[];
  logo?: string;
  scrollingBanner?: string;
  // Publication
  publicId?: string;      // ID public unique pour l'URL
  isPublished?: boolean;  // Si le cockpit est publié
  publishedAt?: string;   // Date de publication
}

// Coordonnées GPS
export interface GpsCoords {
  lat: number;  // Latitude en degrés décimaux
  lng: number;  // Longitude en degrés décimaux
}

// Limites GPS de la carte (coins de l'image)
export interface MapBounds {
  topLeft: GpsCoords;      // Coin haut-gauche de l'image
  bottomRight: GpsCoords;  // Coin bas-droite de l'image
}

// Mode d'affichage de l'image de fond
export type BackgroundMode = 'behind' | 'overlay';

// Domaine (onglet du bandeau)
export interface Domain {
  id: string;
  cockpitId: string;
  name: string;
  order: number;
  templateType: TemplateType;
  templateName?: string;
  backgroundImage?: string;
  backgroundMode?: BackgroundMode;  // 'behind' = en fond, 'overlay' = au-dessus (sans gêner les clics)
  mapBounds?: MapBounds;  // Coordonnées GPS des coins de la carte
  enableClustering?: boolean;  // Activer/désactiver le regroupement des éléments (défaut: true)
  categories: Category[];
  mapElements?: MapElement[];
}

// Catégorie (groupe d'éléments)
export interface Category {
  id: string;
  domainId: string;
  name: string;
  icon?: string;
  orientation: Orientation;
  order: number;
  elements: Element[];
}

// Élément (tuile principale)
export interface Element {
  id: string;
  categoryId: string;
  name: string;
  value?: string;
  unit?: string;
  icon?: string;
  icon2?: string;
  icon3?: string;
  status: TileStatus;
  order: number;
  zone?: string;
  subCategories: SubCategory[];
  // Pour les vues avec positionnement libre (background view)
  positionX?: number;  // Position X en % de l'image
  positionY?: number;  // Position Y en % de l'image
  width?: number;      // Largeur en % de l'image
  height?: number;     // Hauteur en % de l'image
  // Image de fond pour la vue élément
  backgroundImage?: string;
  backgroundMode?: BackgroundMode;
}

// Sous-catégorie
export interface SubCategory {
  id: string;
  elementId: string;
  name: string;
  icon?: string;
  orientation: Orientation;
  order: number;
  subElements: SubElement[];
}

// Type de source de données
export type DataSourceType = 
  | 'excel' 
  | 'csv' 
  | 'json' 
  | 'api' 
  | 'database' 
  | 'email' 
  | 'supervision' 
  | 'hypervision' 
  | 'observability' 
  | 'other';

// Source de données
export interface DataSource {
  id: string;
  subElementId: string;
  name: string;
  type: DataSourceType;
  location?: string; // Emplacement, fichier, URL, connexion
  connection?: string; // Détails de connexion (pour API, bases de données)
  fields?: string; // Champs à extraire, feuilles Excel, règles d'extraction
  description?: string;
  config?: Record<string, any>; // Configuration additionnelle
}

// Calcul
export interface Calculation {
  id: string;
  subElementId: string;
  name: string;
  description?: string; // Description métier
  definition: string; // Définition technique (JSON, YAML, DSL)
  sources: string[]; // IDs des sources utilisées
  result?: any; // Résultat calculé (pour explicabilité)
}

// Explication d'un calcul (générée automatiquement)
export interface CalculationExplanation {
  calculationId: string;
  summary: string; // Résumé en langage naturel
  sourcesUsed: Array<{
    sourceId: string;
    sourceName: string;
    parameters: Record<string, any>;
    extractedValues?: any;
  }>;
  calculationDescription: string; // Description du calcul reformulée
  result?: any;
}

// Sous-élément
export interface SubElement {
  id: string;
  subCategoryId: string;
  name: string;
  value?: string;
  unit?: string;
  status: TileStatus;
  order: number;
  alert?: Alert;
  sources?: DataSource[]; // Sources de données associées
  calculations?: Calculation[]; // Calculs associés
}

// Alerte
export interface Alert {
  id: string;
  subElementId: string;
  date: string;
  description: string;
  duration?: string;
  ticketNumber?: string;
  actions?: string;
}

// Point sur la carte (avec coordonnées GPS réelles)
export interface MapElement {
  id: string;
  domainId: string;
  name: string;
  gps: GpsCoords;         // Coordonnées GPS réelles du point
  icon?: string;
  status: TileStatus;
  elementId?: string;     // Lien optionnel vers un élément existant
}

// Template réutilisable
export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  isForDomain: boolean; // true = domaine, false = élément
  userId: string;
  createdAt: string;
}

// Zone (pour le tri des éléments)
export interface Zone {
  id: string;
  name: string;
  cockpitId: string;
}

// État de l'application
export interface AppState {
  user: User | null;
  currentCockpit: Cockpit | null;
  currentDomainId: string | null;
  currentElementId: string | null;
  isEditing: boolean;
  templates: Template[];
  zones: Zone[];
}

// Ordre de priorité des statuts (du plus critique au moins critique) - pour calcul hérité
export const STATUS_PRIORITY_MAP: Record<TileStatus, number> = {
  fatal: 6,
  critique: 5,
  mineur: 4,
  ok: 3,
  information: 2, // Moins prioritaire que OK pour que l'héritée affiche vert quand il n'y a que des informations
  deconnecte: 1,
  herite: 0, // Ne compte pas dans le calcul, sera calculé dynamiquement
};

// Couleurs des statuts (exactement comme dans le PDF SOMONE - MODE CLAIR)
export const STATUS_COLORS: Record<TileStatus, { bg: string; text: string; border: string; hex: string }> = {
  fatal: { bg: 'bg-[#8B5CF6]', text: 'text-white', border: 'border-[#7C3AED]', hex: '#8B5CF6' },      // Violet
  critique: { bg: 'bg-[#E57373]', text: 'text-white', border: 'border-[#EF5350]', hex: '#E57373' },  // Rouge rosé (PDF)
  mineur: { bg: 'bg-[#FFB74D]', text: 'text-white', border: 'border-[#FFA726]', hex: '#FFB74D' },    // Orange/Ambre (PDF)
  information: { bg: 'bg-[#42A5F5]', text: 'text-white', border: 'border-[#2196F3]', hex: '#42A5F5' }, // Bleu (Informations)
  ok: { bg: 'bg-[#9CCC65]', text: 'text-white', border: 'border-[#8BC34A]', hex: '#9CCC65' },        // Vert lime (PDF)
  deconnecte: { bg: 'bg-[#9E9E9E]', text: 'text-white', border: 'border-[#757575]', hex: '#9E9E9E' }, // Gris (PDF)
  herite: { bg: 'bg-[#9CCC65]', text: 'text-white', border: 'border-[#8BC34A]', hex: '#9CCC65' },     // Vert par défaut (sera calculé dynamiquement)
};

// Labels des statuts
export const STATUS_LABELS: Record<TileStatus, string> = {
  fatal: 'Fatal',
  critique: 'Critique',
  mineur: 'Mineur',
  information: 'Informations',
  ok: 'OK',
  deconnecte: 'Déconnecté',
  herite: 'Héritée',
};

// Fonction pour calculer la couleur héritée selon les sous-éléments
export function getInheritedStatus(element: { subCategories: Array<{ subElements: Array<{ status: TileStatus }> }> }): TileStatus {
  let worstStatus: TileStatus = 'ok';
  let worstPriority = STATUS_PRIORITY_MAP['ok'];
  
  // Parcourir tous les sous-éléments pour trouver le statut le plus critique
  for (const subCategory of element.subCategories) {
    for (const subElement of subCategory.subElements) {
      // Ignorer les statuts 'herite' dans le calcul
      if (subElement.status === 'herite') continue;
      
      const priority = STATUS_PRIORITY_MAP[subElement.status] || 0;
      if (priority > worstPriority) {
        worstPriority = priority;
        worstStatus = subElement.status;
      }
    }
  }
  
  return worstStatus;
}

// Fonction pour obtenir la couleur effective d'un élément (gère le cas hérité)
export function getEffectiveStatus(element: { status: TileStatus; subCategories: Array<{ subElements: Array<{ status: TileStatus }> }> }): TileStatus {
  if (element.status === 'herite') {
    return getInheritedStatus(element);
  }
  return element.status;
}

// Fonction pour obtenir les couleurs effectives (gère le cas hérité)
export function getEffectiveColors(element: { status: TileStatus; subCategories: Array<{ subElements: Array<{ status: TileStatus }> }> }) {
  const effectiveStatus = getEffectiveStatus(element);
  return STATUS_COLORS[effectiveStatus];
}

// Fonction pour calculer le statut le plus critique d'un domaine
export function getDomainWorstStatus(domain: { 
  categories: Array<{ 
    elements: Array<{ 
      status: TileStatus; 
      subCategories: Array<{ 
        subElements: Array<{ status: TileStatus }> 
      }> 
    }> 
  }>; 
  mapElements?: Array<{ status: TileStatus }> 
}): TileStatus {
  let worstStatus: TileStatus = 'ok';
  let worstPriority = STATUS_PRIORITY_MAP['ok'];
  
  // Parcourir tous les éléments dans toutes les catégories
  for (const category of domain.categories) {
    for (const element of category.elements) {
      // Calculer le statut effectif de l'élément (gère l'héritage)
      const effectiveStatus = getEffectiveStatus(element);
      const priority = STATUS_PRIORITY_MAP[effectiveStatus] || 0;
      
      if (priority > worstPriority) {
        worstPriority = priority;
        worstStatus = effectiveStatus;
      }
      
      // Parcourir aussi tous les sous-éléments directement (au cas où)
      for (const subCategory of element.subCategories) {
        for (const subElement of subCategory.subElements) {
          if (subElement.status === 'herite') continue;
          const subPriority = STATUS_PRIORITY_MAP[subElement.status] || 0;
          if (subPriority > worstPriority) {
            worstPriority = subPriority;
            worstStatus = subElement.status;
          }
        }
      }
    }
  }
  
  // Parcourir aussi les mapElements si le domaine est de type map
  if (domain.mapElements) {
    for (const mapElement of domain.mapElements) {
      const priority = STATUS_PRIORITY_MAP[mapElement.status] || 0;
      if (priority > worstPriority) {
        worstPriority = priority;
        worstStatus = mapElement.status;
      }
    }
  }
  
  return worstStatus;
}


