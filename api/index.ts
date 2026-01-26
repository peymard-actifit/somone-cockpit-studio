// SOMONE Cockpit Studio - API Backend
// Session init: 2026-01-26 - Initialisation session Cursor - Verification et rapport complet
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { neon } from '@neondatabase/serverless';
import * as XLSX from 'xlsx';

// Version de l'application (mise à jour automatiquement par le script de déploiement)
const APP_VERSION = '16.13.2';

const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

// Upstash Redis client (pour les donnees de travail)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// Logs de configuration uniquement en dev
if (process.env.NODE_ENV !== 'production') {
  console.log('Redis URL configured:', redisUrl ? 'YES' : 'NO');
  console.log('Redis Token configured:', redisToken ? 'YES' : 'NO');
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Neon PostgreSQL client (pour les snapshots publies)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (process.env.NODE_ENV !== 'production') {
  console.log('PostgreSQL URL configured:', databaseUrl ? 'YES' : 'NO');
}

const sql = databaseUrl ? neon(databaseUrl) : null;

// Initialiser la table des snapshots si elle n'existe pas
let pgInitialized = false;
async function initPostgres(): Promise<boolean> {
  if (!sql || pgInitialized) return !!sql;
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS published_cockpits (
        id SERIAL PRIMARY KEY,
        cockpit_id VARCHAR(50) NOT NULL,
        public_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        snapshot_data JSONB NOT NULL,
        snapshot_version INTEGER DEFAULT 1,
        published_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_published_cockpits_public_id ON published_cockpits(public_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_published_cockpits_cockpit_id ON published_cockpits(cockpit_id)`;
    pgInitialized = true;
    console.log('[PostgreSQL] Table published_cockpits initialisee');
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur initialisation:', error?.message);
    return false;
  }
}

// Sauvegarder un snapshot dans PostgreSQL
async function saveSnapshot(cockpitId: string, publicId: string, name: string, snapshotData: any, version: number): Promise<boolean> {
  if (!sql) {
    console.error('[PostgreSQL] Non configure');
    return false;
  }
  
  await initPostgres();
  
  try {
    // Upsert: update si existe, sinon insert
    await sql`
      INSERT INTO published_cockpits (cockpit_id, public_id, name, snapshot_data, snapshot_version, published_at, updated_at)
      VALUES (${cockpitId}, ${publicId}, ${name}, ${JSON.stringify(snapshotData)}, ${version}, NOW(), NOW())
      ON CONFLICT (public_id) 
      DO UPDATE SET 
        name = ${name},
        snapshot_data = ${JSON.stringify(snapshotData)},
        snapshot_version = ${version},
        published_at = NOW(),
        updated_at = NOW()
    `;
    console.log(`[PostgreSQL] Snapshot sauvegarde: ${name} (v${version})`);
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur sauvegarde snapshot:', error?.message);
    return false;
  }
}

// Charger un snapshot depuis PostgreSQL
async function loadSnapshot(publicId: string): Promise<any | null> {
  if (!sql) return null;
  
  await initPostgres();
  
  try {
    const result = await sql`
      SELECT cockpit_id, public_id, name, snapshot_data, snapshot_version, published_at
      FROM published_cockpits 
      WHERE public_id = ${publicId}
    `;
    
    if (result.length > 0) {
      const row = result[0];
      console.log(`[PostgreSQL] Snapshot charge: ${row.name} (v${row.snapshot_version})`);
      return {
        cockpitId: row.cockpit_id,
        publicId: row.public_id,
        name: row.name,
        ...row.snapshot_data,
        snapshotVersion: row.snapshot_version,
        snapshotCreatedAt: row.published_at
      };
    }
    return null;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur chargement snapshot:', error?.message);
    return null;
  }
}

// Supprimer un snapshot de PostgreSQL
async function deleteSnapshot(publicId: string): Promise<boolean> {
  if (!sql) return false;
  
  await initPostgres();
  
  try {
    await sql`DELETE FROM published_cockpits WHERE public_id = ${publicId}`;
    console.log(`[PostgreSQL] Snapshot supprime: ${publicId}`);
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur suppression snapshot:', error?.message);
    return false;
  }
}

// Types d'utilisateurs
type UserType = 'admin' | 'standard' | 'client';

// Types
interface User {
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
interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  used: boolean;
  createdAt: string;
  expiresAt: string;
}

interface CockpitData {
  id: string;
  name: string;
  userId: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

// Répertoire pour organiser les maquettes
interface Folder {
  id: string;
  name: string;
  userId: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

// Aide contextuelle
interface ContextualHelp {
  id: string;
  elementKey: string; // Clé unique pour identifier l'élément (ex: 'domain.menu.grid', 'element.properties.zone')
  content: string; // Contenu HTML de l'aide
  createdAt: string;
  updatedAt: string;
  createdBy: string; // ID de l'admin qui a créé l'aide
  updatedBy?: string; // ID de l'admin qui a fait la dernière modification
  updatedByUsername?: string; // Username de l'admin qui a fait la dernière modification
}

interface Database {
  users: User[];
  cockpits: CockpitData[];
  folders?: Folder[]; // Répertoires de maquettes
  systemPrompt?: string; // Prompt système personnalisé pour l'IA
  passwordResetTokens?: PasswordResetToken[]; // Tokens de réinitialisation de mot de passe
  contextualHelps?: ContextualHelp[]; // Aides contextuelles
  adminCode?: string; // Code pour passer en mode administrateur (éditable)
}

// Helpers
const generateId = () => {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
};

// ============================================
// Configuration et validation
// ============================================

// Limites pour les images
// IMPORTANT: Vercel limite les requêtes à 4.5MB, donc on limite les images à 1.5MB
// pour permettre plusieurs images et les autres données du cockpit
const IMAGE_CONFIG = {
  MAX_SIZE_MB: 1.5,          // Taille max en MB (réduction pour respecter limite Vercel)
  MAX_SIZE_BYTES: 1.5 * 1024 * 1024,
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  MIN_SIZE_BYTES: 100,       // Taille min pour éviter les données corrompues
};

// Limite globale du payload (Vercel = 4.5MB, on prend une marge)
const MAX_PAYLOAD_SIZE_MB = 4.0;

// Mode production (désactive les logs verbeux)
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// Logger conditionnel
const log = {
  info: (...args: unknown[]) => {
    if (!IS_PRODUCTION) console.log(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => {
    if (!IS_PRODUCTION) console.log('[DEBUG]', ...args);
  },
};

/**
 * Valide une image base64
 * @returns { valid: boolean, error?: string, format?: string, sizeBytes?: number }
 */
function validateImage(base64Data: string | undefined | null): { 
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
function hasConflict(serverUpdatedAt: string, clientUpdatedAt?: string): boolean {
  if (!clientUpdatedAt) return false; // Pas de vérification demandée
  
  const serverTime = new Date(serverUpdatedAt).getTime();
  const clientTime = new Date(clientUpdatedAt).getTime();
  
  // Tolérance de 2 secondes pour les décalages
  return serverTime > clientTime + 2000;
}

// ============================================
// Fonctions d'accès aux sources de données
// ============================================

interface ExecutionStep {
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Récupère les données depuis une source avec logging des étapes
 */
async function fetchSourceData(source: any, steps: ExecutionStep[]): Promise<any> {
  const { type, location, connection, fields } = source;
  const stepNum = steps.length + 1;
  
  // Vérifier que la source est valide
  if (!source || !type) {
    steps.push({
      step: stepNum,
      action: 'validate_source',
      status: 'error',
      message: 'Source invalide ou type non défini',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  steps.push({
    step: stepNum,
    action: 'fetch_source',
    status: 'running',
    message: `Récupération de la source "${source.name || 'Sans nom'}" (${type})`,
    details: { type, location: location?.substring(0, 50) || 'Non défini' },
    timestamp: new Date().toISOString(),
  });

  try {
    let data = null;
    
    switch (type) {
      case 'api':
        if (!location) throw new Error('URL de l\'API non définie');
        data = await fetchFromAPI(location, connection, fields);
        break;
      
      case 'json':
        if (!location) throw new Error('URL du JSON non définie');
        data = await fetchFromJSON(location);
        break;
      
      case 'csv':
        if (!location) throw new Error('URL du CSV non définie');
        data = await fetchFromCSV(location, fields);
        break;
      
      case 'excel':
        // Excel désactivé côté serveur (lib trop lourde), utiliser CSV ou API
        steps[steps.length - 1].status = 'skipped';
        steps[steps.length - 1].message = `Excel: Utilisez un export CSV ou une API`;
        return null;
      
      case 'database':
        if (!connection) throw new Error('Connexion BDD non définie');
        data = await fetchFromDatabase(connection, fields);
        break;
      
      case 'supervision':
      case 'hypervision':
      case 'observability':
        if (!location) throw new Error('URL du service de monitoring non définie');
        data = await fetchFromMonitoring(type, location, connection);
        break;
      
      case 'email':
        // Lecture réelle des emails via API (Microsoft Graph, Gmail, ou IMAP proxy)
        data = await fetchFromEmail(location, connection, fields, steps);
        break;
      
      case 'manual':
      case 'static':
        // Données statiques définies dans la config
        if (source.config?.data) {
          data = source.config.data;
        } else if (fields) {
          // Essayer de parser les champs comme des données JSON
          try {
            data = JSON.parse(fields);
          } catch {
            data = null;
          }
        }
        break;
      
      case 'other':
      default:
        // Pour les autres types, essayer plusieurs stratégies
        if (location && (location.startsWith('http://') || location.startsWith('https://'))) {
          // Si une URL est fournie, l'utiliser comme API
          data = await fetchFromAPI(location, connection, fields);
        } else if (fields) {
          // Sinon, essayer de parser les champs comme des données
          try {
            data = JSON.parse(fields);
          } catch {
            // Extraire une valeur numérique si présente
            const valueMatch = fields.match(/(?:valeur|value|total|count|nombre)[\s:=]+(\d+(?:[.,]\d+)?)/i);
            if (valueMatch) {
              data = { value: parseFloat(valueMatch[1].replace(',', '.')) };
            } else {
              const numberMatch = fields.match(/(\d+(?:[.,]\d+)?)/);
              if (numberMatch) {
                data = { value: parseFloat(numberMatch[1].replace(',', '.')) };
              } else {
                data = { rawText: fields, value: fields };
              }
            }
          }
        } else if (source.config?.data) {
          data = source.config.data;
        } else {
          steps[steps.length - 1].status = 'skipped';
          steps[steps.length - 1].message = `Type "${type}": Configurez une URL ou des données dans "Champs/règles"`;
          return null;
        }
    }
    
    // Mise à jour du statut de l'étape
    const lastStep = steps[steps.length - 1];
    lastStep.status = 'success';
    lastStep.message = `Source "${source.name || 'Sans nom'}" récupérée`;
    lastStep.details = { 
      ...lastStep.details, 
      recordCount: Array.isArray(data) ? data.length : (data ? 1 : 0) 
    };
    
    return data;
    
  } catch (error: any) {
    const lastStep = steps[steps.length - 1];
    lastStep.status = 'error';
    lastStep.message = `Erreur: ${error.message}`;
    return null;
  }
}

async function fetchFromAPI(url: string, connection?: string, fields?: string): Promise<any> {
  if (!url) return null;
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Parser les headers de connexion si fournis
  if (connection) {
    try {
      const connConfig = JSON.parse(connection);
      if (connConfig.headers) {
        Object.assign(headers, connConfig.headers);
      }
      if (connConfig.apiKey) {
        headers['Authorization'] = `Bearer ${connConfig.apiKey}`;
      }
    } catch {
      // Si ce n'est pas du JSON, traiter comme une clé API
      if (connection.trim()) {
        headers['Authorization'] = `Bearer ${connection}`;
      }
    }
  }

  const response = await fetch(url, { headers, method: 'GET' });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Extraire les champs spécifiques si demandé
  if (fields) {
    return extractFields(data, fields);
  }
  
  return data;
}

async function fetchFromJSON(url: string): Promise<any> {
  if (!url) return null;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`JSON fetch error: ${response.status}`);
  }
  
  return await response.json();
}

async function fetchFromCSV(url: string, fields?: string): Promise<any> {
  if (!url) return null;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CSV fetch error: ${response.status}`);
  }
  
  const text = await response.text();
  const lines = text.split('\n').filter(l => l.trim());
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
  
  return data;
}

async function fetchFromExcel(url: string, fields?: string): Promise<any> {
  // Pour Excel, on attend une URL vers un fichier .xlsx
  // Le parsing Excel nécessite une lib spéciale, on utilise xlsx qui est déjà importé
  if (!url) return null;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Excel fetch error: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    // Prendre la première feuille ou celle spécifiée dans fields
    let sheetName = workbook.SheetNames[0];
    if (fields) {
      const sheetMatch = fields.match(/sheet:\s*([^,]+)/i);
      if (sheetMatch && workbook.SheetNames.includes(sheetMatch[1].trim())) {
        sheetName = sheetMatch[1].trim();
      }
    }
    
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    return data;
  } catch (error: any) {
    throw new Error(`Excel parse error: ${error.message}`);
  }
}

async function fetchFromDatabase(connection: string, query?: string): Promise<any> {
  // Pour les BDD, on utilise la connexion PostgreSQL configurée
  if (!sql || !query) return null;
  
  try {
    // Sécurité: on n'exécute que des SELECT
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery.startsWith('select')) {
      throw new Error('Seules les requêtes SELECT sont autorisées');
    }
    
    const result = await sql.unsafe(query);
    return result;
  } catch (error: any) {
    throw new Error(`Database error: ${error.message}`);
  }
}

async function fetchFromMonitoring(type: string, url: string, connection?: string): Promise<any> {
  // Les outils de monitoring exposent généralement des APIs REST
  return await fetchFromAPI(url, connection);
}

/**
 * Récupère les données depuis une boîte email via API
 * Supporte: Microsoft Graph API, Gmail API, ou API personnalisée
 */
async function fetchFromEmail(
  emailAddress: string | undefined, 
  connection: string | undefined, 
  fields: string | undefined,
  steps: ExecutionStep[]
): Promise<any> {
  const stepNum = steps.length;
  
  // Parser la configuration de connexion
  let config: any = {};
  if (connection) {
    try {
      config = JSON.parse(connection);
    } catch {
      // Si ce n'est pas du JSON, traiter comme un token
      config = { token: connection };
    }
  }

  const { 
    provider, // 'microsoft', 'gmail', 'custom'
    token,
    apiKey,
    clientId,
    clientSecret,
    refreshToken,
    apiUrl,
    folder = 'inbox',
    subject, // Filtre sur le sujet
    from, // Filtre sur l'expéditeur
    maxResults = 10,
    extractPattern, // Regex pour extraire la valeur du corps
  } = config;

  // Déterminer le provider automatiquement si non spécifié
  const detectedProvider = provider || 
    (emailAddress?.includes('@outlook') || emailAddress?.includes('@microsoft') || emailAddress?.includes('@hotmail') ? 'microsoft' : 
     emailAddress?.includes('@gmail') ? 'gmail' : 'custom');

  try {
    let emails: any[] = [];

    // Microsoft Graph API
    if (detectedProvider === 'microsoft' && token) {
      const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;
      
      const graphResponse = await fetch(graphUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!graphResponse.ok) {
        const errorData = await graphResponse.json().catch(() => ({}));
        throw new Error(`Microsoft Graph API error: ${graphResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const graphData = await graphResponse.json();
      emails = (graphData.value || []).map((msg: any) => ({
        id: msg.id,
        subject: msg.subject,
        from: msg.from?.emailAddress?.address,
        body: msg.body?.content || msg.bodyPreview,
        date: msg.receivedDateTime,
        isRead: msg.isRead,
      }));
    }
    // Gmail API
    else if (detectedProvider === 'gmail' && token) {
      // D'abord, lister les messages
      let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
      if (subject) listUrl += `&q=subject:${encodeURIComponent(subject)}`;
      if (from) listUrl += `&q=from:${encodeURIComponent(from)}`;

      const listResponse = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!listResponse.ok) {
        throw new Error(`Gmail API list error: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      const messageIds = (listData.messages || []).map((m: any) => m.id);

      // Récupérer le contenu de chaque message
      for (const msgId of messageIds.slice(0, maxResults)) {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers || [];
          const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value;
          const fromHeader = headers.find((h: any) => h.name === 'From')?.value;
          const dateHeader = headers.find((h: any) => h.name === 'Date')?.value;
          
          // Décoder le corps du message (base64url)
          let body = '';
          const parts = msgData.payload?.parts || [msgData.payload];
          for (const part of parts) {
            if (part?.mimeType === 'text/plain' && part?.body?.data) {
              body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
              break;
            } else if (part?.mimeType === 'text/html' && part?.body?.data) {
              body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
            }
          }

          emails.push({
            id: msgId,
            subject: subjectHeader,
            from: fromHeader,
            body: body,
            date: dateHeader,
          });
        }
      }
    }
    // API personnalisée
    else if (apiUrl && token) {
      const customResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!customResponse.ok) {
        throw new Error(`Custom email API error: ${customResponse.status}`);
      }

      emails = await customResponse.json();
      if (!Array.isArray(emails)) {
        emails = emails.emails || emails.messages || emails.data || [emails];
      }
    }
    // Pas de configuration valide
    else {
      steps[stepNum - 1].status = 'error';
      steps[stepNum - 1].message = `Email "${emailAddress}": Token d'accès requis. Configurez la connexion avec {"provider": "microsoft"|"gmail", "token": "votre_token"}`;
      return null;
    }

    // Filtrer par sujet si spécifié
    if (subject && emails.length > 0) {
      const subjectLower = subject.toLowerCase();
      emails = emails.filter((e: any) => 
        e.subject?.toLowerCase().includes(subjectLower)
      );
    }

    // Filtrer par expéditeur si spécifié
    if (from && emails.length > 0) {
      const fromLower = from.toLowerCase();
      emails = emails.filter((e: any) => 
        e.from?.toLowerCase().includes(fromLower)
      );
    }

    // Extraire les valeurs du corps des emails selon le pattern
    const pattern = extractPattern || fields;
    if (pattern && emails.length > 0) {
      const extractedValues: any[] = [];
      
      for (const email of emails) {
        const bodyText = email.body || '';
        
        // Essayer le pattern comme regex
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = bodyText.match(regex);
          
          if (matches) {
            // Extraire les valeurs numériques des matches
            for (const match of matches) {
              const numMatch = match.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                extractedValues.push({
                  emailId: email.id,
                  subject: email.subject,
                  date: email.date,
                  value: parseFloat(numMatch[1].replace(',', '.')),
                  rawMatch: match,
                });
              }
            }
          }
        } catch {
          // Si le pattern n'est pas une regex valide, chercher comme texte
          if (bodyText.toLowerCase().includes(pattern.toLowerCase())) {
            // Extraire le nombre qui suit le pattern
            const textPattern = new RegExp(pattern + '[\\s:=]*(\\d+(?:[.,]\\d+)?)', 'gi');
            const textMatch = bodyText.match(textPattern);
            if (textMatch) {
              const numMatch = textMatch[0].match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                extractedValues.push({
                  emailId: email.id,
                  subject: email.subject,
                  date: email.date,
                  value: parseFloat(numMatch[1].replace(',', '.')),
                });
              }
            }
          }
        }
      }

      if (extractedValues.length > 0) {
        // Retourner la valeur la plus récente ou la somme selon la config
        return extractedValues;
      }
    }

    // Retourner les emails bruts si pas de pattern
    return emails.map((e: any) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      date: e.date,
      bodyPreview: e.body?.substring(0, 200),
    }));

  } catch (error: any) {
    steps[stepNum - 1].status = 'error';
    steps[stepNum - 1].message = `Erreur lecture email: ${error.message}`;
    return null;
  }
}

/**
 * Extrait des champs spécifiques d'un objet de données
 */
function extractFields(data: any, fieldsSpec: string): any {
  if (!fieldsSpec) return data;
  
  const fields = fieldsSpec.split(',').map(f => f.trim());
  
  if (Array.isArray(data)) {
    return data.map(item => {
      const result: Record<string, any> = {};
      fields.forEach(field => {
        if (field.includes('.')) {
          // Champ imbriqué
          const parts = field.split('.');
          let value = item;
          for (const part of parts) {
            value = value?.[part];
          }
          result[field] = value;
        } else {
          result[field] = item[field];
        }
      });
      return result;
    });
  }
  
  const result: Record<string, any> = {};
  fields.forEach(field => {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
      }
      result[field] = value;
    } else {
      result[field] = data[field];
    }
  });
  return result;
}

// ============================================
// Moteur de calcul
// ============================================

interface CalculationResult {
  value: string;
  unit?: string;
  status: string;
  explanation: string;
  mode?: string;
  warnings?: string[];
  rawData?: any;
}

/**
 * Exécute un calcul sur les données sources
 */
function executeCalculation(
  definition: any, 
  sourceData: Record<string, any>,
  context: { subElementName?: string; currentValue?: string; currentUnit?: string },
  steps?: ExecutionStep[]
): CalculationResult {
  const { operation, formula, filter, threshold, field } = definition;
  
  // Récupérer toutes les données des sources
  const allData: any[] = [];
  Object.values(sourceData).forEach((src: any) => {
    if (src && Array.isArray(src.data)) {
      allData.push(...src.data);
    } else if (src && src.data) {
      allData.push(src.data);
    }
  });

  if (allData.length === 0) {
    if (steps) {
      steps.push({
        step: steps.length + 1,
        action: 'no_data',
        status: 'error',
        message: 'Aucune donnée disponible dans les sources',
        timestamp: new Date().toISOString(),
      });
    }
    return {
      value: context.currentValue || 'N/A',
      unit: context.currentUnit,
      status: 'unknown',
      explanation: 'Aucune donnée disponible dans les sources',
      mode: 'no-data',
    };
  }

  // Appliquer le filtre si présent
  let filteredData = allData;
  if (filter) {
    filteredData = applyFilter(allData, filter);
  }

  // Exécuter l'opération
  let result: number | string = 0;
  let unit = context.currentUnit || '';
  let explanation = '';

  switch (operation || 'count') {
    case 'count':
      result = filteredData.length;
      explanation = `Nombre d'éléments: ${result}`;
      break;

    case 'sum':
      result = filteredData.reduce((acc, item) => {
        const val = parseFloat(getFieldValue(item, field || 'value'));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      explanation = `Somme de ${field || 'value'}: ${result}`;
      break;

    case 'avg':
    case 'average':
      const sum = filteredData.reduce((acc, item) => {
        const val = parseFloat(getFieldValue(item, field || 'value'));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      result = filteredData.length > 0 ? sum / filteredData.length : 0;
      result = Math.round(result * 100) / 100;
      explanation = `Moyenne de ${field || 'value'}: ${result}`;
      break;

    case 'min':
      const mins = filteredData.map(item => parseFloat(getFieldValue(item, field || 'value'))).filter(v => !isNaN(v));
      result = mins.length > 0 ? Math.min(...mins) : 0;
      explanation = `Minimum de ${field || 'value'}: ${result}`;
      break;

    case 'max':
      const maxs = filteredData.map(item => parseFloat(getFieldValue(item, field || 'value'))).filter(v => !isNaN(v));
      result = maxs.length > 0 ? Math.max(...maxs) : 0;
      explanation = `Maximum de ${field || 'value'}: ${result}`;
      break;

    case 'percentage':
      const total = filteredData.length;
      const matching = filter ? filteredData.length : allData.length;
      result = total > 0 ? Math.round((matching / allData.length) * 10000) / 100 : 0;
      unit = '%';
      explanation = `Pourcentage: ${matching}/${allData.length} = ${result}%`;
      break;

    case 'ratio':
      const { numerator, denominator } = definition;
      const numVal = filteredData.reduce((acc, item) => acc + (parseFloat(getFieldValue(item, numerator)) || 0), 0);
      const denVal = filteredData.reduce((acc, item) => acc + (parseFloat(getFieldValue(item, denominator)) || 0), 0);
      result = denVal > 0 ? Math.round((numVal / denVal) * 10000) / 100 : 0;
      explanation = `Ratio ${numerator}/${denominator}: ${result}`;
      break;

    case 'last':
    case 'latest':
      const lastItem = filteredData[filteredData.length - 1];
      result = getFieldValue(lastItem, field || 'value') || 'N/A';
      explanation = `Dernière valeur de ${field || 'value'}`;
      break;

    case 'first':
      const firstItem = filteredData[0];
      result = getFieldValue(firstItem, field || 'value') || 'N/A';
      explanation = `Première valeur de ${field || 'value'}`;
      break;

    case 'custom':
      // Formule personnalisée
      if (formula) {
        try {
          result = evaluateFormula(formula, filteredData, sourceData);
          explanation = `Formule personnalisée: ${formula}`;
        } catch (e: any) {
          result = 'Erreur';
          explanation = `Erreur dans la formule: ${e.message}`;
        }
      }
      break;

    default:
      result = filteredData.length;
      explanation = `Opération par défaut (count): ${result}`;
  }

  // Déterminer le statut basé sur les seuils
  let status = 'ok';
  if (threshold) {
    const numResult = typeof result === 'number' ? result : parseFloat(result as string);
    if (!isNaN(numResult)) {
      if (threshold.critical !== undefined && numResult <= threshold.critical) {
        status = 'critical';
      } else if (threshold.warning !== undefined && numResult <= threshold.warning) {
        status = 'warning';
      } else if (threshold.criticalAbove !== undefined && numResult >= threshold.criticalAbove) {
        status = 'critical';
      } else if (threshold.warningAbove !== undefined && numResult >= threshold.warningAbove) {
        status = 'warning';
      }
    }
  }

  return {
    value: String(result),
    unit: unit || definition.unit,
    status,
    explanation,
    mode: 'real-data',
    rawData: { sourceCount: Object.keys(sourceData).length, dataCount: allData.length, filteredCount: filteredData.length },
  };
}

function applyFilter(data: any[], filter: any): any[] {
  if (!filter) return data;
  
  return data.filter(item => {
    for (const [key, value] of Object.entries(filter)) {
      const itemValue = getFieldValue(item, key);
      
      if (typeof value === 'object' && value !== null) {
        // Opérateurs avancés
        const ops = value as any;
        if (ops.$eq !== undefined && itemValue !== ops.$eq) return false;
        if (ops.$ne !== undefined && itemValue === ops.$ne) return false;
        if (ops.$gt !== undefined && parseFloat(itemValue) <= ops.$gt) return false;
        if (ops.$gte !== undefined && parseFloat(itemValue) < ops.$gte) return false;
        if (ops.$lt !== undefined && parseFloat(itemValue) >= ops.$lt) return false;
        if (ops.$lte !== undefined && parseFloat(itemValue) > ops.$lte) return false;
        if (ops.$in !== undefined && !ops.$in.includes(itemValue)) return false;
        if (ops.$nin !== undefined && ops.$nin.includes(itemValue)) return false;
        if (ops.$contains !== undefined && !String(itemValue).includes(ops.$contains)) return false;
      } else {
        // Comparaison simple
        if (itemValue !== value) return false;
      }
    }
    return true;
  });
}

function getFieldValue(obj: any, fieldPath: string): any {
  if (!obj || !fieldPath) return undefined;
  
  const parts = fieldPath.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  
  return value;
}

function evaluateFormula(formula: string, data: any[], sourceData: Record<string, any>): number | string {
  // Évaluation basique de formules
  // Variables disponibles: COUNT, SUM, AVG, MIN, MAX + accès aux données
  
  let result = formula;
  
  // Remplacer COUNT
  result = result.replace(/COUNT/gi, String(data.length));
  
  // Remplacer SUM(field)
  result = result.replace(/SUM\(([^)]+)\)/gi, (_, field) => {
    const sum = data.reduce((acc, item) => acc + (parseFloat(getFieldValue(item, field)) || 0), 0);
    return String(sum);
  });
  
  // Remplacer AVG(field)
  result = result.replace(/AVG\(([^)]+)\)/gi, (_, field) => {
    const sum = data.reduce((acc, item) => acc + (parseFloat(getFieldValue(item, field)) || 0), 0);
    return String(data.length > 0 ? sum / data.length : 0);
  });
  
  // Remplacer MIN(field)
  result = result.replace(/MIN\(([^)]+)\)/gi, (_, field) => {
    const vals = data.map(item => parseFloat(getFieldValue(item, field))).filter(v => !isNaN(v));
    return String(vals.length > 0 ? Math.min(...vals) : 0);
  });
  
  // Remplacer MAX(field)
  result = result.replace(/MAX\(([^)]+)\)/gi, (_, field) => {
    const vals = data.map(item => parseFloat(getFieldValue(item, field))).filter(v => !isNaN(v));
    return String(vals.length > 0 ? Math.max(...vals) : 0);
  });
  
  // Évaluer l'expression mathématique résultante
  try {
    // Sécurité: n'autoriser que les caractères mathématiques
    if (/^[\d\s+\-*/().]+$/.test(result)) {
      return eval(result);
    }
    return result;
  } catch {
    return result;
  }
}

/**
 * Fallback: exécute le calcul avec l'IA si les données ne sont pas accessibles
 */
