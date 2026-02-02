// GET/POST /api/translations - Traduction avec DeepL
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, DEEPL_API_KEY } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { texts, targetLang } = req.body;

    if (!texts || !targetLang) {
      return res.status(400).json({ error: 'texts et targetLang requis' });
    }

    if (!DEEPL_API_KEY) {
      console.warn('[TRANSLATIONS] DeepL API key non configurée');
      return res.status(503).json({ error: 'Service de traduction non configuré' });
    }

    // Appel à l'API DeepL
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: Array.isArray(texts) ? texts : [texts],
        target_lang: targetLang.toUpperCase(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TRANSLATIONS] Erreur DeepL:', errorText);
      return res.status(response.status).json({ error: 'Erreur de traduction' });
    }

    const data = await response.json();
    return res.json({ translations: data.translations });
  } catch (error: any) {
    console.error('[TRANSLATIONS] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
