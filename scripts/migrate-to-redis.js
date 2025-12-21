/**
 * Script de migration des données de la base locale (db.json) vers Upstash Redis
 * Usage: node scripts/migrate-to-redis.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration Redis
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

if (!redisUrl || !redisToken) {
  console.error('❌ Erreur: Variables d\'environnement Redis non configurées');
  console.error('   Configurez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

const DB_KEY = 'somone-cockpit-db';

async function migrate() {
  console.log('🔄 Migration des données locales vers Redis...\n');

  try {
    // 1. Charger la base locale
    const dbPath = join(__dirname, '..', 'data', 'db.json');
    console.log(`📂 Lecture de ${dbPath}...`);
    const localDbContent = readFileSync(dbPath, 'utf-8');
    const localDb = JSON.parse(localDbContent);

    console.log(`✅ Base locale chargée:`);
    console.log(`   - Utilisateurs: ${localDb.users?.length || 0}`);
    console.log(`   - Cockpits: ${localDb.cockpits?.length || 0}\n`);

    // 2. Charger la base Redis actuelle
    console.log('📡 Lecture de la base Redis actuelle...');
    const redisDb = await redis.get(DB_KEY) || { users: [], cockpits: [] };

    console.log(`✅ Base Redis actuelle:`);
    console.log(`   - Utilisateurs: ${redisDb.users?.length || 0}`);
    console.log(`   - Cockpits: ${redisDb.cockpits?.length || 0}\n`);

    // 3. Fusionner les données
    console.log('🔀 Fusion des données...');

    // Fusionner les utilisateurs (éviter les doublons par ID)
    const mergedUsers = [...(redisDb.users || [])];
    (localDb.users || []).forEach(localUser => {
      const exists = mergedUsers.find(u => u.id === localUser.id);
      if (!exists) {
        mergedUsers.push(localUser);
        console.log(`   ✅ Utilisateur ajouté: ${localUser.username}`);
      } else {
        console.log(`   ⏭️  Utilisateur déjà présent: ${localUser.username}`);
      }
    });

    // Fusionner les cockpits (éviter les doublons par ID)
    const mergedCockpits = [...(redisDb.cockpits || [])];
    (localDb.cockpits || []).forEach(localCockpit => {
      const exists = mergedCockpits.find(c => c.id === localCockpit.id);
      if (!exists) {
        mergedCockpits.push(localCockpit);
        console.log(`   ✅ Cockpit ajouté: ${localCockpit.name}`);
      } else {
        // Mettre à jour le cockpit existant avec les données locales
        const index = mergedCockpits.findIndex(c => c.id === localCockpit.id);
        mergedCockpits[index] = localCockpit;
        console.log(`   🔄 Cockpit mis à jour: ${localCockpit.name}`);
      }
    });

    // 4. Sauvegarder dans Redis
    const mergedDb = {
      users: mergedUsers,
      cockpits: mergedCockpits,
      templates: localDb.templates || redisDb.templates || [],
      systemPrompt: localDb.systemPrompt || redisDb.systemPrompt
    };

    console.log(`\n💾 Sauvegarde dans Redis...`);
    await redis.set(DB_KEY, mergedDb);

    console.log(`\n✅ Migration terminée avec succès !`);
    console.log(`   - Utilisateurs: ${mergedUsers.length}`);
    console.log(`   - Cockpits: ${mergedCockpits.length}`);
    console.log(`   - Templates: ${mergedDb.templates?.length || 0}\n`);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

migrate();








