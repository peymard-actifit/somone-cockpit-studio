import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'somone-cockpit-secret-key-change-in-production';
const ADMIN_CODE = process.env.ADMIN_CODE || 'SOMONE2024';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Base de données JSON simple
const dataDir = join(__dirname, '..', 'data');

// Créer le dossier data s'il n'existe pas
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Fonction pour obtenir le chemin de la base de données
function getDbPath(): string {
  return join(dataDir, 'db.json');
}

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

interface Template {
  id: string;
  name: string;
  type: string;
  isForDomain: boolean;
  userId: string;
  createdAt: string;
}

interface Database {
  users: User[];
  cockpits: CockpitData[];
  templates: Template[];
}

// Charger ou initialiser la base de données
function loadDb(): Database {
  const dbPath = getDbPath();
  if (existsSync(dbPath)) {
    try {
      const data = readFileSync(dbPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { users: [], cockpits: [], templates: [] };
    }
  }
  return { users: [], cockpits: [], templates: [] };
}

function saveDb(db: Database): void {
  writeFileSync(getDbPath(), JSON.stringify(db, null, 2), 'utf-8');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth middleware
interface AuthRequest extends express.Request {
  user?: { id: string; username: string; isAdmin: boolean };
}

const authMiddleware = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; isAdmin: boolean };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// Generate UUID
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Routes: Auth
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }
  
  const db = loadDb();
  const existing = db.users.find(u => u.username === username);
  if (existing) {
    return res.status(400).json({ error: 'Cet identifiant est déjà utilisé' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = generateId();
  const now = new Date().toISOString();
  
  const newUser: User = {
    id,
    username,
    password: hashedPassword,
    isAdmin: false,
    createdAt: now
  };
  
  db.users.push(newUser);
  saveDb(db);
  
  const token = jwt.sign({ id, username, isAdmin: false }, JWT_SECRET, { expiresIn: '30d' });
  
  res.json({
    user: { id, username, isAdmin: false, createdAt: now },
    token,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  const db = loadDb();
  const user = db.users.find(u => u.username === username);
  
  if (!user) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '30d' });
  
  res.json({
    user: { id: user.id, username: user.username, isAdmin: user.isAdmin, createdAt: user.createdAt },
    token,
  });
});

app.post('/api/auth/change-password', authMiddleware, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body;
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
  }
  
  const db = loadDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
  
  const validPassword = await bcrypt.compare(oldPassword, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
  }
  
  user.password = await bcrypt.hash(newPassword, 10);
  saveDb(db);
  
  res.json({ success: true });
});

app.post('/api/auth/toggle-admin', authMiddleware, (req: AuthRequest, res) => {
  const { code } = req.body;
  
  const db = loadDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
  
  if (user.isAdmin) {
    // Quitter le mode admin
    user.isAdmin = false;
    saveDb(db);
    return res.json({ isAdmin: false });
  }
  
  if (code !== ADMIN_CODE) {
    return res.status(401).json({ error: 'Code administrateur incorrect' });
  }
  
  user.isAdmin = true;
  saveDb(db);
  res.json({ isAdmin: true });
});

// Routes: Cockpits
app.get('/api/cockpits', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  let cockpits;
  
  if (req.user!.isAdmin) {
    cockpits = db.cockpits;
  } else {
    cockpits = db.cockpits.filter(c => c.userId === req.user!.id);
  }
  
  res.json(cockpits.map(c => ({
    id: c.id,
    name: c.name,
    userId: c.userId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    domains: [],
    // Infos de publication
    publicId: c.data?.publicId,
    isPublished: c.data?.isPublished || false,
    publishedAt: c.data?.publishedAt,
  })));
});

app.get('/api/cockpits/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.id === req.params.id);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  const data = cockpit.data || { domains: [], zones: [] };
  
  res.json({
    id: cockpit.id,
    name: cockpit.name,
    userId: cockpit.userId,
    createdAt: cockpit.createdAt,
    updatedAt: cockpit.updatedAt,
    ...data,
  });
});

app.post('/api/cockpits', authMiddleware, (req: AuthRequest, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Nom requis' });
  }
  
  const db = loadDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  const newCockpit: CockpitData = {
    id,
    name,
    userId: req.user!.id,
    data: { domains: [], zones: [] },
    createdAt: now,
    updatedAt: now
  };
  
  db.cockpits.push(newCockpit);
  saveDb(db);
  
  res.json({
    id,
    name,
    userId: req.user!.id,
    createdAt: now,
    updatedAt: now,
    domains: [],
  });
});

