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
const ADMIN_CODE = process.env.ADMIN_CODE || '12411241';
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
    // Ordre pour le drag & drop
    order: c.data?.order,
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
  
  // SIMPLIFICATION : Merge profond pour préserver TOUTES les propriétés des domaines existants
  let mergedDomains = existingData.domains || [];
  if (domains !== undefined && Array.isArray(domains)) {
    mergedDomains = domains.map((newDomain: any) => {
      const existingDomain = existingData.domains?.find((d: any) => d.id === newDomain.id);
      
      if (existingDomain) {
        // MERGE PROFOND : Partir de l'existant et appliquer les nouvelles valeurs
        // Mais PRÉSERVER backgroundImage et mapBounds si pas explicitement fournis ou vides
        const merged: any = {
          ...existingDomain,  // D'abord toutes les propriétés existantes
          ...newDomain,       // Puis les nouvelles propriétés
        };
        
        // FORCER la préservation si backgroundImage n'est pas valide dans newDomain
        if (!newDomain.backgroundImage || newDomain.backgroundImage === '' || newDomain.backgroundImage === null) {
          if (existingDomain.backgroundImage && existingDomain.backgroundImage !== '') {
            merged.backgroundImage = existingDomain.backgroundImage;
            console.log(`[PUT] Préservé backgroundImage pour "${newDomain.name}" (${existingDomain.backgroundImage.length} chars)`);
          }
        }
        
        // FORCER la préservation si mapBounds n'est pas valide dans newDomain
        if (!newDomain.mapBounds || (!newDomain.mapBounds.topLeft && !newDomain.mapBounds.bottomRight)) {
          if (existingDomain.mapBounds && (existingDomain.mapBounds.topLeft || existingDomain.mapBounds.bottomRight)) {
            merged.mapBounds = existingDomain.mapBounds;
          }
        }
        
        return merged;
      } else {
        // Nouveau domaine
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
app.post('/api/cockpits/reorder', authMiddleware, (req: AuthRequest, res) => {
  const { cockpitIds } = req.body;
  
  if (!Array.isArray(cockpitIds)) {
    return res.status(400).json({ error: 'cockpitIds doit être un tableau' });
  }
  
  const db = loadDb();
  
  // Mettre à jour l'ordre de chaque cockpit
  cockpitIds.forEach((cockpitId: string, index: number) => {
    const cockpit = db.cockpits.find(c => c.id === cockpitId);
    if (cockpit) {
      // Vérifier les permissions
      if (!req.user!.isAdmin && cockpit.userId !== req.user!.id) {
        return; // Ignorer les cockpits non autorisés
      }
      
      if (!cockpit.data) {
        cockpit.data = {};
      }
      cockpit.data.order = index;
      cockpit.updatedAt = new Date().toISOString();
    }
  });
  
  saveDb(db);
  res.json({ success: true });
});

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
  
  // SIMPLIFICATION : Retourner directement les données telles quelles, sans transformation
  console.log(`[Public API] Cockpit "${cockpit.name}" trouvé`);
  console.log(`[Public API] Domains count: ${(data.domains || []).length}`);
  
  // Log des images dans chaque domaine
  (data.domains || []).forEach((domain: any, index: number) => {
    const hasImage = domain.backgroundImage && domain.backgroundImage.length > 0;
    console.log(`[Public API] Domain[${index}] "${domain.name}": backgroundImage=${hasImage ? `PRESENTE (${domain.backgroundImage.length} chars)` : 'ABSENTE'}`);
    if (hasImage) {
      console.log(`[Public API]   Preview: ${domain.backgroundImage.substring(0, 50)}...`);
    }
  });
  
  // Retourner les données telles quelles - PAS de transformation
  res.json({
    id: cockpit.id,
    name: cockpit.name,
    createdAt: cockpit.createdAt,
    updatedAt: cockpit.updatedAt,
    domains: data.domains || [],
    zones: data.zones || [],
    logo: data.logo || null,
    scrollingBanner: data.scrollingBanner || null,
    publicId: data.publicId || null,
    isPublished: data.isPublished || false,
    publishedAt: data.publishedAt || null,
  });
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
  
  // Onglets pour les domaines "Suivi des heures" (un onglet par domaine)
  (data.domains || []).forEach((d: any) => {
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
        { 'Libellé': 'Prix de vente au client (€)', 'Valeur': hoursData.salePrice || 0 },
        { 'Libellé': 'Coût global (€)', 'Valeur': '' }, // Sera calculé
        { 'Libellé': 'Marge (€)', 'Valeur': '' }, // Sera calculé
      ];
      
      // Calculer le coût global
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
      
      // Section 2 : Tableau des ressources et imputations
      const resourcesData: any[] = [];
      
      // En-tête avec dates
      const headerRow: any = {
        'Type': 'Type',
        'Nom': 'Nom',
        'TJM (€)': 'TJM (€)',
        'Jours': 'Jours',
        'Total (€)': 'Total (€)'
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
          'TJM (€)': r.type === 'person' ? (r.dailyRate || 0) : '',
          'Jours': '',
          'Total (€)': ''
        };
        
        // Calculer jours et total pour les personnes
        if (r.type === 'person') {
          const days = (r.timeEntries || []).length * 0.5;
          const total = (r.dailyRate || 0) * days;
          row['Jours'] = days;
          row['Total (€)'] = total;
        } else {
          // Total pour les fournisseurs
          const total = (r.entries || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          row['Total (€)'] = total;
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
        'TJM (€)': '',
        'Jours': '',
        'Total (€)': ''
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
        { 'Date': 'Date', 'Jours imputés': 'Jours imputés', 'Coût cumulé (€)': 'Coût cumulé (€)', 'Coût fournisseurs cumulé (€)': 'Coût fournisseurs cumulé (€)', 'Prix de vente (€)': 'Prix de vente (€)' }
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
        
        // Calculer coût cumulé
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
        
        // Calculer coût fournisseurs cumulé
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
          'Coût cumulé (€)': cumulativeCost,
          'Coût fournisseurs cumulé (€)': cumulativeSupplierCost,
          'Prix de vente (€)': hoursData.salePrice || 0
        });
      });
      
      // Créer une feuille combinée avec toutes les sections
      const combinedData: any[] = [];
      
      // Ajouter les informations générales
      combinedData.push({ '': '=== INFORMATIONS GÉNÉRALES ===' });
      combinedData.push({});
      generalInfo.forEach((row: any) => {
        combinedData.push(row);
      });
      combinedData.push({});
      combinedData.push({ '': '=== RESSOURCES ET IMPUTATIONS ===' });
      combinedData.push({});
      
      // Ajouter le tableau des ressources
      resourcesData.forEach((row: any) => {
        combinedData.push(row);
      });
      
      combinedData.push({});
      combinedData.push({ '': '=== DONNÉES POUR GRAPHIQUE ===' });
      combinedData.push({});
      
      // Ajouter les données du graphique
      chartData.forEach((row: any) => {
        combinedData.push(row);
      });
      
      const wsCombined = XLSX.utils.json_to_sheet(combinedData);
      // Note: Excel limite les noms d'onglets à 31 caractères
      const sheetName = (d.name || 'Suivi des heures').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsCombined, sheetName);
    }
  });
  
  // Générer le buffer Excel
  try {
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Encoder le nom du fichier pour éviter les problèmes avec les caractères spéciaux
    const encodedFileName = encodeURIComponent(cockpit.name.replace(/[^\w\s-]/g, '')).replace(/'/g, '%27');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}.xlsx"; filename*=UTF-8''${encodedFileName}.xlsx`);
    res.setHeader('Content-Length', buffer.length.toString());
    
    res.send(buffer);
  } catch (error: any) {
    console.error('Erreur génération Excel:', error);
    return res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel: ' + error.message });
  }
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
- addZone: { name: "Nom de la zone" }
- addMapElement: { name: "Nom", lat: number, lng: number, domainName?: "...", status?: "...", icon?: "..." }

MODIFICATION:
- updateCockpit: { name?: "...", logo?: "...", scrollingBanner?: "...", updates?: { name?, logo?, scrollingBanner? } }
- updateDomain: { name?: "...", updates: { name?, templateType?, backgroundImage?, mapBounds?, enableClustering? } }
- updateCategory: { name?: "...", updates: { name?, orientation?, icon? } }
- updateElement: { elementName?: "...", updates: { name?, value?, unit?, status?, icon?, icon2?, icon3?, positionX?, positionY? } }
- updateSubCategory: { name?: "...", updates: { name?, orientation?, icon? } }
- updateSubElement: { name?: "...", updates: { name?, status?, value?, unit? } }
- updateStatus: { elementName?: "...", subElementName?: "...", status: "ok"|"mineur"|"critique"|"fatal"|"deconnecte" }
- updateMapElement: { name?: "...", updates: { name?, lat?, lng?, status?, icon? } }
- updateMapBounds: { domainName?: "...", topLeft: { lat: number, lng: number }, bottomRight: { lat: number, lng: number } }
- reorderDomains: { domainIds: ["domainId1", "domainId2", ...] }
- moveElement: { elementName?: "...", fromCategoryName?: "...", toCategoryName?: "..." }
- reorderElement: { elementName?: "...", categoryName?: "...", newIndex: number }
- moveSubElement: { subElementName?: "...", fromSubCategoryName?: "...", toSubCategoryName?: "..." }
- reorderSubElement: { subElementName?: "...", subCategoryName?: "...", newIndex: number }

DUPLICATION/CLONE:
- cloneElement: { name?: "..." }
- cloneMapElement: { name?: "..." }

SUPPRESSION:
- deleteDomain: { name: "..." }
- deleteCategory: { name: "..." }
- deleteElement: { name: "..." }
- deleteSubCategory: { name: "..." }
- deleteSubElement: { name: "..." }
- deleteZone: { name: "..." }
- deleteMapElement: { name: "..." }

NAVIGATION:
- selectDomain: { name: "..." }
- selectElement: { name: "..." }

PRÉFÉRENCES D'AFFICHAGE (indépendantes par domaine/élément):
- setDisplayPreference: { 
    domainId?: "...", domainName?: "...", 
    elementId?: "...", 
    horizontalSpacing?: 0-100, 
    categorySpacing?: 0-100, 
    subCategorySpacing?: 0-100, 
    verticalSubCategoryWidth?: 100-500, 
    greenTilesAsColored?: true|false, 
    horizontalCategoriesInline?: true|false, 
    horizontalSubCategoriesInline?: true|false 
  }
  Note: Les préférences sont indépendantes par domaine. Utilise domainName pour cibler un domaine spécifique.

EXEMPLES D'ACTIONS:

Créer 3 éléments:
\`\`\`action
{ "type": "addElements", "params": { "names": ["Élément A", "Élément B", "Élément C"] } }
\`\`\`

Actions multiples:
\`\`\`action
[
  { "type": "addCategory", "params": { "name": "Sécurité" } },
  { "type": "addElements", "params": { "names": ["Alarme", "Détecteur"], "categoryName": "Sécurité" } }
]
\`\`\`

Modifier un élément:
\`\`\`action
{ "type": "updateElement", "params": { "elementName": "Température", "updates": { "value": "25", "unit": "°C", "status": "ok" } } }
\`\`\`

Cloner un élément:
\`\`\`action
{ "type": "cloneElement", "params": { "name": "Capteur 1" } }
\`\`\`

Ajouter un point GPS sur une carte:
\`\`\`action
{ "type": "addMapElement", "params": { "name": "Site A", "lat": 48.8566, "lng": 2.3522, "status": "ok" } }
\`\`\`

Modifier le cockpit (nom, logo, bannière):
\`\`\`action
{ "type": "updateCockpit", "params": { "updates": { "name": "Nouveau nom", "logo": "data:image/..." } } }
\`\`\`

Réorganiser l'ordre des domaines:
\`\`\`action
{ "type": "reorderDomains", "params": { "domainIds": ["id1", "id2", "id3"] } }
\`\`\`

Déplacer un élément d'une catégorie à une autre:
\`\`\`action
{ "type": "moveElement", "params": { "elementName": "Température", "fromCategoryName": "Météo", "toCategoryName": "Environnement" } }
\`\`\`

Réorganiser l'ordre des éléments:
\`\`\`action
{ "type": "reorderElement", "params": { "elementName": "Capteur 1", "categoryName": "Capteurs", "newIndex": 0 } }
\`\`\`

IMPORTANT - Statuts disponibles:
- ok (vert)
- mineur (orange) 
- critique (rouge)
- fatal (violet)
- deconnecte (gris)

Toutes les actions peuvent être combinées dans un tableau pour une exécution simultanée.`;

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
        backgroundImage: d.backgroundImage ? 'présente' : null,
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
4. Tu peux :
   - Compter les éléments par statut, par domaine, par catégorie
   - Identifier les problèmes (éléments avec statut critique/fatal/mineur)
   - Expliquer la structure complète du cockpit
   - Analyser les alertes et leurs détails
   - Décrire les zones et leur utilisation
   - Analyser les points GPS sur les cartes
   - Faire des recherches croisées entre zones, domaines et éléments
   - Identifier les tendances et patterns
5. Sois précis et utilise les données réelles du cockpit dans tes réponses`;
    
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
