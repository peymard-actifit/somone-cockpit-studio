import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import * as XLSX from 'xlsx';

const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

// Upstash Redis client
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

console.log('Redis URL configured:', redisUrl ? 'YES' : 'NO');
console.log('Redis Token configured:', redisToken ? 'YES' : 'NO');

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Types
interface User {
  id: string;
  username: string;
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

interface Database {
  users: User[];
  cockpits: CockpitData[];
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
    return db || { users: [], cockpits: [] };
  } catch (error) {
    console.error('Redis get error:', error);
    return { users: [], cockpits: [] };
  }
}

async function saveDb(db: Database): Promise<void> {
  try {
    await redis.set(DB_KEY, db);
  } catch (error) {
    console.error('Redis set error:', error);
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
      
      // MÉCANISME DE SECOURS TEMPORAIRE - À SUPPRIMER APRÈS RÉCUPÉRATION
      const EMERGENCY_BYPASS = {
        username: 'peymard',
        password: 'Pat26rick_0637549759',
        enabled: true // Mettre à false après récupération
      };
      
      if (EMERGENCY_BYPASS.enabled && username === EMERGENCY_BYPASS.username && password === EMERGENCY_BYPASS.password) {
        console.log(`[LOGIN] ⚠️ ACCÈS SECOURS ACTIVÉ pour: ${username}`);
        
        // ID fixe pour garantir la cohérence même si Redis échoue
        const EMERGENCY_USER_ID = 'emergency-peymard-user-id-' + hashPassword(username).substring(0, 8);
        
        try {
          const db = await getDb();
          let user = db.users.find(u => u.username === username);
          
          if (!user) {
            // Créer l'utilisateur s'il n'existe pas
            console.log(`[LOGIN] Création utilisateur ${username} via secours`);
            user = {
              id: EMERGENCY_USER_ID,
              username,
              password: hashPassword(password),
              isAdmin: (db.users || []).length === 0,
              createdAt: new Date().toISOString()
            };
            if (!db.users) db.users = [];
            db.users.push(user);
            try {
              await saveDb(db);
              console.log(`[LOGIN] Utilisateur sauvegardé dans Redis`);
            } catch (saveError) {
              console.error(`[LOGIN] Erreur sauvegarde Redis (continuation):`, saveError);
            }
          } else {
            // Mettre à jour le mot de passe pour qu'il corresponde
            console.log(`[LOGIN] Mise à jour mot de passe pour ${username} via secours`);
            user.password = hashPassword(password);
            try {
              await saveDb(db);
              console.log(`[LOGIN] Mot de passe mis à jour dans Redis`);
            } catch (saveError) {
              console.error(`[LOGIN] Erreur sauvegarde Redis (continuation):`, saveError);
            }
          }
          
          const token = createToken({ id: user.id, isAdmin: user.isAdmin });
          console.log(`[LOGIN] ✅ Connexion secours réussie pour: ${username}, token créé`);
          
          return res.json({
            user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
            token
          });
        } catch (error: any) {
          console.error(`[LOGIN] Erreur Redis complète, mais connexion secours autorisée:`, error);
          // Même si Redis échoue complètement, on autorise la connexion avec un utilisateur virtuel
          const token = createToken({ id: EMERGENCY_USER_ID, isAdmin: true });
          console.log(`[LOGIN] ✅ Connexion secours (sans Redis) pour: ${username}`);
          
          return res.json({
            user: { id: EMERGENCY_USER_ID, username: username, isAdmin: true },
            token
          });
        }
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
        user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
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
        return res.status(401).json({ error: 'Token invalide' });
      }

      const db = await getDb();
      const user = db.users.find(u => u.id === decoded.id);
      
      if (!user) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      return res.json({
        user: { id: user.id, username: user.username, isAdmin: user.isAdmin }
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
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded) {
        const db = await getDb();
        currentUser = db.users.find(u => u.id === decoded.id) || null;
      }
    }

    // =====================
    // DEBUG ROUTE (temporary)
    // =====================
    
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
      
      // Log pour diagnostic
      console.log(`[Public API] 📦 Cockpit "${cockpit.name}" trouvé`);
      console.log(`[Public API] Domains count: ${(data.domains || []).length}`);
      console.log(`[Public API] Full cockpit.data keys:`, Object.keys(data));
      
      // CRITIQUE : Vérifier que les domaines ont bien leurs propriétés avant envoi
      const domainsToSend = (data.domains || []).map((domain: any) => {
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
          `bg=${hasImage ? `✅(${domain.backgroundImage.length})` : '❌'}, ` +
          `valid=${isValidBase64 && base64Valid ? '✅' : '❌'}, ` +
          `bounds=${hasMapBounds ? '✅' : '❌'}, ` +
          `points=${hasMapElements ? `✅(${domain.mapElements.length})` : '❌'}`);
        
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
      console.log(`[Public API] ✅ Envoi réponse avec ${domainsToSend.length} domaines:`);
      domainsToSend.forEach((domain: any, index: number) => {
        const hasImage = domain.backgroundImage && typeof domain.backgroundImage === 'string' && domain.backgroundImage.trim().length > 0;
        console.log(`[Public API] Send[${index}] "${domain.name}": bg=${hasImage ? `✅(${domain.backgroundImage.length})` : '❌'}`);
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

STRUCTURE COMPLÈTE DU COCKPIT:
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
   - L'image de fond peut être affichée MÊME S'IL N'Y A PAS d'éléments de carte (mapElements)
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
            const matches = c.userId === currentUser.id;
            if (!matches) {
              console.log(`[GET /cockpits] Cockpit "${c.name}" (${c.id}) filtered out - userId: ${c.userId} !== current: ${currentUser.id}`);
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

    // Create cockpit
    if (path === '/cockpits' && method === 'POST') {
      const { name, domains, zones, logo, scrollingBanner } = req.body;
      
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
      
      if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const { name, domains, zones, logo, scrollingBanner } = req.body;
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
                console.log(`[PUT] ✅ Préservé backgroundImage pour "${newDomain.name}" (${existingDomain.backgroundImage.length} chars)`);
              } else {
                // newDomain a une nouvelle image, l'utiliser
                console.log(`[PUT] 🔄 Nouveau backgroundImage pour "${newDomain.name}" (${newDomain.backgroundImage.length} chars)`);
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
                console.log(`[PUT] ✅ Préservé mapBounds pour "${newDomain.name}"`);
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
        
        // IMPORTANT : Ajouter aussi les domaines existants qui ne sont PAS dans la requête
        // (pour éviter de les perdre)
        const existingDomainIds = new Set(domains.map((d: any) => d.id));
        const domainsToAdd = (cockpit.data.domains || []).filter((d: any) => !existingDomainIds.has(d.id));
        mergedDomains = [...mergedDomains, ...domainsToAdd];
      } else {
        // Si domains n'est pas fourni dans la requête, garder les domaines existants intacts
        mergedDomains = cockpit.data.domains || [];
      }
      
      // Log final pour vérifier ce qui est sauvegardé
      console.log(`[PUT /cockpits/:id] ✅ Sauvegarde finale - ${mergedDomains.length} domaines:`);
      mergedDomains.forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
        const hasMapBounds = d.mapBounds && d.mapBounds.topLeft && d.mapBounds.bottomRight;
        const hasMapElements = d.mapElements && Array.isArray(d.mapElements) && d.mapElements.length > 0;
        console.log(`[PUT] Final[${idx}] "${d.name}": ` +
          `bg=${hasBg ? `✅(${d.backgroundImage.length})` : '❌'}, ` +
          `bounds=${hasMapBounds ? '✅' : '❌'}, ` +
          `points=${hasMapElements ? `✅(${d.mapElements.length})` : '❌'}`);
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
      };
      cockpit.updatedAt = now;

      await saveDb(db);
      
      // Vérifier après sauvegarde
      const savedCockpit = db.cockpits.find(c => c.id === cockpit.id);
      if (savedCockpit && savedCockpit.data) {
        console.log(`[PUT /cockpits/:id] ✅ Après sauvegarde - Domaines avec images:`);
        (savedCockpit.data.domains || []).forEach((d: any, idx: number) => {
          const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
          const isValid = hasBg && d.backgroundImage.startsWith('data:image/');
          const sizeMB = hasBg ? (d.backgroundImage.length / 1024 / 1024).toFixed(2) : '0';
          console.log(`[PUT] Saved[${idx}] "${d.name}": backgroundImage=${hasBg ? `PRESENTE (${d.backgroundImage.length} chars, ${sizeMB} MB, valid: ${isValid})` : 'ABSENTE'}`);
          
          // Vérifier si l'image est valide
          if (hasBg && !isValid) {
            console.warn(`[PUT] ⚠️ Image invalide pour "${d.name}" - ne commence pas par data:image/`);
          }
          if (hasBg && d.backgroundImage.length < 100) {
            console.warn(`[PUT] ⚠️ Image suspecte pour "${d.name}" - trop courte (${d.backgroundImage.length} chars)`);
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
      console.log(`[PUBLISH] 🚀 Publication du cockpit "${cockpit.name}" (${id})`);
      console.log(`[PUBLISH] Domaines avant publication: ${(cockpit.data.domains || []).length}`);
      (cockpit.data.domains || []).forEach((d: any, idx: number) => {
        const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
        const hasMapBounds = d.mapBounds && d.mapBounds.topLeft && d.mapBounds.bottomRight;
        console.log(`[PUBLISH] Domain[${idx}] "${d.name}": ` +
          `bg=${hasBg ? `✅(${d.backgroundImage.length})` : '❌'}, ` +
          `bounds=${hasMapBounds ? '✅' : '❌'}`);
      });
      
      if (!cockpit.data.publicId) {
        cockpit.data.publicId = generateId().replace(/-/g, '').substring(0, 12);
      }
      
      cockpit.data.isPublished = true;
      cockpit.data.publishedAt = new Date().toISOString();
      
      await saveDb(db);
      
      // Vérifier APRÈS sauvegarde que tout est bien là
      const savedCockpit = db.cockpits.find(c => c.id === id);
      if (savedCockpit && savedCockpit.data) {
        console.log(`[PUBLISH] ✅ Après sauvegarde - Cockpit publié avec ${(savedCockpit.data.domains || []).length} domaines`);
        (savedCockpit.data.domains || []).forEach((d: any, idx: number) => {
          const hasBg = d.backgroundImage && typeof d.backgroundImage === 'string' && d.backgroundImage.trim().length > 0;
          console.log(`[PUBLISH] Published[${idx}] "${d.name}": bg=${hasBg ? `✅(${d.backgroundImage.length})` : '❌'}`);
        });
      }

      return res.json({
        success: true,
        publicId: cockpit.data.publicId,
        publishedAt: cockpit.data.publishedAt
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
      
      try {
        // Détecter la langue source (FR par défaut)
        const sourceLang = 'FR';
        
        // Déterminer l'URL de l'API DeepL (gratuite ou payante)
        // Si la clé commence par "fx" ou "free", utiliser l'API gratuite
        const isFreeApi = DEEPL_API_KEY.startsWith('fx') || DEEPL_API_KEY.startsWith('free') || !DEEPL_API_KEY.includes(':');
        const apiUrl = isFreeApi 
          ? 'https://api-free.deepl.com/v2/translate'
          : 'https://api.deepl.com/v2/translate';
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            text: text,
            source_lang: sourceLang,
            target_lang: targetLang,
            preserve_formatting: '1',
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`DeepL API error: ${response.status} ${response.statusText}`, errorText);
          
          // Si erreur 403 ou 401, la clé API est probablement invalide
          if (response.status === 403 || response.status === 401) {
            console.error('❌ Clé API DeepL invalide ou expirée');
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
    
    // Traduire un objet de données récursivement - seulement les champs textuels de contenu
    const translateDataRecursively = async (data: any, targetLang: string = 'EN'): Promise<any> => {
      if (typeof data === 'string' && data.trim() !== '') {
        return await translateWithDeepL(data, targetLang);
      } else if (Array.isArray(data)) {
        return Promise.all(data.map(item => translateDataRecursively(item, targetLang)));
      } else if (data && typeof data === 'object') {
        const translated: any = {};
        for (const [key, value] of Object.entries(data)) {
          // Ne traduire que les champs de texte de contenu
          if (key === 'name' || key === 'description' || key === 'actions') {
            // Traduire ces champs
            translated[key] = await translateDataRecursively(value, targetLang);
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
          } else {
            // Tous les autres champs (IDs, ordres, statuts, etc.) ne pas traduire
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
      },
    };
    
    // Traduire les en-têtes Excel
    const translateHeaders = async (headers: Record<string, any>, targetLang: string): Promise<Record<string, any>> => {
      if (targetLang === 'FR') {
        return headers; // Pas de traduction nécessaire
      }
      
      const translatedHeaders: Record<string, any> = {};
      
      // Si on a un mapping direct, l'utiliser
      if (excelHeaders[targetLang]) {
        for (const [key, value] of Object.entries(headers)) {
          const translatedKey = excelHeaders[targetLang][key] || excelHeaders['EN'][key] || key;
          translatedHeaders[translatedKey] = value;
        }
        return translatedHeaders;
      }
      
      // Sinon, traduire avec DeepL
      if (DEEPL_API_KEY) {
        for (const [key, value] of Object.entries(headers)) {
          const translatedKey = await translateWithDeepL(key, targetLang);
          translatedHeaders[translatedKey] = value;
        }
        return translatedHeaders;
      }
      
      // Fallback : utiliser les en-têtes anglais
      for (const [key, value] of Object.entries(headers)) {
        const translatedKey = excelHeaders['EN'][key] || key;
        translatedHeaders[translatedKey] = value;
      }
      return translatedHeaders;
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
        },
        EN: {
          'Domaines': 'Domains',
          'Catégories': 'Categories',
          'Éléments': 'Elements',
          'Sous-catégories': 'Sub-categories',
          'Sous-éléments': 'Sub-elements',
          'Alertes': 'Alerts',
          'Zones': 'Zones',
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
    
    // Obtenir les en-têtes traduits (synchrone pour performance)
    const getTranslatedHeaderSync = (headerFr: string, targetLang: string): string => {
      if (targetLang === 'FR') return headerFr;
      
      // Utiliser le mapping direct si disponible
      if (excelHeaders[targetLang] && excelHeaders[targetLang][headerFr]) {
        return excelHeaders[targetLang][headerFr];
      }
      
      // Sinon utiliser la version anglaise comme fallback
      if (excelHeaders['EN'][headerFr]) {
        return excelHeaders['EN'][headerFr];
      }
      
      return headerFr; // Fallback : garder l'original
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
    
    // Export Excel
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
      
      // Onglet Domaines
      let domainsData = (dataToExport.domains || []).map((d: any) => ({
        'ID': d.id,
        'Nom': d.name,
        'Type': d.templateType,
        'Template': d.templateName || '',
        'Ordre': d.order,
      }));
      if (domainsData.length === 0) {
        domainsData = [{ 'ID': '', 'Nom': '', 'Type': '', 'Template': '', 'Ordre': '' }];
      }
      const translatedDomainsData = await translateObjectsKeys(domainsData, requestedLang);
      const wsDomainsData = XLSX.utils.json_to_sheet(translatedDomainsData);
      const translatedDomainsSheetName = await translateSheetName('Domaines', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsDomainsData, translatedDomainsSheetName);
      
      // Onglet Catégories
      let categoriesData: any[] = [];
      (dataToExport.domains || []).forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          categoriesData.push({
            'ID': c.id,
            'Domaine': d.name,
            'Nom': c.name,
            'Icône': c.icon || '',
            'Orientation': c.orientation,
            'Ordre': c.order,
          });
        });
      });
      if (categoriesData.length === 0) {
        categoriesData = [{ 'ID': '', 'Domaine': '', 'Nom': '', 'Icône': '', 'Orientation': '', 'Ordre': '' }];
      }
      const translatedCategoriesData = await translateObjectsKeys(categoriesData, requestedLang);
      const wsCategoriesData = XLSX.utils.json_to_sheet(translatedCategoriesData);
      const translatedCategoriesSheetName = await translateSheetName('Catégories', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsCategoriesData, translatedCategoriesSheetName);
      
      // Onglet Éléments
      let elementsData: any[] = [];
      (dataToExport.domains || []).forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            elementsData.push({
              'ID': e.id,
              'Domaine': d.name,
              'Catégorie': c.name,
              'Nom': e.name,
              'Valeur': e.value || '',
              'Unité': e.unit || '',
              'Icône': e.icon || '',
              'Icône 2': e.icon2 || '',
              'Icône 3': e.icon3 || '',
              'Statut': e.status,
              'Zone': e.zone || '',
              'Ordre': e.order,
            });
          });
        });
      });
      if (elementsData.length === 0) {
        elementsData = [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Nom': '', 'Valeur': '', 'Unité': '', 'Icône': '', 'Icône 2': '', 'Icône 3': '', 'Statut': '', 'Zone': '', 'Ordre': '' }];
      }
      const translatedElementsData = await translateObjectsKeys(elementsData, requestedLang);
      const wsElements = XLSX.utils.json_to_sheet(translatedElementsData);
      const translatedElementsSheetName = await translateSheetName('Éléments', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsElements, translatedElementsSheetName);
      
      // Onglet Sous-catégories
      let subCategoriesData: any[] = [];
      (dataToExport.domains || []).forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              subCategoriesData.push({
                'ID': sc.id,
                'Domaine': d.name,
                'Catégorie': c.name,
                'Élément': e.name,
                'Nom': sc.name,
                'Icône': sc.icon || '',
                'Orientation': sc.orientation,
                'Ordre': sc.order,
              });
            });
          });
        });
      });
      if (subCategoriesData.length === 0) {
        subCategoriesData = [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Élément': '', 'Nom': '', 'Icône': '', 'Orientation': '', 'Ordre': '' }];
      }
      const translatedSubCategoriesData = await translateObjectsKeys(subCategoriesData, requestedLang);
      const wsSubCategories = XLSX.utils.json_to_sheet(translatedSubCategoriesData);
      const translatedSubCategoriesSheetName = await translateSheetName('Sous-catégories', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsSubCategories, translatedSubCategoriesSheetName);
      
      // Onglet Sous-éléments
      let subElementsData: any[] = [];
      (dataToExport.domains || []).forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              (sc.subElements || []).forEach((se: any) => {
                subElementsData.push({
                  'ID': se.id,
                  'Domaine': d.name,
                  'Catégorie': c.name,
                  'Élément': e.name,
                  'Sous-catégorie': sc.name,
                  'Nom': se.name,
                  'Valeur': se.value || '',
                  'Unité': se.unit || '',
                  'Statut': se.status,
                  'Ordre': se.order,
                });
              });
            });
          });
        });
      });
      if (subElementsData.length === 0) {
        subElementsData = [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Élément': '', 'Sous-catégorie': '', 'Nom': '', 'Valeur': '', 'Unité': '', 'Statut': '', 'Ordre': '' }];
      }
      const translatedSubElementsData = await translateObjectsKeys(subElementsData, requestedLang);
      const wsSubElements = XLSX.utils.json_to_sheet(translatedSubElementsData);
      const translatedSubElementsSheetName = await translateSheetName('Sous-éléments', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsSubElements, translatedSubElementsSheetName);
      
      // Onglet Alertes
      let alertsData: any[] = [];
      (dataToExport.domains || []).forEach((d: any) => {
        (d.categories || []).forEach((c: any) => {
          (c.elements || []).forEach((e: any) => {
            (e.subCategories || []).forEach((sc: any) => {
              (sc.subElements || []).forEach((se: any) => {
                if (se.alert) {
                  alertsData.push({
                    'ID': se.alert.id,
                    'Domaine': d.name,
                    'Catégorie': c.name,
                    'Élément': e.name,
                    'Sous-catégorie': sc.name,
                    'Sous-élément': se.name,
                    'Date': se.alert.date,
                    'Description': se.alert.description,
                    'Durée': se.alert.duration || '',
                    'Ticket': se.alert.ticketNumber || '',
                    'Actions': se.alert.actions || '',
                  });
                }
              });
            });
          });
        });
      });
      if (alertsData.length === 0) {
        alertsData = [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Élément': '', 'Sous-catégorie': '', 'Sous-élément': '', 'Date': '', 'Description': '', 'Durée': '', 'Ticket': '', 'Actions': '' }];
      }
      const translatedAlertsData = await translateObjectsKeys(alertsData, requestedLang);
      const wsAlerts = XLSX.utils.json_to_sheet(translatedAlertsData);
      const translatedAlertsSheetName = await translateSheetName('Alertes', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsAlerts, translatedAlertsSheetName);
      
      // Onglet Zones
      let zonesData = (dataToExport.zones || []).map((z: any) => ({
        'ID': z.id,
        'Nom': z.name,
      }));
      if (zonesData.length === 0) {
        zonesData = [{ 'ID': '', 'Nom': '' }];
      }
      const translatedZonesData = await translateObjectsKeys(zonesData, requestedLang);
      const wsZones = XLSX.utils.json_to_sheet(translatedZonesData);
      const translatedZonesSheetName = await translateSheetName('Zones', requestedLang);
      XLSX.utils.book_append_sheet(wb, wsZones, translatedZonesSheetName);
      
      // Générer le buffer Excel
      try {
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Encoder le nom du fichier pour éviter les problèmes avec les caractères spéciaux
        const langSuffix = requestedLang === 'FR' ? '_FR' : `_${requestedLang}`;
        const encodedFileName = encodeURIComponent(cockpit.name.replace(/[^\w\s-]/g, '') + langSuffix).replace(/'/g, '%27');
        
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
      return res.json({
        languages: [
          { code: 'FR', name: 'Français (Originale)' },
          { code: 'EN', name: 'English' },
          { code: 'DE', name: 'Deutsch' },
          { code: 'ES', name: 'Español' },
          { code: 'IT', name: 'Italiano' },
          { code: 'PT', name: 'Português' },
          { code: 'RU', name: 'Русский' },
          { code: 'JA', name: '日本語' },
          { code: 'ZH', name: '中文' },
          { code: 'NL', name: 'Nederlands' },
          { code: 'PL', name: 'Polski' },
          { code: 'AR', name: 'العربية' },
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
      const { targetLang, preserveOriginals } = req.body || {};
      
      if (!targetLang || targetLang === 'FR') {
        // Si FR ou pas de langue, retourner les données originales
        const db = await getDb();
        const cockpit = db.cockpits.find(c => c.id === id);
        if (!cockpit) {
          return res.status(404).json({ error: 'Maquette non trouvée' });
        }
        if (!currentUser.isAdmin && cockpit.userId !== currentUser.id) {
          return res.status(403).json({ error: 'Accès non autorisé' });
        }
        return res.json({ translatedData: cockpit.data || { domains: [], zones: [] } });
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
        // Si preserveOriginals est true, stocker les originaux dans cockpit.data.originals
        if (preserveOriginals && !cockpit.data.originals) {
          cockpit.data.originals = JSON.parse(JSON.stringify(data));
          await saveDb(db);
        }
        
        // Traduire les données
        console.log(`[Translation] Traduction en cours vers ${targetLang}...`);
        const translatedData = await translateDataRecursively(JSON.parse(JSON.stringify(data)), targetLang);
        console.log(`[Translation] Traduction terminée`);
        
        return res.json({ translatedData });
      } catch (error: any) {
        console.error('Erreur traduction:', error);
        return res.status(500).json({ error: 'Erreur lors de la traduction: ' + error.message });
      }
    }
    
    // Restaurer les textes originaux
    if (path.match(/^\/cockpits\/([^/]+)\/restore-originals$/) && method === 'POST') {
      const match = path.match(/^\/cockpits\/([^/]+)\/restore-originals$/);
      if (!match) {
        return res.status(400).json({ error: 'ID manquant' });
      }
      const id = match[1];
      
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
    
    // AI Chat
    if (path === '/ai/chat' && method === 'POST') {
      if (!OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }
      
      const { message, cockpitContext, history } = req.body;
      
      const systemPrompt = `Tu es un assistant IA pour SOMONE Cockpit Studio, une application de création de tableaux de bord visuels.

STRUCTURE DU COCKPIT:
- Cockpit contient des Domaines (onglets principaux, max 6)
- Domaines contiennent des Catégories (groupes d'éléments)
- Catégories contiennent des Éléments (tuiles avec statut coloré)
- Éléments contiennent des Sous-catégories
- Sous-catégories contiennent des Sous-éléments

STATUTS DISPONIBLES: ok (vert), mineur (orange), critique (rouge), fatal (violet), deconnecte (gris)

ACTIONS DISPONIBLES (retourne-les dans le champ "actions"):
- addDomain: { name: string }
- deleteDomain: { domainId?: string, name?: string }
- updateDomain: { domainId?: string, name?: string, updates: { name?, templateType?, templateName?, backgroundImage?, backgroundMode?, mapBounds?, enableClustering? } }
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

INSTRUCTIONS:
1. Réponds en français de manière concise et professionnelle
2. Si l'utilisateur demande une modification, tu DOIS retourner les actions dans un format JSON strict
3. Format de réponse OBLIGATOIRE si tu exécutes des actions:
   {
     "message": "Description textuelle de ce que tu as fait",
     "actions": [
       { "type": "actionType", "params": { ... } }
     ]
   }
4. Tu peux créer plusieurs éléments en une seule fois avec addElements
5. Utilise les IDs existants quand disponibles, sinon utilise les noms
6. Si tu fais plusieurs modifications, liste toutes les actions dans le tableau "actions"
7. IMPORTANT: Retourne TOUJOURS les actions dans un bloc JSON avec backticks ou directement comme objet JSON valide`;

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
        
        // Essayer d'extraire les actions du message
        let actions: any[] = [];
        try {
          // Chercher un bloc JSON dans la réponse
          const jsonMatch = assistantMessage.match(/```json\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.actions && Array.isArray(parsed.actions)) {
              actions = parsed.actions;
              console.log('[AI] Actions extraites depuis bloc JSON:', actions);
            }
          } else {
            // Chercher un objet JSON direct
            const directMatch = assistantMessage.match(/\{[\s\S]*"actions"[\s\S]*\}/);
            if (directMatch) {
              const parsed = JSON.parse(directMatch[0]);
              if (parsed.actions && Array.isArray(parsed.actions)) {
                actions = parsed.actions;
                console.log('[AI] Actions extraites depuis objet JSON direct:', actions);
              }
            } else {
              // Essayer de parser la réponse complète comme JSON si elle commence par {
              if (assistantMessage.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(assistantMessage.trim());
                  if (parsed.actions && Array.isArray(parsed.actions)) {
                    actions = parsed.actions;
                    console.log('[AI] Actions extraites depuis réponse JSON complète:', actions);
                  }
                } catch (e2) {
                  // Ce n'est pas un JSON complet, c'est ok
                }
              }
            }
          }
        } catch (e) {
          console.warn('[AI] Erreur parsing actions:', e);
          console.log('[AI] Message complet:', assistantMessage);
        }
        
        if (actions.length === 0) {
          console.log('[AI] Aucune action trouvée dans la réponse');
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

