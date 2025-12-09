/**
 * Script pour tester et valider les images base64
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function validateBase64Image(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return { valid: false, error: 'Not a string' };
  }
  
  // Vérifier le format data:image
  if (!base64String.startsWith('data:image/')) {
    return { valid: false, error: 'Does not start with data:image/' };
  }
  
  // Extraire la partie base64
  const base64Part = base64String.split(',')[1];
  if (!base64Part) {
    return { valid: false, error: 'No base64 data after comma' };
  }
  
  // Vérifier que c'est bien du base64 valide
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Part)) {
    return { valid: false, error: 'Invalid base64 characters' };
  }
  
  // Vérifier la longueur minimale (une image même petite fait au moins quelques centaines de caractères)
  if (base64Part.length < 100) {
    return { valid: false, error: 'Base64 data too short (likely corrupted)' };
  }
  
  return { valid: true };
}

function checkImageInComponent(componentFile, componentName) {
  console.log(`\n🔍 Vérification de ${componentName}:`);
  
  if (!fs.existsSync(componentFile)) {
    console.log(`  ❌ Fichier non trouvé: ${componentFile}`);
    return false;
  }
  
  const content = fs.readFileSync(componentFile, 'utf8');
  
  // Vérifier qu'on valide l'image avant de l'afficher
  const checks = [
    {
      name: 'Vérifie que backgroundImage est une string',
      pattern: /typeof.*backgroundImage.*===.*['"]string['"]/,
      critical: true
    },
    {
      name: 'Vérifie que backgroundImage.trim().length > 0',
      pattern: /backgroundImage\.trim\(\)\.length.*>.*0|backgroundImage\.length.*>.*0/,
      critical: true
    },
    {
      name: 'Vérifie que backgroundImage commence par data:',
      pattern: /backgroundImage\.startsWith\(['"]data:|startsWith\(['"]data:image/,
      critical: false
    }
  ];
  
  let allPass = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}${check.critical ? ' (CRITIQUE)' : ''}`);
    if (check.critical && !found) {
      allPass = false;
    }
  });
  
  return allPass;
}

function suggestImageValidation() {
  console.log('\n💡 Suggestions pour valider les images:\n');
  
  console.log('1. Ajouter une validation avant d\'afficher l\'image:');
  console.log(`
   function isValidBase64Image(str) {
     if (!str || typeof str !== 'string') return false;
     if (!str.startsWith('data:image/')) return false;
     const base64Part = str.split(',')[1];
     if (!base64Part || base64Part.length < 100) return false;
     return /^[A-Za-z0-9+/]*={0,2}$/.test(base64Part);
   }
  `);
  
  console.log('\n2. Vérifier dans la console du navigateur:');
  console.log('   - La longueur de backgroundImage (devrait être > 1000 caractères pour une vraie image)');
  console.log('   - Si backgroundImage commence par "data:image/"');
  console.log('   - Si backgroundImage contient des caractères étranges');
  
  console.log('\n3. Vérifier dans les logs serveur:');
  console.log('   - La longueur de backgroundImage lors de la sauvegarde');
  console.log('   - Si backgroundImage est bien présente dans cockpit.data.domains');
}

function main() {
  console.log('🔬 Validation des images base64\n');
  console.log('='.repeat(60));
  
  // Tester avec une image valide
  const validImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testResult = validateBase64Image(validImage);
  console.log('\n✅ Test avec image valide:', testResult.valid ? 'PASS' : 'FAIL');
  
  // Tester avec des images invalides
  const invalidTests = [
    { name: 'String vide', value: '' },
    { name: 'Non string', value: null },
    { name: 'Pas data:image', value: 'http://example.com/image.png' },
    { name: 'Base64 trop court', value: 'data:image/png;base64,abcd' },
    { name: 'Pas de base64', value: 'data:image/png;base64,' },
  ];
  
  console.log('\nTests avec images invalides:');
  invalidTests.forEach(test => {
    const result = validateBase64Image(test.value);
    console.log(`  ${result.valid ? '❌ FAIL' : '✅ PASS'}: ${test.name}`);
  });
  
  // Vérifier les composants
  const bgView = path.join(__dirname, '..', 'src', 'components', 'BackgroundView.tsx');
  const mapView = path.join(__dirname, '..', 'src', 'components', 'MapView.tsx');
  
  checkImageInComponent(bgView, 'BackgroundView');
  checkImageInComponent(mapView, 'MapView');
  
  suggestImageValidation();
  
  console.log('\n' + '='.repeat(60));
}

main();











