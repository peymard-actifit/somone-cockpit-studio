/**
 * Script pour vérifier les limites de Redis et les problèmes potentiels
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function analyzeRedisUsage() {
  console.log('📊 Analyse de l\'utilisation de Redis\n');
  
  console.log('Limites connues de Upstash Redis:');
  console.log('  - Taille max d\'une valeur: 512 MB (théorique)');
  console.log('  - Taille max d\'une valeur JSON: Pratiquement illimitée');
  console.log('  - Taille max recommandée: < 10 MB pour de bonnes performances');
  console.log('');
  
  console.log('⚠️  Problèmes potentiels:');
  console.log('  1. Si les images base64 sont > 5-10 MB, Redis peut être lent');
  console.log('  2. JSON.stringify/parse peut tronquer les très grandes chaînes');
  console.log('  3. Les caractères spéciaux dans base64 peuvent poser problème');
  console.log('');
  
  console.log('💡 Solutions:');
  console.log('  1. Limiter la taille des images uploadées à 2-3 MB max');
  console.log('  2. Compresser les images avant stockage (utiliser canvas pour redimensionner)');
  console.log('  3. Vérifier que redis.set reçoit bien l\'objet complet');
  console.log('  4. Ajouter des logs pour vérifier la taille avant/après sauvegarde');
}

function suggestImageOptimization() {
  console.log('\n💡 Suggestions d\'optimisation des images:\n');
  
  console.log('1. Ajouter une compression automatique lors de l\'upload:');
  console.log(`
   // Dans handleFileUpload, avant de sauvegarder:
   function compressImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<string> {
     return new Promise((resolve) => {
       const reader = new FileReader();
       reader.onload = (e) => {
         const img = new Image();
         img.onload = () => {
           const canvas = document.createElement('canvas');
           let width = img.width;
           let height = img.height;
           
           if (width > maxWidth) {
             height = (height * maxWidth) / width;
             width = maxWidth;
           }
           
           canvas.width = width;
           canvas.height = height;
           const ctx = canvas.getContext('2d');
           ctx?.drawImage(img, 0, 0, width, height);
           
           const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
           resolve(compressedBase64);
         };
         img.src = e.target?.result as string;
       };
       reader.readAsDataURL(file);
     });
   }
  `);
  
  console.log('\n2. Vérifier la taille avant sauvegarde:');
  console.log('   - Logger la taille de backgroundImage avant redis.set');
  console.log('   - Logger la taille après redis.get');
  console.log('   - Si différent, les données sont tronquées');
}

function checkApiForSizeLimits() {
  console.log('\n🔍 Vérification du code API pour les limites de taille:\n');
  
  const apiFile = path.join(__dirname, '..', 'api', 'index.ts');
  if (!fs.existsSync(apiFile)) {
    console.log('❌ Fichier non trouvé');
    return;
  }
  
  const content = fs.readFileSync(apiFile, 'utf8');
  
  // Vérifier s'il y a des vérifications de taille
  if (content.includes('file.size') || content.includes('maxSize') || content.includes('MAX_SIZE')) {
    console.log('✅ Il y a des vérifications de taille dans le code');
  } else {
    console.log('⚠️  Pas de vérification explicite de taille d\'image dans l\'API');
  }
  
  // Vérifier comment redis.set est utilisé
  if (content.includes('redis.set(DB_KEY, db)')) {
    console.log('✅ redis.set utilise l\'objet complet (pas de transformation)');
  }
  
  // Vérifier s'il y a des logs de taille
  if (content.includes('backgroundImage.length') || content.includes('chars')) {
    console.log('✅ Il y a des logs de taille de backgroundImage');
  } else {
    console.log('⚠️  Pas de logs de taille de backgroundImage dans l\'API');
  }
}

function main() {
  console.log('🔍 Analyse des limites Redis et optimisation des images\n');
  console.log('='.repeat(60));
  
  analyzeRedisUsage();
  checkApiForSizeLimits();
  suggestImageOptimization();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📝 Prochaines étapes:');
  console.log('   1. Vérifier dans les logs la taille des images sauvegardées');
  console.log('   2. Vérifier si les images sont tronquées (> 5 MB)');
  console.log('   3. Ajouter une compression automatique si nécessaire');
}

main();
