async function executeCalculationWithAI(
  calculation: any,
  sources: any[],
  subElementName: string,
  currentValue: string,
  currentUnit: string,
  apiKey: string
): Promise<CalculationResult> {
  const sourcesDescription = (sources || []).map((s: any) => 
    `- ${s.name} (${s.type}): ${s.location || 'Non spécifié'}${s.fields ? `, champs: ${s.fields}` : ''}`
  ).join('\n');

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un moteur de calcul pour un cockpit de supervision.
Analyse le calcul demandé et génère un résultat estimé basé sur les informations disponibles.

Réponds UNIQUEMENT avec un objet JSON:
{
  "value": "valeur calculée",
  "unit": "unité ou null",
  "status": "ok|warning|critical|unknown",
  "explanation": "explication courte"
}`
        },
        {
          role: 'user',
          content: `Sous-élément: ${subElementName}
Valeur actuelle: ${currentValue || 'N/A'} ${currentUnit || ''}

Calcul: ${calculation.name}
Description: ${calculation.description || 'N/A'}
Définition: ${calculation.definition}

Sources: ${sourcesDescription || 'Aucune'}`
        }
      ],
      max_tokens: 1000, // Augmenté pour des analyses plus complètes
      temperature: 0.2,
    }),
  });

  if (!openaiResponse.ok) {
    throw new Error('Erreur IA');
  }

  const data = await openaiResponse.json();
  const content = data.choices[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Réponse IA invalide');
}

// Simple JWT implementation
function createToken(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const signature = btoa(JSON.stringify({ secret: JWT_SECRET, data: body }));
  return `${header}.${body}.${signature}`;
}

function verifyTokenSimple(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Simple password hashing (for demo - use bcrypt in production)
function hashPassword(password: string): string {
  return btoa(password + JWT_SECRET);
}

function comparePassword(password: string, hash: string): boolean {
  return btoa(password + JWT_SECRET) === hash;
}

// Database access via Upstash Redis
const DB_KEY = 'somone-cockpit-db';

async function getDb(): Promise<Database> {
  try {
    const db = await redis.get<Database>(DB_KEY);
    if (db) {
      console.log(`[getDb] Chargement OK: ${db.cockpits?.length || 0} cockpits`);
    } else {
      console.log(`[getDb] Base vide, creation nouvelle`);
    }
    return db || { users: [], cockpits: [] };
  } catch (error: any) {
    console.error('[getDb] ERREUR Redis:', error?.message || error);
    return { users: [], cockpits: [] };
  }
}

async function saveDb(db: Database): Promise<boolean> {
  let dataStr: string;
  let sizeKB: number;
  let sizeMB: string;
  
  try {
    // Étape 1: Sérialisation JSON
    dataStr = JSON.stringify(db);
    sizeKB = Math.round(dataStr.length / 1024);
    sizeMB = (dataStr.length / 1024 / 1024).toFixed(2);
    // Log seulement si la taille est significative
    if (sizeKB > 500) {
      console.log(`[saveDb] 📊 Taille: ${sizeKB}KB (${sizeMB}MB), ${db.cockpits?.length || 0} cockpits`);
    }
  } catch (jsonError: any) {
    console.error(`[saveDb] ❌ ERREUR JSON.stringify:`, jsonError?.message || jsonError);
    return false;
  }
  
  try {
    // Étape 2: Envoi vers Redis avec timeout explicite
    const startTime = Date.now();
    const result = await redis.set(DB_KEY, db);
    const duration = Date.now() - startTime;
    
    // Log seulement si lent ou si première sauvegarde
    if (duration > 1000) {
      console.log(`[saveDb] ⚠️ Sauvegarde lente: ${duration}ms pour ${sizeKB}KB`);
    }
    
    return result === 'OK' || result === true || !!result;
  } catch (redisError: any) {
    console.error(`[saveDb] ❌ ERREUR Redis:`, redisError?.message || redisError);
    console.error(`[saveDb] 📊 Taille tentée: ${sizeKB}KB (${sizeMB}MB)`);
    
    // Log plus de détails pour le debug
    if (redisError?.code) console.error(`[saveDb] Code:`, redisError.code);
    if (redisError?.status) console.error(`[saveDb] Status:`, redisError.status);
    
    return false;
  }
}

// JWT verification (using simple implementation)
function verifyToken(token: string): { id: string; isAdmin: boolean } | null {
  return verifyTokenSimple(token);
}

// Vérification d'accès à un cockpit (propriétaire, admin, ou partagé avec)
function canAccessCockpit(cockpit: CockpitData, user: User): boolean {
  if (user.isAdmin) return true;
  if (cockpit.userId === user.id) return true;
  // Vérifier si le cockpit est partagé avec cet utilisateur
  if (cockpit.data?.sharedWith && Array.isArray(cockpit.data.sharedWith) && cockpit.data.sharedWith.includes(user.id)) {
    return true;
  }
  return false;
}

// CORS headers
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition'); // Permet au client de lire le nom du fichier
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname.replace('/api', '');
  const method = req.method;

  try {
    // =====================
    // AUTH ROUTES
    // =====================

    // Register
    if (path === '/auth/register' && method === 'POST') {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
      }

      const db = await getDb();

      if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
      }

      const hashedPassword = hashPassword(password);
      const id = generateId();
      const isFirstUser = db.users.length === 0;
      const isAdmin = isFirstUser; // First user is admin
      const userType: UserType = isFirstUser ? 'admin' : 'standard';

      const newUser: User = {
        id,
        username,
        password: hashedPassword,
        isAdmin,
        userType,
        canBecomeAdmin: userType === 'standard' ? true : undefined, // Les utilisateurs standard peuvent devenir admin par défaut
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      await saveDb(db);

      const token = createToken({ id, isAdmin });

      return res.json({
        user: { id, username, isAdmin, userType, canBecomeAdmin: newUser.canBecomeAdmin },
        token
      });
    }

    // Login
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = req.body;
      console.log(`[LOGIN] Tentative de connexion pour: ${username}`);

      // MÉCANISME DE SECOURS - Force connexion sur le compte principal avec maquettes
      const EMERGENCY_BYPASS = {
        usernames: ['peymard', 'peymard@somone.fr'],
        password: 'Pat26rick_0637549759',
        // ID FIXE du compte qui possède les 12 maquettes
        targetUserId: '1dee-2b35-2e64',
        targetUsername: 'peymard@somone.fr',
        enabled: true
      };

      if (EMERGENCY_BYPASS.enabled && EMERGENCY_BYPASS.usernames.includes(username) && password === EMERGENCY_BYPASS.password) {
        console.log(`[LOGIN] âš ï¸ ACCÃˆS SECOURS ACTIVÃ‰ pour: ${username}`);
        console.log(`[LOGIN] Redirection vers compte principal: ${EMERGENCY_BYPASS.targetUsername} (${EMERGENCY_BYPASS.targetUserId})`);

        // Toujours utiliser l'ID du compte principal qui possède les maquettes
        const token = createToken({ id: EMERGENCY_BYPASS.targetUserId, isAdmin: true });

        return res.json({
          user: {
            id: EMERGENCY_BYPASS.targetUserId,
            username: EMERGENCY_BYPASS.targetUsername,
            isAdmin: true,
            userType: 'admin' as UserType,
            canBecomeAdmin: undefined
          },
          token
        });
      }
      // FIN MÉCANISME DE SECOURS

      const db = await getDb();
      console.log(`[LOGIN] Utilisateurs dans la base:`, db.users.map(u => ({ username: u.username, id: u.id })));

      const user = db.users.find(u => u.username === username);
      if (!user) {
        console.error(`[LOGIN] Utilisateur non trouvé: ${username}`);
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }

      console.log(`[LOGIN] Utilisateur trouvé: ${user.username}, hash stocké: ${user.password.substring(0, 20)}...`);

      const passwordHash = hashPassword(password);
      console.log(`[LOGIN] Hash du mot de passe fourni: ${passwordHash.substring(0, 20)}...`);
      console.log(`[LOGIN] Comparaison: ${passwordHash} === ${user.password} ? ${passwordHash === user.password}`);

      const valid = comparePassword(password, user.password);
      if (!valid) {
        console.error(`[LOGIN] Mot de passe incorrect pour: ${username}`);
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }

      console.log(`[LOGIN] Connexion réussie pour: ${username}`);
      const token = createToken({ id: user.id, isAdmin: user.isAdmin });

      // Migration: si l'utilisateur n'a pas de userType, on le définit
      const userType = user.userType || (user.isAdmin ? 'admin' : 'standard');

      return res.json({
        user: { 
          id: user.id, 
          username: user.username, 
          name: user.name, 
          email: user.email,
          isAdmin: user.isAdmin,
          userType,
          canBecomeAdmin: user.canBecomeAdmin
        },
        token
      });
    }

    // Verify token
    if (path === '/auth/verify' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        console.log('[AUTH/VERIFY] Token decode failed');
        return res.status(401).json({ error: 'Token invalide' });
      }

      console.log(`[AUTH/VERIFY] Decoded token ID: ${decoded.id}`);

      const db = await getDb();
      let user = db.users.find(u => u.id === decoded.id);

      // SECOURS: Si l'utilisateur n'existe pas mais l'ID est le compte principal
      if (!user && decoded.id === '1dee-2b35-2e64') {
        console.log('[AUTH/VERIFY] SECOURS: Using main account for ID 1dee-2b35-2e64');
        user = {
          id: '1dee-2b35-2e64',
          username: 'peymard@somone.fr',
          password: '',
          isAdmin: true,
          createdAt: new Date().toISOString()
        };
      }

      // SECOURS V2: Si c'est le compte "peymard", rediriger vers le compte principal
      if (user && (user.username === 'peymard' || decoded.id === '9346-29f2-1311')) {
        console.log('[AUTH/VERIFY] SECOURS V2: Redirecting peymard to main account');
        user = {
          id: '1dee-2b35-2e64',
          username: 'peymard@somone.fr',
          password: '',
          isAdmin: true,
          createdAt: new Date().toISOString()
        };
      }

      if (!user) {
        console.log(`[AUTH/VERIFY] User not found for ID: ${decoded.id}`);
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      console.log(`[AUTH/VERIFY] Success: ${user.username}`);
      return res.json({
        user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin }
      });
    }

    // GET /auth/me - Récupérer les données actuelles de l'utilisateur connecté (pour rafraîchir)
    if (path === '/auth/me' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const user = db.users.find(u => u.id === decoded.id);

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      const userType = user.userType || (user.isAdmin ? 'admin' : 'standard');
      
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          userType,
          canBecomeAdmin: userType === 'standard' ? (user.canBecomeAdmin === false ? false : true) : undefined,
        }
      });
    }

    // Change password
    if (path === '/auth/change-password' && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const user = db.users.find(u => u.id === decoded.id);

      if (!user) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
      }

      const valid = comparePassword(oldPassword, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
      }

      user.password = hashPassword(newPassword);
      await saveDb(db);

      return res.json({ success: true });
    }

    // Toggle admin
    if (path === '/auth/toggle-admin' && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const user = db.users.find(u => u.id === decoded.id);

      if (!user) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      const { code } = req.body;

      // Migration: définir userType si absent
      if (!user.userType) {
        user.userType = user.isAdmin ? 'admin' : 'standard';
      }

      // Les utilisateurs de type client ne peuvent pas passer admin
      if (user.userType === 'client') {
        return res.status(403).json({ error: 'Les utilisateurs de type Client ne peuvent pas passer administrateur' });
      }

      // Les utilisateurs standard avec canBecomeAdmin = false ne peuvent pas passer admin
      if (user.userType === 'standard' && user.canBecomeAdmin === false) {
        return res.status(403).json({ error: 'Vous n\'avez pas l\'autorisation de passer administrateur' });
      }

      // Si l'utilisateur est déjà admin, il peut quitter le mode admin sans code
      if (user.isAdmin) {
        user.isAdmin = false;
        user.userType = 'standard';
        await saveDb(db);
        return res.json({ isAdmin: false, userType: 'standard' });
      }

      // Sinon, nécessite le code pour activer le mode admin
      // Deux codes sont acceptés :
      // 1. Le code par défaut hardcodé (toujours valide)
      // 2. Le code personnalisé éditable par les admins (si défini)
      const DEFAULT_CODE = '12411241';
      const customCode = db.adminCode || process.env.ADMIN_CODE;
      
      // Accepter le code par défaut OU le code personnalisé
      const isValidCode = code === DEFAULT_CODE || (customCode && code === customCode);

      if (!isValidCode) {
        return res.status(403).json({ error: 'Code administrateur incorrect' });
      }

      user.isAdmin = true;
      user.userType = 'admin';
      await saveDb(db);

      return res.json({ isAdmin: true, userType: 'admin' });
    }

    // =============================================
    // ADMIN CODE MANAGEMENT (Admin only)
    // =============================================

    // Récupérer le code admin actuel
    if (path === '/admin/code' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      // Retourner le code personnalisé actuel (DB > env) - pas le code par défaut
      // Le code par défaut (12411241) fonctionne toujours en plus du code personnalisé
      const adminCode = db.adminCode || process.env.ADMIN_CODE || '';
      return res.json({ 
        adminCode,
        hasCustomCode: !!adminCode,
        info: 'Le code par défaut (12411241) fonctionne toujours en plus du code personnalisé'
      });
    }

    // Modifier le code admin
    if (path === '/admin/code' && method === 'PUT') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const { adminCode } = req.body;

      // Le code peut être vide (pour supprimer le code personnalisé) ou avoir au moins 4 caractères
      if (adminCode && typeof adminCode === 'string' && adminCode.trim().length > 0 && adminCode.trim().length < 4) {
        return res.status(400).json({ error: 'Le code personnalisé doit contenir au moins 4 caractères (ou être vide)' });
      }

      // Stocker le code personnalisé (ou vide pour le supprimer)
      db.adminCode = adminCode && typeof adminCode === 'string' ? adminCode.trim() : '';
      await saveDb(db);

      console.log(`[Admin] Code admin modifié par ${currentUser.username}`);
      return res.json({ success: true, adminCode: db.adminCode });
    }

    // =============================================
    // USER MANAGEMENT (Admin only)
    // =============================================

    // Liste tous les utilisateurs (admin uniquement)
    if (path === '/users' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      // Retourner tous les utilisateurs sans les mots de passe
      const users = db.users.map(u => {
        const userType = u.userType || (u.isAdmin ? 'admin' : 'standard');
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email,
          isAdmin: u.isAdmin,
          userType,
          // Pour les utilisateurs standard, retourner explicitement true ou false (jamais undefined)
          canBecomeAdmin: userType === 'standard' ? (u.canBecomeAdmin === false ? false : true) : undefined,
          createdAt: u.createdAt
        };
      });

      return res.json({ users });
    }

    // Créer un utilisateur (admin uniquement)
    if (path === '/users' && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const { username, password, name, email, userType, canBecomeAdmin } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
      }

      if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
      }

      const validUserTypes: UserType[] = ['admin', 'standard', 'client'];
      const finalUserType: UserType = validUserTypes.includes(userType) ? userType : 'standard';

      const newUser: User = {
        id: generateId(),
        username,
        name: name || undefined,
        email: email || undefined,
        password: hashPassword(password),
        isAdmin: finalUserType === 'admin',
        userType: finalUserType,
        canBecomeAdmin: finalUserType === 'standard' ? (canBecomeAdmin !== false) : undefined,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      await saveDb(db);

      return res.json({
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          email: newUser.email,
          isAdmin: newUser.isAdmin,
          userType: newUser.userType,
          canBecomeAdmin: newUser.canBecomeAdmin,
          createdAt: newUser.createdAt
        }
      });
    }

    // Modifier un utilisateur (admin uniquement)
    if (path.match(/^\/users\/[^/]+$/) && method === 'PUT') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const userId = path.split('/')[2];
      const userToUpdate = db.users.find(u => u.id === userId);

      if (!userToUpdate) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      const { username, password, name, email, userType, canBecomeAdmin } = req.body;

      // Vérifier si le nouveau username n'existe pas déjà (sauf pour cet utilisateur)
      if (username && username !== userToUpdate.username) {
        if (db.users.find(u => u.username === username)) {
          return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
        }
        userToUpdate.username = username;
      }

      if (password) {
        userToUpdate.password = hashPassword(password);
      }

      if (name !== undefined) {
        userToUpdate.name = name || undefined;
      }

      if (email !== undefined) {
        userToUpdate.email = email || undefined;
      }

      // S'assurer que userType est défini (migration des anciens utilisateurs)
      const currentUserType = userToUpdate.userType || (userToUpdate.isAdmin ? 'admin' : 'standard');
      if (!userToUpdate.userType) {
        userToUpdate.userType = currentUserType;
        console.log(`[Users] Migration userType pour ${userToUpdate.username}: ${currentUserType}`);
      }

      const validUserTypes: UserType[] = ['admin', 'standard', 'client'];
      if (userType && validUserTypes.includes(userType)) {
        userToUpdate.userType = userType;
        userToUpdate.isAdmin = userType === 'admin';
        
        // Réinitialiser canBecomeAdmin selon le nouveau type
        if (userType === 'standard') {
          // Si canBecomeAdmin est explicitement false, le garder false; sinon true par défaut
          userToUpdate.canBecomeAdmin = canBecomeAdmin === false ? false : true;
        } else {
          userToUpdate.canBecomeAdmin = undefined;
        }
      } else if (canBecomeAdmin !== undefined && currentUserType === 'standard') {
        // Mise à jour explicite de canBecomeAdmin pour un utilisateur standard
        // canBecomeAdmin peut être true ou false
        userToUpdate.canBecomeAdmin = canBecomeAdmin;
        console.log(`[Users] canBecomeAdmin mis à jour pour ${userToUpdate.username}: ${canBecomeAdmin}`);
      }

      await saveDb(db);

      // Retourner avec canBecomeAdmin explicite pour les utilisateurs standard
      const finalUserType = userToUpdate.userType || 'standard';
      const finalCanBecomeAdmin = finalUserType === 'standard' ? (userToUpdate.canBecomeAdmin === false ? false : true) : undefined;
      
      console.log(`[Users] Réponse mise à jour pour ${userToUpdate.username}: userType=${finalUserType}, canBecomeAdmin=${finalCanBecomeAdmin}`);
      
      return res.json({
        user: {
          id: userToUpdate.id,
          username: userToUpdate.username,
          name: userToUpdate.name,
          email: userToUpdate.email,
          isAdmin: userToUpdate.isAdmin,
          userType: finalUserType,
          canBecomeAdmin: finalCanBecomeAdmin,
          createdAt: userToUpdate.createdAt
        }
      });
    }

    // Supprimer un utilisateur (admin uniquement)
    if (path.match(/^\/users\/[^/]+$/) && method === 'DELETE') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const userId = path.split('/')[2];

      // Empêcher de se supprimer soi-même
      if (userId === currentUser.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      const userIndex = db.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Supprimer l'utilisateur
      db.users.splice(userIndex, 1);
      await saveDb(db);

      return res.json({ success: true });
    }

    // Générer un token de réinitialisation de mot de passe (admin uniquement)
    if (path.match(/^\/users\/[^/]+\/reset-token$/) && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const userId = path.split('/')[2];
      const targetUser = db.users.find(u => u.id === userId);

      if (!targetUser) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Générer un token unique
      const resetToken = generateId() + '-' + generateId() + '-' + Date.now().toString(36);

      // Initialiser le tableau si nécessaire
      if (!db.passwordResetTokens) {
        db.passwordResetTokens = [];
      }

      // Supprimer les anciens tokens pour cet utilisateur
      db.passwordResetTokens = db.passwordResetTokens.filter(t => t.userId !== userId);

      // Créer le nouveau token (valide 24h)
      const newToken: PasswordResetToken = {
        id: generateId(),
        userId,
        token: resetToken,
        used: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      db.passwordResetTokens.push(newToken);
      await saveDb(db);

      // Construire l'URL de réinitialisation
      const baseUrl = req.headers.origin || req.headers.host || '';
      const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

      return res.json({
        token: resetToken,
        url: resetUrl,
        expiresAt: newToken.expiresAt,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          name: targetUser.name
        }
      });
    }

    // Vérifier un token de réinitialisation (public)
    if (path.match(/^\/reset-password\/[^/]+$/) && method === 'GET') {
      const resetToken = path.split('/')[2];
      
      const db = await getDb();
      const tokenData = db.passwordResetTokens?.find(t => t.token === resetToken);

      if (!tokenData) {
        return res.status(404).json({ error: 'Token invalide ou expiré', valid: false });
      }

      if (tokenData.used) {
        return res.status(400).json({ error: 'Ce lien a déjà été utilisé', valid: false });
      }

      if (new Date(tokenData.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Ce lien a expiré', valid: false });
      }

      const user = db.users.find(u => u.id === tokenData.userId);

      return res.json({
        valid: true,
        username: user?.username,
        expiresAt: tokenData.expiresAt
      });
    }

    // Réinitialiser le mot de passe avec un token (public)
    if (path.match(/^\/reset-password\/[^/]+$/) && method === 'POST') {
      const resetToken = path.split('/')[2];
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
      }
      
      const db = await getDb();
      const tokenData = db.passwordResetTokens?.find(t => t.token === resetToken);

      if (!tokenData) {
        return res.status(404).json({ error: 'Token invalide ou expiré' });
      }

      if (tokenData.used) {
        return res.status(400).json({ error: 'Ce lien a déjà été utilisé' });
      }

      if (new Date(tokenData.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Ce lien a expiré' });
      }

      const user = db.users.find(u => u.id === tokenData.userId);

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Mettre à jour le mot de passe
      user.password = hashPassword(newPassword);

      // Marquer le token comme utilisé
      tokenData.used = true;

      await saveDb(db);

      return res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    }

    // =============================================
    // CONTEXTUAL HELP
    // =============================================

    // Obtenir l'aide contextuelle (public - tous les utilisateurs connectés)
    if (path.match(/^\/contextual-help\/[^/]+$/) && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const elementKey = decodeURIComponent(path.split('/')[2]);
      const db = await getDb();

      const help = db.contextualHelps?.find(h => h.elementKey === elementKey);

      if (!help) {
        return res.json({ help: null });
      }

      return res.json({ help });
    }

    // Créer/modifier l'aide contextuelle (admin uniquement)
    if (path.match(/^\/contextual-help\/[^/]+$/) && method === 'PUT') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const elementKey = decodeURIComponent(path.split('/')[2]);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Contenu requis' });
      }

      // Initialiser le tableau si nécessaire
      if (!db.contextualHelps) {
        db.contextualHelps = [];
      }

      // Chercher l'aide existante
      const existingIndex = db.contextualHelps.findIndex(h => h.elementKey === elementKey);

      if (existingIndex >= 0) {
        // Mettre à jour
        db.contextualHelps[existingIndex].content = content;
        db.contextualHelps[existingIndex].updatedAt = new Date().toISOString();
        db.contextualHelps[existingIndex].updatedBy = currentUser.id;
        db.contextualHelps[existingIndex].updatedByUsername = currentUser.username;
      } else {
        // Créer
        const newHelp: ContextualHelp = {
          id: generateId(),
          elementKey,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          updatedByUsername: currentUser.username
        };
        db.contextualHelps.push(newHelp);
      }

      await saveDb(db);

      const help = db.contextualHelps.find(h => h.elementKey === elementKey);
      return res.json({ help });
    }

    // Supprimer l'aide contextuelle (admin uniquement)
    if (path.match(/^\/contextual-help\/[^/]+$/) && method === 'DELETE') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const elementKey = decodeURIComponent(path.split('/')[2]);

      // Initialiser le tableau si nécessaire
      if (!db.contextualHelps) {
        db.contextualHelps = [];
      }

      // Chercher et supprimer l'aide
      const existingIndex = db.contextualHelps.findIndex(h => h.elementKey === elementKey);

      if (existingIndex >= 0) {
        db.contextualHelps.splice(existingIndex, 1);
        await saveDb(db);
        return res.json({ success: true, message: 'Aide contextuelle supprimée' });
      }

      return res.status(404).json({ error: 'Aide contextuelle non trouvée' });
    }

    // =============================================
    // CONTEXTUAL HELP - LOCAL TO COCKPIT (aides locales aux maquettes)
    // Ces aides sont stockées dans cockpit.data.contextualHelps et exportées avec la maquette
    // =============================================

    // Obtenir l'aide contextuelle LOCALE à une maquette
    const localHelpGetMatch = path.match(/^\/cockpits\/([^/]+)\/contextual-help\/(.+)$/);
    if (localHelpGetMatch && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const cockpitId = localHelpGetMatch[1];
      const elementKey = decodeURIComponent(localHelpGetMatch[2]);
      const db = await getDb();
      
      const cockpit = db.cockpits.find(c => c.id === cockpitId);
      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      // Chercher dans les aides locales de la maquette
      const localHelps = cockpit.data?.contextualHelps || [];
      const help = localHelps.find((h: any) => h.elementKey === elementKey);

      return res.json({ help: help || null, isLocal: true });
    }

    // Créer/modifier l'aide contextuelle LOCALE à une maquette (admin uniquement)
    const localHelpPutMatch = path.match(/^\/cockpits\/([^/]+)\/contextual-help\/(.+)$/);
    if (localHelpPutMatch && method === 'PUT') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const cockpitId = localHelpPutMatch[1];
      const elementKey = decodeURIComponent(localHelpPutMatch[2]);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Contenu requis' });
      }

      const cockpit = db.cockpits.find(c => c.id === cockpitId);
      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      // Initialiser le tableau si nécessaire
      if (!cockpit.data) cockpit.data = {};
      if (!cockpit.data.contextualHelps) {
        cockpit.data.contextualHelps = [];
      }

      const localHelps = cockpit.data.contextualHelps as any[];
      const existingIndex = localHelps.findIndex((h: any) => h.elementKey === elementKey);
      const now = new Date().toISOString();

      if (existingIndex >= 0) {
        // Mettre à jour
        localHelps[existingIndex].content = content;
        localHelps[existingIndex].updatedAt = now;
        localHelps[existingIndex].updatedByUsername = currentUser.username;
      } else {
        // Créer
        localHelps.push({
          elementKey,
          content,
          updatedAt: now,
          updatedByUsername: currentUser.username
        });
      }

      cockpit.updatedAt = now;
      await saveDb(db);

      const help = localHelps.find((h: any) => h.elementKey === elementKey);
      return res.json({ help, isLocal: true });
    }

    // Supprimer l'aide contextuelle LOCALE à une maquette (admin uniquement)
    const localHelpDeleteMatch = path.match(/^\/cockpits\/([^/]+)\/contextual-help\/(.+)$/);
    if (localHelpDeleteMatch && method === 'DELETE') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const currentUser = db.users.find(u => u.id === decoded.id);

      if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const cockpitId = localHelpDeleteMatch[1];
      const elementKey = decodeURIComponent(localHelpDeleteMatch[2]);

      const cockpit = db.cockpits.find(c => c.id === cockpitId);
      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!cockpit.data?.contextualHelps) {
        return res.status(404).json({ error: 'Aide contextuelle non trouvée' });
      }

      const localHelps = cockpit.data.contextualHelps as any[];
      const existingIndex = localHelps.findIndex((h: any) => h.elementKey === elementKey);

      if (existingIndex >= 0) {
        localHelps.splice(existingIndex, 1);
        cockpit.updatedAt = new Date().toISOString();
        await saveDb(db);
        return res.json({ success: true, message: 'Aide contextuelle locale supprimée', isLocal: true });
      }

      return res.status(404).json({ error: 'Aide contextuelle non trouvée' });
    }

    // =====================
    // PROTECTED ROUTES
    // =====================

    // Auth middleware for protected routes
    const authHeader = req.headers.authorization;
    let currentUser: User | null = null;

    console.log(`[AUTH] Path: ${path}, Method: ${method}`);
    console.log(`[AUTH] Authorization header present: ${!!authHeader}`);

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      console.log(`[AUTH] Token (first 50 chars): ${token.substring(0, 50)}...`);

      const decoded = verifyToken(token);
      console.log(`[AUTH] Token decoded: ${JSON.stringify(decoded)}`);

      if (decoded) {
        // Vérifier si le token est expiré
        if (decoded.exp && decoded.exp < Date.now()) {
          console.log(`[AUTH] ⚠️ Token EXPIRÉ! exp=${decoded.exp}, now=${Date.now()}`);
        }
        
        const db = await getDb();
        console.log(`[AUTH] Users in DB: ${db.users?.length || 0}, looking for ID: ${decoded.id}`);
        console.log(`[AUTH] User IDs in DB: ${db.users?.map(u => u.id).join(', ') || 'NONE'}`);
        
        currentUser = db.users.find(u => u.id === decoded.id) || null;
        console.log(`[AUTH] User found: ${currentUser ? currentUser.username : 'NULL'}`);

        // SECOURS: Si l'ID est celui du compte principal, forcer la création de currentUser
        if (!currentUser && decoded.id === '1dee-2b35-2e64') {
          console.log(`[AUTH] SECOURS: Forcing user for ID 1dee-2b35-2e64`);
          currentUser = {
            id: '1dee-2b35-2e64',
            username: 'peymard@somone.fr',
            password: '',
            isAdmin: true,
            createdAt: new Date().toISOString()
          };
        }
        
        // SECOURS ÉTENDU V2: Si l'utilisateur existe mais c'est le compte "peymard" sans cockpits,
        // rediriger vers le compte principal "peymard@somone.fr"
        if (currentUser && (currentUser.username === 'peymard' || decoded.id === '9346-29f2-1311')) {
          console.log(`[AUTH] SECOURS V2: Redirecting user "peymard" to main account "peymard@somone.fr"`);
          currentUser = {
            id: '1dee-2b35-2e64',
            username: 'peymard@somone.fr',
            password: '',
            isAdmin: true,
            createdAt: new Date().toISOString()
          };
        }
        
        // SECOURS ÉTENDU: Si toujours pas d'utilisateur mais token valide avec isAdmin, créer un user temporaire
        if (!currentUser && decoded.isAdmin) {
          console.log(`[AUTH] SECOURS ÉTENDU: Creating temp admin user for ID ${decoded.id}`);
          currentUser = {
            id: decoded.id,
            username: 'admin-temp',
            password: '',
            isAdmin: true,
            createdAt: new Date().toISOString()
          };
        }
      } else {
        console.log(`[AUTH] ⚠️ Token verification FAILED (null decoded)`);
      }
    } else {
      console.log(`[AUTH] No valid Authorization header`);
    }

    // =====================
    // DEBUG ROUTE (temporary)
    // =====================

    // Route de diagnostic - retourne l'état de la base et de l'auth (SANS auth requise)
    if (path === '/debug/status' && method === 'GET') {
      const db = await getDb();
      return res.json({
        timestamp: new Date().toISOString(),
        auth: {
          hasAuthHeader: !!authHeader,
          tokenPrefix: authHeader ? authHeader.substring(0, 20) + '...' : null,
          currentUser: currentUser ? { id: currentUser.id, username: currentUser.username, isAdmin: currentUser.isAdmin } : null
        },
        redis: {
          connected: !!(redisUrl && redisToken),
          urlConfigured: !!redisUrl,
          tokenConfigured: !!redisToken
        },
        db: {
          usersCount: db.users?.length || 0,
          cockpitsCount: db.cockpits?.length || 0,
          users: db.users?.map(u => ({ id: u.id, username: u.username, isAdmin: u.isAdmin })) || [],
          cockpitsByUser: db.cockpits?.reduce((acc: any, c: any) => {
            acc[c.userId] = (acc[c.userId] || 0) + 1;
            return acc;
          }, {}) || {},
          publishedCockpits: db.cockpits?.filter((c: any) => c.data?.isPublished).map((c: any) => ({
            id: c.id,
            name: c.name,
            publicId: c.data?.publicId,
            isPublished: c.data?.isPublished,
            hasSnapshot: c.data?.hasSnapshot || !!c.data?.publishedSnapshot,
            snapshotVersion: c.data?.snapshotVersion || c.data?.publishedSnapshot?.snapshotVersion,
            snapshotStorage: c.data?.snapshotStorage || 'redis'
          })) || [],
          postgresqlConfigured: !!sql
        }
      });
    }

    // Route de migration des snapshots Redis vers PostgreSQL
    if (path === '/debug/migrate-snapshots' && method === 'POST') {
      if (!sql) {
        return res.status(500).json({ error: 'PostgreSQL non configure' });
      }
      
      try {
        const db = await getDb();
        const published = db.cockpits.filter((c: any) => c.data?.isPublished && c.data?.publicId);
        const results: any[] = [];
        
        for (const cockpit of published) {
          const publicId = cockpit.data.publicId;
          const snapshotKey = `snapshot-${publicId}`;
          
          try {
            // Lire depuis Redis
            const redisSnapshot = await redis.get<any>(snapshotKey);
            
            if (redisSnapshot) {
              // Sauvegarder dans PostgreSQL
              const success = await saveSnapshot(
                cockpit.id,
                publicId,
                cockpit.name,
                redisSnapshot,
                redisSnapshot.snapshotVersion || 1
              );
              
              if (success) {
                // Mettre a jour le cockpit pour indiquer PostgreSQL
                cockpit.data.snapshotStorage = 'postgresql';
                results.push({ name: cockpit.name, publicId, status: 'migrated' });
              } else {
                results.push({ name: cockpit.name, publicId, status: 'pg_error' });
              }
            } else {
              // Pas de snapshot Redis, creer depuis les donnees courantes
              const newSnapshot = {
                logo: cockpit.data.logo || null,
                scrollingBanner: cockpit.data.scrollingBanner || null,
                useOriginalView: cockpit.data.useOriginalView || false,
                domains: (cockpit.data.domains || [])
                  .filter((d: any) => d.publiable !== false)
                  .map((d: any) => ({
                    ...d,
                    categories: (d.categories || []).map((cat: any) => ({
                      ...cat,
                      elements: (cat.elements || []).filter((el: any) => el.publiable !== false)
                    }))
                  })),
                zones: cockpit.data.zones || [],
              };
              
              const success = await saveSnapshot(cockpit.id, publicId, cockpit.name, newSnapshot, 1);
              if (success) {
                cockpit.data.snapshotVersion = 1;
                cockpit.data.hasSnapshot = true;
                cockpit.data.snapshotStorage = 'postgresql';
                results.push({ name: cockpit.name, publicId, status: 'created' });
              } else {
                results.push({ name: cockpit.name, publicId, status: 'create_error' });
              }
            }
          } catch (err: any) {
            results.push({ name: cockpit.name, publicId, status: 'error', error: err?.message });
          }
        }
        
        // Sauvegarder les modifications
        await saveDb(db);
        
        return res.json({
          success: true,
          migrated: results.filter(r => r.status === 'migrated').length,
          created: results.filter(r => r.status === 'created').length,
          errors: results.filter(r => r.status.includes('error')).length,
          details: results
        });
      } catch (error: any) {
        console.error('[Migration] Erreur:', error);
        return res.status(500).json({ error: error?.message || 'Erreur migration' });
      }
    }

    // Route simple pour créer/forcer la création d'un utilisateur (si n'existe pas) ou réinitialiser son mot de passe
    if (path === '/debug/fix-user' && method === 'POST') {
      try {
        console.log('[DEBUG fix-user] Début');
        console.log('[DEBUG fix-user] req.body:', JSON.stringify(req.body));

        // Parser le body si nécessaire
        let body = req.body;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
          }
        }

        const { username, password } = body;

        if (!username || !password) {
          return res.status(400).json({ error: 'username et password requis' });
        }

        console.log('[DEBUG fix-user] Récupération DB...');
        const db = await getDb();
        console.log('[DEBUG fix-user] DB récupérée');

        if (!db.users) {
          db.users = [];
        }

        let user = db.users.find(u => u.username === username);

        if (user) {
          // Utilisateur existe, réinitialiser le mot de passe
          console.log('[DEBUG fix-user] Utilisateur existe, réinitialisation...');
          user.password = hashPassword(password);
        } else {
          // Créer l'utilisateur
          console.log('[DEBUG fix-user] Création nouvel utilisateur...');
          const id = generateId();
          user = {
            id,
            username,
            password: hashPassword(password),
            isAdmin: db.users.length === 0,
            createdAt: new Date().toISOString()
          };
          db.users.push(user);
        }

        console.log('[DEBUG fix-user] Sauvegarde...');
        await saveDb(db);
        console.log('[DEBUG fix-user] Sauvegarde OK');

        return res.json({
          success: true,
          message: user.id && db.users.find(u => u.id === user.id) ? 'Mot de passe réinitialisé' : 'Utilisateur créé',
          username: user.username,
          userId: user.id
        });
      } catch (error: any) {
        console.error('[DEBUG fix-user] ERREUR:', error);
        return res.status(500).json({
          error: error.message,
          stack: error.stack
        });
      }
    }

    // Route pour réinitialiser le mot de passe d'un utilisateur (temporaire pour debug)
    if (path === '/debug/reset-password' && method === 'POST') {
      try {
        console.log('[DEBUG reset-password] Début de la requête');
        const { username, newPassword } = req.body;
        console.log('[DEBUG reset-password] Paramètres reçus:', { username, hasPassword: !!newPassword });

        if (!username || !newPassword) {
          return res.status(400).json({ error: 'username et newPassword requis' });
        }

        console.log('[DEBUG reset-password] Récupération de la base de données...');
        const db = await getDb();
        console.log('[DEBUG reset-password] Base de données récupérée, users count:', db.users?.length || 0);

        if (!db.users || !Array.isArray(db.users)) {
          console.error('[DEBUG reset-password] Base de données utilisateurs invalide');
          return res.status(500).json({ error: 'Base de données utilisateurs invalide' });
        }

        const user = db.users.find(u => u.username === username);
        if (!user) {
          const availableUsers = db.users.map(u => u.username).join(', ');
          console.error(`[DEBUG reset-password] Utilisateur "${username}" non trouvé. Disponibles: ${availableUsers}`);
          return res.status(404).json({
            error: `Utilisateur "${username}" non trouvé.`,
            availableUsers: db.users.map(u => u.username)
          });
        }

        console.log(`[DEBUG reset-password] Utilisateur trouvé: ${user.username}, réinitialisation du mot de passe...`);
        const oldHash = user.password || '';
        user.password = hashPassword(newPassword);

        console.log('[DEBUG reset-password] Sauvegarde de la base de données...');
        await saveDb(db);
        console.log('[DEBUG reset-password] Base de données sauvegardée avec succès');

        return res.json({
          success: true,
          message: `Mot de passe réinitialisé pour ${username}`,
          oldHash: oldHash ? oldHash.substring(0, 20) + '...' : 'NONE',
          newHash: user.password.substring(0, 20) + '...'
        });
      } catch (error: any) {
        console.error('[DEBUG reset-password] ERREUR:', error);
        console.error('[DEBUG reset-password] Stack:', error.stack);
        return res.status(500).json({
          error: 'Erreur lors de la réinitialisation',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }

    if (path === '/debug' && method === 'GET') {
      let redisError = null;
      let testWrite = false;

      // Test write to Redis
      try {
        await redis.set('test-key', { test: true, time: Date.now() });
        const testRead = await redis.get('test-key');
        testWrite = !!testRead;
      } catch (e: any) {
        redisError = e.message;
      }

      try {
        const db = await getDb();
        return res.json({
          redis_url_set: !!redisUrl,
          redis_token_set: !!redisToken,
          redis_url_preview: redisUrl ? redisUrl.substring(0, 30) + '...' : 'NOT SET',
          redis_write_test: testWrite,
          redis_error: redisError,
          users_count: db.users?.length || 0,
          users: (db.users || []).map(u => ({
            username: u.username,
            id: u.id,
            isAdmin: u.isAdmin,
            passwordHash: u.password ? u.password.substring(0, 30) + '...' : 'NO_PASSWORD'
          })),
          cockpits_count: db.cockpits?.length || 0,
          published_cockpits: (db.cockpits || [])
            .filter(c => c.data?.isPublished)
            .map(c => ({
              name: c.name,
              publicId: c.data?.publicId,
              isPublished: c.data?.isPublished
            })),
          all_cockpits: (db.cockpits || []).map(c => ({
            name: c.name,
            userId: c.userId,
            publicId: c.data?.publicId,
            isPublished: c.data?.isPublished
          }))
        });
      } catch (error: any) {
        console.error('[DEBUG] Error:', error);
        return res.status(500).json({
          error: 'Erreur lors de la récupération des données',
          message: error.message,
          stack: error.stack
        });
      }
    }

    // =====================
    // PUBLIC COCKPIT ROUTE
    // =====================

    const publicMatch = path.match(/^\/public\/cockpit\/([^/]+)$/);
    if (publicMatch && method === 'GET') {
      const publicId = publicMatch[1];
      console.log('Looking for public cockpit:', publicId);

      const db = await getDb();
      console.log('Database has', db.cockpits.length, 'cockpits');

      // Log all published cockpits
      const publishedCockpits = db.cockpits.filter(c => c.data?.isPublished);
      console.log('Published cockpits:', publishedCockpits.map(c => ({ name: c.name, publicId: c.data?.publicId })));

      const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);

      if (!cockpit) {
        console.log('Cockpit not found for publicId:', publicId);
        return res.status(404).json({ error: 'Maquette non trouvée ou non publiée' });
      }

      console.log('Found cockpit:', cockpit.name);
      
      // Incrémenter le compteur de vues - SAUVEGARDE BLOQUANTE pour garantir la persistance
      const previousViewCount = cockpit.data.viewCount || 0;
      if (!cockpit.data.viewCount) cockpit.data.viewCount = 0;
      cockpit.data.viewCount++;
      cockpit.data.lastViewedAt = new Date().toISOString();
      
      console.log(`[ViewCount] "${cockpit.name}": ${previousViewCount} -> ${cockpit.data.viewCount}`);
      
      // Sauvegarde avec retry et vérification du résultat
      let saveSuccess = false;
      for (let attempt = 1; attempt <= 2 && !saveSuccess; attempt++) {
        try {
          saveSuccess = await saveDb(db);
          if (saveSuccess) {
            console.log(`[ViewCount] ✅ Sauvegarde réussie pour "${cockpit.name}" (tentative ${attempt})`);
          } else {
            console.error(`[ViewCount] ⚠️ Sauvegarde retournée false pour "${cockpit.name}" (tentative ${attempt})`);
          }
        } catch (err) {
          console.error(`[ViewCount] ❌ Exception sauvegarde pour "${cockpit.name}" (tentative ${attempt}):`, err);
        }
      }

      const data = cockpit.data || {};
      
      // =====================================================
      // UTILISER LE SNAPSHOT SI DISPONIBLE (version figee)
      // =====================================================
      // Priorite: PostgreSQL > Redis > Donnees courantes
      if (data.hasSnapshot && data.publicId) {
        let snapshot = null;
        
        // 1. Essayer PostgreSQL d'abord
        if (data.snapshotStorage === 'postgresql' || !data.snapshotStorage) {
          snapshot = await loadSnapshot(data.publicId);
          if (snapshot) {
            console.log(`[Public API] Snapshot charge depuis PostgreSQL v${snapshot.snapshotVersion}`);
          }
        }
        
        // 2. Fallback Redis si pas trouve dans PostgreSQL
        if (!snapshot && (data.snapshotStorage === 'redis' || !data.snapshotStorage)) {
          try {
            const snapshotKey = `snapshot-${data.publicId}`;
            snapshot = await redis.get<any>(snapshotKey);
            if (snapshot) {
              console.log(`[Public API] Snapshot charge depuis Redis v${snapshot.snapshotVersion}`);
            }
          } catch (redisError: any) {
            console.error(`[Public API] Erreur Redis:`, redisError?.message);
          }
        }
        
        if (snapshot) {
          console.log(`[Public API] Snapshot contient ${snapshot.domains?.length || 0} domaines`);
          console.log(`[Public API] Snapshot useOriginalView: ${snapshot.useOriginalView === true ? 'OUI (vue originale)' : 'NON (vue standard)'}`);

          const response = {
            id: cockpit.id,
            name: snapshot.name || cockpit.name,
            createdAt: cockpit.createdAt,
            updatedAt: cockpit.updatedAt,
            domains: snapshot.domains || [],
            zones: snapshot.zones || [],
            logo: snapshot.logo || null,
            scrollingBanner: snapshot.scrollingBanner || null,
            publicId: data.publicId || null,
            isPublished: data.isPublished || false,
            publishedAt: data.publishedAt || null,
            useOriginalView: snapshot.useOriginalView || false,
            welcomeMessage: snapshot.welcomeMessage || data.welcomeMessage || null,
            snapshotVersion: snapshot.snapshotVersion,
            snapshotCreatedAt: snapshot.snapshotCreatedAt,
            snapshotStorage: data.snapshotStorage || 'unknown',
          };

          console.log(`[Public API] Envoi reponse SNAPSHOT avec ${response.domains.length} domaines`);
          return res.json(response);
        }
      }

      // FALLBACK: Si pas de snapshot, utiliser les donnees courantes
      console.log(`[Public API] Pas de snapshot disponible, utilisation des donnees courantes`);

      // Filtrer les domaines et elements non publiables pour l'acces public
      const filteredDomains = (data.domains || []).filter((domain: any) => domain.publiable !== false).map((domain: any) => {
        // Filtrer les categories et leurs elements selon publiable
        const filteredCategories = (domain.categories || []).map((category: any) => {
          const filteredElements = (category.elements || []).filter((el: any) => el.publiable !== false);
          return { ...category, elements: filteredElements };
        });
        return { ...domain, categories: filteredCategories };
      });

      // Log pour diagnostic
      console.log(`[Public API] ðŸ“¦ Cockpit "${cockpit.name}" trouvé`);
      console.log(`[Public API] Domains count (avant filtre): ${(data.domains || []).length}`);
      console.log(`[Public API] Domains count (après filtre): ${filteredDomains.length}`);
      console.log(`[Public API] Full cockpit.data keys:`, Object.keys(data));

      // CRITIQUE : Vérifier que les domaines filtrés ont bien leurs propriétés avant envoi
      const domainsToSend = filteredDomains.map((domain: any) => {
        // Créer un nouveau objet avec TOUTES les propriétés du domaine
        const domainWithAllProps: any = {
          ...domain, // Inclure TOUTES les propriétés existantes
        };

        // Log de chaque domaine
        const hasImage = domain.backgroundImage && typeof domain.backgroundImage === 'string' && domain.backgroundImage.trim().length > 0;
        const hasMapBounds = domain.mapBounds && domain.mapBounds.topLeft && domain.mapBounds.bottomRight;
        const hasMapElements = domain.mapElements && Array.isArray(domain.mapElements) && domain.mapElements.length > 0;

        // Vérifier si l'image est valide (base64)
        const isValidBase64 = hasImage && domain.backgroundImage.startsWith('data:image/');
        const base64Part = hasImage ? domain.backgroundImage.split(',')[1] : null;
        const base64Valid = base64Part && /^[A-Za-z0-9+/]*={0,2}$/.test(base64Part);

        console.log(`[Public API] Domain "${domain.name}": ` +
          `bg=${hasImage ? `âœ…(${domain.backgroundImage.length})` : 'âŒ'}, ` +
          `valid=${isValidBase64 && base64Valid ? 'âœ…' : 'âŒ'}, ` +
          `bounds=${hasMapBounds ? 'âœ…' : 'âŒ'}, ` +
          `points=${hasMapElements ? `âœ…(${domain.mapElements.length})` : 'âŒ'}`);

        if (hasImage) {
          console.log(`[Public API]   Preview: ${domain.backgroundImage.substring(0, 50)}...`);
          console.log(`[Public API]   Starts with data:image/: ${domain.backgroundImage.startsWith('data:image/')}`);
          console.log(`[Public API]   Base64 valid: ${base64Valid ? 'YES' : 'NO'}`);
        }

        return domainWithAllProps;
      });

      // Retourner les données avec TOUS les champs préservés
      const response = {
        id: cockpit.id,
        name: cockpit.name,
        createdAt: cockpit.createdAt,
        updatedAt: cockpit.updatedAt,
        domains: domainsToSend, // Utiliser les domaines avec toutes leurs propriétés
        zones: data.zones || [],
        logo: data.logo || null,
        scrollingBanner: data.scrollingBanner || null,
        publicId: data.publicId || null,
        isPublished: data.isPublished || false,
        publishedAt: data.publishedAt || null,
        welcomeMessage: data.welcomeMessage || null,
        // IMPORTANT: Toujours inclure useOriginalView même dans le fallback
        useOriginalView: data.useOriginalView || false,
      };

      // Log final pour vérifier ce qui est envoyé
      console.log(`[Public API] âœ… Envoi réponse avec ${domainsToSend.length} domaines:`);
      domainsToSend.forEach((domain: any, index: number) => {
        const hasImage = domain.backgroundImage && typeof domain.backgroundImage === 'string' && domain.backgroundImage.trim().length > 0;
        console.log(`[Public API] Send[${index}] "${domain.name}": bg=${hasImage ? `âœ…(${domain.backgroundImage.length})` : 'âŒ'}`);
      });

      return res.json(response);
    }

    // =====================
    // PUBLIC TRACKING (pour les stats)
    // =====================
    const trackingMatch = path.match(/^\/public\/track\/([^/]+)$/);
    if (trackingMatch && method === 'POST') {
      const publicId = trackingMatch[1];
      const { eventType, elementId, subElementId, domainId } = req.body || {};
      
      console.log(`[Tracking] Reçu: publicId=${publicId}, eventType=${eventType}, elementId=${elementId || '-'}, subElementId=${subElementId || '-'}, domainId=${domainId || '-'}`);
      
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);
      
      if (cockpit && cockpit.data) {
        // Stocker les valeurs avant modification pour les logs
        const before = {
          clickCount: cockpit.data.clickCount || 0,
          pagesViewed: cockpit.data.pagesViewed || 0,
          elementsClicked: cockpit.data.elementsClicked || 0,
          subElementsClicked: cockpit.data.subElementsClicked || 0,
        };
        
        // Initialiser les compteurs si nécessaire
        if (!cockpit.data.clickCount) cockpit.data.clickCount = 0;
        if (!cockpit.data.pagesViewed) cockpit.data.pagesViewed = 0;
        if (!cockpit.data.elementsClicked) cockpit.data.elementsClicked = 0;
        if (!cockpit.data.subElementsClicked) cockpit.data.subElementsClicked = 0;
        
        // Incrémenter selon le type d'événement
        switch (eventType) {
          case 'click':
            cockpit.data.clickCount++;
            break;
          case 'page':
            cockpit.data.pagesViewed++;
            break;
          case 'element':
            cockpit.data.elementsClicked++;
            break;
          case 'subElement':
            cockpit.data.subElementsClicked++;
            break;
          default:
            console.log(`[Tracking] Type d'événement inconnu: ${eventType}`);
        }
        
        console.log(`[Tracking] "${cockpit.name}": clicks ${before.clickCount}->${cockpit.data.clickCount}, pages ${before.pagesViewed}->${cockpit.data.pagesViewed}, elements ${before.elementsClicked}->${cockpit.data.elementsClicked}, subElements ${before.subElementsClicked}->${cockpit.data.subElementsClicked}`);
        
        // Sauvegarder avec retry
        let saveSuccess = false;
        for (let attempt = 1; attempt <= 2 && !saveSuccess; attempt++) {
          try {
            saveSuccess = await saveDb(db);
            if (saveSuccess) {
              console.log(`[Tracking] ✅ Sauvegarde réussie pour "${cockpit.name}" (tentative ${attempt})`);
            } else {
              console.error(`[Tracking] ⚠️ Sauvegarde retournée false pour "${cockpit.name}" (tentative ${attempt})`);
              // Attendre un peu avant de réessayer
              if (attempt < 2) await new Promise(r => setTimeout(r, 100));
            }
          } catch (err) {
            console.error(`[Tracking] ❌ Exception sauvegarde pour "${cockpit.name}" (tentative ${attempt}):`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 100));
          }
        }
        
        if (!saveSuccess) {
          console.error(`[Tracking] ❌ Échec définitif de la sauvegarde pour "${cockpit.name}"`);
          // On continue quand même pour ne pas bloquer l'utilisateur
        }
      } else {
        console.log(`[Tracking] ⚠️ Cockpit non trouvé pour publicId=${publicId}`);
        return res.status(404).json({ success: false, error: 'Cockpit non trouvé' });
      }
      
      return res.json({ success: true });
    }

    // =====================
    // PUBLIC USER COCKPITS LIST
    // =====================
    // Route publique pour afficher la liste des cockpits publiés d'un utilisateur
    
    const publicUserCockpitsMatch = path.match(/^\/public\/user\/([^/]+)\/cockpits$/);
    if (publicUserCockpitsMatch && method === 'GET') {
      const userId = publicUserCockpitsMatch[1];
      console.log('[Public User Cockpits] Fetching cockpits for user:', userId);
      
      const db = await getDb();
      
      // Trouver l'utilisateur
      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      // Trouver les cockpits publiés de cet utilisateur
      const publishedCockpits = db.cockpits
        .filter(c => c.userId === userId && c.data?.isPublished === true && c.data?.publicId)
        .map(c => ({
          id: c.id,
          name: c.name,
          publicId: c.data?.publicId,
          publishedAt: c.data?.publishedAt || c.updatedAt,
          domainsCount: (c.data?.domains || []).length,
        }))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      
      console.log(`[Public User Cockpits] Found ${publishedCockpits.length} published cockpits for user ${user.name || user.email}`);
      
      return res.json({
        userName: user.name || user.email || 'Utilisateur',
        cockpits: publishedCockpits,
      });
    }

    // =====================
    // PUBLIC AI ROUTES (utilisent la même API KEY que le studio)
    // =====================

    // Public AI Status
    const publicAiStatusMatch = path.match(/^\/public\/ai\/status\/([^/]+)$/);
    if (publicAiStatusMatch && method === 'GET') {
      const publicId = publicAiStatusMatch[1];

      // Vérifier que le cockpit existe et est publié
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);

      if (!cockpit) {
        return res.status(404).json({ error: 'Cockpit non trouvé ou non publié' });
      }

      // Utiliser la même API KEY que pour le studio
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      return res.json({
        configured: !!OPENAI_API_KEY,
        model: OPENAI_API_KEY ? 'gpt-4o-mini' : 'none'
      });
    }

    // Public AI Chat
    const publicAiChatMatch = path.match(/^\/public\/ai\/chat\/([^/]+)$/);
    if (publicAiChatMatch && method === 'POST') {
      const publicId = publicAiChatMatch[1];

      // Utiliser la même API KEY que pour le studio
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      // Vérifier que le cockpit existe et est publié
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);

      if (!cockpit) {
        return res.status(404).json({ error: 'Cockpit non trouvé ou non publié' });
      }

      const { message, history } = req.body;

      // MODE CAPACITÉ MAXIMALE - Accès COMPLET aux données publiées
      // gpt-4o-mini supporte 128K tokens en entrée, on utilise tout l'espace disponible
      const cockpitData = cockpit.data || {};
      
      // Fonction pour créer un contexte COMPLET du cockpit (toutes les données publiées)
      const createFullContext = () => {
        const domains = cockpitData.domains || [];
        const zones = cockpitData.zones || [];
        
        // Compteurs globaux
        let totalElements = 0;
        let totalSubElements = 0;
        const statusCounts: Record<string, number> = { ok: 0, mineur: 0, critique: 0, fatal: 0, deconnecte: 0, information: 0 };
        const alerts: Array<{element: string, domain: string, description: string, status: string}> = [];
        
        // Données COMPLÈTES par domaine (SANS limite)
        const domainDetails = domains.map((d: any) => {
          const categories = d.categories || [];
          const domainStatusCounts: Record<string, number> = { ok: 0, mineur: 0, critique: 0, fatal: 0, deconnecte: 0, information: 0 };
          
          // Données complètes des catégories et éléments
          const categoryDetails = categories.map((c: any) => {
            const elements = (c.elements || []).map((e: any) => {
              totalElements++;
              const status = e.status || 'ok';
              if (statusCounts[status] !== undefined) statusCounts[status]++;
              if (domainStatusCounts[status] !== undefined) domainStatusCounts[status]++;
              
              // Collecter les alertes de l'élément
              if (e.alert && e.alert.description) {
                alerts.push({
                  element: e.name,
                  domain: d.name,
                  description: e.alert.description,
                  status
                });
              }
              
              // Sous-catégories et sous-éléments COMPLETS
              const subCategories = (e.subCategories || []).map((sc: any) => {
                const subElements = (sc.subElements || []).map((se: any) => {
                  totalSubElements++;
                  const seStatus = se.status || 'ok';
                  if (statusCounts[seStatus] !== undefined) statusCounts[seStatus]++;
                  
                  // Alertes des sous-éléments
                  if (se.alert && se.alert.description) {
                    alerts.push({
                      element: `${e.name} > ${sc.name} > ${se.name}`,
                      domain: d.name,
                      description: se.alert.description,
                      status: seStatus
                    });
                  }
                  
                  return {
                    name: se.name,
                    status: seStatus,
                    value: se.value,
                    unit: se.unit,
                    alert: se.alert?.description,
                    dataSources: (se.dataSources || []).map((ds: any) => ds.name),
                    calculations: (se.calculations || []).map((calc: any) => calc.name)
                  };
                });
                
                return {
                  name: sc.name,
                  orientation: sc.orientation,
                  subElements
                };
              });
              
              return {
                name: e.name,
                status,
                value: e.value,
                unit: e.unit,
                icon: e.icon,
                alert: e.alert?.description,
                subCategories
              };
            });
            
            return {
              name: c.name,
              orientation: c.orientation,
              icon: c.icon,
              elements
            };
          });
          
          // Points de carte COMPLETS
          const mapElements = (d.mapElements || []).map((me: any) => {
            const status = me.status || 'ok';
            if (statusCounts[status] !== undefined) statusCounts[status]++;
            return {
              name: me.name,
              status,
              gps: me.gps,
              icon: me.icon
            };
          });
          
          const problemCount = domainStatusCounts.mineur + domainStatusCounts.critique + domainStatusCounts.fatal + domainStatusCounts.deconnecte;
          
          return {
            name: d.name,
            templateType: d.templateType || 'standard',
            templateName: d.templateName,
            categories: categoryDetails,
            mapElements,
            problemCount,
            statusCounts: domainStatusCounts
          };
        });
        
        return {
          cockpitName: cockpit.name,
          welcomeMessage: cockpitData.welcomeMessage,
          totalDomains: domains.length,
          totalCategories: domains.reduce((acc: number, d: any) => acc + (d.categories || []).length, 0),
          totalElements,
          totalSubElements,
          zones: zones.map((z: any) => ({ name: z.name, id: z.id })),
          globalStatusCounts: statusCounts,
          alerts, // TOUTES les alertes, sans limite
          domains: domainDetails // TOUS les domaines avec TOUTES les données
        };
      };
      
      const cockpitContext = createFullContext();
      
      // Historique étendu à 20 messages pour une meilleure continuité de conversation
      const limitedHistory = (history || []).slice(-20);

      // Système prompt avec TOUTES les données du cockpit publié
      const systemPrompt = `Tu es un assistant IA expert pour SOMONE Cockpit Studio, en mode consultation d'un cockpit publié.

Ce cockpit est en MODE LECTURE SEULE - tu ne peux QUE répondre aux questions, pas modifier le cockpit.

COCKPIT: "${cockpitContext.cockpitName}"
${cockpitContext.welcomeMessage ? `MESSAGE D'ACCUEIL: ${cockpitContext.welcomeMessage}` : ''}

