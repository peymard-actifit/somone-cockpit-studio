// POST /api/auth/register - Inscription utilisateur
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, saveDb, createToken, hashPassword, setCorsHeaders, generateId } from '../_lib';
import type { User, UserType } from '../_lib';

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
    const isAdmin = isFirstUser;
    const userType: UserType = isFirstUser ? 'admin' : 'standard';

    const newUser: User = {
      id,
      username,
      password: hashedPassword,
      isAdmin,
      userType,
      canBecomeAdmin: userType === 'standard' ? true : undefined,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    await saveDb(db);

    const token = createToken({ id, isAdmin });

    return res.json({
      user: { id, username, isAdmin, userType, canBecomeAdmin: newUser.canBecomeAdmin },
      token
    });
  } catch (error: any) {
    console.error('[REGISTER] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
