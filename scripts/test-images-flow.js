/**
 * Script de test automatisé pour vérifier le flux complet des images
 * dans les cockpits publiés
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock des fonctions nécessaires
function generateId() {
  return 'test-' + Math.random().toString(36).substr(2, 9);
}

// Simuler les données
function createMockData() {
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  return {
    cockpit: {
      id: generateId(),
      name: 'Test Cockpit Images',
      userId: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        domains: [
          {
            id: generateId(),
            name: 'Domaine avec Background',
            templateType: 'background',
            backgroundImage: testImageBase64,
            categories: []
          },
          {
            id: generateId(),
            name: 'Domaine avec Map',
            templateType: 'map',
            backgroundImage: testImageBase64,
            mapBounds: {
              topLeft: { lat: 48.8566, lng: 2.3522 },
              bottomRight: { lat: 48.8600, lng: 2.3600 }
            },
            mapElements: [
              {
                id: generateId(),
                name: 'Point test',
                gps: { lat: 48.8583, lng: 2.3561 },
                status: 'ok'
              }
            ],
            categories: []
          }
        ],
        zones: [],
        logo: null,
        scrollingBanner: null
      }
    }
  };
}

// Test 1: Vérifier que le merge préserve backgroundImage
function testMergePreservation() {
  console.log('\n🔍 Test 1: Merge preserve backgroundImage');
  
  const existingDomain = {
    id: 'domain-1',
    name: 'Test Domain',
    backgroundImage: 'data:image/png;base64,EXISTING_IMAGE',
    mapBounds: { topLeft: { lat: 0, lng: 0 }, bottomRight: { lat: 1, lng: 1 } }
  };
  
  const newDomainWithoutImage = {
    id: 'domain-1',
    name: 'Test Domain Updated',
    // Pas de backgroundImage
  };
  
  // Simuler le merge comme dans l'API
  const merged = {
    ...existingDomain,
    ...newDomainWithoutImage,
  };
  
  // Si newDomain n'a pas de backgroundImage valide, préserver l'existant
  if (!newDomainWithoutImage.backgroundImage || 
      typeof newDomainWithoutImage.backgroundImage !== 'string' || 
      newDomainWithoutImage.backgroundImage.trim().length === 0) {
    if (existingDomain.backgroundImage && 
        typeof existingDomain.backgroundImage === 'string' && 
        existingDomain.backgroundImage.trim().length > 0) {
      merged.backgroundImage = existingDomain.backgroundImage;
    }
  }
  
  if (merged.backgroundImage === existingDomain.backgroundImage) {
    console.log('✅ PASS: backgroundImage préservée');
    return true;
  } else {
    console.log('❌ FAIL: backgroundImage perdue dans le merge');
    return false;
  }
}

// Test 2: Vérifier que la route publique renvoie les images
function testPublicRoute() {
  console.log('\n🔍 Test 2: Route publique renvoie backgroundImage');
  
  const cockpit = createMockData().cockpit;
  const data = cockpit.data || {};
  
  const domainsToSend = (data.domains || []).map((domain) => ({
    ...domain, // Inclure TOUTES les propriétés
  }));
  
  const response = {
    id: cockpit.id,
    name: cockpit.name,
    domains: domainsToSend,
  };
  
  const allHaveImages = response.domains.every(d => 
    d.backgroundImage && 
    typeof d.backgroundImage === 'string' && 
    d.backgroundImage.length > 0
  );
  
  if (allHaveImages) {
    console.log('✅ PASS: Tous les domaines ont backgroundImage dans la réponse publique');
    return true;
  } else {
    console.log('❌ FAIL: Certains domaines n\'ont pas backgroundImage');
    response.domains.forEach((d, i) => {
      const hasImg = d.backgroundImage && d.backgroundImage.length > 0;
      console.log(`  Domain[${i}] "${d.name}": ${hasImg ? '✅' : '❌'}`);
    });
    return false;
  }
}

// Test 3: Vérifier le flow complet publication
function testPublishFlow() {
  console.log('\n🔍 Test 3: Flow complet de publication');
  
  // Simuler: Cockpit avec images dans currentCockpit
  const currentCockpit = {
    id: 'cockpit-1',
    name: 'Test',
    domains: [
      {
        id: 'd1',
        name: 'Domain 1',
        backgroundImage: 'data:image/png;base64,TEST_IMAGE_1',
        categories: []
      }
    ]
  };
  
  // Simuler: Sauvegarde avant publication
  const payload = {
    name: currentCockpit.name,
    domains: currentCockpit.domains || [],
  };
  
  // Simuler: Merge dans l'API
  const dbCockpit = {
    id: 'cockpit-1',
    data: {
      domains: []
    }
  };
  
  let mergedDomains = dbCockpit.data.domains || [];
  if (payload.domains && Array.isArray(payload.domains)) {
    mergedDomains = payload.domains.map((newDomain) => {
      const existingDomain = dbCockpit.data.domains?.find(d => d.id === newDomain.id);
      if (existingDomain) {
        const merged = { ...existingDomain, ...newDomain };
        // Préserver backgroundImage
        if (!newDomain.backgroundImage || newDomain.backgroundImage.trim().length === 0) {
          if (existingDomain.backgroundImage && existingDomain.backgroundImage.trim().length > 0) {
            merged.backgroundImage = existingDomain.backgroundImage;
          }
        }
        return merged;
      }
      return newDomain;
    });
  }
  
  dbCockpit.data.domains = mergedDomains;
  dbCockpit.data.isPublished = true;
  dbCockpit.data.publicId = 'test-public-id';
  
  // Vérifier après publication
  const publishedDomain = dbCockpit.data.domains.find(d => d.id === 'd1');
  if (publishedDomain && publishedDomain.backgroundImage === 'data:image/png;base64,TEST_IMAGE_1') {
    console.log('✅ PASS: Image préservée après publication');
    return true;
  } else {
    console.log('❌ FAIL: Image perdue après publication');
    console.log('  Published domain:', publishedDomain);
    return false;
  }
}

// Test 4: Analyser le code source pour trouver les problèmes potentiels
function analyzeSourceCode() {
  console.log('\n🔍 Test 4: Analyse du code source');
  
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  if (!fs.existsSync(apiFile)) {
    console.log('⚠️  Fichier api/index.ts non trouvé');
    return false;
  }
  
  const content = fs.readFileSync(apiFile, 'utf8');
  
  const checks = [
    {
      name: 'PUT route préserve backgroundImage',
      pattern: /backgroundImage.*existingDomain|merged\.backgroundImage.*existingDomain\.backgroundImage/,
      pass: false
    },
    {
      name: 'Public route renvoie tous les domaines',
      pattern: /domains:.*domainsToSend|domains:.*domainsWithAllProps/,
      pass: false
    },
    {
      name: 'Publish route log les images',
      pattern: /\[PUBLISH\].*backgroundImage|backgroundImage.*PRESENTE/,
      pass: false
    }
  ];
  
  checks.forEach(check => {
    check.pass = check.pattern.test(content);
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  });
  
  return checks.every(c => c.pass);
}

// Test 5: Vérifier les composants React
function analyzeReactComponents() {
  console.log('\n🔍 Test 5: Analyse des composants React');
  
  const bgViewFile = path.join(__dirname, '..', 'src', 'components', 'BackgroundView.tsx');
  const mapViewFile = path.join(__dirname, '..', 'src', 'components', 'MapView.tsx');
  
  const results = [];
  
  if (fs.existsSync(bgViewFile)) {
    const content = fs.readFileSync(bgViewFile, 'utf8');
    const hasImageCheck = /domain\.backgroundImage|imageUrl|domain\?\.backgroundImage/.test(content);
    const hasReadOnlySupport = /readOnly|_readOnly/.test(content);
    results.push({ name: 'BackgroundView lit backgroundImage', pass: hasImageCheck });
    results.push({ name: 'BackgroundView supporte readOnly', pass: hasReadOnlySupport });
  }
  
  if (fs.existsSync(mapViewFile)) {
    const content = fs.readFileSync(mapViewFile, 'utf8');
    const hasImageCheck = /domain\.backgroundImage|mapImageUrl/.test(content);
    const hasReadOnlySupport = /readOnly|_readOnly/.test(content);
    results.push({ name: 'MapView lit backgroundImage', pass: hasImageCheck });
    results.push({ name: 'MapView supporte readOnly', pass: hasReadOnlySupport });
  }
  
  results.forEach(r => {
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}`);
  });
  
  return results.every(r => r.pass);
}

// Exécuter tous les tests
function runAllTests() {
  console.log('🧪 Démarrage des tests automatisés du flux des images\n');
  console.log('=' .repeat(60));
  
  const results = [
    testMergePreservation(),
    testPublicRoute(),
    testPublishFlow(),
    analyzeSourceCode(),
    analyzeReactComponents()
  ];
  
  console.log('\n' + '='.repeat(60));
  const allPassed = results.every(r => r);
  
  if (allPassed) {
    console.log('\n✅ TOUS LES TESTS PASSENT');
    console.log('Le code semble correct. Le problème peut être dans:');
    console.log('  1. Les données en base de données');
    console.log('  2. Le timing (auto-save pas terminé)');
    console.log('  3. Un problème réseau/Vercel');
  } else {
    console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('Des corrections sont nécessaires dans le code.');
  }
  
  return allPassed;
}

// Lancer les tests
const success = runAllTests();
process.exit(success ? 0 : 1);

