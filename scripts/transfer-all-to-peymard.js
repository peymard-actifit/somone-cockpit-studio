/**
 * Script pour transferer TOUTES les maquettes vers le compte peymard
 * et sauvegarder dans Redis Upstash
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: 'https://moved-possum-18312.upstash.io',
  token: 'AUeIAAIncDI0NjE4NThkZTIzZDU0NjVkYmZjODNiMWNmNjdjMzMwNHAyMTgzMTI'
});

const PEYMARD_USER_ID = '9346-29f2-1311';

async function transferAllToPeymard() {
  console.log('=== Transfert de TOUTES les maquettes vers peymard ===');
  console.log('');
  
  try {
    // 1. Lire la base actuelle
    console.log('1. Lecture de la base de donnees...');
    const db = await redis.get('somone-cockpit-db');
    
    if (!db) {
      console.log('ERREUR: Base de donnees vide !');
      return;
    }
    
    console.log('   Utilisateurs: ' + (db.users?.length || 0));
    console.log('   Cockpits: ' + (db.cockpits?.length || 0));
    console.log('');
    
    // 2. Trouver utilisateur peymard
    const peymardUser = db.users.find(u => u.id === PEYMARD_USER_ID);
    if (!peymardUser) {
      console.log('ERREUR: Utilisateur peymard non trouve !');
      return;
    }
    console.log('2. Utilisateur peymard trouve: ' + peymardUser.username);
    console.log('');
    
    // 3. Transferer toutes les maquettes vers peymard
    console.log('3. Transfert des maquettes...');
    let transferred = 0;
    let alreadyOwned = 0;
    
    db.cockpits.forEach((cockpit, i) => {
      const oldUserId = cockpit.userId;
      if (oldUserId !== PEYMARD_USER_ID) {
        const oldUser = db.users.find(u => u.id === oldUserId);
        console.log('   Transfert: "' + cockpit.name + '" de ' + (oldUser?.username || oldUserId) + ' vers peymard');
        cockpit.userId = PEYMARD_USER_ID;
        transferred++;
      } else {
        alreadyOwned++;
      }
    });
    
    console.log('');
    console.log('   Deja possedees par peymard: ' + alreadyOwned);
    console.log('   Transferees: ' + transferred);
    console.log('');
    
    // 4. Sauvegarder dans Redis
    console.log('4. Sauvegarde dans Redis Upstash...');
    await redis.set('somone-cockpit-db', db);
    console.log('   Sauvegarde reussie !');
    console.log('');
    
    // 5. Verification
    console.log('5. Verification...');
    const verifyDb = await redis.get('somone-cockpit-db');
    const peymardCockpits = verifyDb.cockpits.filter(c => c.userId === PEYMARD_USER_ID);
    console.log('   Maquettes de peymard apres transfert: ' + peymardCockpits.length);
    console.log('');
    
    console.log('=== RESULTAT ===');
    console.log('Toutes les maquettes (' + peymardCockpits.length + ') sont maintenant disponibles pour peymard:');
    peymardCockpits.forEach((c, i) => {
      const domains = c.data?.domains?.length || 0;
      console.log('   ' + (i+1) + '. "' + c.name + '" - ' + domains + ' domaines');
    });
    console.log('');
    console.log('Connectez-vous avec: peymard / Pat26rick_0637549759');
    
  } catch (err) {
    console.error('ERREUR:', err.message);
  }
}

transferAllToPeymard();