app.put('/api/cockpits/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.id === req.params.id);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  const { name, domains, zones, logo, scrollingBanner, publicId, isPublished, publishedAt } = req.body;
  const now = new Date().toISOString();
  
  cockpit.name = name || cockpit.name;
  
  // Préserver les données existantes et fusionner avec les nouvelles
  const existingData = cockpit.data || {};
  
  // Si des domaines sont fournis, faire un merge intelligent pour préserver les backgroundImage
  let mergedDomains = existingData.domains || [];
  if (domains !== undefined && Array.isArray(domains)) {
    // Faire un merge domaine par domaine pour préserver les backgroundImage existantes
    mergedDomains = domains.map((newDomain: any) => {
      // Chercher le domaine existant correspondant
      const existingDomain = existingData.domains?.find((d: any) => d.id === newDomain.id);
      
      if (existingDomain) {
        // Merge : préserver backgroundImage et mapBounds si pas fournis dans la nouvelle version
        return {
          ...existingDomain,
          ...newDomain,
          // Préserver backgroundImage si elle n'est pas dans la nouvelle version
          backgroundImage: newDomain.backgroundImage !== undefined ? newDomain.backgroundImage : existingDomain.backgroundImage,
          // Préserver mapBounds si pas fourni
          mapBounds: newDomain.mapBounds !== undefined ? newDomain.mapBounds : existingDomain.mapBounds,
        };
      } else {
        // Nouveau domaine, utiliser tel quel
        return newDomain;
      }
    });
  }
  
  cockpit.data = {
    ...existingData,
    domains: mergedDomains,
    zones: zones !== undefined ? zones : existingData.zones || [],
    logo: logo !== undefined ? logo : existingData.logo,
    scrollingBanner: scrollingBanner !== undefined ? scrollingBanner : existingData.scrollingBanner,
    publicId: publicId !== undefined ? publicId : existingData.publicId,
    isPublished: isPublished !== undefined ? isPublished : existingData.isPublished,
    publishedAt: publishedAt !== undefined ? publishedAt : existingData.publishedAt,
  };
  
  cockpit.updatedAt = now;
  
  saveDb(db);
  
  res.json({ success: true });
});

app.post('/api/cockpits/:id/duplicate', authMiddleware, (req: AuthRequest, res) => {
  const { name } = req.body;
  
  const db = loadDb();
  const original = db.cockpits.find(c => c.id === req.params.id);
  
  if (!original) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  if (!req.user!.isAdmin && original.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  const id = generateId();
  const now = new Date().toISOString();
  
  const newCockpit: CockpitData = {
    id,
    name: name || `${original.name} - Copie`,
    userId: req.user!.id,
    data: JSON.parse(JSON.stringify(original.data)),
    createdAt: now,
    updatedAt: now
  };
  
  db.cockpits.push(newCockpit);
  saveDb(db);
  
  res.json({
    id,
    name: newCockpit.name,
    userId: req.user!.id,
    createdAt: now,
    updatedAt: now,
    ...newCockpit.data,
  });
});

app.delete('/api/cockpits/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  const cockpitIndex = db.cockpits.findIndex(c => c.id === req.params.id);
  
  if (cockpitIndex === -1) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  const cockpit = db.cockpits[cockpitIndex];
  
  if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  db.cockpits.splice(cockpitIndex, 1);
  saveDb(db);
  
  res.json({ success: true });
});

// Publier un cockpit
app.post('/api/cockpits/:id/publish', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.id === req.params.id);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  // Générer un ID public unique s'il n'existe pas
  if (!cockpit.data.publicId) {
    cockpit.data.publicId = generateId().substring(0, 12);
  }
  
  cockpit.data.isPublished = true;
  cockpit.data.publishedAt = new Date().toISOString();
  saveDb(db);
  
  res.json({ 
    success: true, 
    publicId: cockpit.data.publicId,
    publishedAt: cockpit.data.publishedAt
  });
});

// Dépublier un cockpit
app.post('/api/cockpits/:id/unpublish', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.id === req.params.id);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  cockpit.data.isPublished = false;
  saveDb(db);
  
  res.json({ success: true });
});

