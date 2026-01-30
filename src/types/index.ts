// Types pour le Cockpit Studio SOMONE

// Statuts possibles pour les tuiles
export type TileStatus = 'fatal' | 'critique' | 'mineur' | 'ok' | 'deconnecte' | 'information' | 'herite' | 'herite_domaine';

// Types de templates de vues
export type TemplateType =
  | 'standard'      // Vue domaine classique avec catégories
  | 'grid'          // Vue grille simple (type Magasins)
  | 'map'           // Vue carte dynamique
  | 'background'    // Vue avec image de fond et positionnement libre
  | 'element'       // Vue élément (sous-catégories)
  | 'hours-tracking' // Vue suivi des heures
  | 'alerts'        // Vue alertes/incidents
  | 'stats'         // Vue statistiques
  | 'library'       // Vue bibliothèque (zones + templates)
  | 'data-history'; // Vue historique des données (tableau par date)

// Orientation des catégories
export type Orientation = 'horizontal' | 'vertical';

// Types d'utilisateurs
export type UserType = 'admin' | 'standard' | 'client';

// Utilisateur
export interface User {
  id: string;
  username: string;
  name?: string; // Nom d'affichage (ex: "Patrick Eymard")
  email?: string; // Email de l'utilisateur
  isAdmin: boolean; // Conservé pour compatibilité - true si userType === 'admin'
  userType: UserType; // Type d'utilisateur: admin, standard, client
  canBecomeAdmin?: boolean; // Pour les utilisateurs standard: possibilité de passer admin (défaut: true)
  createdAt: string;
}

// Répertoire de maquettes
export interface Folder {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  order?: number;         // Ordre d'affichage pour le drag & drop
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
  welcomeMessage?: string; // Message d'accueil affiché en popup lors de l'ouverture du cockpit publié
  order?: number;         // Ordre d'affichage pour le drag & drop
  // Organisation
  folderId?: string;      // ID du répertoire parent (null = racine)
  // Partage
  sharedWith?: string[];  // Liste des IDs des utilisateurs avec qui la maquette est partagée
  // Vue originale
  useOriginalView?: boolean;  // Si true, utilise la vue "Cockpit Original" lors de la publication
  // Icônes des templates (associe un nom de template à une icône)
  templateIcons?: TemplateIcons;
  // Aide contextuelle au survol
  showHelpOnHover?: boolean;  // Si true, affiche l'aide contextuelle au survol des éléments
  // Aides contextuelles locales à la maquette (exportées avec la maquette)
  contextualHelps?: Array<{
    elementKey: string;
    content: string;
    updatedAt: string;
    updatedByUsername?: string;
  }>;
  // Historique des données des sous-éléments
  dataHistory?: DataHistory;
  // Date sélectionnée pour afficher les données (format YYYY-MM-DD)
  selectedDataDate?: string;
}

// ============================================================================
// HISTORIQUE DES DONNÉES DES SOUS-ÉLÉMENTS
// ============================================================================

// Données d'un sous-élément pour une date donnée
export interface SubElementDataSnapshot {
  status: TileStatus;
  value?: string;
  unit?: string;
  alertDescription?: string;
}

// Colonne de données pour une date
export interface DataHistoryColumn {
  date: string; // Format YYYY-MM-DD
  label?: string; // Label optionnel (ex: "Semaine 1", "Janvier 2024")
  data: Record<string, SubElementDataSnapshot>; // Clé = subElementId ou linkedGroupId
}

