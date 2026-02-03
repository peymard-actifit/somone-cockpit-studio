// GET /api/auth/verify - Vérification du token
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, verifyToken, setCorsHeaders } from '../_lib';
import type { UserType } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      console.log('[AUTH/VERIFY] Token invalide');
      return res.status(401).json({ error: 'Token invalide' });
    }

    console.log(`[AUTH/VERIFY] Token ID: ${decoded.id}`);

    const db = await getDb();
    let user = db.users.find(u => u.id === decoded.id);

    // SECOURS: compte principal
    if (!user && decoded.id === '1dee-2b35-2e64') {
      console.log('[AUTH/VERIFY] SECOURS: compte principal');
      user = {
        id: '1dee-2b35-2e64',
        username: 'peymard@somone.fr',
        password: '',
        isAdmin: true,
        userType: 'admin' as UserType,
        createdAt: new Date().toISOString()
      };
    }

    // SECOURS V2: redirection peymard
    if (user && (user.username === 'peymard' || decoded.id === '9346-29f2-1311')) {
      console.log('[AUTH/VERIFY] SECOURS V2: redirection');
      user = {
        id: '1dee-2b35-2e64',
        username: 'peymard@somone.fr',
        password: '',
        isAdmin: true,
        userType: 'admin' as UserType,
        createdAt: new Date().toISOString()
      };
    }

    if (!user) {
      console.log(`[AUTH/VERIFY] Utilisateur non trouvé: ${decoded.id}`);
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    console.log(`[AUTH/VERIFY] Succès: ${user.username}`);
    return res.json({
      user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin }
    });
  } catch (error: any) {
    console.error('[AUTH/VERIFY] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
