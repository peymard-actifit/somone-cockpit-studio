// SOMONE Cockpit Studio - Configuration et Helpers
// Refactoring: Extraction de la configuration depuis api/index.ts

// Version de l'application (mise à jour automatiquement par le script de déploiement)
export const APP_VERSION = '17.9.3';

// Secrets et clés
export const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
export const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

// Mode production (désactive les logs verbeux)
export const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// Configuration pour les images - PAS DE LIMITE DE TAILLE
// Note: Vercel Pro supporte jusqu'à 100MB de payload
export const IMAGE_CONFIG = {
  MAX_SIZE_MB: 100,          // Pas de limite pratique
  MAX_SIZE_BYTES: 100 * 1024 * 1024,
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  MIN_SIZE_BYTES: 100,       // Taille min pour éviter les données corrompues
};

// Pas de limite globale du payload
export const MAX_PAYLOAD_SIZE_MB = 100; // Pratiquement illimité

// Logger conditionnel
export const log = {
  info: (...args: unknown[]) => {
    if (!IS_PRODUCTION) console.log(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => {
    if (!IS_PRODUCTION) console.log('[DEBUG]', ...args);
  },
};

// Génération d'ID unique
export const generateId = (): string => {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
};

/**
 * Valide une image base64
 * @returns { valid: boolean, error?: string, format?: string, sizeBytes?: number }
 */
export function validateImage(base64Data: string | undefined | null): { 
  valid: boolean; 
  error?: string; 
  format?: string; 
  sizeBytes?: number;
} {
  if (!base64Data || typeof base64Data !== 'string') {
    return { valid: true }; // Pas d'image = valide (optionnel)
  }
  
  // Vérifier le format base64 data URI
  if (!base64Data.startsWith('data:image/')) {
    return { valid: false, error: 'Format invalide: doit être une image base64 (data:image/...)' };
  }
  
  // Extraire le type MIME
  const mimeMatch = base64Data.match(/^data:(image\/[a-z+]+);base64,/i);
  if (!mimeMatch) {
    return { valid: false, error: 'Format base64 invalide' };
  }
  
  const mimeType = mimeMatch[1].toLowerCase();
  if (!IMAGE_CONFIG.ALLOWED_FORMATS.includes(mimeType)) {
    return { 
      valid: false, 
      error: `Format d'image non supporté: ${mimeType}. Formats acceptés: JPEG, PNG, GIF, WebP, SVG` 
    };
  }
  
  // Calculer la taille approximative
  const base64Part = base64Data.split(',')[1] || '';
  const sizeBytes = Math.ceil(base64Part.length * 0.75); // Base64 = ~75% de la taille réelle
  
  if (sizeBytes < IMAGE_CONFIG.MIN_SIZE_BYTES) {
    return { valid: false, error: 'Image trop petite ou corrompue' };
  }
  
  if (sizeBytes > IMAGE_CONFIG.MAX_SIZE_BYTES) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    return { 
      valid: false, 
      error: `Image trop volumineuse (${sizeMB} MB). Maximum: ${IMAGE_CONFIG.MAX_SIZE_MB} MB` 
    };
  }
  
  return { valid: true, format: mimeType, sizeBytes };
}

/**
 * Vérifie si une mise à jour est en conflit (optimistic locking)
 * @returns true si le cockpit a été modifié depuis clientUpdatedAt
 */
export function hasConflict(serverUpdatedAt: string, clientUpdatedAt?: string): boolean {
  if (!clientUpdatedAt) return false;
  
  const serverTime = new Date(serverUpdatedAt).getTime();
  const clientTime = new Date(clientUpdatedAt).getTime();
  
  // Tolérance de 1 seconde pour les différences de millisecondes
  return serverTime - clientTime > 1000;
}
