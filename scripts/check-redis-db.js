/**
 * Script de diagnostic pour verifier les cockpits dans Redis
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: 'https://moved-possum-18312.upstash.io',
  token: 'AUeIAAIncDI0NjE4NThkZTIzZDU0NjVkYmZjODNiMWNmNjdjMzMwNHAyMTgzMTI'
});

async function checkDb() {
  console.log('Connexion a Redis Upstash...');
  
  try {
    const db = await redis.get('somone-cockpit-db');
    
    if (!db) {
      console.log('Base de donnees VIDE !');
      console.log('');
      console.log('Solutions:');
      console.log('   1. Creez un nouveau compte sur application');
      console.log('   2. Importez vos maquettes depuis les fichiers JSON export');
      return;
    }
    
    console.log('Base de donnees trouvee !');
    console.log('');
    console.log('Utilisateurs:', db.users?.length || 0);
    
    if (db.users && db.users.length > 0) {
      db.users.forEach((u, i) => {
        console.log('   ' + (i+1) + '. ' + u.username + ' (ID: ' + u.id + ', Admin: ' + u.isAdmin + ')');
      });
    }
    
    console.log('');
    console.log('Cockpits:', db.cockpits?.length || 0);
    
    if (db.cockpits && db.cockpits.length > 0) {
      db.cockpits.forEach((c, i) => {
        const domains = c.data?.domains?.length || 0;
        console.log('   ' + (i+1) + '. "' + c.name + '" - ' + domains + ' domaines (UserID: ' + c.userId + ')');
      });
    } else {
      console.log('   Aucun cockpit dans la base !');
    }
    
  } catch (err) {
    console.error('Erreur:', err.message);
  }
}

checkDb();
