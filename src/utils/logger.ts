/**
 * Utilitaire de logging conditionnel
 * Les logs ne s'affichent qu'en mode développement
 */

// Vite définit ces variables à la compilation
const isDev = (import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'development';

// Cache pour éviter les logs répétitifs
const logCache = new Map<string, number>();
const LOG_THROTTLE_MS = 1000; // Throttle les logs identiques pendant 1 seconde

function shouldLog(key: string): boolean {
  if (!isDev) return false;
  
  const now = Date.now();
  const lastLog = logCache.get(key);
  
  if (lastLog && now - lastLog < LOG_THROTTLE_MS) {
    return false;
  }
  
  logCache.set(key, now);
  return true;
}

export const logger = {
  /**
   * Log standard (développement uniquement)
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log avec throttle pour éviter les répétitions
   */
  logOnce: (key: string, ...args: unknown[]) => {
    if (shouldLog(key)) {
      console.log(...args);
    }
  },

  /**
   * Warning (développement uniquement)
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Erreur (toujours affiché car critique)
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Debug détaillé (développement uniquement)
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log de groupe (développement uniquement)
   */
  group: (label: string, fn: () => void) => {
    if (isDev) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  },

  /**
   * Vérifier si on est en mode développement
   */
  isDev,
};

export default logger;
