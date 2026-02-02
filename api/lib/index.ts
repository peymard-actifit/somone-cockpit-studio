// SOMONE Cockpit Studio - API Library Index
// Refactoring: Export centralisé de tous les modules

// Types
export * from './types';

// Configuration et helpers
export {
  APP_VERSION,
  JWT_SECRET,
  DEEPL_API_KEY,
  IS_PRODUCTION,
  IMAGE_CONFIG,
  MAX_PAYLOAD_SIZE_MB,
  log,
  generateId,
  validateImage,
  hasConflict,
} from './config';

// Database (Redis + PostgreSQL)
export {
  redis,
  sql,
  initPostgres,
  saveSnapshot,
  loadSnapshot,
  deleteSnapshot,
  getDb,
  saveDb,
} from './database';

// Authentication
export {
  createToken,
  verifyToken,
  verifyTokenSimple,
  hashPassword,
  comparePassword,
  canAccessCockpit,
  setCorsHeaders,
} from './auth';

// Data Sources
export {
  ExecutionStep,
  extractFields,
  fetchFromAPI,
  fetchFromJSON,
  fetchFromCSV,
  fetchFromExcel,
  fetchFromDatabase,
  fetchFromMonitoring,
  fetchFromEmail,
  fetchSourceData,
} from './datasources';