STATISTIQUES GLOBALES:
- ${cockpitContext.totalDomains} domaines, ${cockpitContext.totalCategories} catégories
- ${cockpitContext.totalElements} éléments, ${cockpitContext.totalSubElements} sous-éléments
- Zones: ${cockpitContext.zones.map((z: any) => z.name).join(', ') || 'aucune'}

COMPTAGE DES STATUTS:
- OK (vert): ${cockpitContext.globalStatusCounts.ok}
- Mineur (orange): ${cockpitContext.globalStatusCounts.mineur}
- Critique (rouge): ${cockpitContext.globalStatusCounts.critique}
- Fatal (violet): ${cockpitContext.globalStatusCounts.fatal}
- Déconnecté (gris): ${cockpitContext.globalStatusCounts.deconnecte}
- Information (bleu): ${cockpitContext.globalStatusCounts.information || 0}

=== DONNÉES COMPLÈTES DU COCKPIT ===
${JSON.stringify(cockpitContext.domains, null, 2)}

${cockpitContext.alerts.length > 0 ? `
=== ALERTES ACTIVES (${cockpitContext.alerts.length}) ===
${cockpitContext.alerts.map((a: any) => `- [${a.status.toUpperCase()}] ${a.element} (${a.domain}): ${a.description}`).join('\n')}
` : ''}

STATUTS DISPONIBLES: ok (vert), mineur (orange), critique (rouge), fatal (violet), deconnecte (gris), information (bleu)

