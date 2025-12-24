// SOMONE Cockpit Studio - API Backend
// Session init: 2025-12-22 - Verification complete
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { neon } from '@neondatabase/serverless';
import * as XLSX from 'xlsx';

// Version de l'application (mise à jour automatiquement par le script de déploiement)
const APP_VERSION = '14.11.14';

const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

// Upstash Redis client (pour les donnees de travail)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

console.log('Redis URL configured:', redisUrl ? 'YES' : 'NO');
console.log('Redis Token configured:', redisToken ? 'YES' : 'NO');

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Neon PostgreSQL client (pour les snapshots publies)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
console.log('PostgreSQL URL configured:', databaseUrl ? 'YES' : 'NO');

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

// Types
interface User {
  id: string;
  username: string;
  name?: string; // Nom d'affichage
  password: string;
  isAdmin: boolean;
  createdAt: string;
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

interface Database {
  users: User[];
  cockpits: CockpitData[];
  folders?: Folder[]; // Répertoires de maquettes
  systemPrompt?: string; // Prompt système personnalisé pour l'IA
}

// Helpers
const generateId = () => {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
};

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
  try {
    const dataStr = JSON.stringify(db);
    const sizeKB = Math.round(dataStr.length / 1024);
    console.log(`[saveDb] Sauvegarde en cours... ${db.cockpits?.length || 0} cockpits, taille: ${sizeKB}KB`);
    
    if (dataStr.length > 10000000) { // 10MB limite de securite
      console.error(`[saveDb] ERREUR: Base trop grosse (${sizeKB}KB)`);
      return false;
    }
    
    const result = await redis.set(DB_KEY, db);
    console.log(`[saveDb] Resultat Redis:`, result);
    return true;
  } catch (error: any) {
    console.error('[saveDb] ERREUR Redis set:', error?.message || error);
    return false;
  }
}

