/**
 * Script qui analyse et corrige automatiquement les problèmes d'images
 * dans les cockpits publiés
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixApiCode() {
  console.log('🔧 Correction du code API...\n');
  
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  if (!fs.existsSync(apiFile)) {
    console.error('❌ Fichier api/index.ts non trouvé');
    return false;
  }
  
  let content = fs.readFileSync(apiFile, 'utf8');
  let modified = false;
  
  // Vérifier et corriger le merge dans PUT /cockpits/:id
  const putMergePattern = /if \(existingDomain\) \{[\s\S]*?return merged;/;
  const putMergeMatch = content.match(putMergePattern);
  
  if (putMergeMatch) {
    const mergeCode = putMergeMatch[0];
    
    // Vérifier si backgroundImage est bien préservé
    if (!mergeCode.includes('merged.backgroundImage = existingDomain.backgroundImage')) {
      console.log('⚠️  Correction nécessaire: Merge ne préserve pas explicitement backgroundImage');
      
      // Chercher la ligne où on fait le merge et ajouter la préservation
      const newMergeCode = mergeCode.replace(
        /(\s+return merged;)/,
        `\n            // TOUJOURS PRÉSERVER backgroundImage si elle existe dans l'existant
            if (existingDomain.backgroundImage && 
                typeof existingDomain.backgroundImage === 'string' && 
                existingDomain.backgroundImage.trim().length > 0) {
              if (!newDomain.backgroundImage || 
                  typeof newDomain.backgroundImage !== 'string' || 
                  newDomain.backgroundImage.trim().length === 0 ||
                  newDomain.backgroundImage === '') {
                merged.backgroundImage = existingDomain.backgroundImage;
                console.log(\`[PUT] ✅ Préservé backgroundImage pour "\${newDomain.name}" (\${existingDomain.backgroundImage.length} chars)\`);
              }
            }$1`
      );
      
      content = content.replace(putMergePattern, newMergeCode);
      modified = true;
      console.log('✅ Merge corrigé pour préserver backgroundImage');
    } else {
      console.log('✅ Merge préserve déjà backgroundImage');
    }
  }
  
  // Vérifier la route publique
  const publicRoutePattern = /const domainsToSend = \(data\.domains \|\| \[\]\)\.map\(/;
  if (!content.match(publicRoutePattern)) {
    console.log('⚠️  Route publique n\'utilise pas domainsToSend');
  } else {
    console.log('✅ Route publique utilise domainsToSend');
  }
  
  if (modified) {
    fs.writeFileSync(apiFile, content, 'utf8');
    console.log('\n✅ Corrections appliquées à api/index.ts');
    return true;
  }
  
  return false;
}

function fixStoreCode() {
  console.log('\n🔧 Vérification du code store...\n');
  
  const storeFile = path.join(__dirname, '..', 'src', 'store', 'cockpitStore.ts');
  if (!fs.existsSync(storeFile)) {
    console.error('❌ Fichier store/cockpitStore.ts non trouvé');
    return false;
  }
  
  let content = fs.readFileSync(storeFile, 'utf8');
  let modified = false;
  
  // Vérifier que publishCockpit force une sauvegarde
  if (!content.includes('Sauvegarde forcée avant publication')) {
    console.log('⚠️  publishCockpit ne force pas de sauvegarde avant publication');
    console.log('   (Cette fonctionnalité devrait déjà être présente)');
  } else {
    console.log('✅ publishCockpit force une sauvegarde avant publication');
  }
  
  // Vérifier que triggerAutoSave envoie bien les domains avec toutes leurs propriétés
  const autoSavePattern = /domains:.*currentCockpit\.domains/;
  if (!content.match(autoSavePattern)) {
    console.log('⚠️  triggerAutoSave pourrait ne pas envoyer tous les domains');
  } else {
    console.log('✅ triggerAutoSave envoie les domains');
  }
  
  return false; // Pas de modification nécessaire
}

function createTestScenario() {
  console.log('\n📝 Création d\'un scénario de test...\n');
  
  const testScenario = `
// Scénario de test à exécuter manuellement dans la console du navigateur

// 1. Créer un cockpit avec une image
const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// 2. Ajouter un domaine avec image de fond
// (à faire via l'interface)

// 3. Vérifier que l'image est sauvegardée
// Dans la console, vérifier:
console.log('Domain backgroundImage:', currentCockpit?.domains[0]?.backgroundImage?.length);

// 4. Publier le cockpit
// (à faire via l'interface)

// 5. Vérifier dans les logs serveur:
// - [Publish] 💾 Sauvegarde forcée...
// - [PUBLISH] 🚀 Publication...
// - [PUBLISH] ✅ Après sauvegarde...

// 6. Ouvrir le cockpit publié et vérifier les logs:
// - [Public API] Domain "...": bg=✅(...)
// - [BackgroundView READ-ONLY] ✅ Image chargée...
`;
  
  const testFile = path.join(__dirname, 'test-scenario.md');
  fs.writeFileSync(testFile, testScenario, 'utf8');
  console.log('✅ Scénario de test créé: scripts/test-scenario.md');
}

function main() {
  console.log('🛠️  Script de correction automatique des problèmes d\'images\n');
  console.log('='.repeat(60));
  
  const apiFixed = fixApiCode();
  const storeChecked = fixStoreCode();
  createTestScenario();
  
  console.log('\n' + '='.repeat(60));
  
  if (apiFixed) {
    console.log('\n✅ Corrections appliquées. Relancez les tests avec:');
    console.log('   node scripts/test-images-flow.js');
    console.log('\n⚠️  N\'oubliez pas de déployer après vérification!');
  } else {
    console.log('\n✅ Code semble correct. Le problème peut être ailleurs:');
    console.log('   1. Vérifiez les logs serveur lors de la publication');
    console.log('   2. Vérifiez les logs du navigateur dans le cockpit publié');
    console.log('   3. Vérifiez que l\'auto-save a bien terminé avant publication');
  }
}

main();

