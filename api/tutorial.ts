// GET /api/tutorial - Récupérer le tutoriel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, setCorsHeaders } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDb();
    
    // Retourner le tutoriel s'il existe, sinon un tutoriel vide
    return res.json({
      tutorial: {
        steps: db.journeySteps || [],
        journeys: db.journeys || []
      }
    });
  } catch (error: any) {
    console.error('[TUTORIAL] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
