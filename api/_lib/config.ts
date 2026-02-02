// SOMONE Cockpit Studio - Configuration partagée

// Version (mise à jour par le script de déploiement)
export const APP_VERSION = '17.10.6';

// Secrets
export const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
export const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

// Mode production
export const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// Configuration images
export const IMAGE_CONFIG = {
  MAX_SIZE_MB: 100,
  MAX_SIZE_BYTES: 100 * 1024 * 1024,
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  MIN_SIZE_BYTES: 100,
};

export const MAX_PAYLOAD_SIZE_MB = 100;

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

// Génération d'ID
export const generateId = (): string => {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
};

// Validation d'image
export function validateImage(base64Data: string | undefined | null): { 
  valid: boolean; 
  error?: string; 
  format?: string; 
  sizeBytes?: number;
} {
  if (!base64Data || typeof base64Data !== 'string') {
    return { valid: true };
  }
  
  if (!base64Data.startsWith('data:image/')) {
    return { valid: false, error: 'Format invalide: doit être une image base64 (data:image/...)' };
  }
  
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
  
  const base64Part = base64Data.split(',')[1] || '';
  const sizeBytes = Math.ceil(base64Part.length * 0.75);
  
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

// Vérification de conflit (optimistic locking)
export function hasConflict(serverUpdatedAt: string, clientUpdatedAt?: string): boolean {
  if (!clientUpdatedAt) return false;
  
  const serverTime = new Date(serverUpdatedAt).getTime();
  const clientTime = new Date(clientUpdatedAt).getTime();
  
  return serverTime > clientTime + 2000;
}