INSTRUCTIONS:
1. Réponds en français de manière professionnelle et détaillée
2. Tu es en MODE CONSULTATION - tu ne peux QUE répondre aux questions sur les données
3. Tu as accès à TOUTES les données publiées du cockpit ci-dessus
4. Utilise les données JSON complètes pour répondre précisément aux questions
5. Tu peux analyser les statuts, valeurs, alertes, sous-éléments, sources de données, calculs
6. Sois précis et utilise les noms réels des éléments dans tes réponses
7. Tu peux faire des analyses, des synthèses, des comparaisons entre domaines/éléments`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...limitedHistory.map((h: any) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      try {
        // Utiliser gpt-4o-mini avec capacité maximale (128K tokens entrée, 16K sortie)
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 16384, // CAPACITÉ MAXIMALE pour des réponses complètes
          }),
        });

        if (!openaiResponse.ok) {
          const error = await openaiResponse.json();
          console.error('OpenAI error:', error);
          return res.status(500).json({ error: 'Erreur OpenAI: ' + (error.error?.message || 'inconnue') });
        }

        const data = await openaiResponse.json();
        const assistantMessage = data.choices[0]?.message?.content || '';

        // Nettoyer le message des blocs JSON (il ne devrait pas y en avoir en mode consultation)
        let cleanMessage = assistantMessage
          .replace(/```json\n?[\s\S]*?\n?```/g, '')
          .trim();

        return res.json({ message: cleanMessage });

      } catch (error: any) {
        console.error('AI Chat error:', error);
        return res.status(500).json({ error: 'Erreur serveur IA: ' + error.message });
      }
    }

    // All other routes require authentication
    if (!currentUser) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // =====================
    // COCKPITS ROUTES
    // =====================

    // List cockpits
    // Route: Liste des utilisateurs (pour le partage)
    if (path === '/users' && method === 'GET') {
      if (!currentUser) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const db = await getDb();
      // Retourner tous les utilisateurs (sans le mot de passe) pour le partage
      const users = db.users.map(u => ({
        id: u.id,
        username: u.username,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt
      }));
      return res.json(users);
    }

    if (path === '/cockpits' && method === 'GET') {
      if (!currentUser) {
        console.error('[GET /cockpits] User not authenticated');
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const db = await getDb();

      // Diagnostic logs
      console.log(`[GET /cockpits] User ID: ${currentUser.id}, username: ${currentUser.username}, isAdmin: ${currentUser.isAdmin}`);
      console.log(`[GET /cockpits] Total cockpits in DB: ${db.cockpits.length}`);
      if (db.cockpits.length > 0) {
        console.log(`[GET /cockpits] Cockpit userIds:`, db.cockpits.map(c => ({ id: c.id, name: c.name, userId: c.userId })));
      }

      let cockpits = currentUser.isAdmin
        ? db.cockpits
        : db.cockpits.filter(c => {
          // Inclure les cockpits créés par l'utilisateur ET ceux partagés avec lui
          const isOwner = c.userId === currentUser.id;
          const isShared = c.data?.sharedWith && Array.isArray(c.data.sharedWith) && c.data.sharedWith.includes(currentUser.id);
          const matches = isOwner || isShared;
          if (!matches) {
            console.log(`[GET /cockpits] Cockpit "${c.name}" (${c.id}) filtered out - userId: ${c.userId} !== current: ${currentUser.id} and not shared`);
          }
          return matches;
        });

      console.log(`[GET /cockpits] Filtered cockpits: ${cockpits.length} (${currentUser.isAdmin ? 'admin mode' : 'user mode'})`);

      const result = cockpits.map(c => ({
        id: c.id,
        name: c.name,
        userId: c.userId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        domains: [],
        publicId: c.data?.publicId,
        isPublished: c.data?.isPublished || false,
        publishedAt: c.data?.publishedAt,
        order: c.data?.order, // Ordre pour le drag & drop
        sharedWith: c.data?.sharedWith || [], // Partage
        folderId: c.data?.folderId || null, // Répertoire parent
        welcomeMessage: c.data?.welcomeMessage || null, // Message d'accueil
      }));

      console.log(`[GET /cockpits] Returning ${result.length} cockpits`);

      return res.json(result);
    }

    // Get single cockpit
    const cockpitIdMatch = path.match(/^\/cockpits\/([^/]+)$/);
    if (cockpitIdMatch && method === 'GET') {
      const id = cockpitIdMatch[1];
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const data = cockpit.data || { domains: [], zones: [] };

      // Log pour vérifier les images dans les domaines
      console.log(`[GET /cockpits/:id] Cockpit "${cockpit.name}" - Domaines avec images:`);
      (data.domains || []).forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && d.backgroundImage.length > 0;
        console.log(`[GET] Domain[${idx}] "${d.name}": backgroundImage=${hasBg ? `PRESENTE (${d.backgroundImage.length} chars)` : 'ABSENTE'}`);
        if (hasBg) {
          console.log(`[GET]   Preview: ${d.backgroundImage.substring(0, 50)}...`);
        }
      });

      return res.json({
        id: cockpit.id,
        name: cockpit.name,
        userId: cockpit.userId,
        createdAt: cockpit.createdAt,
        updatedAt: cockpit.updatedAt,
        ...data,
      });
    }

    // =====================================================
    // ROUTES RÉPERTOIRES (FOLDERS)
    // =====================================================

    // Get all folders for current user
    if (path === '/folders' && method === 'GET') {
      const db = await getDb();
      if (!db.folders) db.folders = [];
      
      let folders;
      if (currentUser.isAdmin) {
        // Admin: tous les répertoires
        folders = db.folders;
      } else {
        // Utilisateur normal: ses répertoires + répertoires contenant des maquettes partagées avec lui
        const sharedCockpits = db.cockpits.filter(c => 
          c.data?.sharedWith && 
          Array.isArray(c.data.sharedWith) && 
          c.data.sharedWith.includes(currentUser.id)
        );
        const sharedFolderIds = [...new Set(sharedCockpits
          .filter(c => c.data?.folderId)
          .map(c => c.data.folderId)
        )];
        
        folders = db.folders.filter(f => 
          f.userId === currentUser.id || sharedFolderIds.includes(f.id)
        );
      }
      
      return res.json(folders.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }

    // Create folder
    if (path === '/folders' && method === 'POST') {
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nom du répertoire requis' });
      }
      
      const db = await getDb();
      if (!db.folders) db.folders = [];
      
      const id = generateId();
      const now = new Date().toISOString();
      
      const newFolder: Folder = {
        id,
        name: name.trim(),
        userId: currentUser.id,
        order: db.folders.filter(f => f.userId === currentUser.id).length,
        createdAt: now,
        updatedAt: now
      };
      
      db.folders.push(newFolder);
      await saveDb(db);
      
      return res.json(newFolder);
    }

    // Update folder
    const folderIdMatch = path.match(/^\/folders\/([^/]+)$/);
    if (folderIdMatch && method === 'PUT') {
      const id = folderIdMatch[1];
      const { name, order } = req.body;
      
      const db = await getDb();
      if (!db.folders) db.folders = [];
      
      const folder = db.folders.find(f => f.id === id);
      
      if (!folder) {
        return res.status(404).json({ error: 'Répertoire non trouvé' });
      }
      
      if (!currentUser.isAdmin && folder.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      
      if (name !== undefined) folder.name = name.trim();
      if (order !== undefined) folder.order = order;
      folder.updatedAt = new Date().toISOString();
      
      await saveDb(db);
      
      return res.json(folder);
    }

    // Delete folder (only if empty)
    if (folderIdMatch && method === 'DELETE') {
      const id = folderIdMatch[1];
      
      const db = await getDb();
      if (!db.folders) db.folders = [];
      
      const folderIndex = db.folders.findIndex(f => f.id === id);
      
      if (folderIndex === -1) {
        return res.status(404).json({ error: 'Répertoire non trouvé' });
      }
      
      const folder = db.folders[folderIndex];
      
      if (!currentUser.isAdmin && folder.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      
      // Vérifier que le répertoire est vide
      const cockpitsInFolder = db.cockpits.filter(c => c.data?.folderId === id);
      if (cockpitsInFolder.length > 0) {
        return res.status(400).json({ 
          error: 'Le répertoire n\'est pas vide',
          cockpitsCount: cockpitsInFolder.length
        });
      }
      
      db.folders.splice(folderIndex, 1);
      await saveDb(db);
      
      return res.json({ success: true });
    }

    // Reorder folders
    if (path === '/folders/reorder' && method === 'POST') {
      const { folderIds } = req.body;
      
      if (!Array.isArray(folderIds)) {
        return res.status(400).json({ error: 'folderIds doit être un tableau' });
      }
      
      const db = await getDb();
      if (!db.folders) db.folders = [];
      
      // Mettre à jour l'ordre des répertoires de l'utilisateur
      folderIds.forEach((id, index) => {
        const folder = db.folders!.find(f => f.id === id && f.userId === currentUser.id);
        if (folder) {
          folder.order = index;
          folder.updatedAt = new Date().toISOString();
        }
      });
      
      await saveDb(db);
      
      return res.json({ success: true });
    }

    // Move cockpit to folder (or to root if folderId is null)
    if (path === '/cockpits/move' && method === 'POST') {
      const { cockpitId, folderId } = req.body;
      
      if (!cockpitId) {
        return res.status(400).json({ error: 'cockpitId requis' });
      }
      
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === cockpitId);
      
      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }
      
      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      
      // Vérifier que le dossier existe (si spécifié)
      if (folderId) {
        if (!db.folders) db.folders = [];
        const folder = db.folders.find(f => f.id === folderId);
        if (!folder) {
          return res.status(404).json({ error: 'Répertoire non trouvé' });
        }
        // Vérifier que le dossier appartient à l'utilisateur
        if (!currentUser.isAdmin && folder.userId !== currentUser.id) {
          return res.status(403).json({ error: 'Accès non autorisé au répertoire' });
        }
      }
      
      // Mettre à jour le folderId du cockpit
      if (!cockpit.data) cockpit.data = {};
      cockpit.data.folderId = folderId || null;
      cockpit.updatedAt = new Date().toISOString();
      
      await saveDb(db);
      
      return res.json({ success: true, folderId: folderId || null });
    }

    // =====================================================
    // FIN ROUTES RÉPERTOIRES
    // =====================================================

    // Create cockpit
    if (path === '/cockpits' && method === 'POST') {
      // IMPORT COMPLET - Accepter TOUTES les propriétés envoyées
      const { name, domains, zones, ...otherData } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Nom requis' });
      }

      const db = await getDb();
      const id = generateId();
      const now = new Date().toISOString();

      // Fonction récursive pour régénérer tous les IDs
      const regenerateIds = (obj: any, idMap: Map<string, string> = new Map()): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => regenerateIds(item, idMap));
        }
        if (obj && typeof obj === 'object') {
          const newObj: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (key === 'id' && typeof value === 'string') {
              // Conserver le mapping pour les références
              const oldId = value as string;
              if (!idMap.has(oldId)) {
                idMap.set(oldId, generateId());
              }
              newObj[key] = idMap.get(oldId);
            } else if (key === 'cockpitId' || key === 'domainId' || key === 'categoryId' || key === 'elementId' || key === 'subCategoryId' || key === 'subElementId' || key === 'userId' || key === 'subElementId') {
              // Remplacer les IDs de référence si on a le mapping
              const oldId = value as string;
              if (oldId && idMap.has(oldId)) {
                newObj[key] = idMap.get(oldId);
              } else if (oldId && typeof oldId === 'string') {
                // Si l'ID n'est pas dans le mapping, générer un nouvel ID (cas des références orphelines)
                const newId = generateId();
                idMap.set(oldId, newId);
                newObj[key] = newId;
              } else {
                newObj[key] = value;
              }
            } else {
              newObj[key] = regenerateIds(value, idMap);
            }
          }
          return newObj;
        }
        return obj;
      };

      // Régénérer les IDs pour éviter les conflits
      const newDomains = domains && Array.isArray(domains) ? regenerateIds(domains) : [];
      const newZones = zones && Array.isArray(zones) ? regenerateIds(zones) : [];

      // Log pour debug
      const otherKeys = Object.keys(otherData);
      console.log(`[POST /cockpits] Création avec ${otherKeys.length} propriétés supplémentaires: ${otherKeys.join(', ')}`);

      // Construire data avec TOUTES les propriétés envoyées
      const cockpitData = {
        domains: newDomains.map((d: any) => ({ ...d, cockpitId: id })),
        zones: newZones.map((z: any) => ({ ...z, cockpitId: id })),
        ...otherData, // TOUTES les autres propriétés (logo, scrollingBanner, templateIcons, originals, etc.)
      };

      // Supprimer les propriétés qui ne doivent pas être dans data (elles sont au niveau cockpit)
      delete cockpitData.id;
      delete cockpitData.userId;
      delete cockpitData.createdAt;
      delete cockpitData.updatedAt;

      const newCockpit: CockpitData = {
        id,
        name,
        userId: currentUser.id,
        data: cockpitData,
        createdAt: now,
        updatedAt: now
      };

      db.cockpits.push(newCockpit);
      await saveDb(db);

      // Retourner TOUTES les données comme le fait GET /cockpits/:id
      return res.json({
        id,
        name,
        userId: currentUser.id,
        createdAt: now,
        updatedAt: now,
        ...cockpitData, // TOUTES les données
      });
    }

    // Update cockpit
    if (cockpitIdMatch && method === 'PUT') {
      const id = cockpitIdMatch[1];
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      // Vérifier les permissions : seul le propriétaire ou un admin peut modifier
      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const { name, domains, zones, logo, scrollingBanner, sharedWith, useOriginalView, templateIcons, clientUpdatedAt } = req.body;
      const now = new Date().toISOString();

      // Vérification de la taille totale du payload
      const payloadSize = JSON.stringify(req.body).length;
      const payloadSizeMB = payloadSize / 1024 / 1024;
      log.debug(`[PUT] Taille du payload reçu: ${payloadSizeMB.toFixed(2)} MB`);
      
      if (payloadSizeMB > MAX_PAYLOAD_SIZE_MB) {
        log.error(`[PUT] ❌ Payload trop volumineux: ${payloadSizeMB.toFixed(2)} MB (limite: ${MAX_PAYLOAD_SIZE_MB} MB)`);
        return res.status(413).json({ 
          error: `Le cockpit est trop volumineux (${payloadSizeMB.toFixed(2)} MB). Limite: ${MAX_PAYLOAD_SIZE_MB} MB. Réduisez la taille des images.`,
          payloadSize: payloadSizeMB,
          maxSize: MAX_PAYLOAD_SIZE_MB
        });
      }

      // Vérification de conflit (optimistic locking)
      if (clientUpdatedAt && hasConflict(cockpit.updatedAt, clientUpdatedAt)) {
        log.warn(`[PUT] Conflit détecté pour cockpit ${id}: server=${cockpit.updatedAt}, client=${clientUpdatedAt}`);
        return res.status(409).json({ 
          error: 'Conflit: la maquette a été modifiée par un autre utilisateur. Veuillez rafraîchir.',
          serverUpdatedAt: cockpit.updatedAt,
          clientUpdatedAt
        });
      }

      // Validation des images dans les domaines
      if (domains && Array.isArray(domains)) {
        for (const domain of domains) {
          if (domain.backgroundImage) {
            const validation = validateImage(domain.backgroundImage);
            if (!validation.valid) {
              return res.status(400).json({ 
                error: `Image invalide pour le domaine "${domain.name}": ${validation.error}` 
              });
            }
            log.debug(`[PUT] Image validée pour "${domain.name}": ${validation.format}, ${((validation.sizeBytes || 0) / 1024).toFixed(0)} KB`);
          }
        }
      }

      // Validation du logo
      if (logo) {
        const logoValidation = validateImage(logo);
        if (!logoValidation.valid) {
          return res.status(400).json({ error: `Logo invalide: ${logoValidation.error}` });
        }
      }

      cockpit.name = name || cockpit.name;

      // Faire un merge au lieu de remplacer complètement
      // Préserver toutes les données existantes si elles ne sont pas dans la requête
      if (!cockpit.data) {
        cockpit.data = { domains: [], zones: [] };
      }

      // MERGE PROFOND : Préserver TOUTES les propriétés importantes des domaines existants
      let mergedDomains = cockpit.data.domains || [];
      if (domains !== undefined && Array.isArray(domains)) {
        // Pour chaque domaine dans la requête, faire un merge intelligent
        mergedDomains = domains.map((newDomain: any) => {
          const existingDomain = cockpit.data.domains?.find((d: any) => d.id === newDomain.id);

          if (existingDomain) {
            // MERGE INTELLIGENT : Préserver les propriétés importantes même si absentes de la requête
            const merged: any = {
              ...existingDomain,  // D'abord TOUTES les propriétés existantes
              ...newDomain,       // Puis appliquer les nouvelles valeurs
            };

            // TOUJOURS PRÉSERVER backgroundImage si elle existe dans l'existant
            // Sauf si newDomain en fournit explicitement une nouvelle (non vide)
            if (existingDomain.backgroundImage &&
              typeof existingDomain.backgroundImage === 'string' &&
              existingDomain.backgroundImage.trim().length > 0) {
              // Si newDomain n'a pas de backgroundImage valide, garder l'existant
              if (!newDomain.backgroundImage ||
                typeof newDomain.backgroundImage !== 'string' ||
                newDomain.backgroundImage.trim().length === 0 ||
                newDomain.backgroundImage === '') {
                merged.backgroundImage = existingDomain.backgroundImage;
                log.debug(`[PUT] Préservé backgroundImage pour "${newDomain.name}"`);
              } else {
                // newDomain a une nouvelle image, l'utiliser
                log.debug(`[PUT] Nouveau backgroundImage pour "${newDomain.name}"`);
              }
            }

            // TOUJOURS PRÉSERVER mapBounds si elle existe dans l'existant
            if (existingDomain.mapBounds &&
              existingDomain.mapBounds.topLeft &&
              existingDomain.mapBounds.bottomRight) {
              // Si newDomain n'a pas de mapBounds valide, garder l'existant
              if (!newDomain.mapBounds ||
                !newDomain.mapBounds.topLeft ||
                !newDomain.mapBounds.bottomRight) {
                merged.mapBounds = existingDomain.mapBounds;
                log.debug(`[PUT] Préservé mapBounds pour "${newDomain.name}"`);
              }
            }

            // Préserver aussi mapElements si présents
            if (existingDomain.mapElements && Array.isArray(existingDomain.mapElements)) {
              if (!newDomain.mapElements || !Array.isArray(newDomain.mapElements) || newDomain.mapElements.length === 0) {
                merged.mapElements = existingDomain.mapElements;
              }
            }

            return merged;
          } else {
            // Nouveau domaine - utiliser tel quel
            return newDomain;
          }
        });

        // IMPORTANT : Si domains est fourni dans la requête, c'est une mise à jour complète
        // Les domaines supprimés côté client ne doivent PAS être réajoutés
        // On utilise directement mergedDomains (qui contient uniquement les domaines de la requête)
        // sans réajouter les domaines existants qui ne sont pas dans la requête
        // Cela permet la suppression correcte des domaines
      } else {
        // Si domains n'est pas fourni dans la requête, garder les domaines existants intacts
        mergedDomains = cockpit.data.domains || [];
      }

      // Log uniquement en développement
      log.debug(`[PUT] Sauvegarde de ${mergedDomains.length} domaines`);
      /* Logs verbeux supprimés
      mergedDomains.forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
        const hasMapBounds = d.mapBounds && d.mapBounds.topLeft && d.mapBounds.bottomRight;
        const hasMapElements = d.mapElements && Array.isArray(d.mapElements) && d.mapElements.length > 0;
        console.log(`[PUT] Final[${idx}] "${d.name}": ` +
          `bg=${hasBg ? `âœ…(${d.backgroundImage.length})` : 'âŒ'}, ` +
          `bounds=${hasMapBounds ? 'âœ…' : 'âŒ'}, ` +
          `points=${hasMapElements ? `âœ…(${d.mapElements.length})` : 'âŒ'}`);
      }); */

      cockpit.data = {
        domains: mergedDomains,
        zones: zones !== undefined ? zones : cockpit.data.zones || [],
        logo: logo !== undefined ? logo : cockpit.data.logo,
        scrollingBanner: scrollingBanner !== undefined ? scrollingBanner : cockpit.data.scrollingBanner,
        // Préserver les infos de publication
        publicId: cockpit.data.publicId,
        isPublished: cockpit.data.isPublished,
        publishedAt: cockpit.data.publishedAt,
        // Partage
        sharedWith: sharedWith !== undefined ? sharedWith : cockpit.data.sharedWith || [],
        // Vue originale
        useOriginalView: useOriginalView !== undefined ? useOriginalView : cockpit.data.useOriginalView || false,
        // Icônes des templates
        templateIcons: templateIcons !== undefined ? templateIcons : cockpit.data.templateIcons || {},
        // IMPORTANT: Toujours préserver les originaux sauvegardés
        originals: cockpit.data.originals,
        // IMPORTANT: Préserver le dossier parent
        folderId: cockpit.data.folderId,
      };
      cockpit.updatedAt = now;

      await saveDb(db);

      // Vérification de sauvegarde (logs uniquement en dev)
      log.debug(`[PUT] Cockpit ${id} sauvegardé`);
      /* const savedCockpit = db.cockpits.find(c => c.id === cockpit.id);
      if (savedCockpit && savedCockpit.data) {
        console.log(`[PUT /cockpits/:id] âœ… Après sauvegarde - Domaines avec images:`);
        (savedCockpit.data.domains || []).forEach((d: any, idx: number) => {
          const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
          const isValid = hasBg && d.backgroundImage.startsWith('data:image/');
          const sizeMB = hasBg ? (d.backgroundImage.length / 1024 / 1024).toFixed(2) : '0';
          console.log(`[PUT] Saved[${idx}] "${d.name}": backgroundImage=${hasBg ? `PRESENTE (${d.backgroundImage.length} chars, ${sizeMB} MB, valid: ${isValid})` : 'ABSENTE'}`);

          // Vérifier si l'image est valide
          if (hasBg && !isValid) {
            console.warn(`[PUT] âš ï¸ Image invalide pour "${d.name}" - ne commence pas par data:image/`);
          }
          if (hasBg && d.backgroundImage.length < 100) {
            console.warn(`[PUT] âš ï¸ Image suspecte pour "${d.name}" - trop courte (${d.backgroundImage.length} chars)`);
          }
        });
      } */

      return res.json({ success: true });
    }

    // Delete cockpit
    if (cockpitIdMatch && method === 'DELETE') {
      const id = cockpitIdMatch[1];
      const db = await getDb();
      const cockpitIndex = db.cockpits.findIndex(c => c.id === id);

      if (cockpitIndex === -1) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      const cockpit = db.cockpits[cockpitIndex];

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      db.cockpits.splice(cockpitIndex, 1);
      await saveDb(db);

      return res.json({ success: true });
    }

    // Duplicate cockpit
    const duplicateMatch = path.match(/^\/cockpits\/([^/]+)\/duplicate$/);
    if (duplicateMatch && method === 'POST') {
      try {
        const id = duplicateMatch[1];
        
        console.log(`[Duplicate] === DÉBUT DUPLICATION ===`);
        console.log(`[Duplicate] req.body type:`, typeof req.body);
        console.log(`[Duplicate] req.body:`, JSON.stringify(req.body)?.substring(0, 200));
        
        const body = req.body || {};
        const name = body.name;
        
        console.log(`[Duplicate] ID source: ${id}, Nouveau nom: ${name}`);

        const db = await getDb();
        console.log(`[Duplicate] DB chargée, ${db.cockpits?.length || 0} cockpits existants`);
        
        const original = db.cockpits.find(c => c.id === id);

        if (!original) {
          console.error(`[Duplicate] ERREUR: Cockpit source ${id} non trouvé`);
          return res.status(404).json({ error: 'Maquette non trouvée' });
        }
        
        const originalSize = JSON.stringify(original).length;
        const originalSizeKB = Math.round(originalSize/1024);
        const originalSizeMB = (originalSize/1024/1024).toFixed(2);
        console.log(`[Duplicate] 📦 Original: "${original.name}" - ${originalSizeKB}KB (${originalSizeMB}MB)`);
        console.log(`[Duplicate]   📊 ${(original.data?.domains || []).length} domaines, ${(original.data?.zones || []).length} zones`);
        
        // Détail des données volumineuses (informatif)
        let totalImageSize = 0;
        (original.data?.domains || []).forEach((d: any) => {
          if (d.backgroundImage && d.backgroundImage.length > 10000) {
            const imgSizeKB = Math.round(d.backgroundImage.length/1024);
            console.log(`[Duplicate]   🖼️ Image "${d.name}": ${imgSizeKB}KB`);
            totalImageSize += d.backgroundImage.length;
          }
        });
        if (totalImageSize > 0) {
          console.log(`[Duplicate]   📷 Total images: ${Math.round(totalImageSize/1024)}KB (${(totalImageSize/1024/1024).toFixed(2)}MB)`);
        }

        if (!canAccessCockpit(original, currentUser)) {
          return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const newId = generateId();
        const now = new Date().toISOString();
        
        console.log(`[Duplicate] Nouvel ID généré: ${newId}`);

        // Copier TOUTES les données de la maquette source (copie profonde)
        let copiedData: any;
        try {
          copiedData = JSON.parse(JSON.stringify(original.data || {}));
          console.log(`[Duplicate] JSON.parse réussi`);
        } catch (jsonErr: any) {
          console.error(`[Duplicate] ERREUR JSON.parse:`, jsonErr?.message || jsonErr);
          return res.status(500).json({ error: `Erreur copie données: ${jsonErr?.message}` });
        }
        
        console.log(`[Duplicate] Données copiées:`);
        console.log(`[Duplicate]   - domains: ${(copiedData.domains || []).length}`);
        console.log(`[Duplicate]   - zones: ${(copiedData.zones || []).length}`);
        console.log(`[Duplicate]   - folderId: ${copiedData.folderId || 'null'}`);
        console.log(`[Duplicate]   - logo: ${copiedData.logo ? 'présent' : 'absent'}`);
        console.log(`[Duplicate]   - templateIcons: ${Object.keys(copiedData.templateIcons || {}).length} icônes`);

        const newCockpit: CockpitData = {
          id: newId,
          name: name || `${original.name} - Copie`,
          userId: currentUser.id,
          data: copiedData,
          createdAt: now,
          updatedAt: now
        };

        // Réinitialiser le statut de publication (la copie n'est pas publiée)
        if (newCockpit.data) {
          delete newCockpit.data.publicId;
          delete newCockpit.data.isPublished;
          delete newCockpit.data.publishedAt;
        }

        // Ajouter le nouveau cockpit à la base
        db.cockpits.push(newCockpit);
        console.log(`[Duplicate] Cockpit ajouté à la DB, total: ${db.cockpits.length}`);
        
        // Sauvegarder et vérifier le succès
        const newDbSize = JSON.stringify(db).length;
        console.log(`[Duplicate] 💾 Sauvegarde en cours... (nouvelle taille DB: ${Math.round(newDbSize/1024)}KB)`);
        
        const saveSuccess = await saveDb(db);
        if (!saveSuccess) {
          console.error(`[Duplicate] ❌ Échec de la sauvegarde`);
          return res.status(500).json({ 
            error: `Erreur lors de la sauvegarde. La maquette "${original.name}" fait ${originalSizeKB}KB, la base totale ferait ${Math.round(newDbSize/1024)}KB. Vérifiez les limites Redis.`
          });
        }
        
        console.log(`[Duplicate] ✅ Sauvegarde réussie!`);
        
        // Vérifier que le cockpit existe bien après sauvegarde
        const verifyDb = await getDb();
        const verifyExists = verifyDb.cockpits.find(c => c.id === newId);
        console.log(`[Duplicate] Vérification post-save: cockpit ${newId} existe = ${!!verifyExists}`);
        
        if (!verifyExists) {
          console.error(`[Duplicate] ERREUR CRITIQUE: Le cockpit n'existe pas après sauvegarde!`);
          return res.status(500).json({ error: 'Erreur critique: cockpit non persisté' });
        }
        
        console.log(`[Duplicate] === DUPLICATION RÉUSSIE: ${newCockpit.name} (${newId}) ===`);

        // Retourner TOUTES les données comme le fait GET /cockpits/:id
        return res.json({
          id: newId,
          name: newCockpit.name,
          userId: currentUser.id,
          createdAt: now,
          updatedAt: now,
          ...newCockpit.data, // Inclure TOUTES les données copiées
        });
      } catch (err: any) {
        console.error(`[Duplicate] EXCEPTION NON GÉRÉE:`, err?.message || err);
        console.error(`[Duplicate] Stack:`, err?.stack);
        return res.status(500).json({ error: `Erreur duplication: ${err?.message || 'Erreur inconnue'}` });
      }
    }

    // Reorder cockpits
    if (path === '/cockpits/reorder' && method === 'POST') {
      const { cockpitIds } = req.body;

      if (!Array.isArray(cockpitIds)) {
        return res.status(400).json({ error: 'cockpitIds doit être un tableau' });
      }

      const db = await getDb();

      // Mettre à jour l'ordre de chaque cockpit
      // NOTE: On ne met PAS à jour updatedAt car changer l'ordre n'est pas une modification du contenu
      cockpitIds.forEach((cockpitId: string, index: number) => {
        const cockpit = db.cockpits.find(c => c.id === cockpitId);
        if (cockpit) {
          // Vérifier les permissions
          if (!canAccessCockpit(cockpit, currentUser)) {
            return; // Ignorer les cockpits non autorisés
          }

          if (!cockpit.data) {
            cockpit.data = {};
          }
          cockpit.data.order = index;
          // Ne pas toucher à updatedAt - l'ordre n'est pas une modification du contenu
        }
      });

      await saveDb(db);
      return res.json({ success: true });
    }

    // Publish cockpit
    const publishMatch = path.match(/^\/cockpits\/([^/]+)\/publish$/);
    if (publishMatch && method === 'POST') {
      const id = publishMatch[1];
      const { welcomeMessage } = req.body || {};
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      if (!cockpit.data) {
        cockpit.data = { domains: [], zones: [] };
      }

      // Log AVANT publication pour vérifier les données
      console.log(`[PUBLISH] 🚀 Publication du cockpit "${cockpit.name}" (${id})`);
      console.log(`[PUBLISH] useOriginalView: ${cockpit.data.useOriginalView === true ? 'OUI (vue originale)' : 'NON (vue standard)'}`);
      console.log(`[PUBLISH] Domaines avant publication: ${(cockpit.data.domains || []).length}`);
      (cockpit.data.domains || []).forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
        const hasMapBounds = d.mapBounds && d.mapBounds.topLeft && d.mapBounds.bottomRight;
        console.log(`[PUBLISH] Domain[${idx}] "${d.name}": ` +
          `bg=${hasBg ? `âœ…(${d.backgroundImage.length})` : 'âŒ'}, ` +
          `bounds=${hasMapBounds ? 'âœ…' : 'âŒ'}`);
      });

      if (!cockpit.data.publicId) {
        cockpit.data.publicId = generateId().replace(/-/g, '').substring(0, 12);
      }

      const publishedAt = new Date().toISOString();

      // Marquer comme publie et sauvegarder le message d'accueil
      cockpit.data.isPublished = true;
      cockpit.data.publishedAt = publishedAt;
      cockpit.data.welcomeMessage = welcomeMessage || null;

      // CREATION DU SNAPSHOT - Copie figee pour acces public
      // Le snapshot est stocke dans PostgreSQL (Neon) pour eviter les limites Redis
      const dataSize = JSON.stringify(cockpit.data).length;
      const snapshotVersion = (cockpit.data.snapshotVersion || 0) + 1;

      // IMPORTANT: Capturer useOriginalView EXPLICITEMENT depuis cockpit.data
      const useOriginalViewValue = cockpit.data.useOriginalView === true;
      console.log(`[PUBLISH] Snapshot useOriginalView sera: ${useOriginalViewValue}`);
      
      const publishedSnapshot = {
        logo: cockpit.data.logo || null,
        scrollingBanner: cockpit.data.scrollingBanner || null,
        useOriginalView: useOriginalViewValue, // Utiliser la valeur capturée explicitement
        welcomeMessage: welcomeMessage || null,
        domains: JSON.parse(JSON.stringify(
          (cockpit.data.domains || [])
            .filter((domain: any) => domain.publiable !== false)
            .map((domain: any) => ({
              ...domain,
              categories: (domain.categories || []).map((category: any) => ({
                ...category,
                elements: (category.elements || []).filter((el: any) => el.publiable !== false)
              }))
            }))
        )),
        zones: JSON.parse(JSON.stringify(cockpit.data.zones || [])),
      };

      // Stocker le snapshot dans PostgreSQL (Neon)
      const pgSuccess = await saveSnapshot(
        cockpit.id,
        cockpit.data.publicId,
        cockpit.name,
        publishedSnapshot,
        snapshotVersion
      );
      
      if (pgSuccess) {
        console.log(`[PUBLISH] SNAPSHOT v${snapshotVersion} sauvegarde dans PostgreSQL (${Math.round(dataSize/1024)}KB)`);
        cockpit.data.snapshotVersion = snapshotVersion;
        cockpit.data.hasSnapshot = true;
        cockpit.data.snapshotStorage = 'postgresql';
      } else {
        console.error(`[PUBLISH] Erreur sauvegarde snapshot PostgreSQL, fallback Redis`);
        // Fallback: essayer Redis si PostgreSQL echoue
        try {
          const snapshotKey = `snapshot-${cockpit.data.publicId}`;
          await redis.set(snapshotKey, { ...publishedSnapshot, snapshotVersion, snapshotCreatedAt: publishedAt });
          cockpit.data.snapshotVersion = snapshotVersion;
          cockpit.data.hasSnapshot = true;
          cockpit.data.snapshotStorage = 'redis';
          console.log(`[PUBLISH] Fallback Redis OK`);
        } catch (redisError: any) {
          console.error(`[PUBLISH] Fallback Redis echoue:`, redisError?.message);
          cockpit.data.hasSnapshot = false;
        }
      }

      // Ne PAS stocker le snapshot dans la base principale Redis
      delete cockpit.data.publishedSnapshot;

      // Sauvegarder
      console.log(`[PUBLISH] Sauvegarde en cours pour ${cockpit.name}...`);
      const saveSuccess = await saveDb(db);
      if (!saveSuccess) {
        console.error(`[PUBLISH] ERREUR sauvegarde Redis!`);
        return res.status(500).json({ error: 'Erreur lors de la sauvegarde Redis' });
      }
      console.log(`[PUBLISH] Sauvegarde Redis OK`);

      // Relire depuis Redis pour verifier la persistance
      const verifyDb = await getDb();
      const savedCockpit = verifyDb.cockpits.find((c: any) => c.id === id);
      
      // Verifier que la publication est bien persistee
      if (!savedCockpit?.data?.isPublished) {
        console.error(`[PUBLISH] ERREUR: Cockpit non persiste! isPublished=${savedCockpit?.data?.isPublished}`);
        return res.status(500).json({ error: 'Publication non persistee' });
      }
      
      if (savedCockpit && savedCockpit.data) {
        console.log(`[PUBLISH] âœ… Après sauvegarde - Cockpit publié avec ${(savedCockpit.data.domains || []).length} domaines`);
        (savedCockpit.data.domains || []).forEach((d: any, idx: number) => {
          const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
          console.log(`[PUBLISH] Published[${idx}] "${d.name}": bg=${hasBg ? `âœ…(${d.backgroundImage.length})` : 'âŒ'}`);
        });
      }

      return res.json({
        success: true,
        publicId: cockpit.data.publicId,
        publishedAt: cockpit.data.publishedAt,
        hasSnapshot: cockpit.data.hasSnapshot || false,
        snapshotVersion: cockpit.data.snapshotVersion || null
      });
    }

    // Unpublish cockpit
    const unpublishMatch = path.match(/^\/cockpits\/([^/]+)\/unpublish$/);
    if (unpublishMatch && method === 'POST') {
      const id = unpublishMatch[1];
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      if (cockpit.data) {
        cockpit.data.isPublished = false;
      }

      await saveDb(db);

      return res.json({ success: true });
    }

    // Update welcome message
    const welcomeMessageMatch = path.match(/^\/cockpits\/([^/]+)\/welcome-message$/);
    if (welcomeMessageMatch && method === 'PUT') {
      const id = welcomeMessageMatch[1];
      const { welcomeMessage } = req.body;
      console.log(`[Welcome Message] Mise à jour pour cockpit ${id}: "${welcomeMessage?.substring(0, 50) || 'null'}..."`);
      
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        console.log(`[Welcome Message] Cockpit ${id} non trouvé`);
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        console.log(`[Welcome Message] Accès non autorisé pour ${currentUser.email}`);
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Initialiser cockpit.data si nécessaire
      if (!cockpit.data) {
        cockpit.data = { domains: [], zones: [] };
      }
      
      cockpit.data.welcomeMessage = welcomeMessage || null;
      console.log(`[Welcome Message] Message mis à jour dans cockpit.data`);
      
      // Si publié, mettre à jour le snapshot aussi
      if (cockpit.data.isPublished && cockpit.data.publicId) {
        const snapshotVersion = (cockpit.data.snapshotVersion || 0) + 1;
        console.log(`[Welcome Message] Cockpit publié, mise à jour du snapshot v${snapshotVersion}`);
        
        // Récupérer le snapshot existant
        const existingSnapshot = await loadSnapshot(cockpit.data.publicId);
        if (existingSnapshot) {
          existingSnapshot.welcomeMessage = welcomeMessage || null;
          const saved = await saveSnapshot(
            cockpit.id,
            cockpit.data.publicId,
            cockpit.name,
            existingSnapshot,
            snapshotVersion
          );
          if (saved) {
            cockpit.data.snapshotVersion = snapshotVersion;
            console.log(`[Welcome Message] Snapshot mis à jour avec succès`);
          } else {
            console.error(`[Welcome Message] Erreur sauvegarde snapshot`);
          }
        } else {
          console.log(`[Welcome Message] Pas de snapshot existant trouvé`);
        }
      }

      const saveSuccess = await saveDb(db);
      console.log(`[Welcome Message] Sauvegarde DB: ${saveSuccess ? 'OK' : 'ERREUR'}`);

      return res.json({ success: true, welcomeMessage: cockpit.data.welcomeMessage });
    }

    // Fonction utilitaire pour traduire avec DeepL
    const translateWithDeepL = async (text: string, targetLang: string = 'EN'): Promise<string> => {
      if (!DEEPL_API_KEY || !text || text.trim() === '') {
        return text; // Retourner le texte original si pas de clé API ou texte vide
      }

      // Si la langue cible est FR, on peut quand même traduire si la source n'est pas FR
      // On détectera la langue source automatiquement avec DeepL
      // Ne pas bloquer la traduction vers FR

      try {
        // Détecter automatiquement la langue source si on traduit vers FR
        // Sinon, utiliser FR par défaut
        let sourceLang = 'FR';
        if (targetLang === 'FR') {
          // Pour traduire vers FR, on laisse DeepL détecter automatiquement la langue source
          // En passant une chaîne vide ou en omettant source_lang, DeepL détecte automatiquement
          sourceLang = ''; // Détection automatique
        }

        // Déterminer l'URL de l'API DeepL (gratuite ou payante)
        // Format API gratuite : commence par "fx-" ou "free-"
        // Format API payante : contient ":" ou format UUID
        const isFreeApi = DEEPL_API_KEY.startsWith('fx-') || DEEPL_API_KEY.startsWith('free-');
        // Détection UUID pour API payante (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(DEEPL_API_KEY);
        const isPaidApi = DEEPL_API_KEY.includes(':') || isUuidFormat;
        const apiUrl = isFreeApi
          ? 'https://api-free.deepl.com/v2/translate'
          : isPaidApi
            ? 'https://api.deepl.com/v2/translate'
            : 'https://api-free.deepl.com/v2/translate'; // Par défaut, essayer l'API gratuite

        // Construire les paramètres de la requête
        const params: any = {
          text: text,
          target_lang: targetLang,
          preserve_formatting: '1',
        };

        // Ajouter source_lang seulement si on ne fait pas de détection automatique
        if (sourceLang) {
          params.source_lang = sourceLang;
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(params),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`DeepL API error: ${response.status} ${response.statusText}`, errorText);

          // Si erreur 403 ou 401, la clé API est probablement invalide
          if (response.status === 403 || response.status === 401) {
            console.error('âŒ Clé API DeepL invalide ou expirée');
          }

          return text; // Retourner le texte original en cas d'erreur
        }

        const data = await response.json();
        return data.translations?.[0]?.text || text;
      } catch (error: any) {
        console.error('Erreur traduction DeepL:', error);
        return text; // Retourner le texte original en cas d'erreur
      }
    };

    // Traduire un objet de données récursivement - tous les champs textuels de contenu
    const translateDataRecursively = async (data: any, targetLang: string = 'EN'): Promise<any> => {
      if (typeof data === 'string' && data.trim() !== '') {
        return await translateWithDeepL(data, targetLang);
      } else if (Array.isArray(data)) {
        return Promise.all(data.map(item => translateDataRecursively(item, targetLang)));
      } else if (data && typeof data === 'object') {
        const translated: any = {};
        for (const [key, value] of Object.entries(data)) {
          // Liste des champs à traduire (champs textuels de contenu)
          const textFieldsToTranslate = [
            'name',              // Nom des domaines, catégories, éléments, sous-catégories, sous-éléments, mapElements, zones, templates, sources, calculs
            'description',       // Description des alertes, sources, calculs
            'actions',           // Actions des alertes
            'scrollingBanner',   // Bannière défilante du cockpit
            'unit',              // Unité des éléments et sous-éléments (attention aux symboles comme Â°C, kW, etc.)
            'duration',          // Durée des alertes
            'ticketNumber',      // Numéro de ticket (peut contenir du texte)
            'zone',              // Nom de zone
            'address',           // Adresse des mapElements
            'templateName',      // Nom du template (domaine)
            'location',          // Emplacement des sources
            'connection',        // Connexion des sources
            'fields',            // Champs des sources (peut contenir du texte descriptif)
          ];

          if (textFieldsToTranslate.includes(key) && typeof value === 'string' && value.trim() !== '') {
            // Traduire ces champs texte directement avec DeepL (ne pas récurser)
            translated[key] = await translateWithDeepL(value, targetLang);
          } else if (key === 'value' && typeof value === 'string' && value.trim() !== '') {
            // Traduire les valeurs textuelles (mais pas les nombres)
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              // C'est du texte, traduire
              translated[key] = await translateWithDeepL(value, targetLang);
            } else {
              // C'est un nombre, ne pas traduire
              translated[key] = value;
            }
          } else if (key !== 'originals') {
            // Tous les autres champs (IDs, ordres, statuts, coordonnées, etc.) ne pas traduire
            // Mais continuer la récursion pour les objets imbriqués
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              translated[key] = await translateDataRecursively(value, targetLang);
            } else if (Array.isArray(value)) {
              translated[key] = await translateDataRecursively(value, targetLang);
            } else {
              translated[key] = value;
            }
          } else {
            // Ne pas copier le champ 'originals' dans les données traduites
            translated[key] = value;
          }
        }
        return translated;
      }
      return data;
    };

    // Mapping des en-têtes Excel français vers d'autres langues
    const excelHeaders: Record<string, Record<string, string>> = {
      FR: {
        'ID': 'ID',
        'Nom': 'Nom',
        'Type': 'Type',
        'Template': 'Template',
        'Ordre': 'Ordre',
        'Domaine': 'Domaine',
        'Catégorie': 'Catégorie',
        'Élément': 'Élément',
        'Sous-catégorie': 'Sous-catégorie',
        'Sous-élément': 'Sous-élément',
        'Valeur': 'Valeur',
        'Unité': 'Unité',
        'Icône': 'Icône',
        'Icône 2': 'Icône 2',
        'Icône 3': 'Icône 3',
        'Statut': 'Statut',
        'Zone': 'Zone',
        'Orientation': 'Orientation',
        'Date': 'Date',
        'Description': 'Description',
        'Durée': 'Durée',
        'Ticket': 'Ticket',
        'Actions': 'Actions',
        'Emplacement': 'Emplacement',
        'Connexion': 'Connexion',
        'Champs': 'Champs',
        'Sources utilisées': 'Sources utilisées',
        'Définition': 'Définition',
      },
      EN: {
        'ID': 'ID',
        'Nom': 'Name',
        'Type': 'Type',
        'Template': 'Template',
        'Ordre': 'Order',
        'Domaine': 'Domain',
        'Catégorie': 'Category',
        'Élément': 'Element',
        'Sous-catégorie': 'Sub-category',
        'Sous-élément': 'Sub-element',
        'Valeur': 'Value',
        'Unité': 'Unit',
        'Icône': 'Icon',
        'Icône 2': 'Icon 2',
        'Icône 3': 'Icon 3',
        'Statut': 'Status',
        'Zone': 'Zone',
        'Orientation': 'Orientation',
        'Date': 'Date',
        'Description': 'Description',
        'Durée': 'Duration',
        'Ticket': 'Ticket',
        'Actions': 'Actions',
        'Emplacement': 'Location',
        'Connexion': 'Connection',
        'Champs': 'Fields',
        'Sources utilisées': 'Sources Used',
        'Définition': 'Definition',
      },
    };

    // Traduire le nom d'un onglet Excel
    const translateSheetName = async (sheetName: string, targetLang: string): Promise<string> => {
      if (targetLang === 'FR') return sheetName;

      const sheetNames: Record<string, Record<string, string>> = {
        FR: {
          'Domaines': 'Domaines',
          'Catégories': 'Catégories',
          'Éléments': 'Éléments',
          'Sous-catégories': 'Sous-catégories',
          'Sous-éléments': 'Sous-éléments',
          'Alertes': 'Alertes',
          'Zones': 'Zones',
          'Sources': 'Sources',
          'Calculs': 'Calculs',
        },
        EN: {
          'Domaines': 'Domains',
          'Catégories': 'Categories',
          'Éléments': 'Elements',
          'Sous-catégories': 'Sub-categories',
          'Sous-éléments': 'Sub-elements',
          'Alertes': 'Alerts',
          'Zones': 'Zones',
          'Sources': 'Data Sources',
          'Calculs': 'Calculations',
        },
      };

      if (sheetNames[targetLang] && sheetNames[targetLang][sheetName]) {
        return sheetNames[targetLang][sheetName];
      }

      if (DEEPL_API_KEY) {
        return await translateWithDeepL(sheetName, targetLang);
      }

      return sheetNames['EN'][sheetName] || sheetName;
    };

    // Obtenir les en-têtes traduits (async pour DeepL si nécessaire)
    const getTranslatedHeader = async (headerFr: string, targetLang: string): Promise<string> => {
      if (targetLang === 'FR') return headerFr;

      // Utiliser le mapping direct si disponible
      if (excelHeaders[targetLang] && excelHeaders[targetLang][headerFr]) {
        return excelHeaders[targetLang][headerFr];
      }

      // Sinon utiliser la version anglaise comme fallback
      if (excelHeaders['EN'][headerFr]) {
        return excelHeaders['EN'][headerFr];
      }

      // Si DeepL est disponible, traduire
      if (DEEPL_API_KEY) {
        return await translateWithDeepL(headerFr, targetLang);
      }

      return headerFr; // Fallback : garder l'original
    };

    // Traduire les clés d'un tableau d'objets (pour les en-têtes Excel)
    const translateObjectsKeys = async (objects: Record<string, any>[], targetLang: string): Promise<Record<string, any>[]> => {
      if (targetLang === 'FR' || objects.length === 0) return objects;

      // Obtenir toutes les clés uniques du premier objet
      const firstObject = objects[0] || {};
      const keys = Object.keys(firstObject);

      // Créer un mapping des clés françaises vers les clés traduites
      const keyMapping: Record<string, string> = {};
      for (const key of keys) {
        keyMapping[key] = await getTranslatedHeader(key, targetLang);
      }

      // Traduire chaque objet
      return objects.map(obj => {
        const translated: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          translated[keyMapping[key] || key] = value;
        }
        return translated;
      });
    };

    // Export Excel - Format "Cockpit Generator" compatible générateur Zabbix
    const exportMatch = path.match(/^\/cockpits\/([^/]+)\/export(?:\/([^/]+))?$/);
    if (exportMatch && method === 'GET') {
      const id = exportMatch[1];
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const requestedLang = exportMatch[2] || 'FR'; // Par défaut FR (original)
      const data = cockpit.data || { domains: [], zones: [] };

      // Traduire les données si nécessaire (toutes les langues sauf FR)
      let dataToExport = data;
      if (requestedLang !== 'FR' && DEEPL_API_KEY) {
        console.log(`[Excel Export] Traduction en cours vers ${requestedLang}...`);
        dataToExport = await translateDataRecursively(JSON.parse(JSON.stringify(data)), requestedLang);
        console.log('[Excel Export] Traduction terminée');
      }

      // Créer le workbook Excel
      const wb = XLSX.utils.book_new();

      // Filtrer les domaines publiables uniquement (publiable !== false)
      const publishableDomains = (dataToExport.domains || []).filter((d: any) => d.publiable !== false);

      // ========== GÉNÉRATION D'IDS LISIBLES ==========
      // Fonction simple pour convertir un nom en slug (minuscules, sans accents, tirets)
      const toSlug = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
          .replace(/[^a-z0-9\s-]/g, '') // Garder seulement lettres, chiffres, espaces, tirets
          .replace(/\s+/g, '-') // Espaces -> tirets
          .replace(/-+/g, '-') // Éviter les tirets multiples
          .replace(/^-|-$/g, ''); // Supprimer tirets au début/fin
      };

      // Fonction pour créer un ID avec préfixe (sans gestion des doublons - pour les références)
      const toId = (name: string, prefix: string): string => {
        const slug = toSlug(name);
        return `${prefix}-${slug || 'unnamed'}`;
      };

      // Générer une Key pour les items (format: se.nom.en.lowercase.avec.points)
      const generateItemKey = (name: string, prefix: string = 'se'): string => {
        const slug = toSlug(name).replace(/-/g, '.');
        return `${prefix}.${slug || 'unnamed'}`;
      };

      // ========== GESTION DES LIAISONS (linkedGroupId) ==========
      // Map pour stocker les IDs par linkedGroupId (éléments liés partagent le même ID)
      const linkedElementIds = new Map<string, string>(); // linkedGroupId -> ID généré
      const linkedSubElementIds = new Map<string, string>(); // linkedGroupId -> ID généré
      
      // Compteurs pour les suffixes d'IDs non liés
      const usedElementIds = new Set<string>();
      const usedSubElementIds = new Set<string>();
      
      // Fonction pour obtenir l'ID d'un élément (respecte les liaisons)
      const getElementId = (element: any, domainSlug: string, categorySlug: string): string => {
        const elementSlug = toSlug(element.name);
        const baseId = `d-${domainSlug}-c-${categorySlug}-e-${elementSlug}`;
        
        // Si l'élément est lié, utiliser/créer l'ID partagé
        if (element.linkedGroupId) {
          if (linkedElementIds.has(element.linkedGroupId)) {
            return linkedElementIds.get(element.linkedGroupId)!;
          }
          // Premier élément du groupe → créer l'ID
          let finalId = baseId;
          if (usedElementIds.has(baseId)) {
            let suffix = 1;
            while (usedElementIds.has(`${baseId}-${String(suffix).padStart(3, '0')}`)) {
              suffix++;
            }
            finalId = `${baseId}-${String(suffix).padStart(3, '0')}`;
          }
          usedElementIds.add(finalId);
          linkedElementIds.set(element.linkedGroupId, finalId);
          return finalId;
        }
        
        // Élément non lié → ID unique
        if (usedElementIds.has(baseId)) {
          let suffix = 1;
          let uniqueId = `${baseId}-${String(suffix).padStart(3, '0')}`;
          while (usedElementIds.has(uniqueId)) {
            suffix++;
            uniqueId = `${baseId}-${String(suffix).padStart(3, '0')}`;
          }
          usedElementIds.add(uniqueId);
          return uniqueId;
        }
        usedElementIds.add(baseId);
        return baseId;
      };
      
      // Fonction pour obtenir l'ID d'un sous-élément (respecte les liaisons)
      const getSubElementId = (subElement: any): string => {
        const baseId = toId(subElement.name, 'se');
        
        // Si le sous-élément est lié, utiliser/créer l'ID partagé
        if (subElement.linkedGroupId) {
          if (linkedSubElementIds.has(subElement.linkedGroupId)) {
            return linkedSubElementIds.get(subElement.linkedGroupId)!;
          }
          // Premier sous-élément du groupe → créer l'ID
          let finalId = baseId;
          if (usedSubElementIds.has(baseId)) {
            let suffix = 1;
            while (usedSubElementIds.has(`${baseId}-${String(suffix).padStart(3, '0')}`)) {
              suffix++;
            }
            finalId = `${baseId}-${String(suffix).padStart(3, '0')}`;
          }
          usedSubElementIds.add(finalId);
          linkedSubElementIds.set(subElement.linkedGroupId, finalId);
          return finalId;
        }
        
        // Sous-élément non lié → ID unique
        if (usedSubElementIds.has(baseId)) {
          let suffix = 1;
          let uniqueId = `${baseId}-${String(suffix).padStart(3, '0')}`;
          while (usedSubElementIds.has(uniqueId)) {
            suffix++;
            uniqueId = `${baseId}-${String(suffix).padStart(3, '0')}`;
          }
          usedSubElementIds.add(uniqueId);
          return uniqueId;
        }
        usedSubElementIds.add(baseId);
        return baseId;
      };

      // ========== 1. ONGLET DOMAINS ==========
      // Colonnes: Label, Id, Order, Icon, Enabled
      let domainsData = publishableDomains.map((d: any, idx: number) => ({
        'Label': d.name,
        'Id': toId(d.name, 'd'),
        'Order': idx + 1,
        'Icon': d.icon || '',
        'Enabled': 'VRAI',
      }));
      if (domainsData.length === 0) {
        domainsData = [{ 'Label': '', 'Id': '', 'Order': '', 'Icon': '', 'Enabled': '' }];
      }
      const wsDomains = XLSX.utils.json_to_sheet(domainsData);
      XLSX.utils.book_append_sheet(wb, wsDomains, 'Domains');

      // ========== 2. ONGLET ZONES ==========
      // Colonnes: Label, Id, Icon, Order
      let zonesData = (dataToExport.zones || []).map((z: any, idx: number) => ({
        'Label': z.name,
        'Id': toId(z.name, 'z'),
        'Icon': z.icon || '',
        'Order': idx + 1,
      }));
      if (zonesData.length === 0) {
        zonesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order': '' }];
      }
      const wsZones = XLSX.utils.json_to_sheet(zonesData);
      XLSX.utils.book_append_sheet(wb, wsZones, 'Zones');

      // ========== 3. ONGLET TEMPLATES ==========
      // Colonnes: Label, Id, Icon, Order, Zone
      const templateIcons = dataToExport.templateIcons || {};
      const templatesMap = new Map<string, any>();
      let templateOrderCounter = 1;
      
      // Templates depuis les éléments (e.template)
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            if (e.template && !templatesMap.has(e.template)) {
              templatesMap.set(e.template, {
                'Label': e.template,
                'Id': toId(e.template, 't'),
                'Icon': templateIcons[e.template] || e.icon || '',
                'Order': templateOrderCounter++,
                'Zone': e.zone ? toId(e.zone, 'z') : '', // Format z-nom-de-zone
              });
            }
          });
        });
      });
      
      let templatesData = Array.from(templatesMap.values());
      if (templatesData.length === 0) {
        templatesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order': '', 'Zone': '' }];
      }
      const wsTemplates = XLSX.utils.json_to_sheet(templatesData);
      XLSX.utils.book_append_sheet(wb, wsTemplates, 'Templates');

      // ========== 4. ONGLET SUBCATEGORIES ==========
      // Colonnes: Label, Id, Icon, Order, Domain, Orientation, Enabled
      let subCategoriesData: any[] = [];
      let subCatOrderCounter = 1;
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              subCategoriesData.push({
                'Label': sc.name,
                'Id': toId(sc.name, 'sc'), // Cohérent avec les références dans Items
                'Icon': sc.icon || '',
                'Order': subCatOrderCounter++,
                'Domain': toId(d.name, 'd'),
                'Orientation': sc.orientation || 'horizontal',
                'Enabled': 'VRAI',
              });
            });
          });
        });
      });
      if (subCategoriesData.length === 0) {
        subCategoriesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order': '', 'Domain': '', 'Orientation': '', 'Enabled': '' }];
      }
      const wsSubCategories = XLSX.utils.json_to_sheet(subCategoriesData);
      XLSX.utils.book_append_sheet(wb, wsSubCategories, 'SubCategories');

      // ========== 5. ONGLET ITEMS (= Sous-éléments) ==========
      // Colonnes: Id, Key, Label, Order, Template, Subcategory, Icon, Type, Formula, Preprocessing Inventory Field, Enabled, Displayed Value Display
      // Les sous-éléments liés (même linkedGroupId) partagent le même ID
      let itemsData: any[] = [];
      let itemOrderCounter = 1;
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              (sc.subElements || []).forEach((se: any) => {
                // Utiliser getSubElementId pour respecter les liaisons
                const subElementId = getSubElementId(se);
                itemsData.push({
                  'Id': subElementId,
                  'Key': generateItemKey(se.name, 'se'),
                  'Label': se.name,
                  'Order': itemOrderCounter++,
                  'Template': e.template ? toId(e.template, 't') : '',
                  'Subcategory': toId(sc.name, 'sc'),
                  'Icon': se.icon || '',
                  'Type': 'calculated',
                  'Formula': '0',
                  'Preprocessing Inventory Field': '',
                  'Enabled': 'FAUX',
                  'Displayed Value Display': 'VRAI',
                });
              });
            });
          });
        });
      });
      if (itemsData.length === 0) {
        itemsData = [{ 'Id': '', 'Key': '', 'Label': '', 'Order': '', 'Template': '', 'Subcategory': '', 'Icon': '', 'Type': '', 'Formula': '', 'Preprocessing Inventory Field': '', 'Enabled': '', 'Displayed Value Display': '' }];
      }
      const wsItems = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

      // ========== 6. ONGLET TRIGGERS ==========
      // Colonnes: Template, texte, statut, valeur, condition
      const wsTriggers = XLSX.utils.json_to_sheet([{
        'Template': '',
        'texte': '',
        'statut': '',
        'valeur': '',
        'condition': '',
      }]);
      XLSX.utils.book_append_sheet(wb, wsTriggers, 'Triggers');

      // ========== 7. ONGLET CATEGORIES ==========
      // Colonnes: Label, Id, Icon, Order Domain, Enabled
      let categoriesData: any[] = [];
      let catOrderCounter = 1;
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          categoriesData.push({
            'Label': c.name,
            'Id': toId(c.name, 'c'), // Pas de suffixe numérique
            'Icon': c.icon || '',
            'Order Domain': catOrderCounter++,
            'Enabled': 'VRAI',
          });
        });
      });
      if (categoriesData.length === 0) {
        categoriesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order Domain': '', 'Enabled': '' }];
      }
      const wsCategories = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, wsCategories, 'Categories');

      // ========== 8. ONGLET ELEMENTS ==========
      // Colonnes: Template, Label, Category, Id, Domain, Order, Enabled
      // Les éléments liés (même linkedGroupId) partagent le même ID
      let elementsData: any[] = [];
      let elemOrderCounter = 1;
      publishableDomains.forEach((d: any) => {
        const domainSlug = toSlug(d.name);
        (d.categories || []).forEach((c: any) => {
          const categorySlug = toSlug(c.name);
          (c.elements || []).forEach((e: any) => {
            // Utiliser getElementId pour respecter les liaisons
            const elementId = getElementId(e, domainSlug, categorySlug);
            elementsData.push({
              'Template': e.template ? toId(e.template, 't') : '',
              'Label': e.name,
              'Category': toId(c.name, 'c'),
              'Id': elementId,
              'Domain': toId(d.name, 'd'),
              'Order': elemOrderCounter++,
              'Enabled': 'FAUX',
            });
          });
        });
      });
      if (elementsData.length === 0) {
        elementsData = [{ 'Template': '', 'Label': '', 'Category': '', 'Id': '', 'Domain': '', 'Order': '', 'Enabled': '' }];
      }
      const wsElements = XLSX.utils.json_to_sheet(elementsData);
      XLSX.utils.book_append_sheet(wb, wsElements, 'Elements');

      // ========== 9. ONGLET ELEMENT DISCOVERIES ==========
      // Colonnes: Template, Label, Category, Id, Domain, Order, Discovery Template Id, File, Discovery Rule Id, CSV Column, Enabled
      const wsElementDiscoveries = XLSX.utils.json_to_sheet([{
        'Template': '',
        'Label': '',
        'Category': '',
        'Id': '',
        'Domain': '',
        'Order': '',
        'Discovery Template Id': '',
        'File': '',
        'Discovery Rule Id': '',
        'CSV Column': '',
        'Enabled': '',
      }]);
      XLSX.utils.book_append_sheet(wb, wsElementDiscoveries, 'Element Discoveries');

      // ========== 10. ONGLET CATEGORY DISCOVERIES ==========
      // Colonnes: Label, Id, Domain, Order, Discovery Template Id, File, Discovery Rule Id, CSV Column, Enabled, Icon
      const wsCategoryDiscoveries = XLSX.utils.json_to_sheet([{
        'Label': '',
        'Id': '',
        'Domain': '',
        'Order': '',
        'Discovery Template Id': '',
        'File': '',
        'Discovery Rule Id': '',
        'CSV Column': '',
        'Enabled': '',
        'Icon': '',
      }]);
      XLSX.utils.book_append_sheet(wb, wsCategoryDiscoveries, 'Category Discoveries');

      // NOTE: Les onglets supplémentaires pour "Suivi des heures" seront ajoutés après les 10 onglets standard

      // Onglets pour les domaines "Suivi des heures" (un onglet par domaine publiable)
      for (const d of publishableDomains) {
        if (d.templateType === 'hours-tracking' && d.hoursTracking) {
          const hoursData = d.hoursTracking;

          // Générer toutes les dates depuis projectStartDate jusqu'à aujourd'hui + 30 jours
          const startDate = new Date(hoursData.projectStartDate);
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          const dates: string[] = [];
          const current = new Date(startDate);
          while (current <= endDate) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
          }

          // Section 1 : Informations générales
          const generalInfo: any[] = [
            { 'Libellé': 'Date de début du projet', 'Valeur': hoursData.projectStartDate },
            { 'Libellé': 'Prix de vente au client (â‚¬)', 'Valeur': hoursData.salePrice || 0 },
            { 'Libellé': 'CoÃ»t global (â‚¬)', 'Valeur': '' }, // Sera calculé
            { 'Libellé': 'Marge (â‚¬)', 'Valeur': '' }, // Sera calculé
          ];

          // Calculer le coÃ»t global
          let globalCost = 0;
          (hoursData.resources || []).forEach((r: any) => {
            if (r.type === 'person' && r.dailyRate !== undefined && r.timeEntries) {
              globalCost += r.dailyRate * (r.timeEntries.length * 0.5);
            } else if (r.type === 'supplier' && r.entries) {
              r.entries.forEach((e: any) => {
                globalCost += e.amount || 0;
              });
            }
          });
          generalInfo[2].Valeur = globalCost;
          generalInfo[3].Valeur = (hoursData.salePrice || 0) - globalCost;

          const translatedGeneralInfo = await translateObjectsKeys(generalInfo, requestedLang);

          // Section 2 : Tableau des ressources et imputations
          const resourcesData: any[] = [];

          // En-tête avec dates
          const headerRow: any = {
            'Type': 'Type',
            'Nom': 'Nom',
            'TJM (â‚¬)': 'TJM (â‚¬)',
            'Jours': 'Jours',
            'Total (â‚¬)': 'Total (â‚¬)'
          };
          dates.forEach(date => {
            headerRow[date] = date;
          });
          resourcesData.push(headerRow);

          // Lignes pour chaque ressource
          (hoursData.resources || []).forEach((r: any) => {
            const row: any = {
              'Type': r.type === 'person' ? 'Personne' : 'Fournisseur',
              'Nom': r.name,
              'TJM (â‚¬)': r.type === 'person' ? (r.dailyRate || 0) : '',
              'Jours': '',
              'Total (â‚¬)': ''
            };

            // Calculer jours et total pour les personnes
            if (r.type === 'person') {
              const days = (r.timeEntries || []).length * 0.5;
              const total = (r.dailyRate || 0) * days;
              row['Jours'] = days;
              row['Total (â‚¬)'] = total;
            } else {
              // Total pour les fournisseurs
              const total = (r.entries || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
              row['Total (â‚¬)'] = total;
            }

            // Remplir les dates
            dates.forEach(date => {
              if (r.type === 'person') {
                const hasMorning = (r.timeEntries || []).some((te: any) => te.date === date && te.halfDay === 'morning');
                const hasAfternoon = (r.timeEntries || []).some((te: any) => te.date === date && te.halfDay === 'afternoon');
                if (hasMorning && hasAfternoon) {
                  row[date] = 'M+A';
                } else if (hasMorning) {
                  row[date] = 'M';
                } else if (hasAfternoon) {
                  row[date] = 'A';
                } else {
                  row[date] = '';
                }
              } else {
                const entry = (r.entries || []).find((e: any) => e.date === date);
                row[date] = entry ? (entry.amount || 0) : '';
              }
            });

            resourcesData.push(row);
          });

          // Ligne de total par jour
          const totalRow: any = {
            'Type': 'TOTAL',
            'Nom': 'Total par jour',
            'TJM (â‚¬)': '',
            'Jours': '',
            'Total (â‚¬)': ''
          };
          dates.forEach(date => {
            let dayTotal = 0;
            (hoursData.resources || []).forEach((r: any) => {
              if (r.type === 'person' && r.dailyRate !== undefined && r.timeEntries) {
                const hasMorning = (r.timeEntries || []).some((te: any) => te.date === date && te.halfDay === 'morning');
                const hasAfternoon = (r.timeEntries || []).some((te: any) => te.date === date && te.halfDay === 'afternoon');
                if (hasMorning) dayTotal += r.dailyRate * 0.5;
                if (hasAfternoon) dayTotal += r.dailyRate * 0.5;
              } else if (r.type === 'supplier' && r.entries) {
                const entry = (r.entries || []).find((e: any) => e.date === date);
                if (entry) dayTotal += entry.amount || 0;
              }
            });
            totalRow[date] = dayTotal;
          });
          resourcesData.push(totalRow);

          const translatedResourcesData = await translateObjectsKeys(resourcesData, requestedLang);

          // Section 3 : Données pour le graphique (3 mois depuis projectStartDate)
          const chartStartDate = new Date(hoursData.projectStartDate);
          const chartEndDate = new Date(chartStartDate);
          chartEndDate.setMonth(chartEndDate.getMonth() + 3);
          const chartDates: string[] = [];
          const chartCurrent = new Date(chartStartDate);
          while (chartCurrent <= chartEndDate) {
            chartDates.push(chartCurrent.toISOString().split('T')[0]);
            chartCurrent.setDate(chartCurrent.getDate() + 1);
          }

          const chartData: any[] = [
            { 'Date': 'Date', 'Jours imputés': 'Jours imputés', 'CoÃ»t cumulé (â‚¬)': 'CoÃ»t cumulé (â‚¬)', 'CoÃ»t fournisseurs cumulé (â‚¬)': 'CoÃ»t fournisseurs cumulé (â‚¬)', 'Prix de vente (â‚¬)': 'Prix de vente (â‚¬)' }
          ];

          chartDates.forEach(date => {
            // Calculer jours imputés
            let days = 0;
            (hoursData.resources || []).forEach((r: any) => {
              if (r.type === 'person' && r.timeEntries) {
                const hasMorning = (r.timeEntries || []).some((te: any) => te.date === date && te.halfDay === 'morning');
                const hasAfternoon = (r.timeEntries || []).some((te: any) => te.date === date && te.halfDay === 'afternoon');
                if (hasMorning && hasAfternoon) days += 1;
                else if (hasMorning || hasAfternoon) days += 0.5;
              }
            });

            // Calculer coÃ»t cumulé
            let cumulativeCost = 0;
            const targetDate = new Date(date);
            (hoursData.resources || []).forEach((r: any) => {
              if (r.type === 'person' && r.dailyRate !== undefined && r.timeEntries) {
                (r.timeEntries || []).forEach((te: any) => {
                  const entryDate = new Date(te.date);
                  if (entryDate <= targetDate) {
                    cumulativeCost += r.dailyRate * 0.5;
                  }
                });
              } else if (r.type === 'supplier' && r.entries) {
                (r.entries || []).forEach((entry: any) => {
                  const entryDate = new Date(entry.date);
                  if (entryDate <= targetDate) {
                    cumulativeCost += entry.amount || 0;
                  }
                });
              }
            });

            // Calculer coÃ»t fournisseurs cumulé
            let cumulativeSupplierCost = 0;
            (hoursData.resources || []).forEach((r: any) => {
              if (r.type === 'supplier' && r.entries) {
                (r.entries || []).forEach((entry: any) => {
                  const entryDate = new Date(entry.date);
                  if (entryDate <= targetDate) {
                    cumulativeSupplierCost += entry.amount || 0;
                  }
                });
              }
            });

            chartData.push({
              'Date': date,
              'Jours imputés': days,
              'CoÃ»t cumulé (â‚¬)': cumulativeCost,
              'CoÃ»t fournisseurs cumulé (â‚¬)': cumulativeSupplierCost,
              'Prix de vente (â‚¬)': hoursData.salePrice || 0
            });
          });

          const translatedChartData = await translateObjectsKeys(chartData, requestedLang);

          // Créer un workbook pour ce domaine et combiner les feuilles
          // Note: Excel limite les noms d'onglets à 31 caractères
          const sheetName = (d.name || 'Suivi des heures').substring(0, 31);

          // Créer une feuille combinée avec toutes les sections
          const combinedData: any[] = [];

          // Ajouter les informations générales
          combinedData.push({ '': '=== INFORMATIONS GÉNÉRALES ===' });
          combinedData.push({});
          translatedGeneralInfo.forEach((row: any) => {
            combinedData.push(row);
          });
          combinedData.push({});
          combinedData.push({ '': '=== RESSOURCES ET IMPUTATIONS ===' });
          combinedData.push({});

          // Ajouter le tableau des ressources
          translatedResourcesData.forEach((row: any) => {
            combinedData.push(row);
          });

          combinedData.push({});
          combinedData.push({ '': '=== DONNÉES POUR GRAPHIQUE ===' });
          combinedData.push({});

          // Ajouter les données du graphique
          translatedChartData.forEach((row: any) => {
            combinedData.push(row);
          });

          const wsCombined = XLSX.utils.json_to_sheet(combinedData);
          XLSX.utils.book_append_sheet(wb, wsCombined, sheetName);
        }
      }

      // Générer le buffer Excel
      try {
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Générer l'horodatage en heure de Paris (format YYYYMMDD et HHMMSS)
        const now = new Date();
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const year = parisTime.getFullYear();
        const month = String(parisTime.getMonth() + 1).padStart(2, '0');
        const day = String(parisTime.getDate()).padStart(2, '0');
        const hours = String(parisTime.getHours()).padStart(2, '0');
        const minutes = String(parisTime.getMinutes()).padStart(2, '0');
        const seconds = String(parisTime.getSeconds()).padStart(2, '0');
        const dateStamp = `${year}${month}${day}`; // YYYYMMDD
        const timeStamp = `${hours}${minutes}${seconds}`; // HHMMSS

        // Format du nom : "YYYYMMDD SOMONE Cockpit Generator NomMaquette LANG HHMMSS.xlsx"
        const cleanName = cockpit.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
        const fileName = `${dateStamp} SOMONE Cockpit Generator ${cleanName} ${requestedLang} ${timeStamp}`;
        const encodedFileName = encodeURIComponent(fileName).replace(/'/g, '%27');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}.xlsx"; filename*=UTF-8''${encodedFileName}.xlsx`);
        res.setHeader('Content-Length', buffer.length.toString());

        return res.send(Buffer.from(buffer));
      } catch (error: any) {
        console.error('Erreur génération Excel:', error);
        return res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel: ' + error.message });
      }
    }

    // =====================
    // TRANSLATION ROUTES
    // =====================

    // Obtenir les langues disponibles DeepL
    if (path === '/translation/languages' && method === 'GET') {
      // Ne nécessite pas d'authentification - liste publique des langues
      return res.json({
        languages: [
          { code: 'FR', name: 'Français (Originale)' },
          { code: 'EN', name: 'English' },
          { code: 'DE', name: 'Deutsch' },
          { code: 'ES', name: 'EspaÃ±ol' },
          { code: 'IT', name: 'Italiano' },
          { code: 'PT', name: 'Português' },
          { code: 'RU', name: 'Ð ÑƒÑÑÐºÐ¸Ð¹' },
          { code: 'JA', name: 'æ—¥æœ¬èªž' },
          { code: 'ZH', name: 'ä¸­æ–‡' },
          { code: 'NL', name: 'Nederlands' },
          { code: 'PL', name: 'Polski' },
          { code: 'AR', name: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©' },
        ]
      });
    }

    // Traduire un cockpit
    if (path.match(/^\/cockpits\/([^/]+)\/translate$/) && method === 'POST') {
      const match = path.match(/^\/cockpits\/([^/]+)\/translate$/);
      if (!match) {
        return res.status(400).json({ error: 'ID manquant' });
      }
      const id = match[1];
      const { targetLang } = req.body || {};

      // Vérifier l'authentification
      if (!currentUser) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      // Si targetLang est 'Restauration', restaurer les données originales
      if (!targetLang || targetLang === 'Restauration') {
        // Restaurer les données originales si disponibles
        try {
          const db = await getDb();
          const cockpit = db.cockpits.find(c => c.id === id);
          if (!cockpit) {
            return res.status(404).json({ error: 'Maquette non trouvée' });
          }
          if (!canAccessCockpit(cockpit, currentUser)) {
            return res.status(403).json({ error: 'Accès non autorisé' });
          }

          console.log(`[Translation] Restauration demandée pour cockpit ${id}`);
          console.log(`[Translation] Originaux présents: ${!!(cockpit.data && cockpit.data.originals)}`);

          // Si les originaux existent, les restaurer
          let dataToReturn;
          if (cockpit.data && cockpit.data.originals) {
            try {
              // Restaurer les originaux
              // IMPORTANT: Faire une copie profonde des originaux pour restaurer
              const originalsCopy = JSON.parse(JSON.stringify(cockpit.data.originals));

              // Sauvegarder les originaux avant de remplacer
              const savedOriginals = cockpit.data.originals;

              // Remplacer COMPLÃˆTEMENT les données par les originaux
              cockpit.data = JSON.parse(JSON.stringify(originalsCopy));

              // Remettre les originaux sauvegardés
              cockpit.data.originals = savedOriginals;

              cockpit.updatedAt = new Date().toISOString();
              await saveDb(db);

              // Préparer les données à retourner (sans le champ originals)
              dataToReturn = JSON.parse(JSON.stringify(originalsCopy));
              console.log(`[Translation] âœ… Originaux restaurés avec succès (${JSON.stringify(dataToReturn).length} caractères, originaux conservés pour restaurations futures)`);
              console.log(`[Translation] Nombre de domaines restaurés: ${dataToReturn.domains?.length || 0}`);
            } catch (restoreError: any) {
              console.error(`[Translation] Erreur lors de la restauration des originaux:`, restoreError);
              return res.status(500).json({ error: 'Erreur lors de la restauration des originaux: ' + restoreError.message });
            }
          } else {
            // Pas d'originaux sauvegardés
            // IMPORTANT: Sauvegarder les données actuelles comme originaux pour pouvoir restaurer plus tard
            console.log(`[Translation] âš ï¸ Aucun original sauvegardé, sauvegarde des données actuelles comme originaux...`);

            const currentData = cockpit.data || { domains: [], zones: [] };

            // Sauvegarder les données actuelles comme originaux
            if (!cockpit.data) {
              cockpit.data = {};
            }
            cockpit.data.originals = JSON.parse(JSON.stringify(currentData));
            // S'assurer que le champ 'originals' n'est pas inclus dans les originaux eux-mêmes
            if (cockpit.data.originals.originals) {
              delete cockpit.data.originals.originals;
            }
            cockpit.updatedAt = new Date().toISOString();
            await saveDb(db);

            console.log(`[Translation] âœ… Données actuelles sauvegardées comme originaux`);
            dataToReturn = currentData;

            // Enlever le champ 'originals' s'il est présent dans les données retournées
            if (dataToReturn && dataToReturn.originals) {
              delete dataToReturn.originals;
            }
          }

          // Enlever le champ 'originals' s'il reste
          if (dataToReturn && dataToReturn.originals) {
            delete dataToReturn.originals;
          }
          return res.json({ translatedData: dataToReturn });
        } catch (error: any) {
          console.error(`[Translation] Erreur lors de la restauration:`, error);
          return res.status(500).json({ error: 'Erreur lors de la restauration: ' + error.message });
        }
      }

      if (!DEEPL_API_KEY) {
        return res.status(400).json({ error: 'DeepL API key not configured' });
      }

      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const data = cockpit.data || { domains: [], zones: [] };

      try {
        // Le français est maintenant traité comme n'importe quelle autre langue
        // Pas de traitement spécial : on traduit vers le français via DeepL si nécessaire

        // IMPORTANT: Toujours sauvegarder les originaux avant la première traduction
        // Si les originaux n'existent pas, sauvegarder les données actuelles comme originaux
        // Cela garantit qu'on peut TOUJOURS revenir aux textes originaux en français
        if (!cockpit.data.originals) {
          console.log(`[Translation] âš ï¸ Aucun original sauvegardé, sauvegarde des données actuelles comme originaux AVANT traduction...`);
          // Sauvegarder une copie complète et profonde des données actuelles comme originaux
          // Cela inclut TOUS les textes : 
          // - domaines (name, templateName)
          // - catégories (name)
          // - éléments (name, value si texte, unit, zone)
          // - sous-catégories (name)
          // - sous-éléments (name, value si texte, unit)
          // - alertes (description, actions, duration, ticketNumber)
          // - mapElements (name, address)
          // - zones (name)
          // - scrollingBanner
          const originalsToSave = JSON.parse(JSON.stringify(data));
          // S'assurer que le champ 'originals' n'est pas inclus dans les originaux eux-mêmes
          if (originalsToSave.originals) {
            delete originalsToSave.originals;
          }
          cockpit.data.originals = originalsToSave;
          cockpit.updatedAt = new Date().toISOString();
          await saveDb(db);
          const originalsSize = JSON.stringify(cockpit.data.originals).length;
          console.log(`[Translation] âœ… Textes originaux sauvegardés avec succès (${originalsSize} caractères)`);
          console.log(`[Translation] Détails sauvegarde: ${data.domains?.length || 0} domaines`);
        } else {
          console.log(`[Translation] âœ“ Originaux déjà sauvegardés (${JSON.stringify(cockpit.data.originals).length} caractères), pas besoin de les sauvegarder à nouveau`);
        }

        // Traduire les données
        console.log(`[Translation] Traduction en cours vers ${targetLang}...`);
        console.log(`[Translation] Nombre de domaines avant traduction: ${data.domains?.length || 0}`);

        const dataToTranslate = JSON.parse(JSON.stringify(data));

        // Log détaillé avant traduction pour vérifier la structure
        if (dataToTranslate.domains && dataToTranslate.domains.length > 0) {
          const firstDomain = dataToTranslate.domains[0];
          if (firstDomain.categories && firstDomain.categories.length > 0) {
            const firstCategory = firstDomain.categories[0];
            if (firstCategory.elements && firstCategory.elements.length > 0) {
              const firstElement = firstCategory.elements[0];
              console.log(`[Translation] Structure avant traduction - Exemple:`);
              console.log(`  Domaine: "${firstDomain.name}"`);
              console.log(`  Catégorie: "${firstCategory.name}"`);
              console.log(`  Élément: "${firstElement.name}"`);
            }
          }
        }

        const translatedData = await translateDataRecursively(dataToTranslate, targetLang);

        console.log(`[Translation] Traduction terminée`);
        console.log(`[Translation] Nombre de domaines après traduction: ${translatedData.domains?.length || 0}`);

        // Vérifier que les noms ont été traduits
        if (translatedData.domains && translatedData.domains.length > 0) {
          const firstDomain = translatedData.domains[0];
          if (firstDomain.categories && firstDomain.categories.length > 0) {
            const firstCategory = firstDomain.categories[0];
            if (firstCategory.elements && firstCategory.elements.length > 0) {
              const firstElement = firstCategory.elements[0];
              console.log(`[Translation] Structure après traduction - Exemple:`);
              console.log(`  Domaine: "${firstDomain.name}"`);
              console.log(`  Catégorie: "${firstCategory.name}"`);
              console.log(`  Élément: "${firstElement.name}"`);
            }
          }
        }

        return res.json({ translatedData });
      } catch (error: any) {
        console.error('Erreur traduction:', error);
        return res.status(500).json({ error: 'Erreur lors de la traduction: ' + error.message });
      }
    }

    // Sauvegarder explicitement les originaux (figer la version actuelle)
    if (path.match(/^\/cockpits\/([^/]+)\/save-originals$/) && method === 'POST') {
      const match = path.match(/^\/cockpits\/([^/]+)\/save-originals$/);
      if (!match) {
        return res.status(400).json({ error: 'ID manquant' });
      }
      const id = match[1];

      // Vérifier l'authentification
      if (!currentUser) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Sauvegarder les données actuelles comme originaux
      const currentData = cockpit.data || { domains: [], zones: [] };
      const originalsToSave = JSON.parse(JSON.stringify(currentData));

      // S'assurer que le champ 'originals' n'est pas inclus dans les originaux eux-mêmes
      if (originalsToSave.originals) {
        delete originalsToSave.originals;
      }

      // Log détaillé de ce qui est sauvegardé
      const domainsCount = originalsToSave.domains?.length || 0;
      let elementsCount = 0;
      let categoriesCount = 0;
      if (originalsToSave.domains) {
        for (const domain of originalsToSave.domains) {
          if (domain.categories) {
            categoriesCount += domain.categories.length;
            for (const category of domain.categories) {
              if (category.elements) {
                elementsCount += category.elements.length;
              }
            }
          }
        }
      }

      cockpit.data.originals = originalsToSave;
      cockpit.updatedAt = new Date().toISOString();
      await saveDb(db);

      console.log(`[Translation] âœ… Version actuelle figée comme originaux (${JSON.stringify(originalsToSave).length} caractères)`);
      console.log(`[Translation] Détails sauvegardés: ${domainsCount} domaines, ${categoriesCount} catégories, ${elementsCount} éléments`);

      return res.json({ success: true, message: 'Version actuelle sauvegardée comme originaux' });
    }

    // Restaurer les textes originaux
    if (path.match(/^\/cockpits\/([^/]+)\/restore-originals$/) && method === 'POST') {
      const match = path.match(/^\/cockpits\/([^/]+)\/restore-originals$/);
      if (!match) {
        return res.status(400).json({ error: 'ID manquant' });
      }
      const id = match[1];

      // Vérifier l'authentification
      if (!currentUser) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!canAccessCockpit(cockpit, currentUser)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      if (!cockpit.data.originals) {
        return res.status(400).json({ error: 'Aucun texte original sauvegardé' });
      }

      // Restaurer les originaux
      const originals = cockpit.data.originals;
      cockpit.data = { ...cockpit.data, ...originals };
      delete cockpit.data.originals; // Supprimer les originaux après restauration
      cockpit.updatedAt = new Date().toISOString();
      await saveDb(db);

      return res.json({ success: true, data: cockpit.data });
    }

    // =====================
    // TEMPLATES ROUTE
    // =====================

    if (path === '/templates' && method === 'GET') {
      return res.json([
        { id: 'standard', name: 'Standard', description: 'Vue classique avec catégories horizontales' },
        { id: 'grid', name: 'Grille', description: 'Affichage en grille compacte' },
        { id: 'map', name: 'Carte', description: 'Vue géographique avec points sur carte' },
        { id: 'background', name: 'Image de fond', description: 'Éléments positionnables sur une image' }
      ]);
    }

    // =====================
    // AI ROUTES
    // =====================

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // AI Status
    if (path === '/ai/status' && method === 'GET') {
      return res.json({
        configured: !!OPENAI_API_KEY,
        model: OPENAI_API_KEY ? 'gpt-4o-mini' : 'none'
      });
    }

    // =====================
    // STATS DASHBOARD (admin only)
    // =====================
    if (path === '/stats/dashboard' && method === 'GET') {
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      }

      const db = await getDb();
      
      // DEBUG: Log tous les cockpits avec leur statut
      console.log(`[STATS] Nombre total de cockpits dans la base: ${db.cockpits?.length || 0}`);
      db.cockpits?.forEach((c, i) => {
        console.log(`[STATS] Cockpit ${i + 1}: "${c.name}" - isPublished: ${c.data?.isPublished}, viewCount: ${c.data?.viewCount || 0}, publicId: ${c.data?.publicId || 'none'}`);
      });
      
      // Statistiques globales
      const totalUsers = db.users?.length || 0;
      const totalCockpits = db.cockpits?.length || 0;
      const publishedCockpits = db.cockpits?.filter(c => c.data?.isPublished).length || 0;
      const totalViews = db.cockpits?.reduce((sum, c) => sum + (c.data?.viewCount || 0), 0) || 0;
      
      console.log(`[STATS] Résumé: ${totalUsers} users, ${totalCockpits} cockpits, ${publishedCockpits} publiés, ${totalViews} vues totales`);

      // Statistiques par utilisateur
      const userStats = db.users?.map(user => {
        const userCockpits = db.cockpits?.filter(c => c.userId === user.id) || [];
        const publishedCount = userCockpits.filter(c => c.data?.isPublished).length;
        const userTotalViews = userCockpits.reduce((sum, c) => sum + (c.data?.viewCount || 0), 0);
        
        return {
          userId: user.id,
          userName: user.name || user.username,
          email: user.email,
          cockpitsCount: userCockpits.length,
          publishedCount,
          totalViews: userTotalViews,
        };
      }).sort((a, b) => b.cockpitsCount - a.cockpitsCount) || [];

      // TOUTES les maquettes (publiées ou non) pour le diagnostic
      const allCockpitsStats = db.cockpits
        ?.map(c => {
          const owner = db.users?.find(u => u.id === c.userId);
          // Compter les éléments et sous-éléments
          let elementsCount = 0;
          let subElementsCount = 0;
          (c.data?.domains || []).forEach((d: any) => {
            (d.categories || []).forEach((cat: any) => {
              elementsCount += (cat.elements || []).length;
              (cat.elements || []).forEach((el: any) => {
                (el.subCategories || []).forEach((sc: any) => {
                  subElementsCount += (sc.subElements || []).length;
                });
              });
            });
          });
          return {
            id: c.id,
            name: c.name,
            ownerName: owner?.name || owner?.username || 'Inconnu',
            views: c.data?.viewCount || 0,
            clicks: c.data?.clickCount || 0,
            pagesViewed: c.data?.pagesViewed || 0,
            elementsClicked: c.data?.elementsClicked || 0,
            subElementsClicked: c.data?.subElementsClicked || 0,
            elementsCount,
            subElementsCount,
            publishedAt: c.data?.publishedAt,
            isPublished: c.data?.isPublished || false,
            publicId: c.data?.publicId || null,
          };
        })
        .sort((a, b) => {
          // D'abord les publiés, puis par vues
          if (a.isPublished && !b.isPublished) return -1;
          if (!a.isPublished && b.isPublished) return 1;
          return b.views - a.views;
        }) || [];

      // topCockpits = seulement les publiés pour compatibilité
      const topCockpits = allCockpitsStats.filter(c => c.isPublished).slice(0, 30);

      // Activité récente (basée sur les mises à jour récentes)
      const recentActivity = db.cockpits
        ?.filter(c => c.updatedAt)
        .map(c => {
          const owner = db.users?.find(u => u.id === c.userId);
          const date = new Date(c.updatedAt);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);
          
          let time = '';
          if (diffMins < 1) time = "À l'instant";
          else if (diffMins < 60) time = `il y a ${diffMins} min`;
          else if (diffHours < 24) time = `il y a ${diffHours}h`;
          else time = `il y a ${diffDays}j`;

          return {
            cockpitId: c.id,
            cockpitName: c.name,
            userName: owner?.name || owner?.email || 'Inconnu',
            action: 'a modifié',
            type: 'edit',
            time,
            timestamp: c.updatedAt,
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15) || [];

      // Ajouter les consultations récentes
      const recentViews = db.cockpits
        ?.filter(c => c.data?.lastViewedAt && c.data?.isPublished)
        .map(c => {
          const owner = db.users?.find(u => u.id === c.userId);
          const date = new Date(c.data.lastViewedAt);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);
          
          let time = '';
          if (diffMins < 1) time = "À l'instant";
          else if (diffMins < 60) time = `il y a ${diffMins} min`;
          else if (diffHours < 24) time = `il y a ${diffHours}h`;
          else time = `il y a ${diffDays}j`;

          return {
            cockpitId: c.id,
            cockpitName: c.name,
            userName: 'Visiteur',
            action: 'a consulté',
            type: 'view',
            time,
            timestamp: c.data.lastViewedAt,
          };
        }) || [];

      // Fusionner et trier les activités
      const allActivity = [...recentActivity, ...recentViews]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      return res.json({
        totalUsers,
        totalCockpits,
        publishedCockpits,
        totalViews,
        userStats,
        topCockpits,
        allCockpitsStats, // Toutes les maquettes pour debug
        recentActivity: allActivity,
      });
    }

    // Get System Prompt
    if (path === '/ai/system-prompt' && method === 'GET') {
      const db = await getDb();
      const defaultPrompt = `Le cockpit a pour vocation de remonter à des directeurs des informations synthétiques fiables avec un code couleur strict :
- Rouge : service coupé
- Orange : service en danger  
- Vert : service en fonctionnement

Le cockpit doit aussi montrer les vraies douleurs des managers :
- Argent : suivi budgétaire et financier
- Temps : avoir des informations fiables et visibles sans avoir à les chercher (gain de cerveau disponible)
- Management : suivi visuel de l'avancement des actions réalisées par les équipes
- Tout autre suivi utile au manager pour avoir plus de cerveau disponible et prendre de meilleures décisions

Tu dois aider à créer et modifier des cockpits qui répondent à ces besoins.`;
      return res.json({ prompt: db.systemPrompt || defaultPrompt });
    }

    // Save System Prompt
    if (path === '/ai/system-prompt' && method === 'POST') {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt invalide' });
      }
      const db = await getDb();
      db.systemPrompt = prompt;
      await saveDb(db);
      return res.json({ success: true, prompt });
    }

    // AI Generate Source - Génère les champs d'une source depuis un prompt
    if (path === '/ai/generate-source' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      const { prompt, subElementName } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt requis' });
      }

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Tu es un assistant qui génère des configurations de sources de données pour un cockpit de supervision.
À partir de la description en langage naturel, génère un objet JSON avec les champs suivants:
- name: nom court et descriptif de la source (string)
- type: type de source parmi: excel, csv, json, api, database, email, supervision, hypervision, observability, other (string)
- location: emplacement/chemin/URL de la source (string)
- connection: détails de connexion si applicable (string, optionnel)
- fields: champs à extraire ou règles d'extraction (string)
- description: description de ce que fait cette source (string)

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`
              },
              {
                role: 'user',
                content: `Sous-élément: ${subElementName || 'Non spécifié'}
