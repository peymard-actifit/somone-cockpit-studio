// GET /api/auth/me - Données utilisateur connecté
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, verifyToken, setCorsHeaders } from '../_lib';

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

    return res.json({
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        userType: user.userType || (user.isAdmin ? 'admin' : 'standard'),
        canBecomeAdmin: user.canBecomeAdmin
      }
    });
  } catch (error: any) {
    console.error('[AUTH/ME] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
