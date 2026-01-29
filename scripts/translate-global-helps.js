/**
 * Script pour traduire automatiquement les aides contextuelles globales vers l'anglais
 * Utilise l'API DeepL pour la traduction
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DB_KEY = 'somone-cockpit-db';

// Upstash Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

/**
 * Traduit un texte avec DeepL
 */
async function translateWithDeepL(text, targetLang = 'EN') {
  if (!DEEPL_API_KEY || !text || text.trim() === '') {
    return text;
  }

  try {
    // Déterminer l'URL de l'API DeepL
    const isFreeApi = DEEPL_API_KEY.startsWith('fx-') || DEEPL_API_KEY.startsWith('free-');
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(DEEPL_API_KEY);
    const isPaidApi = DEEPL_API_KEY.includes(':') || isUuidFormat;
    const apiUrl = isFreeApi
      ? 'https://api-free.deepl.com/v2/translate'
      : isPaidApi
        ? 'https://api.deepl.com/v2/translate'
        : 'https://api-free.deepl.com/v2/translate';

    const params = {
      text: text,
      target_lang: targetLang,
      source_lang: 'FR',
      tag_handling: 'html', // Préserver le HTML
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepL API error: ${response.status} ${response.statusText}`, errorText);
      return text;
    }

    const data = await response.json();
    return data.translations?.[0]?.text || text;
  } catch (error) {
    console.error('Erreur traduction DeepL:', error);
    return text;
  }
}

async function main() {
  console.log('🌍 Traduction des aides contextuelles globales vers l\'anglais\n');

  if (!DEEPL_API_KEY) {
    console.error('❌ DEEPL_API_KEY non configurée');
    process.exit(1);
  }

  console.log('📡 Connexion à Redis...');
  
  // Récupérer la base de données
  const db = await redis.get(DB_KEY);
  
  if (!db) {
    console.error('❌ Base de données non trouvée');
    process.exit(1);
  }

  const contextualHelps = db.contextualHelps || [];
  console.log(`\n📚 ${contextualHelps.length} aide(s) contextuelle(s) trouvée(s)\n`);

  if (contextualHelps.length === 0) {
    console.log('Aucune aide à traduire.');
    process.exit(0);
  }

  // Filtrer les aides sans traduction anglaise
  const helpsToTranslate = contextualHelps.filter(h => h.content && (!h.contentEN || h.contentEN.trim() === ''));
  
  console.log(`🔄 ${helpsToTranslate.length} aide(s) à traduire (sans contentEN)\n`);

  if (helpsToTranslate.length === 0) {
    console.log('✅ Toutes les aides ont déjà une traduction anglaise.');
    process.exit(0);
  }

  let translated = 0;
  let errors = 0;

  for (const help of helpsToTranslate) {
    console.log(`\n📝 Traduction de: ${help.elementKey}`);
    console.log(`   FR (${help.content.length} chars): ${help.content.substring(0, 100)}...`);

    try {
      const translatedContent = await translateWithDeepL(help.content, 'EN');
      
      if (translatedContent && translatedContent !== help.content) {
        // Trouver et mettre à jour l'aide dans le tableau
        const index = db.contextualHelps.findIndex(h => h.id === help.id);
        if (index >= 0) {
          db.contextualHelps[index].contentEN = translatedContent;
          translated++;
          console.log(`   EN (${translatedContent.length} chars): ${translatedContent.substring(0, 100)}...`);
          console.log(`   ✅ Traduit !`);
        }
      } else {
        console.log(`   ⚠️ Traduction identique ou échouée`);
        errors++;
      }
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`);
      errors++;
    }

    // Pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Sauvegarder la base de données
  if (translated > 0) {
    console.log('\n💾 Sauvegarde de la base de données...');
    await redis.set(DB_KEY, db);
    console.log('✅ Base de données sauvegardée');
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Résumé:`);
  console.log(`   - Aides traduites: ${translated}`);
  console.log(`   - Erreurs: ${errors}`);
  console.log(`   - Total: ${contextualHelps.length}`);
  console.log('='.repeat(50));
}

main().catch(console.error);
