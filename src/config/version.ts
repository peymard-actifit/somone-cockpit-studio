// Version de l'application - importée depuis package.json
import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const VERSION_DISPLAY = `v${packageJson.version}`;

// Système de versioning :
// - major : modification majeure (1er niveau)
// - minor : ajout de fonctionnalité (2ème niveau)
// - patch : correctif ou modification mineure (3ème niveau)