// Route publique pour accéder à un cockpit publié (sans authentification)
app.get('/api/public/cockpit/:publicId', (req, res) => {
  const publicId = req.params.publicId;
  console.log('[Public API] Recherche cockpit avec publicId:', publicId);
  
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);
  
  if (!cockpit) {
    console.log('[Public API] Cockpit non trouvé pour publicId:', publicId);
    return res.status(404).json({ error: 'Maquette non trouvée ou non publiée' });
  }
  
  console.log('[Public API] Cockpit trouvé:', cockpit.name);
  const data = cockpit.data || { domains: [], zones: [] };
  
  // Log des images pour débogage
  const domains = data.domains || [];
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
  
  res.json(response);
});

// Export Excel
app.get('/api/cockpits/:id/export', authMiddleware, (req: AuthRequest, res) => {
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.id === req.params.id);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Maquette non trouvée' });
  }
  
  if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
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
  res.send(buffer);
});

// Templates
app.get('/api/templates', authMiddleware, (_req: AuthRequest, res) => {
  const db = loadDb();
  res.json(db.templates.map(t => ({
    id: t.id,
    name: t.name,
    type: t.type,
    isForDomain: t.isForDomain,
    userId: t.userId,
    createdAt: t.createdAt,
  })));
});

// API Assistant IA avec OpenAI
app.post('/api/ai/chat', authMiddleware, async (req: AuthRequest, res) => {
  const { message, cockpitContext, history = [] } = req.body;
  
  // Vérifier la clé API - essayer plusieurs méthodes
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Clé API OpenAI non configurée. Ajoutez OPENAI_API_KEY dans vos variables d\'environnement.' 
    });
  }
  
  try {
    const systemPrompt = `Tu es un assistant IA pour le studio de cockpit SOMONE. Tu aides les utilisateurs à créer et modifier leurs maquettes de cockpit.

CONTEXTE DU COCKPIT ACTUEL:
${JSON.stringify(cockpitContext, null, 2)}

RÈGLES IMPORTANTES:
1. Tu DOIS retourner un bloc \`\`\`action\`\`\` pour CHAQUE action demandée
2. Utilise les NOMS plutôt que les IDs quand possible - le système peut trouver les IDs automatiquement
3. Si l'utilisateur ne précise pas où créer quelque chose, utilise le domaine/catégorie/élément actuellement sélectionné
4. Réponds TOUJOURS en français et sois concis

Pour les actions, utilise ce format:
\`\`\`action
{ "type": "...", "params": { ... } }
\`\`\`

Types d'actions disponibles:

CRÉATION:
- addDomain: { name: "NOM" }
- addCategory: { name: "Nom", orientation?: "horizontal"|"vertical", domainName?: "..." }
- addElement: { name: "Nom", categoryName?: "..." }
- addElements: { names: ["Nom1", "Nom2"], categoryName?: "..." }
- addSubCategory: { name: "Nom", orientation?: "horizontal"|"vertical" }
- addSubElement: { name: "Nom", subCategoryName?: "..." }
- addSubElements: { names: ["Nom1", "Nom2"], subCategoryName?: "..." }

MODIFICATION:
- updateElement: { elementName: "...", updates: { name?, value?, unit?, status?, icon? } }
- updateStatus: { elementName?: "...", subElementName?: "...", status: "ok"|"mineur"|"critique"|"fatal"|"deconnecte" }

SUPPRESSION:
- deleteDomain: { name: "..." }
- deleteCategory: { name: "..." }
- deleteElement: { name: "..." }
- deleteSubCategory: { name: "..." }
- deleteSubElement: { name: "..." }

NAVIGATION:
- selectDomain: { name: "..." }
- selectElement: { name: "..." }

EXEMPLE - Créer 3 éléments:
\`\`\`action
{ "type": "addElements", "params": { "names": ["Élément A", "Élément B", "Élément C"] } }
\`\`\`

EXEMPLE - Actions multiples:
\`\`\`action
[
  { "type": "addCategory", "params": { "name": "Sécurité" } },
  { "type": "addElements", "params": { "names": ["Alarme", "Détecteur"], "categoryName": "Sécurité" } }
]
\`\`\`

Statuts: ok (vert), mineur (orange), critique (rouge), fatal (violet), deconnecte (gris)`;

    // Construire les messages avec l'historique
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Ajouter l'historique de la conversation (limité aux 20 derniers messages pour éviter de dépasser les limites)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      chatMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // Ajouter le nouveau message
    chatMessages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erreur OpenAI:', errorData);
      return res.status(500).json({ error: 'Erreur lors de la communication avec OpenAI' });
    }
    
    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.';
    
    // Extraire les actions du message (peut être un tableau ou une action unique)
    const actionMatch = aiMessage.match(/```action\n([\s\S]*?)\n```/);
    let actions: any[] = [];
    
    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[1]);
        // Si c'est un tableau, utiliser directement, sinon wrapper dans un tableau
        actions = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        console.error('Erreur parsing action:', actionMatch[1]);
      }
    }
    
    res.json({
      message: aiMessage.replace(/```action\n[\s\S]*?\n```/g, '').trim(),
      actions, // Retourner un tableau d'actions
    });
    
  } catch (error) {
    console.error('Erreur API IA:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour vérifier si l'API OpenAI est configurée
app.get('/api/ai/status', authMiddleware, (_req: AuthRequest, res) => {
  res.json({ 
    configured: !!OPENAI_API_KEY,
    model: 'gpt-4o-mini'
  });
});

// API Assistant IA publique pour les cockpits publiés (sans authentification, sécurisée par publicId)
app.post('/api/public/ai/chat/:publicId', async (req, res) => {
  const { publicId } = req.params;
  const { message, history = [] } = req.body;
  
  // Vérifier que le cockpit existe et est publié
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Cockpit non trouvé ou non publié' });
  }
  
  // Vérifier la clé API - essayer plusieurs méthodes
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[AI Chat Public] OPENAI_API_KEY non configurée');
    return res.status(500).json({ 
      error: 'Clé API OpenAI non configurée. L\'assistant IA n\'est pas disponible.' 
    });
  }
  
  try {
    const cockpitContext = {
      name: cockpit.name,
      domains: (cockpit.data?.domains || []).map((d: any) => ({
        name: d.name,
        templateType: d.templateType,
        categories: (d.categories || []).map((c: any) => ({
          name: c.name,
          elements: (c.elements || []).map((e: any) => ({
            name: e.name,
            status: e.status,
            value: e.value,
            unit: e.unit,
          })),
        })),
      })),
    };
    
    const systemPrompt = `Tu es un assistant IA pour le cockpit SOMONE "${cockpit.name}". Tu aides les utilisateurs à comprendre et analyser les données du cockpit en mode consultation.

CONTEXTE DU COCKPIT:
${JSON.stringify(cockpitContext, null, 2)}

RÈGLES IMPORTANTES:
1. Tu es en MODE CONSULTATION SEULEMENT - tu ne peux pas modifier le cockpit
2. Réponds TOUJOURS en français et sois concis
3. Aide les utilisateurs à comprendre les données, les statuts, et les métriques
4. Tu peux analyser les tendances, identifier les problèmes, suggérer des observations
5. Ne propose pas d'actions de modification, seulement des analyses et conseils

EXEMPLES DE QUESTIONS:
- "Combien d'éléments sont en statut critique ?"
- "Quels sont les domaines du cockpit ?"
- "Analyse les données du cockpit"
- "Y a-t-il des alertes ?"

Réponds de manière claire et utile.`;
    
    // Construire les messages avec l'historique
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Ajouter l'historique de la conversation (limité aux 20 derniers messages)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      chatMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // Ajouter le nouveau message
    chatMessages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erreur OpenAI (public):', errorData);
      return res.status(500).json({ error: 'Erreur lors de la communication avec OpenAI' });
    }
    
    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.';
    
    res.json({
      message: aiMessage,
    });
    
  } catch (error) {
    console.error('Erreur API IA publique:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour vérifier si l'API OpenAI est configurée (version publique)
app.get('/api/public/ai/status/:publicId', (req, res) => {
  const { publicId } = req.params;
  
  // Vérifier que le cockpit existe et est publié
  const db = loadDb();
  const cockpit = db.cockpits.find(c => c.data?.publicId === publicId && c.data?.isPublished);
  
  if (!cockpit) {
    return res.status(404).json({ error: 'Cockpit non trouvé ou non publié' });
  }
  
  // Vérifier la clé API - essayer plusieurs méthodes
  const envKey = process.env.OPENAI_API_KEY;
  const constKey = OPENAI_API_KEY;
  const hasKey = !!(envKey || constKey);
  const keyLength = (envKey || constKey || '').length;
  const keyPrefix = (envKey || constKey || '').substring(0, 7);
  
  console.log(`[AI Status] PublicId: ${publicId}, Has Key: ${hasKey}, Length: ${keyLength}, Prefix: ${keyPrefix}`);
  console.log(`[AI Status] envKey exists: ${!!envKey}, constKey exists: ${!!constKey}`);
  
  res.json({ 
    configured: hasKey,
    model: 'gpt-4o-mini',
    debug: process.env.NODE_ENV === 'development' ? {
      hasKey,
      keyLength,
      keyPrefix,
      envVarExists: !!envKey,
      constKeyExists: !!constKey,
    } : undefined
  });
});

// Endpoint pour analyser une image de carte et détecter les coordonnées GPS
app.post('/api/ai/analyze-map', authMiddleware, async (req: AuthRequest, res) => {
  const { imageUrl } = req.body;
  
  // Vérifier la clé API - essayer plusieurs méthodes
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Clé API OpenAI non configurée.' 
    });
  }
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'URL de l\'image requise' });
  }
  
  console.log('Analyse carte - URL reçue:', imageUrl.substring(0, 100) + '...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en géographie. Regarde cette image de carte et identifie quel pays ou région elle représente.

Retourne les coordonnées GPS des LIMITES VISIBLES de la carte (pas les limites exactes du pays, mais ce qui est visible sur l'image).

EXEMPLES DE COORDONNÉES CONNUES:
- France métropolitaine: topLeft(lat:51.1, lng:-5.1), bottomRight(lat:41.3, lng:9.6)
- Espagne: topLeft(lat:43.8, lng:-9.3), bottomRight(lat:36.0, lng:4.3)
- Italie: topLeft(lat:47.1, lng:6.6), bottomRight(lat:36.6, lng:18.5)
- Allemagne: topLeft(lat:55.1, lng:5.9), bottomRight(lat:47.3, lng:15.0)
- Royaume-Uni: topLeft(lat:60.8, lng:-8.6), bottomRight(lat:49.9, lng:1.8)

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans aucun texte avant ou après.

{
  "detected": true,
  "region": "France",
  "topLeft": { "lat": 51.1, "lng": -5.1 },
  "bottomRight": { "lat": 41.3, "lng": 9.6 },
  "confidence": "high",
  "description": "Carte de la France métropolitaine"
}

Si tu ne reconnais pas la carte:
{
  "detected": false,
  "reason": "Impossible d'identifier la zone géographique"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Quel pays ou région est représenté sur cette carte ? Donne-moi les coordonnées GPS des coins.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    
    console.log('Réponse OpenAI status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erreur OpenAI Vision:', JSON.stringify(errorData, null, 2));
      const errorMessage = errorData.error?.message || 'Erreur lors de l\'analyse de l\'image';
      return res.status(500).json({ 
        error: errorMessage,
        details: errorData.error?.code || 'unknown'
      });
    }
    
    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || '';
    
    console.log('Réponse IA brute:', aiMessage);
    
    // Parser le JSON de la réponse
    try {
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      let cleanedMessage = aiMessage.trim();
      if (cleanedMessage.startsWith('```json')) {
        cleanedMessage = cleanedMessage.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedMessage.startsWith('```')) {
        cleanedMessage = cleanedMessage.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      const result = JSON.parse(cleanedMessage);
      console.log('Résultat parsé:', JSON.stringify(result, null, 2));
      res.json(result);
    } catch (parseError) {
      console.error('Erreur parsing réponse IA:', aiMessage);
      res.json({ 
        detected: false, 
        reason: 'Impossible de parser la réponse de l\'IA',
        rawResponse: aiMessage
      });
    }
    
  } catch (error) {
    console.error('Erreur API analyse carte:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📦 Environnement: ${process.env.NODE_ENV || 'production'}`);
  
  // Diagnostic de la clé API
  const hasKey = !!OPENAI_API_KEY;
  const keyLength = OPENAI_API_KEY ? OPENAI_API_KEY.length : 0;
  const keyPrefix = OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'none';
  
  console.log(`🔑 OPENAI_API_KEY présente: ${hasKey}`);
  if (hasKey) {
    console.log(`✅ Assistant IA OpenAI activé (clé de ${keyLength} caractères, préfixe: ${keyPrefix})`);
  } else {
    console.log('⚠️  Assistant IA désactivé - OPENAI_API_KEY non configurée');
    console.log('💡 Pour activer: Ajoutez OPENAI_API_KEY dans les variables d\'environnement Vercel');
  }
  
  // Vérifier aussi process.env directement
  if (process.env.OPENAI_API_KEY) {
    console.log(`📝 Variable d'environnement process.env.OPENAI_API_KEY détectée`);
  } else {
    console.log(`⚠️  Variable d'environnement process.env.OPENAI_API_KEY NON détectée`);
  }
});
