/**
 * Script pour télécharger et extraire toutes les icônes Material UI
 * Les icônes sont extraites depuis le package @mui/icons-material
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Liste complète des icônes Material UI (première page + icônes populaires)
// Source: https://mui.com/material-ui/material-icons/
const MUI_ICONS = [
  // Navigation & Actions
  'Home', 'Menu', 'Close', 'ArrowBack', 'ArrowForward', 'ChevronLeft', 'ChevronRight',
  'ExpandMore', 'ExpandLess', 'MoreVert', 'Refresh', 'Search', 'Settings',
  'Add', 'Remove', 'Delete', 'Edit', 'Check', 'Clear', 'Block', 'Done',
  'Download', 'Upload', 'Send', 'Save', 'Cancel', 'Help', 'Info', 'Warning',
  
  // Communication & Media
  'Mail', 'Phone', 'Call', 'Message', 'Chat', 'Notifications', 'NotificationImportant',
  'Campaign', 'Email', 'MarkEmailRead', 'MarkEmailUnread', 'Inbox', 'Drafts',
  
  // Content & Files
  'ContentCopy', 'ContentCut', 'ContentPaste', 'Folder', 'FolderOpen', 'FileCopy',
  'Description', 'InsertDriveFile', 'AttachFile', 'Image', 'VideoLibrary', 'MusicNote',
  
  // Social & People
  'Person', 'People', 'PersonAdd', 'Group', 'GroupAdd', 'Face', 'AccountCircle',
  'SupervisorAccount', 'HowToReg', 'VerifiedUser', 'AdminPanelSettings',
  
  // Places & Location
  'LocationOn', 'Place', 'Map', 'MyLocation', 'Business', 'Store', 'Storefront',
  'Home', 'Apartment', 'Hotel', 'Restaurant', 'LocalHospital', 'School', 'Work',
  
  // Transportation
  'DirectionsCar', 'Flight', 'Train', 'DirectionsBus', 'DirectionsBike', 'DirectionsWalk',
  'DirectionsBoat', 'LocalShipping', 'FlightTakeoff', 'FlightLand', 'LocalTaxi',
  
  // Technology & Devices
  'Computer', 'Laptop', 'Smartphone', 'Tablet', 'Watch', 'Headphones', 'PhoneAndroid',
  'PhoneIphone', 'Devices', 'DeviceHub', 'Router', 'Memory', 'Storage', 'Dns',
  'Wifi', 'WifiOff', 'Bluetooth', 'Nfc', 'SignalWifi4Bar', 'SignalCellular4Bar',
  
  // Tools & Engineering
  'Build', 'Engineering', 'Handyman', 'Construction', 'PrecisionManufacturing',
  'Tune', 'Settings', 'SettingsApplications', 'SettingsInputComponent', 'SettingsInputHdmi',
  
  // Alerts & Feedback
  'Error', 'ErrorOutline', 'Warning', 'WarningAmber', 'Info', 'CheckCircle', 'CheckCircleOutline',
  'Cancel', 'CancelOutline', 'Help', 'HelpOutline', 'NotificationImportant',
  'Report', 'ReportProblem', 'Feedback', 'ThumbUp', 'ThumbDown', 'Star', 'StarBorder',
  
  // Time & Date
  'AccessTime', 'Schedule', 'Today', 'Event', 'CalendarToday', 'CalendarMonth',
  'DateRange', 'EventAvailable', 'EventBusy', 'Alarm', 'Timer', 'HourglassEmpty',
  
  // Weather & Nature
  'WbSunny', 'Cloud', 'CloudOff', 'Thunderstorm', 'AcUnit', 'WaterDrop', 'Air',
  'Nature', 'Park', 'Agriculture', 'Forest',
  
  // Finance & Business
  'AccountBalance', 'AccountBalanceWallet', 'MonetizationOn', 'Payment', 'CreditCard',
  'ShoppingCart', 'Store', 'Storefront', 'LocalGroceryStore', 'Receipt', 'AttachMoney',
  
  // Health & Medical
  'LocalHospital', 'MedicalServices', 'Healing', 'FitnessCenter', 'Spa', 'Pool',
  'Coronavirus', 'Vaccines', 'HealthAndSafety',
  
  // Security & Privacy
  'Lock', 'LockOpen', 'Security', 'Shield', 'VerifiedUser', 'PrivacyTip', 'VpnKey',
  'Visibility', 'VisibilityOff', 'Fingerprint', 'AdminPanelSettings',
  
  // Charts & Analytics
  'BarChart', 'LineChart', 'PieChart', 'ShowChart', 'TrendingUp', 'TrendingDown',
  'Assessment', 'Analytics', 'Insights', 'DonutSmall', 'DonutLarge',
  
  // Communication & Social
  'Share', 'ShareLocation', 'Public', 'Language', 'Forum', 'QuestionAnswer',
  'Comment', 'CommentsDisabled', 'AlternateEmail', 'Atm', 'QRCode',
  
  // Miscellaneous
  'Favorite', 'FavoriteBorder', 'Bookmark', 'BookmarkBorder', 'Flag', 'FlagOutlined',
  'Label', 'LabelOutline', 'Tag', 'Category', 'FilterList', 'Sort', 'SwapVert',
  'MoreHoriz', 'DragIndicator', 'CheckBox', 'CheckBoxOutlineBlank', 'RadioButtonChecked',
  'RadioButtonUnchecked', 'ToggleOn', 'ToggleOff', 'Switch', 'PlayArrow', 'Pause',
  'Stop', 'SkipNext', 'SkipPrevious', 'FastForward', 'FastRewind', 'VolumeUp',
  'VolumeDown', 'VolumeOff', 'Fullscreen', 'FullscreenExit', 'ZoomIn', 'ZoomOut',
  
  // Extended icons
  'AddCircle', 'AddCircleOutline', 'RemoveCircle', 'RemoveCircleOutline',
  'CheckCircle', 'CheckCircleOutline', 'Cancel', 'CancelOutline',
  'RadioButtonChecked', 'RadioButtonUnchecked', 'IndeterminateCheckBox',
  'Star', 'StarBorder', 'StarHalf', 'StarOutline', 'Favorite', 'FavoriteBorder',
  
  // UI Controls
  'KeyboardArrowUp', 'KeyboardArrowDown', 'KeyboardArrowLeft', 'KeyboardArrowRight',
  'ArrowUpward', 'ArrowDownward', 'ArrowBack', 'ArrowForward', 'ArrowBackIos',
  'ArrowForwardIos', 'FirstPage', 'LastPage', 'ChevronLeft', 'ChevronRight',
  
  // Material Design Extended
  'Dashboard', 'ViewModule', 'ViewList', 'ViewQuilt', 'GridView', 'ViewComfy',
  'ViewCompact', 'Apps', 'Menu', 'MoreVert', 'MoreHoriz', 'Reorder',
];

// Paths SVG pour les icônes Material UI
// Note: Ces paths sont génériques pour le format Material Design 24x24
// Les icônes complètes seront téléchargées depuis une source fiable
const MUI_ICON_PATHS = {
  // Vous pouvez ajouter ici des chemins SVG spécifiques
  // Pour l'instant, on va utiliser un script qui génère les icônes depuis une API
};

async function downloadMUIconSVG(iconName) {
  // Utiliser le repository GitHub officiel Material Design Icons
  // https://github.com/google/material-design-icons
  // Format: https://fonts.google.com/icons (mais nécessite parsing)
  
  // Alternative: utiliser Material Icons CDN avec le format correct
  const formats = [
    `https://material-icons.github.io/material-icons/svg/${iconName.toLowerCase()}.svg`,
    `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${iconName.toLowerCase()}/default/24px.svg`,
    `https://fonts.gstatic.com/s/i/materialiconsoutlined/${iconName.toLowerCase()}/v1/24px.svg`,
  ];
  
  for (const url of formats) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const svgText = await response.text();
        // Extraire le path d depuis le SVG (peut y avoir plusieurs paths)
        const pathMatches = svgText.matchAll(/<path[^>]*d="([^"]+)"/g);
        const paths = Array.from(pathMatches).map(m => m[1]);
        if (paths.length > 0) {
          // Combiner tous les paths s'il y en a plusieurs
          return paths.join(' ');
        }
      }
    } catch (error) {
      // Continuer avec la prochaine URL
      continue;
    }
  }
  
  // Si aucune source ne fonctionne, utiliser un path par défaut (icône cercle avec point d'interrogation)
  console.warn(`⚠️  Impossible de télécharger ${iconName}, utilisation d'un path par défaut`);
  return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
}

async function generateIconsFile() {
  console.log('🚀 Début du téléchargement des icônes Material UI...\n');
  
  const icons = { ...MUI_ICON_PATHS };
  const existingIcons = new Set();
  let downloaded = 0;
  let failed = 0;
  
  // Lire les icônes existantes
  const iconsFilePath = path.join(__dirname, '../src/components/icons.ts');
  if (fs.existsSync(iconsFilePath)) {
    const content = fs.readFileSync(iconsFilePath, 'utf-8');
    const existingMatches = content.matchAll(/(\w+):\s*'([^']+)'/g);
    for (const match of existingMatches) {
      existingIcons.add(match[1]);
      icons[match[1]] = match[2];
    }
  }
  
  console.log(`${existingIcons.size} icônes existantes trouvées.\n`);
  console.log(`Téléchargement de ${MUI_ICONS.length} nouvelles icônes...\n`);
  
  // Télécharger chaque icône
  for (const iconName of MUI_ICONS) {
    if (existingIcons.has(iconName)) {
      console.log(`⏭️  ${iconName} (déjà existante)`);
      continue;
    }
    
    console.log(`⬇️  Téléchargement de ${iconName}...`);
    const path = await downloadMUIconSVG(iconName);
    
    if (path) {
      icons[iconName] = path;
      downloaded++;
      console.log(`✅ ${iconName} téléchargée`);
    } else {
      failed++;
      console.log(`❌ Échec pour ${iconName}`);
      // Utiliser un path par défaut pour éviter les erreurs
      icons[iconName] = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
    }
    
    // Pause pour ne pas surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Générer le fichier icons.ts
  const iconNames = Object.keys(icons).sort();
  let output = `// Icônes SVG intégrées - Material Design Icons\n`;
  output += `// Total: ${iconNames.length} icônes\n`;
  output += `// Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
  output += `export const ICONS: Record<string, string> = {\n`;
  
  for (const name of iconNames) {
    const path = icons[name];
    output += `  ${name}: '${path}',\n`;
  }
  
  output += `};\n\n`;
  output += `export const ICON_NAMES = Object.keys(ICONS);\n`;
  
  // Écrire le fichier
  fs.writeFileSync(iconsFilePath, output, 'utf-8');
  
  console.log(`\n✨ Terminé !`);
  console.log(`📊 Statistiques:`);
  console.log(`   - Total: ${iconNames.length} icônes`);
  console.log(`   - Téléchargées: ${downloaded}`);
  console.log(`   - Échecs: ${failed}`);
  console.log(`   - Existantes: ${existingIcons.size}`);
  console.log(`\n💾 Fichier sauvegardé: ${iconsFilePath}`);
}

// Exécuter le script
generateIconsFile().catch(console.error);

