// GET /api/version - Version de l'API
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { APP_VERSION, setCorsHeaders } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.json({ 
    version: APP_VERSION,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