Description de la source souhaitée: ${prompt}`
              }
            ],
            max_tokens: 1000, // Augmenté pour des suggestions plus détaillées
            temperature: 0.3,
          }),
        });

        if (!openaiResponse.ok) {
          throw new Error('Erreur OpenAI');
        }

        const data = await openaiResponse.json();
        const content = data.choices[0]?.message?.content || '';
        
        // Parser le JSON de la réponse
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return res.json(result);
        }
        
        return res.status(500).json({ error: 'Impossible de parser la réponse IA' });
      } catch (error: any) {
        log.error('[AI Generate Source]', error);
        return res.status(500).json({ error: 'Erreur génération: ' + error.message });
      }
    }

    // AI Generate Calculation - Génère les champs d'un calcul depuis un prompt
    if (path === '/ai/generate-calculation' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      const { prompt, subElementName, availableSources } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt requis' });
      }

      const sourcesInfo = (availableSources || []).map((s: any) => `- ${s.name} (${s.type}, id: ${s.id})`).join('\n');

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Tu es un assistant qui génère des configurations de calculs pour un cockpit de supervision.
À partir de la description en langage naturel, génère un objet JSON avec les champs suivants:
- name: nom court et descriptif du calcul (string)
- description: description métier du calcul (string)
- sources: tableau des IDs des sources utilisées (array de strings)
- definition: définition technique du calcul en JSON (string contenant un objet JSON avec les propriétés: operation, filter, aggregation, formula, etc.)

Les opérations possibles dans definition: sum, avg, count, min, max, percentage, ratio, trend, threshold, custom.
Tu peux utiliser des filtres, des agrégations temporelles, des formules.

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`
              },
              {
                role: 'user',
                content: `Sous-élément: ${subElementName || 'Non spécifié'}
Sources disponibles:
${sourcesInfo || 'Aucune source définie'}

Calcul souhaité: ${prompt}`
              }
            ],
            max_tokens: 1500, // Augmenté pour des définitions de calculs plus complètes
            temperature: 0.3,
          }),
        });

        if (!openaiResponse.ok) {
          throw new Error('Erreur OpenAI');
        }

        const data = await openaiResponse.json();
        const content = data.choices[0]?.message?.content || '';
        
        // Parser le JSON de la réponse
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          // S'assurer que definition est une string JSON
          if (result.definition && typeof result.definition === 'object') {
            result.definition = JSON.stringify(result.definition, null, 2);
          }
          return res.json(result);
        }
        
        return res.status(500).json({ error: 'Impossible de parser la réponse IA' });
      } catch (error: any) {
        log.error('[AI Generate Calculation]', error);
        return res.status(500).json({ error: 'Erreur génération: ' + error.message });
      }
    }

    // Execute Calculation - Exécute un calcul réel sur les données sources
    if (path === '/ai/execute-calculation' && method === 'POST') {
      const { calculation, sources, subElementName, currentValue, currentUnit } = req.body;
      
      // Tableau des étapes d'exécution
      const executionSteps: ExecutionStep[] = [];
      
      // Étape 1: Validation
      executionSteps.push({
        step: 1,
        action: 'validation',
        status: 'running',
        message: 'Validation des paramètres...',
        timestamp: new Date().toISOString(),
      });
      
      if (!calculation) {
        executionSteps[0].status = 'error';
        executionSteps[0].message = 'Calcul non défini';
        return res.status(400).json({ 
          error: 'Calcul requis',
          steps: executionSteps 
        });
      }
      
      executionSteps[0].status = 'success';
      executionSteps[0].message = `Calcul "${calculation.name || 'Sans nom'}" validé`;
      executionSteps[0].details = { 
        calculationName: calculation.name,
        sourcesCount: (sources || []).length 
      };

      try {
        // Étape 2: Récupération des sources
        executionSteps.push({
          step: 2,
          action: 'fetch_sources',
          status: 'running',
          message: `Récupération de ${(sources || []).length} source(s)...`,
          timestamp: new Date().toISOString(),
        });
        
        const sourceData: Record<string, any> = {};
        const sourceSteps: ExecutionStep[] = [];

        for (const source of (sources || [])) {
          const data = await fetchSourceData(source, sourceSteps);
          if (data !== null) {
            sourceData[source.id] = {
              name: source.name,
              type: source.type,
              data: data,
            };
          }
        }
        
        // Ajouter les sous-étapes des sources
        executionSteps.push(...sourceSteps);
        
        // Mettre à jour l'étape de récupération
        const successSources = sourceSteps.filter(s => s.status === 'success').length;
        executionSteps[1].status = successSources > 0 ? 'success' : 'error';
        executionSteps[1].message = `${successSources}/${(sources || []).length} source(s) récupérée(s)`;
        executionSteps[1].details = { successSources, totalSources: (sources || []).length };

        // Étape 3: Parsing de la définition
        const parseStepIndex = executionSteps.length;
        executionSteps.push({
          step: parseStepIndex + 1,
          action: 'parse_definition',
          status: 'running',
          message: 'Analyse de la définition du calcul...',
          timestamp: new Date().toISOString(),
        });
        
        let calculationDef: any = {};
        try {
          if (calculation.definition && calculation.definition.trim().startsWith('{')) {
            calculationDef = JSON.parse(calculation.definition);
            executionSteps[parseStepIndex].status = 'success';
            executionSteps[parseStepIndex].message = 'Définition JSON parsée';
            executionSteps[parseStepIndex].details = { format: 'json', operation: calculationDef.operation };
          } else {
            calculationDef = { formula: calculation.definition || 'count', operation: 'custom' };
            executionSteps[parseStepIndex].status = 'success';
            executionSteps[parseStepIndex].message = 'Formule texte détectée';
            executionSteps[parseStepIndex].details = { format: 'formula', formula: calculation.definition };
          }
        } catch (e) {
          calculationDef = { formula: calculation.definition || 'count', operation: 'custom' };
          executionSteps[parseStepIndex].status = 'success';
          executionSteps[parseStepIndex].message = 'Formule texte utilisée (JSON invalide)';
        }

        // Étape 4: Exécution du calcul
        const execStepIndex = executionSteps.length;
        executionSteps.push({
          step: execStepIndex + 1,
          action: 'execute',
          status: 'running',
          message: 'Exécution du calcul...',
          details: { operation: calculationDef.operation || 'count' },
          timestamp: new Date().toISOString(),
        });
        
        const result = executeCalculation(calculationDef, sourceData, {
          subElementName,
          currentValue,
          currentUnit,
        }, executionSteps);
        
        executionSteps[execStepIndex].status = 'success';
        executionSteps[execStepIndex].message = `Calcul terminé: ${result.value} ${result.unit || ''}`;
        executionSteps[execStepIndex].details = { 
          ...executionSteps[execStepIndex].details,
          result: result.value,
          unit: result.unit 
        };

        // Retourner le résultat avec les étapes
        return res.json({
          ...result,
          steps: executionSteps,
        });

      } catch (error: any) {
        log.error('[Execute Calculation]', error);
        
        // Ajouter l'étape d'erreur
        executionSteps.push({
          step: executionSteps.length + 1,
          action: 'error',
          status: 'error',
          message: `Erreur: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
        
        // En cas d'erreur, essayer avec l'IA comme fallback
        if (OPENAI_API_KEY) {
          executionSteps.push({
            step: executionSteps.length + 1,
            action: 'ai_fallback',
            status: 'running',
            message: 'Tentative de calcul assisté par IA...',
            timestamp: new Date().toISOString(),
          });
          
          try {
            const aiResult = await executeCalculationWithAI(
              calculation, 
              sources, 
              subElementName, 
              currentValue, 
              currentUnit,
              OPENAI_API_KEY
            );
            
            executionSteps[executionSteps.length - 1].status = 'success';
            executionSteps[executionSteps.length - 1].message = 'Calcul assisté par IA réussi';
            
            return res.json({ ...aiResult, mode: 'ai-assisted', steps: executionSteps });
          } catch (aiError: any) {
            executionSteps[executionSteps.length - 1].status = 'error';
            executionSteps[executionSteps.length - 1].message = `IA échouée: ${aiError.message}`;
            return res.status(500).json({ 
              error: 'Erreur exécution: ' + error.message,
              steps: executionSteps 
            });
          }
        }
        
        return res.status(500).json({ 
          error: 'Erreur exécution: ' + error.message,
          steps: executionSteps 
        });
      }
    }

    // AI Chat
    if (path === '/ai/chat' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      const { message, cockpitContext, history, hasImage, imageBase64, imageMimeType } = req.body;

      // === MODE CAPACITÉ MAXIMALE ===
      // Utiliser le contexte COMPLET sans compression pour maximiser les capacités de l'IA
      // gpt-4o supporte 128K tokens en entrée - on utilise tout l'espace disponible
      
      // Log de diagnostic
      const contextSize = JSON.stringify(cockpitContext || {}).length;
      const historySize = (history || []).length;
      console.log(`[AI] Mode CAPACITÉ MAXIMALE - Contexte: ${contextSize} chars, Historique: ${historySize} messages`);


      // Récupérer le prompt système personnalisé depuis la base de données
      // IMPORTANT: Ce prompt personnalisé est TOUJOURS la première instruction donnée à l'IA
      const db = await getDb();
      const customSystemPrompt = db.systemPrompt || `Le cockpit a pour vocation de remonter à des directeurs des informations synthétiques fiables avec un code couleur strict :
- Rouge : service coupé
- Orange : service en danger  
- Vert : service en fonctionnement

Le cockpit doit aussi montrer les vraies douleurs des managers :
- Argent : suivi budgétaire et financier
- Temps : avoir des informations fiables et visibles sans avoir à les chercher (gain de cerveau disponible)
- Management : suivi visuel de l'avancement des actions réalisées par les équipes
- Tout autre suivi utile au manager pour avoir plus de cerveau disponible et prendre de meilleures décisions

Tu dois aider à créer et modifier des cockpits qui répondent à ces besoins.`;

      // Construire le prompt système: PROMPT PERSONNALISÉ EN PREMIER, puis instructions techniques
      const systemPrompt = `${customSystemPrompt}

=== INSTRUCTIONS TECHNIQUES ===

Tu es un assistant IA pour SOMONE Cockpit Studio, une application de création de tableaux de bord visuels.

STRUCTURE DU COCKPIT:
- Cockpit contient des Domaines (onglets principaux, max 6)
- Domaines contiennent des Catégories (groupes d'éléments)
- Catégories contiennent des Éléments (tuiles avec statut coloré)
- Éléments contiennent des Sous-catégories
- Sous-catégories contiennent des Sous-éléments

STATUTS DISPONIBLES: 
- ok (vert) : service en fonctionnement normal
- mineur (orange) : service en danger
- critique (rouge) : service en danger critique
- fatal (rouge foncé/violet) : service coupé
- deconnecte (gris) : élément déconnecté

STRUCTURE COMPLÃˆTE:
- Cockpit contient des Domaines (onglets principaux, max 6)
- Domaines contiennent des Catégories (groupes d'éléments)
- Catégories contiennent des Éléments (tuiles avec statut coloré)
- Éléments contiennent des Sous-catégories
- Sous-catégories contiennent des Sous-éléments
- Sous-éléments peuvent avoir des Sources de données et des Calculs associés

SOURCES DE DONNÉES:
Les sous-éléments peuvent avoir des sources de données pour se connecter à :
- Excel, CSV, JSON
- APIs externes
- Bases de données
- E-mails
- Outils de supervision, hypervision, observabilité

CALCULS:
Les sous-éléments peuvent avoir des calculs déclaratifs (JSON/YAML/DSL) qui :
- Combinent plusieurs sources
- Réalisent des opérations, filtres, agrégations, transformations
- Produisent des résultats affichés dans le cockpit

TU PEUX CRÉER DES COCKPITS:
- Depuis des exemples non structurés (texte libre)
- Depuis des fichiers (Excel, CSV, JSON, documents)
- Depuis des idées ou besoins exprimés en langage naturel
- En analysant et structurant l'information fournie

ACTIONS DISPONIBLES (retourne-les dans le champ "actions"):
- addDomain: { name: string }
- deleteDomain: { domainId?: string, name?: string }
            - updateDomain: { domainId?: string, name?: string, updates: { name?, templateType?, templateName?, backgroundImage?, backgroundMode?, backgroundDarkness?, mapBounds?, enableClustering? } }
- addCategory: { domainId?: string, domainName?: string, name: string, orientation?: 'horizontal'|'vertical' }
- updateCategory: { categoryId?: string, name?: string, updates: { name?, orientation?, icon? } }
- deleteCategory: { categoryId?: string, name?: string }
- addElement: { categoryId?: string, categoryName?: string, name: string }
- addElements: { categoryId?: string, categoryName?: string, names: string[] }
- deleteElement: { elementId?: string, name?: string }
- updateElement: { elementId?: string, name?: string, updates: { status?, value?, unit?, icon?, icon2?, icon3?, name? } }
- updateStatus: { elementId?: string, elementName?: string, subElementId?: string, subElementName?: string, status: string }
- cloneElement: { elementId?: string, name?: string }
- addSubCategory: { elementId?: string, name: string, orientation?: 'horizontal'|'vertical' }
- updateSubCategory: { subCategoryId?: string, name?: string, updates: { name?, orientation? } }
- deleteSubCategory: { subCategoryId?: string, name?: string }
- addSubElement: { subCategoryId?: string, subCategoryName?: string, name: string }
- addSubElements: { subCategoryId?: string, subCategoryName?: string, names: string[] }
- deleteSubElement: { subElementId?: string, name?: string }
- updateSubElement: { subElementId?: string, updates: { status?, value?, unit?, name? } }
- addDataSource: { subElementId?: string, subElementName?: string, name: string, type: 'excel'|'csv'|'json'|'api'|'database'|'email'|'supervision'|'hypervision'|'observability'|'other', location?: string, connection?: string, fields?: string, description?: string }
- updateDataSource: { subElementId?: string, subElementName?: string, dataSourceId?: string, updates: { name?, type?, location?, connection?, fields?, description? } }
- deleteDataSource: { subElementId?: string, subElementName?: string, dataSourceId?: string }
- addCalculation: { subElementId?: string, subElementName?: string, name: string, description?: string, definition: string, sources?: string[] }
- updateCalculation: { subElementId?: string, subElementName?: string, calculationId?: string, updates: { name?, description?, definition?, sources? } }
- deleteCalculation: { subElementId?: string, subElementName?: string, calculationId?: string }
- createCockpit: { name: string, description?: string, fromExample?: string, fromFile?: { type: string, content: string } }
- addZone: { name: string }
- deleteZone: { zoneId?: string, name?: string }
- addMapElement: { domainId?: string, domainName?: string, name: string, lat: number, lng: number, status?: string, icon?: string }
- updateMapElement: { mapElementId?: string, name?: string, updates: { name?, gps?, status?, icon? } }
- deleteMapElement: { mapElementId?: string, name?: string }
- cloneMapElement: { mapElementId?: string, name?: string }
- updateMapBounds: { domainId?: string, domainName?: string, topLeft: { lat: number, lng: number }, bottomRight: { lat: number, lng: number } }
- selectDomain: { domainId?: string, name?: string }
- selectElement: { elementId?: string, name?: string }

CONTEXTE COMPLET DU COCKPIT:
${JSON.stringify(cockpitContext, null, 2)}

INSTRUCTIONS IMPORTANTES:
1. Réponds en français de manière concise et professionnelle
2. Si l'utilisateur demande une modification, tu DOIS retourner les actions dans un format JSON strict
3. Format de réponse OBLIGATOIRE si tu exécutes des actions:
   {
     "message": "Description textuelle de ce que tu as fait",
     "actions": [
       { "type": "actionType", "params": { ... } }
     ]
   }
4. CRÉATION EN MASSE: Tu peux créer PLUSIEURS éléments, catégories, sous-catégories, sous-éléments en une seule réponse :
   - Utilise addElements avec un tableau de noms pour créer plusieurs éléments d'un coup
   - Utilise addSubElements avec un tableau de noms pour créer plusieurs sous-éléments d'un coup
   - Tu peux combiner plusieurs actions différentes dans le même tableau "actions"
   - Exemple : créer un domaine, puis plusieurs catégories, puis plusieurs éléments dans chaque catégorie, tout en une seule réponse
5. CRÉATION SÉQUENTIELLE IMPORTANTE: 
   - Les actions sont exécutées SÉQUENTIELLEMENT dans l'ordre du tableau
   - Quand tu crées une catégorie avec addCategory, tu peux IMMÉDIATEMENT utiliser son NOM dans les actions suivantes avec addElement ou addElements
   - Exemple: [{"type":"addCategory","params":{"name":"Production","domainId":"..."}}, {"type":"addElements","params":{"categoryName":"Production","names":["Élément1","Élément2"]}}]
   - Même principe pour sous-catégories et sous-éléments : utilise le NOM de la sous-catégorie créée dans addSubElement/addSubElements
   - Les IDs sont automatiquement résolus depuis les noms dans l'ordre d'exécution
6. Utilise les IDs existants quand disponibles, sinon utilise les NOMS (qui seront résolus automatiquement)
7. OPÉRATIONS MULTIPLES: Si l'utilisateur demande de créer un cockpit complet, n'hésite pas à créer :
   - Plusieurs domaines (max 6)
   - Plusieurs catégories par domaine (en utilisant domainName si nécessaire)
   - Plusieurs éléments par catégorie (en utilisant categoryName, les IDs sont résolus automatiquement)
   - Plusieurs sous-catégories par élément (en utilisant elementName si nécessaire)
   - Plusieurs sous-éléments par sous-catégorie (en utilisant subCategoryName, les IDs sont résolus automatiquement)
   - Des sources de données et calculs associés
   Tout cela peut être fait en une seule réponse avec un grand tableau d'actions
8. IMPORTANT: Retourne TOUJOURS les actions dans un bloc JSON avec backticks ou directement comme objet JSON valide
9. PAS DE LIMITE: Tu peux retourner autant d'actions que nécessaire (50, 100, 200+ actions si nécessaire)
10. EFFICACITÉ: Privilégie les actions groupées plutôt que plusieurs réponses séquentielles
11. STRUCTURE COMPLÃˆTE: Quand on te demande de créer un cockpit, crée une structure complète et fonctionnelle avec tous les éléments nécessaires

ANALYSE D'IMAGES ET OCR:
- Si une image est attachée, analyse-la visuellement
- Fais de l'OCR (reconnaissance de caractères) pour extraire tout le texte visible dans l'image
- Extrais les tableaux, graphiques, diagrammes, et toute information structurée
- Utilise ces informations extraites pour créer ou modifier des cockpits
- Tu peux créer des domaines, catégories, éléments basés sur le contenu de l'image

COMPORTEMENT INTELLIGENT ET CLARIFICATION:
1. Si une instruction est AMBIGUÃ‹ ou INCOMPLÃˆTE, pose des questions de clarification AVANT d'agir
2. Questions à poser si nécessaire :
   - "Voulez-vous que je crée cela dans un domaine existant ou un nouveau domaine ?"
   - "Quel statut souhaitez-vous pour ces éléments (ok, mineur, critique, fatal) ?"
   - "Pouvez-vous préciser la structure souhaitée (nombre de catégories, d'éléments) ?"
   - "Voulez-vous que j'ajoute des sous-catégories et sous-éléments ?"
3. Si l'instruction est CLAIRE, exécute-la directement sans poser de questions
4. Sois PROACTIF : propose des améliorations ou des ajouts pertinents
5. Tu SAIS TOUT FAIRE dans le studio :
   - Créer, modifier, supprimer des domaines, catégories, éléments, sous-catégories, sous-éléments
   - Configurer des cartes avec points GPS
   - Définir des sources de données et des calculs
   - Analyser des images et des fichiers pour créer des cockpits
   - Réorganiser la structure complète d'un cockpit
6. SOIS EXPERT : tu connais parfaitement le système et tu peux tout expliquer à l'utilisateur`;

      // Construire les messages avec support multi-modal pour les images
      // Le prompt système contient le prompt personnalisé EN PREMIER, suivi des instructions techniques
      console.log('[AI] âœ… Prompt personnalisé récupéré depuis la base de données');
      console.log('[AI] Longueur du prompt système complet:', systemPrompt.length);
      console.log('[AI] Prompt personnalisé (premiers 300 caractères):', customSystemPrompt.substring(0, 300));

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
      ];

      // Si une image est attachée, utiliser le format multi-modal
      if (hasImage && imageBase64) {
        // Nettoyer le base64 : enlever les espaces, retours à la ligne, etc.
        let cleanBase64 = String(imageBase64).trim().replace(/\s+/g, '');

        // Si le base64 contient encore le préfixe data:, l'extraire complètement
        if (cleanBase64.includes('data:')) {
          const base64Match = cleanBase64.match(/data:[^;]+;base64,([\s\S]*)/);
          if (base64Match && base64Match[1]) {
            cleanBase64 = base64Match[1].trim().replace(/\s+/g, '');
          } else if (cleanBase64.includes('base64,')) {
            cleanBase64 = cleanBase64.split('base64,')[1].trim().replace(/\s+/g, '');
          } else if (cleanBase64.includes(',')) {
            cleanBase64 = cleanBase64.split(',')[1].trim().replace(/\s+/g, '');
          }
        }

        // Utiliser le type MIME fourni ou détecter depuis le message
        let mimeType = imageMimeType || 'image/png';
        if (!mimeType && typeof message === 'string') {
          if (message.includes('Format: PNG') || message.match(/\.png/i)) {
            mimeType = 'image/png';
          } else if (message.includes('Format: JPEG') || message.includes('Format: JPG') || message.match(/\.jpe?g/i)) {
            mimeType = 'image/jpeg';
          } else if (message.includes('Format: GIF') || message.match(/\.gif/i)) {
            mimeType = 'image/gif';
          } else if (message.includes('Format: WEBP') || message.match(/\.webp/i)) {
            mimeType = 'image/webp';
          } else {
            mimeType = 'image/png'; // Par défaut
          }
        }

        // Vérifier que le base64 est valide (ne contient que des caractères base64 valides)
        if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
          console.error('[AI] Base64 invalide détecté, nettoyage supplémentaire...');
          console.error('[AI] Base64 (premiers 100 caractères):', cleanBase64.substring(0, 100));
          console.error('[AI] Base64 (derniers 100 caractères):', cleanBase64.substring(Math.max(0, cleanBase64.length - 100)));
          // Nettoyer encore plus agressivement
          const beforeLength = cleanBase64.length;
          cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '');
          console.error('[AI] Base64 nettoyé: ' + beforeLength + ' -> ' + cleanBase64.length + ' caractères');
        }

        // Valider la longueur minimale du base64 (une image devrait avoir au moins quelques centaines de caractères)
        if (cleanBase64.length < 100) {
          console.error('[AI] ERREUR: Base64 trop court (' + cleanBase64.length + ' caractères), erreur d\'extraction probable');
          console.error('[AI] Base64 reçu (complet):', cleanBase64);
          return res.status(400).json({ error: 'Base64 image invalide ou trop court. Extraction échouée.' });
        }

        console.log('[AI] âœ… Base64 valide: ' + cleanBase64.length + ' caractères, MIME type: ' + mimeType);
        console.log('[AI] Base64 (premiers 50 caractères):', cleanBase64.substring(0, 50));

        // Construire l'URL avec le format correct pour OpenAI
        // IMPORTANT: Le format doit être exactement "data:{mimeType};base64,{base64}"
        const imageUrl = `data:${mimeType};base64,${cleanBase64}`;

        console.log('[AI] Image URL construite - Longueur totale:', imageUrl.length);
        console.log('[AI] Image URL (début):', imageUrl.substring(0, 100));
        console.log('[AI] Image URL (fin):', imageUrl.substring(Math.max(0, imageUrl.length - 100)));

        // Valider que l'URL commence bien par "data:"
        if (!imageUrl.startsWith('data:')) {
          console.error('[AI] ERREUR: L\'URL ne commence pas par "data:"');
          return res.status(400).json({ error: 'Format d\'URL image invalide' });
        }

        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: message || 'Analyse cette image et fais de l\'OCR si elle contient du texte. Extrais toutes les informations pertinentes (tableaux, graphiques, texte). Utilise ces informations pour créer ou modifier un cockpit si demandé.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        });
      } else {
        messages.push({ role: 'user', content: message });
      }

      // Utiliser gpt-4o pour une meilleure capacité (128K tokens contexte)
      // gpt-4o offre de meilleures performances pour les gros cockpits et les images
      const model = 'gpt-4o';

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            // CAPACITÉ MAXIMALE: gpt-4o supporte 128K tokens en entrée et 16K en sortie
            // max_tokens définit la taille max de la réponse (16384 = maximum pour gpt-4o)
            max_tokens: 16384,
          }),
        });

        if (!openaiResponse.ok) {
          let errorMessage = 'Erreur OpenAI inconnue';
          let errorCode = '';
          try {
            const errorText = await openaiResponse.text();
            console.error('[AI] OpenAI error response (raw):', errorText.substring(0, 500));

            try {
              const error = JSON.parse(errorText);
              errorMessage = error.error?.message || error.message || errorText.substring(0, 200);
              errorCode = error.error?.code || '';
            } catch (parseError) {
              // Si ce n'est pas du JSON, utiliser le texte brut
              errorMessage = errorText.substring(0, 200) || 'Erreur OpenAI inconnue';
            }
          } catch (textError) {
            console.error('[AI] Impossible de lire la réponse d\'erreur OpenAI:', textError);
            errorMessage = `Erreur HTTP ${openaiResponse.status}: ${openaiResponse.statusText}`;
          }

          // Gérer les erreurs de capacité spécifiquement
          if (errorMessage.includes('context_length_exceeded') || errorMessage.includes('maximum context length') || errorCode === 'context_length_exceeded') {
            console.error('[AI] Erreur de capacité détectée - contexte trop long');
            return res.status(413).json({ 
              error: 'Le cockpit est trop volumineux pour être traité en une seule requête. Essayez de :\n• Sélectionner un domaine spécifique avant de faire votre demande\n• Simplifier votre demande\n• Diviser votre demande en plusieurs étapes',
              code: 'CONTEXT_TOO_LARGE'
            });
          }

          // Gérer les erreurs de rate limit
          if (errorMessage.includes('rate_limit') || errorCode === 'rate_limit_exceeded') {
            console.error('[AI] Rate limit atteint');
            return res.status(429).json({ 
              error: 'Limite de requêtes atteinte. Veuillez patienter quelques secondes et réessayer.',
              code: 'RATE_LIMIT'
            });
          }

          console.error('[AI] Erreur OpenAI finale:', errorMessage);
          return res.status(500).json({ error: 'Erreur OpenAI: ' + errorMessage });
        }

        let data;
        let responseText;
        try {
          responseText = await openaiResponse.text();
          console.log('[AI] OpenAI response length:', responseText.length);
          data = JSON.parse(responseText);
        } catch (parseError: any) {
          console.error('[AI] Erreur parsing réponse OpenAI:', parseError?.message);
          console.error('[AI] Réponse (premiers 500 caractères):', responseText?.substring(0, 500));
          return res.status(500).json({ error: 'Erreur: Réponse OpenAI invalide (non-JSON). Vérifiez les logs serveur.' });
        }

        const assistantMessage = data.choices[0]?.message?.content || '';

        // Essayer d'extraire les actions du message avec retry et parsing robuste
        // Support pour de très gros tableaux d'actions (100+ actions)
        let actions: any[] = [];
        const parseActionsWithRetry = (text: string, maxAttempts = 5): any[] => {
          console.log('[AI] Parsing actions - Longueur du texte:', text.length);
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              // Tentative 1: Chercher un bloc JSON avec backticks (multiligne pour gérer gros JSON)
              let jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/s);
              if (!jsonMatch) {
                // Tentative 2: Chercher un bloc code avec json
                jsonMatch = text.match(/```\n?([\s\S]*?)\n?```/);
                if (jsonMatch) {
                  const content = jsonMatch[1].trim();
                  if (content.startsWith('{') || content.startsWith('[')) {
                    const parsed = JSON.parse(content);
                    if (parsed.actions && Array.isArray(parsed.actions)) {
                      return parsed.actions;
                    }
                  }
                }
              } else {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.actions && Array.isArray(parsed.actions)) {
                  return parsed.actions;
                }
              }

              // Tentative 3: Chercher un objet JSON direct (multiligne pour gérer gros JSON)
              const directMatch = text.match(/\{[\s\S]*?"actions"[\s\S]*?\}/s);
              if (directMatch) {
                try {
                  const parsed = JSON.parse(directMatch[0]);
                  if (parsed.actions && Array.isArray(parsed.actions)) {
                    console.log(`[AI] âœ… ${parsed.actions.length} action(s) extraite(s) via tentative 3`);
                    return parsed.actions;
                  }
                } catch (e) {
                  // Essayer de nettoyer le JSON
                  let cleaned = directMatch[0]
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']')
                    .replace(/'/g, '"')
                    .replace(/,\s*,/g, ',') // Enlever les virgules doubles
                    .replace(/{\s*,/g, '{') // Enlever les virgules après {
                    .replace(/\[\s*,/g, '['); // Enlever les virgules après [
                  try {
                    const parsed = JSON.parse(cleaned);
                    if (parsed.actions && Array.isArray(parsed.actions)) {
                      console.log(`[AI] âœ… ${parsed.actions.length} action(s) extraite(s) via tentative 3 (nettoyé)`);
                      return parsed.actions;
                    }
                  } catch (e2) {
                    console.error('[AI] Échec parsing nettoyé tentative 3:', e2);
                  }
                }
              }

              // Tentative 3b: Chercher directement un tableau d'actions très grand
              const actionsArrayMatch = text.match(/"actions"\s*:\s*\[\s*([\s\S]*?)\s*\]/s);
              if (actionsArrayMatch) {
                try {
                  const actionsArray = JSON.parse(`[${actionsArrayMatch[1]}]`);
                  if (Array.isArray(actionsArray) && actionsArray.length > 0) {
                    console.log(`[AI] âœ… ${actionsArray.length} action(s) extraite(s) via tentative 3b (tableau direct)`);
                    return actionsArray;
                  }
                } catch (e3) {
                  // Ignorer
                }
              }

              // Tentative 4: Si le texte commence par {, essayer de parser tout
              const trimmed = text.trim();
              if (trimmed.startsWith('{')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (parsed.actions && Array.isArray(parsed.actions)) {
                    return parsed.actions;
                  }
                } catch (e) {
                  // Essayer de trouver le dernier objet JSON valide
                  let lastValidJson = '';
                  let braceCount = 0;
                  let startIdx = -1;
                  for (let i = 0; i < trimmed.length; i++) {
                    if (trimmed[i] === '{') {
                      if (startIdx === -1) startIdx = i;
                      braceCount++;
                    } else if (trimmed[i] === '}') {
                      braceCount--;
                      if (braceCount === 0 && startIdx !== -1) {
                        lastValidJson = trimmed.substring(startIdx, i + 1);
                        try {
                          const parsed = JSON.parse(lastValidJson);
                          if (parsed.actions && Array.isArray(parsed.actions)) {
                            return parsed.actions;
                          }
                        } catch (e2) {
                          // Ignorer
                        }
                        startIdx = -1;
                      }
                    }
                  }
                }
              }
            } catch (e) {
              if (attempt === maxAttempts - 1) {
                console.warn('[AI] Erreur parsing actions après', maxAttempts, 'tentatives:', e);
              }
            }
          }
          return [];
        };

        actions = parseActionsWithRetry(assistantMessage);

        if (actions.length > 0) {
          console.log(`[AI] âœ… ${actions.length} action(s) extraite(s) avec succès`);
          if (actions.length > 20) {
            console.log(`[AI] âš ï¸ Nombre élevé d'actions (${actions.length}), traitement en cours...`);
          }
        } else {
          console.log('[AI] âš ï¸ Aucune action trouvée dans la réponse');
          console.log('[AI] Extrait de la réponse (premiers 500 caractères):', assistantMessage.substring(0, 500));
        }

        // Nettoyer le message des blocs JSON
        let cleanMessage = assistantMessage
          .replace(/```json\n?[\s\S]*?\n?```/g, '')
          .replace(/\{[\s\S]*"actions"[\s\S]*\}/g, '')
          .trim();

        return res.json({
          message: cleanMessage || assistantMessage,
          actions
        });

      } catch (error: any) {
        console.error('AI Chat error:', error);
        return res.status(500).json({ error: 'Erreur serveur IA: ' + error.message });
      }
    }

    // AI Analyze Map
    if (path === '/ai/analyze-map' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      const { imageUrl, imageBase64 } = req.body;

      const imageContent = imageBase64
        ? { type: 'image_url', image_url: { url: imageBase64 } }
        : { type: 'image_url', image_url: { url: imageUrl } };

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `Tu es un expert en géographie et cartographie. Analyse cette image de carte et détermine les coordonnées GPS des coins de l'image.

Réponds UNIQUEMENT avec un JSON valide de ce format:
{
  "detected": true/false,
  "region": "Nom de la région/pays",
  "confidence": "high/medium/low",
  "description": "Description courte",
  "topLeft": { "lat": number, "lng": number },
  "bottomRight": { "lat": number, "lng": number },
  "reason": "Explication si non détecté"
}`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Analyse cette carte et donne-moi les coordonnées GPS des coins.' },
                  imageContent
                ]
              }
            ],
            max_tokens: 1000, // Augmenté pour des analyses de cartes plus détaillées
          }),
        });

        if (!openaiResponse.ok) {
          const error = await openaiResponse.json();
          return res.status(500).json({ error: 'Erreur OpenAI Vision: ' + (error.error?.message || 'inconnue') });
        }

        const data = await openaiResponse.json();
        const content = data.choices[0]?.message?.content || '';

        // Parser le JSON de la réponse
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return res.json(result);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }

        return res.json({ detected: false, reason: 'Impossible de parser la réponse' });

      } catch (error: any) {
        console.error('AI Analyze Map error:', error);
        return res.status(500).json({ error: 'Erreur analyse carte: ' + error.message });
      }
    }

    // =====================================================
    // PRESENTATIONS - Configuration et génération
    // =====================================================

    // GET /presentations/musics - Récupérer les musiques de fond disponibles (niveau studio)
    if (path === '/presentations/musics' && method === 'GET') {
      try {
        const musicsKey = 'presentation_musics';
        let musics = await redis.get(musicsKey) as any[] || [];
        
        // Si aucune musique, initialiser avec des musiques libres de droits par défaut
        if (musics.length === 0) {
          musics = [
            {
              id: 'corporate-1',
              name: 'Corporate Ambiance',
              url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3',
              duration: 147,
              category: 'corporate',
            },
            {
              id: 'ambient-1',
              name: 'Calm Technology',
              url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1c44.mp3',
              duration: 120,
              category: 'ambient',
            },
            {
              id: 'upbeat-1',
              name: 'Inspiring Success',
              url: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_c8e7b0f0b3.mp3',
              duration: 130,
              category: 'upbeat',
            },
            {
              id: 'calm-1',
              name: 'Soft Piano',
              url: 'https://cdn.pixabay.com/download/audio/2021/11/13/audio_cb4b9c6fd2.mp3',
              duration: 156,
              category: 'calm',
            },
          ];
          await redis.set(musicsKey, musics);
        }
        
        return res.json({ musics });
      } catch (error: any) {
        console.error('Erreur chargement musiques:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/musics - Ajouter une nouvelle musique de fond
    if (path === '/presentations/musics' && method === 'POST') {
      const { name, url, duration, category } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ error: 'name et url sont requis' });
      }
      
      try {
        const musicsKey = 'presentation_musics';
        const musics = await redis.get(musicsKey) as any[] || [];
        
        const newMusic = {
          id: crypto.randomUUID(),
          name,
          url,
          duration: duration || 0,
          category: category || 'ambient',
        };
        
        musics.push(newMusic);
        await redis.set(musicsKey, musics);
        
        return res.json({ success: true, music: newMusic });
      } catch (error: any) {
        console.error('Erreur ajout musique:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // DELETE /presentations/musics/:musicId - Supprimer une musique
    if (path.match(/^\/presentations\/musics\/[^/]+$/) && method === 'DELETE') {
      const musicId = path.split('/').pop();
      
      try {
        const musicsKey = 'presentation_musics';
        const musics = await redis.get(musicsKey) as any[] || [];
        
        const filteredMusics = musics.filter((m: any) => m.id !== musicId);
        await redis.set(musicsKey, filteredMusics);
        
        return res.json({ success: true });
      } catch (error: any) {
        console.error('Erreur suppression musique:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/configs/:cockpitId - Récupérer les configurations de présentation d'une maquette
    if (path.match(/^\/presentations\/configs\/[^/]+$/) && method === 'GET') {
      const cockpitId = path.split('/').pop();
      
      try {
        const configsKey = `presentation_configs:${cockpitId}`;
        const configs = await redis.get(configsKey) as any[] || [];
        
        return res.json({ configs });
      } catch (error: any) {
        console.error('Erreur chargement configs présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/configs - Créer une nouvelle configuration de présentation
    if (path === '/presentations/configs' && method === 'POST') {
      const { cockpitId, name, prompt, outputFormats, includeAllDomains, selectedDomainIds, transitionStyle, duration } = req.body;
      
      if (!cockpitId || !name || !prompt) {
        return res.status(400).json({ error: 'cockpitId, name et prompt sont requis' });
      }
      
      try {
        const configsKey = `presentation_configs:${cockpitId}`;
        const existingConfigs = await redis.get(configsKey) as any[] || [];
        
        const newConfig = {
          id: crypto.randomUUID(),
          cockpitId,
          name,
          prompt,
          outputFormats: outputFormats || ['pdf'],
          includeAllDomains: includeAllDomains !== false,
          selectedDomainIds: selectedDomainIds || [],
          transitionStyle: transitionStyle || 'fade',
          duration: duration || 60,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        existingConfigs.push(newConfig);
        await redis.set(configsKey, existingConfigs);
        
        return res.json({ config: newConfig });
      } catch (error: any) {
        console.error('Erreur création config présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // PUT /presentations/configs/:configId - Mettre à jour une configuration de présentation
    if (path.match(/^\/presentations\/configs\/[^/]+$/) && method === 'PUT') {
      const configId = path.split('/').pop();
      const { cockpitId, name, prompt, outputFormats, includeAllDomains, selectedDomainIds, transitionStyle, duration } = req.body;
      
      if (!cockpitId) {
        return res.status(400).json({ error: 'cockpitId est requis' });
      }
      
      try {
        const configsKey = `presentation_configs:${cockpitId}`;
        const existingConfigs = await redis.get(configsKey) as any[] || [];
        
        const configIndex = existingConfigs.findIndex((c: any) => c.id === configId);
        if (configIndex === -1) {
          return res.status(404).json({ error: 'Configuration non trouvée' });
        }
        
        existingConfigs[configIndex] = {
          ...existingConfigs[configIndex],
          name: name || existingConfigs[configIndex].name,
          prompt: prompt || existingConfigs[configIndex].prompt,
          outputFormats: outputFormats || existingConfigs[configIndex].outputFormats,
          includeAllDomains: includeAllDomains !== undefined ? includeAllDomains : existingConfigs[configIndex].includeAllDomains,
          selectedDomainIds: selectedDomainIds || existingConfigs[configIndex].selectedDomainIds,
          transitionStyle: transitionStyle || existingConfigs[configIndex].transitionStyle,
          duration: duration || existingConfigs[configIndex].duration,
          updatedAt: new Date().toISOString(),
        };
        
        await redis.set(configsKey, existingConfigs);
        
        return res.json({ config: existingConfigs[configIndex] });
      } catch (error: any) {
        console.error('Erreur mise à jour config présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // DELETE /presentations/configs/:configId - Supprimer une configuration de présentation
    if (path.match(/^\/presentations\/configs\/[^/]+$/) && method === 'DELETE') {
      const configId = path.split('/').pop();
      const { cockpitId } = req.query as { cockpitId?: string };
      
      // Récupérer cockpitId depuis le body si pas en query
      const actualCockpitId = cockpitId || req.body?.cockpitId;
      
      if (!actualCockpitId) {
        // Chercher dans toutes les maquettes (plus lent mais fonctionne)
        try {
          const allKeys = await redis.keys('presentation_configs:*');
          for (const key of allKeys) {
            const configs = await redis.get(key) as any[] || [];
            const configIndex = configs.findIndex((c: any) => c.id === configId);
            if (configIndex !== -1) {
              configs.splice(configIndex, 1);
              await redis.set(key, configs);
              return res.json({ success: true });
            }
          }
          return res.status(404).json({ error: 'Configuration non trouvée' });
        } catch (error: any) {
          console.error('Erreur suppression config présentation:', error);
          return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
        }
      }
      
      try {
        const configsKey = `presentation_configs:${actualCockpitId}`;
        const existingConfigs = await redis.get(configsKey) as any[] || [];
        
        const configIndex = existingConfigs.findIndex((c: any) => c.id === configId);
        if (configIndex === -1) {
          return res.status(404).json({ error: 'Configuration non trouvée' });
        }
        
        existingConfigs.splice(configIndex, 1);
        await redis.set(configsKey, existingConfigs);
        
        return res.json({ success: true });
      } catch (error: any) {
        console.error('Erreur suppression config présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/images - Sauvegarder une image capturée dans la banque d'images
    // Avec déduplication intelligente basée sur le hash perceptuel
    if (path === '/presentations/images' && method === 'POST') {
      const { cockpitId, image, includeBase64 } = req.body;
      
      if (!cockpitId || !image) {
        return res.status(400).json({ error: 'cockpitId et image sont requis' });
      }
      
      try {
        const imagesKey = `presentation_images:${cockpitId}`;
        const existingImages = await redis.get(imagesKey) as any[] || [];
        
        // DÉDUPLICATION: Vérifier si une image similaire existe déjà (même hash ou même domaine/élément)
        let isDuplicate = false;
        let duplicateId = null;
        
        if (image.hash) {
          // Vérifier par hash perceptuel (images visuellement identiques)
          const similarImage = existingImages.find((img: any) => img.hash === image.hash);
          if (similarImage) {
            isDuplicate = true;
            duplicateId = similarImage.id;
            console.log(`[Images] Doublon détecté par hash: ${image.hash} -> ${similarImage.id}`);
          }
        }
        
        // Vérifier aussi par domaine+élément (même vue)
        if (!isDuplicate && image.domainId) {
          const sameView = existingImages.find((img: any) => 
            img.domainId === image.domainId && 
            img.elementId === image.elementId &&
            // Moins de 5 minutes d'écart = probablement la même vue
            Math.abs(new Date(img.timestamp).getTime() - new Date(image.timestamp).getTime()) < 300000
          );
          if (sameView) {
            // Comparer la qualité: garder la meilleure
            const existingSize = sameView.width * sameView.height;
            const newSize = image.width * image.height;
            if (newSize > existingSize) {
              // La nouvelle image est de meilleure qualité, remplacer
              console.log(`[Images] Remplacement par image de meilleure qualité: ${newSize} > ${existingSize}`);
              // Supprimer l'ancienne
              const idx = existingImages.findIndex((img: any) => img.id === sameView.id);
              if (idx >= 0) {
                existingImages.splice(idx, 1);
                await redis.del(`presentation_image_data:${cockpitId}:${sameView.id}`);
              }
            } else {
              isDuplicate = true;
              duplicateId = sameView.id;
              console.log(`[Images] Image de même vue ignorée (qualité inférieure)`);
            }
          }
        }
        
        if (isDuplicate) {
          return res.json({ 
            success: true, 
            imageId: duplicateId, 
            isDuplicate: true,
            message: 'Image similaire déjà existante'
          });
        }
        
        // Limiter à 100 images par maquette pour éviter la surcharge
        if (existingImages.length >= 100) {
          // Supprimer les plus anciennes (métadonnées et données)
          const oldestImage = existingImages.shift();
          if (oldestImage?.id) {
            await redis.del(`presentation_image_data:${cockpitId}:${oldestImage.id}`);
          }
        }
        
        // Calculer un score de qualité basé sur la taille
        const qualityScore = Math.min(100, Math.round((image.width * image.height) / (1920 * 1080) * 50) + 50);
        
        // Sauvegarder les métadonnées enrichies
        existingImages.push({
          id: image.id,
          filename: image.filename,
          timestamp: image.timestamp,
          description: image.description,
          domainId: image.domainId,
          elementId: image.elementId,
          width: image.width,
          height: image.height,
          hash: image.hash, // Hash perceptuel pour déduplication
          quality: qualityScore, // Score de qualité
          hasBase64: !!image.base64Data,
        });
        
        await redis.set(imagesKey, existingImages);
        
        // Stocker les données base64 (expire après 14 jours maintenant)
        if (image.base64Data && includeBase64 !== false) {
          const dataKey = `presentation_image_data:${cockpitId}:${image.id}`;
          await redis.set(dataKey, image.base64Data, { ex: 1209600 }); // 14 jours
        }
        
        console.log(`[Images] Nouvelle image: ${image.id} (${image.width}x${image.height}, qualité=${qualityScore})`);
        
        return res.json({ success: true, imageId: image.id, quality: qualityScore });
      } catch (error: any) {
        console.error('Erreur sauvegarde image présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/images/:cockpitId - Récupérer la banque d'images d'une maquette
    if (path.match(/^\/presentations\/images\/[^/]+$/) && method === 'GET') {
      const cockpitId = path.split('/').pop();
      
      try {
        const imagesKey = `presentation_images:${cockpitId}`;
        const images = await redis.get(imagesKey) as any[] || [];
        
        return res.json({ images });
      } catch (error: any) {
        console.error('Erreur chargement images présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/images/:cockpitId/:imageId - Récupérer les données base64 d'une image
    if (path.match(/^\/presentations\/images\/[^/]+\/[^/]+$/) && method === 'GET') {
      const parts = path.split('/');
      const imageId = parts.pop();
      const cockpitId = parts.pop();
      
      try {
        const dataKey = `presentation_image_data:${cockpitId}:${imageId}`;
        const base64Data = await redis.get(dataKey) as string | null;
        
        if (!base64Data) {
          return res.status(404).json({ error: 'Données image non trouvées ou expirées' });
        }
        
        return res.json({ 
          imageId,
          base64Data,
          found: true,
        });
      } catch (error: any) {
        console.error('Erreur chargement données image:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/images/:cockpitId/:imageId/raw - Récupérer l'image brute (pour affichage direct)
    if (path.match(/^\/presentations\/images\/[^/]+\/[^/]+\/raw$/) && method === 'GET') {
      const parts = path.split('/');
      parts.pop(); // Enlever 'raw'
      const imageId = parts.pop();
      const cockpitId = parts.pop();
      
      try {
        const dataKey = `presentation_image_data:${cockpitId}:${imageId}`;
        const base64Data = await redis.get(dataKey) as string | null;
        
        if (!base64Data) {
          return res.status(404).json({ error: 'Image non trouvée ou expirée' });
        }
        
        // Extraire le type MIME et les données
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          return res.status(400).json({ error: 'Format d\'image invalide' });
        }
        
        const mimeType = matches[1];
        const imageData = Buffer.from(matches[2], 'base64');
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', imageData.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(imageData);
        
      } catch (error: any) {
        console.error('Erreur récupération image brute:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/images/cleanup - Nettoyer les doublons et sélectionner les meilleures images
    if (path === '/presentations/images/cleanup' && method === 'POST') {
      const { cockpitId } = req.body;
      
      if (!cockpitId) {
        return res.status(400).json({ error: 'cockpitId requis' });
      }
      
      try {
        const imagesKey = `presentation_images:${cockpitId}`;
        const existingImages = await redis.get(imagesKey) as any[] || [];
        
        if (existingImages.length === 0) {
          return res.json({ success: true, removed: 0, remaining: 0 });
        }
        
        // Grouper par domaine+élément pour identifier les doublons
        const groupedImages: Record<string, any[]> = {};
        
        for (const img of existingImages) {
          const key = `${img.domainId || 'global'}_${img.elementId || 'none'}`;
          if (!groupedImages[key]) {
            groupedImages[key] = [];
          }
          groupedImages[key].push(img);
        }
        
        // Pour chaque groupe, garder uniquement la meilleure image (plus grande taille/qualité)
        const bestImages: any[] = [];
        const removedIds: string[] = [];
        
        for (const key in groupedImages) {
          const group = groupedImages[key];
          if (group.length === 1) {
            bestImages.push(group[0]);
          } else {
            // Trier par qualité décroissante, puis par taille, puis par date (plus récent)
            group.sort((a, b) => {
              const qualityDiff = (b.quality || 0) - (a.quality || 0);
              if (qualityDiff !== 0) return qualityDiff;
              const sizeDiff = (b.width * b.height) - (a.width * a.height);
              if (sizeDiff !== 0) return sizeDiff;
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            
            // Garder la meilleure
            bestImages.push(group[0]);
            
            // Supprimer les autres
            for (let i = 1; i < group.length; i++) {
              removedIds.push(group[i].id);
              await redis.del(`presentation_image_data:${cockpitId}:${group[i].id}`);
            }
          }
        }
        
        // Mettre à jour la liste
        await redis.set(imagesKey, bestImages);
        
        console.log(`[Cleanup] ${cockpitId}: supprimé ${removedIds.length} doublons, reste ${bestImages.length} images`);
        
        return res.json({ 
          success: true, 
          removed: removedIds.length, 
          remaining: bestImages.length,
          removedIds
        });
      } catch (error: any) {
        console.error('Erreur nettoyage images:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/images/best/:cockpitId - Récupérer les meilleures images par domaine
    if (path.match(/^\/presentations\/images\/best\/[^/]+$/) && method === 'GET') {
      const cockpitId = path.split('/').pop();
      
      try {
        const imagesKey = `presentation_images:${cockpitId}`;
        const existingImages = await redis.get(imagesKey) as any[] || [];
        
        // Trier par qualité et grouper par domaine
        const bestByDomain: Record<string, any> = {};
        
        for (const img of existingImages) {
          const domainKey = img.domainId || 'global';
          if (!bestByDomain[domainKey] || (img.quality || 0) > (bestByDomain[domainKey].quality || 0)) {
            bestByDomain[domainKey] = img;
          }
        }
        
        return res.json({ 
          images: Object.values(bestByDomain),
          totalImages: existingImages.length,
          domainsWithImages: Object.keys(bestByDomain).length
        });
      } catch (error: any) {
        console.error('Erreur récupération meilleures images:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/plan - Planifier les actions IA pour la génération
    if (path === '/presentations/plan' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key non configurée' });
      }

      const { cockpitId, cockpitContext, config, existingImages } = req.body;
      
      if (!cockpitId || !cockpitContext || !config) {
        return res.status(400).json({ error: 'cockpitId, cockpitContext et config sont requis' });
      }
      
      try {
        // Construire le prompt système pour la planification
        const systemPrompt = `Tu es un expert en création de présentations et démonstrations de cockpits de supervision.
Tu dois planifier les actions à effectuer pour générer une présentation selon les instructions EXACTES de l'utilisateur.

CONTEXTE DU COCKPIT:
- Nom: ${cockpitContext.name}
- Nombre de domaines: ${cockpitContext.domains?.length || 0}
- Domaines: ${cockpitContext.domains?.map((d: any) => `
  * ${d.name} (ID: ${d.id})
    - Éléments: ${d.elements?.map((e: any) => `${e.name} (ID: ${e.id})`).join(', ') || 'aucun'}
    - Sous-éléments: ${d.elements?.flatMap((e: any) => e.subElements?.map((se: any) => se.name) || []).join(', ') || 'aucun'}`).join('\n') || 'Aucun domaine'}

IMAGES EXISTANTES RÉUTILISABLES (ne pas recapturer ces écrans):
${existingImages && existingImages.length > 0 ? existingImages.map((img: any) => `- ID: ${img.id}, Domaine: ${img.domainName || img.domainId}, Description: ${img.description}`).join('\n') : 'Aucune image existante - toutes les captures seront nouvelles'}

INSTRUCTIONS DE L'UTILISATEUR (TRÈS IMPORTANT - À SUIVRE EXACTEMENT):
"${config.prompt}"

Tu dois retourner un JSON avec:
1. "actions": liste d'actions à effectuer dans l'ordre. Types d'actions possibles:
   - { "type": "navigate_domain", "domainId": "...", "description": "Navigation vers..." }
   - { "type": "navigate_element", "domainId": "...", "elementId": "...", "description": "Navigation vers l'élément..." }
   - { "type": "change_status", "elementId": "...", "status": "ok|mineur|critique|fatal|deconnecte|information", "description": "..." }
   - { "type": "change_status", "subElementId": "...", "status": "...", "description": "..." }
   - { "type": "change_value", "elementId": "...", "value": "...", "description": "..." }
   - { "type": "capture_screen", "domainId": "...", "elementId": "...", "description": "Capture de..." }

2. "scenario": le scénario de présentation DÉTAILLÉ et PROFESSIONNEL
   {
     "title": "Titre accrocheur et descriptif",
     "subtitle": "Sous-titre avec contexte (ex: Cockpit de supervision, date)",
     "introduction": "Introduction de 2-3 phrases présentant le contexte, l'objectif de la présentation et ce que le spectateur va découvrir",
     "sections": [
       {
         "title": "Titre de section (clair et descriptif)",
         "content": "Description détaillée de ce qui est montré (2-4 phrases minimum)",
         "imageIndex": 0, // Index de l'image correspondante (0-based)
         "duration": 10, // Durée en secondes pour la vidéo
         "transition": "fade|slide|zoom", // Type de transition
         "highlights": ["Point clé 1", "Point clé 2"], // Points à mettre en avant
         "notes": "Notes pour le présentateur (ce qu'il doit dire/montrer)"
       }
     ],
     "conclusion": "Conclusion de 2-3 phrases résumant les points clés et invitant à l'action",
     "callToAction": "Action ou prochaine étape suggérée"
   }

   IMPORTANT pour le scénario:
   - Chaque section doit correspondre à une capture d'écran
   - Le contenu doit être EXPLICATIF et PÉDAGOGIQUE
   - Utilise des verbes d'action: "Observez", "Notez", "Découvrez"
   - Mentionne les statuts et indicateurs visibles
   - Ajoute du contexte métier (pourquoi c'est important)

3. "reusedImageIds": liste des IDs d'images existantes à réutiliser (OBLIGATOIRE si des images existantes correspondent)

RÈGLES IMPORTANTES:
1. SUIS LES INSTRUCTIONS UTILISATEUR À LA LETTRE:
   - Si l'utilisateur demande de "montrer tous les exemples" ou "parcourir tous les éléments", génère une action navigate_element + capture_screen pour CHAQUE élément de CHAQUE domaine
   - Si l'utilisateur veut une présentation complète, couvre TOUS les domaines et TOUS les éléments
   - Si l'utilisateur mentionne un domaine ou élément spécifique, concentre-toi dessus

2. ÉVITE LES DOUBLONS D'IMAGES:
   - Vérifie d'abord les images existantes (reusedImageIds)
   - Ne capture PAS un écran si une image existante correspond déjà (même domaine, même contexte)
   - Utilise reusedImageIds pour référencer les images à réutiliser
   - Ne crée de nouvelles captures QUE si nécessaire (nouveau contexte, changement de statut, etc.)

3. STRUCTURE DES ACTIONS:
   - Navigue TOUJOURS vers le domaine AVANT de capturer
   - Pour montrer un élément en détail: navigate_element puis capture_screen avec elementId
   - Pour une vue globale du domaine: navigate_domain puis capture_screen avec domainId seulement
   - Alterne les états si tu veux montrer des scénarios (ok → critique → ok)

4. Les statuts possibles sont: "ok", "mineur", "critique", "fatal", "deconnecte", "information"

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

        // Appeler l'API OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Génère le plan d\'actions et le scénario pour cette présentation.' }
            ],
            max_tokens: 4000,
            temperature: 0.7,
          }),
        });

        if (!openaiResponse.ok) {
          const error = await openaiResponse.json();
          console.error('Erreur OpenAI:', error);
          
          // Plan de secours si l'IA échoue
          const fallbackPlan = {
            actions: cockpitContext.domains.flatMap((domain: any) => [
              { type: 'navigate_domain', domainId: domain.id, description: `Navigation vers ${domain.name}` },
              { type: 'capture_screen', domainId: domain.id, description: `Vue du domaine ${domain.name}` },
            ]),
            scenario: {
              title: `Présentation ${cockpitContext.name}`,
              introduction: config.prompt || 'Présentation de la maquette de cockpit',
              sections: cockpitContext.domains.map((d: any) => ({
                title: d.name,
                content: `Vue du domaine ${d.name}`,
                duration: 10,
              })),
              conclusion: 'Merci pour votre attention.',
            },
            reusedImageIds: [],
          };
          
          return res.json(fallbackPlan);
        }

        const data = await openaiResponse.json();
        const content = data.choices[0]?.message?.content || '';

        // Parser le JSON
        let plan;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            plan = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Pas de JSON trouvé');
          }
        } catch (e) {
          console.error('Erreur parsing plan IA:', e);
          // Plan de secours
          plan = {
            actions: cockpitContext.domains.flatMap((domain: any) => [
              { type: 'navigate_domain', domainId: domain.id, description: `Navigation vers ${domain.name}` },
              { type: 'capture_screen', domainId: domain.id, description: `Vue du domaine ${domain.name}` },
            ]),
            scenario: {
              title: `Présentation ${cockpitContext.name}`,
              introduction: config.prompt,
              sections: cockpitContext.domains.map((d: any) => ({
                title: d.name,
                content: `Vue du domaine ${d.name}`,
              })),
              conclusion: 'Merci pour votre attention.',
            },
            reusedImageIds: [],
          };
        }

        return res.json(plan);

      } catch (error: any) {
        console.error('Erreur planification présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/generate - Générer une présentation avec l'IA
    if (path === '/presentations/generate' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key non configurée' });
      }

      const { cockpitId, cockpitName, config, images, globalPrompt } = req.body;
      
      if (!cockpitId || !config || !images || images.length === 0) {
        return res.status(400).json({ error: 'cockpitId, config et images sont requis' });
      }
      
      try {
        // Construire le contexte pour l'IA
        const systemPrompt = `Tu es un expert en création de présentations professionnelles. 
Tu dois générer un scénario de présentation basé sur les images de cockpit fournies.

Contexte du projet:
${globalPrompt || 'Maquette de cockpit de supervision'}

Nom de la maquette: ${cockpitName}

Instructions utilisateur:
${config.prompt}

Formats de sortie demandés: ${config.outputFormats.join(', ')}

Tu dois retourner un JSON structuré avec:
{
  "title": "Titre de la présentation",
  "introduction": "Texte d'introduction",
  "sections": [
    {
      "title": "Titre de la section",
      "content": "Contenu narratif",
      "imageIds": ["id1", "id2"],
      "duration": 30,
      "notes": "Notes pour le présentateur"
    }
  ],
  "conclusion": "Texte de conclusion"
}`;

        // Préparer les images pour l'envoi (descriptions seulement pour réduire la taille)
        const imageDescriptions = images.map((img: any) => ({
          id: img.id,
          filename: img.filename,
          description: img.description || `Capture d'écran du ${img.filename}`,
          domainId: img.domainId,
        }));

        // Appeler l'API OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { 
                role: 'user', 
                content: `Voici les ${imageDescriptions.length} images disponibles pour la présentation:\n\n${JSON.stringify(imageDescriptions, null, 2)}\n\nGénère le scénario de présentation.`
              }
            ],
            max_tokens: 4000,
            temperature: 0.7,
          }),
        });

        if (!openaiResponse.ok) {
          const error = await openaiResponse.json();
          console.error('Erreur OpenAI:', error);
          return res.status(500).json({ error: 'Erreur génération IA: ' + (error.error?.message || 'inconnue') });
        }

        const data = await openaiResponse.json();
        const content = data.choices[0]?.message?.content || '';

        // Parser le JSON du scénario
        let scenario;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            scenario = JSON.parse(jsonMatch[0]);
          } else {
            scenario = {
              title: `Présentation ${cockpitName}`,
              introduction: 'Présentation générée automatiquement',
              sections: imageDescriptions.map((img: any) => ({
                title: img.description || img.filename,
                content: `Vue de la maquette`,
                imageIds: [img.id],
                duration: 10,
              })),
              conclusion: 'Merci pour votre attention.',
            };
          }
        } catch (e) {
          console.error('Erreur parsing scénario:', e);
          scenario = {
            title: `Présentation ${cockpitName}`,
            introduction: content.substring(0, 200),
            sections: [],
            conclusion: '',
          };
        }

        // Sauvegarder le scénario
        const scenarioKey = `presentation_scenario:${cockpitId}:${config.id || 'temp'}`;
        await redis.set(scenarioKey, {
          ...scenario,
          id: crypto.randomUUID(),
          configId: config.id,
          generatedAt: new Date().toISOString(),
        });

        // Générer les fichiers de sortie (simulation pour l'instant)
        const outputFiles = config.outputFormats.map((format: string) => ({
          format,
          filename: `${cockpitName.replace(/[^a-z0-9]/gi, '_')}_presentation.${format}`,
          url: null, // En production, cela serait une URL de téléchargement
          status: 'ready',
        }));

        return res.json({
          success: true,
          scenario,
          outputFiles,
          message: `Scénario généré avec ${scenario.sections?.length || 0} sections`,
        });

      } catch (error: any) {
        console.error('Erreur génération présentation:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // =====================================================
    // RENDI VIDEO API - Génération de vidéos
    // =====================================================

    // Clé API RENDI (FFmpeg cloud)
    const RENDI_API_KEY = process.env.RENDI_API_KEY || 'eJxLSkxNTkxKS19I1TzZN0zUxTjbQtTC0TNQ1NTewMLMwNjUxM0mOzy4sKYkIK/D3Ms0yKEoJco3INMnwKAcACPAR2g==';
    const RENDI_API_URL = 'https://api.rendi.dev/v1';
    
    // Clé API imgbb pour l'hébergement temporaire d'images (gratuit)
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY || ''; // À configurer dans Vercel
    
    // Fonction utilitaire pour uploader une image vers imgbb
    const uploadToImgbb = async (base64Data: string, filename: string): Promise<string | null> => {
      if (!IMGBB_API_KEY) {
        console.warn('[IMGBB] Clé API non configurée');
        return null;
      }
      
      try {
        // Extraire les données base64 pures (sans le préfixe data:image/...)
        const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        
        const formData = new URLSearchParams();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', pureBase64);
        formData.append('name', filename.replace(/\.[^/.]+$/, '')); // Sans extension
        formData.append('expiration', '3600'); // Expire après 1 heure
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.url) {
            console.log(`[IMGBB] Image uploadée: ${result.data.url}`);
            return result.data.url;
          }
        }
        
        console.error('[IMGBB] Échec upload:', await response.text());
        return null;
      } catch (error) {
        console.error('[IMGBB] Erreur upload:', error);
        return null;
      }
    };

    // POST /presentations/temp-image - Stocker une image temporairement pour RENDI
    if (path === '/presentations/temp-image' && method === 'POST') {
      const { imageId, base64Data, cockpitId } = req.body;
      
      if (!imageId || !base64Data || !cockpitId) {
        return res.status(400).json({ error: 'imageId, base64Data et cockpitId sont requis' });
      }
      
      try {
        // Stocker l'image temporairement en Redis (expire après 1 heure)
        const key = `temp_image:${cockpitId}:${imageId}`;
        await redis.set(key, base64Data, { ex: 3600 }); // 1 heure
        
        // Retourner l'URL publique pour accéder à l'image
        const publicUrl = `${req.headers.origin || 'https://somone-cockpit-studio.vercel.app'}/api/presentations/temp-image/${cockpitId}/${imageId}`;
        
        return res.json({ 
          success: true, 
          imageId,
          url: publicUrl,
        });
      } catch (error: any) {
        console.error('Erreur stockage image temporaire:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/temp-image/:cockpitId/:imageId - Récupérer une image temporaire
    if (path.match(/^\/presentations\/temp-image\/[^/]+\/[^/]+$/) && method === 'GET') {
      const parts = path.split('/');
      const imageId = parts.pop();
      const cockpitId = parts.pop();
      
      try {
        const key = `temp_image:${cockpitId}:${imageId}`;
        const base64Data = await redis.get(key) as string | null;
        
        if (!base64Data) {
          return res.status(404).json({ error: 'Image non trouvée ou expirée' });
        }
        
        // Extraire le type MIME et les données
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          return res.status(400).json({ error: 'Format d\'image invalide' });
        }
        
        const mimeType = matches[1];
        const imageData = Buffer.from(matches[2], 'base64');
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', imageData.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(imageData);
        
      } catch (error: any) {
        console.error('Erreur récupération image temporaire:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/upload-image-to-imgbb - Upload une seule image vers imgbb
    if (path === '/presentations/upload-image-to-imgbb' && method === 'POST') {
      const { base64Data, filename } = req.body;
      
      if (!base64Data) {
        return res.status(400).json({ error: 'base64Data est requis' });
      }
      
      if (!IMGBB_API_KEY) {
        return res.status(400).json({ 
          error: 'IMGBB_API_KEY non configurée',
          help: 'Configurez IMGBB_API_KEY dans Vercel'
        });
      }
      
      try {
        const imgbbUrl = await uploadToImgbb(base64Data, filename || 'image');
        
        if (!imgbbUrl) {
          return res.status(500).json({ error: 'Échec upload vers imgbb' });
        }
        
        return res.json({ 
          success: true, 
          url: imgbbUrl,
        });
      } catch (error: any) {
        console.error('Erreur upload imgbb:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/generate-video - Générer une vidéo avec RENDI
    // Accepte soit des URLs déjà uploadées, soit des base64 (qui seront uploadées ici)
    if (path === '/presentations/generate-video' && method === 'POST') {
      const { cockpitId, cockpitName, images, imageUrls: preUploadedUrls, scenario, durationPerSlide = 5 } = req.body;
      
      // Accepter soit des images avec URL, soit des URLs pré-uploadées
      const hasImages = images && images.length > 0;
      const hasUrls = preUploadedUrls && Object.keys(preUploadedUrls).length > 0;
      
      if (!cockpitId || (!hasImages && !hasUrls)) {
        return res.status(400).json({ error: 'cockpitId et (images ou imageUrls) sont requis' });
      }
      
      try {
        const imageCount = hasUrls ? Object.keys(preUploadedUrls).length : images.length;
        console.log(`[RENDI] Démarrage génération vidéo pour ${cockpitName} avec ${imageCount} images`);
        
        // Utiliser les URLs pré-uploadées ou uploader les base64
        let imageUrls: Record<string, string> = {};
        
        if (hasUrls) {
          // Les URLs sont déjà fournies (uploadées côté client)
          imageUrls = preUploadedUrls;
          console.log(`[RENDI] Utilisation de ${Object.keys(imageUrls).length} URLs pré-uploadées`);
        } else {
          // Upload des base64 vers imgbb (ancien comportement)
          if (!IMGBB_API_KEY) {
            console.error('[RENDI] IMGBB_API_KEY non configurée - impossible de générer la vidéo');
            return res.status(400).json({ 
              error: 'La génération vidéo nécessite une clé API imgbb. Configurez IMGBB_API_KEY dans les variables d\'environnement Vercel.',
              help: 'Obtenez une clé gratuite sur https://api.imgbb.com/'
            });
          }
          
          console.log(`[RENDI] Upload de ${images.length} images vers imgbb...`);
          
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const filename = `video_frame_${i + 1}.jpg`;
            
            const imgbbUrl = await uploadToImgbb(image.base64Data || image.url, filename);
            
            if (!imgbbUrl) {
              console.error(`[RENDI] Échec upload image ${i + 1}`);
              return res.status(500).json({ 
                error: `Échec de l'upload de l'image ${i + 1} vers imgbb`,
              });
            }
            
            imageUrls[`in_img_${i + 1}`] = imgbbUrl;
          }
          
          console.log(`[RENDI] ${images.length} images uploadées vers imgbb`);
        }
        
        // 2. Construire la commande FFmpeg SIMPLIFIÉE et ROBUSTE
        // Utilise concat demuxer pour une compatibilité maximale
        const { transitionType = 'fade', transitionDuration = 1, musicUrl } = req.body;
        
        // Calcul de la durée totale
        const totalDuration = imageCount * durationPerSlide;
        
        console.log(`[RENDI] Génération vidéo: ${imageCount} images, ${durationPerSlide}s/slide, total=${totalDuration}s`);
        
        // Méthode simple et robuste: concat filter avec fade entre chaque image
        const inputParts: string[] = [];
        for (let i = 0; i < imageCount; i++) {
          inputParts.push(`-loop 1 -t ${durationPerSlide} -i {{in_img_${i + 1}}}`);
        }
        
        // Construire le filtre: scale + concat simple (fonctionne à tous les coups)
        const scaleFilters: string[] = [];
        const concatInputs: string[] = [];
        
        for (let i = 0; i < imageCount; i++) {
          // Scale et pad chaque image à 1920x1080
          scaleFilters.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
          concatInputs.push(`[v${i}]`);
        }
        
        // Concat simple sans transitions complexes
        const filterComplex = `${scaleFilters.join(';')};${concatInputs.join('')}concat=n=${imageCount}:v=1:a=0,format=yuv420p[v]`;
        
        // Commande FFmpeg finale
        let ffmpegCommand = `${inputParts.join(' ')} -filter_complex "${filterComplex}" -map [v] -c:v libx264 -preset medium -crf 22 -movflags +faststart {{out_1}}`;
        
        console.log(`[RENDI] Images: ${imageCount}, Durée/slide: ${durationPerSlide}s, Total: ${totalDuration}s`);
        
        console.log(`[RENDI] Commande FFmpeg: ${ffmpegCommand.substring(0, 200)}...`);
        
        // 3. Appeler l'API RENDI
        const rendiResponse = await fetch(`${RENDI_API_URL}/run-ffmpeg-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': RENDI_API_KEY,
          },
          body: JSON.stringify({
            input_files: imageUrls,
            output_files: {
              out_1: `${cockpitName.replace(/[^a-z0-9]/gi, '_')}_presentation.mp4`,
            },
            ffmpeg_command: ffmpegCommand,
            max_command_run_seconds: 600, // 10 minutes max
            vcpu_count: 8,
          }),
        });
        
        if (!rendiResponse.ok) {
          const error = await rendiResponse.json();
          console.error('[RENDI] Erreur API:', error);
          return res.status(500).json({ 
            error: 'Erreur RENDI: ' + (error.detail || error.message || 'Erreur inconnue'),
            details: error,
          });
        }
        
        const rendiResult = await rendiResponse.json();
        console.log(`[RENDI] Commande soumise: ${rendiResult.command_id}`);
        
        return res.json({
          success: true,
          commandId: rendiResult.command_id,
          status: 'PROCESSING',
          message: 'Génération vidéo en cours...',
        });
        
      } catch (error: any) {
        console.error('[RENDI] Erreur génération vidéo:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // GET /presentations/video-status/:commandId - Vérifier le statut d'une vidéo RENDI
    if (path.match(/^\/presentations\/video-status\/[^/]+$/) && method === 'GET') {
      const commandId = path.split('/').pop();
      
      try {
        console.log(`[RENDI] Vérification statut commande: ${commandId}`);
        
        const rendiResponse = await fetch(`${RENDI_API_URL}/commands/${commandId}`, {
          headers: {
            'X-API-KEY': RENDI_API_KEY,
          },
        });
        
        if (!rendiResponse.ok) {
          const error = await rendiResponse.json();
          console.error('[RENDI] Erreur polling:', error);
          return res.status(500).json({ error: 'Erreur RENDI: ' + (error.detail || 'Erreur inconnue') });
        }
        
        const result = await rendiResponse.json();
        console.log(`[RENDI] Statut: ${result.status}`);
        console.log(`[RENDI] Réponse complète:`, JSON.stringify(result, null, 2));
        
        if (result.status === 'SUCCESS') {
          // Récupérer l'URL de la vidéo générée (essayer plusieurs chemins possibles)
          let videoUrl = result.output_files?.out_1?.storage_url 
            || result.output_files?.out_1?.url
            || result.outputs?.out_1?.storage_url
            || result.outputs?.out_1?.url;
          
          // Si toujours pas d'URL, chercher dans la structure
          if (!videoUrl && result.output_files) {
            const firstOutput = Object.values(result.output_files)[0] as any;
            videoUrl = firstOutput?.storage_url || firstOutput?.url;
          }
          
          console.log(`[RENDI] URL vidéo trouvée: ${videoUrl}`);
          
          return res.json({
            status: 'SUCCESS',
            videoUrl,
            duration: result.output_files?.out_1?.duration,
            size: result.output_files?.out_1?.size_mbytes,
            processingTime: result.total_processing_seconds,
            debug: { output_files: result.output_files, outputs: result.outputs },
          });
        } else if (result.status === 'FAILED') {
          console.error(`[RENDI] Échec:`, result.error || result.message);
          return res.json({
            status: 'FAILED',
            error: result.error || result.message || 'Erreur lors de la génération',
            debug: result,
          });
        } else {
          // En cours de traitement
          return res.json({
            status: result.status,
            message: 'Génération en cours...',
            progress: result.progress,
          });
        }
        
      } catch (error: any) {
        console.error('[RENDI] Erreur vérification statut:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // POST /presentations/download-video - Proxy pour télécharger une vidéo externe (contourne CORS)
    if (path === '/presentations/download-video' && method === 'POST') {
      const { videoUrl, filename } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ error: 'videoUrl est requis' });
      }
      
      try {
        console.log(`[PROXY] Téléchargement vidéo: ${videoUrl}`);
        
        const videoResponse = await fetch(videoUrl);
        
        if (!videoResponse.ok) {
          console.error(`[PROXY] Erreur fetch vidéo: ${videoResponse.status}`);
          return res.status(videoResponse.status).json({ 
            error: `Erreur téléchargement: ${videoResponse.statusText}` 
          });
        }
        
        // Récupérer le contenu en tant que buffer
        const arrayBuffer = await videoResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Définir les headers pour le téléchargement
        const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
        const finalFilename = filename || 'video.mp4';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        console.log(`[PROXY] Envoi vidéo: ${buffer.length} bytes`);
        return res.send(buffer);
        
      } catch (error: any) {
        console.error('[PROXY] Erreur téléchargement vidéo:', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
      }
    }

    // Route not found
    return res.status(404).json({ error: 'Route non trouvée' });

  } catch (error: any) {
    console.error('API GLOBAL Error:', error?.message || error);
    console.error('API GLOBAL Stack:', error?.stack);
    return res.status(500).json({ error: `Erreur serveur: ${error?.message || 'Erreur inconnue'}` });
  }
}

