// SOMONE Cockpit Studio - Types partagés
// Fichier dans _lib/ = ignoré par Vercel comme route, mais importable

// Types d'utilisateurs
export type UserType = 'admin' | 'standard' | 'client';

// Utilisateur
export interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  password: string;
  isAdmin: boolean;
  userType: UserType;
  canBecomeAdmin?: boolean;
  createdAt: string;
}

// Token de réinitialisation de mot de passe
export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  used: boolean;
  createdAt: string;
  expiresAt: string;
}

// Cockpit/Maquette
export interface CockpitData {
  id: string;
  name: string;
  userId: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

// Répertoire
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
  elementKey: string;
  content: string;
  contentEN?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  updatedByUsername?: string;
}

// Étape de parcours
export interface JourneyStep {
  id: string;
  type: 'presentation' | 'interaction';
  name: string;
  nameEN?: string;
  title: string;
  titleEN?: string;
  content?: string;
  contentEN?: string;
  description?: string;
  descriptionEN?: string;
  icon?: string;
  fields?: any[];
  order?: number;
  createdAt: string;
  updatedAt: string;
}

// Parcours
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

// Base de données
export interface Database {
  users: User[];
  cockpits: CockpitData[];
  folders?: Folder[];
  systemPrompt?: string;
  passwordResetTokens?: PasswordResetToken[];
  contextualHelps?: ContextualHelp[];
  adminCode?: string;
  journeySteps?: JourneyStep[];
  journeys?: Journey[];
}

// Étape d'exécution (pour les calculs)
export interface ExecutionStep {
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
  timestamp: string;
}
