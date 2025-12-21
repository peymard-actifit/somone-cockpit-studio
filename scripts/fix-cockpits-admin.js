/**
 * Script pour transferer TOUTES les maquettes vers le compte ADMIN peymard@somone.fr
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: 'https://moved-possum-18312.upstash.io',
  token: 'AUeIAAIncDI0NjE4NThkZTIzZDU0NjVkYmZjODNiMWNmNjdjMzMwNHAyMTgzMTI'
});

// ID du compte admin peymard@somone.fr
const ADMIN_USER_ID = '1dee-2b35-2e64';

async function transferToAdmin() {
  console.log('=== Transfert vers le compte ADMIN peymard@somone.fr ===');
  console.log('');
  
  try {
    console.log('1. Lecture de la base...');
    const db = await redis.get('somone-cockpit-db');
    
    if (!db) {
      console.log('ERREUR: Base vide !');
      return;
    }
    
    console.log('   Utilisateurs: ' + db.users.length);
    console.log('   Cockpits: ' + db.cockpits.length);
    
    // Trouver admin
    const adminUser = db.users.find(u => u.id === ADMIN_USER_ID);
    console.log('');
    console.log('2. Admin trouve: ' + adminUser.username + ' (ID: ' + adminUser.id + ')');
    console.log('');
    
    // Transferer TOUS les cockpits vers admin
    console.log('3. Transfert de TOUTES les maquettes vers admin...');
    let count = 0;
    
    db.cockpits.forEach((cockpit) => {
      if (cockpit.userId !== ADMIN_USER_ID) {
        console.log('   -> "' + cockpit.name + '"');
        cockpit.userId = ADMIN_USER_ID;
        count++;
      }
    });
    
    console.log('   Transferees: ' + count);
    console.log('');
    
    // Sauvegarder
    console.log('4. Sauvegarde dans Redis...');
    await redis.set('somone-cockpit-db', db);
    console.log('   OK !');
    console.log('');
    
    // Verification
    console.log('5. Verification...');
    const check = await redis.get('somone-cockpit-db');
    const adminCockpits = check.cockpits.filter(c => c.userId === ADMIN_USER_ID);
    console.log('   Maquettes admin: ' + adminCockpits.length);
    console.log('');
    
    console.log('=== RESULTAT ===');
    console.log(adminCockpits.length + ' maquettes pour ' + adminUser.username + ':');
    adminCockpits.forEach((c, i) => {
      const domains = c.data?.domains?.length || 0;
      console.log('   ' + (i+1) + '. "' + c.name + '" (' + domains + ' domaines)');
    });
    console.log('');
    console.log('Rechargez la page !');
    
  } catch (err) {
    console.error('ERREUR:', err.message);
  }
}

transferToAdmin();
