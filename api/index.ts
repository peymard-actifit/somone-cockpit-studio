import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import * as XLSX from 'xlsx';

const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-2024';
const ADMIN_CODE = process.env.ADMIN_CODE || 'SOMONE2024';

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
    // DEBUG ROUTE (temporary)
    // =====================
    
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
      
      const db = await getDb();
      return res.json({
        redis_url_set: !!redisUrl,
        redis_token_set: !!redisToken,
        redis_url_preview: redisUrl ? redisUrl.substring(0, 30) + '...' : 'NOT SET',
        redis_write_test: testWrite,
        redis_error: redisError,
        users_count: db.users.length,
        cockpits_count: db.cockpits.length,
        published_cockpits: db.cockpits
          .filter(c => c.data?.isPublished)
          .map(c => ({ 
            name: c.name, 
            publicId: c.data?.publicId,
            isPublished: c.data?.isPublished 
          })),
        all_cockpits: db.cockpits.map(c => ({
          name: c.name,
          publicId: c.data?.publicId,
          isPublished: c.data?.isPublished
        }))
      });
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
      
      // Construire explicitement la réponse pour garantir que toutes les données sont incluses
      const data = cockpit.data || {};
      const domains = data.domains || [];
      
      // Log des images pour débogage
      domains.forEach((domain: any) => {
        if (domain.backgroundImage) {
          console.log(`[Public API] Domain "${domain.name}" (${domain.templateType}): backgroundImage présente (${domain.backgroundImage.length} caractères)`);
          console.log(`[Public API] backgroundImage type: ${typeof domain.backgroundImage}`);
          console.log(`[Public API] backgroundImage preview: ${domain.backgroundImage.substring(0, 50)}...`);
        } else {
          console.warn(`[Public API] Domain "${domain.name}" (${domain.templateType}): PAS d'image de fond`);
          console.warn(`[Public API] Domain keys:`, Object.keys(domain));
        }
      });
      
      // Vérifier que les domaines ont bien leurs propriétés
      const domainsWithImages = domains.map((domain: any) => {
        // S'assurer que backgroundImage est bien présent même si c'est undefined
        return {
          ...domain,
          backgroundImage: domain.backgroundImage || null, // Explicitement mettre null si absent
        };
      });
      
      const response = {
        id: cockpit.id,
        name: cockpit.name,
        createdAt: cockpit.createdAt,
        updatedAt: cockpit.updatedAt,
        publicId: data.publicId,
        isPublished: data.isPublished,
        publishedAt: data.publishedAt,
        domains: domainsWithImages,
        zones: data.zones || [],
        logo: data.logo,
        scrollingBanner: data.scrollingBanner,
      };
      
      // Log final pour vérification
      console.log(`[Public API] Response domains count: ${response.domains.length}`);
      response.domains.forEach((d: any) => {
        console.log(`[Public API] Final domain "${d.name}": backgroundImage ${d.backgroundImage ? `présente (${d.backgroundImage.length} chars)` : 'ABSENTE'}`);
      });
      
      return res.json(response);
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
      
      cockpit.name = name || cockpit.name;
      
      // Faire un merge au lieu de remplacer complètement
      // Préserver toutes les données existantes si elles ne sont pas dans la requête
      if (!cockpit.data) {
        cockpit.data = { domains: [], zones: [] };
      }
      
      // Si des domaines sont fournis, faire un merge intelligent pour préserver les backgroundImage
      let mergedDomains = cockpit.data.domains || [];
      if (domains !== undefined && Array.isArray(domains)) {
        // Faire un merge domaine par domaine pour préserver les backgroundImage existantes
        mergedDomains = domains.map((newDomain: any) => {
          // Chercher le domaine existant correspondant
          const existingDomain = cockpit.data.domains?.find((d: any) => d.id === newDomain.id);
          
          if (existingDomain) {
            // Merge : préserver backgroundImage et mapBounds si pas fournis dans la nouvelle version
            // Vérifier si backgroundImage est valide (pas undefined, null, ou chaîne vide)
            const hasValidBackgroundImage = newDomain.backgroundImage !== undefined && 
                                          newDomain.backgroundImage !== null && 
                                          newDomain.backgroundImage !== '';
            
            // Vérifier si mapBounds est valide
            const hasValidMapBounds = newDomain.mapBounds !== undefined && 
                                     newDomain.mapBounds !== null &&
                                     (newDomain.mapBounds.topLeft || newDomain.mapBounds.bottomRight);
            
            const existingHasBackgroundImage = existingDomain.backgroundImage && existingDomain.backgroundImage !== '';
            
            // Log pour diagnostic
            if (existingHasBackgroundImage && !hasValidBackgroundImage) {
              console.log(`[PUT /cockpits/:id] Préservation de backgroundImage pour domaine "${newDomain.name}" (${newDomain.id})`);
              console.log(`[PUT /cockpits/:id]   - Ancienne longueur: ${existingDomain.backgroundImage?.length || 0}`);
              console.log(`[PUT /cockpits/:id]   - Nouvelle valeur: ${newDomain.backgroundImage === undefined ? 'undefined' : (newDomain.backgroundImage === null ? 'null' : `"${newDomain.backgroundImage.substring(0, 20)}..."`)}`);
            }
            
            return {
              ...existingDomain,
              ...newDomain,
              // Préserver backgroundImage si elle n'est pas valide dans la nouvelle version
              backgroundImage: hasValidBackgroundImage ? newDomain.backgroundImage : (existingDomain.backgroundImage || newDomain.backgroundImage || null),
              // Préserver mapBounds si pas valide
              mapBounds: hasValidMapBounds ? newDomain.mapBounds : (existingDomain.mapBounds || newDomain.mapBounds || null),
            };
          } else {
            // Nouveau domaine, utiliser tel quel
            return newDomain;
          }
        });
      }
      
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

    // Export Excel
    const exportMatch = path.match(/^\/cockpits\/([^/]+)\/export$/);
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
      
      const data = cockpit.data || { domains: [], zones: [] };
      
      // Créer le workbook Excel
      const wb = XLSX.utils.book_new();
      
      // Onglet Domaines
      const domainsData = (data.domains || []).map((d: any) => ({
        'ID': d.id,
        'Nom': d.name,
        'Type': d.templateType,
        'Template': d.templateName || '',
        'Ordre': d.order,
      }));
      const wsDomainsData = XLSX.utils.json_to_sheet(domainsData.length ? domainsData : [{ 'ID': '', 'Nom': '', 'Type': '', 'Template': '', 'Ordre': '' }]);
      XLSX.utils.book_append_sheet(wb, wsDomainsData, 'Domaines');
      
      // Onglet Catégories
      const categoriesData: any[] = [];
      (data.domains || []).forEach((d: any) => {
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
      const wsCategoriesData = XLSX.utils.json_to_sheet(categoriesData.length ? categoriesData : [{ 'ID': '', 'Domaine': '', 'Nom': '', 'Icône': '', 'Orientation': '', 'Ordre': '' }]);
      XLSX.utils.book_append_sheet(wb, wsCategoriesData, 'Catégories');
      
      // Onglet Éléments
      const elementsData: any[] = [];
      (data.domains || []).forEach((d: any) => {
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
      const wsElements = XLSX.utils.json_to_sheet(elementsData.length ? elementsData : [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Nom': '', 'Valeur': '', 'Unité': '', 'Icône': '', 'Icône 2': '', 'Icône 3': '', 'Statut': '', 'Zone': '', 'Ordre': '' }]);
      XLSX.utils.book_append_sheet(wb, wsElements, 'Éléments');
      
      // Onglet Sous-catégories
      const subCategoriesData: any[] = [];
      (data.domains || []).forEach((d: any) => {
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
      const wsSubCategories = XLSX.utils.json_to_sheet(subCategoriesData.length ? subCategoriesData : [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Élément': '', 'Nom': '', 'Icône': '', 'Orientation': '', 'Ordre': '' }]);
      XLSX.utils.book_append_sheet(wb, wsSubCategories, 'Sous-catégories');
      
      // Onglet Sous-éléments
      const subElementsData: any[] = [];
      (data.domains || []).forEach((d: any) => {
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
      const wsSubElements = XLSX.utils.json_to_sheet(subElementsData.length ? subElementsData : [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Élément': '', 'Sous-catégorie': '', 'Nom': '', 'Valeur': '', 'Unité': '', 'Statut': '', 'Ordre': '' }]);
      XLSX.utils.book_append_sheet(wb, wsSubElements, 'Sous-éléments');
      
      // Onglet Alertes
      const alertsData: any[] = [];
      (data.domains || []).forEach((d: any) => {
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
      const wsAlerts = XLSX.utils.json_to_sheet(alertsData.length ? alertsData : [{ 'ID': '', 'Domaine': '', 'Catégorie': '', 'Élément': '', 'Sous-catégorie': '', 'Sous-élément': '', 'Date': '', 'Description': '', 'Durée': '', 'Ticket': '', 'Actions': '' }]);
      XLSX.utils.book_append_sheet(wb, wsAlerts, 'Alertes');
      
      // Onglet Zones
      const zonesData = (data.zones || []).map((z: any) => ({
        'ID': z.id,
        'Nom': z.name,
      }));
      const wsZones = XLSX.utils.json_to_sheet(zonesData.length ? zonesData : [{ 'ID': '', 'Nom': '' }]);
      XLSX.utils.book_append_sheet(wb, wsZones, 'Zones');
      
      // Générer le buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${cockpit.name}.xlsx"`);
      return res.send(buffer);
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
- addCategory: { domainId?: string, domainName?: string, name: string, orientation?: 'horizontal'|'vertical' }
- deleteCategory: { categoryId?: string, name?: string }
- addElement: { categoryId?: string, categoryName?: string, name: string }
- addElements: { categoryId?: string, categoryName?: string, names: string[] }
- deleteElement: { elementId?: string, name?: string }
- updateElement: { elementId?: string, name?: string, updates: { status?, value?, unit?, icon? } }
- updateStatus: { elementId?: string, elementName?: string, subElementId?: string, subElementName?: string, status: string }
- addSubCategory: { elementId?: string, name: string, orientation?: 'horizontal'|'vertical' }
- deleteSubCategory: { subCategoryId?: string, name?: string }
- addSubElement: { subCategoryId?: string, subCategoryName?: string, name: string }
- addSubElements: { subCategoryId?: string, subCategoryName?: string, names: string[] }
- deleteSubElement: { subElementId?: string, name?: string }
- selectDomain: { domainId?: string, name?: string }
- selectElement: { elementId?: string, name?: string }

CONTEXTE ACTUEL DU COCKPIT:
${JSON.stringify(cockpitContext, null, 2)}

INSTRUCTIONS:
1. Réponds en français de manière concise et professionnelle
2. Si l'utilisateur demande une modification, inclus les actions appropriées dans ta réponse
3. Si tu exécutes des actions, explique ce que tu as fait
4. Tu peux créer plusieurs éléments en une seule fois avec addElements
5. Utilise les IDs existants quand disponibles, sinon utilise les noms`;

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
            if (parsed.actions) actions = parsed.actions;
          } else {
            // Chercher un objet JSON direct
            const directMatch = assistantMessage.match(/\{[\s\S]*"actions"[\s\S]*\}/);
            if (directMatch) {
              const parsed = JSON.parse(directMatch[0]);
              if (parsed.actions) actions = parsed.actions;
            }
          }
        } catch (e) {
          // Pas d'actions parsables, c'est ok
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