// Historique complet des données
export interface DataHistory {
  columns: DataHistoryColumn[];
  // Liste des sous-éléments uniques (les liés sont regroupés)
  subElements: Array<{
    id: string; // subElementId ou linkedGroupId
    name: string;
    location: string; // Chemin: Domaine > Catégorie > Élément > Sous-catégorie
    linkedGroupId?: string; // Si c'est un groupe lié
    linkedCount?: number; // Nombre de sous-éléments liés
  }>;
  lastUpdated?: string;
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
  icon?: string;  // Icône du domaine
  order: number;
  templateType: TemplateType;
  templateName?: string;
  backgroundImage?: string;
  backgroundImageOpacity?: number;  // Opacité de l'image de fond (0-100, défaut: 100)
  backgroundMode?: BackgroundMode;  // 'behind' = en fond, 'overlay' = au-dessus (sans gêner les clics)
  backgroundDarkness?: number;  // Opacité du voile assombrissant (0-100, défaut: 60)
  mapBounds?: MapBounds;  // Coordonnées GPS des coins de la carte
  enableClustering?: boolean;  // Activer/désactiver le regroupement des éléments (défaut: true)
  minFontZoom?: number;  // Valeur minimale de zoom pour la police (0-100, défaut: 50) - vue standard uniquement
  categories: Category[];
  mapElements?: MapElement[];
  // Données pour la vue "Suivi des heures"
  hoursTracking?: HoursTrackingData;
  // Données pour la vue "Alertes"
  alertsData?: AlertsData;
  // Données pour la vue "Stats"
  statsData?: StatsData;
  publiable?: boolean;  // Si le domaine doit être publié (défaut: true)
  updatedAt?: string;  // Date de dernière mise à jour
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
  publiable?: boolean;  // Si l'élément doit être publié (défaut: true)
  zone?: string;
  template?: string;  // Template associé à cet élément (partage la structure de sous-catégories/sous-éléments)
  subCategories: SubCategory[];
  // Pour les vues avec positionnement libre (background view)
  positionX?: number;  // Position X en % de l'image
  positionY?: number;  // Position Y en % de l'image
  width?: number;      // Largeur en % de l'image
  height?: number;     // Hauteur en % de l'image
  // Image de fond pour la vue élément
  backgroundImage?: string;
  backgroundImageOpacity?: number;  // Opacité de l'image de fond (0-100, défaut: 100)
  backgroundMode?: BackgroundMode;
  // Liaison entre éléments du même nom
  linkedGroupId?: string;  // ID du groupe de liaison (éléments synchronisés)
  // Héritage de couleur depuis un domaine
  inheritFromDomainId?: string;  // ID du domaine dont on hérite la couleur (pour status = 'herite_domaine')
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
  prompt?: string; // Prompt IA pour générer automatiquement les champs
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
  prompt?: string; // Prompt IA pour générer automatiquement les champs
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
  icon?: string;
  status: TileStatus;
  order: number;
  alert?: Alert;
  sources?: DataSource[]; // Sources de données associées
  calculations?: Calculation[]; // Calculs associés
  // Liaison entre sous-éléments du même nom
  linkedGroupId?: string;  // ID du groupe de liaison (sous-éléments synchronisés)
  applyCalculation?: boolean; // Active/désactive l'application du calcul (défaut: false)
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
  icon?: string;  // Icône associée à la zone
}

// Icônes des templates (associe un nom de template à une icône)
export type TemplateIcons = Record<string, string>;

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
  herite_domaine: 0, // Ne compte pas dans le calcul, sera calculé dynamiquement selon le domaine
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
  herite_domaine: { bg: 'bg-[#9CCC65]', text: 'text-white', border: 'border-[#8BC34A]', hex: '#9CCC65' }, // Vert par défaut (sera calculé dynamiquement selon le domaine)
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
  herite_domaine: 'Héritage Domaine',
};

