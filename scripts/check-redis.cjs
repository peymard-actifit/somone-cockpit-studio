const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
content.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?([^"]+)"?$/);
  if (match) envVars[match[1]] = match[2];
});

const { Redis } = require('@upstash/redis');
const r = new Redis({
  url: envVars.KV_REST_API_URL,
  token: envVars.KV_REST_API_TOKEN
});

async function check() {
  // Récupérer la base principale directement
  const mainDb = await r.get('somone-cockpit-db');
  
  if (!mainDb || !mainDb.cockpits) {
    console.log('Base principale non trouvee ou vide');
    return;
  }
  
  console.log('=== BASE PRINCIPALE somone-cockpit-db ===\n');
  console.log('Nb cockpits:', mainDb.cockpits.length);
  
  // Chercher les cockpits avec des domaines Map
  for (const c of mainDb.cockpits) {
    // Les domaines sont dans c.data.domains
    const domains = (c.data && c.data.domains) || [];
    
    if (domains.length > 0) {
      console.log('\n--- Cockpit:', c.name, '---');
      console.log('ID:', c.id);
      console.log('Derniere modif:', c.updatedAt);
      console.log('Nb domaines:', domains.length);
      for (const d of domains) {
        const cats = d.categories || [];
        let totalElems = 0;
        for (const cat of cats) {
          totalElems += (cat.elements || []).length;
        }
        console.log('  -', d.name, ':', totalElems, 'elems,', (d.mapElements || []).length, 'mapElems');
      }
    }
  }
  
  // Aussi lister les cockpits qui ont 0 domaines mais qui ont été modifies recemment
  console.log('\n\n=== COCKPITS SANS DOMAINES (modifies recemment) ===');
  const recentCockpits = mainDb.cockpits
    .filter(c => {
      const domains = (c.data && c.data.domains) || [];
      return domains.length === 0;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);
    
  for (const c of recentCockpits) {
    console.log(c.name, '- modifie:', c.updatedAt);
  }
}
check().catch(console.error);