// JWT verification (using simple implementation)
function verifyToken(token: string): { id: string; isAdmin: boolean } | null {
  return verifyTokenSimple(token);
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
      const isAdmin = db.users.length === 0; // First user is admin

      const newUser: User = {
        id,
        username,
        password: hashedPassword,
        isAdmin,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      await saveDb(db);

      const token = createToken({ id, isAdmin });

      return res.json({
        user: { id, username, isAdmin },
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
            isAdmin: true
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

      return res.json({
        user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin },
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

      // Si l'utilisateur est déjà admin, il peut quitter le mode admin sans code
      if (user.isAdmin) {
        user.isAdmin = false;
        await saveDb(db);
        return res.json({ isAdmin: false });
      }

      // Sinon, nécessite le code pour activer le mode admin
      // Code secret pour activer/désactiver le mode admin (à changer en production)
      const ADMIN_CODE = process.env.ADMIN_CODE || '12411241';

      if (code !== ADMIN_CODE) {
        return res.status(403).json({ error: 'Code administrateur incorrect' });
      }

      user.isAdmin = true;
      await saveDb(db);

      return res.json({ isAdmin: true });
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

      // Construire le contexte COMPLET du cockpit (en lecture seule pour les cockpits publics)
      const cockpitData = cockpit.data || {};
      const cockpitContext = {
        name: cockpit.name,
        logo: cockpitData.logo || null,
        scrollingBanner: cockpitData.scrollingBanner || null,
        domains: (cockpitData.domains || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          templateType: d.templateType,
          templateName: d.templateName || null,
          order: d.order || 0,
          categories: (d.categories || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            orientation: c.orientation,
            icon: c.icon || null,
            order: c.order || 0,
            elements: (c.elements || []).map((e: any) => ({
              id: e.id,
              name: e.name,
              status: e.status,
              value: e.value || null,
              unit: e.unit || null,
              icon: e.icon || null,
              icon2: e.icon2 || null,
              icon3: e.icon3 || null,
              zone: e.zone || null,
              order: e.order || 0,
              positionX: e.positionX || null,
              positionY: e.positionY || null,
              width: e.width || null,
              height: e.height || null,
              subCategories: (e.subCategories || []).map((sc: any) => ({
                id: sc.id,
                name: sc.name,
                orientation: sc.orientation,
                icon: sc.icon || null,
                order: sc.order || 0,
                subElements: (sc.subElements || []).map((se: any) => ({
                  id: se.id,
                  name: se.name,
                  status: se.status,
                  value: se.value || null,
                  unit: se.unit || null,
                  order: se.order || 0,
                  alert: se.alert ? {
                    id: se.alert.id,
                    date: se.alert.date,
                    description: se.alert.description,
                    duration: se.alert.duration || null,
                    ticketNumber: se.alert.ticketNumber || null,
                    actions: se.alert.actions || null
                  } : null
                }))
              }))
            }))
          })),
          mapElements: (d.mapElements || []).map((me: any) => ({
            id: me.id,
            name: me.name,
            status: me.status,
            icon: me.icon || null,
            gps: me.gps ? {
              lat: me.gps.lat,
              lng: me.gps.lng
            } : null
          })),
          mapBounds: d.mapBounds || null,
          backgroundImage: d.backgroundImage ? (typeof d.backgroundImage === 'string' && d.backgroundImage.length > 100 ? `présente (${d.backgroundImage.length} caractères)` : 'présente') : null,
          backgroundMode: d.backgroundMode || null,
          enableClustering: d.enableClustering !== false
        })),
        zones: (cockpitData.zones || []).map((z: any) => ({
          id: z.id,
          name: z.name
        }))
      };

      const systemPrompt = `Tu es un assistant IA pour SOMONE Cockpit Studio, en mode consultation d'un cockpit publié.

Ce cockpit est en MODE LECTURE SEULE - tu ne peux QUE répondre aux questions, pas modifier le cockpit.

STRUCTURE COMPLÃˆTE DU COCKPIT:
- Cockpit: "${cockpitContext.name}"
- Le cockpit peut avoir un logo et une bannière défilante
- Le cockpit contient des Domaines (onglets principaux)
  - Chaque domaine a un type de template (standard, map, background)
  - Les domaines peuvent avoir une image de fond
  - Les domaines de type "map" peuvent avoir des points GPS et des limites de carte (mapBounds)
- Domaines contiennent des Catégories (groupes d'éléments)
  - Les catégories ont une orientation (horizontal ou vertical)
  - Les catégories peuvent avoir une icône
- Catégories contiennent des Éléments (tuiles avec statut coloré)
  - Les éléments ont un statut (ok, mineur, critique, fatal, deconnecte)
  - Les éléments peuvent avoir une valeur et une unité
  - Les éléments peuvent avoir jusqu'à 3 icônes (icon, icon2, icon3)
  - Les éléments peuvent être associés à une zone
  - Les éléments en vue "background" ont une position (positionX, positionY) et une taille (width, height)
- Éléments contiennent des Sous-catégories
  - Les sous-catégories ont une orientation
  - Les sous-catégories peuvent avoir une icône
- Sous-catégories contiennent des Sous-éléments
  - Les sous-éléments ont un statut
  - Les sous-éléments peuvent avoir une valeur et une unité
  - Les sous-éléments peuvent avoir une alerte avec date, description, durée, numéro de ticket et actions
- Le cockpit contient des Zones (groupements logiques d'éléments)
- Les domaines de type "map" contiennent des MapElements (points sur la carte)
  - Chaque MapElement a un nom, un statut, une icône et des coordonnées GPS (lat, lng)

STATUTS DISPONIBLES: 
- ok (vert) : tout fonctionne normalement
- mineur (orange) : problème mineur
- critique (rouge) : problème critique nécessitant une attention
- fatal (violet) : problème grave
- deconnecte (gris) : élément déconnecté ou indisponible

CONTEXTE COMPLET DU COCKPIT:
${JSON.stringify(cockpitContext, null, 2)}

INSTRUCTIONS:
1. Réponds en français de manière concise et professionnelle
2. Tu es en MODE CONSULTATION - tu ne peux QUE répondre aux questions, analyser et réfléchir
3. Analyse TOUTES les données du cockpit : domaines, catégories, éléments, sous-éléments, zones, mapElements, alertes
4. IMPORTANT pour les vues "map" et "background" :
   - Si backgroundImage est marqué "présente", cela signifie qu'une image de fond est configurée pour ce domaine
   - L'image de fond peut être affichée MÃŠME S'IL N'Y A PAS d'éléments de carte (mapElements)
   - Les mapElements sont des POINTS SUR LA CARTE, pas l'image de fond elle-même
   - L'absence de mapElements ne signifie PAS que l'image de fond est absente ou ne s'affiche pas
   - Si backgroundImage est "présente", l'image DEVRAIT s'afficher dans la vue, même sans points GPS
5. Tu peux :
   - Compter les éléments par statut, par domaine, par catégorie
   - Identifier les problèmes (éléments avec statut critique/fatal/mineur)
   - Expliquer la structure complète du cockpit
   - Analyser les alertes et leurs détails
   - Décrire les zones et leur utilisation
   - Analyser les points GPS sur les cartes
   - Faire des recherches croisées entre zones, domaines et éléments
   - Identifier les tendances et patterns
   - Distinguer entre l'image de fond d'un domaine (qui peut être affichée seule) et les éléments de carte (points GPS)
6. Sois précis et utilise les données réelles du cockpit dans tes réponses`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      try {
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
            max_tokens: 2000,
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

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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
      
      // Utilisateur normal: ses répertoires uniquement
      // Admin: tous les répertoires (mais on les sépare côté frontend)
      const folders = currentUser.isAdmin
        ? db.folders
        : db.folders.filter(f => f.userId === currentUser.id);
      
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
      
      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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
      const { name, domains, zones, logo, scrollingBanner, useOriginalView } = req.body;

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

      const newCockpit: CockpitData = {
        id,
        name,
        userId: currentUser.id,
        data: {
          domains: newDomains.map((d: any) => ({ ...d, cockpitId: id })),
          zones: newZones.map((z: any) => ({ ...z, cockpitId: id })),
          logo: logo || null,
          scrollingBanner: scrollingBanner || null,
          useOriginalView: useOriginalView || false,
        },
        createdAt: now,
        updatedAt: now
      };

      db.cockpits.push(newCockpit);
      await saveDb(db);

      return res.json({
        id,
        name,
        userId: currentUser.id,
        createdAt: now,
        updatedAt: now,
        domains: newDomains,
        zones: newZones,
        logo: logo || null,
        scrollingBanner: scrollingBanner || null,
        useOriginalView: useOriginalView || false,
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
      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const { name, domains, zones, logo, scrollingBanner, sharedWith, useOriginalView } = req.body;
      const now = new Date().toISOString();

      // LOG IMPORTANT : Vérifier ce qui arrive
      if (domains && Array.isArray(domains)) {
        domains.forEach((d: any, idx: number) => {
          const hasBg = d.backgroundImage && d.backgroundImage.length > 0;
          console.log(`[PUT] Domaine[${idx}] "${d.name}": backgroundImage=${hasBg ? `PRESENTE (${d.backgroundImage.length})` : 'ABSENTE'}`);
        });
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
                console.log(`[PUT] âœ… Préservé backgroundImage pour "${newDomain.name}" (${existingDomain.backgroundImage.length} chars)`);
              } else {
                // newDomain a une nouvelle image, l'utiliser
                console.log(`[PUT] ðŸ”„ Nouveau backgroundImage pour "${newDomain.name}" (${newDomain.backgroundImage.length} chars)`);
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
                console.log(`[PUT] âœ… Préservé mapBounds pour "${newDomain.name}"`);
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

      // Log final pour vérifier ce qui est sauvegardé
      console.log(`[PUT /cockpits/:id] âœ… Sauvegarde finale - ${mergedDomains.length} domaines:`);
      mergedDomains.forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
        const hasMapBounds = d.mapBounds && d.mapBounds.topLeft && d.mapBounds.bottomRight;
        const hasMapElements = d.mapElements && Array.isArray(d.mapElements) && d.mapElements.length > 0;
        console.log(`[PUT] Final[${idx}] "${d.name}": ` +
          `bg=${hasBg ? `âœ…(${d.backgroundImage.length})` : 'âŒ'}, ` +
          `bounds=${hasMapBounds ? 'âœ…' : 'âŒ'}, ` +
          `points=${hasMapElements ? `âœ…(${d.mapElements.length})` : 'âŒ'}`);
      });

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
        // IMPORTANT: Toujours préserver les originaux sauvegardés
        originals: cockpit.data.originals,
      };
      cockpit.updatedAt = now;

      await saveDb(db);

      // Vérifier après sauvegarde
      const savedCockpit = db.cockpits.find(c => c.id === cockpit.id);
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
      }

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

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      db.cockpits.splice(cockpitIndex, 1);
      await saveDb(db);

      return res.json({ success: true });
    }

    // Duplicate cockpit
    const duplicateMatch = path.match(/^\/cockpits\/([^/]+)\/duplicate$/);
    if (duplicateMatch && method === 'POST') {
      const id = duplicateMatch[1];
      const { name } = req.body;

      const db = await getDb();
      const original = db.cockpits.find(c => c.id === id);

      if (!original) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!currentUser.isAdmin && original.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const newId = generateId();
      const now = new Date().toISOString();

      const newCockpit: CockpitData = {
        id: newId,
        name: name || `${original.name} - Copie`,
        userId: currentUser.id,
        data: JSON.parse(JSON.stringify(original.data)),
        createdAt: now,
        updatedAt: now
      };

      // Don't copy publication status
      delete newCockpit.data.publicId;
      delete newCockpit.data.isPublished;
      delete newCockpit.data.publishedAt;

      db.cockpits.push(newCockpit);
      await saveDb(db);

      return res.json({
        id: newId,
        name: newCockpit.name,
        userId: currentUser.id,
        createdAt: now,
        updatedAt: now,
        domains: [],
      });
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
          if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      if (!cockpit.data) {
        cockpit.data = { domains: [], zones: [] };
      }

      // Log AVANT publication pour vérifier les données
      console.log(`[PUBLISH] ðŸš€ Publication du cockpit "${cockpit.name}" (${id})`);
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

      // Marquer comme publie
      cockpit.data.isPublished = true;
      cockpit.data.publishedAt = publishedAt;

      // CREATION DU SNAPSHOT - Copie figee pour acces public
      // Le snapshot est stocke dans PostgreSQL (Neon) pour eviter les limites Redis
      const dataSize = JSON.stringify(cockpit.data).length;
      const snapshotVersion = (cockpit.data.snapshotVersion || 0) + 1;

      const publishedSnapshot = {
        logo: cockpit.data.logo || null,
        scrollingBanner: cockpit.data.scrollingBanner || null,
        useOriginalView: cockpit.data.useOriginalView || false,
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

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      if (cockpit.data) {
        cockpit.data.isPublished = false;
      }

      await saveDb(db);

      return res.json({ success: true });
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

    // Export Excel - Format compatible générateur Zabbix
    const exportMatch = path.match(/^\/cockpits\/([^/]+)\/export(?:\/([^/]+))?$/);
    if (exportMatch && method === 'GET') {
      const id = exportMatch[1];
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.id === id);

      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée' });
      }

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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

      // ========== 1. ONGLET ZONES ==========
      let zonesData = (dataToExport.zones || []).map((z: any, idx: number) => ({
        'Label': z.name,
        'Id': z.id,
        'Icon': '',
        'Order': idx + 1,
      }));
      if (zonesData.length === 0) {
        zonesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order': '' }];
      }
      const wsZones = XLSX.utils.json_to_sheet(zonesData);
      XLSX.utils.book_append_sheet(wb, wsZones, 'Zones');

      // ========== 2. ONGLET TEMPLATES ==========
      // Collecter les templates depuis les éléments (e.template) ET depuis les domaines (d.templateName)
      const templatesMap = new Map<string, any>();
      let templateOrderCounter = 1;
      
      // Templates depuis les domaines (ancien système)
      publishableDomains.forEach((d: any) => {
        if (d.templateName && !templatesMap.has(d.templateName)) {
          templatesMap.set(d.templateName, {
            'Label': d.templateName,
            'Id': d.templateName.toLowerCase().replace(/\s+/g, '-'),
            'Icon': '',
            'Order': templateOrderCounter++,
            'Zone': '',
          });
        }
      });
      
      // Templates depuis les éléments (nouveau système)
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            if (e.template && !templatesMap.has(e.template)) {
              templatesMap.set(e.template, {
                'Label': e.template,
                'Id': e.template.toLowerCase().replace(/\s+/g, '-'),
                'Icon': '',
                'Order': templateOrderCounter++,
                'Zone': '',
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

      // ========== 3. ONGLET DOMAINS ==========
      let domainsData = publishableDomains.map((d: any, idx: number) => ({
        'Label': d.name,
        'Id': d.id,
        'Order': idx + 1, // Ordres séquentiels après filtrage (1, 2, 3...)
        'Icon': '',
      }));
      if (domainsData.length === 0) {
        domainsData = [{ 'Label': '', 'Id': '', 'Order': '', 'Icon': '' }];
      }
      const wsDomainsData = XLSX.utils.json_to_sheet(domainsData);
      XLSX.utils.book_append_sheet(wb, wsDomainsData, 'Domains');

      // ========== 4. ONGLET CATEGORIES ==========
      let categoriesData: any[] = [];
      let catOrderCounter = 1; // Compteur d'ordre global pour les catégories
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          categoriesData.push({
            'Label': c.name,
            'Id': c.id,
            'Icon': c.icon || '',
            'Order': catOrderCounter++, // Ordres séquentiels (1, 2, 3...)
            'Domain': d.name, // Label du domaine au lieu de l'ID
          });
        });
      });
      if (categoriesData.length === 0) {
        categoriesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order': '', 'Domain': '' }];
      }
      const wsCategoriesData = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, wsCategoriesData, 'Categories');

      // ========== 5. ONGLET ELEMENT DISCOVERIES (vide) ==========
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
      }]);
      XLSX.utils.book_append_sheet(wb, wsElementDiscoveries, 'Element Discoveries');

      // ========== 6. ONGLET ELEMENTS ==========
      let elementsData: any[] = [];
      let elemOrderCounter = 1; // Compteur d'ordre global pour les éléments
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            elementsData.push({
              'Template': e.template || d.templateName || '', // Priorité au template de l'élément
              'Label': e.name,
              'Category': c.name, // Label de la catégorie au lieu de l'ID
              'Id': e.id,
              'Domain': d.name, // Label du domaine au lieu de l'ID
              'Order': elemOrderCounter++, // Ordres séquentiels (1, 2, 3...)
              'Zone': e.zone || '', // Zone de l'élément
              'Icon': e.icon || '',
              'Icon2': e.icon2 || '',
              'Icon3': e.icon3 || '',
            });
          });
        });
      });
      if (elementsData.length === 0) {
        elementsData = [{ 'Template': '', 'Label': '', 'Category': '', 'Id': '', 'Domain': '', 'Order': '', 'Zone': '', 'Icon': '', 'Icon2': '', 'Icon3': '' }];
      }
      const wsElements = XLSX.utils.json_to_sheet(elementsData);
      XLSX.utils.book_append_sheet(wb, wsElements, 'Elements');

      // ========== 7. ONGLET SUBCATEGORIES ==========
      let subCategoriesData: any[] = [];
      let subCatOrderCounter = 1; // Compteur d'ordre global pour les sous-catégories
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              subCategoriesData.push({
                'Label': sc.name,
                'Id': sc.id,
                'Icon': sc.icon || '',
                'Order': subCatOrderCounter++, // Ordres séquentiels (1, 2, 3...)
                'Domain': d.name, // Label du domaine au lieu de l'ID
              });
            });
          });
        });
      });
      if (subCategoriesData.length === 0) {
        subCategoriesData = [{ 'Label': '', 'Id': '', 'Icon': '', 'Order': '', 'Domain': '' }];
      }
      const wsSubCategories = XLSX.utils.json_to_sheet(subCategoriesData);
      XLSX.utils.book_append_sheet(wb, wsSubCategories, 'SubCategories');

      // ========== 8. ONGLET ITEMS (= Sous-éléments) ==========
      let itemsData: any[] = [];
      let itemOrderCounter = 1; // Compteur d'ordre global pour les items
      publishableDomains.forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              (sc.subElements || []).forEach((se: any) => {
                itemsData.push({
                  'Id': se.id,
                  'Key': '',
                  'Label': se.name,
                  'Order': itemOrderCounter++, // Ordres séquentiels (1, 2, 3...)
                  'Template': e.template || d.templateName || '', // Priorité au template de l'élément
                  'Subcategory': sc.name, // Label de la sous-catégorie au lieu de l'ID
                  'Icon': se.icon || '',
                  'Type': '',
                  'Formula': '',
                  'Preprocessing': '',
                  'Donnée': '',
                  'Fichier': '',
                  'Avancement POC': '',
                });
              });
            });
          });
        });
      });
      if (itemsData.length === 0) {
        itemsData = [{ 'Id': '', 'Key': '', 'Label': '', 'Order': '', 'Template': '', 'Subcategory': '', 'Icon': '', 'Type': '', 'Formula': '', 'Preprocessing': '', 'Donnée': '', 'Fichier': '', 'Avancement POC': '' }];
      }
      const wsItems = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

      // ========== 9. ONGLET TRIGGERS (vide) ==========
      const wsTriggers = XLSX.utils.json_to_sheet([{
        'Template': '',
        'texte': '',
        'statut': '',
        'valeur': '',
        'condition': '',
      }]);
      XLSX.utils.book_append_sheet(wb, wsTriggers, 'Triggers');

      // ========== 10. ONGLET ALERT LIST (vide) ==========
      const wsAlertList = XLSX.utils.json_to_sheet([{
        'type': '',
        'Id (item)': '',
        "nom de l'indicateur (label)": '',
        "lieu d'incidence": '',
        'localisation (host)': '',
        "valeur de l'indicateur": '',
        'statut': '',
        'valeur': '',
        "message d'alerte": '',
      }]);
      XLSX.utils.book_append_sheet(wb, wsAlertList, 'alert list');

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

        // Utiliser la version de l'application définie en haut du fichier
        const appVersion = APP_VERSION;

        // Format du nom : "YYYYMMDD SOMONE COCKPITS NomMaquette LANG HHMMSS vX.Y.Z.xlsx"
        const cleanName = cockpit.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        const fileName = `${dateStamp} SOMONE COCKPITS ${cleanName} ${requestedLang} ${timeStamp} v${appVersion}`;
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
          if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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

      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
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

    // AI Chat
    if (path === '/ai/chat' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      const { message, cockpitContext, history, hasImage, imageBase64, imageMimeType } = req.body;

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

CONTEXTE ACTUEL DU COCKPIT:
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

      // Utiliser gpt-4o-mini qui supporte les images (ou gpt-4o pour meilleure qualité OCR)
      const model = (hasImage && imageBase64) ? 'gpt-4o-mini' : 'gpt-4o-mini';

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
            max_tokens: 16000, // Maximum de tokens pour permettre de nombreuses actions et réponses détaillées
            // Optimiser pour les images : réduire la qualité si nécessaire
            ...(hasImage && imageBase64 && {
              // Option pour réduire le temps de traitement si nécessaire
            }),
          }),
        });

        if (!openaiResponse.ok) {
          let errorMessage = 'Erreur OpenAI inconnue';
          try {
            const errorText = await openaiResponse.text();
            console.error('[AI] OpenAI error response (raw):', errorText.substring(0, 500));

            try {
              const error = JSON.parse(errorText);
              errorMessage = error.error?.message || error.message || errorText.substring(0, 200);
            } catch (parseError) {
              // Si ce n'est pas du JSON, utiliser le texte brut
              errorMessage = errorText.substring(0, 200) || 'Erreur OpenAI inconnue';
            }
          } catch (textError) {
            console.error('[AI] Impossible de lire la réponse d\'erreur OpenAI:', textError);
            errorMessage = `Erreur HTTP ${openaiResponse.status}: ${openaiResponse.statusText}`;
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
            max_tokens: 500,
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

    // Route not found
    return res.status(404).json({ error: 'Route non trouvée' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