// Fonction pour calculer la couleur héritée selon les sous-éléments
export function getInheritedStatus(element: { subCategories: Array<{ subElements: Array<{ status: TileStatus }> }> }): TileStatus {
  let worstStatus: TileStatus = 'ok';
  let worstPriority = STATUS_PRIORITY_MAP['ok'];

  // Parcourir tous les sous-éléments pour trouver le statut le plus critique - protection pour les tableaux
  for (const subCategory of (element.subCategories || [])) {
    for (const subElement of (subCategory.subElements || [])) {
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

// Type pour un élément avec les champs nécessaires au calcul du statut effectif
export interface ElementForStatusCalc {
  status: TileStatus;
  subCategories: Array<{ subElements: Array<{ status: TileStatus }> }>;
  inheritFromDomainId?: string;
}

// Fonction pour obtenir la couleur effective d'un élément (gère le cas hérité et héritage domaine)
// Le paramètre visitedDomainIds permet d'éviter les références circulaires
export function getEffectiveStatus(
  element: ElementForStatusCalc,
  domains?: DomainForStatusCalc[],
  visitedDomainIds?: Set<string>
): TileStatus {
  if (element.status === 'herite') {
    return getInheritedStatus(element);
  }
  if (element.status === 'herite_domaine' && element.inheritFromDomainId && domains) {
    // Protection contre les références circulaires
    if (visitedDomainIds?.has(element.inheritFromDomainId)) {
      console.warn(`Référence circulaire détectée pour le domaine ${element.inheritFromDomainId}`);
      return 'ok'; // Éviter la boucle infinie
    }
    const targetDomain = domains.find(d => d.id === element.inheritFromDomainId);
    if (targetDomain) {
      // Passer tous les domaines avec le tracking des domaines visités
      return getDomainWorstStatus(targetDomain, domains, visitedDomainIds);
    }
    return 'ok'; // Par défaut si le domaine n'est pas trouvé
  }
  return element.status;
}

// Fonction pour obtenir les couleurs effectives (gère le cas hérité et héritage domaine)
export function getEffectiveColors(
  element: ElementForStatusCalc,
  domains?: DomainForStatusCalc[],
  visitedDomainIds?: Set<string>
) {
  const effectiveStatus = getEffectiveStatus(element, domains, visitedDomainIds) || element.status || 'ok';
  return STATUS_COLORS[effectiveStatus] || STATUS_COLORS.ok;
}

// Type pour un domaine utilisé dans le calcul du statut
export type DomainForStatusCalc = {
  id: string;
  categories: Array<{
    elements: Array<{
      status: TileStatus;
      inheritFromDomainId?: string;
      subCategories: Array<{
        subElements: Array<{ status: TileStatus }>
      }>
    }>
  }>;
  mapElements?: Array<{ status: TileStatus }>
};

// Fonction pour calculer le statut le plus critique d'un domaine
// Le paramètre visitedDomainIds permet d'éviter les références circulaires
// PROTECTION: Toutes les boucles utilisent || [] pour éviter les erreurs sur undefined
export function getDomainWorstStatus(
  domain: DomainForStatusCalc,
  allDomains?: DomainForStatusCalc[],
  visitedDomainIds?: Set<string>
): TileStatus {
  // Initialiser ou copier le Set des domaines visités
  const visited = visitedDomainIds ? new Set(visitedDomainIds) : new Set<string>();
  
  // Marquer ce domaine comme visité pour éviter les boucles
  visited.add(domain.id);

  let worstStatus: TileStatus = 'ok';
  let worstPriority = STATUS_PRIORITY_MAP['ok'];

  // Parcourir tous les éléments dans toutes les catégories - protection pour les tableaux
  for (const category of (domain.categories || [])) {
    for (const element of (category.elements || [])) {
      // Calculer le statut effectif de l'élément (gère l'héritage et l'héritage domaine)
      // Passer le Set des domaines visités pour détecter les cycles
      const effectiveStatus = getEffectiveStatus(element, allDomains, visited);
      const priority = STATUS_PRIORITY_MAP[effectiveStatus] || 0;

      if (priority > worstPriority) {
        worstPriority = priority;
        worstStatus = effectiveStatus;
      }

      // Parcourir aussi tous les sous-éléments directement (au cas où) - protection pour les tableaux
      for (const subCategory of (element.subCategories || [])) {
        for (const subElement of (subCategory.subElements || [])) {
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
    for (const mapElement of (domain.mapElements || [])) {
      const priority = STATUS_PRIORITY_MAP[mapElement.status] || 0;
      if (priority > worstPriority) {
        worstPriority = priority;
        worstStatus = mapElement.status;
      }
    }
  }

  return worstStatus;
}

// Types pour la vue "Suivi des heures"
export type ResourceType = 'person' | 'supplier';

// Demi-journée (matin ou après-midi)
export type HalfDay = 'morning' | 'afternoon';

// Entrée de temps pour une personne (demi-journée cochée)
export interface TimeEntry {
  date: string; // Format YYYY-MM-DD
  halfDay: HalfDay;
}

// Personne travaillant sur le projet
export interface Person {
  id: string;
  name: string;
  dailyRate: number; // TJM en €
  timeEntries: TimeEntry[]; // Liste des demi-journées imputées
  order: number;
}

// Entrée de coût pour un fournisseur (montant à une date)
export interface SupplierEntry {
  date: string; // Format YYYY-MM-DD
  amount: number; // Montant en €
}

// Fournisseur
export interface Supplier {
  id: string;
  name: string;
  entries: SupplierEntry[]; // Liste des montants par date
  order: number;
}

// Ressource (personne ou fournisseur)
export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  order: number;
  // Si type = 'person'
  dailyRate?: number;
  timeEntries?: TimeEntry[];
  // Si type = 'supplier'
  entries?: SupplierEntry[];
}

// Données complètes pour la vue "Suivi des heures"
export interface HoursTrackingData {
  projectStartDate: string; // Date d'origine du projet (format YYYY-MM-DD)
  projectEndDate?: string; // Date de fin du projet (format YYYY-MM-DD)
  salePrice?: number; // Prix de vente au client en €
  resources: Resource[]; // Liste des personnes et fournisseurs
}

// ==================== VUE ALERTES ====================

// Sévérité d'un incident (correspond aux couleurs)
export type IncidentSeverity = 'fatal' | 'critique' | 'mineur';

// Incident/Alerte
export interface Incident {
  id: string;
  domainId: string;
  severity: IncidentSeverity;
  startDate: string; // Format ISO
  endDate?: string; // Format ISO (optionnel si en cours)
  // Référence vers la structure cockpit (optionnel, permet le lien)
  targetDomainId?: string;
  targetCategoryId?: string;
  targetElementId?: string;
  targetSubCategoryId?: string;
  targetSubElementId?: string;
  // Noms pour l'affichage (copiés pour persistance)
  targetDomainName?: string;
  targetCategoryName?: string;
  targetElementName?: string;
  targetSubCategoryName?: string;
  targetSubElementName?: string;
  // Responsabilité (Oui = responsable interne, Non = externe)
  responsible?: boolean; // true = Oui (défaut), false = Non
  // Description et pièce jointe
  description?: string;
  attachment?: string; // Base64 du fichier joint ou URL
  attachmentName?: string; // Nom du fichier joint
  // Métadonnées
  createdAt: string;
  updatedAt: string;
}

// Données complètes pour la vue "Alertes"
export interface AlertsData {
  incidents: Incident[];
  // Préférences d'affichage
  rowSpacing?: number; // Espacement entre les lignes (px)
  tileHeight?: number; // Hauteur des tuiles de comptage (px)
  splitPosition?: number; // Position du séparateur (% depuis le haut)
}

// Type de période pour les statistiques
export type StatsPeriodType = 'day' | 'week' | 'month' | 'year';

// Plage horaire de service (heures ouvertes par jour de la semaine)
export interface ServiceHours {
  // Pour chaque jour (0=lundi, 6=dimanche), tableau des heures ouvertes (0-23)
  monday: number[];
  tuesday: number[];
  wednesday: number[];
  thursday: number[];
  friday: number[];
  saturday: number[];
  sunday: number[];
}

// Données complètes pour la vue "Stats"
export interface StatsData {
  // Référence vers le domaine "Alertes" source
  alertsDomainId?: string;
  // Paramètres du graphe
  periodType: StatsPeriodType; // Type de période (jour, semaine, mois, année)
  periodCount: number; // Nombre de périodes à afficher
  startDate?: string; // Date de début des périodes (format ISO)
  // Plages horaires de service
  serviceHours: ServiceHours;
  excludeWeekends: boolean; // Exclure les week-ends
  excludeHolidays: boolean; // Exclure les jours fériés
  excludedDates: string[]; // Dates exclues (format ISO YYYY-MM-DD)
  // Préférences d'affichage
  splitPosition?: number; // Position du séparateur (% depuis le haut)
  columnWidth?: number; // Largeur des colonnes (10-100%)
}

// ==================== PRÉSENTATIONS AUTOMATISÉES ====================

// Formats de sortie disponibles pour les présentations
export type PresentationOutputFormat = 'pdf' | 'video' | 'pptx';

// Image capturée pour une présentation
export interface CapturedImage {
  id: string;
  cockpitId: string;
  filename: string; // Nom horodaté: YYYYMMDD_HHmmss_SSS.png
  timestamp: string; // Date ISO de capture
  description?: string; // Description générée par l'IA
  domainId?: string; // Domaine source si applicable
  elementId?: string; // Élément source si applicable
  width: number;
  height: number;
  base64Data: string; // Données de l'image en base64
  hash?: string; // Hash perceptuel pour déduplication
  quality?: number; // Score de qualité (0-100)
}

// Configuration d'une présentation enregistrée
// Types de transitions vidéo style PowerPoint
export type VideoTransitionType = 
  | 'fade'        // Fondu classique
  | 'fadeblack'   // Fondu via noir
  | 'fadewhite'   // Fondu via blanc
  | 'wipeleft'    // Balayage vers la gauche
  | 'wiperight'   // Balayage vers la droite
  | 'slidedown'   // Glissement vers le bas
  | 'slideup'     // Glissement vers le haut
  | 'circlecrop'  // Transition circulaire
  | 'dissolve';   // Dissolution

// Musique de fond pour les présentations (gérée au niveau studio)
export interface BackgroundMusic {
  id: string;
  name: string;           // Nom affiché
  url: string;            // URL du fichier audio (hébergé)
  duration: number;       // Durée en secondes
  category: 'corporate' | 'ambient' | 'upbeat' | 'calm';
  isDefault?: boolean;    // Musique par défaut
}

export interface PresentationConfig {
  id: string;
  cockpitId: string;
  name: string; // Nom de la configuration
  prompt: string; // Instructions pour l'IA
  outputFormats: PresentationOutputFormat[]; // Formats de sortie sélectionnés
  createdAt: string;
  updatedAt: string;
  // Options avancées
  includeAllDomains?: boolean; // Inclure tous les domaines
  selectedDomainIds?: string[]; // Domaines spécifiques à inclure
  transitionStyle?: 'none' | 'fade' | 'slide'; // Style de transition (pour PPTX)
  duration?: number; // Durée estimée en secondes (pour vidéo)
  // Options vidéo avancées
  videoDuration?: number;           // Durée cible de la vidéo en secondes
  videoTransition?: VideoTransitionType; // Type de transition vidéo
  transitionDuration?: number;      // Durée des transitions (0.5-2 secondes)
  backgroundMusicId?: string;       // ID de la musique de fond (optionnel)
}

// État d'une génération de présentation en cours
export interface PresentationGenerationState {
  isGenerating: boolean;
  currentStep: string; // Description de l'étape en cours
  progress: number; // Progression 0-100
  capturedImages: CapturedImage[]; // Images capturées pendant la génération
  errors: string[]; // Erreurs rencontrées
  outputFiles?: {
    format: PresentationOutputFormat;
    filename: string;
    url?: string; // URL de téléchargement si disponible
  }[];
}

// Banque d'images d'une maquette
export interface CockpitImageBank {
  cockpitId: string;
  images: CapturedImage[];
  lastUpdated: string;
}

// Scénario généré par l'IA pour une présentation
export interface PresentationScenario {
  id: string;
  configId: string;
  title: string;
  introduction: string;
  sections: PresentationSection[];
  conclusion: string;
  generatedAt: string;
}

// Section d'un scénario de présentation
export interface PresentationSection {
  id: string;
  title: string;
  content: string; // Texte narratif
  imageIds: string[]; // IDs des images à utiliser
  duration?: number; // Durée en secondes (pour vidéo)
  notes?: string; // Notes pour le présentateur
}

// ============================================================================
// TUTORIEL INTERACTIF (pour utilisateurs Client)
// ============================================================================

// Sous-chapitre du tutoriel
export interface TutorialSubChapter {
  id: string;
  title: string;
  titleEN?: string; // Titre traduit en anglais
  content: string; // Contenu HTML
  contentEN?: string; // Contenu traduit en anglais
  order: number;
  targetElement?: string; // data-help-key de l'élément ciblé (optionnel)
  action?: 'click' | 'input' | 'observe'; // Type d'action attendue
}

// Chapitre du tutoriel
export interface TutorialChapter {
  id: string;
  title: string;
  titleEN?: string; // Titre traduit en anglais
  description?: string; // Description courte
  descriptionEN?: string;
  icon?: string; // Nom de l'icône MUI
  order: number;
  subChapters: TutorialSubChapter[];
}

// Structure complète du tutoriel
export interface Tutorial {
  id: string;
  version: number;
  chapters: TutorialChapter[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // ID de l'admin qui a créé/modifié
}

// Progression utilisateur dans le tutoriel
export interface TutorialProgress {
  userId: string;
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
  currentChapterId?: string;
  currentSubChapterId?: string;
  completedChapters: string[]; // IDs des chapitres terminés
  completedSubChapters: string[]; // IDs des sous-chapitres terminés
  skipped: boolean; // Si l'utilisateur a sauté le tutoriel
}

