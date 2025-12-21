/**
 * Script pour corriger complètement le fichier icons.ts
 * En réextrayant depuis le package @mui/icons-material avec une meilleure gestion
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '../node_modules/@mui/icons-material');
const iconsFilePath = path.join(__dirname, '../src/components/icons.ts');

if (!fs.existsSync(iconsDir)) {
  console.log('❌ @mui/icons-material non installé');
  process.exit(1);
}

const files = fs.readdirSync(iconsDir);
const iconFiles = files.filter(f => 
  f.endsWith('.js') && 
  f !== 'index.js'
);

console.log(`📋 ${iconFiles.length} fichiers d'icônes trouvés\n`);

function extractSVGPathFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Format: d: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"
    const pathMatch = content.match(/d:\s*["']([^"']+)["']/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Format avec jsx: jsx("path", { d: "..." })
    const jsxMatch = content.match(/jsx\([^,]+,\s*\{[^}]*d:\s*["']([^"']+)["']/);
    if (jsxMatch) {
      return jsxMatch[1];
    }
    
    // Format avec plusieurs paths
    const allPaths = content.matchAll(/d:\s*["']([^"']+)["']/g);
    const paths = Array.from(allPaths).map(m => m[1]);
    if (paths.length > 0) {
      return paths.join(' ');
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

const icons = {};
let extracted = 0;
let failed = 0;

console.log('📥 Extraction des paths SVG...\n');

for (let i = 0; i < iconFiles.length; i++) {
  const file = iconFiles[i];
  const iconName = file.replace('.js', '');
  const filePath = path.join(iconsDir, file);
  
  if ((i + 1) % 500 === 0 || extracted < 20) {
    console.log(`📄 ${i + 1}/${iconFiles.length} - ${iconName}...`);
  }
  
  const svgPath = extractSVGPathFromFile(filePath);
  
  if (svgPath && svgPath.length > 10) {
    icons[iconName] = svgPath;
    extracted++;
    if (extracted % 100 === 0) {
      console.log(`✅ ${extracted} extraites...`);
    }
  } else {
    failed++;
    // Path par défaut
    icons[iconName] = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
  }
}

// Générer le fichier avec une meilleure gestion des caractères spéciaux
const iconNamesSorted = Object.keys(icons).sort();
let output = `// Icônes SVG intégrées - Material Design Icons\n`;
output += `// Total: ${iconNamesSorted.length} icônes\n`;
output += `// Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
output += `export const ICONS: Record<string, string> = {\n`;

for (const name of iconNamesSorted) {
  const path = icons[name];
  // Échapper correctement les apostrophes et autres caractères spéciaux
  const escapedPath = path
    .replace(/\\/g, '\\\\')  // Échapper les backslashes
    .replace(/'/g, "\\'")    // Échapper les apostrophes
    .replace(/\n/g, ' ')     // Remplacer les newlines par des espaces
    .replace(/\r/g, '')      // Supprimer les retours chariot
    .replace(/\t/g, ' ');    // Remplacer les tabs par des espaces
  
  output += `  ${name}: '${escapedPath}',\n`;
}

output += `};\n\n`;
output += `export const ICON_NAMES = Object.keys(ICONS);\n`;

fs.writeFileSync(iconsFilePath, output, 'utf-8');

console.log(`\n✨ Terminé !`);
console.log(`📊 Total: ${iconNamesSorted.length} icônes`);
console.log(`   - Extraites: ${extracted}`);
console.log(`   - Échecs: ${failed}`);
console.log(`\n💾 Fichier sauvegardé: ${iconsFilePath}`);








