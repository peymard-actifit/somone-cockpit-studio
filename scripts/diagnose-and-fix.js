/**
 * Script de diagnostic et correction automatique des problèmes d'images
 * Analyse la logique et propose des corrections
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function analyzeApiPutRoute() {
  console.log('\n📋 Analyse de la route PUT /cockpits/:id\n');
  
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  const content = fs.readFileSync(apiFile, 'utf8');
  
  // Extraire le code de merge
  const mergeSection = content.match(/\/\/ SIMPLIFICATION : Merge profond[\s\S]*?(\}\);[\s\S]*?\/\/ Log final)/);
  
  if (mergeSection) {
    const mergeCode = mergeSection[0];
    
    // Vérifier les points critiques
    const checks = [
      {
        name: 'Préserve backgroundImage de existingDomain',
        pattern: /existingDomain\.backgroundImage/,
        critical: true
      },
      {
        name: 'Vérifie si newDomain.backgroundImage est valide',
        pattern: /newDomain\.backgroundImage.*string|typeof.*backgroundImage.*string/,
        critical: true
      },
      {
        name: 'Assigne merged.backgroundImage = existingDomain.backgroundImage',
        pattern: /merged\.backgroundImage\s*=\s*existingDomain\.backgroundImage/,
        critical: true
      },
      {
        name: 'Gère les domaines non présents dans la requête',
        pattern: /domainsToAdd|filter.*!existingDomainIds/,
        critical: false
      }
    ];
    
    checks.forEach(check => {
      const found = check.pattern.test(mergeCode);
      console.log(`${found ? '✅' : '❌'} ${check.name}${check.critical ? ' (CRITIQUE)' : ''}`);
      if (check.critical && !found) {
        console.log(`   ⚠️  PROBLÈME CRITIQUE DÉTECTÉ!`);
      }
    });
    
    // Vérifier l'ordre des opérations
    const existingIndex = mergeCode.indexOf('...existingDomain');
    const newIndex = mergeCode.indexOf('...newDomain');
    const preserveIndex = mergeCode.indexOf('merged.backgroundImage = existingDomain.backgroundImage');
    
    if (existingIndex !== -1 && newIndex !== -1 && preserveIndex !== -1) {
      if (existingIndex < newIndex && newIndex < preserveIndex) {
        console.log('✅ Ordre des opérations correct (existing → new → preserve)');
      } else {
        console.log('❌ Ordre des opérations incorrect!');
      }
    }
  }
}

function analyzePublicRoute() {
  console.log('\n📋 Analyse de la route GET /public/cockpit/:publicId\n');
  
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  const content = fs.readFileSync(apiFile, 'utf8');
  
  // Extraire la route publique
  const publicRouteMatch = content.match(/const publicMatch = path\.match\([^;]+\);[\s\S]*?return res\.json\(response\);[\s\S]*?\}\s*\/\/ =/);
  
  if (publicRouteMatch) {
    const routeCode = publicRouteMatch[0];
    
    const checks = [
      {
        name: 'Crée domainsToSend avec spread operator',
        pattern: /domainsToSend.*\.map.*domain.*=>.*\{[\s\S]*?\.\.\.domain/,
        critical: true
      },
      {
        name: 'Retourne domainsToSend dans la réponse',
        pattern: /domains:\s*domainsToSend/,
        critical: true
      },
      {
        name: 'Log les images avant envoi',
        pattern: /console\.log.*backgroundImage|\[Public API\].*bg=/,
        critical: false
      }
    ];
    
    checks.forEach(check => {
      const found = check.pattern.test(routeCode);
      console.log(`${found ? '✅' : '❌'} ${check.name}${check.critical ? ' (CRITIQUE)' : ''}`);
    });
  }
}

function analyzePublishFlow() {
  console.log('\n📋 Analyse du flux de publication\n');
  
  const storeFile = path.join(__dirname, '..', 'src', 'store', 'cockpitStore.ts');
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  
  const storeContent = fs.readFileSync(storeFile, 'utf8');
  const apiContent = fs.readFileSync(apiFile, 'utf8');
  
  // Vérifier le store
  console.log('Store (publishCockpit):');
  const storeChecks = [
    {
      name: 'Force sauvegarde avant publication',
      pattern: /Sauvegarde forcée|saveResponse.*PUT.*cockpits/,
      critical: true
    },
    {
      name: 'Envoie tous les domains dans le payload',
      pattern: /domains:\s*currentCockpit\.domains/,
      critical: true
    },
    {
      name: 'Attend après sauvegarde',
      pattern: /setTimeout|Promise.*resolve.*500/,
      critical: false
    }
  ];
  
  storeChecks.forEach(check => {
    const found = check.pattern.test(storeContent);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}${check.critical ? ' (CRITIQUE)' : ''}`);
  });
  
  // Vérifier l'API
  console.log('\nAPI (POST /cockpits/:id/publish):');
  const apiChecks = [
    {
      name: 'Log les images avant publication',
      pattern: /\[PUBLISH\].*backgroundImage|hasBg.*backgroundImage/,
      critical: false
    },
    {
      name: 'Vérifie après sauvegarde',
      pattern: /Après sauvegarde|savedCockpit/,
      critical: false
    }
  ];
  
  apiChecks.forEach(check => {
    const found = check.pattern.test(apiContent);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
  });
}

function checkPotentialIssues() {
  console.log('\n🔍 Recherche de problèmes potentiels\n');
  
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  const content = fs.readFileSync(apiFile, 'utf8');
  
  const issues = [];
  
  // Vérifier si on ajoute les domaines manquants
  if (!content.includes('domainsToAdd') && !content.includes('domains existants qui ne sont PAS')) {
    issues.push({
      severity: 'WARNING',
      issue: 'Les domaines existants non modifiés pourraient être perdus lors d\'une mise à jour partielle',
      fix: 'Ajouter la logique pour préserver les domaines non inclus dans la requête'
    });
  }
  
  // Vérifier si le merge gère undefined
  if (!content.includes('newDomain.backgroundImage === undefined') && 
      !content.includes('!newDomain.backgroundImage')) {
    issues.push({
      severity: 'INFO',
      issue: 'Vérification de undefined pourrait être plus explicite',
      fix: 'Ajouter une vérification explicite pour undefined'
    });
  }
  
  if (issues.length === 0) {
    console.log('✅ Aucun problème potentiel détecté');
  } else {
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity}] ${issue.issue}`);
      console.log(`   Fix: ${issue.fix}\n`);
    });
  }
}

function suggestFixes() {
  console.log('\n💡 Suggestions de corrections\n');
  
  console.log('1. Vérifier dans la console du navigateur lors de la publication:');
  console.log('   - Cherchez "[Publish] 💾 Sauvegarde forcée..."');
  console.log('   - Vérifiez "domainsWithImages: X" (devrait être > 0)');
  console.log('   - Cherchez "[PUBLISH] 🚀 Publication..."');
  console.log('   - Vérifiez que tous les domaines ont "bg=✅"\n');
  
  console.log('2. Vérifier dans la console du cockpit publié:');
  console.log('   - Cherchez "[Public API] Domain ...: bg=✅(...)"');
  console.log('   - Cherchez "[BackgroundView READ-ONLY] ✅ Image chargée..."');
  console.log('   - Ou "[MapView READ-ONLY] ✅ Image de carte chargée..."\n');
  
  console.log('3. Si les images sont perdues, vérifier:');
  console.log('   - Que l\'auto-save a terminé (attendre 2-3 secondes après modification)');
  console.log('   - Que la publication attend bien la sauvegarde (logs "[Publish] 💾")');
  console.log('   - Que les données en DB contiennent bien backgroundImage (logs "[PUBLISH]")');
}

function main() {
  console.log('🔬 Diagnostic approfondi du flux des images\n');
  console.log('='.repeat(60));
  
  analyzeApiPutRoute();
  analyzePublicRoute();
  analyzePublishFlow();
  checkPotentialIssues();
  suggestFixes();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Diagnostic terminé');
  console.log('\n📝 Prochaines étapes:');
  console.log('   1. Exécutez: npm run test:images');
  console.log('   2. Publiez un cockpit avec images');
  console.log('   3. Vérifiez les logs dans la console');
  console.log('   4. Ouvrez le cockpit publié et vérifiez les logs');
}

main();
















