/**
 * Script de diagnostic pour vérifier les cockpits dans la base de données
 * Usage: node scripts/check-cockpits.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function checkLocalDatabase() {
  console.log('🔍 Diagnostic de la base de données locale...\n');

  try {
    const dbPath = join(__dirname, '..', 'data', 'db.json');
    console.log(`📂 Lecture de ${dbPath}...`);

    const fs = await import('fs');
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Le fichier db.json n\'existe pas !');
      return;
    }

    const dbContent = readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(dbContent);

    console.log(`\n✅ Base de données locale:`);
    console.log(`   - Utilisateurs: ${db.users?.length || 0}`);
    db.users?.forEach((u, i) => {
      console.log(`     ${i + 1}. ${u.username} (${u.id}) - Admin: ${u.isAdmin}`);
    });

    console.log(`\n   - Cockpits: ${db.cockpits?.length || 0}`);
    if (db.cockpits && db.cockpits.length > 0) {
      db.cockpits.forEach((c, i) => {
        console.log(`     ${i + 1}. "${c.name}" (${c.id})`);
        console.log(`        - Utilisateur: ${c.userId}`);
        console.log(`        - Créé le: ${c.createdAt}`);
        console.log(`        - Modifié le: ${c.updatedAt}`);
        console.log(`        - Domaines: ${c.data?.domains?.length || 0}`);
        console.log(`        - Publié: ${c.data?.isPublished ? 'Oui' : 'Non'}`);
        if (c.data?.publicId) {
          console.log(`        - Public ID: ${c.data.publicId}`);
        }
      });
    } else {
      console.log('   ⚠️  Aucun cockpit trouvé dans la base locale !');
    }

    console.log(`\n   - Templates: ${db.templates?.length || 0}\n`);

  } catch (error) {
    console.error('❌ Erreur lors de la lecture:', error);
  }
}

checkLocalDatabase();







