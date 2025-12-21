/**
 * Script pour corriger le fichier icons.ts en fusionnant les lignes multi-lignes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsFilePath = path.join(__dirname, '../src/components/icons.ts');
let content = fs.readFileSync(iconsFilePath, 'utf-8');

// Fusionner les lignes qui continuent (ligne se terminant par ' suivi d'une ligne commençant par \t\t)
// Pattern: '...\n\t\t...'
content = content.replace(/'([^']*)\n\t\t([^']*)'/g, "'$1$2'");

// Fusionner les lignes qui continuent avec d'autres patterns
content = content.replace(/'([^']*)\n\s+([^']*)'/g, "'$1$2'");

// S'assurer que chaque ligne d'icône est complète
const lines = content.split('\n');
const fixedLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Si c'est une ligne d'icône qui se termine par ' mais pas par ','
  if (line.match(/^\s+\w+:\s*'[^']*$/) && !line.endsWith("',")) {
    // C'est une ligne incomplète, fusionner avec les suivantes
    let completeLine = line;
    i++;
    
    while (i < lines.length && !completeLine.endsWith("',")) {
      const nextLine = lines[i];
      // Enlever les tabs/espaces au début
      const cleaned = nextLine.replace(/^\s+/, '');
      completeLine += cleaned;
      
      if (completeLine.endsWith("',")) {
        break;
      }
      i++;
    }
    
    fixedLines.push(completeLine);
  } else {
    fixedLines.push(line);
    i++;
  }
}

content = fixedLines.join('\n');

// Écrire le fichier corrigé
fs.writeFileSync(iconsFilePath, content, 'utf-8');
console.log('✅ Fichier icons.ts corrigé');








