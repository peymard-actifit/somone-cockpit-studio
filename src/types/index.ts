// Types pour le Cockpit Studio SOMONE

// Statuts possibles pour les tuiles
export type TileStatus = 'fatal' | 'critique' | 'mineur' | 'ok' | 'deconnecte';

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

// Couleurs des statuts (exactement comme dans le PDF SOMONE - MODE CLAIR)
export const STATUS_COLORS: Record<TileStatus, { bg: string; text: string; border: string; hex: string }> = {
  fatal: { bg: 'bg-[#8B5CF6]', text: 'text-white', border: 'border-[#7C3AED]', hex: '#8B5CF6' },      // Violet
  critique: { bg: 'bg-[#E57373]', text: 'text-white', border: 'border-[#EF5350]', hex: '#E57373' },  // Rouge rosé (PDF)
  mineur: { bg: 'bg-[#FFB74D]', text: 'text-white', border: 'border-[#FFA726]', hex: '#FFB74D' },    // Orange/Ambre (PDF)
  ok: { bg: 'bg-[#9CCC65]', text: 'text-white', border: 'border-[#8BC34A]', hex: '#9CCC65' },        // Vert lime (PDF)
  deconnecte: { bg: 'bg-[#9E9E9E]', text: 'text-white', border: 'border-[#757575]', hex: '#9E9E9E' }, // Gris (PDF)
};

// Labels des statuts
export const STATUS_LABELS: Record<TileStatus, string> = {
  fatal: 'Fatal',
  critique: 'Critique',
  mineur: 'Mineur',
  ok: 'OK',
  deconnecte: 'Déconnecté',
};


