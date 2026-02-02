// SOMONE Cockpit Studio - Types et Interfaces API
// Refactoring: Extraction des types depuis api/index.ts

// Types d'utilisateurs
export type UserType = 'admin' | 'standard' | 'client';

// Utilisateur
export interface User {
  id: string;
  username: string;
  name?: string; // Nom d'affichage
  email?: string; // Email de l'utilisateur
  password: string;
  isAdmin: boolean; // Conservé pour compatibilité - true si userType === 'admin'
  userType: UserType; // Type d'utilisateur: admin, standard, client
  canBecomeAdmin?: boolean; // Pour les utilisateurs standard: possibilité de passer admin (défaut: true)
  createdAt: string;
}

// Token de réinitialisation de mot de passe (QR Code)
export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  used: boolean;
  createdAt: string;
  expiresAt: string;
}

// Données cockpit
export interface CockpitData {
  id: string;
  name: string;
  userId: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

// Répertoire pour organiser les maquettes
export interface Folder {
  id: string;
  name: string;
  userId: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

// Aide contextuelle
export interface ContextualHelp {
  id: string;
  elementKey: string; // Clé unique pour identifier l'élément (ex: 'domain.menu.grid', 'element.properties.zone')
  content: string; // Contenu HTML de l'aide (FR)
  contentEN?: string; // Traduction anglaise de l'aide (pour les aides globales)
  createdAt: string;
  updatedAt: string;
  createdBy: string; // ID de l'admin qui a créé l'aide
  updatedBy?: string; // ID de l'admin qui a fait la dernière modification
  updatedByUsername?: string; // Username de l'admin qui a fait la dernière modification
}

// Étape du parcours (présentation ou interaction)
export interface JourneyStep {
  id: string;
  type: 'presentation' | 'interaction';
  name: string;
  nameEN?: string;
  title: string;
  titleEN?: string;
  content?: string; // Pour presentation
  contentEN?: string;
  description?: string; // Pour interaction
  descriptionEN?: string;
  icon?: string;
  fields?: any[]; // Pour interaction
  order?: number;
  createdAt: string;
  updatedAt: string;
}

// Parcours (liste ordonnée d'étapes)
export interface Journey {
  id: string;
  name: string;
  nameEN?: string;
  description?: string;
  descriptionEN?: string;
  icon?: string;
  steps: { stepId: string; order: number; condition?: string }[];
  targetGeneration: 'domain' | 'domains' | 'category' | 'element';
  aiPromptTemplate?: string;
  isActive: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// Structure de la base de données
export interface Database {
  users: User[];
  cockpits: CockpitData[];
  folders?: Folder[]; // Répertoires de maquettes
  systemPrompt?: string; // Prompt système personnalisé pour l'IA
  passwordResetTokens?: PasswordResetToken[]; // Tokens de réinitialisation de mot de passe
  contextualHelps?: ContextualHelp[]; // Aides contextuelles
  adminCode?: string; // Code pour passer en mode administrateur (éditable)
  journeySteps?: JourneyStep[]; // Étapes des parcours
  journeys?: Journey[]; // Parcours de création
}

// Types pour les sources de données
export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'json' | 'csv' | 'excel' | 'database' | 'monitoring' | 'email';
  url?: string;
  connection?: string;
  query?: string;
  fields?: string;
  refreshInterval?: number;
}

// Types pour les calculs
export interface Calculation {
  id: string;
  name: string;
  formula: string;
  sources?: string[];
  result?: number | string;
}

// Types pour l'exécution des sources de données
export interface ExecutionStep {
  sourceId: string;
  sourceName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime?: number;
  endTime?: number;
  error?: string;
  dataPreview?: string;
}
