/**
 * Script pour extraire les paths SVG directement depuis les fichiers source de @mui/icons-material
 * Cette approche est plus fiable car elle utilise les SVG directement depuis le package
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fonction pour extraire le path SVG depuis un fichier source MUI
function extractSVGPathFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Format dans @mui/icons-material: d: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"
    // Chercher d: "..." ou d: '...'
    const pathMatch = content.match(/d:\s*["']([^"']+)["']/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Format alternatif: <path d="..." />
    const pathMatch2 = content.match(/<path[^>]*d=["']([^"']+)["']/);
    if (pathMatch2) {
      return pathMatch2[1];
    }
    
    // Format avec jsx: jsx("path", { d: "..." })
    const jsxMatch = content.match(/jsx\([^,]+,\s*\{[^}]*d:\s*["']([^"']+)["']/);
    if (jsxMatch) {
      return jsxMatch[1];
    }
    
    // Format avec plusieurs paths (combiner)
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

// Fonction principale
async function extractAllIconsFromPackage() {
  console.log('🚀 Extraction des icônes depuis @mui/icons-material...\n');
  
  const iconsDir = path.join(__dirname, '../node_modules/@mui/icons-material');
  
  if (!fs.existsSync(iconsDir)) {
    console.log('❌ @mui/icons-material non installé. Installation...');
    const { execSync } = await import('child_process');
    execSync('npm install @mui/icons-material --no-save', { 
      cwd: path.join(__dirname, '..'), 
      stdio: 'inherit' 
    });
  }
  
  const files = fs.readdirSync(iconsDir);
  // Prendre tous les fichiers .js sauf index.js
  // On prend aussi les variantes (Outlined, Rounded, etc.) mais on les traite comme des icônes séparées
  const iconFiles = files.filter(f => 
    f.endsWith('.js') && 
    f !== 'index.js'
  );
  
  console.log(`📋 ${iconFiles.length} fichiers d'icônes trouvés\n`);
  
  // Lire les icônes existantes
  const iconsFilePath = path.join(__dirname, '../src/components/icons.ts');
  const existingIcons = {};
  if (fs.existsSync(iconsFilePath)) {
    const content = fs.readFileSync(iconsFilePath, 'utf-8');
    const existingMatches = content.matchAll(/(\w+):\s*'([^']+)'/g);
    for (const match of existingMatches) {
      existingIcons[match[1]] = match[2];
    }
  }
  
  const icons = { ...existingIcons };
  let extracted = 0;
  let skipped = 0;
  let failed = 0;
  
  console.log('📥 Extraction des paths SVG...\n');
  
  for (let i = 0; i < iconFiles.length; i++) {
    const file = iconFiles[i];
    const iconName = file.replace('.js', '');
    const filePath = path.join(iconsDir, file);
    
    if (existingIcons[iconName]) {
      skipped++;
      continue;
    }
    
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
  
  // Générer le fichier
  const iconNamesSorted = Object.keys(icons).sort();
  let output = `// Icônes SVG intégrées - Material Design Icons\n`;
  output += `// Total: ${iconNamesSorted.length} icônes\n`;
  output += `// Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
  output += `export const ICONS: Record<string, string> = {\n`;
  
  for (const name of iconNamesSorted) {
    const path = icons[name];
    const escapedPath = path.replace(/'/g, "\\'");
    output += `  ${name}: '${escapedPath}',\n`;
  }
  
  output += `};\n\n`;
  output += `export const ICON_NAMES = Object.keys(ICONS);\n`;
  
  fs.writeFileSync(iconsFilePath, output, 'utf-8');
  
  console.log(`\n✨ Terminé !`);
  console.log(`📊 Total: ${iconNamesSorted.length} icônes`);
  console.log(`   - Extraites: ${extracted}`);
  console.log(`   - Ignorées (existantes): ${skipped}`);
  console.log(`   - Échecs: ${failed}`);
  console.log(`\n💾 Fichier sauvegardé: ${iconsFilePath}`);
}

extractAllIconsFromPackage().catch(console.error);

