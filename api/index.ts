import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
const ADMIN_CODE = process.env.ADMIN_CODE || 'SOMONE2024';

// Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
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
      const db = await getDb();
      
      const user = db.users.find(u => u.username === username);
      if (!user) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }

      const valid = comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }

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
    // PUBLIC COCKPIT ROUTE
    // =====================
    
    const publicMatch = path.match(/^\/public\/cockpit\/([^/]+)$/);
    if (publicMatch && method === 'GET') {
      const publicId = publicMatch[1];
      const db = await getDb();
      const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);
      
      if (!cockpit) {
        return res.status(404).json({ error: 'Maquette non trouvée ou non publiée' });
      }
      
      return res.json({
        id: cockpit.id,
        name: cockpit.name,
        createdAt: cockpit.createdAt,
        updatedAt: cockpit.updatedAt,
        publicId: cockpit.data.publicId,
        ...cockpit.data,
      });
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
      const db = await getDb();
      let cockpits = currentUser.isAdmin 
        ? db.cockpits 
        : db.cockpits.filter(c => c.userId === currentUser!.id);
      
      return res.json(cockpits.map(c => ({
        id: c.id,
        name: c.name,
        userId: c.userId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        domains: [],
        publicId: c.data?.publicId,
        isPublished: c.data?.isPublished || false,
        publishedAt: c.data?.publishedAt,
      })));
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
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Nom requis' });
      }

      const db = await getDb();
      const id = generateId();
      const now = new Date().toISOString();

      const newCockpit: CockpitData = {
        id,
        name,
        userId: currentUser.id,
        data: { domains: [], zones: [] },
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
        domains: [],
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
      
      // Preserve publication info
      const existingPublicId = cockpit.data?.publicId;
      const existingIsPublished = cockpit.data?.isPublished;
      const existingPublishedAt = cockpit.data?.publishedAt;

      cockpit.name = name || cockpit.name;
      cockpit.data = { 
        domains, 
        zones, 
        logo, 
        scrollingBanner,
        publicId: existingPublicId,
        isPublished: existingIsPublished,
        publishedAt: existingPublishedAt
      };
      cockpit.updatedAt = now;

      await saveDb(db);

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
      
      if (!cockpit.data.publicId) {
        cockpit.data.publicId = generateId().replace(/-/g, '').substring(0, 12);
      }
      
      cockpit.data.isPublished = true;
      cockpit.data.publishedAt = new Date().toISOString();
      
      await saveDb(db);

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

    // Route not found
    return res.status(404).json({ error: 'Route non trouvée' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

